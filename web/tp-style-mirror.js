// mirror: a gilded standing mirror rises out of a quicksilver pool beside the person, who turns to it, meets their
// reflection and walks into the glass with a ripple; at the landing a second mirror rises, the glass ripples and they
// step out of it, their back reflected behind them, before it sinks into its pool. Mirror, glass veil, ripples, glints,
// the white flash and the pools are pixel sprites baked once; a frame only stamps them.
import { glowSprite } from './office-draw-xmas.js';
import { Light } from './light.js';
import { Kit } from './tp-kit.js';
import { BLOCK, TH, TW } from './office-scene.js';

const { ellipse, bake, atlas, r, out2, in2, ease, lerp } = Kit;
const MW = 21, // mirror cell
  MH = 34,
  CX = 10,
  CY = 17, // glass centre in the cell
  GRX = 6.5,
  GRY = 12.5,
  PW = 25, // pool cell
  PH = 13,
  SIDE = 9, // px from the feet to the mirror's foot, sideways
  BACK = 7, // and up-screen (behind the person)
  BACK2 = 13, // further back when furniture in front would hide the mirror
  RIPPLES = 6,
  GLINTS = 6,
  // 1 outline, 2 gold, 3 gold light, 4 glass, 5 glass light, 6 glass dark, 7 white, 8 gold shade, 9 glass rim,
  // 10 gem, 11 gem light, 12 veil, 13 ripple, 14 ripple shade, 15 pool, 16 pool dark, 17 pool rim, 18 pool edge
  PAL = [
    null,
    '#4a2e0c',
    '#d6a52a',
    '#ffe48a',
    '#8ec3e6',
    '#cdeeff',
    '#5f97c4',
    '#ffffff',
    '#9a6a10',
    '#3c6e98',
    '#e93d82',
    '#ffc2dc',
    'rgba(205,238,255,0.45)',
    'rgba(255,255,255,0.95)',
    'rgba(44,96,150,0.75)',
    '#a9d2ec',
    '#6f9cc2',
    '#eaf8ff',
    '#355a7c',
  ],
  // the pools at night: quicksilver catching the mirror's glow, dimmer than by day
  NIGHT_POOL = { 15: '#7fa6cc', 16: '#4d7299', 17: '#c4def2', 18: '#22384f' },
  SPARK = ['#ffffff', '#ffe48a', '#cdeeff', '#ffc2dc'];

