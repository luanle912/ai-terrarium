// packet: a floor port opens under the person, they glitch and break into green bits from the head down that pour into
// it; data packets race along a cable under the floor (lit behind them, 0s and 1s popping off) and on under the landing
// desk; its monitor lights up with a download bar (the desk item, so from either side of the desk) and the person is
// downloaded back out of it, top row first.
// The body is one captured pass drawn as 2 px cells; the cable lies flat on the floor (an end's floor item), so the
// furniture and the lounge rug cover it as they would a cable under the floor.
import { Kit } from './tp-kit.js';
import { TpPerson } from './tp-person.js';
import { DESKS, P, PA } from './office-scene.js';

const { atlas, bake, clamp, r, out2, in2, lerp } = Kit;
const DEP = 0.42,
  ARR = 0.54,
  REL = 0.92,
  G0 = 0.03, // core: the glitch starts (drawn as usual before)
  D0 = 0.09, // core: the dissolve front leaves the head
  D1 = 0.28, // and reaches the feet
  JIT = 0.02, // core: a cell's ragged lag behind the front
  FALL = 0.11, // core: a bit's fall into the port
  A0 = 0.14, // arrival fraction: the download front leaves the head
  A1 = 0.72, // and reaches the feet
  AJ = 0.04,
  FLY = 0.14, // arrival fraction: a bit's flight from the monitor
  DONE = 0.8, // arrival fraction: the whole body is back
  TRAIN = [0, 0.7, 1.4], // tiles between the packets
  TAIL = 2.4, // tiles of lit cable behind the head
  GLY = 0.35, // s a 0 or 1 floats over the cable
  G1 = 0.15, // tiles along the cable to the first one
  BIT = ['#50fa7b', '#b8ffcc', '#1fa152'],
  DARK = '#0b3d22',
  SCAN = '#d8ffe4',
  WHITE = '#ffffff',
  PW = 21, // port sprite
  PH = 12,
  GW = 30, // floor glow sprite
  GH = 14;
// Port plate: 1 rim, 2 plate, 3 lit edge, 4 side, 5 slot, 6 slot glow, 7 hole, 8 hole core; day and night.
const PORT = [
  [null, '#4a505c', '#a3aab5', '#d3d8de', '#5d6470', '#141a20', '#50fa7b', '#06331a', '#9dffbf'],
  [null, '#262a33', '#5a6170', '#7f8796', '#30353f', '#07090c', '#50fa7b', '#06331a', '#9dffbf'],
];
const GLOW = [null, 'rgba(80,250,123,0.14)', 'rgba(80,250,123,0.26)', 'rgba(150,255,190,0.4)'];

// The port: an iso plate, closed (a lid in the slot) or open (a glowing hole), PW x PH, centre (10, 5).
export function portPixels(open) {
  const px = new Uint8Array(PW * PH),
    rh = (x, y, a) => Math.abs(x) / a + Math.abs(y) / (a / 2);
  for (let y = -5; y < PH - 5; y++)
    for (let x = -10; x <= 10; x++) {
      const i = (y + 5) * PW + x + 10,
        e = rh(x, y, 9.5),
        s = rh(x, y, 5.2);
      if (e > 1) {
        if (y > 0 && rh(x, y - 1, 9.5) <= 1) px[i] = 4;
        continue;
      }
      px[i] = e > 0.8 ? (y < 0 || (y === 0 && x < 0) ? 3 : 1) : 2;
      if (s <= 1) px[i] = open ? (s > 0.72 ? 6 : s < 0.38 ? 8 : 7) : s > 0.7 ? 5 : 2;
    }
  return px;
}
export function glowPixels() {
  const px = new Uint8Array(GW * GH),
    rx = GW / 2 - 0.5,
    ry = GH / 2 - 0.5;
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const e = ((x - rx) / (rx + 0.5)) ** 2 + ((y - ry) / (ry + 0.5)) ** 2,
        d = (x + y) & 1;
      px[y * GW + x] = e < 0.18 + 0.06 * d ? 3 : e < 0.48 + 0.08 * d ? 2 : e < 1 - 0.14 * d ? 1 : 0;
    }
  return px;
}
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = atlas(4 * PW, PH + GH, g => {
    for (let n = 0; n < 2; n++)
      for (let o = 0; o < 2; o++) bake(g, portPixels(o), PW, PH, (2 * n + o) * PW, c => PORT[n][c]);
    bake(g, glowPixels(), GW, GH, 0, c => GLOW[c], PH);
  }));
