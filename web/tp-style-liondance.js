// liondance (Tet): a little drum pops up beside them and beats; a red and gold dancing lion bounds in on the beat,
// rears, opens its jaws and swallows them, gulps, and dances along the real route, a ripple on the floor at every
// drum beat and its jaw snapping on every fourth. At the landing it rears and spits them out arms up, red paper
// confetti bursts and flutters down, the lion bows, turns and dances off. The paper stays on the floor a while (a
// mark).
// The lion is one ground trip item in every phase (at the route's start, along it, at the landing); person() draws
// the person at either end. One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { outdoors } from './office-scene.js';

const { r, out2, ease, lerp } = Kit;
const { DEP, ARR, T } = TeleportLogic;
const { RELEASE: REL, END, L_IN, SQUEEZE } = T;
const ar = p => ARR + p * (REL - ARR); // an arrival fraction
// Departure beats (fractions): the drum pops up, beats, the lion leaps in, rears, lunges, snaps shut, gulps.
const D = {
    POP: 0.1,
    BEATS: [0.08, 0.2, 0.32, 0.45],
    LEAP0: 0.22,
    LAND: 0.45,
    LUNGE0: 0.62, // a stool sitter is off the stool (SQUEEZE) before the head comes over them
    SNAP: 0.72,
    GULP1: 0.88,
    DRUM1: 0.86, // the drum fades from here
  },
  // Arrival fractions: rears, spits them out (recoiling), the cymbal and confetti, they land, the bow.
  A = { REAR: 0.14, SPIT0: 0.24, CHENG: 0.3, SPIT1: 0.46, BOW0: 0.52, BOW1: 0.8, DOWN: 0.82 },
  HW = 16, // head cell
  HH = 19,
  HAX = 8, // head column over the anchor (facing right)
  HTOP = 24, // px from the floor to the top of the head
  BW = 24, // body strip
  BH = 14,
  BX = 5, // px behind the anchor where the body ends under the head
  BTOP = 19, // px from the floor to the top row of the body strip
  SLICE = 6, // px per body slice (the cloth ripples slice by slice)
  DW = 13, // drum cell
  DH = 12,
  WAIT = 16, // px behind the feet the lion lands before the lunge
  RECOIL = 16, // px it backs off while spitting ...
  AWAY = 12, // ... and dances off after the bow, short: the desks beside the landing are that way
  TURN = 28, // px between head and tail end
  BEAT = 0.25, // s per drum beat on the trip
  NBITS = 18, // confetti
  PAPER_TTL = 3; // s the paper stays

// Facing right; k keyline, R/H/r red, Y/y gold, W/w fur, G lid, E eye, P pupil, M/m mirror, O mouth, T teeth.
const TOP = [
  '.........kk.....',
  '........kYYk....',
  '....kkkkkYkkk...',
  '..kkWRRRRRRMMk..',
  '.kWWRRRHHRRMmk..',
  'kWWRRRRRRRRRRRk.',
  'kWRRRkkkkkRRRRk.',
  'kWRRkGGGGGkRRRRk',
];
const EYE = ['kWRRkEEEPPkRRYYk'],
  SHUT = ['kWRRkGGGGGkRRYYk'],
  MID = ['kWRRRkkkkkRRYYYk', 'kWWRRRRRRRRRYYYk', 'kWRRRYYYYYYYYYk.'];
const JAW = ['.kWRRkkkkkkkkkk.', '.kWRRrrrrrrrrk..', '..kWWWWWWWWWWk..', '...WwW.WwW.WW...'],
  GAPE = [
    'kWRRkTkTkTkTkk..',
    'kWRRkOOOOOOOOk..',
    'kWRRkOOOOOOOk...',
    '.kWRkTkTkTkk....',
    '.kWRRrrrrrrk....',
    '..kWWWWWWWWk....',
    '...WwW.WwW......',
  ];
const HEADS = [
  [...TOP, ...EYE, ...MID, ...JAW], // closed
  [...TOP, ...EYE, ...MID, ...GAPE], // jaws open
  [...TOP, ...SHUT, ...MID, ...JAW], // eyes shut (blink, gulp, bow)
];
const SHUT_H = 2,
  OPEN_H = 1;