const glassAt = (x, y) => (x - CX) ** 2 / (GRX * GRX) + (y - CY) ** 2 / (GRY * GRY);
// The cells of the top row: 0 mirror, 1 veil, 2-7 ripples, 8-13 glints, 14 flash.
function cellPixels(k) {
  const px = new Uint8Array(MW * MH),
    set = (x, y, c) => {
      if (x >= 0 && y >= 0 && x < MW && y < MH) px[y * MW + x] = c;
    };
  for (let y = 0; y < MH; y++)
    for (let x = 0; x < MW; x++) {
      const g = glassAt(x, y),
        dx = x - CX,
        dy = y - CY,
        d = dx + 0.5 * dy;
      if (g <= 1) {
        const streak = g < 0.72 && dy < 0 && (dx + dy === -8 || dx + dy === -9 || dx + dy === -4);
        if (k === 0) set(x, y, g > 0.8 ? 9 : streak ? 7 : d < -5 ? 5 : d > 4 ? 6 : 4);
        else if (k === 1) set(x, y, g > 0.8 ? 9 : streak ? 7 : 12);
        else if (k >= 8 && k < 14) {
          const c = -12 + (24 * (k - 8)) / (GLINTS - 1);
          if (Math.abs(d - c) < 1) set(x, y, 7);
          else if (Math.abs(d - c) < 2.2) set(x, y, 5);
        } else if (k === 14) set(x, y, g > 0.8 ? 5 : 7);
        continue;
      }
      if (k) continue;
      const f = (dx * dx) / 72 + (dy * dy) / 210;
      if (f <= 1) set(x, y, f > 0.8 ? 1 : dx + 0.6 * dy < -5 ? 3 : dx + 0.6 * dy > 5 ? 8 : 2);
    }
  if (k >= 2 && k < 8) {
    const j = k - 2,
      ring = (rx, c) =>
        rx > 0 && ellipse(rx, Math.round(rx * 1.9), (x, y) => glassAt(CX + x, CY + y) < 0.82 && set(CX + x, CY + y, c));
    ring(1 + j, 13);
    ring(j, 14);
    ring(j - 3, 13);
    ring(j - 4, 14);
  }
  if (k === 0) {
    // the crest (a small gem between two gold leaves), the post and the foot
    [
      [0, 0, 11],
      [-1, 1, 10],
      [0, 1, 10],
      [1, 1, 11],
      [0, 2, 10],
      [-3, 2, 3],
      [-2, 2, 2],
      [2, 2, 2],
      [3, 2, 8],
      [-3, 1, 1],
      [3, 1, 1],
    ].forEach(([x, y, c]) => set(CX + x, y, c));
    for (let x = -1; x <= 1; x++) set(CX + x, 31, x < 1 ? 2 : 8);
    for (let x = -4; x <= 4; x++) set(CX + x, 32, x < -1 ? 3 : x > 1 ? 8 : 2);
    for (let x = -5; x <= 5; x++) set(CX + x, 33, 1);
  }
  return px;
}
// A quicksilver pool rx px wide (half), flat on the floor.
function poolPixels(rx) {
  const px = new Uint8Array(PW * PH),
    ry = Math.max(1, Math.round(rx / 2)),
    cx = 12,
    cy = 6;
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++) {
      const e = (x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5);
      if (e > 1) continue;
      px[(cy + y) * PW + cx + x] = e > 0.7 && y > 0 ? 18 : e > 0.6 && y < 0 ? 17 : y > 0 ? 16 : 15;
    }
  return px;
}
let AT = null;
const sheet = () =>
  AT ||
  (AT = atlas(MW * 15, MH + 2 * PH, g => {
    for (let k = 0; k < 15; k++) bake(g, cellPixels(k), MW, MH, k * MW, c => PAL[c]);
    [4, 7, 10, 12].forEach((rx, j) => {
      bake(g, poolPixels(rx), PW, PH, j * PW, c => PAL[c], MH);
      bake(g, poolPixels(rx), PW, PH, j * PW, c => NIGHT_POOL[c] || PAL[c], MH + PH);
    });
  }));

// Where an end's mirror stands: beside and behind the feet, toward the way out at the origin and away from the desk
// at the landing (so they step out toward their seat), unless furniture nearer the camera would hide it.
const M = [0, 0],
  DK = [0, 0, 0],
  SPOTS = new Map(),
  SIDES = new WeakMap();
// How much furniture in front of a mirror whose foot is ox, oy px from the feet at tile tx, ty would cover it.
function cover(tx, ty, ox, oy) {
  const mx = tx + (ox / TW + oy / TH) / 2,
    my = ty + (oy / TH - ox / TW) / 2;
  let n = 0;
  for (let i = -1; i <= 3; i++)
    for (let j = -1; j <= 3; j++) {
      const bx = Math.floor(mx) + i,
        by = Math.floor(my) + j,
        dz = bx + by + 1 - mx - my,
        dx = (bx - by - mx + my) * TW;
      if (!BLOCK.has(bx + ',' + by)) continue;
      if (dz > 0.3 && dz < 4.5 && Math.abs(dx) < 22) n++;
      else if (!i && !j) n += 3; // standing in the furniture itself
    }
  return n;
}
// [side, back] for the feet at tile tx, ty, preferring side pref: the first of four spots with the least cover.
let blockN = -1;
function spotOf(tx, ty, pref) {
  // The Christmas tree adds or frees two BLOCK cells (EventLogic.block).
  if (BLOCK.size !== blockN) {
    SPOTS.clear();
    blockN = BLOCK.size;
  }
  const key = tx + ',' + ty + ',' + pref;
  let v = SPOTS.get(key);
  if (!v) {
    let best = 1e9;
    for (const c of [
      [pref, BACK],
      [-pref, BACK],
      [pref, BACK2],
      [-pref, BACK2],
    ]) {
      const n = cover(tx, ty, SIDE * c[0], -c[1]);
      if (n < best) (best = n), (v = c);
    }
    if (SPOTS.size > 512) SPOTS.clear();
    SPOTS.set(key, v);
  }
  return v;
}
// Each end's side, kept per agent while that end stands: a re-aim may turn the travel or change the desk, never
// move a mirror that is up.
function sideOf(X, end) {
  const fx = end ? X.x1 : X.x0,
    fy = end ? X.y1 : X.y0;
  let o = SIDES.get(X.a);
  if (!o) SIDES.set(X.a, (o = [NaN, NaN, 0, NaN, NaN, 0]));
  const k = 3 * end;
  if (o[k] !== fx || o[k + 1] !== fy) {
    o[k] = fx;
    o[k + 1] = fy;
    o[k + 2] = end ? (X.desk(DK)[0] >= fx ? -1 : 1) : X.dir0[0] >= 0 ? 1 : -1;
  }
  return o[k + 2];
}
function foot(X, end) {
  const pref = sideOf(X, end),
    [s, b] = spotOf(end ? X.tx1 : X.tx0, end ? X.ty1 : X.ty0, pref);
  M[0] = (end ? X.x1 : X.x0) + SIDE * s;
  M[1] = (end ? X.y1 : X.y0) - b;
  return M;
}
// The core-clock shape of each end: how far the mirror is up, how open its pool is.
const riseOf = (v, end) =>
  end ? out2(r(v, 0.4, 0.52)) * (1 - in2(r(v, 0.95, 1.15))) : out2(r(v, 0.03, 0.15)) * (1 - in2(r(v, 0.4, 0.5)));
