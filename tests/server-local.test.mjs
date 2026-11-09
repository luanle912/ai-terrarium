import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { hostAllowed, corsOrigin, createHandler, listenWithRetry } = require('../server.js');
import { moduleGraph } from './web.mjs';

function listen(server, port = 0) {
  return new Promise(r => server.listen(port, '127.0.0.1', () => r(server.address().port)));
}
function close(server) { return new Promise(r => { server.close(() => r()); server.closeAllConnections?.(); }); }
function request(port, { method = 'GET', path = '/', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, res => {
      let body = ''; res.setEncoding('utf8');
      res.on('data', c => body += c); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject); req.end();
  });
}

test('hostAllowed accepts loopback names on the port only', () => {
  for (const h of ['localhost:4317', '127.0.0.1:4317', '[::1]:4317']) assert.equal(hostAllowed(h, 4317, []), true, h);
  for (const h of ['evil.example:4317', 'localhost:9999', undefined]) assert.equal(hostAllowed(h, 4317, []), false, String(h));
  assert.equal(hostAllowed('my-mac.local:4317', 4317, ['my-mac.local:4317']), true);
});

test('corsOrigin only echoes the configured origin', () => {
  assert.equal(corsOrigin('http://localhost:3000', ''), null);
  assert.equal(corsOrigin('https://x.dev', 'https://x.dev'), 'https://x.dev');
});

