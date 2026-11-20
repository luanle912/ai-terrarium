// upload: a cloud icon gathers over the person and an upload box counts 0 to 100% while they reach up; at 100% they
// are pulled up into the cloud, which sails over the island; over the desk it rains their pixels back down, the
// person built from the feet up as the download bar fills, then the cloud drifts off.
// One body pass a frame from person() at the walker's depth: the body, or the rain as one capture drawn in 2 px cells.
// The cloud and its arrow ride the trip item, which is the overlay in every phase.
import { Kit } from './tp-kit.js';
import { TpPerson } from './tp-person.js';

const { atlas, bake, clamp, r, out2, in2, ease, lerp } = Kit;
const DEP = 0.42,
  ARR = 0.54,
  REL = 0.92,
  END = 1.35,
  L_IN = 0.28,
  SQUEEZE = 0.26,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  B = {
    IN: at(0.12), // the box and the cloud have popped in
    UP0: at(0.1), // the upload counts
    UP1: at(0.56),
    DONE: at(0.56), // 100%: the bar turns green
    RISE0: at(0.64), // pulled up into the cloud
    RISE1: at(0.96),
    BOXF0: at(0.6), // the upload box leaves
    BOXF1: at(0.7),
    DIN0: ar(0), // the download box
    DIN1: ar(0.1),
    RAIN0: ar(0.06), // the first pixel leaves the cloud
    RAIN1: ar(0.72), // the last one lands
    WHOLE: ar(0.74), // the plain body again
    DF0: ar(0.86), // the download box leaves
    DF1: REL + 0.5 * (END - REL),
    GO0: ar(0.8), // the cloud drifts up and off
    GO1: REL + 0.85 * (END - REL),
  },
  QA = 0.55, // the queued box's alpha, where the departure's box starts
  FALL = 0.07, // core: a pixel's fall from the cloud
  JIT = 0.03, // core: ragged starts within a row
  CLOUD = 50, // px from the feet up to the cloud's centre
  HIGH = 9, // px more over a high stool
  CW = 34, // cloud sprite
  CH = 18,
  BW = 30, // upload box
  BH = 13,
  BAR = 24,
  INK = '#1f2430',
  BLUE = '#3a86ff',
  GREEN = '#34c759',
  SKY = ['#5aa9ff', '#a8d8ff'], // stream, drops: day, night
  LIT = ['#eaf6ff', '#ffffff'], // a cell just written
  BEAM = ['rgba(150,210,255,0.3)', 'rgba(170,220,255,0.24)'];

// Progress of the upload, with a small stall at 99% so the 100% lands as a beat.
function upload(v) {
  const p = r(v, B.UP0, B.UP1);
  return p < 0.7 ? out2(p / 0.7) * 0.92 : p < 0.94 ? 0.92 + 0.07 * r(p, 0.7, 0.85) : p < 1 ? 0.99 : 1;
}
// Body lift (px, up to the cloud's foot) and its squeeze as it is pulled in.
function rise(v, foot) {
  const p = in2(r(v, B.RISE0, B.RISE1));
  return { p, lift: foot * p, sx: 1 - 0.45 * p, sy: 1 + 0.6 * p };
}
const deltaOf = stool => (stool === 2 ? HIGH : 0);
// The cloud's centre above the feet at an end and its alpha (0-1), departure and arrival on the core clock.
function cloudEnd(v, hide) {
  if (v < ARR) {
    if (hide) return { y: 0, a: r(v, L_IN, DEP) };
    const p = r(v, 0, B.IN);
    return { y: -6 * (1 - out2(p)), a: out2(p) };
  }
  const g = in2(r(v, B.GO0, B.GO1));
  return { y: 12 * g, a: 1 - g };
}
// The trip: e along the chord, arc px over the straight line from cloud to cloud, higher on a longer trip.
function sail(p, len) {
  const e = ease(clamp(p)),
    H = Math.min(36, Math.max(8, 4 + 1.1 * (len || 0)));
  return { e, h: 4 * H * e * (1 - e) };
}
// The box: which arrow, its alpha, how far it has risen, the bar (0-1).
const BOX = { down: false, a: 0, rise: 0, p: 0 };
function box(v) {
  BOX.down = v >= ARR;
  if (v < ARR) {
    BOX.a = (QA + (1 - QA) * r(v, 0, B.IN)) * (1 - r(v, B.BOXF0, B.BOXF1));
    BOX.rise = out2(r(v, 0, B.IN));
    BOX.p = upload(v);
  } else {
    BOX.a = r(v, B.DIN0, B.DIN1) * (1 - r(v, B.DF0, B.DF1));
    BOX.rise = out2(r(v, B.DIN0, B.DIN1));
    BOX.p = rained(v);
  }
  return BOX;
}
// Share of the person rained back down (smooth, for the bar).
const rained = v => r(v, B.RAIN0 + FALL * 0.6, B.RAIN1);
// A cell h px over the feet (0-1 of the body's height) starts falling at this core time: feet first.
const startOf = (hn, j) => B.RAIN0 + clamp(hn) * (B.RAIN1 - FALL - B.RAIN0 - JIT) + JIT * j;

