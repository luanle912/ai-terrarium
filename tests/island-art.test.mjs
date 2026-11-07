// The island's static art that has rules of its own: the lake's soft edge (web/island-art-lake.js lakeField),
// where the pavilion's lantern hangs (web/island-art.js pavilionLantern, which web/island-life.js glows at), the pool
// at the mountain's foot (web/island-art-mountain.js poolShape) and the one outline colour.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

import { loadWeb } from './web.mjs'
import { loadSkyLogic } from './load-sky-logic.mjs'

const SkyLogic = loadSkyLogic()
const W = 27, H = 14
const island = SkyLogic.buildIsland({ W, H })
const { PAVILION, pavilionLantern } = loadWeb('island-art')
const { lakeField, WATER_T } = loadWeb('island-art-lake')
const { at } = lakeField(island)
const wetAt = (x, y) => at(x, y) >= WATER_T

test('the lake water covers the pavilion, its stones, the lotus, the duck lanes and the bathers', () => {
  const pav = island.pavilion
  assert.ok(wetAt(pav.x, pav.y), 'the pillar stands in water')
  for (const s of pav.path) assert.ok(wetAt(s.x + 0.5, s.y + 0.5), `stone ${s.x},${s.y} is on dry land`)
  for (const l of island.lotus) assert.ok(wetAt(l.x + 0.5, l.y + 0.5), `lotus ${l.x},${l.y} is on dry land`)
  for (const d of island.duckweed) assert.ok(wetAt(d.x + 0.5, d.y + 0.5), `duckweed ${d.x},${d.y} is on dry land`)
  for (const lane of island.ducks.lanes) for (const [x, y] of lane) assert.ok(wetAt(x, y), `duck lane point ${x},${y}`)
  for (const s of island.pond.spots) assert.ok(wetAt(s.x + 0.5, s.y + 0.5), `bathing spot ${s.x},${s.y}`)
})

test('the soft lake edge never reaches where anyone walks on the lawn', () => {
  const walk = SkyLogic.lawnWalk(island, W, H),
    baths = new Set(island.pond.spots.map(s => s.x + ',' + s.y))
  for (const k of walk) {
    if (baths.has(k)) continue
    const [x, y] = k.split(',').map(Number)
    assert.ok(!wetAt(x + 0.5, y + 0.5), `the lawn tile ${k} is under water`)
  }
})

test('the lake runs out to the shore only at the main fall', () => {
  const f = island.waterfall
  assert.ok(wetAt(f.x + 0.5, f.y + 0.98), 'the water stops short of the lip')
  // everywhere else the water keeps inside its own tiles' shore: a lake tile on the shore has a dry band at its edge
  for (const k of island.pond.cells) {
    const [x, y] = k.split(',').map(Number)
    if (x === f.x && y === f.y) continue
    if (!island.cells.has(x + ',' + (y + 1))) assert.ok(!wetAt(x + 0.5, y + 0.99), `water spills off ${k}`)
    if (!island.cells.has(x + 1 + ',' + y)) assert.ok(!wetAt(x + 0.99, y + 0.5), `water spills off ${k}`)
  }
})

test('the pavilion lantern hangs under the front corner of its lower roof, over the lake', () => {
  const l = pavilionLantern(island),
    p = island.pavilion
  assert.ok(island.pond.cells.has(Math.floor(l.x) + ',' + Math.floor(l.y)), 'the lantern is not over the lake')
  // toward the viewer (+x and +y) from the hall's middle, out past the hall's walls and in under the eaves
  assert.equal(l.x - p.x, l.y - p.y)
  assert.ok(l.x - p.x > PAVILION.r.hall && l.x - p.x < PAVILION.r.eave)
  // below the eaves, above the platform's railing
  assert.ok(l.z < PAVILION.z.eave - 2 && l.z > PAVILION.z.deck + 3)
  assert.equal(pavilionLantern({ ...island, pavilion: undefined }), null)
})

// ---- the pool at the mountain's foot (web/island-art-mountain.js poolShape, which drawPool paints) ----
const { poolShape } = loadWeb('island-art-mountain')
const pool = poolShape(island)
const { gap } = island.mountain

test('the mountain fall lands in the pool\'s water, foam and all', () => {
  // the sheet's foot along the pool's back edge, and the band of foam web/island-life.js throws up in front of it
  for (let x = gap.x - gap.w; x <= gap.x + gap.w + 1e-9; x += gap.w / 4) {
    assert.ok(pool.wet(x, gap.y + 0.02), `the fall's foot at x ${x.toFixed(2)} is not on the water`)
    for (const dy of [0.15, 0.4, 0.65]) assert.ok(pool.wet(x, gap.y + dy), `foam at ${x.toFixed(2)},${dy} is off the water`)
  }
  for (const x of [gap.x - gap.w - 0.15, gap.x + gap.w + 0.15]) assert.ok(pool.wet(x, gap.y + 0.15), `foam edge at ${x}`)
})

test('the pool has a stone rim on its open sides, none on the back where the rock and the falls are', () => {
  const mx = (pool.x0 + pool.x1) / 2, my = (pool.y0 + pool.y1) / 2
  for (const [x, y] of [[pool.x0 + 0.08, my], [pool.x1 - 0.08, my], [mx, pool.y1 - 0.08]])
    assert.ok(pool.foot(x, y) && !pool.wet(x, y), `no rim stone at ${x},${y}`)
  assert.ok(pool.wet(mx, pool.y0 + 0.02), 'a rim along the back edge')
  // it stays on its own tiles, which nobody walks on
  for (let y = pool.y0 - 1; y < pool.y1 + 1; y += 0.1)
    for (let x = pool.x0 - 1; x < pool.x1 + 1; x += 0.1)
      if (pool.foot(x, y)) assert.ok(island.mountain.pool.cells.has(Math.floor(x) + ',' + Math.floor(y)), `pool at ${x},${y} is off its tiles`)
  assert.equal(poolShape({ ...island, mountain: null }), null)
})

test('one outline colour: no #2b2350 left anywhere in web/', () => {
  const dir = new URL('../web/', import.meta.url)
  const files = readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.js') || f.endsWith('.css'))
  for (const f of files) assert.ok(!/2b2350/i.test(readFileSync(new URL(f, dir), 'utf8')), `${f} still uses #2b2350`)
})
