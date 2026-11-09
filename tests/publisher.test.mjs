import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startDevHub, devLogin, postDeviceForm } from './hub-helpers.mjs';

const require = createRequire(import.meta.url);
const { startPublisher, join, makeOpenBrowser, revokeSelf, fileLetterStore, parseRetryAfter } = require('../lib/publisher.js');
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

// Node's fetch throws TypeError('fetch failed') with the system code on cause, not on the error itself.
const refused = () => new TypeError('fetch failed', { cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) });

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

test('network errors back off up to 15 s and recover; failed send keeps its seq', async () => {
  const dir = tmp(); mkCfg(dir);
  let up = false;
  const r = rig(dir, (n) => { if (!up) { if (n % 2) throw new Error('boom'); return { status: 503, headers: { get: () => null } }; } return ok(); }, { v: snap(1) });
  await r.step();
  for (let i = 0; i < 400 && r.calls.length < 8; i++) await r.run(500);
  assert.equal(r.calls.length, 8);
  const gaps = r.calls.slice(1).map((c, i) => (c.t - r.calls[i].t) / 1000);
  const want = [2, 4, 8, 15, 15, 15, 15];
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
  assert.deepEqual({ ...r.pub.state(), instance: null }, { state: 'off', share: null, private: false, hub: null, deviceId: null, instance: null, lastOkAt: null, lastAttemptAt: null, lastErr: null, failures: 0, nextRetryAt: null, hubAck: null });
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
  assert.deepEqual(opened, ['https://hub.example/device?code=KHMT-BQXP']);
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

test('join reports a full hub clearly', async () => {
  for (const [error, re] of [['hub_full', /hub is full/], ['access_denied', /denied/]]) {
    const h = fakeHub((n, j) => j(403, { error }));
    await assert.rejects(join('https://hub.example', { dir: path.join(tmp(), 'c'), fetch: h.fetch, log() {}, openBrowser() {}, sleep: async () => {} }), re);
  }
});

test('join stops polling and writes nothing once shouldStop says so', async () => {
  const dir = path.join(tmp(), 'c');
  const h = fakeHub((n, j) => j(200, { token: 'trd_x', device_id: 'd', island_id: 'i' }));
  await assert.rejects(join('https://hub.example', { dir, fetch: h.fetch, log() {}, openBrowser() {}, sleep: async () => {}, shouldStop: () => true }), /cancelled/);
  assert.equal(readConfig(dir), null);
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

test('a bad salt in config.json does not crash the publisher: one log line, stays off', async () => {
  const dir = tmp(); mkCfg(dir, { salt: 'not-hex' });
  const r = rig(dir, ok, { v: snap(1) });
  await r.step();
  await r.run(5000);
  assert.equal(r.calls.length, 0);
  assert.equal(r.pub.state().state, 'off');
  assert.equal(r.logs.filter((l) => /salt/.test(l)).length, 1, 'logged once, not every tick');
  assert.ok(!r.logs.some((l) => /publisher error/.test(l)));
  // fixing the config brings it up without a restart
  mkCfg(dir);
  fs.utimesSync(path.join(dir, 'config.json'), new Date(), new Date(Date.now() + 9000));
  await r.run(3000);
  assert.equal(r.calls.length, 1);
  r.pub.stop();
});

test('join clamps the hub-provided interval to 1..60 s and expires_in to 1800 s', async () => {
  const run = async (start) => {
    const sleeps = [];
    const fetch = async (url) => {
      const j = (status, body) => ({ status, json: async () => body });
      if (url.endsWith('/api/device/start')) return j(200, { device_code: 'DC', user_code: 'AAAA-BBBB', verification_uri: 'https://hub.example/device', ...start });
      return j(428, {});
    };
    await assert.rejects(join('https://hub.example', { dir: path.join(tmp(), 'c'), fetch, log() {}, openBrowser() {}, sleep: async (ms) => { sleeps.push(ms); } }), /expired/);
    return sleeps;
  };
  for (const interval of [-1, 0, 0.001]) {
    const s = await run({ interval, expires_in: 10 });
    assert.ok(s.every((ms) => ms >= 1000), `interval ${interval}: ${s.slice(0, 3)}`);
  }
  assert.ok((await run({ interval: 'abc', expires_in: 10 })).every((ms) => ms === 5000), 'non-number -> 5');
  assert.ok((await run({ interval: 9999, expires_in: 10 })).every((ms) => ms === 60000), 'capped at 60');
  const big = await run({ interval: 60, expires_in: 1e9 });
  assert.ok(big.length <= 32, 'expires_in capped at 1800 s, got ' + big.length);
  const low = await run({ interval: 60, expires_in: 0 });
  assert.ok(low.length >= 10 && low.length <= 12, 'expires_in < 1 -> 600 s, got ' + low.length);
});

test('join strips control characters from hub-provided strings before printing', async () => {
  const logs = [];
  const fetch = async (url) => {
    const j = (status, body) => ({ status, json: async () => body });
    if (url.endsWith('/api/device/start')) return j(200, { device_code: 'DC', user_code: 'AB\x1b[2JCD\x07', verification_uri: 'https://hub.example/\x1b]0;pwn\x07device\x9b', expires_in: 600, interval: 5 });
    return j(200, { token: 'trd_x', device_id: 'd', island_id: 'i' });
  };
  await join('https://hub.example', { dir: path.join(tmp(), 'c'), fetch, log: (l) => logs.push(l), openBrowser() {}, sleep: async () => {} });
  const out = logs.join('\n');
  assert.ok(!/[\x00-\x09\x0b-\x1f\x7f-\x9f]/.test(out), 'no control chars (newlines from log joins excepted)');
  assert.match(out, /AB\[2JCD/);
});

const status = (s, body) => ({ status: s, headers: { get: () => null }, json: async () => body })

test('a 401 for an old token does not revoke a newer config', async () => {
  const dir = tmp(); mkCfg(dir)
  let release
  const gate = new Promise((r) => { release = r })
  const r = rig(dir, async (n) => { if (n === 1) { await gate; return status(401) } return ok() }, { v: snap(1) })
  const first = r.step()   // first send is held open
  await new Promise((res) => setImmediate(res))
  writeConfig(dir, { ...readConfig(dir), token: 'trd_newtoken5678' })
  release(); await first
  assert.equal(readConfig(dir).revoked, undefined)
  assert.notEqual(r.pub.state().state, 'revoked')
  await r.run(2500)
  assert.ok(r.calls.length >= 2)
  assert.equal(r.calls.at(-1).opts.headers.authorization, 'Bearer trd_newtoken5678')
  r.pub.stop()
})

test('403 login_required pauses without marking revoked', async () => {
  const dir = tmp(); mkCfg(dir)
  let phase = 'locked'
  const r = rig(dir, () => phase === 'locked' ? status(403, { error: 'login_required' }) : ok(), { v: snap(1) })
  await r.step()
  assert.equal(r.pub.state().state, 'paused')
  assert.equal(readConfig(dir).revoked, undefined)
  await r.run(59500)
  assert.equal(r.calls.length, 1, 'no resend before 60 s')
  phase = 'ok'
  await r.run(500)
  assert.equal(r.calls.length, 2)
  assert.equal(r.pub.state().state, 'sending')
  assert.equal(r.logs.filter((l) => /sign in/.test(l)).length, 1)
  assert.ok(r.logs.some((l) => l === 'terrarium: sign in to http://127.0.0.1:9 again to resume publishing'))
  r.pub.stop()
})

test('a 403 without login_required behaves like a server error', async () => {
  const dir = tmp(); mkCfg(dir)
  const r = rig(dir, () => status(403, { error: 'other' }), { v: snap(1) })
  await r.step()
  assert.equal(r.pub.state().state, 'offline')
  r.pub.stop()
})

const joinHub = (extra) => {
  const calls = []
  const fetch = async (url, opts) => {
    calls.push({ url, opts, fileExists: extra && extra.dir ? readConfig(extra.dir) : null })
    const j = (s, b) => ({ status: s, json: async () => b })
    if (url.endsWith('/api/device/start')) return j(200, { device_code: 'DC', user_code: 'KHMT-BQXP', verification_uri: 'https://hub.example/device', expires_in: 600, interval: 5 })
    if (url.endsWith('/api/device/token')) return j(200, { token: 'trd_new', device_id: 'dn', island_id: 'in' })
    return { status: 204 }
  }
  return { fetch, calls }
}

test('join revokes the previous token on the hub', async () => {
  const dir = tmp(); mkCfg(dir, { hub: 'https://old.example', token: 'trd_old' })
  const h = joinHub({ dir })
  await join('https://hub.example', { dir, fetch: h.fetch, log() {}, openBrowser() {}, sleep: async () => {} })
  const rev = h.calls.filter((c) => c.url.endsWith('/api/device/revoke-self'))
  assert.equal(rev.length, 1)
  assert.equal(rev[0].url, 'https://old.example/api/device/revoke-self')
  assert.equal(rev[0].opts.method, 'POST')
  assert.equal(rev[0].opts.headers.authorization, 'Bearer trd_old')
  assert.equal(rev[0].fileExists.token, 'trd_new', 'the new config was written before the old token was revoked')
  assert.equal(h.calls.at(-1), rev[0])
})

test('join with no previous config revokes nothing', async () => {
  const dir = tmp()
  const h = joinHub()
  await join('https://hub.example', { dir, fetch: h.fetch, log() {}, openBrowser() {}, sleep: async () => {} })
  assert.equal(h.calls.filter((c) => c.url.endsWith('/revoke-self')).length, 0)
  // a previously revoked config is not revoked again
  const dir2 = tmp(); mkCfg(dir2, { token: 'trd_old', revoked: true })
  const h2 = joinHub()
  await join('https://hub.example', { dir: dir2, fetch: h2.fetch, log() {}, openBrowser() {}, sleep: async () => {} })
  assert.equal(h2.calls.filter((c) => c.url.endsWith('/revoke-self')).length, 0)
})

test('revokeSelf says ok (2xx), gone (401) or failed (anything else), and never throws', async () => {
  const answer = (status) => async () => ({ status })
  assert.equal(await revokeSelf('https://hub.example', 'trd_x', { fetch: answer(200) }), 'ok')
  assert.equal(await revokeSelf('https://hub.example', 'trd_x', { fetch: answer(204) }), 'ok')
  assert.equal(await revokeSelf('https://hub.example', 'trd_x', { fetch: answer(401) }), 'gone')
  assert.equal(await revokeSelf('https://hub.example', 'trd_x', { fetch: answer(403) }), 'failed')
  assert.equal(await revokeSelf('https://hub.example', 'trd_x', { fetch: answer(500) }), 'failed')
  assert.equal(await revokeSelf('https://hub.example', 'trd_x', { fetch: async () => { throw new Error('offline') } }), 'failed')
  assert.equal(await revokeSelf('http://hub.example', 'trd_x', { fetch: answer(200) }), 'failed', 'invalid hub url')
  assert.equal(await revokeSelf('https://hub.example', '', { fetch: answer(200) }), 'failed', 'no token')
})

// --- publish reply contract (H4, L2, L12) ---
const ack = (body) => ({ status: 200, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) });
const reject = (status, text) => ({ status, headers: { get: () => null }, text: async () => text, json: async () => { throw new Error('not json'); } });

test('every publish carries the instance header; the body keys are unchanged', async () => {
  const dir = tmp(); mkCfg(dir);
  const ref = { v: snap(1) };
  const a = rig(dir, ok, ref), b = rig(dir, ok, ref);
  await a.step(); await b.step();
  ref.v = snap(2);
  await a.run(500);
  assert.equal(a.calls.length, 2);
  const ha = a.calls.map((c) => c.opts.headers['x-terrarium-instance']);
  const hb = b.calls[0].opts.headers['x-terrarium-instance'];
  assert.match(ha[0], /^[0-9a-f]{16}$/);
  assert.equal(ha[1], ha[0], 'same instance for every send of one publisher');
  assert.match(hb, /^[0-9a-f]{16}$/);
  assert.notEqual(hb, ha[0], 'two publishers have two instances');
  for (const c of [...a.calls, ...b.calls]) for (const k of Object.keys(c.body)) assert.ok(['v', 'seq', 'share', 'private', 'sessions'].includes(k), k);
  a.pub.stop(); b.pub.stop();
});

test('204 from an older hub counts as accepted', async () => {
  const dir = tmp(); mkCfg(dir);
  const ref = { v: snap(1) };
  const r = rig(dir, ok, ref);
  await r.step();
  assert.equal(r.pub.state().state, 'sending');
  await r.run(5000);
  assert.equal(r.calls.length, 1);
  ref.v = snap(2); await r.run(500);
  assert.equal(r.calls[1].body.seq, 1);
  r.pub.stop();
});

test('200 {accepted:true} counts as accepted; seq goes up', async () => {
  const dir = tmp(); mkCfg(dir);
  const ref = { v: snap(1) };
  const r = rig(dir, () => ack({ accepted: true }), ref);
  await r.step();
  assert.equal(r.pub.state().state, 'sending');
  await r.run(5000);
  assert.equal(r.calls.length, 1, 'accepted view is not resent');
  ref.v = snap(2); await r.run(500);
  assert.equal(r.calls.length, 2);
  assert.equal(r.calls[1].body.seq, 1);
  r.pub.stop();
});

test("200 {accepted:false, reason:'stale_seq', seq:41} resumes at 42", async () => {
  const dir = tmp(); mkCfg(dir);
  const r = rig(dir, (n) => n <= 2 ? ack({ accepted: false, reason: 'stale_seq', seq: 41 }) : ack({ accepted: true }), { v: snap(1) });
  await r.step();
  assert.equal(r.calls[0].body.seq, 0);
  await r.run(500);
  assert.equal(r.calls.length, 2, 'resent at the next tick');
  assert.equal(r.calls[1].body.seq, 42);
  await r.run(9500);
  assert.equal(r.calls.length, 2, 'a second stale_seq within 10 s does not resend at once');
  await r.run(500);
  assert.equal(r.calls.length, 3);
  assert.equal(r.calls[2].body.seq, 42);
  assert.equal(r.pub.state().state, 'sending');
  r.pub.stop();
});

test("200 {accepted:false, reason:'other_instance'} stands by and retries after 30 s", async () => {
  const dir = tmp(); mkCfg(dir);
  let owner = false;
  const r = rig(dir, () => owner ? ack({ accepted: true }) : ack({ accepted: false, reason: 'other_instance' }), { v: snap(1) });
  await r.step();
  assert.equal(r.pub.state().state, 'standby');
  assert.ok(r.logs.some((l) => /another Claude Office on this machine/.test(l)));
  const seq0 = r.calls[0].body.seq;
  await r.run(29500);
  assert.equal(r.calls.length, 1, 'nothing sent before 30 s');
  owner = true;
  await r.run(500);
  assert.equal(r.calls.length, 2, 'retried at 30 s');
  assert.equal(r.calls[1].t - r.calls[0].t, 30000);
  assert.equal(r.calls[1].body.seq, seq0, 'seq kept while standing by');
  assert.equal(r.pub.state().state, 'sending');
  r.pub.stop();
});

test('a 400 is not a success: rejected, logged with the reason, retried after 15 s, seq unchanged', async () => {
  const dir = tmp(); mkCfg(dir);
  let bad = true;
  const r = rig(dir, () => bad ? reject(400, 'bad packet: duplicate id') : ok(), { v: snap(1) });
  await r.step();
  assert.equal(r.pub.state().state, 'rejected');
  assert.ok(r.logs.some((l) => l.includes('terrarium: hub rejected the packet (400: duplicate id)')), r.logs.join('\n'));
  await r.run(14500);
  assert.equal(r.calls.length, 1, 'not resent before 15 s');
  await r.run(500);
  assert.equal(r.calls.length, 2, 'unchanged view is resent after 15 s');
  assert.equal(r.calls[1].body.seq, r.calls[0].body.seq);
  assert.equal(r.logs.filter((l) => /hub rejected the packet/.test(l)).length, 2, 'logged every time');
  bad = false;
  await r.run(15000);
  assert.equal(r.calls.length, 3);
  assert.equal(r.calls[2].body.seq, r.calls[0].body.seq);
  assert.equal(r.pub.state().state, 'sending');
  r.pub.stop();
});

test('a 413 is handled like a 400', async () => {
  const dir = tmp(); mkCfg(dir);
  const r = rig(dir, () => reject(413, 'payload too large'), { v: snap(1) });
  await r.step();
  assert.equal(r.pub.state().state, 'rejected');
  assert.ok(r.logs.some((l) => l.includes('terrarium: hub rejected the packet (413: payload too large)')), r.logs.join('\n'));
  await r.run(14500);
  assert.equal(r.calls.length, 1);
  await r.run(500);
  assert.equal(r.calls.length, 2);
  assert.equal(r.calls[1].body.seq, r.calls[0].body.seq);
  r.pub.stop();
});

// --- Task 10: stable room letters, quick recovery, safe leave (L7-L11) ---
const { createPublicView } = require('../lib/public-view.js');
const hang = (url, opts) => new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(opts.signal.reason)));
const projSnap = (projects) => ({ sessions: projects.map((p, i) => ({ id: 'id-' + i, project: p, status: 'working', updatedAt: 1 })) });
const deptsOf = (view, projects) => Object.fromEntries(view(projSnap(projects), { share: 'kin' }).sessions.map((s, i) => [projects[i], s.dept]));

test('room letters survive a restart of the server', () => {
  const dir = tmp();
  const a = deptsOf(createPublicView(SALT, { letters: fileLetterStore(dir) }), ['p1', 'p2', 'p3']);
  assert.deepEqual(a, { p1: 'A', p2: 'B', p3: 'C' });
  const b = deptsOf(createPublicView(SALT, { letters: fileLetterStore(dir) }), ['p3', 'p2', 'p1']);
  assert.deepEqual(b, a, 'a new process sees the projects in another order and keeps the letters');
});

test('two processes share the rooms file', () => {
  const dir = tmp();
  const one = fileLetterStore(dir), two = fileLetterStore(dir);
  assert.equal(two.get('aaaaaaaaaaaa'), undefined);
  assert.equal(one.assign('aaaaaaaaaaaa'), 'A');
  assert.equal(two.get('aaaaaaaaaaaa'), 'A', 'the second store rereads the changed file');
  assert.equal(two.assign('bbbbbbbbbbbb'), 'B', 'and does not hand out a taken letter');
  assert.equal(one.get('bbbbbbbbbbbb'), 'B');
});

test('a full rooms file reuses the oldest letter', () => {
  const dir = tmp();
  const clock = { t: 1_000_000 };
  const s = fileLetterStore(dir, { now: () => clock.t });
  const keys = Array.from({ length: 17 }, (_, i) => String(i).padStart(12, '0'));
  for (let i = 0; i < 16; i++) { clock.t += 1000; assert.equal(s.assign(keys[i]), 'ABCDEFGHIJKLMNOP'[i]); }
  clock.t += 120000;
  assert.equal(s.get(keys[0]), 'A', 'reading a letter refreshes its age');
  assert.equal(s.assign(keys[16]), 'B', 'the least recently seen room is reused');
  assert.equal(fileLetterStore(dir).get(keys[16]), 'B');
});

test('rooms.json is 0600 and holds no project name', () => {
  const dir = tmp();
  const view = createPublicView(SALT, { letters: fileLetterStore(dir) });
  view(projSnap(['secret-proj', 'other-secret']), { share: 'co-ban', projects: ['secret-proj'] });
  const file = path.join(dir, 'rooms.json');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  const raw = fs.readFileSync(file, 'utf8');
  assert.ok(!raw.includes('secret'), raw);
  const j = JSON.parse(raw);
  assert.equal(j.v, 1);
  assert.equal(Object.keys(j.rooms).length, 2);
  for (const [k, e] of Object.entries(j.rooms)) { assert.match(k, /^[0-9a-f]{12}$/); assert.match(e.letter, /^[A-P]$/); assert.equal(typeof e.at, 'number'); }
  // a broken file is treated as empty and written again
  fs.writeFileSync(file, '{not json');
  const s = fileLetterStore(dir);
  assert.equal(s.assign('cccccccccccc'), 'A');
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).rooms), ['cccccccccccc']);
  assert.ok(!fs.readdirSync(dir).some((f) => f !== 'rooms.json'), 'no temp file left behind');
});

