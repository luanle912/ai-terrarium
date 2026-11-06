import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'
import { loadDogLogic } from './load-dog-logic.mjs'

// The rest corner by the lake (spec 6.4): a stone bench and a fishing spot on the far bank, reached over the bridge,
// with a dog lying beside the bench sitter. office-scene.js builds the page's island at load; it only needs React for h().
loadI18n('vi')
globalThis.React ??= { createElement: () => null }
const scene = loadWeb('office-scene')
const { ISLAND, IDLE_SPOTS, ACT_TXT, DOG_PLACES, W, H, WALL, FLOOR_Z, TH } = scene
const { bfs, startCell } = loadWeb('office-util')
const Dog = loadDogLogic()
const K = (x, y) => x + ',' + y
const { rest, bridge } = ISLAND
const spot = act => IDLE_SPOTS.find(s => s.act === act)

test('the bench and the fishing spot are idle spots out at the rest corner', () => {
  const bench = spot('bench'), fish = spot('fish')
  assert.ok(bench && fish, 'no bench or fishing spot among the idle spots')
  assert.deepEqual(bench.tile, [rest.bench.x, rest.bench.y])
  assert.deepEqual(fish.tile, [rest.fish.x, rest.fish.y])
  assert.equal(bench.stool, 1, 'the bench sitter sits down')
  assert.ok(!fish.stool, 'the angler stands')
  for (const s of [bench, fish]) {
    assert.equal(Math.floor(s.pt[0]), s.tile[0])
    assert.equal(Math.floor(s.pt[1]), s.tile[1])
    assert.equal(s.front, true, 'facing the lake, toward the viewer')
  }
  // one of each, like the other outdoor spots: picked as often as any other free idle spot
  assert.equal(IDLE_SPOTS.filter(s => s.act === 'bench' || s.act === 'fish').length, 2)
  assert.ok(ACT_TXT.bench && ACT_TXT.fish && ACT_TXT.bench !== 'office.act.bench' && ACT_TXT.fish !== 'office.act.fish')
})

test('an agent going to the rest corner crosses the bridge', () => {
  const south = scene.STAIRS.find(s => s.side === 'south')
  for (const s of [spot('bench'), spot('fish')]) {
    assert.ok(s, 'no rest corner spot')
    // from the foot of the south stairs, and all the way from a desk inside
    for (const from of [[south.x, H], [1, 2]]) {
      const route = bfs(from, s.tile)
      assert.ok(route.length > 0, `no way from ${from} to ${s.act}`)
      assert.ok(route.some(c => bridge.cells.has(K(...c))), `the way from ${from} to ${s.act} skips the bridge`)
      for (const c of route) {
        const k = K(...c)
        if (ISLAND.river.cells.has(k)) assert.ok(bridge.cells.has(k), `walks through the river at ${k}`)
        assert.ok(!ISLAND.pond.cells.has(k), `walks through the lake at ${k}`)
      }
    }
  }
})

test('an agent at the rest corner walks back from where it is, not from inside the office', () => {
  for (const s of [spot('bench'), spot('fish')]) assert.deepEqual(startCell(...s.pt), s.tile)
  // the door is outside the walls on the near bank, but someone just in through it starts inside
  assert.deepEqual(startCell(-0.9, 7), [0, 7])
  assert.deepEqual(startCell(23.5, H + 2.5), [23, H + 2])
  assert.deepEqual(startCell(5.5, 3.5), [5, 3])
})

test('dogs now roam the far bank, the rest corner and the back lawn, never water, the mountain or the bench', () => {
  const { roam } = DOG_PLACES
  const pondOrRiver = k => ISLAND.pond.cells.has(k) || (ISLAND.river.cells.has(k) && !bridge.cells.has(k))
  for (const k of roam) {
    assert.ok(!pondOrRiver(k), `dogs roam the water at ${k}`)
    assert.ok(!ISLAND.mountain.cells.has(k), `dogs roam the mountain at ${k}`)
  }
  assert.ok(!roam.has(K(rest.bench.x, rest.bench.y)), 'dogs walk over the bench')
  assert.ok(DOG_PLACES.clear.has(K(rest.fish.x, rest.fish.y)), 'a dog may settle on the fishing spot')
  for (const k of bridge.cells) assert.ok(roam.has(k), `dogs cannot cross the bridge at ${k}`)
  const cells = [...roam].map(k => k.split(',').map(Number))
  assert.ok(cells.some(([x, y]) => x < 0 && y >= H), 'no dog on the far bank')
  assert.ok(cells.some(([x, y]) => y < -4), 'no dog on the back lawn')
  // every one of these is reachable from the front lawn
  const front = [23, H + 4]
  for (const c of [cells.find(([x, y]) => x < 0 && y >= H), cells.find(([x, y]) => y < -4)])
    assert.ok(Dog.path(roam, front, c).length > 0, `${c} cannot be reached`)
})

