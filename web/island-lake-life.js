// Life on the big lake (drawn by web/island-life.js over the baked island): two or three ducks swimming slow loops
// on island.ducks.lanes and now and then diving, dim fish shadows gliding under the water, duckweed drifting round
// its home tiles, and the pavilion's lantern after dark. Everything is slow and soft on purpose.
// ducks, fish and weed are pure apart from the ducks' running swim distance (kept per island, like motionPhases in
// web/island-life.js) and are tested in tests/island-life.test.mjs. None of them allocates per call: they fill and
// return the same arrays and objects every time.
import { hash, WATER_Z } from './island-grid.js';
import { night } from './sky-island.js';
import { pavilionLantern } from './island-art.js';

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const TW = 16,
  TH = 8;
const K = (x, y) => Math.floor(x) + ',' + Math.floor(y);

// ---- per-island setup, once ----
// Fish paths: ellipses in tile axes on open water. Every point of a path, and its body a third of a tile either side,
// is over the lake and clear of the lotus, the pavilion's pillar and its stepping stones.
const FISH = 4,
  FISH_SPEED = 0.22,
  FISH_RADII = [
    [2.2, 1.6],
    [1.6, 2.1],
    [1.8, 1.3],
    [1.4, 1.0],
    [1.0, 0.8],
  ];
// Ducks swim DUCK_SPEED tiles a second (give or take 15 %); they dive every DIVE_EVERY..+DIVE_SPREAD seconds of
// swimming, staying under for about DIVE_FOR seconds.
const DUCKS = 3,
  DUCK_SPEED = 0.12,
  DIVE_EVERY = 40,
  DIVE_SPREAD = 30,
  DIVE_FOR = 4;
// Duckweed drifts round its home tile's middle: up to WEED_OPEN tiles toward open water, WEED_BANK toward a bank,
// once every 4-7 minutes.
const WEED_OPEN = 0.32,
  WEED_BANK = 0.12;

const DATA = new WeakMap();
function setup(island) {
  let d = DATA.get(island);
  if (d) return d;
  const lake = island.pond.cells,
    pav = island.pavilion,
    blocked = new Set([
      K(pav.pillar.x, pav.pillar.y),
      ...pav.path.map(p => K(p.x, p.y)),
      ...island.lotus.map(l => K(l.x, l.y)),
    ]);
  const clear = (x, y, r) => {
    for (const [a, b] of [
      [0, 0],
      [-r, 0],
      [r, 0],
      [0, -r],
      [0, r],
    ])
      if (!lake.has(K(x + a, y + b)) || blocked.has(K(x + a, y + b))) return false;
    return true;
  };
  // ducks: one to a lane, a second on the first lane if there are only two lanes or fewer
  const lanes = island.ducks.lanes.map(pts => {
    const seg = pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length];
      return Math.hypot(q[0] - p[0], q[1] - p[1]);
    });
    return { pts, seg, len: seg.reduce((a, b) => a + b, 0) };
  });
  const nd = lanes.length ? Math.min(DUCKS, Math.max(2, lanes.length)) : 0;
  const ducks = Array.from({ length: nd }, (_, i) => {
    const lane = lanes[i % lanes.length];
    return {
      lane,
      s0: (hash(i, 3, 71) + (i >= lanes.length ? 0.5 : 0)) * lane.len,
      sp: 0.85 + 0.3 * hash(i, 4, 71),
      dir: hash(i, 5, 71) < 0.5 ? 1 : -1,
      every: DIVE_EVERY + DIVE_SPREAD * hash(i, 6, 71),
      d0: hash(i, 7, 73), // where in its dive cycle each duck starts, so they never all dive at once
      out: { x: 0, y: 0, face: 1, dive: 0, asleep: false, go: 0 },
    };
  });
  // fish: try ellipses round lake tiles in hash order, widest first; keep up to FISH, two tiles apart
  const tiles = [...lake]
    .map(k => k.split(',').map(Number))
    .sort((a, b) => hash(a[0], a[1], 72) - hash(b[0], b[1], 72));
  const paths = [];
  for (const [rx, ry] of FISH_RADII)
    for (const [tx, ty] of tiles) {
      if (paths.length >= FISH) break;
      const cx = tx + 0.5,
        cy = ty + 0.5;
      if (paths.some(p => Math.hypot(p.cx - cx, p.cy - cy) < 2)) continue;
      let ok = true;
      for (let s = 0; s < 64 && ok; s++) {
        const a = (s / 64) * Math.PI * 2;
        ok = clear(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 0.34);
      }
      if (!ok) continue;
      const i = paths.length;
      paths.push({
        cx,
        cy,
        rx,
        ry,
        w: FISH_SPEED / ((rx + ry) / 2),
        a0: hash(i, 1, 73) * 6.28,
        ph: hash(i, 2, 73) * 6.28,
        dir: i % 2 ? -1 : 1,
        out: { x: 0, y: 0, hx: 1, hy: 0, a: 1 },
      });
    }
  // duckweed: how far each home may drift each way before it would reach a bank
  const weed = island.duckweed.map((h, i) => {
    const room = (a, b) => (lake.has(K(h.x + a, h.y + b)) ? WEED_OPEN : WEED_BANK);
    return {
      x: h.x + 0.5,
      y: h.y + 0.5,
      xp: room(1, 0),
      xm: room(-1, 0),
      yp: room(0, 1),
      ym: room(0, -1),
      wx: (Math.PI * 2) / (240 + 180 * hash(i, 1, 74)),
      wy: (Math.PI * 2) / (240 + 180 * hash(i, 2, 74)),
      px: hash(i, 3, 74) * 6.28,
      py: hash(i, 4, 74) * 6.28,
      out: { x: 0, y: 0 },
    };
  });
  d = {
    ducks,
    duckOut: ducks.map(k => k.out),
    swim: { s: 0, t: null },
    fish: paths,
    fishOut: paths.map(p => p.out),
    weed,
    weedOut: weed.map(w => w.out),
  };
  DATA.set(island, d);
  return d;
}