test('the publisher keeps room letters in rooms.json', async () => {
  const dir = tmp(); mkCfg(dir);
  const r = rig(dir, ok, { v: snap(1) });
  await r.step();
  assert.equal(r.calls[0].body.sessions[0].dept, 'A');
  assert.ok(fs.existsSync(path.join(dir, 'rooms.json')));
  r.pub.stop();
});

test('a clock jump (sleep) resends at once and forgets the backoff', async () => {
  const dir = tmp(); mkCfg(dir);
  let up = false;
  const r = rig(dir, () => { if (!up) throw new Error('boom'); return ok(); }, { v: snap(1) });
  await r.step();
  for (let i = 0; i < 400 && r.calls.length < 5; i++) await r.run(500);
  assert.equal(r.calls.length, 5);
  r.clock.t += 20 * 60 * 1000;
  await r.step();
  assert.equal(r.calls.length, 6, 'sent on the first tick after waking');
  assert.ok(r.logs.includes('terrarium: woke up; resending'));
  await r.run(2500);
  assert.equal(r.calls.length, 7, 'the backoff starts again from 2 s');
  // an unchanged view that was already sent is sent again after a wake, before the heartbeat is due
  up = true;
  for (let i = 0; i < 100 && r.pub.state().state !== 'sending'; i++) await r.run(500);
  const n = r.calls.length;
  await r.run(5000);
  assert.equal(r.calls.length, n);
  r.clock.t += 11000;
  await r.step();
  assert.equal(r.calls.length, n + 1);
  r.pub.stop();
});

