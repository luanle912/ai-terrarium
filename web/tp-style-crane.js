// crane: a giant paper crane swoops down over the person, they reach up and grab its belly, and it flaps them up and
// carries them over the island, dangling. Over the desk it lowers them, lets go a hand's breadth up (they drop and
// land in a puff), then folds itself away: wings together, the bird base, a square of paper, a twinkle.
// The crane rides the trip item. The person hangs under it: drawn by person() at the walker's depth at both ends and
// by trip() in flight, where ground() reports the feet's height, so a low take-off sorts with the furniture as before.
// The puffs and the feet's shadow are floor items. One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { TW, outdoors } from './office-scene.js';

const { atlas, bake, clamp, r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR, T } = TeleportLogic;
const { RELEASE: REL, END, L_IN, SQUEEZE } = T,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  fd = p => REL + p * (END - REL), // a fade fraction
  B = {
    REACH: at(0.28), // they reach up as it comes down
    SWOOP: at(0.36), // it has swooped down to a hover over their hands
    GRAB: at(0.46), // it settles onto their hands
    LIFT: at(0.5), // and flaps them up (a stool sitter: once off the stool)
    PUFF: at(0.3), // how long a puff lasts
    LOW: ar(0.42), // lowered to a hand's breadth over the floor
    LET: ar(0.46), // it lets go
    FLOOR: ar(0.56), // they land
    RISEN: ar(0.9), // the crane has risen clear
    FOLD0: fd(0.04), // folds: wings together, the bird base, a square ...
    FOLD1: fd(0.56),
    SHRINK: fd(0.7), // ... that shrinks ...
    GONE: fd(0.86), // ... to a twinkle
    OUT: fd(0.97), // and nothing is left
  },
  QA = 0.45, // the queued crane's alpha, high up where the swoop starts
  HANG = 21, // px from the feet to the crane's centre while they hold on (hands just under its belly)
  GAP = 7, // px it hovers over their hands before settling (higher over a stool sitter's seat)
  LIFT = 12, // px their feet are off the floor at take-off and on arrival
  HOLD = 6, // px over the floor where it lets go
  RISE = 12, // px it climbs after letting go
  SWX = 40, // the swoop starts this far to the side (px) ...
  SWY = 70, // ... and this much higher
  LOW = 24; // px: the dispatcher's overlay height

// Frames, facing right: wings up, half, level, down; then folding: wings together, bird base, square, smaller, tiny.
const F = { UP: 0, MID: 1, LEVEL: 2, DOWN: 3, CLOSE: 4, KITE: 5, SQ: 6, SQS: 7, SQT: 8 };
const FLAP = [F.UP, F.MID, F.LEVEL, F.DOWN, F.LEVEL, F.MID];
// Facets in px from the crane's centre: [code, x0, y0, x1, y1, ...], painted in order. Codes: 2 far wing, 3 shade,
// 4 paper, 5 light, 6 crease, 7 white underside.
const NECK = [3, 4, -2, 8, 3, 17, -14],
  HEAD = [4, 14, -12, 17, -16, 22, -10],
  TAIL = [3, -4, -2, -8, 3, -19, -14],
  BODY = [4, -8, 1, -3, -3, 3, -3, 8, 1, 5, 4, -5, 4],
  RIDGE = [5, -8, 1, -3, -3, 3, -3, 0, 1],
  BIRD = [NECK, HEAD, TAIL, BODY, RIDGE];
