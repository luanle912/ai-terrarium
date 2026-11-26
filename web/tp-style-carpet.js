// carpet: a rolled carpet pops in at their feet and unrolls along the floor, passing under them as they hop over it;
// they sit, it ripples to life and lifts, glides over the island rippling above its shadow, settles on the landing,
// they stand and it rolls itself up under their feet, then the roll hops and is gone in a twinkle. The carpet lies
// along a floor axis (the trip's main one). Lower than the overlay it is a floor item (rug() over the lounge rug), so
// it never changes layer at take-off or touchdown; the rider is drawn by person() at the walker's depth at both ends,
// and by trip() in flight and for a hidden start, with the carpet once it is high. ground() reports the real height,
// so take-off and touchdown sort with the furniture. One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { TH, TW, outdoors } from './office-scene.js';

const { atlas, r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR, T } = TeleportLogic;
const { RELEASE: REL, END, L_IN, SQUEEZE } = T,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  af = p => REL + p * (END - REL), // a fade fraction
  B = {
    POOF: at(0.03), // the roll pops in, dropping onto the floor ...
    THUD: at(0.12), // ... and lands
    U0: at(0.16), // it unrolls from the front end to the back, under their feet
    U1: at(0.5),
    HOP: 0.12 * DEP, // half the hop over the roll, around its pass
    SIT: at(0.5), // they sit down on it
    LIVE: at(0.56), // it ripples to life
    LIFT: at(0.7), // and lifts
    PUFF: at(0.3), // how long a dust puff lasts
    DOWN: ar(0.3), // touchdown on the landing
    STAND: ar(0.38), // they stand up
    R0: ar(0.46), // it rolls itself up from the back end, under their feet
    R1: ar(0.88),
    JUMP: af(0.1), // the roll hops ...
    GONE: af(0.62), // ... and twinkles out
  },
  LIFT = 10, // px the carpet is off the floor at take-off
  ARRH = 12, // ... as it comes in over the landing
  HOPH = 6, // px of the hop over the roll
  LOW = 24; // px: the dispatcher's overlay height

// The carpet in tiles along its axis (u) and across it (w), drawn by a painter's pass over dense samples, once.
const LEN = 1.5,
  WID = 0.8,
  FR = 0.12, // fringe length
  AMP = 1.3, // ripple amplitude, px
  RMAX = 3, // px radius of the full roll
  TPX = Math.hypot(TW, TH), // px a tile is long on screen, for the roll's round section
  CW = 48,
  CH = 30,
  OXC = 10, // cell px of the axis origin (u 0, w 0)
  OYC = 12,
  CX = OXC + Math.round((LEN / 2) * TW), // cell px of the carpet's middle
  CY = OYC + Math.round((LEN / 2) * TH),
  RW = 24,
  RH = 20,
  RX = 12, // roll cell px of the roll's floor point
  RY = 14,
  NR = 5, // roll sizes
  NRIP = 4; // ripple frames
