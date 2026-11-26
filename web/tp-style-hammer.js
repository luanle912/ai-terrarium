// hammer: a long-handled steel hammer sparks into their hand; they whirl it overhead and hurl it into the sky, crouch
// and leap after it. In flight they chase it arms up, the hammer spinning ahead and shedding sparks, until they catch
// it and come down holding it high. As the feet touch the floor a bolt of lightning strikes the floor beside them: a
// flash ring, crackles round them and sparks running out over the floor; they lower it and it fades away in a
// glint. Body, hammer and bolt are one picture: person() at both ends, trip() in flight and for a hidden start (who
// flies holding it). ground() reports the real height. One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';

const { atlas, r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR, T, core, real } = TeleportLogic;
const { RELEASE: REL, L_IN } = T,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  B = {
    SIT: at(0.12), // a stool sitter stands up on the stool
    SUMMON: [at(0.03), at(0.16)], // the hammer sparks into their hand
    WIND: [at(0.22), at(0.5)], // whirled overhead ...
    THROW: at(0.5), // ... and hurled up
    CROUCH: [at(0.54), at(0.74)],
    LEAP: at(0.78),
    CATCH: [0.58, 0.76], // trip fractions: the hammer comes back into their hand
    HIT: ar(0.2), // touchdown, and the strike
    LOWER: ar(0.5), // the hammer comes down ...
    GONE: [ar(0.6), ar(0.8)], // ... and fades in a glint
  },
  H0 = 24, // px the feet are off the floor at the end of the leap
  ARRH = 30, // ... as they come in over the landing
  HAND = 21, // px from the feet up to a raised hand (the grip)
  EXH = 110, // px the thrown hammer is over their raised hand at the switch
  LEAD = 0.14, // the trip fraction it flies ahead of them
  BOLT = 0.28, // s the lightning lasts
  CRACKLE = 0.45, // s the crackles round them last
  RING = 0.3, // s the flash ring lasts
  RUN = 0.5; // s the sparks run over the floor

// The hammer raster in 8 turns (0: head up, then clockwise by 45 deg), the grip at the cell's middle.
// 1 rim, 2 wood, 3 wood dark, 4 steel, 5 steel light, 6 steel dark, 7 copper band.
const CELL = 30,
  MID = 15;
export function hammerPixels(k) {
  const px = new Uint8Array(CELL * CELL),
    th = (k * Math.PI) / 4,
    ux = Math.sin(th),
    uy = -Math.cos(th),
    part = (x, y) => {
      const qx = x + 0.5 - MID,
        qy = y + 0.5 - MID,
        a = qx * ux + qy * uy,
        b = qx * -uy + qy * ux;
      if (a >= 6.5 && a <= 10.5 && Math.abs(b) <= 3.2) {
        if (Math.abs(b) >= 2.3) return 7;
        return a > 9.3 ? 5 : a < 7.6 ? 6 : 4;
      }
      if (a >= -6.5 && a < 6.5 && Math.abs(b) <= 0.75) return a < -5.4 ? 7 : b > 0 ? 3 : 2;
      return 0;
    };
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      const c = part(x, y);
      if (c) px[y * CELL + x] = c;
      else if (part(x - 1, y) || part(x + 1, y) || part(x, y - 1) || part(x, y + 1)) px[y * CELL + x] = 1;
    }
  return px;
}
const DAY = ['#2b2a33', '#b07a45', '#7a4f2a', '#a9b4c2', '#e4ecf5', '#6d7888', '#d9884a'];
const hex = (c, k) => parseInt(c.slice(1 + 2 * k, 3 + 2 * k), 16);
const dim = c => `rgb(${[0, 1, 2].map(k => Math.round(hex(c, k) * 0.78 + 4)).join(',')})`;
const PAL = [DAY, DAY.map(dim)];
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = atlas(8 * CELL, 2 * CELL, g => {
    for (let l = 0; l < 2; l++)
      for (let k = 0; k < 8; k++) Kit.bake(g, hammerPixels(k), CELL, CELL, k * CELL, c => PAL[l][c - 1], l * CELL);
  }));
// The hammer gripped at (x, y), turned k eighths.
function hammer(X, x, y, k) {
  X.stamp(sheetOf(), (((k % 8) + 8) % 8) * CELL, X.night ? CELL : 0, CELL, CELL, x - MID, y - MID, CELL, CELL);
}

const cruise = len => Math.min(100, Math.max(36, 20 + 2.8 * (len || 0))),
  perch = stool => (stool === 2 ? 9 : stool ? 4 : 0),
  side = X => (X.x1 >= X.x0 ? 1 : -1),
  // shortcut: read every frame, so an early re-aim the other way turns them in one frame; tp has no fixed facing.
  facing = X => X.y1 >= X.y0,
  spin = secs => Math.floor(secs * 26);

