'use strict'
// The usage board's figures (5H / 7D plan limits) and whether the board is shown at all
// (docs/specs/2026-11-10-usage-board-design.md). Only a claude.ai subscription has these limits, so the board is shown
// only once a source proves one (plan === true); with an API key, or when nothing is known, it is hidden.
//
// Sources, most trusted first:
//   statusline  usage.json written by `node server.js statusline` from a terminal `claude` (lib/statusline.js)
//   claude      Claude Code's own `get_usage` control request, asked of the machine's `claude` CLI every few minutes
//   limit       a 429 in a transcript: that window is at 100 % until it resets (lib/status.js quotaHits)
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process')
const { readUsageFile } = require('./statusline.js')
const { QUOTA_KINDS, mergeQuota } = require('./status.js')

const STATUSLINE_FRESH_MS = 10 * 60e3 // a status line figure older than this is not trusted over get_usage
const ASK_EVERY_MS = 5 * 60e3
const NO_PLAN_RETRY_MS = 60 * 60e3 // the CLI said "no plan limits" (API key, Bedrock…): ask again in an hour
// A cold `claude` with many plugins and skills takes 5-15 s to answer (measured), sometimes more: 15 s missed every
// third ask, and a missed one leaves the board empty until the next ask.
const ASK_TIMEOUT_MS = 45e3

// get_usage's answer → { plan, windows } or null when it is not a usable answer.
// rate_limits[kind] = { utilization | used_percentage (0-100), resets_at (ISO string or epoch seconds) }.
function parseGetUsage(resp) {
  if (!resp || typeof resp !== 'object') return null
  if (resp.rate_limits_available === false) return { plan: false, windows: [] }
  const rl = resp.rate_limits
  if (!rl || typeof rl !== 'object') return resp.rate_limits_available === true ? { plan: true, windows: [] } : null
  const windows = []
  for (const kind of QUOTA_KINDS) {
    const w = rl[kind]
    if (!w || typeof w !== 'object') continue
    const pct = Number(w.utilization ?? w.used_percentage)
    const r = w.resets_at
    const resetsMs = typeof r === 'number' ? (r < 1e12 ? r * 1000 : r) : Date.parse(r)
    if (!Number.isFinite(pct) || !Number.isFinite(resetsMs)) continue
    windows.push({ kind, pct: Math.max(0, Math.min(100, pct)), resets: new Date(resetsMs).toISOString() })
  }
  return { plan: true, windows }
}

// The machine's own `claude` CLI (its own sign-in), never the copy bundled in the desktop app. null when none.
function findClaude(env = process.env, isExec = f => { try { fs.accessSync(f, fs.constants.X_OK); return true } catch { return false } }) {
  if (env.TERRARIUM_CLAUDE) return isExec(env.TERRARIUM_CLAUDE) ? env.TERRARIUM_CLAUDE : null
  const home = env.HOME || os.homedir()
  const dirs = [...String(env.PATH || '').split(path.delimiter), '/opt/homebrew/bin', path.join(home, '.local', 'bin'),
    '/usr/local/bin', path.join(home, '.claude', 'local')]
  for (const d of dirs) {
    if (!d || d.includes('/Application Support/Claude/')) continue
    const f = path.join(d, 'claude')
    if (isExec(f)) return f
  }
  return null
}

// The environment for the CLI: ours without what the desktop app hands its own sessions (its short-lived sign-in,
// host and SDK switches), so the CLI answers for its own sign-in.
function cliEnv(env = process.env) {
  const out = {}
  for (const [k, v] of Object.entries(env)) if (!/^(CLAUDE_CODE_|CLAUDE_AGENT_SDK_|CLAUDECODE$|ANTHROPIC_)/.test(k)) out[k] = v
  return out
}

// Asks `claude` for get_usage over the SDK stream protocol: no prompt is sent (no tokens used), no session is kept,
// hooks and MCP servers stay off. Calls done(answer | null) once.
function askClaude(bin, done, { timeoutMs = ASK_TIMEOUT_MS, spawn = cp.spawn, cwd } = {}) {
  let finished = false, buf = ''
  const finish = r => { if (finished) return; finished = true; clearTimeout(timer); try { p.kill() } catch {}; done(r) }
  const dir = cwd || path.join(os.tmpdir(), 'terrarium-usage')
  try { fs.mkdirSync(dir, { recursive: true }) } catch {}
  let p, timer
  try {
    p = spawn(bin, ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
      '--no-session-persistence', '--strict-mcp-config', '--settings', '{"disableAllHooks":true}'],
    { cwd: dir, env: cliEnv(), stdio: ['pipe', 'pipe', 'ignore'] })
  } catch { finished = true; return done(null) }
  timer = setTimeout(() => finish(null), timeoutMs)
  p.on('error', () => finish(null))
  p.on('exit', () => finish(null))
  p.stdout.on('data', d => {
    buf += d
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1)
      let m; try { m = JSON.parse(line) } catch { continue }
      const r = m && m.type === 'control_response' && m.response
      if (r && r.request_id === 'usage') finish(r.subtype === 'success' ? r.response : null)
    }
  })
  const send = o => { try { p.stdin.write(JSON.stringify(o) + '\n') } catch {} }
  send({ type: 'control_request', request_id: 'init', request: { subtype: 'initialize' } })
  send({ type: 'control_request', request_id: 'usage', request: { subtype: 'get_usage', skip_behaviors: true } })
}

// Combines the sources into what the page gets: { windows: [{kind, pct, resets}], plan: true|false|null, source }.
function combine({ statusline, statuslineAt, claude, hits }, now) {
  let windows = [], plan = null, source = null
  if (statusline && statusline.length && now - statuslineAt <= STATUSLINE_FRESH_MS) {
    windows = statusline; plan = true; source = 'statusline'
  } else if (claude && claude.plan) {
    windows = claude.windows; plan = true; source = 'claude'
  } else if (claude && claude.plan === false) plan = false
  const merged = mergeQuota(windows, hits || {}, now)
  if (merged.some(w => hits && hits[w.kind] > now)) { plan = true; source = source || 'limit' }
  return { windows: merged, plan, source }
}

// The running source: call usage(now, hits) for the current figures; it asks the CLI in the background when due.
function createUsage({ dir, find = findClaude, ask = askClaude, readFile = readUsageFile, statFile } = {}) {
  let claude = null, nextAsk = 0, asking = false
  const usageFile = () => path.join(dir, 'usage.json')
  const statAt = statFile || (() => { try { return fs.statSync(usageFile()).mtimeMs } catch { return 0 } })
  function maybeAsk(now, statuslineFresh) {
    if (asking || now < nextAsk || statuslineFresh) return
    const bin = find()
    if (!bin) { claude = null; nextAsk = now + NO_PLAN_RETRY_MS; return }
    asking = true
    ask(bin, resp => {
      asking = false
      const r = parseGetUsage(resp)
      if (r) claude = r
      nextAsk = Date.now() + (r && r.plan === false ? NO_PLAN_RETRY_MS : ASK_EVERY_MS)
    })
  }
  return function usage(now = Date.now(), hits = {}) {
    const statuslineAt = statAt()
    const statusline = readFile(dir, now) || []
    maybeAsk(now, statusline.length > 0 && now - statuslineAt <= STATUSLINE_FRESH_MS)
    return combine({ statusline, statuslineAt, claude, hits }, now)
  }
}

module.exports = { parseGetUsage, findClaude, cliEnv, askClaude, combine, createUsage, STATUSLINE_FRESH_MS, ASK_EVERY_MS, NO_PLAN_RETRY_MS }
