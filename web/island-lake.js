// The big lake at the island's bottom point (6 o'clock on screen) and everything on it: the water, the main
// waterfall, the bathing spots, the one-pillar pavilion and its stepping stones, lotus, duckweed, the ducks' swimming
// lanes and the rest corner on its inner bank. Pure data from the grid and hash(), like web/island-land.js, which
// builds the island and calls lakeOf() once.
import { key, pos, N4, hash } from './island-grid.js';

// The lake in the island's screen axes, from the shape's centre: u = dx + dy runs down the screen (8 px a unit), v =
// dx - dy across it (16 px a unit). A rounded superellipse of power p, its middle `back` units up from the bottom point
// (u = 2R), ru down and rv across, so it reaches into the point and reads wider than tall on screen. About twice the
// first island's lake (60 tiles).
const LAKE = { back: 11, ru: 11, rv: 9.5, p: 2.4 };
// Water may run right up to the shore only this close to the bottom point (in u), where it spills over as the main
// waterfall; everywhere else a bank of lawn rings it.
const LIP = 3;

export function lakeOf({ cells, shape, free }) {
  const { cx, cy, R } = shape,
    uv = (x, y) => [x + 0.5 - cx + (y + 0.5 - cy), x + 0.5 - cx - (y + 0.5 - cy)],
    tipU = 2 * R;
  const wettable = (x, y) =>
    free(x, y) && (uv(x, y)[0] >= tipU - LIP || N4.every(([a, b]) => cells.has(key(x + a, y + b))));
  const lake = new Set();
  for (const k of cells) {
    const [x, y] = pos(k),
      [u, v] = uv(x, y);
    const n = Math.abs((u - tipU + LAKE.back) / LAKE.ru) ** LAKE.p + Math.abs(v / LAKE.rv) ** LAKE.p;
    if (n <= 1 && wettable(x, y)) lake.add(k);
  }
  smoothLake(lake, wettable);
  // The main waterfall pours over the bottom point: the lake tile lowest on screen whose front (y + 1) face is shore,
  // the middlemost if two tie.
  const [fx, fy] = [...lake]
    .map(pos)
    .filter(([x, y]) => !cells.has(key(x, y + 1)))
    .sort((a, b) => uv(...b)[0] - uv(...a)[0] || Math.abs(uv(...a)[1]) - Math.abs(uv(...b)[1]))[0];
  // Agents bathe at the north tip of the lake, where the garden path arrives from the north: the northmost lake tile
  // with plain lawn north of it (the middlemost across the screen), and the lake tile beside it.
  const bank = (x, y) => cells.has(key(x, y)) && !lake.has(key(x, y));
  const [bx, by] = [...lake]
    .map(pos)
    .filter(([x, y]) => bank(x, y - 1))
    .sort((a, b) => a[1] - b[1] || Math.abs(uv(...a)[1]) - Math.abs(uv(...b)[1]) || a[0] - b[0])[0];
  const next = [
    [bx, by + 1],
    [bx + 1, by],
    [bx - 1, by],
  ].find(([x, y]) => lake.has(key(x, y)));
  const pond = { cells: lake, spots: [{ x: bx, y: by }, ...(next ? [{ x: next[0], y: next[1] }] : [])] };
  const pavilion = pavilionOf(lake, pond.spots);
  // nothing floats at the lip, where the water runs over into the main waterfall
  const calm = new Set(
    [...lake].filter(k => {
      const [x, y] = pos(k);
      return Math.max(Math.abs(x - fx), Math.abs(y - fy)) > 2;
    }),
  );
  const lotus = lotusOf(calm, pavilion);
  const duckweed = duckweedOf(calm, pavilion, lotus, pond.spots);
  return {
    pond,
    waterfall: { x: fx, y: fy },
    pavilion,
    lotus,
    duckweed,
    ducks: { lanes: duckLanes(lake, pavilion, lotus) },
    rest: restOf(lake, cells, pavilion, free),
  };
}

// Round off the lake's rim the way the shore is kept free of one-tile bumps: a water tile with at most one water
// neighbour (a spur) dries up and a free tile with three or more (a notch) fills in, until nothing changes.
function smoothLake(lake, wettable) {
  const wet = (x, y) => N4.filter(([a, b]) => lake.has(key(x + a, y + b))).length;
  for (let changed = true; changed; ) {
    changed = false;
    for (const k of [...lake]) {
      const [x, y] = pos(k);
      if (wet(x, y) <= 1) {
        lake.delete(k);
        changed = true;
      }
    }
    for (const k of [...lake]) {
      const [x, y] = pos(k);
      for (const [a, b] of N4)
        if (!lake.has(key(x + a, y + b)) && wettable(x + a, y + b) && wet(x + a, y + b) >= 3) {
          lake.add(key(x + a, y + b));
          changed = true;
        }
    }
  }
}

