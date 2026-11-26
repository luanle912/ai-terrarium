// jetpack: a twin-tank jetpack drops onto their back with a clank, the nozzles cough twice, they crouch and it fires:
// twin flames, a billow of smoke on the floor, and they lift off. A wobbly flight over the island on two jets with a
// smoke trail (one hiccup on a long trip: the flames die, they drop with arms up, it roars back), then a braking
// descent into a cloud of smoke; the flames cut, the pack unclips and rockets off into the sky, and the smoke thins
// round them (a lasting mark). Body, pack and flames are one picture: person() at both ends, trip() in flight and
// for a hidden start. ground() reports the real height. One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { TpStyles } from './tp-styles.js';
import { TH, TW } from './office-scene.js';

const { atlas, r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR, T, core, real } = TeleportLogic;
const { RELEASE: REL, L_IN } = T,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  B = {
    DROP: at(0.04), // the pack falls in from above ...
    CLANK: at(0.2), // ... lands on their back ...
    SET: at(0.32), // ... and settles
    COUGH: [at(0.38), at(0.48)], // the nozzles cough
    CROUCH: at(0.46), // knees bend ...
    IGN: at(0.6), // ... it fires
    LIFT: at(0.7), // the feet leave the floor
    HIT: ar(0.16), // coming down: the flames reach the floor
    DOWN: ar(0.38), // touchdown, flames off
    OFF: ar(0.56), // the pack unclips ...
    GONE: ar(0.8), // ... and is out of sight
    HIC: [0.46, 0.6], // trip fractions of the hiccup on a long trip: the flames die and they drop
  },
  CLOUD = 1.6, // s a take-off cloud lasts from ignition
  CLOUD1 = 2.2, // ... and the landing cloud from the flames reaching the floor
  DROPH = 44, // px the pack falls from
  LIFT = 12, // px the feet are off the floor at take-off
  ARRH = 22, // ... as they come in over the landing
  RISE = 110, // px the pack climbs as it leaves
  DROP = 24, // px they drop in the hiccup
  PACKY = 15, // px from the body's base up to the pack's top
  MEANDER = 0.3; // tiles the wobbly flight weaves off the straight line

// Pack raster, 16 x 12: two tanks with red caps either side of a plate, a bell nozzle under each tank.
const PW = 16,
  PH = 12,
  JET = [-7, 5], // nozzle's left px from the body's centre column
  ROWS = [
    '.rR..........rR.',
    'rRRD........rRRD',
    'ooooPPPPPPPPoooo',
    'wmmMppppppppwmmM',
    'wmmMpppyypppwmmM',
    'wmmMppppppppwmmM',
    'wmmMpMpMpMpMwmmM',
    'wmmMppppppppwmmM',
    'wmmMoooooooowmmM',
    'oMMo........oMMo',
    '.nN..........nN.',
    'nNNn........nNNn',
  ],
  KEYS = 'rRDowmMpPyNn',
  DAY = [
    '#f2775a',
    '#d4432f',
    '#93281f',
    '#4b525e',
    '#f1f4f8',
    '#c3cad4',
    '#8a93a1',
    '#5d6573',
    '#7c8696',
    '#ffd23f',
    '#6a707c',
    '#3a3e47',
  ];
export function packPixels() {
  const px = new Uint8Array(PW * PH);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) px[y * PW + x] = KEYS.indexOf(ROWS[y][x]) + 1;
  return px;
}
const hex = (c, k) => parseInt(c.slice(1 + 2 * k, 3 + 2 * k), 16);
const dim = c => `rgb(${[0, 1, 2].map(k => Math.round(hex(c, k) * 0.78 + 4)).join(',')})`;
const PAL = [DAY, DAY.map(dim)];
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = atlas(PW, 2 * PH, g => {
    for (let l = 0; l < 2; l++) Kit.bake(g, packPixels(), PW, PH, 0, c => PAL[l][c - 1], l * PH);
  }));
// The pack with the body's centre column at cx and its top at y.
const pack = (X, cx, y) => X.stamp(sheetOf(), 0, X.night ? PH : 0, PW, PH, cx - 8, y, PW, PH);

