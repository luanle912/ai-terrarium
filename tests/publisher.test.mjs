import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startDevHub, devLogin, postDeviceForm } from './hub-helpers.mjs';

const require = createRequire(import.meta.url);
const { startPublisher, join, makeOpenBrowser } = require('../lib/publisher.js');
const { writeConfig, readConfig } = require('../lib/terrarium-config.js');

const SALT = 'ab'.repeat(32);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pub-test-'));
const snap = (n = 1, extra = {}) => ({
  at: 1, usage: { five_hour: 9 }, version: 'x',
  sessions: Array.from({ length: n }, (_, i) => ({ id: 'sess-' + i, name: 'n' + i, project: 'secret-proj', cwd: '/Users/me/secret', status: 'working', tool: 'Bash', parentId: null, updatedAt: 1, ...extra })),
});
function mkCfg(dir, over = {}) {
  writeConfig(dir, { hub: 'http://127.0.0.1:9', token: 'trd_secrettoken1234', deviceId: 'd', islandId: 'i', salt: SALT, share: 'kin', private: false, projects: [], ...over });
}
// Fake clock + manual timer: run(ms) advances time in 500 ms steps, flushing the pending tick each step.
function rig(dir, handler, snapshotRef) {
  const clock = { t: 1_000_000 };
  const calls = [], logs = [];
  let pending = null;
  const fetch = async (url, opts) => { calls.push({ t: clock.t, url, opts, body: JSON.parse(opts.body) }); return handler(calls.length, calls[calls.length - 1]); };
  const pub = startPublisher({
    getSnapshot: () => snapshotRef.v, dir, fetch, log: (l) => logs.push(l), now: () => clock.t,
    setTimer: (fn) => { pending = fn; return 1; }, clearTimer: () => { pending = null; }, random: () => 0.5,
  });
  const step = async () => { const fn = pending; pending = null; if (fn) await fn(); };
  const run = async (ms) => { for (let e = 0; e < ms; e += 500) { clock.t += 500; await step(); } };
  return { clock, calls, logs, pub, step, run };
}
const ok = () => ({ status: 204, headers: { get: () => null } });

test('sends only when the view changes, at most twice a second', async () => {
  const dir = tmp(); mkCfg(dir);
  const ref = { v: snap(1) };
  const r = rig(dir, ok, ref);
  await r.step();
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].body.seq, 0);
  assert.equal(r.calls[0].body.share, 'kin');
  assert.equal(r.calls[0].opts.headers.authorization, 'Bearer trd_secrettoken1234');
  await r.run(5000);
  assert.equal(r.calls.length, 1, 'unchanged view is not resent');
  ref.v = snap(2);
  await r.run(500);
  assert.equal(r.calls.length, 2);
  assert.equal(r.calls[1].body.seq, 1);
  ref.v = snap(3); await r.step(); // same instant: rate limited
  assert.equal(r.calls.length, 2);
  await r.run(500);
  assert.equal(r.calls.length, 3);
  r.pub.stop();
});

test('heartbeat every 30 s', async () => {
  const dir = tmp(); mkCfg(dir);
  const r = rig(dir, ok, { v: snap(1) });
  await r.step();
  await r.run(29500);
  assert.equal(r.calls.length, 1);
  await r.run(1000);
  assert.equal(r.calls.length, 2);
  assert.equal(r.calls[1].t - r.calls[0].t >= 30000, true);
  r.pub.stop();
});

test('401 marks revoked and stops', async () => {
  const dir = tmp(); mkCfg(dir);
  const r = rig(dir, () => ({ status: 401, headers: { get: () => null } }), { v: snap(1) });
  await r.step();
  assert.equal(r.pub.state().state, 'revoked');
  assert.equal(readConfig(dir).revoked, true);
  await r.run(60000);
  assert.equal(r.calls.length, 1);
  r.pub.stop();
  // already-revoked config never sends
  const dir2 = tmp(); mkCfg(dir2, { revoked: true });
  const r2 = rig(dir2, ok, { v: snap(1) });
  await r2.run(5000);
  assert.equal(r2.calls.length, 0);
  assert.equal(r2.pub.state().state, 'revoked');
  r2.pub.stop();
});

test('network errors back off up to 60 s and recover; failed send keeps its seq', async () => {
  const dir = tmp(); mkCfg(dir);
  let up = false;
  const r = rig(dir, (n) => { if (!up) { if (n % 2) throw new Error('boom'); return { status: 503, headers: { get: () => null } }; } return ok(); }, { v: snap(1) });
  await r.step();
  for (let i = 0; i < 400 && r.calls.length < 8; i++) await r.run(500);
  assert.equal(r.calls.length, 8);
  const gaps = r.calls.slice(1).map((c, i) => (c.t - r.calls[i].t) / 1000);
  const want = [2, 4, 8, 16, 32, 60, 60];
  gaps.forEach((g, i) => assert.ok(g >= want[i] * 0.8 - 0.01 && g <= want[i] * 1.2 + 0.5, `gap ${i}: ${g} vs ${want[i]}`));
  assert.ok(r.calls.every((c) => c.body.seq === 0), 'seq not advanced by failures');
  assert.equal(r.pub.state().state, 'offline');
  assert.ok(r.logs.filter((l) => /unreachable/.test(l)).length <= 1, 'one log line per state change');
  up = true;
  for (let i = 0; i < 400 && r.pub.state().state !== 'sending'; i++) await r.run(500);
  assert.equal(r.pub.state().state, 'sending');
  assert.equal(r.calls.at(-1).body.seq, 0);
  r.pub.stop();
});

