// The teleports' holiday is the one the page shows (web/office.js tpHoliday): the Christmas event as Settings → Event
// sets it (auto, on, off, its preview), else the holiday trees by the office (none while a season is picked by hand,
// web/moment.js); every world island shows the same.
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('en')
globalThis.React ??= { createElement: () => null, Component: class {} }
globalThis.document ??= { visibilityState: 'visible' }
globalThis.document.createElement ??= () => ({})
globalThis.location ??= { search: '', protocol: 'http:', host: 'localhost:1', origin: 'http://localhost:1' }
globalThis.window ??= { localStorage: null }
const { ClaudeOffice } = loadWeb('office')
for (const m of ['office-render', 'office-render-panels', 'office-render-header', 'office-render-settings']) loadWeb(m)
const { IslandScene } = loadWeb('island-scene')
const { TpStyles } = loadWeb('tp-styles')
const { EventLogic } = loadWeb('event-logic')

const at = (m, d) => new Date(2026, m, d, 12).getTime()
const NOV = at(10, 18),
  DEC = at(11, 20),
  HALLOWEEN = at(9, 31),
  TET = at(1, 10)
const someone = { id: 1, sid: 'sess_holiday' }

// A real page on a fixed clock.
function page(now, { event = 'auto', preview = null } = {}) {
  TpStyles.reset()
  TpStyles.setChoice('random')
  const p = new ClaudeOffice({})
  p.eventChoice = event
  p.eventPreview = preview
  return p
}

test('the page injects its own holiday: none on a plain day, Christmas from 1 December on auto', () => {
  page(NOV)
  assert.equal(TpStyles.holidayNow(NOV), null)
  assert.ok(TpStyles.RANDOM.includes(TpStyles.styleFor(someone, NOV)))
  page(DEC)
  assert.equal(TpStyles.holidayNow(DEC), 'christmas')
  assert.equal(TpStyles.styleFor(someone, DEC), 'sleigh')
})

test('Event off in December: no Christmas on the page, so no sleigh', () => {
  page(DEC, { event: 'off' })
  assert.equal(TpStyles.holidayNow(DEC), null)
  assert.ok(TpStyles.RANDOM.includes(TpStyles.styleFor(someone, DEC)))
})

test('Event on, or its preview, brings the sleigh on any date; it leaves when the preview ends', () => {
  page(NOV, { event: 'on' })
  assert.equal(TpStyles.styleFor(someone, NOV), 'sleigh')
  const p = page(NOV, { preview: EventLogic.startPreview(NOV) })
  assert.equal(TpStyles.styleFor(someone, NOV), 'sleigh')
  assert.equal(TpStyles.holidayNow(NOV + 61_000), null, 'preview over')
  p.eventChoice = 'on'
  assert.equal(TpStyles.holidayNow(NOV + 61_500), null, 'a change waits for the next second')
  assert.equal(TpStyles.holidayNow(NOV + 62_000), 'christmas')
})

test('holiday trees: Halloween and Tet follow the trees; the Christmas event wins over them', () => {
  const p = page(HALLOWEEN, { event: 'off' })
  assert.equal(TpStyles.styleFor(someone, HALLOWEEN), 'bats', 'Event is Christmas only; the trees still stand')
  p.seasonChoice = 'summer'
  p.seasonPreview = { key: 'spring', until: HALLOWEEN + 60_000 }
  assert.equal(TpStyles.holidayNow(HALLOWEEN + 1000), null, 'a season picked by hand has no holiday trees')
  page(HALLOWEEN, { event: 'on' })
  assert.equal(TpStyles.styleFor(someone, HALLOWEEN), 'sleigh')
  page(TET)
  assert.equal(TpStyles.styleFor(someone, TET), 'liondance')
})

test('every world island shows the holiday its host gives the teleports', () => {
  const cases = [
    [NOV, 'auto', null],
    [NOV, 'on', null],
    [NOV, 'auto', EventLogic.startPreview(NOV)],
    [DEC, 'auto', null],
    [DEC, 'off', null],
    [HALLOWEEN, 'off', null],
    [HALLOWEEN, 'on', null],
    [TET, 'auto', null],
  ]
  for (const [now, event, preview] of cases) {
    mock.timers.enable({ apis: ['Date'], now })
    try {
      const host = page(now, { event, preview }),
        island = new IslandScene(host, 'i1')
      host.computeMoment(new Date(now))
      const shown = TpStyles.holidayOf(island.moment.holiday || 'default', island.eventNow())
      assert.equal(TpStyles.holidayNow(now), shown, `${new Date(now).toDateString()} event ${event}`)
    } finally {
      mock.timers.reset()
    }
  }
})

test('the holiday follows the calendar, not a moment the page has not worked out yet (the world view skips draw)', () => {
  const p = page(HALLOWEEN, { event: 'off' })
  p.computeMoment(new Date(HALLOWEEN))
  assert.equal(TpStyles.holidayNow(NOV), null, 'Halloween is over by 18 November')
  assert.equal(TpStyles.holidayNow(TET), 'tet', 'Tet starts before the next computeMoment')
})