const cruise = len => Math.min(96, Math.max(34, 18 + 2.6 * (len || 0))),
  waves = len => Math.min(3, Math.max(1, Math.round((len || 0) / 9))),
  bump = t => ease(r(t, 0, 0.4)) * (1 - ease(r(t, 0.62, 1))),
  perch = stool => (stool === 2 ? 9 : stool ? 4 : 0),
  hiccup = len => (len || 0) >= 10,
  // shortcut: read every frame, so an early re-aim the other way turns them in one frame; tp has no fixed facing.
  facing = X => X.y1 >= X.y0,
  flick = (X, secs, k) => (X.hash(Math.floor(secs * 24) + 13 * k, 40) < 0.5 ? 0 : 1);

// The picture at core v, idle time secs: feet, pose, alpha, the pack (attached or leaving), flames, ground and height.
const P = {
    fx: 0,
    fy: 0,
    base: 0,
    pose: 'stand',
    front: null,
    legs: 1,
    a: 1,
    on: true,
    pa: 1,
    px: 0,
    py: 0,
    n: 0,
    slant: 0,
    gx: 0,
    gy: 0,
    h: 0,
  },
  Q = { ...P };
function reset(p) {
  p.pose = 'stand';
  p.front = null;
  p.legs = 1;
  p.a = p.pa = 1;
  p.on = true;
  p.n = p.slant = 0;
}
// The pack on their back (dy: px above its seat while it falls in or leaves).
function seat(p, dy = 0) {
  p.px = p.fx;
  p.py = p.base - PACKY + dy;
}
function origin(X, v, secs, p) {
  const stool = X.tp.stool,
    sit = stool && v < B.IGN;
  p.gx = X.tx0;
  p.gy = X.ty0;
  p.fx = X.x0;
  if (X.L.hide) {
    p.h = LIFT;
    p.fy = p.base = X.y0 - LIFT;
    p.a = p.pa = r(v, L_IN, DEP - 0.03);
    p.front = facing(X);
    p.n = 9 + flick(X, secs, 0);
    seat(p);
    return p;
  }
  const up = r(v, B.LIFT, DEP),
    fire = v >= B.IGN;
  p.h = sit ? 0 : lerp(perch(stool), LIFT, ease(up));
  if (sit) p.pose = stool === 2 ? 'sitHigh' : 'sit';
  p.fx = X.x0 + (fire ? Math.round(Math.sin(secs * 41)) : 0);
  p.fy = X.y0 - Math.round(p.h);
  p.base = p.fy - (sit ? perch(stool) : 0);
  // they turn the way they will fly as the feet leave the floor, not in the air at the switch
  if (v >= B.LIFT) p.front = facing(X);
  // it lands with a clank that buckles their knees, then they crouch for the shot
  if (!stool) {
    const buckle = Math.sin(Math.PI * r(v, B.CLANK, B.SET)),
      crouch = ease(r(v, B.CROUCH, B.IGN)) * (1 - ease(r(v, B.IGN, B.LIFT)));
    p.legs = 1 - 0.3 * buckle - 0.4 * crouch;
  }
  p.pa = v < B.DROP ? 0 : Math.min(1, 4 * r(v, B.DROP, B.CLANK));
  const fall = Math.round(DROPH * (1 - in2(r(v, B.DROP, B.CLANK)))),
    bounce = Math.round(2 * Math.sin(Math.PI * r(v, B.CLANK, B.SET)));
  seat(p, -fall - bounce);
  // two coughs, then the shot: a long flame that settles as they rise
  for (const c of B.COUGH) if (v >= c && v < c + 0.025) p.n = 2 + flick(X, secs, 1);
  if (fire) p.n = Math.round(lerp(15, 10, r(v, B.IGN, DEP))) + flick(X, secs, 0);
  return p;
}
function flight(X, v, secs, p) {
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
    hic = hiccup(len) ? r(t, B.HIC[0], B.HIC[1]) : 0,
    dip = hiccup(len) ? DROP * Math.sin(Math.PI * r(t, B.HIC[0], B.HIC[1] + 0.08)) : 0;
  p.gx = lerp(X.tx0, X.tx1, e) + ox;
  p.gy = lerp(X.ty0, X.ty1, e) + oy;
  p.h = lerp(LIFT, ARRH, t) + cruise(len) * bump(t) + 2.5 * Math.sin(secs * 6.3) * k - dip;
  p.fx = Math.round(lerp(X.x0, X.x1, e) + (ox - oy) * TW + 2 * Math.sin(secs * 4.7) * k);
  p.fy = p.base = Math.round(lerp(X.y0, X.y1, e) + (ox + oy) * TH - p.h);
  p.front = facing(X);
  seat(p);
  // the flames lean back from the way they go, and wag with the wobble
  const sx = X.x1 - X.x0;
  p.slant = Math.max(-0.5, Math.min(0.5, (-sx / (Math.abs(sx) + 40)) * 0.6 + 0.15 * Math.sin(secs * 4.7)));
  p.n = (t < 0.3 ? 11 : 9) + flick(X, secs, 0);
  if (hic > 0 && hic < 1) {
    // the flames die: arms up, a shudder
    p.n = flick(X, secs, 2) ? 2 : 0;
    p.pose = 'up';
    p.fx += Math.round(1.5 * Math.sin(secs * 53));
    seat(p);
  } else if (hiccup(len) && t >= B.HIC[1] && t < B.HIC[1] + 0.06) p.n = 14;
  return p;
}
function arrival(X, v, secs, p) {
  const down = r(v, ARR, B.DOWN),
    go = r(v, B.OFF, B.GONE);
  p.gx = X.tx1;
  p.gy = X.ty1;
  p.h = ARRH * (1 - out2(down));
  p.fx = X.x1 + (v < B.DOWN ? Math.round(Math.sin(secs * 37)) : 0);
  p.fy = p.base = X.y1 - Math.round(p.h);
  // from touchdown their own facing, the one the walker goes on with
  p.front = v < B.DOWN ? facing(X) : null;
  p.legs = 1 - 0.35 * Math.sin(Math.PI * r(v, B.DOWN, ar(0.54)));
  // braking hard on long flames until the feet touch
  if (v < B.DOWN) p.n = 13 + flick(X, secs, 0);
  const hop = Math.round(Math.sin(Math.PI * r(v, B.OFF - 0.02, B.OFF + 0.02)));
  seat(p, -Math.round(RISE * in2(go)) - hop);
  if (go > 0) {
    p.on = false;
    p.n = 6 + flick(X, secs, 1);
    p.pa = 1 - r(go, 0.7, 1);
  }
  return p;
}
function picture(X, v, secs, p = P) {
  reset(p);
  if (v >= ARR) return arrival(X, v, secs, p);
  if (v >= DEP) return flight(X, v, secs, p);
  return origin(X, v, secs, p);
}

