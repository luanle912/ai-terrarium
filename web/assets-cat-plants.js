// The /assets catalogue: plants. The island's trees in their five looks, the sixteen holiday trees of
// web/season-tree.js (only the event and lunar ones stand on the lawn in the game; the others are catalogue only), the
// big Christmas tree in the office, the little tree of the world view, the bushes and mushrooms, and the flowers on
// the lawn (a scene card cut from the baked island). Bushes and mushrooms pick their look by their tile (hash), so each
// look here stands on a tile that gives it.
import { tr } from './i18n.js';
import { AssetsStage } from './assets-stage.js';
import { AssetsScene } from './assets-scene.js';
import { drawSeasonTree, TREE_EXT } from './island-art-season.js';
import { bushSnowOnTop, drawBush, drawMushroom } from './island-art.js';
import { drawBigTree } from './island-art-xmas.js';
import { hash } from './island-land.js';
import { SeasonTree } from './season-tree.js';
import { EventLogic } from './event-logic.js';
import { tree as miniTree } from './world-ui.js';
import { treeDusk } from './office-draw.js';
import { treeNight } from './office-draw-xmas.js';

const { axis, dfB, xmasEvent } = AssetsStage;
// The first tile (x, y in 0..59) whose hashes give a look: ok(x, y) says whether it does.
export function findTile(ok) {
  for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) if (ok(x, y)) return { x, y };
  return { x: 0, y: 0 };
}
// The stage with the middle of tile (x, y) at (ox, oy): island painters draw a tile's thing there.
const TV = { ox: 0, oy: 0, env: null, pick: null };
export function onTile(ctx, view, x, y) {
  TV.ox = view.ox - (x - y) * 16;
  TV.oy = view.oy - (x + y + 1) * 8;
  TV.env = view.env;
  TV.pick = view.pick;
  return AssetsStage.stage(ctx, TV);
}
// The colours a still island piece is drawn in (its card stamps it from a sprite, which has none to read).
export const paletteOf = paint => view => {
  const r = AssetsStage.recordingCtx();
  paint(onTile(r, { ox: 0, oy: 0, env: view.env, pick: view.pick }, 0, 0), view);
  return r.palette(8);
};

// ---- the island trees (web/island-art-season.js), a sprite each as web/sky-island.js renderProps bakes them ----
// Their kind follows the season (SeasonLogic look.trees; a fir in winter during the Christmas event); three tiles
// give the three shapes a kind has (blossom clusters, branch side, a fir's height).
const TREE_KINDS = ['fresh', 'green', 'gold', 'bare', 'fir'];
const TREE_TILES = [0, 1, 2].map(i =>
  findTile(
    (x, y) =>
      Math.floor(hash(x, y, 190) * 3) === i &&
      hash(x, y, 180) > 0.5 === (i !== 1) &&
      hash(x, y, 160) > 0.5 === (i === 1),
  ),
);
const treeTile = pick => TREE_TILES[Math.max(0, ['a', 'b', 'c'].indexOf(pick.shape))];
const paintTree = s => drawSeasonTree(s.pt, s.PG, s.C, treeTile(s.view.pick), s.view.pick.kind || 'fresh');
const ISLAND_TREE = {
  id: 'plants.island-tree',
  cat: 'plants',
  name: () => tr('assets.item.plants.island-tree'),
  // its kind is the season's (the axis below), so the Seasonal filter finds it
  tags: ['season'],
  when: { always: true },
  where: 'lawn',
  source: [
    { file: 'web/island-art-season.js', fn: 'drawSeasonTree' },
    { file: 'web/island-art-snow.js', fn: 'snowOnTop' },
  ],
  axes: [
    // summer's green first, as the page opens on summer
    axis('kind', () => tr('assets.axis.kind'), [
      { id: 'green', label: () => tr('assets.tree.green') },
      { id: 'fresh', label: () => tr('assets.tree.fresh') },
      { id: 'gold', label: () => tr('assets.tree.gold') },
      { id: 'bare', label: () => tr('assets.tree.bare') },
      { id: 'fir', label: () => tr('assets.tree.fir') },
    ]),
    axis('shape', () => tr('assets.axis.shape'), [
      { id: 'a', label: () => tr('assets.shape.n', { n: 1 }) },
      { id: 'b', label: () => tr('assets.shape.n', { n: 2 }) },
      { id: 'c', label: () => tr('assets.shape.n', { n: 3 }) },
    ]),
  ],
  uses: ['light', 'snow'],
  palette: paletteOf(paintTree),
  draw(ctx, view) {
    const kind = TREE_KINDS.includes(view.pick.kind) ? view.pick.kind : 'fresh',
      d = treeTile(view.pick);
    // firs bring their own snow; the others take the lying snow on top
    AssetsScene.prop(ctx, view, 'tree|' + kind + d.x + ',' + d.y, d.x, d.y, TREE_EXT, paintTree, kind !== 'fir');
  },
};

