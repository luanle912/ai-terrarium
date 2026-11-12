// The Christmas landmark's still art: Notre-Dame of Saigon as a scale model on the back lawn (where it stands and how
// big it is: web/event-landmark.js). It is worked out once per event level and snow depth as a palette layer, so a
// bake only recolours it; what glows or blinks on it is drawn every frame by web/office-draw-cathedral.js from the
// tables of cathedralLights().
import { EventLandmark } from './event-landmark.js';
import { EventLogic } from './event-logic.js';
import { fillPx, linePx, OUTLINE, paletteLayer, stamp } from './island-art.js';
import { N4 } from './island-land.js';
import { SnowLogic } from './snow-logic.js';

// The sprite: [left, up, right, down] px round the middle of the tile it hangs on (EventLandmark.SITE.at).
export const CATHEDRAL_EXT = [64, 110, 60, 10];
const BRICK = { left: '#c9644b', right: '#9d4737', joint: '#b4553f', jointR: '#8a3c2e' },
  TRIM = { left: '#ecdfc4', right: '#c2b091', dark: '#9a8a6e' },
  ZINC = { left: '#cdd6d8', mid: '#e6ecec', right: '#8f9da6', seam: '#74828c', top: '#a9b5ba' },
  ROOF = { left: '#b9634a', right: '#8f4334', course: '#73342a' },
  DOOR = { wood: '#6a3f26', dark: '#472a19' },
  GLASS = { dark: '#2f3b5c', glint: '#5a6f99', specks: ['#7f93d6', '#c9607a'] },
  FIR = { dark: '#1f6b3a', lit: '#3aa05a' },
  LOUVRE = '#4b3530',
  CLOCK = '#f3ecd8',
  CROSS = '#ddd6c4',
  BOW = '#e5484d',
  GOLD = '#ffd166',
  STAR = '#e2a93c',
  POT = '#7a5232',
  SN = SnowLogic.PAL;
export const CATHEDRAL_PAL = { BRICK, TRIM, ZINC, ROOF, DOOR, GLASS, FIR, LOUVRE, CLOCK, CROSS, BOW, GOLD, STAR, POT };
// Snow keeps its own moonlit light after dark; brick, stone and zinc take the building's (T).
const SNOWS = new Set(Object.values(SN));
export const landmarkTones = (T, S) => c => (SNOWS.has(c) ? S(c) : T(c));

// The massing, shared with the lawn's rules: the nave's walls, the two towers and the bay between them. What only
// the art needs is here: the ridge, the gable's apex and the spires' apex (px up), and the roof's overhang (tiles).
const [NAVE, TOWER_L, TOWER_R, BAY] = EventLandmark.MASS,
  RIDGE = 34,
  GABLE = 44,
  APEX = 78,
  OVERHANG = 0.125,
  // the facade's string of bulbs lies along the top of the second string course, clear of the rose window and the
  // towers' windows under it; the eave's hangs this high
  FACADE_Z = 35,
  EAVE_Z = 19;
// The local frame: i, j in tiles from the footprint's back corner, z px up, to sprite px. Every length is a multiple
// of 1/8 tile, so corners fall on whole pixels.
export const cathedralQ = (i, j, z = 0) => [CATHEDRAL_EXT[0] + (i - j) * 16, CATHEDRAL_EXT[1] + (i + j - 7) * 8 - z];
// A point on a wall: a px across from its near-left end at (i, j), b px up. Lit (+y) walls fall to the right
// (dir 1), shaded (+x) walls rise (dir -1).
const spot = (i, j, dir, a, b) => {
  const [x, y] = cathedralQ(i, j, 0);
  return [x + a, y + dir * Math.ceil(a / 2) - b - 1];
};
// Corners of an upright wall z px high on the plane y = j, on the plane x = i, and of a flat top at z.
const wallY = (i0, i1, j, z) => [
  [i0, j, 0],
  [i1, j, 0],
  [i1, j, z],
  [i0, j, z],
];
const wallX = (i, j0, j1, z) => [
  [i, j0, 0],
  [i, j1, 0],
  [i, j1, z],
  [i, j0, z],
];
const flat = (i0, i1, j0, j1, z) => [
  [i0, j0, z],
  [i1, j0, z],
  [i1, j1, z],
  [i0, j1, z],
];

