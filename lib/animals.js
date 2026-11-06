'use strict'
// Wild animal rules (spec 2026-11-05-animal-catch-design.md): pure functions, no clock, no disk, no Math.random.

const freezeAll = (list) => Object.freeze(list.map((o) => Object.freeze({ ...o })))

const TIERS = Object.freeze({
  common: Object.freeze({ stayMs: 180e3, needMs: 3 * 60e3, deadlineMs: 20 * 60e3 }),
  rare: Object.freeze({ stayMs: 150e3, needMs: 8 * 60e3, deadlineMs: 40 * 60e3 }),
  epic: Object.freeze({ stayMs: 120e3, needMs: 15 * 60e3, deadlineMs: 75 * 60e3 }),
  legendary: Object.freeze({ stayMs: 90e3, needMs: 30 * 60e3, deadlineMs: 150 * 60e3 }),
})
const TIER_ORDER = Object.freeze(['common', 'rare', 'epic', 'legendary'])

// cond: null | 'day' | 'night' | 'norain' | 'rain' | 'snow' (rain/snow = x3 in that weather, /5 otherwise)
const SPECIES = freezeAll([
  { id: 'hen', tier: 'common', weight: 18, cond: null },
  { id: 'duck', tier: 'common', weight: 14, cond: null },
  { id: 'rabbit', tier: 'common', weight: 14, cond: 'norain' },
  { id: 'tabby', tier: 'common', weight: 12, cond: null },
  { id: 'squirrel', tier: 'common', weight: 10, cond: 'day' },
  { id: 'fox', tier: 'rare', weight: 8, cond: null },
  { id: 'redpanda', tier: 'rare', weight: 6, cond: null },
  { id: 'frog', tier: 'rare', weight: 5, cond: 'rain' },
  { id: 'owl', tier: 'rare', weight: 5, cond: 'night' },
  { id: 'deer', tier: 'epic', weight: 3, cond: null },
  { id: 'peacock', tier: 'epic', weight: 2, cond: 'day' },
  { id: 'snowfox', tier: 'epic', weight: 2, cond: 'snow' },
  { id: 'unicorn', tier: 'legendary', weight: 0.6, cond: null },
  { id: 'dragon', tier: 'legendary', weight: 0.4, cond: null },
])
const LIMITS = Object.freeze({ collection: 50, out: 5, pendingMs: 24 * 3600e3, maxTickMs: 2000,
  waitMinMs: 4 * 60e3, waitMaxMs: 10 * 60e3, firstWaitMinMs: 30e3, firstWaitMaxMs: 90e3 })

const RECENT_MS = 10 * 60e3
const EXPIRING_SHARE = 0.1
const WORKING = new Set(['working', 'thinking', 'talking'])
const ID_RE = /^[0-9a-f]{6}$/
const SPECIES_RE = /^[a-z][a-z0-9_-]{0,31}$/
const BY_ID = new Map(SPECIES.map((s) => [s.id, s]))

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string' && v.length > 0
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
const unit = (u) => (Number.isFinite(u) ? clamp(u, 0, 1 - Number.EPSILON) : 0)
const tierOf = (species) => TIERS[BY_ID.get(species).tier]
const isNightHour = (hour) => hour >= 18 || hour < 6

function weightOf(s, night, weather) {
  if ((s.cond === 'day' && night) || (s.cond === 'night' && !night)) return 0
  if (s.cond === 'norain' && weather === 'rain') return 0
  if (s.cond === 'rain' || s.cond === 'snow') return s.cond === weather ? s.weight * 3 : s.weight / 5
  return s.weight
}

function weights(conds) {
  const { night, weather } = isObj(conds) ? conds : {}
  const w = weather === 'storm' ? 'rain' : weather === 'rain' || weather === 'snow' ? weather : 'clear'
  return SPECIES.map((s) => ({ id: s.id, w: weightOf(s, !!night, w) })).filter((x) => x.w > 0)
}

function pickSpecies(u, conds) {
  const list = weights(conds)
  const total = list.reduce((a, x) => a + x.w, 0)
  let left = unit(u) * total
  for (const x of list) { left -= x.w; if (left < 0) return x.id }
  return list[list.length - 1].id
}

function initialState(u) {
  const { firstWaitMinMs: lo, firstWaitMaxMs: hi } = LIMITS
  return { seq: 0, spawnNo: 0, caught: [], out: [], speciesCaught: [], total: 0,
    waitLeftMs: Math.round(lo + unit(u) * (hi - lo)), wild: null, attempt: null }
}

