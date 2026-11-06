import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { startDevHub, devLogin, pairDevice, postJson, makeGoogle, googleLogin, NOW } from './hub-helpers.mjs';

const require = createRequire(import.meta.url);
const { validatePublish } = require('../hub/validate.js');
const { createWorld } = require('../hub/world.js');

const sid = (n) => n.toString(16).padStart(12, '0');
const sess = (n, extra = {}) => ({ id: sid(n), parent: null, status: 'working', waitingOn: null, talkingTo: null, dept: 'A', kind: 'edit', ...extra });
const pkt = (sessions, extra = {}) => ({ v: 1, seq: 1, sessions, ...extra });

// ---- validate ----
test('validate accepts a well formed packet', () => {
  const r = validatePublish(pkt([sess(1), sess(2, { parent: sid(1) })]));
  assert.equal(r.ok, true);
  assert.equal(r.value.sessions[1].parent, sid(1));
  assert.equal(r.value.share, 'kin');
});

test('validate rejects unknown keys, bad enums, long strings, 33 sessions', () => {
  const bad = (p) => assert.equal(validatePublish(p).ok, false, JSON.stringify(p).slice(0, 80));
  bad(pkt([sess(1)], { island: 'x' }));
  bad(pkt([sess(1)], { userId: 3 }));
  bad(pkt([{ ...sess(1), extra: 1 }]));
  bad(pkt([{ ...sess(1), status: 'sleeping' }]));
  bad(pkt([{ ...sess(1), kind: 'rm' }]));
  bad(pkt([{ ...sess(1), id: 'zz' }]));
  bad(pkt([{ ...sess(1), dept: 'Q' }]));
  bad(pkt([{ ...sess(1), dept: 'AB' }]));
  bad(pkt([{ ...sess(1), tool: 'Bash' }])); // kin has no tool
  bad(pkt([{ ...sess(1), dept: 'x'.repeat(41) }], { share: 'co-ban' }));
  bad(pkt([{ ...sess(1), tool: 'x'.repeat(33) }], { share: 'co-ban' }));
  bad(pkt([{ ...sess(1), tool: 'a b' }], { share: 'co-ban' }));
  bad(pkt([{ ...sess(1), model: 'gpt-4' }], { share: 'co-ban' }));
  bad(pkt(Array.from({ length: 33 }, (_, i) => sess(i + 1))));
  bad(pkt([sess(1), sess(1)]));
  bad(pkt([sess(1)], { v: 2 }));
  bad(pkt([sess(1)], { seq: -1 }));
  bad(pkt([sess(1)], { seq: 1.5 }));
  bad(pkt([sess(1)], { private: 'yes' }));
  bad(pkt([sess(1)], { share: 'public' }));
  bad(pkt('nope'));
  bad([]);
  bad(null);
  assert.equal(validatePublish(pkt(Array.from({ length: 32 }, (_, i) => sess(i + 1)))).ok, true);
});

test('validate co-ban allows names, tool and model', () => {
  const r = validatePublish(pkt([sess(1, { dept: 'Dự án mới', tool: 'mcp__github', model: 'claude-opus-4.5' })], { share: 'co-ban' }));
  assert.equal(r.ok, true);
  assert.equal(r.value.sessions[0].tool, 'mcp__github');
});

test('dangling references become null', () => {
  const r = validatePublish(pkt([sess(1, { parent: sid(9), waitingOn: sid(8), talkingTo: sid(2) }), sess(2, { parent: sid(2) })]));
  assert.equal(r.ok, true);
  const [a, b] = r.value.sessions;
  assert.equal(a.parent, null);
  assert.equal(a.waitingOn, null);
  assert.equal(a.talkingTo, sid(2));
  assert.equal(b.parent, null);
});

