'use strict';
// Google sign-in (OIDC, domain restricted), sessions and CSRF (spec §9.1, B7, B8, S7, S9-S11, S20).
//
// Phase 1: the ID token comes straight from Google's token endpoint over TLS, so its JWT signature is NOT
// verified (spec §0). `decodeJwtPayload` is the single boundary where phase 2 adds JWKS verification.
//
// Per-hub helpers live on ctx.helpers (installed by routes(ctx)):
//   requireSession(req) -> {user, session} | null
//   requireCsrf(req, session, formField?) -> boolean   (formField = the submitted `csrf` form value)
//   onSessionEnd(listener) -> unsubscribe fn; listener({userId, tokenHash, reason}) on logout/expiry/ban
//   endSessionsForUser(userId, reason?) -> number      (call after banning a user)
// Pure exports: routes, checkClaims, decodeJwtPayload, sha256hex.

const crypto = require('node:crypto');
const { HttpError, send, sendJson, parseCookies, readBody } = require('./http.js');

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const LOGIN_TTL_MS = 10 * 60 * 1000;
const IAT_SKEW_S = 300;

const sha256hex = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const rand = () => crypto.randomBytes(32).toString('base64url');

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

// Phase 2: verify the RS256 signature against Google's JWKS here (and make this async).
function decodeJwtPayload(jwt) {
  const parts = String(jwt || '').split('.');
  if (parts.length !== 3) throw new Error('malformed jwt');
  const obj = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('malformed jwt');
  return obj;
}

// now is in ms; exp/iat are in seconds.
function checkClaims(claims, { clientId, domains, nonce, now }) {
  const bad = (reason) => ({ ok: false, reason });
  if (!claims || typeof claims !== 'object') return bad('no claims');
  if (!ISSUERS.has(claims.iss)) return bad('iss');
  const aud = Array.isArray(claims.aud) ? (claims.aud.length === 1 ? claims.aud[0] : null) : claims.aud;
  if (!clientId || aud !== clientId) return bad('aud');
  const nowS = Math.floor(now / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= nowS) return bad('exp');
  if (typeof claims.iat !== 'number' || claims.iat > nowS + IAT_SKEW_S) return bad('iat');
  if (typeof nonce !== 'string' || !nonce || claims.nonce !== nonce) return bad('nonce');
  if (claims.email_verified !== true) return bad('email_verified');
  const allowed = (domains || []).map((d) => String(d).toLowerCase());
  if (typeof claims.hd !== 'string' || !allowed.includes(claims.hd.toLowerCase())) return bad('hd');
  if (typeof claims.email !== 'string' || typeof claims.sub !== 'string' || !claims.sub) return bad('email');
  const email = claims.email.toLowerCase();
  const m = /^([^@\s]+)@([^@\s]+)$/.exec(email);
  if (!m || !allowed.includes(m[2])) return bad('email domain');
  const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 100) : m[1];
  return { ok: true, sub: claims.sub, email, name };
}

