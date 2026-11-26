// blocks: the person flickers into a stack of five four-square pieces in their own colours, the pieces hop off top
// first into a little train, the train slides along the route tumbling a quarter turn at a time, and at the landing
// the pieces drop back into the stack bottom first; the full rows blink and clear into the person. Each frame the
// body is captured once and its colours sampled into the 3 px cells, so hair, face, shirt and trousers stay theirs.
import { Kit } from './tp-kit.js';
import { TpPerson } from './tp-person.js';
import { TeleportLogic } from './teleport-logic.js';

const { clamp, r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR, T } = TeleportLogic;
const REL = T.RELEASE;
const C = 3, // px per cell
  GX = -6, // px: the stack's left edge from the feet (4 cells wide)
  S = 0.375, // tiles between pieces in the train
  R0 = 0.5, // tiles: the train's rear piece from the origin when it sets off
  APEX = 15, // px a hop rises over the higher of its two ends
  // departure, as fractions of it: the flicker, then piece k pops off at POP0 + (4 - k) * POPS for HOP
  FLICK0 = 0.08,
  FLICK1 = 0.3,
  POP0 = 0.42,
  POPS = 0.1,
  HOP = 0.14,
  // arrival, as fractions of it: piece k (from 1) leaves the queue at DROP0 + (k - 1) * DROPS for LAND, then the
  // full rows blink from BLINK and the person shows from CLEAR
  DROP0 = 0.03,
  DROPS = 0.15,
  LAND = 0.13,
  FLASH = 0.05,
  BLINK = 0.66,
  CLEAR = 0.82;
// The stack as drawn, top row first, each digit the piece a cell belongs to: legs (0), three shirt pieces, the head
// (4). Pieces are numbered in the order they lock at the landing, each resting on those before it.
const PLAN = ['.44.', '.44.', '3332', '1322', '1112', '.00.', '.00.'];
// Per piece its cells as [col, row] from the bottom left.
const PIECES = [0, 1, 2, 3, 4].map(k => {
  const cells = [];
  PLAN.forEach((line, i) => [...line].forEach((ch, col) => ch === String(k) && cells.push([col, PLAN.length - 1 - i])));
  return cells;
});
const NP = PIECES.length,
  NC = 4 * NP;
// Body rows sampled for each stack row, px above the feet [low, high), and whether the row takes the whole torso
// (x -4 to 3, so long hair and arms never colour the shirt pieces) or only its own columns.
const BAND = [
  [1, 4, 0],
  [2, 5, 0],
  [5, 9, 1],
  [6, 11, 1],
  [8, 12, 1],
  [12, 16, 0],
  [17, 22, 0],
];
const FULL = [2, 3, 4]; // stack rows four cells wide: the lines that clear
const V_CLEAR = lerp(ARR, REL, CLEAR); // core: the clear

// Each piece in four quarter turns: per turn [x, y, cell index] triples from the bottom left, and the box w, h.
function turn(cells) {
  const out = [];
  let pts = cells.map((c, i) => [c[0], c[1], i]);
  for (let q = 0; q < 4; q++) {
    const mx = Math.min(...pts.map(p => p[0])),
      my = Math.min(...pts.map(p => p[1])),
      flat = [];
    for (const p of pts) flat.push(p[0] - mx, p[1] - my, p[2]);
    flat.w = Math.max(...pts.map(p => p[0])) - mx + 1;
    flat.h = Math.max(...pts.map(p => p[1])) - my + 1;
    out.push(flat);
    pts = pts.map(p => [p[1], -p[0], p[2]]);
  }
  return out;
}
const TURNS = PIECES.map(turn);
// A piece's place in the stack: its lowest column and row.
const BASE = PIECES.map(cells => [Math.min(...cells.map(c => c[0])), Math.min(...cells.map(c => c[1]))]);

// Cell colours from one captured body: its rects painted in order into a small buffer, then each cell takes the
// commonest colour of its band; an empty cell takes its piece's first coloured cell.
const BW = 16,
  BH = 24,
  BUF = new Uint8Array(BW * BH),
  TALLY = new Uint16Array(32),
  CELL = new Int8Array(NC);
