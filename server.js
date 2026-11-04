#!/usr/bin/env node
// Claude Office — local server. Đọc transcript ~/.claude/projects/**/*.jsonl và stream trạng thái session qua SSE.
// Chạy: node claude-office-server.js   (Node 18+, không cần cài package)
// Env: PORT (4317), CLAUDE_DIR (~/.claude/projects), ACTIVE_MIN (10), PERM_SEC (8)
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), { execSync } = require('child_process');
const ROOT = process.env.CLAUDE_DIR || path.join(os.homedir(), '.claude', 'projects');
const PORT = +process.env.PORT || 4317;
const ACTIVE_MS = (+process.env.ACTIVE_MIN || 120) * 60e3;
const PERM_MS = (+process.env.PERM_SEC || 8) * 1e3;
const PERM_TOOLS = new Set(['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'WebFetch']);
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
let psSessionCache = []; let psLastScan = 0;

function walk(dir, out = []) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.jsonl')) out.push(p); }
  return out;
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
  if (e.cwd) st.cwd = e.cwd;
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
      if (c.type === 'tool_use') { const entry = { name: c.name, detail: brief(c.name, c.input), t }; if (c.name === 'SendMessage' && c.input && c.input.to) { entry.to = String(c.input.to); st.lastSendTo = { name: String(c.input.to), ts: t }; } st.pending.set(c.id, entry); st.recent.unshift({ t: hhmmss(t), text: c.name + ' · ' + brief(c.name, c.input) }); }
    }
    st.last = 'assistant'; st.stop = msg.stop_reason || st.stop;
  } else if (e.type === 'user') {
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
    fs.readSync(fd, buf, 0, toRead, st.offset); fs.closeSync(fd); st.offset += toRead;
    const lines = (st.rest + buf.toString('utf8')).split('\n'); st.rest = lines.pop();
    for (const l of lines) { if (!l.trim()) continue; try { ingest(st, JSON.parse(l), wasIncremental); } catch {} }
  }
}

function snapshot() {
  const now = Date.now(), out = [];
  for (const st of files.values()) {
    const aliveTs = Math.max(st.fileMtime || 0, st.lastTs || 0);
    if (!aliveTs || now - aliveTs > ACTIVE_MS) continue;
    const activityTs = st.lastTs || st.fileMtime || 0;
    const isSub = st.file.includes(path.sep + 'subagents' + path.sep) || st.sidechain;
    const id = isSub ? path.basename(st.file, '.jsonl') : (st.sessionId || path.basename(st.file, '.jsonl'));
    let parentId = null;
    if (isSub) parentId = st.file.includes(path.sep + 'subagents' + path.sep) ? path.basename(path.dirname(path.dirname(st.file))) : st.sessionId;
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
    // Sub-agent xong việc (idle) → báo done rồi loại khỏi snapshot sau 30s
    if (isSub && status === 'idle') { if (now - activityTs > 30000) continue; status = 'done'; }
    const displayName = st.name || st.title || (isSub ? 'sub-agent' : path.basename(st.cwd || id));
    const _sendTo = st.lastSendTo && now - st.lastSendTo.ts < 600000 ? st.lastSendTo.name : null;
    out.push({ id, parentId, name: displayName, cwd: st.cwd, model: st.model, tokens: st.tokens, status, tool, detail, talkingTo, _sendTo, recent: st.recent, updatedAt: aliveTs });
  }
  const knownNames = new Set(out.map(s => s.name));
  for (const ps of scanProcesses()) {
    if (knownNames.has(ps.name)) continue;
    out.push({ id: 'ps-' + ps.pid, parentId: null, name: ps.name, cwd: ps.cwd, model: '', tokens: 0, status: ps.status, tool: '', detail: 'no transcript', recent: [], updatedAt: now });
  }
  for (const s of out) if (s.status === 'waiting') {
    const kids = out.filter(k => k.parentId === s.id).sort((a, b) => b.updatedAt - a.updatedAt);
    if (kids[0]) s.waitingOn = kids[0].id;
  }
  const ACTIVE = new Set(['working', 'thinking', 'talking', 'permission']);
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
  return { at: now, sessions: out.slice(0, 12), usage: readUsage() };
}

const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');
function scanProcesses() {
  const now = Date.now();
  if (now - psLastScan < 5000) return psSessionCache;
  psLastScan = now;
  try {
    const out = execSync("ps axo pid,args 2>/dev/null | grep '[c]laude' | grep -v 'claude-office'", { encoding: 'utf8', timeout: 3000 });
    const sessions = [];
    for (const line of out.split('\n')) {
      const m = line.match(/^\s*(\d+)\s+claude\s+(-r|--resume)\s+(\S+)/);
      if (!m) continue;
      const [, pid, , argName] = m;
      const isFork = line.includes('--fork-session');
      let name = isFork ? argName + '-fork' : argName;
      let status = 'working', cwd = '';
      try {
        const sj = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, pid + '.json'), 'utf8'));
        if (sj.name) name = sj.name;
        if (sj.cwd) cwd = sj.cwd;
        if (sj.status === 'busy') status = 'working';
        else if (sj.status === 'idle') status = 'idle';
        else if (sj.status === 'shell') status = 'idle';
      } catch {}
      sessions.push({ pid, name, status, cwd });
    }
    psSessionCache = sessions;
  } catch { psSessionCache = []; }
  return psSessionCache;
}

const HTML_FILE = path.join(__dirname, 'claude-office.html');
const clients = new Set();
setInterval(() => { scan(); const data = 'data: ' + JSON.stringify(snapshot()) + '\n\n'; for (const r of clients) r.write(data); }, 1000);
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url.startsWith('/events')) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    scan(); res.write('data: ' + JSON.stringify(snapshot()) + '\n\n'); clients.add(res); req.on('close', () => clients.delete(res));
  } else if (req.url.startsWith('/snapshot')) { scan(); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(snapshot(), null, 2)); }
  else if (req.url === '/' || req.url === '/index.html') {
    try { const html = fs.readFileSync(HTML_FILE, 'utf8'); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); }
    catch { res.writeHead(404); res.end('claude-office.html not found — place it next to this script'); }
  }
  else { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('Claude Office · http://localhost:' + PORT + ' (UI) · /events (SSE) · /snapshot\nWatching ' + ROOT); }
}).listen(PORT, () => console.log(`Claude Office → http://localhost:${PORT}  (UI + SSE, watching ${ROOT})`));
