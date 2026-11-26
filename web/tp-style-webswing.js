// webswing: they raise a hand and shoot a thin thread up into the sky ahead, crouch and swing off on it. They cross the
// island swing by swing, dropping low under each hanging point and rising at its end, letting go and catching the next
// thread; over the landing they let go, tuck a somersault and land crouched in a puff of dust, then stand. The thread
// is plain white and the person keeps their own clothes. Body and thread are one picture: person() at both ends,
// trip() in flight and for a hidden start. ground() reports the real height. One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { outdoors } from './office-scene.js';

const { r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR, T } = TeleportLogic;
const { RELEASE: REL, L_IN } = T,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  B = {
    SIT: at(0.1), // a stool sitter stands up on the stool
    AIM: at(0.08), // a hand goes up ...
    SHOOT: [at(0.22), at(0.42)], // ... and the thread shoots up to its hanging point
    CROUCH: [at(0.48), at(0.74)],
    LEAP: at(0.76),
    GROW: 0.14, // a swing's fraction the next thread takes to reach its point
    FLIP: [ARR, ar(0.3)], // let go: a tucked somersault on the way down
    LAND: ar(0.3), // touchdown, crouched
    UP: ar(0.55), // standing
  },
  H0 = 14, // px the feet are off the floor at the end of the leap
  ARRH = 34, // ... where they let go over the landing
  DIP = 24, // px a swing drops under its ends
  OVER = 40, // px at least the hanging points are over the hand at either end of their swing
  HAND = 21, // px from the feet up to a raised hand
  PUFF = 0.35; // s a dust puff lasts

const cruise = len => Math.min(96, Math.max(40, 22 + 2.6 * (len || 0))),
  // swings across, read from the current tp every frame (a re-aim retimes the trip)
  swings = len => Math.min(4, Math.max(1, Math.round((len || 0) / 9))),
  perch = stool => (stool === 2 ? 9 : stool ? 4 : 0),
  side = X => (X.x1 >= X.x0 ? 1 : -1),
  // shortcut: read every frame, so an early re-aim the other way turns them in one frame; tp has no fixed facing.
  facing = X => X.y1 >= X.y0;
// The flight's height at chord fraction c where one swing hands over to the next.
const high = (X, c) => lerp(H0, ARRH, c) + cruise(X.tp.len) * Math.sin(Math.PI * c);
// Hand height on screen at chord fraction c, at a hand-over.
const handY = (X, c) => lerp(X.y0, X.y1, c) - high(X, c) - HAND;
// Hanging point k: over the middle of swing k, high enough over the hand at both its ends that a thread never runs
// flatter than about 38 degrees (tan 0.8).
function anchor(X, k, out) {
  const n = swings(X.tp.len),
    c = (k + 0.5) / n,
    half = Math.abs(X.x1 - X.x0) / (2 * n);
  out[0] = Math.round(lerp(X.x0, X.x1, c));
  out[1] = Math.max(8, Math.round(Math.min(handY(X, k / n), handY(X, (k + 1) / n)) - Math.max(OVER, 0.8 * half)));
  return out;
}
const AN = [0, 0];

// The picture at core v: feet, pose, facing, legs, turn and alpha; the raised hand, the thread's point, how far the
// thread has grown and its alpha; ground point and height.
const P = {
    fx: 0,
    fy: 0,
    pose: 'stand',
    front: null,
    legs: 1,
    rot: 0,
    a: 1,
    hx: 0,
    hy: 0,
    ax: 0,
    ay: 0,
    tl: 0,
    ta: 0,
    gx: 0,
    gy: 0,
    h: 0,
  },
  Q = { ...P };
