'use strict';
// Hash-based CSP for claude-office.html (spec S13). The hub hashes every inline <script> at serve time, so the
// policy needs no 'unsafe-inline' for scripts and follows later edits of the file without touching this module.

const fs = require('node:fs');
const crypto = require('node:crypto');

// Every <script> without a src attribute. The browser hashes the exact text between the tags.
const INLINE_SCRIPT = /<script(?![^>]*\ssrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;

function inlineScriptHashes(html) {
  const out = [];
  for (const m of String(html).matchAll(INLINE_SCRIPT)) {
    const h = "'sha256-" + crypto.createHash('sha256').update(m[1], 'utf8').digest('base64') + "'";
    if (!out.includes(h)) out.push(h);
  }
  return out;
}

function officeCsp(hashes) {
  return [
    "default-src 'none'",
    `script-src ${[...hashes, 'https://cdnjs.cloudflare.com'].join(' ')}`,
    // Inline <style> and style="" attributes are used by the page; the Google Fonts stylesheet is external.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com",
    "img-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
}

// Re-reads and re-hashes the file whenever its mtime changes.
function createOfficePage(file) {
  let cached = null;
  let mtimeMs = -1;
  return {
    get() {
      const st = fs.statSync(file);
      if (!cached || st.mtimeMs !== mtimeMs) {
        const body = fs.readFileSync(file);
        cached = { body, csp: officeCsp(inlineScriptHashes(body.toString('utf8'))) };
        mtimeMs = st.mtimeMs;
      }
      return cached;
    },
  };
}

module.exports = { inlineScriptHashes, officeCsp, createOfficePage };
