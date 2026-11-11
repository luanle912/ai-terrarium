// The Christmas critters as logic (web/event-critters.js): reindeer on the lawn, elves carrying presents, penguins on
// the ice, Santa's sleigh on Christmas Eve and Santa himself on Christmas Day.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null }
const { EventCritters: E } = loadWeb('event-critters')
const { CRITTER_PLACES: PL, DOG_PLACES: D, STAIRS } = loadWeb('office-scene')
const { CritterSprites: S } = loadWeb('critter-sprites')

const seeded = (a = 7) => () => {
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const world = over => ({ ...PL, level: 3, eve: false, day: false, frozen: true, calm: false, now: 0, rand: seeded(), dogs: [], ...over })
const cell = c => Math.floor(c.x) + ',' + Math.floor(c.y)
const of = (list, kind) => list.filter(c => c.kind === kind)
const run = (list, w, secs, each, dt = 0.1) => {
  for (let i = 0; i < secs / dt; i++) {
    E.step(list, w, dt)
    if (each) each(i)
  }
}

test('the places: a spot for the presents beside the front stairs, a way in from the edge, ice away from the shore', () => {
  const s = STAIRS.find(s => s.side === 'south'), [dx, dy] = PL.drop
  assert.ok(PL.roam.has(dx + ',' + dy) && !PL.clear.has(dx + ',' + dy))
  assert.ok(dy > s.y && Math.abs(dx - s.x) <= 4, 'in front of the office, by the stairs')
  assert.ok(dx < s.x || dx >= s.x + s.len, 'not in the way of people coming down')
  assert.ok(PL.roam.has(PL.edge.join(',')) && PL.edge[1] > dy)
  assert.ok(PL.ice.length >= 6)
  for (const [x, y] of PL.ice)
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) assert.ok(PL.water.has(x + a + ',' + (y + b)), 'a cell from the shore')
  assert.ok(PL.roam === D.roam)
})

test('who is about: nobody at level 1, reindeer from level 2, elves and penguins at level 3, Santa on the day', () => {
  const z = { reindeer: 0, elf: 0, penguin: 0, santa: 0 }
  assert.deepEqual(E.wanted(world({ level: 0 })), z)
  assert.deepEqual(E.wanted(world({ level: 1 })), z)
  assert.deepEqual(E.wanted(world({ level: 2 })), { ...z, reindeer: 3 })
  assert.deepEqual(E.wanted(world({ level: 3 })), { reindeer: 3, elf: 2, penguin: 4, santa: 0 })
  assert.deepEqual(E.wanted(world({ level: 3, day: true })), { reindeer: 3, elf: 2, penguin: 4, santa: 1 })
  assert.equal(E.wanted(world({ level: 3, frozen: false })).penguin, 0)
  assert.equal(E.wanted(world({ level: 3 })), E.wanted(world({ level: 1 })), 'one object, used again')
  assert.deepEqual(E.wanted(world({ level: 3, day: true, only: 'reindeer' })), { ...z, reindeer: 3 })
  assert.deepEqual(E.wanted(world({ level: 3, day: true, calm: true })), { reindeer: 3, elf: 0, penguin: 4, santa: 1 })
})

test('three reindeer, one with a red nose, each with a home of its own off the paths and away from the presents', () => {
  const w = world({ level: 2 }), list = E.create(w)
  assert.equal(list.length, 3)
  assert.ok(list.every(c => c.kind === 'reindeer'))
  assert.equal(list.filter(c => c.red).length, 1)
  assert.equal(new Set(list.map(c => c.home.join(','))).size, 3)
  for (const c of list) {
    const k = c.home.join(',')
    assert.ok(w.roam.has(k) && !w.clear.has(k), k)
    assert.ok(Math.max(Math.abs(c.home[0] - w.drop[0]), Math.abs(c.home[1] - w.drop[1])) > 1, 'not on the presents')
    for (const h of w.houses) assert.notEqual(k, h.door.join(','), 'not at a kennel door')
    assert.equal(cell(c), k)
  }
})

