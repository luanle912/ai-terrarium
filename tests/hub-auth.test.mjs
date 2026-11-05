import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadConfig } = require('../hub/config.js');
const { createHub } = require('../hub/server.js');
const { checkClaims, decodeJwtPayload, sha256hex } = require('../hub/auth.js');

const NOW = 1_800_000_000_000;
const CID = 'client-id';
const BASE = {
  HUB_PUBLIC_URL: 'https://terrarium.newera.inc', HUB_ALLOWED_DOMAINS: 'newera.inc',
  HUB_OWNER_EMAILS: 'boss@newera.inc', GOOGLE_CLIENT_ID: CID, GOOGLE_CLIENT_SECRET: 'sekret', HUB_DB: ':memory:',
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

test('decodeJwtPayload reads the payload and rejects junk', () => {
  const jwt = (p) => `h.${Buffer.from(JSON.stringify(p)).toString('base64url')}.s`;
  assert.deepEqual(decodeJwtPayload(jwt({ a: 1 })), { a: 1 });
  assert.throws(() => decodeJwtPayload('abc'));
  assert.throws(() => decodeJwtPayload(jwt([1])));
});

// ---- hub harness ----
function setup(env = {}, fetchImpl) {
  const clock = { t: NOW };
  const logs = [];
  const calls = [];
  const fakeFetch = fetchImpl || (async (url, opts) => {
    calls.push({ url, opts });
    const p = fakeFetch.claims();
    return { ok: true, json: async () => ({ id_token: `h.${Buffer.from(JSON.stringify(p)).toString('base64url')}.s` }) };
  });
  const hub = createHub(loadConfig({ ...BASE, ...env }), { now: () => clock.t, log: (l) => logs.push(l), fetch: fakeFetch });
  fakeFetch.claims = () => good();
  return { hub, clock, logs, calls, fakeFetch };
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

async function startLogin(h) {
  const r = await call(h.hub, 'GET', '/auth/login');
  const loc = new URL(r.headers.Location);
  return { r, state: loc.searchParams.get('state'), nonce: loc.searchParams.get('nonce'), loc, cookie: pair(cookiesOf(r)[0]) };
}
async function signIn(h, claims = {}) {
  const l = await startLogin(h);
  h.fakeFetch.claims = () => good({ nonce: l.nonce, ...claims });
  const cb = await call(h.hub, 'GET', `/auth/callback?code=c&state=${l.state}`, { cookie: l.cookie });
  return { l, cb, cookie: cb.status === 302 ? pair(cookiesOf(cb)[0]) : null };
}

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
  assert.equal(h.calls.length, 0);
  // the failed attempts did not burn the real state
  h.fakeFetch.claims = () => good({ nonce: l.nonce });
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
  const body = String(h.calls[0].opts.body);
  assert.equal(h.calls[0].url, 'https://oauth2.googleapis.com/token');
  assert.match(body, /client_secret=sekret/); assert.match(body, /code_verifier=/);
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

test('owner email gets owner role, others member', async () => {
  const h = setup();
  await signIn(h, { sub: 'o', email: 'Boss@newera.inc' });
  await signIn(h, { sub: 'm', email: 'x@newera.inc' });
  assert.equal(h.hub.db.getUserBySub('o').role, 'owner');
  assert.equal(h.hub.db.getUserBySub('m').role, 'member');
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
  assert.deepEqual(j.me, { id: 1, name: 'Ann', email: 'a@newera.inc', islandId: null });
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
