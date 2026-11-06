import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const A = require('../lib/animals.js')
const { createAnimalEngine } = require('../lib/animal-engine.js')
const { TIERS, LIMITS, SPECIES } = A

const NOON = new Date(2026, 10, 6, 12, 0, 0).getTime()
const NIGHT = new Date(2026, 10, 6, 23, 0, 0).getTime()

// u1 that draws `species` under the given conditions (and something else under `not`, when given).
function uFor(species, conds, not) {
  for (let i = 0; i < 10000; i++) {
    const u = (i + 0.5) / 10000
    if (A.pickSpecies(u, conds) === species && (!not || A.pickSpecies(u, not) !== species)) return u
  }
  throw new Error('no u for ' + species)
}

function fakeStore({ loads = [{ status: 'fresh', state: null }], saveResults = [], u1 = 0.5, u2 = 0.25, keepOk = true } = {}) {
  const queue = [...loads]
  const s = { saves: [], loadCount: 0, loadArgs: [], keeps: [], randCalls: 0, randArgs: [], u1, u2 }
  s.load = (opts) => { s.loadCount++; s.loadArgs.push(opts); return queue.length > 1 ? queue.shift() : queue[0] }
  s.keepCopy = () => { s.keeps.push(s.saves.length); return keepOk }
  s.save = (state) => {
    s.saves.push(state)
    const r = saveResults.shift()
    return r || { ok: true, seq: s.saves.length }
  }
  s.rand = (n) => { s.randCalls++; s.randArgs.push(n); return [s.u1, (s.u2 + n * 0.001) % 1] }
  return s
}

// Fake monotonic clock + wall clock + interval, all driven by advance().
function harness({ store = fakeStore(), roots = [], wall = NOON, dev = false } = {}) {
  let mono = 1000n * 1000000n, wallMs = wall, tickFn = null, intervals = 0
  const timers = {
    setInterval: (fn) => { tickFn = fn; intervals++; return { unref() {} } },
    clearInterval: () => { tickFn = null },
  }
  const env = { roots }
  const engine = createAnimalEngine({ store, getRoots: () => env.roots, now: () => wallMs, hrtime: () => mono, log: () => {}, dev, timers })
  const seen = []
  engine.subscribe((v) => seen.push(v))
  const h = {
    engine, store, env, seen, timers,
    get intervals() { return intervals },
    get ticking() { return tickFn !== null },
    // Advances by `ms` in 1 s ticks; `each` runs before every tick.
    advance(ms, each) {
      for (let left = ms; left > 0; left -= 1000) {
        const step = Math.min(1000, left)
        mono += BigInt(step) * 1000000n; wallMs += step
        if (each) each()
        if (tickFn) tickFn()
      }
    },
    jump(ms, each) { mono += BigInt(ms) * 1000000n; wallMs += ms; if (each) each(); if (tickFn) tickFn() },
    visible(ms, weather = 'clear') { h.advance(ms, () => engine.report({ weather, visible: true })) },
    lastSaved() { engine.flush(); return store.saves[store.saves.length - 1] },
    events() { return seen.flatMap((v) => v.events || []) },
  }
  return h
}

const savedState = (over = {}) => ({ seq: 7, spawnNo: 3, caught: [], out: [], speciesCaught: [], total: 0,
  waitLeftMs: 60e3, wild: null, attempt: null, ...over })
const withWild = (species = 'hen', over = {}) => savedState({ waitLeftMs: 0, wild: { id: 'abc123', species, stayLeftMs: TIERS[A.SPECIES.find((s) => s.id === species).tier].stayMs }, ...over })
const working = (now) => [{ hasTranscript: true, lastTs: now, regBusy: true, status: 'working', kidsActive: false }]

// ---------- start / load statuses ----------

