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
const USAGE_GLOB = path.join(os.homedir(), '.claude', 'plugins', 'store');
let usageCache = []; let usageCacheTs = 0;
// Sources, in order: <configDir>/usage.json (written by `server.js statusline`), then the legacy usage-quota* files.
// An empty array means "unknown", which the page shows as "--" rather than 0%.
// Passing opts (dir, legacyDir, now) bypasses the 5 s cache; used by tests.
function readUsage(opts) {
  const now = (opts && opts.now) || Date.now();
  if (!opts && now - usageCacheTs < 5000) return usageCache;
  let out = [];
  try {
    const cur = require('./lib/statusline.js').readUsageFile((opts && opts.dir) || require('./lib/terrarium-config.js').configDir(), now);
    if (cur && cur.length) out = cur;
  } catch {}
  if (!out.length) {
    const legacyDir = (opts && opts.legacyDir) || USAGE_GLOB;
    try {
      const files = fs.readdirSync(legacyDir).filter(f => f.startsWith('usage-quota'));
      for (const f of files) {
        const d = JSON.parse(fs.readFileSync(path.join(legacyDir, f), 'utf8'));
        const lims = (d.limits && d.limits.limits) || (d.planLimits && d.planLimits.limits) || [];
        out = lims.map(l => ({ kind: l.kind, pct: l.percentUsed || 0, resets: l.resetsAt }));
        break;
      }
    } catch {}
  }
  if (opts) return out;
  usageCacheTs = now; usageCache = out;
  return usageCache;
}
const files = new Map();
// Transcript parsing and the status decision live in lib/status.js (pure functions, tested with fixture transcripts).
const { TRANSCRIPT_RE, newState, ingest, readRegistryDir, liveFromRegistry, defaultAlive, buildSessions } = require('./lib/status.js');

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
    if (stat.size < st.offset) { st.offset = 0; st.rest = ''; }
    if (stat.size === st.offset) continue;
    const MAX_CHUNK = 64 * 1024 * 1024;
    const remaining = stat.size - st.offset;
    if (st.offset === 0 && remaining > MAX_CHUNK) { st.offset = Math.max(0, stat.size - MAX_CHUNK); st.rest = ''; }
    const toRead = Math.min(MAX_CHUNK, stat.size - st.offset);
    const fd = fs.openSync(f, 'r'); const buf = Buffer.alloc(toRead);
    try { fs.readSync(fd, buf, 0, toRead, st.offset); } finally { fs.closeSync(fd); } st.offset += toRead;
    const lines = (st.rest + buf.toString('utf8')).split('\n'); st.rest = lines.pop();
    for (const l of lines) { if (!l.trim()) continue; try { ingest(st, JSON.parse(l), wasIncremental); } catch {} }
  }
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

function snapshot() {
  const now = Date.now();
  return { at: now, sessions: buildSessions(files.values(), liveSessions(), { now, permMs: PERM_MS, activeMs: ACTIVE_MS }), usage: readUsage(), version: VERSION };
}

const HTML_FILE = path.join(__dirname, 'claude-office.html');
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

function createHandler({ snapshot: snap = snapshot, scan: doScan = scan, htmlFile = HTML_FILE, port = PORT, allowedHosts = ALLOWED_HOSTS, allowedOrigin = ALLOWED_ORIGIN, publicPreview = () => ({ state: 'off' }), joinFlow = null } = {}) {
  return (req, res) => {
    if (!hostAllowed(req.headers.host, port, allowedHosts)) { res.writeHead(403); res.end('Forbidden'); return; }
    const route = (req.url || '').split('?')[0];
    if ((route === '/api/join' || route === '/api/leave') && req.method === 'POST' && joinFlow) {
      const action = route === '/api/join' ? 'join' : 'leave';
      if (!joinRequestAllowed(req, port, allowedHosts, action)) { res.writeHead(403); res.end('Forbidden'); return; }
      (action === 'join' ? joinFlow.start() : joinFlow.leave())
        .then(j => { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(j)); })
        .catch(() => { res.writeHead(500); res.end('error'); });
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
    else if (route === '/api/public-preview') {
      Promise.resolve().then(() => publicPreview()).then(j => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); })
        .catch(() => { res.writeHead(500); res.end('error'); });
    }
    else if (route === '/' || route === '/index.html') {
      try { const html = fs.readFileSync(htmlFile, 'utf8'); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); }
      catch { res.writeHead(404); res.end('claude-office.html not found — place it next to this script'); }
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

// Preview of what the hub would see. Before joining (or while the publisher has no view) it is a Kín view built with a
// RAM-only salt; once the publisher has its own view, that one is used.
function makePublicPreview({ publisher, getSnapshot, salt }) {
  const { createPublicView } = require('./lib/public-view.js');
  const viewFn = createPublicView(salt);
  return () => {
    const v = publisher ? publisher.view() : null;
    if (v) return { ...publisher.state(), view: v };
    return { state: publisher ? publisher.state().state : 'off', view: viewFn(getSnapshot(), { share: 'kin', projects: [], private: false }) };
  };
}

async function main() {
  // Subcommands (status/share/private/leave/join) run before listening; null means "serve as usual".
  const cfgLib = require('./lib/terrarium-config.js'), pub = require('./lib/publisher.js');
  const joinCmd = async (hub, { name }) => {
    try { await pub.join(hub, { name, dir: cfgLib.configDir() }); return 0; }
    catch (e) { console.log('join: ' + e.message); return 1; }
  };
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
  listenWithRetry(http.createServer(createHandler({ publicPreview, joinFlow })), PORT, '127.0.0.1')
    .then(() => {
      console.log(`Claude Office → http://localhost:${PORT}  (UI + SSE, watching ${ROOT})`);
      // Only the process that holds the port publishes.
      publisher = pub.startPublisher({ getSnapshot: snapshot, dir: cfgLib.configDir(), log: console.log });
    });
}

module.exports = { hostAllowed, corsOrigin, createHandler, listenWithRetry, snapshot, scan, makePublicPreview, readUsage, makeJoinFlow, joinRequestAllowed };
if (require.main === module) main();
