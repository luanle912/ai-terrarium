// The cathedral's forecourt (web/island-art-cathedral.js): the white statue of Our Lady on her pedestal in a round
// bed and, from the event's second level, a thatched crib beside her. A palette layer like the cathedral's, worked
// out once per event level and snow depth; the glow on her and the manger's light are drawn every frame by
// web/office-draw-cathedral.js from yardLights().
import { STONE, paletteLayer, stamp } from './island-art.js';
import { landmarkTones, outlineLayer } from './island-art-cathedral.js';
import { SnowLogic } from './snow-logic.js';

// The sprite: [left, up, right, down] px round the bed's middle (EventLandmark.SITE.lady).
export const LADY_EXT = [18, 30, 18, 8];
const CRIB = {
  wall: '#6b4426',
  dark: '#3a2415',
  light: '#ffd98a',
  thatch: '#b98149',
  ridge: '#8e5d33',
  pole: '#7a5232',
  star: '#e2a93c',
};
export const LADY_PAL = { lit: '#f4f1ea', shade: '#cfc9bd', globe: '#9db7d6', hedge: '#3f7a3a', CRIB };
const SN = SnowLogic.PAL,
  // the bed's rows from the back to the front, and the stone kerb along its near edge: [a, b, width]
  BED = [10, 18, 24, 28, 30, 30, 28, 24, 18, 10],
  KERB = [
    [-15, -2, 2],
    [-14, -3, 2],
    [-12, -4, 3],
    [-9, -5, 4],
    [-5, -6, 10],
    [5, -5, 4],
    [9, -4, 3],
    [12, -3, 2],
    [13, -2, 2],
  ],
  // the manger's light inside the crib: [a, b, width, height]
  MANGER = [-12, 1, 3, 2],
  // a point on her shoulders at every snow depth, b px up
  HALO_B = 19;

// The crib: a thatched stable with the manger lit inside and its star on a pole.
function crib(R, d) {
  R(-15, 1, 9, 5, CRIB.wall);
  R(-14, 1, 7, 4, CRIB.dark);
  R(...MANGER, CRIB.light);
  R(-16, 6, 11, 1, CRIB.thatch);
  R(-15, 7, 9, 1, CRIB.thatch);
  R(-13, 8, 5, 1, CRIB.ridge);
  if (d > 0) {
    R(-15, 8, 9, 1, SN.lit);
    R(-13, 9, 5, 1, SN.lit);
  }
  R(-11, 9, 1, 3, CRIB.pole);
  R(-12, 12, 3, 1, CRIB.star);
  R(-11, 11, 1, 3, CRIB.star);
}
// Our Lady, 13 px, standing z px up: robe, shoulders and head lit from the left, the globe in her hands and its cross.
function figure(R, z) {
  const { lit, shade, globe } = LADY_PAL;
  R(-2, z, 5, 6, shade);
  R(-2, z, 3, 6, lit);
  R(-2, z + 6, 4, 3, shade);
  R(-2, z + 6, 2, 3, lit);
  R(-3, z + 8, 6, 2, shade);
  R(-3, z + 8, 3, 2, lit);
  R(-1, z + 10, 3, 3, shade);
  R(-1, z + 10, 2, 3, lit);
  R(-1, z + 6, 2, 2, globe);
  R(0, z + 8, 1, 2, lit);
}
function paintYard(level, d) {
  const L = paletteLayer(LADY_EXT[0] + LADY_EXT[2], LADY_EXT[1] + LADY_EXT[3]),
    // a px right of the bed's middle and b px up from it
    R = (a, b, w, h, c) => {
      L.g.fillStyle = c;
      L.g.fillRect(LADY_EXT[0] + a, LADY_EXT[1] - b - h, w, h);
    };
  BED.forEach((w, n) => R(-(w >> 1), 3 - n, w, 1, d > 0 ? (n < 4 ? SN.lit : SN.base) : LADY_PAL.hedge));
  for (const [a, b, w] of KERB) R(a, b, w, 1, STONE.mid);
  // the pedestal: base, shaft and cap, snow on the cap lifting her a pixel
  R(-4, 0, 8, 2, STONE.mid);
  R(-4, 0, 4, 2, STONE.light);
  R(-3, 2, 6, 7, STONE.mid);
  R(-3, 2, 3, 7, STONE.light);
  R(-4, 9, 8, 1, STONE.light);
  if (d > 0) R(-4, 10, 8, 1, SN.lit);
  figure(R, d > 0 ? 11 : 10);
  if (level >= 2) crib(R, d);
  outlineLayer(L);
  return L;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v) || 0));
const LAYERS = new Map();
// One layer per event level (1..3) and snow depth (0..3), kept.
export function yardLayer(level, depth) {
  const lv = clamp(level, 1, 3),
    d = clamp(depth, 0, 3),
    k = lv * 4 + d;
  if (!LAYERS.has(k)) LAYERS.set(k, paintYard(lv, d));
  return LAYERS.get(k);
}
// What the frame lights after dark, in sprite px: the middle of the statue's halo and the manger's rectangle.
const LIGHTS = {
  halo: [LADY_EXT[0] - 1, LADY_EXT[1] - HALO_B - 1],
  manger: [LADY_EXT[0] + MANGER[0], LADY_EXT[1] - MANGER[1] - MANGER[3], MANGER[2], MANGER[3]],
};
export const yardLights = () => LIGHTS;

// The statue and its bed, the bed's middle on the tile point `at` (EventLandmark.SITE.lady); T and S as for the
// cathedral.
export function drawOurLady(pt, P, T, S, depth, level, at) {
  const [ax, ay] = P(at[0] + 0.5, at[1] + 0.5, 0),
    cv = yardLayer(level, depth).paint(landmarkTones(T, S));
  stamp(pt.ctx, cv, Math.round(ax) - LADY_EXT[0], Math.round(ay) - LADY_EXT[1]);
}