// Uses the ended wild's own draw: (u1 + u2) mod 1 is uniform and says nothing about the next spawn.
function nextWait(rand, spawnNo) {
  const pair = typeof rand === 'function' ? rand(spawnNo) : null
  if (!Array.isArray(pair)) return LIMITS.waitMaxMs
  const f = (unit(pair[0]) + unit(pair[1])) % 1
  return Math.round(LIMITS.waitMinMs + f * (LIMITS.waitMaxMs - LIMITS.waitMinMs))
}

// Every terminal path (leave, caught, escaped, giveup, cancel, expiry) ends here.
const endWild = (state, rand) => ({ ...state, wild: null, attempt: null, waitLeftMs: nextWait(rand, state.spawnNo) })

function uniqueId(u, caught) {
  const taken = new Set(caught.map((c) => c.id))
  let n = Math.floor(unit(u) * 0x1000000)
  while (taken.has(n.toString(16).padStart(6, '0'))) n = (n + 1) % 0x1000000
  return n.toString(16).padStart(6, '0')
}

function addCaught(state, now) {
  const { id, species } = state.wild
  const newSpecies = !state.speciesCaught.includes(species)
  const next = { ...state,
    caught: [...state.caught, { id, species, at: Number.isFinite(now) ? now : 0 }],
    out: state.out.length < LIMITS.out ? [...state.out, id] : state.out,
    speciesCaught: newSpecies ? [...state.speciesCaught, species] : state.speciesCaught,
    total: state.total + 1 }
  return { state: next, event: { type: 'caught', id, species, newSpecies } }
}

function rootWorking(r, nowMs) {
  if (!isObj(r) || r.hasTranscript !== true || !Number.isFinite(r.lastTs) || nowMs - r.lastTs > RECENT_MS) return false
  if (typeof r.regBusy === 'boolean') return r.regBusy
  return WORKING.has(r.status) || (r.status === 'waiting' && r.kidsActive === true)
}

const isWorking = (roots, nowMs) => Array.isArray(roots) && roots.some((r) => rootWorking(r, nowMs))

function tickCatching(state, dt, working, rand, now) {
  const a = state.attempt, deadlineMs = tierOf(state.wild.species).deadlineMs
  const workMs = working ? Math.min(a.needMs, a.workMs + dt) : a.workMs
  const deadlineLeftMs = Math.max(0, a.deadlineLeftMs - dt)
  if (workMs >= a.needMs) {
    if (state.caught.length >= LIMITS.collection) {
      const attempt = { ...a, workMs, deadlineLeftMs, phase: 'pending', pendingLeftMs: LIMITS.pendingMs }
      return { state: { ...state, attempt }, events: [{ type: 'pending', species: state.wild.species }] }
    }
    const r = addCaught(state, now)
    return { state: endWild(r.state, rand), events: [r.event] }
  }
  if (deadlineLeftMs <= 0) return { state: endWild(state, rand), events: [{ type: 'escaped', species: state.wild.species }] }
  const edge = deadlineMs * EXPIRING_SHARE
  const expiring = a.deadlineLeftMs > edge && deadlineLeftMs <= edge
  const minute = Math.floor(workMs / 60e3) > Math.floor(a.workMs / 60e3)
  const next = { ...state, attempt: { ...a, workMs, deadlineLeftMs } }
  const events = minute || expiring ? [{ type: 'progress', workMs, needMs: a.needMs, deadlineLeftMs, expiring }] : []
  return { state: next, events }
}

function tickPending(state, dt, rand) {
  const pendingLeftMs = Math.max(0, state.attempt.pendingLeftMs - dt)
  if (pendingLeftMs <= 0) return { state: endWild(state, rand), events: [{ type: 'pendingExpired', species: state.wild.species }] }
  return { state: { ...state, attempt: { ...state.attempt, pendingLeftMs } }, events: [] }
}

function tickWild(state, dt, rand) {
  const stayLeftMs = Math.max(0, state.wild.stayLeftMs - dt)
  if (stayLeftMs <= 0) return { state: endWild(state, rand), events: [{ type: 'leave', species: state.wild.species }] }
  return { state: { ...state, wild: { ...state.wild, stayLeftMs } }, events: [] }
}

function tickWait(state, dt, conds, rand) {
  const waitLeftMs = Math.max(0, state.waitLeftMs - dt)
  if (waitLeftMs > 0) return { state: { ...state, waitLeftMs }, events: [] }
  const spawnNo = state.spawnNo + 1
  const pair = typeof rand === 'function' ? rand(spawnNo) : null
  const [u1, u2] = Array.isArray(pair) ? pair : [0, 0]
  const species = pickSpecies(u1, conds)
  const wild = { id: uniqueId(u2, state.caught), species, stayLeftMs: tierOf(species).stayMs }
  return { state: { ...state, spawnNo, waitLeftMs: 0, wild }, events: [{ type: 'spawn', wild: { ...wild } }] }
}

