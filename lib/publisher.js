'use strict'
// Local publisher: sends the publicView of this machine's island to the hub, and the `join` pairing flow.
// Only the output of createPublicView ever leaves the machine; usage and cwd are never read here.
//
// Publish reply contract (POST /api/publish):
//   request header `x-terrarium-instance: <16 hex>`, random per startPublisher, so the hub can tell two publishers on
//   one machine (two local servers sharing ~/.claude-terrarium) apart and let only the newest one publish.
//   200 {accepted: true}                                    -> sent
//   200 {accepted: false, reason: 'stale_seq', seq: <n>}    -> resume at n + 1 (resend at most once per STALE_RESEND_MS)
//   200 {accepted: false, reason: 'other_instance'}         -> 'standby', retry after HEARTBEAT_MS with the same seq
//   204 (older hub)                                         -> sent (legacy ack)
//   400/413                                                 -> NOT sent: 'rejected', log the reason, retry after REJECT_WAIT_MS
// The body stays exactly {v, seq, share, sessions} (+ private): older hubs answer 400 to any unknown key, so new
// information travels in headers only.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto')
const { createPublicView, DEPT_LETTERS } = require('./public-view.js')
const { readConfig, writeConfig, validHubUrl, clean } = require('./terrarium-config.js')

const TICK_MS = 500          // also the minimum gap between two sends (max 2/s)
const HEARTBEAT_MS = 30000
const CONFIG_CHECK_MS = 2000
const SALT_RE = /^[0-9a-f]{64}$/i
const BACKOFF_MIN = 2000, BACKOFF_MAX = 15000
const WAKE_GAP_MS = 10000      // a gap this long between two ticks means the machine slept: start over at once
const LOGIN_WAIT_MS = 60000    // paused: the owner has to sign in to the hub again
const REVOKE_TIMEOUT_MS = 5000
const REJECT_WAIT_MS = 15000   // the hub refused the packet (400/413): retry, but never spin on it
const STALE_RESEND_MS = 10000  // at most one immediate resend per seq jump window after 'stale_seq'
const SLOW_LOG_MS = 60000      // 429 is logged at most once a minute
const SUMMARY_LOG_MS = 60000   // while failing, one "still <state>" summary a minute instead of a line per try
const JOIN_FETCH_MS = 15000    // each request of the pairing flow gives up after this long
const ROOM_TOUCH_MS = 60000    // a room's `at` is rewritten at most once a minute
const ROOMS_MAX = 64           // rooms.json keeps at most this many keys (the least recently seen go first)
const ROOM_KEY_RE = /^[0-9a-f]{12}$/

// Room letters kept in <dir>/rooms.json so a project keeps its letter across restarts and across two local servers.
// The file holds only the HMAC keys from createPublicView (never a project name): {v: 1, rooms: {<key>: {letter, at}}}.
// Never throws: when the file cannot be written the letters live in memory only.
function fileLetterStore(dir, { now = Date.now } = {}) {
  const file = path.join(dir, 'rooms.json')
  let rooms = {}, sig = null
  const stamp = () => { try { const s = fs.statSync(file); return `${s.ino}:${s.size}:${s.mtimeMs}` } catch { return null } }

  function save() {
    const keys = Object.keys(rooms)
    if (keys.length > ROOMS_MAX) keys.sort((a, b) => rooms[a].at - rooms[b].at).slice(0, keys.length - ROOMS_MAX).forEach((k) => delete rooms[k])
    const tmpFile = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
      fs.writeFileSync(tmpFile, JSON.stringify({ v: 1, rooms }), { mode: 0o600 })
      fs.renameSync(tmpFile, file)
      sig = stamp()
    } catch { try { fs.unlinkSync(tmpFile) } catch {} }
  }

  // Rereads the file when another process (or a restart) changed it. A broken file counts as empty and is rewritten.
  function load() {
    const s = stamp()
    if (s === null || s === sig) return
    sig = s
    rooms = {}
    let ok = false
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (j && j.v === 1 && j.rooms && typeof j.rooms === 'object') {
        ok = true
        for (const [k, e] of Object.entries(j.rooms)) {
          if (ROOM_KEY_RE.test(k) && e && typeof e.letter === 'string' && e.letter.length === 1 && DEPT_LETTERS.includes(e.letter) && Number.isFinite(e.at)) rooms[k] = { letter: e.letter, at: e.at }
        }
      }
    } catch {}
    if (!ok) save()
  }

  return {
    get(key) {
      load()
      const e = Object.prototype.hasOwnProperty.call(rooms, key) ? rooms[key] : null
      if (!e) return undefined
      const t = now()
      if (t - e.at >= ROOM_TOUCH_MS) { e.at = t; save() }
      return e.letter
    },
    assign(key) {
      load()
      if (Object.prototype.hasOwnProperty.call(rooms, key)) return rooms[key].letter
      const entries = Object.values(rooms)
      const used = new Set(entries.map((e) => e.letter))
      let letter = [...DEPT_LETTERS].find((l) => !used.has(l))
      // All 16 rooms taken: share the room seen least recently.
      if (!letter) letter = entries.reduce((a, b) => (b.at < a.at ? b : a)).letter
      rooms[key] = { letter, at: now() }
      save()
      return letter
    },
  }
}

