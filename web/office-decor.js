// Office Decor — detailed furniture rendering from design system

import './decor-wall.js';
import './decor-furniture.js';
import { BH, BW, boardSurface, drawUsageBoard, fmtReset } from './decor-boards.js';
import { F, dyOf, kit, mix, mount, shade, skewRect, surf, text3, wallPen } from './decor-kit.js';
import { clockDraw, doorDraw, exitDraw, posterDraw, windowDraw } from './decor-wall.js';
export function SCREEN(K, t, mode) {
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
