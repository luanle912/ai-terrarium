// The office's floors as the look has them, and what the Christmas event lays on its windows, shelf, pot plants
// and clock (docs/specs/2026-11-18-asset-labels-design.md §6), registered through Paint (web/paint.js):
//   floor.corridor  'plain' (nothing over the tiles) or 'runner': a red carpet with gold edges down both corridors,
//                   kept off the big tree's cells (EventLogic.TREE_CELLS)
//   floor.pantry    the kitchen side's tile at (x, y) for a daylight factor: 'checker' or 'checker-red'
//   window          frost in the glass's corners, a star hung in the middle (on every one of WINDOWS)
//   shelf           a short garland along the shelf's top (SHELF), plant.pot red baubles and a bow (POTS), clock a
//                   sprig of holly over it (CLOCK)
// Rectangles and polygons only, every place worked out once; a frame without the event pushes nothing.
import { EventLogic } from './event-logic.js';
import { CLOCK, POTS, SHELF, WINDOWS } from './office-instances.js';
import { glowAt, litStar, treeNight } from './office-draw-xmas.js';
import { H, P, lerpHex, mix } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';
import { Paint } from './paint.js';

const R = Math.round;
// A palette in the light of dfB (0..10), worked out once per level: dim(c, dfB) gives one colour.
const toned = (cs, dim) => {
  const at = [];
  return dfB => at[dfB] || (at[dfB] = cs.map(c => dim(c, dfB)));
};
const xmasTone = cs => toned(cs, treeNight);
// Floors darken much more than the things in the room after dark (as the office's own tiles do).
const floorTone = cs => toned(cs, (c, dfB) => mix(c, '#141526', 0.72 * (1 - dfB / 10)));

// ---- floor.corridor: the runner ----
// Its strips in tiles [x0, y0, x1, y1]: down the corridor between the zones (column 9, from the shelf to the front)
// and across between the back and the front zones (on the line y = 7, from the door's mat to the pantry), cut
// where the big tree stands.
const TREE = new Set(EventLogic.TREE_CELLS);
export const RUNNER = [];
{
  const strips = (from, to, free, put) => {
    let a = -1;
    for (let i = from; i <= to; i++) {
      const ok = i < to && free(i);
      if (ok && a < 0) a = i;
      if (!ok && a >= 0) put(a, i), (a = -1);
    }
  };
  strips(
    1,
    H,
    y => !TREE.has('9,' + y),
    (a, b) => RUNNER.push([9.12, a, 9.88, b]),
  );
  strips(
    1,
    20,
    x => !TREE.has(x + ',6') && !TREE.has(x + ',7'),
    (a, b) => RUNNER.push([a, 6.62, b, 7.38]),
  );
}
// The pieces to fill, in order, each { pts, k }: k the colour (0 gold edge, 1 red, 2 the dark red line, 3 a motif).
const RUN_TONE = floorTone(['#e2b13c', '#b3262f', '#8e1c25', '#d79c2c']);
const RUN_PIECES = [];
{
  const quad = (x0, y0, x1, y1, k) => RUN_PIECES.push({ pts: [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], k });
  const diamond = (x, y, k) =>
    RUN_PIECES.push({ pts: [P(x - 0.12, y), P(x, y - 0.12), P(x + 0.12, y), P(x, y + 0.12)], k });
  for (const [x0, y0, x1, y1] of RUNNER) {
    const along = y1 - y0 > x1 - x0; // down the corridor (along y) or across (along x)
    quad(x0, y0, x1, y1, 0);
    if (along) {
      quad(x0 + 0.07, y0 + 0.05, x1 - 0.07, y1 - 0.05, 1);
      quad(x0 + 0.16, y0 + 0.12, x0 + 0.22, y1 - 0.12, 2);
      quad(x1 - 0.22, y0 + 0.12, x1 - 0.16, y1 - 0.12, 2);
      for (let y = y0 + 0.5; y < y1; y++) diamond((x0 + x1) / 2, y, 3);
    } else {
      quad(x0 + 0.05, y0 + 0.07, x1 - 0.05, y1 - 0.07, 1);
      quad(x0 + 0.12, y0 + 0.16, x1 - 0.12, y0 + 0.22, 2);
      quad(x0 + 0.12, y1 - 0.22, x1 - 0.12, y1 - 0.16, 2);
      for (let x = x0 + 0.5; x < x1; x++) diamond(x, (y0 + y1) / 2, 3);
    }
  }
}
function runner(G) {
  const tone = RUN_TONE(R(G.df * 10));
  for (const p of RUN_PIECES) G.poly(p.pts, tone[p.k], null);
}
Paint.variant('floor.corridor', 'plain', () => {});
Paint.variant('floor.corridor', 'runner', runner);

