// Old/new compatibility matrix (spec 9.1): publisher x hub across the connection-hardening upgrade.
// "Old" is the code at 21e9bd8 (parent of the first hardening commit), extracted with `git archive` into a temp dir
// and loaded by absolute path; nothing in the working tree or the git stash is touched. Skips when git or that commit
// is unavailable (a shallow clone, a source tarball).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { startDevHub, devLogin, pairDevice } from './hub-helpers.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const OLD_REF = '21e9bd8';
const SALT = 'ab'.repeat(32);

let oldRoot = null, skip = false;
try {
  execFileSync('git', ['cat-file', '-e', OLD_REF + '^{commit}'], { cwd: ROOT, stdio: 'ignore' });
  oldRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-old-'));
  const tar = execFileSync('git', ['archive', OLD_REF, 'lib', 'hub', 'claude-office.html'], { cwd: ROOT, maxBuffer: 64 << 20 });
  execFileSync('tar', ['-x', '-C', oldRoot], { input: tar });
} catch { skip = 'old code (' + OLD_REF + ') is not available from git'; }
test.after(() => { if (oldRoot) fs.rmSync(oldRoot, { recursive: true, force: true }); });

const NEW = { startPublisher: require('../lib/publisher.js').startPublisher, writeConfig: require('../lib/terrarium-config.js').writeConfig };
const old = (rel) => require(path.join(oldRoot, rel));

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

// The old hub, built from the extracted code the way startDevHub builds the new one. Real clock.
async function startOldHub() {
  const { loadConfig } = old('hub/config.js'), { createHub } = old('hub/server.js');
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-oldhub-'));
  const url = `http://127.0.0.1:${port}`, logs = [];
  const config = loadConfig({
    HUB_PUBLIC_URL: url, HUB_ALLOWED_DOMAINS: 'newera.inc', HUB_OWNER_EMAILS: 'boss@newera.inc',
    HUB_SECRET_KEY: crypto.randomBytes(32).toString('base64'), HUB_DEV_LOGIN: '1', HUB_DB: path.join(dir, 'hub.sqlite'), HUB_PORT: String(port),
  });
  const hub = createHub(config, { log: (l) => logs.push(l) });
  await new Promise((resolve, reject) => { hub.server.once('error', reject); hub.server.listen(port, '127.0.0.1', resolve); });
  return { url, hub, logs, close: async () => { await hub.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
const startNewHub = (opts) => startDevHub(opts);

const snap = () => ({ at: 1, usage: {}, version: 'x', sessions: [{ id: 's1', name: 'n', project: 'p', cwd: '/x', status: 'working', tool: 'Bash', parentId: null, updatedAt: 1 }] });
const until = async (fn, ms = 8000) => {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await new Promise((r) => setTimeout(r, 50)); }
};

// One device paired against `hub`, a config dir for it, and a starter that records every publish status.
async function device(hub, who) {
  const dev = await pairDevice(hub.url, await devLogin(hub.url, 'ann@newera.inc', 'Ann'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-cfg-'));
  NEW.writeConfig(dir, { hub: hub.url, token: dev.token, deviceId: dev.device_id, islandId: dev.island_id, salt: SALT, share: 'kin', private: false, projects: [] });
  const statuses = [], pubs = [];
  const start = (lib, extra = {}) => {
    const fetch = async (u, o) => { const r = await globalThis.fetch(u, o); if (String(u).endsWith('/api/publish')) statuses.push(r.status); return r; };
    const p = lib.startPublisher({ getSnapshot: snap, dir, fetch, log() {}, ...extra });
    pubs.push(p); return p;
  };
  const online = () => { const i = hub.hub.world.islands().find((x) => x.id === dev.island_id); return !!(i && i.online); };
  const cleanup = () => { for (const p of pubs) p.stop(); fs.rmSync(dir, { recursive: true, force: true }); };
  return { dev, dir, statuses, start, online, cleanup, who };
}

const oldPub = () => old('lib/publisher.js');

test('old publisher -> new hub: every publish is 200, publisher is sending, island online; two old publishers on one device are fine', { skip }, async () => {
  const hub = await startNewHub({ now: Date.now });
  const d = await device(hub);
  try {
    const a = d.start(oldPub());
    assert.ok(await until(() => a.state().state === 'sending' && d.online()), 'sending and online');
    const b = d.start(oldPub());
    assert.ok(await until(() => d.statuses.length >= 2));
    assert.equal(a.state().state, 'sending');
    assert.equal(b.state().state, 'sending');
    assert.ok(d.online());
    assert.ok(d.statuses.every((s) => s === 200), 'statuses: ' + d.statuses);
  } finally { d.cleanup(); await hub.close(); }
});

test('new publisher -> old hub: every publish is 204 (legacy ack), sending, no 400 in the hub log', { skip }, async () => {
  const hub = await startOldHub();
  const d = await device(hub);
  try {
    const p = d.start(NEW);
    assert.ok(await until(() => p.state().state === 'sending' && d.online()), 'sending and online');
    assert.ok(await until(() => d.statuses.length >= 1));
    assert.ok(d.statuses.every((s) => s === 204), 'statuses: ' + d.statuses);
    assert.ok(!hub.logs.some((l) => /\b400\b|bad packet/.test(String(l))), 'hub log: ' + hub.logs.join('|'));
  } finally { d.cleanup(); await hub.close(); }
});

test('new publisher -> new hub: two publishers on one device, the later one sends, the earlier stands by; the standby takes over after the sender stops', { skip }, async () => {
  const hub = await startNewHub(); // controllable hub clock
  const d = await device(hub);
  try {
    let skew = 0; // the publishers' clock, so the 30 s standby retry can be crossed without waiting
    const now = () => Date.now() + skew;
    const first = d.start(NEW, { now });
    assert.ok(await until(() => first.state().state === 'sending'));
    const second = d.start(NEW, { now });
    assert.ok(await until(() => second.state().state === 'sending'));
    skew += 31000; // unchanged views are only resent on the 30 s heartbeat: the first one learns it lost the device then
    assert.ok(await until(() => first.state().state === 'standby'), `first=${first.state().state} second=${second.state().state}`);
    // stop the one that is sending (by handle, never by process name), let the hub's 90 s silence window pass
    second.stop();
    // A send of the stopped one already in flight can still land after the clocks move and refresh its 90 s window;
    // keep both clocks moving past each standby retry until the first one takes over.
    let took = false;
    for (let i = 0; i < 6 && !took; i++) {
      skew += i ? 31000 : 100000;
      hub.clock.advance(i ? 31000 : 100000);
      took = await until(() => first.state().state === 'sending' && d.statuses.slice(-1)[0] === 200, 3000);
    }
    assert.ok(took, `first=${first.state().state}`);
    assert.ok(d.online());
  } finally { d.cleanup(); await hub.close(); }
});

test('old publisher -> old hub (baseline): 204, sending, island online', { skip }, async () => {
  const hub = await startOldHub();
  const d = await device(hub);
  try {
    const p = d.start(oldPub());
    assert.ok(await until(() => p.state().state === 'sending' && d.online()));
    assert.ok(await until(() => d.statuses.length >= 1));
    assert.ok(d.statuses.every((s) => s === 204), 'statuses: ' + d.statuses);
  } finally { d.cleanup(); await hub.close(); }
});
