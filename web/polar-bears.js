// The polar bears as logic (no DOM, no canvas; tests/polar-bears.test.mjs): a mother and her cub living round an
// igloo on the back lawn beside the mountain, there all winter (not only during the Christmas event). The mother
// ambles from one spot of their lawn to another and stops to look about or lie down a while; the cub trots after
// her and lies down beside her. At night both sleep by the igloo door. Bears are dangerous, so a wider ring round
// their lawn (layout().keep) is taken off everyone else's ground in web/office-scene.js: people, dogs and the
// Christmas critters never go near.
//
// w = { winter, night, calm, now, rand }: the season is winter; it is night; the viewer asked for reduced motion
// (they stand still); seconds (step moves it on) and the dice.
import { DogLogic } from './dog-logic.js';

const key = (x, y) => x + ',' + y,
  DT_MAX = 0.25,
  WALK = 0.55, // tiles a second, the mother's amble
  TROT = 0.95, // the cub's, catching up
  NEAR = 1.6, // how far the cub lets her get before it follows
  ZONE_R = 3.2, // their lawn: open lawn this far from the igloo's middle
  KEEP_R = 5.5; // the ring kept clear: nobody comes within two or three tiles of their lawn

// Their places, worked out once: `walk` is the open lawn, `at` the igloo's back corner cell (it takes 2 × 2 cells).
// { igloo: {x, y}, cells: Set (the igloo), door: [x, y] (the cell in front of its door), zone: [[x, y]], zoneSet,
//   keep: Set (everything within KEEP_R of its middle, igloo included) }
function layout({ walk, at }) {
  const [ix, iy] = at,
    cx = ix + 1,
    cy = iy + 1,
    cells = new Set([key(ix, iy), key(ix + 1, iy), key(ix, iy + 1), key(ix + 1, iy + 1)]),
    zone = [],
    keep = new Set();
  for (let y = Math.floor(cy - KEEP_R); y <= Math.ceil(cy + KEEP_R); y++)
    for (let x = Math.floor(cx - KEEP_R); x <= Math.ceil(cx + KEEP_R); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy),
        k = key(x, y);
      if (d <= KEEP_R || cells.has(k)) keep.add(k);
      if (d <= ZONE_R && walk.has(k) && !cells.has(k)) zone.push([x, y]);
    }
  // the door looks toward the viewer, out of the igloo's front corner
  const zoneSet = new Set(zone.map(c => key(...c))),
    door = [ix + 2, iy + 1],
    // where the cub sleeps: beside its mother at the door, toward the viewer
    beside =
      [
        [ix + 2, iy + 2],
        [ix + 3, iy + 1],
      ].find(c => zoneSet.has(key(...c))) || door;
  return { igloo: { x: ix, y: iy }, cells, door, beside, zone, zoneSet, keep };
}

function create(L) {
  const [dx, dy] = L.door;
  const bear = (kind, x, y) => ({ kind, x, y, act: 'stand', t: 2, path: [], face: 1, away: false, speed: 0 });
  return [bear('bear', dx + 0.5, dy + 0.5), bear('cub', dx + 0.5, dy + 1.5)].map(b =>
    L.zoneSet.has(key(Math.floor(b.x), Math.floor(b.y))) ? b : { ...b, x: dx + 0.5, y: dy + 0.5 },
  );
}

const centre = ([x, y]) => [x + 0.5, y + 0.5];
function goTo(b, L, tile, speed) {
  const p = DogLogic.path(L.zoneSet, [Math.floor(b.x), Math.floor(b.y)], tile);
  b.path = p.slice(1).map(centre);
  b.speed = speed;
  b.act = b.path.length ? 'walk' : b.act;
}
function move(b, dt) {
  let step = b.speed * dt;
  while (step > 0 && b.path.length) {
    const [tx, ty] = b.path[0],
      dx = tx - b.x,
      dy = ty - b.y,
      len = Math.hypot(dx, dy);
    if (len > 0.001 && Math.abs(dx - dy) > 0.001) b.face = dx - dy < 0 ? -1 : 1;
    if (len <= step) {
      b.x = tx;
      b.y = ty;
      b.path.shift();
      step -= len;
    } else {
      b.x += (dx / len) * step;
      b.y += (dy / len) * step;
      step = 0;
    }
  }
}
// The zone cell nearest a point, that is not `not`.
function nearest(L, x, y, not) {
  let best = null,
    bd = Infinity;
  for (const c of L.zone) {
    if (not && c[0] === not[0] && c[1] === not[1]) continue;
    const d = Math.hypot(c[0] + 0.5 - x, c[1] + 0.5 - y);
    if (d < bd) (bd = d), (best = c);
  }
  return best;
}

function mother(b, L, w, dt) {
  if (b.path.length) return move(b, dt);
  if (b.act === 'walk')
    (b.act = w.rand() < 0.25 ? 'lie' : 'stand'), (b.t = b.act === 'lie' ? 12 + w.rand() * 14 : 4 + w.rand() * 6);
  if (w.night) {
    const bed = L.door;
    if (Math.floor(b.x) !== bed[0] || Math.floor(b.y) !== bed[1]) return goTo(b, L, bed, WALK);
    b.act = 'lie';
    return;
  }
  b.t -= dt;
  if (b.t > 0) return;
  goTo(b, L, L.zone[Math.floor(w.rand() * L.zone.length) % L.zone.length], WALK);
  if (!b.path.length) b.t = 2;
}
function cub(c, m, L, w, dt) {
  if (c.path.length) return move(c, dt);
  if (w.night) {
    const bed = L.beside;
    if (Math.floor(c.x) !== bed[0] || Math.floor(c.y) !== bed[1]) return goTo(c, L, bed, TROT);
    c.act = 'lie';
    c.face = -1;
    return;
  }
  const d = Math.hypot(m.x - c.x, m.y - c.y);
  if (d > NEAR) {
    // to the cell beside her, on the side it is coming from
    const tile = nearest(L, m.x + ((c.x - m.x) / d) * 0.9, m.y + ((c.y - m.y) / d) * 0.9, [
      Math.floor(m.x),
      Math.floor(m.y),
    ]);
    if (tile) goTo(c, L, tile, TROT);
    if (c.path.length) return;
  }
  c.act = m.act === 'lie' ? 'lie' : 'stand';
  if (Math.abs(m.x - m.y - (c.x - c.y)) > 0.05) c.face = m.x - m.y < c.x - c.y ? -1 : 1;
}

// One frame: dt seconds on (never more than DT_MAX at once, so a tab that was hidden does not make anyone jump).
function step(list, L, w, dt) {
  dt = dt > 0 ? Math.min(DT_MAX, dt) : 0;
  w.now += dt;
  const away = !w.winter || !L.zone.length;
  for (const b of list) b.away = away;
  if (away || w.calm || list.length < 2) return;
  mother(list[0], L, w, dt);
  cub(list[1], list[0], L, w, dt);
}

// Which sprite to show: { frame, flip }. A walking bear steps along with the distance it covers.
function pose(b, t) {
  if (b.act === 'walk' && b.path.length) {
    const rate = b.kind === 'cub' ? 6 : 3.5;
    return { frame: Math.floor(t * rate) % 2 ? 'walk2' : 'walk1', flip: b.face < 0 };
  }
  return { frame: b.act === 'lie' ? 'lie' : 'stand', flip: b.face < 0 };
}

export const PolarBears = { DT_MAX, ZONE_R, KEEP_R, layout, create, step, pose };
