import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { openDb, SCHEMA_VERSION, MAX_ISLANDS } = require('../hub/db.js');
const { DatabaseSync } = require('node:sqlite');

// Verbatim copy of the GD1 schema (hub/db.js at commit 1a3af72).
const GD1_SCHEMA = `
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, google_sub TEXT UNIQUE NOT NULL, email TEXT, name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','admin','member')),
  banned_at INTEGER, created_at INTEGER NOT NULL, last_login_at INTEGER);
CREATE TABLE IF NOT EXISTS islands(
  id TEXT PRIMARY KEY, user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  name TEXT NOT NULL, color TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS devices(
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL, last_used_at INTEGER, revoked_at INTEGER);
CREATE TABLE IF NOT EXISTS device_codes(
  code_hash TEXT PRIMARY KEY, user_code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, approved_user_id INTEGER,
  denied INTEGER NOT NULL DEFAULT 0, last_poll_at INTEGER, ip TEXT);
CREATE TABLE IF NOT EXISTS sessions(
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), csrf TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_states(
  state TEXT PRIMARY KEY, nonce TEXT NOT NULL, verifier TEXT NOT NULL, created_at INTEGER NOT NULL);
`;

const DAY = 86400000;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hub-mig-'));
const cols = (db, t) => db.raw.prepare(`PRAGMA table_info(${t})`).all().map((r) => r.name);
const version = (db) => db.raw.prepare('PRAGMA user_version').get().user_version;

function buildGd1(file) {
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA foreign_keys=ON');
  raw.exec(GD1_SCHEMA);
  raw.prepare("INSERT INTO users(id, google_sub, email, name, role, created_at, last_login_at) VALUES(7,'g7','a@newera.inc','A','owner',1000,2000)").run();
  raw.prepare("INSERT INTO islands(id, user_id, name, color, created_at) VALUES('isl1',7,'Isle','#fff',1500)").run();
  raw.prepare("INSERT INTO devices(id, user_id, name, token_hash, created_at) VALUES('dev1',7,'mac','th',1600)").run();
  raw.prepare('INSERT INTO sessions(token_hash, user_id, csrf, created_at, expires_at) VALUES(?,?,?,?,?)').run('sh', 7, 'c', 5000, 5000 + 7 * DAY);
  raw.prepare("INSERT INTO login_states(state, nonce, verifier, created_at) VALUES('st','n','v',9)").run();
  raw.close();
}

test('a GD1 database is upgraded in place', () => {
  const file = path.join(tmp(), 'hub.sqlite');
  buildGd1(file);
  const db = openDb(file);
  assert.equal(SCHEMA_VERSION, 3);
  assert.equal(version(db), SCHEMA_VERSION);
  assert.equal(db.getIsland('isl1').slot, 0);
  assert.ok(cols(db, 'device_codes').includes('deny_reason'));
  const uc = cols(db, 'users');
  for (const c of ['refresh_enc', 'checked_at', 'check_fail_since', 'check_warned_at', 'ban_reason']) assert.ok(uc.includes(c), c);
  assert.ok(!uc.includes('role'));
  const u = db.getUserById(7);
  assert.equal(u.google_sub, 'g7');
  assert.equal(u.email, 'a@newera.inc');
  assert.equal(u.created_at, 1000);
  assert.equal(u.last_login_at, 2000);
  assert.equal(db.getIsland('isl1').user_id, 7);
  assert.equal(db.getIsland('isl1').color, '#fff');
  assert.equal(db.getDevice('dev1').token_hash, 'th');
  assert.equal(db.getSession('sh').expires_at, 5000 + DAY);
  assert.ok(db.raw.prepare("SELECT name FROM sqlite_master WHERE name='audit'").get());
  assert.equal(db.raw.prepare("SELECT consent FROM login_states WHERE state='st'").get().consent, 0);
  db.close();
});

test('opening twice is a no-op', () => {
  const file = path.join(tmp(), 'hub.sqlite');
  buildGd1(file);
  openDb(file).close();
  const db = openDb(file);
  assert.equal(version(db), SCHEMA_VERSION);
  assert.equal(db.getIsland('isl1').slot, 0);
  assert.equal(db.getSession('sh').expires_at, 5000 + DAY);
  assert.equal(db.getUserById(7).email, 'a@newera.inc');
  db.close();
});

test('a fresh database starts at the current version', () => {
  const db = openDb(path.join(tmp(), 'hub.sqlite'));
  assert.equal(version(db), SCHEMA_VERSION);
  assert.ok(!cols(db, 'users').includes('role'));
  assert.ok(cols(db, 'users').includes('ban_reason'));
  db.close();
});