test('private packets drop their sessions', () => {
  const r = validatePublish(pkt([sess(1)], { private: true }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.sessions, []);
  assert.equal(r.value.private, true);
});

// ---- world ----
const ISL = { id: 'i1', name: 'Đảo A', color: '#fff', slot: 0 };
function mkWorld() {
  const clock = { t: 1000 };
  const events = [];
  const world = createWorld({ now: () => clock.t, onChange: (e) => events.push(e) });
  return { clock, events, world };
}
const val = (sessions, extra = {}) => validatePublish(pkt(sessions, extra)).value;

test('kin depts from two machines become separate rooms', () => {
  const { world } = mkWorld();
  world.publish(ISL, 'd1', 'kin', val([sess(1, { dept: 'A' }), sess(2, { dept: 'A' })]));
  world.publish(ISL, 'd2', 'kin', val([sess(3, { dept: 'A' }), sess(4, { dept: 'B' })]));
  const s = Object.fromEntries(world.snapshotFor('i1').map((x) => [x.id, x.project]));
  assert.equal(s[sid(1)], s[sid(2)]);
  assert.notEqual(s[sid(1)], s[sid(3)]);
  assert.notEqual(s[sid(3)], s[sid(4)]);
  assert.equal(new Set(Object.values(s)).size, 3);
  assert.deepEqual([s[sid(1)], s[sid(3)], s[sid(4)]], ['A', 'B', 'C']);
});

test('snapshotFor shapes sessions as ClientSession', () => {
  const { world } = mkWorld();
  world.publish(ISL, 'd1', 'co-ban', val([sess(1, { dept: 'Web', tool: 'Bash', model: 'claude-x', kind: 'shell' }), sess(2, { parent: sid(1), dept: 'Web' })], { share: 'co-ban' }));
  const [a, b] = world.snapshotFor('i1');
  assert.deepEqual(a, { id: sid(1), parentId: null, status: 'working', waitingOn: null, talkingTo: null, project: 'Web', kind: 'shell', tool: 'Bash', model: 'claude-x' });
  assert.equal(b.parentId, sid(1));
  assert.equal('tool' in b, false);
  assert.deepEqual(world.snapshotFor('nope'), []);
});

test('island is private only when every online machine is private; share label is the strictest', () => {
  const { world, clock } = mkWorld();
  world.publish(ISL, 'd1', 'co-ban', val([sess(1)], { share: 'co-ban' }));
  world.publish(ISL, 'd2', 'co-ban', val([], { private: true, share: 'co-ban' }));
  let m = world.islands()[0];
  assert.equal(m.private, false);
  assert.equal(m.share, 'co-ban');
  assert.equal(m.online, true);
  world.publish(ISL, 'd3', 'kin', val([sess(5)]));
  assert.equal(world.islands()[0].share, 'kin');
  // d1 and d3 go quiet, only the private machine stays online
  clock.t += 60_000;
  world.publish(ISL, 'd2', 'co-ban', val([], { private: true, seq: 2, share: 'co-ban' }));
  clock.t += 60_000;
  world.publish(ISL, 'd2', 'co-ban', val([], { private: true, seq: 3, share: 'co-ban' }));
  world.tick();
  m = world.islands()[0];
  assert.equal(m.private, true);
  assert.equal(m.share, 'co-ban');
  assert.deepEqual(world.snapshotFor('i1'), []);
});

test('offline after 90 s without a packet', () => {
  const { world, clock, events } = mkWorld();
  world.publish(ISL, 'd1', 'kin', val([sess(1)]));
  clock.t += 89_000; world.tick();
  assert.equal(world.islands()[0].online, true);
  clock.t += 2_000;
  events.length = 0;
  world.tick();
  assert.equal(world.islands()[0].online, false);
  assert.ok(events.some((e) => e.type === 'world'));
  assert.deepEqual(world.snapshotFor('i1'), []);
  world.publish(ISL, 'd1', 'kin', val([sess(1)], { seq: 2 }));
  assert.equal(world.islands()[0].online, true);
});

test('seq 0 after a higher seq is accepted as a restart; other lower seqs are dropped', () => {
  const { world } = mkWorld();
  assert.deepEqual(world.publish(ISL, 'd1', 'kin', val([sess(1)], { seq: 10 })), { accepted: true });
  assert.deepEqual(world.publish(ISL, 'd1', 'kin', val([sess(2)], { seq: 5 })), { accepted: false, reason: 'stale_seq', seq: 10 });
  assert.equal(world.snapshotFor('i1')[0].id, sid(1));
  assert.deepEqual(world.publish(ISL, 'd1', 'kin', val([sess(3)], { seq: 0 })), { accepted: true });
  assert.equal(world.snapshotFor('i1')[0].id, sid(3));
  assert.deepEqual(world.publish(ISL, 'd1', 'kin', val([sess(3)], { seq: 0 })), { accepted: true });
});

test('a second instance is refused while the first one is fresh, and takes over with seq 0 or after 90 s of silence', () => {
  const { world, clock } = mkWorld();
  const A = { instance: 'aaaaaaaaaaaaaaaa' };
  const B = { instance: 'bbbbbbbbbbbbbbbb' };
  for (let seq = 0; seq <= 3; seq++) assert.deepEqual(world.publish(ISL, 'd1', 'kin', val([sess(1)], { seq }), A), { accepted: true });
  assert.deepEqual(world.publish(ISL, 'd1', 'kin', val([sess(2)], { seq: 7 }), B), { accepted: false, reason: 'other_instance' });
  assert.equal(world.snapshotFor('i1')[0].id, sid(1));
  assert.deepEqual(world.publish(ISL, 'd1', 'kin', val([sess(2)], { seq: 0 }), B), { accepted: true });
  assert.equal(world.snapshotFor('i1')[0].id, sid(2));
  assert.deepEqual(world.publish(ISL, 'd1', 'kin', val([sess(1)], { seq: 4 }), A), { accepted: false, reason: 'other_instance' });
  assert.equal(world.snapshotFor('i1')[0].id, sid(2));
  clock.t += 90_000;
  assert.deepEqual(world.publish(ISL, 'd1', 'kin', val([sess(1)], { seq: 5 }), A), { accepted: true });
  assert.equal(world.snapshotFor('i1')[0].id, sid(1));
});

test('a publisher without the instance header is one legacy instance', () => {
  const { world } = mkWorld();
  assert.deepEqual(world.publish(ISL, 'd1', 'kin', val([sess(1)], { seq: 1 })), { accepted: true });
  assert.deepEqual(world.publish(ISL, 'd1', 'kin', val([sess(1)], { seq: 2 }), {}), { accepted: true });
  assert.deepEqual(world.publish(ISL, 'd1', 'kin', val([sess(1)], { seq: 9 }), { instance: 'cccccccccccccccc' }), { accepted: false, reason: 'other_instance' });
});

test('removeDevice and removeIsland emit', () => {
  const { world, events } = mkWorld();
  world.publish(ISL, 'd1', 'kin', val([sess(1)]));
  world.publish(ISL, 'd2', 'kin', val([sess(2)]));
  events.length = 0;
  world.removeDevice('d1');
  assert.equal(world.snapshotFor('i1').length, 1);
  assert.ok(!events.some((e) => e.type === 'remove'));
  events.length = 0;
  world.removeDevice('d2');
  assert.deepEqual(events.filter((e) => e.type === 'remove'), [{ type: 'remove', id: 'i1' }]);
  assert.deepEqual(world.islands(), []);
  world.publish(ISL, 'd3', 'kin', val([sess(1)]));
  world.removeIsland('i1');
  assert.deepEqual(world.islands(), []);
});

test('islands() carries the slot', () => {
  const { world } = mkWorld();
  world.publish({ ...ISL, slot: 5 }, 'd1', 'kin', val([sess(1)]));
  assert.equal(world.islands()[0].slot, 5);
});

test('removeIsland always emits remove then world, even when the island is not in RAM', () => {
  const { world, events } = mkWorld();
  world.removeIsland('ghost');
  assert.deepEqual(events, [{ type: 'remove', id: 'ghost' }, { type: 'world' }]);
});

// ---- integration ----
async function openStream(url, cookie) {
  const ac = new AbortController();
  const r = await fetch(url + '/api/world/stream', { headers: { cookie }, signal: ac.signal });
  const events = [];
  const waiters = [];
  let buf = '';
  let ended = false;
  const dec = new TextDecoder();
  const reader = r.body ? r.body.getReader() : null;
  const pump = async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /^event: (.+)$/m.exec(block); const data = /^data: (.+)$/m.exec(block);
          if (ev && data) events.push({ event: ev[1], data: JSON.parse(data[1]) });
        }
        waiters.splice(0).forEach((w) => w());
      }
    } catch { /* aborted */ }
    ended = true;
    waiters.splice(0).forEach((w) => w());
  };
  if (reader) pump();
  const until = async (pred, ms = 3000) => {
    const t0 = Date.now();
    for (;;) {
      const f = events.find(pred);
      if (f) return f;
      if (ended || Date.now() - t0 > ms) return null;
      await new Promise((res) => { waiters.push(res); setTimeout(res, 100); });
    }
  };
  return { r, events, until, isEnded: () => ended, waitEnd: async (ms = 3000) => { const t0 = Date.now(); while (!ended && Date.now() - t0 < ms) await new Promise((res) => { waiters.push(res); setTimeout(res, 50); }); return ended; }, close: () => ac.abort() };
}

