// The office island's land (no DOM, no canvas): its hexagon shape, the cone-shaped underside, the outdoor spots,
// the mountain and the lake at its foot, the lake at the bottom point (web/island-lake.js), the rest corner, the
// lamps, the garden paths and the decor. Nothing here is drawn (web/sky-island.js does that). Pure and
// deterministic: every position comes from the grid and hash(), so the island looks the same on every machine.
// web/sky-logic.js re-exports it as SkyLogic.
import { key, pos, N4, hash } from './island-grid.js';
import { lakeOf } from './island-lake.js';
import { BRIEF, FOOT_TILES, fromF, inPoly, inRim, SCALE, shapes } from './mountain-shape.js';
export { key, N4, hash, WATER_Z } from './island-grid.js';

// east-back runs along the pantry's east side, flush with the office's back wall, and holds the restroom block (raised
// to the office floor); east-front, right beside the block's east side, holds the smoking corner; south-left is free.
const outdoorSpots = (W, H) => [
  { id: 'east-front', x: W + 6, y: 4, w: 4, h: 4 },
  { id: 'south-left', x: 5, y: H + 1, w: 4, h: 3 },
  { id: 'east-back', x: W, y: 0, w: 6, h: 7 },
];
// Land the restroom block (rows -1..0, flush with the office's back wall) and the smoking corner (rows 3..10) stand
// on. The island already covers it; it is still added so they never stand off the land whatever the shape.
// Rows are [y, first x, last x], relative to the office (x from W, y from 0).
const ANNEX_LAND = [
  [-1, 2, 4],
  [0, 5, 5],
  [3, 8, 8],
  [4, 8, 9],
  [5, 8, 10],
  [6, 8, 10],
  [7, 8, 10],
  [8, 8, 10],
  [9, 8, 9],
  [10, 8, 8],
];
const annexLand = W => ANNEX_LAND.flatMap(([y, a, b]) => Array.from({ length: b - a + 1 }, (_, i) => [W + a + i, y]));

// The island is a hexagon pointing up and down on screen around the whole office block: the office (W x H) plus the
// restroom block and smoking corner on its east side, x from -1 to W + 10 and y from -1 to H. It starts as a square
// of tiles, |dx| <= R and |dy| <= R from the block's middle (a diamond on screen, its points at the top, bottom,
// left and right), with SQUARE_MARGIN grass tiles beside the block's long sides, so the lawn in front of and behind
// the office is about 15 tiles deep. The left and right points are cut off along |dx - dy| <= K, which runs straight
// up and down the screen, HEX_CUT tiles past the block's corners. The top and bottom points stay.
const SQUARE_MARGIN = 4,
  HEX_CUT = 4;