test('a newer database is refused', () => {
  const file = path.join(tmp(), 'hub.sqlite');
  openDb(file).close();
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA user_version = 4');
  raw.close();
  assert.throws(() => openDb(file), /newer/);
});

test('approveDeviceCode only once, never when denied or expired', () => {
  const db = openDb(':memory:');
  const u = db.upsertUser({ googleSub: 's', email: 'a@x', name: 'A', now: 1 });
  const mk = (h, c) => db.createDeviceCode({ codeHash: h, userCode: c, name: 'mac', now: 10, expiresAt: 100 });
  mk('a', 'AAAA-AAAA'); mk('b', 'BBBB-BBBB'); mk('c', 'CCCC-CCCC');
  assert.equal(db.approveDeviceCode('a', u.id, 50), true);
  assert.equal(db.approveDeviceCode('a', u.id, 51), false);
  db.denyDeviceCode('b');
  assert.equal(db.approveDeviceCode('b', u.id, 50), false);
  assert.equal(db.approveDeviceCode('c', u.id, 100), false);
  assert.equal(db.getDeviceCodeByHash('c').approved_user_id, null);
  db.close();
});

test('usersDueForCheck picks stale users with a device or a live session', () => {
  const db = openDb(':memory:');
  const NOW = 10 * DAY;
  const STALE = DAY;
  const mk = (sub) => {
    const u = db.upsertUser({ googleSub: sub, email: `${sub}@x`, name: sub, now: 1 });
    db.setRefreshToken(u.id, 'enc');
    return u;
  };
  const fresh = mk('fresh'); db.markChecked(fresh.id, NOW - 10);
  db.createDevice({ id: 'd-fresh', userId: fresh.id, name: 'm', tokenHash: 'h1', now: 1 });
  const stale = mk('stale'); db.markChecked(stale.id, NOW - 2 * DAY);
  db.createDevice({ id: 'd-stale', userId: stale.id, name: 'm', tokenHash: 'h2', now: 1 });
  const idle = mk('idle'); db.markChecked(idle.id, NOW - 2 * DAY);
  const banned = mk('banned'); db.markChecked(banned.id, NOW - 2 * DAY);
  db.createDevice({ id: 'd-ban', userId: banned.id, name: 'm', tokenHash: 'h3', now: 1 });
  assert.equal(db.banUser(banned.id, 'google_revoked', NOW), true);
  assert.deepEqual(db.usersDueForCheck(NOW, STALE).map((x) => x.id), [stale.id]);
  // a live session alone qualifies; an expired one does not; a revoked device does not
  db.createSession({ tokenHash: 's-idle', userId: idle.id, csrf: 'c', now: NOW - 100, expiresAt: NOW + 100 });
  assert.deepEqual(db.usersDueForCheck(NOW, STALE).map((x) => x.id).sort(), [stale.id, idle.id].sort());
  db.revokeDevice('d-stale', stale.id, NOW);
  assert.deepEqual(db.usersDueForCheck(NOW, STALE).map((x) => x.id), [idle.id]);
  // never-checked users (checked_at NULL) and users without a refresh token
  const never = db.upsertUser({ googleSub: 'never', email: 'n@x', name: 'n', now: 1 });
  db.setRefreshToken(never.id, 'enc');
  db.createDevice({ id: 'd-n', userId: never.id, name: 'm', tokenHash: 'h4', now: 1 });
  const norefresh = db.upsertUser({ googleSub: 'nr', email: 'r@x', name: 'r', now: 1 });
  db.createDevice({ id: 'd-nr', userId: norefresh.id, name: 'm', tokenHash: 'h5', now: 1 });
  assert.deepEqual(db.usersDueForCheck(NOW, STALE).map((x) => x.id).sort(), [idle.id, never.id].sort());
  db.close();
});

