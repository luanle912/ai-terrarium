// The snow peak on the back lawn (mountain C, docs/specs/2026-11-08-mountain-c-brief.md and spec 11.10), painted in
// code at one art px per logical px from the brief's coordinates x SCALE (web/mountain-shape.js). Every pixel is
// worked out on its own (point in polygon at its centre) into a buffer of the brief's colours, then written as 1 px
// high runs: no paths, no gradients, no smoothing. Each picture is baked once per light and snow step and returned as
// { canvas, ax, ay }, (ax, ay) being where the foot's front corner F falls in it (F sits on a tile corner).
//   sprite(env, foot) the mountain: its faces, shoulders and ridge, the snow cap with its drips, the rock ledges, the
//                     grassy foot (blending into the lawn where it meets it), the cleft in the lit face with its falls
//   lake(env)         the small lake at its foot in its stone rim (baked into the island picture)
//   falls(env)        the falls again in 4 frames (the white flecks a px further down each) and the foam where they
//                     land
//                     in 2: web/office-draw.js steps them every 120 and 300 ms (fallFrame, foamFrame)
//   drawPine(...)     one pine of the clumps on the foot (island decor kind 'pine')
// Colours go through night() like the rest of the island; snow brings the cap further down and greys the grass.
import { hash } from './island-land.js';
import { mix, night, OUTLINE } from './island-art.js';
import { BRIEF, fromF, inPoly, inRim, lineX, SCALE, shapes } from './mountain-shape.js';

const SNOW = '#eef3f7';
// The brief's palette (section 4).
const HI = '#F7F2EA',
  // stone from light to deep: a face's ledges are a step darker, the px over them a step lighter
  RAMP = [HI, '#E6DED2', '#C8BCAE', '#968B9E', '#73698A', '#575070'],
  FACE = { lit: 1, mid: 2, dark: 3, darker: 4 },
  SNOWS = { lit: '#FFFFFF', shade: '#CADCF2', litEdge: '#D6E4F4', shadeEdge: '#A9BEDB' },
  GRASS = { lit: '#8FD762', shade: '#62B545', edge: '#4F9A3A' },
  LAWN = ['#5aa847', '#5eae4a'], // the island's own checker grass (web/sky-island.js), by tile parity
  WATER = { fall: '#7CCAF5', light: '#D4F2FF', white: '#FFFFFF', lake: '#5FB8F0', glint: '#9FE0FF' },
  RIM = { stone: '#D9D2C4', dot: '#A89F94' },
  PINE = { dark: '#468F3A', mid: '#5FB447', trunk: '#8A5A3C' };
// How much of the island's snow each colour takes (C's second argument): the grass greys like the lawn.
const SNOWY = new Map([
  [GRASS.lit, 0.85],
  [GRASS.shade, 0.85],
  [GRASS.edge, 0.85],
  [LAWN[0], 0.85],
  [LAWN[1], 0.85],
  [PINE.dark, 0.5],
  [PINE.mid, 0.6],
]);
const colourFn = env => {
  const df = env.df == null ? 1 : env.df,
    sn = env.snow || 0;
  return (c, s = SNOWY.get(c) || 0) => night(s && sn ? mix(c, SNOW, sn * s) : c, df);
};

