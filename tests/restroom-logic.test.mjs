import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadSkyLogic } from './load-sky-logic.mjs'
import { loadSmokeLogic } from './load-smoke-logic.mjs'
import { loadRestroomLogic } from './load-restroom-logic.mjs'

const SkyLogic = loadSkyLogic()
const SmokeLogic = loadSmokeLogic()
const RestroomLogic = loadRestroomLogic()
// The page's office grid and its full wall height (WALL in the main script: 3 tiles).
const W = 27, H = 14, WALL = 56
const island = SkyLogic.buildIsland({ W, H })
const zone = island.spots.find(s => s.id === 'east-back')
const wc = RestroomLogic.layout(zone, WALL)
const smoke = SmokeLogic.layout(island.spots.find(s => s.id === 'east-front'))
const key = ([x, y]) => x + ',' + y
const pos = k => k.split(',').map(Number)
const inOffice = (x, y) => x >= 0 && y >= 0 && x < W && y < H
const walk = new Set(wc.walk)
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]

// Walk the block and the pantry beside it the way the page's bfs does: office floor is fine here (the pantry walkway
// x = 26 is free of furniture in rows 1..7), block tiles must be walkable, and every step must pass RestroomLogic.step.
const route = (from, to) => SkyLogic.cheapestPath(from, to, (c, n) => {
  const s = RestroomLogic.step(wc, c, n, inOffice)
  if (s === false) return false
  if (s === null) return inOffice(n[0], n[1]) && n[0] === 26
  return !wc.floorSet.has(key(n)) || walk.has(key(n))
}, () => 1)

// ---- where it stands ----

test('the block continues the pantry: same back-wall line, right against its east edge, on land', () => {
  assert.equal(wc.x0, W, 'its west edge is the pantry edge')
  assert.equal(wc.y0, 0, 'its back wall stands on the office back-wall line')
  assert.equal(wc.wy, 0, 'inner face of the back wall at y = 0, like the office')
  assert.ok(wc.back > 0.3, 'and as thick, behind that line')
  assert.equal(wc.x1, zone.x + zone.w)
  assert.equal(wc.y1, zone.y + zone.h)
  assert.equal(wc.floor.length, 42, '6×7 tiles')
  const decor = new Set(island.decor.map(d => d.x + ',' + d.y))
  for (const k of wc.floor) {
    assert.ok(island.cells.has(k), `floor tile ${k} is off the island`)
    assert.ok(!island.pond.cells.has(k) && !island.paths.cells.has(k) && !decor.has(k), `floor tile ${k} covers the pond, a path or decor`)
  }
})

test('the lobby opens onto the pantry; the solid room wall closes the rooms off from it', () => {
  for (let y = wc.y0; y < wc.y1; y++) {
    const open = RestroomLogic.step(wc, [W - 1, y], [W, y], inOffice)
    assert.equal(open, y >= wc.front, `row ${y}: pantry ↔ block ${open ? 'open' : 'closed'}`)
  }
})

test('nobody steps between the block floor and the lawn', () => {
  for (const k of wc.floor) {
    const [x, y] = pos(k)
    for (const [dx, dy] of N4) {
      const n = [x + dx, y + dy]
      if (wc.floorSet.has(key(n)) || inOffice(n[0], n[1])) continue
      assert.equal(RestroomLogic.step(wc, [x, y], n, inOffice), false, `${k} → ${n} steps onto the lawn`)
      assert.equal(RestroomLogic.step(wc, n, [x, y], inOffice), false, `${n} → ${k} climbs up from the lawn`)
    }
  }
  assert.equal(RestroomLogic.step(wc, [30, 9], [30, 10], inOffice), null, 'lawn steps elsewhere are left to the page')
})

test('points on the block floor are on the raised floor; the lawn around it is not', () => {
  assert.ok(RestroomLogic.onFloor(wc, 27.0, 0.0))
  assert.ok(RestroomLogic.onFloor(wc, 32.9, 6.9))
  assert.ok(!RestroomLogic.onFloor(wc, 33.1, 4))
  assert.ok(!RestroomLogic.onFloor(wc, 30, 7.1))
  assert.ok(!RestroomLogic.onFloor(wc, 30, -0.1))
})

