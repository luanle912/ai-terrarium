// gitbranch: a commit node blooms under the person and tags them with a short hash; they squash down into a commit
// dot, a green branch line draws itself along the floor route ahead of it with commit nodes popping up, and the dot
// hops node to node, filling each one; at the landing a blue main line is waiting, the dot lands on the merge node,
// MERGE pops up and the person grows back out of it. Then the branch is deleted from its tail and everything fades.
// The line and nodes lie flat on the floor (an end's floor item), so furniture covers them; their stretch across the
// lounge rug is the rug item, just over it. The dot rides the trip item at its route point.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { PA } from './office-scene.js';

const { clamp, r, out2, ease, lerp, frac } = Kit;
const DEP = 0.42,
  ARR = 0.54,
  REL = 0.92,
  L_IN = 0.28,
  BLOOM = 0.02, // core: the start node blooms
  SQ0 = 0.12, // core: the squash down into the dot starts
  SQ1 = 0.3, // and ends
  DOT = 0.28, // core: the dot shows over the start node
  SPROUT = 0.32, // core: the branch line starts drawing
  HEAD = 0.55, // trip fraction where the drawn line reaches the landing
  MAIN0 = 0.35, // trip fractions: the main line draws in through the landing
  MAIN1 = 0.75,
  GAP = 2.6, // tiles between commit nodes
  TAIL = 1.8, // tiles of lit line behind the dot
  HOP = 4, // px the dot hops between nodes
  // arrival fractions
  GROW0 = 0.06,
  GROW1 = 0.4,
  TINT1 = 0.26, // lime until here, then a white beat, then the person's own colours
  WHITE1 = 0.32,
  CHIP = 0.16; // MERGE pops up
// Palettes, day and night: keyline, branch, lit branch, node centre, main line, main keyline.
const PAL = [
  { key: '#0d3319', br: '#3fd062', lit: '#c4ffd0', hole: '#0d3319', main: '#4f9dff', mkey: '#0c2347' },
  { key: '#04140a', br: '#5cf07e', lit: '#e2ffe8', hole: '#062010', main: '#6cb0ff', mkey: '#06142c' },
];
const WHITE = '#ffffff',
  LIME = '#a6ff9e',
  MERGE = '#b48cff', // the merge node and its chip
  MERGE_DK = '#24123f',
  CHIP_DK = '#0b2414',
  GLOW = 'rgba(110,255,140,0.22)',
  SHADE = 'rgba(0,0,0,0.3)',
  HEX = '0123456789ABCDEF';

// Pixels queued as rects with a colour, then one fill per colour (in first-use order, so outlines go under).
const NB = 480,
  B = { n: 0, x: new Int16Array(NB), y: new Int16Array(NB), w: new Int16Array(NB), h: new Int16Array(NB) },
  BC = new Uint8Array(NB),
  BCOL = [];