// The atlas: the cloud (day, night), its arrows and the two boxes.
const AY = CH, // arrows row
  AWD = 7,
  BY = CH + 8; // boxes row
const CLOUDC = [
  [null, '#7d93ad', '#ffffff', '#dce8f5', '#b7c9de'],
  [null, '#39445c', '#c7d1e4', '#a3b0c9', '#7f8ca8'],
];
// 1 outline, 2 face, 3 shade, 4 underside: an icon cloud, three bumps over a flat foot.
export function cloudPixels() {
  const px = new Uint8Array(CW * CH),
    inside = (x, y) =>
      y <= 15 &&
      y >= 1 &&
      ((x - 17) ** 2 + (y - 8.5) ** 2 <= 7.4 ** 2 ||
        (x - 9.5) ** 2 + (y - 11) ** 2 <= 5 ** 2 ||
        (x - 25) ** 2 + (y - 11) ** 2 <= 5.4 ** 2 ||
        (y >= 11 && x >= 6 && x <= 28));
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const i = y * CW + x;
      if (inside(x, y)) px[i] = y >= 14 ? 4 : y >= 12 ? 3 : 2;
      else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) px[i] = 1;
    }
  return px;
}
const ARROW = ['...b...', '..bbb..', '.bbbbb.', 'bbbbbbb', '..bbb..', '..bbb..', '..bbb..'];
const MINI = ['..b..', '.bbb.', 'bbbbb', '.bbb.', '.bbb.'];
function sprite(g, rows, x, y, flip, col) {
  g.fillStyle = col;
  rows.forEach((row, k) => {
    for (let c = 0; c < row.length; c++)
      if (row[c] === 'b') g.fillRect(x + c, y + (flip ? rows.length - 1 - k : k), 1, 1);
  });
}
// The box: a keycap-like panel, the arrow, an empty bar (filled and labelled per frame).
function panel(g, x, y, down) {
  g.fillStyle = INK;
  g.fillRect(x + 1, y, BW - 2, 1);
  g.fillRect(x, y + 1, 1, BH - 2);
  g.fillRect(x + BW - 1, y + 1, 1, BH - 2);
  g.fillRect(x + 1, y + BH - 1, BW - 2, 1);
  g.fillStyle = '#9aa2ae';
  g.fillRect(x + 1, y + BH - 3, BW - 2, 2);
  g.fillStyle = '#f1f3f6';
  g.fillRect(x + 1, y + 1, BW - 2, BH - 4);
  g.fillStyle = '#ffffff';
  g.fillRect(x + 1, y + 1, BW - 2, 1);
  sprite(g, MINI, x + 3, y + 2, down, BLUE);
  g.fillStyle = '#c3c9d3';
  g.fillRect(x + 3, y + 8, BAR, 2);
}
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = atlas(2 * CW, BY + BH, g => {
    const px = cloudPixels();
    CLOUDC.forEach((cols, n) => bake(g, px, CW, CH, n * CW, c => cols[c]));
    sprite(g, ARROW, 0, AY, false, BLUE);
    sprite(g, ARROW, AWD + 1, AY, true, BLUE);
    sprite(g, ARROW, 2 * (AWD + 1), AY, false, '#6aa6ff');
    sprite(g, ARROW, 3 * (AWD + 1), AY, true, '#6aa6ff');
    panel(g, 0, BY, false);
    panel(g, BW + 1, BY, true);
  }));

