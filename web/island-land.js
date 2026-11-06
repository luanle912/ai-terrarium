// The office island's land (no DOM, no canvas): its squircle shape, the cone-shaped underside, the outdoor spots,
// the mountain, river, lake (`pond`) and waterfall, the bridge, the rest corner, the lamps, the garden paths and the
// decor. Nothing here is drawn (web/sky-island.js does that). Pure and deterministic: every position comes from the
// grid and hash(), so the island looks the same on every machine. web/sky-logic.js re-exports it as SkyLogic.
export const key = (x, y) => x + ',' + y;
export const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
// Per-cell noise from the cell position alone, so the island looks the same on every machine.
export const hash = (x, y, s) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
};
// The lake's and the river's water surface sits this far below the grass (px).
export const WATER_Z = -3;

// east-back runs along the pantry's east side, flush with the office's back wall, and holds the restroom block (raised
// to the office floor); east-front, right beside the block's east side, holds the smoking corner; south-left is free.
const outdoorSpots = (W, H) => [
  { id: 'east-front', x: W + 6, y: 4, w: 4, h: 4 },
  { id: 'south-left', x: 5, y: H + 1, w: 4, h: 3 },
  { id: 'east-back', x: W, y: 0, w: 6, h: 7 },
];
// Land the restroom block (rows -1..0, flush with the office's back wall) and the smoking corner (rows 3..10) stand
// on. The square island already covers it; it is still added so they never stand off the land whatever the shape.
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

// The island is a squircle (power SQUIRCLE_P) around the whole office block: the office (W x H) plus the restroom
// block and smoking corner on its east side, x from -1 to W + 10 and y from -1 to H. Its radius leaves SQUARE_MARGIN
// grass tiles beside the block's long sides, so the lawn in front of and behind the office is about 15 tiles deep.
const SQUARE_MARGIN = 5,
  SQUIRCLE_P = 5;
const centre = (W, H) => ({ cx: (W + 10) / 2, cy: H / 2, R: (W + 10) / 2 + SQUARE_MARGIN });
// A few long, low waves along the shore: bays and headlands, never one-tile bumps.
const shoreWave = a => 0.035 * Math.sin(a * 3 + 0.6) + 0.025 * Math.sin(a * 5 + 2.1) + 0.015 * Math.sin(a * 7 + 4.0);
// Normalised squircle distance of a tile centre: 0 at the island's centre, 1 on its shore (the wavy shore when
// `wavy`, else the plain squircle).
function squircleN(x, y, { cx, cy, R }, wavy) {
  const px = (x + 0.5 - cx) / R,
    py = (y + 0.5 - cy) / R;
  const n = Math.pow(Math.abs(px) ** SQUIRCLE_P + Math.abs(py) ** SQUIRCLE_P, 1 / SQUIRCLE_P);
  return wavy ? n / (1 + shoreWave(Math.atan2(py, px))) : n;
}
const pos = k => k.split(',').map(Number);
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
    x0 = Math.floor(cx - R - 2),
    x1 = Math.ceil(cx + R + 2),
    y0 = Math.floor(cy - R - 2),
    y1 = Math.ceil(cy + R + 2);
  const cells = new Set();
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++)
      if (squircleN(x, y, shape, true) <= 1 || (x >= -1 && x <= W && y >= -1 && y <= H)) cells.add(key(x, y));
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
  // ((x - y) * 16 px per tile) below the grass, and it rises evenly to the shore. The depth follows the plain squircle
  // (the shore's waves would make it rise along the shore) and its noise stays under 2 px, so it never steps.
  const maxD = Math.round(((maxX - minY - (minX - maxY)) * 16) / 3),
    shore = shoreOf(cells);
  const list = [...cells]
    .map(k => {
      const [x, y] = pos(k),
        n = Math.min(1, squircleN(x, y, shape, false));
      return { x, y, shore: shore.get(k), d: 8 + (maxD - 8) * (1 - n) ** 1.6 + hash(x, y, 1) * 2 };
    })
    .sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
  const spots = outdoorSpots(W, H);
  const inSpot = (x, y) => spots.some(s => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
  const nearOffice = (x, y) => x >= -1 && x <= W && y >= -1 && y <= H;
  const free = (x, y) => cells.has(key(x, y)) && !nearOffice(x, y) && !inSpot(x, y);
  const { river, pond, waterfall } = waters(cells, H, free);
  const mountain = mountainOf(cells, river.cells);
  const bridge = bridgeOf(H);
  // The rest corner: a fishing spot on the far bank facing the lake right at the river mouth, the bench just upstream.
  const mouth = river.line[river.line.length - 1][1];
  const rest = {
    bench: { x: RIVER_X - 2, y: mouth - 2 },
    fish: { x: RIVER_X - 1, y: mouth },
  };
  const paths = lawnPaths(W, H, stairs(W, H), { bath: pond.spots, bridge, rest });
  const lamps = lampsOf(H, bridge);
  const decor = decorOf({ cells, free, river, pond, mountain, bridge, rest, paths, lamps });
  return {
    cells,
    list,
    depth: new Map(list.map(c => [key(c.x, c.y), c.d])),
    bounds: { minX, maxX, minY, maxY },
    spots,
    decor,
    waterfall,
    pond,
    paths,
    shape,
    mountain,
    river,
    bridge,
    rest,
    lamps,
  };
}

