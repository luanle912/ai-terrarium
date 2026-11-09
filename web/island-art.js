// The static pieces of the office island that web/sky-island.js bakes into the island image: the stone block
// underside, the shore, the lamp posts (unlit; web/island-life.js lights them), bushes, mushrooms, rocks and the stone
// bench of the rest corner, plus the colour and pixel helpers the other art modules share (the mountain and its pool
// are in web/island-art-mountain.js, the lake and the pavilion in web/island-art-lake.js). Every function draws in
// the scene's logical px through P (the lawn level projection) and takes its colours through C(colour, snowAmount),
// which applies the island's light and snow.
import { hash, N4 } from './island-land.js';

// Colour helpers for '#rrggbb' strings, shared by the island modules (web/sky-island.js re-exports them).
export const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const toHex = a =>
  '#' +
  a
    .map(v =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
export const mix = (a, b, p) => {
  const A = hex(a),
    B = hex(b);
  return toHex(A.map((v, i) => v * (1 - p) + B[i] * p));
};
export const OUTLINE = '#3B2F4A';
// Night pulls every island colour toward the same deep blue the office uses after dark.
export const night = (c, df) => mix(c, '#0d1322', (1 - df) * 0.6);
export const STONE = { light: '#aeacba', mid: '#8b8999', dark: '#6a687b', deep: '#545268' };

// Painting helpers bound to one context and projection: a filled polygon of island points, an axis-aligned box
// standing on the lawn (top, the lit y + 1 face and the shaded x + 1 face) and a pixel shape from rows of widths.
export function painter(ctx, P) {
  // seal: also stroke the edge half a pixel wide, so faces that meet leave no hairline gap between them
  const poly = (pts, c, seal) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
    if (seal) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  };
  const box = (x0, x1, y0, y1, z0, z1, top, left, right) => {
    poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], left);
    poly([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], right);
    poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], top);
  };
  // rows of [left offset, width] from the top row down, drawn at (x, y) = top-left in px
  const rows = (x, y, rs, c) => {
    ctx.fillStyle = c;
    rs.forEach(([o, w], i) => ctx.fillRect(x + o, y + i, w, 1));
  };
  return { ctx, poly, box, rows };
}

