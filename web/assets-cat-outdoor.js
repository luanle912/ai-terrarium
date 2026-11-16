// The /assets catalogue: outdoor props. What stands on the island's lawn, each drawn as web/sky-island.js bakes it
// (a sprite, lying snow settled on top): the rocks, the lamp posts with their light after dark, the candy canes of the
// Christmas event, the stone bench, the one-pillar pavilion in the lake with its lantern, and the three snowmen of
// winter. The lotus, the duckweed and the stepping stones only exist in the lake's bake and life, so they are scene
// cards cut from the baked island (summer by default; in winter the lake freezes and they go, as in the game).
import { tr } from './i18n.js';
import { AssetsScene, AssetsStage } from './assets-stage.js';
import { drawBench, drawLamp, drawRock, night } from './island-art.js';
import { CANE_EXT, drawCandyCane } from './island-art-xmas.js';
import { drawPavilion, PAVILION_EXT } from './island-art-lake.js';
import { drawSnowman, SNOWMAN_EXT } from './island-art-season.js';
import { SeasonIsland } from './season-island.js';
import { IslandLife } from './island-life.js';
import { hash } from './island-land.js';
import { ISLAND, H, PG, W } from './office-scene.js';
import { findTile, onTile, paletteOf } from './assets-cat-plants.js';

const axis = (id, label, values) => ({ id, label, values });
// Runs a light of web/island-life.js (drawn in scene px) with the scene's point (x, y, z) at (ox, oy).
function inScene(ctx, view, x, y, z) {
  const [sx, sy] = PG(x, y, z);
  ctx.save();
  ctx.translate(view.ox - sx, view.oy - sy);
}

// ---- rocks (web/island-art.js), in the lawn's bake ----
const ROCKS = ['small', 'big'].map(l => findTile((x, y) => hash(x, y, 49) > 0.5 === (l === 'big')));
const ROCK = {
  id: 'outdoor.rock',
  cat: 'outdoor',
  name: () => tr('assets.item.outdoor.rock'),
  when: { always: true },
  where: 'lawn',
  source: [{ file: 'web/island-art.js', fn: 'drawRock' }],
  axes: [
    axis('size', () => tr('assets.axis.shape'), [
      { id: 'small', label: () => tr('assets.rock.small') },
      { id: 'big', label: () => tr('assets.rock.big') },
    ]),
  ],
  uses: ['light', 'snow'],
  draw(ctx, view) {
    const d = ROCKS[view.pick.size === 'big' ? 1 : 0],
      s = onTile(ctx, view, d.x, d.y);
    drawRock(s.pt, s.PG, s.C, d);
  },
};

// ---- the lamp posts, their candy canes and the bench of the rest corner ----
const LAMP0 = ISLAND.lamps[0],
  BENCH_AT = ISLAND.rest.bench;
const paintLamp = s => drawLamp(s.pt, s.PG, s.C, ISLAND, LAMP0);
const LAMP = {
  id: 'outdoor.lamp',
  cat: 'outdoor',
  name: () => tr('assets.item.outdoor.lamp'),
  tags: ['animated'],
  when: { always: true },
  where: 'lawn',
  source: [
    { file: 'web/island-art.js', fn: 'drawLamp' },
    { file: 'web/island-life.js', fn: 'drawLampLight' },
  ],
  uses: ['light', 'snow'],
  palette: paletteOf(paintLamp),
  draw(ctx, view, t) {
    AssetsScene.prop(ctx, view, 'lamp', LAMP0.x, LAMP0.y, [9, 25, 8, 3], paintLamp);
    // its glass glows after dark, right after the post as in the scene
    inScene(ctx, view, LAMP0.x + 0.5, LAMP0.y + 0.5, 0);
    IslandLife.drawLampLight(ctx, ISLAND, PG, 0, t, view.env);
    ctx.restore();
  },
};
// The event's pieces keep more of their colour after dark than the lawn (web/sky-island.js renderProps).
let caneDf = 1;
const caneT = c => night(c, 1 - (1 - caneDf) * 0.55);
const paintCane = s => {
  caneDf = s.env.df;
  drawCandyCane(s.pt, s.PG, caneT, LAMP0);
};
const CANE = {
  id: 'outdoor.candy-cane',
  cat: 'outdoor',
  name: () => tr('assets.item.outdoor.candy-cane'),
  when: { event: { key: 'christmas', level: 2 } },
  where: 'lawn',
  source: [{ file: 'web/island-art-xmas.js', fn: 'drawCandyCane' }],
  uses: ['light', 'snow'],
  palette: paletteOf(paintCane),
  draw: (ctx, view) => AssetsScene.prop(ctx, view, 'cane', LAMP0.x, LAMP0.y, CANE_EXT, paintCane),
};
const paintBench = s => drawBench(s.pt, s.PG, s.C, BENCH_AT);
const BENCH = {
  id: 'outdoor.bench',
  cat: 'outdoor',
  name: () => tr('assets.item.outdoor.bench'),
  when: { always: true },
  where: 'lake',
  source: [{ file: 'web/island-art.js', fn: 'drawBench' }],
  uses: ['light', 'snow'],
  palette: paletteOf(paintBench),
  draw: (ctx, view) => AssetsScene.prop(ctx, view, 'bench', BENCH_AT.x, BENCH_AT.y, [13, 15, 13, 8], paintBench),
};

