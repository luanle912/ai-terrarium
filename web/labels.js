// The asset labels (docs/specs/2026-11-18-asset-labels-design.md §5.4, §6): every thing on the island that a theme
// pack may swap for another variant or dress with overlays. A label names the kind of thing, not one copy of it, so
// "every door has a wreath" follows from one entry in a pack. Pure data, no drawing (tests/labels.test.mjs).
//   variants  every look the label can take, across all packs (base ones per season, then the events' own)
//   overlays  everything a pack may lay on top of it (decor), drawn after the variant
//   instances()  the places the label's copies stand (walls, doors, desks...), set by web/office-instances.js so this
//                file stays free of the scene; [] for a label whose copies are not listed there
import { SeasonTree } from './season-tree.js';

const SEASONAL = ['fresh', 'green', 'gold', 'bare'];
const LISTS = new Map();
const L = (id, group, variants, overlays = []) => ({
  id,
  group,
  variants,
  overlays,
  instances: () => (LISTS.has(id) ? LISTS.get(id)() : []),
});

// The small holidays of the season tree each have their own holiday tree (themes/holidays.js); Christmas is 'xmas'.
const HOLIDAY_TREES = Object.keys(SeasonTree.SEASONS).filter(
  k => k !== 'christmas' && ['event', 'lunar'].includes(SeasonTree.SEASONS[k].type),
);

const LIST = [
  L('tree.island', 'outdoor', [...SEASONAL, 'fir']),
  L('tree.holiday', 'outdoor', ['none', ...HOLIDAY_TREES, 'xmas']),
  L('tree.far', 'outdoor', [...SEASONAL, 'fir'], ['lights']),
  L('tree.world', 'outdoor', [...SEASONAL, 'fir']),
  L('bush', 'outdoor', ['plain', 'fruit', 'holly']),
  L('flower', 'outdoor', ['plain']),
  L('mushroom', 'outdoor', ['plain']),
  L('rock', 'outdoor', ['plain']),
  L('bench', 'outdoor', ['plain']),
  L('lamp', 'outdoor', ['plain']),
  L('floor.office', 'office', ['plain']),
  L('floor.corridor', 'office', ['plain', 'runner']),
  L('floor.zone', 'office', ['plain']),
  L('floor.pantry', 'office', ['checker', 'checker-red']),
  L('floor.wc', 'office', ['checker']),
  L('wall.outer', 'office', ['plain'], ['garland', 'lights']),
  L('wall.inner', 'office', ['plain']),
  L('window', 'office', ['plain'], ['frost', 'star']),
  L('door', 'office', ['plain'], ['wreath']),
  L('desk', 'office', ['plain'], ['xmas-desk']),
  L('chair', 'office', ['plain']),
  L('monitor', 'office', ['plain']),
  L('board.usage', 'office', ['plain']),
  L('shelf', 'office', ['plain'], ['garland-small']),
  L('plant.pot', 'office', ['plain'], ['bauble']),
  L('clock', 'office', ['plain'], ['holly-sprig']),
  L('pantry.item', 'pantry', ['plain']),
  L('pergola', 'outdoor', ['plain'], ['lights']),
  L('kennel', 'outdoor', ['plain'], ['lights']),
  L('pavilion', 'outdoor', ['plain'], ['lights']),
  L('stairs', 'outdoor', ['plain']),
  L('plinth', 'outdoor', ['plain']),
  L('outfit.agent', 'people', ['team', 'xmas']),
  L('outfit.subagent', 'people', ['team', 'elf']),
  L('dog.costume', 'animals', ['none', 'xmas']),
];

const BY_ID = new Map(LIST.map(l => [l.id, l]));
const byId = id => BY_ID.get(id) || null;

for (const l of LIST) Object.freeze(l.variants), Object.freeze(l.overlays), Object.freeze(l);
Object.freeze(LIST);

const setInstances = (id, list) => {
  if (!BY_ID.has(id)) throw new Error('unknown label ' + id);
  LISTS.set(id, list);
};

// The ids of the outdoor labels: what the island's bake and its far and world copies show (the bake's cache key is
// look.keyOf of these).
export const OUTDOOR_LABELS = Object.freeze(LIST.filter(l => l.group === 'outdoor').map(l => l.id));

export const Labels = { LIST, byId, SEASONAL, setInstances };