test('reindeer graze, look up and stroll, never leaving the lawn or straying far from home', () => {
  const w = world({ level: 2 }), list = E.create(w), seen = list.map(() => new Set())
  run(list, w, 600, () =>
    list.forEach((c, i) => {
      seen[i].add(c.act)
      assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y))
      assert.ok(w.roam.has(cell(c)), `${cell(c)} is off the lawn`)
      if (c.act !== 'walk') assert.ok(!w.clear.has(cell(c)), `${cell(c)}: resting on a path`)
      assert.ok(Math.hypot(c.x - 0.5 - c.home[0], c.y - 0.5 - c.home[1]) <= E.RANGE + 1)
    }),
  )
  for (const s of seen) assert.deepEqual([...s].sort(), ['graze', 'look', 'walk'])
})

test('a dog close by makes a reindeer look at it until it goes', () => {
  const w = world({ level: 2 }), list = E.create(w), c = list[0]
  w.dogs = [{ x: c.x + 1, y: c.y - 1 }]
  run(list, w, 1)
  assert.equal(c.act, 'look')
  assert.equal(c.face, 1, 'the dog is to its right on the screen')
  w.dogs = [{ x: c.x - 1, y: c.y + 1 }]
  run(list, w, 0.5)
  assert.equal(c.face, -1)
  run(list, w, 30)
  assert.equal(c.act, 'look', 'for as long as the dog stays')
  w.dogs = []
  const seen = new Set()
  run(list, w, 60, () => seen.add(c.act))
  assert.ok(seen.has('graze') && seen.has('walk'))
})

test('with reduced motion the reindeer and penguins stand still, and there are no elves and no sleigh', () => {
  const w = world({ calm: true, eve: true }), list = E.create(w), at = list.map(c => [c.x, c.y])
  assert.equal(of(list, 'elf').length, 0)
  run(list, w, 60, () => assert.equal(E.sleigh(w), null))
  assert.deepEqual(list.map(c => [c.x, c.y]), at)
  for (const c of of(list, 'reindeer')) assert.equal(E.pose(c, 12.3).frame, 'graze')
  for (const c of of(list, 'penguin')) assert.equal(E.pose(c, 12.3).frame, 'stand')
})

test('a long gap between two frames moves nobody further than a quarter of a second would', () => {
  const w = world({ eve: true }), list = E.create(w)
  run(list, w, 120)
  const at = list.map(c => [c.x, c.y]), now = w.now
  E.step(list, w, 300)
  assert.ok(w.now - now <= E.DT_MAX + 1e-9)
  list.forEach((c, i) => assert.ok(Math.hypot(c.x - at[i][0], c.y - at[i][1]) <= E.SLIDE_SPEED * E.DT_MAX + 1e-9, c.kind))
  E.step(list, w, NaN)
  E.step(list, w, -5)
  assert.ok(list.every(c => Number.isFinite(c.x) && Number.isFinite(c.y)) && Number.isFinite(w.now))
})

test('when the event ends, or the island has no room, nobody is left and nothing throws', () => {
  const w = world({}), list = E.create(w)
  assert.equal(list.length, 9)
  w.level = 0
  E.step(list, w, 0.1)
  assert.equal(list.length, 0)
  const bare = world({ roam: new Set(), roamList: [], drop: null, edge: null, ice: [], iceSet: new Set(), day: true, eve: true })
  const none = E.create(bare)
  assert.deepEqual(none, [])
  run(none, bare, 5)
  assert.deepEqual(none, [])
  assert.equal(E.elfRoute(bare), null)
})

test('a pose is one object used again, and names a frame the sprites have', () => {
  const w = world({ day: true }), list = E.create(w)
  assert.equal(E.pose(list[0], 1), E.pose(list[1], 2))
  run(list, w, 200, i => {
    if (i % 7) return
    for (const c of list) if (c.act !== 'away') assert.ok(S.frame(c.kind, E.pose(c, w.now).frame), c.kind + '/' + c.act)
  })
})

