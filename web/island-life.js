// What moves or glows on the island, drawn every frame over the baked island image (web/sky-island.js renderIsland):
// glints and slow rings on the lake and the pool, the mountain fall into the pool and the main waterfall with foam,
// mist round the cone tip and where the main fall drops, lamp light after dark, a flock of birds now and then by day,
// fireflies round the lotus at night, vines and roots swaying under the rim, and a rainbow over the main fall for a
// while after rain. The lake's ducks, fish shadows, duckweed and the pavilion's lantern are in web/island-lake-life.js.
// Everything is slow and soft on purpose: the office stays the centre of attention. The per-frame path allocates
// nothing: positions are worked out once per island, colours once per light step, sprites once.
// lampGlow, fallFlow, rainbowLevel and creatures are pure (tests/island-life.test.mjs); drawLife needs a canvas.
import { hash, night, WATER_Z } from './sky-island.js';
import { mistSprite, MIST_VARIANTS } from './sky-mist.js';
import { LAMP_Z, pavilionLantern } from './island-art.js';
import { SkyLogic } from './sky-logic.js';
import { IslandLakeLife } from './island-lake-life.js';

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const TW = 16,
  TH = 8;

// ---- pure logic ----
// Lamps light up as the day fades: off at df >= 0.8, full at df <= 0.2.
const lampGlow = df => clamp01((0.8 - df) / 0.6);
// Wind for the vines: a breeze, more in rain, most in a storm.
const windOf = fx => Math.min(1.4, 0.15 + 0.6 * fx.rain + 0.8 * fx.storm);
// The falls run up to twice as hard in the rain.
const fallFlow = fx => Math.min(2, 1 + fx.rain);
// A rainbow by day once the rain has stopped (lastRainAt: the last time fx.rain was above 0.3), fading out linearly
// over three minutes. It eases in as the rain thins below 0.1 and as the day brightens past 0.6, so it never pops.
const RAINBOW_MS = 180000;
// Only in the sun after the rain: not while it rains, snows, storms or is foggy.
function rainbowLevel({ fx, df, lastRainAt, now }) {
  const wet = Math.max(fx.rain, fx.snow || 0, fx.storm || 0, fx.fog || 0);
  if (!(df > 0.6) || !(wet < 0.1)) return 0;
  const left = 1 - (now - lastRainAt) / RAINBOW_MS;
  if (!(left > 0)) return 0;
  return Math.min(1, left) * clamp01((df - 0.6) / 0.15) * clamp01((0.1 - wet) / 0.05);
}
// Flocks: start i is due at i * FLOCK_EVERY seconds, give or take FLOCK_JITTER / 2, so two flocks are 40-90 s apart;
// each takes FLOCK_FOR seconds to cross the scene.
const FLOCK_EVERY = 65,
  FLOCK_JITTER = 25,
  FLOCK_FOR = 26,
  FLIES = 8;
const LIFE = { birds: [], flies: [] },
  BIRD_POOL = [0, 1, 2, 3, 4].map(() => ({ x: 0, y: 0, lane: 0, dir: 1, wing: 0 })),
  FLY_POOL = Array.from({ length: FLIES }, () => ({ dx: 0, dy: 0, dz: 0, a: 0 }));
