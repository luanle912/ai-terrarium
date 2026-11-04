import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const require = createRequire(import.meta.url);
const { loadConfig } = require('../hub/config.js');
const { openDb } = require('../hub/db.js');
const { HttpError, clientIp, parseCookies, readBody, send } = require('../hub/http.js');
const { createLimiter } = require('../hub/limits.js');
const { createHub } = require('../hub/server.js');

const OK = {
  HUB_PUBLIC_URL: 'https://terrarium.newera.inc',
  HUB_ALLOWED_DOMAINS: 'newera.inc',
  HUB_OWNER_EMAILS: 'kiet.nc@newera.inc',
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hub-base-'));

test('refuses to start without allowed domains', () => {
  assert.throws(() => loadConfig({ ...OK, HUB_ALLOWED_DOMAINS: '' }), /HUB_ALLOWED_DOMAINS/);
  assert.throws(() => loadConfig({ ...OK, HUB_ALLOWED_DOMAINS: undefined }), /HUB_ALLOWED_DOMAINS/);
});

test('lists every missing variable at once', () => {
  assert.throws(() => loadConfig({}), (e) =>
    ['HUB_PUBLIC_URL', 'HUB_ALLOWED_DOMAINS', 'HUB_OWNER_EMAILS', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
      .every((k) => e.message.includes(k)));
});

test('dev login only on localhost', () => {
  assert.throws(() => loadConfig({ ...OK, HUB_DEV_LOGIN: '1', HUB_PUBLIC_URL: 'https://x.com' }), /HUB_DEV_LOGIN/);
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ...dev } = OK;
  const c = loadConfig({ ...dev, HUB_DEV_LOGIN: '1', HUB_PUBLIC_URL: 'http://localhost:4318' });
  assert.equal(c.devLogin, true);
  assert.equal(c.secure, false);
  assert.equal(c.origin, 'http://localhost:4318');
  assert.equal(loadConfig({ ...dev, HUB_DEV_LOGIN: '1', HUB_PUBLIC_URL: 'http://127.0.0.1:4318' }).devLogin, true);
  // Not dev: Google credentials stay required.
  assert.throws(() => loadConfig({ ...dev, HUB_PUBLIC_URL: 'http://localhost:4318' }), /GOOGLE_CLIENT_ID/);
});

test('allowed domains are lowercased and exact', () => {
  const c = loadConfig({ ...OK, HUB_ALLOWED_DOMAINS: ' NewEra.INC , b.com ', HUB_OWNER_EMAILS: ' Kiet.NC@Newera.inc ' });
  assert.deepEqual(c.allowedDomains, ['newera.inc', 'b.com']);
  assert.deepEqual(c.ownerEmails, ['kiet.nc@newera.inc']);
  assert.equal(c.port, 4318);
  assert.equal(c.host, '127.0.0.1');
  assert.equal(c.secure, true);
  assert.equal(c.trustProxy, false);
  assert.equal(c.devLogin, false);
});

test('db file is 0600 and parent dir is created', () => {
  const dir = tmp();
  const p = path.join(dir, 'nested', 'hub.sqlite');
  const db = openDb(p);
  assert.equal(fs.statSync(p).mode & 0o777, 0o600);
  const fk = db.raw.prepare('PRAGMA foreign_keys').get();
  assert.equal(Object.values(fk)[0], 1);
  const tables = db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  assert.ok(!tables.includes('audit'));
  for (const t of ['users', 'islands', 'devices', 'device_codes', 'sessions', 'login_states']) assert.ok(tables.includes(t), t);
  db.close();
});

test('db helpers round-trip', () => {
  const db = openDb(path.join(tmp(), 'h.sqlite'));
  const u = db.upsertUser({ googleSub: 's1', email: 'a@newera.inc', name: 'A', role: 'owner', now: 1000 });
  assert.equal(u.role, 'owner');
  const u2 = db.upsertUser({ googleSub: 's1', email: 'a2@newera.inc', name: 'A2', role: 'member', now: 2000 });
  assert.equal(u2.id, u.id);
  assert.equal(u2.email, 'a2@newera.inc');
  assert.equal(u2.role, 'owner'); // role is only set on insert
  assert.equal(u2.last_login_at, 2000);
  assert.equal(db.getUserBySub('s1').id, u.id);

  db.createSession({ tokenHash: 'th', userId: u.id, csrf: 'c', now: 1, expiresAt: 100 });
  assert.equal(db.getSession('th').csrf, 'c');
  db.deleteSession('th');
  assert.equal(db.getSession('th'), undefined);

  db.createLoginState({ state: 'st', nonce: 'n', verifier: 'v', now: 5 });
  assert.equal(db.takeLoginState('st').nonce, 'n');
  assert.equal(db.takeLoginState('st'), undefined);

  db.createDeviceCode({ codeHash: 'ch', userCode: 'ABCD-EFGH', name: 'mac', now: 1, expiresAt: 50, ip: '1.1.1.1' });
  assert.equal(db.getDeviceCodeByUserCode('ABCD-EFGH').code_hash, 'ch');
  assert.equal(db.approveDeviceCode('ch', u.id), true);
  assert.equal(db.getDeviceCodeByHash('ch').approved_user_id, u.id);

  db.createDevice({ id: 'd1', userId: u.id, name: 'mac', tokenHash: 'dth', now: 3 });
  assert.equal(db.getDeviceByTokenHash('dth').id, 'd1');
  assert.equal(db.listDevices(u.id).length, 1);
  assert.equal(db.revokeDevice('d1', u.id, 9), true);
  assert.equal(db.getDeviceByTokenHash('dth').revoked_at, 9);

  db.upsertIsland({ id: 'i1', userId: u.id, name: 'Isle', color: '#fff', now: 4 });
  db.upsertIsland({ id: 'i1', userId: u.id, name: 'Isle2', color: '#000', now: 5 });
  assert.equal(db.getIslandByUser(u.id).name, 'Isle2');
  db.deleteIslandByUser(u.id);
  assert.equal(db.getIslandByUser(u.id), undefined);

  db.createLoginState({ state: 'old', nonce: 'n', verifier: 'v', now: 0 });
  db.createSession({ tokenHash: 'x', userId: u.id, csrf: 'c', now: 0, expiresAt: 10 });
  db.cleanup(10 * 60 * 1000 + 100);
  assert.equal(db.takeLoginState('old'), undefined);
  assert.equal(db.getSession('x'), undefined);
  assert.equal(db.getDeviceCodeByHash('ch'), undefined);
  db.close();
});

test('limiter allows burst then refills', () => {
  const l = createLimiter({ rate: 1, burst: 2 });
  assert.equal(l.take('k', 0), true);
  assert.equal(l.take('k', 0), true);
  assert.equal(l.take('k', 0), false);
  assert.equal(l.take('other', 0), true);
  assert.equal(l.take('k', 1000), true);
  assert.equal(l.take('k', 1000), false);
});

test('clientIp ignores forwarded headers unless trusted', () => {
  const req = { headers: { 'x-forwarded-for': '9.9.9.9, 8.8.8.8' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(clientIp(req, false), '127.0.0.1');
  assert.equal(clientIp(req, true), '8.8.8.8');
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '1.2.3.4' } }, true), '1.2.3.4');
});

