// Shared helpers for the teleport styles (web/tp-style-*.js): pixel rasters and bakes, easings, depth rules for the
// floor, route sampling, cheap batched shards and a 3x5 pixel font. Nothing here holds per-frame state.
import { H, OX, OY, PA, PG, TH, TW, W, WC } from './office-scene.js';
import { hash } from './island-grid.js';
import { PantryItems } from './pantry-items.js';
import { RestroomLogic } from './restroom-logic.js';

// The 8-connected 1 px outline of an ellipse with whole radii (midpoint algorithm).
function ellipse(a, b, put) {
  const a2 = a * a,
    b2 = b * b,
    quad = (x, y) => {
      put(x, y);
      put(-x, y);
      put(x, -y);
      put(-x, -y);
    };
  let x = 0,
    y = b,
    dx = 0,
    dy = 2 * a2 * y,
    d1 = b2 - a2 * b + 0.25 * a2;
  while (dx < dy) {
    quad(x, y);
    x++;
    dx += 2 * b2;
    if (d1 < 0) d1 += dx + b2;
    else {
      y--;
      dy -= 2 * a2;
      d1 += dx - dy + b2;
    }
  }
  let d2 = b2 * (x + 0.5) * (x + 0.5) + a2 * (y - 1) * (y - 1) - a2 * b2;
  while (y >= 0) {
    quad(x, y);
    y--;
    dy -= 2 * a2;
    if (d2 > 0) d2 += a2 - dy;
    else {
      x++;
      dx += 2 * b2;
      d2 += dx - dy + a2;
    }
  }
}
function line(x0, y0, x1, y1, put) {
  const dx = Math.abs(x1 - x0),
    dy = -Math.abs(y1 - y0),
    sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    put(x0, y0);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * e;
    if (e2 >= dy) {
      e += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      e += dx;
      y0 += sy;
    }
  }
}
// Paints a raster onto g at (ox, oy), one rectangle per horizontal run of a colour.
function bake(g, px, w, h, ox, colour, oy = 0) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; ) {
      const c = px[y * w + x];
      let e = x + 1;
      while (e < w && px[y * w + e] === c) e++;
      if (c) {
        g.fillStyle = colour(c);
        g.fillRect(ox + x, oy + y, e - x, 1);
      }
      x = e;
    }
}
// The only place a style makes a canvas: call it lazily, on the first frame that needs the bake, and keep the result.
function atlas(w, h, paint) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  paint(cv.getContext('2d'));
  return cv;
}
const clamp = v => (v < 0 ? 0 : v > 1 ? 1 : v),
  r = (u, a, b) => clamp((u - a) / (b - a)),
  out2 = p => 1 - (1 - p) * (1 - p),
  in2 = p => p * p,
  ease = p => p * p * (3 - 2 * p),
  frac = v => v - Math.floor(v),
  lerp = (a, b, p) => a + (b - a) * p,
  feet = (x, y) => {
    const p = PA(x, y);
    return [Math.round(p[0]), Math.round(p[1])];
  };
