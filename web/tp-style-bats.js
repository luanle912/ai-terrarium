// bats (Halloween): a dusk shadow climbs the person from the feet up until only a dark silhouette stands; it
// shivers, then comes apart into bats from the head down in a puff of purple smoke. The swarm darts erratically over
// the island and whirls down at the landing, where the bats dive in one by one and the silhouette knits back
// together. Two red eyes open in it and blink once, then the colour floods back. One bat stays out (it circled a
// queued person) and flaps off.
// One body pass a frame at the ends, from person(): the body, or its capture drawn as coloured or dark shards.
// The swarm and the smoke ride the trip item in every phase: with the furniture at the ends, the overlay in flight.
import { Kit } from './tp-kit.js';
import { TpPerson } from './tp-person.js';
import { TeleportLogic } from './teleport-logic.js';

const { atlas, bake, clamp, r, out2, in2, ease, lerp, frac } = Kit;
const { DEP, ARR } = TeleportLogic;
const REL = TeleportLogic.T.RELEASE,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  B = {
    SH0: at(0.08), // the shadow climbs from the feet
    SH1: at(0.4), // to the top of the head
    BURST: at(0.5), // after a shiver, bats lift off the silhouette from the head
    B1: at(0.72), // down to the feet
    FLY: at(0.25), // core: a bat's flight from the body to the swarm
    G0: ar(0.14), // landers dive in from here
    G1: ar(0.46), // the silhouette is whole
    DIVE: ar(0.12) - ARR, // core: one bat's dive
    EYE: ar(0.5), // red eyes open
    SHUT: [ar(0.62), ar(0.69)], // and blink once
    COL: [ar(0.76), ar(0.94)], // then the colour floods back
  },
  N = 10, // bats in the swarm
  WAIT = N - 1, // the one circling a queued person; it never goes in and flaps off after the release
  LAND = N - 1,
  LAG = 0.22, // trip: the last bat leaves this much later
  HOV = 30, // px from the feet up to the swarm's centre at an end
  TALL = 21, // px from the feet to the top of a standing head
  EYES = [-2, 1], // px from the feet x of the eyes, 15 px up (office-people.js face)
  DARK = ['#2a1f36', '#1c1427'], // day, night: the silhouette
  RIM = ['#6b5591', '#a58bd3'], // its moonlit top edge
  RED = '#ff2b2b',
  GLOW = 'rgba(255,48,48,0.35)',
  SMOKE = [
    ['#8a70a8', '#c2b0dc'],
    ['#5f4b85', '#9c86c8'],
  ];

const stoolLift = stool => (stool === 2 ? 9 : stool ? 4 : 0);

// The atlas: per palette (day, night) a row of three wing frames: up, level, down. W wing, b body, e eye.
const BW = 11,
  BH = 6,
  FRAMES = [
    ['W.........W', 'WW.......WW', '.WW.b.b.WW.', '..WWebeWW..', '...WbbbW...', '.....b.....'],
    ['...........', '....b.b....', '.WW.ebe.WW.', 'WWWWbbbWWWW', 'W.W.WbW.W.W', '...........'],
    ['...........', '....b.b....', '....ebe....', '..WWbbbWW..', '.WWWWbWWWW.', 'WW.W...W.WW'],
  ],
  // wing, body, eye, rim (a lit top edge, so a bat reads on dark grass at night)
  PAL = [
    ['#3d2b52', '#22182d', '#ffd23f', '#6e5690'],
    ['#4e3d70', '#2e2244', '#ffe066', '#b9a2e6'],
  ];
function raster(rows) {
  const px = new Uint8Array(BW * BH);
  rows.forEach((row, y) => {
    for (let x = 0; x < BW; x++) {
      const c = row[x];
      if (c === '.') continue;
      const up = y > 0 && rows[y - 1][x] !== '.';
      px[y * BW + x] = c === 'e' ? 3 : !up ? 4 : c === 'W' ? 1 : 2;
    }
  });
  return px;
}
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = atlas(3 * (BW + 1), 2 * (BH + 1), g =>
    PAL.forEach((cols, n) =>
      FRAMES.forEach((rows, f) => bake(g, raster(rows), BW, BH, f * (BW + 1), c => cols[c - 1], n * (BH + 1))),
    ),
  ));

