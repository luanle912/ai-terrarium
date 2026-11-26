// pipe: a steel pipe pushes up out of the floor under the person, they hop and drop into it, it sinks away; at the
// landing another pipe rises, they pop out arms up and ride it down into the floor. The pipe is baked once per height
// (day and night rows) with its ground line curved, so a frame only stamps it; outdoors in snow it wears a snow cap.
import { Kit } from './tp-kit.js';
import { outdoors } from './office-scene.js';

const { atlas, bake, clamp, r, out2, in2, ease } = Kit;
const HM = 20, // px: the pipe's top when risen
  NF = 24, // heights baked, 0 (flush with the floor) to 23 (the overshoot)
  RT = 5, // rim thickness
  CW = 25,
  CX = 12,
  CH = 36,
  CY = 29,
  RW = 31,
  RH = 17,
  SINK = 30, // px a person drops to be out of sight in the pipe
  // 1 outline, 2 base, 3 light, 4 highlight, 5 shade, 6 rim top, 7 hole, 8 inner wall, 9 under the rim, 10 top edge
  DAY = [
    null,
    '#23272d',
    '#7f8995',
    '#a9b3be',
    '#e3e8ee',
    '#5b636e',
    '#9ba5b1',
    '#0b0d10',
    '#3b414a',
    '#30353c',
    '#d4dae2',
  ],
  NIGHT = [
    null,
    '#0b0e12',
    '#4a5462',
    '#66717f',
    '#a3afbe',
    '#343c47',
    '#5b6676',
    '#030405',
    '#222830',
    '#1b2027',
    '#93a0b0',
  ],
  // the soil ring round the base: 1 dark hole edge, 2 earth, 3 crumbs
  SOIL = [null, 'rgba(46,30,16,0.75)', '#7a5532', '#a07a4c'],
  DIRT = ['#8a6238', '#5a3c22'],
  // outdoors in snow: the big chunks are snow, the crumbs earth
  SNOW_DIRT = [
    ['#f6f9fc', '#5a3c22'],
    ['#a9b8d2', '#3a2816'],
  ],
  // the snow a pipe carries up through the cover: 1 rim, 2 shade, 3 base, 4 lit; by day and at night
  CAP = [
    [null, '#9fb4cf', '#c3d3e6', '#e6eef6', '#f6f9fc'],
    [null, '#5f7398', '#7d8fb2', '#98a9c8', '#b0bfda'],
  ],
  KH = 16, // cap sprite rows, rim centre at row KY
  KY = 6,
  TWINKLE = ['#ffffff', '#ffe27a'];