test('paused re-checks every 60 s', async () => {
  const dir = tmp(); mkCfg(dir);
  const r = rig(dir, () => status(403, { error: 'login_required' }), { v: snap(1) });
  await r.step();
  await r.run(180000);
  assert.deepEqual(r.calls.slice(1).map((c, i) => c.t - r.calls[i].t), [60000, 60000, 60000]);
  assert.equal(r.pub.state().state, 'paused');
  r.pub.stop();
});

test('Retry-After as an HTTP date is honoured; garbage means 1 s', async () => {
  const t = 1_000_000;
  assert.equal(parseRetryAfter('10', t), 10);
  assert.equal(parseRetryAfter('0', t), 1);
  assert.equal(parseRetryAfter('99999', t), 300);
  assert.equal(parseRetryAfter(new Date(t + 30000).toUTCString(), t), 30);
  assert.equal(parseRetryAfter(new Date(t - 30000).toUTCString(), t), 1);
  for (const bad of ['soon', '', null, undefined, '1.5e9x']) assert.equal(parseRetryAfter(bad, t), 1, String(bad));
  const dir = tmp(); mkCfg(dir);
  let hdr = null;
  const r = rig(dir, (n) => n === 1 ? { status: 429, headers: { get: (k) => k === 'retry-after' ? hdr : null } } : n === 2 ? { status: 429, headers: { get: () => 'garbage' } } : ok(), { v: snap(1) });
  hdr = new Date(r.clock.t + 20000).toUTCString();
  await r.step();
  await r.run(19500);
  assert.equal(r.calls.length, 1, 'waits until the date');
  await r.run(500);
  assert.equal(r.calls.length, 2);
  await r.run(500);
  assert.equal(r.calls.length, 2);
  await r.run(500);
  assert.equal(r.calls.length, 3, 'garbage waits 1 s');
  r.pub.stop();
});

