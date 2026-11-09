'use strict'
// isWorking input (spec 5.2), built on the office's own status rules but uncapped, and keeping roots a non-empty
// registry no longer lists (rule 3). Registry-only sessions are left out: one file is enough to fake them.
const path = require('path')
const { parentFromPath, modeOf, sessionStatus, subOutcome } = require('./status.js')

const WORK_STATES = new Set(['working', 'thinking', 'talking'])
const BUSY_FRESH_MS = 60 * 60e3

const isSub = (st) => !!parentFromPath(st.file) || !!st.sidechain
const rootIdOf = (st) => st.sessionId || path.basename(st.file, '.jsonl')
const parentIdOf = (st) => parentFromPath(st.file) || st.sessionId || null
const newer = (a, b) => ((a.lastTs || 0) !== (b.lastTs || 0) ? (a.lastTs || 0) > (b.lastTs || 0) : (a.fileMtime || 0) > (b.fileMtime || 0))
const lastSeen = (st) => Math.max(st.lastTs || 0, ...[...st.pending.values()].map((p) => p.t || 0))

// Two root transcripts with one sessionId (a resumed session): the newest wins, as in the office.
function newestRoots(states) {
  const roots = new Map()
  for (const st of states) {
    if (isSub(st)) continue
    const cur = roots.get(rootIdOf(st))
    if (!cur || newer(st, cur)) roots.set(rootIdOf(st), st)
  }
  return roots
}

function kidsOf(states, roots, { now, permMs }) {
  const kids = new Map()
  for (const st of states) {
    if (!isSub(st)) continue
    const parentId = parentIdOf(st), parentSt = roots.get(parentId)
    const outcome = subOutcome(st, { now, parentInterruptedAt: parentSt ? parentSt.interruptedAt : 0 })
    const { status } = sessionStatus(st, { now, permMs, mode: modeOf(st, parentSt) })
    const active = outcome === 'keep' && WORK_STATES.has(status)
    // Finished sub-agents still count toward freshness (a foreground Agent call writes nothing on the root).
    const had = kids.get(parentId) || { fresh: 0, active: false }
    kids.set(parentId, { fresh: Math.max(had.fresh, lastSeen(st)), active: had.active || active })
  }
  return kids
}

function animalRootsFrom(fileStates, live, now, { permMs, activeMs }) {
  const states = [...fileStates].filter((st) => {
    const aliveTs = Math.max(st.fileMtime || 0, st.lastTs || 0)
    return aliveTs && now - aliveTs <= activeMs
  })
  const roots = newestRoots(states)
  const kids = kidsOf(states, roots, { now, permMs })
  return [...roots].map(([id, st]) => {
    const reg = live && live.has(id) ? live.get(id) : null
    const regBusy = reg ? reg.status === 'busy' : null
    let { status } = sessionStatus(st, { now, permMs, mode: modeOf(st, null), regStatus: reg ? reg.status : undefined })
    const kid = kids.get(id) || { fresh: 0, active: false }
    if (status === 'working' && st.pending.size === 0 && kid.active) status = 'waiting'
    const anchor = Math.max(st.lastTs || 0, lastSeen(st), kid.fresh)
    // lib/animals.js gates on 10 minutes; registry busy stretches that to 60 for long silent Bash/Agent calls.
    const lastTs = regBusy === true && now - anchor <= BUSY_FRESH_MS ? now : anchor
    return { hasTranscript: true, lastTs, regBusy, status, kidsActive: kid.active }
  })
}

module.exports = { animalRootsFrom }
