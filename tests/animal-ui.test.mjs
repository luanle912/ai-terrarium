import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadAnimalUI } from './load-animal-ui.mjs'
import { loadAnimalWalk } from './load-animal-walk.mjs'

// The pure helpers only; the page glue that uses them (reportEnv, animalKey, tapAt, loadAnimals, drawAnimal,
// animalPanelRef) is tested separately.
const U = loadAnimalUI()
const AW = loadAnimalWalk()

const SPECIES = [
  { id: 'hen', tier: 'common', cond: null }, { id: 'frog', tier: 'rare', cond: 'rain' },
  { id: 'deer', tier: 'epic', cond: null }, { id: 'dragon', tier: 'legendary', cond: null },
]
const TIERS = { common: { deadlineMs: 20 * 60e3 }, rare: { deadlineMs: 40 * 60e3 }, epic: { deadlineMs: 75 * 60e3 },
  legendary: { deadlineMs: 150 * 60e3 } }
const view = (o = {}) => ({ caught: [], out: [], speciesCaught: [], total: 0, count: 0, full: false,
  limits: { collection: 50, out: 5 }, wild: null, attempt: null, species: SPECIES, tiers: TIERS, notice: null, ...o })

// A tiny lawn: a 6x3 block of roam cells, no clear cells.
const roam = new Set(); for (let x = 30; x < 36; x++) for (let y = 2; y < 5; y++) roam.add(x + ',' + y)
const PLACES = AW.places({ W: 27, H: 14, roam, roamList: [...roam].map(k => k.split(',').map(Number)), clear: new Set(), den: [], drink: [] })
const rand = () => 0.5

test('clock formats m:ss and keeps minutes past an hour', () => {
  assert.equal(U.clock(0), '0:00')
  assert.equal(U.clock(192e3), '3:12')
  assert.equal(U.clock(30 * 60e3), '30:00')
  assert.equal(U.clock(150 * 60e3 + 999), '150:00')
  assert.equal(U.clock(-5), '0:00')
  assert.equal(U.clock(NaN), '0:00')
})

test('envWeather reports the mode weather, never a preview, as clear/rain/snow', () => {
  assert.equal(U.envWeather('storm', null), 'rain')
  assert.equal(U.envWeather('rain', null), 'rain')
  assert.equal(U.envWeather('snow', null), 'snow')
  assert.equal(U.envWeather('cloudy', null), 'clear')
  assert.equal(U.envWeather('fog', null), 'clear')
  assert.equal(U.envWeather('snow', { type: 'snow', back: 'clear' }), 'clear', 'a snow preview is not reported')
  assert.equal(U.envWeather('clear', { type: 'clear', back: 'storm' }), 'rain')
})

test('advance moves countdowns from the receive time and never past their bounds', () => {
  const wild = { id: 'abc123', species: 'hen', stayLeftMs: 5000 }
  const v1 = U.advance(view({ wild }), 2000)
  assert.equal(v1.wild.stayLeftMs, 3000)
  assert.equal(U.advance(view({ wild }), 9000).wild.stayLeftMs, 0)
  const attempt = { wildId: 'abc123', needMs: 180e3, workMs: 179e3, deadlineLeftMs: 1000, phase: 'catching', pendingLeftMs: 0, counting: true }
  const v2 = U.advance(view({ wild, attempt }), 4000)
  assert.equal(v2.attempt.workMs, 180e3, 'work stops at needMs')
  assert.equal(v2.attempt.deadlineLeftMs, 0)
  assert.equal(v2.wild.stayLeftMs, 5000, 'the stay clock stops once a catch started')
  const idle = U.advance(view({ wild, attempt: { ...attempt, workMs: 10e3, counting: false } }), 3000)
  assert.equal(idle.attempt.workMs, 10e3, 'no work counted while no session works')
  const pend = U.advance(view({ wild, attempt: { ...attempt, phase: 'pending', pendingLeftMs: 5000 } }), 2000)
  assert.equal(pend.attempt.pendingLeftMs, 3000)
  assert.equal(pend.attempt.deadlineLeftMs, 1000)
  const far = U.advance(view({ wild }), 10 * 60e3)
  assert.equal(far.wild.stayLeftMs, 0)
  const src = view({ wild, attempt })
  U.advance(src, 1000)
  assert.equal(src.attempt.workMs, 179e3, 'the input is not mutated')
  assert.equal(U.advance(null, 1000), null)
  const off = { disabled: true, error: 'x' }
  assert.equal(U.advance(off, 1000), off)
})

test('advance caps a long silence so a stalled stream does not run the clocks out', () => {
  const wild = { id: 'abc123', species: 'hen', stayLeftMs: 60e3 }
  assert.equal(U.advance(view({ wild }), 60e3).wild.stayLeftMs, 60e3 - U.MAX_GAP_MS)
})