const height = (u, k) => (k < 0 ? 0 : AMP * Math.sin((2 * Math.PI * u) / LEN + (k * Math.PI) / 2));
// px the middle of the carpet (the seat) is raised in ripple frame k
export const seatLift = k => Math.round(height(LEN / 2, k));
// 1 field, 2 lit, 3 shade, 4 border, 5 lit, 6 shade, 7 medallion, 8 its heart, 9 edge, 10 fringe, 11 fringe shade,
// 12 roll back, 13 lit, 14 shadow.
function face(a, b, slope) {
  const lit = slope > 2.2 ? 1 : slope < -2.2 ? 2 : 0;
  if (a < 0.09 || a > 0.91 || b < 0.17 || b > 0.83) return 4 + lit;
  const da = Math.abs(a - 0.5),
    db = Math.abs(b - 0.5);
  if (da / 0.08 + db / 0.12 <= 1) return 8;
  if (da / 0.21 + db / 0.27 <= 1) return 7;
  if (Math.abs(da - 0.3) < 0.035 && db < 0.1) return 7;
  return 1 + lit;
}
// Frame k: ripple 0-3, -1 flat, -2 the shadow; mirror: along the y axis instead of x.
export function carpetPixels(k, mirror) {
  const px = new Uint8Array(CW * CH),
    put = (u, w, h, c) => {
      let x = Math.floor(OXC + (u - w) * TW),
        y = Math.floor(OYC + (u + w) * TH - h);
      if (mirror) x = 2 * CX - x;
      if (x >= 0 && y >= 0 && x < CW && y < CH) px[y * CW + x] = c;
    };
  const S = 0.01;
  // edge first (1 px under the top), then the fringe and the top over it
  for (let pass = 0; pass < 2; pass++)
    for (let u = -FR; u <= LEN + FR; u += S)
      for (let w = -WID / 2; w <= WID / 2; w += S) {
        const h = height(u, k),
          inside = u >= 0 && u <= LEN;
        if (k === -2) {
          if (inside && pass) put(u, w, 0, 14);
          continue;
        }
        if (!inside) {
          if (pass && Math.floor((w + WID / 2) * 22) % 2 === 0)
            put(u, w, h, Math.abs(u - LEN / 2) - LEN / 2 > FR / 2 ? 11 : 10);
          continue;
        }
        if (!pass) put(u, w, h - 1, 9);
        else put(u, w, h, face(u / LEN, w / WID + 0.5, (height(u + 0.02, k) - height(u - 0.02, k)) / 0.04));
      }
  return px;
}
// Roll size j (0 smallest .. NR-1 the full roll), lying across the axis with its floor point at the roll cell's mark.
export const radius = j => 1 + ((RMAX - 1) * j) / (NR - 1);
export function rollPixels(j, mirror) {
  const px = new Uint8Array(RW * RH),
    rad = radius(j),
    put = (u, w, h, c) => {
      let x = Math.floor(RX + (u - w) * TW),
        y = Math.floor(RY + (u + w) * TH - h);
      if (mirror) x = 2 * RX - x;
      if (x >= 0 && y >= 0 && x < RW && y < RH) px[y * RW + x] = c;
    };
  for (let w = -WID / 2; w <= WID / 2; w += 0.01)
    for (let t = 0; t < 2 * Math.PI; t += 0.05) {
      const s = Math.sin(t),
        band = Math.abs(w) > WID / 2 - 0.1;
      put((rad * Math.cos(t)) / TPX, w, rad + rad * s, band ? (s > 0.3 ? 5 : 6) : s > 0.3 ? 13 : 12);
    }
  // the near end: a spiral of face and back
  for (let q = 0; q <= rad; q += 0.1)
    for (let t = 0; t < 2 * Math.PI; t += 0.05)
      put((q * Math.cos(t)) / TPX, WID / 2, rad + q * Math.sin(t), q > rad - 0.6 ? 9 : Math.floor(q * 1.6) % 2 ? 1 : 4);
  return px;
}
const DAY = [
  '#b3283a',
  '#cf4150',
  '#86202f',
  '#e9bf5a',
  '#f7da86',
  '#b8892f',
  '#26467a',
  '#f4e4b8',
  '#5c1521',
  '#f3e9cf',
  '#c8b893',
  '#8b3440',
  '#a64a52',
  '#000000',
];
const hex = (c, k) => parseInt(c.slice(1 + 2 * k, 3 + 2 * k), 16);
const dim = c => `rgb(${[0, 1, 2].map(k => Math.round(hex(c, k) * 0.74 + 4)).join(',')})`;
const PAL = [DAY, DAY.map(dim)];
// Carpet cells: columns ripple 0-3, flat, shadow, then the same mirrored; rows day, night. Then the roll cells.
const COLS = NRIP + 2,
  ROLLY = 2 * CH;
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = atlas(2 * COLS * CW, ROLLY + 2 * RH, g => {
    for (let l = 0; l < 2; l++)
      for (let m = 0; m < 2; m++) {
        for (let c = 0; c < COLS; c++) {
          const k = c < NRIP ? c : c === NRIP ? -1 : -2;
          Kit.bake(g, carpetPixels(k, m), CW, CH, (m * COLS + c) * CW, n => PAL[l][n - 1], l * CH);
        }
        for (let j = 0; j < NR; j++)
          Kit.bake(g, rollPixels(j, m), RW, RH, (m * NR + j) * RW, n => PAL[l][n - 1], ROLLY + l * RH);
      }
  }));
export const BAKE = { w: 2 * COLS * CW, h: ROLLY + 2 * RH };

