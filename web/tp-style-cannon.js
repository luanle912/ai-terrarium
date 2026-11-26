// cannon: a circus cannon drops in behind them with a thud, they hop up and slide into the muzzle, the fuse fizzes
// and the barrel shudders, BOOM: they shoot out head first on a smoky arc over the island, flip at the top, pop a
// striped parachute and drift down onto the landing; the canopy folds down behind them and lies there a moment.
// Cannon and body are one picture at the origin's walker depth (person()); the flight is trip() and the descent
// person() at the landing. The cannon left smoking after the shot and the folded canopy are the lasting marks.
// One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { outdoors } from './office-scene.js';

const { atlas, bake, clamp, r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR, T } = TeleportLogic;
const { RELEASE: REL, SQUEEZE } = T,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  B = {
    DROP: at(0.03), // the cannon falls in from above ...
    THUD: at(0.15), // ... and lands
    SET: at(0.24), // done bouncing
    PUFF: at(0.3), // how long a dust puff lasts
    HOP: at(0.28), // they hop up ...
    TOP: 0.05, // core after the hop: over the muzzle
    IN: 0.16, // ... and inside
    FUSE: at(0.5), // the fuse is lit ...
    SHAKE: at(0.8), // ... the barrel shudders until the shot at DEP
    OPEN: 0.72, // trip fraction: the parachute pops
    FLIP: 0.34, // trip fraction: a somersault at the top
    DOWN: ar(0.5), // touchdown
    FOLD: ar(0.62), // the canopy lies on the floor
    TADA: ar(0.82), // arms come down
  },
  M = { STAY: 2.5, OUT: 0.35, TTL: 3.0, PILE: 1.3, PILE_OUT: 0.5 }, // the marks: cannon, then the canopy
  DROPH = 46, // px the cannon falls from
  ARRH = 18, // px the feet hang over the landing as the trip ends
  OPENH = 34, // ... feet height when the chute pops
  HIP = 8, // px from the feet to the hips (tp-person.js HIP)
  HANDS = 18, // px from the feet up to raised hands
  RISER = 7, // px of line from the hands to the canopy's rim
  BACK = 10, // px behind the landing spot where the canopy folds ...
  BACKY = 3, // ... and up the screen, so it lies behind them
  WOFF = 8; // px from the feet ahead to the cannon's wheel

// Cannon raster: 36 x 32 cells, the ground under the wheel at (18 - 5s, 29); the barrel pivots on the wheel's hub.
const CW = 36,
  CH = 32,
  GY = 29,
  HUB = 5, // px from the ground up to the hub
  WR = 5, // wheel radius
  ANG = (50 * Math.PI) / 180,
  LEN = 15, // px from the hub along the barrel to the muzzle's face
  CA = Math.cos(ANG),
  SA = Math.sin(ANG);
const gx = s => 18 - 5 * s,
  SPOKES = [0, 1, 2, 3].map(k => [Math.sin((k * Math.PI) / 4), Math.cos((k * Math.PI) / 4)]);