function add(x, y, w, h, col) {
  if (B.n >= NB || w <= 0 || h <= 0) return;
  let ci = BCOL.indexOf(col);
  if (ci < 0) ci = BCOL.push(col) - 1;
  const k = B.n++;
  B.x[k] = Math.round(x);
  B.y[k] = Math.round(y);
  B.w[k] = w;
  B.h[k] = h;
  BC[k] = ci;
}
function flush(ctx, alpha) {
  if (B.n && alpha > 0.01) {
    ctx.globalAlpha = Math.min(1, alpha);
    for (let c = 0; c < BCOL.length; c++) {
      ctx.beginPath();
      for (let k = 0; k < B.n; k++) if (BC[k] === c) ctx.rect(B.x[k], B.y[k], B.w[k], B.h[k]);
      ctx.fillStyle = BCOL[c];
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  B.n = 0;
  BCOL.length = 0;
}
// Row runs [dx, dy, w] of a filled ellipse with half axes a, b px, cached by size.
const ROWS = new Map();
function rows(a, b) {
  const key = a * 64 + b;
  let o = ROWS.get(key);
  if (o) return o;
  o = [];
  for (let y = -b; y <= b; y++) {
    const hw = Math.floor(a * Math.sqrt(Math.max(0, 1 - (y / (b + 0.5)) ** 2)) + 0.25);
    o.push(-hw, y, 2 * hw + 1);
  }
  ROWS.set(key, o);
  return o;
}
function blob(cx, cy, a, b, col) {
  if (a < 0 || b < 0) return;
  const o = rows(a, b);
  for (let k = 0; k < o.length; k += 3) add(cx + o[k], cy + o[k + 1], o[k + 2], 1, col);
}
// A 1 px ellipse outline (bursts).
function ring(cx, cy, a, b, col) {
  Kit.ellipse(a, b, (x, y) => add(cx + x, cy + y, 1, 1, col));
}

// The seen route as screen points with tile lengths, collinear points merged, and the [from, to] tile distances
// over the lounge rug; cached per route array.
const LINES = new WeakMap(),
  RUG_STEP = 0.1; // tiles between rug samples
function lineOf(X) {
  const pts = X.tp && X.tp.route;
  if (!pts || pts.length - X.start < 2) return null;
  let c = LINES.get(pts);
  if (c && c.start === X.start) return c;
  c = { start: X.start, sx: [], sy: [], cum: [], total: 0, rug: [] };
  let px = 0,
    py = 0,
    open = -1;
  for (let k = X.start; k < pts.length; k++) {
    const [tx, ty] = pts[k],
      s = PA(tx, ty),
      n = c.sx.length;
    if (n) {
      const h = Math.hypot(tx - px, ty - py),
        m = Math.max(1, Math.ceil(h / RUG_STEP));
      for (let j = n > 1 ? 1 : 0; j <= m; j++) {
        const on = Kit.onRug(lerp(px, tx, j / m), lerp(py, ty, j / m), 0),
          d = c.total + (h * j) / m;
        if (on && open < 0) open = d;
        else if (!on && open >= 0) {
          c.rug.push([open, d]);
          open = -1;
        }
      }
      c.total += h;
    }
    px = tx;
    py = ty;
    // drop the middle of three collinear points
    if (n >= 2) {
      const ax = c.sx[n - 1] - c.sx[n - 2],
        ay = c.sy[n - 1] - c.sy[n - 2],
        bx = s[0] - c.sx[n - 1],
        by = s[1] - c.sy[n - 1];
      if (Math.abs(ax * by - ay * bx) < 1e-6 && ax * bx + ay * by >= 0) {
        c.sx.pop();
        c.sy.pop();
        c.cum.pop();
      }
    }
    c.sx.push(Math.round(s[0]));
    c.sy.push(Math.round(s[1]));
    c.cum.push(c.total);
  }
  if (open >= 0) c.rug.push([open, c.total]);
  LINES.set(pts, c);
  return c;
}
// Screen point at tile distance d along the line.
function at(c, d, out) {
  let k = 1;
  while (k < c.cum.length - 1 && c.cum[k] < d) k++;
  const s = c.cum[k] - c.cum[k - 1],
    q = s > 1e-9 ? clamp((d - c.cum[k - 1]) / s) : 1;
  out[0] = Math.round(lerp(c.sx[k - 1], c.sx[k], q));
  out[1] = Math.round(lerp(c.sy[k - 1], c.sy[k], q));
  return out;
}
const P0 = [0, 0],
  P1 = [0, 0];
// The line from tile distance a to b as a subpath.
function path(ctx, c, a, b) {
  at(c, a, P0);
  ctx.moveTo(P0[0], P0[1]);
  for (let k = 1; k < c.cum.length && c.cum[k - 1] < b; k++) {
    if (c.cum[k] <= a) continue;
    if (c.cum[k] < b) ctx.lineTo(c.sx[k], c.sy[k]);
    else {
      at(c, b, P1);
      ctx.lineTo(P1[0], P1[1]);
    }
  }
}
// Where a tile distance lies: on the rug or not.
function rugAt(c, d) {
  for (let k = 0; k < c.rug.length; k++) if (d >= c.rug[k][0] && d < c.rug[k][1]) return true;
  return false;
}
const keep = (out, a, b) => (b - a >= 0.02 && out.push(a, b), out);
// The spans [a0, b0, a1, b1, ...] of a to b drawn by mode: 0 off the rug, 1 on it, 2 all of it.
function pieces(c, a, b, mode, out) {
  out.length = 0;
  if (mode === 2) return keep(out, a, b);
  let x = a;
  for (let k = 0; k < c.rug.length; k++) {
    const [ra, rb] = c.rug[k];
    if (mode === 1) keep(out, Math.max(a, ra), Math.min(b, rb));
    else {
      keep(out, x, Math.min(b, ra));
      x = Math.max(x, rb);
    }
  }
  return mode ? out : keep(out, x, b);
}
const PC = [];
// One stroke over every piece of a to b.
function stroke(ctx, c, a, b, w, col, alpha, mode) {
  if (alpha <= 0.01 || !pieces(c, a, b, mode, PC).length) return;
  ctx.beginPath();
  for (let k = 0; k < PC.length; k += 2) path(ctx, c, PC[k], PC[k + 1]);
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.lineWidth = w;
  ctx.strokeStyle = col;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
}

// Real seconds of the shown clock (a rewind plays the departure backwards).
const secsOf = L => TeleportLogic.real(L.v, L.d);
// The beats in real seconds: [line start, line at the landing, dot leaves, dot lands].
function times(L, out) {
  out[0] = TeleportLogic.real(SPROUT, L.d);
  out[1] = L.d[0] + HEAD * L.d[1];
  out[2] = L.d[0];
  out[3] = L.d[0] + L.d[1];
  return out;
}
const TM = [0, 0, 0, 0];
const nodeGap = (total, lite) => {
  const n = Math.max(2, Math.min(14, Math.round(total / GAP)));
  return (total / n) * (lite ? 2 : 1);
};
// Tile distances: the drawn head, the dot, the erased tail.
function spans(X, c, out) {
  const L = X.L,
    s = secsOf(L);
  times(L, TM);
  out[0] = c.total * clamp((s - TM[0]) / (TM[1] - TM[0]));
  out[1] = L.trip >= 0 ? c.total * L.trip : L.v >= ARR ? c.total : 0;
  out[2] = L.fade >= 0 ? c.total * ease(r(L.fade, 0, 0.7)) : 0;
  out[3] = s;
  return out;
}
const SP = [0, 0, 0, 0];
// A commit node flat on the floor: popping in, hollow until the dot fills it, a white blink as it does.
function node(cx, cy, pop, fill, p) {
  if (pop <= 0) return;
  if (pop < 0.5) {
    blob(cx, cy, 2, 1, p.key);
    add(cx - 1, cy, 3, 1, p.br);
    return;
  }
  blob(cx, cy, 4, 2, p.key);
  blob(cx, cy, 3, 1, fill > 0 && fill < 0.5 ? WHITE : p.br);
  add(cx - 1, cy, 3, 1, fill > 0 ? (fill < 0.5 ? WHITE : p.lit) : p.hole);
}
// The branch line, its nodes and the head's spark: everything flat between the erased tail and the drawn head, off the
// rug, on it or all (mode as pieces()).
function branch(X, mode) {
  const c = lineOf(X),
    L = X.L;
  if (!c || L.v < SPROUT || (L.hide && L.v < L_IN)) return;
  const [head, dot, tail, s] = spans(X, c, SP),
    p = PAL[X.night ? 1 : 0],
    ctx = X.ctx,
    A = L.C * (L.fade >= 0 ? 1 - r(L.fade, 0.6, 1) : 1);
  if (head <= tail || A <= 0.01) return;
  const there = d => mode === 2 || rugAt(c, d) === (mode === 1),
    full = !(X.lite && mode === 1); // in a crowd the rug stretch is a plain line, to stay in the lite budget
  if (full) stroke(ctx, c, tail, head, 4, p.key, A * (X.night ? 0.75 : 0.55), mode);
  stroke(ctx, c, tail, head, 2, p.br, A, mode);
  if (full && L.v < ARR + 0.1 * (REL - ARR))
    stroke(ctx, c, Math.max(tail, dot - TAIL), Math.min(head, dot), 2, p.lit, A, mode);
  times(L, TM);
  const gap = nodeGap(c.total, X.lite);
  for (let d = 0; d < c.total - 0.5 * gap; d += gap) {
    if (d < tail || d > head || !full || !there(d)) continue;
    at(c, d, P0);
    const pop = (s - lerp(TM[0], TM[1], d / c.total)) / 0.08,
      fill = (s - lerp(TM[2], TM[3], d / c.total)) / 0.16;
    node(P0[0], P0[1], pop, fill, p);
  }
  if (head < c.total && head > tail && there(head)) {
    // the spark drawing the line
    at(c, head, P0);
    const blink = Math.floor(s * 30) & 1;
    add(P0[0] - 1, P0[1] - 1, 3, 3, blink ? LIME : p.lit);
    add(P0[0] - 2, P0[1], 5, 1, WHITE);
    add(P0[0], P0[1] - 2, 1, 5, WHITE);
  }
  flush(ctx, A);
}

// A main line along the tile axis across a route step (dx, dy), so the branch leaves or joins it at an angle.
const AX = [0, 0];
function across(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) (AX[0] = 0), (AX[1] = -1);
  else (AX[0] = 1), (AX[1] = 0);
  return AX;
}
function mainAxis(X, end) {
  const pts = X.tp && X.tp.route,
    n = pts ? pts.length : 0;
  if (n - X.start < 2) return across(X.tx1 - X.tx0, X.ty1 - X.ty0);
  const k = end ? n - 2 : X.start;
  return across(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
}
// A main line segment from tile distance a to b along the axis through (tx, ty), keyline under the blue.
function mainSeg(X, tx, ty, ax, ay, a, b, A) {
  const ctx = X.ctx,
    p = PAL[X.night ? 1 : 0],
    s = PA(tx + a * ax, ty + a * ay),
    e = PA(tx + b * ax, ty + b * ay);
  for (let j = 0; j < 2; j++) {
    ctx.beginPath();
    ctx.moveTo(Math.round(s[0]), Math.round(s[1]));
    ctx.lineTo(Math.round(e[0]), Math.round(e[1]));
    ctx.globalAlpha = Math.min(1, A * (j ? 1 : X.night ? 0.75 : 0.55));
    ctx.lineWidth = j ? 2 : 4;
    ctx.strokeStyle = j ? p.main : p.mkey;
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
}
// A commit on main: a small blue node.
function mainNode(X, tx, ty, pop) {
  const m = PA(tx, ty),
    mx = Math.round(m[0]),
    my = Math.round(m[1]),
    p = PAL[X.night ? 1 : 0];
  blob(mx, my, pop < 1 ? 2 : 4, pop < 1 ? 1 : 2, p.mkey);
  blob(mx, my, 3, 1, p.main);
  add(mx - 1, my, 3, 1, WHITE);
}
// The landing: main drawn in during the trip, its parent commit, then the merge node once the dot lands.
function landing(X) {
  const L = X.L,
    s = secsOf(L),
    grow = clamp((s - L.d[0] - MAIN0 * L.d[1]) / ((MAIN1 - MAIN0) * L.d[1])),
    A = L.C * (L.fade >= 0 ? 1 - r(L.fade, 0.45, 0.95) : 1);
  if (grow <= 0 || A <= 0.01) return;
  const [ax, ay] = mainAxis(X, 1);
  mainSeg(X, X.tx1, X.ty1, ax, ay, -1.7, 3.4 * ease(grow) - 1.7, A);
  if (grow > 0.25) mainNode(X, X.tx1 - 1.1 * ax, X.ty1 - 1.1 * ay, (grow - 0.25) / 0.07);
  if (L.v >= ARR) mergeNode(X, r(L.v, ARR, REL));
  flush(X.ctx, A);
}
// The merge node: a white flash as the dot lands, then a lilac ring with the two lines' colours inside; a burst ring.
function mergeNode(X, q) {
  const x = X.x1,
    y = X.y1,
    p = PAL[X.night ? 1 : 0];
  blob(x, y, 6, 3, q < 0.1 ? MERGE : MERGE_DK);
  blob(x, y, 5, 2, q < 0.1 ? WHITE : MERGE);
  if (q >= 0.1) {
    add(x - 3, y, 3, 1, p.br);
    add(x + 1, y, 3, 1, p.main);
    add(x - 1, y - 1, 3, 1, q < 0.16 ? WHITE : MERGE_DK);
  }
  const b = r(q, 0.02, 0.4);
  if (b > 0 && b < 1 && !(X.lite && b > 0.6)) {
    const e = out2(b);
    ring(x, y, Math.round(6 + 12 * e), Math.round(3 + 6 * e), b < 0.5 ? WHITE : MERGE);
  }
}
// The origin: main grows out both ways from the start node (the branch forks off it), a bloom ring; main fades
// once the dot is on its way.
function startNode(X) {
  const L = X.L,
    v = L.v,
    p = PAL[X.night ? 1 : 0],
    g = ease(r(v, BLOOM, 0.14)),
    A = L.C * (1 - r(L.trip, 0.15, 0.5));
  if (v < BLOOM || A <= 0.01) return;
  const [ax, ay] = mainAxis(X, 0);
  mainSeg(X, X.tx0, X.ty0, ax, ay, -1.3 * g, 1.3 * g, A);
  if (v < DEP) {
    const b = r(v, BLOOM, 0.16),
      e = out2(b);
    if (b > 0 && b < 1) ring(X.x0, X.y0, Math.round(4 + 8 * e), Math.round(2 + 4 * e), b < 0.5 ? WHITE : p.br);
  }
  if (g >= 1) mainNode(X, X.tx0 - 0.9 * ax, X.ty0 - 0.9 * ay, 2);
  node(X.x0, X.y0, r(v, BLOOM, BLOOM + 0.04) * 2, v >= SQ1 ? (v - SQ1) / 0.04 : 0, p);
  flush(X.ctx, A);
}
// The commit dot: an upright ball hovering over the line, hopping node to node, a glow under it at night.
function dot(X) {
  const L = X.L,
    v = L.v,
    c = lineOf(X);
  if (v < DOT || (L.hide && v < L_IN)) return;
  const q = v >= ARR ? r(v, ARR, REL) : 0;
  if (q >= 0.1) return;
  X.route(L.trip >= 0 ? L.trip : v >= ARR ? 1 : 0, RQ);
  const gap = c ? nodeGap(c.total, false) : 1,
    d = c ? (L.trip >= 0 ? L.trip : v >= ARR ? 1 : 0) * c.total : 0,
    hop = L.trip >= 0 ? Math.round(HOP * Math.sin(Math.PI * frac(d / gap))) : 0,
    rise = r(v, DOT, DOT + 0.05),
    land = r(q, 0, 0.1),
    rad = v < DOT + 0.02 || land > 0.6 ? 2 : v < DOT + 0.04 || land > 0.2 ? 3 : 4,
    x = RQ[0],
    y = Math.round(RQ[1] - 2 - (rad + 1) - Math.round(2 * rise) - hop + 3 * land),
    p = PAL[X.night ? 1 : 0];
  if (X.night) blob(x, RQ[1], 7, 3, GLOW);
  blob(x, RQ[1], 3 - (hop > 2 ? 1 : 0), 1, SHADE);
  blob(x, y, rad + 1, rad + 1, p.key);
  blob(x, y, rad, rad, p.br);
  add(x - rad + 1, y - rad + 1, rad, 1, p.lit);
  if (rad > 3) add(x - rad + 1, y - rad + 2, 1, 2, p.lit);
  add(x - rad + 1, y - rad + 1, 1, 1, WHITE);
  flush(X.ctx, L.C * (L.hide ? r(v, L_IN, L_IN + 0.04) : 1));
}
const RQ = [0, 0, 0, 0, false];

// A dark chip with pixel text over a head: a short hash at the start, MERGE at the landing.
function chip(X, str, x, y, col, bg, a) {
  if (a <= 0.01) return;
  const w = Kit.glyphs(str).w + 4;
  add(x - (w >> 1), y - 8, w, 9, bg);
  add(x - (w >> 1) + 1, y + 1, w - 2, 1, bg);
  flush(X.ctx, a * 0.92);
  X.ctx.globalAlpha = Math.min(1, a);
  X.text(str, x, y - 1, col, 1);
  X.ctx.globalAlpha = 1;
}
function hashOf(X) {
  let s = '';
  for (let k = 0; k < 6; k++) s += HEX[Math.floor(X.hash(k, 71) * 16) & 15];
  return s;
}
const TOP = [30, 34, 38]; // px from the feet over the head: standing, stool, high stool

export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q) return 4;
    if (L.hide && v < L_IN) return 0;
    let n = 0;
    if (v < DEP) n |= 16;
    if (L.trip < 0.5 && v < ARR) n |= 4;
    if (v >= SPROUT) {
      const te = trailEnd(X),
        c = lineOf(X);
      n |= te < 0 ? 64 : te ? 8 : 4;
      if (te >= 0 && c && c.rug.length) n |= Kit.PART.RUG;
    }
    if (v >= DOT && v < ARR + 0.1 * (REL - ARR)) n |= 64;
    if (L.trip >= MAIN0 || v >= ARR) n |= 8;
    if (v >= ARR) n |= 32;
    return n;
  },
  floor(X, end) {
    const L = X.L;
    if (L.q) {
      // queued: a hollow node waits at the feet, blinking
      if (end || Math.floor(L.secs * 3) & 1) return;
      node(X.x0, X.y0, 1, 0, PAL[X.night ? 1 : 0]);
      flush(X.ctx, 0.7);
      return;
    }
    if (!end && L.v < ARR) startNode(X);
    if (end) landing(X);
    if (end === trailEnd(X)) branch(X, 0);
  },
  stand(X, end) {
    const L = X.L,
      v = L.v;
    if (!end) {
      const a = L.C * r(v, 0.04, 0.08) * (1 - r(v, 0.24, 0.3)),
        top = TOP[X.tp.stool === 2 ? 2 : X.tp.stool ? 1 : 0];
      chip(X, hashOf(X), X.x0, X.y0 - top - Math.round(3 * out2(r(v, 0.04, 0.3))), LIME, CHIP_DK, a);
      return;
    }
    if (v < ARR) return;
    const q = r(v, ARR, REL),
      pop = r(q, CHIP, CHIP + 0.06),
      up = L.fade >= 0 ? r(L.fade, 0, 0.7) : 0,
      a = L.C * pop * (1 - up),
      y = X.y1 - TOP[0] - (pop < 1 ? 2 : 0) - Math.round(5 * out2(up));
    if (!(up > 0.55 && Math.floor(L.fade * 30) & 1)) chip(X, 'MERGE', X.x1, y, '#f1e8ff', MERGE_DK, a);
  },
  // The dot; the branch too when neither end has a plain floor item to carry it.
  trip(X) {
    if (trailEnd(X) < 0) branch(X, 2);
    dot(X);
  },
  rug(X) {
    branch(X, 1);
  },
  // One body pass a frame: squashed into the start node, hidden while the dot travels, grown out of the merge node.
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || v >= REL || (!L.sw && v < SQ0)) return false;
    if ((L.hide && !L.sw) || (L.trip >= 0 && L.trip < 1)) return true;
    if (!L.sw) {
      if (v >= SQ1) return true;
      const k = r(v, SQ0, 0.18),
        e = r(v, 0.18, SQ1),
        pose = X.tp.stool ? (X.tp.stool === 2 ? 'sitHigh' : 'sit') : 'stand';
      X.body({
        pose,
        front: X.a.dirFront,
        sy: e > 0 ? 0.84 * (1 - ease(e)) + 0.06 : 1 - 0.16 * out2(k),
        sx: e > 0 ? 1.12 - 0.7 * ease(e) : 1 + 0.12 * out2(k),
        tint: e > 0.35 ? LIME : undefined,
      });
      return true;
    }
    const q = r(v, ARR, REL);
    if (q < GROW0) return true;
    const g = r(q, GROW0, GROW1),
      // back-out: overshoots a little, then settles
      s = g >= 1 ? 1 : 1 + 2.2 * (g - 1) ** 3 + 1.2 * (g - 1) ** 2;
    X.body({
      pose: 'stand',
      sy: Math.max(0.08, s),
      sx: g >= 1 ? 1 : 0.5 + 0.5 * Math.min(1, s),
      tint: q < TINT1 ? LIME : q < WHITE1 ? WHITE : undefined,
    });
    return true;
  },
  marks: [],
  gap: null,
};
// Which end's floor item carries the branch: one on the plain floor (not the rug, not the plinth's lawn); -1: none,
// and the trip item draws it.
function trailEnd(X) {
  const plain = (x, y) => !Kit.plinth(x, y) && !Kit.onRug(x, y);
  if (plain(X.tx1, X.ty1)) return 1;
  return !X.L.hide && plain(X.tx0, X.ty0) ? 0 : -1;
}
// Exposed for tests.
export const GITBRANCH = { lineOf, spans, pieces, nodeGap, trailEnd, mainAxis, SPROUT, DOT, HEAD, SQ1 };
