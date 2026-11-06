'use strict';
// Publish, live world and viewer pages (spec 9.3-9.5).
//   POST /api/publish          Bearer device token, JSON <= 16KB. Cookies are never read here (S11).
//     Optional header X-Terrarium-Instance: 16 hex of the publishing process; missing or malformed = 'legacy' (never 400).
//     Answers 200 {accepted: true} | {accepted: false, reason: 'stale_seq', seq} | {accepted: false, reason: 'other_instance'}.
//   GET  /api/world/stream     SSE for signed-in viewers: `world`, `island`, `remove` events, and `ping` {t} every 25 s
//     `world` = {islands: [{id, name, color, slot, online, private, share}], viewers, capacity}, ordered by slot. It lists
//     every island that has a slot (from the DB), so an island with no device sending stays in its slot as online:false.
//     Islands with slot NULL (hidden, over capacity) never appear in any event. `remove` is sent only when the island
//     row is gone; revoking the last device or a ban sends `island {id, sessions: []}` + `world` instead.
//     `world` to everyone goes through one valve (H3): at most one per WORLD_EVERY_MS, leading + trailing, computed and
//     serialised once, and not sent at all when the frame equals the last one sent (H11). A new viewer gets its own
//     `world` and `island` events at once, alone; the new viewer count reaches the others by the trailing send.
//     An island with a slot that has not been heard from since this hub started carries `waking: true` (still
//     online: false) for OFFLINE_MS, while its machines come back after a restart (H2). Old pages ignore the key.
//   GET  /                     welcome page with the sign-in button, or the claude-office.html page
// ctx.streams = {check(), count()} is exposed for tests and the periodic session check (B8).
// ctx.stats = {worldBroadcasts, framesWritten} counts what the streams cost.

const path = require('node:path');
const { HttpError, send, sendJson, SECURITY_HEADERS } = require('./http.js');
const { sha256hex, NO_REFRESH_TTL_MS } = require('./auth.js');
const { validatePublish } = require('./validate.js');
const { createOfficePage } = require('./csp.js');
const { welcomePage, PAGE_CSP } = require('./pages.js');
const { OFFLINE_MS } = require('./world.js');

const PUBLISH_LIMIT = 16 * 1024;
const PING_MS = 25 * 1000;
const INSTANCE_RE = /^[0-9a-f]{16}$/;
const CHECK_MS = 60 * 1000;
const TICK_MS = 5 * 1000;
const ISLAND_EVERY_MS = 500; // at most 2 island events per second per island
const WORLD_EVERY_MS = 1000; // at most one `world` broadcast per second
const MAX_BUFFERED = 1024 * 1024;
const TOUCH_EVERY_MS = 30 * 1000;
const NO_STORE = { 'Cache-Control': 'no-store' };
// On close every stream is told to come back after RESTART_MIN_MS + [0, RESTART_SPREAD_MS), so 300 viewers do
// not reconnect in the same second and an old page's EventSource waits out a short restart instead of 3 s.
const RESTART_MIN_MS = 5000;
const RESTART_SPREAD_MS = 15000;
const OFFICE_FILE = path.join(__dirname, '..', 'claude-office.html');
const officePage = createOfficePage(OFFICE_FILE);

