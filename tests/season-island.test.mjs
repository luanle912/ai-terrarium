// Where the seasons put things on the island and how what falls moves (web/season-island.js): the winter snowmen's
// tiles, the holiday trees by the office, the breeze and the falling petals, leaves and snow.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'
import { loadSkyLogic } from './load-sky-logic.mjs'

const SkyLogic = loadSkyLogic()
const { SeasonIsland: S } = loadWeb('season-island')
const W = 27, H = 14
const island = SkyLogic.buildIsland({ W, H })
const K = (x, y) => x + ',' + y

test('two or three snowmen, on open lawn, the same every time', () => {
  const men = S.snowmanTiles(island, W, H)
  assert.ok(men.length >= 2 && men.length <= 3, `${men.length} snowmen`)
  assert.deepEqual(S.snowmanTiles(SkyLogic.buildIsland({ W, H }), W, H), men)
  const walk = SkyLogic.lawnWalk(island, W, H)
  for (const m of men) {
    const k = K(m.x, m.y)
    assert.ok(island.cells.has(k), `${k} is off the island`)
    assert.ok(walk.has(k), `${k} is not open lawn`)
    for (const set of [island.paths.cells, island.pond.cells, island.mountain.cells, island.mountain.pool.cells])
      for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]])
        assert.ok(!set.has(K(m.x + a, m.y + b)), `${k} is on or beside a path, the water or the mountain`)
    assert.ok(!island.decor.some(d => d.kind !== 'flower' && d.x === m.x && d.y === m.y), `${k} is on decor`)
    assert.ok(!(m.x >= -1 && m.x <= W && m.y >= -1 && m.y <= H), `${k} is by the office walls`)
    assert.ok([0, 1, 2].includes(m.look))
  }
  for (const a of men)
    for (const b of men) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= S.SNOWMAN_GAP, 'too close')
})

test('the snowmen stand near the lake and the office', () => {
  const men = S.snowmanTiles(island, W, H)
  const lake = [...island.pond.cells].map(k => k.split(',').map(Number))
  const nearLake = m => lake.some(([x, y]) => Math.hypot(x - m.x, y - m.y) <= 4)
  assert.ok(nearLake(men[0]), 'the first snowman is not by the lake')
  const toOffice = m => Math.hypot(Math.max(0, -m.x, m.x + 1 - W), Math.max(0, -m.y, m.y + 1 - H))
  for (const m of men.slice(1)) assert.ok(toOffice(m) <= 9, `${m.x},${m.y} is far from the office`)
})

test('holiday trees are a few island trees, the nearest the office', () => {
  const ht = S.holidayTrees(island, W, H)
  const trees = island.decor.filter(d => d.kind === 'tree')
  assert.equal(ht.size, 3)
  for (const k of ht) assert.ok(trees.some(d => K(d.x, d.y) === k), k)
  const r = d => Math.hypot(Math.max(0, -d.x, d.x + 1 - W), Math.max(0, -d.y, d.y + 1 - H))
  const worst = Math.max(...trees.filter(d => ht.has(K(d.x, d.y))).map(r))
  for (const d of trees) if (!ht.has(K(d.x, d.y))) assert.ok(r(d) >= worst)
})

test('the breeze turns slowly and stays within -1..1', () => {
  let flips = 0, prev = S.breeze(0)
  for (let t = 0; t <= 600; t += 0.5) {
    const b = S.breeze(t)
    assert.ok(b >= -1 && b <= 1)
    assert.ok(Math.abs(b - prev) < 0.05, `jumps at ${t}`)
    if (Math.sign(b) !== Math.sign(prev)) flips++
    prev = b
  }
  assert.ok(flips >= 1 && flips <= 8, `${flips} turns in ten minutes`)
})

test('a fixed number of particles per kind, written into the same buffer every frame', () => {
  const buf = S.fallBuffer(), pool = buf.p.slice()
  for (const kind of ['petals', 'leaves', 'snow']) {
    const counts = new Set()
    for (let t = 0; t < 30; t += 0.37) {
      const out = S.fallStep(buf, island, kind, t, 0.35, false)
      assert.equal(out, buf)
      counts.add(out.n)
      for (let i = 0; i < out.n; i++) {
        const p = out.p[i]
        assert.equal(p, pool[i])
        assert.ok(p.z >= 0 && p.a >= 0 && p.a <= 1 && Number.isFinite(p.dx))
      }
    }
    assert.deepEqual([...counts], [S.FALL_N[kind]])
  }
  assert.ok(S.FALL_N.leaves > S.FALL_N.petals * 2, 'autumn has many leaves, spring few petals')
  assert.equal(S.fallStep(buf, island, null, 3, 0, false).n, 0)
})

test('particles fall, the breeze carries them, reduced motion holds them still', () => {
  const a = S.fallStep(S.fallBuffer(), island, 'leaves', 10, 0, false).p[0]
  const b = S.fallStep(S.fallBuffer(), island, 'leaves', 10.5, 0, false).p[0]
  assert.ok(b.z < a.z || b.z > 15, 'a leaf falls (or starts again at the top)')
  // with wind the drift follows the breeze's direction, growing as the leaf falls
  const t = 40, dir = Math.sign(S.breeze(t))
  const calm = S.fallStep(S.fallBuffer(), island, 'leaves', t, 0, false)
  const windy = S.fallStep(S.fallBuffer(), island, 'leaves', t, 0.35, false)
  let along = 0
  for (let i = 0; i < calm.n; i++) along += Math.sign((windy.p[i].dx - calm.p[i].dx) * dir)
  assert.ok(along > calm.n * 0.8)
  const s1 = S.fallStep(S.fallBuffer(), island, 'snow', 5, 0, true).p.map(p => p.z)
  const s2 = S.fallStep(S.fallBuffer(), island, 'snow', 50, 0, true).p.map(p => p.z)
  assert.deepEqual(s1, s2)
})