test('handler rejects foreign hosts, unknown paths and non-GET methods', async () => {
  const server = http.createServer();
  const port = await listen(server);
  server.on('request', createHandler({ snapshot: () => ({ sessions: [] }), scan: () => {}, htmlFile: '/nonexistent.html', port, allowedHosts: [], allowedOrigin: '' }));
  try {
    assert.equal((await request(port, { path: '/snapshot', headers: { Host: 'evil.example' } })).status, 403);
    assert.equal((await request(port, { path: '/nope' })).status, 404);
    assert.equal((await request(port, { method: 'POST', path: '/snapshot' })).status, 405);
    const ok = await request(port, { path: '/snapshot', headers: { Origin: 'http://localhost:3000' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers['access-control-allow-origin'], undefined);
    assert.deepEqual(JSON.parse((await request(port, { path: '/api/public-preview' })).body), { state: 'off' });
  } finally { await close(server); }
});

test('the page and every web/ file it loads are served, never cached stale, and nothing outside web/', async () => {
  const server = http.createServer();
  const port = await listen(server);
  server.on('request', createHandler({ snapshot: () => ({ sessions: [] }), scan: () => {}, port, allowedHosts: [], allowedOrigin: '' }));
  try {
    const page = await request(port, { path: '/' });
    assert.equal(page.status, 200);
    assert.equal(page.headers['cache-control'], 'no-cache');
    assert.match(page.body, /<script type="module" src="web\/main\.js"><\/script>/);
    const assets = ['/web/styles.css', ...moduleGraph().map(n => `/web/${n}.js`)];
    assert.ok(assets.length > 30);
    for (const a of assets) {
      const r = await request(port, { path: a });
      assert.equal(r.status, 200, a);
      assert.equal(r.headers['cache-control'], 'no-cache');
      assert.match(r.headers['content-type'], a.endsWith('.css') ? /^text\/css/ : /^text\/javascript/);
    }
    for (const bad of ['/web/../server.js', '/web/%2e%2e/server.js', '/web/i18n/../../server.js', '/web/x.html', '/web/a/b/c.js', '/web/nope.js']) {
      assert.equal((await request(port, { path: bad })).status, 404, bad);
    }
  } finally { await close(server); }
});

test('POST /api/join only answers this page: own Origin and the X-Terrarium header', async () => {
  const server = http.createServer();
  const port = await listen(server);
  let starts = 0;
  const joinFlow = { start: async () => { starts++; return { phase: 'pending', code: 'KHMT-BQXP', url: 'https://hub.example/device?code=KHMT-BQXP' }; }, status: () => ({ phase: 'idle' }) };
  server.on('request', createHandler({ snapshot: () => ({ sessions: [] }), scan: () => {}, htmlFile: '/nonexistent.html', port, allowedHosts: [], allowedOrigin: 'https://evil.example', joinFlow }));
  const post = (headers) => request(port, { method: 'POST', path: '/api/join', headers });
  try {
    assert.equal((await post({ Origin: 'https://evil.example', 'X-Terrarium': 'join' })).status, 403, 'even the CORS-allowed origin may not pair');
    assert.equal((await post({ Origin: `http://localhost:${port}` })).status, 403, 'header missing');
    assert.equal((await post({ Origin: 'http://localhost:1', 'X-Terrarium': 'join' })).status, 403, 'other port');
    assert.equal((await request(port, { method: 'OPTIONS', path: '/api/join', headers: { Origin: 'https://evil.example' } })).status, 405, 'no preflight answer');
    assert.equal(starts, 0);
    const ok = await post({ Origin: `http://localhost:${port}`, 'X-Terrarium': 'join' });
    assert.equal(ok.status, 200);
    assert.deepEqual(JSON.parse(ok.body), { phase: 'pending', code: 'KHMT-BQXP', url: 'https://hub.example/device?code=KHMT-BQXP' });
    assert.equal(starts, 1);
    assert.deepEqual(JSON.parse((await request(port, { path: '/api/join' })).body), { phase: 'idle' });
  } finally { await close(server); }
});

test('makeJoinFlow: pending, reuse while pending, joined, already joined, error', async () => {
  const { makeJoinFlow } = require('../server.js');
  let t = 1000, cfg = null, finish, fail;
  const opened = [], calls = [];
  const join = (hub, o) => new Promise((res, rej) => { calls.push(hub); o.onStart({ userCode: 'KHMT-BQXP', url: hub + '/device?code=KHMT-BQXP', expiresIn: 600 }); finish = res; fail = rej; });
  const flow = makeJoinFlow({ join, readCfg: () => cfg, openBrowser: u => opened.push(u), hub: 'https://hub.example', name: 'Mac', now: () => t });
  assert.deepEqual(await flow.start(), { phase: 'pending', code: 'KHMT-BQXP', url: 'https://hub.example/device?code=KHMT-BQXP', expiresAt: 601000 });
  assert.equal((await flow.start()).code, 'KHMT-BQXP');
  assert.equal(calls.length, 1, 'a second click reuses the pending code');
  finish({}); await new Promise(r => setImmediate(r));
  assert.deepEqual(flow.status(), { phase: 'joined', hub: 'https://hub.example' });
  cfg = { hub: 'https://hub.example', token: 'trd_x' };
  assert.deepEqual(await flow.start(), { phase: 'joined', hub: 'https://hub.example' });
  assert.deepEqual(opened, ['https://hub.example'], 'already joined: just open the world');
  cfg = { hub: 'https://hub.example', token: 'trd_x', revoked: true };
  await flow.start();
  assert.equal(calls.length, 2, 'a revoked device pairs again');
  fail(new Error('pairing was denied')); await new Promise(r => setImmediate(r));
  assert.deepEqual(flow.status(), { phase: 'error', error: 'pairing was denied' });
});

test('makeJoinFlow.leave cancels a pending join and the old attempt cannot write back', async () => {
  const { makeJoinFlow } = require('../server.js');
  let stop, finish;
  const join = (hub, o) => new Promise((res) => { stop = o.shouldStop; o.onStart({ userCode: 'AAAA-BBBB', url: null, expiresIn: 600 }); finish = res; });
  const leaves = [];
  const flow = makeJoinFlow({ join, leave: async (log) => { leaves.push(1); log('Left the hub. Local config removed.'); return 0; }, readCfg: () => null, openBrowser() {}, hub: 'https://hub.example', name: 'Mac' });
  assert.equal((await flow.start()).phase, 'pending');
  assert.deepEqual(await flow.leave(), { phase: 'left' });
  assert.equal(stop(), true, 'the polling loop is told to stop');
  finish({}); await new Promise(r => setImmediate(r));
  assert.deepEqual(flow.status(), { phase: 'idle' }, 'a late success of the cancelled join is ignored');
  assert.equal(leaves.length, 1);
  const flow2 = makeJoinFlow({ join, leave: async (log) => { log('Could not reach the hub; revoke this device at https://hub.example/me.'); log('Left the hub. Local config removed.'); return 0; }, readCfg: () => null, openBrowser() {}, hub: 'https://hub.example', name: 'Mac' });
  assert.deepEqual(await flow2.leave(), { phase: 'left', warn: 'hub_unreachable' });
});

test('makeJoinFlow: a start that never reaches pending turns into an error after 60 s', async () => {
  const { makeJoinFlow } = require('../server.js');
  let t = 1000, stop, finish, starts = 0;
  const join = (hub, o) => new Promise((res) => { starts++; stop = o.shouldStop; finish = () => { o.onStart({ userCode: 'AAAA-BBBB', url: null, expiresIn: 600 }); res({}); }; });
  const flow = makeJoinFlow({ join, readCfg: () => null, openBrowser() {}, hub: 'https://hub.example', name: 'Mac', now: () => t });
  flow.start();
  assert.deepEqual(flow.status(), { phase: 'starting', startedAt: 1000 });
  t += 60000;
  assert.equal(flow.status().phase, 'starting', 'not yet: exactly 60 s');
  t += 1;
  assert.deepEqual(flow.status(), { phase: 'error', error: 'hub_timeout' });
  assert.equal(stop(), true, 'the hung join is told to stop');
  finish(); await new Promise(r => setImmediate(r));
  assert.deepEqual(flow.status(), { phase: 'error', error: 'hub_timeout' }, 'a late answer cannot overwrite the error');
  flow.start();
  assert.equal(starts, 2, 'a new click starts again');
});

test('makeJoinFlow.leave while starting: the attempt is stopped before leave awaits anything', async () => {
  const { makeJoinFlow } = require('../server.js');
  let stop, finish, seenByLeave;
  const join = (hub, o) => new Promise((res) => { stop = o.shouldStop; finish = res; });
  const flow = makeJoinFlow({ join, leave: async () => { seenByLeave = stop(); return 0; }, readCfg: () => null, openBrowser() {}, hub: 'https://hub.example', name: 'Mac' });
  flow.start();
  assert.equal(flow.status().phase, 'starting');
  const p = flow.leave();
  assert.equal(stop(), true, 'stopped synchronously');
  assert.deepEqual(flow.status(), { phase: 'idle' });
  assert.deepEqual(await p, { phase: 'left' });
  assert.equal(seenByLeave, true);
  finish({}); await new Promise(r => setImmediate(r));
  assert.deepEqual(flow.status(), { phase: 'idle' });
});

test('POST /api/leave needs X-Terrarium: leave from this page', async () => {
  const server = http.createServer();
  const port = await listen(server);
  let left = 0;
  const joinFlow = { start: async () => ({}), leave: async () => { left++; return { phase: 'left' }; }, status: () => ({ phase: 'idle' }) };
  server.on('request', createHandler({ snapshot: () => ({ sessions: [] }), scan: () => {}, htmlFile: '/nonexistent.html', port, allowedHosts: [], allowedOrigin: '', joinFlow }));
  const post = (headers) => request(port, { method: 'POST', path: '/api/leave', headers });
  try {
    assert.equal((await post({ Origin: `http://localhost:${port}`, 'X-Terrarium': 'join' })).status, 403, 'the join header does not leave');
    assert.equal((await post({ Origin: 'https://evil.example', 'X-Terrarium': 'leave' })).status, 403);
    assert.equal(left, 0);
    const ok = await post({ Origin: `http://127.0.0.1:${port}`, 'X-Terrarium': 'leave' });
    assert.equal(ok.status, 200); assert.equal(left, 1);
  } finally { await close(server); }
});

test('a second server waits for the port and takes over', async () => {
  const a = http.createServer(), b = http.createServer();
  const x = await listen(a);
  const logs = [];
  const started = listenWithRetry(b, x, '127.0.0.1', { retryMs: 50, log: m => logs.push(m) });
  await new Promise(r => setTimeout(r, 200));
  assert.equal(b.listening, false);
  await close(a);
  await Promise.race([started, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 500))]);
  assert.equal(b.listening, true);
  assert.equal(b.address().port, x);
  assert.equal(logs.length, 1, 'logs the busy port once');
  await close(b);
});

