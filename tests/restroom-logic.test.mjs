import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadSkyLogic } from './load-sky-logic.mjs'
import { loadSmokeLogic } from './load-smoke-logic.mjs'
import { loadRestroomLogic } from './load-restroom-logic.mjs'

const SkyLogic = loadSkyLogic()
const SmokeLogic = loadSmokeLogic()
const RestroomLogic = loadRestroomLogic()
// The page's office grid and its full wall height (WALL in the main script: 3 tiles).
const W = 27, H = 14, WALL = 56
const island = SkyLogic.buildIsland({ W, H })
const zone = island.spots.find(s => s.id === 'east-back')
const wc = RestroomLogic.layout(zone, WALL)
const key = ([x, y]) => x + ',' + y
const pos = k => k.split(',').map(Number)
const inOffice = (x, y) => x >= 0 && y >= 0 && x < W && y < H
const walk = new Set(wc.walk)
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]

// Walk the block and the pantry beside it the way the page's bfs does: office floor is fine here (the pantry walkway
// x = 26 is free of furniture in rows 2..7), block tiles must be walkable, and every step must pass RestroomLogic.step.
const route = (from, to) => SkyLogic.cheapestPath(from, to, (c, n) => {
  const s = RestroomLogic.step(wc, c, n, inOffice)
  if (s === false) return false
  if (s === null) return inOffice(n[0], n[1]) && n[0] === 26
  return !wc.floorSet.has(key(n)) || walk.has(key(n))
}, () => 1)

// ---- where it stands ----

test('the block runs along the pantry east side, on the island, over nothing but lawn', () => {
  assert.equal(wc.x0, W, 'its west edge is the pantry edge')
  assert.equal(wc.y0, zone.y)
  assert.ok(wc.x1 <= zone.x + zone.w && wc.y1 === zone.y + zone.h, 'the floor stays inside the reserved spot')
  assert.equal(wc.floor.length, 40, '8×5 tiles')
  const trees = new Set(island.decor.map(d => d.x + ',' + d.y))
  for (const k of wc.floor) {
    assert.ok(island.cells.has(k), `floor tile ${k} is off the island`)
    assert.ok(!island.pond.cells.has(k) && !island.paths.cells.has(k) && !trees.has(k), `floor tile ${k} covers the pond, a path or decor`)
  }
  // the back wall stands on the floor's back edge, so it never hangs past the island (row y0-1 is short in the east)
  assert.ok(wc.back > 0 && wc.wy === wc.y0 + wc.back)
  for (const s of wc.stalls) assert.ok(s.y0 >= wc.wy, 'stalls start at the wall face')
  // and a strip of grass is left in front of the cliff on the east
  for (let y = wc.y0; y < wc.y1; y++) assert.ok(!island.cells.has(Math.ceil(wc.x1) + ',' + y), `the east edge at row ${y} is the island edge`)
  assert.ok(Math.ceil(wc.x1) - wc.x1 >= 0.3)
})

test('the lobby opens onto the pantry; the half-height divider closes the rooms off from it', () => {
  for (let y = wc.y0; y < wc.y1; y++) {
    const open = RestroomLogic.step(wc, [W - 1, y], [W, y], inOffice)
    assert.equal(open, y >= wc.front, `row ${y}: pantry ↔ block ${open ? 'open' : 'closed'}`)
  }
})

test('nobody steps between the block floor and the lawn', () => {
  for (const k of wc.floor) {
    const [x, y] = pos(k)
    for (const [dx, dy] of N4) {
      const n = [x + dx, y + dy]
      if (wc.floorSet.has(key(n)) || inOffice(n[0], n[1])) continue
      assert.equal(RestroomLogic.step(wc, [x, y], n, inOffice), false, `${k} → ${n} steps onto the lawn`)
      assert.equal(RestroomLogic.step(wc, n, [x, y], inOffice), false, `${n} → ${k} climbs up from the lawn`)
    }
  }
  assert.equal(RestroomLogic.step(wc, [30, 9], [30, 10], inOffice), null, 'lawn steps elsewhere are left to the page')
})

test('points on the block floor are on the raised floor; the lawn around it is not', () => {
  assert.ok(RestroomLogic.onFloor(wc, 27.0, 2.0))
  assert.ok(RestroomLogic.onFloor(wc, 34.5, 6.9))
  assert.ok(!RestroomLogic.onFloor(wc, 34.7, 4))
  assert.ok(!RestroomLogic.onFloor(wc, 30, 7.1))
  assert.ok(!RestroomLogic.onFloor(wc, 30, 1.9))
})

// ---- scale ----

test('heights follow the office: full back wall, half-height dividers, knee-high front walls', () => {
  const h = wc.heights
  assert.equal(h.full, WALL, 'the back wall is as tall as the office walls (3 tiles)')
  assert.ok(h.half < h.full && h.half >= h.full * 0.4, `half wall ${h.half}`)
  assert.ok(h.glass > h.half && h.glass < h.full, `glass tops out at ${h.glass}`)
  assert.ok(h.knee < h.half / 2, `knee wall ${h.knee}`)
})

