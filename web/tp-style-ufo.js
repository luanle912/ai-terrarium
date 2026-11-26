// ufo: a flying saucer swoops down over the person, its tractor beam snaps on and lifts them, spinning and shrinking,
// into the hull. The saucer flies over the island with the passenger's shadow in its dome, hovers over the desk and
// lowers them in the beam; the beam cuts out a hand's breadth early, they drop, squash and stand there dizzy under a
// ring of stars while the saucer zips off into the sky.
// The saucer rides the trip item (always high enough for the overlay); the beam is the back item at its end with a
// faint veil, motes and scan rings in front (the stand item), so the body is inside it; the light pool is the floor
// item. The body is drawn by person() at the walker's depth, clipped at the hull's belly. One body pass.
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
    SWOOP: at(0.34), // the saucer has swooped down to its hover
    SPOT0: at(0.2), // they spot it: "!"
    SPOT1: at(0.42),
    BEAM0: at(0.34), // the beam snaps on (a flicker) ...
    BEAM1: at(0.44), // ... and reaches the floor
    RISE0: at(0.46), // lifted (a stool sitter from SQUEEZE, once off the stool)
    RISE1: at(0.86), // inside the hull
    SHUT0: at(0.86), // the beam pulls back up
    SHUT1: at(0.97),
    ON0: ar(0.1), // the beam again, over the desk
    ON1: ar(0.2),
    LOW0: ar(0.18), // lowered ...
    LOW1: ar(0.62), // ... to a hand's breadth over the floor
    CUT: ar(0.64), // the beam cuts out: they drop
    FLOOR: ar(0.7),
    DIZZY: ar(0.72), // squash, then dizzy stars
    ZIP0: fd(0.04), // the saucer zips off ...
    ZIP1: fd(0.42), // ... and is gone
    STARS: fd(0.9), // the stars have faded
  },
  QA = 0.45, // the queued saucer's alpha, high up where the swoop starts
  HOV = 44, // px from the feet to the saucer's rim while it hovers
  BELLY = 40, // px from the feet to the hull's belly
  DROP = 5, // px the person falls when the beam cuts out
  SWX = 34, // the swoop starts this far to the side (px) ...
  SWY = 64, // ... and this much higher
  TILT = 0.2;

// The saucer in px from its rim centre (y down): 1 hull, 2 belly, 3 dome. Lights sit on the rim band.
function part(x, y) {
  if (y <= -1.6 && (x / 6.2) ** 2 + ((y + 1.6) / 6) ** 2 <= 1) return 3;
  if ((x / 14.6) ** 2 + (y / 3.7) ** 2 <= 1) return 1;
  if (y > 0 && (x / 7.6) ** 2 + ((y - 1.6) / 3) ** 2 <= 1) return 2;
  return 0;
}
const LIGHTS = [-10.5, -6.5, -2.5, 1.5, 5.5, 9.5];
const SW = 32,
  SH = 16,
  AX = 16, // the rim centre's pixel in a saucer cell
  AY = 9;