test('429 logs once a minute', async () => {
  const dir = tmp(); mkCfg(dir);
  const r = rig(dir, () => ({ status: 429, headers: { get: () => '1' } }), { v: snap(1) });
  await r.step();
  await r.run(150000);
  assert.ok(r.calls.length > 100);
  assert.equal(r.logs.filter((l) => l === 'terrarium: the hub asked to slow down (429)').length, 3);
  r.pub.stop();
});

test('stale_seq resends at most once per window, and a negative seq is ignored', async () => {
  const dir = tmp(); mkCfg(dir);
  const r = rig(dir, () => ack({ accepted: false, reason: 'stale_seq', seq: 41 }), { v: snap(1) });
  await r.step();
  await r.run(60000);
  const gaps = r.calls.slice(2).map((c, i) => c.t - r.calls[i + 1].t);
  assert.ok(gaps.length >= 4 && gaps.every((g) => g >= 10000), gaps.join(','));
  r.pub.stop();
  const dir2 = tmp(); mkCfg(dir2);
  const r2 = rig(dir2, (n) => n === 1 ? ack({ accepted: false, reason: 'stale_seq', seq: -5 }) : ok(), { v: snap(1) });
  await r2.step();
  await r2.run(5000);
  assert.equal(r2.calls.length, 2);
  assert.equal(r2.calls[1].body.seq, 0, 'seq not moved to -4');
  r2.pub.stop();
});

