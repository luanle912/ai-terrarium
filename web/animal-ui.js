// Pure helpers for the page's animal UI (no DOM, no clock): tests/animal-ui.test.mjs imports them.
// The server owns every rule; these only shape its view for display and never decide an ending locally.
import { AnimalWalk } from './animal-walk.js';

const TIER_ORDER = Object.freeze(['common', 'rare', 'epic', 'legendary']);
const TIER_COLOR = Object.freeze({ common: '#c9d1d9', rare: '#4ea1ff', epic: '#b26bff', legendary: '#ffcc33' });
// Broadcasts come every 5 s; past this the stream is stalled and local clocks stop rather than run out.
const MAX_GAP_MS = 15000,
  EXPIRING_SHARE = 0.1;
const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
const tierRank = t => {
  const i = TIER_ORDER.indexOf(t);
  return i < 0 ? TIER_ORDER.length : i;
};
const tierOf = (view, species) => {
  const s = view && Array.isArray(view.species) && view.species.find(x => x.id === species);
  return s ? s.tier : null;
};

function clock(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
// The weather the mode really has (a preview's `back`), as the server's three kinds.
function envWeather(to, preview) {
  const w = preview && preview.back ? preview.back : to;
  return w === 'storm' || w === 'rain' ? 'rain' : w === 'snow' ? 'snow' : 'clear';
}
function advanceAttempt(a, e) {
  if (!a) return a;
  if (a.phase === 'pending') return { ...a, pendingLeftMs: Math.max(0, a.pendingLeftMs - e) };
  return {
    ...a,
    deadlineLeftMs: Math.max(0, a.deadlineLeftMs - e),
    workMs: a.counting ? Math.min(a.needMs, a.workMs + e) : a.workMs,
  };
}
// The view `elapsedMs` after it arrived: countdowns move, nothing ends (the server says when).
function advance(view, elapsedMs) {
  if (!view || view.disabled) return view;
  const e = clampN(Number(elapsedMs) || 0, 0, MAX_GAP_MS);
  if (!e) return view;
  const wild =
    view.wild && !view.attempt ? { ...view.wild, stayLeftMs: Math.max(0, view.wild.stayLeftMs - e) } : view.wild;
  return { ...view, wild, attempt: advanceAttempt(view.attempt, e) };
}
function expiring(view) {
  const a = view && view.attempt;
  if (!a || a.phase !== 'catching' || !view.wild || !view.tiers) return false;
  const t = view.tiers[tierOf(view, view.wild.species)];
  return !!t && a.deadlineLeftMs <= t.deadlineMs * EXPIRING_SHARE;
}
// Spec 6.3: lowest tier first, then oldest first.
function pickerList(view) {
  const out = new Set(view.out || []);
  return (view.caught || [])
    .map((c, i) => ({ ...c, tier: tierOf(view, c.species), out: out.has(c.id), i }))
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.at - b.at || a.i - b.i);
}
function speciesRows(view) {
  const seen = new Set(view.speciesCaught || []);
  return (view.species || [])
    .map((s, i) => ({
      ...s,
      i,
      seen: seen.has(s.id),
      animals: (view.caught || []).filter(c => c.species === s.id).sort((a, b) => a.at - b.at),
    }))
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.i - b.i);
}
const NOTICE_OF = Object.freeze({
  escaped: 'escaped',
  leave: 'left',
  gaveUp: 'ranOff',
  cancelled: 'ranOff',
  pendingExpired: 'ranOff',
  freed: 'freed',
});
// Server events as notice kinds; the page turns kinds into text.
function noticesFor(events, view) {
  const out = [];
  for (const e of Array.isArray(events) ? events : []) {
    if (!e || typeof e.type !== 'string') continue;
    if (e.type === 'spawn' && e.wild)
      out.push({ kind: tierOf(view, e.wild.species) === 'legendary' ? 'legendary' : 'spawn', species: e.wild.species });
    else if (e.type === 'catchStarted') out.push({ kind: 'catchStarted', species: e.species, needMs: e.needMs });
    else if (e.type === 'progress' && e.expiring && view && view.wild)
      out.push({ kind: 'expiring', species: view.wild.species });
    else if (e.type === 'caught') {
      out.push({ kind: 'caught', species: e.species });
      if (e.newSpecies) out.push({ kind: 'newSpecies', species: e.species });
    } else if (Object.hasOwn(NOTICE_OF, e.type)) out.push({ kind: NOTICE_OF[e.type], species: e.species });
  }
  return out;
}
// Who should walk the island: the wild animal (held still while being caught) and the released ones.
function wanted(view) {
  if (!view || view.disabled) return [];
  const rec = new Map((view.caught || []).map(c => [c.id, c])),
    list = [];
  if (view.wild)
    list.push({
      key: 'wild:' + view.wild.id,
      id: view.wild.id,
      species: view.wild.species,
      kind: 'wild',
      hold: !!view.attempt,
    });
  for (const id of view.out || []) {
    const c = rec.get(id);
    if (c) list.push({ key: 'out:' + id, id, species: c.species, kind: 'out', hold: false });
  }
  return list;
}
function addWalker(x, places, rand) {
  const cell = AnimalWalk.spawnCell(x.id, places);
  return cell ? { ...AnimalWalk.create(x.id, x.species, cell, rand), key: x.key, kind: x.kind, hold: x.hold } : null;
}
// New walkers appear at their id's cell; ones the view dropped walk off. `blocked` keys wait (a catch effect runs).
function reconcile(walkers, view, { places, rand, known = () => true, blocked = null }) {
  const want = wanted(view).filter(x => known(x.species)),
    byKey = new Map(want.map(x => [x.key, x])),
    have = new Set(walkers.map(w => w.key));
  const kept = walkers.map(w => {
    const x = byKey.get(w.key);
    if (!x) return w.leave ? w : { ...w, leave: true, hold: false };
    return w.leave || w.hold === x.hold ? w : { ...w, hold: x.hold };
  });
  const added = want
    .filter(x => !have.has(x.key) && !(blocked && blocked.has(x.key)))
    .map(x => addWalker(x, places, rand))
    .filter(Boolean);
  return [...kept, ...added];
}
// Empty pixels beside a body pixel, in a grid one pixel larger on every side.
function outline(rows) {
  const h = rows.length,
    w = Math.max(0, ...rows.map(r => r.length)),
    body = (x, y) => y >= 0 && y < h && x >= 0 && x < w && (rows[y][x] || '.') !== '.';
  const out = [];
  for (let y = -1; y <= h; y++)
    for (let x = -1; x <= w; x++)
      if (!body(x, y) && N4.some(([dx, dy]) => body(x + dx, y + dy))) out.push([x + 1, y + 1]);
  return out;
}
// An arrow at the stage edge (inset m) pointing at an off-stage point; null while the point is on stage.
function edgeArrow(x, y, w, h, m) {
  if (x >= 0 && x <= w && y >= 0 && y <= h) return null;
  return { x: clampN(x, m, w - m), y: clampN(y, m, h - m), angle: Math.atan2(y - h / 2, x - w / 2) };
}
// The camera (unclamped) that puts wrapper point (lx, ly) at the stage centre at the current zoom.
function centerOn(cam, b, lx, ly) {
  return { z: cam.z, tx: b.stageW / 2 - b.ox - cam.z * lx, ty: b.stageH / 2 - b.oy - cam.z * ly };
}
// Spec 4.4: the wait and stay clocks run only while the user can actually see the animals.
function envVisible(visibilityState, hidden) {
  return !hidden && visibilityState !== 'hidden';
}
// Esc counts only from inside the panel or from no focused control, never from an unrelated field.
function escInside(target, root, doc) {
  if (!target || (doc && (target === doc.body || target === doc.documentElement))) return true;
  return !!(root && root.contains(target));
}
// Spec 5.1 tests animals first; the wide phone target yields only to an agent nearer the tap (ties stay with the
// animal).
function preferTap(animalD, agentD) {
  if (animalD != null && (agentD == null || animalD <= agentD)) return 'animal';
  return agentD != null ? 'agent' : null;
}
function restoreTarget(opener, chip) {
  if (opener && opener.isConnected) return opener;
  return chip && chip.isConnected ? chip : null;
}

export {
  TIER_ORDER,
  TIER_COLOR,
  MAX_GAP_MS,
  tierRank,
  tierOf,
  clock,
  envWeather,
  advance,
  expiring,
  pickerList,
  speciesRows,
  noticesFor,
  wanted,
  reconcile,
  outline,
  edgeArrow,
  centerOn,
  envVisible,
  escInside,
  preferTap,
  restoreTarget,
};
export const AnimalUI = {
  TIER_ORDER,
  TIER_COLOR,
  MAX_GAP_MS,
  tierRank,
  tierOf,
  clock,
  envWeather,
  advance,
  expiring,
  pickerList,
  speciesRows,
  noticesFor,
  wanted,
  reconcile,
  outline,
  edgeArrow,
  centerOn,
  envVisible,
  escInside,
  preferTap,
  restoreTarget,
};
