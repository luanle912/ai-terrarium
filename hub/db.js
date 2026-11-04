'use strict';
// SQLite store (node:sqlite). Tables follow spec §10.3 minus `audit` and the B12 columns (phase 2).
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

const LOGIN_STATE_TTL_MS = 10 * 60 * 1000;

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
  if (dbPath !== ':memory:') {
    for (const suffix of ['', '-wal', '-shm']) { try { fs.chmodSync(dbPath + suffix, 0o600); } catch { /* may not exist */ } }
  }

  const q = (sql) => raw.prepare(sql);
  const run = (sql, ...p) => q(sql).run(...p);
  const get = (sql, ...p) => q(sql).get(...p);
  const all = (sql, ...p) => q(sql).all(...p);

  const db = {
    raw,

    // users. `role` is only applied on first insert; use setUserRole afterwards.
    upsertUser({ googleSub, email, name, role = 'member', now }) {
      run(`INSERT INTO users(google_sub, email, name, role, created_at, last_login_at) VALUES(?,?,?,?,?,?)
           ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email, name=excluded.name, last_login_at=excluded.last_login_at`,
      googleSub, email, name, role, now, now);
      return get('SELECT * FROM users WHERE google_sub=?', googleSub);
    },
    getUserBySub: (googleSub) => get('SELECT * FROM users WHERE google_sub=?', googleSub),
    getUserById: (id) => get('SELECT * FROM users WHERE id=?', id),
    setUserRole: (id, role) => run('UPDATE users SET role=? WHERE id=?', role, id).changes > 0,
    setUserBanned: (id, at) => run('UPDATE users SET banned_at=? WHERE id=?', at, id).changes > 0,

    // sessions (token_hash = SHA-256 of the cookie token)
    createSession({ tokenHash, userId, csrf, now, expiresAt }) {
      run('INSERT INTO sessions(token_hash, user_id, csrf, created_at, expires_at) VALUES(?,?,?,?,?)', tokenHash, userId, csrf, now, expiresAt);
    },
    getSession: (tokenHash) => get('SELECT * FROM sessions WHERE token_hash=?', tokenHash),
    deleteSession: (tokenHash) => run('DELETE FROM sessions WHERE token_hash=?', tokenHash).changes > 0,
    deleteSessionsForUser: (userId) => run('DELETE FROM sessions WHERE user_id=?', userId).changes,

    // login_states (OIDC state/nonce/PKCE verifier)
    createLoginState({ state, nonce, verifier, now }) {
      run('INSERT INTO login_states(state, nonce, verifier, created_at) VALUES(?,?,?,?)', state, nonce, verifier, now);
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
    approveDeviceCode: (codeHash, userId) => run('UPDATE device_codes SET approved_user_id=? WHERE code_hash=? AND denied=0', userId, codeHash).changes > 0,
    denyDeviceCode: (codeHash) => run('UPDATE device_codes SET denied=1 WHERE code_hash=?', codeHash).changes > 0,
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

    // islands (one per user)
    upsertIsland({ id, userId, name, color, now }) {
      run(`INSERT INTO islands(id, user_id, name, color, created_at) VALUES(?,?,?,?,?)
           ON CONFLICT(user_id) DO UPDATE SET name=excluded.name, color=excluded.color`, id, userId, name, color, now);
      return get('SELECT * FROM islands WHERE user_id=?', userId);
    },
    getIslandByUser: (userId) => get('SELECT * FROM islands WHERE user_id=?', userId),
    getIsland: (id) => get('SELECT * FROM islands WHERE id=?', id),
    deleteIslandByUser: (userId) => run('DELETE FROM islands WHERE user_id=?', userId).changes > 0,

    // Hourly sweep: login_states > 10 min, expired device_codes and sessions.
    cleanup(now) {
      run('DELETE FROM login_states WHERE created_at < ?', now - LOGIN_STATE_TTL_MS);
      run('DELETE FROM device_codes WHERE expires_at < ?', now);
      run('DELETE FROM sessions WHERE expires_at < ?', now);
    },

    close() { try { raw.close(); } catch { /* already closed */ } },
  };
  return db;
}

module.exports = { openDb };