const bearer = (token) => ({ authorization: 'Bearer ' + token });

async function setup() {
  const h = await startDevHub();
  const login = await devLogin(h.url, 'an@newera.inc', 'An');
  const dev = await pairDevice(h.url, login, 'Laptop');
  return { h, login, dev };
}

test('publish without token is 401, bad token too', async () => {
  const { h } = await setup();
  try {
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(1)]))).status, 401);
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer('trd_nope'))).status, 401);
  } finally { await h.close(); }
});

test('publish 200 {accepted:true}, 400 on bad schema, island id in the body is ignored (400)', async () => {
  const { h, dev } = await setup();
  try {
    const ok = await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token));
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { accepted: true });
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(1)], { island: 'abc' }), bearer(dev.token))).status, 400);
    assert.equal((await postJson(h.url, '/api/publish', { v: 1 }, bearer(dev.token))).status, 400);
    const bad = await fetch(h.url + '/api/publish', { method: 'POST', headers: bearer(dev.token), body: '{nope' });
    assert.equal(bad.status, 400);
    const big = await fetch(h.url + '/api/publish', { method: 'POST', headers: bearer(dev.token), body: JSON.stringify(pkt([sess(1)], { share: 'x'.repeat(20000) })) });
    assert.equal(big.status, 413);
    assert.equal(h.hub.world.islands().length, 1);
    assert.equal(h.hub.world.islands()[0].id, dev.island_id);
  } finally { await h.close(); }
});

test('a stale seq is answered accepted:false with the hub\'s seq', async () => {
  const { h, login, dev } = await setup();
  let st;
  try {
    const a = await postJson(h.url, '/api/publish', pkt([sess(1)], { seq: 5 }), bearer(dev.token));
    assert.equal(a.status, 200);
    assert.deepEqual(await a.json(), { accepted: true });
    st = await openStream(h.url, login.cookie);
    assert.ok(await st.until((e) => e.event === 'island' && e.data.sessions.length === 1));
    const n = st.events.filter((e) => e.event === 'island').length;
    const b = await postJson(h.url, '/api/publish', pkt([sess(1), sess(2)], { seq: 3 }), bearer(dev.token));
    assert.equal(b.status, 200);
    assert.deepEqual(await b.json(), { accepted: false, reason: 'stale_seq', seq: 5 });
    assert.equal(await st.until((e) => e.event === 'island' && e.data.sessions.length === 2, 700), null);
    assert.equal(st.events.filter((e) => e.event === 'island').length, n);
  } finally { if (st) st.close(); await h.close(); }
});

test('the instance header picks the publishing instance over HTTP', async () => {
  const { h, dev } = await setup();
  try {
    const pub = async (seq, instance) => {
      const r = await postJson(h.url, '/api/publish', pkt([sess(1)], { seq }), { ...bearer(dev.token), ...(instance ? { 'x-terrarium-instance': instance } : {}) });
      assert.equal(r.status, 200);
      return r.json();
    };
    assert.deepEqual(await pub(0, '0123456789abcdef'), { accepted: true });
    assert.deepEqual(await pub(1, 'fedcba9876543210'), { accepted: false, reason: 'other_instance' });
    assert.deepEqual(await pub(2), { accepted: false, reason: 'other_instance' }); // no header = legacy, another instance
    assert.deepEqual(await pub(2, '0123456789abcdef'), { accepted: true });
  } finally { await h.close(); }
});

test('a malformed instance header is ignored, not rejected', async () => {
  const { h, dev } = await setup();
  try {
    const r = await postJson(h.url, '/api/publish', pkt([sess(1)], { seq: 1 }), { ...bearer(dev.token), 'x-terrarium-instance': 'ZZZ' });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { accepted: true });
    // it counts as legacy, so a header-less publisher is the same instance
    const r2 = await postJson(h.url, '/api/publish', pkt([sess(1)], { seq: 2 }), bearer(dev.token));
    assert.deepEqual(await r2.json(), { accepted: true });
  } finally { await h.close(); }
});

test('the stream sends a named ping event', async () => {
  const h = await startDevHub({ deps: { pingMs: 50 } });
  const ac = new AbortController();
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    const r = await fetch(h.url + '/api/world/stream', { headers: { cookie: login.cookie }, signal: ac.signal });
    assert.equal(r.status, 200);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const t0 = Date.now();
    const timer = setTimeout(() => ac.abort(), 250);
    try {
      while (Date.now() - t0 < 200) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
      }
    } catch { /* aborted */ }
    clearTimeout(timer);
    const pings = buf.split('\n\n').filter((b) => /^event: ping$/m.test(b));
    assert.ok(pings.length >= 2, `got ${pings.length} pings`);
    for (const b of pings) {
      const data = /^data: (.+)$/m.exec(b);
      assert.ok(data);
      assert.equal(typeof JSON.parse(data[1]).t, 'number');
    }
    assert.equal(/^: ping$/m.test(buf), false);
  } finally { ac.abort(); await h.close(); }
});

test('publish is rate limited per device (429 with Retry-After)', async () => {
  const { h, dev } = await setup();
  try {
    const codes = [];
    for (let i = 0; i < 12; i++) { const r = await postJson(h.url, '/api/publish', pkt([sess(1)], { seq: i }), bearer(dev.token)); codes.push(r.status); if (r.status === 429) assert.ok(r.headers.get('retry-after')); }
    assert.equal(codes.filter((c) => c === 200).length, 8);
    assert.ok(codes.includes(429));
  } finally { await h.close(); }
});

test('revoked token is 401', async () => {
  const { h, login, dev } = await setup();
  try {
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token))).status, 200);
    h.clock.advance(1000);
    const r = await fetch(h.url + '/me/devices/revoke', { method: 'POST', redirect: 'manual', headers: { cookie: login.cookie, origin: h.url, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf: login.csrf, device_id: dev.device_id }) });
    assert.equal(r.status, 302);
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(1)], { seq: 2 }), bearer(dev.token))).status, 401);
  } finally { await h.close(); }
});

