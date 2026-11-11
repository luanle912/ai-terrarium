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
const src = over => ({ ...PL, H: S.H, avoid: E.elfRoute({ ...PL }) || [], huddle: E.huddle(PL.ice), ...over })
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
  // people step onto the ice from the lawn right beside the rink, not across the lake
  const sk = L.spots[3]
  assert.ok(PL.roam.has(sk.tile.join(',')), 'the way on is lawn')
  assert.ok(Math.hypot(sk.pt[0] - sk.tile[0] - 0.5, sk.pt[1] - sk.tile[1] - 0.5) <= 3, 'a step or two from the rink')
  I.skateAt(L.rink, 0, out)
  assert.deepEqual(sk.pt, out, 'and they arrive where the round begins')
  for (let i = 0; i <= 10; i++) {
    const x = sk.tile[0] + 0.5 + ((sk.pt[0] - sk.tile[0] - 0.5) * i) / 10, y = sk.tile[1] + 0.5 + ((sk.pt[1] - sk.tile[1] - 0.5) * i) / 10
    const k = Math.floor(x) + ',' + Math.floor(y)
    assert.ok(PL.roam.has(k) || PL.water.has(k), `${k} on the way on is neither lawn nor lake`)
  }
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

test('the page: the event spots come last in IDLE_SPOTS, the others keep their places, and each has a label', () => {
  const n = S.IDLE_SPOTS.length
  assert.deepEqual(S.IDLE_SPOTS.slice(n - 5), S.EVENT_IDLE.spots)
  assert.ok(S.IDLE_SPOTS.slice(0, n - 5).every(s => !s.event))
  assert.equal(S.IDLE_SPOTS[n - 6].act, 'fish')
  for (const a of [...I.ACTS, 'cocoa']) assert.ok(S.ACT_TXT[a] && !S.ACT_TXT[a].startsWith('office.act.'), a)
  const ev = { key: 'christmas', level: 1 }
  assert.equal(S.actLabel('coffee', ev), S.ACT_TXT.cocoa)
  assert.equal(S.actLabel('coffee', null), S.ACT_TXT.coffee)
  assert.equal(S.actLabel('skate', ev), S.ACT_TXT.skate)
})

test('everyone can walk to every event spot from the door, round the big tree too', () => {
  const { bfs } = loadWeb('office-util')
  EventLogic.block(S.BLOCK, true)
  for (const s of S.EVENT_IDLE.spots) assert.ok(bfs(S.DOOR.tile, s.tile).length > 0, s.act)
  EventLogic.block(S.BLOCK, false)
})

test('a skater starts where they stepped on, goes round, and steps back off only when they are on the lake', () => {
  const rink = S.EVENT_IDLE.rink, sk = S.EVENT_IDLE.spots.find(s => s.act === 'skate')
  for (const id of [1, 2, 4, 13]) {
    const a = { x: sk.pt[0], y: sk.pt[1], id }
    I.skate(a, rink, 0.016)
    assert.ok(Math.hypot(a.x - sk.pt[0], a.y - sk.pt[1]) < 0.1, `person ${id} jumps on arrival`)
    I.skate(a, rink, 3)
    assert.ok(PL.iceSet.has(Math.floor(a.x) + ',' + Math.floor(a.y)))
    assert.ok(Math.hypot(a.x - sk.pt[0], a.y - sk.pt[1]) > 1)
    I.skate(a, rink, NaN)
    assert.ok(Number.isFinite(a.x + a.y))
    I.offRink(a, S.EVENT_IDLE, PL.water)
    assert.deepEqual([a.x, a.y], [sk.tile[0] + 0.5, sk.tile[1] + 0.5])
    // the next visit starts at the beginning again
    Object.assign(a, { x: sk.pt[0], y: sk.pt[1] })
    I.skate(a, rink, 0.016)
    assert.ok(Math.hypot(a.x - sk.pt[0], a.y - sk.pt[1]) < 0.1, 'no jump on a second visit')
  }
  // half way from the lawn onto the ice when the goal changes: back to the lawn, not a walk across the water
  const mid = { x: (sk.pt[0] + sk.tile[0] + 0.5) / 2, y: (sk.pt[1] + sk.tile[1] + 0.5) / 2 + 0.01 }
  if (PL.water.has(Math.floor(mid.x) + ',' + Math.floor(mid.y))) {
    I.offRink(mid, S.EVENT_IDLE, PL.water)
    assert.deepEqual([mid.x, mid.y], [sk.tile[0] + 0.5, sk.tile[1] + 0.5])
  }
  // someone on the lawn or in the office is left where they are
  for (const p of [{ x: 12.5, y: 20.5 }, { x: 5.5, y: 5.5 }]) {
    const was = [p.x, p.y]
    I.offRink(p, S.EVENT_IDLE, PL.water)
    assert.deepEqual([p.x, p.y], was)
  }
  const none = { x: 36.5, y: 27.2 }
  I.offRink(none, { spots: [] }, PL.water)
  assert.deepEqual([none.x, none.y], [36.5, 27.2])
})