test('expiring is true once under 10 % of the tier deadline is left', () => {
  const wild = { id: 'abc123', species: 'hen', stayLeftMs: 0 }
  const a = d => ({ wildId: 'abc123', needMs: 180e3, workMs: 0, deadlineLeftMs: d, phase: 'catching', pendingLeftMs: 0, counting: false })
  assert.equal(U.expiring(view({ wild, attempt: a(121e3) })), false)
  assert.equal(U.expiring(view({ wild, attempt: a(120e3) })), true)
  assert.equal(U.expiring(view({ wild })), false)
  assert.equal(U.expiring(view({ wild, attempt: { ...a(1), phase: 'pending' } })), false)
})

test('pickerList sorts lowest tier first, then oldest first, and tags released animals', () => {
  const v = view({
    caught: [{ id: 'a00001', species: 'dragon', at: 1 }, { id: 'a00002', species: 'hen', at: 30 },
      { id: 'a00003', species: 'hen', at: 10 }, { id: 'a00004', species: 'frog', at: 5 }, { id: 'a00005', species: 'zebra', at: 0 }],
    out: ['a00002'],
  })
  const list = U.pickerList(v)
  assert.deepEqual(list.map(c => c.id), ['a00003', 'a00002', 'a00004', 'a00001', 'a00005'])
  assert.deepEqual(list.map(c => c.out), [false, true, false, false, false])
  assert.equal(list[0].tier, 'common')
  assert.equal(v.caught[0].tier, undefined, 'records are copied')
})

test('speciesRows lists every species by tier with its animals oldest first', () => {
  const v = view({ caught: [{ id: 'a00002', species: 'hen', at: 30 }, { id: 'a00003', species: 'hen', at: 10 }],
    speciesCaught: ['hen', 'deer'] })
  const rows = U.speciesRows(v)
  assert.deepEqual(rows.map(r => r.id), ['hen', 'frog', 'deer', 'dragon'])
  assert.deepEqual(rows[0].animals.map(c => c.id), ['a00003', 'a00002'])
  assert.equal(rows[0].seen, true)
  assert.equal(rows[1].seen, false)
  assert.equal(rows[2].seen, true, 'a species once caught stays seen after every animal was freed')
  assert.equal(rows[1].cond, 'rain')
})

test('noticesFor turns events into notice kinds', () => {
  const v = view({ wild: { id: 'abc123', species: 'frog', stayLeftMs: 1 } })
  const kinds = evs => U.noticesFor(evs, v).map(n => n.kind + ':' + n.species)
  assert.deepEqual(kinds([{ type: 'spawn', wild: { id: 'abc123', species: 'frog' } }]), ['spawn:frog'])
  assert.deepEqual(kinds([{ type: 'spawn', wild: { id: 'abc123', species: 'dragon' } }]), ['legendary:dragon'])
  assert.deepEqual(kinds([{ type: 'progress', expiring: false }, { type: 'progress', expiring: true }]), ['expiring:frog'])
  assert.deepEqual(kinds([{ type: 'freed', species: 'hen' }, { type: 'caught', species: 'frog', newSpecies: true }]),
    ['freed:hen', 'caught:frog', 'newSpecies:frog'])
  assert.deepEqual(kinds([{ type: 'escaped', species: 'hen' }, { type: 'leave', species: 'hen' }, { type: 'gaveUp', species: 'hen' },
    { type: 'cancelled', species: 'hen' }, { type: 'pendingExpired', species: 'hen' }]),
  ['escaped:hen', 'left:hen', 'ranOff:hen', 'ranOff:hen', 'ranOff:hen'])
  assert.deepEqual(kinds([{ type: 'released', id: 'x', species: 'hen' }, { type: 'recalled', id: 'x', species: 'hen' }, { type: 'pending', species: 'hen' }]), [])
  assert.equal(U.noticesFor([{ type: 'catchStarted', species: 'frog', needMs: 480e3 }], v)[0].needMs, 480e3)
  assert.deepEqual(U.noticesFor(null, v), [])
})

test('wanted lists the wild animal (held while caught) and the released ones', () => {
  const v = view({ wild: { id: 'abc123', species: 'frog', stayLeftMs: 1 },
    attempt: { wildId: 'abc123', phase: 'catching' }, caught: [{ id: 'a00001', species: 'hen', at: 1 }], out: ['a00001', 'ffffff'] })
  assert.deepEqual(U.wanted(v), [
    { key: 'wild:abc123', id: 'abc123', species: 'frog', kind: 'wild', hold: true },
    { key: 'out:a00001', id: 'a00001', species: 'hen', kind: 'out', hold: false }])
  assert.deepEqual(U.wanted({ disabled: true }), [])
  assert.deepEqual(U.wanted(null), [])
})

