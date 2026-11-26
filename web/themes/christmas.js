// The Christmas event pack (docs/specs/2026-11-18-asset-labels-design.md §6, D1): everything changes on the first day
// of the event; only the number of gifts under the tree grows with the days. Every label is named in swap, a variant
// or 'same' (keep what the season shows), so a label nobody thought about cannot slip through unnoticed.
//   season/weather  the event forces winter and its snow (a floor of snow cover, rain falls as snow)
//   extras          the things that stand while the event is on: drawn and baked from look.extras.has, and the big
//                   tree's and the cathedral's cells blocked from the same list (LookChange.BLOCKERS). One source:
//                   nothing here is also a rule.
//   rules           what the event switches on for the living scene (look.has): the critters, the idle acts, the ways
//                   to leave the island; true, or a weight for a way to leave
//   build           counts that grow with the event's day: [[from day, count], ...]

const SAME = 'same';

export const CHRISTMAS = {
  key: 'christmas',
  kind: 'event',
  season: 'winter',
  weather: { snowFloor: 0.45, rainToSnow: true },
  swap: {
    'tree.island': 'fir',
    'tree.holiday': 'xmas',
    'tree.far': 'fir',
    'tree.world': 'fir',
    'bush': 'holly',
    'flower': SAME,
    'mushroom': SAME,
    'rock': SAME,
    'bench': SAME,
    'lamp': SAME,
    'floor.office': SAME,
    'floor.corridor': 'runner',
    'floor.zone': SAME,
    'floor.pantry': 'checker-red',
    'floor.wc': SAME,
    'wall.outer': SAME,
    'wall.inner': SAME,
    'window': SAME,
    'door': SAME,
    'desk': SAME,
    'chair': SAME,
    'monitor': SAME,
    'board.usage': SAME,
    'shelf': SAME,
    'plant.pot': SAME,
    'clock': SAME,
    'pantry.item': SAME,
    'pergola': SAME,
    'kennel': SAME,
    'pavilion': SAME,
    'stairs': SAME,
    'plinth': SAME,
    'outfit.agent': 'xmas',
    'outfit.subagent': 'elf',
    'dog.costume': 'xmas',
  },
  decor: {
    'tree.far': ['lights'],
    'wall.outer': ['garland', 'lights'],
    'window': ['frost', 'star'],
    'door': ['wreath'],
    'desk': ['xmas-desk'],
    'shelf': ['garland-small'],
    'plant.pot': ['bauble'],
    'clock': ['holly-sprig'],
    'pergola': ['lights'],
    'kennel': ['lights'],
    'pavilion': ['lights'],
  },
  extras: ['tree.big', 'cane', 'cathedral', 'ourlady'],
  rules: {
    'critter.reindeer': true,
    'critter.elf': true,
    'critter.penguin': true,
    'critter.santa': true,
    'sleigh': true,
    'idle.snowball': true,
    'idle.snowman': true,
    'idle.skate': true,
    'idle.gift': true,
    'fate.sleigh': 4,
    'fate.wrapped': 4,
    'fate.skateoff': 5,
    'fate.chimney': 3,
  },
  text: { 'office.act.coffee': 'office.act.cocoa' },
  build: {
    gifts: [
      [0, 2],
      [7, 5],
      [14, 9],
    ],
  },
};
