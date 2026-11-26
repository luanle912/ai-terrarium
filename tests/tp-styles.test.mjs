// The teleport style registry (web/tp-styles.js): 36 profiles within their bounds, who gets which style (fixed per
// person, the holiday's own on a holiday, a fixed choice, or off), and the choice kept in storage and on the server.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { loadWeb } from './web.mjs'

const { TpStyles: R } = loadWeb('tp-styles')
const { PeopleLogic } = loadWeb('people-logic')
const SLACK = 1e-9
const KINDS = { S: ['none', 'air'], F: ['air'], G: ['ground', 'air'], H: ['air', 'ground'] }

test('36 styles, unique ids, a module each', () => {
  R.reset()
  assert.equal(R.STYLES.length, 36)
  const ids = R.STYLES.map(s => s.id)
  assert.equal(new Set(ids).size, 36)
  for (const id of ids) {
    assert.match(id, /^[a-z0-9]{2,16}$/)
    assert.ok(existsSync(new URL(`../web/tp-style-${id}.js`, import.meta.url)), `web/tp-style-${id}.js`)
    assert.equal(R.BY_ID[id].id, id)
  }
  assert.deepEqual(R.CHOICES, ['random', 'off', ...ids])
})

test('profiles stay within their bounds', () => {
  for (const s of R.STYLES) {
    const at = s.id
    assert.ok(KINDS[s.tier] && KINDS[s.tier].includes(s.kind), `${at}: tier ${s.tier} kind ${s.kind}`)
    assert.ok(s.dep >= 0.42 - SLACK && s.dep <= 1.2 + SLACK, `${at} dep`)
    assert.ok(s.arr >= 0.38 - SLACK && s.arr <= 1 + SLACK, `${at} arr`)
    assert.ok(s.fade >= 0.4 - SLACK && s.fade <= 1 + SLACK, `${at} fade`)
    assert.ok(s.tmin <= s.tmax && s.tmax <= 2.4 + SLACK, `${at} trip bounds`)
    assert.ok(s.dep + (s.v ? s.tmax : 0.12) + s.arr <= 4 + SLACK, `${at} longest timeline`)
    if (s.tier === 'S') assert.equal(s.v, 0, `${at}: no travel`)
    else assert.ok(s.v > 0, `${at} travels`)
    assert.equal(!!s.holiday, s.tier === 'H', `${at} holiday`)
  }
})

test('durations: the circle is DD itself, travel clamped by the profile', () => {
  assert.equal(R.durs('circle', 30), R.DD)
  assert.deepEqual(R.DD, [0.42, 0.12, 0.38, 0.43])
  assert.equal(R.durs('nope', 30), R.DD, 'an unknown id is the circle')
  assert.deepEqual(R.durs('goldaura', 40), [1.1, 0.12, 0.6, 0.8])
  const frog = R.BY_ID.frog
  assert.deepEqual(R.durs('frog', 1), [frog.dep, frog.tmin, frog.arr, frog.fade], 'short: tmin')
  assert.deepEqual(R.durs('frog', 1000), [frog.dep, frog.tmax, frog.arr, frog.fade], 'long: tmax')
  assert.ok(Math.abs(R.durs('frog', 12)[1] - 12 / frog.v) < 1e-12, 'in between: len / v')
  const run = R.BY_ID.dashrun
  assert.deepEqual(R.durs('dashrun', 1), [run.dep, run.tmin, run.arr, run.fade], 'short: tmin')
  assert.deepEqual(R.durs('dashrun', 1000), [run.dep, run.tmax, run.arr, run.fade], 'long: tmax')
})

test('holiday styles are kept out of random', () => {
  assert.equal(R.RANDOM.length, 32)
  assert.deepEqual(Object.keys(R.HOLIDAY).sort(), ['christmas', 'halloween', 'midautumn', 'tet'])
  for (const id of Object.values(R.HOLIDAY)) {
    assert.ok(!R.RANDOM.includes(id), id)
    assert.equal(R.BY_ID[id].tier, 'H')
  }
})

test('pick: fixed per person, all reachable, off, a fixed choice beats the holiday', () => {
  for (const sid of ['sess_a', 'sess_b', '17'])
    assert.equal(R.pick(sid, 'random', null), R.RANDOM[PeopleLogic.roll(sid, 'teleport', 32)])
  assert.equal(R.pick('sess_a', 'random', null), R.pick('sess_a', 'random', null))
  const seen = new Set()
  for (let k = 0; k < 2000; k++) seen.add(R.pick('sess_' + k, 'random', null))
  assert.equal(seen.size, 32, 'every non-holiday style comes up')
  assert.equal(R.pick('sess_a', 'off', 'christmas'), null)
  assert.equal(R.pick('sess_a', 'frog', null), 'frog')
  assert.equal(R.pick('sess_a', 'frog', 'christmas'), 'frog')
  assert.equal(R.pick('sess_a', 'random', 'christmas'), 'sleigh')
  assert.equal(R.pick('sess_a', 'random', 'tet'), 'liondance')
  assert.equal(R.pick('sess_a', 'random', 'teachers'), R.pick('sess_a', 'random', null), 'not a holiday')
  assert.equal(R.pick('sess_a', 'bogus', null), R.pick('sess_a', 'random', null), 'an unknown choice is random')
})