test("the elves' way: from the edge of the island to the cell beside the presents, all of it lawn", () => {
  const w = world({}), r = E.elfRoute(w)
  assert.deepEqual(r[0], w.edge)
  const end = r[r.length - 1]
  assert.notDeepEqual(end, w.drop)
  assert.equal(Math.abs(end[0] - w.drop[0]) + Math.abs(end[1] - w.drop[1]), 1)
  for (const [x, y] of r) assert.ok(w.roam.has(x + ',' + y))
  assert.equal(E.elfRoute(world({ edge: null })), null)
  assert.equal(E.wanted(world({ edge: null })).elf, 0)
  assert.equal(of(E.create(world({ level: 2 })), 'elf').length, 0)
})

test('each elf goes round: away, carrying, setting the present down, walking back; never two setting down at once', () => {
  const w = world({}), list = E.create(w), elves = of(list, 'elf'), log = elves.map(() => [])
  assert.equal(elves.length, 2)
  run(list, w, 300, () => {
    elves.forEach((c, i) => {
      if (c.act !== 'slip' && log[i][log[i].length - 1] !== c.act) log[i].push(c.act)
      if (c.act !== 'away') assert.ok(w.roam.has(cell(c)))
    })
    assert.ok(elves.filter(c => c.act === 'place').length <= 1)
    assert.ok(w.placed <= E.PLACED_MAX)
  })
  assert.equal(w.placed, E.PLACED_MAX, 'the pile by the stairs grows with each present, up to a point')
  w.level = 0
  E.step(list, w, 0.1)
  assert.equal(w.placed, 0, 'and is gone with the event')
  const order = ['away', 'carry', 'place', 'back']
  for (const l of log) {
    assert.ok(l.length >= 8, l.join(' '))
    l.forEach((a, i) => assert.equal(a, order[(order.indexOf(l[0]) + i) % 4], l.join(' ')))
  }
})

test('an elf slips at most once on the way in: always when the dice say so, never when they do not', () => {
  for (const [r, want] of [[0, 1], [0.99, 0]]) {
    const w = world({ rand: () => r }), list = E.create(w), c = of(list, 'elf')[0]
    let slips = 0, rounds = 0, was = c.act
    run(list, w, 200, () => {
      if (c.act === 'slip' && was !== 'slip') slips++
      if (c.act === 'away' && was !== 'away') rounds++
      was = c.act
    })
    assert.ok(rounds >= 2)
    assert.ok(slips >= rounds * want && slips <= (rounds + 1) * want, `${slips} slips in ${rounds} rounds`)
  }
})

test('four penguins huddle on the ice; one at a time slides off on its belly and waddles back', () => {
  const w = world({}), list = E.create(w), ps = of(list, 'penguin'), slid = new Set()
  assert.equal(ps.length, 4)
  assert.equal(new Set(ps.map(c => c.x + ',' + c.y)).size, 4)
  run(list, w, 120, () => {
    for (const c of ps) {
      assert.ok(w.iceSet.has(cell(c)), `${cell(c)} is not ice`)
      if (c.act === 'slide') slid.add(c.id)
    }
    assert.ok(ps.filter(c => c.act !== 'stand').length <= 1)
  })
  assert.equal(slid.size, 4)
  w.frozen = false
  E.step(list, w, 0.1)
  assert.equal(of(list, 'penguin').length, 0)
  assert.equal(E.huddle(PL.ice.slice(0, 3)), null)
  assert.equal(E.wanted(world({ ice: PL.ice.slice(0, 3) })).penguin, 0)
  assert.equal(E.huddle(PL.ice).length, 4)
})

