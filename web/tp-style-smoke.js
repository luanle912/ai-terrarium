// smoke: a smoke bomb held up and thrown down at the feet, a burst of grey smoke and leaves that swallows the person,
// leaves whirling in at the landing, a second burst there out of which they rise from a crouch. The cloud is one
// opaque silhouette (an outline fill, then shaded puff bodies) that breaks into fading wisps; puffs and the bomb are
// baked once, leaves are rect runs, so a frame stamps a few sprites and fills a few paths.
import { TeleportLogic } from './teleport-logic.js';
import { Kit } from './tp-kit.js';
import { outdoors } from './office-scene.js';

const { atlas, bake, clamp, r, out2, in2, ease, lerp } = Kit;
const { real, T } = TeleportLogic;
// Beats on the core clock.
const UP = 0.13, // the bomb held up
  POOF0 = 0.2, // the origin burst
  GONE = 0.25, // hidden in the origin cloud
  GATHER = T.L_IN, // leaves whirl in at the landing, from a hidden starter's first frame
  POOF1 = 0.44, // the landing burst
  SHOW = 0.6, // seen again, crouched
  STAND = 0.75, // stood up
  SEP = 0.4; // past this share of its dissolve a puff leaves the cloud as a wisp
export const CELL = 20;
export const SEEN = { USUAL: 0, HIDE: 1, UP: 2, RISE: 3 };
// Rows: day, dusk, night, snow outdoors by day (greyer, so the cloud keeps an edge on white). 1 lip, 2 shade, 3 body,
// 4 highlight; the cloud's outline is the lip colour.
const PAL = [
  [null, '#7f86a0', '#bfc4d3', '#e6e9f1', '#ffffff'],
  [null, '#565b74', '#979db3', '#c1c6d6', '#e3e6f0'],
  [null, '#2c3149', '#59617e', '#828aa6', '#aeb6cd'],
  [null, '#4f5874', '#8e97b0', '#bcc3d4', '#e1e5ee'],
];
// A dark bomb with a moonlit rim, a fuse and a spark that flickers between two frames (it reads on night floors).
const BOMB = [
  ['......y.', '.....ywy', '.....fy.', '...kkf..', '..khkkk.', '.khhkkkl', '.kkkkkkl', '.kkkkkll', '..kklll.'],
  ['........', '......o.', '.....fyo', '...kkf..', '..khkkk.', '.khhkkkl', '.kkkkkkl', '.kkkkkll', '..kklll.'],
];
const BOMB_COL = { k: '#262b3f', h: '#c9d2ee', l: '#5d6790', f: '#b08a5a', y: '#ffe27a', o: '#ff8a3d', w: '#ffffff' };
const BW = 8,
  BH = 9;
// Leaf colours by day and at night: fresh, dark, dry; then the stem.
const LEAF = [
  ['#7cc456', '#3f8a3f', '#e0b04a', '#5b3a1e'],
  ['#64a35a', '#3b6e40', '#b89148', '#2a1c12'],
];
// A leaf spinning through four frames: flat, tipped up, edge on, tipped down ('x' blade, 's' stem).
const LEAF_FRAMES = [
  ['.xxx.', 'sxxxx', '..xx.'],
  ['...xx', '.xxxx', 'xxxx.', 's....'],
  ['sxxxx'],
  ['s....', 'xxxx.', '.xxxx', '...xx'],
].map(rows => {
  const runs = [[], []];
  rows.forEach((s, y) => {
    for (let x = 0; x < s.length; ) {
      const ch = s[x];
      let e = x + 1;
      while (e < s.length && s[e] === ch) e++;
      if (ch !== '.') runs[ch === 's' ? 1 : 0].push(x - 2, y - (rows.length >> 1), e - x);
      x = e;
    }
  });
  return runs;
});
const NLEAF = 8;
// dx, h (px above the feet), radius, in front of the person (1) or behind (0), kept in a crowd (1); upper ones first
const PUFFS = [
  [2, 24, 4, 0, 0],
  [7, 19, 5, 0, 1],
  [-7, 18, 5, 0, 1],
  [-3, 13, 4, 1, 0],
  [0, 11, 8, 0, 1],
  [10, 8, 5, 0, 0],
  [-10, 7, 5, 0, 0],
  [-5, 4, 5, 1, 1],
  [5, 3, 5, 1, 1],
  [13, 2, 4, 1, 0],
  [-13, 2, 3, 1, 0],
  [0, 1, 4, 1, 1],
];

