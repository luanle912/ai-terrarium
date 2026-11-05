import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDevHub, pairDevice, postJson, makeGoogle, googleLogin } from './hub-helpers.mjs';

const HOUR = 3600 * 1000;
const sid = (n) => n.toString(16).padStart(12, '0');
const pkt = (seq = 1) => ({ v: 1, seq, sessions: [{ id: sid(1), parent: null, status: 'working', waitingOn: null, talkingTo: null, dept: 'A', kind: 'edit' }] });
const bearer = (t) => ({ authorization: 'Bearer ' + t });

// Minimal SSE reader: collects events and reports when the server ends the stream.
async function openStream(url, cookie) {
  const ac = new AbortController();
  const r = await fetch(url + '/api/world/stream', { headers: { cookie }, signal: ac.signal });
  const events = [];
  let ended = false;
  const dec = new TextDecoder();
  const reader = r.body.getReader();
  (async () => {
    let buf = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /^event: (.+)$/m.exec(block); const data = /^data: (.+)$/m.exec(block);
          if (ev && data) events.push({ event: ev[1], data: JSON.parse(data[1]) });
        }
      }
    } catch { /* aborted */ }
    ended = true;
  })();
  const until = async (pred, ms = 3000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const f = events.find(pred); if (f) return f; await new Promise((res) => setTimeout(res, 25)); }
    return null;
  };
  const waitEnd = async (ms = 3000) => { const t0 = Date.now(); while (!ended && Date.now() - t0 < ms) await new Promise((res) => setTimeout(res, 25)); return ended; };
  return { events, until, waitEnd, close: () => ac.abort() };
}

// A hub wired to the fake Google, one signed-in user with a refresh token, a paired machine and a live island.
async function setup(email = 'an@newera.inc') {
  let h;
  const google = makeGoogle({ now: () => h.clock.t });
  h = await startDevHub({ google });
  const login = await googleLogin(h.url, google, email);
  const dev = await pairDevice(h.url, login, 'Laptop');
  assert.equal((await postJson(h.url, '/api/publish', pkt(), bearer(dev.token))).status, 204);
  const user = h.hub.db.getUserBySub('g:' + email);
  return { h, google, login, dev, user, db: h.hub.db, check: h.hub.ctx.googleCheck };
}
const idToken = (h, google, user, over = {}) => {
  const nowS = Math.floor(h.clock.t / 1000);
  return google.sign({ iss: 'https://accounts.google.com', aud: 'test-client', sub: user.google_sub, email: user.email, email_verified: true, hd: 'newera.inc', iat: nowS, exp: nowS + 3600, ...over });
};
const revokeCalls = (g) => g.calls.filter((c) => c.url.endsWith('/revoke'));
const tokenCalls = (g) => g.calls.filter((c) => c.params.grant_type === 'refresh_token');

test('invalid_grant bans with google_revoked', async () => {
  const { h, google, login, dev, user, db, check } = await setup();
  const viewer = await googleLogin(h.url, google, 'bo@newera.inc');
  const own = await openStream(h.url, login.cookie);
  const other = await openStream(h.url, viewer.cookie);
  try {
    assert.ok(await own.until((e) => e.event === 'world'));
    assert.ok(await other.until((e) => e.event === 'island'));
    assert.ok(db.getUserById(user.id).refresh_enc);
    google.calls.length = 0;
    google.onToken = () => ({ status: 400, body: { error: 'invalid_grant' } });
    h.clock.advance(25 * HOUR);
    const r = await check.runOnce();
    assert.equal(r.banned, 2); // bo has a refresh token and a session too, and gets the same answer
    const u = db.getUserById(user.id);
    assert.notEqual(u.banned_at, null);
    assert.equal(u.ban_reason, 'google_revoked');
    assert.equal(db.sessionTokensForUser(user.id).length, 0);
    assert.equal(await own.waitEnd(), true);
    assert.ok(await other.until((e) => e.event === 'remove' && e.data.id === dev.island_id));
    assert.equal((await postJson(h.url, '/api/publish', pkt(2), bearer(dev.token))).status, 401);
    assert.equal(u.refresh_enc, null);
    assert.ok(revokeCalls(google).length >= 1);
    assert.ok(db.listAudit().some((a) => a.action === 'user_banned' && a.target === `user:${user.id} google_revoked`));
    assert.ok(db.getIslandByUser(user.id), 'the islands row is kept');
  } finally { own.close(); other.close(); await h.close(); }
});

