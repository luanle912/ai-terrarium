// sleigh (Christmas): a red sleigh behind a pair of reindeer swoops down out of the sky and pulls up beside them in a
// spray of snow; they hop in and sit, the team gallops off and climbs. It flies over the island with the reindeer
// galloping and snow falling from the runners, comes down at the landing, they hop out, a present tumbles out of the
// sleigh beside them, and the team takes off into the sky. The present stays a few seconds, then twinkles away (a
// mark). Team, rider and present are one picture: person() at both ends, trip() in flight, for a hidden start and
// for the team leaving after the release. ground() reports the real height. One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { DESKS, FLOOR_Z, PA, PG, TH, TW } from './office-scene.js';

const { atlas, r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR, T, core } = TeleportLogic;
const { RELEASE: REL, END, L_IN, SQUEEZE } = T,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  fd = p => REL + p * (END - REL), // a fade fraction
  B = {
    TOUCH: at(0.42), // the team swoops in and touches down
    HOP: at(0.5), // they hop in ...
    SIT: at(0.68), // ... and sit
    GO: at(0.76), // the reindeer pull away ...
    LIFT: at(0.84), // ... and the sleigh lifts
    DOWN: ar(0.3), // touchdown at the landing
    OUT: ar(0.38), // they hop out ...
    STAND: ar(0.54), // ... and stand
    TOSS: [ar(0.5), ar(0.74)], // a present tumbles out beside them
    LEAVE: ar(0.62), // the team pulls away and climbs ...
    GONE: fd(0.75), // ... out of sight
  },
  STOPX = 12, // px ahead of their feet the seat stops at the origin
  ARRX = 8, // px behind the landing the seat stops
  G0 = -2, // px: the parked runners stand this far behind the feet, at the origin ...
  G1 = -4, // ... and at the landing
  RUN = 10, // px rolled forward while taking off
  RUN2 = 14, // px rolled while touching down
  H0 = 14, // px over the floor at the end of the take-off
  ARRH = 20, // ... as it comes in over the landing
  SWX = 74, // the swoop starts this far behind (px) ...
  SWY = 64, // ... and this high
  AWX = 64, // it leaves this far ahead ...
  AWY = 110, // ... and up
  HOPH = 9, // px of a hop over the straight line
  GIFTX = 13, // px aside the landing feet, away from the desk, the present lands
  RIM = 8, // px over the seat point: the top of the near side panel
  CW = 24, // atlas cell
  CHH = 16;

// Pixel art facing right; the bake mirrors it for the left. k outline, R/r red, Y/y gold, L lantern.
const FRONT = [
  '.kkk....................',
  'kYYYk...............kkk.',
  'kRHRYk.............kYLYk',
  'kRHRRk.............kYkYk',
  'kRRRRk..............kRYk',
  'kRRRRkkkkkkkkkkkkkkkkRRk',
  'kYYYYYYYYYYYYYYYYYYYYYYk',
  'kRHHHHHHHHHHHHHHHHHHHHRk',
  '.krrrrYrrrrrrrrrrYrrrrkY',
  '..y...y.........y...y.Y.',
  'YYYYYYYYYYYYYYYYYYYYYY..',
  '.yyyyyyyyyyyyyyyyyyyyy..',
];
// The far side seen over the near rim, and the seat back.
const BACK = ['', '', '', '.....kkkkkkkkkkkkkkk....', '.....crrrrrrrrrrrrrrc...'];
const DEER = [
  '...........a.a..a.',
  '...........aa.aaa.',
  '............a.a...',
  '............ebb...',
  '............bbbbb.',
  '............bkbbbn',
  '............bbbbb.',
  '...........RRYl...',
  '.wbbRbbbbbbbbl....',
  'wbbbRbbbbbbbbl....',
  '.bbbRbbbbbbbbl....',
  '.BbbRbbbbbbbB.....',
  '.BllRlllllllB.....',
];
const LEGS = [
  ['.BB......bBb......', 'BB.........bB.....', 'k............k....'], // stretched
  ['..Bb.....bB.......', '..kB.....Bk.......', '..................'], // tucked
  ['.Bb.B....bB.......', '.B..b....b.B......', '.k..k....k.k......'], // standing
];
const GIFT = ['..Y..Y..', '...YY...', 'kHHYYHHk', 'kggYYggk', 'kggYYggk', 'kGGYYGGk', 'kGGYYGGk', '.kkkkkk.'];

