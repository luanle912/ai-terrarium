'use strict'
// Runs the animal rules on a 1 s clock in the process that holds the port (spec 4.4, 7.3, 8, 9.2).
const crypto = require('crypto')
const animals = require('./animals.js')

const TICK_MS = 1000, SAVE_EVERY_MS = 15e3, BROADCAST_EVERY_MS = 5e3
const VISIBLE_MS = 20e3, WEATHER_HOLD_MS = 5 * 60e3, WEATHER_STALE_MS = 5 * 60e3
const DEV_MAX_WORK_MS = 24 * 3600e3, RETRY_LOAD_MS = 15e3
// Disk read errors may clear up, so the engine keeps trying to load instead of staying off.
const RETRYABLE = new Set(['io'])
const RECORD_FIELDS = ['caught', 'out', 'speciesCaught']
const WEATHERS = new Set(['clear', 'rain', 'snow'])
const ACTION_FIELDS = Object.freeze({ catch: ['wildId'], giveup: ['wildId'], release: ['id'], recall: ['id'],
  free: ['id'], resolve: ['freeId', 'cancel'] })

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const reply = (status, body) => ({ status, body })
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => Object.hasOwn(obj, k)).map((k) => [k, obj[k]]))
const tierOf = (species) => animals.SPECIES.find((s) => s.id === species).tier

function normalWait(u) {
  const { waitMinMs: lo, waitMaxMs: hi } = animals.LIMITS
  return Math.round(lo + u * (hi - lo))
}

const recordCount = (v) => (Array.isArray(v) ? v.length : 0)
const lostRecords = (raw, clean) => RECORD_FIELDS.some((k) => recordCount(raw[k]) > recordCount(clean[k]))

// Decides the in-memory state for a load result: { state, notice, save, keep? } or { disabled }.
// keep: the loaded bytes must be copied aside before this state may be saved over them.
function fromLoad(r, u) {
  if (!r || r.status === 'disabled') return { disabled: (r && r.error) || 'disabled' }
  if (r.status === 'fresh') return { state: animals.initialState(u()), notice: null, save: true }
  const clean = r.state ? animals.validateState(r.state) : null
  if (clean) {
    const lost = lostRecords(r.state, clean)
    if (r.status === 'ok' && !lost) return { state: clean, notice: null, save: false }
    return { state: clean, notice: r.status === 'ok' ? 'repaired' : 'restored', save: true, keep: lost }
  }
  // A reset is not a first run (spec 7.4): normal wait, not the 30-90 s one.
  const first = u()
  const notice = r.status === 'reset' && r.error === 'missing' ? null : 'reset'
  return { state: { ...animals.initialState(first), waitLeftMs: normalWait(first) }, notice, save: true, keep: Boolean(r.state) }
}

function freshId(caught) {
  const taken = new Set(caught.map((c) => c.id))
  let id
  do { id = crypto.randomBytes(3).toString('hex') } while (taken.has(id))
  return id
}

