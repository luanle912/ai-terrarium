import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ps = require('../lib/page-settings.js')
const { createHandler } = require('../server.js')
import { loadWeb } from './web.mjs'

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'terr-ps-')), 'page-settings.json')

test('only a known weather mode is kept; the city is trimmed and capped', () => {
  assert.deepEqual(ps.clean({ weather: { mode: 'real', city: '  Hà Nội ' } }), { weather: { mode: 'real', city: 'Hà Nội' } })
  assert.deepEqual(ps.clean({ weather: { mode: 'off' } }), { weather: { mode: 'off', city: '' } })
  assert.equal(ps.clean({ weather: { mode: 'sunny' } }), null)
  assert.equal(ps.clean({}), null)
  assert.equal(ps.clean(null), null)
  assert.equal(ps.clean({ weather: { mode: 'real', city: 'x'.repeat(500) } }).weather.city.length, 100)
})

test('the event choice rides along with the weather; without one, or with a strange one, it is auto', () => {
  const w = { mode: 'off', city: '' }
  assert.deepEqual(ps.clean({ weather: w, event: 'on' }), { weather: w, event: 'on' })
  assert.deepEqual(ps.clean({ weather: w, event: 'off' }), { weather: w, event: 'off' })
  assert.deepEqual(ps.clean({ weather: w, event: 'party' }), { weather: w })
  assert.deepEqual(ps.clean({ weather: w }), { weather: w }, 'an older page sends no event')
  assert.equal(ps.clean({ event: 'on' }), null, 'never without a weather')
})

test('a page that knows nothing of the event (an old tab) changes the weather and leaves the event choice alone', () => {
  const a = ps.createPageSettings(tmpFile())
  a.set({ weather: { mode: 'off', city: '' }, event: 'on' })
  assert.deepEqual(a.set({ weather: { mode: 'random', city: '' } }), { weather: { mode: 'random', city: '' }, event: 'on' })
  assert.deepEqual(a.set({ weather: { mode: 'random', city: '' }, event: 'auto' }), { weather: { mode: 'random', city: '' }, event: 'auto' })
})

test('the time of the choice (updatedAt, ms) rides along when it is a number', () => {
  const w = { mode: 'off', city: '' }
  assert.deepEqual(ps.clean({ weather: w, event: 'on', updatedAt: 1700 }), { weather: w, event: 'on', updatedAt: 1700 })
  assert.deepEqual(ps.clean({ weather: w, updatedAt: 'soon' }), { weather: w })
  assert.deepEqual(ps.clean({ weather: w, updatedAt: -5 }), { weather: w })
  assert.deepEqual(ps.clean({ weather: w, updatedAt: Infinity }), { weather: w })
})

test('server set() ignores an older updatedAt', () => {
  const a = ps.createPageSettings(tmpFile())
  const w = { mode: 'off', city: '' }
  a.set({ weather: w, event: 'on', updatedAt: 2000 })
  assert.deepEqual(a.set({ weather: w, event: 'off', updatedAt: 1000 }), { weather: w, event: 'on', updatedAt: 2000 },
    'set answers with the newer one it keeps')
  assert.equal(a.get().event, 'on')
  assert.deepEqual(a.set({ weather: w, event: 'off', updatedAt: 3000 }), { weather: w, event: 'off', updatedAt: 3000 })
  assert.equal(a.set({ weather: w, event: 'auto', updatedAt: 3000 }).event, 'auto', 'the same time: the last one wins')
})

test('a page without updatedAt (older tab) is treated as oldest', () => {
  const a = ps.createPageSettings(tmpFile())
  const w = { mode: 'off', city: '' }
  a.set({ weather: w, event: 'on', updatedAt: 2000 })
  assert.deepEqual(a.set({ weather: { mode: 'random', city: '' }, event: 'off' }),
    { weather: w, event: 'on', updatedAt: 2000 })
  // with nothing stamped yet an older tab still changes it, as before
  const b = ps.createPageSettings(tmpFile())
  b.set({ weather: w, event: 'on' })
  assert.deepEqual(b.set({ weather: w, event: 'off' }), { weather: w, event: 'off' })
  assert.equal(b.set({ weather: w, event: 'on', updatedAt: 5 }).updatedAt, 5, 'any stamp is newer than none')
})

