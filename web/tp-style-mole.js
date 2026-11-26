// mole: the person crouches, raises their arms and drills into the ground spinning, dirt spraying out of a fresh
// hole; a mound of earth tunnels along the real route with a furrow of crumbs behind it; at the landing the mound
// swells and bursts, clods fly, and the person shoots out arms up with a tuft of grass on the head, shakes, and the
// tuft slides off as they walk on. Both holes stay as lasting marks, fill in and fade. The furrow lies flat: off the
// lounge rug in a plain end's floor item, over it in the rug item. The mound rides the trip item at its route point.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { outdoors } from './office-scene.js';
import { LOOK } from './office-people.js';

const { clamp, r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR, T } = TeleportLogic;
const REL = T.RELEASE;
const CROUCH0 = 0.06, // departure fractions: the crouch, the drill down, the body gone
  DIG0 = 0.24,
  DIG1 = 0.84,
  SINK = 26, // px sunk once the raised hands are under
  POP1 = 0.16, // arrival fractions: shot out, back on the ground, squash over, the shake
  LAND1 = 0.32,
  SQ1 = 0.4,
  SHAKE0 = 0.72,
  HOPH = 9, // px over the ground at the top of the pop
  GRAV = 520, // px/s² for clods
  STEP = 0.4, // tiles between furrow crumbs
  TAIL = 4, // tiles of furrow behind the mound
  BACK = 0.6, // tiles from the mound's middle back to its newest crumb
  NCLOD = 10, // clods out of the burst
  NSCAT = 6; // crumbs round the origin hole
// o keyline, d dark dirt, m dirt, l lit dirt, h highlight, wall/hole the inside, dust puffs; day and night.
const PAL = [
  {
    o: '#3e2412',
    d: '#6a4222',
    m: '#93622f',
    l: '#bc874d',
    h: '#e0b47c',
    wall: '#4b2b14',
    hole: '#170c06',
    dust: '#c4a27a',
    dustL: '#e6d2b0',
  },
  {
    o: '#1d1109',
    d: '#4a2f19',
    m: '#6d4a29',
    l: '#936a40',
    h: '#b8915f',
    wall: '#2c190c',
    hole: '#070302',
    dust: '#6f5c47',
    dustL: '#937e64',
  },
];
// On snow outdoors the rim and the mound are snow with the dirt churned through it.
const SNOWY = [
  { o: '#8b9bb0', m: '#e4ebf3', l: '#f6f9fc', h: '#ffffff', dust: '#dfe7f0', dustL: '#ffffff' },
  { o: '#46526a', m: '#9aa7bb', l: '#b9c4d4', h: '#d3dbe6', dust: '#7d889c', dustL: '#a3adbf' },
];
const PALS = [PAL[0], { ...PAL[0], ...SNOWY[0] }, PAL[1], { ...PAL[1], ...SNOWY[1] }];
const palOf = (X, tx, ty) => PALS[(X.night ? 2 : 0) + (X.snow > 0 && outdoors(tx, ty) ? 1 : 0)];
// Grass: dark, mid, light, and the flower; day and night.
const GRASS = [
  { G: '#357a26', g: '#58b53a', l: '#a2e36e', y: '#ffe066' },
  { G: '#1f4d19', g: '#3b8130', l: '#679f49', y: '#cbb65a' },
];

// Rects queued with a colour, then one fill per colour in first-use order (keylines go under).
const NB = 400,
  B = { n: 0, x: new Int16Array(NB), y: new Int16Array(NB), w: new Int16Array(NB), h: new Int16Array(NB) },
  BC = new Uint8Array(NB),
  BCOL = [];