test('stream needs a session and sends world then island events', async () => {
  const { h, login, dev } = await setup();
  const streams = [];
  try {
    assert.equal((await fetch(h.url + '/api/world/stream')).status, 401);
    await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token));
    const st = await openStream(h.url, login.cookie);
    streams.push(st);
    assert.equal(st.r.status, 200);
    assert.match(st.r.headers.get('content-type'), /text\/event-stream/);
    assert.equal(st.r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(st.r.headers.get('referrer-policy'), 'same-origin');
    assert.match(st.r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    const w = await st.until((e) => e.event === 'world');
    assert.ok(w);
    assert.equal(w.data.islands.length, 1);
    assert.deepEqual(Object.keys(w.data.islands[0]).sort(), ['color', 'id', 'lastAt', 'name', 'online', 'private', 'share', 'slot']);
    assert.equal(w.data.islands[0].id, dev.island_id);
    assert.equal(w.data.viewers, 1);
    const isl = await st.until((e) => e.event === 'island');
    assert.equal(isl.data.id, dev.island_id);
    assert.equal(isl.data.sessions[0].id, sid(1));
    assert.equal(isl.data.sessions[0].project, 'A');
    await postJson(h.url, '/api/publish', pkt([sess(1), sess(2, { status: 'idle' })], { seq: 2 }), bearer(dev.token));
    const upd = await st.until((e) => e.event === 'island' && e.data.sessions.length === 2);
    assert.ok(upd);
    const st2 = await openStream(h.url, login.cookie);
    streams.push(st2);
    const w2 = await st.until((e) => e.event === 'world' && e.data.viewers === 2);
    assert.ok(w2);
  } finally { streams.forEach((s) => s.close()); await h.close(); }
});

test('revoking the last device leaves the island offline in its slot', async () => {
  const { h, login, dev } = await setup();
  let st;
  try {
    await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token));
    st = await openStream(h.url, login.cookie);
    assert.ok(await st.until((e) => e.event === 'island'));
    const r = await fetch(h.url + '/me/devices/revoke', { method: 'POST', redirect: 'manual', headers: { cookie: login.cookie, origin: h.url, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf: login.csrf, device_id: dev.device_id }) });
    assert.equal(r.status, 302);
    const w = await st.until((e) => e.event === 'world' && e.data.islands[0] && e.data.islands[0].online === false);
    assert.deepEqual(w.data.islands, [{ id: dev.island_id, name: w.data.islands[0].name, color: w.data.islands[0].color, slot: 0, online: false, private: false, share: 'kin', lastAt: null }]);
    assert.ok(await st.until((e) => e.event === 'island' && e.data.id === dev.island_id && e.data.sessions.length === 0));
    assert.equal(st.events.some((e) => e.event === 'remove'), false);
    assert.equal(h.hub.world.islands().length, 0);
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(1)], { seq: 2 }), bearer(dev.token))).status, 401);
    // revoke needs csrf
    const r2 = await fetch(h.url + '/me/devices/revoke', { method: 'POST', redirect: 'manual', headers: { cookie: login.cookie, origin: h.url, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf: 'bad', device_id: dev.device_id }) });
    assert.equal(r2.status, 403);
  } finally { st && st.close(); await h.close(); }
});

test('world events carry slot and capacity', async () => {
  const h = await startDevHub();
  let st;
  try {
    const an = await devLogin(h.url, 'an@newera.inc', 'An');
    const bo = await devLogin(h.url, 'bo@newera.inc', 'Bo');
    const a = await pairDevice(h.url, an, 'A');
    const b = await pairDevice(h.url, bo, 'B');
    await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(a.token));
    await postJson(h.url, '/api/publish', pkt([sess(2)]), bearer(b.token));
    st = await openStream(h.url, an.cookie);
    const w = await st.until((e) => e.event === 'world' && e.data.islands.length === 2);
    assert.equal(w.data.capacity, 8);
    assert.deepEqual(w.data.islands.map((i) => [i.id, i.slot, i.online]), [[a.island_id, 0, true], [b.island_id, 1, true]]);
  } finally { st && st.close(); await h.close(); }
});

test('an island with no device sending shows offline in its slot', async () => {
  const h = await startDevHub();
  let h2; let st;
  try {
    const an = await devLogin(h.url, 'an@newera.inc', 'An');
    const a = await pairDevice(h.url, an, 'A');
    await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(a.token));
    await h.hub.close(); // the RAM world is gone; the DB file stays
    h2 = await startDevHub({ env: { HUB_DB: h.config.dbPath } });
    const login = await devLogin(h2.url, 'an@newera.inc', 'An');
    st = await openStream(h2.url, login.cookie);
    const w = await st.until((e) => e.event === 'world');
    assert.equal(w.data.islands.length, 1);
    // a fresh hub has not heard from it yet: offline, and waking for the first 90 s (Task 8, H2)
    assert.deepEqual(w.data.islands[0], { id: a.island_id, name: w.data.islands[0].name, color: w.data.islands[0].color, slot: 0, online: false, private: false, share: 'kin', lastAt: null, waking: true });
    const isl = await st.until((e) => e.event === 'island' && e.data.id === a.island_id);
    assert.deepEqual(isl.data.sessions, []);
  } finally { st && st.close(); if (h2) await h2.close(); await h.close(); }
});

test('a hidden island publishes but is never sent to viewers', async () => {
  const h = await startDevHub();
  let st;
  try {
    const an = await devLogin(h.url, 'an@newera.inc', 'An');
    const bo = await devLogin(h.url, 'bo@newera.inc', 'Bo');
    const a = await pairDevice(h.url, an, 'A');
    const b = await pairDevice(h.url, bo, 'B');
    const raw = new DatabaseSync(h.config.dbPath);
    raw.prepare('UPDATE islands SET slot=NULL WHERE id=?').run(b.island_id);
    raw.close();
    st = await openStream(h.url, an.cookie);
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(2)]), bearer(b.token))).status, 200);
    await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(a.token));
    assert.ok(await st.until((e) => e.event === 'island' && e.data.id === a.island_id && e.data.sessions.length === 1));
    await new Promise((res) => setTimeout(res, 700)); // past the island throttle
    assert.equal(st.events.some((e) => e.event === 'island' && e.data.id === b.island_id), false);
    assert.equal(st.events.some((e) => e.event === 'world' && e.data.islands.some((i) => i.id === b.island_id)), false);
  } finally { st && st.close(); await h.close(); }
});

