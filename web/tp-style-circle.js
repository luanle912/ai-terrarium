// circle: the magic circle under each end, a pillar of light, a pixel comet between them, and the person turning
// white and thinning into the light. The circle and the rings are pixel sprites baked once, on the first teleport
// drawn; a frame only stamps them. Its clock is TeleportLogic.look on the core clock.
import { TeleportLogic } from './teleport-logic.js';
import { glowSprite } from './office-draw-xmas.js';
import { Light } from './light.js';
import { Kit } from './tp-kit.js';

const { ellipse, line, bake, atlas, hash, out2, in2, ease, clamp, frac } = Kit;
const RX = 24,
  RY = 12,
  SW = 2 * RX + 1,
  SH = 2 * RY + 2,
  FRAMES = 24,
  // sigil colour indices: 1 disc, 2 lip, 3 rings, 4 gold rune, 5 white rune, 6 hexagram, 7 white points
  PAL = [
    null,
    'rgba(42,20,96,0.45)',
    'rgba(28,12,60,0.65)',
    '#7ff3ff',
    '#ffd36e',
    '#f4fdff',
    'rgba(167,123,255,0.85)',
    '#ffffff',
  ],
  GLYPHS = [
    ['#.#', '.#.'],
    ['###', '#.#'],
  ],
  // ring atlas: 8 growing rings in 93 x 48 cells, then the small column ring
  RW = 93,
  RH = 48,
  MOTE = ['#7ff3ff', '#ffffff', '#ffd36e', '#c792ff'];

// One frame of the circle (49 x 26 colour indices, centre 24, 12). Over FRAMES the rune band turns 60 degrees, its
// own symmetry, so the frames loop; the hexagram stays upright (turned, it breaks into stripes at 2:1).
export function sigilPixels(f) {
  const px = new Uint8Array(SW * SH),
    set = (x, y, c) => {
      const X = RX + x,
        Y = RY + y;
      if (X >= 0 && Y >= 0 && X < SW && Y < SH) px[Y * SW + X] = c;
    },
    lines = [],
    mark = c => (x, y) => lines.push([x, y, c]),
    p = f / FRAMES,
    v = k => {
      const a = -Math.PI / 2 + (k * Math.PI) / 3;
      return [Math.round(18 * Math.cos(a)), Math.round(9 * Math.sin(a))];
    },
    sparks = [];
  for (let y = -RY; y <= RY; y++)
    for (let x = -RX; x <= RX; x++) if ((x * x) / (RX * RX) + (y * y) / (RY * RY) < 0.92) set(x, y, 1);
  ellipse(RX, RY, mark(3));
  ellipse(18, 9, mark(3));
  ellipse(6, 3, mark(3));
  for (const s of [0, 1])
    for (let k = 0; k < 3; k++) {
      const [x0, y0] = v(s + 2 * k),
        [x1, y1] = v(s + 2 * k + 2),
        seg = [];
      line(x0, y0, x1, y1, (x, y) => {
        lines.push([x, y, 6]);
        seg.push([x, y]);
      });
      for (const o of [0, 0.5]) sparks.push(seg[Math.floor(((p + o) % 1) * seg.length)]);
    }
  // a dark lip under the outer ring's near half, so the circle reads on a light floor
  for (const [x, y, c] of lines)
    if (c === 3 && y > 0 && (x * x) / (RX * RX) + (y * y) / (RY * RY) > 0.8 && px[(RY + y + 1) * SW + RX + x] !== 3)
      set(x, y + 1, 2);
  for (const [x, y, c] of lines) set(x, y, c);
  for (let k = 0; k < 6; k++) set(...v(k), 7);
  for (const [x, y] of sparks) set(x, y, 7);
  for (let k = 0; k < 3; k++) {
    const a = -((p + k) * 2 * Math.PI) / 3;
    set(Math.round(6 * Math.cos(a)), Math.round(3 * Math.sin(a)), 7);
  }
  for (let k = 0; k < 12; k++) {
    const a = (((k + 2 * p) % 12) * Math.PI) / 6, // the modulo makes 2 pi and 0 round alike
      gx = Math.round(21 * Math.cos(a)) - 1,
      gy = Math.round(10.5 * Math.sin(a) - 0.5);
    GLYPHS[k % 2].forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && set(gx + i, gy + j, k % 2 ? 5 : 4)));
  }
  set(0, 0, 7);
  set(-1, 0, 5);
  set(1, 0, 5);
  set(0, -1, 5);
  set(0, 1, 5);
  return px;
}
// Ring k of the atlas: 0-7 the flash and the shockwave growing (two pixels thick while young), 8 the column ring.
// 1 ring, 2 its shade.
export function ringPixels(k) {
  const small = k === 8,
    w = small ? 19 : RW,
    h = small ? 9 : RH,
    cx = small ? 9 : 46,
    cy = small ? 4 : 23,
    px = new Uint8Array(w * h),
    put = (x, y) => {
      if (cx + x >= 0 && cx + x < w && cy + y >= 0 && cy + y < h) px[(cy + y) * w + cx + x] = 1;
    };
  const rx = small ? 9 : Math.round(24 + (22 * k) / 7);
  ellipse(rx, small ? 4 : Math.floor(rx / 2), put);
  if (k <= 2) ellipse(rx - 2, Math.floor(rx / 2) - 1, put);
  // a dark row under the ring keeps it on cream tiles and snow
  for (let i = w * (h - 1) - 1; i >= 0; i--) if (px[i] === 1 && !px[i + w]) px[i + w] = 2;
  return { w, h, px };
}
let sigil = null,
  rings = null;