test('fresh: first-run state from rand(0), saved once, then ticks every second', () => {
  const h = harness()
  h.engine.start()
  assert.equal(h.store.loadCount, 1)
  assert.equal(h.store.saves.length, 1)
  const want = A.initialState(h.store.rand(0)[0])
  assert.equal(h.store.saves[0].waitLeftMs, want.waitLeftMs)
  assert.ok(want.waitLeftMs >= LIMITS.firstWaitMinMs && want.waitLeftMs <= LIMITS.firstWaitMaxMs)
  assert.equal(h.ticking, true)
  const v = h.engine.view()
  assert.equal(v.disabled, undefined)
  assert.equal(v.wild, null)
  assert.equal(v.notice, null)
  assert.equal('seq' in v || 'spawnNo' in v || 'waitLeftMs' in v, false)
})

test('start is idempotent', () => {
  const h = harness()
  h.engine.start(); h.engine.start()
  assert.equal(h.store.loadCount, 1)
  assert.equal(h.intervals, 1)
})

test('view before start reports not started', () => {
  const h = harness()
  assert.deepEqual(h.engine.view(), { disabled: true, error: 'not-started' })
  assert.equal(h.engine.act({ type: 'catch', wildId: 'abc123' }).status, 503)
})

test('disabled: no timer, no store calls beyond load, every call says disabled', () => {
  const store = fakeStore({ loads: [{ status: 'disabled', state: null, error: 'key-missing' }] })
  const h = harness({ store })
  h.engine.start()
  assert.deepEqual(h.engine.view(), { disabled: true, error: 'key-missing' })
  assert.equal(h.ticking, false)
  assert.equal(store.saves.length, 0)
  assert.equal(store.randCalls, 0)
  assert.deepEqual(h.engine.act({ type: 'catch', wildId: 'abc123' }), { status: 503, body: { disabled: true, error: 'key-missing' } })
  assert.equal(h.engine.report({ weather: 'clear', visible: true }).status, 503)
  h.engine.flush()
  assert.equal(store.saves.length, 0)
})

test('ok: keeps the loaded state and does not save on start', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: withWild('fox') }] })
  const h = harness({ store })
  h.engine.start()
  assert.equal(store.saves.length, 0)
  assert.equal(h.engine.view().wild.species, 'fox')
  assert.equal(h.engine.view().notice, null)
})

test('restored: one-time notice and an immediate save so the restore sticks', () => {
  const store = fakeStore({ loads: [{ status: 'restored', state: savedState(), error: 'dat-corrupt' }] })
  const h = harness({ store })
  h.engine.start()
  assert.equal(store.saves.length, 1)
  assert.equal(h.engine.view().notice.type, 'restored')
})

test('reset corrupt: notice "reset", normal 4-10 min wait, saved; reset missing: no notice', () => {
  const store = fakeStore({ loads: [{ status: 'reset', state: null, error: 'corrupt' }] })
  const h = harness({ store })
  h.engine.start()
  assert.equal(h.engine.view().notice.type, 'reset')
  assert.equal(store.saves.length, 1)
  const w = store.saves[0].waitLeftMs
  assert.ok(w >= LIMITS.waitMinMs && w <= LIMITS.waitMaxMs, String(w))
  assert.equal(store.saves[0].caught.length, 0)

  const m = harness({ store: fakeStore({ loads: [{ status: 'reset', state: null, error: 'missing' }] }) })
  m.engine.start()
  assert.equal(m.engine.view().notice, null)
  assert.ok(m.store.saves[0].waitLeftMs >= LIMITS.waitMinMs)
})

test('an authentic but invalid state is treated as a reset, after keeping a copy', () => {
  const h = harness({ store: fakeStore({ loads: [{ status: 'ok', state: { seq: 'x' } }] }) })
  h.engine.start()
  assert.equal(h.engine.view().notice.type, 'reset')
  assert.equal(h.store.saves.length, 1)
  assert.deepEqual(h.store.keeps, [0], 'copy kept before the first save')
})

