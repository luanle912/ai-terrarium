// goldaura: hair and aura flare gold, two fingers to the forehead, gone in afterimages, back with a ring shockwave.
// Beats run on the core clock (X.L.v), so a cut plays the charge backwards. One body pass a frame in every phase.
import { Kit } from './tp-kit.js';
import { TpPerson } from './tp-person.js';
import { PERSON, LOOK, hairTones } from './office-people.js';
import { XMAS, lookUnder, outfitOf, shirtOf } from './office-people-xmas.js';

const { r, out2, in2, bake, atlas, ellipse } = Kit;
const DEP = 0.42,
  ARR = 0.54,
  REL = 0.92,
  ARRS = 0.38, // core length of the arrival
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * ARRS, // an arrival fraction on the core clock
  FLASH = at(0.86), // the body flashes white-gold
  GONE = at(0.93), // vanished: afterimages from here
  POP = ar(0.14), // back at the landing
  GOLD = '#ffd23f',
  GOLD_L = '#fff4ad',
  GOLD_D = '#e3980f',
  WHITE = '#fffbe6',
  // aura frames: 6 cells AW x AH, feet at (AX, AY); ring frames: 8 cells RW x RH under them, centre (RX, RY)
  AF = 6,
  AW = 31,
  AH = 46,
  AX = 15,
  AY = 41,
  RW = 67,
  RH = 36,
  RX = 33,
  RY = 17,
  HW = 68,
  HH = 64,
  HPAL = [null, 'rgba(255,194,58,0.06)', 'rgba(255,194,58,0.12)', 'rgba(255,194,58,0.19)', 'rgba(255,194,58,0.27)'],
  APAL = [
    null,
    'rgba(255,196,36,0.22)',
    'rgba(255,232,120,0.3)',
    'rgba(255,248,190,0.95)',
    'rgba(200,104,0,0.6)',
    'rgba(255,253,230,0.9)',
    'rgba(255,205,50,0.75)',
  ],
  // spike crown over the head, columns sx-4..sx+3 (px tall) and which are lit or shaded
  SPIKE = [1, 3, 1, 4, 2, 5, 2, 3],
  SHADE = [0, 1, 0, 1, 0, 1, 2, 2],
  TONGUE = [4, 6, 8, 6, 4]; // px tall, left to right

// For tests: the beats on the core clock and the sprite cells.
export const BEATS = { FLASH, GONE, POP, REL },
  CELLS = { AF, AW, AH, RW, RH, HW, HH };