// What one painting draws with: the layer, polygons and lines in the local frame, rectangles in sprite px, and the
// glass it has put in so far (x, y, w, h runs).
function brush() {
  const L = paletteLayer(CATHEDRAL_EXT[0] + CATHEDRAL_EXT[2], CATHEDRAL_EXT[1] + CATHEDRAL_EXT[3]),
    g = L.g;
  return {
    L,
    g,
    panes: [],
    poly: (pts, c) =>
      fillPx(
        g,
        pts.map(p => cathedralQ(...p)),
        c,
      ),
    line: (a, b, c) => linePx(g, cathedralQ(...a), cathedralQ(...b), c),
    R: (x, y, w, h, c) => {
      g.fillStyle = c;
      g.fillRect(x, y, w, h);
    },
  };
}
// One wall as a surface to draw on: f(a, b, w, h, colour, glass) is a rectangle a px across and b px up that leans
// with the wall, a column at a time. With `glass` it is kept as a window pane for the night's glow.
function face(B, i, j, dir) {
  const f = (a, b, w, h, c, glass) => {
    B.g.fillStyle = c;
    for (let q = a; q < a + w; q++) {
      const [x, y] = spot(i, j, dir, q, b + h - 1);
      B.g.fillRect(x, y, 1, h);
      if (glass) B.panes.push(x, y, 1, h);
    }
  };
  // columns of different heights standing on one line: an arch
  f.arch = (a, b, hs, c, glass) => hs.forEach((h, n) => f(a + n, b, 1, h, c, glass));
  // a disc of radius r round (a, b)
  f.disc = (a, b, r, c, glass) => {
    for (let dx = -r; dx <= r; dx++) {
      const h = Math.round(Math.sqrt(r * r - dx * dx + 0.8));
      f(a + dx, b - h + 1, 1, 2 * h - 1, c, glass);
    }
  };
  return f;
}
// Brick courses: a darker dot every other pixel on every fourth row, staggered from course to course.
function joints(f, w, h, c) {
  for (let b = 3; b < h; b += 4) for (let a = (b >> 2) & 1; a < w; a += 2) f(a, b, 1, 1, c);
}

// The nave: its front end, its shaded side wall with pilasters and four arched windows, then the roof, both slopes
// showing.
function nave(B, d) {
  const [i0, i1, j0, j1, eave] = NAVE,
    mid = (i0 + i1) / 2,
    wide = (j1 - j0) * 16,
    wall = face(B, i1, j1, -1);
  // its front end: the bay stands lower than the ridge, so a strip of this wall shows beside the gable
  B.poly(
    [
      [i0, j1, 0],
      [i1, j1, 0],
      [i1, j1, eave],
      [mid, j1, RIDGE],
      [i0, j1, eave],
    ],
    BRICK.left,
  );
  B.poly(wallX(i1, j0, j1, eave), BRICK.right);
  joints(wall, wide, eave - 2, BRICK.jointR);
  for (const a of [2, 12, 22, 32, 40]) wall(a, 0, 2, eave - 2, TRIM.right);
  for (const a of [6, 16, 26, 36]) {
    wall(a - 1, 5, 6, 1, TRIM.right);
    wall.arch(a, 6, [10, 12, 12, 10], GLASS.dark, true);
    wall(a + 1, 13, 1, 2, GLASS.glint);
  }
  wall(0, eave - 2, wide, 2, TRIM.right);
  if (d > 0) wall(0, 0, wide, d > 1 ? 2 : 1, SN.shade);
  // t runs from the eave (0) to the ridge (1) on either slope
  const back = j0 - OVERHANG,
    run = mid - i0 + OVERHANG,
    far = (t, j) => [i0 - OVERHANG + run * t, j, eave - 1 + (RIDGE - eave + 1) * t],
    near = (t, j) => [i1 + OVERHANG - run * t, j, eave - 1 + (RIDGE - eave + 1) * t];
  const farSlope = [far(0, back), far(1, back), far(1, j1), far(0, j1)];
  B.poly(farSlope, ROOF.left);
  B.poly([near(0, back), near(0, j1), near(1, j1), near(1, back)], ROOF.right);
  for (const t of [0.33, 0.66]) B.line(near(t, back), near(t, j1), ROOF.course);
  B.line(near(1, back), near(1, j1), ROOF.course);
  if (d > 0) {
    B.poly(farSlope, SN.lit);
    roofSnow(B, near, back, j1, [0, 0.4, 0.68, 0.86][d]);
  }
}
// Snow on the near slope from the ridge down over `share` of it, its lower edge ragged, a lit band along the ridge.
function roofSnow(B, near, back, front, share) {
  const edge = [];
  for (let j = back, n = 0; j <= front + 0.01; j += 0.25, n++) edge.push(near(1 - share + (n % 2 ? 0.07 : -0.05), j));
  B.poly([near(1, back), ...edge, near(1, front)], SN.base);
  B.poly([near(1, back), near(0.83, back), near(0.83, front), near(1, front)], SN.lit);
  for (let n = 0; n + 1 < edge.length; n++) B.line(edge[n], edge[n + 1], SN.shade);
}

