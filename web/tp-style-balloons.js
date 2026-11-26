// balloons: they blow up a bunch of party balloons one by one, swing the bunch overhead, rise onto their toes and
// float up off the floor, drift over the island swaying in the wind, then sink over the desk where the balloons pop
// one after another and they plop down in a puff, the rubber scraps fluttering to the floor and fading.
// The body and its bunch are one picture: person() draws it at the walker's depth at both ends, trip() in flight and
// for a hidden start. ground() reports the feet's real height, so take-off and touchdown sort with the furniture.
// Pops and falling scraps are a stand item at the landing; puffs, feet shadows and settled scraps floor items.
// One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { TH, TW, outdoors } from './office-scene.js';

const { atlas, bake, clamp, r, out2, in2, ease, lerp, line } = Kit;
const { DEP, ARR, T } = TeleportLogic;
const { RELEASE: REL, END, L_IN, SQUEEZE } = T,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  fd = p => REL + p * (END - REL), // a fade fraction
  B = {
    EACH: at(0.08), // balloon i starts to fill at i * EACH ...
    GROW: at(0.12), // ... and is full this much later
    GRIP: at(0.5), // the bunch swings overhead ...
    HOLD: at(0.58), // ... and is gripped with both hands
    LIFT: at(0.64), // the feet leave the floor
    PUFF: at(0.3), // how long a puff lasts
    LOW: ar(0.14), // sunk to a hover over the landing
    POP: ar(0.18), // the first pop ...
    GAP: ar(0.065) - ARR, // ... and the next ones
    BURST: 0.06, // core: how long a pop's burst shows
    FLOOR: ar(0.56), // the plop
    SQUASH: ar(0.1) - ARR,
    FALL: 0.3, // core: a scrap's flutter down to the floor
    LIE: fd(0.62), // the scraps on the floor fade from here ...
    OUT: fd(0.94), // ... to nothing
  },
  N = 5, // balloons
  LIFT = 10, // px the feet are off the floor at take-off
  ARRH = 17, // ... as they come in over the landing
  HOVER = 15, // ... once sunk, before the first pop (one px less after each)
  KH = 19, // px from the feet to the right hand overhead, where the strings meet
  KX = 5, // ... and from the feet across to it
  MEANDER = 0.7; // tiles the drift weaves off the straight line

// The bunch round the knot, back to front: centre offsets in px. Colours by index; which one pops k-th.
const SLOT = [
    [-4, -30],
    [-12, -25],
    [3, -25],
    [-8, -19],
    [0, -18],
  ],
  SIDE = [12, -4], // the bunch's shift while held at the side
  ORDER = [3, 0, 4, 2, 1],
  RANK = ORDER.map((_, i) => ORDER.indexOf(i));
// Rim, body, shade, light, shine: the island's party colours (the done confetti).
const HUES = [
  ['#a8731c', '#ffd166', '#e5a93e', '#fff0b8'],
  ['#8e1f2c', '#e5484d', '#bf3540', '#ff9a96'],
  ['#1b4a7a', '#3e8ed0', '#2f70ad', '#9fd0f5'],
  ['#1f5e2c', '#46a758', '#378a46', '#9be0a6'],
  ['#8a1f4c', '#e93d82', '#c22d69', '#ff9cc6'],
];
const hex = (c, k) => parseInt(c.slice(1 + 2 * k, 3 + 2 * k), 16);
// Night: a little darker, the hue kept (a blue cast turns the yellow to mud) and the shine bright.
const dim = c => `rgb(${[0, 1, 2].map(k => Math.round(hex(c, k) * 0.8 + 6)).join(',')})`;
const SHINE = ['#ffffff', '#e4eaff'],
  STRING = ['#fbf7ee', '#b4bcd2', '#7d8496']; // day, night, snow (white would vanish on it)

// Size frames: half-axes of the oval (tiny, half full, full).
const SIZES = [
    [2, 3],
    [3, 4],
    [4, 5],
  ],
  CW = 9,
  CH = 13,
  AX = 4, // the centre's pixel in a cell
  AY = 5;
