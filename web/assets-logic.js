// The /assets page as logic (no DOM, no canvas; tests/assets-logic.test.mjs): the global controls and their defaults,
// filtering and search, how many variants an item has, the cells of the "all variants" grid, which controls reach an
// item, the deep link in the URL hash, the dates an item shows up on and the rows and columns of the conversion table.
import { EventLogic } from './event-logic.js';
import { Theme } from './theme.js';

// The scene controls (they change what the game draws) and the view controls (how the page shows it).
const SCENE = ['light', 'season', 'snow', 'event'];
// The categories of the catalogue, in the order of the page's rail (web/assets-registry.js gives them names).
const CAT_IDS = ['plants', 'outdoor', 'island', 'animals', 'people', 'office', 'pantry', 'rooms', 'event', 'world'];
// The theme packs (web/theme.js) the Event control picks from: none (the base pack alone, in the season chosen), the
// season packs (winter: the season it is for), the events (Christmas, which brings winter too), then the small
// holidays (each its own holiday tree, in the season chosen). season: the season a pack brings, whatever is chosen.
const KIND_ORDER = ['base', 'season', 'event', 'holiday'];
const PACKS = Object.freeze(
  [...Theme.PACKS]
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    .map(p =>
      Object.freeze({
        id: p.kind === 'base' ? 'none' : p.key,
        kind: p.kind,
        season: p.kind === 'season' || p.kind === 'event' ? p.season || null : null,
      }),
    ),
);
const PACK = new Map(PACKS.map(p => [p.id, p]));
const forcedSeason = id => (PACK.has(id) && PACK.get(id).season) || null;
// The packs that change more than the holiday tree: what the variants grid and the scene tests go through (each small
// holiday's tree has an entry of its own).
const BIG_PACKS = Object.freeze(PACKS.filter(p => p.kind !== 'holiday').map(p => p.id));
const HOLIDAYS = PACKS.filter(p => p.kind === 'holiday').map(p => p.id);
const CHOICES = {
  light: ['day', 'dusk', 'night'],
  season: ['spring', 'summer', 'autumn', 'winter'],
  snow: [false, true],
  event: PACKS.map(p => p.id),
  zoom: [2, 3, 4],
  motion: [true, false],
  // the grid of cards, or the conversion table (a row per label, a column per pack)
  view: ['grid', 'table'],
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
  event: 'none',
  zoom: 3,
  motion: true,
  view: 'grid',
  pick: {},
});
// The values a cell of the variants grid takes per scene control (dusk is a blend of the two, so it is left out),
// and the order the controls are dropped in when the grid would have more than MAX_CELLS cells.
const CELL_VALUES = { light: ['day', 'night'], season: CHOICES.season, snow: CHOICES.snow, event: BIG_PACKS };
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

// The scene an item is drawn in: the controls it uses as chosen, the rest at their defaults, so a card that ignores
// a control never changes with it.
function sceneOf(e, controls) {
  const out = {};
  for (const u of SCENE) out[u] = e.uses.includes(u) ? controls[u] : DEFAULTS[u];
  return out;
}
// The scene a cell really shows, for an item that reacts to the season: a pack that brings a season (winter,
// Christmas) shows it whatever the season chosen, and the winter pack is winter's own column (the base pack in winter
// has it), so it is winter with no pack.
function shown(e, controls) {
  const sc = sceneOf(e, controls);
  if (!e.uses.includes('season')) return sc;
  const forced = forcedSeason(sc.event);
  if (forced) sc.season = forced;
  if (PACK.has(sc.event) && PACK.get(sc.event).kind === 'season') sc.event = 'none';
  return sc;
}
// The controls of `cells` crossed with every grid value of each control in `list`, a cell that shows the same scene
// as one before it left out (shown as that scene's controls).
function cross(e, cells, list) {
  for (const u of list) {
    const next = [];
    for (const c of cells) for (const v of CELL_VALUES[u]) next.push({ ...c, [u]: v });
    cells = next;
  }
  const seen = new Set(),
    out = [];
  for (const c of cells) {
    const sc = shown(e, c),
      key = SCENE.map(u => sc[u]).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e.uses.includes('season') ? { ...c, season: sc.season, event: sc.event } : c);
  }
  return out;
}

