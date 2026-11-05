'use strict';
// HTTP helpers for the hub: body reader with a hard limit (S15), cookie parser, response sender with
// baseline security headers, client IP (S16), router + one-line request log (S17).

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "frame-ancestors 'none'",
};

class HttpError extends Error {
  constructor(status, message) { super(message || String(status)); this.status = status; }
}

// Reads the body but never more than `limit` bytes. Rejects with a 413 HttpError the moment the limit is
// crossed (or up front when Content-Length already exceeds it); the rest of the body is never buffered.
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      req._tooLarge = true;
      return reject(new HttpError(413, 'payload too large'));
    }
    const chunks = [];
    let size = 0;
    let done = false;
    const finish = (fn, v) => { if (done) return; done = true; cleanup(); fn(v); };
    const onData = (c) => {
      size += c.length;
      if (size > limit) { req._tooLarge = true; return finish(reject, new HttpError(413, 'payload too large')); }
      chunks.push(c);
    };
    const onEnd = () => finish(resolve, Buffer.concat(chunks));
    const onErr = (e) => finish(reject, e);
    const cleanup = () => { req.off('data', onData); req.off('end', onEnd); req.off('error', onErr); req.off('aborted', onErr); };
    req.on('data', onData); req.on('end', onEnd); req.on('error', onErr); req.on('aborted', () => onErr(new HttpError(400, 'aborted')));
  });
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || k in out) continue;
    let v = part.slice(i + 1).trim();
    try { v = decodeURIComponent(v); } catch { /* keep raw */ }
    out[k] = v;
  }
  return out;
}

function send(res, status, body, headers = {}) {
  if (res.headersSent) return;
  const buf = body == null ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Length': buf.length, ...headers });
  res.end(buf);
}

const sendJson = (res, status, obj, headers = {}) =>
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });

// Only the LAST X-Forwarded-For entry (the one our own proxy appended) is trusted, and only with trustProxy.
function clientIp(req, trustProxy) {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      const parts = String(xff).split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length) return parts[parts.length - 1];
    }
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// routes: [{method, path: string | RegExp, handler(req, res, rc)}]; rc = {url, path, query, match}.
// No match -> 404. A handler error with .status maps to that status, anything else is a bare 500
// (details are never sent to the client or logged).
function createRouter(routes, { log = () => {}, now = Date.now, hsts = false } = {}) {
  return function handle(req, res) {
    const t0 = now();
    if (hsts && typeof res.setHeader === 'function') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    let pathname = '/';
    let url = null;
    try { url = new URL(req.url, 'http://hub.invalid'); pathname = url.pathname; } catch { /* keep '/' */ }
    res.on('finish', () => {
      // S17: time, method, path WITHOUT query, status, duration. Never body/headers/cookies.
      try { log(`${new Date(t0).toISOString()} ${req.method} ${pathname} ${res.statusCode} ${now() - t0}ms`); } catch { /* ignore */ }
      if (req._tooLarge) req.destroy();
    });
    const fail = (e) => {
      try {
        // Only our own HttpError (status 400-599) may choose status/message; anything else is a bare 500.
        const ok = e instanceof HttpError && Number.isInteger(e.status) && e.status >= 400 && e.status <= 599;
        const status = ok ? e.status : 500;
        if (status === 500) { try { log(`handler error ${(e && e.name) || 'Error'} ${pathname}`); } catch { /* ignore */ } }
        const headers = status === 413 ? { Connection: 'close' } : {};
        send(res, status, status === 500 ? 'internal error' : (e.message || ''), { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
      } catch { try { res.destroy(); } catch { /* ignore */ } }
    };
    if (!url) return fail(new HttpError(400, 'bad request'));
    let route = null;
    let match = null;
    for (const r of routes) {
      if (r.method !== req.method) continue;
      if (typeof r.path === 'string') { if (r.path === pathname) { route = r; break; } }
      else { const m = r.path.exec(pathname); if (m) { route = r; match = m; break; } }
    }
    if (!route) return send(res, 404, 'not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    try {
      const out = route.handler(req, res, { url, path: pathname, query: url.searchParams, match });
      if (out && typeof out.then === 'function') out.catch(fail);
    } catch (e) { fail(e); }
  };
}

module.exports = { readBody, parseCookies, send, sendJson, clientIp, createRouter, HttpError, SECURITY_HEADERS };
