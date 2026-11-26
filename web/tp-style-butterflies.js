// butterflies: glints twinkle on the person, who peels away from the head down into a swarm of butterflies (fireflies
// at night); the swarm flutters over the island in a loose stream and spirals down at the landing, where the person is
// built back from the feet up as each one dives in. Two stay behind: one perches on the head, then both flutter off.
// One body pass a frame at the ends, from person(): the body, or its capture cut along a ragged line.
// The swarm rides the trip item in every phase: with the furniture at the ends, the overlay in flight.
import { Kit } from './tp-kit.js';
import { TpPerson } from './tp-person.js';
import { TeleportLogic } from './teleport-logic.js';

const { atlas, bake, clamp, r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR } = TeleportLogic;
const REL = TeleportLogic.T.RELEASE,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  B = {
    D0: at(0.2), // sparkles wink on the body, then the cut line runs from the top of the head
    D1: at(0.72), // down to the feet
    FLY: at(0.28), // core: a butterfly's flight from the body to the swarm
    G0: ar(0.14), // the body is built back from the feet
    G1: ar(0.8), // to the top of the head
    DIVE: ar(0.24) - ARR, // core: a butterfly's dive into the body
    PERCH0: ar(0.74), // a stayer glides onto the head
    PERCH1: ar(0.88),
  },
  N = 9, // butterflies in a swarm
  STAY = 2, // of them stay behind and flutter off after the release
  LAND = N - STAY,
  WAIT = N - 1, // the one circling over a queued person, out before the rest
  LAG = 0.35, // trip: the last one leaves this much later
  HOV = 30, // px from the feet up to the swarm's centre at an end
  TALL = 21, // px from the feet to the top of a standing head (no hat)
  JAG = [0, 2, 1, 2, 0, 1, 2, 1, 0, 1, 2, 0], // ragged cut, px per column
  GLINT = ['#fffbe6', '#f4ff9c'], // day, night
  INK = '#2b1d1a';

const stoolLift = stool => (stool === 2 ? 9 : stool ? 4 : 0);
const jag = x => JAG[((x % JAG.length) + JAG.length) % JAG.length];
// The body's cut line, px over the feet (below it shows), for a body `top` px tall: departure top-down, arrival up.
function lineAt(v, top) {
  const span = top + 3;
  if (v < ARR) return span * (1 - r(v, B.D0, B.D1));
  return span * r(v, B.G0, B.G1);
}
// Height share of butterfly j's spot on the body (0 feet, 1 head): it leaves when the line passes it, top first,
// and a lander dives in when the line comes back up to it, feet first.
const spotOf = j => (j + 0.5) / N;
const landSpot = j => (j + 0.5) / LAND;
const birthOf = j => B.D0 + (1 - spotOf(j)) * (B.D1 - B.D0);
const landOf = j => B.G0 + landSpot(j) * (B.G1 - B.G0);
// The flight: e along the chord, an arc px high, higher on a longer trip (read tp.len every frame: re-aim retimes it).
function sail(p, len) {
  const e = ease(clamp(p)),
    H = Math.min(34, Math.max(8, 4 + 1.1 * (len || 0)));
  return { e, h: 4 * H * e * (1 - e) };
}
// Butterfly j's own share of the trip: the swarm leaves as a stream and bunches up again over the landing.
const tripOf = (X, j, p) => clamp(p * (1 + LAG) - LAG * X.hash(j, 2));