// The picture at core v and idle time secs: feet, pose, facing, legs and alpha; the hammer's grip, turn and alpha;
// ground point and height.
const P = { fx: 0, fy: 0, pose: 'stand', front: null, legs: 1, a: 1, hx: 0, hy: 0, k: 0, ha: 1, gx: 0, gy: 0, h: 0 },
  Q = { ...P };
function reset(p) {
  p.pose = 'stand';
  p.front = null;
  p.legs = 1;
  p.a = p.ha = 1;
  p.k = 0;
}
// Held up in a raised hand.
function overhead(p) {
  p.pose = 'up';
  p.hx = p.fx;
  p.hy = p.fy - HAND;
  p.k = 0;
}
function origin(X, v, secs, p) {
  const stool = X.tp.stool,
    s = side(X),
    base = perch(stool);
  p.gx = X.tx0;
  p.gy = X.ty0;
  p.fx = X.x0;
  if (X.L.hide) {
    p.h = H0;
    p.fy = X.y0 - H0;
    p.a = p.ha = r(v, L_IN, DEP - 0.03);
    p.front = facing(X);
    overhead(p);
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
  }
  if (v >= B.WIND[0]) p.front = facing(X);
  p.ha = r(v, B.SUMMON[0], B.SUMMON[1]);
  if (v < B.WIND[0]) {
    // held at their side, its head resting on the floor
    p.hx = p.fx + 6 * s;
    p.hy = p.fy - 8;
    p.k = 4;
  } else if (v < B.THROW) {
    // whirled overhead, faster and faster
    overhead(p);
    p.k = Math.floor(16 * in2(r(v, B.WIND[0], B.THROW)));
  } else {
    // hurled up, spinning, to where the flight takes it on
    const g = out2(r(v, B.THROW, DEP));
    p.hx = X.x0;
    p.hy = Math.round(lerp(X.y0 - base - HAND, X.y0 - H0 - HAND - EXH, g));
    p.k = spin(secs);
    p.pose = v >= B.LEAP ? 'up' : 'stand';
  }
  return p;
}
function flight(X, v, secs, p) {
  const t = r(v, DEP, ARR),
    e = ease(t),
    cr = cruise(X.tp.len),
    hide = X.L.hide,
    yAt = q => Math.round(lerp(X.y0, X.y1, ease(q)) - lerp(H0, ARRH, q) - cr * Math.sin(Math.PI * q));
  p.gx = lerp(X.tx0, X.tx1, e);
  p.gy = lerp(X.ty0, X.ty1, e);
  p.h = lerp(H0, ARRH, t) + cr * Math.sin(Math.PI * t);
  p.fx = Math.round(lerp(X.x0, X.x1, e));
  p.fy = Math.round(lerp(X.y0, X.y1, e) - p.h);
  p.front = facing(X);
  overhead(p);
  if (hide) return p;
  // the hammer ahead of them on the same arc, dropping from high up into their hand
  const lead = LEAD * r(t, 0, 0.25) * (1 - ease(r(t, B.CATCH[0], B.CATCH[1]))),
    q = Math.min(1, t + lead),
    ex = EXH * (1 - ease(r(t, 0, 0.3))) + 10 * Math.sin(Math.PI * r(t, 0.2, B.CATCH[1]));
  p.hx = Math.round(lerp(X.x0, X.x1, ease(q)));
  p.hy = yAt(q) - HAND - Math.round(ex);
  p.k = t < B.CATCH[1] ? spin(secs) : 0;
  return p;
}
function arrival(X, v, secs, p) {
  const ageHit = real(v, X.L.d) - real(B.HIT, X.L.d);
  p.gx = X.tx1;
  p.gy = X.ty1;
  p.fx = X.x1;
  p.h = ARRH * (1 - in2(r(v, ARR, B.HIT)));
  p.fy = X.y1 - Math.round(p.h);
  p.front = v < B.LOWER ? facing(X) : null;
  p.legs = 1 - 0.35 * Math.sin(Math.PI * r(ageHit, 0, 0.2));
  overhead(p);
  if (v >= B.LOWER) {
    // lowered to their side, then gone in a glint
    p.pose = 'stand';
    p.hx = p.fx + 6 * side(X);
    p.hy = p.fy - 8;
    p.k = 4;
    p.ha = 1 - r(v, B.GONE[0], B.GONE[1]);
  }
  // their own facing once the hammer comes down, the one the walker goes on with
  return p;
}
function picture(X, v, secs, p = P) {
  reset(p);
  if (v >= ARR) return arrival(X, v, secs, p);
  if (v >= DEP) return flight(X, v, secs, p);
  return origin(X, v, secs, p);
}