test('429 waits for Retry-After', async () => {
  const dir = tmp(); mkCfg(dir);
  const r = rig(dir, (n) => n === 1 ? { status: 429, headers: { get: () => '10' } } : ok(), { v: snap(1) });
  await r.step();
  await r.run(9500);
  assert.equal(r.calls.length, 1);
  await r.run(1000);
  assert.equal(r.calls.length, 2);
  r.pub.stop();
});

test('private sends an empty island', async () => {
  const dir = tmp(); mkCfg(dir, { private: true });
  const r = rig(dir, ok, { v: snap(3) });
  await r.step();
  assert.deepEqual(r.calls[0].body, { v: 1, seq: 0, share: 'kin', private: true, sessions: [] });
  assert.equal(r.pub.state().state, 'private');
  r.pub.stop();
});

test('body never contains usage or cwd', async () => {
  const dir = tmp(); mkCfg(dir, { share: 'co-ban', projects: ['secret-proj'] });
  const r = rig(dir, ok, { v: snap(2) });
  await r.step();
  const raw = r.calls[0].opts.body;
  for (const bad of ['five_hour', 'usage', 'cwd', '/Users/me', 'sess-0', 'n0', 'trd_']) assert.ok(!raw.includes(bad), bad);
  assert.deepEqual(Object.keys(r.calls[0].body).sort(), ['seq', 'sessions', 'share', 'v']);
  r.pub.stop();
});

test('rereads config on change: private on applies without restart', async () => {
  const dir = tmp(); mkCfg(dir);
  const r = rig(dir, ok, { v: snap(2) });
  await r.step();
  assert.equal(r.calls[0].body.sessions.length, 2);
  mkCfg(dir, { private: true });
  fs.utimesSync(path.join(dir, 'config.json'), new Date(), new Date(Date.now() + 5000));
  await r.run(2500);
  assert.equal(r.calls.at(-1).body.private, true);
  r.pub.stop();
});

test('no config means off and nothing is sent', async () => {
  const r = rig(tmp(), ok, { v: snap(1) });
  await r.run(3000);
  assert.equal(r.calls.length, 0);
  assert.deepEqual(r.pub.state(), { state: 'off', share: null, private: false, hub: null });
  r.pub.stop();
});

test('join refuses http hubs that are not localhost', async () => {
  let called = false;
  await assert.rejects(join('http://example.com', { dir: tmp(), fetch: async () => { called = true; }, log() {} }), /https/);
  assert.equal(called, false);
});

function fakeHub(script) {
  const seen = [];
  const fetch = async (url, opts) => {
    seen.push(url);
    const j = (status, body) => ({ status, json: async () => body });
    if (url.endsWith('/api/device/start')) return j(200, { device_code: 'DC', user_code: 'KHMT-BQXP', verification_uri: 'https://hub.example/device', expires_in: 600, interval: 5 });
    return script(seen.filter((u) => u.endsWith('/token')).length, j);
  };
  return { fetch, seen };
}

test('join stores the token 0600 and prints only the code and link', async () => {
  const dir = path.join(tmp(), 'cfg');
  const logs = [], sleeps = [], opened = [];
  const h = fakeHub((n, j) => n === 1 ? j(428, { error: 'authorization_pending' }) : n === 2 ? j(429, { error: 'slow_down' }) : j(200, { token: 'trd_SECRETSECRET', device_id: 'dev1', island_id: 'isl1' }));
  const cfg = await join('https://hub.example/', { name: 'Laptop', dir, fetch: h.fetch, log: (l) => logs.push(l), openBrowser: (u) => opened.push(u), sleep: async (ms) => { sleeps.push(ms); } });
  assert.deepEqual(sleeps, [5000, 5000, 10000]);
  assert.deepEqual(opened, ['https://hub.example/device']);
  assert.ok(!opened[0].includes('KHMT'), 'link carries no code');
  const out = logs.join('\n');
  assert.match(out, /KHMT-BQXP/); assert.match(out, /hub\.example\/device/);
  assert.ok(!out.includes('trd_') && !out.includes('SECRETSECRET'));
  assert.equal(fs.statSync(path.join(dir, 'config.json')).mode & 0o777, 0o600);
  const saved = readConfig(dir);
  assert.deepEqual(saved, cfg);
  assert.equal(saved.token, 'trd_SECRETSECRET'); assert.equal(saved.hub, 'https://hub.example');
  assert.equal(saved.deviceId, 'dev1'); assert.equal(saved.islandId, 'isl1');
  assert.match(saved.salt, /^[0-9a-f]{64}$/);
  assert.equal(saved.share, 'kin'); assert.equal(saved.private, false); assert.deepEqual(saved.projects, []);
});

