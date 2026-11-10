import { DogSprites } from './dog-sprites.js';
// What the dogs wear at Christmas, as pixels laid over each frame of web/dog-sprites.js: antlers and a red nose for
// the corgi, a red scarf for the husky, a red sweater with a white collar for the dalmatian. The pixels are worked
// out from the frame itself (its collar pixel 'c' marks the neck), so a new frame is dressed without a table; the
// few frames with no collar showing are listed by hand. No DOM, no canvas; tests/dog-sprites-xmas.test.mjs runs this.
const PAL = { r: '#c8323a', w: '#f4f1e8', b: '#8a5a3a', n: '#ff4d4d' };
// Rows kept free above a frame, for the antlers.
const PAD = 3;
// Where the two ear tips are in each corgi frame: the antlers stand on them.
const EARS = {
  stand: [9, 12, 0],
  wag: [9, 12, 0],
  run1: [9, 12, 0],
  run2: [9, 12, 0],
  sit: [6, 9, 0],
  lie: [10, 13, 0],
  sleep: [10, 13, 3],
  bow: [10, 13, 0],
  drink: [12, 14, 5],
};
// The neck where the frame shows no collar (asleep, the head tucked in): [x, y] of what would be its collar pixels.
const NECK = { 'husky/sleep': [[10, 5]], 'dalmatian/sleep': [[10, 4]] };
const full = (f, x, y) => y >= 0 && y < f.h && x >= 0 && x < f.w && f.rows[y][x] !== '.';
function collar(breed, name, f) {
  const out = [];
  f.rows.forEach((row, y) => [...row].forEach((ch, x) => ch === 'c' && out.push([x, y])));
  return out.length ? out : NECK[breed + '/' + name] || [];
}
const MAKE = {
  // The black nose (the black pixel furthest forward) turns red; an antler of three pixels and a tine on each ear.
  corgi(name, f) {
    const out = [],
      e = EARS[name];
    let nose = null;
    f.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === 'k' && (!nose || x > nose[0])) nose = [x, y];
      }),
    );
    if (nose) out.push([nose[0], nose[1], 'n']);
    if (e)
      for (const [x, side] of [
        [e[0], -1],
        [e[1], 1],
      ]) {
        for (let k = 1; k <= 3; k++) out.push([x, e[2] - k, 'b']);
        if (x + side >= 0 && x + side < f.w) out.push([x + side, e[2] - 2, 'b']);
      }
    return out;
  },
  // The collar and the pixel behind it become the scarf; one end hangs two pixels down the chest.
  husky(name, f, neck) {
    const out = [];
    for (const [x, y] of neck) {
      out.push([x, y, 'r']);
      if (x > 0) out.push([x - 1, y, 'r']);
    }
    const [lx, ly] = neck.reduce((a, b) => (b[1] > a[1] ? b : a));
    for (let k = 1; k <= 2; k++) if (full(f, lx + 1, ly + k)) out.push([lx + 1, ly + k, 'r']);
    return out;
  },
  // Every row of the body that runs unbroken up to the neck is covered from two pixels in from the rump; the collar
  // turns white.
  dalmatian(name, f, neck) {
    const out = [],
      nx = Math.max(...neck.map(p => p[0])),
      at = new Set(neck.map(p => p[0] + ',' + p[1]));
    for (let y = 0; y < f.h; y++) {
      let x0 = nx - 1;
      while (x0 >= 0 && full(f, x0, y)) x0--;
      if (nx - 1 - x0 < 4) continue;
      for (let x = Math.max(x0 + 3, nx - 9); x < nx; x++) if (!at.has(x + ',' + y)) out.push([x, y, 'r']);
    }
    for (const [x, y] of neck) out.push([x, y, 'w']);
    return out;
  },
};
const overlays = new Map(),
  dressed = new Map(),
  pals = new Map();
// [[x, y, colourKey], ...] for a frame, y from -PAD (above the frame) to its last row; [] for an unknown breed/frame.
function overlay(breed, name) {
  const k = breed + '/' + name;
  if (!overlays.has(k)) {
    const B = DogSprites.BREEDS[breed],
      f = B && B.frames[name] && MAKE[breed] ? DogSprites.frame(breed, name) : null,
      neck = f ? collar(breed, name, f) : [];
    overlays.set(k, f && (breed === 'corgi' || neck.length) ? MAKE[breed](name, f, neck) : []);
  }
  return overlays.get(k);
}
// The overlay's colours as letters no breed's palette uses, so a dressed frame is plain rows again.
const LETTER = { r: '1', w: '2', b: '3', n: '4' };
function palFor(breed) {
  if (!pals.has(breed)) {
    const p = { ...DogSprites.BREEDS[breed].pal };
    for (const k in LETTER) p[LETTER[k]] = PAL[k];
    pals.set(breed, p);
  }
  return pals.get(breed);
}
// The frame with PAD empty rows on top and the overlay painted in: { w, h, ax, rows, pad }. Kept per frame.
function dress(breed, name, f) {
  const k = breed + '/' + name;
  if (!dressed.has(k)) {
    const rows = [...Array(PAD).fill(''), ...f.rows].map(r => [...r.padEnd(f.w, '.')]);
    for (const [x, y, c] of overlay(breed, name)) rows[y + PAD][x] = LETTER[c];
    dressed.set(k, { w: f.w, h: f.h + PAD, ax: f.ax, pad: PAD, rows: rows.map(r => r.join('')) });
  }
  return dressed.get(k);
}
export const DogXmas = { PAL, PAD, overlay, palFor, dress };