test('fixtures are sized against a desk (2×1 tiles)', () => {
  for (const s of wc.stalls) {
    assert.ok(s.x1 - s.x0 >= 0.85 && s.x1 - s.x0 <= 1.0, `stall ${s.x0}..${s.x1} is ${(s.x1 - s.x0).toFixed(2)} wide`)
    assert.ok(s.y1 - s.y0 >= 1.3, 'stalls are deeper than wide')
  }
  for (const v of Object.values(wc.vanities)) {
    const len = v.y1 - v.y0
    assert.ok(len >= 1.5 && len <= 2.2, `a double vanity is about one desk long, not ${len}`)
    assert.ok(v.x1 - v.x0 >= 0.5 && v.x1 - v.x0 <= 1, 'and about one desk deep')
  }
  assert.ok(wc.urinals[1] - wc.urinals[0] >= 0.7, 'urinals at least ~50 cm apart')
})

// ---- the rooms ----

test('two stalls in the men\'s room, three in the women\'s, each inside its own room', () => {
  assert.equal(wc.stalls.filter(s => s.room === 'm').length, 2)
  assert.equal(wc.stalls.filter(s => s.room === 'f').length, 3)
  for (const s of wc.stalls) {
    const r = wc.rooms[s.room]
    assert.ok(s.x0 >= r.x0 && s.x1 <= r.x1 + 1e-9, `stall ${s.x0}..${s.x1} is outside room ${s.room}`)
    assert.ok(s.y1 < wc.front)
  }
})

test('one idle spot per stall, standing on a free tile in front of its door', () => {
  assert.equal(wc.spots.length, wc.stalls.length)
  wc.spots.forEach((s, i) => {
    const st = wc.stalls[s.stall]
    assert.equal(s.act, 'wc')
    assert.equal(s.room, st.room)
    assert.equal(s.front, false, 'facing the stall')
    assert.ok(walk.has(key(s.tile)), `spot ${i} tile ${s.tile} is not walkable`)
    assert.deepEqual([Math.floor(s.pt[0]), Math.floor(s.pt[1])], s.tile, `point ${s.pt} is inside tile ${s.tile}`)
    assert.ok(s.pt[0] > st.x0 && s.pt[0] < st.x1 && s.pt[1] > st.y1, `spot ${i} stands in front of its stall`)
    assert.ok(walk.has(key(s.wash.tile)), `wash place ${s.wash.tile} is not walkable`)
    assert.deepEqual([Math.floor(s.wash.pt[0]), Math.floor(s.wash.pt[1])], s.wash.tile)
    const v = wc.vanities[s.room]
    assert.ok(s.wash.pt[0] > v.x1 && s.wash.pt[1] > v.y0 && s.wash.pt[1] < v.y1, `spot ${i} washes at its own room's vanity`)
    for (const o of wc.stalls) assert.ok(!(s.wash.pt[0] > o.x0 - 0.25 && s.wash.pt[0] < o.x1 && s.wash.pt[1] < o.y1 + 0.1), `spot ${i} washes inside or against stall ${o.x0}`)
  })
  assert.equal(new Set(wc.spots.map(s => key(s.pt))).size, wc.spots.length)
})

test('from the pantry, every stall and vanity is reached through the lobby and the right door', () => {
  for (const s of wc.spots) {
    const door = wc.rooms[s.room].door[0]
    for (const goal of [s.tile, s.wash.tile]) {
      const r = route([26, 6], goal)
      assert.ok(r.length > 0, `no way to ${goal}`)
      const inRoom = r.filter(([, y]) => y < wc.front)
      assert.deepEqual(inRoom[0], [door, wc.front - 1], `to ${goal} the way in is the ${s.room} door, not ${inRoom[0]}`)
      assert.ok(r.filter(([, y]) => y >= wc.front).every(([x]) => x < door + 1 || s.room === 'f'), 'through the lobby')
    }
  }
  // and never through the divider between the rooms
  assert.equal(RestroomLogic.step(wc, [30, 3], [31, 3], inOffice), false)
})

test('every agent always uses the same room, and both rooms get used', () => {
  const rooms = [1, 2, 3, 4, 5, 6].map(RestroomLogic.roomOf)
  assert.deepEqual([...new Set(rooms)].sort(), ['f', 'm'])
  for (let id = 1; id < 20; id++) assert.equal(RestroomLogic.roomOf(id), RestroomLogic.roomOf(id))
})

test('the rooms keep well away from the smoking corner', () => {
  const smoke = SmokeLogic.layout(island.spots.find(s => s.id === 'east-front'))
  assert.ok(smoke.y - wc.front >= 3, `only ${smoke.y - wc.front} rows between the restroom doors and the smoking corner`)
  assert.ok(smoke.y - wc.y1 >= 2, 'and lawn between the lobby and the smoking pad')
})

// ---- a visit ----

test('a visit: at the stall door, inside, coming out, washing hands, then done', () => {
  const { DOOR, INSIDE, OUT, WASH, VISIT } = RestroomLogic
  assert.equal(VISIT, DOOR + INSIDE + OUT + WASH)
  assert.ok(VISIT < 12, 'a visit is short')
  const at = t => RestroomLogic.visit(t)
  assert.equal(at(0), 'door')
  assert.equal(at(DOOR - 0.01), 'door')
  assert.equal(at(DOOR), 'inside')
  assert.equal(at(DOOR + INSIDE - 0.01), 'inside')
  assert.equal(at(DOOR + INSIDE), 'out')
  assert.equal(at(DOOR + INSIDE + OUT), 'wash')
  assert.equal(at(VISIT - 0.01), 'wash')
  assert.equal(at(VISIT), 'done')
  assert.equal(at(VISIT + 100), 'done')
})