test('network error and 5xx do not ban; 72 h of errors writes one warning', async () => {
  const { h, google, user, db, check } = await setup();
  try {
    let mode = 'throw';
    google.onToken = () => { if (mode === 'throw') throw new Error('offline'); return { status: 503, body: {} }; };
    const warnings = () => db.listAudit().filter((a) => a.action === 'google_check_failing');
    h.clock.advance(25 * HOUR);
    for (let i = 0; i < 73; i++) {
      mode = i % 2 ? '503' : 'throw';
      const r = await check.runOnce();
      assert.equal(r.failed, 1);
      assert.equal(r.banned, 0);
      if (i === 70) assert.equal(warnings().length, 0, 'not yet 72 h');
      h.clock.advance(HOUR);
    }
    assert.equal(db.getUserById(user.id).banned_at, null);
    assert.equal(warnings().length, 1);
    assert.equal(warnings()[0].target, 'user:' + user.id);
    await check.runOnce();
    assert.equal(warnings().length, 1, 'only once');
    assert.notEqual(db.getUserById(user.id).check_fail_since, null);
    google.onToken = () => ({ status: 200, body: { access_token: 'at' } });
    assert.equal((await check.runOnce()).checked, 1);
    const u = db.getUserById(user.id);
    assert.equal(u.check_fail_since, null);
    assert.equal(u.check_warned_at, null);
  } finally { await h.close(); }
});

test('a refreshed id token from another domain bans', async () => {
  const { h, google, user, db, check } = await setup();
  try {
    google.onToken = () => {
      const nowS = Math.floor(h.clock.t / 1000);
      const claims = { iss: 'https://accounts.google.com', aud: 'test-client', sub: user.google_sub, email: 'an@gmail.com', email_verified: true, hd: 'gmail.com', iat: nowS, exp: nowS + 3600 };
      return { status: 200, body: { id_token: google.sign(claims) } };
    };
    h.clock.advance(25 * HOUR);
    assert.deepEqual(await check.runOnce(), { checked: 0, banned: 1, failed: 0 });
    assert.equal(db.getUserById(user.id).ban_reason, 'google_revoked');
  } finally { await h.close(); }
});

test('a refreshed id token for another google account bans, a good one passes', async () => {
  const { h, google, user, db, check } = await setup();
  try {
    const answer = (sub) => () => {
      const nowS = Math.floor(h.clock.t / 1000);
      return { status: 200, body: { id_token: google.sign({ iss: 'https://accounts.google.com', aud: 'test-client', sub, email: user.email, email_verified: true, hd: 'newera.inc', iat: nowS, exp: nowS + 3600 }) } };
    };
    h.clock.advance(25 * HOUR);
    google.onToken = answer(user.google_sub);
    assert.deepEqual(await check.runOnce(), { checked: 1, banned: 0, failed: 0 });
    h.clock.advance(25 * HOUR);
    google.onToken = answer('someone-else');
    assert.deepEqual(await check.runOnce(), { checked: 0, banned: 1, failed: 0 });
  } finally { await h.close(); }
});

test('a failing JWKS fetch with a rotated key is a failed check, never a ban (real createJwks)', async () => {
  const { h, google, user, db, check } = await setup(); // the login primed the JWKS cache
  try {
    google.rotate(); // Google now signs with a kid the hub has not cached
    google.certsDown = true;
    google.onToken = () => ({ status: 200, body: { id_token: idToken(h, google, user) } });
    h.clock.advance(25 * HOUR);
    assert.deepEqual(await check.runOnce(), { checked: 0, banned: 0, failed: 1 });
    assert.equal(db.getUserById(user.id).banned_at, null);
    // once the endpoint is back (and the 1/min throttle has passed) the same token verifies
    google.certsDown = false;
    h.clock.advance(HOUR);
    assert.deepEqual(await check.runOnce(), { checked: 1, banned: 0, failed: 0 });
  } finally { await h.close(); }
});

