// Mist and far islands of the sky: pre-rendered mist sprites, low-resolution mist layers, depth bands and the parallax
// view.
import { CameraLogic } from './camera-logic.js';
import { hash, hex, mix, toHex } from './sky-island.js';
export const rgba = (hexc, a) => {
  const [r, g, b] = hex(hexc);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
};
// ---- drifting mist: soft wisps stamped from a few pre-rendered sprites ----
export const MIST_W = 256,
  MIST_H = 96,
  MIST_VARIANTS = 3,
  mistBase = [],
  mistTinted = new Map();
// White alpha-only wisp: overlapping soft ellipses, densest in the middle, frayed at the ends.
export function mistShape(v) {
  const c = document.createElement('canvas');
  c.width = MIST_W;
  c.height = MIST_H;
  const g = c.getContext('2d'),
    n = 7;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n,
      bump = Math.sin(Math.PI * u),
      cx = MIST_W * (0.1 + 0.8 * u) + (hash(i, v, 11) - 0.5) * 24,
      cy = MIST_H * (0.55 + (hash(i, v, 12) - 0.5) * 0.3);
    const rx = MIST_W * (0.09 + 0.08 * hash(i, v, 13)) * (0.7 + 0.6 * bump),
      ry = MIST_H * (0.16 + 0.22 * bump * (0.5 + 0.5 * hash(i, v, 14)));
    g.save();
    g.translate(cx, cy);
    g.scale(rx / ry, 1);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, ry);
    rg.addColorStop(0, 'rgba(255,255,255,0.8)');
    rg.addColorStop(0.55, 'rgba(255,255,255,0.42)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(0, 0, ry, 0, 7);
    g.fill();
    g.restore();
  }
  return c;
}
// Tinting per draw would be costly, so tinted sprites are cached per colour. Colours are snapped to steps of 4 per
// channel (invisible in soft mist): weather blends shift them every frame and would otherwise churn the cache.
export const snapColor = c => toHex(hex(c).map(v => Math.round(v / 4) * 4));
export function mistSprite(v, rawColor) {
  const color = snapColor(rawColor),
    key = v + color,
    hit = mistTinted.get(key);
  if (hit) return hit;
  if (mistTinted.size > 160) mistTinted.clear();
  const base = mistBase[v] || (mistBase[v] = mistShape(v)),
    c = document.createElement('canvas');
  c.width = MIST_W;
  c.height = MIST_H;
  const g = c.getContext('2d');
  g.drawImage(base, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, MIST_W, MIST_H);
  mistTinted.set(key, c);
  return c;
}
// One wisp: an optional shaded copy sits a little lower to give the mist some body.
export function mistWisp(ctx, x, y, cw, ch, v, lit, shade, a) {
  if (a <= 0.01) return;
  if (shade) {
    ctx.globalAlpha = a * 0.35;
    ctx.drawImage(mistSprite(v, shade), x, y + ch * 0.14, cw, ch);
  }
  ctx.globalAlpha = a;
  ctx.drawImage(mistSprite(v, lit), x, y, cw, ch);
  ctx.globalAlpha = 1;
}
// The cloud sea stacks ~180 big overlapping wisps, so it is painted into a low-res layer and scaled up once. The blit
// fills its whole strip, so sparser mist (sky rows, front wisps, fog banks) is cheaper drawn directly.
// A layer is sized to the whole stage, so zooming and panning never reallocate it; each frame clears and blits only
// the strip from y0 (CSS px) down to the bottom, where its content lies.
export const MIST_SCALE = 0.5,
  mistLayers = new Map();
