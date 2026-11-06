// Drawing the island itself: the underside bands, the lawn, trees, the pond and the waterfall.
import { rgba } from './sky-mist.js';
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
export const hash = (x, y, s) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
};
// Night pulls every island colour toward the same deep blue the office uses after dark.
export const night = (c, df) => mix(c, '#0d1322', (1 - df) * 0.6);
export const SNOW = '#eef3f7';
// Depth bands of the underside: [from z, to z, colour], top to bottom.
export const BANDS = [
  [0, -6, '#8a5a36'],
  [-6, -26, '#6f4a32'],
  [-26, -60, '#7a7a84'],
  [-60, -1e9, '#5f6070'],
];
// The pond's water surface sits this far below the grass.
export const WATER_Z = -3;

export function drawTree(ctx, P, d, df, snow) {
  const [px, py] = P(d.x + 0.5, d.y + 0.5, 0),
    x = Math.round(px),
    y = Math.round(py);
  const leaf = night(mix('#3e9a45', SNOW, snow * 0.5), df),
    top = night(mix('#57b85a', SNOW, snow * 0.6), df);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 5, y - 1, 10, 2);
  ctx.fillStyle = night('#6b4a2a', df);
  ctx.fillRect(x - 1, y - 10, 2, 10);
  ctx.fillStyle = leaf;
  ctx.fillRect(x - 5, y - 19, 10, 9);
  ctx.fillStyle = mix(leaf, '#000000', 0.18);
  ctx.fillRect(x + 1, y - 19, 4, 9);
  ctx.fillStyle = top;
  ctx.fillRect(x - 3, y - 22, 6, 3);
}

