import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDevHub, devLogin, pairDevice, postJson } from './hub-helpers.mjs';

const DAY = 24 * 3600 * 1000;
const pkt = (extra = {}) => ({ v: 1, seq: 1, sessions: [], ...extra });
const bearer = (token) => ({ authorization: 'Bearer ' + token });
const api = (h, login, p, body, headers = {}) => postJson(h.url, p, body, { cookie: login.cookie, origin: h.url, 'x-csrf-token': login.csrf, ...headers });
const getMe = async (h, login) => (await fetch(h.url + '/api/me', { headers: { cookie: login.cookie } })).json();
const form = (h, login, p, fields = {}, headers = {}) => fetch(h.url + p, {
  method: 'POST', redirect: 'manual',
  headers: { cookie: login.cookie, origin: h.url, 'content-type': 'application/x-www-form-urlencoded', ...headers },
  body: new URLSearchParams({ csrf: login.csrf, ...fields }),
});
const audit = (h, action) => h.hub.db.listAudit(500).filter((a) => a.action === action);

async function openStream(url, cookie) {
  const ac = new AbortController();
  const r = await fetch(url + '/api/world/stream', { headers: { cookie }, signal: ac.signal });
  const events = [];
  const waiters = [];
  let buf = '';
  const dec = new TextDecoder();
  const reader = r.body.getReader();
  (async () => {
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
        waiters.splice(0).forEach((w) => w());
      }
    } catch { /* aborted */ }
  })();
  const until = async (pred, ms = 3000) => {
    const t0 = Date.now();
    for (;;) {
      const f = events.find(pred);
      if (f) return f;
      if (Date.now() - t0 > ms) return null;
      await new Promise((res) => { waiters.push(res); setTimeout(res, 100); });
    }
  };
  return { until, close: () => ac.abort() };
}

test('api me lists devices with their send state', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    const a = await pairDevice(h.url, login, 'May A');
    const b = await pairDevice(h.url, login, 'May B');
    const c = await pairDevice(h.url, login, 'May C');
    assert.equal((await postJson(h.url, '/api/publish', pkt({ private: true }), bearer(a.token))).status, 204);
    assert.equal((await api(h, login, `/api/me/devices/${c.device_id}/revoke`, {})).status, 200);
    const me = await getMe(h, login);
    assert.equal(me.island.id, a.island_id);
    assert.equal(me.colors.length, 8);
    const by = Object.fromEntries(me.devices.map((d) => [d.id, d]));
    assert.equal(by[a.device_id].send, 'private');
    assert.equal(by[a.device_id].share, 'kin');
    assert.equal(by[b.device_id].send, 'offline');
    assert.equal(by[b.device_id].share, null);
    assert.equal(by[c.device_id].send, 'revoked');
    assert.equal(by[a.device_id].isNew, true);
    assert.equal(by[c.device_id].isNew, false);
    h.clock.advance(7 * DAY);
    const later = await getMe(h, await devLogin(h.url, 'an@newera.inc', 'An')); // the old session expired meanwhile
    assert.equal(later.devices.find((d) => d.id === a.device_id).isNew, false);
    assert.equal((await fetch(h.url + '/api/me')).status, 401);
  } finally { await h.close(); }
});

test('api me reports sending for a publishing machine and no island before pairing', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    const none = await getMe(h, login);
    assert.equal(none.island, null);
    assert.deepEqual(none.devices, []);
    const a = await pairDevice(h.url, login, 'May A');
    await postJson(h.url, '/api/publish', pkt(), bearer(a.token));
    assert.equal((await getMe(h, login)).devices[0].send, 'sending');
  } finally { await h.close(); }
});

test('renaming the island updates viewers', async () => {
  const h = await startDevHub();
  let st;
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    const a = await pairDevice(h.url, login, 'May A');
    await postJson(h.url, '/api/publish', pkt(), bearer(a.token));
    st = await openStream(h.url, login.cookie);
    const r = await api(h, login, '/api/me/island', { name: 'Đảo Mây', color: '#2a9d8f' });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { island: { id: a.island_id, name: 'Đảo Mây', color: '#2a9d8f' } });
    const w = await st.until((e) => e.event === 'world' && e.data.islands.some((i) => i.name === 'Đảo Mây' && i.color === '#2a9d8f'));
    assert.ok(w);
    assert.equal(audit(h, 'island_updated').length, 1);
    assert.equal(h.hub.db.getIslandByUser(h.hub.db.getIsland(a.island_id).user_id).name, 'Đảo Mây');
  } finally { if (st) st.close(); await h.close(); }
});