const sigilAtlas = () =>
  sigil ||
  (sigil = atlas(SW * FRAMES, SH, g => {
    for (let f = 0; f < FRAMES; f++) bake(g, sigilPixels(f), SW, SH, f * SW, c => PAL[c]);
  }));
const ringAtlas = () =>
  rings ||
  (rings = atlas(RW * 8 + 19, RH, g => {
    for (let k = 0; k <= 8; k++) {
      const r = ringPixels(k);
      bake(g, r.px, r.w, r.h, k * RW, c => (c === 1 ? '#dffcff' : 'rgba(18,84,112,0.5)'));
    }
  }));
// One end's circle on the floor: glow pool, dim queued circle, the sigil inscribed by a quill, flash, shockwave.
function floorFx(G, e, cx, cy, seed, pool, s, lo) {
  const { ctx } = G,
    sm = ctx.imageSmoothingEnabled;
  if (e.ring > 0 && pool) {
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = Math.min(1, e.ring * (0.28 + 0.52 * Light.glow(G.df) + 0.4 * e.flash));
    const w = Math.round(73 * s),
      h = Math.round(37 * s);
    ctx.drawImage(glowSprite('#5ef2ff', 64), Math.round(cx - 36 * s), Math.round(cy - 18 * s), w, h);
  }
  ctx.imageSmoothingEnabled = lo;
  const at = sigilAtlas(),
    f = Math.floor(frac(e.spin + seed) * FRAMES) % FRAMES,
    stamp = () => ctx.drawImage(at, f * SW, 0, SW, SH, cx - RX, cy - RY, SW, SH);
  if (e.dim > 0) {
    ctx.globalAlpha = e.dim;
    stamp();
  }
  if (e.ring > 0) {
    ctx.globalAlpha = e.ring;
    if (e.sweep < 1) {
      const a = -Math.PI / 2 + 2 * Math.PI * e.sweep;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, cy + 0.5);
      ctx.ellipse(cx + 0.5, cy + 0.5, 28, 15, 0, -Math.PI / 2, a);
      ctx.closePath();
      ctx.clip();
      stamp();
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(cx + RX * Math.cos(a)) - 1, Math.round(cy + RY * Math.sin(a)) - 1, 3, 3);
    } else stamp();
  }
  if (e.flash > 0) {
    ctx.globalAlpha = e.flash;
    ctx.drawImage(ringAtlas(), 0, 0, RW, RH, cx - 46, cy - 23, RW, RH);
  }
  if (e.wave >= 0) {
    const k = Math.min(7, Math.floor(8 * out2(e.wave)));
    ctx.globalAlpha = 0.85 * (1 - e.wave);
    ctx.drawImage(ringAtlas(), k * RW, 0, RW, RH, cx - 46, cy - 23, RW, RH);
  }
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = sm;
}
// One end in the air: the pillar of light, rings sliding along it, rising motes, the landing's burst of sparks.
function airFx(G, e, cx, cy, id, end, lite, lo) {
  const { ctx } = G,
    sm = ctx.imageSmoothingEnabled;
  if (e.top > e.bot && e.colA > 0) {
    const yt = Math.round(cy - e.top),
      h = Math.round(cy - e.bot) + 1 - yt,
      bar = (half, cut, colour, alpha) => {
        const w = Math.round(half * e.w);
        if (h - cut <= 0) return;
        ctx.globalAlpha = alpha * e.colA;
        ctx.fillStyle = colour;
        ctx.fillRect(cx - w, yt + cut, 2 * w + 1, h - cut);
      };
    bar(7, Math.min(10, h), '#5ef2ff', 0.22);
    bar(4, Math.min(5, h), '#a8f7ff', 0.4);
    bar(e.core, 0, '#ffffff', 0.9);
    const rim = 0.5 * e.colA * clamp((G.df - 0.4) / 0.4),
      bw = Math.round(4 * e.w) + 1,
      top = yt + Math.min(5, h);
    if (rim > 0 && h > 5) {
      ctx.globalAlpha = rim;
      ctx.fillStyle = '#1f9fbf';
      ctx.fillRect(cx - bw, top, 1, h - Math.min(5, h));
      ctx.fillRect(cx + bw, top, 1, h - Math.min(5, h));
    }
    if (e.bot < 1) {
      ctx.globalAlpha = 0.7 * e.colA;
      ctx.fillStyle = '#e9fdff';
      ctx.fillRect(cx - 9, cy, 19, 1);
    }
  }
  if (e.rings >= 0) {
    ctx.imageSmoothingEnabled = lo;
    for (let k = 0; k < 3; k++) {
      const p = end ? (e.rings - 0.04 * k) / 0.12 : (e.rings - 0.05 * k) / 0.16;
      if (p <= 0 || p >= 1) continue;
      ctx.globalAlpha = end ? 0.5 + 0.4 * p : 0.9 * (1 - p);
      const y = cy - Math.round(70 * (end ? 1 - in2(p) : out2(p)));
      ctx.drawImage(ringAtlas(), 8 * RW, 0, 19, 9, cx - 9, y - 4, 19, 9);
    }
    ctx.imageSmoothingEnabled = sm;
  }
  if (!lite && e.motes >= 0)
    for (let k = 0; k < 8; k++) {
      const m = e.motes - 0.08 * k;
      if (m < 0 || m >= 0.7) continue;
      const p = m / 0.7;
      let hx = 2 * hash(id * 13 + k, end, 1) - 1,
        hy = 2 * hash(id * 13 + k, end, 2) - 1;
      const n = Math.hypot(hx, hy);
      if (n > 1) {
        hx /= n;
        hy /= n;
      }
      const x = Math.round(cx + 19 * hx + 1.5 * Math.sin(6 * p + k)),
        y = Math.round(cy + 9 * hy - 44 * out2(p)),
        z = k % 3 ? 1 : 2;
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = MOTE[k % 4];
      if (k % 4 === 1 && p > 0.25 && p < 0.5) {
        ctx.fillRect(x - 2, y, 5, 1);
        ctx.fillRect(x, y - 2, 1, 5);
      } else ctx.fillRect(x, y, z, z);
    }
  if (!lite && e.burst >= 0)
    for (let k = 0; k < 8; k++) {
      const a = (k + 0.5 + 0.4 * hash(id, k, 3)) * (Math.PI / 4),
        r = 4 + 30 * out2(e.burst);
      ctx.globalAlpha = 1 - e.burst;
      ctx.fillStyle = k % 2 ? '#ffd36e' : '#ffffff';
      ctx.fillRect(Math.round(cx + r * Math.cos(a)), Math.round(cy + (r / 2) * Math.sin(a)), e.burst < 0.5 ? 2 : 1, 1);
    }
  ctx.globalAlpha = 1;
}
// The comet from one pillar's top to the other's: a streak (a few dots would flicker in its 7 frames) and a head
// with a halo and a sparkle.
function comet(G, b, x0, y0, x1, y1, u) {
  const { ctx } = G,
    ay = y0 - 80,
    by = y1 - 80,
    mx = (x0 + x1) / 2,
    my = Math.min(ay, by) - Math.max(30, 0.2 * Math.hypot(x1 - x0, by - ay)),
    t = ease(b),
    t0 = Math.max(0, t - 0.25),
    at = (s, a, m, c) => (1 - s) * (1 - s) * a + 2 * (1 - s) * s * m + s * s * c,
    sm = ctx.imageSmoothingEnabled;
  ctx.beginPath();
  for (let j = 0; j < 8; j++) {
    const s = t0 + ((t - t0) * j) / 7;
    ctx.lineTo(at(s, x0, mx, x1), at(s, ay, my, by));
  }
  ctx.strokeStyle = '#5ef2ff';
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = '#e9fdff';
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1;
  ctx.stroke();
  const hx = Math.round(at(t, x0, mx, x1)),
    hy = Math.round(at(t, ay, my, by));
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 1;
  ctx.drawImage(glowSprite('#5ef2ff', 64), hx - 15, hy - 15, 31, 31);
  ctx.imageSmoothingEnabled = sm;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(hx - 1, hy - 1, 3, 3);
  if (Math.floor(u * 30) % 2 === 0) {
    ctx.globalAlpha = 0.8;
    ctx.fillRect(hx - 4, hy, 9, 1);
    ctx.fillRect(hx, hy - 4, 1, 9);
  }
  ctx.globalAlpha = 1;
}

