// Baking the island: the lawn, its underside and outline, the lake, the mountain and the pool at its foot, the
// stepping stones, lotus and low decor in one picture, and the things that stand up off the lawn (bushes, lamps, the
// bench, the pavilion) as sprites the scene sorts with the people and dogs. The pieces' drawing lives in
// web/island-art.js, web/island-art-mountain.js and web/island-art-lake.js.
import {
  drawBench,
  drawBush,
  drawLamp,
  drawMushroom,
  drawRock,
  drawUnderside,
  hex,
  mix,
  night,
  OUTLINE,
  painter,
  shoreFace,
  toHex,
} from './island-art.js';
import { drawMountain, drawPool } from './island-art-mountain.js';
import { drawLakeDecor, drawPavilion, drawWater, PAVILION_EXT } from './island-art-lake.js';
import { hash, WATER_Z } from './island-land.js';
import { drawSeasonFlowers, drawSeasonTree, drawSnowman, seasonC, SNOWMAN_EXT, TREE_EXT } from './island-art-season.js';
import { SeasonIsland } from './season-island.js';
import { SeasonLogic } from './season-logic.js';
import { SnowLogic } from './snow-logic.js';
import { CANE_EXT, drawCandyCane } from './island-art-xmas.js';
import { drawIcicles, drawSnowEdge, drawSnowLawn, snowOnTop, snowTile } from './island-art-snow.js';
export { hash, hex, mix, toHex, WATER_Z };
// Night pulls every island colour toward the same deep blue the office uses after dark (web/island-art.js).
export { night };
export const SNOW = '#eef3f7';

// The island projection (lawn level) and its colours for one bake: through the island's light, toward snow white
// by `s` of the current snow cover, and the grass toward the season's tint. env.season is the season's key
// (SeasonLogic; summer, the standard, when missing), env.block the office block {W, H} the island is built round.
const TW = 16,
  TH = 8;
function bakeTools(frame, env) {
  const { OX, OY } = frame,
    look = SeasonLogic.look(env.season),
    P = (x, y, z = 0) => [OX + (x - y) * TW, OY + (x + y) * TH - z],
    C = seasonC((c, s = 0) => night(s ? mix(c, SNOW, env.snow * s) : c, env.df), look),
    // Lying snow (web/island-art-snow.js): its own colours, dimmed less than the grass after dark.
    depth = SnowLogic.depth(env.snow),
    S = c => SnowLogic.night(c, env.df);
  return { P, C, look, depth, S };
}