// A number and a % in the 3x5 font from per-character glyphs (11 cached strings), left at x, bottom at y: one fill.
function percent(ctx, n, x, y, col) {
  const s = String(n);
  ctx.beginPath();
  for (let i = 0; i <= s.length; i++) {
    const g = Kit.glyphs(i < s.length ? s[i] : '%');
    for (let k = 0; k < g.length; k += 3) ctx.rect(x + 4 * i + g[k], y - 5 + g[k + 1], 1, g[k + 2]);
  }
  ctx.fillStyle = col;
  ctx.fill();
}
function drawBox(X, fx, top, v, alpha) {
  const b = box(v),
    a = alpha * b.a * (X.night ? 0.92 : 1);
  if (a <= 0.01) return;
  const ctx = X.ctx,
    x = fx - 15,
    y = Math.round(top - BH + 3 * (1 - b.rise)),
    w = Math.round(BAR * b.p);
  ctx.globalAlpha = a;
  X.stamp(sheetOf(), b.down ? BW + 1 : 0, BY, BW, BH, x, y, BW, BH);
  if (w > 0) {
    ctx.fillStyle = b.p >= 1 ? GREEN : BLUE;
    ctx.fillRect(x + 3, y + 8, w, 2);
  }
  percent(ctx, Math.floor(100 * b.p), x + 10, y + 7, b.p >= 1 ? '#1d7a36' : INK);
  ctx.globalAlpha = 1;
}
// The cloud with its centre at (cx, cy) and the arrow inside it (up, down or none).
function cloud(X, cx, cy, a, arrow) {
  if (a <= 0.01) return;
  const n = X.night ? 1 : 0,
    x = Math.round(cx) - 17,
    y = Math.round(cy) - 9;
  X.ctx.globalAlpha = Math.min(1, a);
  X.stamp(sheetOf(), n * CW, 0, CW, CH, x, y, CW, CH);
  if (arrow) X.stamp(sheetOf(), (2 * n + (arrow > 0 ? 0 : 1)) * (AWD + 1), AY, AWD, 7, x + 14, y + 6, AWD, 7);
  X.ctx.globalAlpha = 1;
}
// px from the feet to the top of the head: higher on a stool until they stand.
const headOf = (X, v) => (v < SQUEEZE && X.tp.stool ? (X.tp.stool === 2 ? 36 : 31) : 27);

// Chevrons climbing from the head to the cloud while it counts.
function stream(X, fx, fy, v) {
  const a = X.L.C * r(v, B.UP0, B.UP0 + 0.04) * (1 - r(v, B.RISE0, B.RISE0 + 0.04));
  if (a <= 0.01 || X.lite) return;
  const ctx = X.ctx,
    lo = fy - headOf(X, v) - 5,
    hi = fy - CLOUD - deltaOf(X.tp.stool) + 9,
    span = lo - hi;
  if (span < 4) return;
  ctx.globalAlpha = a;
  ctx.beginPath();
  for (let j = 0; j < 2; j++) {
    const q = Kit.frac(X.L.secs * 1.6 + j / 2),
      y = Math.round(lo - span * q);
    ctx.rect(fx, y, 1, 1);
    ctx.rect(fx - 1, y + 1, 1, 1);
    ctx.rect(fx + 1, y + 1, 1, 1);
    ctx.rect(fx - 2, y + 2, 1, 1);
    ctx.rect(fx + 2, y + 2, 1, 1);
  }
  ctx.fillStyle = SKY[X.night ? 1 : 0];
  ctx.fill();
  ctx.globalAlpha = 1;
}
// The light column they are pulled up in.
function beam(X, fx, fy, v) {
  const a = X.L.C * r(v, B.RISE0 - 0.02, B.RISE0 + 0.02) * (1 - r(v, DEP - 0.03, DEP));
  if (a <= 0.01) return;
  const ctx = X.ctx,
    top = fy - CLOUD - deltaOf(X.tp.stool) + 8;
  ctx.globalAlpha = a;
  ctx.fillStyle = BEAM[X.night ? 1 : 0];
  ctx.fillRect(fx - 6, top, 13, fy - top);
  ctx.fillRect(fx - 3, top, 7, fy - top);
  ctx.globalAlpha = 1;
}
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
// The departure at the origin: the person reaching up, then pulled up and in, clipped at the cloud's foot.
function leave(X, v) {
  const fx = X.x0,
    fy = X.y0,
    stool = X.tp.stool;
  beam(X, fx, fy, v);
  if (v < B.RISE0) {
    X.body(v < SQUEEZE && stool ? {} : v >= B.UP0 ? { pose: 'up', front: true } : {});
  } else {
    const foot = CLOUD + deltaOf(stool) - 8,
      s = rise(v, foot);
    shadowAt(X, fx, fy, 0.8 * (1 - s.p));
    const top = (foot - s.lift) / s.sy;
    if (top > 0.5) X.body({ pose: 'up', front: true, lift: s.lift, sx: s.sx, sy: s.sy, clip: [top, -2] });
  }
  stream(X, fx, fy, v);
}

