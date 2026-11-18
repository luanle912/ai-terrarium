// The magic teleport on the canvas (the clock and the rule are web/teleport-logic.js): a magic circle under each end,
// a pillar of light, a pixel comet between them, and the person turning white and thinning into the light.
// The circle and the rings are pixel sprites baked once, on the first teleport drawn; a frame only stamps them.
import { TeleportLogic } from './teleport-logic.js';
import { glowAt, glowSprite } from './office-draw-xmas.js';
import { DRAW_REACH, H, OX, OY, PA, PG, TH, TW, W, behindWalls } from './office-scene.js';
import { hash } from './island-grid.js';
import { PantryItems } from './pantry-items.js';
import { ClaudeOffice, mixin } from './office.js';

const { CAP, LITE } = TeleportLogic;
const hasTp = a => a.tp;
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

// The 8-connected 1 px outline of an ellipse with whole radii (midpoint algorithm).
function ellipse(a, b, put) {
  const a2 = a * a,
    b2 = b * b,
    quad = (x, y) => {
      put(x, y);
      put(-x, y);
      put(x, -y);
      put(-x, -y);
    };
  let x = 0,
    y = b,
    dx = 0,
    dy = 2 * a2 * y,
    d1 = b2 - a2 * b + 0.25 * a2;
  while (dx < dy) {
    quad(x, y);
    x++;
    dx += 2 * b2;
    if (d1 < 0) d1 += dx + b2;
    else {
      y--;
      dy -= 2 * a2;
      d1 += dx - dy + b2;
    }
  }
  let d2 = b2 * (x + 0.5) * (x + 0.5) + a2 * (y - 1) * (y - 1) - a2 * b2;
  while (y >= 0) {
    quad(x, y);
    y--;
    dy -= 2 * a2;
    if (d2 > 0) d2 += a2 - dy;
    else {
      x++;
      dx += 2 * b2;
      d2 += dx - dy + a2;
    }
  }
}
function line(x0, y0, x1, y1, put) {
  const dx = Math.abs(x1 - x0),
    dy = -Math.abs(y1 - y0),
    sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    put(x0, y0);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * e;
    if (e2 >= dy) {
      e += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      e += dx;
      y0 += sy;
    }
  }
}
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
// Paints a raster onto g at (ox, oy), one rectangle per horizontal run of a colour.
function bake(g, px, w, h, ox, colour) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; ) {
      const c = px[y * w + x];
      let e = x + 1;
      while (e < w && px[y * w + e] === c) e++;
      if (c) {
        g.fillStyle = colour(c);
        g.fillRect(ox + x, y, e - x, 1);
      }
      x = e;
    }
}
let sigil = null,
  rings = null;
function sigilAtlas() {
  if (!sigil) {
    sigil = document.createElement('canvas');
    sigil.width = SW * FRAMES;
    sigil.height = SH;
    const g = sigil.getContext('2d');
    for (let f = 0; f < FRAMES; f++) bake(g, sigilPixels(f), SW, SH, f * SW, c => PAL[c]);
  }
  return sigil;
}
function ringAtlas() {
  if (!rings) {
    rings = document.createElement('canvas');
    rings.width = RW * 8 + 19;
    rings.height = RH;
    const g = rings.getContext('2d');
    for (let k = 0; k <= 8; k++) {
      const r = ringPixels(k);
      bake(g, r.px, r.w, r.h, k * RW, c => (c === 1 ? '#dffcff' : 'rgba(18,84,112,0.5)'));
    }
  }
  return rings;
}
// The lounge rug is a flat pantry item drawn at depth 19, over anything on the floor under it.
let rug = null;
function onRug(x, y) {
  if (!rug) {
    const it = PantryItems.LAYOUT.find(l => l[0] === 'rug'),
      size = PantryItems.I.rug && PantryItems.I.rug.size;
    if (!it || !size) return false;
    const pad = 1.06; // the circle's radius in tiles
    rug = [20 + it[1] - pad, it[2] - pad, 20 + it[1] + size[0] + pad, it[2] + size[1] + pad];
  }
  return x > rug[0] && y > rug[1] && x < rug[2] && y < rug[3];
}
const out2 = p => 1 - (1 - p) * (1 - p),
  in2 = p => p * p,
  ease = p => p * p * (3 - 2 * p),
  clamp = v => (v < 0 ? 0 : v > 1 ? 1 : v),
  frac = v => v - Math.floor(v),
  feet = (x, y) => {
    const p = PA(x, y);
    return [Math.round(p[0]), Math.round(p[1])];
  };

