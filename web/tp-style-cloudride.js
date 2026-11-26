// cloudride: they whistle, and a small white cloud swoops in and hovers beside them; they hop on as it slides under
// their feet and it lifts them off. A gentle glide over the island standing on the cloud, which sheds a trail of
// pearly puffs; over the landing it sinks to knee height, they hop off as it slides away, and it rises and flies off
// into the sky while they walk back. Body and cloud are one picture: person() at both ends, trip() in flight and for
// a hidden start, and trip() again for the cloud leaving after the release. ground() reports the real height, so
// take-off and touchdown sort with the furniture. One body pass.
import { Kit } from './tp-kit.js';
import { TeleportLogic } from './teleport-logic.js';
import { TH, TW } from './office-scene.js';

const { atlas, r, out2, in2, ease, lerp } = Kit;
const { DEP, ARR, T, core } = TeleportLogic;
const { RELEASE: REL, END, L_IN, SQUEEZE } = T,
  at = p => p * DEP, // a departure fraction on the core clock
  ar = p => ARR + p * (REL - ARR), // an arrival fraction
  fd = p => REL + p * (END - REL), // a fade fraction
  B = {
    WHISTLE: [at(0.02), at(0.3)], // two notes rise from them ...
    IN: [at(0.14), at(0.5)], // ... and the cloud swoops in beside them
    HOP: at(0.56), // they hop as it slides under ...
    ON: at(0.72), // ... and stand on it
    LIFT: at(0.8), // it lifts off
    DOWN: ar(0.3), // sunk to knee height over the landing
    OFF: ar(0.4), // they hop off as it slides away ...
    STAND: ar(0.58), // ... and stand
    AWAY: ar(0.72), // it rises and flies off ...
    GONE: fd(0.8), // ... out of sight
  },
  TOP = 9, // px from the floor up to the cloud's top (the feet) when it hovers low
  H0 = 16, // ... at the end of the take-off
  ARRH = 22, // ... as they come in over the landing
  SIDE = 15, // px aside where it hovers before they board and after they get off
  SWX = 56, // the swoop starts this far further out (px) ...
  SWY = 80, // ... and this much higher
  AWX = 46, // and it leaves this far out ...
  AWY = 110, // ... and up
  HOPH = 6, // px of a hop over the straight line
  MEANDER = 0.25; // tiles the glide weaves off the straight line

// Cloud raster, 30 x 13: puffs over a flat base. 1 rim, 2 shade, 3 body, 4 light. Two frames: the puffs churn.
const CW = 30,
  CH = 13,
  CX = 15, // the feet's column
  FEET = 3, // the feet's row: they sink this far into the top
  LIP = 1; // rows over the feet the near half covers
const BLOBS = [
  [
    [-9, 8, 4],
    [-4, 5, 5],
    [3, 5, 5.5],
    [9, 8, 4.2],
  ],
  [
    [-9, 7.5, 4.3],
    [-3, 5.5, 5],
    [4, 5, 5],
    [9, 8, 4],
  ],
];
export function cloudPixels(f) {
  const px = new Uint8Array(CW * CH),
    on = (x, y) => {
      const qx = x + 0.5 - CX,
        qy = y + 0.5;
      if ((qx / 13) ** 2 + ((qy - 9) / 3.2) ** 2 <= 1) return true;
      return BLOBS[f].some(([bx, by, rad]) => (qx - bx) ** 2 + (qy - by) ** 2 <= rad * rad);
    };
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      if (!on(x, y)) continue;
      const edge = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1),
        lit = !on(x - 1, y - 1) || !on(x, y - 2);
      px[y * CW + x] = edge ? 1 : y >= 9 ? 2 : lit ? 4 : 3;
    }
  return px;
}
// pearl white with a cool shade; the gold is only in the whistle notes
const DAY = ['#8e9cc0', '#cdd7ec', '#eef2fa', '#ffffff'],
  NIGHT = ['#4a5578', '#7c88aa', '#a9b4d0', '#d0d8ec'],
  PAL = [DAY, NIGHT];
let sheet = null;
// Columns: frames; rows: day, night.
const sheetOf = () =>
  sheet ||
  (sheet = atlas(2 * CW, 2 * CH, g => {
    for (let l = 0; l < 2; l++)
      for (let f = 0; f < 2; f++) Kit.bake(g, cloudPixels(f), CW, CH, f * CW, c => PAL[l][c - 1], l * CH);
  }));