test('claim failures that are not about the account (iat, aud, exp) are failed checks', async () => {
  const { h, google, user, db, check } = await setup();
  try {
    h.clock.advance(25 * HOUR);
    for (const over of [{ iat: Math.floor(h.clock.t / 1000) + 3600 }, { aud: 'other-client' }, { iss: 'https://evil.example' }]) {
      google.onToken = () => ({ status: 200, body: { id_token: idToken(h, google, user, over) } });
      assert.deepEqual(await check.runOnce(), { checked: 0, banned: 0, failed: 1 }, JSON.stringify(over));
    }
    assert.equal(db.getUserById(user.id).banned_at, null);
    // ...while an account-level failure bans
    google.onToken = () => ({ status: 200, body: { id_token: idToken(h, google, user, { email_verified: false }) } });
    assert.equal((await check.runOnce()).banned, 1);
  } finally { await h.close(); }
});

test('only invalid_grant bans: invalid_client, 429 and unparseable 200 are failed checks', async () => {
  const { h, google, user, db, check } = await setup();
  try {
    h.clock.advance(25 * HOUR);
    const answers = [
      { status: 400, body: { error: 'invalid_client' } }, { status: 401, body: { error: 'invalid_client' } },
      { status: 429, body: {} }, { status: 403, body: { error: 'invalid_grant' } },
      { status: 200, raw: 'not json at all' }, { status: 200, raw: '"a string"' }, { status: 200, raw: 'null' },
    ];
    for (const a of answers) {
      google.onToken = () => a;
      assert.deepEqual(await check.runOnce(), { checked: 0, banned: 0, failed: 1 }, JSON.stringify(a));
    }
    assert.equal(db.getUserById(user.id).banned_at, null);
    assert.equal(db.getUserById(user.id).checked_at < h.clock.t - 24 * HOUR, true, 'a failed check does not count as checked');
  } finally { await h.close(); }
});

test('one user whose check throws does not stop the next one', async () => {
  const { h, google, user, db, check } = await setup();
  try {
    const bo = await googleLogin(h.url, google, 'bo@newera.inc');
    assert.ok(bo.cookie);
    const boId = db.getUserBySub('g:bo@newera.inc').id;
    h.clock.advance(25 * HOUR);
    const real = db.markChecked;
    db.markChecked = (id, now) => { if (id === user.id) throw new Error('db hiccup'); return real(id, now); };
    const r = await check.runOnce();
    db.markChecked = real;
    assert.deepEqual(r, { checked: 1, banned: 0, failed: 0 });
    assert.equal(db.getUserById(boId).checked_at, h.clock.t);
    assert.ok(h.logs.includes('google check failed for one user'));
  } finally { await h.close(); }
});

test('concurrent runOnce calls make one token call per user', async () => {
  const { h, google, db, check } = await setup();
  try {
    await googleLogin(h.url, google, 'bo@newera.inc');
    h.clock.advance(25 * HOUR);
    google.calls.length = 0;
    const [a, b] = await Promise.all([check.runOnce(), check.runOnce()]);
    assert.deepEqual(a, b);
    assert.equal(a.checked, 2);
    assert.equal(tokenCalls(google).length, 2);
    void db;
  } finally { await h.close(); }
});

test('close() stops a run in progress', async () => {
  const { h, google, db, check } = await setup();
  await googleLogin(h.url, google, 'bo@newera.inc');
  h.clock.advance(25 * HOUR);
  let release;
  const gate = new Promise((res) => { release = res; });
  const inner = google.onToken;
  google.onToken = (p) => inner(p);
  const realFetch = h.hub.ctx.deps.fetch;
  h.hub.ctx.deps.fetch = async (...a) => { await gate; return realFetch(...a); };
  const run = check.runOnce();
  const closing = h.close();
  release();
  const r = await run;
  await closing;
  assert.ok(r.checked <= 1, 'the second user is not touched after close');
  void db;
});

