// The lake at the bottom point as pixel art: soft rounded water (not the tile grid's steps) sunk WATER_Z below the
// grass, a far bank wall with a light waterline, and a raised ring of cobbles round it (the lake at the mountain's
// foot is web/mountain-art.js's); the lip where the lake spills into the main fall runs right out to the shore. On
// the water: the stepping stones out to the pavilion and the lotus pads and flowers. The one-pillar pavilion itself
// (a stone pillar, a bracketed wooden platform with a small railing, a square hall and two tiers of curved roof,
// inspired by Hanoi's One Pillar Pagoda) is a sprite the scene sorts with the people. Moving water, ducks, fish and
// the lantern's glow are web/island-life.js's. lakeField is pure (tests/island-art.test.mjs).
import { WATER_Z, hash } from './island-land.js';
import {
  bayer,
  blob,
  fillPx,
  linePx,
  lit3,
  OUTLINE,
  outlinePx,
  PAVILION,
  pavilionLantern,
  pixelLayer,
  rgbOf,
  stamp,
} from './island-art.js';

// The water's edge is where the field crosses WATER_T; the cobbles lie on the lawn where it is within RIM_T below.
export const WATER_T = 0.5;
const RIM_T = 0.13,
  KERNEL = [1, 2, 1, 2, 4, 2, 1, 2, 1],
  fields = new WeakMap();
// A smooth field over the island, 1 deep in open water and 0 on dry land: every lake tile's share of a small
// blur round it, read between tile centres. Its WATER_T line is the water's soft edge: it runs along a straight bank's
// tile edge, rounds off the corners and never reaches a lawn tile's middle. At the main fall's lip a channel the
// fall's width runs out to the shore. at(x, y) in tiles.
export function lakeField(island) {
  if (fields.has(island)) return fields.get(island);
  const f = island.waterfall,
    wet = new Set(island.pond.cells);
  const blur = new Map(),
    B = (x, y) => {
      const k = x + ',' + y;
      if (!blur.has(k) && !island.cells.has(k)) blur.set(k, 0); // past the shore is sky, not water
      if (!blur.has(k)) {
        let v = 0;
        for (let j = -1; j <= 1; j++)
          for (let i = -1; i <= 1; i++) if (wet.has(x + i + ',' + (y + j))) v += KERNEL[(j + 1) * 3 + i + 1];
        blur.set(k, v / 16);
      }
      return blur.get(k);
    };
  const at = (x, y) => {
    if (Math.abs(x - f.x - 0.5) <= 0.42 && y >= f.y + 0.3 && y <= f.y + 1.05) return 0.75;
    if (!island.cells.has(Math.floor(x) + ',' + Math.floor(y))) return 0;
    const u = x - 0.5,
      v = y - 0.5,
      i = Math.floor(u),
      j = Math.floor(v),
      a = u - i,
      b = v - j;
    return (B(i, j) * (1 - a) + B(i + 1, j) * a) * (1 - b) + (B(i, j + 1) * (1 - a) + B(i + 1, j + 1) * a) * b;
  };
  const out = { at, wet };
  fields.set(island, out);
  return out;
}

const WATER = { shallow: '#62b8ea', mid: '#4aa3df', deep: '#3b8fcf', line: '#a9dcf7' },
  BANK = { wall: '#6a6474', foot: '#57516a' },
  COBBLE = ['#cfc9bd', '#bdb6aa', '#aaa397'],
  MORTAR = '#8a8478',
  COBBLE_SIDE = '#7e776c';
