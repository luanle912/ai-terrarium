// Office furniture registered into F: desks and chairs, bookshelves, coffee corner, fridge, cooler, vending machine, tables, glass partitions and plants.
import { SCREEN } from './office-decor.js';
import { F, shade, text3, wallPen } from './decor-kit.js';
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
export const BOOKS = [
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
