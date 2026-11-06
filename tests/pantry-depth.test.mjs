// Draw order of the pantry furniture: runs web/pantry-items.js (it only defines drawing functions and the layout) and
// checks the depth keys PantryItems.depths() gives each LAYOUT entry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runWeb } from './web.mjs'

function loadPantry() {
  const ctx = { window: {} }
  runWeb('pantry-items', ctx)
  return ctx.window.PantryItems
}

const PI = loadPantry()
const Z = PI.depths(PI.LAYOUT)
const at = name => PI.LAYOUT.map((e, i) => [e, i]).filter(([e]) => e[0] === name).map(([, i]) => i)
const key = name => Z[at(name)[0]]

test('one key per layout entry', () => {
  assert.equal(Z.length, PI.LAYOUT.length)
  for (const z of Z) assert.ok(Number.isFinite(z))
})

test('the microwave draws after the drinks cooler it partly stands on', () => {
  // microwave x 4.65..5.6 rests on the cabinet (3.15..4.95) and the cooler (4.95..5.95) at counter height
  assert.ok(key('microwave') > key('drinkfridge'))
  for (const i of at('cabinet')) assert.ok(key('microwave') > Z[i])
})

test('every counter-top item draws after each base unit under it', () => {
  PI.LAYOUT.forEach(([n, rx, ry, rz], i) => {
    if (!(rz > 0)) return
    const [w, h] = PI.I[n].size
    PI.LAYOUT.forEach(([m, bx, by, bz], j) => {
      const it = PI.I[m]
      if (bz || it.flat || it.wall || m === 'planter') return
      const [bw, bh] = it.size
      if (rx < bx + bw && bx < rx + w && ry < by + bh && by < ry + h) assert.ok(Z[i] > Z[j], `${n} over ${m}`)
    })
  })
})

test('the wall cabinet draws after the fridge to its left, and wall items stay behind the floor ones', () => {
  // the fridge ends at x 1.27, the wall cabinet starts at 1.45: the cabinet is nearer, so it covers the fridge's edge
  assert.ok(key('wallcab') > key('fridge'))
  assert.ok(key('neon') > key('wallcab'))
  for (const i of at('cabinet')) assert.ok(key('fridge') < Z[i] && key('wallcab') < Z[i])
  for (const i of at('planter')) assert.ok(key('neon') < Z[i])
})

test('base furniture keeps its near-corner key', () => {
  for (const n of ['cabinet', 'drinkfridge', 'espresso', 'sink', 'island']) {
    const [, rx, ry] = PI.LAYOUT[at(n)[0]]
    assert.equal(key(n), 20 + rx + ry)
  }
})
