import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWorldLogic } from './load-world-logic.mjs'

const W = loadWorldLogic()
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`)
const ids = (n) => Array.from({ length: n }, (_, i) => ({ id: 'i' + i }))
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

test('layout of an empty world is an empty map', () => {
  assert.equal(W.layout([], null).size, 0)
})

test('my island is at the centre', () => {
  const p = W.layout(ids(5), 'i3')
  assert.deepEqual(p.get('i3'), { x: 0, y: 0 })
  assert.equal(p.size, 5)
})

test('islands never overlap', () => {
  const p = [...W.layout(ids(20), 'i7').values()]
  for (let a = 0; a < p.length; a++)
    for (let b = a + 1; b < p.length; b++) assert.ok(dist(p[a], p[b]) >= W.SPACING - 1e-9, `${a},${b}`)
})

test('layout is stable for the same order', () => {
  assert.deepEqual([...W.layout(ids(8), 'i2')], [...W.layout(ids(8), 'i2')])
})

test('a missing own island leaves the centre free and does not throw', () => {
  const p = W.layout(ids(6), 'x')
  assert.equal(p.size, 6)
  for (const q of p.values()) assert.ok(dist(q, { x: 0, y: 0 }) >= W.SPACING - 1e-9)
})

test('lodFor thresholds', () => {
  assert.equal(W.lodFor(500, 1000), 'full')
  assert.equal(W.lodFor(499, 1000), 'mid')
  assert.equal(W.lodFor(W.THUMB_PX, 1000), 'mid')
  assert.equal(W.lodFor(W.THUMB_PX - 1, 1000), 'thumb')
})

test('toWorld inverts toScreen', () => {
  const cam = { x: 1.5, y: -0.7, z: 340 }
  const s = W.toScreen(cam, 2.2, 0.4, 1000, 600)
  const w = W.toWorld(cam, s.x, s.y, 1000, 600)
  close(w.x, 2.2); close(w.y, 0.4)
  assert.deepEqual(W.toScreen(cam, 1.5, -0.7, 1000, 600), { x: 500, y: 300 })
})

test('fitAll contains every island', () => {
  const pos = W.layout(ids(9), 'i0')
  const cam = W.fitAll(pos, 1000, 600)
  for (const p of pos.values()) {
    const a = W.toScreen(cam, p.x - 0.5, p.y - W.ISLAND_ASPECT / 2, 1000, 600)
    const b = W.toScreen(cam, p.x + 0.5, p.y + W.ISLAND_ASPECT / 2, 1000, 600)
    assert.ok(a.x >= 0 && a.y >= 0 && b.x <= 1000 && b.y <= 600)
  }
})

test('focusOn centres the island big enough for full detail', () => {
  const cam = W.focusOn({ x: 2, y: 1 }, 1000, 600)
  assert.equal(cam.x, 2); assert.equal(cam.y, 1)
  assert.equal(W.lodFor(cam.z, 1000), 'full')
})

test('visible rejects rects fully off stage', () => {
  assert.ok(W.visible({ x: 10, y: 10, w: 50, h: 50 }, 1000, 600))
  assert.ok(!W.visible({ x: 1000, y: 0, w: 50, h: 50 }, 1000, 600))
  assert.ok(!W.visible({ x: -60, y: 0, w: 50, h: 50 }, 1000, 600))
})

test('camStep converges in about 0.4 s and snaps', () => {
  let cam = { x: 0, y: 0, z: 100 }
  const goal = { x: 3, y: -2, z: 600 }
  for (let i = 0; i < 24; i++) cam = W.camStep(cam, goal, 1 / 60)
  assert.ok(Math.abs(cam.x - 3) < 0.05 * 3 && cam.z > 550)
  for (let i = 0; i < 60; i++) cam = W.camStep(cam, goal, 1 / 60)
  assert.deepEqual(cam, goal)
})

test('lodFor uses THUMB_PX, tuned within 120..160 (spec §12.3)', () => {
  assert.ok(W.THUMB_PX >= 120 && W.THUMB_PX <= 160, String(W.THUMB_PX))
  assert.equal(W.lodFor(W.THUMB_PX, 1000), 'mid')
  assert.equal(W.lodFor(W.THUMB_PX - 1, 1000), 'thumb')
})

test('pickRedraws takes the longest-waiting first and never exceeds the budget', () => {
  const due = Array.from({ length: 10 }, (_, i) => ({ id: 'i' + i, drawnAt: -Infinity }))
  assert.equal(W.pickRedraws(due, 2).size, 2)
  const mixed = [{ id: 'a', drawnAt: 30 }, { id: 'b', drawnAt: 10 }, { id: 'c', drawnAt: 20 }]
  assert.deepEqual([...W.pickRedraws(mixed, 2)].sort(), ['b', 'c'])
  assert.equal(W.pickRedraws(mixed, 0).size, 0)
  assert.equal(W.pickRedraws([], 3).size, 0)
})

test('never-drawn islands queue like the others', () => {
  const due = [{ id: 'old', drawnAt: 5 }, { id: 'n1', drawnAt: -Infinity }, { id: 'n2', drawnAt: -Infinity }, { id: 'n3', drawnAt: -Infinity }]
  const got = W.pickRedraws(due, 2)
  assert.equal(got.size, 2)
  assert.ok(!got.has('old'))
})

test('clientSessions maps a public view', () => {
  const out = W.clientSessions([
    { id: 's1', parent: 'p', status: 'working', waitingOn: null, talkingTo: 'x', dept: 'proj', kind: 'main', tool: 'Bash', model: 'm' },
    { id: 's2', parent: null, status: 'idle', waitingOn: null, talkingTo: null, dept: 'proj', kind: 'main' },
    { parent: 'p', status: 'idle' },
    { id: 7 },
  ])
  assert.equal(out.length, 2)
  assert.deepEqual(Object.keys(out[0]).sort(), ['id', 'kind', 'model', 'parentId', 'project', 'status', 'talkingTo', 'tool', 'waitingOn'])
  assert.equal(out[0].parentId, 'p')
  assert.equal(out[0].project, 'proj')
  assert.deepEqual(Object.keys(out[1]).sort(), ['id', 'kind', 'parentId', 'project', 'status', 'talkingTo', 'waitingOn'])
})