test('parseCookies', () => {
  assert.deepEqual(parseCookies('a=1; b=hello%20w; c'), { a: '1', b: 'hello w' });
  assert.deepEqual(parseCookies(undefined), {});
});

async function withHub(fn, extra = {}) {
  const dir = tmp();
  const logs = [];
  const config = loadConfig({ ...OK, HUB_DB: path.join(dir, 'h.sqlite'), HUB_PORT: '0' });
  const hub = createHub(config, { log: (l) => logs.push(l), ...extra });
  await new Promise((r) => hub.server.listen(0, '127.0.0.1', r));
  const port = hub.server.address().port;
  try { await fn({ hub, port, logs }); } finally { await hub.close(); }
}

const req = (port, opts, body) => new Promise((resolve, reject) => {
  const r = http.request({ host: '127.0.0.1', port, ...opts }, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
  });
  r.on('error', reject);
  r.end(body);
});

test('unknown route is 404 with security headers, log has no query', async () => {
  await withHub(async ({ port, logs }) => {
    const r = await req(port, { path: '/nope?code=SECRET&state=S', headers: { cookie: 'tr_sess=SECRETCOOKIE' } });
    assert.equal(r.status, 404);
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.equal(r.headers['referrer-policy'], 'same-origin');
    assert.equal(r.headers['content-security-policy'], "frame-ancestors 'none'");
    const line = logs.join('\n');
    assert.match(line, /GET \/nope 404/);
    assert.ok(!/SECRET/.test(line));
  });
});

