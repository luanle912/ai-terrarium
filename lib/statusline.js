'use strict'
// statusLine bridge: Claude Code pipes its statusLine JSON to `node server.js statusline`;
// we persist the 5H/7D rate limits to <configDir>/usage.json for the server to read.
const fs = require('fs'), path = require('path'), cp = require('child_process')

const FILE = 'usage.json'
const WINDOWS = ['five_hour', 'seven_day']

function parseWindow(w) {
  if (!w || typeof w !== 'object') return null
  const pct = Number(w.used_percentage), resets = Number(w.resets_at)
  if (typeof w.used_percentage === 'string' || !Number.isFinite(pct)) return null
  if (!Number.isFinite(resets) || resets <= 0) return null
  // resets_at is in epoch seconds; store milliseconds.
  return { pct: Math.max(0, Math.min(100, pct)), resets_at_ms: Math.round(resets * 1000) }
}

// Returns {at, five_hour?, seven_day?} or null when no usable window is present.
function parseRateLimits(input, now = Date.now()) {
  const rl = input && typeof input === 'object' ? input.rate_limits : null
  if (!rl || typeof rl !== 'object') return null
  const out = { at: now }
  let any = false
  for (const k of WINDOWS) { const w = parseWindow(rl[k]); if (w) { out[k] = w; any = true } }
  return any ? out : null
}

// Same temp file plus rename pattern as terrarium-config writeConfig.
function writeUsage(dir, usage) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const file = path.join(dir, FILE), tmp = path.join(dir, `.${FILE}.${process.pid}.tmp`)
  try {
    fs.writeFileSync(tmp, JSON.stringify(usage) + '\n', { mode: 0o600 })
    fs.chmodSync(tmp, 0o600)
    fs.renameSync(tmp, file)
  } catch (e) { try { fs.rmSync(tmp, { force: true }) } catch {} throw e }
}

// usage.json -> [{kind, pct, resets(ISO)}], dropping windows already reset. null when unreadable.
function readUsageFile(dir, now = Date.now()) {
  let d
  try { d = JSON.parse(fs.readFileSync(path.join(dir, FILE), 'utf8')) } catch { return null }
  if (!d || typeof d !== 'object') return null
  const out = []
  for (const kind of WINDOWS) {
    const w = d[kind]
    if (!w || !Number.isFinite(w.pct) || !Number.isFinite(w.resets_at_ms)) continue
    if (w.resets_at_ms <= now) continue
    out.push({ kind, pct: w.pct, resets: new Date(w.resets_at_ms).toISOString() })
  }
  return out
}

function formatLine(u) {
  const parts = []
  if (u && u.five_hour) parts.push(`5H ${Math.round(u.five_hour.pct)}%`)
  if (u && u.seven_day) parts.push(`7D ${Math.round(u.seven_day.pct)}%`)
  return '🏝 ' + (parts.length ? parts.join(' · ') : 'terrarium')
}

// Pure-ish entry point: never throws, always code 0.
function run({ stdin = '', argv = [], dir, now = Date.now() } = {}) {
  let usage = null
  try { usage = parseRateLimits(JSON.parse(stdin), now) } catch {}
  if (usage) { try { writeUsage(dir, usage) } catch {} }
  const i = argv.indexOf('--chain')
  if (i >= 0 && typeof argv[i + 1] === 'string' && argv[i + 1]) {
    try {
      const r = cp.spawnSync(argv[i + 1], { shell: true, input: stdin, encoding: 'utf8', timeout: 5000 })
      if (r.status === 0 && r.stdout && r.stdout.trim()) return { out: r.stdout.replace(/\n+$/, ''), code: 0 }
    } catch {}
  }
  return { out: formatLine(usage), code: 0 }
}

// CLI wrapper used by `node server.js statusline [--chain "<cmd>"]`.
function main(argv, dir) {
  let stdin = ''
  try { stdin = fs.readFileSync(0, 'utf8') } catch {}
  const r = run({ stdin, argv, dir })
  process.stdout.write(r.out + '\n')
  return 0
}

module.exports = { parseRateLimits, writeUsage, readUsageFile, formatLine, run, main }
