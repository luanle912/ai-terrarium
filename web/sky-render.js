// Drawing for the sky island: the island itself (pre-rendered once per resolution), trees and the waterfall.
import { drawPond, drawTree, drawWaterfall, hash, mix, night, renderIsland } from './sky-island.js';
import {
  BAND_W,
  BAND_X0,
  MIST_VARIANTS,
  bandCount,
  blitMist,
  farIsland,
  inView,
  layerView,
  mistLayer,
  mistRow,
  mistWisp,
  rgba,
  snapColor,
  visibleX,
} from './sky-mist.js';
function drawBack(ctx, w, h, t, env) {
  const { df, hour, fx, col, view } = env,
    hy = h * 0.5,
    S = Math.max(0.6, h / 800),
    speedK = env.reduced ? 0.5 : 1;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, col.zenith);
  g.addColorStop(0.46, col.horizon);
  g.addColorStop(0.5, col.haze);
  g.addColorStop(1, col.below);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Lightning lights up the sky behind the island only, brightest high up, never the office or the whole view.
  if (env.flash > 0) {
    const lg = ctx.createLinearGradient(0, 0, 0, hy);
    lg.addColorStop(0, 'rgba(235,240,255,' + 0.3 * env.flash + ')');
    lg.addColorStop(1, 'rgba(235,240,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, hy);
  }
  if (df < 0.95) {
    // stars and moon
    const a = (1 - df) * (1 - fx.cloud * 0.85);
    for (let i = 0; i < 140; i++) {
      const tw = 0.55 + 0.45 * Math.sin(t * (env.reduced ? 0.5 : 1.6) + i * 1.7);
      ctx.globalAlpha = a * tw;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(hash(i, 1, 6) * w), Math.round(hash(i, 2, 6) * hy * 0.92), i % 9 ? 1 : 2, i % 9 ? 1 : 2);
    }
    ctx.globalAlpha = (1 - df) * (1 - fx.cloud * 0.6);
    const mx = w * 0.8,
      my = h * 0.15,
      r = 11 * S;
    ctx.fillStyle = '#f3f0d0';
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, 7);
    ctx.fill();
    ctx.fillStyle = col.zenith;
    ctx.beginPath();
    ctx.arc(mx + r * 0.45, my - r * 0.3, r * 0.92, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (df > 0.05) {
    // sun arcs across the sky with the hour
    const p = Math.max(0, Math.min(1, (hour - 6) / 12)),
      sx = w * (0.12 + 0.76 * p),
      sy = hy * (0.9 - 0.75 * Math.sin(Math.PI * p)),
      a = df * (1 - fx.cloud * 0.75);
    const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, 80 * S);
    sg.addColorStop(0, 'rgba(255,248,215,' + 0.85 * a + ')');
    sg.addColorStop(1, 'rgba(255,248,215,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 80 * S, sy - 80 * S, 160 * S, 160 * S);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fffbe0';
    ctx.beginPath();
    ctx.arc(sx, sy, 9 * S, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (let r = 0; r < 3; r++) {
    const d = r / 3,
      v = layerView(view, 0.1 + 0.25 * d);
    inView(ctx, v, () =>
      mistRow(
        ctx,
        w,
        hy * (0.18 + d * 0.62),
        d * 0.5,
        t,
        10 + r * 17,
        0.3 + fx.cloud * 0.9,
        col,
        S * 0.8,
        speedK,
        0.55 + fx.cloud * 0.35,
        true,
        v,
      ),
    );
  }
  inView(ctx, layerView(view, 0.2), () => {
    [
      [0.07, 0.84, 0.8, 'tree'],
      [0.2, 0.7, 0.5, 'plain'],
      [0.93, 0.78, 0.7, 'rock'],
    ].forEach(([fx_, fy, sc, kind], i) =>
      farIsland(ctx, w * fx_, hy * fy + Math.sin(t * 0.4 + i) * 1.5 * S, sc * S, col, kind),
    );
    // Wider than the stage so a pan never shows where the horizon haze ends.
    const hb = ctx.createLinearGradient(0, hy - 18 * S, 0, hy + 18 * S);
    hb.addColorStop(0, rgba(col.haze, 0));
    hb.addColorStop(0.5, rgba(col.haze, 0.9));
    hb.addColorStop(1, rgba(col.haze, 0));
    ctx.fillStyle = hb;
    ctx.fillRect(-w, hy - 18 * S, 3 * w, 36 * S);
  });
  // Sea bands deepen toward the viewer, from 0.3 at the horizon to 1 (moving with the island) at the bottom.
  const rows = Array.from({ length: 9 }, (_, r) => {
    const d = (r + 1) / 9;
    return { d, y: hy + 4 * S + (h - hy) * d * d, v: layerView(view, 0.3 + 0.7 * d) };
  });
  // Dragging the island up on a tall stage lifts the sea; more near bands fill down to the bottom of the screen.
  const near = layerView(view, 1),
    bottom = (h - near.ay) / near.z;
  for (let y = rows[8].y + 80 * S; y - 60 * S < bottom && rows.length < 16; y += 80 * S)
    rows.push({ d: 1, y, v: near });
  // The low-res layer only needs the strip the bands reach on screen; a wisp reaches about 51·s above its band.
  const seaTop = Math.max(0, Math.min(h, ...rows.map(o => o.v.ay + o.v.z * (o.y - 51 * (0.25 + o.d * 1.3) * S)))),
    sea = mistLayer('sea', w, h, seaTop);
  rows.forEach((o, r) =>
    inView(sea, o.v, () =>
      mistRow(
        sea,
        w,
        o.y,
        o.d,
        t,
        100 + r * 29,
        1.1 + fx.cloud * 0.6,
        col,
        S,
        speedK,
        0.65 + 0.35 * o.d,
        o.d >= 0.35,
        o.v,
      ),
    ),
  );
  blitMist(ctx, sea, w, seaTop);
  if (df > 0.3 && fx.rain < 0.3)
    inView(ctx, layerView(view, 0.3), () => {
      for (let i = 0; i < 3; i++) {
        const bx = BAND_X0 * w + ((t * 9 * speedK + i * 16) % (BAND_W * w)),
          by = hy * 0.5 + i * 5 * S + Math.sin(t * 2 + i) * 2,
          f = Math.floor(t * 5 + i) % 2;
        ctx.fillStyle = rgba('#35507a', df);
        ctx.fillRect(bx, by, 1, 1);
        ctx.fillRect(bx - 2, by - f, 2, 1);
        ctx.fillRect(bx + 1, by - f, 2, 1);
      }
    });
}
// env adds flash (0..1, already 0 when reduced motion is on)
function drawFront(ctx, w, h, t, env) {
  const { fx, col, view } = env,
    S = Math.max(0.6, h / 800),
    many = env.reduced ? 0.4 : 1,
    speedK = env.reduced ? 0.5 : 1;
  // A near bank of mist sweeps past in front of the island, a little nearer than it, so it zooms a little more.
  inView(ctx, layerView(view, 1.15), () => {
    const span = BAND_W * w + 800 * S,
      nx = BAND_X0 * w - 400 * S + ((t * 22 * speedK) % span);
    for (let j = 0; j < 3; j++)
      mistWisp(
        ctx,
        nx + j * 140 * S,
        h * 0.8 + j * 10 * S + Math.sin(t * 0.3 * speedK + j) * 3 * S,
        (340 - 70 * j) * S,
        (90 - 14 * j) * S,
        j,
        col.cloud,
        col.cloudShade,
        0.55 - 0.1 * j,
      );
  });
  // Thin wisps drift across the island itself and move with it; they stay faint (the bubbles sit under this canvas)
  // and come and go.
  const vo = layerView(view, 1),
    [ox0, ox1] = visibleX(vo, w);
  inView(ctx, vo, () => {
    const nOver = bandCount((3 + fx.cloud * 4) * (env.reduced ? 0.6 : 1), w, 530 * S);
    for (let i = 0; i < nOver; i++) {
      const cw = (380 + hash(i, 31, 1) * 300) * S,
        ch = cw * 0.18,
        ospan = BAND_W * w + cw,
        x = BAND_X0 * w - cw + ((hash(i, 31, 2) * ospan + t * (6 + hash(i, 31, 3) * 7) * S * speedK) % ospan);
      if (x + cw < ox0 || x > ox1) continue;
      const y = h * (0.25 + 0.45 * hash(i, 31, 4)) + Math.sin(t * 0.2 * speedK + i * 1.3) * 5 * S,
        fade = 0.5 + 0.5 * Math.sin(t * 0.09 * speedK + hash(i, 31, 5) * 6.28);
      mistWisp(ctx, x, y - ch * 0.5, cw, ch, i % MIST_VARIANTS, col.cloud, null, (0.48 + 0.15 * fx.cloud) * fade);
    }
  });
  const nRain = Math.round(260 * fx.rain * many);
  if (nRain) {
    ctx.fillStyle = rgba('#d7e6ff', 0.35 + 0.25 * env.df);
    for (let i = 0; i < nRain; i++) {
      const x = (hash(i, 7, 1) * w + t * 60) % w,
        y = (hash(i, 8, 1) * h + t * (700 + hash(i, 9, 1) * 200)) % h;
      ctx.fillRect(Math.round(x), Math.round(y), 1, Math.round(9 * S));
    }
  }
  const nSnow = Math.round(180 * fx.snow * many);
  if (nSnow) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < nSnow; i++) {
      const x = (hash(i, 3, 2) * w + Math.sin(t * 0.8 + i) * 14 * S + t * 8) % w,
        y = (hash(i, 4, 2) * h + t * (36 + hash(i, 5, 2) * 30) * S) % h,
        sz = hash(i, 6, 2) > 0.7 ? 3 : 2;
      ctx.fillRect(Math.round(x), Math.round(y), sz, sz);
    }
  }
  if (fx.fog > 0) {
    const fg = ctx.createLinearGradient(0, 0, 0, h);
    fg.addColorStop(0, rgba(col.haze, 0.12 * fx.fog));
    fg.addColorStop(1, rgba(col.haze, 0.32 * fx.fog));
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, w, h);
    // Fog banks roll across the whole view at different heights and speeds.
    const nBank = bandCount(12 * fx.fog * (env.reduced ? 0.6 : 1), w, 600 * S),
      vf = layerView(view, 0.8),
      [fx0, fx1] = visibleX(vf, w);
    inView(ctx, vf, () => {
      for (let i = 0; i < nBank; i++) {
        const cw = (420 + hash(i, 21, 1) * 360) * S,
          ch = cw * 0.22,
          fspan = BAND_W * w + cw,
          x = BAND_X0 * w - cw + ((hash(i, 21, 2) * fspan + t * (8 + hash(i, 21, 3) * 12) * S * speedK) % fspan);
        if (x + cw < fx0 || x > fx1) continue;
        const y = h * (0.1 + 0.85 * hash(i, 21, 4)) + Math.sin(t * 0.2 * speedK + i) * 4 * S,
          breath = 0.6 + 0.4 * Math.sin(t * 0.12 * speedK + i * 2.3);
        mistWisp(ctx, x, y - ch * 0.5, cw, ch, i % MIST_VARIANTS, col.haze, null, 0.4 * fx.fog * breath);
      }
    });
  }
}