// The body: red cloth with gold scales, fur along the spine, a gold hem and a white fringe; the back end (rear dancer,
// bent over) lower, a tuft of a tail on it. Built once as rows like the head.
function bodyRows() {
  const g = Array.from({ length: BH }, () => Array(BW).fill('.'));
  const put = (x, y, c) => y >= 0 && y < BH && x >= 0 && x < BW && (g[y][x] = c);
  for (let x = 0; x < BW; x++) {
    const yt = 2 + Math.round(4 * (1 - x / (BW - 1)));
    put(x, yt, 'k');
    put(x, yt + 1, 'W');
    if (x % 3 === 1) put(x, yt - 1, 'W');
    for (let y = yt + 2; y <= 9; y++) {
      const row = y - yt - 2,
        scale = row % 2 === 0 && (x + row) % 4 === 0;
      put(x, y, scale ? 'Y' : y === 9 ? 'r' : row === 0 ? 'H' : 'R');
    }
    put(x, 10, 'Y');
    put(x, 11, 'W');
    put(x, 12, 'W');
    if (x % 2 === 0) put(x, 13, 'w');
  }
  for (let y = 4; y <= 12; y++) put(0, y, y > 9 ? 'W' : 'k');
  // the tail tuft: x, y, colour
  for (const t of ['00W', '11W', '01Y', '02W', '12W', '13Y', '23W']) put(+t[0], +t[1], t[2]);
  return g.map(row => row.join(''));
}
const DRUM = [
  '...kkkkkkk...',
  '.kkTTTTTTTkk.',
  'kTTTTTTTTTTTk',
  'kyTTTTTTTTTyk',
  'kYyyyyyyyyyYk',
  'kRRYRRYRRYRrk',
  'kRHRRRRRRRRrk',
  'kRHRRRRRRRRrk',
  'kRRYRRYRRYRrk',
  'kYYYYYYYYYYYk',
  '.kkkkkkkkkkk.',
  '.ky.......yk.',
];
const PAL = {
  k: '#3b0f12',
  R: '#d9312b',
  H: '#ff7a52',
  r: '#9e1f22',
  Y: '#f6c33b',
  y: '#b8841d',
  W: '#fff4dc',
  w: '#d9c6a5',
  G: '#2fa35a',
  E: '#ffffff',
  P: '#111111',
  T: '#f3e2bd',
  M: '#9fd8ff',
  m: '#ffffff',
  O: '#4a0a0e',
};
// A colour at three quarters for the night.
const dim = c =>
  '#' +
  [1, 3, 5]
    .map(i =>
      Math.round(parseInt(c.slice(i, i + 2), 16) * 0.75)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const NIGHT = Object.fromEntries(Object.entries(PAL).map(([k, c]) => [k, k === 'E' || k === 'T' ? '#e8e0d0' : dim(c)]));

function paint(g, rows, pal, ox, oy, mirror, w) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x],
        col = c !== '.' && pal[c];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(ox + (mirror ? w - 1 - x : x), oy + y, 1, 1);
    }
  });
}
// Rows: heads (3 frames, day then night), body (day, night), drum (day, night; then its skin struck).
// Columns: facing right, facing left.
const BODY0 = 6 * HH,
  DRUM0 = BODY0 + 2 * BH;
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = Kit.atlas(2 * HW + 2 * BW, DRUM0 + 2 * DH, g => {
    const body = bodyRows();
    for (let n = 0; n < 2; n++) {
      const pal = n ? NIGHT : PAL;
      for (let m = 0; m < 2; m++) {
        HEADS.forEach((rows, f) => paint(g, rows, pal, m * HW, (2 * f + n) * HH, m, HW));
        paint(g, body, pal, 2 * HW + m * BW, BODY0 + n * BH, m, BW);
        paint(g, DRUM, { ...pal, T: m ? '#ffffff' : pal.T }, m * DW, DRUM0 + n * DH, 0, DW);
      }
    }
  }));

