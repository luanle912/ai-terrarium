// cutpaste: a giant arrow cursor drags a marching-ants marquee round the person, CTRL+X cuts them out (a checkerboard
// "transparent" hole stays behind), the cursor grabs the floating clip and drags it over the island, CTRL+V drops it
// at the desk, a flash pastes it and the selection blinks off.
// One body pass a frame: at the ends from person() (the walker's depth, stools included), in the drag from trip().
// The cursor and the key chips ride the trip item, which is the overlay outside the drag.
import { Kit } from './tp-kit.js';

const { atlas, bake, clamp, r, out2, in2, ease, lerp } = Kit;
const DEP = 0.42,
  ARR = 0.54,
  REL = 0.92,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  B = {
    CIN: at(0.1), // the cursor slides in to the box's top-left corner
    MQ0: at(0.1), // and drags the marquee to the bottom-right
    MQ1: at(0.36),
    KEY0: at(0.4), // the CTRL+X chip pops up
    KEY1: at(0.48),
    PRESS0: at(0.56), // X held down
    PRESS1: at(0.7),
    CUT: 0.26, // the cut, on SQUEEZE: a stool sitter stands up under its flash
    MOVE0: at(0.64), // the cursor goes to the grab point
    MOVE1: at(0.84),
    GRAB: at(0.86), // button down: the clip lifts
    KEYF0: at(0.78),
    KEYF1: at(0.92),
    VIN0: ar(0), // the CTRL+V chip
    VIN1: ar(0.08),
    VDOWN0: ar(0.22),
    VDOWN1: ar(0.38),
    DROP0: ar(0.24), // the clip drops to the floor
    DROP1: ar(0.34),
    PASTE: ar(0.34), // pasted: a flash, the tint gone
    UP: ar(0.36), // button up
    AWAY0: ar(0.44), // the cursor leaves
    AWAY1: ar(0.7),
    VF0: ar(0.56),
    VF1: ar(0.72),
    DESEL: ar(0.6), // the box blinks off: off, on, off
    BLINK: ar(0.66),
    GONE: ar(0.72),
  },
  LIFT = 6, // px the grabbed clip floats over the floor
  GRAB = [3, -15], // the cursor's tip on the clip, from the feet (the right shoulder)
  FLASH = 0.03, // core
  CLICK = 0.045, // core: the click rays
  DASH = 2,
  INK = '#11151c',
  WHITE = '#ffffff',
  TINT = ['rgba(64,156,255,0.26)', 'rgba(110,180,255,0.3)'],
  GHOST = '#5aa9ff',
  GH = [0.5, 0.25], // the trailing outlines' alpha, nearest first
  // the selection round the feet [x, y, w, h]: standing, on a stool, on a high stool (bounds of every look, a hat
  // included, plus a margin)
  BOX = [
    [-8, -26, 17, 28],
    [-8, -30, 17, 32],
    [-8, -35, 17, 32],
  ];

