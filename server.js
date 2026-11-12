#!/usr/bin/env node
// Claude Office — local server. Đọc transcript ~/.claude/projects/**/*.jsonl và stream trạng thái session qua SSE.
// Chạy: node claude-office-server.js   (Node 18+, không cần cài package)
// Env: PORT (4317), CLAUDE_DIR (~/.claude/projects), ACTIVE_MIN (120), PERM_SEC (8)
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), crypto = require('crypto');
const ROOT = process.env.CLAUDE_DIR || path.join(os.homedir(), '.claude', 'projects');
const PKG = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '.claude-plugin', 'plugin.json'), 'utf8')); } catch { return {}; } })();
const VERSION = PKG.version || 'dev';
const PORT = +process.env.PORT || 4317;
const ACTIVE_MS = (+process.env.ACTIVE_MIN || 120) * 60e3;
const PERM_MS = (+process.env.PERM_SEC || 8) * 1e3;
const MAX_CLIENTS = 20;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const DEFAULT_HUB = 'https://terrarium.openlabs.click';
const files = new Map();
// Transcript parsing and the status decision live in lib/status.js (pure functions, tested with fixture transcripts).
const { TRANSCRIPT_RE, newState, ingest, readRegistryDir, liveFromRegistry, defaultAlive, buildSessions, quotaHits } = require('./lib/status.js');
// The usage board's figures and whether to show it (lib/usage.js): status line, the CLI's get_usage, hit limits.
let usageOf = null;
const currentUsage = now => (usageOf ||= require('./lib/usage.js').createUsage({ dir: require('./lib/terrarium-config.js').configDir() }))(now, quotaHits(files.values(), quotaMemo));
// Limit hits (429s) seen in any transcript, kept after the transcript goes quiet: {kind: resetsAt ms}.
const quotaMemo = {};

function walk(dir, out = []) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (TRANSCRIPT_RE.test(e.name)) out.push(p); }
  return out;
}
function scan() {
  const now = Date.now();
  for (const f of files.keys()) { try { fs.accessSync(f); } catch { files.delete(f); } }
  for (const f of walk(ROOT)) {
    let stat; try { stat = fs.statSync(f); } catch { continue; }
    if (now - stat.mtimeMs > ACTIVE_MS) { files.delete(f); continue; }
    let st = files.get(f);
    if (!st) { st = newState(f, stat.mtimeMs); files.set(f, st); }
    const wasIncremental = st.offset > 0;
    st.fileMtime = stat.mtimeMs;
    if (stat.size < st.offset) { st.offset = 0; st.restBuf = null; }
    if (stat.size === st.offset) continue;
    // A new file is read from its last 64 MB at most; what is new is read a megabyte at a time (readAppended).
    const MAX_TAIL = 64 * 1024 * 1024;
    if (st.offset === 0 && stat.size > MAX_TAIL) { st.offset = stat.size - MAX_TAIL; st.restBuf = null; }
    try { readAppended(f, st, stat.size, l => { try { ingest(st, JSON.parse(l), wasIncremental); } catch {} }); } catch {}
  }
}

// Feeds each whole line appended to f between st.offset and size to onLine, reading `chunk` bytes at a time through
// one reused buffer (a single 64 MB read used to leave the process holding ~250 MB it never gave back). Lines are cut
// at the newline byte, which never occurs inside a UTF-8 character, so text is decoded only once a line is whole; the
// bytes of a line still being written wait in st.restBuf for the next read.
const READ_CHUNK = 1024 * 1024;
let readBuf = null;
function readAppended(f, st, size, onLine, chunk = READ_CHUNK) {
  const buf = chunk === READ_CHUNK ? (readBuf ||= Buffer.alloc(READ_CHUNK)) : Buffer.alloc(chunk);
  const fd = fs.openSync(f, 'r');
  try {
    while (st.offset < size) {
      const n = fs.readSync(fd, buf, 0, Math.min(chunk, size - st.offset), st.offset);
      if (n <= 0) break;
      st.offset += n;
      const data = st.restBuf && st.restBuf.length ? Buffer.concat([st.restBuf, buf.subarray(0, n)]) : buf.subarray(0, n);
      const nl = data.lastIndexOf(10);
      if (nl < 0) { st.restBuf = Buffer.from(data); continue; }
      for (const l of data.toString('utf8', 0, nl).split('\n')) if (l.trim()) onLine(l);
      st.restBuf = Buffer.from(data.subarray(nl + 1));
    }
  } finally { fs.closeSync(fd); }
}