// One of a tower's two faces that show: string courses, the cornice a pixel proud, a window, two belfry louvres and,
// on the front, a side door. Snow lies on the ledges and against the foot, clear of the door.
function towerFace(f, trim, d, front) {
  f(0, 17, 16, 2, trim);
  f(0, 31, 16, 2, trim);
  f(-1, 46, 18, 2, trim);
  f(5, 20, 6, 1, trim);
  f.arch(6, 21, [7, 8, 8, 7], GLASS.dark, true);
  f(7, 26, 1, 2, GLASS.glint);
  f.arch(3, 35, [8, 9, 8], LOUVRE);
  f.arch(10, 35, [8, 9, 8], LOUVRE);
  if (front) {
    f.arch(4, 0, [10, 12, 13, 13, 13, 13, 12, 10], trim);
    f.arch(5, 0, [9, 11, 12, 12, 11, 9], DOOR.wood);
    f(8, 0, 1, 11, DOOR.dark);
  }
  if (!d) return;
  const deep = d > 1 ? 2 : 1;
  f(-1, 48, 18, 1, front ? SN.lit : SN.base);
  if (!front) {
    f(0, 0, 16, deep, SN.shade);
    return;
  }
  f(0, 0, 4, deep, SN.base);
  f(12, 0, 4, deep, SN.base);
  if (d > 1) {
    f(0, 19, 16, 1, SN.lit);
    f(0, 33, 16, 1, SN.lit);
  }
}
// A tower: the brick shaft, a pinnacle on each near corner, the zinc spire and its cross.
function tower(B, [i0, i1, j0, j1, top], d) {
  B.poly(wallY(i0, i1, j1, top), BRICK.left);
  B.poly(wallX(i1, j0, j1, top), BRICK.right);
  B.poly(flat(i0, i1, j0, j1, top), d > 0 ? SN.base : ZINC.top);
  const front = face(B, i0, j1, 1),
    side = face(B, i1, j1, -1);
  joints(front, 16, top - 2, BRICK.joint);
  joints(side, 16, top - 2, BRICK.jointR);
  towerFace(front, TRIM.left, d, true);
  towerFace(side, TRIM.right, d, false);
  for (const [pi, pj] of [
    [i0, j1],
    [i1, j1],
    [i1, j0],
  ]) {
    const [x, y] = cathedralQ(pi, pj, top);
    B.R(x - 1, y - 5, 2, 4, TRIM.left);
    B.R(pi === i1 ? x : x - 1, y - 5, 1, 4, TRIM.right);
    B.R(pi === i0 ? x : x - 1, y - 6, 1, 1, d > 0 ? SN.lit : TRIM.left);
  }
  spire(B, (i0 + i1) / 2, (j0 + j1) / 2, top, d);
}
// The spire, an eight-sided cone seen as a lit and a shaded face with a bright arris between them, seams at 0.3 and
// 0.6 of its height, and the cross on its tip (8 px, so the tip is 85 px up).
function spire(B, ci, cj, top, d) {
  const r = 0.375,
    ap = [ci, cj, APEX],
    lf = [ci - r, cj + r, top],
    fr = [ci + r, cj + r, top],
    rt = [ci + r, cj - r, top],
    up = (p, t) => [p[0] + (ci - p[0]) * t, p[1] + (cj - p[1]) * t, top + (APEX - top) * t];
  B.poly([lf, fr, ap], ZINC.left);
  B.poly([fr, rt, ap], ZINC.right);
  for (const t of [0.3, 0.6]) {
    B.line(up(lf, t), up(fr, t), ZINC.seam);
    B.line(up(fr, t), up(rt, t), ZINC.seam);
    if (d > 1) {
      // snow caught on the lit half of each seam
      const a = up(lf, t),
        b = up(fr, t);
      B.line([a[0], a[1], a[2] + 1], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2] + 1], SN.lit);
    }
  }
  B.line(fr, ap, ZINC.mid);
  const [x, y] = cathedralQ(...ap);
  B.R(x, y - 7, 1, 8, CROSS);
  B.R(x - 1, y - 5, 3, 1, CROSS);
  if (d > 1) B.R(x - 1, y - 6, 1, 1, SN.lit);
}