// The carpet's axis and which way along it the trip goes; read from the tiles every frame (a re-aim may turn it).
const AX = { m: false, s: 1 };
function axis(X) {
  const dx = X.tx1 - X.tx0,
    dy = X.ty1 - X.ty0,
    m = Math.abs(dy) > Math.abs(dx);
  AX.m = m;
  AX.s = (m ? dy : dx) < 0 ? -1 : 1;
  return AX;
}
// Screen px of carpet coordinates (u, w in tiles) around its middle at (cx, cy).
const along = (m, du) => [(m ? -1 : 1) * du * TW, du * TH];
// Ripple frame at idle time secs; the wave runs from the front of the trip to the back.
const rippleK = (secs, s) => {
  const k = Math.floor(secs * 11) % NRIP;
  return s > 0 ? k : (NRIP - k) % NRIP;
};
function carpet(X, cx, cy, k, alpha) {
  if (alpha <= 0.01) return;
  const m = axis(X).m,
    col = k === -2 ? NRIP + 1 : k < 0 ? NRIP : k;
  X.ctx.globalAlpha = Math.min(1, alpha);
  // a mirrored cell keeps its middle at CX
  X.stamp(
    sheetOf(),
    ((m ? COLS : 0) + col) * CW,
    (k === -2 ? 0 : X.night ? 1 : 0) * CH,
    CW,
    CH,
    cx - CX,
    cy - CY,
    CW,
    CH,
  );
  X.ctx.globalAlpha = 1;
}
function roll(X, x, y, j, alpha) {
  if (alpha <= 0.01) return;
  const m = axis(X).m;
  X.ctx.globalAlpha = Math.min(1, alpha);
  X.stamp(sheetOf(), ((m ? NR : 0) + j) * RW, ROLLY + (X.night ? 1 : 0) * RH, RW, RH, x - RX, y - RY, RW, RH);
  X.ctx.globalAlpha = 1;
}
const rollJ = q => Math.max(0, Math.min(NR - 1, Math.round(Math.sqrt(q) * (NR - 1))));
// The carpet laid from u = pos (tiles from the back end) to the front, the roll at pos; q is the part rolled up.
function partly(X, cx, cy, q, alpha, lift = 0) {
  if (q <= 0.001) {
    carpet(X, cx, cy, -1, alpha);
    return;
  }
  const m = axis(X).m,
    ctx = X.ctx,
    pos = LEN * q,
    b = along(m, pos - LEN / 2),
    rx = Math.round(cx + b[0]),
    ry = Math.round(cy + b[1]);
  if (q < 0.98) {
    // clip to the laid part: the cut edge lies under the roll
    const e = along(m, LEN / 2 + FR + 0.2),
      n = along(!m, 1),
      wx = n[0],
      wy = n[1];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(rx + wx, ry + wy);
    ctx.lineTo(rx - wx, ry - wy);
    ctx.lineTo(cx + e[0] - wx, cy + e[1] - wy);
    ctx.lineTo(cx + e[0] + wx, cy + e[1] + wy);
    ctx.closePath();
    ctx.clip();
    carpet(X, cx, cy, -1, alpha);
    ctx.restore();
  }
  roll(X, rx, ry - lift, rollJ(q), alpha);
}

// The picture at core v, idle time secs: carpet middle on the floor (cx, cy), height h, ripple frame k (-1 flat),
// rolled part q (0 laid out), alphas, rider feet and pose, ground point.
const P = {
  cx: 0,
  cy: 0,
  h: 0,
  k: -1,
  q: 0,
  ca: 1,
  ra: 1,
  fx: 0,
  fy: 0,
  sit: false,
  front: null,
  gx: 0,
  gy: 0,
  lift: 0,
};
const cruise = len => Math.min(90, Math.max(32, 16 + 2.6 * (len || 0))),
  bump = t => ease(r(t, 0, 0.4)) * (1 - ease(r(t, 0.62, 1))),
  hop = (v, mid) => Math.round(HOPH * Math.sin(Math.PI * r(v, mid - B.HOP, mid + B.HOP))),
  lift0 = stool => (stool ? at(0.78) : B.LIFT);
