// Winter's snow as logic (no DOM, no canvas; tests/snow-logic.test.mjs): how deep it lies for a snow cover, its
// colours, where it drifts and where icicles hang off the island's edge, and the footprints people and dogs leave.
// Everything about a place comes from the island data and hash(), so every machine shows the same island.
import { hash, key } from './island-grid.js';

// 0 none, 1 thin (grass tips show, no drifts), 2 medium (covered, low drifts), 3 deep (high drifts, long icicles).
// Winter's lasting cover (SeasonLogic minSnow 0.65) is medium. The island is baked per tenth of the cover, so the
// depth is read off that tenth: it changes at three of those steps, never needs a bake of its own, and what is drawn
// every frame (walls, roofs) always agrees with the baked lawn.
const depth = snow => {
  const b = Math.round(snow * 10);
  return b < 2 ? 0 : b < 5 ? 1 : b < 9 ? 2 : 3;
};

// White with blue shade. NIGHT_K: after dark snow is dimmed this share of what the grass is, so the island's night
// is pale blue rather than grey.
const PAL = { lit: '#f6f9fc', base: '#e6eef6', shade: '#c3d3e6', rim: '#9fb4cf', glint: '#ffffff' };
const NIGHT_K = 0.7;
// Snow through the light (df 1 day .. 0 night): after dark it goes toward a moonlit blue rather than the lawn's
// near-black, so a snowy night is pale blue, not grey.
const MOON = [40, 62, 122];
function night(c, df) {
  const p = (1 - df) * NIGHT_K * 0.6;
  if (!(p > 0)) return c;
  let out = '#';
  for (let i = 0; i < 3; i++) {
    const v = Math.round(parseInt(c.slice(1 + i * 2, 3 + i * 2), 16) * (1 - p) + MOON[i] * p);
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}

// Where snow piles up: at the foot of the office (the lawn tiles along its two near sides), round the trees, behind
// rocks and behind the bench. [{ x, y, h, side }], h 1..3 (drawn 2 px a step). Never on a path, the water, the office
// or where someone stands.
function drifts(island, W, H) {
  const no = new Set([
    ...island.paths.cells,
    ...island.pond.cells,
    ...island.mountain.cells,
    ...island.mountain.pool.cells,
  ]);
  for (const p of [...island.pond.spots, island.rest.bench, island.rest.fish, ...island.lamps]) no.add(key(p.x, p.y));
  const out = [],
    seen = new Set(),
    add = (x, y, h, side) => {
      const k = key(x, y);
      if (seen.has(k) || no.has(k) || !island.cells.has(k) || (x >= 0 && y >= 0 && x < W && y < H)) return;
      seen.add(k);
      out.push({ x, y, h, side });
    };
  for (let x = 0; x < W; x++) if (hash(x, H, 211) < 0.6) add(x, H, 1 + Math.floor(hash(x, H, 212) * 3), 'wall');
  for (let y = 0; y < H; y++) if (hash(W, y, 211) < 0.6) add(W, y, 1 + Math.floor(hash(W, y, 212) * 3), 'wall');
  for (const d of island.decor) {
    if (d.kind === 'tree') add(d.x, d.y, 1 + Math.floor(hash(d.x, d.y, 213) * 2), 'tree');
    if (d.kind === 'rock') add(d.x, d.y, 1, 'rock');
  }
  const b = island.rest.bench;
  add(b.x - 1, b.y, 1, 'bench');
  add(b.x, b.y - 1, 1, 'bench');
  return out;
}

// Icicles under the snow that hangs over the island's two near edges: [{ x, y, plane, t, len }], on the tile's
// y + 1 edge (plane 'y') or x + 1 edge ('x'), t of the way along it, len 2..7 px.
function icicles(island) {
  const out = [];
  for (const { x, y } of island.list)
    for (const plane of ['y', 'x']) {
      if (island.cells.has(plane === 'y' ? key(x, y + 1) : key(x + 1, y))) continue;
      const s = plane === 'y' ? 221 : 231,
        n = hash(x, y, s) < 0.35 ? 2 : hash(x, y, s) < 0.8 ? 1 : 0;
      for (let i = 0; i < n; i++)
        out.push({
          x,
          y,
          plane,
          t: Math.round((0.15 + 0.7 * hash(x + i * 7, y, s + 1)) * 100) / 100,
          len: 2 + Math.floor(hash(x, y + i * 5, s + 2) * 6),
        });
    }
  return out;
}

// Footprints: a ring of PRINTS places and the time each was made, written in place (nothing allocated after
// prints()). A print fades over PRINT_LIFE seconds.
const PRINTS = 48,
  PRINT_LIFE = 12;
const prints = () => ({
  n: 0,
  at: 0,
  x: new Float32Array(PRINTS),
  y: new Float32Array(PRINTS),
  t: new Float64Array(PRINTS),
});
function addPrint(buf, x, y, now) {
  buf.x[buf.at] = x;
  buf.y[buf.at] = y;
  buf.t[buf.at] = now;
  buf.at = (buf.at + 1) % PRINTS;
  if (buf.n < PRINTS) buf.n++;
}

// Someone (a person or a dog, o.x / o.y in tiles) moving over ground where `onLawn` says prints show: one print for
// every half tile walked. o.px / o.py remember where the last one was; a jump (a new place) leaves none.
function walkPrint(buf, o, onLawn, now) {
  const far = o.px == null ? Infinity : Math.hypot(o.x - o.px, o.y - o.py);
  if (far < 0.5) return;
  if (far <= 3 && onLawn(o.x, o.y)) addPrint(buf, o.x, o.y, now);
  o.px = o.x;
  o.py = o.y;
}

export const SnowLogic = {
  depth,
  PAL,
  NIGHT_K,
  night,
  drifts,
  icicles,
  prints,
  addPrint,
  walkPrint,
  PRINTS,
  PRINT_LIFE,
};
