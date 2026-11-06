'use strict';
// Hub entry point. `node hub/server.js` reads env, builds the hub and listens.
//
// EXTENSION POINT (Tasks 5-7): each feature lives in its own module exporting `routes(ctx)` that returns an
// array of {method, path (string | RegExp), handler(req, res, rc)}. Add the module to ROUTE_MODULES below;
// createHub builds one shared ctx and concatenates all arrays into one router. Tests may also pass
// `deps.routeModules` (array of such functions) which are appended after the built-in ones.
//   ctx = { config, db, deps: {fetch, now, log, random}, limiters, world, helpers, jwks, accounts, googleCheck }
// Handlers may be async; throwing/rejecting with an error that has `.status` replies with that status.

const http = require('node:http');
const { loadConfig } = require('./config.js');
const { openDb } = require('./db.js');
const { createRouter, clientIp, readBody, send, sendJson, parseCookies, HttpError } = require('./http.js');
const { createLimiter } = require('./limits.js');
const { createWorld } = require('./world.js');
const { createJwks } = require('./jwt.js');
const { createAccounts } = require('./accounts.js');
const { createGoogleCheck } = require('./google-check.js');
const { sha256hex } = require('./auth.js');
const { errorPage, PAGE_CSP } = require('./pages.js');

const ROUTE_MODULES = [require('./auth.js').routes, require('./pairing.js').routes, require('./publish.js').routes, require('./me.js').routes];

const HOUR = 3600 * 1000;

function createHub(config, deps = {}) {
  const d = {
    fetch: deps.fetch || globalThis.fetch,
    now: deps.now || Date.now,
    log: deps.log || ((line) => console.log(line)),
    random: deps.random || Math.random,
  };
  const db = openDb(config.dbPath);
  // In-memory world: island snapshots never touch disk or logs. publish.js listens through ctx.onWorldChange.
  const ctx = { config, db, deps: d, streamLimits: { perUser: 5, total: 300, ...(deps.streamLimits || {}) }, limiters: null, world: null, closers: [], onWorldChange: null, helpers: null };
  const world = createWorld({ now: d.now, onChange: (e) => { if (ctx.onWorldChange) ctx.onWorldChange(e); } });
  // Token buckets per spec S14 (rate is tokens/second). Keys are chosen by the route that uses them.
  const limiters = {
    deviceStart: createLimiter({ rate: 10 / 3600, burst: 10 }), // key: IP
    deviceToken: createLimiter({ rate: 1 / 5, burst: 1 }), // key: device_code hash
    publish: createLimiter({ rate: 4, burst: 8 }), // key: device id
    login: createLimiter({ rate: 30 / 3600, burst: 30 }), // key: IP
    general: createLimiter({ rate: 2, burst: 120 }), // key: IP; every route without ownLimit (120 a minute)
  };
  ctx.limiters = limiters;
  ctx.jwks = createJwks({ fetch: d.fetch, now: d.now });
  ctx.world = world;
  ctx.pingMs = deps.pingMs; // undefined = PING_MS (25 s); tests pass a short one
  ctx.wakeMs = deps.wakeMs; // undefined = check once at the end of the waking window; tests pass a short re-check
  ctx.helpers = { readBody, send, sendJson, parseCookies, clientIp: (req) => clientIp(req, config.trustProxy), HttpError };

  ctx.accounts = createAccounts(ctx);
  ctx.googleCheck = createGoogleCheck(ctx);

  // Routes with their own limiter (ownLimit) are exempt; every other route shares the general bucket, keyed by
  // the signed-in user (`u:<id>`, from a valid session cookie or Bearer device token) or else by IP, so people
  // behind one NAT do not share 120 a minute. ctx.helpers.requireSession is memoised per request (see below), so
  // handlers that call it (me, pairing, publish) cost no second DB read; auth.js's own /api/config and /auth/logout
  // call its local copy and read the session once more.
  function generalKey(req) {
    const m = /^Bearer (\S{1,200})$/.exec(String(req.headers.authorization || ''));
    if (m) {
      const device = db.getDeviceByTokenHash(sha256hex(m[1]));
      if (device && device.revoked_at == null) return 'u:' + device.user_id;
    } else if (req.headers.cookie) {
      const s = ctx.helpers.requireSession(req);
      if (s) return 'u:' + s.user.id;
    }
    return ctx.helpers.clientIp(req);
  }
  const limitGeneral = (r) => (r.ownLimit ? r : {
    ...r,
    handler(req, res, rc) {
      if (!limiters.general.take(generalKey(req), d.now())) {
        return send(res, 429, 'too many requests', { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '30' });
      }
      return r.handler(req, res, rc);
    },
  });
  const routes = [...ROUTE_MODULES, ...(deps.routeModules || [])].flatMap((m) => m(ctx)).map(limitGeneral);
  // auth.js installs requireSession while the routes are built; memoise it per request so the limiter key and
  // the handler share one lookup. A request is short-lived, so the WeakMap entry dies with it.
  const lookup = ctx.helpers.requireSession;
  const seen = new WeakMap();
  ctx.helpers.requireSession = (req) => {
    if (!seen.has(req)) seen.set(req, lookup(req));
    return seen.get(req);
  };
  const htmlError = (status, message) => ({
    body: errorPage(status, message),
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': PAGE_CSP, 'Cache-Control': 'no-store' },
  });
  const server = http.createServer(createRouter(routes, { log: d.log, now: d.now, hsts: config.secure, htmlError }));

  const setTimer = deps.setInterval || setInterval; // injectable so tests can check unref/clear
  const clearTimer = deps.clearInterval || clearInterval;
  const sweep = setTimer(() => { try { db.cleanup(d.now()); } catch { d.log('cleanup failed'); } }, HOUR);
  sweep.unref();
  // B12: hourly Google check; failures are logged without detail.
  const googleTimer = setTimer(() => { ctx.googleCheck.runOnce().catch(() => d.log('google check failed')); }, HOUR);
  googleTimer.unref();

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    clearTimer(sweep);
    clearTimer(googleTimer);
    ctx.googleCheck.stop();
    for (const fn of ctx.closers) { try { fn(); } catch { /* ignore */ } }
    await new Promise((resolve) => {
      if (!server.listening) return resolve();
      server.close(() => resolve());
      server.closeAllConnections();
    });
    db.close();
  }
  return { server, db, world, ctx, close };
}

function main() {
  let config;
  try { config = loadConfig(process.env); } catch (e) { console.error(e.message); process.exit(1); }
  process.on('unhandledRejection', (e) => console.error('unhandled rejection ' + ((e && e.name) || 'Error')));
  const hub = createHub(config);
  hub.server.on('error', (e) => { console.error('hub failed to listen: ' + e.code); process.exit(1); });
  hub.server.listen(config.port, config.host, () => console.log(`hub listening on ${config.host}:${hub.server.address().port} (${config.origin})`));
  const stop = () => hub.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (require.main === module) main();

module.exports = { createHub };
