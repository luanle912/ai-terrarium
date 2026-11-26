// trampoline: a trampoline springs up out of the floor under them, they bounce twice, higher each time, sink deep into
// the mat and launch: one big bounce across the island with a tucked somersault at the top (two on a long trip),
// then a crouched landing in a puff of dust, a pop up with arms raised and a twinkle of stars. Behind them the mat
// wobbles and the trampoline folds back into the floor. The mat and the frame's back are a back item and the front
// rim a stand item, so the feet sink into the mat; the flier is drawn by trip(), and ground() reports the real
// height, so the launch and the landing sort with the furniture. One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { outdoors } from './office-scene.js';

const { atlas, r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR, T, core, real } = TeleportLogic;
const { RELEASE: REL, L_IN, SQUEEZE } = T,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  B = {
    RISE: at(0.02), // the trampoline springs up under them ...
    UP: at(0.2), // ... and stands on its legs
    SHOW: 0.03, // core: how long it takes to fade in
    LAND: ar(0.18), // the crouch at touchdown is over
    POP: ar(0.36), // up on their toes, arms raised
    DOWN: ar(0.82), // arms down again before the release
    FLIP0: 0.3, // trip fractions of the somersault
    FLIP1: 0.68,
  },
  // [start, end, height px] on the core clock: two bounces, then the deep dip that launches them
  BOUNCES = [
    [at(0.2), at(0.46), 7],
    [at(0.46), at(0.75), 16],
    [at(0.75), DEP, 0],
  ],
  // a stool sitter gets off at SQUEEZE: one dip; a hidden start comes out of the stall bouncing
  STOOL = [[SQUEEZE + 0.045, DEP, 0]],
  HIDDEN = [
    [L_IN, at(0.84), 6],
    [at(0.84), DEP, 0],
  ],
  FOLD = { WOBBLE: 0.28, SINK: 0.5, GONE: 0.6, DUST: 0.8 }, // seconds after the launch
  RIM = 6, // px from the floor up to the mat
  DIP = [2, 4], // px the mat gives under a bounce, under the launch
  TRAIL = 0.24, // seconds of dotted wake behind the flier
  LOW = 24; // px: the dispatcher sorts an air trip lower than this with the furniture

// Raster: one cell per part (back: legs' tops, mat, springs, pad; front: the pad's near half and its face).
// Small enough (16 px) not to swallow the coffee table or a bench next to an idle spot.
const CW = 16,
  CH = 10,
  CX = 8,
  CY = 4,
  RX = 7.5,
  RY = 3.6;
// 1 mat, 2 mat sheen, 3 spring, 4 pad, 5 pad light, 6 pad face, 7 pad face dark.
export function trampolinePixels(front) {
  const px = new Uint8Array(CW * CH),
    e = (x, y, rx, ry, dy = 0) => ((x + 0.5 - CX) / rx) ** 2 + ((y + 0.5 - CY - dy) / ry) ** 2;
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const near = y + 0.5 > CY + 1;
      let c = 0;
      if (e(x, y, RX, RY) <= 1) {
        if (e(x, y, 5.25, 1.8) <= 1) c = front ? 0 : y + 0.5 < CY - 1 ? 2 : 1;
        else if (e(x, y, 6.3, 2.5) <= 1) c = (front && near) || (!front && !near) ? ((x + y) % 2 ? 3 : 1) : 0;
        else c = front === near ? (y + 0.5 < CY - 1.5 ? 5 : 4) : 0;
      } else if (front && e(x, y, RX, RY, 2) <= 1 && y + 0.5 > CY) c = x < CX - 4 || x > CX + 3 ? 7 : 6;
      px[y * CW + x] = c;
    }
  return px;
}
const DAY = ['#25252d', '#3b3c4a', '#c7cbd3', '#2f74d6', '#73acf2', '#1f4d9e', '#17397a'];
const hex = (c, k) => parseInt(c.slice(1 + 2 * k, 3 + 2 * k), 16);
const dim = c => `rgb(${[0, 1, 2].map(k => Math.round(hex(c, k) * 0.76 + 4)).join(',')})`;
const PAL = [DAY, DAY.map(dim)],
  LEG = ['#565b66', '#41454e'];
let sheet = null;
// Columns: back, front; rows: day, night.
const sheetOf = () =>
  sheet ||
  (sheet = atlas(2 * CW, 2 * CH, g => {
    for (let l = 0; l < 2; l++)
      for (let k = 0; k < 2; k++) Kit.bake(g, trampolinePixels(k === 1), CW, CH, k * CW, c => PAL[l][c - 1], l * CH);
  }));