// The atlas: per palette a row of three wing frames (open, half, closed), then the firefly's bright and dim frames.
const FW = 7,
  FH = 5,
  FIRE = 7, // firefly cell
  PAL = [
    ['#ff8a1f', '#c4521a', '#ffe2a8', '#5a2410'], // orange
    ['#4aa8ff', '#2f6fd6', '#d8f0ff', '#1d3a7a'], // blue
    ['#ffd21f', '#d9790f', '#fff6c4', '#7a4a0a'], // lemon
    ['#ff6aae', '#c23f86', '#ffd8ea', '#6e1f4a'], // rose
    ['#a970ff', '#7244c9', '#eadcff', '#3a2272'], // violet
  ],
  WINGS = [
    ['dw...wd', 'wlwbwlw', '.wwbww.', '.ssbss.', '.d...d.'],
    ['.......', '.dw.wd.', '.lwbwl.', '..sbs..', '..d.d..'],
    ['.......', '..w.w..', '..wbw..', '...b...', '.......'],
  ],
  GLOW = ['..ooo..', '.ohhho.', 'ohhghho', 'ohgcgho', 'ohhghho', '.ohhho.', '..ooo..'],
  DIM = ['.......', '.......', '...h...', '..hch..', '...h...', '.......', '.......'],
  FIREC = { c: '#fffde0', g: 'rgba(222,255,110,0.9)', h: 'rgba(180,245,70,0.34)', o: 'rgba(170,240,60,0.13)' },
  FY = PAL.length * FH; // fireflies row
function raster(rows, w, h, codes) {
  const px = new Uint8Array(w * h);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) px[y * w + x] = codes.indexOf(row[x]) + 1;
  });
  return px;
}
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = atlas(3 * (FW + 1), FY + FIRE, g => {
    PAL.forEach((cols, n) =>
      WINGS.forEach((rows, f) =>
        bake(g, raster(rows, FW, FH, 'wsldb'), FW, FH, f * (FW + 1), c => [...cols, INK][c - 1], n * FH),
      ),
    );
    [GLOW, DIM].forEach((rows, f) =>
      bake(g, raster(rows, FIRE, FIRE, 'cgho'), FIRE, FIRE, f * (FIRE + 1), c => FIREC['cgho'[c - 1]], FY),
    );
  }));

// One butterfly (or firefly) centred at (x, y): wing frame from its own beat.
function bug(X, j, x, y, a, slow) {
  if (a <= 0.01) return;
  const ctx = X.ctx,
    s = X.L.secs,
    ph = X.hash(j, 4);
  if (X.night) {
    const blink = 0.5 + 0.5 * Math.sin(s * (5 + 3 * X.hash(j, 6)) + 6.3 * ph),
      dim = X.lite || blink < 0.35;
    ctx.globalAlpha = a * (0.55 + 0.45 * blink);
    X.stamp(sheetOf(), dim ? FIRE + 1 : 0, FY, FIRE, FIRE, Math.round(x) - 3, Math.round(y) - 3, FIRE, FIRE);
  } else {
    const k = slow
        ? Kit.frac(s * 0.9 + ph) < 0.65
          ? 2
          : 0
        : [0, 1, 2, 1][Math.floor(Kit.frac(s * (5 + 3 * ph) + ph) * 4)],
      pal = Math.min(PAL.length - 1, Math.floor((X.hash(j, 5) < 0.5 ? X.hash(0, 1) : X.hash(j, 20)) * PAL.length));
    ctx.globalAlpha = a;
    X.stamp(sheetOf(), k * (FW + 1), pal * FH, FW, FH, Math.round(x) - 3, Math.round(y) - 2, FW, FH);
  }
  ctx.globalAlpha = 1;
}
// Butterfly j's place round a swarm centre: a slow wobbly orbit, `spread` times its own radius.
function orbit(X, j, cx, cy, spread, out) {
  const s = X.L.secs,
    h = X.hash(j, 7),
    w = (1 + 0.8 * X.hash(j, 8)) * (X.hash(j, 9) < 0.5 ? 1 : -1),
    th = 6.283 * h + s * w;
  out[0] = cx + Math.cos(th) * (5 + 8 * X.hash(j, 10)) * spread;
  out[1] = cy + Math.sin(th) * (3 + 4 * X.hash(j, 11)) * spread + Math.sin(s * 5 + 7 * h) * 1.5;
  return out;
}
// Butterfly j's spot on the body, from the feet: x in the body's width, y at its height share of a `top` px body.
function home(X, j, share, top, fx, fy, out) {
  out[0] = fx + Math.round((X.hash(j, 12) - 0.5) * (share > 0.75 ? 5 : 8));
  out[1] = fy - Math.round(share * (top - 2)) - 1;
  return out;
}

