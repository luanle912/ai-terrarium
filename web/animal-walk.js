// How the catchable animals move about the lawn. Decorative only: the server owns every rule, this only decides where
// an animal stands and how it walks. Pure (no DOM): tests/animal-walk.test.mjs imports it. step() never writes
// to a walker; it returns new ones, so the page keeps `walkers = AnimalWalk.step(walkers, w, dt)`.
import { DogLogic as D } from './dog-logic.js';

const key = (x, y) => x + ',' + y,
  cellOf = k => k.split(',').map(Number),
  fl = Math.floor;
const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const byYX = (a, b) => a[1] - b[1] || a[0] - b[0];
// Tiles per second; the dogs stroll at 1.1. Unknown species (kept by the server's validateState) walk at 1.
const SPEED = Object.freeze({
  hen: 1,
  duck: 0.8,
  rabbit: 1.8,
  tabby: 0.9,
  squirrel: 1.5,
  fox: 1.1,
  redpanda: 0.8,
  frog: 1.2,
  owl: 0.7,
  deer: 0.6,
  peacock: 0.75,
  snowfox: 1.2,
  unicorn: 1.1,
  dragon: 1,
});
const speedOf = s => (Object.hasOwn(SPEED, s) ? SPEED[s] : 1);
const LEAVE_PACE = 1.5,
  HOPS = new Set(['rabbit', 'frog']);
// Same hours as the dogs (22:00–6:00); the owl keeps the opposite ones.
const asleep = (species, h) => (species === 'owl' ? h >= 6 && h < 18 : D.isNight(h));

// Roam cells facing open sky: the outside flood runs only over non-land cells, so the office, water, trees and the
// strip behind the walls are never sky.
function edgeCells(roam, land, W, H) {
  const cells = [...roam].map(cellOf);
  if (!cells.length) return [];
  const xs = cells.map(c => c[0]),
    ys = cells.map(c => c[1]);
  const x0 = Math.min(...xs) - 1,
    x1 = Math.max(...xs) + 1,
    y0 = Math.min(...ys) - 1,
    y1 = Math.max(...ys) + 1;
  const solid = (x, y) => land.has(key(x, y)) || (x >= 0 && y >= 0 && x < W && y < H);
  const inBox = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const out = new Set(),
    q = [];
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      if ((x === x0 || x === x1 || y === y0 || y === y1) && !solid(x, y)) {
        out.add(key(x, y));
        q.push([x, y]);
      }
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of N4) {
      const nx = x + dx,
        ny = y + dy,
        k = key(nx, ny);
      if (inBox(nx, ny) && !out.has(k) && !solid(nx, ny)) {
        out.add(k);
        q.push([nx, ny]);
      }
    }
  }
  return cells.filter(([x, y]) => N4.some(([dx, dy]) => out.has(key(x + dx, y + dy)))).sort(byYX);
}
// The dogs' places minus their den, cut back to one connected piece; `settle` is where an animal may stop.
function places(dp) {
  const W = dp.W || 0,
    H = dp.H || 0,
    clear = dp.clear || new Set();
  const den = new Set((dp.den || []).map(c => key(c[0], c[1])));
  const roam = D.roamCells(new Set([...dp.roam].filter(k => !den.has(k))), { W, H, pond: new Set() });
  const settleList = [...roam]
    .filter(k => !clear.has(k))
    .map(cellOf)
    .sort(byYX);
  // Without the island's land (tests), the lawn the dogs know stands in for it.
  const land = dp.land || new Set([...dp.roam, ...clear, ...(dp.drink || []).map(s => key(s.tx, s.ty))]);
  return {
    W,
    H,
    roam,
    roamList: [...roam].map(cellOf),
    settle: new Set(settleList.map(c => key(c[0], c[1]))),
    settleList,
    clear,
    edge: edgeCells(roam, land, W, H),
  };
}

