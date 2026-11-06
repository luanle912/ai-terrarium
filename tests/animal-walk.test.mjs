import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

import { loadAnimalWalk } from './load-animal-walk.mjs'
import { loadDogLogic } from './load-dog-logic.mjs'
import { loadAnimalSprites } from './load-animal-sprites.mjs'
import { loadSkyLogic } from './load-sky-logic.mjs'
import { loadSmokeLogic } from './load-smoke-logic.mjs'
import { loadRestroomLogic } from './load-restroom-logic.mjs'

const Walk = loadAnimalWalk()
const Dog = loadDogLogic()
const Sprites = loadAnimalSprites()
const Rules = createRequire(import.meta.url)('../lib/animals.js')

// The same stand-in island as tests/dog-logic.test.mjs: an office W×H at the origin, lawn all round it, a 2×2 pond
// and a reserved corner. Its outer rim is x = W+5 and y = H+5 (x < 0 and y < 0 are behind the office walls).
const W = 10, H = 6
const key = (x, y) => x + ',' + y
const cellOf = k => k.split(',').map(Number)
const walk = new Set()
for (let y = -2; y < H + 6; y++) for (let x = -2; x < W + 6; x++) if (!(x >= 0 && x < W && y >= 0 && y < H)) walk.add(key(x, y))
const pond = new Set([key(13, 8), key(14, 8), key(13, 9), key(14, 9)])
const avoid = [{ x: W + 1, y: 0, w: 3, h: 3 }]
const roam = Dog.roamCells(walk, { W, H, pond, avoid })
const clear = new Set()
for (let x = 0; x <= W + 3; x++) clear.add(key(x, H + 1))
for (let y = 0; y <= H + 1; y++) clear.add(key(W, y))
clear.add(key(13, 7))
const TREE = [W + 4, H + 3]
const dogPlaces = { W, H, roam, roamList: [...roam].map(cellOf), clear, den: Dog.denCells(roam, TREE, clear), drink: Dog.drinkSpots(roam, pond, clear) }
const places = Walk.places(dogPlaces)
const isDen = (x, y) => dogPlaces.den.some(c => c[0] === x && c[1] === y)
const tile = d => [Math.floor(d.x), Math.floor(d.y)]
const tileKey = d => key(...tile(d))
const onEdge = ([x, y]) => places.edge.some(c => c[0] === x && c[1] === y)

// Deterministic Math.random stand-in (mulberry32).
const rng = seed => () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
const world = (over = {}) => ({ ...places, now: 0, hour: 10, calm: false, ...over })
function simulate(walkers, w, seconds, each) {
  const dt = 1 / 30
  let ws = walkers
  for (let i = 0; i < seconds * 30; i++) { w.now += dt; ws = Walk.step(ws, w, dt); if (each) each(ws, w) }
  return ws
}
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v) }
  return o
}
const at = (species, cell, seed = 1, over = {}) => ({ ...Walk.create(species + '-' + seed, species, cell, rng(seed)), ...over })
const settleCell = i => places.settleList[i % places.settleList.length]
const clearCell = [3, H + 1]

// ---- places ----

test('places drop the den, stay one connected piece and settle off the paths', () => {
  for (const [x, y] of dogPlaces.den) assert.ok(!places.roam.has(key(x, y)), `den cell ${x},${y} still in roam`)
  for (const k of places.roam) assert.ok(roam.has(k))
  assert.equal(places.roam.size, roam.size - 3)
  assert.deepEqual(places.roamList.map(c => key(...c)).sort(), [...places.roam].sort())
  const cells = [...places.roam].map(cellOf)
  for (const c of cells) assert.ok(Dog.path(places.roam, cells[0], c).length > 0, `${c} unreachable`)
  for (const k of places.roam) assert.equal(places.settle.has(k), !clear.has(k), k)
  assert.equal(places.settleList.length, places.settle.size)
  for (let i = 1; i < places.settleList.length; i++) {
    const [a, b] = [places.settleList[i - 1], places.settleList[i]]
    assert.ok(a[1] < b[1] || (a[1] === b[1] && a[0] < b[0]), 'settleList is sorted by y, then x')
  }
})

