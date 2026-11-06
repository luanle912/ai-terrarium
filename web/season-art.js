// Pixel helpers for the event trees: rectangles, triangles, blobs, hearts and stars, the Tet and mid-autumn palettes
// and date helpers.
export const R = (ctx, x, y, w, h, c) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};
export const tri = (ctx, cx, by, w, h, c, cd) => {
  for (let r = 0; r < h; r++) {
    const rw = Math.max(1, Math.round(w * (1 - r / h)));
    const hl = Math.ceil(rw / 2);
    R(ctx, cx - hl, by - r, hl, 1, c);
    R(ctx, cx, by - r, hl, 1, cd);
  }
};
export const blob = (ctx, cx, cy, r, c) => {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy)) * 2;
    R(ctx, cx - w / 2, cy + dy, w, 1, c);
  }
};
export const pat = (ctx, x, y, rows, c) =>
  rows.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      if (ch === '#') R(ctx, x + rx, y + ry, 1, 1, c);
    }),
  );
export const heart = (ctx, cx, cy, s, c) => {
  blob(ctx, cx - s, cy, s, c);
  blob(ctx, cx + s, cy, s, c);
  for (let r = 0; r <= s * 2; r++) {
    const w = Math.max(1, Math.round((s * 2 + 1) * 2 * (1 - r / (s * 2 + 1))));
    R(ctx, cx - w / 2, cy + 1 + r, w, 1, c);
  }
};
export const tinyHeart = (ctx, x, y, c) => pat(ctx, x, y, ['#.#', '###', '.#.'], c);
export const STAR5 = ['..#..', '#####', '.###.', '.#.#.'];
export const TET = {
  2026: '2026-02-17',
  2027: '2027-02-06',
  2028: '2028-01-26',
  2029: '2029-02-13',
  2030: '2030-02-03',
  2031: '2031-01-23',
};
export const MID = {
  2026: '2026-09-25',
  2027: '2027-09-15',
  2028: '2028-10-03',
  2029: '2029-09-22',
  2030: '2030-09-12',
  2031: '2031-10-01',
};
export const DAY = 86400000,
  at = iso => (iso ? new Date(iso + 'T00:00:00').getTime() : null);

export const D = {};
export const pot = (ctx, bx, by, c, band) => {
  R(ctx, bx - 6, by - 6, 12, 6, c);
  R(ctx, bx - 7, by - 7, 14, 2, band || c);
  R(ctx, bx + 2, by - 6, 4, 6, 'rgba(0,0,0,0.18)');
};