// Aura frame f: a flame round a standing person, its edge rippling upwards, five tongues and rising streaks.
// 1 soft fill, 2 inner core, 3 bright rim, 6 gold band, 4 orange outer lip (reads on grass and cream), 5 streaks.
export function auraPixels(f) {
  const px = new Uint8Array(AW * AH),
    w = f * ((2 * Math.PI) / AF),
    half = dy => {
      if (dy < 0) return 8.4 * Math.sqrt(Math.max(0, 1 - (dy / 4.5) ** 2));
      const e = 1 - ((dy - 13) / 19) ** 2;
      if (e <= 0) return 0;
      return 11.5 * Math.sqrt(e) + (dy > 2 && dy < 30 ? 1.2 * Math.sin(dy * 0.55 - w) : 0);
    },
    inside = (x, y) => {
      if (x < 0 || y < 0 || x >= AW || y >= AH) return false;
      const dy = AY - y,
        dx = x - AX;
      if (Math.abs(dx) < half(dy)) return true;
      // pointed tongues licking up from the crown, leaning in, each on its own beat
      for (let j = 0; j < 5; j++) {
        const ox = 4 * j - 8,
          base = 13 + 19 * Math.sqrt(1 - (ox / 11.5) ** 2) - 3,
          len = TONGUE[j] + 2 * Math.sin(w + 2.4 * j),
          p = (dy - base) / len,
          c = ox - Math.sign(ox) * Math.round((dy - base) / 4);
        if (p >= 0 && p < 1 && Math.abs(dx - c) < 2.6 * (1 - p)) return true;
      }
      return false;
    },
    out = (x, y, d) => !inside(x - d, y) || !inside(x + d, y) || !inside(x, y - d) || !inside(x, y + d);
  for (let y = 0; y < AH; y++)
    for (let x = 0; x < AW; x++) {
      const k = y * AW + x;
      if (inside(x, y)) px[k] = out(x, y, 1) ? 3 : out(x, y, 2) ? 6 : Math.abs(x - AX) <= 0.5 * half(AY - y) ? 2 : 1;
      else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y + 1)) px[k] = 4;
    }
  for (let s = 0; s < 7; s++) {
    const x = AX - 6 + 2 * s,
      y0 = AY - ((11 * s + 6 * f) % 30) - 5;
    for (let y = y0; y < y0 + 4; y++) if (px[y * AW + x] === 1 || px[y * AW + x] === 2) px[y * AW + x] = 5;
  }
  return px;
}
// The night glow behind the aura, HW x HH centred at (HW / 2, HH / 2): four stepped bands, dithered where they meet.
export function haloPixels() {
  const px = new Uint8Array(HW * HH);
  for (let y = 0; y < HH; y++)
    for (let x = 0; x < HW; x++) {
      const d = Math.hypot((x + 0.5 - HW / 2) / (HW / 2), (y + 0.5 - HH / 2) / (HH / 2)) + ((x + y) % 2 ? 0.05 : -0.05);
      px[y * HW + x] = d < 0.35 ? 4 : d < 0.58 ? 3 : d < 0.8 ? 2 : d < 0.9 ? 1 : 0;
    }
  return px;
}
// Shockwave ring k (0-7) growing; 1 ring, 2 the dark lip under it.
export function ringPixels(k) {
  const px = new Uint8Array(RW * RH),
    put = (x, y) => {
      if (RX + x >= 0 && RX + x < RW && RY + y >= 0 && RY + y < RH) px[(RY + y) * RW + RX + x] = 1;
    },
    rx = Math.round(7 + (25 * k) / 7);
  ellipse(rx, Math.floor(rx / 2), put);
  if (k <= 3) ellipse(rx - 1, Math.floor(rx / 2) - 1, put);
  for (let i = RW * (RH - 1) - 1; i >= 0; i--) if (px[i] === 1 && !px[i + RW]) px[i + RW] = 2;
  return px;
}
let sheet = null;
const art = () =>
  sheet ||
  (sheet = atlas(RW * 8, AH + RH + HH, g => {
    bake(g, haloPixels(), HW, HH, 0, c => HPAL[c], AH + RH);
    for (let f = 0; f < AF; f++) bake(g, auraPixels(f), AW, AH, f * AW, c => APAL[c]);
    for (let k = 0; k < 8; k++)
      bake(g, ringPixels(k), RW, RH, k * RW, c => (c === 1 ? GOLD_L : 'rgba(150,80,0,0.5)'), AH);
  }));

// How strong the aura is at an end (0-1).
export function auraOf(v, end) {
  if (end) return v < POP ? 0 : 1 - r(v, ar(0.35), ar(0.9));
  return r(v, at(0.1), at(0.2)) * (1 - r(v, GONE, GONE + 0.04));
}
// Gold hair 0-1: flickers on while charging, off again at the end of the arrival.
export function goldOf(v, end) {
  if (end) {
    if (v < POP || v >= ar(0.8)) return 0;
    return v < ar(0.6) || Math.floor((v - ar(0.6)) / 0.02) % 2 ? 1 : 0;
  }
  if (v < at(0.06)) return 0;
  return v >= at(0.18) || Math.floor((v - at(0.06)) / 0.012) % 2 === 0 ? 1 : 0;
}
export const spikeOf = (v, end) => (end ? 1 - r(v, ar(0.62), ar(0.8)) : r(v, at(0.12), at(0.24)));

// ---- the person ----
const CAP = TpPerson.newCapture(),
  BK = [[], [], []],
  TONE = [GOLD, GOLD_D, GOLD_L];