const SLEIGH = [
  { k: '#3a1a1c', R: '#c8323c', H: '#e4555c', r: '#8e2230', Y: '#f2c14e', y: '#b98a2c', L: '#fff1b0', c: '#5a1a22' },
  { k: '#1c0e12', R: '#a02a36', H: '#b8444c', r: '#6e1e2a', Y: '#d8aa48', y: '#8e6a26', L: '#ffe680', c: '#3e1218' },
];
const DEERS = [
  { b: '#8a5a3a', B: '#6b4226', l: '#c9a27a', a: '#d9c7a0', e: '#a8744c', k: '#2a1c14', w: '#f4efe6', n: '#3a2418' },
  { b: '#6e4630', B: '#55331e', l: '#a8845e', a: '#b8a682', e: '#8a5e3c', k: '#2a1c14', w: '#d8d2c8', n: '#2a1a10' },
  { b: '#6a4630', B: '#50321f', l: '#9c8062', a: '#ab9c80', e: '#80583a', k: '#160e0a', w: '#c4c0b8', n: '#1c120c' },
  { b: '#523624', B: '#3e2618', l: '#7c664e', a: '#8a7e68', e: '#64442c', k: '#160e0a', w: '#9a968e', n: '#140c08' },
];
const HARNESS = { R: '#c8323c', Y: '#f2c14e' };
// Box, its shade, the lid's light and the ribbon: green with gold, red with white, gold with red.
const BOXES = [
  ['#2f8f4e', '#1f6b3a', '#4fb56e', '#f2c14e'],
  ['#c8323c', '#8e2230', '#e8545c', '#f4efe6'],
  ['#e0a83a', '#b07a22', '#f6cc6a', '#c8323c'],
];
const GIFTK = ['#2a1c14', '#140c08'];
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

function paint(g, rows, pal, ox, oy, mirror) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[mirror ? row.length - 1 - x : x],
        col = c !== '.' && pal[c];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(ox + x, oy + y, 1, 1);
    }
  });
}
// Rows of cells: sleigh front (day, night), back (day, night), deer (3 legs x 4 tones), presents (3 x day, night).
// Columns: facing right, facing left.
const DEER0 = 4,
  GIFT0 = 16;
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = atlas(2 * CW, 22 * CHH, g => {
    for (let m = 0; m < 2; m++) {
      const ox = m * CW;
      for (let n = 0; n < 2; n++) {
        paint(g, FRONT, SLEIGH[n], ox, n * CHH, m);
        paint(g, BACK, SLEIGH[n], ox, (2 + n) * CHH, m);
        for (let f = 0; f < 3; f++) {
          const pal = { ...DEERS[2 * n], ...HARNESS },
            far = { ...DEERS[2 * n + 1], R: '#8e2230', Y: '#b98a2c' };
          paint(g, [...DEER, ...LEGS[f]], pal, ox, (DEER0 + f * 4 + 2 * n) * CHH, m);
          paint(g, [...DEER, ...LEGS[f]], far, ox, (DEER0 + f * 4 + 2 * n + 1) * CHH, m);
        }
      }
      for (let v = 0; v < 3; v++)
        for (let n = 0; n < 2; n++) {
          const [G, D, H, Y] = BOXES[v].map(c => (n ? dim(c) : c));
          paint(g, GIFT, { g: G, G: D, H, Y, k: GIFTK[n] }, ox, (GIFT0 + 2 * v + n) * CHH, m);
        }
    }
  }));

// shortcut: read every frame, so an early re-aim to the other side turns the team in one frame; tp has no fixed side.
const side = X => (X.dir1[0] >= 0 ? 1 : -1),
  facing = X => X.y1 >= X.y0,
  perch = stool => (stool === 2 ? 9 : stool ? 4 : 0),
  hop0 = stool => (stool ? SQUEEZE : B.HOP),
  sit0 = stool => hop0(stool) + B.SIT - B.HOP,
  go0 = stool => Math.max(B.GO, sit0(stool) + 0.005),
  lift0 = stool => go0(stool) + B.LIFT - B.GO,
  cruise = len => Math.min(84, Math.max(30, 14 + 2.4 * (len || 0))),
  bump = t => ease(r(t, 0, 0.42)) * (1 - ease(r(t, 0.6, 1))),
  bob = (secs, h) => Math.round(Math.min(1, h / 10) * 1.3 * Math.sin(secs * 5));
