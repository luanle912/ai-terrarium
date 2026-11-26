// portal: a magenta gate swirls open on the person's path; they walk in and sink away, a dark figure in its flare.
// A green gate opens at the landing, a figure rises in its flare and steps out, then each gate folds away with a pop.
// The gates are upright pixel ovals baked once (spin and opening frames, a white flash, a floor pool per colour).
import { Kit } from './tp-kit.js';
import { glowSprite } from './office-draw-xmas.js';
import { Light } from './light.js';

const { ellipse, bake, atlas, clamp, r, out2, frac } = Kit;
const RX = 9,
  RY = 16,
  W = 2 * RX + 3,
  H = 2 * RY + 3,
  FRAMES = 8,
  OPEN = [
    [2, 9],
    [4, 12],
    [6, 14],
    [8, 15],
  ],
  CELLS = FRAMES + OPEN.length + 1, // spin frames, opening frames, the flash
  PW = 33, // floor pool
  PH = 9,
  OFF = [14, 7], // gate centre from the feet: one step along an iso axis, clear of the person
  MID = 15, // px from the feet up to the gate's middle
  STEP = 0.9, // tiles along the path from an end to its gate
  // per end: outline, rim shade, rim, gleam, depth, swirl, swirl light; the halo colour
  PAL = [
    ['#3b0838', '#c42aa6', '#ff5fdc', '#ffe0f8', '#4a0b45', '#a3238f', '#ff9cec'],
    ['#06341c', '#1f9e4f', '#4dff8a', '#e3ffe9', '#0b4a2a', '#1c8f4c', '#9dffc0'],
  ],
  GLOW = ['#ff4fd8', '#3dff86'],
  POOL = [
    ['rgba(255,79,216,0.55)', 'rgba(255,79,216,0.28)'],
    ['rgba(61,255,134,0.5)', 'rgba(61,255,134,0.25)'],
  ],
  // core clock per end: slit, opening frames, open, flare, closing frames, slit, pop end
  TT = [
    { a: 0, s: 0.03, o: 0.12, f0: 0.36, f1: 0.42, c: 0.42, c1: 0.47, e: 0.49, z: 0.58 },
    { a: 0.28, s: 0.31, o: 0.4, f0: 0.5, f1: 0.57, c: 0.8, c1: 0.86, e: 0.88, z: 0.98 },
  ],
  WALK = [0.26, 0.385, 0.56, 0.74], // in, then out
  GHOST = [0.385, 0.42, 0.46, 0.56], // the figure deep in a gate: sinking at the origin, rising at the landing
  MOTES = [0.86, 1.22];