const FACETS = [
  [[2, -3, -2, 3, -2, 5, -21], ...BIRD, [5, -6, -1, 4, -1, -5, -23], [6, -1, -2, 0, -2, -4, -20]],
  [[2, -3, -2, 3, -2, -4, -18], ...BIRD, [5, -6, -1, 4, -1, -15, -16], [6, -1, -2, 0, -2, -12, -15]],
  [[2, -3, -2, 3, -2, -13, -10], ...BIRD, [5, -6, -2, 5, 0, -20, 1], [6, -1, -1, 0, -1, -17, 0]],
  [[2, -3, -2, 3, -2, -6, -6], ...BIRD, [7, -6, 0, 2, 0, -19, 9], [3, -6, 0, -4, 0, -19, 9]],
  [[2, -2, -2, 2, -2, 2, -19], ...BIRD, [5, -4, -1, 3, -1, -1, -21], [6, -1, -2, 0, -2, -1, -18]],
  [
    [4, 0, -13, 6, -3, 0, 9, -6, -3],
    [5, 0, -13, -6, -3, 0, 9],
    [6, 0, -12, 1, -12, 1, 8, 0, 8],
  ],
  [
    [4, 0, -7, 8, 0, 0, 7, -8, 0],
    [5, 0, -7, -8, 0, 0, 7],
    [6, -7, 0, 7, 0, 7, 1, -7, 1],
  ],
  [
    [4, 0, -4, 5, 0, 0, 4, -5, 0],
    [5, 0, -4, -5, 0, 0, 4],
  ],
  [[5, 0, -2, 3, 0, 0, 2, -3, 0]],
];
const CW = 48,
  CH = 44,
  AX = 24, // the centre's pixel in a cell
  AY = 27;
