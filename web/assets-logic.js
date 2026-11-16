// The /assets page as logic (no DOM, no canvas; tests/assets-logic.test.mjs): the global controls and their defaults,
// filtering and search, how many variants an item has, the cells of the "all variants" grid, which controls reach an
// item, the deep link in the URL hash and the dates an item shows up on.
import { EventLogic } from './event-logic.js';

// The scene controls (they change what the game draws) and the view controls (how the page shows it).
const SCENE = ['light', 'season', 'snow', 'event'];
// The categories of the catalogue, in the order of the page's rail (web/assets-registry.js gives them names).
const CAT_IDS = ['plants', 'outdoor', 'island', 'animals', 'people', 'office', 'pantry', 'rooms', 'event', 'world'];
const CHOICES = {
  light: ['day', 'dusk', 'night'],
  season: ['spring', 'summer', 'autumn', 'winter'],
  snow: [false, true],
  event: [0, 1, 2, 3],
  zoom: [2, 3, 4],
  motion: [true, false],
};
// Summer is the game's standard look (web/season-logic.js).
const DEFAULTS = Object.freeze({
  cat: 'all',
  id: null,
  q: '',
  tags: [],
  light: 'day',
  season: 'summer',
  snow: false,
  event: 0,
  zoom: 3,
  motion: true,
  pick: {},
});
// The values a cell of the variants grid takes per scene control (dusk is a blend of the two, so it is left out),
// and the order the controls are dropped in when the grid would have more than MAX_CELLS cells.
const CELL_VALUES = { light: ['day', 'night'], season: CHOICES.season, snow: CHOICES.snow, event: CHOICES.event };
const DROP = ['event', 'snow', 'light', 'season'];
const MAX_CELLS = 48;

// Lower case, without accents (so "lo vi song" finds "Lò vi sóng"), spaces squeezed.
const fold = s =>
  String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .trim();
const words = q => fold(q).split(/\s+/).filter(Boolean);
// What a search looks through: the name in the current language, the id, the tags and the drawing code, plus any
// text `extra(e)` adds (the page adds the names in the other languages).
const haystack = (e, extra) =>
  fold(
    [e.name(), e.id, e.tags.join(' '), e.source.map(s => s.fn + ' ' + s.file).join(' '), extra ? extra(e) : ''].join(
      ' ',
    ),
  );

function filter(entries, { cat, q, tags } = {}, extra) {
  const ws = words(q),
    need = tags || [];
  return entries.filter(
    e =>
      (!cat || cat === 'all' || e.cat === cat) &&
      need.every(t => e.tags.includes(t)) &&
      (!ws.length || ws.every(w => haystack(e, extra).includes(w))),
  );
}
function counts(entries) {
  const out = { all: entries.length };
  for (const e of entries) out[e.cat] = (out[e.cat] || 0) + 1;
  return out;
}

// The item's own axes times the scene controls it reacts to (day and night count as two, dusk being a blend).
function variantCount(e) {
  let n = 1;
  for (const a of e.axes) n *= a.values.length;
  for (const u of e.uses) n *= CELL_VALUES[u].length;
  return n;
}
// The scene an item is drawn in: the controls it uses as chosen, the rest at their defaults, so a card that ignores
// a control never changes with it.
function sceneOf(e, controls) {
  const out = {};
  for (const u of SCENE) out[u] = e.uses.includes(u) ? controls[u] : DEFAULTS[u];
  return out;
}
const defaultPick = e => {
  const p = {};
  for (const a of e.axes) p[a.id] = a.values[0].id;
  return p;
};
// A pick with only the item's axes, each set to one of its values (the first when missing or unknown).
function fixPick(e, pick) {
  const p = {};
  for (const a of e.axes) {
    const v = pick && pick[a.id];
    p[a.id] = a.values.some(x => x.id === v) ? v : a.values[0].id;
  }
  return p;
}

// The cells of the "all variants" grid: every value of every axis of the item, times the scene controls it uses,
// at most MAX_CELLS. Scene controls are fixed at their current value one by one (the event first) until it fits;
// past that the item's own combinations are cut at MAX_CELLS.
function combos(e, controls) {
  const used = SCENE.filter(u => e.uses.includes(u));
  const size = list => list.reduce((n, u) => n * CELL_VALUES[u].length, 1);
  let axesN = 1;
  for (const a of e.axes) axesN *= a.values.length;
  for (const u of DROP) if (axesN * size(used) > MAX_CELLS && used.includes(u)) used.splice(used.indexOf(u), 1);
  const dims = [
    ...e.axes.map(a => a.values.map(v => ['pick', a.id, v.id])),
    ...used.map(u => CELL_VALUES[u].map(v => ['controls', u, v])),
  ];
  let cells = [{ pick: {}, controls }];
  for (const d of dims) {
    const next = [];
    for (const c of cells)
      for (const [part, k, v] of d) {
        if (next.length >= MAX_CELLS * 4) break;
        next.push(
          part === 'pick' ? { ...c, pick: { ...c.pick, [k]: v } } : { ...c, controls: { ...c.controls, [k]: v } },
        );
      }
    cells = next;
  }
  return cells.slice(0, MAX_CELLS);
}