test('a promoted hidden island appears in its new slot', async () => {
  const h = await startDevHub();
  let st;
  try {
    const boss = await devLogin(h.url, 'boss@newera.inc', 'Boss');
    const ids = [];
    for (let i = 0; i < 8; i++) {
      const u = await devLogin(h.url, `u${i}@newera.inc`, 'U' + i);
      ids.push((await pairDevice(h.url, u, 'M' + i)).island_id);
    }
    const raw = new DatabaseSync(h.config.dbPath);
    raw.prepare('UPDATE islands SET slot=NULL WHERE id=?').run(ids[7]); // the ninth, hidden one
    raw.close();
    st = await openStream(h.url, boss.cookie);
    assert.ok(await st.until((e) => e.event === 'world'));
    const r = await postJson(h.url, `/api/owner/islands/${ids[4]}/remove`, {}, { cookie: boss.cookie, origin: h.url, 'x-csrf-token': boss.csrf });
    assert.equal(r.status, 200);
    assert.ok(await st.until((e) => e.event === 'remove' && e.data.id === ids[4]));
    const w = await st.until((e) => e.event === 'world' && e.data.islands.some((i) => i.id === ids[7]));
    assert.equal(w.data.islands.find((i) => i.id === ids[7]).slot, 4);
    assert.equal(w.data.islands.some((i) => i.id === ids[4]), false);
  } finally { st && st.close(); await h.close(); }
});

test('a promoted hidden island that was already publishing sends its sessions on promotion', async () => {
  const h = await startDevHub();
  let st;
  try {
    const boss = await devLogin(h.url, 'boss@newera.inc', 'Boss');
    const ids = []; let hiddenTok;
    for (let i = 0; i < 8; i++) {
      const u = await devLogin(h.url, `u${i}@newera.inc`, 'U' + i);
      const d = await pairDevice(h.url, u, 'M' + i);
      ids.push(d.island_id); if (i === 7) hiddenTok = d.token;
    }
    const raw = new DatabaseSync(h.config.dbPath);
    raw.prepare('UPDATE islands SET slot=NULL WHERE id=?').run(ids[7]);
    raw.close();
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(9), sess(10)]), bearer(hiddenTok))).status, 200);
    st = await openStream(h.url, boss.cookie);
    assert.ok(await st.until((e) => e.event === 'world'));
    const r = await postJson(h.url, `/api/owner/islands/${ids[4]}/remove`, {}, { cookie: boss.cookie, origin: h.url, 'x-csrf-token': boss.csrf });
    assert.equal(r.status, 200);
    const isl = await st.until((e) => e.event === 'island' && e.data.id === ids[7] && e.data.sessions.length === 2);
    assert.ok(isl, 'the promoted island sends its live sessions');
    await new Promise((res) => setTimeout(res, 700)); // past the island throttle
    assert.equal(st.events.filter((e) => e.event === 'island' && e.data.id === ids[7]).length, 1, 'sent once');
  } finally { st && st.close(); await h.close(); }
});

test('removing an island does not re-send the other live islands', async () => {
  const h = await startDevHub();
  let st;
  try {
    const boss = await devLogin(h.url, 'boss@newera.inc', 'Boss');
    const devs = [];
    for (let i = 0; i < 3; i++) devs.push(await pairDevice(h.url, await devLogin(h.url, `u${i}@newera.inc`, 'U' + i), 'M' + i));
    for (const [i, d] of devs.slice(0, 2).entries()) assert.equal((await postJson(h.url, '/api/publish', pkt([sess(i + 1)]), bearer(d.token))).status, 200);
    st = await openStream(h.url, boss.cookie);
    for (const d of devs.slice(0, 2)) assert.ok(await st.until((e) => e.event === 'island' && e.data.id === d.island_id && e.data.sessions.length === 1));
    const count = (id) => st.events.filter((e) => e.event === 'island' && e.data.id === id).length;
    const before = devs.slice(0, 2).map((d) => count(d.island_id));
    const r = await postJson(h.url, `/api/owner/islands/${devs[2].island_id}/remove`, {}, { cookie: boss.cookie, origin: h.url, 'x-csrf-token': boss.csrf });
    assert.equal(r.status, 200);
    assert.ok(await st.until((e) => e.event === 'remove' && e.data.id === devs[2].island_id));
    await new Promise((res) => setTimeout(res, 700)); // past the island throttle
    assert.deepEqual(devs.slice(0, 2).map((d) => count(d.island_id)), before);
  } finally { st && st.close(); await h.close(); }
});

test('island events do not read the island row from the DB', async () => {
  const { h, dev } = await setup();
  try {
    let reads = 0;
    const orig = h.hub.db.getIsland;
    h.hub.db.getIsland = (...a) => { reads++; return orig(...a); };
    try {
      for (let i = 1; i <= 3; i++) assert.equal((await postJson(h.url, '/api/publish', pkt([sess(i)], { seq: i }), bearer(dev.token))).status, 200);
      await new Promise((res) => setTimeout(res, 600)); // let a trailing send run
    } finally { h.hub.db.getIsland = orig; }
    assert.equal(reads, 0);
  } finally { await h.close(); }
});

test('owner removal still sends remove for an island that is offline', async () => {
  const h = await startDevHub();
  let st;
  try {
    const boss = await devLogin(h.url, 'boss@newera.inc', 'Boss');
    const an = await devLogin(h.url, 'an@newera.inc', 'An');
    const a = await pairDevice(h.url, an, 'A'); // never publishes: not in RAM
    st = await openStream(h.url, boss.cookie);
    assert.ok(await st.until((e) => e.event === 'world' && e.data.islands.length === 1));
    const r = await postJson(h.url, `/api/owner/islands/${a.island_id}/remove`, {}, { cookie: boss.cookie, origin: h.url, 'x-csrf-token': boss.csrf });
    assert.equal(r.status, 200);
    assert.ok(await st.until((e) => e.event === 'remove' && e.data.id === a.island_id));
    assert.ok(await st.until((e) => e.event === 'world' && e.data.islands.length === 0));
  } finally { st && st.close(); await h.close(); }
});

test('one user cannot revoke another user\'s device', async () => {
  const { h, dev } = await setup();
  try {
    const other = await devLogin(h.url, 'bo@newera.inc', 'Bo');
    await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token));
    await fetch(h.url + '/me/devices/revoke', { method: 'POST', redirect: 'manual', headers: { cookie: other.cookie, origin: h.url, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf: other.csrf, device_id: dev.device_id }) });
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(1)], { seq: 2 }), bearer(dev.token))).status, 200);
  } finally { await h.close(); }
});