test('preview works before joining', () => {
  const { makePublicPreview } = require('../server.js');
  const snapshot = { at: 1, usage: {}, version: 'x', sessions: [{ id: 'real-session-1', name: 'my-secret-name', project: 'secret-proj', cwd: '/Users/me/secret', status: 'working', tool: 'Bash', parentId: null, updatedAt: 1 }] };
  const salt = 'cd'.repeat(32);
  const preview = makePublicPreview({ publisher: null, getSnapshot: () => snapshot, salt });
  const a = preview(), b = preview();
  assert.equal(a.state, 'off');
  assert.match(a.view.sessions[0].id, /^[0-9a-f]{12}$/);
  const json = JSON.stringify(a);
  assert.ok(!json.includes('cwd') && !json.includes('my-secret-name') && !json.includes('secret-proj'));
  assert.equal(b.view.sessions[0].id, a.view.sessions[0].id);
  // a publisher without a view falls back to the preview view but keeps its own state
  const p2 = makePublicPreview({ publisher: { state: () => ({ state: 'offline' }), view: () => null }, getSnapshot: () => snapshot, salt })();
  assert.equal(p2.state, 'offline'); assert.ok(p2.view);
  const mine = { sessions: [] };
  const p3 = makePublicPreview({ publisher: { state: () => ({ state: 'sending', share: 'kin' }), view: () => mine }, getSnapshot: () => snapshot, salt })();
  assert.equal(p3.view, mine); assert.equal(p3.share, 'kin');
});

// ---------- animals (spec 8) ----------

const UUID_A = 'aaaaaaaa-0000-4000-8000-000000000001', UUID_B = 'bbbbbbbb-0000-4000-8000-000000000002';