test('extra route modules plug in and errors map to status', async () => {
  const mod = (ctx) => [
    { method: 'GET', path: '/hello', handler: (rq, rs) => send(rs, 200, 'hi', { 'Content-Type': 'text/plain' }) },
    { method: 'GET', path: /^\/item\/(\d+)$/, handler: (rq, rs, rc) => send(rs, 200, rc.match[1]) },
    { method: 'POST', path: '/echo', handler: async (rq, rs) => { const b = await readBody(rq, 16); send(rs, 200, b); } },
    { method: 'GET', path: '/boom', handler: () => { throw new Error('secret detail'); } },
  ];
  await withHub(async ({ port }) => {
    assert.equal((await req(port, { path: '/hello' })).body, 'hi');
    assert.equal((await req(port, { path: '/item/42' })).body, '42');
    assert.equal((await req(port, { path: '/hello', method: 'POST' })).status, 404);
    const e = await req(port, { path: '/boom' });
    assert.equal(e.status, 500);
    assert.ok(!e.body.includes('secret detail'));
  }, { routeModules: [mod] });
});

test('dev login rejects tricky hosts', () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ...dev } = OK;
  for (const u of ['http://localhost:4318@evil.com', 'http://localhost.evil.com', 'https://localhost', 'http://user:p@localhost'])
    assert.throws(() => loadConfig({ ...dev, HUB_DEV_LOGIN: '1', HUB_PUBLIC_URL: u }), /HUB_DEV_LOGIN/, u);
});

test('foreign errors are a bare 500 and never kill the hub', async () => {
  const mod = () => [
    { method: 'GET', path: '/up', handler: () => { throw Object.assign(new Error('secret upstream'), { status: 502 }); } },
    { method: 'GET', path: '/upa', handler: async () => { throw Object.assign(new Error('secret upstream'), { status: 502 }); } },
    { method: 'GET', path: '/bad', handler: async () => { throw new HttpError(1000, 'secret range'); } },
    { method: 'GET', path: '/ok', handler: (rq, rs) => send(rs, 200, 'ok') },
  ];
  await withHub(async ({ port, logs }) => {
    for (const p of ['/up', '/upa', '/bad']) {
      const r = await req(port, { path: p });
      assert.equal(r.status, 500, p);
      assert.ok(!r.body.includes('secret'), p);
    }
    assert.equal((await req(port, { path: '/ok' })).body, 'ok');
    assert.ok(!logs.join('\n').includes('secret'));
  }, { routeModules: [mod] });
});

test('body over the limit is 413 without reading it all', async () => {
  const mod = () => [{ method: 'POST', path: '/echo', handler: async (rq, rs) => { send(rs, 200, await readBody(rq, 16)); } }];
  await withHub(async ({ port }) => {
    assert.equal((await req(port, { path: '/echo', method: 'POST' }, 'x'.repeat(10))).body, 'xxxxxxxxxx');
    // Declared length over the limit: rejected before reading.
    const r = await req(port, { path: '/echo', method: 'POST' }, 'x'.repeat(100000));
    assert.equal(r.status, 413);
    // Chunked (no content-length) body: rejected as soon as the limit is crossed.
    const r2 = await new Promise((resolve, reject) => {
      const rq = http.request({ host: '127.0.0.1', port, path: '/echo', method: 'POST' }, (res) => {
        res.resume(); res.on('end', () => resolve(res.statusCode));
      });
      rq.on('error', () => resolve(413)); // connection closed after 413 is acceptable
      rq.write('x'.repeat(64));
      setTimeout(() => rq.destroyed || rq.end(), 50);
    });
    assert.equal(r2, 413);
  }, { routeModules: [mod] });
});

test('createHub exposes db and world and closes cleanly', async () => {
  await withHub(async ({ hub }) => {
    assert.equal(typeof hub.db.upsertUser, 'function');
    assert.ok(hub.world.islands instanceof Map);
  });
});