// The muzzle's face centre from the ground point under the wheel, in px (x for s = 1).
const MZ = [Math.round(LEN * CA), -HUB - Math.round(LEN * SA)];
// 1 outline, 2 iron dark, 3 iron, 4 iron light, 5 shine, 6 brass, 7 brass dark, 8 bore, 9 rim, 10 rim light,
// 11 spoke, 12 red wood, 13 red light, 14 red dark.
export function cannonPixels(s, lip = false) {
  const px = new Uint8Array(CW * CH),
    hx = gx(s),
    hy = GY - HUB;
  const barrel = (a, b) => {
    // a rounded breech, a slight taper, a flared muzzle
    const hw = a > 12.5 ? 4.2 : a < -1.5 ? Math.sqrt(Math.max(0, 12.96 - (a + 1.5) ** 2)) : 3.6 - (a + 1.5) / 23;
    const knob = Math.hypot(a + 5.6, b) < 1.4;
    if (a > LEN + 0.5 || (Math.abs(b) >= hw && !knob)) return 0;
    if (knob) return 1;
    if (Math.abs(b) > hw - 1 || a > LEN - 0.5) return 1;
    if (a > LEN - 1.6 && Math.abs(b) < hw - 1.8) return 8;
    if ((a > 2.5 && a < 4.2) || a > 12.5) return b < 0 ? 6 : 7;
    return b < -hw + 2 ? 5 : b < -0.8 ? 4 : b < 1.4 ? 3 : 2;
  };
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const qx = (x + 0.5 - hx) * s,
        qy = y + 0.5 - hy,
        a = qx * CA - qy * SA,
        b = qx * SA + qy * CA;
      let c = barrel(a, b);
      if (lip) {
        px[y * CW + x] = c && a > 11 ? c : 0;
        continue;
      }
      const d = Math.hypot(qx, qy - 0.2);
      // the trail: a red beam from the hub back down to the ground
      const tx = -12,
        ty = HUB - 1.2,
        tq = clamp((qx * tx + qy * ty) / (tx * tx + ty * ty)),
        td = Math.hypot(qx - tx * tq, qy - ty * tq);
      if (d < WR + 0.4) {
        const spoke = SPOKES.some(([sn, cs]) => Math.abs(qx * sn - qy * cs) < 0.5);
        c = d > WR - 0.6 ? 9 : d > WR - 1.3 ? 10 : d < 1.2 ? 6 : spoke ? 11 : c;
      } else if (!c && td < 1.9 && tq > 0.05) c = td > 1.1 ? 14 : qy < ty * tq ? 13 : 12;
      px[y * CW + x] = c;
    }
  return px;
}
const IRON = ['#22252d', '#3a404c', '#59616f', '#8590a2', '#c8d1dd', '#f2c14e', '#b9822a', '#101116'];
const WOOD = ['#4a2812', '#7a4620', '#9c6230', '#c2362f', '#e8624f', '#7a1d1a'];
// Canopy raster: 34 x 16 cells, the anchor (rim centre, or the ground under a pile) at (17, 15).
// Frames: packed, half open, full, deflating (leaning back), folded on the floor.
const PW = 34,
  PH = 16,
  PAX = 17,
  PAY = 15,
  SHAPES = [
    [3, 4, 0],
    [8, 7, 0],
    [13, 10, 0],
    [14, 6, -4],
    [12, 4, -2],
  ];
// 1 outline, 2 red, 3 red light, 4 white, 5 white shade, 6 line.
export function chutePixels(k, s) {
  const px = new Uint8Array(PW * PH),
    [hw, h, lean] = SHAPES[k];
  const inside = (x, y) => {
    const dy = PAY - y;
    if (dy < 0 || dy > h) return false;
    const sh = lean * s * (dy / h),
      dx = x + 0.5 - PAX - sh,
      lump = k === 4 ? 0.6 * Math.sin(dx * 1.3) : 0;
    return (dx / (hw + 0.5)) ** 2 + ((dy + lump) / (h + 0.5)) ** 2 <= 1;
  };
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || y === PAY;
      const dx = x + 0.5 - PAX - lean * s * ((PAY - y) / Math.max(1, h)),
        gore = Math.floor((dx / (hw + 1) + 1) * 3.5),
        red = gore % 2 === 0;
      px[y * PW + x] = edge ? 1 : red ? (y < PAY - h * 0.55 ? 3 : 2) : y > PAY - 2 ? 5 : 4;
    }
  return px;
}
const CLOTH = ['#6b1f1c', '#d8423a', '#f07462', '#f7f2e8', '#d3cabb'];
const hex = (c, k) => parseInt(c.slice(1 + 2 * k, 3 + 2 * k), 16);
const dim = c => `rgb(${[0, 1, 2].map(k => Math.round(hex(c, k) * 0.8 + 6)).join(',')})`;
const CPAL = [[...IRON, ...WOOD], [...IRON, ...WOOD].map(dim)],
  PPAL = [CLOTH, CLOTH.map(dim)];