// ---- scale ----

test('heights follow the office: full back wall, front and east walls at 70 %, room walls above a person, doors under a lintel', () => {
  const h = wc.heights
  assert.equal(h.full, WALL, 'the back wall is as tall as the office walls (3 tiles)')
  assert.ok(h.outer >= 0.65 * WALL && h.outer <= 0.75 * WALL, `front and east walls ${h.outer}: about 70 % of the full wall`)
  assert.ok(h.room > 25 && h.room <= h.outer, `room walls ${h.room}: hide a person, no taller than the outer walls`)
  assert.ok(h.stall > 25 && h.stall <= h.room, `stall panels ${h.stall} hide whoever is inside`)
  assert.ok(h.door > 25 && h.door <= h.outer - 6, `doors ${h.door} are taller than a person, with a strip of wall above them`)
  // the east wall runs the whole side of the women's room, from behind the back wall line to the front wall
  assert.ok(wc.walls.east.y0 <= wc.y0 - wc.back + 1e-9 && wc.walls.east.y1 >= wc.walls.front.y + wc.walls.front.t - 1e-9)
})

test('accents are muted versions of the brief colours: same hue family, softer and lighter', () => {
  const hsl = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn
    return { l, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, blue: b > r } }
  for (const [r, brief] of [['m', '#173DC9'], ['f', '#D9467A']]) {
    const a = hsl(wc.rooms[r].accent), o = hsl(brief)
    assert.ok(a.s < o.s - 0.2 && a.l > o.l, `${r} accent ${wc.rooms[r].accent} is not muted`)
    assert.equal(a.blue, o.blue, `${r} keeps its hue family`)
  }
})

// ---- the swing doors ----

test('one swing door in each doorway of the front wall', () => {
  assert.deepEqual(wc.doors.map((d) => [d.room, d.x0, d.x1, d.y]), [['m', ...wc.rooms.m.door, wc.front], ['f', ...wc.rooms.f.door, wc.front]])
})

test('a door is shut with nobody in its doorway, and swings away from whoever is in it', () => {
  const [m, f] = wc.doors, mid = (d) => (d.x0 + d.x1) / 2
  assert.deepEqual(RestroomLogic.doorSwing(wc, []), [0, 0])
  assert.deepEqual(RestroomLogic.doorSwing(wc, [{ x: mid(m), y: wc.front + 0.4 }]), [-1, 0], 'pushed in from the lobby')
  assert.deepEqual(RestroomLogic.doorSwing(wc, [{ x: mid(f), y: wc.front - 0.4 }]), [0, 1], 'pushed out from the room')
  assert.deepEqual(RestroomLogic.doorSwing(wc, [{ x: mid(m), y: wc.front + 1.2 }, { x: mid(f), y: wc.front - 2 }]), [0, 0], 'people further away leave the doors shut')
  assert.deepEqual(RestroomLogic.doorSwing(wc, [{ x: m.x1 + 0.2, y: wc.front }]), [0, 0], 'beside the opening, not in it')
  // the first person in the doorway decides, so the answer never flickers between frames with the same people
  const both = [{ x: mid(m), y: wc.front - 0.3 }, { x: mid(m), y: wc.front + 0.3 }]
  assert.deepEqual(RestroomLogic.doorSwing(wc, both), RestroomLogic.doorSwing(wc, both))
  assert.deepEqual(RestroomLogic.doorSwing(wc, both), [1, 0])
})

test('every route into a room passes through its doorway, so the door swings for everyone going in', () => {
  for (const s of wc.spots) {
    const d = wc.doors.find((o) => o.room === s.room), r = route([26, 5], s.tile)
    const pts = r.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }))
    assert.ok(pts.some((p) => RestroomLogic.doorSwing(wc, [p])[wc.doors.indexOf(d)] !== 0), `the way to ${s.tile} never opens the ${s.room} door`)
  }
})