// Live sessions: Claude Code writes ~/.claude/sessions/<pid>.json per process. With that directory only live sessions
// show (an empty one means none); without it (an older Claude Code) we fall back to time filtering. See lib/status.js.
const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');
let liveCache = null, liveTs = 0;
function liveSessions() {
  const now = Date.now();
  if (now - liveTs < 2000) return liveCache;
  liveTs = now;
  return (liveCache = liveFromRegistry(readRegistryDir(SESSIONS_DIR), { prev: liveCache, alive: defaultAlive }));
}

// The weather chosen on any page this server serves, for every page (lib/page-settings.js): the wallpaper app's web
// view has its own browser storage and no settings panel. Not part of what is published to a hub (lib/public-view.js).
let settingsOf = null;
const pageSettings = () => (settingsOf ||= require('./lib/page-settings.js').createPageSettings(path.join(require('./lib/terrarium-config.js').configDir(), 'page-settings.json')));

function snapshot() {
  const now = Date.now();
  const u = currentUsage(now);
  // usagePlan: true once a claude.ai plan is known, false with no plan limits (API key), null when unknown; the page
  // shows the board only for true.
  return { at: now, sessions: buildSessions(files.values(), liveSessions(), { now, permMs: PERM_MS, activeMs: ACTIVE_MS }), usage: u.windows, usagePlan: u.plan, usageSource: u.source, pageSettings: pageSettings().get(), version: VERSION };
}

const animalRootsLib = require('./lib/animal-roots.js');
const animalRootsFrom = (fileStates, live, now) => animalRootsLib.animalRootsFrom(fileStates, live, now, { permMs: PERM_MS, activeMs: ACTIVE_MS });
function animalRoots() { return animalRootsFrom(files.values(), liveSessions(), Date.now()); }

const HTML_FILE = path.join(__dirname, 'claude-office.html');
const webAssets = require('./lib/web-assets.js');
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || '').split(',').map(h => h.trim()).filter(Boolean);
const clients = new Set();

// DNS-rebinding guard: only loopback names on our own port (plus ALLOWED_HOSTS) may talk to us.
function hostAllowed(host, port, extra = []) {
  if (!host) return false;
  const h = String(host).toLowerCase();
  return ['localhost', '127.0.0.1', '[::1]'].some(n => h === n + ':' + port) || extra.some(e => String(e).toLowerCase() === h);
}
// CORS: echo only the one configured origin; everything else gets no CORS header at all.
function corsOrigin(origin, allowedOrigin) { return origin && allowedOrigin && origin === allowedOrigin ? origin : null; }

// Only this page may start pairing: its Origin must be our own, and the custom header forces a CORS preflight that a
// foreign site never gets past (we answer no OPTIONS), so a drive-by page cannot pair this machine to its own hub.
function joinRequestAllowed(req, port, extra = [], action = 'join') {
  if (String(req.headers['x-terrarium'] || '') !== action) return false;
  const o = req.headers.origin;
  if (!o) return true;
  return ['localhost', '127.0.0.1', '[::1]'].map(n => `http://${n}:${port}`).concat(extra.map(e => 'http://' + String(e).toLowerCase())).includes(String(o).toLowerCase());
}