function routes(ctx) {
  const { db, deps, limiters, world, helpers } = ctx;
  const { MAX_ISLANDS } = db;
  const streams = new Set(); // {res, userId, tokenHash}
  const lastSent = new Map(); // island id -> ms (real clock, throttle only)
  const pending = new Map(); // island id -> timer
  // island id -> slot of every island that has one, so island events never read the DB. Slots only change when an
  // island is claimed (its first publish emits `world` before `island`) or deleted (a `remove`); every read of the
  // slotted list (each `world` payload, each removal, hub start) refreshes it.
  const slots = new Map();
  const setSlots = (rows) => { slots.clear(); for (const r of rows) slots.set(r.id, r.slot); return rows; };
  const slottedRows = () => setSlots(db.listSlottedIslands());
  slottedRows();
  let closing = false;
  const stats = { worldBroadcasts: 0, framesWritten: 0 };
  ctx.stats = stats;
  // H2: islands not heard from since this start are `waking` until startedAt + OFFLINE_MS.
  const startedAt = deps.now();
  const heard = new Set(); // island ids that have been live in RAM since startedAt
  const isWaking = () => deps.now() - startedAt < OFFLINE_MS;

  function write(s, text) {
    try {
      if (s.res.destroyed || s.res.writableEnded) return;
      if (s.res.writableLength > MAX_BUFFERED) { s.res.destroy(); return; } // a stalled viewer must not grow memory
      stats.framesWritten++;
      s.res.write(text);
    } catch { /* ignore */ }
  }
  const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const broadcast = (event, data) => { const f = frame(event, data); for (const s of streams) write(s, f); };

  // Islands come from the DB (name, colour, slot); RAM only adds the live state. Not in RAM = offline, nothing shared.
  const worldPayload = () => {
    const live = new Map(world.islands().map((m) => [m.id, m]));
    const waking = isWaking();
    return {
      islands: slottedRows().map((row) => {
        const m = live.get(row.id);
        if (m) heard.add(row.id);
        const i = {
          id: row.id, name: row.name, color: row.color, slot: row.slot,
          online: m ? m.online : false, private: m ? m.private : false, share: m ? m.share : 'kin',
        };
        if (!m && waking && !heard.has(row.id)) i.waking = true;
        return i;
      }),
      viewers: streams.size,
      capacity: MAX_ISLANDS,
    };
  };
  const islandPayload = (id) => ({ id, sessions: world.snapshotFor(id) });
  const isSlotted = (id) => slots.has(id);

  // The `world` valve: leading + trailing, at most one broadcast per WORLD_EVERY_MS (real clock, throttle only).
  let worldAt = 0;
  let worldTimer = null;
  let lastWorld = null; // the last `world` frame broadcast
  function sendWorld() {
    if (closing) return;
    const f = frame('world', worldPayload());
    if (f === lastWorld) return; // H11: nothing changed for the viewers
    lastWorld = f;
    worldAt = Date.now();
    stats.worldBroadcasts++;
    for (const s of streams) write(s, f);
  }
  // lead = false (a new viewer, who already has its own world): never send at once, only a full window later.
  function scheduleWorld(lead = true) {
    if (closing || worldTimer) return; // a pending trailing send computes the newest state
    // A newcomer already has its world, so the others hear of it a full WORLD_EVERY_MS later: a reconnect storm
    // folds into one send instead of riding whatever is left of the last window.
    let wait = lead ? WORLD_EVERY_MS - (Date.now() - worldAt) : WORLD_EVERY_MS;
    if (wait <= 0) return sendWorld();
    worldTimer = setTimeout(() => { worldTimer = null; sendWorld(); }, wait);
    worldTimer.unref();
  }

  function sendIsland(id) {
    if (!isSlotted(id)) return; // hidden islands are never sent
    lastSent.set(id, Date.now());
    broadcast('island', islandPayload(id));
  }
  function onChange(e) {
    if (closing) return;
    if (e.id) heard.add(e.id);
    // A claim shows up as `world` before the island's first `island` event: refresh the slots now, since the
    // `world` broadcast itself may come up to WORLD_EVERY_MS later.
    if (e.type === 'world') { slottedRows(); return scheduleWorld(); }
    if (e.type === 'remove') {
      const t = pending.get(e.id);
      if (t) { clearTimeout(t); pending.delete(e.id); }
      lastSent.delete(e.id);
      // The row is still there (last device revoked, ban): the island stays in its slot, offline and empty.
      const row = db.getIsland(e.id);
      if (row) {
        if (row.slot != null) broadcast('island', { id: e.id, sessions: [] });
        return scheduleWorld();
      }
      broadcast('remove', { id: e.id });
      // A freed slot may promote a hidden island whose `island` events were dropped while hidden: send just that one,
      // through the throttle like any island event (the other islands' viewers already have their state).
      const before = new Set(slots.keys());
      for (const r of slottedRows()) if (!before.has(r.id) && world.snapshotFor(r.id).length > 0) queueIsland(r.id);
      return;
    }
    if (e.type === 'island') queueIsland(e.id);
  }
  // At most one `island` event per ISLAND_EVERY_MS per island; a trailing send carries the newest state.
  function queueIsland(id) {
    if (!isSlotted(id)) return;
    if (pending.has(id)) return; // the trailing send will carry the newest state
    const wait = ISLAND_EVERY_MS - (Date.now() - (lastSent.get(id) || 0));
    if (wait <= 0) return sendIsland(id);
    const t = setTimeout(() => { pending.delete(id); if (!closing) sendIsland(id); }, wait);
    t.unref();
    pending.set(id, t);
  }
  ctx.onWorldChange = onChange;

  function endStream(s) {
    if (!streams.delete(s)) return;
    try { s.res.end(); } catch { /* ignore */ }
    scheduleWorld();
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
    // A named event (not an SSE comment) so the page can see it and watch the stream.
    setInterval(() => { const f = frame('ping', { t: deps.now() }); for (const s of streams) write(s, f); }, ctx.pingMs || PING_MS),
    setInterval(() => { try { check(); } catch { /* ignore */ } }, CHECK_MS),
    setInterval(() => { try { world.tick(); } catch { /* ignore */ } }, TICK_MS),
  ];
  timers.forEach((t) => t.unref());
  // Ends the waking window: one `world` without the flag. ctx.wakeMs (tests) re-checks the hub clock sooner.
  let wakeTimer = null;
  const armWake = () => {
    wakeTimer = setTimeout(() => {
      if (isWaking()) return armWake();
      wakeTimer = null;
      heard.clear(); // only used inside the window
      scheduleWorld();
    }, ctx.wakeMs || Math.max(1, startedAt + OFFLINE_MS - deps.now()));
    wakeTimer.unref();
  };
  armWake();
  const random = deps.random || Math.random;
  ctx.closers.push(() => {
    closing = true; // no `world` (or `island`) is sent from here on
    timers.forEach(clearInterval);
    clearTimeout(worldTimer); worldTimer = null;
    clearTimeout(wakeTimer); wakeTimer = null;
    for (const t of pending.values()) clearTimeout(t);
    pending.clear();
    for (const s of [...streams]) {
      streams.delete(s);
      const r = RESTART_MIN_MS + Math.floor(random() * RESTART_SPREAD_MS);
      write(s, `event: restarting\ndata: ${JSON.stringify({ retryMs: r })}\nretry: ${r}\n\n`);
      try { s.res.end(); } catch { /* ignore */ }
    }
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

  const list = [];

  list.push({
    method: 'POST', path: '/api/publish', ownLimit: true,
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
      const h = req.headers['x-terrarium-instance'];
      const instance = typeof h === 'string' && INSTANCE_RE.test(h) ? h : null;
      const result = world.publish({ id: auth.island.id, name: auth.island.name, color: auth.island.color, slot: auth.island.slot }, d.id, r.value.share, r.value, { instance });
      sendJson(res, 200, result);
    },
  });

  list.push({
    method: 'GET', path: '/api/world/stream',
    handler(req, res) {
      const s = helpers.requireSession(req);
      if (!s) throw new HttpError(401, 'not signed in');
      // Caps are answered before the SSE headers go out. The counts come from the live set, which every close
      // path (client abort, session end, server close) removes from, so a slot can never leak.
      const { perUser, total } = ctx.streamLimits;
      if (streams.size >= total) throw new HttpError(503, 'too many viewers', { 'Retry-After': '30' });
      let mine = 0;
      for (const x of streams) if (x.userId === s.user.id) mine++;
      if (mine >= perUser) throw new HttpError(429, 'too many streams', { 'Retry-After': '10' });
      res.writeHead(200, {
        ...SECURITY_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
      });
      const stream = { res, userId: s.user.id, tokenHash: s.session.token_hash };
      streams.add(stream);
      res.on('close', () => { if (streams.delete(stream)) scheduleWorld(); });
      res.write('retry: 3000\n\n');
      // The newcomer gets its first world and every island at once, alone; the others learn the new viewer count
      // from the trailing send (100 tabs reconnecting cost a few broadcasts, not 100).
      const wp = worldPayload();
      write(stream, frame('world', wp));
      for (const i of wp.islands) write(stream, frame('island', islandPayload(i.id)));
      lastWorld = null; // viewers no longer all hold the same frame: the next send must go out even if it matches
      scheduleWorld(false);
    },
  });

  list.push({
    method: 'GET', path: '/',
    handler(req, res) {
      const s = helpers.requireSession(req);
      if (!s) return send(res, 200, welcomePage(), { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': PAGE_CSP, ...NO_STORE });
      let page;
      try { page = officePage.get(); } catch { throw new HttpError(500, 'page missing'); }
      send(res, 200, page.body, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': page.csp, ...NO_STORE });
    },
  });

  return list;
}

module.exports = { routes, RESTART_MIN_MS, RESTART_SPREAD_MS, WORLD_EVERY_MS };