export function mistLayer(name, w, h, y0) {
  const lw = Math.max(1, Math.ceil(w * MIST_SCALE)),
    lh = Math.max(1, Math.ceil(h * MIST_SCALE)),
    sy = Math.min(lh, Math.floor(y0 * MIST_SCALE));
  let c = mistLayers.get(name);
  if (!c) {
    c = document.createElement('canvas');
    mistLayers.set(name, c);
  }
  if (c.width !== lw || c.height !== lh) {
    c.width = lw;
    c.height = lh;
  }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, sy, lw, lh - sy);
  g.setTransform(MIST_SCALE, 0, 0, MIST_SCALE, 0, 0);
  return g;
}
export function blitMist(ctx, g, w, y0) {
  const c = g.canvas,
    sy = Math.min(c.height, Math.floor(y0 * MIST_SCALE));
  if (sy >= c.height) return;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, 0, sy, c.width, c.height - sy, 0, sy / MIST_SCALE, w, (c.height - sy) / MIST_SCALE);
}
// ---- camera: sky layers zoom and pan with the island, each by its depth ----
// v is a view {z, ax, ay} (CameraLogic.skyView/parallax): a layer point p is drawn at (ax, ay) + z · p.
export const NO_VIEW = { z: 1, ax: 0, ay: 0 };
export const layerView = (view, k) => (view && CameraLogic ? CameraLogic.parallax(view, k) : NO_VIEW);
export function inView(ctx, v, draw) {
  if (v === NO_VIEW) {
    draw();
    return;
  }
  ctx.save();
  ctx.translate(v.ax, v.ay);
  ctx.scale(v.z, v.z);
  draw();
  ctx.restore();
}
// The stage's x range in a layer's own coordinates, to skip wisps that are off screen.
export const visibleX = (v, w) => [-v.ax / v.z, (w - v.ax) / v.z];
// Wisps are spread over a band much wider than the stage, so panning never shows an empty edge or a wisp wrapping
// around on screen: an island narrower than a wide stage pans by its side gap plus 10 %, up to about 0.6 of the width.
// Positions live in the layer, so they move with the camera instead of sticking to the screen.
export const BAND_X0 = -0.75,
  BAND_W = 2.5;
