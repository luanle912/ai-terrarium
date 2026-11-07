// The two-peak mountain on the back lawn, as 2.5D pixel art: a height field of pointed peaks cut across by thick rock
// ledges, rendered column by column (back to front, one pixel column per sixteenth of a tile) so every pixel of it
// knows its height and which way its stone faces. Tops are lit, faces turned toward y + 1 mid, toward x + 1 dark (the
// office's light); each ledge is a lit shelf with a shadow under its lip; grass climbs the foot and the low ledges,
// snow sits on the peaks and the high ledges (and comes down the mountain with env.snow); where a near ridge passes in
// front of a far one a 1 px outline parts them. The falls pour out of a notch between the peaks into the pool at the
// foot (island.mountain.gap and .pool): the rock round the pool is a cove of cliffs, the notch sits exactly gap.z px
// up and the cliff behind the water sheet is dark and wet. mountainField is pure.
import { hash } from './island-land.js';
import { boulder, bayer, mix, OUTLINE, pixelLayer, rgbOf, stamp, STONE } from './island-art.js';

const G = 16, // height samples per tile: one pixel column each on screen
  // a peak's ledges, as fractions of its height, the main peak's and the small one's
  LEDGES_MAIN = [0.2, 0.37, 0.54, 0.7],
  LEDGES_SMALL = [0.27, 0.5],
  SHELF = 0.075, // a shelf is this share of the peak's height wide (in height, along the slope)
  LIP = 4, // px of slope under a shelf's lip in its shadow
  FOOT = 1.4, // tiles over which the rock rises to its full height away from the lawn round it
  CAP_POOL = 80, // ... and away from the pool (the cove's cliffs)
  COVE_UP = 3, // the cove's wall beside the notch stands this much higher than it
  NOTCH_UP = 10, // ... and the shoulders right either side of the notch this much, rising away from it
  fields = new WeakMap();

// One peak's height at a point and what is there: { h, shelf: ledge index or -1, lip: px under a ledge's lip or -1 }.
// The foot wavers with the angle round the peak (spurs and gullies, at most 12 % out of its round),
// the flanks curve in toward a sharp tip, and at each ledge the slope pauses in a flat shelf (on most stretches).
function peakAt(p, j, x, y, out) {
  const dx = x - p.x - 0.5,
    dy = y - p.y - 0.5,
    r = Math.hypot(dx, dy),
    a = Math.atan2(dy, dx),
    spur = 1 + 0.08 * Math.sin(3 * a + 6.28 * hash(j, 1, 70)) + 0.04 * Math.sin(5 * a + 6.28 * hash(j, 2, 70)),
    q = r / (p.R * spur);
  out.h = 0;
  out.shelf = -1;
  out.lip = -1;
  if (q >= 1) return out;
  const base = p.h * (1 - q) ** 1.1,
    ledges = p.main ? LEDGES_MAIN : LEDGES_SMALL;
  out.h = base;
  for (let k = 0; k < ledges.length; k++) {
    if (Math.sin(2 * a + k * 2.3 + j * 1.1) < -0.55) continue; // a break in the ledge
    const L = p.h * ledges[k] + 3 * Math.sin(2 * a + k * 1.7 + j),
      s = SHELF * p.h;
    if (base >= L && base < L + s) {
      out.h = L;
      out.shelf = k;
    } else if (base < L && base >= L - LIP) out.lip = L - base;
  }
  return out;
}

