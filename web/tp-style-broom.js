// broom: a broom twinkles in beside them and hovers at knee height, they hop on side-saddle as it slides under them
// and wobble up off the floor, fly a wobbly arc over the island shedding golden sparkles from the bristles, touch
// down on the landing and hop off; the broom swings upright and stands there (a lasting mark), then vanishes in a
// twinkle. The rider and broom are one picture: person() draws it at the walker's depth at both ends, trip() in
// flight and for a hidden start. ground() reports the real height, so take-off and touchdown sort with the
// furniture. The standing broom is a stand item at the landing, then the mark. One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { TH, TW, outdoors } from './office-scene.js';

const { atlas, r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR, T, core } = TeleportLogic;
const { RELEASE: REL, L_IN, SQUEEZE } = T,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  B = {
    POOF: at(0.04), // the broom twinkles in beside them ...
    SHOWN: at(0.24), // ... and is all there
    HOP: at(0.42), // they hop up as it slides under them ...
    SEAT: at(0.58), // ... and sit
    LIFT: at(0.66), // the feet leave the floor
    PUFF: at(0.3), // how long a dust puff lasts
    DOWN: ar(0.32), // touchdown on the landing, still seated
    OFF: ar(0.4), // they hop off ...
    STAND: ar(0.54), // ... and stand; the broom has slid aside ...
    UP: ar(0.6), // ... and swings upright
    UPRIGHT: ar(0.82),
  },
  M = { STAY: 1.85, OUT: 0.2, TTL: 2.5 }, // the mark: seconds standing, the fade, gone
  LIFT = 10, // px the feet are off the floor at take-off
  ARRH = 14, // ... as they come in over the landing
  SEATY = 5, // px from a sitter's feet up to the handle
  SIDE = 15, // px ahead of them where the broom's binding hovers before they board
  ASIDE = 10, // px behind the landing spot where it stands
  MEANDER = 0.35; // tiles the wobbly flight weaves off the straight line

// Raster: 40 px cells, the binding at the middle; frames by the tail's angle under the horizontal (deg): nose down,
// level, nose up, half raised, upright.
const CELL = 40,
  C0 = 20,
  HANDLE = 14, // px from the binding to the nose
  BRISTLE = 10, // px of straw behind it
  SEAT_A = 6, // px along the handle from the binding to the seat
  ANG = [-12, 0, 12, 45, 90],
  LEVEL = 1,
  UPR = 4;
// 1 handle light, 2 handle dark, 3 knob, 4 band light, 5 band dark, 6 straw light, 7 straw, 8 straw dark.
export function broomPixels(k, s) {
  const px = new Uint8Array(CELL * CELL),
    th = (ANG[k] * Math.PI) / 180,
    fx = s * Math.cos(th),
    fy = -Math.sin(th),
    nx = -s * fy,
    ny = s * fx;
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      const qx = x + 0.5 - C0,
        qy = y + 0.5 - C0,
        a = qx * fx + qy * fy,
        b = qx * nx + qy * ny;
      let c = 0;
      if (a >= 0.5 && a < HANDLE && b >= -1 && b < 1) c = a >= HANDLE - 1.5 ? 3 : b < 0 ? 1 : 2;
      else if (a >= -1.5 && a < 0.5 && Math.abs(b) < 1.9) c = b < 0 ? 4 : 5;
      else if (a >= -BRISTLE && a < -1.5) {
        const w = 1.6 + 0.42 * (-a - 1.5);
        if (Math.abs(b) < w) c = a < -BRISTLE + 1.2 || Math.abs(b) > w - 0.9 ? 8 : Math.floor(b + 9) % 2 ? 6 : 7;
      }
      px[y * CELL + x] = c;
    }
  return px;
}
const DAY = ['#c48a45', '#7d4b22', '#4e2c14', '#dc5643', '#8e2a22', '#f8dc80', '#dcac48', '#9c6c26'];
const hex = (c, k) => parseInt(c.slice(1 + 2 * k, 3 + 2 * k), 16);
const dim = c => `rgb(${[0, 1, 2].map(k => Math.round(hex(c, k) * 0.78 + 4)).join(',')})`;
const PAL = [DAY, DAY.map(dim)];
let sheet = null;
// Columns: frame by direction (right, left); rows: day, night.
const sheetOf = () =>
  sheet ||
  (sheet = atlas(2 * ANG.length * CELL, 2 * CELL, g => {
    for (let l = 0; l < 2; l++)
      for (let k = 0; k < ANG.length; k++)
        for (let j = 0; j < 2; j++)
          Kit.bake(g, broomPixels(k, j ? -1 : 1), CELL, CELL, (2 * k + j) * CELL, c => PAL[l][c - 1], l * CELL);
  }));