function reset(p) {
  p.pose = 'stand';
  p.front = null;
  p.legs = 1;
  p.rot = 0;
  p.a = 1;
  p.tl = p.ta = 0;
}
// A raised hand on the side they go, and the thread to hanging point k.
function hold(X, p, k, grown) {
  const an = anchor(X, k, AN);
  p.pose = 'up';
  p.hx = p.fx + 3 * side(X);
  p.hy = p.fy - HAND;
  p.ax = an[0];
  p.ay = an[1];
  p.tl = grown;
  p.ta = 1;
}
function origin(X, v, p) {
  const stool = X.tp.stool,
    base = perch(stool);
  p.gx = X.tx0;
  p.gy = X.ty0;
  p.fx = X.x0;
  if (X.L.hide) {
    p.h = H0;
    p.fy = X.y0 - H0;
    p.a = r(v, L_IN, DEP - 0.03);
    p.front = facing(X);
    hold(X, p, 0, 1);
    p.ta = p.a;
    return p;
  }
  const crouch = Math.sin(Math.PI * r(v, B.CROUCH[0], B.LEAP)),
    up = r(v, B.LEAP, DEP);
  p.legs = 1 - 0.4 * crouch;
  p.h = lerp(base, H0, up * (1.4 - 0.4 * up));
  p.fy = X.y0 - Math.round(p.h);
  if (stool && v < B.SIT) {
    // a sitter is drawn at the floor point: the page lifts a sitter onto the stool itself
    p.pose = stool === 2 ? 'sitHigh' : 'sit';
    p.fy = X.y0;
    return p;
  }
  if (v >= B.AIM) {
    p.front = facing(X);
    hold(X, p, 0, ease(r(v, B.SHOOT[0], B.SHOOT[1])));
    if (v < B.SHOOT[0]) p.ta = 0;
  }
  return p;
}
// Swing by swing: along the chord, fastest at the bottom of each, low in its middle and high at its ends.
function flight(X, v, p) {
  const t = r(v, DEP, ARR),
    n = swings(X.tp.len),
    k = Math.min(n - 1, Math.floor(t * n)),
    s = t * n - k,
    c = (k + ease(s)) / n,
    h0 = high(X, k / n),
    h1 = high(X, (k + 1) / n),
    // a short single swing must not touch the floor
    dip = Math.min(DIP, Math.min(h0, h1) - 4);
  p.gx = lerp(X.tx0, X.tx1, c);
  p.gy = lerp(X.ty0, X.ty1, c);
  p.h = lerp(h0, h1, s) - dip * Math.sin(Math.PI * s);
  p.fx = Math.round(lerp(X.x0, X.x1, c));
  p.fy = Math.round(lerp(X.y0, X.y1, c) - p.h);
  p.front = facing(X);
  // past the first swing the next thread shoots out as they let go of the last
  hold(X, p, k, k ? ease(r(s, 0, B.GROW)) : 1);
  if (k) p.legs = 1 - 0.3 * Math.sin(Math.PI * r(s, 0, B.GROW));
  return p;
}
function arrival(X, v, p) {
  const f = r(v, B.FLIP[0], B.FLIP[1]),
    land = r(v, B.LAND, B.UP);
  p.gx = X.tx1;
  p.gy = X.ty1;
  p.fx = X.x1;
  p.h = ARRH * (1 - in2(f));
  p.fy = X.y1 - Math.round(p.h);
  p.front = v < B.UP ? facing(X) : null;
  if (f < 1) {
    // a tucked somersault, head first the way they go, in quarter turns
    const q = Math.floor(ease(f) * 4);
    p.rot = (((side(X) * q) % 4) + 4) % 4;
    p.legs = 0.5;
    p.pose = 'up';
    return p;
  }
  p.legs = 1 - 0.4 * (1 - ease(land));
  return p;
}
function picture(X, v, p = P) {
  reset(p);
  if (v >= ARR) return arrival(X, v, p);
  if (v >= DEP) return flight(X, v, p);
  return origin(X, v, p);
}