test('a 400 does not count toward the network backoff', async () => {
  const dir = tmp(); mkCfg(dir);
  const r = rig(dir, (n) => { if (n === 1) return reject(400, 'bad packet: x'); throw new Error('boom'); }, { v: snap(1) });
  await r.step();
  await r.run(15000);
  assert.equal(r.calls.length, 2);
  await r.run(2500);
  assert.equal(r.calls.length, 3, 'first network retry after ~2 s, not 4 s');
  r.pub.stop();
});

test('join times out a hung hub instead of waiting forever', async () => {
  const dir = path.join(tmp(), 'c');
  await assert.rejects(join('https://hub.example', { dir, fetch: hang, fetchTimeoutMs: 30, log() {}, openBrowser() {}, sleep: async () => {} }), /did not answer/);
  assert.equal(readConfig(dir), null);
});

test('a hung token poll keeps polling until the code expires', async () => {
  const start = (url, j) => j(200, { device_code: 'DC', user_code: 'AAAA-BBBB', verification_uri: 'https://hub.example/device', expires_in: 10, interval: 5 });
  const j = (s, b) => ({ status: s, json: async () => b });
  let polls = 0;
  const f1 = async (url, opts) => { if (url.endsWith('/start')) return start(url, j); polls++; return polls === 1 ? hang(url, opts) : polls === 2 ? j(428, {}) : j(200, { token: 'trd_t', device_id: 'd', island_id: 'i' }); };
  const dir = path.join(tmp(), 'c');
  const cfg = await join('https://hub.example', { dir, fetch: f1, fetchTimeoutMs: 30, log() {}, openBrowser() {}, sleep: async () => {} });
  assert.equal(cfg.token, 'trd_t'); assert.equal(polls, 3);
  polls = 0;
  const f2 = async (url, opts) => { if (url.endsWith('/start')) return start(url, j); polls++; return hang(url, opts); };
  await assert.rejects(join('https://hub.example', { dir: path.join(tmp(), 'c'), fetch: f2, fetchTimeoutMs: 30, log() {}, openBrowser() {}, sleep: async () => {} }), /expired/);
  assert.ok(polls >= 3, 'polled more than once: ' + polls);
});

