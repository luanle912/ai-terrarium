import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'

const { SeasonLogic } = loadWeb('season-logic')
const d = (y, m, day) => new Date(y, m - 1, day, 12)

test('seasonOf follows the month boundaries', () => {
  const cases = [[2, 28, 'winter'], [3, 1, 'spring'], [5, 31, 'spring'], [6, 1, 'summer'], [8, 31, 'summer'],
    [9, 1, 'autumn'], [11, 30, 'autumn'], [12, 1, 'winter'], [1, 15, 'winter']]
  for (const [m, day, want] of cases) assert.equal(SeasonLogic.seasonOf(d(2026, m, day)), want, `${m}/${day}`)
})

test('preview beats the choice, then expires after 60 s', () => {
  const date = d(2026, 7, 1)
  const p = SeasonLogic.startSeasonPreview('winter', 1000)
  assert.deepEqual(p, { key: 'winter', until: 61000 })
  assert.deepEqual(SeasonLogic.currentSeason({ date, choice: 'spring', preview: p, now: 60999 }),
    { key: 'winter', previewing: true })
  assert.deepEqual(SeasonLogic.currentSeason({ date, choice: 'spring', preview: p, now: 61000 }),
    { key: 'spring', previewing: false })
})

test('a choice other than auto beats the date', () => {
  const date = d(2026, 7, 1)
  assert.equal(SeasonLogic.currentSeason({ date, choice: 'autumn', preview: null, now: 0 }).key, 'autumn')
  assert.equal(SeasonLogic.currentSeason({ date, choice: 'auto', preview: null, now: 0 }).key, 'summer')
  assert.equal(SeasonLogic.currentSeason({ date, now: 0 }).key, 'summer')
})

test('look table: winter is frozen and snowy, summer is the standard', () => {
  const w = SeasonLogic.look('winter')
  assert.equal(w.frozen, true)
  assert.ok(w.minSnow >= 0.6)
  assert.equal(w.fall, 'snow')
  assert.equal(w.trees, 'bare')
  const s = SeasonLogic.look('summer')
  assert.equal(s.fall, null)
  assert.equal(s.frozen, false)
  assert.equal(s.minSnow, 0)
  assert.equal(SeasonLogic.look('autumn').fall, 'leaves')
  assert.ok(SeasonLogic.look('autumn').wind > 0)
  assert.equal(SeasonLogic.look('spring').fruit, true)
  assert.equal(SeasonLogic.look('spring').fall, 'petals')
})

test('storage that is broken or empty gives auto', () => {
  const bad = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } }
  assert.equal(SeasonLogic.loadSeasonChoice(bad), 'auto')
  assert.equal(SeasonLogic.loadSeasonChoice(null), 'auto')
  assert.equal(SeasonLogic.saveSeasonChoice(bad, 'winter'), false)
  const mem = new Map()
  const ok = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }
  assert.equal(SeasonLogic.loadSeasonChoice(ok), 'auto')
  assert.equal(SeasonLogic.saveSeasonChoice(ok, 'winter'), true)
  assert.equal(mem.get('ai-terrarium.season'), 'winter')
  assert.equal(SeasonLogic.loadSeasonChoice(ok), 'winter')
  mem.set('ai-terrarium.season', 'monsoon')
  assert.equal(SeasonLogic.loadSeasonChoice(ok), 'auto')
})

test('seasonLabel shows the season, plus the holiday when one is active', () => {
  const plain = SeasonLogic.seasonLabel('autumn', 'default')
  assert.ok(plain.length > 0)
  const holiday = SeasonLogic.seasonLabel('autumn', 'midautumn')
  assert.ok(holiday.startsWith(plain + ' · '), holiday)
  assert.equal(SeasonLogic.seasonLabel('autumn', 'autumn'), plain)
  assert.equal(SeasonLogic.seasonLabel('autumn'), plain)
})

test('the header chip names the season shown, in its own colour, or the holiday in the holiday colour', () => {
  const accents = new Set()
  for (const k of SeasonLogic.KEYS) {
    const c = SeasonLogic.seasonChip(k, 'default')
    assert.equal(c.label, SeasonLogic.seasonLabel(k))
    assert.match(c.accent, /^#[0-9a-f]{6}$/)
    accents.add(c.accent)
  }
  assert.equal(accents.size, 4, 'each season its own colour')
  // a forced or previewed winter during an autumn holiday still says winter first
  const w = SeasonLogic.seasonChip('winter', 'midautumn')
  assert.ok(w.label.startsWith(SeasonLogic.seasonLabel('winter') + ' · '), w.label)
  assert.notEqual(w.accent, SeasonLogic.seasonChip('winter').accent)
  // the plain season entries of the holiday-tree table are not holidays
  assert.deepEqual(SeasonLogic.seasonChip('spring', 'autumn'), SeasonLogic.seasonChip('spring'))
})
