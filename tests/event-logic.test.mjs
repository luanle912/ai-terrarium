// The Christmas event as logic (web/event-logic.js): when it is on and how far along, the choice in Settings, where
// the big tree stands and how a string of lights is laid out.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadSkyLogic } from './load-sky-logic.mjs'

const SkyLogic = loadSkyLogic()
const { EventLogic: E } = loadWeb('event-logic')
const { SeasonTree } = loadWeb('season-tree')
const W = 27, H = 14
const island = SkyLogic.buildIsland({ W, H })
const at = (y, m, d, h = 12, mi = 0, s = 0) => new Date(y, m - 1, d, h, mi, s)
const lvl = d => { const e = E.active(d, 'auto'); return e ? e.level : null }

test('the calendar: three levels through December, nothing before or after', () => {
  assert.equal(lvl(at(2026, 11, 30)), null)
  for (const [d, l] of [[1, 1], [7, 1], [8, 2], [14, 2], [15, 3], [26, 3]]) assert.equal(lvl(at(2026, 12, d)), l, `${d} Dec`)
  assert.equal(lvl(at(2026, 12, 27)), null)
  assert.equal(lvl(at(2027, 1, 1)), null)
  assert.equal(E.active(at(2026, 12, 10), 'auto').key, 'christmas')
})

test('the edges are exact to the second, in a leap year too', () => {
  for (const y of [2026, 2028]) {
    assert.equal(lvl(at(y, 11, 30, 23, 59, 59)), null)
    assert.equal(lvl(at(y, 12, 1, 0, 0, 0)), 1)
    assert.equal(lvl(at(y, 12, 26, 23, 59, 59)), 3)
    assert.equal(lvl(at(y, 12, 27, 0, 0, 0)), null)
    const eve = d => E.active(d, 'auto').eve, day = d => E.active(d, 'auto').day
    assert.equal(eve(at(y, 12, 24, 17, 59, 59)), false)
    assert.equal(eve(at(y, 12, 24, 18, 0, 0)), true)
    assert.equal(eve(at(y, 12, 25, 5, 59, 59)), true)
    assert.equal(eve(at(y, 12, 25, 6, 0, 0)), false)
    assert.equal(day(at(y, 12, 24, 23, 59, 59)), false)
    assert.equal(day(at(y, 12, 25, 0, 0, 0)), true)
    assert.equal(day(at(y, 12, 25, 23, 59, 59)), true)
    assert.equal(day(at(y, 12, 26, 0, 0, 0)), false)
  }
})

test('the choice: off hides it in December, on shows all of it in July (no eve, no day), a preview lasts a minute', () => {
  assert.equal(E.active(at(2026, 12, 20), 'off'), null)
  assert.deepEqual(E.active(at(2026, 7, 20), 'on'), { key: 'christmas', level: 3, eve: false, day: false })
  assert.equal(E.active(at(2026, 12, 3), 'on').level, 3)
  assert.equal(E.active(at(2026, 7, 20), 'auto'), null)
  assert.equal(E.active(at(2026, 7, 20), 'nonsense'), null)
  const p = E.startPreview(1000)
  assert.equal(E.active(at(2026, 7, 20), 'off', p, 1000 + 59_000).level, 3)
  assert.equal(E.active(at(2026, 7, 20), 'off', p, 1000 + 60_000), null)
})

test('the choice is kept in storage; anything else reads as auto', () => {
  const store = new Map(), storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
  assert.equal(E.loadChoice(storage), 'auto')
  for (const c of ['on', 'off', 'auto']) { assert.equal(E.saveChoice(storage, c), true); assert.equal(E.loadChoice(storage), c) }
  E.saveChoice(storage, 'party')
  assert.equal(E.loadChoice(storage), 'auto')
  assert.equal(E.loadChoice(null), 'auto')
  assert.equal(E.loadChoice({ getItem() { throw new Error('blocked') } }), 'auto')
  assert.deepEqual(E.CHOICES, ['auto', 'on', 'off'])
})

test("the bake's key: nothing without the event, one per level", () => {
  assert.equal(E.cacheKey(null), '')
  assert.deepEqual([1, 2, 3].map(level => E.cacheKey({ key: 'christmas', level })), ['x1', 'x2', 'x3'])
})

test('the big tree stands on open lawn in front of the office, clear of everything, the same every time', () => {
  const [x, y] = E.bigTreeTile(island, W, H)
  assert.deepEqual(E.bigTreeTile(SkyLogic.buildIsland({ W, H }), W, H), [x, y])
  assert.ok(y > H && x >= 0 && x < W, `(${x},${y}) is not on the lawn in front of the office`)
  const K = (a, b) => a + ',' + b
  const no = new Set([...island.paths.cells, ...island.pond.cells, ...island.mountain.cells, ...island.mountain.pool.cells])
  for (const p of [...island.pond.spots, island.rest.bench, island.rest.fish, ...island.lamps]) no.add(K(p.x, p.y))
  for (const d of island.decor) if (d.kind !== 'flower') no.add(K(d.x, d.y))
  for (const s of SkyLogic.stairs(W, H)) for (let i = 0; i < s.len; i++) for (let o = 0; o < 2; o++)
    no.add(s.side === 'east' ? K(s.x + o, s.y + i) : K(s.x + i, s.y + o))
  // its own tile and the ring round it: on the island and free; no path within a tile
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    assert.ok(island.cells.has(K(x + dx, y + dy)), `${K(x + dx, y + dy)} is off the island`)
    assert.ok(!no.has(K(x + dx, y + dy)), `${K(x + dx, y + dy)} is taken`)
  }
  for (const s of island.spots) assert.ok(!(x >= s.x - 1 && x <= s.x + s.w && y >= s.y - 1 && y <= s.y + s.h), 'in an outdoor spot')
})

test('a string of lights: bulbs a gap apart along the line, never more than the most allowed', () => {
  const line = [[0, 0], [100, 0], [100, 50]]
  const b = E.lightString(line, 10, 120)
  assert.ok(b instanceof Float32Array)
  assert.equal(b.length % 2, 0)
  const n = b.length / 2
  assert.ok(n >= 14 && n <= 16, `${n} bulbs`)
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(b[2 * i] - b[2 * i - 2], b[2 * i + 1] - b[2 * i - 1])
    assert.ok(d >= 6.9 && d <= 11.1, `gap ${d}`)
  }
  assert.ok(E.lightString(line, 2, 20).length / 2 <= 20)
  assert.equal(E.lightString([[0, 0]], 10, 5).length, 0)
  assert.equal(E.MAX_BULBS, 120)
  assert.deepEqual(E.GIFTS, [0, 2, 5, 9])
})

test('the Christmas trees by the office start with December now', () => {
  assert.notEqual(SeasonTree.seasonFor(new Date(2026, 10, 25)), 'christmas')
  assert.equal(SeasonTree.seasonFor(new Date(2026, 11, 2)), 'christmas')
})