function clampDt(dtMs) {
  return typeof dtMs === 'number' && !Number.isNaN(dtMs) ? clamp(dtMs, 0, LIMITS.maxTickMs) : 0
}

// ctx.now (optional, ms) only stamps `at` on new collection records.
function tick(state, { dtMs, visible, working, night, weather, rand, now } = {}) {
  const dt = clampDt(dtMs)
  if (state.attempt && state.attempt.phase === 'pending') return tickPending(state, dt, rand)
  if (state.attempt) return tickCatching(state, dt, working === true, rand, now)
  if (visible !== true) return { state, events: [] }
  if (state.wild) return tickWild(state, dt, rand)
  return tickWait(state, dt, { night, weather }, rand)
}

const fail = (error) => ({ error })
const findCaught = (state, id) => state.caught.find((c) => c.id === id)

function doCatch(state, { wildId }) {
  if (!isStr(wildId)) return fail('bad_action')
  if (state.attempt) return fail('attempt_active')
  if (!state.wild) return fail('no_wild')
  if (state.wild.id !== wildId) return fail('wrong_wild')
  const { needMs, deadlineMs } = tierOf(state.wild.species)
  const attempt = { wildId, needMs, workMs: 0, deadlineLeftMs: deadlineMs, phase: 'catching', pendingLeftMs: 0 }
  return { state: { ...state, attempt }, events: [{ type: 'catchStarted', species: state.wild.species, needMs }] }
}

function doGiveup(state, { wildId }, { rand }) {
  if (!isStr(wildId)) return fail('bad_action')
  if (!state.attempt) return fail('no_attempt')
  if (state.attempt.phase === 'pending') return fail('pending')
  if (state.attempt.wildId !== wildId) return fail('wrong_wild')
  return { state: endWild(state, rand), events: [{ type: 'gaveUp', species: state.wild.species }] }
}

function doRelease(state, { id }) {
  if (!isStr(id)) return fail('bad_action')
  const rec = findCaught(state, id)
  if (!rec) return fail('unknown_id')
  if (state.out.includes(id)) return fail('already_out')
  if (!BY_ID.has(rec.species)) return fail('unknown_species')
  if (state.out.length >= LIMITS.out) return fail('out_full')
  return { state: { ...state, out: [...state.out, id] }, events: [{ type: 'released', id, species: rec.species }] }
}

function doRecall(state, { id }) {
  if (!isStr(id)) return fail('bad_action')
  const rec = findCaught(state, id)
  if (!rec) return fail('unknown_id')
  if (!state.out.includes(id)) return fail('not_out')
  return { state: { ...state, out: state.out.filter((x) => x !== id) }, events: [{ type: 'recalled', id, species: rec.species }] }
}

const removeCaught = (state, id) => ({ ...state, caught: state.caught.filter((c) => c.id !== id), out: state.out.filter((x) => x !== id) })

// Freeing is refused while a full-collection choice is pending; resolve is the way out of that state.
function doFree(state, { id }) {
  if (!isStr(id)) return fail('bad_action')
  if (state.attempt && state.attempt.phase === 'pending') return fail('pending')
  const rec = findCaught(state, id)
  if (!rec) return fail('unknown_id')
  return { state: removeCaught(state, id), events: [{ type: 'freed', id, species: rec.species }] }
}

function doResolve(state, { freeId, cancel }, { rand, now }) {
  const byFree = isStr(freeId), byCancel = cancel === true
  if (byFree === byCancel || (cancel !== undefined && !byCancel)) return fail('bad_action')
  if (!state.attempt || state.attempt.phase !== 'pending') return fail('no_pending')
  if (byCancel) return { state: endWild(state, rand), events: [{ type: 'cancelled', species: state.wild.species }] }
  const rec = findCaught(state, freeId)
  if (!rec) return fail('unknown_id')
  const r = addCaught(removeCaught(state, freeId), now)
  return { state: endWild(r.state, rand), events: [{ type: 'freed', id: freeId, species: rec.species }, r.event] }
}

const ACTIONS = new Map([['catch', doCatch], ['giveup', doGiveup], ['release', doRelease],
  ['recall', doRecall], ['free', doFree], ['resolve', doResolve]])

// ctx: { rand, now? }; rand ends a wild (next wait), now stamps `at` on a resolved catch.
function apply(state, action, ctx = {}) {
  const fn = isObj(action) ? ACTIONS.get(action.type) : undefined
  return fn ? fn(state, action, ctx) : fail('bad_action')
}

