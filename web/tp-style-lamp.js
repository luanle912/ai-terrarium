// lamp: a brass oil lamp hops in beside the person, its lid rattles and a blue wisp winds round them; they are sucked
// into the spout, the lid slams and the lamp flies over the island trailing smoke. It lands beside the desk, the lid
// pops, blue smoke pours from the spout into a rising swirl that grows into the person's shape, a puff and they are
// themselves again; then the lamp hops and vanishes in a poof.
// The lamp and the near side of the swirl ride the trip item (at the lamp's ground point while low, the overlay in
// flight); the far side of the swirl is the back item at that end, so the smoke wraps round the body. One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { BLOCK, TH, TW, outdoors } from './office-scene.js';

const { atlas, bake, clamp, r, out2, in2, ease, lerp, frac } = Kit;
const { DEP, ARR, T } = TeleportLogic;
const { RELEASE: REL, END, L_IN, SQUEEZE } = T,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  fd = p => REL + p * (END - REL), // a fade fraction
  B = {
    POP: at(0.1), // the lamp has hopped in
    CALL: at(0.18), // a wisp winds round them; arms up
    SUCK0: at(0.45), // pulled into the spout (a stool sitter from SQUEEZE, once off the stool)
    SUCK1: at(0.86), // all inside
    TOUCH: ar(0.1), // the landing bounce is over
    LID0: ar(0.06), // the lid pops open
    LID1: ar(0.16),
    POUR0: ar(0.12), // smoke pours from the spout
    POUR1: ar(0.6),
    FORM0: ar(0.2), // the smoke shape grows out of the spout to the feet
    FORM1: ar(0.56),
    WHOLE: ar(0.64), // a puff, and the colour is back
    UP: ar(0.86), // arms down again
    SHUT: ar(0.78), // the lid drops shut
    HOP: fd(0.05), // the lamp hops ...
    POOF: fd(0.3), // ... and vanishes at the top
    GONE: fd(0.78), // the poof has cleared
  },
  QA = 0.85, // the queued lamp's alpha, where the pop starts
  SIDE = 13, // px from the feet to the lamp's base, on the side it flies in from
  DROP = 3,
  TIP = [10, -8], // px from the lamp's base to the spout's tip, facing right
  TINT = ['#cfe6ff', '#b9dcff']; // the smoke shape, pale like the smoke's light side: day, night

// The lamp, facing right, in px from its base (y down): part ids 1 foot, 2 bowl, 3 spout, 4 handle, 5 lid, 6 knob.
function part(x, y) {
  if (x * x + (y + 10.3) ** 2 <= 1.7) return 6;
  if (y <= -7.2 && y >= -9.7 && (x / 3.4) ** 2 + ((y + 7.4) / 2.2) ** 2 <= 1) return 5;
  if (y >= -7.6 && (x / 6.6) ** 2 + ((y + 4.6) / 3.3) ** 2 <= 1) return 2;
  if (y > -2.2 && y <= 0.5 && Math.abs(x) <= 2.4 + (y + 2) * 0.5) return 1;
  const ax = 4.6,
    ay = -5.2,
    bx = 11.2,
    by = -8.6,
    t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)),
    d = Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay));
  if (d <= 1.7 - 0.8 * t) return 3;
  const h = Math.hypot(x + 7.6, y + 5.2);
  return h >= 1.3 && h <= 2.7 ? 4 : 0;
}
const LW = 26,
  LH = 18,
  AX = 13, // the base's pixel in a lamp cell
  AY = 15,
  PC = 12, // puff cell
  PY = 4 * LH; // puff rows