// FNV-1a with a final mix, so ids one digit apart land far apart.
function hash(id) {
  const s = String(id);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
// Every tab hashes the server's id to the same cell, preferring cells at the island's rim.
function spawnCell(id, p) {
  const list = p.settleList || [];
  if (!list.length) return null;
  const rim = list.filter(c => (p.edge || []).some(e => Math.max(Math.abs(e[0] - c[0]), Math.abs(e[1] - c[1])) <= 1));
  const from = rim.length ? rim : list;
  return [...from[hash(id) % from.length]];
}
function create(id, species, cell, rand) {
  if (typeof rand !== 'function') throw new TypeError('AnimalWalk.create needs a rand function');
  return {
    id,
    species,
    x: cell[0] + 0.5,
    y: cell[1] + 0.5,
    face: rand() < 0.5 ? -1 : 1,
    act: 'idle',
    until: null,
    wait: 0.5 + rand() * 2,
    path: [],
    speed: 0,
    hold: false,
    leave: false,
    done: false,
    calm: false,
    phase: (hash(id) % 1000) / 333,
    rand,
  };
}

const tileOf = d => [fl(d.x), fl(d.y)];
const settleable = (w, c) => w.settle.has(key(c[0], c[1]));
// Cell centres from the walker's tile to `cell` (null when unreachable).
function route(d, w, cell) {
  const p = D.path(w.roam, tileOf(d), cell);
  if (!p.length) return null;
  const rest = p.slice(1).map(c => [c[0] + 0.5, c[1] + 0.5]);
  return rest.length ? rest : [[cell[0] + 0.5, cell[1] + 0.5]];
}
// Cells other walkers stand on or head for, so two never stop on one cell.
function taken(d, all) {
  const out = new Set();
  for (const o of all) {
    if (o === d || o.id === d.id || o.done) continue;
    out.add(key(...tileOf(o)));
    const e = o.path && o.path[o.path.length - 1];
    if (e) out.add(key(fl(e[0]), fl(e[1])));
  }
  return out;
}
// A random free settle cell within r tiles, or null.
function near(d, w, r, busy) {
  const L = w.settleList;
  if (!L.length) return null;
  for (let i = 0; i < 20; i++) {
    const c = L[fl(d.rand() * L.length) % L.length];
    if (Math.abs(c[0] + 0.5 - d.x) <= r && Math.abs(c[1] + 0.5 - d.y) <= r && !busy.has(key(c[0], c[1]))) return c;
  }
  return null;
}
// The closest of `cells` a path reaches (only the nearest few are tried), with that path.
function nearest(d, w, cells, busy) {
  const dist = c => Math.hypot(c[0] + 0.5 - d.x, c[1] + 0.5 - d.y);
  const order = cells.filter(c => !busy.has(key(c[0], c[1]))).sort((a, b) => dist(a) - dist(b) || byYX(a, b));
  for (const c of order.slice(0, 8)) {
    const p = route(d, w, c);
    if (p) return p;
  }
  return null;
}
const walking = (d, act, path, pace = 1) => ({ ...d, act, path, speed: speedOf(d.species) * pace, until: Infinity });
const idle = (d, w, s) => ({ ...d, act: 'idle', path: [], until: w.now + s });
const toSettle = (d, w, busy) => nearest(d, w, w.settleList, busy) || nearest(d, w, w.settleList, new Set());
function goNear(d, w, busy, act, r) {
  const c = near(d, w, r, busy),
    p = c && route(d, w, c);
  return p ? walking(d, act, p) : idle(d, w, 1 + d.rand() * 2);
}
const startAct = (d, w) => ({
  ...d,
  act: 'act',
  path: [],
  until: w.now + 2 + d.rand() * 3,
  face: d.rand() < 0.5 ? -1 : 1,
});
function choose(opts, u) {
  let r = u * opts.reduce((s, o) => s + o[1], 0);
  for (const [o, wt] of opts) {
    if (r < wt) return o;
    r -= wt;
  }
  return opts[0][0];
}
function next(d, w, busy) {
  // Never stop on a path or stair foot: head for the nearest settle cell first (retry each second when stranded).
  if (!settleable(w, tileOf(d))) {
    const p = toSettle(d, w, busy);
    return p ? walking(d, 'wander', p) : idle(d, w, 1);
  }
  const c = choose(
    [
      ['wander', w.calm ? 2 : 4],
      ['act', 1.6],
      ['rest', w.hour >= 18 ? 2.4 : 1],
      ['idle', 1.4],
    ],
    d.rand(),
  );
  if (c === 'wander') return goNear(d, w, busy, 'wander', 5);
  if (c === 'rest') return goNear(d, w, busy, 'rest', 4);
  if (c === 'act') return startAct(d, w);
  return idle(d, w, 2 + d.rand() * 3);
}
function bedtime(d, w, busy) {
  if (d.act === 'sleep' || d.act === 'bed') return d;
  if (!d.path.length && settleable(w, tileOf(d))) return { ...d, act: 'sleep', until: Infinity };
  const p = toSettle(d, w, busy);
  return p ? walking(d, 'bed', p) : { ...d, act: 'sleep', path: [], until: Infinity };
}
function startLeave(d, w) {
  const p = nearest(d, w, w.edge, new Set());
  return p ? walking(d, 'leaving', p, LEAVE_PACE) : { ...d, act: 'leaving', path: [], done: true };
}
function move(d, dt) {
  const p = d.path;
  if (!p.length) return d;
  let step = (d.speed || 0) * dt,
    x = d.x,
    y = d.y,
    face = d.face,
    i = 0;
  while (step > 0 && i < p.length) {
    const [tx, ty] = p[i],
      dx = tx - x,
      dy = ty - y,
      len = Math.hypot(dx, dy);
    if (len > 0.001 && Math.abs(dx - dy) > 0.001) face = dx - dy < 0 ? -1 : 1;
    if (len <= step) {
      x = tx;
      y = ty;
      i++;
      step -= len;
    } else {
      x += (dx / len) * step;
      y += (dy / len) * step;
      step = 0;
    }
  }
  return { ...d, x, y, face, path: p.slice(i) };
}
function arrive(d, w) {
  switch (d.act) {
    case 'wander':
      return d.rand() < 0.35 ? startAct(d, w) : idle(d, w, 1 + d.rand() * 2);
    case 'rest':
      return { ...d, until: w.now + 12 + d.rand() * 20 };
    case 'bed':
      return { ...d, act: 'sleep', until: Infinity };
    case 'leaving':
      return { ...d, done: true };
    default:
      return d;
  }
}
function tick(d, w, busy) {
  if (d.path.length || w.now < d.until) return d;
  return d.act === 'idle' || d.act === 'act' || d.act === 'rest' ? next(d, w, busy) : d;
}
// Precedence: done > hold > leave > sleep > the day's wandering.
function stepOne(d0, all, w, dt) {
  if (d0.done) return d0;
  const calm = !!w.calm;
  let d = d0.calm === calm ? d0 : { ...d0, calm };
  if (d.hold) return d.act === 'hold' && !d.path.length ? d : { ...d, act: 'hold', path: [] };
  const busy = taken(d0, all);
  if (d.act === 'hold') d = idle(d, w, 0);
  if (d.until == null) d = { ...d, until: settleable(w, tileOf(d)) ? w.now + (d.wait || 0) : w.now };
  if (d.leave) {
    if (d.act !== 'leaving') d = startLeave(d, w);
  } else if (asleep(d.species, w.hour)) d = bedtime(d, w, busy);
  else if (d.act === 'sleep' || d.act === 'bed') d = idle(d, w, 1 + d.rand() * 3);
  if (d.done) return d;
  const had = d.path.length > 0;
  d = move(d, dt);
  if (had && !d.path.length) d = arrive(d, w);
  return d.act === 'leaving' ? d : tick(d, w, busy);
}
// w = {...places, now (s), hour, calm}. Each walker draws randomness from the rand it was created with.
function step(walkers, w, dt) {
  return walkers.map(d => stepOne(d, walkers, w, dt));
}

// Frame, mirroring and lift in pixels. Reduced motion: no hops and no flicker between act and stand.
function pose(d, t) {
  const ph = t + (d.phase || 0),
    flip = d.face < 0;
  if (d.path && d.path.length) {
    const odd = fl(ph * (2 + speedOf(d.species) * 2.5)) % 2 === 1;
    return { frame: odd ? 'walk2' : 'walk1', flip, dy: odd && !d.calm && HOPS.has(d.species) ? 2 : 0 };
  }
  if (d.act === 'sleep' || d.act === 'rest') return { frame: d.act, flip, dy: 0 };
  if (d.act === 'act') return { frame: d.calm || (ph * 0.8) % 2 < 1.5 ? 'act' : 'stand', flip, dy: 0 };
  return { frame: 'stand', flip, dy: 0 };
}

export { places, spawnCell, create, step, pose, SPEED };
export const AnimalWalk = { places, spawnCell, create, step, pose, SPEED };