let CAPT = null;
function sample(cap) {
  BUF.fill(0);
  for (let k = 0; k < cap.n; k++) {
    const x0 = Math.max(0, cap.x[k] + 8),
      x1 = Math.min(BW, cap.x[k] + cap.w[k] + 8),
      y0 = Math.max(0, cap.y[k] + BH),
      y1 = Math.min(BH, cap.y[k] + cap.h[k] + BH);
    for (let y = y0; y < y1; y++) BUF.fill(cap.c[k] + 1, y * BW + x0, y * BW + x1);
  }
  for (let p = 0; p < NP; p++)
    for (let i = 0; i < 4; i++) {
      const [col, row] = PIECES[p][i],
        [lo, hi, wide] = BAND[row],
        x0 = wide ? 4 : GX + col * C + 8,
        x1 = wide ? 12 : x0 + C;
      TALLY.fill(0);
      for (let y = BH - hi; y < BH - lo; y++) for (let x = x0; x < x1; x++) TALLY[BUF[y * BW + x] & 31]++;
      let best = 0;
      for (let c = 1; c < 32; c++) if (TALLY[c] > TALLY[best] || (best === 0 && TALLY[c])) best = c;
      CELL[4 * p + i] = best - 1;
    }
  for (let p = 0; p < NP; p++)
    for (let i = 0; i < 4; i++) {
      if (CELL[4 * p + i] >= 0) continue;
      let k = 4 * p;
      while (k < 4 * p + 4 && CELL[k] < 0) k++;
      CELL[4 * p + i] = k < 4 * p + 4 ? CELL[k] : 0;
    }
  return cap;
}
// Always seen from the front, so no piece changes colour between the beats; the facing at each end changes inside
// the flicker and the clear.
function colours(X) {
  return sample(
    X.capture({ pose: 'stand', front: true, status: 'working', at: [0, 0] }, CAPT || (CAPT = TpPerson.newCapture())),
  );
}

// The frame's pieces: index, quarter turn, left and bottom px, ground y for the shadow (NaN none), flash 0-1.
const FP = new Int16Array(NP),
  FR = new Int8Array(NP),
  FL = new Int16Array(NP),
  FB = new Int16Array(NP),
  FG = new Float32Array(NP),
  FF = new Float32Array(NP);
let nF = 0;
function put(p, rot, left, bottom, ground, flash) {
  FP[nF] = p;
  FR[nF] = rot & 3;
  FL[nF] = Math.round(left);
  FB[nF] = Math.round(bottom);
  // a 1 px shadow far under a hopping piece reads as a stray dash: only near the ground
  FG[nF] = ground - bottom <= 6 ? Math.round(ground) : NaN;
  FF[nF] = flash;
  nF++;
}
// Where piece p sits in a stack whose feet are at (fx, fy): its left and bottom.
const slotL = (p, fx) => fx + GX + BASE[p][0] * C,
  slotB = (p, fy) => fy - BASE[p][1] * C;
const putSlot = (p, fx, fy, flash) => put(p, 0, slotL(p, fx), slotB(p, fy), NaN, flash);
const halfW = (p, rot) => Math.floor((TURNS[p][rot & 3].w * C) / 2);

// A hop from (l0, b0) to (l1, b1) over t 0-1: up and across, then straight down; on 3 px steps like a falling piece.
const HP = [0, 0];
function hop(t, l0, b0, l1, b1) {
  const top = Math.min(b0, b1) - APEX;
  let x, y;
  if (t < 0.55) {
    const u = t / 0.55;
    x = lerp(l0, l1, ease(u));
    y = lerp(b0, top, out2(u));
  } else {
    x = l1;
    y = lerp(top, b1, in2((t - 0.55) / 0.45));
  }
  HP[0] = l1 + Math.round((x - l1) / C) * C;
  HP[1] = b1 - Math.round((b1 - y) / C) * C;
  return HP;
}

