// The /assets page's pure logic (web/assets-logic.js): filtering and search, how many variants an item has, the grid
// of "all variants" in the detail drawer, which global controls reach an item, and the deep link in the URL hash.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

const { AssetsLogic: L } = loadWeb('assets-logic')

const entry = (id, more = {}) => ({
  id,
  cat: id.split('.')[0],
  name: () => more.title || id,
  tags: [],
  axes: [],
  uses: [],
  when: { always: true },
  where: 'office',
  source: [{ file: 'web/x.js', fn: 'drawX' }],
  draw() {},
  ...more,
})
const AXIS = (id, ...vals) => ({ id, label: () => id, values: vals.map(v => ({ id: v, label: () => v })) })
const ENTRIES = [
  entry('office.desk', { title: 'Bàn làm việc', axes: [AXIS('screen', 'code', 'read', 'off')], tags: ['animated'] }),
  entry('office.window', { title: 'Cửa sổ', uses: ['light'], tags: ['animated'] }),
  entry('pantry.microwave', { title: 'Lò vi sóng', axes: [AXIS('use', 'idle', 'use')], tags: ['animated', 'state'] }),
  entry('pantry.sofa', { title: 'Sofa' }),
  entry('plants.tree', { title: 'Cây đảo', uses: ['season', 'snow', 'light'], tags: ['season'] }),
]
const ids = list => list.map(e => e.id)

test('filter narrows by category, by every word of the search and by all the chosen tags', () => {
  assert.deepEqual(ids(L.filter(ENTRIES, {})), ids(ENTRIES))
  assert.deepEqual(ids(L.filter(ENTRIES, { cat: 'all' })), ids(ENTRIES))
  assert.deepEqual(ids(L.filter(ENTRIES, { cat: 'pantry' })), ['pantry.microwave', 'pantry.sofa'])
  assert.deepEqual(ids(L.filter(ENTRIES, { q: 'lo vi' })), ['pantry.microwave'], 'accents do not matter')
  assert.deepEqual(ids(L.filter(ENTRIES, { q: '  SOFA ' })), ['pantry.sofa'], 'case and spaces do not matter')
  assert.deepEqual(ids(L.filter(ENTRIES, { q: 'desk' })), ['office.desk'], 'the id matches too')
  assert.deepEqual(ids(L.filter(ENTRIES, { q: 'drawx' })), ids(ENTRIES), 'and the drawing function')
  assert.deepEqual(ids(L.filter(ENTRIES, { q: 'cua so' })), ['office.window'])
  assert.deepEqual(ids(L.filter(ENTRIES, { q: 'pantry lo' })), ['pantry.microwave'], 'every word must match')
  assert.deepEqual(ids(L.filter(ENTRIES, { tags: ['animated'] })), ['office.desk', 'office.window', 'pantry.microwave'])
  assert.deepEqual(ids(L.filter(ENTRIES, { tags: ['animated', 'state'] })), ['pantry.microwave'])
  assert.deepEqual(ids(L.filter(ENTRIES, { cat: 'office', q: 'nothing like it' })), [])
  assert.deepEqual(ids(L.filter(ENTRIES, { q: 'microwave' }, e => (e.id === 'pantry.microwave' ? 'Microwave' : ''))),
    ['pantry.microwave'], 'extra text (names in other languages) is searched too')
})

test('counts per category, plus all', () => {
  assert.deepEqual(L.counts(ENTRIES), { all: 5, office: 2, pantry: 2, plants: 1 })
})

test('variantCount multiplies the item axes by the scene controls it uses', () => {
  assert.equal(L.variantCount(ENTRIES[0]), 3)
  assert.equal(L.variantCount(ENTRIES[1]), 2, 'day and night')
  assert.equal(L.variantCount(ENTRIES[3]), 1)
  assert.equal(L.variantCount(ENTRIES[4]), 4 * 2 * 2)
  assert.equal(L.variantCount(entry('event.x', { uses: ['event'], axes: [AXIS('a', 'x', 'y')] })), 2 * 3,
    'none, winter and Christmas (the small holidays have entries of their own)')
})

