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