// Legs seen under the pad: [dx, dy] from the middle on the floor.
const LEGS = [
  [-6, 1],
  [5, 1],
  [-3, 2],
  [2, 2],
];
// The trampoline on the floor at (x, y), its mat `lift` px up and sagging `dip` px in the middle.
function frame(X, x, y, lift, dip, alpha, front) {
  if (alpha <= 0.01) return;
  const ctx = X.ctx,
    n = X.night ? 1 : 0;
  ctx.globalAlpha = Math.min(1, alpha);
  if (!front) {
    if (lift > 2) {
      ctx.beginPath();
      for (const [dx, dy] of LEGS) ctx.rect(x + dx, y + dy - lift + 2, 1, lift - 2);
      ctx.fillStyle = LEG[n];
      ctx.fill();
    }
    X.stamp(sheetOf(), 0, n * CH, CW, CH, x - CX, y - lift - CY - 1, CW, CH);
    // the sag: a darker hollow round the feet
    if (dip > 0) {
      ctx.fillStyle = DAY[0];
      ctx.fillRect(x - 3, y - lift - 1, 5, Math.min(3, dip));
      ctx.fillRect(x - 5, y - lift, 9, 1);
    }
  } else X.stamp(sheetOf(), CW, n * CH, CW, CH, x - CX, y - lift - CY - 1, CW, CH);
  ctx.globalAlpha = 1;
}
// Its shadow on the floor, under the frame.
function frameShadow(X, x, y, alpha) {
  if (alpha <= 0.01) return;
  const ctx = X.ctx;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.rect(x - 6, y - 2, 11, 4);
  ctx.rect(x - 8, y - 1, 15, 3);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// shortcut: read every frame, so an early re-aim to the other side flips the somersault in one frame.
const side = X => (X.dir1[0] >= 0 ? 1 : -1),
  hump = len => Math.min(110, Math.max(44, 30 + 3 * (len || 0))),
  flips = len => ((len || 0) < 14 ? 1 : 2),
  bouncesOf = X => (X.L.hide ? HIDDEN : X.tp.stool ? STOOL : BOUNCES),
  rise0 = X => (X.tp.stool ? SQUEEZE : B.RISE),
  // back-out: a spring past its rest, then settling
  boing = k => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;

// The picture at core v: feet, pose, legs and turn of the body; the trampoline's lift, sag and alpha; ground point
// and the feet's height over it.
const P = { fx: 0, fy: 0, pose: 'stand', legs: 1, rot: 0, a: 1, lift: 0, dip: 0, ta: 1, gx: 0, gy: 0, h: 0 },
  Q = { ...P };
function origin(X, v, p) {
  const list = bouncesOf(X),
    hide = X.L.hide,
    r0 = rise0(X),
    // a cut sinks the trampoline from where it stood over the whole rewind, not at the rewound clock's pace
    kv = X.L.cut ? core(X.tp.cut, X.L.d) : v;
  p.gx = X.tx0;
  p.gy = X.ty0;
  p.fx = X.x0;
  p.a = hide ? r(v, L_IN, L_IN + B.SHOW) : 1;
  p.ta = hide ? p.a : r(kv, r0, r0 + B.SHOW);
  const k = hide ? 1 : r(kv, r0, r0 + (X.tp.stool ? 0.04 : B.UP - B.RISE));
  p.lift = Math.round(RIM * (k > 0 ? boing(k) : 0));
  p.dip = 0;
  p.rot = 0;
  p.legs = 1;
  p.pose = 'stand';
  let h = 0;
  for (const [b0, b1, top] of list) {
    if (v < b0 || v >= b1) continue;
    const s = r(v, b0, b1),
      ct = top ? 0.3 : 1;
    if (s < ct) {
      const c = Math.sin(Math.PI * (s / ct));
      p.dip = Math.round((top ? DIP[0] : DIP[1]) * c);
      p.legs = 1 - (top ? 0.3 : 0.45) * c;
    } else {
      const q = (s - ct) / (1 - ct);
      h = top * 4 * q * (1 - q);
      if (top > 10 && q > 0.2 && q < 0.85) p.pose = 'up';
    }
  }
  // a stool sitter stays put until the trampoline is under them; a cut lowers them with the fading trampoline
  if (X.tp.stool && kv < r0) p.lift = 0;
  if (X.L.cut) {
    p.lift = Math.round(p.lift * X.L.C);
    h *= X.L.C;
  }
  p.fy = X.y0 - p.lift + p.dip - Math.round(h);
  p.h = p.lift - p.dip + h;
  return p;
}
// The flight at trip fraction t: ballistic, the ground point straight on, the height a parabola over the launch.
function arc(X, t, p) {
  const H = hump(X.tp.len);
  p.gx = lerp(X.tx0, X.tx1, t);
  p.gy = lerp(X.ty0, X.ty1, t);
  p.h = lerp(RIM, 0, t) + 4 * H * t * (1 - t);
  p.fx = Math.round(lerp(X.x0, X.x1, t));
  p.fy = Math.round(lerp(X.y0, X.y1, t) - p.h);
  return p;
}
function flight(X, t, p) {
  arc(X, t, p);
  p.a = 1;
  p.dip = 0;
  p.legs = 1;
  p.rot = 0;
  p.pose = t < B.FLIP0 ? 'up' : 'stand';
  const f = r(t, B.FLIP0, B.FLIP1);
  if (f > 0 && f < 1) {
    // a tucked somersault, head first the way they go, in quarter turns
    const n = flips(X.tp.len),
      q = Math.floor(ease(f) * 4 * n);
    p.rot = (((side(X) * q) % 4) + 4) % 4;
    p.legs = 0.5;
    p.pose = 'up';
  }
  return p;
}
function arrival(X, v, p) {
  p.gx = X.tx1;
  p.gy = X.ty1;
  p.fx = X.x1;
  p.a = 1;
  p.rot = 0;
  const c = r(v, ARR, B.LAND),
    up = r(v, B.LAND, B.POP);
  p.legs = c < 1 ? 1 - 0.45 * Math.sin(Math.PI * Math.sqrt(c)) : 1;
  p.h = Math.round(4 * Math.sin(Math.PI * up));
  p.fy = X.y1 - p.h;
  p.pose = v >= B.LAND && v < B.DOWN ? 'up' : 'stand';
  return p;
}
function picture(X, v, p = P) {
  if (v >= ARR) return arrival(X, v, p);
  if (v >= DEP) return flight(X, r(v, DEP, ARR), p);
  return origin(X, v, p);
}
// Seconds since the launch (negative before), pure in the clock.
const since = X => X.L.secs - real(DEP, X.L.d);
// The left-behind trampoline: lift, sag and alpha after the launch.
function folding(X, p) {
  const el = since(X),
    w = r(el, 0, FOLD.WOBBLE);
  p.dip = Math.round(DIP[1] * Math.cos(Math.PI * 5 * w) * (1 - w) * (el > 0 ? 1 : 0));
  p.lift = Math.round(RIM * (1 - ease(r(el, FOLD.WOBBLE, FOLD.SINK))));
  p.ta = 1 - r(el, FOLD.SINK - 0.06, FOLD.GONE);
  return p;
}

// Dots on the arc behind them, spawned on a fixed beat of the clock (a crowd skips every other one).
const RATE = 40,
  DOT = [];
function wake(X) {
  const L = X.L,
    tp = X.tp;
  DOT.length = 0;
  for (let i = Math.floor(L.secs * RATE); i > (L.secs - TRAIL) * RATE; i--) {
    const v = core(i / RATE, tp.d);
    if ((X.lite && i % 2) || v < DEP + 0.004 || v >= ARR - 0.004) continue;
    const q = arc(X, r(v, DEP, ARR), Q),
      age = (L.secs - i / RATE) / TRAIL;
    if (age < 0.85) DOT.push(q.fx, q.fy - 9);
  }
  return DOT;
}
const WAKE = ['#ffffff', '#d6e4ff'];
function dots(X, list, alpha) {
  const ctx = X.ctx;
  if (!list.length) return;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  for (let j = 0; j < list.length; j += 2) ctx.rect(list[j], list[j + 1], 1, 1);
  ctx.fillStyle = WAKE[X.night ? 1 : 0];
  ctx.fill();
  ctx.globalAlpha = 1;
}

const GOLD = ['#ffc21f', '#ffe07a'],
  WHITE = ['#fffbe6', '#ffffff'],
  ST = [];
// Four-point stars (x, y, size): gold arms in one fill, white hearts in another.
function stars(X, list, alpha) {
  const ctx = X.ctx;
  if (!list.length || alpha <= 0.01) return;
  ctx.globalAlpha = Math.min(1, alpha);
  for (let l = 0; l < 2; l++) {
    ctx.beginPath();
    for (let j = 0; j < list.length; j += 3) {
      const x = list[j],
        y = list[j + 1],
        n = list[j + 2];
      if (l) ctx.rect(x, y, 1, 1);
      else if (n > 0) {
        ctx.rect(x - n, y, 2 * n + 1, 1);
        ctx.rect(x, y - n, 1, 2 * n + 1);
      }
    }
    ctx.fillStyle = (l ? WHITE : GOLD)[X.night ? 1 : 0];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// The ta-da: stars popping out round the raised hands, twinkling.
function tada(X, p, v) {
  const k = r(v, B.LAND, B.DOWN + 0.04);
  if (k <= 0 || k >= 1) return;
  ST.length = 0;
  const n = 5,
    d = 8 + 7 * out2(r(k, 0, 0.35));
  for (let j = 0; j < n; j++) {
    if (X.lite && j % 2) continue;
    const ang = Math.PI * (1.08 + (0.84 * j) / (n - 1)),
      tw = (j + Math.floor(X.L.secs * 10)) % 3,
      size = k < 0.25 ? 2 : tw === 0 ? 0 : 1;
    ST.push(Math.round(p.fx + d * Math.cos(ang)), Math.round(p.fy - 14 + 0.8 * d * Math.sin(ang)), size);
  }
  stars(X, ST, X.L.C * (1 - in2(r(k, 0.6, 1))));
}

// Dust kicked out round a point on the floor: tufts over an ellipse, lit on top.
const DUST = [
  ['#d9cfbb', '#fbf6ea'],
  ['#8f897e', '#c9c2b4'],
  ['#8496ad', '#b9c7d8'],
];
function puff(X, end, p, w) {
  if (p <= 0 || p >= 1) return;
  const ctx = X.ctx,
    fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0,
    snowy = X.snow > 0 && (end ? outdoors(X.tx1, X.ty1) : outdoors(X.tx0, X.ty0)),
    col = DUST[snowy ? 2 : X.night ? 1 : 0],
    n = 8,
    d = w + 9 * out2(p),
    lift = Math.round(3 * p);
  ctx.globalAlpha = 0.9 * (1 - in2(p)) * X.L.C;
  for (let l = 0; l < 2; l++) {
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      // a crowd skips every other tuft, so none moves when it starts or ends
      if (X.lite && k % 2) continue;
      const ang = (k / n) * 2 * Math.PI + X.hash(k, 5),
        x = Math.round(fx + d * Math.cos(ang)) - 1,
        y = Math.round(fy + 0.45 * d * Math.sin(ang)) - 1 - lift;
      if (l) ctx.rect(x, y - 1, 2, 1);
      else ctx.rect(x - 1, y - 1, 4, 3);
    }
    ctx.fillStyle = col[l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// The launch: streaks shooting up off the mat after them, and the springs' twang at the rim.
function whoosh(X, el) {
  const k = r(el, 0, 0.22);
  if (k <= 0 || k >= 1) return;
  const ctx = X.ctx,
    x = X.x0,
    y = X.y0 - RIM - 4 - Math.round(26 * out2(k)),
    n = Math.round(6 * (1 - k)) + 2,
    w = 9 + Math.round(2 * k);
  ctx.globalAlpha = 0.9 * (1 - in2(k));
  ctx.beginPath();
  for (const dx of [-4, 0, 4]) ctx.rect(x + dx, y + (dx ? 3 : 0), 1, n - (dx ? 2 : 0));
  for (const sx of [-1, 1]) {
    ctx.rect(x + sx * w, X.y0 - RIM - 5, 1, 3);
    ctx.rect(x + sx * (w + 2) - (sx < 0 ? 1 : 0), X.y0 - RIM - 1, 2, 1);
  }
  ctx.fillStyle = WAKE[X.night ? 1 : 0];
  ctx.fill();
  ctx.globalAlpha = 1;
}

const O = { pose: 'stand', front: true, alpha: 1, legs: null, rot: null };
// On their own feet with no remap: drawn in place, so the page's own shadow comes with it.
const own = (X, p, end) => p.legs >= 1 && !p.rot && p.fx === (end ? X.x1 : X.x0) && p.fy === (end ? X.y1 : X.y0);
function body(X, p, end) {
  O.pose = p.pose;
  // they keep their facing until the trampoline lifts them, and again once the arms come down for the walker
  const L = X.L;
  O.front = L.sw && L.v >= B.DOWN ? null : L.sw || L.hide || L.v >= B.RISE + 0.04 ? true : null;
  O.alpha = Math.min(1, p.a);
  O.legs = p.legs < 1 ? p.legs : null;
  O.rot = p.rot || null;
  if (own(X, p, end)) X.body(O);
  else X.bodyAt(p.fx, p.fy, O);
}

const PART = Kit.PART;
export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q || v >= REL) return 0;
    if (L.hide) {
      if (!L.sw) return v < L_IN ? 0 : PART.TRIP | PART.SHADOW;
      return (L.trip >= 0 ? PART.TRIP | PART.SHADOW : 0) | (v >= ARR ? PART.F1 : 0);
    }
    let n = 0;
    // the trampoline at the origin, from its rise until it has folded into the floor and its dust settled
    // a cut keeps it while it sinks with the rewind
    const kv = L.cut ? core(X.tp.cut, L.d) : v;
    if (!L.sw ? kv >= rise0(X) : since(X) < FOLD.DUST) n |= PART.B0 | PART.F0 | PART.S0;
    if (L.trip >= 0) n |= PART.TRIP | PART.SHADOW;
    if (L.sw && v >= ARR) n |= PART.F1;
    return n;
  },
  back(X, end) {
    if (end) return;
    const L = X.L,
      p = L.sw ? folding(X, Q) : origin(X, L.v, Q);
    frame(X, X.x0, X.y0, p.lift, p.dip, p.ta * L.C, false);
  },
  stand(X, end) {
    if (end) return;
    const L = X.L,
      p = L.sw ? folding(X, Q) : origin(X, L.v, Q);
    frame(X, X.x0, X.y0, p.lift, p.dip, p.ta * L.C, true);
    if (L.sw) whoosh(X, since(X));
  },
  floor(X, end) {
    const L = X.L,
      v = L.v;
    if (!end) {
      const p = L.sw ? folding(X, Q) : origin(X, v, Q);
      frameShadow(X, X.x0, X.y0, p.ta * L.C * Math.min(1, p.lift / 2));
      // the feet's shadow while the body is remapped on the mat
      if (!L.sw && !own(X, p, 0)) Kit.shadow(X.ctx, X.x0, X.y0, 12, 0.6);
      if (!L.sw) puff(X, 0, r(v, rise0(X), rise0(X) + 0.12), 6);
      else puff(X, 0, r(since(X), FOLD.SINK - 0.08, FOLD.DUST), 7);
      return;
    }
    const p = arrival(X, v, Q);
    if (!own(X, p, 1)) Kit.shadow(X.ctx, X.x1, X.y1, 16 - p.h, 0.9 - p.h / 20);
    puff(X, 1, r(v, ARR, ar(0.42)), 5);
  },
  trip(X) {
    const L = X.L;
    if (!L.sw) {
      // a hidden start: the trampoline outside the stall, drawn here as one picture with them
      const p = origin(X, L.v, P);
      frame(X, X.x0, X.y0, p.lift, p.dip, p.ta, false);
      body(X, p, 0);
      frame(X, X.x0, X.y0, p.lift, p.dip, p.ta, true);
      return;
    }
    if (L.hide) {
      // this item rises into the overlay with the flier: the trampoline goes in a puff while they are still low
      const h = arc(X, L.trip, Q).h,
        k = r(h, 8, LOW),
        f = folding(X, Q);
      if (k < 1) {
        frame(X, X.x0, X.y0, Math.round(f.lift * (1 - k)), f.dip, 1 - k, false);
        frame(X, X.x0, X.y0, Math.round(f.lift * (1 - k)), f.dip, 1 - k, true);
        puff(X, 0, 0.15 + 0.6 * k, 5);
      }
    }
    dots(X, wake(X), 0.75);
    body(X, flight(X, L.trip, P), 1);
  },
  // The feet's ground point and real height: low on the mat and over the landing, so they sort with the furniture.
  ground(X, out) {
    const p = picture(X, X.L.v, Q);
    out[0] = p.gx;
    out[1] = p.gy;
    out[2] = Math.max(0, p.h);
    if (X.L.hide && !X.L.sw) out[3] = p.a; // the shadow fades in with them
    return true;
  },
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || (L.sw && v >= REL)) return false;
    if ((L.hide && !L.sw) || (L.sw && v < ARR)) return true;
    if (!L.sw) {
      const p = origin(X, v, P);
      // the walker seats a stool sitter again once a cut has lowered the trampoline to the floor
      if (X.tp.stool && v < rise0(X) && p.lift === 0) return false;
      body(X, p, 0);
      return true;
    }
    const p = arrival(X, v, P);
    body(X, p, 1);
    tada(X, p, v);
    return true;
  },
  gap: null,
};
// Exposed for tests.
export const TRAMPOLINE = {
  B,
  BOUNCES,
  STOOL,
  HIDDEN,
  FOLD,
  RIM,
  hump,
  flips,
  picture,
  folding,
  wake,
  need: STYLE.need,
};
