// twister: a gust picks up, leaves come swirling in and the person starts to spin, faster and faster, until a little
// whirlwind rises round them and they thin away inside it. The whirlwind wanders along the real route, leaves riding
// round it and dust kicking up at its foot. At the landing it slows and unwinds, the leaves fly out and settle on the
// floor, and the person spins to a stop and stands there dizzy, little stars circling over the head as they walk on.
// The funnel's back half and back leaves ride the back item at either end, its front the stand item, so the spinning
// person stands inside it; mid-route the trip item draws it all. The fallen leaves are a lasting floor mark.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { outdoors } from './office-scene.js';
import { LOOK } from './office-people.js';

const { clamp, r, out2, in2, ease, frac, lerp } = Kit;
const { DEP, ARR, T } = TeleportLogic;
const REL = T.RELEASE;
const HF = 34, // px: the funnel's full height
  W0 = 1.5, // px: its half width at the foot and at the top
  W1 = 12,
  WMAX = 5, // turns a second at full spin
  // departure fractions: the stool, the spin starts, full speed, the funnel rises, the body thins away
  STOOL = 0.08,
  SPIN0 = 0.1,
  SPIN1 = 0.7,
  GROW0 = 0.22,
  GROW1 = 0.72,
  GONE0 = 0.55,
  GONE1 = 0.9,
  // arrival fractions: the funnel stops, it has unwound and the body stands still, the dizzy sway from
  STOP = 0.1,
  UNW = 0.48,
  NLEAF = 8,
  NSHED = 7,
  SHED0 = 0.06, // s after ARR the first leaf flies out, then one every SHED_DT
  SHED_DT = 0.035;
// o keyline, f the see-through body, s dim streak, w bright streak; day, night, snow outdoors.
const WIND = [
  { o: '#687f8f', f: 'rgba(230,238,243,0.58)', s: '#a9bcc7', w: '#ffffff' },
  { o: '#93a8cc', f: 'rgba(128,148,186,0.34)', s: '#a3b6d8', w: '#e6efff' },
  { o: '#6d8196', f: 'rgba(200,213,226,0.58)', s: '#8fa3b6', w: '#ffffff' },
];
const windOf = (X, tx, ty) => WIND[X.night ? 1 : X.snow > 0 && outdoors(tx, ty) ? 2 : 0];
// Leaves: [colour, shade] green, orange, yellow, rust; day and night. Snowflakes take every other one on snow.
const LEAF = [
  [
    ['#6cbf43', '#3e8a2c'],
    ['#f0a530', '#b8631e'],
    ['#e8cb47', '#a8892a'],
    ['#d2622d', '#8f3a1c'],
  ],
  [
    ['#4b8a3a', '#2c5a24'],
    ['#b47a2c', '#7d4a1c'],
    ['#ad9940', '#76652a'],
    ['#9c4c2a', '#66301a'],
  ],
];
const FLAKE = ['#ffffff', '#cfdbe8'];
const DUST = [
  ['#c9bea6', '#e9e2d2'],
  ['#5f6579', '#80879c'],
  ['#d4dde8', '#ffffff'],
];
const dustOf = (X, tx, ty) => DUST[X.night ? 1 : X.snow > 0 && outdoors(tx, ty) ? 2 : 0];
const STAR = ['#ffd84a', '#fff7c4', '#5a3a08']; // fill, its core, keyline

// Rects queued with a colour, then one fill per colour in first-use order.
const NB = 300,
  B = { n: 0, x: new Int16Array(NB), y: new Int16Array(NB), w: new Int16Array(NB), h: new Int16Array(NB) },
  BC = new Uint8Array(NB),
  BCOL = [];