let tones = null;
// Re-runs the hair art over the drawn head with the three hair tones turned gold, one fill a tone.
const hairR = (x, y, w, h, c) => {
  const i = tones.indexOf(c);
  if (i >= 0) BK[i].push(x, y, w, h);
};
function fillBuckets(ctx) {
  for (let i = 0; i < 3; i++) {
    const b = BK[i];
    if (!b.length) continue;
    ctx.beginPath();
    for (let k = 0; k < b.length; k += 4) ctx.rect(b[k], b[k + 1], b[k + 2], b[k + 3]);
    ctx.fillStyle = TONE[i];
    ctx.fill();
    b.length = 0;
  }
}
// Hats that cover the crown (office-people-xmas.js COVERS): the gold shows as tufts under the brim instead.
const COVER = { santa: 1, beanie: 1, tophat: 1, elf: 1 };
let hatCtx = null;
const hatR = (x, y, w, h, c) => {
  hatCtx.fillStyle = c;
  hatCtx.fillRect(x, y, w, h);
};
function goldHair(X, sx, hy, gold, spike) {
  const a = X.a,
    ctx = X.ctx,
    o = outfitOf(a, X.ev),
    L = lookUnder(LOOK(a), o),
    hat = o && o.hat;
  if (gold <= 0) return;
  ctx.globalAlpha = gold * X.L.C;
  tones = hairTones(L);
  PERSON.hairFront(hairR, L, sx, hy, shirtOf(a));
  const s = spike;
  if ((hat && COVER[hat]) || L.hairStyle === 'cap') {
    const h = Math.round(2 * s);
    if (h > 0) BK[0].push(sx - 5, hy - h + 1, 1, h + 1, sx + 4, hy - h + 1, 1, h + 1);
    if (h > 1) BK[2].push(sx - 6, hy - h, 1, 1, sx + 5, hy - h, 1, 1);
  } else {
    // a crown of spikes
    for (let c = 0; c < 8; c++) {
      const h = Math.round(SPIKE[c] * s);
      if (h > 0) BK[SHADE[c] === 2 ? 1 : 0].push(sx - 4 + c, hy - 1 - h, 1, h);
      if (h > 1 && SHADE[c] === 1) BK[2].push(sx - 4 + c, hy - 1 - h, 1, 1);
    }
    if (s > 0.5) BK[0].push(sx - 5, hy, 1, 2, sx + 4, hy, 1, 1);
  }
  fillBuckets(ctx);
  // the hat back over the gold hair, as drawPerson lays it
  if (hat) {
    ctx.globalAlpha = 1;
    hatCtx = ctx;
    XMAS.hatEvent(hatR, o, sx, hy);
  }
  ctx.globalAlpha = 1;
}
// The charge: a power stance with a tremble; then still, two fingers raised to the forehead.
function charge(X, v) {
  const lite = X.lite,
    ctx = X.ctx,
    p = v / DEP,
    shake = p > 0.2 && p < 0.64,
    jx = shake ? Math.floor(X.hash(Math.floor(X.t * 24), 7) * 3) - 1 : 0,
    crouch = r(p, 0.18, 0.3) * (1 - r(p, 0.6, 0.66)),
    legs = 1 - 0.5 * crouch,
    drop = Math.round(TpPerson.LEG * (1 - legs)),
    sx = X.x0 + jx,
    fy = X.y0,
    hy = fy - 18 + drop,
    o = { pose: 'stand', front: true, status: 'working', legs, alpha: 1 };
  feetShadow(X, X.x0, fy);
  // a stool sitter keeps the seat until the aura has caught
  if (X.a.stool && p < 0.14) {
    X.bodyAt(X.x0, fy, { pose: X.a.stool === 2 ? 'sitHigh' : 'sit', front: X.a.dirFront });
    return;
  }
  if (p >= 0.64 && !lite) salute(X, sx, fy, o);
  else X.bodyAt(sx, fy, o);
  goldHair(X, sx, hy, goldOf(v, 0), spikeOf(v, 0));
  if (p >= 0.64 && !lite) fingers(X, sx, fy + drop);
}
// The body with its right arm left out (the hand goes to the forehead instead), painted in order: a rect's layer is
// one past every earlier, differently coloured rect it overlaps, so one fill per layer and colour keeps the overlaps.
const LAY = new Int8Array(TpPerson.MAXCAP),
  KEYS = [];
let armC = 0,
  handC = 0;
