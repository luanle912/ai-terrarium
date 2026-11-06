import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFile, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const STORE_PATH = require.resolve('../lib/animal-store.js')
const { createStore, encrypt, decrypt } = require(STORE_PATH)

const AAD = 'ai-terrarium/animals'
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'terrarium-animals-')), '.claude-terrarium')
const mode = (p) => fs.statSync(p).mode & 0o777
const files = (dir) => ({ key: path.join(dir, 'animals.key'), dat: path.join(dir, 'animals.dat'), bak: path.join(dir, 'animals.dat.bak') })
const sample = (n = 1) => ({ seq: 0, spawnNo: n, caught: [{ id: 'a7f3c2', species: 'fox', at: 1762329600000 }], out: [],
  speciesCaught: ['fox'], total: n, waitLeftMs: 312000, wild: null, attempt: null })
const key32 = () => crypto.randomBytes(32)

// Snapshot every entry in dir: bytes and mode, to prove nothing was touched.
const snapshot = (dir) => Object.fromEntries(fs.readdirSync(dir).sort().map((f) => {
  const p = path.join(dir, f), st = fs.statSync(p)
  return [f, { mode: st.mode & 0o777, data: st.isFile() ? fs.readFileSync(p).toString('base64') : 'dir' }]
}))

// Store with one or two saved versions (seq 1, then seq 2 when twice is set).
function seeded({ twice = false } = {}) {
  const dir = tmp(), store = createStore({ dir })
  assert.equal(store.load().status, 'fresh')
  assert.equal(store.save(sample(1)).ok, true)
  if (twice) assert.equal(store.save(sample(2)).ok, true)
  return { dir, store, ...files(dir) }
}

const parsed = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const writeJson = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj))
const b64 = (buf) => buf.toString('base64')

// ---- encrypt / decrypt ----

test('encrypt/decrypt round trip with the documented header', () => {
  const k = key32(), obj = sample(3)
  const json = encrypt(k, obj, AAD)
  const f = JSON.parse(json)
  assert.deepEqual(Object.keys(f).sort(), ['alg', 'ct', 'iv', 'tag', 'v'])
  assert.equal(f.v, 1); assert.equal(f.alg, 'A256GCM')
  assert.equal(Buffer.from(f.iv, 'base64').length, 12)
  assert.equal(Buffer.from(f.tag, 'base64').length, 16)
  assert.deepEqual(decrypt(k, json, AAD), obj)
  assert.deepEqual(decrypt(k, f, AAD), obj)
})

test('every write uses a fresh random iv', () => {
  const k = key32(), ivs = new Set()
  for (let i = 0; i < 20; i++) ivs.add(JSON.parse(encrypt(k, sample(), AAD)).iv)
  assert.equal(ivs.size, 20)
})

test('flipping any decoded byte of ct, iv or tag is detected', () => {
  const k = key32(), f = JSON.parse(encrypt(k, sample(), AAD))
  for (const field of ['ct', 'iv', 'tag']) {
    const raw = Buffer.from(f[field], 'base64')
    for (let i = 0; i < raw.length; i++) {
      for (const mask of [0x01, 0x80]) {
        const bad = Buffer.from(raw); bad[i] ^= mask
        assert.equal(decrypt(k, { ...f, [field]: b64(bad) }, AAD), null, `${field}[${i}]^${mask}`)
      }
    }
  }
})

test('substituting any base64 character of ct, iv or tag is detected', () => {
  const k = key32(), f = JSON.parse(encrypt(k, sample(), AAD))
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (const field of ['ct', 'iv', 'tag']) {
    const s = f[field]
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '=') continue
      const c = alpha[(alpha.indexOf(s[i]) + 1) % 64]
      assert.equal(decrypt(k, { ...f, [field]: s.slice(0, i) + c + s.slice(i + 1) }, AAD), null, `${field}@${i}`)
    }
  }
})

test('a padding-bit change keeps the bytes but fails the base64 round trip', () => {
  const k = key32(), f = JSON.parse(encrypt(k, sample(), AAD))
  // 16-byte tag -> 22 chars + '=='; the 22nd char carries 4 unused bits.
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const last = f.tag[21], alt = alpha[alpha.indexOf(last) ^ 1]
  const tag = f.tag.slice(0, 21) + alt + '=='
  assert.deepEqual(Buffer.from(tag, 'base64'), Buffer.from(f.tag, 'base64'))
  assert.equal(decrypt(k, { ...f, tag }, AAD), null)
})