// The mountain's height field over its tiles and the pool's, worked out once per island: h (px) at every sample
// (X0 + i / G, Y0 + j / G), with shelf (ledge index + 1, 0 none), lip (px under a lip + 1, 0 none), peak (whose rock)
// and wet (the cliff behind the falls). at(x, y) reads it back.
export function mountainField(island) {
  const m = island.mountain;
  if (!m) return null;
  if (fields.has(m)) return fields.get(m);
  const tiles = [...m.cells, ...m.pool.cells].map(k => k.split(',').map(Number)),
    X0 = Math.min(...tiles.map(t => t[0])) - 1,
    Y0 = Math.min(...tiles.map(t => t[1])) - 1,
    NX = (Math.max(...tiles.map(t => t[0])) + 2 - X0) * G + 1,
    NY = (Math.max(...tiles.map(t => t[1])) + 2 - Y0) * G + 1,
    n = NX * NY,
    h = new Float32Array(n),
    shelf = new Int8Array(n),
    lip = new Float32Array(n),
    peak = new Int8Array(n),
    wet = new Uint8Array(n),
    pool = [...m.pool.cells].map(k => k.split(',').map(Number)),
    px0 = Math.min(...pool.map(t => t[0])),
    py0 = Math.min(...pool.map(t => t[1])),
    px1 = Math.max(...pool.map(t => t[0])) + 1,
    py1 = Math.max(...pool.map(t => t[1])) + 1,
    rock = (x, y) => m.cells.has(x + ',' + y),
    gap = m.gap,
    one = { h: 0, shelf: -1, lip: -1 },
    [a, b] = m.peaks,
    ax = a.x + 0.5,
    ay = a.y + 0.5,
    vx = b.x - a.x,
    vy = b.y - a.y;
  // the distance from a point out to the nearest tile that is neither rock nor pool (the lawn round the mountain or
  // the sky past the shore), looked at within reach
  const outside = (x, y) => {
    let d = 9;
    for (let ty = Math.floor(y) - 4; ty <= Math.floor(y) + 4; ty++)
      for (let tx = Math.floor(x) - 4; tx <= Math.floor(x) + 4; tx++) {
        if (rock(tx, ty) || m.pool.cells.has(tx + ',' + ty)) continue;
        d = Math.min(d, Math.hypot(Math.max(tx - x, 0, x - tx - 1), Math.max(ty - y, 0, y - ty - 1)));
      }
    return d;
  };
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const x = X0 + i / G,
        y = Y0 + j / G,
        at = j * NX + i,
        dPool = Math.hypot(Math.max(px0 - x, 0, x - px1), Math.max(py0 - y, 0, y - py1));
      if (dPool === 0 || !rock(Math.floor(x), Math.floor(y))) continue;
      let H = 0;
      m.peaks.forEach((p, k) => {
        peakAt(p, k, x, y, one);
        if (one.h > H) {
          H = one.h;
          shelf[at] = one.shelf + 1;
          lip[at] = one.lip + 1;
          peak[at] = k;
        }
      });
      // the saddle between the peaks: a ridge a third as high as the lower peak, falling away either side
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy))),
        dr = Math.hypot(x - ax - t * vx, y - ay - t * vy),
        ridge = 0.36 * Math.min(a.h, b.h) * Math.max(0, 1 - dr / 2.4) ** 1.2;
      if (ridge > H) {
        H = ridge;
        shelf[at] = lip[at] = 0;
      }
      // the cove round the pool: cliffs behind and beside it, rising away from the notch either side (lower on the
      // pool's right), open toward the front lawn
      if (y < py1) {
        const top = (gap.z + COVE_UP + 12 * Math.min(1, Math.abs(x - gap.x) / 1.6)) * (x > px1 ? 0.6 : 1),
          cove = top * Math.max(0, Math.min(1, 1 - (dPool - 0.5) / 2.2)) ** 0.8;
        if (cove > H) {
          H = cove;
          shelf[at] = lip[at] = 0;
        }
      }
      H = Math.min(H * Math.min(1, outside(x, y) / FOOT) ** 0.7, CAP_POOL * dPool);
      // the notch the falls pour over: exactly gap.z up, the cliff under it wet, between two shoulders of rock that
      // stand NOTCH_UP higher, cut flush with it over the pool
      const across = Math.abs(x - gap.x) - gap.w - 0.12;
      if (across < 0.6 && y < gap.y + 1e-6 && y > gap.y - 0.7 && H > 0) {
        H = across < 0 ? gap.z : Math.max(H, gap.z + NOTCH_UP + 14 * across);
        shelf[at] = lip[at] = 0;
        wet[at] = across < 0 ? 1 : 0;
      }
      h[at] = H;
    }
  const at = (x, y) => {
    const i = Math.round((x - X0) * G),
      j = Math.round((y - Y0) * G);
    return i < 0 || j < 0 || i >= NX || j >= NY ? 0 : h[j * NX + i];
  };
  const f = { X0, Y0, NX, NY, h, shelf, lip, peak, wet, at };
  fields.set(m, f);
  return f;
}