// The lounge rug is a flat pantry item drawn at depth 19, over anything on the floor under it; pad in tiles.
let rug = null;
function onRug(x, y, pad = 1.06) {
  if (!rug) {
    const it = PantryItems.LAYOUT.find(l => l[0] === 'rug'),
      size = PantryItems.I.rug && PantryItems.I.rug.size;
    if (!it || !size) return false;
    rug = [20 + it[1], it[2], 20 + it[1] + size[0], it[2] + size[1]];
  }
  return x > rug[0] - pad && y > rug[1] - pad && x < rug[2] + pad && y < rug[3] + pad;
}
// The depth of something flat on the floor at a tile: just over the rug when on it, else under everything.
const RUG_Z = 19.05;
const floorZ = (x, y) => (onRug(x, y) ? RUG_Z : -0.5);
// 1 or -1 for a spot on the lawn just in front of the office plinth's front or east face, else 0: the back of a circle
// there would lie over the face, which is painted before every item.
function plinth(x, y) {
  if (PA(x, y)[1] !== PG(x, y)[1]) return 0;
  if (y >= H && y < H + 1.1 && x > -1 && x < W + 1) return 1;
  return x >= W && x < W + 1.1 && y > -1 && y < H + 1 ? -1 : 0;
}
// Clips to the lawn in front of the plinth face's foot (save without restore: the caller restores).
function plinthClip(ctx, side, cx, cy) {
  const foot = x => OY + 2 * TH * (side > 0 ? H : W) + (side * (x - OX) * TH) / TW;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - 50, foot(cx - 50));
  ctx.lineTo(cx + 50, foot(cx + 50));
  ctx.lineTo(cx + 50, cy + 30);
  ctx.lineTo(cx - 50, cy + 30);
  ctx.closePath();
  ctx.clip();
}
// drawImage with smoothing only below 1x (lo), restoring what was set.
function stamp(ctx, lo, img, sx, sy, sw, sh, dx, dy, dw, dh) {
  const sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = lo;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.imageSmoothingEnabled = sm;
}
// A soft pixel shadow on the ground, w px wide, fading with height.
function shadow(ctx, px, py, w, alpha) {
  if (alpha <= 0) return;
  const hw = Math.max(2, Math.round(w / 2));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(px - hw + 2, py - 1, 2 * hw - 3, 3);
  ctx.fillRect(px - hw, py, 2 * hw + 1, 1);
  ctx.globalAlpha = 1;
}
// Point at arc fraction p along a tile polyline: out = [px, py, tx, ty, front]; start skips a hidden head.
function along(pts, start, p, out) {
  let L = 0;
  for (let k = start + 1; k < pts.length; k++) L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  let left = clamp(p) * L,
    k = start + 1;
  for (; k < pts.length - 1; k++) {
    const s = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    if (left <= s) break;
    left -= s;
  }
  const a = pts[Math.min(k - 1, pts.length - 1)],
    b = pts[Math.min(k, pts.length - 1)],
    s = Math.hypot(b[0] - a[0], b[1] - a[1]),
    q = s > 1e-9 ? Math.min(1, left / s) : 1,
    tx = lerp(a[0], b[0], q),
    ty = lerp(a[1], b[1], q),
    f = feet(tx, ty);
  out[0] = f[0];
  out[1] = f[1];
  out[2] = tx;
  out[3] = ty;
  out[4] = b[0] - a[0] + b[1] - a[1] >= 0;
  return out;
}
// First route point off the restroom floor (a hidden starter's route starts where it can be seen).
function seen(pts, hide) {
  if (!hide) return 0;
  let k = 0;
  while (k < pts.length - 1 && RestroomLogic.onFloor(WC, pts[k][0], pts[k][1])) k++;
  return k;
}
// Captured body rects as shards: xf(k, o) moves rect k by setting o[0], o[1] (px) and returns false to skip it.
// One beginPath and one fill per colour.
const SH = [0, 0];
function shards(ctx, cap, n, xf) {
  const m = Math.min(n, cap.n);
  for (let c = 0; c < cap.cols.length; c++) {
    let any = false;
    for (let k = 0; k < m; k++) {
      if (cap.c[k] !== c) continue;
      SH[0] = SH[1] = 0;
      if (xf && xf(k, SH) === false) continue;
      if (!any) {
        ctx.beginPath();
        any = true;
      }
      ctx.rect(cap.x[k] + SH[0], cap.y[k] + SH[1], cap.w[k], cap.h[k]);
    }
    if (any) {
      ctx.fillStyle = cap.cols[c];
      ctx.fill();
    }
  }
}
// A 3x5 pixel font for art tokens (GAME OVER, CTRL+X, 100%), not UI text: one octal digit per row, top first
// (4 left, 2 middle, 1 right). Strings become [x, y, h] column runs once.
const FONT = {
  A: '25755',
  B: '65656',
  C: '34443',
  D: '65556',
  E: '74647',
  F: '74644',
  G: '34553',
  H: '55755',
  I: '72227',
  J: '11152',
  K: '55655',
  L: '44447',
  M: '57755',
  N: '57775',
  O: '25552',
  P: '65644',
  Q: '25563',
  R: '65655',
  S: '34216',
  T: '72222',
  U: '55557',
  V: '55552',
  W: '55775',
  X: '55255',
  Y: '55222',
  Z: '71247',
  0: '75557',
  1: '26227',
  2: '61247',
  3: '61216',
  4: '55711',
  5: '74616',
  6: '34757',
  7: '71122',
  8: '75757',
  9: '75716',
  '%': '51245',
  '+': '02720',
  '/': '11244',
  ':': '02020',
  '.': '00002',
  '!': '22202',
  ' ': '00000',
};
const glyphCache = new Map();
function glyphs(str) {
  let g = glyphCache.get(str);
  if (g) return g;
  g = [];
  let x = 0;
  for (const ch of str.toUpperCase()) {
    const rows = FONT[ch] || FONT[' '];
    for (let i = 0; i < 3; i++) {
      const on = y => ((+rows[y] >> (2 - i)) & 1) === 1;
      for (let y = 0; y < 5; ) {
        if (!on(y)) {
          y++;
          continue;
        }
        let e = y + 1;
        while (e < 5 && on(e)) e++;
        g.push(x + i, y, e - y);
        y = e;
      }
    }
    x += 4;
  }
  g.w = Math.max(0, x - 1);
  if (glyphCache.size > 64) glyphCache.clear();
  glyphCache.set(str, g);
  return g;
}
// Pixel text centred on px, bottom at py, s px per font pixel, in one fill.
function text(ctx, str, px, py, col, s = 1) {
  const g = glyphs(str),
    x0 = Math.round(px - (g.w * s) / 2),
    y0 = Math.round(py - 5 * s);
  ctx.beginPath();
  for (let k = 0; k < g.length; k += 3) ctx.rect(x0 + g[k] * s, y0 + g[k + 1] * s, s, g[k + 2] * s);
  ctx.fillStyle = col;
  ctx.fill();
}

export const Kit = {
  // Bits of a style's need(X): back, floor and stand items at each end, the travelling thing, its ground shadow,
  // RUG, a flat item just over the lounge rug (a route's stretch across it, through rug(X)), and DESK, one just over
  // the landing desk and under anyone in front of it (desk(X)).
  PART: { B0: 1, B1: 2, F0: 4, F1: 8, S0: 16, S1: 32, TRIP: 64, SHADOW: 128, RUG: 256, DESK: 512 },
  RUG_Z,
  ellipse,
  line,
  bake,
  atlas,
  clamp,
  r,
  out2,
  in2,
  ease,
  frac,
  lerp,
  feet,
  hash,
  onRug,
  floorZ,
  plinth,
  plinthClip,
  stamp,
  shadow,
  along,
  seen,
  shards,
  glyphs,
  text,
};
