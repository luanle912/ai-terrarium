// respawn: an arcade death and respawn. Departure: hit, a flashing hop with arms up, then the body bursts into 2 px
// chunks under a typed GAME OVER. Landing: a checkpoint pad lights, the chunks rain into a beam and stack from the
// feet up, a white pop and RESPAWN; the person walks on blinking (invulnerable) through the fade.
import { Kit } from './tp-kit.js';
import { TpPerson } from './tp-person.js';
import { outdoors } from './office-scene.js';

const { atlas, bake, clamp, r, out2 } = Kit;
// The raster round the feet the body is cut from: x fx-20..fx+19, y fy-44..fy+7.
const RW = 40,
  RH = 52,
  RX = 20,
  RY = 44,
  MAXCH = 120,
  HIT = 0.16, // dep: the hit-stop flash ends, the hop starts
  POP = 0.45, // dep: the hop's top, the burst
  SIGN = 0.58, // dep: GAME OVER drops in once most chunks have passed its height
  HOP = 10, // px the hop lifts
  LAND = 0.72, // arr: the rain is in, the pop
  PAD0 = 0.28, // core: the landing pad starts to blink (L_IN, where a hidden start begins)
  OVER = [0.62, 0.72], // core: GAME OVER fades
  RED = '#ff4a4a',
  GOLD = '#ffe45c',
  SPAWN = '#d4ffe0',
  PANEL = 'rgba(16,10,30,0.86)',
  // pad colour indices: 1 rim, 2 fill, 3 lip, 4 inner rim, 5 pips
  PAL = [null, '#3dff7a', 'rgba(61,255,122,0.2)', 'rgba(4,36,18,0.6)', '#b9ffcf', '#ffffff'],
  CW = 53,
  CH = 28;

const RAS = new Uint8Array(RW * RH);
export const newChunks = () => ({
  n: 0,
  cols: null,
  x: new Int16Array(MAXCH),
  y: new Int16Array(MAXCH),
  c: new Uint8Array(MAXCH),
});
// Colour + 1 most of the 2 x 2 cell at i holds, 0 when fewer than two pixels are set.
const Q4 = new Uint8Array(4);
function major(i) {
  Q4[0] = RAS[i];
  Q4[1] = RAS[i + 1];
  Q4[2] = RAS[i + RW];
  Q4[3] = RAS[i + RW + 1];
  let best = 0,
    bn = 0,
    set = 0;
  for (let j = 0; j < 4; j++) {
    const v = Q4[j];
    if (!v) continue;
    set++;
    let n = 0;
    for (let m = 0; m < 4; m++) if (Q4[m] === v) n++;
    if (n > bn) [best, bn] = [v, n];
  }
  return set >= 2 ? best : 0;
}
// The captured body as 2 px chunks of the colour that shows (paint order: the last rect wins).
export function chunkify(cap, fx, fy, out) {
  RAS.fill(0);
  for (let k = 0; k < cap.n; k++) {
    const x0 = Math.max(0, cap.x[k] - fx + RX),
      x1 = Math.min(RW, cap.x[k] + cap.w[k] - fx + RX),
      y0 = Math.max(0, cap.y[k] - fy + RY),
      y1 = Math.min(RH, cap.y[k] + cap.h[k] - fy + RY);
    for (let y = y0; y < y1; y++) RAS.fill(cap.c[k] + 1, y * RW + x0, Math.max(y * RW + x0, y * RW + x1));
  }
  out.n = 0;
  out.cols = cap.cols;
  for (let y = 0; y < RH && out.n < MAXCH; y += 2)
    for (let x = 0; x < RW && out.n < MAXCH; x += 2) {
      const c = major(y * RW + x);
      if (!c) continue;
      out.x[out.n] = fx - RX + x;
      out.y[out.n] = fy - RY + y;
      out.c[out.n++] = c - 1;
    }
  return out;
}
const floorOf = (fy, k, seed) => fy + Math.round((Kit.hash(seed, k, 13) - 0.5) * 8);
// Chunk k at s (0-1) of the burst: thrown out and up from the body's middle, still once it hits its floor row.
export function burstAt(ch, k, fx, fy, s, seed, o) {
  const x0 = ch.x[k],
    y0 = ch.y[k],
    vx = (x0 + 1 - fx) * 2.4 + (Kit.hash(seed, k, 11) - 0.5) * 26,
    vy = -(70 + 50 * Kit.hash(seed, k, 12)) + (y0 + 1 - (fy - 11)) * 0.6,
    floor = floorOf(fy, k, seed),
    g = 220,
    // the root of y0 + vy s + g s^2 = floor
    land = (-vy + Math.sqrt(Math.max(0, vy * vy - 4 * g * (y0 - floor)))) / (2 * g),
    t = Math.min(s, land);
  o[0] = Math.round(x0 + vx * t);
  o[1] = s >= land ? floor : Math.round(y0 + vy * t + g * t * t);
  return o;
}
// Chunk k at t (0-1) of the rain: -1 not yet falling, else 0-1 down to its place; the feet first, the head last.
export function rainAt(ch, k, fx, fy, t, seed, o) {
  const t0 = clamp((fy - ch.y[k]) / 26) * 0.5 + Kit.hash(seed, k, 14) * 0.15,
    l = clamp((t - t0) / 0.35);
  if (l <= 0) return -1;
  o[0] = ch.x[k] + Math.round((Kit.hash(seed, k, 15) - 0.5) * 10 * (1 - l));
  o[1] = ch.y[k] - Math.ceil(70 * (1 - l * l));
  return l;
}
export const typed = (str, p) => Math.min(str.length, Math.ceil(clamp(p) * str.length));