test('check bookkeeping, ban and identity helpers', () => {
  const db = openDb(':memory:');
  const u = db.upsertUser({ googleSub: 's', email: 'a@x', name: 'A', now: 1 });
  assert.equal(db.markCheckFailed(u.id, 100).failSince, 100);
  assert.equal(db.markCheckFailed(u.id, 200).failSince, 100); // keeps the first failure time
  db.setCheckWarned(u.id, 300);
  assert.equal(db.getUserById(u.id).check_warned_at, 300);
  db.markChecked(u.id, 400);
  const c = db.getUserById(u.id);
  assert.equal(c.checked_at, 400);
  assert.equal(c.check_fail_since, null);
  assert.equal(c.check_warned_at, null);
  assert.equal(db.banUser(u.id, 'google_revoked', 500), true);
  assert.equal(db.getUserById(u.id).ban_reason, 'google_revoked');
  assert.equal(db.liftBan(u.id), true);
  assert.equal(db.getUserById(u.id).banned_at, null);
  assert.equal(db.getUserById(u.id).ban_reason, null);
  assert.equal(db.banUser(999, 'x', 1), false);
  db.setUserBanned(u.id, 600);
  assert.equal(db.getUserById(u.id).banned_at, 600);
  db.setRefreshToken(u.id, 'enc');
  db.clearUserIdentity(u.id);
  const z = db.getUserById(u.id);
  assert.equal(z.email, null); assert.equal(z.name, null); assert.equal(z.refresh_enc, null);
  db.close();
});

test('sessionTokensForUser, updateIsland, createLoginState consent', () => {
  const db = openDb(':memory:');
  const u = db.upsertUser({ googleSub: 's', email: 'a@x', name: 'A', now: 1 });
  db.createSession({ tokenHash: 't1', userId: u.id, csrf: 'c', now: 1, expiresAt: 9 });
  db.createSession({ tokenHash: 't2', userId: u.id, csrf: 'c', now: 1, expiresAt: 9 });
  assert.deepEqual(db.sessionTokensForUser(u.id).sort(), ['t1', 't2']);
  assert.equal(db.updateIsland(u.id, { name: 'N', color: '#000' }), undefined);
  db.upsertIsland({ id: 'i', userId: u.id, name: 'Old', color: '#fff', now: 1 });
  const i = db.updateIsland(u.id, { name: 'N', color: '#000' });
  assert.equal(i.name, 'N'); assert.equal(i.color, '#000'); assert.equal(i.id, 'i');
  db.createLoginState({ state: 'a', nonce: 'n', verifier: 'v', now: 1 });
  db.createLoginState({ state: 'b', nonce: 'n', verifier: 'v', consent: 1, now: 1 });
  assert.equal(db.takeLoginState('a').consent, 0);
  assert.equal(db.takeLoginState('b').consent, 1);
  db.close();
});

test('audit rows are listed newest first and swept after 180 days', () => {
  const db = openDb(':memory:');
  const NOW = 400 * DAY;
  db.addAudit({ at: NOW - 200 * DAY, action: 'old' });
  db.addAudit({ at: NOW - 10, actorId: null, action: 'a', target: 'x', ip: '1.1.1.1' });
  db.addAudit({ at: NOW - 5, action: 'b' });
  const rows = db.listAudit();
  assert.deepEqual(rows.map((r) => r.action), ['b', 'a', 'old']);
  assert.equal(rows[1].target, 'x'); assert.equal(rows[1].ip, '1.1.1.1'); assert.equal(rows[2].actor_id, null);
  assert.equal(db.listAudit(1).length, 1);
  db.cleanup(NOW);
  assert.deepEqual(db.listAudit().map((r) => r.action), ['b', 'a']);
  db.close();
});

test('deleting an island with live device rows works and leaves devices intact', () => {
  const db = openDb(':memory:');
  const u = db.upsertUser({ googleSub: 's', email: 'a@x', name: 'A', now: 1 });
  db.upsertIsland({ id: 'i', userId: u.id, name: 'I', color: '#fff', now: 1 });
  db.createDevice({ id: 'd', userId: u.id, name: 'm', tokenHash: 'h', now: 1 });
  assert.equal(db.deleteIslandByUser(u.id), true);
  assert.equal(db.getDevice('d').user_id, u.id);
  db.close();
});

// ---- v2 -> v3 (fixed island slots) ----
const V2_STEPS = `
  ALTER TABLE users DROP COLUMN role;
  ALTER TABLE users ADD COLUMN refresh_enc TEXT;
  ALTER TABLE users ADD COLUMN checked_at INTEGER;
  ALTER TABLE users ADD COLUMN check_fail_since INTEGER;
  ALTER TABLE users ADD COLUMN check_warned_at INTEGER;
  ALTER TABLE users ADD COLUMN ban_reason TEXT;
  ALTER TABLE login_states ADD COLUMN consent INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE audit(id INTEGER PRIMARY KEY, at INTEGER NOT NULL, actor_id INTEGER, action TEXT NOT NULL, target TEXT, ip TEXT);
  CREATE INDEX audit_at ON audit(at);
`;