// The "Tham gia / Thoát thế giới" buttons: pair with the default hub in the background, or leave it.
// `gen` retires an older join attempt, so a cancelled one can neither write a config nor overwrite the status.
function makeJoinFlow({ join, leave, readCfg, openBrowser, hub, name, now = Date.now }) {
  let cur = { phase: 'idle' }, gen = 0;
  // A start that has not reached 'pending' within 60 s (hub hung) becomes an error; bumping gen stops that join and
  // keeps its late answer from overwriting the error.
  const expire = () => {
    if (cur.phase === 'starting' && now() - cur.startedAt > 60000) { gen++; cur = { phase: 'error', error: 'hub_timeout' }; }
  };
  return {
    status() { expire(); return { ...cur }; },
    start() {
      expire();
      const c = readCfg();
      if (c && typeof c.token === 'string' && c.token && !c.revoked) {
        try { openBrowser(c.hub); } catch {}
        return Promise.resolve({ phase: 'joined', hub: c.hub });
      }
      if ((cur.phase === 'pending' && now() < cur.expiresAt) || cur.phase === 'starting') return Promise.resolve({ ...cur });
      const my = ++gen;
      cur = { phase: 'starting', startedAt: now() };
      return new Promise(resolve => {
        const set = v => { if (gen === my) cur = v; resolve({ ...v }); };
        join(hub, { name, openBrowser, log: () => {}, shouldStop: () => gen !== my,
          onStart: s => set({ phase: 'pending', code: s.userCode, url: s.url, expiresAt: now() + s.expiresIn * 1000 }) })
          .then(() => set({ phase: 'joined', hub }))
          .catch(e => set({ phase: 'error', error: String((e && e.message) || 'join failed').slice(0, 200) }));
      });
    },
    // Cancels a pending join, then revokes this device on the hub and removes the local config.
    async leave() {
      gen++;   // before any await: the running join must see shouldStop() === true at once
      cur = { phase: 'idle' };
      const lines = [];
      const code = await leave(l => lines.push(String(l)));
      if (code) return { phase: 'error', error: 'local_config' };
      return lines.some(l => /Could not reach the hub/.test(l)) ? { phase: 'left', warn: 'hub_unreachable' } : { phase: 'left' };
    },
  };
}

const ANIMAL_BODY_MAX = 1024;
const ANIMAL_ACTIONS = new Set(['catch', 'giveup', 'release', 'recall', 'free', 'resolve']);

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

