// frog: a few sparkles gather, poof, and out of the clearing cloud sits a frog with a tuft of the person's hair. It
// croaks once, hops along the real route in short leaps with a puff of dust at every touchdown, and at the landing
// poof again: the person pops out arms up and gives one last froggy hiccup. The frog is a baked sprite drawn at the
// spot by person() before and after the trip, and by the trip item at its route point during it.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { outdoors } from './office-scene.js';

const { clamp, r, out2, ease } = Kit;
const { DEP, ARR, T } = TeleportLogic;
const REL = T.RELEASE,
  L_IN = T.L_IN;
const FW = 18, // sprite cell, px
  FH = 12,
  AX = 8, // sprite column over the feet (facing right)
  // departure fractions: sparkles gather, the cloud bursts, the frog replaces the body, the croak, the crouch
  TW0 = 0.04,
  POOF0 = 0.26,
  SWAP0 = 0.32,
  CROAK0 = 0.64,
  CROAK1 = 0.9,
  CROUCH = 0.9,
  // arrival fractions: the cloud bursts, the person replaces the frog, arms up until, the hiccup
  POOF1 = 0.1,
  SWAP1 = 0.24,
  UP1 = 0.85,
  HIC = 0.86,
  CLOUD = 0.38, // s a cloud lives
  DUST = 0.2, // s a touchdown puff lives
  HOP = 0.3, // s of trip per hop, about
  HOPMAX = 4.5, // tiles: longer hops would sort too far from where the frog is drawn
  GH = 0.1, // half of each hop spent on the ground (landing, then the next crouch)
  HIDE_POOF = 0.12; // s a hidden start's poof is under way when the frog shows at DEP

// Facing right; o keyline, g green, l highlight, d spots, b belly, w eye, k pupil, y throat sac, s its shade.
const SPR = [
  // sit
  [
    '..........oo.oo...',
    '.........owwowwo..',
    '.........owkowko..',
    '......oooggggggo..',
    '....ooggglgggggo..',
    '...oglgggggooooo..',
    '..oglggdggobbbbo..',
    '.ogggdggggobbbo...',
    '.ogggggdggogbgo...',
    'ooggggggoogogo....',
    'oooooooooooooo....',
  ],
  // sac, half
  [
    '..........oo.oo...',
    '.........owwowwo..',
    '.........owkowko..',
    '......oooggggggo..',
    '....ooggglgggggo..',
    '...oglgggggoooooo.',
    '..oglggdggoyyyyso.',
    '.ogggdggggooyyyo..',
    '.ogggggdggogooo...',
    'ooggggggoogogo....',
    'oooooooooooooo....',
  ],
  // sac, full
  [
    '..........oo.oo...',
    '.........owwowwo..',
    '.........owkowko..',
    '......oooggggggo..',
    '....ooggglgggggoo.',
    '...oglgggggoyyyyyo',
    '..oglggdggoyyyyyyo',
    '.ogggdggggoyyyyyso',
    '.ogggggdggooysssoo',
    'ooggggggoogoooo...',
    'oooooooooooooo....',
  ],
  // crouch
  [
    '..................',
    '..........oo.oo...',
    '.........owwowwo..',
    '.........owkowko..',
    '.....ooooggggggo..',
    '...ooggglgggoooo..',
    '..oglggggggobbbo..',
    '.oglggdgggobbbbo..',
    'oggggggdggobbgo...',
    'ogggggggoogogo....',
    'oooooooooooooo....',
  ],
  // leap
  [
    '..........oo.oo...',
    '.........owwowwo..',
    '.........owkowko..',
    '.......ooggggggo..',
    '.....ooggglggggo..',
    '...oogggggggoooo..',
    '..ogdggggggobbbo..',
    '.ogggggdggobbbo...',
    '.oggooooooobggo...',
    'oggo.......ogo....',
    'ogo........oo.....',
    'oo................',
  ],
];
const SIT = 0,
  SAC1 = 1,
  SAC2 = 2,
  CROUCHED = 3,
  LEAP = 4;
// Row of the eye bumps' top per pose, and the column between them (facing right): the hair tuft sits there.
const TOP = [0, 0, 0, 1, 0],
  TUFT = 12;