// Tiles for a screen offset from a point whose tile is known.
const tileX = (dx, dy) => (dx / TW + dy / TH) / 2,
  tileY = (dx, dy) => (dy / TH - dx / TW) / 2;

// The picture at core v, time secs: the rider (feet, pose, facing, alpha, in the sleigh or not), the team (seat point,
// runners' ground point, height, alpha, galloping), the team's centre tile, and the present (where, whether out).
const P = {
    fx: 0,
    fy: 0,
    pose: 'stand',
    front: null,
    legs: 1,
    a: 1,
    inside: false,
    sx: 0,
    sy: 0,
    ux: 0,
    uy: 0,
    gsx: 0,
    gsy: 0,
    h: 0,
    ta: 1,
    run: false,
    gx: 0,
    gy: 0,
    out: false,
    bx: 0,
    by: 0,
  },
  Q = { ...P },
  N = { ...P };
function reset(p) {
  p.pose = 'stand';
  p.front = null;
  p.legs = 1;
  p.a = 1;
  p.inside = false;
  p.ta = 1;
  p.run = false;
  p.out = false;
}
// The team with its runners over (x, y) px at height h; (ex, ey) the end the tiles are counted from.
function team(X, p, x, y, h, secs, end) {
  const ex = end ? X.x1 : X.x0,
    ey = end ? X.y1 : X.y0,
    cx = x + side(X) * 11 - ex;
  p.gsx = Math.round(x);
  p.gsy = Math.round(y);
  p.h = h;
  p.ux = x;
  p.uy = y + 2 - h;
  p.sx = Math.round(x);
  p.sy = Math.round(p.uy) + bob(secs, h);
  p.gx = (end ? X.tx1 : X.tx0) + tileX(cx, y - ey);
  p.gy = (end ? X.ty1 : X.ty0) + tileY(cx, y - ey);
}
function seated(p) {
  p.inside = true;
  p.pose = 'sit';
  p.fx = p.sx;
  p.fy = p.sy;
}
function origin(X, v, secs, p, s) {
  const stool = X.tp.stool,
    gx = X.x0 + s * STOPX,
    gy = X.y0 + G0;
  if (X.L.hide) {
    team(X, p, gx + s * (RUN - 24 * (1 - ease(r(v, L_IN, DEP)))), gy, H0, secs, 0);
    seated(p);
    p.run = true;
    p.a = p.ta = r(v, L_IN, DEP - 0.03);
    p.front = facing(X);
    return p;
  }
  const h0 = hop0(stool),
    s0 = sit0(stool),
    g0 = go0(stool);
  if (v < B.TOUCH) {
    const e = out2(r(v, 0, B.TOUCH));
    team(X, p, gx - s * SWX * (1 - e), gy, SWY * (1 - e) ** 1.6, secs, 0);
    p.ta = r(v, 0, at(0.1));
    p.run = true;
  } else if (v < g0) team(X, p, gx, gy, 0, secs, 0);
  else {
    team(X, p, gx + s * RUN * in2(r(v, g0, DEP)), gy, H0 * in2(r(v, lift0(stool), DEP)), secs, 0);
    p.run = true;
  }
  if (v >= s0) {
    seated(p);
    p.front = facing(X);
    p.fy += Math.round(Math.sin(Math.PI * r(v, s0, s0 + 0.03)));
    return p;
  }
  const base = X.y0 - perch(stool);
  p.fx = X.x0;
  p.fy = X.y0;
  if (v < h0) {
    // a sitter is drawn at the floor point: the page lifts a sitter onto the stool itself
    if (stool) p.pose = stool === 2 ? 'sitHigh' : 'sit';
    return p;
  }
  const q = r(v, h0, s0);
  p.front = facing(X);
  p.fx = Math.round(lerp(X.x0, p.sx, ease(q)));
  p.fy = Math.round(lerp(base, p.sy, q) - HOPH * Math.sin(Math.PI * q));
  p.pose = q < 0.5 ? 'up' : 'sit';
  p.inside = q >= 0.5;
  return p;
}
function flight(X, v, secs, p, s) {
  const t = r(v, DEP, ARR),
    e = lerp(t, ease(t), 0.7),
    x = lerp(X.x0 + s * (STOPX + RUN), X.x1 - s * (ARRX + RUN2), e),
    y = lerp(X.y0 + G0, X.y1 + G1, e),
    h = lerp(H0, ARRH, t) + cruise(X.tp.len) * bump(t);
  team(X, p, x, y, h, secs, 0);
  seated(p);
  p.run = true;
  p.front = facing(X);
  return p;
}
function arrival(X, v, secs, p, s) {
  const gx = X.x1 - s * ARRX,
    gy = X.y1 + G1;
  if (v < B.DOWN) {
    const e = out2(r(v, ARR, B.DOWN));
    team(X, p, gx - s * RUN2 * (1 - e), gy, ARRH * (1 - e), secs, 1);
    p.run = true;
  } else {
    const go = r(v, B.LEAVE, B.GONE);
    team(X, p, gx + s * AWX * in2(go), gy, AWY * in2(go) ** 1.3, secs, 1);
    p.run = go > 0;
    p.ta = 1 - in2(r(go, 0.55, 1));
  }
  // the present: in the sleigh, tossed out in an arc, then on the floor with a little bounce
  const k = r(v, B.TOSS[0], B.TOSS[1]),
    gs = giftSpot(X),
    bx = X.x1 + gs[0],
    by = X.y1 + gs[1];
  if (k > 0) {
    const fromX = p.sx + s * 7,
      fromY = p.sy - 5;
    p.out = true;
    p.bx = Math.round(lerp(fromX, bx, k));
    p.by = Math.round(lerp(fromY, by, k) - 14 * Math.sin(Math.PI * k));
    if (k >= 1) p.by = by - Math.round(2 * Math.sin(Math.PI * r(v, B.TOSS[1], B.TOSS[1] + 0.03)));
  }
  if (v < B.OUT) {
    seated(p);
    p.front = facing(X);
    return p;
  }
  // hop out toward the camera onto the landing; from there their own facing, the one the walker goes on with
  const q = r(v, B.OUT, B.STAND),
    sx = X.x1 - s * ARRX,
    sy = gy + 2;
  p.fx = Math.round(lerp(sx, X.x1, ease(q)));
  p.fy = Math.round(lerp(sy, X.y1, q) - HOPH * Math.sin(Math.PI * q));
  p.inside = q < 0.5;
  p.pose = q < 0.5 ? 'sit' : q < 0.9 ? 'up' : 'stand';
  p.front = q < 0.5 ? facing(X) : null;
  p.legs = 1 - 0.3 * Math.sin(Math.PI * r(v, B.STAND, B.STAND + 0.04));
  return p;
}
function picture(X, v, secs, p = P) {
  reset(p);
  const s = side(X);
  if (v >= ARR) return arrival(X, v, secs, p, s);
  if (v >= DEP) return flight(X, v, secs, p, s);
  return origin(X, v, secs, p, s);
}

