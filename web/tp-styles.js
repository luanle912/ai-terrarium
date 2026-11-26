// The teleport styles as data (no DOM, no canvas; tests/tp-styles.test.mjs): 36 profiles, who gets which, and the
// Settings choice. The drawing of each style is web/tp-style-<id>.js; the clock is web/teleport-logic.js.
// A profile: { id, tier, kind, dep, v, tmin, tmax, arr, fade, holiday }
//   tier    S vanish and appear, G something travels, F the person flies, H a holiday's own
//   kind    none (no travel drawn), ground (along the route), air (an arc over the island)
//   dep arr fade   real seconds of departure, arrival and fade-out; trip = clamp(len / v, tmin, tmax), 0.12 when v is 0
import { PeopleLogic } from './people-logic.js';

const KEY = 'ai-terrarium.teleport';
// The circle's four segments: core and real clocks agree.
const DD = [0.42, 0.12, 0.38, 0.43];
const NO_TRIP = 0.12;
// id, tier, kind, dep, v (tiles/s), tmin, tmax, arr, fade, holiday
const ROWS = [
  ['caped', 'F', 'air', 0.7, 12, 1.0, 2.0, 0.9, 0.4],
  ['goldaura', 'S', 'none', 1.1, 0, 0, 0, 0.6, 0.8],
  ['cloudride', 'F', 'air', 1.0, 10, 1.2, 2.2, 0.6, 0.8],
  ['bolt', 'G', 'ground', 0.6, 30, 0.4, 0.9, 0.5, 0.5],
  ['hammer', 'F', 'air', 0.7, 12, 1.0, 2.0, 0.6, 0.4],
  ['webswing', 'F', 'air', 0.6, 10, 1.2, 2.4, 0.6, 0.4],
  ['dashrun', 'G', 'ground', 0.42, 14, 0.6, 1.8, 0.5, 0.5],
  ['packet', 'G', 'ground', 0.6, 16, 0.6, 1.8, 0.7, 0.4],
  ['cutpaste', 'G', 'air', 0.7, 14, 0.8, 1.8, 0.6, 0.4],
  ['upload', 'G', 'air', 1.0, 14, 0.8, 1.8, 0.8, 0.4],
  ['gitbranch', 'G', 'ground', 0.6, 14, 0.8, 1.8, 0.5, 0.6],
  ['printer3d', 'S', 'none', 0.7, 0, 0, 0, 1.0, 0.4],
  ['respawn', 'S', 'none', 0.9, 0, 0, 0, 0.6, 1.0],
  ['blocks', 'G', 'ground', 0.75, 12, 0.8, 2.0, 0.8, 0.4],
  ['circle', 'S', 'air', 0.42, 0, 0, 0, 0.38, 0.43],
  ['broom', 'F', 'air', 0.6, 10, 1.2, 2.4, 0.6, 0.4],
  ['carpet', 'F', 'air', 0.9, 10, 1.2, 2.4, 0.7, 0.5],
  ['butterflies', 'G', 'air', 0.8, 10, 1.0, 2.2, 0.8, 0.5],
  ['frog', 'G', 'ground', 0.9, 8, 1.2, 2.4, 0.6, 0.4],
  ['lamp', 'G', 'air', 0.85, 10, 1.0, 2.2, 0.7, 0.4],
  ['mirror', 'S', 'none', 0.8, 0, 0, 0, 0.7, 0.5],
  ['cannon', 'F', 'air', 1.0, 12, 1.0, 2.0, 1.0, 0.4],
  ['jetpack', 'F', 'air', 0.8, 10, 1.2, 2.4, 0.8, 0.4],
  ['smoke', 'S', 'none', 0.5, 0, 0, 0, 0.5, 0.7],
  ['ufo', 'G', 'air', 1.0, 10, 1.0, 2.2, 0.8, 0.8],
  ['crane', 'F', 'air', 1.0, 10, 1.2, 2.2, 0.7, 0.8],
  ['balloons', 'F', 'air', 0.9, 8, 1.4, 2.4, 0.7, 0.6],
  ['trampoline', 'F', 'air', 0.9, 10, 1.2, 2.4, 0.6, 0.4],
  ['twister', 'G', 'ground', 0.6, 10, 1.0, 2.2, 0.9, 0.9],
  ['mole', 'G', 'ground', 0.6, 9, 1.0, 2.4, 0.8, 0.5],
  ['pipe', 'S', 'none', 0.8, 0, 0, 0, 0.7, 0.5],
  ['portal', 'S', 'none', 0.7, 0, 0, 0, 0.6, 0.5],
  ['sleigh', 'H', 'air', 1.0, 10, 1.2, 2.2, 0.8, 0.8, 'christmas'],
  ['liondance', 'H', 'ground', 0.9, 8, 1.2, 2.3, 0.8, 0.5, 'tet'],
  ['starlantern', 'H', 'air', 1.0, 8, 1.4, 2.4, 0.6, 1.0, 'midautumn'],
  ['bats', 'H', 'air', 0.8, 10, 1.0, 2.2, 1.0, 0.5, 'halloween'],
];
const STYLES = ROWS.map(([id, tier, kind, dep, v, tmin, tmax, arr, fade, holiday = null]) => ({
  id,
  tier,
  kind,
  dep,
  v,
  tmin: v ? tmin : NO_TRIP,
  tmax: v ? tmax : NO_TRIP,
  arr,
  fade,
  holiday,
}));
const BY_ID = Object.fromEntries(STYLES.map(s => [s.id, s]));
const HOLIDAY = Object.fromEntries(STYLES.filter(s => s.holiday).map(s => [s.holiday, s.id]));
const RANDOM = STYLES.filter(s => !s.holiday).map(s => s.id);
const CHOICES = ['random', 'off', ...STYLES.map(s => s.id)];

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
// The real seconds of the four core segments for a walk of `len` tiles to the landing.
function durs(id, len) {
  const p = BY_ID[id];
  if (!p || id === 'circle') return DD;
  return [p.dep, p.v ? clamp(len / p.v, p.tmin, p.tmax) : NO_TRIP, p.arr, p.fade];
}
// Pure: the style id for a person, or null when teleports are off.
function pick(sid, choice, holiday) {
  if (choice === 'off') return null;
  if (BY_ID[choice]) return choice;
  return HOLIDAY[holiday] || RANDOM[PeopleLogic.roll(sid, 'teleport', RANDOM.length)];
}