// ---- a buffer of colours, written out as runs ----
function buffer(x0, y0, x1, y1) {
  const w = x1 - x0,
    h = y1 - y0,
    px = new Array(w * h).fill(null);
  const at = (x, y) => (x < x0 || y < y0 || x >= x1 || y >= y1 ? -1 : (y - y0) * w + (x - x0));
  return {
    w,
    h,
    ax: -x0,
    ay: -y0,
    get: (x, y) => {
      const i = at(x, y);
      return i < 0 ? null : px[i];
    },
    set: (x, y, c) => {
      const i = at(x, y);
      if (i >= 0) px[i] = c;
    },
    // onto a new canvas, each colour through C, one fillRect per run of a colour along a row
    paint(C) {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d'),
        memo = new Map();
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; ) {
          const c = px[y * w + x];
          let e = x + 1;
          while (e < w && px[y * w + e] === c) e++;
          if (c) {
            if (!memo.has(c)) memo.set(c, C(c));
            g.fillStyle = memo.get(c);
            g.fillRect(x, y, e - x, 1);
          }
          x = e;
        }
      return { canvas: cv, ax: -x0, ay: -y0 };
    },
  };
}
// The same fixed sequence of numbers 0..1 on every machine (mulberry32).
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// ---- the falls: shared by the sprite (still, frame 0) and the moving frames ----
// Its middle runs from the cleft's top down past the cleft's foot onto the lake, 2 px wide at the top and 4 at the
// foot (x SCALE); the left column is the light water, a white fleck every 4th row in the right one (moving down a row
// a frame), and a 9 px (x SCALE) white streak on top where the snow melts. Below the cleft its sides take the outline.
const FALLS = (() => {
  const f = BRIEF.falls,
    [tx, ty] = fromF(f.top),
    [bx, by] = fromF(f.bottom),
    cleftFoot = fromF(BRIEF.cleft[2])[1],
    rows = [];
  for (let y = Math.floor(ty); y < Math.ceil(by); y++) {
    const t = (y + 0.5 - ty) / (by - ty),
      cx = tx + (bx - tx) * t,
      w = Math.round((f.w0 + (f.w1 - f.w0) * t) * SCALE),
      x0 = Math.round(cx - w / 2);
    rows.push({ y, x0, w, cx, open: y + 0.5 > cleftFoot });
  }
  return { rows, streak: Math.round(f.streak * SCALE), foot: [Math.round(bx), Math.round(by)] };
})();
function paintFalls(B, phase) {
  FALLS.rows.forEach((r, i) => {
    if (i === 0) {
      const x0 = Math.round(r.cx - FALLS.streak / 2);
      for (let x = x0; x < x0 + FALLS.streak; x++)
        if (inPoly(sh.silhouette, x + 0.5, r.y + 0.5)) B.set(x, r.y, WATER.white);
      return;
    }
    for (let x = r.x0; x < r.x0 + r.w; x++) B.set(x, r.y, x === r.x0 ? WATER.light : WATER.fall);
    if ((i - phase + 400) % 4 === 0) B.set(r.x0 + r.w - 1, r.y, WATER.white);
    if (r.open) {
      B.set(r.x0 - 1, r.y, OUTLINE);
      B.set(r.x0 + r.w, r.y, OUTLINE);
    }
  });
}
// The foam where the falls land in the lake: 6 white px either side of their foot, in two patterns.
const FOAM = [
  [
    [-4, 0],
    [3, 0],
    [-5, 1],
    [4, 1],
    [-3, 2],
    [2, 2],
  ],
  [
    [-5, 0],
    [4, 0],
    [-3, 1],
    [2, 1],
    [-4, 2],
    [3, 2],
  ],
];

// ---- the mountain ----
const sh = shapes(SCALE),
  BOX = {
    x0: Math.floor(sh.L[0]) - 2,
    x1: Math.ceil(sh.R[0]) + 2,
    y0: Math.floor(sh.peak[1]) - 2,
    y1: 1,
  };
