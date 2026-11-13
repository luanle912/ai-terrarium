'use strict'
// Encrypted, authenticated animal state on disk (<dir>/<name>.key + <name>.dat, AES-256-GCM).
const fs = require('fs'), path = require('path'), crypto = require('crypto')

const V = 1, ALG = 'A256GCM', KEY_LEN = 32, IV_LEN = 12, TAG_LEN = 16
const HEADER_KEYS = ['alg', 'ct', 'iv', 'tag', 'v']
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/
const KEY_RETRIES = 100, KEY_RETRY_MS = 10
// Short: sleepSync blocks the server's event loop while it waits.
const LOCK_RETRIES = 20, LOCK_RETRY_MS = 10, LOCK_STALE_MS = 10e3
const ABSENT = 'absent', UNREADABLE = 'unreadable'

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isKey = (k) => Buffer.isBuffer(k) && k.length === KEY_LEN
// v and alg are bound into the tag so a rewritten header fails authentication.
const aadBytes = (aad, v, alg) => Buffer.from(JSON.stringify([aad, v, alg]))

function encrypt(key, obj, aad) {
  if (!isKey(key)) throw new TypeError('key must be a 32-byte Buffer')
  const iv = crypto.randomBytes(IV_LEN)
  const c = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LEN })
  c.setAAD(aadBytes(aad, V, ALG))
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()])
  return JSON.stringify({ v: V, alg: ALG, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), ct: ct.toString('base64') })
}

// Strict base64: the string must be exactly what re-encoding its bytes gives back.
function strictB64(s) {
  if (typeof s !== 'string') return null
  const buf = Buffer.from(s, 'base64')
  return buf.toString('base64') === s ? buf : null
}

function parseHeader(fileJson) {
  let f = fileJson
  if (typeof f === 'string') { try { f = JSON.parse(f) } catch { return null } }
  if (!isPlainObject(f) || Object.keys(f).sort().join() !== HEADER_KEYS.join()) return null
  if (f.v !== V || f.alg !== ALG) return null
  const iv = strictB64(f.iv), tag = strictB64(f.tag), ct = strictB64(f.ct)
  if (!iv || !tag || !ct || iv.length !== IV_LEN || tag.length !== TAG_LEN || ct.length === 0) return null
  return { v: f.v, alg: f.alg, iv, tag, ct }
}

// Returns the decrypted object, or null on any failure; never throws.
function decrypt(key, fileJson, aad) {
  if (!isKey(key) || typeof aad !== 'string') return null
  const h = parseHeader(fileJson)
  if (!h) return null
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', key, h.iv, { authTagLength: TAG_LEN })
    d.setAAD(aadBytes(aad, h.v, h.alg))
    d.setAuthTag(h.tag)
    const obj = JSON.parse(Buffer.concat([d.update(h.ct), d.final()]).toString('utf8'))
    return isPlainObject(obj) ? obj : null
  } catch { return null }
}

const exists = (p) => { try { fs.lstatSync(p); return true } catch { return false } }
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

function readKey(p) {
  try { const k = fs.readFileSync(p); return isKey(k) ? { key: k } : { error: 'key-length' } }
  catch { return { error: 'key-unreadable' } }
}