test('sceneOf keeps only the controls an item uses; the rest stay at their defaults', () => {
  const c = { ...L.DEFAULTS, light: 'night', season: 'winter', snow: true, event: 'christmas' }
  assert.deepEqual(L.sceneOf(ENTRIES[3], c), { light: 'day', season: 'summer', snow: false, event: 'none' })
  assert.deepEqual(L.sceneOf(ENTRIES[1], c), { light: 'night', season: 'summer', snow: false, event: 'none' })
  assert.deepEqual(L.sceneOf(ENTRIES[4], c), { light: 'night', season: 'winter', snow: true, event: 'none' })
})

test('combos lists every variant worth a cell, at most 48, the item axes first', () => {
  const c = L.combos(ENTRIES[0], L.DEFAULTS)
  assert.deepEqual(c.map(x => x.pick.screen), ['code', 'read', 'off'])
  assert.ok(c.every(x => x.controls.light === 'day'), 'controls it does not use stay as they are')
  const tree = L.combos(ENTRIES[4], { ...L.DEFAULTS, light: 'dusk' })
  assert.equal(tree.length, 16, '4 seasons x snow x day/night')
  assert.deepEqual([...new Set(tree.map(x => x.controls.light))], ['day', 'night'])
  assert.deepEqual([...new Set(tree.map(x => x.controls.season))], ['spring', 'summer', 'autumn', 'winter'])
  assert.equal(new Set(tree.map(x => JSON.stringify(x))).size, 16, 'no cell twice')
  const big = entry('animals.dog', {
    axes: [AXIS('breed', 'a', 'b', 'c'), AXIS('frame', ...'abcdefghi')],
    uses: ['light', 'event'],
  })
  const cells = L.combos(big, L.DEFAULTS)
  assert.equal(cells.length, 27, 'the scene controls are dropped before the item axes')
  assert.ok(cells.every(x => x.controls.event === 'none' && x.controls.light === 'day'))
  const huge = entry('people.person', { axes: [AXIS('a', ...'abcdefgh'), AXIS('b', ...'abcdefgh')] })
  assert.equal(L.combos(huge, L.DEFAULTS).length, 48)
  assert.deepEqual(L.combos(ENTRIES[3], L.DEFAULTS), [{ pick: {}, controls: L.DEFAULTS }], 'a plain item is one cell')
})

test('the winter and Christmas packs bring winter: an item reacting to season and pack has no other season under them',
  () => {
  const lake = entry('island.lake', { uses: ['season', 'event'] })
  assert.equal(L.variantCount(lake), 4 + 1, 'four seasons with no pack (winter\'s is the winter pack), then Christmas')
  const all = L.combos(lake, L.DEFAULTS)
  assert.equal(all.length, 5)
  assert.ok(all.every(c => c.controls.event === 'none' || c.controls.season === 'winter'))
  assert.equal(new Set(all.map(c => JSON.stringify(c.controls))).size, 5, 'no cell twice')
  // too many to cross: the pack is held as chosen, so every season there is the same winter
  const big = entry('island.big', { axes: [AXIS('a', ...'abcd')], uses: ['light', 'season', 'snow', 'event'] })
  const held = L.combos(big, { ...L.DEFAULTS, event: 'christmas' })
  assert.equal(held.length, 4 * 2 * 2, 'the axis x day/night x snow, winter only')
  assert.ok(held.every(c => c.controls.season === 'winter' && c.controls.event === 'christmas'))
  assert.equal(L.forcedSeason('winter'), 'winter')
  assert.equal(L.forcedSeason('christmas'), 'winter')
  assert.equal(L.forcedSeason('none'), null)
  assert.equal(L.forcedSeason('tet'), null, 'a small holiday keeps the season chosen')
  assert.equal(L.variantCount(entry('island.sky', { uses: ['season'] })), 4, 'season alone keeps all four')
})

test('an entry with sweep steps through those axes one at a time instead of crossing every axis', () => {
  const person = entry('people.person', {
    axes: [AXIS('gender', 'm', 'f'), AXIS('status', 'a', 'b', 'c'), AXIS('act', ...'abcdefghijklmnopqrstu')],
    uses: ['light', 'season'],
    sweep: ['status', 'act'],
  })
  assert.equal(L.variantCount(person), (1 + 1 + 2 + 20) * 2 * 4, 'each value of each axis counted once')
  const cells = L.combos(person, L.DEFAULTS)
  assert.equal(cells.length, 1 + 2 + 20, 'the default, then the other values of each swept axis; scene dropped')
  assert.deepEqual(cells[0].pick, { gender: 'm', status: 'a', act: 'a' })
  assert.deepEqual(cells[1].pick, { gender: 'm', status: 'b', act: 'a' }, 'the other axes stay at their first value')
  assert.deepEqual(cells[3].pick, { gender: 'm', status: 'a', act: 'b' })
  assert.equal(new Set(cells.map(x => JSON.stringify(x))).size, cells.length, 'no cell twice')
  const small = { ...person, axes: person.axes.slice(0, 2), sweep: ['status'], uses: ['light'] }
  assert.equal(L.combos(small, L.DEFAULTS).length, 3 * 2, 'scene controls still cross when they fit')
})