// The broom with its binding at (bx, by).
function broom(X, bx, by, k, s) {
  X.stamp(
    sheetOf(),
    (2 * k + (s > 0 ? 0 : 1)) * CELL,
    (X.night ? 1 : 0) * CELL,
    CELL,
    CELL,
    bx - C0,
    by - C0,
    CELL,
    CELL,
  );
}
const COS = ANG.map(d => Math.cos((d * Math.PI) / 180)),
  SIN = ANG.map(d => Math.sin((d * Math.PI) / 180));

// shortcut: read every frame, so an early re-aim to the other side flips it in one frame; tp has no fixed side yet.
const side = X => (X.dir1[0] >= 0 ? 1 : -1),
  hop0 = stool => (stool ? SQUEEZE : B.HOP),
  seat0 = stool => hop0(stool) + B.SEAT - B.HOP,
  lift0 = stool => (stool ? seat0(stool) + 0.01 : B.LIFT),
  // px a stool sitter's seat is over the 'sit' pose's
  perch = stool => (stool === 2 ? 5 : 0),
  cruise = len => Math.min(96, Math.max(34, 18 + 2.6 * (len || 0))),
  waves = len => Math.min(3, Math.max(1, Math.round((len || 0) / 9))),
  bump = t => ease(r(t, 0, 0.4)) * (1 - ease(r(t, 0.62, 1)));

// The picture at core v, idle time secs: body feet, pose, alpha, broom binding, frame and alpha, ground and height.
const P = { fx: 0, fy: 0, sit: false, turn: true, a: 1, bx: 0, by: 0, k: LEVEL, ba: 1, gx: 0, gy: 0, h: 0 },
  Q = { ...P };
