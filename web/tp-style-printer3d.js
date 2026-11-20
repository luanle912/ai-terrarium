// printer3d: a build plate and a printer frame rise round the person; the gantry runs down with a scan beam and wipes
// them away from the head down, the voxels floating off. At the landing the same printer prints them back from the
// feet up, a percent counter climbing, then folds away before they walk off. The machine is baked once (day and
// night rows) into one small atlas; the person is one clipped body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { glowAt, glowSprite } from './office-draw-xmas.js';
import { shirtOf } from './office-people-xmas.js';

const { atlas, bake, r, out2, in2, lerp, frac } = Kit;
const { T } = TeleportLogic;
export const ALL = 99; // rows: the whole body
const POST = 34, // px: post height
  PRINT0 = 0.555, // core: the print runs from here
  PRINT1 = 0.8,
  STAND = 21, // rows of a standing body above the feet (hair included)
  N = 66, // voxels over the whole body
  LIFE = 16; // px the beam passes before a voxel is gone
// colour indices of the atlas: plate 1-7, posts 8-12, bar 13-14, head 15-22
const PAL = [null, '#323a4f', '#46516d', '#c3cee0', '#8d9bb8', '#252b3a', '#191e2a', '#5ef2ff', '#2a3042'];
PAL.push('#59627a', '#eef2f8', '#aab4c8', '#636d83', '#dfe5ef', '#5c6579', '#343c51', '#4c5670', '#8a93a8');
PAL.push('#5fd27a', '#1d2230', '#c9a227', '#e8c35a', '#9a7414');
const LIT = new Set([7, 18, 21]); // lights that keep their colour at night
// At night the metal goes 45% of the way to the island's night blue, as the scene's own night tint does.
const dim = hex => {
  const n = parseInt(hex.slice(1), 16),
    m = (s, t) => Math.round(((n >> s) & 255) * 0.55 + t * 0.45);
  return `rgb(${m(16, 13)},${m(8, 19)},${m(0, 34)})`;
};
const NIGHT = PAL.map((c, k) => (c && !LIT.has(k) ? dim(c) : c));
const HEAD = ['.ppppppp.', 'pbbbbbbbb', 'pbfffbbbb', 'pbfbfbbgb', 'pbfffbbbb', '.uuuuuuu.', '..sssss..', '...SSS...'];
HEAD.push('....n....');
const KEY = { p: 16, b: 15, f: 17, g: 18, u: 19, s: 20, S: 21, n: 22 };
// The silhouette's left edge and width of a standing body's row at a height above the feet (office-draw-people.js).
const rowL = h => (h <= 4 ? -3 : h === 5 ? -4 : h <= 11 ? -5 : h === 12 ? -1 : -3);
const rowW = h => (h <= 4 ? 6 : h === 5 ? 8 : h <= 11 ? 10 : h === 12 ? 2 : 6);
const COLS = ['', '', '', '#3b4252', '#9ff8ff'];

// The plate: a 33 x 17 diamond with a grid, lit back edges, and its front faces with a row of lights.
function platePixels() {
  const w = 33,
    px = new Uint8Array(w * 20);
  for (let y = 0; y <= 16; y++) {
    const dy = y - 8,
      hw = 16 - 2 * Math.abs(dy);
    for (let x = 16 - hw; x <= 16 + hw; x++) {
      const dx = x - 16;
      if (Math.abs(dx) >= hw - 1) px[y * w + x] = dy < 0 ? 3 : 4;
      else px[y * w + x] = (dx + 2 * dy) % 8 === 0 || (dx - 2 * dy) % 8 === 0 ? 2 : 1;
    }
  }
  for (let x = 0; x < w; x++) {
    const yb = 8 + Math.floor((16 - Math.abs(x - 16)) / 2);
    for (let k = 1; k <= 3; k++) px[(yb + k) * w + x] = k === 2 && x % 4 === 2 ? 7 : x < 16 ? 5 : 6;
  }
  return px;
}
let art = null;
// Atlas, day row at y 0 and night row at y POST: plate at 0 (33 x 20), post at 33 (5 x 34), bar at 38 (29 x 2),
// head at 38, 3 (9 x 9).
const sheet = () =>
  art ||
  (art = atlas(67, 2 * POST, g => {
    const plate = platePixels(),
      post = new Uint8Array(5 * POST),
      bar = new Uint8Array(58).map((_, k) => (k % 29 === 0 || k % 29 === 28 ? 8 : k < 29 ? 13 : 14)),
      head = Uint8Array.from(HEAD.join(''), ch => KEY[ch] || 0);
    for (let y = 0; y < POST; y++)
      for (let x = 0; x < 5; x++)
        post[y * 5 + x] = y === 0 ? 9 : y < 3 ? (x === 2 && y === 1 ? 7 : 8) : [0, 10, 11, 12, 0][x];
    for (const [pal, oy] of [
      [PAL, 0],
      [NIGHT, POST],
    ]) {
      const col = c => pal[c];
      bake(g, plate, 33, 20, 0, col, oy);
      bake(g, post, 5, POST, 33, col, oy);
      bake(g, bar, 29, 2, 38, col, oy);
      bake(g, head, 9, 9, 38, col, oy + 3);
    }
  }));