test('notice stays until a view is delivered while a tab is visible', () => {
  const store = fakeStore({ loads: [{ status: 'restored', state: savedState(), error: 'dat-corrupt' }] })
  const h = harness({ store })
  h.engine.start()
  const first = h.engine.view().notice
  assert.ok(Number.isFinite(first.at))
  assert.deepEqual(h.engine.view().notice, first, 'a hidden GET does not swallow it')
  h.engine.report({ weather: 'clear', visible: true })
  assert.deepEqual(h.engine.view().notice, first, 'carried once after the visible report')
  assert.equal(h.engine.view().notice, null)
})

// ---------- clocks and gating ----------

test('the wait only runs while a tab is visible (20 s window)', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState({ waitLeftMs: 60e3 }) }] })
  const h = harness({ store })
  h.engine.start()
  h.advance(120e3)
  assert.equal(h.lastSaved().waitLeftMs, 60e3, 'nobody watching')
  h.engine.report({ weather: 'clear', visible: false })
  h.advance(5e3)
  assert.equal(h.lastSaved().waitLeftMs, 60e3, 'hidden tab does not count')
  h.engine.report({ weather: 'clear', visible: true })
  h.advance(40e3)
  assert.equal(h.lastSaved().waitLeftMs, 40e3, 'one report keeps it running for 20 s')
})

test('a visible:false report stops the wait at once instead of after the 20 s window', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState({ waitLeftMs: 60e3 }) }] })
  const h = harness({ store })
  h.engine.start()
  h.engine.report({ weather: 'clear', visible: true })
  h.advance(5e3)
  h.engine.report({ weather: 'clear', visible: false })
  h.advance(15e3)
  assert.equal(h.lastSaved().waitLeftMs, 55e3, 'only the 5 s before the hidden report count')
})

test('spawn after the wait: saved immediately and broadcast with the event', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState({ waitLeftMs: 5e3 }) }] })
  const h = harness({ store })
  h.engine.start()
  h.visible(4e3)
  const before = store.saves.length
  h.visible(1e3)
  assert.equal(store.saves.length, before + 1)
  const spawn = h.events().find((e) => e.type === 'spawn')
  assert.ok(spawn)
  assert.equal(h.seen[h.seen.length - 1].wild.id, spawn.wild.id)
  assert.equal(store.saves[store.saves.length - 1].spawnNo, 4)
})

test('rand for the spawn comes from the store with the next spawnNo', () => {
  const u1 = uFor('deer', { night: false, weather: 'clear' })
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState({ waitLeftMs: 1e3 }) }], u1 })
  const h = harness({ store })
  h.engine.start()
  h.visible(1e3)
  assert.equal(h.engine.view().wild.species, 'deer')
  assert.ok(store.randArgs.includes(4))
})

test('weather: rain report changes the draw; a second change within 5 min is ignored', () => {
  const rainDay = { night: false, weather: 'rain' }
  const u1 = uFor('frog', rainDay, { night: false, weather: 'snow' })
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState({ waitLeftMs: 10e3 }) }], u1 })
  const h = harness({ store })
  h.engine.start()
  h.visible(5e3, 'rain')
  h.visible(5e3, 'snow')
  assert.equal(h.engine.view().wild.species, 'frog')
})

test('weather: a change is accepted again after 5 min', () => {
  const snowDay = { night: false, weather: 'snow' }
  const u1 = uFor('snowfox', snowDay, { night: false, weather: 'rain' })
  // The rain report keeps the wait running for 20 s, so 10 s are left for the snow phase.
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState({ waitLeftMs: 30e3 }) }], u1 })
  const h = harness({ store })
  h.engine.start()
  h.engine.report({ weather: 'rain', visible: true })
  h.advance(5 * 60e3 + 1e3)
  h.visible(10e3, 'snow')
  assert.equal(h.engine.view().wild.species, 'snowfox')
})

test('night comes from the wall clock hour', () => {
  const u1 = uFor('owl', { night: true, weather: 'clear' })
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState({ waitLeftMs: 1e3 }) }], u1 })
  const h = harness({ store, wall: NIGHT })
  h.engine.start()
  h.visible(1e3)
  assert.equal(h.engine.view().wild.species, 'owl')
})