// The pad (frames 0 waiting, 1 lit) and three growing rims for the pop, 53 x 28 cells, centre 26, 13.
function diamond(a, put) {
  const b = a / 2;
  for (let y = -b; y <= b; y++) {
    const e = a - 2 * Math.abs(y);
    if (e < 1) [-1, 0, 1].forEach(x => put(x, y));
    else [e, e - 1, 1 - e, -e].forEach(x => put(x, y));
  }
}
function padPixels(f) {
  const px = new Uint8Array(CW * CH),
    set = (x, y, c) => {
      const i = (13 + y) * CW + 26 + x;
      if (x >= -26 && x <= 26 && y >= -13 && y < 15) px[i] = c;
    },
    rim = f < 2 ? 12 : 12 + 4 * (f - 1);
  if (f < 2)
    for (let y = -6; y <= 6; y++) for (let x = -12; x <= 12; x++) if (Math.abs(x) + 2 * Math.abs(y) < 11) set(x, y, 2);
  diamond(rim, (x, y) => set(x, y, f < 2 ? 1 : 4));
  // a dark lip under the near half keeps the rim on light floors and snow
  diamond(rim, (x, y) => y >= 0 && !px[(14 + y) * CW + 26 + x] && set(x, y + 1, 3));
  if (f === 1) {
    diamond(6, (x, y) => set(x, y, 4));
    [
      [-12, 0],
      [12, 0],
      [0, -6],
      [0, 6],
    ].forEach(([x, y]) => set(x, y, 5));
  }
  return px;
}
let pads = null;
const padAtlas = () =>
  pads ||
  (pads = atlas(CW * 5, CH, g => {
    for (let f = 0; f < 5; f++) bake(g, padPixels(f), CW, CH, f * CW, c => PAL[c]);
  }));

// The kit's 3 px M and W read as H; banners draw them 5 px wide (rows top first, 1 = lit).
const WIDE = { M: ['10001', '11011', '10101', '10001', '10001'], W: ['10001', '10001', '10101', '10101', '01010'] },
  RUNS = new Map();
// Column runs [x, y, h] of a banner string, with ends[i] the run count through letter i and w the width.
export function runs(str) {
  let o = RUNS.get(str);
  if (o) return o;
  o = { g: [], ends: [], w: 0 };
  let x = 0;
  for (const ch of str) {
    const wide = WIDE[ch];
    if (wide) {
      for (let i = 0; i < 5; i++) for (let y = 0; y < 5; y++) if (wide[y][i] === '1') o.g.push(x + i, y, 1);
    } else {
      const g = Kit.glyphs(ch);
      for (let k = 0; k < g.length; k += 3) o.g.push(x + g[k], g[k + 1], g[k + 2]);
    }
    o.ends.push(o.g.length);
    x += wide ? 6 : 4;
  }
  o.w = x - 1;
  RUNS.set(str, o);
  return o;
}
// A banner: dark panel, a rim in the text colour, n letters typed from the left; bottom of the text at by.
function banner(ctx, str, n, cx, by, col, a) {
  if (a <= 0) return;
  const R = runs(str),
    w = R.w,
    left = Math.round(cx - w / 2),
    end = n > 0 ? R.ends[n - 1] : 0;
  ctx.globalAlpha = a;
  ctx.fillStyle = PANEL;
  ctx.fillRect(left - 3, by - 8, w + 6, 11);
  ctx.beginPath();
  ctx.rect(left - 2, by - 9, w + 4, 1);
  ctx.rect(left - 2, by + 3, w + 4, 1);
  for (let k = 0; k < end; k += 3) ctx.rect(left + R.g[k], by - 5 + R.g[k + 1], 1, R.g[k + 2]);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.globalAlpha = 1;
}
const CAP = TpPerson.newCapture(),
  CHUNKS = newChunks(),
  P = [0, 0];
