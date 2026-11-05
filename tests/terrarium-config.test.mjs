import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { configDir, readConfig, writeConfig, validHubUrl, runCommand } = require('../lib/terrarium-config.js')

const TOKEN = 'tok_abcdefghijklmnopqrstuvwxyz0123456789WXYZ'
const base = () => ({ hub: 'https://hub.example', token: TOKEN, deviceId: 'd1', islandId: 'i1', salt: 'ab'.repeat(16),
  share: 'kin', projects: [], private: false, revoked: false })
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'terrarium-cfg-')), '.claude-terrarium')
const mode = (p) => fs.statSync(p).mode & 0o777
const run = async (dir, argv, extra = {}) => { const lines = []; const code = await runCommand(argv, { dir, log: (m) => lines.push(String(m)), ...extra }); return { code, out: lines.join('\n') } }

test('configDir defaults under home and honours an override', () => {
  assert.equal(configDir('/h'), path.join('/h', '.claude-terrarium'))
  assert.equal(configDir(), path.join(os.homedir(), '.claude-terrarium'))
})

test('writes 0600 inside a 0700 dir', () => {
  const dir = tmp(); writeConfig(dir, base())
  assert.equal(mode(dir), 0o700); assert.equal(mode(path.join(dir, 'config.json')), 0o600)
  assert.deepEqual(readConfig(dir), base())
})

test('readConfig returns null when missing', () => { assert.equal(readConfig(tmp()), null) })

test('repairs a world-readable config', () => {
  const dir = tmp(); writeConfig(dir, base())
  fs.chmodSync(dir, 0o755); fs.chmodSync(path.join(dir, 'config.json'), 0o644)
  const warns = []; readConfig(dir, (m) => warns.push(m))
  assert.equal(mode(path.join(dir, 'config.json')), 0o600); assert.equal(mode(dir), 0o700)
  assert.ok(warns.length >= 1)
})

test('validHubUrl', () => {
  for (const u of ['https://a.b', 'http://localhost:4318', 'http://localhost', 'http://127.0.0.1:4318']) assert.equal(validHubUrl(u), true, u)
  for (const u of ['http://a.b', 'ftp://x', 'javascript:alert(1)', 'http://localhost.evil.com', 'http://localhost@evil.com', '', null]) assert.equal(validHubUrl(u), false, String(u))
})

test('share co-ban then kin', async () => {
  const dir = tmp(); writeConfig(dir, base())
  assert.equal((await run(dir, ['share', 'co-ban'])).code, 0); assert.equal(readConfig(dir).share, 'co-ban')
  assert.equal((await run(dir, ['share', 'kin'])).code, 0); assert.equal(readConfig(dir).share, 'kin')
  assert.equal((await run(dir, ['share', 'bogus'])).code, 1)
})

test('share projects a,b', async () => {
  const dir = tmp(); writeConfig(dir, base())
  assert.equal((await run(dir, ['share', 'projects', 'a,b'])).code, 0)
  assert.deepEqual(readConfig(dir).projects, ['a', 'b'])
  assert.equal((await run(dir, ['share', 'projects', ''])).code, 0)
  assert.deepEqual(readConfig(dir).projects, [])
})

test('private on|off', async () => {
  const dir = tmp(); writeConfig(dir, base())
  await run(dir, ['private', 'on']); assert.equal(readConfig(dir).private, true)
  await run(dir, ['private', 'off']); assert.equal(readConfig(dir).private, false)
  assert.equal((await run(dir, ['private', 'maybe'])).code, 1)
})

test('commands on a missing config fail clearly without creating one', async () => {
  const dir = tmp()
  for (const argv of [['share', 'kin'], ['private', 'on'], ['share', 'projects', 'a']]) assert.equal((await run(dir, argv)).code, 1)
  assert.equal(fs.existsSync(dir), false)
})

test('leave removes the file', async () => {
  const dir = tmp(); writeConfig(dir, base())
  assert.equal((await run(dir, ['leave'])).code, 0)
  assert.equal(fs.existsSync(path.join(dir, 'config.json')), false)
})