test('report rejects bad input', () => {
  const h = harness()
  h.engine.start()
  for (const b of [null, {}, { weather: 'storm', visible: true }, { weather: 'clear', visible: 'yes' }, []]) {
    assert.deepEqual(h.engine.report(b), { status: 400, body: { error: 'bad_report' } }, JSON.stringify(b))
  }
  assert.equal(h.engine.report({ weather: 'clear', visible: true }).status, 200)
})

test('dtMs comes from hrtime deltas and is clamped to 2 s per tick', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState({ waitLeftMs: 60e3 }) }] })
  const h = harness({ store })
  h.engine.start()
  h.jump(30e3, () => h.engine.report({ weather: 'clear', visible: true }))
  assert.equal(h.lastSaved().waitLeftMs, 58e3)
})

test('working comes from getRoots and the wall clock', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: withWild('hen') }] })
  const h = harness({ store })
  h.engine.start()
  assert.equal(h.engine.act({ type: 'catch', wildId: 'abc123' }).status, 200)
  h.advance(3e3)
  assert.equal(h.engine.view().attempt.counting, false)
  h.env.roots = working(NOON + 3e3)
  h.advance(2e3)
  assert.equal(h.engine.view().attempt.counting, true)
  assert.equal(h.lastSaved().attempt.workMs, 2e3)
  h.env.roots = [{ hasTranscript: true, lastTs: NOON - 11 * 60e3, regBusy: true, status: 'working', kidsActive: false }]
  h.advance(2e3)
  assert.equal(h.lastSaved().attempt.workMs, 2e3, 'stale transcript does not count')
})

test('getRoots throwing counts as not working', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: withWild('hen') }] })
  const h = harness({ store })
  Object.defineProperty(h.env, 'roots', { get() { throw new Error('boom') } })
  h.engine.start()
  h.engine.act({ type: 'catch', wildId: 'abc123' })
  assert.doesNotThrow(() => h.advance(2e3))
  assert.equal(h.engine.view().attempt.counting, false)
  assert.equal(h.lastSaved().attempt.workMs, 0)
})

test('a full catch: work accumulates, caught event saved and broadcast', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: withWild('hen') }] })
  const h = harness({ store })
  h.engine.start()
  h.engine.act({ type: 'catch', wildId: 'abc123' })
  h.advance(TIERS.common.needMs, () => { h.env.roots = working(NOON) })
  const caught = h.events().find((e) => e.type === 'caught')
  assert.ok(caught)
  const v = h.engine.view()
  assert.equal(v.caught.length, 1)
  assert.equal(v.attempt, null)
  assert.equal(store.saves[store.saves.length - 1].caught.length, 1)
})

// ---------- save cadence ----------

test('saves every 15 s while a clock runs, not more often', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: withWild('hen') }] })
  const h = harness({ store })
  h.engine.start()
  h.engine.act({ type: 'catch', wildId: 'abc123' })
  const afterAct = store.saves.length
  assert.equal(afterAct, 1, 'a successful act saves at once')
  h.advance(14e3)
  assert.equal(store.saves.length, afterAct)
  h.advance(1e3)
  assert.equal(store.saves.length, afterAct + 1)
  h.advance(15e3)
  assert.equal(store.saves.length, afterAct + 2)
})

test('no periodic save while every clock is stopped', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState() }] })
  const h = harness({ store })
  h.engine.start()
  h.advance(60e3)
  assert.equal(store.saves.length, 0)
})

test('flush saves now', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState() }] })
  const h = harness({ store })
  h.engine.start()
  h.engine.flush()
  assert.equal(store.saves.length, 1)
  assert.equal(store.saves[0].waitLeftMs, 60e3)
})