function add(x, y, w, h, col) {
  if (B.n >= NB || w <= 0 || h <= 0) return;
  let ci = BCOL.indexOf(col);
  if (ci < 0) ci = BCOL.push(col) - 1;
  const k = B.n++;
  B.x[k] = Math.round(x);
  B.y[k] = Math.round(y);
  B.w[k] = w;
  B.h[k] = h;
  BC[k] = ci;
}
function flush(ctx, alpha) {
  if (B.n && alpha > 0.01) {
    ctx.globalAlpha = Math.min(1, alpha);
    for (let c = 0; c < BCOL.length; c++) {
      ctx.beginPath();
      for (let k = 0; k < B.n; k++) if (BC[k] === c) ctx.rect(B.x[k], B.y[k], B.w[k], B.h[k]);
      ctx.fillStyle = BCOL[c];
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  B.n = 0;
  BCOL.length = 0;
}

// Turns spun so far, on the shown clock: ramping up over the departure, steady all trip, slowing to a stop on arrival.
function turnsAt(L) {
  const d = L.d,
    v = L.v,
    ramp = x =>
      x <= SPIN0 ? 0 : x < SPIN1 ? (x - SPIN0) ** 2 / (2 * (SPIN1 - SPIN0)) : (SPIN1 - SPIN0) / 2 + x - SPIN1;
  let n = WMAX * d[0] * ramp(clamp(v / DEP));
  if (v <= DEP) return n;
  n += WMAX * d[1] * (v < ARR ? clamp(L.trip) : 1);
  if (v < ARR) return n;
  const q = clamp(r(v, ARR, REL)),
    slow = x => (x <= STOP ? x : x < UNW ? x - (x - STOP) ** 2 / (2 * (UNW - STOP)) : (STOP + UNW) / 2);
  return n + WMAX * d[2] * slow(q);
}
// Half width at height y px over the foot, and the axis's sideways wobble there.
const halfW = y => W0 + (W1 - W0) * clamp(y / HF) ** 1.4;
const wobble = (y, turns, lean) => Math.round(lean * (y / HF) + 1.6 * (y / HF) * Math.sin(Math.PI * turns + y / 5));

// The funnel standing on (cx, cy), h px high: keyline edges, a see-through body, streak bands rising and sweeping
// round. half: 1 the front (streaks), -1 the back (body and keyline), 0 both.
function funnel(X, cx, cy, h, turns, lean, pal, half) {
  const step = X.lite ? 2 : 1,
    rise = Math.floor(turns * 10);
  for (let y = 0; y < h; y += step) {
    // bands climb as it turns, each a ring bulging out of the cone
    const band = (((y - rise) % 5) + 5) % 5,
      hw = Math.round(halfW(y)) + (band === 0 && y > 3 ? 1 : 0),
      x0 = cx + wobble(y, turns, lean) - hw,
      row = cy - 1 - y - (step - 1);
    if (half <= 0) {
      add(x0, row, 1, step, pal.o);
      add(x0 + 2 * hw, row, 1, step, pal.o);
      if (hw > 0) add(x0 + 1, row, 2 * hw - 1, step, pal.f);
    }
    if (hw < 2) continue;
    // two helix strands winding up round the axis: the front runs lit, the back shows dim through the air
    for (let j = 0; j < 2; j++) {
      const ph = 2 * Math.PI * (turns * 1.2 - y / 10) + j * Math.PI,
        front = Math.cos(ph) > 0;
      if (front !== half > 0 && half !== 0) continue;
      const sx = x0 + hw + Math.round((hw - 1) * Math.sin(ph));
      if (front) add(sx, row, 2 - j, step, j ? pal.s : pal.w);
      else add(sx, row, 1, step, pal.s);
    }
  }
  if (h > HF * 0.6 && half >= 0) {
    // the open top: a rounded lip of churned air, a glint running round it
    const hw = Math.round(halfW(h)) + 1,
      x0 = cx + wobble(h, turns, lean) - hw,
      top = cy - h - 1,
      g = Math.floor(frac(turns * 0.75) * (2 * hw - 4));
    add(x0 + 2, top - 1, 2 * hw - 3, 1, pal.o);
    add(x0, top, 2, 1, pal.o);
    add(x0 + 2 * hw - 1, top, 2, 1, pal.o);
    add(x0 + 2, top, 2 * hw - 3, 1, pal.s);
    add(x0 + 1 + g, top, 3, 1, pal.w);
  }
}
// Leaf k round the axis at turns: out = [x, y, back]; spread pushes it out (sucked in, thrown off).
function leafAt(X, k, turns, cx, cy, lean, spread, out) {
  const y = Math.round((0.12 + 0.8 * X.hash(k, 11)) * HF),
    ang = 2 * Math.PI * (turns * (0.7 + 0.5 * X.hash(k, 12)) + k / NLEAF),
    rad = (halfW(y) + 2 + 3 * X.hash(k, 13)) * spread;
  out[0] = Math.round(cx + wobble(y, turns, lean) + rad * Math.cos(ang));
  out[1] = Math.round(cy - 1 - y + 0.35 * rad * Math.sin(ang));
  out[2] = Math.sin(ang) < 0;
  return out;
}
const LP = [0, 0, false];
// A leaf tumbling: three frames from its flutter f; or a snowflake.
function leaf(X, k, x, y, f, tx, ty) {
  if (X.snow > 0 && k & 1 && outdoors(tx, ty)) {
    add(x, y, 1, 1, FLAKE[0]);
    if (f % 3 === 0) add(x + 1, y + 1, 1, 1, FLAKE[1]);
    return;
  }
  const [c, s] = LEAF[X.night ? 1 : 0][k % 4];
  // a 3x2 leaf: tilted one way, edge on, tilted the other
  if (f % 3 === 0) {
    add(x - 1, y, 2, 1, c);
    add(x, y - 1, 2, 1, c);
    add(x + 1, y, 1, 1, s);
  } else if (f % 3 === 1) {
    add(x - 1, y, 3, 1, c);
    add(x, y, 1, 1, s);
  } else {
    add(x - 1, y - 1, 2, 1, c);
    add(x, y, 2, 1, c);
    add(x - 1, y, 1, 1, s);
  }
}
// The leaves orbiting: back ones (side -1) or front ones (1); alpha a.
function leaves(X, turns, cx, cy, lean, spread, side, tx, ty, a) {
  const n = X.lite ? NLEAF / 2 : NLEAF;
  for (let k = 0; k < n; k++) {
    leafAt(X, k, turns, cx, cy, lean, spread, LP);
    if (LP[2] === side < 0) leaf(X, k, LP[0], LP[1], Math.floor(turns * 3) + k, tx, ty);
  }
  flush(X.ctx, a);
}
// Dust kicked round the foot.
function dust(X, turns, cx, cy, tx, ty, a) {
  const pal = dustOf(X, tx, ty),
    n = X.lite ? 3 : 5;
  for (let k = 0; k < n; k++) {
    const ang = 2 * Math.PI * (turns * 0.8 + k / n),
      age = frac(turns + k / n),
      rad = 4 + 2 * X.hash(k, 21) + 4 * age,
      x = Math.round(cx + rad * Math.cos(ang)),
      y = Math.round(cy - 1 + 0.4 * rad * Math.sin(ang) - 3 * age),
      big = age < 0.5 ? 1 : 0;
    // a puff thrown out and up, thinning
    add(x - big, y, 2 + big, 1 + big, pal[0]);
    if (!X.lite && big) add(x, y - 1, 1, 1, pal[1]);
  }
  flush(X.ctx, a * 0.8);
}
// A soft ground shadow under the funnel's foot.
function foot(X, cx, cy, w, a) {
  add(cx - w, cy, 2 * w + 1, 1, 'rgba(0,0,0,0.22)');
  add(cx - w + 2, cy - 1, 2 * w - 3, 1, 'rgba(0,0,0,0.16)');
  flush(X.ctx, a);
}
// px the top trails behind a whirlwind moving `ahead` px across the screen (Kit.clamp is 0-1 only)
const lean = ahead => -3 * Math.max(-1, Math.min(1, ahead / 3));
// The whole whirlwind at (cx, cy): half as in funnel (-1 back, 1 front, 0 all).
function whirl(X, cx, cy, h, turns, lean, spread, half, tx, ty, a) {
  const pal = windOf(X, tx, ty);
  if (half <= 0) {
    foot(X, cx, cy, 4 + Math.round(3 * (h / HF)), a);
    leaves(X, turns, cx, cy, lean, spread, -1, tx, ty, a);
    funnel(X, cx, cy, h, turns, lean, pal, -1);
    flush(X.ctx, a * 0.9);
  }
  if (half >= 0) {
    funnel(X, cx, cy, h, turns, lean, pal, 1);
    flush(X.ctx, a * 0.9);
    leaves(X, turns, cx, cy, lean, spread, 1, tx, ty, a);
    dust(X, turns, cx, cy, tx, ty, a);
  }
}

// Departure: the funnel's height and alpha, and how far the leaves still are (sucked in from 3x out).
const growAt = p => ease(r(p, GROW0, GROW1));
const spreadIn = p => 1 + 2.5 * (1 - out2(r(p, 0.04, 0.5)));
// Arrival: the funnel sinks and fades as it unwinds.
const unwindAt = q => ease(r(q, STOP, UNW));
function originWhirl(X, half) {
  const L = X.L,
    p = L.v / DEP,
    g = growAt(p),
    a = L.C * Math.min(1, r(p, 0.03, 0.2));
  if (a <= 0.01) return;
  whirl(X, X.x0, X.y0, Math.round(HF * g), turnsAt(L), 0, spreadIn(p), half, X.tx0, X.ty0, a);
}
function landingWhirl(X, half) {
  const L = X.L,
    q = r(L.v, ARR, REL),
    u = unwindAt(q);
  if (u >= 1) return;
  // the leaves are thrown off as it loosens (shed ones fly on their own from SHED0)
  const keep = 1 - r(q, STOP, STOP + 0.1);
  if (half <= 0 && keep > 0) {
    leaves(X, turnsAt(L), X.x1, X.y1, 0, 1 + u, -1, X.tx1, X.ty1, L.C * keep);
  }
  const pal = windOf(X, X.tx1, X.ty1),
    h = Math.round(HF * (1 - 0.7 * u)),
    turns = turnsAt(L),
    a = L.C * (1 - in2(u));
  if (half <= 0) foot(X, X.x1, X.y1, 4 + Math.round(3 * (1 - u)), a);
  funnel(X, X.x1, X.y1, h, turns, 0, pal, half);
  flush(X.ctx, a * 0.9);
  if (half >= 0) {
    if (keep > 0) leaves(X, turns, X.x1, X.y1, 0, 1 + u, 1, X.tx1, X.ty1, L.C * keep);
    dust(X, turns, X.x1, X.y1, X.tx1, X.ty1, a);
  }
}

// Shed leaf k, t s after ARR, thrown out of the funnel at (cx, cy): out = [x, y, landed, frame].
const SH = { t0: 0, dur: 0, ex: 0, ey: 0, h0: 0 };
function shed(X, k, t, cx, cy, out) {
  const ang = (k / NSHED) * 2 * Math.PI + 0.7 * X.hash(k, 31),
    R = 11 + 9 * X.hash(k, 32);
  SH.t0 = SHED0 + SHED_DT * k;
  SH.dur = 0.32 + 0.16 * X.hash(k, 33);
  SH.h0 = 8 + Math.round(16 * X.hash(k, 34));
  SH.ex = Math.round(cx + R * Math.cos(ang));
  SH.ey = Math.round(cy + 0.5 * R * Math.sin(ang));
  const f = clamp((t - SH.t0) / SH.dur);
  // out fast, a little hop, then fluttering down side to side
  out[0] = Math.round(lerp(cx, SH.ex, out2(f)) + (f < 1 ? 2 * Math.sin(f * 3 * Math.PI) : 0));
  out[1] = Math.round(lerp(cy - SH.h0, SH.ey, ease(f)) - 7 * Math.sin(Math.PI * f) * (1 - f));
  out[2] = t >= SH.t0 + SH.dur;
  out[3] = out[2] ? 0 : Math.floor(f * 9);
  return out;
}
const SP = [0, 0, false, 0];
// The shed leaves still in the air (landed ones belong to the mark).
function shedding(X, t) {
  if (t < SHED0) return;
  for (let k = 0; k < NSHED; k++) {
    shed(X, k, t, X.x1, X.y1, SP);
    if (t < SH.t0 || SP[2]) continue;
    leaf(X, k, SP[0], SP[1], SP[3], X.tx1, X.ty1);
  }
  flush(X.ctx, X.L.C);
}

// Px from the feet to the top of the hair, standing.
function hairTop(a) {
  const hs = a ? LOOK(a).hairStyle : '';
  return 19 + (hs === 'bun' ? 3 : hs === 'quiff' ? 2 : 0);
}
// Three stars circling over a dizzy head at (fx, top), t s into the daze: keylined 5 px crosses, back ones 3 px.
function stars(X, fx, top, t, a) {
  if (a <= 0.01) return;
  for (let k = 0; k < 3; k++) {
    const ang = 2 * Math.PI * (t * 1.4 + k / 3),
      x = Math.round(fx + 8 * Math.cos(ang)),
      y = Math.round(top - 5 + 2 * Math.sin(ang)),
      n = Math.sin(ang) < -0.3 ? 1 : 2;
    add(x - n - 1, y - 1, 2 * n + 3, 3, STAR[2]);
    add(x - 1, y - n - 1, 3, 2 * n + 3, STAR[2]);
    add(x - n, y, 2 * n + 1, 1, STAR[0]);
    add(x, y - n, 1, 2 * n + 1, STAR[0]);
    add(x, y, 1, 1, STAR[1]);
  }
  flush(X.ctx, a);
}
// The spin's body frame: front, side, back, other side, from the turns.
const O = {};
function spinPose(turns, thin, o) {
  const spin = Math.floor(turns * 4);
  o.front = !(spin & 1);
  o.mirror = (spin & 2) > 0;
  o.sx = 1 - 0.6 * thin;
  o.sy = 1 + 0.1 * thin;
  return o;
}
function clear() {
  for (const k in O) delete O[k];
  return O;
}
function depPerson(X) {
  const L = X.L,
    p = L.v / DEP,
    tp = X.tp;
  if (tp.stool && p < STOOL) {
    X.body({ pose: tp.stool === 2 ? 'sitHigh' : 'sit', front: X.a.dirFront });
    return;
  }
  const thin = ease(r(p, GONE0, GONE1));
  if (thin >= 1) return;
  const o = clear();
  o.pose = p < 0.3 ? 'stand' : 'up';
  if (p >= SPIN0) spinPose(turnsAt(L), thin, o);
  // lifted off the floor a little as the wind takes them
  o.lift = Math.round(4 * thin);
  o.alpha = 1 - in2(thin);
  X.body(o);
}
// Seconds into the daze at arrival fraction q.
const dazeOf = (L, q) => (q - UNW) * L.d[2];
function arrPerson(X) {
  const L = X.L,
    q = r(L.v, ARR, REL),
    o = clear(),
    top = hairTop(X.a);
  if (q < UNW) {
    // spun out of the loosening funnel, slowing down
    const thin = 1 - ease(r(q, 0, UNW));
    spinPose(turnsAt(L), thin, o);
    o.pose = 'up';
    o.lift = Math.round(4 * thin);
    o.alpha = Math.min(1, 0.25 + q / 0.15);
    X.body(o);
    return;
  }
  // dizzy: a slow lean side to side, looking this way and that
  const t = dazeOf(L, q),
    sway = Math.round(1.4 * Math.sin(t * 9)),
    s = Math.sin(t * 4.5);
  o.pose = 'stand';
  o.front = true;
  o.mirror = s < 0;
  o.sy = 1 - 0.04 * Math.abs(sway);
  X.bodyAt(X.x1 + sway, X.y1, o);
  stars(X, X.x1 + sway, X.y1 - top, t, L.C * Math.min(1, t / 0.1));
}

export const STYLE = {
  need(X) {
    const L = X.L;
    if (L.q) return 0;
    let n = 0;
    if (!L.sw) n |= Kit.PART.B0 | Kit.PART.S0;
    if (L.trip >= 0 && L.trip < 1) n |= Kit.PART.TRIP;
    if (L.sw && L.v >= ARR && L.v < REL) n |= Kit.PART.B1 | Kit.PART.S1;
    return n;
  },
  back(X, end) {
    if (end) landingWhirl(X, -1);
    else originWhirl(X, -1);
  },
  stand(X, end) {
    if (!end) {
      originWhirl(X, 1);
      return;
    }
    landingWhirl(X, 1);
    shedding(X, TeleportLogic.real(X.L.v, X.L.d) - TeleportLogic.real(ARR, X.L.d));
  },
  // The whirlwind wandering at its route point, its top trailing behind the way it goes.
  trip(X) {
    const L = X.L;
    if (L.trip < 0 || L.trip >= 1) return;
    const Q = X.route(L.trip, TQ),
      ahead = X.route(Math.min(1, L.trip + 0.04), TQ2)[0] - Q[0],
      turns = turnsAt(L),
      sway = Math.round(Math.sin(turns * 1.3)),
      a = L.C * (L.hide ? 0.3 + 0.7 * r(L.trip, 0, 0.05) : 1);
    whirl(X, Q[0] + sway, Q[1], HF, turns, lean(ahead), 1, 0, Q[2], Q[3], a);
  },
  // One body pass a frame: spinning away, nothing while the whirlwind travels, spun out and dizzy at the landing.
  // After the release the stars keep circling the head as they walk on (drawn first, then the usual body).
  person(X) {
    const L = X.L;
    if (L.q) return false;
    if (L.v >= REL) {
      const a = X.a;
      if (!L.calm && !L.cut && !a.seated) {
        const t = dazeOf(L, 1) + TeleportLogic.real(L.v, L.d) - TeleportLogic.real(REL, L.d),
          f = TPX;
        feetOf(a, f);
        stars(X, f[0], f[1] - hairTop(a), t, L.C * (1 - r(L.fade, 0.5, 0.8)));
      }
      return false;
    }
    if ((L.hide && !L.sw) || (L.trip >= 0 && L.trip < 1)) return true;
    if (!L.sw) depPerson(X);
    else arrPerson(X);
    return true;
  },
  marks: [{ at: 'arr', end: 1, ttl: 3, layer: 'floor' }],
  // The shed leaves lying where they fell round the landing, fading.
  drawMark(X, m, age) {
    const A = 1 - r(age, 2.2, 3);
    if (A <= 0.01) return;
    for (let k = 0; k < NSHED; k++) {
      shed(X, k, age, X.x0, X.y0, SP);
      if (SP[2]) leaf(X, k, SP[0], SP[1], k, X.tx0, X.ty0);
    }
    flush(X.ctx, A);
  },
  gap: null,
};
const TQ = [0, 0, 0, 0, false],
  TQ2 = [0, 0, 0, 0, false],
  TPX = [0, 0];
function feetOf(a, out) {
  const f = Kit.feet(a.x, a.y);
  out[0] = f[0];
  out[1] = f[1];
}
// Exposed for tests.
export const TWISTER = { turnsAt, halfW, leafAt, shed, lean, hairTop, HF, W1, NLEAF, NSHED, SHED0, STOP, UNW };
