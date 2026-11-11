// Winter's snow painted into the island's bake (web/sky-island.js), so it costs nothing per frame: the snow lying on
// the lawn with its ripples and drifts, the snow hanging over the island's edge with its icicles, and a cap of snow
// for whatever stands on the lawn. Where things are comes from web/snow-logic.js. S maps a snow colour through the
// bake's light (bakeTools); depth is SnowLogic.depth of the snow cover (1 thin, 2 medium, 3 deep).
import { hash } from './island-grid.js';
import { SnowLogic } from './snow-logic.js';
import { mix } from './island-art.js';

const { PAL } = SnowLogic;
const ICE = '#cfe9f8';
// The colour of a lawn tile under snow: a thin cover lets the grass through.
export const snowTile = (S, grass, x, y, depth) => {
  const c = S((x + y) % 2 ? PAL.base : mix(PAL.base, PAL.shade, 0.14));
  return depth === 1 ? mix(grass, c, 0.72) : c;
};

// A mound of snow, its foot at (px, py): rows widening downward, lit on top, shaded at the foot, w px wide at the
// foot and h px high.
function mound(ctx, S, px, py, w, h) {
  px = Math.round(px);
  py = Math.round(py);
  for (let i = 0; i < h; i++) {
    const f = (i + 1) / h,
      rw = Math.max(2, Math.round(w * Math.sqrt(f)));
    ctx.fillStyle = S(i === 0 ? PAL.glint : i < h * 0.45 ? PAL.lit : i < h - 1 ? PAL.base : PAL.shade);
    ctx.fillRect(px - Math.floor(rw / 2), py - h + i, rw, 1);
  }
  ctx.fillStyle = S(PAL.rim);
  ctx.fillRect(px - Math.floor(w / 2) + 1, py, w - 2, 1);
}

