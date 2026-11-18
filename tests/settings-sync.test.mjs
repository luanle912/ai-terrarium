// Sharing the Settings choices through the local server (web/settings-sync.js; spec 2026-11-18 §5.8, D2b): the
// newest choice wins, a page pushes in every mode it can reach the server from, a failed push is kept and retried.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

const { SettingsSync: S } = loadWeb('settings-sync')

const memStore = () => {
  const m = new Map()
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }
}
// A fake host: the parts of ClaudeOffice the sync reads and calls, in Simulation (no live stream, nothing shared yet).
function fakeHost(over = {}) {
  const storage = memStore()
  const host = {
    storage,
    sync: S.create(storage),
    wallpaper: false,
    world: null,
    state: { weatherMode: 'random', city: '', dataSource: 'sim' },
    eventChoice: 'auto',
    calls: [],
    setWeather(p, fromServer) {
      this.calls.push(['weather', p, fromServer])
      this.state.weatherMode = p.weatherMode
      this.state.city = p.city
    },
    setEventChoice(c, fromServer) { this.calls.push(['event', c, fromServer]); this.eventChoice = c },
    seasonChoice: 'auto',
    setSeasonChoice(c, fromServer) { this.calls.push(['season', c, fromServer]); this.seasonChoice = c },
    adoptSettings(ps) { S.receive(this, ps) },
    ...over,
  }
  return host
}
const okFetch = (log, answer) => async (url, opts) => {
  const body = JSON.parse(opts.body)
  log.push({ url, opts, body })
  return { ok: true, json: async () => ({ ok: true, settings: answer ? answer(body) : body }) }
}

test('sim mode pushes', async () => {
  const log = [], host = fakeHost()
  host.eventChoice = 'on'
  await S.share(host, { touch: true, fetch: okFetch(log), now: 5000 })
  assert.equal(log.length, 1, 'Simulation sends the choice too')
  assert.equal(log[0].url, '/api/settings')
  assert.equal(log[0].opts.method, 'POST')
  assert.equal(log[0].opts.headers['X-Terrarium'], 'settings')
  assert.deepEqual(log[0].body, { weather: { mode: 'random', city: '' }, event: 'on', season: 'auto', updatedAt: 5000 })
  assert.equal(host.sync.pending, false)
  assert.equal(S.loadAt(host.storage), 5000, 'the time of the choice is kept with it')
})

test('the wallpaper and the world never push', async () => {
  const log = []
  await S.share(fakeHost({ wallpaper: true }), { touch: true, fetch: okFetch(log) })
  await S.share(fakeHost({ world: {} }), { touch: true, fetch: okFetch(log) })
  assert.equal(log.length, 0)
})

test('a failed push keeps the local choice, marked pending, and the next snapshot retries it', async () => {
  const host = fakeHost()
  host.eventChoice = 'on'
  await S.share(host, { touch: true, now: 5000, fetch: async () => { throw new Error('down') } })
  assert.equal(host.sync.pending, true)
  assert.equal(host.eventChoice, 'on')
  // the server still has the older choice: it is not taken, ours is sent again
  const log = []
  S.receive(host, { weather: { mode: 'random', city: '' }, event: 'off', updatedAt: 1000 }, { fetch: okFetch(log) })
  await new Promise(r => setTimeout(r, 0))
  assert.equal(host.calls.length, 0, 'nothing taken from the older server value')
  assert.equal(log.length, 1)
  assert.equal(log[0].body.updatedAt, 5000)
  assert.equal(host.sync.pending, false)
  // a 500 answer counts as a failure too
  await S.share(host, { touch: true, now: 6000, fetch: async () => ({ ok: false, json: async () => ({}) }) })
  assert.equal(host.sync.pending, true)
})

test('a sent choice is not sent again on every snapshot of a server that keeps an older one', async () => {
  const log = [], host = fakeHost()
  // an old server.js drops updatedAt: the answer has none
  await S.share(host, { touch: true, now: 5000, fetch: okFetch(log, b => ({ weather: b.weather, event: b.event })) })
  S.receive(host, { weather: { mode: 'random', city: '' }, event: 'auto' }, { fetch: okFetch(log) })
  S.receive(host, { weather: { mode: 'random', city: '' }, event: 'auto' }, { fetch: okFetch(log) })
  assert.equal(log.length, 1)
})

