import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const A = require('../lib/animals.js')
const { TIERS, TIER_ORDER, SPECIES, LIMITS } = A

// Deterministic Math.random stand-in (mulberry32).
const rng = seed => () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
// Stand-in for the store's HMAC draw: same spawnNo -> same pair.
const seededRand = (salt = 1) => n => { const r = rng(n * 7919 + salt); return [r(), r()] }
const fixedRand = (u1, u2) => () => [u1, u2]
const deepFreeze = o => { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o) } return o }
const tierOf = id => SPECIES.find(s => s.id === id).tier
const CLEAR_DAY = { night: false, weather: 'clear' }

const base = (over = {}) => deepFreeze({ seq: 3, spawnNo: 4, caught: [], out: [], speciesCaught: [], total: 0,
  waitLeftMs: 60e3, wild: null, attempt: null, ...over })
const hexId = i => i.toString(16).padStart(6, '0')
const rec = (i, species = 'hen') => ({ id: hexId(i), species, at: 1000 + i })
const withWild = (over = {}, wild = {}) => base({ waitLeftMs: 0, wild: { id: 'abc123', species: 'fox', stayLeftMs: 100e3, ...wild }, ...over })
const catching = (over = {}, att = {}) => base({ waitLeftMs: 0, wild: { id: 'abc123', species: 'fox', stayLeftMs: 100e3 },
  attempt: { wildId: 'abc123', needMs: TIERS.rare.needMs, workMs: 0, deadlineLeftMs: TIERS.rare.deadlineMs, phase: 'catching', pendingLeftMs: 0, ...att }, ...over })
const fullCaught = (n = 50) => Array.from({ length: n }, (_, i) => rec(i + 1))
const ctx = (over = {}) => ({ dtMs: 1000, visible: true, working: false, night: false, weather: 'clear', rand: seededRand(), now: 5e12, ...over })
const run = (state, n, over = {}) => {
  let s = state; const events = []
  for (let i = 0; i < n; i++) { const r = A.tick(s, ctx(over)); s = r.state; events.push(...r.events) }
  return { state: s, events }
}

// ---------- tables ----------

test('species table matches spec 3.2', () => {
  assert.equal(SPECIES.length, 14)
  assert.deepEqual(TIER_ORDER, ['common', 'rare', 'epic', 'legendary'])
  const sum = t => SPECIES.filter(s => s.tier === t).reduce((a, s) => a + s.weight, 0)
  assert.ok(Math.abs(SPECIES.reduce((a, s) => a + s.weight, 0) - 100) < 1e-9)
  assert.deepEqual(TIER_ORDER.map(t => Math.round(sum(t) * 10) / 10), [68, 24, 7, 1])
  assert.equal(new Set(SPECIES.map(s => s.id)).size, 14)
  for (const s of SPECIES) assert.ok([null, 'day', 'night', 'norain', 'rain', 'snow'].includes(s.cond), s.id)
  assert.deepEqual(TIERS.legendary, { stayMs: 90e3, needMs: 30 * 60e3, deadlineMs: 150 * 60e3 })
  assert.equal(LIMITS.collection, 50); assert.equal(LIMITS.out, 5); assert.equal(LIMITS.maxTickMs, 2000)
  assert.ok(Object.isFrozen(SPECIES) && Object.isFrozen(SPECIES[0]) && Object.isFrozen(TIERS.common))
})

test('isNightHour: 18:00 to 6:00', () => {
  for (const h of [18, 19, 23, 0, 3, 5]) assert.equal(A.isNightHour(h), true, h)
  for (const h of [6, 7, 12, 17]) assert.equal(A.isNightHour(h), false, h)
})

// ---------- rates (spec 3.4) ----------

const SCENARIOS = [
  ['clear', false], ['clear', true], ['rain', false], ['rain', true], ['snow', false], ['snow', true]]
