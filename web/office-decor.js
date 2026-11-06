// Office Decor — detailed furniture rendering from design system

const FONT = {
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110101101101101',
  O: '010101101101010',
  P: '110101110100100',
  Q: '010101101110011',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '110001010100111',
  '3': '110001010001110',
  '4': '101101111001001',
  '5': '111100110001110',
  '6': '011100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001110',
  '%': '101001010100101',
  ':': '000010000010000',
  '-': '000000111000000',
  '!': '010010010000010',
  '/': '001001010100100',
  '.': '000000000000010',
};
function text3(g, str, x, y, col) {
  g.fillStyle = col;
  x = Math.round(x);
  y = Math.round(y);
  [...String(str).toUpperCase()].forEach((ch, i) => {
    const f = FONT[ch];
    if (!f) return;
    const gx = x + i * 4;
    for (let b = 0; b < 15; b++)
      if (f[b] === '1') {
        if (g.__wall) g.glyph(gx + 1, gx + (b % 3), y + Math.floor(b / 3), 1, 1);
        else g.fillRect(gx + (b % 3), y + Math.floor(b / 3), 1, 1);
      }
  });
}
const textW = s => String(s).length * 4 - 1;
const shade = (h, p) => {
  if (!h || h[0] !== '#' || h.length !== 7) return h;
  const n = parseInt(h.slice(1), 16),
    c = v => Math.max(0, Math.min(255, v));
  return (
    '#' +
    ((1 << 24) + (c((n >> 16) + p) << 16) + (c(((n >> 8) & 255) + p) << 8) + c((n & 255) + p)).toString(16).slice(1)
  );
};
const mix = (a, b, p) => {
  const A = parseInt(a.slice(1), 16),
    B = parseInt(b.slice(1), 16),
    f = s => Math.round(((A >> s) & 255) * (1 - p) + ((B >> s) & 255) * p);
  return '#' + ((1 << 24) + (f(16) << 16) + (f(8) << 8) + f(0)).toString(16).slice(1);
};
const pool = {};
function surf(key, w, h) {
  let s = pool[key];
  if (!s || s.c.width !== w || s.c.height !== h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    s = { c, g: c.getContext('2d') };
    pool[key] = s;
  }
  s.g.setTransform(1, 0, 0, 1, 0, 0);
  s.g.clearRect(0, 0, w, h);
  s.g.imageSmoothingEnabled = false;
  return s;
}
const dyOf = (c, dir) => (dir === 'left' ? -1 : 1) * Math.floor(c / 2);
const al = x => Math.round(x);
function wallPen(ctx, X0, Y0, dir) {
  X0 = Math.round(X0);
  Y0 = Math.round(Y0);
  return {
    __wall: true,
    fillStyle: '#000',
    fillRect(x, y, w, h) {
      ctx.fillStyle = this.fillStyle;
      x = Math.round(x);
      y = Math.round(y);
      for (let c = 0; c < w; c++) ctx.fillRect(X0 + x + c, Y0 + y + dyOf(x + c, dir), 1, h);
    },
    glyph(ax, x, y, w, h) {
      ctx.fillStyle = this.fillStyle;
      ctx.fillRect(X0 + x, Y0 + y + dyOf(ax, dir), w, h);
    },
    clearRect() {},
    setTransform() {},
  };
}
function skewRect(ctx, X0, Y0, w, h, dir, col) {
  ctx.fillStyle = col;
  X0 = Math.round(X0);
  Y0 = Math.round(Y0);
  for (let c = 0; c < w; c++) ctx.fillRect(X0 + c, Y0 + dyOf(c, dir), 1, h);
}
function mount(ctx, draw, w, h, X0, Y0, dir, edge, glow) {
  const dx = dir === 'left' ? 2 : -2;
  if (glow) skewRect(ctx, X0 - 4, Y0 - 4, w + 10, h + 9, dir, glow);
  skewRect(ctx, X0 + dx * 0.5 + 1, Y0 + 4, w, h, dir, 'rgba(0,0,0,0.22)');
  skewRect(ctx, X0, Y0, w, h, dir, edge);
  draw(wallPen(ctx, X0 + dx, Y0 + 1, dir));
}
function kit(ctx, ox, oy) {
  const P = (x, y, z = 0) => [ox + (x - y) * 16, oy + (x + y) * 8 - z];
  const poly = (pts, fill, st) => {
    ctx.beginPath();
    pts.forEach((p, i) =>
      i ? ctx.lineTo(Math.round(p[0]), Math.round(p[1])) : ctx.moveTo(Math.round(p[0]), Math.round(p[1])),
    );
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (st) {
      ctx.strokeStyle = st;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };
  const box = (x, y, w, h, z0, z1, top, l, r) => {
    poly([P(x, y + h, z0), P(x + w, y + h, z0), P(x + w, y + h, z1), P(x, y + h, z1)], l || shade(top, -22));
    poly([P(x + w, y, z0), P(x + w, y + h, z0), P(x + w, y + h, z1), P(x + w, y, z1)], r || shade(top, -38));
    poly([P(x, y, z1), P(x + w, y, z1), P(x + w, y + h, z1), P(x, y + h, z1)], top);
  };
  const rect = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const faceL = (x0, x1, y, z0, z1, c) => poly([P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)], c);
  const faceR = (x, y0, y1, z0, z1, c) => poly([P(x, y0, z0), P(x, y1, z0), P(x, y1, z1), P(x, y0, z1)], c);
  const line = (a, b, c, w = 1) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(Math.round(a[0]) + 0.5, Math.round(a[1]) + 0.5);
    ctx.lineTo(Math.round(b[0]) + 0.5, Math.round(b[1]) + 0.5);
    ctx.stroke();
  };
  const ell = (sx, sy, rx, ry, c) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(Math.round(sx), Math.round(sy), rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const cyl = (x, y, z0, z1, r, top, side) => {
    const [px, py] = P(x, y, z0),
      rx = r * 22.6,
      ry = rx / 2,
      h = z1 - z0;
    side = side || shade(top, -25);
    ell(px, py, rx, ry, side);
    rect(px - rx, py - h, rx * 2, h, side);
    rect(px + rx * 0.25, py - h, rx * 0.75, h, shade(side, -15));
    ell(px, py - h, rx, ry, top);
  };
  const blob = (cx, cy, r, c) => {
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.round(Math.sqrt(r * r - dy * dy)) * 2;
      rect(cx - w / 2, cy + dy, w, 1, c);
    }
  };
  const alpha = (a, fn) => {
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = a;
    fn();
    ctx.globalAlpha = prev;
  };
  return { ctx, P, poly, box, rect, faceL, faceR, line, ell, cyl, blob, alpha };
}
const UCOL = p => (p >= 0.85 ? '#ff5a5f' : p >= 0.6 ? '#f5b83d' : '#3fd07a');
const UCOL2 = p => (p >= 0.85 ? '#e5484d' : p >= 0.6 ? '#f29e0b' : '#2fae6a');
function fmtReset(min) {
  min = Math.max(0, Math.round(min));
  if (min >= 1440) {
    const d = Math.floor(min / 1440),
      h = Math.floor((min % 1440) / 60);
    return d + 'D' + String(h).padStart(2, '0');
  }
  const h = Math.floor(min / 60),
    m = min % 60;
  return h + 'H' + String(m).padStart(2, '0');
}
const BW = 78,
  BH = 48;
