// Baking the island: the lawn, its underside and outline, the mountain, river and lake beds and the low decor in one
// picture, and the things that stand up off the lawn (bushes, lamps, the bench, the bridge's two halves) as
// small sprites the scene sorts with the people and dogs. The pieces' drawing lives in web/island-art.js.
import {
  drawBench,
  drawBridge,
  drawBush,
  drawLamp,
  drawMountain,
  drawMushroom,
  drawRock,
  drawUnderside,
  hex,
  mix,
  painter,
  shoreFace,
  toHex,
} from './island-art.js';
import { hash, WATER_Z } from './island-land.js';
export { hash, hex, mix, toHex, WATER_Z };
// Night pulls every island colour toward the same deep blue the office uses after dark.
export const night = (c, df) => mix(c, '#0d1322', (1 - df) * 0.6);
export const SNOW = '#eef3f7';

export function drawTree(ctx, P, d, df, snow) {
  const [px, py] = P(d.x + 0.5, d.y + 0.5, 0),
    x = Math.round(px),
    y = Math.round(py);
  const leaf = night(mix('#3e9a45', SNOW, snow * 0.5), df),
    top = night(mix('#57b85a', SNOW, snow * 0.6), df);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 5, y - 1, 10, 2);
  ctx.fillStyle = night('#6b4a2a', df);
  ctx.fillRect(x - 1, y - 10, 2, 10);
  ctx.fillStyle = leaf;
  ctx.fillRect(x - 5, y - 19, 10, 9);
  ctx.fillStyle = mix(leaf, '#000000', 0.18);
  ctx.fillRect(x + 1, y - 19, 4, 9);
  ctx.fillStyle = top;
  ctx.fillRect(x - 3, y - 22, 6, 3);
}

// The island projection (lawn level) and its colours for one bake: through the island's light, and toward snow white
// by `s` of the current snow cover.
const TW = 16,
  TH = 8;
function bakeTools(frame, env) {
  const { OX, OY } = frame,
    P = (x, y, z = 0) => [OX + (x - y) * TW, OY + (x + y) * TH - z],
    C = (c, s = 0) => night(s ? mix(c, SNOW, env.snow * s) : c, env.df);
  return { P, C };
}

// The island as one image the size of the scene canvas. The land (lawn, underside, river and lake beds, mountain) is
// painted first on its own canvas so it can be ringed with the 1 px outline; the paths, rim stones and low decor
// (rocks, mushrooms, flowers) go on top. Whatever stands up off the lawn is left to renderProps. Moving water, falls
// and lamp light are drawn every frame over this image.
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
  const { P, C } = bakeTools(frame, env);
  const lp = painter(lctx, P),
    pt = painter(ctx, P);
  const key = (x, y) => x + ',' + y,
    has = (x, y) => island.cells.has(key(x, y)),
    inPond = (x, y) => island.pond.cells.has(key(x, y)),
    wet = (x, y) => inPond(x, y) || island.river.cells.has(key(x, y));
  drawUnderside(lp, P, C, island);
  for (const c of island.list) {
    const { x, y } = c;
    // the top: a river or lake bed sunk WATER_Z below the grass (earth banks on its far sides), else checker grass
    if (wet(x, y)) {
      if (!wet(x - 1, y)) lp.poly([P(x, y, 0), P(x, y + 1, 0), P(x, y + 1, WATER_Z), P(x, y, WATER_Z)], C('#6f4a32'));
      if (!wet(x, y - 1)) lp.poly([P(x, y, 0), P(x + 1, y, 0), P(x + 1, y, WATER_Z), P(x, y, WATER_Z)], C('#5f3f2a'));
      const deep = wet(x - 1, y) && wet(x, y - 1) && wet(x + 1, y) && wet(x, y + 1);
      lp.poly(
        [P(x, y, WATER_Z), P(x + 1, y, WATER_Z), P(x + 1, y + 1, WATER_Z), P(x, y + 1, WATER_Z)],
        C(deep ? '#3b8fcf' : '#4aa3df', 0.6),
      );
    } else {
      const grass = (x + y) % 2 ? '#5eae4a' : '#5aa847';
      lp.poly([P(x, y, 0), P(x + 1, y, 0), P(x + 1, y + 1, 0), P(x, y + 1, 0)], C(grass, 0.85));
    }
    // the soil layer and the grass lip along the shore
    if (!has(x, y + 1)) shoreFace(lp, P, C, x, y, 'y');
    if (!has(x + 1, y)) shoreFace(lp, P, C, x, y, 'x');
  }
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
    ctx.fillStyle = C('#2b2350');
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(land, 0, 0);
    ctx.restore();
    land.width = land.height = 0; // let the browser drop it now rather than at the next collection
  }
  // A ring of rim stones around the lake, open where the river runs in and where the water spills over the shore
  // into the waterfall.
  {
    const f = island.waterfall,
      R = 0.13,
      stones = [];
    for (const k of island.pond.cells) {
      const [x, y] = k.split(',').map(Number);
      if (!wet(x - 1, y)) stones.push([x - R, y, R * 2, 1]);
      if (!wet(x, y - 1)) stones.push([x, y - R, 1, R * 2]);
      if (!wet(x + 1, y)) stones.push([x + 1 - R, y, R * 2, 1]);
      if (!wet(x, y + 1) && !(x === f.x && y === f.y)) stones.push([x, y + 1 - R, 1, R * 2]);
    }
    stones.sort((a, b) => a[0] + a[2] / 2 + a[1] + a[3] / 2 - (b[0] + b[2] / 2 + b[1] + b[3] / 2));
    for (const [sx, sy, w, hh] of stones) {
      // each edge is laid as two stones with a small gap, so the rim reads as stonework
      const along = w > hh,
        n = 2;
      for (let i = 0; i < n; i++) {
        const a = i / n + 0.02,
          b = (i + 1) / n - 0.02,
          x0 = along ? sx + w * a : sx,
          x1 = along ? sx + w * b : sx + w,
          y0 = along ? sy : sy + hh * a,
          y1 = along ? sy + hh : sy + hh * b;
        const top = C(hash(x0 * 7, y0 * 7, 8) > 0.5 ? '#c9c3b8' : '#b8b1a5', 0.8);
        pt.box(x0, x1, y0, y1, 0, 2.5, top, mix(top, '#000000', 0.22), mix(top, '#000000', 0.38));
      }
    }
  }
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
  // The low decor, back to front: rocks, mushrooms and flowers lie under anyone walking past.
  const flower = d => {
    const [px, py] = P(d.x + 0.5, d.y + 0.5, 0);
    ctx.fillStyle = C(['#ffd166', '#ff8fab', '#ffffff'][(d.x + d.y + 99) % 3]);
    ctx.fillRect(Math.round(px), Math.round(py) - 1, 1, 1);
  };
  const LOW = {
    rock: d => drawRock(pt, P, C, d),
    mushroom: d => drawMushroom(pt, P, C, d),
    flower,
  };
  for (const d of island.decor) if (LOW[d.kind]) LOW[d.kind](d);
  return cv;
}

