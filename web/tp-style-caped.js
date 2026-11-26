// caped: a red cape swirls onto their shoulders, they crouch and leap off in a burst of dust, arms up. They fly a high
// arc over the island, level and arms forward in the middle, the cape streaming and flapping behind, then drop feet
// first and slam down on one knee, fist to the floor: a flash, a ring of dust, chips flying, and a web of cracks
// that fades a few seconds later (a lasting mark). They stand, and the cape folds away into the collar.
// Body and cape are one picture: person() at both ends, trip() in flight and for a hidden start. One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { TpStyles } from './tp-styles.js';

const { atlas, r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR, T, real } = TeleportLogic;
const { RELEASE: REL, L_IN } = T,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  B = {
    SIT: at(0.1), // a sitter stands up on the stool ...
    CAPE: [at(0.08), at(0.36)], // ... the cape swirls on
    CROUCH: [at(0.4), at(0.7)], // knees bend
    LEAP: at(0.74), // off the floor
    HIT: ar(0.12), // the slam
    RISE: [ar(0.56), ar(0.76)], // up from the knee
    FOLD: [ar(0.74), ar(0.97)], // the cape folds into the collar
  },
  H0 = 28, // px off the floor at the end of the leap
  ARRH = 36, // px over the landing when the arrival starts
  SHOULDER = 12, // px from the feet up to the cape's knot
  CAPEL = 9, // px of cape hanging down, to the calves
  KNEEL = 0.35, // leg height on one knee
  DUST = 0.7, // s a dust ring lasts
  DEBRIS = 0.5, // s the chips fly
  FLASH = 0.16; // s the impact ring lasts

const cruise = len => Math.min(110, Math.max(40, 24 + 3.2 * (len || 0))),
  perch = stool => (stool === 2 ? 9 : stool ? 4 : 0),
  // shortcut: read every frame, so an early re-aim the other way turns them in one frame; tp has no fixed facing.
  facing = X => X.y1 >= X.y0,
  away = X => (X.x1 >= X.x0 ? -1 : 1); // the cape drapes behind the way they go

