import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { startDevHub, devLogin, pairDevice } from './hub-helpers.mjs';

const require = createRequire(import.meta.url);
const { createOfficePage, inlineScriptHashes } = require('../hub/csp.js');
const OFFICE = path.join(import.meta.dirname, '..', 'claude-office.html');
const html = fs.readFileSync(OFFICE, 'utf8');
const sha = (s) => "'sha256-" + crypto.createHash('sha256').update(s).digest('base64') + "'";

test('every inline script of the page is hashed into script-src', async () => {
  const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(inline.length > 5);
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'a@newera.inc');
    const r = await fetch(h.url + '/', { headers: { cookie: login.cookie } });
    assert.equal(r.status, 200);
    const csp = r.headers.get('content-security-policy');
    for (const m of inline) assert.ok(csp.includes(sha(m[1])), 'missing hash');
    const scriptSrc = /script-src ([^;]*)/.exec(csp)[1];
    assert.equal(scriptSrc.split(' ').filter((t) => t.startsWith("'sha256-")).length, new Set(inline.map((m) => sha(m[1]))).size);
    assert.ok(scriptSrc.includes('https://cdnjs.cloudflare.com'));
    assert.ok(!scriptSrc.includes('unsafe-inline'));
    assert.ok(csp.includes("default-src 'none'") && csp.includes("frame-ancestors 'none'") && csp.includes("base-uri 'none'") && csp.includes("form-action 'self'"));
    assert.ok(csp.includes("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"));
  } finally { await h.close(); }
});