function inside(p, x, y) {
  let c = false;
  for (let i = 1, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i],
      yi = p[i + 1],
      xj = p[j],
      yj = p[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// One frame's raster (code 1 is the outline round it); mirror faces it left.
export function cranePixels(f, mirror) {
  const px = new Uint8Array(CW * CH),
    out = new Uint8Array(CW * CH);
  for (let j = 0; j < CH; j++)
    for (let i = 0; i < CW; i++) {
      const x = (mirror ? CW - 1 - i : i) + 0.5 - AX,
        y = j + 0.5 - AY;
      for (const p of FACETS[f]) if (inside(p, x, y)) px[j * CW + i] = p[0];
    }
  const on = (i, j) => i >= 0 && j >= 0 && i < CW && j < CH && px[j * CW + i] > 0;
  for (let j = 0; j < CH; j++)
    for (let i = 0; i < CW; i++) {
      const k = j * CW + i;
      out[k] = px[k] || (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1) ? 1 : 0);
    }
  return out;
}
// Rows: day, night (a little darker, but the paper still catches the light against the night floors).
const PAPER = [
  [null, '#4a1622', '#9c2f3a', '#c4434a', '#e2584f', '#f47a62', '#ffb39a', '#fbeee2'],
  [null, '#1e0c14', '#7a2838', '#9e3a48', '#bd4c50', '#d86c60', '#f2a48c', '#e0d6dc'],
];
const NF = FACETS.length;
let sheet = null;
// Cells by light (rows of two facings) and frame (columns).
const sheetOf = () =>
  sheet ||
  (sheet = atlas(NF * CW, 4 * CH, g => {
    for (let l = 0; l < 2; l++)
      for (let m = 0; m < 2; m++)
        for (let f = 0; f < NF; f++)
          bake(g, cranePixels(f, m === 1), CW, CH, f * CW, c => PAPER[l][c], (2 * l + m) * CH);
  }));

// Facing: towards the landing.
// shortcut: read every frame, so an early re-aim to the other side flips it in one frame; tp has no fixed side yet.
const face = X => (X.x1 >= X.x0 ? 1 : -1);
const flap = (X, rate) => FLAP[((Math.floor(X.L.secs * rate) % 6) + 6) % 6];
// Cruise height over the take-off height (px), from the current tp every frame.
const cruise = len => Math.min(70, Math.max(24, 12 + 2 * (len || 0)));
// When a stool sitter reaches, is grabbed and lifted: only once off the stool.
const reach0 = stool => (stool ? SQUEEZE : B.REACH),
  grab = stool => (stool ? SQUEEZE + at(0.1) : B.GRAB),
  lift0 = stool => (stool ? SQUEEZE + at(0.14) : B.LIFT);
// Feet off the floor (px) at departure and arrival.
function feetUp(X, v) {
  if (v < ARR) return LIFT * ease(r(v, lift0(X.tp.stool), DEP));
  if (v < B.LET) return lerp(LIFT, HOLD, ease(r(v, ARR, B.LOW)));
  return HOLD * (1 - in2(r(v, B.LET, B.FLOOR)));
}

// Where the crane is: centre px, alpha, height over its ground tile, ground tile, frame, passenger hanging.
const Q = { x: 0, y: 0, a: 0, h: 0, gx: 0, gy: 0, f: 0, pass: false };
// The crane dx px to the side and dy px over its holding height above an end.
function hover(X, end, dx, dy, out) {
  const fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0;
  out.x = Math.round(fx + dx);
  out.y = Math.round(fy - HANG - dy);
  out.h = HANG + dy;
  out.gx = (end ? X.tx1 : X.tx0) + dx / TW / 2;
  out.gy = (end ? X.ty1 : X.ty0) - dx / TW / 2;
  return out;
}
function where(X) {
  const L = X.L,
    v = L.v,
    s = face(X),
    stool = X.tp.stool;
  if (L.trip >= 0) {
    const e = ease(clamp(L.trip)),
      up = cruise(X.tp.len) * Math.sin(Math.PI * e);
    Q.x = Math.round(lerp(X.x0, X.x1, e));
    Q.y = Math.round(lerp(X.y0, X.y1, e) - HANG - LIFT - up);
    Q.h = HANG + LIFT + up;
    Q.gx = lerp(X.tx0, X.tx1, e);
    Q.gy = lerp(X.ty0, X.ty1, e);
    Q.a = 1;
    Q.f = L.trip > 0.3 && L.trip < 0.72 ? F.LEVEL : flap(X, 11);
    Q.pass = true;
    return Q;
  }
  if (v < ARR) {
    if (L.hide) {
      hover(X, 0, 0, LIFT, Q);
      Q.a = r(v, L_IN, DEP - 0.03) * L.C;
      Q.f = flap(X, 14);
      Q.pass = true;
      return Q;
    }
    const e = out2(r(v, 0, B.SWOOP)),
      g = grab(stool),
      dy = (GAP + (stool === 2 ? 9 : stool ? 4 : 0)) * (1 - ease(r(v, g - at(0.1), g))) + feetUp(X, v);
    hover(X, 0, -s * SWX * (1 - e), SWY * (1 - e) + dy, Q);
    Q.a = (L.q ? QA : lerp(QA, 1, r(v, 0, at(0.12)))) * L.C;
    // queued it circles high up with slow beats; then it glides in, flares to brake and flaps hard to hold them up
    const slow = Math.abs(Math.floor(L.secs * 3)) % 2;
    if (L.q) Q.y -= slow;
    Q.f = L.q
      ? slow
        ? F.MID
        : F.LEVEL
      : v < B.SWOOP - at(0.1)
        ? flap(X, 9)
        : v < B.SWOOP
          ? F.UP
          : flap(X, v < g ? 12 : 16);
    Q.pass = v >= g;
    return Q;
  }
  const up = RISE * out2(r(v, B.LET, B.RISEN)) + 6 * ease(r(v, B.FOLD0, B.SHRINK));
  hover(X, 1, 0, (v < B.LET ? feetUp(X, v) : HOLD) + up, Q);
  Q.a = 1;
  Q.pass = v < B.LET;
  if (v < B.LET) Q.f = flap(X, 12);
  else if (v < B.LET + 0.02) Q.f = F.UP;
  else if (v < B.LET + 0.04) Q.f = F.DOWN;
  else if (v < B.FOLD0) Q.f = flap(X, 12);
  else if (v < B.FOLD1) Q.f = [F.CLOSE, F.KITE, F.SQ][Math.min(2, Math.floor(3 * r(v, B.FOLD0, B.FOLD1)))];
  else if (v < B.SHRINK) Q.f = F.SQ;
  else Q.f = v < (B.SHRINK + B.GONE) / 2 ? F.SQS : F.SQT;
  return Q;
}

function crane(X, q) {
  if (q.a <= 0.01 || X.L.v >= B.GONE) return;
  const ctx = X.ctx,
    row = 2 * (X.night ? 1 : 0) + (face(X) < 0 ? 1 : 0);
  ctx.globalAlpha = Math.min(1, q.a);
  X.stamp(sheetOf(), q.f * CW, row * CH, CW, CH, q.x - AX, q.y - AY, CW, CH);
  ctx.globalAlpha = 1;
}
// Wind streaming off its wings in flight, longer at full speed: two dashed lines behind it, one fill. Along its
// heading on screen (the hump's climb or sink included), and none when that is steep, where they would hang like drips.
function wake(X, q) {
  const L = X.L,
    dx = X.x1 - X.x0,
    dy = X.y1 - X.y0 - Math.PI * cruise(X.tp.len) * Math.cos(Math.PI * ease(clamp(L.trip))),
    n = Math.hypot(dx, dy),
    sp = 6 * L.trip * (1 - L.trip);
  if (X.lite || L.trip < 0 || n < 4 || sp < 0.3 || Math.abs(dy) > 1.5 * Math.abs(dx)) return;
  const ux = -dx / n,
    uy = -dy / n,
    len = Math.round(6 + 10 * sp),
    ctx = X.ctx;
  ctx.beginPath();
  for (const off of [-5, 4])
    for (let k = 0; k < len; k += 3) {
      const d = 20 + k + (off > 0 ? 4 : 0);
      ctx.rect(Math.round(q.x + ux * d - uy * off), Math.round(q.y - 3 + uy * d + ux * off), 2, 1);
    }
  ctx.globalAlpha = 0.7 * clamp(sp - 0.3);
  ctx.fillStyle = X.night ? '#d8e4ff' : '#ffffff';
  ctx.fill();
  ctx.globalAlpha = 1;
}
// A four-point twinkle where the last square was: a gold cross round a white heart, growing then gone.
function twinkle(X, q) {
  const v = X.L.v,
    t0 = (B.SHRINK + B.GONE) / 2;
  if (v < t0 || v >= B.OUT) return;
  const k = Math.sin(Math.PI * r(v, t0, B.OUT)),
    n = Math.round(2 + 5 * k),
    ctx = X.ctx;
  ctx.beginPath();
  ctx.rect(q.x - n, q.y, 2 * n + 1, 1);
  ctx.rect(q.x, q.y - n, 1, 2 * n + 1);
  ctx.rect(q.x - 1, q.y - 1, 3, 3);
  ctx.fillStyle = X.night ? '#ffcf5a' : '#ffb52e';
  ctx.fill();
  ctx.beginPath();
  ctx.rect(q.x - (n >> 1), q.y, 2 * (n >> 1) + 1, 1);
  ctx.rect(q.x, q.y - (n >> 1), 1, 2 * (n >> 1) + 1);
  ctx.fillStyle = '#fffdf2';
  ctx.fill();
}
// A snap of white crease lines as each fold lands: four short strokes round the paper, one fill.
function snap(X, q) {
  const v = X.L.v;
  let k = -1;
  for (let j = 1; j <= 3; j++) {
    const t = j < 3 ? lerp(B.FOLD0, B.FOLD1, j / 3) : B.SHRINK;
    if (v >= t && v < t + 0.025) k = r(v, t, t + 0.025);
  }
  if (k < 0) return;
  const ctx = X.ctx,
    d = Math.round(9 + 5 * k);
  ctx.beginPath();
  ctx.rect(q.x - d - 2, q.y - 1, 3, 1);
  ctx.rect(q.x + d, q.y - 1, 3, 1);
  ctx.rect(q.x - 1, q.y - d - 3, 1, 3);
  ctx.rect(q.x + 1, q.y + d - 2, 1, 3);
  ctx.globalAlpha = 1 - k;
  ctx.fillStyle = '#fffaf0';
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Dust kicked up at an end as they leave or land: tufts spreading over an ellipse and rising a little, lit on top.
const DUST = [
  ['#d9cfbb', '#fbf6ea'],
  ['#8f897e', '#c9c2b4'],
  ['#8496ad', '#b9c7d8'],
];
function puff(X, end, p) {
  if (p <= 0 || p >= 1) return;
  const ctx = X.ctx,
    fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0,
    snowy = X.snow > 0 && (end ? outdoors(X.tx1, X.ty1) : outdoors(X.tx0, X.ty0)),
    col = DUST[snowy ? 2 : X.night ? 1 : 0],
    n = X.lite ? 5 : 9,
    d = 5 + 10 * out2(p),
    lift = Math.round(3 * p);
  ctx.globalAlpha = 0.9 * (1 - in2(p)) * X.L.C;
  for (let l = 0; l < 2; l++) {
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * 2 * Math.PI + X.hash(k, 5),
        x = Math.round(fx + d * Math.cos(ang)) - 1,
        y = Math.round(fy + 0.5 * d * Math.sin(ang)) - 1 - lift;
      if (l) ctx.rect(x, y - 1, 2, 1);
      else ctx.rect(x - 1, y - 1, 4, 3);
    }
    ctx.fillStyle = col[l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// The feet's shadow while the remapped body (which has none) is drawn: fainter as they rise, whole in a cut.
function feetShadow(X, end, up) {
  Kit.shadow(X.ctx, end ? X.x1 : X.x0, end ? X.y1 : X.y0, 10 - up / 3, 0.9 - up / 30);
}

const UPO = { pose: 'up', front: true, alpha: 1 },
  O = { pose: 'up', front: true, sx: 1, sy: 1 };
// The body hanging from the crane at q: hands just under its belly, a gentle sway in flight.
function hanging(X, q, alpha) {
  const L = X.L,
    sway = L.trip >= 0 ? Math.round(1.4 * Math.sin(L.secs * 6) * Math.sin(Math.PI * L.trip)) : 0;
  UPO.alpha = alpha;
  X.bodyAt(q.x + sway, q.y + HANG, UPO);
}

export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v,
      stool = X.tp.stool;
    if (L.q) return L.hide ? 0 : 64;
    if (v >= B.OUT || (L.hide && !L.sw && v < L_IN)) return 0;
    let n = 64;
    const q = where(X),
      feet = !L.sw ? !L.hide && v >= reach0(stool) && v < DEP : v >= ARR && v < REL;
    if (q.a >= 0.3 && !feet && v < B.SHRINK) n |= 128;
    // the feet shadow for as long as the body hangs at an end (feet above also drops the dispatcher's)
    if (!L.hide && v >= reach0(stool) && v < Math.max(DEP, lift0(stool) + B.PUFF)) n |= 4;
    if (L.sw && v >= ARR && v < REL) n |= 8;
    return n;
  },
  floor(X, end) {
    const v = X.L.v;
    if (!end) {
      if (v < DEP && !X.L.sw) feetShadow(X, 0, feetUp(X, v));
      puff(X, 0, r(v, lift0(X.tp.stool), lift0(X.tp.stool) + B.PUFF));
      return;
    }
    if (v < REL) feetShadow(X, 1, feetUp(X, v));
    puff(X, 1, r(v, B.FLOOR, B.FLOOR + B.PUFF));
  },
  trip(X) {
    const q = where(X),
      L = X.L;
    if (q.a > 0.01 && (L.trip >= 0 || (L.hide && !L.sw))) hanging(X, q, Math.min(1, q.a));
    wake(X, q);
    crane(X, q);
    snap(X, q);
    twinkle(X, q);
  },
  // The ground point under the crane, and the hanging feet's height while trip() draws the body; else the overlay.
  ground(X, out) {
    const q = where(X),
      L = X.L;
    out[0] = q.gx;
    out[1] = q.gy;
    out[2] = L.trip >= 0 || (L.hide && !L.sw) ? q.h - HANG : Math.max(LOW, q.h);
    return true;
  },
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || (L.sw && v >= REL)) return false;
    if (L.trip >= 0 || (L.hide && !L.sw)) return true;
    if (!L.sw) {
      if (v < reach0(X.tp.stool)) X.body({});
      else {
        UPO.alpha = 1;
        X.bodyAt(X.x0, X.y0 - Math.round(feetUp(X, v)), UPO);
      }
      return true;
    }
    if (v >= ARR) landing(X, v);
    return true;
  },
  marks: [],
  gap: null,
};
// Lowered, let go, a short drop and a squash on the floor.
function landing(X, v) {
  const sq = Math.sin(Math.PI * r(v, B.FLOOR, B.FLOOR + 0.05));
  O.pose = v < B.FLOOR ? 'up' : 'stand';
  O.sx = 1 + 0.18 * sq;
  O.sy = 1 - 0.2 * sq;
  X.bodyAt(X.x1, X.y1 - Math.round(feetUp(X, v)), O);
}
// Exposed for tests.
export const CRANE = { B, F, QA, HANG, LIFT, HOLD, cruise, reach0, grab, lift0, feetUp, where, wake, need: STYLE.need };