// The rose's four specks on the bay's wall, round its middle at (12, 25): [a, b, which of GLASS.specks].
const ROSE_SPECKS = [
  [10, 27, 0],
  [14, 27, 1],
  [10, 23, 1],
  [14, 23, 0],
];
// The bay between the towers, set back 2 px: the gable, the main door, the rose window and the clock.
function bay(B, f, d) {
  const [i0, i1, , j, wall] = BAY,
    mid = (i0 + i1) / 2;
  B.poly(
    [
      [i0, j, 0],
      [i1, j, 0],
      [i1, j, wall],
      [mid, j, GABLE],
      [i0, j, wall],
    ],
    BRICK.left,
  );
  joints(f, 24, wall - 1, BRICK.joint);
  f(0, 17, 24, 2, TRIM.left);
  f(0, 31, 24, 2, TRIM.left);
  // coping along both rakes, snow on it from the second depth
  const cope = d > 1 ? SN.lit : TRIM.left;
  B.line([i0, j, wall], [mid, j, GABLE], TRIM.left);
  B.line([mid, j, GABLE], [i1, j, wall], TRIM.left);
  B.line([i0, j, wall + 1], [mid, j, GABLE + 1], cope);
  B.line([mid, j, GABLE + 1], [i1, j, wall + 1], cope);
  f.arch(6, 0, [12, 14, 15, 16, 16, 16, 16, 16, 16, 15, 14, 12], TRIM.left);
  f.arch(7, 0, [11, 13, 14, 14, 14, 14, 14, 14, 13, 11], DOOR.wood);
  f(11, 0, 2, 14, DOOR.dark);
  // the rose window: glass in a stone ring, a stone cross through it and four coloured specks
  f.disc(12, 25, 5, TRIM.left);
  f.disc(12, 25, 4, GLASS.dark, true);
  for (const [a, b, c] of ROSE_SPECKS) f(a, b, 1, 1, GLASS.specks[c]);
  f(12, 21, 1, 9, TRIM.left);
  f(8, 25, 9, 1, TRIM.left);
  // the clock: its face glows with the windows, the hands stay dark
  f.disc(12, 38, 3, TRIM.dark);
  f.disc(12, 38, 2, CLOCK, true);
  f(12, 38, 1, 2, OUTLINE);
  f(13, 38, 1, 1, OUTLINE);
  if (d > 1) {
    f(0, 19, 6, 1, SN.lit);
    f(18, 19, 6, 1, SN.lit);
    f(0, 33, 24, 1, SN.lit);
  }
  if (d > 0) {
    f(0, 0, 6, d > 1 ? 2 : 1, SN.base);
    f(18, 0, 6, d > 1 ? 2 : 1, SN.base);
  }
}
// A fir garland hung under a wall's first string course in 8 px swags, a red bow at each fixing. Over the main door
// (`door`) only the fixings show.
function garland(f, w, door) {
  for (let a = 0; a < w; a++) {
    const sag = Math.round(1.6 * Math.sin((Math.PI * (a % 8)) / 8));
    if (door && a > 5 && a < 18 && sag) continue;
    f(a, 16 - sag, 1, 1, a % 2 ? FIR.lit : FIR.dark);
    if (a % 8 === 0) f(a, 15, 1, 2, BOW);
  }
}
// A small fir in a pot, three tiers, at the foot of the facade.
function miniFir(B, i, j, d) {
  const [x, y] = cathedralQ(i, j, 0).map(Math.round);
  B.R(x - 1, y - 2, 3, 2, POT);
  for (let n = 0; n < 3; n++) {
    const w = 7 - 2 * n,
      l = x - 3 + n,
      t = y - 5 - 3 * n;
    B.R(l, t, w, 3, FIR.dark);
    B.R(l, t, w >> 1, 3, FIR.lit);
    if (d > 0) B.R(l, t, w - 2, 1, SN.lit);
  }
  B.R(x, y - 12, 1, 1, GOLD);
}
// The star's top middle on the sprite: it stands on a short pole over the gable's apex.
const starAt = () => {
  const [x, y] = cathedralQ((BAY[0] + BAY[1]) / 2, BAY[3], GABLE + 1);
  return [x, y - 7];
};
// Christmas by event level: a wreath on the main door; garlands and two small firs; the star, unlit (the frame
// lights it).
function dress(B, mid, level, d) {
  for (let dx = -3; dx <= 3; dx++) {
    const h = 4 - Math.max(0, Math.abs(dx) - 1);
    mid(12 + dx, 11 - h, 1, 2 * h - 1, dx < 0 ? FIR.lit : FIR.dark);
  }
  mid(11, 9, 3, 3, DOOR.dark);
  mid(11, 6, 3, 2, BOW);
  mid(12, 5, 1, 1, BOW);
  if (level < 2) return;
  garland(face(B, TOWER_L[0], TOWER_L[3], 1), 16, false);
  garland(mid, 24, true);
  garland(face(B, TOWER_R[0], TOWER_R[3], 1), 16, false);
  miniFir(B, 1.36, 4.08, d);
  miniFir(B, 2.64, 4.08, d);
  if (level < 3) return;
  const [x, y] = starAt();
  B.R(x, y + 5, 1, 2, TRIM.dark);
  B.R(x - 1, y, 3, 5, STAR);
  B.R(x - 3, y + 2, 7, 1, STAR);
}