// One frame's raster: 1 rim, 2 body, 3 shade, 4 light, 5 shine; the knot under it in rim.
export function balloonPixels(s) {
  const [a, b] = SIZES[s],
    px = new Uint8Array(CW * CH),
    inside = (x, y) => (x * x) / ((a + 0.5) * (a + 0.5)) + (y * y) / ((b + 0.5) * (b + 0.5)) <= 1,
    set = (x, y, c) => (px[(AY + y) * CW + AX + x] = c);
  for (let y = -b; y <= b; y++)
    for (let x = -a; x <= a; x++) {
      if (!inside(x, y)) continue;
      const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      set(x, y, rim ? 1 : x / a + y / b > 0.7 ? 3 : 2);
    }
  const hx = -Math.ceil(a / 2),
    hy = -Math.ceil(b / 2);
  if (s) {
    set(hx, hy, 5);
    set(hx - 1, hy + 1, 4);
    if (s > 1) {
      set(hx, hy - 1, 4);
      set(hx + 1, hy - 1, 4);
      set(hx - 1, hy + 2, 4);
    }
  } else set(hx + 1, hy + 1, 4);
  set(0, b + 1, 1);
  if (s) {
    set(-1, b + 1, 1);
    set(1, b + 1, 1);
  }
  return px;
}
let sheet = null;
// Cells: columns by size within colour, rows day and night.
const sheetOf = () =>
  sheet ||
  (sheet = atlas(3 * N * CW, 2 * CH, g => {
    for (let l = 0; l < 2; l++)
      for (let i = 0; i < N; i++)
        for (let s = 0; s < 3; s++) {
          const pal = l ? HUES[i].map(dim) : HUES[i];
          bake(g, balloonPixels(s), CW, CH, (3 * i + s) * CW, c => (c === 5 ? SHINE[l] : pal[c - 1]), l * CH);
        }
  }));

const grip0 = stool => (stool ? SQUEEZE : B.GRIP),
  hold = stool => grip0(stool) + B.HOLD - B.GRIP,
  lift0 = stool => (stool ? SQUEEZE + at(0.12) : B.LIFT),
  seat = stool => (stool === 2 ? 9 : stool ? 4 : 0),
  popAt = k => B.POP + k * B.GAP,
  popped = v => Math.min(N, Math.max(0, Math.floor((v - B.POP) / B.GAP) + 1)),
  // Cruise height over the straight line (px) and the drift's weaves, from the current tp every frame.
  cruise = len => Math.min(80, Math.max(30, 16 + 2.4 * (len || 0))),
  waves = len => Math.min(3, Math.max(1, Math.round((len || 0) / 10))),
  // Up fast, a long float, down over the landing.
  bump = t => ease(r(t, 0, 0.35)) * (1 - ease(r(t, 0.7, 1)));
// Feet off the floor (px) at departure and arrival.
function feetUp(X, v) {
  if (v < ARR) return LIFT * ease(r(v, lift0(X.tp.stool), DEP));
  if (v < B.POP) return lerp(ARRH, HOVER, ease(r(v, ARR, B.LOW)));
  const k = popped(v);
  return k < N ? HOVER - k : (HOVER - N + 1) * (1 - in2(r(v, popAt(N - 1), B.FLOOR)));
}

// In flight (and a hidden start's float): ground point px and tiles, feet height, alpha, how far along.
const W = { x: 0, y: 0, gx: 0, gy: 0, h: 0, a: 1, t: 0 };
function where(X) {
  const L = X.L;
  if (L.trip < 0) {
    Object.assign(W, { x: X.x0, y: X.y0, gx: X.tx0, gy: X.ty0, h: LIFT, t: 0 });
    W.a = r(L.v, L_IN, DEP - 0.03) * L.C;
    return W;
  }
  const t = clamp(L.trip),
    e = ease(t),
    len = X.tp.len,
    dx = X.tx1 - X.tx0,
    dy = X.ty1 - X.ty0,
    d = Math.hypot(dx, dy) || 1,
    m = MEANDER * Math.sin(Math.PI * t) * Math.sin(2 * Math.PI * waves(len) * t),
    ox = (-dy / d) * m,
    oy = (dx / d) * m;
  W.gx = lerp(X.tx0, X.tx1, e) + ox;
  W.gy = lerp(X.ty0, X.ty1, e) + oy;
  W.x = Math.round(lerp(X.x0, X.x1, e) + (ox - oy) * TW);
  W.y = Math.round(lerp(X.y0, X.y1, e) + (ox + oy) * TH);
  W.h = lerp(LIFT, ARRH, t) + cruise(len) * bump(t) + 1.2 * Math.sin(X.L.secs * 4) * Math.sin(Math.PI * t);
  W.a = 1;
  W.t = t;
  return W;
}

// The picture this frame: body feet, pose, knot, bunch shift, lean, bob and which balloons are there (BL).
const P = { bx: 0, by: 0, up: false, sx: 1, sy: 1, a: 1, kx: 0, ky: 0, ox: 0, oy: 0, lean: 0, bob: 0 },
  BL = Array.from({ length: N }, () => ({ on: false, x: 0, y: 0, f: 2 }));
