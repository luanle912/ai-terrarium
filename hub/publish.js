'use strict';
// Publish, live world and viewer pages (spec 9.3-9.5).
//   POST /api/publish          Bearer device token, JSON <= 16KB. Cookies are never read here (S11).
//   GET  /api/world/stream     SSE for signed-in viewers: `world`, `island`, `remove` events, `: ping` every 25 s
//   GET  /me, POST /me/devices/revoke
//   GET  /                     redirect to login, or the claude-office.html page
// ctx.streams = {check(), count()} is exposed for tests and the periodic session check (B8).

const fs = require('node:fs');
const path = require('node:path');
const { HttpError, send, sendJson, SECURITY_HEADERS } = require('./http.js');
const { sha256hex, NO_REFRESH_TTL_MS } = require('./auth.js');
const { validatePublish } = require('./validate.js');
const { mePage, PAGE_CSP } = require('./pages.js');

const PUBLISH_LIMIT = 16 * 1024;
const FORM_LIMIT = 4096;
const PING_MS = 25 * 1000;
const CHECK_MS = 60 * 1000;
const TICK_MS = 5 * 1000;
const ISLAND_EVERY_MS = 500; // at most 2 island events per second per island
const MAX_BUFFERED = 1024 * 1024;
const TOUCH_EVERY_MS = 30 * 1000;
const NO_STORE = { 'Cache-Control': 'no-store' };
const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': PAGE_CSP, ...NO_STORE };
// The big page loads React from cdnjs and fonts today; the hash-based CSP comes in phase 2.
const OFFICE_CSP = "default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src https://fonts.gstatic.com; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com; img-src 'self' data:; " +
  "frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const OFFICE_FILE = path.join(__dirname, '..', 'claude-office.html');