test('leave during an in-flight token poll: no config is written and the new token is revoked', async () => {
  const dir = path.join(tmp(), 'c');
  let stop = false;
  const calls = [];
  const j = (s, b) => ({ status: s, json: async () => b });
  const fetch = async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith('/api/device/start')) return j(200, { device_code: 'DC', user_code: 'AAAA-BBBB', verification_uri: 'https://hub.example/device', expires_in: 600, interval: 5 });
    if (url.endsWith('/api/device/token')) { stop = true; return j(200, { token: 'trd_fresh', device_id: 'd', island_id: 'i' }); }
    return { status: 204 };
  };
  await assert.rejects(join('https://hub.example', { dir, fetch, log() {}, openBrowser() {}, sleep: async () => {}, shouldStop: () => stop }), /cancelled/);
  assert.equal(fs.existsSync(path.join(dir, 'config.json')), false);
  const rev = calls.filter((c) => c.url === 'https://hub.example/api/device/revoke-self');
  assert.equal(rev.length, 1);
  assert.equal(rev[0].opts.headers.authorization, 'Bearer trd_fresh');
});

test('connecting until the first accepted send', async () => {
  const dir = tmp(); mkCfg(dir);
  let release;
  const r = rig(dir, () => new Promise((res) => { release = () => res(ok()); }), { v: snap(1) });
  assert.equal(r.pub.state().state, 'off');
  const first = r.step();
  assert.equal(r.pub.state().state, 'connecting', 'a first send in flight is still connecting');
  assert.ok(r.logs.some((l) => /connecting/.test(l)));
  release(); await first;
  assert.equal(r.pub.state().state, 'sending');
  r.pub.stop();
});

