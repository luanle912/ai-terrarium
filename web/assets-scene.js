// What the /assets page needs to show the island's own pictures (plants, outdoor props, island & sky, the world view):
// sprites painted once and kept, a prop baked as web/sky-island.js renderProps bakes it, and scene cards cut from the
// island baked as the game bakes it, with what moves on it drawn over every frame. Built on web/assets-stage.js.
import { AssetsStage } from './assets-stage.js';
import { H as SCENE_H, ISLAND, LH, LW, OX, OY, PG as SCENE_PG, TH, TW, W as SCENE_W } from './office-scene.js';
import { SkyRender } from './sky-render.js';
import { SkyLogic } from './sky-logic.js';
import { IslandLife } from './island-life.js';
import { snowOnTop } from './island-art-snow.js';

// A canvas of w × h px painted once by paint(g, canvas) and kept by key (the least recently used goes first). On the
// counting canvas of the tests, stamping it folds what was painted on it into the signature (AssetsStage.recordingCtx).
// read: a canvas the paint reads back (getImageData).
const SPRITES = new Map(),
  SPRITE_MAX = 400;
function sprite(key, w, h, paint, read) {
  let c = SPRITES.get(key);
  if (c) {
    SPRITES.delete(key);
    SPRITES.set(key, c);
    return c;
  }
  c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  paint(read ? c.getContext('2d', { willReadFrequently: true }) : c.getContext('2d'), c);
  if (SPRITES.size >= SPRITE_MAX) SPRITES.delete(SPRITES.keys().next().value);
  SPRITES.set(key, c);
  return c;
}
// Something that stands up off the lawn, as web/sky-island.js renderProps bakes it: paint(s) draws it standing on the
// island's tile (x, y) (s a stage on the sprite whose PG puts that tile where the sprite's foot is), in a sprite of
// ext = [left, up, right, down] px round its foot; lying snow settles on its top when snowy. Stamped with its foot at
// (ox, oy). key names what paint draws (the env is added).
function prop(ctx, view, key, x, y, ext, paint, snowy = true) {
  const env = view.env,
    img = sprite('prop|' + key + '|' + env.key, ext[0] + ext[2], ext[1] + ext[3], (g, c) => {
      const s = AssetsStage.stage(g, {
        ox: ext[0] - (x - y) * TW,
        oy: ext[1] - (x + y + 1) * TH,
        env,
        pick: view.pick,
      });
      paint(s);
      if (snowy) snowOnTop(c, 1, s.S, s.depth);
    });
  ctx.drawImage(img, view.ox - ext[0], view.oy - ext[1]);
}

// The island baked as the game bakes it (web/office-draw.js: SkyRender.renderIsland, and renderProps stamped back to
// front) at one canvas px per scene px, once per scene. Every region a scene card shows ({x, y, w, h} in scene px,
// made by region() when the module loads, so one bake serves them all) is cut out of it right away, the land and the
// props apart (what moves on the island goes between them); the whole images are let go. The cuts of the last
// CUT_ENVS scenes are kept.
const REGIONS = [],
  CUTS = new Map(),
  CUT_ENVS = 24;
function region(x, y, w, h) {
  const r = { x, y, w, h };
  REGIONS.push(r);
  return r;
}
function bake(env) {
  const frame = { LW, LH, OX, OY },
    light = { df: env.df, snow: env.snow, season: env.season, block: { W: SCENE_W, H: SCENE_H }, event: env.event },
    land = SkyRender.renderIsland(ISLAND, frame, 1, light),
    props = SkyRender.renderProps(ISLAND, frame, 1, light).sort((a, b) => a.z - b.z),
    out = new Map();
  for (const r of REGIONS) {
    const cut = () => {
      const c = document.createElement('canvas');
      c.width = r.w;
      c.height = r.h;
      return c;
    };
    const ln = cut(),
      pr = cut(),
      g = pr.getContext('2d');
    ln.getContext('2d').drawImage(land, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    for (const p of props)
      if (p.dx < r.x + r.w && p.dy < r.y + r.h && p.dx + p.img.width > r.x && p.dy + p.img.height > r.y)
        g.drawImage(p.img, p.dx - r.x, p.dy - r.y);
    out.set(r, { land: ln, props: pr });
  }
  land.width = land.height = 0;
  for (const p of props) p.img.width = p.img.height = 0;
  return out;
}
// The land and the props of region r in the scene of env, as two canvases of r.w × r.h px.
function bakeCut(env, r) {
  const key = env.key;
  let cuts = CUTS.get(key);
  if (cuts && cuts.has(r)) {
    CUTS.delete(key);
    CUTS.set(key, cuts);
    return cuts.get(r);
  }
  // a region made after the bake: bake again with it in
  if (!REGIONS.includes(r)) REGIONS.push(r);
  if (cuts) for (const c of cuts.values()) c.land.width = c.props.width = 0;
  cuts = bake(env);
  CUTS.delete(key);
  CUTS.set(key, cuts);
  if (CUTS.size > CUT_ENVS) {
    const old = CUTS.keys().next().value;
    for (const c of CUTS.get(old).values()) c.land.width = c.props.width = 0;
    CUTS.delete(old);
  }
  return cuts.get(r);
}
// Clips to region r of the scene shown with its top left at (ox, oy), the canvas moved so scene px land there.
function enter(ctx, view, r) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(view.ox, view.oy, r.w, r.h);
  ctx.clip();
  ctx.translate(view.ox - r.x, view.oy - r.y);
}
// A scene card: region r of the island with its top left at (ox, oy), as the game shows it at time t: the baked land,
// what moves on it (IslandLife.drawLife: water, falls, mist, vines, lamp pools, birds, fireflies), the props, the
// lamps' and the lantern's light, then over(ctx, view, t) if given, in scene px.
function islandScene(ctx, view, t, r, over) {
  const env = view.env,
    c = bakeCut(env, r);
  ctx.drawImage(c.land, view.ox, view.oy);
  enter(ctx, view, r);
  IslandLife.drawLife(ctx, ISLAND, SCENE_PG, t, env);
  ctx.restore();
  ctx.drawImage(c.props, view.ox, view.oy);
  enter(ctx, view, r);
  for (let i = 0; i < ISLAND.lamps.length; i++) IslandLife.drawLampLight(ctx, ISLAND, SCENE_PG, i, t, env);
  IslandLife.drawLanternLight(ctx, ISLAND, SCENE_PG, t, env);
  if (over) over(ctx, view, t);
  ctx.restore();
}
// The frame of a scene card showing region r (an entry's `frame`): what it draws is clipped to the region, so there is
// nothing to measure (measuring would bake the island once per scene for every card).
const frameOf = r => ({ w: r.w, h: r.h });
// env under one of the weathers of SkyLogic.FX (its fx and the sky colours that go with it), one object each.
const WEATHER_ENVS = new WeakMap();
function weatherEnv(env, w) {
  let m = WEATHER_ENVS.get(env);
  if (!m) WEATHER_ENVS.set(env, (m = {}));
  if (!m[w]) {
    const fx = { ...SkyLogic.FX[w] };
    m[w] = { ...env, fx, col: SkyLogic.skyColors(env.df, env.hour, fx) };
  }
  return m[w];
}

export const AssetsScene = { sprite, prop, region, frameOf, bakeCut, enter, islandScene, weatherEnv };