test('non-canonical base64 is rejected', () => {
  const k = key32(), f = JSON.parse(encrypt(k, sample(), AAD))
  const urlSafe = (s) => s.replace(/\+/g, '-').replace(/\//g, '_')
  const variants = [
    { tag: f.tag.replace(/=+$/, '') },                     // stripped padding
    { tag: f.tag + '=' },                                  // extra padding
    { ct: f.ct.slice(0, 4) + '\n' + f.ct.slice(4) },       // embedded newline
    { iv: ' ' + f.iv },                                    // leading space
  ]
  const ctUrl = urlSafe(f.ct); if (ctUrl !== f.ct) variants.push({ ct: ctUrl })
  // Force a '+' or '/' somewhere so the base64url case is always exercised.
  const k2 = key32(); let g
  do { g = JSON.parse(encrypt(k2, sample(), AAD)) } while (!/[+/]/.test(g.ct + g.iv + g.tag))
  for (const field of ['ct', 'iv', 'tag']) if (/[+/]/.test(g[field])) assert.equal(decrypt(k2, { ...g, [field]: urlSafe(g[field]) }, AAD), null)
  for (const v of variants) assert.equal(decrypt(k, { ...f, ...v }, AAD), null, JSON.stringify(Object.keys(v)))
})

test('truncated or extended tag and wrong-size iv are rejected', () => {
  const k = key32(), f = JSON.parse(encrypt(k, sample(), AAD))
  const tag = Buffer.from(f.tag, 'base64'), iv = Buffer.from(f.iv, 'base64')
  for (const n of [0, 4, 8, 12, 13, 15]) assert.equal(decrypt(k, { ...f, tag: b64(tag.subarray(0, n)) }, AAD), null, `tag ${n}`)
  assert.equal(decrypt(k, { ...f, tag: b64(Buffer.concat([tag, Buffer.from([0])])) }, AAD), null)
  for (const n of [0, 8, 11]) assert.equal(decrypt(k, { ...f, iv: b64(iv.subarray(0, n)) }, AAD), null, `iv ${n}`)
  assert.equal(decrypt(k, { ...f, iv: b64(Buffer.concat([iv, Buffer.from([0, 0, 0, 0])])) }, AAD), null)
})

test('changed header (v, alg), extra or missing fields, bad types are rejected', () => {
  const k = key32(), f = JSON.parse(encrypt(k, sample(), AAD))
  const bad = [
    { ...f, v: 2 }, { ...f, v: '1' }, { ...f, v: 0 }, { ...f, alg: 'A128GCM' }, { ...f, alg: 'a256gcm' },
    { ...f, extra: 1 }, { ...f, ct: '' }, { ...f, ct: 5 }, { ...f, iv: null },
  ]
  for (const field of ['v', 'alg', 'iv', 'tag', 'ct']) { const { [field]: _, ...rest } = f; bad.push(rest) }
  for (const b of bad) assert.equal(decrypt(k, b, AAD), null, JSON.stringify(b).slice(0, 60))
  for (const s of ['', 'null', '[]', '{', 'x', JSON.stringify(f) + 'x']) assert.equal(decrypt(k, s, AAD), null, s)
  assert.equal(decrypt(k, null, AAD), null)
})

test('a different key or aad cannot decrypt', () => {
  const k = key32(), json = encrypt(k, sample(), AAD)
  assert.equal(decrypt(key32(), json, AAD), null)
  assert.equal(decrypt(k, json, 'ai-terrarium/animals-dev'), null)
  assert.equal(decrypt(k.subarray(0, 16), json, AAD), null)
  assert.equal(decrypt('not a key', json, AAD), null)
})

test('only a plain object plaintext is accepted', () => {
  const k = key32()
  for (const v of [null, [1], 'x', 3]) {
    // Build a validly authenticated file around a non-object plaintext.
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', k, iv, { authTagLength: 16 })
    const good = JSON.parse(encrypt(k, {}, AAD))
    c.setAAD(Buffer.from(JSON.stringify([AAD, good.v, good.alg])))
    const ct = Buffer.concat([c.update(JSON.stringify(v)), c.final()])
    const f = { v: 1, alg: 'A256GCM', iv: b64(iv), tag: b64(c.getAuthTag()), ct: b64(ct) }
    assert.equal(decrypt(k, f, AAD), null, JSON.stringify(v))
  }
})

// ---- store: load/save ----

test('fresh run creates a 32-byte key with 0600 inside a 0700 dir and no data', () => {
  const dir = tmp(), r = createStore({ dir }).load()
  assert.deepEqual(r, { status: 'fresh', state: null })
  const { key, dat, bak } = files(dir)
  assert.equal(fs.readFileSync(key).length, 32)
  assert.equal(mode(dir), 0o700); assert.equal(mode(key), 0o600)
  assert.equal(fs.existsSync(dat), false); assert.equal(fs.existsSync(bak), false)
})

test('save then load returns the same state with seq incremented, files 0600', () => {
  const { dir, store, dat, bak } = seeded()
  const s2 = { ...sample(2), wild: { id: 'b1c2d3', species: 'owl', stayLeftMs: 9000 } }
  const input = structuredClone(s2)
  const r = store.save(s2)
  assert.deepEqual(r, { ok: true, seq: 2 })
  assert.deepEqual(s2, input, 'save must not mutate its input')
  const loaded = createStore({ dir }).load()
  assert.equal(loaded.status, 'ok')
  assert.deepEqual(loaded.state, { ...s2, seq: 2 })
  assert.equal(mode(dat), 0o600); assert.equal(mode(bak), 0o600); assert.equal(mode(dir), 0o700)
  // .bak holds the previous version.
  assert.equal(decrypt(fs.readFileSync(files(dir).key), fs.readFileSync(bak, 'utf8'), AAD).seq, 1)
  assert.deepEqual(fs.readdirSync(dir).sort(), ['animals.dat', 'animals.dat.bak', 'animals.key'])
})

test('the file on disk does not contain the plaintext', () => {
  const { dat } = seeded()
  const raw = fs.readFileSync(dat, 'utf8')
  assert.ok(!raw.includes('fox')); assert.ok(!raw.includes('a7f3c2'))
})

test('loose modes are tightened on load and logged', () => {
  const { dir, key, dat, bak } = seeded({ twice: true })
  fs.chmodSync(dir, 0o755); for (const p of [key, dat, bak]) fs.chmodSync(p, 0o644)
  const warns = []
  assert.equal(createStore({ dir, log: (m) => warns.push(m) }).load().status, 'ok')
  assert.equal(mode(dir), 0o700); for (const p of [key, dat, bak]) assert.equal(mode(p), 0o600)
  assert.ok(warns.length >= 4)
  assert.ok(!warns.join('').includes(fs.readFileSync(key).toString('base64')), 'never log the key')
})

test('tampered .dat on disk: restored from .bak and the bad file kept', () => {
  const { dir, dat } = seeded({ twice: true })
  const f = parsed(dat), ct = Buffer.from(f.ct, 'base64'); ct[0] ^= 1
  writeJson(dat, { ...f, ct: b64(ct) })
  const r = createStore({ dir }).load()
  assert.equal(r.status, 'restored'); assert.equal(typeof r.error, 'string')
  assert.equal(r.state.seq, 1); assert.equal(r.state.spawnNo, 1)
  assert.equal(fs.readdirSync(dir).filter((x) => x.startsWith('animals.dat.bad-')).length, 1)
})

test('after a restore the next save keeps the good .bak and moves on from its seq', () => {
  const { dir, dat, bak } = seeded({ twice: true })
  fs.writeFileSync(dat, 'garbage')
  const store = createStore({ dir })
  assert.equal(store.load().status, 'restored')
  const bakBefore = fs.readFileSync(bak, 'utf8')
  assert.deepEqual(store.save(sample(9)), { ok: true, seq: 2 })
  assert.equal(fs.readFileSync(bak, 'utf8'), bakBefore)
  const again = createStore({ dir }).load()
  assert.equal(again.status, 'ok'); assert.equal(again.state.spawnNo, 9)
})

test('both files bad: reset, both renamed .bad-<ts>, collection starts over', () => {
  const { dir, dat, bak } = seeded({ twice: true })
  fs.writeFileSync(dat, 'garbage'); fs.writeFileSync(bak, '{"v":1}')
  const store = createStore({ dir }), r = store.load()
  assert.equal(r.status, 'reset'); assert.equal(r.state, null); assert.equal(typeof r.error, 'string')
  assert.equal(fs.existsSync(dat), false); assert.equal(fs.existsSync(bak), false)
  const bad = fs.readdirSync(dir).filter((x) => x.includes('.bad-'))
  assert.equal(bad.length, 2)
  assert.deepEqual(bad.map((b) => fs.readFileSync(path.join(dir, b), 'utf8')).sort(), ['garbage', '{"v":1}'].sort())
  for (const b of bad) assert.equal(mode(path.join(dir, b)), 0o600)
  assert.deepEqual(store.save(sample(1)), { ok: true, seq: 1 })
  assert.equal(createStore({ dir }).load().status, 'ok')
})

test('repeated resets never overwrite an earlier .bad file', () => {
  const dir = tmp(); createStore({ dir }).load()
  const { dat } = files(dir)
  for (let i = 0; i < 3; i++) { fs.writeFileSync(dat, `bad${i}`); assert.equal(createStore({ dir }).load().status, 'reset') }
  const bad = fs.readdirSync(dir).filter((x) => x.includes('.bad-'))
  assert.deepEqual(bad.map((b) => fs.readFileSync(path.join(dir, b), 'utf8')).sort(), ['bad0', 'bad1', 'bad2'])
})

test('missing .dat with .bak present: restored, not fresh', () => {
  const { dir, dat } = seeded({ twice: true })
  fs.rmSync(dat)
  const r = createStore({ dir }).load()
  assert.equal(r.status, 'restored'); assert.equal(r.state.seq, 1)
})

test('key present but no data at all: reset (not fresh, no first-run wait)', () => {
  const dir = tmp(); createStore({ dir }).load()
  const r = createStore({ dir }).load()
  assert.equal(r.status, 'reset'); assert.equal(r.state, null)
  assert.deepEqual(fs.readdirSync(dir), ['animals.key'])
})

test('missing key with data present: disabled and no file touched', () => {
  for (const keep of [['dat', 'bak'], ['dat'], ['bak']]) {
    const { dir, key, dat, bak } = seeded({ twice: true })
    fs.rmSync(key)
    if (!keep.includes('dat')) fs.rmSync(dat)
    if (!keep.includes('bak')) fs.rmSync(bak)
    fs.chmodSync(dir, 0o755)
    const before = snapshot(dir), dirMode = mode(dir)
    const store = createStore({ dir }), r = store.load()
    assert.equal(r.status, 'disabled', keep.join()); assert.equal(r.state, null); assert.equal(typeof r.error, 'string')
    assert.deepEqual(snapshot(dir), before); assert.equal(mode(dir), dirMode)
    assert.equal(fs.existsSync(key), false)
    assert.equal(store.save(sample()).ok, false)
    assert.deepEqual(snapshot(dir), before)
    assert.throws(() => store.rand(1))
  }
})

test('wrong-length or unreadable key: disabled and no file touched', () => {
  for (const breakKey of [(k) => fs.writeFileSync(k, Buffer.alloc(31)), (k) => fs.writeFileSync(k, Buffer.alloc(33)),
    (k) => fs.writeFileSync(k, ''), (k) => { fs.rmSync(k); fs.mkdirSync(k) }]) {
    const { dir, key } = seeded({ twice: true })
    breakKey(key)
    if (fs.statSync(key).isFile()) fs.chmodSync(key, 0o644)
    const before = snapshot(dir)
    const r = createStore({ dir }).load()
    assert.equal(r.status, 'disabled'); assert.equal(r.state, null)
    assert.deepEqual(snapshot(dir), before)
  }
})

test('missing dir with no files is a fresh run', () => {
  const dir = path.join(tmp(), 'nested')
  assert.equal(createStore({ dir }).load().status, 'fresh')
  assert.equal(mode(dir), 0o700)
})

test('seq conflict: a stale store does not overwrite a newer file', () => {
  const { dir, dat } = seeded()
  const a = createStore({ dir }), b = createStore({ dir })
  assert.equal(a.load().status, 'ok'); assert.equal(b.load().status, 'ok')
  assert.deepEqual(a.save(sample(5)), { ok: true, seq: 2 })
  const after = fs.readFileSync(dat, 'utf8')
  const r = b.save(sample(6))
  assert.equal(r.conflict, true); assert.notEqual(r.ok, true)
  assert.equal(fs.readFileSync(dat, 'utf8'), after)
  const re = b.load(); assert.equal(re.state.spawnNo, 5)
  assert.deepEqual(b.save(sample(6)), { ok: true, seq: 3 })
})

test('save rejects misuse: before load, non-object state', () => {
  const dir = tmp(), store = createStore({ dir })
  assert.equal(store.save(sample()).ok, false)
  assert.throws(() => store.rand(1))
  store.load()
  for (const s of [null, [], 'x', 1]) assert.throws(() => store.save(s), TypeError)
})

test('createStore validates its options', () => {
  for (const o of [{}, { dir: '' }, { dir: 'x', name: '../evil' }, { dir: 'x', name: 'a/b' }, { dir: 'x', name: '' }, { dir: 'x', aad: '' }]) {
    assert.throws(() => createStore(o), TypeError, JSON.stringify(o))
  }
})

test('save falls back to copying when hard links fail', () => {
  const { dir, store, bak } = seeded()
  const orig = fs.linkSync
  fs.linkSync = () => { const e = new Error('EPERM'); e.code = 'EPERM'; throw e }
  try { assert.deepEqual(store.save(sample(2)), { ok: true, seq: 2 }) } finally { fs.linkSync = orig }
  assert.equal(mode(bak), 0o600)
  assert.equal(decrypt(fs.readFileSync(files(dir).key), fs.readFileSync(bak, 'utf8'), AAD).seq, 1)
  assert.equal(createStore({ dir }).load().state.seq, 2)
})

test('a failing write leaves the old file and no temp file', () => {
  const { dir, store, dat } = seeded()
  const before = fs.readFileSync(dat, 'utf8'), orig = fs.renameSync
  fs.renameSync = () => { const e = new Error('EIO'); e.code = 'EIO'; throw e }
  let r
  try { r = store.save(sample(2)) } finally { fs.renameSync = orig }
  assert.equal(r.ok, false); assert.equal(typeof r.error, 'string')
  assert.equal(fs.readFileSync(dat, 'utf8'), before)
  assert.deepEqual(fs.readdirSync(dir).filter((x) => x.includes('tmp')), [])
})

// Kills a child process at the n-th fs call inside save(); returns its exit code.
const CRASH_CHILD = `
const fs = require('fs'), [modPath, dir, n] = process.argv.slice(1)
const { createStore } = require(modPath)
const store = createStore({ dir }); store.load()
let i = 0
for (const fn of ['openSync', 'writeSync', 'writeFileSync', 'fsyncSync', 'closeSync', 'linkSync', 'copyFileSync', 'renameSync', 'unlinkSync', 'chmodSync']) {
  const orig = fs[fn]; fs[fn] = function (...a) { if (++i === Number(n)) process.exit(9); return orig.apply(this, a) }
}
const r = store.save({ seq: 0, spawnNo: 3, marker: 'new' })
process.exit(r.ok ? 0 : 1)`

test('a crash at any step of save leaves a valid file (old or new)', () => {
  let completed = false
  for (let n = 1; n < 60 && !completed; n++) {
    for (const twice of [false, true]) {
      const { dir } = seeded({ twice })
      const res = spawnSync(process.execPath, ['-e', CRASH_CHILD, STORE_PATH, dir, String(n)], { encoding: 'utf8' })
      assert.ok(res.status === 9 || res.status === 0, `n=${n} status=${res.status} ${res.stderr}`)
      if (res.status === 0) completed = true
      const r = createStore({ dir }).load()
      assert.ok(r.status === 'ok' || r.status === 'restored', `n=${n} twice=${twice} -> ${r.status}`)
      const oldSeq = twice ? 2 : 1
      assert.ok(r.state.seq === oldSeq || (r.state.seq === oldSeq + 1 && r.state.marker === 'new'), `n=${n} seq=${r.state.seq}`)
      if (res.status === 0) assert.equal(r.state.marker, 'new')
    }
  }
  assert.ok(completed, 'save eventually completes without a crash')
})

// ---- rand ----

test('rand: two numbers in [0,1), deterministic per key and spawnNo, from HMAC-SHA256', () => {
  const { dir, store, key } = seeded()
  const k = fs.readFileSync(key)
  for (const n of [0, 1, 2, 37, 1e6]) {
    const r = store.rand(n)
    assert.equal(r.length, 2)
    for (const u of r) assert.ok(u >= 0 && u < 1)
    assert.deepEqual(store.rand(n), r)
    const h = crypto.createHmac('sha256', k).update('spawn:' + n).digest()
    assert.deepEqual(r, [h.readUIntBE(0, 6) / 2 ** 48, h.readUIntBE(6, 6) / 2 ** 48])
  }
  const other = createStore({ dir }); other.load()
  assert.deepEqual(other.rand(37), store.rand(37))
  assert.notDeepEqual(store.rand(1), store.rand(2))
  const fresh = createStore({ dir: tmp() }); fresh.load()
  assert.notDeepEqual(fresh.rand(1), store.rand(1))
  for (const bad of [-1, 1.5, NaN, '1', null, undefined, 2 ** 53]) assert.throws(() => store.rand(bad), TypeError, String(bad))
})

test('rand is spread roughly uniformly', () => {
  const { store } = seeded()
  let s1 = 0, s2 = 0
  const N = 4000
  for (let i = 0; i < N; i++) { const [a, b] = store.rand(i); s1 += a; s2 += b }
  assert.ok(Math.abs(s1 / N - 0.5) < 0.03); assert.ok(Math.abs(s2 / N - 0.5) < 0.03)
})

// ---- key creation races ----

test('losing the key-creation race reads the winner key instead of making a second one', () => {
  const dir = tmp(), { key } = files(dir), winner = key32()
  const orig = fs.openSync
  fs.openSync = function (p, flags, ...rest) {
    if (p === key && flags === 'wx') { fs.writeFileSync(key, winner, { mode: 0o600 }); fs.openSync = orig }
    return orig.call(this, p, flags, ...rest)
  }
  let r, store
  try { store = createStore({ dir }); r = store.load() } finally { fs.openSync = orig }
  assert.equal(r.status, 'fresh')
  assert.deepEqual(fs.readFileSync(key), winner)
  const h = crypto.createHmac('sha256', winner).update('spawn:7').digest()
  assert.deepEqual(store.rand(7), [h.readUIntBE(0, 6) / 2 ** 48, h.readUIntBE(6, 6) / 2 ** 48])
})

test('a key another process is still writing is waited for, not treated as broken', async () => {
  const dir = tmp(); fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const { key } = files(dir), winner = key32()
  fs.writeFileSync(key, '', { mode: 0o600 })
  const writer = `setTimeout(() => require('fs').writeFileSync(process.argv[1], Buffer.from(process.argv[2], 'hex')), 50)`
  const child = execFile(process.execPath, ['-e', writer, key, winner.toString('hex')])
  const done = new Promise((resolve) => child.on('exit', resolve))
  const store = createStore({ dir }), r = store.load()
  await done
  assert.notEqual(r.status, 'disabled')
  const h = crypto.createHmac('sha256', winner).update('spawn:1').digest()
  assert.deepEqual(store.rand(1), [h.readUIntBE(0, 6) / 2 ** 48, h.readUIntBE(6, 6) / 2 ** 48])
})

const RACE_CHILD = `
const [modPath, dir, at] = process.argv.slice(1)
const { createStore } = require(modPath)
while (Date.now() < Number(at)) {}
const s = createStore({ dir }), r = s.load()
process.stdout.write(JSON.stringify({ status: r.status, u: r.status === 'disabled' ? null : s.rand(1) }))`

test('concurrent first runs in separate processes produce exactly one key', async () => {
  for (let round = 0; round < 3; round++) {
    const dir = tmp(), at = Date.now() + 400
    const run = () => new Promise((resolve, reject) => execFile(process.execPath, ['-e', RACE_CHILD, STORE_PATH, dir, String(at)],
      (err, out) => (err ? reject(err) : resolve(JSON.parse(out)))))
    const results = await Promise.all(Array.from({ length: 6 }, run))
    assert.deepEqual(fs.readdirSync(dir), ['animals.key'])
    assert.equal(fs.readFileSync(path.join(dir, 'animals.key')).length, 32)
    // A late child sees a finished key and no data, which is 'reset'; nobody may be disabled.
    for (const r of results) { assert.ok(['fresh', 'reset'].includes(r.status), r.status); assert.deepEqual(r.u, results[0].u) }
    assert.ok(results.some((r) => r.status === 'fresh'))
  }
})

// ---- dev isolation ----

test('dev store is isolated from the real one in both directions', () => {
  const { dir, dat } = seeded({ twice: true })
  const DEV = { name: 'animals-dev', aad: 'ai-terrarium/animals-dev' }
  const dev = createStore({ dir, ...DEV })
  assert.equal(dev.load().status, 'fresh')
  assert.deepEqual(dev.save(sample(4)), { ok: true, seq: 1 })
  assert.ok(fs.existsSync(path.join(dir, 'animals-dev.key'))); assert.ok(fs.existsSync(path.join(dir, 'animals-dev.dat')))

  const realKey = fs.readFileSync(path.join(dir, 'animals.key')), devKey = fs.readFileSync(path.join(dir, 'animals-dev.key'))
  const realFile = fs.readFileSync(dat, 'utf8'), devFile = fs.readFileSync(path.join(dir, 'animals-dev.dat'), 'utf8')
  assert.notDeepEqual(realKey, devKey)
  // Even with the right key, the other aad fails.
  assert.equal(decrypt(realKey, realFile, DEV.aad), null)
  assert.equal(decrypt(devKey, devFile, AAD), null)
  assert.equal(decrypt(devKey, realFile, DEV.aad), null)

  // Real data copied over the dev files (key included) is still unreadable for the dev store.
  const dir2 = tmp(); fs.mkdirSync(dir2, { recursive: true, mode: 0o700 })
  fs.writeFileSync(path.join(dir2, 'animals-dev.key'), realKey, { mode: 0o600 })
  fs.writeFileSync(path.join(dir2, 'animals-dev.dat'), realFile, { mode: 0o600 })
  const r = createStore({ dir: dir2, ...DEV }).load()
  assert.equal(r.status, 'reset'); assert.equal(r.state, null)

  const real = createStore({ dir }).load()
  assert.equal(real.status, 'ok'); assert.equal(real.state.spawnNo, 2)
})

// ---- review findings: validation, read errors, conflicts and the save lock ----

const validCaught = (s) => (Array.isArray(s.caught) ? s : null)
const badFiles = (dir) => fs.readdirSync(dir).filter((x) => x.includes('.bad-')).sort()
const keyOf = (dir) => fs.readFileSync(files(dir).key)
const encryptTo = (dir, p, obj) => fs.writeFileSync(p, encrypt(keyOf(dir), obj, AAD), { mode: 0o600 })

// Makes fs.readFileSync throw `code` for one path only.
function withReadError(target, code, fn) {
  const orig = fs.readFileSync
  fs.readFileSync = function (p, ...rest) {
    if (p === target) { const e = new Error(code); e.code = code; throw e }
    return orig.call(this, p, ...rest)
  }
  try { return fn() } finally { fs.readFileSync = orig }
}

test('an authenticated .dat that fails validation is moved aside and the valid .bak restored', () => {
  const { dir, dat } = seeded({ twice: true })
  encryptTo(dir, dat, { seq: 2, spawnNo: 3, caught: { legacy: 'shape' }, total: 42 })
  const original = fs.readFileSync(dat, 'utf8')
  const r = createStore({ dir }).load({ validate: validCaught })
  assert.equal(r.status, 'restored'); assert.equal(r.state.seq, 1)
  const bad = badFiles(dir)
  assert.equal(bad.length, 1)
  assert.equal(fs.readFileSync(path.join(dir, bad[0]), 'utf8'), original)
})

test('both files authenticated but invalid: reset and both kept as .bad', () => {
  const { dir, dat, bak } = seeded({ twice: true })
  encryptTo(dir, dat, { seq: 2, spawnNo: 3, caught: { legacy: 'shape' }, total: 42 })
  encryptTo(dir, bak, { seq: 1, spawnNo: 2, caught: 'old', total: 41 })
  const store = createStore({ dir }), r = store.load({ validate: validCaught })
  assert.equal(r.status, 'reset'); assert.equal(r.error, 'corrupt')
  assert.equal(badFiles(dir).length, 2)
  assert.deepEqual(store.save(sample(1)), { ok: true, seq: 1 })
  const totals = badFiles(dir).map((b) => decrypt(keyOf(dir), fs.readFileSync(path.join(dir, b), 'utf8'), AAD).total).sort()
  assert.deepEqual(totals, [41, 42])
})

test('a throwing validate counts as invalid, never crashes load', () => {
  const { dir } = seeded({ twice: true })
  const r = createStore({ dir }).load({ validate: () => { throw new Error('boom') } })
  assert.equal(r.status, 'reset')
})

test('keepCopy writes the exact bytes that were loaded to a new .bad file', () => {
  const { dir, dat } = seeded({ twice: true })
  const store = createStore({ dir })
  assert.equal(store.load().status, 'ok')
  const loaded = fs.readFileSync(dat, 'utf8')
  assert.equal(store.keepCopy(), true)
  assert.equal(store.keepCopy(), true)
  const bad = badFiles(dir)
  assert.equal(bad.length, 2, 'never overwrites an earlier copy')
  for (const b of bad) { assert.equal(fs.readFileSync(path.join(dir, b), 'utf8'), loaded); assert.equal(mode(path.join(dir, b)), 0o600) }
  assert.equal(fs.readFileSync(dat, 'utf8'), loaded)
})

test('keepCopy with nothing loaded returns false', () => {
  const dir = tmp(), store = createStore({ dir })
  assert.equal(store.keepCopy(), false)
  store.load()
  assert.equal(store.keepCopy(), false)
})

test('a read error on .dat (not ENOENT) disables the load and moves nothing', () => {
  for (const code of ['EIO', 'EACCES', 'EMFILE']) {
    const { dir, dat } = seeded({ twice: true })
    const before = snapshot(dir)
    const r = withReadError(dat, code, () => createStore({ dir }).load())
    assert.equal(r.status, 'disabled', code); assert.equal(r.error, 'io')
    assert.deepEqual(snapshot(dir), before, code)
    assert.equal(createStore({ dir }).load().state.spawnNo, 2, 'newest data still there')
  }
})

test('a read error on .bak while .dat is bad disables the load and moves nothing', () => {
  const { dir, dat, bak } = seeded({ twice: true })
  fs.writeFileSync(dat, 'garbage')
  const before = snapshot(dir)
  const r = withReadError(bak, 'EIO', () => createStore({ dir }).load())
  assert.equal(r.status, 'disabled'); assert.equal(r.error, 'io')
  assert.deepEqual(snapshot(dir), before)
})

test('a read error on .dat during save writes nothing and reports io', () => {
  const { dir, store, dat, bak } = seeded({ twice: true })
  const datBefore = fs.readFileSync(dat, 'utf8'), bakBefore = fs.readFileSync(bak, 'utf8')
  const r = withReadError(dat, 'EIO', () => store.save(sample(3)))
  assert.deepEqual(r, { ok: false, error: 'io' })
  assert.equal(fs.readFileSync(dat, 'utf8'), datBefore)
  assert.equal(fs.readFileSync(bak, 'utf8'), bakBefore)
  assert.deepEqual(fs.readdirSync(dir).filter((x) => x.includes('tmp') || x.endsWith('.lock')), [])
  assert.deepEqual(store.save(sample(3)), { ok: true, seq: 3 }, 'retries cleanly once the error is gone')
})

test('conflict when another store restored and rewrote the same seq', () => {
  const dir = tmp(), a = createStore({ dir })
  a.load()
  for (let i = 1; i <= 3; i++) assert.equal(a.save({ who: `A${i}` }).ok, true)
  fs.writeFileSync(files(dir).dat, 'garbage')
  const b = createStore({ dir })
  assert.equal(b.load().status, 'restored')
  assert.deepEqual(b.save({ who: 'B-catch' }), { ok: true, seq: 3 })
  const r = a.save({ who: 'A4' })
  assert.equal(r.conflict, true); assert.notEqual(r.ok, true)
  assert.equal(createStore({ dir }).load().state.who, 'B-catch')
})

test('conflict when the on-disk seq went backwards', () => {
  const { dir, store, dat, bak } = seeded({ twice: true })
  fs.copyFileSync(bak, dat)
  const r = store.save(sample(3))
  assert.equal(r.conflict, true)
  assert.equal(createStore({ dir }).load().state.seq, 1)
})

test('conflict when a .dat appears that this store did not expect', () => {
  const { dir, dat } = seeded({ twice: true })
  fs.writeFileSync(dat, 'garbage')
  const store = createStore({ dir })
  assert.equal(store.load().status, 'restored')
  fs.writeFileSync(dat, 'other garbage')
  assert.equal(store.save(sample(3)).conflict, true)
  assert.equal(fs.readFileSync(dat, 'utf8'), 'other garbage')
})

test('save holds <name>.lock and removes it afterwards', () => {
  const { dir, store } = seeded()
  const orig = fs.renameSync
  let held = false
  fs.renameSync = function (...a) { held = held || fs.existsSync(path.join(dir, 'animals.lock')); return orig.apply(this, a) }
  try { assert.equal(store.save(sample(2)).ok, true) } finally { fs.renameSync = orig }
  assert.equal(held, true)
  assert.equal(fs.existsSync(path.join(dir, 'animals.lock')), false)
})

test('a fresh lock held by a live process makes save report busy and write nothing', () => {
  const { dir, store, dat, bak } = seeded({ twice: true })
  const lock = path.join(dir, 'animals.lock')
  fs.writeFileSync(lock, String(process.ppid))
  const datBefore = fs.readFileSync(dat, 'utf8'), bakBefore = fs.readFileSync(bak, 'utf8')
  assert.deepEqual(store.save(sample(3)), { ok: false, error: 'busy' })
  assert.equal(fs.readFileSync(dat, 'utf8'), datBefore); assert.equal(fs.readFileSync(bak, 'utf8'), bakBefore)
  assert.equal(fs.readFileSync(lock, 'utf8'), String(process.ppid), 'someone else\'s lock is left alone')
})

test('a lock older than 10 s is broken', () => {
  const { dir, store } = seeded()
  const lock = path.join(dir, 'animals.lock')
  fs.writeFileSync(lock, String(process.ppid))
  const old = (Date.now() - 11e3) / 1000
  fs.utimesSync(lock, old, old)
  assert.deepEqual(store.save(sample(2)), { ok: true, seq: 2 })
  assert.equal(fs.existsSync(lock), false)
})

test('a lock left by an exited process is broken', () => {
  const { dir, store } = seeded()
  const dead = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout
  fs.writeFileSync(path.join(dir, 'animals.lock'), dead)
  assert.deepEqual(store.save(sample(2)), { ok: true, seq: 2 })
})