const P = [0, 0, 1],
  O = [0, 0],
  Hm = [0, 0];
// Where butterfly j is this frame: P = [x, y, alpha], or null when it is not out (inside the body, or gone).
function where(X, j) {
  const L = X.L,
    v = L.v,
    tp = X.tp;
  if (L.trip >= 0) {
    const g = sail(tripOf(X, j, L.trip), tp.len),
      lift = stoolLift(tp.stool) * (1 - g.e);
    orbit(
      X,
      j,
      lerp(X.x0, X.x1, g.e),
      lerp(X.y0 - HOV - lift, X.y1 - HOV, g.e) - g.h,
      1 + 0.4 * Math.sin(3.14 * g.e),
      P,
    );
    P[2] = L.hide ? 0.3 + 0.7 * r(L.trip, 0, 0.15) : 1;
    return P;
  }
  if (v < ARR) {
    // the waiting one (WAIT) is out from the start and only widens its circle; the rest leave the body
    const tb = j === WAIT ? 0 : birthOf(j);
    if (v < tb) return null;
    const s = j === WAIT ? 1 : out2(r(v, tb, tb + B.FLY)),
      top = topOf(X, TALL + stoolLift(tp.stool));
    home(X, j, spotOf(j), top, X.x0, X.y0, Hm);
    orbit(X, j, X.x0, X.y0 - HOV - stoolLift(tp.stool), j === WAIT ? 0.6 + 0.4 * r(v, 0, DEP) : 0.7 + 0.3 * s, O);
    P[0] = lerp(Hm[0], O[0], s);
    P[1] = lerp(Hm[1], O[1], s);
    P[2] = L.C;
    return P;
  }
  if (j < LAND) {
    const tl = landOf(j);
    if (v >= tl) return null;
    const s = in2(r(v, tl - B.DIVE, tl));
    home(X, j, landSpot(j), topOf(X, TALL), X.x1, X.y1, Hm);
    orbit(X, j, X.x1, X.y1 - HOV, 1 - 0.3 * r(v, ARR, B.G1), O);
    P[0] = lerp(O[0], Hm[0], s);
    P[1] = lerp(O[1], Hm[1], s);
    P[2] = 1;
    return P;
  }
  return stayer(X, j, v);
}
// A stayer: circles the head (the last one perches on it), then after the release flutters up and away.
function stayer(X, j, v) {
  const L = X.L,
    k = j - LAND,
    perch = k === STAY - 1,
    s = perch ? ease(r(v, B.PERCH0, B.PERCH1)) : 0;
  orbit(X, j, X.x1, X.y1 - HOV + 8 * r(v, ARR, B.G1), 1 - 0.5 * r(v, ARR, B.G1), O);
  P[0] = Math.round(lerp(O[0], X.x1, s));
  P[1] = Math.round(lerp(O[1], X.y1 - topOf(X, TALL) - 3, s));
  P[2] = 1;
  if (L.fade >= 0) {
    const f = out2(L.fade),
      side = k ? 1 : -1;
    P[0] += side * (18 + 8 * X.hash(j, 13)) * f + Math.sin(L.secs * 6 + j) * 2 * f;
    P[1] -= (30 + 10 * X.hash(j, 14)) * f;
    P[2] = 1 - r(L.fade, 0.45, 0.95);
  }
  return P;
}
// Night flight: a short fading streak behind each firefly, against the way the swarm goes. Two fills.
function streaks(X) {
  if (X.lite) return;
  const ctx = X.ctx,
    dx = X.x1 - X.x0,
    dy = X.y1 - X.y0,
    n = Math.hypot(dx, dy) || 1,
    ux = dx / n,
    uy = dy / n;
  for (let k = 1; k <= 2; k++) {
    ctx.beginPath();
    for (let j = 0; j < N; j++) {
      const p = where(X, j);
      if (p) ctx.rect(Math.round(p[0] - ux * 3 * k), Math.round(p[1] - uy * 3 * k), 1, 1);
    }
    ctx.globalAlpha = (k === 1 ? 0.5 : 0.25) * X.L.C * (X.L.hide ? r(X.L.trip, 0, 0.15) : 1);
    ctx.fillStyle = FIREC.g;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
const perched = (X, j, v) => j === N - 1 && v >= B.PERCH1 && X.L.fade < 0.08;

// The capture cut along the ragged line: rows `line` px over the feet fy and below show; glints ride the edge.
const CAP = TpPerson.newCapture();
function cutBody(X, cap, fy, line, a) {
  const ctx = X.ctx,
    cut = Math.round(fy - line),
    ph = Math.floor(X.L.secs * 12); // the ragged edge crawls
  ctx.globalAlpha = a;
  for (let c = 0; c < cap.cols.length; c++) {
    let any = false;
    for (let k = 0; k < cap.n; k++) {
      if (cap.c[k] !== c) continue;
      const x0 = cap.x[k],
        y0 = cap.y[k],
        y1 = y0 + cap.h[k];
      if (y1 <= cut) continue;
      if (!any) {
        ctx.beginPath();
        any = true;
      }
      if (y0 >= cut + 2) ctx.rect(x0, y0, cap.w[k], cap.h[k]);
      else
        for (let x = x0; x < x0 + cap.w[k]; x++) {
          const y = Math.max(y0, cut + jag(x + ph));
          if (y < y1) ctx.rect(x, y, 1, y1 - y);
        }
    }
    if (any) {
      ctx.fillStyle = cap.cols[c];
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
// Bounds of the captured body: B4 = [left, right, top (px over the feet)].
const B4 = [0, 0, 0];
// The body's height from this teleport's last capture (by tp: the next one may start on a stool): where a hat ends.
const TOPS = new WeakMap();
const topOf = (X, dflt) => (X.tp && TOPS.get(X.tp)) || dflt;
function bounds(X, cap, fy) {
  B4[0] = 1e9;
  B4[1] = -1e9;
  B4[2] = 8;
  for (let k = 0; k < cap.n; k++) {
    B4[0] = Math.min(B4[0], cap.x[k]);
    B4[1] = Math.max(B4[1], cap.x[k] + cap.w[k]);
    B4[2] = Math.max(B4[2], fy - cap.y[k]);
  }
  TOPS.set(X.tp, B4[2]);
  return B4;
}
function glints(X, cut, left, right, n, a) {
  if (X.lite || a <= 0.01 || right <= left) return;
  const ctx = X.ctx,
    s = X.L.secs;
  ctx.globalAlpha = a;
  ctx.beginPath();
  for (let j = 0; j < n; j++) {
    if (Kit.frac(s * 7 + X.hash(j, 15)) > 0.6) continue;
    const x = left + Math.floor(X.hash(j, 16 + Math.floor(s * 7)) * (right - left)),
      y = cut - 1 - Math.floor(3 * X.hash(j, 17));
    ctx.rect(x, y, 1, 1);
  }
  ctx.fillStyle = GLINT[X.night ? 1 : 0];
  ctx.fill();
  ctx.globalAlpha = 1;
}
// The cue: sparkles wink on over the body one after another, a pixel growing to a cross and back.
function twinkle(X, fx, fy, top, v) {
  if (X.lite) return;
  const ctx = X.ctx;
  ctx.beginPath();
  for (let j = 0; j < 4; j++) {
    const t = r(v, (j * B.D0) / 5, ((j + 2) * B.D0) / 5),
      k = t > 0 && t < 1 ? Math.round(2 * Math.sin(3.14 * t)) : -1;
    if (k < 0) continue;
    const x = fx - 4 + Math.floor(9 * X.hash(j, 18)),
      y = fy - 4 - Math.floor((top - 6) * X.hash(j, 19));
    ctx.rect(x, y, 1, 1);
    if (!k) continue;
    ctx.rect(x - k, y, k, 1);
    ctx.rect(x + 1, y, k, 1);
    ctx.rect(x, y - k, 1, k);
    ctx.rect(x, y + 1, 1, k);
  }
  ctx.globalAlpha = X.L.C;
  ctx.fillStyle = GLINT[X.night ? 1 : 0];
  ctx.fill();
  ctx.globalAlpha = 1;
}
// The page's own shadow under a body drawn from its capture (the remapped pass draws none).
function shadowAt(X, px, py, a) {
  if (a <= 0.01) return;
  const ctx = X.ctx;
  ctx.globalAlpha = a;
  ctx.fillStyle = (X.G.th && X.G.th.shadow) || 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(px, py, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
const poseOf = stool => (stool === 2 ? { pose: 'sitHigh' } : stool ? { pose: 'sit' } : {});
const STAND = { pose: 'stand', front: true };
// The departure: twinkles over the whole body, then the body peels away from the head down.
function leave(X, v) {
  const tp = X.tp,
    o = poseOf(tp.stool);
  if (v < B.D0) {
    X.body(o);
    twinkle(X, X.x0, X.y0, topOf(X, TALL + stoolLift(tp.stool)), v);
    return;
  }
  const cap = X.capture(o, CAP),
    b = bounds(X, cap, X.y0),
    line = lineAt(v, b[2]);
  if (!tp.stool) shadowAt(X, X.x0, X.y0, clamp(line / 8));
  cutBody(X, cap, X.y0, line, 1);
  if (line > 0) glints(X, Math.round(X.y0 - line), b[0], b[1], 4, X.L.C);
}
// The landing: built back from the feet as the butterflies dive in, each with a glint where it lands.
function gather(X, v) {
  if (v >= B.G1) return X.body(STAND);
  const cap = X.capture(STAND, CAP),
    b = bounds(X, cap, X.y1),
    line = lineAt(v, b[2]);
  shadowAt(X, X.x1, X.y1, clamp(line / 8));
  if (line > 0) cutBody(X, cap, X.y1, line, 1);
  if (v > B.G0) glints(X, Math.round(X.y1 - line), b[0], b[1], 3, 1);
}

export const STYLE = {
  need(X) {
    const L = X.L;
    if (L.q) return 16;
    if (L.hide && !L.sw && L.trip < 0) return 0;
    return 64;
  },
  // Queued: one butterfly already circles over their head.
  stand(X, end) {
    if (end || !X.L.q) return;
    orbit(X, WAIT, X.x0, X.y0 - HOV - stoolLift(X.tp.stool), 0.6, O);
    bug(X, WAIT, O[0], O[1], 1, false);
  },
  trip(X) {
    const v = X.L.v;
    if (X.night && X.L.trip >= 0) streaks(X);
    for (let j = 0; j < N; j++) {
      const p = where(X, j);
      if (p) bug(X, j, p[0], p[1], p[2] * X.L.C, perched(X, j, v));
    }
  },
  // Only for depth: at an end the swarm sorts just in front of the person (a stool sitter's too); in flight its
  // centre's height puts it in the overlay. No shadow: a sparse swarm casts none worth a blob.
  ground(X, out) {
    const L = X.L;
    if (L.trip >= 0) {
      const g = sail(L.trip, X.tp.len);
      out[0] = lerp(X.tx0, X.tx1, g.e);
      out[1] = lerp(X.ty0, X.ty1, g.e);
      out[2] = HOV + g.h;
      return true;
    }
    const end = L.v >= ARR;
    out[0] = (end ? X.tx1 : X.tx0) + 0.1;
    out[1] = (end ? X.ty1 : X.ty0) + 0.1;
    out[2] = 0;
    return true;
  },
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || v >= REL) return false;
    if (L.trip >= 0 || (L.hide && !L.sw)) return true;
    if (!L.sw) leave(X, v);
    else if (v >= ARR) gather(X, v);
    return true;
  },
  marks: [],
  gap: null,
};
// Exposed for tests.
export const BUTTERFLIES = {
  B,
  N,
  STAY,
  LAND,
  WAIT,
  lineAt,
  birthOf,
  landOf,
  sail,
  tripOf,
  where,
  bounds,
  need: STYLE.need,
};