const count = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null)
const ms = (v, hi, dflt) => (Number.isFinite(v) ? clamp(v, 0, hi) : dflt)

function cleanCaught(list) {
  const seen = new Set(), out = []
  for (const c of list) {
    if (!isObj(c) || typeof c.id !== 'string' || !ID_RE.test(c.id) || seen.has(c.id)) continue
    if (typeof c.species !== 'string' || !SPECIES_RE.test(c.species)) continue
    seen.add(c.id)
    out.push({ id: c.id, species: c.species, at: Number.isFinite(c.at) ? c.at : 0 })
  }
  return out
}

// Over the cap, island animals are kept first, then the oldest records, in their original order.
// Unknown species may not stay out: the page cannot draw them and would show a wrong out count.
function capCaught(caught, rawOut) {
  const ids = new Set(caught.filter((c) => BY_ID.has(c.species)).map((c) => c.id))
  const out = [...new Set(Array.isArray(rawOut) ? rawOut : [])].filter((id) => ids.has(id)).slice(0, LIMITS.out)
  const room = LIMITS.collection - out.length
  const keep = new Set([...out, ...caught.filter((c) => !out.includes(c.id)).slice(0, room).map((c) => c.id)])
  return { caught: caught.filter((c) => keep.has(c.id)), out }
}

function cleanWild(w, caught) {
  if (!isObj(w) || typeof w.id !== 'string' || !ID_RE.test(w.id) || !BY_ID.has(w.species)) return null
  if (caught.some((c) => c.id === w.id)) return null
  return { id: w.id, species: w.species, stayLeftMs: ms(w.stayLeftMs, tierOf(w.species).stayMs, 0) }
}

function cleanAttempt(a, wild) {
  if (!isObj(a) || !wild || a.wildId !== wild.id || (a.phase !== 'catching' && a.phase !== 'pending')) return null
  const { needMs, deadlineMs } = tierOf(wild.species)
  return { wildId: wild.id, needMs, workMs: ms(a.workMs, needMs, 0), deadlineLeftMs: ms(a.deadlineLeftMs, deadlineMs, 0),
    phase: a.phase, pendingLeftMs: ms(a.pendingLeftMs, LIMITS.pendingMs, LIMITS.pendingMs) }
}

function buildState(o) {
  const seq = count(o.seq), spawnNo = count(o.spawnNo)
  if (seq === null || spawnNo === null || !Array.isArray(o.caught)) return null
  const { caught, out } = capCaught(cleanCaught(o.caught), o.out)
  const species = Array.isArray(o.speciesCaught) ? o.speciesCaught.filter((s) => typeof s === 'string' && SPECIES_RE.test(s)) : []
  const wild = cleanWild(o.wild, caught)
  return { seq, spawnNo, caught, out, speciesCaught: [...new Set(species)], total: count(o.total) || 0,
    waitLeftMs: ms(o.waitLeftMs, LIMITS.waitMaxMs, LIMITS.waitMaxMs), wild, attempt: cleanAttempt(o.attempt, wild) }
}

// Never throws: decrypted data still passes through here before the rules trust it.
function validateState(obj) {
  try { return isObj(obj) ? buildState(obj) : null } catch { return null }
}

const SPECIES_VIEW = SPECIES.map(({ id, tier, cond }) => ({ id, tier, cond }))

// Unknown-species records stay hidden, but count/full use the real size so the 50/50 flow stays right.
function publicView(state, { working } = {}) {
  const known = state.caught.filter((c) => BY_ID.has(c.species))
  const knownIds = new Set(known.map((c) => c.id))
  const a = state.attempt
  return {
    caught: known.map((c) => ({ ...c })),
    out: state.out.filter((id) => knownIds.has(id)),
    speciesCaught: state.speciesCaught.filter((s) => BY_ID.has(s)),
    total: state.total,
    count: state.caught.length,
    full: state.caught.length >= LIMITS.collection,
    limits: { collection: LIMITS.collection, out: LIMITS.out },
    wild: state.wild ? { ...state.wild } : null,
    attempt: a ? { ...a, counting: working === true && a.phase === 'catching' } : null,
    species: SPECIES_VIEW.map((s) => ({ ...s })),
    tiers: Object.fromEntries(TIER_ORDER.map((t) => [t, { ...TIERS[t] }])),
  }
}

module.exports = { TIERS, TIER_ORDER, SPECIES, LIMITS, isNightHour, weights, pickSpecies, initialState,
  validateState, isWorking, tick, apply, publicView }