// ---- the holiday trees (web/season-tree.js SEASONS), one entry each ----
// Drawn as the game draws one on the lawn: the office's drawEventTree on the stage's host, standing on a tile whose
// middle is at (ox, oy), at the lawn's night tint (treeDusk; after dark it goes through the host's scratch canvas). The
// method sets the canvas's transform itself, so it gets the canvas framed in the scene (Stage.framed).
const HOLIDAY_NAME = {
  newyear: () => tr('seasonTree.newyear.label'),
  tet: () => tr('seasonTree.tet.label'),
  valentine: () => tr('seasonTree.valentine.label'),
  womensday: () => tr('seasonTree.womensday.label'),
  spring: () => tr('seasonTree.spring.label'),
  reunification: () => tr('seasonTree.reunification.label'),
  children: () => tr('seasonTree.children.label'),
  summer: () => tr('seasonTree.summer.label'),
  nationalday: () => tr('seasonTree.nationalday.label'),
  midautumn: () => tr('seasonTree.midautumn.label'),
  autumn: () => tr('seasonTree.autumn.label'),
  vnwomen: () => tr('seasonTree.vnwomen.label'),
  halloween: () => tr('seasonTree.halloween.label'),
  teachers: () => tr('seasonTree.teachers.label'),
  christmas: () => tr('seasonTree.christmas.label'),
  default: () => tr('seasonTree.default.label'),
};
const ANY_TILE = { x: 0, y: 0 },
  TREE_NOW = { s: null, key: '', t: 0, dusk: 0 };
const tintedTree = c => TREE_NOW.s.host.drawEventTree(c, ANY_TILE, TREE_NOW.key, TREE_NOW.t, 1, TREE_NOW.dusk);
const eventTree = () => TREE_NOW.s.framed(tintedTree);
// Holidays whose tree art never moves with the clock.
const STILL_TREES = new Set(['teachers', 'default']);
const holidayTree = key => {
  const S = SeasonTree.SEASONS[key],
    // the game draws only event and lunar trees, and at Christmas the big tree instead (web/office-draw.js)
    live = (S.type === 'event' || S.type === 'lunar') && key !== 'christmas';
  return {
    id: 'plants.holiday-' + key,
    cat: 'plants',
    name: () => tr('assets.item.plants.holiday', { name: HOLIDAY_NAME[key]() }),
    tags: STILL_TREES.has(key) ? [] : ['animated'],
    when: S.type === 'none' ? { always: true } : { holiday: key },
    where: 'lawn',
    catalogueOnly: !live,
    source: [
      { file: 'web/season-tree.js', fn: 'drawSeasonTree' },
      { file: 'web/office-draw.js', fn: 'drawEventTree' },
    ],
    uses: ['light'],
    palette: () => S.colors.slice(),
    draw(ctx, view, t) {
      const s = (TREE_NOW.s = AssetsStage.stage(ctx, view, t));
      TREE_NOW.key = key;
      TREE_NOW.t = t;
      TREE_NOW.dusk = treeDusk(dfB(view));
      s.scene(ANY_TILE.x + 0.5, ANY_TILE.y + 0.5, 0, eventTree, true);
    },
  };
};
const HOLIDAY = SeasonTree.ORDER.map(holidayTree);

