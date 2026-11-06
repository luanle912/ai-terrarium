import './pantry-lounge.js';
import './pantry-kitchen.js';
import { I, kit } from './pantry-kit.js';
export function PLANT(k, x, y, t, kind, z = 10) {
  const { R, P, blob } = k;
  const [bx, by] = P(x, y, z),
    sw = Math.round(Math.sin(t * 1.1 + y * 2) * 0.6);
  if (kind === 0) {
    [
      [-6, -6, 5],
      [5, -8, 5],
      [0, -14, 5],
      [7, -2, 4],
      [-7, -1, 4],
      [-2, -9, 4],
      [2, -4, 4],
    ].forEach(([dx, dy, r], i) => {
      const cx = bx + dx + sw,
        cy = by + dy;
      blob(cx, cy, r, i % 2 ? '#2e8556' : '#3fa36b');
      R(cx - 0.5, cy - r + 2, 1, r * 2 - 3, '#25704a');
      R(cx + 1, cy - 1, 2, 1, '#25704a');
      R(cx - 3, cy + 1, 2, 1, '#25704a');
      R(cx - r + 2, cy - 2, 2, 1, '#5cc187');
      if (i % 3 === 0) R(cx + r - 2, cy, 1, 1, '#0f2a1a');
    });
  } else {
    [
      [-4, 20],
      [-2, 26],
      [0, 23],
      [2, 28],
      [4, 19],
      [-1, 15],
      [3, 14],
      [-5, 13],
      [5, 12],
    ].forEach(([dx, h], i) => {
      const s2 = Math.round(Math.sin(t * 1.4 + i + y) * 0.5);
      for (let q = 0; q < h; q++) {
        const w = q > h - 3 ? 1 : 2,
          xo = Math.round(s2 * (q / h));
        R(bx + dx + xo, by - q, w, 1, q % 4 === 0 ? '#6fae5f' : '#3f7d4a');
      }
      R(bx + dx - 1, by - Math.round(h * 0.7), 1, Math.round(h * 0.5), '#c9c25a');
    });
  }
}
const ORDER = [
  'fridge',
  'cabinet',
  'espresso',
  'grinder',
  'sink',
  'microwave',
  'drinkfridge',
  'wallcab',
  'neon',
  'island',
  'stool',
  'pendant',
  'sofa',
  'coffeetable',
  'armchair',
  'floorlamp',
  'rug',
  'booth',
  'cafetable',
  'arcade',
  'foosball',
  'planter',
  'potplant',
];
const LAYOUT = [
  ['rug', 2.3, 5.35, 0],
  ['planter', 0, 1.1, 0],
  ['planter', 0, 3.4, 0],
  ['wallcab', 1.45, 0, 0],
  ['neon', 3.6, 0, 0],
  ['fridge', 0.45, 0.05, 0],
  ['cabinet', 1.35, 0.05, 0],
  ['cabinet', 3.15, 0.05, 0],
  ['drinkfridge', 4.95, 0.05, 0],
  ['espresso', 1.5, 0.12, 14],
  ['grinder', 2.25, 0.18, 14],
  ['sink', 3.2, 0.12, 14],
  ['microwave', 4.65, 0.12, 14],
  ['island', 1.55, 2.4, 0],
  ['pendant', 2.1, 2.65, 0],
  ['pendant', 3.9, 2.65, 0],
  ['stool', 1.9, 3.75, 0],
  ['stool', 2.7, 3.75, 0],
  ['stool', 3.5, 3.75, 0],
  ['stool', 4.3, 3.75, 0],
  ['floorlamp', 2.0, 5.55, 0],
  ['sofa', 2.6, 5.55, 0],
  ['planter', 0, 8.1, 0],
  ['coffeetable', 3.2, 7.0, 0],
  ['armchair', 5.8, 6.8, 0],
  ['planter', 0, 10.6, 0],
  ['booth', 0.56, 9.5, 0],
  ['cafetable', 1.25, 9.85, 0],
  ['cafetable', 1.25, 11.05, 0],
  ['cafetable', 1.25, 12.25, 0],
  ['potplant', 0.03, 13.3, 0],
  ['arcade', 4.8, 9.6, 0],
  ['arcade', 5.7, 9.6, 0],
  ['foosball', 4.4, 11.75, 0],
  ['potplant', 3.75, 13.3, 0],
];
// Depth keys (island tiles; the pantry starts at x=20) for each LAYOUT entry, sorted with the rest of the scene.
// Flat rugs go first, then the wall band (19.5..19.6) ordered along the wall: a piece further along x is nearer the
// viewer, so the wall cabinet covers the edge of the fridge to its left instead of tying with it. Floor pieces sort
// by their near corner; a counter-top piece (rz>0) also sorts just after every base unit under it, so the microwave
// straddling the cabinet and the drinks cooler sits on the cooler's top instead of under it.
function depths(layout) {
  const base = layout.map(([n, rx, ry]) => {
    const it = I[n];
    if (!it) return 0;
    if (it.flat) return 19;
    if (it.wall) return 19.5 + rx * 0.01;
    if (n === 'planter') return 20 + ry * 0.01;
    return 20 + rx + ry;
  });
  return layout.map(([n, rx, ry, rz], i) => {
    const it = I[n];
    if (!it || !(rz > 0)) return base[i];
    const [w, h] = it.size;
    let z = base[i];
    layout.forEach(([m, bx, by, bz], j) => {
      const b = I[m];
      if (!b || bz || b.flat || b.wall || m === 'planter') return;
      const [bw, bh] = b.size;
      if (rx < bx + bw && bx < rx + w && ry < by + bh && by < ry + h) z = Math.max(z, base[j] + 0.01);
    });
    return z;
  });
}
export const PantryItems = { I, kit, PLANT, LAYOUT, ORDER, depths };
