'use strict'
// Local publisher: sends the publicView of this machine's island to the hub, and the `join` pairing flow.
// Only the output of createPublicView ever leaves the machine; usage and cwd are never read here.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto')
const { createPublicView } = require('./public-view.js')
const { readConfig, writeConfig, validHubUrl, clean } = require('./terrarium-config.js')

const TICK_MS = 500          // also the minimum gap between two sends (max 2/s)
const HEARTBEAT_MS = 30000
const CONFIG_CHECK_MS = 2000
const SALT_RE = /^[0-9a-f]{64}$/i
const BACKOFF_MIN = 2000, BACKOFF_MAX = 60000

function startPublisher({ getSnapshot, dir, fetch: doFetch = globalThis.fetch, log = console.log, now = Date.now,
  setTimer = (fn, ms) => { const t = setTimeout(fn, ms); if (t.unref) t.unref(); return t }, clearTimer = clearTimeout, random = Math.random } = {}) {
  let stopped = false, timer = null, inFlight = false
  let cfg = null, cfgMtime = -1, cfgCheckedAt = -Infinity
  let viewFn = null, viewSalt = null
  let seq = 0, lastKey = null, lastSentAt = -Infinity, lastAttemptAt = -Infinity
  let waitUntil = 0, failures = 0
  let state = 'off', lastLogged = null, lastView = null

  const setState = (s, msg) => {
    state = s
    if (s !== lastLogged) { lastLogged = s; if (msg) log(msg) }
  }
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
    if (cfg.salt !== viewSalt) { viewFn = createPublicView(cfg.salt); viewSalt = cfg.salt }
    const share = cfg.share === 'co-ban' ? 'co-ban' : 'kin'
    const view = viewFn(getSnapshot(), { share, projects: cfg.projects, private: !!cfg.private })
    return { share, view }
  }

  const fail = (delayMs, why) => { waitUntil = now() + delayMs; setState('offline', `terrarium: hub unreachable (${why}); retrying`) }

  async function send(share, view, key) {
    const body = { v: 1, seq, share, sessions: view.sessions }
    if (view.private) body.private = true
    inFlight = true; lastAttemptAt = now()
    let res
    try {
      res = await doFetch(cfg.hub.replace(/\/+$/, '') + '/api/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.token },
        body: JSON.stringify(body),
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
      })
    } catch (e) {
      failures++; fail(backoff(), e && e.code || 'network'); inFlight = false; return
    }
    inFlight = false
    const st = res.status
    if (st === 204 || st === 200) {
      failures = 0; seq++; lastKey = key; lastSentAt = now()
      setState(view.private ? 'private' : 'sending', 'terrarium: publishing to hub')
    } else if (st === 401) {
      try { const c = readConfig(dir, log); if (c) { c.revoked = true; writeConfig(dir, c); cfgMtime = fs.statSync(file).mtimeMs } } catch {}
      cfg = Object.assign({}, cfg, { revoked: true })
      setState('revoked', 'terrarium: this device was removed by the hub; run join again to re-pair')
    } else if (st === 429) {
      const ra = Number(res.headers && res.headers.get && res.headers.get('retry-after'))
      waitUntil = now() + (ra > 0 ? ra : 1) * 1000
    } else if (st === 400 || st === 413) {
      lastKey = key; lastSentAt = now()   // the hub will not accept this packet; do not spin on it
      log(`terrarium: hub rejected the packet (${st})`)
    } else {
      failures++; fail(backoff(), String(st))
    }
  }

  function backoff() {
    const base = Math.min(BACKOFF_MAX, BACKOFF_MIN * 2 ** Math.max(0, failures - 1))
    return Math.min(BACKOFF_MAX, Math.round(base * (0.8 + 0.4 * random())))
  }

  async function tick() {
    timer = null
    try {
      reloadConfig()
      if (!cfg) { setState('off'); lastView = null }
      else if (cfg.revoked) setState('revoked')
      else if (!inFlight) {
        const { share, view } = currentView()
        lastView = view
        const key = share + JSON.stringify(view)
        const t = now()
        if (t >= waitUntil && t - lastAttemptAt >= TICK_MS && (key !== lastKey || t - lastSentAt >= HEARTBEAT_MS)) await send(share, view, key)
        else if (state === 'off') setState('sending')
      }
    } catch (e) { log('terrarium: publisher error: ' + (e && e.message)) }
    if (!stopped) timer = setTimer(tick, TICK_MS)
  }
  timer = setTimer(tick, 0)

  return {
    stop() { stopped = true; if (timer != null) { try { clearTimer(timer) } catch {} } },
    state() { return { state, share: cfg ? (cfg.share === 'co-ban' ? 'co-ban' : 'kin') : null, private: cfg ? !!cfg.private : false, hub: cfg ? cfg.hub : null } },
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

async function join(hubUrl, { name, fetch: doFetch = globalThis.fetch, log = console.log, openBrowser = defaultOpenBrowser,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), dir } = {}) {
  if (!validHubUrl(hubUrl)) throw new Error('hub URL must be https:// (or http://localhost for local testing)')
  const hub = hubUrl.replace(/\/+$/, '')
  const post = (p, body) => doFetch(hub + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const deviceName = name || os.hostname()
  const sr = await post('/api/device/start', { name: deviceName })
  if (sr.status !== 200) throw new Error(`hub refused to start pairing (${sr.status})`)
  const s = await sr.json()
  const expiresIn = Number(s.expires_in) >= 1 ? Math.min(1800, Number(s.expires_in)) : 600
  log(`To pair this machine, open ${clean(s.verification_uri)} and type this code:`)
  log(`  ${clean(s.user_code)}`)
  log(`Waiting for approval (expires in ${Math.round(expiresIn / 60)} min)...`)
  if (sameOrigin(s.verification_uri, hub)) { try { openBrowser(s.verification_uri) } catch {} }
  const iv = Number(s.interval)
  let interval = Number.isFinite(iv) && iv > 0 ? Math.min(60, Math.max(1, iv)) : 5, waited = 0
  const limit = expiresIn + 30
  for (;;) {
    await sleep(interval * 1000); waited += interval
    const r = await post('/api/device/token', { device_code: s.device_code })
    if (r.status === 200) {
      const t = await r.json()
      const cfg = { hub, token: t.token, deviceId: t.device_id, islandId: t.island_id, salt: crypto.randomBytes(32).toString('hex'), share: 'kin', private: false, projects: [] }
      writeConfig(dir || require('./terrarium-config.js').configDir(), cfg)
      log('Paired. This machine will now publish its island (names and code stay private).')
      return cfg
    }
    if (r.status === 428) { /* pending */ }
    else if (r.status === 429) interval = Math.min(60, interval + 5)
    else if (r.status === 410) throw new Error('the code expired; run join again')
    else if (r.status === 403) throw new Error('pairing was denied')
    else throw new Error(`unexpected reply from hub (${r.status})`)
    if (waited > limit) throw new Error('the code expired; run join again')
  }
}

module.exports = { startPublisher, join, makeOpenBrowser }