// Codes: 1 outline, 2 hull shade, 3 hull, 4 hull light, 5 glint, 6 dome shade, 7 dome, 8 dome light, 9 band,
// 10 light off, 11 light on, 12 belly, 13 belly port. Tilt rotates about the rim centre; phase picks the lit lights.
export function saucerPixels(tilt, phase) {
  const px = new Uint8Array(SW * SH),
    id = new Uint8Array(SW * SH),
    c = Math.cos(tilt),
    s = Math.sin(tilt);
  const local = (i, j) => {
    const x = i + 0.5 - AX,
      y = j + 0.5 - AY;
    return [c * x + s * y, -s * x + c * y];
  };
  for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) id[j * SW + i] = part(...local(i, j));
  const on = (i, j) => i >= 0 && j >= 0 && i < SW && j < SH && id[j * SW + i] > 0;
  for (let j = 0; j < SH; j++)
    for (let i = 0; i < SW; i++) {
      const k = id[j * SW + i];
      if (!k) continue;
      const [x, y] = local(i, j);
      let col;
      if (!on(i - 1, j) || !on(i + 1, j) || !on(i, j - 1) || !on(i, j + 1)) col = 1;
      else if (k === 3) col = (x + 2.2) ** 2 + (y + 5) ** 2 < 2.6 ? 8 : x > 2.4 || y > -2.4 ? 6 : 7;
      else if (k === 2) col = Math.abs(x) < 2.2 && y > 2.2 ? 13 : 12;
      else if (Math.abs(y - 0.4) < 0.8) {
        const l = LIGHTS.findIndex(lx => Math.abs(x - lx) < 0.8);
        col = l < 0 ? 9 : (l + phase) % 3 === 0 ? 11 : 10;
      } else if (y < -0.4) col = (x + 8) ** 2 + (y + 2) ** 2 < 1.6 ? 5 : y < -2 || x < -6 ? 4 : 3;
      else col = 2;
      px[j * SW + i] = col;
    }
  return px;
}
// Rows: day, night (darker hull, the dome and the lights glow).
const SAUC = [
  [
    null,
    '#262b36',
    '#6d7684',
    '#a3acb9',
    '#d7dde6',
    '#ffffff',
    '#4f9cc4',
    '#8fd6f2',
    '#e2f8ff',
    '#4b5361',
    '#7d6f3e',
    '#ffd54a',
    '#59616f',
    '#c8f8ff',
  ],
  [
    null,
    '#12151c',
    '#3c4350',
    '#5e6775',
    '#8a93a2',
    '#c9d1dd',
    '#3f95c4',
    '#76d8fa',
    '#d4f8ff',
    '#2c323d',
    '#5c5130',
    '#ffe88a',
    '#373e4a',
    '#e2fcff',
  ],
];
// The beam from the belly to the floor: a cone (half-width 4 to 12 px) with bright edges and two faint streaks.
const BW = 27,
  BH = BELLY + 2,
  BC = 13;
export function beamPixels() {
  const px = new Uint8Array(BW * BH);
  for (let j = 0; j < BH; j++) {
    const hw = lerp(4, 12.4, j / (BH - 1));
    for (let i = 0; i < BW; i++) {
      const x = Math.abs(i - BC);
      if (x > hw) continue;
      px[j * BW + i] = x > hw - 1 ? 2 : Math.abs(x - 0.45 * hw) < 0.5 ? 3 : 1;
    }
  }
  return px;
}
// The light pool on the floor: 1 fill, 2 rim.
const PW = 27,
  PH = 11;
export function poolPixels() {
  const px = new Uint8Array(PW * PH);
  for (let j = 0; j < PH; j++)
    for (let i = 0; i < PW; i++) {
      const q = ((i - 13) / 13.4) ** 2 + ((j - 5) / 5.4) ** 2;
      if (q <= 1) px[j * PW + i] = q > 0.62 ? 2 : 1;
    }
  return px;
}
// Rows: day, night, snow outdoors by day (deeper, so it keeps an edge on white). Codes: fill, edge, streak.
const BEAMC = [
  [null, 'rgba(205,248,255,0.34)', 'rgba(240,254,255,0.80)', 'rgba(225,252,255,0.45)'],
  [null, 'rgba(140,232,255,0.30)', 'rgba(200,250,255,0.85)', 'rgba(170,242,255,0.46)'],
  [null, 'rgba(110,200,235,0.28)', 'rgba(50,150,205,0.80)', 'rgba(90,185,228,0.42)'],
];
const POOLC = [
  [null, 'rgba(225,252,255,0.38)', 'rgba(240,254,255,0.62)'],
  [null, 'rgba(160,238,255,0.36)', 'rgba(205,250,255,0.62)'],
  [null, 'rgba(120,205,238,0.32)', 'rgba(60,160,210,0.62)'],
];
// A four-point dizzy star: 1 gold rim, 2 yellow, 3 white heart.
const STAR = '0010001210123210121000100';
const SY0 = 2 * SH, // atlas row of the beams, pools and the star
  PX0 = 3 * BW;
