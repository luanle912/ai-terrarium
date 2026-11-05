import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startDevHub, devLogin, pairDevice, postJson, postDeviceForm } from './hub-helpers.mjs';

const require = createRequire(import.meta.url);
const { newUserCode, normalizeUserCode } = require('../hub/pairing.js');
const { sha256hex } = require('../hub/auth.js');
const { escapeHtml } = require('../hub/pages.js');

const start = async (h, name = 'Laptop') => (await postJson(h.url, '/api/device/start', { name })).json();
const poll = (h, dc, headers) => postJson(h.url, '/api/device/token', { device_code: dc }, headers);

test('user codes use the consonant alphabet', () => {
  for (let i = 0; i < 1000; i++) assert.match(newUserCode(), /^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
});
test('normalizeUserCode', () => {
  assert.equal(normalizeUserCode('khmt bqxp'), 'KHMT-BQXP');
  assert.equal(normalizeUserCode('KHMT-BQXP'), 'KHMT-BQXP');
  assert.equal(normalizeUserCode('khmtbqxp'), 'KHMT-BQXP');
});
test('escapeHtml escapes the dangerous five', () => {
  assert.equal(escapeHtml(`<a href="x">'&</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&lt;/a&gt;');
});

test('full pairing', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const s = await start(h);
    assert.equal(s.expires_in, 600); assert.equal(s.interval, 5);
    assert.equal(s.verification_uri, h.url + '/device');
    assert.equal((await poll(h, s.device_code)).status, 428);
    h.clock.advance(5000);
    const ap = await postDeviceForm(h.url, login, { user_code: s.user_code.toLowerCase(), action: 'approve' });
    assert.equal(ap.status, 200);
    h.clock.advance(5000);
    const r = await poll(h, s.device_code);
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.match(b.token, /^trd_[A-Za-z0-9_-]{43}$/);
    const dev = h.hub.db.getDeviceByTokenHash(sha256hex(b.token));
    assert.equal(dev.id, b.device_id);
    const user = h.hub.db.getUserBySub('dev:ann@newera.inc');
    const isl = h.hub.db.getIslandByUser(user.id);
    assert.equal(isl.id, b.island_id);
    assert.equal(isl.name, 'Đảo Ann');
    assert.match(isl.color, /^#[0-9a-f]{6}$/);
    h.clock.advance(5000);
    assert.equal((await poll(h, s.device_code)).status, 410);
    // a second device joins the same island
    const p2 = await pairDevice(h.url, login, 'Desktop');
    assert.equal(p2.island_id, b.island_id);
    assert.notEqual(p2.device_id, b.device_id);
  } finally { await h.close(); }
});

test('island falls back to the email local part without a name', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'bob@newera.inc');
    const p = await pairDevice(h.url, login);
    assert.equal(h.hub.db.getIsland(p.island_id).name, 'Đảo bob');
  } finally { await h.close(); }
});

test('polling faster than interval is slow_down', async () => {
  const h = await startDevHub();
  try {
    const s = await start(h);
    assert.equal((await poll(h, s.device_code)).status, 428);
    const r = await poll(h, s.device_code);
    assert.equal(r.status, 429);
    assert.equal((await r.json()).error, 'slow_down');
    h.clock.advance(5000);
    assert.equal((await poll(h, s.device_code)).status, 428);
  } finally { await h.close(); }
});

test('expired code is 410', async () => {
  const h = await startDevHub();
  try {
    const s = await start(h);
    h.clock.advance(601_000);
    const r = await poll(h, s.device_code);
    assert.equal(r.status, 410);
    assert.equal((await r.json()).error, 'expired_token');
    // approving an expired code fails too
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    assert.equal((await postDeviceForm(h.url, login, { user_code: s.user_code, action: 'approve' })).status, 400);
  } finally { await h.close(); }
});

test('deny gives 403 access_denied', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const s = await start(h);
    assert.equal((await postDeviceForm(h.url, login, { user_code: s.user_code, action: 'deny' })).status, 200);
    const r = await poll(h, s.device_code);
    assert.equal(r.status, 403);
    assert.equal((await r.json()).error, 'access_denied');
    assert.equal(h.hub.db.getIslandByUser(h.hub.db.getUserBySub('dev:ann@newera.inc').id), undefined, 'no island without an approved device');
  } finally { await h.close(); }
});

test('five wrong codes lock approval for ten minutes', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const s = await start(h);
    for (let i = 0; i < 5; i++) assert.equal((await postDeviceForm(h.url, login, { user_code: 'BBBB-CCCC', action: 'approve' })).status, 400);
    assert.equal((await postDeviceForm(h.url, login, { user_code: s.user_code, action: 'approve' })).status, 429, 'locked even for the right code');
    h.clock.advance(9 * 60_000);
    assert.equal((await postDeviceForm(h.url, login, { user_code: s.user_code, action: 'approve' })).status, 429);
    h.clock.advance(61_000);
    // the code itself expired by now (601 s); a fresh one works again
    const s2 = await start(h);
    assert.equal((await postDeviceForm(h.url, login, { user_code: s2.user_code, action: 'approve' })).status, 200);
  } finally { await h.close(); }
});

test('device page shows the device name escaped and the warning', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const s = await start(h, '<script>alert(1)</script>');
    const r = await postDeviceForm(h.url, login, { user_code: s.user_code, action: 'lookup' });
    const t = await r.text();
    assert.equal(r.status, 200);
    assert.ok(t.includes('&lt;script&gt;'));
    assert.ok(!t.includes('<script>'));
    assert.ok(t.includes('Chỉ bấm Cho phép nếu bạn vừa chạy lệnh này trên máy của mình'));
    assert.match(t, /Yêu cầu lúc: 2027-/);
    assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
  } finally { await h.close(); }
});

test('device page never prefills the code (B10)', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const r = await fetch(h.url + '/device?code=ABCD-EFGH', { headers: { cookie: login.cookie } });
    const t = await r.text();
    assert.equal(r.status, 200);
    assert.ok(!t.includes('ABCD'));
    assert.match(t, /name="user_code"[^>]*>/);
    assert.ok(!/name="user_code"[^>]*value=/.test(t));
    // without a session: redirect to login
    const anon = await fetch(h.url + '/device', { redirect: 'manual' });
    assert.equal(anon.status, 302);
  } finally { await h.close(); }
});

test('approval needs session, csrf and origin', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const s = await start(h);
    const f = { user_code: s.user_code, action: 'approve' };
    const anon = await fetch(h.url + '/device', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: h.url }, body: new URLSearchParams(f) });
    assert.equal(anon.status, 401);
    assert.equal((await postDeviceForm(h.url, { ...login, csrf: 'nope' }, f)).status, 403);
    assert.equal((await postDeviceForm(h.url, login, f, { origin: 'http://evil.example' })).status, 403);
    assert.equal((await poll(h, s.device_code)).status, 428, 'still pending');
  } finally { await h.close(); }
});

test('token endpoint ignores cookies', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const s = await start(h);
    const r = await poll(h, s.device_code, { cookie: login.cookie, origin: 'http://evil.example' });
    assert.equal(r.status, 428); // no CSRF/Origin demanded, and the session does not approve anything
    assert.equal(h.hub.db.getDeviceCodeByHash(sha256hex(s.device_code)).approved_user_id, null);
    const st = await postJson(h.url, '/api/device/start', { name: 'x' }, { cookie: login.cookie, origin: 'http://evil.example' });
    assert.equal(st.status, 200);
  } finally { await h.close(); }
});

test('start is limited to 10 per hour per ip', async () => {
  const h = await startDevHub();
  try {
    for (let i = 0; i < 10; i++) assert.equal((await postJson(h.url, '/api/device/start', { name: 'm' })).status, 200);
    assert.equal((await postJson(h.url, '/api/device/start', { name: 'm' })).status, 429);
  } finally { await h.close(); }
});

test('bad bodies are rejected', async () => {
  const h = await startDevHub();
  try {
    const bad = await fetch(h.url + '/api/device/start', { method: 'POST', body: '{nope' });
    assert.equal(bad.status, 400);
    const big = await fetch(h.url + '/api/device/start', { method: 'POST', body: JSON.stringify({ name: 'x'.repeat(5000) }) });
    assert.equal(big.status, 413);
    assert.equal((await postJson(h.url, '/api/device/token', {})).status, 400);
    assert.equal((await poll(h, 'unknown')).status, 410);
  } finally { await h.close(); }
});

test('db holds only hashes of the token and device code, and logs hold neither', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const s = await start(h);
    await postDeviceForm(h.url, login, { user_code: s.user_code, action: 'approve' });
    const t = await (await poll(h, s.device_code)).json();
    const raw = h.hub.db.raw;
    for (const { name } of raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()) {
      for (const row of raw.prepare(`SELECT * FROM ${name}`).all()) {
        for (const v of Object.values(row)) {
          assert.ok(!String(v).includes(t.token) && !String(v).includes(s.device_code), name);
        }
      }
    }
    assert.ok(h.hub.db.getDeviceByTokenHash(sha256hex(t.token)));
    const logs = h.logs.join('\n');
    assert.ok(!logs.includes(t.token) && !logs.includes(s.device_code) && !logs.includes(s.user_code));
  } finally { await h.close(); }
});

const pub = (h, token) => fetch(h.url + '/api/publish', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ v: 1, seq: 0, sessions: [] }) });
const audits = (h, action) => h.hub.db.listAudit(500).filter((a) => a.action === action);

test('revoke-self revokes only the calling device', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const d1 = await pairDevice(h.url, login, 'One');
    const d2 = await pairDevice(h.url, login, 'Two');
    assert.equal((await pub(h, d1.token)).status, 204);
    const r = await postJson(h.url, '/api/device/revoke-self', {}, { authorization: 'Bearer ' + d1.token });
    assert.equal(r.status, 204);
    assert.equal((await pub(h, d1.token)).status, 401);
    assert.equal((await pub(h, d2.token)).status, 204);
    const a = audits(h, 'device_revoked');
    assert.equal(a.length, 1); assert.equal(a[0].actor_id, null); assert.match(a[0].target, new RegExp('device:' + d1.device_id));
    // already revoked and unknown tokens -> 401
    assert.equal((await postJson(h.url, '/api/device/revoke-self', {}, { authorization: 'Bearer ' + d1.token })).status, 401);
    assert.equal((await postJson(h.url, '/api/device/revoke-self', {}, { authorization: 'Bearer trd_nope' })).status, 401);
  } finally { await h.close(); }
});

test('revoke-self ignores cookies', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const d1 = await pairDevice(h.url, login, 'One');
    const r = await postJson(h.url, '/api/device/revoke-self', {}, { cookie: login.cookie });
    assert.equal(r.status, 401);
    assert.equal((await pub(h, d1.token)).status, 204);
  } finally { await h.close(); }
});

// ---- Sky of 8 islands: the hub refuses a ninth island at pairing ----
const { HUB_FULL_MSG } = require('../hub/pairing.js');
const auditOf = (h, action) => h.hub.db.listAudit(500).filter((a) => a.action === action);
const fillIslands = (h, n) => {
  for (let i = 0; i < n; i++) {
    const u = h.hub.db.upsertUser({ googleSub: 'dev:fill' + i, email: `fill${i}@newera.inc`, name: 'F' + i, now: h.clock.t });
    h.hub.db.claimIsland({ id: String(i).padStart(16, '0'), userId: u.id, name: 'Đảo F' + i, color: '#aabbcc', now: h.clock.t });
  }
};

test('a ninth island is refused on the device page and the CLI gets hub_full', async () => {
  const h = await startDevHub();
  try {
    fillIslands(h, 8);
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const s = await start(h);
    const r = await postDeviceForm(h.url, login, { user_code: s.user_code, action: 'lookup' });
    assert.equal(r.status, 400);
    assert.ok((await r.text()).includes(HUB_FULL_MSG));
    assert.equal(HUB_FULL_MSG, 'Hub đã đủ 8 đảo, nhờ owner xoá bớt.');
    h.clock.advance(5000);
    const t = await poll(h, s.device_code);
    assert.equal(t.status, 403);
    assert.deepEqual(await t.json(), { error: 'hub_full' });
    assert.equal(h.hub.db.islandCount(), 8);
    const a = auditOf(h, 'pair_refused_full');
    assert.equal(a.length, 1);
    assert.match(a[0].target, /^user:\d+$/);
    // refusals are not wrong codes: five more of them must not lock the user out
    for (let i = 0; i < 5; i++) {
      const s2 = await start(h);
      assert.equal((await postDeviceForm(h.url, login, { user_code: s2.user_code, action: 'approve' })).status, 400);
    }
    const bad = await postDeviceForm(h.url, login, { user_code: 'BBBB-CCCC', action: 'approve' });
    assert.equal(bad.status, 400, 'not locked (429)');
  } finally { await h.close(); }
});

test('two users racing for the last slot: exactly one wins', async () => {
  const h = await startDevHub();
  try {
    fillIslands(h, 7);
    const free = 7; // fill used slots 0-6
    const [a, b] = [await devLogin(h.url, 'ann@newera.inc', 'Ann'), await devLogin(h.url, 'bob@newera.inc', 'Bob')];
    const [sa, sb] = [await start(h), await start(h)];
    assert.equal((await postDeviceForm(h.url, a, { user_code: sa.user_code, action: 'lookup' })).status, 200);
    assert.equal((await postDeviceForm(h.url, b, { user_code: sb.user_code, action: 'lookup' })).status, 200);
    const rs = await Promise.all([
      postDeviceForm(h.url, a, { user_code: sa.user_code, action: 'approve' }),
      postDeviceForm(h.url, b, { user_code: sb.user_code, action: 'approve' }),
    ]);
    const bodies = await Promise.all(rs.map((r) => r.text()));
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 400]);
    const win = rs.findIndex((r) => r.status === 200), lose = 1 - win;
    assert.ok(bodies[win].includes('Đã cho phép'));
    assert.ok(bodies[lose].includes(HUB_FULL_MSG));
    assert.equal(h.hub.db.islandCount(), 8);
    const winner = h.hub.db.getUserBySub(win === 0 ? 'dev:ann@newera.inc' : 'dev:bob@newera.inc');
    assert.equal(h.hub.db.getIslandByUser(winner.id).slot, free);
    h.clock.advance(5000);
    const codes = [sa, sb];
    assert.equal((await poll(h, codes[win].device_code)).status, 200);
    const t = await poll(h, codes[lose].device_code);
    assert.equal(t.status, 403);
    assert.deepEqual(await t.json(), { error: 'hub_full' });
  } finally { await h.close(); }
});

test('a user with an island pairs another device on a full hub', async () => {
  const h = await startDevHub();
  try {
    fillIslands(h, 7);
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const p1 = await pairDevice(h.url, login, 'A');
    assert.equal(h.hub.db.islandCount(), 8);
    const p2 = await pairDevice(h.url, login, 'B');
    assert.equal(p2.island_id, p1.island_id);
    assert.equal(h.hub.db.islandCount(), 8);
  } finally { await h.close(); }
});

test('after an owner removes an island the next pairing gets its slot', async () => {
  const h = await startDevHub();
  try {
    fillIslands(h, 8);
    const boss = await devLogin(h.url, 'boss@newera.inc', 'Boss');
    const victim = h.hub.db.getIsland('0000000000000002');
    assert.equal(victim.slot, 2);
    const r = await postJson(h.url, `/api/owner/islands/${victim.id}/remove`, {}, { cookie: boss.cookie, origin: h.url, 'x-csrf-token': boss.csrf });
    assert.equal(r.status, 200);
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const p = await pairDevice(h.url, login);
    assert.equal(h.hub.db.getIsland(p.island_id).slot, 2);
    assert.equal(h.hub.db.islandCount(), 8);
  } finally { await h.close(); }
});

test('leaving frees a slot', async () => {
  const h = await startDevHub();
  try {
    fillIslands(h, 7);
    const leaver = await devLogin(h.url, 'cat@newera.inc', 'Cat');
    const pc = await pairDevice(h.url, leaver);
    const slot = h.hub.db.getIsland(pc.island_id).slot;
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const s = await start(h);
    assert.equal((await postDeviceForm(h.url, login, { user_code: s.user_code, action: 'lookup' })).status, 400);
    const lv = await fetch(h.url + '/me/leave', { method: 'POST', headers: { cookie: leaver.cookie, origin: h.url, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf: leaver.csrf }) });
    assert.equal(lv.status, 200);
    const p = await pairDevice(h.url, login, 'Again');
    assert.equal(h.hub.db.getIsland(p.island_id).slot, slot);
  } finally { await h.close(); }
});
