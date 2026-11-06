// Drawing the island itself: the lawn, its underside and outline, the mountain, river and lake beds, trees, the pond
// glints and the waterfall. The static pieces' drawing lives in web/island-art.js.
import { rgba } from './sky-mist.js';
import {
  drawBench,
  drawBridge,
  drawBush,
  drawLamp,
  drawMountain,
  drawMushroom,
  drawRock,
  drawUnderside,
  painter,
  shoreFace,
} from './island-art.js';
export const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const toHex = a =>
  '#' +
  a
    .map(v =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
export const mix = (a, b, p) => {
  const A = hex(a),
    B = hex(b);
  return toHex(A.map((v, i) => v * (1 - p) + B[i] * p));
};
export const hash = (x, y, s) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
};
// Night pulls every island colour toward the same deep blue the office uses after dark.
export const night = (c, df) => mix(c, '#0d1322', (1 - df) * 0.6);
export const SNOW = '#eef3f7';
// The lake's and the river's water surface sits this far below the grass.
export const WATER_Z = -3;

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

// The island as one image the size of the scene canvas. The land (lawn, underside, river and lake beds, mountain) is
// painted first on its own canvas so it can be ringed with the 1 px outline; the bridge, lamps and small decor go on
// top. Only trees behind the walls are baked in; trees in front are drawn with the office so desks and walls overlap
// them correctly. Moving water, falls and lamp light are drawn every frame over this image.
export function renderIsland(island, frame, k, env) {
  const { LW, LH, OX, OY } = frame,
    TW = 16,
    TH = 8,
    df = env.df,
    snow = env.snow;
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
  const P = (x, y, z = 0) => [OX + (x - y) * TW, OY + (x + y) * TH - z];
  // colours go through the island's light, and toward snow white by `s` of the current snow cover
  const C = (c, s = 0) => night(s ? mix(c, SNOW, snow * s) : c, df);
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
  drawMountain(lp, P, C, island, snow);
  // the 1 px outline: the land's silhouette pushed out a pixel each way, kept only where it falls outside the land
  {
    const [sil, sctx] = canvas(),
      o = Math.max(1, Math.round(k));
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const [dx, dy] of [
      [o, 0],
      [-o, 0],
      [0, o],
      [0, -o],
    ])
      sctx.drawImage(land, dx, dy);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = C('#2b2350');
    sctx.fillRect(0, 0, sil.width, sil.height);
    sctx.globalCompositeOperation = 'destination-out';
    sctx.drawImage(land, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(sil, 0, 0);
    ctx.drawImage(land, 0, 0);
    ctx.restore();
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
  // Everything standing on the lawn, back to front: the bridge, the lamps, the bench and the decor (of the trees only
  // those behind the walls).
  const flower = d => () => {
    const [px, py] = P(d.x + 0.5, d.y + 0.5, 0);
    ctx.fillStyle = C(['#ffd166', '#ff8fab', '#ffffff'][(d.x + d.y + 99) % 3]);
    ctx.fillRect(Math.round(px), Math.round(py) - 1, 1, 1);
  };
  const DECOR = {
    rock: d => () => drawRock(pt, P, C, d),
    bush: d => () => drawBush(pt, P, C, d),
    mushroom: d => () => drawMushroom(pt, P, C, d),
    flower,
    tree: d => (d.x < 0 || d.y < 0 ? () => drawTree(ctx, P, d, df, snow) : null),
  };
  const { bridge, rest } = island,
    items = [{ z: bridge.x + bridge.y + 1, f: () => drawBridge(pt, P, C, bridge) }];
  for (const l of island.lamps) items.push({ z: l.x + l.y + 1, f: () => drawLamp(pt, P, C, island, l) });
  items.push({ z: rest.bench.x + rest.bench.y + 1, f: () => drawBench(pt, P, C, rest.bench) });
  for (const d of island.decor) {
    const f = DECOR[d.kind] && DECOR[d.kind](d);
    if (f) items.push({ z: d.x + d.y + 1, f });
  }
  items.sort((a, b) => a.z - b.z).forEach(it => it.f());
  return cv;
}

// Slow glints moving over the pond surface (drawn every frame over the baked island).
export function drawPond(ctx, island, P, t, df) {
  for (const k of island.pond.cells) {
    const [x, y] = k.split(',').map(Number);
    for (let j = 0; j < 2; j++) {
      const p = (t * 0.25 + hash(x, y, 7 + j)) % 1,
        [gx, gy] = P(x + 0.2 + hash(x, y, 9 + j) * 0.6, y + 0.2 + p * 0.6, WATER_Z);
      ctx.globalAlpha = (0.25 + 0.45 * df) * Math.sin(p * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(gx), Math.round(gy), 2, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// The waterfall is a sheet of water lying in the plane of the island's east cliff face (x = const), so it slants with
// the cliff instead of being a flat screen-space strip: it pours over the pond's lip, runs down the face, then falls
// on.
export function drawWaterfall(ctx, island, P, t, len, df) {
  const f = island.waterfall,
    X = f.x + 1,
    y0 = f.y + 0.15,
    y1 = f.y + 0.85,
    top = WATER_Z,
    bot = -(island.depth.get(f.x + ',' + f.y) || 40) - len;
  const quad = (ya, yb, za, zb) => {
    const a = P(X, ya, za),
      b = P(X, yb, za),
      c = P(X, yb, zb),
      d = P(X, ya, zb);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fill();
  };
  const ty = P(X, y0, top)[1],
    by = P(X, y0, bot)[1];
  // colours follow the island's light, so the fall does not glow at night
  const g = ctx.createLinearGradient(0, ty, 0, by);
  g.addColorStop(0, rgba(night('#6eb9f5', df), 0.95));
  g.addColorStop(0.6, rgba(night('#96cdfa', df), 0.75));
  g.addColorStop(1, rgba(night('#dceeff', df), 0));
  ctx.fillStyle = g;
  quad(y0, y1, top, bot);
  // darker edges give the sheet thickness; light streaks slide down it
  ctx.fillStyle = rgba(night('#3c82c8', df), 0.35);
  quad(y0, y0 + 0.07, top, bot * 0.7);
  quad(y1 - 0.07, y1, top, bot * 0.7);
  for (let i = 0; i < 9; i++) {
    const ya = y0 + 0.06 + (y1 - y0 - 0.16) * ((i * 0.37) % 1),
      p = (t * 0.55 + i * 0.11) % 1,
      za = top - (top - bot) * p;
    ctx.fillStyle = rgba(night('#ffffff', df), 0.75 * (1 - p));
    quad(ya, ya + 0.05, za, za - 14);
  }
  // foam where the pond spills over the lip
  ctx.fillStyle = rgba(night('#ffffff', df), 0.6 + 0.3 * df);
  quad(y0 - 0.05, y1 + 0.05, top + 0.8, top - 1.6);
}

// ---- sky behind the island and weather in front of it (both drawn in CSS px over the whole stage) ----