// The island as one image the size of the scene canvas. The land (underside, lawn, lake, mountain) is painted first on
// its own canvas so it can be ringed with the 1 px outline; the pool at the mountain's foot, the stepping stones,
// lotus, paths and low decor (rocks, mushrooms, flowers) go on top. Whatever stands up off the lawn is left to
// renderProps. Moving water, falls and lamp light are drawn every frame over this image.
export function renderIsland(island, frame, k, env) {
  const { LW, LH, OX, OY } = frame;
  const canvas = () => {
    const c = document.createElement('canvas');
    c.width = Math.round(LW * k);
    c.height = Math.round(LH * k);
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    return [c, g];
  };
  const [cv, ctx] = canvas(),
    [land, lctx] = canvas();
  const { P, C, look, depth, S } = bakeTools(frame, env),
    frozen = look.frozen;
  const lp = painter(lctx, P),
    pt = painter(ctx, P);
  const has = (x, y) => island.cells.has(x + ',' + y),
    f = island.waterfall;
  drawUnderside(lp, P, C, island, frame);
  // checker grass on every tile (the water is painted over it), the soil layer and the grass lip along the shore; under
  // the main fall's lip only the soil
  for (const c of island.list) {
    const { x, y } = c,
      grass = (x + y) % 2 ? '#5eae4a' : '#5aa847';
    lp.poly(
      [P(x, y, 0), P(x + 1, y, 0), P(x + 1, y + 1, 0), P(x, y + 1, 0)],
      depth ? snowTile(S, C(grass), x, y, depth) : C(grass, 0.85),
    );
    if (!has(x, y + 1)) shoreFace(lp, P, C, x, y, 'y', x === f.x && y === f.y);
    if (!has(x + 1, y)) shoreFace(lp, P, C, x, y, 'x');
  }
  // snow that lies: over the lawn and hanging over the edge (the water and the mountain are painted over it)
  if (depth) {
    drawSnowLawn(lp, P, S, C, island, env.block, depth);
    drawSnowEdge(lp, P, S, island, depth, f);
  }
  drawWater(lp, P, C, island, frame, frozen);
  drawMountain(lp, P, C, island, env.snow);
  // The 1 px outline: the land's silhouette pushed out a pixel each way and filled with the outline colour, straight
  // onto the still empty island image, then the land itself on top, so only the ring outside it shows.
  {
    const o = Math.max(1, Math.round(k));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const [dx, dy] of [
      [o, 0],
      [-o, 0],
      [0, o],
      [0, -o],
    ])
      ctx.drawImage(land, dx, dy);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = C(OUTLINE);
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(land, 0, 0);
    ctx.restore();
    land.width = land.height = 0; // let the browser drop it now rather than at the next collection
  }
  if (depth) drawIcicles(ctx, P, S, island, depth);
  // the small pool the mountain fall drops into, in its stone rim, against the rock of the gap
  drawPool(pt, P, C, island, frozen);
  drawLakeDecor(pt, P, C, island, frozen);
  // Garden paths (SkyLogic.lawnPaths): a faint worn strip in the grass where feet go, and flat stepping stones on it
  // that sit 1 px proud of the grass.
  if (island.paths) {
    // The worn strip is stroked in the ground plane: with the iso projection as the canvas transform a round-capped
    // line becomes a band lying on the lawn, joins and ends included.
    ctx.save();
    ctx.setTransform(k * TW, k * TH, -k * TW, k * TH, k * OX, k * OY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.62;
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = C('#a8955a', 0.6);
    for (const l of island.paths.strips) {
      ctx.beginPath();
      l.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.restore();
    for (const st of island.paths.stones) {
      const top = C(hash(st.x * 5, st.y * 5, 11) > 0.5 ? '#c9c3b8' : '#bdb6aa', 0.55);
      pt.poly(
        st.outline.map(([x, y]) => P(x, y, 0)),
        mix(top, '#000000', 0.32),
      );
      pt.poly(
        st.outline.map(([x, y]) => P(x, y, 1)),
        top,
      );
    }
  }
  // The low decor, back to front: rocks, mushrooms and flowers lie under anyone walking past. A season with fewer
  // flowers (look.flowers below 1) keeps that share of them; spring adds more over the open lawn.
  const flower = d => {
    if (look.flowers < 1 && hash(d.x, d.y, 135) >= look.flowers) return;
    const [px, py] = P(d.x + 0.5, d.y + 0.5, 0);
    ctx.fillStyle = C(d.colour || ['#ffd166', '#ff8fab', '#ffffff'][(d.x + d.y + 99) % 3]);
    ctx.fillRect(Math.round(px), Math.round(py) - 1, 1, 1);
  };
  const LOW = {
    rock: d => drawRock(pt, P, C, d),
    mushroom: d => drawMushroom(pt, P, C, d),
    flower,
  };
  for (const d of island.decor) if (LOW[d.kind]) LOW[d.kind](d);
  if (env.block) drawSeasonFlowers(ctx, P, C, island, env.block.W, env.block.H, look);
  return cv;
}

// Everything that stands up off the lawn, each baked into its own small sprite at the island image's resolution and
// light: [{ x, y, z, img, dx, dy, lamp, lantern }]. (x, y) is its tile, z its depth among the scene's sorted sprites
// (x + y of the point that decides what it hides), dx, dy where the sprite goes in canvas px, lamp the lamp's index or
// -1, lantern true for the pavilion. The island's trees, in the season's colours, are marked tree: true, so the scene
// can leave out the few that turn into a holiday's tree; in winter the snowmen stand among them
// (SeasonIsland.snowmanTiles).
// Someone behind a lamp post, a bush, the bench, a tree, a snowman or the pavilion is hidden by it.
export function renderProps(island, frame, k, env) {
  const { P, C, look, depth, S } = bakeTools(frame, env),
    out = [];
  // ext: [left, up, right, down] px round the point (x + 0.5, y + 0.5) on the lawn
  // (snowy: lying snow settles on its top; the snowmen are snow already)
  const add = (x, y, z, ext, draw, lamp = -1, snowy = true) => {
    const [ax, ay] = P(x + 0.5, y + 0.5, 0),
      dx = Math.floor((ax - ext[0]) * k),
      dy = Math.floor((ay - ext[1]) * k),
      img = document.createElement('canvas');
    img.width = Math.ceil((ax + ext[2]) * k) - dx;
    img.height = Math.ceil((ay + ext[3]) * k) - dy;
    const g = img.getContext('2d');
    g.setTransform(k, 0, 0, k, -dx, -dy);
    draw(painter(g, P), g);
    if (snowy) snowOnTop(img, k, S, depth);
    out.push({ x, y, z, img, dx, dy, lamp });
  };
  const { pavilion, rest } = island;
  // the pavilion stands in the lake on its pillar; its lantern glows right after it is drawn (web/office-draw.js)
  if (pavilion) {
    const { x, y } = pavilion.pillar;
    add(x, y, x + y + 1, PAVILION_EXT, pt => drawPavilion(pt, P, C, island));
    out[out.length - 1].lantern = true;
  }
  island.lamps.forEach((l, i) => add(l.x, l.y, l.x + l.y + 1, [9, 25, 8, 3], pt => drawLamp(pt, P, C, island, l), i));
  add(rest.bench.x, rest.bench.y, rest.bench.x + rest.bench.y + 1, [13, 15, 13, 8], pt =>
    drawBench(pt, P, C, rest.bench),
  );
  for (const d of island.decor)
    if (d.kind === 'bush') add(d.x, d.y, d.x + d.y + 0.5, [11, 15, 11, 4], pt => drawBush(pt, P, C, d, look.fruit));
  // During the Christmas event winter's bare trees are firs, lightly snowed (they bring their own snow).
  const fir = !!env.event && look.trees === 'bare',
    trees = fir ? 'fir' : look.trees;
  for (const d of island.decor)
    if (d.kind === 'tree') {
      add(d.x, d.y, d.x + d.y + 0.5, TREE_EXT, pt => drawSeasonTree(pt, P, C, d, trees), -1, !fir);
      out[out.length - 1].tree = true;
    }
  if (look.frozen && env.block)
    for (const m of SeasonIsland.snowmanTiles(island, env.block.W, env.block.H))
      add(m.x, m.y, m.x + m.y + 0.5, SNOWMAN_EXT, pt => drawSnowman(pt, P, C, m), -1, false);
  // the Christmas event's big tree (env.event is its level): it keeps more of its colour after dark than the lawn
  if (env.event && env.block) {
    const T = c => night(c, 1 - (1 - env.df) * 0.55);
    if (env.event >= 2)
      for (const l of island.lamps) add(l.x, l.y, l.x + l.y + 1.3, CANE_EXT, pt => drawCandyCane(pt, P, T, l));
  }
  return out;
}
