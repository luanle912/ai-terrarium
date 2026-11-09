'use strict'
// publicView: the only code path that decides what leaves this machine.
// Every output object is BUILT from an allowlist; nothing is copied and then deleted.
const crypto = require('crypto')

const STATUSES = ['working', 'thinking', 'talking', 'permission', 'waiting', 'idle', 'error', 'done']
const KINDS = ['shell', 'edit', 'read', 'web', 'agent', 'mcp', 'other', 'none']
const MAX_SESSIONS = 32
const DEPT_LETTERS = 'ABCDEFGHIJKLMNOP'
const DEPT_NAME_RE = /^[\p{L}\p{N} ._-]{1,40}$/u
const MODEL_RE = /^claude-[a-z0-9.-]{1,40}$/

const KIND_BY_TOOL = {
  Bash: 'shell',
  Edit: 'edit', Write: 'edit', MultiEdit: 'edit', NotebookEdit: 'edit',
  Read: 'read', Grep: 'read', Glob: 'read', LS: 'read',
  WebFetch: 'web', WebSearch: 'web',
  Agent: 'agent', Task: 'agent', SendMessage: 'agent',
}

function kindOf(tool) {
  if (typeof tool !== 'string' || !tool) return 'none'
  if (tool.startsWith('mcp__')) return 'mcp'
  return Object.prototype.hasOwnProperty.call(KIND_BY_TOOL, tool) ? KIND_BY_TOOL[tool] : 'other'
}

// Tool name safe to share: MCP tools keep only `mcp__<server>`, charset restricted, max 32 chars.
function publicTool(tool) {
  if (typeof tool !== 'string' || !tool) return ''
  let t = tool
  if (t.startsWith('mcp__')) t = 'mcp__' + (t.slice(5).split('__')[0] || '')
  return t.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 32)
}

// In-memory letter store: first seen gets the next letter, the 17th and later share the last one. Lives as long as
// the view, so a project keeps its letter across calls (but not across restarts).
function memoryLetterStore() {
  const m = new Map()
  return {
    get: (k) => m.get(k),
    assign(k) { const l = DEPT_LETTERS[Math.min(m.size, DEPT_LETTERS.length - 1)]; m.set(k, l); return l },
  }
}

// letters: {get(key) => letter|undefined, assign(key) => letter}. Keys are HMAC(salt, 'dept:' + project), 12 hex, so
// a store never sees a project name.
function createPublicView(saltHex, { letters = memoryLetterStore() } = {}) {
  if (typeof saltHex !== 'string' || !/^[0-9a-f]{64}$/i.test(saltHex)) throw new Error('createPublicView: salt must be 64 hex characters')
  const key = Buffer.from(String(saltHex), 'hex')
  const hash = (id) => crypto.createHmac('sha256', key).update(String(id)).digest('hex').slice(0, 12)
  const hashOrNull = (id) => (typeof id === 'string' && id ? hash(id) : null)
  const letterFor = (project) => {
    const k = hash('dept:' + project)
    const l = letters.get(k)
    return l !== undefined ? l : letters.assign(k)
  }

  return function view(snapshot, opts) {
    const o = opts || {}
    if (o.private) return { private: true, sessions: [] }
    const coBan = o.share === 'co-ban'
    const allowed = new Set(Array.isArray(o.projects) ? o.projects.filter(p => typeof p === 'string') : [])
    const all = Array.isArray(snapshot && snapshot.sessions) ? snapshot.sessions.filter(s => s && typeof s.id === 'string') : []

    // Rank roots first, then newest. A hashed id appears once (the hub rejects a packet with a duplicate id): the
    // best-ranked copy wins, and references to the dropped twin still resolve since they hash to the same value.
    // Then cap; the original order is kept for the survivors.
    const rank = all.map((s, i) => ({ s, i, root: s.parentId ? 1 : 0, at: Number(s.updatedAt) || 0 }))
    rank.sort((a, b) => a.root - b.root || b.at - a.at || a.i - b.i)
    const seen = new Set()
    const unique = rank.filter((r) => { const h = hash(r.s.id); if (seen.has(h)) return false; seen.add(h); return true })
    const picked = unique.slice(0, MAX_SESSIONS).sort((a, b) => a.i - b.i).map(r => r.s)

    const idByName = new Map()
    for (const s of all) if (typeof s.name === 'string' && s.name && !idByName.has(s.name)) idByName.set(s.name, s.id)

    const sessions = picked.map((s) => {
      const project = typeof s.project === 'string' ? s.project : ''
      const letter = letterFor(project)
      const dept = coBan && allowed.has(project) && DEPT_NAME_RE.test(project) ? project : letter
      const talkId = typeof s.talkingTo === 'string' && s.talkingTo ? idByName.get(s.talkingTo) : null
      const out = {
        id: hash(s.id),
        parent: hashOrNull(s.parentId),
        status: STATUSES.includes(s.status) ? s.status : 'working',
        waitingOn: hashOrNull(s.waitingOn),
        talkingTo: talkId ? hash(talkId) : null,
        dept,
        kind: kindOf(s.tool),
      }
      if (coBan) {
        const tool = publicTool(s.tool)
        if (tool) out.tool = tool
        if (typeof s.model === 'string' && MODEL_RE.test(s.model)) out.model = s.model
      }
      return out
    })
    return { private: false, sessions }
  }
}

module.exports = { createPublicView, kindOf, STATUSES, KINDS, MAX_SESSIONS, DEPT_LETTERS }