// The rain: the captured body split into 2 px cells, each falling from the cloud's foot to its place.
const CAP = TpPerson.newCapture(),
  NC = 360,
  CELL = { n: 0, x: new Int16Array(NC), y: new Int16Array(NC), w: new Int8Array(NC), h: new Int8Array(NC) },
  CC = new Uint8Array(NC),
  CS = new Float32Array(NC); // a cell's start time
function cells(X, cap, fy) {
  CELL.n = 0;
  let top = fy - 8;
  for (let k = 0; k < cap.n; k++) top = Math.min(top, cap.y[k]);
  const hb = fy - top - 1; // the top row starts last, whatever the hat
  for (let k = 0; k < cap.n; k++)
    for (let y = 0; y < cap.h[k]; y += 2)
      for (let x = 0; x < cap.w[k]; x += 2) {
        if (CELL.n >= NC) return;
        const j = CELL.n++;
        CELL.x[j] = cap.x[k] + x;
        CELL.y[j] = cap.y[k] + y;
        CELL.w[j] = Math.min(2, cap.w[k] - x);
        CELL.h[j] = Math.min(2, cap.h[k] - y);
        CC[j] = cap.c[k];
        CS[j] = startOf((fy - CELL.y[j] - CELL.h[j]) / hb, X.hash(j, 7));
      }
}
function rain(X, v) {
  const fx = X.x1,
    fy = X.y1,
    foot = fy - CLOUD + 8,
    cap = X.capture({ pose: 'stand', front: true }, CAP),
    ctx = X.ctx,
    lit = cap.cols.length;
  cells(X, cap, fy);
  for (let c = 0; c <= lit; c++) {
    let any = false;
    for (let j = 0; j < CELL.n; j++) {
      const p = (v - CS[j]) / FALL;
      if (p < 0) continue;
      const fresh = p >= 1 && p < 1.12;
      if ((c === lit) !== fresh || (c < lit && CC[j] !== c)) continue;
      const q = in2(Math.min(1, p)),
        sx = (X.hash(j, 3) - 0.5) * 12 * (1 - q),
        y = p >= 1 ? CELL.y[j] : Math.round(lerp(foot, CELL.y[j], q)),
        x = Math.round(CELL.x[j] + sx);
      if (!any) {
        ctx.beginPath();
        any = true;
      }
      ctx.rect(x, y, CELL.w[j], p < 1 ? CELL.h[j] + 1 : CELL.h[j]);
    }
    if (any) {
      ctx.fillStyle = c === lit ? LIT[X.night ? 1 : 0] : cap.cols[c];
      ctx.fill();
    }
  }
  drops(X, fx, foot, v);
}
// Plain rain streaks under the cloud while it downloads.
function drops(X, fx, foot, v) {
  const a = r(v, B.RAIN0, B.RAIN0 + 0.03) * (1 - r(v, B.RAIN1 - 0.04, B.RAIN1 + 0.02));
  if (a <= 0.01 || X.lite) return;
  const ctx = X.ctx,
    len = X.y1 - 4 - foot;
  ctx.globalAlpha = a * 0.8;
  ctx.beginPath();
  for (let j = 0; j < 6; j++) {
    const q = Kit.frac(X.L.secs * 2.2 + X.hash(j, 11)),
      x = fx - 11 + Math.round(22 * X.hash(j, 13)),
      y = Math.round(foot + len * q);
    ctx.rect(x, y, 1, 3);
  }
  ctx.fillStyle = SKY[X.night ? 1 : 0];
  ctx.fill();
  ctx.globalAlpha = 1;
}
// The arrival at the landing: the rain, then the person.
function land(X, v) {
  if (v < B.WHOLE) rain(X, v);
  else X.body({ pose: 'stand', front: true });
}