test('fixtures are sized against a desk (2×1 tiles)', () => {
  for (const s of wc.stalls) {
    assert.ok(s.x1 - s.x0 >= 0.9 && s.x1 - s.x0 <= 1.0, `stall ${s.x0}..${s.x1} is ${(s.x1 - s.x0).toFixed(2)} wide`)
    assert.ok(s.y1 - s.y0 >= 1.3, 'stalls are deeper than wide')
  }
  for (const v of Object.values(wc.vanities)) {
    assert.ok(v.y1 - v.y0 >= 1.5 && v.y1 - v.y0 <= 2.2, `a double vanity is about one desk long, not ${v.y1 - v.y0}`)
    assert.ok(v.x1 - v.x0 >= 0.5 && v.x1 - v.x0 <= 1, 'and about one desk deep')
  }
  assert.ok(wc.urinals[1] - wc.urinals[0] >= 0.7, 'urinals at least ~50 cm apart')
})

// ---- the rooms ----

test('two stalls in the men\'s room, three in the women\'s, each inside its own room', () => {
  assert.equal(wc.stalls.filter(s => s.room === 'm').length, 2)
  assert.equal(wc.stalls.filter(s => s.room === 'f').length, 3)
  for (const s of wc.stalls) {
    const r = wc.rooms[s.room]
    assert.ok(s.x0 >= r.x0 && s.x1 <= r.x1 + 1e-9, `stall ${s.x0}..${s.x1} is outside room ${s.room}`)
    assert.ok(s.y0 === wc.wy && s.y1 < wc.front)
  }
})

test('one idle spot per stall, standing on a free tile in front of its door, washing at its own vanity', () => {
  assert.equal(wc.spots.length, wc.stalls.length)
  wc.spots.forEach((s, i) => {
    const st = wc.stalls[s.stall]
    assert.equal(s.act, 'wc')
    assert.equal(s.room, st.room)
    assert.equal(s.front, false, 'facing the stall')
    assert.ok(walk.has(key(s.tile)), `spot ${i} tile ${s.tile} is not walkable`)
    assert.deepEqual([Math.floor(s.pt[0]), Math.floor(s.pt[1])], s.tile, `point ${s.pt} is inside tile ${s.tile}`)
    assert.ok(s.pt[0] > st.x0 && s.pt[0] < st.x1 && s.pt[1] > st.y1, `spot ${i} stands in front of its stall`)
    assert.ok(walk.has(key(s.wash.tile)), `wash place ${s.wash.tile} is not walkable`)
    assert.deepEqual([Math.floor(s.wash.pt[0]), Math.floor(s.wash.pt[1])], s.wash.tile)
    const v = wc.vanities[s.room]
    assert.ok(s.wash.pt[0] > v.x1 && s.wash.pt[1] > v.y0 && s.wash.pt[1] < v.y1, `spot ${i} washes at its own room's vanity`)
    for (const o of wc.stalls) assert.ok(!(s.wash.pt[0] > o.x0 - 0.25 && s.wash.pt[0] < o.x1 && s.wash.pt[1] < o.y1 + 0.1), `spot ${i} washes against stall ${o.x0}`)
  })
  assert.equal(new Set(wc.spots.map(s => key(s.pt))).size, wc.spots.length)
})

test('from the pantry, every stall and vanity is reached through the lobby and the right door', () => {
  for (const s of wc.spots) {
    const door = wc.rooms[s.room].door[0]
    for (const goal of [s.tile, s.wash.tile]) {
      const r = route([26, 5], goal)
      assert.ok(r.length > 0, `no way to ${goal}`)
      const inRoom = r.filter(([, y]) => y < wc.front)
      assert.deepEqual(inRoom[0], [door, wc.front - 1], `to ${goal} the way in is the ${s.room} door, not ${inRoom[0]}`)
    }
  }
  assert.equal(RestroomLogic.step(wc, [29, 3], [30, 3], inOffice), false, 'never through the wall between the rooms')
})