test('the season choice is sent with the rest; a newer one is taken, the same or a strange one is not', async () => {
  const log = [], host = fakeHost()
  host.seasonChoice = 'summer'
  await S.share(host, { touch: true, now: 5000, fetch: okFetch(log) })
  assert.equal(log[0].body.season, 'summer')
  S.receive(host, { weather: { mode: 'random', city: '' }, event: 'auto', season: 'summer', updatedAt: 6000 })
  S.receive(host, { weather: { mode: 'random', city: '' }, event: 'auto', season: 'monsoon', updatedAt: 7000 })
  assert.deepEqual(host.calls, [])
  S.receive(host, { weather: { mode: 'random', city: '' }, event: 'auto', season: 'autumn', updatedAt: 8000 })
  assert.deepEqual(host.calls, [['season', 'autumn', true]])
})

test('a newer server value is taken, weather and event, and its time becomes ours', () => {
  const host = fakeHost()
  host.sync.at = 100
  S.receive(host, { weather: { mode: 'real', city: 'Hue' }, event: 'off', season: 'winter', updatedAt: 900 }, {
    fetch: okFetch([]),
  })
  assert.deepEqual(host.calls, [
    ['weather', { weatherMode: 'real', city: 'Hue', cityDraft: 'Hue' }, true],
    ['event', 'off', true],
    ['season', 'winter', true],
  ])
  assert.equal(host.sync.at, 900)
  assert.equal(S.loadAt(host.storage), 900)
})

test('the push answer is adopted: a newer choice from another page wins in Simulation too', async () => {
  const host = fakeHost()
  host.eventChoice = 'on'
  await S.share(host, {
    touch: true,
    now: 5000,
    fetch: okFetch([], () => ({ weather: { mode: 'off', city: '' }, event: 'off', updatedAt: 7000 })),
  })
  assert.equal(host.eventChoice, 'off')
  assert.equal(host.sync.at, 7000)
})

test('a local change is always stamped later than the last one, even with a clock that stepped back', () => {
  const s = S.create(memStore())
  s.at = 9000
  S.touch(s, null, 5000)
  assert.equal(s.at, 9001)
})

test('the world view follows another tab of its page through storage, and never sends anything', () => {
  const host = fakeHost({ world: {} })
  host.storage.setItem('ai-terrarium.event', 'off')
  S.follow(host, 'ai-terrarium.event')
  host.storage.setItem('ai-terrarium.season', 'winter')
  S.follow(host, 'ai-terrarium.season')
  host.storage.setItem('ai-terrarium.weather', JSON.stringify({ mode: 'off', city: '' }))
  S.follow(host, 'ai-terrarium.weather')
  S.follow(host, 'something.else')
  assert.deepEqual(host.calls, [
    ['event', 'off', true],
    ['season', 'winter', true],
    ['weather', { weatherMode: 'off', city: '', cityDraft: '' }, true],
  ])
})

// Upgrading: the server's file was written before the season (or the event) was shared, so it has the weather only,
// and no stamp; this page has never synced (at 0), so the server's value counts as newer. A hand-picked choice here
// must still reach the server, once, or it never would until something else is changed.
const settle = () => new Promise(r => setTimeout(r, 0))
for (const [field, pick] of [['season', h => (h.seasonChoice = 'winter')], ['event', h => (h.eventChoice = 'on')]])
  test(`an old file without ${field} gets this page's hand-picked ${field}, pushed once`, async () => {
    const log = [], host = fakeHost()
    pick(host)
    const old = { weather: { mode: 'random', city: '' } }
    S.receive(host, old, { fetch: okFetch(log), now: 7000 })
    await settle()
    assert.equal(log.length, 1, 'one push')
    assert.equal(log[0].body[field], field === 'season' ? 'winter' : 'on')
    assert.ok(log[0].body.updatedAt > 0, 'stamped, so other pages take it')
    S.receive(host, old, { fetch: okFetch(log), now: 8000 })
    await settle()
    assert.equal(log.length, 1, 'not again on the next snapshot')
  })

test('an old file and a page on auto: nothing to push', async () => {
  const log = [], host = fakeHost()
  S.receive(host, { weather: { mode: 'random', city: '' } }, { fetch: okFetch(log) })
  await settle()
  assert.equal(log.length, 0)
})

test('the wallpaper never seeds an old file', async () => {
  const log = [], host = fakeHost({ wallpaper: true, seasonChoice: 'winter' })
  S.receive(host, { weather: { mode: 'random', city: '' } }, { fetch: okFetch(log) })
  await settle()
  assert.equal(log.length, 0)
})

test('a file with a season but no event still gets this page\'s hand-picked event', async () => {
  const log = [], host = fakeHost()
  host.eventChoice = 'off'
  S.receive(host, { weather: { mode: 'random', city: '' }, season: 'summer' }, { fetch: okFetch(log) })
  await settle()
  assert.equal(host.seasonChoice, 'summer', 'the server\'s season is taken')
  assert.equal(log.length, 1)
  assert.equal(log[0].body.event, 'off')
})