test('reconcile adds walkers at their cell, holds the caught one, sends missing ones away, and skips blocked keys', () => {
  const known = s => s !== 'zebra'
  const v1 = view({ wild: { id: 'abc123', species: 'frog', stayLeftMs: 1 }, caught: [{ id: 'a00001', species: 'hen', at: 1 },
    { id: 'a00009', species: 'zebra', at: 1 }], out: ['a00001', 'a00009'] })
  const w1 = U.reconcile([], v1, { places: PLACES, rand, known })
  assert.deepEqual(w1.map(w => w.key), ['wild:abc123', 'out:a00001'], 'unknown species never walk')
  const cell = AW.spawnCell('abc123', PLACES)
  assert.deepEqual([w1[0].x, w1[0].y], [cell[0] + 0.5, cell[1] + 0.5])
  assert.equal(w1[0].kind, 'wild')
  const v2 = { ...v1, attempt: { wildId: 'abc123', phase: 'catching' } }
  const w2 = U.reconcile(w1, v2, { places: PLACES, rand, known })
  assert.equal(w2[0].hold, true)
  assert.equal(w1[0].hold, false, 'walkers are not mutated')
  assert.equal(w2[1], w1[1], 'an unchanged walker is kept as is')
  const v3 = { ...v1, wild: null, out: [] }
  const w3 = U.reconcile(w2, v3, { places: PLACES, rand, known })
  assert.deepEqual(w3.map(w => [w.key, w.leave, w.hold]), [['wild:abc123', true, false], ['out:a00001', true, false]])
  const v4 = { ...v1, wild: null, out: ['a00001'] }
  const w4 = U.reconcile([], v4, { places: PLACES, rand, known, blocked: new Set(['out:a00001']) })
  assert.deepEqual(w4, [])
})

test('outline marks the empty pixels around a sprite in a grid one pixel larger on every side', () => {
  const px = U.outline(['.#', '##'])
  const set = new Set(px.map(p => p.join(',')))
  assert.ok(set.has('2,0') && set.has('1,1') && set.has('0,2') && set.has('3,2') && set.has('1,3') && set.has('2,3'))
  assert.ok(!set.has('2,1') && !set.has('1,2') && !set.has('2,2'), 'body pixels are not outline')
  assert.ok(!set.has('0,0'), 'only side neighbours count')
})

test('edgeArrow is null on stage and clamps an arrow to the edge pointing at the animal', () => {
  assert.equal(U.edgeArrow(100, 100, 400, 300, 16), null)
  const a = U.edgeArrow(900, 150, 400, 300, 16)
  assert.equal(a.x, 384)
  assert.equal(a.y, 150)
  assert.ok(Math.abs(a.angle) < 0.01)
  const b = U.edgeArrow(-50, -80, 400, 300, 16)
  assert.deepEqual([b.x, b.y], [16, 16])
  assert.ok(b.angle < -Math.PI / 2)
})

test('centerOn puts a wrapper point in the middle of the stage at the current zoom', () => {
  const cam = U.centerOn({ z: 2, tx: 0, ty: 0 }, { stageW: 800, stageH: 600, ox: 10, oy: 20 }, 100, 50)
  assert.deepEqual(cam, { z: 2, tx: 800 / 2 - 10 - 200, ty: 600 / 2 - 20 - 100 })
})

const BODY = { tagName: 'BODY' }
const DOC = { body: BODY, documentElement: { tagName: 'HTML' } }

test('envVisible is false while the animals are hidden or the tab is hidden', () => {
  assert.equal(U.envVisible('visible', false), true)
  assert.equal(U.envVisible('hidden', false), false)
  assert.equal(U.envVisible('visible', true), false)
})

test('escInside accepts only the body or a target inside the panel', () => {
  const inner = {}, root = { contains: t => t === inner }
  assert.equal(U.escInside(inner, root, DOC), true)
  assert.equal(U.escInside(BODY, root, DOC), true)
  assert.equal(U.escInside(null, root, DOC), true)
  assert.equal(U.escInside({ tagName: 'INPUT' }, root, DOC), false)
  assert.equal(U.escInside({ tagName: 'INPUT' }, null, DOC), false)
})

test('preferTap picks an agent only when the tap is closer to it than to the animal', () => {
  assert.equal(U.preferTap(10, null), 'animal')
  assert.equal(U.preferTap(null, 10), 'agent')
  assert.equal(U.preferTap(null, null), null)
  assert.equal(U.preferTap(40, 5), 'agent')
  assert.equal(U.preferTap(5, 40), 'animal')
  assert.equal(U.preferTap(8, 8), 'animal', 'a tie keeps animals first (spec 5.1)')
})

test('restoreTarget returns the opener while it is on the page, else the chip', () => {
  const chip = { isConnected: true }, opener = { isConnected: true }
  assert.equal(U.restoreTarget(opener, chip), opener)
  assert.equal(U.restoreTarget({ isConnected: false }, chip), chip)
  assert.equal(U.restoreTarget(null, chip), chip)
  assert.equal(U.restoreTarget(null, null), null)
})