// Over the lawn's tiles (the water and the mountain are painted after it): low ripples of light and shade, grass tips
// through a thin cover, a glint here and there, and the drifts.
export function drawSnowLawn(pt, P, S, C, island, block, depth) {
  const { ctx } = pt,
    // tiles the office, the lake or the mountain cover anyway are skipped
    covered = new Set([...island.pond.cells, ...island.mountain.cells]),
    inside = (x, y) => (block && x >= 0 && y >= 0 && x < block.W && y < block.H) || covered.has(x + ',' + y),
    lit = S(PAL.lit),
    shade = S(PAL.shade),
    tip = C('#7d9550'),
    glint = S(PAL.glint);
  for (const { x, y } of island.list) {
    if (inside(x, y)) continue;
    for (let i = 0; i < 2; i++) {
      const [px, py] = P(x + 0.2 + 0.6 * hash(x, y, 241 + i), y + 0.2 + 0.6 * hash(x, y, 251 + i), 0),
        w = 3 + Math.floor(hash(x, y, 261 + i) * 4),
        rx = Math.round(px - w / 2),
        ry = Math.round(py);
      ctx.fillStyle = shade;
      ctx.fillRect(rx, ry, w, 1);
      ctx.fillStyle = lit;
      ctx.fillRect(rx + 1, ry - 1, w - 1, 1);
    }
    if (depth === 1 || hash(x, y, 271) < 0.12) {
      const [px, py] = P(x + 0.5 + 0.3 * (hash(x, y, 272) - 0.5), y + 0.5 + 0.3 * (hash(x, y, 273) - 0.5), 0);
      ctx.fillStyle = tip;
      ctx.fillRect(Math.round(px), Math.round(py) - 2, 1, 2);
      if (depth === 1) ctx.fillRect(Math.round(px) + 2, Math.round(py) - 1, 1, 1);
    } else if (hash(x, y, 274) < 0.1) {
      const [px, py] = P(x + 0.5, y + 0.5, 0);
      ctx.fillStyle = glint;
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
  }
  if (depth < 2 || !block) return;
  for (const d of SnowLogic.drifts(island, block.W, block.H)) {
    // against the office the drift leans on the foundation; elsewhere it lies round the thing's foot
    const wall = d.side === 'wall',
      [px, py] = P(d.x + (wall && d.x >= block.W ? 0.22 : 0.5), d.y + (wall && d.y >= block.H ? 0.22 : 0.5), 0),
      h = d.h * 2 + (depth === 3 ? 2 : 0);
    mound(ctx, S, px, py + (wall ? 1 : 3), wall ? 22 : d.side === 'tree' ? 16 : 11, wall ? h + 1 : h);
  }
}

// The snow over the island's two near edges: a white lip hanging lower than the grass lip did, a rim of shade under
// it. `bare` is the tile the main fall pours over.
export function drawSnowEdge(pt, P, S, island, depth, bare) {
  const has = (x, y) => island.cells.has(x + ',' + y);
  for (const { x, y } of island.list)
    for (const plane of ['y', 'x']) {
      if (plane === 'y' ? has(x, y + 1) : has(x + 1, y)) continue;
      if (bare && plane === 'y' && x === bare.x && y === bare.y) continue;
      const lit = plane === 'y',
        at = (t, z) => (lit ? P(x + t, y + 1.04, z) : P(x + 1.04, y + t, z)),
        wave = [];
      for (let i = 0; i <= 4; i++) {
        const t = i / 4,
          u = lit ? x + t : y + t;
        wave.push(at(t, -(depth + 1.5 + 1.5 * Math.sin(u * 2.3 + (lit ? y : x)))));
      }
      pt.poly([at(0, 1), at(1, 1), ...wave.slice().reverse()], S(lit ? PAL.lit : PAL.base), true);
      pt.poly([...wave, ...wave.map(([a, b]) => [a, b + 1]).reverse()], S(PAL.rim));
    }
}

// Icicles under that lip (drawn on the finished island, outside its outline): thin, pale blue, a bright pixel at the
// root. A medium cover has every other one, shorter.
export function drawIcicles(ctx, P, S, island, depth) {
  if (depth < 2) return;
  const ice = S(ICE),
    lit = S(PAL.glint);
  SnowLogic.icicles(island).forEach(({ x, y, plane, t, len }, i) => {
    if (depth === 2 && i % 2) return;
    const l = depth === 2 ? Math.max(2, Math.round(len * 0.6)) : len,
      [px, py] = plane === 'y' ? P(x + t, y + 1.04, -depth - 2) : P(x + 1.04, y + t, -depth - 2),
      rx = Math.round(px),
      ry = Math.round(py);
    ctx.fillStyle = ice;
    ctx.fillRect(rx, ry, 1, l);
    if (l > 4) ctx.fillRect(rx + 1, ry, 1, Math.floor(l / 2));
    ctx.fillStyle = lit;
    ctx.fillRect(rx, ry, 1, 1);
  });
}

// A cap of snow on top of something: a row w px wide whose left end is at (x, y), 1 to 3 px thick with the depth, lit
// on top with a rim of shade under it. Drawn with plain rectangles so the per-frame drawing can use it too.
export function snowCap(R, S, x, y, w, depth) {
  if (depth < 1 || w < 2) return;
  const h = depth;
  R(x, y - h, w, h, S(PAL.base));
  R(x + 1, y - h - 1, w - 2, 1, S(PAL.lit));
  R(x, y, w, 1, S(PAL.rim));
}

// Snow settling on a finished sprite (a bush, a lamp, the bench, a tree, the pavilion): every upper edge of the
// sprite is whitened, a few pixels deep by the depth, lit along the very top. Done once at the bake by compositing
// (the sprite minus itself moved down leaves its upper edges), with no pixels read back, so it follows whatever
// shape was drawn and stays cheap. k is canvas px to an art px.
let scratch = null;
function upperEdge(img, px, colour) {
  const s = scratch || (scratch = document.createElement('canvas'));
  if (s.width < img.width || s.height < img.height) {
    s.width = Math.max(s.width, img.width);
    s.height = Math.max(s.height, img.height);
  }
  const g = s.getContext('2d');
  g.globalCompositeOperation = 'copy';
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(img, 0, px);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = colour;
  g.fillRect(0, 0, img.width, img.height);
  return s;
}
export function snowOnTop(img, k, S, depth) {
  if (depth < 1 || !img.width || !img.height) return;
  const g = img.getContext('2d'),
    w = img.width,
    h = img.height;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(upperEdge(img, Math.max(1, Math.round(depth * k)), S(PAL.base)), 0, 0, w, h, 0, 0, w, h);
  g.drawImage(upperEdge(img, Math.max(1, Math.round(k)), S(PAL.lit)), 0, 0, w, h, 0, 0, w, h);
  g.restore();
}
