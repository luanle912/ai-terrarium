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
const { TRANSCRIPT_RE, newState, ingest, projectOf, parentFromPath, modeOf, sessionStatus } = require('./lib/status.js');

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

// Session đang chạy thật: Claude Code ghi ~/.claude/sessions/<pid>.json cho mỗi tiến trình (sessionId, cwd, name, status).
// Có danh sách này thì chỉ hiện session còn sống; không có (bản Claude Code cũ) thì quay về lọc theo thời gian.
const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');
let liveCache = null, liveTs = 0;
function liveSessions() {
  const now = Date.now();
  if (now - liveTs < 2000) return liveCache;
  liveTs = now;
  const m = new Map();
  let names = []; try { names = fs.readdirSync(SESSIONS_DIR).filter(f => /^\d+\.json$/.test(f)); } catch {}
  for (const f of names) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8'));
      const pid = +j.pid || parseInt(f, 10);
      try { process.kill(pid, 0); } catch (err) { if (err.code !== 'EPERM') continue; }
      if (j.sessionId) m.set(j.sessionId, { pid, name: j.name || '', status: j.status || '', cwd: j.cwd || '' });
    } catch {}
  }
  return (liveCache = m.size ? m : null);
}

const MAX_ROOTS = 16, MAX_SUBS = 12, SUB_STALE_MS = 5 * 60e3;
function snapshot() {
  const now = Date.now(), out = [];
  const live = liveSessions();
  // Root session state by sessionId, so a sub-agent without its own permissionMode can use its parent's.
  const parentStOf = new Map();
  for (const st of files.values()) if (st.sessionId && !parentFromPath(st.file) && !st.sidechain) parentStOf.set(st.sessionId, st);
  for (const st of files.values()) {
    const aliveTs = Math.max(st.fileMtime || 0, st.lastTs || 0);
    if (!aliveTs || now - aliveTs > ACTIVE_MS) continue;
    const activityTs = st.lastTs || st.fileMtime || 0;
    const fromPath = parentFromPath(st.file);
    const isSub = !!fromPath || !!st.sidechain;
    const id = isSub ? path.basename(st.file, '.jsonl') : (st.sessionId || path.basename(st.file, '.jsonl'));
    const parentId = isSub ? (fromPath || st.sessionId || null) : null;
    // Session (hoặc session cha của sub-agent) đã đóng → bỏ.
    if (live && !live.has(isSub ? parentId : id)) continue;
    const reg = !isSub && live ? live.get(id) : null;
    const pend = st.pending.size > 0;
    const parentSt = isSub ? parentStOf.get(parentId) : null;
    let { status, tool, detail, talkingTo } = sessionStatus(st, { now, permMs: PERM_MS, mode: modeOf(st, parentSt), regStatus: reg ? reg.status : undefined });
    if (isSub) {
      // Sub-agent đã nộp kết quả (StructuredOutput/SubagentHandback) hoặc hết việc → báo done 30s rồi loại.
      if (!pend && (st.finished || status === 'idle' || status === 'done')) { if (now - activityTs > 30000) continue; status = 'done'; }
      // Không tool nào đang chạy mà im lặng quá lâu → agent đã chết/bị huỷ.
      else if (!pend && now - activityTs > SUB_STALE_MS) continue;
    }
    const displayName = (reg && reg.name) || st.name || st.title || (isSub ? 'sub-agent' : path.basename(st.cwd || id));
    const project = projectOf((reg && reg.cwd) || st.firstCwd || st.cwd);
    const _sendTo = st.lastSendTo && now - st.lastSendTo.ts < 600000 ? st.lastSendTo.name : null;
    out.push({ id, parentId, name: displayName, project, cwd: st.cwd, model: st.model, tokens: st.tokens, status, tool, detail, talkingTo, _sendTo, recent: st.recent, updatedAt: aliveTs });
  }
  // Session đang mở nhưng chưa/không còn transcript gần đây (idle lâu) → vẫn có mặt ở bàn.
  if (live) for (const [sid, r] of live) {
    if (out.some(s => s.id === sid)) continue;
    out.push({ id: sid, parentId: null, name: r.name || path.basename(r.cwd || '') || 'session', project: projectOf(r.cwd), cwd: r.cwd, model: '', tokens: 0, status: r.status === 'busy' ? 'working' : 'idle', tool: '', detail: '', talkingTo: '', recent: [], updatedAt: now });
  }
  // Sub-agent mà session cha không có mặt → bỏ (tránh nhân vật mồ côi tạo phòng "sub-agent").
  const ids = new Set(out.filter(s => !s.parentId).map(s => s.id));
  for (let i = out.length - 1; i >= 0; i--) if (out[i].parentId && !ids.has(out[i].parentId)) out.splice(i, 1);
  const ACTIVE = new Set(['working', 'thinking', 'talking', 'permission']);
  for (const s of out) {
    if (s.status !== 'waiting' && !(s.status === 'working' && !s.tool && !s.parentId)) continue;
    const kids = out.filter(k => k.parentId === s.id && (ACTIVE.has(k.status) || k.status === 'waiting')).sort((a, b) => b.updatedAt - a.updatedAt);
    if (kids[0]) { s.status = 'waiting'; s.waitingOn = kids[0].id; }
    else if (s.status === 'waiting') { const any = out.find(k => k.parentId === s.id); if (any) s.waitingOn = any.id; }
  }
  for (const s of out) {
    if ((s.status === 'idle' || s.status === 'done') && s._sendTo) {
      const tgt = out.find(t => t.name === s._sendTo && ACTIVE.has(t.status));
      if (tgt) { s.status = 'waiting'; s.waitingOn = tgt.id; s.detail = 'đợi ' + tgt.name; }
    }
    delete s._sendTo;
  }
  // Sub-agent: nếu parent idle/done → sub cũng done
  for (const s of out) {
    if (s.parentId) {
      const par = out.find(p => p.id === s.parentId);
      if (par && (par.status === 'idle' || par.status === 'done')) s.status = 'done';
    }
  }
  // Ưu tiên session gốc (mỗi session một bàn), sub-agent đứng cạnh bàn cha nên giới hạn riêng.
  const byRecent = (a, b) => b.updatedAt - a.updatedAt;
  const roots = out.filter(s => !s.parentId).sort(byRecent).slice(0, MAX_ROOTS);
  const keep = new Set(roots.map(s => s.id));
  const subs = out.filter(s => s.parentId && keep.has(s.parentId)).sort(byRecent).slice(0, MAX_SUBS);
  for (const s of subs) s.project = roots.find(r => r.id === s.parentId).project;
  return { at: now, sessions: roots.concat(subs), usage: readUsage(), version: VERSION };
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
  return {
    status() { return { ...cur }; },
    start() {
      const c = readCfg();
      if (c && typeof c.token === 'string' && c.token && !c.revoked) {
        try { openBrowser(c.hub); } catch {}
        return Promise.resolve({ phase: 'joined', hub: c.hub });
      }
      if ((cur.phase === 'pending' && now() < cur.expiresAt) || cur.phase === 'starting') return Promise.resolve({ ...cur });
      const my = ++gen;
      cur = { phase: 'starting' };
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
      gen++;
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