// Which sample paints each pixel of the mountain, back to front: for a scene origin, worked out once. Each sample
// paints a column from its height down to the lawn; nearer samples paint over farther ones. Pixels are in a box
// (bx, by, bw, bh) of logical px; own is the sample's index + 1 (0 empty), z the pixel's height above the lawn.
const columns = new WeakMap();
function columnsOf(island, OX, OY) {
  const f = mountainField(island),
    hit = columns.get(f);
  if (hit && hit.OX === OX && hit.OY === OY) return hit;
  const { X0, Y0, NX, NY, h } = f,
    sx0 = OX + (X0 - Y0) * 16,
    sy0 = OY + (X0 + Y0) * 8,
    maxH = h.reduce((v, q) => (q > v ? q : v), 0);
  const bx = sx0 - NY,
    bw = NX + NY + 2,
    by = Math.floor(sy0 - maxH) - 2,
    bh = Math.ceil((NX + NY) / 2 + maxH) + 4,
    own = new Int32Array(bw * bh),
    z = new Float32Array(bw * bh);
  for (let s = 0; s < NX + NY - 1; s++)
    for (let i = Math.max(0, s - NY + 1); i <= Math.min(NX - 1, s); i++) {
      const j = s - i,
        at = j * NX + i,
        H = h[at];
      if (H < 0.6) continue;
      const cx = sx0 + i - j - bx,
        g = sy0 + s / 2 - by,
        top = Math.round(g - H),
        bot = Math.round(g);
      for (let r = top; r <= bot; r++) {
        own[r * bw + cx] = at + 1;
        z[r * bw + cx] = g - r;
      }
    }
  const out = { OX, OY, bx, by, bw, bh, own, z };
  columns.set(f, out);
  return out;
}

const ROCK = [STONE.light, STONE.mid, STONE.dark, STONE.deep],
  GRASS = ['#62b24e', '#55a344', '#47903b', '#3c7d33'],
  SNOWY = ['#f6f9fb', '#e6eef7', '#d3e0f0', '#c4d4ea'],
  SHADOW = '#45425a',
  WET = '#4a4860',
  WATER = '#556079', // the wet stone of the notch's floor, where the stream runs to the edge
  EDGE = '#c9c7d4';