function salute(X, sx, fy, o) {
  const cap = X.capture({ ...o, at: [sx, fy] }, CAP),
    n = cap.n,
    ctx = X.ctx,
    over = (i, j) =>
      cap.x[i] < cap.x[j] + cap.w[j] &&
      cap.x[j] < cap.x[i] + cap.w[i] &&
      cap.y[i] < cap.y[j] + cap.h[j] &&
      cap.y[j] < cap.y[i] + cap.h[i];
  KEYS.length = 0;
  for (let k = 0; k < n; k++) {
    if (cap.x[k] === sx + 4 && cap.w[k] === 1 && cap.y[k] >= fy - 12 && cap.y[k] <= fy - 4) {
      if (cap.h[k] > 1) armC = cap.c[k];
      else handC = cap.c[k];
      LAY[k] = -1;
      continue;
    }
    let l = 0;
    for (let j = 0; j < k; j++)
      if (LAY[j] >= 0 && over(j, k)) l = Math.max(l, cap.c[j] === cap.c[k] ? LAY[j] : LAY[j] + 1);
    LAY[k] = l;
    const key = l * 64 + cap.c[k];
    if (!KEYS.includes(key)) KEYS.push(key);
  }
  KEYS.sort((p, q) => p - q);
  ctx.globalAlpha = o.alpha;
  for (const key of KEYS) {
    ctx.beginPath();
    for (let k = 0; k < n; k++)
      if (LAY[k] >= 0 && LAY[k] * 64 + cap.c[k] === key) ctx.rect(cap.x[k], cap.y[k], cap.w[k], cap.h[k]);
    ctx.fillStyle = cap.cols[key % 64];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// The raised arm: elbow out, hand by the temple, two fingers on the forehead.
function fingers(X, sx, by) {
  const ctx = X.ctx,
    hy = by - 18;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.rect(sx + 4, by - 12, 1, 2);
  ctx.rect(sx + 5, by - 15, 1, 3);
  ctx.rect(sx + 4, by - 16, 1, 1);
  ctx.fillStyle = CAP.cols[armC] || GOLD_D;
  ctx.fill();
  ctx.beginPath();
  ctx.rect(sx + 3, hy + 1, 1, 2);
  ctx.rect(sx + 1, hy + 1, 2, 1);
  ctx.fillStyle = CAP.cols[handC] || '#f1c9a5';
  ctx.fill();
  ctx.globalAlpha = 1;
}
// The page's own shadow under a standing person (drawPerson), which a remapped body pass leaves out.
function feetShadow(X, px, py) {
  const ctx = X.ctx;
  ctx.fillStyle = X.G.th.shadow;
  ctx.beginPath();
  ctx.ellipse(px, py, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}
const side = dir => (dir[0] < 0 ? -1 : 1);
// 0 dark, 1 mid, 2 light: the gold a captured colour turns, so hair, face and clothes still read in a ghost.
const LUM = new Map(),
  TN = [];
function toneOf(col) {
  let t = LUM.get(col);
  if (t != null) return t;
  const m =
    col[0] === '#' && col.length >= 7
      ? [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16))
      : (col.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
  const y = m.length === 3 ? (0.3 * m[0] + 0.59 * m[1] + 0.11 * m[2]) / 255 : 0.5;
  t = y < 0.33 ? 0 : y < 0.62 ? 1 : 2;
  if (LUM.size > 255) LUM.clear();
  LUM.set(col, t);
  return t;
}
// The captured body in three golds (dark to light), at a few offsets: the flash and the afterimages.
function ghosts(X, px, py, golds, n, dx, dy, alpha) {
  const ctx = X.ctx,
    cap = X.capture({ pose: 'stand', front: true, status: 'working', at: [px, py] }, CAP);
  for (let k = 0; k < cap.cols.length; k++) TN[k] = toneOf(cap.cols[k]);
  for (let g = 0; g < n; g++) {
    const a = alpha(g);
    if (a <= 0) continue;
    const ox = Math.round(dx * g),
      oy = Math.round(dy * g);
    ctx.globalAlpha = a * X.L.C;
    for (let t = 0; t < 3; t++) {
      ctx.beginPath();
      // a px taller above the feet: closes the 1 px seams the body's polygons leave in a flat silhouette
      for (let k = 0; k < cap.n; k++)
        if (TN[cap.c[k]] === t)
          ctx.rect(cap.x[k] + ox, cap.y[k] + oy, cap.w[k], cap.h[k] + (cap.y[k] + cap.h[k] < py ? 1 : 0));
      ctx.fillStyle = golds[t];
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
const GHOST = [GOLD_D, GOLD, GOLD_L],
  FLARE = [GOLD, GOLD_L, WHITE],
  APART = 13; // px between afterimages: about a body's width, so they read as people rather than one block

// ---- around the person ----
function aura(X, px, py, a, front) {
  if (a <= 0) return;
  const ctx = X.ctx,
    f = Math.floor(X.t * 14 + X.seed * 7) % AF;
  if (!front && !X.lite && X.night) {
    // as office-draw-xmas.js glowAt: nothing by day, full at night
    ctx.globalAlpha = a * X.L.C * (X.df >= 0.6 ? 0.35 : 0.95 - X.df);
    X.stamp(art(), 0, AH + RH, HW, HH, px - HW / 2, py - 52, HW, HH);
  }
  ctx.globalAlpha = a * X.L.C * (front ? 0.28 : 0.9 + 0.1 * Math.sin(X.t * 19));
  X.stamp(art(), f * AW, 0, AW, AH, px - AX, py - AY, AW, AH);
  ctx.globalAlpha = 1;
}
function ring(X, px, py, p, alpha) {
  if (p <= 0 || p >= 1) return;
  const k = Math.min(7, Math.floor(8 * out2(p)));
  X.ctx.globalAlpha = alpha * (1 - in2(p)) * X.L.C;
  X.stamp(art(), k * RW, AH, RW, RH, px - RX, py - RY, RW, RH);
  X.ctx.globalAlpha = 1;
}
// Crackling sparks on the aura's edge: short zigzags that jump to a new place a few times a second.
const edgeAt = dy => Math.round(11.5 * Math.sqrt(Math.max(0, 1 - ((dy - 13) / 19) ** 2)));
function sparks(X, px, py, n, a) {
  if (a <= 0 || X.lite) return;
  const ctx = X.ctx,
    beat = Math.floor(X.t * 11);
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const q = beat * 5 + k;
    if (X.hash(q, 11) < 0.35) continue;
    const side = k % 2 ? 1 : -1,
      dy = 6 + Math.floor(X.hash(q, 12) * 20),
      x = px + side * (edgeAt(dy) - 1),
      y = py - dy;
    // a bolt bending away from the aura and back, 7 px tall
    ctx.rect(x, y, 1, 2);
    ctx.rect(x + side, y - 3, 1, 2);
    ctx.rect(x + 2 * side, y - 5, 1, 2);
    ctx.rect(x + side, y - 7, 1, 2);
    ctx.rect(x + side, y - 2, 1, 1);
    ctx.rect(x + 2 * side, y - 4, 1, 1);
  }
  ctx.globalAlpha = a * X.L.C;
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Pebbles round the feet float up while charging and drop when the aura goes; behind the feet or in front.
const PEB = 8;
function pebbles(X, v, front) {
  if (X.lite) return;
  const lift = r(v, at(0.12), at(0.4)),
    fall = v > GONE ? Math.min(1, (v - GONE) / 0.08) : 0;
  if (lift <= 0 || fall >= 1) return;
  const ctx = X.ctx;
  ctx.beginPath();
  let any = false;
  for (let k = 0; k < PEB; k++) {
    const ang = ((k + X.hash(k, 21) * 0.6) / PEB) * 2 * Math.PI,
      dy = Math.round(Math.sin(ang) * (5 + 3 * X.hash(k, 22)));
    if (dy > 0 !== front) continue;
    const dx = Math.round(Math.cos(ang) * (11 + 6 * X.hash(k, 23))),
      top = (5 + 9 * X.hash(k, 24)) * lift,
      bob = Math.round(Math.sin(X.t * 5 + k) * lift),
      h = Math.round(top * (1 - in2(fall))) + bob,
      s = X.hash(k, 25) < 0.4 ? 2 : 1;
    ctx.rect(X.x0 + dx, X.y0 + dy - Math.max(0, h) - s, s + 1, s);
    any = true;
  }
  if (!any) return;
  ctx.globalAlpha = X.L.C;
  ctx.fillStyle = '#8b7d6b';
  ctx.fill();
  ctx.globalAlpha = 1;
}
// A four-point sparkle, its upright arms a px longer than its sideways ones.
function sparkle(ctx, x, y, s, col, alpha) {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  ctx.fillRect(x - s, y, 2 * s + 1, 1);
  ctx.fillRect(x, y - s - 1, 1, 2 * s + 3);
  ctx.globalAlpha = 1;
}
// Dust kicked out by the landing shockwave.
function dust(X, p) {
  if (p <= 0 || p >= 1 || X.lite) return;
  const ctx = X.ctx;
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const ang = ((k + X.hash(k, 31)) / 10) * 2 * Math.PI,
      d = 8 + 22 * out2(p) * (0.7 + 0.3 * X.hash(k, 32));
    ctx.rect(
      Math.round(X.x1 + d * Math.cos(ang)),
      Math.round(X.y1 + 0.5 * d * Math.sin(ang) - 3 * Math.sin(p * 3)),
      2,
      1,
    );
  }
  ctx.globalAlpha = 0.8 * (1 - p) * X.L.C;
  ctx.fillStyle = '#d9c7a3';
  ctx.fill();
  ctx.globalAlpha = 1;
}

export const STYLE = {
  need(X) {
    const v = X.L.v;
    if (X.L.q || v < 0) return 0;
    return (v < ARR ? 1 | 4 | 16 : 0) | (v >= at(0.75) ? 2 | 8 | 32 : 0);
  },
  back(X, end) {
    const v = X.L.v;
    if (end) aura(X, X.x1, X.y1, auraOf(v, 1), false);
    else {
      aura(X, X.x0, X.y0, auraOf(v, 0), false);
      pebbles(X, v, false);
    }
  },
  floor(X, end) {
    const v = X.L.v;
    if (end) {
      ring(X, X.x1, X.y1, r(v, POP, ar(0.75)), 1);
      ring(X, X.x1, X.y1, r(v, ar(0.3), ar(0.95)), 0.6);
    } else ring(X, X.x0, X.y0, r(v, at(0.16), at(0.42)), 0.9);
  },
  stand(X, end) {
    const v = X.L.v,
      ctx = X.ctx;
    if (end) {
      // locking on: a gold twinkle at the landing; then the afterimages rush in and the body pops out of them
      if (v < ARR) {
        const a = r(v, at(0.75), at(0.95));
        sparkle(ctx, X.x1, X.y1 - 10, 1 + (Math.floor(X.t * 8) % 2), GOLD, a * X.L.C);
      } else if (v < POP) {
        const p = r(v, ARR, POP);
        ghosts(X, X.x1, X.y1, GHOST, 2, -side(X.dir1) * APART * (1 - p), 0, g => 0.75 - 0.3 * g);
      } else {
        aura(X, X.x1, X.y1, auraOf(v, 1), true);
        sparks(X, X.x1, X.y1, 2, auraOf(v, 1));
        dust(X, r(v, POP, ar(0.8)));
        // the last of the power drifting up over the head, gone by the release
        const e = r(v, ar(0.62), REL);
        for (let k = 0; k < 4 && e > 0 && e < 1 && !X.lite; k++) {
          const y = X.y1 - 27 - Math.round(10 * e * (0.6 + 0.4 * X.hash(k, 41))) + (k % 3 ? 0 : 4);
          sparkle(ctx, X.x1 - 9 + 6 * k, y, 1, GOLD_L, (1 - e) * X.L.C);
        }
      }
      return;
    }
    if (v < GONE) {
      const a = auraOf(v, 0);
      aura(X, X.x0, X.y0, a, true);
      sparks(X, X.x0, X.y0, v > FLASH ? 6 : 4, a);
      pebbles(X, v, true);
      return;
    }
    // gone: a streak of light where they stood, and afterimages smeared sideways towards the landing
    const p = r(v, GONE, ARR);
    pebbles(X, v, true);
    ctx.globalAlpha = (1 - p) * X.L.C;
    ctx.fillStyle = WHITE;
    ctx.fillRect(X.x0, X.y0 - 40 + Math.round(30 * p), 1, 44 - Math.round(30 * p));
    ctx.globalAlpha = 1;
    // lighter on snow, where overlapping gold saturates
    const fade = X.night ? 0.7 : X.snow > 0.3 ? 0.6 : 0.85;
    ghosts(X, X.x0, X.y0, GHOST, X.lite ? 1 : 2, side(X.dir0) * (APART + 6 * p), 0, g => (fade - 0.3 * g) * (1 - p));
  },
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || L.calm || v < 0) return false;
    if (L.hide && !L.sw) return true;
    if (!L.sw) {
      if (v >= GONE) return true;
      if (v >= FLASH) {
        ghosts(X, X.x0, X.y0, FLARE, 1, 0, 0, () => 1);
        return true;
      }
      charge(X, v);
      return true;
    }
    if (v >= REL) return false;
    if (v < POP) return true;
    feetShadow(X, X.x1, X.y1);
    X.bodyAt(X.x1, X.y1, { pose: 'stand', front: true, status: 'working' });
    goldHair(X, X.x1, X.y1 - 18, goldOf(v, 1), spikeOf(v, 1));
    return true;
  },
  marks: [],
};
