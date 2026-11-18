// The /assets catalogue: the island and the sky. The island's land only exists as one baked picture with its life
// drawn over it every frame, so its parts are scene cards: a region cut from the shared bake (web/assets-stage.js
// AssetsScene, once per scene) with the water, falls, mist and vines moving on it (the shore, the underside, the
// mountain and its pool, the lake and the pavilion, the main waterfall, the rainbow after rain, the petals, leaves and
// snow that fall). The sky is drawn by web/sky-render.js on a small stage of its own: the back sky with its sun, moon,
// stars, cloud bands and sea of mist, the six weathers with what falls in front, and the far islands
// (web/sky-mist.js).
import { tr } from './i18n.js';
import { AssetsStage } from './assets-stage.js';
import { AssetsScene } from './assets-scene.js';
import { IslandLife } from './island-life.js';
import { IslandSeasonLife } from './island-season-life.js';
import { SkyRender } from './sky-render.js';
import { SkyLogic } from './sky-logic.js';
import { SeasonLogic } from './season-logic.js';
import { paintFarIsland } from './sky-mist.js';
import { Paint } from './paint.js';
import { ISLAND, PG } from './office-scene.js';

const { axis } = AssetsStage;
const ALL = ['light', 'season', 'snow', 'event'];

// ---- the island: scene cards ----
// Regions of the scene, in its px (web/office-scene.js LW × LH, the island's origin at OX, OY).
const REGION = {
  shore: AssetsScene.region(24, 380, 112, 92),
  underside: AssetsScene.region(400, 736, 140, 136),
  mountain: AssetsScene.region(440, 34, 148, 136),
  lake: AssetsScene.region(480, 600, 160, 128),
  waterfall: AssetsScene.region(492, 736, 112, 128),
  fall: AssetsScene.region(520, 180, 128, 96),
  rainbow: AssetsScene.region(520, 764, 144, 132),
};
const islandCard = (key, name, source, more) => ({
  id: 'island.' + key,
  cat: 'island',
  name,
  tags: ['animated'],
  when: { always: true },
  where: 'lawn',
  source: [{ file: 'web/sky-island.js', fn: 'renderIsland' }, ...source],
  uses: ALL,
  frame: AssetsScene.frameOf(REGION[key]),
  draw: (ctx, view, t) => AssetsScene.islandScene(ctx, view, t, REGION[key]),
  ...more,
});
const LIFE = { file: 'web/island-life.js', fn: 'drawLife' };
const SHORE = islandCard('shore', () => tr('assets.item.island.shore'), [
  { file: 'web/island-art.js', fn: 'shoreFace' },
  LIFE,
]);
const UNDERSIDE = islandCard('underside', () => tr('assets.item.island.underside'), [
  { file: 'web/island-art.js', fn: 'drawUnderside' },
  LIFE,
]);
const MOUNTAIN = islandCard('mountain', () => tr('assets.item.island.mountain'), [
  { file: 'web/island-art-mountain.js', fn: 'drawMountain' },
  { file: 'web/island-art-mountain.js', fn: 'drawPool' },
  LIFE,
]);
const LAKE = islandCard(
  'lake',
  () => tr('assets.item.island.lake'),
  [{ file: 'web/island-art-lake.js', fn: 'drawWater' }, LIFE],
  { where: 'lake' },
);
const WATERFALL = islandCard('waterfall', () => tr('assets.item.island.waterfall'), [
  { file: 'web/island-life.js', fn: 'drawMainFall' },
  { file: 'web/island-life.js', fn: 'drawMist' },
]);

// The rainbow over the main fall once the rain has stopped (web/island-life.js), at its fullest: by day only, as
// rainbowLevel says.
const RAINBOW_ARGS = { fx: SkyLogic.FX.clear, df: 1, lastRainAt: 0, now: 0 };
function rainbowOver(ctx, view) {
  RAINBOW_ARGS.df = view.env.df;
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  IslandLife.drawRainbow(ctx, IslandLife.geometry(ISLAND, PG), IslandLife.rainbowLevel(RAINBOW_ARGS));
  ctx.imageSmoothingEnabled = smooth;
}
const RAINBOW_AT = REGION.rainbow;
const RAINBOW = islandCard(
  'rainbow',
  () => tr('assets.item.island.rainbow'),
  [{ file: 'web/island-life.js', fn: 'drawRainbow' }],
  { where: 'sky', draw: (ctx, view, t) => AssetsScene.islandScene(ctx, view, t, RAINBOW_AT, rainbowOver) },
);