function balloons(X, v, grow) {
  const secs = X.L.secs;
  for (let i = 0; i < N; i++) {
    const q = BL[i],
      p = grow ? r(v, i * B.EACH, i * B.EACH + B.GROW) : 1,
      e = out2(p),
      s = SLOT[i];
    q.on = grow ? v >= i * B.EACH : v < ARR || v < popAt(RANK[i]);
    q.f = p < 0.34 ? 0 : p < 0.7 ? 1 : 2;
    q.x = Math.round(P.kx + (s[0] + P.ox + (P.lean * -s[1]) / 27) * e + P.bob * Math.sin(secs * 2.7 + i * 2.3));
    q.y = Math.round(P.ky + (s[1] + P.oy) * e + 1.3 * P.bob * Math.sin(secs * 4.1 + i * 1.9));
  }
}
function picture(X) {
  const L = X.L,
    v = L.v,
    stool = X.tp.stool;
  Object.assign(P, { sx: 1, sy: 1, a: 1, ox: 0, oy: 0, lean: 0, bob: 0 });
  if (L.trip >= 0 || (L.hide && !L.sw)) {
    const w = where(X),
      s = X.x1 >= X.x0 ? 1 : -1,
      k = Math.sin(Math.PI * w.t);
    P.bx = w.x + Math.round(1.6 * Math.sin(L.secs * 2.6) * k);
    P.by = w.y - Math.round(w.h);
    P.up = true;
    P.a = w.a;
    P.lean = s * (2.5 + 1.5 * Math.sin(L.secs * 1.7)) * k;
    P.bob = k;
    P.kx = w.x + KX;
    P.ky = P.by - KH;
    balloons(X, v, false);
    return P;
  }
  if (!L.sw) {
    const g = ease(r(v, grip0(stool), hold(stool))),
      tug = Math.sin(Math.PI * r(v, hold(stool), lift0(stool))), // up on their toes as the bunch pulls
      sit = v < SQUEEZE ? seat(stool) : 0;
    P.bx = X.x0;
    P.by = X.y0 - Math.round(feetUp(X, v) + tug);
    P.up = g >= 0.5;
    P.kx = Math.round(lerp(X.x0 + 4, P.bx + KX, g));
    P.ky = Math.round(lerp(X.y0 - sit - 6, P.by - KH, g));
    P.ox = SIDE[0] * (1 - g);
    P.oy = SIDE[1] * (1 - g);
    P.bob = 1 - r(v, grip0(stool), hold(stool));
    balloons(X, v, true);
    return P;
  }
  const sq = Math.sin(Math.PI * r(v, B.FLOOR, B.FLOOR + B.SQUASH));
  P.bx = X.x1;
  P.by = X.y1 - Math.round(feetUp(X, v));
  P.up = v < B.FLOOR;
  P.sx = 1 + 0.2 * sq;
  P.sy = 1 - 0.2 * sq;
  P.kx = P.bx + KX;
  P.ky = P.by - KH;
  P.bob = r(v, ARR, B.LOW);
  balloons(X, v, false);
  return P;
}

// Strings from each knot down to the hand: 1 px runs, one fill.
function strings(X, p) {
  const ctx = X.ctx,
    put = (x, y) => ctx.rect(x, y, 1, 1);
  let any = false;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const q = BL[i];
    if (!q.on || q.y + SIZES[q.f][1] + 2 >= p.ky) continue;
    line(p.kx, p.ky, q.x, q.y + SIZES[q.f][1] + 2, put);
    any = true;
  }
  if (!any) return;
  ctx.fillStyle = STRING[X.snow > 0 ? 2 : X.night ? 1 : 0];
  ctx.fill();
}
function bunch(X, p) {
  const img = sheetOf(),
    l = X.night ? 1 : 0;
  for (let i = 0; i < N; i++) {
    const q = BL[i];
    if (q.on) X.stamp(img, (3 * i + q.f) * CW, l * CH, CW, CH, q.x - AX, q.y - AY, CW, CH);
  }
}
const O = { pose: 'up', front: true, sx: 1, sy: 1, alpha: 1 },
  STAND = { pose: 'stand', front: true };