// ---- pixel layers ----
// The water and the pavilion are painted pixel by pixel at the scene's own size (one logical
// px is one pixel) on a canvas of their own, then stamped up to the bake's scale unsmoothed: they keep hard pixel
// edges and pixels as big as the rest of the scene's at every zoom.
export function pixelLayer(w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w));
  cv.height = Math.max(1, Math.ceil(h));
  const g = cv.getContext('2d'),
    img = g.createImageData(cv.width, cv.height),
    d = img.data,
    W = cv.width;
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= cv.height) return;
    const i = (y * W + x) * 4;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  };
  const flush = () => g.putImageData(img, 0, 0);
  return { cv, g, img, set, flush, w: W, h: cv.height };
}
// Draws a pixel layer (or any small canvas) onto ctx at (x, y) logical px without smoothing.
export function stamp(ctx, cv, x = 0, y = 0) {
  const s = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, x, y);
  ctx.imageSmoothingEnabled = s;
}
// A 1 px ring of colour round whatever is drawn on the canvas (the pixel art outline).
export function outlinePx(cv, colour) {
  const g = cv.getContext('2d'),
    W = cv.width,
    H = cv.height,
    img = g.getImageData(0, 0, W, H),
    d = img.data,
    c = hex(colour),
    solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 127,
    ring = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (!solid(x, y) && N4.some(([a, b]) => solid(x + a, y + b))) ring.push(y * W + x);
  for (const i of ring) {
    d[i * 4] = c[0];
    d[i * 4 + 1] = c[1];
    d[i * 4 + 2] = c[2];
    d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
// A polygon filled with whole pixels (the ones whose centre is inside), no anti-aliasing: on a pixel layer.
export function fillPx(g, pts, colour) {
  let y0 = Infinity,
    y1 = -Infinity;
  for (const p of pts) {
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  }
  g.fillStyle = colour;
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    const c = y + 0.5,
      xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      if (a[1] <= c !== b[1] <= c) xs.push(a[0] + ((c - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.round(xs[i]),
        xb = Math.round(xs[i + 1]);
      if (xb > xa) g.fillRect(xa, y, xb - xa, 1);
    }
  }
}
// A 1 px line between two points (Bresenham), for posts, struts and strings.
export function linePx(g, a, b, colour) {
  let x0 = Math.round(a[0]),
    y0 = Math.round(a[1]);
  const x1 = Math.round(b[0]),
    y1 = Math.round(b[1]),
    dx = Math.abs(x1 - x0),
    dy = -Math.abs(y1 - y0),
    sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  g.fillStyle = colour;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) {
      e += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      e += dx;
      y0 += sy;
    }
  }
}
// The 2x2 ordered dither: 0, 0.5, 0.75, 0.25 over a pixel's (x, y) parity, for stepped colour bands that blend.
export const bayer = (x, y) => [0, 0.5, 0.75, 0.25][(x & 1) + ((y & 1) << 1)];
// A pixel layer worked out once and recoloured at every bake: each pixel holds an index into a list of
// [colour, snow] keys (0 is clear), so a new light or snow level only maps the few keys through C and writes the
// pixels. g takes the canvas calls fillPx and linePx make (whole-pixel fillRects in one fillStyle) and records them.
export function paletteLayer(w, h) {
  const W = Math.max(1, Math.ceil(w)),
    H = Math.max(1, Math.ceil(h)),
    idx = new Uint16Array(W * H),
    keys = [],
    ids = new Map();
  let y0 = H,
    y1 = 0;
  const key = (c, s = 0) => {
    const k = c + '|' + s;
    let i = ids.get(k);
    if (i === undefined) {
      keys.push([c, s]);
      ids.set(k, (i = keys.length));
    }
    return i;
  };
  const fill = (x, y, w, h, i) => {
    const xa = Math.max(0, x),
      xb = Math.min(W, x + w),
      ya = Math.max(0, y),
      yb = Math.min(H, y + h);
    if (xa >= xb || ya >= yb) return;
    for (let r = ya; r < yb; r++) idx.fill(i, r * W + xa, r * W + xb);
    y0 = Math.min(y0, ya);
    y1 = Math.max(y1, yb);
  };
  const set = (x, y, i) => fill(x, y, 1, 1, i);
  const g = {
    fillStyle: '',
    fillRect(x, y, w, h) {
      fill(x, y, w, h, key(this.fillStyle));
    },
  };
  // the layer in C's colours, on a canvas of its own
  const paint = C => {
    const L = pixelLayer(W, H),
      px = new Uint32Array(L.img.data.buffer),
      pal = new Uint32Array(keys.length + 1);
    keys.forEach(([c, s], i) => {
      const [r, gr, b] = hex(C(c, s));
      pal[i + 1] = ((255 << 24) | (b << 16) | (gr << 8) | r) >>> 0; // RGBA bytes on a little-endian machine
    });
    for (let i = y0 * W, e = y1 * W; i < e; i++) if (idx[i]) px[i] = pal[idx[i]];
    if (y1 > y0) L.g.putImageData(L.img, 0, 0, 0, y0, W, y1 - y0);
    return L.cv;
  };
  return { w: W, h: H, idx, keys, key, set, g, paint };
}
// A cache of light-independent layers per island and scene frame (world mode bakes many islands, each its own).
export function perFrame(store, island, frame, make) {
  let per = store.get(island);
  if (!per) store.set(island, (per = new Map()));
  const k = frame.LW + ',' + frame.LH + ',' + frame.OX + ',' + frame.OY;
  if (!per.has(k)) per.set(k, make());
  return per.get(k);
}
// Light colours for a pixel layer, worked out once per bake: rgb(colour, snow) is C's colour as [r, g, b].
export function rgbOf(C) {
  const memo = new Map();
  return (c, s = 0) => {
    const k = c + s;
    if (!memo.has(k)) memo.set(k, hex(C(c, s)));
    return memo.get(k);
  };
}

// ---- the underside: stacked grey stone columns under the lawn ----
// As on the first island (spec 11.11): every tile hangs a column of grey stone as deep as the cone's depth there (deep
// under the middle, short toward the shore), so the underside still narrows to a point, but in steps of stone blocks.
// A column shows its y + 1 face (lit) and its x + 1 face (shaded) wherever it hangs lower than its neighbour in front;
// each face is laid in blocks BLOCK px high, staggered from column to column, each block a little lighter or darker
// than the next, with a dark joint under it. The stone turns a deeper grey past DEEP_Z px down. Only a thin layer of
// soil (SOIL_Z px) shows, right under the grass along the shore, where the grass hangs over it in a wavy lip
// (shoreFace). Painted in whole pixels (centres inside), back to front, on a layer of its own.
const STONE_TOP = '#7a7a84',
  STONE_DEEP = '#5f6070',
  SOIL = { left: '#74492b', right: '#58371f' },
  LIP = { left: '#4f9c40', right: '#3f8535', edge: '#356f2d' },
  SOIL_Z = 4,
  BLOCK = 10,
  DEEP_Z = 60;
// How far the grass hangs over the soil at a point of the shore: 1-4 px in long, soft waves.
const lipAt = (u, v) => 2.4 + 1.1 * Math.sin(u * 1.7 + v * 0.9) + 0.5 * Math.sin(u * 4.1 - v * 2.3);
const undersides = new WeakMap();
export function drawUnderside(pt, P, C, island, frame) {
  stamp(pt.ctx, undersideLayer(P, island, frame).paint(C));
}
// The underside's pixels in palette keys, painted once per island and frame (only the light changes between bakes).
export function undersideLayer(P, island, frame) {
  return perFrame(undersides, island, frame, () => paintUnderside(P, island, frame));
}
function paintUnderside(P, island, frame) {
  const L = paletteLayer(frame.LW, frame.LH),
    g = L.g,
    dep = (x, y) => island.depth.get(x + ',' + y),
    tones = new Map();
  // a block's stone: its band's grey, lighter or darker by up to 8 %, shaded on the x + 1 face; its joint darker still
  const tone = (deep, j, lit) => {
    const k = deep + ',' + j + ',' + lit;
    if (!tones.has(k)) {
      const base = mix(deep ? STONE_DEEP : STONE_TOP, j > 0 ? '#ffffff' : '#000000', Math.abs(j) / 100),
        face = lit ? base : mix(base, '#000000', 0.3);
      tones.set(k, [face, mix(face, '#000000', 0.28)]);
    }
    return tones.get(k);
  };
  for (const { x, y, d } of island.list) {
    const stagger = Math.floor(hash(x, y, 54) * BLOCK);
    for (const lit of [true, false]) {
      const front = lit ? dep(x, y + 1) : dep(x + 1, y),
        top = front === undefined ? -SOIL_Z : -front;
      if (top <= -d) continue;
      const at = (t, z) => (lit ? P(x + t, y + 1, z) : P(x + 1, y + t, z));
      // blocks between joints at stagger + n BLOCK px down from the lawn, clipped to this face
      for (let n = Math.floor((-top - stagger) / BLOCK); stagger + n * BLOCK < d; n++) {
        const z0 = Math.min(top, -(stagger + n * BLOCK)),
          z1 = Math.max(-d, -(stagger + (n + 1) * BLOCK));
        if (z0 <= z1) continue;
        const j = Math.round((hash(x * 3 + (lit ? 1 : 0), y, 60 + n) - 0.5) * 16),
          [stone, joint] = tone(-z1 > DEEP_Z, j, lit);
        fillPx(g, [at(0, z0), at(1, z0), at(1, z1), at(0, z1)], stone);
        linePx(g, at(0, z1), at(1, z1), joint);
      }
    }
  }
  return L;
}
// The soil layer and the grass lip on one shore face of a lawn tile: plane 'y' (its y + 1 edge) or 'x' (x + 1).
// bare: soil only (under the lip the main fall spills over).
export function shoreFace(pt, P, C, x, y, plane, bare) {
  const lit = plane === 'y',
    at = (t, z) => (lit ? P(x + t, y + 1, z) : P(x + 1, y + t, z)),
    side = lit ? 'left' : 'right';
  pt.poly([at(0, 0), at(1, 0), at(1, -SOIL_Z), at(0, -SOIL_Z)], C(SOIL[side]), true);
  if (bare) return;
  // the grass lip hangs 1-4 px in waves that run on along the shore from tile to tile
  const wave = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    wave.push(at(t, -lipAt(lit ? x + t : y + t, lit ? y : x)));
  }
  pt.poly([at(0, 0), at(1, 0), ...wave.slice().reverse()], C(LIP[side], 0.7));
  pt.poly([...wave, ...wave.map(([a, b]) => [a, b + 1]).reverse()], C(LIP.edge, 0.6));
}