// The cloud with its feet point at (cx, cy); part 0 whole, 1 only the near lip over the feet.
function cloud(X, cx, cy, part) {
  const f = Math.floor(X.L.secs * 4) % 2,
    row = part ? FEET - LIP : 0;
  X.stamp(sheetOf(), f * CW, (X.night ? CH : 0) + row, CW, CH - row, cx - CX, cy - FEET + row, CW, CH - row);
}

const side = X => (X.x1 >= X.x0 ? 1 : -1),
  // shortcut: read every frame, so an early re-aim the other way turns them in one frame; tp has no fixed facing.
  facing = X => X.y1 >= X.y0,
  perch = stool => (stool === 2 ? 9 : stool ? 4 : 0),
  hop0 = stool => (stool ? SQUEEZE : B.HOP),
  on0 = stool => hop0(stool) + B.ON - B.HOP,
  lift0 = stool => Math.max(B.LIFT, on0(stool) + 0.005),
  cruise = len => Math.min(90, Math.max(30, 16 + 2.4 * (len || 0))),
  waves = len => Math.min(2, Math.max(1, Math.round((len || 0) / 14))),
  bump = t => ease(r(t, 0, 0.42)) * (1 - ease(r(t, 0.6, 1))),
  bob = secs => Math.round(1.3 * Math.sin(secs * 4.2));

// The picture at core v, idle time secs: the feet, pose, facing, legs and alpha of the body; the cloud's feet point,
// alpha and whether they stand on it; ground point and height.
const P = {
    fx: 0,
    fy: 0,
    pose: 'stand',
    front: null,
    legs: 1,
    a: 1,
    cx: 0,
    cy: 0,
    ca: 0,
    on: false,
    gx: 0,
    gy: 0,
    h: 0,
  },
  Q = { ...P };
function reset(p) {
  p.pose = 'stand';
  p.front = null;
  p.legs = 1;
  p.a = 1;
  p.ca = 0;
  p.on = false;
}
// On the cloud at feet height h over an end's floor.
function riding(p, x, y, h, secs) {
  p.on = true;
  p.ca = 1;
  p.h = h;
  p.fx = p.cx = x;
  p.fy = p.cy = y - Math.round(h) + bob(secs);
}
function origin(X, v, secs, p) {
  const stool = X.tp.stool,
    s = side(X);
  p.gx = X.tx0;
  p.gy = X.ty0;
  if (X.L.hide) {
    riding(p, X.x0, X.y0, H0, secs);
    p.a = p.ca = r(v, L_IN, DEP - 0.03);
    p.front = facing(X);
    return p;
  }
  const h0 = hop0(stool),
    o0 = on0(stool),
    l0 = lift0(stool);
  if (v >= o0) {
    riding(p, X.x0, X.y0, lerp(TOP, H0, ease(r(v, l0, DEP))), secs);
    p.front = facing(X);
    p.legs = 1 - 0.25 * Math.sin(Math.PI * r(v, o0, o0 + 0.04));
    return p;
  }
  // the cloud swoops in to hover beside them, then slides under as they hop
  const k = ease(r(v, B.IN[0], B.IN[1])),
    slide = ease(r(v, h0, o0)),
    q = r(v, h0, o0),
    base = perch(stool);
  p.ca = r(v, B.IN[0], B.IN[0] + 0.03);
  p.cx = Math.round(X.x0 + s * (SIDE * (1 - slide) + SWX * (1 - k)));
  p.cy = X.y0 - TOP - Math.round(SWY * (1 - k) ** 1.6) + bob(secs);
  p.h = q > 0 ? lerp(base, TOP, q) + HOPH * Math.sin(Math.PI * q) : base;
  p.fx = X.x0;
  p.fy = X.y0 - Math.round(p.h);
  if (stool && v < h0) {
    // a sitter is drawn at the floor point: the page lifts a sitter onto the stool itself
    p.pose = stool === 2 ? 'sitHigh' : 'sit';
    p.fy = X.y0;
  } else if (v >= h0) {
    p.front = facing(X);
    p.pose = q > 0.15 && q < 0.7 ? 'up' : 'stand';
    p.on = q > 0.6;
  }
  return p;
}
function flight(X, v, secs, p) {
  const t = r(v, DEP, ARR),
    e = ease(t),
    len = X.tp.len,
    dx = X.tx1 - X.tx0,
    dy = X.ty1 - X.ty0,
    d = Math.hypot(dx, dy) || 1,
    m = MEANDER * Math.sin(Math.PI * t) * Math.sin(2 * Math.PI * waves(len) * t),
    ox = (-dy / d) * m,
    oy = (dx / d) * m;
  p.gx = lerp(X.tx0, X.tx1, e) + ox;
  p.gy = lerp(X.ty0, X.ty1, e) + oy;
  const h = lerp(H0, ARRH, t) + cruise(len) * bump(t);
  const x = Math.round(lerp(X.x0, X.x1, e) + (ox - oy) * TW),
    y = Math.round(lerp(X.y0, X.y1, e) + (ox + oy) * TH);
  riding(p, x, y, h, secs);
  p.front = facing(X);
  return p;
}
function arrival(X, v, secs, p) {
  const s = side(X);
  p.gx = X.tx1;
  p.gy = X.ty1;
  if (v < B.OFF) {
    riding(p, X.x1, X.y1, lerp(ARRH, TOP, out2(r(v, ARR, B.DOWN))), secs);
    p.front = facing(X);
    return p;
  }
  // a hop off as the cloud slides out ahead, then it rises and flies off
  const q = r(v, B.OFF, B.STAND),
    slide = ease(q),
    go = r(v, B.AWAY, B.GONE);
  p.h = lerp(TOP, 0, q) + HOPH * Math.sin(Math.PI * q);
  p.fx = X.x1;
  p.fy = X.y1 - Math.round(p.h);
  p.pose = q > 0.1 && q < 0.6 ? 'up' : 'stand';
  p.legs = 1 - 0.3 * Math.sin(Math.PI * r(v, B.STAND, B.STAND + 0.05));
  // from the hop their own facing, the one the walker goes on with
  p.front = null;
  p.on = q < 0.4;
  p.ca = 1 - in2(r(go, 0.65, 1));
  p.cx = Math.round(X.x1 + s * (SIDE * slide + AWX * in2(go)));
  p.cy = X.y1 - TOP - Math.round(AWY * in2(go)) + bob(secs);
  return p;
}
function picture(X, v, secs, p = P) {
  reset(p);
  if (v >= ARR) return arrival(X, v, secs, p);
  if (v >= DEP) return flight(X, v, secs, p);
  return origin(X, v, secs, p);
}
// The cloud's own ground point and height after they got off (the trip item carries it away in the fade).
function cloudGround(X, p, out) {
  const dx = p.cx - X.x1;
  out[0] = X.tx1 + dx / TW / 2;
  out[1] = X.ty1 - dx / TW / 2;
  out[2] = X.y1 - p.cy;
  return out;
}

