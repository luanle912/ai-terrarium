// A hub that shuts down (SIGTERM, close()) tells every viewer when to come back (spec 7.1, H1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDevHub, devLogin } from './hub-helpers.mjs';

// Opens a raw SSE stream and collects every byte until the server ends it.
async function openStream(url, cookie) {
  const r = await fetch(url + '/api/world/stream', { headers: { cookie } });
  assert.equal(r.status, 200);
  let text = '';
  const done = (async () => {
    const dec = new TextDecoder();
    try { for await (const c of r.body) text += dec.decode(c, { stream: true }); } catch { /* reset counts as ended */ }
    return text;
  })();
  return { done, text: () => text };
}

const waitFor = async (cond, ms = 2000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timed out');
    await new Promise((res) => setTimeout(res, 10));
  }
};

const RESTART_RE = /event: restarting\ndata: (\{[^\n]*\})\nretry: (\d+)\n\n/g;

async function openMany(h, people, each) {
  const streams = [];
  for (let p = 0; p < people; p++) {
    const login = await devLogin(h.url, `u${p}@newera.inc`);
    for (let i = 0; i < each; i++) streams.push(await openStream(h.url, login.cookie));
  }
  // every stream has had its first world before the hub closes
  await waitFor(() => streams.every((s) => s.text().includes('event: world')));
  return streams;
}

test('closing the hub tells every viewer to come back after 5-20 s', async () => {
  const h = await startDevHub();
  let texts;
  try {
    const streams = await openMany(h, 4, 5);
    assert.equal(h.hub.ctx.streams.count(), 20);
    await h.close();
    texts = await Promise.all(streams.map((s) => s.done));
  } finally { await h.close(); }
  const values = [];
  for (const t of texts) {
    const blocks = [...t.matchAll(RESTART_RE)];
    assert.equal(blocks.length, 1, 'exactly one restarting block');
    const r = JSON.parse(blocks[0][1]).retryMs;
    assert.ok(Number.isInteger(r) && r >= 5000 && r < 20000, `retryMs ${r}`);
    assert.equal(Number(blocks[0][2]), r, 'retry: carries the same value');
    assert.ok(t.endsWith(blocks[0][0]), 'the stream ends right after the restarting block');
    values.push(r);
  }
  assert.ok(new Set(values).size > 1, 'the retry values are spread');
});

test('no world broadcast while draining', async () => {
  const h = await startDevHub();
  let texts;
  try {
    const streams = await openMany(h, 2, 3);
    await h.close();
    texts = await Promise.all(streams.map((s) => s.done));
  } finally { await h.close(); }
  for (const t of texts) {
    const at = t.indexOf('event: restarting');
    assert.ok(at > 0);
    assert.equal(t.slice(at).includes('event: world'), false);
  }
});

test('the retry spread is deterministic with an injected random', async () => {
  const h = await startDevHub({ deps: { random: () => 0.5 } });
  let texts;
  try {
    const streams = await openMany(h, 1, 2);
    await h.close();
    texts = await Promise.all(streams.map((s) => s.done));
  } finally { await h.close(); }
  for (const t of texts) {
    const blocks = [...t.matchAll(RESTART_RE)];
    assert.equal(blocks.length, 1);
    assert.deepEqual(JSON.parse(blocks[0][1]), { retryMs: 12500 });
    assert.equal(blocks[0][2], '12500');
  }
});
