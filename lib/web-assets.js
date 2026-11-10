'use strict'
// The page's scripts and stylesheet live in web/. Both the local server and the hub serve them through this one
// resolver, so neither can be talked into reading a file outside web/ (only [a-z0-9-] names, one optional sub folder,
// .js or .css).
//
// Each file is kept in memory with an ETag and a gzip copy (docs/specs/2026-11-10-hub-perf-design.md, H1): a page load
// fetches ~30 files (~1 MB), and without a validator every load downloaded all of it again. Now a browser that has
// them gets 304s, and one that has not gets ~a quarter of the bytes. The copy is refreshed when the file's mtime or
// size changes, so a page being edited (local server) still sees every save at once.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto')

const WEB_DIR = path.join(__dirname, '..', 'web')
const ASSET_RE = /^\/web\/((?:[a-z0-9-]+\/)?[a-z0-9-]+\.(js|css))$/
const TYPES = { js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8' }
// Revalidate every load: after an update the page must never run with modules cached from the previous version.
const HEADERS = { 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }

const cache = new Map() // absolute path -> { mtimeMs, size, body, gz, etag }

// urlPath without the query. Returns {body, gz, etag, type} or null (not an asset path, or no such file).
function readAsset(urlPath, dir = WEB_DIR) {
  const m = ASSET_RE.exec(String(urlPath || ''))
  if (!m) return null
  const file = path.join(dir, m[1])
  try {
    const st = fs.statSync(file)
    let c = cache.get(file)
    if (!c || c.mtimeMs !== st.mtimeMs || c.size !== st.size) {
      const body = fs.readFileSync(file)
      const gz = zlib.gzipSync(body, { level: 9 })
      c = { mtimeMs: st.mtimeMs, size: st.size, body, gz: gz.length < body.length ? gz : null,
        etag: 'W/"' + crypto.createHash('sha1').update(body).digest('base64url') + '"' }
      cache.set(file, c)
    }
    return { body: c.body, gz: c.gz, etag: c.etag, type: TYPES[m[2]] }
  } catch { cache.delete(file); return null }
}

// What to answer for an asset given the request headers: { status, headers, body }. 304 with no body when the
// browser's copy is current (If-None-Match), else 200, gzipped when the browser accepts it.
function respond(a, reqHeaders = {}) {
  const base = { ...HEADERS, ETag: a.etag, Vary: 'Accept-Encoding' }
  const inm = String(reqHeaders['if-none-match'] || '')
  if (inm && (inm.trim() === '*' || inm.split(',').some(t => t.trim() === a.etag))) return { status: 304, headers: base, body: null }
  const gzip = a.gz && /\bgzip\b/.test(String(reqHeaders['accept-encoding'] || ''))
  return {
    status: 200,
    headers: { ...base, 'Content-Type': a.type, ...(gzip ? { 'Content-Encoding': 'gzip' } : null) },
    body: gzip ? a.gz : a.body,
  }
}

module.exports = { WEB_DIR, ASSET_RE, HEADERS, readAsset, respond }
