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

// regStatus: the registry's `busy`/`idle` for a root session (undefined when there is none, e.g. a sub-agent).
function sessionStatus(st, { now, permMs, mode, regStatus }) {
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

module.exports = { TRANSCRIPT_RE, PERM_TOOLS, FINISH_TOOLS, ERROR_MS, NO_PROMPT_MODES, EDIT_TOOLS, newState, ingest, brief, projectOf, parentFromPath, promptable, modeOf, sessionStatus };
