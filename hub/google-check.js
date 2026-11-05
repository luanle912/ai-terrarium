'use strict';
// Hourly Google check (B12): a user whose Google access was revoked or whose account left the allowed domain loses
// access within 24 h. Each user with a refresh token whose last check is older than 24 h gets one refresh-token
// grant; the answer decides ban / ok / "could not tell". Nothing from Google's replies is ever logged.
//   createGoogleCheck(ctx) -> {runOnce() -> Promise<{checked, banned, failed}>}

const { open } = require('./secret.js');
const { checkClaims } = require('./auth.js');

const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const STALE_MS = 24 * 3600 * 1000;
const WARN_AFTER_MS = 72 * 3600 * 1000;

function createGoogleCheck(ctx) {
  const { config, db, deps } = ctx;
  let running = null;

  async function checkUser(user, tally) {
    const now = () => deps.now();
    let token;
    try { token = open(config.secretKey, user.refresh_enc, 'user:' + user.id); } catch {
      // Unreadable (key changed, corrupt row): drop it. The user falls back to the 24 h rule instead of being banned.
      db.setRefreshToken(user.id, null);
      ctx.accounts.audit('refresh_unreadable', { target: 'user:' + user.id });
      return;
    }
    const failed = () => {
      tally.failed++;
      const { failSince } = db.markCheckFailed(user.id, now());
      const fresh = db.getUserById(user.id);
      if (failSince != null && now() - failSince >= WARN_AFTER_MS && fresh && fresh.check_warned_at == null) {
        ctx.accounts.audit('google_check_failing', { target: 'user:' + user.id });
        db.setCheckWarned(user.id, now());
      }
    };
    const ban = async () => { tally.banned++; await ctx.accounts.banUser(user.id, 'google_revoked'); };

    let res, body = null;
    try {
      res = await deps.fetch(GOOGLE_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token', refresh_token: token,
          client_id: config.googleClientId, client_secret: config.googleClientSecret,
        }).toString(),
        signal: AbortSignal.timeout(10000),
      });
      try { body = await res.json(); } catch { body = null; }
    } catch { return failed(); }

    if ((res.status === 400 || res.status === 401) && body && body.error === 'invalid_grant') return ban();
    if (res.status !== 200) return failed();
    if (body && body.id_token) {
      let claims;
      try { claims = await ctx.jwks.verify(body.id_token); } catch (e) {
        // Google's keys being unreachable says nothing about the user: count it as a failed check, not a ban.
        if (e && e.message === 'jwt: keys unavailable') return failed();
        return ban();
      }
      // A refreshed token carries no nonce.
      const r = checkClaims(claims, { clientId: config.googleClientId, domains: config.allowedDomains, nonce: null, now: now(), requireNonce: false });
      if (!r.ok || r.sub !== user.google_sub) return ban();
    }
    db.markChecked(user.id, now());
    tally.checked++;
  }

  async function run() {
    const tally = { checked: 0, banned: 0, failed: 0 };
    if (!config.googleClientId) return tally;
    for (const user of db.usersDueForCheck(deps.now(), STALE_MS)) {
      try { await checkUser(user, tally); } catch { deps.log('google check failed for one user'); }
    }
    return tally;
  }

  // Overlapping runs (a slow Google plus the hourly timer) share one pass.
  function runOnce() {
    if (!running) running = run().finally(() => { running = null; });
    return running;
  }

  return { runOnce };
}

module.exports = { createGoogleCheck };
