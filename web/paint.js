// The painters by label (docs/specs/2026-11-18-asset-labels-design.md §5.5): the function that draws a label's variant
// or lays one of its overlays, registered by the module that draws it when it is imported (as mixin does), so the
// drawing asks "what does the look put on a door?" and gets the painters, never a level or a date.
//   variant(label, variant, fn)  fn draws that look of the label
//   overlay(label, overlay, fn)  fn lays that overlay on one instance of the label
//   has(label, id)               a painter is registered for that variant or overlay
//   overlaysOf(label, look)      the painters of look.decor(label) in its order, each tagged .overlay; the same array
//                                for the same look and label, so a frame asks without making anything
//   draw(label, look, ...args)   the variant's painter (when one is registered), then every overlay's, with args
// Paint does not force one signature: a group's painters take what its drawing has (spec §5.5).
import { Labels } from './labels.js';

const VARIANTS = new Map(); // label -> Map(variant -> fn)
const OVERLAYS = new Map(); // label -> Map(overlay -> fn)
const EMPTY = Object.freeze([]);
let version = 0; // bumped by every registration, so a list worked out before it is worked out again
const lists = new Map(); // label -> WeakMap(the look's frozen decor array -> { version, list })

function put(table, kind, label, id, fn) {
  const l = Labels.byId(label);
  if (!l) throw new Error(`Paint: unknown label ${label}`);
  if (!l[kind + 's'].includes(id)) throw new Error(`Paint: ${id} is no ${kind} of ${label}`);
  if (typeof fn !== 'function') throw new Error(`Paint: ${label} ${id} needs a function`);
  if (!table.has(label)) table.set(label, new Map());
  if (kind === 'overlay') fn.overlay = id;
  table.get(label).set(id, fn);
  version++;
}

const variant = (label, id, fn) => put(VARIANTS, 'variant', label, id, fn);
const overlay = (label, id, fn) => put(OVERLAYS, 'overlay', label, id, fn);
const has = (label, id) => !!(VARIANTS.get(label)?.has(id) || OVERLAYS.get(label)?.has(id));

function overlaysOf(label, look) {
  const decor = look.decor(label);
  if (!decor.length) return EMPTY;
  let byDecor = lists.get(label);
  if (!byDecor) lists.set(label, (byDecor = new WeakMap()));
  let hit = byDecor.get(decor);
  if (!hit || hit.version !== version) {
    const own = OVERLAYS.get(label),
      list = [];
    for (const id of decor) if (own && own.has(id)) list.push(own.get(id));
    hit = { version, list: list.length ? Object.freeze(list) : EMPTY };
    byDecor.set(decor, hit);
  }
  return hit.list;
}

function draw(label, look, ...args) {
  const fn = VARIANTS.get(label)?.get(look.of(label));
  if (fn) fn(...args);
  for (const f of overlaysOf(label, look)) f(...args);
}

export const Paint = { variant, overlay, has, overlaysOf, draw };