test('defaultPick takes the first value of every axis, and fixPick drops values the item does not have', () => {
  assert.deepEqual(L.defaultPick(ENTRIES[0]), { screen: 'code' })
  assert.deepEqual(L.fixPick(ENTRIES[0], { screen: 'off', nope: 1 }), { screen: 'off' })
  assert.deepEqual(L.fixPick(ENTRIES[0], { screen: 'nope' }), { screen: 'code' })
})

test('the deep link round-trips, leaves defaults out and ignores what it does not know', () => {
  assert.equal(L.toHash({ ...L.DEFAULTS }), '#/')
  const s = { ...L.DEFAULTS, cat: 'pantry', id: 'pantry.microwave', light: 'night', season: 'winter', snow: true,
    event: 'christmas', zoom: 4, motion: false, view: 'table', pick: { use: 'use' }, q: 'lò vi',
    tags: ['state', 'animated'] }
  const hash = L.toHash(s)
  assert.match(hash, /^#\/pantry\/microwave\?/)
  assert.match(hash, /light=night/)
  assert.match(hash, /season=winter/)
  assert.match(hash, /event=christmas/)
  assert.match(hash, /view=table/)
  assert.deepEqual(L.fromHash(hash), s)
  assert.deepEqual(L.fromHash('#/office'), { ...L.DEFAULTS, cat: 'office' })
  assert.deepEqual(L.fromHash(''), { ...L.DEFAULTS })
  assert.deepEqual(L.fromHash('#/zzz/!!?light=noon&zoom=9&event=7&snow=maybe&view=list'), { ...L.DEFAULTS })
  assert.deepEqual(L.fromHash('#/?event=tet'), { ...L.DEFAULTS, event: 'tet' }, 'a small holiday is a pack too')
  assert.deepEqual(L.fromHash('#/all?q=a%26b%3Dc'), { ...L.DEFAULTS, q: 'a&b=c' })
  for (const st of [{ ...L.DEFAULTS, cat: 'office' }, { ...L.DEFAULTS, cat: 'all', id: 'plants.tree', light: 'dusk' }])
    assert.deepEqual(L.fromHash(L.toHash(st)), st)
})

test('the deep link is the screen: an item open over another category keeps both, a category with no item is just it',
  () => {
    // the drawer opened from "Everything" or a search, then another category picked on the rail
    const over = { ...L.DEFAULTS, cat: 'office', id: 'plants.bush', pick: { look: 'small' } }
    assert.equal(L.toHash(over), '#/office/plants.bush?v.look=small')
    assert.deepEqual(L.fromHash(L.toHash(over)), over)
    const fromAll = { ...L.DEFAULTS, cat: 'all', id: 'plants.bush' }
    assert.equal(L.toHash(fromAll), '#/all/plants.bush')
    assert.deepEqual(L.fromHash(L.toHash(fromAll)), fromAll)
    // a category clicked on the rail closes the drawer: no item, no variant in the link
    const rail = { ...L.DEFAULTS, cat: 'office', id: null, pick: { look: 'small' } }
    assert.equal(L.toHash(rail), '#/office')
    assert.deepEqual(L.fromHash(L.toHash(rail)), { ...L.DEFAULTS, cat: 'office' })
    const own = { ...L.DEFAULTS, cat: 'plants', id: 'plants.bush' }
    assert.equal(L.toHash(own), '#/plants/bush')
    assert.deepEqual(L.fromHash(L.toHash(own)), own)
  })

test('the deep link leaves out the open item\'s first variant and motion that only follows the system', () => {
  const s = { ...L.DEFAULTS, cat: 'pantry', id: 'pantry.microwave', pick: { use: 'idle', x: 'b' } }
  assert.equal(L.toHash(s, { pick: { use: 'idle', x: 'a' } }), '#/pantry/microwave?v.x=b')
  const first = { use: 'idle', x: 'a' }
  assert.equal(L.toHash({ ...s, pick: first }, { pick: first }), '#/pantry/microwave')
  // under prefers-reduced-motion the page starts with motion off: off is not worth a link, on is
  const still = { ...L.DEFAULTS, motion: false }
  assert.equal(L.toHash(still, { motion: false }), '#/')
  assert.equal(L.toHash({ ...L.DEFAULTS, motion: true }, { motion: false }), '#/?motion=1')
  assert.equal(L.toHash(still), '#/?motion=0')
})

test('the event windows come from the event calendar; a holiday window reads day/month', () => {
  assert.deepEqual(L.eventWindow('christmas'), { from: '12-01', to: '12-26' }, 'one window, no weekly levels (D1)')
  assert.equal(L.eventWindow('easter'), null)
  assert.equal(L.dayMonth('12-27'), '27/12')
  assert.equal(L.span({ from: '12-27', to: '01-02' }), '27/12 → 02/01')
})

test('the Event control lists the theme packs: none, winter, Christmas, then every small holiday', () => {
  const { Theme } = loadWeb('theme')
  assert.deepEqual(L.CHOICES.event.slice(0, 3), ['none', 'winter', 'christmas'])
  const holidays = Theme.PACKS.filter(p => p.kind === 'holiday').map(p => p.key)
  assert.ok(holidays.length > 3)
  assert.deepEqual(L.CHOICES.event.slice(3), holidays)
  assert.equal(L.DEFAULTS.event, 'none')
  assert.deepEqual(L.PACKS.map(p => p.id), L.CHOICES.event)
  assert.deepEqual(L.PACKS.slice(0, 3).map(p => p.kind), ['base', 'season', 'event'])
  assert.ok(L.PACKS.slice(3).every(p => p.kind === 'holiday'))
})

test('the conversion table: one column per pack (the small holidays as one, the chosen one or the first)', () => {
  const holidays = L.CHOICES.event.slice(3)
  const cols = L.tableCols('none')
  assert.deepEqual(cols.map(c => c.id), ['none', 'winter', 'christmas', 'holiday'])
  assert.deepEqual(cols.map(c => c.pack), ['none', 'winter', 'christmas', holidays[0]])
  assert.equal(L.tableCols(holidays[2])[3].pack, holidays[2], 'a holiday picked on the Event control')
  assert.equal(L.tableCols('christmas')[3].pack, holidays[0])
  assert.equal(L.tableCols('none'), L.tableCols('christmas'), 'one list per holiday shown')
})

test('the conversion table: one row per label, each with the entries that draw it, and the cell a look shows', () => {
  const labels = [{ id: 'tree.x', group: 'outdoor' }, { id: 'tree.y', group: 'outdoor' },
    { id: 'desk', group: 'office' }]
  const look = v => ({ of: () => v })
  const plain = entry('plants.plain', { label: 'tree.x' })
  const follows = entry('plants.follows', { label: 'tree.x', uses: ['event'] })
  const kinds = entry('plants.kinds', { label: 'tree.y', axes: [AXIS('kind', 'a', 'b')],
    pickFor: lk => ({ kind: lk.of('tree.y') }) })
  const tet = entry('plants.tet', { label: 'desk', variant: 'tet' })
  const xmas = entry('plants.xmas', { labels: ['desk', 'tree.y'], variant: 'xmas' })
  const rows = L.tableRows([plain, follows, kinds, tet, xmas, ENTRIES[0]], labels)
  assert.deepEqual(rows.map(r => r.id), ['tree.x', 'tree.y', 'desk'])
  assert.deepEqual(rows[0].entries, [plain, follows])
  assert.deepEqual(rows[2].entries, [tet, xmas])
  assert.deepEqual(L.labelsOf(xmas), ['desk', 'tree.y'])
  assert.deepEqual(L.labelsOf(ENTRIES[0]), [])
  assert.equal(L.tableCell(rows[0], look('plain')).entry, follows, 'an entry that follows the pack first')
  assert.deepEqual(L.tableCell(rows[1], look('b')), { entry: kinds, pick: { kind: 'b' } }, 'its axis set from the look')
  assert.equal(L.tableCell(rows[2], look('tet')).entry, tet, 'a fixed variant of the label')
  assert.equal(L.tableCell(rows[2], look('xmas')).entry, xmas)
  assert.equal(L.tableCell(rows[2], look('none')), null, 'a variant nothing draws (no holiday tree)')
})
