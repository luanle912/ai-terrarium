// The Christmas event's idle activities as logic (web/event-idle.js): where people throw snowballs, roll a snowball,
// skate and bring a present to the tree, when each is open, and what moves there.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null }
const { EventIdle: I } = loadWeb('event-idle')
const { EventCritters: E } = loadWeb('event-critters')
const { EventLogic } = loadWeb('event-logic')
const S = loadWeb('office-scene')
const PL = S.CRITTER_PLACES
const entry = [S.ISLAND.pond.spots[1].x, S.ISLAND.pond.spots[1].y]
const src = over => ({ ...PL, H: S.H, entry, avoid: E.elfRoute({ ...PL }) || [], huddle: E.huddle(PL.ice), ...over })
const L = I.layout(src())
const C = { level: 3, snow: 2, frozen: true, calm: false }

test('the layout: two snowball spots facing each other, a snowman spot, a rink on the ice, a place by the tree', () => {
  assert.deepEqual(L.spots.map(s => s.act), ['snowball', 'snowball', 'snowman', 'skate', 'gift'])
  assert.ok(L.spots.every(s => s.event === true && s.tile.length === 2 && s.pt.length === 2))
  const { a, b } = L.pitch
  assert.equal(a[1], b[1])
  assert.equal(b[0] - a[0], 4)
  for (const c of [a, b, L.spots[2].tile]) {
    assert.ok(PL.roam.has(c.join(',')) && !PL.clear.has(c.join(',')), c.join(','))
    assert.ok(c[1] >= S.H, 'on the front lawn')
    assert.ok(Math.max(Math.abs(c[0] - PL.drop[0]), Math.abs(c[1] - PL.drop[1])) > 2, 'clear of the presents')
    for (const r of E.elfRoute({ ...PL })) assert.ok(Math.max(Math.abs(c[0] - r[0]), Math.abs(c[1] - r[1])) >= 2, 'clear of the elves')
  }
  for (const c of [a, b]) assert.ok(Math.hypot(c[0] - L.spots[2].tile[0], c[1] - L.spots[2].tile[1]) >= 3)
  assert.deepEqual([L.spots[0].side, L.spots[1].side], [0, 1])
  const out = [0, 0]
  for (let i = 0; i < 16; i++) {
    I.skateAt(L.rink, (i / 16) * I.LAP, out)
    assert.ok(PL.iceSet.has(Math.floor(out[0]) + ',' + Math.floor(out[1])), 'the rink is on the ice')
    for (const h of E.huddle(PL.ice)) assert.ok(Math.hypot(out[0] - h[0], out[1] - h[1]) >= 3, 'away from the penguins')
  }
  assert.ok(L.rink.rx >= 1.5 && L.rink.rx <= 3)
  assert.deepEqual(L.spots[3].tile, entry)
  assert.ok(!EventLogic.TREE_CELLS.includes(L.spots[4].tile.join(',')))
  assert.ok(!S.BLOCK.has(L.spots[4].tile.join(',')))
})

test('an island with no ice has no rink, one with no lawn only the place by the tree', () => {
  const dry = I.layout(src({ ice: [], iceSet: new Set(), huddle: null }))
  assert.deepEqual(dry.spots.map(s => s.act), ['snowball', 'snowball', 'snowman', 'gift'])
  assert.equal(dry.rink, null)
  const bare = I.layout(src({ roam: new Set(), roamList: [], ice: [], iceSet: new Set(), drop: null, avoid: [], huddle: null }))
  assert.deepEqual(bare.spots.map(s => s.act), ['gift'])
  assert.equal(bare.pitch, null)
})

test('what is open: snow for snowballs and the snowman, ice for skating, the second week for presents', () => {
  const spots = [{ act: 'coffee' }, ...L.spots], all = spots.map((_, i) => i)
  const acts = c => I.open(spots, all, c).map(i => spots[i].act)
  assert.deepEqual(acts(C), ['coffee', 'snowball', 'snowball', 'snowman', 'skate', 'gift'])
  assert.deepEqual(acts({ ...C, level: 0 }), ['coffee'])
  assert.deepEqual(acts({ ...C, level: 1 }), ['coffee', 'snowball', 'snowball', 'snowman', 'skate'])
  assert.deepEqual(acts({ ...C, snow: 1 }), ['coffee', 'skate', 'gift'])
  assert.deepEqual(acts({ ...C, frozen: false }), ['coffee', 'snowball', 'snowball', 'snowman', 'gift'])
  assert.deepEqual(acts({ ...C, calm: true }), ['coffee', 'snowman', 'gift'])
  assert.deepEqual(I.open(spots, [0, 5], C), [0, 5], 'only what was free')
  for (const c of [C, { ...C, level: 0 }, { ...C, snow: 0 }, { ...C, frozen: false }, { ...C, calm: true }])
    for (const i of all) assert.equal(I.stays(spots, i, c), I.open(spots, [i], c).length === 1, spots[i].act)
  assert.equal(I.stays(spots, null, C), true)
  assert.deepEqual(I.ACTS, ['snowball', 'snowman', 'skate', 'gift'])
})

test('a snowball flies only when two are there: one way, then back, in an arc', () => {
  assert.equal(I.ball(0.3, false), null)
  assert.equal(I.ball(NaN, true), null)
  let last = -1, top = 0
  for (let t = 0; t < I.FLY; t += 0.05) {
    const b = I.ball(t, true)
    assert.ok(b.u > last && b.h >= 0)
    last = b.u
    top = Math.max(top, b.h)
  }
  assert.ok(top > 10 && top <= 14)
  assert.equal(I.ball(I.FLY + 0.1, true), null, 'between two throws')
  assert.ok(I.ball(I.THROW + 0.1, true).u > 0.5, 'the next one comes back')
  assert.equal(I.ball(0.1, true), I.ball(0.2, true), 'one object, used again')
  assert.deepEqual([I.thrower(0.1), I.thrower(I.THROW + 0.1)], [0, 1])
})

test('the snowball someone rolls grows for twenty seconds, then they start another', () => {
  assert.equal(I.snowmanSize(0), 2)
  assert.equal(I.snowmanSize(20), 7)
  let last = 0
  for (let t = 0; t <= 20; t += 0.5) {
    const r = I.snowmanSize(t)
    assert.ok(r >= last && r >= 2 && r <= 7)
    last = r
  }
  assert.equal(I.snowmanSize(I.GROW + 4), 2)
  assert.equal(I.snowmanSize(NaN), 2)
})

test('a skater goes round the rink, always on the ice', () => {
  const out = [0, 0]
  for (let i = 0; i < 200; i++) {
    assert.equal(I.skateAt(L.rink, i * 0.15, out), out)
    assert.ok(PL.iceSet.has(Math.floor(out[0]) + ',' + Math.floor(out[1])))
  }
})