// The 1 px outline of a palette layer: every clear pixel next to a painted one. Through L.set, so the layer knows
// the rows it grew by and paints them.
export function outlineLayer(L) {
  const { w, h, idx } = L,
    on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && idx[y * w + x] > 0,
    ring = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (!on(x, y) && N4.some(([a, b]) => on(x + a, y + b))) ring.push(x, y);
  const ol = L.key(OUTLINE);
  for (let n = 0; n < ring.length; n += 2) L.set(ring[n], ring[n + 1], ol);
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v) || 0));
// The whole building, back to front, for an event level (1..3) and a snow depth (0..3): { L: the palette layer,
// panes: the glass put in on the way, also where a later wall hides it }.
export function paintCathedral(level, depth) {
  const B = brush(),
    d = clamp(depth, 0, 3),
    mid = face(B, BAY[0], BAY[3], 1);
  nave(B, d);
  tower(B, TOWER_L, d);
  bay(B, mid, d);
  tower(B, TOWER_R, d);
  dress(B, mid, clamp(level, 1, 3), d);
  outlineLayer(B.L);
  return { L: B.L, panes: B.panes };
}
const PAINTED = new Map();
// The same, kept: one painting per level and depth for as long as the page lives.
function painted(level, depth) {
  const k = clamp(level, 1, 3) * 4 + clamp(depth, 0, 3);
  if (!PAINTED.has(k)) PAINTED.set(k, paintCathedral(level, depth));
  return PAINTED.get(k);
}
export const cathedralLayer = (level, depth) => painted(level, depth).L;