// Count for a band of wisps that used to span w+avg, keeping the same density over the wider band.
export const bandCount = (n, w, avg) => Math.round((n * (BAND_W * w + avg)) / (w + avg));
// One band of mist at depth d (0 far at the horizon .. 1 near): far bands are thin, hazy and slow.
// cover scales how much of the band's width the wisps fill, so the count follows the screen width.
// withShade=false drops the shaded copy, for the far sea bands where it is lost in the haze and would double the draws.
export function mistRow(ctx, w, y, d, t, seed, cover, col, S, speedK, alpha, withShade = true, v = NO_VIEW) {
  const s = (0.25 + d * 1.3) * S,
    lit = mix(col.cloud, col.haze, (1 - d) * 0.4),
    shade = withShade ? mix(col.cloudShade, col.haze, (1 - d) * 0.7) : null,
    maxW = 300 * s,
    span = BAND_W * w + maxW;
  const count = Math.min(150, Math.ceil((span / (210 * s)) * cover)),
    [vx0, vx1] = visibleX(v, w);
  for (let i = 0; i < count; i++) {
    const cw = (150 + hash(i, seed, 1) * 150) * s,
      ch = cw * (0.2 + 0.12 * hash(i, seed, 4)),
      speed = (3 + 2.5 * hash(i, seed, 5)) * s * speedK;
    const x = BAND_X0 * w - maxW + ((hash(i, seed, 2) * span + t * speed) % span),
      bob = Math.sin(t * 0.25 * speedK + i * 1.9 + seed) * 2 * s;
    if (x + cw < vx0 || x > vx1) continue;
    const breath = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.15 * speedK + hash(i, seed, 6) * 6.28));
    mistWisp(
      ctx,
      x,
      y - ch * 0.5 + bob,
      cw,
      ch,
      Math.floor(hash(i, seed, 3) * MIST_VARIANTS),
      lit,
      shade,
      alpha * breath,
    );
  }
}
function poly(ctx, pts, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fill();
}
// A small floating island in the style of the main one: diamond grass top with a dark outline, brown dirt lip,
// one cone underneath, and a tree or rock on top. Smaller (farther) ones are hazier and fainter. Each kind is painted
// once into its own sprite (again only when its size, the haze colour or the screen density changes) and stamped
// every frame, so the bobbing islands cost one drawImage each and allocate nothing.
const farSprites = new Map();
const farness = sc => Math.max(0, Math.min(1, 1.05 - sc));
export function farIsland(ctx, x, y, sc, col, kind = 'plain') {
  const res = 2 * Math.max(1, Math.ceil(globalThis.devicePixelRatio || 1)),
    L = 22 * sc + 2,
    T = 19 * sc + 2,
    B = 36 * sc + 2;
  let s = farSprites.get(kind);
  if (!s) farSprites.set(kind, (s = { c: document.createElement('canvas'), sc: 0, haze: '', res: 0 }));
  if (s.sc !== sc || s.haze !== col.haze || s.res !== res) {
    s.sc = sc;
    s.haze = col.haze;
    s.res = res;
    s.c.width = Math.ceil(2 * L * res);
    s.c.height = Math.ceil((T + B) * res);
    const g = s.c.getContext('2d');
    g.setTransform(res, 0, 0, res, L * res, T * res);
    paintFarIsland(g, sc, col.haze, kind);
  }
  const prevAlpha = ctx.globalAlpha,
    prevSmooth = ctx.imageSmoothingEnabled;
  ctx.globalAlpha = prevAlpha * (0.95 - 0.35 * farness(sc));
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(s.c, x - L, y - T, 2 * L, T + B);
  ctx.imageSmoothingEnabled = prevSmooth;
  ctx.globalAlpha = prevAlpha;
}
// The far island round (0, 0): the middle of its grass top.
function paintFarIsland(ctx, sc, haze, kind) {
  const far = farness(sc),
    hz = c => mix(c, haze, 0.25 + 0.45 * far),
    x = 0,
    y = 0,
    hw = 20 * sc,
    hh = 10 * sc,
    lip = 4 * sc,
    out = hz('#2b2350');
  // the cone under the dirt lip, then the lip itself
  poly(
    ctx,
    [
      [x - hw * 0.7, y + hh * 0.3 + lip],
      [x + hw * 0.7, y + hh * 0.3 + lip],
      [x + 2 * sc, y + 34 * sc],
    ],
    hz('#7a5232'),
  );
  poly(
    ctx,
    [
      [x, y + hh * 0.7 + lip],
      [x + hw * 0.7, y + hh * 0.3 + lip],
      [x + 2 * sc, y + 34 * sc],
    ],
    hz('#5e3d26'),
  );
  poly(
    ctx,
    [
      [x - hw, y],
      [x, y + hh],
      [x + hw, y],
      [x + hw, y + lip],
      [x, y + hh + lip],
      [x - hw, y + lip],
    ],
    hz('#9a6a3e'),
  );
  poly(
    ctx,
    [
      [x, y + hh],
      [x + hw, y],
      [x + hw, y + lip],
      [x, y + hh + lip],
    ],
    hz('#7d5332'),
  );
  poly(
    ctx,
    [
      [x - hw, y],
      [x, y - hh],
      [x + hw, y],
      [x, y + hh],
    ],
    hz('#4c9a52'),
  );
  ctx.strokeStyle = out;
  ctx.lineWidth = Math.max(1, sc * 1.2);
  ctx.beginPath();
  ctx.moveTo(x - hw, y);
  ctx.lineTo(x, y - hh);
  ctx.lineTo(x + hw, y);
  ctx.stroke();
  if (kind === 'tree') {
    ctx.fillStyle = hz('#6b4a2e');
    ctx.fillRect(x - sc, y - 5 * sc, 2 * sc, 5 * sc);
    poly(
      ctx,
      [
        [x - 6 * sc, y - 4 * sc],
        [x, y - 17 * sc],
        [x + 6 * sc, y - 4 * sc],
      ],
      hz('#2f7a45'),
    );
    poly(
      ctx,
      [
        [x, y - 17 * sc],
        [x + 6 * sc, y - 4 * sc],
        [x, y - 4 * sc],
      ],
      hz('#25663a'),
    );
  } else if (kind === 'rock') {
    poly(
      ctx,
      [
        [x - 6 * sc, y],
        [x - 3 * sc, y - 7 * sc],
        [x + 3 * sc, y - 8 * sc],
        [x + 6 * sc, y],
      ],
      hz('#9aa0ad'),
    );
    poly(
      ctx,
      [
        [x + sc, y - 7.5 * sc],
        [x + 3 * sc, y - 8 * sc],
        [x + 6 * sc, y],
        [x + sc, y],
      ],
      hz('#767c8c'),
    );
  }
}
// env: {df, hour, fx:{cloud,rain,snow,storm,fog}, col: SkyLogic.skyColors(...), reduced, view?: island camera view}
// The gradient, sun, moon and stars stay put; clouds, far islands and birds follow the camera by depth.
