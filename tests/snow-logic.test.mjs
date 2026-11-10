// Winter's snow as logic (web/snow-logic.js): how deep it lies for a snow cover, where it drifts, where icicles hang
// off the island's edge, and the fixed buffer of footprints.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadSkyLogic } from './load-sky-logic.mjs'

const SkyLogic = loadSkyLogic()
const { SnowLogic: S } = loadWeb('snow-logic')
const { SeasonLogic } = loadWeb('season-logic')
const W = 27, H = 14
const island = SkyLogic.buildIsland({ W, H })
const K = (x, y) => x + ',' + y

test('depth: none, thin, medium, deep at the spec thresholds', () => {
  for (const [snow, d] of [[0, 0], [0.14, 0], [0.15, 1], [0.44, 1], [0.45, 2], [0.8, 2], [0.81, 3], [1, 3]])
    assert.equal(S.depth(snow), d, `snow ${snow}`)
  assert.equal(S.depth(SeasonLogic.look('winter').minSnow), 2, "winter's lasting cover is medium")
})

test('depth never goes back as the cover grows, and changes at three of the eleven bake levels only', () => {
  let changes = 0
  for (let b = 1; b <= 10; b++) {
    const a = S.depth((b - 1) / 10), c = S.depth(b / 10)
    assert.ok(c >= a)
    if (c !== a) changes++
  }
  assert.equal(changes, 3)
})

test('drifts lie on open lawn: off the paths, the water, the office and where people stand; the same every time', () => {
  const d = S.drifts(island, W, H)
  assert.ok(d.length >= 12, `${d.length} drifts`)
  assert.deepEqual(S.drifts(SkyLogic.buildIsland({ W, H }), W, H), d)
  const stand = new Set([...island.pond.spots, island.rest.bench, island.rest.fish].map(p => K(p.x, p.y)))
  for (const { x, y, h, side } of d) {
    const k = K(x, y)
    assert.ok(island.cells.has(k), `${k} off the island`)
    assert.ok(!(x >= 0 && y >= 0 && x < W && y < H), `${k} in the office`)
    for (const [name, set] of [['path', island.paths.cells], ['lake', island.pond.cells], ['pool', island.mountain.pool.cells], ['standing place', stand]])
      assert.ok(!set.has(k), `${k} on a ${name}`)
    assert.ok(h >= 1 && h <= 3)
    assert.ok(['wall', 'tree', 'rock', 'bench'].includes(side))
  }
  assert.ok(new Set(d.map(x => x.side)).size >= 3, 'several kinds of drift')
})

test('icicles hang off edge tiles, 2 to 7 px long, the same every time', () => {
  const ic = S.icicles(island)
  assert.ok(ic.length >= 30, `${ic.length} icicles`)
  assert.deepEqual(S.icicles(SkyLogic.buildIsland({ W, H })), ic)
  for (const { x, y, plane, t, len } of ic) {
    assert.ok(island.cells.has(K(x, y)))
    assert.ok(!island.cells.has(plane === 'y' ? K(x, y + 1) : K(x + 1, y)), `${K(x, y)} is not on the ${plane} edge`)
    assert.ok(t >= 0 && t <= 1)
    assert.ok(len >= 2 && len <= 7)
  }
})

test('footprints: a fixed ring of 48, nothing allocated after it is made', () => {
  const b = S.prints(), xs = b.x
  for (let i = 0; i < 60; i++) S.addPrint(b, i, i + 0.5, i)
  assert.equal(b.n, 48)
  assert.equal(b.x, xs)
  assert.equal(b.x.length, 48)
  // the newest is kept, the oldest twelve are gone
  assert.ok([...b.t].includes(59))
  assert.ok(![...b.t].includes(11))
  assert.equal(S.PRINT_LIFE, 12)
})

test('the palette is white with blue shade, not mint', () => {
  for (const c of Object.values(S.PAL)) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
    assert.ok(b >= g && g >= r, `${c} leans green or red`)
  }
  assert.ok(S.NIGHT_K > 0 && S.NIGHT_K < 1)
})
