// The static pieces of the office island that web/sky-island.js bakes into the island image: the cone underside, the
// two-peak mountain, the wooden bridge, the lamp posts (unlit; web/island-life.js lights them), bushes, mushrooms,
// rocks and the stone bench of the rest corner. Every function draws in the scene's logical px through P (the lawn
// level projection) and takes its colours through C(colour, snowAmount), which applies the island's light and snow.
import { DECK_OVER, deckZ, hash, N4, WATER_Z } from './island-land.js';

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

// ---- the underside: one cone of earth under the lawn ----
// A smooth surface through the grid corners (each one as deep as the four columns round it, the shore ones just under
// the soil layer), two triangles a tile. Faces on the front-left are lit, on the front-right shaded, and the ridge
// between them down the front lighter still; the earth darkens in steps of STRATUM px toward the tip, a few
// broken ledges run across it and two grey boulders show near the tip. Along the shore the 4 px soil layer shows
// under the grass, and the grass hangs over it in a wavy lip.
const CONE = { left: '#a97b50', right: '#7c5537', ridge: '#bd8f60', deep: '#3f2b26' },
  SOIL = { left: '#74492b', right: '#58371f' },
  LIP = { left: '#4f9c40', right: '#3f8535', edge: '#356f2d' },
  STONE = { light: '#aeacba', mid: '#8b8999', dark: '#6a687b', deep: '#545268' },
  STRATUM = 26,
  SOIL_Z = 4,
  LEDGES = [34, 70, 112, 160, 216, 280, 350];
// How far the grass hangs over the soil at a point of the shore: 1-4 px in long, soft waves.
const lipAt = (u, v) => 2.4 + 1.1 * Math.sin(u * 1.7 + v * 0.9) + 0.5 * Math.sin(u * 4.1 - v * 2.3);
const coneTone = (side, z) => mix(side, CONE.deep, Math.min(0.62, Math.floor(-z / STRATUM) * 0.065));
export function drawUnderside(pt, P, C, island) {
  const key = (x, y) => x + ',' + y,
    dep = (x, y) => island.depth.get(key(x, y)),
    corners = new Map(),
    { cx, cy } = island.shape;
  const corner = (x, y) => {
    const k = key(x, y);
    if (!corners.has(k)) {
      const round = [dep(x - 1, y - 1), dep(x, y - 1), dep(x - 1, y), dep(x, y)];
      corners.set(k, [x, y, round.includes(undefined) ? -SOIL_Z : -round.reduce((a, b) => a + b) / 4]);
    }
    return corners.get(k);
  };
  const tris = [];
  for (const { x, y } of island.list) {
    const A = corner(x, y),
      B = corner(x + 1, y),
      Cc = corner(x + 1, y + 1),
      D = corner(x, y + 1);
    for (const t of [
      [A, B, D],
      [B, Cc, D],
    ]) {
      const n = normalOf(...t).map(q => -q); // the underside faces down
      if (n[0] + n[1] + n[2] > 0) tris.push(t);
    }
  }
  // Painted three times through a clip: the lit colour left of the ridge (the screen's vertical through the
  // island's centre), the shaded one right of it, and a 2 px light seam down the ridge itself.
  const axis = P(cx, cy)[0],
    ctx = pt.ctx;
  for (const [x0, x1, side] of [
    [-1e4, axis, CONE.left],
    [axis, 1e4, CONE.right],
    [axis - 1, axis + 1, CONE.ridge],
  ]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, -1e4, x1 - x0, 2e4);
    ctx.clip();
    for (const t of tris) {
      const z = (t[0][2] + t[1][2] + t[2][2]) / 3,
        grain = hash(Math.floor(t[0][0] / 2), Math.floor(t[0][1] / 2), 3) > 0.5 ? 0.03 : 0;
      pt.poly(
        t.map(v => P(...v)),
        C(mix(coneTone(side, z), '#000000', grain)),
        true,
      );
      // ledges: where a ledge's depth crosses this face, a light line with a dark one under it, on some stretches
      for (const L of LEDGES) {
        const hits = [];
        for (let i = 0; i < 3; i++) {
          const a = t[i],
            b = t[(i + 1) % 3];
          if ((a[2] + L) * (b[2] + L) < 0) hits.push(lerp3(a, b, (-L - a[2]) / (b[2] - a[2])));
        }
        if (hits.length !== 2 || hash(Math.floor((t[0][0] - t[0][1]) / 4), L, 51) < 0.5) continue;
        const [p, q] = hits.map(v => P(...v)),
          line = (dy, c) =>
            pt.poly(
              [
                [p[0], p[1] + dy],
                [q[0], q[1] + dy],
                [q[0], q[1] + dy + 1],
                [p[0], p[1] + dy + 1],
              ],
              c,
            );
        line(0, C(mix(coneTone(side, -L), '#ffffff', 0.2)));
        line(1, C(mix(coneTone(side, -L), '#000000', 0.28)));
      }
    }
    ctx.restore();
  }
  // two boulders: just above the tip, and on the lit side a little higher up
  const tip = island.list.reduce((a, b) => (b.d > a.d ? b : a));
  const [tx, ty] = P(tip.x + 0.5, tip.y + 0.5, -tip.d);
  boulder(pt, C, tx, ty - 12, 2);
  boulder(pt, C, tx - 34, ty - 58, 1);
}
// The soil layer and the grass lip on one shore face of a lawn tile: plane 'y' (its y + 1 edge) or 'x' (x + 1).
export function shoreFace(pt, P, C, x, y, plane) {
  const lit = plane === 'y',
    at = (t, z) => (lit ? P(x + t, y + 1, z) : P(x + 1, y + t, z)),
    side = lit ? 'left' : 'right';
  pt.poly([at(0, 0), at(1, 0), at(1, -SOIL_Z), at(0, -SOIL_Z)], C(SOIL[side]), true);
  // the grass lip hangs 1-4 px in waves that run on along the shore from tile to tile
  const wave = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    wave.push(at(t, -lipAt(lit ? x + t : y + t, lit ? y : x)));
  }
  pt.poly([at(0, 0), at(1, 0), ...wave.slice().reverse()], C(LIP[side], 0.7));
  pt.poly([...wave, ...wave.map(([a, b]) => [a, b + 1]).reverse()], C(LIP.edge, 0.6));
}

