// How someone leaves the island (web/fate-logic.js): which ways out the weather, the season and the hour allow, and
// where each one happens.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb, readWeb } from './web.mjs'

const Fate = loadWeb('fate-logic').FateLogic
const { look } = loadWeb('season-logic').SeasonLogic
const FX = loadWeb('sky-logic').SkyLogic.FX
const cond = (weather, season, day = 1) =>
  Fate.conditions({ fx: FX[weather], look: look(season), day, summer: season === 'summer', calm: false })
const possible = c => Fate.KINDS.filter(k => Fate.weights(c)[k] > 0)
// every fate a seeded run of picks can give
const seen = (c, n = 4000) => {
  let s = 7
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647, out = new Set()
  for (let i = 0; i < n; i++) out.add(Fate.pick(c, rand))
  return out
}

test('the EXIT door is always a way out', () => {
  for (const w of Object.keys(FX)) for (const s of ['spring', 'summer', 'autumn', 'winter'])
    assert.ok(possible(cond(w, s)).includes('exit'), w + ' ' + s)
})

test('lightning needs rain, and a storm makes it the likeliest', () => {
  assert.ok(!possible(cond('clear', 'summer')).includes('lightning'))
  assert.ok(possible(cond('rain', 'summer')).includes('lightning'))
  const w = Fate.weights(cond('storm', 'summer'))
  assert.equal(Math.max(...Object.values(w)), w.lightning)
})

test('freezing needs winter or snow; nobody sinks in a frozen lake or melts in the cold', () => {
  assert.ok(!possible(cond('clear', 'summer')).includes('freeze'))
  assert.ok(possible(cond('snow', 'summer')).includes('freeze'))
  const winter = possible(cond('clear', 'winter'))
  assert.ok(winter.includes('freeze'))
  assert.ok(!winter.includes('lake'))
  assert.ok(!winter.includes('melt'))
  assert.ok(possible(cond('clear', 'summer')).includes('lake'))
})

test('the fish and the duck need open water, the snowball needs cold, the big bird a dry day', () => {
  const winter = possible(cond('clear', 'winter')), summer = possible(cond('clear', 'summer'))
  for (const k of ['fish', 'duck']) { assert.ok(!winter.includes(k), k); assert.ok(summer.includes(k), k) }
  assert.ok(winter.includes('snowball'))
  assert.ok(!summer.includes('snowball'))
  assert.ok(summer.includes('bird'))
  assert.ok(!possible(cond('rain', 'summer')).includes('bird'))
  assert.ok(!possible(cond('clear', 'summer', 0)).includes('bird'))
})

test('every fate has its own line in every language', () => {
  for (const lang of ['en', 'vi', 'ja', 'ko', 'es', 'zh', 'th']) {
    const src = readWeb('i18n/' + lang)
    for (const k of Fate.KINDS) if (k !== 'exit') assert.ok(src.includes('"bubble.fate.' + k + '":"'), lang + ' ' + k)
  }
})

test('melting is for a clear summer day; balloons fly only on a dry day', () => {
  assert.ok(possible(cond('clear', 'summer')).includes('melt'))
  assert.ok(!possible(cond('clear', 'summer', 0)).includes('melt'))
  assert.ok(!possible(cond('rain', 'summer')).includes('melt'))
  assert.ok(!possible(cond('clear', 'spring')).includes('melt'))
  assert.ok(possible(cond('clear', 'spring')).includes('balloon'))
  assert.ok(!possible(cond('rain', 'spring')).includes('balloon'))
  assert.ok(!possible(cond('clear', 'spring', 0)).includes('balloon'))
})

test('the wind takes people in a storm and in autumn', () => {
  assert.ok(possible(cond('storm', 'summer')).includes('wind'))
  assert.ok(possible(cond('clear', 'autumn')).includes('wind'))
  assert.ok(!possible(cond('clear', 'summer')).includes('wind'))
})

test('pick gives every possible fate and no impossible one', () => {
  for (const [w, s, d] of [['clear', 'summer', 1], ['storm', 'autumn', 1], ['snow', 'winter', 0], ['rain', 'spring', 0]]) {
    const c = cond(w, s, d)
    assert.deepEqual([...seen(c)].sort(), possible(c).sort(), w + ' ' + s)
  }
})