// Codes: 1 outline, 2 shade, 3 brass, 4 light, 5 glint. Tilt rotates about the bowl; which: 0 all, 1 no lid, 2 lid.
export function lampPixels(tilt, mirror, which) {
  const px = new Uint8Array(LW * LH),
    id = new Uint8Array(LW * LH),
    c = Math.cos(tilt),
    s = Math.sin(tilt),
    keep = k => k && (which === 0 || (which === 1) === k < 5);
  const local = (i, j) => {
    const x = (i + 0.5 - AX) * (mirror ? -1 : 1),
      y = j + 0.5 - AY + 5;
    return [c * x + s * y, -s * x + c * y - 5];
  };
  for (let j = 0; j < LH; j++)
    for (let i = 0; i < LW; i++) {
      const [x, y] = local(i, j),
        k = part(x, y);
      if (keep(k)) id[j * LW + i] = k;
    }
  const on = (i, j) => i >= 0 && j >= 0 && i < LW && j < LH && id[j * LW + i] > 0;
  for (let j = 0; j < LH; j++)
    for (let i = 0; i < LW; i++) {
      const k = id[j * LW + i];
      if (!k) continue;
      const [x, y] = local(i, j);
      let col = 3;
      if (!on(i - 1, j) || !on(i + 1, j) || !on(i, j - 1) || !on(i, j + 1)) col = 1;
      else if (k === 2 && (x + 2.6) ** 2 + (y + 6) ** 2 < 1.1) col = 5;
      else if (k === 6 || (k === 2 && y < -5.6 && x < 1.5) || (k === 5 && x < -0.5)) col = 4;
      else if (k === 1 || k === 4 || y > -3.2 || (k === 2 && Math.abs(y + 4.2) < 0.5) || (k === 3 && y > -6.4)) col = 2;
      px[j * LW + i] = col;
    }
  return px;
}
// A smoke puff of radius R in a PC cell: 1 lip (lower rim), 2 shade (other rim, lower right), 3 body, 4 light.
export function puffPixels(R) {
  const px = new Uint8Array(PC * PC),
    c0 = PC >> 1,
    inside = (x, y) => x * x + y * y <= R * R + 0.6 * R;
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      if (!inside(x, y)) continue;
      const rim = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
      let col = 3;
      if (rim) col = y >= 0.3 * R ? 1 : 2;
      else if ((x + 0.3 * R) ** 2 + (y + 0.35 * R) ** 2 < (0.6 * R) ** 2) col = 4;
      else if (x + y > 0.7 * R) col = 2;
      px[(c0 + y) * PC + c0 + x] = col;
    }
  return px;
}
// Rows: day, night (the island's lamps are lit, so a warmer, darker brass).
const LAMPC = [
  [null, '#4a2a0a', '#b5761a', '#e3a92e', '#f8d867', '#fffbe2'],
  [null, '#2b1806', '#8a5a16', '#bf8a2a', '#e2bb55', '#fff1c4'],
];
// Rows: day, night (it glows), snow outdoors by day (deeper, so it keeps an edge on white).
const PUFFC = [
  [null, '#3a6fc8', '#5a97e8', '#86c1ff', '#c4e3ff'],
  [null, '#2f63b8', '#4f92ee', '#80c4ff', '#cdeeff'],
  [null, '#24509e', '#3f7fd8', '#6aaaf5', '#b0d6ff'],
];
const TILT = 0.27;
let sheet = null;
// Lamp rows by light and facing: tilted spout up, level, spout down, no lid, the lid alone; then puffs 1-5 by light.
const sheetOf = () =>
  sheet ||
  (sheet = atlas(5 * LW, PY + 3 * PC, g => {
    for (let l = 0; l < 2; l++)
      for (let f = 0; f < 2; f++) {
        const cells = [
          lampPixels(-TILT, !!f, 0),
          lampPixels(0, !!f, 0),
          lampPixels(TILT, !!f, 0),
          lampPixels(0, !!f, 1),
          lampPixels(0, !!f, 2),
        ];
        cells.forEach((px, k) => bake(g, px, LW, LH, k * LW, c => LAMPC[l][c], (2 * l + f) * LH));
      }
    for (let row = 0; row < 3; row++)
      for (let R = 1; R <= 5; R++) bake(g, puffPixels(R), PC, PC, (R - 1) * PC, c => PUFFC[row][c], PY + row * PC);
  }));

const face = X => (X.x1 >= X.x0 ? 1 : -1);
const lightOf = X => (X.night ? 1 : 0);
const smokeRow = (X, end) =>
  X.night ? 1 : X.snow > 0 && (end ? outdoors(X.tx1, X.ty1) : outdoors(X.tx0, X.ty0)) ? 2 : 0;