// 10 users/islands; islands i4 and i5 share created_at (tie broken by id). Creation order: i0..i3, i4, i5, i6..i9.
function buildV2(file, n = 10) {
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA foreign_keys=ON');
  raw.exec(GD1_SCHEMA);
  raw.exec(V2_STEPS);
  for (let k = 0; k < n; k++) {
    raw.prepare('INSERT INTO users(id, google_sub, email, name, created_at) VALUES(?,?,?,?,?)').run(k + 1, `g${k}`, `u${k}@x`, `U${k}`, 100);
    // insert out of order on purpose; i5 shares i4's timestamp
    const at = k === 5 ? 1400 : 1000 + k * 100;
    raw.prepare('INSERT INTO islands(id, user_id, name, color, created_at) VALUES(?,?,?,?,?)').run(`i${k}`, k + 1, `Isle${k}`, '#abc', at);
  }
  raw.exec('PRAGMA user_version = 2');
  raw.close();
}

const mkUser = (db, k) => db.upsertUser({ googleSub: `n${k}`, email: `n${k}@x`, name: `N${k}`, now: 1 });
const claim = (db, k) => db.claimIsland({ id: `c${k}`, userId: mkUser(db, k).id, name: `C${k}`, color: '#123', now: 10 + k });
const fillHub = (db, n) => { for (let k = 0; k < n; k++) claim(db, k); };

test('a v2 database with 10 islands gets slots by creation order', () => {
  const file = path.join(tmp(), 'hub.sqlite');
  buildV2(file);
  const db = openDb(file);
  assert.equal(version(db), 3);
  const rows = db.raw.prepare('SELECT * FROM islands ORDER BY created_at, id').all();
  assert.deepEqual(rows.map((r) => r.slot), [0, 1, 2, 3, 4, 5, 6, 7, null, null]);
  assert.deepEqual(rows.map((r) => r.id), ['i0', 'i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9']);
  const i9 = db.getIsland('i9');
  assert.equal(i9.name, 'Isle9'); assert.equal(i9.color, '#abc'); assert.equal(i9.user_id, 10); assert.equal(i9.created_at, 1900);
  assert.ok(db.raw.prepare('PRAGMA index_list(islands)').all().some((r) => r.name === 'islands_slot'));
  assert.ok(cols(db, 'device_codes').includes('deny_reason'));
  db.close();
});

test('a GD1 database with a v2 step in between ends identical: 0 -> 3 equals 0 -> 2 -> 3', () => {
  const a = path.join(tmp(), 'a.sqlite'); buildGd1(a);
  const b = path.join(tmp(), 'b.sqlite'); buildGd1(b);
  const raw = new DatabaseSync(b); raw.exec(V2_STEPS); raw.exec('PRAGMA user_version = 2'); raw.close();
  const da = openDb(a), dbb = openDb(b);
  assert.deepEqual(da.getIsland('isl1'), dbb.getIsland('isl1'));
  assert.equal(da.getIsland('isl1').slot, 0);
  da.close(); dbb.close();
});

test('claimIsland gives the smallest free slot', () => {
  const db = openDb(':memory:');
  const r = [0, 1, 2].map((k) => claim(db, k));
  assert.deepEqual(r.map((x) => x.created), [true, true, true]);
  assert.deepEqual(r.map((x) => x.island.slot), [0, 1, 2]);
  assert.equal(MAX_ISLANDS, 8);
  db.close();
});

test('claimIsland refuses a ninth island', () => {
  const db = openDb(':memory:');
  fillHub(db, 8);
  assert.deepEqual(claim(db, 8), { full: true });
  assert.equal(db.islandCount(), 8);
  db.close();
});

test('a user with an island gets it back on a full hub', () => {
  const db = openDb(':memory:');
  fillHub(db, 8);
  const u = db.getUserBySub('n3');
  const first = db.getIslandByUser(u.id);
  const again = db.claimIsland({ id: 'other', userId: u.id, name: 'X', color: '#000', now: 99 });
  assert.equal(again.created, false);
  assert.equal(again.island.id, first.id);
  assert.equal(again.island.slot, first.slot);
  assert.equal(db.islandCount(), 8);
  db.close();
});

test('a hidden island (slot NULL) is returned as is, even when the hub is full', () => {
  const file = path.join(tmp(), 'hub.sqlite');
  buildV2(file);
  const db = openDb(file);
  const r = db.claimIsland({ id: 'zz', userId: 10, name: 'Z', color: '#000', now: 1 });
  assert.equal(r.created, false);
  assert.equal(r.island.id, 'i9');
  assert.equal(r.island.slot, null);
  db.close();
});