test('two people in a row never go the same way, and a forced fate wins', () => {
  const c = cond('storm', 'summer')
  let s = 3, last = null
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 500; i++) {
    const k = Fate.pick(c, rand, last)
    assert.notEqual(k, last)
    last = k
  }
  assert.equal(Fate.pick(c, rand, 'ufo', 'ufo'), 'ufo')
  assert.equal(Fate.pick(c, rand, null, 'nonsense') in Fate.FATES, true)
})

test('reduced motion leaves only the door', () => {
  const c = Fate.conditions({ fx: FX.storm, look: look('winter'), day: 0, calm: true })
  assert.deepEqual(possible(c), ['exit'])
})

test('where a fate happens', () => {
  const places = { lawn: [[30, 9], [31, 9]], lake: [[40, 20]] }
  const way = [[5, 5], [4, 5], [3, 5], [2, 5], [1, 6], [0, 7]]
  assert.equal(Fate.goal('exit', places, way, () => 0), null)
  assert.deepEqual(Fate.goal('freeze', places, way, () => 0.99), { tile: [31, 9], pt: [31.5, 9.5] })
  assert.deepEqual(Fate.goal('lake', places, way, () => 0), { tile: [40, 20], pt: [40.5, 20.5] })
  // a few steps along the way, never the door cell itself
  for (const r of [0, 0.5, 0.99]) {
    const g = Fate.goal('ghost', places, way, () => r)
    assert.ok(way.slice(0, -1).some(c => c[0] === g.tile[0] && c[1] === g.tile[1]))
  }
  assert.equal(Fate.goal('dust', places, [[0, 7]], () => 0), null)
  assert.equal(Fate.goal('freeze', { lawn: [], lake: [] }, way, () => 0), null)
})

test('every fate but the door has a scene length', () => {
  for (const k of Fate.KINDS) assert.ok(k === 'exit' || Fate.FATES[k].dur > 2, k)
})

test('the four Christmas ways out need the event; the sleigh only comes on Christmas Eve and Day', () => {
  const xmas = ['sleigh', 'wrapped', 'skateoff', 'chimney']
  const ev = { key: 'christmas', level: 3, eve: false, day: false }
  const withEv = (weather, season, e, calm = false) =>
    Fate.conditions({ fx: FX[weather], look: look(season), day: 1, summer: season === 'summer', calm, ev: e })
  for (const w of Object.keys(FX)) for (const s of ['spring', 'summer', 'autumn', 'winter'])
    for (const k of xmas) assert.equal(Fate.weights(cond(w, s))[k], 0, `${k} in ${w} ${s} without the event`)
  const on = Fate.weights(withEv('snow', 'winter', ev))
  assert.equal(on.sleigh, 0)
  assert.ok(on.wrapped > 0 && on.chimney > 0 && on.skateoff > 0)
  assert.equal(Fate.weights(withEv('clear', 'summer', ev)).skateoff, 0, 'no ice, no skating off')
  assert.equal(Fate.weights(withEv('snow', 'winter', { ...ev, eve: true })).sleigh, 10)
  assert.equal(Fate.weights(withEv('snow', 'winter', { ...ev, day: true })).sleigh, 10)
  const calm = Fate.weights(withEv('snow', 'winter', { ...ev, eve: true }, true))
  assert.deepEqual(Fate.KINDS.filter(k => calm[k] > 0), ['exit'])
  for (const k of xmas) assert.equal(Fate.pick(cond('clear', 'summer'), () => 0.5, null, k), k)
  const places = { lawn: [[3, 20]], lake: [[32, 17], [32, 18]] }
  assert.ok(places.lake.some(c => c.join() === Fate.goal('skateoff', places, [], () => 0.3).tile.join()))
  assert.deepEqual(Fate.goal('sleigh', places, [], () => 0).tile, [3, 20])
  assert.equal(Fate.KINDS.length, 21)
  assert.ok(seen(withEv('snow', 'winter', { ...ev, eve: true })).has('sleigh'))
})
