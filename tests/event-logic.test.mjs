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
const on = d => E.active(d, 'auto') !== null
const since = d => { const e = E.active(d, 'auto'); return e ? e.since : null }

test('the calendar: the whole event from 1 to 26 Dec (D1: no levels), with days since 1 Dec', () => {
  assert.equal(on(at(2026, 11, 30)), false)
  for (const d of [1, 7, 8, 14, 15, 26])
    assert.deepEqual(E.active(at(2026, 12, d), 'auto'), { key: 'christmas', since: d - 1 }, `${d} Dec`)
  assert.equal(on(at(2026, 12, 27)), false)
  assert.equal(on(at(2027, 1, 1)), false)
  assert.equal(E.active(at(2026, 12, 10), 'auto').key, 'christmas')
})

test('the edges are exact to the second, in a leap year too', () => {
  for (const y of [2026, 2028]) {
    assert.equal(on(at(y, 11, 30, 23, 59, 59)), false)
    assert.equal(on(at(y, 12, 1, 0, 0, 0)), true)
    assert.equal(since(at(y, 12, 1, 0, 0, 0)), 0)
    assert.equal(on(at(y, 12, 26, 23, 59, 59)), true)
    assert.equal(on(at(y, 12, 27, 0, 0, 0)), false)
  }
})

