import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb, readWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} } // office-scene.js only needs React for h()
const { WALLS, DOORS, WINDOWS, POTS, CLOCK, SHELF, KENNELS } = loadWeb('office-instances')
const { Labels } = loadWeb('labels')
const { DOG_HOUSES } = loadWeb('office-scene')

test('DOORS has 1 exit, 2 wc, 3 kennel', () => {
  const n = k => DOORS.filter(d => d.kind === k).length
  assert.deepEqual([n('exit'), n('wc'), n('kennel')], [1, 2, 3])
  assert.equal(KENNELS, DOG_HOUSES)
  for (const d of DOORS) assert.equal(d.at.length, 3, d.id)
})

test('WALLS outer includes office.back, office.left, wc.back, wc.front, wc.east; inner are the room walls', () => {
  const outer = WALLS.filter(w => w.kind === 'outer').map(w => w.id)
  for (const id of ['office.back', 'office.left', 'wc.back', 'wc.front', 'wc.east']) assert.ok(outer.includes(id), id)
  assert.ok(WALLS.some(w => w.kind === 'inner'))
  for (const w of WALLS) assert.ok(w.a.length === 2 && w.b.length === 2 && w.z1 > w.z0 && w.face, w.id)
})

test('WINDOWS are the four back-wall windows and office-draw reads them instead of its own copy', () => {
  assert.deepEqual(WINDOWS.map(w => w.x), [1.6, 4.8, 11.6, 14.8])
  assert.doesNotMatch(readWeb('office-draw'), /\[1\.6, 4\.8, 11\.6, 14\.8\]/)
  assert.equal(POTS.length, 3)
})

test('every label with instances has a non-empty list, and the ones named by the plan have them', () => {
  for (const id of ['wall.outer', 'wall.inner', 'door', 'window', 'desk', 'plant.pot', 'clock', 'shelf', 'kennel']) {
    assert.ok(Labels.byId(id).instances().length > 0, id)
  }
  for (const l of Labels.LIST) assert.ok(Array.isArray(l.instances()), l.id)
  assert.equal(Labels.byId('door').instances().length, DOORS.length)
  assert.equal(Labels.byId('clock').instances(), CLOCK)
  assert.equal(Labels.byId('shelf').instances(), SHELF)
})

test('exit wreath spot equals DOORS exit at, and the literal is gone from the xmas drawing', () => {
  const exit = DOORS.find(d => d.kind === 'exit')
  assert.deepEqual(loadWeb('office-draw-xmas').WREATH_SPOT, exit.at)
  assert.doesNotMatch(readWeb('office-draw-xmas'), /7\.05/)
})

test('the shelf and the clock are where office-draw draws them, read from the lists', () => {
  const src = readWeb('office-draw')
  assert.deepEqual([SHELF[0].at, SHELF[0].size], [[9.05, 0.05, 0], [0.9, 0.4, 42]])
  assert.deepEqual(CLOCK[0].at, [0, 12.8, 42])
  assert.doesNotMatch(src, /9\.05|12\.8, 42/)
  assert.match(src, /SHELF\[0\]/)
  assert.match(src, /CLOCK\[0\]/)
})

test('DOORS and their spots are frozen, so the wreath spot cannot be changed through an alias', () => {
  assert.ok(Object.isFrozen(DOORS))
  for (const d of DOORS) assert.ok(Object.isFrozen(d) && Object.isFrozen(d.at), d.id)
})

test('STRINGS covers every outer wall, and every door has a wreath spot', () => {
  loadI18n('vi')
  const { STRINGS, WREATHS } = loadWeb('office-draw-xmas')
  for (const w of WALLS.filter(w => w.kind === 'outer'))
    assert.ok(STRINGS.some(s => s.label === 'wall.outer' && s.inst === w && s.at.length > 0), w.id)
  assert.deepEqual(WREATHS.map(w => w.door), [...DOORS])
})