// Gate pixels (W x H colour indices 1-7, bottom outline on the last row): f a spin frame, k an opening frame (-1 full
// size), end 0 swirls in, end 1 out.
export function gatePixels(f, k, end) {
  const [rx, ry] = k < 0 ? [RX, RY] : OPEN[k],
    cx = RX + 1,
    cy = H - 2 - ry,
    px = new Uint8Array(W * H),
    inE = (x, y, a, b) => (x * x) / (a * a) + (y * y) / (b * b) <= 1,
    dirn = end ? -1 : 1;
  for (let y = -ry - 1; y <= ry + 1; y++)
    for (let x = -rx - 1; x <= rx + 1; x++) {
      let c = 0;
      if (inE(x, y, rx - 1.5, ry - 1.5)) {
        const nx = x / (rx - 1.5),
          ny = y / (ry - 1.5),
          rho = Math.hypot(nx, ny),
          s = frac((dirn * 3 * Math.atan2(ny, nx)) / (2 * Math.PI) + 1.4 * rho + f / FRAMES);
        c = rho < 0.2 ? 4 : rho > 0.86 ? 5 : s < 0.2 ? 7 : s < 0.42 ? 6 : 5;
      } else if (inE(x, y, rx - 0.5, ry - 0.5)) c = 2;
      else if (inE(x, y, rx + 0.5, ry + 0.5)) c = x < -rx * 0.3 && y < -ry * 0.3 ? 4 : x > rx * 0.3 && y > 0 ? 2 : 3;
      else if (inE(x, y, rx + 1.5, ry + 1.5)) c = 1;
      if (c) px[(cy + y) * W + cx + x] = c;
    }
  return px;
}
// The light the gate throws on the floor: 1 bright core, 2 a dithered edge.
function poolPixels() {
  const px = new Uint8Array(PW * PH),
    cx = (PW - 1) / 2,
    cy = (PH - 1) / 2;
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const e = Math.hypot((x - cx) / (cx + 0.5), (y - cy) / (cy + 0.5));
      px[y * PW + x] = e < 0.55 ? 1 : e < 0.8 || (e <= 1 && (x + y) % 2 === 0) ? 2 : 0;
    }
  return px;
}
let sheet = null;
const art = () =>
  sheet ||
  (sheet = atlas(W * CELLS, 2 * H + PH, g => {
    for (const end of [0, 1]) {
      const pal = PAL[end],
        col = c => pal[c - 1];
      for (let f = 0; f < FRAMES; f++) bake(g, gatePixels(f, -1, end), W, H, f * W, col, end * H);
      OPEN.forEach((_, k) => bake(g, gatePixels(0, k, end), W, H, (FRAMES + k) * W, col, end * H));
      bake(g, gatePixels(0, -1, end), W, H, (CELLS - 1) * W, c => (c === 1 ? pal[2] : '#ffffff'), end * H);
      bake(g, poolPixels(), PW, PH, end * PW, c => POOL[end][c - 1], 2 * H);
    }
  }));

const G0 = { mode: 'off', p: 0, k: 0, open: 0, flare: 0 };
// The gate at one end on the core clock: mode off | slit | opening | open | closing | shut | pop; open 0-1.
export function gateAt(v, end, out = G0) {
  const t = TT[end];
  out.p = out.k = out.open = out.flare = 0;
  if (v < t.a || v >= t.z) out.mode = 'off';
  else if (v < t.s) (out.mode = 'slit'), (out.p = r(v, t.a, t.s)), (out.open = 0.25 * out.p);
  else if (v < t.o) {
    out.mode = 'opening';
    out.p = r(v, t.s, t.o);
    out.k = Math.min(3, Math.floor(4 * out.p));
    out.open = 0.25 + 0.75 * out.p;
  } else if (v < t.c) {
    out.mode = 'open';
    out.open = 1;
    out.flare = v >= t.f0 && v < t.f1 ? Math.sin(Math.PI * r(v, t.f0, t.f1)) : 0;
  } else if (v < t.c1) {
    out.mode = 'closing';
    out.p = r(v, t.c, t.c1);
    out.k = 3 - Math.min(3, Math.floor(4 * out.p));
    out.open = 1 - 0.75 * out.p;
  } else if (v < t.e) (out.mode = 'shut'), (out.p = r(v, t.c1, t.e)), (out.open = 0.25 * (1 - out.p));
  else (out.mode = 'pop'), (out.p = r(v, t.e, t.z));
  return out;
}
const W0 = { show: 'usual', p: 0 };
// The person on the core clock: usual (drawPerson as always), in, hidden, out; p 0-1 along the walk.
export function walkAt(v, out = W0) {
  out.p = 0;
  if (v < WALK[0] || v >= WALK[3]) out.show = 'usual';
  else if (v < WALK[1]) (out.show = 'in'), (out.p = r(v, WALK[0], WALK[1]));
  else if (v < WALK[2]) out.show = 'hidden';
  else (out.show = 'out'), (out.p = r(v, WALK[2], WALK[3]));
  return out;
}
// [px, py, side] of a gate's foot: ahead of the origin, behind the landing, along the iso axis nearest the travel.
export function gateSpot(x, y, dir, end, out = [0, 0, 0]) {
  const sx = dir[0] >= 0 ? 1 : -1,
    sy = dir[1] >= 0 ? 1 : -1,
    k = end ? -1 : 1;
  out[0] = x + k * sx * OFF[0];
  out[1] = y + k * sy * OFF[1];
  out[2] = sx;
  return out;
}
// Tile point d tiles along the polyline pts from its first point, clamped to its last.
export function walkPath(pts, d, out = [0, 0]) {
  let left = d;
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1],
      [bx, by] = pts[k],
      s = Math.hypot(bx - ax, by - ay);
    if (s > 0 && left <= s) {
      out[0] = ax + ((bx - ax) * left) / s;
      out[1] = ay + ((by - ay) * left) / s;
      return out;
    }
    left -= s;
  }
  const z = pts[pts.length - 1];
  out[0] = z[0];
  out[1] = z[1];
  return out;
}
const SP = [0, 0, 0],
  SPOTS = new WeakMap(),
  TW = [0, 0];
