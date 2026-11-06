import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'
import { loadSkyLogic } from './load-sky-logic.mjs'

const SkyLogic = loadSkyLogic()
const { IslandLand } = loadWeb('island-land')
const W = 27, H = 14, TW = 16
const island = IslandLand.buildIsland({ W, H })
const has = (x, y) => island.cells.has(x + ',' + y)
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const neighbours = (x, y) => N4.filter(([a, b]) => has(x + a, y + b)).length

test('the page sees the same island builder through SkyLogic', () => {
  assert.equal(SkyLogic.buildIsland, IslandLand.buildIsland)
  assert.equal(IslandLand.SQUARE_MARGIN, 4)
  assert.equal(IslandLand.SQUIRCLE_P, 5)
  assert.deepEqual(IslandLand.centre(W, H), { cx: (W + 10) / 2, cy: H / 2, R: (W + 10) / 2 + 4 })
  assert.deepEqual(island.shape, IslandLand.centre(W, H))
})

test('island is deterministic', () => {
  const again = IslandLand.buildIsland({ W, H })
  assert.deepEqual(again.list, island.list)
  assert.deepEqual(again.decor, island.decor)
})

test('the island is a square centred on the office block', () => {
  const { minX, maxX, minY, maxY } = island.bounds
  assert.ok(Math.abs(maxX - minX - (maxY - minY)) <= 2, `bounds are ${maxX - minX} × ${maxY - minY}`)
  const mx = (minX + maxX) / 2, my = (minY + maxY) / 2
  assert.ok(Math.hypot(mx - (W + 10) / 2, my - H / 2) <= 1, `bounds centre ${mx},${my}`)
  // The approved mockup's radius ((W + 10) / 2 + 4) with its shore wave leaves 2 tiles here, 3 counting the x = -1 row.
  const left = island.list.filter((c) => c.y === 7 && c.x < -1).length
  assert.ok(left >= 2 && left <= 5, `${left} grass tiles left of the office on row 7`)
})

test('the island contains the whole office block', () => {
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W + 10; x++) assert.ok(has(x, y), `office block cell ${x},${y}`)
})

test('shore has no one-tile spikes or notches', () => {
  for (const key of island.cells) {
    const [x, y] = key.split(',').map(Number)
    assert.ok(neighbours(x, y) >= 2, `spike at ${key}`)
  }
  const { minX, maxX, minY, maxY } = island.bounds
  for (let y = minY - 1; y <= maxY; y++) for (let x = minX - 1; x <= maxX; x++) {
    if (!has(x, y)) assert.ok(neighbours(x, y) <= 2, `notch at ${x},${y}`)
  }
})

test('the underside is one cone with its tip near the middle', () => {
  const { cx, cy } = island.shape
  const tip = island.list.reduce((a, b) => (b.d > a.d ? b : a))
  assert.ok(Math.hypot(tip.x + 0.5 - cx, tip.y + 0.5 - cy) <= 3, `the tip hangs under ${tip.x},${tip.y}`)
  const { minX, maxX, minY, maxY } = island.bounds
  const width = (maxX - minY - (minX - maxY)) * TW
  const r = tip.d / width
  assert.ok(r >= 0.28 && r <= 0.38, `the tip is ${(r * 100).toFixed(1)}% of the island's screen width deep`)
})

test('the cone falls off outward without steps', () => {
  const { cx, cy } = island.shape
  const far = (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
  for (const c of island.list)
    for (const [a, b] of N4) {
      const d = island.depth.get(c.x + a + ',' + (c.y + b))
      if (d === undefined || far(c.x + a, c.y + b) <= far(c.x, c.y)) continue
      assert.ok(d <= c.d + 2, `${c.x + a},${c.y + b} hangs ${d} under ${c.x},${c.y} at ${c.d}`)
    }
})