const poolOf = (v, end) => (end ? r(v, 0.3, 0.38) * (1 - r(v, 1.12, 1.24)) : r(v, 0, 0.06) * (1 - r(v, 0.48, 0.56)));

// The glass's own beats: ripple, flash and glint windows on the core clock per end.
function glass(X, mx, my, end, alpha) {
  const v = X.L.v,
    rp = end ? r(v, 0.54, 0.7) : r(v, 0.29, 0.42),
    fl = end ? (v >= 0.63 && v < 0.7 ? 1 - r(v, 0.63, 0.7) : 0) : v >= 0.3 && v < 0.36 ? 1 - r(v, 0.3, 0.36) : 0,
    gl = end ? r(v, 0.8, 0.9) : r(v, 0.1, 0.2),
    at = sheet(),
    x = mx - CX,
    y = my - MH + 1,
    ctx = X.ctx;
  if (fl > 0) {
    ctx.globalAlpha = alpha * fl;
    X.stamp(at, 14 * MW, 0, MW, MH, x, y, MW, MH);
  }
  if (rp > 0 && rp < 1) {
    ctx.globalAlpha = alpha * (1 - rp * rp);
    X.stamp(at, (2 + Math.min(RIPPLES - 1, Math.floor(rp * RIPPLES))) * MW, 0, MW, MH, x, y, MW, MH);
  }
  if (gl > 0 && gl < 1) {
    ctx.globalAlpha = alpha * 0.85;
    X.stamp(at, (8 + Math.min(GLINTS - 1, Math.floor(gl * GLINTS))) * MW, 0, MW, MH, x, y, MW, MH);
  }
  ctx.globalAlpha = 1;
}
// Four-point twinkles round the frame, each in its own window of w on the core clock from v0.
function sparkles(X, mx, my, v0, w, n, alpha) {
  const ctx = X.ctx,
    v = X.L.v;
  for (let j = 0; j < n; j++) {
    const p = r(v, v0 + 0.03 * j, v0 + 0.03 * j + w);
    if (p <= 0 || p >= 1) continue;
    const a = 2 * Math.PI * (X.hash(j, v0 * 100) + j / n),
      x = Math.round(mx + 11 * Math.cos(a)),
      y = Math.round(my - CY - 1 + 17 * Math.sin(a) - 3 * p),
      big = p > 0.25 && p < 0.6;
    ctx.globalAlpha = alpha * (1 - p * p);
    ctx.fillStyle = SPARK[j % SPARK.length];
    ctx.fillRect(x - (big ? 2 : 1), y, big ? 5 : 3, 1);
    ctx.fillRect(x, y - (big ? 2 : 1), 1, big ? 5 : 3);
  }
  ctx.globalAlpha = 1;
}

