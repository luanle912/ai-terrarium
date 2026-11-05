'use strict';
// Hub configuration from environment variables (spec §14). loadConfig throws one Error that lists
// EVERY missing or invalid variable, so an operator fixes them in one go. Secrets are read from env only (S21).

const list = (v) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const LOOPBACK_URL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const LOOPBACK_BIND_HOSTS = ['localhost', '127.0.0.1', '::1'];

function loadConfig(env = process.env) {
  const problems = [];
  const need = (name, why) => problems.push(`${name}: ${why}`);

  const devLogin = env.HUB_DEV_LOGIN === '1';
  const trustProxy = env.HUB_TRUST_PROXY === '1';

  let publicUrl = String(env.HUB_PUBLIC_URL || '').trim();
  let origin = '';
  let secure = false;
  if (!publicUrl) need('HUB_PUBLIC_URL', 'required (e.g. https://terrarium.example.com)');
  else {
    try {
      const u = new URL(publicUrl);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocol');
      origin = u.origin;
      secure = u.protocol === 'https:';
      // S10: plain http only for loopback (session cookies are Secure-only and tokens must not cross a LAN in clear).
      if (!secure && !LOOPBACK_URL_HOSTS.includes(u.hostname)) {
        need('HUB_PUBLIC_URL', 'http:// is only allowed for localhost, 127.0.0.1 or [::1]; use https://');
      }
      publicUrl = publicUrl.replace(/\/+$/, '');
    } catch {
      need('HUB_PUBLIC_URL', 'not a valid http(s) URL');
    }
  }

  const allowedDomains = list(env.HUB_ALLOWED_DOMAINS);
  if (!allowedDomains.length) need('HUB_ALLOWED_DOMAINS', 'required (comma-separated email domains, e.g. newera.inc)');
  const ownerEmails = list(env.HUB_OWNER_EMAILS);
  if (!ownerEmails.length) need('HUB_OWNER_EMAILS', 'required (comma-separated owner emails)');

  // S20: dev login is only allowed on a local public URL (parsed, so http://localhost@evil.com fails).
  if (devLogin && publicUrl) {
    let local = false;
    try {
      const u = new URL(publicUrl);
      local = u.protocol === 'http:' && !u.username && !u.password && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
    } catch { /* invalid URL is reported above */ }
    if (!local) need('HUB_DEV_LOGIN', 'HUB_DEV_LOGIN=1 is only allowed when HUB_PUBLIC_URL is http://localhost or http://127.0.0.1');
  }

  // Dev login has no real auth, so the hub must not listen beyond this machine.
  if (devLogin && env.HUB_HOST && !LOOPBACK_BIND_HOSTS.includes(String(env.HUB_HOST).trim().toLowerCase())) {
    need('HUB_HOST', 'HUB_DEV_LOGIN=1 requires HUB_HOST to be 127.0.0.1, ::1 or localhost');
  }

  const googleClientId = String(env.GOOGLE_CLIENT_ID || '');
  const googleClientSecret = String(env.GOOGLE_CLIENT_SECRET || '');
  if (!devLogin) {
    if (!googleClientId) need('GOOGLE_CLIENT_ID', 'required unless HUB_DEV_LOGIN=1');
    if (!googleClientSecret) need('GOOGLE_CLIENT_SECRET', 'required unless HUB_DEV_LOGIN=1');
  }

  // Encrypts the Google refresh token at rest (AES-256-GCM). Required even for dev login.
  let secretKey = null;
  const rawKey = String(env.HUB_SECRET_KEY || '').trim();
  if (!rawKey) need('HUB_SECRET_KEY', 'required (32 random bytes, base64; e.g. openssl rand -base64 32)');
  else {
    const buf = /^[A-Za-z0-9+/]+={0,2}$/.test(rawKey) ? Buffer.from(rawKey, 'base64') : null;
    if (!buf || buf.length !== 32) need('HUB_SECRET_KEY', 'must be base64 of exactly 32 bytes (e.g. openssl rand -base64 32)');
    else secretKey = buf;
  }

  let port = 4318;
  if (env.HUB_PORT !== undefined && env.HUB_PORT !== '') {
    port = Number(env.HUB_PORT);
    if (!Number.isInteger(port) || port < 0 || port > 65535) need('HUB_PORT', 'must be an integer 0-65535');
  }

  if (problems.length) throw new Error('Invalid hub configuration:\n  - ' + problems.join('\n  - '));

  return {
    publicUrl, origin, secure, allowedDomains, ownerEmails,
    googleClientId, googleClientSecret, secretKey,
    port, host: env.HUB_HOST || '127.0.0.1', dbPath: env.HUB_DB || './data/hub.sqlite',
    trustProxy, devLogin,
  };
}

module.exports = { loadConfig };