// The lake on the land canvas: every pixel of its box is looked at twice, at the lawn's level and at
// the water's (WATER_Z lower). Water where both are in; the far bank's wall where the lawn level is in and the water
// level is not; cobbles on the lawn at the edge, with their side showing on the near banks.
export function drawWater(pt, P, C, island) {
  const { at, wet } = lakeField(island),
    [OX, OY] = P(0, 0, 0),
    tiles = [...wet].map(k => k.split(',').map(Number)),
    sx0 = Math.floor(OX + Math.min(...tiles.map(([x, y]) => x - y - 1)) * 16) - 2,
    sx1 = Math.ceil(OX + Math.max(...tiles.map(([x, y]) => x - y + 1)) * 16) + 2,
    sy0 = Math.floor(OY + Math.min(...tiles.map(([x, y]) => x + y)) * 8) - 4,
    sy1 = Math.ceil(OY + Math.max(...tiles.map(([x, y]) => x + y + 2)) * 8) + 6,
    W = sx1 - sx0,
    H = sy1 - sy0,
    L = pixelLayer(W, H),
    rgb = rgbOf(C),
    kind = new Uint8Array(W * H), // 0 nothing, 1 water, 2 bank wall, 3 cobble, 4 cobble side
    deep = new Float32Array(W * H),
    cell = new Int32Array(W * H);
  const lawnAt = (sx, sy, z) => {
    const a = (sx + 0.5 - OX) / 16,
      b = (sy + 0.5 - OY + z) / 8;
    return [(a + b) / 2, (b - a) / 2];
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        [x0, y0] = lawnAt(sx0 + x, sy0 + y, 0),
        [x1, y1] = lawnAt(sx0 + x, sy0 + y, WATER_Z),
        f0 = at(x0, y0),
        f1 = at(x1, y1);
      if (f0 >= WATER_T || (f1 >= WATER_T && !island.cells.has(Math.floor(x0) + ',' + Math.floor(y0)))) {
        kind[i] = f1 >= WATER_T ? 1 : 2;
        deep[i] = f1;
      } else if (f0 >= WATER_T - RIM_T) {
        kind[i] = 3;
        const r = Math.floor(y0 * 3);
        cell[i] = Math.floor(x0 * 3 + (r & 1) * 0.5) * 1009 + r;
      }
    }
  // the cobbles' side: two pixels under a cobble on the lawn
  for (let y = H - 1; y > 0; y--)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (kind[i] === 0 && (kind[i - W] === 3 || (y > 1 && kind[i - W] === 4 && kind[i - 2 * W] === 3))) kind[i] = 4;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        k = kind[i];
      if (!k) continue;
      let c;
      if (k === 1) {
        const d = deep[i] + (bayer(x, y) - 0.5) * 0.08;
        c = d < WATER_T + 0.09 ? WATER.shallow : d < 0.82 ? WATER.mid : WATER.deep;
        if (y > 0 && kind[i - W] === 2) c = WATER.line;
        c = rgb(c, 0.6);
      } else if (k === 2) c = rgb(y + 1 < H && kind[i + W] === 1 ? BANK.foot : BANK.wall, 0.3);
      else if (k === 3) {
        const n = cell[i],
          edge = (x + 1 < W && kind[i + 1] === 3 && cell[i + 1] !== n) || (kind[i + W] === 3 && cell[i + W] !== n);
        c = rgb(edge ? MORTAR : COBBLE[Math.floor(hash(n, 7, 81) * 3)], 0.8);
        if (!edge && y > 0 && kind[i - W] === 3 && cell[i - W] !== n) c = rgb('#ddd8cd', 0.8);
      } else c = rgb(COBBLE_SIDE, 0.3);
      L.set(x, y, c);
    }
  L.flush();
  stamp(pt.ctx, L.cv, sx0, sy0);
}