// The item's own axes times the scenes of the controls it reacts to (day and night count as two, dusk being a blend;
// of the packs none, winter and Christmas, a scene shown twice counted once). An entry with `sweep` (too many axes to
// cross, like a person) counts each value of each of its axes once.
function variantCount(e) {
  let n = 1;
  if (e.sweep) for (const a of e.axes) n += a.values.length - 1;
  else for (const a of e.axes) n *= a.values.length;
  const used = SCENE.filter(u => e.uses.includes(u));
  return n * cross(e, [DEFAULTS], used).length;
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
// at most MAX_CELLS. Scene controls are fixed at their current value one by one (the pack first) until it fits;
// past that the item's own combinations are cut at MAX_CELLS. An entry with `sweep: [axisId…]` does not cross its
// axes: its cells are the first value of every axis, then each other value of each swept axis on its own.
function sweepPicks(e) {
  const base = defaultPick(e),
    out = [base];
  for (const a of e.axes)
    if (e.sweep.includes(a.id)) for (const v of a.values.slice(1)) out.push({ ...base, [a.id]: v.id });
  return out;
}
function combos(e, controls) {
  const used = SCENE.filter(u => e.uses.includes(u));
  const picks = e.sweep ? sweepPicks(e) : null;
  let axesN = 1;
  if (picks) axesN = picks.length;
  else for (const a of e.axes) axesN *= a.values.length;
  for (const u of DROP)
    if (axesN * cross(e, [controls], used).length > MAX_CELLS && used.includes(u)) used.splice(used.indexOf(u), 1);
  const scenes = cross(e, [controls], used);
  let cells = picks ? picks.map(pick => ({ pick })) : [{ pick: {} }];
  if (!picks)
    for (const a of e.axes) {
      const next = [];
      for (const c of cells)
        for (const v of a.values) {
          if (next.length >= MAX_CELLS * 4) break;
          next.push({ pick: { ...c.pick, [a.id]: v.id } });
        }
      cells = next;
    }
  const out = [];
  for (const c of cells)
    for (const sc of scenes) {
      if (out.length >= MAX_CELLS) return out;
      out.push({ pick: c.pick, controls: sc });
    }
  return out;
}

// ---- the deep link: #/<cat>/<name>?light=night&season=winter&v.use=use… (only what differs from the defaults) ----
// The path is the category shown and the open item: #/<cat>/<name> when the item is of that category, else
// #/<cat>/<full id> (an item opened from "Everything", or from a search), so a reload shows the same screen.
// base: what the page would show anyway, left out of the link: pick, the open item's first variant (defaultPick);
// motion, motion as the page starts without a choice (off under prefers-reduced-motion).
const ID = /^[a-z]+\.[a-z0-9-]+$/;
const enc = encodeURIComponent;
function toHash(s, base = {}) {
  const id = s.id && ID.test(s.id) ? s.id : null,
    own = id ? id.split('.')[0] : '',
    cat = s.cat && s.cat !== 'all' ? s.cat : '';
  let path = '#/' + cat;
  if (id) path = own === s.cat ? '#/' + own + '/' + id.slice(own.length + 1) : '#/' + (cat || 'all') + '/' + id;
  const q = [],
    motion = base.motion === undefined ? DEFAULTS.motion : base.motion;
  for (const k of ['light', 'season', 'snow', 'event', 'zoom', 'motion', 'view'])
    if (s[k] !== (k === 'motion' ? motion : DEFAULTS[k]))
      q.push(k + '=' + (typeof s[k] === 'boolean' ? (s[k] ? 1 : 0) : s[k]));
  if (s.q) q.push('q=' + enc(s.q));
  if (s.tags && s.tags.length) q.push('tags=' + s.tags.map(enc).join(','));
  if (id)
    for (const [k, v] of Object.entries(s.pick || {}))
      if (!base.pick || base.pick[k] !== v) q.push('v.' + enc(k) + '=' + enc(v));
  return path + (q.length ? '?' + q.join('&') : '');
}
const asValue = (k, raw) => {
  const v = k === 'snow' || k === 'motion' ? (raw === '1' ? true : raw === '0' ? false : null) : raw;
  const n = k === 'zoom' ? Number(v) : v;
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
// The days of December the event `key` is on, read off the event calendar itself (it is whole from its first day, D1).
function eventWindow(key) {
  let from = null,
    to = null;
  for (let d = 1; d <= 31; d++) {
    const ev = EventLogic.active(new Date(2026, 11, d, 12), 'auto', null, 0);
    if (!ev || ev.key !== key) continue;
    if (!from) from = '12-' + pad(d);
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

// ---- the conversion table: a row per label (web/labels.js), a column per pack ----
// The labels an entry draws: `label`, or `labels` for an entry that shows several.
const labelsOf = e => (e.labels ? e.labels : e.label ? [e.label] : []);
// The columns: no pack (the season chosen), winter, Christmas, and the small holidays as one column, the one picked on
// the Event control or else the first (they differ only in the holiday tree). One list per holiday shown.
const COLS = new Map();
function tableCols(choice) {
  const holiday = HOLIDAYS.includes(choice) ? choice : HOLIDAYS[0];
  let cols = COLS.get(holiday);
  if (!cols)
    COLS.set(
      holiday,
      (cols = Object.freeze([...BIG_PACKS.map(id => ({ id, pack: id })), { id: 'holiday', pack: holiday }])),
    );
  return cols;
}
// The rows, in the order of `labels` ([{id, group}], Labels.LIST): each with the entries that carry its label.
const tableRows = (entries, labels) =>
  labels.map(l => ({ id: l.id, group: l.group, entries: entries.filter(e => labelsOf(e).includes(l.id)) }));
// What a cell of `row` shows under `look` (web/theme.js): the entry that draws the label's variant there and its pick.
// An entry with a `variant` draws that one variant only (a holiday's tree); the others draw what the look gives, and
// of those one that follows the pack (it reacts to the Event control, or sets its axes from the look by `pickFor`)
// comes first. null when the look's variant is one no entry draws (no holiday tree).
function tableCell(row, look) {
  const v = look.of(row.id);
  let entry = row.entries.find(e => e.variant === v) || null;
  if (!entry) {
    const open = row.entries.filter(e => e.variant === undefined);
    entry = open.find(e => e.pickFor || e.uses.includes('event')) || open[0] || null;
  }
  if (!entry) return null;
  return { entry, pick: fixPick(entry, entry.pickFor ? entry.pickFor(look) : null) };
}

export const AssetsLogic = {
  SCENE,
  CAT_IDS,
  PACKS,
  BIG_PACKS,
  forcedSeason,
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
  labelsOf,
  tableCols,
  tableRows,
  tableCell,
};
