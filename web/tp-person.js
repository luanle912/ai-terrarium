// The person as a teleport style draws them (web/tp-style-*.js through X.body / X.bodyAt / X.capture): the page's
// own drawPerson, run on the real agent with a few fields swapped for the pose, through a G whose rect is remapped
// round the feet onto whole pixels (tint, squeeze, legs, flip, quarter turns, mirror, clip, offset). No ctx.scale.
import { PA } from './office-scene.js';

const HIP = 8, // px above the feet: the pivot for flips and turns
  LEG = 4, // px of legs under the shirt (office-draw-people.js: the shirt ends 4 px above the feet)
  MAXCAP = 96;
const FIELDS = ['moving', 'stool', 'status', 'seated', 'armsUp', 'bare', 'dirFront'];
const SAVED = {};
let busy = false;

// The remap of one pass; fx, fy are the feet the agent stands on, ox, oy the whole-pixel move to where it is drawn.
const M = { ctx: null, o: null, fx: 0, fy: 0, ox: 0, oy: 0, cap: null };
const Q = [0, 0, 0, 0];
// Source rect to target rect in Q; false when clipped away.
function mapRect(x, y, w, h) {
  const { o, fx, fy } = M,
    sx = o.sx == null ? 1 : o.sx,
    sy = o.sy == null ? 1 : o.sy;
  let X = Math.round(x),
    Y = Math.round(y),
    Wd = w,
    Hd = h;
  if (o.legs != null && o.legs < 1) {
    const hip = fy - LEG,
      drop = Math.round(LEG * (1 - o.legs));
    if (Y >= hip) {
      Y = Math.round(fy - (fy - Y) * o.legs);
      Hd = Math.max(1, Math.round(Hd * o.legs));
    } else Y += drop;
  }
  if (o.clip) {
    const top = fy - o.clip[0],
      bot = fy - o.clip[1];
    const y0 = Math.max(Y, top),
      y1 = Math.min(Y + Hd, bot);
    if (y1 <= y0) return false;
    Y = y0;
    Hd = y1 - y0;
  }
  X = Math.round(fx + (X - fx) * sx);
  Y = Math.round(fy - (o.lift || 0) + (Y - fy) * sy);
  Wd = Math.max(1, Math.round(Wd * sx));
  Hd = Math.max(1, Math.round(Hd * sy));
  if (o.flip) Y = 2 * (fy - HIP) - (Y + Hd);
  const turns = ((o.rot || 0) % 4) + 4;
  for (let k = 0; k < turns % 4; k++) {
    const cx = fx,
      cy = fy - HIP,
      nx = cx - (Y + Hd - cy),
      ny = cy + (X - cx);
    X = nx;
    Y = ny;
    [Wd, Hd] = [Hd, Wd];
  }
  if (o.mirror) X = 2 * fx - (X + Wd);
  Q[0] = X + M.ox;
  Q[1] = Y + M.oy;
  Q[2] = Wd;
  Q[3] = Hd;
  return true;
}
function rect(x, y, w, h, c) {
  if (!mapRect(x, y, w, h)) return;
  const cap = M.cap,
    col = M.o.tint || c;
  if (cap) {
    if (cap.n >= MAXCAP) return;
    let ci = cap.cols.indexOf(col);
    if (ci < 0) ci = cap.cols.push(col) - 1;
    const k = cap.n++;
    cap.x[k] = Q[0];
    cap.y[k] = Q[1];
    cap.w[k] = Q[2];
    cap.h[k] = Q[3];
    cap.c[k] = ci;
    return;
  }
  M.ctx.fillStyle = col;
  M.ctx.fillRect(Q[0], Q[1], Q[2], Q[3]);
}
let src = null,
  mapped = null;
// One remapped G per source G (the scene's G changes each frame, a world island has its own).
function remapG(G) {
  if (src !== G) {
    src = G;
    mapped = { ...G, rect, poly() {}, th: { ...G.th, shadow: 'rgba(0,0,0,0)', stroke: null }, cold: false };
  }
  return mapped;
}
const REMAP = ['tint', 'sx', 'sy', 'lift', 'legs', 'flip', 'rot', 'mirror', 'clip'];
const needsMap = (o, moved) => moved || REMAP.some(k => o[k] != null && o[k] !== false);
const POSE = {
  stand: { moving: false, seated: false, stool: false },
  walk: { moving: true, seated: false, stool: false },
  sit: { moving: false, seated: false, stool: 1 },
  sitHigh: { moving: false, seated: false, stool: 2 },
  up: { moving: false, seated: false, stool: false, armsUp: true },
};
// One body pass of X.a: o as in the contract; at = [px, py] to draw it elsewhere; cap to record instead of paint.
function pass(X, o, at, cap) {
  if (busy) return false;
  const a = X.a,
    ctx = X.ctx,
    f = PA(a.x, a.y);
  M.fx = Math.round(f[0]);
  M.fy = Math.round(f[1]);
  M.ox = at ? Math.round(at[0]) - M.fx : 0;
  M.oy = at ? Math.round(at[1]) - M.fy : 0;
  M.ctx = ctx;
  M.o = o;
  M.cap = cap;
  const G = cap || needsMap(o, !!at) ? remapG(X.G) : X.G;
  for (const k of FIELDS) SAVED[k] = a[k];
  busy = true;
  try {
    if (o.pose) Object.assign(a, POSE[o.pose]);
    if (o.front != null) a.dirFront = o.front;
    if (o.status) a.status = o.status;
    a.bare = o.bare !== false;
    if (!cap) ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    X.page.drawPerson(G, a);
  } finally {
    for (const k of FIELDS) a[k] = SAVED[k];
    ctx.globalAlpha = 1;
    busy = false;
    M.cap = null;
  }
  return true;
}
const newCapture = () => ({
  n: 0,
  cols: [],
  x: new Int16Array(MAXCAP),
  y: new Int16Array(MAXCAP),
  w: new Int16Array(MAXCAP),
  h: new Int16Array(MAXCAP),
  c: new Uint8Array(MAXCAP),
});

export const TpPerson = {
  HIP,
  LEG,
  MAXCAP,
  isBusy: () => busy,
  body: (X, o) => pass(X, o, null, null),
  bodyAt: (X, px, py, o) => pass(X, o, [px, py], null),
  // Records the remapped rects (whole px, colours by index) for shards; out from newCapture, refilled.
  capture(X, o, out) {
    out.n = 0;
    out.cols.length = 0;
    pass(X, o, o.at || null, out);
    return out;
  },
  newCapture,
};
