// dashrun: drop into a hunched run with both arms straight back, dash along the route in a smoke trail, slide to a
// stop in a cloud that clears. The runner is one captured body pass drawn as shards (sheared, arms redrawn, legs
// scissored); the trail is a floor item, so furniture nearer the camera covers it.
import { Kit } from './tp-kit.js';
import { TpPerson } from './tp-person.js';
import { outdoors } from './office-scene.js';
import { Light } from './light.js';

const { clamp, r, out2, ease, frac } = Kit;
const DEP = 0.42,
  ARR = 0.54,
  REL = 0.92,
  LAUNCH = 0.35, // core: the kick-off
  D0 = 0.25, // tiles: where the lunge leaves the runner when the trip starts
  SLIDE = 0.8, // tiles of slide into the landing, at the start of the arrival
  SQ = 0.4, // arrival fraction the slide takes
  LIFE = 0.8, // s a trail puff lives (the slide's are cut short, so all are gone by END)
  LIFE_LITE = 0.6,
  BURST = 0.65, // s the kick-off cloud lives
  CLOUD = 0.8, // s the landing cloud lives (from SQ / 2 into the arrival)
  LEAN = 3, // px the head leads the feet in the run
  ARM = 7; // px of trailing arm
// Smoke tones (lip, body, highlight): day, dusk, night, snow outdoors (greyer, so a puff keeps an edge on white).
const PAL = [
  ['#8a90a6', '#c9cdd8', '#eceef3'],
  ['#5f647d', '#a2a8bb', '#cdd1dd'],
  ['#30364f', '#737b97', '#a3abc4'],
  ['#56607c', '#b3bacb', '#dde2ec'],
];
const palOf = (X, tx, ty) =>
  X.night ? PAL[2] : X.snow > 0 && outdoors(tx, ty) ? PAL[3] : X.df < Light.GLOW ? PAL[1] : PAL[0];

// Tiles along the route from its first seen point and whether it crosses the rug, cached per route array.
const LENS = new WeakMap();
function routeInfo(X) {
  const pts = X.tp && X.tp.route;
  if (!pts) return null;
  const c = LENS.get(pts);
  if (c && c[0] === X.start) return c;
  let n = 0,
    rug = false;
  for (let k = X.start + 1; k < pts.length; k++) {
    const a = pts[k - 1],
      b = pts[k];
    n += Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let j = 0; j < 4 && !rug; j++) rug = Kit.onRug(Kit.lerp(a[0], b[0], j / 4), Kit.lerp(a[1], b[1], j / 4), 0.5);
  }
  const info = [X.start, n, rug || Kit.onRug(pts[pts.length - 1][0], pts[pts.length - 1][1], 0.5)];
  LENS.set(pts, info);
  return info;
}
const seenLen = X => {
  const c = routeInfo(X);
  return c ? c[1] : Math.hypot(X.tx1 - X.tx0, X.ty1 - X.ty0);
};
// The run: flat out from D0 to the slide over the trip, then the slide into the landing over the first SQ of the
// arrival, braking hard. Tiles reached tau s after the trip starts (T1 trip, T2 arrival, in real seconds), and back.
const slideOf = len => Math.max(0, Math.min(SLIDE, 0.15 * (len - D0)));
function headDist(tau, T1, T2, len) {
  const sl = slideOf(len),
    end = len - sl;
  if (tau <= 0) return D0;
  if (tau <= T1) return D0 + ((end - D0) * tau) / T1;
  return end + sl * out2(clamp((tau - T1) / (SQ * T2)));
}
function bornAt(d, T1, T2, len) {
  const sl = slideOf(len),
    end = len - sl;
  if (d <= end) return (T1 * (d - D0)) / Math.max(1e-9, end - D0);
  return T1 + (1 - Math.sqrt(1 - clamp((d - end) / sl))) * SQ * T2;
}
// Tiles between trail puffs: fewer, further apart, on the fastest long runs.
const spacing = (len, T1, lite) =>
  Math.max(lite ? 0.8 : 0.28, ((len / Math.max(0.1, T1)) * (lite ? LIFE_LITE : LIFE)) / (lite ? 10 : 40));