const boxOf = stool => BOX[stool === 2 ? 2 : stool ? 1 : 0];
const marquee = v => ease(r(v, B.MQ0, B.MQ1));
const clipped = v => v >= B.CUT && v < B.PASTE;
function flash(v) {
  if (v >= B.CUT && v < B.CUT + FLASH) return 1 - r(v, B.CUT, B.CUT + FLASH);
  if (v >= B.PASTE && v < B.PASTE + FLASH) return 1 - r(v, B.PASTE, B.PASTE + FLASH);
  return 0;
}
// px the clip floats at an end (the drag has its own height).
function lift(v) {
  if (v < B.GRAB) return 0;
  if (v < DEP) return LIFT * out2(r(v, B.GRAB, DEP));
  if (v < B.DROP0) return LIFT;
  return LIFT * (1 - in2(r(v, B.DROP0, B.DROP1)));
}
// The drag: e along the chord (slow off, slow in) and h px over the floor, higher on a longer trip.
function drag(p, len) {
  const e = ease(clamp(p)),
    H = Math.min(40, Math.max(10, 6 + 1.1 * (len || 0)));
  return { e, h: LIFT + 4 * H * e * (1 - e) };
}
const ants = v => (v < B.MQ0 || (v >= B.DESEL && v < B.BLINK) || v >= B.GONE ? 0 : 1);
// The checkerboard left at the origin: from the cut, fading in the first half of the drag.
function hole(v, trip) {
  if (v < B.CUT || v >= ARR) return 0;
  return trip >= 0 ? 1 - r(trip, 0.15, 0.6) : 1;
}
const K = { ch: 'X', a: 0, down: false, rise: 0 };
// The key chip: which, alpha, held down, how far it has risen (0-1).
function keys(v) {
  K.ch = v < ARR ? 'X' : 'V';
  if (v < DEP) {
    K.a = r(v, B.KEY0, B.KEY1) * (1 - r(v, B.KEYF0, B.KEYF1));
    K.down = v >= B.PRESS0 && v < B.PRESS1;
    K.rise = out2(r(v, B.KEY0, B.KEY1));
  } else if (v >= ARR) {
    K.a = r(v, B.VIN0, B.VIN1) * (1 - r(v, B.VF0, B.VF1));
    K.down = v >= B.VDOWN0 && v < B.VDOWN1;
    K.rise = out2(r(v, B.VIN0, B.VIN1));
  } else K.a = 0;
  return K;
}
// The cursor's tip from the feet at an end and its alpha: out = [x, y, a]. b0 the box before the cut, b after it.
function cursor(v, b0, b, lf, out) {
  const gx = GRAB[0],
    gy = GRAB[1] - lf,
    rx = b0[0] + b0[2] - 1,
    ry = b0[1] + b0[3] - 1;
  out[2] = 1;
  if (v < B.MQ0) {
    const p = out2(r(v, 0, B.CIN));
    out[0] = Math.round(b0[0] - 6 * (1 - p));
    out[1] = Math.round(b0[1] - 8 * (1 - p));
    out[2] = p;
  } else if (v < B.MQ1) {
    const g = marquee(v);
    out[0] = b0[0] + Math.round((b0[2] - 1) * g);
    out[1] = b0[1] + Math.round((b0[3] - 1) * g);
  } else if (v < B.MOVE0) {
    out[0] = rx;
    out[1] = ry;
  } else if (v < B.AWAY0) {
    const m = v < DEP ? ease(r(v, B.MOVE0, B.MOVE1)) : 1;
    out[0] = Math.round(lerp(rx, gx, m));
    out[1] = Math.round(lerp(ry, gy, m));
  } else {
    const m = out2(r(v, B.AWAY0, B.AWAY1));
    out[0] = Math.round(gx + 14 * m);
    out[1] = Math.round(gy - 18 * m);
    out[2] = 1 - r(v, B.AWAY0, B.AWAY1);
  }
  return out;
}

// The atlas: the CTRL+X and CTRL+V chips (up, down), the arrow cursor and the day and night checkerboards.
const CW = 35, // chip
  CH = 10,
  AX = 36, // arrow
  AW = 12,
  AH = 19,
  QX = 49, // checkerboards, the standing box's size
  QW = 17,
  QH = 28,
  CELL = 3,
  ARROW = [
    'k',
    'kk',
    'kwk',
    'kwwk',
    'kwwwk',
    'kwwwwk',
    'kwwwwwk',
    'kwwwwwwk',
    'kwwwwwwwk',
    'kwwwwwwwwk',
    'kwwwwwwwwwk',
    'kwwwwwwkkkkk',
    'kwwwkwwk',
    'kwwkkwwk',
    'kwk..kwwk',
    'kk...kwwk',
    'k.....kwwk',
    '......kwwk',
    '.......kk',
  ],
  CHECK = [
    ['#ffffff', '#c8cdd5'],
    ['#646b78', '#454b56'],
  ],
  KEYC = { line: '#1f2430', face: '#f1f3f6', top: '#ffffff', side: '#9aa2ae' };