// Percent per scenario in the order above; null = "—" in the spec table.
const TABLE = {
  hen: ['20,1', '21,8', '20,1', '21,8', '18,9', '20,5'],
  duck: ['15,7', '17,0', '15,7', '17,0', '14,7', '15,9'],
  rabbit: ['15,7', '17,0', null, null, '14,7', '15,9'],
  tabby: ['13,4', '14,6', '13,4', '14,6', '12,6', '13,6'],
  squirrel: ['11,2', null, '11,2', null, '10,5', null],
  fox: ['8,9', '9,7', '8,9', '9,7', '8,4', '9,1'],
  redpanda: ['6,7', '7,3', '6,7', '7,3', '6,3', '6,8'],
  frog: ['1,1', '1,2', '16,8', '18,2', '1,1', '1,1'],
  owl: [null, '6,1', null, '6,1', null, '5,7'],
  deer: ['3,4', '3,6', '3,4', '3,6', '3,2', '3,4'],
  peacock: ['2,2', null, '2,2', null, '2,1', null],
  snowfox: ['0,45', '0,49', '0,45', '0,49', '6,3', '6,8'],
  unicorn: ['0,67', '0,73', '0,67', '0,73', '0,63', '0,68'],
  dragon: ['0,45', '0,49', '0,45', '0,49', '0,42', '0,45'],
}
const TIER_TABLE = {
  common: ['76,1', '70,4', '60,4', '53,4', '71,6', '65,9'],
  rare: ['16,8', '24,3', '32,4', '41,3', '15,8', '22,7'],
  epic: ['6,0', '4,1', '6,0', '4,1', '11,6', '10,2'],
  legendary: ['1,1', '1,2', '1,1', '1,2', '1,1', '1,1'],
}
// Exact share must round to the printed cell (half a unit of its last digit).
const matchesCell = (p, cell, label) => {
  const decimals = cell.split(',')[1].length, printed = Number(cell.replace(',', '.'))
  assert.ok(Math.abs(p * 100 - printed) <= 0.5 * 10 ** -decimals + 1e-9, `${label}: ${(p * 100).toFixed(4)} vs ${cell}`)
}

for (const [i, [weather, night]] of SCENARIOS.entries()) {
  test(`rates match spec 3.4: ${weather} ${night ? 'night' : 'day'} (200,000 draws, ±10 %)`, () => {
    const conds = { night, weather }
    const ws = A.weights(conds), total = ws.reduce((a, x) => a + x.w, 0)
    const exact = Object.fromEntries(ws.map(x => [x.id, x.w / total]))
    for (const [id, cells] of Object.entries(TABLE)) {
      if (cells[i] === null) assert.ok(!(id in exact), `${id} should not appear`)
      else matchesCell(exact[id], cells[i], id)
    }
    for (const [tier, cells] of Object.entries(TIER_TABLE)) {
      matchesCell(ws.filter(x => tierOf(x.id) === tier).reduce((a, x) => a + x.w, 0) / total, cells[i], tier)
    }
    const N = 200000, r = rng(1000 + i), counts = {}
    for (let k = 0; k < N; k++) { const id = A.pickSpecies(r(), conds); counts[id] = (counts[id] || 0) + 1 }
    for (const id of Object.keys(counts)) assert.ok(id in exact, `${id} drawn but excluded`)
    for (const [id, p] of Object.entries(exact)) {
      const got = (counts[id] || 0) / N
      assert.ok(Math.abs(got - p) <= 0.1 * p, `${id}: ${(got * 100).toFixed(3)} % vs ${(p * 100).toFixed(3)} %`)
    }
  })
}

test('conditions: rain/snow multipliers and unknown weather counts as clear', () => {
  const w = (conds, id) => (A.weights(conds).find(x => x.id === id) || {}).w
  assert.equal(w({ night: false, weather: 'rain' }, 'frog'), 15)
  assert.equal(w({ night: false, weather: 'clear' }, 'frog'), 1)
  assert.equal(w({ night: false, weather: 'snow' }, 'snowfox'), 6)
  assert.ok(Math.abs(w({ night: false, weather: 'rain' }, 'snowfox') - 0.4) < 1e-12)
  assert.equal(w({ night: false, weather: 'rain' }, 'rabbit'), undefined)
  assert.equal(w({ night: false, weather: 'snow' }, 'rabbit'), 14)
  assert.deepEqual(A.weights({ night: false, weather: 'storm?' }), A.weights(CLEAR_DAY))
  assert.deepEqual(A.weights({ night: true, weather: 'storm' }), A.weights({ night: true, weather: 'rain' }))
  assert.deepEqual(A.weights({ night: false }), A.weights(CLEAR_DAY))
  assert.deepEqual(A.weights({}), A.weights(CLEAR_DAY))
})

test('pickSpecies covers the edges of [0,1) and never returns an excluded species', () => {
  assert.equal(A.pickSpecies(0, CLEAR_DAY), 'hen')
  assert.equal(A.pickSpecies(0.999999999, CLEAR_DAY), 'dragon')
  assert.equal(A.pickSpecies(1, CLEAR_DAY), 'dragon')
  assert.equal(A.pickSpecies(NaN, CLEAR_DAY), 'hen')
  const r = rng(5)
  for (let k = 0; k < 20000; k++) {
    assert.notEqual(A.pickSpecies(r(), { night: true, weather: 'clear' }), 'squirrel')
    assert.notEqual(A.pickSpecies(r(), { night: false, weather: 'clear' }), 'owl')
    assert.notEqual(A.pickSpecies(r(), { night: true, weather: 'rain' }), 'rabbit')
  }
})

