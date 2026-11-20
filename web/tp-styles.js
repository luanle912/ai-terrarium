// The teleport styles as data (no DOM, no canvas; tests/tp-styles.test.mjs): the profiles, who gets which, and the
// Settings choice. The drawing of each style is web/tp-style-<id>.js; the clock is web/teleport-logic.js.
// A profile: { id, tier, kind, dep, v, tmin, tmax, arr, fade }
//   tier    S vanish and appear, G something travels
//   kind    none (no travel drawn), ground (along the route), air (an arc over the island)
//   dep arr fade   real seconds of departure, arrival and fade-out; trip = clamp(len / v, tmin, tmax), 0.12 when v is 0
import { PeopleLogic } from './people-logic.js';

const KEY = 'ai-terrarium.teleport';
// The circle's four segments: core and real clocks agree.
const DD = [0.42, 0.12, 0.38, 0.43];
const NO_TRIP = 0.12;
// id, tier, kind, dep, v (tiles/s), tmin, tmax, arr, fade
const ROWS = [
  ['goldaura', 'S', 'none', 1.1, 0, 0, 0, 0.6, 0.8],
  ['bolt', 'G', 'ground', 0.6, 30, 0.4, 0.9, 0.5, 0.5],
  ['dashrun', 'G', 'ground', 0.42, 14, 0.6, 1.8, 0.5, 0.5],
  ['packet', 'G', 'ground', 0.6, 16, 0.6, 1.8, 0.7, 0.4],
  ['cutpaste', 'G', 'air', 0.7, 14, 0.8, 1.8, 0.6, 0.4],
  ['upload', 'G', 'air', 1.0, 14, 0.8, 1.8, 0.8, 0.4],
  ['gitbranch', 'G', 'ground', 0.6, 14, 0.8, 1.8, 0.5, 0.6],
  ['printer3d', 'S', 'none', 0.7, 0, 0, 0, 1.0, 0.4],
  ['respawn', 'S', 'none', 0.9, 0, 0, 0, 0.6, 1.0],
  ['circle', 'S', 'air', 0.42, 0, 0, 0, 0.38, 0.43],
  ['mirror', 'S', 'none', 0.8, 0, 0, 0, 0.7, 0.5],
  ['smoke', 'S', 'none', 0.5, 0, 0, 0, 0.5, 0.7],
  ['pipe', 'S', 'none', 0.8, 0, 0, 0, 0.7, 0.5],
  ['portal', 'S', 'none', 0.7, 0, 0, 0, 0.6, 0.5],
];
const STYLES = ROWS.map(([id, tier, kind, dep, v, tmin, tmax, arr, fade]) => ({
  id,
  tier,
  kind,
  dep,
  v,
  tmin: v ? tmin : NO_TRIP,
  tmax: v ? tmax : NO_TRIP,
  arr,
  fade,
}));
const BY_ID = Object.fromEntries(STYLES.map(s => [s.id, s]));
const RANDOM = STYLES.map(s => s.id); // the pool Random draws from: every style
const CHOICES = ['random', 'off', ...STYLES.map(s => s.id)];

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
// The real seconds of the four core segments for a walk of `len` tiles to the landing.
function durs(id, len) {
  const p = BY_ID[id];
  if (!p || id === 'circle') return DD;
  return [p.dep, p.v ? clamp(len / p.v, p.tmin, p.tmax) : NO_TRIP, p.arr, p.fade];
}
// Pure: the style id for a person, or null when teleports are off.
function pick(sid, choice) {
  if (choice === 'off') return null;
  if (BY_ID[choice]) return choice;
  return RANDOM[PeopleLogic.roll(sid, 'teleport', RANDOM.length)];
}

let cur = 'random',
  calmFn = () => false;
function loadChoice(storage) {
  try {
    const raw = storage && storage.getItem(KEY);
    return CHOICES.includes(raw) ? raw : 'random';
  } catch (e) {
    return 'random';
  }
}
function saveChoice(storage, c) {
  try {
    storage.setItem(KEY, CHOICES.includes(c) ? c : 'random');
    return true;
  } catch (e) {
    return false;
  }
}
// What a page does with the server's choice: take it when it differs, or seed the server once with a non-default own.
function adopt(server, own, { wallpaper = false, seeded = false } = {}) {
  if (CHOICES.includes(server)) return { take: server !== own ? server : null, seed: false };
  return { take: null, seed: !wallpaper && !seeded && own !== 'random' };
}

export const TpStyles = {
  KEY,
  DD,
  STYLES,
  BY_ID,
  RANDOM,
  CHOICES,
  durs,
  pick,
  styleFor: a => pick(a.sid || String(a.id), cur),
  calm: () => calmFn(),
  useCalm(fn) {
    calmFn = fn;
  },
  choice: () => cur,
  setChoice(c) {
    if (CHOICES.includes(c)) cur = c;
  },
  loadChoice,
  saveChoice,
  adopt,
  reset() {
    cur = 'random';
    calmFn = () => false;
  },
};