// Seated: the broom under them, its seat at the lap.
function seated(p, s, k) {
  p.sit = true;
  p.k = k;
  p.bx = Math.round(p.fx - s * COS[k] * SEAT_A);
  p.by = Math.round(p.fy - SEATY + SIN[k] * SEAT_A);
}
function origin(X, v, secs, p, s) {
  const stool = X.tp.stool;
  p.gx = X.tx0;
  p.gy = X.ty0;
  p.fx = X.x0;
  if (X.L.hide) {
    p.h = LIFT;
    p.fy = X.y0 - LIFT;
    p.a = p.ba = r(v, L_IN, DEP - 0.03);
    seated(p, s, LEVEL);
    return p;
  }
  const up = r(v, lift0(stool), DEP);
  p.h = v < lift0(stool) ? perch(stool) : lerp(perch(stool), LIFT, ease(up));
  p.fx = X.x0 + Math.round(1.4 * Math.sin(secs * 11) * up);
  p.fy = X.y0 - Math.round(p.h);
  p.ba = r(v, B.POOF, B.SHOWN);
  if (v >= seat0(stool) || stool) {
    seated(p, s, up > 0 && up < 0.9 ? 2 : LEVEL);
    if (v >= seat0(stool)) return p;
  }
  // Hovering ahead of them, bobbing; it slides under as they hop.
  const slide = lerp(SIDE, -SEAT_A, ease(r(v, hop0(stool), seat0(stool)))),
    hop = stool ? 0 : Math.round(4 * Math.sin(Math.PI * r(v, hop0(stool), seat0(stool))));
  p.sit = !!stool;
  p.fy -= hop;
  p.k = LEVEL;
  p.bx = Math.round(X.x0 + s * slide);
  p.by = X.y0 - perch(stool) - SEATY - Math.round(1.2 + Math.sin(secs * 5.5));
  return p;
}
function flight(X, v, secs, p, s) {
  const t = r(v, DEP, ARR),
    e = ease(t),
    len = X.tp.len,
    dx = X.tx1 - X.tx0,
    dy = X.ty1 - X.ty0,
    d = Math.hypot(dx, dy) || 1,
    m = MEANDER * Math.sin(Math.PI * t) * Math.sin(2 * Math.PI * waves(len) * t),
    ox = (-dy / d) * m,
    oy = (dx / d) * m,
    k = Math.sin(Math.PI * t),
    hump = cruise(len),
    climb = (bump(Math.min(1, t + 0.04)) - bump(Math.max(0, t - 0.04))) * hump;
  p.gx = lerp(X.tx0, X.tx1, e) + ox;
  p.gy = lerp(X.ty0, X.ty1, e) + oy;
  p.h = lerp(LIFT, ARRH, t) + hump * bump(t) + 2.5 * Math.sin(secs * 6.3) * k;
  p.fx = Math.round(lerp(X.x0, X.x1, e) + (ox - oy) * TW + 1.5 * Math.sin(secs * 4.7) * k);
  p.fy = Math.round(lerp(X.y0, X.y1, e) + (ox + oy) * TH - p.h);
  p.a = p.ba = 1;
  // Nose up climbing, down sinking, and a wobble between.
  const tilt = (climb > 3 ? 1 : climb < -3 ? -1 : 0) + Math.round(0.7 * Math.sin(secs * 7.1));
  seated(p, s, LEVEL + Math.max(-1, Math.min(1, tilt)));
  return p;
}
function arrival(X, v, secs, p, s) {
  const down = r(v, ARR, B.DOWN);
  p.gx = X.tx1;
  p.gy = X.ty1;
  p.h = ARRH * (1 - out2(down));
  p.fx = X.x1 + Math.round(1.2 * Math.sin(secs * 9) * (1 - down));
  p.fy = X.y1 - Math.round(p.h);
  if (v < B.OFF) {
    seated(p, s, down < 1 ? 0 : LEVEL);
    return p;
  }
  // Off: a little hop; the broom slides back, then swings upright on its bristles.
  p.sit = false;
  p.fy = X.y1 - Math.round(3 * Math.sin(Math.PI * r(v, B.OFF, B.STAND)));
  const slide = ease(r(v, B.OFF, B.UP)),
    sw = ease(r(v, B.UP, B.UPRIGHT)),
    lx = X.x1 - s * (SEAT_A + 8 * slide),
    ly = X.y1 - SEATY,
    ux = X.x1 - s * ASIDE,
    uy = X.y1 - BRISTLE,
    bounce = Math.round(1.5 * Math.sin(Math.PI * r(v, B.UPRIGHT, B.UPRIGHT + 0.05)));
  p.k = sw < 0.3 ? LEVEL : sw < 0.75 ? 3 : UPR;
  p.bx = Math.round(lerp(lx, ux, sw));
  p.by = Math.round(lerp(ly, uy, sw)) - bounce;
  return p;
}
function picture(X, v, secs, p = P) {
  const s = side(X);
  p.a = p.ba = 1;
  p.turn = v >= hop0(X.tp.stool) || X.L.hide;
  if (v >= ARR) return arrival(X, v, secs, p, s);
  if (v >= DEP) return flight(X, v, secs, p, s);
  return origin(X, v, secs, p, s);
}