// ---------- initial state ----------

test('initialState: empty, first wait 30-90 s from u', () => {
  const s = A.initialState(0)
  assert.deepEqual(s, { seq: 0, spawnNo: 0, caught: [], out: [], speciesCaught: [], total: 0, waitLeftMs: 30e3, wild: null, attempt: null })
  assert.equal(A.initialState(0.5).waitLeftMs, 60e3)
  assert.ok(A.initialState(0.999999).waitLeftMs <= 90e3)
  assert.equal(A.initialState(NaN).waitLeftMs, 30e3)
  assert.deepEqual(A.validateState(s), s)
})

// ---------- isWorking (spec 5.2) ----------

const NOW = 10_000_000
const root = (over = {}) => ({ hasTranscript: true, lastTs: NOW - 60e3, regBusy: null, status: 'idle', kidsActive: false, ...over })

test('isWorking: registry busy wins, even over a permission status', () => {
  assert.equal(A.isWorking([root({ regBusy: true, status: 'permission' })], NOW), true)
  assert.equal(A.isWorking([root({ regBusy: false, status: 'working' })], NOW), false)
})

test('isWorking: display status when not in the registry', () => {
  for (const status of ['working', 'thinking', 'talking']) assert.equal(A.isWorking([root({ status })], NOW), true, status)
  for (const status of ['permission', 'idle', 'done', 'error', 'waiting', undefined]) assert.equal(A.isWorking([root({ status })], NOW), false, String(status))
  assert.equal(A.isWorking([root({ status: 'waiting', kidsActive: true })], NOW), true)
})

test('isWorking: needs a real transcript with a line in the last 10 minutes', () => {
  assert.equal(A.isWorking([root({ hasTranscript: false, regBusy: true })], NOW), false)
  assert.equal(A.isWorking([root({ regBusy: true, lastTs: NOW - 10 * 60e3 - 1 })], NOW), false)
  assert.equal(A.isWorking([root({ regBusy: true, lastTs: NOW - 10 * 60e3 })], NOW), true)
  assert.equal(A.isWorking([root({ regBusy: true, lastTs: undefined })], NOW), false)
})

test('isWorking: any one root is enough; garbage is ignored', () => {
  assert.equal(A.isWorking([root(), root({ status: 'working' })], NOW), true)
  assert.equal(A.isWorking([], NOW), false)
  assert.equal(A.isWorking(null, NOW), false)
  assert.equal(A.isWorking([null, 5, 'x'], NOW), false)
})

// ---------- tick: wait and spawn ----------

test('spawn is deterministic: rand gets spawnNo + 1, id from u2, stay from tier', () => {
  const calls = []
  const rand = n => { calls.push(n); return [0, 0.5] }
  const { state, events } = A.tick(base({ waitLeftMs: 500 }), ctx({ rand }))
  assert.deepEqual(calls, [5])
  assert.equal(state.spawnNo, 5)
  assert.deepEqual(state.wild, { id: '800000', species: 'hen', stayLeftMs: TIERS.common.stayMs })
  assert.deepEqual(events, [{ type: 'spawn', wild: state.wild }])
  const again = A.tick(base({ waitLeftMs: 500 }), ctx({ rand: seededRand(9) })).state
  assert.deepEqual(A.tick(base({ waitLeftMs: 500 }), ctx({ rand: seededRand(9) })).state, again)
})

test('spawn respects day/night and weather', () => {
  const s = base({ waitLeftMs: 1 })
  assert.equal(A.tick(s, ctx({ rand: fixedRand(0.999, 0), night: true })).state.wild.species, 'dragon')
  const owlU = A.weights({ night: true, weather: 'clear' }), tot = owlU.reduce((a, x) => a + x.w, 0)
  const before = owlU.slice(0, owlU.findIndex(x => x.id === 'owl')).reduce((a, x) => a + x.w, 0)
  const u = (before + 0.5) / tot
  assert.equal(A.tick(s, ctx({ rand: fixedRand(u, 0), night: true })).state.wild.species, 'owl')
  assert.notEqual(A.tick(s, ctx({ rand: fixedRand(u, 0), night: false })).state.wild.species, 'owl')
})

test('spawned id is bumped past ids already in the collection', () => {
  const s = base({ waitLeftMs: 1, caught: [rec(0x800000), rec(0x800001)] })
  assert.equal(A.tick(s, ctx({ rand: fixedRand(0, 0.5) })).state.wild.id, '800002')
  const top = base({ waitLeftMs: 1, caught: [{ id: 'ffffff', species: 'hen', at: 0 }] })
  assert.equal(A.tick(top, ctx({ rand: fixedRand(0, 0.9999999999) })).state.wild.id, '000000')
})

