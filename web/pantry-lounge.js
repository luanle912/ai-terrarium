// Pantry lounge pieces registered into I: sofa, coffee table, armchair, floor lamp, rug, booth, cafe tables, arcade,
// foosball and plants.
import { PLANT } from './pantry-items.js';
import { I, shade } from './pantry-kit.js';
I.sofa = {
  name: 'Sofa nhung 3 chỗ',
  group: 'Phòng khách',
  size: [2.8, 0.9],
  note: 'Nhung xanh ngọc',
  draw(k, t) {
    const { box, fL, fR, top, R, P } = k,
      f = '#2f8f8a',
      fD = '#24706c',
      fDD = '#1c5956';
    [
      [0.1, 0.1],
      [2.6, 0.1],
      [0.1, 0.75],
      [2.6, 0.75],
    ].forEach(([x, y]) => box(x, y, 0.08, 0.08, 0, 2, '#5c3a22'));
    box(0, 0, 2.8, 0.9, 2, 7, f, fD, fDD);
    box(0.08, 0, 2.64, 0.28, 7, 18, shade(f, 6), fD, fDD);
    for (let i = 0; i < 3; i++) {
      const x = 0.22 + i * 0.8;
      box(x, 0.04, 0.76, 0.22, 8, 17.5, shade(f, 10), shade(f, -6), fD);
      fL(x + 0.05, x + 0.71, 0.26, 16.4, 17.2, shade(f, 24));
    }
    for (let i = 0; i < 3; i++) {
      const x = 0.22 + i * 0.8;
      box(x, 0.28, 0.77, 0.58, 7, 9.5, shade(f, 14), shade(f, -4), fD);
      fL(x + 0.04, x + 0.73, 0.86, 8.9, 9.5, shade(f, 28));
    }
    box(0, 0, 0.22, 0.9, 7, 13, shade(f, 4), fD, fDD);
    box(2.58, 0, 0.22, 0.9, 7, 13, shade(f, 4), fD, fDD);
    top(0, 0, 0.22, 0.9, 13.01, shade(f, 16));
    top(2.58, 0, 0.22, 0.9, 13.01, shade(f, 16));
    box(0.32, 0.22, 0.42, 0.12, 9.5, 16, '#d9a441', '#c08f33', '#a67a2a');
    fL(0.36, 0.7, 0.34, 12.4, 13, '#f2c46a');
    box(2.06, 0.22, 0.42, 0.12, 9.5, 15.5, '#d97757', '#bb6345', '#9e5238');
    box(1.4, 0.3, 0.6, 0.56, 9.5, 10.4, '#e8d9bf', '#d6c6a8', '#c2b291');
    for (let i = 0; i < 4; i++) fL(1.42 + i * 0.14, 1.48 + i * 0.14, 0.86, 4, 10.4, '#e8d9bf');
  },
};
I.coffeetable = {
  name: 'Bàn trà',
  group: 'Phòng khách',
  size: [1.6, 0.65],
  note: 'Gỗ óc chó',
  draw(k, t) {
    const { box, fL, fR, top, R, P, cyl, line } = k;
    [
      [0.04, 0.04],
      [1.5, 0.04],
      [0.04, 0.55],
      [1.5, 0.55],
    ].forEach(([x, y]) => box(x, y, 0.06, 0.06, 0, 5, '#5c3a22'));
    box(0.1, 0.1, 1.4, 0.45, 1.5, 2.2, '#7a5228');
    box(0.3, 0.15, 0.3, 0.3, 2.2, 3.2, '#3e8ed0');
    box(0.32, 0.16, 0.28, 0.28, 3.2, 3.8, '#e5484d');
    box(0, 0, 1.6, 0.65, 5, 6.5, '#a86b45', '#8a5a30', '#74501f');
    top(0, 0, 1.6, 0.65, 6.5, '#b97a4a');
    for (let i = 0; i < 4; i++) line(P(0.05, 0.12 + i * 0.14, 6.5), P(1.55, 0.12 + i * 0.14, 6.5), '#a86b45');
    box(0.12, 0.14, 0.42, 0.32, 6.5, 7, '#5b8def');
    box(0.16, 0.17, 0.36, 0.26, 7, 7.3, '#ffffff');
    top(0.18, 0.2, 0.3, 0.04, 7.31, '#e5484d');
    box(0.66, 0.2, 0.4, 0.28, 6.5, 7.3, '#c9d3e3', '#aab4c6', '#8f9ab0');
    {
      const [lx, ly] = P(0.86, 0.34, 7.3);
      R(lx - 1, ly - 1, 2, 1, '#ffffff');
    }
    cyl(1.18, 0.24, 6.5, 8.6, 0.05, '#ffffff', '#e6e9ef');
    cyl(1.3, 0.42, 6.5, 8.6, 0.05, '#e5484d', '#c0392b');
    cyl(1.45, 0.18, 6.5, 8.6, 0.06, '#c46a48', '#a5573b');
    {
      const [px, py] = P(1.45, 0.18, 8.6);
      [
        [-2, -1],
        [1, -2],
        [0, 0],
        [-1, -3],
      ].forEach(([dx, dy], i) => R(px + dx, py + dy, 2, 2, i % 2 ? '#6fae5f' : '#8fcf7a'));
    }
  },
};
I.armchair = {
  name: 'Ghế bành',
  group: 'Phòng khách',
  size: [0.85, 0.9],
  note: 'Vải cam đất',
  draw(k, t) {
    const { box, fL, fR, top, R } = k,
      f = '#d97757',
      fD = '#b45f43',
      fDD = '#94503a';
    [
      [0.06, 0.06],
      [0.7, 0.06],
      [0.06, 0.76],
      [0.7, 0.76],
    ].forEach(([x, y]) => box(x, y, 0.08, 0.08, 0, 2, '#5c3a22'));
    box(0, 0, 0.85, 0.9, 2, 7, f, fD, fDD);
    box(0.62, 0.02, 0.23, 0.86, 7, 18, shade(f, 6), fD, fDD);
    fR(0.62, 0.08, 0.82, 10, 17, shade(f, 12));
    box(0.05, 0.18, 0.58, 0.54, 7, 9.5, shade(f, 14), shade(f, -4), fD);
    fL(0.08, 0.6, 0.72, 8.9, 9.5, shade(f, 26));
    box(0, 0, 0.68, 0.18, 7, 12.5, f, fD, fDD);
    box(0, 0.72, 0.68, 0.18, 7, 12.5, f, fD, fDD);
    top(0, 0, 0.68, 0.18, 12.51, shade(f, 16));
    top(0, 0.72, 0.68, 0.18, 12.51, shade(f, 16));
    box(0.46, 0.24, 0.14, 0.32, 9.5, 15, '#e8d9bf', '#d6c6a8', '#c2b291');
  },
};
I.floorlamp = {
  name: 'Đèn cây',
  group: 'Phòng khách',
  size: [0.4, 0.4],
  note: 'Đế tròn nặng',
  draw(k, t, o) {
    const { P, R, ell, al, cyl } = k;
    const [bx, by] = P(0.2, 0.2);
    if (o.night) al(0.2, () => ell(bx + 2, by + 2, 24, 12, '#ffd166'));
    cyl(0.2, 0.2, 0, 1.2, 0.14, '#2d3142', '#1f2230');
    const [tx, ty] = P(0.2, 0.2, 34);
    R(Math.round(tx) - 1, ty, 2, Math.round(by - ty) - 1, '#2d3142');
    R(Math.round(tx) - 1, ty, 1, Math.round(by - ty) - 1, '#4a5066');
    ell(tx, ty + 1, 7, 2.5, '#c2b291');
    R(tx - 7, ty - 8, 14, 9, '#f2ead9');
    R(tx + 2, ty - 8, 5, 9, '#e2d6be');
    R(tx - 7, ty - 8, 14, 1, '#c2b291');
    ell(tx, ty - 8, 7, 2.5, '#fbf6ea');
    if (o.night) {
      al(0.7, () => R(tx - 6, ty + 1, 12, 2, '#fff3b0'));
    }
  },
};
I.rug = {
  name: 'Thảm phòng khách',
  group: 'Phòng khách',
  size: [4.4, 3.4],
  flat: true,
  note: 'Viền đỏ rượu',
  draw(k, t) {
    const { top, poly, P, R } = k;
    const x0 = 0,
      x1 = 4.4,
      y0 = 0,
      y1 = 3.4;
    top(x0, y0, x1, y1, 0.15, '#7a3b4a');
    top(x0 + 0.15, y0 + 0.15, x1 - 0.3, y1 - 0.3, 0.2, '#e8d9bf');
    top(x0 + 0.35, y0 + 0.35, x1 - 0.7, y1 - 0.7, 0.25, '#2f5f73');
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 3; j++) {
        const cx = x0 + 0.85 + i * 0.68,
          cy = y0 + 0.85 + j * 0.85;
        poly(
          [P(cx, cy - 0.24, 0.3), P(cx + 0.24, cy, 0.3), P(cx, cy + 0.24, 0.3), P(cx - 0.24, cy, 0.3)],
          (i + j) % 2 ? '#d9a441' : '#e8d9bf',
        );
        poly([P(cx, cy - 0.1, 0.31), P(cx + 0.1, cy, 0.31), P(cx, cy + 0.1, 0.31), P(cx - 0.1, cy, 0.31)], '#7a3b4a');
      }
    for (let q = 0; q < 15; q++) {
      const [fx, fy] = P(x0 + 0.12 + q * 0.29, y1);
      R(fx, fy, 1, 2, '#e8d9bf');
      const [gx, gy] = P(x1, y0 + 0.12 + q * 0.22);
      if (q < 15) R(gx, gy, 1, 2, '#e8d9bf');
    }
  },
};
I.booth = {
  name: 'Băng ghế booth',
  group: 'Góc booth',
  size: [0.6, 3.7],
  note: 'Khung gỗ óc chó',
  draw(k, t) {
    const { box, fL, fR, top, R, P } = k;
    for (let y = 0; y < 3.69; y += 0.5) {
      const h = Math.min(0.5, 3.7 - y);
      box(0, y, 0.14, h, 0, 16, '#8a5a3a', '#74501f', '#5c3e1a');
      fR(0.14, y, y + h, 10, 10.6, '#a8763e');
      fR(0.14, y, y + h, 14, 14.6, '#a8763e');
      top(0, y, 0.14, h, 16.01, '#a8763e');
      box(0.14, y, 0.44, h, 0, 5, '#8a5a3a', '#74501f', '#5c3e1a');
      box(0.16, y, 0.4, h, 5, 6.8, '#c98a4e', '#b07a44', '#956535');
      box(0.14, y, 0.05, h, 6.8, 13, '#c98a4e', '#b07a44', '#956535');
    }
    for (let i = 0; i < 6; i++) {
      const [bx, by] = P(0.36, 0.3 + i * 0.6, 6.8);
      R(bx, by, 1, 1, '#7a5228');
    }
    [1.23, 2.46].forEach(y => fR(0.56, y - 0.02, y + 0.02, 0.5, 6.8, '#5c3e1a'));
    fL(0.14, 0.58, 3.7, 0, 5, '#74501f');
  },
};
I.cafetable = {
  name: 'Bàn cafe & ghế',
  group: 'Góc booth',
  size: [1.4, 0.7],
  note: 'Bàn vuông mặt trắng',
  // o.use: the candle is lit (and glows after dark) only while someone sits at the table
  draw(k, t, o) {
    const { ctx, box, fL, fR, top, R, P, cyl, al, fade } = k,
      u = o.use || 0;
    cyl(0.35, 0.35, 0, 1, 0.15, '#2d3142');
    cyl(0.35, 0.35, 1, 10, 0.03, '#5d6578');
    box(0.05, 0.05, 0.6, 0.6, 10, 11.5, '#f6f4ee', '#dcd6c9', '#c4bdae');
    fL(0.05, 0.65, 0.65, 11, 11.5, '#ffffff');
    {
      const [tx, ty] = P(0.3, 0.3, 11.5);
      R(tx - 1, ty - 3, 3, 3, '#ffffff');
      R(tx - 1, ty - 3, 3, 1, '#e5484d');
    }
    {
      const [lx, ly] = P(0.5, 0.25, 11.5);
      R(lx - 1, ly - 4, 2, 4, '#f2ead9');
      R(lx - 0.5, ly - 5, 1, 1, '#3a2a20');
      if (u > 0) {
        const g = fade(u);
        if (o.night) {
          ctx.globalAlpha = g * 0.25 * u;
          k.ell(lx, ly - 5, 5, 4, '#ffd166');
          ctx.globalAlpha = g * u;
        }
        R(lx - 0.5, ly - 6, 1, 2, Math.floor(t * 6) % 2 ? '#ffd166' : '#ff8b3d');
        ctx.globalAlpha = g;
      }
    }
    [
      [0.9, 0.13],
      [1.3, 0.13],
      [0.9, 0.53],
      [1.3, 0.53],
    ].forEach(([x, y]) => box(x, y, 0.04, 0.04, 0, 6, '#2d3142'));
    box(0.86, 0.12, 0.48, 0.46, 6, 7.6, '#4a5a80', '#3b4a6b', '#2f3c58');
    box(1.25, 0.1, 0.1, 0.5, 7.6, 16, '#3b4a6b', '#2f3c58', '#253048');
    top(1.25, 0.1, 0.1, 0.5, 16.01, '#5b6b94');
    fR(1.25, 0.15, 0.55, 9, 15, '#4a5a80');
  },
};
// the arcade's side neon strips, unlit and lit, and the colours of the game's pixels
const STRIP_OFF = ['#4a1f38', '#4a3f22', '#1f3f48'],
  STRIP_ON = ['#ff5fa2', '#ffd166', '#5ef2ff'],
  PIXELS = ['#50fa7b', '#ff5fa2', '#ffd166', '#5ef2ff', '#ffffff', '#e5484d', '#8e4ec6'];
