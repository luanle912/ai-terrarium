// Drawing kit shared by the office decor: the pixel font, colour helpers and the kit of shapes (surfaces, pens,
// mounts).
export const FONT = {
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
export function text3(g, str, x, y, col) {
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
export const textW = s => String(s).length * 4 - 1;
export const shade = (h, p) => {
  if (!h || h[0] !== '#' || h.length !== 7) return h;
  const n = parseInt(h.slice(1), 16),
    c = v => Math.max(0, Math.min(255, v));
  return (
    '#' +
    ((1 << 24) + (c((n >> 16) + p) << 16) + (c(((n >> 8) & 255) + p) << 8) + c((n & 255) + p)).toString(16).slice(1)
  );
};
export const mix = (a, b, p) => {
  const A = parseInt(a.slice(1), 16),
    B = parseInt(b.slice(1), 16),
    f = s => Math.round(((A >> s) & 255) * (1 - p) + ((B >> s) & 255) * p);
  return '#' + ((1 << 24) + (f(16) << 16) + (f(8) << 8) + f(0)).toString(16).slice(1);
};
export const pool = {};
export function surf(key, w, h) {
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
export const dyOf = (c, dir) => (dir === 'left' ? -1 : 1) * Math.floor(c / 2);
export const al = x => Math.round(x);
export function wallPen(ctx, X0, Y0, dir) {
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
export function skewRect(ctx, X0, Y0, w, h, dir, col) {
  ctx.fillStyle = col;
  X0 = Math.round(X0);
  Y0 = Math.round(Y0);
  for (let c = 0; c < w; c++) ctx.fillRect(X0 + c, Y0 + dyOf(c, dir), 1, h);
}
export function mount(ctx, draw, w, h, X0, Y0, dir, edge, glow) {
  const dx = dir === 'left' ? 2 : -2;
  if (glow) skewRect(ctx, X0 - 4, Y0 - 4, w + 10, h + 9, dir, glow);
  skewRect(ctx, X0 + dx * 0.5 + 1, Y0 + 4, w, h, dir, 'rgba(0,0,0,0.22)');
  skewRect(ctx, X0, Y0, w, h, dir, edge);
  draw(wallPen(ctx, X0 + dx, Y0 + 1, dir));
}
export function kit(ctx, ox, oy) {
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

export const F = {};
