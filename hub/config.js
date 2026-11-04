'use strict';
// Hub configuration from environment variables (spec §14). loadConfig throws one Error that lists
// EVERY missing or invalid variable, so an operator fixes them in one go. Secrets are read from env only (S21).

const list = (v) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

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
      publicUrl = publicUrl.replace(/\/+$/, '');
    } catch {
      need('HUB_PUBLIC_URL', 'not a valid http(s) URL');
    }
  }

  const allowedDomains = list(env.HUB_ALLOWED_DOMAINS);
  if (!allowedDomains.length) need('HUB_ALLOWED_DOMAINS', 'required (comma-separated email domains, e.g. newera.inc)');
  const ownerEmails = list(env.HUB_OWNER_EMAILS);
  if (!ownerEmails.length) need('HUB_OWNER_EMAILS', 'required (comma-separated owner emails)');

  // S20: dev login is only allowed on a local public URL.
  if (devLogin && publicUrl && !/^http:\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/.test(publicUrl)) {
    need('HUB_DEV_LOGIN', 'HUB_DEV_LOGIN=1 is only allowed when HUB_PUBLIC_URL starts with http://localhost or http://127.0.0.1');
  }

  const googleClientId = String(env.GOOGLE_CLIENT_ID || '');
  const googleClientSecret = String(env.GOOGLE_CLIENT_SECRET || '');
  if (!devLogin) {
    if (!googleClientId) need('GOOGLE_CLIENT_ID', 'required unless HUB_DEV_LOGIN=1');
    if (!googleClientSecret) need('GOOGLE_CLIENT_SECRET', 'required unless HUB_DEV_LOGIN=1');
  }

  let port = 4318;
  if (env.HUB_PORT !== undefined && env.HUB_PORT !== '') {
    port = Number(env.HUB_PORT);
    if (!Number.isInteger(port) || port < 0 || port > 65535) need('HUB_PORT', 'must be an integer 0-65535');
  }

  if (problems.length) throw new Error('Invalid hub configuration:\n  - ' + problems.join('\n  - '));

  return {
    publicUrl, origin, secure, allowedDomains, ownerEmails,
    googleClientId, googleClientSecret,
    port, host: env.HUB_HOST || '127.0.0.1', dbPath: env.HUB_DB || './data/hub.sqlite',
    trustProxy, devLogin,
  };
}

module.exports = { loadConfig };