const within = (v, a, b) => v >= a && v < b;
const inEll = (x, y, cy, rx, ry) => (x / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 < 1;
// The lower (near) edge of an ellipse at column x.
const low = (x, cy, rx, ry) => cy + ry * Math.sqrt(Math.max(0, 1 - (x / (rx + 0.5)) ** 2));
const band = (x, rx) => {
  const t = x / rx;
  return t < -0.72 ? 3 : t < -0.42 ? 4 : t < 0.38 ? 2 : 5;
};

// One pipe h px tall (0 = its top flush with the floor), CW x CH colour indices, feet at (CX, CY). Anything under
// the floor's near edge is left out, so a rising pipe meets the floor on a curve.
export function pipePixels(h) {
  const px = new Uint8Array(CW * CH),
    at = (x, y) => (y + CY) * CW + x + CX,
    get = (x, y) => (x < -CX || x > CX || y < -CY || y >= CH - CY ? 0 : px[at(x, y)]),
    kind = new Uint8Array(CW * CH); // 1 body, 2 rim side, 3 rim top, 4 opening
  for (let y = -CY; y < CH - CY; y++)
    for (let x = -CX; x <= CX; x++) {
      const i = at(x, y),
        rimBot = low(x, -h + RT, 10, 5),
        floor = low(x, 0, 10, 5);
      if (y > floor + 0.5) continue;
      if (Math.abs(x) <= 8 && y > -h && y <= low(x, 0, 8, 4) + 0.5) {
        px[i] = band(x, 8);
        kind[i] = 1;
      }
      if (Math.abs(x) <= 10 && y >= low(x, -h, 10, 5) - 0.5 && y <= rimBot + 0.5) {
        px[i] = band(x, 10);
        kind[i] = 2;
      }
      if (inEll(x, y, -h, 10, 5)) {
        px[i] = 6;
        kind[i] = 3;
      }
      if (inEll(x, y, -h, 7, 3)) {
        px[i] = inEll(x, y, -h + 2, 7, 3) ? 7 : 8;
        kind[i] = 4;
      }
    }
  const out = px.slice();
  for (let y = -CY; y < CH - CY; y++)
    for (let x = -CX; x <= CX; x++) {
      const i = at(x, y),
        k = kind[i];
      if (!k) continue;
      const below = y + 1 < CH - CY ? kind[at(x, y + 1)] : 0,
        above = y > -CY ? kind[at(x, y - 1)] : 0;
      if (!get(x - 1, y) || !get(x + 1, y) || !get(x, y - 1) || !get(x, y + 1)) out[i] = 1;
      else if (k === 3 && below === 2) out[i] = 10;
      else if (k === 2 && below === 1) out[i] = 1;
      else if (k === 1 && above === 2) out[i] = 9;
      else if (k === 3 && below === 4) out[i] = 1;
    }
  return out;
}
// The disturbed floor round the base: a dark ring and a scatter of crumbs.
export function soilPixels() {
  const px = new Uint8Array(RW * RH),
    cx = 15,
    cy = 8;
  for (let y = -cy; y < RH - cy; y++)
    for (let x = -cx; x <= cx; x++) {
      const i = (y + cy) * RW + x + cx;
      if (inEll(x, y, 0, 11, 5) && !inEll(x, y, 0, 9, 4)) px[i] = 1;
      else if (inEll(x, y, 0, 14, 7) && !inEll(x, y, 0, 11, 5)) {
        const n = Kit.hash(x + 40, y + 40, 7);
        px[i] = n < 0.32 ? 2 : n < 0.42 ? 3 : 0;
      }
    }
  return px;
}
// Snow lying on the rim's flat top (never over the opening), lumps at the back, drips over the front lip.
export function capPixels() {
  const px = new Uint8Array(CW * KH);
  for (let y = -KY; y < KH - KY; y++)
    for (let x = -10; x <= 10; x++) {
      const n = Kit.hash(x + 30, y + 30, 5),
        ring = inEll(x, y, 0, 10, 5) && !inEll(x, y, 0, 7, 3),
        lump = y < 0 && !inEll(x, y, 0, 10, 5) && inEll(x, y + 1, 0, 10, 5) && n < 0.55,
        drip = y > 0 && !inEll(x, y, 0, 10, 5) && y <= low(x, 0, 10, 5) + (n < 0.45 ? 2 : 1) && Math.abs(x) < 9;
      if (!(ring && n < 0.82) && !lump && !drip) continue;
      px[(y + KY) * CW + x + CX] = drip || x > 5 ? 2 : x < -3 && y < 1 ? 4 : 3;
    }
  // a cool rim under each column's lowest snow, so the cap reads against the steel
  for (let x = 0; x < CW; x++)
    for (let y = KH - 1; y > 0; y--)
      if (px[(y - 1) * CW + x] && !px[y * CW + x]) {
        px[y * CW + x] = 1;
        break;
      }
  return px;
}
let sheet = null;
const sheetOf = () =>
  sheet ||
  (sheet = atlas(NF * CW, 2 * CH + RH, g => {
    for (let f = 0; f < NF; f++) {
      const px = pipePixels(f);
      bake(g, px, CW, CH, f * CW, c => DAY[c]);
      bake(g, px, CW, CH, f * CW, c => NIGHT[c], CH);
    }
    bake(g, soilPixels(), RW, RH, 0, c => SOIL[c], 2 * CH);
    const cap = capPixels();
    for (let n = 0; n < 2; n++) bake(g, cap, CW, KH, RW + n * CW, c => CAP[n][c], 2 * CH);
  }));

// Overshoot easing for the pop out of the floor.
const back = p => {
  const q = p - 1;
  return 1 + 2.70158 * q * q * q + 1.70158 * q * q;
};
// Pipe height (px, fractional) and the pipe's alpha at each end on the core clock.
function height(v, end) {
  if (!end) {
    if (v < 0.12) return HM * back(r(v, 0, 0.12));
    if (v < 0.4) return HM;
    if (v < 0.44) return HM - 2 * Math.sin(Math.PI * r(v, 0.4, 0.44));
    return HM * (1 - in2(r(v, 0.44, 0.56)));
  }
  if (v < 0.31) return 0;
  if (v < 0.43) return HM * back(r(v, 0.31, 0.43));
  if (v < 0.52) return HM;
  if (v < 0.56) return HM + 1.5 * Math.sin(Math.PI * r(v, 0.52, 0.56));
  if (v < 0.78) return HM;
  return HM * (1 - ease(r(v, 0.78, 0.9)));
}
// A call-off sinks the pipes back into the floor with whoever stands on them as it rewinds.
const hOf = (X, end) => height(X.L.v, end) * (X.L.cut ? ease(X.L.C) : 1);
const pipeAlpha = (v, end) => (end ? r(v, 0.28, 0.31) * (1 - r(v, 0.92, 1.05)) : 1 - r(v, 0.56, 0.7));
const soilAlpha = (v, end) => (end ? r(v, 0.28, 0.33) * (1 - r(v, 0.95, 1.35)) : r(v, 0, 0.04) * (1 - r(v, 0.6, 0.85)));
// How far the person is down in the pipe (negative: hopping above the rim), and the pose.
const P = { s: 0, sy: 1, up: false, show: true };
function sunk(v, end) {
  P.sy = 1;
  P.up = false;
  P.show = true;
  if (!end) {
    P.up = v >= 0.02 && v < 0.12;
    if (v < 0.12) P.s = 0;
    else if (v < 0.18) {
      P.s = 0;
      P.sy = 1 - 0.16 * Math.sin(Math.PI * r(v, 0.12, 0.18));
    } else {
      const p = r(v, 0.18, 0.4);
      // a clear 8 px hop above the rim, then down past SINK by the end
      P.s = -50 * p + 78 * p * p;
      P.show = v < 0.4;
    }
    return P;
  }
  P.up = v >= 0.62 && v < 0.8;
  if (v >= 0.76 && v < 0.81) P.sy = 1 - 0.14 * Math.sin(Math.PI * r(v, 0.76, 0.81));
  if (v < 0.7) P.s = SINK - (SINK + 6) * out2(r(v, 0.56, 0.7));
  else P.s = -6 * (1 - in2(r(v, 0.7, 0.76)));
  P.show = v >= 0.56;
  return P;
}
const nightOf = X => clamp((0.6 - X.df) / 0.4);
// The landing pipe shudders a beat before someone pops out of it (nobody is drawn on it then).
const rumble = (X, end) => (end && !X.L.cut && within(X.L.v, 0.49, 0.555) ? (Math.floor(X.L.v * 160) % 2 ? 1 : -1) : 0);
const snowy = (X, end) => X.snow > 0 && (end ? outdoors(X.tx1, X.ty1) : outdoors(X.tx0, X.ty0));
function pipe(X, end) {
  const v = X.L.v,
    a = pipeAlpha(v, end) * Math.min(1, 4 * X.L.C);
  if (a <= 0) return;
  const h = Math.max(0, Math.min(NF - 1, Math.round(hOf(X, end)))),
    cx = (end ? X.x1 : X.x0) + rumble(X, end),
    cy = end ? X.y1 : X.y0,
    img = sheetOf(),
    n = nightOf(X),
    ctx = X.ctx;
  ctx.globalAlpha = a;
  if (n < 1) X.stamp(img, h * CW, 0, CW, CH, cx - CX, cy - CY, CW, CH);
  if (n > 0) {
    ctx.globalAlpha = a * n;
    X.stamp(img, h * CW, CH, CW, CH, cx - CX, cy - CY, CW, CH);
  }
  if (h > 2 && snowy(X, end)) {
    // the night cap only past dusk, so one stamp at most
    ctx.globalAlpha = a;
    X.stamp(img, RW + (n > 0.5 ? CW : 0), 2 * CH, CW, KH, cx - CX, cy - h - KY, CW, KH);
  }
  ctx.globalAlpha = 1;
}
function soil(X, end, a) {
  if (a <= 0) return;
  X.ctx.globalAlpha = a;
  X.stamp(sheetOf(), 0, 2 * CH, RW, RH, (end ? X.x1 : X.x0) - 15, (end ? X.y1 : X.y0) - 8, RW, RH);
  X.ctx.globalAlpha = 1;
}
// Earth thrown up as a pipe breaks through the floor, two colours, one fill each.
function dirt(X, cx, cy, p, salt, end) {
  const ctx = X.ctx,
    cols = snowy(X, end) ? SNOW_DIRT[nightOf(X) > 0.5 ? 1 : 0] : DIRT;
  ctx.globalAlpha = (1 - p) * X.L.C;
  for (let c = 0; c < 2; c++) {
    ctx.beginPath();
    for (let k = c; k < 10; k += 2) {
      const ang = ((k + X.hash(k, salt)) * Math.PI) / 5,
        d = 9 + (10 + 6 * X.hash(k, salt + 1)) * out2(p),
        up = (12 + 8 * X.hash(k, salt + 2)) * 4 * p * (1 - p);
      ctx.rect(Math.round(cx + d * Math.cos(ang)), Math.round(cy + 0.5 * d * Math.sin(ang) - up), 2 - c, 2 - c);
    }
    ctx.fillStyle = cols[c];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// A few bubbles of air out of the opening as someone goes in or comes out.
function puff(X, cx, top, p) {
  const ctx = X.ctx;
  ctx.globalAlpha = 0.85 * (1 - p) * X.L.C;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const q = clamp(p * 1.4 - 0.2 * k),
      z = k === 1 ? 3 : 2;
    ctx.rect(cx - 6 + 5 * k + Math.round(Math.sin(9 * q + k)), Math.round(top - 3 - 16 * out2(q)), z, z);
  }
  ctx.fillStyle = '#eef3f8';
  ctx.fill();
  ctx.globalAlpha = 1;
}
// Twinkles round the head as someone pops out.
function twinkles(X, cx, top, p) {
  const ctx = X.ctx;
  ctx.globalAlpha = X.L.C;
  for (let c = 0; c < 2; c++) {
    ctx.beginPath();
    for (let k = c; k < 4; k += 2) {
      const q = clamp(p * 1.3 - 0.15 * k);
      if (q <= 0 || q >= 1) continue;
      const ang = -Math.PI * (0.15 + 0.7 * (k / 3)),
        d = 8 + 10 * out2(q),
        x = Math.round(cx + d * Math.cos(ang)),
        y = Math.round(top + 0.8 * d * Math.sin(ang)),
        s = q < 0.25 || q > 0.8 ? 0 : !c && q > 0.4 && q < 0.6 ? 2 : 1;
      ctx.rect(x - s, y, 2 * s + 1, 1);
      if (s) ctx.rect(x, y - s, 1, 2 * s + 1);
    }
    ctx.fillStyle = TWINKLE[c];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
export const STYLE = {
  need(X) {
    const { v, q } = X.L,
      fx = !X.lite;
    if (q) return 4;
    return (
      (within(v, 0, 0.7) ? 1 : 0) |
      (within(v, 0.28, 1.05) ? 2 : 0) |
      (within(v, 0, 0.85) ? 4 : 0) |
      (within(v, 0.28, 1.35) ? 8 : 0) |
      (fx && (within(v, 0, 0.22) || within(v, 0.4, 0.5)) ? 16 : 0) |
      (fx && (within(v, 0.31, 0.47) || within(v, 0.56, 0.64) || within(v, 0.66, 0.86)) ? 32 : 0)
    );
  },
  back(X, end) {
    pipe(X, end);
  },
  floor(X, end) {
    const L = X.L;
    if (L.q) {
      // queued: the pipe's mouth waits flush with the floor
      X.ctx.globalAlpha = 0.45;
      X.stamp(sheetOf(), 0, X.night ? CH : 0, CW, CH, X.x0 - CX, X.y0 - CY, CW, CH);
      X.ctx.globalAlpha = 1;
      return;
    }
    soil(X, end, soilAlpha(L.v, end) * L.C);
  },
  stand(X, end) {
    const v = X.L.v,
      cx = end ? X.x1 : X.x0,
      cy = end ? X.y1 : X.y0,
      top = cy - Math.round(hOf(X, end));
    if (!end) {
      if (v < 0.22) dirt(X, cx, cy, r(v, 0, 0.22), 11, 0);
      else if (within(v, 0.4, 0.5)) puff(X, cx, top, r(v, 0.4, 0.5));
      return;
    }
    if (v < 0.47) dirt(X, cx, cy, r(v, 0.31, 0.47), 23, 1);
    else if (v < 0.64) puff(X, cx, top, r(v, 0.56, 0.64));
    else twinkles(X, cx, top - 18, r(v, 0.66, 0.86));
  },
  // One body pass standing on the pipe's top, lowered into it and cut off at the opening's near edge.
  person(X) {
    const L = X.L,
      v = L.v;
    if (L.q || v >= 0.92) return false;
    if (L.hide && !L.sw) return true;
    const end = L.sw ? 1 : 0,
      p = sunk(v, end);
    if (!p.show || p.s >= SINK) return true;
    const h = Math.round(hOf(X, end)),
      s = Math.round(p.s);
    X.body({ pose: p.up ? 'up' : 'stand', lift: h - s, sy: p.sy, clip: [64, s - 3] });
    return true;
  },
  marks: [],
  gap: null,
};
// Exposed for tests: the beats on the core clock.
export const PIPE = { height, sunk, pipeAlpha, soilAlpha, HM, SINK };