function createAnimalEngine({ store, getRoots, now = Date.now, hrtime = () => process.hrtime.bigint(), log = () => {},
  dev = false, timers = { setInterval, clearInterval } } = {}) {
  if (!store || typeof getRoots !== 'function') throw new TypeError('createAnimalEngine: store and getRoots are required')
  const mono = () => Number(hrtime()) / 1e6
  const rand = (n) => store.rand(n)
  const subs = new Set()
  let phase = 'idle', error = null, state = null, timer = null, notice = null
  let lastHr = 0, lastSaveAt = 0, lastBroadcastAt = 0, lastLoadAt = 0, dirty = false, working = false, rootsFailed = false, stepFailed = false
  let visibleAt = null, weather = 'clear', weatherAt = null, weatherChangedAt = null

  const unavailable = () => reply(503, { disabled: true, error: error || 'not-started' })
  const isVisible = (t) => visibleAt !== null && t - visibleAt <= VISIBLE_MS
  const currentWeather = (t) => (weatherAt !== null && t - weatherAt <= WEATHER_STALE_MS ? weather : 'clear')

  function stopTimer() {
    if (timer !== null) timers.clearInterval(timer)
    timer = null
  }

  // A retryable reason keeps the clock running so step() can try the load again.
  function disable(reason) {
    const repeat = phase === 'retry' && error === reason
    phase = RETRYABLE.has(reason) ? 'retry' : 'disabled'; error = reason; state = null; notice = null
    if (phase === 'disabled') stopTimer()
    if (!repeat) log(`terrarium: animals disabled (${reason})`)
    broadcast([])
  }

  function keepCopy() {
    try { return store.keepCopy() === true } catch (e) { log(`terrarium: keeping a copy of animals failed: ${e.message}`); return false }
  }

  // Returns 'ok' | 'conflict' | 'error'; a conflict reloads unless asked not to (no reload loops).
  function persist(reloadOnConflict = true) {
    lastSaveAt = mono()
    let r
    try { r = store.save(state) } catch (e) { r = { ok: false, error: e.message } }
    if (r && r.ok) { state = { ...state, seq: r.seq }; dirty = false; return 'ok' }
    if (r && r.conflict) { if (reloadOnConflict) reload(); return 'conflict' }
    log(`terrarium: saving animals failed: ${(r && r.error) || 'unknown'}`)
    return 'error'
  }

  function adopt(r) {
    const next = fromLoad(r, () => rand(0)[0])
    if (next.disabled) { disable(next.disabled); return false }
    if (next.keep && !keepCopy()) { disable('io'); return false }
    phase = 'on'; state = next.state; dirty = next.save
    if (next.notice) notice = { type: next.notice, at: now() }
    if (next.save) persist(false)
    return true
  }

  function safeLoad() {
    lastLoadAt = mono()
    try { return store.load({ validate: animals.validateState }) } catch (e) { log(`terrarium: loading animals failed: ${e.message}`); return { status: 'disabled', error: 'load-failed' } }
  }

  // Another process saved a newer seq: take its state instead of overwriting it.
  function reload() {
    if (adopt(safeLoad())) broadcast([])
  }

  function view() {
    if (phase !== 'on') return unavailable().body
    const v = { ...animals.publicView(state, { working }), notice }
    if (notice && isVisible(mono())) notice = null
    return v
  }

  function broadcast(events) {
    lastBroadcastAt = mono()
    const v = { ...view(), events }
    for (const fn of subs) {
      try { fn(v) } catch (e) { log(`terrarium: animal subscriber failed: ${e.message}`) }
    }
  }

  function computeWorking(wall) {
    try { return animals.isWorking(getRoots(), wall) } catch (e) {
      if (!rootsFailed) log(`terrarium: reading sessions for animals failed: ${e.message}`)
      rootsFailed = true
      return false
    }
  }

  function tickCtx(t, wall, dtMs) {
    return { dtMs, visible: isVisible(t), working, night: animals.isNightHour(new Date(wall).getHours()),
      weather: currentWeather(t), rand, now: wall }
  }

  // A throw here would escape the interval and take the whole office server down.
  function safeStep() {
    try { step() } catch (e) {
      if (!stepFailed) log(`terrarium: animal tick failed: ${e.message}`)
      stepFailed = true
    }
  }

  function retryLoad(t) {
    if (t - lastLoadAt >= RETRY_LOAD_MS && adopt(safeLoad())) { lastHr = mono(); broadcast([]) }
  }

  function step() {
    if (phase === 'retry') return retryLoad(mono())
    if (phase !== 'on') return
    const t = mono(), wall = now(), dtMs = t - lastHr
    lastHr = t
    const wasWorking = working
    working = computeWorking(wall)
    const r = animals.tick(state, tickCtx(t, wall, dtMs))
    if (r.state !== state) dirty = true
    state = r.state
    if (r.events.length) {
      if (persist() !== 'conflict') broadcast(r.events)
      return
    }
    if (dirty && t - lastSaveAt >= SAVE_EVERY_MS && persist() === 'conflict') return
    if (working !== wasWorking || t - lastBroadcastAt >= BROADCAST_EVERY_MS) broadcast([])
  }

  function commit(next, events) {
    state = next; dirty = true
    if (persist() === 'conflict') return reply(409, { error: 'conflict' })
    broadcast(events)
    return reply(200, view())
  }

  function act(action) {
    if (phase !== 'on') return unavailable()
    if (!isObj(action) || typeof action.type !== 'string' || !Object.hasOwn(ACTION_FIELDS, action.type)) return reply(400, { error: 'bad_action' })
    const r = animals.apply(state, { type: action.type, ...pick(action, ACTION_FIELDS[action.type]) }, { rand, now: now() })
    return r.error ? reply(400, { error: r.error }) : commit(r.state, r.events)
  }

  function report(body) {
    if (phase !== 'on') return unavailable()
    if (!isObj(body) || typeof body.visible !== 'boolean' || !WEATHERS.has(body.weather)) return reply(400, { error: 'bad_report' })
    // Only a visible tab's weather counts (spec 8.2); a change sticks for at least 5 min.
    if (body.visible) {
      const t = mono()
      visibleAt = t; weatherAt = t
      if (body.weather !== weather && (weatherChangedAt === null || t - weatherChangedAt >= WEATHER_HOLD_MS)) {
        weather = body.weather; weatherChangedAt = t
      }
    } else {
      // Stop the watch clocks now (e.g. "view as others"); another visible tab re-arms them on its next report.
      visibleAt = null
    }
    return reply(200, { ok: true })
  }

  function devSpawn(what) {
    if (state.attempt) return reply(400, { error: 'attempt_active' })
    const list = animals.SPECIES.filter((s) => s.id === what || s.tier === what)
    if (!list.length) return reply(400, { error: 'unknown_species' })
    const species = list[crypto.randomInt(list.length)].id
    const wild = { id: freshId(state.caught), species, stayLeftMs: animals.TIERS[tierOf(species)].stayMs }
    return commit({ ...state, waitLeftMs: 0, wild }, [{ type: 'spawn', wild: { ...wild } }])
  }

  function devWork(ms) {
    if (!Number.isFinite(ms) || ms <= 0 || ms > DEV_MAX_WORK_MS) return reply(400, { error: 'bad_work' })
    const a = state.attempt
    if (!a || a.phase !== 'catching') return reply(400, { error: 'no_attempt' })
    const bumped = { ...state, attempt: { ...a, workMs: Math.min(a.needMs, a.workMs + ms) } }
    const t = mono(), wall = now()
    const r = animals.tick(bumped, tickCtx(t, wall, 0))
    return commit(r.state, r.events)
  }

  // Test hooks that bypass the rules; only reachable when the engine was built with dev: true.
  function devAct(body) {
    if (!dev) return reply(404, { error: 'not_found' })
    if (phase !== 'on') return unavailable()
    if (!isObj(body)) return reply(400, { error: 'bad_action' })
    if (Object.hasOwn(body, 'spawn')) return devSpawn(body.spawn)
    if (Object.hasOwn(body, 'work')) return devWork(body.work)
    return reply(400, { error: 'bad_action' })
  }

  function start() {
    if (phase !== 'idle') return
    lastHr = mono(); lastSaveAt = lastHr; lastBroadcastAt = lastHr
    if (!adopt(safeLoad()) && phase === 'disabled') return
    timer = timers.setInterval(safeStep, TICK_MS)
    if (timer && typeof timer.unref === 'function') timer.unref()
  }

  function flush() {
    return phase === 'on' ? persist(false) : null
  }

  function subscribe(fn) {
    subs.add(fn)
    return () => { subs.delete(fn) }
  }

  return { start, stop: stopTimer, flush, view, act, report, subscribe, devAct }
}

module.exports = { createAnimalEngine }
