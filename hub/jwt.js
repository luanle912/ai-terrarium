'use strict';
// RS256 JWT verification against a JWKS endpoint (Google's by default), with a bounded key cache.
//   createJwks({fetch, now, url, minRefetchMs}) -> {getKey(kid), verify(jwt)}
// verify() checks structure, alg and signature only; claims (iss/aud/exp/...) are auth.js `checkClaims`.
// Keys are cached for the response's Cache-Control max-age (1 hour when absent, at most 24 hours). An unknown
// kid triggers a refetch only if the previous fetch is at least minRefetchMs old, so junk kids cannot make the
// hub hammer Google. Concurrent callers share one in-flight fetch.

const crypto = require('node:crypto');

const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
const DEFAULT_TTL_S = 3600;
const MAX_TTL_S = 24 * 3600;
const FETCH_TIMEOUT_MS = 10000;

function ttlSeconds(cacheControl) {
  const m = /(?:^|[\s,])max-age=(\d+)/i.exec(String(cacheControl || ''));
  if (!m) return DEFAULT_TTL_S;
  return Math.min(Number(m[1]), MAX_TTL_S);
}

function createJwks({ fetch, now, url = GOOGLE_JWKS, minRefetchMs = 60000 }) {
  let keys = new Map(); // kid -> KeyObject
  let expiresAt = 0;
  let lastFetchAt = null; // set when a fetch starts, so failures are throttled too
  let inflight = null;

  function load() {
    if (inflight) return inflight;
    lastFetchAt = now();
    inflight = (async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res || !res.ok) throw new Error('jwks fetch failed');
      const body = await res.json();
      const next = new Map();
      for (const jwk of (body && Array.isArray(body.keys) ? body.keys : [])) {
        if (!jwk || jwk.kty !== 'RSA' || typeof jwk.kid !== 'string') continue;
        try { next.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' })); } catch { /* skip a bad key */ }
      }
      keys = next;
      expiresAt = now() + ttlSeconds(res.headers && res.headers.get && res.headers.get('cache-control')) * 1000;
    })().finally(() => { inflight = null; });
    return inflight;
  }

  async function getKey(kid) {
    if (inflight) await inflight;
    const t = now();
    const fresh = lastFetchAt !== null && t < expiresAt;
    if (fresh && keys.has(kid)) return keys.get(kid);
    const canFetch = lastFetchAt === null || t - lastFetchAt >= minRefetchMs;
    if (canFetch) await load();
    else if (!fresh) return null; // expired but throttled after a failed fetch: use no stale keys
    return keys.get(kid) || null;
  }

  async function verify(jwt) {
    const parts = String(jwt || '').split('.');
    if (parts.length !== 3) throw new Error('jwt: malformed');
    let header;
    try { header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch { throw new Error('jwt: bad header'); }
    if (!header || typeof header !== 'object' || Array.isArray(header)) throw new Error('jwt: bad header');
    if (header.alg !== 'RS256') throw new Error('jwt: unsupported alg');
    if (typeof header.kid !== 'string' || !header.kid) throw new Error('jwt: no kid');
    let key;
    try { key = await getKey(header.kid); } catch { throw new Error('jwt: keys unavailable'); }
    if (!key) throw new Error('jwt: unknown kid');
    let ok = false;
    try {
      ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'));
    } catch { ok = false; }
    if (!ok) throw new Error('jwt: bad signature');
    let payload;
    try { payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { throw new Error('jwt: bad payload'); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('jwt: bad payload');
    return payload;
  }

  return { getKey, verify };
}

module.exports = { createJwks, GOOGLE_JWKS };