test('a 400 is rejected, with the reason, and kept apart from offline', async () => {
  const dir = tmp(); mkCfg(dir);
  const r = rig(dir, () => reject(400, 'bad packet: duplicate id'), { v: snap(1) });
  await r.step();
  const s = r.pub.state();
  assert.equal(s.state, 'rejected');
  assert.equal(s.lastErr.code, 'rejected:duplicate id');
  assert.equal(s.lastErr.reason, 'duplicate id');
  assert.equal(s.failures, 0, 'a rejection is not a network failure');
  assert.equal(s.nextRetryAt, r.clock.t + 15000);
  r.pub.stop();
});

test('lastOkAt, failures, lastErr and nextRetryAt follow the sends', async () => {
  const dir = tmp(); mkCfg(dir, { deviceId: 'ab12cd34ef567890' });
  let up = false;
  const r = rig(dir, () => { if (!up) { throw refused(); } return ok(); }, { v: snap(1) });
  let s = r.pub.state();
  assert.equal(s.lastOkAt, null); assert.equal(s.lastAttemptAt, null); assert.equal(s.lastErr, null); assert.equal(s.nextRetryAt, null);
  assert.equal(s.hubAck, null); assert.equal(s.failures, 0);
  await r.step();
  const t0 = r.clock.t;
  s = r.pub.state();
  assert.equal(s.state, 'offline');
  assert.equal(s.deviceId, 'ab12cd34ef567890');
  assert.match(s.instance, /^[0-9a-f]{16}$/);
  assert.deepEqual(s.lastErr, { code: 'network:ECONNREFUSED', at: t0 });
  assert.equal(s.failures, 1);
  assert.equal(s.lastAttemptAt, t0);
  assert.equal(s.nextRetryAt, t0 + 2000);
  assert.equal(s.lastOkAt, null);
  up = true;
  await r.run(2000);
  s = r.pub.state();
  assert.equal(s.state, 'sending');
  assert.equal(s.failures, 0);
  assert.equal(s.lastOkAt, r.clock.t);
  assert.equal(s.lastErr.code, 'network:ECONNREFUSED', 'the last error is kept after recovery');
  assert.equal(s.nextRetryAt, null);
  r.pub.stop();
});

