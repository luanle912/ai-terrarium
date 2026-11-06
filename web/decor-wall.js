// Wall pieces of the office: windows, clock, EXIT sign, posters, doors and the rug, registered into F.
import { F, mix, mount, text3 } from './decor-kit.js';
export function windowDraw(g, night, t) {
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
export function clockDraw(g) {
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
export function exitDraw(g, t) {
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
export function posterDraw(g) {
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
export function doorDraw(g) {
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