// Seen route length in tiles (after a hidden starter's restroom part), cached per route array.
const LENS = new WeakMap();
function seenLen(X) {
  const pts = X.tp && X.tp.route;
  if (!pts) return Math.hypot(X.tx1 - X.tx0, X.ty1 - X.ty0);
  const c = LENS.get(pts);
  if (c && c[0] === X.start) return c[1];
  let n = 0;
  for (let k = X.start + 1; k < pts.length; k++) n += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  LENS.set(pts, [X.start, n]);
  return n;
}
// Tiles along the route of piece p at trip t: off at the rear of the train behind R0, in at the landing with the
// legs (p 0) on the spot. Linear, so the train stays by the route point the dispatcher sorts it at.
function trainAt(p, t, len) {
  const a = R0 + (NP - 1 - p) * S,
    b = Math.max(a, len - p * S);
  return lerp(a, b, t);
}
// Quarter turns a piece has tumbled at trip t: the legs end square (turn 0), the rest on their side (turn 1); a turn
// costs a small hop, so the result is turn + 4 while it is in the air.
function tumble(p, t, T1) {
  const m = Math.max(1, Math.floor(T1 / 1.2)),
    n = p ? 4 * m : 4 * m - 1,
    q = clamp((t - 0.04 * p) / 0.8),
    turns = Math.floor(n * q);
  return ((1 + turns) & 3) + (turns > 0 && q < 1 && n * q - turns < 0.3 ? 4 : 0);
}
const Q = [0, 0, 0, 0, false];
function onRoute(X, p, d, len, rot, lift) {
  X.route(len > 0 ? d / len : 1, Q);
  put(p, rot, Q[0] - halfW(p, rot), Q[1] - lift, Q[1], 0);
}

