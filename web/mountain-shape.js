// The snow peak on the back lawn (mountain C, docs/specs/2026-11-08-mountain-c-brief.md) as data: the brief's
// coordinates in art px round the middle of the foot's diamond, y down, and the helpers that read them. The brief's
// numbers are kept as written; SCALE (spec 11.10: x 1.4) blows them up before they are rasterised one art px to one
// logical px, the same pixels as the rest of the island. Pure: web/island-land.js places the mountain with it and
// web/mountain-art.js paints it.
export const SCALE = 1.4,
  // the foot's diamond on the lawn, in tiles (each way): the art's corners L and R fall just inside its tile corners
  FOOT_TILES = 5;

export const BRIEF = {
  F: [0, 27],
  peak: [4, -70],
  silhouette: [
    [-54, 0],
    [-48, -10],
    [-41, -12],
    [-33, -26],
    [-26, -28],
    [-16, -46],
    [-8, -60],
    [-1, -67],
    [4, -70],
    [10, -64],
    [17, -51],
    [22, -50],
    [30, -35],
    [38, -29],
    [45, -18],
    [50, -12],
    [54, 0],
    [0, 27],
  ],
  // the main ridge (lit face left of it, dark face right) and the shoulders (mid stone left of the left one, darker
  // stone right of the right one)
  ridge: [
    [4, -70],
    [7, -36],
    [3, -4],
    [0, 27],
  ],
  shoulderL: [
    [-26, -28],
    [-28, -10],
    [-30, 13],
  ],
  shoulderR: [
    [30, -35],
    [33, -12],
    [34, 11],
  ],
  snowY: -48,
  drips: [0, 1, 3, 5, 3, 1, 0, 2, 6, 4, 1, 0, 1, 4, 7, 3, 1, 0, 2, 3, 1, 0, 5, 2, 0, 1, 3, 1],
  ledges: { count: 30, y0: -46, y1: 4, len: [3, 6] },
  cleft: [
    [-17, -44],
    [-11, -44],
    [-15, 13],
    [-24, 13],
  ],
  falls: { top: [-14, -44], bottom: [-19, 20], w0: 2, w1: 4, streak: 9 },
  lake: { c: [-20, 24], rx: 13, ry: 6, rimRx: 15, rimRy: 7.5 },
  // pine clumps on the grassy foot: [x0, x1, y0, y1, count]
  pines: [
    [-56, -34, 6, 17, 6],
    [28, 64, 5, 19, 7],
  ],
};

// A brief point in scaled art px measured from the front corner F (which sits on a tile corner): x right, y down.
export const fromF = ([x, y], s = SCALE) => [x * s, (y - BRIEF.F[1]) * s];
// How far the peak stands above F, px.
export const peakRise = (s = SCALE) => (BRIEF.F[1] - BRIEF.peak[1]) * s;

// Is the point inside the polygon (even-odd)?
export function inPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[i],
      [bx, by] = pts[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
// The x of a polyline that runs down the picture (y rising), at height y; clamped past its ends.
export function lineX(pts, y) {
  if (y <= pts[0][1]) return pts[0][0];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1],
      [bx, by] = pts[i];
    if (y <= by) return ax + ((bx - ax) * (y - ay)) / (by - ay);
  }
  return pts[pts.length - 1][0];
}
// The shapes in scaled px from F, worked out once per scale.
const memo = new Map();
export function shapes(s = SCALE) {
  if (memo.has(s)) return memo.get(s);
  const f = p => fromF(p, s),
    b = BRIEF;
  const out = {
    s,
    silhouette: b.silhouette.map(f),
    ridge: b.ridge.map(f),
    shoulderL: b.shoulderL.map(f),
    shoulderR: b.shoulderR.map(f),
    cleft: b.cleft.map(f),
    L: f(b.silhouette[0]),
    R: f(b.silhouette[16]),
    peak: f(b.peak),
    lake: {
      c: f(b.lake.c),
      rx: b.lake.rx * s,
      ry: b.lake.ry * s,
      rimRx: b.lake.rimRx * s,
      rimRy: b.lake.rimRy * s,
    },
  };
  memo.set(s, out);
  return out;
}
// Is the point (px from F) inside the lake's stone rim?
export const inRim = (lk, x, y) => ((x - lk.c[0]) / lk.rimRx) ** 2 + ((y - lk.c[1]) / lk.rimRy) ** 2 <= 1;
