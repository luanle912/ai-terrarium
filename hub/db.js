'use strict';
// SQLite store (node:sqlite). Tables follow spec §10.3. The SCHEMA below is the phase-1 shape and stays verbatim;
// migrate() upgrades it in place (0 -> 2 -> 3) to SCHEMA_VERSION (PRAGMA user_version) so existing hub.sqlite files keep their data.
// All queries are parameterized. Every helper lives on the object returned by openDb; later tasks call db.<name>.
// Secrets (session tokens, device tokens, device codes) are stored as SHA-256 hashes by the CALLER; this layer
// only stores what it is given. Island snapshots are never written here (RAM only).

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
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

const SCHEMA_VERSION = 3;
const MAX_ISLANDS = 8; // fixed sky slots 0-7; islands beyond the cap stay hidden (slot NULL) until a slot frees up
const LOGIN_STATE_TTL_MS = 10 * 60 * 1000;
const AUDIT_TTL_MS = 180 * 24 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

// user_version 0 (phase 1, or a fresh file just given the phase-1 SCHEMA) -> 2 -> 3. One transaction: all or nothing.
function migrate(raw, now) {
  void now; // reserved: migrations so far need no clock
  const version = raw.prepare('PRAGMA user_version').get().user_version;
  if (version > SCHEMA_VERSION) throw new Error('hub.sqlite is newer than this hub');
  if (version === SCHEMA_VERSION) return;
  raw.exec('BEGIN');
  try {
    if (version < 2) {
      raw.exec(`
        ALTER TABLE users DROP COLUMN role;
        ALTER TABLE users ADD COLUMN refresh_enc TEXT;
        ALTER TABLE users ADD COLUMN checked_at INTEGER;
        ALTER TABLE users ADD COLUMN check_fail_since INTEGER;
        ALTER TABLE users ADD COLUMN check_warned_at INTEGER;
        ALTER TABLE users ADD COLUMN ban_reason TEXT;
        ALTER TABLE login_states ADD COLUMN consent INTEGER NOT NULL DEFAULT 0;
        CREATE TABLE audit(id INTEGER PRIMARY KEY, at INTEGER NOT NULL, actor_id INTEGER, action TEXT NOT NULL, target TEXT, ip TEXT);
        CREATE INDEX audit_at ON audit(at);
      `);
      // Users without a refresh token cannot be re-checked against Google: cap their sessions at 24 h from creation.
      raw.prepare(`UPDATE sessions SET expires_at = MIN(expires_at, created_at + ?)
                   WHERE user_id IN (SELECT id FROM users WHERE refresh_enc IS NULL)`).run(DAY_MS);
    }
    if (version < 3) {
      // Fixed sky slots: the 8 oldest islands get slots 0-7 by creation order, any others stay hidden (NULL).
      raw.exec(`
        ALTER TABLE islands ADD COLUMN slot INTEGER CHECK(slot BETWEEN 0 AND 7);
        ALTER TABLE device_codes ADD COLUMN deny_reason TEXT;
        WITH r AS (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS n FROM islands)
          UPDATE islands SET slot = (SELECT n FROM r WHERE r.id = islands.id)
          WHERE id IN (SELECT id FROM r WHERE n < 8);
        CREATE UNIQUE INDEX islands_slot ON islands(slot) WHERE slot IS NOT NULL;
      `);
    }
    raw.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    raw.exec('COMMIT');
  } catch (e) {
    try { raw.exec('ROLLBACK'); } catch { /* nothing to roll back */ }
    throw e;
  }
}

