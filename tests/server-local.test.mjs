import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { hostAllowed, corsOrigin, createHandler, listenWithRetry } = require('../server.js');

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
