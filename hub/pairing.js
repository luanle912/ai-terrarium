'use strict';
// Device pairing (spec 9.2): the machine asks for a code, the owner types it in the browser and approves.
//   POST /api/device/start, POST /api/device/token  JSON, unauthenticated, never read cookies (S11)
//   GET /device, POST /device                       browser form (session + CSRF)
// Only SHA-256 hashes of device_code and device tokens are stored (S9). Nothing secret is logged.

const crypto = require('node:crypto');
const { HttpError, send, sendJson } = require('./http.js');
const { sha256hex } = require('./auth.js');
const { escapeHtml, devicePage, ISLAND_COLORS, PAGE_CSP } = require('./pages.js');

const ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
const CODE_TTL_MS = 600 * 1000;
const INTERVAL_S = 5;
const BODY_LIMIT = 4096; // S15
const MAX_WRONG = 5;
const WRONG_WINDOW_MS = 10 * 60 * 1000;
const HUB_FULL_MSG = 'Hub đã đủ 8 đảo, nhờ owner xoá bớt.';
const NO_STORE = { 'Cache-Control': 'no-store' };
const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': PAGE_CSP, ...NO_STORE };

function newUserCode(rand = (n) => crypto.randomInt(n)) {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[rand(ALPHABET.length)];
  return s.slice(0, 4) + '-' + s.slice(4);
}

// Case-insensitive, ignores spaces and dashes. Eight characters come back as XXXX-XXXX.
function normalizeUserCode(s) {
  const t = String(s || '').toUpperCase().replace(/[\s-]/g, '');
  return t.length === 8 ? t.slice(0, 4) + '-' + t.slice(4) : t;
}

const colorFor = (userId) => ISLAND_COLORS[crypto.createHash('sha256').update(String(userId)).digest().readUInt32BE(0) % ISLAND_COLORS.length];

function cleanName(v) {
  const s = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  return s || 'Máy';
}

const json = (res, status, obj) => sendJson(res, status, obj);