function sendBody(port, { method = 'POST', path, headers = {}, body, chunks }) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const h = { ...headers };
    if (data !== null && !chunks) h['Content-Length'] = Buffer.byteLength(data);
    const req = http.request({ host: '127.0.0.1', port, method, path, headers: h }, res => {
      let out = ''; res.setEncoding('utf8');
      res.on('data', c => out += c); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: out }));
    });
    req.on('error', reject);
    if (chunks) for (const c of chunks) req.write(c); else if (data !== null) req.write(data);
    req.end();
  });
}

function fakeEngine({ view = { caught: [], wild: null, notice: null }, act } = {}) {
  const calls = [], subs = new Set();
  return {
    calls, subs, current: view,
    view() { return this.current; },
    act(a) { calls.push(['act', a]); return act ? act(a) : { status: 200, body: { did: a.type } }; },
    report(b) { calls.push(['report', b]); return { status: 200, body: { ok: true } }; },
    devAct(b) { calls.push(['dev', b]); return { status: 200, body: { dev: true } }; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

async function animalServer(opts = {}) {
  const server = http.createServer();
  const port = await listen(server);
  const clock = { t: 1000 };
  server.on('request', createHandler({ snapshot: () => ({ sessions: [] }), scan: () => {}, htmlFile: '/nonexistent.html', port, allowedHosts: [], allowedOrigin: '', now: () => clock.t, ...opts }));
  const own = { Origin: `http://localhost:${port}`, 'X-Terrarium': 'animals' };
  return { server, port, clock, own, post: (name, body, headers = own) => sendBody(port, { path: '/api/animals/' + name, headers, body }) };
}

test('animals: 404 everywhere without an engine', async () => {
  const { server, port, own } = await animalServer();
  try {
    assert.equal((await request(port, { path: '/api/animals' })).status, 404);
    assert.equal((await request(port, { path: '/api/animals/events' })).status, 404);
    assert.equal((await sendBody(port, { path: '/api/animals/catch', headers: own, body: { wildId: 'abc123' } })).status, 404);
  } finally { await close(server); }
});

test('GET /api/animals returns the view; a disabled engine answers 503', async () => {
  const animals = fakeEngine({ view: { caught: [], wild: { id: 'abc123', species: 'fox' }, notice: null } });
  const { server, port } = await animalServer({ animals });
  try {
    const ok = await request(port, { path: '/api/animals' });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers['cache-control'], 'no-store');
    assert.equal(ok.headers['access-control-allow-origin'], undefined);
    assert.equal(JSON.parse(ok.body).wild.species, 'fox');
    animals.current = { disabled: true, error: 'key-missing' };
    const off = await request(port, { path: '/api/animals' });
    assert.equal(off.status, 503);
    assert.deepEqual(JSON.parse(off.body), { disabled: true, error: 'key-missing' });
    assert.equal((await request(port, { path: '/api/animals', headers: { Host: 'evil.example' } })).status, 403);
    assert.equal((await request(port, { path: '/api/animalsX' })).status, 404);
  } finally { await close(server); }
});

test('POST /api/animals/*: host, header, origin, size and JSON guards; nothing reaches the engine', async () => {
  const animals = fakeEngine();
  const { server, port, own, post } = await animalServer({ animals });
  try {
    assert.equal((await sendBody(port, { path: '/api/animals/catch', headers: { ...own, Host: 'evil.example' }, body: {} })).status, 403);
    assert.equal((await post('catch', { wildId: 'abc123' }, { Origin: own.Origin })).status, 403, 'header missing');
    assert.equal((await post('catch', { wildId: 'abc123' }, { ...own, 'X-Terrarium': 'join' })).status, 403, 'join header');
    assert.equal((await post('catch', { wildId: 'abc123' }, { ...own, Origin: 'https://evil.example' })).status, 403, 'foreign origin');
    assert.equal((await post('catch', { wildId: 'x'.repeat(2000) })).status, 413, 'content-length over 1 KB');
    const chunked = await sendBody(port, { path: '/api/animals/catch', headers: own, chunks: ['{"wildId":"', 'y'.repeat(1500), '"}'] });
    assert.equal(chunked.status, 413, 'chunked body over 1 KB');
    assert.equal((await post('catch', '{nope')).status, 400);
    assert.equal((await post('catch', '[1,2]')).status, 400);
    assert.equal((await post('catch', '')).status, 400);
    assert.deepEqual(animals.calls, []);
    assert.equal((await post('catch', { wildId: 'abc123' }, { 'X-Terrarium': 'animals' })).status, 200, 'no Origin (curl) passes like /api/join');
  } finally { await close(server); }
});

test('POST routes: method, unknown paths, route type wins, engine errors map through', async () => {
  const animals = fakeEngine({ act: a => a.wildId === 'bad' ? { status: 400, body: { error: 'wrong_wild' } } : { status: 200, body: { did: a.type } } });
  const { server, port, clock, post } = await animalServer({ animals });
  try {
    assert.equal((await request(port, { path: '/api/animals/catch' })).status, 405);
    assert.equal((await request(port, { method: 'POST', path: '/api/animals' })).status, 405);
    assert.equal((await post('teleport', {})).status, 404);
    assert.equal((await post('dev', { spawn: 'dragon' })).status, 404, 'dev route is off by default');
    const bad = await post('catch', { wildId: 'bad' });
    assert.equal(bad.status, 400);
    assert.deepEqual(JSON.parse(bad.body), { error: 'wrong_wild' });
    for (const name of ['catch', 'giveup', 'release', 'recall', 'free', 'resolve']) {
      clock.t += 1000;
      const r = await post(name, { type: 'free', id: '000001' });
      assert.equal(r.status, 200, name);
      assert.deepEqual(JSON.parse(r.body), { did: name });
    }
    assert.equal((await post('env', { weather: 'rain', visible: true })).status, 200);
    assert.deepEqual(animals.calls.at(-1), ['report', { weather: 'rain', visible: true }]);
  } finally { await close(server); }
});

test('engine exceptions become 500', async () => {
  const animals = fakeEngine({ act: () => { throw new Error('boom'); } });
  const { server, post } = await animalServer({ animals });
  try { assert.equal((await post('catch', { wildId: 'abc123' })).status, 500); } finally { await close(server); }
});

test('dev route only with animalsDev', async () => {
  const animals = fakeEngine();
  const { server, post } = await animalServer({ animals, animalsDev: true });
  try {
    const r = await post('dev', { spawn: 'dragon' });
    assert.equal(r.status, 200);
    assert.deepEqual(animals.calls.at(-1), ['dev', { spawn: 'dragon' }]);
  } finally { await close(server); }
});

test('rate limit: 5 actions/s, counted only after the guards', async () => {
  const animals = fakeEngine();
  const { server, clock, own, post } = await animalServer({ animals });
  try {
    for (let i = 0; i < 10; i++) assert.equal((await post('catch', { wildId: 'a' }, { Origin: own.Origin })).status, 403);
    for (let i = 0; i < 5; i++) assert.equal((await post('catch', { wildId: 'x'.repeat(2000) })).status, 413);
    for (let i = 0; i < 5; i++) assert.equal((await post('catch', '{bad')).status, 400);
    for (let i = 0; i < 5; i++) assert.equal((await post('release', { id: '000001' })).status, 200, 'call ' + i);
    const limited = await post('release', { id: '000001' });
    assert.equal(limited.status, 429);
    assert.equal(animals.calls.length, 5);
    clock.t += 200;
    assert.equal((await post('release', { id: '000001' })).status, 200, 'one token back after 200 ms');
    assert.equal((await post('release', { id: '000001' })).status, 429);
  } finally { await close(server); }
});

test('rate limit: env has its own bucket (burst 2, one per 10 s)', async () => {
  const animals = fakeEngine();
  const { server, clock, post } = await animalServer({ animals });
  const env = { weather: 'clear', visible: true };
  try {
    assert.equal((await post('env', env)).status, 200);
    assert.equal((await post('env', env)).status, 200);
    assert.equal((await post('env', env)).status, 429);
    assert.equal((await post('catch', { wildId: 'abc123' })).status, 200, 'actions are not affected');
    clock.t += 9000;
    assert.equal((await post('env', env)).status, 429);
    clock.t += 1000;
    assert.equal((await post('env', env)).status, 200);
  } finally { await close(server); }
});

function openStream(port, path = '/api/animals/events') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path }, res => {
      const msgs = []; let buf = '';
      res.setEncoding('utf8');
      res.on('data', c => { buf += c; let i; while ((i = buf.indexOf('\n\n')) >= 0) { msgs.push(JSON.parse(buf.slice(0, i).replace(/^data: /, ''))); buf = buf.slice(i + 2); } });
      resolve({ res, msgs, close: () => req.destroy() });
    });
    req.on('error', () => {}); req.on('error', reject); req.end();
  });
}
const until = async (cond, ms = 1000) => { const end = Date.now() + ms; while (!cond()) { if (Date.now() > end) throw new Error('timeout'); await new Promise(r => setTimeout(r, 5)); } };