function add(x, y, w, h, col) {
  if (B.n >= NB || w <= 0 || h <= 0) return;
  let ci = BCOL.indexOf(col);
  if (ci < 0) ci = BCOL.push(col) - 1;
  const k = B.n++;
  B.x[k] = Math.round(x);
  B.y[k] = Math.round(y);
  B.w[k] = w;
  B.h[k] = h;
  BC[k] = ci;
}
function flush(ctx, alpha) {
  if (B.n && alpha > 0.01) {
    ctx.globalAlpha = Math.min(1, alpha);
    for (let c = 0; c < BCOL.length; c++) {
      ctx.beginPath();
      for (let k = 0; k < B.n; k++) if (BC[k] === c) ctx.rect(B.x[k], B.y[k], B.w[k], B.h[k]);
      ctx.fillStyle = BCOL[c];
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  B.n = 0;
  BCOL.length = 0;
}
// Row runs [dx, dy, w] of a filled ellipse with half axes a, b px, cached by size.
const ROWS = new Map();
function rows(a, b) {
  const key = a * 64 + b;
  let o = ROWS.get(key);
  if (o) return o;
  o = [];
  for (let y = -b; y <= b; y++) {
    const hw = Math.floor(a * Math.sqrt(Math.max(0, 1 - (y / (b + 0.5)) ** 2)) + 0.25);
    o.push(-hw, y, 2 * hw + 1);
  }
  ROWS.set(key, o);
  return o;
}
// A filled ellipse, only its rows from y0 down to y1 (screen rows).
function blob(cx, cy, a, b, col, y0 = -1e9, y1 = 1e9) {
  if (a < 0 || b < 0) return;
  const o = rows(a, b);
  for (let k = 0; k < o.length; k += 3) {
    const y = cy + o[k + 1];
    if (y >= y0 && y <= y1) add(cx + o[k], y, o[k + 2], 1, col);
  }
}

// Clod k of the landing burst: speeds from the hash, so the live burst and the mark agree where it lies.
const CL = { vx: 0, vy: 0, dy: 0, t: 0, big: false };
function clod(X, k, out = CL) {
  const h1 = X.hash(k, 71),
    h2 = X.hash(k, 72),
    h3 = X.hash(k, 73),
    ang = (k / NCLOD) * 2 * Math.PI + 0.6 * h1;
  out.vx = Math.cos(ang) * (16 + 22 * h2);
  out.dy = Math.round(Math.sin(ang) * (3 + 5 * h2));
  out.vy = 90 + 70 * h3;
  out.t = (2 * out.vy) / GRAV;
  out.big = h3 > 0.45;
  return out;
}
// Where clod k is t s after the burst from (cx, cy): out = [x, y, landed].
function clodAt(X, k, t, cx, cy, out) {
  const c = clod(X, k),
    q = Math.min(t, c.t);
  out[0] = Math.round(cx + c.vx * q);
  out[1] = Math.round(cy + c.dy * (q / c.t) - (c.vy * q - 0.5 * GRAV * q * q));
  out[2] = t >= c.t;
  return out;
}
const CP = [0, 0, false];

// A hole at (cx, cy): open 0-1 its size, fill 0-1 filled back in; from row y0 down only (the rim in front of a body).
function hole(cx, cy, open, fill, p, y0 = -1e9) {
  const a = Math.round(3 + 5 * open),
    b = Math.max(1, Math.round(a / 2)),
    ra = a + 3,
    rb = b + 2;
  blob(cx, cy + 1, ra, rb, p.o, y0);
  blob(cx, cy, ra, rb - 1, p.d, y0);
  blob(cx, cy - 1, ra - 1, rb - 1, p.m, y0);
  blob(cx - 1, cy - 2, ra - 3, rb - 2, p.l, y0, cy - 2);
  if (y0 > -1e9) return;
  add(cx - ra + 2, cy - 2, 1, 1, p.h);
  add(cx + 2, cy - rb, 2, 1, p.h);
  const ia = Math.round(a * (1 - fill)),
    ib = Math.max(1, Math.round(b * (1 - fill)));
  if (ia < 1) return;
  // churned dirt round the opening (shows on snow too)
  blob(cx, cy, ia + 1, ib + 1, p.d);
  blob(cx, cy, ia, ib, p.wall);
  if (ia > 1) blob(cx, cy + 1, ia - 1, Math.max(0, ib - 1), p.hole);
}
// The last row of a hole's opening, under the rim in front.
const lipRow = (cy, open) => cy + Math.max(1, Math.round((3 + 5 * open) / 2));
// Crumbs thrown round a hole, the first n of NSCAT.
function scatter(X, cx, cy, n, p) {
  for (let k = 0; k < n; k++) {
    const ang = (k / NSCAT) * 2 * Math.PI + 0.9 * X.hash(k, 81),
      d = 13 + 6 * X.hash(k, 82),
      x = Math.round(cx + d * Math.cos(ang)),
      y = Math.round(cy + 0.5 * d * Math.sin(ang));
    add(x, y, 2, 1, p.d);
    add(x, y - 1, 1, 1, p.m);
  }
}

// The spray out of the hole while they drill down: a clod every PER s on alternate sides, gone as it lands.
const PER = 0.028,
  LIFE = 0.34;
function spray(X, p) {
  const L = X.L,
    s = TeleportLogic.real(L.v, L.d),
    t0 = DIG0 * L.d[0],
    t1 = Math.min(s, (DIG1 + 0.1) * L.d[0]),
    cx = X.x0,
    cy = X.y0;
  if (t1 < t0) return;
  for (let k = Math.max(0, Math.floor((s - LIFE - t0) / PER)); t0 + k * PER <= t1; k++) {
    const t = s - t0 - k * PER;
    if (t < 0 || t >= LIFE || (X.lite && k % 2)) continue;
    const side = k & 1 ? 1 : -1,
      h = X.hash(k, 91),
      vx = side * (22 + 40 * h),
      vy = 75 + 70 * X.hash(k, 92),
      x = cx + side * 4 + vx * t,
      y = cy - 2 - (vy * t - 0.5 * GRAV * t * t);
    if (y > cy + 3) continue;
    const big = h > 0.5;
    add(x, y, big ? 2 : 1, big ? 2 : 1, k % 3 ? p.d : p.m);
  }
}

// Furrow crumbs along the seen route, STEP tiles apart, on alternate sides; cached per route array (a re-aim gives a
// new one) and start.
const FURROW = new WeakMap(),
  Q = [0, 0, 0, 0, false];
function furrowOf(X) {
  const pts = X.tp && X.tp.route;
  if (!pts || pts.length - X.start < 2) return null;
  let c = FURROW.get(pts);
  if (c && c.start === X.start) return c;
  let total = 0;
  for (let k = X.start + 1; k < pts.length; k++)
    total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  const n = Math.max(0, Math.floor(total / STEP));
  c = { start: X.start, total, n, x: new Int16Array(n), y: new Int16Array(n), rug: new Uint8Array(n) };
  for (let j = 0; j < n; j++) {
    Kit.along(pts, X.start, ((j + 0.5) * STEP) / total, Q);
    c.x[j] = Q[0] + (j & 1 ? 1 : -1) * (X.hash(j, 61) < 0.5 ? 1 : 2);
    c.y[j] = Q[1] - (X.hash(j, 62) < 0.3 ? 1 : 0);
    c.rug[j] = Kit.onRug(Q[2], Q[3], 0) ? 1 : 0;
  }
  FURROW.set(pts, c);
  return c;
}
// Tile distances [tail, head] of the furrow showing; head <= tail when none.
const SPAN = [0, 0];
function span(X, c) {
  const L = X.L,
    v = L.v;
  SPAN[0] = SPAN[1] = 0;
  if (!c || v < DEP) return SPAN;
  const head = (L.trip >= 0 ? L.trip : v >= ARR ? 1 : 0) * c.total - BACK,
    len = X.lite ? 0.6 * TAIL : TAIL;
  // once the mound has burst, the furrow settles from its tail into the landing
  const close = v >= ARR ? ease(r(v, ARR, ARR + 0.6 * (REL - ARR))) : 0;
  SPAN[0] = Math.max(0, lerp(head - len, head, close));
  SPAN[1] = head;
  return SPAN;
}
const FADE_A = [1, 0.62, 0.3];
// The furrow's crumbs between tail and head, older ones fainter; mode 0 off the rug, 1 on it, 2 all.
function furrow(X, mode) {
  const c = furrowOf(X),
    [tail, head] = span(X, c);
  if (head <= tail) return;
  const p = PAL[X.night ? 1 : 0],
    j0 = Math.max(0, Math.ceil(tail / STEP - 0.5)),
    j1 = Math.min(c.n - 1, Math.floor(head / STEP - 0.5));
  for (let b = 0; b < (X.lite ? 2 : 3); b++) {
    for (let j = j0; j <= j1; j++) {
      const age = (head - (j + 0.5) * STEP) / TAIL,
        bk = age < 0.3 ? 0 : age < 0.65 ? 1 : 2;
      if (bk !== b || (mode < 2 && c.rug[j] !== mode)) continue;
      // a lump of turned earth: shade under, dirt over, one lit grain
      add(c.x[j] - 2, c.y[j], 4, 1, p.d);
      add(c.x[j] - 1, c.y[j] - 1, 3, 1, p.m);
      if (bk === 0) add(c.x[j] - (j & 1), c.y[j] - 2, 1, 1, p.l);
    }
    flush(X.ctx, X.L.C * FADE_A[b]);
  }
}
// Whether a furrow crumb on the rug shows now.
function rugShows(X) {
  const c = furrowOf(X),
    [tail, head] = span(X, c);
  if (head <= tail) return false;
  for (let j = Math.max(0, Math.ceil(tail / STEP - 0.5)); j <= Math.min(c.n - 1, Math.floor(head / STEP - 0.5)); j++)
    if (c.rug[j]) return true;
  return false;
}
// The end whose floor item carries the furrow: one on the plain floor (not the rug, not the plinth's lawn, where its
// clip would cut the line); -1: none, and the trip item draws it all.
function trailEnd(X) {
  const plain = (x, y) => !Kit.plinth(x, y) && !Kit.onRug(x, y);
  if (plain(X.tx1, X.ty1)) return 1;
  return !X.L.hide && plain(X.tx0, X.ty0) ? 0 : -1;
}

// The top half of an ellipse standing on (cx, cy).
function dome(cx, cy, a, b, col) {
  const o = rows(a, b);
  for (let k = 0; k < o.length; k += 3) if (o[k + 1] <= 0) add(cx + o[k], cy + o[k + 1], o[k + 2], 1, col);
}
// Snow lying on the mound's upper rows with a ragged lower edge and a lump on one side; dirt shows below it, and
// a few snow crumbs break the rim.
function snowCap(X, cx, cy, a, b, p) {
  const o = rows(a, b),
    low = Math.round(-0.4 * b);
  for (let k = 0; k < o.length; k += 3) {
    const y = o[k + 1];
    if (y > low) break;
    const cut = y === low ? 1 + Math.floor(2 * X.hash(y, 57)) : Math.floor(2 * X.hash(y, 58)),
      side = X.hash(y, 59) < 0.5;
    add(cx + o[k] + (side ? cut : 0), cy + y, o[k + 2] - cut, 1, y < -b + 2 ? p.l : p.m);
  }
  add(cx + 1, cy - b - 1, 1, 1, p.o);
  add(cx + 2, cy - b - 1, 2, 1, p.l);
  add(cx - a - 2, cy, 2, 1, p.m);
  add(cx + a, cy + 1, 2, 1, p.l);
  add(cx - 1, cy + 1, 1, 1, p.m);
}
// The travelling mound at its route point: earth heaving as something digs under it, clods popping off the top;
// grass on it outdoors, snow on snow. Grows out of the start hole and swells before the burst.
function mound(X) {
  const L = X.L;
  X.route(L.trip, Q);
  const s = TeleportLogic.real(L.v, L.d) - L.d[0],
    tick = Math.floor(s * 16),
    k = L.trip < 0.08 ? 0.3 + 0.7 * out2(L.trip / 0.08) : 1 + 0.45 * in2(r(L.trip, 0.8, 1)),
    shake = L.trip > 0.8 ? (tick & 1 ? 1 : -1) : 0,
    cx = Q[0] + shake,
    cy = Q[1],
    a = Math.round(2.5 + 3.5 * k) + (tick % 3 === 0 ? 1 : 0),
    b = Math.round(2 + 3 * k) + (tick % 3 === 1 ? 1 : 0),
    sp = palOf(X, Q[2], Q[3]),
    p = PAL[X.night ? 1 : 0],
    lite = X.lite;
  blob(cx, cy + 1, a + 3, 2, p.o);
  blob(cx, cy, a + 2, 1, p.d);
  dome(cx, cy, a + 1, b + 1, p.o);
  dome(cx, cy, a, b, p.m);
  dome(cx - 1, cy - 1, a - 2, b - 2, p.l);
  if (sp !== p) snowCap(X, cx, cy, a, b, sp);
  if (!lite) add(cx - 2, cy - b + 1, 2, 1, sp.h);
  // grains churning over it
  for (let j = 0; j < (lite ? 2 : 4); j++) {
    const gx = cx - a + 2 + Math.floor(X.hash(tick + j, 51) * (2 * a - 3));
    add(gx, cy - Math.floor(X.hash(tick + j, 52) * b), 1, 1, p.d);
  }
  if (!(X.snow > 0) && outdoors(Q[2], Q[3])) {
    // turf heaved up with it
    const g = GRASS[X.night ? 1 : 0];
    add(cx - 2, cy - b - 2, 1, 2, g.g);
    add(cx, cy - b - 3, 1, 3, g.G);
    add(cx + 2, cy - b - 2, 1, 2, g.l);
  }
  // clods popping off the top, one every 0.12 s
  for (let j = Math.floor((s - 0.3) / 0.12); j <= Math.floor(s / 0.12); j++) {
    const t = s - j * 0.12;
    if (j < 0 || t < 0 || t >= 0.3 || (lite && j & 1)) continue;
    // thrown from off the crown, so none sits on top of it like a knob
    const vx = (X.hash(j, 53) - 0.5) * 60,
      x0 = cx + (j & 1 ? a - 2 : 1 - a),
      y = cy - b - 1 - (55 * t - 0.5 * GRAV * t * t);
    if (y <= cy) add(x0 + vx * t, y, 2, 2, j % 3 ? p.d : p.o);
  }
  flush(X.ctx, L.C * (L.hide ? 0.3 + 0.7 * r(L.trip, 0, 0.05) : 1));
}

// Pixel art for the grass tuft as rows over the head, x -3..3: upright, tumbling, lying on the ground.
// g grass, G its shade, l lit blade, y flower, d dark dirt, m dirt.
const TUFT = [
  ['...y...', '..lg.l.', '.Gg.gG.', '..GgG..', '.dmmmd.'],
  ['.l.....', '..gG...', '.g.gg..', '...Gmd.', '....dm.'],
  ['l.g....', '.gGgmd.', '..Gddm.'],
];
// The tuft with its bottom row on y, centred on x (mirrored: m), frame f.
function tuft(X, x, y, f, m) {
  const g = GRASS[X.night ? 1 : 0],
    p = PAL[X.night ? 1 : 0],
    rowsOf = TUFT[f];
  rowsOf.forEach((row, j) => {
    for (let i = 0; i < 7; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const o = i - 3;
      add(x + (m ? -o - 1 : o), y - rowsOf.length + 1 + j, 1, 1, ch === 'd' || ch === 'm' ? p[ch] : g[ch]);
    }
  });
}
// Px from the feet to the top of the hair, standing.
function hairTop(a) {
  const hs = a ? LOOK(a).hairStyle : '';
  return 19 + (hs === 'bun' ? 3 : hs === 'quiff' ? 2 : 0);
}

// The start hole's size at departure fraction p: it opens under the feet as the drill bites.
const openAt = p => ease(r(p, 0.14, 0.45));
// Body px under the ground while drilling down, and the spin's frame.
const sinkAt = p => Math.round(SINK * in2(r(p, DIG0, DIG1)));
const spinAt = w => Math.floor(3 * w + 13 * w * w);
// Body lift at arrival fraction q: from under the hole up to HOPH over it, back down, then on the ground.
function liftAt(q) {
  if (q < POP1) return Math.round(-SINK + (SINK + HOPH) * out2(q / POP1));
  if (q < LAND1) return Math.round(HOPH * (1 - in2((q - POP1) / (LAND1 - POP1))));
  return 0;
}
// A body pass sunk s px into a hole whose opening ends at row lip: clipped there, and the rim drawn over the cut.
function sunk(X, fx, fy, s, o, open, tx, ty) {
  const cut = lipRow(0, open);
  if (s > cut) o.clip = [99, s - cut];
  o.lift = -s;
  X.body(o);
  if (s > 0) {
    hole(fx, fy, open, 0, palOf(X, tx, ty), lipRow(fy, open) + 1);
    flush(X.ctx, X.L.C);
  }
}
const O = {};
function digPerson(X) {
  const L = X.L,
    p = L.v / DEP,
    tp = X.tp;
  if (tp.stool && p < CROUCH0) {
    X.body({ pose: tp.stool === 2 ? 'sitHigh' : 'sit', front: X.a.dirFront });
    return;
  }
  const s = sinkAt(p);
  if (s >= SINK) return;
  const w = r(p, DIG0, DIG1),
    spin = w > 0 ? spinAt(w) : 0,
    c = ease(r(p, CROUCH0, DIG0)) * (1 - r(p, DIG0, DIG0 + 0.08));
  for (const k in O) delete O[k];
  // arms up like a diver, a crouch to wind up, then a drill: front and back in turn, mirrored every other turn
  Object.assign(O, {
    pose: p < 0.12 ? 'stand' : 'up',
    front: w > 0 ? !(spin & 1) : true,
    mirror: w > 0 && (spin & 2) > 0,
    sx: 1 + 0.1 * c,
    sy: 1 - 0.14 * c,
  });
  sunk(X, X.x0, X.y0, s, O, openAt(p), X.tx0, X.ty0);
}
function popPerson(X) {
  const q = r(X.L.v, ARR, REL),
    lift = liftAt(q),
    sq = q >= LAND1 ? Math.sin(Math.PI * r(q, LAND1, SQ1)) : 0,
    shake = q >= SHAKE0 ? Math.floor((q - SHAKE0) / 0.07) : -1,
    spin = q < POP1 ? Math.floor(9 * out2(q / POP1)) : 0,
    m = (shake >= 0 && shake < 3 && (shake & 1) === 0) || (q < POP1 && (spin & 2) > 0);
  for (const k in O) delete O[k];
  Object.assign(O, {
    pose: shake >= 0 ? 'stand' : 'up',
    front: q < POP1 ? !(spin & 1) : true,
    mirror: m,
    sx: 1 + 0.12 * sq,
    sy: 1 - 0.14 * sq,
  });
  if (lift > 0) {
    O.lift = lift;
    X.body(O);
  } else sunk(X, X.x1, X.y1, -lift, O, 1, X.tx1, X.ty1);
  // the tuft rides the head once it is out of the hole
  const top = Math.round(hairTop(X.a) * O.sy),
    y = X.y1 - lift - top;
  if (y + 1 < lipRow(X.y1, 1)) {
    tuft(X, X.x1, y, 0, m);
    if (shake >= 0 && shake < 4 && !X.lite)
      // dirt shaken off the hair
      for (let j = 0; j < 3; j++) add(X.x1 - 4 + 4 * j, y + 2 + 3 * (shake - j * 0.5), 1, 1, PAL[X.night ? 1 : 0].d);
    flush(X.ctx, X.L.C);
  }
}

// The burst at the landing: a ring of dust and the clods in flight (landed ones belong to the mark).
function burst(X, t) {
  const p = palOf(X, X.tx1, X.ty1),
    cx = X.x1,
    cy = X.y1,
    lite = X.lite;
  for (let k = 0; k < NCLOD; k++) {
    clodAt(X, k, t, cx, cy - 1, CP);
    if (CP[2]) continue;
    const big = CL.big;
    add(CP[0], CP[1], big ? 2 : 1, big ? 2 : 1, k % 3 ? p.d : p.o);
    if (big && !lite) add(CP[0], CP[1], 1, 1, p.l);
  }
  flush(X.ctx, X.L.C);
  const f = t / 0.36;
  if (f >= 1) return;
  const R = 9 + 10 * out2(f),
    n = lite ? 5 : 9,
    big = f < 0.5;
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * 2 * Math.PI + 0.4 * X.hash(k, 77),
      x = Math.round(cx + R * Math.cos(ang)),
      y = Math.round(cy - 1 - 4 * f + 0.5 * R * Math.sin(ang));
    // small puffs: a plus while thick, a dot as it thins
    add(x - (big ? 1 : 0), y, big ? 3 : 1, 1, p.dust);
    if (big) add(x, y - 1, 1, 3, p.dust);
    if (big && !lite) add(x - 1, y - 1, 1, 1, p.dustL);
  }
  flush(X.ctx, X.L.C * 0.85 * (1 - r(f, 0.3, 1)));
}
// The tuft slides off the head as they walk on: tumbles to the ground beside the landing and fades.
function dropTuft(X) {
  const L = X.L,
    t = TeleportLogic.real(L.v, L.d) - TeleportLogic.real(REL, L.d),
    fall = 0.24,
    q = Math.min(1, t / fall),
    top = hairTop(X.a),
    x = Math.round(X.x1 + 6 * q),
    y = Math.round(X.y1 - top + (top + 1) * in2(q));
  tuft(X, x, y, q < 0.3 ? 0 : q < 1 ? 1 : 2, false);
  flush(X.ctx, L.C * (1 - r(L.fade, 0.55, 1)));
}
const since = (L, c) => TeleportLogic.real(L.v, L.d) - TeleportLogic.real(c, L.d);
// Opening of the landing hole as it bursts (the origin's is full when its mark takes over).
const burstOpen = age => 0.5 + 0.5 * out2(clamp(age / 0.08));

export const STYLE = {
  need(X) {
    const L = X.L;
    if (L.q) return 0;
    let n = 0;
    if (!L.sw) n |= Kit.PART.F0 | Kit.PART.S0;
    if (L.trip >= 0 && L.trip < 1) n |= Kit.PART.TRIP;
    const [tail, head] = span(X, furrowOf(X));
    if (head > tail) {
      const te = trailEnd(X);
      n |= te < 0 ? Kit.PART.TRIP : te ? Kit.PART.F1 : Kit.PART.F0;
      if (te >= 0 && rugShows(X)) n |= Kit.PART.RUG;
    }
    if (L.sw && L.v >= ARR) n |= Kit.PART.S1;
    return n;
  },
  floor(X, end) {
    const L = X.L;
    if (!end && !L.sw && L.v < DEP) {
      const p = L.v / DEP,
        pal = palOf(X, X.tx0, X.ty0);
      hole(X.x0, X.y0, openAt(p), 0, pal);
      scatter(X, X.x0, X.y0, Math.floor(NSCAT * r(p, DIG0, DIG1)), pal);
      flush(X.ctx, L.C * r(p, 0.14, 0.18));
    }
    if (end === trailEnd(X)) furrow(X, 0);
  },
  stand(X, end) {
    const L = X.L;
    if (!end) {
      if (!L.sw && L.v < DEP) {
        spray(X, palOf(X, X.tx0, X.ty0));
        flush(X.ctx, L.C);
      }
      return;
    }
    if (L.v < REL) burst(X, since(L, ARR));
    else dropTuft(X);
  },
  trip(X) {
    if (trailEnd(X) < 0) furrow(X, 2);
    if (X.L.trip >= 0 && X.L.trip < 1) mound(X);
  },
  rug(X) {
    furrow(X, 1);
  },
  // One body pass a frame: drilling down at the start, under the ground all trip, shot out at the landing.
  person(X) {
    const L = X.L;
    if (L.q || L.v >= REL) return false;
    if ((L.hide && !L.sw) || (L.trip >= 0 && L.trip < 1)) return true;
    if (!L.sw) digPerson(X);
    else popPerson(X);
    return true;
  },
  marks: [
    { at: 'dep', end: 0, ttl: 3, layer: 'floor' },
    { at: 'arr', end: 1, ttl: 3, layer: 'floor' },
  ],
  // The holes: the start one as the departure left it, the landing one opening with the burst and its clods lying
  // round it; both fill in, then fade.
  drawMark(X, m, age) {
    // a hidden start's hole surfaces with the mound where they come into view, nobody seen digging it
    const A = (1 - r(age, 2.2, 3)) * (m.hide && !m.k ? 0.3 + 0.7 * r(age, 0, 0.15) : 1),
      // the landing hole falls in under the feet once they are out; the start one lingers
      fill = m.k ? ease(r(age, 0.24, 0.5)) : ease(r(age, 1.3, 2.2)),
      p = palOf(X, X.tx0, X.ty0);
    if (A <= 0.01) return;
    hole(X.x0, X.y0, m.k ? burstOpen(age) : 1, fill, p);
    if (!m.k) scatter(X, X.x0, X.y0, NSCAT, p);
    else
      for (let k = 0; k < NCLOD; k++) {
        clodAt(X, k, age, X.x0, X.y0 - 1, CP);
        if (!CP[2]) continue;
        add(CP[0], CP[1], CL.big ? 2 : 1, 1, k % 3 ? p.d : p.o);
        if (CL.big) add(CP[0], CP[1] - 1, 1, 1, p.m);
      }
    flush(X.ctx, A);
  },
  gap: null,
};
// Exposed for tests.
export const MOLE = { sinkAt, liftAt, clod, clodAt, lipRow, hairTop, TUFT, SINK, HOPH, DIG1, POP1, LAND1, NCLOD };
