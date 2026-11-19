// When the Look changes (the event switched on or off, a preview ending) everything follows in the same frame, paused
// or not (docs/specs/2026-11-18-asset-labels-design.md §2.4, §5.7, D4): the pure core is web/look-change.js, the
// host's part is ClaudeOffice#onLook (web/office-look.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
globalThis.document ??= {
  documentElement: {},
  addEventListener() {},
  createElement: () => ({ width: 0, height: 0, getContext: () => null }),
}
const { LookChange } = loadWeb('look-change')
const { Theme } = loadWeb('theme')
const { Moment } = loadWeb('moment')
const { BubbleLogic } = loadWeb('bubble-logic')
const { ClaudeOffice } = loadWeb('office')
loadWeb('office-agents')
loadWeb('office-draw-fate')
loadWeb('office-draw-critters')
loadWeb('office-draw-bears')
loadWeb('office-draw-idle-xmas')
loadWeb('office-look')
const { BLOCK, IDLE_SPOTS } = loadWeb('office-scene')

const DEC20 = new Date(2026, 11, 20, 12)
const momentOf = eventChoice =>
  Moment.at({ date: DEC20, now: DEC20.getTime(), seasonChoice: 'auto', eventChoice, df: 1, snow: 0.8 })
const XMAS = Theme.resolve(momentOf('on'))
const NONE = Theme.resolve(momentOf('off'))

test('diff christmas→none lists idle/fate/critter rules off and blockChanged true', () => {
  const d = LookChange.diff(XMAS, NONE)
  const off = ['idle.snowball', 'idle.skate', 'fate.sleigh', 'fate.chimney', 'critter.elf', 'critter.santa', 'sleigh']
  for (const r of off) assert.ok(d.rulesOff.has(r), r)
  assert.ok(d.extrasGone.has('tree.big') && d.extrasGone.has('cane'))
  assert.equal(d.blockChanged, true)
  assert.equal(d.blockOn, false)
  assert.ok(d.snowFrom > 0, 'the event brings its snow')
  assert.equal(d.snowTo, 0)
  const back = LookChange.diff(NONE, XMAS)
  assert.equal(back.rulesOff.size, 0)
  assert.equal(back.extrasGone.size, 0)
  assert.equal(back.blockChanged, true)
  assert.equal(back.blockOn, true)
  assert.equal(LookChange.diff(XMAS, XMAS).blockChanged, false)
})

test('stagger(5) all in [0, 3), not all equal', () => {
  for (const rand of [Math.random, () => 0, () => 0.999999, () => 0.5]) {
    const d = LookChange.stagger(5, rand)
    assert.equal(d.length, 5)
    assert.ok(d.every(x => x >= 0 && x < 3), String(d))
    assert.ok(new Set(d).size > 1, String(d))
  }
  assert.ok(LookChange.stagger(3, Math.random, 1).every(x => x < 1))
  assert.deepEqual(LookChange.stagger(0, Math.random), [])
})

test('crosses detects a path through a newly blocked cell', () => {
  const blocked = new Set(['9,6', '9,7'])
  assert.equal(LookChange.crosses([[8.5, 6.5], [9.5, 6.5], [10.5, 6.5]], blocked), true)
  assert.equal(LookChange.crosses([[8.5, 5.5], [9.5, 5.5], [10.5, 5.5]], blocked), false)
  assert.equal(LookChange.crosses([], blocked), false)
})

test('melt takes the cover to nothing by the deadline, a little each frame', () => {
  assert.equal(LookChange.melt(0.8, 10000, 16), 0.8 * (1 - 16 / 10000))
  assert.equal(LookChange.melt(0.8, 10, 16), 0)
  let c = 0.9
  for (let left = 10000; left > 0; left -= 50) c = LookChange.melt(c, left, 50)
  assert.equal(c, 0)
})

test('the bubble key holds the text the Look gives: coffee becoming cocoa is a new line', () => {
  const a = { id: 'a', status: 'idle', actNow: 'coffee', target: null, tool: null }
  assert.notEqual(BubbleLogic.topic({ ...a, say: 'cà phê' }), BubbleLogic.topic({ ...a, say: 'ca cao' }))
})