const flockStart = (i, seed) => i * FLOCK_EVERY + (hash(i, seed, 21) - 0.5) * FLOCK_JITTER;
// Grows or shrinks a reused array to n items from its pool; only allocates (rarely) when the count changes.
function fill(arr, pool, n) {
  if (arr.length !== n) {
    arr.length = n;
    for (let i = 0; i < n; i++) arr[i] = pool[i];
  }
}
// Birds by day (df > 0.6) and fireflies at night (df < 0.3), as offsets the drawing places on the island.
// birds: x 0..1 along the crossing, y px off the flight line, lane 0..1 (how high the line runs), dir +1 / -1, wing
// 0 (up) / 1 (spread). flies: dx, dy in tiles off their anchor, dz px above the ground, a brightness 0..1.
// Always returns the same object and arrays.
function creatures(t, df, seed) {
  let n = 0,
    s = 0,
    fi = 0;
  if (df > 0.6) {
    const i0 = Math.floor(t / FLOCK_EVERY);
    for (let i = i0 - 1; i <= i0 + 1 && !n; i++) {
      s = flockStart(i, seed);
      if (t >= s && t < s + FLOCK_FOR) {
        n = 3 + Math.floor(hash(i, seed, 22) * 3);
        fi = i;
      }
    }
  }
  fill(LIFE.birds, BIRD_POOL, n);
  if (n) {
    const u = (t - s) / FLOCK_FOR,
      dir = hash(fi, seed, 23) < 0.5 ? 1 : -1,
      lane = hash(fi, seed, 24);
    for (let j = 0; j < n; j++) {
      // a loose V: the leader in front, the others trailing on alternate sides
      const b = LIFE.birds[j],
        rank = (j + 1) >> 1,
        side = j % 2 ? -1 : 1,
        p = u - rank * 0.014 - hash(fi, j, 25) * 0.006;
      b.x = dir > 0 ? p : 1 - p;
      b.y = side * rank * 5 + Math.sin(t * 1.1 + j * 1.7) * 1.5;
      b.lane = lane;
      b.dir = dir;
      // flap in short bursts, glide in between
      const flapping = Math.sin(t * 0.45 + j * 1.3) > -0.3;
      b.wing = flapping ? Math.floor(t * 4 + j * 0.6) & 1 : 1;
    }
  }
  fill(LIFE.flies, FLY_POOL, df < 0.3 ? FLIES : 0);
  for (let j = 0; j < LIFE.flies.length; j++) {
    const f = LIFE.flies[j],
      h1 = hash(j, seed, 31),
      h2 = hash(j, seed, 32),
      h3 = hash(j, seed, 33);
    f.dx = 0.75 * Math.sin(t * (0.16 + 0.08 * h1) + h2 * 6.28);
    f.dy = 0.75 * Math.cos(t * (0.13 + 0.07 * h2) + h3 * 6.28);
    f.dz = 4 + 5 * (0.5 + 0.5 * Math.sin(t * 0.27 + h1 * 6.28));
    // a slow glow, mostly dim with a soft peak every 6-9 s
    const pulse = 0.5 + 0.5 * Math.sin(t * (0.7 + 0.35 * h3) + h1 * 6.28);
    f.a = pulse * pulse * pulse;
  }
  return LIFE;
}

// ---- drawing state ----
// lastRainAt is shared by every island on the page: they all see the same weather.
// Running phases of the moving water and the vines: each advances by elapsed time × its current speed, so a speed that
// changes during a weather blend changes how fast things move, never where they are (t × speed would jump).
const PHASES = { flow: 0, wind: 0, t: null };
const motionPhases = {
  reset() {
    PHASES.flow = 0;
    PHASES.wind = 0;
    PHASES.t = null;
  },
  step(t, fx) {
    if (t !== PHASES.t) {
      const dt = PHASES.t == null ? 0 : Math.max(0, Math.min(0.25, t - PHASES.t));
      PHASES.flow += dt * fallFlow(fx);
      PHASES.wind += dt * (0.5 + 0.7 * windOf(fx));
      PHASES.t = t;
    }
    return PHASES;
  },
};
const state = { lastRainAt: -Infinity },
  RAINBOW_ARGS = { fx: null, df: 1, lastRainAt: -Infinity, now: 0 };
// Where things are, in scene px, worked out once per island (PG is the island projection, fixed for the page).
const GEO = new WeakMap();
const LAKE_GLINTS = 26,
  POOL_GLINTS = 4,
  RIPPLES = 10,
  FALL_STREAKS = 9,
  VINES = 18;
