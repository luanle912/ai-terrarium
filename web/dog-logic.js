// The three office dogs out on the lawn: where they may go, what they do next and which pose they show.
// Pure (no DOM, no canvas): the page and tests/dog-logic.test.mjs both run this block. Randomness comes in
// through world.rand so a test can replay a whole day.
const BREEDS = ['corgi', 'husky', 'dalmatian'];
const key = (x, y) => x + ',' + y,
  fl = Math.floor;
// Tiles per second. A corgi's short legs cover less ground; the long-legged dalmatian is the fastest.
const STROLL = 1.1,
  RUN = 3.2,
  LEGS = { corgi: 0.88, husky: 1.06, dalmatian: 1.12 };
const N8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const isNight = h => h >= 22 || h < 6;
// How far a dog's colours blend toward the night blue (#0d1322): half of what the lawn gets (SkyRender.night uses
// (1-df)*0.6). The dogs are characters, like the people (who are not dimmed at all), so they must stay readable at
// night while still looking lit by the same moon.
const nightMix = df => (1 - df) * 0.3;

// Whether a dog on (x, y) would be drawn over something that should hide it. The office walls go down before the
// sorted sprites, so a dog in the strip right behind them, within `reach` tiles (its feet climb 16 px up the screen
// per tile, the walls rise reach × 16 px) and in a screen column the walls cover, would show through them. `tall`
// lists things baked into the island picture as [x, y, reach]: a dog up to `reach` tiles behind one, in its screen
// column (x − y within a tile), would be drawn over it.
function hidden(x, y, W, H, reach, tall) {
  if (x < 0 && x >= -reach && y - x >= -1 && y - x <= H + 1) return true;
  if (y < 0 && y >= -reach && x - y >= -1 && x - y <= W + 1) return true;
  return tall.some(([tx, ty, r]) => Math.abs(tx - ty - (x - y)) <= 1 && tx + ty > x + y && tx + ty - (x + y) <= r);
}
// Lawn cells a dog may stand on: the walkable lawn minus the office, water, reserved areas and the cells where it
// would be drawn over the walls or something tall (hidden).
function roamCells(walk, { W, H, pond, avoid = [], wallReach = 4, tall = [] }) {
  const out = new Set();
  for (const k of walk) {
    const [x, y] = k.split(',').map(Number);
    if ((x >= 0 && y >= 0 && x < W && y < H) || pond.has(k) || hidden(x, y, W, H, wallReach, tall)) continue;
    if (avoid.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) continue;
    out.add(k);
  }
  // Keep only the largest connected piece (same moves as path()): a cell boxed in by a tree, a rock and the cliff
  // would trap a dog that started or wandered there.
  let best = new Set();
  const seen = new Set();
  for (const k of out) {
    if (seen.has(k)) continue;
    const part = new Set([k]),
      q = [k.split(',').map(Number)];
    seen.add(k);
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of N8) {
        const c = key(x + dx, y + dy);
        if (seen.has(c) || !out.has(c)) continue;
        if (dx && dy && (!out.has(key(x + dx, y)) || !out.has(key(x, y + dy)))) continue;
        seen.add(c);
        part.add(c);
        q.push([x + dx, y + dy]);
      }
    }
    if (part.size > best.size) best = part;
  }
  return best;
}
// Shortest path over roam cells, 8 directions, never cutting the corner of a cell the dog may not enter.
function path(roam, from, to) {
  const s = key(from[0], from[1]),
    g = key(to[0], to[1]);
  if (!roam.has(g)) return [];
  const prev = new Map([[s, null]]),
    q = [[from[0], from[1]]];
  for (let i = 0; i < q.length && !prev.has(g); i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of N8) {
      const nx = x + dx,
        ny = y + dy,
        k = key(nx, ny);
      if (prev.has(k) || !roam.has(k)) continue;
      if (dx && dy && (!roam.has(key(x + dx, y)) || !roam.has(key(x, y + dy)))) continue;
      prev.set(k, key(x, y));
      q.push([nx, ny]);
    }
  }
  if (!prev.has(g)) return [];
  const out = [];
  for (let k = g; k !== null; k = prev.get(k)) out.push(k.split(',').map(Number));
  return out.reverse();
}
// `clear` holds the cells dogs may run across but never settle on (stone paths, the foot of each stair flight):
// every spot where a dog lies, sits, sleeps, sniffs or drinks is picked outside it.
// Lawn cells right at the water's edge, each with the water cell it faces.
function drinkSpots(roam, pond, clear = new Set()) {
  const out = [],
    seen = new Set();
  for (const k of pond) {
    const [px, py] = k.split(',').map(Number);
    for (const [dx, dy] of N8.slice(0, 4)) {
      const x = px + dx,
        y = py + dy,
        c = key(x, y);
      if (roam.has(c) && !clear.has(c) && !seen.has(c)) {
        seen.add(c);
        out.push({ x, y, tx: px, ty: py });
      }
    }
  }
  return out;
}
// Where the dogs curl up at night: three cells together at the foot of a tree, off the paths. Ties go to the cell
// nearer the viewer, so the trunk does not hide a sleeping dog.
function denCells(roam, tree, clear = new Set()) {
  const tx = tree[0] + 0.5,
    ty = tree[1] + 0.5,
    cells = [...roam].filter(k => !clear.has(k)).map(k => k.split(',').map(Number));
  const by = (a, b) =>
    (a[0] + 0.5 - tx) ** 2 + (a[1] + 0.5 - ty) ** 2 - ((b[0] + 0.5 - tx) ** 2 + (b[1] + 0.5 - ty) ** 2) ||
    b[0] + b[1] - (a[0] + a[1]);
  const den = [];
  while (den.length < 3) {
    const next = cells
      .filter(
        c =>
          !den.some(o => o[0] === c[0] && o[1] === c[1]) &&
          (!den.length || den.some(o => Math.max(Math.abs(o[0] - c[0]), Math.abs(o[1] - c[1])) === 1)),
      )
      .sort(by)[0];
    if (!next) break;
    den.push(next);
  }
  return den;
}
// The quiet cell right beside a seat (the bench at the rest corner) where a dog lies while someone sits there: off the
// paths, on the viewer's side first so the seat and the person never hide it, and never in the screen column (x − y
// within a tile) right behind where someone else stands (`people`, [x, y] points, e.g. the angler). Null when there is
// none.
function besideCell(roam, at, clear = new Set(), people = []) {
  const out = [];
  for (const [dx, dy] of N8) {
    const c = [at[0] + dx, at[1] + dy],
      cx = c[0] + 0.5,
      cy = c[1] + 0.5;
    if (!roam.has(key(c[0], c[1])) || clear.has(key(c[0], c[1]))) continue;
    if (people.some(([x, y]) => Math.abs(x - y - (cx - cy)) < 1 && x + y > cx + cy)) continue;
    out.push(c);
  }
  return out.sort((p, q) => q[0] + q[1] - (p[0] + p[1]) || Math.abs(p[0] - at[0]) - Math.abs(q[0] - at[0]))[0] || null;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Facing on screen: +1 = right. Screen x grows with x−y, so that is what decides left or right.
const faceToward = (d, tx, ty) => (tx - ty - (d.x - d.y) < 0 ? -1 : 1);
const tileOf = d => [fl(d.x), fl(d.y)];
const pick = (arr, r) => arr[fl(r() * arr.length) % arr.length];
function goTo(d, w, tile, speed) {
  const p = path(w.roam, tileOf(d), tile);
  if (!p.length) return false;
  d.path = p.slice(1).map(c => [c[0] + 0.5, c[1] + 0.5]);
  if (!d.path.length) d.path = [[tile[0] + 0.5, tile[1] + 0.5]];
  d.speed = speed;
  return true;
}
const settleable = (w, c) => !(w.clear && w.clear.has(key(c[0], c[1])));
// A random cell within r tiles where a dog may stop (null when none turned up).
function near(d, w, r) {
  for (let i = 0; i < 20; i++) {
    const c = pick(w.roamList, w.rand);
    if (Math.abs(c[0] + 0.5 - d.x) <= r && Math.abs(c[1] + 0.5 - d.y) <= r && settleable(w, c)) return c;
  }
  return null;
}
function idle(d, w, s, happy) {
  d.act = 'idle';
  d.path = [];
  d.until = w.now + s;
  d.wag = !!happy;
  d.partner = null;
  d.lead = false;
}
// Mostly a stroll of a few tiles; now and then (FAR_WALK) a long walk to anywhere on the lawn, so the dogs get round
// to the back lawn and the lake shore too.
const FAR_WALK = 0.2;
function wander(d, w) {
  d.act = 'wander';
  d.wag = false;
  const c = near(d, w, w.rand() < FAR_WALK ? 99 : 6);
  if (!c || !goTo(d, w, c, STROLL * LEGS[d.breed])) idle(d, w, 1 + w.rand() * 2);
}
function rest(d, dogs, w) {
  d.act = 'rest';
  d.wag = false;
  d.until = Infinity;
  // Half the time lie down next to a dog that is already resting.
  const buddy = dogs.find(o => o !== d && o.act === 'rest' && !o.path.length);
  const spot = (buddy && w.rand() < 0.5 && near(buddy, w, 1.5)) || near(d, w, 5);
  if (!spot || !goTo(d, w, spot, STROLL * LEGS[d.breed])) wander(d, w);
}
function drink(d, w) {
  if (w.frozen || !w.drink.length) return wander(d, w);
  const s = [...w.drink].sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[
    fl(w.rand() * 3) % w.drink.length
  ];
  d.act = 'drink';
  d.wag = false;
  d.spot = s;
  d.until = Infinity;
  if (!goTo(d, w, [s.x, s.y], STROLL * LEGS[d.breed])) wander(d, w);
}
// Chase: the runner dashes off, stops to look back when it has room, the chaser closes in; a catch ends in a play
// bow, then they swap. The chaser is always a little faster than the runner so every round ends.
function startChase(a, b, w) {
  a.rounds = 1 + (w.rand() < 0.6 ? 1 : 0) + (w.rand() < 0.3 ? 1 : 0);
  round(a, b, w);
}
function round(a, b, w) {
  const rs = RUN * LEGS[b.breed];
  b.act = 'flee';
  b.partner = a;
  b.lead = false;
  b.wag = true;
  flee(b, a, w, rs);
  a.act = 'chase';
  a.partner = b;
  a.lead = true;
  a.wag = true;
  a.repath = 0;
  a.roundEnd = w.now + 12;
  a.speed = Math.max(RUN * LEGS[a.breed], rs * 1.15);
  a.path = [];
}
function flee(b, a, w, speed) {
  let best = null,
    bd = -1;
  for (let i = 0; i < 10; i++) {
    const c = pick(w.roamList, w.rand),
      dx = c[0] + 0.5 - b.x,
      dy = c[1] + 0.5 - b.y;
    if (Math.abs(dx) > 7 || Math.abs(dy) > 7 || !settleable(w, c)) continue;
    const da = Math.hypot(c[0] + 0.5 - a.x, c[1] + 0.5 - a.y);
    if (da > bd) {
      bd = da;
      best = c;
    }
  }
  if (!best || !goTo(b, w, best, speed || b.speed)) {
    b.path = [];
  }
}
function bow(a, b, w, s) {
  for (const [d, o] of [
    [a, b],
    [b, a],
  ]) {
    d.act = 'bow';
    d.path = [];
    d.face = faceToward(d, o.x, o.y);
    d.until = w.now + s;
    d.wag = true;
  }
}
// Play: one trots up to the other, then both bow and hop at each other for a few seconds.
function startPlay(a, b, w) {
  a.act = 'play';
  a.partner = b;
  a.lead = true;
  a.wag = true;
  a.until = Infinity;
  b.act = 'play';
  b.partner = a;
  b.lead = false;
  b.wag = true;
  b.until = Infinity;
  b.path = [];
  b.face = faceToward(b, a.x, a.y);
  const t = tileOf(b),
    side = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
      .map(([dx, dy]) => [t[0] + dx, t[1] + dy])
      .filter(c => w.roam.has(key(...c)) && settleable(w, c));
  if (!side.length || !goTo(a, w, pick(side, w.rand), RUN * 0.7 * LEGS[a.breed])) {
    idle(a, w, 1, true);
    idle(b, w, 1, true);
  }
}
// Zoomies: the husky tears round a loop of nearby points on its own.
function zoom(d, w) {
  d.act = 'zoom';
  d.wag = true;
  d.laps = 3 + fl(w.rand() * 3);
  const c = near(d, w, 5);
  if (!c || !goTo(d, w, c, RUN * 1.15 * LEGS[d.breed])) idle(d, w, 1, true);
}

const isFree = d => d.act === 'idle' || d.act === 'wander' || d.act === 'sniff';
function next(d, dogs, w) {
  const evening = w.hour >= 18,
    free = dogs.filter(o => o !== d && isFree(o));
  const opts = [
    ['wander', 4],
    ['rest', evening ? 3.2 : 1.4],
    ['drink', 0.8],
  ];
  // The lakes are iced over in winter (w.frozen): no drinking there.
  if (w.frozen) opts.pop();
  // With reduced motion (w.calm) they only stroll, sniff, drink and nap: no dashing about.
  if (free.length && !w.calm) opts.push(['chase', evening ? 0.3 : 1.3], ['play', evening ? 0.3 : 0.9]);
  if (d.breed === 'husky' && !w.calm) opts.push(['zoom', 0.35 + 1.6 * (w.snow || 0)]);
  let r = w.rand() * opts.reduce((s, o) => s + o[1], 0),
    choice = opts[0][0];
  for (const [o, wt] of opts) {
    if (r < wt) {
      choice = o;
      break;
    }
    r -= wt;
  }
  const mate = () => pick(free, w.rand);
  if (choice === 'wander') wander(d, w);
  else if (choice === 'rest') rest(d, dogs, w);
  else if (choice === 'drink') drink(d, w);
  else if (choice === 'chase') startChase(d, mate(), w);
  else if (choice === 'play') startPlay(d, mate(), w);
  else zoom(d, w);
}

// A person out on the lawn (bathing in the pond, walking past) gets one dog trotting over to sit by them, wagging.
const GREET_AGAIN = 90;
// Dogs keep away from the smoke: nobody greets a person smoking or heading to the smoking corner (act 'smoke').
const greetable = w => (w.agents || []).filter(a => a.act !== 'smoke');
function greet(dogs, w) {
  for (const a of greetable(w)) {
    if (dogs.some(d => d.greet === a.id && (d.act === 'greet' || d.act === 'sit' || d.act === 'company'))) continue;
    if (dogs.some(d => (d.greeted || {})[a.id] > w.now - GREET_AGAIN)) continue;
    const cand = dogs
      .filter(d => isFree(d) || (d.act === 'rest' && !d.path.length))
      .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
    if (!cand) continue;
    cand.greeted = cand.greeted || {};
    cand.greeted[a.id] = w.now;
    cand.act = 'greet';
    cand.greet = a.id;
    cand.wag = true;
    cand.until = w.now + 25;
    cand.repath = 0;
  }
}
// Someone sitting on the bench at the rest corner (act 'bench', arrived: `at`) gets one dog lying on the cell beside it
// (w.rest) for as long as they sit, used like the den: it stays there into the night. A free or resting dog comes, or
// the one already greeting them.
const benchSitter = w => (w.agents || []).find(a => a.act === 'bench' && a.at);
function company(dogs, w) {
  const a = w.rest && benchSitter(w);
  if (!a || dogs.some(d => d.act === 'company')) return;
  const [rx, ry] = w.rest,
    cand = dogs
      .filter(
        d =>
          !(d.noCompany > w.now) &&
          (isFree(d) ||
            (d.act === 'rest' && !d.path.length) ||
            ((d.act === 'greet' || d.act === 'sit') && d.greet === a.id)),
      )
      .sort((p, q) => Math.hypot(p.x - rx, p.y - ry) - Math.hypot(q.x - rx, q.y - ry))[0];
  if (!cand) return;
  Object.assign(cand, { act: 'company', greet: a.id, partner: null, lead: false, wag: false, until: Infinity });
  // a dog that cannot get there is left out for a while, so the path search is not retried every step
  if (!goTo(cand, w, w.rest, STROLL * LEGS[cand.breed])) idle(cand, w, 1), (cand.noCompany = w.now + 30);
}
// The cell a greeting dog sits on: right beside the person, or on the nearest bank when they bathe out in the pond
// with water all round; off the path if any such cell is free, else on it anyway.
function greetSpot(d, a, w) {
  const t = [fl(a.x), fl(a.y)];
  for (const r of [1, 2]) {
    const cands = [];
    // Ring 2 leaves out its far corners (2.8 tiles off) so the dog still sits close by.
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (
          Math.max(Math.abs(dx), Math.abs(dy)) === r &&
          Math.hypot(dx, dy) < 2.3 &&
          w.roam.has(key(t[0] + dx, t[1] + dy))
        )
          cands.push([t[0] + dx, t[1] + dy]);
    if (!cands.length) continue;
    const off = cands.filter(c => settleable(w, c));
    // The viewer's side first (largest x+y), so furniture and the person never hide the dog; then the nearest.
    return (off.length ? off : cands).sort(
      (p, q) =>
        q[0] + q[1] - (p[0] + p[1]) ||
        Math.hypot(p[0] + 0.5 - d.x, p[1] + 0.5 - d.y) - Math.hypot(q[0] + 0.5 - d.x, q[1] + 0.5 - d.y),
    )[0];
  }
  return null;
}

function move(d, w, dt) {
  let step = (d.speed || 0) * dt;
  while (step > 0 && d.path.length) {
    const [tx, ty] = d.path[0],
      dx = tx - d.x,
      dy = ty - d.y,
      len = Math.hypot(dx, dy);
    if (len > 0.001 && Math.abs(dx - dy) > 0.001) d.face = dx - dy < 0 ? -1 : 1;
    if (len <= step) {
      d.x = tx;
      d.y = ty;
      d.path.shift();
      step -= len;
    } else {
      d.x += (dx / len) * step;
      d.y += (dy / len) * step;
      step = 0;
    }
  }
}
// What a dog does once it has got where it was going.
function arrive(d, dogs, w) {
  const r = w.rand;
  switch (d.act) {
    case 'wander':
      if (r() < 0.5) {
        d.act = 'sniff';
        d.until = w.now + 1.5 + r() * 2;
      } else idle(d, w, 1 + r() * 2);
      break;
    case 'rest':
      d.until = w.now + 14 + r() * 22;
      break;
    case 'drink':
      d.face = faceToward(d, d.spot.tx + 0.5, d.spot.ty + 0.5);
      d.until = w.now + 3 + r() * 2.5;
      break;
    case 'den':
      d.act = 'sleep';
      d.face = dogs.indexOf(d) % 2 ? -1 : 1;
      break;
    case 'zoom': {
      const c = --d.laps > 0 && near(d, w, 5);
      if (c) goTo(d, w, c, d.speed);
      else idle(d, w, 2 + r() * 2, true);
      break;
    }
    case 'flee':
      d.face = faceToward(d, d.partner.x, d.partner.y);
      break;
    case 'play':
      if (d.lead) {
        const b = d.partner;
        d.face = faceToward(d, b.x, b.y);
        b.face = faceToward(b, d.x, d.y);
        d.until = b.until = w.now + 3.5 + r() * 2.5;
        d.playing = b.playing = true;
      }
      break;
  }
}
function tick(d, dogs, w) {
  const done = w.now >= d.until,
    still = !d.path.length;
  switch (d.act) {
    case 'idle':
    case 'sniff':
      if (done) next(d, dogs, w);
      break;
    case 'wander':
    case 'zoom':
    case 'den':
      if (still && d.act === 'wander') next(d, dogs, w);
      break;
    case 'rest':
    case 'drink':
      if (still && done) idle(d, w, 1 + w.rand() * 2);
      break;
    case 'sleep':
      break;
    case 'chase': {
      const b = d.partner;
      if (dist(d, b) < 0.9 || w.now > d.roundEnd) {
        d.rounds--;
        bow(d, b, w, 1.4);
        break;
      }
      if (w.now >= d.repath) {
        d.repath = w.now + 0.4;
        goTo(d, w, tileOf(b), d.speed);
      }
      break;
    }
    case 'flee': {
      const a = d.partner;
      if (still && dist(d, a) < 2.6) flee(d, a, w, d.speed);
      break;
    }
    case 'bow':
      if (done && d.lead) {
        const b = d.partner;
        if (d.rounds > 0) {
          b.rounds = d.rounds;
          d.lead = false;
          round(b, d, w);
        } else {
          idle(d, w, 2 + w.rand() * 2, true);
          idle(b, w, 2 + w.rand() * 2, true);
        }
      } else if (done && !d.partner) idle(d, w, 1);
      break;
    case 'play':
      if (d.lead && d.playing && done) {
        const b = d.partner;
        d.playing = b.playing = false;
        idle(d, w, 2, true);
        idle(b, w, 2.5, true);
      }
      break;
    case 'greet': {
      const a = greetable(w).find(o => o.id === d.greet);
      if (!a || done) {
        d.greet = null;
        idle(d, w, 1);
        break;
      }
      // Re-aim once a second (the person may still be walking); sit once standing still on the chosen cell.
      if (w.now >= d.repath) {
        d.repath = w.now + 1;
        d.seat = greetSpot(d, a, w);
        if (d.seat && (d.seat[0] !== fl(d.x) || d.seat[1] !== fl(d.y))) goTo(d, w, d.seat, RUN * 0.75 * LEGS[d.breed]);
      }
      if (still && d.seat && d.seat[0] === fl(d.x) && d.seat[1] === fl(d.y)) {
        d.act = 'sit';
        d.face = faceToward(d, a.x, a.y);
        d.until = w.now + 8 + w.rand() * 5;
        d.since = w.now;
      }
      break;
    }
    case 'sit': {
      const a = greetable(w).find(o => o.id === d.greet);
      if (a) d.face = faceToward(d, a.x, a.y);
      if (!a || done) {
        d.greet = null;
        idle(d, w, 1.5, true);
      }
      break;
    }
    case 'company': {
      const a = benchSitter(w);
      if (!a || a.id !== d.greet) {
        d.greet = null;
        idle(d, w, 1.5, true);
      } else if (still) d.face = faceToward(d, a.x, a.y);
      break;
    }
  }
}

function create(w) {
  const used = new Set(),
    ok = c => !used.has(key(...c)) && settleable(w, c);
  return BREEDS.map((breed, id) => {
    let c = pick(w.roamList, w.rand);
    for (let i = 0; i < 40 && !ok(c); i++) c = pick(w.roamList, w.rand);
    used.add(key(...c));
    return {
      id,
      breed,
      x: c[0] + 0.5,
      y: c[1] + 0.5,
      act: 'idle',
      until: w.now + 0.5 + w.rand() * 2,
      path: [],
      speed: 0,
      face: id === 1 ? -1 : 1,
      wag: false,
    };
  });
}
function step(dogs, w, dt) {
  const night = isNight(w.hour);
  for (const d of dogs) {
    if (night && d.act !== 'sleep' && d.act !== 'den' && d.act !== 'company') {
      // Everyone heads for their own cell of the den; games and greetings simply stop.
      const c = (w.den || [])[d.id != null ? d.id : dogs.indexOf(d)];
      d.partner = null;
      d.lead = false;
      d.greet = null;
      d.wag = false;
      d.act = 'den';
      if (!c || !goTo(d, w, c, STROLL * LEGS[d.breed])) {
        d.act = 'sleep';
        d.path = [];
      } else {
        // Curl up a little toward the middle of the den so the three sleep in a huddle, each still in its own cell.
        const mx = w.den.reduce((s, o) => s + o[0] + 0.5, 0) / w.den.length,
          my = w.den.reduce((s, o) => s + o[1] + 0.5, 0) / w.den.length,
          end = d.path[d.path.length - 1];
        end[0] += Math.max(-0.3, Math.min(0.3, mx - end[0]));
        end[1] += Math.max(-0.3, Math.min(0.3, my - end[1]));
      }
    } else if (!night && (d.act === 'sleep' || d.act === 'den')) idle(d, w, 1 + w.rand() * 3, true);
  }
  company(dogs, w);
  if (!night) greet(dogs, w);
  for (const d of dogs) {
    const had = d.path.length > 0;
    move(d, w, dt);
    if (had && !d.path.length) arrive(d, dogs, w);
    tick(d, dogs, w);
  }
}

// Which sprite frame to show, mirrored or not, and how many pixels to lift it (a hop).
function pose(d, t) {
  const ph = t + (d.id || 0) * 0.37;
  if (d.path && d.path.length) {
    if ((d.speed || 0) >= 2) {
      const hz = d.breed === 'corgi' ? 11 : 8;
      return { frame: fl(ph * hz) % 2 ? 'run2' : 'run1', dy: fl(ph * hz) % 2 ? 1 : 0, flip: d.face < 0 };
    }
    return { frame: fl(ph * 5) % 2 ? 'run2' : 'stand', dy: 0, flip: d.face < 0 };
  }
  let frame = 'stand',
    dy = 0;
  switch (d.act) {
    case 'rest':
    case 'company':
      frame = 'lie';
      break;
    case 'sleep':
      frame = 'sleep';
      break;
    case 'drink':
    case 'sniff':
      frame = 'drink';
      break;
    case 'sit':
      frame = 'sit';
      break;
    case 'bow':
      frame = 'bow';
      break;
    case 'play':
      if (d.playing) {
        const p = (ph * 1.6) % 2;
        if (p < 1) {
          frame = 'bow';
        } else {
          frame = 'run1';
          dy = Math.round(Math.sin((p - 1) * Math.PI) * 3);
        }
      }
      break;
    // Standing about, a happy dog keeps wagging; any other wags for a moment every few seconds.
    default:
      frame = (d.wag ? fl(ph * 4) % 2 : (ph * 0.4) % 4 < 0.5 ? fl(ph * 4) % 2 : 0) ? 'wag' : 'stand';
  }
  return { frame, dy, flip: d.face < 0 };
}

export const DogLogic = {
  BREEDS,
  STROLL,
  RUN,
  isNight,
  nightMix,
  roamCells,
  path,
  drinkSpots,
  denCells,
  besideCell,
  faceToward,
  create,
  step,
  pose,
  startChase,
  startPlay,
  wander,
  greetSpot,
};