// Retry-After: whole seconds or an HTTP date. Clamped to 1..300 s; anything unreadable means 1 s.
function parseRetryAfter(v, nowMs) {
  const s = typeof v === 'string' ? v.trim() : ''
  let sec = NaN
  if (/^\d+$/.test(s)) sec = Number(s)
  else if (s) { const d = Date.parse(s); if (Number.isFinite(d)) sec = Math.ceil((d - nowMs) / 1000) }
  return Number.isFinite(sec) ? Math.min(300, Math.max(1, sec)) : 1
}

const timeoutSignal = (ms) => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined)
const isTimeout = (e) => !!e && (e.name === 'TimeoutError' || e.name === 'AbortError')

// Reads the hub's answer to a publish. Never throws. 204 is an old hub's yes; a 200 must carry {accepted}: anything
// else (a login page or error page from a proxy in front of the hub) was not the hub and counts as not sent.
async function readAck(res) {
  if (res.status === 204) return { accepted: true, legacy: true }
  let b = null
  try { b = typeof res.json === 'function' ? await res.json() : null } catch {}
  if (!b || typeof b !== 'object' || typeof b.accepted !== 'boolean') return { accepted: false }
  const out = { accepted: b.accepted }
  if (typeof b.reason === 'string') out.reason = b.reason
  if (typeof b.seq === 'number') out.seq = b.seq
  return out
}

async function rejectReason(res) {
  let t = ''
  try { t = typeof res.text === 'function' ? String(await res.text()) : '' } catch {}
  return clean(t).replace(/^bad packet: /, '').slice(0, 80)
}