test('no dog stands in the strip right behind the office walls, where they would hide it', () => {
  // A dog behind a wall is drawn before the walls (scene.behindWalls), so they hide it. Its feet are 16 px up the
  // screen per tile behind the wall, so within `reach` tiles the wall face covers it: it would vanish there (the far
  // bank beside the river too: the left wall covers the whole strip out to the island's edge).
  const reach = Math.floor((WALL + 3 + FLOOR_Z) / (2 * TH))
  assert.equal(reach, 4)
  assert.equal(scene.WALL_REACH, reach)
  for (const k of DOG_PLACES.roam) {
    const [x, y] = k.split(',').map(Number)
    assert.ok(!scene.behindWalls(x, y), `${k} is right behind a wall`)
    if (x < 0 && x >= -reach) assert.ok(y - x < -1 || y - x > H + 1, `${k} is right behind the left wall`)
    if (y < 0 && y >= -reach) assert.ok(x - y < -1 || x - y > W + 1, `${k} is right behind the back wall`)
  }
})

test('nothing tall baked into the island stands in front of a roaming dog', () => {
  // The mountain is part of the island picture under every sprite (trees, bushes, lamps, the bench and the bridge are
  // sorted with the dogs). No dog stands up to as many rows behind a mountain cell as the stone there rises: at
  // least the two rows of its foot, and behind the peaks themselves as far as they rise (8 px a row).
  const tall = [...ISLAND.mountain.cells].map(k => k.split(',').map(Number))
  const peaks = ISLAND.mountain.peaks.map(p => [p.x, p.y, Math.floor(p.h / TH)])
  for (const k of DOG_PLACES.roam) {
    const [x, y] = k.split(',').map(Number)
    for (const [mx, my, r = 2] of [...tall, ...peaks])
      assert.ok(!(Math.abs(mx - my - (x - y)) <= 1 && mx + my > x + y && mx + my - (x + y) <= r), `${k} hides behind the mountain at ${mx},${my}`)
  }
})

test('a dog lies down beside the bench while someone sits there', () => {
  const r = DOG_PLACES.rest
  assert.ok(Array.isArray(r) && DOG_PLACES.roam.has(K(...r)) && !DOG_PLACES.clear.has(K(...r)), 'no quiet cell by the bench')
  assert.ok(Math.max(Math.abs(r[0] - rest.bench.x), Math.abs(r[1] - rest.bench.y)) === 1, 'the cell is not beside the bench')
  // the angler, standing in front of it in the same screen column, would hide the dog
  const [fx, fy] = spot('fish').pt
  assert.ok(Math.abs(fx - fy - (r[0] - r[1])) >= 1 || fx + fy < r[0] + r[1] + 1, 'the dog lies right behind the angler')
  let seed = 3
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const sitter = { id: 'b', x: spot('bench').pt[0], y: spot('bench').pt[1], act: 'bench', at: true }
  const w = { ...DOG_PLACES, agents: [sitter], hour: 10, snow: 0, now: 0, rand }
  const dogs = Dog.create(w)
  let lying = null
  for (let i = 0; i < 120 * 30 && !lying; i++) {
    w.now += 1 / 30
    Dog.step(dogs, w, 1 / 30)
    lying = dogs.find(d => d.act === 'company' && !d.path.length)
  }
  assert.ok(lying, 'no dog came to lie by the bench')
  assert.deepEqual([Math.floor(lying.x), Math.floor(lying.y)], r)
  assert.equal(Dog.pose(lying, 0).frame, 'lie')
  assert.equal(dogs.filter(d => d.act === 'company').length, 1, 'only one dog keeps them company')
  // it stays while they sit, even into the night ...
  for (let i = 0; i < 60 * 30; i++) { w.now += 1 / 30; Dog.step(dogs, w, 1 / 30) }
  assert.equal(lying.act, 'company')
  w.hour = 23
  for (let i = 0; i < 10 * 30; i++) { w.now += 1 / 30; Dog.step(dogs, w, 1 / 30) }
  assert.equal(lying.act, 'company', 'the company dog left for the den while the person still sits')
  // ... and gets up once they leave (then off to the den, it being night)
  w.agents = []
  for (let i = 0; i < 2 * 30; i++) { w.now += 1 / 30; Dog.step(dogs, w, 1 / 30) }
  assert.notEqual(lying.act, 'company')
})