// ---- the landscape around the office ----
// Coordinates are the office's (W x H at the origin): x < 0 is the strip beside the left wall, y < 0 the back lawn,
// y > H the front lawn. A two-peak mountain stands on the back lawn toward small x (the top corner on screen); its
// falls pour out of the gap between the peaks into a river two tiles wide that runs down the left strip, past the
// office, into a lake on the left of the front lawn, and the lake spills over the front shore as the main waterfall.
// Mountain, river and lake together cut the far bank off from the rest of the island, so a wooden bridge near the
// river mouth is the only way over; the rest corner (a bench and a fishing spot) waits on the far bank by the lake, and
// the far bank runs on up to the foot of the mountain. The near bank (x = -1, under the left wall) is plain grass.
const RIVER_X = -3, // the river's two columns are RIVER_X and RIVER_X + 1, leaving one tile of bank either side
  RIVER_HEAD = -8; // its first row, in the gorge at the foot of the falls
// Peaks in tiles, their height above the lawn in px and their foot's radius in tiles. The main one, further right on
// screen, stands nearer the viewer, so it is more than twice as tall to read as the taller one (its tip sits higher
// on screen than the lower peak's).
const PEAKS = [
    { x: -3, y: -11, h: 40, R: 3.4, main: false },
    { x: 3, y: -12, h: 92, R: 4.4, main: true },
  ],
  GAP = { x: -1, y: -10 },
  MOUNTAIN_R = 4.5,
  // a low rocky shoulder at the river's head, at the foot of the lower peak, behind the mountain falls
  SHOULDER = { x: -3.1, y: -9.5, h: 33, R: 2.3 },
  // The mountain falls pour over a notch in a rock ledge at the back of the river's head row, FALL_Z px up, into the
  // river (web/island-art.js draws the ledge, web/island-life.js the water).
  FALL_Z = 20;
// The lake: an ellipse of tiles on the front lawn, reaching the front shore (centre y relative to H).
const LAKE = { cx: 0, dy: 12, rx: 3.9, ry: 4.8 };
// The bridge's row, relative to H: two rows above the river mouth, one tile clear of the reserved south-left spot.
const BRIDGE_DY = 4;