// A host as the page has it, paused, with the event on: critters about, a pile of presents, the big tree blocking.
function fakeHost() {
  const h = Object.create(ClaudeOffice.prototype)
  Object.assign(h, {
    state: { paused: true },
    agents: [],
    dogs: [],
    dogWorld: { frozen: true, calm: false, hour: 12 },
    env: { fx: { cloud: 0, rain: 0, snow: 0, storm: 0, fog: 0 }, reduced: false },
    moment: momentOf('on'),
    look: XMAS,
    snowShown: 0.8,
  })
  h.eventNow()
  h.stepCritters(1)
  h.stepBears(0)
  h.critterWorld.placed = 3
  h.critterWorld.landed = 2
  return h
}

test('paused + look change → critter world level/extras follow in the same call', () => {
  const h = fakeHost()
  assert.ok(h.critters.some(c => c.kind === 'santa') && h.critters.some(c => c.kind === 'reindeer'))
  assert.ok(BLOCK.has('9,6'), 'the big tree blocks its cells while the event is on')
  h.moment = momentOf('off')
  h.look = NONE
  ClaudeOffice.prototype.onLook.call(h, XMAS, NONE)
  assert.equal(h.critterWorld.look, NONE)
  assert.deepEqual(h.critters, [], 'no reindeer, elves or Santa left')
  assert.equal(h.critterWorld.placed + h.critterWorld.landed, 0, 'no pile of presents left')
  assert.equal(BLOCK.has('9,6'), false, 'the tree cells are walkable again')
  assert.ok(h.meltUntil > Date.now(), 'the event snow starts melting')
  // and back on, still paused
  h.moment = momentOf('on')
  h.look = XMAS
  ClaudeOffice.prototype.onLook.call(h, NONE, XMAS)
  assert.ok(h.critters.some(c => c.kind === 'santa'))
  assert.ok(BLOCK.has('9,6'))
  h.moment = momentOf('off')
  h.look = NONE
  ClaudeOffice.prototype.onLook.call(h, XMAS, NONE) // leave BLOCK as the other tests expect
})

test('onLook: people at the closed event spots leave spread out, a Christmas way out is chosen again', () => {
  const h = fakeHost()
  const spots = IDLE_SPOTS.map((s, i) => [s, i]).filter(([s]) => ['snowball', 'snowman', 'gift'].includes(s.act))
  assert.ok(spots.length >= 2)
  const idle = spots.map(([s, i], k) => ({
    id: 'i' + k, status: 'idle', idleSpot: i, actNow: s.act, path: [], x: s.pt[0], y: s.pt[1], leaving: false,
  }))
  const goer = {
    id: 'g', status: 'leaving', leaving: true, fate: 'sleigh', fateGoal: { tile: [5, 20], pt: [5.5, 20.5] },
    goalKey: 'fate', path: [], x: 1.5, y: 1.5,
  }
  h.agents = [...idle, goer]
  h.moment = momentOf('off')
  h.look = NONE
  ClaudeOffice.prototype.onLook.call(h, XMAS, NONE)
  for (const a of idle) assert.ok(a.linger >= 0 && a.linger < 3, String(a.linger))
  assert.ok(new Set(idle.map(a => a.linger)).size > 1, 'not all in the same frame')
  assert.ok(!['sleigh', 'wrapped', 'skateoff', 'chimney'].includes(goer.fate), goer.fate)
  assert.equal(goer.goalKey, null, 'their way is worked out again')
})

test('onLook: someone whose path runs through cells the event now blocks finds a new way', () => {
  const h = fakeHost()
  h.moment = momentOf('off')
  h.look = NONE
  ClaudeOffice.prototype.onLook.call(h, XMAS, NONE)
  const walker = { id: 'w', status: 'working', leaving: false, goalKey: 'seat', x: 8.5, y: 6.5 }
  walker.path = [[8.5, 6.5], [9.5, 6.5], [10.5, 6.5]]
  const clear = { id: 'c', status: 'working', leaving: false, goalKey: 'seat', x: 8.5, y: 5.5 }
  clear.path = [[8.5, 5.5], [9.5, 5.5]]
  h.agents = [walker, clear]
  h.moment = momentOf('on')
  h.look = XMAS
  ClaudeOffice.prototype.onLook.call(h, NONE, XMAS)
  assert.equal(walker.goalKey, null)
  assert.equal(clear.goalKey, 'seat')
  h.moment = momentOf('off')
  h.look = NONE
  ClaudeOffice.prototype.onLook.call(h, XMAS, NONE)
})