// The glass that shows on the finished building, as 1 px wide runs [x, y, 1, h, ...]: a pane behind a later wall or
// under a glazing bar is left out, so only glass (and the clock's face) glows.
function shownPanes(L, panes) {
  const glows = new Set([GLASS.dark, GLASS.glint, ...GLASS.specks, CLOCK]),
    mask = new Uint8Array(L.w * L.h),
    out = [];
  for (let n = 0; n < panes.length; n += 4)
    for (let y = panes[n + 1]; y < panes[n + 1] + panes[n + 3]; y++) {
      const i = y * L.w + panes[n];
      if (L.idx[i] && glows.has(L.keys[L.idx[i] - 1][0])) mask[i] = 1;
    }
  for (let x = 0; x < L.w; x++)
    for (let y = 0, run = 0; y <= L.h; y++) {
      if (y < L.h && mask[y * L.w + x]) run++;
      else if (run) {
        out.push(x, y - run, 1, run);
        run = 0;
      }
    }
  return Int16Array.from(out);
}
// Bulbs on whole pixels, every third one a pixel lower, so a string is not ruler-straight.
function sagged(at) {
  for (let n = 0; n < at.length / 2; n++) {
    at[n * 2] = Math.round(at[n * 2]);
    at[n * 2 + 1] = Math.round(at[n * 2 + 1] + (n % 3 === 1 ? 1 : 0));
  }
  return at;
}
let lights = null;
// What the frame lights, in sprite px, laid out once: the bulbs of the facade's string (10, from the first level),
// the eave's (8, from the second) and the rose window's ring (6, from the third) as x, y pairs; the star's top
// middle; the window panes and the rose's specks; the rose's middle.
export function cathedralLights() {
  if (lights) return lights;
  const [, n1, n0, nj] = NAVE,
    j = BAY[3],
    front = TOWER_L[3],
    Z = FACADE_Z,
    roseAt = spot(BAY[0], j, 1, 12, 25),
    ring = [];
  for (let n = 0; n <= 6; n++) {
    const a = (n / 6) * Math.PI * 2 + 0.5,
      dx = 6.5 * Math.cos(a);
    ring.push([roseAt[0] + dx, roseAt[1] + dx / 2 + 6.5 * Math.sin(a)]);
  }
  const facade = [
    cathedralQ(TOWER_L[0], front, Z),
    cathedralQ(TOWER_L[1], front, Z),
    cathedralQ(BAY[0], j, Z),
    cathedralQ(BAY[1], j, Z),
    cathedralQ(TOWER_R[0], front, Z),
    cathedralQ(TOWER_R[1], front, Z),
  ];
  const { L, panes } = painted(3, 3);
  lights = {
    facade: sagged(EventLogic.lightString(facade, 6, 10)),
    eave: sagged(EventLogic.lightString([cathedralQ(n1, nj - 0.1, EAVE_Z), cathedralQ(n1, n0, EAVE_Z)], 6, 8)),
    rose: EventLogic.lightString(ring, 6, 6).map(Math.round),
    star: starAt(),
    panes: shownPanes(L, panes),
    specks: Int16Array.from(ROSE_SPECKS.flatMap(([a, b]) => spot(BAY[0], j, 1, a, b))),
    roseAt,
  };
  return lights;
}

// The cathedral at its tile `at` (EventLandmark.SITE.at): its shadow on the ground along the shaded foot, then the
// layer in the bake's light. T maps a colour through the building's light, S through the snow's.
export function drawCathedral(pt, P, T, S, depth, level, at) {
  const [ax, ay] = P(at[0] + 0.5, at[1] + 0.5, 0),
    G = (i, j) => P(at[0] + i - 3, at[1] + j - 3, 0),
    [, i1, j0] = NAVE,
    out = TOWER_R[1],
    front = TOWER_R[3];
  pt.poly([G(i1, j0), G(i1 + 0.375, j0), G(out + 0.375, front), G(out, front)], 'rgba(40,50,90,0.22)');
  const cv = cathedralLayer(level, depth).paint(landmarkTones(T, S));
  stamp(pt.ctx, cv, Math.round(ax) - CATHEDRAL_EXT[0], Math.round(ay) - CATHEDRAL_EXT[1]);
}
