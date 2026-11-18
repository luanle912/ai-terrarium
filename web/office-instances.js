// Where the things of each label stand: the walls, doors, windows, pots, the clock and shelf, the desks, the kennels
// and the island's trees, in one place (docs/specs/2026-11-18-asset-labels-design.md §5.4). The drawing and the
// theme packs' overlays read these lists, so "a wreath on every door" needs no second copy of a door's place.
// Cells are scene cells (x right-down, y left-down), z in px up from the floor; the same numbers the drawing used.
import { Labels } from './labels.js';
import { SeasonIsland } from './season-island.js';
import { DESKS, DOG_HOUSES, H, ISLAND, W, WALL, WC } from './office-scene.js';

// A wall is a run a -> b on the floor plan, z0..z1 up, and the side that faces the camera ('back' the one along x,
// 'left' along y, 'front' the one at the foot of the restroom block, 'east' its far end).
const wall = (id, kind, a, b, z1, face, z0 = 0) => ({ id, kind, a, b, z0, z1, face });
const { walls: WW, heights: WH } = WC;
export const WALLS = [
  wall('office.back', 'outer', [0, 0], [W, 0], WALL + 3, 'back'),
  wall('office.left', 'outer', [0, 0], [0, H], WALL + 3, 'left'),
  wall('wc.back', 'outer', [WC.x0, WC.y0], [WC.x1, WC.y0], WALL + 3, 'back'),
  wall('wc.front', 'outer', [WC.x0, WW.front.y], [WC.x1, WW.front.y], WH.outer + 3, 'front'),
  wall('wc.east', 'outer', [WW.east.x, WW.east.y0], [WW.east.x, WW.east.y1], WH.outer + 3, 'east'),
  wall('wc.pantry', 'inner', [WW.pantry.x, WC.y0], [WW.pantry.x, WC.front], WH.room, 'left'),
  wall('wc.split', 'inner', [WW.split.x, WC.y0], [WW.split.x, WC.front], WH.room, 'left'),
];

// The EXIT door: the kit stands on `kit` (the cell), the door's leaf and sign are drawn off it by F.door
// (web/decor-wall.js), and `at` is the point on the leaf where the wreath hangs.
export const EXIT = { kit: [0, 5.5] };
export const DOORS = [
  { id: 'door.exit', kind: 'exit', at: [0, 7.05, 24] },
  ...WC.doors.map(d => ({ id: 'door.wc.' + d.room, kind: 'wc', at: [(d.x0 + d.x1) / 2, d.y, 0] })),
  ...DOG_HOUSES.map((h, i) => ({ id: 'door.kennel.' + i, kind: 'kennel', at: [h.x, h.y, 0] })),
];

export const WINDOWS = [1.6, 4.8, 11.6, 14.8].map((x, i) => ({ id: 'window.' + i, x }));
export const POTS = [
  [8.5, 13.5],
  [19.5, 13.5],
  [19.5, 0.5],
].map(([x, y], i) => ({ id: 'pot.' + i, x, y }));
// The wall decor's clock and the bookshelf are kit pieces (web/decor-wall.js, decor-furniture.js): `at` and `size`
// are off the kit's cell on the back wall, where the player lays them out.
export const CLOCK = [{ id: 'clock.back', at: [2.0, 0, 46], size: [15, 15], face: 'back' }];
export const SHELF = [{ id: 'shelf.back', at: [0, 0, 0], size: [1.2, 0.42, 46], face: 'back' }];
export const KENNELS = DOG_HOUSES;

let ISLAND_TREES = null;
const islandTrees = () => (ISLAND_TREES ??= ISLAND.decor.filter(d => d.kind === 'tree'));
const holidayTrees = () => {
  const keys = SeasonIsland.holidayTrees(ISLAND, W, H);
  return islandTrees().filter(d => keys.has(d.x + ',' + d.y));
};

const LISTS = {
  'wall.outer': () => WALLS.filter(w => w.kind === 'outer'),
  'wall.inner': () => WALLS.filter(w => w.kind === 'inner'),
  door: () => DOORS,
  window: () => WINDOWS,
  desk: () => DESKS,
  'plant.pot': () => POTS,
  clock: () => CLOCK,
  shelf: () => SHELF,
  kennel: () => KENNELS,
  'tree.island': islandTrees,
  'tree.holiday': holidayTrees,
};
for (const [id, list] of Object.entries(LISTS)) Labels.setInstances(id, list);