// The grassy foot's height over the front edge at x, in px: the brief's 9 + 1.2 (sin(x / 3.1) + sin(x / 1.7 + 1)) in
// its own px, x SCALE.
const grassUp = x => {
  const b = x / SCALE;
  return (9 + 1.2 * (Math.sin(b / 3.1) + Math.sin(b / 1.7 + 1))) * SCALE;
};
function paintMountain(env, foot) {
  const B = buffer(BOX.x0, BOX.y0, BOX.x1, BOX.y1),
    face = new Map(), // rock pixels: their face's place on RAMP
    k = (x, y) => x + ',' + y,
    snowY = fromF([0, BRIEF.snowY])[1] + 40 * (env.snow || 0),
    inside = (x, y) => inPoly(sh.silhouette, x + 0.5, y + 0.5),
    kind = new Map(); // 'snow', 'grass' or 'rock'
  const parity = foot.x + foot.y;
  for (let y = BOX.y0; y < BOX.y1; y++)
    for (let x = BOX.x0; x < BOX.x1; x++) {
      if (!inside(x, y)) continue;
      const cx = x + 0.5,
        cy = y + 0.5,
        lit = cx < lineX(sh.ridge, cy),
        drip = 2 + BRIEF.drips[(((x - BOX.x0) % 28) + 28) % 28],
        up = -Math.abs(cx) / 2 - cy; // px above the front edge
      if (cy < snowY + drip) {
        const edge = cy + 1 >= snowY + drip;
        B.set(x, y, lit ? (edge ? SNOWS.litEdge : SNOWS.lit) : edge ? SNOWS.shadeEdge : SNOWS.shade);
        kind.set(k(x, y), 'snow');
      } else if (up < grassUp(cx)) {
        // the slope's grass, its top row darker; the last few rows over the lawn take the lawn's own checker colour
        // (solid at the bottom, every other px just above), so the foot runs into the island's grass
        const top = up + 1 >= grassUp(cx),
          lawnRow = up < 3 || (up < 6 && (x + y) % 2 === 0),
          tx = Math.floor((cx / 16 + cy / 8) / 2),
          ty = Math.floor((cy / 8 - cx / 16) / 2);
        B.set(
          x,
          y,
          lawnRow ? LAWN[(((tx + ty + parity) % 2) + 2) % 2] : top ? GRASS.edge : lit ? GRASS.lit : GRASS.shade,
        );
        kind.set(k(x, y), 'grass');
      } else {
        const f = lit
          ? cy >= sh.shoulderL[0][1] && cx < lineX(sh.shoulderL, cy)
            ? FACE.mid
            : FACE.lit
          : cy >= sh.shoulderR[0][1] && cx > lineX(sh.shoulderR, cy)
            ? FACE.darker
            : FACE.dark;
        B.set(x, y, RAMP[f]);
        face.set(k(x, y), f);
        kind.set(k(x, y), 'rock');
      }
    }
  // the ridge's highlight: the px right beside the main ridge on its lit side
  for (let y = Math.floor(sh.ridge[0][1]); y < 0; y++) {
    const x = Math.floor(lineX(sh.ridge, y + 0.5)) - 1;
    if (kind.get(k(x, y)) === 'rock') B.set(x, y, HI);
  }
  // rock ledges: short strokes a step darker than their face, the px over each a step lighter, from a fixed seed
  const L = BRIEF.ledges,
    rnd = seeded(1108),
    ly0 = fromF([0, L.y0])[1],
    ly1 = fromF([0, L.y1])[1];
  for (let n = 0, tries = 0; n < L.count && tries < 2000; tries++) {
    const x = Math.floor(BOX.x0 + rnd() * (BOX.x1 - BOX.x0)),
      y = Math.floor(ly0 + rnd() * (ly1 - ly0)),
      len = L.len[0] + Math.floor(rnd() * (L.len[1] - L.len[0] + 1));
    if (kind.get(k(x, y)) !== 'rock') continue;
    for (let i = 0; i < len; i++) {
      const f = face.get(k(x + i, y));
      if (f == null || kind.get(k(x + i, y)) !== 'rock') break;
      B.set(x + i, y, RAMP[f + 1]);
      if (kind.get(k(x + i, y - 1)) === 'rock') B.set(x + i, y - 1, RAMP[face.get(k(x + i, y - 1)) - 1]);
    }
    n++;
  }
  // the cleft in the lit face: darker stone, its right half deep; the outline down its left side, the highlight down
  // its right
  const [c0, c1, c2, c3] = sh.cleft;
  for (let y = Math.floor(c0[1]); y < Math.ceil(c3[1]); y++) {
    const cy = y + 0.5,
      xl = Math.round(lineX([c0, c3], cy)),
      xr = Math.round(lineX([c1, c2], cy)),
      mid = (xl + xr) / 2;
    for (let x = xl; x < xr; x++)
      B.set(x, y, x === xl ? OUTLINE : x === xr - 1 ? HI : x + 0.5 > mid ? RAMP[5] : RAMP[4]);
  }
  paintFalls(B, 0);
  // the outline round the silhouette, but not along the foot's front edges where it stands on the lawn
  for (let y = BOX.y0; y < BOX.y1; y++)
    for (let x = BOX.x0; x < BOX.x1; x++) {
      if (B.get(x, y) || !(y + 0.5 < -Math.abs(x + 0.5) / 2 - 2)) continue;
      if (N4.some(([a, b]) => inside(x + a, y + b))) B.set(x, y, OUTLINE);
    }
  return B;
}

// ---- the lake at its foot ----
function paintLake() {
  const lk = sh.lake,
    x0 = Math.floor(lk.c[0] - lk.rimRx) - 2,
    x1 = Math.ceil(lk.c[0] + lk.rimRx) + 2,
    y0 = Math.floor(lk.c[1] - lk.rimRy) - 2,
    y1 = Math.ceil(lk.c[1] + lk.rimRy) + 2,
    B = buffer(x0, y0, x1, y1),
    water = (x, y) => ((x + 0.5 - lk.c[0]) / lk.rx) ** 2 + ((y + 0.5 - lk.c[1]) / lk.ry) ** 2 <= 1,
    rim = (x, y) => inRim(lk, x + 0.5, y + 0.5);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (water(x, y)) B.set(x, y, WATER.lake);
      else if (rim(x, y)) B.set(x, y, hash(x, y, 90) < 0.2 ? RIM.dot : RIM.stone);
      else if (N4.some(([a, b]) => rim(x + a, y + b))) B.set(x, y, OUTLINE);
    }
  // the light on the water, up and to the left: a streak and a shorter one under it
  const gy = Math.round(lk.c[1] - lk.ry * 0.5);
  for (let x = Math.round(lk.c[0] - lk.rx * 0.62); x < Math.round(lk.c[0] - lk.rx * 0.18); x++)
    B.set(x, gy, WATER.glint);
  for (let x = Math.round(lk.c[0] - lk.rx * 0.5); x < Math.round(lk.c[0] - lk.rx * 0.3); x++)
    B.set(x, gy + 1, WATER.glint);
  return B;
}