test('men use WC NAM and women WC NỮ, whatever their id', () => {
  for (let id = 1; id < 20; id++) {
    assert.equal(RestroomLogic.roomOf({ id, gender: 'm' }), 'm')
    assert.equal(RestroomLogic.roomOf({ id, gender: 'f' }), 'f')
  }
  // the rooms are the layout's rooms
  assert.deepEqual(Object.keys(wc.rooms).sort(), ['f', 'm'])
})

test('an agent without a gender still always uses the same room, and both rooms get used', () => {
  const rooms = [1, 2, 3, 4, 5, 6].map(id => RestroomLogic.roomOf({ id }))
  assert.deepEqual([...new Set(rooms)].sort(), ['f', 'm'])
  for (let id = 1; id < 20; id++) {
    assert.equal(RestroomLogic.roomOf({ id }), RestroomLogic.roomOf({ id }))
    assert.equal(RestroomLogic.roomOf({ id, gender: 'x' }), RestroomLogic.roomOf(id), 'an unknown gender falls back to the id')
  }
})

// ---- how often, and how many at once ----

// A seeded generator (LCG), so the frequencies below are the same on every run.
const seeded = seed => () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32
// The idle spots as the page builds them: some pantry spots, then the restroom's stalls.
const OTHER = Array.from({ length: 20 }, (_, i) => ({ act: i % 2 ? 'coffee' : 'phone' }))
const SPOTS = [...OTHER, ...wc.spots]
const ALL = SPOTS.map((_, i) => i)
const stallsOf = room => wc.spots.filter(s => s.room === room).length

test('pickIdle: about one idle choice in four is the restroom, always a stall of the agent\'s own room', () => {
  assert.equal(RestroomLogic.SHARE, 0.25)
  for (const room of ['m', 'f']) {
    const rand = seeded(room === 'm' ? 7 : 11), N = 4000
    let n = 0
    for (let k = 0; k < N; k++) {
      const i = RestroomLogic.pickIdle(SPOTS, ALL, room, rand)
      assert.ok(i !== null)
      if (SPOTS[i].act === 'wc') { n++; assert.equal(SPOTS[i].room, room, 'never the other room') }
    }
    assert.ok(n / N > 0.2 && n / N < 0.3, `${room}: ${Math.round(n / N * 100)} % restroom`)
  }
})

test('pickIdle: with its own stalls taken, or just been, the agent picks something else', () => {
  const rand = seeded(3)
  const noM = ALL.filter(i => !(SPOTS[i].act === 'wc' && SPOTS[i].room === 'm'))
  for (let k = 0; k < 500; k++) {
    assert.notEqual(SPOTS[RestroomLogic.pickIdle(SPOTS, noM, 'm', rand)].act, 'wc', 'men\'s stalls full: no stall at all')
    assert.notEqual(SPOTS[RestroomLogic.pickIdle(SPOTS, ALL, null, rand)].act, 'wc', 'just been: no stall')
  }
  // nothing else free: the stall it is, if there is one; nothing at all: null
  const onlyStalls = ALL.filter(i => SPOTS[i].act === 'wc')
  assert.equal(SPOTS[RestroomLogic.pickIdle(SPOTS, onlyStalls, 'f', rand)].room, 'f')
  assert.equal(RestroomLogic.pickIdle(SPOTS, onlyStalls, null, rand), null)
  assert.equal(RestroomLogic.pickIdle(SPOTS, [], 'm', rand), null)
})