// The mountain, its pixels coloured for this bake's light and snow (0..1), then a few boulders at its front foot.
export function drawMountain(pt, P, C, island, snow) {
  const f = mountainField(island);
  if (!f) return;
  const [OX, OY] = P(0, 0, 0),
    c = columnsOf(island, OX, OY),
    { NX, h, shelf, lip, peak, wet } = f,
    { bw, bh, own, z } = c,
    L = pixelLayer(bw, bh),
    rgb = rgbOf(C),
    peaks = island.mountain.peaks,
    s = snow || 0,
    H = at => (at < 0 || at >= h.length ? 0 : h[at]),
    depth = at => (at % NX) + Math.floor(at / NX); // i + j: how far forward a sample stands
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const o = own[y * bw + x] - 1;
      if (o < 0) continue;
      const pz = z[y * bw + x],
        top = h[o],
        p = peaks[peak[o]],
        body = pz < top - 1.5,
        i = o % NX;
      // which way the stone faces, by its slope: gentle is a lit top; steeper, mid toward y + 1 and dark toward
      // x + 1 (the deepest tone turned away), the bands meeting in a narrow dither
      const dz = body ? 0 : bayer(x, y) - 0.5,
        gx = (H(o + 3) - H(o - 3)) / 6,
        gy = (H(o + 3 * NX) - H(o - 3 * NX)) / 6,
        steep = Math.min(1, Math.hypot(gx, gy) / 1.6) + dz * 0.1,
        side = Math.max(0, Math.min(1, Math.atan2(-gx, -gy) / (Math.PI / 2))) + dz * 0.12,
        idx = steep < 0.32 ? 0 : side < 0.45 ? 1 : side < 0.9 ? 2 : 3;
      let col = ROCK[idx];
      const k = shelf[o] - 1,
        under = lip[o] - 1;
      if (wet[o]) col = body ? WET : WATER;
      else if (k >= 0 && !body) {
        // a ledge's shelf: lit, its front edge lighter; grass on the lowest, snow on the high ones
        const below = own[(y + 1) * bw + x] - 1,
          edge = y + 1 < bh && (below < 0 || h[below] < top - 2);
        col = edge ? EDGE : ROCK[0];
        const ledges = p.main ? LEDGES_MAIN : LEDGES_SMALL;
        if (k === 0) col = GRASS[edge ? 0 : 1];
        else if (ledges[k] >= 0.5 - 0.3 * s) col = SNOWY[edge ? 0 : 1];
      } else if (under >= 0 && !body) col = under < 1.5 ? SHADOW : ROCK[Math.min(3, idx + 1)];
      // grass up the foot in a ragged line, snow on the peaks (lower down with snow on the island)
      const grass = 5 + 7 * (0.5 + 0.5 * Math.sin(i * 0.09 + Math.floor(o / NX) * 0.05)) + 3 * hash(x >> 1, y >> 1, 71);
      if (pz < grass * Math.min(1, p.h / 50) && !wet[o]) col = GRASS[Math.min(3, idx)];
      const cap = p.h * ((p.main ? 0.84 : 0.88) - 0.5 * s) + 2 * hash(x, y >> 1, 72);
      if (pz > cap && !(idx >= 2 && hash(x, y, 73) < 0.4)) col = SNOWY[idx];
      let out = rgb(col, col === GRASS[Math.min(3, idx)] ? 0.85 : col === WATER ? 0.6 : 0);
      if (s > 0.3 && idx <= 1 && pz > 6 && col !== SHADOW && !wet[o]) out = rgb(mix(col, SNOWY[idx], Math.min(1, s)));
      // the outline where a near ridge stands in front of a far one
      const d = depth(o),
        far = (xx, yy) => {
          const q = own[yy * bw + xx] - 1;
          return q >= 0 && d - depth(q) > 24;
        };
      if ((y > 0 && far(x, y - 1)) || (x > 0 && far(x - 1, y)) || (x + 1 < bw && far(x + 1, y))) out = rgb(OUTLINE);
      L.set(x, y, out);
    }
  L.flush();
  stamp(pt.ctx, L.cv, c.bx, c.by);
  // boulders at the front foot: on rock tiles just behind the lawn, where the slope is still low
  const m = island.mountain,
    foot = [...m.cells]
      .map(k => k.split(',').map(Number))
      .filter(
        ([x, y]) => (!m.cells.has(x + 1 + ',' + y) || !m.cells.has(x + ',' + (y + 1))) && f.at(x + 0.5, y + 0.5) < 5,
      )
      .filter(([x, y]) => !m.pool.rim.some(r => r.x === x && r.y === y) && island.cells.has(x + 1 + ',' + (y + 1)))
      .sort((p, q) => hash(p[0], p[1], 74) - hash(q[0], q[1], 74))
      .slice(0, 4)
      .sort((p, q) => p[0] + p[1] - q[0] - q[1]);
  for (const [x, y] of foot) {
    const [bx, by] = P(x + 0.3 + 0.4 * hash(x, y, 75), y + 0.3 + 0.4 * hash(x, y, 76), 0);
    boulder(pt, C, bx, by, hash(x, y, 77) > 0.5 ? 1 : 0);
  }
}