// Each gate stands on the person's own path, which is open floor: STEP tiles out of the origin, STEP tiles before the
// landing. Read while the whole path is there and kept per agent (a cut copies tp and re-routes), so a gate never
// jumps; side is the screen x of the travel.
function spots(X) {
  const tp = X.tp,
    path = X.a && X.a.path;
  let m = X.a && SPOTS.get(X.a);
  if (m && tp && m[0] === tp.x0 && m[1] === tp.y0 && m[2] === tp.x1 && m[3] === tp.y1) return m;
  if (!tp || tp.sw || !path || !path.length) return null;
  const i = Math.min(tp.i, path.length - 1),
    pts = [[tp.x0, tp.y0], ...path.slice(0, i + 1)];
  m = [tp.x0, tp.y0, tp.x1, tp.y1];
  for (const end of [0, 1]) {
    const [tx, ty] = walkPath(end ? pts.reverse() : pts, STEP, TW),
      [gx, gy] = Kit.feet(tx, ty),
      fx = end ? X.x1 : X.x0,
      d = end ? fx - gx : gx - fx;
    m.push(gx, gy, d ? Math.sign(d) : end ? (X.dir1[0] >= 0 ? 1 : -1) : X.dir0[0] >= 0 ? 1 : -1);
  }
  SPOTS.set(X.a, m);
  return m;
}
// [px, py, side] of a gate's foot; with no path (a re-aim after the switch) the fixed step along the travel.
function spotOf(X, end, out = SP) {
  const m = spots(X);
  if (!m) return gateSpot(end ? X.x1 : X.x0, end ? X.y1 : X.y0, end ? X.dir1 : X.dir0, end, out);
  out[0] = m[4 + 3 * end];
  out[1] = m[5 + 3 * end];
  out[2] = m[6 + 3 * end];
  return out;
}
// A batch of sparks, one fill per colour: at(k, o) sets o = [x, y] and returns false to skip spark k.
const SK = [0, 0];
function sparks(ctx, n, at, cols, alpha, sz = 1) {
  if (alpha <= 0) return;
  ctx.globalAlpha = Math.min(1, alpha);
  for (let c = 0; c < cols.length; c++) {
    ctx.beginPath();
    for (let k = c; k < n; k += cols.length)
      if (at(k, SK) !== false) ctx.rect(Math.round(SK[0]), Math.round(SK[1]), sz, sz);
    ctx.fillStyle = cols[c];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
const GH = { s: 0, a: 0 };
// The dark figure deep in an open gate: size s and alpha a, or null when there is none.
export function ghostAt(v, end, out = GH) {
  const a = GHOST[2 * end],
    b = GHOST[2 * end + 1];
  if (v < a || v >= b) return null;
  const p = end ? r(v, a, b) : 1 - r(v, a, b);
  out.s = 0.3 + 0.5 * p;
  out.a = 0.25 + 0.65 * p;
  return out;
}
const GO = { pose: 'stand', front: true, tint: '', sx: 1, sy: 1, alpha: 1, bare: true };
// Backlit by the swirl and the flare: shrinking into the origin, growing out of the landing, centred in the gate.
function ghost(X, end, gx, gy) {
  const g = ghostAt(X.L.v, end);
  if (!g) return;
  const h = Math.round(26 * g.s),
    ctx = X.ctx;
  GO.front = !!end;
  GO.tint = PAL[end][0];
  GO.sx = GO.sy = g.s;
  GO.alpha = g.a * X.L.C;
  ctx.save();
  ctx.beginPath();
  ctx.rect(gx - 6, gy - MID - 13, 13, 27);
  ctx.clip();
  try {
    X.bodyAt(gx, gy - MID + (h >> 1), GO);
  } finally {
    ctx.restore();
  }
}
const GA = { mode: 'off', p: 0, k: 0, open: 0, flare: 0 };
// Halo behind the gate; the floor pool under it.
function back(X, end) {
  const g = gateAt(X.L.v, end, GA),
    a = (g.open * (0.18 + 0.6 * Light.glow(X.df)) + 0.35 * g.flare) * X.L.C;
  if (a <= 0) return;
  const [gx, gy] = spotOf(X, end),
    ctx = X.ctx,
    sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(glowSprite(GLOW[end], 64), gx - 22, gy - MID - 28, 45, 56);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = sm;
}
function floor(X, end) {
  const g = gateAt(X.L.v, end, GA),
    a = g.open * (0.55 + 0.45 * Light.glow(X.df)) * X.L.C;
  if (a <= 0) return;
  const [gx, gy] = spotOf(X, end);
  X.ctx.globalAlpha = a;
  X.stamp(art(), end * PW, 2 * H, PW, PH, gx - (PW - 1) / 2, gy - (PH - 1) / 2, PW, PH);
  X.ctx.globalAlpha = 1;
}
// The gate itself, in front of the person (who walks into and out of it), and its sparks.
function stand(X, end) {
  const L = X.L,
    v = L.v,
    g = gateAt(v, end, GA),
    [gx, gy] = spotOf(X, end),
    ctx = X.ctx,
    cy = gy - MID,
    C = L.C,
    left = gx - RX - 1,
    top = gy + 2 - H;
  if (g.mode === 'slit' || g.mode === 'shut') {
    const h = Math.max(1, Math.round(30 * (g.mode === 'slit' ? out2(g.p) : 1 - g.p)));
    ctx.globalAlpha = 0.7 * C;
    ctx.fillStyle = PAL[end][2];
    ctx.fillRect(gx - 1, cy - (h >> 1), 3, h);
    ctx.globalAlpha = C;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(gx, cy - (h >> 1), 1, h);
  } else if (g.mode === 'opening' || g.mode === 'closing') {
    ctx.globalAlpha = C;
    X.stamp(art(), (FRAMES + g.k) * W, end * H, W, H, left, top, W, H);
  } else if (g.mode === 'open') {
    const f = Math.floor(frac(X.t * (end ? 1.3 : 1.6) + X.seed) * FRAMES) % FRAMES;
    ctx.globalAlpha = C;
    X.stamp(art(), f * W, end * H, W, H, left, top, W, H);
    if (g.flare > 0) {
      ctx.globalAlpha = 0.75 * g.flare * C;
      X.stamp(art(), (CELLS - 1) * W, end * H, W, H, left, top, W, H);
    }
    if (!X.lite && !L.q) ghost(X, end, gx, gy);
  } else if (g.mode === 'pop') {
    const p = g.p,
      d = 3 + 15 * out2(p);
    if (p < 0.35) {
      ctx.globalAlpha = (1 - p / 0.35) * C;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(gx - 5, cy, 11, 1);
      ctx.fillRect(gx, cy - 7, 1, 15);
      ctx.fillRect(gx - 1, cy - 1, 3, 3);
    }
    if (!X.lite)
      sparks(
        ctx,
        10,
        (k, o) => {
          const a = ((k + 0.3 * X.hash(k, 7)) * 2 * Math.PI) / 10;
          o[0] = gx + d * Math.cos(a);
          o[1] = cy + 1.4 * d * Math.sin(a) + 6 * p * p;
        },
        [PAL[end][2], '#ffffff'],
        (1 - p) * C,
        p < 0.45 ? 2 : 1,
      );
  }
  ctx.globalAlpha = 1;
  if (X.lite) return;
  // the origin draws sparks in; the landing spits a burst as the person comes through, then motes rise
  if (end === 0 && v >= 0.04 && v < 0.4)
    sparks(
      ctx,
      8,
      (k, o) => {
        const q = frac((v - 0.04) * 5 + X.hash(k, 3)),
          rr = 2 + 20 * (1 - q),
          a = 2 * Math.PI * X.hash(k, 5) + 3 * q;
        o[0] = gx + 0.8 * rr * Math.cos(a);
        o[1] = cy + 1.2 * rr * Math.sin(a);
        return q < 0.92;
      },
      [PAL[0][6], '#ffffff'],
      clamp((0.4 - v) / 0.05) * C,
    );
  if (end === 1 && v >= TT[1].f0 && v < 0.62) {
    const p = r(v, TT[1].f0, 0.62),
      s = SP[2];
    sparks(
      ctx,
      8,
      (k, o) => {
        const a = (X.hash(k, 9) - 0.5) * 2.2,
          d = 4 + (10 + 8 * X.hash(k, 4)) * out2(p);
        o[0] = gx + s * d * Math.cos(a);
        o[1] = cy + d * Math.sin(a) + 8 * p * p;
      },
      [PAL[1][6], '#ffffff'],
      (1 - p) * C,
      p < 0.5 ? 2 : 1,
    );
  }
  if (end === 1 && v >= MOTES[0] && v < MOTES[1])
    sparks(
      ctx,
      6,
      (k, o) => {
        const q = (v - MOTES[0] - 0.04 * k) / 0.22;
        o[0] = gx + Math.round(18 * (X.hash(k, 11) - 0.5) + 1.5 * Math.sin(8 * q + k));
        o[1] = gy - 2 - 26 * out2(q);
        return q > 0 && q < 1;
      },
      [PAL[1][6], '#ffffff'],
      clamp((MOTES[1] - v) / 0.12) * C,
    );
}
const PW0 = { show: 'usual', p: 0 },
  PG = [0, 0, 0];
// One body pass on the walk between the feet and a gate's middle, clipped at the gate's plane.
function person(X) {
  const L = X.L;
  if (L.q || L.calm) return false;
  if (L.hide && !L.sw) return true;
  const w = walkAt(L.v, PW0);
  if (w.show === 'usual') return false;
  if (w.show === 'hidden') return true;
  const out = w.show === 'out';
  if (out !== L.sw) return true;
  const [gx, gy, s] = spotOf(X, out ? 1 : 0, PG),
    fx = out ? X.x1 : X.x0,
    fy = out ? X.y1 : X.y0,
    p = out ? w.p : 1 - w.p,
    px = Math.round(gx + (fx - gx) * p),
    py = Math.round(gy + (fy - gy) * p),
    keep = out ? s : -s, // the side of the gate's plane the person shows on
    ctx = X.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(keep > 0 ? gx + 1 : gx - 60, gy - 70, 59, 90);
  ctx.clip();
  try {
    const front = (out ? gy < fy : fy < gy) || fy === gy,
      // the gate's colour washes over the person near its plane
      wash = 0.7 * clamp(1.6 * (1 - p) - 0.2) * L.C;
    Kit.shadow(ctx, px, py, 11, 1);
    X.bodyAt(px, py, { pose: 'walk', front });
    if (!X.lite && wash > 0.02) X.bodyAt(px, py, { pose: 'walk', front, tint: PAL[out ? 1 : 0][6], alpha: wash });
  } finally {
    ctx.restore();
  }
  return true;
}

export const CELL = { W, H };
export { FRAMES, OFF };
export const STYLE = {
  need(X) {
    const L = X.L;
    if (L.q) return 0;
    const l = gateAt(L.v, 1, GA).mode !== 'off' || (L.v >= MOTES[0] && L.v < MOTES[1]);
    return (gateAt(L.v, 0, GA).mode !== 'off' ? 21 : 0) | (l ? 42 : 0);
  },
  back,
  floor,
  stand,
  person,
  marks: [],
  gap: null,
};
