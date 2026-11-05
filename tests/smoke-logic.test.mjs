import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadSkyLogic } from './load-sky-logic.mjs'
import { loadSmokeLogic } from './load-smoke-logic.mjs'

const SkyLogic = loadSkyLogic()
const SmokeLogic = loadSmokeLogic()
const W = 27, H = 14
const island = SkyLogic.buildIsland({ W, H })
const zone = island.spots.find(s => s.id === 'east-front')
const corner = SmokeLogic.layout(zone)
const key = ([x, y]) => x + ',' + y
const inZone = ([x, y]) => x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h

// ---- layout ----

test('the corner fills the east-front outdoor spot, 4×4 down the east lawn, and every tile of it is dry lawn', () => {
  assert.deepEqual([zone.x, zone.y, zone.w, zone.h], [W + 1, H - 5, 4, 4])
  assert.equal(corner.x, zone.x)
  assert.equal(corner.y, zone.y)
  for (let y = zone.y; y < zone.y + zone.h; y++) for (let x = zone.x; x < zone.x + zone.w; x++) {
    assert.ok(island.cells.has(x + ',' + y), `tile ${x},${y} is on the island`)
    assert.ok(!island.pond.cells.has(x + ',' + y), `tile ${x},${y} is not pond`)
  }
})

test('five smoking spots: three seats on the bench, two standing by the ash bin', () => {
  assert.equal(corner.spots.length, 5)
  assert.ok(corner.spots.every(s => s.act === 'smoke' && s.front === true))
  assert.deepEqual(corner.spots.map(s => s.stool || 0), [1, 1, 1, 0, 0])
})

test('each spot stands inside the zone, on its own tile, with its point inside that tile', () => {
  const tiles = corner.spots.map(s => key(s.tile))
  assert.equal(new Set(tiles).size, tiles.length)
  for (const s of corner.spots) {
    assert.ok(inZone(s.tile), `spot tile ${s.tile} in the zone`)
    assert.deepEqual([Math.floor(s.pt[0]), Math.floor(s.pt[1])], s.tile, `point ${s.pt} inside tile ${s.tile}`)
  }
})

test('the trough takes the pantry-side column only; spots and the entrance stay walkable', () => {
  assert.deepEqual(corner.blocked, [0, 1, 2].map(d => key([zone.x, zone.y + d])))
  const blocked = new Set(corner.blocked)
  for (const s of corner.spots) assert.ok(!blocked.has(key(s.tile)), `spot ${s.tile} is not blocked`)
  for (const t of corner.entry) assert.ok(!blocked.has(key(t)), `entrance ${t} is not blocked`)
})

test('the entrance is the first two tiles of the front row, where the lawn path arrives', () => {
  assert.deepEqual(corner.entry, [[zone.x, zone.y + zone.h - 1], [zone.x + 1, zone.y + zone.h - 1]])
})

test('every spot and the entrance can be walked to from the foot of the east stairs', () => {
  const walk = SkyLogic.lawnWalk(island, W, H)
  corner.blocked.forEach(k => walk.delete(k))
  const east = SkyLogic.stairs(W, H).find(s => s.side === 'east')
  const start = [east.x, east.y], seen = new Set([key(start)]), q = [start]
  while (q.length) {
    const [x, y] = q.shift()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = [x + dx, y + dy]
      if (walk.has(key(n)) && !seen.has(key(n))) { seen.add(key(n)); q.push(n) }
    }
  }
  for (const s of corner.spots) assert.ok(seen.has(key(s.tile)), `spot ${s.tile} reachable`)
  for (const t of corner.entry) assert.ok(seen.has(key(t)), `entrance ${t} reachable`)
})

test('the pad is closed all round except through the entrance', () => {
  const shut = new Set(corner.shut), entry = new Set(corner.entry.map(key))
  for (let y = zone.y; y < zone.y + zone.h; y++) for (let x = zone.x; x < zone.x + zone.w; x++)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = [x, y], b = [x + dx, y + dy]
      if (inZone(b)) { assert.ok(!shut.has(key(a) + '|' + key(b)), `step ${a} → ${b} inside the pad is open`); continue }
      const open = entry.has(key(a))
      assert.equal(shut.has(key(a) + '|' + key(b)), !open, `step ${a} → ${b}`)
      assert.equal(shut.has(key(b) + '|' + key(a)), !open, `step ${b} → ${a}`)
    }
  // the entrance sits right beside the garden path down from the east stairs
  assert.ok(corner.entry.some(([x, y]) => island.paths.cells.has(key([x - 1, y]))), 'an entrance tile borders the garden path')
})

test('the whole stone pad is paved, the trough tiles included', () => {
  const tiles = []
  for (let y = zone.y; y < zone.y + zone.h; y++) for (let x = zone.x; x < zone.x + zone.w; x++) tiles.push(x + ',' + y)
  assert.deepEqual([...corner.paved].sort(), tiles.sort())
})

test('walking in from the east stairs, smokers come off the garden path through the entrance and stay on the stones', () => {
  // the same costs the page's bfs uses: garden path and paving cost 1, bare grass costs more
  const walk = SkyLogic.lawnWalk(island, W, H)
  corner.blocked.forEach(k => walk.delete(k))
  const paved = new Set(corner.paved), entry = new Set(corner.entry.map(key)), shut = new Set(corner.shut)
  const east = SkyLogic.stairs(W, H).find(s => s.side === 'east')
  for (const s of corner.spots) {
    const route = SkyLogic.cheapestPath([east.x, east.y], s.tile, (c, n) => walk.has(key(n)) && !shut.has(key(c) + '|' + key(n)),
      n => island.paths.cells.has(key(n)) || paved.has(key(n)) ? 1 : SkyLogic.GRASS_COST)
    const firstIn = route.find(inZone)
    assert.ok(entry.has(key(firstIn)), `route to ${s.tile} enters at ${firstIn}, not an entrance tile`)
    const afterEntry = route.slice(route.indexOf(firstIn))
    assert.ok(afterEntry.every(inZone), `route to ${s.tile} leaves the pad after entering: ${afterEntry.map(key).join(' ')}`)
  }
})

// ---- the cigarette's rhythm ----

test('a drag lasts the first 22 % of each 5-second cycle', () => {
  assert.equal(SmokeLogic.PERIOD, 5)
  assert.deepEqual(SmokeLogic.cycle(0), { drag: true, exhale: null })
  assert.deepEqual(SmokeLogic.cycle(1.05), { drag: true, exhale: null })
  assert.deepEqual(SmokeLogic.cycle(5.5), { drag: true, exhale: null })
})

test('a puff follows each drag and fades out by half way through the cycle', () => {
  const start = SmokeLogic.cycle(1.101), mid = SmokeLogic.cycle(1.8), end = SmokeLogic.cycle(2.45)
  assert.equal(start.drag, false)
  assert.ok(start.exhale >= 0 && start.exhale < 0.01)
  assert.ok(Math.abs(mid.exhale - 0.5) < 1e-9)
  assert.ok(end.exhale > 0.95 && end.exhale < 1)
})

test('between puffs the cigarette just burns', () => {
  assert.deepEqual(SmokeLogic.cycle(2.5), { drag: false, exhale: null })
  assert.deepEqual(SmokeLogic.cycle(4.99), { drag: false, exhale: null })
})

test('negative times (per-person phase offsets) wrap into the same cycle', () => {
  assert.deepEqual(SmokeLogic.cycle(-4), SmokeLogic.cycle(1))
  assert.deepEqual(SmokeLogic.cycle(-2.5), SmokeLogic.cycle(2.5))
})
