// Pantry kitchen pieces registered into I: fridge, cabinets, espresso machine, grinder, sink, microwave, drinks fridge,
// wall cabinet, neon sign, island, stools and pendant lights.
import { I, shade } from './pantry-kit.js';
I.fridge = {
  name: 'Tủ lạnh 2 cánh',
  group: 'Bếp',
  size: [0.82, 0.76],
  wall: true,
  note: 'Inox 2 tông',
  // o.use (0..1, web/prop-use.js): the displays light and the opened door casts cold light only while someone is at it
  draw(k, t, o) {
    const { ctx, box, fL, fR, top, R, P, al, fade } = k,
      u = (o && o.use) || 0;
    box(0.04, 0.04, 0.74, 0.68, 0, 1.6, '#22252f');
    for (let i = 0; i < 6; i++) fL(0.1 + i * 0.1, 0.16 + i * 0.1, 0.72, 0.4, 1.2, '#3a3f52');
    box(0, 0, 0.82, 0.76, 1.6, 44, '#e9edf3', '#d3d9e2', '#b6bfcc');
    for (let z = 4; z < 44; z += 6) al(0.35, () => fL(0, 0.82, 0.76, z, z + 1, '#ffffff'));
    fL(0, 0.82, 0.76, 28.4, 29, '#8f9ab0');
    fR(0.82, 0, 0.76, 28.4, 29, '#7d889e');
    box(0.66, 0.76, 0.05, 0.04, 30.5, 40, '#c9d3e3', '#aab4c6', '#8f9ab0');
    box(0.66, 0.76, 0.05, 0.04, 12, 26, '#c9d3e3', '#aab4c6', '#8f9ab0');
    fL(0.12, 0.36, 0.76, 32, 39, '#3a3f52');
    fL(0.15, 0.33, 0.76, 33, 36, '#1f2230');
    fL(0.2, 0.28, 0.76, 36.5, 37.5, '#1f3a4a');
    if (u > 0) {
      const g = fade(u);
      fL(0.2, 0.28, 0.76, 36.5, 37.5, '#5ec8ff');
      ctx.globalAlpha = g;
    }
    fL(0.12, 0.34, 0.76, 14, 22, '#ffd166');
    [20.5, 18.5, 16.5].forEach(z => fL(0.15, 0.31, 0.76, z, z + 0.6, '#c9a227'));
    fL(0.21, 0.25, 0.76, 21.2, 22, '#e5484d');
    fL(0.38, 0.58, 0.76, 15, 21, '#ffffff');
    fL(0.4, 0.56, 0.76, 16, 20, '#1f2a3a');
    fL(0.4, 0.56, 0.76, 16, 17.4, '#1f3a26');
    if (u > 0) {
      const g = fade(u);
      fL(0.4, 0.56, 0.76, 16, 20, '#5ec8ff');
      fL(0.4, 0.56, 0.76, 16, 17.4, '#46a758');
      ctx.globalAlpha = g;
    }
    [
      [0.42, 24, '#e5484d'],
      [0.5, 9, '#3e8ed0'],
      [0.2, 10, '#8e4ec6'],
      [0.48, 34, '#ffd166'],
    ].forEach(([x, z, c]) => fL(x, x + 0.05, 0.76, z, z + 2, c));
    box(0.12, 0.12, 0.3, 0.22, 44, 52, '#e5484d', '#c0392b', '#9e2a20');
    fL(0.14, 0.4, 0.34, 46, 50, '#ffd166');
    box(0.48, 0.2, 0.22, 0.3, 44, 48, '#f6f4ee');
    if (u > 0) {
      const g = fade(0.6 * u);
      fL(0.7, 0.8, 0.76, 1.8, 28, '#e8f6ff');
      ctx.globalAlpha = g * 0.22 * u;
      top(0.08, 0.76, 0.7, 0.3, 0.1, '#cfefff');
      ctx.globalAlpha = g;
    }
  },
};
I.cabinet = {
  name: 'Tủ bếp dưới',
  group: 'Bếp',
  size: [1.8, 0.8],
  note: 'Module 60cm',
  draw(k, t) {
    const { box, fL, fR, top, R, P } = k,
      wd = '#a8763e';
    box(0.04, 0.06, 1.72, 0.7, 0, 2, '#2d1c10');
    box(0, 0.02, 1.8, 0.74, 2, 12.5, wd, '#8a5f30', '#74501f');
    for (let i = 0; i < 3; i++) {
      const x = i * 0.6;
      fL(x + 0.04, x + 0.56, 0.76, 3, 11.6, shade(wd, 10));
      fL(x + 0.08, x + 0.52, 0.76, 4, 10.6, shade(wd, -10));
      fL(x + 0.1, x + 0.5, 0.76, 4.4, 10.2, shade(wd, 4));
      fL(x + 0.43, x + 0.47, 0.76, 8.6, 9.6, '#e0b23a');
      fL(x + 0.43, x + 0.45, 0.76, 9.2, 9.6, '#fff3b0');
    }
    box(-0.03, 0, 1.86, 0.82, 12.5, 14, '#efe9dc', '#d6cfbf', '#bfb7a6');
    fL(-0.03, 1.83, 0.82, 13.4, 14, '#fbf8f1');
    [
      [0.3, 0.3],
      [1.2, 0.5],
    ].forEach(([x, y]) => top(x, y, 0.3, 0.02, 14.01, '#e2dbcb'));
  },
};
I.espresso = {
  name: 'Máy espresso',
  group: 'Bếp',
  size: [0.7, 0.55],
  note: 'Thân đen bo',
  // o.use: pouring, steam and the blinking brew light only while someone makes coffee
  draw(k, t, o) {
    const { box, fL, fR, top, R, P, ell, cyl, al } = k,
      u = (o && o.use) || 0;
    top(-0.1, -0.05, 0.9, 0.7, 0.02, '#efe9dc');
    box(0.02, 0.02, 0.66, 0.5, 0, 14, '#1f2230', '#2a2e3d', '#14161c');
    box(0.02, 0.02, 0.66, 0.5, 14, 15, '#c9d3e3', '#aab4c6', '#8f9ab0');
    for (let i = 0; i < 5; i++) top(0.06 + i * 0.12, 0.06, 0.06, 0.42, 15.05, '#aab4c6');
    cyl(0.2, 0.25, 15, 17.2, 0.06, '#ffffff', '#e6e9ef');
    cyl(0.45, 0.28, 15, 17.2, 0.06, '#e5484d', '#c0392b');
    {
      const [gx, gy] = P(0.52, 0.52, 10.5);
      ell(gx, gy, 3, 3, '#e6e9ef');
      ell(gx, gy, 2.2, 2.2, '#ffffff');
      R(gx, gy - 2, 1, 2, '#e5484d');
    }
    fL(0.06, 0.64, 0.52, 11.5, 12.2, '#3a3f52');
    {
      const [lx, ly] = P(0.12, 0.52, 12);
      R(lx, ly - 1, 1, 1, u > 0.5 ? '#46a758' : '#24452a');
      const [mx, my] = P(0.2, 0.52, 12);
      R(mx, my - 1, 1, 1, u > 0.5 && Math.floor(t * 2) % 2 ? '#ffd166' : '#5a4a12');
    }
    box(0.22, 0.52, 0.2, 0.08, 7.5, 9.5, '#8f9ab0', '#aab4c6', '#6b768c');
    box(0.2, 0.58, 0.24, 0.06, 6.6, 7.5, '#3a3f52');
    box(0.28, 0.64, 0.06, 0.18, 6.8, 7.6, '#14161c');
    box(0.14, 0.52, 0.48, 0.14, 0, 1.6, '#3a3f52');
    for (let i = 0; i < 5; i++) top(0.17 + i * 0.09, 0.55, 0.04, 0.08, 1.62, '#14161c');
    cyl(0.32, 0.6, 1.6, 4.2, 0.06, '#ffffff', '#e6e9ef');
    {
      const [cx, cy] = P(0.32, 0.6, 4.2);
      ell(cx, cy, 1.2, 0.6, '#6b3e24');
    }
    if (u > 0.5 && Math.floor(t) % 5 < 3) {
      const [sx, sy] = P(0.32, 0.58, 6.6);
      R(sx, sy, 1, 2.4, '#6b3e24');
    }
    box(0.6, 0.4, 0.04, 0.04, 4, 11, '#c9d3e3');
    box(0.6, 0.4, 0.04, 0.12, 10, 11, '#c9d3e3');
    if (u > 0)
      for (let q = 0; q < 3; q++) {
        const p = (t * 0.6 + q * 0.33) % 1,
          [sx, sy] = P(0.2, 0.25, 18 + p * 10);
        al(0.6 * (1 - p) * u, () => R(sx + (q % 2), sy, 1, 2, '#e6e9ef'));
      }
  },
};
I.grinder = {
  name: 'Máy xay & cốc',
  group: 'Bếp',
  size: [0.9, 0.45],
  note: 'Máy xay đế nâu',
  // o.use: the power light is on and the beans in the hopper shake only while it grinds
  draw(k, t, o) {
    const { box, fL, top, R, P, cyl, al } = k,
      u = (o && o.use) || 0,
      j = u > 0.5 ? Math.floor(t * 12) % 2 : 0;
    top(-0.05, -0.05, 1.0, 0.55, 0.02, '#efe9dc');
    box(0.02, 0.08, 0.28, 0.28, 0, 7, '#5c3a22', '#4a2e1b', '#3a2214');
    fL(0.06, 0.26, 0.36, 2, 4, '#2d1c10');
    {
      const [bx, by] = P(0.2, 0.36, 5);
      R(bx, by, 1, 1, u > 0.5 ? '#e5484d' : '#5a1a1d');
    }
    box(0.07, 0.12, 0.18, 0.18, 7, 8.5, '#c9d3e3');
    al(0.85, () => box(0.05, 0.1, 0.22, 0.22, 8.5, 15, '#cfe8ff', '#a9d3f5', '#8fbfe6'));
    box(0.06, 0.11, 0.2, 0.2, 8.5, 12.5, '#6b3e24', '#5c3420', '#4a2a19');
    for (let i = 0; i < 9; i++) {
      const [px, py] = P(0.08 + (i % 3) * 0.06, 0.14 + Math.floor(i / 3) * 0.05, 12.5);
      R(px + ((i + j) % 2) * j, py - j, 1, 1, '#8a5a3a');
    }
    box(0.04, 0.09, 0.24, 0.24, 15, 16.5, '#1f2230');
    [0, 1, 2, 3].forEach(i => cyl(0.5, 0.25, i * 1.7, 1.5 + i * 1.7, 0.075, '#ffffff', '#e6e9ef'));
    cyl(0.75, 0.22, 0, 6, 0.09, '#e9f6ff', '#cfe3f5');
    [
      [0.72, 2],
      [0.78, 3.5],
      [0.74, 1],
    ].forEach(([x, z]) => {
      const [px, py] = P(x, 0.25, z);
      R(px, py, 2, 1, '#c98a4e');
    });
    cyl(0.75, 0.22, 6, 7, 0.095, '#a8763e', '#8a5f30');
  },
};
I.sink = {
  name: 'Bồn rửa & giá úp',
  group: 'Bếp',
  size: [1.3, 0.6],
  note: 'Bồn inox lõm',
  // o.use: water runs from the tap into the basin only while someone fills a glass; otherwise the tap is dry
  draw(k, t, o) {
    const { ctx, box, fL, fR, top, R, P, cyl, al, fade, line } = k,
      u = (o && o.use) || 0;
    top(-0.05, -0.05, 1.4, 0.7, 0.02, '#efe9dc');
    top(0.05, 0.08, 0.8, 0.46, 0.03, '#aab4c6');
    top(0.1, 0.13, 0.7, 0.36, 0.04, '#6b768c');
    fL(0.1, 0.8, 0.13, -3, 0.04, '#8f9ab0');
    fR(0.1, 0.13, 0.49, -3, 0.04, '#7d889e');
    top(0.12, 0.15, 0.66, 0.32, -2.5, '#5d6578');
    {
      const [dx, dy] = P(0.45, 0.31, -2.5);
      R(dx - 1, dy - 1, 2, 2, '#2d3142');
    }
    box(0.42, 0.0, 0.07, 0.07, 0, 6, '#c9d3e3');
    {
      const [a, b] = [P(0.455, 0.035, 6), P(0.455, 0.3, 9)];
      line(a, [a[0], a[1] - 4], '#c9d3e3', 2);
      line([a[0], a[1] - 4], [b[0], b[1]], '#c9d3e3', 2);
    }
    box(0.52, 0.02, 0.04, 0.12, 5, 5.8, '#c9d3e3');
    if (u > 0) {
      const [sx, sy] = P(0.455, 0.3, 8.5),
        h = 11;
      const g = fade(0.8 * u),
        sp = Math.floor(t * 8) % 2;
      R(sx, sy, 1, h, '#9fd3ff');
      for (let q = 0; q < 3; q++) R(sx, sy + Math.floor(((t * 3 + q / 3) % 1) * h), 1, 1, '#e8f6ff');
      R(sx - 1 - sp, sy + h - 1, 3 + 2 * sp, 1, '#cfe8ff');
      ctx.globalAlpha = g;
    }
    cyl(0.2, 0.08, 0, 4, 0.05, '#46a758', '#3f9a42');
    box(0.18, 0.06, 0.04, 0.04, 4, 5.5, '#ffffff');
    box(0.92, 0.1, 0.34, 0.42, 0, 1, '#c9d3e3');
    [0.16, 0.28, 0.4].forEach(y => {
      fR(1.0, y, y + 0.02, 1, 8, '#ffffff');
      fR(1.0, y - 0.02, y, 1, 8, '#e6e9ef');
    });
    [0.95, 1.22].forEach(x => fR(x, 0.1, 0.52, 1, 3, '#aab4c6'));
    cyl(1.16, 0.24, 1, 3.2, 0.05, '#5b8def', '#3e8ed0');
    cyl(1.16, 0.4, 1, 3.2, 0.05, '#ffffff', '#e6e9ef');
  },
};
I.microwave = {
  name: 'Lò vi sóng',
  group: 'Bếp',
  size: [0.95, 0.6],
  note: 'Cửa kính tối',
  // o.use: lit inside with the plate turning only while someone heats food; otherwise dark (the clock stays on)
  draw(k, t, o) {
    const { ctx, box, fL, fR, top, R, P, al, fade, ell } = k,
      u = (o && o.use) || 0;
    top(-0.05, -0.05, 1.05, 0.7, 0.02, '#efe9dc');
    box(0, 0, 0.95, 0.6, 0, 8, '#1f2230', '#2a2e3d', '#14161c');
    box(0, 0, 0.95, 0.6, 8, 8.6, '#3a3f52');
    fL(0.05, 0.66, 0.6, 1, 7.3, '#14161c');
    fL(0.08, 0.63, 0.6, 1.6, 6.8, '#1a2030');
    if (u > 0) {
      const a = t * 1.5,
        [cx, cy] = P(0.35, 0.6, 3);
      const g = fade(u);
      fL(0.08, 0.63, 0.6, 1.6, 6.8, '#5a4a20');
      ctx.globalAlpha = g;
      al(0.9 * u, () => {
        ell(cx, cy, 5, 1.6, '#e6d7a8');
        R(cx - 3 + Math.round(Math.cos(a) * 2), cy - 3, 6, 2, '#ffffff');
        R(cx - 2 + Math.round(Math.cos(a) * 2), cy - 4, 4, 1, '#ffd166');
      });
    }
    al(0.25, () => fL(0.1, 0.2, 0.6, 2, 6.6, '#ffffff'));
    fL(0.7, 0.9, 0.6, 1, 7.3, '#2a2e3d');
    fL(0.72, 0.88, 0.6, 5.6, 6.8, '#06120b');
    {
      const d = new Date(),
        s = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
      [...s].forEach((ch, i) => {
        const [px, py] = P(0.735 + i * 0.035, 0.6, 6.6);
        R(px, py, 1, 1, '#50fa7b');
      });
    }
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) fL(0.73 + c * 0.05, 0.76 + c * 0.05, 0.6, 4.4 - r * 1.1, 4.9 - r * 1.1, '#8b93a7');
    fL(0.73, 0.87, 0.6, 1.2, 1.8, '#c9d3e3');
  },
};
I.drinkfridge = {
  name: 'Tủ mát đồ uống',
  group: 'Bếp',
  size: [1.0, 0.8],
  note: 'Tủ mát âm dưới mặt bếp',
  // o.use: the cooler's light is on only while someone picks a drink; otherwise the bottles sit in the dark
  draw(k, t, o) {
    const { ctx, box, fL, fR, top, R, P, al, fade } = k,
      u = (o && o.use) || 0;
    box(0, 0.02, 1.0, 0.74, 0, 12.5, '#2a2e3d', '#2a2e3d', '#1f2230');
    fL(0.04, 0.96, 0.76, 1.2, 11.6, '#3a3f52');
    fL(0.08, 0.92, 0.76, 1.8, 11, '#0f1a2a');
    const cs = ['#e5484d', '#ffd166', '#5ec8ff', '#46a758', '#ff8b3d', '#ffffff', '#8e4ec6', '#e93d82'];
    [
      [2.2, 0],
      [6.6, 4],
    ].forEach(([z, o]) => {
      fL(0.08, 0.92, 0.76, z - 0.5, z, '#8b93a7');
      for (let i = 0; i < 7; i++) {
        const x = 0.12 + i * 0.115,
          c = cs[(i + o) % 8],
          h = i % 3 === 2 ? 4.2 : 3.4;
        fL(x, x + 0.085, 0.76, z, z + h, c);
        fL(x, x + 0.085, 0.76, z + h - 0.6, z + h, shade(c, 40));
        fL(x + 0.01, x + 0.03, 0.76, z + 0.4, z + h - 1, shade(c, 30));
      }
    });
    {
      const g = fade(0.6 * (1 - u));
      fL(0.08, 0.92, 0.76, 1.8, 11, '#05080f');
      ctx.globalAlpha = g * 0.3 * u;
      fL(0.08, 0.92, 0.76, 10.4, 11, '#9fe7ff');
      ctx.globalAlpha = g * (0.12 + 0.04 * Math.sin(t * 2)) * u;
      fL(0.08, 0.92, 0.76, 1.8, 11, '#9fe7ff');
      ctx.globalAlpha = g;
    }
    al(0.18, () => {
      for (let i = 0; i < 5; i++) fL(0.15 + i * 0.02, 0.2 + i * 0.02, 0.76, 3 + i * 1.6, 4 + i * 1.6, '#ffffff');
    });
    fL(0.86, 0.9, 0.76, 4, 9, '#c9d3e3');
    box(-0.03, 0, 1.06, 0.82, 12.5, 14, '#efe9dc', '#d6cfbf', '#bfb7a6');
  },
};
I.wallcab = {
  name: 'Tủ treo tường',
  group: 'Bếp',
  size: [2.0, 0.42],
  wall: true,
  wallZ: 52,
  note: 'Tủ gỗ treo cao',
  draw(k, t, o) {
    const { box, fL, fR, top, R, P, al } = k,
      wd = '#8a5a3a';
    if (o.night) al(0.35, () => fL(0, 2, 0.01, 22, 37.5, '#ffd166'));
    box(0, 0, 2, 0.42, 38, 50, wd, '#74501f', '#5c3e1a');
    for (let i = 0; i < 4; i++) {
      const x = i * 0.5;
      fL(x + 0.03, x + 0.47, 0.42, 39, 49, shade(wd, 12));
      fL(x + 0.07, x + 0.43, 0.42, 40, 48, shade(wd, -4));
      fL(i % 2 ? x + 0.08 : x + 0.38, i % 2 ? x + 0.12 : x + 0.42, 0.42, 40.5, 44, '#e0b23a');
    }
    box(-0.03, 0, 2.06, 0.45, 50, 51.5, shade(wd, 22));
    fL(0, 2, 0.42, 37.4, 38, '#ffd166');
  },
};
I.neon = {
  name: 'Biển neon CAFE',
  group: 'Bếp',
  size: [2.9, 0.3],
  wall: true,
  wallZ: 58,
  note: 'Tấm nền đen bắt vít',
  draw(k, t, o) {
    const { box, fL, top, R, P, al, wallText } = k,
      neon = '#ff5fa2',
      on = Math.floor(t * 1.3) % 11 !== 0;
    if (on && o.night) al(0.2, () => fL(-0.2, 3.1, 0.0, 36, 56, neon));
    box(0.05, 0, 2.8, 0.05, 40, 52, '#1f2230', '#171922', '#14161c');
    [
      [0.1, 51],
      [2.78, 51],
      [0.1, 41],
      [2.78, 41],
    ].forEach(([x, z]) => {
      const [px, py] = P(x, 0.05, z);
      R(px, py, 1, 1, '#8b93a7');
    });
    wallText('CAFE', 0.25, 50, on ? neon : '#5a2340', 2, 0.05);
    {
      const [cx, cy] = P(2.5, 0.05, 47);
      R(cx - 2, cy - 2, 5, 4, on ? neon : '#5a2340');
      R(cx + 3, cy - 1, 1, 2, on ? neon : '#5a2340');
      if (on) {
        R(cx - 1, cy - 4, 1, 2, '#ffe0ee');
        R(cx + 1, cy - 5, 1, 2, '#ffe0ee');
      }
    }
    box(0.1, 0, 2.7, 0.3, 32.5, 34, '#8a5a3a');
    [
      [0.25, '#f6f4ee', 5.5],
      [0.75, '#e5484d', 4],
      [1.25, '#f6f4ee', 5.5],
      [1.75, '#ffd166', 4],
      [2.25, '#46a758', 5],
    ].forEach(([x, c, h]) => box(x, 0.07, 0.15, 0.15, 34, 34 + h, c));
  },
};
I.island = {
  name: 'Đảo quầy bar',
  group: 'Quầy bar',
  size: [3.5, 0.95],
  note: 'Thân xanh xám',
  // o.use: the tablet at the end of the bar lights only while someone sits at the bar
  draw(k, t, o) {
    const { ctx, box, fL, fR, top, R, P, ell, cyl, al, fade, line } = k,
      u = (o && o.use) || 0;
    box(0.08, 0.08, 3.34, 0.8, 0, 1.5, '#2d3142');
    box(0.1, 0.1, 3.3, 0.75, 1.5, 13, '#5a6f86', '#4b5e74', '#3e4f62');
    for (let x = 0.3; x < 3.3; x += 0.3) fL(x, x + 0.03, 0.85, 2.2, 12.4, '#41546a');
    box(0, 0, 3.5, 0.95, 13, 15, '#f6f4ee', '#dcd6c9', '#c4bdae');
    fL(0, 3.5, 0.95, 14.4, 15, '#ffffff');
    [
      [0.4, 0.2, 1.2, 0.6],
      [1.8, 0.7, 2.9, 0.3],
      [2.2, 0.15, 3.2, 0.5],
    ].forEach(([a, b, c, d]) => line(P(a, b, 15), P(c, d, 15), '#d9d3c6'));
    {
      const [px, py] = P(0.55, 0.45, 15);
      ell(px, py, 8, 4, '#e6e9ef');
      ell(px, py - 1, 7, 3.2, '#ffffff');
      [
        [-4, -3, '#e5484d'],
        [-1, -4, '#ffd166'],
        [2, -3, '#46a758'],
        [0, -1, '#ff8b3d'],
        [4, -2, '#8e4ec6'],
        [-3, -1, '#ffd166'],
      ].forEach(([dx, dy, c]) => {
        R(px + dx, py + dy - 1, 3, 3, c);
        R(px + dx, py + dy - 1, 1, 1, shade(c, 50));
      });
      R(px + 1, py - 6, 1, 2, '#6b3e24');
    }
    cyl(1.45, 0.45, 15, 16.5, 0.03, '#c9d3e3');
    {
      const [px, py] = P(1.45, 0.45, 16.5);
      ell(px, py, 7, 3.5, '#ffffff');
      R(px - 4, py - 4, 4, 3, '#f2c9a0');
      R(px, py - 3, 4, 2, '#a86b45');
      R(px - 4, py - 5, 4, 1, '#ffffff');
      R(px + 1, py - 4, 2, 1, '#e5484d');
      al(0.4, () => {
        ell(px, py - 4, 8, 6, '#cfe8ff');
      });
      R(px - 1, py - 11, 2, 1, '#c9d3e3');
    }
    box(2.3, 0.35, 0.22, 0.16, 15, 17, '#f6f4ee');
    box(2.35, 0.38, 0.12, 0.1, 17, 18.5, '#ffffff');
    cyl(2.9, 0.5, 15, 18, 0.05, '#ffffff', '#e6e9ef');
    {
      const [cx, cy] = P(2.9, 0.5, 18);
      ell(cx, cy, 1.2, 0.6, '#6b3e24');
    }
    box(3.1, 0.35, 0.2, 0.3, 15, 15.6, '#2d3142');
    top(3.12, 0.37, 0.16, 0.26, 15.62, '#1f2230');
    if (u > 0) {
      const g = fade(u);
      top(3.12, 0.37, 0.16, 0.26, 15.62, '#5ec8ff');
      ctx.globalAlpha = g;
    }
  },
};
I.stool = {
  name: 'Ghế bar',
  group: 'Quầy bar',
  size: [0.4, 0.4],
  note: 'Đế tròn đen',
  draw(k, t) {
    const { cyl, P, ctx, ell, R } = k;
    cyl(0.2, 0.2, 0, 1, 0.15, '#2d3142', '#1f2230');
    cyl(0.2, 0.2, 1, 10, 0.035, '#e0b23a', '#c9a227');
    {
      const [fx, fy] = P(0.2, 0.2, 4.5);
      ctx.strokeStyle = '#c9a227';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 4, 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    cyl(0.2, 0.2, 10, 12, 0.18, '#2d3142', '#20232d');
    {
      const [sx, sy] = P(0.2, 0.2, 12);
      ctx.strokeStyle = '#4a5066';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 3.2, 1.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      R(sx - 3, sy - 1, 2, 1, '#5d6578');
    }
  },
};
I.pendant = {
  name: 'Đèn thả',
  group: 'Quầy bar',
  size: [0.4, 0.4],
  note: 'Đế ốp trần',
  draw(k, t, o) {
    const { P, R, ctx, al, ell } = k;
    const [cx, cy] = P(0.2, 0.2, 64),
      [lx, ly] = P(0.2, 0.2, 32);
    R(cx - 3, cy - 1, 6, 2, '#2d3142');
    ctx.strokeStyle = '#14161c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 0.25, cy);
    ctx.lineTo(lx + 0.25, ly - 3);
    ctx.stroke();
    if (o.night)
      al(0.22, () => {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.moveTo(lx - 5, ly + 3);
        ctx.lineTo(lx + 5, ly + 3);
        ctx.lineTo(lx + 16, ly + 24);
        ctx.lineTo(lx - 16, ly + 24);
        ctx.closePath();
        ctx.fill();
      });
    R(lx - 1, ly - 4, 2, 2, '#c9a227');
    ell(lx, ly + 1, 6, 4, '#c9a227');
    R(lx - 6, ly + 1, 12, 3, '#c9a227');
    R(lx - 6, ly + 3, 12, 1, '#e0b23a');
    R(lx - 4, ly - 2, 3, 2, '#fff3b0');
    ell(lx, ly + 4, 3, 1.2, o.night ? '#fffbe0' : '#f2ead9');
  },
};
