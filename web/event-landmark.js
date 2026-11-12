// The Christmas event's landmark as logic (no DOM, no canvas; tests/event-landmark.test.mjs): Notre-Dame of Saigon on
// the back lawn while the event is on. Where it stands, its massing (the art is drawn from the same boxes), and the
// lawn cells it takes from people and dogs, given back in their old order when the event ends.

const key = (x, y) => x + ',' + y,
  fl = Math.floor;
const frozen = o => {
  for (const v of Object.values(o)) if (typeof v === 'object') Object.freeze(v);
  return Object.freeze(o);
};

// The footprint is tiles x..x+w-1 by y..y+h-1, the facade on its +y face. `at` is the tile the sprite hangs on and `z`
// its depth among the scene's sorted sprites; `lady` and `ladyZ` the same for the statue's bed in the forecourt.
const SITE = frozen({ x: 19, y: -11, w: 4, h: 4, at: [22, -8], z: 12, lady: [20.5, -6], ladyZ: 15.5 });
// Boxes [i0, i1, j0, j1, h]: tiles in the local frame i = x - SITE.x, j = y - SITE.y, and px up. In order: the nave's
// walls to the eave, the left tower, the right tower, the bay between them.
const MASS = frozen([
  [0.375, 3.625, 0.375, 3, 22],
  [0.25, 1.25, 3, 4, 48],
  [2.75, 3.75, 3, 4, 48],
  [1.25, 2.75, 3, 3.875, 33],
]);

const FOOT = [];
for (let x = SITE.x; x < SITE.x + SITE.w; x++) for (let y = SITE.y; y < SITE.y + SITE.h; y++) FOOT.push(key(x, y));
const BED = ['20,-6', '21,-6'],
  // a dog here, or stepping in, is drawn before the walls, apart from the sorted sprites: the bed would paint over it
  BEFORE_BED = ['20,-5', '21,-5', '22,-5'],
  // behind the building, where 6 px of a dog or fewer would show: measured on the painted sprite against the dogs'
  // own, in every pose they hold (tests/event-landmark.test.mjs)
  SHADE = ['16,-11', '17,-11', '18,-11', '17,-10', '18,-10', '18,-9', '18,-12', '19,-12', '20,-12'];
// What people may not walk over while it stands, and what the dogs may not.
const WALK_OFF = new Set([...FOOT, ...BED]),
  ROAM_OFF = new Set([...WALK_OFF, ...BEFORE_BED, ...SHADE]);

// SITE when the island has an office (block) and every cell the landmark takes is free lawn, else null: an island of
// another shape gets no landmark rather than one standing in a lake. The site lies behind the office (y < 0), so the
// office itself never covers it.
function site(island, block) {
  if (!island || !block) return null;
  const { cells, paths, pond, mountain, decor = [], lamps = [], spots = [], rest } = island,
    taken = new Set([...decor, ...lamps, ...(rest ? [rest.bench, rest.fish] : [])].map(d => d && key(d.x, d.y))),
    sets = [paths && paths.cells, pond && pond.cells, mountain && mountain.cells, mountain && mountain.pool.cells];
  for (const k of WALK_OFF) {
    const [x, y] = k.split(',').map(Number);
    if (!cells.has(k) || taken.has(k) || sets.some(s => s && s.has(k))) return null;
    if (spots.some(s => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) return null;
  }
  return SITE;
}

// A dog sent off the site: it stands still and picks something new to do on its next step.
const stopped = () => ({ act: 'idle', path: [], until: 0, wag: false, partner: null, lead: false, playing: false });
const off = p => ROAM_OFF.has(key(fl(p[0]), fl(p[1])));
function shoo(land, dogs) {
  for (const d of dogs) {
    const inside = off([d.x, d.y]);
    if (!inside && !(d.path || []).some(off)) continue;
    if (inside) {
      let best = null,
        near = Infinity;
      for (const c of land.roamList) {
        const far = Math.hypot(c[0] + 0.5 - d.x, c[1] + 0.5 - d.y);
        if (far < near) {
          near = far;
          best = c;
        }
      }
      if (best) {
        d.x = best[0] + 0.5;
        d.y = best[1] + 0.5;
      }
    }
    // a runner or playmate left waiting for this dog would wait for good: only the leader ends a game
    const mate = d.partner;
    Object.assign(d, stopped());
    if (mate && mate.partner === d) Object.assign(mate, stopped());
  }
}

// What each lawn looked like before its first event, by its roamList.
const KEPT = new WeakMap();
// Takes the landmark's cells off the lawn (on) or gives them back. land = { walk, roam, roamList } is held by reference
// all over the page, so it is rewritten in place, in its first order (reindeer homes go by the list's order). While
// on, `dogs` standing on a reserved cell or heading across one are sent off. Untouched before the first event.
function reserve(land, on, dogs) {
  on = !!on;
  let kept = KEPT.get(land.roamList);
  if (!kept) {
    if (!on) return;
    kept = { walk: [...land.walk], roam: [...land.roam], list: [...land.roamList], on: false };
    KEPT.set(land.roamList, kept);
  }
  if (kept.on !== on) {
    kept.on = on;
    land.walk.clear();
    for (const k of kept.walk) if (!on || !WALK_OFF.has(k)) land.walk.add(k);
    land.roam.clear();
    for (const k of kept.roam) if (!on || !ROAM_OFF.has(k)) land.roam.add(k);
    land.roamList.length = 0;
    for (const c of kept.list) if (!on || !off(c)) land.roamList.push(c);
  }
  if (on) shoo(land, dogs || []);
}

export const EventLandmark = { SITE, MASS, WALK_OFF, ROAM_OFF, site, reserve };
