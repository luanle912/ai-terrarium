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
// A small floating island in the pixel style of the main one: a diamond of grass with a dark outline, a dirt lip, a
// ragged cone of layered stone underneath with roots hanging off it, and on top a round-canopy tree in the season's
// colours, a boulder and a bush, or a little spring that spills over the edge as a waterfall. Painted in whole stage
// pixels and stamped unsmoothed, so it stays crisp. Smaller (farther) ones are hazier and fainter. Each kind is painted
// once into its own sprite (again only when its size, the haze colour, the season's trees or the screen density
// change) and stamped every frame, so the bobbing islands cost one drawImage each.
const farSprites = new Map();
const farness = sc => Math.max(0, Math.min(1, 1.05 - sc));
// Canopy colours [base, shade, light] for SeasonLogic's `trees`; 'bare' has none (branches only).
const FAR_CANOPY = {
  fresh: ['#5fb85e', '#428f47', '#9ad88a'],
  green: ['#3f9a4a', '#2e7a3a', '#62bb64'],
  gold: ['#e48a2c', '#bf5f1f', '#f6c04a'],
};
// The sprite's size round the grass top's middle: half width, height above and below it, in stage px.
const farDims = sc => {
  const hw = Math.max(8, Math.round(20 * sc));
  return { hw, L: hw + 3, T: Math.round(hw / 2 + 26 * sc + 8), B: Math.round(hw / 2 + 36 * sc + 12) };
};
export function farIsland(ctx, x, y, sc, col, kind = 'plain', trees = 'green', snowy = false) {
  const res = Math.max(1, Math.ceil(globalThis.devicePixelRatio || 1)),
    { L, T, B } = farDims(sc),
    key = kind;
  let s = farSprites.get(key);
  if (!s) farSprites.set(key, (s = { c: document.createElement('canvas'), id: '' }));
  const id = [sc, col.haze, res, trees, snowy].join('|');
  if (s.id !== id) {
    s.id = id;
    const w = 2 * L * res,
      h = (T + B) * res,
      g = s.c.getContext('2d');
    if (s.c.width !== w || s.c.height !== h) {
      s.c.width = w;
      s.c.height = h;
    } else {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, w, h);
    }
    g.setTransform(res, 0, 0, res, L * res, T * res);
    paintFarIsland(g, sc, col.haze, kind, trees, snowy);
  }
  const prevAlpha = ctx.globalAlpha,
    prevSmooth = ctx.imageSmoothingEnabled;
  ctx.globalAlpha = prevAlpha * (0.95 - 0.35 * farness(sc));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.c, Math.round(x) - L, Math.round(y) - T, 2 * L, T + B);
  ctx.imageSmoothingEnabled = prevSmooth;
  ctx.globalAlpha = prevAlpha;
}
// The far island round (0, 0), the middle of its grass top, in whole pixels.
function paintFarIsland(g, sc, haze, kind, trees, snowy) {
  const far = farness(sc),
    hz = c => mix(c, haze, 0.12 + 0.38 * far),
    R = (x, y, w, h, c) => {
      g.fillStyle = c;
      g.fillRect(x, y, w, h);
    },
    { hw } = farDims(sc),
    hh = Math.floor(hw / 2),
    lip = Math.max(2, Math.round(3 * sc)),
    D = Math.max(10, Math.round(30 * sc)),
    OUT = hz('#2b2238'),
    snow = c => (snowy ? mix(c, '#eef3f7', 0.7) : c),
    G0 = hz(snow('#4c9a52')),
    G1 = hz(snow('#58a85c')),
    GL = hz(snow('#7cc46e')),
    GD = hz(snow('#3d8445')),
    DL = hz('#9a6a3e'),
    DD = hz('#73492b'),
    SL = hz('#8e909d'),
    SD = hz('#686a78'),
    SB = hz('#55576a');
  // column by column: grass from the top edge to the bottom edge of the diamond, the dirt lip, then the stone down to
  // a ragged point (depth quantised to 2 px, a little different every two columns)
  const bottoms = [];
  for (let x = -hw; x < hw; x++) {
    const f = 1 - Math.abs(x + 0.5) / hw,
      top = -Math.round(hh * f),
      bot = Math.round(hh * f),
      jag = 0.75 + 0.35 * hash(Math.floor(x / 2), 7, 41),
      dep = 2 * Math.round((D * Math.pow(f, 1.4) * jag) / 2),
      right = x >= 0;
    for (let yy = top; yy < bot; yy++)
      R(x, yy, 1, 1, (Math.floor((x + 64) / 4) + Math.floor((yy + 64) / 2)) % 2 ? G0 : G1);
    R(x, top, 1, 1, right ? G0 : GL);
    R(x, top - 1, 1, 1, OUT);
    R(x, bot, 1, lip, right ? DD : DL);
    for (let yy = 0; yy < dep; yy++) R(x, bot + lip + yy, 1, 1, yy % 5 === 4 ? SB : right ? SD : SL);
    R(x, bot + lip + dep, 1, 1, OUT);
    bottoms.push(bot + lip + dep);
  }
  // the outline down the two ends of the lip
  R(-hw - 1, 0, 1, lip + 1, OUT);
  R(hw, 0, 1, lip + 1, OUT);
  // tufts and a few flowers on the grass, roots and vines hanging under the stone
  for (let k = 0; k < Math.round(hw * 0.6); k++) {
    const px = Math.round((hash(k, 3, 17) * 2 - 1) * hw * 0.7),
      py = Math.round((hash(k, 5, 19) * 2 - 1) * hh * 0.55 * (1 - Math.abs(px) / hw));
    if (k % 4 === 0 && !snowy) R(px, py, 1, 1, ['#f2f0e6', '#ffd166', '#e98fb0'][k % 3]);
    else R(px, py, 1, 1, GD);
  }
  for (let k = 0; k < 4; k++) {
    const i = Math.floor(hash(k, 9, 23) * bottoms.length * 0.8 + bottoms.length * 0.1),
      len = 2 + Math.floor(hash(k, 11, 29) * 4);
    R(i - hw, bottoms[i] - len + 2, 1, len, hz(k % 2 ? '#5e3d26' : '#3e7d3a'));
  }
  if (kind === 'tree') farTree(R, hz, sc, trees, OUT);
  else if (kind === 'rock') {
    // a boulder (lit on the left, flat where it sits) and a bush beside it, outlined like the tree
    const r = Math.max(3, Math.round(5 * sc));
    farBlob(
      R,
      -Math.round(r * 0.4),
      0,
      [
        [0, -r * 0.55, r * 0.95],
        [r * 0.7, -r * 0.3, r * 0.7],
      ],
      ['#a2a8b5', '#787e8e', '#c9ced8'].map(c => hz(snow(c))),
      OUT,
      0,
    );
    const br = Math.max(2, Math.round(3.2 * sc));
    farBlob(
      R,
      Math.round(hw * 0.42),
      1,
      [
        [-br * 0.5, -br * 0.7, br * 0.75],
        [br * 0.5, -br * 0.6, br * 0.7],
        [0, -br * 1.2, br * 0.7],
      ],
      ['#3f9a4a', '#2c6f37', '#6cc56a'].map(c => hz(snow(c))),
      OUT,
      0,
    );
  } else {
    // a little spring on the right of the top, spilling over the front-right edge as a waterfall into the haze
    const wx = Math.round(hw * 0.42),
      i = wx + hw,
      wb = bottoms[i] + 2,
      top = Math.round(hh * (1 - Math.abs(wx + 0.5) / hw));
    R(wx - 3, top - 3, 5, 2, hz('#5aa7de'));
    R(wx - 2, top - 3, 2, 1, hz('#a8dcf5'));
    R(wx, top - 1, 2, wb - top + 1, hz('#6fb7e8'));
    R(wx, top - 1, 1, wb - top + 1, hz('#c4e8fa'));
    for (let k = 0; k < 4; k++) R(wx - 2 + k * 2, wb + (k % 2), 1, 1, hz('#eef6fb'));
  }
}
// A clump of overlapping round blobs ([x, y, radius] round (cx, cy)) with a 1 px dark outline, lit at the top left,
// shaded at the bottom right and speckled, like the main island's canopies, bushes and rocks. Below `floor` (a y
// relative to cy), when given, nothing is drawn: a rock or a bush sits flat on the grass.
function farBlob(R, cx, cy, blobs, [base, dark, light], OUT, floor = Infinity) {
  const inside = (px, py, grow) => blobs.some(([bx, by, br]) => (px - bx) ** 2 + (py - by) ** 2 <= (br + grow) ** 2),
    ext = Math.ceil(Math.max(...blobs.map(([bx, by, br]) => Math.max(Math.abs(bx), Math.abs(by)) + br))) + 2,
    size = Math.max(...blobs.map(b => b[2]));
  for (let py = -ext; py <= Math.min(ext, floor); py++)
    for (let px = -ext; px <= ext; px++) {
      if (!inside(px + 0.5, py + 0.5, 1)) continue;
      let c = OUT;
      if (py < floor && inside(px + 0.5, py + 0.5, 0)) {
        const lit = px + py < -size * 0.7,
          shadow = px + py > size * 0.45,
          dot = hash(px + 40, py + 40, 77);
        c = lit
          ? dot > 0.8
            ? base
            : light
          : shadow
            ? dot > 0.85
              ? base
              : dark
            : dot > 0.86
              ? dark
              : dot < 0.08
                ? light
                : base;
      }
      R(cx + px, cy + py, 1, 1, c);
    }
}
// A round-canopy tree a little left of the middle, as on the main island: outlined, lit at the top left, its right
// third in shade. Bare in winter: a trunk and branches with snow on them.
function farTree(R, hz, sc, trees, OUT) {
  const r = Math.max(5, Math.round(8.5 * sc)),
    tx = -Math.round(r * 0.3),
    th = Math.max(4, Math.round(6 * sc)),
    cy = -th - r + 1,
    pal = FAR_CANOPY[trees];
  R(tx - 1, -th, 2, th + 1, hz('#6b4a2e'));
  R(tx, -th, 1, th + 1, hz('#4e341f'));
  if (!pal) {
    for (const [dx, dy, len] of [
      [-1, -th - 2, 4],
      [1, -th - 4, 5],
      [-2, -th - 5, 3],
    ]) {
      R(tx + dx * len, dy, len, 1, hz('#5a3d26'));
      R(tx + dx * len, dy - 1, Math.max(1, len - 1), 1, hz('#eef3f7'));
    }
    R(tx - 1, -th - 6, 2, 6, hz('#6b4a2e'));
    return;
  }
  farBlob(
    R,
    tx,
    cy,
    [
      [-0.45 * r, 0.05 * r, 0.62 * r],
      [0.45 * r, 0.12 * r, 0.6 * r],
      [0, -0.42 * r, 0.66 * r],
    ],
    pal.map(hz),
    OUT,
  );
  if (trees === 'fresh')
    for (let k = 0; k < 4; k++) R(tx - r + 2 + k * Math.round(r / 2), cy - 1 + (k % 2) * 3, 1, 1, hz('#f4b8cf'));
}
// env: {df, hour, fx:{cloud,rain,snow,storm,fog}, col: SkyLogic.skyColors(...), reduced, view?: island camera view}
// The gradient, sun, moon and stars stay put; clouds, far islands and birds follow the camera by depth.
