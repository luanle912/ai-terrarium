import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadConfig } = require('../hub/config.js');
const { createHub } = require('../hub/server.js');
const { checkClaims, sha256hex } = require('../hub/auth.js');
const { open } = require('../hub/secret.js');
import { makeGoogle } from './hub-helpers.mjs';

const NOW = 1_800_000_000_000;
const CID = 'test-client'; // the audience makeGoogle() puts in its default claims
const BASE = {
  HUB_PUBLIC_URL: 'https://terrarium.newera.inc', HUB_ALLOWED_DOMAINS: 'newera.inc',
  HUB_OWNER_EMAILS: 'boss@newera.inc', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'sekret', HUB_DB: ':memory:',
  HUB_SECRET_KEY: crypto.randomBytes(32).toString('base64'),
};
const good = (over = {}) => ({
  iss: 'https://accounts.google.com', aud: CID, sub: 's1', email: 'a@newera.inc', email_verified: true, hd: 'newera.inc',
  name: 'Ann', iat: NOW / 1000 - 10, exp: NOW / 1000 + 3600, nonce: 'n1', ...over,
});
const chk = (over) => checkClaims(good(over), { clientId: CID, domains: ['newera.inc'], nonce: 'n1', now: NOW });

test('checkClaims accepts good claims and lowercases the email', () => {
  const r = chk({ email: 'A@NEWERA.INC' });
  assert.deepEqual(r, { ok: true, sub: 's1', email: 'a@newera.inc', name: 'Ann' });
});

test('checkClaims requireNonce:false skips only the nonce check', () => {
  const o = { clientId: CID, domains: ['newera.inc'], nonce: null, now: NOW, requireNonce: false };
  assert.equal(checkClaims(good({ nonce: undefined }), o).ok, true);
  assert.equal(checkClaims(good({ nonce: undefined, hd: 'gmail.com' }), o).ok, false);
  assert.equal(checkClaims(good({ nonce: undefined }), { ...o, requireNonce: true }).ok, false);
});

test('checkClaims rejects each bad case', () => {
  const cases = {
    aud: { aud: 'other' }, iss: { iss: 'https://evil.com' }, exp: { exp: NOW / 1000 - 1 },
    iat: { iat: NOW / 1000 + 301 }, nonce: { nonce: 'zz' }, verified: { email_verified: false },
    nohd: { hd: undefined }, gmail: { hd: 'gmail.com', email: 'a@gmail.com' },
    suffix: { email: 'a@newera.inc.evil.com' }, sub: { email: 'a@sub.newera.inc' },
    verifiedStr: { email_verified: 'true' }, nosub: { sub: undefined }, twoAt: { email: 'a@b@newera.inc' },
  };
  for (const [k, over] of Object.entries(cases)) assert.equal(chk(over).ok, false, k);
  assert.equal(chk({ iat: NOW / 1000 + 299 }).ok, true);
  assert.equal(chk({ iss: 'accounts.google.com' }).ok, true);
});

// ---- hub harness ----
function setup(env = {}, fetchImpl) {
  const clock = { t: NOW };
  const logs = [];
  const google = makeGoogle({ now: () => clock.t });
  const hub = createHub(loadConfig({ ...BASE, ...env }), { now: () => clock.t, log: (l) => logs.push(l), fetch: fetchImpl || google.fetch });
  return { hub, clock, logs, google };
}
const call = (hub, method, url, headers = {}) => new Promise((resolve, reject) => {
  const r = { method, url, headers, socket: { remoteAddress: '1.2.3.4' } };
  const req = Object.assign(new (require('node:stream').Readable)({ read() { this.push(null); } }), r);
  const chunks = [];
  const res = new (require('node:stream').Writable)({ write(c, e, cb) { chunks.push(c); cb(); } });
  res.headersSent = false;
  res.writeHead = (s, h) => { res.statusCode = s; res.hdrs = h; res.headersSent = true; };
  const done = res.end.bind(res);
  res.end = (b) => { if (b) chunks.push(Buffer.from(b)); done(); };
  res.on('finish', () => resolve({ status: res.statusCode, headers: res.hdrs, text: Buffer.concat(chunks).toString() }));
  res.on('error', reject);
  hub.server.emit('request', req, res);
});
const cookiesOf = (r) => [].concat(r.headers['Set-Cookie'] || []);
const pair = (c) => c.split(';')[0];

