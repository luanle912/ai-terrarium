// The Christmas event's still pieces, painted into the island's bake (web/sky-island.js) so they cost nothing per
// frame: the one big tree with its tinsel and presents. What blinks or glows on them is drawn every frame by
// web/office-draw-xmas.js from the tables here.
import { EventLogic } from './event-logic.js';
import { OUTLINE } from './island-art.js';

// The big tree's sprite: [left, up, right, down] px round the middle of its tile.
export const BIG_TREE_EXT = [27, 72, 27, 9];
// Its four tiers from the bottom up: [half width at the foot, the foot's height above the ground, the tier's height].
const TIERS = [
  [23, 7, 20],
  [18, 21, 18],
  [13, 34, 16],
  [8, 46, 15],
];
export const BIG_TREE_TOP = 61;
// Where its 24 bulbs hang, px from the foot of the trunk (x right, y up), six along each tier's lower edge in a sag.
export const BIG_TREE_BULBS = new Float32Array(48);
TIERS.forEach(([hw, z0], ti) => {
  for (let i = 0; i < 6; i++) {
    const f = (i + 0.5) / 6,
      b = ti * 6 + i;
    BIG_TREE_BULBS[b * 2] = Math.round((f * 2 - 1) * (hw - 2));
    BIG_TREE_BULBS[b * 2 + 1] = Math.round(z0 + 3 + 4 * Math.sin(f * Math.PI) * (ti % 2 ? -0.4 : 0.6) + (i % 2));
  }
});
// The presents round its foot, nearest the trunk first: [x, width, height, paper, ribbon].
const GIFT_BOXES = [
  [-9, 7, 6, '#d94a5a', '#ffd166'],
  [5, 8, 5, '#3e8ed0', '#ffffff'],
  [-17, 6, 5, '#46a758', '#d94a5a'],
  [13, 6, 7, '#8e4ec6', '#ffd166'],
  [-2, 6, 4, '#f5a524', '#d94a5a'],
  [-23, 5, 4, '#e93d82', '#ffffff'],
  [19, 6, 4, '#d94a5a', '#ffffff'],
  [-13, 5, 8, '#12a594', '#ffd166'],
  [9, 5, 3, '#ffffff', '#d94a5a'],
];

// The big tree at its tile (EventLogic.bigTreeTile): a trunk, four tiers of fir lit from the left with ragged lower
// edges, a line of gold tinsel across each, the unlit star, and the presents the level brings. T maps a colour
// through the bake's light (a tree keeps more of its colour after dark than the lawn does).
export function drawBigTree(pt, P, T, tile, level) {
  const [px, py] = P(tile[0] + 0.5, tile[1] + 0.5, 0),
    x = Math.round(px),
    y = Math.round(py),
    ctx = pt.ctx,
    R = (a, b, w, h, c) => {
      ctx.fillStyle = T(c);
      ctx.fillRect(x + a, y - b - h, w, h);
    };
  // shadow on the ground, trunk
  ctx.fillStyle = 'rgba(40,50,90,0.22)';
  for (const [o, w] of [
    [-16, 34],
    [-20, 44],
    [-15, 34],
  ])
    ctx.fillRect(x + o, y - 1 + (w === 44 ? 1 : w === 34 && o === -15 ? 2 : 0), w, 1);
  R(-3, 0, 6, 9, OUTLINE);
  R(-2, 0, 2, 9, '#7a5232');
  R(0, 0, 2, 9, '#5a3b22');
  // tiers, bottom first so each overlaps the one below
  TIERS.forEach(([hw, z0, h], ti) => {
    for (let r = 0; r < h; r++) {
      const w = Math.max(1, Math.round((hw * (h - r)) / h)),
        z = z0 + r;
      R(-w - 1, z, 2 * w + 2, 1, OUTLINE);
      R(-w, z, w, 1, r < 2 ? '#1f6b3a' : '#3aa05a');
      R(0, z, w, 1, r < 2 ? '#17512b' : '#2a8048');
      if (r > 2 && w > 3) R(-w + 1 + ((r * 3 + ti) % Math.max(1, w - 2)), z, 1, 1, '#5cc078');
    }
    // the ragged lower edge: needles hanging a pixel or two below the foot
    for (let i = -hw + 1; i < hw; i += 3)
      R(i, z0 - 1 - ((i + hw) % 2), 2, 1 + ((i + hw) % 2), i < 0 ? '#1f6b3a' : '#17512b');
    // tinsel: a gold dotted line sagging across the tier
    for (let i = -hw + 3; i <= hw - 3; i += 2)
      R(i, Math.round(z0 + 6 + (h > 16 ? 2 : 1) * Math.cos((i / hw) * 1.4)), 1, 1, '#ffd166');
  });
  // the star, unlit (the frame lights it)
  R(-1, BIG_TREE_TOP, 3, 5, '#e2a93c');
  R(-3, BIG_TREE_TOP + 2, 7, 1, '#e2a93c');
  R(0, BIG_TREE_TOP + 5, 1, 2, '#e2a93c');
  // presents
  GIFT_BOXES.slice(0, EventLogic.GIFTS[level] || 0).forEach(([gx, w, h, paper, ribbon], i) => {
    const gy = -3 + (i % 3);
    R(gx - 1, gy - 1, w + 2, h + 2, OUTLINE);
    R(gx, gy, w, h, paper);
    R(gx + (w >> 1), gy, 1, h, ribbon);
    R(gx, gy + (h >> 1), w, 1, ribbon);
    R(gx + (w >> 1) - 1, gy + h, 3, 1, ribbon);
  });
}

// A candy cane stuck in the snow beside a lamp post (from the event's second level): [left, up, right, down].
export const CANE_EXT = [4, 14, 5, 2];
export function drawCandyCane(pt, P, T, l) {
  const [px, py] = P(l.x + 0.86, l.y + 0.62, 0),
    x = Math.round(px),
    y = Math.round(py),
    ctx = pt.ctx,
    R = (a, b, w, h, c) => {
      ctx.fillStyle = T(c);
      ctx.fillRect(x + a, y - b - h, w, h);
    };
  R(-2, 0, 4, 12, OUTLINE);
  R(-2, 10, 6, 3, OUTLINE);
  R(2, 7, 2, 4, OUTLINE);
  for (let i = 0; i < 11; i++) R(-1, i, 2, 1, i % 4 < 2 ? '#f6f9fc' : '#d94a5a');
  R(-1, 11, 4, 1, '#f6f9fc');
  R(1, 11, 1, 1, '#d94a5a');
  R(2, 8, 1, 3, '#d94a5a');
  R(3, 9, 1, 1, '#f6f9fc');
}