// A jagged line as vertical runs (a steep line costs one rect per column it crosses), w px wide.
function jag(ctx, x0, y0, x1, y1, w) {
  const n = Math.abs(x1 - x0) + 1,
    dy = (y1 - y0) / n,
    sx = x1 >= x0 ? 1 : -1;
  for (let j = 0; j < n; j++) {
    const ya = Math.round(y0 + dy * j),
      yb = Math.round(y0 + dy * (j + 1));
    ctx.rect(x0 + sx * j - (w >> 1), Math.min(ya, yb), w, Math.abs(yb - ya) + 1);
  }
}
// The bolt from the sky down to (x, y), re-jagged on a flicker beat: a pale glow and a white core.
const BOLTC = [
    ['#9fd4ff', '#ffffff'],
    ['#7fb6ff', '#f4f8ff'],
  ],
  JG = [];
function bolt(X, x, y, age, alpha) {
  if (age < 0 || age >= BOLT || alpha <= 0.01) return;
  const ctx = X.ctx,
    beat = Math.floor(age * 30),
    n = 7,
    top = y - 170;
  JG.length = 0;
  for (let j = 0; j <= n; j++) {
    const q = j / n,
      wob = j === 0 || j === n ? 0 : Math.round(12 * (X.hash(beat * 8 + j, 21) - 0.5));
    JG.push(x + wob + Math.round(10 * (1 - q) * (X.hash(beat, 22) - 0.5)), Math.round(lerp(top, y, q)));
  }
  // it blinks: on, off for a beat, on again
  if (beat === 3) return;
  const pal = BOLTC[X.night ? 1 : 0];
  for (let l = 0; l < 2; l++) {
    ctx.globalAlpha = alpha * (l ? 1 : 0.45) * (1 - in2(age / BOLT));
    ctx.beginPath();
    for (let j = 0; j < n; j++) jag(ctx, JG[2 * j], JG[2 * j + 1], JG[2 * j + 2], JG[2 * j + 3], l ? 1 : 3);
    ctx.fillStyle = pal[l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// Crackles: short zigzags round the body and the hammer, flickering; one fill. A crowd skips every other one.
function crackle(X, p, age, alpha) {
  if (age < 0 || age >= CRACKLE || alpha <= 0.01) return;
  const ctx = X.ctx,
    beat = Math.floor(age * 24),
    n = 8;
  ctx.globalAlpha = alpha * (1 - in2(age / CRACKLE));
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    if (X.lite && k % 2) continue;
    const ang = 2 * Math.PI * (k / n + 0.3 * X.hash(beat * n + k, 23)),
      d = 9 + 4 * X.hash(beat * n + k, 24),
      x = Math.round(p.fx + d * Math.cos(ang)),
      y = Math.round(p.fy - 13 + 1.4 * d * Math.sin(ang));
    ctx.rect(x, y, 2, 1);
    ctx.rect(x + 1, y + 1, 1, 1);
    ctx.rect(x + 2, y + 2, 2, 1);
  }
  ctx.fillStyle = X.night ? '#bfe2ff' : '#e9f6ff';
  ctx.fill();
  ctx.globalAlpha = 1;
}
// The flash ring on the floor and sparks running out over it from the strike.
function ground0(X, cx, cy, age, alpha) {
  const ctx = X.ctx;
  if (age >= 0 && age < RING && alpha > 0.01) {
    const f = age / RING,
      a = Math.round(6 + 20 * out2(f)),
      b = Math.max(2, Math.round(a * 0.45));
    ctx.globalAlpha = alpha * (1 - f);
    for (let l = 0; l < 2; l++) {
      ctx.beginPath();
      Kit.ellipse(a - l, Math.max(1, b - l), (x, y) => ctx.rect(cx + x, cy + y, 1, 1));
      ctx.fillStyle = l ? '#ffffff' : '#6fc0ff';
      ctx.fill();
    }
  }
  if (age < 0 || age >= RUN || alpha <= 0.01) return;
  const f = age / RUN,
    n = 9;
  ctx.globalAlpha = alpha * (1 - in2(f));
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    if (X.lite && k % 2) continue;
    const ang = (2 * Math.PI * (k + 0.5 * X.hash(k, 25))) / n,
      d = 5 + 22 * out2(f) * (0.6 + 0.4 * X.hash(k, 26)),
      x = Math.round(cx + d * Math.cos(ang)),
      y = Math.round(cy + 0.45 * d * Math.sin(ang)),
      z = Math.floor(age * 30 + k) % 2;
    ctx.rect(x, y - z, 2, 1);
    ctx.rect(x - Math.sign(Math.cos(ang)) * 2, y - 1 + z, 2, 1);
  }
  ctx.fillStyle = X.night ? '#9fd4ff' : '#5fb2ff';
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Sparks shed by the spinning hammer: dots dropped on a beat where it was, falling and going out. Pure in the clock.
const RATE = 24,
  LIFE = 0.35,
  SP = [];
function sparks(X) {
  const L = X.L,
    tp = X.tp;
  SP.length = 0;
  if (L.cut) return SP;
  for (let i = Math.floor(L.secs * RATE); i > (L.secs - LIFE) * RATE; i--) {
    if (X.lite && i % 2) continue;
    const ts = i / RATE,
      v = core(ts, tp.d),
      t = r(v, DEP, ARR);
    if (L.hide || v < B.THROW || t >= B.CATCH[1]) continue;
    const q = picture(X, v, ts, Q),
      age = L.secs - ts,
      ang = (q.k * Math.PI) / 4;
    SP.push(
      Math.round(q.hx + 9 * Math.sin(ang) + 4 * (X.hash(i, 27) - 0.5)),
      Math.round(q.hy - 9 * Math.cos(ang) + 140 * age * age + 3 * (X.hash(i, 28) - 0.5)),
    );
  }
  return SP;
}
// Glints at the hammer as it sparks in and as it goes.
function glint(X, x, y, g, alpha) {
  if (g <= 0 || g >= 1 || alpha <= 0.01) return;
  const ctx = X.ctx,
    n = Math.round(1 + 3 * Math.sin(Math.PI * g));
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.rect(x - n, y, 2 * n + 1, 1);
  ctx.rect(x, y - n, 1, 2 * n + 1);
  ctx.fillStyle = '#fffbe0';
  ctx.fill();
  ctx.globalAlpha = 1;
}

const O = { pose: 'stand', front: null, alpha: 1, legs: 1 };
// The whole picture at one depth: sparks, the hammer behind or in front of the body by facing, the bolt and the
// crackles last. A cut fades the hammer and the lightning; the person keeps the pose's alpha.
function draw(X, p, end) {
  const L = X.L,
    C = L.C,
    ctx = X.ctx,
    v = L.v,
    ha = Math.min(1, p.ha) * C,
    front = p.front == null ? !!X.a.dirFront : p.front,
    ageHit = real(v, L.d) - real(B.HIT, L.d);
  if (p.a <= 0.01) return;
  if (L.trip >= 0 || (!L.sw && v >= B.THROW)) {
    const list = sparks(X);
    if (list.length) {
      ctx.globalAlpha = 0.9 * C;
      ctx.beginPath();
      for (let j = 0; j < list.length; j += 2) ctx.rect(list[j], list[j + 1], 1, 1);
      ctx.fillStyle = X.night ? '#ffe08a' : '#ffc93c';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  const put = () => {
    if (ha <= 0.01) return;
    ctx.globalAlpha = ha;
    hammer(X, p.hx, p.hy, p.k);
    ctx.globalAlpha = 1;
  };
  if (!front) put();
  O.pose = p.pose;
  O.front = p.front;
  O.legs = p.legs;
  O.alpha = Math.min(1, p.a);
  X.bodyAt(p.fx, p.fy, O);
  if (front) put();
  if (end === 0 && !L.hide) glint(X, p.hx, p.hy + 6, r(v, B.SUMMON[0], B.SUMMON[1]), C);
  if (end === 1) {
    // into the floor beside them (the ring's middle), not the hammer in their hand
    bolt(X, X.x1 + 16 * side(X), X.y1, ageHit, C);
    crackle(X, p, ageHit, C);
    glint(X, p.hx, p.hy + 6, r(v, B.GONE[0], B.GONE[1]), C);
  }
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
    if (!L.hide && !L.sw) n |= PART.F0;
    if (L.sw && v >= ARR) n |= PART.F1;
    return n;
  },
  floor(X, end) {
    const L = X.L,
      p = picture(X, L.v, L.secs);
    shade(X, end, end ? p.h : p.h - perch(X.tp.stool));
    if (end) ground0(X, X.x1, X.y1, real(L.v, L.d) - real(B.HIT, L.d), L.C);
  },
  trip(X) {
    draw(X, picture(X, X.L.v, X.L.secs), X.L.sw ? -1 : 0);
  },
  // The ground point under the feet and the real height: low at both ends, so it sorts with the furniture there.
  ground(X, out) {
    const p = picture(X, X.L.v, X.L.secs);
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
    draw(X, picture(X, v, L.secs), L.sw ? 1 : 0);
    return true;
  },
  marks: [],
  gap: null,
};
// Exposed for tests.
export const HAMMER = { B, H0, ARRH, HAND, EXH, cruise, picture, sparks, need: STYLE.need };