// ---- the deep link: #/<cat>/<name>?light=night&season=winter&v.use=use… (only what differs from the defaults) ----
const ID = /^[a-z]+\.[a-z0-9-]+$/;
const enc = encodeURIComponent;
function toHash(s) {
  const id = s.id && ID.test(s.id) ? s.id : null,
    cat = id ? id.split('.')[0] : s.cat && s.cat !== 'all' ? s.cat : '';
  let path = '#/' + (id ? cat + '/' + id.slice(cat.length + 1) : cat);
  if (id && s.cat === 'all') path = '#/all/' + id;
  const q = [];
  for (const k of ['light', 'season', 'snow', 'event', 'zoom', 'motion'])
    if (s[k] !== DEFAULTS[k]) q.push(k + '=' + (typeof s[k] === 'boolean' ? (s[k] ? 1 : 0) : s[k]));
  if (s.q) q.push('q=' + enc(s.q));
  if (s.tags && s.tags.length) q.push('tags=' + s.tags.map(enc).join(','));
  for (const [k, v] of Object.entries(s.pick || {})) q.push('v.' + enc(k) + '=' + enc(v));
  return path + (q.length ? '?' + q.join('&') : '');
}
const asValue = (k, raw) => {
  const v = k === 'snow' || k === 'motion' ? (raw === '1' ? true : raw === '0' ? false : null) : raw;
  const n = k === 'event' || k === 'zoom' ? Number(v) : v;
  return CHOICES[k].includes(n) ? n : undefined;
};
function fromHash(hash) {
  const s = { ...DEFAULTS, tags: [], pick: {} };
  const raw = String(hash || '').replace(/^#\/?/, ''),
    qi = raw.indexOf('?'),
    path = (qi < 0 ? raw : raw.slice(0, qi)).split('/').filter(Boolean),
    query = qi < 0 ? '' : raw.slice(qi + 1);
  if (path[0] && (path[0] === 'all' || CAT_IDS.includes(path[0]))) s.cat = path[0];
  if (path[1] && s.cat === path[0]) {
    const id = path[1].includes('.') ? path[1] : s.cat + '.' + path[1];
    if (ID.test(id)) s.id = id;
    else s.cat = DEFAULTS.cat;
  }
  for (const part of query.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    let k, v;
    try {
      k = decodeURIComponent(part.slice(0, eq));
      v = decodeURIComponent(part.slice(eq + 1));
    } catch (e) {
      continue;
    }
    if (k in CHOICES) {
      const val = asValue(k, v);
      if (val !== undefined) s[k] = val;
    } else if (k === 'q') s.q = v;
    else if (k === 'tags') s.tags = v.split(',').filter(Boolean);
    else if (k.startsWith('v.') && k.length > 2) s.pick[k.slice(2)] = v;
  }
  return s;
}

// ---- when an item shows up ----
const pad = n => String(n).padStart(2, '0');
// From the first day of December the event reaches `level` to its last day, read off the event calendar itself.
function eventWindow(key, level) {
  let from = null,
    to = null;
  for (let d = 1; d <= 31; d++) {
    const ev = EventLogic.active(new Date(2026, 11, d, 12), 'auto', null, 0);
    if (!ev || ev.key !== key) continue;
    if (ev.level >= level && !from) from = '12-' + pad(d);
    to = '12-' + pad(d);
  }
  return from ? { from, to } : null;
}
// '12-27' (month-day, as web/season-tree.js writes it) → '27/12'
const dayMonth = md => {
  const [m, d] = String(md).split('-');
  return d + '/' + m;
};
const span = w => dayMonth(w.from) + ' → ' + dayMonth(w.to);

export const AssetsLogic = {
  SCENE,
  CAT_IDS,
  CHOICES,
  DEFAULTS,
  MAX_CELLS,
  fold,
  filter,
  counts,
  variantCount,
  sceneOf,
  defaultPick,
  fixPick,
  combos,
  toHash,
  fromHash,
  eventWindow,
  dayMonth,
  span,
};
