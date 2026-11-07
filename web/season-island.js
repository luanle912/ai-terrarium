// Where the seasons put things on the office island, and how what falls through the air moves (no DOM, no canvas):
// the tiles the winter snowmen stand on, the few trees by the office that turn into holiday trees, the slow breeze of
// autumn and the falling petals, leaves and snowflakes. Pure and deterministic (tests/season-island.test.mjs): tiles
// come from the island data and hash(), particles from time alone, so every machine shows the same island.
// web/island-art-season.js draws the still pieces into the island bake, web/island-season-life.js the moving ones.
import { hash, key, N4 } from './island-grid.js';

const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
// Distance (tiles) from a tile's middle to the office block (x 0..W, y 0..H).
const toOffice = (x, y, W, H) => Math.hypot(Math.max(0, -x, x + 1 - W), Math.max(0, -y, y + 1 - H));

// ---- winter snowmen ----
// Two or three snowmen on open lawn near the office and the lake, never on or beside a garden path, the water, the
// mountain, a tree, a bush, a lamp, the rest corner or where someone bathes, never on the shore or by the office
// block's annexes, and at least SNOWMAN_GAP tiles apart. The first goes by the lake, the others by the office.
const SNOWMAN_GAP = 5;
function snowmanTiles(island, W, H, n = 3) {
  const blocked = new Set([
    ...island.pond.cells,
    ...island.mountain.cells,
    ...island.mountain.pool.cells,
    ...island.paths.cells,
  ]);
  for (const d of island.decor) if (d.kind !== 'flower') blocked.add(key(d.x, d.y));
  const people = [island.rest.bench, island.rest.fish, ...island.lamps, ...island.pond.spots];
  const lake = [...island.pond.cells].map(k => k.split(',').map(Number)),
    lx = lake.reduce((s, [x]) => s + x, 0) / lake.length,
    ly = lake.reduce((s, [, y]) => s + y, 0) / lake.length;
  const open = [];
  for (const c of island.list) {
    const { x, y } = c;
    if (c.shore < 2 || (x >= -2 && x <= W + 11 && y >= -2 && y <= H + 1)) continue;
    if (blocked.has(key(x, y)) || N8.some(([a, b]) => blocked.has(key(x + a, y + b)))) continue;
    if (people.some(p => Math.abs(p.x - x) <= 2 && Math.abs(p.y - y) <= 2)) continue;
    open.push({ x, y, lake: Math.hypot(x - lx, y - ly), office: toOffice(x, y, W, H), h: hash(x, y, 101) });
  }
  const out = [],
    far = t => out.every(o => Math.hypot(o.x - t.x, o.y - t.y) >= SNOWMAN_GAP),
    take = by => {
      const t = open
        .filter(far)
        .sort((a, b) => a[by] - b[by] || a.h - b.h)
        .find(Boolean);
      if (t) out.push(t);
    };
  take('lake');
  while (out.length < n && open.some(far)) take('office');
  // each wears its own look (0..2: scarf colour, hat or none)
  return out.map(({ x, y }, i) => ({ x, y, look: (i + Math.floor(hash(x, y, 102) * 3)) % 3 }));
}

// ---- holiday trees ----
// On a holiday the n trees nearest the office turn into the holiday's tree; the rest of the island keeps its season.
function holidayTrees(island, W, H, n = 3) {
  return new Set(
    island.decor
      .filter(d => d.kind === 'tree')
      .map(d => ({ d, r: toOffice(d.x, d.y, W, H) }))
      .sort((a, b) => a.r - b.r || a.d.x + a.d.y - (b.d.x + b.d.y) || a.d.x - b.d.x)
      .slice(0, n)
      .map(({ d }) => key(d.x, d.y)),
  );
}

// ---- the breeze ----
// Direction of the autumn breeze, -1 (toward screen left) .. 1 (right): one steady way for a minute or more, turning
// slowly round through calm to the other way and back.
const breeze = t => Math.sin(t * 0.035 + 0.8 * Math.sin(t * 0.011));

