// The two-peak mountain on the back lawn and the small pool at its foot, baked into the island image by
// web/sky-island.js: the mountain on the land canvas (so the island's outline rings it too), the pool over it. Both
// draw in the scene's logical px through P (the lawn level projection) and take their colours through C(colour,
// snowAmount), like the rest of web/island-art.js. The fall from the gap between the peaks into the pool, its foam and
// rings move in web/island-life.js.
import { hash, N4, WATER_Z } from './island-land.js';
import { mix, OUTLINE, pixelLayer, rgbOf, stamp, STONE } from './island-art.js';

// ---- the mountain ----
// Each peak is a rocky cone of flat faces: a ring of SIDES points on the lawn, a smaller ring turned half a step at
// MID of its height, and the tip. The radii waver from point to point, so the faces catch the light differently; the
// lawn ring is pulled in wherever the way out to it would leave the mountain's tiles (the pool's cove, the shore), so
// the stone never spans the water or overhangs the edge. Points are [x, y, z]: x and y in tiles, z in px. Cached per
// island.
// The rock of the gap between the peaks (island.mountain.gap), where the falls pour out, stands behind both of them.
const SIDES = 9,
  MID = 0.45,
  shapes = new WeakMap();
function mountainShape(island) {
  const m = island.mountain;
  if (!m) return null;
  if (shapes.has(m)) return shapes.get(m);
  const inM = (x, y) => m.cells.has(Math.floor(x) + ',' + Math.floor(y));
  const cones = m.peaks
    .map((p, j) => {
      const x = p.x + 0.5,
        y = p.y + 0.5,
        R = p.R,
        tip = [x + (hash(j, 1, 60) - 0.5) * 0.4, y + (hash(j, 2, 60) - 0.5) * 0.4, p.h],
        base = [],
        radii = [],
        mid = [];
      for (let i = 0; i < SIDES; i++) {
        const a = ((i + 0.3 * j) / SIDES) * Math.PI * 2,
          // whether the ray out to r leaves the mountain anywhere (it must not reach across the pool)
          leaves = r => {
            for (let s = 0.25; s < r + 0.01; s += 0.25) if (!inM(x + Math.cos(a) * s, y + Math.sin(a) * s)) return true;
            return false;
          };
        let r = R * (0.82 + 0.3 * hash(i, j, 61));
        while (r > 1 && leaves(r)) r -= 0.25;
        radii.push(r);
        base.push([x + Math.cos(a) * r, y + Math.sin(a) * r, 0]);
      }
      // the middle ring stays well inside the lawn ring, even where that was pulled in
      for (let i = 0; i < SIDES; i++) {
        const b = ((i + 0.5 + 0.3 * j) / SIDES) * Math.PI * 2,
          rm = Math.min(R * (0.32 + 0.17 * hash(i, j, 62)), 0.62 * Math.min(radii[i], radii[(i + 1) % SIDES]));
        mid.push([x + Math.cos(b) * rm, y + Math.sin(b) * rm, p.h * MID * (0.85 + 0.3 * hash(i, j, 64))]);
      }
      // the faces, each [a, b, c, tier, i]: two per side from the lawn ring to the middle ring, one from it to the tip
      const faces = [];
      for (let i = 0; i < SIDES; i++) {
        const n = (i + 1) % SIDES;
        faces.push([base[i], base[n], mid[i], 0, i], [base[n], mid[n], mid[i], 0, i], [mid[i], mid[n], tip, 1, i]);
      }
      return { x, y, h: p.h, tip, base, mid, faces };
    })
    .sort((a, b) => a.x + a.y - (b.x + b.y));
  shapes.set(m, cones);
  return cones;
}
// The light comes from the front-left and above: faces turned toward y + 1 are lit, toward x + 1 shaded.
const LIGHT = (() => {
  const v = [-0.35, 0.8, 0.5],
    n = Math.hypot(...v);
  return v.map(c => c / n);
})();
// The upward normal of a flat face through three points, in px (a tile is 16 px across).
function normalOf(a, b, c) {
  const u = [(b[0] - a[0]) * 16, (b[1] - a[1]) * 16, b[2] - a[2]],
    v = [(c[0] - a[0]) * 16, (c[1] - a[1]) * 16, c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
    l = Math.hypot(...n) * Math.sign(n[2] || 1) || 1;
  return n.map(q => q / l);
}
const tone = n => {
  const b = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
  return b > 0.74 ? 0 : b > 0.5 ? 1 : b > 0.26 ? 2 : 3;
};
// The camera looks down along -(1, 1, 1) in px: a face turned away from it is hidden behind the cone's front.
const seen = n => n[0] + n[1] + n[2] > 0;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// The cones, the back one first. Every face is stone in one of three tones by the way it turns to the light (the
// lower ring is never in the lightest one); grass climbs the foot in a wavy skirt, snow covers the top when the
// island is snowed on, and a light seam runs down the front ridges where a lit face meets a shaded one. The rock of
// the gap the falls pour out of goes in among them by depth.
export function drawMountain(pt, P, C, island, snow) {
  const cones = mountainShape(island);
  if (!cones) return;
  const gap = island.mountain.gap;
  let rock = false;
  const stone = [STONE.light, STONE.mid, STONE.dark, STONE.deep],
    grass = ['#62b24e', '#55a344', '#47903b', '#3c7d33'],
    snowy = ['#f6f9fb', '#e6eef7', '#d3e0f0', '#c4d4ea'],
    face = (pts, col) =>
      pt.poly(
        pts.map(v => P(...v)),
        col,
        true,
      );
  for (const c of cones) {
    if (!rock && c.x + c.y > gap.x + gap.y) {
      drawGap(pt, P, C, gap);
      rock = true;
    }
    const faces = c.faces
      .map(f => ({ f, n: normalOf(f[0], f[1], f[2]) }))
      .filter(({ n }) => seen(n))
      .sort((a, b) => a.f[0][0] + a.f[0][1] - (b.f[0][0] + b.f[0][1]));
    for (const { f, n } of faces) {
      const t = tone(n);
      face(f.slice(0, 3), C(stone[f[3] ? t : Math.max(1, t)], 0.2));
    }
    // the grass skirt on the lower faces and the snow cap on the upper ones, side by side round the cone
    for (let i = 0; i < SIDES; i++) {
      const j = (i + 1) % SIDES,
        n = normalOf(c.base[i], c.base[j], c.mid[i]),
        un = normalOf(c.mid[i], c.mid[j], c.tip);
      if (seen(n)) {
        // the skirt reaches 5-13 px up a full-size peak, less up a small one
        const up = (k, s) => lerp3(c.base[k], c.mid[k], (s * Math.min(1, c.h / 50)) / c.mid[k][2]),
          sm = 3 + 6 * hash(i, c.h, 66),
          middle = lerp3(up(i, sm), up(j, sm), 0.5);
        face(
          [
            c.base[i],
            lerp3(c.base[i], c.base[j], 0.5),
            c.base[j],
            up(j, 5 + 8 * hash(j, c.h, 63)),
            middle,
            up(i, 5 + 8 * hash(i, c.h, 63)),
          ],
          C(grass[tone(n)], 0.85),
        );
      }
      if (snow > 0.05 && seen(un)) {
        const line = k => lerp3(c.mid[k], c.tip, 0.28 + 0.14 * hash(k, c.h, 65)),
          dip = lerp3(line(i), line(j), 0.5);
        dip[2] -= 3;
        face([line(i), dip, line(j), c.tip], C(mix(stone[tone(un)], snowy[tone(un)], Math.min(1, snow * 1.3))));
      }
    }
    // a light seam down the front ridges, from the tip to the middle ring
    for (let i = 0; i < SIDES; i++) {
      const p = (i + SIDES - 1) % SIDES,
        a = normalOf(c.mid[p], c.mid[i], c.tip),
        b = normalOf(c.mid[i], c.mid[(i + 1) % SIDES], c.tip);
      if (!seen(a) || !seen(b) || tone(a) >= tone(b) || c.mid[i][0] + c.mid[i][1] < c.x + c.y) continue;
      const q = P(...c.mid[i]),
        r = P(...c.tip);
      pt.poly([q, [q[0] + 1, q[1]], [r[0] + 1, r[1]], r], C(mix(STONE.light, '#ffffff', 0.3), 0.5));
    }
  }
  if (!rock) drawGap(pt, P, C, gap);
}
// The rock of the gap between the peaks: a craggy saddle across the back of the pool, just behind the water
// sheet, with a notch at the sheet's top (gap.z px up) where the water spills, crags either side sloping down into the
// peaks' flanks, and a dark wet streak behind the water, so the falls always have stone behind them.
function drawGap(pt, P, C, gap) {
  const x0 = gap.x - gap.w,
    x1 = gap.x + gap.w,
    Y = gap.y - 0.04,
    back = gap.y - 0.6,
    t = gap.z,
    xs = [x0 - 1.3, x0 - 0.9, x0 - 0.4, x0 - 0.08, x0, x1, x1 + 0.08, x1 + 0.4, x1 + 1.3, x1 + 2],
    zs = [0, 3, t - 3, t + 3, t, t, t + 3, t + 1, t - 2, t - 8],
    front = xs.map((x, i) => P(x, Y, zs[i])),
    rear = xs.map((x, i) => P(x, back, zs[i] - 1));
  pt.poly([P(xs[0], Y, WATER_Z), ...front, P(xs[xs.length - 1], Y, WATER_Z)], C(STONE.mid, 0.15), true);
  pt.poly([P(xs[4], Y, WATER_Z), front[4], front[5], P(xs[5], Y, WATER_Z)], C(STONE.deep));
  for (let i = 0; i < xs.length - 1; i++)
    pt.poly([front[i], front[i + 1], rear[i + 1], rear[i]], C(i === 4 ? STONE.dark : STONE.light, 0.6), true);
}

// ---- the pool at the mountain's foot ----
// The small pool the mountain fall drops into (island.mountain.pool, a block of tiles in a cove of the rock), painted
// in whole pixels on a layer of its own like the lake: water sunk WATER_Z below the lawn in a block with rounded
// corners, pale rim stones (a darker one here and there) round its three open sides, ringed with the outline, and a
// few flecks of foam where the falls land. Its back side has no rim: the rock of the gap stands there and the falls
// pour in over it. Every pixel is looked at twice, at the lawn's level and at the water's: water where the water
// level is in, the far bank (wet rock) where only the lawn level is.
const POOL_RIM = 0.24, // tiles of stone on the open sides
  POOL_ROUND = 4, // how square the corners are (the power of a superellipse)
  POOL_C = { stone: '#D9D2C4', dot: '#A89F94', water: '#5FB8F0', deep: '#4aa3df', foam: '#FFFFFF', bank: '#545268' };
// inside a block with rounded corners, from xa to xb and ya to yb (tiles)
const inBlock = (x, y, xa, xb, ya, yb) => {
  const u = (2 * x - xa - xb) / (xb - xa),
    v = (2 * y - ya - yb) / (yb - ya);
  return Math.abs(u) ** POOL_ROUND + Math.abs(v) ** POOL_ROUND <= 1;
};
// The pool's shape on the lawn (pure; tests/island-art.test.mjs): its tiles' box x0..x1, y0..y1 (the falls stand on
// its back edge y0), foot(x, y) whether a point (tiles) is inside its rim, wet(x, y) whether it is on the water. Both
// stop at the back edge; null without a pool.
export function poolShape(island) {
  const m = island.mountain;
  if (!m || !m.pool.cells.size) return null;
  const tiles = [...m.pool.cells].map(k => k.split(',').map(Number)),
    x0 = Math.min(...tiles.map(t => t[0])),
    x1 = Math.max(...tiles.map(t => t[0])) + 1,
    y0 = Math.min(...tiles.map(t => t[1])),
    y1 = Math.max(...tiles.map(t => t[1])) + 1;
  // the block runs a little past the back edge, so its back corners are hidden under the rock
  return {
    x0,
    x1,
    y0,
    y1,
    foot: (x, y) => y >= y0 && inBlock(x, y, x0, x1, y0 - 0.3, y1),
    wet: (x, y) => y >= y0 && inBlock(x, y, x0 + POOL_RIM, x1 - POOL_RIM, y0 - 0.3, y1 - POOL_RIM),
  };
}
export function drawPool(pt, P, C, island) {
  const m = island.mountain,
    sh = poolShape(island);
  if (!sh) return;
  const { x0, x1, y0, y1, foot, wet } = sh;
  const [OX, OY] = P(0, 0, 0),
    sx0 = Math.floor(OX + (x0 - y1) * 16) - 2,
    sx1 = Math.ceil(OX + (x1 - y0) * 16) + 2,
    sy0 = Math.floor(OY + (x0 + y0) * 8) - 2,
    sy1 = Math.ceil(OY + (x1 + y1) * 8) + 6,
    W = sx1 - sx0,
    H = sy1 - sy0,
    L = pixelLayer(W, H),
    rgb = rgbOf(C),
    kind = new Uint8Array(W * H); // 0 nothing, 1 water, 2 bank, 3 rim stone
  const lawnAt = (sx, sy, z) => {
    const a = (sx + 0.5 - OX) / 16,
      b = (sy + 0.5 - OY + z) / 8;
    return [(a + b) / 2, (b - a) / 2];
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [ax, ay] = lawnAt(sx0 + x, sy0 + y, 0),
        [bx, by] = lawnAt(sx0 + x, sy0 + y, WATER_Z);
      // nothing behind the back edge (the rock of the gap); under it, the bank is wet rock
      if (wet(ax, ay)) kind[y * W + x] = wet(bx, by) ? 1 : 2;
      else if (foot(ax, ay)) kind[y * W + x] = 3;
    }
  const rimAt = (x, y) => x >= 0 && y >= 0 && x < W && y < H && kind[y * W + x] === 3;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        k = kind[i];
      if (k === 1) L.set(x, y, rgb(y > 0 && kind[i - W] === 2 ? POOL_C.deep : POOL_C.water, 0.6));
      else if (k === 2) L.set(x, y, rgb(POOL_C.bank, 0.3));
      else if (k === 3) L.set(x, y, rgb(hash(x, y, 90) < 0.2 ? POOL_C.dot : POOL_C.stone, 0.8));
      // the outline round the rim, except along the back where the pool meets the rock
      else if (N4.some(([a, b]) => rimAt(x + a, y + b)) && lawnAt(sx0 + x, sy0 + y, 0)[1] > y0 + 0.15)
        L.set(x, y, rgb(OUTLINE));
    }
  // foam where the falls land: a few white flecks along their foot, on the water only
  const g = m.gap,
    [fa, fy] = P(g.x - g.w, g.y, WATER_Z),
    [fb] = P(g.x + g.w, g.y, WATER_Z);
  for (let X = Math.round(fa) - 2; X <= Math.round(fb) + 2; X++)
    for (let d = 1; d <= 3; d++) {
      const x = X - sx0,
        y = Math.round(fy) + d - sy0;
      if (x >= 0 && x < W && y >= 0 && y < H && kind[y * W + x] === 1 && hash(X, d, 91) < 0.55 - d * 0.12)
        L.set(x, y, rgb(POOL_C.foam));
    }
  L.flush();
  stamp(pt.ctx, L.cv, sx0, sy0);
}