async function startLogin(h, p = '/auth/login') {
  const r = await call(h.hub, 'GET', p);
  const loc = new URL(r.headers.Location);
  return { r, state: loc.searchParams.get('state'), nonce: loc.searchParams.get('nonce'), loc, cookie: pair(cookiesOf(r)[0]) };
}
// opts.cookie = an existing session cookie sent along (as a browser that is already signed in would).
async function signIn(h, claims = {}, opts = {}) {
  const l = await startLogin(h, opts.path);
  h.google.claims = good({ nonce: l.nonce, ...claims });
  const jar = [opts.cookie, l.cookie].filter(Boolean).join('; ');
  const cb = await call(h.hub, 'GET', `/auth/callback?code=c&state=${l.state}`, { cookie: jar });
  const sess = cookiesOf(cb).map(pair).find((c) => c.startsWith('__Host-tr_sess=') && !c.endsWith('='));
  return { l, cb, cookie: sess || null };
}
const noRefresh = (h) => { h.google.onToken = (params) => ({ status: 200, body: { id_token: h.google.sign({ sub: 's1', email: 'a@newera.inc', iat: NOW / 1000 - 10, exp: NOW / 1000 + 3600, ...h.google.claims }) } }); };
const sessionRow = (h, cookie) => h.hub.db.getSession(sha256hex(cookie.split('=')[1]));

