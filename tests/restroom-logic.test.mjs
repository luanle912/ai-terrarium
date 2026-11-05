import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadSkyLogic } from './load-sky-logic.mjs'
import { loadSmokeLogic } from './load-smoke-logic.mjs'
import { loadRestroomLogic } from './load-restroom-logic.mjs'

const SkyLogic = loadSkyLogic()
const SmokeLogic = loadSmokeLogic()
const RestroomLogic = loadRestroomLogic()
const W = 27, H = 14
const island = SkyLogic.buildIsland({ W, H })
const zone = island.spots.find(s => s.id === 'east-back')
const wc = RestroomLogic.layout(zone)
const key = ([x, y]) => x + ',' + y
const inZone = ([x, y]) => x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h

// ---- layout ----

test('the restroom stands in the east-back spot, right against the pantry wall', () => {
  assert.equal(wc.x, zone.x)
  assert.equal(wc.y, zone.y)
  assert.equal(zone.x, W + 1, 'one lawn column from the office wall')
  const { x0, x1, y0, y1 } = wc.body
  assert.ok(x0 >= zone.x && x1 <= zone.x + zone.w && y0 >= zone.y && y1 <= zone.y + zone.h, 'the walls stay inside the spot')
})

test('the building takes the 3×3 tiles at the back of the spot and nothing else', () => {
  const want = []
  for (let y = zone.y; y < zone.y + 3; y++) for (let x = zone.x; x < zone.x + 3; x++) want.push(x + ',' + y)
  assert.deepEqual([...wc.blocked].sort(), want.sort())
  for (const k of wc.blocked) assert.ok(island.cells.has(k) && !island.pond.cells.has(k), `wall tile ${k} is dry lawn`)
})

test('two short visits, one at each door, standing on the step in front of it', () => {
  assert.equal(wc.spots.length, 2)
  assert.equal(wc.doors.length, 2)
  const blocked = new Set(wc.blocked)
  wc.spots.forEach((s, i) => {
    assert.equal(s.act, 'wc')
    assert.equal(s.front, false, 'facing the door')
    assert.equal(s.door, i)
    assert.ok(inZone(s.tile) && s.tile[1] === zone.y + 3, `spot ${s.tile} is on the front step`)
    assert.ok(!blocked.has(key(s.tile)), `spot ${s.tile} is walkable`)
    assert.deepEqual([Math.floor(s.pt[0]), Math.floor(s.pt[1])], s.tile, `point ${s.pt} inside tile ${s.tile}`)
    const d = wc.doors[i]
    assert.ok(s.pt[0] > d.x0 && s.pt[0] < d.x1, `spot ${i} stands in front of its door`)
  })
  assert.notDeepEqual(wc.spots[0].tile, wc.spots[1].tile)
})

test('from the foot of the east stairs both doors are reached along the garden-path spur, never through a wall', () => {
  const walk = SkyLogic.lawnWalk(island, W, H)
  wc.blocked.forEach(k => walk.delete(k))
  const paved = new Set(wc.paved), east = SkyLogic.stairs(W, H).find(s => s.side === 'east')
  for (const s of wc.spots) {
    const route = SkyLogic.cheapestPath([east.x, east.y], s.tile, (c, n) => walk.has(key(n)),
      n => island.paths.cells.has(key(n)) || paved.has(key(n)) ? 1 : SkyLogic.GRASS_COST)
    assert.ok(route.length > 0 && route.length <= 4, `route to ${s.tile}: ${route.map(key).join(' ')}`)
    for (const c of route) assert.ok(!wc.blocked.includes(key(c)), `route to ${s.tile} goes through the wall at ${c}`)
  }
})

test('the restroom keeps well away from the smoking corner, so no smoke drifts over', () => {
  const smoke = SmokeLogic.layout(island.spots.find(s => s.id === 'east-front'))
  const gap = smoke.y - (zone.y + zone.h)
  assert.ok(gap >= 3, `only ${gap} rows of lawn between the restroom and the smoking corner`)
})

// ---- a visit ----

test('a visit: a moment at the door, a while inside, a moment coming out, then done', () => {
  const { DOOR, INSIDE, VISIT } = RestroomLogic
  assert.equal(VISIT, DOOR + INSIDE + DOOR)
  assert.ok(VISIT < 10, 'a visit is short')
  assert.equal(RestroomLogic.visit(0), 'door')
  assert.equal(RestroomLogic.visit(DOOR - 0.01), 'door')
  assert.equal(RestroomLogic.visit(DOOR), 'inside')
  assert.equal(RestroomLogic.visit(DOOR + INSIDE - 0.01), 'inside')
  assert.equal(RestroomLogic.visit(DOOR + INSIDE), 'out')
  assert.equal(RestroomLogic.visit(VISIT), 'done')
  assert.equal(RestroomLogic.visit(VISIT + 100), 'done')
})
