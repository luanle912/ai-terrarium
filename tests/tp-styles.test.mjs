// The teleport style registry (web/tp-styles.js): the profiles within their bounds, who gets which style (fixed per
// person, a fixed choice, or off), and the choice kept in storage and on the server.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { loadWeb } from './web.mjs'

const { TpStyles: R } = loadWeb('tp-styles')
const { PeopleLogic } = loadWeb('people-logic')
const SLACK = 1e-9
const KINDS = { S: ['none', 'air'], G: ['ground', 'air'] }

test('14 styles, unique ids, a module each', () => {
  R.reset()
  assert.equal(R.STYLES.length, 14)
  const ids = R.STYLES.map(s => s.id)
  assert.equal(new Set(ids).size, 14)
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
  }
})

test('durations: the circle is DD itself, travel clamped by the profile', () => {
  assert.equal(R.durs('circle', 30), R.DD)
  assert.deepEqual(R.DD, [0.42, 0.12, 0.38, 0.43])
  assert.equal(R.durs('nope', 30), R.DD, 'an unknown id is the circle')
  assert.deepEqual(R.durs('goldaura', 40), [1.1, 0.12, 0.6, 0.8])
  const run = R.BY_ID.dashrun
  assert.deepEqual(R.durs('dashrun', 1), [run.dep, run.tmin, run.arr, run.fade], 'short: tmin')
  assert.deepEqual(R.durs('dashrun', 1000), [run.dep, run.tmax, run.arr, run.fade], 'long: tmax')
  assert.ok(Math.abs(R.durs('dashrun', 12)[1] - 12 / run.v) < 1e-12, 'in between: len / v')
})

test('pick: fixed per person, all reachable, off, a fixed choice', () => {
  const n = R.STYLES.length
  for (const sid of ['sess_a', 'sess_b', '17']) assert.equal(R.pick(sid, 'random'), R.RANDOM[PeopleLogic.roll(sid, 'teleport', n)])
  assert.equal(R.pick('sess_a', 'random'), R.pick('sess_a', 'random'))
  const seen = new Set()
  for (let k = 0; k < 2000; k++) seen.add(R.pick('sess_' + k, 'random'))
  assert.equal(seen.size, n, 'every style comes up')
  assert.equal(R.pick('sess_a', 'off'), null)
  assert.equal(R.pick('sess_a', 'dashrun'), 'dashrun')
  assert.equal(R.pick('sess_a', 'bogus'), R.pick('sess_a', 'random'), 'an unknown choice is random')
})

test('styleFor reads the choice', () => {
  R.reset()
  const a = { id: 3, sid: 'sess_x' }
  assert.equal(R.styleFor(a), R.pick('sess_x', 'random'))
  assert.equal(R.styleFor({ id: 3 }), R.pick('3', 'random'), 'no sid: the id')
  R.setChoice('dashrun')
  assert.equal(R.styleFor(a), 'dashrun')
  R.setChoice('off')
  assert.equal(R.styleFor(a), null)
  R.setChoice('nonsense')
  assert.equal(R.choice(), 'off', 'an unknown choice is ignored')
  R.reset()
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
  assert.equal(R.loadChoice(store('dashrun')), 'dashrun')
  assert.equal(R.loadChoice(store('caped')), 'random', 'a style this page does not have')
  assert.equal(R.loadChoice({ getItem: () => { throw new Error('blocked') } }), 'random')
  const s = store(null)
  assert.equal(R.saveChoice(s, 'pipe'), true)
  assert.deepEqual(s.set, ['ai-terrarium.teleport', 'pipe'])
  R.saveChoice(s, 'bad')
  assert.deepEqual(s.set, ['ai-terrarium.teleport', 'random'])
  assert.equal(R.saveChoice({ setItem() { throw new Error('full') } }, 'pipe'), false)
  assert.equal(R.saveChoice(null, 'pipe'), false)
  assert.deepEqual(R.adopt('dashrun', 'random'), { take: 'dashrun', seed: false })
  assert.deepEqual(R.adopt('dashrun', 'dashrun'), { take: null, seed: false })
  assert.deepEqual(R.adopt(undefined, 'dashrun'), { take: null, seed: true })
  assert.deepEqual(R.adopt(undefined, 'random'), { take: null, seed: false })
  assert.deepEqual(R.adopt(undefined, 'dashrun', { wallpaper: true }), { take: null, seed: false })
  assert.deepEqual(R.adopt(undefined, 'dashrun', { seeded: true }), { take: null, seed: false })
  assert.deepEqual(R.adopt('bogus', 'dashrun'), { take: null, seed: true })
})