function waters(cells, H, free) {
  const lake = new Set(),
    cy = H + LAKE.dy;
  for (const k of cells) {
    const [x, y] = pos(k);
    if (((x + 0.5 - LAKE.cx) / LAKE.rx) ** 2 + ((y + 0.5 - cy) / LAKE.ry) ** 2 <= 1 && free(x, y)) lake.add(k);
  }
  // The river runs down its two columns until either reaches the lake; the other column's last tiles join the lake,
  // so the mouth opens two tiles wide.
  let end = RIVER_HEAD;
  while (!lake.has(key(RIVER_X, end + 1)) && !lake.has(key(RIVER_X + 1, end + 1))) end++;
  for (const x of [RIVER_X, RIVER_X + 1])
    for (let y = end + 1; !lake.has(key(x, y)) && cells.has(key(x, y)); y++) lake.add(key(x, y));
  const riverCells = new Set(),
    line = [];
  for (let y = RIVER_HEAD; y <= end; y++) {
    riverCells.add(key(RIVER_X, y));
    riverCells.add(key(RIVER_X + 1, y));
    line.push([RIVER_X + 1, y + 0.5]);
  }
  line.push([RIVER_X + 1, end + 1]);
  // The main waterfall pours over the lake's front lip: the lake tile on the front shore nearest the lake's middle.
  const lip = [...lake]
    .map(pos)
    .filter(([x, y]) => !cells.has(key(x, y + 1)))
    .sort((a, b) => Math.abs(a[0] + 0.5 - LAKE.cx) - Math.abs(b[0] + 0.5 - LAKE.cx) || a[0] - b[0])[0];
  // Agents bathe at the east bank, where the garden path arrives from the north: the eastmost lake tile with plain
  // lawn north of it, and the lake tile beside it.
  const bank = (x, y) => cells.has(key(x, y)) && !lake.has(key(x, y)) && !riverCells.has(key(x, y));
  const [bx, by] = [...lake]
    .map(pos)
    .filter(([x, y]) => bank(x, y - 1))
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])[0];
  const next = [
    [bx, by + 1],
    [bx - 1, by],
    [bx - 1, by + 1],
  ].find(([x, y]) => lake.has(key(x, y)));
  return {
    river: { cells: riverCells, line },
    pond: { cells: lake, spots: [{ x: bx, y: by }, ...(next ? [{ x: next[0], y: next[1] }] : [])] },
    waterfall: { x: lip[0], y: lip[1] },
  };
}

// The mountain covers the tiles within MOUNTAIN_R of the ridge between its peaks, plus every tile of the left strip
// behind the river head, so nobody walks round the river's source; the river's own gorge is left open.
function mountainOf(cells, river) {
  const [a, b] = PEAKS,
    vx = b.x - a.x,
    vy = b.y - a.y;
  const toRidge = (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(x - a.x - t * vx, y - a.y - t * vy);
  };
  const out = new Set();
  for (const k of cells) {
    const [x, y] = pos(k);
    if (y > -3 || river.has(k)) continue;
    if (toRidge(x, y) <= MOUNTAIN_R || (x <= RIVER_X + 2 && y < RIVER_HEAD)) out.add(k);
  }
  return {
    cells: out,
    peaks: PEAKS.map(p => ({ ...p })),
    gap: { ...GAP },
    shoulder: { ...SHOULDER },
    // the falls: a sheet across the middle of the river's head row, in its back edge (the plane y = fall.y)
    fall: { y: RIVER_HEAD, x0: RIVER_X + 0.55, x1: RIVER_X + 1.45, top: FALL_Z },
  };
}