function startPublisher({ getSnapshot, dir, fetch: doFetch = globalThis.fetch, log = console.log, now = Date.now,
  setTimer = (fn, ms) => { const t = setTimeout(fn, ms); if (t.unref) t.unref(); return t }, clearTimer = clearTimeout, random = Math.random,
  instanceId = crypto.randomBytes(8).toString('hex') } = {}) {
  let stopped = false, timer = null, inFlight = false
  let cfg = null, cfgMtime = -1, cfgCheckedAt = -Infinity
  let viewFn = null, viewSalt = null
  let seq = 0, lastKey = null, lastSentAt = -Infinity, lastAttemptAt = -Infinity
  let waitUntil = 0, failures = 0, lastStaleResendAt = -Infinity, lastSlowLogAt = -Infinity, lastTickAt = null
  let state = 'off', lastLogged = null, lastView = null
  let lastOkAt = null, lastErr = null, hubAck = null, lastSummaryAt = 0

  const setState = (s, msg) => {
    state = s
    if (s !== lastLogged) { lastLogged = s; lastSummaryAt = now(); if (msg) log(msg) }
  }
  const setErr = (code, reason) => { lastErr = { code, at: now() }; if (reason) lastErr.reason = reason }
  const file = path.join(dir, 'config.json')

  function reloadConfig() {
    const t = now()
    if (t - cfgCheckedAt < CONFIG_CHECK_MS) return
    cfgCheckedAt = t
    let m = null
    try { m = fs.statSync(file).mtimeMs } catch {}
    if (m === cfgMtime) return
    cfgMtime = m
    cfg = m === null ? null : readConfig(dir, log)
    if (cfg && !(cfg.hub && validHubUrl(cfg.hub) && typeof cfg.token === 'string' && cfg.token && typeof cfg.salt === 'string')) cfg = null
    else if (cfg && !SALT_RE.test(cfg.salt)) { log('terrarium: config.json has an invalid salt (need 64 hex chars); not publishing - run join again'); cfg = null }
    lastKey = null; failures = 0; waitUntil = 0  // new config: resend straight away
  }

  function currentView() {
    if (cfg.salt !== viewSalt) { viewFn = createPublicView(cfg.salt, { letters: fileLetterStore(dir) }); viewSalt = cfg.salt }
    const share = cfg.share === 'co-ban' ? 'co-ban' : 'kin'
    const view = viewFn(getSnapshot(), { share, projects: cfg.projects, private: !!cfg.private })
    return { share, view }
  }

  const fail = (delayMs, why, code) => { waitUntil = now() + delayMs; setErr(code); setState('offline', `terrarium: hub unreachable (${why}); retrying`) }

  async function send(share, view, key) {
    const body = { v: 1, seq, share, sessions: view.sessions }
    if (view.private) body.private = true
    inFlight = true; lastAttemptAt = now()
    if (state === 'off') setState('connecting', 'terrarium: connecting to hub')
    const usedToken = cfg.token
    let res
    try {
      res = await doFetch(cfg.hub.replace(/\/+$/, '') + '/api/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + usedToken, 'x-terrarium-instance': instanceId },
        body: JSON.stringify(body),
        signal: timeoutSignal(10000),
        redirect: 'manual', // a redirect (to a login page, say) is an answer to report, not a place to post to
      })
    } catch (e) {
      // Node's fetch puts the system code (ECONNREFUSED, ENOTFOUND…) on e.cause; keep only a code-like word.
      const raw = (e && e.cause && e.cause.code) || (e && e.code)
      const c = typeof raw === 'string' && /^[A-Z0-9_]{2,32}$/.test(raw) ? raw : isTimeout(e) ? 'timeout' : 'network'
      failures++; fail(backoff(), c, 'network:' + c); inFlight = false; return
    }
    inFlight = false
    const st = res.status
    if (st === 204 || st === 200) {
      const ack = await readAck(res)
      const t = now()
      hubAck = st === 204 ? 'legacy' : 'json'
      if (ack.accepted) {
        failures = 0; seq++; lastKey = key; lastSentAt = t; lastOkAt = t
        setState(view.private ? 'private' : 'sending', 'terrarium: publishing to hub')
      } else if (ack.reason === 'stale_seq' && Number.isSafeInteger(ack.seq) && ack.seq >= 0) {
        // The hub holds a newer seq for this device: jump past it. Resend at the next tick, but at most one resend per
        // STALE_RESEND_MS: inside the window the resend is pushed out and that later send counts as the window's one.
        failures = 0; seq = ack.seq + 1; lastKey = null; setErr('stale_seq')
        if (t - lastStaleResendAt < STALE_RESEND_MS) waitUntil = t + STALE_RESEND_MS
        lastStaleResendAt = Math.max(t, waitUntil)
      } else if (ack.reason === 'other_instance') {
        // Another publisher on this machine owns the device on the hub; keep our seq so we never take it back.
        failures = 0; lastKey = null; waitUntil = t + HEARTBEAT_MS; setErr('other_instance')
        setState('standby', 'terrarium: another Claude Office on this machine is publishing for this device; standing by')
      } else {
        failures++
        fail(backoff(), 'not accepted', ack.reason ? 'rejected:' + clean(ack.reason).slice(0, 80) : 'http:' + st)
      }
    } else if (st === 401) {
      // Only mark revoked when the file still holds the token that was just rejected; a newer config (re-join)
      // must survive a late 401 for the old token.
      let c = null
      try { c = readConfig(dir, log) } catch {}
      if (c && c.token === usedToken) {
        try { c.revoked = true; writeConfig(dir, c); cfgMtime = fs.statSync(file).mtimeMs } catch {}
        cfg = Object.assign({}, cfg, { revoked: true })
        setState('revoked', 'terrarium: this device was removed by the hub; run join again to re-pair')
      } else { cfgCheckedAt = -Infinity; cfgMtime = -1; reloadConfig() }
    } else if (st === 403 && await isLoginRequired(res)) {
      waitUntil = now() + LOGIN_WAIT_MS; setErr('login_required')
      setState('paused', `terrarium: sign in to ${clean(cfg.hub)} again to resume publishing`)
    } else if (st === 429) {
      const t = now()
      setErr('rate_limited')
      waitUntil = t + parseRetryAfter(res.headers && res.headers.get ? res.headers.get('retry-after') : null, t) * 1000
      if (t - lastSlowLogAt >= SLOW_LOG_MS) { lastSlowLogAt = t; log('terrarium: the hub asked to slow down (429)') }
    } else if (st === 400 || st === 413) {
      // Not sent: lastSentAt is not touched and lastKey is cleared, so the same view is retried after REJECT_WAIT_MS.
      // Logged on every rejection (not only on state change): each one is a packet the hub dropped. A rejection is not
      // a network failure, so it does not grow the network backoff.
      const why = await rejectReason(res)
      lastKey = null; waitUntil = now() + REJECT_WAIT_MS
      setErr('rejected:' + (why || st), why)
      setState('rejected')
      log(`terrarium: hub rejected the packet (${st}${why ? ': ' + why : ''})`)
    } else {
      failures++; fail(backoff(), String(st), 'http:' + st)
    }
  }

  async function isLoginRequired(res) {
    try { const b = await res.json(); return !!b && b.error === 'login_required' } catch { return false }
  }

  function backoff() {
    const base = Math.min(BACKOFF_MAX, BACKOFF_MIN * 2 ** Math.max(0, failures - 1))
    return Math.min(BACKOFF_MAX, Math.round(base * (0.8 + 0.4 * random())))
  }

  // While failing, one summary line a minute (the change into the failing state is already logged by setState).
  function summarize() {
    if ((state !== 'offline' && state !== 'rejected') || now() - lastSummaryAt < SUMMARY_LOG_MS) return
    lastSummaryAt = now()
    log(`terrarium: still ${state} (${failures} failures, ${lastErr ? lastErr.code : 'unknown'}); next try in ${Math.max(0, Math.ceil((waitUntil - now()) / 1000))} s`)
  }

  async function tick() {
    timer = null
    try {
      // lastTickAt is taken when a tick ends, so a slow send does not look like a sleep.
      if (lastTickAt !== null && now() - lastTickAt > WAKE_GAP_MS) {
        failures = 0; waitUntil = 0; lastKey = null
        log('terrarium: woke up; resending')
      }
      reloadConfig()
      if (!cfg) { setState('off'); lastView = null }
      else if (cfg.revoked) setState('revoked')
      else if (!inFlight) {
        const { share, view } = currentView()
        lastView = view
        const key = share + JSON.stringify(view)
        const t = now()
        if (t >= waitUntil && t - lastAttemptAt >= TICK_MS && (key !== lastKey || t - lastSentAt >= HEARTBEAT_MS)) await send(share, view, key)
        else if (state === 'off') setState('connecting', 'terrarium: connecting to hub')
      }
      summarize()
    } catch (e) { log('terrarium: publisher error: ' + (e && e.message)) }
    lastTickAt = now()
    if (!stopped) timer = setTimer(tick, TICK_MS)
  }
  timer = setTimer(tick, 0)

  return {
    stop() { stopped = true; if (timer != null) { try { clearTimer(timer) } catch {} } },
    state() {
      return {
        state, share: cfg ? (cfg.share === 'co-ban' ? 'co-ban' : 'kin') : null, private: cfg ? !!cfg.private : false, hub: cfg ? cfg.hub : null,
        deviceId: cfg && typeof cfg.deviceId === 'string' && /^[0-9a-f]{16}$/.test(cfg.deviceId) ? cfg.deviceId : null,
        instance: instanceId, lastOkAt, lastAttemptAt: lastAttemptAt === -Infinity ? null : lastAttemptAt,
        lastErr: lastErr && { ...lastErr }, failures, nextRetryAt: waitUntil > now() ? waitUntil : null, hubAck,
      }
    },
    view() { return cfg && !cfg.revoked ? lastView : null },
  }
}