// One bat centred at (x, y), flapping on its own beat.
function bat(X, j, x, y, a) {
  if (a <= 0.01) return;
  const ph = X.hash(j, 4),
    f = [0, 1, 2, 1][Math.floor(frac(X.L.secs * (8 + 4 * ph) + ph) * 4)];
  X.ctx.globalAlpha = a;
  X.stamp(sheetOf(), f * (BW + 1), X.night ? BH + 1 : 0, BW, BH, Math.round(x) - 5, Math.round(y) - 3, BW, BH);
  X.ctx.globalAlpha = 1;
}
// Bat j's erratic place round a swarm centre: it darts between random points about four times a second.
function dart(X, j, cx, cy, spread, out) {
  const step = X.L.secs * (3 + 2 * X.hash(j, 5)) + X.hash(j, 6) * 7,
    k = Math.floor(step),
    e = ease(frac(step)),
    rx = 18 * spread,
    ry = 9 * spread,
    px = q => (X.hash(j * 97 + q, 21) - 0.5) * 2,
    py = q => (X.hash(j * 97 + q, 22) - 0.5) * 2;
  out[0] = cx + lerp(px(k), px(k + 1), e) * rx;
  out[1] = cy + lerp(py(k), py(k + 1), e) * ry + Math.sin(X.L.secs * 9 + 7 * X.hash(j, 7)) * 1.2;
  return out;
}
// Bat j's spot on the body, from the feet: x within the body, y at a height share of a `top` px body.
function home(X, j, share, top, fx, fy, out) {
  out[0] = fx + Math.round((X.hash(j, 12) - 0.5) * (share > 0.75 ? 4 : 7));
  out[1] = fy - Math.round(share * (top - 3)) - 2;
  return out;
}
// The flight: e along the chord, an arc px high, higher on a longer trip (read tp.len every frame: re-aim retimes it).
function sail(p, len) {
  const e = ease(clamp(p)),
    H = Math.min(40, Math.max(10, 4 + 1.2 * (len || 0)));
  return { e, h: 4 * H * e * (1 - e) };
}
const tripOf = (X, j, p) => clamp(p * (1 + LAG) - LAG * X.hash(j, 2));
// Leaving: head first; landing: feet first.
const spotOf = j => 1 - j / (LAND - 1);
const birthOf = j => B.BURST + (j / (LAND - 1)) * (B.B1 - B.BURST);
const landOf = j => B.G0 + B.DIVE + (j / (LAND - 1)) * (B.G1 - B.G0 - B.DIVE);

const P = [0, 0, 1],
  O = [0, 0],
  Hm = [0, 0];
// Where bat j is this frame: P = [x, y, alpha], or null while it is inside the body.
function where(X, j) {
  const L = X.L,
    v = L.v,
    tp = X.tp,
    lift = stoolLift(tp.stool);
  if (L.trip >= 0) {
    const g = sail(tripOf(X, j, L.trip), tp.len);
    dart(
      X,
      j,
      lerp(X.x0, X.x1, g.e),
      lerp(X.y0 - HOV - lift * (1 - g.e), X.y1 - HOV, g.e) - g.h,
      1 + 0.5 * Math.sin(3.14 * g.e),
      P,
    );
    P[2] = L.hide ? 0.3 + 0.7 * r(L.trip, 0, 0.15) : 1;
    return P;
  }
  if (v < ARR) {
    const tb = j === WAIT ? 0 : birthOf(j);
    if (v < tb) return null;
    const s = j === WAIT ? 1 : out2(r(v, tb, tb + B.FLY));
    home(X, j, spotOf(j), TALL + lift, X.x0, X.y0, Hm);
    dart(X, j, X.x0, X.y0 - HOV - lift, j === WAIT ? 0.5 + 0.5 * r(v, 0, DEP) : 1, O);
    P[0] = lerp(Hm[0], O[0], s);
    P[1] = lerp(Hm[1], O[1], s);
    P[2] = 1;
    return P;
  }
  if (j < LAND) {
    const tl = landOf(j);
    if (v >= tl) return null;
    const s = in2(r(v, tl - B.DIVE, tl));
    home(X, j, 1 - spotOf(j), TALL, X.x1, X.y1, Hm);
    dart(X, j, X.x1, X.y1 - HOV + 6 * r(v, ARR, B.G1), 1 - 0.45 * r(v, ARR, B.G1), O);
    P[0] = lerp(O[0], Hm[0], s);
    P[1] = lerp(O[1], Hm[1], s);
    P[2] = 1;
    return P;
  }
  // the one left out circles the head, then flaps up and away
  dart(X, j, X.x1, X.y1 - HOV, 0.7, P);
  P[2] = 1;
  if (L.fade >= 0) {
    const f = in2(L.fade);
    P[0] += (X.hash(j, 13) < 0.5 ? -1 : 1) * 40 * f;
    P[1] -= 60 * f;
    P[2] = 1 - r(L.fade, 0.6, 1);
  }
  return P;
}