// The rider seated on the carpet, its middle at (cx, cy) raised h.
function seat(p) {
  p.sit = true;
  p.front = true;
  p.fx = p.cx;
  p.fy = p.cy - Math.round(p.h) - (p.k >= 0 ? seatLift(p.k) : 0) + 1;
}
function origin(X, v, secs, p, s) {
  const stool = X.tp.stool;
  p.cx = X.x0;
  p.cy = X.y0;
  p.gx = X.tx0;
  p.gy = X.ty0;
  if (X.L.hide) {
    p.h = LIFT;
    p.k = rippleK(secs, s);
    p.q = 0;
    p.ca = p.ra = r(v, L_IN, DEP - 0.04);
    seat(p);
    return p;
  }
  // the roll drops in at the front end, then unrolls toward the back
  const drop = 1 - out2(r(v, B.POOF, B.THUD));
  p.lift = Math.round(8 * drop * drop);
  p.q = 1 - ease(r(v, B.U0, B.U1));
  p.ca = r(v, B.POOF, B.POOF + 0.02);
  const up = r(v, lift0(stool), DEP);
  p.h = LIFT * ease(up);
  p.k = v >= B.LIVE ? rippleK(secs, s) : -1;
  if (v >= (stool ? SQUEEZE : B.SIT)) {
    seat(p);
    // a stool sitter slides down onto the carpet
    if (stool) p.fy -= Math.round((stool === 2 ? 9 : 4) * (1 - r(v, SQUEEZE, SQUEEZE + 0.05)));
    return p;
  }
  p.sit = false;
  p.front = v >= (B.U0 + B.U1) / 2 ? true : null;
  p.fx = X.x0;
  p.fy = X.y0 - hop(v, (B.U0 + B.U1) / 2);
  return p;
}
function flight(X, v, secs, p, s) {
  const t = r(v, DEP, ARR),
    e = ease(t);
  p.gx = lerp(X.tx0, X.tx1, e);
  p.gy = lerp(X.ty0, X.ty1, e);
  p.cx = Math.round(lerp(X.x0, X.x1, e));
  p.cy = Math.round(lerp(X.y0, X.y1, e));
  p.h = lerp(LIFT, ARRH, t) + cruise(X.tp.len) * bump(t) + 1.5 * Math.sin(secs * 4.2) * Math.sin(Math.PI * t);
  p.k = rippleK(secs, s);
  p.q = 0;
  p.ca = p.ra = 1;
  seat(p);
  return p;
}
function arrival(X, v, secs, p, s) {
  const down = r(v, ARR, B.DOWN);
  p.cx = X.x1;
  p.cy = X.y1;
  p.gx = X.tx1;
  p.gy = X.ty1;
  p.h = ARRH * (1 - out2(down));
  p.k = v < B.DOWN - 0.02 ? rippleK(secs, s) : -1;
  p.q = ease(r(v, B.R0, B.R1));
  if (v < B.STAND) {
    seat(p);
    return p;
  }
  p.sit = false;
  p.front = true;
  p.fx = X.x1;
  p.fy = X.y1 - hop(v, (B.R0 + B.R1) / 2);
  return p;
}
function picture(X, v, secs, p = P) {
  const s = axis(X).s;
  p.ca = p.ra = 1;
  p.lift = 0;
  if (v >= ARR) return arrival(X, v, secs, p, s);
  if (v >= DEP) return flight(X, v, secs, p, s);
  return origin(X, v, secs, p, s);
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
    RING.push(Math.round(cx + d * Math.cos(ang)), Math.round(cy + 0.6 * d * Math.sin(ang) - 3 * p), size);
  }
  if (p < 0.3) RING.push(cx, cy, 3);
  stars(X, RING, X.L.C * (1 - in2(p)));
}
// Dust kicked up at take-off and touchdown: tufts round the carpet, lit on top.
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
    n = X.lite ? 6 : 10,
    d = 12 + 10 * out2(p),
    lift = Math.round(3 * p);
  ctx.globalAlpha = 0.85 * (1 - in2(p)) * X.L.C;
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