test('island names are checked', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    assert.equal((await api(h, login, '/api/me/island', { name: 'Ổn' })).status, 404); // no island yet
    const a = await pairDevice(h.url, login, 'May A');
    for (const body of [{ name: '' }, { name: 'x'.repeat(25) }, { name: '<b>' }, { color: '#000000' }, { name: 5 }]) {
      assert.equal((await api(h, login, '/api/me/island', body)).status, 400, JSON.stringify(body));
    }
    const ok = await api(h, login, '/api/me/island', { name: 'Đảo  Mây ' });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).island.name, 'Đảo Mây');
    assert.equal(h.hub.db.getIsland(a.island_id).name, 'Đảo Mây');
  } finally { await h.close(); }
});

test('the island form redirects back to /me', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    const a = await pairDevice(h.url, login, 'May A');
    const r = await form(h, login, '/me/island', { name: 'Đảo Nắng', color: '#e76f51' });
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/me');
    assert.equal(h.hub.db.getIsland(a.island_id).name, 'Đảo Nắng');
    assert.equal((await form(h, login, '/me/island', { name: '<b>' })).status, 400);
  } finally { await h.close(); }
});

test('island and revoke APIs need csrf and origin', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    const a = await pairDevice(h.url, login, 'May A');
    const paths = [['/api/me/island', { name: 'Hack' }], [`/api/me/devices/${a.device_id}/revoke`, {}]];
    for (const [p, body] of paths) {
      assert.equal((await api(h, login, p, body, { 'x-csrf-token': 'bad' })).status, 403, p);
      assert.equal((await api(h, login, p, body, { origin: 'http://evil.example' })).status, 403, p);
      assert.equal((await postJson(h.url, p, body, { cookie: login.cookie, 'x-csrf-token': login.csrf })).status, 403, p); // no origin
      assert.equal((await postJson(h.url, p, body)).status, 401, p);
    }
    assert.equal(h.hub.db.getDevice(a.device_id).revoked_at, null);
  } finally { await h.close(); }
});

test('revoking through the API removes the device and its island', async () => {
  const h = await startDevHub();
  let st;
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    const a = await pairDevice(h.url, login, 'May A');
    await postJson(h.url, '/api/publish', pkt(), bearer(a.token));
    st = await openStream(h.url, login.cookie);
    assert.equal((await api(h, login, `/api/me/devices/${a.device_id}/revoke`, {})).status, 200);
    assert.ok(await st.until((e) => e.event === 'remove' && e.data.id === a.island_id));
    assert.equal((await postJson(h.url, '/api/publish', pkt({ seq: 2 }), bearer(a.token))).status, 401);
    assert.equal(audit(h, 'device_revoked').length, 1);
    assert.equal((await api(h, login, `/api/me/devices/${a.device_id}/revoke`, {})).status, 404); // already revoked
    const other = await devLogin(h.url, 'bo@newera.inc', 'Bo');
    const b = await pairDevice(h.url, other, 'May B');
    assert.equal((await api(h, login, `/api/me/devices/${b.device_id}/revoke`, {})).status, 404); // not mine
    assert.equal((await api(h, login, '/api/me/devices/nothex/revoke', {})).status, 404);
    assert.equal(h.hub.db.getDevice(b.device_id).revoked_at, null);
  } finally { if (st) st.close(); await h.close(); }
});

test('the form revoke writes to the audit log', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    const a = await pairDevice(h.url, login, 'May A');
    assert.equal((await form(h, login, '/me/devices/revoke', { device_id: a.device_id })).status, 302);
    const rows = audit(h, 'device_revoked');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].target, 'device:' + a.device_id);
  } finally { await h.close(); }
});

test('me page shows the new-device notice escaped', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    await pairDevice(h.url, login, '<img>');
    const html = await (await fetch(h.url + '/me', { headers: { cookie: login.cookie } })).text();
    assert.ok(html.includes('Máy mới: <strong>&lt;img&gt;</strong>') || html.includes('Máy mới: &lt;img&gt;'), 'notice present');
    assert.ok(!html.includes('<img>'));
    assert.equal((html.match(/name="color"/g) || []).length, 8);
    assert.ok(html.includes('href="/me/leave"'));
    h.clock.advance(7 * DAY);
    const relog = await devLogin(h.url, 'an@newera.inc', 'An');
    const later = await (await fetch(h.url + '/me', { headers: { cookie: relog.cookie } })).text();
    assert.ok(!later.includes('Máy mới:'));
  } finally { await h.close(); }
});

