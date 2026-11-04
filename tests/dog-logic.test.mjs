import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadDogLogic, loadDogSprites } from './load-dog-logic.mjs'

const Dog = loadDogLogic()
const Sprites = loadDogSprites()

// A small stand-in for the island: an office W×H at the origin, lawn all round it, a 2×2 pond in the east lawn
// and a reserved corner (the smoking area) the dogs must keep out of.
const W = 10, H = 6
const key = (x, y) => x + ',' + y
const walk = new Set()
for (let y = -2; y < H + 6; y++) for (let x = -2; x < W + 6; x++) if (!(x >= 0 && x < W && y >= 0 && y < H)) walk.add(key(x, y))
const pond = new Set([key(13, 8), key(14, 8), key(13, 9), key(14, 9)])
walk.add(key(13, 8)) // a bathing spot: agents may stand in it, dogs never
const avoid = [{ x: W + 1, y: 0, w: 3, h: 3 }]
const roam = Dog.roamCells(walk, { W, H, pond, avoid })
// Stone paths and the cells at the foot of the stairs: dogs may run across them but never settle on them.
const clear = new Set()
for (let x = 0; x <= W + 3; x++) clear.add(key(x, H + 1))
for (let y = 0; y <= H + 1; y++) clear.add(key(W, y))
clear.add(key(13, 7))
const TREE = [W + 4, H + 3]
const inRoam = (x, y) => roam.has(key(Math.floor(x), Math.floor(y)))

// Deterministic Math.random stand-in (mulberry32).
const rng = seed => () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }

function world(over = {}) {
  return { W, H, roam, roamList: [...roam].map(k => k.split(',').map(Number)), clear, den: Dog.denCells(roam, TREE, clear), drink: Dog.drinkSpots(roam, pond, clear), agents: [], hour: 10, snow: 0, now: 0, rand: rng(7), ...over }
}
function simulate(dogs, w, seconds, each) {
  const dt = 1 / 30
  for (let i = 0; i < seconds * 30; i++) { w.now += dt; Dog.step(dogs, w, dt); if (each) each(dogs, w) }
}

// ---- where dogs may go ----

test('dogs roam only the front and side lawn: never the office, the strip behind it, water or the reserved area', () => {
  for (const k of roam) {
    const [x, y] = k.split(',').map(Number)
    assert.ok(x >= W || y >= H, `${k} is in the office or behind it`)
    assert.ok(x >= 0 && y >= 0, `${k} is behind the office walls`)
    assert.ok(!pond.has(k), `${k} is water`)
    assert.ok(!(x >= W + 1 && x < W + 4 && y >= 0 && y < 3), `${k} is in the reserved area`)
    assert.ok(walk.has(k))
  }
  assert.ok(roam.has(key(3, H + 2)) && roam.has(key(W + 3, 4)))
})

test('over a long day no dog ever sets foot in the reserved area', () => {
  const w = world({ rand: rng(21) }), dogs = Dog.create(w)
  simulate(dogs, w, 600, ds => ds.forEach(d => { const x = Math.floor(d.x), y = Math.floor(d.y); assert.ok(!(x >= W + 1 && x < W + 4 && y >= 0 && y < 3), `${d.breed} in the reserved area`) }))
})

test('a path runs through roam cells only, one step at a time, and goes round the office corner', () => {
  const p = Dog.path(roam, [2, H + 1], [W + 2, 4])
  assert.deepEqual(p[0], [2, H + 1]); assert.deepEqual(p.at(-1), [W + 2, 4])
  for (let i = 0; i < p.length; i++) {
    assert.ok(roam.has(key(...p[i])), `step ${p[i]} leaves the lawn`)
    if (i) assert.ok(Math.max(Math.abs(p[i][0] - p[i - 1][0]), Math.abs(p[i][1] - p[i - 1][1])) === 1)
  }
})

test('a diagonal step never cuts the corner of a cell the dog may not enter', () => {
  const p = Dog.path(roam, [W - 1, H], [W, H - 1])
  for (let i = 1; i < p.length; i++) {
    const [ax, ay] = p[i - 1], [bx, by] = p[i]
    if (ax !== bx && ay !== by) assert.ok(roam.has(key(ax, by)) && roam.has(key(bx, ay)), `cut corner ${p[i - 1]} → ${p[i]}`)
  }
})

test('there is no path to a cell off the lawn', () => {
  assert.deepEqual(Dog.path(roam, [2, H + 1], [3, 3]), [])
})

test('drinking spots stand on the lawn right next to the water, face it, and keep off the paths', () => {
  const spots = Dog.drinkSpots(roam, pond, clear)
  assert.ok(spots.length >= 4)
  assert.ok(!spots.some(s => clear.has(key(s.x, s.y))))
  for (const s of spots) {
    assert.ok(roam.has(key(s.x, s.y)))
    assert.ok(pond.has(key(s.tx, s.ty)))
    assert.equal(Math.abs(s.x - s.tx) + Math.abs(s.y - s.ty), 1)
  }
})