// The island as one image the size of the scene canvas; only trees behind the walls are baked in,
// trees in front are drawn with the office so desks and walls overlap them correctly.
export function renderIsland(island, frame, k, env) {
  const { LW, LH, OX, OY } = frame,
    TW = 16,
    TH = 8,
    df = env.df,
    snow = env.snow;
  const cv = document.createElement('canvas');
  cv.width = Math.round(LW * k);
  cv.height = Math.round(LH * k);
  const ctx = cv.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const P = (x, y, z = 0) => [OX + (x - y) * TW, OY + (x + y) * TH - z];
  const poly = (pts, c) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
  };
  const dep = (x, y) => island.depth.get(x + ',' + y) || 0,
    has = (x, y) => island.cells.has(x + ',' + y),
    inPond = (x, y) => island.pond.cells.has(x + ',' + y);
  for (const c of island.list) {
    const { x, y, d } = c,
      jit = (hash(x, y, 3) - 0.5) * 14;
    // a side face shows wherever this column hangs lower than its front neighbour
    const fromL = -dep(x, y + 1),
      fromR = -dep(x + 1, y);
    for (const [z0, z1, col] of BANDS) {
      const top = Math.min(z0, 0),
        bot = Math.max(z1, -d);
      if (bot >= top) continue;
      const base = night(mix(col, jit > 0 ? '#ffffff' : '#000000', Math.abs(jit) / 100), df);
      const lt = Math.min(top, fromL),
        rt = Math.min(top, fromR);
      if (lt > bot)
        poly(
          [P(x, y + 1, lt), P(x + 1, y + 1, lt), P(x + 1, y + 1, bot), P(x, y + 1, bot)],
          mix(base, '#000000', 0.12),
        );
      if (rt > bot)
        poly([P(x + 1, y, rt), P(x + 1, y + 1, rt), P(x + 1, y + 1, bot), P(x + 1, y, bot)], mix(base, '#000000', 0.3));
    }
    if (inPond(x, y)) {
      // The pond is sunk WATER_Z below the grass: the far banks show as earth walls, the water fills the hollow.
      if (!inPond(x - 1, y))
        poly([P(x, y, 0), P(x, y + 1, 0), P(x, y + 1, WATER_Z), P(x, y, WATER_Z)], night('#6f4a32', df));
      if (!inPond(x, y - 1))
        poly([P(x, y, 0), P(x + 1, y, 0), P(x + 1, y, WATER_Z), P(x, y, WATER_Z)], night('#5f3f2a', df));
      poly(
        [P(x, y, WATER_Z), P(x + 1, y, WATER_Z), P(x + 1, y + 1, WATER_Z), P(x, y + 1, WATER_Z)],
        night(mix(inPond(x - 1, y) && inPond(x, y - 1) ? '#3f96d4' : '#4aa3df', SNOW, snow * 0.6), df),
      );
    } else {
      const grass = (x + y) % 2 ? '#62b14e' : '#58a645';
      poly([P(x, y, 0), P(x + 1, y, 0), P(x + 1, y + 1, 0), P(x, y + 1, 0)], night(mix(grass, SNOW, snow * 0.85), df));
    }
    if (!has(x, y + 1))
      poly(
        [P(x, y + 1, 0), P(x + 1, y + 1, 0), P(x + 1, y + 1, -2), P(x, y + 1, -2)],
        night(mix('#3f7f33', SNOW, snow * 0.7), df),
      );
    if (!has(x + 1, y))
      poly(
        [P(x + 1, y, 0), P(x + 1, y + 1, 0), P(x + 1, y + 1, -2), P(x + 1, y, -2)],
        night(mix('#356c2b', SNOW, snow * 0.7), df),
      );
  }
  // A ring of rim stones around the pond, open only where the water spills over the shore into the waterfall.
  {
    const f = island.waterfall,
      R = 0.13,
      stones = [];
    for (const k of island.pond.cells) {
      const [x, y] = k.split(',').map(Number);
      if (!inPond(x - 1, y)) stones.push([x - R, y, R * 2, 1]);
      if (!inPond(x, y - 1)) stones.push([x, y - R, 1, R * 2]);
      if (!inPond(x + 1, y) && !(x === f.x && y === f.y)) stones.push([x + 1 - R, y, R * 2, 1]);
      if (!inPond(x, y + 1)) stones.push([x, y + 1 - R, 1, R * 2]);
    }
    stones.sort((a, b) => a[0] + a[2] / 2 + a[1] + a[3] / 2 - (b[0] + b[2] / 2 + b[1] + b[3] / 2));
    for (const [sx, sy, w, hh] of stones) {
      // each edge is laid as two stones with a small gap, so the rim reads as stonework
      const along = w > hh,
        n = 2;
      for (let i = 0; i < n; i++) {
        const a = i / n + 0.02,
          b = (i + 1) / n - 0.02,
          x0 = along ? sx + w * a : sx,
          x1 = along ? sx + w * b : sx + w,
          y0 = along ? sy : sy + hh * a,
          y1 = along ? sy + hh : sy + hh * b;
        const top = night(mix(hash(x0 * 7, y0 * 7, 8) > 0.5 ? '#c9c3b8' : '#b8b1a5', SNOW, snow * 0.8), df),
          zt = 2.5;
        poly([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, zt), P(x0, y1, zt)], mix(top, '#000000', 0.22));
        poly([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, zt), P(x1, y0, zt)], mix(top, '#000000', 0.38));
        poly([P(x0, y0, zt), P(x1, y0, zt), P(x1, y1, zt), P(x0, y1, zt)], top);
      }
    }
  }
  // Garden paths (SkyLogic.lawnPaths): a faint worn strip in the grass where feet go, and flat stepping stones on it
  // that sit 1 px proud of the grass.
  if (island.paths) {
    // The worn strip is stroked in the ground plane: with the iso projection as the canvas transform a round-capped
    // line becomes a band lying on the lawn, joins and ends included.
    ctx.save();
    ctx.setTransform(k * TW, k * TH, -k * TW, k * TH, k * OX, k * OY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.62;
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = night(mix('#a8955a', SNOW, snow * 0.6), df);
    for (const l of island.paths.strips) {
      ctx.beginPath();
      l.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.restore();
    for (const st of island.paths.stones) {
      const top = night(mix(hash(st.x * 5, st.y * 5, 11) > 0.5 ? '#c9c3b8' : '#bdb6aa', SNOW, snow * 0.55), df);
      poly(
        st.outline.map(([x, y]) => P(x, y, 0)),
        mix(top, '#000000', 0.32),
      );
      poly(
        st.outline.map(([x, y]) => P(x, y, 1)),
        top,
      );
    }
  }
  // vines hanging from the front shore
  ctx.fillStyle = night('#3f7f33', df);
  island.list.forEach((c, i) => {
    if (has(c.x, c.y + 1) || hash(c.x, c.y, 4) > 0.35) return;
    const [vx, vy] = P(c.x + 0.5, c.y + 1, -2);
    ctx.fillRect(Math.round(vx), Math.round(vy), 1, Math.round(5 + hash(c.x, c.y, 5) * 12));
  });
  for (const d of island.decor) {
    const [px, py] = P(d.x + 0.5, d.y + 0.5, 0),
      x = Math.round(px),
      y = Math.round(py);
    if (d.kind === 'rock') {
      ctx.fillStyle = night('#8f8f99', df);
      ctx.fillRect(x - 3, y - 3, 6, 3);
      ctx.fillStyle = night(mix('#a8a8b2', SNOW, snow), df);
      ctx.fillRect(x - 2, y - 4, 3, 1);
    } else if (d.kind === 'flower') {
      ctx.fillStyle = night(['#ffd166', '#ff8fab', '#ffffff'][(d.x + d.y + 99) % 3], df);
      ctx.fillRect(x, y - 1, 1, 1);
    } else if (d.x < 0 || d.y < 0) drawTree(ctx, P, d, df, snow);
  }
  return cv;
}

// Slow glints moving over the pond surface (drawn every frame over the baked island).
export function drawPond(ctx, island, P, t, df) {
  for (const k of island.pond.cells) {
    const [x, y] = k.split(',').map(Number);
    for (let j = 0; j < 2; j++) {
      const p = (t * 0.25 + hash(x, y, 7 + j)) % 1,
        [gx, gy] = P(x + 0.2 + hash(x, y, 9 + j) * 0.6, y + 0.2 + p * 0.6, WATER_Z);
      ctx.globalAlpha = (0.25 + 0.45 * df) * Math.sin(p * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(gx), Math.round(gy), 2, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// The waterfall is a sheet of water lying in the plane of the island's east cliff face (x = const), so it slants with
// the cliff instead of being a flat screen-space strip: it pours over the pond's lip, runs down the face, then falls on.
export function drawWaterfall(ctx, island, P, t, len, df) {
  const f = island.waterfall,
    X = f.x + 1,
    y0 = f.y + 0.15,
    y1 = f.y + 0.85,
    top = WATER_Z,
    bot = -(island.depth.get(f.x + ',' + f.y) || 40) - len;
  const quad = (ya, yb, za, zb) => {
    const a = P(X, ya, za),
      b = P(X, yb, za),
      c = P(X, yb, zb),
      d = P(X, ya, zb);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fill();
  };
  const ty = P(X, y0, top)[1],
    by = P(X, y0, bot)[1];
  // colours follow the island's light, so the fall does not glow at night
  const g = ctx.createLinearGradient(0, ty, 0, by);
  g.addColorStop(0, rgba(night('#6eb9f5', df), 0.95));
  g.addColorStop(0.6, rgba(night('#96cdfa', df), 0.75));
  g.addColorStop(1, rgba(night('#dceeff', df), 0));
  ctx.fillStyle = g;
  quad(y0, y1, top, bot);
  // darker edges give the sheet thickness; light streaks slide down it
  ctx.fillStyle = rgba(night('#3c82c8', df), 0.35);
  quad(y0, y0 + 0.07, top, bot * 0.7);
  quad(y1 - 0.07, y1, top, bot * 0.7);
  for (let i = 0; i < 9; i++) {
    const ya = y0 + 0.06 + (y1 - y0 - 0.16) * ((i * 0.37) % 1),
      p = (t * 0.55 + i * 0.11) % 1,
      za = top - (top - bot) * p;
    ctx.fillStyle = rgba(night('#ffffff', df), 0.75 * (1 - p));
    quad(ya, ya + 0.05, za, za - 14);
  }
  // foam where the pond spills over the lip
  ctx.fillStyle = rgba(night('#ffffff', df), 0.6 + 0.3 * df);
  quad(y0 - 0.05, y1 + 0.05, top + 0.8, top - 1.6);
}

// ---- sky behind the island and weather in front of it (both drawn in CSS px over the whole stage) ----
