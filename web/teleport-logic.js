// The magic teleport back to work, as logic (no DOM, no canvas; tests/teleport-logic.test.mjs): someone on a break
// far from where they work is drawn into a magic circle and lands a few steps from their desk.
// The state lives on the agent as `a.tp` (null when none):
//   { was, u, i, x0, y0, x1, y1, hide, free, stool, sw, cut, again, style, d, swAt, len, route, mk }
//   was     the lounge goal key that made it eligible        u     clock in s (negative while queued)
//   i       landing index into a.path                         x0,y0 where they leave from; x1,y1 the landing
//   hide    started unseen in a restroom stall               free  outside the queue (stall user or bather)
//   stool   the stool pose kept until fully white            sw    moved to the landing
//   cut     null, or the u at which it was called off (it then rewinds for T.CUT)
//   again   work called while it rewound: planned afresh from the break when the rewind ends
//   style   web/tp-styles.js id         d     real seconds of the four core segments (DD: the circle, core = real)
//   swAt    core time of the switch    len   tiles to the landing
//   route   the polyline to the landing, for ground styles and hidden starters (null otherwise)
//   mk      bits of the lasting marks already born (office-draw-teleport.js)
//   desk    the desk it lands by: a visit's host's, else the own
// Every T time below is on the core clock: core(tp.u, tp.d).
import { TpStyles } from './tp-styles.js';

// plan() decides at a goal change, step() runs the clock in updateAgent, look() turns the clock into what to draw.
const FAR = 12, // tiles: a shorter walk to work is walked
  KEEP = 3.5, // tiles left to walk after landing
  BUSY = 1, // tiles: no landing this close to someone standing or to a landing in flight
  BACK = 3, // waypoints a landing may step back to get out of the way
  STAGGER = 0.15, // s between two teleports that start together
  QUEUE = 15,
  WALK = 2.6, // tiles/s at speed 1, as in updateAgent
  GAIN = 0.5, // s a teleport must save over the walk at the current speed
  LITE = 10, // more bright teleports than this drop motes and bursts
  CAP = 16; // teleports drawn per frame
// Clock seconds.
const T = {
  O_IN: 0.2, // origin circle drawn in
  WHITE: 0.1, // turns white
  SQUEEZE: 0.26, // squeezed into the column
  L_IN: 0.28, // landing circle starts (and a stall user's clock)
  SWITCH: 0.48, // moved to the landing, while nobody is drawn
  LAND: 0.86, // colours back
  RELEASE: 0.92, // walks on
  END: 1.35, // landing ring gone
  CUT: 0.25, // length of the rewind after a cut
};

const DEP = 0.42, // core time the departure ends and the travel starts
  ARR = 0.54, // core time the travel ends
  CB = [0, DEP, ARR, T.RELEASE, T.END],
  { DD } = TpStyles;
// Real clock to core clock, piecewise linear over d; slope 1 while queued and after the last segment.
function core(u, d) {
  if (!d || d === DD || u <= 0) return u;
  let r0 = 0;
  for (let j = 0; j < 4; j++) {
    if (u < r0 + d[j]) return CB[j] + ((u - r0) / d[j]) * (CB[j + 1] - CB[j]);
    r0 += d[j];
  }
  return CB[4] + (u - r0);
}
function real(c, d) {
  if (!d || d === DD || c <= 0) return c;
  let r0 = 0;
  for (let j = 0; j < 4; j++) {
    if (c < CB[j + 1]) return r0 + ((c - CB[j]) / (CB[j + 1] - CB[j])) * d[j];
    r0 += d[j];
  }
  return r0 + (c - CB[4]);
}
const seg = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const WORK = key => key === 'seat' || key.startsWith('visit');
const LOUNGE = key => !!key && (key.startsWith('idle') || key.startsWith('wash'));
// Polyline length from path[i] to the end of the path.
function rest(path, i) {
  let L = 0;
  for (let k = i; k < path.length - 1; k++) L += seg(path[k], path[k + 1]);
  return L;
}
// Near someone standing or landing, or just in front of another desk's chair (drawn over its sitter).
const inWay = (q, taken, chairs) =>
  taken.some(t => seg(t, q) < BUSY) ||
  chairs.some(c => {
    const dz = q[0] + q[1] - c[0] - c[1];
    return dz > 0 && dz < 3.2 && Math.abs(q[0] - q[1] - c[0] + c[1]) < 0.8;
  });