// ---- the pavilion's lantern ----
// The pavilion on one pillar in the lake (web/island-art-lake.js draws it): heights in px above the lawn. Its lantern
// hangs under the front corner of the lower roof's eaves; web/island-life.js glows there after dark.
export const PAVILION = {
  // heights in px above the lawn: the pillar's top, the platform's, the eaves and tops of the two roofs
  z: { floor: 18, deck: 20, eave: 35, roof: 41, eave2: 44, roof2: 50 },
  // half-widths in tiles: the pillar, the platform, the hall, the roofs' eaves and tops, the small upper hall
  r: { pillar: 0.16, deck: 0.66, hall: 0.44, eave: 0.7, top: 0.32, upper: 0.26, eave2: 0.5, top2: 0.08 },
  // the lantern: this far out toward the front corner (x and y, tiles) and this high (px, its middle)
  lantern: { out: 0.6, z: 30 },
};
// Where the pavilion's lantern hangs, in island coordinates: x, y in tiles, z px above the lawn (the middle of the
// lantern), or null on an island without a pavilion.
// Worked out once per island (it is read every frame).
const lanterns = new WeakMap();
export function pavilionLantern(island) {
  if (!lanterns.has(island)) {
    const p = island.pavilion,
      l = PAVILION.lantern;
    lanterns.set(island, p ? { x: p.x + l.out, y: p.y + l.out, z: l.z } : null);
  }
  return lanterns.get(island);
}