test("the sleigh crosses the sky on Christmas Eve only, every few minutes, and drops a present or two", () => {
  const off = world({}), none = E.create(off)
  run(none, off, 120, () => assert.equal(E.sleigh(off), null))
  const w = world({ eve: true }), list = E.create(w)
  let flights = 0, was = null, last = -1
  run(list, w, 1800, () => {
    const s = E.sleigh(w)
    if (s) {
      assert.ok(s.u >= 0 && s.u < 1 && (s.dir === 1 || s.dir === -1))
      assert.ok(s.drops >= 0 && s.drops <= 2)
      if (was) assert.ok(s.u > last, 'moves on')
      else flights++
      last = s.u
    }
    was = s
    assert.ok(w.landed <= E.LANDED_MAX)
    assert.ok(w.parcels.length === 2)
  })
  assert.ok(flights >= 5 && flights <= 10, `${flights} flights`)
  assert.equal(w.landed, E.LANDED_MAX)
  while (E.sleigh(w)) E.step(list, w, 0.1)
  E.step(list, w, 3600)
  assert.equal(E.sleigh(w), null, 'an hour in one frame is a quarter of a second: no flight begins')
  w.eve = false
  E.step(list, w, 0.1)
  assert.equal(E.sleigh(w), null)
})

test('asked for, the sleigh sets off at once (for a screenshot)', () => {
  const w = world({ eve: true }), list = E.create(w)
  E.step(list, w, 0.1)
  assert.equal(E.sleigh(w), null)
  E.flyNow(w)
  E.step(list, w, 0.1)
  assert.ok(E.sleigh(w))
})

test('on Christmas Day Santa sits by the presents, out of the way of the elves, and waves now and then', () => {
  const w = world({ day: true }), list = E.create(w), s = of(list, 'santa')
  assert.equal(s.length, 1)
  const end = E.elfRoute(w).at(-1)
  assert.notEqual(cell(s[0]), w.drop.join(','))
  assert.notEqual(cell(s[0]), end.join(','))
  assert.ok(w.roam.has(cell(s[0])) && !w.clear.has(cell(s[0])))
  const frames = new Set()
  for (let t = 0; t < 30; t += 0.1) frames.add(E.pose(s[0], t).frame)
  assert.deepEqual([...frames].sort(), ['sit', 'wave'])
  w.day = false
  E.step(list, w, 0.1)
  assert.equal(of(list, 'santa').length, 0)
})

test('reduced motion switched on while a penguin is away brings it straight back to the huddle', () => {
  const w = world({}), list = E.create(w), ps = of(list, 'penguin')
  let away = null
  for (let i = 0; i < 400 && !away; i++) {
    E.step(list, w, 0.1)
    away = ps.find(c => c.act === 'slide')
  }
  assert.ok(away)
  run(list, w, 0.3)
  w.calm = true
  E.step(list, w, 0.1)
  assert.equal(away.act, 'stand')
  assert.deepEqual([away.x, away.y], away.home)
  w.calm = false
  const slid = new Set()
  run(list, w, 120, () => ps.forEach(c => c.act === 'slide' && slid.add(c.id)))
  assert.equal(slid.size, 4, 'and the turns go on afterwards')
})

test('the event going and coming back, or the lake thawing mid-slide, leaves everyone in order', () => {
  const w = world({ eve: true }), list = E.create(w)
  E.flyNow(w)
  run(list, w, 40)
  w.level = 0
  E.step(list, w, 0.1)
  assert.deepEqual([list.length, w.placed, w.landed, E.sleigh(w)], [0, 0, 0, null])
  w.level = 3
  E.step(list, w, 0.1)
  assert.equal(list.length, 9)
  let away = null
  for (let i = 0; i < 400 && !away; i++) {
    E.step(list, w, 0.1)
    away = of(list, 'penguin').find(c => c.act === 'slide')
  }
  w.frozen = false
  E.step(list, w, 0.1)
  w.frozen = true
  const slid = new Set()
  run(list, w, 120, () => {
    const ps = of(list, 'penguin')
    assert.equal(ps.length, 4)
    ps.forEach(c => c.act === 'slide' && slid.add(c.id))
    assert.ok(ps.filter(c => c.act !== 'stand').length <= 1)
    for (const c of list) assert.ok(Number.isFinite(c.x + c.y))
  })
  assert.equal(slid.size, 4)
})