// ---- transition clouds (world mode): two pixel cloud banks close over the view and part again ----
// Each bank is a solid body of cloud colour with a ragged leading edge of stacked pixel puffs (lit top rim, shaded
// underside, stepped round tips, like block clouds), a shaded back row peeking out ahead of it for depth, and a soft
// fringe of the sky's own mist so the bank belongs to the same weather. The edge is painted once per size and colour
// into a small canvas at one canvas px per art px, then stamped with smoothing off, so a frame costs a few blits.
const CURTAINS = new Map();
function curtainEdge(seed, wa, ha, lit, shade, rim) {
  const key = seed + '|' + wa + '|' + ha + '|' + lit + shade + rim;
  let c = CURTAINS.get(key);
  if (c) return c;
  // Six edges a frame (three per bank); evicting the oldest keeps the set in use when the colours drift.
  if (CURTAINS.size >= 18) CURTAINS.delete(CURTAINS.keys().next().value);
  c = document.createElement('canvas');
  c.width = wa;
  c.height = ha;
  const g = c.getContext('2d');
  // One row of puffs from x0, top to bottom; each puff overlaps the one above, so only the shaded underside of a puff
  // that reaches further than the next one shows: the stagger reads as layered cloud.
  const row = (s, x0, minL, maxL, minH, maxH, top, under, hi) => {
    for (let y = -6, i = 0; y < ha; i++) {
      const rh = minH + Math.floor(hash(i, s, 1) * (maxH - minH + 1)),
        len = Math.round(wa * (minL + (maxL - minL) * hash(i, s, 2)));
      for (let r = 0; r < rh; r++) {
        const k = Math.min(r, rh - 1 - r),
          tip = k === 0 ? 4 : k === 1 ? 2 : k === 2 ? 1 : 0;
        const run = Math.max(0, len - x0 - tip);
        g.fillStyle = r >= rh - 2 ? under : top;
        g.fillRect(x0, y + r, run, 1);
        // the lit rim catches only the rounded front of the puff, not its whole length
        if (r <= 1 && hi) {
          const cap = Math.min(run, Math.round(wa * 0.16));
          g.fillStyle = hi;
          g.fillRect(x0 + run - cap, y + r, cap, 1);
        }
      }
      y += rh - 2 - Math.floor(hash(i, s, 3) * 3);
    }
  };
  row(seed + 7, Math.round(wa * 0.3), 0.62, 1, 7, 12, mix(shade, lit, 0.25), mix(shade, '#000000', 0.08), null);
  row(seed, 0, 0.34, 0.84, 8, 14, lit, shade, rim);
  CURTAINS.set(key, c);
  return c;
}
// left / right: inner edges of the two banks in CSS px (WorldLogic.cloudBands). t in seconds, col: the sky colours.
function drawCurtains(ctx, w, h, left, right, t, col) {
  const S = Math.max(0.6, h / 800),
    P = Math.max(2, Math.round(3 * S)),
    E = Math.min(0.16 * w, 150 * S),
    wa = Math.max(8, Math.ceil(E / P)),
    ha = Math.ceil(h / P) + 1;
  const lit = snapColor(col.cloud),
    shade = snapColor(col.cloudShade),
    rim = snapColor(mix(col.cloud, '#ffffff', 0.2));
  const bank = (edge, seed, flip) => {
    if (edge <= -E) return;
    ctx.save();
    if (flip) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    const x = Math.round(edge - E / 2);
    if (x > 0) {
      ctx.fillStyle = lit;
      ctx.fillRect(0, 0, x + 1, h);
    }
    ctx.imageSmoothingEnabled = false;
    // Two fainter echoes of the edge inside the body, trailing a little slower than it: a cloud bank with depth.
    for (let k = 2; k >= 1; k--) {
      const xe = Math.round(edge * (1 - 0.1 * k) - E / 2 - E * 0.85 * k);
      if (xe + wa * P <= 0) continue;
      ctx.globalAlpha = k === 1 ? 0.5 : 0.3;
      ctx.drawImage(curtainEdge(seed + k * 5, wa, ha, lit, shade, rim), xe, 0, wa * P, ha * P);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(curtainEdge(seed, wa, ha, lit, shade, rim), x, 0, wa * P, ha * P);
    ctx.imageSmoothingEnabled = true;
    // the mist fringe rides just ahead of the edge, breathing a little
    const n = Math.ceil(h / (110 * S));
    for (let i = 0; i < n; i++) {
      const cw = (150 + hash(i, seed, 4) * 110) * S,
        ch = cw * 0.3,
        y = ((i + 0.5) / n) * h + (hash(i, seed, 5) - 0.5) * 40 * S;
      mistWisp(
        ctx,
        edge - cw * (0.55 + 0.2 * hash(i, seed, 6)) + Math.sin(t * 1.3 + i * 2.1) * 4 * S,
        y - ch * 0.5,
        cw,
        ch,
        i % MIST_VARIANTS,
        col.cloud,
        col.cloudShade,
        0.55,
      );
    }
    ctx.restore();
  };
  bank(left, 3, false);
  bank(w - right, 11, true);
}

export const SkyRender = {
  mix,
  night,
  renderIsland,
  drawWaterfall,
  drawPond,
  drawTree,
  drawBack,
  drawFront,
  drawCurtains,
};
