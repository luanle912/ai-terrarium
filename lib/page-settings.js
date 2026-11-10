'use strict'
// Page settings shared by every page this server serves. A browser keeps its settings in its own storage, so a page
// in another browser, or in the wallpaper app's web view (which has no settings panel), would never see what was chosen
// in the first one. The page posts its choice here (POST /api/settings) and every page gets it back in each snapshot
// (`pageSettings`), adopting it live. Only the weather for now: { weather: { mode: 'random'|'real'|'off', city } }.
const fs = require('fs'), path = require('path')

const MODES = ['random', 'real', 'off']
const CITY_MAX = 100

// A posted value cleaned to what the page can use, or null when it is not one.
function clean(v) {
  const w = v && typeof v === 'object' ? v.weather : null
  if (!w || typeof w !== 'object' || !MODES.includes(w.mode)) return null
  return { weather: { mode: w.mode, city: typeof w.city === 'string' ? w.city.trim().slice(0, CITY_MAX) : '' } }
}

// Kept in memory, saved to `file` (written whole to a temp file, then renamed). get() is null until something is set.
function createPageSettings(file) {
  let cur = null
  try { cur = clean(JSON.parse(fs.readFileSync(file, 'utf8'))) } catch {}
  return {
    get: () => cur,
    set(v) {
      const c = clean(v)
      if (!c) return null
      cur = c
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true })
        const tmp = file + '.' + process.pid + '.tmp'
        fs.writeFileSync(tmp, JSON.stringify(c) + '\n')
        fs.renameSync(tmp, file)
      } catch {}
      return cur
    },
  }
}

module.exports = { clean, createPageSettings, MODES }
