// When the Look changes (the event switched on or off, a preview over) the living scene follows in the same frame,
// paused or not (docs/specs/2026-11-18-asset-labels-design.md §5.7, D4). The host (ClaudeOffice#onLook,
// web/office-look.js) does the moving; this is what it decides with. Pure (tests/look-change.test.mjs).
import { Theme } from './theme.js';

// Every rule any pack can switch on, and the extras that take cells out of the walkable ones (the big tree, the
// cathedral).
const RULES = [...new Set(Theme.PACKS.flatMap(p => Object.keys(p.rules || {})))],
  BLOCKERS = ['tree.big', 'cathedral'];
const blocks = look => !!look && BLOCKERS.some(b => look.extras.has(b));

// What changed from prev to next: { extrasGone, rulesOff (Sets of names), blockChanged, blockOn (next blocks),
// snowFrom, snowTo (the snow cover the event keeps on the ground, 0 with none) }.
function diff(prev, next) {
  const extrasGone = new Set(),
    rulesOff = new Set();
  if (prev) {
    for (const x of prev.extras) if (!next.extras.has(x)) extrasGone.add(x);
    for (const r of RULES) if (prev.has(r) && !next.has(r)) rulesOff.add(r);
  }
  const blockOn = blocks(next);
  return {
    extrasGone,
    rulesOff,
    blockChanged: blocks(prev) !== blockOn,
    blockOn,
    snowFrom: (prev && prev.snow) || 0,
    snowTo: next.snow || 0,
  };
}
// Delays in seconds, one for each of n people, spread over [0, span): one in each n-th of it, somewhere inside.
function stagger(n, rand, span = 3) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(Math.min((i + rand()) / n, 1 - 1e-9) * span);
  return out;
}
// Whether a path of points ([x, y] in tiles) runs over a cell of `blocked` ("x,y" keys).
const crosses = (path, blocked) => path.some(p => blocked.has(Math.floor(p[0]) + ',' + Math.floor(p[1])));
// The snow cover dtMs later, melting evenly to nothing in leftMs.
const melt = (cover, leftMs, dtMs) => (leftMs <= dtMs ? 0 : cover * (1 - dtMs / leftMs));

export const LookChange = { RULES, BLOCKERS, diff, stagger, crosses, melt };