// Puffs queued as x, y, size, fade step; drawn lip, body, highlight, one fill per tone and step.
const PB = new Int16Array(4 * 64);
let nP = 0;
const addPuff = (x, y, s, b) => {
  if (nP >= 64 || s <= 0) return;
  const k = 4 * nP++;
  PB[k] = Math.round(x);
  PB[k + 1] = Math.round(y);
  PB[k + 2] = s;
  PB[k + 3] = b;
};
function shape(ctx, x, y, s) {
  if (s === 1) ctx.rect(x - 1, y - 1, 2, 2);
  else if (s === 2) {
    ctx.rect(x - 2, y - 1, 4, 2);
    ctx.rect(x - 1, y - 2, 2, 4);
  } else if (s === 3) {
    ctx.rect(x - 3, y - 2, 6, 4);
    ctx.rect(x - 2, y - 3, 4, 6);
  } else if (s >= 4) {
    ctx.rect(x - 4, y - 2, 8, 4);
    ctx.rect(x - 3, y - 3, 6, 6);
    ctx.rect(x - 2, y - 4, 4, 8);
  }
}
const STEP_A = [0.95, 0.6, 0.3];
function flushPuffs(ctx, pal, a, lite) {
  if (!nP || a <= 0.01) return (nP = 0);
  for (let b = 0; b < (lite ? 1 : 3); b++)
    for (let t = 0; t < (lite ? 2 : 3); t++) {
      let any = false;
      for (let k = 0; k < nP; k++) {
        const q = 4 * k,
          s = PB[q + 2] - (t === 2 ? 1 : 0);
        // fading puffs keep only their body tone: cheaper, and softer
        if ((lite ? 0 : PB[q + 3]) !== b || s <= 0 || (b && t !== 1)) continue;
        if (!any) ctx.beginPath();
        any = true;
        shape(ctx, PB[q] - (t === 2 ? 1 : 0), PB[q + 1] + (t === 0 ? 1 : t === 2 ? -1 : 0), s);
      }
      if (!any) continue;
      ctx.globalAlpha = a * STEP_A[b];
      ctx.fillStyle = pal[t];
      ctx.fill();
    }
  ctx.globalAlpha = 1;
  nP = 0;
}
// A puff's size and fade step over its life f (0-1): pops small, swells, thins out and fades.
const sizeAt = (f, big) => (f < 0.06 ? 2 : f < 0.2 ? 3 : f < 0.66 ? 3 + big : 2);
const stepAt = f => (f < 0.55 ? 0 : f < 0.8 ? 1 : 2);

const Q = [0, 0, 0, 0, false],
  Q2 = [0, 0, 0, 0, false];
// The trail puffs, low over the route: rug 0 skips those over the rug, 1 keeps only those, 2 keeps all.
function trail(X, rug) {
  const L = X.L,
    len = seenLen(X),
    [, T1, T2, T3] = L.d,
    tau = L.secs - L.d[0],
    life = X.lite ? LIFE_LITE : LIFE;
  if (len <= D0 || tau <= 0) return;
  const sp = spacing(len, T1, X.lite),
    head = headDist(tau, T1, T2, len),
    from = headDist(tau - life, T1, T2, len);
  for (let j = Math.max(0, Math.floor(from / sp) - 1); j * sp <= head; j++) {
    const d = (j + 0.5 + 0.6 * (X.hash(j, 3) - 0.5)) * sp;
    if (d < D0 || d > head) continue;
    const born = bornAt(d, T1, T2, len),
      // the slide's puffs live shorter, so every puff is gone by the end
      f = (tau - born) / Math.min(life, T1 + T2 + T3 - born);
    if (f < 0 || f >= 1 || (X.lite && f > 0.8)) continue;
    X.route(d / len, Q);
    if (rug !== 2 && Kit.onRug(Q[2], Q[3], 0) !== (rug === 1)) continue;
    addPuff(
      Q[0] + (j & 1 ? 2 : -2) + Math.round((X.hash(j, 5) - 0.5) * 3) * (1 + f),
      Q[1] - 3 - Math.round(4 * f + (X.hash(j, 6) - 0.5) * 2),
      sizeAt(f, !X.lite && X.hash(j, 4) < 0.65 ? 1 : 0),
      stepAt(f),
    );
  }
  flushPuffs(X.ctx, palOf(X, X.tx1, X.ty1), X.L.C, X.lite);
}
// Which end's floor item carries the trail: one on the plain floor (not the rug, not the plinth's lawn); -1: none,
// and the whole trail goes with the runner.
function trailEnd(X) {
  const plain = (x, y) => !Kit.plinth(x, y) && !Kit.onRug(x, y);
  if (plain(X.tx1, X.ty1)) return 1;
  return !X.L.hide && plain(X.tx0, X.ty0) ? 0 : -1;
}