// Paint the frame's pieces (they never overlap much): shadows, one fill per body colour, the bevel light and shade.
function paint(X, cap, alpha) {
  const ctx = X.ctx;
  if (!nF || alpha <= 0) return (nF = 0);
  ctx.globalAlpha = 0.3 * alpha;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  let any = false;
  for (let i = 0; i < nF; i++) {
    if (FG[i] !== FG[i]) continue;
    any = true;
    ctx.rect(FL[i], FG[i], TURNS[FP[i]][FR[i]].w * C, 1);
  }
  if (any) ctx.fill();
  // a dark keyline round the pieces: a shirt the colour of the floor still reads
  ctx.globalAlpha = 0.7 * alpha;
  cells(ctx, -1, '#15131c', 4);
  ctx.globalAlpha = alpha;
  for (let c = 0; c < cap.cols.length; c++) cells(ctx, c, cap.cols[c], 0);
  ctx.globalAlpha = 0.42 * alpha;
  cells(ctx, -1, '#ffffff', 1);
  ctx.globalAlpha = 0.38 * alpha;
  cells(ctx, -1, '#000000', 2);
  ctx.globalAlpha = alpha;
  cells(ctx, -1, '#1d1b26', 3);
  // the three shirt pieces share a colour: one a shade darker, one lighter, so their seams read
  ctx.globalAlpha = 0.16 * alpha;
  tone(ctx, 1, '#000000');
  tone(ctx, 3, '#ffffff');
  for (let i = 0; i < nF; i++) {
    if (FF[i] <= 0) continue;
    ctx.globalAlpha = FF[i] * alpha;
    cellsOf(ctx, i, '#ffffff');
  }
  ctx.globalAlpha = 1;
  nF = 0;
}
// One path of every cell in colour c (c < 0: all), drawn as part m: 0 whole, 1 light corner, 2 dark corner, 3 eye,
// 4 the cell grown by 1 px (the keyline).
function cells(ctx, c, col, m) {
  let any = false;
  for (let i = 0; i < nF; i++) {
    const p = FP[i],
      tr = TURNS[p][FR[i]];
    for (let j = 0; j < tr.length; j += 3) {
      const k = 4 * p + tr[j + 2];
      if (c >= 0 && CELL[k] !== c) continue;
      // the eyes: the two face cells of the head
      if (m === 3 && !(p === NP - 1 && PIECES[p][tr[j + 2]][1] === 5)) continue;
      const x = FL[i] + tr[j] * C,
        y = FB[i] - (tr[j + 1] + 1) * C;
      if (!any) ctx.beginPath();
      any = true;
      if (m === 0) ctx.rect(x, y, C, C);
      else if (m === 4) ctx.rect(x - 1, y - 1, C + 2, C + 2);
      else if (m === 1) {
        ctx.rect(x, y, 2, 1);
        ctx.rect(x, y + 1, 1, 1);
      } else if (m === 2) {
        ctx.rect(x + 1, y + 2, 2, 1);
        ctx.rect(x + 2, y + 1, 1, 1);
      } else ctx.rect(x + 1, y + 1, 1, 1);
    }
  }
  if (!any) return;
  ctx.fillStyle = col;
  ctx.fill();
}
function tone(ctx, p, col) {
  let any = false;
  for (let i = 0; i < nF; i++) {
    if (FP[i] !== p) continue;
    if (!any) ctx.beginPath();
    any = true;
    const tr = TURNS[p][FR[i]];
    for (let j = 0; j < tr.length; j += 3) ctx.rect(FL[i] + tr[j] * C, FB[i] - (tr[j + 1] + 1) * C, C, C);
  }
  if (!any) return;
  ctx.fillStyle = col;
  ctx.fill();
}
function cellsOf(ctx, i, col) {
  const tr = TURNS[FP[i]][FR[i]];
  ctx.beginPath();
  for (let j = 0; j < tr.length; j += 3) ctx.rect(FL[i] + tr[j] * C, FB[i] - (tr[j + 1] + 1) * C, C, C);
  ctx.fillStyle = col;
  ctx.fill();
}
// The page's own shadow under the stack (the captured body has none).
function shadowAt(X, px, py, a) {
  const ctx = X.ctx;
  ctx.globalAlpha = a;
  ctx.fillStyle = (X.G.th && X.G.th.shadow) || 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(px, py, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Departure at the origin: flicker into the stack, then the pieces hop off top first into the train.
function depart(X) {
  const L = X.L,
    p = L.v / DEP,
    x = X.x0,
    y = X.y0,
    len = seenLen(X);
  if (p < FLICK0) return false;
  const tick = Math.floor((p - FLICK0) / 0.07),
    // a cut cross-fades the stack back into the person instead of replaying the flicker
    sa = L.cut ? L.C * r(p, FLICK0, FLICK1) : L.C;
  if (L.cut) X.body({ pose: 'stand', alpha: 1 - sa });
  else if (p < FLICK1 && tick === 1) {
    X.body({ pose: 'stand' });
    return true;
  }
  const cap = colours(X),
    flash = p < FLICK1 && !L.cut ? (X.night ? 0.45 : 0.7) * (1 - (p - FLICK0 - 0.07 * tick) / 0.07) : 0;
  let legs = false;
  for (let k = NP - 1; k >= 0; k--) {
    const t0 = POP0 + (NP - 1 - k) * POPS,
      t = (p - t0) / HOP;
    if (t < 0) {
      putSlot(k, x, y, flash);
      legs ||= k === 0;
      continue;
    }
    X.route(len > 0 ? trainAt(k, 0, len) / len : 1, Q);
    const l1 = Q[0] - halfW(k, 1),
      h = hop(Math.min(1, t), slotL(k, x), slotB(k, y), l1, Q[1]);
    put(
      k,
      t < 0.55 ? 0 : 1,
      h[0],
      h[1],
      lerp(y, Q[1], Math.min(1, t / 0.55)),
      t >= 1 ? 0.8 * (1 - clamp((t - 1) / 0.3)) : 0,
    );
  }
  if (legs) shadowAt(X, x, y, sa);
  paint(X, cap, sa);
  return true;
}
// The train sliding along the route, each piece tumbling, fading in when it comes out of a stall.
function train(X) {
  const L = X.L,
    t = L.trip,
    len = seenLen(X),
    cap = colours(X);
  for (let k = 0; k < NP; k++) {
    const tb = tumble(k, t, L.d[1]);
    onRoute(X, k, trainAt(k, t, len), len, tb & 3, tb > 3 ? 2 : 0);
  }
  paint(X, cap, L.C * (L.hide ? 0.25 + 0.75 * r(t, 0, 0.15) : 1));
}
// Arrival at the landing: the queue waits on its side, each piece hops up and drops into its slot bottom first.
function arrive(X) {
  const L = X.L,
    q = r(L.v, ARR, REL),
    x = X.x1,
    y = X.y1,
    len = seenLen(X);
  if (q >= CLEAR) {
    X.body({ pose: 'stand' });
    clearing(X, q);
    return;
  }
  const cap = colours(X);
  putSlot(0, x, y, q < FLASH ? 0.8 * (1 - q / FLASH) : 0);
  for (let k = 1; k < NP; k++) {
    const t0 = DROP0 + (k - 1) * DROPS,
      t = (q - t0) / LAND;
    if (t < 0) {
      onRoute(X, k, trainAt(k, 1, len), len, 1, 0);
      continue;
    }
    if (t >= 1) {
      putSlot(k, x, y, 0.8 * (1 - clamp((q - t0 - LAND) / FLASH)));
      continue;
    }
    X.route(len > 0 ? trainAt(k, 1, len) / len : 1, Q);
    const h = hop(t, Q[0] - halfW(k, 1), Q[1], slotL(k, x), slotB(k, y));
    put(k, t < 0.55 ? 1 : 0, h[0], h[1], lerp(Q[1], y, Math.min(1, t / 0.55)), 0);
  }
  // the full rows blink twice before they clear
  const blink = q >= BLINK && Math.floor((q - BLINK) / 0.04) % 2 === 0;
  shadowAt(X, x, y, L.C);
  paint(X, cap, L.C);
  if (blink) rows(X, x, y, 0.85 * L.C, 15);
}
// The full rows lit: a light square in each cell (the grid still shows), cols a bit mask of the columns drawn.
function rows(X, x, y, a, cols) {
  const ctx = X.ctx;
  ctx.globalAlpha = a;
  ctx.fillStyle = X.night ? '#fff4c2' : '#ffffff';
  ctx.beginPath();
  for (const row of FULL)
    for (let c = 0; c < 4; c++) if (cols & (1 << c)) ctx.rect(x + GX + c * C, y - (row + 1) * C, 2, 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
// The clear over the person: the lit rows go out from the middle, as a cleared line does.
function clearing(X, q) {
  const f = r(q, CLEAR, 1);
  if (f < 0.5) rows(X, X.x1, X.y1, 0.85 * X.L.C, f < 0.25 ? 15 : 9);
}
// After the clear: sparks fly out sideways from the cleared rows on 3 px steps and fade before the end.
function sparks(X) {
  const L = X.L,
    f = r(L.v, V_CLEAR, T.END - 0.05);
  if (f <= 0 || f >= 1) return;
  const ctx = X.ctx,
    n = X.lite ? 4 : 6;
  ctx.globalAlpha = (1 - f) * L.C;
  ctx.fillStyle = X.night ? '#fff4c2' : '#ffffff';
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const side = k & 1 ? 1 : -1,
      row = FULL[k % 3],
      dx = Math.round((6 + 4 * (k >> 1) + 14 * out2(f)) / C) * C,
      dy = Math.round((5 * f * f) / C) * C,
      s = f < 0.5 ? 2 : 1;
    ctx.rect(X.x1 + side * dx - (side < 0 ? s : 0), X.y1 - (row + 1) * C + 1 + dy, s, s);
  }
  ctx.fill();
  ctx.globalAlpha = 1;
}
// The ghost of the stack at the landing: slots still to fill as faint dots, from late in the trip.
function ghost(X) {
  const L = X.L,
    q = L.v >= ARR ? r(L.v, ARR, REL) : -1,
    a = (L.trip >= 0 ? r(L.trip, 0.55, 0.85) : q >= 0 && q < BLINK ? 1 : 0) * L.C;
  if (a <= 0) return;
  const ctx = X.ctx;
  ctx.globalAlpha = 0.3 * a;
  ctx.fillStyle = X.night ? '#c9d6ff' : '#ffffff';
  ctx.beginPath();
  let any = false;
  for (let k = 0; k < NP; k++) {
    if (q >= 0 && (k === 0 || q >= DROP0 + (k - 1) * DROPS + LAND)) continue;
    for (const [col, row] of PIECES[k]) {
      any = true;
      ctx.rect(X.x1 + GX + col * C, X.y1 - (row + 1) * C, 2, 2);
    }
  }
  if (any) ctx.fill();
  ctx.globalAlpha = 1;
}

export const STYLE = {
  need(X) {
    const L = X.L;
    if (L.q) return 0;
    return (
      (L.trip >= 0 && L.trip < 1 ? 64 : 0) |
      (L.trip >= 0.5 || (L.v >= ARR && L.v < REL) ? 2 : 0) |
      (L.v >= V_CLEAR ? 32 : 0)
    );
  },
  back(X, end) {
    if (end) ghost(X);
  },
  stand(X, end) {
    if (end) sparks(X);
  },
  trip(X) {
    if (X.L.trip >= 0 && X.L.trip < 1) train(X);
  },
  person(X) {
    const L = X.L;
    if (L.q || L.v >= REL) return false;
    if (L.hide && !L.sw) return true;
    if (L.trip >= 0 && L.trip < 1) return true;
    if (!L.sw) return depart(X);
    arrive(X);
    return true;
  },
  marks: [],
  gap: null,
};
// Exposed for tests.
export const BLOCKS = { PIECES, TURNS, BASE, BAND, FULL, C, GX, NP, sample, hop, trainAt, tumble, CELL };