let sheet = null;
// Saucers by light (rows) and tilt x phase (columns); then the beams, the pools and the star.
const sheetOf = () =>
  sheet ||
  (sheet = atlas(9 * SW, SY0 + BH, g => {
    for (let l = 0; l < 2; l++)
      for (let t = 0; t < 3; t++)
        for (let f = 0; f < 3; f++)
          bake(g, saucerPixels((t - 1) * TILT, f), SW, SH, (3 * t + f) * SW, c => SAUC[l][c], l * SH);
    for (let k = 0; k < 3; k++) {
      bake(g, beamPixels(), BW, BH, k * BW, c => BEAMC[k][c], SY0);
      bake(g, poolPixels(), PW, PH, PX0 + k * PW, c => POOLC[k][c], SY0);
    }
    const st = Uint8Array.from(STAR, Number);
    bake(g, st, 5, 5, PX0 + 3 * PW, c => [null, '#b8741c', '#ffd83d', '#fffbe0'][c], SY0);
  }));

// shortcut: read every frame, so an early re-aim to the other side flips it in one frame; tp has no fixed side yet.
const face = X => (X.x1 >= X.x0 ? 1 : -1);
const lightOf = X => (X.night ? 1 : 0);
const beamRow = (X, end) =>
  X.night ? 1 : X.snow > 0 && (end ? outdoors(X.tx1, X.ty1) : outdoors(X.tx0, X.ty0)) ? 2 : 0;
// Cruise height over the hover (px), from the current tp every frame.
const cruise = len => Math.min(60, Math.max(18, 10 + 1.6 * (len || 0)));
const s0 = stool => (stool ? SQUEEZE : B.RISE0);
// The lit lights' phase, 0-2 (the clock is negative while queued).
const blink = n => ((Math.floor(n) % 3) + 3) % 3;

// Where the saucer is: rim centre px, alpha, height over its ground tile, ground tile, tilt (-1, 0, 1), lights phase,
// passenger in the dome.
const Q = { x: 0, y: 0, a: 0, h: 0, gx: 0, gy: 0, tilt: 0, ph: 0, pass: false };
// The saucer dx px to the side and dy px higher than its hover over an end.
function hover(X, end, dx, dy, out) {
  const fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0;
  out.x = Math.round(fx + dx);
  out.y = Math.round(fy - HOV - dy);
  out.h = HOV + dy;
  out.gx = (end ? X.tx1 : X.tx0) + dx / TW / 2;
  out.gy = (end ? X.ty1 : X.ty0) - dx / TW / 2;
  return out;
}
function fly(X, p, out) {
  const e = ease(clamp(p)),
    up = cruise(X.tp.len) * Math.sin(Math.PI * e),
    bob = Math.round(1.5 * Math.sin(X.L.secs * 12) * Math.sin(Math.PI * e)),
    s = face(X);
  out.x = Math.round(lerp(X.x0, X.x1, e));
  out.y = Math.round(lerp(X.y0, X.y1, e) - HOV - up) + bob;
  out.h = HOV + up - bob;
  out.gx = lerp(X.tx0, X.tx1, e);
  out.gy = lerp(X.ty0, X.ty1, e);
  out.tilt = p < 0.05 || p > 0.92 || Math.abs(X.x1 - X.x0) < 8 ? 0 : p < 0.72 ? s : -s;
  return out;
}
function where(X) {
  const L = X.L,
    v = L.v,
    s = face(X);
  Q.tilt = 0;
  Q.ph = blink(L.secs * 7);
  if (L.trip >= 0) {
    fly(X, L.trip, Q);
    Q.a = 1;
    Q.ph = blink(L.secs * 12);
    Q.pass = true;
    return Q;
  }
  if (v < ARR) {
    if (L.hide) {
      hover(X, 0, 0, 0, Q);
      Q.a = r(v, L_IN, DEP - 0.03) * L.C;
      Q.pass = true;
      return Q;
    }
    const e = out2(r(v, 0, B.SWOOP));
    hover(X, 0, -s * SWX * (1 - e), SWY * (1 - e), Q);
    // it leans into the swoop and levels out as it brakes
    if (v < B.SWOOP) Q.tilt = e < 0.75 ? s : 0;
    Q.a = (L.q ? QA : lerp(QA, 1, r(v, 0, at(0.12)))) * L.C;
    Q.pass = v >= B.RISE1;
    return Q;
  }
  const z = in2(r(v, B.ZIP0, B.ZIP1));
  hover(X, 1, s * 110 * z, 170 * z, Q);
  if (z > 0) Q.tilt = s;
  Q.a = 1 - r(v, fd(0.28), B.ZIP1);
  Q.pass = v < B.LOW0;
  return Q;
}