// ---- floor.pantry: the kitchen side's tiles ----
Paint.variant('floor.pantry', 'checker', (x, y, df) =>
  (x + y) % 2 ? lerpHex('#2e2d3a', '#ebe7dd', df) : lerpHex('#282734', '#dfdace', df),
);
Paint.variant('floor.pantry', 'checker-red', (x, y, df) =>
  (x + y) % 2 ? lerpHex('#3a2028', '#c23b43', df) : lerpHex('#2e2d3a', '#efe8de', df),
);

// ---- window: frost and a star ----
// Where each window's glass is drawn from (the pen of F.window's mount, web/decor-wall.js): a pixel (c, r) of the
// 38 × 36 pane is at (x + c, y + r + c >> 1) on the back wall.
export const windowPen = (X, Y) => [R(X - 2), R(Y + 1)];
const WIN_AT = WINDOWS.map(w => windowPen(...P(w.x + 0.3, 0, 54)));
// The frost, by pairs of columns (two columns drop together on the back wall): [first column, height, from the top
// (1) or the bottom (0)]. The bottom-left corner stays nearly clear: the sill's pot plant stands in front of it.
const FROST = [
  [2, 5, 1],
  [4, 3, 1],
  [6, 2, 1],
  [8, 1, 1],
  [34, 4, 1],
  [32, 3, 1],
  [30, 1, 1],
  [2, 3, 0],
  [4, 1, 0],
  [34, 9, 0],
  [32, 7, 0],
  [30, 5, 0],
  [28, 3, 0],
  [26, 2, 0],
  [24, 1, 0],
];
const FROST_DAY = ['#f4f9ff', '#cde3f6'],
  FROST_NIGHT = ['#aebde0', '#7f95c3'];
function frost(G, win, x, y) {
  const { ctx } = G,
    [body, rim] = G.df < 0.5 ? FROST_NIGHT : FROST_DAY;
  for (const [c, h, top] of FROST) {
    const r = top ? 2 : 32 - h,
      sy = y + r + (c >> 1);
    ctx.fillStyle = body;
    ctx.fillRect(x + c, sy, 2, h);
    ctx.fillStyle = rim;
    ctx.fillRect(x + c, top ? sy + h - 1 : sy, 2, 1);
  }
  // a crystal or two on the glass by the big corner
  ctx.fillStyle = body;
  ctx.fillRect(x + 27, y + 24 + 13, 1, 1);
  ctx.fillRect(x + 31, y + 20 + 15, 1, 1);
}
// The star hangs on a red thread from the top of the glass, in the middle; it glows after dark.
function star(G, win, x, y) {
  const { ctx } = G,
    c = 18,
    dy = y + (c >> 1);
  ctx.fillStyle = '#c8323a';
  ctx.fillRect(x + c, dy + 2, 1, 4);
  litStar(ctx, x + c, dy + 6, R(G.t * 1.3) & 1, glowAt(G.df) * 0.7);
}
Paint.overlay('window', 'frost', frost);
Paint.overlay('window', 'star', star);

// ---- shelf: a short garland under its top's front edge ----
const SWAG9 = [0, 1, 2, 1, 0, 1, 2, 1, 0];
const SHELF_AT = SHELF.map(s => {
  const [sx, sy, sz] = s.at,
    [sw, sd, sh] = s.size,
    at = new Int16Array(SWAG9.length * 2);
  SWAG9.forEach((sag, i) => {
    const [x, y] = P(sx + 0.06 + (i / 8) * (sw - 0.12), sy + sd, sz + sh - 1);
    at[i * 2] = R(x);
    at[i * 2 + 1] = R(y) + sag;
  });
  return at;
});
const GARLAND = xmasTone(['#1f6b3a', '#2f8a4c', '#d94a5a', '#ffd166']);
function garland(G, shelf) {
  const { ctx } = G,
    at = SHELF_AT[SHELF.indexOf(shelf)],
    tone = GARLAND(R(G.df * 10));
  for (let i = 0; i < at.length; i += 2) {
    ctx.fillStyle = tone[(i >> 1) & 1];
    ctx.fillRect(at[i] - 1, at[i + 1] - 1, 3, 2);
  }
  for (let i = 0; i < at.length; i += 8) {
    ctx.fillStyle = tone[2];
    ctx.fillRect(at[i] - 1, at[i + 1] - 1, 2, 2);
  }
  ctx.fillStyle = tone[3];
  for (let i = 4; i < at.length; i += 8) ctx.fillRect(at[i], at[i + 1] + 1, 1, 1);
}
Paint.overlay('shelf', 'garland-small', garland);