test('a cell the den cuts off from the rest is dropped too', () => {
  // A one-cell-wide strip: den in the middle leaves two pieces; only the larger one stays.
  const strip = new Set(); for (let x = 20; x < 30; x++) strip.add(key(x, 20))
  const p = Walk.places({ W, H, roam: strip, roamList: [...strip].map(cellOf), clear: new Set(), den: [[22, 20], [23, 20], [24, 20]] })
  assert.deepEqual([...p.roam].sort(), ['25,20', '26,20', '27,20', '28,20', '29,20'])
})

test('edge cells are the lawn on the outer rim: not by the office, the pond, the reserved corner or behind the walls', () => {
  const rim = [...places.roam].map(cellOf).filter(([x, y]) => x === W + 5 || y === H + 5)
  assert.deepEqual(places.edge.map(c => key(...c)).sort(), rim.map(c => key(...c)).sort())
})

test('places never changes what it is given', () => {
  const frozen = deepFreeze({ ...dogPlaces, roam: new Set(roam), clear: new Set(clear), roamList: dogPlaces.roamList.map(c => [...c]), den: dogPlaces.den.map(c => [...c]) })
  const before = [...frozen.roam].sort()
  Walk.places(frozen)
  assert.deepEqual([...frozen.roam].sort(), before)
})

// ---- spawnCell ----

const hexIds = n => Array.from({ length: n }, (_, i) => ((i * 2654435761) >>> 8 & 0xffffff).toString(16).padStart(6, '0'))

test('a spawn cell is a settle cell near the island edge, never the den or a path', () => {
  for (const id of hexIds(300)) {
    const c = Walk.spawnCell(id, places)
    assert.ok(places.settle.has(key(...c)), `${id} -> ${c}`)
    assert.ok(!clear.has(key(...c)) && !isDen(...c))
    assert.ok(places.edge.some(e => Math.max(Math.abs(e[0] - c[0]), Math.abs(e[1] - c[1])) <= 1), `${c} is far from the edge`)
  }
})

test('the same id always lands on the same cell, and ids spread over many cells', () => {
  const again = Walk.places(dogPlaces), seen = new Set()
  for (const id of hexIds(200)) {
    assert.deepEqual(Walk.spawnCell(id, places), Walk.spawnCell(id, again))
    seen.add(key(...Walk.spawnCell(id, places)))
  }
  assert.ok(seen.size >= 15, `only ${seen.size} cells`)
  assert.notDeepEqual(Walk.spawnCell('a1b2c3', places), Walk.spawnCell('a1b2c4', places))
})

test('a malformed id still gets a fixed cell, and no settle cell at all gives null', () => {
  for (const id of ['', 'zzz', 'A1B2C3', 42, null, undefined]) {
    const c = Walk.spawnCell(id, places)
    assert.ok(places.settle.has(key(...c)))
    assert.deepEqual(Walk.spawnCell(id, places), c)
  }
  const none = Walk.places({ W, H, roam: new Set(['20,20', '21,20']), roamList: [[20, 20], [21, 20]], clear: new Set(['20,20', '21,20']), den: [] })
  assert.equal(Walk.spawnCell('a1b2c3', none), null)
})

// ---- create, speed ----

test('a new walker stands on the middle of its cell, idle and free', () => {
  const d = Walk.create('a1b2c3', 'fox', [12, 9], rng(1))
  assert.equal(d.id, 'a1b2c3'); assert.equal(d.species, 'fox')
  assert.equal(d.x, 12.5); assert.equal(d.y, 9.5)
  assert.equal(d.act, 'idle'); assert.deepEqual(d.path, [])
  assert.equal(d.hold, false); assert.equal(d.leave, false); assert.equal(d.done, false)
  assert.ok(d.face === 1 || d.face === -1)
})