function saucer(X, q) {
  if (q.a <= 0.01) return;
  const img = sheetOf(),
    ctx = X.ctx,
    col = (3 * (q.tilt + 1) + q.ph) * SW;
  ctx.globalAlpha = Math.min(1, q.a);
  X.stamp(img, col, lightOf(X) * SH, SW, SH, q.x - AX, q.y - AY, SW, SH);
  if (q.pass) {
    // the passenger's shadow in the dome: a head and shoulders
    ctx.globalAlpha = Math.min(1, q.a) * 0.6;
    ctx.fillStyle = X.night ? '#0d2a3a' : '#1d4a63';
    ctx.beginPath();
    ctx.rect(q.x - 1 + q.tilt, q.y - 6, 3, 2);
    ctx.rect(q.x - 2 + q.tilt, q.y - 3, 5, 1);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// Speed lines streaming off the rim behind the saucer, longer at full speed: one fill. Along its heading on screen
// (the hump's climb or sink included), and none when that is steep, where they would hang like drips.
function trail(X, q) {
  if (X.lite) return;
  const L = X.L,
    ctx = X.ctx,
    dx = X.x1 - X.x0,
    dy = X.y1 - X.y0 - Math.PI * cruise(X.tp.len) * Math.cos(Math.PI * ease(clamp(L.trip))),
    n = Math.hypot(dx, dy),
    sp = 6 * L.trip * (1 - L.trip);
  if (n < 4 || sp < 0.3 || Math.abs(dy) > 1.5 * Math.abs(dx)) return;
  const ux = -dx / n,
    uy = -dy / n,
    len = Math.round(4 + 9 * sp);
  ctx.beginPath();
  for (const off of [-2, 2])
    for (let k = 0; k < len; k += 2) {
      const d = 12 + k + (off > 0 ? 3 : 0);
      ctx.rect(Math.round(q.x + ux * d - uy * off), Math.round(q.y + uy * d + ux * off), 1, 1);
    }
  ctx.globalAlpha = 0.75 * clamp(sp - 0.3);
  ctx.fillStyle = X.night ? '#b6f4ff' : '#ffffff';
  ctx.fill();
  ctx.globalAlpha = 1;
}

// The beam's reach at an end: rows of the cone showing (from the belly down), 0 when off; flicker as it snaps on.
function reach(X, end) {
  const L = X.L,
    v = L.v;
  if (L.trip >= 0 || L.q || (!end && L.hide)) return 0;
  let k;
  if (!end) {
    if (v < B.BEAM0 || v >= B.SHUT1) return 0;
    const flick = v < B.BEAM0 + 0.012 || (v > B.BEAM0 + 0.02 && v < B.BEAM0 + 0.028);
    if (flick) return 0;
    k = v < B.SHUT0 ? out2(r(v, B.BEAM0, B.BEAM1)) : 1 - in2(r(v, B.SHUT0, B.SHUT1));
  } else {
    if (v < B.ON0 || v >= B.CUT) return 0;
    if (v > B.ON0 + 0.008 && v < B.ON0 + 0.016) return 0;
    k = out2(r(v, B.ON0, B.ON1));
  }
  return Math.round(BH * k);
}
function beam(X, end, alpha) {
  const n = reach(X, end);
  if (n <= 0) return;
  const fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0;
  X.ctx.globalAlpha = alpha * X.L.C * (end ? 1 : 1 - 0.6 * r(X.L.v, B.SHUT0, B.SHUT1));
  X.stamp(sheetOf(), beamRow(X, end) * BW, SY0, BW, n, fx - BC, fy - BH, BW, n);
  X.ctx.globalAlpha = 1;
}
// The light pool, while the beam reaches the floor.
function pool(X, end) {
  const n = reach(X, end);
  if (n < BH - 2) return;
  const fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0;
  X.ctx.globalAlpha = X.L.C;
  X.stamp(sheetOf(), PX0 + beamRow(X, end) * PW, SY0, PW, PH, fx - 13, fy - 5, PW, PH);
  X.ctx.globalAlpha = 1;
}
// In front of the body: motes drifting up (down on landing) and two scan rings, one fill each.
function front(X, end) {
  const n = reach(X, end);
  if (n <= 6) return;
  beam(X, end, 0.32);
  const L = X.L,
    ctx = X.ctx,
    fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0,
    top = fy - BH,
    dir = end ? 1 : -1,
    night = X.night,
    snowy = beamRow(X, end) === 2;
  ctx.beginPath();
  for (let k = 0; k < 2; k++) {
    const g = Kit.frac(k / 2 + dir * L.secs * 1.6),
      j = Math.round(g * (n - 1)),
      hw = Math.round(lerp(4, 12.4, j / (BH - 1))) - 1;
    ctx.rect(fx - hw, top + j, 2 * hw + 1, 1);
  }
  ctx.globalAlpha = 0.5 * L.C;
  ctx.fillStyle = snowy ? '#3f9cd0' : night ? '#c8f6ff' : '#ffffff';
  ctx.fill();
  if (!X.lite) {
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const g = Kit.frac(X.hash(k, 3) + dir * L.secs * (0.9 + 0.4 * X.hash(k, 7))),
        j = Math.round(g * (n - 1)),
        hw = lerp(4, 12.4, j / (BH - 1)) - 2;
      ctx.rect(Math.round(fx + (X.hash(k, 11) * 2 - 1) * hw), top + j, 1, 1);
    }
    ctx.globalAlpha = 0.9 * L.C;
    ctx.fillStyle = snowy ? '#2f86bb' : '#ffffff';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// The body in the beam at an end: feet px, scale, and the top of what shows (rows above the feet); on = false when
// it is all inside the hull.
const F = { x: 0, y: 0, s: 1, top: 99, on: true, spin: 0 };
function lifted(X, end, v) {
  const fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0;
  let e;
  if (!end) e = ease(r(v, s0(X.tp.stool), B.RISE1));
  else if (v < B.CUT) e = 1 - ease(r(v, B.LOW0, B.LOW1)) * (1 - DROP / BELLY);
  else e = (DROP / BELLY) * (1 - in2(r(v, B.CUT, B.FLOOR)));
  F.x = fx;
  F.y = Math.round(fy - e * BELLY);
  F.s = 1 - 0.55 * Math.min(1, e / 0.9);
  F.top = (F.y - (fy - BELLY)) / F.s;
  F.on = F.top > 1;
  F.spin = e > 0.03 ? Math.floor(X.L.secs * (6 + 8 * e)) % 2 : 0;
  return F;
}
const O = { pose: 'up', front: true, mirror: false, sx: 1, sy: 1, clip: [99, -6] };
function inBeam(X, end, v) {
  const f = lifted(X, end, v);
  if (!f.on) return;
  O.pose = 'up';
  O.front = !f.spin;
  O.mirror = !!f.spin;
  O.sx = O.sy = f.s;
  O.clip[0] = f.top;
  X.bodyAt(f.x, f.y, O);
}
// Dizzy stars orbiting over the head; near or far side of it.
function stars(X, hx, hy, a, near) {
  if (a <= 0.02) return;
  const n = X.lite ? 2 : 3,
    img = sheetOf();
  X.ctx.globalAlpha = Math.min(1, a);
  for (let k = 0; k < n; k++) {
    const ang = X.L.secs * 6 + (k * 2 * Math.PI) / n;
    if (Math.sin(ang) > 0 !== near) continue;
    X.stamp(
      img,
      PX0 + 3 * PW,
      SY0,
      5,
      5,
      Math.round(hx + 9 * Math.cos(ang)) - 2,
      Math.round(hy + 3 * Math.sin(ang)) - 2,
      5,
      5,
    );
  }
  X.ctx.globalAlpha = 1;
}
const D = { pose: 'stand', front: true, sx: 1, sy: 1 },
  WALK = { bare: false };
// After the drop: a squash, a sway and the stars, until the stars fade (the person walks on from the release).
function dizzy(X, v) {
  const a = X.a,
    held = v < REL,
    hp = X.page.headPos ? X.page.headPos(a) : [X.x1, X.y1 - 21],
    sway = held && v >= B.DIZZY ? Math.round(Math.sin(X.L.secs * 9)) : 0,
    alpha = r(v, B.DIZZY, B.DIZZY + 0.03) * (1 - r(v, fd(0.6), B.STARS)),
    hx = hp[0] + sway,
    hy = hp[1] - 1;
  stars(X, hx, hy, alpha, false);
  if (!held) X.body(WALK);
  else {
    const sq = Math.sin(Math.PI * r(v, B.FLOOR, B.DIZZY + 0.04));
    D.sx = 1 + 0.18 * sq;
    D.sy = 1 - 0.2 * sq;
    X.bodyAt(X.x1 + sway, X.y1, D);
  }
  stars(X, hx, hy, alpha, true);
}

export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q) return 64;
    if (v >= B.ZIP1 || (L.hide && !L.sw && v < L_IN)) return 0;
    let n = 64;
    if (where(X).a >= 0.3) n |= 128;
    if (reach(X, 0) > 0) n |= 1 | 4 | 16;
    if (reach(X, 1) > 0) n |= 2 | 8 | 32;
    return n;
  },
  back(X, end) {
    beam(X, end, 1);
  },
  floor(X, end) {
    pool(X, end);
  },
  stand(X, end) {
    front(X, end);
  },
  trip(X) {
    const q = where(X);
    if (X.L.trip >= 0) trail(X, q);
    saucer(X, q);
  },
  // The ground point under the saucer; it never flies lower than the overlay height.
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
    if (L.q) return false;
    if (L.sw && v >= B.STARS) return false;
    if (L.trip >= 0 || (L.hide && !L.sw)) return true;
    if (!L.sw) {
      if (v < DEP) leave(X, v);
    } else if (v >= ARR) {
      if (v < B.FLOOR) inBeam(X, 1, v);
      else dizzy(X, v);
    }
    return true;
  },
  marks: [],
  gap: null,
};
// The departure: as they are (a stool sitter until they stand), arms up when the beam hits, then lifted in.
function leave(X, v) {
  const stool = X.tp.stool;
  if (v < s0(stool)) {
    X.body(v < SQUEEZE && stool ? {} : v >= B.BEAM0 + 0.03 ? { pose: 'up', front: true } : {});
    if (v >= B.SPOT0 && v < B.SPOT1) {
      // a startled "!" as the saucer comes down on them
      const hp = X.page.headPos ? X.page.headPos(X.a) : [X.x0, X.y0 - 21],
        hy = hp[1] - 2 - (v < B.SPOT0 + 0.02 ? 1 : 0);
      X.text('!', hp[0] + 1, hy + 1, '#3a2a10');
      X.text('!', hp[0], hy, '#fff8d0');
    }
    return;
  }
  inBeam(X, 0, v);
}
// Exposed for tests.
export const UFO = { B, QA, HOV, BELLY, DROP, cruise, s0, where, reach, lifted, trail, need: STYLE.need };
