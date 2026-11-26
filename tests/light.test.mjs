// When the scene's lights come on (web/light.js): one source for every threshold, each the one its asset always used.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb, readWeb } from './web.mjs'

const { Light } = loadWeb('light')

test('night is df below 0.5, day above it; at 0.5 exactly neither', () => {
  assert.deepEqual([0, 0.49, 0.5, 0.51, 1].map(Light.night), [true, true, false, false, false])
  assert.deepEqual([0, 0.49, 0.5, 0.51, 1].map(Light.day), [false, false, false, true, true])
})

test('glow: nothing from df 0.6 up, rising to full at 0 (what glowAt was)', () => {
  assert.equal(Light.glow(1), 0)
  assert.equal(Light.glow(0.6), 0)
  assert.equal(Light.glow(0), 1)
  assert.equal(Light.glow(0.3), 1 - 0.3 / 0.6)
  assert.ok(Light.glow(0.59) > 0)
})

test('screens light the desk below df 0.7; the floor shows its grain above 0.2 and its specks below 0.8', () => {
  assert.deepEqual([0.69, 0.7].map(Light.screen), [true, false])
  assert.deepEqual([0.2, 0.5, 0.8].map(Light.grain), [false, true, true])
  assert.deepEqual([0.2, 0.5, 0.8].map(Light.specks), [true, true, false])
  assert.equal(Light.floor, undefined, 'two booleans, no object a frame')
})

test('the lamp posts ramp across the same band: off at 0.8, full at 0.2 (IslandLife.lampGlow)', () => {
  assert.deepEqual([1, 0.8, 0.2, 0].map(Light.lamp), [0, 0, 1, 1])
  assert.ok(Math.abs(Light.lamp(0.5) - 0.5) < 1e-9)
  const { IslandLife } = loadWeb('island-life')
  for (let df = 0; df <= 1; df += 0.01) assert.equal(IslandLife.lampGlow(df), Light.lamp(df))
})

test('no light threshold is written out in the drawing code any more: they all read web/light.js', () => {
  const files = ['office-draw', 'office-draw-furniture', 'office-draw-restroom', 'office-draw-doghouse',
    'office-draw-smoking', 'office-draw-people', 'office-draw-critters', 'office-draw-festive', 'office-draw-xmas',
    'moment'] // (island-life's lamps are Light.lamp, above; its birds, fireflies and rainbow are wildlife, not lights)
  for (const f of files) {
    const src = readWeb(f)
    assert.doesNotMatch(src, /\b(?:G\.|env\.)?df\s*(?:<|>|<=|>=)\s*0\.[25678]\b/, f)
    assert.doesNotMatch(src, /1 - (?:G\.)?df \/ 0\.6/, f)
    assert.match(src, /from '\.\/light\.js'/, f)
  }
})