function boardLED(g, o, t) {
  const W = BW,
    H = BH;
  g.fillStyle = '#14171f';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#262c3b';
  g.fillRect(1, 1, W - 2, 1);
  g.fillStyle = '#0d0f15';
  g.fillRect(1, H - 2, W - 2, 1);
  g.fillStyle = '#0a101c';
  g.fillRect(3, 3, W - 6, H - 6);
  for (let y = 4; y < H - 3; y += 2) {
    g.fillStyle = 'rgba(255,255,255,0.02)';
    g.fillRect(3, y, W - 6, 1);
  }
  text3(g, 'USAGE', 4, 6, '#8b93a7');
  const worst = Math.max(o.h5 || 0, o.d7 || 0),
    off = worst >= 1 && Math.floor(t * 3) % 2;
  g.fillStyle = off ? '#3a1416' : UCOL(worst);
  g.fillRect(W - 9, 6, 3, 3);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(W - 9, 6, 1, 1);
  g.fillStyle = '#1c2535';
  g.fillRect(5, 13, W - 10, 1);
  [
    ['5H', o.h5, o.r5, 300],
    ['7D', o.d7, o.r7, 10080],
  ].forEach(([lab, p, rm, win], i) => {
    const y = 17 + i * 14,
      N = 13,
      bx = 16,
      bw = N * 3 - 1,
      unk = p == null,
      col = UCOL(unk ? 0 : p);
    text3(g, lab, 4, y, '#e6e9ef');
    if (unk) {
      for (let k = 0; k < N; k++) {
        g.fillStyle = '#18202e';
        g.fillRect(bx + k * 3, y, 2, 5);
      }
      text3(g, '--', W - 19, y, '#5d6a86');
      g.fillStyle = '#141b28';
      g.fillRect(bx, y + 8, bw, 1);
      return;
    }
    if (p >= 1) {
      const on = Math.floor(t * 2.5) % 2;
      g.fillStyle = on ? '#ff5a5f' : '#4a1518';
      g.fillRect(bx, y, bw, 5);
      text3(g, 'LIMIT', bx + ((bw - 19) >> 1), y, on ? '#ffffff' : '#ff8a8d');
    } else {
      const lit = Math.min(N, Math.round(p * N));
      for (let k = 0; k < N; k++) {
        const on = k < lit;
        let c = on ? col : '#18202e';
        if (on && p >= 0.9 && k === lit - 1 && Math.floor(t * 4) % 2) c = '#3a1416';
        g.fillStyle = c;
        g.fillRect(bx + k * 3, y, 2, 5);
        if (on && c !== '#3a1416') {
          g.fillStyle = mix(col, '#ffffff', 0.45);
          g.fillRect(bx + k * 3, y, 2, 1);
        }
      }
    }
    const pt = Math.min(100, Math.round(p * 100)) + '%';
    text3(g, pt, W - 19, y, p >= 0.85 ? '#ff8a8d' : '#e6e9ef');
    const el = Math.max(0, Math.min(1, 1 - rm / win));
    g.fillStyle = '#141b28';
    g.fillRect(bx, y + 8, bw, 1);
    g.fillStyle = '#3d4a66';
    g.fillRect(bx, y + 8, Math.round(bw * el), 1);
    const rs = fmtReset(rm);
    text3(g, rs, W - 19, y + 7, '#5d6a86');
  });
}
function boardWhite(g, o, t) {
  const W = BW,
    H = BH,
    B = H - 4;
  g.fillStyle = '#8f9ab0';
  g.fillRect(0, 0, W, B);
  g.fillStyle = '#d6dce6';
  g.fillRect(1, 1, W - 2, B - 2);
  g.fillStyle = '#f6f7f9';
  g.fillRect(3, 3, W - 6, B - 6);
  g.fillStyle = '#eceef3';
  [
    [40, 8, 10, 2],
    [30, 38, 9, 1],
  ].forEach(r => g.fillRect(...r));
  text3(g, 'USAGE', 4, 6, '#2d3142');
  g.fillStyle = '#2d3142';
  for (let x = 4; x < 23; x++) g.fillRect(x, 12 + ((x >> 2) % 2), 1, 1);
  g.fillStyle = '#ffd166';
  g.fillRect(W - 19, 4, 13, 10);
  g.fillStyle = '#e9b949';
  g.fillRect(W - 19, 13, 13, 1);
  g.fillStyle = '#c9a227';
  [7, 9, 11].forEach(y => g.fillRect(W - 17, y, 8 + (y % 3), 1));
  g.fillStyle = '#e5484d';
  g.fillRect(W - 13, 4, 2, 2);
  [
    ['5H', o.h5, o.r5],
    ['7D', o.d7, o.r7],
  ].forEach(([lab, p, rm], i) => {
    const y = 16 + i * 12,
      bx = 16,
      bw = 34,
      col = UCOL2(p),
      fw = Math.round(bw * Math.min(1, p));
    text3(g, lab, 4, y, '#2f5bff');
    g.fillStyle = mix(col, '#ffffff', 0.6);
    g.fillRect(bx + 1, y, fw, 5);
    for (let xx = 0; xx < fw; xx++)
      for (let yy = 0; yy < 5; yy++)
        if ((xx + yy) % 3 === 0) {
          g.fillStyle = col;
          g.fillRect(bx + 1 + xx, y + yy, 1, 1);
        }
    g.fillStyle = '#2d3142';
    g.fillRect(bx, y - 1, bw + 2, 1);
    g.fillRect(bx, y + 5, bw + 2, 1);
    g.fillRect(bx, y - 1, 1, 7);
    g.fillRect(bx + bw + 1, y - 1, 1, 7);
    const pt = Math.min(100, Math.round(p * 100)) + '%',
      px = 56;
    text3(g, pt, px, y, p >= 1 ? '#e5484d' : '#2d3142');
    text3(g, fmtReset(rm), 56, y + 6, '#9aa6bd');
  });
  g.fillStyle = '#b9c0cc';
  g.fillRect(4, B, W - 8, 2);
  g.fillStyle = '#8b93a7';
  g.fillRect(4, B + 2, W - 8, 1);
  [
    ['#2f5bff', 10],
    ['#e5484d', 17],
    ['#2d3142', 24],
  ].forEach(([c, x]) => {
    g.fillStyle = c;
    g.fillRect(x, B, 5, 2);
    g.fillStyle = '#f6f7f9';
    g.fillRect(x + 4, B, 1, 2);
  });
  g.fillStyle = '#3d4970';
  g.fillRect(W - 28, B, 8, 2);
  g.fillStyle = '#c9cfdc';
  g.fillRect(W - 28, B + 1, 8, 1);
}
function boardGauge(g, o, t) {
  const W = BW,
    H = BH;
  g.fillStyle = '#4a2e1b';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#7a4f2f';
  g.fillRect(1, 1, W - 2, H - 2);
  g.fillStyle = '#6b4428';
  [
    [3, 9, 30],
    [40, 15, 34],
    [6, 41, 26],
    [44, 44, 28],
  ].forEach(([x, y, w]) => g.fillRect(x, y, w, 1));
  g.fillStyle = '#c9a77a';
  [
    [3, 3],
    [W - 4, 3],
    [3, H - 4],
    [W - 4, H - 4],
  ].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  text3(g, 'USAGE', al((W - 19) / 2), 4, '#f2ead9');
  const worst = Math.max(o.h5, o.d7);
  if (worst >= 1) {
    g.fillStyle = Math.floor(t * 3) % 2 ? '#ff5a5f' : '#5a1a1d';
    g.fillRect(W - 12, 4, 4, 4);
    g.fillStyle = '#ffffff';
    g.fillRect(W - 12, 4, 1, 1);
  }
  [
    ['5H', o.h5, o.r5],
    ['7D', o.d7, o.r7],
  ].forEach(([lab, p, rm], i) => {
    const cx = 20 + i * 38,
      cy = 27,
      R = 14;
    for (let y = cy - R - 1; y <= cy + 2; y++)
      for (let x = cx - R - 1; x <= cx + R + 1; x++) {
        const dx = x - cx + 0.5,
          dy = y - cy + 0.5,
          d = Math.hypot(dx, dy);
        if (d > R + 1.2 || dy > 2.5) continue;
        let c = d > R ? '#2d1c10' : '#f2ead9';
        if (d <= R - 0.5 && d >= R - 3.5 && dy < 0) {
          const f = (Math.atan2(dy, dx) + Math.PI) / Math.PI;
          c = f < 0.6 ? '#3fae6a' : f < 0.85 ? '#f2b134' : '#e5484d';
        }
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
      }
    for (let k = 0; k <= 10; k++) {
      const a = -Math.PI + (k * Math.PI) / 10;
      g.fillStyle = '#5c4a3a';
      g.fillRect(Math.round(cx + Math.cos(a) * (R - 5.5)), Math.round(cy + Math.sin(a) * (R - 5.5)), 1, 1);
    }
    const pp = Math.min(1.02, p) + (p >= 0.9 ? Math.sin(t * 28 + i) * 0.012 : 0),
      a = -Math.PI + pp * Math.PI;
    for (let s = 0; s < R - 3; s += 0.5) {
      g.fillStyle = '#2d3142';
      g.fillRect(Math.round(cx + Math.cos(a) * s), Math.round(cy + Math.sin(a) * s), 1, 1);
    }
    g.fillStyle = '#e5484d';
    g.fillRect(cx - 1, cy - 1, 3, 3);
    g.fillStyle = '#ff9a9a';
    g.fillRect(cx - 1, cy - 1, 1, 1);
    text3(g, lab, al(cx - R), cy + 5, '#f2ead9');
    const pt = Math.min(100, Math.round(p * 100)) + '%';
    text3(g, pt, al(cx + R - textW(pt) + 1), cy + 5, p >= 0.85 ? '#ffb3b3' : '#f2ead9');
    text3(g, fmtReset(rm), al(cx - R), cy + 12, '#c9a77a');
  });
}
const BOARDS = {
  led: { fn: boardLED, edge: '#07080c', glow: 'rgba(94,242,255,0.05)' },
  whiteboard: { fn: boardWhite, edge: '#6b768c' },
  gauge: { fn: boardGauge, edge: '#2d1c10' },
};
function boardSurface(variant, o, t) {
  const B = BOARDS[variant] || BOARDS.led,
    s = surf('ub-' + variant + (o.night ? 'n' : 'd'), BW, BH);
  B.fn(s.g, o, t);
  return s.c;
}
function drawUsageBoard(ctx, X0, Y0, o, t, dir) {
  const B = BOARDS[o.variant] || BOARDS.led;
  mount(ctx, g => B.fn(g, o, t), BW, BH, X0, Y0, dir || 'left', B.edge, o.night ? B.glow : null);
}
const F = {};
function SCREEN(K, t, mode) {
  const f = (x0, x1, z0, z1, c) => K.faceL(x0, x1, 0.22, z0, z1, c);
  const bg =
    {
      code: '#0d2233',
      read: '#e9eef6',
      term: '#06120b',
      think: '#0d2233',
      perm: '#0d2233',
      error: '#3a0f12',
      done: '#0f2a1a',
      off: '#08090d',
    }[mode] || '#0d2233';
  f(0.57, 1.43, 17.2, 30, bg);
  const ph = Math.floor(t * 4);
  const code = dim => {
    for (let k = 0; k < 5; k++) {
      const ind = ((ph + k) % 3) * 0.06,
        w = 0.14 + ((ph * 3 + k * 5) % 5) * 0.07;
      f(
        0.62 + ind,
        0.62 + ind + w,
        27.6 - k * 2.2,
        28.4 - k * 2.2,
        dim ? '#2a3a55' : ['#ff79c6', '#8be9fd', '#f1fa8c', '#50fa7b', '#bd93f9'][(k + ph) % 5],
      );
    }
  };
  if (mode === 'code') {
    code();
    if (Math.floor(t * 2) % 2) f(1.2, 1.25, 18.5, 20, '#e6e9ef');
  } else if (mode === 'read') {
    const sc = Math.floor(t * 1.5) % 3;
    for (let k = 0; k < 6; k++) {
      const w = [0.6, 0.45, 0.66, 0.3, 0.55, 0.4][(k + sc) % 6];
      f(0.62, 0.62 + w, 28.2 - k * 1.8, 28.8 - k * 1.8, k === 2 ? '#f5b83d' : '#8b93a7');
    }
    f(1.36, 1.4, 18, 29, '#c9d3e3');
    f(1.36, 1.4, 27 - sc * 2.5, 29 - sc * 2.5, '#5d6578');
  } else if (mode === 'term') {
    const sc = Math.floor(t * 3) % 4;
    for (let k = 0; k < 4; k++) {
      const w = [0.35, 0.55, 0.25, 0.45][(k + sc) % 4];
      f(0.62, 0.62 + w, 28.2 - k * 2, 28.8 - k * 2, '#50fa7b');
    }
    f(0.62, 0.68, 19.6, 20.6, '#ffd166');
    if (Math.floor(t * 2) % 2) f(0.72, 0.77, 19.6, 20.6, '#e6e9ef');
  } else if (mode === 'think') {
    code(true);
    for (let k = 0; k < 3; k++)
      f(0.88 + k * 0.1, 0.94 + k * 0.1, 22.6, 23.8, k === Math.floor(t * 3) % 3 ? '#ffffff' : '#3a4a66');
  } else if (mode === 'perm') {
    code(true);
    const b = Math.floor(t * 3) % 2;
    f(0.7, 1.3, 19.4, 27.4, b ? '#f5a524' : '#c98510');
    f(0.74, 1.26, 20, 26.8, '#1a1405');
    f(0.97, 1.03, 23.4, 26, '#f5a524');
    f(0.97, 1.03, 22.2, 23, '#f5a524');
    f(0.78, 0.96, 20.4, 21.4, '#46a758');
    f(1.04, 1.22, 20.4, 21.4, '#5d6578');
  } else if (mode === 'error') {
    for (let k = 0; k < 5; k++) {
      f(0.86 + k * 0.06, 0.92 + k * 0.06, 26.4 - k * 1.6, 27.6 - k * 1.6, '#ffffff');
      f(1.1 - k * 0.06, 1.16 - k * 0.06, 26.4 - k * 1.6, 27.6 - k * 1.6, '#ffffff');
    }
    if (Math.floor(t * 4) % 2) f(0.57, 1.43, 29.2, 30, '#ff5a5f');
  } else if (mode === 'done') {
    [
      [0.8, 22.6],
      [0.86, 21.2],
      [0.92, 19.8],
      [0.98, 21.2],
      [1.04, 22.6],
      [1.1, 24],
      [1.16, 25.4],
      [1.22, 26.8],
    ].forEach(([x, z]) => f(x, x + 0.07, z, z + 1.4, '#ffffff'));
  } else if (mode === 'off') {
    f(1.34, 1.38, 18, 18.8, Math.floor(t) % 2 ? '#e5484d' : '#3a1416');
  }
}
F.desk = (K, t, o) => {
  o = o || {};
  const { box, poly, rect, P, faceL, line, cyl, alpha } = K,
    wood = '#c79a6b',
    woodD = '#9c7148',
    metal = '#2d3142';
  box(0.06, 0.1, 0.07, 0.72, 0, 10, woodD);
  box(1.3, 0.1, 0.62, 0.72, 0, 10, '#d9cbb5', '#c4b39a', '#a8987f');
  [3.6, 7].forEach(z => faceL(1.32, 1.9, 0.82, z, z + 0.7, '#9c8d76'));
  [1.6, 5.2, 8.5].forEach(z => faceL(1.55, 1.68, 0.82, z, z + 0.9, '#5c5248'));
  box(0, 0.06, 2, 0.82, 10, 12, wood, woodD, '#86603c');
  [0.32, 0.6].forEach(y => line(P(0.12, y, 12), P(1.88, y, 12), '#b88a5c'));
  box(0.18, 0.18, 0.32, 0.38, 12, 12.6, '#f0ede6');
  box(0.22, 0.15, 0.32, 0.38, 12.6, 13.2, '#ffffff');
  [0.24, 0.31, 0.38].forEach(y => line(P(0.27, y, 13.2), P(0.47, y, 13.2), '#c9d3e3'));
  const SG = {
    code: '#5ef2ff',
    read: '#ffffff',
    term: '#50fa7b',
    think: '#5b8def',
    perm: '#f5a524',
    error: '#ff5a5f',
    done: '#46a758',
  }[o.screen || 'code'];
  if (SG) alpha(0.14, () => poly([P(0.5, 0.24, 12), P(1.5, 0.24, 12), P(1.7, 0.85, 12), P(0.3, 0.85, 12)], SG));
  box(0.86, 0.16, 0.28, 0.18, 12, 12.8, metal);
  box(0.97, 0.2, 0.06, 0.06, 12.8, 17, '#4a5066');
  box(0.52, 0.12, 0.96, 0.1, 16, 31, '#1a1c24', '#23262f', '#14161c');
  SCREEN(K, t, o.screen || 'code');
  box(0.62, 0.48, 0.66, 0.2, 12, 12.8, '#2b2f3c');
  for (let i = 0; i < 8; i++)
    for (let r = 0; r < 2; r++) {
      const [kx, ky] = P(0.67 + i * 0.075, 0.52 + r * 0.07, 12.8);
      rect(kx, ky, 1, 1, (Math.floor(t * 10) + i * 3 + r) % 11 === 0 ? '#ffffff' : '#5d6578');
    }
  box(1.36, 0.46, 0.36, 0.3, 12, 12.3, '#3e4a6b');
  box(1.48, 0.55, 0.09, 0.12, 12.3, 13.4, '#e6e9ef');
  if (!o.noMug) {
    cyl(1.8, 0.26, 12, 16, 0.07, '#c0392b', '#e5484d');
    {
      const [mx, my] = P(1.8, 0.26, 14);
      rect(mx + 2, my - 1, 2, 3, '#c0392b');
    }
    if (o.screen !== 'off')
      for (let k = 0; k < 2; k++) {
        const p = (t * 0.8 + k * 0.5) % 1,
          [sx, sy] = P(1.8, 0.26, 17 + p * 9);
        alpha(0.7 * (1 - p), () => rect(sx + (Math.floor(p * 4) % 2) - 1, sy, 1, 2, '#e6e9ef'));
      }
  }
  box(0.12, 0.62, 0.18, 0.18, 12, 13, metal);
  line(P(0.21, 0.71, 13), P(0.21, 0.55, 25), '#4a5066', 2);
  line(P(0.21, 0.55, 25), P(0.36, 0.42, 27), '#4a5066', 2);
  box(0.3, 0.34, 0.18, 0.14, 24, 27.5, metal);
  if (o.screen !== 'off') {
    alpha(0.2, () => poly([P(0.2, 0.3, 12), P(0.6, 0.3, 12), P(0.7, 0.7, 12), P(0.3, 0.7, 12)], '#ffd166'));
    const [lx, ly] = P(0.39, 0.48, 24);
    rect(lx - 2, ly, 4, 1, '#ffd166');
  }
};
F.chairBase = K => {
  const { box, P, rect, line } = K,
    metal = '#4a5066',
    fab = '#5b6b94';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3,
      ex = 0.5 + Math.cos(a) * 0.36,
      ey = 0.5 + Math.sin(a) * 0.36;
    line(P(0.5, 0.5, 2), P(ex, ey, 1.5), metal, 2);
    const [wx, wy] = P(ex, ey, 0);
    rect(wx - 1, wy - 2, 3, 2, '#14161c');
  }
  box(0.46, 0.46, 0.08, 0.08, 2, 8, '#8b93a7');
  box(0.2, 0.22, 0.6, 0.56, 8, 10, shade(fab, -20));
  box(0.23, 0.25, 0.54, 0.5, 10, 11.5, fab);
  box(0.16, 0.42, 0.05, 0.06, 10, 15, metal);
  box(0.14, 0.3, 0.09, 0.3, 15, 16, '#4a5066');
  box(0.79, 0.42, 0.05, 0.06, 10, 15, metal);
  box(0.77, 0.3, 0.09, 0.3, 15, 16, '#4a5066');
};
F.backrest = K => {
  const { box, faceL } = K,
    metal = '#4a5066';
  box(0.46, 0.7, 0.08, 0.06, 9, 13, metal);
  box(0.24, 0.74, 0.52, 0.08, 12, 27, metal);
  for (let k = 0; k < 6; k++) {
    const x = 0.28 + k * 0.08;
    faceL(x, x + 0.04, 0.82, 13.5, 25.5, '#7a8ab8');
  }
  faceL(0.24, 0.76, 0.82, 16, 17.5, '#e07a5f');
};
F.chair = K => {
  F.chairBase(K);
  F.backrest(K);
};
const BOOKS = [
  [
    [0.08, 8, '#e5484d'],
    [0.06, 9, '#3e8ed0'],
    [0.1, 7, '#f5a524'],
    [0.07, 9, '#46a758'],
    [0.05, 8, '#e8e2d6'],
    [0.09, 8.5, '#8e4ec6'],
    [0.08, 7, '#12a594'],
  ],
  [
    [0.1, 8, '#5b5bd6'],
    [0.07, 9, '#e93d82'],
    [0.06, 7.5, '#ffd166'],
    [0.09, 9, '#2d3142'],
    [0.08, 8, '#ff8b3d'],
    [0.12, 5, '#c9d3e3'],
  ],
  [
    [0.07, 9, '#46a758'],
    [0.07, 8, '#3e8ed0'],
    [0.09, 9, '#e5484d'],
    [0.06, 7, '#e8e2d6'],
    [0.1, 8, '#12a594'],
  ],
];
F.bookshelf = (K, t) => {
  const { box, faceL, cyl, rect, P, blob } = K,
    w = '#8a5a3a',
    D = 0.42;
  box(0, 0, 1.2, 0.05, 0, 46, '#5c3a22');
  box(0, 0, 0.07, D, 0, 46, w, '#a06b45', '#6b4428');
  [0, 11.5, 23].forEach((z, si) => {
    box(0, 0, 1.2, D, z, z + 2, w, '#a06b45', '#6b4428');
    let x = 0.12;
    BOOKS[si].forEach(([bw, bh, c]) => {
      box(x, 0.08, bw, 0.3, z + 2, z + 2 + bh, c);
      faceL(x + 0.01, x + bw - 0.01, 0.38, z + 2 + bh * 0.62, z + 3 + bh * 0.62, shade(c, 45));
      x += bw + 0.012;
    });
  });
  box(0, 0, 1.2, D, 34.5, 36.5, w, '#a06b45', '#6b4428');
  box(0.15, 0.12, 0.3, 0.25, 36.5, 40, '#e8e2d6');
  box(0.18, 0.1, 0.3, 0.25, 40, 42.5, '#3e8ed0');
  cyl(0.85, 0.22, 36.5, 40.5, 0.09, '#f6f4ee', '#d6d1c6');
  {
    const [px, py] = P(0.85, 0.22, 40.5);
    [
      [-4, -4, 3],
      [3, -5, 3],
      [0, -8, 3],
      [-1, -2, 2],
    ].forEach(([dx, dy, r], i) => blob(px + dx, py + dy, r, i % 2 ? '#2e8556' : '#3fa36b'));
  }
  box(0, 0, 1.2, D, 44, 46, w, '#a06b45', '#6b4428');
  box(1.13, 0, 0.07, D, 0, 46, w, '#a06b45', '#6b4428');
  box(0.25, 0.12, 0.12, 0.12, 46, 47.5, '#5c3a22');
  box(0.28, 0.15, 0.06, 0.06, 47.5, 50, '#e0b23a');
  box(0.24, 0.11, 0.14, 0.14, 50, 53.5, '#ffd166', '#e0b23a', '#c9971f');
};
F.coffee = (K, t) => {
  const { box, faceL, P, rect, cyl, line, alpha } = K;
  box(0, 0, 2, 0.8, 0, 12, '#7a5a40', '#6b4e36', '#563e2b');
  [0.05, 1.02].forEach(x => {
    faceL(x, x + 0.93, 0.8, 1.5, 11, '#8a6a4e');
    faceL(x + 0.76, x + 0.82, 0.8, 5, 8.5, '#e6d7bf');
  });
  box(-0.03, -0.03, 2.06, 0.86, 12, 13.5, '#f2efe8', '#d6d1c6', '#bdb7aa');
  box(0.12, 0.1, 0.62, 0.5, 13.5, 26, '#c9d3e3', '#aab4c6', '#8f9ab0');
  box(0.12, 0.1, 0.62, 0.5, 26, 27, '#e3e9f3', '#c9d3e3', '#aab4c6');
  faceL(0.2, 0.66, 0.6, 22, 25, '#2d3142');
  {
    const [ax, ay] = P(0.3, 0.6, 24);
    rect(ax, ay, 1, 1, '#46a758');
    const [bx, by] = P(0.55, 0.6, 24);
    rect(bx, by, 1, 1, Math.floor(t * 2) % 2 ? '#e5484d' : '#5a1a1d');
  }
  box(0.33, 0.58, 0.2, 0.08, 18, 20.5, '#2d3142');
  box(0.24, 0.6, 0.42, 0.18, 13.5, 14.3, '#3b4058');
  cyl(0.43, 0.69, 14.3, 16.8, 0.06, '#ffffff', '#e6e9ef');
  if (Math.floor(t) % 4 < 2) {
    const [sx, sy] = P(0.43, 0.66, 18);
    rect(sx, sy, 1, 3, '#6b3e24');
  }
  [0.25, 0.42, 0.59].forEach(x => cyl(x, 0.3, 27, 29, 0.05, '#ffffff', '#e6e9ef'));
  line(P(0.74, 0.42, 23), P(0.84, 0.5, 16), '#8f9ab0');
  box(0.95, 0.22, 0.26, 0.26, 13.5, 21, '#2d3142');
  alpha(0.85, () => box(0.98, 0.25, 0.2, 0.2, 21, 27, '#a06b45', '#8a5a3a', '#6b4428'));
  box(0.96, 0.23, 0.24, 0.24, 27, 28, '#2d3142');
  [0, 1, 2, 3].forEach(k => cyl(1.42, 0.35, 13.5 + k * 1.6, 15 + k * 1.6, 0.07, '#ffffff', '#e6e9ef'));
  cyl(1.75, 0.4, 13.5, 18.5, 0.08, '#cfe8ff', '#a9d3f5');
  {
    const [jx, jy] = P(1.75, 0.4, 14.5);
    rect(jx - 2, jy - 2, 4, 2, '#6b3e24');
  }
  for (let k = 0; k < 2; k++) {
    const p = (t * 0.7 + k * 0.5) % 1,
      [sx, sy] = P(0.43, 0.69, 18 + p * 10);
    alpha(0.7 * (1 - p), () => rect(sx + (Math.floor(p * 4) % 2), sy, 1, 2, '#e6e9ef'));
  }
};
F.fridge = (K, t) => {
  const { box, faceL, P, rect, line } = K;
  box(0.05, 0.05, 0.75, 0.7, 0, 1.5, '#2d3142');
  box(0, 0, 0.8, 0.75, 1.5, 42, '#eef1f6', '#d6dce6', '#bcc4d2');
  faceL(0, 0.8, 0.75, 27, 27.6, '#9aa6bd');
  box(0.64, 0.75, 0.04, 0.05, 29, 38, '#9aa6bd');
  box(0.64, 0.75, 0.04, 0.05, 15, 24, '#9aa6bd');
  faceL(0.1, 0.34, 0.75, 13, 22, '#ffd166');
  [20, 18, 16].forEach(z => faceL(0.13, 0.3, 0.75, z, z + 0.6, '#c9a227'));
  faceL(0.32, 0.52, 0.75, 31, 37, '#ffffff');
  faceL(0.34, 0.5, 0.75, 32, 36, '#5ec8ff');
  faceL(0.34, 0.5, 0.75, 32, 33.5, '#46a758');
  [
    [0.14, 35, '#e5484d'],
    [0.22, 23, '#3e8ed0'],
    [0.45, 20, '#8e4ec6'],
  ].forEach(([x, z, c]) => faceL(x, x + 0.05, 0.75, z, z + 2, c));
  faceL(0.1, 0.22, 0.75, 39.5, 40.5, '#8b93a7');
};
F.cooler = (K, t) => {
  const { box, faceL, P, rect, cyl, alpha } = K;
  box(0.1, 0.1, 0.5, 0.5, 0, 20, '#eef1f6', '#d6dce6', '#bcc4d2');
  faceL(0.17, 0.53, 0.6, 10.5, 18, '#aab2c5');
  box(0.22, 0.6, 0.07, 0.06, 15, 16.5, '#3e8ed0');
  box(0.41, 0.6, 0.07, 0.06, 15, 16.5, '#e5484d');
  box(0.19, 0.55, 0.32, 0.12, 10.5, 11.2, '#8b93a7');
  faceL(0.17, 0.53, 0.6, 3, 6, '#d6dce6');
  alpha(0.9, () => cyl(0.35, 0.35, 20, 34, 0.17, '#bfe3ff', '#7fc4f5'));
  cyl(0.35, 0.35, 34, 36.5, 0.06, '#7fc4f5', '#5aaee8');
  {
    const [wx, wy] = P(0.35, 0.35, 30);
    alpha(0.5, () => K.ell(wx, wy, 3.8, 1.9, '#e9f6ff'));
  }
  for (let k = 0; k < 4; k++) {
    const p = (t * 0.55 + k * 0.25) % 1,
      [bx, by] = P(0.35, 0.35, 21 + p * 9);
    rect(bx - 3 + k * 2, by, 1, 1, '#ffffff');
  }
  box(0.6, 0.22, 0.08, 0.08, 7, 17, '#ffffff', '#e6e9ef', '#c9cfdc');
};
F.vending = (K, t) => {
  const { box, faceL, P, rect, ctx, alpha } = K;
  box(0, 0, 0.9, 0.8, 0, 46, '#d8343a', '#c02a30', '#9e1f24');
  faceL(0.06, 0.62, 0.8, 9, 41, '#14233b');
  const sn = [
    '#ffd166',
    '#46a758',
    '#5ec8ff',
    '#ff8b3d',
    '#e93d82',
    '#f6f4ee',
    '#8e4ec6',
    '#e5484d',
    '#12a594',
    '#ffd166',
    '#3e8ed0',
    '#ff8b3d',
  ];
  [34, 27, 20, 13].forEach((z, r) => {
    faceL(0.07, 0.61, 0.8, z - 1.4, z - 0.8, '#3d4970');
    for (let c = 0; c < 3; c++) {
      const x = 0.1 + c * 0.17;
      faceL(x, x + 0.12, 0.8, z, z + 4.5, sn[(r * 3 + c) % sn.length]);
      faceL(x + 0.02, x + 0.05, 0.8, z + 3, z + 4, '#ffffff');
    }
  });
  alpha(0.1, () => faceL(0.1, 0.18, 0.8, 11, 39, '#ffffff'));
  faceL(0.66, 0.85, 0.8, 18, 40, '#2d3142');
  faceL(0.68, 0.83, 0.8, 35, 38, '#0f2a1a');
  if (Math.floor(t * 1.5) % 2) faceL(0.7, 0.76, 0.8, 36, 37, '#50fa7b');
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) faceL(0.69 + c * 0.05, 0.72 + c * 0.05, 0.8, 31 - r * 2.4, 32.4 - r * 2.4, '#c9cfdc');
  faceL(0.73, 0.78, 0.8, 22, 24, '#0b0d12');
  faceL(0.1, 0.58, 0.8, 2.5, 7, '#0b0d12');
  faceL(0.03, 0.87, 0.8, 41.5, 45.5, '#ffd166');
  const [hx, hy] = P(0.12, 0.8, 45);
  text3(wallPen(ctx, hx, hy, 'back'), 'SNACK', 2, 0, '#9e1f24');
};
F.table = (K, t) => {
  const { cyl, P, rect, ell, box } = K;
  const stool = (x, y) => {
    cyl(x, y, 0, 6.5, 0.035, '#8b93a7', '#5d6578');
    cyl(x, y, 6.5, 8.5, 0.17, '#e07a5f', '#c4644b');
  };
  stool(1, 0.2);
  stool(0.2, 1);
  cyl(1, 1, 0, 1, 0.2, '#3b4058');
  cyl(1, 1, 1, 10, 0.04, '#5d6578');
  cyl(1, 1, 10, 11.5, 0.56, '#f6f4ee', '#d6d1c6');
  const [tx, ty] = P(1, 1, 11.5);
  ell(tx + 3, ty + 1, 4, 2, '#ffffff');
  rect(tx + 1, ty - 1, 4, 2, '#e93d82');
  rect(tx + 2, ty - 1, 2, 1, '#ffb3cf');
  cyl(0.82, 0.9, 11.5, 13.6, 0.05, '#ffffff', '#e6e9ef');
  {
    const [cx, cy] = P(0.82, 0.9, 13.6);
    rect(cx - 1, cy, 2, 1, '#6b3e24');
  }
  box(1.12, 0.78, 0.12, 0.2, 11.5, 12, '#2d3142');
  stool(1.8, 1);
  stool(1, 1.8);
};
F.partition = (K, t, o) => {
  const { box, faceL, faceR, alpha } = K,
    col = (o && o.color) || '#3e8ed0',
    base = '#3d4970';
  const seg = (x, y, w, h, alongX) => {
    box(x, y, w, h, 0, 4, base);
    alpha(0.32, () =>
      box(
        x + (alongX ? 0 : 0.02),
        y + (alongX ? 0.02 : 0),
        alongX ? w : 0.06,
        alongX ? 0.06 : h,
        4,
        19,
        '#bfe3ff',
        '#9fd3ff',
        '#7fbbea',
      ),
    );
    alpha(0.4, () =>
      alongX ? faceL(x, x + w, y + h - 0.02, 9, 12.5, '#ffffff') : faceR(x + w - 0.02, y, y + h, 9, 12.5, '#ffffff'),
    );
    box(x, y, w, h, 19, 20.5, col);
  };
  seg(0, 0, 2.4, 0.1, true);
  box(-0.04, -0.02, 0.14, 0.14, 0, 21, '#8b93a7');
  box(1.16, -0.02, 0.12, 0.14, 0, 21, '#8b93a7');
  seg(2.3, 0.1, 0.1, 1.8, false);
  box(2.28, -0.02, 0.14, 0.14, 0, 21, '#8b93a7');
  box(2.28, 1.86, 0.14, 0.14, 0, 21, '#8b93a7');
};
F.plants = (K, t) => {
  const { cyl, P, rect, blob, line } = K;
  cyl(0.4, 0.4, 0, 9, 0.2, '#f6f4ee', '#e3ddd0');
  {
    const [px, py] = P(0.4, 0.4, 9);
    rect(px - 4, py - 1, 9, 1, '#5c4330');
    const sw = Math.sin(t * 1.2) * 0.6;
    [
      [-9, -11, 6],
      [7, -13, 6],
      [-1, -20, 6],
      [10, -4, 5],
      [-11, -3, 5],
    ].forEach(([dx, dy, r], i) => {
      line([px, py], [px + dx * 0.7 + sw, py + dy * 0.7], '#2e6b40');
      blob(px + dx + sw, py + dy, r, i % 2 ? '#2e8556' : '#3fa36b');
      rect(px + dx + sw - 1, py + dy - r + 2, 1, r * 2 - 3, '#25704a');
      rect(px + dx + sw + 2, py + dy - 1, 2, 1, shade('#3fa36b', -30));
    });
  }
  cyl(1.5, 0.3, 0, 7, 0.15, '#2d3142', '#20232d');
  {
    const [px, py] = P(1.5, 0.3, 7);
    [
      [-3, 18],
      [-1, 24],
      [1, 21],
      [3, 16],
      [0, 13],
      [-4, 12],
      [4, 11],
    ].forEach(([dx, h], i) => {
      const sw = Math.round(Math.sin(t * 1.5 + i) * 0.5);
      for (let y = 0; y < h; y++) {
        const w = y > h - 3 ? 1 : 2;
        rect(px + dx + sw * (y / h), py - y, w, 1, y % 4 === 0 ? '#6fae5f' : '#3f7d4a');
      }
      rect(px + dx - 1, py - h * 0.6, 1, h * 0.5, '#c9c25a');
    });
  }
  cyl(1.25, 1.3, 0, 8, 0.18, '#c46a48', '#a5573b');
  {
    const [px, py] = P(1.25, 1.3, 8);
    rect(px, py - 24, 2, 24, '#7a4a2a');
    [
      [-4, -22],
      [4, -19],
      [-5, -15],
      [4, -11],
      [-3, -26],
      [3, -27],
      [-4, -8],
    ].forEach(([dx, dy], i) => {
      blob(px + 1 + dx, py + dy, 3, i % 2 ? '#2f7a45' : '#3f9a5a');
      rect(px + 1 + dx, py + dy - 1, 1, 2, '#56b874');
    });
  }
};
function windowDraw(g, night, t) {
  g.fillStyle = night ? '#3d4970' : '#f6f4ee';
  g.fillRect(0, 0, 38, 36);
  g.fillStyle = night ? '#2b3452' : '#d9cfbd';
  g.fillRect(0, 34, 38, 2);
  for (let y = 2; y < 32; y++) {
    g.fillStyle = night ? mix('#0c1a33', '#24477a', y / 32) : mix('#7cc4ff', '#d6efff', y / 32);
    g.fillRect(2, y, 34, 1);
  }
  if (night) {
    [
      [6, 8],
      [14, 5],
      [28, 10],
      [22, 16],
      [9, 20],
      [31, 24],
    ].forEach(([x, y], k) => {
      g.fillStyle = (Math.floor(t * 1.3) + k) % 4 ? '#cfe3ff' : '#4a6fa8';
      g.fillRect(x, y, 1, 1);
    });
    g.fillStyle = '#f3f0d0';
    g.fillRect(26, 4, 5, 5);
    g.fillStyle = mix('#0c1a33', '#24477a', 0.15);
    g.fillRect(28, 4, 3, 3);
    g.fillStyle = '#16294a';
    [
      [2, 28, 7, 4],
      [9, 25, 6, 7],
      [15, 27, 8, 5],
      [23, 24, 6, 8],
      [29, 26, 7, 6],
    ].forEach(r => g.fillRect(...r));
    g.fillStyle = '#ffd166';
    [
      [11, 27],
      [17, 29],
      [25, 26],
      [31, 28],
      [5, 30],
    ].forEach(([x, y], k) => {
      if ((Math.floor(t * 0.5) + k) % 5) g.fillRect(x, y, 1, 1);
    });
  } else {
    g.fillStyle = '#fff3b0';
    g.fillRect(6, 6, 5, 5);
    g.fillStyle = '#ffe066';
    g.fillRect(7, 7, 3, 3);
    const off = Math.floor((t * 3) % 44) - 8;
    g.fillStyle = '#ffffff';
    g.fillRect(off, 14, 9, 2);
    g.fillRect(off + 2, 12, 5, 2);
    g.fillRect(off + 16, 22, 7, 2);
    g.fillRect(off + 18, 20, 3, 2);
  }
  g.fillStyle = night ? '#4a5780' : '#ffffff';
  for (let y = 2; y < 12; y += 2) {
    g.fillRect(2, y, 34, 1);
  }
  g.fillStyle = night ? '#2b3452' : '#d9cfbd';
  g.fillRect(2, 12, 34, 1);
  g.fillRect(30, 12, 1, 7);
  g.fillStyle = '#ffd166';
  g.fillRect(29, 19, 3, 2);
  g.fillStyle = night ? '#3d4970' : '#f6f4ee';
  g.fillRect(18, 2, 2, 30);
  g.fillRect(2, 20, 34, 2);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (let k = 0; k < 7; k++) g.fillRect(5 + k, 30 - k * 2, 2, 2);
}
function clockDraw(g) {
  for (let y = 0; y < 15; y++)
    for (let x = 0; x < 15; x++) {
      const d = Math.hypot(x - 7, y - 7);
      if (d <= 7.4) {
        g.fillStyle = d > 6.2 ? '#2d3142' : '#f6f4ee';
        g.fillRect(x, y, 1, 1);
      }
    }
  g.fillStyle = '#8b93a7';
  [
    [7, 2],
    [12, 7],
    [7, 12],
    [2, 7],
  ].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  const d = new Date(),
    mA = (d.getMinutes() / 60) * Math.PI * 2 - Math.PI / 2,
    hA = (((d.getHours() % 12) + d.getMinutes() / 60) / 12) * Math.PI * 2 - Math.PI / 2,
    sA = (d.getSeconds() / 60) * Math.PI * 2 - Math.PI / 2;
  for (let r = 0; r < 5; r += 0.5) {
    g.fillStyle = '#2d3142';
    g.fillRect(Math.round(7 + Math.cos(mA) * r), Math.round(7 + Math.sin(mA) * r), 1, 1);
    if (r < 3.5) g.fillRect(Math.round(7 + Math.cos(hA) * r), Math.round(7 + Math.sin(hA) * r), 1, 1);
    g.fillStyle = '#e5484d';
    g.fillRect(Math.round(7 + Math.cos(sA) * r), Math.round(7 + Math.sin(sA) * r), 1, 1);
  }
}
function exitDraw(g, t) {
  g.fillStyle = '#14532d';
  g.fillRect(0, 0, 27, 11);
  g.fillStyle = '#1f8a4c';
  g.fillRect(1, 1, 25, 9);
  text3(g, 'EXIT', 4, 3, '#ffffff');
  g.fillStyle = '#ffffff';
  const f = Math.floor(t * 4) % 2;
  g.fillRect(22, 2, 2, 2);
  g.fillRect(21, 4, 3, 2);
  g.fillRect(20 + f, 6, 1, 3);
  g.fillRect(23 - f, 6, 1, 3);
}
function posterDraw(g) {
  g.fillStyle = '#2d3142';
  g.fillRect(0, 0, 22, 28);
  g.fillStyle = '#f6f4ee';
  g.fillRect(1, 1, 20, 26);
  g.fillStyle = '#d97757';
  g.fillRect(2, 2, 18, 16);
  g.fillStyle = '#ffffff';
  g.fillRect(10, 5, 2, 8);
  g.fillRect(9, 7, 4, 5);
  g.fillRect(10, 4, 2, 1);
  g.fillStyle = '#2d3142';
  g.fillRect(10, 8, 2, 2);
  g.fillStyle = '#ffd166';
  g.fillRect(10, 13, 2, 2);
  g.fillStyle = '#ff8b3d';
  g.fillRect(10, 15, 2, 1);
  g.fillStyle = '#ffffff';
  g.fillRect(8, 11, 1, 2);
  g.fillRect(13, 11, 1, 2);
  text3(g, 'SHIP', 3, 20, '#2d3142');
  g.fillStyle = '#d97757';
  g.fillRect(19, 20, 1, 5);
}
function doorDraw(g) {
  g.fillStyle = '#5c4330';
  g.fillRect(0, 0, 20, 42);
  g.fillStyle = '#8a5a3a';
  g.fillRect(2, 2, 16, 40);
  g.fillStyle = '#7a4f2f';
  g.fillRect(4, 24, 12, 14);
  g.fillRect(4, 4, 12, 2);
  g.fillStyle = '#9fd3ff';
  g.fillRect(5, 7, 10, 13);
  g.fillStyle = '#cfeaff';
  g.fillRect(6, 8, 2, 4);
  g.fillStyle = '#ffd166';
  g.fillRect(14, 22, 3, 2);
  g.fillStyle = '#c9a77a';
  g.fillRect(6, 21, 6, 1);
}
F.window = (K, t, o) => {
  const { box, P, cyl, rect, blob } = K;
  const [X, Y] = P(0.3, 0, 54);
  mount(K.ctx, g => windowDraw(g, o.night, t), 38, 36, X, Y, 'back', '#1f2638');
  box(0.2, 0, 2.55, 0.3, 17, 19, o.night ? '#4a5780' : '#ffffff');
  cyl(0.7, 0.15, 19, 23, 0.07, '#c46a48', '#a5573b');
  {
    const [px, py] = P(0.7, 0.15, 23);
    rect(px - 1, py - 6, 3, 6, '#3f9a5a');
    rect(px - 3, py - 4, 2, 2, '#3f9a5a');
    rect(px + 2, py - 5, 2, 2, '#3f9a5a');
  }
};
F.walldecor = (K, t) => {
  const { P, ctx } = K;
  let [X, Y] = P(0.25, 0, 50);
  mount(ctx, posterDraw, 22, 28, X, Y, 'back', '#1a1c24');
  [X, Y] = P(2.0, 0, 46);
  mount(ctx, clockDraw, 15, 15, X, Y, 'back', '#1a1c24');
  [X, Y] = P(3.0, 0, 54);
  mount(ctx, g => exitDraw(g, t), 27, 11, X, Y, 'back', '#0b2a17');
  const [gx, gy] = P(3.38, 0, 44);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#50fa7b';
  ctx.fillRect(gx - 6, gy, 16, 10);
  ctx.globalAlpha = 1;
};
F.door = (K, t) => {
  const { P, poly, ctx } = K;
  const [X, Y] = P(0, 2.1, 44);
  mount(ctx, doorDraw, 20, 42, X, Y, 'left', '#3f2716');
  poly([P(0.05, 0.9), P(0.95, 0.9), P(0.95, 2.1), P(0.05, 2.1)], '#9e3b2b');
  poly([P(0.12, 0.98), P(0.88, 0.98), P(0.88, 2.02), P(0.12, 2.02)], null, '#c95a43');
  const [ex, ey] = P(0, 2.3, 54);
  mount(ctx, g => exitDraw(g, t), 27, 11, ex, ey, 'left', '#0b2a17');
};
F.rug = (K, t) => {
  const { poly, P } = K;
  const W = 3,
    H = 2,
    s = 0.25,
    cols = ['#3a2f55', '#5b4a8a', '#d97757', '#f2ead9'];
  for (let i = 0; i < W / s; i++)
    for (let j = 0; j < H / s; j++) {
      const x = i * s,
        y = j * s,
        edge = i === 0 || j === 0 || i === W / s - 1 || j === H / s - 1,
        in2 = i === 1 || j === 1 || i === W / s - 2 || j === H / s - 2;
      const ci = edge ? 0 : in2 ? 2 : (Math.abs(i - W / s / 2 + 0.5) + Math.abs(j - H / s / 2 + 0.5)) % 3 < 1 ? 3 : 1;
      poly([P(x, y), P(x + s, y), P(x + s, y + s), P(x, y + s)], cols[ci]);
    }
  for (let k = 0; k < 12; k++) {
    const [fx, fy] = P(k * 0.25 + 0.12, H);
    K.rect(fx, fy, 1, 2, '#f2ead9');
  }
};
const ITEMS = [
  { key: 'desk', name: 'Bàn làm việc', fn: F.desk },
  { key: 'chair', name: 'Ghế xoay lưới', fn: F.chair },
  { key: 'chairBase', name: 'Ghế (chân+đệm)', fn: F.chairBase },
  { key: 'backrest', name: 'Tựa lưng ghế', fn: F.backrest },
  { key: 'bookshelf', name: 'Kệ sách', fn: F.bookshelf, wall: 'back' },
  { key: 'coffee', name: 'Quầy cà phê', fn: F.coffee, wall: 'back' },
  { key: 'fridge', name: 'Tủ lạnh', fn: F.fridge, wall: 'back' },
  { key: 'cooler', name: 'Cây nước', fn: F.cooler, wall: 'back' },
  { key: 'vending', name: 'Máy bán snack', fn: F.vending, wall: 'back' },
  { key: 'table', name: 'Bàn tròn pantry', fn: F.table },
  { key: 'partition', name: 'Vách kính', fn: F.partition },
  { key: 'plants', name: 'Cây xanh', fn: F.plants },
  { key: 'window', name: 'Cửa sổ', fn: F.window, wall: 'back' },
  { key: 'walldecor', name: 'Đồ treo tường', fn: F.walldecor, wall: 'back' },
  { key: 'door', name: 'Cửa ra vào', fn: F.door, wall: 'left' },
  { key: 'rug', name: 'Thảm', fn: F.rug },
];
const SCREEN_MAP = {
  working: 'code',
  error: 'error',
  permission: 'perm',
  done: 'done',
  thinking: 'think',
  idle: 'off',
  waiting: 'term',
  talking: 'code',
  reading: 'read',
};
function deskWorkstation(ctx, PF, d, owner, t, drawPersonFn) {
  const seated = owner && owner.seated && !owner.sleeping;
  const empty = !seated;
  const push = empty ? [0.62, 1.05] : [0.52, 1.05];
  const z0 = d.gx + d.gy;
  let scr = 'off';
  if (seated) {
    scr = SCREEN_MAP[owner.status] || 'code';
    if (owner.status === 'working' && owner.tool && owner.tool[0] === 'Bash') scr = 'term';
  }
  const items = [];
  items.push({
    z: z0 + 1.5,
    f: () => {
      const K = kit(ctx, ...PF(d.gx, d.gy));
      F.desk(K, t, { screen: scr, noMug: scr === 'term' });
      F.chair(kit(ctx, ...PF(d.gx + push[0], d.gy + push[1])));
      if (!empty) {
        drawPersonFn();
        F.backrest(kit(ctx, ...PF(d.gx + push[0], d.gy + push[1])));
      }
    },
  });
  return items;
}
export const OfficeDecor = {
  ITEMS,
  F,
  kit,
  SCREEN,
  SCREEN_MAP,
  deskWorkstation,
  drawUsageBoard,
  boardSurface,
  BW,
  BH,
  fmtReset,
  mount,
  skewRect,
  wallPen,
  text3,
  surf,
  shade,
  mix,
  windowDraw,
  clockDraw,
  exitDraw,
  posterDraw,
  doorDraw,
  dyOf,
};
