'use strict';
// Hub entry point. `node hub/server.js` reads env, builds the hub and listens.
//
// EXTENSION POINT (Tasks 5-7): each feature lives in its own module exporting `routes(ctx)` that returns an
// array of {method, path (string | RegExp), handler(req, res, rc)}. Add the module to ROUTE_MODULES below;
// createHub builds one shared ctx and concatenates all arrays into one router. Tests may also pass
// `deps.routeModules` (array of such functions) which are appended after the built-in ones.
//   ctx = { config, db, deps: {fetch, now, log}, limiters, world, helpers, jwks, accounts, googleCheck }
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

const ROUTE_MODULES = [require('./auth.js').routes, require('./pairing.js').routes, require('./publish.js').routes];

const HOUR = 3600 * 1000;

function createHub(config, deps = {}) {
  const d = {
    fetch: deps.fetch || globalThis.fetch,
    now: deps.now || Date.now,
    log: deps.log || ((line) => console.log(line)),
  };
  const db = openDb(config.dbPath);
  // In-memory world: island snapshots never touch disk or logs. publish.js listens through ctx.onWorldChange.
  const ctx = { config, db, deps: d, limiters: null, world: null, closers: [], onWorldChange: null, helpers: null };
  const world = createWorld({ now: d.now, onChange: (e) => { if (ctx.onWorldChange) ctx.onWorldChange(e); } });
  // Token buckets per spec S14 (rate is tokens/second). Keys are chosen by the route that uses them.
  const limiters = {
    deviceStart: createLimiter({ rate: 10 / 3600, burst: 10 }), // key: IP
    deviceToken: createLimiter({ rate: 1 / 5, burst: 1 }), // key: device_code hash
    publish: createLimiter({ rate: 4, burst: 8 }), // key: device id
    login: createLimiter({ rate: 30 / 3600, burst: 30 }), // key: IP
  };
  ctx.limiters = limiters;
  ctx.jwks = createJwks({ fetch: d.fetch, now: d.now });
  ctx.world = world;
  ctx.helpers = { readBody, send, sendJson, parseCookies, clientIp: (req) => clientIp(req, config.trustProxy), HttpError };

  ctx.accounts = createAccounts(ctx);
  ctx.googleCheck = createGoogleCheck(ctx);

  const routes = [...ROUTE_MODULES, ...(deps.routeModules || [])].flatMap((m) => m(ctx));
  const server = http.createServer(createRouter(routes, { log: d.log, now: d.now }));

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
