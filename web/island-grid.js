// Grid helpers shared by the island's land (web/island-land.js) and its lake (web/island-lake.js): cell keys, the
// four neighbours, per-cell noise and the water level. web/island-land.js re-exports them for the drawing code.
export const key = (x, y) => x + ',' + y;
export const pos = k => k.split(',').map(Number);
export const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
// Per-cell noise from the cell position alone, so the island looks the same on every machine.
export const hash = (x, y, s) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
};
// The lake's and the pool's water surface sits this far below the grass (px).
export const WATER_Z = -3;