function openDb(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true, mode: 0o700 });
    fs.closeSync(fs.openSync(dbPath, 'a', 0o600)); // create with 0600 before SQLite touches it
    fs.chmodSync(dbPath, 0o600);
  }
  const raw = new DatabaseSync(dbPath);
  raw.exec('PRAGMA journal_mode=WAL');
  raw.exec('PRAGMA foreign_keys=ON');
  raw.exec(SCHEMA);
  migrate(raw, Date.now());
  if (dbPath !== ':memory:') {
    for (const suffix of ['', '-wal', '-shm']) { try { fs.chmodSync(dbPath + suffix, 0o600); } catch { /* may not exist */ } }
  }

  const q = (sql) => raw.prepare(sql);
  const run = (sql, ...p) => q(sql).run(...p);
  const get = (sql, ...p) => q(sql).get(...p);
  const all = (sql, ...p) => q(sql).all(...p);

  const db = {
    raw,

    // users. There is no role in the DB: owner status comes from HUB_OWNER_EMAILS.
    upsertUser({ googleSub, email, name, now }) {
      run(`INSERT INTO users(google_sub, email, name, created_at, last_login_at) VALUES(?,?,?,?,?)
           ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email, name=excluded.name, last_login_at=excluded.last_login_at`,
      googleSub, email, name, now, now);
      return get('SELECT * FROM users WHERE google_sub=?', googleSub);
    },
    getUserBySub: (googleSub) => get('SELECT * FROM users WHERE google_sub=?', googleSub),
    getUserById: (id) => get('SELECT * FROM users WHERE id=?', id),
    setRefreshToken: (userId, enc) => run('UPDATE users SET refresh_enc=? WHERE id=?', enc, userId).changes > 0,
    markChecked: (userId, now) => run('UPDATE users SET checked_at=?, check_fail_since=NULL, check_warned_at=NULL WHERE id=?', now, userId).changes > 0,
    // Keeps the first failure time while failures continue; returns it.
    markCheckFailed(userId, now) {
      run('UPDATE users SET check_fail_since=COALESCE(check_fail_since, ?) WHERE id=?', now, userId);
      return { failSince: get('SELECT check_fail_since FROM users WHERE id=?', userId)?.check_fail_since };
    },
    setCheckWarned: (userId, now) => run('UPDATE users SET check_warned_at=? WHERE id=?', now, userId).changes > 0,
    // Unbanned users with a refresh token, last checked before now-staleMs (or never), who still have an
    // unrevoked device or an unexpired session.
    usersDueForCheck: (now, staleMs) => all(
      `SELECT * FROM users u WHERE u.banned_at IS NULL AND u.refresh_enc IS NOT NULL
         AND (u.checked_at IS NULL OR u.checked_at < ?)
         AND (EXISTS (SELECT 1 FROM devices d WHERE d.user_id=u.id AND d.revoked_at IS NULL)
              OR EXISTS (SELECT 1 FROM sessions s WHERE s.user_id=u.id AND s.expires_at > ?))
       ORDER BY u.id`, now - staleMs, now),
    banUser: (userId, reason, now) => run('UPDATE users SET banned_at=?, ban_reason=? WHERE id=?', now, reason, userId).changes > 0,
    liftBan: (userId) => run('UPDATE users SET banned_at=NULL, ban_reason=NULL WHERE id=?', userId).changes > 0,
    clearUserIdentity: (userId) => run('UPDATE users SET email=NULL, name=NULL, refresh_enc=NULL WHERE id=?', userId).changes > 0,
    // Alias kept for older tests.
    setUserBanned: (id, at) => db.banUser(id, null, at),

    // sessions (token_hash = SHA-256 of the cookie token)
    createSession({ tokenHash, userId, csrf, now, expiresAt }) {
      run('INSERT INTO sessions(token_hash, user_id, csrf, created_at, expires_at) VALUES(?,?,?,?,?)', tokenHash, userId, csrf, now, expiresAt);
    },
    getSession: (tokenHash) => get('SELECT * FROM sessions WHERE token_hash=?', tokenHash),
    deleteSession: (tokenHash) => run('DELETE FROM sessions WHERE token_hash=?', tokenHash).changes > 0,
    sessionTokensForUser: (userId) => all('SELECT token_hash FROM sessions WHERE user_id=?', userId).map((r) => r.token_hash),
    deleteSessionsForUser: (userId) => run('DELETE FROM sessions WHERE user_id=?', userId).changes,

    // login_states (OIDC state/nonce/PKCE verifier)
    createLoginState({ state, nonce, verifier, consent = 0, now }) {
      run('INSERT INTO login_states(state, nonce, verifier, consent, created_at) VALUES(?,?,?,?,?)', state, nonce, verifier, consent, now);
    },
    // One-shot: returns the row and deletes it (undefined when unknown or already used).
    takeLoginState(state) {
      const row = get('SELECT * FROM login_states WHERE state=?', state);
      if (row) run('DELETE FROM login_states WHERE state=?', state);
      return row;
    },

    // device_codes (code_hash = SHA-256 of the device_code; user_code is the short code typed by hand)
    createDeviceCode({ codeHash, userCode, name, now, expiresAt, ip = null }) {
      run('INSERT INTO device_codes(code_hash, user_code, name, created_at, expires_at, ip) VALUES(?,?,?,?,?,?)', codeHash, userCode, name, now, expiresAt, ip);
    },
    getDeviceCodeByHash: (codeHash) => get('SELECT * FROM device_codes WHERE code_hash=?', codeHash),
    getDeviceCodeByUserCode: (userCode) => get('SELECT * FROM device_codes WHERE user_code=?', userCode),
    // Succeeds at most once, and never for a denied or expired code.
    approveDeviceCode: (codeHash, userId, now) => run(
      'UPDATE device_codes SET approved_user_id=? WHERE code_hash=? AND denied=0 AND approved_user_id IS NULL AND expires_at > ?',
      userId, codeHash, now).changes > 0,
    denyDeviceCode: (codeHash, reason = null) => run('UPDATE device_codes SET denied=1, deny_reason=? WHERE code_hash=?', reason, codeHash).changes > 0,
    touchDeviceCodePoll: (codeHash, now) => run('UPDATE device_codes SET last_poll_at=? WHERE code_hash=?', now, codeHash).changes > 0,
    deleteDeviceCode: (codeHash) => run('DELETE FROM device_codes WHERE code_hash=?', codeHash).changes > 0,

    // devices (token_hash = SHA-256 of the device token)
    createDevice({ id, userId, name, tokenHash, now }) {
      run('INSERT INTO devices(id, user_id, name, token_hash, created_at) VALUES(?,?,?,?,?)', id, userId, name, tokenHash, now);
    },
    getDeviceByTokenHash: (tokenHash) => get('SELECT * FROM devices WHERE token_hash=?', tokenHash),
    getDevice: (id) => get('SELECT * FROM devices WHERE id=?', id),
    listDevices: (userId) => all('SELECT * FROM devices WHERE user_id=? ORDER BY created_at', userId),
    touchDevice: (id, now) => run('UPDATE devices SET last_used_at=? WHERE id=?', now, id).changes > 0,
    // Scoped to the owner so a user cannot revoke someone else's device. Returns true if it newly revoked one.
    revokeDevice: (id, userId, now) => run('UPDATE devices SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL', now, id, userId).changes > 0,
    revokeDevicesForUser: (userId, now) => run('UPDATE devices SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL', now, userId).changes,

    // islands (one per user, at most MAX_ISLANDS, each with a fixed sky slot 0-7 or NULL when hidden)
    // Atomic get-or-create. Returns {island, created} or {full: true}; never writes when the hub is full.
    claimIsland({ id, userId, name, color, now }) {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const existing = get('SELECT * FROM islands WHERE user_id=?', userId);
        if (existing) { raw.exec('COMMIT'); return { island: existing, created: false }; }
        if (get('SELECT COUNT(*) AS n FROM islands').n >= MAX_ISLANDS) { raw.exec('COMMIT'); return { full: true }; }
        const used = new Set(all('SELECT slot FROM islands WHERE slot IS NOT NULL').map((r) => r.slot));
        let slot = 0;
        while (used.has(slot)) slot++;
        run('INSERT INTO islands(id, user_id, name, color, created_at, slot) VALUES(?,?,?,?,?,?)', id, userId, name, color, now, slot);
        const island = get('SELECT * FROM islands WHERE user_id=?', userId);
        raw.exec('COMMIT');
        return { island, created: true };
      } catch (e) {
        try { raw.exec('ROLLBACK'); } catch { /* nothing to roll back */ }
        // The unique slot index is a last-resort guard: treat a lost race as a full hub.
        if (/UNIQUE/.test(String(e && e.message))) return { full: true };
        throw e;
      }
    },
    // Legacy signature for older tests; hub code uses claimIsland.
    upsertIsland({ id, userId, name, color, now }) {
      if (!get('SELECT 1 FROM islands WHERE user_id=?', userId)) {
        const r = db.claimIsland({ id, userId, name, color, now });
        if (r.full) throw new Error('hub full');
        return r.island;
      }
      run('UPDATE islands SET name=?, color=? WHERE user_id=?', name, color, userId);
      return get('SELECT * FROM islands WHERE user_id=?', userId);
    },
    listSlottedIslands: () => all('SELECT * FROM islands WHERE slot IS NOT NULL ORDER BY slot'),
    islandCount: () => get('SELECT COUNT(*) AS n FROM islands').n,
    getIslandByUser: (userId) => get('SELECT * FROM islands WHERE user_id=?', userId),
    getIsland: (id) => get('SELECT * FROM islands WHERE id=?', id),
    updateIsland(userId, { name, color }) {
      run('UPDATE islands SET name=?, color=? WHERE user_id=?', name, color, userId);
      return get('SELECT * FROM islands WHERE user_id=?', userId);
    },
    // Frees the island's slot; the oldest hidden island (if any) takes it over.
    deleteIslandByUser(userId) {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const isl = get('SELECT id, slot FROM islands WHERE user_id=?', userId);
        if (!isl) { raw.exec('COMMIT'); return false; }
        run('DELETE FROM islands WHERE id=?', isl.id);
        if (isl.slot !== null) {
          const next = get('SELECT id FROM islands WHERE slot IS NULL ORDER BY created_at, id LIMIT 1');
          if (next) run('UPDATE islands SET slot=? WHERE id=?', isl.slot, next.id);
        }
        raw.exec('COMMIT');
        return true;
      } catch (e) {
        try { raw.exec('ROLLBACK'); } catch { /* nothing to roll back */ }
        throw e;
      }
    },

    // audit (append-only log; no web viewer in phase 2)
    addAudit({ at, actorId = null, action, target = null, ip = null }) {
      run('INSERT INTO audit(at, actor_id, action, target, ip) VALUES(?,?,?,?,?)', at, actorId, action, target, ip);
    },
    listAudit: (limit = 200) => all('SELECT * FROM audit ORDER BY at DESC, id DESC LIMIT ?', limit),

    // Hourly sweep: login_states > 10 min, expired device_codes and sessions, audit > 180 days.
    cleanup(now) {
      run('DELETE FROM login_states WHERE created_at < ?', now - LOGIN_STATE_TTL_MS);
      run('DELETE FROM device_codes WHERE expires_at < ?', now);
      run('DELETE FROM sessions WHERE expires_at < ?', now);
      run('DELETE FROM audit WHERE at < ?', now - AUDIT_TTL_MS);
    },

    MAX_ISLANDS,

    close() { try { raw.close(); } catch { /* already closed */ } },
  };
  return db;
}

module.exports = { openDb, SCHEMA_VERSION, MAX_ISLANDS };
