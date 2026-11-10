// The Christmas event as logic (no DOM, no canvas; tests/event-logic.test.mjs): when it is on and how far along, the
// choice in Settings, where the one big tree stands and how a string of lights is laid out. The page asks active()
// what to show; everything else about the event hangs off its answer, so another event later is one more calendar
// entry and its own drawing.
import { hash, key } from './island-grid.js';
import { SkyLogic } from './sky-logic.js';
import { SeasonIsland } from './season-island.js';

const CHOICES = ['auto', 'on', 'off'];
const EVENT_KEY = 'ai-terrarium.event';
const PREVIEW_MS = 60_000;
const startPreview = now => ({ until: now + PREVIEW_MS });

// The event at a moment of the viewer's own clock, or null: { key: 'christmas', level, eve, day }.
//   level 1  1-7 Dec    lights on the office, wreaths, hats
//   level 2  8-14 Dec   candy canes, desk decorations, the kennels and the pergola lit, whole outfits
//   level 3  15-26 Dec  everything
//   eve      24 Dec 18:00 to 25 Dec 06:00      day  all of 25 Dec
// choice 'on' shows level 3 whatever the date (never eve or day), 'off' nothing; a preview shows level 3 until it
// runs out, whatever the choice.
function active(date, choice, preview, now) {
  if (preview && now < preview.until) return { key: 'christmas', level: 3, eve: false, day: false };
  if (choice === 'on') return { key: 'christmas', level: 3, eve: false, day: false };
  if (choice !== 'auto' || date.getMonth() !== 11) return null;
  const d = date.getDate(),
    h = date.getHours();
  if (d > 26) return null;
  return {
    key: 'christmas',
    level: d <= 7 ? 1 : d <= 14 ? 2 : 3,
    eve: (d === 24 && h >= 18) || (d === 25 && h < 6),
    day: d === 25,
  };
}
// What the island's bake is keyed by: '' without the event, 'x1'..'x3' by level.
const cacheKey = ev => (ev ? 'x' + ev.level : '');

function loadChoice(storage) {
  try {
    const raw = storage && storage.getItem(EVENT_KEY);
    return CHOICES.includes(raw) ? raw : 'auto';
  } catch (e) {
    return 'auto';
  }
}
function saveChoice(storage, choice) {
  try {
    storage.setItem(EVENT_KEY, CHOICES.includes(choice) ? choice : 'auto');
    return true;
  } catch (e) {
    return false;
  }
}

// What a page does with the event choice the local server sends (undefined from a server or a save that has none):
// take it when it differs, or give the server this page's own, once, when it has none and this page's is not the
// default. The wallpaper has no settings of its own to give.
function adopt(server, own, { wallpaper = false, seeded = false } = {}) {
  if (CHOICES.includes(server)) return { take: server !== own ? server : null, seed: false };
  return { take: null, seed: !wallpaper && !seeded && own !== 'auto' };
}

// The big tree's tile: open lawn in front of the office (the y side, where the lawn is widest before the lake), its
// own tile and the eight round it on the island and free of paths, water, stairs, lamps, decor, outdoor spots,
// places people stand and winter's snowmen (none beside it, none behind it in its screen column); of those, the one
// nearest a point a few tiles out from the middle of the office front.
function bigTreeTile(island, W, H) {
  const no = new Set([
    ...island.paths.cells,
    ...island.pond.cells,
    ...island.mountain.cells,
    ...island.mountain.pool.cells,
  ]);
  for (const p of [...island.pond.spots, island.rest.bench, island.rest.fish, ...island.lamps]) no.add(key(p.x, p.y));
  for (const d of island.decor) if (d.kind !== 'flower') no.add(key(d.x, d.y));
  for (const s of SkyLogic.stairs(W, H))
    for (let i = 0; i < s.len; i++)
      for (let o = 0; o < 2; o++) no.add(s.side === 'east' ? key(s.x + o, s.y + i) : key(s.x + i, s.y + o));
  const men = SeasonIsland.snowmanTiles(island, W, H),
    free = (x, y) =>
      island.cells.has(key(x, y)) &&
      !no.has(key(x, y)) &&
      !men.some(m => Math.hypot(m.x - x, m.y - y) < 2) &&
      !island.spots.some(s => x >= s.x - 1 && x <= s.x + s.w && y >= s.y - 1 && y <= s.y + s.h),
    tx = W * 0.42,
    ty = H + 3.5;
  let best = null,
    bd = Infinity;
  for (const { x, y } of island.list) {
    if (y <= H + 1 || x < 1 || x >= W - 1) continue;
    let ok = true;
    for (let dx = -1; dx <= 1 && ok; dx++) for (let dy = -1; dy <= 1 && ok; dy++) ok = free(x + dx, y + dy);
    // nor in front of a snowman in the same screen column, where the tree (some nine rows tall) would hide it
    ok =
      ok && !men.some(m => Math.abs(x - y - (m.x - m.y)) <= 3 && x + y - (m.x + m.y) > -2 && x + y - (m.x + m.y) <= 10);
    const d = Math.hypot(x - tx, y - ty) + hash(x, y, 301) * 0.01;
    if (ok && d < bd) {
      bd = d;
      best = [x, y];
    }
  }
  return best;
}

// Bulbs along a line of points (px), about `gap` px apart, at most `max` of them (the gap widens to fit): a
// Float32Array of x, y pairs, made once and read every frame.
function lightString(points, gap, max) {
  let len = 0;
  for (let i = 1; i < points.length; i++)
    len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  if (!len || max < 1) return new Float32Array(0);
  const n = Math.max(1, Math.min(max, Math.round(len / gap))),
    step = len / n,
    out = new Float32Array(n * 2);
  let seg = 1,
    done = 0;
  for (let b = 0; b < n; b++) {
    const at = (b + 0.5) * step;
    while (
      seg < points.length - 1 &&
      done + Math.hypot(points[seg][0] - points[seg - 1][0], points[seg][1] - points[seg - 1][1]) < at
    ) {
      done += Math.hypot(points[seg][0] - points[seg - 1][0], points[seg][1] - points[seg - 1][1]);
      seg++;
    }
    const [x0, y0] = points[seg - 1],
      [x1, y1] = points[seg],
      f = (at - done) / (Math.hypot(x1 - x0, y1 - y0) || 1);
    out[b * 2] = x0 + (x1 - x0) * f;
    out[b * 2 + 1] = y0 + (y1 - y0) * f;
  }
  return out;
}

const MAX_BULBS = 120;
// Presents under the big tree by level (index 0: no event).
const GIFTS = [0, 2, 5, 9];

export const EventLogic = {
  CHOICES,
  EVENT_KEY,
  PREVIEW_MS,
  startPreview,
  active,
  cacheKey,
  loadChoice,
  saveChoice,
  adopt,
  bigTreeTile,
  lightString,
  MAX_BULBS,
  GIFTS,
};
