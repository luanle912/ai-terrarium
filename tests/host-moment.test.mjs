// The host (ClaudeOffice) works out one Moment and one Look per frame (computeMoment) from the viewer's choices, and
// every scene reads them: the local page, and each island of the world view (IslandScene), which keeps no clock of
// its own (docs/specs/2026-11-18-asset-labels-design.md §5.1, D2, D3).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
globalThis.document ??= {
  documentElement: {},
  addEventListener() {},
  createElement: () => ({ width: 0, height: 0, getContext: () => null }),
}
const { ClaudeOffice } = loadWeb('office')
const { IslandScene } = loadWeb('island-scene')
const { SeasonLogic } = loadWeb('season-logic')

const NOV18 = new Date(2026, 10, 18, 12)
const DEC20 = new Date(2026, 11, 20, 12)
const host = over => ({ seasonChoice: 'auto', eventChoice: 'auto', seasonPreview: null, eventPreview: null, ...over })
const compute = (h, date) => ClaudeOffice.prototype.computeMoment.call(h, date)

test('computeMoment: 18 Nov with the event on is Christmas in winter, no Teachers\' Day trees', () => {
  const h = host({ eventChoice: 'on', snowShown: 0 })
  const m = compute(h, NOV18)
  assert.equal(m, h.moment)
  assert.equal(m.holiday, null)
  assert.equal(m.event.key, 'christmas')
  assert.equal(m.season, 'winter')
  assert.equal(h.look.of('tree.holiday'), 'xmas')
  assert.equal(SeasonLogic.seasonChip(m).label.includes(' · '), true)
})

test('computeMoment: 18 Nov on auto keeps the Teachers\' Day trees; the season getter names the holiday', () => {
  const h = host({})
  compute(h, NOV18)
  assert.equal(h.moment.holiday, 'teachers')
  assert.equal(h.moment.event, null)
  assert.equal(h.look.of('tree.holiday'), 'teachers')
  const season = Object.getOwnPropertyDescriptor(ClaudeOffice.prototype, 'season').get
  assert.equal(season.call(h), 'teachers')
})

test('computeMoment: the event off in December names no Christmas and puts up no Christmas tree', () => {
  const h = host({ eventChoice: 'off' })
  compute(h, DEC20)
  assert.equal(h.moment.event, null)
  assert.equal(h.moment.holiday, null)
  assert.equal(h.look.of('tree.holiday'), 'none')
  assert.equal(Object.getOwnPropertyDescriptor(ClaudeOffice.prototype, 'season').get.call(h), 'default')
})

test('computeMoment follows a new choice at once, within the same second', () => {
  const h = host({ eventChoice: 'on' })
  compute(h, NOV18)
  assert.equal(h.moment.event.key, 'christmas')
  h.eventChoice = 'off'
  compute(h, NOV18)
  assert.equal(h.moment.event, null)
  assert.equal(h.moment.holiday, 'teachers')
})

test('IslandScene reads the host\'s moment and look, and keeps no clock of its own', () => {
  const h = host({ eventChoice: 'on' })
  compute(h, NOV18)
  const scene = new IslandScene(h, 'island-1')
  assert.equal(scene.moment, h.moment)
  assert.equal(scene.look, h.look)
  assert.equal(scene.seasonNow(), h.moment.season)
  assert.equal(scene.eventNow().key, 'christmas')
  assert.equal(scene.season, 'default')
  // the host turns the event off: the island sees it on its very next call
  h.eventChoice = 'off'
  compute(h, NOV18)
  assert.equal(scene.eventNow(), null)
  assert.equal(scene.seasonNow(), 'autumn')
  assert.equal(scene.season, 'teachers')
  assert.equal(scene.look.of('tree.holiday'), 'teachers')
})

test('eventNow: the stopgap shape over the moment\'s event, the same object while the event does not change', () => {
  const h = host({ eventChoice: 'on', dogs: [] })
  compute(h, NOV18)
  const a = ClaudeOffice.prototype.eventNow.call(h)
  assert.deepEqual(a, { key: 'christmas', since: 14, level: 3, eve: true, day: true })
  compute(h, NOV18)
  assert.equal(ClaudeOffice.prototype.eventNow.call(h), a)
  assert.equal(ClaudeOffice.prototype.seasonNow.call(h), 'winter')
})
