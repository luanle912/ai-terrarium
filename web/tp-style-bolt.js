// bolt: build up on the spot, super-speed run along the route in a yellow streak, skid onto a scorch mark.
// The runner and the sparks round it ride the route at its depth; the long streak lies flat on the floor (an end's
// floor item, so furniture covers it), its stretch across the lounge rug is the rug item just over it, and the skid
// leaves a scorch that fades as a lasting mark.
import { Kit } from './tp-kit.js';
import { TpPerson } from './tp-person.js';
import { outdoors } from './office-scene.js';

const { atlas, bake, clamp, r, out2, in2, lerp, line, frac } = Kit;
const DEP = 0.42,
  ARR = 0.54,
  REL = 0.92,
  ARRS = REL - ARR,
  LAUNCH = 0.37, // core: the lunge off the spot
  SKT = 0.8, // tiles of skid at the landing
  SKQ = 0.32, // arrival fraction the skid takes
  TT = 6, // tiles of streak behind the runner (3 in a crowd)
  STEP = 0.42, // tiles between the streak's zigzag points
  YEL = '#ffd23a',
  WHITE = '#fffbe0',
  ORANGE = '#b5520a',
  EMBER = '#ff8a1a',
  PAPER = ['#fbfbf6', '#9aa0aa'],
  LEAF = ['#7cc35a', '#3f7a32'],
  DUST = '#d8c6a4',
  GRASS = '#c9c09a',
  SNOWY = '#f2f6fb',
  SMOKE = ['rgba(120,120,124,0.75)', 'rgba(205,205,210,0.75)'],
  GW = 44,
  GH = 22,
  GPAL = [null, 'rgba(255,226,90,0.16)', 'rgba(255,226,90,0.3)', 'rgba(255,236,140,0.45)'];

// A soft pixel glow on the floor, three dithered rings, baked once.
export function glowPixels() {
  const px = new Uint8Array(GW * GH),
    rx = GW / 2 - 0.5,
    ry = GH / 2 - 0.5;
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const e = ((x - rx) / (rx + 0.5)) ** 2 + ((y - ry) / (ry + 0.5)) ** 2,
        dith = (x + y) & 1;
      px[y * GW + x] = e < 0.2 + 0.06 * dith ? 3 : e < 0.5 + 0.08 * dith ? 2 : e < 1 - 0.12 * dith ? 1 : 0;
    }
  return px;
}
let sheet = null;
const glowImg = () => sheet || (sheet = atlas(GW, GH, g => bake(g, glowPixels(), GW, GH, 0, c => GPAL[c])));
function glow(X, px, py, a) {
  if (a <= 0.01) return;
  X.ctx.globalAlpha = Math.min(1, a);
  X.stamp(glowImg(), 0, 0, GW, GH, px - GW / 2, py - GH / 2, GW, GH);
  X.ctx.globalAlpha = 1;
}

// [start, tiles along the route from its first seen point, whether it crosses the lounge rug], cached per route array.
const LENS = new WeakMap();
function seen(X) {
  const pts = X.tp && X.tp.route;
  if (!pts) return null;
  let c = LENS.get(pts);
  if (c && c[0] === X.start) return c;
  let n = 0,
    rug = false;
  for (let k = X.start + 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1],
      [bx, by] = pts[k],
      h = Math.hypot(bx - ax, by - ay),
      m = Math.max(1, Math.ceil(h / 0.1));
    for (let j = 0; j <= m && !rug; j++) rug = Kit.onRug(lerp(ax, bx, j / m), lerp(ay, by, j / m), 0);
    n += h;
  }
  LENS.set(pts, (c = [X.start, n, rug]));
  return c;
}
function seenLen(X) {
  const c = seen(X);
  return c ? c[1] : Math.hypot(X.tx1 - X.tx0, X.ty1 - X.ty0);
}
const crossesRug = X => {
  const c = seen(X);
  return !!c && c[2];
};
// The route fraction where the run ends and the skid begins.
const skidFrom = len => (len > 3 * SKT ? 1 - SKT / len : 0.7);
// The runner's route fraction at trip fraction p: a hard start, then flat out.
const headAt = (p, len) => skidFrom(len) * (p < 0.1 ? 5 * p * p : p - 0.05) * (1 / 0.95);
const arrQ = v => r(v, ARR, REL);