// The thread from the hand towards its point, `tl` of the way there: one rect per column it crosses, a grey edge
// beside a white core so it shows on snow and pale floors.
const THREAD = [
  ['#7f8aa0', '#fbfcff'],
  ['#3a4258', '#d9e1f2'],
];
function thread(X, p, alpha) {
  if (p.tl <= 0 || alpha <= 0.01) return;
  const ctx = X.ctx,
    x1 = Math.round(lerp(p.hx, p.ax, p.tl)),
    y1 = Math.round(lerp(p.hy, p.ay, p.tl)),
    n = Math.abs(x1 - p.hx) + 1,
    dy = (y1 - p.hy) / n,
    sx = x1 >= p.hx ? 1 : -1;
  ctx.globalAlpha = Math.min(1, alpha) * 0.9;
  for (let l = 0; l < 2; l++) {
    ctx.beginPath();
    for (let j = 0; j < n; j++) {
      const ya = Math.round(p.hy + dy * j),
        yb = Math.round(p.hy + dy * (j + 1));
      ctx.rect(p.hx + sx * j + (l ? 0 : 1), Math.min(ya, yb) + (l ? 0 : 1), 1, Math.abs(yb - ya) + 1);
    }
    ctx.fillStyle = THREAD[X.night ? 1 : 0][l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// Dust kicked out round a point on the floor; a crowd skips every other tuft, so none moves when it starts or ends.
const DUST = [
  ['#d9cfbb', '#fbf6ea'],
  ['#8f897e', '#c9c2b4'],
  ['#8496ad', '#b9c7d8'],
];
function puff(X, end, age) {
  if (age <= 0 || age >= PUFF) return;
  const ctx = X.ctx,
    p = age / PUFF,
    fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0,
    snowy = X.snow > 0 && (end ? outdoors(X.tx1, X.ty1) : outdoors(X.tx0, X.ty0)),
    col = DUST[snowy ? 2 : X.night ? 1 : 0],
    n = 8,
    d = 4 + 10 * out2(p),
    lift = Math.round(3 * p);
  ctx.globalAlpha = 0.9 * (1 - in2(p)) * X.L.C;
  for (let l = 0; l < 2; l++) {
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
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
const since = (X, c) => TeleportLogic.real(X.L.v, X.L.d) - TeleportLogic.real(c, X.L.d);

const O = { pose: 'stand', front: null, alpha: 1, legs: 1, rot: 0 };
// Body, then the thread up from the hand. A cut fades the thread; the person keeps the pose's alpha.
function draw(X, p) {
  if (p.a <= 0.01) return;
  O.pose = p.pose;
  O.front = p.front;
  O.legs = p.legs;
  O.rot = p.rot;
  O.alpha = Math.min(1, p.a);
  X.bodyAt(p.fx, p.fy, O);
  thread(X, p, p.ta * X.L.C);
}
// The shadow under the feet while the remapped body (which has none) stands or rises low.
function shade(X, end, h) {
  Kit.shadow(X.ctx, end ? X.x1 : X.x0, end ? X.y1 : X.y0, 14 - h / 4, Math.max(0, 0.9 - h / 50));
}

const PART = Kit.PART;
export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q || v >= REL || (L.hide && !L.sw && v < L_IN)) return 0;
    let n = 0;
    if (L.trip >= 0 || (L.hide && !L.sw)) n |= PART.TRIP | PART.SHADOW;
    if (!L.hide && (!L.sw || since(X, B.LEAP) < PUFF)) n |= PART.F0;
    if (L.sw && v >= ARR) n |= PART.F1;
    return n;
  },
  floor(X, end) {
    const L = X.L;
    if (end) {
      shade(X, 1, picture(X, L.v, Q).h);
      puff(X, 1, since(X, B.LAND));
      return;
    }
    if (!L.sw) shade(X, 0, picture(X, L.v, Q).h - perch(X.tp.stool));
    puff(X, 0, since(X, B.LEAP));
  },
  trip(X) {
    draw(X, picture(X, X.L.v));
  },
  // The ground point under the feet and the real height: low at both ends, so it sorts with the furniture there.
  ground(X, out) {
    const p = picture(X, X.L.v);
    out[0] = p.gx;
    out[1] = p.gy;
    out[2] = p.h;
    if (X.L.hide && !X.L.sw) out[3] = p.a; // the shadow fades in with them
    return true;
  },
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || (L.sw && v >= REL)) return false;
    if (L.trip >= 0 || (L.hide && !L.sw) || (L.sw && v < ARR)) return true;
    draw(X, picture(X, v));
    return true;
  },
  marks: [],
  gap: null,
};
// Exposed for tests.
export const WEBSWING = { B, H0, ARRH, DIP, HAND, cruise, swings, picture, need: STYLE.need };
