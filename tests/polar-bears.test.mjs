// The polar bears as logic (web/polar-bears.js): a mother and her cub living round an igloo on the back lawn, beside
// the mountain, in winter; the ground round them is kept clear of everyone else.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null }
const { PolarBears: B } = loadWeb('polar-bears')
const S = loadWeb('office-scene')
const L = S.BEARS
const seeded = seed => () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32
const key = (x, y) => x + ',' + y
const cell = b => key(Math.floor(b.x), Math.floor(b.y))
const world = over => ({ winter: true, night: false, calm: false, now: 0, rand: seeded(7), ...over })

test('the layout: an igloo of 2 × 2 cells by the mountain, a patch of lawn round it, a wider ring kept clear', () => {
  assert.deepEqual([L.igloo.x, L.igloo.y], [12, -8])
  assert.equal(L.cells.size, 4)
  assert.ok(L.zone.length >= 16, 'room to walk about')
  for (const [x, y] of L.zone) {
    assert.ok(S.LAWN_WALK_ALL.has(key(x, y)), `${x},${y} is open lawn`)
    assert.ok(!L.cells.has(key(x, y)), 'never into the igloo')
    assert.ok(L.keep.has(key(x, y)), 'the bears are inside the ring kept clear')
  }
  assert.ok(L.zoneSet.has(key(...L.door)), 'the door opens onto their lawn')
  for (const k of L.cells) assert.ok(L.keep.has(k))
  // the ring reaches past the bears' own lawn on every side
  const far = [...L.keep].map(k => k.split(',').map(Number)).filter(([x, y]) => !L.zoneSet.has(key(x, y)) && !L.cells.has(key(x, y)))
  assert.ok(far.length >= 20)
})

test('nobody else goes near: people, dogs and the Christmas critters are kept out of the ring', () => {
  for (const k of L.keep) {
    assert.ok(!S.LAWN_WALK.has(k), `people: ${k}`)
    assert.ok(!S.DOG_ROAM_WINTER.has(k), `dogs in winter: ${k}`)
    assert.ok(!S.CRITTER_PLACES.roam.has(k), `critters: ${k}`)
  }
  assert.ok(S.DOG_PLACES_WINTER.roamList.every(([x, y]) => !L.keep.has(key(x, y))))
  assert.ok(S.CRITTER_PLACES.roamList.every(([x, y]) => !L.keep.has(key(x, y))))
  // out of winter the dogs have their lawn back
  assert.ok([...L.keep].some(k => S.DOG_ROAM.has(k)))
  // and the den, the drinking spots and the bench company are all outside it
  const xy = d => (Array.isArray(d) ? d : [d.x, d.y])
  for (const [x, y] of [...S.DOG_PLACES.den, ...S.DOG_PLACES.drink, S.DOG_PLACES.rest].filter(Boolean).map(xy))
    assert.ok(!L.keep.has(key(x, y)), `${x},${y}`)
})

test('two bears in winter, a mother and her cub, and none outside it', () => {
  const list = B.create(L)
  assert.deepEqual(list.map(b => b.kind), ['bear', 'cub'])
  assert.ok(list.every(b => L.zoneSet.has(cell(b))))
  const w = world({ winter: false })
  B.step(list, L, w, 0.1)
  assert.ok(list.every(b => b.away), 'gone with the winter')
  w.winter = true
  B.step(list, L, w, 0.1)
  assert.ok(list.every(b => !b.away), 'back with it')
})

test('they wander about their lawn, the cub keeping near its mother, never leaving it or walking into the igloo', () => {
  const list = B.create(L), w = world(), seen = new Set()
  let far = 0
  for (let i = 0; i < 6000; i++) {
    B.step(list, L, w, 0.1)
    for (const b of list) {
      assert.ok(L.zoneSet.has(cell(b)), `${b.kind} at ${b.x.toFixed(2)},${b.y.toFixed(2)}`)
      assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y))
    }
    seen.add(cell(list[0]))
    if (Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y) > 3) far++
  }
  assert.ok(seen.size >= 8, 'the mother gets about: ' + seen.size)
  assert.ok(far < 300, 'the cub keeps up: ' + far)
  assert.ok(w.now > 599)
})

test('at night they lie down by the igloo door; with reduced motion they stand where they are', () => {
  const list = B.create(L), w = world({ night: true })
  for (let i = 0; i < 1500; i++) B.step(list, L, w, 0.1)
  assert.deepEqual([Math.floor(list[1].x), Math.floor(list[1].y)], L.beside, 'the cub beside her, in view')
  assert.ok(L.zoneSet.has(L.beside.join(',')))
  for (const b of list) {
    assert.equal(b.act, 'lie')
    assert.ok(Math.hypot(b.x - L.door[0] - 0.5, b.y - L.door[1] - 0.5) < 2.2, `${b.kind} near the door`)
  }
  const calm = B.create(L), at = calm.map(b => [b.x, b.y]), wc = world({ calm: true })
  for (let i = 0; i < 300; i++) B.step(calm, L, wc, 0.1)
  assert.deepEqual(calm.map(b => [b.x, b.y]), at)
})

test('a long frame is cut short, and the pose names a frame each sprite has', () => {
  const list = B.create(L), w = world()
  B.step(list, L, w, 30)
  assert.ok(w.now <= B.DT_MAX + 1e-9)
  const { CritterSprites } = loadWeb('critter-sprites')
  for (let i = 0; i < 3000; i++) {
    B.step(list, L, w, 0.1)
    for (const b of list) {
      const p = B.pose(b, w.now)
      assert.ok(CritterSprites.frame(b.kind, p.frame), `${b.kind}/${p.frame}`)
      assert.equal(typeof p.flip, 'boolean')
    }
  }
})
