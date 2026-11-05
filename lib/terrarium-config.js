'use strict'
// Local terrarium config (~/.claude-terrarium/config.json) and the server.js subcommands.
const fs = require('fs'), path = require('path'), os = require('os')

const FILE = 'config.json'

function configDir(home) { return path.join(home || os.homedir(), '.claude-terrarium') }

// Tighten permissions if they are looser than 0700 (dir) / 0600 (file).
function repairModes(dir, file, warn) {
  for (const [p, want] of [[dir, 0o700], [file, 0o600]]) {
    try {
      const cur = fs.statSync(p).mode & 0o777
      if (cur & ~want & 0o777) { fs.chmodSync(p, want); warn(`terrarium: tightened ${p} from ${cur.toString(8)} to ${want.toString(8)}`) }
    } catch {}
  }
}

function readConfig(dir, log) {
  const file = path.join(dir, FILE)
  let raw
  try { raw = fs.readFileSync(file, 'utf8') } catch { return null }
  repairModes(dir, file, log || (() => {}))
  try { const c = JSON.parse(raw); return c && typeof c === 'object' ? c : null } catch { return null }
}

function writeConfig(dir, cfg) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  try { fs.chmodSync(dir, 0o700) } catch {}
  const file = path.join(dir, FILE), tmp = path.join(dir, `.${FILE}.${process.pid}.tmp`)
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 })
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, file)
}

function validHubUrl(url) {
  if (typeof url !== 'string') return false
  let u
  try { u = new URL(url) } catch { return false }
  if (u.username || u.password) return false
  if (u.protocol === 'https:') return !!u.hostname
  return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
}

// Strip terminal control characters (C0, DEL, C1) from anything that did not come from our own code.
const clean = (v) => String(v).replace(/[\x00-\x1f\x7f-\x9f]/g, '')

const tail = (t) => (typeof t === 'string' && t ? '…' + t.slice(-4) : '(none)')

async function runCommand(argv, deps = {}) {
  const [cmd, ...rest] = argv
  if (!['status', 'share', 'private', 'leave', 'join'].includes(cmd)) return null
  const dir = deps.dir || configDir()
  const log = deps.log || console.log

  if (cmd === 'join') {
    const hub = rest[0]
    if (!validHubUrl(hub)) { log('join: hub URL must be https:// (or http://localhost for local testing)'); return 1 }
    const i = rest.indexOf('--name')
    const name = i >= 0 ? rest[i + 1] : undefined
    if (typeof deps.join !== 'function') { log('join: not available yet'); return 1 }
    return (await deps.join(hub, { name })) || 0
  }

  const cfg = readConfig(dir, log)
  if (cmd === 'status') {
    if (!cfg) { log('Not joined to any hub.'); return 0 }
    log(`hub: ${clean(cfg.hub)}`)
    log(`token: ${tail(cfg.token)}`)
    log(`share: ${cfg.share}${cfg.projects && cfg.projects.length ? ` (projects: ${clean(cfg.projects.join(', '))})` : ''}`)
    log(`private: ${cfg.private ? 'on' : 'off'}`)
    if (cfg.revoked) log('revoked: this device was removed by the hub')
    return 0
  }
  if (cmd === 'leave') {
    if (cfg && cfg.token && !cfg.revoked && typeof deps.revokeSelf === 'function') {
      let result = 'failed'
      try { result = await deps.revokeSelf(cfg.hub, cfg.token) } catch {}
      if (result === 'ok') log('Revoked this device on the hub.')
      else if (result === 'gone') log('This device was already removed on the hub.')
      else log(`Could not reach the hub; revoke this device at ${clean(String(cfg.hub).replace(/\/+$/, ''))}/me.`)
    }
    try { fs.rmSync(path.join(dir, FILE), { force: true }) } catch (e) { log(`leave: ${e.message}`); return 1 }
    log('Left the hub. Local config removed.')
    return 0
  }
  if (!cfg) { log('Not joined yet — run: server.js join <hub-url>'); return 1 }

  if (cmd === 'private') {
    if (rest[0] !== 'on' && rest[0] !== 'off') { log('usage: private on|off'); return 1 }
    cfg.private = rest[0] === 'on'
    writeConfig(dir, cfg); log(`private: ${rest[0]}`); return 0
  }
  // share
  if (rest[0] === 'kin' || rest[0] === 'co-ban') { cfg.share = rest[0]; writeConfig(dir, cfg); log(`share: ${rest[0]}`); return 0 }
  if (rest[0] === 'projects') {
    cfg.projects = (rest[1] || '').split(',').map((s) => s.trim()).filter(Boolean)
    writeConfig(dir, cfg); log(`projects: ${cfg.projects.join(', ') || '(none)'}`); return 0
  }
  log('usage: share kin|co-ban | share projects a,b'); return 1
}

module.exports = { clean, configDir, readConfig, writeConfig, validHubUrl, runCommand }
