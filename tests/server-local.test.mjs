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
