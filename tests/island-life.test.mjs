import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'

const { IslandLife } = loadWeb('island-life')
const { IslandLand } = loadWeb('island-land')
const { IslandLakeLife: L } = loadWeb('island-lake-life')

test('lamps are lit after dark, off by day, and fade between', () => {
  assert.equal(IslandLife.lampGlow(1), 0)
  assert.equal(IslandLife.lampGlow(0.8), 0)
  assert.equal(IslandLife.lampGlow(0.2), 1)
  assert.equal(IslandLife.lampGlow(0), 1)
  assert.ok(Math.abs(IslandLife.lampGlow(0.5) - 0.5) < 1e-9)
  assert.ok(IslandLife.lampGlow(0.3) > IslandLife.lampGlow(0.6))
})

test('the falls run harder in the rain', () => {
  const fx = rain => ({ cloud: 0, rain, snow: 0, storm: 0, fog: 0 })
  assert.equal(IslandLife.fallFlow(fx(0)), 1)
  assert.equal(IslandLife.fallFlow(fx(0.5)), 1.5)
  assert.equal(IslandLife.fallFlow(fx(1)), 2)
  assert.equal(IslandLife.fallFlow(fx(3)), 2)
})

test('a rainbow shows by day for three minutes after the rain stops', () => {
  const now = 10_000_000,
    clear = { cloud: 0.2, rain: 0, snow: 0, storm: 0, fog: 0 },
    rainy = { cloud: 0.9, rain: 1, snow: 0, storm: 0, fog: 0 },
    level = (fx, df, ago) => IslandLife.rainbowLevel({ fx, df, lastRainAt: now - ago, now })
  assert.ok(level(clear, 1, 30_000) > 0, 'stopped 30 s ago, by day')
  assert.equal(level(rainy, 1, 0), 0, 'still raining')
  assert.equal(level(clear, 0, 30_000), 0, 'at night')
  assert.equal(level(clear, 1, 181_000), 0, 'stopped 181 s ago')
  assert.ok(level(clear, 1, 30_000) > level(clear, 1, 90_000), 'fades as time passes')
  assert.ok(Math.abs(level(clear, 1, 90_000) - 0.5) < 1e-9, 'linear: half way at 90 s')
  assert.equal(IslandLife.rainbowLevel({ fx: clear, df: 1, lastRainAt: -Infinity, now }), 0, 'no rain yet')
  // the sun after the rain, not snow, a storm or fog that follow it
  for (const k of ['snow', 'storm', 'fog']) assert.equal(level({ ...clear, [k]: 1 }, 1, 30_000), 0, `in ${k}`)
})

test('birds fly by day, fireflies glow at night, and the same arrays are reused', () => {
  const seed = 7
  // Over a day hour flocks of 3-5 birds cross now and then; never a firefly.
  let sawBirds = false
  for (let t = 0; t < 400; t += 0.5) {
    const c = IslandLife.creatures(t, 1, seed)
    assert.equal(c.flies.length, 0)
    if (c.birds.length) {
      sawBirds = true
      assert.ok(c.birds.length >= 3 && c.birds.length <= 5, `flock of ${c.birds.length}`)
    }
  }
  assert.ok(sawBirds)
  // At night: eight fireflies, no birds.
  for (let t = 0; t < 400; t += 7) {
    const c = IslandLife.creatures(t, 0, seed)
    assert.equal(c.birds.length, 0)
    assert.equal(c.flies.length, 8)
  }
  const a = IslandLife.creatures(12, 0, seed),
    b = IslandLife.creatures(13, 1, seed)
  assert.equal(a, b)
  assert.equal(a.birds, b.birds)
  assert.equal(a.flies, b.flies)
})

test('flocks cross 40 to 90 seconds apart', () => {
  const starts = []
  let was = false
  for (let t = 0; t < 2000; t += 0.25) {
    const on = IslandLife.creatures(t, 1, 3).birds.length > 0
    if (on && !was) starts.push(t)
    was = on
  }
  assert.ok(starts.length >= 20, `${starts.length} flocks`)
  for (let i = 1; i < starts.length; i++) {
    const gap = starts[i] - starts[i - 1]
    assert.ok(gap >= 40 - 0.25 && gap <= 90 + 0.25, `gap ${gap}`)
  }
})

