// The event trees by the office (tree.holiday), painted into small canvases and stamped, so a frame draws a tree with
// one drawImage instead of its few hundred rectangles (tests/event-tree-sprite.test.mjs). A tree whose art only steps
// through a few pictures (STEPS: the Christmas tree's lights change twice a second through four pictures; the still
// ones never) is kept per picture; any other is painted afresh when its clock moves, as before.
//   By day the sprite is painted on the scene's own pixel grid at the tree's tile (one per tile), so stamping it puts
//   every pixel where drawing the tree straight onto the scene would.
//   After dark the tinted tree is the same at every tile (the scratch canvas the office always used), one for all.
import { SeasonTree } from './season-tree.js';

// The night tint over event trees, in 1/50 steps of its strength (built once, no string per frame).
const NIGHT_TINT = Array.from({ length: 31 }, (_, i) => 'rgba(13,19,34,' + i / 50 + ')');
const tintOf = dusk => Math.min(NIGHT_TINT.length - 1, Math.round(dusk * 50));
// [the picture at clock t, a clock that draws picture p]
const STILL = [() => 0, () => 0];
export const STEPS = {
  christmas: [t => Math.floor(t * 2) % 4, p => p / 2],
  teachers: STILL,
  default: STILL,
};
// The tree's box round its foot in scene px: 24 left, 48 up, 48 x 58 in all.
const L = 24,
  U = 48,
  BW = 48,
  BH = 58;

// The kept canvases of the current season and tint, per scale (the world view draws its islands at a few), each with
// the picture it holds ({ c, p }); all dropped when the season or the tint changes, or past MAX_SCALES scales.
const byK = new Map(),
  span = { season: '', tint: -1 },
  MAX_SCALES = 8;
const drop = () => {
  for (const kept of byK.values()) for (const s of kept.values()) s.c.width = s.c.height = 0;
  byK.clear();
};
// The canvas kept as `key` at scale k, w x h, or null when it already holds picture p.
function slot(k, key, w, h, p) {
  let kept = byK.get(k);
  if (!kept) {
    if (byK.size >= MAX_SCALES) drop();
    byK.set(k, (kept = new Map()));
  }
  let s = kept.get(key);
  if (!s) kept.set(key, (s = { c: document.createElement('canvas'), p: null }));
  const fresh = s.p !== p || s.c.width !== w || s.c.height !== h;
  if (s.c.width !== w || s.c.height !== h) {
    s.c.width = w;
    s.c.height = h;
  }
  s.p = p;
  return fresh ? s.c : null;
}

// Where and what to stamp for the tree `season` with its foot at scene px (X, Y), at clock t, scale k and night tint
// dusk (0 by day): { img, x, y } in canvas px, or null when the tree is to be drawn straight onto the scene (by day,
// a tree whose clock never stops).
const OUT = { img: null, x: 0, y: 0 };
export function eventTreeSprite(season, X, Y, t, k, dusk) {
  const step = STEPS[season],
    night = dusk >= 0.02;
  if (!step && !night) return null;
  const tint = night ? tintOf(dusk) : 0,
    p = step ? step[0](t) : t,
    at = step ? step[1](p) : t;
  if (span.season !== season || span.tint !== tint) {
    drop();
    span.season = season;
    span.tint = tint;
  }
  if (night) {
    // one for every tile, at the scale's offset (24k, 48k), stamped at the nearest pixel
    // numeric keys, so a frame makes no strings: a picture's own (0..), or -1 for a tree painted afresh
    const key = step ? p : -1,
      c = slot(k, key, Math.ceil(BW * k), Math.ceil(BH * k), p);
    if (c) {
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, c.width, c.height);
      g.setTransform(k, 0, 0, k, L * k, U * k);
      SeasonTree.drawSeasonTree(g, 0, 0, season, at);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = NIGHT_TINT[tint];
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-over';
    }
    OUT.img = byK.get(k).get(key).c;
    OUT.x = Math.round((X - L) * k);
    OUT.y = Math.round((Y - U) * k);
    return OUT;
  }
  // by day: on the scene's pixel grid at this tile
  const x = Math.floor((X - L) * k),
    y = Math.floor((Y - U) * k),
    key = ((p + 1) * 4096 + X + 2048) * 4096 + Y + 2048; // the picture and the tile (scene px, within ±2048)
  const c = slot(k, key, Math.ceil(BW * k) + 2, Math.ceil(BH * k) + 2, p);
  if (c) {
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, X * k - x, Y * k - y);
    SeasonTree.drawSeasonTree(g, 0, 0, season, at);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  OUT.img = byK.get(k).get(key).c;
  OUT.x = x;
  OUT.y = y;
  return OUT;
}
