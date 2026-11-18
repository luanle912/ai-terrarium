// The resolver (docs/specs/2026-11-18-asset-labels-design.md §5.3): a moment ({ season, holiday, event, key }) and
// the theme packs (themes/*.js) make one Look, the single answer to "what does everything look like right now".
// Pure, no drawing (tests/theme.test.mjs, tests/labels.test.mjs).
//
// Packs apply in order, a later one winning label by label: base (the season's column) -> winter (in winter) ->
// a small holiday (only while no event is on, D2) -> the event. An event pack that forces a season (Christmas: winter)
// resolves in that season. In an event pack, swap[label] === SAME keeps what the layers below give. decor and extras
// add up across packs; rules and text of a later pack override earlier ones.
//
// Look = { of(label), decor(label), has(rule), text(key), build(name), extras, key, keyOf(labels) }, frozen.
//   of(label)      the variant; throws on a label that does not exist, so a typo shows at once
//   decor(label)   the overlays, the same frozen array on every call
//   has(rule)      the rule's value (true or a weight), or false
//   text(key)      the i18n key to use in place of key (coffee -> cocoa), or key itself
//   build(name)    a count that grows with the event's day (gifts), 0 when no pack builds it
//   key            one string of every variant, overlay, extra, rule, text swap and count: equal keys, equal looks
//   keyOf(labels)  the same for a few labels only (a label in extras counts as present or not)
// One Look per moment.key: calling again with the same key returns the very same object.
import { Labels } from './labels.js';
import { BASE } from './themes/base.js';
import { WINTER } from './themes/winter.js';
import { HOLIDAYS } from './themes/holidays.js';
import { CHRISTMAS } from './themes/christmas.js';

const SAME = 'same';
const EMPTY = Object.freeze([]);
const KEEP = 32; // looks remembered per pack list; a moment's key changes a few times an hour

const PACKS = Object.freeze([BASE, WINTER, ...HOLIDAYS, CHRISTMAS].map(p => Object.freeze(p)));

const pick = (v, season) => (typeof v === 'string' ? v : v[season]);

// The count for the event's day from steps [[from day, count], ...] in rising order.
function count(steps, day) {
  let n = 0;
  for (const [from, c] of steps) if (day >= from) n = c;
  return n;
}

function layersFor(moment, packs) {
  const event = moment.event ? packs.find(p => p.kind === 'event' && p.key === moment.event.key) : null;
  const season = (event && event.season) || moment.season;
  const base = packs.find(p => p.kind === 'base');
  if (!base) throw new Error('Theme: no base pack');
  const layers = [base, ...packs.filter(p => p.kind === 'season' && p.season === season)];
  if (!event && moment.holiday) {
    const holiday = packs.find(p => p.kind === 'holiday' && p.key === moment.holiday);
    if (holiday) layers.push(holiday);
  }
  if (event) layers.push(event);
  return { layers, season, day: event ? moment.event.since || 0 : 0 };
}

function build(moment, packs) {
  const { layers, season, day } = layersFor(moment, packs);
  const variants = Object.create(null),
    decor = Object.create(null),
    extras = new Set(),
    rules = Object.create(null),
    text = Object.create(null),
    counts = Object.create(null);
  for (const { id } of Labels.LIST) {
    for (const p of layers) {
      const v = p.swap && p.swap[id];
      if (v !== undefined && v !== SAME) variants[id] = pick(v, season);
    }
    if (variants[id] === undefined) throw new Error(`Theme: no variant of ${id} in ${season}`);
    const overlays = [];
    for (const p of layers) for (const o of (p.decor && p.decor[id]) || []) if (!overlays.includes(o)) overlays.push(o);
    decor[id] = overlays.length ? Object.freeze(overlays) : EMPTY;
  }
  for (const p of layers) {
    for (const x of p.extras || []) extras.add(x);
    Object.assign(rules, p.rules);
    Object.assign(text, p.text);
    for (const name in p.build || {}) counts[name] = count(p.build[name], day);
  }
  const part = id =>
    id in variants ? `${id}=${variants[id]}+${decor[id].join(',')}` : `${id}:${extras.has(id) ? 1 : 0}`;
  const flat = o =>
    Object.keys(o)
      .sort()
      .map(k => `${k}=${o[k]}`)
      .join(',');
  const key = [
    Labels.LIST.map(l => part(l.id)).join('|'),
    [...extras].sort().join(','),
    flat(rules),
    flat(text),
    flat(counts),
  ].join('#');
  const partial = new WeakMap();
  return Object.freeze({
    of(label) {
      const v = variants[label];
      if (v === undefined) throw new Error(`Theme: unknown label ${label}`);
      return v;
    },
    decor(label) {
      const d = decor[label];
      if (d === undefined) throw new Error(`Theme: unknown label ${label}`);
      return d;
    },
    has: rule => (rule in rules ? rules[rule] : false),
    text: k => (k in text ? text[k] : k),
    build: name => counts[name] || 0,
    extras,
    key,
    keyOf(labels) {
      let k = partial.get(labels);
      if (k === undefined) partial.set(labels, (k = labels.map(part).join('|')));
      return k;
    },
  });
}

const memo = new WeakMap(); // pack list -> Map(moment.key -> Look)

function resolve(moment, packs = PACKS) {
  let looks = memo.get(packs);
  if (!looks) memo.set(packs, (looks = new Map()));
  let look = looks.get(moment.key);
  if (!look) {
    look = build(moment, packs);
    if (looks.size >= KEEP) looks.delete(looks.keys().next().value);
    looks.set(moment.key, look);
  }
  return look;
}

export const Theme = { PACKS, SAME, resolve };