test('in the dusk between, neither birds nor fireflies', () => {
  for (let t = 0; t < 300; t += 3) {
    const c = IslandLife.creatures(t, 0.45, 1)
    assert.equal(c.birds.length, 0)
    assert.equal(c.flies.length, 0)
  }
})

test('motion phases advance with elapsed time, so a weather blend never makes falls or vines jump', () => {
  const M = IslandLife.motionPhases
  M.reset()
  M.step(3600, { rain: 0, storm: 0 })
  const a = M.step(3600.016, { rain: 0, storm: 0 }),
    f0 = a.flow,
    w0 = a.wind
  // an hour after load the rain jumps mid-blend: the phases move by one frame's worth, not by t × Δspeed
  const b = M.step(3600.032, { rain: 0.6, storm: 0.4 })
  assert.ok(b.flow - f0 < 0.05, `flow phase step ${b.flow - f0}`)
  assert.ok(b.wind - w0 < 0.05, `wind phase step ${b.wind - w0}`)
  // the same t twice (several islands drawn in one frame) does not advance
  const again = M.step(3600.032, { rain: 0.6, storm: 0.4 }).flow
  assert.equal(again, b.flow)
  // a long gap (a hidden tab) is capped at 0.25 s
  const c = M.step(3700, { rain: 0, storm: 0 })
  assert.ok(c.flow - b.flow <= 0.25 * 2 + 1e-9)
})

// ---- the lake: ducks, fish shadows, duckweed (web/island-lake-life.js) ----

const island = IslandLand.buildIsland({ W: 27, H: 14 })
const K = (x, y) => Math.floor(x) + ',' + Math.floor(y)
const lake = island.pond.cells
const blocked = new Set([
  K(island.pavilion.pillar.x, island.pavilion.pillar.y),
  ...island.pavilion.path.map(p => K(p.x, p.y)),
  ...island.lotus.map(l => K(l.x, l.y)),
])
// the tile under a point and the tiles under its body, `r` tiles either side
const around = (x, y, r) => [K(x, y), K(x - r, y), K(x + r, y), K(x, y - r), K(x, y + r)]

test('two or three ducks swim on open lake water, never on the bank, the stones, the pillar or the lotus', () => {
  L.reset(island)
  let t = 0
  const start = L.ducks(island, t, 1, false).map(d => [d.x, d.y])
  assert.ok(start.length >= 2 && start.length <= 3, `${start.length} ducks`)
  let moved = 0,
    dived = false
  for (; t < 900; t += 0.25) {
    const ds = L.ducks(island, t, 1, false)
    for (const d of ds) {
      for (const k of around(d.x, d.y, 0.25)) {
        assert.ok(lake.has(k), `duck off the lake at ${d.x},${d.y}`)
        assert.ok(!blocked.has(k), `duck over the pavilion, its stones or a lotus at ${d.x},${d.y}`)
      }
      if (d.dive > 0.5) dived = true
      assert.ok(d.face === 1 || d.face === -1)
      assert.equal(d.asleep, false)
    }
    moved = Math.max(moved, Math.hypot(ds[0].x - start[0][0], ds[0].y - start[0][1]))
  }
  assert.ok(moved > 1, 'ducks swim about by day')
  assert.ok(dived, 'now and then a duck dives')
})

test('ducks swim slowly: well under a fifth of a tile a second', () => {
  L.reset(island)
  let prev = L.ducks(island, 100, 1, false).map(d => [d.x, d.y])
  for (let t = 100.1; t < 300; t += 0.1) {
    const ds = L.ducks(island, t, 1, false)
    ds.forEach((d, i) => assert.ok(Math.hypot(d.x - prev[i][0], d.y - prev[i][1]) <= 0.02 + 1e-9, 'too fast'))
    prev = ds.map(d => [d.x, d.y])
  }
})