function tightenModes(entries, log) {
  for (const [p, want] of entries) {
    try {
      const cur = fs.statSync(p).mode & 0o777
      if (cur & ~want) { fs.chmodSync(p, want); log(`terrarium: tightened ${p} from ${cur.toString(8)} to ${want.toString(8)}`) }
    } catch {}
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  fs.chmodSync(dir, 0o700)
}

// Creates the key with 'wx'; a process that loses the race reads the winner's key instead.
function createKey(file) {
  let fd
  try { fd = fs.openSync(file, 'wx', 0o600) } catch (e) {
    if (e.code !== 'EEXIST') return { error: 'key-create' }
    return waitForKey(file)
  }
  try {
    fs.writeSync(fd, crypto.randomBytes(KEY_LEN))
    fs.fsyncSync(fd)
    return readKey(file)
  } catch { return { error: 'key-create' } } finally { fs.closeSync(fd) }
}

// The winner may not have written its bytes yet.
function waitForKey(file) {
  let r = readKey(file)
  for (let i = 0; i < KEY_RETRIES && r.error; i++) { sleepSync(KEY_RETRY_MS); r = readKey(file) }
  return r
}

const digest = (raw) => crypto.createHash('sha256').update(raw).digest('hex')

// kind: 'ok' (authenticated) | 'bad' (present, not authentic) | 'missing' | 'io' (any other read error).
function readState(file, key, aad) {
  let raw
  try { raw = fs.readFileSync(file, 'utf8') } catch (e) { return { kind: e.code === 'ENOENT' ? 'missing' : 'io', code: e.code } }
  const s = decrypt(key, raw, aad)
  return s && Number.isSafeInteger(s.seq) && s.seq >= 0 ? { kind: 'ok', state: s, raw } : { kind: 'bad' }
}

// What a later save expects to find at .dat: the exact bytes last seen, or nothing.
const diskId = (r) => (r.kind === 'ok' ? digest(r.raw) : r.kind === 'missing' ? ABSENT : UNREADABLE)

function badName(file) {
  const ts = Date.now()
  let target = `${file}.bad-${ts}`
  for (let i = 1; exists(target); i++) target = `${file}.bad-${ts}-${i}`
  return target
}

// Keeps a broken file for inspection under a name that never overwrites an earlier one.
function moveAside(file, log) {
  const target = badName(file)
  try { fs.renameSync(file, target); log(`terrarium: kept unreadable ${path.basename(file)} as ${path.basename(target)}`) }
  catch (e) { log(`terrarium: could not move ${path.basename(file)} aside: ${e.code || e.message}`) }
}

const pidAlive = (pid) => { try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' } }

function lockIsStale(file) {
  try {
    if (Date.now() - fs.statSync(file).mtimeMs > LOCK_STALE_MS) return true
    const pid = Number(fs.readFileSync(file, 'utf8'))
    return Number.isSafeInteger(pid) && pid > 0 && pid !== process.pid && !pidAlive(pid)
  } catch { return false }
}

function tryCreateLock(file) {
  let fd
  try { fd = fs.openSync(file, 'wx', 0o600) } catch (e) { return e.code === 'EEXIST' ? 'held' : 'error' }
  try { fs.writeSync(fd, String(process.pid)); return 'ok' } catch {
    try { fs.rmSync(file, { force: true }) } catch {}
    return 'error'
  } finally { fs.closeSync(fd) }
}

// Advisory lock across processes; returns false when another live holder keeps it.
function acquireLock(file) {
  for (let i = 0; i <= LOCK_RETRIES; i++) {
    const r = tryCreateLock(file)
    if (r !== 'held') return r === 'ok'
    if (lockIsStale(file)) { try { fs.rmSync(file, { force: true }) } catch {} continue }
    sleepSync(LOCK_RETRY_MS)
  }
  return false
}

// Only removes the lock while it is still ours, never one taken after ours was broken.
function releaseLock(file) {
  try { if (fs.readFileSync(file, 'utf8') === String(process.pid)) fs.rmSync(file, { force: true }) } catch {}
}

function fsyncDir(dir) {
  let fd
  try { fd = fs.openSync(dir, 'r'); fs.fsyncSync(fd) } catch {} finally { if (fd !== undefined) try { fs.closeSync(fd) } catch {} }
}

function writeFileDurable(file, data) {
  const fd = fs.openSync(file, 'wx', 0o600)
  try { fs.writeSync(fd, data); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  fs.chmodSync(file, 0o600)
}

// Replaces .bak with the current .dat: hard link when possible, else a durable copy.
function rotateBackup(dat, bak, tmpName) {
  const t = tmpName('bak')
  try {
    try { fs.linkSync(dat, t) } catch { copyDurable(dat, t) }
    fs.renameSync(t, bak)
  } catch (e) {
    try { fs.rmSync(t, { force: true }) } catch {}
    throw e
  }
}

function copyDurable(src, dst) {
  fs.copyFileSync(src, dst, fs.constants.COPYFILE_EXCL)
  fs.chmodSync(dst, 0o600)
  const fd = fs.openSync(dst, 'r')
  try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}

function validateOptions({ dir, name, aad }) {
  if (typeof dir !== 'string' || !dir) throw new TypeError('createStore: dir is required')
  if (typeof name !== 'string' || !NAME_RE.test(name)) throw new TypeError('createStore: invalid name')
  if (typeof aad !== 'string' || !aad) throw new TypeError('createStore: invalid aad')
}

function isValid(validate, state) {
  try { return validate(state) != null } catch { return false }
}

function ioFailure(log, file, code) {
  log(`terrarium: reading ${path.basename(file)} failed: ${code || 'unknown'}; will retry`)
  return { status: 'disabled', state: null, error: 'io' }
}

// Decides ok / restored / reset with a valid key: { status, state, error?, disk, from? }.
// A read error other than ENOENT is never taken as tampering, so nothing is moved.
function loadWithKey(ctx, k) {
  const { dir, name, aad, log, files, validate } = ctx
  tightenModes([[dir, 0o700], [files.key, 0o600], [files.dat, 0o600], [files.bak, 0o600]], log)
  const main = readState(files.dat, k, aad)
  if (main.kind === 'io') return ioFailure(log, files.dat, main.code)
  if (main.kind === 'ok' && isValid(validate, main.state)) return { status: 'ok', state: main.state, disk: diskId(main), from: { file: files.dat, raw: main.raw } }
  const backup = readState(files.bak, k, aad)
  if (backup.kind === 'io') return ioFailure(log, files.bak, backup.code)
  const hadDat = main.kind !== 'missing', hadBak = backup.kind !== 'missing'
  if (hadDat) moveAside(files.dat, log)
  const disk = diskId(readState(files.dat, k, aad))
  if (backup.kind === 'ok' && isValid(validate, backup.state)) {
    log(`terrarium: ${name}.dat ${hadDat ? 'unreadable' : 'missing'}, restored from backup`)
    return { status: 'restored', state: backup.state, error: hadDat ? 'dat-corrupt' : 'dat-missing', disk, from: { file: files.bak, raw: backup.raw } }
  }
  if (hadBak) moveAside(files.bak, log)
  return { status: 'reset', state: null, error: hadDat || hadBak ? 'corrupt' : 'missing', disk }
}

function loadFresh(ctx) {
  const { dir, log, files } = ctx
  try { ensureDir(dir) } catch { return { error: 'dir-create' } }
  const r = createKey(files.key)
  if (r.error) return r
  tightenModes([[dir, 0o700], [files.key, 0o600]], log)
  // A racing process may have written data already.
  const hasData = exists(files.dat) || exists(files.bak)
  return { key: r.key, result: hasData ? loadWithKey(ctx, r.key) : { status: 'fresh', state: null, disk: ABSENT } }
}

// Returns { key, result } or { error } for the disabled case; touches no file when disabled.
function openStore(ctx) {
  const { files } = ctx
  const hasData = () => exists(files.dat) || exists(files.bak)
  if (!exists(files.key)) return hasData() ? { error: 'key-missing' } : loadFresh(ctx)
  let r = readKey(files.key)
  // A first-run key another process is still writing; never wait when data exists.
  if (r.error === 'key-length' && !hasData()) r = waitForKey(files.key)
  return r.error ? r : { key: r.key, result: loadWithKey(ctx, r.key) }
}

function writeState(ctx, data, rotate) {
  const { dir, files, tmpName } = ctx
  const tmp = tmpName('dat')
  try {
    writeFileDurable(tmp, data)
    // Only a readable .dat may replace .bak, so a good backup is never lost.
    if (rotate) rotateBackup(files.dat, files.bak, tmpName)
    fs.renameSync(tmp, files.dat)
    fsyncDir(dir)
    return null
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }) } catch {}
    return e
  }
}

