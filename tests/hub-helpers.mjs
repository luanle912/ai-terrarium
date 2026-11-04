// Reusable helpers for hub tests that need a real HTTP hub (Tasks 6-8).
//   startDevHub(opts?)           -> {url, hub, config, clock, logs, close()}
//        opts: {env: {...extra env}, now: () => ms (default: controllable clock), deps: {...extra createHub deps}}
//        temp sqlite file, random free port, HUB_DEV_LOGIN on http://127.0.0.1:<port>, domains newera.inc,
//        owner boss@newera.inc. clock = {t, advance(ms)} drives deps.now unless opts.now is given.
//   devLogin(url, email, name?)  -> {cookie, csrf}   (cookie = "tr_sess=...", ready for the Cookie header)
//   pairDevice(url, login, name?) -> {token, device_id, island_id, user_code}  (start -> approve form -> token)
import { createRequire } from 'node:module';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
    HUB_DEV_LOGIN: '1', HUB_DB: path.join(dir, 'hub.sqlite'), HUB_PORT: String(port), ...(opts.env || {}),
  });
  const hub = createHub(config, { now: opts.now || (() => clock.t), log: (l) => logs.push(l), ...(opts.deps || {}) });
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