test('create needs a rand function and accepts a species it does not know', () => {
  assert.throws(() => Walk.create('a1b2c3', 'fox', [12, 9]), TypeError)
  const d = Walk.create('a1b2c3', 'griffin', [12, 9], rng(1))
  const ws = simulate([d], world(), 20)
  assert.ok(places.roam.has(tileKey(ws[0])))
})

test('every species has a speed: rabbits are quick, deer are slow', () => {
  for (const s of Rules.SPECIES) assert.ok(Walk.SPEED[s.id] > 0, s.id)
  for (const id of Sprites.SPECIES_IDS) assert.ok(Walk.SPEED[id] > 0, id)
  const speeds = Rules.SPECIES.map(s => Walk.SPEED[s.id])
  assert.equal(Walk.SPEED.rabbit, Math.max(...speeds))
  assert.equal(Walk.SPEED.deer, Math.min(...speeds))
  assert.ok(Object.isFrozen(Walk.SPEED))
})

test('on the same walk a rabbit covers its speed per second and a deer only its own', () => {
  const route = [[W + 2.5, H + 3.5], [W + 2.5, H + 4.5]]
  for (const species of ['rabbit', 'deer']) {
    const d = at(species, [W + 2, H + 2], 1, { act: 'wander', path: route, speed: Walk.SPEED[species], until: 100 })
    const [moved] = Walk.step([d], world({ now: 1 }), 0.5)
    assert.ok(Math.abs((moved.y - d.y) - Walk.SPEED[species] * 0.5) < 1e-9, species)
  }
})

// ---- step ----

test('step returns new walkers and never writes to the old ones or the world', () => {
  const w = deepFreeze(world({ now: 5 }))
  let ws = deepFreeze([at('hen', settleCell(3), 1), at('fox', clearCell, 2), at('owl', settleCell(9), 3, { leave: true })])
  for (let i = 0; i < 200; i++) {
    const next = Walk.step(ws, { ...w, now: 5 + i / 30 }, 1 / 30)
    assert.notEqual(next, ws)
    ws = deepFreeze(next)
  }
})

test('step only uses the rand it was given, never Math.random', () => {
  const real = Math.random
  Math.random = () => { throw new Error('Math.random used') }
  try {
    const ws = Rules.SPECIES.map((s, i) => at(s.id, settleCell(i * 7), i + 1))
    simulate(ws, world(), 120)
    simulate(ws, world({ hour: 23 }), 60)
  } finally { Math.random = real }
})

test('over a long day walkers stay on the lawn, keep out of the den, never stop on a path and do several things', () => {
  const seen = new Set()
  const ws = Rules.SPECIES.map((s, i) => at(s.id, i % 3 ? settleCell(i * 11) : clearCell, i + 3))
  simulate(ws, world({ hour: 14 }), 600, all => all.forEach(d => {
    const [x, y] = tile(d)
    assert.ok(places.roam.has(key(x, y)) || (d.x === clearCell[0] + 0.5 && d.y === clearCell[1] + 0.5), `${d.species} off the lawn at ${d.x},${d.y}`)
    assert.ok(!isDen(x, y), `${d.species} in the den`)
    if (!d.path.length) assert.ok(places.settle.has(key(x, y)), `${d.species} stopped on ${x},${y} (${d.act})`)
    seen.add(d.act)
  }))
  for (const a of ['wander', 'act', 'rest', 'idle']) assert.ok(seen.has(a), `never did ${a}: ${[...seen]}`)
})

test('a walker put down on a path walks off it before it does anything else', () => {
  const [d] = Walk.step([at('hen', clearCell, 4)], world({ now: 1 }), 1 / 30)
  assert.ok(d.path.length > 0)
  const end = d.path.at(-1)
  assert.ok(places.settle.has(key(Math.floor(end[0]), Math.floor(end[1]))))
})

const sleepsAt = (species, hour) => {
  const [d] = simulate([at(species, settleCell(5), 6)], world({ hour }), 15)
  return d.act === 'sleep'
}