const PAL = [
  {
    o: '#173d1a',
    g: '#4fae3b',
    l: '#9be06a',
    d: '#2e7a2c',
    b: '#e9e4a2',
    w: '#ffffff',
    k: '#101010',
    y: '#fbf6d2',
    s: '#d9cf8e',
  },
  {
    o: '#0c2410',
    g: '#3c8a34',
    l: '#73b955',
    d: '#225e24',
    b: '#c8c38c',
    w: '#e9eef2',
    k: '#0a0a0a',
    y: '#e2ddb8',
    s: '#b4ab78',
  },
];
// Every pose facing right and mirrored, day row then night row; built once on the first frame that draws a frog.
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = Kit.atlas(SPR.length * 2 * FW, 2 * FH, g => {
    for (let n = 0; n < 2; n++)
      SPR.forEach((rows, k) =>
        rows.forEach((row, y) =>
          [...row].forEach((ch, x) => {
            if (ch === '.') return;
            g.fillStyle = PAL[n][ch];
            g.fillRect(2 * k * FW + x, n * FH + FH - rows.length + y, 1, 1);
            g.fillRect((2 * k + 1) * FW + FW - 1 - x, n * FH + FH - rows.length + y, 1, 1);
          }),
        ),
      );
  }));

// The frog with its feet on (px, py), h px off the ground, facing s (1 right, -1 left), at alpha a.
function frog(X, px, py, h, pose, s, a) {
  if (a <= 0.01) return;
  const ctx = X.ctx,
    m = s < 0 ? 1 : 0,
    dx = px - (m ? FW - 1 - AX : AX),
    dy = py - FH - Math.round(h);
  ctx.globalAlpha = a * (h > 1 ? Math.max(0.3, 1 - h / 24) : 1);
  ctx.fillStyle = (X.G.th && X.G.th.shadow) || 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(px, py, h > 3 ? 4 : 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = a;
  X.stamp(sheetOf(), (2 * pose + m) * FW, X.night ? FH : 0, FW, FH, dx, dy, FW, FH);
  const hair = X.a && X.a.hair;
  if (hair) {
    // a tuft of the person's own hair between the eyes, swept back
    const c = dx + (m ? FW - 1 - TUFT : TUFT),
      y = dy + FH - SPR[pose].length + TOP[pose];
    ctx.beginPath();
    ctx.rect(c, y, 1, 1);
    ctx.rect(c - 1, y - 1, 3, 1);
    ctx.rect(s > 0 ? c - 1 : c, y - 2, 2, 1);
    ctx.fillStyle = hair;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Puffs queued as x, y, size, fade step; drawn lip, body, highlight, one fill per tone and step.
const PB = new Int16Array(4 * 48);
let nP = 0;
const addPuff = (x, y, s, b) => {
  if (nP >= 48 || s <= 0) return;
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
  } else {
    ctx.rect(x - 4, y - 2, 8, 4);
    ctx.rect(x - 3, y - 3, 6, 6);
    ctx.rect(x - 2, y - 4, 4, 8);
  }
}
const STEP_A = [0.95, 0.6, 0.3];
function flushPuffs(ctx, pal, a, tones) {
  if (!nP || a <= 0.01) return (nP = 0);
  for (let b = 0; b < 3; b++)
    for (let t = 3 - tones; t < 3; t++) {
      let any = false;
      for (let k = 0; k < nP; k++) {
        const q = 4 * k,
          s = PB[q + 2] - (t === 2 ? 1 : 0);
        if (PB[q + 3] !== b || s <= 0) continue;
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
// Magic cloud (lip, body, highlight) by day and night; dust kicked up by day, at night and on snow outdoors.
const CLOUD_PAL = [
  ['#86a98f', '#d5ecd6', '#f7fff4'],
  ['#3f5f50', '#86a898', '#bcd8c8'],
  ['#4f8a63', '#a9d6b4', '#e3f7e4'],
];
const DUST_PAL = [
  ['#9c8f78', '#d8cfbb', '#efe9dc'],
  ['#454a5e', '#767c92', '#9aa0b4'],
  ['#9eacbf', '#e4ebf3', '#ffffff'],
];
const dustPal = (X, tx, ty) => (X.night ? DUST_PAL[1] : X.snow > 0 && outdoors(tx, ty) ? DUST_PAL[2] : DUST_PAL[0]);
const stepAt = f => (f < 0.5 ? 0 : f < 0.78 ? 1 : 2);

// The poof cloud round a body standing at (cx, cy), age s after it burst: it swells over the body, then rises and
// thins out; sparkles fly out of it.
function cloud(X, cx, cy, tx, ty, age, lite) {
  if (age < 0 || age >= CLOUD) return;
  const f = age / CLOUD,
    n = lite ? 5 : 8,
    R = 3 + 8 * out2(Math.min(1, f * 2.2)),
    rise = 7 * f * f,
    big = f < 0.05 ? 2 : f < 0.55 ? 4 : f < 0.8 ? 3 : 2;
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * 2 * Math.PI + 0.3 + 0.5 * X.hash(k, 31);
    addPuff(cx + R * Math.cos(ang), cy - 9 + 0.75 * R * Math.sin(ang) - rise, big - (k % 3 ? 1 : 0), stepAt(f));
  }
  addPuff(cx, cy - 6 - rise, big, stepAt(f));
  addPuff(cx - 3, cy - 12 - rise, big, stepAt(f));
  addPuff(cx + 3, cy - 13 - rise, big, stepAt(f));
  addPuff(cx, cy - 18 - rise, big - 1, stepAt(f));
  for (let k = -1; k <= 1; k += 2) addPuff(cx + 5 * k, cy - 2 - rise, big - 1, stepAt(f));
  flushPuffs(X.ctx, CLOUD_PAL[X.night ? 1 : X.snow > 0 && outdoors(tx, ty) ? 2 : 0], X.L.C, lite ? 2 : 3);
  if (lite) return;
  sparkles(X, cx, cy, f);
}
const SPARK = ['#fff3a0', '#ffe27a'];
// Five sparkles flying out of a fresh cloud: a cross while bright, a dot as they fade.
function sparkles(X, cx, cy, f) {
  if (f >= 0.7) return;
  const ctx = X.ctx,
    d = 5 + 15 * out2(f / 0.7);
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const ang = (k / 5) * 2 * Math.PI - 1.2 + 0.4 * X.hash(k, 37),
      x = Math.round(cx + d * Math.cos(ang)),
      y = Math.round(cy - 10 + 0.8 * d * Math.sin(ang));
    if (f < 0.4) {
      ctx.rect(x - 1, y, 3, 1);
      ctx.rect(x, y - 1, 1, 3);
    } else ctx.rect(x, y, 1, 1);
  }
  ctx.globalAlpha = X.L.C * (1 - r(f, 0.4, 0.7));
  ctx.fillStyle = SPARK[X.night ? 1 : 0];
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Before the poof three sparkles wink on round the body, one after another.
function gather(X, p) {
  const top = X.tp.stool === 2 ? 26 : X.tp.stool ? 22 : 19,
    ctx = X.ctx;
  let any = false;
  for (let k = 0; k < 3; k++) {
    const t = (p - TW0 - 0.06 * k) / 0.1;
    if (t < 0 || t >= 1) continue;
    const x = X.x0 + Math.round((X.hash(k, 41) - 0.5) * 16),
      y = X.y0 - 3 - Math.round(X.hash(k, 42) * (top - 2)),
      w = t < 0.25 || t > 0.75 ? 0 : 1;
    if (!any) ctx.beginPath();
    any = true;
    ctx.rect(x - w, y, 1 + 2 * w, 1);
    ctx.rect(x, y - w, 1, 1 + 2 * w);
  }
  if (!any) return;
  ctx.globalAlpha = X.L.C;
  ctx.fillStyle = SPARK[X.night ? 1 : 0];
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Sound arcs off the full throat sac: two little brackets on the side the frog faces.
function croakArcs(X, px, py, s, k) {
  const ctx = X.ctx;
  ctx.beginPath();
  for (let j = 0; j < 1 + k; j++) {
    const x = px + s * (11 + 3 * j),
      y = py - 7 - j,
      h = 3 + 2 * j;
    ctx.rect(x, y - h / 2 - 1, 1, 1);
    ctx.rect(x + s, y - h / 2, 1, h);
    ctx.rect(x, y + h / 2, 1, 1);
  }
  ctx.globalAlpha = 0.9 * X.L.C;
  // white is lost on snow
  ctx.fillStyle = X.night ? '#dfe8f0' : X.snow > 0 && outdoors(X.tx0, X.ty0) ? '#3d7a4f' : '#ffffff';
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Dust thrown out both sides of the feet at a touchdown, age s after it.
function dust(X, px, py, age, tx, ty) {
  if (age < 0 || age >= DUST) return;
  const f = age / DUST,
    w = 4 + Math.round(5 * out2(f));
  addPuff(px - w, py - 1 - Math.round(2 * f), f < 0.5 ? 2 : 1, f < 0.6 ? 0 : 1);
  addPuff(px + w, py - 1 - Math.round(2 * f), f < 0.5 ? 2 : 1, f < 0.6 ? 0 : 1);
  if (!X.lite) {
    addPuff(px - w - 3, py - Math.round(3 * f), 1, 1);
    addPuff(px + w + 3, py - Math.round(3 * f), 1, 1);
  }
  flushPuffs(X.ctx, dustPal(X, tx, ty), X.L.C, 2);
}

// The hops: their count and height for the seen route and the trip's seconds, cached per route array (re-aim gives a
// new one and retimes the trip).
const HOPS = new WeakMap();
function hopsOf(X) {
  const pts = X.tp && X.tp.route,
    secs = X.L.d[1];
  let c = pts && HOPS.get(pts);
  if (c && c.start === X.start && c.secs === secs) return c;
  let len = 0;
  if (pts)
    for (let k = X.start + 1; k < pts.length; k++)
      len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  else len = Math.hypot(X.tx1 - X.tx0, X.ty1 - X.ty0);
  c = hopCount(len, secs);
  c.start = X.start;
  c.secs = secs;
  if (pts) HOPS.set(pts, c);
  return c;
}
// A hop about every HOP seconds of trip, so the rhythm stays a frog's, but none over HOPMAX; longer hops arc higher.
function hopCount(len, secs) {
  const n = Math.max(3, Math.min(14, Math.max(Math.round(secs / HOP), Math.ceil(len / HOPMAX))));
  return { n, h: Math.max(8, Math.min(26, Math.round((len / n) * 6))) };
}
// Where the frog is at trip fraction t of n hops: k the hop, p the route fraction, up 0-1 of the hop's height, pose,
// and land the hop fraction since the last touchdown (-1 before the first).
function hopAt(t, n, out) {
  const g = clamp(t) * n,
    k = Math.min(n - 1, Math.floor(g)),
    f = g - k;
  out.k = k;
  if (f < GH || f > 1 - GH) {
    const after = f > 1 - GH;
    out.p = (k + (after ? 1 : 0)) / n;
    out.up = 0;
    out.pose = CROUCHED;
    out.land = after ? f - (1 - GH) : k > 0 ? f + GH : -1;
    return out;
  }
  const q = (f - GH) / (1 - 2 * GH);
  // level speed in the air keeps the drawn frog within GH of a hop of its trip item's sort point
  out.p = (k + q) / n;
  out.up = 4 * q * (1 - q);
  out.pose = q > 0.08 && q < 0.94 ? LEAP : CROUCHED;
  out.land = -1;
  return out;
}
const H = { k: 0, p: 0, up: 0, pose: 0, land: -1 },
  Q = [0, 0, 0, 0, false],
  Q2 = [0, 0, 0, 0, false];
// Screen side hop k of n heads to: 1 right, -1 left (the landing's way when it goes straight up or down).
function sideOf(X, k, n) {
  X.route(k / n, Q2);
  const x0 = Q2[0];
  X.route((k + 1) / n, Q2);
  return Q2[0] > x0 ? 1 : Q2[0] < x0 ? -1 : X.dir1[0] >= 0 ? 1 : -1;
}

function depPerson(X) {
  const L = X.L,
    p = L.v / DEP,
    tp = X.tp;
  if (p < SWAP0) {
    if (tp.stool && p < 0.12) {
      X.body({ pose: tp.stool === 2 ? 'sitHigh' : 'sit', front: X.a.dirFront });
      return;
    }
    // tensing up for the poof
    const k = ease(r(p, 0.18, POOF0));
    X.body({ pose: 'stand', sx: 1 + 0.08 * k, sy: 1 - 0.1 * k });
    return;
  }
  const c = hopsOf(X),
    s0 = sideOf(X, 0, c.n),
    q = r(p, CROAK0, CROAK1);
  let pose = SIT;
  if (p >= CROUCH) pose = CROUCHED;
  else if (q > 0 && q < 1) pose = q < 0.15 || q > 0.8 ? SAC1 : SAC2;
  frog(X, X.x0, X.y0, 0, pose, p >= CROUCH ? s0 : X.dir0[0] >= 0 ? 1 : -1, X.L.C);
}
function arrPerson(X) {
  const q = r(X.L.v, ARR, REL);
  if (q < SWAP1) {
    const n = hopsOf(X).n;
    frog(X, X.x1, X.y1, 0, q < 0.06 ? CROUCHED : SIT, sideOf(X, n - 1, n), 1);
    return;
  }
  // pops out arms up with a little stretch, then settles
  const g = r(q, SWAP1, 0.36),
    st = g < 1 ? 0.14 * Math.sin(Math.PI * g) : 0;
  X.body({ pose: q < UP1 ? 'up' : 'stand', front: q < UP1 ? true : undefined, sy: 1 + st, sx: 1 - st / 2 });
}
// The hiccup: a little croak bubble floats up off the head of the person standing at (fx, fy) and pops.
function hiccup(X, fx, fy) {
  const L = X.L,
    t = L.v < REL ? r(L.v, ARR, REL) : 1 + r(L.v, REL, T.END);
  if (t < HIC || t >= 1.6) return;
  const f = (t - HIC) / 0.9,
    ctx = X.ctx,
    x = fx + 5,
    y = fy - 18 - Math.round(9 * out2(Math.min(1, f / 0.75)));
  ctx.beginPath();
  if (f < 0.75) {
    ctx.rect(x - 1, y - 2, 3, 1);
    ctx.rect(x - 1, y + 2, 3, 1);
    ctx.rect(x - 2, y - 1, 1, 3);
    ctx.rect(x + 2, y - 1, 1, 3);
  } else for (let k = 0; k < 4; k++) ctx.rect(x + (k & 1 ? 3 : -3), y + (k & 2 ? 3 : -3), 1, 1);
  ctx.globalAlpha = L.C * (f < 0.75 ? 0.9 : 0.6);
  ctx.fillStyle = X.night ? '#9fdc86' : '#5fbf4a';
  ctx.fill();
  if (f < 0.75) {
    ctx.beginPath();
    ctx.rect(x - 1, y - 1, 1, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// Real seconds since core time c (both in the same run of segments).
const since = (L, c) => TeleportLogic.real(L.v, L.d) - TeleportLogic.real(c, L.d);

export const STYLE = {
  need(X) {
    const L = X.L;
    if (L.q) return 0;
    let n = 0;
    if (!L.sw) n |= Kit.PART.S0;
    if (L.trip >= 0 || (L.hide && L.v >= L_IN && L.v < DEP)) n |= Kit.PART.TRIP;
    if (L.sw && L.v >= ARR) n |= Kit.PART.S1;
    return n;
  },
  stand(X, end) {
    const L = X.L;
    if (end) {
      const c = hopsOf(X);
      dust(X, X.x1, X.y1, since(L, ARR) + GH * (L.d[1] / c.n), X.tx1, X.ty1);
      cloud(X, X.x1, X.y1, X.tx1, X.ty1, since(L, ARR + POOF1 * (REL - ARR)), X.lite);
      if (!X.lite && L.v < REL) hiccup(X, X.x1, X.y1);
      return;
    }
    const p = L.v / DEP;
    if (!X.lite && p < POOF0) gather(X, p);
    cloud(X, X.x0, X.y0, X.tx0, X.ty0, since(L, POOF0 * DEP), X.lite);
    const q = r(p, CROAK0, CROAK1);
    if (!X.lite && q > 0.15 && q < 0.8) croakArcs(X, X.x0, X.y0, X.dir0[0] >= 0 ? 1 : -1, q > 0.4 ? 1 : 0);
  },
  // The frog mid-route, with the dust of its last touchdown.
  trip(X) {
    const L = X.L;
    // a hidden start: the frog hops out of a poof where they come into view
    if (L.hide && L.v < ARR) cloud(X, X.x0, X.y0, X.tx0, X.ty0, since(L, DEP) + HIDE_POOF, X.lite);
    if (L.trip < 0 || L.trip >= 1) return;
    const c = hopsOf(X);
    hopAt(L.trip, c.n, H);
    X.route(H.p, Q);
    const s = sideOf(X, H.k, c.n),
      a = L.C * (L.hide ? 0.3 + 0.7 * r(L.trip, 0, 0.05) : 1);
    if (H.land >= 0) dust(X, Q[0], Q[1], (H.land * L.d[1]) / c.n, Q[2], Q[3]);
    frog(X, Q[0], Q[1], H.up * c.h, H.pose, s, a);
  },
  // One body pass a frame: the person until the poof, the frog at either end, nothing while the trip item hops.
  person(X) {
    const L = X.L,
      a = X.a;
    if (L.q) return false;
    if (L.v >= REL) {
      // the hiccup follows the head as they walk on
      if (!X.lite && !L.cut && !a.seated) {
        const f = Kit.feet(a.x, a.y);
        hiccup(X, f[0], f[1]);
      }
      return false;
    }
    if ((L.hide && !L.sw) || (L.trip >= 0 && L.trip < 1)) return true;
    if (!L.sw) depPerson(X);
    else arrPerson(X);
    return true;
  },
  marks: [],
  gap: null,
};
// Exposed for tests.
export const FROG = { hopAt, hopCount, SPR, FW, FH, GH, SWAP0, SWAP1, CLOUD, POOF0, POOF1 };