// ---- the big Christmas tree in the office (web/island-art-xmas.js, web/office-draw-xmas.js) ----
// Its presents come with the event's level; lit, the office draws its blinking bulbs, star and glow over it.
const TREE_AT = EventLogic.TREE_AT,
  FOOT = [0, 0],
  footAt = () => FOOT,
  PT = { ctx: null };
let treeDfB = 10,
  treeStage = null,
  treeEv = null;
const treeT = c => treeNight(c, treeDfB);
const litTree = () => treeStage.host.xmasTree(treeStage.G, treeEv);
const BIG_TREE = {
  id: 'plants.big-tree',
  cat: 'plants',
  name: () => tr('assets.item.plants.big-tree'),
  tags: ['animated'],
  when: { event: { key: 'christmas', level: 1 } },
  where: 'office',
  source: [
    { file: 'web/island-art-xmas.js', fn: 'drawBigTree' },
    { file: 'web/office-draw-xmas.js', fn: 'xmasTreeLights' },
  ],
  axes: [
    axis('level', () => tr('assets.axis.gifts'), [
      { id: '1', label: () => tr('assets.gifts.n', { n: EventLogic.GIFTS[1] }) },
      { id: '2', label: () => tr('assets.gifts.n', { n: EventLogic.GIFTS[2] }) },
      { id: '3', label: () => tr('assets.gifts.n', { n: EventLogic.GIFTS[3] }) },
    ]),
    axis('lights', () => tr('assets.axis.lights'), [
      { id: 'on', label: () => tr('assets.lights.on') },
      { id: 'off', label: () => tr('assets.lights.off') },
    ]),
  ],
  uses: ['light'],
  draw(ctx, view, t) {
    const level = Math.min(3, Math.max(1, +view.pick.level || 1));
    if (view.pick.lights === 'off') {
      treeDfB = dfB(view);
      PT.ctx = ctx;
      FOOT[0] = view.ox;
      FOOT[1] = view.oy;
      return drawBigTree(PT, footAt, treeT, FOOT, level);
    }
    treeStage = AssetsStage.stage(ctx, view, t);
    treeEv = xmasEvent(level);
    treeStage.scene(TREE_AT[0], TREE_AT[1], 0, litTree);
  },
};

// ---- the world view's little tree (web/world-ui.js) ----
const WORLD_TREE = {
  id: 'plants.world-tree',
  cat: 'plants',
  name: () => tr('assets.item.plants.world-tree'),
  tags: ['season'],
  when: { always: true },
  where: 'world',
  source: [{ file: 'web/world-ui.js', fn: 'tree' }],
  axes: [
    axis('kind', () => tr('assets.axis.kind'), [
      { id: 'green', label: () => tr('assets.tree.green') },
      { id: 'fresh', label: () => tr('assets.tree.fresh') },
      { id: 'gold', label: () => tr('assets.tree.gold') },
      { id: 'bare', label: () => tr('assets.tree.bare') },
      { id: 'fir', label: () => tr('assets.tree.fir') },
    ]),
  ],
  uses: ['light'],
  draw: (ctx, view) => miniTree(ctx, view.ox, view.oy, view.env.df, view.pick.kind || 'green'),
};