// Data bits trailing the cloud in flight.
function trail(X, g, px, py) {
  if (X.lite) return;
  const ctx = X.ctx,
    dx = X.x1 - X.x0,
    dy = X.y1 - X.y0,
    n = Math.hypot(dx, dy) || 1;
  ctx.beginPath();
  for (let j = 1; j <= 3; j++) {
    const k = 8 + 7 * j,
      w = Math.sin(X.L.secs * 9 + j * 2.1) * 3;
    ctx.rect(Math.round(px - (dx / n) * k), Math.round(py - (dy / n) * k + w + 4), 2, 2);
  }
  ctx.globalAlpha = 0.8 * clamp(g.e * 6) * clamp((1 - g.e) * 6);
  ctx.fillStyle = X.night ? SKY[1] : BLUE;
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Three dots blinking under the cloud in flight (syncing).
function dots(X, px, py) {
  if (X.lite) return;
  const on = Math.floor(X.L.secs * 8) % 3,
    ctx = X.ctx;
  ctx.beginPath();
  for (let j = 0; j < 3; j++) ctx.rect(px - 6 + 5 * j, py + (j === on ? -1 : 0), 2, 2);
  ctx.fillStyle = BLUE;
  ctx.fill();
}
const Q = { x: 0, y: 0, a: 0, h: 0, gx: 0, gy: 0 };
// Where the cloud is: centre px, alpha, height over its ground point (tiles).
function where(X) {
  const L = X.L,
    v = L.v,
    c0 = CLOUD + deltaOf(X.tp.stool);
  if (L.trip >= 0) {
    // a stall user's cloud has already faded in over the departure's end
    const g = sail(L.trip, X.tp.len);
    Q.x = lerp(X.x0, X.x1, g.e);
    Q.y = lerp(X.y0 - c0, X.y1 - CLOUD, g.e) - g.h;
    Q.a = 1;
    Q.h = lerp(c0, CLOUD, g.e) + g.h;
    Q.gx = lerp(X.tx0, X.tx1, g.e);
    Q.gy = lerp(X.ty0, X.ty1, g.e);
    return Q;
  }
  const end = v >= ARR,
    e = cloudEnd(v, L.hide);
  Q.x = end ? X.x1 : X.x0;
  Q.y = (end ? X.y1 - CLOUD : X.y0 - c0) + e.y;
  Q.a = e.a * L.C;
  Q.h = (end ? CLOUD : c0) - e.y;
  Q.gx = end ? X.tx1 : X.tx0;
  Q.gy = end ? X.ty1 : X.ty0;
  return Q;
}

export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q) return 16;
    if (v >= B.GO1) return 0;
    if (L.hide && !L.sw && v < L_IN) return 0;
    return 64 | 128;
  },
  // Queued: the upload box waits at 0% where it will count, dimmed.
  stand(X, end) {
    if (end || !X.L.q) return;
    const ctx = X.ctx,
      x = X.x0 - 15,
      y = X.y0 - CLOUD - deltaOf(X.tp.stool) - 11 - BH + 3;
    ctx.globalAlpha = QA;
    X.stamp(sheetOf(), 0, BY, BW, BH, x, y, BW, BH);
    percent(ctx, 0, x + 10, y + 7, INK);
    ctx.globalAlpha = 1;
  },
  trip(X) {
    const L = X.L,
      c = where(X),
      arrow = L.trip >= 0 ? 0 : L.v < ARR ? (L.v >= B.UP0 ? 1 : 0) : L.v < B.RAIN1 ? -1 : 0;
    if (L.trip >= 0) trail(X, sail(L.trip, X.tp.len), c.x, c.y);
    cloud(X, c.x, c.y, c.a, arrow);
    if (L.trip >= 0) dots(X, Math.round(c.x), Math.round(c.y) + 3);
    // the box sits on the cloud: its status
    else if (L.v >= ARR) drawBox(X, X.x1, c.y - 11, L.v, 1);
    else if (!L.hide) drawBox(X, X.x0, X.y0 - CLOUD - deltaOf(X.tp.stool) - 11, L.v, L.C);
  },
  // The ground point under the cloud; a faint cloud reports itself higher so its shadow fades with it.
  ground(X, out) {
    const c = where(X);
    out[0] = c.gx;
    out[1] = c.gy;
    out[2] = c.h + 160 * (1 - clamp(c.a));
    return true;
  },
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || v >= REL) return false;
    if (L.trip >= 0 || (L.hide && !L.sw)) return true;
    if (!L.sw) {
      if (v < DEP) leave(X, v);
    } else if (v >= ARR) land(X, v);
    return true;
  },
  marks: [],
  gap: null,
};
// Exposed for tests.
export const UPLOAD = {
  B,
  FALL,
  CLOUD,
  HIGH,
  upload,
  rise,
  cloudEnd,
  sail,
  box,
  rained,
  startOf,
  where,
  need: STYLE.need,
};