// Petals in spring, leaves in autumn, snow in winter (SeasonLogic look.fall), falling over the lawn of that season.
const FALLS = [
  ['petals', 'spring'],
  ['leaves', 'autumn'],
  ['snow', 'winter'],
];
const FV = { ox: 0, oy: 0, env: null, pick: null };
// The scene a fall is shown in: the page's light and snow, in the fall's own season (looked up once per scene).
const FALL_ENVS = new WeakMap();
function fallEnv(env, i) {
  let m = FALL_ENVS.get(env);
  if (!m)
    FALL_ENVS.set(env, (m = FALLS.map(f => AssetsStage.envOf({ light: env.light, season: f[1], snow: !!env.snow }))));
  return m[i];
}
function fallOver(ctx, view, t) {
  IslandSeasonLife.drawFall(ctx, ISLAND, PG, t, view.env);
}
const FALL = islandCard(
  'fall',
  () => tr('assets.item.island.fall'),
  [{ file: 'web/island-season-life.js', fn: 'drawFall' }],
  {
    when: { seasons: ['spring', 'autumn', 'winter'] },
    axes: [
      axis('kind', () => tr('assets.axis.kind'), [
        { id: 'petals', label: () => tr('assets.fall.petals') },
        { id: 'leaves', label: () => tr('assets.fall.leaves') },
        { id: 'snow', label: () => tr('assets.fall.snow') },
      ]),
    ],
    uses: ['light', 'snow'],
    draw(ctx, view, t) {
      let i = FALLS.length - 1;
      while (i > 0 && FALLS[i][0] !== view.pick.kind) i--;
      FV.ox = view.ox;
      FV.oy = view.oy;
      FV.pick = view.pick;
      FV.env = fallEnv(view.env, i);
      AssetsScene.islandScene(ctx, FV, t, REGION.fall, fallOver);
    },
  },
);

// ---- the sky (web/sky-render.js), on a stage of SKY_W × SKY_H px ----
const SKY_W = 160,
  SKY_H = 100,
  SKY_FRAME = { w: SKY_W, h: SKY_H };
function skyIn(ctx, view) {
  ctx.save();
  ctx.translate(view.ox, view.oy);
  ctx.beginPath();
  ctx.rect(0, 0, SKY_W, SKY_H);
  ctx.clip();
}
// the far islands in the back sky wear the look's trees (firs with lights under the Christmas event)
const SKY_USES = ['light', 'season', 'event'];
const SKY = {
  id: 'island.sky',
  cat: 'island',
  name: () => tr('assets.item.island.sky'),
  tags: ['animated'],
  when: { always: true },
  where: 'sky',
  source: [{ file: 'web/sky-render.js', fn: 'drawBack' }],
  uses: SKY_USES,
  frame: SKY_FRAME,
  draw(ctx, view, t) {
    skyIn(ctx, view);
    SkyRender.drawBack(ctx, SKY_W, SKY_H, t, view.env);
    ctx.restore();
  },
};
const WEATHER_NAME = {
  clear: () => tr('weather.label.clear'),
  cloudy: () => tr('weather.label.cloudy'),
  rain: () => tr('weather.label.rain'),
  storm: () => tr('weather.label.storm'),
  snow: () => tr('weather.label.snow'),
  fog: () => tr('weather.label.fog'),
};
const WEATHER = {
  id: 'island.weather',
  cat: 'island',
  name: () => tr('assets.item.island.weather'),
  tags: ['animated'],
  when: { always: true },
  where: 'sky',
  source: [
    { file: 'web/sky-render.js', fn: 'drawFront' },
    { file: 'web/sky-logic.js', fn: 'FX' },
  ],
  axes: [
    axis(
      'weather',
      () => tr('assets.axis.weather'),
      // rain first: the card shows a weather (clear would look just like the sky card next to it)
      [...SkyLogic.WEATHERS.filter(w => w === 'rain'), ...SkyLogic.WEATHERS.filter(w => w !== 'rain')].map(w => ({
        id: w,
        label: WEATHER_NAME[w] || (() => w),
      })),
    ),
  ],
  uses: SKY_USES,
  frame: SKY_FRAME,
  draw(ctx, view, t) {
    const env = AssetsScene.weatherEnv(view.env, SkyLogic.FX[view.pick.weather] ? view.pick.weather : 'clear');
    skyIn(ctx, view);
    SkyRender.drawBack(ctx, SKY_W, SKY_H, t, env);
    SkyRender.drawFront(ctx, SKY_W, SKY_H, t, env);
    ctx.restore();
  },
};
// The far islands in the sky (web/sky-mist.js): the look's trees (tree.far: the season's, or under the Christmas
// event a fir with its lights, a snowman and a cabin) and the season's snow on them.
const FAR_SC = 0.8;
const FAR = {
  id: 'island.far-islands',
  cat: 'island',
  name: () => tr('assets.item.island.far-islands'),
  when: { always: true },
  where: 'sky',
  source: [{ file: 'web/sky-mist.js', fn: 'paintFarIsland' }],
  axes: [
    axis('kind', () => tr('assets.axis.kind'), [
      { id: 'tree', label: () => tr('assets.far.tree') },
      { id: 'plain', label: () => tr('assets.far.plain') },
      { id: 'rock', label: () => tr('assets.far.rock') },
    ]),
  ],
  uses: ['light', 'season', 'event'],
  draw(ctx, view) {
    const env = view.env,
      look = SeasonLogic.look(env.season);
    ctx.save();
    ctx.translate(view.ox, view.oy);
    paintFarIsland(
      ctx,
      FAR_SC,
      env.col.haze,
      view.pick.kind || 'tree',
      env.look.of('tree.far'),
      look.minSnow > 0,
      Paint.overlaysOf('tree.far', env.look),
    );
    ctx.restore();
  },
};

export const ISLAND_SKY = [SHORE, UNDERSIDE, MOUNTAIN, LAKE, WATERFALL, RAINBOW, FALL, SKY, WEATHER, FAR];