test('a freed slot is reused', () => {
  const db = openDb(':memory:');
  fillHub(db, 8);
  const before = db.listSlottedIslands().map((i) => [i.id, i.slot]);
  assert.equal(db.deleteIslandByUser(db.getUserBySub('n3').id), true);
  const r = claim(db, 20);
  assert.equal(r.island.slot, 3);
  const after = db.listSlottedIslands().filter((i) => i.id !== 'c20').map((i) => [i.id, i.slot]);
  assert.deepEqual(after, before.filter(([id]) => id !== 'c3'));
  db.close();
});

test('a freed slot goes to the oldest hidden island first', () => {
  const file = path.join(tmp(), 'hub.sqlite');
  buildV2(file);
  const db = openDb(file);
  assert.equal(db.deleteIslandByUser(db.getIsland('i5').user_id), true);
  assert.equal(db.getIsland('i8').slot, 5);
  assert.equal(db.getIsland('i9').slot, null);
  assert.equal(db.islandCount(), 9);
  assert.deepEqual(claim(db, 1), { full: true });
  db.close();
});

test('the slot index rejects a duplicate', () => {
  const db = openDb(':memory:');
  fillHub(db, 2);
  assert.throws(() => db.raw.prepare('UPDATE islands SET slot = 0 WHERE slot = 1').run(), /UNIQUE/);
  db.close();
});

test('the slot check rejects 8', () => {
  const db = openDb(':memory:');
  fillHub(db, 1);
  assert.throws(() => db.raw.prepare('UPDATE islands SET slot = 8 WHERE slot = 0').run(), /CHECK/);
  db.close();
});

test('listSlottedIslands is ordered by slot and skips hidden ones', () => {
  const file = path.join(tmp(), 'hub.sqlite');
  buildV2(file);
  const db = openDb(file);
  db.raw.prepare('UPDATE islands SET slot = NULL WHERE id = ?').run('i0'); // hole at slot 0
  db.raw.prepare('UPDATE islands SET slot = 0 WHERE id = ?').run('i7'); // out of creation order
  db.raw.prepare('UPDATE islands SET slot = 7 WHERE id = ?').run('i2');
  const list = db.listSlottedIslands();
  assert.deepEqual(list.map((i) => i.slot), [0, 1, 3, 4, 5, 6, 7]);
  assert.ok(!list.some((i) => i.slot === null));
  db.close();
});

test('denyDeviceCode keeps the reason', () => {
  const db = openDb(':memory:');
  db.createDeviceCode({ codeHash: 'a', userCode: 'AAAA-AAAA', name: 'm', now: 1, expiresAt: 9 });
  db.createDeviceCode({ codeHash: 'b', userCode: 'BBBB-BBBB', name: 'm', now: 1, expiresAt: 9 });
  assert.equal(db.denyDeviceCode('a', 'hub_full'), true);
  assert.equal(db.denyDeviceCode('b'), true);
  assert.equal(db.getDeviceCodeByHash('a').denied, 1);
  assert.equal(db.getDeviceCodeByHash('a').deny_reason, 'hub_full');
  assert.equal(db.getDeviceCodeByHash('b').deny_reason, null);
  assert.equal(db.denyDeviceCode('missing'), false);
  db.close();
});

test('upsertIsland claims a slot, renames an existing island, and throws on a full hub', () => {
  const db = openDb(':memory:');
  fillHub(db, 8);
  const u = db.getUserBySub('n0');
  const r = db.upsertIsland({ id: 'x', userId: u.id, name: 'New', color: '#999', now: 5 });
  assert.equal(r.name, 'New'); assert.equal(r.id, 'c0'); assert.equal(r.slot, 0);
  const extra = mkUser(db, 50);
  assert.throws(() => db.upsertIsland({ id: 'y', userId: extra.id, name: 'Y', color: '#000', now: 6 }), /hub full/);
  db.close();
});

test('two handles racing for the last slot: exactly one wins', () => {
  const file = path.join(tmp(), 'hub.sqlite');
  const a = openDb(file), b = openDb(file);
  fillHub(a, 7);
  const ua = mkUser(a, 90), ub = mkUser(b, 91);
  const ra = a.claimIsland({ id: 'ra', userId: ua.id, name: 'A', color: '#000', now: 1 });
  const rb = b.claimIsland({ id: 'rb', userId: ub.id, name: 'B', color: '#000', now: 1 });
  assert.equal([ra, rb].filter((r) => r.island?.slot === 7).length, 1);
  assert.equal([ra, rb].filter((r) => r.full).length, 1);
  assert.equal(a.islandCount(), 8);
  a.close(); b.close();
});
