// The seasons' still pieces of the office island, baked with the rest of it by web/sky-island.js: the island trees in
// spring (fresh green with pale blossom clusters), summer (deep green), autumn (gold and orange, a few leaves already
// on the lawn) and winter (bare branches with snow on them), the snowmen of winter, the extra flowers of spring and the
// grass tint of a season. The trees keep one round-canopy shape and size all year; only their colours change.
// Everything draws in the scene's logical px through P and takes its colours through C(colour, snowAmount), like
// web/island-art.js, so the island's light and snow reach it too.
import { hash, key } from './island-land.js';
import { blob, linePx, lit3, mix, OUTLINE } from './island-art.js';

// ---- the grass of a season ----
// Every grass colour of the island (the lawn's checker, the lip over the shore, the mountain's skirt) leans toward the
// season's tint by look.grass.mix; a season without a tint keeps C itself.
const GRASS = new Set([
  '#5eae4a',
  '#5aa847',
  '#4f9c40',
  '#3f8535',
  '#356f2d',
  '#62b24e',
  '#55a344',
  '#47903b',
  '#3c7d33',
]);
export function seasonC(C, look) {
  const g = look && look.grass;
  if (!g || !g.color || !g.mix) return C;
  const memo = new Map();
  return (c, s = 0) => {
    if (!GRASS.has(c)) return C(c, s);
    if (!memo.has(c)) memo.set(c, mix(c, g.color, g.mix));
    return C(memo.get(c), s);
  };
}

// ---- the island trees of the four seasons ----
// [left, up, right, down] px round the tree's foot that its sprite needs (web/sky-island.js renderProps).
export const TREE_EXT = [12, 32, 12, 4];
const CANOPY = [
  [-4.5, 1, 5.5, 4.5],
  [4.5, 1.5, 5.5, 4.5],
  [0, -3.5, 6.2, 5.2],
];
const TONES = {
  green: ['#5fb552', '#3e9a45', '#2b7036'],
  fresh: ['#a8e27c', '#7cc95a', '#55a544'],
  gold: ['#f2b134', '#e0703a', '#c0392b'],
};
const BLOSSOM = ['#fde6ef', '#f7c3d8'],
  FALLEN = ['#e0703a', '#f2b134', '#c0392b'];
