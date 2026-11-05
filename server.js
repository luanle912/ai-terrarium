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
const PERM_TOOLS = new Set(['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'WebFetch']);
const MAX_CLIENTS = 20;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const USAGE_GLOB = path.join(os.homedir(), '.claude', 'plugins', 'store');
let usageCache = []; let usageCacheTs = 0;
function readUsage() {
  const now = Date.now();
  if (now - usageCacheTs < 5000) return usageCache;
  usageCacheTs = now;
  try {
    const files = fs.readdirSync(USAGE_GLOB).filter(f => f.startsWith('usage-quota'));
    for (const f of files) {
      const d = JSON.parse(fs.readFileSync(path.join(USAGE_GLOB, f), 'utf8'));
      const lims = (d.limits && d.limits.limits) || (d.planLimits && d.planLimits.limits) || [];
      usageCache = lims.map(l => ({ kind: l.kind, pct: l.percentUsed || 0, resets: l.resetsAt }));
      return usageCache;
    }
  } catch {}
  return usageCache;
}
const files = new Map();
// Chỉ đọc transcript thật: <uuid>.jsonl (session) và agent-*.jsonl (sub-agent). Bỏ qua journal.jsonl của workflow v.v.
const TRANSCRIPT_RE = /^(agent-[\w-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;
// Tool mà sub-agent gọi để nộp kết quả cuối — sau tool_result của nó agent không chạy tiếp nữa.
const FINISH_TOOLS = new Set(['StructuredOutput', 'SubagentHandback']);

function walk(dir, out = []) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (TRANSCRIPT_RE.test(e.name)) out.push(p); }
  return out;
}
// Phòng ban = tên repo gốc: bỏ phần .claude/worktrees/<tên> để mọi worktree của một repo về chung một phòng.
function projectOf(cwd) {
  if (!cwd) return '';
  const mark = path.sep + '.claude' + path.sep + 'worktrees' + path.sep;
  const i = cwd.indexOf(mark);
  return path.basename(i >= 0 ? cwd.slice(0, i) : cwd.replace(/\/+$/, ''));
}
// ~/.claude/projects/<proj>/<sessionId>/subagents/[workflows/wf_x/]agent-*.jsonl → <sessionId>
function parentFromPath(file) {
  const seg = file.split(path.sep); const i = seg.lastIndexOf('subagents');
  return i > 0 ? seg[i - 1] : null;
}
function brief(name, input = {}) {
  if (name === 'SendMessage' && input.to) return String(input.to).slice(0, 48);
  if (input.file_path) return path.basename(input.file_path);
  if (input.command) return String(input.command).slice(0, 48);
  if (input.pattern) return String(input.pattern).slice(0, 40);
  if (input.url) { try { return new URL(input.url).host; } catch { return input.url.slice(0, 40); } }
  if (input.description) return String(input.description).slice(0, 48);
  if (input.prompt) return String(input.prompt).slice(0, 48);
  return '';
}
const hhmmss = t => new Date(t).toTimeString().slice(0, 8);

function ingest(st, e, isIncremental) {
  if (e.cwd) { st.cwd = e.cwd; if (!st.firstCwd) st.firstCwd = e.cwd; }
  if (e.sessionId) st.sessionId = e.sessionId;
  if (e.isSidechain) st.sidechain = true;
  if (e.type === 'agent-name' && e.agentName) st.name = e.agentName;
  if (e.type === 'custom-title' && e.customTitle) st.title = e.customTitle;
  const isActivity = (e.type === 'assistant' || e.type === 'user');
  const t = e.timestamp ? Date.parse(e.timestamp) : (isActivity ? (isIncremental ? Date.now() : (st.fileMtime || 0)) : 0);
  st.lastTs = Math.max(st.lastTs || 0, t);
  const msg = e.message || {};
  const content = Array.isArray(msg.content) ? msg.content : (typeof msg.content === 'string' ? [{ type: 'text', text: msg.content }] : []);
  if (e.type === 'assistant') {
    if (msg.model) st.model = msg.model;
    const u = msg.usage || {}; st.tokens += (u.input_tokens || 0) + (u.output_tokens || 0);
    for (const c of content) {
      if (c.type === 'tool_use') { st.finished = FINISH_TOOLS.has(c.name); const entry = { name: c.name, detail: brief(c.name, c.input), t }; if (c.name === 'SendMessage' && c.input && c.input.to) { entry.to = String(c.input.to); st.lastSendTo = { name: String(c.input.to), ts: t }; } st.pending.set(c.id, entry); st.recent.unshift({ t: hhmmss(t), text: c.name + ' · ' + brief(c.name, c.input) }); }
    }
    st.last = 'assistant'; st.stop = msg.stop_reason || st.stop;
    // Hết lượt → mọi tool của lượt đó đã xong; tool_use không có result (bị huỷ) không được treo lại.
    if (msg.stop_reason === 'end_turn') st.pending.clear();
  } else if (e.type === 'user') {
    const firstText = content.length && content[0].type === 'text' ? String(content[0].text || '') : '';
    if (firstText.startsWith('[Request interrupted')) {
      st.pending.clear(); st.last = 'interrupted'; st.lastSendTo = null;
      st.recent.unshift({ t: hhmmss(t), text: 'Bị ngắt bởi user' }); if (st.recent.length > 8) st.recent.length = 8;
      return;
    }
    let isResult = false;
    for (const c of content) {
      if (c.type === 'tool_result') { isResult = true; st.pending.delete(c.tool_use_id); if (c.is_error) { st.lastError = t; st.errText = String(typeof c.content === 'string' ? c.content : 'tool error').slice(0, 60); st.recent.unshift({ t: hhmmss(t), text: 'Lỗi · ' + st.errText }); } }
    }
    st.last = isResult ? 'tool_result' : 'prompt';
    if (!isResult) { st.recent.unshift({ t: hhmmss(t), text: 'Prompt mới từ user' }); st.lastSendTo = null; }
  }
  if (st.recent.length > 8) st.recent.length = 8;
}

function scan() {
  const now = Date.now();
  for (const f of files.keys()) { try { fs.accessSync(f); } catch { files.delete(f); } }
  for (const f of walk(ROOT)) {
    let stat; try { stat = fs.statSync(f); } catch { continue; }
    if (now - stat.mtimeMs > ACTIVE_MS) { files.delete(f); continue; }
    let st = files.get(f);
    if (!st) { st = { offset: 0, rest: '', tokens: 0, pending: new Map(), recent: [], file: f, fileMtime: stat.mtimeMs }; files.set(f, st); }
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
    const pend = [...st.pending.values()].sort((a, b) => b.t - a.t)[0];
    let status = 'working', tool = '', detail = '', talkingTo = '';
    if (pend) {
      tool = pend.name; detail = pend.detail;
      if (pend.name === 'Task' || pend.name === 'Agent') status = 'waiting';
      else if (pend.name === 'SendMessage') { status = 'talking'; if (pend.to) talkingTo = pend.to; }
      else if (PERM_TOOLS.has(pend.name) && now - pend.t > PERM_MS) status = 'permission';
    } else if (st.lastError && now - st.lastError < 30000) { status = 'error'; detail = st.errText; }
    else if ((st.last === 'prompt' || st.last === 'tool_result') && now - activityTs < 600000) status = 'thinking';
    else if (st.last === 'assistant' && st.stop === 'end_turn') status = now - activityTs < 60000 ? 'done' : 'idle';
    else status = 'idle';
    if (isSub) {
      // Sub-agent đã nộp kết quả (StructuredOutput/SubagentHandback) hoặc hết việc → báo done 30s rồi loại.
      if (!pend && (st.finished || status === 'idle' || status === 'done')) { if (now - activityTs > 30000) continue; status = 'done'; }
      // Không tool nào đang chạy mà im lặng quá lâu → agent đã chết/bị huỷ.
      else if (!pend && now - activityTs > SUB_STALE_MS) continue;
    } else if (reg) {
      // Trạng thái do chính Claude Code báo là nguồn đáng tin nhất cho session gốc.
      if (reg.status === 'idle' && (status === 'working' || status === 'thinking' || status === 'talking')) status = now - activityTs < 60000 ? 'done' : 'idle';
      else if (reg.status === 'busy' && (status === 'idle' || status === 'done')) status = 'working';
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

function createHandler({ snapshot: snap = snapshot, scan: doScan = scan, htmlFile = HTML_FILE, port = PORT, allowedHosts = ALLOWED_HOSTS, allowedOrigin = ALLOWED_ORIGIN, publicPreview = () => ({ state: 'off' }) } = {}) {
  return (req, res) => {
    if (!hostAllowed(req.headers.host, port, allowedHosts)) { res.writeHead(403); res.end('Forbidden'); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method Not Allowed'); return; }
    const co = corsOrigin(req.headers.origin, allowedOrigin);
    if (co) { res.setHeader('Access-Control-Allow-Origin', co); res.setHeader('Vary', 'Origin'); }
    const route = (req.url || '').split('?')[0];
    if (route === '/events') {
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
  const code = await cfgLib.runCommand(process.argv.slice(2), { join: joinCmd, revokeSelf: pub.revokeSelf });
  if (typeof code === 'number') process.exit(code);
  setInterval(() => { scan(); const data = 'data: ' + JSON.stringify(snapshot()) + '\n\n'; for (const r of clients) r.write(data); }, 1000);
  let publisher = null;
  // The salt only lives in RAM: it is used for the preview before joining, never written to disk.
  const publicPreview = makePublicPreview({ publisher: { state: () => publisher ? publisher.state() : { state: 'off' }, view: () => publisher ? publisher.view() : null }, getSnapshot: snapshot, salt: crypto.randomBytes(32).toString('hex') });
  listenWithRetry(http.createServer(createHandler({ publicPreview })), PORT, '127.0.0.1')
    .then(() => {
      console.log(`Claude Office → http://localhost:${PORT}  (UI + SSE, watching ${ROOT})`);
      // Only the process that holds the port publishes.
      publisher = pub.startPublisher({ getSnapshot: snapshot, dir: cfgLib.configDir(), log: console.log });
    });
}

module.exports = { hostAllowed, corsOrigin, createHandler, listenWithRetry, snapshot, scan, makePublicPreview };
if (require.main === module) main();