// Index of the waypoint to land on, or -1 for a walk. Never the goal point itself, so arrival runs as today.
function landing(at, path, taken = [], chairs = []) {
  const n = path.length;
  if (n < 2 || seg(at, path[0]) + rest(path, 0) < FAR) return -1;
  let i = n - 2;
  while (rest(path, i) < KEEP && i > 0) i--;
  if (rest(path, i) < KEEP) return -1;
  for (let k = 0; k <= BACK && i - k >= 0; k++) if (!inWay(path[i - k], taken, chairs)) return i - k;
  return i;
}
// Where others stand or will stand: landings in flight, visit and sub-agent spots, anyone standing still.
function occupied(a, agents) {
  const out = [];
  for (const o of agents) {
    if (o === a) continue;
    if (o.tp && o.tp.cut == null) out.push([o.tp.x1, o.tp.y1]);
    const k = o.goalKey || '';
    if ((k.startsWith('visit') || k.startsWith('sub')) && o.path.length) out.push(o.path[o.path.length - 1]);
    else if (!o.moving && !o.seated && !o.sleeping) out.push([o.x, o.y]);
  }
  return out;
}
// Whether a teleport starting at clock u and landing on path[i] saves GAIN over the walk at this speed.
function pays(a, i, u, speed, d) {
  const v = WALK * (speed || 1);
  return (seg([a.x, a.y], a.path[0]) + rest(a.path, 0)) / v - (real(T.RELEASE, d) - u + rest(a.path, i) / v) >= GAIN;
}
const ground = id => !!TpStyles.BY_ID[id] && TpStyles.BY_ID[id].kind === 'ground';
const routeTo = (a, i) => [[a.x, a.y], ...a.path.slice(0, i + 1)];
// Tiles to path[i]: along the route for a ground style, else the straight line.
const lenTo = (a, i, style) =>
  ground(style) ? seg([a.x, a.y], a.path[0]) + rest(a.path, 0) - rest(a.path, i) : seg([a.x, a.y], a.path[i]);