// shortcut: read every frame, so an early re-aim to the other side turns the lion in one frame; tp has no fixed side.
const sideOf = dx => (dx >= 0 ? 1 : -1);
// Real seconds since core time c (both in the same run of segments).
const since = (L, c) => TeleportLogic.real(L.v, L.d) - TeleportLogic.real(c, L.d);

// The lion's look this frame: anchor (feet under the head) x, y, height off the floor, facing, head frame and bob,
// body wave phase and a gulp bulge, leg step, alpha.
// len: the body's length, 1 whole; the dancers bunch up to 0.5 at the landing
const Lk = { x: 0, y: 0, h: 0, s: 1, head: 0, dy: 0, wave: 0, bulge: -1, step: 0, tuck: false, a: 1, len: 1 };
function look(o, x, y, s) {
  Object.assign(o, Lk);
  o.x = x;
  o.y = y;
  o.s = s;
  return o;
}

// Drawing ------------------------------------------------------------------------------------------------------------
const LEGS = [
  [4, 1, 0], // x behind the anchor, step phase, front or rear dancer
  [1, 0, 0],
  [25, 0, 1],
  [22, 1, 1],
];
function legs(X, o, ctx) {
  const fy = Math.round(o.y - o.h);
  for (let pass = 0; pass < 3; pass++) {
    ctx.beginPath();
    for (const [bx, ph] of LEGS) {
      const x = Math.round(o.x - o.s * (bx > BX ? Math.round(BX + (bx - BX) * o.len) : bx)),
        up = o.tuck ? 2 : o.step && (ph ? o.step > 0 : o.step < 0) ? Math.abs(o.step) : 0,
        y = fy - up,
        lx = o.s > 0 ? x : x - 1;
      if (pass === 0) ctx.rect(lx, y - 6, 2, 4);
      else if (pass === 1) ctx.rect(lx - (o.s > 0 ? 0 : 1), y - 2, 3, 1);
      else ctx.rect(lx - (o.s > 0 ? 0 : 1), y - 1, 3, 1);
    }
    const pal = X.night ? NIGHT : PAL;
    ctx.fillStyle = pass === 0 ? pal.Y : pass === 1 ? pal.W : pal.k;
    ctx.fill();
  }
}
// The whole lion at o, with its soft shadow on the floor.
function lion(X, o) {
  if (o.a <= 0.01) return;
  const ctx = X.ctx,
    img = sheetOf(),
    n = X.night ? 1 : 0,
    m = o.s > 0 ? 0 : 1,
    x = Math.round(o.x),
    y = Math.round(o.y),
    h = Math.round(o.h);
  ctx.globalAlpha = o.a * Math.max(0.3, 1 - h / 40);
  ctx.fillStyle = (X.G.th && X.G.th.shadow) || 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x - o.s * Math.round(4 + 9 * o.len), y, h > 6 ? 12 : Math.round(9 + 8 * o.len), 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = o.a;
  legs(X, o, ctx);
  // the cloth, slice by slice, rippling back from the head
  for (let j = BW / SLICE - 1; j >= 0; j--) {
    const k = o.s > 0 ? BW / SLICE - 1 - j : j, // j counts from the head back
      off = Math.round(j * SLICE * o.len),
      wave = Math.round(1.6 * Math.sin(o.wave - j * 1.1)),
      bump = o.bulge >= 0 && Math.abs(o.bulge * (BW / SLICE) - j - 0.5) < 0.8 ? 2 : 0;
    X.stamp(
      img,
      2 * HW + m * BW + k * SLICE,
      BODY0 + n * BH,
      SLICE,
      BH,
      o.s > 0 ? x - BX - SLICE - off : x + BX + off,
      y - h - BTOP + wave - bump,
      SLICE,
      BH,
    );
  }
  const hx = o.s > 0 ? x - HAX : x - (HW - 1 - HAX);
  X.stamp(img, m * HW, (2 * o.head + n) * HH, HW, HH, hx, y - h - HTOP + Math.round(o.dy), HW, HH);
  ctx.globalAlpha = 1;
}
// A ripple on the floor from a drum beat, f 0-1 of its life.
function ripple(X, x, y, f, big, tx, ty) {
  if (f < 0 || f >= 1) return;
  const ctx = X.ctx,
    rx = Math.round((big ? 6 : 4) + (big ? 14 : 9) * out2(f)),
    ry = Math.max(1, Math.round(rx / 2));
  ctx.beginPath();
  Kit.ellipse(rx, ry, (dx, dy) => ctx.rect(x + dx, y + dy, 1, 1));
  ctx.globalAlpha = X.L.C * (big ? 0.85 : 0.65) * (1 - f);
  ctx.fillStyle = X.night ? '#ffd76a' : X.snow > 0 && outdoors(tx, ty) ? '#c0392b' : '#f6c33b';
  ctx.fill();
  ctx.globalAlpha = 1;
}