// Opens a link in the browser. Never goes through a shell; refuses anything that is not a plain http(s) URL.
function makeOpenBrowser({ platform = process.platform, spawn = (...a) => require('child_process').spawn(...a) } = {}) {
  return (url) => {
    try {
      if (typeof url !== 'string' || /[&|<>^"%\s]/.test(url) || !/^https?:\/\//.test(url)) return false
      new URL(url)
      const [cmd, args] = platform === 'darwin' ? ['open', [url]] : platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : ['xdg-open', [url]]
      const c = spawn(cmd, args, { stdio: 'ignore', detached: true })
      if (c && c.on) c.on('error', () => {})
      if (c && c.unref) c.unref()
      return true
    } catch { return false }
  }
}
const defaultOpenBrowser = makeOpenBrowser()

// Only open a link the hub sent if it stays on the hub's own origin.
function sameOrigin(uri, hub) {
  try { return new URL(uri).origin === new URL(hub).origin } catch { return false }
}

// Asks the hub to retire this device's token. Never throws. 'ok' = hub confirmed (2xx), 'gone' = 401 (the hub no
// longer knows this token: already revoked), 'failed' = anything else, including no answer.
async function revokeSelf(hub, token, { fetch: doFetch = globalThis.fetch } = {}) {
  try {
    if (!validHubUrl(hub) || typeof token !== 'string' || !token) return 'failed'
    const res = await doFetch(hub.replace(/\/+$/, '') + '/api/device/revoke-self', {
      method: 'POST', headers: { authorization: 'Bearer ' + token },
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(REVOKE_TIMEOUT_MS) : undefined,
    })
    if (res.status >= 200 && res.status < 300) return 'ok'
    return res.status === 401 ? 'gone' : 'failed'
  } catch { return 'failed' }
}

// The approval link carries the code so the hub opens its confirm page directly; approving still takes a click there.
function approvalLink(uri, hub, code) {
  if (!sameOrigin(uri, hub)) return null
  try {
    const u = new URL(uri)
    if (/^[A-Z]{4}-[A-Z]{4}$/.test(code)) u.searchParams.set('code', code)
    return u.toString()
  } catch { return null }
}

async function join(hubUrl, { name, fetch: doFetch = globalThis.fetch, log = console.log, openBrowser = defaultOpenBrowser,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), dir, onStart, shouldStop = () => false, fetchTimeoutMs = JOIN_FETCH_MS } = {}) {
  if (!validHubUrl(hubUrl)) throw new Error('hub URL must be https:// (or http://localhost for local testing)')
  const hub = hubUrl.replace(/\/+$/, '')
  const cfgDir = dir || require('./terrarium-config.js').configDir()
  const old = readConfig(cfgDir)   // read before pairing starts; revoked after the new config is safely written
  const post = (p, body) => doFetch(hub + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: timeoutSignal(fetchTimeoutMs) })
  const deviceName = name || os.hostname()
  let sr
  try { sr = await post('/api/device/start', { name: deviceName }) } catch (e) {
    if (isTimeout(e)) throw new Error('the hub did not answer; try again')
    throw e
  }
  if (sr.status !== 200) throw new Error(`hub refused to start pairing (${sr.status})`)
  const s = await sr.json()
  const expiresIn = Number(s.expires_in) >= 1 ? Math.min(1800, Number(s.expires_in)) : 600
  log(`To pair this machine, open ${clean(s.verification_uri)} and type this code:`)
  log(`  ${clean(s.user_code)}`)
  log(`Waiting for approval (expires in ${Math.round(expiresIn / 60)} min)...`)
  const link = approvalLink(s.verification_uri, hub, String(s.user_code || ''))
  if (link) { try { openBrowser(link) } catch {} }
  if (onStart) { try { onStart({ userCode: clean(s.user_code), url: link, expiresIn }) } catch {} }
  const iv = Number(s.interval)
  let interval = Number.isFinite(iv) && iv > 0 ? Math.min(60, Math.max(1, iv)) : 5, waited = 0
  const limit = expiresIn + 30
  for (;;) {
    await sleep(interval * 1000); waited += interval
    if (shouldStop()) throw new Error('cancelled')
    let r
    try { r = await post('/api/device/token', { device_code: s.device_code }) } catch (e) {
      if (!isTimeout(e)) throw e
      r = { status: 428 }   // the poll hung: treat it as still pending and ask again
    }
    if (r.status === 200) {
      const t = await r.json()
      // Leave was pressed while this poll was in flight: do not pair, and retire the token the hub just issued.
      if (shouldStop()) {
        await revokeSelf(hub, t && t.token, { fetch: doFetch })
        throw new Error('cancelled')
      }
      const cfg = { hub, token: t.token, deviceId: t.device_id, islandId: t.island_id, salt: crypto.randomBytes(32).toString('hex'), share: 'kin', private: false, projects: [] }
      writeConfig(cfgDir, cfg)
      log('Paired. This machine will now publish its island (names and code stay private).')
      if (old && typeof old.token === 'string' && old.token && !old.revoked && typeof old.hub === 'string') await revokeSelf(old.hub, old.token, { fetch: doFetch })
      return cfg
    }
    if (r.status === 428) { /* pending */ }
    else if (r.status === 429) interval = Math.min(60, interval + 5)
    else if (r.status === 410) throw new Error('the code expired; run join again')
    else if (r.status === 403) {
      const b = await r.json().catch(() => null)
      if (b && b.error === 'hub_full') throw new Error('the hub is full (8 islands); ask a hub owner to remove one')
      throw new Error('pairing was denied')
    }
    else throw new Error(`unexpected reply from hub (${r.status})`)
    if (waited > limit) throw new Error('the code expired; run join again')
  }
}

module.exports = { startPublisher, join, makeOpenBrowser, revokeSelf, readAck, fileLetterStore, parseRetryAfter,
  REJECT_WAIT_MS, STALE_RESEND_MS, BACKOFF_MAX, WAKE_GAP_MS, LOGIN_WAIT_MS, JOIN_FETCH_MS }