test('wait and stay clocks only run while visible', () => {
  const hidden = run(base({ waitLeftMs: 5000 }), 100, { visible: false })
  assert.equal(hidden.state.waitLeftMs, 5000); assert.equal(hidden.events.length, 0)
  const wild = run(withWild(), 100, { visible: false })
  assert.equal(wild.state.wild.stayLeftMs, 100e3)
  assert.equal(run(base({ waitLeftMs: 5000 }), 3).state.waitLeftMs, 2000)
  assert.equal(run(withWild(), 3).state.wild.stayLeftMs, 97e3)
})

test('dtMs is clamped to [0, 2000]; bad values do nothing', () => {
  assert.equal(A.tick(base({ waitLeftMs: 60e3 }), ctx({ dtMs: 3600e3 })).state.waitLeftMs, 58e3)
  for (const dtMs of [-5000, NaN, undefined, Infinity, '900']) {
    const exp = dtMs === Infinity ? 58e3 : 60e3
    assert.equal(A.tick(base({ waitLeftMs: 60e3 }), ctx({ dtMs })).state.waitLeftMs, exp, String(dtMs))
  }
})

test('no ticks means no time passes (sleep, server off, clock changes)', () => {
  const s = catching({}, { workMs: 1000, deadlineLeftMs: 5000 })
  const { state, events } = A.tick(s, ctx({ dtMs: 8 * 3600e3, working: true }))
  assert.equal(state.attempt.deadlineLeftMs, 3000); assert.equal(state.attempt.workMs, 3000)
  assert.ok(!events.some(e => e.type === 'escaped'))
})

test('wild leaves when stay runs out; next wait is 4-10 min from its own draw', () => {
  const calls = []
  const rand = n => { calls.push(n); return [0.25, 0.5] }
  const { state, events } = A.tick(withWild({}, { stayLeftMs: 1000 }), ctx({ rand }))
  assert.equal(state.wild, null)
  assert.deepEqual(calls, [4])
  assert.equal(state.waitLeftMs, LIMITS.waitMinMs + 0.75 * (LIMITS.waitMaxMs - LIMITS.waitMinMs))
  assert.deepEqual(events, [{ type: 'leave', species: 'fox' }])
})

test('missing rand falls back to the longest wait', () => {
  const r = A.tick(withWild({}, { stayLeftMs: 1000 }), ctx({ rand: undefined }))
  assert.equal(r.state.waitLeftMs, LIMITS.waitMaxMs)
})

test('never a second wild, and no spawn during an attempt or pending choice', () => {
  for (const s of [withWild({ waitLeftMs: 0 }), catching(), catching({}, { phase: 'pending', pendingLeftMs: 3600e3 })]) {
    const { state, events } = run({ ...s, waitLeftMs: 0 }, 200)
    assert.ok(!events.some(e => e.type === 'spawn'), 'spawned')
    assert.equal(state.spawnNo, s.spawnNo)
  }
})

test('restart does not bring the next wild sooner: wait survives a save/load', () => {
  const mid = run(base({ waitLeftMs: 300e3 }), 60).state
  const reloaded = A.validateState(JSON.parse(JSON.stringify(mid)))
  assert.equal(reloaded.waitLeftMs, 240e3)
  assert.equal(run(reloaded, 119).state.wild, null)
})

// ---------- tick: catching ----------

test('work only counts while working; many sessions are still 1 s per s', () => {
  const s = catching()
  assert.equal(run(s, 10, { working: false }).state.attempt.workMs, 0)
  assert.equal(run(s, 10, { working: true }).state.attempt.workMs, 10e3)
  assert.equal(run(s, 10, { working: false }).state.attempt.deadlineLeftMs, TIERS.rare.deadlineMs - 10e3)
  assert.equal(run(s, 10, { visible: false, working: true }).state.attempt.workMs, 10e3)
})

test('wild stays frozen and in place during the attempt', () => {
  assert.equal(run(catching(), 50).state.wild.stayLeftMs, 100e3)
})

test('progress fires on whole work minutes and once when 10 % of the deadline is left', () => {
  const s = catching({}, { workMs: 59e3 })
  const { events } = run(s, 2, { working: true })
  assert.deepEqual(events, [{ type: 'progress', workMs: 60e3, needMs: TIERS.rare.needMs, deadlineLeftMs: TIERS.rare.deadlineMs - 1000, expiring: false }])
  const edge = 0.1 * TIERS.rare.deadlineMs
  const late = run(catching({}, { deadlineLeftMs: edge + 1000 }), 3)
  assert.deepEqual(late.events.map(e => e.expiring), [true])
})