export function arrowPixels() {
  const px = new Uint8Array(AW * AH);
  ARROW.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) px[y * AW + x] = row[x] === 'k' ? 1 : row[x] === 'w' ? 2 : 0;
  });
  return px;
}
// One keycap, w wide, its face pressed down by d px.
function keycap(g, x, y, w, d, label) {
  g.fillStyle = KEYC.line;
  g.fillRect(x + 1, y + d, w - 2, 1);
  g.fillRect(x, y + 1 + d, 1, 8 - d);
  g.fillRect(x + w - 1, y + 1 + d, 1, 8 - d);
  g.fillRect(x + 1, y + 9, w - 2, 1);
  g.fillStyle = KEYC.side;
  g.fillRect(x + 1, y + 7 + d, w - 2, 2 - d);
  g.fillStyle = KEYC.face;
  g.fillRect(x + 1, y + 1 + d, w - 2, 6);
  g.fillStyle = KEYC.top;
  g.fillRect(x + 1, y + 1 + d, w - 2, 1);
  Kit.text(g, label, x + w / 2, y + 7 + d, KEYC.line);
}
// CTRL, a white plus with a dark rim, then the letter key.
function chip(g, y, ch, down) {
  keycap(g, 0, y, 19, 0, 'CTRL');
  g.fillStyle = KEYC.line;
  g.fillRect(21, y + 3, 3, 5);
  g.fillRect(20, y + 4, 5, 3);
  g.fillStyle = WHITE;
  g.fillRect(22, y + 4, 1, 3);
  g.fillRect(21, y + 5, 3, 1);
  keycap(g, 26, y, 9, down ? 1 : 0, ch);
}
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = atlas(QX + 2 * QW + 1, 4 * CH, g => {
    ['X', 'V'].forEach((ch, i) => [0, 1].forEach(d => chip(g, (2 * i + d) * CH, ch, d)));
    bake(g, arrowPixels(), AW, AH, AX, c => (c === 1 ? INK : WHITE));
    CHECK.forEach((cols, n) => {
      const x0 = QX + n * (QW + 1);
      for (let y = 0; y < QH; y += CELL)
        for (let x = 0; x < QW; x += CELL) {
          g.fillStyle = cols[((x + y) / CELL) & 1];
          g.fillRect(x0 + x, y, Math.min(CELL, QW - x), Math.min(CELL, QH - y));
        }
    });
  }));