function port(X, px, py, open, a) {
  if (a <= 0.01) return;
  const n = X.night ? 2 : 0,
    ctx = X.ctx;
  ctx.globalAlpha = a * (1 - open);
  if (open < 1) X.stamp(sheetOf(), n * PW, 0, PW, PH, px - 10, py - 5, PW, PH);
  ctx.globalAlpha = a * open;
  if (open > 0) X.stamp(sheetOf(), (n + 1) * PW, 0, PW, PH, px - 10, py - 5, PW, PH);
  ctx.globalAlpha = 1;
}
function glow(X, px, py, a) {
  if (a <= 0.01) return;
  X.ctx.globalAlpha = Math.min(1, a);
  X.stamp(sheetOf(), 0, PH, GW, GH, px - GW / 2, py - GH / 2, GW, GH);
  X.ctx.globalAlpha = 1;
}

// Pixels queued as rects with a colour, then one fill per colour.
const NB = 640,
  B = { n: 0, x: new Int16Array(NB), y: new Int16Array(NB), w: new Int16Array(NB), h: new Int16Array(NB) };
const BC = new Uint8Array(NB),
  BCOL = [];
function add(x, y, w, h, col) {
  if (B.n >= NB || w <= 0 || h <= 0) return;
  let ci = BCOL.indexOf(col);
  if (ci < 0) ci = BCOL.push(col) - 1;
  const k = B.n++;
  B.x[k] = Math.round(x);
  B.y[k] = Math.round(y);
  B.w[k] = w;
  B.h[k] = h;
  BC[k] = ci;
}
function flush(ctx, alpha) {
  if (B.n && alpha > 0.01) {
    ctx.globalAlpha = Math.min(1, alpha);
    for (let c = 0; c < BCOL.length; c++) {
      ctx.beginPath();
      for (let k = 0; k < B.n; k++) if (BC[k] === c) ctx.rect(B.x[k], B.y[k], B.w[k], B.h[k]);
      ctx.fillStyle = BCOL[c];
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  B.n = 0;
  BCOL.length = 0;
}
// A 0 or 1 in the 3x5 font with a dark drop shadow (so it reads on a light floor).
function glyph(ch, x, y, col) {
  const g = Kit.glyphs(ch);
  for (let k = 0; k < g.length; k += 3) {
    add(x + g[k] + 1, y + g[k + 1] + 1, 1, g[k + 2], DARK);
    add(x + g[k], y + g[k + 1], 1, g[k + 2], col);
  }
}

// The cable: the seen route, then on to the floor under the landing desk's monitor. Screen points and tile lengths,
// cached per route array (a re-aim makes a new one).
const CABLES = new WeakMap();
const deskOf = X => (X.tp && X.a ? DESKS[X.tp.desk == null ? X.a.desk : X.tp.desk] || null : null);
function cable(X) {
  const tp = X.tp,
    pts = tp && tp.route;
  if (!pts || pts.length - X.start < 1) return null;
  const dk = deskOf(X);
  let c = CABLES.get(pts);
  if (c && c.start === X.start && c.dk === dk) return c;
  const m = pts.length - X.start,
    n = m + (dk ? 1 : 0);
  c = { start: X.start, dk, n, m, sx: [], sy: [], tx: [], ty: [], cum: [0], len: 0, total: 0 };
  for (let k = 0; k < n; k++) {
    const tx = k < m ? pts[X.start + k][0] : dk.gx + 1,
      ty = k < m ? pts[X.start + k][1] : dk.gy + 0.22,
      s = PA(tx, ty);
    c.tx.push(tx);
    c.ty.push(ty);
    c.sx.push(s[0]);
    c.sy.push(s[1]);
    if (!k) continue;
    c.cum.push(c.cum[k - 1] + Math.hypot(tx - c.tx[k - 1], ty - c.ty[k - 1]));
  }
  c.len = c.cum[m - 1];
  c.total = c.cum[n - 1];
  CABLES.set(pts, c);
  return c;
}
// [px, py, tx, ty, segment] at tile distance d along the cable.
function pointAt(c, d, out) {
  let k = 1;
  while (k < c.n - 1 && c.cum[k] < d) k++;
  const k0 = Math.max(0, k - 1),
    k1 = Math.min(c.n - 1, k),
    s = c.cum[k1] - c.cum[k0],
    q = s > 1e-9 ? clamp((d - c.cum[k0]) / s) : 1;
  out[0] = lerp(c.sx[k0], c.sx[k1], q);
  out[1] = lerp(c.sy[k0], c.sy[k1], q);
  out[2] = lerp(c.tx[k0], c.tx[k1], q);
  out[3] = lerp(c.ty[k0], c.ty[k1], q);
  out[4] = k1;
  return out;
}
// Tiles from the cable's start to the lead packet: out of the port at the trip's start, in the desk at its end; on
// at the same speed into the arrival. -1 before the trip.
function headAt(X, c) {
  const L = X.L;
  if (L.trip >= 0) return c.total * L.trip;
  if (L.v < ARR) return -1;
  return c.total * (1 + (L.secs - L.d[0] - L.d[1]) / Math.max(0.1, L.d[1]));
}
// The cable from a to b as 1 px Bresenham steps (one queued rect each).
function pixels(c, a, b, col) {
  for (let k = 1; k < c.n; k++) {
    const s0 = Math.max(a, c.cum[k - 1]),
      s1 = Math.min(b, c.cum[k]);
    if (s1 <= s0) continue;
    const L = c.cum[k] - c.cum[k - 1],
      q0 = (s0 - c.cum[k - 1]) / L,
      q1 = (s1 - c.cum[k - 1]) / L;
    Kit.line(
      Math.round(lerp(c.sx[k - 1], c.sx[k], q0)),
      Math.round(lerp(c.sy[k - 1], c.sy[k], q0)),
      Math.round(lerp(c.sx[k - 1], c.sx[k], q1)),
      Math.round(lerp(c.sy[k - 1], c.sy[k], q1)),
      (x, y) => add(x, y, 1, 1, col),
    );
  }
}
// The cable already passed as a polyline (a faint wide glow and a dashed core), one stroke each.
function polyline(ctx, c, b) {
  ctx.beginPath();
  ctx.moveTo(c.sx[0], c.sy[0]);
  for (let k = 1; k < c.n && c.cum[k - 1] < b; k++) {
    const q = clamp((b - c.cum[k - 1]) / (c.cum[k] - c.cum[k - 1]));
    ctx.lineTo(lerp(c.sx[k - 1], c.sx[k], q), lerp(c.sy[k - 1], c.sy[k], q));
  }
}
const Q = [0, 0, 0, 0, 0];
function cableFx(X) {
  const c = cable(X);
  if (!c) return;
  const L = X.L,
    head = headAt(X, c);
  if (head < 0) return;
  const q = L.trip >= 0 ? 0 : r(L.v, ARR, REL),
    a = L.C * (1 - r(q, 0.08, 0.5)) * (L.hide && L.trip >= 0 ? 0.3 + 0.7 * r(L.trip, 0, 0.08) : 1),
    ctx = X.ctx,
    to = Math.min(head, c.total);
  if (a <= 0.01) return;
  // the passed cable
  if (!X.lite) {
    polyline(ctx, c, to);
    ctx.globalAlpha = a * (X.night ? 0.3 : 0.2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = BIT[0];
    ctx.stroke();
  }
  polyline(ctx, c, to);
  ctx.globalAlpha = a * (X.night ? 0.85 : 0.7);
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = X.night ? BIT[2] : DARK;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  // the lit tail and the packets
  if (head - TAIL < c.total) {
    pixels(c, Math.max(0, head - TAIL), Math.min(c.total, head - TAIL / 3), BIT[2]);
    pixels(c, Math.max(0, head - TAIL / 3), to, BIT[0]);
    flush(ctx, a);
  }
  let lead = -1;
  for (let j = 0; j < (X.lite ? 1 : TRAIN.length); j++) {
    const d = head - TRAIN[j];
    if (d < 0 || d > c.total) continue;
    pointAt(c, d, Q);
    if (lead < 0) lead = d;
    packet(Math.round(Q[0]), Math.round(Q[1]), j);
  }
  if (lead >= 0 && (X.night || !X.lite)) {
    pointAt(c, lead, Q);
    glow(X, Q[0], Q[1], a * (X.night ? 0.95 : 0.55));
  }
  flush(ctx, a);
}
// One packet: a dark-edged green chip with a lit top, smaller down the train.
function packet(x, y, j) {
  if (j) {
    add(x - 2, y - 1, 5, 3, DARK);
    add(x - 1, y - 1, 3, 2, BIT[0]);
    return;
  }
  add(x - 3, y - 1, 7, 3, DARK);
  add(x - 2, y - 2, 5, 5, DARK);
  add(x - 2, y - 1, 5, 3, BIT[0]);
  add(x - 1, y - 1, 3, 1, WHITE);
}
// 0s and 1s popping off the cable where the lead passed, rising and blinking out.
function cableGlyphs(X) {
  const c = cable(X),
    L = X.L;
  if (!c || (L.trip < 0 && L.v < ARR)) return;
  const T1 = Math.max(0.1, L.d[1]),
    tau = L.secs - L.d[0],
    sp = X.lite ? 2.2 : 1.1,
    first = Math.max(0, Math.floor(((c.total * (tau - GLY)) / T1 - G1) / sp));
  for (let j = first; ; j++) {
    const d = G1 + j * sp,
      age = (tau - (d / c.total) * T1) / GLY;
    if (d > c.len || age < 0) break;
    if (age >= 1 || (age > 0.65 && Math.floor(age * 14) % 2)) continue;
    pointAt(c, d, Q);
    const x = Q[0] + Math.round((X.hash(j, 21) - 0.5) * 10) - 1;
    glyph(X.hash(j, 22) < 0.5 ? '0' : '1', x, Math.round(Q[1] - 9 - 9 * out2(age)), j % 3 ? BIT[0] : BIT[1]);
  }
  flush(X.ctx, X.L.C);
}
// Which end's floor item carries the cable: one on the plain floor (not the rug, not the plinth's lawn); -1: none,
// and trip() draws all of it.
function trailEnd(X) {
  const plain = (x, y) => !Kit.plinth(x, y) && !Kit.onRug(x, y);
  if (plain(X.tx1, X.ty1)) return 1;
  return !X.L.hide && plain(X.tx0, X.ty0) ? 0 : -1;
}

// The body is drawn from one capture as 2 px cells: whole rects where untouched, cells near the moving front, bits
// where a cell has gone.
let CAP = null;
const BOX = [0, 0, 0, 0];
function bounds(c) {
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (let k = 0; k < c.n; k++) {
    x0 = Math.min(x0, c.x[k]);
    y0 = Math.min(y0, c.y[k]);
    x1 = Math.max(x1, c.x[k] + c.w[k]);
    y1 = Math.max(y1, c.y[k] + c.h[k]);
  }
  BOX[0] = x0;
  BOX[1] = y0;
  BOX[2] = x1;
  BOX[3] = y1;
  return BOX;
}
// A rect of the body, whole or in 2 px bands nudged sideways and some tinted green while glitching.
function solid(X, x, y, w, h, col, g, fk) {
  if (h <= 0) return;
  if (g <= 0) return add(x, y, w, h, col);
  for (let yb = y; yb < y + h; yb += 2) {
    const band = yb >> 1,
      hh = X.hash(band, fk),
      s = hh < 0.3 * g ? (hh < 0.1 * g ? 2 : 1) * (band & 1 ? 1 : -1) : 0;
    add(x + s, yb, w, Math.min(2, y + h - yb), X.hash(band, fk + 40) < 0.12 * g ? BIT[0] : col);
  }
}
// The page's own shadow under a body drawn from cells (the remapped pass has none).
function shadowAt(X, px, py, a) {
  if (a <= 0.01) return;
  const ctx = X.ctx;
  ctx.globalAlpha = a;
  ctx.fillStyle = (X.G.th && X.G.th.shadow) || 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(px, py, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
const flickOf = v => Math.floor(v * 24);

// Departure: the glitch, then the dissolve from the head down, every cell a bit sucked into the port at the feet.
function depart(X) {
  const L = X.L,
    v = L.v,
    tp = X.tp,
    pose = tp.stool ? (tp.stool === 2 ? 'sitHigh' : 'sit') : 'stand',
    c = X.capture({ pose, front: X.a.dirFront }, CAP || (CAP = TpPerson.newCapture())),
    f = PA(X.a.x, X.a.y),
    fx = Math.round(f[0]),
    fy = Math.round(f[1]),
    [bx0, top, bx1] = bounds(c),
    H = Math.max(8, fy - top),
    span = D1 - D0,
    front = top + (H * (v - D0)) / span,
    g = r(v, G0, 0.07) * (1 - 0.65 * r(v, 0.14, 0.2)),
    fk = flickOf(v);
  shadowAt(X, fx, fy, 1 - r(v, D1 - 0.06, D1 + 0.04));
  for (let k = 0; k < c.n; k++) {
    const x = c.x[k],
      y = c.y[k],
      w = c.w[k],
      h = c.h[k],
      col = c.cols[c.c[k]];
    let cy = y;
    for (; cy < y + h && cy <= front; cy += 2)
      for (let cx = x; cx < x + w; cx += 2) {
        const cw = Math.min(2, x + w - cx),
          ch = Math.min(2, y + h - cy),
          tc = D0 + (span * (cy - top)) / H + JIT * X.hash(cx * 7 + cy, 31);
        if (v < tc) solid(X, cx, cy, cw, ch, col, g, fk);
        else fallBit(X, cx, cy, fx, fy, (v - tc) / FALL);
      }
    solid(X, x, cy, w, y + h - cy, col, g, fk);
  }
  if (v >= D0 && v < D1 + JIT) add(bx0 - 2, Math.round(front), bx1 - bx0 + 4, 1, SCAN);
  else if (v >= 0.04 && v < D0) add(bx0 - 1, Math.round(lerp(top, fy, r(v, 0.04, D0))), bx1 - bx0 + 2, 1, SCAN);
  flush(X.ctx, L.C);
  depGlyphs(X, fx, top, H);
  flush(X.ctx, L.C);
}
// A bit leaving its cell: puffs out a little, then is sucked down into the port, shrinking.
function fallBit(X, cx, cy, fx, fy, a) {
  if (a >= 1 || (X.lite && (cx + cy) & 2)) return;
  const h = X.hash(cx * 5 + cy, 33),
    e = 0.35 * a + 0.65 * in2(a),
    s = Math.sin(Math.PI * a),
    x = lerp(cx, fx + Math.round((h - 0.5) * 6), e) + ((cx - fx) * 0.9 + (h - 0.5) * 6) * s,
    y = lerp(cy, fy - 1, e) - 3 * s;
  add(x, y, a < 0.45 ? 2 : 1, a < 0.45 ? 2 : 1, BIT[h < 0.5 ? 0 : h < 0.8 ? 1 : 2]);
}
// 0s and 1s thrown off the sides as the body breaks up.
function depGlyphs(X, fx, top, H) {
  const v = X.L.v;
  for (let j = 0; j < (X.lite ? 2 : 4); j++) {
    const tb = D0 + 0.02 + j * 0.045,
      age = (v - tb) / 0.13;
    if (age < 0 || age >= 1 || (age > 0.7 && Math.floor(age * 14) % 2)) continue;
    const side = j & 1 ? 1 : -1,
      y = top + (H * (tb - D0)) / (D1 - D0);
    glyph(
      X.hash(j, 41) < 0.5 ? '0' : '1',
      fx + side * (7 + 7 * out2(age)) - 1,
      y - 2 - 7 * out2(age),
      BIT[j & 2 ? 1 : 0],
    );
  }
}

// Arrival: the download. Each cell's bit flies out of the monitor to its place; the rows fill in from the head down
// over a dotted green placeholder; a short decode glitch, then the plain body.
const SRC = [0, 0];
function source(X, out) {
  const dk = deskOf(X);
  if (!dk) {
    out[0] = X.x1;
    out[1] = X.y1 - 34;
    return out;
  }
  // from the screen (its top edge seen from behind the desk, which covers the rest), else the floating bar
  const p = !screenOn(X, dk) ? P(dk.gx + 1, dk.gy + BY, 35.5) : P(dk.gx + 1, dk.gy + 0.22, front(X, dk) ? 23.6 : 31);
  out[0] = Math.round(p[0]);
  out[1] = Math.round(p[1]);
  return out;
}
function arrive(X, q) {
  const L = X.L,
    c = X.capture({ pose: 'stand' }, CAP || (CAP = TpPerson.newCapture())),
    fx = X.x1,
    fy = X.y1,
    [bx0, top, bx1] = bounds(c),
    H = Math.max(8, fy - top),
    span = A1 - A0 - AJ,
    done = top + (H * (q - A0 - AJ)) / span,
    g = 0.8 * r(q, A1 - 0.03, A1 + 0.02) * (1 - r(q, A1 + 0.05, DONE)),
    fk = flickOf(L.v),
    [sx, sy] = source(X, SRC);
  shadowAt(X, fx, fy, r(q, A1 - 0.12, A1 + 0.04));
  // the placeholder first, fainter, so the cells and bits draw over it
  if (!X.lite && q < A1 + AJ) {
    for (let k = 0; k < c.n; k++)
      for (let cy = Math.max(c.y[k], Math.ceil(done)); cy < c.y[k] + c.h[k]; cy++)
        for (let cx = c.x[k] + ((cy + fx) & 1); cx < c.x[k] + c.w[k]; cx += 2)
          if (!((cx + cy) & 2)) add(cx, cy, 1, 1, BIT[2]);
    flush(X.ctx, L.C * 0.55 * r(q, 0.02, A0));
  }
  for (let k = 0; k < c.n; k++) {
    const x = c.x[k],
      y = c.y[k],
      w = c.w[k],
      h = c.h[k],
      col = c.cols[c.c[k]],
      whole = Math.min(y + h, Math.max(y, Math.floor(done / 2) * 2));
    solid(X, x, y, w, whole - y, col, g, fk);
    for (let cy = whole; cy < y + h; cy += 2)
      for (let cx = x; cx < x + w; cx += 2) {
        const tc = A0 + (span * (cy - top)) / H + AJ * X.hash(cx * 7 + cy, 51);
        if (q >= tc) add(cx, cy, Math.min(2, x + w - cx), Math.min(2, y + h - cy), col);
        else if (q >= tc - FLY && !(X.lite && (cx + cy) & 2)) {
          const a = 1 - (tc - q) / FLY,
            e = out2(a),
            hh = X.hash(cx * 5 + cy, 53);
          add(
            lerp(sx, cx, e),
            lerp(sy, cy, e) - 10 * Math.sin(Math.PI * a),
            X.lite || a < 0.12 ? 1 : 2,
            X.lite || a < 0.12 ? 1 : 2,
            BIT[hh < 0.6 ? 0 : 1],
          );
        }
      }
  }
  if (q >= A0 && q < A1 + AJ) add(bx0 - 2, Math.round(done), bx1 - bx0 + 4, 1, SCAN);
  flush(X.ctx, L.C);
}
// Twinkles round the head as the download completes.
function twinkles(X, p) {
  if (p <= 0 || p >= 1) return;
  const cx = X.x1,
    top = X.y1 - 26;
  for (let k = 0; k < 4; k++) {
    const t = clamp(p * 1.3 - 0.15 * k);
    if (t <= 0 || t >= 1) continue;
    const ang = -Math.PI * (0.1 + 0.8 * (k / 3)),
      d = 7 + 9 * out2(t),
      x = Math.round(cx + d * Math.cos(ang)),
      y = Math.round(top + 8 + 0.8 * d * Math.sin(ang)),
      s = t < 0.25 || t > 0.8 ? 0 : 1,
      col = k & 1 ? BIT[1] : WHITE;
    add(x - s, y, 2 * s + 1, 1, col);
    if (s) add(x, y - s, 1, 2 * s + 1, col);
  }
  flush(X.ctx, X.L.C);
}

// The monitor face (decor-furniture.js F.desk: x 0.57-1.43 at y 0.22, z 17.2-30) as polygons on the desk's tiles.
function face(ctx, dk, x0, x1, z0, z1, y = 0.22) {
  const a = P(dk.gx + x0, dk.gy + y, z0),
    b = P(dk.gx + x1, dk.gy + y, z0),
    c = P(dk.gx + x1, dk.gy + y, z1),
    d = P(dk.gx + x0, dk.gy + y, z1);
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.lineTo(d[0], d[1]);
  ctx.closePath();
}
function faces(ctx, col, a, draw) {
  if (a <= 0.01) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.beginPath();
  draw();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Bottom of each column of the tick: the face shears 0.5 px down per px across, so the climb is steep.
const TICK = [23.6, 22.2, 21, 22.6, 24.2, 25.8, 27.4];
const front = (X, dk) => X.tx1 + X.ty1 > dk.gx + dk.gy + 1.5;
// Never over a seated host: the desk item draws them, so the screen would cover them.
function screenShows(X, dk) {
  if (!dk) return false;
  const all = (X.page && X.page.agents) || [];
  for (const o of all) if (o !== X.a && o.seated && DESKS[o.desk] === dk) return false;
  return true;
}
// Once the bar is chosen it stays for this tp (a re-aim makes a new one); the screen yields only to a seated host.
const BAR = new WeakMap();
function screenOn(X, dk) {
  if (!dk || BAR.get(X.tp) === dk) return false;
  if (screenShows(X, dk)) return true;
  BAR.set(X.tp, dk);
  return false;
}
// The download on the landing monitor: a flash, a bobbing arrow over a filling bar, a tick, then the desk's own.
function screen(X, dk, q, v) {
  const ctx = X.ctx,
    C = X.L.C,
    a = C * r(q, 0, 0.04) * (1 - r(v, REL, REL + 0.16)),
    prog = r(q, A0, A1 + AJ),
    bob = Math.floor(X.L.secs * 8) % 2;
  if (a <= 0.01) return;
  faces(ctx, prog >= 1 ? '#0f2a1a' : '#06120b', a, () => face(ctx, dk, 0.57, 1.43, 17.2, 30));
  faces(ctx, '#1c4a2c', a, () => face(ctx, dk, 0.66, 1.34, 18.8, 20.4));
  faces(ctx, BIT[0], a, () => {
    if (prog > 0) face(ctx, dk, 0.66, 0.66 + 0.68 * prog, 18.8, 20.4);
    if (prog < 1) {
      // the download arrow
      face(ctx, dk, 0.95, 1.05, 24.4 - bob, 28 - bob);
      face(ctx, dk, 0.85, 1.15, 23.2 - bob, 24.4 - bob);
      face(ctx, dk, 0.93, 1.07, 22 - bob, 23.2 - bob);
    } else {
      // a tick
      for (let k = 0; k < 7; k++) {
        const z = TICK[k];
        face(ctx, dk, 0.76 + 0.07 * k, 0.83 + 0.07 * k, z, z + 1.7);
      }
    }
  });
  // the flash as the packets arrive
  faces(ctx, '#d8ffe4', a * (1 - r(q, 0.02, 0.12)), () => face(ctx, dk, 0.57, 1.43, 17.2, 30));
}

const BY = 0.17; // the floating bar's plane, mid-monitor
// Where the screen is not drawn (a host at the desk): a download bar floating over the monitor.
function floatBar(X, dk, q, v) {
  const ctx = X.ctx,
    a = X.L.C * r(q, 0, 0.06) * (1 - r(v, REL - 0.04, REL + 0.1)),
    prog = r(q, A0, A1 + AJ);
  if (a <= 0.01) return;
  faces(ctx, DARK, a, () => face(ctx, dk, 0.5, 1.5, 33.6, 37.4, BY));
  faces(ctx, prog >= 1 ? BIT[1] : BIT[0], a, () => {
    if (prog > 0) face(ctx, dk, 0.56, 0.56 + 0.88 * prog, 34.4, 36.6, BY);
  });
  faces(ctx, '#d8ffe4', a * (1 - r(q, 0.02, 0.14)), () => face(ctx, dk, 0.5, 1.5, 33.6, 37.4, BY));
}

export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q) return 4;
    let n = 0;
    if (v < DEP || L.secs - L.d[0] < 0.5) n |= 4;
    if (L.trip >= 0 || (v >= ARR && v < ARR + 0.5 * (REL - ARR))) {
      const te = trailEnd(X);
      n |= 64 | (te < 0 ? 0 : te ? 8 : 4);
    }
    if (v >= ARR - 0.002) n |= 2 | 8 | 64 | Kit.PART.DESK;
    return n;
  },
  back(X, end) {
    const dk = end && deskOf(X);
    if (dk && !screenOn(X, dk)) floatBar(X, dk, r(X.L.v, ARR, REL), X.L.v);
  },
  desk(X) {
    const dk = deskOf(X);
    if (dk && screenOn(X, dk)) screen(X, dk, r(X.L.v, ARR, REL), X.L.v);
  },
  floor(X, end) {
    const L = X.L,
      v = L.v;
    if (L.q) {
      // queued: the closed port waits at the feet, its lights blinking
      if (end) return;
      port(X, X.x0, X.y0, 0, 0.6);
      if (Math.floor(L.secs * 4) & 1) {
        add(X.x0 - 7, X.y0, 1, 1, BIT[0]);
        add(X.x0 + 7, X.y0, 1, 1, BIT[0]);
        flush(X.ctx, 0.9);
      }
      return;
    }
    if (!end) {
      const shut = v < DEP ? 0 : r(L.secs - L.d[0], 0.18, 0.45),
        open = r(v, 0.03, 0.1) * (1 - shut);
      port(X, X.x0, X.y0, open, L.C * r(v, 0, 0.04) * (1 - r(shut, 0.6, 1)));
      glow(X, X.x0, X.y0, L.C * (X.night ? 0.9 : 0.5) * r(v, D0, D1) * (1 - shut));
    } else if (v >= ARR) {
      const q = r(v, ARR, REL);
      glow(X, X.x1, X.y1, L.C * (X.night ? 0.9 : 0.5) * r(q, 0.05, A0) * (1 - r(q, A1, DONE + 0.1)));
    }
    if (end === trailEnd(X)) cableFx(X);
  },
  // The floating 0s and 1s; the cable too when neither end has a plain floor item to carry it.
  trip(X) {
    if (trailEnd(X) < 0) cableFx(X);
    cableGlyphs(X);
  },
  // One body pass a frame: at the spot until the trip, from the monitor at the landing after it.
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || v >= REL || (!L.sw && v < G0)) return false;
    if (L.hide && !L.sw) return true;
    if (L.trip >= 0 && L.trip < 1) return true;
    if (!L.sw) {
      if (v < DEP) depart(X);
      return true;
    }
    const q = r(v, ARR, REL);
    if (q < DONE) arrive(X, q);
    else X.body({ pose: 'stand' });
    twinkles(X, r(q, A1 + 0.02, 1));
    return true;
  },
  marks: [],
  gap: null,
};
// Exposed for tests.
export const PACKET = { cable, pointAt, headAt, screenShows, trailEnd, BIT, D0, D1, JIT, FALL, A0, A1, AJ, FLY };
