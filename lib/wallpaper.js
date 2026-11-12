'use strict'
// `node server.js wallpaper [install|build]`: builds the LiveWallpaper macOS app in wallpaper/ (the office as the
// desktop wallpaper, docs/specs/2026-11-10-wallpaper-design.md) and, by default, installs it to ~/Applications and
// opens it. macOS only; it needs Swift (Xcode or the Command Line Tools).
const path = require('path'), cp = require('child_process')

const DIR = path.join(__dirname, '..', 'wallpaper')

// What to run for argv (everything after `wallpaper`) on a platform: { cmd, args } or { error }.
function plan(argv, platform) {
  const mode = argv[0] || 'install'
  if (mode !== 'install' && mode !== 'build') return { error: `wallpaper: unknown option "${mode}" (use install or build)` }
  if (platform !== 'darwin') return { error: 'wallpaper: the wallpaper app is for macOS only' }
  return { cmd: 'bash', args: [path.join(DIR, 'build.sh'), ...(mode === 'install' ? ['install'] : [])] }
}

// Runs the plan; returns the exit code. spawnSync and log are injectable for tests.
function run(argv, { platform = process.platform, spawnSync = cp.spawnSync, log = console.log } = {}) {
  const p = plan(argv, platform)
  if (p.error) { log(p.error); return 1 }
  const r = spawnSync(p.cmd, p.args, { stdio: 'inherit' })
  if (r.error) { log(`wallpaper: ${r.error.message}`); return 1 }
  return r.status == null ? 1 : r.status
}

module.exports = { plan, run, DIR }