test('logout closes the open stream', async () => {
  const { h, login } = await setup();
  let st;
  try {
    st = await openStream(h.url, login.cookie);
    assert.ok(await st.until((e) => e.event === 'world'));
    const r = await fetch(h.url + '/auth/logout', { method: 'POST', headers: { cookie: login.cookie, origin: h.url, 'x-csrf-token': login.csrf } });
    assert.equal(r.status, 200);
    assert.equal(await st.waitEnd(), true);
  } finally { st && st.close(); await h.close(); }
});

test('stream closes when the session row is gone, expired or the user is banned (periodic check)', async () => {
  const { h, login } = await setup();
  const opened = [];
  try {
    const a = await openStream(h.url, login.cookie); opened.push(a);
    assert.ok(await a.until((e) => e.event === 'world'));
    h.hub.ctx.streams.check();
    assert.equal(a.isEnded(), false);
    // expiry
    h.clock.advance(8 * 24 * 3600 * 1000);
    h.hub.ctx.streams.check();
    assert.equal(await a.waitEnd(), true);
    // row deleted by cleanup without listeners
    const l2 = await devLogin(h.url, 'c@newera.inc', 'C');
    const b = await openStream(h.url, l2.cookie); opened.push(b);
    assert.ok(await b.until((e) => e.event === 'world'));
    h.hub.db.raw.prepare('DELETE FROM sessions').run();
    h.hub.ctx.streams.check();
    assert.equal(await b.waitEnd(), true);
    // banned
    const l3 = await devLogin(h.url, 'd@newera.inc', 'D');
    const c = await openStream(h.url, l3.cookie); opened.push(c);
    assert.ok(await c.until((e) => e.event === 'world'));
    const u = h.hub.db.getUserBySub('dev:d@newera.inc');
    h.hub.db.setUserBanned(u.id, h.clock.t);
    h.hub.ctx.streams.check();
    assert.equal(await c.waitEnd(), true);
  } finally { opened.forEach((s) => s.close()); await h.close(); }
});

test('world state rebuilds from the next publish after a restart', async () => {
  const h1 = await startDevHub();
  const login = await devLogin(h1.url, 'an@newera.inc', 'An');
  const dev = await pairDevice(h1.url, login, 'Laptop');
  const dbPath = h1.config.dbPath;
  const port = h1.config.port;
  const { createHub } = require('../hub/server.js');
  const { loadConfig } = require('../hub/config.js');
  let st, hub2;
  try {
    assert.equal((await postJson(h1.url, '/api/publish', pkt([sess(1)], { seq: 40 }), bearer(dev.token))).status, 200);
    const cfg = h1.config;
    await h1.hub.close(); // keep the temp dir until the end
    hub2 = createHub(loadConfig({ HUB_PUBLIC_URL: cfg.publicUrl, HUB_ALLOWED_DOMAINS: 'newera.inc', HUB_OWNER_EMAILS: 'boss@newera.inc', HUB_SECRET_KEY: cfg.secretKey.toString('base64'), HUB_DEV_LOGIN: '1', HUB_DB: dbPath, HUB_PORT: String(port) }), { now: () => h1.clock.t, log: () => {} });
    await new Promise((res, rej) => { hub2.server.once('error', rej); hub2.server.listen(port, '127.0.0.1', res); });
    assert.equal(hub2.world.islands().length, 0);
    await new Promise((r) => setTimeout(r, 50));
    st = await openStream(h1.url, login.cookie); // fresh sockets: undici may hold a dead keep-alive one
    const w = await st.until((e) => e.event === 'world');
    assert.deepEqual(w.data.islands.map((i) => [i.id, i.online]), [[dev.island_id, false]]); // still in its slot, offline
    // the restarted publisher begins again at seq 0, the hub never saw its old seq
    assert.equal((await postJson(h1.url, '/api/publish', pkt([sess(1)], { seq: 3 }), { ...bearer(dev.token), connection: 'close' })).status, 200);
    const isl = await st.until((e) => e.event === 'island' && e.data.sessions.length === 1);
    assert.equal(isl.data.id, dev.island_id);
    const w2 = await st.until((e) => e.event === 'world' && e.data.islands.length === 1 && e.data.islands[0].online);
    assert.ok(w2);
  } finally { st && st.close(); hub2 && await hub2.close(); await h1.close(); }
});

test('GET / without session shows the welcome page; with session serves the world page', async () => {
  const { h, login } = await setup();
  try {
    const r = await fetch(h.url + '/', { redirect: 'manual' });
    assert.equal(r.status, 200);
    const welcome = await r.text();
    assert.match(welcome, /href="\/auth\/login"/);
    assert.ok(!/<script/i.test(welcome), 'welcome page carries no script');
    assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
    const ok = await fetch(h.url + '/', { headers: { cookie: login.cookie } });
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-type'), /text\/html/);
    assert.match(ok.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.match(await ok.text(), /<title>Claude Office<\/title>/);
  } finally { await h.close(); }
});

test('/me lists devices, escapes names, has revoke and logout forms', async () => {
  const h = await startDevHub();
  try {
    assert.equal((await fetch(h.url + '/me', { redirect: 'manual' })).status, 302);
    const login = await devLogin(h.url, 'an@newera.inc', 'An <b>');
    await pairDevice(h.url, login, '<script>alert(1)</script>');
    const r = await fetch(h.url + '/me', { headers: { cookie: login.cookie } });
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(!html.includes('<script>alert'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(html.includes('action="/me/devices/revoke"'));
    assert.ok(html.includes('action="/auth/logout"'));
    assert.ok(html.includes(login.csrf));
    assert.ok(html.includes('Đảo An &lt;b&gt;'));
    // form logout works with csrf field
    const out = await fetch(h.url + '/auth/logout', { method: 'POST', redirect: 'manual', headers: { cookie: login.cookie, origin: h.url, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf: login.csrf }) });
    assert.equal(out.status, 302);
    assert.equal((await fetch(h.url + '/me', { headers: { cookie: login.cookie }, redirect: 'manual' })).status, 302);
  } finally { await h.close(); }
});

test('device of a user without refresh token gets 403 login_required after 24 h', async () => {
  const h = await startDevHub();
  try {
    const login = await devLogin(h.url, 'an@newera.inc', 'An');
    const dev = await pairDevice(h.url, login, 'Laptop');
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token))).status, 200);
    h.clock.advance(24 * 3600 * 1000);
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token))).status, 200); // exactly 24 h is still fine
    h.clock.advance(1);
    const late = await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token));
    assert.equal(late.status, 403);
    assert.deepEqual(await late.json(), { error: 'login_required' });
    // a fresh login brings it back
    await devLogin(h.url, 'an@newera.inc', 'An');
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token))).status, 200);
    // a revoked device is still a plain 401, even when stale
    h.clock.advance(25 * 3600 * 1000);
    h.hub.db.revokeDevicesForUser(h.hub.db.getUserBySub('dev:an@newera.inc').id, h.clock.t);
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token))).status, 401);
  } finally { await h.close(); }
});