I.arcade = {
  name: 'Máy arcade',
  group: 'Góc game',
  size: [0.7, 0.8],
  note: 'Thân tím',
  // o.use: off (dark screen, unlit neon) unless someone is playing; the light fades in and out with o.use
  draw(k, t, o) {
    const { ctx, box, fL, fR, top, R, P, al, fade } = k,
      u = o.use || 0,
      body = '#5b2a8c',
      neon = '#ff5fa2',
      w = 0.7,
      d = 0.6,
      ph = Math.floor(t * 6);
    box(0, 0, w, d, 0, 1.5, '#14161c');
    box(0, 0, w, d, 1.5, 32, body, shade(body, -12), shade(body, -32));
    for (let q = 0; q < 3; q++) fR(w, 0.08 + q * 0.15, 0.14 + q * 0.15, 4, 30, STRIP_OFF[q]);
    fR(w, 0.1, 0.5, 24, 28, shade(body, -10));
    fL(0.04, w - 0.04, d, 27.5, 31.5, '#5a2340');
    fL(0.1, w - 0.1, d, 28.5, 30.5, '#3a1a2a');
    fL(0.05, w - 0.05, d, 14, 26.8, '#2a1440');
    fL(0.09, w - 0.09, d, 15, 25.8, '#07080c');
    if (u > 0) {
      const g = fade(u);
      for (let q = 0; q < 3; q++) fR(w, 0.08 + q * 0.15, 0.14 + q * 0.15, 4, 30, STRIP_ON[q]);
      fR(w, 0.1, 0.5, 24, 28, shade(body, -10));
      fL(0.04, w - 0.04, d, 27.5, 31.5, neon);
      if (o.night) {
        ctx.globalAlpha = g * 0.28 * u;
        fL(-0.12, w + 0.12, d, 25, 34, neon);
        ctx.globalAlpha = g * u;
      }
      fL(0.1, w - 0.1, d, 28.5, 30.5, '#ffe0ee');
      for (let q = 0; q < 7; q++) {
        const px = 0.13 + ((ph * 3 + q * 7) % 9) * 0.05,
          z = 16 + ((ph + q * 5) % 9);
        fL(px, px + 0.045, d, z, z + 1, PIXELS[q]);
      }
      fL(0.09, w - 0.09, d, 15, 15.8, '#3a4462');
      const bx = 0.15 + ((ph * 2) % 8) * 0.05;
      fL(bx, bx + 0.08, d, 16.4, 17.4, '#ffd166');
      ctx.globalAlpha = g;
    }
    al(0.15, () => fL(0.1, 0.22, d, 17, 25.5, '#ffffff'));
    box(0.02, d, w - 0.04, 0.2, 11.5, 14, shade(body, 10), shade(body, -8), shade(body, -28));
    top(0.04, d + 0.02, w - 0.08, 0.16, 14.01, '#1f2230');
    {
      const [jx, jy] = P(0.2, d + 0.1, 14);
      R(jx, jy - 3, 1, 3, '#2d3142');
      R(jx - 1, jy - 5, 3, 2, '#e5484d');
      R(jx - 1, jy - 5, 1, 1, '#ff9a9a');
      [
        [0.4, '#ffd166'],
        [0.48, '#5ef2ff'],
        [0.56, '#50fa7b'],
      ].forEach(([x, c]) => {
        const [bx2, by2] = P(x, d + 0.1, 14);
        R(bx2, by2 - 1, 2, 1, c);
      });
    }
    fL(0.12, w - 0.12, d, 3, 9.5, shade(body, -22));
    fL(0.24, 0.32, d, 6, 7.5, u > 0.5 ? '#ffd166' : '#7a6430');
    fL(0.38, 0.46, d, 6, 7.5, u > 0.5 ? '#ffd166' : '#7a6430');
    if (u > 0.5 && Math.floor(t * 2) % 2) al(0.6, () => fL(0.24, 0.46, d, 5.4, 8, '#ffd166'));
  },
};
I.foosball = {
  name: 'Bàn bi lắc',
  group: 'Góc game',
  size: [1.6, 0.6],
  note: 'Khung gỗ',
  // o.use: the ball rolls and the rods slide only while someone plays; otherwise the ball rests mid-table
  draw(k, t, o) {
    const { box, fL, fR, top, R, P, line } = k,
      u = (o && o.use) || 0,
      x1 = 1.6,
      y1 = 0.6;
    [
      [0.05, 0.05],
      [1.5, 0.05],
      [0.05, 0.5],
      [1.5, 0.5],
    ].forEach(([dx, dy]) => box(dx, dy, 0.06, 0.06, 0, 9, '#2d3142'));
    box(0.1, 0.1, 1.4, 0.4, 2, 2.6, '#2d3142');
    box(0, 0, x1, y1, 9, 13, '#a86b45', '#8a5a30', '#74501f');
    top(0.06, 0.06, x1 - 0.12, y1 - 0.12, 12.5, '#2f8f4e');
    for (let i = 0; i < 7; i++) top(0.06 + i * 0.21, 0.06, 0.1, y1 - 0.12, 12.52, '#2a8045');
    top(0.79, 0.06, 0.02, y1 - 0.12, 12.6, '#ffffff');
    [0.06, x1 - 0.1].forEach(x => top(x, 0.22, 0.04, 0.16, 12.6, '#ffffff'));
    {
      const p = 0.5 + (Math.sin(t * 1.5) / 2) * u,
        [bx, by] = P(0.25 + p * 1.1, 0.3, 12.6);
      R(bx, by - 1, 2, 2, '#ffffff');
    }
    for (let i = 0; i < 6; i++) {
      const x = 0.18 + i * 0.25,
        col = i % 2 ? '#3e8ed0' : '#e5484d',
        sl = Math.sin(t * 2 + i) * 0.04 * u;
      const a = P(x, -0.18, 15),
        b = P(x, y1 + 0.18, 15);
      line(a, b, '#c9d3e3');
      for (let q = 0; q < 2; q++) {
        const [px, py] = P(x, 0.18 + q * 0.25 + sl, 13);
        R(px - 1, py - 3, 2, 3, col);
        R(px - 1, py - 4, 2, 1, '#f2c9a0');
      }
      R(b[0] - 1, b[1] - 1, 3, 3, '#14161c');
    }
    box(0.7, -0.06, 0.2, 0.06, 13, 15, '#2d3142');
  },
};
I.planter = {
  name: 'Bồn cây vách ngăn',
  group: 'Cây xanh',
  size: [0.55, 2.5],
  note: 'Bồn bê tông xám',
  draw(k, t, o) {
    const { box, top, R, P } = k,
      pl = o.night ? '#3b4052' : '#8b93a7';
    for (let y = 0; y < 2.49; y += 0.5) {
      box(0.02, y, 0.52, 0.5, 0, 10, pl, shade(pl, -18), shade(pl, -32));
      top(0.08, y + 0.03, 0.4, 0.44, 10, o.night ? '#3a2a20' : '#6b4e36');
    }
    [0.35, 1.1, 1.85].forEach((y, i) => PLANT(k, 0.28, y, t, i % 3 === 1 ? 1 : 0));
  },
};
I.potplant = {
  name: 'Chậu cây góc',
  group: 'Cây xanh',
  size: [0.5, 0.5],
  note: 'Chậu sứ trắng trụ tròn',
  draw(k, t) {
    const { cyl, P } = k;
    cyl(0.25, 0.25, 0, 9, 0.2, '#f6f4ee', '#e3ddd0');
    cyl(0.25, 0.25, 8.2, 9, 0.21, '#ffffff', '#ece6da');
    PLANT(k, 0.25, 0.25, t, 0, 9);
  },
};