test('at night the ducks sleep: they stay put, heads down', () => {
  L.reset(island)
  L.ducks(island, 10, 1, false)
  const a = L.ducks(island, 10.1, 0.2, false).map(d => [d.x, d.y])
  for (let t = 11; t < 400; t += 3) {
    const ds = L.ducks(island, t, 0.2, false)
    ds.forEach((d, i) => {
      assert.ok(d.asleep, 'asleep at night')
      assert.deepEqual([d.x, d.y], a[i], 'a sleeping duck does not move')
      assert.equal(d.dive, 0, 'no diving at night')
    })
  }
  // reduced motion: they stay put by day too
  L.reset(island)
  const b = L.ducks(island, 5, 1, true).map(d => [d.x, d.y])
  assert.deepEqual(
    L.ducks(island, 60, 1, true).map(d => [d.x, d.y]),
    b,
  )
})

test('ducks ease to a stop at dusk instead of jumping, and resume where they stopped', () => {
  L.reset(island)
  let prev = null
  for (let t = 0, df = 1; t < 120; t += 0.1, df = Math.max(0, df - 0.002)) {
    const ds = L.ducks(island, t, df, false).map(d => [d.x, d.y])
    if (prev) ds.forEach((p, i) => assert.ok(Math.hypot(p[0] - prev[i][0], p[1] - prev[i][1]) < 0.03, 'jump'))
    prev = ds
  }
  // a long gap (a hidden tab) moves them a bounded step only
  const before = L.ducks(island, 120, 1, false).map(d => [d.x, d.y])
  const after = L.ducks(island, 5000, 1, false).map(d => [d.x, d.y])
  before.forEach((p, i) => assert.ok(Math.hypot(p[0] - after[i][0], p[1] - after[i][1]) < 0.1))
})

test('three or four fish shadows glide inside the lake, never under the lotus, the stones or the pillar', () => {
  const n = L.fish(island, 0).length
  assert.ok(n >= 3 && n <= 4, `${n} fish`)
  let moved = 0
  const f0 = L.fish(island, 0).map(f => [f.x, f.y])
  for (let t = 0; t < 900; t += 0.5) {
    const fs = L.fish(island, t)
    for (const f of fs) {
      for (const k of around(f.x, f.y, 0.3)) {
        assert.ok(lake.has(k), `fish out of the lake at ${f.x},${f.y}`)
        assert.ok(!blocked.has(k), `fish under a lotus, a stone or the pillar at ${f.x},${f.y}`)
      }
      assert.ok(Math.abs(Math.hypot(f.hx, f.hy) - 1) < 1e-6, 'heading is a unit vector')
    }
    moved = Math.max(moved, Math.hypot(fs[0].x - f0[0][0], fs[0].y - f0[0][1]))
  }
  assert.ok(moved > 1, 'fish glide about')
})

test('duckweed drifts very slowly, within half a tile of its home, on the water', () => {
  const homes = island.duckweed
  assert.equal(L.weed(island, 0).length, homes.length)
  let far = 0
  for (let t = 0; t < 3600; t += 7) {
    const ws = L.weed(island, t)
    ws.forEach((w, i) => {
      const h = homes[i]
      assert.ok(Math.abs(w.x - (h.x + 0.5)) <= 0.5 && Math.abs(w.y - (h.y + 0.5)) <= 0.5, 'strayed from home')
      assert.ok(lake.has(K(w.x, w.y)), 'duckweed on the bank')
      far = Math.max(far, Math.hypot(w.x - h.x - 0.5, w.y - h.y - 0.5))
    })
  }
  assert.ok(far > 0.1, 'duckweed drifts')
  // very slowly: under 0.01 tile a second
  const a = L.weed(island, 100).map(w => [w.x, w.y]),
    b = L.weed(island, 101).map(w => [w.x, w.y])
  a.forEach((p, i) => assert.ok(Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) < 0.01))
})

test('ducks, fish and duckweed reuse the same arrays and objects every call', () => {
  const d1 = L.ducks(island, 1, 1, false),
    d2 = L.ducks(island, 2, 0, false)
  assert.equal(d1, d2)
  const f1 = L.fish(island, 1),
    o = f1[0]
  assert.equal(L.fish(island, 2), f1)
  assert.equal(L.fish(island, 3)[0], o)
  const w1 = L.weed(island, 1)
  assert.equal(L.weed(island, 2), w1)
})

test('the pavilion lantern height is one named constant, about 28 px above the water', () => {
  assert.ok(L.LANTERN_Z >= 20 && L.LANTERN_Z <= 36)
})
