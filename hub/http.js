'use strict';
const net = require('node:net');
// HTTP helpers for the hub: body reader with a hard limit (S15), cookie parser, response sender with
// baseline security headers, client IP (S16), router + one-line request log (S17).

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "frame-ancestors 'none'",
};

// headers: extra response headers the router sends with the error (e.g. Retry-After).
class HttpError extends Error {
  constructor(status, message, headers = {}) { super(message || String(status)); this.status = status; this.headers = headers; }
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

// mode: false = socket address only; true | 'xff' = the LAST X-Forwarded-For entry (the one our own proxy
// appended); 'cloudflare' = CF-Connecting-IP when it is a valid IP, otherwise as 'xff'.
function clientIp(req, mode) {
  if (mode === 'cloudflare') {
    const cf = String(req.headers['cf-connecting-ip'] || '').trim();
    if (net.isIP(cf) !== 0) return cf;
  }
  if (mode) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      const parts = String(xff).split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length) return parts[parts.length - 1];
    }
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// routes: [{method, path: string | RegExp, handler(req, res, rc), head?}]; rc = {url, path, query, match}.
// HEAD with no route of its own uses the GET route of the same path (Node drops the body), unless that route has
// head: false (405, Allow: GET). No match -> 404. A handler error with .status maps to that status, anything else is a bare 500
// (details are never sent to the client or logged). htmlError(status, message) -> {body, headers} renders a page
// for browsers that navigate into an error (Accept: text/html, outside /api/); everyone else keeps plain text.
function createRouter(routes, { log = () => {}, now = Date.now, hsts = false, htmlError = null, onStatus = null } = {}) {
  return function handle(req, res) {
    const t0 = now();
    if (hsts && typeof res.setHeader === 'function') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    let pathname = '/';
    let url = null;
    try { url = new URL(req.url, 'http://hub.invalid'); pathname = url.pathname; } catch { /* keep '/' */ }
    res.on('finish', () => {
      if (onStatus) { try { onStatus(res.statusCode); } catch { /* ignore */ } }
      // S17: time, method, path WITHOUT query, status, duration. Never body/headers/cookies.
      try { log(`${new Date(t0).toISOString()} ${req.method} ${pathname} ${res.statusCode} ${now() - t0}ms`); } catch { /* ignore */ }
      if (req._tooLarge) req.destroy();
    });
    const sendError = (status, message, headers = {}) => {
      if (htmlError && !pathname.startsWith('/api/') && /\btext\/html\b/i.test(String(req.headers.accept || ''))) {
        const p = htmlError(status, message);
        return send(res, status, p.body, { ...p.headers, ...headers });
      }
      send(res, status, message, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
    };
    const fail = (e) => {
      try {
        // Only our own HttpError (status 400-599) may choose status/message; anything else is a bare 500.
        const ok = e instanceof HttpError && Number.isInteger(e.status) && e.status >= 400 && e.status <= 599;
        const status = ok ? e.status : 500;
        if (status === 500) { try { log(`handler error ${(e && e.name) || 'Error'} ${pathname}`); } catch { /* ignore */ } }
        const headers = { ...(ok && e.headers ? e.headers : {}), ...(status === 413 ? { Connection: 'close' } : {}) };
        sendError(status, status === 500 ? 'internal error' : (e.message || ''), headers);
      } catch { try { res.destroy(); } catch { /* ignore */ } }
    };
    if (!url) return fail(new HttpError(400, 'bad request'));
    let route = null;
    let match = null;
    const find = (method) => {
      for (const r of routes) {
        if (r.method !== method) continue;
        if (typeof r.path === 'string') { if (r.path === pathname) { route = r; match = null; return; } }
        else { const m = r.path.exec(pathname); if (m) { route = r; match = m; return; } }
      }
    };
    find(req.method);
    if (!route && req.method === 'HEAD') {
      find('GET');
      if (route && route.head === false) return sendError(405, 'method not allowed', { Allow: 'GET' });
    }
    if (!route) return sendError(404, 'not found');
    try {
      const out = route.handler(req, res, { url, path: pathname, query: url.searchParams, match });
      if (out && typeof out.then === 'function') out.catch(fail);
    } catch (e) { fail(e); }
  };
}

module.exports = { readBody, parseCookies, send, sendJson, clientIp, createRouter, HttpError, SECURITY_HEADERS };