// ---- the pavilion in the lake (web/island-art-lake.js) and its lantern (web/island-life.js) ----
const PILLAR = ISLAND.pavilion.pillar;
const paintPavilion = s => drawPavilion(s.pt, s.PG, s.C, ISLAND);
const PAVILION = {
  id: 'outdoor.pavilion',
  cat: 'outdoor',
  name: () => tr('assets.item.outdoor.pavilion'),
  tags: ['animated'],
  when: { always: true },
  where: 'lake',
  source: [
    { file: 'web/island-art-lake.js', fn: 'drawPavilion' },
    { file: 'web/island-life.js', fn: 'drawLanternLight' },
  ],
  uses: ['light', 'snow'],
  palette: paletteOf(paintPavilion),
  draw(ctx, view, t) {
    AssetsScene.prop(ctx, view, 'pavilion', PILLAR.x, PILLAR.y, PAVILION_EXT, paintPavilion);
    inScene(ctx, view, PILLAR.x + 0.5, PILLAR.y + 0.5, 0);
    IslandLife.drawLanternLight(ctx, ISLAND, PG, t, view.env);
    ctx.restore();
  },
};

// ---- the snowmen of winter (web/island-art-season.js), on the tiles the game gives them ----
const SNOWMEN = [0, 1, 2].map(
  look => SeasonIsland.snowmanTiles(ISLAND, W, H).find(m => m.look % 3 === look) || { x: 0, y: 0, look },
);
const snowmanOf = pick => SNOWMEN[Math.max(0, ['tall', 'stout', 'small'].indexOf(pick.look))];
const paintSnowman = s => drawSnowman(s.pt, s.PG, s.C, snowmanOf(s.view.pick));
const SNOWMAN = {
  id: 'outdoor.snowman',
  cat: 'outdoor',
  name: () => tr('assets.item.outdoor.snowman'),
  when: { seasons: ['winter'] },
  where: 'lawn',
  source: [{ file: 'web/island-art-season.js', fn: 'drawSnowman' }],
  axes: [
    axis('look', () => tr('assets.axis.look'), [
      { id: 'tall', label: () => tr('assets.snowman.tall') },
      { id: 'stout', label: () => tr('assets.snowman.stout') },
      { id: 'small', label: () => tr('assets.snowman.small') },
    ]),
  ],
  uses: ['light'],
  palette: paletteOf(paintSnowman),
  draw(ctx, view) {
    const m = snowmanOf(view.pick);
    // the snowmen are snow already: nothing settles on them
    AssetsScene.prop(ctx, view, 'snowman' + m.look, m.x, m.y, SNOWMAN_EXT, paintSnowman, false);
  },
};

// ---- the lake's lotus, duckweed and stepping stones: scene cards ----
const LOTUS_BED = { x: 586, y: 584, w: 64, h: 40 },
  WEED_BED = { x: 392, y: 626, w: 72, h: 46 },
  STONES = { x: 584, y: 606, w: 96, h: 76 };
const lakeCard = (key, name, region, source, more) => ({
  id: 'outdoor.' + key,
  cat: 'outdoor',
  name,
  tags: ['animated'],
  when: { seasons: ['spring', 'summer', 'autumn'] },
  where: 'lake',
  source,
  uses: ['light', 'season', 'snow', 'event'],
  draw: (ctx, view, t) => AssetsScene.islandScene(ctx, view, t, region),
  ...more,
});
const LOTUS = lakeCard('lotus', () => tr('assets.item.outdoor.lotus'), LOTUS_BED, [
  { file: 'web/island-art-lake.js', fn: 'drawLakeDecor' },
]);
const DUCKWEED = lakeCard('duckweed', () => tr('assets.item.outdoor.duckweed'), WEED_BED, [
  { file: 'web/island-lake-life.js', fn: 'drawWeed' },
]);
const STEPPING = lakeCard(
  'stepping-stones',
  () => tr('assets.item.outdoor.stepping-stones'),
  STONES,
  [{ file: 'web/island-art-lake.js', fn: 'drawLakeDecor' }],
  {
    when: { always: true },
  },
);

export const OUTDOOR = [ROCK, LAMP, CANE, BENCH, PAVILION, SNOWMAN, LOTUS, DUCKWEED, STEPPING];