const centre = (W, H) => {
  const half = (W + 11) / 2; // from the block's middle to its end tiles' middles, along x
  return { cx: (W + 10) / 2, cy: H / 2, R: half + SQUARE_MARGIN, K: half + (H + 1) / 2 + HEX_CUT };
};
// Waves along the whole shore, the upright edges included: bays and headlands up to ~2 tiles, never one-tile bumps,
// so the hexagon reads as land rather than a ruler-drawn shape.
const shoreWave = a => {
  const w =
    0.75 * Math.sin(a * 3 + 0.6) +
    0.5 * Math.sin(a * 5 + 2.1) +
    0.35 * Math.sin(a * 8 + 4.0) +
    0.22 * Math.sin(a * 13 + 1.3);
  return w > 0 ? w : 0.45 * w; // headlands reach out further than bays cut in, so the lawn by the office stays wide
};
// How far (in tiles) a tile centre lies outside the hexagon: <= 0.5 is land. The three edges blend over about a tile
// (a soft maximum), so the corners turn softly instead of stepping. The waves run along the square's four sides and
// are softer on the two upright edges but never vanish there. Around the bottom point (where the lake and the main
// waterfall sit) they fade out, so the lake keeps its shore.
const SOFT = 0.7;
function hexOut(x, y, { cx, cy, R, K }, wavy) {
  const dx = x + 0.5 - cx,
    dy = y + 0.5 - cy,
    a = Math.abs(dx) - R,
    b = Math.abs(dy) - R,
    c = Math.abs(dx - dy) - K;
  const f = SOFT * Math.log(Math.exp(a / SOFT) + Math.exp(b / SOFT) + Math.exp(c / SOFT));
  if (!wavy) return f;
  const upright = 0.55 + 0.45 * Math.min(1, Math.max(0, -c / 6)),
    nearTip = Math.min(1, Math.max(0, (2 * R - (dx + dy) - 14) / 10));
  // the two upright edges also wander along their length, so neither runs ruler-straight
  const along = dx + dy,
    onCut = Math.max(0, 1 - Math.abs(c) / 3),
    wander = onCut * (0.9 * Math.sin(along * 0.42 + (dx > dy ? 1.3 : 4.1)) + 0.45 * Math.sin(along * 0.97 + 2.2));
  return f - (shoreWave(Math.atan2(dy, dx)) * upright + wander) * nearTip;
}
// The hexagon's own distance from the middle, 0 there and 1 on its edges, for the underside.
const hexN = (x, y, { cx, cy, R, K }) => {
  const dx = x + 0.5 - cx,
    dy = y + 0.5 - cy;
  return Math.max(Math.abs(dx) / R, Math.abs(dy) / R, Math.abs(dx - dy) / K);
};
// Distance of every cell to the shore in steps (0 on the shore).
function shoreOf(set) {
  const count = (x, y) => N4.filter(([a, b]) => set.has(key(x + a, y + b))).length,
    out = new Map(),
    queue = [];
  for (const k of set) {
    const [x, y] = pos(k);
    if (count(x, y) < 4) {
      out.set(k, 0);
      queue.push([x, y]);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i],
      d = out.get(key(x, y));
    for (const [a, b] of N4) {
      const k = key(x + a, y + b);
      if (set.has(k) && !out.has(k)) {
        out.set(k, d + 1);
        queue.push([x + a, y + b]);
      }
    }
  }
  return out;
}

function buildIsland({ W, H }) {
  const shape = centre(W, H),
    { cx, cy, R } = shape,
    x0 = Math.floor(cx - R - 3),
    x1 = Math.ceil(cx + R + 3),
    y0 = Math.floor(cy - R - 3),
    y1 = Math.ceil(cy + R + 3);
  const cells = new Set();
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++)
      if (hexOut(x, y, shape, true) <= 0.5 || (x >= -1 && x <= W + 10 && y >= -1 && y <= H)) cells.add(key(x, y));
  for (const [x, y] of annexLand(W)) cells.add(key(x, y));
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const k of cells) {
    const [x, y] = pos(k);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + 1);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + 1);
  }
  // The underside is one cone: its tip, under the middle, hangs about a third of the island's screen width
  // ((x - y) * 16 px per tile) below the grass, and it rises evenly to the shore. The depth follows the plain hexagon
  // (the shore's waves would make it rise along the shore) and its noise stays under 2 px, so it never steps.
  const maxD = Math.round(((maxX - minY - (minX - maxY)) * 16) / 3),
    shore = shoreOf(cells);
  const list = [...cells]
    .map(k => {
      const [x, y] = pos(k),
        n = Math.min(1, hexN(x, y, shape));
      return { x, y, shore: shore.get(k), d: 8 + (maxD - 8) * (1 - n) ** 1.6 + hash(x, y, 1) * 2 };
    })
    .sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
  const spots = outdoorSpots(W, H);
  const inSpot = (x, y) => spots.some(s => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
  const nearOffice = (x, y) => x >= -1 && x <= W && y >= -1 && y <= H;
  const free = (x, y) => cells.has(key(x, y)) && !nearOffice(x, y) && !inSpot(x, y);
  const { pond, waterfall, pavilion, lotus, duckweed, ducks, rest } = lakeOf({ cells, shape, free });
  const mountain = mountainOf(cells);
  const paths = lawnPaths(W, H, stairs(W, H), { bath: pond.spots, rest });
  const lamps = lampsOf(H, paths, pond.spots);
  const decor = decorOf({ cells, free, pond, mountain, rest, paths, lamps, pines: pinesOf(cells, mountain) });
  return {
    cells,
    list,
    depth: new Map(list.map(c => [key(c.x, c.y), c.d])),
    bounds: { minX, maxX, minY, maxY },
    spots,
    decor,
    waterfall,
    pond,
    pavilion,
    lotus,
    duckweed,
    ducks,
    paths,
    shape,
    mountain,
    rest,
    lamps,
  };
}