// Token bucket: up to `burst` requests at once, one token back every `everyMs`.
function makeBucket({ burst, everyMs, now }) {
  let tokens = burst, at = now();
  return () => {
    const t = now();
    tokens = Math.min(burst, tokens + Math.max(0, t - at) / everyMs); at = t;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

// Resolves { value } for a JSON object body, or { status, error }; never reads past `max` bytes.
function readJsonBody(req, max) {
  return new Promise(resolve => {
    if (+req.headers['content-length'] > max) { resolve({ status: 413, error: 'too_large' }); return; }
    const chunks = []; let size = 0, done = false;
    const finish = r => { if (!done) { done = true; resolve(r); } };
    req.on('data', c => {
      if (done) return;
      size += c.length;
      if (size > max) finish({ status: 413, error: 'too_large' }); else chunks.push(c);
    });
    req.on('end', () => {
      let value;
      try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { finish({ status: 400, error: 'bad_json' }); return; }
      finish(value !== null && typeof value === 'object' && !Array.isArray(value) ? { value } : { status: 400, error: 'bad_json' });
    });
    req.on('error', () => finish({ status: 400, error: 'bad_body' }));
  });
}

function animalStream(req, res, animals, streams) {
  if (streams.size >= MAX_CLIENTS) { res.writeHead(429); res.end('Too many connections'); return; }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const write = v => res.write('data: ' + JSON.stringify(v) + '\n\n');
  write({ ...animals.view(), events: [] });
  const off = animals.subscribe(write);
  streams.add(res);
  req.on('close', () => { off(); streams.delete(res); });
}

function animalPost(req, res, name, ctx) {
  const { animals, port, allowedHosts, buckets } = ctx;
  if (!joinRequestAllowed(req, port, allowedHosts, 'animals')) { sendJson(res, 403, { error: 'forbidden' }); return; }
  readJsonBody(req, ANIMAL_BODY_MAX).then(b => {
    if (b.status === 413) { req.resume(); sendJson(res, 413, { error: b.error }, { Connection: 'close' }); return; }
    if (b.error) { sendJson(res, b.status, { error: b.error }); return; }
    // Counted only here, so a foreign page that fails the guards cannot drain this page's budget.
    if (!(name === 'env' ? buckets.env : buckets.act)()) { sendJson(res, 429, { error: 'rate_limited' }); return; }
    const out = name === 'env' ? animals.report(b.value) : name === 'dev' ? animals.devAct(b.value) : animals.act({ ...b.value, type: name });
    sendJson(res, out.status, out.body);
  }).catch(() => { if (!res.headersSent) sendJson(res, 500, { error: 'internal' }); });
}

// Spec 8: GET view / SSE stream, POST actions. Runs before the generic 405 and before CORS headers are added.
function animalRoute(req, res, route, ctx) {
  const { animals, animalsDev, streams } = ctx;
  if (!animals) { sendJson(res, 404, { error: 'not_found' }); return; }
  if (route === '/api/animals' || route === '/api/animals/events') {
    const isEvents = route === '/api/animals/events';
    if (req.method !== 'GET' && (isEvents || req.method !== 'HEAD')) { res.writeHead(405, { Allow: isEvents ? 'GET' : 'GET, HEAD' }); res.end('Method Not Allowed'); return; }
    let v;
    try { v = animals.view(); } catch { sendJson(res, 500, { error: 'internal' }); return; }
    if (v.disabled) sendJson(res, 503, v);
    else if (isEvents) animalStream(req, res, animals, streams);
    else sendJson(res, 200, v);
    return;
  }
  const name = route.slice('/api/animals/'.length);
  if (!(name === 'env' || ANIMAL_ACTIONS.has(name) || (name === 'dev' && animalsDev))) { sendJson(res, 404, { error: 'not_found' }); return; }
  if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); res.end('Method Not Allowed'); return; }
  animalPost(req, res, name, ctx);
}