test('enough work before the deadline: caught, auto-released, counters updated', () => {
  const s = catching({ speciesCaught: ['hen'], total: 4 }, { workMs: TIERS.rare.needMs - 500 })
  const { state, events } = A.tick(s, ctx({ working: true, now: 777 }))
  assert.equal(state.wild, null); assert.equal(state.attempt, null)
  assert.deepEqual(state.caught, [{ id: 'abc123', species: 'fox', at: 777 }])
  assert.deepEqual(state.out, ['abc123'])
  assert.deepEqual(state.speciesCaught, ['hen', 'fox'])
  assert.equal(state.total, 5)
  assert.ok(state.waitLeftMs >= LIMITS.waitMinMs && state.waitLeftMs <= LIMITS.waitMaxMs)
  assert.deepEqual(events.filter(e => e.type === 'caught'), [{ type: 'caught', id: 'abc123', species: 'fox', newSpecies: true }])
})

test('caught with 5 already out stays in the collection only; repeat species is not new', () => {
  const caught = [1, 2, 3, 4, 5].map(i => rec(i, 'fox'))
  const s = catching({ caught, out: caught.map(c => c.id), speciesCaught: ['fox'], total: 5 }, { workMs: TIERS.rare.needMs - 1 })
  const { state, events } = A.tick(s, ctx({ working: true }))
  assert.equal(state.caught.length, 6); assert.equal(state.out.length, 5); assert.ok(!state.out.includes('abc123'))
  assert.deepEqual(state.speciesCaught, ['fox'])
  assert.equal(events.find(e => e.type === 'caught').newSpecies, false)
})

test('deadline runs out first: escaped, nothing added', () => {
  const s = catching({}, { workMs: 0, deadlineLeftMs: 1000 })
  const { state, events } = A.tick(s, ctx({ working: true }))
  assert.equal(state.wild, null); assert.equal(state.attempt, null); assert.deepEqual(state.caught, [])
  assert.deepEqual(events, [{ type: 'escaped', species: 'fox' }])
})

test('full collection: success goes pending, counters untouched, deadline ignored', () => {
  const s = catching({ caught: fullCaught(), speciesCaught: ['hen'], total: 50 }, { workMs: TIERS.rare.needMs - 1, deadlineLeftMs: 2000 })
  const { state, events } = A.tick(s, ctx({ working: true }))
  assert.deepEqual(events, [{ type: 'pending', species: 'fox' }])
  assert.equal(state.attempt.phase, 'pending'); assert.equal(state.attempt.pendingLeftMs, LIMITS.pendingMs)
  assert.equal(state.caught.length, 50); assert.equal(state.total, 50); assert.deepEqual(state.speciesCaught, ['hen'])
  const later = run(state, 100)
  assert.equal(later.state.attempt.phase, 'pending'); assert.equal(later.events.length, 0)
  assert.equal(later.state.attempt.pendingLeftMs, LIMITS.pendingMs - 100e3)
})

test('pending expires after 24 h of server time, collection unchanged', () => {
  const s = catching({ caught: fullCaught(), total: 50 }, { phase: 'pending', pendingLeftMs: 1000 })
  const { state, events } = A.tick(s, ctx({ visible: false }))
  assert.deepEqual(events, [{ type: 'pendingExpired', species: 'fox' }])
  assert.equal(state.wild, null); assert.equal(state.attempt, null); assert.equal(state.caught.length, 50); assert.equal(state.total, 50)
})

// ---------- apply ----------

const act = (state, action, extra = {}) => A.apply(state, action, { rand: seededRand(), now: 999, ...extra })

test('catch: only the current wild, only once', () => {
  const ok = act(withWild(), { type: 'catch', wildId: 'abc123' })
  assert.deepEqual(ok.state.attempt, { wildId: 'abc123', needMs: TIERS.rare.needMs, workMs: 0, deadlineLeftMs: TIERS.rare.deadlineMs, phase: 'catching', pendingLeftMs: 0 })
  assert.deepEqual(ok.events, [{ type: 'catchStarted', species: 'fox', needMs: TIERS.rare.needMs }])
  assert.deepEqual(act(base(), { type: 'catch', wildId: 'abc123' }), { error: 'no_wild' })
  assert.deepEqual(act(withWild(), { type: 'catch', wildId: 'ffffff' }), { error: 'wrong_wild' })
  assert.deepEqual(act(catching(), { type: 'catch', wildId: 'abc123' }), { error: 'attempt_active' })
  assert.deepEqual(act(withWild(), { type: 'catch' }), { error: 'bad_action' })
  assert.deepEqual(act(withWild(), { type: 'catch', wildId: 5 }), { error: 'bad_action' })
})

