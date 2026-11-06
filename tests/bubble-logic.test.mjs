import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBubbleLogic } from './load-bubble-logic.mjs'

const B = loadBubbleLogic()
const ag = (id, status, extra = {}) => ({ id, status, tool: ['Edit', 'a.ts'], actNow: null, target: null, pinned: false, ...extra })

test('an office already busy on first sight stays quiet; a session clocking in speaks', () => {
  const mem = new Map()
  const out = B.step(mem, [ag('a', 'working'), ag('b', 'idle'), ag('c', 'entering')], 0)
  assert.equal(out.has('a'), false)
  assert.equal(out.has('b'), false)
  assert.equal(out.get('c'), 'show')
})

test('a status change speaks for SHOW_MS, then fades for FADE_MS, then the bubble is gone', () => {
  const mem = new Map()
  B.step(mem, [ag('a', 'working')], 0)
  assert.equal(B.step(mem, [ag('a', 'thinking')], 1000).get('a'), 'show')
  assert.equal(B.step(mem, [ag('a', 'thinking')], 1000 + B.SHOW_MS - 1).get('a'), 'show')
  assert.equal(B.step(mem, [ag('a', 'thinking')], 1000 + B.SHOW_MS + 1).get('a'), 'fade')
  assert.equal(B.step(mem, [ag('a', 'thinking')], 1000 + B.SHOW_MS + B.FADE_MS + 1).has('a'), false)
})

test('a new tool while still working waits out the cool-down; a status change does not', () => {
  const mem = new Map()
  B.step(mem, [ag('a', 'idle')], 0)
  assert.equal(B.step(mem, [ag('a', 'working')], 100).get('a'), 'show')
  const later = 100 + B.SHOW_MS + B.FADE_MS + 10
  assert.equal(B.step(mem, [ag('a', 'working', { tool: ['Bash', 'ls'] })], later).has('a'), false, 'tool change inside the cool-down stays quiet')
  assert.equal(B.step(mem, [ag('a', 'working', { tool: ['Read', 'b.ts'] })], 100 + B.COOL_MS + 1).get('a'), 'show', 'after the cool-down it speaks again')
  assert.equal(B.step(mem, [ag('a', 'permission')], 100 + B.COOL_MS + 2).get('a'), 'show', 'a status change speaks at once')
})

test('the same tool with a different file is not a new line', () => {
  const mem = new Map()
  B.step(mem, [ag('a', 'working', { tool: ['Edit', 'a.ts'] })], 0)
  assert.equal(B.step(mem, [ag('a', 'working', { tool: ['Edit', 'b.ts'] })], B.COOL_MS + 1).has('a'), false)
})

test('a break activity change is a new line', () => {
  const mem = new Map()
  B.step(mem, [ag('a', 'idle', { actNow: 'coffee' })], 0)
  assert.equal(B.step(mem, [ag('a', 'idle', { actNow: 'microwave' })], B.COOL_MS + 1).get('a'), 'show')
})

test('at most MAX_TALKING bubbles speak at once; the oldest give way and fade', () => {
  const mem = new Map()
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  B.step(mem, ids.map((id) => ag(id, 'idle')), 0)
  let out
  ids.forEach((id, i) => { out = B.step(mem, ids.map((x, j) => ag(x, j <= i ? 'working' : 'idle')), 10 + i) })
  const showing = ids.filter((id) => out.get(id) === 'show')
  assert.equal(showing.length, B.MAX_TALKING)
  assert.deepEqual(showing, ['c', 'd', 'e', 'f'], 'the newest lines stay')
  assert.equal(out.get('a'), 'fade')
})

test('pinned agents (approval, error, selected, hovered) always show and do not use up a place', () => {
  const mem = new Map()
  const ids = ['a', 'b', 'c', 'd', 'e']
  B.step(mem, [...ids.map((id) => ag(id, 'idle')), ag('p', 'permission', { pinned: true })], 0)
  const out = B.step(mem, [...ids.map((id) => ag(id, 'working')), ag('p', 'permission', { pinned: true })], 5)
  assert.equal(out.get('p'), 'show')
  assert.equal(ids.filter((id) => out.get(id) === 'show').length, B.MAX_TALKING)
  const quiet = B.step(mem, [ag('p', 'permission', { pinned: true })], 10 * B.SHOW_MS)
  assert.equal(quiet.get('p'), 'show', 'still shown long after it started')
})

test('the settings modes and the statuses that count as work', () => {
  assert.deepEqual(B.MODES, ['speech', 'always', 'off'])
  for (const s of ['working', 'thinking', 'talking', 'waiting']) assert.ok(B.BUSY.has(s), s)
  for (const s of ['idle', 'done', 'entering', 'leaving', 'permission', 'error']) assert.ok(!B.BUSY.has(s), s)
})

test('agents at work passed as pinned do not use up a talking place', () => {
  const mem = new Map()
  const idle = ['a', 'b', 'c', 'd', 'e']
  B.step(mem, [...idle.map((id) => ag(id, 'idle')), ...['w1', 'w2', 'w3'].map((id) => ag(id, 'working', { pinned: true }))], 0)
  const out = B.step(mem, [...idle.map((id) => ag(id, 'idle', { actNow: 'coffee' })), ...['w1', 'w2', 'w3'].map((id) => ag(id, 'working', { pinned: true }))], 5)
  assert.equal(['w1', 'w2', 'w3'].filter((id) => out.get(id) === 'show').length, 3)
  assert.equal(idle.filter((id) => out.get(id) === 'show').length, B.MAX_TALKING)
})

test('agents that leave are forgotten', () => {
  const mem = new Map()
  B.step(mem, [ag('a', 'working'), ag('b', 'working')], 0)
  B.step(mem, [ag('a', 'working')], 1)
  assert.deepEqual([...mem.keys()], ['a'])
})