function routes(ctx) {
  const { config, db, deps, limiters, helpers } = ctx;
  const wrong = new Map(); // session token_hash -> {fails: [ms...], lockedUntil}

  async function jsonBody(req) {
    const raw = await helpers.readBody(req, BODY_LIMIT);
    try {
      const o = JSON.parse(raw.toString('utf8') || '{}');
      if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('shape');
      return o;
    } catch { throw new HttpError(400, 'bad json'); }
  }

  function locked(key, now) {
    const w = wrong.get(key);
    return !!w && w.lockedUntil > now;
  }
  function recordWrong(key, now) {
    if (wrong.size > 10000) for (const [k, v] of wrong) if (v.lockedUntil <= now && !v.fails.some((t) => now - t < WRONG_WINDOW_MS)) wrong.delete(k);
    const w = wrong.get(key) || { fails: [], lockedUntil: 0 };
    w.fails = w.fails.filter((t) => now - t < WRONG_WINDOW_MS);
    w.fails.push(now);
    if (w.fails.length >= MAX_WRONG) { w.lockedUntil = now + WRONG_WINDOW_MS; w.fails = []; }
    wrong.set(key, w);
  }

  function html(res, status, body) { send(res, status, body, HTML); }

  function ensureIsland(user, now) {
    const existing = db.getIslandByUser(user.id);
    if (existing) return existing;
    const base = (user.name && String(user.name).trim()) || String(user.email || '').split('@')[0] || 'Ai đó';
    const r = db.claimIsland({ id: crypto.randomBytes(8).toString('hex'), userId: user.id, name: ('Đảo ' + base).slice(0, 60), color: colorFor(user.id), now });
    return r.full ? null : r.island;
  }

  // The hub is full and this user has no island: the code is refused for good (not a wrong code, so no recordWrong).
  function refuseFull(res, s, row, req) {
    db.denyDeviceCode(row.code_hash, 'hub_full');
    ctx.accounts.audit('pair_refused_full', { actorId: s.user.id, target: 'user:' + s.user.id, ip: helpers.clientIp(req) });
    return html(res, 400, devicePage({ csrf: s.session.csrf, error: HUB_FULL_MSG }));
  }

  const list = [];

  list.push({
    method: 'POST', path: '/api/device/start', ownLimit: true,
    async handler(req, res) {
      const now = deps.now();
      if (!limiters.deviceStart.take(helpers.clientIp(req), now)) throw new HttpError(429, 'too many requests');
      const body = await jsonBody(req);
      const name = cleanName(body.name);
      const deviceCode = crypto.randomBytes(32).toString('base64url');
      let userCode = null;
      for (let i = 0; i < 8 && !userCode; i++) {
        const c = newUserCode();
        try {
          db.createDeviceCode({ codeHash: sha256hex(deviceCode), userCode: c, name, now, expiresAt: now + CODE_TTL_MS, ip: helpers.clientIp(req) });
          userCode = c;
        } catch (e) { if (!/UNIQUE|constraint/i.test(String(e && e.message))) throw e; }
      }
      if (!userCode) throw new HttpError(503, 'try again');
      json(res, 200, { device_code: deviceCode, user_code: userCode, verification_uri: config.publicUrl + '/device', expires_in: CODE_TTL_MS / 1000, interval: INTERVAL_S });
    },
  });

  list.push({
    method: 'POST', path: '/api/device/token', ownLimit: true,
    async handler(req, res) {
      const body = await jsonBody(req);
      if (typeof body.device_code !== 'string' || !body.device_code || body.device_code.length > 200) throw new HttpError(400, 'bad request');
      const now = deps.now();
      const hash = sha256hex(body.device_code);
      const row = db.getDeviceCodeByHash(hash);
      if (!row) return json(res, 410, { error: 'expired_token' });
      if (row.expires_at <= now) { db.deleteDeviceCode(hash); return json(res, 410, { error: 'expired_token' }); }
      if (!limiters.deviceToken.take(hash, now)) return json(res, 429, { error: 'slow_down' });
      db.touchDeviceCodePoll(hash, now);
      if (row.denied) { db.deleteDeviceCode(hash); return json(res, 403, { error: row.deny_reason === 'hub_full' ? 'hub_full' : 'access_denied' }); }
      if (row.approved_user_id == null) return json(res, 428, { error: 'authorization_pending' });
      // Claim the row first: of two concurrent polls only one deletes it and gets the token.
      if (!db.deleteDeviceCode(hash)) return json(res, 410, { error: 'expired_token' });
      const user = db.getUserById(row.approved_user_id);
      const island = user && db.getIslandByUser(user.id);
      if (!user || user.banned_at != null || !island) return json(res, 403, { error: 'access_denied' });
      const token = 'trd_' + crypto.randomBytes(32).toString('base64url');
      const id = crypto.randomBytes(8).toString('hex');
      db.createDevice({ id, userId: user.id, name: row.name, tokenHash: sha256hex(token), now });
      ctx.accounts.audit('device_paired', { actorId: user.id, target: 'device:' + id, ip: helpers.clientIp(req) });
      json(res, 200, { token, device_id: id, island_id: island.id });
    },
  });

  // The machine retires its own token (leave / re-join). Bearer only: cookies are never read here.
  list.push({
    method: 'POST', path: '/api/device/revoke-self',
    handler(req, res) {
      const m = /^Bearer (\S{1,200})$/.exec(String(req.headers.authorization || ''));
      const device = m && db.getDeviceByTokenHash(sha256hex(m[1]));
      if (!device || device.revoked_at != null) throw new HttpError(401, 'unauthorized');
      db.revokeDevice(device.id, device.user_id, deps.now());
      ctx.world.removeDevice(device.id);
      ctx.accounts.audit('device_revoked', { actorId: null, target: 'device:' + device.id + ' user:' + device.user_id, ip: helpers.clientIp(req) });
      send(res, 204, '');
    },
  });

  list.push({
    method: 'GET', path: '/device',
    // ?code= (from the local page's join button) opens the confirm page; approving still needs the POST below.
    handler(req, res, rc) {
      const raw = rc && rc.query ? rc.query.get('code') : null;
      const code = raw ? normalizeUserCode(raw) : '';
      const valid = /^[A-Z]{4}-[A-Z]{4}$/.test(code);
      const s = helpers.requireSession(req);
      if (!s) return send(res, 302, '', { Location: '/auth/login', ...NO_STORE, ...(valid ? { 'Set-Cookie': helpers.pairCookie(code) } : {}) });
      const csrf = s.session.csrf;
      if (!valid) return html(res, 200, devicePage({ csrf }));
      const now = deps.now();
      const key = s.session.token_hash;
      if (locked(key, now)) return html(res, 429, devicePage({ csrf, error: 'Nhập sai quá nhiều lần. Thử lại sau 10 phút.' }));
      const row = db.getDeviceCodeByUserCode(code);
      if (!row || row.expires_at <= now || row.denied || row.approved_user_id != null) {
        recordWrong(key, now);
        return html(res, 200, devicePage({ csrf, error: 'Mã không đúng hoặc đã hết hạn.' }));
      }
      html(res, 200, devicePage({ csrf, device: { name: row.name, userCode: row.user_code, requestedAt: row.created_at } }));
    },
  });

  list.push({
    method: 'POST', path: '/device',
    async handler(req, res) {
      const s = helpers.requireSession(req);
      if (!s) throw new HttpError(401, 'not signed in');
      const form = new URLSearchParams((await helpers.readBody(req, BODY_LIMIT)).toString('utf8'));
      if (!helpers.requireCsrf(req, s.session, form.get('csrf') || '')) throw new HttpError(403, 'forbidden');
      const now = deps.now();
      const key = s.session.token_hash;
      const csrf = s.session.csrf;
      if (locked(key, now)) return html(res, 429, devicePage({ csrf, error: 'Nhập sai quá nhiều lần. Thử lại sau 10 phút.' }));
      const action = form.get('action');
      if (!['lookup', 'approve', 'deny'].includes(action)) throw new HttpError(400, 'bad request');
      const code = normalizeUserCode(form.get('user_code'));
      const row = /^[A-Z]{4}-[A-Z]{4}$/.test(code) ? db.getDeviceCodeByUserCode(code) : undefined;
      if (!row || row.expires_at <= now || row.denied || row.approved_user_id != null) {
        recordWrong(key, now);
        return html(res, 400, devicePage({ csrf, error: 'Mã không đúng hoặc đã hết hạn.' }));
      }
      const device = { name: row.name, userCode: row.user_code, requestedAt: row.created_at };
      if (action !== 'deny' && !db.getIslandByUser(s.user.id) && db.islandCount() >= db.MAX_ISLANDS) return refuseFull(res, s, row, req);
      if (action === 'lookup') return html(res, 200, devicePage({ csrf, device }));
      if (action === 'deny') { db.denyDeviceCode(row.code_hash); return html(res, 200, devicePage({ csrf, done: 'denied' })); }
      // C2: the island appears with the first approved device; losing the race for the last slot is a refusal
      if (!ensureIsland(s.user, now)) return refuseFull(res, s, row, req);
      if (!db.approveDeviceCode(row.code_hash, s.user.id, now)) {
        recordWrong(key, now);
        return html(res, 400, devicePage({ csrf, error: 'Mã không đúng hoặc đã hết hạn.' }));
      }
      html(res, 200, devicePage({ csrf, done: 'approved', device }));
    },
  });

  return list;
}

module.exports = { routes, HUB_FULL_MSG, newUserCode, normalizeUserCode };
