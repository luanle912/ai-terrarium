// The Christmas event's critters as logic (no DOM, no canvas; tests/event-critters.test.mjs): three reindeer grazing
// on the lawn, two elves carrying presents from the island's edge to a spot beside the front stairs, four penguins
// on the frozen lake, Santa's sleigh across the sky on Christmas Eve and Santa himself on Christmas Day. The page
// keeps one world `w` and one list per island and calls step() every frame; pose() says which sprite to show.
//
// w = { roam, roamList, clear, houses, drop, edge, ice, iceSet     the places (places(), worked out once)
//       level, eve, day     the event (EventLogic.active), level 0 without it
//       frozen, calm        the lake is iced over; the viewer asked for reduced motion
//       dogs                [{x, y}], who the reindeer look up at
//       only                'reindeer' on the other islands of the world view
//       now, rand }         seconds (step moves it on) and the dice
import { DogLogic } from './dog-logic.js';

const REINDEER = 3,
  REINDEER_FROM = 2,
  RANGE = 4,
  SPEED = 0.6,
  NOTICE = 2,
  DT_MAX = 0.25;
const ELVES = 2,
  ELF_FROM = 3,
  ELF_SPEED = 1,
  SLIP = 0.15,
  SLIP_FOR = 1.2,
  PLACE_FOR = 1.5;
const PENGUINS = 4,
  PENGUIN_FROM = 3,
  SLIDE = 2.5,
  SLIDE_SPEED = 2.2,
  WADDLE_SPEED = 0.5;
const SLEIGH_FOR = 14,
  FALL_FOR = 3,
  LANDED_MAX = 4,
  PLACED_MAX = 5;
const N8 = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];
const key = (x, y) => x + ',' + y,
  fl = Math.floor,
  cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
// Which way a step of (dx, dy) tiles points on the screen: 1 right, -1 left (screen x grows with x - y).
const facing = (dx, dy, was) => (dx - dy > 0.01 ? 1 : dx - dy < -0.01 ? -1 : was);

// The places on an island, worked out once from what the dogs roam over: `drop`, the lawn cell where the presents
// gather, two tiles west of the foot of the front stairs (so people coming down do not walk through them); `edge`,
// the lawn cell at the island's front edge nearest it, where the elves come from; `ice`, the lake's cells a cell or
// more from the shore, without those in `skip` (the pavilion and its stepping stones, where people bathe).
function places({ roam, roamList, clear, houses, stairs, water, skip = [] }) {
  const s = stairs.find(st => st.side === 'south'),
    no = new Set(skip);
  let drop = null,
    edge = null;
  if (s) {
    const at = [s.x - 2, s.y + 2];
    let best = 3;
    for (const c of roamList) {
      const d = Math.hypot(c[0] - at[0], c[1] - at[1]);
      if (d < best && !clear.has(key(c[0], c[1])) && (c[0] < s.x || c[0] >= s.x + s.len)) {
        best = d;
        drop = c;
      }
    }
  }
  if (drop)
    for (const c of roamList) {
      if (Math.abs(c[0] - drop[0]) > 6 || c[1] <= drop[1]) continue;
      if (!edge || c[1] > edge[1] || (c[1] === edge[1] && Math.abs(c[0] - drop[0]) < Math.abs(edge[0] - drop[0])))
        edge = c;
    }
  const ice = [];
  for (const k of water) {
    const [x, y] = k.split(',').map(Number);
    if (!no.has(k) && N8.every(([dx, dy]) => water.has(key(x + dx, y + dy)))) ice.push([x, y]);
  }
  return { roam, roamList, clear, houses, water, drop, edge, ice, iceSet: new Set(ice.map(c => key(c[0], c[1]))) };
}

// What is worked out once per world and kept on it (the places do not change while the page is open).
function known(w) {
  if (w.kept && w.kept.roam === w.roam && w.kept.ice === w.ice && w.kept.edge === w.edge && w.kept.drop === w.drop)
    return w.kept;
  const k = { roam: w.roam, ice: w.ice, edge: w.edge, drop: w.drop };
  k.homes = homes(w);
  k.route = route(w);
  k.huddle = huddle(w.ice || []);
  k.seat = seat(w, k.route);
  return (w.kept = k);
}

