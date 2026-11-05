// Reusable helpers for hub tests that need a real HTTP hub (Tasks 6-8).
//   startDevHub(opts?)           -> {url, hub, config, clock, logs, close()}
//        opts: {env: {...extra env}, now: () => ms (default: controllable clock), deps: {...extra createHub deps}}
//        temp sqlite file, random free port, HUB_DEV_LOGIN on http://127.0.0.1:<port>, domains newera.inc,
//        owner boss@newera.inc, random HUB_SECRET_KEY. clock = {t, advance(ms)} drives deps.now unless opts.now is given.
//   devLogin(url, email, name?)  -> {cookie, csrf}   (cookie = "tr_sess=...", ready for the Cookie header)
//   pairDevice(url, login, name?) -> {token, device_id, island_id, user_code}  (start -> approve form -> token)
//   makeGoogle({now})            -> fake Google: fetch (JWKS, token, revoke), sign(claims, {kid?, key?}), rotate(),
//        claims (for the next code exchange), onToken(params) -> {status, body} (overwritable), calls, jwksFetches
//   startDevHub({google})        also plugs google.fetch in and sets GOOGLE_CLIENT_ID=test-client / _SECRET=test-secret
//   googleLogin(url, google, email, {cookie?, name?}) -> {cookie, csrf, redirects}  (real /auth/login + /auth/callback)
import { createRequire } from 'node:module';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const { loadConfig } = require('../hub/config.js');
const { createHub } = require('../hub/server.js');

export const NOW = 1_800_000_000_000;

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

export async function startDevHub(opts = {}) {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-test-'));
  const url = `http://127.0.0.1:${port}`;
  const clock = { t: NOW, advance(ms) { this.t += ms; } };
  const logs = [];
  const config = loadConfig({
    HUB_PUBLIC_URL: url, HUB_ALLOWED_DOMAINS: 'newera.inc', HUB_OWNER_EMAILS: 'boss@newera.inc',
    HUB_SECRET_KEY: crypto.randomBytes(32).toString('base64'),
    HUB_DEV_LOGIN: '1', HUB_DB: path.join(dir, 'hub.sqlite'), HUB_PORT: String(port),
    ...(opts.google ? { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret' } : {}), ...(opts.env || {}),
  });
  const hub = createHub(config, {
    now: opts.now || (() => clock.t), log: (l) => logs.push(l),
    ...(opts.google ? { fetch: opts.google.fetch } : {}), ...(opts.deps || {}),
  });
  await new Promise((resolve, reject) => { hub.server.once('error', reject); hub.server.listen(port, '127.0.0.1', resolve); });
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await hub.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return { url, hub, config, clock, logs, close };
}

export async function devLogin(url, email, name) {
  const q = new URLSearchParams({ email, ...(name ? { name } : {}) });
  const r = await fetch(`${url}/auth/dev?${q}`, { redirect: 'manual' });
  if (r.status !== 302) throw new Error('dev login failed: ' + r.status);
  const sess = r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => /^(__Host-)?tr_sess=/.test(c));
  const cookie = sess;
  const cfg = await (await fetch(`${url}/api/config`, { headers: { cookie } })).json();
  return { cookie, csrf: cfg.csrf };
}

export const postJson = (url, p, body, headers = {}) =>
  fetch(url + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

export const postDeviceForm = (url, login, fields, headers = {}) =>
  fetch(url + '/device', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: login.cookie, origin: url, ...headers },
    body: new URLSearchParams({ csrf: login.csrf, ...fields }),
  });

export async function pairDevice(url, login, name = 'Laptop') {
  const start = await (await postJson(url, '/api/device/start', { name })).json();
  const ap = await postDeviceForm(url, login, { user_code: start.user_code, action: 'approve' });
  if (ap.status !== 200) throw new Error('approve failed: ' + ap.status);
  const t = await postJson(url, '/api/device/token', { device_code: start.device_code });
  if (t.status !== 200) throw new Error('token failed: ' + t.status);
  return { ...(await t.json()), user_code: start.user_code };
}

// ---- fake Google (JWKS + token + revoke endpoints, RS256 signing) ----
// RSA key generation is slow, so the first key pair is made once per process and shared by every fake.
let sharedKey;
const genKey = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const firstKey = () => (sharedKey ||= genKey());