// Pixel runs of a polyline (x, y, w, tier), so a line costs one rect per run, not per pixel.
const RUN = new Int16Array(4 * 400);
let nRun = 0,
  rx = 0,
  ry = 0,
  rw = 0,
  rt = 0;
function flush() {
  if (rw && nRun < 400) {
    const k = 4 * nRun++;
    RUN[k] = rx;
    RUN[k + 1] = ry;
    RUN[k + 2] = rw;
    RUN[k + 3] = rt;
  }
  rw = 0;
}
const put = (x, y) => {
  if (rw && y === ry && x === rx + rw) rw++;
  else if (rw && y === ry && x === rx - 1) rx--, rw++;
  else {
    flush();
    rx = x;
    ry = y;
    rw = 1;
  }
};
function seg(x0, y0, x1, y1, tier) {
  rt = tier;
  line(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), put);
  flush();
}
// One fill of every run with tier >= t, as rect (x + dx, y + dy, w + dw, h).
function runs(ctx, col, t, dx, dy, dw, h, only) {
  let any = false;
  for (let k = 0; k < nRun; k++) {
    const tier = RUN[4 * k + 3];
    if (tier < t || (only && tier !== t)) continue;
    if (!any) ctx.beginPath();
    any = true;
    ctx.rect(RUN[4 * k] + dx, RUN[4 * k + 1] + dy, RUN[4 * k + 2] + dw, h);
  }
  if (!any) return;
  ctx.fillStyle = col;
  ctx.fill();
}

const Q = [0, 0, 0, 0, false],
  Q2 = [0, 0, 0, 0, false],
  HD = [0, 0, 0, 0, false];
const flick = X => Math.floor(X.t * 20) + Math.floor(X.L.v * 90);
// The streak on the floor: a zigzag bolt from tail to head (tiles along the route), brightest at the head; mode 0
// draws it off the rug, 1 on it, 2 all of it.
function streak(X, tail, head, len, a, mode) {
  if (head - tail < 0.05 || a <= 0.01) return;
  const fk = flick(X),
    zig = d => (d >= head - 1e-6 ? 0 : Math.round((X.hash(Math.round(d / STEP), fk % 32) - 0.5) * 6)),
    tierOf = d => (head - d < 1.6 ? 3 : head - d < 3.6 ? 2 : 1);
  nRun = 0;
  X.route(tail / len, Q);
  let px = Q[0],
    py = Q[1] + zig(tail),
    pOn = Kit.onRug(Q[2], Q[3], 0);
  for (let j = Math.floor(tail / STEP) + 1; ; j++) {
    const d = Math.min(head, j * STEP);
    X.route(d / len, Q);
    const nx = Q[0],
      ny = Q[1] + zig(d),
      on = Kit.onRug(Q[2], Q[3], 0);
    // A segment touching the rug is the rug's, so none of it hides under the rug's edge.
    if (mode === 2 || (on || pOn) === (mode === 1)) seg(px, py, nx, ny, tierOf(d));
    px = nx;
    py = ny;
    pOn = on;
    if (d >= head) break;
  }
  if (!nRun) return;
  const ctx = X.ctx;
  ctx.globalAlpha = a;
  runs(ctx, 'rgba(200,96,16,0.55)', 1, 0, 0, 0, 2, true);
  runs(ctx, ORANGE, 2, -1, -1, 2, 4);
  runs(ctx, YEL, 2, 0, 0, 0, 2);
  runs(ctx, WHITE, 3, 0, 0, 0, 1);
  ctx.globalAlpha = 1;
}
// Little zigzag sparks crackling round a body standing at (cx, cy): an orange shadow, yellow, a white tip.
function crackle(X, cx, cy, n, spread, salt, a) {
  if (n <= 0 || a <= 0.01) return;
  const fk = flick(X);
  nRun = 0;
  for (let k = 0; k < n; k++) {
    const h = j => X.hash(k * 7 + j, salt + (fk % 16)),
      s = (k + fk) % 2 ? -1 : 1,
      // beside the body, never across the chest
      sx = cx + s * (5 + h(1) * Math.max(1, spread - 5)),
      sy = cy - 2 - h(2) * 20;
    let x = sx,
      y = sy;
    for (let j = 0; j < 3; j++) {
      const nx = x + s * (j % 2 ? -2 : 3),
        ny = y + (h(4 + j) < 0.5 ? 2 : -2) - (j === 1 ? 1 : 0);
      seg(x, y, nx, ny, j === 0 ? 3 : 2);
      x = nx;
      y = ny;
    }
  }
  const ctx = X.ctx;
  ctx.globalAlpha = a;
  runs(ctx, ORANGE, 2, 0, 1, 0, 1);
  runs(ctx, YEL, 2, 0, 0, 0, 1);
  runs(ctx, WHITE, 3, 0, 0, 0, 1, true);
  ctx.globalAlpha = 1;
}
// A round-ish pixel puff of radius s.
const blob = (ctx, x, y, s) => {
  ctx.rect(x - s, y - s + 1, 2 * s, 2 * s - 2);
  ctx.rect(x - s + 1, y - s, 2 * s - 2, 2 * s);
};
const dustOf = (X, tx, ty) => (outdoors(tx, ty) ? (X.snow > 0 ? SNOWY : GRASS) : DUST);
// A sheet of paper (a leaf outdoors) tumbling: frame f turns it edge-on and back.
const SHEETS = [
  [4, 3],
  [3, 4],
  [4, 2],
  [2, 4],
];
function papers(X, list, n, cols) {
  const ctx = X.ctx;
  for (let c = 0; c < 2; c++) {
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const [x, y, f] = list[k],
        [w, h] = SHEETS[f & 3];
      if (c) ctx.rect(x, y + h, w, 1);
      else ctx.rect(x, y, w, h);
    }
    ctx.fillStyle = cols[c];
    ctx.fill();
  }
}
const PL = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