test('someone only walking to the bench is not yet company; an angler just gets a greeting', () => {
  let seed = 5
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const walker = { id: 'w', x: -3.5, y: 19.5, act: 'bench', at: false }
  const angler = { id: 'f', x: spot('fish').pt[0], y: spot('fish').pt[1], act: 'fish', at: true }
  const w = { ...DOG_PLACES, agents: [walker, angler], hour: 10, snow: 0, now: 0, rand }
  const dogs = Dog.create(w)
  let greeted = false
  for (let i = 0; i < 60 * 30; i++) {
    w.now += 1 / 30
    Dog.step(dogs, w, 1 / 30)
    assert.ok(!dogs.some(d => d.act === 'company'), 'a dog lay down by an empty bench')
    greeted ||= dogs.some(d => d.act === 'sit' && d.greet === 'f')
  }
  assert.ok(greeted, 'nobody came to say hello to the angler')
})

test('a dog never stands right behind something tall baked into the island', () => {
  const walk = new Set()
  for (let y = 8; y < 14; y++) for (let x = 0; x < 6; x++) walk.add(K(x, y))
  const free = Dog.roamCells(walk, { W: 0, H: 0, pond: new Set() })
  const roam = Dog.roamCells(walk, { W: 0, H: 0, pond: new Set(), tall: [[3, 12, 2]] })
  // the cells one and two tiles up the screen from it, in its screen column (x − y within one), are out
  for (const k of ['2,11', '3,11', '2,12']) assert.ok(free.has(k) && !roam.has(k), `${k} is behind it`)
  for (const k of ['3,12', '4,13', '1,10', '2,10', '1,12', '5,12']) assert.ok(roam.has(k), `${k} is not behind it`)
})

test('a dog that cannot reach the bench is not sent again every step', () => {
  // w.rest off the dogs' lawn: goTo fails. Each free dog is tried once and then left out for a while.
  let seed = 9
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const sitter = { id: 'b', x: spot('bench').pt[0], y: spot('bench').pt[1], act: 'bench', at: true }
  const w = { ...DOG_PLACES, rest: [rest.bench.x, rest.bench.y], agents: [sitter], hour: 10, snow: 0, now: 0, rand }
  const dogs = Dog.create(w)
  const tried = () => dogs.map(d => d.noCompany ?? null).join('|')
  for (let i = 0; i < 10; i++) { w.now += 1 / 30; Dog.step(dogs, w, 1 / 30) }
  const after10 = tried()
  assert.ok(dogs.some(d => d.noCompany > w.now), 'no dog was tried')
  for (let i = 0; i < 60; i++) { w.now += 1 / 30; Dog.step(dogs, w, 1 / 30) }
  assert.equal(tried(), after10, 'a dog was sent to the bench again within the back-off')
  assert.ok(!dogs.some(d => d.act === 'company'))
})

test('dogs that start on the front lawn reach the back lawn within ten minutes', () => {
  // Strolls stay within a few tiles; now and then a dog sets off on a long walk, so the back lawn (reached round the
  // east side) sees dogs too. Over several seeds, so one lucky walk does not decide it.
  let reached = 0
  for (let s = 1; s <= 6; s++) {
    let seed = s * 7919
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const w = { ...DOG_PLACES, agents: [], hour: 11, snow: 0, now: 0, rand }
    const dogs = Dog.create(w)
    dogs.forEach((d, i) => Object.assign(d, { x: 18.5 + i, y: H + 5.5, path: [] }))
    let back = false
    for (let i = 0; i < 600 * 10 && !back; i++) {
      w.now += 1 / 10
      Dog.step(dogs, w, 1 / 10)
      back = dogs.some(d => d.y < -4)
    }
    if (back) reached++
  }
  assert.ok(reached >= 5, `a dog reached the back lawn in only ${reached} of 6 runs`)
})