// The picture at core v and idle time secs: feet (fx, fy), ground point and height, pose, and the cape.
const P = {
  fx: 0,
  fy: 0,
  gx: 0,
  gy: 0,
  h: 0,
  floor: 0,
  pose: 'stand',
  front: null,
  legs: 1,
  rot: 0,
  a: 1,
  fist: false,
  vx: 0,
  vy: 0,
  // cape: knot (cx, cy), direction (dx, dy), length, flap amplitude and speed, alpha, drape side
  cx: 0,
  cy: 0,
  dx: 0,
  dy: 1,
  len: 0,
  amp: 0,
  w: 0,
  ca: 1,
  bx: 1,
};
function reset(p) {
  p.pose = 'stand';
  p.front = null;
  p.legs = 1;
  p.rot = 0;
  p.a = p.ca = 1;
  p.fist = false;
  p.vx = p.vy = 0;
  p.dx = 0;
  p.dy = 1;
  p.len = CAPEL;
  p.amp = 1;
  p.w = 5;
  p.floor = 1e9;
}
// The knot on an upright body, lowered with the knees.
function knot(p) {
  p.cx = p.fx;
  p.cy = p.fy - SHOULDER + Math.round(4 * (1 - p.legs));
}
function origin(X, v, p) {
  const stool = X.tp.stool,
    hide = X.L.hide,
    base = perch(stool);
  p.gx = X.tx0;
  p.gy = X.ty0;
  p.bx = away(X);
  if (stool && !hide && v < B.SIT) p.pose = stool === 2 ? 'sitHigh' : 'sit';
  const crouch = ease(r(v, B.CROUCH[0], B.CROUCH[1])),
    up = r(v, B.LEAP, DEP);
  p.legs = v < B.LEAP ? 1 - 0.5 * crouch : 1;
  p.h = base + (H0 - base) * up * (1.4 - 0.4 * up);
  p.fx = X.x0;
  // a sitter is drawn at the floor point: the page lifts a sitter onto the stool itself
  p.fy = X.y0 - (p.pose === 'stand' ? Math.round(p.h) : 0);
  p.floor = X.y0 - base;
  if (v >= B.CROUCH[0]) p.front = facing(X);
  if (v >= B.LEAP) {
    p.pose = 'up';
    p.amp = 2;
    p.w = 22;
  }
  // the cape swirls on: it grows from the knot, flapping hard
  const on = hide ? 1 : r(v, B.CAPE[0], B.CAPE[1]);
  // seen from behind it stops short of the floor, so the legs show under it
  p.len = CAPEL * out2(on) - (p.front === false ? 3 * crouch : 0);
  if (on < 1) {
    p.amp = 3 * (1 - on) + 1;
    p.w = 18;
  }
  if (hide) p.a = r(v, L_IN, L_IN + 0.03);
  knot(p);
  if (p.pose !== 'stand' && p.pose !== 'up') p.len = 0;
  return p;
}
// The flight: a high arc on an eased chord (steep up, level, steep down); the screen velocity picks the pose.
function flight(X, v, secs, p) {
  const t = r(v, DEP, ARR),
    e = lerp(t, ease(t), 0.85),
    de = 0.15 + 5.1 * t * (1 - t),
    cr = cruise(X.tp.len),
    sdx = X.x1 - X.x0,
    sdy = X.y1 - X.y0;
  p.gx = lerp(X.tx0, X.tx1, e);
  p.gy = lerp(X.ty0, X.ty1, e);
  p.h = lerp(H0, ARRH, t) + cr * Math.sin(Math.PI * t);
  p.fx = Math.round(lerp(X.x0, X.x1, e));
  p.fy = Math.round(lerp(X.y0, X.y1, e) - p.h);
  p.vx = sdx * de;
  p.vy = sdy * de - (ARRH - H0) - cr * Math.PI * Math.cos(Math.PI * t);
  p.bx = away(X);
  p.amp = 2.5;
  p.w = 26;
  if (Math.abs(p.vx) > 1.1 * Math.abs(p.vy)) {
    // level, belly down, arms forward; the cape streams back along the way they came
    const s = p.vx > 0 ? 1 : -1,
      n = Math.hypot(p.vx, p.vy);
    p.rot = s > 0 ? 1 : 3;
    p.pose = 'up';
    p.front = false;
    p.cx = p.fx + 4 * s;
    p.cy = p.fy - 8;
    p.dx = -p.vx / n;
    p.dy = -p.vy / n + 0.15;
    p.len = CAPEL + 4;
  } else {
    p.front = facing(X);
    p.pose = p.vy < 0 ? 'up' : 'stand';
    knot(p);
    p.dy = p.vy < 0 ? 1 : -1;
    if (p.vy < 0 && !p.front) p.len = CAPEL - 3;
    if (p.vy >= 0) {
      p.dx = 0.45 * p.bx;
      p.len = CAPEL + 5;
    }
  }
  return p;
}
function arrival(X, v, secs, p) {
  const ageHit = real(v, X.L.d) - real(B.HIT, X.L.d);
  p.gx = X.tx1;
  p.gy = X.ty1;
  p.bx = away(X);
  p.h = ARRH * (1 - in2(r(v, ARR, B.HIT)));
  p.fx = X.x1;
  p.fy = X.y1 - Math.round(p.h);
  p.floor = X.y1;
  if (v < B.HIT) {
    // feet first, the cape blown up behind the head
    p.front = facing(X);
    p.vy = 1;
    knot(p);
    p.dx = 0.45 * p.bx;
    p.dy = -1;
    p.len = CAPEL + 5;
    p.amp = 2;
    p.w = 26;
    return p;
  }
  // one knee down, fist to the floor, facing out; then up again on their own facing
  const up = ease(r(v, B.RISE[0], B.RISE[1])),
    squash = 1 - r(ageHit, 0, 0.07);
  p.legs = lerp(KNEEL - 0.12 * squash, 1, up);
  p.front = v < B.RISE[1] ? true : null;
  p.fist = up < 0.3;
  knot(p);
  // the cape falls from over the head round the back onto the floor, then hangs and folds away
  // the cape whips down onto the floor behind them at the slam and settles
  const fall = ease(r(ageHit, 0, 0.3));
  p.dx = 0;
  p.dy = 1;
  p.amp = lerp(2.5, 0.8, fall);
  p.w = lerp(24, 5, fall);
  p.len = lerp(CAPEL + 5, CAPEL, fall) * (1 - in2(r(v, B.FOLD[0], B.FOLD[1])));
  return p;
}
function picture(X, v, secs, p = P) {
  reset(p);
  if (v >= ARR) return arrival(X, v, secs, p);
  if (v >= DEP) return flight(X, v, secs, p);
  return origin(X, v, p);
}