function geometry(island, PG) {
  const hit = GEO.get(island);
  if (hit && hit.PG === PG) return hit;
  const o = PG(0, 0, 0),
    has = (x, y) => island.cells.has(x + ',' + y),
    g = { PG, ox: o[0], oy: o[1] };
  // lake: glints on a spread of its open tiles (not under the lotus, the pillar or its stones), rings on others; the
  // pool under the mountain fall has a few glints of its own
  const tilesOf = set => [...set].map(k => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const lake = tilesOf(island.pond.cells),
    pav = island.pavilion,
    covered = new Set([
      pav.pillar.x + ',' + pav.pillar.y,
      ...pav.path.map(p => p.x + ',' + p.y),
      ...island.lotus.map(l => l.x + ',' + l.y),
    ]),
    open = lake.filter(([x, y]) => !covered.has(x + ',' + y));
  const pick = (tiles, n, s) =>
    Array.from({ length: n }, (_, i) => {
      const [x, y] = tiles[Math.floor(((i + hash(i, s, 42) * 0.9) * tiles.length) / n) % tiles.length];
      return { x: x + 0.2 + hash(i, s, 43) * 0.6, y: y + 0.2, ph: hash(i, s, 44), dx: hash(i, s, 45) * 0.6 };
    });
  g.glints = pick(open, LAKE_GLINTS, 5);
  g.ripples = pick(open, RIPPLES, 6);
  g.poolGlints = pick(tilesOf(island.mountain.pool.cells), POOL_GLINTS, 7).map(l => ({ ...l, y: l.y + 0.3 }));
  // main fall: a sheet in the plane of the lake's front lip (y = f.y + 1), from the water down past the cone
  const f = island.waterfall;
  g.fall = {
    Y: f.y + 1,
    xa: f.x + 0.12,
    xb: f.x + 0.88,
    top: WATER_Z,
    bot: -(island.depth.get(f.x + ',' + f.y) || 10) - SkyLogic.WATERFALL_LEN,
    q: -1,
    grad: null,
  };
  g.fallStreaks = Array.from({ length: FALL_STREAKS }, (_, i) => ({ u: 0.08 + 0.84 * ((i * 0.37) % 1), ph: i * 0.11 }));
  // mountain falls: out of the gap between the peaks (island.mountain.gap), down the rock into the pool at its foot
  const gap = island.mountain.gap;
  g.mfall = { Y: gap.y, xa: gap.x - gap.w, xb: gap.x + gap.w, top: gap.z, bot: WATER_Z, q: -1, grad: null };
  // cone tip: the deepest column
  const tip = island.list.reduce((a, c) => (c.d > a.d ? c : a));
  g.tip = { x: o[0] + (tip.x - tip.y) * TW, y: o[1] + (tip.x + tip.y + 1) * TH + tip.d };
  // vines and roots under the rim: front-facing shore edges, spread out, none behind the main fall
  const edges = [];
  for (const c of island.list) {
    if (!has(c.x, c.y + 1) && !(c.y === f.y && Math.abs(c.x - f.x) <= 1)) edges.push([c.x, c.y, 0]);
    if (!has(c.x + 1, c.y)) edges.push([c.x, c.y, 1]);
  }
  edges.sort((a, b) => hash(a[0], a[1], 46 + a[2]) - hash(b[0], b[1], 46 + b[2]));
  g.vines = edges.slice(0, VINES).map(([x, y, side]) => {
    const u = 0.2 + 0.6 * hash(x, y, 47),
      ex = side ? x + 1 : x + u,
      ey = side ? y + u : y + 1,
      root = hash(x, y, 48) < 0.35;
    return {
      x: Math.round(o[0] + (ex - ey) * TW),
      y: Math.round(o[1] + (ex + ey) * TH + (root ? 5 : 2)),
      len: Math.round(root ? 4 + hash(x, y, 49) * 6 : 6 + hash(x, y, 49) * 13),
      root,
      ph: hash(x, y, 50) * 6.28,
      kink: Math.floor(hash(x, y, 51) * 6) + 2,
      lean: hash(x, y, 52) < 0.5 ? -1 : 1,
    };
  });
  g.lamps = island.lamps.map(l => ({ x: o[0] + (l.x - l.y) * TW, y: o[1] + (l.x + l.y + 1) * TH }));
  // fireflies gather round the lotus, the flowering ones first, and over the lake's banks where there is none
  const shoreTiles = lake.filter(([x, y]) => !island.pond.cells.has(x + ',' + (y - 1)) || !has(x, y + 1));
  const lotus = island.lotus.filter(l => l.flower).concat(island.lotus.filter(l => !l.flower));
  g.anchors = Array.from({ length: FLIES }, (_, i) => {
    const l = i < FLIES - 2 && lotus.length ? lotus[Math.floor((i * lotus.length) / (FLIES - 2))] : null,
      s = l ? null : shoreTiles[Math.floor((i / FLIES) * shoreTiles.length)];
    return l ? { x: l.x + 0.5, y: l.y + 0.5 } : { x: s[0] + 0.5, y: s[1] + 0.5 };
  });
  // birds cross the sky over the back lawn, above the office roof
  const { minX, maxX, minY, maxY } = island.bounds;
  g.sky = { x0: o[0] + (minX - maxY) * TW - 40, x1: o[0] + (maxX - minY) * TW + 40, y: o[1] + (minX + minY) * TH };
  GEO.set(island, g);
  return g;
}

// Colours follow the island's light; worked out again only when the light moves a step.
let PAL = null;
function palette(df) {
  const q = Math.round(df * 20);
  if (PAL && PAL.q === q) return PAL;
  const d = q / 20;
  PAL = {
    q,
    glint: night('#ffffff', d),
    current: night('#d6efff', d),
    fallEdge: night('#3c82c8', d),
    foam: night('#ffffff', d),
    mfall: night('#7cc3f2', d),
    vine: night('#3f7f33', d),
    leaf: night('#5aa046', d),
    root: night('#6b4a2a', d),
    bird: night('#3a3550', d),
  };
  return PAL;
}
// Soft sprites, rendered once: a warm lamp halo, its pool of light on the ground, a firefly glow and the rainbow.
const SPRITES = {};
function sprite(name, w, h, paint) {
  let c = SPRITES[name];
  if (!c) {
    c = SPRITES[name] = document.createElement('canvas');
    c.width = w;
    c.height = h;
    paint(c.getContext('2d'), w, h);
  }
  return c;
}
const radial = (stops, scaleY) => (g, w, h) => {
  g.translate(w / 2, h / 2);
  g.scale(1, scaleY);
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  for (const [at, col] of stops) rg.addColorStop(at, col);
  g.fillStyle = rg;
  g.beginPath();
  g.arc(0, 0, w / 2, 0, 7);
  g.fill();
};
const HALO = radial(
    [
      [0, 'rgba(255,214,130,0.75)'],
      [0.35, 'rgba(255,190,100,0.28)'],
      [1, 'rgba(255,170,80,0)'],
    ],
    1,
  ),
  POOL = radial(
    [
      [0, 'rgba(255,205,120,0.45)'],
      [1, 'rgba(255,190,100,0)'],
    ],
    0.5,
  ),
  GLOW = radial(
    [
      [0, 'rgba(230,255,140,0.9)'],
      [0.4, 'rgba(200,250,110,0.3)'],
      [1, 'rgba(180,240,100,0)'],
    ],
    1,
  );
const RAINBOW_COLS = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'];
function paintRainbow(g, w, h) {
  const r = w / 2 - 2;
  g.lineWidth = 1.6;
  RAINBOW_COLS.forEach((c, i) => {
    g.strokeStyle = c;
    g.beginPath();
    g.arc(w / 2, h, r - i * 1.6, Math.PI, 0);
    g.stroke();
  });
  // the feet melt away into the spray
  g.globalCompositeOperation = 'destination-in';
  const lg = g.createLinearGradient(0, 0, 0, h);
  lg.addColorStop(0, 'rgba(0,0,0,1)');
  lg.addColorStop(0.45, 'rgba(0,0,0,0.8)');
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg;
  g.fillRect(0, 0, w, h);
}

// ---- drawing helpers (scene px; g holds the projection origin) ----
// A quad in the vertical plane y = Y, between x = xa..xb and heights za..zb.
function quadY(ctx, g, Y, xa, xb, za, zb) {
  const ax = g.ox + (xa - Y) * TW,
    bx = g.ox + (xb - Y) * TW,
    ay = g.oy + (xa + Y) * TH,
    by = g.oy + (xb + Y) * TH;
  ctx.beginPath();
  ctx.moveTo(ax, ay - za);
  ctx.lineTo(bx, by - za);
  ctx.lineTo(bx, by - zb);
  ctx.lineTo(ax, ay - zb);
  ctx.closePath();
  ctx.fill();
}
const sx = (g, x, y) => g.ox + (x - y) * TW,
  sy = (g, x, y, z) => g.oy + (x + y) * TH - z;
// Mist sprites come tinted from sky-mist's cache; looked up again only when the sky's colours change.
const MIST = { lit: '', shade: '', a: [], b: [] };
function mistSprites(lit, shade) {
  if (MIST.lit !== lit || MIST.shade !== shade) {
    MIST.lit = lit;
    MIST.shade = shade;
    for (let v = 0; v < MIST_VARIANTS; v++) {
      MIST.a[v] = mistSprite(v, lit);
      MIST.b[v] = mistSprite(v, shade);
    }
  }
  return MIST;
}
function wisp(ctx, m, v, x, y, w, h, a) {
  if (a <= 0.01) return;
  ctx.globalAlpha = a * 0.35;
  ctx.drawImage(m.b[v], x - w / 2, y - h / 2 + h * 0.14, w, h);
  ctx.globalAlpha = a;
  ctx.drawImage(m.a[v], x - w / 2, y - h / 2, w, h);
}

// ---- the layers ----
// A flat ring on the water, rr px across each way.
function ring(ctx, x, y, rr) {
  ctx.fillRect(x - rr, y - 1, rr * 2, 1);
  ctx.fillRect(x - rr, y + 1, rr * 2, 1);
  ctx.fillRect(x - rr - 1, y, 1, 1);
  ctx.fillRect(x + rr, y, 1, 1);
}
// Slow glints drifting a little way across the water, each fading in and out.
function glints(ctx, g, list, t, a) {
  for (let i = 0; i < list.length; i++) {
    const l = list[i],
      p = (t * 0.2 + l.ph) % 1,
      y = l.y + p * 0.6;
    ctx.globalAlpha = a * Math.sin(p * Math.PI);
    ctx.fillRect(Math.round(sx(g, l.x, y)), Math.round(sy(g, l.x, y, WATER_Z)), 2, 1);
  }
}
function drawWater(ctx, g, P, t, df, rain) {
  const dim = 0.25 + 0.45 * df;
  ctx.fillStyle = P.glint;
  glints(ctx, g, g.glints, t, dim * 0.8);
  glints(ctx, g, g.poolGlints, t, dim * 0.7);
  // in calm weather a slow ring now and then (two at a time, 9 s each), many quick ones in the rain
  for (let i = 0; i < 2; i++) {
    const c = t / 9 + i / 2,
      l = g.ripples[(Math.floor(c) * 3 + i * 5) % g.ripples.length],
      p = c % 1;
    ctx.globalAlpha = dim * 0.35 * (1 - p) * Math.min(1, p * 6);
    ring(
      ctx,
      Math.round(sx(g, l.x + l.dx, l.y + 0.3)),
      Math.round(sy(g, l.x + l.dx, l.y + 0.3, WATER_Z)),
      (2 + p * 5) | 0,
    );
  }
  if (rain > 0.05)
    for (let i = 0; i < g.ripples.length; i++) {
      const l = g.ripples[i],
        p = (t * 0.8 + l.ph) % 1,
        rr = 1 + Math.floor(p * 4);
      ctx.globalAlpha = rain * dim * (1 - p) * 0.9;
      ring(ctx, Math.round(sx(g, l.x + l.dx, l.y + 0.3)), Math.round(sy(g, l.x + l.dx, l.y + 0.3, WATER_Z)), rr);
    }
  ctx.globalAlpha = 1;
}
function drawMountainFall(ctx, g, P, t, flow, fp) {
  const m = g.mfall,
    wide = (flow - 1) * 0.12;
  // the gradients are made again only when the light moves a step
  if (m.q !== P.q) {
    m.q = P.q;
    m.grad = ctx.createLinearGradient(0, sy(g, m.xa, m.Y, m.top), 0, sy(g, m.xa, m.Y, m.bot));
    m.grad.addColorStop(0, P.foam);
    m.grad.addColorStop(0.15, P.mfall);
    m.grad.addColorStop(1, P.current);
  }
  ctx.fillStyle = m.grad;
  ctx.globalAlpha = 0.9;
  quadY(ctx, g, m.Y, m.xa - wide, m.xb + wide, m.top, m.bot);
  ctx.fillStyle = P.foam;
  for (let i = 0; i < 4; i++) {
    const p = (fp * 0.7 + i * 0.25) % 1,
      z = m.top - (m.top - m.bot) * p,
      u = m.xa + 0.12 + (m.xb - m.xa - 0.3) * ((i * 0.43) % 1);
    ctx.globalAlpha = 0.6 * (1 - p);
    quadY(ctx, g, m.Y, u, u + 0.08, z, z - 6);
  }
  // foam where it lands in the pool, and rings spreading out from it
  const n = Math.round(4 + 3 * (flow - 1));
  for (let i = 0; i < n; i++) {
    const p = (t * 0.9 + i / n) % 1,
      x = m.xa - 0.15 + (m.xb - m.xa + 0.3) * ((i * 0.618) % 1),
      y = m.Y + 0.15 + 0.5 * p;
    ctx.globalAlpha = 0.85 * (1 - p);
    const s = 1 + (p < 0.5 ? 1 : 0);
    ctx.fillRect(Math.round(sx(g, x, y)), Math.round(sy(g, x, y, m.bot + 1)), s + 1, s);
  }
  const mx = (m.xa + m.xb) / 2,
    X = Math.round(sx(g, mx, m.Y + 0.45)),
    Y = Math.round(sy(g, mx, m.Y + 0.45, m.bot));
  for (let i = 0; i < 2; i++) {
    const p = (t * 0.45 + i / 2) % 1;
    ctx.globalAlpha = 0.45 * (1 - p);
    ring(ctx, X, Y, 3 + Math.floor(p * 6));
  }
  ctx.globalAlpha = 1;
}
function drawVines(ctx, g, P, wp, wind, still) {
  const amp = still ? 0 : 0.7 + 2.2 * wind;
  for (let i = 0; i < g.vines.length; i++) {
    const v = g.vines[i],
      sway = amp * (Math.sin(wp + v.ph) + 0.35 * wind * Math.sin(wp * 2.3 + v.ph * 1.7)),
      stiff = v.root ? 0.3 : 1;
    let run = 0,
      runX = 0;
    ctx.fillStyle = v.root ? P.root : P.vine;
    for (let j = 0; j <= v.len; j++) {
      const k = j / v.len,
        off = j === v.len ? NaN : Math.round(sway * stiff * k * k + (v.root && j >= v.kink ? v.lean : 0));
      if (j && off === runX) continue;
      if (j) ctx.fillRect(v.x + runX, v.y + run, 1, j - run);
      run = j;
      runX = off;
    }
    if (!v.root) {
      ctx.fillStyle = P.leaf;
      for (let j = 3; j < v.len; j += 4) {
        const k = j / v.len;
        ctx.fillRect(v.x + Math.round(sway * k * k) + (j & 4 ? 1 : -1), v.y + j, 1, 1);
      }
    }
  }
}
function drawMainFall(ctx, g, P, t, flow, fp) {
  const f = g.fall,
    wide = (flow - 1) * 0.06;
  if (f.q !== P.q) {
    f.q = P.q;
    f.grad = ctx.createLinearGradient(0, sy(g, f.xa, f.Y, f.top), 0, sy(g, f.xa, f.Y, f.bot));
    f.grad.addColorStop(0, P.mfall);
    f.grad.addColorStop(0.6, P.current);
    f.grad.addColorStop(1, 'rgba(220,238,255,0)');
  }
  ctx.fillStyle = f.grad;
  ctx.globalAlpha = 0.92;
  quadY(ctx, g, f.Y, f.xa - wide, f.xb + wide, f.top, f.bot);
  // darker edges give the sheet some body; light streaks slide down it
  ctx.fillStyle = P.fallEdge;
  ctx.globalAlpha = 0.35;
  quadY(ctx, g, f.Y, f.xa - wide, f.xa - wide + 0.07, f.top, f.bot * 0.7);
  quadY(ctx, g, f.Y, f.xb + wide - 0.07, f.xb + wide, f.top, f.bot * 0.7);
  ctx.fillStyle = P.foam;
  for (let i = 0; i < g.fallStreaks.length; i++) {
    const s = g.fallStreaks[i],
      p = (fp * 0.45 + s.ph) % 1,
      z = f.top - (f.top - f.bot) * p,
      u = f.xa + (f.xb - f.xa) * s.u;
    ctx.globalAlpha = 0.7 * (1 - p);
    quadY(ctx, g, f.Y, u, u + 0.05, z, z - 14);
  }
  // foam where the lake spills over the lip, bubbling a little
  ctx.globalAlpha = 0.75;
  quadY(ctx, g, f.Y, f.xa - wide - 0.05, f.xb + wide + 0.05, f.top + 0.8, f.top - 1.6 - flow);
  const n = Math.round(3 + 3 * (flow - 1));
  for (let i = 0; i < n; i++) {
    const p = (t * 0.6 + i / n) % 1,
      x = f.xa + (f.xb - f.xa) * ((i * 0.618 + 0.1) % 1);
    ctx.globalAlpha = 0.8 * Math.sin(p * Math.PI);
    ctx.fillRect(Math.round(sx(g, x, f.Y)) - 1, Math.round(sy(g, x, f.Y, f.top + 1 + p * 2)), 2, 1);
  }
  ctx.globalAlpha = 1;
}
function drawMist(ctx, g, m, t, flow, still) {
  const tt = still ? 0 : t,
    f = g.fall,
    fx = sx(g, (f.xa + f.xb) / 2, f.Y),
    fy = sy(g, (f.xa + f.xb) / 2, f.Y, f.bot * 0.82);
  // where the main fall drops: the sheet frays into spray
  for (let i = 0; i < 2; i++) {
    const br = 0.5 + 0.5 * Math.sin(tt * 0.3 + i * 2.4);
    wisp(
      ctx,
      m,
      i,
      fx + (i ? 10 : -12) + Math.sin(tt * 0.07 + i) * 6,
      fy + i * 10,
      90,
      30,
      (0.4 + 0.15 * br) * flow * 0.7,
    );
  }
  // thin bands drifting slowly round the lower cone; they stay above the tip, where the scene canvas ends
  for (let i = 0; i < 3; i++) {
    const x = g.tip.x + (i - 1) * (80 - i * 10) + Math.sin(tt * (0.045 + i * 0.01) + i * 2.1) * 45,
      y = g.tip.y - 100 + i * 30 + Math.sin(tt * 0.05 + i) * 4,
      br = 0.75 + 0.25 * Math.sin(tt * 0.12 + i * 1.9);
    wisp(ctx, m, (i + 1) % MIST_VARIANTS, x, y, 210 - i * 40, 44 - i * 8, 0.5 * br);
  }
  ctx.globalAlpha = 1;
}
function drawRainbow(ctx, g, level) {
  if (level <= 0.01) return;
  const f = g.fall,
    img = sprite('rainbow', 110, 56, paintRainbow),
    x = sx(g, (f.xa + f.xb) / 2, f.Y),
    y = sy(g, (f.xa + f.xb) / 2, f.Y, f.bot * 0.75);
  // its left foot stands in the spray of the fall, the arc leans out over the open sky in front of the island
  ctx.globalAlpha = 0.5 * level;
  ctx.drawImage(img, x - 8, y - 56);
  ctx.globalAlpha = 1;
}
// The lamps' light: a warm pool on the lawn under each (with the rest of the island life, under everyone walking
// past) and the glow round its glass (drawLampLight, right after the scene draws that lamp's post among the sorted
// sprites, so the post never covers its own light).
const lampLevel = (glow, t, i, still) => glow * (still ? 1 : 0.94 + 0.06 * Math.sin(t * 0.6 + i * 1.9));
function drawPools(ctx, g, t, glow, still) {
  if (glow <= 0.01) return;
  const pool = sprite('pool', 40, 40, POOL);
  for (let i = 0; i < g.lamps.length; i++) {
    const l = g.lamps[i];
    ctx.globalAlpha = lampLevel(glow, t, i, still);
    ctx.drawImage(pool, l.x - 20, l.y - 20);
  }
  ctx.globalAlpha = 1;
}
function drawLampLight(ctx, island, PG, i, t, env) {
  const glow = lampGlow(env.df);
  if (glow <= 0.01) return;
  const l = geometry(island, PG).lamps[i],
    halo = sprite('halo', 40, 40, HALO),
    smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = lampLevel(glow, t, i, !!env.reduced);
  ctx.drawImage(halo, l.x - 20, l.y - LAMP_Z - 20);
  ctx.fillStyle = '#ffe7a3';
  ctx.fillRect(Math.round(l.x) - 1, Math.round(l.y - LAMP_Z) - 1, 3, 2);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = smooth;
}
// The pavilion's lantern and its halo, drawn right after the pavilion's sorted sprite (web/office-draw.js) so the roof
// never covers it; it hangs where the art puts it (pavilionLantern).
function drawLanternLight(ctx, island, PG, t, env) {
  const at = pavilionLantern(island),
    glow = lampGlow(env.df);
  if (!at || glow <= 0.01) return;
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  const g = geometry(island, PG);
  IslandLakeLife.drawLanternLight(ctx, g, at, lampLevel(glow, t, 7, !!env.reduced), sprite('halo', 40, 40, HALO));
  ctx.imageSmoothingEnabled = smooth;
}
function drawFlies(ctx, g, life, dark, still) {
  if (!life.flies.length || dark <= 0.01) return;
  const glow = sprite('fly', 16, 16, GLOW);
  for (let i = 0; i < life.flies.length; i++) {
    const f = life.flies[i],
      an = g.anchors[i],
      x = sx(g, an.x + f.dx, an.y + f.dy),
      y = sy(g, an.x + f.dx, an.y + f.dy, f.dz),
      a = dark * (still ? 0.7 : 0.15 + 0.85 * f.a);
    ctx.globalAlpha = a * 0.9;
    ctx.drawImage(glow, x - 8, y - 8);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#f4ffb4';
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  ctx.globalAlpha = 1;
}
function drawBirds(ctx, g, P, life) {
  if (!life.birds.length) return;
  const s = g.sky;
  ctx.fillStyle = P.bird;
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < life.birds.length; i++) {
    const b = life.birds[i],
      x = Math.round(s.x0 + (s.x1 - s.x0) * b.x),
      y = Math.round(s.y + 25 + b.lane * 50 + b.y - b.x * b.dir * 18);
    ctx.fillRect(x, y, 1, 1);
    if (b.wing) {
      ctx.fillRect(x - 2, y - 1, 2, 1);
      ctx.fillRect(x + 1, y - 1, 2, 1);
    } else {
      ctx.fillRect(x - 1, y - 1, 1, 1);
      ctx.fillRect(x + 1, y - 1, 1, 1);
      ctx.fillRect(x - 2, y - 2, 1, 1);
      ctx.fillRect(x + 2, y - 2, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// Everything that moves or glows, over the baked island. PG is the island projection, t seconds, env the frame's
// {df, fx, reduced, col, snow?} (col: SkyLogic.skyColors, for the mist).
function drawLife(ctx, island, PG, t, env) {
  const g = geometry(island, PG),
    df = env.df,
    fx = env.fx,
    still = !!env.reduced,
    now = Date.now();
  if (fx.rain > 0.3) state.lastRainAt = now;
  const P = palette(df),
    flow = fallFlow(fx),
    tw = still ? 0 : t,
    wind = windOf(fx),
    ph = motionPhases.step(t, fx),
    fp = still ? 0 : ph.flow,
    life = creatures(tw, df, 7);
  drawWater(ctx, g, P, tw, df, still ? 0 : fx.rain);
  // the lake's life: fish under the water, duckweed and ducks on it, the lantern's light on it
  const L = IslandLakeLife,
    glow = lampGlow(df);
  L.drawFish(ctx, g, L.fish(island, tw, env.frozen), df);
  L.drawWeed(ctx, g, L.weed(island, tw, env.frozen), df);
  L.drawDucks(ctx, g, L.ducks(island, t, df, still, env.frozen), df, tw);
  L.drawLanternWater(ctx, g, island, glow, tw);
  drawMountainFall(ctx, g, P, tw, flow, fp);
  drawVines(ctx, g, P, ph.wind, wind, still);
  drawMainFall(ctx, g, P, tw, flow, fp);
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  const col = env.col,
    m = mistSprites(col ? col.cloud : '#f2f5fa', col ? col.cloudShade : '#c9d2e3');
  drawMist(ctx, g, m, t, 0.7 + 0.3 * flow, still);
  RAINBOW_ARGS.fx = fx;
  RAINBOW_ARGS.df = df;
  RAINBOW_ARGS.lastRainAt = state.lastRainAt;
  RAINBOW_ARGS.now = now;
  drawRainbow(ctx, g, rainbowLevel(RAINBOW_ARGS));
  drawPools(ctx, g, t, glow, still);
  drawFlies(ctx, g, life, clamp01((0.3 - df) / 0.1), still);
  ctx.imageSmoothingEnabled = smooth;
  // the birds sit out heavy rain and storms
  if (!still && fx.rain < 0.5 && fx.storm < 0.3) drawBirds(ctx, g, P, life);
}

export const IslandLife = {
  lampGlow,
  fallFlow,
  rainbowLevel,
  creatures,
  motionPhases,
  drawLife,
  drawLampLight,
  drawLanternLight,
};