export function makeGoogle({ now = () => NOW } = {}) {
  const clock = typeof now === 'function' ? now : () => now;
  let seq = 1;
  let current = { kid: 'kid-1', ...firstKey() };
  let codes = 0;
  const reply = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
  const form = (opts) => Object.fromEntries(new URLSearchParams(String((opts && opts.body) || '')));

  const google = {
    calls: [],
    jwksFetches: 0,
    claims: { iss: 'https://accounts.google.com', aud: 'test-client', hd: 'newera.inc', email_verified: true },

    sign(claims, { kid = current.kid, key = current.privateKey } = {}) {
      const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const input = `${enc({ alg: 'RS256', typ: 'JWT', kid })}.${enc(claims)}`;
      return `${input}.${crypto.sign('RSA-SHA256', Buffer.from(input), key).toString('base64url')}`;
    },

    // New key and kid; the JWKS then lists only the new key.
    rotate() { seq += 1; current = { kid: `kid-${seq}`, ...genKey() }; },

    onToken(params) {
      if (params.grant_type === 'authorization_code') {
        const nowS = Math.floor(clock() / 1000);
        const claims = { sub: 'g-sub', email: 'user@newera.inc', iat: nowS, exp: nowS + 3600, ...google.claims };
        return { status: 200, body: { id_token: google.sign(claims), refresh_token: `rt-${++codes}` } };
      }
      if (params.grant_type === 'refresh_token') return { status: 200, body: { access_token: 'at' } };
      return { status: 400, body: { error: 'unsupported_grant_type' } };
    },

    async fetch(url, opts) {
      const u = String(url);
      if (u === 'https://www.googleapis.com/oauth2/v3/certs') {
        google.jwksFetches += 1;
        const jwk = current.publicKey.export({ format: 'jwk' });
        return reply(200, { keys: [{ ...jwk, kid: current.kid, alg: 'RS256', use: 'sig' }] }, { 'cache-control': 'public, max-age=3600' });
      }
      if (u === 'https://oauth2.googleapis.com/token') {
        const params = form(opts);
        google.calls.push({ url: u, params });
        const r = google.onToken(params);
        return reply(r.status, r.body);
      }
      if (u === 'https://oauth2.googleapis.com/revoke') {
        google.calls.push({ url: u, params: form(opts) });
        return reply(200, {});
      }
      throw new Error('fake google: unexpected url ' + u);
    },
  };
  return google;
}

const cookieOf = (r, re) => r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => re.test(c));

// Runs the real /auth/login -> /auth/callback with the fake Google. The identity claims (sub, email, name, nonce)
// are set here; anything else already on google.claims is kept so a test can pre-set e.g. `hd`.
export async function googleLogin(url, google, email, { cookie, name } = {}) {
  const login = await fetch(`${url}/auth/login`, { redirect: 'manual', headers: cookie ? { cookie } : {} });
  if (login.status !== 302) throw new Error('login start failed: ' + login.status);
  const q = new URL(login.headers.get('location')).searchParams;
  const loginCookie = cookieOf(login, /^(__Host-)?tr_login=/);
  google.claims = { ...google.claims, sub: 'g:' + email, email, name: name || email.split('@')[0], nonce: q.get('nonce') };
  const redirects = [];
  const jar = [cookie, loginCookie].filter(Boolean).join('; ');
  const cb = await fetch(`${url}/auth/callback?code=code-${Date.now()}&state=${q.get('state')}`, { redirect: 'manual', headers: { cookie: jar } });
  if (cb.status !== 302) { const e = new Error('google login failed: ' + cb.status); e.status = cb.status; throw e; }
  let sess = cookieOf(cb, /^(__Host-)?tr_sess=/) || cookie;
  let loc = cb.headers.get('location');
  redirects.push(loc);
  if (loc && loc.includes('consent=1')) {
    const c = await fetch(new URL(loc, url), { redirect: 'manual', headers: sess ? { cookie: sess } : {} });
    sess = cookieOf(c, /^(__Host-)?tr_sess=/) || sess;
    const next = c.headers.get('location');
    if (next) redirects.push(next);
  }
  let csrf;
  if (sess) {
    const cfg = await fetch(`${url}/api/config`, { headers: { cookie: sess } });
    if (cfg.status === 200) csrf = (await cfg.json()).csrf;
  }
  return { cookie: sess, csrf, redirects };
}