// Puffs from a flat list (x, y, radius): a shade under, the puff, a light top; one fill per tone.
const PUFF = [
  ['#cdd7ec', '#eef2fa', '#ffffff'],
  ['#6c789a', '#98a4c4', '#c4cce2'],
];
function puffs(X, list, alpha) {
  const ctx = X.ctx;
  if (!list.length || alpha <= 0.01) return;
  const tone = PUFF[X.night ? 1 : 0];
  ctx.globalAlpha = Math.min(1, alpha);
  for (let l = 0; l < 3; l++) {
    ctx.beginPath();
    for (let j = 0; j < list.length; j += 3) {
      const x = list[j] + (l === 2 ? -1 : 0),
        y = list[j + 1] + (l === 0 ? 1 : l === 2 ? -1 : 0),
        q = list[j + 2] - (l === 2 ? 1 : 0);
      if (q < 1) continue;
      ctx.rect(x - q, y - q + 1, 2 * q + 1, 2 * q - 1);
      ctx.rect(x - q + 1, y - q, 2 * q - 1, 2 * q + 1);
    }
    ctx.fillStyle = tone[l];
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// The trail: puffs left on a beat of idle time where the back of the cloud was then, swelling, sinking and thinning
// out. Pure in the clock, so nothing is kept between frames; a crowd keeps the beat and skips every other one.
const RATE = 22,
  LIFE = 0.6,
  TL = [];
function trail(X) {
  const L = X.L,
    tp = X.tp,
    s = side(X);
  TL.length = 0;
  if (L.cut) return TL;
  for (let i = Math.floor(L.secs * RATE); i > (L.secs - LIFE) * RATE; i--) {
    if (X.lite && i % 2) continue;
    const ts = i / RATE,
      v = core(ts, tp.d);
    if (v < DEP || v > ARR) continue;
    const q = picture(X, v, ts, Q),
      f = (L.secs - ts) / LIFE;
    if (f > 0.5 && X.hash(i, 52) < 1.4 * (f - 0.5)) continue;
    TL.push(
      Math.round(q.cx - s * (8 + 4 * X.hash(i, 50)) - s * 6 * f),
      Math.round(q.cy + 5 + 3 * (X.hash(i, 51) - 0.5) + 7 * f),
      Math.round((1.4 + 1.6 * out2(Math.min(1, 3 * f))) * (1 - 0.6 * in2(f))),
    );
  }
  return TL;
}
// Two little notes rising from them as they whistle: a dark rim, then gold; one fill each.
const NOTE = [
  [0, 4, 3, 2],
  [2, 0, 1, 5],
  [3, 1, 1, 1],
  [4, 2, 1, 1],
];
function notes(X, p, v) {
  const k = r(v, B.WHISTLE[0], B.WHISTLE[1]);
  if (k <= 0 || k >= 1 || X.L.hide) return;
  const ctx = X.ctx,
    s = side(X);
  ctx.globalAlpha = Math.min(1, 2.5 * Math.sin(Math.PI * k)) * X.L.C;
  for (let l = 0; l < 2; l++) {
    ctx.beginPath();
    for (let j = 0; j < 2; j++) {
      const g = r(k, 0.3 * j, 0.7 + 0.3 * j);
      if (g <= 0 || g >= 1) continue;
      const x = p.fx + s * (6 + 4 * j) - (s < 0 ? 4 : 0) + Math.round(1.5 * Math.sin(8 * g + j)),
        y = p.fy - 26 - Math.round(12 * g);
      for (const [dx, dy, w, h] of NOTE) ctx.rect(x + dx - 1 + l, y + dy - 1 + l, w + 2 - 2 * l, h + 2 - 2 * l);
    }
    ctx.fillStyle = l ? '#ffd768' : X.night ? '#1c1626' : '#4a3520';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const O = { pose: 'stand', front: null, alpha: 1, legs: 1 };
// The whole picture at one depth: the trail, the cloud behind or under them, the body, the cloud's near lip (or the
// whole cloud when it hovers nearer the camera). A cut fades the cloud and the trail; the person keeps their alpha.
function draw(X, p) {
  const C = X.L.C,
    ctx = X.ctx,
    ca = Math.min(1, p.ca) * C,
    near = !p.on && facing(X);
  puffs(X, trail(X), 0.85 * C);
  if (ca > 0.01 && !near) {
    ctx.globalAlpha = ca;
    cloud(X, p.cx, p.cy, 0);
    ctx.globalAlpha = 1;
  }
  if (p.a > 0.01) {
    O.pose = p.pose;
    O.front = p.front;
    O.legs = p.legs;
    O.alpha = Math.min(1, p.a);
    X.bodyAt(p.fx, p.fy, O);
  }
  if (ca > 0.01 && (near || p.on)) {
    ctx.globalAlpha = ca;
    cloud(X, p.cx, p.cy, p.on ? 1 : 0);
    ctx.globalAlpha = 1;
  }
  notes(X, p, X.L.v);
}
// The shadows under the feet (the remapped body has none) and under the cloud while it is low.
function shade(X, end, p) {
  const x = end ? X.x1 : X.x0,
    y = end ? X.y1 : X.y0;
  if (!p.on) Kit.shadow(X.ctx, x, y, 12, 0.8);
  const ch = y - p.cy;
  if (p.ca > 0.05 && ch < 60) Kit.shadow(X.ctx, p.cx, y, 22 - ch / 4, (0.8 - ch / 80) * Math.min(1, p.ca) * X.L.C);
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
    if (end && L.v >= REL) p.on = true;
    shade(X, end, p);
  },
  trip(X) {
    const L = X.L,
      p = picture(X, L.v, L.secs);
    if (L.v < REL) return draw(X, p);
    // the cloud flying off after the walker took over
    X.ctx.globalAlpha = Math.min(1, p.ca);
    cloud(X, p.cx, p.cy, 0);
    X.ctx.globalAlpha = 1;
  },
  // The feet's ground point and real height while they ride; the cloud's own once they are off.
  ground(X, out) {
    const L = X.L,
      p = picture(X, L.v, L.secs);
    if (L.v >= REL) return !!cloudGround(X, p, out);
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
  marks: [],
  gap: null,
};
// Exposed for tests.
export const CLOUDRIDE = { B, TOP, H0, ARRH, SIDE, CH, picture, trail, cloudGround, hop0, on0, lift0, cruise };