// A visit goal is visit<id>-<slot>; a host that has gone leaves the own desk.
function deskFor(a, key, agents) {
  if (!key.startsWith('visit')) return a.desk;
  const id = key.slice(5, key.lastIndexOf('-')),
    host = agents.find(o => String(o.id) === id);
  return host ? host.desk : a.desk;
}
// The agent's next `tp` at a goal change (a.path already holds the new route). Pure.
// c: { prev: { was, hid, stool, act } taken before the goal-change resets, key, agents, chairs, stairs, speed }.
function plan(a, c) {
  const { prev, key } = c;
  const old = a.tp;
  // A rewind plays out; step then hands a work goal back for a fresh plan, so nothing pops.
  if (old && old.cut != null) return !!old.again === WORK(key) ? old : { ...old, again: WORK(key) };
  if (old && old.sw) return old;
  const was = old ? old.was : prev.was;
  const ok = LOUNGE(was) && WORK(key),
    taken = ok ? occupied(a, c.agents).concat(c.stairs || []) : [];
  const i = ok
    ? landing(
        [a.x, a.y],
        a.path,
        taken,
        c.chairs.filter((_, k) => k !== a.desk),
      )
    : -1;
  if (old) {
    const early = core(old.u, old.d) < T.L_IN,
      route = k => (old.route ? routeTo(a, k) : old.route);
    // Early, the trip is still ahead: it is timed for the new landing, while d[0] and swAt hold.
    const len = early && i >= 0 ? lenTo(a, i, old.style) : old.len,
      d = early && old.d !== DD ? TpStyles.durs(old.style, len) : old.d;
    if (i < 0 || (early && !pays(a, i, old.u, c.speed, d))) return old.u > 0 ? { ...old, cut: old.u } : null;
    const desk = deskFor(a, key, c.agents);
    if (early) return { ...old, i, x1: a.path[i][0], y1: a.path[i][1], route: route(i), desk, len, d };
    // The landing circle is showing: keep it if the new route passes there, else call it off and start again.
    const j = a.path.findIndex(p => p[0] === old.x1 && p[1] === old.y1);
    if (j < 0 || j >= a.path.length - 1) return { ...old, cut: old.u, again: true };
    return { ...old, i: j, route: route(j), desk };
  }
  if (i < 0) return null;
  const style = c.style || TpStyles.styleFor(a);
  if (!style) return null;
  const g = ground(style),
    len = lenTo(a, i, style),
    d = TpStyles.calm() ? DD : TpStyles.durs(style, len);
  const free = !!prev.hid || prev.act === 'bath';
  let q = 0;
  if (!free) for (const o of c.agents) if (o !== a && o.tp && !o.tp.free && o.tp.cut == null && o.tp.u < STAGGER) q++;
  // a stall user's departure is unseen: start where the landing starts, so it fades in rather than pops
  const u = prev.hid ? real(T.L_IN, d) : q ? -STAGGER * Math.min(q, QUEUE) : 0;
  if (!pays(a, i, u, c.speed, d)) return null;
  const [x1, y1] = a.path[i];
  return {
    was,
    u,
    i,
    x0: a.x,
    y0: a.y,
    x1,
    y1,
    hide: !!prev.hid,
    free,
    stool: prev.stool || false,
    sw: false,
    cut: null,
    again: false,
    style,
    d,
    swAt: d[1] > DD[1] ? DEP : T.SWITCH, // a traveller is at the landing from the start of its trip
    len,
    route: g || prev.hid ? routeTo(a, i) : null, // a hidden start leaves where it is first seen
    mk: 0,
    desk: deskFor(a, key, c.agents),
  };
}
// Runs the clock (sim time, not scaled by speed). Mutates only the agent; true while the person is held.
function step(a, dt) {
  const tp = a.tp;
  tp.u += dt > 0 ? dt : 0;
  if (tp.cut != null) {
    if (tp.u < tp.cut + T.CUT) {
      a.moving = false;
      return true; // held while the effect rewinds
    }
    a.tp = null;
    if (!tp.again) return false;
    // Back to the break goal (and the stall), so updateAgent's next goal change plans afresh from here.
    a.goalKey = tp.was;
    a.wcIn = tp.hide;
    a.path = [];
    a.moving = false;
    return true;
  }
  const cu = core(tp.u, tp.d);
  if (!tp.sw) a.stool = cu < T.SQUEEZE ? tp.stool : false; // seated pose kept until fully white
  if (!tp.sw && cu >= (tp.swAt || T.SWITCH)) {
    tp.sw = true;
    a.x = tp.x1;
    a.y = tp.y1;
    a.path = a.path.slice(tp.i + 1); // at least the goal point is left, so arrival runs as today
    const d = a.path[0][0] - a.x + a.path[0][1] - a.y;
    a.dirFront = d > 0.0001 ? true : d < -0.0001 ? false : a.dirFront;
  }
  if (cu >= T.END) a.tp = null;
  if (cu >= T.RELEASE) return false;
  a.moving = false;
  return true;
}
// The speech bubble is hidden from the plan (queue included, so a return shower's bubbles do not pile up over the
// circles) until the colours are back.
const unseen = tp => !!tp && tp.cut == null && core(tp.u, tp.d) < T.LAND;