test('holidayOf: the Christmas event wins, else a holiday tree; Christmas comes only from the event', () => {
  const xmas = { key: 'christmas', level: 3 }
  assert.equal(R.holidayOf('teachers', xmas), 'christmas', 'event on or previewed on any date')
  assert.equal(R.holidayOf('halloween', xmas), 'christmas', 'the event beats a holiday tree')
  assert.equal(R.holidayOf('christmas', null), null, 'Event off in December: no Christmas on the page')
  assert.equal(R.holidayOf('christmas', xmas), 'christmas')
  for (const k of ['tet', 'midautumn', 'halloween']) assert.equal(R.holidayOf(k, null), k)
  for (const k of ['teachers', 'spring', 'default', undefined, null]) assert.equal(R.holidayOf(k, null), null, k)
})

test('styleFor reads the choice and the injected holiday; holidayNow is cached per second', () => {
  R.reset()
  let calls = 0,
    shown = null
  R.useHoliday(() => (calls++, shown))
  const t0 = new Date(2026, 10, 18, 12, 0, 0).getTime()
  assert.equal(R.holidayNow(t0), null)
  shown = 'christmas' // e.g. the Event preview button
  assert.equal(R.holidayNow(t0 + 500), null, 'same second: cached')
  assert.equal(calls, 1)
  assert.equal(R.holidayNow(t0 + 1000), 'christmas', 'the next second sees it')
  assert.equal(calls, 2)
  const a = { id: 3, sid: 'sess_x' }
  assert.equal(R.styleFor(a, t0 + 1000), 'sleigh')
  R.setChoice('frog')
  assert.equal(R.styleFor(a, t0 + 1000), 'frog')
  R.setChoice('off')
  assert.equal(R.styleFor(a, t0 + 1000), null)
  R.setChoice('random')
  shown = 'teachers'
  assert.equal(R.holidayNow(t0 + 2000), null, 'not a holiday')
  assert.equal(R.styleFor(a, t0 + 2000), R.pick('sess_x', 'random', null))
  assert.equal(R.styleFor({ id: 3 }, t0 + 2000), R.pick('3', 'random', null), 'no sid: the id')
  shown = 'tet'
  R.useHoliday(() => 'halloween')
  assert.equal(R.holidayNow(t0 + 2000), 'halloween', 'a new source drops the cache')
  R.setChoice('nonsense')
  assert.equal(R.choice(), 'random', 'an unknown choice is ignored')
  R.setChoice('off')
  R.setChoice('nonsense')
  assert.equal(R.choice(), 'off', 'an unknown choice keeps any choice')
  R.reset()
  assert.equal(R.holidayNow(t0 + 3000), null, 'no holiday source after reset')
  assert.equal(R.choice(), 'random')
})

test('calm is injected, false by default and after reset', () => {
  R.reset()
  assert.equal(R.calm(), false)
  R.useCalm(() => true)
  assert.equal(R.calm(), true)
  R.reset()
  assert.equal(R.calm(), false)
})

test('the choice in storage and from the server', () => {
  const store = v => {
    const s = { v, set: null, getItem: () => s.v, setItem: (k, x) => (s.set = [k, x]) }
    return s
  }
  assert.equal(R.KEY, 'ai-terrarium.teleport')
  assert.equal(R.loadChoice(null), 'random')
  assert.equal(R.loadChoice(store(null)), 'random')
  assert.equal(R.loadChoice(store('xx')), 'random')
  assert.equal(R.loadChoice(store('off')), 'off')
  assert.equal(R.loadChoice(store('mole')), 'mole')
  assert.equal(R.loadChoice(store('dashrun')), 'dashrun')
  assert.equal(R.loadChoice(store('zz9')), 'random', 'a style this page does not have')
  assert.equal(R.loadChoice({ getItem: () => { throw new Error('blocked') } }), 'random')
  const s = store(null)
  assert.equal(R.saveChoice(s, 'pipe'), true)
  assert.deepEqual(s.set, ['ai-terrarium.teleport', 'pipe'])
  R.saveChoice(s, 'bad')
  assert.deepEqual(s.set, ['ai-terrarium.teleport', 'random'])
  assert.equal(R.saveChoice({ setItem() { throw new Error('full') } }, 'pipe'), false)
  assert.equal(R.saveChoice(null, 'pipe'), false)
  assert.deepEqual(R.adopt('frog', 'random'), { take: 'frog', seed: false })
  assert.deepEqual(R.adopt('frog', 'frog'), { take: null, seed: false })
  assert.deepEqual(R.adopt(undefined, 'frog'), { take: null, seed: true })
  assert.deepEqual(R.adopt(undefined, 'random'), { take: null, seed: false })
  assert.deepEqual(R.adopt(undefined, 'frog', { wallpaper: true }), { take: null, seed: false })
  assert.deepEqual(R.adopt(undefined, 'frog', { seeded: true }), { take: null, seed: false })
  assert.deepEqual(R.adopt('bogus', 'frog'), { take: null, seed: true })
})
