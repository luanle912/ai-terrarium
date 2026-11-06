// Pixel sprites for the 14 catchable animals, in the same format as dog-sprites: drawn facing right (the page
// mirrors them), one palette letter per pixel ('.' is empty), bottom row = feet on the lawn, `ax` = the column under
// the animal's middle. A frame may be {from, set} where each [x, y, s] writes the string s starting at (x, y).
// The pixels live in one file per tier (animal-sprites-<tier>.js), merged here in the order of spec 3.2.
import { COMMON_SPRITES } from './animal-sprites-common.js';
import { RARE_SPRITES } from './animal-sprites-rare.js';
import { EPIC_SPRITES } from './animal-sprites-epic.js';
import { LEGENDARY_SPRITES } from './animal-sprites-legendary.js';

const SPECIES = { ...COMMON_SPRITES, ...RARE_SPRITES, ...EPIC_SPRITES, ...LEGENDARY_SPRITES };
const cache = new Map();
// Copies the source rows into a fresh grid; an out-of-range write throws instead of silently shortening a row.
function patch(rows, set, key) {
  const grid = rows.map(r => r.split(''));
  for (const [x, y, s] of set)
    [...s].forEach((c, i) => {
      if (!grid[y] || x + i < 0 || x + i >= grid[y].length)
        throw new Error('AnimalSprites: ' + key + ' writes outside the frame at ' + (x + i) + ',' + y);
      grid[y][x + i] = c;
    });
  return grid.map(r => r.join(''));
}
function frame(id, name) {
  const key = id + '/' + name;
  if (cache.has(key)) return cache.get(key);
  const S = SPECIES[id];
  if (!S) throw new Error('AnimalSprites: unknown species ' + id);
  const src0 = S.frames[name];
  if (!src0) throw new Error('AnimalSprites: ' + id + ' has no frame ' + name);
  const src = Array.isArray(src0) ? { rows: src0 } : src0,
    base = src.rows ? null : frame(id, src.from);
  const rows = Object.freeze(src.rows ? [...src.rows] : patch(base.rows, src.set || [], key));
  const ax = src.ax != null ? src.ax : base ? base.ax : S.ax;
  const f = Object.freeze({ rows, w: Math.max(...rows.map(r => r.length)), h: rows.length, ax, pal: S.pal });
  cache.set(key, f);
  return f;
}
Object.values(SPECIES).forEach(s => Object.freeze(s.pal));
const SPECIES_IDS = Object.freeze(Object.keys(SPECIES));
const frameNames = id => Object.keys(SPECIES[id].frames);

export { SPECIES_IDS, frame, frameNames };
export const AnimalSprites = { SPECIES_IDS, frame, frameNames };
