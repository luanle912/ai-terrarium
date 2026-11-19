// The base pack: how every label looks on an ordinary day, per season (docs/specs/2026-11-18-asset-labels-design.md
// §5.2). This is the one place that says what "normal" is; every other pack only says what it changes. A value is
// a variant, or { spring, summer, autumn, winter } for a label that follows the season.
//   tree.island/far/world  the season's trees (SeasonLogic.LOOKS[*].trees): fresh, green, gold, bare
//   bush                   fruit in spring (LOOKS.spring.fruit), plain otherwise
//   tree.holiday           none: a small holiday pack swaps in its own tree

const TREES = { spring: 'fresh', summer: 'green', autumn: 'gold', winter: 'bare' };

export const BASE = {
  key: 'base',
  kind: 'base',
  swap: {
    'tree.island': TREES,
    'tree.holiday': 'none',
    'tree.far': TREES,
    'tree.world': TREES,
    'bush': { spring: 'fruit', summer: 'plain', autumn: 'plain', winter: 'plain' },
    'flower': 'plain',
    'mushroom': 'plain',
    'rock': 'plain',
    'bench': 'plain',
    'lamp': 'plain',
    'floor.office': 'plain',
    'floor.corridor': 'plain',
    'floor.zone': 'plain',
    'floor.pantry': 'checker',
    'floor.wc': 'checker',
    'wall.outer': 'plain',
    'wall.inner': 'plain',
    'window': 'plain',
    'door': 'plain',
    'desk': 'plain',
    'chair': 'plain',
    'monitor': 'plain',
    'board.usage': 'plain',
    'shelf': 'plain',
    'plant.pot': 'plain',
    'clock': 'plain',
    'pantry.item': 'plain',
    'pergola': 'plain',
    'kennel': 'plain',
    'pavilion': 'plain',
    'stairs': 'plain',
    'plinth': 'plain',
    'outfit.agent': 'team',
    'outfit.subagent': 'team',
    'dog.costume': 'none',
  },
  decor: {},
  extras: [],
  rules: {},
  text: {},
  build: {},
};