// A desk in front of tile (gx, gy) would hide a lamp standing there behind its monitor.
const hidden = (gx, gy) => {
  const x = Math.floor(gx),
    y = Math.floor(gy);
  return BLOCK.has(x + 1 + ',' + y) || BLOCK.has(x + ',' + (y + 1)) || BLOCK.has(x + 1 + ',' + (y + 1));
};
// The way the lamp faces at rest at an end: it stands on the side it flies in from, spout to the feet; at the
// landing on the other side when a desk would hide it there.
function faceAt(X, end) {
  const s = face(X);
  if (!end) return s;
  const dx = -s * SIDE;
  return hidden(X.tx1 + (dx / TW + DROP / TH) / 2, X.ty1 + (DROP / TH - dx / TW) / 2) ? -s : s;
}
// The lamp's resting base at an end, in px and tiles: beside the feet, on the side faceAt picks.
const SP = [0, 0, 0, 0];
function spot(X, end, out = SP) {
  const s = faceAt(X, end),
    dx = -s * SIDE;
  out[0] = (end ? X.x1 : X.x0) + dx;
  out[1] = (end ? X.y1 : X.y0) + DROP;
  out[2] = (end ? X.tx1 : X.tx0) + (dx / TW + DROP / TH) / 2;
  out[3] = (end ? X.ty1 : X.ty0) + (DROP / TH - dx / TW) / 2;
  return out;
}
// Flight height (px) at the top of the arc, from the current tp every frame.
const flyH = len => Math.min(96, Math.max(40, 24 + 2 * (len || 0)));
const s0 = stool => (stool ? SQUEEZE : B.SUCK0);
const rattle = (X, n) => Math.floor(X.L.secs * n) % 2;

// Where the lamp is: base px, alpha, height over its ground tile, tilt (-1 spout up, 0, 1), lid lift px (-1: on).
const Q = { x: 0, y: 0, a: 0, h: 0, gx: 0, gy: 0, tilt: 0, lid: -1, s: 1 };
const P0 = [0, 0, 0, 0],
  P1 = [0, 0, 0, 0];
function fly(X, p, out) {
  const e = ease(clamp(p)),
    a = spot(X, 0, P0),
    b = spot(X, 1, P1),
    lift = 4 * flyH(X.tp.len) * e * (1 - e),
    bob = Math.round(1.5 * Math.sin(X.L.secs * 13) * Math.sin(Math.PI * e));
  out.x = Math.round(lerp(a[0], b[0], e));
  out.y = Math.round(lerp(a[1], b[1], e) - lift) + bob;
  out.h = Math.max(0, lift - bob);
  out.gx = lerp(a[2], b[2], e);
  out.gy = lerp(a[3], b[3], e);
  out.tilt = p < 0.04 || p > 0.97 ? 0 : e < 0.32 ? -1 : e > 0.7 ? 1 : 0;
  return out;
}
function where(X) {
  const L = X.L,
    v = L.v;
  Q.s = face(X);
  Q.lid = -1;
  Q.tilt = 0;
  if (L.trip >= 0) {
    fly(X, L.trip, Q);
    Q.a = 1;
    return Q;
  }
  const end = v >= ARR ? 1 : 0,
    o = spot(X, end);
  Q.s = faceAt(X, end);
  let h = 0;
  if (!end) {
    Q.a = (L.hide ? r(v, L_IN, DEP) : QA + (1 - QA) * r(v, 0, B.POP)) * L.C;
    if (!L.hide && v < B.POP) h = 5 * Math.sin(Math.PI * r(v, 0, B.POP));
    else if (v >= B.SUCK1) h = 3 * Math.sin(Math.PI * r(v, B.SUCK1, DEP));
    if (!L.hide && v >= B.POP && v < B.SUCK1) Q.lid = rattle(X, v < s0(X.tp.stool) ? 9 : 16);
  } else {
    Q.a = 1 - r(v, B.POOF, B.POOF + 0.03);
    if (v < B.TOUCH) h = 3 * Math.sin(Math.PI * r(v, ARR, B.TOUCH));
    else if (v >= B.HOP) h = 7 * out2(r(v, B.HOP, B.POOF));
    if (v >= B.LID0 && v < B.SHUT + 0.04)
      Q.lid = Math.round(3 * out2(r(v, B.LID0, B.LID1)) * (1 - r(v, B.SHUT, B.SHUT + 0.04))) + rattle(X, 14);
  }
  Q.x = o[0] + (!end && v >= s0(X.tp.stool) && v < B.SUCK1 ? rattle(X, 30) : 0);
  Q.y = o[1] - Math.round(h);
  Q.h = h;
  Q.gx = o[2];
  Q.gy = o[3];
  return Q;
}
// The spout's tip for a lamp at base (x, y), facing s.
const tipX = (x, s) => x + s * TIP[0],
  tipY = y => y + TIP[1];