test('GET /api/animals/events streams the view and engine broadcasts; unsubscribes on close', async () => {
  const animals = fakeEngine({ view: { caught: [], wild: null, notice: null } });
  const { server, port } = await animalServer({ animals });
  try {
    const s = await openStream(port);
    assert.equal(s.res.statusCode, 200);
    assert.equal(s.res.headers['content-type'], 'text/event-stream');
    await until(() => s.msgs.length === 1);
    assert.deepEqual(s.msgs[0], { caught: [], wild: null, notice: null, events: [] });
    assert.equal(animals.subs.size, 1);
    for (const fn of animals.subs) fn({ caught: [], wild: { id: 'abc123' }, events: [{ type: 'spawn' }] });
    await until(() => s.msgs.length === 2);
    assert.equal(s.msgs[1].events[0].type, 'spawn');
    s.close();
    await until(() => animals.subs.size === 0);
  } finally { await close(server); }
});

test('animal streams are capped like /events and refused when disabled', async () => {
  const animals = fakeEngine();
  const { server, port } = await animalServer({ animals });
  const open = [];
  try {
    for (let i = 0; i < 20; i++) open.push(await openStream(port));
    assert.equal((await request(port, { path: '/api/animals/events' })).status, 429);
    for (const s of open) s.close();
    await until(() => animals.subs.size === 0);
    animals.current = { disabled: true, error: 'key-length' };
    assert.equal((await request(port, { path: '/api/animals/events' })).status, 503);
  } finally { await close(server); }
});