test('a save conflict reloads from the store and broadcasts the reloaded view', () => {
  const store = fakeStore({
    loads: [{ status: 'ok', state: savedState({ waitLeftMs: 1e3 }) }, { status: 'ok', state: withWild('deer', { seq: 20 }) }],
    saveResults: [{ ok: false, conflict: true }],
  })
  const h = harness({ store })
  h.engine.start()
  h.visible(1e3)
  assert.equal(store.loadCount, 2)
  assert.equal(h.engine.view().wild.species, 'deer')
  assert.equal(h.seen[h.seen.length - 1].wild.species, 'deer')
  assert.equal(h.events().some((e) => e.type === 'spawn'), false, 'the lost spawn is not announced')
})

test('act answers 409 when its save hits a conflict', () => {
  const store = fakeStore({
    loads: [{ status: 'ok', state: withWild('hen') }, { status: 'ok', state: savedState({ seq: 30 }) }],
    saveResults: [{ ok: false, conflict: true }],
  })
  const h = harness({ store })
  h.engine.start()
  assert.deepEqual(h.engine.act({ type: 'catch', wildId: 'abc123' }), { status: 409, body: { error: 'conflict' } })
  assert.equal(h.engine.view().wild, null)
})

test('an io error keeps the change and retries on the cadence', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: withWild('hen') }], saveResults: [{ ok: false, error: 'io' }] })
  const h = harness({ store })
  h.engine.start()
  assert.equal(h.engine.act({ type: 'catch', wildId: 'abc123' }).status, 200)
  assert.ok(h.engine.view().attempt)
  h.advance(15e3)
  assert.equal(store.saves.length, 2)
})

test('reload into disabled stops the clock', () => {
  const store = fakeStore({
    loads: [{ status: 'ok', state: withWild('hen') }, { status: 'disabled', state: null, error: 'key-unreadable' }],
    saveResults: [{ ok: false, conflict: true }],
  })
  const h = harness({ store })
  h.engine.start()
  h.engine.act({ type: 'catch', wildId: 'abc123' })
  assert.deepEqual(h.engine.view(), { disabled: true, error: 'key-unreadable' })
  assert.equal(h.ticking, false)
  assert.deepEqual(h.seen.at(-1), { disabled: true, error: 'key-unreadable', events: [] }, 'open streams learn it')
})

test('a throw inside a tick is logged, not thrown out of the timer', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState({ waitLeftMs: 1e3 }) }] })
  store.rand = () => { throw new Error('hmac failed') }
  const h = harness({ store })
  h.engine.start()
  assert.doesNotThrow(() => h.visible(2e3))
  assert.equal(h.engine.view().wild, null)
})

// ---------- actions ----------

test('act maps rule errors to 400 and ignores fields it does not know', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: withWild('hen') }] })
  const h = harness({ store })
  h.engine.start()
  assert.deepEqual(h.engine.act({ type: 'catch', wildId: 'zzzzzz' }), { status: 400, body: { error: 'wrong_wild' } })
  assert.deepEqual(h.engine.act({ type: 'nope' }), { status: 400, body: { error: 'bad_action' } })
  assert.deepEqual(h.engine.act(null), { status: 400, body: { error: 'bad_action' } })
  assert.deepEqual(h.engine.act({ type: 'toString' }), { status: 400, body: { error: 'bad_action' } })
  assert.equal(store.saves.length, 0)
  const ok = h.engine.act({ type: 'catch', wildId: 'abc123', workMs: 999999 })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.attempt.workMs, 0)
  assert.equal(h.events().at(-1).type, 'catchStarted')
})

test('release / recall / free go through the rules', () => {
  const caught = [{ id: '000001', species: 'hen', at: 1 }, { id: '000002', species: 'fox', at: 2 }]
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState({ caught, out: [] }) }] })
  const h = harness({ store })
  h.engine.start()
  assert.deepEqual(h.engine.act({ type: 'release', id: '000001' }).body.out, ['000001'])
  assert.deepEqual(h.engine.act({ type: 'recall', id: '000001' }).body.out, [])
  assert.equal(h.engine.act({ type: 'free', id: '000002' }).body.caught.length, 1)
  assert.equal(store.saves.length, 3)
})

// ---------- broadcast ----------