// Who shows at core clock c: the codes of SEEN.
export function personAt(c, hide, sit) {
  if (c < 0) return SEEN.USUAL;
  if (hide && c < SHOW) return SEEN.HIDE;
  if (c < UP) return sit ? SEEN.USUAL : SEEN.UP;
  if (c < GONE) return SEEN.USUAL;
  if (c < SHOW) return SEEN.HIDE;
  return c < STAND ? SEEN.RISE : SEEN.USUAL;
}
const inside = (x, y, R) => x * x + y * y <= R * R + 0.6 * R;
// One puff of radius R in a CELL square: 1 lip on the lower rim, 2 shade (top rim, lower right), 3 body, 4 highlight.
// A body (for the cloud, whose outline is filled apart) has no lip: its rim is body above and shade below.
export function puffPixels(R, body = false) {
  const px = new Uint8Array(CELL * CELL),
    c0 = CELL >> 1;
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      if (!inside(x, y, R)) continue;
      const rim = !inside(x + 1, y, R) || !inside(x - 1, y, R) || !inside(x, y + 1, R) || !inside(x, y - 1, R);
      let c = 3;
      if (rim && !body) c = y > -0.35 * R ? 1 : 2;
      else if ((x + 0.3 * R) ** 2 + (y + 0.35 * R) ** 2 > (0.95 * R) ** 2) c = y > -0.2 * R ? 2 : 3;
      else if (R >= 3 && (x + 0.35 * R) ** 2 + (y + 0.4 * R) ** 2 < (0.32 * R) ** 2) c = 4;
      px[(c0 + y) * CELL + c0 + x] = c;
    }
  return px;
}
// The outline disk one px round a puff of radius R as rect runs [dy, h, halfWidth], rows of equal width merged.
export const RING = [];
for (let R = 0; R <= 9; R++) {
  const runs = [],
    D = R + 1;
  for (let y = -D; y <= D; y++) {
    let w = 0;
    while (inside(w + 1, y, D)) w++;
    const n = runs.length;
    if (n && runs[n - 1] === w && runs[n - 3] + runs[n - 2] === y) runs[n - 2]++;
    else runs.push(y, 1, w);
  }
  RING.push(runs);
}
// Wisps (with their lip) and bodies of radius 2-9 in columns, two rows per light; the bomb's frames in column 8.
let sheet = null;
const sprites = () =>
  sheet ||
  (sheet = atlas(9 * CELL, 2 * PAL.length * CELL, g => {
    for (let row = 0; row < PAL.length; row++)
      for (let b = 0; b < 2; b++)
        for (let R = 2; R <= 9; R++)
          bake(g, puffPixels(R, !!b), CELL, CELL, (R - 2) * CELL, c => PAL[row][c], (2 * row + b) * CELL);
    BOMB.forEach((rows, f) => {
      const px = new Uint8Array(BW * BH),
        keys = Object.keys(BOMB_COL);
      rows.forEach((s, y) => [...s].forEach((ch, x) => (px[y * BW + x] = keys.indexOf(ch) + 1)));
      bake(g, px, BW, BH, 8 * CELL, c => BOMB_COL[keys[c - 1]], f * CELL);
    });
  }));