// Sparkles shed from the bristles while riding: spawned on a fixed beat of idle time, each one where the tail was
// then, falling and twinkling out. Pure in the clock, so nothing is kept between frames.
const RATE = 16,
  LIFE = 0.75,
  SP = []; // scratch: x, y, size per sparkle
function shed(X) {
  const L = X.L,
    tp = X.tp,
    s = side(X),
    from = L.hide ? L_IN + 0.04 : lift0(tp.stool);
  SP.length = 0;
  if (L.cut) return SP;
  for (let i = Math.floor(L.secs * RATE); i > (L.secs - LIFE) * RATE; i--) {
    const ts = i / RATE,
      v = core(ts, tp.d);
    // a crowd keeps the beat and skips every other one, so nothing reshuffles when it starts or ends
    if ((X.lite && i % 2) || v < from || v > B.DOWN) continue;
    const q = picture(X, v, ts, Q),
      age = L.secs - ts,
      jx = (X.hash(i, 21) - 0.5) * 5,
      jy = (X.hash(i, 22) - 0.5) * 4,
      tx = q.bx - s * COS[q.k] * (BRISTLE - 1) + jx,
      ty = q.by + SIN[q.k] * (BRISTLE - 1) + jy,
      floor = q.fy + Math.round(q.h) + 2,
      y = Math.min(floor, ty + 16 * age + 14 * age * age),
      x = tx - s * 7 * age + 1.5 * Math.sin(ts * 9 + age * 8),
      f = age / LIFE;
    // big, then small, then a blinking dot
    const size = f < 0.3 ? 2 : f < 0.6 ? 1 : (i + Math.floor(L.secs * 12)) % 2 ? 0 : -1;
    if (size >= 0) SP.push(Math.round(x), Math.round(y), size);
  }
  return SP;
}
const GOLD = ['#ffc21f', '#ffe07a'],
  WHITE = ['#fffbe6', '#ffffff'];
// Four-point stars from a flat list (x, y, size): gold arms in one fill, white hearts in another.
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
// A ring of stars bursting out from (cx, cy) over p 0-1.
const RING = [];
function burst(X, cx, cy, p, n, rad) {
  if (p <= 0 || p >= 1) return;
  RING.length = 0;
  const d = 3 + rad * out2(p);
  for (let j = 0; j < n; j++) {
    const ang = (j / n) * 2 * Math.PI + 0.4,
      size = p < 0.5 ? 2 : p < 0.8 ? 1 : 0;
    RING.push(Math.round(cx + d * Math.cos(ang)), Math.round(cy + 0.7 * d * Math.sin(ang) - 4 * p), size);
  }
  // a big flash at the heart first
  if (p < 0.3) RING.push(cx, cy, 3);
  stars(X, RING, X.L.C * (1 - in2(p)));
}

const O = { pose: 'stand', front: true, alpha: 1 };
// Body, broom and sparkles: one picture at one depth.
function draw(X, p, withBroom) {
  const ctx = X.ctx,
    C = X.L.C,
    s = side(X);
  if (p.a <= 0.01) return;
  O.pose = p.sit ? 'sit' : 'stand';
  // they keep their facing until they turn to board
  O.front = p.turn ? true : null;
  // the rider is real: a cut fades only the broom and its sparkles
  O.alpha = Math.min(1, p.a);
  X.bodyAt(p.fx, p.fy, O);
  if (withBroom && p.ba * C > 0.01) {
    ctx.globalAlpha = Math.min(1, p.ba * C);
    broom(X, p.bx, p.by, p.k, s);
    ctx.globalAlpha = 1;
  }
  stars(X, shed(X), p.a * C);
  const v = X.L.v;
  // the twinkle it comes in with; a hidden starter's comes in over the first point outside
  const t0 = X.L.hide ? L_IN : B.POOF;
  if (!X.L.sw) burst(X, p.bx + s * 5, p.by, r(v, t0, t0 + at(0.36)), X.lite ? 4 : 6, 9);
}
// Dust kicked up at take-off and touchdown: tufts over an ellipse, lit on top.
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
    n = X.lite ? 5 : 8,
    d = 4 + 9 * out2(p),
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
// The shadow under the feet and broom while the remapped body (which has none) hovers low; whole in a cut.
function shade(X, end, h, w) {
  Kit.shadow(X.ctx, end ? X.x1 : X.x0, end ? X.y1 : X.y0, w - h / 3, 0.9 - h / 30);
}

