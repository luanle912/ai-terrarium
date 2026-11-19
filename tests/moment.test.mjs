import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'

const { Moment } = loadWeb('moment')
const { SeasonLogic } = loadWeb('season-logic')
const { tr } = loadWeb('i18n')

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h)
const base = { seasonChoice: 'auto', eventChoice: 'auto', df: 1, snow: 0 }
const mom = (date, over = {}) => Moment.at({ ...base, date, now: date.getTime(), ...over })

test('18 Nov, auto: the teachers holiday, no event, autumn', () => {
  const m = mom(at(2026, 11, 18))
  assert.equal(m.holiday, 'teachers')
  assert.equal(m.event, null)
  assert.equal(m.season, 'autumn')
  assert.deepEqual(m.forced, { season: false, weather: false })
})

test('the event on: christmas, winter forced, no small holiday', () => {
  const m = mom(at(2026, 11, 18), { eventChoice: 'on' })
  assert.equal(m.event.key, 'christmas')
  assert.equal(m.event.since, 14)
  assert.equal(m.holiday, null)
  assert.equal(m.season, 'winter')
  assert.equal(m.forced.season, true)
  assert.equal(m.forced.weather, true)
})

test('20 Dec: event off leaves no event and no holiday; auto gives since 19', () => {
  const off = mom(at(2026, 12, 20), { eventChoice: 'off' })
  assert.equal(off.event, null)
  assert.equal(off.holiday, null)
  assert.equal(mom(at(2026, 12, 20)).event.since, 19)
})

test('a season chosen by hand has no small holiday (D2)', () => {
  assert.equal(mom(at(2026, 11, 18), { seasonChoice: 'summer' }).holiday, null)
  const prev = { key: 'spring', until: at(2026, 11, 18).getTime() + 1000 }
  assert.equal(mom(at(2026, 11, 18), { seasonPreview: prev }).holiday, null)
  assert.equal(mom(at(2026, 11, 18), { seasonPreview: prev }).season, 'spring')
})

test('the key: same within a band, new when night, snow band, event day or holiday changes', () => {
  const a = mom(at(2026, 11, 18, 10), { df: 0.9, snow: 0.31 }), b = mom(at(2026, 11, 18, 11), { df: 0.8, snow: 0.33 })
  assert.equal(a.key, b.key)
  assert.notEqual(a.key, mom(at(2026, 11, 18), { df: 0.2, snow: 0.31 }).key)
  assert.notEqual(a.key, mom(at(2026, 11, 18), { df: 0.9, snow: 0.9 }).key)
  assert.notEqual(mom(at(2026, 12, 3)).key, mom(at(2026, 12, 4)).key)
  assert.notEqual(a.key, mom(at(2026, 11, 18), { seasonChoice: 'summer', df: 0.9, snow: 0.31 }).key)
})

test('the season chip names the event; with the event off in December it does not', () => {
  assert.ok(SeasonLogic.seasonChip(mom(at(2026, 12, 20))).label.includes(tr('event.christmas')))
  assert.ok(!SeasonLogic.seasonChip(mom(at(2026, 12, 20), { eventChoice: 'off' })).label.includes(tr('event.christmas')))
  assert.ok(SeasonLogic.seasonLabel(mom(at(2026, 11, 18))).includes('·'))
})