// ---- bushes and mushrooms (web/island-art.js) ----
const BUSH_LOOKS = ['big', 'small', 'big-berries', 'small-berries'];
const BUSH_TILES = BUSH_LOOKS.map(l =>
  findTile((x, y) => hash(x, y, 41) > 0.5 === l.startsWith('big') && hash(x, y, 43) > 0.6 === l.endsWith('berries')),
);
const bushTile = pick => BUSH_TILES[Math.max(0, BUSH_LOOKS.indexOf(pick.look))];
// the look's bush (web/theme.js): in fruit in spring every bush carries berries; holly during the Christmas event
// (holly lays its own snow cap: s carries the bake's S and depth)
const paintBush = s => drawBush(s.pt, s.PG, s.C, bushTile(s.view.pick), s.env.look.of('bush'), s);
const BUSH = {
  id: 'plants.bush',
  cat: 'plants',
  name: () => tr('assets.item.plants.bush'),
  when: { always: true },
  where: 'lawn',
  source: [
    { file: 'web/island-art.js', fn: 'drawBush' },
    { file: 'web/island-art-snow.js', fn: 'snowOnTop' },
  ],
  axes: [
    axis('look', () => tr('assets.axis.shape'), [
      { id: 'big', label: () => tr('assets.bush.big') },
      { id: 'small', label: () => tr('assets.bush.small') },
      { id: 'big-berries', label: () => tr('assets.bush.big-berries') },
      { id: 'small-berries', label: () => tr('assets.bush.small-berries') },
    ]),
  ],
  uses: ['light', 'season', 'snow', 'event'],
  palette: paletteOf(paintBush),
  draw(ctx, view) {
    const d = bushTile(view.pick);
    const snowy = bushSnowOnTop(view.env.look.of('bush'));
    AssetsScene.prop(ctx, view, 'bush|' + d.x + ',' + d.y, d.x, d.y, [11, 15, 11, 4], paintBush, snowy);
  },
};
// Mushrooms lie in the lawn's bake (no sprite, no snow on top).
const MUSHROOM_LOOKS = ['red-pair', 'red-one', 'brown-pair', 'brown-one'];
const MUSHROOM_TILES = MUSHROOM_LOOKS.map(l =>
  findTile((x, y) => hash(x, y, 45) > 0.4 === l.startsWith('red') && hash(x, y, 47) > 0.45 === l.endsWith('pair')),
);
const MUSHROOM = {
  id: 'plants.mushroom',
  cat: 'plants',
  name: () => tr('assets.item.plants.mushroom'),
  when: { always: true },
  where: 'lawn',
  source: [{ file: 'web/island-art.js', fn: 'drawMushroom' }],
  axes: [
    axis('look', () => tr('assets.axis.shape'), [
      { id: 'red-pair', label: () => tr('assets.mushroom.red-pair') },
      { id: 'red-one', label: () => tr('assets.mushroom.red-one') },
      { id: 'brown-pair', label: () => tr('assets.mushroom.brown-pair') },
      { id: 'brown-one', label: () => tr('assets.mushroom.brown-one') },
    ]),
  ],
  uses: ['light', 'snow'],
  draw(ctx, view) {
    const d = MUSHROOM_TILES[Math.max(0, MUSHROOM_LOOKS.indexOf(view.pick.look))],
      s = onTile(ctx, view, d.x, d.y);
    drawMushroom(s.pt, s.PG, s.C, d);
  },
};

// ---- the flowers on the lawn: a scene card ----
// A patch of the back lawn where flowers grow (fewer in a season with look.flowers below 1, more in spring, none
// under the snow), cut from the baked island.
const FLOWER_BED = AssetsScene.region(848, 212, 96, 60);
const FLOWERS = {
  id: 'plants.flowers',
  cat: 'plants',
  name: () => tr('assets.item.plants.flowers'),
  tags: ['animated'],
  when: { always: true },
  where: 'lawn',
  source: [
    { file: 'web/sky-island.js', fn: 'renderIsland' },
    { file: 'web/island-art-season.js', fn: 'drawSeasonFlowers' },
  ],
  uses: ['light', 'season', 'snow', 'event'],
  frame: AssetsScene.frameOf(FLOWER_BED),
  draw: (ctx, view, t) => AssetsScene.islandScene(ctx, view, t, FLOWER_BED),
};

export const PLANTS = [ISLAND_TREE, ...HOLIDAY, BIG_TREE, WORLD_TREE, BUSH, MUSHROOM, FLOWERS];