test('animals sleep from 22:00 to 6:00 and the owl sleeps from 6:00 to 18:00', () => {
  for (const [h, hen, owl] of [[12, false, true], [21.99, false, false], [22, true, false], [3, true, false], [5.99, true, false], [6, false, true], [17.99, false, true], [18, false, false]]) {
    assert.equal(sleepsAt('hen', h), hen, `hen at ${h}`)
    assert.equal(sleepsAt('owl', h), owl, `owl at ${h}`)
  }
})

test('at bedtime a walker on a path walks off it first, then sleeps on a settle cell and stays put', () => {
  let ws = Walk.step([at('rabbit', clearCell, 7)], world({ hour: 23, now: 1 }), 1 / 30)
  assert.notEqual(ws[0].act, 'sleep')
  assert.ok(ws[0].path.length > 0)
  ws = simulate(ws, world({ hour: 23, now: 1 }), 20)
  assert.equal(ws[0].act, 'sleep')
  assert.ok(places.settle.has(tileKey(ws[0])))
  const still = simulate(ws, world({ hour: 23, now: 30 }), 30)
  assert.equal(still[0].x, ws[0].x); assert.equal(still[0].y, ws[0].y)
  const awake = simulate(still, world({ hour: 7, now: 60 }), 1)
  assert.notEqual(awake[0].act, 'sleep')
})

test('a held walker stands still, even mid-walk, at night or on a path, and moves again once let go', () => {
  const route = [[3.5, H + 2.5], [3.5, H + 3.5]]
  const d = at('fox', clearCell, 8, { act: 'wander', path: route, speed: 1, until: 100, hold: true })
  for (const hour of [12, 23]) {
    const ws = simulate([d], world({ hour }), 20, ([h]) => { assert.equal(h.x, d.x); assert.equal(h.y, d.y); assert.equal(h.path.length, 0) })
    assert.equal(ws[0].done, false)
  }
  const held = simulate([{ ...d, leave: true }], world(), 10)
  assert.equal(held[0].x, d.x); assert.equal(held[0].done, false)
  let moved = false
  simulate([{ ...d, hold: false }], world(), 10, ([h]) => { if (h.x !== d.x || h.y !== d.y) moved = true })
  assert.ok(moved)
})

test('a leaving walker goes to the nearest edge cell, even at night, and reports done there', () => {
  for (const hour of [12, 23]) {
    const start = [3, H + 2]
    let ws = [at('deer', start, 9, { leave: true })]
    ws = simulate(ws, world({ hour }), 30)
    const d = ws[0]
    assert.equal(d.done, true)
    assert.ok(onEdge(tile(d)), `done at ${tile(d)}`)
    const best = Math.min(...places.edge.map(e => Math.hypot(e[0] - start[0], e[1] - start[1])))
    assert.ok(Math.hypot(tile(d)[0] - start[0], tile(d)[1] - start[1]) <= best + 1e-9, 'not the nearest edge cell')
    const after = simulate(ws, world({ hour }), 5)
    assert.equal(after[0].x, d.x); assert.equal(after[0].y, d.y); assert.equal(after[0].done, true)
  }
})

test('a leaving walker with no way to the edge reports done at once', () => {
  const [d] = Walk.step([at('hen', [40, 40], 10, { leave: true })], world({ now: 1 }), 1 / 30)
  assert.equal(d.done, true)
})

// ---- pose ----

test('every pose uses a frame the species has, faces where it walks and only hops when motion is allowed', () => {
  for (const id of Sprites.SPECIES_IDS) {
    const names = new Set(Sprites.frameNames(id))
    const frames = new Set()
    for (const calm of [false, true]) {
      // Each species in its waking hours (the owl is up at night).
      simulate([at(id, settleCell(2), 11)], world({ calm, hour: id === 'owl' ? 22 : 10 }), 240, ([d], w) => {
        const p = Walk.pose(d, w.now)
        assert.ok(names.has(p.frame), `${id} has no frame ${p.frame}`)
        assert.equal(p.flip, d.face < 0)
        assert.ok(Number.isFinite(p.dy) && p.dy >= 0)
        if (calm) assert.equal(p.dy, 0)
        frames.add(p.frame)
      })
    }
    for (const f of ['stand', 'walk1', 'walk2', 'act', 'rest']) assert.ok(frames.has(f), `${id} never showed ${f}`)
  }
})