// ---- the mountain ----
// Each peak is a rocky cone of flat faces: a ring of SIDES points on the lawn, a smaller ring turned half a step at
// MID of its height, and the tip. The radii waver from point to point, so the faces catch the light differently; the
// lawn ring is pulled in wherever it would leave the mountain's tiles (the river gorge, the shore), so the stone
// never stands in the water or overhangs the edge. Points are [x, y, z]: x and y in tiles, z in px. Cached per island.
// The two peaks and the low shoulder at the river's head (island.mountain.shoulder) are cones; the rock ledge the
// mountain falls pour over stands in front of the shoulder.
const SIDES = 9,
  MID = 0.45,
  shapes = new WeakMap();
function mountainShape(island) {
  const m = island.mountain;
  if (!m) return null;
  if (shapes.has(m)) return shapes.get(m);
  const inM = (x, y) => m.cells.has(Math.floor(x) + ',' + Math.floor(y));
  const cones = [...m.peaks, ...(m.shoulder ? [m.shoulder] : [])]
    .map((p, j) => {
      const x = p.x + 0.5,
        y = p.y + 0.5,
        R = p.R,
        tip = [x + (hash(j, 1, 60) - 0.5) * 0.4, y + (hash(j, 2, 60) - 0.5) * 0.4, p.h],
        base = [],
        radii = [],
        mid = [];
      for (let i = 0; i < SIDES; i++) {
        const a = ((i + 0.3 * j) / SIDES) * Math.PI * 2;
        let r = R * (0.82 + 0.3 * hash(i, j, 61));
        while (r > 1 && !inM(x + Math.cos(a) * r, y + Math.sin(a) * r)) r -= 0.25;
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
// island is snowed on, and a light seam runs down the front ridges where a lit face meets a shaded one. The falls'
// ledge goes in among them by depth.
export function drawMountain(pt, P, C, island, snow) {
  const cones = mountainShape(island);
  if (!cones) return;
  const fall = island.mountain.fall,
    ledgeZ = fall ? (fall.x0 + fall.x1) / 2 + fall.y : Infinity;
  let ledge = !fall;
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
    if (!ledge && c.x + c.y > ledgeZ) {
      drawLedge(pt, P, C, fall);
      ledge = true;
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
  if (!ledge) drawLedge(pt, P, C, fall);
}
// The rock ledge the mountain falls pour over: a craggy rock face across the back of the river's head, just behind the
// water sheet, with a notch at the sheet's top (fall.top px up) where the water spills, low crags either side and
// sloping shoulders down to the gorge's banks, and a dark wet streak behind the water, so the falls always have stone
// behind them.
function drawLedge(pt, P, C, fall) {
  const Y = fall.y - 0.04,
    back = fall.y - 0.6,
    t = fall.top,
    xs = [
      fall.x0 - 0.9,
      fall.x0 - 0.4,
      fall.x0 - 0.08,
      fall.x0,
      fall.x1,
      fall.x1 + 0.08,
      fall.x1 + 0.4,
      fall.x1 + 0.85,
    ],
    zs = [2, t - 3, t + 3, t, t, t + 3, t - 4, 1],
    front = xs.map((x, i) => P(x, Y, zs[i])),
    rear = xs.map((x, i) => P(x, back, zs[i] - 1));
  const x0 = xs[0],
    x1 = xs[xs.length - 1];
  pt.poly([P(x0, Y, WATER_Z), ...front, P(x1, Y, WATER_Z)], C(STONE.mid, 0.15), true);
  pt.poly([P(xs[3], Y, WATER_Z), front[3], front[4], P(xs[4], Y, WATER_Z)], C(STONE.deep));
  for (let i = 0; i < xs.length - 1; i++)
    pt.poly([front[i], front[i + 1], rear[i + 1], rear[i]], C(i === 3 ? STONE.dark : STONE.light, 0.6), true);
}

// ---- the bridge, the lamps, the bench ----
const WOOD = { plank: '#b98149', plank2: '#a8733f', side: '#7a4f2b', dark: '#5a3920', rail: '#8e5d33' };
// The wooden bridge over the river: an arched deck of planks across the stream, a railing either side on three posts.
// part 'back' is the far railing and the deck, 'front' the near railing, so whoever crosses walks between the two.
export function drawBridge(pt, P, C, bridge, part) {
  const along = bridge.dir === 'x',
    a0 = (along ? bridge.x : bridge.y) - DECK_OVER,
    a1 = (along ? bridge.x : bridge.y) + bridge.len + DECK_OVER,
    w0 = (along ? bridge.y : bridge.x) + 0.14,
    w1 = (along ? bridge.y : bridge.x) + 0.86,
    Q = (a, w, z) => (along ? P(a, w, z) : P(w, a, z)),
    N = 10;
  const rail = w => {
    // posts at both ends and the middle, a rail along the post tops following the arch
    for (const t of [0.04, 0.5, 0.96]) {
      const a = a0 + (a1 - a0) * t,
        z = deckZ(t);
      pt.poly([Q(a - 0.04, w, z), Q(a + 0.04, w, z), Q(a + 0.04, w, z + 8), Q(a - 0.04, w, z + 8)], C(WOOD.dark));
    }
    for (let i = 0; i < N; i++) {
      const ta = i / N,
        tb = (i + 1) / N,
        a = a0 + (a1 - a0) * ta,
        b = a0 + (a1 - a0) * tb;
      pt.poly(
        [Q(a, w, deckZ(ta) + 7), Q(b, w, deckZ(tb) + 7), Q(b, w, deckZ(tb) + 5.6), Q(a, w, deckZ(ta) + 5.6)],
        C(WOOD.rail, 0.5),
      );
    }
  };
  if (part === 'front') return rail(w1);
  rail(w0);
  for (let i = 0; i < N; i++) {
    const ta = i / N,
      tb = (i + 1) / N,
      a = a0 + (a1 - a0) * ta + 0.01,
      b = a0 + (a1 - a0) * tb - 0.01,
      za = deckZ(ta),
      zb = deckZ(tb);
    // beam side under the deck edge, then the plank
    pt.poly([Q(a, w1, za), Q(b, w1, zb), Q(b, w1, zb - 2), Q(a, w1, za - 2)], C(WOOD.side));
    pt.poly([Q(a, w0, za), Q(b, w0, zb), Q(b, w1, zb), Q(a, w1, za)], C(i % 2 ? WOOD.plank : WOOD.plank2, 0.5));
  }
}
// Where a lamp's light hangs, in island coordinates (x, y in tiles, z in px above the lawn): LAMP_Z over its tile's
// centre (web/island-life.js glows there). The lamps at the ends of the bridge are lanterns hung from a wooden post's
// hook, the others glass lamps on an iron pole.
export const LAMP_Z = 15;
function lampHead(island, l) {
  const lantern = [...island.bridge.cells].some(k => {
    const [bx, by] = k.split(',').map(Number);
    return Math.abs(bx - l.x) <= 1 && Math.abs(by - l.y) <= 1;
  });
  return { x: l.x + 0.5, y: l.y + 0.5, z: LAMP_Z, lantern };
}
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
// Lamp sprites, bottom row on the lawn; the glass's middle row sits LAMP_Z px up, in column `at`.
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
  },
  LANTERN = {
    at: 6,
    rows: [
      'wwwwwww..',
      'Wd....k..',
      'Wd...kkk.',
      'Wd..kkkkk',
      'Wd..kgggk',
      'Wd..kgGgk',
      'Wd..kgggk',
      'Wd..kkkkk',
      'Wd...kkk.',
      ...Array(11).fill('Wd.......'),
      'dd.......',
    ],
  };
// A lamp post with its lamp unlit (the glow is drawn after dark by web/island-life.js).
export function drawLamp(pt, P, C, island, l) {
  const h = lampHead(island, l),
    s = h.lantern ? LANTERN : POLE_LAMP,
    [bx, by] = P(h.x, h.y, 0),
    X = Math.round(bx),
    Y = Math.round(by),
    glass = s.rows.findIndex(r => r.includes('G'));
  pt.rows(X - 4, Y, [[0, 8]], 'rgba(0,0,0,0.18)');
  sprite(pt, X - s.at, Y - LAMP_Z - glass, s.rows, {
    k: C('#3b3a4a'),
    p: C('#4c4a5c'),
    g: C('#d9cfa4'),
    G: C('#e6dcb2'),
    w: C(WOOD.dark, 0.5),
    W: C(WOOD.side),
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
function blob(pt, x, y, ellipses, pick, outline) {
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
  ctx.fillStyle = outline;
  for (let j = y0 - 1; j <= y1; j++)
    for (let i = x0 - 1; i <= x1; i++)
      if (!inside(i, j) && N4.some(([a, b]) => inside(i + a, j + b))) ctx.fillRect(X + i, Y + j, 1, 1);
  for (let j = y0; j < y1; j++)
    for (let i = x0; i < x1; i++)
      if (inside(i, j)) {
        ctx.fillStyle = pick(((i + 0.5 - x0) / (x1 - x0)) * 2 - 1, ((j + 0.5 - y0) / (y1 - y0)) * 2 - 1, i, j);
        ctx.fillRect(X + i, Y + j, 1, 1);
      }
}
// Three tones lit from the upper left: light toward it, dark away from it, mid between.
const lit3 = (light, mid, dark) => (u, v) => (u + v < -0.55 ? light : u + v > 0.45 ? dark : mid);
// A grey boulder sitting at (sx, sy) px (the middle of its foot), size 0..2: three stone tones and the outline.
function boulder(pt, C, sx, sy, s) {
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
    C('#2b2350'),
  );
}
// A round bush of two or three leafy clumps with a dark outline, lit from the upper left; some carry red berries.
export function drawBush(pt, P, C, d) {
  const [px, py] = P(d.x + 0.5, d.y + 0.5, 0),
    big = hash(d.x, d.y, 41) > 0.5,
    berries = hash(d.x, d.y, 43) > 0.6,
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
    (u, v, i, j) => (berries && hash(i, j, d.x * 7 + d.y) > 0.93 ? C('#d94a5a') : tones(u, v)),
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
    blob(pt, x, y - 1.5 - s, [[0, 0, 1.2, 1.5 + s * 0.5]], () => C('#efe6d2'), C('#2b2350'));
    blob(
      pt,
      x,
      y - 3.5 - 2 * s,
      [[0, 0, 2.5 + s, 1.6 + s * 0.4]],
      (u, v, i, j) => (red && v < 0.2 && (i + j * 2 + 9) % 3 === 0 ? C('#ffffff') : cap(u, v)),
      C('#2b2350'),
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
