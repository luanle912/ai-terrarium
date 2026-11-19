import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'

const { Theme } = loadWeb('theme')

// Task 2 builds moments; until then a test writes them by hand.
const moment = (season, { event = null, holiday = null } = {}) =>
  ({ season, holiday, event, key: [season, event ? event.key + '@' + event.since : '-', holiday || '-'].join('|') })
const xmas = (since = 0, season = 'winter', holiday = null) =>
  moment(season, { event: { key: 'christmas', since }, holiday })

test('resolve: summer, no event', () => {
  const look = Theme.resolve(moment('summer'))
  assert.equal(look.of('tree.island'), 'green')
  assert.deepEqual(look.decor('door'), [])
})

test('resolve: winter, no event', () => {
  const look = Theme.resolve(moment('winter'))
  assert.equal(look.of('tree.island'), 'bare')
  assert.ok(look.extras.has('igloo'))
  assert.ok(look.extras.has('bear'))
  assert.equal(look.has('idle.snowball'), false)
})

test('resolve: christmas', () => {
  const look = Theme.resolve(xmas())
  assert.equal(look.of('tree.island'), 'fir')
  assert.equal(look.of('tree.holiday'), 'xmas')
  assert.equal(look.of('bush'), 'holly')
  assert.equal(look.of('floor.corridor'), 'runner')
  assert.ok(look.decor('door').includes('wreath'))
  assert.deepEqual(look.decor('wall.outer'), ['garland', 'lights'])
  assert.deepEqual(look.decor('desk'), ['xmas-desk'])
  assert.equal(look.has('critter.reindeer'), true)
  assert.equal(look.has('critter.elf'), true)
  assert.equal(look.text('office.act.coffee'), 'office.act.cocoa')
})

test('resolve: christmas build.gifts by event.since', () => {
  for (const [since, want] of [[0, 2], [7, 5], [14, 9], [25, 9]]) {
    assert.equal(Theme.resolve(xmas(since)).build('gifts'), want, `day ${since}`)
  }
})

test('resolve: a small holiday swaps tree.holiday; a big event wins over it', () => {
  assert.equal(Theme.resolve(moment('autumn', { holiday: 'teachers' })).of('tree.holiday'), 'teachers')
  assert.equal(Theme.resolve(xmas(0, 'autumn', 'teachers')).of('tree.holiday'), 'xmas')
})

test('resolve: same moment.key twice gives the very same Look object', () => {
  const a = Theme.resolve(moment('spring')), b = Theme.resolve(moment('spring'))
  assert.equal(a, b)
  assert.ok(Object.isFrozen(a))
})

test('resolve: of() on an unknown label throws', () => {
  assert.throws(() => Theme.resolve(moment('summer')).of('tree.islnad'), /tree\.islnad/)
})

test('look.key differs between summer/winter/christmas and is stable across calls', () => {
  const keys = [moment('summer'), moment('winter'), xmas()].map(m => Theme.resolve(m).key)
  assert.equal(new Set(keys).size, 3)
  assert.equal(Theme.resolve({ ...moment('winter'), key: 'another' }).key, keys[1])
})