// Departure: get set, run on the spot as the sparks build, lunge off.
function depBody(X) {
  const v = X.L.v,
    p = v / DEP,
    tp = X.tp,
    front = X.dir0[1] >= 0;
  if (tp.stool && p < 0.1) {
    X.bodyAt(X.x0, X.y0, { pose: tp.stool === 2 ? 'sitHigh' : 'sit', front: X.a.dirFront });
    return;
  }
  const set = r(p, 0.1, 0.2) * (1 - r(p, 0.24, 0.3)),
    run = p >= 0.27,
    go = r(v, LAUNCH, DEP),
    bob = run && go === 0 ? Math.floor(v * 70) % 2 : 0,
    jx = run && go === 0 ? (Math.floor(v * 110) % 2 ? 1 : -1) * (p > 0.6 ? 1 : 0) : 0,
    push = 8 * in2(go);
  X.bodyAt(X.x0 + jx + Math.round(X.dir0[0] * push), X.y0 + Math.round(X.dir0[1] * push), {
    pose: run ? 'walk' : 'stand',
    front,
    legs: 1 - 0.4 * set,
    lift: bob,
    sx: 1 - 0.25 * go,
  });
}
// Arrival: slide in from where the run ended, crouched, then straighten and turn to face the room.
function arrBody(X) {
  const q = arrQ(X.L.v),
    s = out2(r(q, 0, SKQ));
  X.route(skidFrom(seenLen(X)), Q);
  X.bodyAt(Math.round(lerp(Q[0], X.x1, s)), Math.round(lerp(Q[1], X.y1, s)), {
    pose: 'stand',
    front: q > 0.55 || X.dir1[1] >= 0,
    legs: q < SKQ ? 0.7 : lerp(0.7, 1, r(q, SKQ, SKQ + 0.12)),
  });
}
// The run: two afterimages behind, the body, sparks beside it, papers kicked up where it has been.
let CAPT = null;
function runner(X) {
  const L = X.L,
    len = seenLen(X),
    ph = headAt(L.trip, len),
    ctx = X.ctx,
    hide = L.hide ? r(L.trip, 0, 0.08) : 1;
  X.route(ph, HD);
  const hx = HD[0],
    hy = HD[1],
    front = HD[4];
  if (!X.lite && len > 0) {
    // afterimages in the person's own colours, one fill per colour each
    const c = X.capture({ pose: 'walk', front, at: [hx, hy] }, CAPT || (CAPT = TpPerson.newCapture()));
    for (let g = 2; g >= 1; g--) {
      X.route(Math.max(0, ph - (g * 0.6) / len), Q2);
      const ox = Q2[0] - hx,
        oy = Q2[1] - hy;
      ctx.globalAlpha = (g === 1 ? 0.45 : 0.2) * hide * L.C;
      Kit.shards(ctx, c, c.n, (k, o) => {
        o[0] = ox;
        o[1] = oy;
      });
    }
    ctx.globalAlpha = 1;
  }
  X.bodyAt(hx, hy, { pose: 'walk', front, alpha: hide });
  crackle(X, hx, hy, X.lite ? 1 : 2, 6, 31, hide);
  kicked(X, ph * len, len);
  if (L.hide && L.trip < 0.15) crackle(X, hx, hy, 3, 10, 47, 1 - r(L.trip, 0.05, 0.15));
}
// Papers (leaves outdoors) lifted at fixed points of the route as the runner passes, tumbling down over 2.4 tiles.
function kicked(X, head, len) {
  let n = 0,
    tx = 0,
    ty = 0;
  const every = 1.7,
    max = X.lite ? 1 : 4;
  for (let j = Math.floor(head / every); j >= 1 && n < max; j--) {
    const d = j * every - 0.8 * X.hash(j, 5),
      age = (head - d) / 2.6;
    if (age < 0 || d < 0.5) continue;
    if (age >= 1) break;
    X.route(d / len, Q);
    for (let m = 0; m < 2 && n < max; m++) {
      const side = (X.hash(j, 6 + m) < 0.5 ? -1 : 1) * (m ? -1 : 1),
        e = PL[n++],
        up = 10 + 10 * X.hash(j, 8 + m);
      e[0] = Math.round(Q[0] + side * (3 + (8 + 4 * m) * age));
      e[1] = Math.round(Q[1] - 3 - up * Math.sin(Math.PI * Math.min(1, age * 1.25)) + 4 * age);
      e[2] = Math.floor(age * 9 + j + 2 * m);
    }
    if (n <= 2) [tx, ty] = [Q[2], Q[3]];
  }
  if (n) papers(X, PL, n, outdoors(tx, ty) ? LEAF : PAPER);
}
// Puffs kicked out behind the feet while running on the spot, and the burst as the runner lunges off.
function originFx(X) {
  const v = X.L.v,
    p = v / DEP,
    ctx = X.ctx,
    C = X.L.C,
    charge = r(p, 0.2, 0.85) * (1 - r(v, DEP + 0.02, DEP + 0.06));
  if (v < DEP) crackle(X, X.x0, X.y0, X.lite ? 1 : Math.round(1 + 3 * charge), 7 + 3 * charge, 13, charge * C);
  const dust = dustOf(X, X.tx0, X.ty0);
  if (p >= 0.27 && v < LAUNCH) {
    ctx.globalAlpha = 0.75 * C;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const q = frac(v * 11 + k / 3),
        side = (k - 1) * 3;
      blob(
        ctx,
        Math.round(X.x0 - X.dir0[0] * (3 + 9 * q) + side),
        Math.round(X.y0 - X.dir0[1] * (3 + 9 * q) - 1 - 3 * q),
        q < 0.3 ? 1 : 2,
      );
    }
    ctx.fillStyle = dust;
    ctx.fill();
  }
  const s = r(v, LAUNCH, DEP + 0.08);
  if (s > 0 && s < 1) {
    ctx.globalAlpha = 0.85 * (1 - s) * C;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * 2 * Math.PI + 0.3,
        d = 4 + 14 * out2(s);
      // the far side of the ring would sit on the body
      if (Math.sin(ang) < 0 && Math.abs(d * Math.cos(ang)) < 8) continue;
      blob(ctx, Math.round(X.x0 + d * Math.cos(ang)), Math.round(X.y0 + 0.5 * d * Math.sin(ang) - 2), s < 0.4 ? 2 : 3);
    }
    ctx.fillStyle = dust;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (X.dir0[1] >= 0) launchFlash(X, flashAt(v));
}
const flashAt = v => r(v, LAUNCH + 0.02, DEP + 0.05);
// The lunge: a jagged bolt shooting off the spot the way the run goes.
function launchFlash(X, s) {
  if (s <= 0 || s >= 1) return;
  const [dx, dy] = X.dir0,
    reach = 8 + 30 * out2(s),
    back = 8 + 30 * in2(s),
    fk = flick(X);
  nRun = 0;
  let px = X.x0 + dx * back,
    py = X.y0 + dy * back - 3;
  for (let j = 1; j <= 4; j++) {
    const d = back + ((reach - back) * j) / 4,
      nx = X.x0 + dx * d,
      ny = X.y0 + dy * d - 3 + (j < 4 ? (j % 2 ? 1 : -1) * Math.round(2 + 2 * X.hash(j, fk % 16)) : 0);
    seg(px, py, nx, ny, 3);
    px = nx;
    py = ny;
  }
  const ctx = X.ctx;
  ctx.globalAlpha = X.L.C;
  runs(ctx, ORANGE, 3, -1, -1, 2, 3);
  runs(ctx, YEL, 3, 0, -1, 0, 2);
  runs(ctx, WHITE, 3, 0, 0, 0, 1);
  ctx.globalAlpha = 1;
}
// The skid: sparks and dust sprayed ahead of the feet. Then the shoes smoke, and the desk's papers flutter up.
function landingFx(X) {
  const v = X.L.v,
    q = arrQ(v),
    ctx = X.ctx,
    fx = X.x1,
    fy = X.y1,
    [dx, dy] = X.dir1;
  if (q < SKQ + 0.08 && v >= ARR) {
    X.route(skidFrom(seenLen(X)), Q);
    const s = out2(r(q, 0, SKQ)),
      px = Math.round(lerp(Q[0], fx, s)),
      py = Math.round(lerp(Q[1], fy, s)),
      a = 1 - r(q, SKQ - 0.06, SKQ + 0.08);
    ctx.globalAlpha = 0.8 * a;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const t = frac(q * 5 + k / 4),
        side = (k % 2 ? 1 : -1) * (2 + 4 * t);
      blob(
        ctx,
        Math.round(px + dx * (5 + 7 * t) - dy * side),
        Math.round(py + dy * (5 + 7 * t) + dx * side * 0.5 - 2 * t),
        1 + (t > 0.4),
      );
    }
    ctx.fillStyle = dustOf(X, X.tx1, X.ty1);
    ctx.fill();
    for (let c = 0; c < 2; c++) {
      ctx.beginPath();
      for (let k = c; k < 8; k += 2) {
        const t = frac(q * 6 + X.hash(k, 3)),
          ang = Math.atan2(dy, dx) + (X.hash(k, 4) - 0.5) * 1.6,
          d = 3 + 12 * t;
        ctx.rect(
          Math.round(px + d * Math.cos(ang)),
          Math.round(py + 0.6 * d * Math.sin(ang) - 6 * t * (1 - t) * 4),
          1,
          1,
        );
      }
      ctx.fillStyle = c ? EMBER : YEL;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  smoke(X, fx, fy, v);
  if (!X.lite) deskPapers(X, v);
  if (q < 0.5) crackle(X, fx, fy, 1, 5, 71, 1 - r(q, 0.2, 0.5));
}
// Wisps off both shoes, thinning out by the end.
function smoke(X, fx, fy, v) {
  const amt = r(v, ARR + 0.06, ARR + 0.14) * (1 - r(v, 1.05, 1.33));
  if (amt <= 0) return;
  const ctx = X.ctx;
  for (let c = 0; c < 2; c++) {
    ctx.globalAlpha = amt * (c ? 0.8 : 0.9);
    ctx.beginPath();
    for (let k = c; k < (X.lite ? 2 : 4); k += 2) {
      const t = frac(v * 2.6 + k / 4),
        foot = k % 2 ? 2 : -3;
      blob(ctx, Math.round(fx + foot + 3 * t * Math.sin(t * 5 + k)), Math.round(fy - 1 - 9 * t), t < 0.5 ? 1 : 2);
    }
    ctx.fillStyle = SMOKE[c];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
const DK = [0, 0, 0];
// The gust off the run lifts a few sheets from the landing desk; they flutter and settle.
function deskPapers(X, v) {
  const t0 = ARR + 0.02;
  if (v < t0 || v > t0 + 0.75) return;
  X.desk(DK);
  let n = 0;
  for (let k = 0; k < 3; k++) {
    const t = r(v, t0 + 0.04 * k, t0 + 0.04 * k + 0.6);
    if (t <= 0 || t >= 1) continue;
    const side = k === 1 ? -1 : 1,
      e = PL[n++];
    // off the desk top, blown on the way the run was going and down past the desk's side, clear of the screen
    e[0] = Math.round(DK[0] + side * (6 + 6 * k) + X.dir1[0] * 22 * t + 2 * Math.sin(t * 9 + k));
    e[1] = Math.round(DK[1] + 9 + X.dir1[1] * 9 * t - 6 * Math.sin(Math.PI * Math.min(1, t * 1.5)) + 16 * in2(t));
    e[2] = Math.floor(t * 10 + k);
  }
  if (!n) return;
  X.ctx.globalAlpha = 1 - r(v, t0 + 0.6, t0 + 0.75);
  papers(X, PL, n, PAPER);
  X.ctx.globalAlpha = 1;
}
// Which end's floor item carries the long streak: one flat on the plain floor (not the rug, not the plinth's lawn).
function trailEnd(X) {
  const plain = (x, y) => !Kit.plinth(x, y) && !Kit.onRug(x, y);
  if (plain(X.tx1, X.ty1)) return 1;
  return !X.L.hide && plain(X.tx0, X.ty0) ? 0 : -1;
}
function trail(X, mode = 0) {
  const L = X.L,
    len = seenLen(X),
    tt = X.lite ? TT / 2 : TT;
  if (len <= 0) return;
  if (L.trip >= 0) {
    const head = headAt(L.trip, len) * len;
    streak(X, Math.max(0, head - tt), head, len, L.hide ? r(L.trip, 0, 0.08) : 1, mode);
    return;
  }
  const q = arrQ(L.v),
    from = skidFrom(len) * len,
    head = lerp(from, len, out2(r(q, 0, SKQ)));
  streak(X, lerp(Math.max(0, from - tt), head, out2(r(q, 0, 0.45))), head, len, 1 - r(q, 0.25, 0.5), mode);
}
const nightK = X => (X.night ? 1 : 0.45);

// The scorch the skid leaves: a burnt track, a dark patch under the feet, embers cooling.
function scorch(X, m, age) {
  const fade = 1 - r(age, 1.6, 3),
    grow = clamp(age / 0.16),
    [dx, dy] = m.dir,
    fx = X.x0,
    fy = X.y0,
    len = 15,
    sx = fx - dx * len,
    sy = fy - dy * len,
    ex = lerp(sx, fx, grow),
    ey = lerp(sy, fy, grow),
    ctx = X.ctx,
    wet = X.snow > 0 && outdoors(m.x, m.y);
  if (fade <= 0) return;
  nRun = 0;
  seg(sx, sy, ex, ey, 2);
  ctx.globalAlpha = fade;
  runs(ctx, wet ? 'rgba(70,84,110,0.5)' : 'rgba(48,30,14,0.5)', 2, -1, -1, 2, 4);
  runs(ctx, wet ? 'rgba(52,62,84,0.85)' : 'rgba(30,18,8,0.85)', 2, 0, 0, 0, 2);
  if (grow >= 1) {
    ctx.beginPath();
    ctx.rect(fx - 7, fy - 1, 14, 3);
    ctx.rect(fx - 5, fy - 2, 10, 5);
    ctx.fillStyle = wet ? 'rgba(70,84,110,0.45)' : 'rgba(48,30,14,0.45)';
    ctx.fill();
  }
  const hot = 1 - r(age, 0.3, X.night ? 2.2 : 1.4);
  if (hot > 0) {
    ctx.globalAlpha = hot;
    for (let c = 0; c < 2; c++) {
      ctx.beginPath();
      for (let k = c; k < 6; k += 2) {
        const t = (k + 0.5) / 6;
        if (t > grow) continue;
        const on = X.hash(k, 9 + Math.floor(age * 8)) < 0.7;
        if (on) ctx.rect(Math.round(lerp(sx, fx, t)), Math.round(lerp(sy, fy, t)) + (k % 2) - 1, 1 + (k % 3 === 0), 1);
      }
      ctx.fillStyle = c ? YEL : EMBER;
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v,
      te = trailEnd(X);
    if (L.q) return 4;
    let n = 0;
    if (v < DEP) n |= 4 | 16;
    if (v >= LAUNCH && v < DEP + 0.09) n |= 16 | 1;
    const skid = v >= ARR && v < ARR + 0.5 * ARRS;
    if (L.trip >= 0 || (te < 0 && skid)) n |= 64;
    if (te >= 0 && (L.trip >= 0 || skid)) {
      n |= te ? 8 : 4;
      if (crossesRug(X)) n |= Kit.PART.RUG;
    }
    if (v >= ARR) n |= 8 | 32;
    return n;
  },
  floor(X, end) {
    const L = X.L,
      v = L.v;
    if (L.q) {
      // queued: a faint static fizz at the feet
      if (end) return;
      X.ctx.globalAlpha = 0.6;
      X.ctx.beginPath();
      for (let k = 0; k < 3; k++)
        if (X.hash(k, flick(X) % 8) < 0.6) X.ctx.rect(X.x0 - 5 + 4 * k, X.y0 - (k % 2), 1 + (k === 1), 1);
      X.ctx.fillStyle = YEL;
      X.ctx.fill();
      X.ctx.globalAlpha = 1;
      return;
    }
    if (end === trailEnd(X) && (L.trip >= 0 || v >= ARR)) trail(X);
    if (!end && v < DEP + 0.04)
      glow(X, X.x0, X.y0, r(v / DEP, 0.2, 0.85) * (1 - r(v, DEP, DEP + 0.04)) * nightK(X) * L.C);
    if (L.trip >= 0 && X.night) {
      X.route(headAt(L.trip, seenLen(X)), Q);
      if (end === trailEnd(X)) glow(X, Q[0], Q[1], 0.9);
    }
    if (end && v >= ARR) glow(X, X.x1, X.y1, (1 - r(arrQ(v), 0.1, 0.5)) * nightK(X));
  },
  // A run away from the camera starts behind the person.
  back(X, end) {
    if (!end && X.dir0[1] < 0) launchFlash(X, flashAt(X.L.v));
  },
  stand(X, end) {
    if (end) landingFx(X);
    else originFx(X);
  },
  // The runner; the whole streak too, into the skid, when neither end has a plain floor item to carry it.
  trip(X) {
    if (trailEnd(X) < 0) trail(X, 2);
    if (X.L.trip >= 0) runner(X);
  },
  // The streak's stretch over the rug, which lies over the floor item.
  rug(X) {
    trail(X, 1);
  },
  // One body pass a frame: at the spot before the run, from trip() during it, sliding in at the landing after.
  person(X) {
    const L = X.L;
    if (L.q || L.v >= REL) return false;
    if (L.hide && !L.sw) return true;
    if (L.trip >= 0 && L.trip < 1) return true;
    if (!L.sw) depBody(X);
    else arrBody(X);
    return true;
  },
  marks: [{ at: 'arr', end: 1, ttl: 3, layer: 'floor' }],
  drawMark(X, m, age) {
    scorch(X, m, age);
  },
  gap: null,
};
// Exposed for tests.
export const BOLT = { headAt, skidFrom, trailEnd, trail, seenLen, LAUNCH, SKT, SKQ, TT };