// Where the three reindeer live: the lawn cell furthest back, the one furthest east and the one furthest west and
// front, each with lawn all round it, off the paths, away from the kennels' doors and the presents, and more than
// RANGE from one another.
function homes(w) {
  const { roam, roamList = [], clear, houses = [], drop } = w,
    doors = new Set(houses.map(h => key(h.door[0], h.door[1]))),
    ok = roamList.filter(
      ([x, y]) =>
        !clear.has(key(x, y)) &&
        !doors.has(key(x, y)) &&
        !(drop && cheb([x, y], drop) <= 1) &&
        N8.every(([dx, dy]) => roam.has(key(x + dx, y + dy))),
    ),
    out = [];
  for (const score of [c => -c[1], c => c[0], c => c[1] - c[0]]) {
    let best = null;
    for (const c of ok) if (out.every(h => cheb(h, c) > RANGE) && (!best || score(c) > score(best))) best = c;
    if (best) out.push(best);
  }
  return out;
}

// The elves' way in: from `edge` to the lawn cell beside `drop` nearest the edge. null without one.
function route(w) {
  const { roam, clear, drop, edge } = w;
  if (!drop || !edge || !roam.has(key(edge[0], edge[1]))) return null;
  let by = null;
  for (const [dx, dy] of N8.slice(0, 4)) {
    const c = [drop[0] + dx, drop[1] + dy];
    if (!roam.has(key(c[0], c[1])) || clear.has(key(c[0], c[1]))) continue;
    if (!by || Math.hypot(c[0] - edge[0], c[1] - edge[1]) < Math.hypot(by[0] - edge[0], by[1] - edge[1])) by = c;
  }
  if (!by) return null;
  const no = key(drop[0], drop[1]),
    p = DogLogic.path({ has: k => k !== no && roam.has(k) }, edge, by);
  return p.length > 1 ? p : null;
}
const elfRoute = w => known(w).route;

// Where Santa sits on Christmas Day: a lawn cell beside the presents, off the paths, as far as can be from where
// the elves set theirs down.
function seat(w, r) {
  const { roam, clear, drop } = w;
  if (!drop) return null;
  const by = r ? r[r.length - 1] : drop;
  let best = null;
  for (const [dx, dy] of N8) {
    const c = [drop[0] + dx, drop[1] + dy];
    if (!roam.has(key(c[0], c[1])) || clear.has(key(c[0], c[1])) || (c[0] === by[0] && c[1] === by[1])) continue;
    if (!best || Math.hypot(c[0] - by[0], c[1] - by[1]) > Math.hypot(best[0] - by[0], best[1] - by[1])) best = c;
  }
  return best;
}

// Where the four penguins stand together: round the middle of the ice cell nearest the middle of the ice. null on a
// lake with fewer than six such cells.
function huddle(ice) {
  if (ice.length < 6) return null;
  let cx = 0,
    cy = 0;
  for (const c of ice) {
    cx += c[0] / ice.length;
    cy += c[1] / ice.length;
  }
  let mid = ice[0];
  for (const c of ice) if (Math.hypot(c[0] - cx, c[1] - cy) < Math.hypot(mid[0] - cx, mid[1] - cy)) mid = c;
  return [
    [-0.35, -0.2],
    [0.35, -0.3],
    [-0.3, 0.3],
    [0.3, 0.35],
  ].map(([dx, dy]) => [mid[0] + 0.5 + dx, mid[1] + 0.5 + dy]);
}

// How many of each kind the world calls for now: one object, used again.
const WANT = { reindeer: 0, elf: 0, penguin: 0, santa: 0 };
function wanted(w) {
  const lv = w.level || 0,
    k = lv ? known(w) : null,
    own = lv && !w.only;
  WANT.reindeer = lv >= REINDEER_FROM ? Math.min(REINDEER, k.homes.length) : 0;
  WANT.elf = own && lv >= ELF_FROM && !w.calm && k.route ? ELVES : 0;
  WANT.penguin = own && lv >= PENGUIN_FROM && w.frozen && k.huddle ? PENGUINS : 0;
  WANT.santa = own && w.day && k.seat ? 1 : 0;
  return WANT;
}