test('success updates checked_at and fresh users are skipped', async () => {
  const { h, google, user, db, check } = await setup();
  try {
    assert.equal((await check.runOnce()).checked, 0); // logged in just now
    google.calls.length = 0;
    h.clock.advance(25 * HOUR);
    assert.deepEqual(await check.runOnce(), { checked: 1, banned: 0, failed: 0 });
    assert.equal(db.getUserById(user.id).checked_at, h.clock.t);
    assert.deepEqual(await check.runOnce(), { checked: 0, banned: 0, failed: 0 });
    const call = tokenCalls(google);
    assert.equal(call.length, 1);
    assert.equal(call[0].params.client_id, 'test-client');
    assert.equal(call[0].params.client_secret, 'test-secret');
    assert.match(call[0].params.refresh_token, /^rt-/);
    assert.ok(!h.logs.some((l) => l.includes('rt-')));
  } finally { await h.close(); }
});

test('users without a session or device are not checked', async () => {
  const { h, google, user, db, check } = await setup();
  try {
    db.deleteSessionsForUser(user.id);
    db.revokeDevicesForUser(user.id, h.clock.t);
    google.calls.length = 0;
    h.clock.advance(25 * HOUR);
    assert.deepEqual(await check.runOnce(), { checked: 0, banned: 0, failed: 0 });
    assert.equal(tokenCalls(google).length, 0);
  } finally { await h.close(); }
});

test('does nothing without a Google client id', async () => {
  const h = await startDevHub();
  try {
    assert.deepEqual(await h.hub.ctx.googleCheck.runOnce(), { checked: 0, banned: 0, failed: 0 });
  } finally { await h.close(); }
});

test('an env owner is banned too and a fresh login lifts it', async () => {
  const { h, google, user, db, check } = await setup('boss@newera.inc');
  try {
    assert.equal(h.hub.ctx.helpers.isOwner(user), true);
    const normal = google.onToken;
    google.onToken = () => ({ status: 401, body: { error: 'invalid_grant' } });
    h.clock.advance(25 * HOUR);
    assert.equal((await check.runOnce()).banned, 1);
    assert.equal(db.getUserById(user.id).ban_reason, 'google_revoked');
    google.onToken = normal;
    const again = await googleLogin(h.url, google, 'boss@newera.inc');
    assert.ok(again.cookie);
    assert.equal(db.getUserById(user.id).banned_at, null);
  } finally { await h.close(); }
});

test('an unreadable refresh token is dropped, not banned', async () => {
  const { h, google, user, db, check } = await setup();
  try {
    db.raw.prepare('UPDATE users SET refresh_enc=? WHERE id=?').run('v1.rác', user.id);
    google.calls.length = 0;
    h.clock.advance(25 * HOUR);
    assert.deepEqual(await check.runOnce(), { checked: 0, banned: 0, failed: 0 });
    const u = db.getUserById(user.id);
    assert.equal(u.refresh_enc, null);
    assert.equal(u.banned_at, null);
    assert.equal(google.calls.length, 0);
    assert.ok(db.listAudit().some((a) => a.action === 'refresh_unreadable' && a.target === 'user:' + user.id));
  } finally { await h.close(); }
});

// ---- account actions ----
test('removeIslandOf revokes devices, drops the island, and a re-pair gets a fresh island', async () => {
  const { h, login, dev, user, db } = await setup();
  try {
    assert.equal(h.hub.ctx.accounts.removeIslandOf(user.id, { actorId: user.id, ip: '1.2.3.4' }), true);
    assert.equal(db.getIslandByUser(user.id), undefined);
    assert.equal(h.hub.world.islands().length, 0);
    assert.notEqual(db.getDevice(dev.device_id).revoked_at, null);
    assert.equal((await postJson(h.url, '/api/publish', pkt(2), bearer(dev.token))).status, 401);
    const a = db.listAudit().find((x) => x.action === 'island_removed');
    assert.equal(a.target, `island:${dev.island_id} user:${user.id}`);
    assert.equal(a.actor_id, user.id);
    assert.equal(a.ip, '1.2.3.4');
    assert.equal(h.hub.ctx.accounts.removeIslandOf(user.id), false);
    const dev2 = await pairDevice(h.url, login, 'Laptop 2');
    assert.notEqual(dev2.island_id, dev.island_id);
  } finally { await h.close(); }
});