// The clock in real seconds, refilled per hook: now, both bursts, the gather, the reveal, the end.
const K = { t: 0, p0: 0, p1: 0, g: 0, show: 0, end: 0, up: 0 };
function clock(X) {
  const d = X.L.d;
  K.t = real(X.L.v, d);
  K.up = real(UP, d);
  K.p0 = real(POOF0, d);
  K.p1 = real(POOF1, d);
  K.g = real(GATHER, d);
  K.show = real(SHOW, d);
  K.end = real(T.END, d);
  return K;
}
const snowy = (X, end) => X.snow > 0 && (end ? outdoors(X.tx1, X.ty1) : outdoors(X.tx0, X.ty0));
const lightRow = (X, end) => (X.df > 0.65 ? (snowy(X, end) ? 3 : 0) : X.df > 0.35 ? 1 : 2);
const side = (X, end) => (X.hash(end, 7) > 0.5 ? -1 : 1);
function stampPuff(X, row, body, R, x, y, alpha) {
  if (alpha <= 0.02) return;
  X.ctx.globalAlpha = alpha;
  const sy = (2 * row + body) * CELL;
  X.stamp(sprites(), (R - 2) * CELL, sy, CELL, CELL, x - (CELL >> 1), y - (CELL >> 1), CELL, CELL);
}
// Puff k of one end at tau s after its burst: o = [x, y, R, s] (s: 0 whole, 1 gone); false before it shows or after.
function puffAt(X, end, k, tau, k0, o) {
  const [dx, h, R0, fr] = PUFFS[k],
    fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0,
    e = out2(clamp((tau - 0.008 * k) / 0.12)),
    h1 = X.hash(k, 11 + end),
    open = end ? k0.show - k0.p1 : 0.22,
    d0 = open + (end && fr ? -0.04 : 0.1) + 0.15 * h1,
    s = clamp((tau - d0) / (end && fr ? 0.35 + 0.2 * h1 : 0.5 + 0.35 * h1)),
    R = Math.min(9, Math.round(R0 * (0.45 + 0.55 * e) * (1 - 0.7 * s)));
  if (e <= 0 || s >= 1 || R < 2) return false;
  o[0] = fx + Math.round(side(X, end) * dx * (e + 0.7 * s) + Math.sin(9 * k0.t + 1.7 * k) * (0.5 + s));
  o[1] = fy - 2 - Math.round(h * e + 18 * s * (0.6 + 0.4 * h1));
  o[2] = R;
  o[3] = s;
  return true;
}
// The cloud's puffs on one side of the person: an opaque silhouette (outline, then bodies), then the loose wisps.
const PO = [0, 0, 0, 0];
function puffs(X, end, front) {
  const k0 = clock(X),
    tau = k0.t - (end ? k0.p1 : k0.p0);
  if (tau <= 0) return;
  const ctx = X.ctx,
    row = lightRow(X, end),
    skip = k => PUFFS[k][3] !== front || (X.lite && !PUFFS[k][4]);
  let any = false;
  for (let k = 0; k < PUFFS.length; k++) {
    if (skip(k) || !puffAt(X, end, k, tau, k0, PO) || PO[3] >= SEP) continue;
    if (!any) ctx.beginPath();
    any = true;
    const runs = RING[PO[2]];
    for (let j = 0; j < runs.length; j += 3)
      ctx.rect(PO[0] - runs[j + 2], PO[1] + runs[j], 2 * runs[j + 2] + 1, runs[j + 1]);
  }
  if (any) {
    ctx.globalAlpha = X.L.C;
    ctx.fillStyle = PAL[row][1];
    ctx.fill();
  }
  for (let pass = 0; pass < 2; pass++)
    for (let k = 0; k < PUFFS.length; k++) {
      if (skip(k) || !puffAt(X, end, k, tau, k0, PO) || PO[3] >= SEP !== !!pass) continue;
      stampPuff(X, row, 1 - pass, PO[2], PO[0], PO[1], X.L.C * (pass ? 1 - r(PO[3], 0.8, 1) : 1));
    }
  ctx.globalAlpha = 1;
}
// The bomb: held up in the right hand, then thrown down in an arc to land just in front of the feet.
function bomb(X) {
  // A cut rewinds without it: the throw played backwards would raise it again.
  if (X.L.cut) return;
  const k0 = clock(X);
  if (k0.t >= k0.p0) return;
  const sit = X.a && X.a.stool,
    hx = X.x0 + 6,
    hy = X.y0 - (sit ? (sit === 2 ? 18 : 13) : 20),
    p = clamp((k0.t - k0.up) / (k0.p0 - k0.up)),
    x = Math.round(lerp(hx, X.x0 + 3, p)),
    y = Math.round(lerp(hy, X.y0 + 2, in2(p)) - 6 * Math.sin(Math.PI * p));
  X.ctx.globalAlpha = X.L.C;
  X.stamp(sprites(), 8 * CELL, (Math.floor(k0.t * 20) % 2) * CELL, BW, BH, x - 4, y - BH, BW, BH);
  X.ctx.globalAlpha = 1;
}
// The burst's flash: a white star and a ring of yellow sparks flying out, one fill each.
function flash(X, end) {
  const k0 = clock(X),
    q = (k0.t - (end ? k0.p1 : k0.p0)) / 0.12;
  if (q < 0 || q >= 1) return;
  const ctx = X.ctx,
    fx = end ? X.x1 : X.x0,
    cy = (end ? X.y1 : X.y0) - 8,
    a = Math.round(8 - 5 * q),
    rr = 6 + 14 * out2(q);
  ctx.globalAlpha = X.L.C;
  ctx.beginPath();
  ctx.rect(fx - a, cy, 2 * a + 1, 1);
  ctx.rect(fx, cy - a, 1, 2 * a + 1);
  if (q < 0.6) ctx.rect(fx - 2, cy - 2, 5, 5);
  else ctx.rect(fx - 1, cy - 1, 3, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const ang = (k + 0.5) * (Math.PI / 4);
    ctx.rect(Math.round(fx + rr * Math.cos(ang)), Math.round(cy + 0.6 * rr * Math.sin(ang)), q < 0.5 ? 2 : 1, 1);
  }
  ctx.fillStyle = '#ffe27a';
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Leaf k's spot at real time t: o = [x, y, frame]. At the landing they first whirl in round the spot; at a burst they
// are flung up and out, flutter down spinning and lie on the floor. False when not shown.
function leafAt(X, end, k, k0, o) {
  const fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0,
    tau = k0.t - (end ? k0.p1 : k0.p0),
    h1 = X.hash(k, 40 + end),
    h2 = X.hash(k, 42 + end);
  if (tau < 0) {
    if (!end) return false;
    const q = (k0.t - k0.g) / (k0.p1 - k0.g),
      ang = (k * 2 * Math.PI) / NLEAF + 9 * (k0.t - k0.g),
      rad = 26 * (1 - 0.7 * q);
    if (q < 0) return false;
    o[0] = Math.round(fx + rad * Math.cos(ang));
    o[1] = Math.round(fy - 6 - 10 * q - 3 * h1 + 0.45 * rad * Math.sin(ang));
    o[2] = Math.floor(14 * (k0.t - k0.g) + k) & 3;
    return true;
  }
  const ang = ((k + 0.5) * 2 * Math.PI) / NLEAF + 0.5 * h1,
    out = (end ? 16 : 20) + 10 * h2,
    top = (end ? 14 : 20) + 14 * h2,
    hgt = tau < 0.2 ? 6 + (top - 6) * out2(tau / 0.2) : top - 24 * (tau - 0.2),
    flung = out2(Math.min(1, tau / 0.6));
  o[0] = Math.round(fx + Math.cos(ang) * out * flung);
  o[1] = Math.round(fy - 1 + Math.sin(ang) * 0.5 * out * flung) - Math.max(0, Math.round(hgt));
  if (hgt <= 0) o[2] = k & 1 ? 0 : 2;
  else {
    o[0] += tau < 0.2 ? 0 : Math.round(3 * Math.sin(8 * tau + 2 * k));
    o[2] = Math.floor(12 * tau + k) & 3;
  }
  return true;
}
const LO = [0, 0, 0];
// One fill per colour: blades by kind (k % 3), then every stem; in a crowd one colour and no stems.
function leaves(X, end) {
  const k0 = clock(X),
    ctx = X.ctx,
    cols = LEAF[X.night ? 1 : 0],
    // the landing's whirl fades in, so a hidden starter's first frame does not pop
    alpha = X.L.C * (1 - r(k0.t, k0.end - 0.4, k0.end)) * (end ? r(k0.t, k0.g, k0.g + 0.12) : 1);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  for (let c = 0; c < (X.lite ? 1 : 4); c++) {
    let any = false;
    for (let k = 0; k < NLEAF; k++) {
      if ((X.lite ? k % 2 : c < 3 && k % 3 !== c) || !leafAt(X, end, k, k0, LO)) continue;
      if (!any) ctx.beginPath();
      any = true;
      const runs = LEAF_FRAMES[LO[2]][c === 3 ? 1 : 0];
      for (let j = 0; j < runs.length; j += 3) ctx.rect(LO[0] + runs[j], LO[1] + runs[j + 1], runs[j + 2], 1);
    }
    if (!any) continue;
    ctx.fillStyle = cols[c];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// Small wisps circling in at the landing before its burst.
function wisps(X) {
  const k0 = clock(X),
    q = (k0.t - k0.g) / (k0.p1 - k0.g);
  if (q < 0 || q >= 1.3) return;
  const row = lightRow(X, 1);
  for (let k = 0; k < 3; k++) {
    const ang = (k * 2 * Math.PI) / 3 + 0.6 + 8 * (k0.t - k0.g),
      rad = 15 * (1 - 0.7 * Math.min(1, q));
    stampPuff(
      X,
      row,
      0,
      Math.round(2 + 1.5 * Math.min(1, q) + (k === 1)),
      X.x1 + Math.round(rad * Math.cos(ang)),
      X.y1 - 4 + Math.round(0.5 * rad * Math.sin(ang)),
      X.L.C * Math.min(1, 8 * q) * (1 - r(q, 1, 1.3)),
    );
  }
  X.ctx.globalAlpha = 1;
}
// How thick the cloud on the floor is at an end, 0-1: the gather darkens the landing spot first.
function thick(X, end) {
  const k0 = clock(X),
    p = end ? k0.p1 : k0.p0,
    open = end ? k0.show : k0.p0 + 0.3;
  return Math.max(r(k0.t, p, p + 0.08), end ? 0.5 * r(k0.t, k0.g, p) : 0) * (1 - r(k0.t, open, open + 0.5));
}

export const STYLE = {
  need(X) {
    const L = X.L;
    if (L.q) return 0;
    return (L.v >= 0 ? 21 : 0) | (L.v >= GATHER ? 42 : 0);
  },
  back(X, end) {
    puffs(X, end, 0);
  },
  floor(X, end) {
    const a = X.L.C * thick(X, end);
    if (a > 0) Kit.shadow(X.ctx, end ? X.x1 : X.x0, (end ? X.y1 : X.y0) + 1, 30, 0.8 * a);
  },
  stand(X, end) {
    if (end) wisps(X);
    else bomb(X);
    puffs(X, end, 1);
    flash(X, end);
    leaves(X, end);
  },
  person(X) {
    const L = X.L,
      seen = personAt(L.q ? -1 : L.v, L.hide, X.a.stool);
    if (seen === SEEN.USUAL || (L.cut && seen === SEEN.UP)) return false;
    if (seen === SEEN.UP) X.body({ pose: 'up' });
    else if (seen === SEEN.RISE) X.body({ legs: lerp(0.25, 1, ease(r(L.v, SHOW, STAND))) });
    return true;
  },
  marks: [],
};