// Snow from the runners: flakes left on a beat of time where the sleigh was then, falling, drifting back and melting.
// Pure in the clock; a crowd keeps the beat and skips every other one.
const RATE = 26,
  LIFE = 0.9,
  FL = [];
function flakes(X) {
  const L = X.L,
    tp = X.tp,
    s = side(X);
  FL.length = 0;
  if (L.cut) return FL;
  for (let i = Math.floor(L.secs * RATE); i > (L.secs - LIFE) * RATE; i--) {
    if (X.lite && i % 2) continue;
    const ts = i / RATE,
      v = core(ts, tp.d);
    if (ts < 0 || v >= B.GONE || (L.hide && v < L_IN)) continue;
    const q = picture(X, v, ts, Q),
      f = (L.secs - ts) / LIFE;
    if (q.h < 4 || q.ta < 0.5 || X.hash(i, 61) < 0.2) continue;
    FL.push(
      Math.round(q.sx - s * (4 + 12 * X.hash(i, 62)) - s * 6 * f + 2 * Math.sin(7 * f + i)),
      Math.round(q.sy - 1 + 30 * f * (0.5 + 0.5 * f)),
      f < 0.7 && X.hash(i, 63) < 0.6 ? 2 : 1,
    );
  }
  return FL;
}
const FLAKE = [
  ['#8fa6c4', '#ffffff'],
  ['#4a5a78', '#e6eeff'],
];
function snowfall(X, list, alpha) {
  const ctx = X.ctx;
  if (!list.length || alpha <= 0.01) return;
  ctx.globalAlpha = Math.min(1, alpha);
  for (let l = 0; l < 2; l++) {
    ctx.beginPath();
    for (let j = 0; j < list.length; j += 3) {
      const x = list[j],
        y = list[j + 1] + 1 - l;
      if (list[j + 2] < 2) ctx.rect(x, y, 1, 1);
      else {
        // a little plus: a flake, not a speck of dust
        ctx.rect(x - 1, y, 3, 1);
        ctx.rect(x, y - 1, 1, 3);
      }
    }
    ctx.fillStyle = FLAKE[X.night ? 1 : 0][l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// One atlas cell at a right-facing x (xr) of width w, mirrored round the seat for the left.
function cell(X, row, w, h, xr, y, s, sx) {
  const m = s > 0 ? 0 : 1;
  X.stamp(sheetOf(), m * CW, row * CHH, w, h, s > 0 ? xr : 2 * sx - xr - w, y, w, h);
}
// The side of the landing away from its nearest desk (none near: behind the team); the live end and the mark agree.
function giftSide(X) {
  let best = 9,
    g = -side(X);
  for (const d of DESKS) {
    const dx = d.gx + 1 - X.tx1,
      dy = d.gy + 0.5 - X.ty1;
    if (dx * dx + dy * dy < best) {
      best = dx * dx + dy * dy;
      g = dx - dy > 0 ? -1 : 1;
    }
  }
  return g;
}
// Whether screen point (sx, sy) falls on the office box x0..x1, y0..y1, z0..z1 (z in px), sampled every 2 px up.
function onBox(sx, sy, x0, x1, y0, y1, z0, z1) {
  const o = PG(0, 0),
    d = (sx - o[0]) / TW;
  for (let z = z0; z <= z1; z += 2) {
    const s = (sy - o[1] + z + FLOOR_Z) / TH,
      x = (s + d) / 2,
      y = (s - d) / 2;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return true;
  }
  return false;
}
// The middle of the present standing at (x, y) is behind desk d, sorted in front: its top, monitor, arm lamp or chair
// (decor-furniture.js F.desk, office-decor.js deskWorkstation).
function hidden(d, x, y, z) {
  const { gx, gy } = d,
    on = (x0, x1, y0, y1, z0, z1) => onBox(x, y - 4, gx + x0, gx + x1, gy + y0, gy + y1, z0, z1);
  if (gx + gy + 1.5 <= z) return false;
  return (
    on(0, 2, 0.06, 0.88, 0, 12) ||
    on(0.52, 1.48, 0.12, 0.22, 16, 31) ||
    on(0.12, 0.48, 0.34, 0.8, 12, 28) ||
    on(0.7, 1.35, 1.25, 1.85, 0, 16)
  );
}
// [dx, dy] from the landing feet: the side away from the desk unless a desk in front hides it there; nearer the
// camera when both sides are hidden. The live end and the mark both read it.
const GS = [0, 0];
function giftSpot(X) {
  const f = PA(X.tx1, X.ty1),
    z = X.tx1 + X.ty1,
    hid = s => DESKS.some(d => hidden(d, f[0] + s * GIFTX, f[1] + 2, z)),
    g = giftSide(X),
    s = hid(g) && !hid(-g) ? -g : g;
  GS[0] = s * GIFTX;
  GS[1] = hid(s) ? 7 : 2;
  return GS;
}
const box = X => Math.floor(X.hash(1, 71) * 3) * 2 + (X.night ? 1 : 0);
// The present with its bottom centre at (x, y).
function present(X, x, y, s, alpha) {
  if (alpha <= 0.01) return;
  X.ctx.globalAlpha = Math.min(1, alpha);
  cell(X, GIFT0 + box(X), 8, 8, x - 4, y - 8, s, x);
  X.ctx.globalAlpha = 1;
}
const SPARK = ['#fff6c8', '#ffd768'];
// Four little stars round (x, y), p 0-1 outwards.
function sparkle(X, x, y, p, alpha) {
  if (p <= 0 || p >= 1 || alpha <= 0.01) return;
  const ctx = X.ctx,
    d = Math.round(3 + 7 * out2(p));
  ctx.globalAlpha = Math.min(1, alpha) * (1 - in2(p));
  for (let l = 0; l < 2; l++) {
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * 2 * Math.PI + 0.4,
        cx = Math.round(x + d * Math.cos(a)),
        cy = Math.round(y + 0.7 * d * Math.sin(a));
      if (l) ctx.rect(cx, cy, 1, 1);
      else {
        ctx.rect(cx - 1, cy, 3, 1);
        ctx.rect(cx, cy - 1, 1, 3);
      }
    }
    ctx.fillStyle = SPARK[l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const O = { pose: 'stand', front: null, alpha: 1, legs: 1, clip: null },
  CLIP = [64, RIM];
function rider(X, p) {
  if (p.a <= 0.01) return;
  O.pose = p.pose;
  O.front = p.front;
  O.legs = p.legs;
  O.alpha = Math.min(1, p.a);
  // in the sleigh nothing shows under the near rim
  CLIP[1] = RIM - (p.sy - p.fy);
  O.clip = p.inside ? CLIP : null;
  X.bodyAt(p.fx, p.fy, O);
}
const REINS = ['#5a3a26', '#2a1a10'];
// Far reindeer, sleigh back, the present in it, the rider, the near side, reins, near reindeer, lantern; then a rider
// out of the sleigh and the present out of it. A cut fades the team and the snow; the rider keeps their alpha.
function draw(X, p) {
  const ctx = X.ctx,
    L = X.L,
    C = L.C,
    s = side(X),
    n = X.night ? 1 : 0,
    ta = Math.min(1, p.ta) * C,
    { sx, sy } = p;
  snowfall(X, flakes(X), 0.95 * ta);
  if (ta > 0.01) {
    const nx = picture(X, L.v + 0.004, L.secs, N),
      dy = Math.max(-5, Math.min(5, Math.round((14 * (nx.uy - p.uy)) / Math.max(2, Math.abs(nx.ux - p.ux))))),
      gal = Math.floor(L.secs * 8) % 2;
    ctx.globalAlpha = ta;
    cell(X, DEER0 + (p.run ? 1 - gal : 2) * 4 + 2 * n + 1, 18, 16, sx + 18, sy - 19 + Math.round(1.2 * dy), s, sx);
    cell(X, 2 + n, CW, 5, sx - 10, sy - 13, s, sx);
    if (!p.out) cell(X, GIFT0 + box(X), 8, 8, sx + 3, sy - 13, s, sx);
    ctx.globalAlpha = 1;
    if (p.inside) rider(X, p);
    ctx.globalAlpha = ta;
    cell(X, n, CW, 12, sx - 10, sy - 13, s, sx);
    reins(X, sx, sy, dy, s, n);
    cell(X, DEER0 + (p.run ? gal : 2) * 4 + 2 * n, 18, 16, sx + 15, sy - 17 + dy, s, sx);
    if (n) {
      // the lantern on the front scroll glows at night
      const lx = s > 0 ? sx + 12 : sx - 13;
      ctx.globalAlpha = 0.3 * ta;
      ctx.fillStyle = '#ffe680';
      ctx.fillRect(lx - 2, sy - 12, 5, 3);
      ctx.fillRect(lx - 1, sy - 13, 3, 5);
    }
    ctx.globalAlpha = 1;
  } else if (p.inside) rider(X, p);
  if (!p.inside) rider(X, p);
  if (p.out && L.v < REL) {
    if (p.by >= X.y1) Kit.shadow(ctx, p.bx, X.y1 + 2, 9, 0.7 * C);
    present(X, p.bx, p.by, s, C);
    sparkle(X, p.bx, p.by - 4, r(L.v, B.TOSS[1], B.TOSS[1] + ar(0.2) - ARR), C);
  }
}
const RL = [0, 0, 0, 0];
function reins(X, sx, sy, dy, s, n) {
  const ctx = X.ctx,
    mx = x => (s > 0 ? x : 2 * sx - 1 - x);
  RL[0] = mx(sx + 13);
  RL[1] = sy - 9;
  RL[2] = mx(sx + 26);
  RL[3] = sy - 10 + dy;
  ctx.beginPath();
  Kit.line(RL[0], RL[1], RL[2], RL[3], (x, y) => ctx.rect(x, y, 1, 1));
  ctx.fillStyle = REINS[n];
  ctx.fill();
}

// Snow kicked up by the runners as the team touches down or pulls away, p 0-1.
const PUFF = [
  ['#8ea4c0', '#ffffff'],
  ['#56667e', '#dfe8f6'],
];
function spray(X, x, y, s, p) {
  if (p <= 0 || p >= 1) return;
  const ctx = X.ctx;
  ctx.globalAlpha = (1 - in2(p)) * X.L.C;
  for (let l = 0; l < 2; l++) {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      if (X.lite && k % 2) continue;
      const back = k < 3 ? -1 : 1,
        dx = Math.round(x + s * (k < 3 ? -12 + 3 * k : 18 + 3 * k) + back * s * 8 * out2(p) * (1 + (k % 3) / 2)),
        dy = Math.round(y - 1 - 5 * Math.sin(Math.PI * p) * (0.6 + 0.2 * (k % 3))),
        q = Math.round(1 + 2 * out2(Math.min(1, 2 * p)) * (1 - 0.5 * p)) - l;
      if (q < 1) continue;
      ctx.rect(dx - q, dy - q + 1 - l, 2 * q + 1, 2 * q - 1);
    }
    ctx.fillStyle = PUFF[X.night ? 1 : 0][l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// Shadows at an end: under the feet when out of the sleigh, under sleigh and reindeer while low; and the spray.
function shade(X, end, p) {
  const s = side(X),
    v = X.L.v,
    stool = X.tp.stool;
  if (!p.inside) Kit.shadow(X.ctx, end ? X.x1 : X.x0, end ? X.y1 : X.y0, 12, 0.8);
  const k = (0.8 - p.h / 50) * Math.min(1, p.ta) * X.L.C;
  if (k > 0.02) {
    Kit.shadow(X.ctx, p.gsx + s, p.gsy, 26, k);
    Kit.shadow(X.ctx, p.gsx + s * 25, p.gsy, 18, k);
  }
  if (end) {
    spray(X, p.gsx, p.gsy, s, r(v, B.DOWN - 0.02, B.DOWN + ar(0.3) - ARR));
    spray(X, p.gsx, p.gsy, s, r(v, B.LEAVE, B.LEAVE + ar(0.3) - ARR));
  } else {
    spray(X, p.gsx, p.gsy, s, r(v, B.TOUCH - 0.02, B.TOUCH + at(0.3)));
    spray(X, p.gsx, p.gsy, s, r(v, go0(stool), DEP));
  }
}

const PART = Kit.PART;
export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q || (L.hide && !L.sw && v < L_IN)) return 0;
    if (L.sw && v >= REL) return v < B.GONE ? PART.TRIP | PART.F1 : 0;
    let n = 0;
    if (L.trip >= 0 || (L.hide && !L.sw)) n |= PART.TRIP | PART.SHADOW;
    if (!L.hide && !L.sw) n |= PART.F0;
    if (L.sw && v >= ARR) n |= PART.F1;
    return n;
  },
  floor(X, end) {
    const L = X.L,
      p = picture(X, L.v, L.secs);
    if (end && L.v >= REL) p.inside = true;
    shade(X, end, p);
  },
  trip(X) {
    const L = X.L,
      p = picture(X, L.v, L.secs);
    // after the release only the team flies off: the walker has the person, a mark the present
    if (L.v >= REL) p.a = 0;
    draw(X, p);
  },
  // The team's centre tile and the runners' real height.
  ground(X, out) {
    const L = X.L,
      p = picture(X, L.v, L.secs);
    out[0] = p.gx;
    out[1] = p.gy;
    out[2] = p.h;
    if (X.L.hide && !X.L.sw) out[3] = p.a; // the shadow fades in with them
    return true;
  },
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || (L.sw && v >= REL)) return false;
    if (L.trip >= 0 || (L.hide && !L.sw) || (L.sw && v < ARR)) return true;
    draw(X, picture(X, v, L.secs));
    return true;
  },
  // The present stays by the landing, then twinkles away.
  marks: [{ at: 'rel', end: 1, ttl: 3.2, layer: 'back' }],
  drawMark(X, m, age) {
    const s = side(X),
      gs = giftSpot(X),
      x = X.x0 + gs[0],
      y = X.y0 + gs[1],
      out = r(age, m.ttl - 0.6, m.ttl - 0.1);
    Kit.shadow(X.ctx, x, y, 9, 0.7 * (1 - out));
    present(X, x, y, s, 1 - in2(out));
    sparkle(X, x, y - 4, out, 1);
  },
  gap: null,
};
// Exposed for tests.
export const SLEIGHRIDE = {
  B,
  H0,
  ARRH,
  STOPX,
  ARRX,
  GIFTX,
  DEERS,
  picture,
  flakes,
  giftSide,
  giftSpot,
  hop0,
  sit0,
  go0,
  lift0,
};