test('giveup: clears the attempt and the wild, sets the next wait', () => {
  const r = act(catching(), { type: 'giveup', wildId: 'abc123' })
  assert.equal(r.state.wild, null); assert.equal(r.state.attempt, null)
  assert.ok(r.state.waitLeftMs >= LIMITS.waitMinMs && r.state.waitLeftMs <= LIMITS.waitMaxMs)
  assert.deepEqual(r.events, [{ type: 'gaveUp', species: 'fox' }])
  assert.deepEqual(act(withWild(), { type: 'giveup', wildId: 'abc123' }), { error: 'no_attempt' })
  assert.deepEqual(act(catching(), { type: 'giveup', wildId: 'zzzzzz' }), { error: 'wrong_wild' })
  assert.deepEqual(act(catching({}, { phase: 'pending', pendingLeftMs: 1 }), { type: 'giveup', wildId: 'abc123' }), { error: 'pending' })
})

test('release / recall: limits and ids', () => {
  const caught = [1, 2, 3, 4, 5, 6].map(i => rec(i))
  const s = base({ caught, out: ['000001', '000002', '000003', '000004'] })
  const r = act(s, { type: 'release', id: '000005' })
  assert.deepEqual(r.state.out, ['000001', '000002', '000003', '000004', '000005'])
  assert.deepEqual(r.events, [{ type: 'released', id: '000005', species: 'hen' }])
  assert.deepEqual(act(r.state, { type: 'release', id: '000006' }), { error: 'out_full' })
  assert.deepEqual(act(s, { type: 'release', id: '000001' }), { error: 'already_out' })
  assert.deepEqual(act(s, { type: 'release', id: 'nope00' }), { error: 'unknown_id' })
  const odd = base({ caught: [{ id: '00000a', species: 'griffin', at: 0 }] })
  assert.deepEqual(act(odd, { type: 'release', id: '00000a' }), { error: 'unknown_species' })
  const back = act(s, { type: 'recall', id: '000002' })
  assert.deepEqual(back.state.out, ['000001', '000003', '000004'])
  assert.deepEqual(back.events, [{ type: 'recalled', id: '000002', species: 'hen' }])
  assert.deepEqual(act(s, { type: 'recall', id: '000006' }), { error: 'not_out' })
  assert.deepEqual(act(s, { type: 'recall', id: 'nope00' }), { error: 'unknown_id' })
})

test('free: removes from collection and island; refused while a full-collection choice is pending', () => {
  const s = base({ caught: [rec(1, 'fox'), rec(2)], out: ['000001'], speciesCaught: ['fox', 'hen'], total: 2 })
  const r = act(s, { type: 'free', id: '000001' })
  assert.deepEqual(r.state.caught, [rec(2)]); assert.deepEqual(r.state.out, [])
  assert.deepEqual(r.state.speciesCaught, ['fox', 'hen']); assert.equal(r.state.total, 2)
  assert.deepEqual(r.events, [{ type: 'freed', id: '000001', species: 'fox' }])
  assert.deepEqual(act(s, { type: 'free', id: 'nope00' }), { error: 'unknown_id' })
  const pend = catching({ caught: fullCaught(), total: 50 }, { phase: 'pending', pendingLeftMs: 1000 })
  assert.deepEqual(act(pend, { type: 'free', id: '000001' }), { error: 'pending' })
})

test('resolve: free one to make room, counters change only now', () => {
  const caught = fullCaught()
  const s = catching({ caught, out: ['000003'], speciesCaught: ['hen'], total: 70 }, { phase: 'pending', pendingLeftMs: 1000 })
  const r = act(s, { type: 'resolve', freeId: '000003' }, { now: 4242 })
  assert.equal(r.state.caught.length, 50)
  assert.ok(!r.state.caught.some(c => c.id === '000003'))
  assert.deepEqual(r.state.caught.at(-1), { id: 'abc123', species: 'fox', at: 4242 })
  assert.deepEqual(r.state.out, ['abc123'])
  assert.deepEqual(r.state.speciesCaught, ['hen', 'fox']); assert.equal(r.state.total, 71)
  assert.equal(r.state.wild, null); assert.equal(r.state.attempt, null)
  assert.deepEqual(r.events, [{ type: 'freed', id: '000003', species: 'hen' }, { type: 'caught', id: 'abc123', species: 'fox', newSpecies: true }])
})

test('resolve: cancel leaves the collection as it was', () => {
  const s = catching({ caught: fullCaught(), total: 50 }, { phase: 'pending', pendingLeftMs: 1000 })
  const r = act(s, { type: 'resolve', cancel: true })
  assert.deepEqual(r.state.caught, s.caught); assert.equal(r.state.total, 50)
  assert.equal(r.state.wild, null); assert.equal(r.state.attempt, null)
  assert.deepEqual(r.events, [{ type: 'cancelled', species: 'fox' }])
})