test('pickIdle: a dozen idle agents never put more people in a room than it has stalls', () => {
  const rand = seeded(99)
  const agents = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, gender: i % 3 ? 'm' : 'f', spot: null, left: 0 }))
  let peak = { m: 0, f: 0 }, visits = 0
  for (let tick = 0; tick < 5000; tick++) {
    for (const a of agents) {
      if (a.spot !== null && --a.left > 0) continue
      const taken = new Set(agents.filter(o => o !== a && o.spot !== null).map(o => o.spot))
      a.spot = RestroomLogic.pickIdle(SPOTS, ALL.filter(i => !taken.has(i)), RestroomLogic.roomOf(a), rand)
      a.left = 1 + Math.floor(rand() * 10)
      if (a.spot !== null && SPOTS[a.spot].act === 'wc') visits++
    }
    for (const room of ['m', 'f']) {
      const n = agents.filter(a => a.spot !== null && SPOTS[a.spot].act === 'wc' && SPOTS[a.spot].room === room).length
      peak[room] = Math.max(peak[room], n)
      assert.ok(n <= stallsOf(room), `${n} people in a ${stallsOf(room)}-stall room`)
    }
    for (const a of agents) if (a.spot !== null) assert.ok(SPOTS[a.spot].act !== 'wc' || SPOTS[a.spot].room === RestroomLogic.roomOf(a))
  }
  assert.ok(visits > 0 && peak.m >= 1 && peak.f >= 1, 'both rooms get used')
})

// ---- the smoking corner beside it ----

test('the smoking corner stands right against the block\'s east side, its screen of plants facing the block', () => {
  assert.equal(smoke.x, wc.x1, 'no gap between the block and the pad')
  assert.ok(smoke.y < wc.y1 && smoke.y + 4 > wc.y0)
  // the planted trough is the pad's west column: between the smokers and the restroom
  for (const k of smoke.blocked) assert.equal(pos(k)[0], wc.x1, `trough tile ${k} is not on the block side`)
  // its entrance is off the stepping-stone path that runs along the front of the block
  const [ex, ey] = smoke.entry[0]
  assert.ok(island.paths.cells.has(key([ex - 1, ey])), 'the path arrives at the entrance')
  for (let x = W; x < ex; x++) assert.ok(island.paths.cells.has(key([x, wc.y1])), `the path runs along the block front at ${x}`)
})

// ---- a visit ----

test('a visit: at the stall door, inside, coming out, washing hands, then done', () => {
  const { DOOR, INSIDE, OUT, WASH, VISIT } = RestroomLogic
  assert.equal(VISIT, DOOR + INSIDE + OUT + WASH)
  assert.ok(VISIT < 12, 'a visit is short')
  const at = t => RestroomLogic.visit(t)
  assert.equal(at(0), 'door')
  assert.equal(at(DOOR), 'inside')
  assert.equal(at(DOOR + INSIDE), 'out')
  assert.equal(at(DOOR + INSIDE + OUT), 'wash')
  assert.equal(at(VISIT), 'done')
})

// ---- ten minutes or so at one thing, then something else ----

test('stint: a stay at one idle spot lasts eight to twelve minutes, ten on average', () => {
  assert.equal(RestroomLogic.STINT, 600)
  assert.equal(RestroomLogic.stint(() => 0), 480)
  assert.equal(RestroomLogic.stint(() => 0.5), 600)
  assert.ok(RestroomLogic.stint(() => 0.999999) < 720)
})

test('moveOn: whoever has stayed long enough goes on to a different thing, not the same one elsewhere', () => {
  const spots = [{ act: 'coffee' }, { act: 'coffee' }, { act: 'phone' }, { act: 'fish' }]
  assert.deepEqual(RestroomLogic.moveOn(spots, [0, 1, 2, 3], 0), [2, 3], 'no other coffee spot either')
  assert.deepEqual(RestroomLogic.moveOn(spots, [0, 1], 0), [1], 'only coffee left: at least another spot')
  assert.deepEqual(RestroomLogic.moveOn(spots, [0], 0), [0], 'nowhere else to go: stays where it is')
  assert.deepEqual(RestroomLogic.moveOn(spots, [], 0), [])
})

test('moveOn: a first choice, with no spot left behind, is among all the free spots', () => {
  const spots = [{ act: 'coffee' }, { act: 'phone' }]
  assert.deepEqual(RestroomLogic.moveOn(spots, [0, 1], null), [0, 1])
  assert.deepEqual(RestroomLogic.moveOn(spots, [0, 1], undefined), [0, 1])
})
