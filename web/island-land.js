// The office island's land (no DOM, no canvas): its squircle shape, the cone-shaped underside, the outdoor spots,
// the pond and waterfall, the garden paths and the decor. Pure and deterministic: every position comes from the grid
// and hash(), so the island looks the same on every machine. web/sky-logic.js re-exports it as SkyLogic.
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
const SQUARE_MARGIN = 4,
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
  // The waterfall pours out of a small pond on the east shore; agents bathe at two of its cells.
  const east = list.filter(c => !cells.has(key(c.x + 1, c.y))).sort((a, b) => b.y - a.y);
  const fall = east[Math.min(2, east.length - 1)];
  const pond = new Set();
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -2; dx <= 0; dx++) {
      const x = fall.x + dx,
        y = fall.y + dy;
      if (cells.has(key(x, y)) && !nearOffice(x, y) && !inSpot(x, y)) pond.add(key(x, y));
    }
  const pondSpots = [
    { x: fall.x - 1, y: fall.y },
    { x: fall.x - 1, y: fall.y - 1 },
    { x: fall.x - 2, y: fall.y },
    { x: fall.x - 1, y: fall.y + 1 },
  ]
    .filter(s => pond.has(key(s.x, s.y)))
    .slice(0, 2);
  const paths = lawnPaths(W, H, stairs(W, H), pondSpots);
  const decor = [];
  for (const c of list) {
    if (nearOffice(c.x, c.y) || inSpot(c.x, c.y) || pond.has(key(c.x, c.y)) || paths.cells.has(key(c.x, c.y))) continue;
    const r = hash(c.x, c.y, 2);
    // Sparse on purpose: a few trees read as a lawn, dozens read as clutter.
    if (r < 0.035) decor.push({ x: c.x, y: c.y, kind: 'tree' });
    else if (r < 0.06) decor.push({ x: c.x, y: c.y, kind: 'rock' });
    else if (r < 0.2) decor.push({ x: c.x, y: c.y, kind: 'flower' });
  }
  return {
    cells,
    list,
    depth: new Map(list.map(c => [key(c.x, c.y), c.d])),
    bounds: { minX, maxX, minY, maxY },
    spots,
    decor,
    waterfall: { x: fall.x, y: fall.y },
    pond: { cells: pond, spots: pondSpots },
    paths,
    shape,
  };
}

// ---- garden paths ----
// Stepping-stone paths laid where agents really walk (desire lines): from the foot of each stair flight to the pond
// (the restroom block is reached across the pantry floor, not from the lawn). They run one tile
// clear of the plinth front, so the big front lawn stays whole. Each leg is a list of waypoints that share a row or a
// column; `cells` are the tiles they cover (agents prefer them), `lines` the same legs in world coordinates for
// drawing, starting just past the bottom step instead of at the tile centre under it.
function lawnPaths(W, H, st, pondSpots) {
  const e = st.find(s => s.side === 'east'),
    s = st.find(s => s.side === 'south');
  const bath = pondSpots.reduce((a, b) => (b.y < a.y ? b : a)),
    row = H + 1,
    sx = s.x + s.len - 1;
  const legs = [
    {
      at: 'south',
      pts: [
        [sx, H],
        [sx, row],
        [bath.x, row],
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
    // along the front of the restroom block to the smoking corner's entrance beside it
    {
      at: 'east',
      pts: [
        [e.x, e.y],
        [W + 5, e.y],
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
    const out = [at === 'east' ? [x + STAIR_RUN + 0.25, y + 0.5] : [x + 0.5, y + STAIR_RUN + 0.25], next];
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
