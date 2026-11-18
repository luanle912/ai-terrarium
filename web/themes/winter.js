// The winter pack: what winter has even without an event (docs/specs/2026-11-18-asset-labels-design.md §5.2, §6).
// The bare trees come from the base pack's season column; this adds the things only winter brings: the igloo and the
// polar bears (web/office-draw-bears.js), the snowmen on the lawn (web/sky-island.js renderProps). Icicles and breath
// in the cold follow the snow on the ground, not the season, so no pack lists them.

export const WINTER = {
  key: 'winter',
  kind: 'season',
  season: 'winter',
  swap: {},
  decor: {},
  extras: ['igloo', 'bear', 'snowman.lawn'],
  rules: {},
  text: {},
  build: {},
};