// How many tiles each lake tile is from the nearest dry tile, counted in rings (a tile on the bank's edge is 1).
function waterDepth(lake) {
  const out = new Map();
  for (const k of lake) {
    const [x, y] = pos(k);
    let r = 1;
    for (let ok = true; ok; r++)
      for (let b = -r; b <= r && ok; b++)
        for (let a = -r; a <= r && ok; a++) if (!lake.has(key(x + a, y + b))) ok = false;
    out.set(k, r - 1);
  }
  return out;
}

// The pavilion stands on one stone pillar in the deepest part of the lake (nearest its middle when several tie), the
// hall over it centred on the pillar's tile. Stepping stones lead out to it in a straight line from the nearer inner
// bank: `path` runs from the first stone (the bank beside it) to the last (right beside the pillar). They are
// scenery: nobody walks out to the pavilion.
function pavilionOf(lake, baths) {
  const depth = waterDepth(lake),
    tiles = [...lake].map(pos),
    mx = tiles.reduce((s, [x]) => s + x, 0) / tiles.length,
    my = tiles.reduce((s, [, y]) => s + y, 0) / tiles.length,
    bath = new Set(baths.map(s => key(s.x, s.y)));
  const [px, py] = tiles
    .filter(([x, y]) => !bath.has(key(x, y)))
    .sort(
      (a, b) =>
        depth.get(key(...b)) - depth.get(key(...a)) ||
        Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my) ||
        a[0] - b[0] ||
        a[1] - b[1],
    )[0];
  // out toward the inner bank, west (-x) or north (-y), whichever is shorter and clear of the bathers
  const lineTo = ([a, b]) => {
    const out = [];
    for (let x = px + a, y = py + b; lake.has(key(x, y)); x += a, y += b) out.unshift({ x, y });
    return out.some(p => bath.has(key(p.x, p.y))) ? null : out;
  };
  const path = [lineTo([-1, 0]), lineTo([0, -1])].filter(Boolean).sort((a, b) => a.length - b.length)[0];
  return { x: px + 0.5, y: py + 0.5, pillar: { x: px, y: py }, path };
}

// Lotus leaves gather round the pillar's foot (never on it, its stones or right under the hall's eaves) and in a few
// clumps by the banks; about half carry a flower, pink more often than white.
const LOTUS_CLUMPS = 3;
function lotusOf(lake, pav) {
  const { pillar } = pav,
    stones = new Set(pav.path.map(p => key(p.x, p.y))),
    out = [],
    used = new Set();
  const put = (x, y) => {
    const h = hash(x, y, 61);
    out.push({ x, y, flower: h < 0.35 ? 'pink' : h < 0.55 ? 'white' : null });
    used.add(key(x, y));
  };
  const open = (x, y) =>
    lake.has(key(x, y)) &&
    !stones.has(key(x, y)) &&
    !used.has(key(x, y)) &&
    Math.max(Math.abs(x - pillar.x), Math.abs(y - pillar.y)) >= 2;
  for (let y = pillar.y - 3; y <= pillar.y + 3; y++)
    for (let x = pillar.x - 3; x <= pillar.x + 3; x++)
      if (open(x, y) && Math.max(Math.abs(x - pillar.x), Math.abs(y - pillar.y)) === 2 && hash(x, y, 60) < 0.5)
        put(x, y);
  // clumps by the banks: lake tiles beside the shore, spread round the lake by their hash
  const banks = [...lake]
    .map(pos)
    .filter(([x, y]) => open(x, y) && N4.some(([a, b]) => !lake.has(key(x + a, y + b))))
    .sort((a, b) => hash(a[0], a[1], 62) - hash(b[0], b[1], 62));
  const seeds = [];
  for (const [x, y] of banks) {
    if (seeds.length >= LOTUS_CLUMPS) break;
    if (seeds.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 6)) continue;
    seeds.push([x, y]);
  }
  for (const [sx, sy] of seeds)
    for (const [x, y] of [[sx, sy], ...N4.map(([a, b]) => [sx + a, sy + b])])
      if (open(x, y) && (x === sx && y === sy ? true : hash(x, y, 63) < 0.6)) put(x, y);
  return out.sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
}