// The kick-off cloud: a cluster swelling behind the start and drifting up; front 0/1 only the half behind or before
// the person, 2 all of it.
function burst(X, age, front) {
  if (age < 0 || age >= BURST) return;
  const f = age / BURST,
    [dx, dy] = X.dir0,
    n = X.lite ? 5 : 9,
    R = 3 + 9 * out2(Math.min(1, f * 1.5)),
    cx = X.x0 - dx * (4 + 5 * f),
    cy = X.y0 - dy * (4 + 5 * f) - 3 - 6 * f * f;
  for (let k = 0; k < n; k++) {
    const ang = 2 * Math.PI * X.hash(k, 11),
      rad = R * (0.25 + 0.75 * X.hash(k, 12)),
      y = cy + 0.5 * rad * Math.sin(ang);
    if (front !== 2 && (y > X.y0 - 3 ? 1 : 0) !== front) continue;
    addPuff(cx + rad * Math.cos(ang), y, f < 0.08 ? 2 : f < 0.5 ? 3 + (k % 3 ? 0 : 1) : 2, stepAt(f));
  }
  flushPuffs(X.ctx, palOf(X, X.tx0, X.ty0), X.L.C, X.lite);
}
const burstAge = X => (X.L.v < DEP ? X.L.v - LAUNCH : DEP - LAUNCH + X.L.secs - X.L.d[0]);
// The landing cloud: a ring swelling round the feet and puffs billowing up round the body (so it shows over a desk
// in front), rising and thinning; front 0/1 the half behind or before the person.
function cloud(X, age, front) {
  if (age < 0 || age >= CLOUD) return;
  const f = age / CLOUD,
    n = X.lite ? 5 : 8,
    R = 3 + 9 * out2(Math.min(1, f * 1.6)),
    up = 10 * f * f;
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * 2 * Math.PI + 0.4 + X.hash(k, 7),
      s = Math.sin(ang);
    if (front !== 2 && (s > 0 ? 1 : 0) !== front) continue;
    const size = f < 0.06 ? 2 : f < 0.5 ? 3 + (k % 3 ? 0 : 1) : 2;
    addPuff(X.x1 + R * Math.cos(ang), X.y1 - 3 + 0.45 * R * s - up - (k % 2) * 2, size, stepAt(f));
  }
  for (let k = 0; k < (X.lite ? 2 : 4); k++) {
    if (front !== 2 && (k & 1) !== front) continue;
    const side = k & 2 ? 1 : -1,
      g = clamp(f * 1.25);
    addPuff(
      X.x1 + side * (4 + 6 * out2(g)) + (k & 1 ? 1 : -1),
      X.y1 - 9 - 4 * (k & 1) - 8 * g,
      g < 0.1 ? 2 : g < 0.55 ? 3 : 2,
      stepAt(g),
    );
  }
  flushPuffs(X.ctx, palOf(X, X.tx1, X.ty1), X.L.C, X.lite);
}
const cloudAge = X => X.L.secs - X.L.d[0] - X.L.d[1] - 0.5 * SQ * X.L.d[2];

