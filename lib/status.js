// Session status as pure functions: transcript entries in (`ingest`), one status out (`sessionStatus`).
// server.js only reads files, caches state and calls these.
//
// Why a tool error is not a session error: a `tool_result` with `is_error` is ordinary work (a failing test, a missing
// file, a command denied by the auto-mode classifier). The model reads it and carries on, so the session is `thinking`,
// not broken. The error line still goes into `recent[]`. Only an API error (an `assistant` entry with
// `isApiErrorMessage: true`) means the session itself failed, and only that shows `error`.
//
// `permission` is a guess: a PERM_TOOLS tool that has been pending longer than PERM_MS in a mode that can ask. In `auto`
// and `bypassPermissions` nothing ever asks, so a long tool is just `working`. Known limit of `default` (and `plan`):
// a Bash the user already approved that runs longer than PERM_MS is still reported as `permission`, because the
// transcript does not record the approval and the registry only says busy/idle.
const path = require('path');

// Only real transcripts: <uuid>.jsonl (session) and agent-*.jsonl (sub-agent). Skips workflow journal.jsonl etc.
const TRANSCRIPT_RE = /^(agent-[\w-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;
const PERM_TOOLS = new Set(['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'WebFetch']);
// Tools a sub-agent calls to hand in its final result; after their tool_result the agent does not run again.
const FINISH_TOOLS = new Set(['StructuredOutput', 'SubagentHandback']);
const ERROR_MS = 30000;
const NO_PROMPT_MODES = new Set(['auto', 'bypassPermissions']);
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

function newState(file, mtimeMs) {
  return { offset: 0, rest: '', tokens: 0, pending: new Map(), recent: [], file, fileMtime: mtimeMs, lastTs: 0, last: null, stop: null, permMode: null, apiErrorAt: 0, apiErrText: '', interruptedAt: 0 };
}

// Room = the root repo name: drop .claude/worktrees/<name> so every worktree of a repo shares one room.
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

// The usage board's windows (the status line's rate_limits keys).
const QUOTA_KINDS = ['five_hour', 'seven_day'];
// Folds the limit hits of the transcripts read so far into memo ({kind: resetsAt ms}, the latest per window). memo
// outlives the transcripts: a weekly limit stays on the board after its session has gone quiet.
function quotaHits(states, memo) {
  for (const st of states) if (st && st.quota) for (const k of QUOTA_KINDS) if (st.quota[k] > (memo[k] || 0)) memo[k] = st.quota[k];
  return memo;
}
// The board's [{kind, pct, resets}] from the status line (may be empty) with each window whose limit was hit and has
// not reset yet shown as 100 %: at the limit that is the truth, whatever the status line said before.
function mergeQuota(usage, memo, now = Date.now()) {
  const out = (usage || []).filter(u => !(memo[u.kind] > now));
  for (const k of QUOTA_KINDS) if (memo[k] > now) out.push({ kind: k, pct: 100, resets: new Date(memo[k]).toISOString() });
  return out.sort((a, b) => QUOTA_KINDS.indexOf(a.kind) - QUOTA_KINDS.indexOf(b.kind));
}

function ingest(st, e, isIncremental, now = Date.now()) {
  if (e.cwd) { st.cwd = e.cwd; if (!st.firstCwd) st.firstCwd = e.cwd; }
  if (e.sessionId) st.sessionId = e.sessionId;
  if (e.isSidechain) st.sidechain = true;
  if (e.type === 'agent-name' && e.agentName) st.name = e.agentName;
  if (e.type === 'custom-title' && e.customTitle) st.title = e.customTitle;
  // The mode sits on `user` entries and on separate `permission-mode` entries; the newest one wins.
  if (typeof e.permissionMode === 'string') st.permMode = e.permissionMode;
  const isActivity = (e.type === 'assistant' || e.type === 'user');
  const t = e.timestamp ? Date.parse(e.timestamp) : (isActivity ? (isIncremental ? now : (st.fileMtime || 0)) : 0);
  st.lastTs = Math.max(st.lastTs || 0, t);
  const msg = e.message || {};
  const content = Array.isArray(msg.content) ? msg.content : (typeof msg.content === 'string' ? [{ type: 'text', text: msg.content }] : []);
  if (e.type === 'assistant' && e.isApiErrorMessage === true) {
    // Synthetic entry written by Claude Code when the API call failed: no tokens, no tools, model `<synthetic>`.
    const txt = content.find(c => c.type === 'text' && c.text);
    st.apiErrorAt = t; st.apiErrText = String(txt ? txt.text : 'API error').slice(0, 60); st.last = 'api_error';
    // A hit plan limit (429) names the window and when it resets: the usage board's only source when Claude Code runs
    // in the desktop app, which has no status line (quotaHits / mergeQuota).
    const rl = (e.apiErrorParams && e.apiErrorParams.rate_limit_info) || e.quotaLimits;
    if (rl && rl.status === 'rejected' && QUOTA_KINDS.includes(rl.rateLimitType) && Number.isFinite(rl.resetsAt)) {
      st.quota = st.quota || {};
      st.quota[rl.rateLimitType] = Math.max(st.quota[rl.rateLimitType] || 0, rl.resetsAt * 1000);
    }
  } else if (e.type === 'assistant') {
    if (msg.model) st.model = msg.model;
    const u = msg.usage || {}; st.tokens += (u.input_tokens || 0) + (u.output_tokens || 0);
    for (const c of content) {
      if (c.type === 'tool_use') { st.finished = FINISH_TOOLS.has(c.name); const entry = { name: c.name, detail: brief(c.name, c.input), t }; if (c.name === 'SendMessage' && c.input && c.input.to) { entry.to = String(c.input.to); st.lastSendTo = { name: String(c.input.to), ts: t }; } st.pending.set(c.id, entry); st.recent.unshift({ t: hhmmss(t), text: c.name + ' · ' + brief(c.name, c.input) }); }
    }
    st.last = 'assistant'; st.stop = msg.stop_reason || st.stop;
    // End of turn → every tool of that turn is done; a tool_use without a result (cancelled) must not stay pending.
    if (msg.stop_reason === 'end_turn') st.pending.clear();
  } else if (e.type === 'user') {
    const firstText = content.length && content[0].type === 'text' ? String(content[0].text || '') : '';
    if (firstText.startsWith('[Request interrupted')) {
      st.pending.clear(); st.last = 'interrupted'; st.lastSendTo = null; st.interruptedAt = t;
      st.recent.unshift({ t: hhmmss(t), text: 'Bị ngắt bởi user' }); if (st.recent.length > 8) st.recent.length = 8;
      return;
    }
    let isResult = false;
    for (const c of content) {
      if (c.type === 'tool_result') {
        isResult = true; st.pending.delete(c.tool_use_id);
        // A tool error is only a line in the details panel, never a session error (see the header comment).
        if (c.is_error) st.recent.unshift({ t: hhmmss(t), text: 'Lỗi · ' + String(typeof c.content === 'string' ? c.content : 'tool error').slice(0, 60) });
      }
    }
    st.last = isResult ? 'tool_result' : 'prompt';
    if (!isResult) { st.recent.unshift({ t: hhmmss(t), text: 'Prompt mới từ user' }); st.lastSendTo = null; }
  }
  if (st.recent.length > 8) st.recent.length = 8;
}

// Can this pending tool be waiting for the user's approval in this mode? Unknown mode behaves like `default`.
function promptable(mode, tool) {
  if (!PERM_TOOLS.has(tool)) return false;
  if (NO_PROMPT_MODES.has(mode)) return false;
  if (mode === 'acceptEdits') return !EDIT_TOOLS.has(tool);
  return true;
}

// A sub-agent's transcript usually carries no mode of its own; it runs under its parent session's mode.
function modeOf(st, parentSt) {
  return st.permMode ?? parentSt?.permMode ?? null;
}

// ---- Hung tools (L5a) ----
// A tool_use whose result never comes (the process was killed mid-tool, a cancelled call) would otherwise stay pending
// forever. Bash has a 10 min hard limit, so 11 min without the transcript growing means it is gone; other tools get
// 15 min. Agent/Task never expire: they live as long as their sub-agent, which is judged by its own transcript.
const PENDING_STALE_MS = { Bash: 11 * 60e3, other: 15 * 60e3 };
const NEVER_STALE = new Set(['Agent', 'Task']);
function pendingLive(entry, { now, fileMtime }) {
  if (NEVER_STALE.has(entry.name)) return true;
  const limit = entry.name === 'Bash' ? PENDING_STALE_MS.Bash : PENDING_STALE_MS.other;
  return now - Math.max(entry.t || 0, fileMtime || 0) <= limit;
}
function prunePending(st, now) {
  for (const [id, entry] of st.pending) if (!pendingLive(entry, { now, fileMtime: st.fileMtime })) st.pending.delete(id);
}

// regStatus: the registry's `busy`/`idle` for a root session (undefined when there is none, e.g. a sub-agent).
// Expired tools (pendingLive) are removed from st.pending here, so they never show as `permission` or `working`.
function sessionStatus(st, { now, permMs, mode, regStatus }) {
  prunePending(st, now);
  const activityTs = st.lastTs || st.fileMtime || 0;
  const pend = [...st.pending.values()].sort((a, b) => b.t - a.t)[0];
  let status = 'working', tool = '', detail = '', talkingTo = '';
  if (pend) {
    tool = pend.name; detail = pend.detail;
    if (pend.name === 'Task' || pend.name === 'Agent') status = 'waiting';
    else if (pend.name === 'SendMessage') { status = 'talking'; if (pend.to) talkingTo = pend.to; }
    else if (promptable(mode, pend.name) && now - pend.t > permMs) status = 'permission';
  } else if (st.last === 'api_error' && (now - st.apiErrorAt < ERROR_MS || regStatus === 'idle')) { status = 'error'; detail = st.apiErrText; }
  else if ((st.last === 'prompt' || st.last === 'tool_result') && now - activityTs < 600000) status = 'thinking';
  else if (st.last === 'assistant' && st.stop === 'end_turn') status = now - activityTs < 60000 ? 'done' : 'idle';
  else status = 'idle';
  // What Claude Code itself reports is the most reliable source for a root session.
  if (regStatus === 'idle' && (status === 'working' || status === 'thinking' || status === 'talking')) status = now - activityTs < 60000 ? 'done' : 'idle';
  else if (regStatus === 'busy' && (status === 'idle' || status === 'done')) status = 'working';
  return { status, tool, detail, talkingTo };
}

// ---- Live sessions: Claude Code writes ~/.claude/sessions/<pid>.json for every running process ----

// The only function here that touches the disk. `json` is null for a file that was read but does not parse (caught
// mid-write); a file that vanished between readdir and read is skipped.
function readRegistryDir(dir) {
  const fs = require('fs');
  let names;
  try { names = fs.readdirSync(dir).filter(f => /^\d+\.json$/.test(f)); } catch (err) { return { ok: false, code: err.code || 'EUNKNOWN' }; }
  const entries = [];
  for (const file of names) {
    // Gone since readdir: skip. Any other read error (EACCES, EMFILE...): treat like a file caught mid-write, so the
    // caller keeps what it said last time instead of dropping a live session for one scan.
    let txt; try { txt = fs.readFileSync(path.join(dir, file), 'utf8'); } catch (err) { if (err.code !== 'ENOENT') entries.push({ file, json: null }); continue; }
    let json = null; try { json = JSON.parse(txt); } catch {}
    entries.push({ file, json: json && typeof json === 'object' ? json : null });
  }
  return { ok: true, entries };
}

// Three cases, on purpose:
// - ENOENT: no registry directory at all (a Claude Code that does not write one) → null, the caller falls back to
//   time filtering;
// - any other read error (EMFILE, EACCES, ...) → `prev`, the last good list, so a hiccup does not empty the office;
// - a readable directory → a new Map, even an empty one: no live process means no session, never "every transcript of
//   the last two hours".
function liveFromRegistry(read, { prev = null, alive }) {
  if (!read.ok) {
    if (read.code === 'ENOENT') return null;
    if (!prev) return prev;
    // A lasting read error must not keep dead sessions on the page: keep only processes that still run.
    const kept = new Map();
    for (const [sid, v] of prev) if (alive(v.pid, v.procStart)) kept.set(sid, v);
    return kept;
  }
  // Pids no longer in the registry leave the procStart cache.
  alive.retain?.(new Set(read.entries.map(({ file, json }) => (json && +json.pid) || parseInt(file, 10))));
  const m = new Map();
  for (const { file, json } of read.entries) {
    if (json === null) {
      // Caught mid-write: keep what this file said last time.
      if (prev) for (const [sid, v] of prev) if (v.file === file && alive(v.pid, v.procStart)) m.set(sid, v);
      continue;
    }
    const pid = +json.pid || parseInt(file, 10);
    if (!json.sessionId || !alive(pid, json.procStart)) continue;
    const updatedAt = json.updatedAt || json.statusUpdatedAt || json.startedAt || 0, had = m.get(json.sessionId);
    if (had && had.updatedAt > updatedAt) continue; // two files for one session: the most recently updated wins
    m.set(json.sessionId, { pid, name: json.name || '', status: json.status || '', cwd: json.cwd || '', updatedAt, procStart: json.procStart, file });
  }
  return m;
}

// ---- Pid reuse (L4) ----
// A registry file left behind by a crashed process can name a pid the OS has since given to another process, so
// kill(pid, 0) alone would keep a dead session. The registry's `procStart` is compared with the start time `ps` reports.
const PS_DATE = /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/;
const normStart = s => { const v = String(s ?? '').replace(/\s+/g, ' ').trim(); return v || null; };

// ps runs once per pid, without a shell. The cache drops a pid once it leaves the registry (`retain`) or is found dead
// (`forget`), so a later process on that pid is looked up again.
// Claude Code writes procStart as `ps -o lstart` in UTC, so ps is asked for UTC too (a local time would never match).
// New pids cost one synchronous ps each; at most PS_PER_SCAN are looked up per scan (the rest fail open until the next
// scan), so a burst of new sessions cannot stall the server that also serves the page.
const PS_PER_SCAN = 4;
function makeProcStartOf({ execFileSync = require('child_process').execFileSync, platform = process.platform } = {}) {
  const cache = new Map();
  let left = PS_PER_SCAN;
  const procStartOf = (pid) => {
    if (platform === 'win32') return null;
    if (cache.has(pid)) return cache.get(pid);
    if (left <= 0) return null;
    left--;
    let v = null;
    try { v = normStart(execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' }, timeout: 1000, encoding: 'utf8' })); } catch { v = null; }
    cache.set(pid, v);
    return v;
  };
  procStartOf.forget = (pid) => { cache.delete(pid); };
  // Called once per scan (liveFromRegistry): drops pids that left the registry and refills the lookup budget.
  procStartOf.retain = (pids) => { left = PS_PER_SCAN; for (const pid of cache.keys()) if (!pids.has(pid)) cache.delete(pid); };
  return procStartOf;
}

// Alive = kill(pid, 0) succeeds (or EPERM: it exists but belongs to another user) and, when both start times are known,
// they match. Without ps (Windows, an error) kill(0) alone decides, as before. ps is only asked when the registry
// carries a procStart.
function makeAlive({ kill = process.kill, procStartOf }) {
  const alive = (pid, procStart) => {
    try { kill(pid, 0); } catch (err) { if (err.code !== 'EPERM') { procStartOf.forget?.(pid); return false; } }
    const want = normStart(procStart);
    if (want === null) return true;
    const got = normStart(procStartOf(pid));
    // Only two ps-style dates are compared; a different shape (another platform or Claude Code version) fails open.
    if (got === null || !PS_DATE.test(got) || !PS_DATE.test(want)) return true;
    return got === want;
  };
  alive.retain = (pids) => procStartOf.retain?.(pids);
  return alive;
}

const defaultAlive = makeAlive({ procStartOf: makeProcStartOf() });

// ---- Sessions for the page ----
const MAX_ROOTS = 16, MAX_SUBS = 12, SUB_STALE_MS = 5 * 60e3, SUB_DONE_MS = 30000;
// A sub-agent whose last entry is a tool_result or a prompt is the model writing its next message; one long message
// can take many minutes with nothing written, so it is kept longer than a sub that has simply gone quiet (L5b).
const THINK_STALE_MS = 15 * 60e3;

// A sub-agent is judged by its own transcript, not by its parent: a background agent keeps working after the parent
// ends its turn. It ends when it hands back / ends its own turn, when the parent is interrupted after its last
// activity, or when it has been silent with no live tool for SUB_STALE_MS (THINK_STALE_MS while the model is writing).
// A tool past PENDING_STALE_MS no longer counts, so a sub killed mid-tool ends instead of lingering until activeMs.
// 'done' lasts SUB_DONE_MS, then 'drop'.
// The parent's interruptedAt is deliberately never cleared: a sub with activity after it is not ended by it (the
// comparison below), while a sub killed by it must stay ended after the parent gets its next prompt.
function subOutcome(st, { now, parentInterruptedAt = 0 }) {
  prunePending(st, now);
  const activity = st.lastTs || st.fileMtime || 0;
  const pend = st.pending.size > 0;
  if (!pend && (st.finished || (st.last === 'assistant' && st.stop === 'end_turn'))) return now - activity > SUB_DONE_MS ? 'drop' : 'done';
  // Counted from the interrupt, which is after the sub's last activity.
  if (parentInterruptedAt > (st.lastTs || 0)) return now - Math.max(activity, parentInterruptedAt) > SUB_DONE_MS ? 'drop' : 'done';
  const quietMs = (st.last === 'tool_result' || st.last === 'prompt') ? THINK_STALE_MS : SUB_STALE_MS;
  if (!pend && now - activity > quietMs) return 'drop';
  return 'keep';
}

const isSubSt = st => !!parentFromPath(st.file) || !!st.sidechain;
const newerSt = (a, b) => (a.lastTs || 0) !== (b.lastTs || 0) ? (a.lastTs || 0) > (b.lastTs || 0) : (a.fileMtime || 0) > (b.fileMtime || 0);

// live: Map from liveFromRegistry, or null to fall back to time filtering (activeMs).
function buildSessions(states, live, { now, permMs, activeMs }) {
  const out = [];
  // Two root transcripts with one sessionId (a resumed session): keep the newest, before anything else looks at them.
  const rootOf = new Map(), all = [...states];
  for (const st of all) {
    if (isSubSt(st)) continue;
    const id = st.sessionId || path.basename(st.file, '.jsonl');
    const cur = rootOf.get(id);
    if (!cur || newerSt(st, cur)) rootOf.set(id, st);
  }
  const keptRoots = new Set(rootOf.values());
  for (const st of all) {
    const isSub = isSubSt(st);
    if (!isSub && !keptRoots.has(st)) continue;
    const aliveTs = Math.max(st.fileMtime || 0, st.lastTs || 0);
    if (!aliveTs || now - aliveTs > activeMs) continue;
    const fromPath = parentFromPath(st.file);
    const id = isSub ? path.basename(st.file, '.jsonl') : (st.sessionId || path.basename(st.file, '.jsonl'));
    const parentId = isSub ? (fromPath || st.sessionId || null) : null;
    // The session (or a sub-agent's parent session) is closed → skip.
    if (live && !live.has(isSub ? parentId : id)) continue;
    const reg = !isSub && live ? live.get(id) : null;
    const parentSt = isSub ? rootOf.get(parentId) : null;
    let { status, tool, detail, talkingTo } = sessionStatus(st, { now, permMs, mode: modeOf(st, parentSt), regStatus: reg ? reg.status : undefined });
    if (isSub) {
      const o = subOutcome(st, { now, parentInterruptedAt: parentSt ? parentSt.interruptedAt : 0 });
      if (o === 'drop') continue;
      if (o === 'done') { status = 'done'; tool = ''; detail = ''; talkingTo = ''; }
    }
    const displayName = (reg && reg.name) || st.name || st.title || (isSub ? 'sub-agent' : path.basename(st.cwd || id));
    const project = projectOf((reg && reg.cwd) || st.firstCwd || st.cwd);
    const _sendTo = st.lastSendTo && now - st.lastSendTo.ts < 600000 ? st.lastSendTo.name : null;
    out.push({ id, parentId, name: displayName, project, cwd: st.cwd, model: st.model, tokens: st.tokens, status, tool, detail, talkingTo, _sendTo, recent: st.recent, updatedAt: aliveTs });
  }
  // A live session with no recent transcript (long idle) still has its desk. It keeps its real registry time, so idle
  // processes do not crowd working sessions out of the MAX_ROOTS desks (L6).
  if (live) for (const [sid, r] of live) {
    if (out.some(s => s.id === sid)) continue;
    out.push({ id: sid, parentId: null, name: r.name || path.basename(r.cwd || '') || 'session', project: projectOf(r.cwd), cwd: r.cwd, model: '', tokens: 0, status: r.status === 'busy' ? 'working' : 'idle', tool: '', detail: '', talkingTo: '', recent: [], updatedAt: r.updatedAt || 0 });
  }
  // A sub-agent whose parent is not here → drop (no orphan making a "sub-agent" room).
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
  // Root sessions first (one desk each); sub-agents stand by their parent's desk, so they have their own cap.
  const byRecent = (a, b) => b.updatedAt - a.updatedAt;
  const roots = out.filter(s => !s.parentId).sort(byRecent).slice(0, MAX_ROOTS);
  const keep = new Set(roots.map(s => s.id));
  const subs = out.filter(s => s.parentId && keep.has(s.parentId)).sort(byRecent).slice(0, MAX_SUBS);
  for (const s of subs) s.project = roots.find(r => r.id === s.parentId).project;
  return roots.concat(subs);
}

module.exports = { QUOTA_KINDS, quotaHits, mergeQuota, TRANSCRIPT_RE, PERM_TOOLS, FINISH_TOOLS, ERROR_MS, NO_PROMPT_MODES, EDIT_TOOLS, MAX_ROOTS, MAX_SUBS, SUB_STALE_MS, THINK_STALE_MS, PENDING_STALE_MS, newState, ingest, brief, projectOf, parentFromPath, promptable, modeOf, sessionStatus, readRegistryDir, liveFromRegistry, normStart, makeProcStartOf, makeAlive, pendingLive, defaultAlive, subOutcome, buildSessions };