function createHandler({ snapshot: snap = snapshot, scan: doScan = scan, htmlFile = HTML_FILE, webDir = webAssets.WEB_DIR, port = PORT, allowedHosts = ALLOWED_HOSTS, allowedOrigin = ALLOWED_ORIGIN, publicPreview = () => ({ state: 'off' }), joinFlow = null, logLines = () => [], settings = pageSettings, animals = null, animalsDev = false, now = () => performance.now() } = {}) {
  const animalCtx = { animals, animalsDev, port, allowedHosts, streams: new Set(),
    buckets: { act: makeBucket({ burst: 5, everyMs: 200, now }), env: makeBucket({ burst: 2, everyMs: 10e3, now }) } };
  return (req, res) => {
    if (!hostAllowed(req.headers.host, port, allowedHosts)) { res.writeHead(403); res.end('Forbidden'); return; }
    const route = (req.url || '').split('?')[0];
    if (route === '/api/animals' || route.startsWith('/api/animals/')) { animalRoute(req, res, route, animalCtx); return; }
    if ((route === '/api/join' || route === '/api/leave') && req.method === 'POST' && joinFlow) {
      const action = route === '/api/join' ? 'join' : 'leave';
      if (!joinRequestAllowed(req, port, allowedHosts, action)) { res.writeHead(403); res.end('Forbidden'); return; }
      (action === 'join' ? joinFlow.start() : joinFlow.leave())
        .then(j => { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(j)); })
        .catch(() => { res.writeHead(500); res.end('error'); });
      return;
    }
    // A page saving its settings: same guard as join (our own origin, an X-Terrarium header), a small JSON body.
    if (route === '/api/settings' && req.method === 'POST') {
      if (!joinRequestAllowed(req, port, allowedHosts, 'settings')) { res.writeHead(403); res.end('Forbidden'); return; }
      let body = '';
      req.on('data', d => { body += d; if (body.length > 4096) req.destroy(); });
      req.on('end', () => {
        let saved = null;
        try { saved = settings().set(JSON.parse(body)); } catch {}
        res.writeHead(saved ? 200 : 400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(saved ? { ok: true, settings: saved } : { ok: false }));
      });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method Not Allowed'); return; }
    const co = corsOrigin(req.headers.origin, allowedOrigin);
    if (co) { res.setHeader('Access-Control-Allow-Origin', co); res.setHeader('Vary', 'Origin'); }
    if (route === '/api/join' && joinFlow) { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(joinFlow.status())); }
    else if (route === '/events') {
      if (clients.size >= MAX_CLIENTS) { res.writeHead(429); res.end('Too many connections'); return; }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      doScan(); res.write('data: ' + JSON.stringify(snap()) + '\n\n'); clients.add(res); req.on('close', () => clients.delete(res));
    } else if (route === '/snapshot') { doScan(); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(snap(), null, 2)); }
    else if (route === '/api/log') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ lines: logLines() })); }
    else if (route === '/api/public-preview') {
      Promise.resolve().then(() => publicPreview()).then(j => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); })
        .catch(() => { res.writeHead(500); res.end('error'); });
    }
    else if (route === '/' || route === '/index.html') {
      try { const html = fs.readFileSync(htmlFile, 'utf8'); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(html); }
      catch { res.writeHead(404); res.end('claude-office.html not found — place it next to this script'); }
    }
    else if (route.startsWith('/web/')) {
      const a = webAssets.readAsset(route, webDir);
      if (a) { const r = webAssets.respond(a, req.headers); res.writeHead(r.status, r.headers); res.end(r.body || undefined); }
      else { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); }
    }
    else { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); }
  };
}

// Several Claude Code sessions each spawn this server; the losers wait quietly and take over when the port frees up.
function listenWithRetry(server, port, host, { retryMs = 10000, log = console.log } = {}) {
  return new Promise((resolve, reject) => {
    let warned = false;
    const attempt = () => server.listen(port, host);
    const onError = err => {
      if (err.code !== 'EADDRINUSE') { server.off('listening', onListening); server.off('error', onError); reject(err); return; }
      if (!warned) { warned = true; log(`Port ${port} is busy — another Claude Office is running; retrying every ${retryMs}ms`); }
      setTimeout(attempt, retryMs);
    };
    const onListening = () => { server.off('error', onError); resolve(); };
    server.on('error', onError); server.once('listening', onListening);
    attempt();
  });
}

// Only the process that holds the port publishes and runs the animal clock (spec 9.2).
function holdPortThenStart({ server, port, host, listen = listenWithRetry, startPublisher, animals = null, log = console.log, proc = process }) {
  return listen(server, port, host).then(() => {
    log(`Claude Office → http://localhost:${port}  (UI + SSE, watching ${ROOT})`);
    const publisher = startPublisher();
    if (animals) {
      animals.start();
      proc.once('exit', () => { try { animals.flush(); } catch (e) { log('terrarium: animal flush failed: ' + e.message); } });
      // Signals skip 'exit' handlers unless we exit ourselves.
      proc.once('SIGTERM', () => proc.exit(143));
      proc.once('SIGINT', () => proc.exit(130));
    }
    return publisher;
  });
}