// Body, strings, balloons: one picture at one depth.
function draw(X, p) {
  const ctx = X.ctx,
    a = p.a * X.L.C;
  if (a <= 0.01) return;
  O.pose = p.up ? 'up' : 'stand';
  O.sx = p.sx;
  O.sy = p.sy;
  O.alpha = Math.min(1, p.a);
  X.bodyAt(p.bx, p.by, O);
  ctx.globalAlpha = Math.min(1, a);
  strings(X, p);
  bunch(X, p);
  ctx.globalAlpha = 1;
}
// Wind blowing past the bunch in flight, the way they drift: three dashes with a curl, one fill.
function wind(X, p) {
  const L = X.L,
    k = Math.sin(Math.PI * clamp(L.trip)),
    s = X.x1 >= X.x0 ? 1 : -1,
    ctx = X.ctx;
  if (X.lite || L.trip < 0 || k < 0.2) return;
  ctx.beginPath();
  for (let j = 0; j < 3; j++) {
    const f = (((L.secs * 1.3 + j / 3) % 1) + 1) % 1,
      n = Math.round(10 * Math.sin(Math.PI * f)),
      x = Math.round(p.kx + s * (-34 + 68 * f)),
      y = p.ky - 30 + 13 * j + (j === 1 ? 4 : 0);
    if (n < 2) continue;
    ctx.rect(s > 0 ? x - n : x, y, n, 1);
    ctx.rect(s > 0 ? x : x - 1, y - 1, 1, 1);
  }
  ctx.globalAlpha = 0.85 * clamp(2 * k - 0.4);
  ctx.fillStyle = X.night ? '#b9c7e6' : '#ffffff';
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Where balloon i was when it popped (the hover over the landing, no bob).
function popPos(X, i, out) {
  const s = SLOT[i];
  out[0] = X.x1 + KX + s[0];
  out[1] = X.y1 - Math.round(feetUp(X, popAt(RANK[i]))) - KH + s[1];
  return out;
}
const PP = [0, 0],
  RAYS = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
// A pop: a white flash, then a ring of short rays in the balloon's colour flying apart.
function burst(X, i, p) {
  const ctx = X.ctx,
    [cx, cy] = popPos(X, i, PP),
    d = Math.round(3 + 6 * out2(p));
  if (p < 0.35) {
    ctx.beginPath();
    ctx.rect(cx - 1, cy - 2, 3, 5);
    ctx.rect(cx - 2, cy - 1, 5, 3);
    ctx.fillStyle = SHINE[X.night ? 1 : 0];
    ctx.fill();
  }
  ctx.beginPath();
  for (const [ux, uy] of RAYS) {
    const x = cx + ux * d,
      y = cy + uy * d;
    if (ux && uy) {
      ctx.rect(x, y, 1, 1);
      ctx.rect(x - ux, y - uy, 1, 1);
    } else ctx.rect(ux ? Math.min(x, x - ux) : x, uy ? Math.min(y, y - uy) : y, ux ? 2 : 1, uy ? 2 : 1);
  }
  ctx.globalAlpha = 1 - in2(p);
  ctx.fillStyle = HUES[i][1];
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Rubber scraps of each popped balloon: flying (stand item) or settled on the floor (floor item), one fill a colour.
function scraps(X, settled) {
  const v = X.L.v,
    ctx = X.ctx,
    m = X.lite ? 1 : 3;
  if (settled) ctx.globalAlpha = 1 - r(v, B.LIE, B.OUT);
  for (let i = 0; i < N; i++) {
    const t0 = popAt(RANK[i]);
    if (v < t0) continue;
    const [sx, sy] = popPos(X, i, PP);
    let any = false;
    for (let j = 0; j < m; j++) {
      const tt = r(v, t0, t0 + B.FALL + 0.04 * j),
        ex = X.x1 + Math.round((X.hash(3 * i + j, 11) - 0.5) * 30),
        ey = X.y1 + Math.round(X.hash(3 * i + j, 12) * 5) - 2;
      if (settled !== tt >= 1) continue;
      if (!any) ctx.beginPath();
      any = true;
      if (settled) {
        ctx.rect(ex, ey, 2, 1);
        continue;
      }
      const x = Math.round(lerp(sx, ex, out2(tt))),
        y = Math.round(lerp(sy, ey, in2(tt)) - 7 * Math.sin(Math.PI * Math.min(1, 2 * tt)) * (1 - tt)),
        w = (Math.floor(X.L.secs * 12) + j) % 2;
      ctx.rect(x, y, w ? 2 : 1, w ? 1 : 2);
    }
    if (!any) continue;
    ctx.fillStyle = HUES[i][X.night ? 0 : 1];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// Dust kicked up at an end on take-off or the plop: tufts spreading over an ellipse, lit on top.
const DUST = [
  ['#d9cfbb', '#fbf6ea'],
  ['#8f897e', '#c9c2b4'],
  ['#8496ad', '#b9c7d8'],
];
function puff(X, end, p) {
  if (p <= 0 || p >= 1) return;
  const ctx = X.ctx,
    fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0,
    snowy = X.snow > 0 && (end ? outdoors(X.tx1, X.ty1) : outdoors(X.tx0, X.ty0)),
    col = DUST[snowy ? 2 : X.night ? 1 : 0],
    n = X.lite ? 5 : 8,
    d = 4 + 9 * out2(p),
    lift = Math.round(3 * p);
  ctx.globalAlpha = 0.9 * (1 - in2(p)) * X.L.C;
  for (let l = 0; l < 2; l++) {
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * 2 * Math.PI + X.hash(k, 5),
        x = Math.round(fx + d * Math.cos(ang)) - 1,
        y = Math.round(fy + 0.5 * d * Math.sin(ang)) - 1 - lift;
      if (l) ctx.rect(x, y - 1, 2, 1);
      else ctx.rect(x - 1, y - 1, 4, 3);
    }
    ctx.fillStyle = col[l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// The feet's shadow while the remapped body (which has none) is drawn: fainter as they rise, whole in a cut.
function feetShadow(X, end, up) {
  Kit.shadow(X.ctx, end ? X.x1 : X.x0, end ? X.y1 : X.y0, 10 - up / 3, 0.9 - up / 30);
}

const PART = Kit.PART;
export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v,
      stool = X.tp.stool;
    if (L.q) return L.hide ? 0 : PART.S0;
    if (v >= B.OUT || (L.hide && !L.sw && v < L_IN)) return 0;
    let n = 0;
    if (L.trip >= 0 || (L.hide && !L.sw)) n |= PART.TRIP | PART.SHADOW;
    if (!L.hide && v >= grip0(stool) && v < Math.max(DEP, lift0(stool) + B.PUFF)) n |= PART.F0;
    if (L.sw && v >= ARR) n |= PART.F1 | (v >= B.POP ? PART.S1 : 0);
    return n;
  },
  floor(X, end) {
    const v = X.L.v;
    if (!end) {
      if (!X.L.sw) feetShadow(X, 0, feetUp(X, v));
      puff(X, 0, r(v, lift0(X.tp.stool), lift0(X.tp.stool) + B.PUFF));
      return;
    }
    if (v < REL) feetShadow(X, 1, feetUp(X, v));
    puff(X, 1, r(v, B.FLOOR, B.FLOOR + B.PUFF));
    scraps(X, true);
  },
  stand(X, end) {
    const v = X.L.v;
    if (!end) {
      // queued: the first balloon, still flat, in their hand
      const sit = seat(X.tp.stool),
        y = X.y0 - sit - 6 + Math.round(Math.sin(X.L.secs * 3));
      X.stamp(sheetOf(), 0, (X.night ? 1 : 0) * CH, CW, CH, X.x0 + 4 - AX, y - AY, CW, CH);
      return;
    }
    for (let i = 0; i < N; i++) {
      const p = r(v, popAt(RANK[i]), popAt(RANK[i]) + B.BURST);
      if (p > 0 && p < 1) burst(X, i, p);
    }
    scraps(X, false);
  },
  trip(X) {
    const p = picture(X);
    draw(X, p);
    wind(X, p);
  },
  // The ground point under the feet and their real height: low at both ends, so it sorts with the furniture there.
  ground(X, out) {
    const w = where(X);
    out[0] = w.gx;
    out[1] = w.gy;
    out[2] = w.h;
    if (X.L.hide && !X.L.sw) out[3] = w.a; // the shadow fades in with them
    return true;
  },
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || (L.sw && v >= REL)) return false;
    if (L.trip >= 0 || (L.hide && !L.sw)) return true;
    if (!L.sw && v < grip0(X.tp.stool)) {
      X.body(X.tp.stool ? {} : STAND);
      const p = picture(X);
      X.ctx.globalAlpha = L.C;
      strings(X, p);
      bunch(X, p);
      X.ctx.globalAlpha = 1;
      return true;
    }
    if (!L.sw || v >= ARR) draw(X, picture(X));
    return true;
  },
  marks: [],
  gap: null,
};
// Exposed for tests.
export const BALLOONS = {
  B,
  N,
  LIFT,
  ARRH,
  HOVER,
  KH,
  KX,
  ORDER,
  grip0,
  hold,
  lift0,
  popAt,
  popped,
  cruise,
  feetUp,
  where,
  picture,
  shown: () => BL.filter(q => q.on).length,
  need: STYLE.need,
};