test('broadcasts every 5 s without changes, and unsubscribe stops it', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState() }] })
  const h = harness({ store })
  h.engine.start()
  const n0 = h.seen.length
  h.advance(4e3)
  assert.equal(h.seen.length, n0)
  h.advance(1e3)
  assert.equal(h.seen.length, n0 + 1)
  assert.deepEqual(h.seen.at(-1).events, [])
  const got = []
  const off = h.engine.subscribe((v) => got.push(v))
  h.advance(5e3)
  assert.equal(got.length, 1)
  off()
  h.advance(10e3)
  assert.equal(got.length, 1)
})

test('broadcasts when the working flag flips', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: savedState() }] })
  const h = harness({ store })
  h.engine.start()
  h.advance(5e3)
  const n0 = h.seen.length
  h.env.roots = working(NOON + 6e3)
  h.advance(1e3)
  assert.equal(h.seen.length, n0 + 1)
})

test('a throwing subscriber does not break the others', () => {
  const store = fakeStore({ loads: [{ status: 'ok', state: withWild('hen') }] })
  const h = harness({ store })
  h.engine.subscribe(() => { throw new Error('closed socket') })
  h.engine.start()
  assert.equal(h.engine.act({ type: 'catch', wildId: 'abc123' }).status, 200)
  assert.equal(h.seen.at(-1).attempt.wildId, 'abc123')
})

test('stop clears the timer', () => {
  const h = harness()
  h.engine.start()
  h.engine.stop()
  assert.equal(h.ticking, false)
})

// ---------- dev ----------

test('devAct is refused outside dev mode', () => {
  const h = harness()
  h.engine.start()
  assert.equal(h.engine.devAct({ spawn: 'dragon' }).status, 404)
})

test('dev spawn by species or tier, refused during an attempt', () => {
  const h = harness({ dev: true })
  h.engine.start()
  const r = h.engine.devAct({ spawn: 'dragon' })
  assert.equal(r.status, 200)
  assert.equal(r.body.wild.species, 'dragon')
  assert.match(r.body.wild.id, /^[0-9a-f]{6}$/)
  assert.equal(r.body.wild.stayLeftMs, TIERS.legendary.stayMs)
  const t = h.engine.devAct({ spawn: 'epic' })
  assert.equal(SPECIES.find((s) => s.id === t.body.wild.species).tier, 'epic')
  assert.equal(h.engine.devAct({ spawn: 'nessie' }).status, 400)
  h.engine.act({ type: 'catch', wildId: t.body.wild.id })
  assert.deepEqual(h.engine.devAct({ spawn: 'hen' }), { status: 400, body: { error: 'attempt_active' } })
  assert.ok(A.validateState(h.lastSaved()).attempt, 'saved dev state stays valid')
})

test('dev work fast-forwards an attempt and resolves it at once', () => {
  const h = harness({ dev: true })
  h.engine.start()
  const w = h.engine.devAct({ spawn: 'fox' }).body.wild
  h.engine.act({ type: 'catch', wildId: w.id })
  assert.equal(h.engine.devAct({ work: 60e3 }).body.attempt.workMs, 60e3)
  const done = h.engine.devAct({ work: TIERS.rare.needMs })
  assert.equal(done.body.attempt, null)
  assert.equal(done.body.caught.length, 1)
  for (const bad of [0, -5, 'x', 1e12]) assert.equal(h.engine.devAct({ work: bad }).status, 400, String(bad))
  assert.deepEqual(h.engine.devAct({ work: 1000 }), { status: 400, body: { error: 'no_attempt' } })
  assert.equal(h.engine.devAct({}).status, 400)
})

// ---- review findings: invalid or lossy loads, read errors ----

const tmpDir = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'terrarium-engine-')), '.claude-terrarium')
const { createStore, decrypt } = require('../lib/animal-store.js')
const AAD = 'ai-terrarium/animals'
const badOf = (dir) => fs.readdirSync(dir).filter((x) => x.includes('.bad-')).sort()
const decryptFile = (dir, f) => decrypt(fs.readFileSync(path.join(dir, 'animals.key')), fs.readFileSync(path.join(dir, f), 'utf8'), AAD)
const realHarness = (dir) => harness({ store: createStore({ dir }) })