test('lastErr codes: http, stale_seq, other_instance, login_required, rate_limited', async () => {
  const cases = [
    [() => ({ status: 503, headers: { get: () => null } }), 'http:503'],
    [() => ack({ accepted: false, reason: 'stale_seq', seq: 3 }), 'stale_seq'],
    [() => ack({ accepted: false, reason: 'other_instance' }), 'other_instance'],
    [() => status(403, { error: 'login_required' }), 'login_required'],
    [() => ({ status: 429, headers: { get: () => '5' } }), 'rate_limited'],
  ];
  for (const [h, code] of cases) {
    const dir = tmp(); mkCfg(dir);
    const r = rig(dir, h, { v: snap(1) });
    await r.step();
    assert.equal(r.pub.state().lastErr.code, code);
    r.pub.stop();
  }
});

test('hubAck is legacy against a 204 hub and json against a 200 hub', async () => {
  const d1 = tmp(); mkCfg(d1);
  const a = rig(d1, ok, { v: snap(1) });
  await a.step();
  assert.equal(a.pub.state().hubAck, 'legacy');
  a.pub.stop();
  const d2 = tmp(); mkCfg(d2);
  const b = rig(d2, () => ack({ accepted: true }), { v: snap(1) });
  await b.step();
  assert.equal(b.pub.state().hubAck, 'json');
  b.pub.stop();
});

test('a failing publisher logs one summary a minute, not one line per try', async () => {
  const dir = tmp(); mkCfg(dir);
  const r = rig(dir, () => { throw refused(); }, { v: snap(1) });
  await r.step();
  const before = r.logs.length;
  await r.run(59000);
  assert.equal(r.logs.length, before, 'quiet inside the first minute');
  await r.run(2000);
  const sum = r.logs.filter((l) => /still offline/.test(l));
  assert.equal(sum.length, 1);
  assert.match(sum[0], /^terrarium: still offline \(\d+ failures, network:ECONNREFUSED\); next try in \d+ s$/);
  await r.run(60000);
  assert.equal(r.logs.filter((l) => /still offline/.test(l)).length, 2);
  r.pub.stop();
});

test('a 200 that is not the hub\'s answer (a login page behind a proxy) is a failure, not a send', async () => {
  const dir = tmp(); mkCfg(dir);
  const html = { status: 200, headers: { get: () => 'text/html' }, json: async () => { throw new SyntaxError('html') }, text: async () => '<html>login</html>' };
  const r = rig(dir, () => html, { v: snap(1) });
  await r.step();
  const s = r.pub.state();
  assert.notEqual(s.state, 'sending');
  assert.equal(s.lastOkAt, null);
  assert.equal(s.lastErr.code, 'http:200');
  assert.equal(s.failures, 1);
});

test('publish requests never follow a redirect', async () => {
  const dir = tmp(); mkCfg(dir);
  let opts = null;
  const r = rig(dir, (n, call) => { opts = call.opts; return ack({ accepted: true }); }, { v: snap(1) });
  await r.step();
  assert.equal(opts && opts.redirect, 'manual');
});