// Marching ants round [x, y, w, h]: dashes of DASH px, black then white, ph px along. Two fills.
const EDGE = [
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
];
const edge = (k, ...v) => v.forEach((n, j) => (EDGE[k][j] = n));
function antsAt(ctx, x, y, w, h, ph, a) {
  if (a <= 0.01 || w < 2 || h < 2) return;
  edge(0, x, y, 1, 0, w);
  edge(1, x + w - 1, y + 1, 0, 1, h - 1);
  edge(2, x + w - 2, y + h - 1, -1, 0, w - 1);
  edge(3, x, y + h - 2, 0, -1, h - 2);
  ctx.globalAlpha = a;
  for (let c = 0; c < 2; c++) {
    ctx.beginPath();
    let k = ph;
    for (const [sx, sy, dx, dy, n] of EDGE) {
      for (let s = 0; s < n; ) {
        const col = Math.floor((k + s) / DASH) & 1;
        let e = s + 1;
        while (e < n && (Math.floor((k + e) / DASH) & 1) === col) e++;
        if (col === c) {
          const L = e - s;
          if (dx) ctx.rect(dx > 0 ? sx + s : sx - e + 1, sy, L, 1);
          else ctx.rect(sx, dy > 0 ? sy + s : sy - e + 1, 1, L);
        }
        s = e;
      }
      k += n;
    }
    ctx.fillStyle = c ? WHITE : INK;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// The four corner handles: dark 3 px squares with a white middle.
function handles(ctx, x, y, w, h, a) {
  if (a <= 0.01) return;
  ctx.globalAlpha = a;
  for (let c = 0; c < 2; c++) {
    ctx.beginPath();
    for (const [hx, hy] of [
      [x - 1, y - 1],
      [x + w - 2, y - 1],
      [x - 1, y + h - 2],
      [x + w - 2, y + h - 2],
    ])
      if (c) ctx.rect(hx + 1, hy + 1, 1, 1);
      else ctx.rect(hx, hy, 3, 3);
    ctx.fillStyle = c ? WHITE : INK;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function fillBox(ctx, x, y, w, h, col, a) {
  if (a <= 0.01) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
}
// The page's own shadow under a lifted body (the remapped pass draws none).
function shadowAt(X, px, py, a) {
  const ctx = X.ctx;
  ctx.globalAlpha = a;
  ctx.fillStyle = (X.G.th && X.G.th.shadow) || 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(px, py, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
const phase = L => Math.floor(L.secs * 16);
// The selection over a body whose feet are at (fx, fy): tint while it is a clip, flash, ants, handles.
function selection(X, fx, fy, b, v, show, a) {
  const ctx = X.ctx,
    x = fx + b[0],
    y = fy + b[1];
  if (clipped(v)) fillBox(ctx, x, y, b[2], b[3], TINT[X.night ? 1 : 0], a);
  fillBox(ctx, x, y, b[2], b[3], WHITE, a * 0.85 * flash(v));
  if (!show) return;
  const g = v < DEP ? marquee(v) : 1;
  antsAt(ctx, x, y, Math.round(b[2] * g), Math.round(b[3] * g), phase(X.L), a * ants(v));
  if (!X.lite && g >= 1 && v < B.DESEL) handles(ctx, x, y, b[2], b[3], a);
}
// Click rays off the cursor's tip (up and left, clear of the arrow), t 0-1.
function click(X, x, y, t) {
  if (t <= 0 || t >= 1 || X.lite) return;
  const ctx = X.ctx,
    d = 2 + Math.round(3 * out2(t));
  ctx.globalAlpha = X.L.C * (1 - t);
  ctx.beginPath();
  ctx.rect(x, y - d - 2, 1, 2);
  ctx.rect(x - d - 2, y, 2, 1);
  ctx.rect(x - d - 1, y - d - 1, 1, 1);
  ctx.rect(x - d, y - d, 1, 1);
  ctx.fillStyle = X.night ? WHITE : INK;
  ctx.fill();
  ctx.globalAlpha = 1;
}
function arrow(X, x, y, a) {
  if (a <= 0.01) return;
  X.ctx.globalAlpha = Math.min(1, a);
  X.stamp(sheetOf(), AX, 0, AW, AH, x, y, AW, AH);
  X.ctx.globalAlpha = 1;
}
// The CTRL+X or CTRL+V chip, centred over the box at feet (fx, fy).
function chipAt(X, fx, fy, b, v) {
  const k = keys(v);
  if (k.a <= 0.01) return;
  const row = (k.ch === 'X' ? 0 : 2) + (k.down ? 1 : 0),
    y = fy + b[1] - 3 - CH + Math.round(3 * (1 - k.rise));
  X.ctx.globalAlpha = X.L.C * k.a * (X.night ? 0.92 : 1);
  X.stamp(sheetOf(), 0, row * CH, CW, CH, fx - 17, y, CW, CH);
  X.ctx.globalAlpha = 1;
}
const Q = [0, 0, 0];
// The overlay at an end: the chip and the cursor (with its clicks).
function hud(X, fx, fy, v) {
  const b0 = v < ARR ? boxOf(X.tp.stool) : BOX[0],
    lf = lift(v);
  chipAt(X, fx, fy, v < ARR ? b0 : BOX[0], v);
  cursor(v, b0, BOX[0], lf, Q);
  arrow(X, fx + Q[0], fy + Q[1], X.L.C * Q[2]);
  click(X, fx + Q[0], fy + Q[1], v < ARR ? r(v, B.GRAB, B.GRAB + CLICK) : r(v, B.UP, B.UP + CLICK));
}
// The drag: faint outlines trailing, the body, its selection and the cursor holding it.
function dragged(X) {
  const L = X.L,
    len = X.tp.len,
    a = L.hide ? 0.3 + 0.7 * r(L.trip, 0, 0.08) : 1,
    b = BOX[0],
    g = drag(L.trip, len),
    px = Math.round(lerp(X.x0, X.x1, g.e)),
    py = Math.round(lerp(X.y0, X.y1, g.e) - g.h);
  if (!X.lite) {
    // trailing outlines a few px back along the motion, so they gather under the clip as it slows
    const q = drag(L.trip - 0.03, len),
      dx = px - lerp(X.x0, X.x1, q.e),
      dy = py - lerp(X.y0, X.y1, q.e) + q.h,
      n = Math.hypot(dx, dy),
      s = n > 0.5 ? Math.min(1, n / 6) * (5 / n) : 0;
    for (let j = 2; j >= 1; j--)
      if (s) outline(X.ctx, px + b[0] - Math.round(dx * s * j), py + b[1] - Math.round(dy * s * j), b, a * GH[j - 1]);
  }
  X.bodyAt(px, py, { pose: 'stand', front: true, alpha: a });
  selection(X, px, py, b, L.v, true, a);
  arrow(X, px + GRAB[0], py + GRAB[1], a);
}
function outline(ctx, x, y, b, a) {
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.rect(x, y, b[2], 1);
  ctx.rect(x, y + b[3] - 1, b[2], 1);
  ctx.rect(x, y + 1, 1, b[3] - 2);
  ctx.rect(x + b[2] - 1, y + 1, 1, b[3] - 2);
  ctx.fillStyle = GHOST;
  ctx.fill();
  ctx.globalAlpha = 1;
}
// The body at an end, drawn here so the selection lies over it at the walker's depth (stool sitters too).
function atEnd(X, fx, fy, v) {
  const stand = clipped(v) || v >= ARR,
    lf = lift(v),
    b = stand ? BOX[0] : boxOf(X.tp.stool);
  if (!stand) X.body({});
  else {
    if (lf > 0) shadowAt(X, fx, fy, 0.9);
    X.body(lf > 0 ? { pose: 'stand', front: true, lift: lf } : { pose: 'stand', front: clipped(v) ? true : null });
  }
  selection(X, fx, fy - Math.round(lf), b, v, v >= B.MQ0, X.L.C);
}

export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q) return 16;
    if (L.hide && L.trip < 0 && v < ARR) return 0;
    let n = 0;
    if (v < B.VF1) n |= 64;
    if (L.trip >= 0) n |= 128;
    if (!L.hide && hole(v, L.trip) > 0) n |= 1;
    return n;
  },
  // The checkerboard hole where they were cut out.
  back(X, end) {
    const L = X.L,
      a = L.C * hole(L.v, L.trip) * (X.night ? 0.85 : 0.95);
    if (end || a <= 0.01) return;
    const b = BOX[0];
    X.ctx.globalAlpha = a;
    X.stamp(sheetOf(), QX + (X.night ? QW + 1 : 0), 0, QW, QH, X.x0 + b[0], X.y0 + b[1], QW, QH);
    X.ctx.globalAlpha = 1;
  },
  // Queued: the waiting selection, still.
  stand(X, end) {
    if (end || !X.L.q) return;
    const b = boxOf(X.tp.stool);
    antsAt(X.ctx, X.x0 + b[0], X.y0 + b[1], b[2], b[3], 0, 0.5);
  },
  trip(X) {
    const L = X.L,
      v = L.v;
    if (L.trip >= 0) return dragged(X);
    if (!L.sw) {
      if (!L.hide) hud(X, X.x0, X.y0, v);
    } else if (v >= ARR) hud(X, X.x1, X.y1, v);
  },
  ground(X, out) {
    const L = X.L;
    if (L.trip < 0) return false;
    const g = drag(L.trip, X.tp.len);
    out[0] = lerp(X.tx0, X.tx1, g.e);
    out[1] = lerp(X.ty0, X.ty1, g.e);
    out[2] = g.h;
    return true;
  },
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || v >= REL) return false;
    if (L.trip >= 0 || (L.hide && !L.sw)) return true;
    if (!L.sw) atEnd(X, X.x0, X.y0, v);
    else if (v >= ARR) atEnd(X, X.x1, X.y1, v);
    return true;
  },
  marks: [],
  gap: null,
};
// Exposed for tests.
export const CUTPASTE = {
  B,
  LIFT,
  GRAB,
  boxOf,
  marquee,
  clipped,
  flash,
  lift,
  drag,
  ants,
  hole,
  keys,
  cursor,
  need: STYLE.need,
};