function lamp(X, q) {
  if (q.a <= 0.01) return;
  const f = q.s > 0 ? 0 : 1,
    row = (2 * lightOf(X) + f) * LH,
    img = sheetOf(),
    x = q.x - AX,
    y = q.y - AY;
  X.ctx.globalAlpha = Math.min(1, q.a);
  if (q.lid <= 0) X.stamp(img, (q.tilt + 1) * LW, row, LW, LH, x, y, LW, LH);
  else {
    X.stamp(img, 3 * LW, row, LW, LH, x, y, LW, LH);
    X.stamp(img, 4 * LW, row, LW, LH, x - q.s, y - q.lid, LW, LH);
  }
  X.ctx.globalAlpha = 1;
}
function puff(X, row, x, y, R, a) {
  if (a <= 0.02) return;
  const k = Math.max(1, Math.min(5, Math.round(R)));
  X.ctx.globalAlpha = Math.min(1, a);
  X.stamp(sheetOf(), (k - 1) * PC, PY + row * PC, PC, PC, Math.round(x) - 6, Math.round(y) - 6, PC, PC);
}

// The body at an end: feet px, squeeze, alpha, tinted (the smoke shape) or not; on = false when nothing shows.
const F = { x: 0, y: 0, sx: 1, sy: 1, a: 1, tint: false, on: true };
function shape(X, end, v) {
  const o = spot(X, end, P0),
    tx = tipX(o[0], faceAt(X, end)),
    ty = tipY(o[1]),
    fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0;
  let p;
  if (!end) {
    const k = in2(r(v, s0(X.tp.stool), B.SUCK1));
    p = 1 - k;
    F.tint = k > 0.3;
    F.a = k > 0.3 ? 0.9 * (1 - r(k, 0.85, 1)) : 1;
  } else {
    p = out2(r(v, B.FORM0, B.FORM1));
    F.tint = v < B.WHOLE;
    F.a = F.tint ? 0.55 + 0.35 * p : 1;
  }
  const s = 0.12 + 0.88 * p,
    w = Math.sin(Math.PI * p);
  F.x = Math.round(lerp(tx, fx, p));
  F.y = Math.round(lerp(ty, fy, p));
  F.sx = s * (1 - 0.3 * w);
  F.sy = s * (1 + 0.4 * w);
  F.on = end ? v >= B.FORM0 : v < B.SUCK1;
  return F;
}