// ---- the lamps, the bench ----
const WOOD = { dark: '#5a3920' };
// Where a lamp's light hangs, in island coordinates (x, y in tiles, z in px above the lawn): LAMP_Z over its tile's
// centre (web/island-life.js glows there).
export const LAMP_Z = 15;
// Pixel sprites drawn from strings, one per row; a character not in the palette is left clear.
function sprite(pt, x, y, rows, pal) {
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++)
      if (pal[r[i]]) {
        pt.ctx.fillStyle = pal[r[i]];
        pt.ctx.fillRect(x + i, y + j, 1, 1);
      }
  });
}
// The lamp sprite, bottom row on the lawn; the glass's middle row sits LAMP_Z px up, in column `at`.
const POLE_LAMP = {
  at: 3,
  rows: [
    '..kkk..',
    '.kkkkk.',
    '.kgggk.',
    '.kgggk.',
    '.kgGgk.',
    '.kgggk.',
    '.kkkkk.',
    '..kpk..',
    ...Array(10).fill('...p...'),
    '..kkk..',
    '.kkkkk.',
  ],
};
// A lamp post with its glass lamp unlit (the glow is drawn after dark by web/island-life.js).
export function drawLamp(pt, P, C, island, l) {
  const s = POLE_LAMP,
    [bx, by] = P(l.x + 0.5, l.y + 0.5, 0),
    X = Math.round(bx),
    Y = Math.round(by),
    glass = s.rows.findIndex(r => r.includes('G'));
  pt.rows(X - 4, Y, [[0, 8]], 'rgba(0,0,0,0.18)');
  sprite(pt, X - s.at, Y - LAMP_Z - glass, s.rows, {
    k: C('#3b3a4a'),
    p: C('#4c4a5c'),
    g: C('#d9cfa4'),
    G: C('#e6dcb2'),
    d: C(WOOD.dark),
  });
}
// The stone bench of the rest corner, long along x, so who sits on it looks out over the lake (y + 1).
export function drawBench(pt, P, C, b) {
  const { x, y } = b,
    top = C(STONE.light, 0.85),
    left = C(STONE.mid, 0.3),
    right = C(STONE.dark, 0.3);
  const [sx, sy] = P(x + 0.5, y + 0.5, 0);
  pt.rows(
    Math.round(sx) - 9,
    Math.round(sy) - 2,
    [
      [2, 14],
      [0, 18],
      [2, 14],
    ],
    'rgba(0,0,0,0.16)',
  );
  for (const lx of [x + 0.2, x + 0.68]) pt.box(lx, lx + 0.12, y + 0.36, y + 0.62, 0, 4, top, left, right);
  pt.box(x + 0.1, x + 0.9, y + 0.3, y + 0.68, 4, 6.5, top, left, right);
}