// The trunk: three px wide from the lawn up `h` px, lit on the left, with the outline either side.
function trunk(pt, C, x, y, h) {
  const ctx = pt.ctx;
  ctx.fillStyle = C(OUTLINE);
  ctx.fillRect(x - 2, y - h, 1, h);
  ctx.fillRect(x + 2, y - h, 1, h);
  ctx.fillStyle = C('#7a5232');
  ctx.fillRect(x - 1, y - h, 1, h);
  ctx.fillStyle = C('#6b4a2a');
  ctx.fillRect(x, y - h, 1, h);
  ctx.fillStyle = C('#4e3420');
  ctx.fillRect(x + 1, y - h, 1, h);
}
// One island tree at its tile d: kind 'fresh' (spring), 'green' (summer), 'gold' (autumn) or 'bare' (winter).
export function drawSeasonTree(pt, P, C, d, kind) {
  const [px, py] = P(d.x + 0.5, d.y + 0.5, 0),
    x = Math.round(px),
    y = Math.round(py),
    ctx = pt.ctx;
  pt.rows(
    x - 6,
    y - 1,
    [
      [1, 11],
      [0, 13],
      [1, 11],
    ],
    'rgba(0,0,0,0.18)',
  );
  if (kind === 'bare') return bareTree(pt, C, d, x, y);
  // a few leaves already down on the lawn round an autumn tree
  if (kind === 'gold')
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = C(FALLEN[i % 3]);
      ctx.fillRect(
        x - 8 + Math.floor(hash(d.x, d.y, 140 + i) * 17),
        y - 2 + Math.floor(hash(d.x, d.y, 150 + i) * 5),
        2,
        1,
      );
    }
  trunk(pt, C, x, y, 11);
  const [l, m, k] = TONES[kind] || TONES.fresh,
    tones = lit3(C(l, 0.25), C(m, 0.15), C(k, 0.1)),
    // snow settles as a cap on the canopy's top, so a snowy tree keeps its own colour underneath
    cap = C(l, 0.95);
  // spring: three or four pale blossom clusters on the canopy; autumn: light flecks where the sun catches it
  const flowers = [];
  if (kind === 'fresh')
    for (let i = 0, n = 3 + (hash(d.x, d.y, 160) > 0.5 ? 1 : 0); i < n; i++)
      flowers.push([Math.round((hash(d.x, d.y, 161 + i) - 0.5) * 12), Math.round(-6 + hash(d.x, d.y, 171 + i) * 7)]);
  blob(
    pt,
    x,
    y - 17,
    CANOPY,
    (u, v, i, j) => {
      for (const [fx, fy] of flowers) {
        const r = Math.abs(i - fx) + Math.abs(j - fy);
        if (r <= 1 || (r === 2 && hash(i, j, 162) > 0.5)) return C(BLOSSOM[(i + j) & 1]);
      }
      if (kind === 'gold' && u + v < 0 && hash(i, j, d.x * 13 + d.y) > 0.9) return C('#ffd98a');
      return v < -0.5 || u + v < -0.85 ? cap : tones(u, v);
    },
    C(OUTLINE),
  );
}
// Winter: a bare trunk forking into a crown of twigs, each branch topped with a line of snow.
const BRANCHES = [
  [0, -12, -5, -19],
  [0, -13, 5, -21],
  [0, -14, 0, -24],
  [-5, -19, -8, -22],
  [-5, -19, -4, -25],
  [5, -21, 8, -24],
  [5, -21, 3, -27],
  [0, -24, -2, -28],
  [0, -24, 2, -29],
  [-3, -16, -7, -16],
];
function bareTree(pt, C, d, x, y) {
  const ctx = pt.ctx,
    flip = hash(d.x, d.y, 180) > 0.5 ? -1 : 1,
    on = new Set(),
    rec = { fillStyle: '', fillRect: (a, b) => on.add(a + ',' + b) };
  for (const [ax, ay, bx, by] of BRANCHES) linePx(rec, [x + ax * flip, y + ay], [x + bx * flip, y + by], '');
  // the outline round the branches first, then the wood, then snow on whatever has open air above it
  ctx.fillStyle = C(OUTLINE);
  for (const p of on) {
    const [a, b] = p.split(',').map(Number);
    for (const [i, j] of [
      [1, 0],
      [-1, 0],
      [0, 1],
    ])
      if (!on.has(a + i + ',' + (b + j))) ctx.fillRect(a + i, b + j, 1, 1);
  }
  trunk(pt, C, x, y, 13);
  ctx.fillStyle = C('#5e4029');
  for (const p of on) {
    const [a, b] = p.split(',').map(Number);
    ctx.fillRect(a, b, 1, 1);
  }
  ctx.fillStyle = C('#f4f8fc');
  for (const p of on) {
    const [a, b] = p.split(',').map(Number);
    if (!on.has(a + ',' + (b - 1)) && hash(a, b, 181) < 0.8) ctx.fillRect(a, b - 1, 1, 1);
  }
  // a little drift of snow against the trunk's foot
  pt.rows(
    x - 3,
    y - 1,
    [
      [1, 5],
      [0, 7],
    ],
    C('#f4f8fc'),
  );
}

// ---- snowmen ----
export const SNOWMAN_EXT = [10, 25, 10, 4];
// A snowman at its tile m ({x, y, look}): three balls of snow lit from the upper left with the outline, coal eyes and
// buttons, a carrot nose, twig arms and, by its look, a red scarf (0), a blue scarf (1) or a top hat (2).
export function drawSnowman(pt, P, C, m) {
  const [px, py] = P(m.x + 0.5, m.y + 0.5, 0),
    x = Math.round(px),
    y = Math.round(py),
    ctx = pt.ctx,
    snow = lit3(C('#ffffff'), C('#e6eef7'), C('#c4d3e6')),
    dot = (a, b, c, w = 1, h = 1) => {
      ctx.fillStyle = C(c);
      ctx.fillRect(x + a, y + b, w, h);
    };
  pt.rows(
    x - 6,
    y - 1,
    [
      [1, 11],
      [0, 13],
      [1, 11],
    ],
    'rgba(40,50,80,0.2)',
  );
  // twig arms behind the middle ball
  linePx(ctx, [x - 4, y - 10], [x - 8, y - 13], C('#5e4029'));
  linePx(ctx, [x + 4, y - 10], [x + 8, y - 14], C('#5e4029'));
  dot(-9, -14, '#5e4029');
  dot(8, -15, '#5e4029');
  blob(pt, x, y - 4, [[0, 0, 5, 4.2]], snow, C(OUTLINE));
  blob(pt, x, y - 10.5, [[0, 0, 3.8, 3.3]], snow, C(OUTLINE));
  blob(pt, x, y - 16, [[0, 0, 3, 2.8]], snow, C(OUTLINE));
  dot(-2, -17, '#2b2838');
  dot(1, -17, '#2b2838');
  dot(0, -16, '#f08a24', 3);
  dot(3, -15, '#c96a1a');
  dot(0, -11, '#2b2838');
  dot(0, -9, '#2b2838');
  dot(0, -5, '#2b2838');
  if (m.look === 2) {
    dot(-4, -19, OUTLINE, 9);
    dot(-3, -24, OUTLINE, 7, 5);
    dot(-2, -23, '#3a3550', 5, 3);
    dot(-2, -21, '#d94a5a', 5);
    dot(-3, -19, '#3a3550', 7);
  } else {
    const c = m.look ? '#3e8ed0' : '#d94a5a',
      dk = m.look ? '#2c6aa0' : '#a83444';
    dot(-3, -14, c, 7);
    dot(-3, -13, dk, 7);
    dot(2, -12, c, 2, 3);
    dot(3, -10, dk);
  }
}