test('pose shows sleep for a sleeper, rest for a rester and a hop for a moving rabbit', () => {
  const base = at('rabbit', settleCell(2), 12)
  assert.equal(Walk.pose({ ...base, act: 'sleep' }, 3).frame, 'sleep')
  assert.equal(Walk.pose({ ...base, act: 'rest' }, 3).frame, 'rest')
  assert.equal(Walk.pose({ ...base, act: 'hold' }, 3).frame, 'stand')
  const moving = { ...base, act: 'wander', path: [[1.5, 1.5]], speed: Walk.SPEED.rabbit }
  const hops = Array.from({ length: 40 }, (_, i) => Walk.pose(moving, i / 20).dy)
  assert.ok(hops.some(v => v > 0))
  assert.ok(Array.from({ length: 40 }, (_, i) => Walk.pose({ ...moving, calm: true }, i / 20).dy).every(v => v === 0))
})

// ---- the real island ----

test('on the real island spawn cells are settle cells, never in the den or on a path or stair foot', () => {
  const Sky = loadSkyLogic(), Smoke = loadSmokeLogic(), Wc = loadRestroomLogic()
  const RW = 27, RH = 14
  // Built exactly as web/office-scene.js builds DOG_PLACES (the restroom takes its floor tiles; WALL = 56).
  const ISLAND = Sky.buildIsland({ W: RW, H: RH, lawn: Sky.LAWN, back: Sky.LAWN_BACK })
  const STAIRS = Sky.stairs(RW, RH), LAWN_WALK = Sky.lawnWalk(ISLAND, RW, RH)
  Smoke.layout(ISLAND.spots.find(s => s.id === 'east-front')).blocked.forEach(k => LAWN_WALK.delete(k))
  Wc.layout(ISLAND.spots.find(s => s.id === 'east-back'), 56).floor.forEach(k => LAWN_WALK.delete(k))
  const DOG_ROAM = Dog.roamCells(LAWN_WALK, { W: RW, H: RH, pond: ISLAND.pond.cells, avoid: ISLAND.spots.filter(s => s.id === 'east-back' || s.id === 'east-front') })
  const DOG_CLEAR = new Set(ISLAND.paths.cells)
  STAIRS.forEach(s => { for (let i = 0; i < s.len; i++) for (let o = 0; o < 2; o++) DOG_CLEAR.add(s.side === 'east' ? (s.x + o) + ',' + (s.y + i) : (s.x + i) + ',' + (s.y + o)) })
  const DOG_PLACES = { W: RW, H: RH, roam: DOG_ROAM, roamList: [...DOG_ROAM].map(cellOf), clear: DOG_CLEAR, den: Dog.denCells(DOG_ROAM, [33, 8], DOG_CLEAR), drink: Dog.drinkSpots(DOG_ROAM, ISLAND.pond.cells, DOG_CLEAR) }
  const real = Walk.places(DOG_PLACES), again = Walk.places(DOG_PLACES)
  const den = new Set(DOG_PLACES.den.map(c => key(...c)))
  for (const k of den) assert.ok(!real.roam.has(k))
  const cells = [...real.roam].map(cellOf)
  for (const c of cells) assert.ok(Dog.path(real.roam, cells[0], c).length > 0, `${c} unreachable`)
  assert.ok(real.edge.length > 10)
  for (const id of hexIds(500)) {
    const c = Walk.spawnCell(id, real), k = key(...c)
    assert.ok(real.settle.has(k) && real.roam.has(k), `${id} -> ${k}`)
    assert.ok(!den.has(k) && !DOG_CLEAR.has(k), `${id} -> ${k} is den or path`)
    assert.ok(ISLAND.cells.has(k))
    assert.deepEqual(Walk.spawnCell(id, again), c)
  }
})