// The drum beside the origin: pops up, two sticks beat it, the skin lights up and strike marks on every beat.
function drum(X) {
  const L = X.L,
    p = L.v / DEP,
    s = sideOf(X.dir0[0]),
    a = L.C * r(p, 0, 0.05) * (1 - r(p, D.DRUM1, 1));
  if (a <= 0.01) return;
  const ctx = X.ctx,
    pop = p < D.POP ? Math.round(3 * Math.sin(Math.PI * r(p, 0.02, D.POP))) : 0,
    cx = X.x0 + s * 14,
    top = X.y0 - 5 - DH - pop;
  const { hit, ago } = lastHit(p);
  ctx.globalAlpha = a;
  X.stamp(sheetOf(), (ago < 0.35 ? 1 : 0) * DW, DRUM0 + (X.night ? DH : 0), DW, DH, cx - 6, top, DW, DH);
  // sticks: down on the skin at a hit, raised between
  ctx.beginPath();
  for (let k = 0; k < 2; k++) {
    const side = k ? 1 : -1,
      own = hit === 3 || (hit >= 0 && hit % 2 === k),
      // on the skin at the hit, up, then back to the ready height
      lift = own && ago < 1 ? Math.round(4 + 3 * Math.sin(Math.PI * Math.min(1, ago * 1.6)) - 4 * (1 - ago)) : 4,
      tx = cx + side * 2,
      ty = top + 2 - lift;
    Kit.line(tx, ty, tx + side * 5, ty - 4, (px, py) => ctx.rect(px, py, 1, 1));
  }
  ctx.fillStyle = X.night ? '#c08a5a' : '#5a3418';
  ctx.fill();
  if (!X.lite && ago < 0.5 && hit >= 0) {
    // strike marks fly up off the skin
    const d = 3 + Math.round(4 * ago);
    ctx.beginPath();
    for (let j = -1; j <= 1; j++) {
      const x = cx + j * (d + 1),
        y = top - 2 - d + Math.abs(j) * 2;
      ctx.rect(x, y, 1, 2);
    }
    ctx.globalAlpha = a * (1 - 2 * ago);
    ctx.fillStyle = X.night ? '#fff3b0' : '#d2342a';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// The drum's last hit before departure fraction p (index, -1: none yet) and how long ago, in tenths of the departure.
const HIT = { hit: -1, ago: 1 };
function lastHit(p) {
  HIT.hit = -1;
  HIT.ago = 1;
  D.BEATS.forEach((b, k) => {
    if (p >= b) {
      HIT.hit = k;
      HIT.ago = (p - b) / 0.1;
    }
  });
  return HIT;
}
const drumAt = (X, out) => {
  out[0] = X.x0 + sideOf(X.dir0[0]) * 14;
  out[1] = X.y0 - 5;
  return out;
};
// Flat on the origin's floor: the drum's ripples and the thump where the lion lands.
const DP = [0, 0];
function originFloor(X) {
  if (X.lite) return;
  const p = X.L.v / DEP,
    { hit, ago } = lastHit(p);
  if (hit >= 0 && p < D.DRUM1) ripple(X, drumAt(X, DP)[0], DP[1], ago, hit === 3, X.tx0, X.ty0);
  if (p >= D.LAND) {
    const s = sideOf(X.dir0[0]);
    ripple(
      X,
      Math.round(X.x0 - X.dir0[0] * WAIT - s * 12),
      Math.round(X.y0 - X.dir0[1] * WAIT),
      (p - D.LAND) / 0.12,
      true,
      X.tx0,
      X.ty0,
    );
  }
}
// The ripple of the trip's last beat where it landed (surge(k / n) is k / n), from the trip item, or over the lounge
// rug from rug(X): onRug picks which. Q holds that point after; false while there is none.
function beatAt(X) {
  const L = X.L;
  if (X.lite || L.trip < 0 || L.trip >= 1) return false;
  const n = beats(L.d[1]);
  X.route(Math.floor(L.trip * n) / n, Q);
  return true;
}
function stepRipple(X, onRug) {
  if (!beatAt(X) || Kit.onRug(Q[2], Q[3]) !== onRug) return;
  const b = X.L.trip * beats(X.L.d[1]),
    k = Math.floor(b);
  ripple(X, Q[0], Q[1], (b - k) / 0.8, k % 4 === 3, Q[2], Q[3]);
}

// Confetti: bit k bursts from (bx, by), flutters, lands at its own spot round the feet (fx, fy) after its own time.
const BIT_COL = [
  ['#e0281e', '#a8161a', '#f6c33b'],
  ['#b02018', '#7c1014', '#c89a30'],
];
const FALL0 = 0.36, // s: the first bit lands ...
  FALL1 = 0.5; // ... the last (all before the release: the arrival's paper burst is 0.56 s before it)
function bit(X, k, out) {
  const hx = X.hash(k, 71),
    hy = X.hash(k, 72);
  out.dx = Math.round((hx - 0.5) * 38);
  out.dy = Math.round((hy - 0.5) * 12);
  out.t = FALL0 + (FALL1 - FALL0) * X.hash(k, 73);
  out.up = 10 + 10 * X.hash(k, 74);
  out.c = k % 5 === 4 ? 2 : k % 3 === 0 ? 1 : 0;
  return out;
}
const BIT = { dx: 0, dy: 0, t: 0, up: 0, c: 0 };
// flying: the bits still in the air at age s; else the ones on the floor (s past the burst, Infinity once all are).
function confetti(X, fx, fy, age, flying, alpha) {
  if (age < 0 || alpha <= 0.01) return;
  const ctx = X.ctx,
    pal = BIT_COL[X.night ? 1 : 0];
  for (let c = 0; c < 3; c++) {
    let any = false;
    for (let k = 0; k < NBITS; k++) {
      bit(X, k, BIT);
      if (BIT.c !== c || flying !== age < BIT.t) continue;
      if (!any) ctx.beginPath();
      any = true;
      if (flying) {
        const q = age / BIT.t,
          x = Math.round(fx + BIT.dx * out2(q) + 1.5 * Math.sin(age * 18 + k)),
          y = Math.round(lerp(fy - 16, fy + BIT.dy, q) - BIT.up * 4 * q * (1 - q)),
          flat = Math.floor(age * 14 + k) & 1;
        ctx.rect(x, y, flat ? 2 : 1, flat ? 1 : 2);
      } else ctx.rect(fx + BIT.dx, fy + BIT.dy, 2, 1);
    }
    if (!any) continue;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pal[c];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// The cymbal clash where the paper bursts: rays out from (x, y), f 0-1.
function cheng(X, x, y, f) {
  if (f < 0 || f >= 1 || X.lite) return;
  const ctx = X.ctx,
    d0 = 3 + Math.round(8 * out2(f)),
    n = 8;
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * 2 * Math.PI,
      cx = Math.cos(ang),
      cy = Math.sin(ang) * 0.8;
    for (let j = 0; j < 3; j++) ctx.rect(Math.round(x + cx * (d0 + j)), Math.round(y + cy * (d0 + j)), 1, 1);
  }
  ctx.globalAlpha = X.L.C * (1 - f);
  ctx.fillStyle = X.night ? '#ffe680' : '#ffd23f';
  ctx.fill();
  ctx.globalAlpha = 1;
}

// The lion through the phases ----------------------------------------------------------------------------------------
const Q = [0, 0, 0, 0, false],
  Q2 = [0, 0, 0, 0, false];
// Screen side the route heads at fraction p.
function heading(X, p) {
  X.route(Math.max(0, p - 0.01), Q2);
  const x0 = Q2[0];
  X.route(Math.min(1, p + 0.01), Q2);
  return Q2[0] === x0 ? sideOf(X.dir1[0]) : sideOf(Q2[0] - x0);
}
// Beats on the trip: about one every BEAT seconds, at least four.
const beats = secs => Math.max(4, Math.round(secs / BEAT));
// Route fraction at trip fraction t of n beats: a step forward on each beat, nearly still as the beat lands. It
// strays at most 0.15 of a beat from t, so the lion stays near its trip item's sort point.
const SURGE = 0.9;
const surge = (t, n) => (t * n - (SURGE * Math.sin(2 * Math.PI * t * n)) / (2 * Math.PI)) / n;
// The dance at beat clock b (whole numbers are the beats): bob, step, wave, and a jaw snap on every fourth.
function dance(o, b) {
  const k = Math.floor(b),
    f = b - k,
    big = k % 4 === 3;
  o.dy = -Math.round((big ? 4 : 2) * Math.sin(Math.PI * f));
  o.head = big && f > 0.2 && f < 0.7 ? OPEN_H : k % 8 === 5 && f > 0.3 && f < 0.6 ? SHUT_H : 0;
  o.step = f < 0.6 ? (k % 2 ? 1 : -1) * Math.round(2 * Math.sin((Math.PI * f) / 0.6)) : 0;
  o.wave = b * Math.PI;
  return o;
}
function depLion(X, o) {
  const L = X.L,
    // held at DEP: a calm clock switches late, and the lion stays on the spot until then
    p = Math.min(L.v, DEP) / DEP,
    s = sideOf(X.dir0[0]),
    wx = X.x0 - X.dir0[0] * WAIT,
    wy = X.y0 - X.dir0[1] * WAIT;
  if (L.hide) {
    // out of the stall unseen: it dances into view where they come out
    look(o, X.x0, X.y0, s);
    dance(o, since(L, L_IN) / BEAT);
    o.a = r(L.v, L_IN, DEP - 0.03);
    return o;
  }
  if (p < D.LEAP0) return null;
  if (p < D.LAND) {
    // a bound in from behind and above
    const e = out2(r(p, D.LEAP0, D.LAND)),
      back = 28 * (1 - e);
    look(o, wx - X.dir0[0] * back, wy - X.dir0[1] * back, s);
    o.h = 32 * (1 - e) * (1 - e) + 6 * Math.sin(Math.PI * e);
    o.tuck = true;
    o.head = OPEN_H;
    o.a = r(p, D.LEAP0, D.LEAP0 + 0.04);
    o.wave = p * 30;
    return o;
  }
  if (p < D.LUNGE0) {
    // lands with a thump, rears and opens wide
    look(o, wx, wy, s);
    const e = r(p, D.LAND, D.LUNGE0);
    o.dy = -Math.round(4 * ease(r(e, 0.1, 0.6)));
    o.head = e > 0.35 ? OPEN_H : e > 0.15 && e < 0.28 ? SHUT_H : 0;
    o.step = e < 0.2 ? Math.round(2 * Math.sin(Math.PI * r(e, 0, 0.2))) : 0;
    o.wave = p * 24;
    return o;
  }
  if (p < D.SNAP) {
    // the lunge, jaws wide, head coming down over them
    const e = ease(r(p, D.LUNGE0, D.SNAP));
    look(o, lerp(wx, X.x0, e), lerp(wy, X.y0, e), s);
    o.dy = -4 + Math.round(6 * e);
    o.head = OPEN_H;
    o.wave = p * 24;
    return o;
  }
  look(o, X.x0, X.y0, s);
  if (p < D.GULP1) {
    // snapped shut: two happy chews and the lump going down the body
    const e = r(p, D.SNAP, D.GULP1);
    o.dy = 2 - Math.round(2 * Math.abs(Math.sin(2 * Math.PI * e)));
    o.head = e < 0.7 ? SHUT_H : 0;
    o.bulge = e;
    o.wave = p * 20;
    return o;
  }
  // first steps of the dance on the spot
  return dance(o, -r(p, D.GULP1, 1));
}
function tripLion(X, o) {
  const L = X.L,
    n = beats(L.d[1]),
    p = surge(L.trip, n);
  X.route(p, Q);
  look(o, Q[0], Q[1], heading(X, p));
  dance(o, L.trip * n);
  return o;
}
// Back from the landing by t px straight across the screen: the floor there has the landing's depth, where the
// dispatcher sorts a ground trip after the trip.
// s is the way it arrived, face the way it looks.
const backOff = (X, o, t, s, face = s) => look(o, X.x1 - s * t, X.y1, face);
function arrLion(X, o) {
  const L = X.L,
    s = sideOf(X.dir1[0]);
  if (L.v < REL) {
    const q = r(L.v, ARR, REL);
    backOff(X, o, RECOIL * ease(r(q, A.SPIT0, A.SPIT1)), s);
    // the back dancer steps in as it rears: a long body would reach over the desks beside the landing
    o.len = 1 - 0.5 * ease(r(q, 0, A.REAR));
    if (q < A.REAR) dance(o, q / A.REAR);
    else if (q < A.SPIT1) {
      o.dy = -Math.round(4 * ease(r(q, A.REAR, A.SPIT0)));
      o.head = OPEN_H;
      o.step = q > A.SPIT0 ? -1 : 0;
    } else if (q < A.BOW1) {
      // the bow: head down, eyes shut
      const e = Math.sin(Math.PI * r(q, A.BOW0, A.BOW1));
      o.dy = Math.round(5 * e);
      o.head = e > 0.4 ? SHUT_H : 0;
    }
    o.wave = q * 8;
    return o;
  }
  // turns away and dances off the way it came, fading out
  const f = r(L.v, REL, END);
  backOff(X, o, RECOIL + AWAY * r(f, 0.1, 1), s, f < 0.1 ? s : -s);
  o.len = 0.5;
  // turned about its middle: the head goes where the tail was, clear of the person
  if (f >= 0.1) o.x -= s * Math.round(TURN - BW * (1 - o.len));
  dance(o, f * 5);
  o.a = 1 - r(f, 0.3, 0.9);
  return o;
}

// The person ---------------------------------------------------------------------------------------------------------
// The page's own feet shadow, for a remapped body pass (its G draws none).
function shade(X, x, y, w = 6) {
  const ctx = X.ctx;
  ctx.fillStyle = (X.G.th && X.G.th.shadow) || 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y, w, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}
function depPerson(X) {
  const p = X.L.v / DEP,
    tp = X.tp;
  // a stool sitter stays seated until SQUEEZE, then goes up into the jaws from standing on the stool
  if (tp.stool && X.L.v < SQUEEZE) return X.body({ pose: tp.stool === 2 ? 'sitHigh' : 'sit', front: X.a.dirFront });
  const perch = tp.stool === 2 ? 9 : tp.stool ? 4 : 0;
  if (p < D.LAND && !perch) {
    // bobbing to the drum
    let bob = 0;
    D.BEATS.forEach(b => {
      if (p >= b && p < b + 0.06) bob = 1;
    });
    if (!bob) return X.body({ pose: 'stand' });
    shade(X, X.x0, X.y0);
    return X.body({ pose: 'stand', sy: 0.94, sx: 1.04 });
  }
  if (p < D.LUNGE0 + 0.02 && !perch) return X.body({ pose: 'up', front: true });
  // a hop up into the jaws, squeezed as they go in
  const e = r(p, D.LUNGE0 + 0.02, D.SNAP),
    lift = Math.round(perch * (1 - e) + 7 * Math.sin(Math.PI * 0.5 * e) + 2 * e);
  shade(X, X.x0, X.y0, 6 - Math.round(2 * e));
  return X.body({ pose: 'up', front: true, lift, sy: 1 - 0.3 * e, sx: 1 - 0.15 * e });
}
function arrPerson(X) {
  const q = r(X.L.v, ARR, REL);
  if (q < A.SPIT0) return;
  if (q < A.SPIT1) {
    // out of the jaws in an arc onto the landing
    const e = r(q, A.SPIT0, A.SPIT1),
      lift = Math.round((1 - e) * 3 + 14 * Math.sin(Math.PI * e));
    shade(X, X.x1, X.y1, 6 - Math.round(2 * Math.sin(Math.PI * e)));
    X.body({ pose: 'up', front: true, lift, sy: 0.75 + 0.25 * e, sx: 0.88 + 0.12 * e });
    return;
  }
  const g = r(q, A.SPIT1, A.SPIT1 + 0.08),
    st = g < 1 ? 0.12 * Math.sin(Math.PI * g) : 0,
    o = { pose: q < A.DOWN ? 'up' : 'stand', front: q < A.DOWN ? true : undefined };
  // only the landing squash is remapped (no shadow of its own), so the page's shadow stays on after it
  if (st > 0) {
    shade(X, X.x1, X.y1);
    Object.assign(o, { sy: 1 - st, sx: 1 + st / 2 });
  }
  X.body(o);
}

const O = { ...Lk };
export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q || (L.hide && v < L_IN)) return 0;
    let n = Kit.PART.TRIP;
    if (!L.hide && !L.sw && v < DEP) n |= Kit.PART.B0 | Kit.PART.F0;
    if (L.sw && v >= ARR && v < REL) n |= Kit.PART.F1;
    if (beatAt(X) && Kit.onRug(Q[2], Q[3])) n |= Kit.PART.RUG;
    return n;
  },
  // the drum, behind the person
  back(X, end) {
    if (!end) drum(X);
  },
  // the drum's ripples at the origin; paper already down at the landing
  floor(X, end) {
    if (end) confetti(X, X.x1, X.y1, since(X.L, ar(A.CHENG)), false, 1);
    else originFloor(X);
  },
  rug(X) {
    stepRipple(X, true);
  },
  // the lion wherever it is, the trip's beat ripples, and the burst at the landing
  trip(X) {
    const L = X.L;
    let o = null;
    if (!L.sw) o = depLion(X, O);
    else if (L.trip >= 0 && L.trip < 1) o = tripLion(X, O);
    else if (L.v >= ARR) o = arrLion(X, O);
    if (!o) return;
    o.a *= L.C;
    stepRipple(X, false);
    lion(X, o);
    if (L.sw && L.v >= ARR && L.v < REL) {
      const c = ar(A.CHENG);
      if (L.v >= c) {
        cheng(X, X.x1, X.y1 - 16, since(L, c) / 0.3);
        confetti(X, X.x1, X.y1, since(L, c), true, 1);
      }
    }
  },
  // One body pass: the person at the origin until swallowed, nothing on the trip, spat out at the landing.
  person(X) {
    const L = X.L;
    if (L.q || L.v >= REL) return false;
    if ((L.hide && !L.sw) || (L.trip >= 0 && L.trip < 1)) return true;
    if (!L.sw) {
      if (L.v / DEP < D.SNAP) depPerson(X);
    } else arrPerson(X);
    return true;
  },
  marks: [{ at: 'rel', end: 1, ttl: PAPER_TTL, layer: 'floor' }],
  // The paper on the floor, fading out at the end.
  drawMark(X, m, age) {
    confetti(X, X.x0, X.y0, Infinity, false, 1 - r(age, PAPER_TTL * 0.6, PAPER_TTL));
  },
  gap: null,
};
// Exposed for tests.
export const LION = { PAL, surge, HEADS, bodyRows, DRUM, D, A, beats, dance, bit, FALL1, HW, HH, BW, BH, DW, DH };