// Quicksilver drops thrown off the pool while a mirror rises out of it or sinks back in.
function drops(X, mx, my, v0, v1, alpha) {
  const p = r(X.L.v, v0, v1),
    ctx = X.ctx;
  if (p <= 0 || p >= 1) return;
  ctx.globalAlpha = alpha * (1 - p * p);
  for (let j = 0; j < 6; j++) {
    const a = 2 * Math.PI * ((j + X.hash(j, 7)) / 6),
      d = 5 + 9 * p * (0.7 + 0.3 * X.hash(j, 8));
    ctx.fillStyle = j % 2 ? '#eaf8ff' : '#8ec3e6';
    ctx.fillRect(Math.round(mx + d * Math.cos(a)), Math.round(my + 0.5 * d * Math.sin(a) - 28 * p * (1 - p)), 1, 2);
  }
  ctx.globalAlpha = 1;
}
// The person's beat at core clock v: the mode and its progress q; null leaves drawPerson to draw them as usual.
const B = { mode: '', q: 0, refl: false };
const set = (mode, q, refl) => ((B.mode = mode), (B.q = q), (B.refl = refl), B);
function beatAt(v, sw, stool, hide) {
  if (!sw) {
    if (hide) return set('gone', 0, false);
    if (v < 0.1) return null;
    // a stool sitter turns round on the stool, then hops off into the glass
    if (v < 0.2) return set(stool ? 'perch' : 'face', 0, v >= 0.12);
    if (v < 0.3) return set('in', ease(r(v, 0.2, 0.3)), true);
    if (v < 0.4) return set('inside', r(v, 0.3, 0.4), false);
    return set('gone', 0, false);
  }
  if (v < 0.56) return set('gone', 0, false);
  if (v < 0.66) return set('inside', 1 - r(v, 0.56, 0.66), false);
  if (v < 0.78) return set('out', ease(r(v, 0.66, 0.78)), true);
  if (v < 0.86) return set('stand', r(v, 0.78, 0.86), true);
  return null;
}
const beat = ({ L, tp }) => (L.q || L.v >= 0.92 || (tp.sw && L.cut) ? null : beatAt(L.v, tp.sw, tp.stool, L.hide));
// The walker's own shadow, which a moved body pass leaves out.
function feetShadow(X, x, y) {
  const th = X.G.th;
  if (!th || !th.shadow) return;
  X.ctx.fillStyle = th.shadow;
  X.ctx.beginPath();
  X.ctx.ellipse(x, y, 6, 3, 0, 0, 2 * Math.PI);
  X.ctx.fill();
}
// Clips to the glass of the mirror whose foot is at mx, my (save without restore: the caller restores).
function clipGlass(ctx, mx, my) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(mx + 0.5, my - MH + 1 + CY + 0.5, GRX, GRY, 0, 0, 2 * Math.PI);
  ctx.clip();
}
const veil = (X, mx, my, alpha) => {
  X.ctx.globalAlpha = alpha;
  X.stamp(sheet(), MW, 0, MW, MH, mx - CX, my - MH + 1, MW, MH);
  X.ctx.globalAlpha = 1;
};
// The reflection: the person seen from the other side, mirrored, standing in the glass a step deeper the nearer
// they are (an extra body pass, so never in a crowd).
function reflection(X, mx, my, end, q, fade) {
  const ctx = X.ctx,
    k = end ? 1 - 0.15 * q : 0.8 + 0.2 * q,
    toward = end ? 0 : Math.round(3 * (1 - q)) * Math.sign((end ? X.x1 : X.x0) - mx);
  clipGlass(ctx, mx, my);
  try {
    X.bodyAt(mx + toward, my - 4 - (end ? Math.round(2 * q) : Math.round(2 * (1 - q))), {
      pose: end && q === 1 ? 'stand' : 'walk',
      front: !end,
      mirror: true,
      sx: k,
      sy: k,
      alpha: 0.55 * (end ? 1 - 0.4 * q : 1) * (1 - fade),
    });
    veil(X, mx, my, 0.7);
  } finally {
    ctx.restore();
  }
}