function createStore({ dir, name = 'animals', aad = 'ai-terrarium/animals', log = () => {} } = {}) {
  validateOptions({ dir, name, aad })
  const files = { key: path.join(dir, `${name}.key`), dat: path.join(dir, `${name}.dat`), bak: path.join(dir, `${name}.dat.bak`),
    lock: path.join(dir, `${name}.lock`) }
  const tmpName = (tag) => path.join(dir, `.${name}.${tag}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`)
  const ctx = { dir, name, aad, log, files, tmpName }
  // disk: identity of the .dat this store last loaded or wrote; from: bytes the loaded state came from.
  let key = null, seq = 0, disk = ABSENT, from = null

  // validate(state) returns null for a state the caller cannot use; it is then handled like a corrupt file.
  function load({ validate = (s) => s } = {}) {
    const r = openStore({ ...ctx, validate })
    const failed = r.error || r.result.status === 'disabled'
    key = failed ? null : r.key
    seq = !failed && r.result.state ? r.result.state.seq : 0
    disk = failed ? ABSENT : r.result.disk
    from = failed ? null : r.result.from || null
    if (r.error) return { status: 'disabled', state: null, error: r.error }
    const { disk: _d, from: _f, ...result } = r.result
    return result
  }

  function saveLocked(state) {
    const onDisk = readState(files.dat, key, aad)
    if (onDisk.kind === 'io') { log(`terrarium: reading ${name}.dat before save failed: ${onDisk.code}`); return { ok: false, error: 'io' } }
    if (diskId(onDisk) !== disk || (onDisk.kind === 'ok' && onDisk.state.seq !== seq)) return { ok: false, conflict: true }
    const next = { ...state, seq: seq + 1 }
    const data = encrypt(key, next, aad)
    const err = writeState(ctx, data, onDisk.kind === 'ok')
    if (err) { log(`terrarium: saving ${name}.dat failed: ${err.code || err.message}`); return { ok: false, error: 'io' } }
    seq = next.seq; disk = digest(data); from = { file: files.dat, raw: data }
    return { ok: true, seq }
  }

  function save(state) {
    if (!key) return { ok: false, error: 'not-loaded' }
    if (!isPlainObject(state)) throw new TypeError('save: state must be an object')
    if (!acquireLock(files.lock)) { log(`terrarium: ${name}.lock is held by another process`); return { ok: false, error: 'busy' } }
    try { return saveLocked(state) } finally { releaseLock(files.lock) }
  }

  // Keeps the bytes of the last load as <file>.bad-<ts> before a lossy state replaces them.
  function keepCopy() {
    if (!from) return false
    const target = badName(from.file)
    try { writeFileDurable(target, from.raw) } catch (e) {
      log(`terrarium: could not keep a copy of ${path.basename(from.file)}: ${e.code || e.message}`)
      return false
    }
    log(`terrarium: kept a copy of ${path.basename(from.file)} as ${path.basename(target)}`)
    return true
  }

  function rand(spawnNo) {
    if (!key) throw new Error('rand: store not loaded')
    if (!Number.isSafeInteger(spawnNo) || spawnNo < 0) throw new TypeError('rand: spawnNo must be a non-negative integer')
    const h = crypto.createHmac('sha256', key).update('spawn:' + spawnNo).digest()
    return [h.readUIntBE(0, 6) / 2 ** 48, h.readUIntBE(6, 6) / 2 ** 48]
  }

  return { load, save, rand, keepCopy }
}

module.exports = { createStore, encrypt, decrypt }