const KINDS = ['reindeer', 'elf', 'penguin', 'santa'];
function make(kind, id, w) {
  const k = known(w),
    c = { kind, id, x: 0, y: 0, face: 1, act: 'stand', until: 0, path: [], home: null, red: false };
  if (kind === 'reindeer') {
    c.home = k.homes[id];
    c.red = id === 0;
    c.act = 'graze';
    c.until = w.now + 3 + w.rand() * 8;
    c.face = id % 2 ? -1 : 1;
    c.dog = false;
    // the cells it strolls between
    c.cells = (w.roamList || []).filter(
      p =>
        Math.hypot(p[0] - c.home[0], p[1] - c.home[1]) <= RANGE &&
        !w.clear.has(key(p[0], p[1])) &&
        !(w.drop && cheb(p, w.drop) <= 1),
    );
  } else if (kind === 'elf') {
    c.home = k.route[0];
    c.act = 'away';
    c.until = w.now + 3 + id * 16 + w.rand() * 3;
    c.slipAt = -1;
    c.then = 'carry';
  } else if (kind === 'penguin') {
    c.home = k.huddle[id];
    c.face = id % 2 ? 1 : -1;
    c.tx = c.ty = 0;
  } else {
    c.home = k.seat;
    c.act = 'sit';
    c.face = facing(w.drop[0] - c.home[0], w.drop[1] - c.home[1], 1);
  }
  const mid = kind === 'penguin' ? 0 : 0.5;
  c.x = c.home[0] + mid;
  c.y = c.home[1] + mid;
  return c;
}
// Brings the list in line with wanted(): whoever no longer belongs goes, whoever is missing appears.
function sync(list, w) {
  const want = wanted(w);
  for (const kind of KINDS) {
    let have = 0;
    for (let i = list.length - 1; i >= 0; i--)
      if (list[i].kind === kind) {
        if (list[i].id >= want[kind]) list.splice(i, 1);
        else have++;
      }
    for (let id = have; id < want[kind]; id++) list.push(make(kind, id, w));
  }
}
function create(w) {
  const list = [];
  sync(list, w);
  fly(w);
  return list;
}

// Moves c along its path of points by `step` tiles; true once it has arrived.
function walk(c, step) {
  while (step > 0 && c.path.length) {
    const [tx, ty] = c.path[0],
      dx = tx - c.x,
      dy = ty - c.y,
      d = Math.hypot(dx, dy);
    c.face = facing(dx, dy, c.face);
    if (d <= step) {
      c.x = tx;
      c.y = ty;
      step -= d;
      c.path.shift();
    } else {
      c.x += (dx / d) * step;
      c.y += (dy / d) * step;
      step = 0;
    }
  }
  return !c.path.length;
}
const centres = cells => cells.map(p => [p[0] + 0.5, p[1] + 0.5]);

function stepDeer(c, w, dt) {
  if (w.calm) {
    c.act = 'graze';
    c.path.length = 0;
    return;
  }
  for (const d of w.dogs || [])
    if (Math.hypot(d.x - c.x, d.y - c.y) <= NOTICE) {
      c.act = 'look';
      c.dog = true;
      c.path.length = 0;
      c.face = facing(d.x - c.x, d.y - c.y, c.face);
      return;
    }
  if (c.dog) {
    c.dog = false;
    c.until = w.now + 1;
  }
  if (c.act === 'walk') {
    if (walk(c, SPEED * dt)) {
      c.act = 'graze';
      c.until = w.now + 6 + w.rand() * 8;
    }
  } else if (w.now >= c.until) {
    if (c.act === 'graze') {
      c.act = 'look';
      c.until = w.now + 2 + w.rand() * 2;
      return;
    }
    const to = c.cells.length ? c.cells[fl(w.rand() * c.cells.length)] : null,
      p = to ? DogLogic.path(w.roam, [fl(c.x), fl(c.y)], to) : [];
    if (p.length > 1) {
      c.path = centres(p.slice(1));
      c.act = 'walk';
    } else {
      c.act = 'graze';
      c.until = w.now + 6 + w.rand() * 8;
    }
  }
}