export const STYLE = {
  need(X) {
    const L = X.L,
      v = L.v;
    if (L.q) return 4;
    return (
      (v < 0.56 ? 4 : 0) |
      (v >= 0.03 && v < 0.5 ? 1 : 0) |
      (v >= 0.3 && v < 1.3 ? 8 : 0) |
      (v >= 0.4 && v < 1.15 ? 2 : 0)
    );
  },
  floor(X, end) {
    const L = X.L,
      p = L.q ? 0.4 : poolOf(L.v, end),
      [mx, my] = foot(X, end);
    if (p <= 0) return;
    // queued: a small pool near opaque, as a faint one takes the grass colour and stops reading as metal
    X.ctx.globalAlpha = L.C * (L.q ? 0.85 : Math.min(1, 3 * p));
    X.stamp(sheet(), Math.min(3, Math.floor(p * 4)) * PW, MH + (X.night ? PH : 0), PW, PH, mx - 12, my - 6, PW, PH);
    X.ctx.globalAlpha = 1;
  },
  back(X, end) {
    const L = X.L,
      v = L.v,
      rise = riseOf(v, end),
      [mx, my] = foot(X, end),
      h = Math.round(MH * rise),
      ctx = X.ctx;
    if (h <= 0) return;
    const glow = Light.glow(X.df);
    if (glow > 0) {
      const sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = L.C * glow * 0.55 * rise;
      ctx.drawImage(glowSprite('#9fdcff', 64), mx - 22, my - h - 6, 45, Math.max(24, h + 12));
      ctx.imageSmoothingEnabled = sm;
    }
    ctx.globalAlpha = L.C;
    X.stamp(sheet(), 0, 0, MW, h, mx - CX, my - h + 1, MW, h);
    ctx.globalAlpha = 1;
    if (h < MH) {
      // a bright seam where the mirror leaves the pool
      ctx.globalAlpha = L.C * 0.9;
      ctx.fillStyle = '#f4fbff';
      ctx.fillRect(mx - 6, my, 13, 1);
      ctx.globalAlpha = 1;
    } else glass(X, mx, my, end, L.C);
    if (X.lite) return;
    if (end) {
      drops(X, mx, my, 0.4, 0.5, L.C);
      drops(X, mx, my, 1.06, 1.16, L.C);
      sparkles(X, mx, my, 0.42, 0.12, 4, L.C);
      sparkles(X, mx, my, 0.64, 0.1, 4, L.C);
      sparkles(X, mx, my, 0.96, 0.14, 3, L.C);
    } else {
      drops(X, mx, my, 0.03, 0.13, L.C);
      drops(X, mx, my, 0.42, 0.5, L.C);
      sparkles(X, mx, my, 0.05, 0.12, 4, L.C);
      sparkles(X, mx, my, 0.36, 0.1, 3, L.C);
    }
  },
  person(X) {
    const b = beat(X);
    if (!b) return false;
    if (b.mode === 'gone') return true;
    const end = X.tp.sw ? 1 : 0,
      [mx, my] = foot(X, end),
      fx = end ? X.x1 : X.x0,
      fy = end ? X.y1 : X.y0;
    const stand = b.mode === 'stand';
    if (b.refl && !X.lite) reflection(X, mx, my, end, stand ? 1 : b.q, stand ? b.q : 0);
    if (b.mode === 'face' || b.mode === 'perch' || stand) {
      const pose = b.mode === 'perch' ? (X.tp.stool === 2 ? 'sitHigh' : 'sit') : 'stand';
      X.body(stand ? { bare: false } : { pose, front: false });
      return true;
    }
    if (b.mode === 'in' || b.mode === 'out') {
      const q = b.q,
        x = Math.round(end ? lerp(mx, fx, q) : lerp(fx, mx, q)),
        y = Math.round(end ? lerp(my - 1, fy, q) : lerp(fy, my - 1, q)),
        hop = end || !X.tp.stool ? 0 : Math.round((X.tp.stool === 2 ? 9 : 4) * (1 - r(q, 0, 0.4)));
      feetShadow(X, x, y);
      X.bodyAt(x, y - hop, { pose: 'walk', front: !!end });
      // the glass's surface over whoever is half through it
      const through = end ? 1 - r(q, 0, 0.45) : r(q, 0.55, 1);
      if (through > 0) {
        clipGlass(X.ctx, mx, my);
        veil(X, mx, my, 0.65 * through);
        X.ctx.restore();
      }
      return true;
    }
    // inside the glass: smaller and paler the deeper they are, under the glass's veil
    const ctx = X.ctx,
      q = b.q,
      k = 1 - 0.45 * q;
    clipGlass(ctx, mx, my);
    try {
      X.bodyAt(mx, my - 4 - Math.round(3 * q), { pose: 'walk', front: !!end, sx: k, sy: k, alpha: 1 - q });
      veil(X, mx, my, 0.4 + 0.5 * q);
    } finally {
      ctx.restore();
    }
    return true;
  },
  marks: [],
  gap: null,
};
// Pure parts, for tests.
export const MIRROR = { beatAt, cover, spotOf, riseOf, poolOf, BACK, BACK2, SIDE };