test('a user with a refresh token never gets login_required', async () => {
  const google = makeGoogle({ now: () => NOW });
  const h = await startDevHub({ google });
  try {
    const login = await googleLogin(h.url, google, 'an@newera.inc', { name: 'An' });
    const dev = await pairDevice(h.url, login, 'Laptop');
    h.clock.advance(30 * 24 * 3600 * 1000);
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token))).status, 200);
  } finally { await h.close(); }
});

test('re-login closes the event stream of the old session', async () => {
  const google = makeGoogle({ now: () => NOW });
  const h = await startDevHub({ google });
  try {
    const a = await googleLogin(h.url, google, 'an@newera.inc', { name: 'An' });
    const st = await openStream(h.url, a.cookie);
    try {
      await st.until((e) => e.event === 'world');
      const b = await googleLogin(h.url, google, 'an@newera.inc', { name: 'An', cookie: a.cookie });
      assert.notEqual(b.cookie, a.cookie);
      assert.equal(await st.waitEnd(), true);
    } finally { st.close(); }
  } finally { await h.close(); }
});

test('more than 16 letter rooms over two machines keep distinct labels', () => {
  const w = createWorld({ now: () => NOW });
  const L = 'ABCDEFGHIJKL';
  const mk = (base) => [...L].map((l, i) => sess(base + i, { dept: l }));
  const isl = { id: 'isl1', name: 'x', color: '#000000' };
  w.publish(isl, 'dev1', 'kin', { seq: 1, sessions: mk(100) });
  w.publish(isl, 'dev2', 'kin', { seq: 1, sessions: mk(200) });
  const labels = w.snapshotFor('isl1').map((s) => s.project);
  assert.equal(labels.length, 24);
  assert.equal(new Set(labels).size, 24);
});

// ---- Task 8: batched world events, waking islands, stable room labels ----
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const worlds = (st) => st.events.filter((e) => e.event === 'world');
const revoke = (h, login, deviceId) => fetch(h.url + '/me/devices/revoke', { method: 'POST', redirect: 'manual', headers: { cookie: login.cookie, origin: h.url, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf: login.csrf, device_id: deviceId }) });

test('viewers reconnecting cause at most one world broadcast per second', async () => {
  const h = await startDevHub();
  const streams = [];
  try {
    const dev = await pairDevice(h.url, await devLogin(h.url, 'an@newera.inc', 'An'), 'Laptop');
    assert.equal((await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token))).status, 200);
    const logins = [];
    for (let p = 0; p < 20; p++) logins.push(await devLogin(h.url, `v${p}@newera.inc`, 'V' + p));
    await sleep(1100); // past any broadcast from the publish
    const before = h.hub.ctx.stats.worldBroadcasts;
    const t0 = Date.now();
    // 20 people x 5 tabs, spread over ~2 s
    for (let round = 0; round < 5; round++) {
      streams.push(...await Promise.all(logins.map((l) => openStream(h.url, l.cookie))));
      if (round < 4) await sleep(400);
    }
    assert.ok(Date.now() - t0 < 3000, 'opened within the window');
    for (const st of streams) assert.ok(await st.until((e) => e.event === 'world'), 'every stream gets its own first world');
    await sleep(1100); // let the trailing send run
    const n = h.hub.ctx.stats.worldBroadcasts - before;
    assert.ok(n >= 1 && n <= 4, `world broadcasts: ${n}`);
    assert.ok(h.hub.ctx.stats.framesWritten > 0);
  } finally { streams.forEach((s) => s.close()); await h.close(); }
});

test('a newcomer gets its first world at once, alone', async () => {
  const { h, login } = await setup();
  let a, b;
  try {
    a = await openStream(h.url, login.cookie);
    assert.ok(await a.until((e) => e.event === 'world'));
    await sleep(1600); // A's own trailing send (due ~1 s after it joined) is over, with slack for a loaded machine
    const n = worlds(a).length;
    const t0 = Date.now();
    b = await openStream(h.url, login.cookie);
    const first = await b.until((e) => e.event === 'world', 500);
    assert.ok(first, 'the newcomer has a world at once');
    assert.equal(first.data.viewers, 2);
    await sleep(Math.max(0, 900 - (Date.now() - t0)));
    assert.equal(worlds(a).length, n, 'nobody else gets a world in the first second');
  } finally { a && a.close(); b && b.close(); await h.close(); }
});

test('the viewer count still reaches everyone within a second', async () => {
  const { h, login } = await setup();
  let a, b;
  try {
    a = await openStream(h.url, login.cookie);
    assert.ok(await a.until((e) => e.event === 'world'));
    await sleep(1100);
    b = await openStream(h.url, login.cookie);
    assert.ok(await a.until((e) => e.event === 'world' && e.data.viewers === 2, 1100)); // 1 s + slack
    b.close();
    assert.ok(await a.until((e) => e.event === 'world' && e.data.viewers === 1 && worlds(a).indexOf(e) > 0, 1100));
  } finally { a && a.close(); b && b.close(); await h.close(); }
});

test('an identical world is not sent twice', async () => {
  const { h, login, dev } = await setup();
  let st;
  try {
    await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token));
    st = await openStream(h.url, login.cookie);
    assert.ok(await st.until((e) => e.event === 'island' && e.data.sessions.length === 1));
    await sleep(1100);
    const n = worlds(st).length;
    assert.equal((await revoke(h, login, dev.device_id)).status, 302);
    assert.ok(await st.until((e) => e.event === 'world' && e.data.islands[0].online === false));
    await sleep(1200); // any trailing send has run
    assert.equal(worlds(st).length - n, 1, 'exactly one world for the change');
  } finally { st && st.close(); await h.close(); }
});