// On the water, back to front: the stepping stones out to the pavilion, then the lotus pads with their flowers.
export function drawLakeDecor(pt, P, C, island) {
  const pav = island.pavilion;
  if (pav)
    for (const s of pav.path) {
      const [x, y] = P(s.x + 0.4 + 0.2 * hash(s.x, s.y, 82), s.y + 0.4 + 0.2 * hash(s.x, s.y, 83), WATER_Z),
        w = 5 + hash(s.x, s.y, 84) * 1.5;
      blob(pt, x, y + 1, [[0, 0, w, w * 0.5]], () => C('#7e776c', 0.3), C(OUTLINE));
      blob(pt, x, y - 1, [[0, 0, w, w * 0.5]], lit3(C('#dcd6ca', 0.85), C('#c4bdb0', 0.85), C('#aaa397', 0.6)));
    }
  for (const l of island.lotus || []) {
    const n = 2 + (hash(l.x, l.y, 85) > 0.5 ? 1 : 0),
      pads = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = P(l.x + 0.2 + 0.6 * hash(l.x, l.y, 86 + i), l.y + 0.2 + 0.6 * hash(l.x, l.y, 90 + i), WATER_Z);
      pads.push([Math.round(x), Math.round(y), 3 + hash(l.x + i, l.y, 94) * 1.5]);
    }
    pads.sort((a, b) => a[1] - b[1]);
    for (const [x, y, r] of pads) {
      const notch = hash(x, y, 95) > 0.5 ? 1 : -1;
      blob(
        pt,
        x,
        y,
        [[0, 0, r, r * 0.5]],
        (u, v, i, j) =>
          i * notch >= 1 && Math.abs(j + 0.5) < i * notch * 0.3
            ? C('#2c6a2e')
            : lit3(C('#6cbf55'), C('#4a9a3e'), C('#357a32'))(u, v),
        C('#24402c'),
      );
    }
    if (l.flower) flower(pt, C, pads[0][0], pads[0][1] - 1, l.flower);
  }
}
// A lotus flower standing on its pad: pink or white petals round a yellow heart, ringed with the outline.
const FLOWER = ['..P..', '.PpP.', 'PpypP', '.ppp.'];
function flower(pt, C, x, y, kind) {
  const pal = {
      P: C(kind === 'pink' ? '#f8b8d4' : '#ffffff'),
      p: C(kind === 'pink' ? '#e2689a' : '#dde3ec'),
      y: C('#ffd34d'),
    },
    X = x - 2,
    Y = y - FLOWER.length,
    ctx = pt.ctx,
    on = (i, j) => j >= 0 && j < FLOWER.length && i >= 0 && i < 5 && FLOWER[j][i] !== '.';
  ctx.fillStyle = C(OUTLINE);
  for (let j = -1; j <= FLOWER.length; j++)
    for (let i = -1; i <= 5; i++)
      if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) ctx.fillRect(X + i, Y + j, 1, 1);
  FLOWER.forEach((r, j) => {
    for (let i = 0; i < 5; i++)
      if (pal[r[i]]) {
        ctx.fillStyle = pal[r[i]];
        ctx.fillRect(X + i, Y + j, 1, 1);
      }
  });
}

// The pavilion's sprite reach round the point under the middle of its hall, in px: [left, up, right, down].
export const PAVILION_EXT = [31, 59, 31, 8];
const WOOD = { top: '#b98149', left: '#8e5d33', right: '#6b4426', dark: '#4a2e1a' },
  PILLAR = { left: '#a39d92', right: '#78736b', ring: '#5f5a55' },
  HALL = { left: '#e2cfa3', right: '#b9a379', red: '#b2523c', redDark: '#8c3c2c', door: '#6e2b22', lattice: '#d9a441' },
  ROOF = { left: '#5d5a7d', right: '#45425f', top: '#6f6c92', course: '#4b486a', tip: '#8784aa', fascia: '#34314c' },
  GOLD = '#e8c35a';