// The runner. o: s (1 runs right on screen, -1 left), front, lean (px the head leads), legs, stride (px the left leg
// is ahead), lift (1 raises the rear foot), arms (0 at the sides, 1 swept down and back, 2 straight back).
let CAPT = null;
const ARMC = ['', ''];
// A walking or standing person's arm and hand: 1 px wide just outside the torso (x -5 and +4 from the feet).
const isArm = (rx, ry, w, h) => w === 1 && h <= 5 && (rx === -5 || rx === 4) && ry >= -13 && ry <= -4;
function runner(X, px, py, o) {
  const c = X.capture(
      { pose: 'stand', status: 'working', front: o.front, legs: o.legs, at: [px, py] },
      CAPT || (CAPT = TpPerson.newCapture()),
    ),
    ctx = X.ctx,
    s = o.s;
  ARMC[0] = ARMC[1] = '';
  for (let k = 0; k < c.n; k++)
    if (isArm(c.x[k] - px, c.y[k] - py, c.w[k], c.h[k])) ARMC[c.h[k] > 1 ? 0 : 1] ||= c.cols[c.c[k]];
  const arms = ARMC[0] ? o.arms : 0;
  shadowAt(X, px, py);
  if (arms && o.front) arm(ctx, px, py, s, arms, o);
  Kit.shards(ctx, c, c.n, (k, q) => {
    const rx = c.x[k] - px,
      ry = c.y[k] - py,
      w = c.w[k],
      h = c.h[k];
    if (arms && isArm(rx, ry, w, h)) return false;
    if (w <= 2 && ry >= -4) {
      // a leg or a shoe: scissored, the rear one kicked up
      const ahead = (rx < 0 ? 1 : -1) * o.stride;
      q[0] = s * ahead;
      q[1] = o.lift && ahead < 0 ? -1 : 0;
      return true;
    }
    const mid = ry + h / 2;
    q[0] = mid < -4 ? s * Math.round(o.lean * clamp((-4 - mid) / 11)) : 0;
    q[1] = o.lean > 1 && ry < -12 ? 1 : 0;
    return true;
  });
  if (arms && !o.front) arm(ctx, px, py, s, arms, o);
}
// Both arms from the trailing shoulder (where the arm hung, moved with the torso's lean), side by side: back and down
// 1 px per 2, tapering to the hand (2), or swept down and back (1). 2 px steps so they read solid; sleeves, then hands.
function arm(ctx, px, py, s, stage, o) {
  const x0 = px + s * Math.round(o.lean * 0.36) + (s > 0 ? -5 : 4),
    y0 = py - 9 + (o.legs < 1 ? 1 : 0);
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = stage === 2 ? 2 * k : k;
    run(ctx, x0 - s * a, x0 - s * (a + 1), y0 + k);
    if (stage === 2 && k < 2) run(ctx, x0 - s * a, x0 - s * (a + 1), y0 + k + 1);
  }
  ctx.fillStyle = ARMC[0];
  ctx.fill();
  ctx.beginPath();
  if (stage === 2) ctx.rect(x0 - s * 8, y0 + 3, 1, 1);
  else ctx.rect(x0 - s * 4, y0 + 4, 1, 1);
  ctx.fillStyle = ARMC[1] || ARMC[0];
  ctx.fill();
}
const run = (ctx, xa, xb, y) => ctx.rect(Math.min(xa, xb), y, Math.abs(xb - xa) + 1, 1);
// The page's own shadow under a body drawn elsewhere (the remapped pass has none).
function shadowAt(X, px, py) {
  const ctx = X.ctx;
  ctx.fillStyle = (X.G.th && X.G.th.shadow) || 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(px, py, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}
// Short speed lines streaming off the runner's back.
function speedLines(X, px, py, s, pal) {
  const ctx = X.ctx,
    fk = Math.floor(X.L.secs * 20);
  ctx.beginPath();
  // above and below the trailing arms, clear of them
  for (let k = 0; k < 3; k++) {
    const n = 4 + ((fk + k * 2) % 3) * 2,
      x0 = px - s * (12 + ((fk + k) % 2) * 2 - 4 * (k === 2));
    ctx.rect(s > 0 ? x0 - n : x0, py - [4, 13, 17][k], n, 1);
  }
  ctx.globalAlpha = 0.75 * X.L.C;
  ctx.fillStyle = pal[X.night ? 1 : 0];
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Screen side the route heads to at tile distance d: 1 right, -1 left.
function sideAt(X, d, len) {
  X.route(Math.min(1, (d + 0.15) / len), Q2);
  X.route(Math.max(0, (d - 0.15) / len), Q);
  const dx = Q2[2] - Q[2] - (Q2[3] - Q[3]);
  return dx >= 0 ? 1 : -1;
}

// Departure at the spot: up off a stool, into the hunch, arms swept back, a few scuffs, the kick-off.
function depBody(X) {
  const v = X.L.v,
    p = v / DEP,
    tp = X.tp,
    s = X.dir0[0] >= 0 ? 1 : -1,
    front = X.dir0[1] >= 0;
  if (tp.stool && p < 0.14) {
    X.bodyAt(X.x0, X.y0, { pose: tp.stool === 2 ? 'sitHigh' : 'sit', front: X.a.dirFront });
    return;
  }
  const k = ease(r(p, 0.14, 0.5)),
    go = r(v, LAUNCH, DEP),
    rev = p > 0.55 && go === 0 ? (Math.floor(v * 16) % 2 ? 1 : -1) : 0;
  X.route((D0 * go * go) / Math.max(D0, seenLen(X)), Q);
  runner(X, go > 0 ? Q[0] : X.x0, go > 0 ? Q[1] : X.y0, {
    s,
    front,
    lean: Math.round(LEAN * k),
    legs: 1 - 0.25 * k,
    stride: go > 0 ? 2 : rev,
    lift: go > 0 ? 1 : 0,
    arms: p < 0.24 ? 0 : p < 0.38 ? 1 : 2,
  });
}
// The run itself: flat out with the legs scissoring, heels kicking up smoke.
function runBody(X) {
  const L = X.L,
    len = seenLen(X),
    tau = L.secs - L.d[0],
    d = headDist(tau, L.d[1], L.d[2], len);
  X.route(d / len, Q);
  const hx = Q[0],
    hy = Q[1],
    front = Q[4],
    s = sideAt(X, d, len),
    fk = Math.floor(L.secs * 20) % 4,
    pal = palOf(X, Q[2], Q[3]);
  if (!X.lite) heels(X, hx, hy, s, fk, pal);
  runner(X, hx, hy, { s, front, lean: LEAN, legs: 0.75, stride: [2, 1, -2, -1][fk], lift: 1, arms: 2 });
  // a hidden starter bursts out of the stall in a puff
  if (L.hide && tau < BURST) burst(X, tau, 2);
  if (!X.lite) speedLines(X, hx, hy, s, pal);
}
// A puff kicked off the rear heel each stride.
function heels(X, hx, hy, s, fk, pal) {
  addPuff(hx - s * 5, hy - 1 - (fk & 1), fk < 2 ? 1 : 2, 0);
  addPuff(hx - s * (9 + (fk & 1)), hy - 3, 1, 1);
  flushPuffs(X.ctx, pal, X.L.C, true);
}
const slideAt = (X, out) => {
  const L = X.L,
    len = seenLen(X);
  return X.route(headDist(L.secs - L.d[0], L.d[1], L.d[2], len) / len, out);
};
// Dust sprayed ahead of the feet in the slide, dying down as it stops.
function skid(X) {
  const q = r(X.L.v, ARR, REL);
  if (q >= SQ + 0.1) return;
  slideAt(X, Q);
  const s = X.dir1[0] >= 0 ? 1 : -1,
    n = q < SQ ? 4 : 2;
  for (let k = 0; k < n; k++) {
    const t = frac(q * 7 + k / n);
    addPuff(Q[0] + s * (5 + 7 * t), Q[1] - 1 - 4 * t * (1 - t) * 3 + (k % 2), t < 0.4 ? 1 : 2, t > 0.6 ? 1 : 0);
  }
  flushPuffs(X.ctx, palOf(X, X.tx1, X.ty1), X.L.C, X.lite);
}
// Arrival: the slide on braced legs, leaning back, then up straight, arms down, inside the clearing cloud.
function arrBody(X) {
  const q = r(X.L.v, ARR, REL),
    s = X.dir1[0] >= 0 ? 1 : -1;
  if (q >= 0.62) {
    X.body({ pose: 'stand' });
    return;
  }
  const up = ease(r(q, SQ, 0.58));
  slideAt(X, Q);
  runner(X, Q[0], Q[1], {
    s,
    front: X.dir1[1] >= 0,
    lean: q < SQ ? -1 : 0,
    legs: 0.7 + 0.3 * up,
    stride: q < SQ ? -2 * s : up < 0.5 ? -s : 0,
    lift: 0,
    arms: q < SQ * 0.6 ? 2 : q < 0.5 ? 1 : 0,
  });
}

export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v,
      te = trailEnd(X),
      ba = burstAge(X);
    if (L.q) return 0;
    let n = 0;
    if (v < DEP) n |= 16;
    if (ba >= 0 && ba < BURST) n |= 1 | 16;
    if (L.trip >= 0) n |= 64;
    if (v >= DEP && L.secs - L.d[0] < L.d[1] + (X.lite ? LIFE_LITE : LIFE)) {
      n |= te < 0 ? 64 : te ? 8 : 4;
      if (te >= 0) n |= 64;
    }
    if (v >= ARR) n |= 2 | 32;
    return n;
  },
  floor(X, end) {
    if (X.L.v >= DEP && end === trailEnd(X)) trail(X, 0);
  },
  back(X, end) {
    if (end) cloud(X, cloudAge(X), 0);
    else burst(X, burstAge(X), 0);
  },
  stand(X, end) {
    if (end) {
      skid(X);
      cloud(X, cloudAge(X), 1);
      return;
    }
    burst(X, burstAge(X), 1);
    const p = X.L.v / DEP;
    if (p > 0.55 && X.L.v < LAUNCH) {
      // scuffs off the heels while revving on the spot
      const s = X.dir0[0] >= 0 ? 1 : -1;
      for (let k = 0; k < 2; k++) {
        const t = frac(X.L.v * 7 + k / 2);
        addPuff(X.x0 - s * (5 + 6 * t) + (k ? 2 : -2), X.y0 - 1 - 4 * t, t < 0.4 ? 1 : 2, t > 0.6 ? 1 : 0);
      }
      flushPuffs(X.ctx, palOf(X, X.tx0, X.ty0), X.L.C, X.lite);
    }
  },
  // The trail's stretch over the rug is drawn here (the rug lies over the floor items), or all of it with no end.
  trip(X) {
    const te = trailEnd(X);
    if (X.L.v >= DEP && (te < 0 || (routeInfo(X) || [])[2])) trail(X, te < 0 ? 2 : 1);
    if (X.L.trip >= 0 && X.L.trip < 1) runBody(X);
  },
  // One body pass a frame: at the spot before the run, from trip() during it, at the landing after.
  person(X) {
    const L = X.L;
    if (L.q || L.v >= REL) return false;
    if (L.hide && !L.sw) return true;
    if (L.trip >= 0 && L.trip < 1) return true;
    if (!L.sw) depBody(X);
    else arrBody(X);
    return true;
  },
  marks: [],
  gap: null,
};
// Exposed for tests.
export const DASH = {
  headDist,
  bornAt,
  slideOf,
  spacing,
  seenLen,
  trailEnd,
  isArm,
  runner,
  D0,
  LAUNCH,
  LIFE,
  SQ,
};