// Preview of what the hub would see. Before joining (or while the publisher has no view) it is a Kín view built with a
// RAM-only salt; once the publisher has its own view, that one is used.
function makePublicPreview({ publisher, getSnapshot, salt }) {
  const { createPublicView } = require('./lib/public-view.js');
  const viewFn = createPublicView(salt);
  // A view that is not reaching the hub (offline, rejected, standby, paused) is marked stale for the page.
  const STALE = ['offline', 'rejected', 'standby', 'paused'];
  const mark = (st, view) => (STALE.includes(st.state) ? { ...view, stale: true } : view);
  return () => {
    const v = publisher ? publisher.view() : null;
    const st = publisher ? publisher.state() : { state: 'off' };
    if (v) return { ...st, view: mark(st, v) };
    return { ...st, view: mark(st, viewFn(getSnapshot(), { share: 'kin', projects: [], private: false })) };
  };
}

async function main() {
  // Subcommands (status/share/private/leave/join) run before listening; null means "serve as usual".
  const cfgLib = require('./lib/terrarium-config.js'), pub = require('./lib/publisher.js');
  const joinCmd = async (hub, { name }) => {
    try { await pub.join(hub, { name, dir: cfgLib.configDir() }); return 0; }
    catch (e) { console.log('join: ' + e.message); return 1; }
  };
  // wallpaper [install|build]: build (and install) the macOS wallpaper app in wallpaper/ (lib/wallpaper.js).
  if (process.argv[2] === 'wallpaper') process.exit(require('./lib/wallpaper.js').run(process.argv.slice(3)));
  if (process.argv[2] === 'statusline') process.exit(require('./lib/statusline.js').main(process.argv.slice(3), cfgLib.configDir()));
  const code = await cfgLib.runCommand(process.argv.slice(2), { join: joinCmd, revokeSelf: pub.revokeSelf });
  if (typeof code === 'number') process.exit(code);
  setInterval(() => { scan(); const data = 'data: ' + JSON.stringify(snapshot()) + '\n\n'; for (const r of clients) r.write(data); }, 1000);
  let publisher = null;
  // The salt only lives in RAM: it is used for the preview before joining, never written to disk.
  const publicPreview = makePublicPreview({ publisher: { state: () => publisher ? publisher.state() : { state: 'off' }, view: () => publisher ? publisher.view() : null }, getSnapshot: snapshot, salt: crypto.randomBytes(32).toString('hex') });
  const joinFlow = makeJoinFlow({
    join: pub.join, readCfg: () => cfgLib.readConfig(cfgLib.configDir()), openBrowser: pub.makeOpenBrowser(),
    leave: log => cfgLib.runCommand(['leave'], { log, revokeSelf: pub.revokeSelf }),
    hub: process.env.TERRARIUM_HUB || DEFAULT_HUB, name: os.hostname(),
  });
  const buf = require('./lib/logbuf.js').createLogBuffer();   // one ring buffer for the whole process, served at /api/log
  const animals = makeAnimalEngine(cfgLib.configDir(), ANIMALS_DEV, buf.log);
  holdPortThenStart({
    server: http.createServer(createHandler({ publicPreview, joinFlow, logLines: buf.lines, animals, animalsDev: ANIMALS_DEV })), port: PORT, host: '127.0.0.1', animals,
    // Only the process that holds the port publishes.
    startPublisher: () => pub.startPublisher({ getSnapshot: snapshot, dir: cfgLib.configDir(), log: buf.log }),
  }).then(p => { publisher = p; });
}

const ANIMALS_DEV = process.env.TERRARIUM_DEV === '1';
// Dev mode uses its own key and data so forced spawns never touch the real collection.
function makeAnimalEngine(dir, dev, log = console.log) {
  const { createStore } = require('./lib/animal-store.js'), { createAnimalEngine } = require('./lib/animal-engine.js');
  const store = createStore({ dir, log, ...(dev ? { name: 'animals-dev', aad: 'ai-terrarium/animals-dev' } : {}) });
  return createAnimalEngine({ store, getRoots: animalRoots, log, dev });
}

module.exports = { readAppended, hostAllowed, corsOrigin, createHandler, listenWithRetry, snapshot, scan, makePublicPreview, makeJoinFlow, joinRequestAllowed, animalRootsFrom, holdPortThenStart };
if (require.main === module) main();