// Rows: cannon by night (0, 1) then lip (0, 1), 4 cells each; canopy day, night: 5 frames x 2 facings each.
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = atlas(10 * PW, 2 * CH + 2 * PH, g => {
    for (let l = 0; l < 2; l++)
      for (let j = 0; j < 2; j++) {
        const s = j ? -1 : 1;
        Kit.bake(g, cannonPixels(s), CW, CH, (2 * l + j) * CW, c => CPAL[l][c - 1], 0);
        Kit.bake(g, cannonPixels(s, true), CW, CH, (2 * l + j) * CW, c => CPAL[l][c - 1], CH);
        for (let k = 0; k < SHAPES.length; k++)
          bake(g, chutePixels(k, s), PW, PH, (2 * k + j) * PW, c => PPAL[l][c - 1], 2 * CH + l * PH);
      }
  }));
// The cannon (or its lip only) with the ground under its wheel at (px, py).
function cannon(X, px, py, s, lip) {
  const col = (2 * (X.night ? 1 : 0) + (s > 0 ? 0 : 1)) * CW;
  X.stamp(sheetOf(), col, lip ? CH : 0, CW, CH, px - gx(s), py - GY, CW, CH);
}
// The canopy frame k with its anchor at (px, py).
function chute(X, k, px, py, s) {
  const col = (2 * k + (s > 0 ? 0 : 1)) * PW;
  X.stamp(sheetOf(), col, 2 * CH + (X.night ? PH : 0), PW, PH, px - PAX, py - PAY, PW, PH);
}

// shortcut: read every frame, so an early re-aim to the other side flips it in one frame; tp has no fixed side yet.
const side = X => (X.dir0[0] >= 0 ? 1 : -1),
  hop0 = stool => (stool ? SQUEEZE : B.HOP),
  cruise = len => Math.min(110, Math.max(40, 20 + 2.8 * (len || 0)));