// The cape as a ribbon of 1 px spans across its length, a wave running from the knot to the hem; the hem part that
// would go through the floor drapes sideways along it. A dark rim, then three tones by the wave's slope.
const CAPE = [
    ['#f0646a', '#c8303c', '#8e1f2d', '#561420'],
    ['#b04a55', '#8c2a38', '#5e1a28', '#320c16'],
  ],
  W0 = 10; // px wide at the knot: a px past each arm (from the back, the shoulders' 8), 3 more at the hem
function cape(X, p, secs, alpha, front) {
  if (p.len < 1 || alpha <= 0.01) return;
  const ctx = X.ctx,
    w0 = front || p.rot || p.dy < 0 ? W0 : W0 - 2,
    n = Math.hypot(p.dx, p.dy) || 1,
    ux = p.dx / n,
    uy = p.dy / n,
    rows = Math.abs(uy) >= Math.abs(ux),
    step = 1 / Math.max(Math.abs(ux), Math.abs(uy)),
    m = Math.max(1, Math.round(p.len / step)),
    pal = CAPE[X.night ? 1 : 0],
    put = (x, y, o, w, t) => (rows ? ctx.rect(x + o, y, w, t) : ctx.rect(x, y + o, t, w));
  ctx.globalAlpha = Math.min(1, alpha);
  // layers: the rim, the cloth, a fold in shade and a lit fold, both running down it with the wave
  for (const l of [3, 1, 2, 0]) {
    ctx.beginPath();
    for (let j = 0; j <= m; j++) {
      const q = j / m,
        ph = 0.6 * j - p.w * secs,
        wv = p.amp * q * Math.sin(ph),
        wide = Math.round(lerp(w0, w0 + 3, q)),
        hem = j === m;
      // the wave sways the spans across, never along, so no gap opens between them
      let x = p.cx + ux * j * step + (rows ? wv : 0),
        y = p.cy + uy * j * step + (rows ? 0 : wv);
      if (y > p.floor - 1) {
        x += p.bx * (y - p.floor + 1);
        y = p.floor - 1;
      }
      const px = Math.round(x - (rows ? wide / 2 : 0)),
        py = Math.round(y - (rows ? 0 : wide / 2)),
        fold = Math.round((wide / 2 - 1) * (1 + 0.6 * Math.sin(0.3 * j - 0.5 * p.w * secs + 1.2)));
      if (l === 3) put(px, py, -1, wide + 2, hem ? 2 : 1);
      else if (l === 1 && !hem) put(px, py, 0, wide, 1);
      else if (l === 2) {
        if (hem) put(px, py, 0, wide, 1);
        else put(px, py, Math.min(wide - 1, fold + 2), 1, 1);
      } else if (l === 0 && !hem && j > 0) put(px, py, Math.max(0, fold), 1, 1);
    }
    ctx.fillStyle = pal[l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// The cape over the shoulders, seen from the front: it shows on both of them, round the neck.
function collar(X, p, alpha) {
  const ctx = X.ctx,
    pal = CAPE[X.night ? 1 : 0];
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = pal[1];
  ctx.fillRect(p.cx - 4, p.cy, 2, 1);
  ctx.fillRect(p.cx + 2, p.cy, 2, 1);
  ctx.globalAlpha = 1;
}

// Dust puffs from a flat list (x, y, radius): a shade under, the puff, a light top; one fill per tone.
const DUSTC = [
  ['#a39581', '#d6cab5', '#f2ebdd'],
  ['#4b4855', '#6e6a77', '#8f8a97'],
  ['#a9b0bb', '#d9dee6', '#f6f8fb'], // over snow
];
function puffs(X, list, alpha) {
  const ctx = X.ctx;
  if (!list.length || alpha <= 0.01) return;
  const tone = DUSTC[X.night ? 1 : X.snow > 0 ? 2 : 0];
  ctx.globalAlpha = Math.min(1, alpha);
  for (let l = 0; l < 3; l++) {
    ctx.beginPath();
    for (let j = 0; j < list.length; j += 3) {
      const x = list[j],
        y = list[j + 1] + (l === 0 ? 1 : l === 2 ? -1 : 0),
        q = list[j + 2] - (l === 2 ? 1 : 0);
      if (q < 1) continue;
      ctx.rect(x - q, y - q + 1, 2 * q + 1, 2 * q - 1);
      ctx.rect(x - q + 1, y - q, 2 * q - 1, 2 * q + 1);
    }
    ctx.fillStyle = tone[l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// A ring of dust blown out over the floor round (cx, cy), age s old: puffs rolling outward, swelling, lifting a
// little and shrinking away. half 0: the puffs behind the feet, 1: in front, 2: all. Pure in its age.
const DL = [];
function dust(X, cx, cy, age, big, half, alpha) {
  if (age <= 0 || age >= DUST) return;
  DL.length = 0;
  const n = 12,
    f = age / DUST;
  for (let k = 0; k < n; k++) {
    // a crowd skips every other puff, so none moves when it starts or ends
    if (X.lite && k % 2) continue;
    const ang = (2 * Math.PI * (k + 0.5 * X.hash(k, 61))) / n,
      reach = (big ? 9 + 14 * X.hash(k, 62) : 5 + 8 * X.hash(k, 62)) * out2(Math.min(1, age / 0.35)),
      x = Math.round(cx + reach * Math.cos(ang)),
      y = Math.round(cy + 0.42 * reach * Math.sin(ang) - 1 - 3 * f * (0.5 + X.hash(k, 63))),
      q = Math.round(
        (big ? 1.5 : 1.3) * (1 + 0.6 * X.hash(k, 64)) * out2(Math.min(1, age / 0.12)) * (1 - 0.8 * in2(f)),
      );
    if (q >= 1 && (half === 2 || (y > cy - 1 ? 1 : 0) === half)) DL.push(x, y, q);
  }
  puffs(X, DL, alpha * (1 - in2(r(f, 0.5, 1))));
}
// Chips of floor thrown out of the slam, falling back and bouncing once; one fill per tone.
const CHIP = [
  ['#e0d2bc', '#8a7660'],
  ['#77737f', '#3c3946'],
];
function debris(X, cx, cy, age, alpha) {
  if (age <= 0 || age >= DEBRIS) return;
  const ctx = X.ctx,
    n = 9,
    pal = CHIP[X.night ? 1 : 0];
  ctx.globalAlpha = alpha * (1 - in2(r(age, DEBRIS - 0.15, DEBRIS)));
  for (let l = 0; l < 2; l++) {
    ctx.beginPath();
    for (let k = l; k < n; k += 2) {
      // a crowd skips pairs (k parity is the tone), so no chip moves when it starts or ends
      if (X.lite && (k >> 1) % 2) continue;
      const ang = (2 * Math.PI * (k + X.hash(k, 71))) / n,
        sp = 30 + 40 * X.hash(k, 72),
        vz = 70 + 70 * X.hash(k, 73),
        tf = (2 * vz) / 400,
        a = age < tf ? age : tf + (age - tf) * 0.4,
        z = age < tf ? vz * age - 200 * age * age : 0.25 * vz * (age - tf) * Math.max(0, 1 - 2.5 * (age - tf)),
        x = Math.round(cx + sp * a * Math.cos(ang)),
        y = Math.round(cy + 0.45 * sp * a * Math.sin(ang) - z),
        s = X.hash(k, 74) < 0.4 ? 2 : 1;
      ctx.rect(x, y - s, s, s);
    }
    ctx.fillStyle = pal[l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// The shock ring on the floor: a 1 px ellipse growing out of the slam.
function flash(X, cx, cy, age, alpha) {
  if (age < 0 || age >= FLASH) return;
  const ctx = X.ctx,
    f = age / FLASH,
    a = Math.round(5 + 19 * out2(f)),
    b = Math.max(2, Math.round(a * 0.45));
  ctx.globalAlpha = alpha * (1 - f) * (X.night ? 0.9 : 0.8);
  ctx.beginPath();
  Kit.ellipse(a, b, (x, y) => ctx.rect(cx + x, cy + y, 1, 1));
  ctx.fillStyle = X.night ? '#ffe9a8' : '#fffaf0';
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Speed lines behind the flier, along the screen heading; flickering, one fill.
function streaks(X, p, alpha) {
  const n = Math.hypot(p.vx, p.vy);
  if (n < 60 || alpha <= 0.01) return;
  const ctx = X.ctx,
    ux = -p.vx / n,
    uy = -p.vy / n,
    ox = p.fx,
    oy = p.fy - (p.rot ? 8 : 10), // from the body's middle
    put = (x, y) => ctx.rect(x, y, 1, 1);
  ctx.globalAlpha = alpha * Math.min(1, n / 200) * (X.night ? 0.5 : 0.7);
  ctx.beginPath();
  for (let j = -1; j <= 1; j++) {
    const fl = X.hash(Math.floor(X.L.secs * 20) + 5 * j, 81),
      d0 = 12 + 3 * Math.abs(j) + Math.round(4 * fl),
      d1 = d0 + 5 + Math.round(6 * X.hash(j + 3, 82)),
      sx = Math.round(-uy * 4 * j),
      sy = Math.round(ux * 4 * j);
    Kit.line(
      Math.round(ox + ux * d0) + sx,
      Math.round(oy + uy * d0) + sy,
      Math.round(ox + ux * d1) + sx,
      Math.round(oy + uy * d1) + sy,
      put,
    );
  }
  ctx.fillStyle = X.night ? '#c9d6ff' : '#ffffff';
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Glints round the knot while the cape swirls on and while it folds away.
function glints(X, p, g, alpha) {
  if (g <= 0 || g >= 1 || alpha <= 0.01) return;
  const ctx = X.ctx;
  ctx.globalAlpha = alpha * Math.sin(Math.PI * g);
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const ang = 2 * Math.PI * (k / 3 + g * 0.6 + X.hash(k, 91) * 0.2),
      d = 7 + 4 * g,
      x = Math.round(p.cx + d * Math.cos(ang)),
      y = Math.round(p.cy + 2 + 0.7 * d * Math.sin(ang));
    ctx.rect(x, y - 1, 1, 3);
    ctx.rect(x - 1, y, 3, 1);
  }
  ctx.fillStyle = '#fff1b8';
  ctx.fill();
  ctx.globalAlpha = 1;
}

// The clocks of the launch dust and of the slam (real s since the leap and since the hit).
const age0 = X => real(X.L.v, X.L.d) - real(B.LEAP, X.L.d),
  age1 = X => real(X.L.v, X.L.d) - real(B.HIT, X.L.d),
  // the slam's age when the arrival starts, for the cracks (the arrival's length is the profile's)
  HIT_S = ((B.HIT - ARR) / (REL - ARR)) * TpStyles.BY_ID.caped.arr,
  CRACK = 4; // s the cracks stay after the slam

const O = { pose: 'stand', front: null, alpha: 1, legs: 1, rot: 0 };
// The whole picture at one depth: dust behind, cape and body in facing order, the fist, then what flies in front.
// A cut fades the effect only; the person keeps the pose's alpha.
function draw(X, p, end) {
  const L = X.L,
    C = L.C,
    a = Math.min(1, p.a),
    v = L.v;
  if (a <= 0.01) return;
  const front = p.front == null ? !!X.a.dirFront : p.front,
    under = p.rot === 0 && (front || p.dy < -0.5),
    ca = a * C * p.ca,
    gx = end ? X.x1 : X.x0,
    gy = end ? X.y1 : X.y0,
    dAge = end ? age1(X) : age0(X);
  if (end >= 0) dust(X, gx, gy, dAge, end === 1, 0, C);
  if (end < 0) streaks(X, p, a * C);
  else if (end === 1 && v < B.HIT) streaks(X, p, a * C);
  if (under) cape(X, p, L.secs, ca, front);
  O.pose = p.pose;
  O.front = p.front;
  O.legs = p.legs;
  O.rot = p.rot;
  O.alpha = a;
  X.bodyAt(p.fx, p.fy, O);
  if (!under) cape(X, p, L.secs, ca, front);
  else if (front && p.rot === 0 && p.dy > 0 && p.len >= 3) collar(X, p, ca);
  if (p.fist) {
    // a fist planted on the floor beside the knee
    const s = front ? -1 : 1;
    X.ctx.globalAlpha = a;
    X.ctx.fillStyle = X.a.skin || '#e0b090';
    X.ctx.fillRect(p.fx + 5 * s - (s < 0 ? 1 : 0), p.fy - 2, 2, 2);
    X.ctx.globalAlpha = 1;
  }
  if (end >= 0) dust(X, gx, gy, dAge, end === 1, 1, C);
  if (end === 1) debris(X, gx, gy, dAge, C);
  if (end === 0 && !L.hide) glints(X, p, r(v, B.CAPE[0], B.CAPE[1]), C);
  if (end === 1) glints(X, p, r(v, B.FOLD[0], B.FOLD[1]), C);
}
// The shadow under the feet while the remapped body (which has none) stands or rises low.
function shade(X, end, h) {
  Kit.shadow(X.ctx, end ? X.x1 : X.x0, end ? X.y1 : X.y0, 14 - h / 4, Math.max(0, 0.9 - h / 50));
}

// Cracks: a web of jagged rays round a small pit, with a chipped light edge under each line. Three shapes baked
// once, by day and by night, into one sheet.
const CW = 48,
  CH = 26,
  NV = 3;
const CRK = [
  ['rgba(52,36,26,0.8)', 'rgba(255,246,226,0.5)', 'rgba(36,24,18,0.9)'],
  ['rgba(8,8,16,0.85)', 'rgba(160,170,205,0.35)', 'rgba(4,4,10,0.95)'],
];
export function crackPixels(vk) {
  const px = new Uint8Array(CW * CH),
    cx = CW >> 1,
    cy = CH >> 1,
    put = (x, y) => {
      if (x >= 0 && y >= 0 && x < CW && y < CH) px[y * CW + x] = 1;
    },
    h = (k, s) => Kit.hash(vk + 1, k, s),
    n = 7,
    mid = [];
  for (let k = 0; k < n; k++) {
    let ang = (2 * Math.PI * (k + 0.6 * h(k, 1))) / n,
      x = cx,
      y = cy;
    const len = 12 + 10 * h(k, 2);
    for (let s = 1; s <= 3; s++) {
      ang += (h(k, 3 + s) - 0.5) * 0.7;
      const d = (len * s) / 3,
        nx = Math.round(cx + d * Math.cos(ang)),
        ny = Math.round(cy + 0.48 * d * Math.sin(ang));
      Kit.line(x, y, nx, ny, put);
      if (s === 1) mid.push(nx, ny);
      if (s === 2 && h(k, 8) < 0.6) {
        const b = ang + (h(k, 9) < 0.5 ? -0.7 : 0.7);
        Kit.line(nx, ny, Math.round(nx + 5 * Math.cos(b)), Math.round(ny + 2.4 * Math.sin(b)), put);
      }
      x = nx;
      y = ny;
    }
  }
  // the web's strands between neighbouring rays, a few left out
  for (let k = 0; k < n; k++) {
    if (h(k, 10) < 0.3) continue;
    const j = (k + 1) % n;
    Kit.line(mid[2 * k], mid[2 * k + 1], mid[2 * j], mid[2 * j + 1], put);
  }
  for (let y = -1; y <= 1; y++)
    for (let x = -3; x <= 3; x++) if (Math.abs(x) + 2 * Math.abs(y) <= 3) px[(cy + y) * CW + cx + x] = 3;
  for (let i = CW * CH - 1 - CW; i >= 0; i--) if (px[i] && !px[i + CW]) px[i + CW] = 2;
  return px;
}
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = atlas(CW * NV, 2 * CH, g => {
    for (let l = 0; l < 2; l++)
      for (let k = 0; k < NV; k++) Kit.bake(g, crackPixels(k), CW, CH, k * CW, c => CRK[l][c - 1], l * CH);
  }));
// The cracks at a slam's age: they run out from the pit in a blink, hold, and fade over the last second and a half.
function cracks(X, age) {
  if (age < 0 || age >= CRACK) return;
  const g = out2(Math.min(1, age / 0.1)),
    w = Math.max(2, 2 * Math.round((CW * g) / 2)),
    h = Math.max(2, 2 * Math.round((CH * g) / 2)),
    vk = Math.floor(X.hash(0, 99) * NV) % NV,
    ctx = X.ctx;
  ctx.globalAlpha = 1 - ease(r(age, CRACK - 1.5, CRACK));
  X.stamp(sheetOf(), vk * CW + (CW - w) / 2, (X.night ? CH : 0) + (CH - h) / 2, w, h, X.x0 - w / 2, X.y0 - h / 2, w, h);
  ctx.globalAlpha = 1;
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
    if (!L.hide && L.sw && age0(X) < DUST) n |= PART.S0;
    if (L.sw && v >= ARR) n |= PART.F1;
    return n;
  },
  floor(X, end) {
    const p = picture(X, X.L.v, X.L.secs);
    shade(X, end, end ? p.h : p.h - perch(X.tp.stool));
    if (end) flash(X, X.x1, X.y1, age1(X), X.L.C);
  },
  // The launch dust left rolling at the origin once they are away.
  stand(X) {
    dust(X, X.x0, X.y0, age0(X), false, 2, X.L.C);
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
  // The web of cracks under the slam, fading after the walker has gone.
  marks: [{ at: 'arr', end: 1, ttl: HIT_S + CRACK, layer: 'floor' }],
  drawMark(X, m, age) {
    cracks(X, age - HIT_S);
  },
  gap: null,
};
// Exposed for tests.
export const CAPED = { B, H0, ARRH, KNEEL, HIT_S, CRACK, CAPEL, picture, cruise, need: STYLE.need };