test('snapshot() carries no animal data', () => {
  const { snapshot } = require('../server.js');
  const snap = snapshot();
  assert.equal('animals' in snap, false);
  assert.deepEqual(Object.keys(snap).sort(), ['at', 'sessions', 'usage', 'version']);
});

function fileState(file, over = {}) {
  return { offset: 1, rest: '', tokens: 0, pending: new Map(), recent: [], file, fileMtime: over.lastTs || 0, ...over };
}

test('animalRootsFrom: transcript roots only, with registry busy, status and active kids', () => {
  const { animalRootsFrom } = require('../server.js');
  const now = 10_000_000;
  const a = fileState(`/p/proj/${UUID_A}.jsonl`, { sessionId: UUID_A, lastTs: now - 1000, last: 'prompt', cwd: '/w/a' });
  const b = fileState(`/p/proj/${UUID_B}.jsonl`, { sessionId: UUID_B, lastTs: now - 2000, last: 'assistant', cwd: '/w/b',
    pending: new Map([['t1', { name: 'Task', detail: '', t: now - 2000 }]]) });
  const kid = fileState(`/p/proj/${UUID_B}/subagents/agent-x1.jsonl`, { sessionId: UUID_B, lastTs: now - 500, last: 'assistant',
    pending: new Map([['t2', { name: 'Bash', detail: 'npm test', t: now - 500 }]]) });

  const noRegistry = animalRootsFrom([a, b, kid], null, now);
  assert.deepEqual(noRegistry.find(r => r.status === 'thinking'), { hasTranscript: true, lastTs: now - 1000, regBusy: null, status: 'thinking', kidsActive: false });
  // B's freshness follows its newer sub-agent line.
  assert.deepEqual(noRegistry.find(r => r.status === 'waiting'), { hasTranscript: true, lastTs: now - 500, regBusy: null, status: 'waiting', kidsActive: true });
  assert.equal(noRegistry.length, 2, 'sub-agents are not roots');

  const live = new Map([
    [UUID_A, { pid: 1, name: '', status: 'idle', cwd: '/w/a' }],
    [UUID_B, { pid: 2, name: '', status: 'busy', cwd: '/w/b' }],
    ['cccccccc-0000-4000-8000-000000000003', { pid: 3, name: 'reg-only', status: 'busy', cwd: '/w/c' }],
  ]);
  const withRegistry = animalRootsFrom([a, b, kid], live, now);
  assert.equal(withRegistry.length, 2, 'registry-only sessions are left out');
  assert.equal(withRegistry.find(r => r.status === 'done').regBusy, false);
  assert.equal(withRegistry.find(r => r.status === 'waiting').regBusy, true);
});

test('animalRootsFrom: a root missing from a non-empty registry falls back to its display status (spec 5.2 rule 3)', () => {
  const { animalRootsFrom } = require('../server.js');
  const { isWorking } = require('../lib/animals.js');
  const now = 10_000_000;
  const a = fileState(`/p/proj/${UUID_A}.jsonl`, { sessionId: UUID_A, lastTs: now - 1000, last: 'prompt', cwd: '/w/a' });
  const b = fileState(`/p/proj/${UUID_B}.jsonl`, { sessionId: UUID_B, lastTs: now - 2000, last: 'assistant', stop: 'end_turn', cwd: '/w/b' });
  const kid = fileState(`/p/proj/${UUID_A}/subagents/agent-x1.jsonl`, { sessionId: UUID_A, lastTs: now - 500, last: 'assistant',
    pending: new Map([['t2', { name: 'Bash', detail: 'npm test', t: now - 500 }]]) });
  const live = new Map([[UUID_B, { pid: 2, name: '', status: 'idle', cwd: '/w/b' }]]);
  const roots = animalRootsFrom([a, b, kid], live, now);
  assert.equal(roots.length, 2);
  const unlisted = roots.find(r => r.regBusy === null);
  assert.equal(unlisted.status, 'thinking');
  assert.equal(unlisted.kidsActive, true, 'sub-agents of an unlisted root are kept');
  assert.equal(roots.find(r => r.regBusy !== null).regBusy, false);
  assert.equal(isWorking(roots, now), true);
});

