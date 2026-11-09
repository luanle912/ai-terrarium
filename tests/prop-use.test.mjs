import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'

const { PropUse } = loadWeb('prop-use')
const { ID, N } = PropUse
const spots = [
  { act: 'microwave', prop: 'microwave' },
  { act: 'phone' },
  { act: 'wc', room: 'f', wash: { prop: 'basin-f1' } },
  { act: 'arcade', prop: 'arcade1' },
]
const fresh = () => new Uint8Array(N)
const at = (i, extra = {}) => ({
  desk: 3, status: 'idle', idleSpot: i, actNow: spots[i].act, moving: false, goalKey: 'idle' + i, ...extra,
})
const used = (agents) => [...PropUse.mark(fresh(), agents, spots)].flatMap((v, i) => (v ? [PropUse.NAMES[i]] : []))

test('every desk and every pantry / restroom device has its own index', () => {
  for (let i = 0; i < 16; i++) assert.equal(ID['desk' + i], i)
  for (const n of ['fridge', 'espresso', 'grinder', 'sink', 'microwave', 'drinkfridge', 'island', 'cafe0', 'cafe2',
    'arcade0', 'arcade1', 'foosball', 'basin-m0', 'basin-f1'])
    assert.ok(Number.isInteger(ID[n]), n)
  assert.equal(new Set(PropUse.NAMES).size, N)
})

test('a desk is in use only while its owner sits at it', () => {
  const owner = { desk: 5, seated: true, status: 'working' }
  assert.deepEqual(used([owner]), ['desk5'])
  assert.deepEqual(used([{ ...owner, seated: false, moving: true }]), [], 'walking back to the desk')
  assert.deepEqual(used([{ ...owner, sleeping: true }]), [], 'asleep at the desk')
  assert.deepEqual(used([{ ...owner, leaving: true }]), [], 'leaving')
  assert.deepEqual(used([{ ...owner, parent: 1 }]), [], 'a sub-agent standing by')
})

test('an idle spot lights its prop only once the agent has arrived and is doing the act', () => {
  assert.deepEqual(used([at(0)]), ['microwave'])
  assert.deepEqual(used([at(3)]), ['arcade1'])
  assert.deepEqual(used([at(0, { moving: true, actNow: null })]), [], 'still walking there')
  assert.deepEqual(used([at(0, { status: 'working' })]), [], 'called back to work')
  assert.deepEqual(used([at(1)]), [], 'a spot with no prop')
})

test('a restroom visitor runs the water only at the basin, while washing', () => {
  assert.deepEqual(used([at(2, { goalKey: 'wash2' })]), ['basin-f1'])
  assert.deepEqual(used([at(2)]), [], 'at the stall door')
  assert.deepEqual(used([at(2, { goalKey: 'wash2', moving: true, actNow: null })]), [], 'on the way to the basin')
})

test('ease lights up within UP seconds and goes dark within DOWN seconds, clamped to [0, 1]', () => {
  const lit = new Float32Array(N), on = fresh()
  on[ID.sink] = 1
  PropUse.ease(lit, on, PropUse.UP / 2)
  assert.ok(Math.abs(lit[ID.sink] - 0.5) < 1e-6)
  PropUse.ease(lit, on, 5)
  assert.equal(lit[ID.sink], 1)
  on[ID.sink] = 0
  PropUse.ease(lit, on, PropUse.DOWN / 4)
  assert.ok(Math.abs(lit[ID.sink] - 0.75) < 1e-6)
  assert.ok(PropUse.DOWN > PropUse.UP, 'going dark is the slower, softer change')
  PropUse.ease(lit, on, 5)
  assert.equal(lit[ID.sink], 0)
  assert.equal(lit[ID.fridge], 0)
})

test('the pantry layout maps each device to its prop, numbered arcades and cafe tables in layout order', () => {
  const layout = [['rug'], ['fridge'], ['arcade'], ['cafetable'], ['arcade'], ['cafetable'], ['foosball'], ['stool']]
  assert.deepEqual(PropUse.layoutProps(layout),
    [-1, ID.fridge, ID.arcade0, ID.cafe0, ID.arcade1, ID.cafe1, ID.foosball, -1])
})

test('every restroom wash place names a basin prop', async () => {
  const { loadSkyLogic } = await import('./load-sky-logic.mjs')
  const { loadRestroomLogic } = await import('./load-restroom-logic.mjs')
  const island = loadSkyLogic().buildIsland({ W: 27, H: 14 })
  const wc = loadRestroomLogic().layout(island.spots.find(s => s.id === 'east-back'), 56)
  const basins = wc.spots.map(s => s.wash.prop)
  for (const b of basins) assert.ok(Number.isInteger(ID[b]), b)
  assert.ok(new Set(basins).size >= 2)
})
