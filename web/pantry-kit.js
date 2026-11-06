// Drawing kit of the pantry: colour helpers, the pixel font and the kit of shapes; I is the registry of pantry pieces.
export const shade = (h, p) => {
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
export const FONT = {
  A: '010101111101101',
  C: '011100100100011',
  E: '111100110100111',
  F: '111100110100100',
  N: '110101101101101',
  P: '110101110100100',
  R: '110101110101101',
  T: '111010010010010',
  Y: '101101010010010',
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '110001010100111',
  '3': '110001010001110',
  '4': '101101111001001',
  '5': '111100110001110',
  ':': '000010000010000',
};
export function kit(ctx, ox, oy) {
  const P = (x, y, z = 0) => [ox + (x - y) * 16, oy + (x + y) * 8 - z];
  const rd = v => Math.round(v * 2) / 2;
  const poly = (pts, f) => {
    if (!f) return;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(rd(p[0]), rd(p[1])) : ctx.moveTo(rd(p[0]), rd(p[1]))));
    ctx.closePath();
    ctx.fillStyle = f;
    ctx.fill();
  };
  const top = (x, y, w, h, z, c) => poly([P(x, y, z), P(x + w, y, z), P(x + w, y + h, z), P(x, y + h, z)], c);
  const fL = (x0, x1, y, z0, z1, c) => poly([P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)], c);
  const fR = (x, y0, y1, z0, z1, c) => poly([P(x, y0, z0), P(x, y1, z0), P(x, y1, z1), P(x, y0, z1)], c);
  const box = (x, y, w, h, z0, z1, t, l, r) => {
    fL(x, x + w, y + h, z0, z1, l || shade(t, -22));
    fR(x + w, y, y + h, z0, z1, r || shade(t, -38));
    top(x, y, w, h, z1, t);
  };
  const R = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(rd(x), rd(y), w, h);
  };
  const ell = (x, y, rx, ry, c) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const cyl = (x, y, z0, z1, r, t, s) => {
    const [px, py] = P(x, y, z0),
      rx = r * 22.6,
      ry = rx / 2,
      h = z1 - z0;
    s = s || shade(t, -25);
    ell(px, py, rx, ry, s);
    ctx.fillStyle = s;
    ctx.fillRect(px - rx, py - h, rx * 2, h);
    ctx.fillStyle = shade(s, -14);
    ctx.fillRect(px + rx * 0.35, py - h, rx * 0.65, h);
    ctx.fillStyle = shade(s, 14);
    ctx.fillRect(px - rx * 0.7, py - h, rx * 0.25, h);
    ell(px, py - h, rx, ry, t);
  };
  const al = (a, fn) => {
    const o = ctx.globalAlpha;
    ctx.globalAlpha = o * a;
    fn();
    ctx.globalAlpha = o;
  };
  const line = (a, b, c, w = 1) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  const blob = (cx, cy, r, c) => {
    for (let d = -r; d <= r; d++) {
      const w = Math.round(Math.sqrt(r * r - d * d)) * 2;
      R(cx - w / 2, cy + d, w, 1, c);
    }
  };
  const glyphs = (s, sz) => {
    [...s].forEach((ch, i) => {
      const f = FONT[ch];
      if (f)
        for (let b = 0; b < 15; b++)
          if (f[b] === '1') ctx.fillRect(i * 4 * sz + (b % 3) * sz, Math.floor(b / 3) * sz, sz, sz);
    });
  };
  const wallText = (s, x, z, col, sz, y = 0) => {
    const [bx, by] = P(x, y, z);
    ctx.save();
    ctx.translate(bx, by);
    ctx.transform(1, 0.5, 0, 1, 0, 0);
    ctx.fillStyle = col;
    glyphs(s, sz);
    ctx.restore();
  };
  const shadow = (x, y, w, h, a = 0.28) => al(a, () => top(x - 0.04, y - 0.04, w + 0.08, h + 0.08, 0.05, '#000000'));
  return { ctx, P, poly, top, fL, fR, box, R, ell, cyl, al, line, blob, wallText, shadow };
}

export const I = {};