// Smoke puffs from a flat list (x, y, radius): a shade under, the puff, a light top; one fill per tone.
const SMOKE = [
  ['#aaa59b', '#e6e3dc', '#ffffff'],
  ['#5d6475', '#9aa1b2', '#c9cedb'],
  ['#7f7c78', '#bdbab4', '#eeece8'], // greyer over snow
];
function puffs(X, list, alpha) {
  const ctx = X.ctx;
  if (!list.length || alpha <= 0.01) return;
  const tone = SMOKE[X.night ? 1 : X.snow > 0 ? 2 : 0];
  ctx.globalAlpha = Math.min(1, alpha);
  for (let l = 0; l < 3; l++) {
    ctx.beginPath();
    for (let j = 0; j < list.length; j += 3) {
      const x = list[j],
        y = list[j + 1],
        q = list[j + 2] - (l === 2 ? 1 : 0);
      if (q < 0 || (l === 2 && q < 1)) continue;
      const oy = l === 0 ? 1 : l === 2 ? -1 : 0,
        ox = l === 2 ? -1 : 0;
      if (q <= 1) ctx.rect(x + ox, y + oy, q + 1, q + 1);
      else {
        ctx.rect(x + ox - q, y + oy - q + 1, 2 * q + 1, 2 * q - 1);
        ctx.rect(x + ox - q + 1, y + oy - q, 2 * q - 1, 2 * q + 1);
      }
    }
    ctx.fillStyle = tone[l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
const DUST = [
  ['#d9cfbb', '#fbf6ea'],
  ['#8f897e', '#c9c2b4'],
  ['#8496ad', '#b9c7d8'],
];
// Dust kicked out round the feet of an end over p 0-1.
function dust(X, px, py, end, p, n) {
  if (p <= 0 || p >= 1) return;
  const ctx = X.ctx,
    snowy = X.snow > 0 && (end ? outdoors(X.tx1, X.ty1) : outdoors(X.tx0, X.ty0)),
    col = DUST[snowy ? 2 : X.night ? 1 : 0],
    d = 5 + 10 * out2(p),
    lift = Math.round(3 * p);
  ctx.globalAlpha = 0.9 * (1 - in2(p)) * X.L.C;
  for (let l = 0; l < 2; l++) {
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 2 * Math.PI + X.hash(k, 5),
        x = Math.round(px + d * Math.cos(a)) - 1,
        y = Math.round(py + 0.5 * d * Math.sin(a)) - 1 - lift;
      if (l) ctx.rect(x, y - 1, 2, 1);
      else ctx.rect(x - 1, y - 1, 4, 3);
    }
    ctx.fillStyle = col[l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// The departure at core v: cannon ground point and frame offset, body feet, clip and pose.
const D = { cx: 0, cy: 0, ca: 1, fx: 0, fy: 0, clip: 0, pose: null, legs: 1, lip: false, body: true, fuse: -1 };
function departure(X, v, secs) {
  const s = side(X),
    stool = X.tp.stool,
    h0 = hop0(stool),
    top = h0 + B.TOP,
    inn = Math.min(h0 + B.IN, DEP - 0.03); // a stool sitter climbs in quicker
  D.cx = X.x0 + s * WOFF;
  const fall = r(v, B.DROP, B.THUD),
    bounce = Math.round(3 * Math.sin(Math.PI * r(v, B.THUD, B.SET)));
  D.cy = X.y0 - Math.round(DROPH * (1 - in2(fall))) - bounce;
  D.ca = v >= B.DROP ? 1 : 0;
  if (v >= B.SHAKE) D.cx += Math.round(Math.sin(secs * 70) * (0.6 + r(v, B.SHAKE, DEP)));
  D.fuse = v >= B.FUSE ? r(v, B.FUSE, DEP - 0.01) : -1;
  D.fx = X.x0;
  D.fy = X.y0;
  D.clip = 0;
  D.pose = null;
  D.legs = 1;
  D.lip = false;
  D.body = true;
  if (v < h0 - (stool ? 0 : 0.025)) return D;
  const mx = D.cx + s * MZ[0],
    my = D.cy + MZ[1];
  D.pose = 'up';
  if (v < h0) {
    D.pose = 'stand';
    D.legs = 0.6; // a crouch before the jump
    return D;
  }
  if (v < top) {
    // up and over the muzzle
    const p = r(v, h0, top),
      y1 = my - 3;
    D.fx = Math.round(lerp(X.x0, mx, ease(p)));
    D.fy = Math.round(lerp(X.y0 - (stool === 2 ? 5 : 0), y1, p) - 7 * Math.sin(Math.PI * p));
    return D;
  }
  // feet first down the barrel, the part below the rim hidden
  const sink = Math.round(lerp(-3, 30, ease(r(v, top, inn))));
  D.fx = mx;
  D.fy = my + sink;
  D.clip = Math.max(0, sink + 1);
  D.lip = true;
  D.body = sink < 29;
  return D;
}

// The flight at trip fraction t: hips (px), feet height over the ground point, the ground tile, the body's turn.
const F = { hx: 0, hy: 0, h: 0, gx: 0, gy: 0, rot: 0, chute: -1, sway: 0 },
  F2 = { ...F };
function hips(X, t, o) {
  const s = side(X),
    hide = X.L.hide,
    h0 = hide ? 2 : -MZ[1] - HIP,
    hO = OPENH,
    hE = ARRH,
    hump = cruise(X.tp.len);
  let p, h;
  if (t < B.OPEN) {
    const q = t / B.OPEN;
    p = 0.86 * q;
    h = lerp(h0, hO, q) + 4 * hump * q * (1 - q);
  } else {
    const q = (t - B.OPEN) / (1 - B.OPEN);
    p = 0.86 + 0.14 * out2(q);
    h = lerp(hO, hE, ease(q)) + 5 * Math.sin(Math.PI * r(q, 0, 0.4));
  }
  o.gx = lerp(X.tx0, X.tx1, p);
  o.gy = lerp(X.ty0, X.ty1, p);
  o.h = h;
  o.hx = Math.round(lerp(X.x0 + (hide ? 0 : s * (WOFF + MZ[0])), X.x1, p));
  o.hy = Math.round(lerp(X.y0, X.y1, p) - h - HIP);
  o.rot = 0;
  o.chute = t >= B.OPEN ? r(t, B.OPEN, B.OPEN + 0.1) : -1;
  o.sway = 0;
  return o;
}
function flight(X, t, secs) {
  const s = side(X);
  hips(X, t, F);
  if (F.chute >= 0) {
    F.sway = Math.round(1.5 * Math.sin(secs * 4.2));
    return F;
  }
  // head first along the motion (a step ahead at the shot, which has no past); a somersault over the top
  const k = t < 0.02 ? -1 : 1;
  hips(X, t - 0.02 * k, F2);
  const dx = k * (F.hx - F2.hx) * s,
    dy = k * (F2.hy - F.hy),
    ang = Math.atan2(dy, Math.max(0.01, dx)),
    fwd = s > 0 ? 1 : 3;
  F.rot = ang > 1 ? 0 : ang < -1 ? 2 : fwd;
  const f = r(t, B.FLIP, B.FLIP + 0.16);
  if (f > 0 && f < 1) F.rot = (((fwd + s * Math.floor(f * 4)) % 4) + 4) % 4;
  return F;
}

// The descent at core v: feet over the landing, canopy frame and anchor, pose.
const A = { fx: 0, fy: 0, h: 0, k: 2, kx: 0, ky: 0, lines: true, pose: 'up', legs: 1 };
function arrival(X, v, secs) {
  const s = side(X),
    x = r(v, ARR, B.DOWN),
    sway = Math.round(1.5 * Math.sin(secs * 4.2) * (1 - x));
  A.h = ARRH * (1 - x);
  A.fx = X.x1 + sway;
  A.fy = X.y1 - Math.round(A.h);
  A.legs = v >= B.DOWN && v < B.DOWN + 0.03 ? 0.7 : 1;
  A.pose = v < B.TADA ? 'up' : 'stand';
  A.lines = v < B.DOWN + 0.015;
  if (v < B.DOWN) {
    A.k = 2;
    A.kx = A.fx - sway;
    A.ky = A.fy - HANDS - RISER;
    return A;
  }
  // the canopy sinks back and folds down behind them
  const f = ease(r(v, B.DOWN, B.FOLD));
  A.k = f < 0.35 ? 2 : f < 1 ? 3 : 4;
  A.kx = Math.round(lerp(X.x1, X.x1 - s * BACK, f));
  A.ky = Math.round(lerp(X.y1 - HANDS - RISER, X.y1 - BACKY, f));
  return A;
}

// Smoke trail: puffs dropped on a jittered beat of idle time where the hips were then, swelling and fading. Sizes and
// spacing vary by hash and the tail thins out, so it reads as a plume, not a bead chain. Pure in the clock.
const RATE = 60,
  LIFE = 0.6,
  SP = [];
function trail(X) {
  const L = X.L,
    tp = X.tp;
  SP.length = 0;
  if (L.cut) return SP;
  for (let i = Math.floor(L.secs * RATE); i > (L.secs - LIFE) * RATE; i--) {
    // a crowd keeps the same beat and skips every other puff, so nothing reshuffles when it starts or ends
    if (X.lite && i % 2) continue;
    const ts = (i + 0.8 * X.hash(i, 6)) / RATE,
      t = r(TeleportLogic.core(ts, tp.d), DEP, ARR),
      age = L.secs - ts,
      f = age / LIFE;
    if (age < 0 || t <= 0 || t > B.OPEN || (f > 0.45 && X.hash(i, 8) < 1.8 * (f - 0.45))) continue;
    hips(X, t, F2);
    const big = f < 0.08 ? 1 : f < 0.3 ? 3 : f < 0.55 ? 2 : 1,
      vary = X.hash(i, 4);
    SP.push(
      F2.hx + Math.round((X.hash(i, 3) - 0.5) * 6),
      F2.hy + Math.round((X.hash(i, 7) - 0.5) * 4) - Math.round(6 * age),
      Math.max(1, big + (vary < 0.3 ? -1 : vary > 0.82 && f < 0.3 ? 1 : 0)),
    );
  }
  return SP;
}
// A jagged muzzle blast at (x, y): white heart, yellow star, orange tips.
const BLAST = ['#ff8a2b', '#ffd84a', '#ffffff'];
function blast(X, x, y, p) {
  if (p <= 0 || p >= 1) return;
  const ctx = X.ctx,
    k = p < 0.5 ? 1 : 0.6;
  for (let l = 0; l < 3; l++) {
    const n = Math.round((7 - 2 * l) * k);
    ctx.beginPath();
    ctx.rect(x - n, y - 1, 2 * n + 1, 3);
    ctx.rect(x - 1, y - n, 3, 2 * n + 1);
    if (l < 2) {
      const m = Math.round(n * 0.6);
      for (const [dx, dy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ])
        ctx.rect(x + dx * m - (dx < 0), y + dy * m - (dy < 0), 2, 2);
    }
    ctx.fillStyle = BLAST[l];
    ctx.fill();
  }
}

// The cannon after the shot (the mark from age 0 at DEP): recoil, a blast, a burst of smoke, a wisp, then a poof.
const SM = [];
function smoking(X, px, py, s, age, hide) {
  SM.length = 0;
  const out = r(age, M.STAY, M.STAY + M.OUT);
  if (hide) return;
  if (out < 1) {
    const kick = age < 0.05 ? r(age, 0, 0.05) : 1 - ease(r(age, 0.05, 0.4)),
      hop = Math.round(2 * Math.sin(Math.PI * r(age, 0, 0.25))),
      cx = px - s * Math.round(4 * kick),
      cy = py - hop;
    Kit.shadow(X.ctx, px, py + 1, 22, 0.8 * (1 - out));
    X.ctx.globalAlpha = 1 - out;
    cannon(X, cx, cy, s, false);
    X.ctx.globalAlpha = 1;
    const mx = cx + s * (MZ[0] + 2),
      my = cy + MZ[1] - 2;
    const n = X.lite ? 4 : 7;
    // the cloud out of the muzzle, rolling up and out along the barrel
    for (let k = 0; k < n && age < 1.2; k++) {
      const f = r(age, 0, 1.2),
        d = (1 + 2.8 * k) * (0.3 + 0.7 * out2(f)),
        side = (k % 2 ? 1 : -1) * (1 + 0.5 * k) * out2(f),
        big = k < 3 ? 4 : k < 5 ? 3 : 2;
      SM.push(
        Math.round(mx + s * (d * CA + side * SA)),
        Math.round(my - d * SA + side * CA - 10 * f * (k / n)),
        Math.max(1, big - Math.floor(3 * in2(f))),
      );
    }
    for (let k = 0; k < 3 && age > 0.6 && age < M.STAY; k++) {
      const g = (age * 1.2 + k / 3) % 1;
      SM.push(mx + Math.round(2 * Math.sin(age * 3 + k * 2)), my - Math.round(14 * g), g < 0.5 ? 1 : 0);
    }
    puffs(X, SM, 0.95);
    blast(X, mx + s * 3, my - 2, r(age, 0, 0.16));
  }
  if (out <= 0) return;
  // the poof it goes in
  SM.length = 0;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 2 * Math.PI,
      d = 4 + 8 * out2(out);
    SM.push(Math.round(px + d * Math.cos(a)), Math.round(py - 8 + 0.6 * d * Math.sin(a)), out < 0.6 ? 3 : 2);
  }
  puffs(X, SM, 1 - in2(out));
}

const O = { pose: null, front: null, alpha: 1, legs: 1, clip: null, rot: 0 },
  CLIP = [60, 0];
function body(X, fx, fy, pose, alpha, legs, clip, rot) {
  O.pose = pose;
  O.front = pose ? true : null;
  O.alpha = alpha;
  O.legs = legs < 1 ? legs : null;
  CLIP[1] = clip;
  O.clip = clip > 0 ? CLIP : null;
  O.rot = rot || null;
  // standing on their own feet: drawn in place, so the page's own shadow comes with it
  const own = X.L.sw ? fx === X.x1 && fy === X.y1 : fx === X.x0 && fy === X.y0;
  if (own && !O.legs && !O.clip && !O.rot) X.body(O);
  else X.bodyAt(fx, fy, O);
}
// Cannon, body and lip: one picture at the origin.
function drawDeparture(X) {
  const L = X.L,
    s = side(X),
    C = L.C,
    p = departure(X, L.v, L.secs);
  X.ctx.globalAlpha = p.ca * C;
  cannon(X, p.cx, p.cy, s, false);
  X.ctx.globalAlpha = 1;
  if (p.fuse >= 0) {
    // a fizzing spark creeping to the touch hole at the breech
    const tx = p.cx - s * 2,
      ty = p.cy - HUB - 4,
      k = Math.round(5 * (1 - p.fuse)),
      on = Math.floor(L.secs * 20) % 2;
    X.ctx.fillStyle = '#5a4630';
    if (k > 0) X.ctx.fillRect(s > 0 ? tx - k : tx + 1, ty - 1, k, 1);
    X.ctx.fillStyle = on ? '#fff3a8' : '#ff8a2b';
    X.ctx.fillRect(tx - s * k - 1, ty - 2 - on, 2, 2);
    X.ctx.fillStyle = '#ffd84a';
    X.ctx.fillRect(tx - s * k + (on ? 1 : -2), ty - 4 + on, 1, 1);
  }
  // the person is real: a cut fades only the cannon
  if (p.body) body(X, p.fx, p.fy, p.pose, 1, p.legs, p.clip, 0);
  if (p.lip) cannon(X, p.cx, p.cy, s, true);
}
function drawFlight(X) {
  const L = X.L,
    s = side(X),
    t = L.trip,
    f = flight(X, t, L.secs),
    a = L.hide ? r(t, 0, 0.15) : 1;
  puffs(X, trail(X), 0.85 * a);
  if (L.hide && t < 0.25) {
    // a hidden starter bursts out of the doorway in a cloud
    SM.length = 0;
    const q = r(t, 0, 0.25);
    for (let k = 0; k < 5; k++)
      SM.push(X.x0 + Math.round((k - 2) * (3 + 5 * q)), X.y0 - 3 - Math.round(4 * q) - (k % 2) * 2, q < 0.6 ? 3 : 2);
    puffs(X, SM, 1 - in2(q));
  }
  if (f.chute >= 0) {
    const k = f.chute < 0.35 ? 0 : f.chute < 0.7 ? 1 : 2,
      fy = f.hy + HIP;
    X.ctx.globalAlpha = a;
    chute(X, k, f.hx - f.sway, fy - HANDS - RISER + (k === 2 ? 0 : 4 - 2 * k), s);
    X.ctx.globalAlpha = 1;
    if (k === 2) lines(X, f.hx - f.sway, fy - HANDS - RISER, f.hx, fy - HANDS);
    body(X, f.hx, fy, 'up', a, 1, 0, 0);
    return;
  }
  body(X, f.hx, f.hy + HIP, 'up', a, 1, 0, f.rot);
}
// Four risers from the canopy's rim down to the two hands.
function lines(X, cx, cy, hx, hy) {
  const ctx = X.ctx;
  ctx.beginPath();
  for (const [rx, hd] of [
    [-12, -5],
    [-5, -5],
    [5, 5],
    [12, 5],
  ])
    Kit.line(cx + rx, cy, hx + hd, hy, (x, y) => ctx.rect(x, y, 1, 1));
  ctx.fillStyle = X.night ? '#c9bfb4' : '#5a4a40';
  ctx.fill();
}
function drawArrival(X) {
  const L = X.L,
    s = side(X),
    p = arrival(X, L.v, L.secs);
  chute(X, p.k, p.kx, p.ky, s);
  if (p.lines) lines(X, p.kx, p.ky, p.fx, p.fy - HANDS);
  body(X, p.fx, p.fy, p.pose, L.C, p.legs, 0, 0);
}

const PART = Kit.PART;
export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q || v >= REL) return 0;
    let n = 0;
    if (!L.hide && !L.sw && v >= B.DROP) n |= PART.F0;
    if (L.trip >= 0) n |= PART.TRIP | PART.SHADOW;
    if (L.sw && v >= ARR) n |= PART.F1;
    return n;
  },
  floor(X, end) {
    const L = X.L,
      v = L.v;
    if (!end) {
      const p = departure(X, v, L.secs),
        h = X.y0 - p.cy;
      Kit.shadow(X.ctx, p.cx, X.y0 + 1, 22 - h / 4, (0.9 - h / 60) * p.ca * L.C);
      dust(X, p.cx, X.y0, 0, r(v, B.THUD, B.THUD + B.PUFF), X.lite ? 5 : 8);
      return;
    }
    const p = arrival(X, v, L.secs);
    if (v < B.DOWN + 0.03) Kit.shadow(X.ctx, X.x1, X.y1, 16 - p.h / 3, 0.9 - p.h / 30);
    dust(X, X.x1, X.y1, 1, r(v, B.DOWN, B.DOWN + B.PUFF), X.lite ? 5 : 8);
  },
  trip(X) {
    drawFlight(X);
  },
  // The feet's ground point and real height: low leaving the muzzle and hanging over the landing.
  ground(X, out) {
    const f = hips(X, Math.max(0, X.L.trip), F2);
    out[0] = f.gx;
    out[1] = f.gy;
    out[2] = Math.max(0, f.h);
    return true;
  },
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || (L.sw && v >= REL)) return false;
    if (L.hide && !L.sw) return true;
    if (!L.sw) {
      if (v < B.DROP) return false;
      drawDeparture(X);
      return true;
    }
    if (v < ARR) return true;
    drawArrival(X);
    return true;
  },
  // The cannon smoking where they left (from the shot), and the canopy folded at the landing (from the release).
  marks: [
    { at: 'dep', end: 0, ttl: M.TTL, layer: 'stand' },
    { at: 'rel', end: 1, ttl: M.PILE, layer: 'floor' },
  ],
  drawMark(X, m, age) {
    const s = X.dir0[0] >= 0 ? 1 : -1;
    if (m.k === 0) {
      smoking(X, X.x0 + s * WOFF, X.y0, s, age, m.hide);
      return;
    }
    const out = r(age, M.PILE - M.PILE_OUT, M.PILE);
    X.ctx.globalAlpha = 1 - out;
    chute(X, 4, X.x0 - s * BACK, X.y0 - BACKY, s);
    X.ctx.globalAlpha = 1;
  },
  gap: null,
};
// Exposed for tests.
export const CANNON = { B, M, MZ, ARRH, OPENH, HIP, HANDS, RISER, BACK, hop0, departure, flight, arrival, trail, hips };