// ---- the mountain ----
// Coordinates are the office's (W x H at the origin): x < 0 is the strip beside the left wall, y < 0 the back lawn,
// y > H the front lawn. One snow peak (web/mountain-shape.js) stands on the back lawn toward small x (the top point on
// screen): its foot is a FOOT_TILES-square of tiles (a diamond on screen) whose front corner F is the tile corner FOOT.
// Its falls run down a cleft in the lit face into a small lake at its foot, which runs nowhere.
const FOOT = { x: 2, y: -7 };
// Where a point (x, y on the lawn, tiles) shows on screen, in px from F.
const fromFoot = (x, y) => [(x - y - (FOOT.x - FOOT.y)) * 16, (x + y - (FOOT.x + FOOT.y)) * 8];
// A point px from F on screen, back on the lawn (tiles).
const toLawn = (u, v) => [FOOT.x + (u / 16 + v / 8) / 2, FOOT.y + (v / 8 - u / 16) / 2];
// The x + y of the foot's front edge (L-F, then F-R) in the screen column x - y = c: what stands in front of it in
// that column sorts after the mountain (web/office-draw.js draws it in columns, each at its front edge).
const frontEdge = c => Math.min(c + 2 * FOOT.y, 2 * FOOT.x - c);
function mountainOf(cells) {
  const sh = shapes(SCALE),
    out = new Set(),
    hidden = new Set(),
    lake = new Set();
  for (let y = FOOT.y - FOOT_TILES; y < FOOT.y; y++)
    for (let x = FOOT.x - FOOT_TILES; x < FOOT.x; x++) out.add(key(x, y));
  for (const k of cells) {
    if (out.has(k)) continue;
    const [x, y] = pos(k),
      [u, v] = fromFoot(x + 0.5, y + 0.5);
    // a tile whose middle is inside the stone rim is lake; one whose middle the mountain covers on screen is hidden
    if (inRim(sh.lake, u, v)) lake.add(k);
    else if (inPoly(sh.silhouette, u, v)) hidden.add(k);
  }
  const rim = [];
  for (const k of cells) {
    if (lake.has(k) || out.has(k)) continue;
    const [x, y] = pos(k);
    let near = false;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) near ||= lake.has(key(x + a, y + b));
    if (near) rim.push({ x, y });
  }
  return { cells: out, foot: { ...FOOT }, lake: { cells: lake, rim }, scale: SCALE, hidden };
}

// Pines in the brief's two clumps on the mountain's grassy foot (BRIEF.pines), three sizes mixed: each { x, y, kind:
// 'pine', at: [x, y] where it stands (tiles), size 0..2, z }. Several may share a tile. z sorts it: at least its own
// x + y, and in front of the mountain's front edge in every column it covers, so a pine on the foot is drawn over it.
const PINE_HALF = [4, 5, 6]; // px either side of a pine's middle, by size
function pinesOf(cells, m) {
  const sh = shapes(SCALE),
    out = [];
  BRIEF.pines.forEach(([x0, x1, y0, y1, n], j) => {
    for (let i = 0, tries = 0; i < n && tries < 60; tries++) {
      const [u, v] = fromF([x0 + (x1 - x0) * hash(tries, j, 80), y0 + (y1 - y0) * hash(tries, j, 81)], SCALE),
        [wx, wy] = toLawn(Math.round(u), Math.round(v)),
        x = Math.floor(wx),
        y = Math.floor(wy),
        k = key(x, y),
        size = (2 * i + j) % 3;
      // on the grass: the island's lawn, or the mountain's grassy foot (no higher than the band's top, ~9 px)
      const onFoot = m.cells.has(k),
        band = (Math.min(u, -u) / 2 - v) / SCALE; // px up from the front edge, in the brief's px
      if (!cells.has(k) || m.lake.cells.has(k) || m.hidden.has(k) || (onFoot && band > 7)) continue;
      if (inRim(sh.lake, u, v - 3) || out.some(p => Math.hypot(p.u - u, (p.v - v) * 2) < 9)) continue;
      const c = wx - wy,
        w = PINE_HALF[size] / 16,
        edge = Math.max(frontEdge(c - w), frontEdge(c + w)),
        z = Math.max(wx + wy, edge + 0.05);
      out.push({ x, y, kind: 'pine', at: [wx, wy], size, z, u, v });
      i++;
    }
  });
  return out.map(({ u, v, ...p }) => p);
}