const PART = Kit.PART;
export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q) return L.hide ? 0 : PART.S0;
    if (v >= REL || (L.hide && !L.sw && v < L_IN)) return 0;
    let n = 0;
    if (L.trip >= 0 || (L.hide && !L.sw)) n |= PART.TRIP | PART.SHADOW;
    if (!L.hide && (!L.sw || v < lift0(X.tp.stool) + B.PUFF)) n |= PART.F0;
    if (L.sw && v >= ARR) n |= PART.F1 | (v >= B.OFF ? PART.S1 : 0);
    return n;
  },
  floor(X, end) {
    const v = X.L.v,
      p = picture(X, v, X.L.secs);
    if (!end) {
      if (!X.L.sw) shade(X, 0, p.h, 16);
      puff(X, 0, r(v, lift0(X.tp.stool), lift0(X.tp.stool) + B.PUFF));
      return;
    }
    // standing too: the remapped body has no shadow of its own until the release
    shade(X, 1, p.h, 16);
    puff(X, 1, r(v, B.DOWN, B.DOWN + B.PUFF));
  },
  stand(X, end) {
    const L = X.L;
    if (!end) {
      // queued: a twinkle at their side, where the broom will appear
      const s = side(X),
        on = Math.floor(L.secs * 3) % 2;
      RING.length = 0;
      RING.push(X.x0 + s * 9, X.y0 - 12 + on, on ? 1 : 0);
      stars(X, RING, 0.8);
      return;
    }
    const p = picture(X, L.v, L.secs);
    broom(X, p.bx, p.by, p.k, side(X));
  },
  trip(X) {
    draw(X, picture(X, X.L.v, X.L.secs), true);
  },
  // The ground point under the rider and the real height: low at both ends, so it sorts with the furniture there.
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
    if (L.trip >= 0 || (L.hide && !L.sw)) return true;
    if (L.sw && v < ARR) return true;
    draw(X, picture(X, v, L.secs), !L.sw || v < B.OFF);
    return true;
  },
  // The broom left standing at the landing, a twinkle running up it now and then, until it vanishes in a burst.
  marks: [{ at: 'rel', end: 1, ttl: M.TTL, layer: 'stand' }],
  drawMark(X, m, age) {
    const s = side(X),
      bx = X.x0 - s * ASIDE,
      by = X.y0 - BRISTLE,
      out = r(age, M.STAY, M.STAY + M.OUT);
    if (out < 1) {
      X.ctx.globalAlpha = 1 - out;
      broom(X, bx, by, UPR, s);
      X.ctx.globalAlpha = 1;
    }
    RING.length = 0;
    const g = (age % 0.9) / 0.9;
    if (age < M.STAY && g < 0.3) RING.push(bx, by - Math.round(2 + 40 * g), g < 0.15 ? 1 : 0);
    stars(X, RING, 1);
    burst(X, bx, by - 6, r(age, M.STAY, M.TTL), X.lite ? 4 : 7, 11);
  },
  gap: null,
};
// Exposed for tests.
export const BROOM = {
  B,
  M,
  LIFT,
  ARRH,
  SEATY,
  ASIDE,
  BRISTLE,
  hop0,
  seat0,
  lift0,
  cruise,
  picture,
  shed,
  need: STYLE.need,
};