test('the night den is three lawn cells together under the given tree, off the paths', () => {
  const den = Dog.denCells(roam, TREE, clear)
  assert.equal(den.length, 3)
  for (const [x, y] of den) {
    assert.ok(roam.has(key(x, y)) && !clear.has(key(x, y)))
    assert.ok(Math.hypot(x + 0.5 - (TREE[0] + 0.5), y + 0.5 - (TREE[1] + 0.5)) < 2.2, `${x},${y} is far from the tree`)
  }
  for (let i = 1; i < 3; i++) assert.ok(den.slice(0, i).some(o => Math.max(Math.abs(o[0] - den[i][0]), Math.abs(o[1] - den[i][1])) === 1))
})

test('the den never lands on a path, even when the tree stands right beside one', () => {
  const den = Dog.denCells(roam, [W + 1, H + 1], clear)
  assert.equal(den.length, 3)
  for (const [x, y] of den) assert.ok(!clear.has(key(x, y)))
})

// ---- behaviour ----

test('three dogs, one of each breed, start on the lawn', () => {
  const dogs = Dog.create(world())
  assert.deepEqual(dogs.map(d => d.breed), ['corgi', 'husky', 'dalmatian'])
  for (const d of dogs) assert.ok(inRoam(d.x, d.y))
})

test('over a long day the dogs stay on the lawn and do more than one thing', () => {
  const w = world(), dogs = Dog.create(w), seen = new Set()
  simulate(dogs, w, 600, ds => ds.forEach(d => { assert.ok(inRoam(d.x, d.y), `${d.breed} at ${d.x},${d.y} (${d.act})`); seen.add(d.act) }))
  for (const a of ['wander', 'rest', 'chase', 'flee']) assert.ok(seen.has(a), `never did ${a}: ${[...seen]}`)
})

test('a game of chase ends with the chaser catching up', () => {
  const w = world({ rand: rng(3) }), dogs = Dog.create(w)
  Dog.startChase(dogs[1], dogs[2], w)
  let caught = false
  simulate(dogs, w, 30, ds => { if (ds[1].act === 'bow' || ds[2].act === 'bow') caught = true })
  assert.ok(caught)
})

test('dogs run faster when they play than when they stroll', () => {
  const w = world(), dogs = Dog.create(w)
  Dog.startChase(dogs[0], dogs[2], w)
  const chase = dogs[0].speed
  const w2 = world(), d2 = Dog.create(w2); Dog.wander(d2[0], w2)
  assert.ok(chase > d2[0].speed * 2)
})

test('at night every dog walks to the den and sleeps there; in the morning they get up', () => {
  const w = world({ hour: 23 }), dogs = Dog.create(w)
  simulate(dogs, w, 60)
  const den = new Set(w.den.map(c => key(...c)))
  for (const d of dogs) { assert.equal(d.act, 'sleep'); assert.ok(den.has(key(Math.floor(d.x), Math.floor(d.y)))) }
  assert.equal(new Set(dogs.map(d => key(Math.floor(d.x), Math.floor(d.y)))).size, 3, 'each dog has its own cell')
  const spread = Math.max(...dogs.map(a => Math.max(...dogs.map(b => Math.hypot(a.x - b.x, a.y - b.y)))))
  assert.ok(spread < 1, `they sleep huddled together (${spread.toFixed(2)} tiles apart)`)
  w.hour = 7; simulate(dogs, w, 5)
  assert.ok(dogs.every(d => d.act !== 'sleep'))
})

test('a person coming out on the lawn gets a dog sitting by them, wagging', () => {
  const w = world({ agents: [{ id: 'a1', x: 13.5, y: 8.5 }] }), dogs = Dog.create(w)
  let greeted = null
  simulate(dogs, w, 40, ds => { const g = ds.find(d => d.act === 'sit' && d.greet === 'a1'); if (g && !greeted) greeted = { ...g } })
  assert.ok(greeted, 'nobody came to say hello')
  assert.ok(Math.hypot(greeted.x - 13.5, greeted.y - 8.5) < 2)
})

test('someone bathing in the middle of the pond gets a dog sitting at the nearest bank', () => {
  // A 3×3 pond: the bather's own cell has water on all eight sides.
  const pond3 = new Set(); for (let x = 12; x <= 14; x++) for (let y = 8; y <= 10; y++) pond3.add(key(x, y))
  const roam3 = Dog.roamCells(walk, { W, H, pond: pond3, avoid })
  const w = world({ roam: roam3, roamList: [...roam3].map(k => k.split(',').map(Number)), drink: Dog.drinkSpots(roam3, pond3, clear), agents: [{ id: 'b', x: 13.5, y: 9.5 }] })
  const dogs = Dog.create(w)
  let sat = null
  simulate(dogs, w, 40, ds => { const g = ds.find(d => d.act === 'sit' && d.greet === 'b'); if (g && !sat) sat = { x: g.x, y: g.y } })
  assert.ok(sat, 'nobody sat down by the bather')
  assert.ok(Math.hypot(sat.x - 13.5, sat.y - 9.5) < 2.5)
  assert.ok(!pond3.has(key(Math.floor(sat.x), Math.floor(sat.y))))
})

