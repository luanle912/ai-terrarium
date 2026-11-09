import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'
import { loadDogLogic } from './load-dog-logic.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null }

const { SeasonLogic } = loadWeb('season-logic')
const { IslandLakeLife: L } = loadWeb('island-lake-life')
const { IslandLand } = loadWeb('island-land')
const { IDLE_SPOTS, DOG_PLACES } = loadWeb('office-scene')
const Dog = loadDogLogic()

const island = IslandLand.buildIsland({ W: 27, H: 14 })

test('only winter freezes the lakes', () => {
  for (const k of SeasonLogic.KEYS) assert.equal(SeasonLogic.look(k).frozen, k === 'winter', k)
})

test('a frozen lake shows no ducks, fish or duckweed; thawed, they all come back', () => {
  L.reset(island)
  assert.ok(L.ducks(island, 5, 1, false, false).length >= 2)
  assert.ok(L.fish(island, 5, false).length > 0)
  assert.ok(L.weed(island, 5, false).length > 0)
  assert.deepEqual(L.ducks(island, 6, 1, false, true), [])
  assert.deepEqual(L.fish(island, 6, true), [])
  assert.deepEqual(L.weed(island, 6, true), [])
  assert.ok(L.ducks(island, 7, 1, false, false).length >= 2)
  assert.ok(L.fish(island, 7).length > 0)
})

test('on the ice nobody fishes or bathes, but the bench, the desks and the rest stay', () => {
  const all = IDLE_SPOTS.map((_, i) => i)
  const open = SeasonLogic.idleOpen(IDLE_SPOTS, all, true)
  assert.ok(IDLE_SPOTS.some(s => s.act === 'fish') && IDLE_SPOTS.some(s => s.act === 'bath'))
  assert.ok(open.every(i => IDLE_SPOTS[i].act !== 'fish' && IDLE_SPOTS[i].act !== 'bath'))
  assert.ok(open.some(i => IDLE_SPOTS[i].act === 'bench'))
  assert.equal(open.length, all.length - IDLE_SPOTS.filter(s => s.act === 'fish' || s.act === 'bath').length)
  assert.deepEqual(SeasonLogic.idleOpen(IDLE_SPOTS, all, false), all)
})

test('someone already fishing or bathing when the lake freezes has to leave', () => {
  const fishIdx = IDLE_SPOTS.findIndex(s => s.act === 'fish'),
    benchIdx = IDLE_SPOTS.findIndex(s => s.act === 'bench')
  assert.equal(SeasonLogic.idleStays(IDLE_SPOTS, fishIdx, true), false)
  assert.equal(SeasonLogic.idleStays(IDLE_SPOTS, benchIdx, true), true)
  assert.equal(SeasonLogic.idleStays(IDLE_SPOTS, fishIdx, false), true)
  assert.equal(SeasonLogic.idleStays(IDLE_SPOTS, null, true), true)
})

test('dogs never go drinking at the lakes while they are frozen, and do again after the thaw', () => {
  const w = { ...DOG_PLACES, agents: [], hour: 10, snow: 0, now: 0, rand: Math.random, frozen: true }
  assert.ok(w.drink.length > 0)
  const dogs = Dog.create(w)
  for (let i = 0; i < 30 * 300; i++) {
    w.now += 1 / 30
    Dog.step(dogs, w, 1 / 30)
    for (const d of dogs) assert.notEqual(d.act, 'drink')
  }
  w.frozen = false
  let drank = false
  for (let i = 0; i < 30 * 900 && !drank; i++) {
    w.now += 1 / 30
    Dog.step(dogs, w, 1 / 30)
    drank = dogs.some(d => d.act === 'drink')
  }
  assert.ok(drank)
})