test('islands not heard from since the hub started are waking for 90 s, then offline', async () => {
  const h = await startDevHub();
  let h2, st;
  try {
    const a = await pairDevice(h.url, await devLogin(h.url, 'an@newera.inc', 'An'), 'A');
    const b = await pairDevice(h.url, await devLogin(h.url, 'bo@newera.inc', 'Bo'), 'B');
    await h.hub.close();
    h2 = await startDevHub({ env: { HUB_DB: h.config.dbPath }, deps: { wakeMs: 150 } });
    assert.equal((await postJson(h2.url, '/api/publish', pkt([sess(1)]), bearer(a.token))).status, 200);
    st = await openStream(h2.url, (await devLogin(h2.url, 'an@newera.inc', 'An')).cookie);
    const w = await st.until((e) => e.event === 'world' && e.data.islands.length === 2);
    const byId = Object.fromEntries(w.data.islands.map((i) => [i.id, i]));
    assert.equal(byId[a.island_id].online, true);
    assert.equal('waking' in byId[a.island_id], false);
    assert.equal(byId[b.island_id].online, false);
    assert.equal(byId[b.island_id].waking, true);
    await sleep(400); // the timer fires, but the hub's clock is still inside the window
    assert.equal(st.events.some((e) => e.event === 'world' && e.data.islands.every((i) => !i.waking)), false);
    h2.clock.advance(90_000);
    const w2 = await st.until((e) => e.event === 'world' && e.data.islands.every((i) => !('waking' in i)), 2500);
    assert.ok(w2, 'the waking flag goes away after 90 s');
    assert.equal(w2.data.islands.find((i) => i.id === b.island_id).online, false);
  } finally { st && st.close(); if (h2) await h2.close(); await h.close(); }
});

test('a device going offline does not relabel the other device\'s rooms', () => {
  const { world, clock } = mkWorld();
  world.publish(ISL, 'd1', 'kin', val([sess(1, { dept: 'A' }), sess(2, { dept: 'B' })]));
  world.publish(ISL, 'd2', 'kin', val([sess(3, { dept: 'A' })]));
  const labels = () => Object.fromEntries(world.snapshotFor('i1').map((x) => [x.id, x.project]));
  assert.deepEqual(labels(), { [sid(1)]: 'A', [sid(2)]: 'B', [sid(3)]: 'C' });
  clock.t += 60_000;
  world.publish(ISL, 'd2', 'kin', val([sess(3, { dept: 'A' })], { seq: 2 }));
  clock.t += 40_000; // d1 silent for 100 s
  world.tick();
  assert.deepEqual(labels(), { [sid(3)]: 'C' });
});

test('room labels survive a device reconnecting', () => {
  const { world, clock } = mkWorld();
  world.publish(ISL, 'd1', 'kin', val([sess(1, { dept: 'A' }), sess(2, { dept: 'B' })]));
  world.publish(ISL, 'd2', 'kin', val([sess(3, { dept: 'A' })]));
  clock.t += 100_000; // both offline
  world.tick();
  // d2 comes back first, then d1
  world.publish(ISL, 'd2', 'kin', val([sess(3, { dept: 'A' })], { seq: 0 }));
  assert.equal(world.snapshotFor('i1')[0].project, 'C');
  world.publish(ISL, 'd1', 'kin', val([sess(1, { dept: 'A' }), sess(2, { dept: 'B' })], { seq: 0 }));
  const s = Object.fromEntries(world.snapshotFor('i1').map((x) => [x.id, x.project]));
  assert.deepEqual(s, { [sid(1)]: 'A', [sid(2)]: 'B', [sid(3)]: 'C' });
  // a new letter on d2 gets the next free label, never one already given
  world.publish(ISL, 'd2', 'kin', val([sess(3, { dept: 'A' }), sess(4, { dept: 'B' })], { seq: 1 }));
  assert.equal(world.snapshotFor('i1').find((x) => x.id === sid(4)).project, 'D');
});

test('a newcomer whose private world differs from the last broadcast still gets the trailing change', async () => {
  const { h, login } = await setup();
  let a, b;
  try {
    a = await openStream(h.url, login.cookie);
    assert.ok(await a.until((e) => e.event === 'world'));
    await sleep(1100); // the last broadcast says 1 viewer
    b = await openStream(h.url, login.cookie);
    assert.ok(await b.until((e) => e.event === 'world' && e.data.viewers === 2, 500));
    a.close(); // back to 1 viewer: the same frame as the last broadcast, but not what B has
    assert.ok(await b.until((e) => e.event === 'world' && e.data.viewers === 1, 1500), 'B learns A left');
  } finally { a && a.close(); b && b.close(); await h.close(); }
});

test('world items carry lastAt and the payload carries now', async () => {
  const { h, login, dev } = await setup();
  try {
    const other = await devLogin(h.url, 'bo@newera.inc', 'Bo'); // an island with no machine in RAM
    await pairDevice(h.url, other, 'May B');
    await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token));
    const t = h.clock.t;
    h.clock.advance(5000);
    const st = await openStream(h.url, login.cookie);
    const w = await st.until((e) => e.event === 'world');
    assert.equal(w.data.now, h.clock.t);
    assert.equal(w.data.islands.find((i) => i.id === dev.island_id).lastAt, t);
    assert.ok(w.data.islands.some((i) => i.lastAt === null));
    st.close();
  } finally { await h.close(); }
});

test('the world payload keeps every field it had', async () => {
  const { h, login, dev } = await setup();
  try {
    await postJson(h.url, '/api/publish', pkt([sess(1)]), bearer(dev.token));
    const st = await openStream(h.url, login.cookie);
    const w = await st.until((e) => e.event === 'world');
    for (const k of ['islands', 'viewers', 'capacity']) assert.ok(k in w.data, k);
    for (const k of ['id', 'name', 'color', 'slot', 'online', 'private', 'share']) assert.ok(k in w.data.islands[0], k);
    st.close();
  } finally { await h.close(); }
});

test('lastAt moving does not make the valve send more than once per window', async () => {
  const { h, login, dev } = await setup();
  try {
    const st = await openStream(h.url, login.cookie);
    await st.until((e) => e.event === 'world');
    const before = h.hub.ctx.stats.worldBroadcasts;
    for (let i = 0; i < 6; i++) { h.clock.advance(100); await postJson(h.url, '/api/publish', pkt([sess(1)], { seq: i }), bearer(dev.token)); }
    await new Promise((r) => setTimeout(r, 1300));
    assert.ok(h.hub.ctx.stats.worldBroadcasts - before <= 2);
    st.close();
  } finally { await h.close(); }
});