// ---- the moving frames ----
function paintFallFrames(env) {
  const xs = FALLS.rows.flatMap(r => [r.x0 - 1, r.x0 + r.w + 1, Math.round(r.cx - FALLS.streak / 2) - 1]),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs) + FALLS.streak,
    y0 = FALLS.rows[0].y,
    y1 = FALLS.rows[FALLS.rows.length - 1].y + 1,
    C = colourFn(env);
  const frames = [0, 1, 2, 3].map(phase => {
    const B = buffer(x0, y0, x1, y1);
    paintFalls(B, phase);
    return B.paint(C);
  });
  const [fx, fy] = FALLS.foot,
    foam = FOAM.map(set => {
      const B = buffer(fx - 7, fy - 1, fx + 7, fy + 4);
      for (const [a, b] of set) B.set(fx + a, fy + b, WATER.white);
      return B.paint(C);
    });
  return { frames, foam };
}

// ---- pines ----
// Three tiers stacked, each a step narrower (half-widths: small 3/2/1 px, medium 4/3/2, large 5/4/3), each row dark
// with its 2 left px the lighter green, on a short trunk, ringed with the outline. (x, y): the px its trunk stands on.
const TIERS = [
  [3, 2, 1],
  [4, 3, 2],
  [5, 4, 3],
];
function drawPine(g, x, y, size, C) {
  const px = new Map(),
    trunk = size === 2 ? 3 : 2;
  for (let i = 0; i < trunk; i++) px.set('0,' + (-1 - i), PINE.trunk);
  let bottom = -trunk - 1;
  for (const h of TIERS[size]) {
    // rows from the widest (bottom) up to a 1 px tip
    for (let r = 0; r <= h; r++) {
      const half = h - r,
        yy = bottom - r;
      for (let dx = -half; dx <= half; dx++) px.set(dx + ',' + yy, dx < -half + 2 ? PINE.mid : PINE.dark);
    }
    bottom -= h - 1;
  }
  const ring = new Set();
  for (const p of px.keys()) {
    const [a, b] = p.split(',').map(Number);
    for (const [i, j] of N4) if (!px.has(a + i + ',' + (b + j))) ring.add(a + i + ',' + (b + j));
  }
  g.fillStyle = C(OUTLINE);
  for (const p of ring) {
    const [a, b] = p.split(',').map(Number);
    g.fillRect(x + a, y + b, 1, 1);
  }
  for (const [p, c] of px) {
    const [a, b] = p.split(',').map(Number);
    g.fillStyle = C(c, SNOWY.get(c) || 0);
    g.fillRect(x + a, y + b, 1, 1);
  }
}

// ---- baked once per light and snow step ----
const step = v => Math.round((v == null ? 1 : v) * 10);
const memo = new Map();
function cached(name, env, extra, make) {
  const key = name + '|' + step(env.df) + '|' + step(env.snow || 0) + '|' + extra;
  if (memo.has(key)) return memo.get(key);
  const out = make({ df: step(env.df) / 10, snow: step(env.snow || 0) / 10 });
  memo.set(key, out);
  // a few light steps at a time: dusk walks through them one by one
  if (memo.size > 12) memo.delete(memo.keys().next().value);
  return out;
}
const sprite = (env, foot = { x: 0, y: 0 }) =>
  cached('m', env, (((foot.x + foot.y) % 2) + 2) % 2, e => paintMountain(e, foot).paint(colourFn(e)));
const lake = env => cached('l', env, '', e => paintLake().paint(colourFn(e)));
const falls = env => cached('f', env, '', e => paintFallFrames(e));
// Which frame of the falls (a px down every 120 ms) and of the foam (300 ms) shows at t seconds.
const fallFrame = t => Math.floor(t / 0.12 + 1e-9) % 4;
const foamFrame = t => Math.floor(t / 0.3 + 1e-9) % 2;

export const MountainArt = { sprite, lake, falls, drawPine, fallFrame, foamFrame, colourFn };