// Duckweed floats in a few loose patches on open water, clear of the pavilion, its stones, the lotus and the bathers.
const WEED_PATCHES = 3;
function duckweedOf(lake, pav, lotus, baths) {
  const taken = new Set([
    key(pav.pillar.x, pav.pillar.y),
    ...pav.path.map(p => key(p.x, p.y)),
    ...lotus.map(l => key(l.x, l.y)),
    ...baths.map(s => key(s.x, s.y)),
  ]);
  const open = (x, y) => lake.has(key(x, y)) && !taken.has(key(x, y));
  const seeds = [];
  for (const [x, y] of [...lake].map(pos).sort((a, b) => hash(a[0], a[1], 64) - hash(b[0], b[1], 64))) {
    if (seeds.length >= WEED_PATCHES) break;
    if (!open(x, y) || Math.hypot(x - pav.pillar.x, y - pav.pillar.y) < 3) continue;
    if (seeds.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 5)) continue;
    seeds.push([x, y]);
  }
  const out = [];
  for (const [sx, sy] of seeds)
    for (let y = sy - 1; y <= sy + 1; y++)
      for (let x = sx - 1; x <= sx + 1; x++)
        if (open(x, y) && (Math.abs(x - sx) + Math.abs(y - sy) <= 1 || hash(x, y, 65) < 0.4)) {
          out.push({ x, y });
          taken.add(key(x, y));
        }
  return out;
}

// The ducks' swimming lanes: two or three closed loops (rounded rings of LANE_PTS points, in tile coordinates) on
// open water, each a tile clear of the bank, off the pavilion's hall, its stones and the lotus, and apart from each
// other. Each candidate ring is tried at its points and between them; the widest that fit win.
const LANE_PTS = 12,
  MAX_LANES = 3;
function duckLanes(lake, pav, lotus) {
  const { pillar } = pav,
    stones = new Set(pav.path.map(p => key(p.x, p.y))),
    leaves = new Set(lotus.map(l => key(l.x, l.y)));
  const water = (x, y) => {
    const cx = Math.floor(x),
      cy = Math.floor(y);
    if (Math.max(Math.abs(cx - pillar.x), Math.abs(cy - pillar.y)) <= 1) return false;
    if (stones.has(key(cx, cy)) || leaves.has(key(cx, cy))) return false;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (!lake.has(key(cx + a, cy + b))) return false;
    return true;
  };
  const ring = (x, y, r) =>
    Array.from({ length: LANE_PTS }, (_, i) => {
      const t = (i / LANE_PTS) * Math.PI * 2;
      return [Math.round((x + Math.cos(t) * r) * 100) / 100, Math.round((y + Math.sin(t) * r * 0.8) * 100) / 100];
    });
  const fits = pts =>
    pts.every((p, i) => {
      const q = pts[(i + 1) % pts.length];
      for (let s = 0; s < 4; s++)
        if (!water(p[0] + ((q[0] - p[0]) * s) / 4, p[1] + ((q[1] - p[1]) * s) / 4)) return false;
      return true;
    });
  const tries = [];
  for (const k of lake) {
    const [x, y] = pos(k);
    for (const r of [2.5, 2, 1.5, 1.2]) tries.push({ x: x + 0.5, y: y + 0.5, r, h: hash(x, y, 66) });
  }
  tries.sort((a, b) => b.r - a.r || a.h - b.h);
  const lanes = [],
    mids = [];
  for (const c of tries) {
    if (lanes.length >= MAX_LANES) break;
    if (mids.some(m => Math.hypot(m.x - c.x, m.y - c.y) < m.r + c.r + 1)) continue;
    const pts = ring(c.x, c.y, c.r);
    if (!fits(pts)) continue;
    lanes.push(pts);
    mids.push(c);
  }
  return lanes;
}

// The rest corner on the lake's inner (west) bank, a few rows north of the pavilion's stones: a fishing spot on the
// bank with the lake right in front of it (+x), and the stone bench a tile further back and two rows up. The garden
// path ends right north of the fishing spot.
function restOf(lake, cells, pav, free) {
  const land = (x, y) => free(x, y) && !lake.has(key(x, y));
  const fits = ([x, y]) =>
    land(x, y) && lake.has(key(x + 1, y)) && land(x, y - 1) && land(x - 1, y - 2) && land(x - 1, y - 1);
  const py = pav.pillar.y;
  const spots = [...cells]
    .map(pos)
    .filter(([x, y]) => y <= py - 3 && fits([x, y]))
    .sort((a, b) => Math.abs(a[1] - (py - 3)) - Math.abs(b[1] - (py - 3)) || a[0] - b[0]);
  const [x, y] = spots[0];
  return { bench: { x: x - 1, y: y - 2 }, fish: { x, y } };
}