test('the season choice rides along: only one the page knows, kept when a page sends none', () => {
  const { SeasonLogic } = loadWeb('season-logic')
  assert.deepEqual(ps.SEASONS, SeasonLogic.CHOICES, 'the same list as the page')
  const w = { mode: 'off', city: '' }
  for (const season of SeasonLogic.CHOICES) assert.equal(ps.clean({ weather: w, season }).season, season)
  assert.equal('season' in ps.clean({ weather: w, season: 'monsoon' }), false)
  const a = ps.createPageSettings(tmpFile())
  a.set({ weather: w, event: 'on', season: 'winter', updatedAt: 10 })
  assert.deepEqual(a.set({ weather: w, event: 'off', updatedAt: 20 }),
    { weather: w, event: 'off', season: 'winter', updatedAt: 20 },
    'a page that sends no season (an older tab) leaves the one there is')
  assert.equal(a.set({ weather: w, season: 'spring', updatedAt: 30 }).season, 'spring')
})

test('a posted updatedAt is clamped to at most a minute ahead of the server clock', () => {
  const w = { mode: 'off', city: '' }, before = Date.now()
  const c = ps.clean({ weather: w, updatedAt: before + 5 * 86400_000 })
  assert.ok(c.updatedAt >= before + 60_000 && c.updatedAt <= Date.now() + 60_000, 'days ahead becomes now + 1 min')
  assert.equal(ps.clean({ weather: w, updatedAt: before - 1000 }).updatedAt, before - 1000, 'a past stamp is kept')
  const a = ps.createPageSettings(tmpFile())
  a.set({ weather: w, event: 'on', updatedAt: before + 5 * 86400_000 })
  assert.equal(a.set({ weather: w, event: 'off', updatedAt: Date.now() + 61_000 }).event, 'off',
    'a skewed clock cannot lock the file for days')
})

test('the choice is kept on disk and read back by the next server', () => {
  const f = tmpFile()
  const a = ps.createPageSettings(f)
  assert.equal(a.get(), null)
  assert.equal(a.set({ weather: { mode: 'bad' } }), null, 'a bad value changes nothing')
  a.set({ weather: { mode: 'real', city: 'Da Nang' } })
  assert.deepEqual(ps.createPageSettings(f).get(), { weather: { mode: 'real', city: 'Da Nang' } })
})

test('POST /api/settings saves the choice; it needs our own origin and the X-Terrarium header', async () => {
  const s = ps.createPageSettings(tmpFile())
  const srv = http.createServer(createHandler({ settings: () => s, port: 0 }))
  await new Promise(r => srv.listen(0, '127.0.0.1', r))
  const port = srv.address().port
  const post = (headers, body) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api/settings', method: 'POST', headers: { host: 'localhost:0', ...headers } }, res => {
      let b = ''; res.on('data', d => { b += d }); res.on('end', () => resolve({ status: res.statusCode, body: b }))
    })
    req.on('error', reject); req.end(body)
  })
  try {
    const body = JSON.stringify({ weather: { mode: 'real', city: 'Hue' } })
    assert.equal((await post({}, body)).status, 403, 'no X-Terrarium header')
    assert.equal((await post({ 'x-terrarium': 'settings', origin: 'http://evil.example' }, body)).status, 403)
    assert.equal((await post({ 'x-terrarium': 'settings' }, '{"weather":{"mode":"nope"}}')).status, 400)
    assert.equal(s.get(), null)
    const ok = await post({ 'x-terrarium': 'settings', origin: 'http://localhost:0' }, body)
    assert.equal(ok.status, 200)
    assert.deepEqual(s.get(), { weather: { mode: 'real', city: 'Hue' } })
  } finally { srv.close() }
})

test('the teleport style choice rides along: kept when it looks like an id, dropped otherwise, kept from an old page', () => {
  const w = { mode: 'off', city: '' }
  // the server checks only the shape: an id the page does not know (zz9) is dropped by the page, not here
  assert.deepEqual(ps.clean({ weather: w, teleport: 'bolt' }), { weather: w, teleport: 'bolt' })
  assert.deepEqual(ps.clean({ weather: w, teleport: 'zz9' }), { weather: w, teleport: 'zz9' })
  assert.deepEqual(ps.clean({ weather: w, teleport: 'random' }), { weather: w, teleport: 'random' })
  assert.deepEqual(ps.clean({ weather: w, teleport: 'off', event: 'on' }), { weather: w, event: 'on', teleport: 'off' })
  for (const bad of ['Bolt', 'x', 'a'.repeat(17), 'a b', 3, null, { id: 'bolt' }])
    assert.deepEqual(ps.clean({ weather: w, teleport: bad }), { weather: w }, String(bad))
  const a = ps.createPageSettings(tmpFile())
  a.set({ weather: w, teleport: 'smoke' })
  assert.equal(a.set({ weather: { mode: 'random', city: '' } }).teleport, 'smoke', 'an old page leaves it')
  assert.equal(a.set({ weather: w, teleport: 'pipe' }).teleport, 'pipe')
})