// The swirl round the body: puffs climbing a helix (into the spout on leaving: down), near or far side.
function swirl(X, end, near) {
  const L = X.L,
    v = L.v,
    a = end
      ? r(v, B.POUR0 + 0.03, B.FORM0) * (1 - r(v, B.WHOLE - 0.02, B.WHOLE + 0.03))
      : r(v, B.CALL, B.CALL + 0.06) * (1 - r(v, B.SUCK1 - 0.03, B.SUCK1 + 0.01)) * L.C;
  if (a <= 0.02) return;
  const f = v >= s0(X.tp.stool) || end ? shape(X, end, v) : null,
    fx = f ? f.x : X.x0,
    fy = f ? f.y : X.y0,
    sx = f ? Math.max(0.3, f.sx) : 1,
    sy = f ? Math.max(0.25, f.sy) : 1,
    cy = fy - 13 * sy,
    hh = 12 * sy,
    rx = 3 + 8 * sx,
    n = X.lite ? 4 : 8,
    row = smokeRow(X, end),
    grow = end ? 1 : r(v, B.CALL, B.CALL + 0.08),
    thin = f ? 1 : 0.5; // a light wisp until the pull starts, so their face still shows
  for (let k = 0; k < n; k++) {
    const lv = frac(k / n + (end ? 1 : -1) * L.secs * 0.9),
      ang = lv * 4 * Math.PI + k,
      sn = Math.sin(ang);
    if (sn > 0 !== near || lv > grow) continue;
    const w = Math.sin(Math.PI * lv);
    puff(
      X,
      row,
      fx + rx * Math.cos(ang),
      cy + hh - 2 * hh * lv + 2.5 * sn,
      1 + (0.5 + 2 * w * sy) * thin,
      a * (0.5 + 0.5 * w) * (0.6 + 0.4 * thin),
    );
  }
  X.ctx.globalAlpha = 1;
}
// The stream between the spout and the body: reaching out, then pulled in on leaving; pouring out on landing.
function stream(X, q, end) {
  const L = X.L,
    v = L.v,
    S0 = s0(X.tp.stool),
    a = end
      ? r(v, B.POUR0, B.POUR0 + 0.03) * (1 - r(v, B.POUR1 - 0.04, B.POUR1))
      : r(v, B.CALL, B.CALL + 0.04) * (1 - r(v, B.SUCK1 - 0.02, B.SUCK1 + 0.02)) * L.C;
  if (a <= 0.02) return;
  const tx = tipX(q.x, q.s),
    ty = tipY(q.y),
    f = shape(X, end, v),
    cx = f.on ? f.x : end ? X.x1 : X.x0,
    cy = (f.on ? f.y - 12 * f.sy : (end ? X.y1 : X.y0) - 12) + (end && !f.on ? 6 : 0),
    mx = (tx + cx) / 2,
    my = Math.min(ty, cy) - 7,
    n = X.lite ? 2 : 5,
    row = smokeRow(X, end),
    out = end || v < S0,
    reach = end ? 1 : v < S0 ? r(v, B.CALL, B.CALL + 0.08) : 1;
  for (let k = 0; k < n; k++) {
    const g = frac(k / n + L.secs * 2.3),
      t = (out ? g : 1 - g) * reach,
      u = 1 - t;
    puff(
      X,
      row,
      u * u * tx + 2 * u * t * mx + t * t * cx,
      u * u * ty + 2 * u * t * my + t * t * cy,
      1.5 + 1.8 * t,
      a * 0.9 * (1 - r(t, 0.85, 1) * (out ? 1 : 0)),
    );
  }
  X.ctx.globalAlpha = 1;
}
// A ring of n puffs from (cx, cy) over q in [0, 1].
function ring(X, row, cx, cy, q, n, spread, R) {
  if (q <= 0 || q >= 1) return;
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * 2 * Math.PI + 0.4,
      d = 3 + spread * out2(q);
    puff(X, row, cx + d * Math.cos(ang), cy + 0.6 * d * Math.sin(ang) - 4 * q, R * (1 - 0.6 * q), 0.9 * (1 - q));
  }
  X.ctx.globalAlpha = 1;
}
// Four-point sparkles rising over (cx, cy), one fill.
function sparkles(X, cx, cy, q) {
  if (q <= 0 || q >= 1 || X.lite) return;
  const ctx = X.ctx;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const x = Math.round(cx + (k - 1) * 9 + (X.hash(k, 5) - 0.5) * 4),
      y = Math.round(cy - 6 - 14 * q - 5 * X.hash(k, 9));
    ctx.rect(x, y - 1, 1, 3);
    ctx.rect(x - 1, y, 3, 1);
  }
  ctx.globalAlpha = 1 - q;
  ctx.fillStyle = X.night ? '#e8f6ff' : '#ffffff';
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Smoke trailing the lamp in flight, puffs about 7 px apart along where it has just been.
const TQ = { x: 0, y: 0, h: 0, gx: 0, gy: 0, tilt: 0 };
function trail(X) {
  const L = X.L,
    n = X.lite ? 2 : 5,
    row = smokeRow(X, L.trip > 0.5 ? 1 : 0),
    step = 7 / Math.max(20, Math.hypot(X.x1 - X.x0, X.y1 - X.y0) + flyH(X.tp.len)),
    a = clamp(L.trip * 10) * clamp((1 - L.trip) * 6);
  for (let k = n; k >= 1; k--) {
    const p = L.trip - step * k;
    if (p <= 0) continue;
    fly(X, p, TQ);
    const w = Math.sin(L.secs * 11 + k * 1.7);
    puff(X, row, TQ.x - face(X) * 5, TQ.y - 6 + w, 3.6 - 0.5 * k, a * (0.95 - 0.13 * k));
  }
  X.ctx.globalAlpha = 1;
}