// ---- small decor ----
// A pixel blob: the union of ellipses [dx, dy, rx, ry] (px, round the point (x, y)), each pixel coloured by
// pick(u, v, i, j) where u, v run -1..1 across the blob's box, ringed with a 1 px outline. Drawn pixel by pixel, so
// it stays crisp; blobs are small (a bush is about a hundred pixels).
export function blob(pt, x, y, ellipses, pick, outline) {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const [dx, dy, rx, ry] of ellipses) {
    x0 = Math.min(x0, Math.floor(dx - rx));
    x1 = Math.max(x1, Math.ceil(dx + rx));
    y0 = Math.min(y0, Math.floor(dy - ry));
    y1 = Math.max(y1, Math.ceil(dy + ry));
  }
  const inside = (i, j) =>
    ellipses.some(([dx, dy, rx, ry]) => ((i + 0.5 - dx) / rx) ** 2 + ((j + 0.5 - dy) / ry) ** 2 <= 1);
  const X = Math.round(x),
    Y = Math.round(y),
    ctx = pt.ctx;
  if (outline) {
    ctx.fillStyle = outline;
    for (let j = y0 - 1; j <= y1; j++)
      for (let i = x0 - 1; i <= x1; i++)
        if (!inside(i, j) && N4.some(([a, b]) => inside(i + a, j + b))) ctx.fillRect(X + i, Y + j, 1, 1);
  }
  for (let j = y0; j < y1; j++)
    for (let i = x0; i < x1; i++)
      if (inside(i, j)) {
        const c = pick(((i + 0.5 - x0) / (x1 - x0)) * 2 - 1, ((j + 0.5 - y0) / (y1 - y0)) * 2 - 1, i, j);
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(X + i, Y + j, 1, 1);
      }
}
// Three tones lit from the upper left: light toward it, dark away from it, mid between.
export const lit3 = (light, mid, dark) => (u, v) => (u + v < -0.55 ? light : u + v > 0.45 ? dark : mid);
// A grey boulder sitting at (sx, sy) px (the middle of its foot), size 0..2: three stone tones and the outline.
export function boulder(pt, C, sx, sy, s) {
  const w = 3 + s * 1.5,
    h = 2.2 + s;
  blob(
    pt,
    sx,
    sy - h,
    [
      [0, 0, w, h],
      [w * 0.45, h * 0.3, w * 0.6, h * 0.75],
    ],
    lit3(C(STONE.light, 0.9), C(STONE.mid, 0.3), C(STONE.dark, 0.2)),
    C(OUTLINE),
  );
}
// A round bush of two or three leafy clumps with a dark outline, lit from the upper left; some carry red berries.
// In fruit (spring) every bush carries more of them, small red and purple ones.
export function drawBush(pt, P, C, d, fruit) {
  const [px, py] = P(d.x + 0.5, d.y + 0.5, 0),
    big = hash(d.x, d.y, 41) > 0.5,
    berries = fruit || hash(d.x, d.y, 43) > 0.6,
    ripe = fruit ? 0.82 : 0.93,
    tones = lit3(C('#5fb35a', 0.75), C('#3f9046', 0.55), C('#2f7136', 0.45)),
    clumps = big
      ? [
          [-3, 0, 4.2, 4],
          [3, 0.5, 4.2, 4],
          [0, -3, 4, 3.8],
        ]
      : [
          [-2, 0, 3.6, 3.4],
          [2, -1, 3.6, 3.6],
        ];
  pt.rows(Math.round(px) - 7, Math.round(py), [[1, 12]], 'rgba(0,0,0,0.18)');
  blob(
    pt,
    px,
    py - 4,
    clumps,
    (u, v, i, j) => {
      const h = berries ? hash(i, j, d.x * 7 + d.y) : 0;
      if (h <= ripe) return tones(u, v);
      return fruit && h > 0.91 ? C('#8e4ec6') : C('#d94a5a');
    },
    C('#24402c'),
  );
}
// A mushroom or two: a red cap with white spots or a brown one on a cream stem, with the outline.
export function drawMushroom(pt, P, C, d) {
  const [px, py] = P(d.x + 0.5, d.y + 0.5, 0),
    red = hash(d.x, d.y, 45) > 0.4,
    cap = lit3(
      C(red ? '#ef6a5c' : '#c08a5c', 0.6),
      C(red ? '#d6453a' : '#a8724a', 0.6),
      C(red ? '#a93229' : '#7f5233'),
    );
  const one = (x, y, s) => {
    pt.rows(Math.round(x) - 2 - s, Math.round(y), [[0, 5 + 2 * s]], 'rgba(0,0,0,0.18)');
    blob(pt, x, y - 1.5 - s, [[0, 0, 1.2, 1.5 + s * 0.5]], () => C('#efe6d2'), C(OUTLINE));
    blob(
      pt,
      x,
      y - 3.5 - 2 * s,
      [[0, 0, 2.5 + s, 1.6 + s * 0.4]],
      (u, v, i, j) => (red && v < 0.2 && (i + j * 2 + 9) % 3 === 0 ? C('#ffffff') : cap(u, v)),
      C(OUTLINE),
    );
  };
  one(px - 1, py, 1);
  if (hash(d.x, d.y, 47) > 0.45) one(px + 4, py + 1, 0);
}
// A grey rock in three tones with the island outline.
export function drawRock(pt, P, C, d) {
  const [px, py] = P(d.x + 0.5, d.y + 0.5, 0);
  pt.rows(Math.round(px) - 5, Math.round(py), [[1, 10]], 'rgba(0,0,0,0.16)');
  boulder(pt, C, px, py, hash(d.x, d.y, 49) > 0.5 ? 1 : 0);
}