// Lamp posts beside the stone path: at the path's corner below the south stairs, beside the east stairs' leg, and
// on the way down to the lake, each a tile off the stones.
const lampsOf = (H, paths, baths) => {
  const bath = baths.reduce((a, b) => (b.y < a.y ? b : a));
  return [
    { x: 25, y: H + 2 },
    { x: 28, y: H - 2 },
    { x: bath.x + 1, y: bath.y - 2 },
  ].filter(l => !paths.cells.has(key(l.x, l.y)));
};

// Trees grow in groves of 3-6 around a few hand-placed centres, bushes and a mushroom or two in their shade; rocks and
// flowers gather in their own small patches. Sparse on purpose: a few groves read as a garden, a carpet as clutter.
// Nothing solid stands on or right beside water, the mountain, a path, a lamp or the rest corner, so every lane stays
// open; flowers may grow up to their edge.
const GROVES = [
  [12, -12],
  [22, -14],
  [30, -8],
  [17, -5],
  [38, -2],
  [36, 11],
  [14, 24],
  [24, 27],
  [7, 21],
  [19, 19],
];
const ROCKS = [
  [9, -5],
  [26, -3],
  [27, 25],
  [9, 26],
  [40, 5],
];
const FLOWERS = [
  [8, -9],
  [26, -10],
  [20, -14],
  [33, -3],
  [40, 14],
  [11, 20],
  [20, 24],
  [24, 18],
  [3, 18],
  [16, 28],
];
function decorOf({ cells, free, pond, mountain, rest, paths, lamps, pines }) {
  const m = mountain,
    taken = new Set([...pond.cells, ...m.cells, ...m.lake.cells, ...m.hidden, ...paths.cells]);
  for (const p of [rest.bench, rest.fish, ...lamps, ...pines]) taken.add(key(p.x, p.y));
  const open = (x, y) => free(x, y) && !taken.has(key(x, y));
  const roomy = (x, y) =>
    x >= 0 && open(x, y) && N4.every(([a, b]) => !cells.has(key(x + a, y + b)) || !taken.has(key(x + a, y + b)));
  const out = [],
    used = new Set();
  const put = (x, y, kind) => {
    out.push({ x, y, kind });
    used.add(key(x, y));
  };
  const ring = (cx, cy, r) => {
    const out = [];
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) === r && !used.has(key(x, y))) out.push([x, y]);
    return out;
  };
  const byHash = s => (a, b) => hash(a[0], a[1], s) - hash(b[0], b[1], s);
  for (const [cx, cy] of GROVES) {
    const spots = [[cx, cy], ...ring(cx, cy, 1)].filter(([x, y]) => roomy(x, y)).sort(byHash(6));
    if (spots.length < 3) continue;
    spots.slice(0, 3 + Math.floor(hash(cx, cy, 7) * 4)).forEach(([x, y]) => put(x, y, 'tree'));
    const shade = ring(cx, cy, 2)
      .filter(([x, y]) => roomy(x, y))
      .sort(byHash(8));
    shade.slice(0, 2).forEach(([x, y]) => put(x, y, 'bush'));
    shade.slice(2, 3 + Math.floor(hash(cx, cy, 9) * 2)).forEach(([x, y]) => put(x, y, 'mushroom'));
  }
  for (const [cx, cy] of ROCKS)
    [[cx, cy], ...ring(cx, cy, 1)]
      .filter(([x, y]) => roomy(x, y) && !used.has(key(x, y)))
      .sort(byHash(10))
      .slice(0, 2 + Math.floor(hash(cx, cy, 11) * 2))
      .forEach(([x, y]) => put(x, y, 'rock'));
  for (const [cx, cy] of FLOWERS)
    [[cx, cy], ...ring(cx, cy, 1), ...ring(cx, cy, 2)]
      .filter(([x, y]) => open(x, y) && !used.has(key(x, y)) && hash(x, y, 12) < 0.3)
      .forEach(([x, y]) => put(x, y, 'flower'));
  // By the mountain's lake (brief section 5): a bush and a rock or two, red mushrooms with white spots, and 1 px
  // flowers in the brief's pink, yellow and white, sparse on the grass round it. Its rim keeps clear of anything solid
  // (dogs drink there).
  const lake = [...m.lake.cells].map(pos),
    rim = new Set(m.lake.rim.map(r => key(r.x, r.y))),
    by = (x, y) => Math.min(...lake.map(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - y)))),
    round = [];
  for (let y = m.foot.y - 2; y <= m.foot.y + 4; y++)
    for (let x = m.foot.x - 6; x <= m.foot.x + 2; x++)
      if (open(x, y) && !used.has(key(x, y)) && by(x, y) <= 3) round.push([x, y]);
  round.sort(byHash(13));
  const solid = round.filter(([x, y]) => by(x, y) >= 2 && !rim.has(key(x, y))),
    soft = round.filter(([x, y]) => !solid.some(p => p[0] === x && p[1] === y));
  solid.slice(0, 1).forEach(([x, y]) => put(x, y, 'bush'));
  solid.slice(1, 3).forEach(([x, y]) => put(x, y, 'rock'));
  solid.slice(3, 6).forEach(([x, y]) => out.push({ x, y, kind: 'mushroom', red: true }) && used.add(key(x, y)));
  const BLOOM = ['#FF7AA8', '#FFD84A', '#FFFFFF'];
  soft
    .concat(solid.slice(6))
    .slice(0, 5)
    .forEach(([x, y], i) => out.push({ x, y, kind: 'flower', colour: BLOOM[i % 3] }));
  out.push(...pines);
  return out.sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
}

