'use strict'
// The page's scripts and stylesheet live in web/. Both the local server and the hub serve them through this one
// resolver, so neither can be talked into reading a file outside web/ (only [a-z0-9-] names, one optional sub folder,
// .js or .css).
const fs = require('fs'), path = require('path')

const WEB_DIR = path.join(__dirname, '..', 'web')
const ASSET_RE = /^\/web\/((?:[a-z0-9-]+\/)?[a-z0-9-]+\.(js|css))$/
const TYPES = { js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8' }
// Revalidate every load: after an update the page must never run with modules cached from the previous version.
const HEADERS = { 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }

// urlPath without the query. Returns {body, type} or null (not an asset path, or no such file).
function readAsset(urlPath, dir = WEB_DIR) {
  const m = ASSET_RE.exec(String(urlPath || ''))
  if (!m) return null
  try { return { body: fs.readFileSync(path.join(dir, m[1])), type: TYPES[m[2]] } } catch { return null }
}

module.exports = { WEB_DIR, ASSET_RE, HEADERS, readAsset }