// ---- pure logic ----
// How hard the ducks swim: not at all at night (df < 0.3), easing up to full by df 0.5.
const duckGo = df => clamp01((df - 0.3) / 0.2);
// Where each duck is: x, y in tiles; face +1 heading right on screen, -1 left; dive 0 afloat .. 1 under; asleep at
// night. The swim distance runs on elapsed time × speed (a gap is capped at 0.25 s), so dusk eases them to a stop
// where they are and morning sets them off from there.
function ducks(island, t, df, still) {
  const d = setup(island),
    sw = d.swim,
    go = still ? 0 : duckGo(df);
  if (t !== sw.t) {
    const dt = sw.t == null ? 0 : Math.max(0, Math.min(0.25, t - sw.t));
    sw.s += dt * DUCK_SPEED * go;
    sw.t = t;
  }
  for (let i = 0; i < d.ducks.length; i++) {
    const k = d.ducks[i],
      o = k.out,
      L = k.lane,
      run = sw.s * k.sp;
    let s = (((k.s0 + k.dir * run) % L.len) + L.len) % L.len,
      j = 0;
    while (s > L.seg[j] && j < L.seg.length - 1) s -= L.seg[j++];
    const p = L.pts[j],
      q = L.pts[(j + 1) % L.pts.length],
      u = L.seg[j] ? s / L.seg[j] : 0,
      vx = (q[0] - p[0]) * k.dir,
      vy = (q[1] - p[1]) * k.dir;
    o.x = p[0] + (q[0] - p[0]) * u;
    o.y = p[1] + (q[1] - p[1]) * u;
    // keep the old facing while heading straight up or down the screen, so it never flickers
    if (Math.abs(vx - vy) > 0.05 * (L.seg[j] || 1)) o.face = vx - vy > 0 ? 1 : -1;
    // a dive: under for about DIVE_FOR s of swimming once a cycle, surfacing as the ducks slow for the night
    const c = (run / DUCK_SPEED + k.d0 * k.every) % k.every;
    o.dive = c < DIVE_FOR ? clamp01(1.6 * Math.sin((Math.PI * c) / DIVE_FOR)) * go : 0;
    o.asleep = df < 0.3;
    o.go = go;
  }
  return d.duckOut;
}
// Fish shadows at time t: x, y in tiles, hx, hy their heading (a unit vector in tile axes), a how clearly they show
// (0.55..1, as they glide deeper or nearer the surface).
function fish(island, t) {
  const d = setup(island);
  for (let i = 0; i < d.fish.length; i++) {
    const f = d.fish[i],
      o = f.out,
      a = f.a0 + f.dir * (f.w * t + 0.6 * Math.sin(t * 0.09 + f.ph)),
      c = Math.cos(a),
      s = Math.sin(a),
      hx = -f.rx * s * f.dir,
      hy = f.ry * c * f.dir,
      n = Math.hypot(hx, hy) || 1;
    o.x = f.cx + f.rx * c;
    o.y = f.cy + f.ry * s;
    o.hx = hx / n;
    o.hy = hy / n;
    o.a = 0.775 + 0.225 * Math.sin(t * 0.21 + f.ph * 1.7);
  }
  return d.fishOut;
}
// Duckweed at time t: x, y in tiles, one per island.duckweed home, never more than WEED_OPEN from its middle.
function weed(island, t) {
  const d = setup(island);
  for (let i = 0; i < d.weed.length; i++) {
    const w = d.weed[i],
      o = w.out,
      ux = Math.sin(t * w.wx + w.px),
      uy = Math.sin(t * w.wy + w.py);
    o.x = w.x + ux * (ux > 0 ? w.xp : w.xm);
    o.y = w.y + uy * (uy > 0 ? w.yp : w.ym);
  }
  return d.weedOut;
}
function reset(island) {
  const sw = setup(island).swim;
  sw.s = 0;
  sw.t = null;
}