// The holiday a page shows: the Christmas event while it is on (Settings → Event, its preview included), else the
// holiday tree by the office. Christmas only through the event: its tree there is never drawn (office-draw.js held).
function holidayOf(tree, ev) {
  if (ev) return HOLIDAY[ev.key] ? ev.key : null;
  return tree !== 'christmas' && HOLIDAY[tree] ? tree : null;
}

let cur = 'random',
  holidayFn = null,
  calmFn = () => false,
  hSec = NaN,
  hVal = null;
// The holiday's key ('christmas', 'tet', 'midautumn', 'halloween') or null, asked of the page once a second so a
// Settings change or a preview shows within the second.
function holidayNow(now = Date.now()) {
  const s = Math.floor(now / 1000);
  if (s !== hSec) {
    hSec = s;
    const k = holidayFn ? holidayFn(now) : null;
    hVal = HOLIDAY[k] ? k : null;
  }
  return hVal;
}
function useHoliday(fn) {
  holidayFn = fn;
  hSec = NaN;
}
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
  HOLIDAY,
  RANDOM,
  CHOICES,
  durs,
  pick,
  styleFor: (a, now) => pick(a.sid || String(a.id), cur, holidayNow(now)),
  calm: () => calmFn(),
  useCalm(fn) {
    calmFn = fn;
  },
  useHoliday,
  holidayOf,
  holidayNow,
  choice: () => cur,
  setChoice(c) {
    if (CHOICES.includes(c)) cur = c;
  },
  loadChoice,
  saveChoice,
  adopt,
  reset() {
    cur = 'random';
    holidayFn = null;
    calmFn = () => false;
    hSec = NaN;
    hVal = null;
  },
};