// Purple smoke: n puffs blown out from (cx, cy) over p 0-1; two fills.
function smoke(X, cx, cy, p, a, spread) {
  if (p <= 0 || p >= 1 || a <= 0.01) return;
  const ctx = X.ctx,
    tones = SMOKE[X.night ? 1 : 0],
    n = 10,
    rad = spread * (0.35 + 0.65 * out2(p)),
    s = p < 0.4 ? 2 : p < 0.75 ? 1 : 0; // a round puff shrinking to a pixel
  for (let t = 0; t < 2; t++) {
    ctx.beginPath();
    for (let k = t; k < n; k += 2) {
      const th = (6.283 * k) / n + X.hash(k, 30),
        rr = rad * (0.7 + 0.5 * X.hash(k, 31)),
        x = Math.round(cx + Math.cos(th) * rr),
        y = Math.round(cy + Math.sin(th) * rr * 0.55 - 5 * p);
      ctx.rect(x - s, y - s + 1, 2 * s + 1, 2 * s - 1 || 1);
      if (s) ctx.rect(x - s + 1, y - s, 2 * s - 1, 2 * s + 1);
    }
    ctx.globalAlpha = a * (1 - p) * (t ? 0.9 : 0.75);
    ctx.fillStyle = tones[t];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// The captured body as shards: rows in [top, bot) only, in one colour (col) or its own, moved dx, dy px.
const CAP = TpPerson.newCapture();
function shards(X, cap, col, a, top, bot, dx, dy) {
  if (a <= 0.01) return;
  const ctx = X.ctx,
    cols = col ? 1 : cap.cols.length;
  ctx.globalAlpha = a;
  for (let c = 0; c < cols; c++) {
    let any = false;
    for (let k = 0; k < cap.n; k++) {
      if (!col && cap.c[k] !== c) continue;
      const y0 = Math.max(cap.y[k], top),
        y1 = Math.min(cap.y[k] + cap.h[k], bot);
      if (y1 <= y0) continue;
      if (!any) {
        ctx.beginPath();
        any = true;
      }
      ctx.rect(cap.x[k] + dx, y0 + dy, cap.w[k], y1 - y0);
    }
    if (any) {
      ctx.fillStyle = col || cap.cols[c];
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
// The dark silhouette, rows [top, bot), with a lit top edge while it is solid.
function silhouette(X, cap, a, top, bot, dx) {
  const n = X.night ? 1 : 0;
  if (a >= 1) shards(X, cap, RIM[n], a, top, bot, dx, -1);
  shards(X, cap, DARK[n], a, top, bot, dx, 0);
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
const POSE = [{}, { pose: 'sit' }, { pose: 'sitHigh' }],
  FRONT = { pose: 'stand', front: true },
  OWN = { pose: 'stand' };
// The departure: the shadow climbs from the feet, the silhouette stirs, then bats lift off it from the head down.
function leave(X, v) {
  const tp = X.tp,
    o = POSE[tp.stool === 2 ? 2 : tp.stool ? 1 : 0],
    top = TALL + stoolLift(tp.stool);
  if (v < B.SH0) return X.body(o);
  const cap = X.capture(o, CAP),
    fy = X.y0;
  if (v < B.SH1) {
    const line = Math.round(fy - (top + 2) * ease(r(v, B.SH0, B.SH1)));
    if (!tp.stool) shadowAt(X, X.x0, fy, 1);
    shards(X, cap, null, 1, -1e4, line, 0, 0);
    silhouette(X, cap, 1, line, 1e4, 0);
    return;
  }
  // a shiver before the bats go, then the cut line falls with them
  const shake = v < B.BURST ? (Math.floor(X.L.secs * 24) % 2 ? 1 : -1) * (X.lite ? 0 : 1) : 0,
    gone = r(v, B.BURST, B.B1),
    line = Math.round(fy - (top + 3) * (1 - gone));
  if (!tp.stool) shadowAt(X, X.x0, fy, 1 - gone);
  silhouette(X, cap, 1, line, 1e4, shake);
}
// The landing: the silhouette is built from the feet as the bats dive in, the eyes blink, the colour comes back.
function gather(X, v) {
  if (v >= B.COL[1]) return X.body(OWN);
  // they face us for the eyes; one who faces away turns back while still dark, not as the colour returns
  const away = v >= B.COL[0] && !X.a.dirFront,
    cap = X.capture(away ? OWN : FRONT, CAP),
    fx = X.x1,
    fy = X.y1,
    built = r(v, B.G0 + B.DIVE, B.G1),
    back = r(v, B.COL[0], B.COL[1]);
  shadowAt(X, fx, fy, built);
  if (back > 0) shards(X, cap, null, 1, -1e4, 1e4, 0, 0);
  silhouette(X, cap, 1 - back, Math.round(fy - (TALL + 3) * built), 1e4, 0);
  if (away || v < B.EYE || (v >= B.SHUT[0] && v < B.SHUT[1])) return;
  const ctx = X.ctx;
  ctx.globalAlpha = 1 - back;
  if (X.night && !X.lite) {
    ctx.beginPath();
    for (const ex of EYES) {
      ctx.rect(fx + ex - 1, fy - 15, 3, 1);
      ctx.rect(fx + ex, fy - 16, 1, 3);
    }
    ctx.fillStyle = GLOW;
    ctx.fill();
  }
  ctx.beginPath();
  for (const ex of EYES) ctx.rect(fx + ex, fy - 15, 1, 1);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.globalAlpha = 1;
}

export const STYLE = {
  need(X) {
    const L = X.L;
    if (L.q) return Kit.PART.S0;
    if (L.hide && !L.sw && L.trip < 0) return 0;
    return Kit.PART.TRIP;
  },
  // Queued: one bat already circles over their head.
  stand(X, end) {
    if (end || !X.L.q) return;
    dart(X, WAIT, X.x0, X.y0 - HOV - stoolLift(X.tp.stool), 0.5, O);
    bat(X, WAIT, O[0], O[1], 1);
  },
  trip(X) {
    const L = X.L,
      v = L.v;
    if (L.trip < 0 && v < ARR) smoke(X, X.x0, X.y0 - (TALL + stoolLift(X.tp.stool)) / 2, r(v, B.BURST, DEP), L.C, 20);
    else if (L.trip < 0) smoke(X, X.x1, X.y1, r(v, B.G1 - 0.04, B.G1 + 0.08), 1, 18);
    // a hidden start: the swarm comes out of a puff where it is first seen
    if (L.hide && L.trip >= 0) smoke(X, X.x0, X.y0 - HOV, r(L.trip, 0, 0.25), 1, 20);
    for (let j = 0; j < N; j++) {
      const p = where(X, j);
      if (p) bat(X, j, p[0], p[1], p[2] * L.C);
    }
  },
  // Only for depth: at an end the swarm sorts just in front of the person; in flight its height puts it in the
  // overlay. No shadow: a loose swarm casts none worth a blob.
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
export const BATS = { B, N, WAIT, LAND, EYES, birthOf, landOf, where, sail, need: STYLE.need };