// ---- plant.pot: a red ribbon round the pot with a bow, baubles in the leaves ----
const BAUBLES = [
  [-4, -6, 0],
  [2, -10, 1],
  [-1, -14, 0],
  [4, -4, 1],
];
const POT_AT = POTS.map(({ x, y }) => {
  const r = 0.2,
    [lx, ly] = P(x, y, 7),
    [bx, by] = P(x + r, y + r, 5.5);
  return {
    leaves: [R(lx), R(ly)],
    bow: [R(bx), R(by)],
    band: [
      [P(x - r, y + r, 4), P(x + r, y + r, 4), P(x + r, y + r, 5.5), P(x - r, y + r, 5.5)],
      [P(x + r, y - r, 4), P(x + r, y + r, 4), P(x + r, y + r, 5.5), P(x + r, y - r, 5.5)],
    ],
  };
});
const POT_TONE = xmasTone(['#d94a5a', '#a8323d', '#ffd166', '#fff3c4', '#8e1c25']);
function bauble(G, pot) {
  const { ctx } = G,
    p = POT_AT[POTS.indexOf(pot)],
    tone = POT_TONE(R(G.df * 10));
  G.poly(p.band[0], tone[0], null);
  G.poly(p.band[1], tone[1], null);
  const [bx, by] = p.bow;
  ctx.fillStyle = tone[0];
  ctx.fillRect(bx - 3, by - 2, 2, 3);
  ctx.fillRect(bx + 1, by - 2, 2, 3);
  ctx.fillStyle = tone[4];
  ctx.fillRect(bx - 1, by - 1, 2, 2);
  const [lx, ly] = p.leaves;
  for (const [dx, dy, gold] of BAUBLES) {
    ctx.fillStyle = tone[gold ? 2 : 0];
    ctx.fillRect(lx + dx, ly + dy, 2, 2);
    ctx.fillStyle = tone[3];
    ctx.fillRect(lx + dx, ly + dy, 1, 1);
  }
}
Paint.overlay('plant.pot', 'bauble', bauble);

// ---- clock: a sprig of holly on its rim ----
// Rows of the sprig, its middle berry over the clock's top (l, L the leaves, r, R the berries).
const SPRIG = ['ll.....ll', 'lLl...lLl', '.lLlrlLl.', '...rRr...', '....r....'];
const SPRIG_C = 'lLrR';
const SPRIG_RUNS = [];
SPRIG.forEach((row, j) => {
  for (let i = 0; i < row.length; ) {
    const k = SPRIG_C.indexOf(row[i]);
    let n = 1;
    while (k >= 0 && row[i + n] === row[i]) n++;
    if (k >= 0) SPRIG_RUNS.push(i - 4, j - 12, n, k);
    i += n;
  }
});
const CLOCK_AT = CLOCK.map(c => P(...c.at).map(R));
const HOLLY = xmasTone(['#1f5e3a', '#2f7a4a', '#c8323a', '#e8505a']);
function holly(G, clock) {
  const { ctx } = G,
    [cx, cy] = CLOCK_AT[CLOCK.indexOf(clock)],
    tone = HOLLY(R(G.df * 10));
  for (let i = 0; i < SPRIG_RUNS.length; i += 4) {
    ctx.fillStyle = tone[SPRIG_RUNS[i + 3]];
    ctx.fillRect(cx + SPRIG_RUNS[i], cy + SPRIG_RUNS[i + 1], SPRIG_RUNS[i + 2], 1);
  }
}
Paint.overlay('clock', 'holly-sprig', holly);

// A window's overlays off the pane's mount (x, y: where F.window mounts it, P(0.3, 0, 54) off its kit), for the
// /assets page's window: G holds ctx, t and df.
export function layWindow(G, look, X, Y) {
  if (!look) return;
  const [x, y] = windowPen(X, Y);
  for (const f of Paint.overlaysOf('window', look)) f(G, null, x, y);
}

mixin(
  ClaudeOffice,
  class {
    // What the look lays on the office's windows and clock, drawn right after the wall pieces.
    dressWalls(G) {
      const wins = Paint.overlaysOf('window', G.look),
        clocks = Paint.overlaysOf('clock', G.look);
      for (const f of wins) for (let i = 0; i < WINDOWS.length; i++) f(G, WINDOWS[i], WIN_AT[i][0], WIN_AT[i][1]);
      for (const f of clocks) for (const c of CLOCK) f(G, c);
    }
    // What it lays on the shelf and the pot plants, each just after the thing it dresses among the scene's sprites
    // (the shelf sorts at 9 in web/office-draw.js, a pot plant at its x + y).
    dressItems(G, items) {
      const shelf = Paint.overlaysOf('shelf', G.look),
        pots = Paint.overlaysOf('plant.pot', G.look);
      if (shelf.length) for (const s of SHELF) items.push({ z: 9.01, f: () => shelf.forEach(f => f(G, s)) });
      if (pots.length) for (const p of POTS) items.push({ z: p.x + p.y + 0.01, f: () => pots.forEach(f => f(G, p)) });
    }
  },
);