// Everything that stands up off the lawn, each baked into its own small sprite at the island image's resolution and
// light: [{ x, y, z, img, dx, dy, lamp }]. (x, y) is its tile, z its depth among the scene's sorted sprites (x + y
// of the point that decides what it hides), dx, dy where the sprite goes in canvas px, lamp the lamp's index or -1.
// Trees are left out: the scene draws them itself (as event trees in a season or on a holiday). The bridge comes in
// two halves, the far railing with the deck and the near railing, so whoever crosses it is drawn between them;
// someone behind a lamp post, a bush or the bench is hidden by it.
export function renderProps(island, frame, k, env) {
  const { P, C } = bakeTools(frame, env),
    out = [];
  // ext: [left, up, right, down] px round the point (x + 0.5, y + 0.5) on the lawn
  const add = (x, y, z, ext, draw, lamp = -1) => {
    const [ax, ay] = P(x + 0.5, y + 0.5, 0),
      dx = Math.floor((ax - ext[0]) * k),
      dy = Math.floor((ay - ext[1]) * k),
      img = document.createElement('canvas');
    img.width = Math.ceil((ax + ext[2]) * k) - dx;
    img.height = Math.ceil((ay + ext[3]) * k) - dy;
    const g = img.getContext('2d');
    g.setTransform(k, 0, 0, k, -dx, -dy);
    draw(painter(g, P), g);
    out.push({ x, y, z, img, dx, dy, lamp });
  };
  const { bridge, rest } = island,
    bx = bridge.dir === 'x' ? bridge.len : 0,
    by = bridge.dir === 'x' ? 0 : bridge.len,
    span = [16 * (bridge.len + 2), 26, 16 * (bridge.len + 2), 18];
  // a walker on the deck stands at least a quarter tile in from its ends and half a tile in from either railing
  add(bridge.x, bridge.y, bridge.x + bridge.y - 0.2, span, pt => drawBridge(pt, P, C, bridge, 'back'));
  add(bridge.x, bridge.y, bridge.x + bx + bridge.y + by + 0.8, span, pt => drawBridge(pt, P, C, bridge, 'front'));
  island.lamps.forEach((l, i) => add(l.x, l.y, l.x + l.y + 1, [9, 25, 8, 3], pt => drawLamp(pt, P, C, island, l), i));
  add(rest.bench.x, rest.bench.y, rest.bench.x + rest.bench.y + 1, [13, 15, 13, 8], pt =>
    drawBench(pt, P, C, rest.bench),
  );
  for (const d of island.decor)
    if (d.kind === 'bush') add(d.x, d.y, d.x + d.y + 0.5, [11, 15, 11, 4], pt => drawBush(pt, P, C, d));
  return out;
}