function stepElf(c, list, w, dt) {
  const r = known(w).route;
  switch (c.act) {
    case 'away':
      if (w.now < c.until) return;
      c.path = centres(r.slice(1));
      c.x = r[0][0] + 0.5;
      c.y = r[0][1] + 0.5;
      c.act = 'carry';
      // where on the way in it slips, if it does: counted in cells still to go
      c.slipAt = w.rand() < SLIP && r.length > 3 ? 1 + fl(w.rand() * (r.length - 3)) : -1;
      return;
    case 'slip':
      if (w.now >= c.until) c.act = c.then;
      return;
    case 'carry':
      if (c.path.length === c.slipAt) {
        c.slipAt = -1;
        c.then = 'carry';
        c.act = 'slip';
        c.until = w.now + SLIP_FOR;
        return;
      }
      // waits a step short while the other one is setting its present down
      if (c.path.length === 1 && list.some(o => o !== c && o.kind === 'elf' && o.act === 'place')) return;
      if (walk(c, ELF_SPEED * dt)) {
        c.act = 'place';
        c.until = w.now + PLACE_FOR;
        c.face = facing(w.drop[0] + 0.5 - c.x, w.drop[1] + 0.5 - c.y, c.face);
      }
      return;
    case 'place':
      if (w.now < c.until) return;
      c.path = centres(r.slice(0, -1).reverse());
      c.act = 'back';
      w.placed = Math.min(PLACED_MAX, (w.placed || 0) + 1);
      return;
    default:
      if (walk(c, ELF_SPEED * dt)) {
        c.act = 'away';
        c.until = w.now + 8 + w.rand() * 12;
      }
  }
}

const DIRS = N8.map(([dx, dy]) => [dx / Math.hypot(dx, dy), dy / Math.hypot(dx, dy)]);
function stepPenguin(c, list, w, dt) {
  if (w.calm) {
    // reduced motion: back in the huddle, standing
    if (c.act !== 'stand') {
      c.x = c.home[0];
      c.y = c.home[1];
      c.act = 'stand';
      w.slider = ((w.slider || 0) + 1) % PENGUINS;
    }
    return;
  }
  if (c.act === 'stand') {
    if (c.id === 0 && w.slideAt == null) w.slideAt = w.now + 6 + w.rand() * 4;
    if (w.slideAt == null || w.now < w.slideAt || c.id !== w.slider) return;
    // a way with ice all along it
    const first = fl(w.rand() * 8);
    for (let i = 0; i < 8; i++) {
      const [dx, dy] = DIRS[(first + i) % 8];
      let free = true;
      for (let s = 0.5; s <= SLIDE + 0.01 && free; s += 0.5)
        free = w.iceSet.has(key(fl(c.home[0] + dx * s), fl(c.home[1] + dy * s)));
      if (!free) continue;
      c.tx = c.home[0] + dx * SLIDE;
      c.ty = c.home[1] + dy * SLIDE;
      c.act = 'slide';
      w.slideAt = null;
      return;
    }
    w.slideAt = w.now + 2;
    w.slider = ((w.slider || 0) + 1) % PENGUINS;
    return;
  }
  const out = c.act === 'slide',
    tx = out ? c.tx : c.home[0],
    ty = out ? c.ty : c.home[1],
    dx = tx - c.x,
    dy = ty - c.y,
    d = Math.hypot(dx, dy),
    step = (out ? SLIDE_SPEED : WADDLE_SPEED) * dt;
  c.face = facing(dx, dy, c.face);
  if (d > step) {
    c.x += (dx / d) * step;
    c.y += (dy / d) * step;
    return;
  }
  c.x = tx;
  c.y = ty;
  if (out) c.act = 'waddle';
  else {
    c.act = 'stand';
    w.slider = ((w.slider || 0) + 1) % PENGUINS;
  }
}