const O = { pose: 'stand', front: true, alpha: 1, legs: 1 };
// Rider, and the carpet once it is up in the overlay.
function draw(X, p) {
  const C = X.L.C;
  if (p.h >= LOW) carpet(X, p.cx, p.cy - Math.round(p.h), p.k, p.ca * C);
  if (p.ra <= 0.01) return;
  O.pose = 'stand';
  O.legs = p.sit ? 0 : 1;
  O.front = p.front;
  // the rider is real: a cut fades only the carpet
  O.alpha = Math.min(1, p.ra);
  X.bodyAt(p.fx, p.fy, O);
}
// The carpet's own shadow under it, fainter with height (the dispatcher's is a small bar), and the lifted carpet
// itself while it is lower than the overlay.
function shade(X, p) {
  if (p.h <= 0.5) return;
  const f = Kit.feet(p.gx, p.gy);
  carpet(X, f[0], f[1], -2, 0.28 * (1 - Math.min(p.h, 140) / 170) * X.L.C);
  if (p.h < LOW) carpet(X, p.cx, p.cy - Math.round(p.h), p.k, p.ca * X.L.C);
}
// What lies on the floor at an end: the carpet (or its roll) and its shade while low, puffs and twinkles.
function onFloor(X, end, p) {
  const v = X.L.v,
    C = X.L.C;
  shade(X, p);
  if (p.h <= 0.5) {
    if (p.q > 0.001) partly(X, p.cx, p.cy, p.q, p.ca * C, p.lift);
    else carpet(X, p.cx, p.cy, p.k, p.ca * C);
  }
  if (!end) {
    const l0 = lift0(X.tp.stool),
      b = along(axis(X).m, LEN / 2);
    // over by take-off, when this item stops
    puff(X, 0, r(v, l0, Math.min(DEP, l0 + B.PUFF)));
    burst(X, p.cx + Math.round(b[0]), p.cy + Math.round(b[1]) - 4, r(v, B.POOF, B.POOF + at(0.3)), X.lite ? 4 : 6, 9);
    return;
  }
  puff(X, 1, r(v, B.DOWN, B.DOWN + B.PUFF));
}
// The roll left at the landing's front end after release: a hop, then a twinkle and gone.
function leftover(X) {
  const b = along(axis(X).m, LEN / 2),
    x = X.x1 + Math.round(b[0]),
    y = X.y1 + Math.round(b[1]),
    up = Math.round(5 * Math.sin(Math.PI * r(X.L.v, B.JUMP, B.GONE - 0.03)));
  roll(X, x, y - up, NR - 1, (1 - r(X.L.v, B.GONE - 0.06, B.GONE)) * X.L.C);
  burst(X, x, y - 5, r(X.L.v, B.GONE - 0.06, B.GONE + 0.12), X.lite ? 4 : 7, 10);
}

const PART = Kit.PART;
export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q) return L.hide ? 0 : PART.S0;
    if (L.hide && !L.sw && v < L_IN) return 0;
    if (v >= REL) return v < B.GONE + 0.12 ? PART.F1 : 0;
    // in the air the shadow is drawn from the landing's floor item, or over the lounge rug from rug()
    if (L.trip >= 0 || (L.hide && !L.sw)) {
      const p = picture(X, v, L.secs);
      return PART.TRIP | (Kit.onRug(p.gx, p.gy) ? PART.RUG : PART.F1);
    }
    if (L.sw) return PART.F1;
    return v >= B.POOF ? PART.F0 : 0;
  },
  floor(X, end) {
    if (X.L.v >= REL) {
      leftover(X);
      return;
    }
    const p = picture(X, X.L.v, X.L.secs);
    if (X.L.trip >= 0 || (X.L.hide && !X.L.sw)) {
      if (!Kit.onRug(p.gx, p.gy)) shade(X, p);
      return;
    }
    onFloor(X, end, p);
  },
  rug(X) {
    shade(X, picture(X, X.L.v, X.L.secs));
  },
  stand(X) {
    // queued: a twinkle at their feet, where the roll will appear
    const on = Math.floor(X.L.secs * 3) % 2,
      b = along(axis(X).m, LEN / 2);
    RING.length = 0;
    RING.push(X.x0 + Math.round(b[0]), X.y0 + Math.round(b[1]) - 5 + on, on ? 1 : 0);
    stars(X, RING, 0.8);
  },
  trip(X) {
    const p = picture(X, X.L.v, X.L.secs);
    draw(X, p);
    if (X.L.hide && !X.L.sw) burst(X, p.cx, p.cy - LIFT - 4, r(X.L.v, L_IN, L_IN + at(0.36)), X.lite ? 4 : 6, 12);
  },
  // The ground point under the carpet and the real height: low at both ends, so it sorts with the furniture there.
  ground(X, out) {
    const p = picture(X, X.L.v, X.L.secs);
    out[0] = p.gx;
    out[1] = p.gy;
    out[2] = p.h;
    return true;
  },
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || v >= REL) return false;
    if (L.trip >= 0 || (L.hide && !L.sw)) return true;
    if (L.sw && v < ARR) return true;
    if (!L.sw && (v < B.POOF || (X.tp.stool && v < SQUEEZE))) return false;
    draw(X, picture(X, v, L.secs));
    return true;
  },
  marks: [],
  gap: null,
};
// Exposed for tests.
export const CARPET = { B, LIFT, ARRH, LEN, BAKE, CELL: { CW, CH, CX, CY }, picture, lift0, need: STYLE.need, axis };