const { core } = TeleportLogic;
const POOL = [],
  LK = TeleportLogic.newLook();
// Under the dispatcher's X (office-draw-teleport.js); X.L is not used, the circle keeps its own look.
const lookOf = X => TeleportLogic.look(X.tp, X.calm, POOL[X.k] || (POOL[X.k] = TeleportLogic.newLook()));
const ends = (X, end) => (end ? X.look.l : X.look.o);
// A later origin close to an earlier one skips its glow, so stacked pools do not blow out.
function pooled(X) {
  const a = X.a,
    tp = X.tp,
    u = core(tp.u, tp.d);
  return !X.all.some(b => {
    const v = b.tp && core(b.tp.u, b.tp.d);
    return (
      b !== a &&
      !b.tp.hide &&
      b.tp.cut == null &&
      v < 0.85 &&
      (v > u || (v === u && b.id < a.id)) &&
      Math.hypot(b.tp.x0 - tp.x0, b.tp.y0 - tp.y0) < 1.5
    );
  });
}
const air = e => (e.top > e.bot && e.colA > 0) || e.rings >= 0 || e.motes >= 0;

export const STYLE = {
  need(X) {
    const L = (X.look = lookOf(X)),
      { o, l } = L;
    return (
      (o.ring > 0 || o.dim > 0 ? 4 : 0) |
      (air(o) ? 16 : 0) |
      (l.ring > 0 ? 8 : 0) |
      (air(l) || l.burst >= 0 ? 32 : 0) |
      (L.bolt >= 0 ? 64 : 0)
    );
  },
  floor(X, end) {
    const ty = end ? X.tp.y1 : X.tp.y0,
      s = ty < 1.6 ? 0.6 : 1;
    if (end) floorFx(X.G, X.look.l, X.x1, X.y1, X.seed + 0.5, true, s, X.lo);
    else floorFx(X.G, X.look.o, X.x0, X.y0, X.seed, pooled(X), s, X.lo);
  },
  stand(X, end) {
    airFx(X.G, ends(X, end), end ? X.x1 : X.x0, end ? X.y1 : X.y0, X.a.id, end, X.lite, X.lo);
  },
  trip(X) {
    comet(X.G, X.look.bolt, X.x0, X.y0, X.x1, X.y1, X.tp.u);
  },
  ground() {
    return false;
  },
  // The person as the circle shows them; false leaves drawPerson to draw them as usual.
  person(X) {
    const L = TeleportLogic.look(X.tp, X.calm, LK);
    if (L.show === 1 && L.alpha === 1) return false;
    if (L.show === 0) return true;
    if (L.show !== 3) X.body({ alpha: L.alpha, bare: false });
    if (L.show >= 2)
      X.body({ alpha: L.show === 3 ? 1 : L.white, tint: '#e9fdff', sx: L.sx, sy: L.sy, lift: L.lift, bare: false });
    return true;
  },
  marks: [],
};