test('the greeting dog faces the person', () => {
  const d = { x: 12.5, y: 9.5 }
  assert.equal(Dog.faceToward(d, 13.5, 8.5), Dog.faceToward({ x: 0, y: 1 }, 1, 0))
})

test('the husky gets the zoomies more often in the snow', () => {
  const count = snow => {
    const w = world({ snow, rand: rng(11) }), dogs = Dog.create(w); let n = 0, was = false
    simulate(dogs, w, 900, ds => { const z = ds[1].act === 'zoom'; if (z && !was) n++; was = z })
    return n
  }
  assert.ok(count(1) > count(0))
})

test('the dogs settle down in the evening: fewer games than in the afternoon', () => {
  const games = hour => {
    const w = world({ hour, rand: rng(5) }), dogs = Dog.create(w); let n = 0, was = false
    simulate(dogs, w, 900, ds => { const c = ds.some(d => d.act === 'chase'); if (c && !was) n++; was = c })
    return n
  }
  assert.ok(games(20) < games(15))
})

test('with reduced motion the dogs stay calm: no chasing, no zoomies', () => {
  const w = world({ calm: true, snow: 1, rand: rng(9) }), dogs = Dog.create(w)
  simulate(dogs, w, 600, ds => ds.forEach(d => assert.ok(!['chase', 'flee', 'zoom', 'play'].includes(d.act), d.act)))
})

test('over a long day no dog lies, sits, sleeps, sniffs or drinks on a path or at the foot of the stairs', () => {
  const settled = new Set(['rest', 'sit', 'sleep', 'sniff', 'drink'])
  for (const [hour, seed] of [[10, 31], [15, 32], [23, 33]]) {
    const w = world({ hour, rand: rng(seed), agents: [{ id: 'a1', x: 13.5, y: 8.5 }] }), dogs = Dog.create(w)
    simulate(dogs, w, 400, ds => ds.forEach(d => {
      if (settled.has(d.act) && !d.path.length) assert.ok(!clear.has(key(Math.floor(d.x), Math.floor(d.y))), `${d.breed} ${d.act} on the path at ${d.x.toFixed(1)},${d.y.toFixed(1)}`)
    }))
  }
})

test('a dog greeting someone sits beside them but off the path when there is room', () => {
  const s = Dog.greetSpot({ x: 13.5, y: 5.5 }, { x: 13.5, y: 8.5 }, world())
  assert.ok(s && !clear.has(key(...s)))
})

// ---- pose ----

test('a dog moving left on screen is drawn mirrored; moving right is not', () => {
  const d = { breed: 'corgi', act: 'wander', x: 5, y: 5, path: [[6, 4]], speed: 1.2, face: 1 }
  Dog.step([d], world(), 0.01)
  assert.equal(Dog.pose(d, 0).flip, false)
  d.path = [[4, 6]]; Dog.step([d], world(), 0.01)
  assert.equal(Dog.pose(d, 0).flip, true)
})

test('running alternates the two gallop frames; resting, sleeping and drinking use their own frames', () => {
  const d = { breed: 'husky', act: 'chase', path: [[9, 9]], speed: 3.4, face: 1, x: 1, y: 1 }
  const frames = new Set([0, 0.05, 0.1, 0.15, 0.2].map(t => Dog.pose(d, t).frame))
  assert.deepEqual([...frames].sort(), ['run1', 'run2'])
  for (const [act, frame] of [['rest', 'lie'], ['sleep', 'sleep'], ['drink', 'drink'], ['sit', 'sit'], ['bow', 'bow']])
    assert.equal(Dog.pose({ breed: 'husky', act, path: [], face: 1 }, 0).frame, frame)
})

test('every pose the logic asks for exists in every breed\'s sprite set', () => {
  const acts = ['idle', 'wander', 'sniff', 'rest', 'sleep', 'drink', 'sit', 'bow', 'chase', 'flee', 'zoom', 'play']
  for (const breed of Dog.BREEDS) for (const act of acts) for (const moving of [false, true]) for (const t of [0, 0.3, 0.7]) {
    const p = Dog.pose({ breed, act, path: moving ? [[1, 1]] : [], speed: 2, face: 1, happy: 1 }, t)
    assert.ok(Sprites.frameNames(breed).includes(p.frame), `${breed} has no ${p.frame}`)
  }
})

// ---- sprites ----

test('every sprite pixel uses a colour from its breed\'s palette, and every frame has its feet on the bottom row', () => {
  for (const breed of Object.keys(Sprites.BREEDS)) for (const name of Sprites.frameNames(breed)) {
    const f = Sprites.frame(breed, name), pal = Sprites.BREEDS[breed].pal
    for (const row of f.rows) for (const ch of row) assert.ok(ch === '.' || pal[ch], `${breed}/${name} uses '${ch}'`)
    assert.ok(/[^.]/.test(f.rows.at(-1)), `${breed}/${name} floats`)
    assert.ok(f.ax > 0 && f.ax < f.w)
  }
})
