'use strict';
// Account actions: ban, remove an island, leave, audit (spec §0 GĐ2 block). Everything here is idempotent enough to
// be retried. Helpers from ctx.helpers (endSessionsForUser) and ctx.world are read when called, so this module can
// be created before the routes that install them.
//   audit(action, {actorId, target, ip})
//   revokeToken(plain)   -> Promise<void>   best effort POST to Google's revoke endpoint (10 s timeout)
//   revokeGoogle(userId) -> Promise<void>   revokes the user's stored refresh token and ALWAYS clears it
//   banUser(userId, reason, {actorId}) -> Promise<void>
//   removeIslandOf(userId, {actorId, ip}) -> boolean   false when the user has no island
//   leave(userId, {ip}) -> Promise<void>

const { open } = require('./secret.js');

const GOOGLE_REVOKE = 'https://oauth2.googleapis.com/revoke';

function createAccounts(ctx) {
  const { config, db, deps } = ctx;

  function audit(action, { actorId = null, target = null, ip = null } = {}) {
    db.addAudit({ at: deps.now(), actorId, action, target, ip });
  }

  async function revokeToken(token) {
    try {
      const r = await deps.fetch(GOOGLE_REVOKE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
        signal: AbortSignal.timeout(10000),
      });
      if (r && r.body && typeof r.body.cancel === 'function') await r.body.cancel().catch(() => {});
    } catch { /* best effort: Google being unreachable must not block the account action */ }
  }

  async function revokeGoogle(userId) {
    const user = db.getUserById(userId);
    try {
      if (user && user.refresh_enc) {
        let token = null;
        try { token = open(config.secretKey, user.refresh_enc, 'user:' + userId); } catch { /* unreadable: just delete */ }
        if (token) await revokeToken(token);
      }
    } finally {
      db.setRefreshToken(userId, null); // whatever Google answered, the hub no longer holds the token
    }
  }

  async function banUser(userId, reason, { actorId = null } = {}) {
    const now = deps.now();
    db.banUser(userId, reason, now);
    try {
      db.revokeDevicesForUser(userId, now);
      ctx.helpers.endSessionsForUser(userId, 'banned');
      const island = db.getIslandByUser(userId);
      if (island) ctx.world.removeIsland(island.id); // the islands row stays: the user keeps their name and colour
    } finally {
      // Even if a step above threw, the Google token must go and the ban must be on record.
      try { await revokeGoogle(userId); } finally {
        audit('user_banned', { actorId, target: 'user:' + userId + ' ' + reason });
      }
    }
  }

  function removeIslandOf(userId, { actorId = null, ip = null } = {}) {
    // Devices point at users, not islands: revoke them first so a later pairing makes a fresh island.
    db.revokeDevicesForUser(userId, deps.now());
    const island = db.getIslandByUser(userId);
    if (!island) return false;
    try {
      db.deleteIslandByUser(userId); // first: the world's `remove` is only sent once the row is gone
    } finally {
      ctx.world.removeIsland(island.id); // runs even if the delete threw; the error still propagates
    }
    audit('island_removed', { actorId, target: 'island:' + island.id + ' user:' + userId, ip });
    return true;
  }

  async function leave(userId, { ip = null } = {}) {
    removeIslandOf(userId, { actorId: userId, ip });
    ctx.helpers.endSessionsForUser(userId, 'left');
    await revokeGoogle(userId);
    db.clearUserIdentity(userId);
    audit('user_left', { actorId: userId, target: 'user:' + userId, ip });
  }

  return { audit, revokeToken, revokeGoogle, banUser, removeIslandOf, leave };
}

module.exports = { createAccounts };