export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q) return 16;
    if (v >= B.GONE || (L.hide && !L.sw && v < L_IN)) return 0;
    let n = 64;
    if (where(X).a >= 0.5) n |= 128;
    if (!L.hide && L.trip < 0 && v >= B.CALL && v < B.SUCK1 + 0.02) n |= 1;
    if (v >= B.POUR0 && v < B.WHOLE + 0.04) n |= 2;
    return n;
  },
  // Queued: the lamp waits beside them, dimmed.
  stand(X, end) {
    if (end || !X.L.q) return;
    where(X);
    Q.a = QA;
    Q.lid = -1;
    lamp(X, Q);
  },
  back(X, end) {
    swirl(X, end, false);
  },
  trip(X) {
    const L = X.L,
      v = L.v,
      q = where(X);
    if (L.trip >= 0) {
      trail(X);
      lamp(X, q);
      return;
    }
    lamp(X, q);
    if (v < ARR) {
      // A stall user's lamp appears out of thin air: a small puff as it firms up.
      if (L.hide) return ring(X, smokeRow(X, 0), q.x, q.y - 5, r(v, L_IN, DEP + 0.02), X.lite ? 3 : 5, 8, 2.4);
      ring(X, smokeRow(X, 0), q.x, q.y - 5, r(v, 0, B.POP + 0.04), X.lite ? 3 : 5, 9, 2.6);
      stream(X, q, 0);
      swirl(X, 0, true);
      return;
    }
    const row = smokeRow(X, 1);
    stream(X, q, 1);
    swirl(X, 1, true);
    const bq = r(v, B.WHOLE - 0.015, B.WHOLE + 0.09);
    ring(X, row, X.x1, X.y1 - 13, bq, X.lite ? 3 : 6, 12, 3.4);
    sparkles(X, X.x1, X.y1 - 14, bq);
    const pq = r(v, B.POOF - 0.01, B.GONE);
    ring(X, row, q.x, q.y - 5, pq, X.lite ? 3 : 5, 10, 3);
    sparkles(X, q.x, q.y - 4, pq);
  },
  // The ground point under the lamp; its shadow is asked for only while it shows.
  ground(X, out) {
    const q = where(X);
    out[0] = q.gx;
    out[1] = q.gy;
    out[2] = q.h;
    return true;
  },
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || v >= REL) return false;
    if (L.trip >= 0 || (L.hide && !L.sw)) return true;
    if (!L.sw) {
      if (v < DEP) leave(X, v);
    } else if (v >= ARR) land(X, v);
    return true;
  },
  marks: [],
  gap: null,
};
// The departure: as they are (a stool sitter until they stand), arms up as the wisp winds round, then sucked in.
function leave(X, v) {
  const stool = X.tp.stool;
  if (v < s0(stool)) {
    X.body(v < SQUEEZE && stool ? {} : v >= B.CALL ? { pose: 'up', front: true } : {});
    return;
  }
  const f = shape(X, 0, v);
  if (f.on && f.a > 0.02) X.bodyAt(f.x, f.y, look(X, f, 'up'));
}
// The arrival: a plain standing smoke shape grows out of the spout, then the person, arms up for a moment.
function land(X, v) {
  if (v >= B.WHOLE) {
    X.body({ pose: v < B.UP ? 'up' : 'stand', front: true });
    return;
  }
  const f = shape(X, 1, v);
  if (f.on) X.bodyAt(f.x, f.y, look(X, f, 'stand'));
}
const O = { pose: 'up', front: true, sx: 1, sy: 1, tint: null, alpha: 1 };
function look(X, f, pose) {
  O.pose = pose;
  O.sx = f.sx;
  O.sy = f.sy;
  O.tint = f.tint ? TINT[lightOf(X)] : null;
  O.alpha = f.a;
  return O;
}
// Exposed for tests.
export const LAMP = { B, QA, SIDE, TIP, flyH, s0, where, shape, faceAt, spot, need: STYLE.need, part };