function routes(ctx) {
  const { db, deps, limiters, world, helpers } = ctx;
  const streams = new Set(); // {res, userId, tokenHash}
  const lastSent = new Map(); // island id -> ms (real clock, throttle only)
  const pending = new Map(); // island id -> timer
  let closing = false;

  function write(s, text) {
    try {
      if (s.res.destroyed || s.res.writableEnded) return;
      if (s.res.writableLength > MAX_BUFFERED) { s.res.destroy(); return; } // a stalled viewer must not grow memory
      s.res.write(text);
    } catch { /* ignore */ }
  }
  const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const broadcast = (event, data) => { const f = frame(event, data); for (const s of streams) write(s, f); };

  const worldPayload = () => ({
    islands: world.islands().map((m) => ({ id: m.id, name: m.name, color: m.color, online: m.online, private: m.private, share: m.share })),
    viewers: streams.size,
  });
  const islandPayload = (id) => ({ id, sessions: world.snapshotFor(id) });

  function sendIsland(id) {
    lastSent.set(id, Date.now());
    broadcast('island', islandPayload(id));
  }
  function onChange(e) {
    if (closing) return;
    if (e.type === 'world') return broadcast('world', worldPayload());
    if (e.type === 'remove') {
      const t = pending.get(e.id);
      if (t) { clearTimeout(t); pending.delete(e.id); }
      lastSent.delete(e.id);
      return broadcast('remove', { id: e.id });
    }
    if (e.type === 'island') {
      if (pending.has(e.id)) return; // the trailing send will carry the newest state
      const wait = ISLAND_EVERY_MS - (Date.now() - (lastSent.get(e.id) || 0));
      if (wait <= 0) return sendIsland(e.id);
      const t = setTimeout(() => { pending.delete(e.id); if (!closing) sendIsland(e.id); }, wait);
      t.unref();
      pending.set(e.id, t);
    }
  }
  ctx.onWorldChange = onChange;

  function endStream(s) {
    if (!streams.delete(s)) return;
    try { s.res.end(); } catch { /* ignore */ }
    if (!closing) broadcast('world', worldPayload());
  }

  // B8: logout / expiry / ban close that session's streams at once.
  helpers.onSessionEnd(({ tokenHash }) => { for (const s of [...streams]) if (s.tokenHash === tokenHash) endStream(s); });

  // The hourly cleanup deletes expired sessions without notifying, so also look at every stream every 60 s.
  function check() {
    const now = deps.now();
    for (const s of [...streams]) {
      let ok = false;
      try {
        const row = db.getSession(s.tokenHash);
        const user = row && db.getUserById(row.user_id);
        ok = !!row && row.expires_at > now && !!user && user.banned_at == null;
      } catch { ok = false; }
      if (!ok) endStream(s);
    }
  }
  ctx.streams = { check, count: () => streams.size };

  const timers = [
    setInterval(() => { for (const s of streams) write(s, ': ping\n\n'); }, PING_MS),
    setInterval(() => { try { check(); } catch { /* ignore */ } }, CHECK_MS),
    setInterval(() => { try { world.tick(); } catch { /* ignore */ } }, TICK_MS),
  ];
  timers.forEach((t) => t.unref());
  ctx.closers.push(() => {
    closing = true;
    timers.forEach(clearInterval);
    for (const t of pending.values()) clearTimeout(t);
    pending.clear();
    for (const s of [...streams]) { streams.delete(s); try { s.res.end(); } catch { /* ignore */ } }
  });

  // Returns {device, island}, null (401), or false when it already replied 403 login_required.
  function bearerDevice(req, res) {
    const m = /^Bearer (\S{1,200})$/.exec(String(req.headers.authorization || ''));
    if (!m) return null;
    const device = db.getDeviceByTokenHash(sha256hex(m[1]));
    if (!device || device.revoked_at != null) return null;
    const user = db.getUserById(device.user_id);
    if (!user || user.banned_at != null) return null;
    // Without a refresh token Google cannot be re-checked, so the device stops after 24 h until the next login.
    if (!user.refresh_enc && deps.now() - (user.last_login_at || 0) > NO_REFRESH_TTL_MS) {
      sendJson(res, 403, { error: 'login_required' });
      return false;
    }
    const island = db.getIslandByUser(user.id);
    return island ? { device, island } : null;
  }

  const redirect = (res, to) => send(res, 302, '', { Location: to, ...NO_STORE });
  const html = (res, body) => send(res, 200, body, HTML);

  const list = [];

  list.push({
    method: 'POST', path: '/api/publish',
    async handler(req, res) {
      const auth = bearerDevice(req, res); // cookies are ignored on purpose
      if (auth === false) return;
      if (!auth) throw new HttpError(401, 'unauthorized');
      const now = deps.now();
      if (!limiters.publish.take(auth.device.id, now)) {
        return send(res, 429, 'too many requests', { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '1' });
      }
      const raw = await helpers.readBody(req, PUBLISH_LIMIT);
      let body;
      try { body = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'bad json'); }
      const r = validatePublish(body);
      if (!r.ok) throw new HttpError(400, 'bad packet: ' + r.error);
      // The island and device come from the token only, never from the body.
      const d = db.getDevice(auth.device.id);
      if (!d || d.revoked_at != null) throw new HttpError(401, 'unauthorized'); // revoked while the body was in flight
      if (d.last_used_at == null || now - d.last_used_at > TOUCH_EVERY_MS) db.touchDevice(d.id, now);
      world.publish({ id: auth.island.id, name: auth.island.name, color: auth.island.color }, d.id, r.value.share, r.value);
      send(res, 204, '');
    },
  });

  list.push({
    method: 'GET', path: '/api/world/stream',
    handler(req, res) {
      const s = helpers.requireSession(req);
      if (!s) throw new HttpError(401, 'not signed in');
      res.writeHead(200, {
        ...SECURITY_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
      });
      const stream = { res, userId: s.user.id, tokenHash: s.session.token_hash };
      streams.add(stream);
      res.on('close', () => { if (streams.delete(stream) && !closing) broadcast('world', worldPayload()); });
      res.write('retry: 3000\n\n');
      broadcast('world', worldPayload()); // everybody learns the new viewer count; the newcomer gets its first world
      for (const m of world.islands()) write(stream, frame('island', islandPayload(m.id)));
    },
  });

  list.push({
    method: 'GET', path: '/me',
    handler(req, res) {
      const s = helpers.requireSession(req);
      if (!s) return redirect(res, '/auth/login');
      html(res, mePage({ csrf: s.session.csrf, user: s.user, island: db.getIslandByUser(s.user.id), devices: db.listDevices(s.user.id) }));
    },
  });

  list.push({
    method: 'POST', path: '/me/devices/revoke',
    async handler(req, res) {
      const s = helpers.requireSession(req);
      if (!s) throw new HttpError(401, 'not signed in');
      const form = new URLSearchParams((await helpers.readBody(req, FORM_LIMIT)).toString('utf8'));
      if (!helpers.requireCsrf(req, s.session, form.get('csrf') || '')) throw new HttpError(403, 'forbidden');
      const id = form.get('device_id') || '';
      if (id.length > 64) throw new HttpError(400, 'bad request');
      // Owner-scoped: someone else's device id changes nothing. S19: effective at once.
      if (db.revokeDevice(id, s.user.id, deps.now())) world.removeDevice(id);
      redirect(res, '/me');
    },
  });

  list.push({
    method: 'GET', path: '/',
    handler(req, res) {
      const s = helpers.requireSession(req);
      if (!s) return redirect(res, '/auth/login');
      let page;
      try { page = fs.readFileSync(OFFICE_FILE); } catch { throw new HttpError(500, 'page missing'); }
      send(res, 200, page, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': OFFICE_CSP, ...NO_STORE });
    },
  });

  return list;
}

module.exports = { routes };