test('animalRootsFrom: freshness spans sub-agents and pending calls; registry busy allows 60 minutes', () => {
  const { animalRootsFrom } = require('../server.js');
  const { isWorking } = require('../lib/animals.js');
  const now = 100_000_000, MIN = 60e3;
  const busy = new Map([[UUID_A, { pid: 1, name: '', status: 'busy', cwd: '/w/a' }]]);
  const idle = new Map([[UUID_A, { pid: 1, name: '', status: 'idle', cwd: '/w/a' }]]);
  const root = (age, over = {}) => fileState(`/p/proj/${UUID_A}.jsonl`, { sessionId: UUID_A, lastTs: now - age, last: 'assistant', cwd: '/w/a',
    pending: new Map([['t1', { name: 'Bash', detail: 'npm run build', t: now - age }]]), ...over });
  const kid = age => fileState(`/p/proj/${UUID_A}/subagents/agent-k1.jsonl`, { sessionId: UUID_A, lastTs: now - age, last: 'assistant',
    pending: new Map([['t2', { name: 'Read', detail: 'x', t: now - age }]]) });
  const working = (states, live) => isWorking(animalRootsFrom(states, live, now), now);

  assert.equal(working([root(50 * MIN)], busy), true, 'long Bash call while the registry says busy');
  assert.equal(working([root(61 * MIN)], busy), false, 'busy window is capped at 60 minutes');
  assert.equal(working([root(11 * MIN)], idle), false);
  assert.equal(working([root(11 * MIN)], null), false);
  // Foreground Agent call: the root writes nothing, its sub-agent keeps going.
  const agentRoot = root(11 * MIN, { pending: new Map([['t1', { name: 'Agent', detail: 'review', t: now - 11 * MIN }]]) });
  assert.equal(working([agentRoot, kid(MIN)], null), true, 'a fresh sub-agent line keeps the root fresh');
  assert.equal(animalRootsFrom([agentRoot, kid(MIN)], null, now)[0].lastTs, now - MIN);
  // A finished sub-agent (dropped from the office view) still counts toward freshness.
  const doneKid = fileState(`/p/proj/${UUID_A}/subagents/agent-k2.jsonl`, { sessionId: UUID_A, lastTs: now - 2 * MIN, last: 'assistant', stop: 'end_turn', finished: true });
  assert.equal(animalRootsFrom([agentRoot, doneKid], null, now)[0].lastTs, now - 2 * MIN);
  // The live server passes a one-shot iterator.
  const once = new Map([['r', root(50 * MIN)], ['k', kid(MIN)]]).values();
  assert.equal(animalRootsFrom(once, null, now)[0].lastTs, now - MIN);
});

test('animalRootsFrom: a kid on a permission prompt is not active; busy wins over a permission display', () => {
  const { animalRootsFrom } = require('../server.js');
  const now = 10_000_000;
  const b = fileState(`/p/proj/${UUID_B}.jsonl`, { sessionId: UUID_B, lastTs: now - 30000, last: 'assistant',
    pending: new Map([['t1', { name: 'Task', detail: '', t: now - 30000 }]]) });
  const kid = fileState(`/p/proj/${UUID_B}/subagents/agent-x1.jsonl`, { sessionId: UUID_B, lastTs: now - 20000, last: 'assistant',
    pending: new Map([['t2', { name: 'Bash', detail: 'rm -rf build', t: now - 20000 }]]) });
  const [root] = animalRootsFrom([b, kid], null, now);
  assert.equal(root.status, 'waiting', 'snapshot still shows the root waiting on its kid');
  assert.equal(root.kidsActive, false, 'but a kid waiting for permission is not work');

  const a = fileState(`/p/proj/${UUID_A}.jsonl`, { sessionId: UUID_A, lastTs: now - 20000, last: 'assistant',
    pending: new Map([['t3', { name: 'Bash', detail: 'npm test', t: now - 20000 }]]) });
  const [busy] = animalRootsFrom([a], new Map([[UUID_A, { pid: 1, name: '', status: 'busy', cwd: '/w/a' }]]), now);
  assert.equal(busy.status, 'permission');
  assert.equal(busy.regBusy, true);
});