// The one-pillar pavilion, painted on a pixel layer the size of its sprite and ringed with the outline, then stamped
// onto pt (its sprite's canvas). Heights (z) and half-widths (r, tiles) are PAVILION's.
export function drawPavilion(pt, P, C, island) {
  const pav = island.pavilion,
    cx = pav.x,
    cy = pav.y,
    [ax, ay] = P(cx, cy, 0),
    ox = Math.round(ax) - PAVILION_EXT[0],
    oy = Math.round(ay) - PAVILION_EXT[1],
    L = pixelLayer(PAVILION_EXT[0] + PAVILION_EXT[2], PAVILION_EXT[1] + PAVILION_EXT[3]),
    g = L.g,
    { z: Z, r: R } = PAVILION,
    Q = (x, y, z) => {
      const [sx, sy] = P(x, y, z);
      return [sx - ox, sy - oy];
    },
    poly = (pts, c) =>
      fillPx(
        g,
        pts.map(v => Q(...v)),
        C(c),
      ),
    line = (a, b, c) => linePx(g, Q(...a), Q(...b), C(c));
  // the lit (y + 1) and shaded (x + 1) faces of a square r tiles either side of the middle, from z0 up to z1
  const faces = (r, z0, z1, left, right) => {
    poly(
      [
        [cx - r, cy + r, z0],
        [cx + r, cy + r, z0],
        [cx + r, cy + r, z1],
        [cx - r, cy + r, z1],
      ],
      left,
    );
    poly(
      [
        [cx + r, cy - r, z0],
        [cx + r, cy + r, z0],
        [cx + r, cy + r, z1],
        [cx + r, cy - r, z1],
      ],
      right,
    );
  };
  const square = (r, z, c) =>
    poly(
      [
        [cx - r, cy - r, z],
        [cx + r, cy - r, z],
        [cx + r, cy + r, z],
        [cx - r, cy + r, z],
      ],
      c,
    );
  // a hipped roof of curved tiles: eaves r0 out at z0 up to a top r1 out at z1, a dark fascia under the eaves, two
  // courses of tiles across each face and the four corners turned up in little horns
  const roof = (r0, z0, r1, z1) => {
    const E = (sx, sy, z = z0) => [cx + sx * r0, cy + sy * r0, z],
      T = (sx, sy) => [cx + sx * r1, cy + sy * r1, z1];
    poly([E(-1, -1), E(1, -1), T(1, -1), T(-1, -1)], ROOF.top);
    poly([E(-1, -1), E(-1, 1), T(-1, 1), T(-1, -1)], ROOF.top);
    square(r1, z1, ROOF.top);
    faces(r0, z0 - 1.5, z0, ROOF.fascia, ROOF.fascia);
    poly([E(-1, 1), E(1, 1), T(1, 1), T(-1, 1)], ROOF.left);
    poly([E(1, -1), E(1, 1), T(1, 1), T(1, -1)], ROOF.right);
    for (const t of [0.34, 0.67]) {
      const at = (sx, sy) => {
        const e = E(sx, sy),
          q = T(sx, sy);
        return [e[0] + (q[0] - e[0]) * t, e[1] + (q[1] - e[1]) * t, z0 + (z1 - z0) * t];
      };
      line(at(-1, 1), at(1, 1), ROOF.course);
      line(at(1, 1), at(1, -1), ROOF.course);
    }
    for (const [sx, sy] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]) {
      const tip = [cx + sx * (r0 + 0.14), cy + sy * (r0 + 0.14), z0 + 4.5];
      poly([[cx + sx * (r0 - 0.2), cy + sy * r0, z0], E(sx, sy, z0 + 2), tip], ROOF.tip);
      poly([[cx + sx * r0, cy + sy * (r0 - 0.2), z0], E(sx, sy, z0 + 2), tip], ROOF.tip);
    }
  };
  // a low railing along the platform's edge from a to b: posts every quarter and a rail on top
  const rail = (a, b) => {
    for (let t = 0; t <= 1.001; t += 0.25) {
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      line([p[0], p[1], Z.deck], [p[0], p[1], Z.deck + 3], HALL.redDark);
    }
    line([a[0], a[1], Z.deck + 3], [b[0], b[1], Z.deck + 3], HALL.red);
  };
  const e = R.deck - 0.05;
  // a short wooden stair down from the platform's back edge to the stepping stones (they come in from -y)
  for (let s = 0; s < 3; s++) {
    const y0 = cy - R.deck - 0.13 * (s + 1),
      z = Z.deck - 4 * (s + 1);
    poly(
      [
        [cx - 0.14, y0, z + 2],
        [cx + 0.14, y0, z + 2],
        [cx + 0.14, y0 + 0.13, z + 2],
        [cx - 0.14, y0 + 0.13, z + 2],
      ],
      WOOD.top,
    );
    poly(
      [
        [cx + 0.14, y0, z],
        [cx + 0.14, y0 + 0.13, z],
        [cx + 0.14, y0 + 0.13, z + 2],
        [cx + 0.14, y0, z + 2],
      ],
      WOOD.right,
    );
  }
  // the stone pillar standing in the water, a darker ring where it meets it, and the brackets that spread from it to
  // the platform's corners and sides
  faces(R.pillar + 0.04, WATER_Z, WATER_Z + 2, PILLAR.ring, PILLAR.ring);
  faces(R.pillar, WATER_Z + 2, Z.floor, PILLAR.left, PILLAR.right);
  for (const [sx, sy] of [
    [-1, 1],
    [1, 1],
    [1, -1],
    [0, 1],
    [1, 0],
  ])
    line([cx + sx * R.pillar, cy + sy * R.pillar, Z.floor - 8], [cx + sx * e, cy + sy * e, Z.floor], WOOD.dark);
  // the platform, the railing behind the hall, the hall with its red posts and beam, a door and a lattice window,
  // then the railing in front
  faces(R.deck, Z.floor, Z.deck, WOOD.left, WOOD.right);
  square(R.deck, Z.deck, WOOD.top);
  rail([cx - e, cy - e], [cx + e, cy - e]);
  rail([cx - e, cy - e], [cx - e, cy + e]);
  const h = R.hall;
  faces(h, Z.deck, Z.eave, HALL.left, HALL.right);
  faces(h, Z.eave - 3, Z.eave, HALL.red, HALL.redDark);
  poly(
    [
      [cx - 0.15, cy + h, Z.deck],
      [cx + 0.15, cy + h, Z.deck],
      [cx + 0.15, cy + h, Z.deck + 9],
      [cx - 0.15, cy + h, Z.deck + 9],
    ],
    HALL.door,
  );
  line([cx, cy + h, Z.deck], [cx, cy + h, Z.deck + 9], HALL.red);
  poly(
    [
      [cx + h, cy - 0.18, Z.deck + 3],
      [cx + h, cy + 0.18, Z.deck + 3],
      [cx + h, cy + 0.18, Z.deck + 9],
      [cx + h, cy - 0.18, Z.deck + 9],
    ],
    HALL.door,
  );
  for (const t of [-0.06, 0.06]) line([cx + h, cy + t, Z.deck + 4], [cx + h, cy + t, Z.deck + 8], HALL.lattice);
  for (const [sx, sy] of [
    [-1, 1],
    [1, 1],
    [1, -1],
  ])
    line([cx + sx * h, cy + sy * h, Z.deck], [cx + sx * h, cy + sy * h, Z.eave], HALL.red);
  rail([cx - e, cy + e], [cx + e, cy + e]);
  rail([cx + e, cy - e], [cx + e, cy + e]);
  // two tiers of roof with the small upper hall between, a gold finial on top
  roof(R.eave, Z.eave, R.top, Z.roof);
  faces(R.upper, Z.roof, Z.eave2, HALL.red, HALL.redDark);
  roof(R.eave2, Z.eave2, R.top2, Z.roof2);
  line([cx, cy, Z.roof2], [cx, cy, Z.roof2 + 3], GOLD);
  const [fx, fy] = Q(cx, cy, Z.roof2 + 4);
  g.fillStyle = C(GOLD);
  g.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 2, 2);
  // the lantern under the front corner of the lower eaves: a red paper lantern on a string, unlit
  const l = pavilionLantern(island),
    [lx, ly] = Q(l.x, l.y, l.z).map(Math.round);
  line([l.x, l.y, Z.eave - 1], [l.x, l.y, l.z + 3], WOOD.dark);
  g.fillStyle = C('#5a2a22');
  g.fillRect(lx - 1, ly - 3, 3, 1);
  g.fillRect(lx - 1, ly + 3, 3, 1);
  g.fillStyle = C('#c8402e');
  g.fillRect(lx - 2, ly - 2, 5, 5);
  g.fillStyle = C('#f0b070');
  g.fillRect(lx, ly - 2, 1, 5);
  outlinePx(L.cv, C(OUTLINE));
  stamp(pt.ctx, L.cv, ox, oy);
}