test('resolve: validation errors', () => {
  const s = catching({ caught: fullCaught(), total: 50 }, { phase: 'pending', pendingLeftMs: 1000 })
  assert.deepEqual(act(catching(), { type: 'resolve', cancel: true }), { error: 'no_pending' })
  assert.deepEqual(act(base(), { type: 'resolve', freeId: '000001' }), { error: 'no_pending' })
  assert.deepEqual(act(s, { type: 'resolve', freeId: 'nope00' }), { error: 'unknown_id' })
  assert.deepEqual(act(s, { type: 'resolve', freeId: '000001', cancel: true }), { error: 'bad_action' })
  assert.deepEqual(act(s, { type: 'resolve' }), { error: 'bad_action' })
  assert.deepEqual(act(s, { type: 'resolve', cancel: 'yes' }), { error: 'bad_action' })
})

test('apply rejects unknown or malformed actions', () => {
  for (const a of [null, 'catch', {}, { type: 'steal' }, { type: 'release' }, { type: 'free', id: {} }, { type: 'toString' }]) {
    assert.deepEqual(act(base({ caught: [rec(1)] }), a), { error: 'bad_action' }, JSON.stringify(a))
  }
})

// ---------- invariants ----------

test('random walk: collection never above 50, out within collection, at most one wild', () => {
  const r = rng(42), ACTIONS = ['catch', 'release', 'recall', 'resolve']
  let s = deepFreeze(base({ caught: fullCaught(46), total: 46, waitLeftMs: 1000 }))
  let caughtEvents = 0, pendings = 0
  for (let step = 0; step < 20000; step++) {
    if (r() < 0.6) {
      const res = A.tick(s, ctx({ dtMs: 2000, working: r() < 0.9, visible: r() < 0.8, rand: seededRand(3), night: r() < 0.5 }))
      caughtEvents += res.events.filter(e => e.type === 'caught').length
      pendings += res.events.filter(e => e.type === 'pending').length
      s = deepFreeze(res.state)
    } else {
      const roll = r(), type = roll < 0.003 ? 'giveup' : roll < 0.004 ? 'free' : ACTIONS[Math.floor(r() * ACTIONS.length)]
      const pickId = () => (s.caught[Math.floor(r() * s.caught.length)] || {}).id || 'nope00'
      const action = type === 'catch' || type === 'giveup' ? { type, wildId: s.wild ? s.wild.id : 'nope00' }
        : type === 'resolve' ? (r() < 0.5 ? { type, cancel: true } : { type, freeId: pickId() }) : { type, id: pickId() }
      const res = act(s, action)
      if (!res.error) s = deepFreeze(res.state)
    }
    const ids = s.caught.map(c => c.id)
    assert.ok(s.caught.length <= 50); assert.ok(s.out.length <= 5)
    assert.equal(new Set(ids).size, ids.length)
    assert.ok(s.out.every(id => ids.includes(id)))
    assert.ok(!s.attempt || (s.wild && s.attempt.wildId === s.wild.id))
    assert.deepEqual(A.validateState(s), s)
  }
  assert.ok(caughtEvents > 3, `only ${caughtEvents} catches`)
  assert.ok(pendings > 0, 'never reached the full-collection choice')
})

// ---------- validateState ----------

test('validateState rejects garbage without throwing', () => {
  const evil = { get seq() { throw new Error('boom') } }
  for (const g of [null, undefined, 42, 'x', [], {}, { seq: 'x', spawnNo: 0, caught: [] }, { seq: 0, spawnNo: -1, caught: [] },
    { seq: 0, spawnNo: 0, caught: 'no' }, { seq: 1.5, spawnNo: 0, caught: [] }, evil]) {
    assert.equal(A.validateState(g), null)
  }
})

test('validateState fills defaults and drops bad records', () => {
  const s = A.validateState({ seq: 2, spawnNo: 1, caught: [rec(1), { id: 'XYZ', species: 'hen' }, null, rec(1), { id: '000002', species: 7 }, { id: '000003', species: 'hen', at: 'x' }],
    out: ['000001', '000001', 'zzzzzz', 3], speciesCaught: ['hen', 'hen', 5, 'griffin'], total: -4, waitLeftMs: 99e9, wild: 'x', attempt: { phase: 'catching' }, extra: 1 })
  assert.deepEqual(s, { seq: 2, spawnNo: 1, caught: [rec(1), { id: '000003', species: 'hen', at: 0 }], out: ['000001'],
    speciesCaught: ['hen', 'griffin'], total: 0, waitLeftMs: LIMITS.waitMaxMs, wild: null, attempt: null })
})