function routes(ctx) {
  const { config, db, deps, limiters } = ctx;
  const sessName = config.secure ? '__Host-tr_sess' : 'tr_sess';
  const loginName = config.secure ? '__Host-tr_login' : 'tr_login';
  const listeners = new Set();

  const cookie = (name, value, maxAgeS) =>
    `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${config.secure ? '; Secure' : ''}`;
  const noStore = { 'Cache-Control': 'no-store' };

  function notify(info) { for (const l of listeners) { try { l(info); } catch { /* a listener must not break auth */ } } }
  const onSessionEnd = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

  function endSession(tokenHash, userId, reason) {
    db.deleteSession(tokenHash);
    notify({ userId, tokenHash, reason });
  }
  function endSessionsForUser(userId, reason = 'ended') {
    const rows = db.raw.prepare('SELECT token_hash FROM sessions WHERE user_id=?').all(userId);
    db.deleteSessionsForUser(userId);
    for (const r of rows) notify({ userId, tokenHash: r.token_hash, reason });
    return rows.length;
  }

  function requireSession(req) {
    const token = parseCookies(req.headers.cookie)[sessName];
    if (!token) return null;
    const tokenHash = sha256hex(token);
    const session = db.getSession(tokenHash);
    if (!session) return null;
    if (session.expires_at <= deps.now()) { endSession(tokenHash, session.user_id, 'expired'); return null; }
    const user = db.getUserById(session.user_id);
    if (!user) { endSession(tokenHash, session.user_id, 'gone'); return null; }
    if (user.banned_at != null) { endSessionsForUser(user.id, 'banned'); return null; }
    return { user, session };
  }

  function requireCsrf(req, session, formField) {
    if (!session || req.headers.origin !== config.origin) return false;
    const given = req.headers['x-csrf-token'] || formField;
    return safeEqual(given, session.csrf);
  }

  ctx.helpers.requireSession = requireSession;
  ctx.helpers.requireCsrf = requireCsrf;
  ctx.helpers.onSessionEnd = onSessionEnd;
  ctx.helpers.endSessionsForUser = endSessionsForUser;

  // Creates/updates the user, refuses banned ones, starts a session and redirects home.
  function finishLogin(res, who) {
    const now = deps.now();
    const isOwner = config.ownerEmails.includes(who.email);
    let user = db.upsertUser({ googleSub: who.sub, email: who.email, name: who.name, role: isOwner ? 'owner' : 'member', now });
    if (user.banned_at != null) {
      return send(res, 403, 'This account has been blocked.', { 'Content-Type': 'text/plain; charset=utf-8', ...noStore });
    }
    if (isOwner && user.role !== 'owner') { db.setUserRole(user.id, 'owner'); user = db.getUserById(user.id); }
    const token = rand();
    db.createSession({ tokenHash: sha256hex(token), userId: user.id, csrf: rand(), now, expiresAt: now + SESSION_TTL_MS });
    send(res, 302, '', {
      Location: '/', ...noStore,
      'Set-Cookie': [cookie(sessName, token, SESSION_TTL_MS / 1000), cookie(loginName, '', 0)],
    });
  }

  const list = [];

  list.push({
    method: 'GET', path: '/auth/login',
    handler(req, res, rc) {
      if (!limiters.login.take(ctx.helpers.clientIp(req), deps.now())) throw new HttpError(429, 'too many requests');
      const state = rand(), nonce = rand(), verifier = rand();
      db.createLoginState({ state, nonce, verifier, now: deps.now() });
      const q = new URLSearchParams({
        client_id: config.googleClientId,
        redirect_uri: config.origin + '/auth/callback',
        response_type: 'code',
        scope: 'openid email profile',
        state, nonce,
        code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'),
        code_challenge_method: 'S256',
        hd: config.allowedDomains[0],
        prompt: 'select_account',
      });
      send(res, 302, '', {
        Location: `${GOOGLE_AUTH}?${q}`, ...noStore,
        'Set-Cookie': cookie(loginName, sha256hex(state), LOGIN_TTL_MS / 1000),
      });
    },
  });

  list.push({
    method: 'GET', path: '/auth/callback',
    async handler(req, res, rc) {
      const code = rc.query.get('code');
      const state = rc.query.get('state');
      if (!code || !state) throw new HttpError(400, 'bad request');
      // B7: the browser finishing the login must be the one that started it. Checked BEFORE consuming the state.
      const bound = parseCookies(req.headers.cookie)[loginName];
      if (!safeEqual(bound, sha256hex(state))) throw new HttpError(400, 'login not started in this browser');
      const row = db.takeLoginState(state);
      if (!row || deps.now() - row.created_at > LOGIN_TTL_MS) throw new HttpError(400, 'login expired, try again');

      let tokenRes;
      try {
        tokenRes = await deps.fetch(GOOGLE_TOKEN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code, client_id: config.googleClientId, client_secret: config.googleClientSecret,
            redirect_uri: config.origin + '/auth/callback', grant_type: 'authorization_code', code_verifier: row.verifier,
          }).toString(),
          signal: AbortSignal.timeout(10000),
        });
      } catch { throw new HttpError(502, 'could not reach Google'); }
      if (!tokenRes || !tokenRes.ok) throw new HttpError(400, 'sign-in failed');
      let claims;
      try {
        const body = await tokenRes.json();
        claims = decodeJwtPayload(body.id_token);
      } catch { throw new HttpError(400, 'sign-in failed'); }
      const r = checkClaims(claims, { clientId: config.googleClientId, domains: config.allowedDomains, nonce: row.nonce, now: deps.now() });
      if (!r.ok) throw new HttpError(403, 'this account is not allowed to sign in');
      finishLogin(res, r);
    },
  });

  list.push({
    method: 'POST', path: '/auth/logout',
    async handler(req, res) {
      const s = requireSession(req);
      if (!s) throw new HttpError(401, 'not signed in');
      // The /me page posts a plain form (csrf field, redirect back); scripts send X-CSRF-Token and get JSON.
      const isForm = /^application\/x-www-form-urlencoded/i.test(req.headers['content-type'] || '');
      let field = '';
      if (isForm) field = new URLSearchParams((await readBody(req, 4096)).toString('utf8')).get('csrf') || '';
      if (!requireCsrf(req, s.session, field)) throw new HttpError(403, 'forbidden');
      endSession(s.session.token_hash, s.user.id, 'logout');
      const clear = cookie(sessName, '', 0);
      if (isForm) return send(res, 302, '', { Location: '/auth/login', ...noStore, 'Set-Cookie': clear });
      sendJson(res, 200, { ok: true }, { 'Set-Cookie': clear });
    },
  });

  list.push({
    method: 'GET', path: '/api/config',
    handler(req, res) {
      const s = requireSession(req);
      if (!s) throw new HttpError(401, 'not signed in');
      const island = db.getIslandByUser(s.user.id);
      sendJson(res, 200, {
        mode: 'world',
        me: { id: s.user.id, name: s.user.name, email: s.user.email, islandId: island ? island.id : null },
        csrf: s.session.csrf,
      });
    },
  });

  if (config.devLogin) {
    // S20: no Google, but the same claim checks (hd comes from the email's domain).
    list.push({
      method: 'GET', path: '/auth/dev',
      handler(req, res, rc) {
        const email = String(rc.query.get('email') || '').toLowerCase();
        const name = rc.query.get('name') || '';
        const nowS = Math.floor(deps.now() / 1000);
        const nonce = 'dev';
        const claims = {
          iss: 'https://accounts.google.com', aud: config.googleClientId || 'dev', sub: 'dev:' + email,
          email, email_verified: true, hd: email.split('@')[1] || '', name, iat: nowS, exp: nowS + 300, nonce,
        };
        const r = checkClaims(claims, { clientId: claims.aud, domains: config.allowedDomains, nonce, now: deps.now() });
        if (!r.ok) throw new HttpError(403, 'this account is not allowed to sign in');
        finishLogin(res, r);
      },
    });
  }

  return list;
}

module.exports = { routes, checkClaims, decodeJwtPayload, sha256hex };