test('leaving deletes island, devices and sessions but keeps the user row', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    const a = await pairDevice(h.url, login, 'May A');
    await postJson(h.url, '/api/publish', pkt(), bearer(a.token));
    const page = await fetch(h.url + '/me/leave', { headers: { cookie: login.cookie } });
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes('Rời hub'));
    assert.equal((await fetch(h.url + '/me/leave', { redirect: 'manual' })).status, 302);
    assert.equal((await form(h, login, '/me/leave', {}, { origin: 'http://evil.example' })).status, 403);
    const userId = h.hub.db.getIsland(a.island_id).user_id;
    const r = await form(h, login, '/me/leave');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Đã rời/);
    assert.match(r.headers.getSetCookie().join(';'), /tr_sess=;.*Max-Age=0/);
    const u = h.hub.db.getUserById(userId);
    assert.equal(u.email, null);
    assert.equal(u.name, null);
    assert.ok(u.google_sub);
    assert.equal(h.hub.db.getIsland(a.island_id), undefined);
    assert.equal((await postJson(h.url, '/api/publish', pkt({ seq: 2 }), bearer(a.token))).status, 401);
    assert.equal((await fetch(h.url + '/api/config', { headers: { cookie: login.cookie } })).status, 401);
    assert.equal(audit(h, 'user_left').length, 1);
    const again = await devLogin(h.url, 'an@newera.inc', 'An');
    assert.ok(again.cookie);
  } finally { await h.close(); }
});

test('an owner removes a member\'s island', async () => {
  const h = await startDevHub();
  let st;
  try {
    const boss = await devLogin(h.url, 'boss@newera.inc', 'Boss');
    const member = await devLogin(h.url, 'an@newera.inc', 'An');
    const a = await pairDevice(h.url, member, 'May A');
    await postJson(h.url, '/api/publish', pkt(), bearer(a.token));
    st = await openStream(h.url, boss.cookie);
    const r = await api(h, boss, `/api/owner/islands/${a.island_id}/remove`, {});
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    assert.ok(await st.until((e) => e.event === 'remove' && e.data.id === a.island_id));
    assert.equal((await postJson(h.url, '/api/publish', pkt({ seq: 2 }), bearer(a.token))).status, 401);
    const again = await devLogin(h.url, 'an@newera.inc', 'An');
    const b = await pairDevice(h.url, again, 'May A2');
    assert.notEqual(b.island_id, a.island_id);
    const rows = audit(h, 'island_removed');
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].actor_id, h.hub.db.getIsland(b.island_id).user_id); // the owner, not the member
    assert.notEqual(rows[0].actor_id, null);
    assert.equal((await api(h, boss, `/api/owner/islands/${'0'.repeat(16)}/remove`, {})).status, 404);
  } finally { if (st) st.close(); await h.close(); }
});

test('owners cannot remove an owner\'s island, members cannot remove anything', async () => {
  const h = await startDevHub({ env: { HUB_OWNER_EMAILS: 'boss@newera.inc,boss2@newera.inc' } });
  try {
    const boss = await devLogin(h.url, 'boss@newera.inc', 'Boss');
    const boss2 = await devLogin(h.url, 'boss2@newera.inc', 'Boss2');
    const member = await devLogin(h.url, 'an@newera.inc', 'An');
    const mine = await pairDevice(h.url, boss, 'B');
    const theirs = await pairDevice(h.url, boss2, 'B2');
    const ans = await pairDevice(h.url, member, 'A');
    let r = await api(h, boss, `/api/owner/islands/${theirs.island_id}/remove`, {});
    assert.equal(r.status, 403);
    assert.deepEqual(await r.json(), { error: 'owner_island' });
    r = await api(h, boss, `/api/owner/islands/${mine.island_id}/remove`, {});
    assert.equal(r.status, 403);
    assert.deepEqual(await r.json(), { error: 'owner_island' });
    r = await api(h, member, `/api/owner/islands/${theirs.island_id}/remove`, {});
    assert.equal(r.status, 403);
    assert.deepEqual(await r.json(), { error: 'forbidden' });
    r = await api(h, member, `/api/owner/islands/${ans.island_id}/remove`, {});
    assert.deepEqual(await r.json(), { error: 'forbidden' });
    assert.equal((await api(h, boss, `/api/owner/islands/${ans.island_id}/remove`, {}, { 'x-csrf-token': 'bad' })).status, 403);
    assert.ok(h.hub.db.getIsland(theirs.island_id) && h.hub.db.getIsland(mine.island_id) && h.hub.db.getIsland(ans.island_id));
    assert.equal(audit(h, 'island_removed').length, 0);
  } finally { await h.close(); }
});

test('pairing writes device_paired to the audit log', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    const a = await pairDevice(h.url, login, 'May A');
    const rows = audit(h, 'device_paired');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].target, 'device:' + a.device_id);
    assert.notEqual(rows[0].actor_id, null);
  } finally { await h.close(); }
});
