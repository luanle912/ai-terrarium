'use strict';
// "Của tôi" on the hub: the /me page, its JSON API, leaving the hub, and owners removing an island.
//   GET  /me, POST /me/island, POST /me/devices/revoke, GET+POST /me/leave   browser pages (session + CSRF field)
//   GET  /api/me                                                            island, colours, devices with send state
//   POST /api/me/island, POST /api/me/devices/:id/revoke                    JSON, CSRF header + Origin
//   POST /api/owner/islands/:id/remove                                      owners only; never an owner's island

const { HttpError, send, sendJson } = require('./http.js');
const { mePage, leavePage, leftPage, ISLAND_COLORS, PAGE_CSP, isNewDevice } = require('./pages.js');
const { validIslandName } = require('./validate.js');

const BODY_LIMIT = 4096; // S15
const NO_STORE = { 'Cache-Control': 'no-store' };
const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': PAGE_CSP, ...NO_STORE };

function routes(ctx) {
  const { config, db, deps, world, helpers, accounts } = ctx;
  const list = [];
  const redirect = (res, to) => send(res, 302, '', { Location: to, ...NO_STORE });
  const html = (res, body) => send(res, 200, body, HTML);

  function session(req) {
    const s = helpers.requireSession(req);
    if (!s) throw new HttpError(401, 'not signed in');
    return s;
  }
  async function formBody(req) {
    return new URLSearchParams((await helpers.readBody(req, BODY_LIMIT)).toString('utf8'));
  }
  async function jsonBody(req) {
    const raw = await helpers.readBody(req, BODY_LIMIT);
    try {
      const o = JSON.parse(raw.toString('utf8') || '{}');
      if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('shape');
      return o;
    } catch { throw new HttpError(400, 'bad json'); }
  }
  const csrfOrFail = (req, s, field) => { if (!helpers.requireCsrf(req, s.session, field)) throw new HttpError(403, 'forbidden'); };

  // Validates {name?, color?} (undefined = keep) and applies it. Returns the island row.
  function updateIsland(s, req, input) {
    const island = db.getIslandByUser(s.user.id);
    if (!island) throw new HttpError(404, 'no island');
    let name = island.name;
    let color = island.color;
    if (input.name !== undefined) {
      name = validIslandName(input.name);
      if (name == null) throw new HttpError(400, 'bad name');
    }
    if (input.color !== undefined) {
      if (typeof input.color !== 'string' || !ISLAND_COLORS.includes(input.color)) throw new HttpError(400, 'bad color');
      color = input.color;
    }
    const updated = db.updateIsland(s.user.id, { name, color });
    world.setIslandMeta(updated.id, { name: updated.name, color: updated.color });
    accounts.audit('island_updated', { actorId: s.user.id, target: 'island:' + updated.id, ip: helpers.clientIp(req) });
    return updated;
  }

  function revokeDevice(s, req, id) {
    // Owner-scoped: someone else's device id changes nothing. S19: effective at once.
    if (!db.revokeDevice(id, s.user.id, deps.now())) return false;
    world.removeDevice(id);
    accounts.audit('device_revoked', { actorId: s.user.id, target: 'device:' + id, ip: helpers.clientIp(req) });
    return true;
  }

  list.push({
    method: 'GET', path: '/me',
    handler(req, res) {
      const s = helpers.requireSession(req);
      if (!s) return redirect(res, '/auth/login');
      html(res, mePage({
        csrf: s.session.csrf, user: s.user, island: db.getIslandByUser(s.user.id), devices: db.listDevices(s.user.id),
        colors: ISLAND_COLORS, now: deps.now(),
      }));
    },
  });

  list.push({
    method: 'GET', path: '/api/me',
    handler(req, res) {
      const s = session(req);
      const now = deps.now();
      const island = db.getIslandByUser(s.user.id);
      const live = new Map(island ? world.devicesOf(island.id).map((d) => [d.deviceId, d]) : []);
      const devices = db.listDevices(s.user.id).map((d) => {
        const revoked = d.revoked_at != null;
        const w = !revoked && live.get(d.id);
        const online = !!w && w.online;
        return {
          id: d.id, name: d.name, createdAt: d.created_at, lastUsedAt: d.last_used_at, revokedAt: d.revoked_at,
          isNew: isNewDevice(d, now),
          send: revoked ? 'revoked' : online ? (w.private ? 'private' : 'sending') : 'offline',
          share: w ? w.share : null,
        };
      });
      sendJson(res, 200, { island: island ? { id: island.id, name: island.name, color: island.color } : null, colors: ISLAND_COLORS, devices });
    },
  });

  list.push({
    method: 'POST', path: '/api/me/island',
    async handler(req, res) {
      const s = session(req);
      const body = await jsonBody(req);
      csrfOrFail(req, s, '');
      const i = updateIsland(s, req, { name: body.name, color: body.color });
      sendJson(res, 200, { island: { id: i.id, name: i.name, color: i.color } });
    },
  });

  list.push({
    method: 'POST', path: '/me/island',
    async handler(req, res) {
      const s = session(req);
      const form = await formBody(req);
      csrfOrFail(req, s, form.get('csrf') || '');
      updateIsland(s, req, { name: form.get('name') ?? undefined, color: form.get('color') ?? undefined });
      redirect(res, '/me');
    },
  });

  list.push({
    method: 'POST', path: /^\/api\/me\/devices\/([0-9a-f]{16})\/revoke$/,
    handler(req, res, rc) {
      const s = session(req);
      csrfOrFail(req, s, '');
      if (!revokeDevice(s, req, rc.match[1])) throw new HttpError(404, 'not found');
      sendJson(res, 200, { ok: true });
    },
  });

  list.push({
    method: 'POST', path: '/me/devices/revoke',
    async handler(req, res) {
      const s = session(req);
      const form = await formBody(req);
      csrfOrFail(req, s, form.get('csrf') || '');
      const id = form.get('device_id') || '';
      if (id.length > 64) throw new HttpError(400, 'bad request');
      revokeDevice(s, req, id);
      redirect(res, '/me');
    },
  });

  list.push({
    method: 'GET', path: '/me/leave',
    handler(req, res) {
      const s = helpers.requireSession(req);
      if (!s) return redirect(res, '/auth/login');
      html(res, leavePage({ csrf: s.session.csrf }));
    },
  });

  list.push({
    method: 'POST', path: '/me/leave',
    async handler(req, res) {
      const s = session(req);
      const form = await formBody(req);
      csrfOrFail(req, s, form.get('csrf') || '');
      await accounts.leave(s.user.id, { ip: helpers.clientIp(req) });
      helpers.clearSessionCookie(res);
      send(res, 200, leftPage(), HTML);
    },
  });

  list.push({
    method: 'POST', path: /^\/api\/owner\/islands\/([0-9a-f]{16})\/remove$/,
    handler(req, res, rc) {
      const s = session(req);
      csrfOrFail(req, s, '');
      if (!helpers.isOwner(s.user)) return sendJson(res, 403, { error: 'forbidden' });
      const island = db.getIsland(rc.match[1]);
      if (!island) throw new HttpError(404, 'not found');
      const holder = db.getUserById(island.user_id);
      if (holder && helpers.isOwner(holder)) return sendJson(res, 403, { error: 'owner_island' });
      accounts.removeIslandOf(island.user_id, { actorId: s.user.id, ip: helpers.clientIp(req) });
      sendJson(res, 200, { ok: true });
    },
  });

  return list;
}

module.exports = { routes };