// ---- garden paths ----
// Stepping-stone paths laid where agents really walk (desire lines). From the foot of the east stairs one runs down
// beside the pantry, along the plinth front and down to the bathing spots at the lake's north tip; the south stairs
// join it on the plinth front, and a branch leads down to the rest corner on the lake's inner bank. Another runs along
// the front of the restroom block to the smoking corner (the block itself is reached across the pantry floor, not
// from the lawn). They run one tile clear of the plinth front and east of the south stairs, so the big front lawn
// stays whole.
// Each leg is a list of waypoints that share a row or a column; `cells` are the tiles they cover (agents prefer
// them), `lines` the same legs in world coordinates for drawing, starting just past the bottom step instead of at the
// tile centre under it (a leg that branches off another starts at a tile centre).
function lawnPaths(W, H, st, { bath: baths, rest }) {
  const e = st.find(s => s.side === 'east'),
    s = st.find(s => s.side === 'south');
  const bath = baths.reduce((a, b) => (b.y < a.y ? b : a)),
    row = H + 1,
    sx = s.x + s.len - 1,
    end = [rest.fish.x, rest.fish.y - 1];
  const legs = [
    {
      at: 'south',
      pts: [
        [sx, H],
        [sx, row],
        [e.x, row],
      ],
    },
    {
      at: 'east',
      pts: [
        [e.x, e.y + e.len - 1],
        [e.x, row],
        [bath.x, row],
        [bath.x, bath.y - 1],
      ],
    },
    // along the front of the restroom block to the smoking corner's entrance beside it
    {
      at: 'east',
      pts: [
        [e.x, e.y],
        [W + 5, e.y],
      ],
    },
    // off the lake path to the rest corner
    {
      at: null,
      pts: [[end[0], row], end],
    },
  ];
  const cells = new Set();
  for (const { pts } of legs)
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]],
        dx = Math.sign(b[0] - a[0]),
        dy = Math.sign(b[1] - a[1]);
      for (let x = a[0], y = a[1]; ; x += dx, y += dy) {
        cells.add(key(x, y));
        if (x === b[0] && y === b[1]) break;
      }
    }
  // A line starts on the lawn just past the bottom step and heads straight for the next tile centre, so a long first
  // run does not drift sideways from the stairs toward the next waypoint.
  const lines = legs.map(({ at, pts }) => {
    const [[x, y], [bx, by]] = pts,
      c = ([x, y]) => [x + 0.5, y + 0.5],
      next = [x + 0.5 + Math.sign(bx - x), y + 0.5 + Math.sign(by - y)];
    const foot = at === 'east' ? [x + STAIR_RUN + 0.25, y + 0.5] : [x + 0.5, y + STAIR_RUN + 0.25];
    const out = at ? [foot, next] : [c([x, y])];
    for (const p of pts.slice(1)) {
      const q = c(p);
      if (q[0] !== out[out.length - 1][0] || q[1] !== out[out.length - 1][1]) out.push(q);
    }
    return out;
  });
  const strips = lines.map(smoothLine);
  return { cells, lines, strips, stones: layStones(strips) };
}
// Corner cutting (Chaikin, twice) so a leg's right-angle turns read as soft curves; the end points stay put.
function smoothLine(l) {
  let p = l;
  for (let n = 0; n < 2; n++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b] = [p[i], p[i + 1]];
      q.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
      );
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}
// Stepping stones along the smoothed legs. A tile is ~0.65 m, so a stone every 0.95 tile is the usual ~60 cm stride and
// a stone ~0.64 tile across is ~40 cm; the first stone of a leg is a wider landing slab at the foot of the stairs.
// Where a leg runs into another, the stone already laid there is kept. Each stone gets an irregular 8-point outline
// in world coordinates, wider across the walk than along it, from per-stone noise so it is the same on every machine.
const STONE_STEP = 0.95;
function layStones(strips) {
  const stones = [];
  for (const l of strips) {
    const seg = [];
    let len = 0;
    for (let i = 1; i < l.length; i++) {
      const d = Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
      seg.push([len, d]);
      len += d;
    }
    const at = s => {
      let i = 0;
      while (i < seg.length - 1 && seg[i][0] + seg[i][1] < s) i++;
      const [s0, d] = seg[i],
        f = d ? Math.min(1, (s - s0) / d) : 0,
        a = l[i],
        b = l[i + 1];
      return {
        x: a[0] + (b[0] - a[0]) * f,
        y: a[1] + (b[1] - a[1]) * f,
        tx: (b[0] - a[0]) / (d || 1),
        ty: (b[1] - a[1]) / (d || 1),
      };
    };
    // spread the stones evenly from end to end, never wider than a stride, so the last one lands at the end of the leg
    const n = Math.max(1, Math.ceil(len / STONE_STEP)),
      marks = Array.from({ length: n + 1 }, (_, i) => (len * i) / n);
    marks.forEach((s, i) => {
      const p = at(s);
      if (!stones.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 0.6)) stones.push({ ...p, first: i === 0 });
    });
  }
  for (const st of stones) {
    const ra = st.first ? 0.3 : 0.24,
      rb = st.first ? 0.42 : 0.32;
    st.outline = [];
    for (let j = 0; j < 8; j++) {
      const th = (j * Math.PI) / 4 + (hash(st.x * 9, st.y * 9, 20 + j) - 0.5) * 0.35,
        r = 0.88 + hash(st.x * 9, st.y * 9, 30 + j) * 0.24;
      const ca = Math.cos(th) * ra * r,
        cb = Math.sin(th) * rb * r;
      st.outline.push([st.x + st.tx * ca - st.ty * cb, st.y + st.ty * ca + st.tx * cb]);
    }
  }
  return stones.sort((a, b) => a.x + a.y - (b.x + b.y));
}

// ---- walking outside the office ----
// The only ways between the raised office floor and the lawn: two flights of steps, one on the pantry's east edge
// and one on its front edge. `x,y` is the first lawn tile at the foot; `len` tiles wide along the edge.
const stairs = (W, H) => [
  { side: 'east', x: W, y: 7, len: 2 },
  { side: 'south', x: 22, y: H, len: 2 },
];
const STAIR_RUN = 0.6;

export const IslandLand = {
  buildIsland,
  SQUARE_MARGIN,
  HEX_CUT,
  centre,
  annexLand,
  outdoorSpots,
  stairs,
  STAIR_RUN,
  lawnPaths,
};
