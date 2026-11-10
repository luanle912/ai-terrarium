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