// Smoke puffs from a flat list (x, y, radius): a shade under, the puff, a light top; one fill per tone.
const SMOKE = [
    ['#8d9099', '#c5c8cf', '#e9ebef'],
    ['#4a4f5f', '#727989', '#979eae'],
    ['#74777f', '#a8abb2', '#cfd1d6'], // greyer over snow
  ],
  SOOT = [
    ['#3c3f47', '#5d616b', '#7f848f'],
    ['#2a2d36', '#434754', '#5e6372'],
  ];
function puffs(X, list, alpha, tones) {
  const ctx = X.ctx;
  if (!list.length || alpha <= 0.01) return;
  const tone = tones || SMOKE[X.night ? 1 : X.snow > 0 ? 2 : 0];
  ctx.globalAlpha = Math.min(1, alpha);
  for (let l = 0; l < 3; l++) {
    ctx.beginPath();
    for (let j = 0; j < list.length; j += 3) {
      const x = list[j],
        y = list[j + 1],
        q = list[j + 2] - (l === 2 ? 1 : 0);
      if (q < 0 || (l === 2 && q < 1)) continue;
      const oy = l === 0 ? 1 : l === 2 ? -1 : 0,
        ox = l === 2 ? -1 : 0;
      if (q <= 1) ctx.rect(x + ox, y + oy, q + 1, q + 1);
      else {
        ctx.rect(x + ox - q, y + oy - q + 1, 2 * q + 1, 2 * q - 1);
        ctx.rect(x + ox - q + 1, y + oy - q, 2 * q - 1, 2 * q + 1);
      }
    }
    ctx.fillStyle = tone[l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Twin flames under the nozzles of a pack centred on cx, nozzle bottoms at ny: a white-hot root, yellow, orange and
// a red edge, n px long, leaning by slant px a row; a soft halo round the roots. Rows merge into runs. Flames that
// reach the floor splash out sideways along it.
const FL = ['#e23c22', '#ff8c1a', '#ffd84a', '#fffbe0'],
  REACH = [1, 0.75, 0.45],
  WIDE = [0.6, 0.35, 0],
  SPILL = [0.6, 0.4, 0.2];
function flames(X, cx, ny, n, slant, alpha, secs, floor = 1e9) {
  if (n < 1 || alpha <= 0.01) return;
  const ctx = X.ctx;
  if (X.night) {
    // a glow round the roots in the dark
    ctx.globalAlpha = alpha * 0.35;
    ctx.beginPath();
    for (const j of JET) {
      ctx.rect(cx + j - 2, ny, 6, Math.min(floor - ny, 3));
      ctx.rect(cx + j - 1, ny - 1, 4, Math.min(floor - ny + 1, 6));
    }
    ctx.fillStyle = FL[1];
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
  for (let l = 0; l < 4; l++) {
    ctx.beginPath();
    JET.forEach((j, s) => {
      const full = n - flick(X, secs, 3 + s),
        len = Math.min(floor - ny, full),
        top = Math.min(len, l === 3 ? 2 : Math.round(full * REACH[l])),
        wide = l === 3 ? 0 : Math.round(full * WIDE[l]),
        w = k => (k < wide ? 4 : 2),
        x = k => cx + j + Math.round(slant * k) - (w(k) === 4 ? 1 : 0);
      for (let k = 0; k < top; ) {
        let e = k + 1;
        while (e < top && w(e) === w(k) && x(e) === x(k)) e++;
        ctx.rect(x(k), ny + k, w(k), e - k);
        k = e;
      }
      const sp = l < 3 && top === len ? Math.min(3, Math.round((full - len) * SPILL[l])) : 0;
      if (sp > 0) {
        ctx.rect(x(len - 1) - sp, ny + len - 1, w(len - 1) + 2 * sp, 1);
        ctx.rect(x(len - 1) - (sp >> 1), ny + len - 2, w(len - 1) + 2 * (sp >> 1), 1);
      }
    });
    ctx.fillStyle = FL[l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// A cloud of smoke round (cx, cy), age s after the flames reach the floor: puffs blown out one after another, each
// rolling outward over the floor, swelling, lifting a little and shrinking away. half 0: the puffs behind the feet,
// 1: in front, 2: all. Pure in its age.
const CL = [],
  BLOW = 0.3, // s the puffs are blown out over
  ROLL = 0.55; // s a puff takes to roll out
function cloud(X, cx, cy, age, life, half, alpha) {
  if (age <= 0 || age >= life) return;
  CL.length = 0;
  // the same puffs in a crowd: the marks (never lite) take over from them
  const n = 16;
  for (let k = 0; k < n; k++) {
    const born = (k / n) * BLOW,
      a = age - born,
      f = a / (life - born);
    if (a <= 0 || f >= 1) continue;
    const ang = 2 * Math.PI * X.hash(k, 31),
      reach = (6 + 17 * X.hash(k, 32)) * out2(Math.min(1, a / ROLL)),
      x = Math.round(cx + reach * Math.cos(ang)),
      y = Math.round(cy + 0.4 * reach * Math.sin(ang) - 1 - 6 * f * (0.5 + X.hash(k, 34))),
      q = Math.round((2 + 2.4 * X.hash(k, 33)) * out2(Math.min(1, a / 0.2)) * (1 - 0.8 * in2(f)));
    if (q >= 1 && (half === 2 || (y > cy - 2 ? 1 : 0) === half)) CL.push(x, y, q);
  }
  puffs(X, CL, alpha * 0.85 * (1 - in2(r(age / life, 0.55, 1))));
}

// The smoke trail: two thin streams of puffs dropped on a beat of idle time under the flames as they were then,
// swelling, sinking and thinning out; pure in the clock, so nothing is kept between frames.
const RATE = 20,
  LIFE = 0.7,
  SP = [],
  SO = [];
function trail(X) {
  const L = X.L,
    tp = X.tp,
    from = L.hide ? L_IN + 0.02 : B.IGN;
  SP.length = 0;
  if (L.cut) return SP;
  for (let i = Math.floor(L.secs * RATE); i > (L.secs - LIFE) * RATE; i--) {
    // a crowd keeps the beat and skips every other one, so nothing reshuffles when it starts or ends
    if (X.lite && i % 2) continue;
    const ts = i / RATE,
      v = core(ts, tp.d);
    if (v < from || v > B.DOWN) continue;
    const q = picture(X, v, ts, Q);
    if (q.n < 5) continue;
    const age = L.secs - ts,
      f = age / LIFE,
      floor = q.fy + Math.round(q.h);
    for (let s = 0; s < 2; s++) {
      // the tail breaks up: old puffs drop out at random
      if (f > 0.4 && X.hash(2 * i + s, 44) < 1.6 * (f - 0.4)) continue;
      const x = q.px + JET[s] + 1 + Math.round((X.hash(2 * i + s, 42) - 0.5) * (2 + 6 * f) + q.slant * q.n),
        y = q.py + PH + Math.round(0.8 * q.n + 9 * age + (X.hash(2 * i + s, 43) - 0.5) * 3);
      SP.push(x, Math.min(floor - 1, y), f < 0.15 ? 0 : f < 0.5 ? 1 : 2 - (X.hash(i, 45) < 0.5));
    }
  }
  return SP;
}
// Soot: a dark little puff from each nozzle at a cough, the hiccup and the cut-off, rising and gone in a moment.
const SOOT_S = 0.35;
function soot(X) {
  const L = X.L,
    tp = X.tp,
    v = L.v;
  SO.length = 0;
  const hic = hiccup(tp.len) ? DEP + B.HIC[0] * (ARR - DEP) : -1;
  for (const c of [...(L.hide ? [] : B.COUGH), hic, B.DOWN]) {
    if (c < 0 || v < c) continue;
    const age = real(v, tp.d) - real(c, tp.d);
    if (age > SOOT_S) continue;
    const q = picture(X, c, L.secs, Q),
      f = age / SOOT_S;
    for (let s = 0; s < 2; s++)
      SO.push(
        q.px + JET[s] + (s ? 1 : 0) + (s ? 1 : -1) * Math.round(2 * f),
        q.py + PH + 1 - Math.round(3 * f),
        f < 0.5 ? 0 : 1,
      );
  }
  return SO;
}
// Sparks off the shoulders as the pack clanks home.
const SK = [];
function sparks(X, p, v) {
  const g = r(v, B.CLANK, B.CLANK + 0.035);
  if (g <= 0 || g >= 1) return;
  SK.length = 0;
  for (let k = 0; k < 4; k++) {
    const s = k % 2 ? 1 : -1,
      d = 3 + Math.round(6 * out2(g));
    SK.push(
      p.fx + s * (7 + d) - (s < 0),
      p.base - 14 - Math.round((k < 2 ? 3 : -1) * out2(g)) + Math.round(5 * in2(g)),
    );
  }
  const ctx = X.ctx;
  ctx.beginPath();
  for (let j = 0; j < SK.length; j += 2) ctx.rect(SK[j], SK[j + 1], 1, 1);
  ctx.fillStyle = FL[2];
  ctx.fill();
}

const O = { pose: 'stand', front: null, alpha: 1, legs: 1 };
// The whole picture at one depth: trail, the clouds behind, pack, flames and body in facing order, the clouds in
// front. A cut fades the effect only; the person keeps the pose's alpha.
function draw(X, p, cx, cy, age, life) {
  const ctx = X.ctx,
    L = X.L,
    C = L.C,
    a = Math.min(1, p.a);
  if (a <= 0.01) return;
  puffs(X, trail(X), a * C * 0.8);
  if (life) cloud(X, cx, cy, age, life, 0, C);
  const front = p.front == null ? !!X.a.dirFront : p.front,
    floor = p.on ? p.fy + Math.round(p.h) + 1 : 1e9,
    packed = () => {
      if (p.pa * C <= 0.01) return;
      flames(X, p.px, p.py + PH, p.n, p.slant, Math.min(1, p.pa * C), L.secs, floor);
      ctx.globalAlpha = Math.min(1, p.pa * C);
      pack(X, p.px, p.py);
      ctx.globalAlpha = 1;
    };
  if (front || !p.on) packed();
  O.pose = p.pose;
  O.front = p.front;
  O.legs = p.legs;
  O.alpha = a;
  X.bodyAt(p.fx, p.fy, O);
  if (!front && p.on) packed();
  else if (p.on && p.pa * C > 0.6 && p.py >= p.base - PACKY - 4) {
    // harness straps over the shoulders
    ctx.fillStyle = PAL[X.night ? 1 : 0][3];
    ctx.fillRect(p.fx - 3, p.base - 11, 1, 4);
    ctx.fillRect(p.fx + 2, p.base - 11, 1, 4);
  }
  puffs(X, soot(X), C, SOOT[X.night ? 1 : 0]);
  if (!L.sw) sparks(X, p, L.v);
  if (life) cloud(X, cx, cy, age, life, 1, C);
}
// The take-off cloud's and the landing cloud's clocks (real s since the flames reach the floor).
const age0 = X => real(X.L.v, X.L.d) - real(B.IGN, X.L.d),
  age1 = X => real(X.L.v, X.L.d) - real(B.HIT, X.L.d),
  // the landing cloud's age at the release, for the mark (the arrival's length is the profile's)
  AT_REL = ((REL - B.HIT) / (REL - ARR)) * TpStyles.BY_ID.jetpack.arr;
// The shadow under the feet while the remapped body (which has none) stands or hovers low, and the flames' glow.
function shade(X, end, h, n) {
  const ctx = X.ctx,
    x = end ? X.x1 : X.x0,
    y = end ? X.y1 : X.y0;
  Kit.shadow(ctx, x, y, 16 - h / 3, 0.9 - h / 30);
  const glow = n > 0 ? (X.night ? 0.35 : 0.14) * (1 - Math.min(1, h / 28)) * X.L.C : 0;
  if (glow <= 0.01) return;
  ctx.globalAlpha = glow;
  ctx.fillStyle = FL[1];
  ctx.beginPath();
  ctx.rect(x - 12, y, 25, 1);
  ctx.rect(x - 9, y - 1, 19, 3);
  ctx.rect(x - 5, y - 2, 11, 5);
  ctx.fill();
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
    if (!L.hide && L.sw && age0(X) < CLOUD) n |= PART.S0;
    if (L.sw && v >= ARR) n |= PART.F1;
    return n;
  },
  floor(X, end) {
    const p = picture(X, X.L.v, X.L.secs);
    shade(X, end, p.h, p.on ? p.n : 0);
  },
  // The take-off cloud left rolling at the origin once they are away.
  stand(X) {
    cloud(X, X.x0, X.y0, age0(X), CLOUD, 2, X.L.C);
  },
  trip(X) {
    draw(X, picture(X, X.L.v, X.L.secs), 0, 0, 0, 0);
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
    const p = picture(X, v, L.secs);
    if (L.sw) draw(X, p, X.x1, X.y1, age1(X), CLOUD1);
    else draw(X, p, X.x0, X.y0, age0(X), CLOUD);
    return true;
  },
  // The landing cloud thinning round the spot they walk out of: the puffs behind them, and those in front.
  marks: [
    { at: 'rel', end: 1, ttl: CLOUD1 - AT_REL, layer: 'back' },
    { at: 'rel', end: 1, ttl: CLOUD1 - AT_REL, layer: 'stand' },
  ],
  drawMark(X, m, age) {
    cloud(X, X.x0, X.y0, age + AT_REL, CLOUD1, m.k, 1);
  },
  gap: null,
};
// Exposed for tests.
export const JETPACK = {
  B,
  CLOUD,
  CLOUD1,
  LIFT,
  ARRH,
  PACKY,
  JET,
  ROWS,
  KEYS,
  picture,
  trail,
  soot,
  AT_REL,
  cruise,
  need: STYLE.need,
};