// ---- spring flowers ----
const PETALS = ['#ff9ec4', '#ffffff', '#c9a7f0', '#ffd166'];
// Extra small flowers over open lawn in spring (look.flowers above 1): a yellow heart with four petals, now and then a
// bud beside it, on tiles away from the water, the mountain, the paths, the decor and the office.
export function drawSeasonFlowers(ctx, P, C, island, W, H, look) {
  const extra = look.flowers - 1;
  if (!(extra > 0)) return;
  const busy = new Set([
    ...island.pond.cells,
    ...island.mountain.cells,
    ...island.mountain.pool.cells,
    ...island.paths.cells,
  ]);
  for (const d of island.decor) busy.add(key(d.x, d.y));
  for (const l of island.lamps) busy.add(key(l.x, l.y));
  const near = (x, y) => busy.has(key(x, y)) || busy.has(key(x + 1, y)) || busy.has(key(x, y + 1));
  for (const c of island.list) {
    const { x, y } = c;
    if (c.shore < 1 || (x >= -1 && x <= W + 10 && y >= -1 && y <= H) || near(x, y)) continue;
    if (hash(x, y, 130) >= 0.07 * extra) continue;
    const [px, py] = P(x + 0.3 + hash(x, y, 131) * 0.4, y + 0.3 + hash(x, y, 132) * 0.4, 0),
      X = Math.round(px),
      Y = Math.round(py),
      petal = C(PETALS[Math.floor(hash(x, y, 133) * PETALS.length)]);
    ctx.fillStyle = petal;
    ctx.fillRect(X - 1, Y - 1, 3, 1);
    ctx.fillRect(X, Y - 2, 1, 3);
    ctx.fillStyle = C('#ffcf4a');
    ctx.fillRect(X, Y - 1, 1, 1);
    if (hash(x, y, 134) > 0.5) {
      ctx.fillStyle = petal;
      ctx.fillRect(X + 4, Y + 1, 1, 1);
    }
  }
}

// ---- ice ----
// The lake's and the pool's water colours frozen over: pale ice, lighter in the shallows.
export const ICE = {
  '#62b8ea': '#d6ecf8',
  '#4aa3df': '#bfe0f3',
  '#3b8fcf': '#a6cfe9',
  '#a9dcf7': '#eef8ff',
  '#5FB8F0': '#cfe8f6',
};
export const iceC =
  C =>
  (c, s = 0) =>
    C(ICE[c] || c, s);
// Cracks and drifts of snow on the ice, worked out once per lake (kind: 1 where the layer is open ice) into a palette
// layer's keys: a few cracks wandering across it with a light edge under each, and soft patches of snow.
export function iceDetail(L, kind, W, H, seed) {
  const ice = (x, y) => x >= 0 && y >= 0 && x < W && y < H && kind[y * W + x] === 1,
    spots = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ice(x, y)) spots.push([x, y]);
  if (!spots.length) return;
  const pick = (i, s) => spots[Math.floor(hash(i, seed, s) * spots.length)];
  // snow patches: flat ellipses with a dithered rim
  const nSnow = Math.max(2, Math.round(spots.length / 1500));
  for (let i = 0; i < nSnow; i++) {
    const [cx, cy] = pick(i, 190),
      rx = 5 + hash(i, seed, 191) * 9,
      ry = rx * 0.45;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const r = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (!ice(x, y) || r > 1) continue;
        L.set(x, y, L.key(r > 0.6 ? '#e3edf6' : '#f6f9fc'));
      }
  }
  // cracks: short walks across the ice, mostly sideways, each pixel with a lighter one under it
  const nCrack = Math.max(2, Math.round(spots.length / 2500));
  for (let i = 0; i < nCrack; i++) {
    let [x, y] = pick(i, 192);
    const dir = hash(i, seed, 193) > 0.5 ? 1 : -1,
      len = 14 + Math.floor(hash(i, seed, 194) * 16);
    for (let j = 0; j < len && ice(x, y); j++) {
      L.set(x, y, L.key('#86b4d0'));
      if (ice(x, y + 1)) L.set(x, y + 1, L.key('#f2f9ff'));
      x += dir;
      const h = hash(i * 31 + j, seed, 195);
      if (h < 0.18) y -= 1;
      else if (h > 0.82) y += 1;
      // now and then a short branch off it
      if (h > 0.93 && ice(x, y - 1)) L.set(x, y - 1, L.key('#86b4d0'));
    }
  }
}
