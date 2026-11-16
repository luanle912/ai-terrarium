// The /assets catalogue: the world view. The small pixel island every other island is drawn as in the world's
// overview (web/world-ui.js paintIsland: its roof colour, its windows lit one per busy session, the gold pennant on
// the viewer's own, the season on its lawn and roof), and the tile of a place with no island yet. Both are painted on
// a sprite of their own, as the world view caches them (the outline pass reads the sprite back).
import { tr } from './i18n.js';
import { AssetsStage } from './assets-stage.js';
import { AssetsScene } from './assets-scene.js';
import { ART_H, ART_W, ISL, paintIsland, paintTile } from './world-ui.js';

const { axis } = AssetsStage;
// The roof colours the hub hands out to islands (hub/pages.js ISLAND_COLORS; a test keeps the two the same).
export const ISLAND_COLORS = ['#e76f51', '#f4a261', '#e9c46a', '#8ab17d', '#2a9d8f', '#4a90d9', '#7b6cd9', '#d96ca8'];
const COLOR_LABEL = [
  () => tr('assets.colour.n', { n: 1 }),
  () => tr('assets.colour.n', { n: 2 }),
  () => tr('assets.colour.n', { n: 3 }),
  () => tr('assets.colour.n', { n: 4 }),
  () => tr('assets.colour.n', { n: 5 }),
  () => tr('assets.colour.n', { n: 6 }),
  () => tr('assets.colour.n', { n: 7 }),
  () => tr('assets.colour.n', { n: 8 }),
];
const LIT = [0, 3, 6];
// The sprite's anchor: the middle of the island's lawn.
const stampAt = (ctx, view, img) => ctx.drawImage(img, view.ox - ISL.cx, view.oy - ISL.cy);

const WORLD_ISLAND = {
  id: 'world.island',
  cat: 'world',
  name: () => tr('assets.item.world.island'),
  tags: ['state'],
  when: { always: true },
  where: 'world',
  source: [{ file: 'web/world-ui.js', fn: 'paintIsland' }],
  axes: [
    axis(
      'colour',
      () => tr('assets.axis.colour'),
      ISLAND_COLORS.map((c, i) => ({ id: c.slice(1), label: COLOR_LABEL[i], swatch: c })),
    ),
    axis(
      'lit',
      () => tr('assets.axis.lit'),
      LIT.map(n => ({ id: String(n), label: () => tr('assets.lit.n', { n }) })),
    ),
    axis('mine', () => tr('assets.axis.mine'), [
      { id: 'other', label: () => tr('assets.mine.other') },
      { id: 'mine', label: () => tr('assets.mine.mine') },
    ]),
  ],
  uses: ['light', 'season', 'event'],
  draw(ctx, view) {
    const c = '#' + (ISLAND_COLORS.includes('#' + view.pick.colour) ? view.pick.colour : ISLAND_COLORS[0].slice(1)),
      lit = LIT.includes(+view.pick.lit) ? +view.pick.lit : 0,
      mine = view.pick.mine === 'mine',
      { df, season } = view.env;
    const img = AssetsScene.sprite(
      'world|' + c + df + lit + mine + season,
      ART_W,
      ART_H,
      g => paintIsland(g, c, df, lit, mine, season),
      true,
    );
    stampAt(ctx, view, img);
  },
};
const TILES = ['empty', 'yours', 'full'];
const WORLD_TILE = {
  id: 'world.tile',
  cat: 'world',
  name: () => tr('assets.item.world.tile'),
  tags: ['state'],
  when: { always: true },
  where: 'world',
  source: [{ file: 'web/world-ui.js', fn: 'paintTile' }],
  axes: [
    axis('kind', () => tr('assets.axis.kind'), [
      { id: 'empty', label: () => tr('assets.tile.empty') },
      { id: 'yours', label: () => tr('assets.tile.yours') },
      { id: 'full', label: () => tr('assets.tile.full') },
    ]),
  ],
  draw(ctx, view) {
    const kind = TILES.includes(view.pick.kind) ? view.pick.kind : 'empty';
    stampAt(
      ctx,
      view,
      AssetsScene.sprite('world-tile|' + kind, ART_W, ART_H, g => paintTile(g, kind), true),
    );
  },
};

export const WORLD = [WORLD_ISLAND, WORLD_TILE];