// ---- drawing (scene px; g holds the projection origin ox, oy) ----
const sx = (g, x, y) => g.ox + (x - y) * TW,
  sy = (g, x, y, z) => g.oy + (x + y) * TH - z;
let PAL = null;
function palette(df) {
  const q = Math.round(df * 20);
  if (PAL && PAL.q === q) return PAL;
  const d = q / 20;
  PAL = {
    q,
    feather: night('#ffffff', d),
    shade: night('#cdd5e2', d),
    beak: night('#f2a33a', d),
    eye: '#3B2F4A',
    line: night('#3B2F4A', d),
    wake: night('#e8f6ff', d),
    fish: '#16284a',
    weed: night('#86c24e', d),
    weedDark: night('#5c9a3a', d),
  };
  return PAL;
}
// A duck's shape in one colour: a body 9 px long with a rounded back, its tail up behind, its head up front (tucked
// onto its back asleep).
function duckShape(ctx, X, Y, f, asleep) {
  part(ctx, X, Y, f, -5, -3, 9, 3);
  part(ctx, X, Y, f, -6, -4, 2, 1);
  part(ctx, X, Y, f, -4, -4, 9, 1);
  if (asleep) part(ctx, X, Y, f, 0, -5, 3, 2);
  else part(ctx, X, Y, f, 2, -8, 3, 4);
}
// A rect mirrored about the duck's middle when it faces left.
function part(ctx, X, Y, face, dx, dy, w, h) {
  ctx.fillRect(face > 0 ? X + dx : X - dx - w, Y + dy, w, h);
}
// A flat ring on the water, rr px across each way.
function ring(ctx, x, y, rr) {
  const h = rr > 3 ? 2 : 1;
  ctx.fillRect(x - rr + 1, y - h, rr * 2 - 1, 1);
  ctx.fillRect(x - rr + 1, y + h, rr * 2 - 1, 1);
  ctx.fillRect(x - rr, y, 1, 1);
  ctx.fillRect(x + rr, y, 1, 1);
}
function drawFish(ctx, g, list, df) {
  if (!list.length) return;
  const P = palette(df),
    base = 0.1 + 0.16 * df;
  ctx.fillStyle = P.fish;
  for (let i = 0; i < list.length; i++) {
    const f = list[i],
      vx = (f.hx - f.hy) * TW,
      vy = (f.hx + f.hy) * TH,
      n = Math.hypot(vx, vy) || 1,
      ux = vx / n,
      uy = vy / n,
      X = sx(g, f.x, f.y),
      Y = sy(g, f.x, f.y, WATER_Z - 1);
    ctx.globalAlpha = base * f.a;
    // a soft body thickest just behind the head, then a forked tail
    for (let k = -3; k <= 3; k++)
      ctx.fillRect(Math.round(X + ux * k), Math.round(Y + uy * k), 1, k >= -1 && k <= 2 ? 2 : 1);
    const tx = X - ux * 4.5,
      ty = Y - uy * 4.5;
    ctx.fillRect(Math.round(tx - uy * 1.5), Math.round(ty + ux * 0.8), 1, 1);
    ctx.fillRect(Math.round(tx + uy * 1.5), Math.round(ty - ux * 0.8), 1, 1);
  }
  ctx.globalAlpha = 1;
}
function drawWeed(ctx, g, list, df) {
  if (!list.length) return;
  const P = palette(df);
  ctx.globalAlpha = 0.95;
  for (let i = 0; i < list.length; i++) {
    const w = list[i],
      X = Math.round(sx(g, w.x, w.y)),
      Y = Math.round(sy(g, w.x, w.y, WATER_Z)),
      h = i * 7;
    // a few round leaves a patch, the same shapes every frame (from the home's index)
    ctx.fillStyle = P.weedDark;
    ctx.fillRect(X - 5 + (h % 3), Y + 1, 2, 1);
    ctx.fillRect(X + 3, Y - 1 + (h % 2), 2, 1);
    ctx.fillStyle = P.weed;
    ctx.fillRect(X - 1, Y, 3, 1);
    ctx.fillRect(X - 4 + (h % 3), Y - 2, 2, 1);
    ctx.fillRect(X + 2 - (h % 2), Y + 2, 2, 1);
  }
  ctx.globalAlpha = 1;
}
function drawDucks(ctx, g, list, df, t) {
  if (!list.length) return;
  const P = palette(df);
  for (let i = 0; i < list.length; i++) {
    const d = list[i],
      X = Math.round(sx(g, d.x, d.y)),
      Y = Math.round(sy(g, d.x, d.y, WATER_Z)),
      f = d.face;
    // the wake: two thin lines fanning out behind a swimming duck
    if (d.go > 0.05 && d.dive < 0.7) {
      ctx.fillStyle = P.wake;
      ctx.globalAlpha = 0.45 * d.go;
      part(ctx, X, Y, f, -9, 0, 3, 1);
      part(ctx, X, Y, f, -12, 1, 2, 1);
      part(ctx, X, Y, f, -9, -1, 2, 1);
    }
    ctx.globalAlpha = 1;
    if (d.dive >= 0.7) {
      // under: only rings where it went down
      ctx.fillStyle = P.wake;
      ctx.globalAlpha = 0.5;
      ring(ctx, X, Y, 2 + ((t * 3 + i) % 3 | 0));
      ctx.globalAlpha = 1;
      continue;
    }
    if (d.dive >= 0.3) {
      // bottom up: the tail and the orange feet, a ring round them
      ctx.fillStyle = P.feather;
      part(ctx, X, Y, f, -2, -3, 3, 3);
      ctx.fillStyle = P.beak;
      part(ctx, X, Y, f, -2, -4, 1, 1);
      part(ctx, X, Y, f, 0, -4, 1, 1);
      ctx.fillStyle = P.wake;
      ctx.globalAlpha = 0.5;
      ring(ctx, X, Y, 4);
      ctx.globalAlpha = 1;
      continue;
    }
    const sink = d.dive > 0.1 ? 1 : 0,
      y = Y + sink;
    // the island's outline round the duck first (its shape pushed a pixel each way), so it reads on bright water
    ctx.fillStyle = P.line;
    duckShape(ctx, X - 1, y, f, d.asleep);
    duckShape(ctx, X + 1, y, f, d.asleep);
    duckShape(ctx, X, y - 1, f, d.asleep);
    ctx.fillStyle = P.feather;
    duckShape(ctx, X, y, f, d.asleep);
    ctx.fillStyle = P.shade;
    part(ctx, X, y, f, -5, -1, 9, 1);
    part(ctx, X, y, f, -3, -3, 4, 1); // the folded wing
    ctx.fillStyle = P.beak;
    if (d.asleep) part(ctx, X, y, f, 2, -4, 1, 1);
    else {
      part(ctx, X, y, f, 5, -6, 2, 1);
      ctx.fillStyle = P.eye;
      part(ctx, X, y, f, 3, -7, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
// The lantern's warm light on the water in front of the pillar: a few wavering dashes (drawn with the lake, under the
// pavilion).
function drawLanternWater(ctx, g, island, glow, t) {
  const l = pavilionLantern(island);
  if (glow <= 0.01 || !l) return;
  const X = Math.round(sx(g, l.x, l.y)),
    Y = Math.round(sy(g, l.x, l.y, WATER_Z)) - 4;
  ctx.fillStyle = '#ffd37a';
  for (let i = 0; i < 3; i++) {
    const w = 5 - i,
      wob = Math.round(Math.sin(t * 0.8 + i * 1.7));
    ctx.globalAlpha = glow * (0.4 - i * 0.1);
    ctx.fillRect(X - (w >> 1) + wob, Y + 8 + i * 3, w, 1);
  }
  ctx.globalAlpha = 1;
}
// The lantern itself and its halo at `at` ({x, y} in tiles, z px above the lawn; pavilionLantern in island-art.js).
// halo is a soft sprite (40 x 40).
function drawLanternLight(ctx, g, at, glow, halo) {
  if (glow <= 0.01) return;
  const X = sx(g, at.x, at.y),
    Y = sy(g, at.x, at.y, at.z);
  ctx.globalAlpha = glow;
  ctx.drawImage(halo, X - 20, Y - 20);
  ctx.fillStyle = '#ffe7a3';
  ctx.fillRect(Math.round(X) - 1, Math.round(Y) - 1, 2, 3);
  ctx.globalAlpha = 1;
}

export const IslandLakeLife = {
  ducks,
  fish,
  weed,
  reset,
  drawFish,
  drawWeed,
  drawDucks,
  drawLanternWater,
  drawLanternLight,
};
