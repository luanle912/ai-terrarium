import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'

const { IslandLife } = loadWeb('island-life')

test('lamps are lit after dark, off by day, and fade between', () => {
  assert.equal(IslandLife.lampGlow(1), 0)
  assert.equal(IslandLife.lampGlow(0.8), 0)
  assert.equal(IslandLife.lampGlow(0.2), 1)
  assert.equal(IslandLife.lampGlow(0), 1)
  assert.ok(Math.abs(IslandLife.lampGlow(0.5) - 0.5) < 1e-9)
  assert.ok(IslandLife.lampGlow(0.3) > IslandLife.lampGlow(0.6))
})

test('the falls and the river run harder in the rain', () => {
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