test('load passes animals.validateState to the store', () => {
  const h = harness()
  h.engine.start()
  assert.equal(h.store.loadArgs[0].validate, A.validateState)
})

test('real store: an authentic state that fails validation is kept as .bad, not lost after two saves', () => {
  const dir = tmpDir(), seed = createStore({ dir })
  seed.load()
  assert.equal(seed.save({ spawnNo: 3, caught: { legacy: 'shape' }, total: 42 }).ok, true)
  const h = realHarness(dir)
  h.engine.start()
  assert.equal(h.engine.view().notice.type, 'reset')
  h.engine.flush(); h.engine.flush()
  const kept = badOf(dir).map((f) => decryptFile(dir, f)).filter(Boolean)
  assert.ok(kept.some((s) => s.total === 42), JSON.stringify(badOf(dir)))
})

test('real store: records dropped by validation are kept once in a .bad copy, with a notice', () => {
  const dir = tmpDir(), seed = createStore({ dir })
  seed.load()
  const caught = [{ id: 'a7f3c2', species: 'fox', at: 1 }, { id: 'b7f3c2', species: 'Not A Species!', at: 2 }]
  assert.equal(seed.save(savedState({ caught, total: 2 })).ok, true)
  const original = fs.readFileSync(path.join(dir, 'animals.dat'), 'utf8')
  const h = realHarness(dir)
  h.engine.start()
  assert.equal(h.engine.view().notice.type, 'repaired')
  const bad = badOf(dir)
  assert.equal(bad.length, 1)
  assert.equal(fs.readFileSync(path.join(dir, bad[0]), 'utf8'), original)
  assert.equal(createStore({ dir }).load().state.caught.length, 1, 'cleaned state saved at once')

  const again = realHarness(dir)
  again.engine.start()
  assert.equal(again.engine.view().notice, null)
  assert.equal(badOf(dir).length, 1, 'only once')
})

test('lossy load whose copy cannot be kept: nothing saved, retried later', () => {
  const lossy = savedState({ caught: [{ id: 'b7f3c2', species: 'Not A Species!', at: 2 }] })
  const store = fakeStore({ loads: [{ status: 'ok', state: lossy }], keepOk: false })
  const h = harness({ store })
  h.engine.start()
  assert.equal(store.saves.length, 0)
  assert.deepEqual(h.engine.view(), { disabled: true, error: 'io' })
})

test('a load io error disables for now and retries every 15 s', () => {
  const store = fakeStore({ loads: [{ status: 'disabled', state: null, error: 'io' }, { status: 'ok', state: withWild('fox') }] })
  const h = harness({ store })
  h.engine.start()
  assert.deepEqual(h.engine.view(), { disabled: true, error: 'io' })
  assert.equal(h.ticking, true)
  assert.equal(store.saves.length, 0)
  h.advance(14e3)
  assert.equal(store.loadCount, 1)
  h.advance(1e3)
  assert.equal(store.loadCount, 2)
  assert.equal(h.engine.view().wild.species, 'fox')
  assert.equal(h.seen.at(-1).wild.species, 'fox', 'open streams learn it is back')
})

test('a reload that hits an io error keeps retrying instead of staying off', () => {
  const store = fakeStore({
    loads: [{ status: 'ok', state: withWild('hen') }, { status: 'disabled', state: null, error: 'io' }, { status: 'ok', state: withWild('deer', { seq: 20 }) }],
    saveResults: [{ ok: false, conflict: true }],
  })
  const h = harness({ store })
  h.engine.start()
  assert.equal(h.engine.act({ type: 'catch', wildId: 'abc123' }).status, 409)
  assert.deepEqual(h.engine.view(), { disabled: true, error: 'io' })
  h.advance(15e3)
  assert.equal(h.engine.view().wild.species, 'deer')
})