test('leave removes the island, ends sessions, revokes Google and clears the identity', async () => {
  const { h, google, login, dev, user, db } = await setup();
  const own = await openStream(h.url, login.cookie);
  try {
    assert.ok(await own.until((e) => e.event === 'world'));
    google.calls.length = 0;
    await h.hub.ctx.accounts.leave(user.id, { ip: '9.9.9.9' });
    const u = db.getUserById(user.id);
    assert.equal(u.email, null);
    assert.equal(u.name, null);
    assert.equal(u.refresh_enc, null);
    assert.equal(db.getIslandByUser(user.id), undefined);
    assert.equal(db.sessionTokensForUser(user.id).length, 0);
    assert.equal(await own.waitEnd(), true);
    assert.equal(revokeCalls(google).length, 1);
    assert.equal((await postJson(h.url, '/api/publish', pkt(2), bearer(dev.token))).status, 401);
    const actions = db.listAudit().map((a) => a.action);
    assert.ok(actions.includes('island_removed') && actions.includes('user_left'));
    // leaving does not ban: the same Google account can come back as a blank user
    assert.equal(u.banned_at, null);
    assert.ok((await googleLogin(h.url, google, 'an@newera.inc')).cookie);
  } finally { own.close(); await h.close(); }
});

test('revokeGoogle clears the token even when Google fails or the blob is unreadable', async () => {
  const { h, google, user, db } = await setup();
  try {
    const acc = h.hub.ctx.accounts;
    const realFetch = h.hub.ctx.deps.fetch;
    h.hub.ctx.deps.fetch = async () => { throw new Error('offline'); };
    await acc.revokeGoogle(user.id);
    assert.equal(db.getUserById(user.id).refresh_enc, null);
    h.hub.ctx.deps.fetch = realFetch;
    db.setRefreshToken(user.id, 'v1.rác');
    google.calls.length = 0;
    await acc.revokeGoogle(user.id);
    assert.equal(db.getUserById(user.id).refresh_enc, null);
    assert.equal(google.calls.length, 0);
  } finally { await h.close(); }
});

test('the hourly timers are unref-ed and cleared on close', async () => {
  const made = [];
  const cleared = [];
  const h = await startDevHub({ deps: {
    setInterval: (fn, ms) => { const t = setInterval(fn, ms); const rec = { ms, t, unrefd: false }; const u = t.unref.bind(t); t.unref = () => { rec.unrefd = true; return u(); }; made.push(rec); return t; },
    clearInterval: (t) => { cleared.push(t); clearInterval(t); },
  } });
  assert.ok(made.some((m) => m.ms === 3600 * 1000), 'an hourly timer exists');
  assert.ok(made.every((m) => m.unrefd), 'every hub timer is unref-ed');
  await h.close();
  for (const m of made) assert.ok(cleared.includes(m.t), 'cleared on close');
});

test('banUser still revokes the Google token and audits when an earlier step throws', async () => {
  const { h, google, user, db } = await setup();
  try {
    const helpers = h.hub.ctx.helpers;
    const real = helpers.endSessionsForUser;
    helpers.endSessionsForUser = () => { throw new Error('boom'); };
    google.calls.length = 0;
    await assert.rejects(h.hub.ctx.accounts.banUser(user.id, 'abuse'), /boom/);
    helpers.endSessionsForUser = real;
    assert.equal(db.getUserById(user.id).refresh_enc, null);
    assert.equal(revokeCalls(google).length, 1);
    assert.ok(db.listAudit().some((a) => a.action === 'user_banned' && a.target === `user:${user.id} abuse`));
  } finally { await h.close(); }
});