const bridgeOf = H => {
  const y = H + BRIDGE_DY;
  return { cells: new Set([key(RIVER_X, y), key(RIVER_X + 1, y)]), x: RIVER_X, y, dir: 'x', len: 2 };
};
// The bridge deck runs a quarter tile onto either bank and arches low over the water: its height above the lawn at t
// (0..1 along it).
export const DECK_OVER = 0.25;
export const deckZ = t => 3 + 3 * Math.sin(Math.PI * t);
// How far the deck lifts someone standing at (x, y) (tile coordinates, a tile's middle at +0.5): 0 off the bridge.
export function bridgeZ(bridge, x, y) {
  const along = bridge.dir === 'x',
    a = along ? x : y,
    w = along ? y : x,
    a0 = (along ? bridge.x : bridge.y) - DECK_OVER,
    a1 = (along ? bridge.x : bridge.y) + bridge.len + DECK_OVER,
    w0 = along ? bridge.y : bridge.x;
  if (w < w0 || w > w0 + 1 || a <= a0 || a >= a1) return 0;
  return deckZ((a - a0) / (a1 - a0));
}
// Lamp posts: one at each end of the bridge, on its upstream side, and a few beside the stone path.
const LAMPS_ALONG = [
  [16, 2],
  [11, 3],
  [1, 3],
];
const lampsOf = (H, bridge) => [
  { x: bridge.x - 1, y: bridge.y - 1 },
  { x: bridge.x + bridge.len, y: bridge.y - 1 },
  ...LAMPS_ALONG.map(([x, dy]) => ({ x, y: H + dy })),
];

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
  [31, 21],
  [19, 19],
];
const ROCKS = [
  [8, -5],
  [26, -3],
  [34, 26],
  [9, 23],
  [40, 5],
];
const FLOWERS = [
  [6, -9],
  [26, -10],
  [34, -12],
  [33, -3],
  [40, 14],
  [11, 20],
  [20, 24],
  [28, 18],
  [36, 23],
  [16, 28],
];
function decorOf({ cells, free, river, pond, mountain, bridge, rest, paths, lamps }) {
  const taken = new Set([...river.cells, ...pond.cells, ...mountain.cells, ...bridge.cells, ...paths.cells]);
  for (const p of [rest.bench, rest.fish, ...lamps]) taken.add(key(p.x, p.y));
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
  return out.sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
}

// ---- garden paths ----
// Stepping-stone paths laid where agents really walk (desire lines). From the foot of the south stairs one runs along
// the plinth front, round the reserved south-left spot and on to the lake's bathing spots; the east stairs join it,
// and a branch leads to the bridge and, past it, to the rest corner (the bridge deck is its own walk, no stones).
// Another runs along the front of the restroom block to the smoking corner (the block itself is reached across the
// pantry floor, not from the lawn). They run one tile clear of the plinth front, so the big front lawn stays whole.
// Each leg is a list of waypoints that share a row or a column; `cells` are the tiles they cover (agents prefer
// them), `lines` the same legs in world coordinates for drawing, starting just past the bottom step instead of at the
// tile centre under it (a leg that branches off another starts at a tile centre).
function lawnPaths(W, H, st, { bath: baths, bridge, rest }) {
  const e = st.find(s => s.side === 'east'),
    s = st.find(s => s.side === 'south'),
    free = outdoorSpots(W, H).find(o => o.id === 'south-left');
  const bath = baths.reduce((a, b) => (b.y < a.y ? b : a)),
    row = H + 1,
    sx = s.x + s.len - 1,
    turn = free.x + free.w + 1,
    by = bridge.y;
  const legs = [
    {
      at: 'south',
      pts: [
        [sx, H],
        [sx, row],
        [turn, row],
        [turn, by],
        [bath.x, by],
        [bath.x, bath.y - 1],
      ],
    },
    {
      at: 'east',
      pts: [
        [e.x, e.y + e.len - 1],
        [e.x, row],
      ],
    },
    // joining the east stairs' leg to the south one along the plinth front (a T, so neither leg's end is cut short)
    {
      at: null,
      pts: [
        [e.x, row],
        [sx, row],
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
    // on from the lake path to the near end of the bridge, then from its far end to the rest corner
    {
      at: null,
      pts: [
        [bath.x, by],
        [bridge.x + bridge.len, by],
      ],
    },
    {
      at: null,
      pts: [
        [bridge.x - 1, by],
        [bridge.x - 1, rest.fish.y - 1],
      ],
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
  SQUIRCLE_P,
  centre,
  annexLand,
  outdoorSpots,
  stairs,
  STAIR_RUN,
  lawnPaths,
};
