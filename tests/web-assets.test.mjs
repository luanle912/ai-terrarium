import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const wa = require('../lib/web-assets.js');

const tmpWeb = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'terr-web-'));
  fs.writeFileSync(path.join(d, 'a.js'), 'export const a = 1;\n'.repeat(200));
  return d;
};

test('a browser that has the file gets 304 and no body; one that has not gets it, gzipped when accepted', () => {
  const a = wa.readAsset('/web/a.js', tmpWeb());
  assert.match(a.etag, /^W\/"[A-Za-z0-9_-]+"$/);
  const plain = wa.respond(a, {});
  assert.equal(plain.status, 200);
  assert.equal(plain.headers['Content-Encoding'], undefined);
  assert.equal(plain.body, a.body);
  assert.equal(plain.headers['Cache-Control'], 'no-cache', 'still revalidated on every load');
  const gz = wa.respond(a, { 'accept-encoding': 'gzip, deflate, br' });
  assert.equal(gz.headers['Content-Encoding'], 'gzip');
  assert.ok(gz.body.length < a.body.length / 4);
  assert.deepEqual(zlib.gunzipSync(gz.body), a.body);
  assert.equal(gz.headers.Vary, 'Accept-Encoding');
  const again = wa.respond(a, { 'if-none-match': a.etag });
  assert.equal(again.status, 304);
  assert.equal(again.body, null);
  assert.equal(wa.respond(a, { 'if-none-match': 'W/"x", ' + a.etag }).status, 304);
  assert.equal(wa.respond(a, { 'if-none-match': 'W/"other"' }).status, 200);
});

test('a saved file is served new at once, with a new ETag', () => {
  const d = tmpWeb(), f = path.join(d, 'a.js');
  const before = wa.readAsset('/web/a.js', d);
  fs.writeFileSync(f, 'export const a = 2;\n');
  const t = new Date(Date.now() + 5000);
  fs.utimesSync(f, t, t);
  const after = wa.readAsset('/web/a.js', d);
  assert.equal(after.body.toString(), 'export const a = 2;\n');
  assert.notEqual(after.etag, before.etag);
  assert.equal(wa.respond(after, { 'if-none-match': before.etag }).status, 200);
  fs.rmSync(f);
  assert.equal(wa.readAsset('/web/a.js', d), null, 'a deleted file is gone, not served from memory');
});

test('the local server answers 304 and gzip for web/ files', async () => {
  const { createHandler } = require('../server.js');
  const http = await import('node:http');
  const d = tmpWeb();
  const srv = http.createServer(createHandler({ webDir: d, port: 0 }));
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const get = headers => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: '/web/a.js', headers: { host: 'localhost:0', ...headers } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
  try {
    const first = await get({ 'accept-encoding': 'gzip' });
    assert.equal(first.status, 200);
    assert.equal(first.headers['content-encoding'], 'gzip');
    const again = await get({ 'if-none-match': first.headers.etag });
    assert.equal(again.status, 304);
    assert.equal(again.body.length, 0);
  } finally { srv.close(); }
});