const rowOf = X => (X.night ? POST : 0);

// Pure: what shows at core clock v; top = rows of the body above the feet at the origin (a stool's lift included),
// tall = rows printed at the landing. rows0 / rows1: body rows left at the origin / printed at the landing (ALL whole,
// 0 none); cut: the origin beam's height in px (under 0 once past the floor), bar0 its gantry's alpha; tip: the
// landing nozzle's height (-1 none), nx its offset and bar the gantry's alpha; pct and label the counter.
export function beats(v, top, tall = STAND, out = {}) {
  out.plate0 = r(v, -0.02, 0.05) * (1 - r(v, 0.44, 0.56));
  out.post0 = Math.round(POST * out2(r(v, 0, 0.1)) * (1 - in2(r(v, 0.38, 0.47))));
  out.cut = lerp(top + 3, -10, r(v, 0.1, 0.4));
  out.beam = r(v, 0.08, 0.11) * r(out.cut, -6, 0);
  out.bar0 = r(v, 0.04, 0.09) * r(out.cut, -6, 0);
  out.rows0 = v < 0.1 ? ALL : Math.max(0, Math.min(top, Math.floor(out.cut)));
  out.plate1 = r(v, T.L_IN, 0.34) * (1 - r(v, 1.0, 1.3));
  // the printer folds away before release, so the person never walks through a post
  out.post1 = Math.round(POST * out2(r(v, 0.31, 0.43)) * (1 - in2(r(v, 0.86, T.RELEASE))));
  const p = r(v, PRINT0, PRINT1);
  out.rows1 = v < PRINT0 ? 0 : v >= PRINT1 ? ALL : Math.floor(tall * p);
  out.pct = Math.round(100 * p);
  out.bar = v < 0.41 ? 0 : r(v, 0.41, 0.45) * (1 - r(v, 0.83, 0.86));
  const park = POST - 6;
  out.tip =
    out.bar <= 0
      ? -1
      : v < PRINT0
        ? Math.round(lerp(park, 1, out2(r(v, 0.42, 0.52))))
        : v < PRINT1
          ? out.rows1 + 1
          : Math.round(lerp(tall + 1, park, out2(r(v, PRINT1, 0.84))));
  // one sweep across the body every two rows
  out.nx = v >= PRINT0 && v < PRINT1 ? Math.round(5 * (1 - 4 * Math.abs(frac((tall * p) / 2) - 0.5))) : 0;
  out.ghost = v >= 0.46 && v < PRINT1 ? r(v, 0.46, 0.52) : 0;
  out.label = r(v, 0.46, 0.5) * (1 - r(v, 0.86, 0.94));
  out.spark = v >= PRINT1 && v < 0.9 ? r(v, PRINT1, 0.9) : -1;
  return out;
}
const B = {};
const liftOf = tp => (tp.stool === 2 ? 9 : tp.stool ? 4 : 0);
// a party hat adds 5 rows over the hair (office-draw-people.js)
const tallOf = a => STAND + (a && a.outfit ? 5 : 0);
const poseOf = tp => (tp.stool === 2 ? 'sitHigh' : tp.stool ? 'sit' : 'stand');
const topOf = X => tallOf(X.a) + liftOf(X.tp);
function alphaOf(ctx, a) {
  ctx.globalAlpha = a > 1 ? 1 : a;
}
function plate(X, end) {
  const b = beats(X.L.v, STAND, STAND, B),
    a = (end ? b.plate1 : b.plate0) * X.L.C;
  if (a <= 0) return;
  alphaOf(X.ctx, a);
  X.stamp(sheet(), 0, rowOf(X), 33, 20, (end ? X.x1 : X.x0) - 16, (end ? X.y1 : X.y0) - 8, 33, 20);
  X.ctx.globalAlpha = 1;
}
function posts(X, end) {
  const b = beats(X.L.v, STAND, STAND, B),
    h = Math.min(POST, end ? b.post1 : b.post0),
    x = end ? X.x1 : X.x0,
    y = end ? X.y1 : X.y0,
    oy = rowOf(X);
  if (h <= 0) return;
  alphaOf(X.ctx, X.L.C);
  X.stamp(sheet(), 33, oy, 5, h, x - 18, y - h + 1, 5, h);
  X.stamp(sheet(), 33, oy, 5, h, x + 14, y - h + 1, 5, h);
  X.ctx.globalAlpha = 1;
}
// A soft light at night only: smoothing on for the 64 px sprite, as the circle does.
function glow(X, colour, x, y, w, h, a) {
  const g = a * glowAt(X.df);
  if (g <= 0 || X.lite) return;
  const ctx = X.ctx,
    sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  alphaOf(ctx, g);
  ctx.drawImage(glowSprite(colour, 64), x - (w >> 1), y - (h >> 1), w, h);
  ctx.imageSmoothingEnabled = sm;
  ctx.globalAlpha = 1;
}
// The origin's gantry riding down with the scan beam just under it, in front of the person.
function scanner(X) {
  const b = beats(X.L.v, topOf(X), STAND, B),
    ctx = X.ctx,
    x = X.x0,
    by = X.y0 - Math.max(0, Math.round(b.cut)),
    C = X.L.C;
  if (b.bar0 > 0) {
    alphaOf(ctx, b.bar0 * C);
    X.stamp(sheet(), 38, rowOf(X), 29, 2, x - 14, by - 3, 29, 2);
  }
  if (b.beam > 0) {
    alphaOf(ctx, 0.35 * b.beam * C);
    ctx.fillStyle = '#5ef2ff';
    ctx.fillRect(x - 13, by - 1, 27, 3);
    alphaOf(ctx, b.beam * C);
    ctx.fillStyle = '#effeff';
    ctx.fillRect(x - 13, by, 27, 1);
    glow(X, '#5ef2ff', x, by, 40, 10, 0.7 * b.beam * C);
  }
  ctx.globalAlpha = 1;
}
// The landing's gantry, print head, counter and the finishing sparkle, in front of the person.
function printer(X) {
  const b = beats(X.L.v, STAND, tallOf(X.a), B),
    ctx = X.ctx,
    x = X.x1,
    y = X.y1,
    C = X.L.C,
    oy = rowOf(X);
  if (b.tip >= 0) {
    const ty = y - b.tip,
      hx = x + b.nx,
      hot = X.L.v >= 0.5 && X.L.v < PRINT1;
    alphaOf(ctx, b.bar * C);
    X.stamp(sheet(), 38, oy, 29, 2, x - 14, ty - 6, 29, 2);
    X.stamp(sheet(), 38, oy + 3, 9, 9, hx - 4, ty - 8, 9, 9);
    if (hot) {
      ctx.fillStyle = Math.floor(X.L.v * 60) % 2 ? '#ffb347' : '#fff1c4';
      ctx.fillRect(hx, ty + 1, 1, 1);
    }
    ctx.globalAlpha = 1;
    if (hot) glow(X, '#ff9a3d', hx, ty + 1, 11, 9, 0.6 * b.bar * C);
  }
  if (b.label > 0) {
    const str = b.pct + '%',
      w = Kit.glyphs(str).w,
      ty = y - POST - 3,
      done = X.L.v >= PRINT1;
    alphaOf(ctx, 0.8 * b.label * C);
    ctx.fillStyle = '#141824';
    ctx.fillRect(x - (w >> 1) - 2, ty - 7, w + 4, 9);
    alphaOf(ctx, b.label * C);
    X.text(str, x, ty, done ? '#7dff9a' : '#7ff3ff', 1);
    ctx.globalAlpha = 1;
  }
  if (b.spark >= 0 && !X.lite) {
    const s = b.spark < 0.5 ? 2 : 1;
    alphaOf(ctx, (1 - b.spark) * C);
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const sx = x + [-8, 7, -10, 9][k],
        sy = y - [17, 20, 8, 10][k] - Math.round(4 * b.spark);
      ctx.rect(sx - s, sy, 2 * s + 1, 1);
      ctx.rect(sx, sy - s, 1, 2 * s + 1);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
// The origin: the body below the beam and the voxels floating off above it, in the body's own colours.
function scan(X, b, top, lift) {
  const ctx = X.ctx,
    x = X.x0,
    y = X.y0,
    a = X.a,
    cols = COLS;
  cols[0] = a.hair || a.skin;
  cols[1] = a.skin;
  cols[2] = shirtOf(a);
  if (b.rows0 > 0) X.body({ pose: poseOf(X.tp), clip: [b.rows0 === ALL ? 40 : b.rows0, -3] });
  for (let c = 0; c < cols.length; c++) {
    let any = false;
    for (let j = 0; j < N; j++) {
      const h = 1 + Math.floor(((j + 0.9 * X.hash(j, 1)) / N) * top),
        age = h - b.cut,
        rel = h - lift;
      if (age < 0 || age >= LIFE || X.hash(j, 2) < age / (LIFE + 3)) continue;
      if ((j % 6 === 5 ? 4 : rel >= 17 ? 0 : rel >= 13 ? 1 : rel >= 5 ? 2 : 3) !== c) continue;
      const hr = Math.max(1, rel),
        // they break off in place, then drift up and fan out
        vx = x + rowL(hr) + Math.floor(X.hash(j, 3) * rowW(hr)) + Math.round((X.hash(j, 4) - 0.5) * 1.4 * age),
        vy = y - h - Math.round(0.5 * age + 0.05 * age * age),
        s = age < 4 && X.hash(j, 5) > 0.55 ? 2 : 1;
      if (!any) ctx.beginPath();
      any = true;
      ctx.rect(vx, vy, s, s);
    }
    if (any) {
      alphaOf(ctx, X.L.C);
      ctx.fillStyle = cols[c];
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
// The landing: the hologram of what is still to print, the printed rows, the fresh row still hot.
function print(X, b) {
  const x = X.x1,
    y = X.y1,
    ctx = X.ctx,
    n = b.rows1;
  if (n > 0) X.body({ pose: 'stand', clip: [n, -3] });
  if (b.ghost > 0 && !(X.lite && n > 0))
    X.body({ pose: 'stand', clip: [40, n], tint: '#8be9ff', alpha: 0.3 * b.ghost * X.L.C });
  if (n > 0) {
    alphaOf(ctx, 0.85 * X.L.C);
    ctx.fillStyle = '#ff9a3d';
    ctx.fillRect(x + rowL(n), y - n, rowW(n), 1);
    ctx.globalAlpha = 1;
  }
}

export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q) return 0;
    return (
      (v < 0.56 ? 4 : 0) |
      (v < 0.47 ? 1 : 0) |
      (v >= 0.04 && v < 0.4 ? 16 : 0) |
      (v >= T.L_IN ? 8 : 0) |
      (v >= 0.31 && v < T.RELEASE ? 2 : 0) |
      (v >= 0.41 && v < 0.94 ? 32 : 0)
    );
  },
  floor: plate,
  back: posts,
  stand(X, end) {
    if (end) printer(X);
    else scanner(X);
  },
  // false = drawn as usual (before the beam reaches them, and once printed)
  person(X) {
    const L = X.L,
      v = L.v,
      tp = X.tp;
    if (L.q || v < 0.08) return false;
    if (!L.sw) {
      if (tp.hide) return true;
      const top = topOf(X);
      scan(X, beats(v, top, STAND, B), top, liftOf(tp));
      return true;
    }
    if (v >= PRINT1) return false;
    print(X, beats(v, STAND, tallOf(X.a), B));
    return true;
  },
  marks: [],
};