test('holdPortThenStart: the animal engine starts only after the port is held', async () => {
  const { holdPortThenStart } = require('../server.js');
  const { EventEmitter } = await import('node:events');
  let resolveListen;
  const listenFn = () => new Promise(r => { resolveListen = r; });
  const engine = { started: 0, flushed: 0, start() { this.started++; }, flush() { this.flushed++; } };
  const proc = new EventEmitter();
  proc.exitCodes = []; proc.exit = code => proc.exitCodes.push(code);
  let published = 0;
  const done = holdPortThenStart({ server: {}, port: 1, host: '127.0.0.1', listen: listenFn, startPublisher: () => { published++; return 'pub'; }, animals: engine, log: () => {}, proc });
  await new Promise(r => setImmediate(r));
  assert.equal(engine.started, 0, 'waiting for the port: no engine');
  assert.equal(proc.listenerCount('SIGTERM'), 0);
  resolveListen();
  assert.equal(await done, 'pub');
  assert.equal(engine.started, 1);
  assert.equal(published, 1);
  proc.emit('SIGTERM');
  assert.deepEqual(proc.exitCodes, [143]);
  proc.emit('SIGINT');
  assert.deepEqual(proc.exitCodes, [143, 130]);
  proc.emit('exit');
  assert.equal(engine.flushed, 1);
});

test('holdPortThenStart: a failed listen never starts the engine', async () => {
  const { holdPortThenStart } = require('../server.js');
  const engine = { started: 0, start() { this.started++; }, flush() {} };
  await assert.rejects(holdPortThenStart({ server: {}, port: 1, host: 'x', listen: () => Promise.reject(new Error('EACCES')), startPublisher: () => null, animals: engine, log: () => {}, proc: { once() {}, exit() {} } }));
  assert.equal(engine.started, 0);
});

test('GET /api/log returns the ring buffer and never a token', async () => {
  const { createLogBuffer } = require('../lib/logbuf.js');
  const buf = createLogBuffer({ sink: () => {} });
  buf.log('terrarium: hub said Bearer trd_leaky999');
  const server = http.createServer();
  const port = await listen(server);
  server.on('request', createHandler({ snapshot: () => ({ sessions: [] }), scan: () => {}, port, allowedHosts: [], allowedOrigin: '', logLines: buf.lines }));
  try {
    const r = await request(port, { path: '/api/log' });
    assert.equal(r.status, 200);
    assert.match(r.headers['content-type'], /^application\/json/);
    assert.equal(r.headers['cache-control'], 'no-store');
    const j = JSON.parse(r.body);
    assert.equal(j.lines.length, 1);
    assert.equal(j.lines[0].line, 'terrarium: hub said Bearer ***');
    assert.ok(!r.body.includes('trd_leaky999'));
    assert.equal(r.headers['access-control-allow-origin'], undefined);
  } finally { await close(server); }
});

test('/api/log refuses foreign hosts and POST', async () => {
  const server = http.createServer();
  const port = await listen(server);
  server.on('request', createHandler({ snapshot: () => ({ sessions: [] }), scan: () => {}, port, allowedHosts: [], allowedOrigin: '', logLines: () => [] }));
  try {
    assert.equal((await request(port, { path: '/api/log', headers: { Host: 'evil.example' } })).status, 403);
    assert.equal((await request(port, { method: 'POST', path: '/api/log' })).status, 405);
  } finally { await close(server); }
});

test('public-preview carries the publisher fields and marks a stale view', () => {
  const { makePublicPreview } = require('../server.js');
  const snapshot = { at: 1, usage: {}, version: 'x', sessions: [] };
  const salt = 'cd'.repeat(32);
  const fields = { share: 'kin', private: false, hub: 'https://h', deviceId: 'ab12cd34ef567890', instance: 'f'.repeat(16), lastOkAt: 5, lastAttemptAt: 6, lastErr: { code: 'http:503', at: 6 }, failures: 2, nextRetryAt: 9, hubAck: 'json' };
  for (const st of ['offline', 'rejected', 'standby', 'paused']) {
    const p = makePublicPreview({ publisher: { state: () => ({ state: st, ...fields }), view: () => ({ sessions: [] }) }, getSnapshot: () => snapshot, salt })();
    assert.equal(p.view.stale, true, st);
    for (const k of Object.keys(fields)) assert.deepEqual(p[k], fields[k], k);
  }
  for (const st of ['sending', 'connecting', 'private', 'off', 'revoked']) {
    const p = makePublicPreview({ publisher: { state: () => ({ state: st, ...fields }), view: () => ({ sessions: [] }) }, getSnapshot: () => snapshot, salt })();
    assert.ok(!p.view.stale, st);
  }
  const fb = makePublicPreview({ publisher: { state: () => ({ state: 'offline', ...fields }), view: () => null }, getSnapshot: () => snapshot, salt })();
  assert.equal(fb.view.stale, true); assert.equal(fb.failures, 2);
});