test('join reports expired, denied', async () => {
  for (const [status, re] of [[410, /expired/], [403, /denied/]]) {
    const dir = path.join(tmp(), 'c');
    const h = fakeHub((n, j) => j(status, { error: 'x' }));
    await assert.rejects(join('https://hub.example', { dir, fetch: h.fetch, log() {}, openBrowser() {}, sleep: async () => {} }), re);
    assert.equal(readConfig(dir), null);
  }
});

test('integration: join + approve + publisher shows up in the viewer stream', async () => {
  const h = await startDevHub();
  const dir = path.join(tmp(), 'cfg');
  let pub;
  const ac = new AbortController();
  try {
    const login = await devLogin(h.url, 'ann@newera.inc', 'Ann');
    const logs = [];
    const joined = join(h.url, {
      name: 'Test', dir, log: (l) => logs.push(l), openBrowser() {}, sleep: async () => { await new Promise((r) => setTimeout(r, 20)); },
    });
    let code;
    for (let i = 0; i < 100 && !code; i++) { await new Promise((r) => setTimeout(r, 20)); code = logs.map((l) => /([BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4})/.exec(l)).find(Boolean); }
    assert.ok(code, 'code printed');
    assert.equal((await postDeviceForm(h.url, login, { user_code: code[1], action: 'approve' })).status, 200);
    const cfg = await joined;
    assert.equal(cfg.hub, h.url);

    const r = await fetch(h.url + '/api/world/stream', { headers: { cookie: login.cookie }, signal: ac.signal });
    const events = []; let buf = '';
    const dec = new TextDecoder(); const reader = r.body.getReader();
    (async () => { try { for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n\n')) >= 0) { const b = buf.slice(0, i); buf = buf.slice(i + 2); const ev = /^event: (.+)$/m.exec(b), d = /^data: (.+)$/m.exec(b); if (ev && d) events.push({ event: ev[1], data: JSON.parse(d[1]) }); } } } catch {} })();

    pub = startPublisher({ getSnapshot: () => snap(3), dir, log() {} });
    let got;
    for (let i = 0; i < 100 && !got; i++) { await new Promise((r) => setTimeout(r, 50)); got = events.find((e) => e.event === 'island' && e.data.sessions.length === 3); }
    assert.ok(got, 'viewer sees 3 sessions');
    assert.equal(got.data.id, cfg.islandId);
    assert.equal(pub.state().state, 'sending');
  } finally {
    if (pub) pub.stop();
    ac.abort();
    await h.close();
  }
});

test('join opens only same-origin verification links', async () => {
  for (const [uri, expectOpen] of [['https://evil.example/device', false], ['https://hub.example/device?x&calc', true], ['not a url', false]]) {
    const opened = [];
    const h = fakeHub((n, j) => j(200, { token: 'trd_x', device_id: 'd', island_id: 'i' }));
    const f = async (url, o) => { const r = await h.fetch(url, o); if (url.endsWith('/start')) { const b = await r.json(); b.verification_uri = uri; return { status: 200, json: async () => b }; } return r; };
    await join('https://hub.example', { dir: path.join(tmp(), 'c'), fetch: f, log() {}, openBrowser: (u) => opened.push(u), sleep: async () => {} });
    assert.equal(opened.length, expectOpen ? 1 : 0, uri);
  }
});

test('default openBrowser: no shell, refuses metacharacters', () => {
  const run = (platform, url) => { const calls = []; const ok = makeOpenBrowser({ platform, spawn: (c, a) => { calls.push([c, a]); return { on() {}, unref() {} }; } })(url); return { ok, calls }; };
  let r = run('win32', 'https://hub.example/device?x&calc');
  assert.equal(r.ok, false); assert.equal(r.calls.length, 0);
  for (const bad of ['https://h/a|b', 'https://h/a^b', 'https://h/a"b', 'https://h/%41', 'https://h/a b', 'file:///etc/passwd']) assert.equal(run('win32', bad).ok, false, bad);
  r = run('win32', 'https://hub.example/device');
  assert.deepEqual(r.calls, [['rundll32', ['url.dll,FileProtocolHandler', 'https://hub.example/device']]]);
  assert.deepEqual(run('darwin', 'https://hub.example/device').calls, [['open', ['https://hub.example/device']]]);
  assert.deepEqual(run('linux', 'https://hub.example/device').calls, [['xdg-open', ['https://hub.example/device']]]);
});