test('the choice: off hides it in December, on shows all of it in July (Santa and the sleigh too), a preview lasts a minute', () => {
  assert.equal(E.active(at(2026, 12, 20), 'off'), null)
  assert.deepEqual(E.active(at(2026, 7, 20), 'on'), { key: 'christmas', since: 14 })
  assert.deepEqual(E.active(at(2026, 12, 3), 'on'), { key: 'christmas', since: 14 })
  assert.equal(E.active(at(2026, 7, 20), 'auto'), null)
  assert.equal(E.active(at(2026, 7, 20), 'nonsense'), null)
  const p = E.startPreview(1000)
  assert.deepEqual(E.active(at(2026, 7, 20), 'off', p, 1000 + 59_000), { key: 'christmas', since: 14 })
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

test('the event is only its key and its days since 1 Dec: no levels, no bake key of its own (the look keys it)', () => {
  assert.deepEqual(Object.keys(E.active(at(2026, 12, 20), 'auto')), ['key', 'since'])
  assert.equal(E.cacheKey, undefined)
})

test('the big tree stands indoors, in the middle of the crossing of the two corridors, and people walk round it', () => {
  globalThis.React ??= { createElement: () => null } // office-scene.js only needs React for h()
  const { ZONES, BLOCK, DESKS } = loadWeb('office-scene')
  const [x, y] = E.TREE_AT
  // the corridors: between the left and the right desk zones, and between the back and the front ones
  const x0 = Math.max(...ZONES.filter(z => z.zx === 0).map(z => z.zx + 8)), x1 = Math.max(...ZONES.map(z => z.zx))
  const y0 = 6, y1 = Math.max(...ZONES.map(z => z.zy))
  assert.equal(x1 - x0, 3, 'the corridor between the desk zones is three tiles wide')
  assert.deepEqual([x, y], [(x0 + x1) / 2, (y0 + y1) / 2], 'the middle of the crossing')
  assert.deepEqual(E.TREE_CELLS, ['9,6', '9,7'])
  // a free tile on each side of the tree, so both corridors stay open round it
  for (const k of ['8,6', '8,7', '10,6', '10,7', '9,5', '9,8']) assert.ok(!BLOCK.has(k) && !E.TREE_CELLS.includes(k), k)
  for (const d of DESKS) assert.ok(d.gx + 1 < x0 || d.gx >= x1, 'no desk in the corridor')
  const set = new Set(['1,1'])
  E.block(set, true)
  assert.deepEqual([...set].sort(), ['1,1', '9,6', '9,7'])
  E.block(set, true)
  assert.equal(set.size, 3)
  E.block(set, false)
  assert.deepEqual([...set], ['1,1'], 'free again when the event ends')
})

test('while the event is on the season is winter, whatever the date or the choice in Settings', () => {
  const ev = { key: 'christmas', since: 14 }
  for (const k of ['spring', 'summer', 'autumn', 'winter']) {
    assert.equal(E.season(ev, k), 'winter')
    assert.equal(E.season(null, k), k)
  }
})

test('while the event is on it snows: rain and storm turn to snow, and it never stops', () => {
  const ev = { key: 'christmas', since: 0 }
  const clear = { cloud: 0.2, rain: 0, snow: 0, storm: 0, fog: 0 }
  assert.equal(E.weather(clear, ev), clear, 'the same object, changed in place')
  assert.equal(clear.snow, E.SNOWFALL)
  assert.ok(E.SNOWFALL >= 0.3 && E.SNOWFALL <= 0.6, 'a light fall')
  const storm = E.weather({ cloud: 1, rain: 1, snow: 0, storm: 1, fog: 0 }, ev)
  assert.deepEqual([storm.rain, storm.storm, storm.snow], [0, 0, 1])
  const heavy = E.weather({ cloud: 0.7, rain: 0, snow: 1, storm: 0, fog: 0 }, ev)
  assert.equal(heavy.snow, 1)
  assert.equal(E.weather({ cloud: 0.5, rain: 0, snow: 0, storm: 0, fog: 1 }, ev).fog, 1, 'fog stays')
  const off = { cloud: 1, rain: 1, snow: 0, storm: 1, fog: 0 }
  assert.deepEqual(E.weather({ ...off }, null), off, 'no event: untouched')
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
  assert.equal(E.GIFTS, undefined, 'the gifts under the tree are the Christmas pack\'s build (Look.build)')
})

test('the Christmas trees by the office start with December now', () => {
  assert.notEqual(SeasonTree.seasonFor(new Date(2026, 10, 25)), 'christmas')
  assert.equal(SeasonTree.seasonFor(new Date(2026, 11, 2)), 'christmas')
})

test('bulbs lie on the line, through a doubled point too, and none are made for a most of zero', () => {
  const b = E.lightString([[0, 0], [0, 0], [60, 0], [60, 0], [60, 40]], 10, 50)
  assert.ok(b.length >= 16)
  for (let i = 0; i < b.length; i += 2) {
    assert.ok(Number.isFinite(b[i]) && Number.isFinite(b[i + 1]))
    const onA = Math.abs(b[i + 1]) < 1e-3 && b[i] >= 0 && b[i] <= 60, onB = Math.abs(b[i] - 60) < 1e-3 && b[i + 1] >= 0 && b[i + 1] <= 40
    assert.ok(onA || onB, `bulb ${i / 2} at ${b[i]},${b[i + 1]} is off the line`)
  }
  assert.equal(E.lightString([[0, 0], [100, 0]], 10, 0).length, 0)
})

test('older server value never overrides a newer local choice', () => {
  const A = E.adopt, w = { mode: 'off', city: '' }
  assert.deepEqual(A({ server: { weather: w, event: 'off', updatedAt: 100 }, local: 'on', localAt: 200 }),
    { take: null, push: true, newer: false }, 'this page chose later: it keeps its own and gives it to the server')
  assert.deepEqual(A({ server: { weather: w, event: 'off', updatedAt: 300 }, local: 'on', localAt: 200 }),
    { take: 'off', push: false, newer: true }, 'another page chose later: this one follows')
  assert.deepEqual(A({ server: { weather: w, event: 'on', updatedAt: 300 }, local: 'on', localAt: 200 }),
    { take: null, push: false, newer: true }, 'newer but the same choice: nothing to take, the weather may still be')
  assert.deepEqual(A({ server: { weather: w, event: 'on', updatedAt: 200 }, local: 'on', localAt: 200 }),
    { take: null, push: false, newer: false }, 'our own value echoed back')
})

test('adopt: an unstamped value (older tab) is oldest; a server with none gets ours; never the wallpaper', () => {
  const A = E.adopt, w = { mode: 'off', city: '' }
  assert.deepEqual(A({ server: { weather: w, event: 'off' }, local: 'on', localAt: 200 }),
    { take: null, push: true, newer: false })
  assert.deepEqual(A({ server: { weather: w, event: 'off' }, local: 'on', localAt: 0 }),
    { take: 'off', push: false, newer: true }, 'neither was ever stamped: the server wins, as before')
  assert.deepEqual(A({ server: null, local: 'auto', localAt: 0 }), { take: null, push: true, newer: false },
    'a server with nothing yet gets this page\'s own')
  assert.deepEqual(A({ server: null, local: 'on', localAt: 9, wallpaper: true }),
    { take: null, push: false, newer: false })
  assert.deepEqual(A({ server: { weather: w, event: 'party', updatedAt: 300 }, local: 'on', localAt: 0 }),
    { take: null, push: false, newer: true }, 'a strange event value is never taken')
})

test('a running preview tells its time left as m:ss, rounded up; none, or one run out, says nothing', () => {
  const p = E.startPreview(1000)
  assert.equal(E.previewClock(p, 1000), '1:00')
  assert.equal(E.previewClock(p, 1000 + 18_000), '0:42')
  assert.equal(E.previewClock(p, 1000 + 18_500), '0:42', 'rounded up: 41.5 s left still reads 0:42')
  assert.equal(E.previewClock(p, 1000 + 59_999), '0:01')
  assert.equal(E.previewClock(p, 1000 + 60_000), '')
  assert.equal(E.previewClock(null, 0), '')
})
