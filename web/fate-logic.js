// How someone leaves the island when their session ends (a closed or killed session, a finished sub-agent): not only
// out of the EXIT door. Each way out (a "fate") has a weight that depends on the weather, the season and the hour, a
// place where it happens and how long its scene plays. Pure (no DOM, no canvas): the page and
// tests/fate-logic.test.mjs both run this block; randomness comes in as `rand`.
//
// c (the conditions) = { wet, storm, windy, cold, frozen, night, hot, calm, xmas, eve }:
//   wet     it is raining            storm  a thunderstorm          windy  a storm, or autumn's steady wind
//   cold    winter or snow falling   frozen the lake is iced over   night  after dark
//   hot     a clear summer day       calm   reduced motion: only the door
//   xmas    the Christmas event is on         eve    it is Christmas Eve or Christmas Day
// at: 'door' the EXIT door · 'lawn' open lawn in front of the office · 'lake' the bathing spots in the lake
//     'way' a few steps along the way to the door, wherever the person was
const FATES = {
  exit: { at: 'door', dur: 0, w: () => 3 },
  lightning: { at: 'lawn', dur: 3.4, w: c => (c.storm ? 14 : c.wet ? 7 : 0) },
  wind: { at: 'lawn', dur: 3.6, w: c => (c.windy ? 6 : 0) },
  freeze: { at: 'lawn', dur: 4.2, w: c => (c.cold ? 12 : 0) },
  lake: { at: 'lake', dur: 4.6, w: c => (c.frozen ? 0 : 2) },
  fish: { at: 'lake', dur: 3.6, w: c => (c.frozen ? 0 : 2) },
  duck: { at: 'lake', dur: 4, w: c => (c.frozen ? 0 : 1.5) },
  snowball: { at: 'lawn', dur: 4.2, w: c => (c.cold ? 5 : 0) },
  bird: { at: 'lawn', dur: 4, w: c => (c.wet || c.night ? 0 : 2) },
  ufo: { at: 'lawn', dur: 5, w: c => (c.night ? 6 : 1.5) },
  balloon: { at: 'lawn', dur: 5, w: c => (c.wet || c.night ? 0 : 2.5) },
  rocket: { at: 'lawn', dur: 3.4, w: () => 2 },
  melt: { at: 'lawn', dur: 4.2, w: c => (c.hot ? 6 : 0) },
  hole: { at: 'way', dur: 3, w: () => 2.5 },
  banana: { at: 'way', dur: 3.2, w: () => 2 },
  dust: { at: 'way', dur: 3, w: () => 2 },
  ghost: { at: 'way', dur: 4.6, w: () => 2 },
  // the Christmas event's own
  sleigh: { at: 'lawn', dur: 5, w: c => (c.eve ? 10 : 0) },
  wrapped: { at: 'way', dur: 3.6, w: c => (c.xmas ? 4 : 0) },
  skateoff: { at: 'lake', dur: 4.4, w: c => (c.xmas && c.frozen ? 5 : 0) },
  chimney: { at: 'lawn', dur: 4.6, w: c => (c.xmas ? 3 : 0) },
};
const KINDS = Object.keys(FATES);

// The weight of each fate under conditions c. `last` (the fate of whoever left before) is left out when anything
// else is possible, so two people in a row never go the same way.
function weights(c, last) {
  const out = {};
  for (const k of KINDS) out[k] = c.calm ? (k === 'exit' ? 1 : 0) : FATES[k].w(c);
  if (last && out[last] > 0 && KINDS.some(k => k !== last && out[k] > 0)) out[last] = 0;
  return out;
}
// One fate, by weight. `force` (a debug hook) wins when it names a fate.
function pick(c, rand, last, force) {
  if (force && FATES[force]) return force;
  const w = weights(c, last),
    total = KINDS.reduce((s, k) => s + w[k], 0);
  let r = rand() * total;
  for (const k of KINDS) {
    r -= w[k];
    if (w[k] > 0 && r < 0) return k;
  }
  return 'exit';
}
// Where the fate happens: { tile: [x, y], pt: [x, y] } or null for the door (and when the place has no spot).
// places = { lawn: [[x, y], ...], lake: [[x, y], ...] }; `way` is the walk to the door as cells, from where the
// person stands.
function goal(kind, places, way, rand) {
  const at = FATES[kind] ? FATES[kind].at : 'door',
    cell = c => ({ tile: [c[0], c[1]], pt: [c[0] + 0.5, c[1] + 0.5] }),
    any = list =>
      list && list.length ? cell(list[Math.min(list.length - 1, Math.floor(rand() * list.length))]) : null;
  if (at === 'lawn') return any(places.lawn);
  if (at === 'lake') return any(places.lake);
  if (at === 'way') {
    // two to five steps on, but never the last cell (the door itself)
    if (!way || way.length < 2) return null;
    return cell(way[Math.min(way.length - 2, 2 + Math.floor(rand() * 4))]);
  }
  return null;
}
// The conditions from what the page knows: fx is the weather mix (0..1 each), look the season's row
// (SeasonLogic.look), day the daylight factor (0 night .. 1 day).
function conditions({ fx, look, day, summer, calm, ev }) {
  const f = fx || {},
    wet = Math.max(f.rain || 0, f.storm || 0) > 0.4,
    storm = (f.storm || 0) > 0.4;
  return {
    wet,
    storm,
    windy: storm || (look && look.wind >= 0.3),
    cold: !!(look && look.frozen) || (f.snow || 0) > 0.4,
    frozen: !!(look && look.frozen),
    night: day < 0.3,
    hot: !!summer && day > 0.7 && !wet && (f.cloud || 0) < 0.5 && !((f.snow || 0) > 0.1),
    calm: !!calm,
    xmas: !!ev,
    eve: !!ev && !!(ev.eve || ev.day),
  };
}

export const FateLogic = { FATES, KINDS, weights, pick, goal, conditions };