// ---- what falls ----
// A fixed number of particles per kind (FALL_N). Each falls from its own height to the lawn over LIFE seconds, again
// and again, starting at its own phase: some leave the trees' canopies, the rest come down out of the sky over the
// island. Positions come from time alone, so nothing is stored or allocated per frame.
const FALL_N = { petals: 30, leaves: 200, snow: 200 };
const LIFE = { petals: 11, leaves: 7.5, snow: 12 };
const MAX_N = Math.max(...Object.values(FALL_N));
const seedsOf = new WeakMap();
// The particles' places on the island: x, y the tile point they land on, z0 the height (px) they start at, ph their
// phase 0..1, c a colour index 0..2, tree whether they leave a canopy. Worked out once per island.
function fallSeeds(island) {
  if (seedsOf.has(island)) return seedsOf.get(island);
  const trees = island.decor.filter(d => d.kind === 'tree'),
    land = island.list.filter(c => c.shore > 0),
    { minX, maxX, minY, maxY } = island.bounds;
  const seeds = Array.from({ length: MAX_N }, (_, i) => {
    const tree = trees.length && i % 3 !== 2,
      a = hash(i, 3, 110),
      b = hash(i, 4, 111);
    let x, y;
    if (tree) {
      const t = trees[Math.floor(hash(i, 5, 112) * trees.length)];
      x = t.x + 0.5 + (a - 0.5) * 1.2;
      y = t.y + 0.5 + (b - 0.5) * 1.2;
    } else {
      const c = land[Math.floor(hash(i, 6, 113) * land.length)];
      x = c.x + a;
      y = c.y + b;
    }
    // snow spreads over the whole island's box, past the shore too: it falls on into the sky below
    const sx = minX + hash(i, 7, 114) * (maxX - minX),
      sy = minY + hash(i, 8, 115) * (maxY - minY);
    return {
      x,
      y,
      sx,
      sy,
      z0: tree ? 18 + hash(i, 9, 116) * 8 : 55 + hash(i, 9, 116) * 45,
      ph: hash(i, 10, 117),
      sp: 0.85 + hash(i, 11, 118) * 0.3,
      c: Math.floor(hash(i, 12, 119) * 3),
      tree,
    };
  });
  seedsOf.set(island, seeds);
  return seeds;
}
// The particles of one kind at time t (seconds), written into `out` (made by fallBuffer, reused every frame):
// out.n of out.p[i] = {x, y (tiles), z (px above the lawn), dx (px of drift across the screen), a (0..1), c, flip}.
// wind (0..1) times breeze(t) blows them sideways; still (reduced motion) stops them where they are at t = 0.
const fallBuffer = () => ({
  n: 0,
  kind: null,
  p: Array.from({ length: MAX_N }, () => ({ x: 0, y: 0, z: 0, dx: 0, a: 0, c: 0, flip: 0 })),
});
function fallStep(out, island, kind, t, wind, still) {
  const n = FALL_N[kind] || 0,
    seeds = fallSeeds(island),
    life = LIFE[kind] || 10,
    tt = still ? 0 : t,
    dir = breeze(tt);
  out.n = n;
  out.kind = kind;
  for (let i = 0; i < n; i++) {
    const s = seeds[i],
      o = out.p[i],
      p = (tt / (life * s.sp) + s.ph) % 1,
      snow = kind === 'snow';
    o.x = snow ? s.sx : s.x;
    o.y = snow ? s.sy : s.y;
    o.z = (snow ? s.z0 + 40 : s.z0) * (1 - p);
    // a flutter for petals and leaves, a slow wobble for snow, plus the breeze's drift that grows as they fall
    const sway = snow ? 1.5 : kind === 'leaves' ? 4 : 3;
    o.dx = Math.sin(tt * (snow ? 0.9 : 1.7) * s.sp + s.ph * 6.283) * sway + wind * dir * 70 * p;
    o.a = Math.min(1, p / 0.08, (1 - p) / 0.12);
    o.c = s.c;
    o.flip = Math.sin(tt * 3.1 * s.sp + s.ph * 9) > 0 ? 1 : 0;
  }
  return out;
}

export const SeasonIsland = {
  SNOWMAN_GAP,
  FALL_N,
  snowmanTiles,
  holidayTrees,
  breeze,
  fallSeeds,
  fallBuffer,
  fallStep,
};