test('status never prints the full token', async () => {
  const dir = tmp(); writeConfig(dir, base())
  const { code, out } = await run(dir, ['status'])
  assert.equal(code, 0); assert.ok(!out.includes(TOKEN)); assert.ok(out.includes('…' + TOKEN.slice(-4)))
  assert.ok(!out.includes(TOKEN.slice(0, 12)))
  assert.equal((await run(tmp(), ['status'])).code, 0)
})

test('join validates the hub url and delegates', async () => {
  const dir = tmp(); const calls = []
  const join = async (hub, o) => { calls.push([hub, o]); return 0 }
  assert.equal((await run(dir, ['join', 'http://evil.com'], { join })).code, 1)
  assert.equal(calls.length, 0)
  assert.equal((await run(dir, ['join', 'https://hub.example', '--name', 'Kiet'], { join })).code, 0)
  assert.deepEqual(calls, [['https://hub.example', { name: 'Kiet' }]])
  const r = await run(dir, ['join', 'https://hub.example']); assert.equal(r.code, 1)
})

test('unknown argv returns null', async () => {
  const dir = tmp()
  assert.equal(await runCommand([], { dir, log() {} }), null)
  assert.equal(await runCommand(['--port', '1'], { dir, log() {} }), null)
})

test('status strips control characters from what it prints', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-ctl-'));
  writeConfig(dir, { hub: 'https://hub.example/\x1b[31m', token: 'trd_abcd', share: 'kin', projects: ['a\x1b[2Jb'], private: false });
  const logs = [];
  await runCommand(['status'], { dir, log: (l) => logs.push(l) });
  assert.ok(!/[\x00-\x1f\x7f-\x9f]/.test(logs.join('')), JSON.stringify(logs));
});

test('leave revokes on the hub first', async () => {
  const dir = tmp(); writeConfig(dir, base())
  const calls = []
  const r = await run(dir, ['leave'], { revokeSelf: async (hub, token) => { calls.push([hub, token, fs.existsSync(path.join(dir, 'config.json'))]); return 'ok' } })
  assert.equal(r.code, 0)
  assert.deepEqual(calls, [['https://hub.example', TOKEN, true]])
  assert.match(r.out, /Revoked this device on the hub\./)
  assert.equal(fs.existsSync(path.join(dir, 'config.json')), false)
  // already revoked: nothing to call
  writeConfig(dir, { ...base(), revoked: true })
  let n = 0
  await run(dir, ['leave'], { revokeSelf: async () => { n++; return 'ok' } })
  assert.equal(n, 0)
})

test('leave on a config the publisher already marked revoked says so without calling the hub', async () => {
  const dir = tmp(); writeConfig(dir, { ...base(), revoked: true })
  let calls = 0
  const r = await run(dir, ['leave'], { revokeSelf: async () => { calls++; return 'ok' } })
  assert.equal(r.code, 0)
  assert.equal(calls, 0)
  assert.match(r.out, /This device was already removed on the hub\./)
  assert.equal(fs.existsSync(path.join(dir, 'config.json')), false)
})

test('leave says so when the hub no longer knows this device (401)', async () => {
  const dir = tmp(); writeConfig(dir, base())
  const r = await run(dir, ['leave'], { revokeSelf: async () => 'gone' })
  assert.equal(r.code, 0)
  assert.match(r.out, /This device was already removed on the hub\./)
  assert.doesNotMatch(r.out, /Could not reach/)
  assert.equal(fs.existsSync(path.join(dir, 'config.json')), false)
})

test('leave still removes the file when the hub is unreachable', async () => {
  const dir = tmp(); writeConfig(dir, base())
  const r = await run(dir, ['leave'], { revokeSelf: async () => 'failed' })
  assert.equal(r.code, 0)
  assert.match(r.out, /Could not reach the hub; revoke this device at https:\/\/hub\.example\/me\./)
  assert.equal(fs.existsSync(path.join(dir, 'config.json')), false)
})