// 1 or -1 for a spot on the lawn just in front of the office plinth's front or east face, else 0: the back of a circle
// there would lie over the face, which is painted before every item.
function plinth(x, y) {
  if (PA(x, y)[1] !== PG(x, y)[1]) return 0;
  if (y >= H && y < H + 1.1 && x > -1 && x < W + 1) return 1;
  return x >= W && x < W + 1.1 && y > -1 && y < H + 1 ? -1 : 0;
}
// One end's circle on the floor: glow pool, dim queued circle, the sigil inscribed by a quill, flash, shockwave.
function floorFx(G, e, cx, cy, seed, pool, s, lo, side) {
  const { ctx } = G,
    sm = ctx.imageSmoothingEnabled;
  if (side) {
    // keep to the lawn in front of the face's foot
    const foot = x => OY + 2 * TH * (side > 0 ? H : W) + (side * (x - OX) * TH) / TW;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 50, foot(cx - 50));
    ctx.lineTo(cx + 50, foot(cx + 50));
    ctx.lineTo(cx + 50, cy + 30);
    ctx.lineTo(cx - 50, cy + 30);
    ctx.closePath();
    ctx.clip();
  }
  if (e.ring > 0 && pool) {
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = Math.min(1, e.ring * (0.28 + 0.52 * glowAt(G.df) + 0.4 * e.flash));
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
  if (side) ctx.restore();
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

// The white figure: every rect of the person mapped round the feet onto whole pixels (squeezed, lifted), no ctx.scale.
const SQ = { ctx: null, fx: 0, fy: 0, sx: 1, sy: 1, lift: 0 };
function wrect(x, y, w, h) {
  const { ctx, fx, fy, sx, sy, lift } = SQ;
  ctx.fillStyle = '#e9fdff';
  ctx.fillRect(
    Math.round(fx + (Math.round(x) - fx) * sx),
    Math.round(fy - lift + (Math.round(y) - fy) * sy),
    Math.max(1, Math.round(w * sx)),
    Math.max(1, Math.round(h * sy)),
  );
}
let wSrc = null,
  wG = null;
function whiteG(G) {
  if (wSrc !== G) {
    wSrc = G;
    wG = { ...G, rect: wrect, poly() {}, th: { ...G.th, shadow: 'rgba(0,0,0,0)' }, cold: false };
  }
  return wG;
}
const LK = TeleportLogic.newLook(),
  POOL = [];
let busy = false;

mixin(
  ClaudeOffice,
  class {
    // Floor, air and comet items for every teleport playing (queued ones only show their dim circle).
    tpItems(G, items) {
      if (!this.agents.some(hasTp)) return;
      const tps = this.agents.filter(hasTp);
      const calm = !!(this.env && this.env.reduced),
        lo = G.ctx.getTransform().a < 1,
        lite = tps.filter(a => a.tp.cut == null && a.tp.u >= 0 && a.tp.u < 1).length > LITE;
      tps.slice(0, CAP).forEach((a, k) => {
        const tp = a.tp,
          L = TeleportLogic.look(tp, calm, POOL[k] || (POOL[k] = TeleportLogic.newLook())),
          [x0, y0] = feet(tp.x0, tp.y0),
          [x1, y1] = feet(tp.x1, tp.y1),
          seed = a.id * 0.37;
        if (!tp.hide && !behindWalls(Math.floor(tp.x0), Math.floor(tp.y0), DRAW_REACH)) {
          const o = L.o,
            // a later origin close to an earlier one skips its glow, so stacked pools do not blow out
            pool = !tps.some(
              b =>
                b !== a &&
                !b.tp.hide &&
                b.tp.cut == null &&
                b.tp.u < 0.85 &&
                (b.tp.u > tp.u || (b.tp.u === tp.u && b.id < a.id)) &&
                Math.hypot(b.tp.x0 - tp.x0, b.tp.y0 - tp.y0) < 1.5,
            );
          if (o.ring > 0 || o.dim > 0) {
            const s = tp.y0 < 1.6 ? 0.6 : 1;
            const side = plinth(tp.x0, tp.y0);
            items.push({
              z: onRug(tp.x0, tp.y0) ? 19.05 : -0.5,
              f: () => floorFx(G, o, x0, y0, seed, pool, s, lo, side),
            });
          }
          if ((o.top > o.bot && o.colA > 0) || o.rings >= 0 || o.motes >= 0)
            items.push({ z: tp.x0 + tp.y0 + 0.01, f: () => airFx(G, o, x0, y0, a.id, 0, lite, lo) });
        }
        const l = L.l;
        if (l.ring > 0) {
          const s = tp.y1 < 1.6 ? 0.6 : 1,
            side = plinth(tp.x1, tp.y1);
          items.push({
            z: onRug(tp.x1, tp.y1) ? 19.05 : -0.5,
            f: () => floorFx(G, l, x1, y1, seed + 0.5, true, s, lo, side),
          });
        }
        if ((l.top > l.bot && l.colA > 0) || l.rings >= 0 || l.motes >= 0 || l.burst >= 0)
          items.push({ z: tp.x1 + tp.y1 + 0.01, f: () => airFx(G, l, x1, y1, a.id, 1, lite, lo) });
        if (L.bolt >= 0) {
          const b = L.bolt,
            u = tp.u;
          items.push({ z: 1e9, f: () => comet(G, b, x0, y0, x1, y1, u) });
        }
      });
    }
    // Draws the person as the teleport shows them; false leaves drawPerson to draw them as usual.
    tpPerson(G, a) {
      if (busy) return false;
      const L = TeleportLogic.look(a.tp, !!(this.env && this.env.reduced), LK);
      if (L.show === 1 && L.alpha === 1) return false;
      if (L.show === 0) return true;
      const { ctx } = G;
      busy = true;
      try {
        if (L.show !== 3) {
          ctx.globalAlpha = L.alpha;
          this.drawPerson(G, a);
        }
        if (L.show >= 2) {
          [SQ.fx, SQ.fy] = feet(a.x, a.y);
          Object.assign(SQ, { ctx, sx: L.sx, sy: L.sy, lift: L.lift });
          ctx.globalAlpha = L.show === 3 ? 1 : L.white;
          this.drawPerson(whiteG(G), a);
        }
      } finally {
        ctx.globalAlpha = 1;
        busy = false;
      }
      return true;
    }
  },
);