// Paints the chunks one fill per colour; at(k, o) places chunk k and returns false to skip it, or 'spawn' to paint it
// in the spawn colour (still falling); flat paints every chunk in one colour.
function chunks(ctx, ch, at, flat) {
  const groups = flat ? 1 : ch.cols.length + 1;
  for (let c = 0; c < groups; c++) {
    let any = false;
    for (let k = 0; k < ch.n; k++) {
      const how = at(k, P);
      if (how === false || (!flat && (how === 'spawn' ? c !== ch.cols.length : c !== ch.c[k]))) continue;
      if (!any) ctx.beginPath();
      any = true;
      ctx.rect(P[0], P[1], 2, 2);
    }
    if (!any) continue;
    ctx.fillStyle = flat || (c === ch.cols.length ? SPAWN : ch.cols[c]);
    ctx.fill();
  }
}
// The cut body as chunks at the agent's own feet.
function cut(X, o) {
  const f = Kit.feet(X.a.x, X.a.y);
  X.capture(o, CAP);
  return { ch: chunkify(CAP, f[0], f[1], CHUNKS), fx: f[0], fy: f[1] };
}
// A stool sitter is hit on the seat and hops from it; tp.stool, since a.stool is cleared at SQUEEZE.
const seatOf = tp => (tp.stool === 2 ? 9 : tp.stool ? 4 : 0);
const seatPose = tp => (tp.stool === 2 ? 'sitHigh' : tp.stool ? 'sit' : 'up');
// White vanishes on snow, so the hit flashes red there.
const flashOf = X => (X.snow > 0 && outdoors(X.tx0, X.ty0) ? RED : '#ffffff');
// On for n - 1 beats of every n.
const blink = (secs, hz, n = 2) => Math.floor(secs * hz) % n !== n - 1;
// Hit sparks thrown round the chest, gold and white, one fill each.
function sparks(ctx, fx, fy, p, a) {
  const rad = 5 + 9 * out2(p);
  ctx.globalAlpha = a;
  for (let j = 0; j < 2; j++) {
    ctx.beginPath();
    for (let k = j; k < 8; k += 2) {
      const ang = (k * Math.PI) / 4 + 0.4;
      ctx.rect(Math.round(fx + rad * Math.cos(ang)), Math.round(fy - 15 + 0.8 * rad * Math.sin(ang)), 2 - j, 2 - j);
    }
    ctx.fillStyle = j ? '#ffffff' : GOLD;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// A floor pixel under each chunk: keeps the pile readable on a floor of its own colour (green shirt on grass).
function shadows(ctx, ch, fx, fy, s, seed) {
  ctx.beginPath();
  for (let k = 0; k < ch.n; k++) {
    burstAt(ch, k, fx, fy, s, seed, P);
    ctx.rect(P[0], floorOf(fy, k, seed) + 2, 2, 1);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
}

// Departure: hit flash and the hop; hidden once it bursts (stand draws the chunks). True when handled.
function depart(X, L) {
  const p = L.dep;
  if (p >= POP) return true;
  if (L.cut) return false;
  const seat = seatOf(X.tp),
    tint = p < HIT || !blink(L.secs, 14) ? flashOf(X) : null;
  if (p < HIT) X.body({ pose: seatPose(X.tp), tint });
  else X.body({ pose: 'up', lift: seat + Math.round(HOP * out2(r(p, HIT, POP))), tint });
  if (p < HIT + 0.08 && !X.lite) {
    const f = Kit.feet(X.a.x, X.a.y);
    sparks(X.ctx, f[0], f[1] - seat, p / (HIT + 0.08), L.C * (1 - r(p, HIT, HIT + 0.08)));
  }
  return true;
}
// The body bursts into chunks that land round the feet and fade. A cut rewinds them into the usual body, the one
// shown next, so it does not drop from the hop.
function burst(X, L) {
  const s = r(L.dep, POP, 1),
    ctx = X.ctx,
    { ch, fx, fy } = cut(X, L.cut ? {} : { pose: 'up', lift: seatOf(X.tp) + HOP });
  ctx.globalAlpha = L.C * (1 - r(s, 0.75, 1));
  if (s > 0.1) shadows(ctx, ch, fx, fy, s, X.a.id);
  chunks(ctx, ch, (k, o) => burstAt(ch, k, fx, fy, s, X.a.id, o), s < 0.08 && !L.cut ? flashOf(X) : null);
  ctx.globalAlpha = 1;
}
// Arrival and fade: the rain, the pop, RESPAWN over the head, the invulnerable blink.
function arrive(X, L) {
  const ctx = X.ctx,
    f = Kit.feet(X.a.x, X.a.y);
  let a = 1;
  if (L.arr >= 0 && L.arr < LAND) {
    const t = L.arr / LAND,
      { ch, fx, fy } = cut(X, { pose: 'stand' });
    chunks(ctx, ch, (k, o) => {
      const l = rainAt(ch, k, fx, fy, t, X.a.id, o);
      return l < 0 ? false : l < 1 && !X.lite ? 'spawn' : true;
    });
    return true;
  }
  if (L.arr >= 0) X.body({ pose: 'stand', tint: L.arr < LAND + 0.1 ? '#ffffff' : null });
  else {
    a = 1 - r(L.fade, 0.6, 1);
    // Invulnerable: flickers to a ghost rather than vanishing, so it never reads as a dropped frame.
    X.body(L.fade >= 0.85 || blink(L.secs, 10) ? {} : { alpha: 0.3 });
  }
  const up = L.arr >= 0 ? Math.round(5 * out2(r(L.arr, LAND, 0.9))) : 5 + Math.round(4 * L.fade);
  banner(ctx, 'RESPAWN', 7, f[0], f[1] - 30 - up, GOLD, a);
  return true;
}

export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q) return 0;
    return (
      (L.arr >= 0 && L.arr < 0.8 ? 2 : 0) |
      (v >= PAD0 && L.fade < 0.7 ? 8 : 0) |
      (L.dep >= POP || (v >= 0.42 && v < OVER[1]) ? 16 : 0)
    );
  },
  // The spawn beam behind the rain.
  back(X) {
    const L = X.L,
      a = L.C * Math.min(r(L.arr, 0, 0.1), 1 - r(L.arr, 0.6, 0.8)),
      ctx = X.ctx,
      x = X.x1,
      y = X.y1;
    if (a <= 0) return;
    ctx.fillStyle = '#3dff7a';
    // Lite: one slab instead of three fading ones.
    if (X.lite) {
      ctx.globalAlpha = a * 0.14;
      ctx.fillRect(x - 6, y - 60, 13, 60);
    } else
      for (let j = 0; j < 3; j++) {
        ctx.globalAlpha = a * [0.22, 0.14, 0.07][j];
        ctx.fillRect(x - 6, y - 24 * (j + 1), 13, 24);
      }
    ctx.globalAlpha = a * 0.5;
    ctx.fillStyle = SPAWN;
    ctx.fillRect(x - 1, y - 72, 3, 72);
    ctx.globalAlpha = 1;
  },
  // The checkpoint pad: blinking while it waits, lit for the rain, a rim rippling out at the pop.
  floor(X) {
    const L = X.L,
      ctx = X.ctx,
      at = padAtlas();
    let a = L.C,
      fr = 1;
    if (L.v < 0.54) {
      fr = 0;
      a *= r(L.v, PAD0, PAD0 + 0.08) * (blink(L.secs, 5) ? 0.85 : 0.45);
    } else if (L.fade >= 0) a *= 1 - r(L.fade, 0, 0.7);
    if (a > 0) {
      ctx.globalAlpha = a;
      X.stamp(at, fr * CW, 0, CW, CH, X.x1 - 26, X.y1 - 13, CW, CH);
    }
    const w = L.v < 0.54 ? -1 : (L.v - (0.54 + LAND * 0.38)) / 0.2;
    if (w >= 0 && w < 1) {
      ctx.globalAlpha = L.C * (1 - w);
      X.stamp(at, (2 + Math.min(2, Math.floor(3 * w))) * CW, 0, CW, CH, X.x1 - 26, X.y1 - 13, CW, CH);
    }
    ctx.globalAlpha = 1;
  },
  // GAME OVER over the spot: drops in with the burst, types out, holds, fades as the respawn begins. It sits where the
  // head was (the body has burst), low enough to stay clear of most neighbours' speech bubbles. The burst is drawn
  // here, after it, so chunks thrown up pass in front of the panel.
  stand(X, end) {
    const L = X.L;
    if (end || (L.v < 0.42 && L.dep < POP)) return;
    const p = L.v < 0.42 ? L.dep : 1,
      drop = Math.round(5 * (1 - out2(r(p, SIGN, SIGN + 0.1)))),
      a = L.C * (1 - r(L.v, OVER[0], OVER[1]));
    if (p >= SIGN) banner(X.ctx, 'GAME OVER', typed('GAME OVER', r(p, SIGN, 0.82)), X.x0, X.y0 - 34 - drop, RED, a);
    if (L.v < 0.42) burst(X, L);
  },
  person(X) {
    const L = X.L;
    if (L.q) return false;
    if (L.v < 0.42) return L.hide && !L.sw ? true : depart(X, L);
    if (L.v < 0.54) return true;
    return arrive(X, L);
  },
  marks: [],
};
export { MAXCH };
