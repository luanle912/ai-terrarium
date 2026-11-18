'use strict'
// Page settings shared by every page this server serves. A browser keeps its settings in its own storage, so a page
// in another browser, or in the wallpaper app's web view (which has no settings panel), would never see what was chosen
// in the first one. The page posts its choice here (POST /api/settings) and every page gets it back in each snapshot
// (`pageSettings`), adopting it live: { weather: { mode: 'random'|'real'|'off', city }, event?: 'auto'|'on'|'off',
// updatedAt?: ms }. The newest choice wins (web/settings-sync.js): a value made before the one kept is ignored, and a
// page that sends no updatedAt (an older tab) counts as the oldest.
const fs = require('fs'), path = require('path')

const MODES = ['random', 'real', 'off']
const EVENTS = ['auto', 'on', 'off']
const CITY_MAX = 100

// A posted value cleaned to what the page can use, or null when it is not one.
function clean(v) {
  const w = v && typeof v === 'object' ? v.weather : null
  if (!w || typeof w !== 'object' || !MODES.includes(w.mode)) return null
  const out = { weather: { mode: w.mode, city: typeof w.city === 'string' ? w.city.trim().slice(0, CITY_MAX) : '' } }
  // the event choice (web/event-logic.js): kept only when it is one; a page without it means auto
  if (EVENTS.includes(v.event)) out.event = v.event
  // when the choice was made (the page's clock, ms); kept only when it is one
  if (Number.isFinite(v.updatedAt) && v.updatedAt > 0) out.updatedAt = v.updatedAt
  return out
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
      // an older choice than the one kept (or an unstamped one once something is stamped) changes nothing
      if (cur && (c.updatedAt || 0) < (cur.updatedAt || 0)) return cur
      // a page that sends no event choice (an older tab) leaves the one there is
      if (!c.event && cur && cur.event) c.event = cur.event
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