test('csp follows the file after an edit', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-'));
  const f = path.join(dir, 'page.html');
  fs.writeFileSync(f, '<script src="x.js"></script><script id="a">var a=1;</script>');
  fs.utimesSync(f, 1000, 1000);
  const page = createOfficePage(f);
  const first = page.get();
  assert.ok(first.csp.includes(sha('var a=1;')));
  assert.equal(page.get(), first, 'cached while the mtime is unchanged');
  fs.writeFileSync(f, '<script src="x.js"></script><script id="a">var a=2;</script>');
  fs.utimesSync(f, 2000, 2000);
  const second = page.get();
  assert.ok(second.csp.includes(sha('var a=2;')) && !second.csp.includes(sha('var a=1;')));
  assert.deepEqual(inlineScriptHashes('<script src="a"></script>'), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('react tags carry integrity and crossorigin', () => {
  const tags = html.match(/<script[^>]*src="https:\/\/cdnjs\.cloudflare\.com[^>]*>/g) || [];
  assert.equal(tags.length, 2);
  for (const t of tags) {
    assert.match(t, /integrity="sha384-[A-Za-z0-9+/=]{64}"/);
    assert.match(t, /crossorigin="anonymous"/);
  }
});

test('hsts only on https', async () => {
  const dev = await startDevHub();
  const sec = await startDevHub({ env: { HUB_PUBLIC_URL: 'https://hub.example.com', HUB_DEV_LOGIN: '', GOOGLE_CLIENT_ID: 'c', GOOGLE_CLIENT_SECRET: 's' } });
  try {
    assert.equal((await fetch(dev.url + '/api/config')).headers.get('strict-transport-security'), null);
    assert.equal((await fetch(sec.url + '/api/config')).headers.get('strict-transport-security'), 'max-age=31536000');
    assert.equal((await fetch(sec.url + '/nope')).headers.get('strict-transport-security'), 'max-age=31536000');
  } finally { await dev.close(); await sec.close(); }
});

test('responses carry cross-origin-opener-policy', async () => {
  const h = await startDevHub();
  try {
    assert.equal((await fetch(h.url + '/api/config')).headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal((await fetch(h.url + '/nope')).headers.get('cross-origin-opener-policy'), 'same-origin');
  } finally { await h.close(); }
});

test('other routes are limited to 120 a minute per ip', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'a@newera.inc');
    const paired = await pairDevice(h.url, login);
    // setup traffic already used some of the bucket; refill it with a fixed baseline by using a fresh key space
    let last;
    let n = 0;
    do { last = await fetch(h.url + '/api/config'); n++; } while (last.status !== 429 && n < 200);
    assert.equal(last.status, 429);
    assert.ok(n <= 121 && n > 80, `limited after ${n}`);
    assert.equal(last.headers.get('retry-after'), '30');
    // publish keeps its own limit and is not hit by the general one
    const r = await fetch(h.url + '/api/publish', {
      method: 'POST', headers: { authorization: 'Bearer ' + paired.token, 'content-type': 'application/json' },
      body: JSON.stringify({ v: 1, seq: 1, sessions: [] }),
    });
    assert.equal(r.status, 204);
  } finally { await h.close(); }
});

test('the general limit is per user when signed in, per ip otherwise', async () => {
  const h = await startDevHub(); // the clock is frozen, so no bucket refills during the test
  try {
    const a = await devLogin(h.url, 'a@newera.inc');
    const b = await devLogin(h.url, 'b@newera.inc');
    const paired = await pairDevice(h.url, a);
    const drain = async (headers) => {
      let k = 0;
      let r;
      do { r = await fetch(h.url + '/api/config', { headers }); k++; } while (r.status !== 429 && k < 200);
      assert.equal(r.status, 429);
      return k - 1;
    };
    // an unauthenticated flood from the shared ip empties the ip bucket
    await drain({});
    // a cookie that is not a valid session is not a user: it still counts against the ip
    assert.equal((await fetch(h.url + '/api/config', { headers: { cookie: 'tr_sess=nope' } })).status, 429);
    // a device token counts against its owner, not the ip
    const self = await fetch(h.url + '/api/device/revoke-self', { method: 'POST', headers: { authorization: 'Bearer ' + paired.token } });
    assert.equal(self.status, 204);
    // each signed-in user behind that ip still has a whole budget of their own
    const usedA = await drain({ cookie: a.cookie });
    assert.ok(usedA >= 115 && usedA <= 120, `a got ${usedA}`);
    const usedB = await drain({ cookie: b.cookie });
    assert.ok(usedB >= 115 && usedB <= 120, `b got ${usedB}`);
  } finally { await h.close(); }
});

async function openRaw(url, cookie) {
  const ac = new AbortController();
  const r = await fetch(url + '/api/world/stream', { headers: { cookie }, signal: ac.signal });
  return { status: r.status, close: () => ac.abort(), r };
}
const settle = () => new Promise((res) => setTimeout(res, 150));

test('a sixth stream of one user is 429', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'a@newera.inc');
    const open = [];
    for (let i = 0; i < 5; i++) { const s = await openRaw(h.url, login.cookie); assert.equal(s.status, 200); open.push(s); }
    const sixth = await openRaw(h.url, login.cookie);
    assert.equal(sixth.status, 429);
    assert.equal(sixth.r.headers.get('content-type').startsWith('text/event-stream'), false);
    // another user is unaffected
    const other = await devLogin(h.url, 'b@newera.inc');
    const o = await openRaw(h.url, other.cookie);
    assert.equal(o.status, 200);
    o.close();
    // closing frees the slots: 5 more open fine
    open.forEach((s) => s.close());
    await settle();
    const again = [];
    for (let i = 0; i < 5; i++) { const s = await openRaw(h.url, login.cookie); assert.equal(s.status, 200, `reopen ${i}`); again.push(s); }
    again.forEach((s) => s.close());
  } finally { await h.close(); }
});

test('streams ended by the session end free their slot', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'a@newera.inc');
    for (let i = 0; i < 5; i++) assert.equal((await openRaw(h.url, login.cookie)).status, 200);
    const out = await fetch(h.url + '/auth/logout', { method: 'POST', redirect: 'manual', headers: { cookie: login.cookie, origin: h.url, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf: login.csrf }) });
    assert.ok(out.status < 400);
    await settle();
    assert.equal(h.hub.ctx.streams.count(), 0);
    const again = await devLogin(h.url, 'a@newera.inc');
    for (let i = 0; i < 5; i++) assert.equal((await openRaw(h.url, again.cookie)).status, 200);
  } finally { await h.close(); }
});

test('the hub-wide stream cap is 503', async () => {
  const h = await startDevHub({ deps: { streamLimits: { perUser: 5, total: 3 } } });
  try {
    const open = [];
    for (const e of ['a', 'b', 'c']) { const l = await devLogin(h.url, `${e}@newera.inc`); const s = await openRaw(h.url, l.cookie); assert.equal(s.status, 200); open.push(s); }
    const d = await devLogin(h.url, 'd@newera.inc');
    assert.equal((await openRaw(h.url, d.cookie)).status, 503);
    open[0].close();
    await settle();
    assert.equal((await openRaw(h.url, d.cookie)).status, 200);
  } finally { await h.close(); }
});