test('validateState keeps unknown-species records but not on the island', () => {
  const s = A.validateState(base({ caught: [{ id: '00000a', species: 'griffin', at: 5 }, rec(1)], out: ['00000a', '000001'] }))
  assert.deepEqual(s.caught, [{ id: '00000a', species: 'griffin', at: 5 }, rec(1)]); assert.deepEqual(s.out, ['000001'])
})

test('validateState caps out at 5 and caught at 50, keeping released ones', () => {
  const caught = fullCaught(60), out = ['00003c', '00003b', '00003a', '000039', '000038', '000037', '000001']
  const s = A.validateState({ ...base(), caught, out })
  assert.deepEqual(s.out, ['00003c', '00003b', '00003a', '000039', '000038'])
  assert.equal(s.caught.length, 50)
  for (const id of s.out) assert.ok(s.caught.some(c => c.id === id), id)
  assert.deepEqual(s.caught.slice(0, 45), caught.slice(0, 45))
})

test('validateState repairs wild and attempt', () => {
  assert.equal(A.validateState({ ...base(), wild: { id: 'abc123', species: 'griffin', stayLeftMs: 1 } }).wild, null)
  const w = A.validateState({ ...base(), wild: { id: 'abc123', species: 'fox', stayLeftMs: 9e9 } }).wild
  assert.deepEqual(w, { id: 'abc123', species: 'fox', stayLeftMs: TIERS.rare.stayMs })
  const orphan = A.validateState({ ...base(), attempt: catching().attempt })
  assert.equal(orphan.attempt, null)
  const mism = A.validateState({ ...catching(), attempt: { ...catching().attempt, wildId: 'ffffff' } })
  assert.equal(mism.attempt, null); assert.ok(mism.wild)
  const fixed = A.validateState({ ...catching(), attempt: { ...catching().attempt, needMs: 1, workMs: 9e9, deadlineLeftMs: 9e9 } })
  assert.deepEqual(fixed.attempt, { wildId: 'abc123', needMs: TIERS.rare.needMs, workMs: TIERS.rare.needMs, deadlineLeftMs: TIERS.rare.deadlineMs, phase: 'catching', pendingLeftMs: 0 })
  const pend = A.validateState({ ...catching(), attempt: { ...catching().attempt, phase: 'pending', pendingLeftMs: 9e12 } })
  assert.equal(pend.attempt.pendingLeftMs, LIMITS.pendingMs)
  assert.equal(A.validateState({ ...catching(), attempt: { ...catching().attempt, phase: 'odd' } }).attempt, null)
  const dupe = A.validateState({ ...withWild(), caught: [{ id: 'abc123', species: 'fox', at: 0 }] })
  assert.equal(dupe.wild, null)
})

// ---------- publicView ----------

test('publicView: no seq, spawnNo or wait; hides unknown species but counts them', () => {
  const s = catching({ caught: [rec(1, 'fox'), { id: '00000a', species: 'griffin', at: 0 }], out: ['000001', '00000a'], speciesCaught: ['fox', 'griffin'], total: 9 }, { workMs: 3000 })
  const v = A.publicView(s, { working: true })
  for (const k of ['seq', 'spawnNo', 'waitLeftMs']) assert.ok(!(k in v), k)
  assert.deepEqual(v.caught, [rec(1, 'fox')]); assert.deepEqual(v.out, ['000001'])
  assert.deepEqual(v.speciesCaught, ['fox']); assert.equal(v.total, 9)
  assert.equal(v.count, 2); assert.equal(v.full, false)
  assert.deepEqual(v.limits, { collection: 50, out: 5 })
  assert.deepEqual(v.wild, { id: 'abc123', species: 'fox', stayLeftMs: 100e3 })
  assert.deepEqual(v.attempt, { wildId: 'abc123', needMs: TIERS.rare.needMs, workMs: 3000, deadlineLeftMs: TIERS.rare.deadlineMs, phase: 'catching', pendingLeftMs: 0, counting: true })
  assert.equal(A.publicView(s, { working: false }).attempt.counting, false)
  assert.equal(v.species.length, 14); assert.deepEqual(v.species[0], { id: 'hen', tier: 'common', cond: null })
  assert.equal(v.tiers.legendary.needMs, TIERS.legendary.needMs)
  assert.ok(!JSON.stringify(v).includes('weight'))
  assert.equal(JSON.stringify(v).includes('"seq"'), false)
})

test('publicView: full flag and pending phase are not counting', () => {
  const v = A.publicView(catching({ caught: fullCaught() }, { phase: 'pending', pendingLeftMs: 5 }), { working: true })
  assert.equal(v.count, 50); assert.equal(v.full, true); assert.equal(v.attempt.counting, false)
  const empty = A.publicView(base(), { working: false })
  assert.equal(empty.wild, null); assert.equal(empty.attempt, null)
})
