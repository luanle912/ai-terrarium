import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDevHub, devLogin, pairDevice, postJson } from './hub-helpers.mjs';

const TOKEN = 'm'.repeat(40);
const pkt = (extra = {}) => ({ v: 1, seq: 1, sessions: [], ...extra });
const bearer = (token) => ({ authorization: 'Bearer ' + token });
const metrics = async (h) => (await fetch(h.url + '/metrics', { headers: bearer(TOKEN) })).text();
const sample = (text, name) => {
  const line = text.split('\n').find((l) => l.startsWith(name + ' '));
  return line ? Number(line.slice(name.length + 1)) : NaN;
};

test('HEAD / is 200 with no body', async () => {
  const h = await startDevHub();
  try {
    const r = await fetch(h.url + '/', { method: 'HEAD' });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.equal((await r.text()).length, 0);
  } finally { await h.close(); }
});

test('HEAD works for /healthz and the page assets, and an unknown path stays 404', async () => {
  const h = await startDevHub();
  try {
    const r = await fetch(h.url + '/healthz', { method: 'HEAD' });
    assert.equal(r.status, 200);
    assert.equal((await r.text()).length, 0);
    const css = await fetch(h.url + '/web/styles.css', { method: 'HEAD' });
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type') || '', /text\/css/);
    assert.equal((await css.text()).length, 0);
    assert.equal((await fetch(h.url + '/nope', { method: 'HEAD' })).status, 404);
  } finally { await h.close(); }
});

test('HEAD on the stream is 405 and opens no stream', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    const r = await fetch(h.url + '/api/world/stream', { method: 'HEAD', headers: { cookie: login.cookie } });
    assert.equal(r.status, 405);
    assert.equal(r.headers.get('allow'), 'GET');
    assert.equal(h.hub.ctx.streams.count(), 0);
  } finally { await h.close(); }
});

test('/healthz answers ok with uptime and db', async () => {
  const h = await startDevHub();
  try {
    h.clock.advance(12_500);
    const r = await fetch(h.url + '/healthz');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.db, 'ok');
    assert.equal(j.uptimeS, 12);
    assert.equal(j.streams, 0);
    assert.equal(typeof j.version, 'string');
  } finally { await h.close(); }
});

test('/healthz is 503 when the database is gone', async () => {
  const h = await startDevHub();
  try {
    h.hub.db.close();
    const r = await fetch(h.url + '/healthz');
    assert.equal(r.status, 503);
    assert.deepEqual(await r.json(), { ok: false, db: 'error' });
  } finally { await h.close().catch(() => {}); }
});

test('/metrics is 404 without HUB_METRICS_TOKEN, 401 with a wrong token, 200 with the right one', async () => {
  const h = await startDevHub();
  try { assert.equal((await fetch(h.url + '/metrics', { headers: bearer(TOKEN) })).status, 404); } finally { await h.close(); }
  const g = await startDevHub({ env: { HUB_METRICS_TOKEN: TOKEN } });
  try {
    assert.equal((await fetch(g.url + '/metrics')).status, 401);
    assert.equal((await fetch(g.url + '/metrics', { headers: bearer('w'.repeat(40)) })).status, 401);
    assert.equal((await fetch(g.url + '/metrics', { headers: bearer('m'.repeat(10)) })).status, 401);
    const ok = await fetch(g.url + '/metrics', { headers: bearer(TOKEN) });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'text/plain; version=0.0.4; charset=utf-8');
    const text = await ok.text();
    for (const n of ['terrarium_uptime_seconds', 'terrarium_streams', 'terrarium_islands_slotted', 'terrarium_islands_online',
      'terrarium_http_429_total', 'terrarium_world_broadcasts_total', 'terrarium_frames_written_total']) assert.ok(sample(text, n) >= 0, n);
    assert.equal(sample(text, 'terrarium_publish_total{result="rate_limited"}'), 0);
    assert.equal(sample(text, 'terrarium_stream_refused_total{reason="user_cap"}'), 0);
    assert.ok(!text.includes(TOKEN));
  } finally { await g.close(); }
});

test('metrics count accepted and refused publishes, refused streams and 429s', async () => {
  const h = await startDevHub({ env: { HUB_METRICS_TOKEN: TOKEN }, deps: { streamLimits: { perUser: 1, total: 300 } } });
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    const dev = await pairDevice(h.url, login, 'Laptop');
    await postJson(h.url, '/api/publish', pkt({ seq: 5 }), bearer(dev.token));
    await postJson(h.url, '/api/publish', pkt({ seq: 2 }), bearer(dev.token)); // stale
    await postJson(h.url, '/api/publish', { nope: 1 }, bearer(dev.token)); // bad packet
    await postJson(h.url, '/api/publish', pkt(), bearer('0'.repeat(40))); // unauthorized
    const big = await postJson(h.url, '/api/publish', pkt({ pad: 'x'.repeat(20000) }), bearer(dev.token));
    assert.equal(big.status, 413);
    let limited = 0;
    for (let i = 0; i < 12; i++) if ((await postJson(h.url, '/api/publish', pkt({ seq: 6 + i }), bearer(dev.token))).status === 429) limited++;
    assert.ok(limited > 0);

    const ac = new AbortController();
    const s1 = await fetch(h.url + '/api/world/stream', { headers: { cookie: login.cookie }, signal: ac.signal });
    assert.equal(s1.status, 200);
    assert.equal((await fetch(h.url + '/api/world/stream', { headers: { cookie: login.cookie } })).status, 429);

    const t = await metrics(h);
    assert.ok(sample(t, 'terrarium_publish_total{result="accepted"}') >= 1);
    assert.equal(sample(t, 'terrarium_publish_total{result="stale_seq"}'), 1);
    assert.equal(sample(t, 'terrarium_publish_total{result="bad_packet"}'), 1);
    assert.equal(sample(t, 'terrarium_publish_total{result="unauthorized"}'), 1);
    assert.equal(sample(t, 'terrarium_publish_total{result="too_large"}'), 1);
    assert.equal(sample(t, 'terrarium_publish_total{result="rate_limited"}'), limited);
    assert.equal(sample(t, 'terrarium_stream_refused_total{reason="user_cap"}'), 1);
    assert.equal(sample(t, 'terrarium_stream_refused_total{reason="hub_cap"}'), 0);
    assert.equal(sample(t, 'terrarium_http_429_total'), limited + 1);
    assert.equal(sample(t, 'terrarium_streams'), 1);
    assert.equal(sample(t, 'terrarium_islands_slotted'), 1);
    ac.abort();
  } finally { await h.close(); }
});