// The sleigh and what it drops, kept on the world: w.sleighAt (when this flight began, or null), w.sleighNext (when
// the next one begins), w.parcels (two presents that may be falling: { on, t0, u, dir }), w.landed (how many of
// them lie at `drop`, at most LANDED_MAX) and w.placed (how many the elves have set down there, at most
// PLACED_MAX); the pile stays until the page is loaded again or the event ends.
function fly(w) {
  if (!w.parcels) {
    w.parcels = [0, 1].map(() => ({ on: false, t0: 0, u: 0, dir: 1 }));
    w.landed = w.placed = 0;
    w.sleighAt = null;
    w.sleighNext = null;
    w.slider = 0;
    w.slideAt = null;
  }
  if (!w.level) w.landed = w.placed = 0;
  for (const p of w.parcels)
    if (p.on && (w.now - p.t0 >= FALL_FOR || !w.level)) {
      p.on = false;
      if (w.level && w.landed < LANDED_MAX) w.landed++;
    }
  if (!w.eve || w.calm || w.only || !w.level) {
    w.sleighAt = w.sleighNext = null;
    return;
  }
  if (w.sleighAt == null) {
    if (w.sleighNext == null) w.sleighNext = w.now + 20 + w.rand() * 20;
    if (w.now < w.sleighNext) return;
    w.sleighAt = w.now;
    w.sleighDir = w.rand() < 0.5 ? 1 : -1;
    w.sleighTwo = w.rand() < 0.5;
    w.sleighDrops = 0;
  }
  const u = (w.now - w.sleighAt) / SLEIGH_FOR;
  if (u >= 1) {
    w.sleighAt = null;
    w.sleighNext = w.now + 180 + w.rand() * 120;
    return;
  }
  if (w.drop && ((w.sleighDrops === 0 && u >= 0.45) || (w.sleighDrops === 1 && w.sleighTwo && u >= 0.6))) {
    const p = w.parcels[w.sleighDrops++];
    p.on = true;
    p.t0 = w.now;
    p.u = u;
    p.dir = w.sleighDir;
  }
}
const SLEIGH = { u: 0, dir: 1, drops: 0 };
// The flight under way, or null: { u: 0..1 across the sky, dir: 1 rightward or -1, drops: presents let go so far }.
// One object, used again.
function sleigh(w) {
  if (w.sleighAt == null) return null;
  SLEIGH.u = (w.now - w.sleighAt) / SLEIGH_FOR;
  SLEIGH.dir = w.sleighDir;
  SLEIGH.drops = w.sleighDrops;
  return SLEIGH.u < 1 ? SLEIGH : null;
}
// The next flight begins with the next step (for a screenshot).
function flyNow(w) {
  if (w.sleighAt == null) w.sleighNext = w.now;
}

// One frame: dt seconds on (never more than DT_MAX at once, so a tab that was hidden does not make anyone jump).
function step(list, w, dt) {
  dt = dt > 0 ? Math.min(DT_MAX, dt) : 0;
  w.now += dt;
  sync(list, w);
  for (const c of list) {
    if (c.kind === 'reindeer') stepDeer(c, w, dt);
    else if (c.kind === 'elf') stepElf(c, list, w, dt);
    else if (c.kind === 'penguin') stepPenguin(c, list, w, dt);
  }
  fly(w);
  return list;
}

const POSE = { frame: 'stand', dy: 0, flip: false },
  WALK = ['walk1', 'walk2'],
  CARRY = ['carry1', 'carry2'],
  WADDLE = ['waddle1', 'waddle2'];
// Which sprite frame c shows at time t (seconds): one object, used again.
function pose(c, t) {
  const i = fl(t * 5 + c.id * 0.5) % 2;
  let frame = c.act;
  if (c.kind === 'reindeer') frame = c.act === 'walk' ? WALK[i] : c.act;
  else if (c.kind === 'elf') frame = c.act === 'carry' ? CARRY[i] : c.act === 'back' ? WALK[i] : c.act;
  else if (c.kind === 'penguin') frame = c.act === 'waddle' ? WADDLE[i] : c.act;
  else frame = (t + 3) % 10 < 1.2 ? 'wave' : 'sit';
  POSE.frame = frame;
  POSE.dy = 0;
  POSE.flip = c.face < 0;
  return POSE;
}

export const EventCritters = {
  REINDEER,
  REINDEER_FROM,
  RANGE,
  SPEED,
  NOTICE,
  DT_MAX,
  ELVES,
  ELF_FROM,
  ELF_SPEED,
  SLIP,
  SLIP_FOR,
  PLACE_FOR,
  PENGUINS,
  PENGUIN_FROM,
  SLIDE,
  SLIDE_SPEED,
  WADDLE_SPEED,
  SLEIGH_FOR,
  FALL_FOR,
  LANDED_MAX,
  PLACED_MAX,
  places,
  wanted,
  create,
  step,
  pose,
  elfRoute,
  huddle,
  sleigh,
  flyNow,
};