const clamp = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const r = (u, a, b) => clamp((u - a) / (b - a));
const ease = p => p * p * (3 - 2 * p);
const out2 = p => 1 - (1 - p) * (1 - p);
const in2 = p => p * p;
const within = (u, a, b) => u >= a && u < b;
const spinAt = (u, a, b) => 0.9 * u + 0.8 * ease(r(u, a, b)); // periods: a steady turn plus a flourish
// One end of the effect. Amounts are 0 when off; the clocks wave, rings, motes and burst are -1 when off.
// Column: top/bot in px above the feet, w width factor, colA alpha, core half-width; all 0 when off.
const end = () => ({
  ring: 0,
  dim: 0,
  sweep: 0,
  spin: 0,
  flash: 0,
  wave: -1,
  top: 0,
  bot: 0,
  w: 0,
  colA: 0,
  core: 0,
  motes: -1,
  burst: -1,
  rings: -1,
});
// What look() fills: o (origin) and l (landing) ends, bolt (-1 off), and the person:
// show 0 nothing, 1 normal at `alpha`, 2 normal plus a white silhouette at `white`, 3 the white silhouette only,
// squeezed by sx, sy and lifted by `lift` px around the feet.
const newLook = () => ({ o: end(), l: end(), bolt: -1, show: 1, white: 0, sx: 1, sy: 1, lift: 0, alpha: 1 });
function setEnd(e, ring, dim, sweep, spin) {
  e.ring = ring;
  e.dim = dim;
  e.sweep = sweep;
  e.spin = spin;
  e.flash = 0;
  e.wave = -1;
  e.top = e.bot = e.w = e.colA = e.core = 0;
  e.motes = e.burst = e.rings = -1;
}
function column(e, top, bot, w, colA, core) {
  e.top = top;
  e.bot = bot;
  e.w = w;
  e.colA = colA;
  e.core = core;
}
function person(L, show, white, q) {
  L.show = show;
  L.white = white;
  L.sx = 1 - 0.85 * q;
  L.sy = 1 + 0.6 * q;
  L.lift = Math.round(28 * q);
  L.alpha = 1;
}
// The person and the origin end at clock u, uncut and not calm.
function origin(L, u, hide) {
  const o = L.o;
  if (hide) setEnd(o, 0, 0, 0, 0);
  else {
    const on = u >= 0;
    setEnd(o, on ? 1 - r(u, 0.5, 0.85) : 0, u < T.O_IN ? 0.35 : 0, out2(r(u, 0, 0.2)), on ? spinAt(u, 0.15, 0.55) : 0);
    if (within(u, 0.2, 0.32)) o.flash = 1 - r(u, 0.2, 0.32);
    if (within(u, 0.2, 0.5)) o.wave = r(u, 0.2, 0.5);
    if (within(u, 0.18, 0.54)) {
      const g = out2(r(u, 0.18, 0.3)),
        lift = in2(r(u, 0.4, 0.52));
      column(o, 80 * g + 40 * lift, 80 * lift, 1, 1 - r(u, 0.46, 0.54), 1);
    }
    if (within(u, 0.3, 0.56)) o.rings = u - 0.3;
    if (within(u, 0.15, 0.95)) o.motes = u - 0.15;
  }
  L.bolt = !hide && within(u, 0.42, 0.54) ? r(u, 0.42, 0.54) : -1;
  if (hide && u < 0.56) person(L, 0, 0, 0);
  else if (u < T.WHITE) person(L, 1, 0, 0);
  else if (u < T.SQUEEZE) person(L, 2, r(u, T.WHITE, T.SQUEEZE), 0);
  else if (u < 0.42) person(L, 3, 1, in2(r(u, T.SQUEEZE, 0.42)));
  else if (u < 0.56) person(L, 0, 0, 0);
  else if (u < 0.7) person(L, 3, 1, 1 - out2(r(u, 0.56, 0.7)));
  else if (u < T.LAND) person(L, 2, 1 - r(u, 0.7, T.LAND), 0);
  else person(L, 1, 0, 0);
}
function landingEnd(e, u) {
  const on = u >= T.L_IN;
  setEnd(e, on ? 1 - r(u, T.RELEASE, T.END) : 0, 0, out2(r(u, T.L_IN, 0.46)), on ? spinAt(u, 0.46, 0.8) : 0);
  if (within(u, 0.56, 0.68)) e.flash = 1 - r(u, 0.56, 0.68);
  if (within(u, 0.56, 0.86)) e.wave = r(u, 0.56, 0.86);
  if (within(u, 0.5, 0.92)) {
    column(e, 80, 80 * (1 - in2(r(u, 0.5, 0.56))), 1 - r(u, 0.62, 0.92), 1 - r(u, 0.7, 0.92), u < 0.62 ? 2 : 1);
  }
  if (within(u, 0.5, 0.7)) e.rings = u - 0.5;
  if (within(u, 0.56, 1.3)) e.motes = u - 0.56;
  if (within(u, 0.56, 0.8)) e.burst = r(u, 0.56, 0.8);
}
// Reduced motion: still circles fading in and out, the person fading out and in.
const calmO = u => r(u, 0, 0.2) * (1 - r(u, 0.5, 0.85));
const calmL = u => r(u, 0.4, 0.56) * (1 - r(u, T.RELEASE, T.END));
function calmLook(L, u, hide) {
  setEnd(L.o, hide ? 0 : calmO(u), !hide && u < T.O_IN ? 0.35 : 0, hide ? 0 : 1, 0);
  setEnd(L.l, calmL(u), 0, 1, 0);
  L.bolt = -1;
  person(L, 1, 0, 0);
  L.alpha = u < T.SWITCH ? (hide ? 0 : 1 - r(u, T.WHITE, 0.4)) : r(u, 0.56, T.LAND);
  if (L.alpha === 0) L.show = 0;
}
// The clock to what shows, written into `out` (from newLook), every field on every call. Reads only tp.
function look(tp, calm, out) {
  const u = core(tp.u, tp.d),
    cut = tp.cut == null ? 0 : core(tp.cut, tp.d);
  if (tp.cut == null) {
    if (calm) calmLook(out, u, tp.hide);
    else {
      origin(out, u, tp.hide);
      landingEnd(out.l, u);
    }
    return out;
  }
  // A cut rewinds: the origin end and the person run back from `cut` to 0 while both circles fade.
  const C = 1 - r(tp.u, tp.cut, tp.cut + T.CUT),
    v = cut * C;
  if (calm) {
    calmLook(out, v, tp.hide);
    out.o.ring = tp.hide ? 0 : C * calmO(cut);
    out.o.dim = 0;
    setEnd(out.l, C * calmL(cut), 0, 1, 0);
    return out;
  }
  origin(out, v, tp.hide);
  const o = out.o;
  if (!tp.hide) {
    o.ring = C;
    o.spin = 0.9 * tp.u;
  }
  o.dim = o.flash = 0;
  o.wave = o.motes = out.bolt = -1;
  setEnd(out.l, cut >= T.L_IN ? C : 0, 0, out2(r(cut, T.L_IN, 0.46)), 0);
  return out;
}
// What a style draws from (office-draw-teleport.js X.L): both clocks, the rewind and each core segment's 0-1.
const newPhase = () => ({
  u: 0,
  v: 0,
  d: DD,
  cut: false,
  C: 1,
  calm: false,
  hide: false,
  q: 0,
  sw: false,
  secs: 0,
  dep: -1,
  trip: -1,
  arr: -1,
  fade: -1,
});
const part = (v, j) => (v >= CB[j] && v < CB[j + 1] ? (v - CB[j]) / (CB[j + 1] - CB[j]) : -1);
function phase(tp, calm, out) {
  const d = tp.d || DD,
    cut = tp.cut != null,
    u = core(tp.u, d),
    C = cut ? 1 - r(tp.u, tp.cut, tp.cut + T.CUT) : 1,
    v = cut ? core(tp.cut, d) * C : u;
  out.u = u;
  out.v = v;
  out.d = d;
  out.cut = cut;
  out.C = C;
  out.calm = !!calm;
  out.hide = !!tp.hide;
  out.q = tp.u < 0 ? 1 : 0;
  out.sw = !cut && u >= (tp.swAt || T.SWITCH);
  out.secs = tp.u;
  out.dep = part(v, 0);
  out.trip = part(v, 1);
  out.arr = part(v, 2);
  out.fade = part(v, 3);
  return out;
}

export const TeleportLogic = {
  DEP,
  ARR,
  CB,
  DD,
  core,
  real,
  pays,
  newPhase,
  phase,
  FAR,
  KEEP,
  BUSY,
  BACK,
  STAGGER,
  QUEUE,
  WALK,
  GAIN,
  LITE,
  CAP,
  T,
  rest,
  inWay,
  landing,
  occupied,
  plan,
  step,
  unseen,
  newLook,
  look,
};