test('login sets state cookie and redirects to google with hd and pkce', async () => {
  const h = setup();
  const { r, loc, state } = await startLogin(h);
  assert.equal(r.status, 302);
  assert.equal(loc.origin + loc.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  const s = loc.search;
  assert.match(s, /code_challenge_method=S256/);
  assert.match(s, /hd=newera\.inc/);
  assert.match(s, /prompt=select_account/);
  assert.doesNotMatch(r.headers.Location, /client_secret|sekret/);
  const c = cookiesOf(r)[0];
  assert.match(c, /^__Host-tr_login=/);
  assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Lax/); assert.match(c, /Secure/); assert.match(c, /Path=\//);
  assert.ok(c.includes(sha256hex(state)));
  assert.equal(r.headers['X-Content-Type-Options'], 'nosniff');
  await h.hub.close();
});

test('callback rejects a state that is not bound to this browser', async () => {
  const h = setup();
  const l = await startLogin(h);
  const noCookie = await call(h.hub, 'GET', `/auth/callback?code=c&state=${l.state}`);
  assert.equal(noCookie.status, 400);
  const other = await call(h.hub, 'GET', `/auth/callback?code=c&state=${l.state}`, { cookie: '__Host-tr_login=' + sha256hex('x') });
  assert.equal(other.status, 400);
  assert.equal(h.google.calls.length, 0);
  // the failed attempts did not burn the real state
  h.google.claims = good({ nonce: l.nonce });
  const ok = await call(h.hub, 'GET', `/auth/callback?code=c&state=${l.state}`, { cookie: l.cookie });
  assert.equal(ok.status, 302);
  await h.hub.close();
});

test('callback with a valid code creates a session', async () => {
  const h = setup();
  const { cb, l } = await signIn(h);
  assert.equal(cb.status, 302);
  assert.equal(cb.headers.Location, '/');
  const cs = cookiesOf(cb);
  const sess = cs.find((c) => c.startsWith('__Host-tr_sess='));
  assert.match(sess, /HttpOnly/); assert.match(sess, /SameSite=Lax/); assert.match(sess, /Secure/);
  assert.ok(cs.find((c) => c.startsWith('__Host-tr_login=;') && /Max-Age=0/.test(c)), 'login cookie cleared');
  assert.equal(h.hub.db.getUserBySub('s1').email, 'a@newera.inc');
  // token exchange carried the secret and verifier to Google only
  const { url, params } = h.google.calls[0];
  assert.equal(url, 'https://oauth2.googleapis.com/token');
  assert.equal(params.client_secret, 'sekret'); assert.ok(params.code_verifier);
  // DB stores only the hash of the token
  const tok = pair(sess).split('=')[1];
  assert.ok(h.hub.db.getSession(sha256hex(tok)));
  assert.equal(h.hub.db.getSession(tok), undefined);
  assert.ok(!h.logs.join('\n').includes(tok) && !h.logs.join('\n').includes(l.state));
  await h.hub.close();
});

test('state is single use', async () => {
  const h = setup();
  const { l } = await signIn(h);
  const again = await call(h.hub, 'GET', `/auth/callback?code=c&state=${l.state}`, { cookie: l.cookie });
  assert.equal(again.status, 400);
  await h.hub.close();
});

test('login state expires after 10 minutes', async () => {
  const h = setup();
  const l = await startLogin(h);
  h.clock.t += 10 * 60 * 1000 + 1;
  const r = await call(h.hub, 'GET', `/auth/callback?code=c&state=${l.state}`, { cookie: l.cookie });
  assert.equal(r.status, 400);
  await h.hub.close();
});

test('callback refuses wrong domain, wrong nonce, failed exchange', async () => {
  let h = setup();
  assert.equal((await signIn(h, { hd: 'gmail.com', email: 'a@gmail.com' })).cb.status, 403);
  assert.equal((await signIn(h, { nonce: 'bad' })).cb.status, 403);
  assert.equal(h.hub.db.getUserBySub('s1'), undefined);
  await h.hub.close();
  h = setup({}, async () => ({ ok: false, json: async () => ({}) }));
  const l = await startLogin(h);
  assert.equal((await call(h.hub, 'GET', `/auth/callback?code=c&state=${l.state}`, { cookie: l.cookie })).status, 400);
  await h.hub.close();
});

test('callback refuses a token with a bad signature', async () => {
  const h = setup();
  const l = await startLogin(h);
  const claims = good({ nonce: l.nonce });
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  h.google.onToken = () => ({ status: 200, body: { id_token: h.google.sign(claims, { key: other.privateKey }) } });
  const cb = await call(h.hub, 'GET', `/auth/callback?code=c&state=${l.state}`, { cookie: l.cookie });
  assert.equal(cb.status, 403);
  assert.ok(!cookiesOf(cb).some((c) => c.startsWith('__Host-tr_sess=')), 'no session cookie');
  assert.equal(h.hub.db.getUserBySub('s1'), undefined);
  assert.equal(h.hub.db.raw.prepare('SELECT count(*) c FROM sessions').get().c, 0);
  const logged = h.logs.filter((x) => /jwt: bad signature/.test(x));
  assert.equal(logged.length, 1);
  assert.ok(!logged[0].includes(claims.nonce) && !logged[0].includes('eyJ'), 'the token is not logged');
  // and a token with no signature at all
  const l2 = await startLogin(h);
  h.google.onToken = () => ({ status: 200, body: { id_token: h.google.sign(good({ nonce: l2.nonce })).split('.').slice(0, 2).join('.') + '.' } });
  assert.equal((await call(h.hub, 'GET', `/auth/callback?code=c&state=${l2.state}`, { cookie: l2.cookie })).status, 403);
  await h.hub.close();
});

test('banned user gets no session', async () => {
  const h = setup();
  await signIn(h);
  h.hub.db.setUserBanned(h.hub.db.getUserBySub('s1').id, NOW);
  const { cb } = await signIn(h);
  assert.equal(cb.status, 403);
  assert.equal(h.hub.db.raw.prepare('SELECT count(*) c FROM sessions').get().c, 1);
  await h.hub.close();
});

test('api config needs a session and returns csrf', async () => {
  const h = setup();
  assert.equal((await call(h.hub, 'GET', '/api/config')).status, 401);
  const { cookie } = await signIn(h);
  const r = await call(h.hub, 'GET', '/api/config', { cookie });
  assert.equal(r.status, 200);
  const j = JSON.parse(r.text);
  assert.equal(j.mode, 'world');
  assert.deepEqual(j.me, { id: 1, name: 'Ann', email: 'a@newera.inc', islandId: null, role: 'member' });
  assert.ok(j.csrf.length >= 40);
  h.hub.db.upsertIsland({ id: 'isl1', userId: 1, name: 'x', color: '#fff', now: NOW });
  assert.equal(JSON.parse((await call(h.hub, 'GET', '/api/config', { cookie })).text).me.islandId, 'isl1');
  await h.hub.close();
});

test('session expires after 7 days and listeners hear about it', async () => {
  const h = setup();
  const ended = [];
  h.hub.ctx.helpers.onSessionEnd((e) => ended.push(e.reason));
  const { cookie } = await signIn(h);
  h.clock.t += 7 * 24 * 3600 * 1000 - 1;
  assert.equal((await call(h.hub, 'GET', '/api/config', { cookie })).status, 200);
  h.clock.t += 2;
  assert.equal((await call(h.hub, 'GET', '/api/config', { cookie })).status, 401);
  assert.deepEqual(ended, ['expired']);
  await h.hub.close();
});

test('banning a user ends the session', async () => {
  const h = setup();
  const ended = [];
  h.hub.ctx.helpers.onSessionEnd((e) => ended.push(e.reason));
  const { cookie } = await signIn(h);
  h.hub.db.setUserBanned(1, NOW);
  assert.equal((await call(h.hub, 'GET', '/api/config', { cookie })).status, 401);
  assert.deepEqual(ended, ['banned']);
  await h.hub.close();
});

test('logout needs csrf and matching origin', async () => {
  const h = setup();
  const { cookie } = await signIn(h);
  const csrf = JSON.parse((await call(h.hub, 'GET', '/api/config', { cookie })).text).csrf;
  const origin = 'https://terrarium.newera.inc';
  assert.equal((await call(h.hub, 'POST', '/auth/logout', { cookie })).status, 403);
  assert.equal((await call(h.hub, 'POST', '/auth/logout', { cookie, origin })).status, 403);
  assert.equal((await call(h.hub, 'POST', '/auth/logout', { cookie, origin: 'https://evil.com', 'x-csrf-token': csrf })).status, 403);
  assert.equal((await call(h.hub, 'POST', '/auth/logout', { cookie, 'x-csrf-token': csrf })).status, 403);
  assert.equal((await call(h.hub, 'POST', '/auth/logout', { cookie, origin, 'x-csrf-token': 'wrong' })).status, 403);
  assert.equal((await call(h.hub, 'POST', '/auth/logout', { origin, 'x-csrf-token': csrf })).status, 401);
  const ended = [];
  h.hub.ctx.helpers.onSessionEnd((e) => ended.push(e.reason));
  const ok = await call(h.hub, 'POST', '/auth/logout', { cookie, origin, 'x-csrf-token': csrf });
  assert.equal(ok.status, 200);
  assert.match(cookiesOf(ok)[0], /Max-Age=0/);
  assert.deepEqual(ended, ['logout']);
  assert.equal((await call(h.hub, 'GET', '/api/config', { cookie })).status, 401);
  await h.hub.close();
});

test('requireCsrf accepts the form field and rejects others', async () => {
  const h = setup();
  const { cookie } = await signIn(h);
  const { requireSession, requireCsrf } = h.hub.ctx.helpers;
  const s = requireSession({ headers: { cookie } });
  const origin = 'https://terrarium.newera.inc';
  assert.equal(requireCsrf({ headers: { origin } }, s.session, s.session.csrf), true);
  assert.equal(requireCsrf({ headers: { origin } }, s.session, 'nope'), false);
  assert.equal(requireCsrf({ headers: { origin } }, s.session), false);
  assert.equal(requireSession({ headers: {} }), null);
  await h.hub.close();
});

test('login is limited to 30 per hour per ip', async () => {
  const h = setup();
  for (let i = 0; i < 30; i++) assert.equal((await call(h.hub, 'GET', '/auth/login')).status, 302);
  assert.equal((await call(h.hub, 'GET', '/auth/login')).status, 429);
  await h.hub.close();
});

test('dev login: off by default, on for localhost, still domain checked, no Secure', async () => {
  let h = setup();
  assert.equal((await call(h.hub, 'GET', '/auth/dev?email=a@newera.inc')).status, 404);
  await h.hub.close();
  const dev = { HUB_DEV_LOGIN: '1', HUB_PUBLIC_URL: 'http://localhost:4318', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' };
  h = setup(dev);
  const ok = await call(h.hub, 'GET', '/auth/dev?email=Dev@newera.inc&name=Dev');
  assert.equal(ok.status, 302);
  const c = cookiesOf(ok)[0];
  assert.match(c, /^tr_sess=/); assert.doesNotMatch(c, /Secure/); assert.match(c, /HttpOnly/);
  const me = JSON.parse((await call(h.hub, 'GET', '/api/config', { cookie: pair(c) })).text);
  assert.equal(me.me.email, 'dev@newera.inc');
  for (const e of ['a@gmail.com', 'a@sub.newera.inc', 'a@newera.inc.evil.com', '']) {
    assert.equal((await call(h.hub, 'GET', '/auth/dev?email=' + e)).status, 403, e);
  }
  await h.hub.close();
});

test('google token fetch carries a timeout signal and an abort is a clean login failure', async () => {
  let seen;
  const h = setup({}, async (url, opts) => { seen = opts; throw Object.assign(new Error('aborted'), { name: 'TimeoutError' }); });
  const l = await startLogin(h);
  const cb = await call(h.hub, 'GET', `/auth/callback?code=c&state=${l.state}`, { cookie: l.cookie });
  assert.ok(seen.signal && typeof seen.signal.aborted === 'boolean', 'AbortSignal passed to fetch');
  assert.equal(cb.status, 502);
  assert.ok(!cookiesOf(cb).some((c) => c.startsWith('__Host-tr_sess=') && !/Max-Age=0/.test(c)), 'no session created');
  // the hub is still alive afterwards
  assert.equal((await call(h.hub, 'GET', '/auth/login')).status, 302);
  await h.hub.close();
});

// ---- refresh token, session length, role ----
test('login asks for offline access', async () => {
  const h = setup();
  const { loc } = await startLogin(h);
  assert.equal(loc.searchParams.get('access_type'), 'offline');
  assert.equal(loc.searchParams.get('prompt'), 'select_account');
  assert.match(loc.href, /access_type=offline/);
  await h.hub.close();
});

test('callback stores the refresh token encrypted', async () => {
  const h = setup();
  const { cb } = await signIn(h);
  assert.equal(cb.status, 302);
  const u = h.hub.db.getUserBySub('s1');
  assert.ok(u.refresh_enc);
  assert.ok(!u.refresh_enc.includes('rt-1'));
  assert.equal(open(h.hub.ctx.config.secretKey, u.refresh_enc, 'user:' + u.id), 'rt-1');
  assert.throws(() => open(h.hub.ctx.config.secretKey, u.refresh_enc, 'user:' + (u.id + 1)));
  // never in the request log
  assert.ok(!h.logs.some((l) => l.includes('rt-1') || l.includes(u.refresh_enc) || l.includes(h.hub.ctx.config.secretKey.toString('base64'))));
  await h.hub.close();
});

test('no refresh token: one consent retry, then a 24 h session', async () => {
  const h = setup();
  noRefresh(h);
  const first = await signIn(h);
  assert.equal(first.cb.status, 302);
  assert.equal(first.cb.headers.Location, '/auth/login?consent=1');
  assert.equal(first.cookie, null);
  assert.equal(h.hub.db.raw.prepare('SELECT COUNT(*) n FROM sessions').get().n, 0);
  const retry = await startLogin(h, '/auth/login?consent=1');
  assert.equal(retry.loc.searchParams.get('prompt'), 'consent');
  assert.equal(retry.loc.searchParams.get('access_type'), 'offline');
  const second = await signIn(h, {}, { path: '/auth/login?consent=1' });
  assert.equal(second.cb.status, 302);
  assert.equal(second.cb.headers.Location, '/');
  const row = sessionRow(h, second.cookie);
  assert.equal(row.expires_at - row.created_at, 86400000);
  assert.equal(h.hub.db.getUserBySub('s1').refresh_enc, null);
  await h.hub.close();
});

test('a session with a refresh token lasts 7 days', async () => {
  const h = setup();
  const { cookie } = await signIn(h);
  const row = sessionRow(h, cookie);
  assert.equal(row.expires_at - row.created_at, 7 * 86400000);
  assert.equal(h.hub.db.getUserBySub('s1').checked_at, NOW);
  await h.hub.close();
});

test('a returning user without a new refresh token keeps the stored one and gets 7 days', async () => {
  const h = setup();
  await signIn(h);
  noRefresh(h);
  const { cb, cookie } = await signIn(h);
  assert.equal(cb.headers.Location, '/');
  const row = sessionRow(h, cookie);
  assert.equal(row.expires_at - row.created_at, 7 * 86400000);
  await h.hub.close();
});

test('logging in again ends the previous session of this browser', async () => {
  const h = setup();
  const ended = [];
  h.hub.ctx.helpers.onSessionEnd((e) => ended.push(e));
  const a = await signIn(h);
  const b = await signIn(h, {}, { cookie: a.cookie });
  assert.notEqual(a.cookie, b.cookie);
  assert.equal(sessionRow(h, a.cookie), undefined);
  assert.ok(sessionRow(h, b.cookie));
  assert.deepEqual(ended.map((e) => e.reason), ['relogin']);
  assert.equal(ended[0].tokenHash, sha256hex(a.cookie.split('=')[1]));
  await h.hub.close();
});

test('a google_revoked ban is lifted by a fresh login', async () => {
  const h = setup();
  await signIn(h);
  const u = h.hub.db.getUserBySub('s1');
  h.hub.db.banUser(u.id, 'google_revoked', NOW);
  const { cb, cookie } = await signIn(h);
  assert.equal(cb.status, 302);
  assert.ok(cookie);
  const after = h.hub.db.getUserBySub('s1');
  assert.equal(after.banned_at, null);
  assert.equal(after.ban_reason, null);
  assert.ok(h.hub.db.listAudit().some((a) => a.action === 'ban_lifted' && a.target === String(u.id)));
  await h.hub.close();
});

test('a ban without reason stays', async () => {
  const h = setup();
  await signIn(h);
  const u = h.hub.db.getUserBySub('s1');
  h.hub.db.banUser(u.id, null, NOW);
  const { cb } = await signIn(h);
  assert.equal(cb.status, 403);
  assert.notEqual(h.hub.db.getUserBySub('s1').banned_at, null);
  assert.ok(!h.hub.db.listAudit().some((a) => a.action === 'ban_lifted'));
  await h.hub.close();
});

test('a refused login for a banned user revokes the refresh token Google just granted', async () => {
  const h = setup();
  await signIn(h);
  const u = h.hub.db.getUserBySub('s1');
  h.hub.db.banUser(u.id, 'abuse', NOW);
  h.hub.db.setRefreshToken(u.id, null);
  h.google.calls.length = 0;
  const { cb, cookie } = await signIn(h);
  assert.equal(cb.status, 403);
  assert.equal(cookie, null);
  const revokes = h.google.calls.filter((c) => c.url === 'https://oauth2.googleapis.com/revoke');
  assert.equal(revokes.length, 1);
  assert.match(revokes[0].params.token, /^rt-/);
  assert.equal(h.hub.db.getUserBySub('s1').refresh_enc, null, 'nothing stored for a banned user');
  // the revoke endpoint being down must not change the answer
  h.hub.ctx.deps.fetch = async (url, o) => { if (String(url).endsWith('/revoke')) throw new Error('offline'); return h.google.fetch(url, o); };
  assert.equal((await signIn(h)).cb.status, 403);
  await h.hub.close();
});

test('api config role follows env', async () => {
  const h = setup();
  const boss = await signIn(h, { sub: 'b', email: 'boss@newera.inc' });
  const ann = await signIn(h, { sub: 'a', email: 'ann@newera.inc' });
  const role = async (c) => JSON.parse((await call(h.hub, 'GET', '/api/config', { cookie: c })).text).me.role;
  assert.equal(await role(boss.cookie), 'owner');
  assert.equal(await role(ann.cookie), 'member');
  h.hub.ctx.config.ownerEmails = ['ann@newera.inc'];
  assert.equal(await role(boss.cookie), 'member');
  assert.equal(await role(ann.cookie), 'owner');
  assert.equal(h.hub.ctx.helpers.isOwner({ email: 'ANN@newera.inc' }), true);
  assert.equal(h.hub.ctx.helpers.isOwner({ email: null }), false);
  await h.hub.close();
});
