process.env.TZ = 'UTC'; // recent[].t is a local clock time; pin it so the expected file matches everywhere
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const S = require('../lib/status.js');
const { newState, ingest, sessionStatus, promptable, modeOf, ERROR_MS } = S;

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'transcripts');
const T0 = Date.parse('2026-11-06T00:00:00Z');
const PERM_MS = 8000;
const sec = s => T0 + s * 1000;
const min = m => sec(m * 60);

function load(name, mtimeMs = T0) {
  const file = path.join(DIR, name);
  const st = newState(file, mtimeMs);
  for (const l of fs.readFileSync(file, 'utf8').split('\n')) if (l.trim()) ingest(st, JSON.parse(l), false, T0);
  return st;
}
const statusAt = (st, now, extra = {}) => sessionStatus(st, { now, permMs: PERM_MS, mode: modeOf(st), ...extra });

test('ingest keeps the old result for a session without errors or modes', () => {
  // mixed.expected.json was recorded from the old server.js snapshot() at now = T0+15s, file mtime = T0+11s.
  const exp = JSON.parse(fs.readFileSync(path.join(DIR, 'mixed.expected.json'), 'utf8')).sessions[0];
  const st = load('mixed/00000000-0000-4000-8000-000000000001.jsonl', sec(11));
  assert.equal(st.tokens, exp.tokens);
  assert.equal(st.model, exp.model);
  assert.deepEqual(st.recent, exp.recent);
  assert.deepEqual([...st.pending.values()].map(p => [p.name, p.detail, p.to]), [['SendMessage', 'reviewer', 'reviewer']]);
  assert.equal(st.permMode, null);
  const r = statusAt(st, sec(15));
  assert.deepEqual({ status: r.status, tool: r.tool, detail: r.detail, talkingTo: r.talkingTo },
    { status: exp.status, tool: exp.tool, detail: exp.detail, talkingTo: exp.talkingTo });
});

test('a tool error never sets error: an auto-mode denial keeps the agent thinking', () => {
  const st = load('auto-denied.jsonl');
  // The denied tool_result lands at T0+1s.
  for (const s of [2, 11, 30]) {
    const r = statusAt(st, sec(s));
    assert.equal(r.status, 'thinking', 'at T+' + (s - 1) + 's');
    assert.notEqual(r.status, 'error');
  }
  assert.ok(st.recent[0].text.startsWith('Lỗi · '), st.recent[0].text);
  assert.equal(st.apiErrorAt, 0);
  assert.equal(st.lastError, undefined);
});

test('an API error shows error for 30 s', () => {
  const st = load('api-error.jsonl');
  // The API error entry lands at T0+1s.
  assert.equal(ERROR_MS, 30000);
  assert.equal(st.last, 'api_error');
  assert.equal(st.tokens, 0);
  assert.equal(st.pending.size, 0);
  assert.equal(st.model, undefined, 'the <synthetic> model of an API error is not the session model');
  const r = statusAt(st, sec(1 + 29));
  assert.equal(r.status, 'error');
  assert.equal(r.detail, 'API Error: 529 Overloaded. The service is temporarily unavai');
  assert.equal(r.detail.length, 60);
  assert.notEqual(statusAt(st, sec(1 + 31)).status, 'error');
});

test('a session that stopped right after an API error stays error while the registry says idle', () => {
  const st = load('api-error.jsonl');
  assert.equal(statusAt(st, min(5), { regStatus: 'idle' }).status, 'error');
  ingest(st, { type: 'user', timestamp: new Date(min(5)).toISOString(), message: { role: 'user', content: 'try again' } }, true, min(5));
  assert.equal(statusAt(st, min(5) + 1000, { regStatus: 'busy' }).status, 'thinking');
});

test('auto mode never infers permission: a long Bash stays working', () => {
  const st = load('auto-long-bash.jsonl');
  assert.equal(modeOf(st), 'auto');
  const r = statusAt(st, sec(1) + 9 * 60e3);
  assert.equal(r.status, 'working');
  assert.equal(r.tool, 'Bash');
});

test('bypassPermissions behaves like auto', () => {
  const st = load('bypass-long-bash.jsonl');
  assert.equal(modeOf(st), 'bypassPermissions');
  const r = statusAt(st, sec(1) + 9 * 60e3);
  assert.equal(r.status, 'working');
  assert.equal(r.tool, 'Bash');
});

test('default mode still infers permission after PERM_MS', () => {
  const st = load('default-bash.jsonl');
  assert.equal(modeOf(st), 'default');
  // The Bash tool_use lands at T0+1s.
  assert.equal(statusAt(st, sec(1 + 7)).status, 'working');
  const r = statusAt(st, sec(1 + 9));
  assert.equal(r.status, 'permission');
  assert.equal(r.tool, 'Bash');
});

test('acceptEdits: an Edit never waits for permission, a Bash still can', () => {
  const st = load('accept-edits.jsonl');
  assert.equal(modeOf(st), 'acceptEdits');
  assert.equal(statusAt(st, sec(1) + 9 * 60e3).status, 'working');
  ingest(st, { type: 'user', timestamp: new Date(sec(2)).toISOString(), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_edit', content: 'ok' }] } }, false, T0);
  ingest(st, { type: 'assistant', timestamp: new Date(sec(3)).toISOString(), message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_b', name: 'Bash', input: { command: 'npm run build' } }] } }, false, T0);
  assert.equal(statusAt(st, sec(3 + 7)).status, 'working');
  assert.equal(statusAt(st, sec(3 + 9)).status, 'permission');
});

test('the mode follows the newest permissionMode, from user entries and permission-mode entries', () => {
  const file = path.join(DIR, 'mode-switch.jsonl');
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  const st = newState(file, T0);
  ingest(st, lines[0], false, T0);
  assert.equal(st.permMode, 'default');
  for (const e of lines.slice(1)) ingest(st, e, false, T0);
  assert.equal(st.permMode, 'auto');
  assert.equal(statusAt(st, sec(3) + 9 * 60e3).status, 'working');
});

test('a sub-agent without its own mode uses the parent\'s', () => {
  const parent = load('auto-long-bash.jsonl');
  const sub = load('sub-agent.jsonl');
  assert.equal(sub.permMode, null);
  assert.equal(modeOf(sub, parent), 'auto');
  assert.equal(modeOf(sub, null), null);
  assert.equal(modeOf(parent, { permMode: 'default' }), 'auto', 'its own mode wins');
  assert.equal(sessionStatus(sub, { now: sec(3) + 9 * 60e3, permMs: PERM_MS, mode: modeOf(sub, parent) }).status, 'working');
});

test('promptable covers every mode and tool', () => {
  const tools = ['Bash', 'Edit', 'WebFetch', 'Read'];
  const table = {
    default: [true, true, true, false],
    plan: [true, true, true, false],
    acceptEdits: [true, false, true, false],
    auto: [false, false, false, false],
    bypassPermissions: [false, false, false, false],
  };
  for (const [mode, row] of Object.entries(table)) tools.forEach((tool, i) => assert.equal(promptable(mode, tool), row[i], mode + ' × ' + tool));
  assert.equal(promptable(null, 'Bash'), true, 'unknown mode behaves like default');
  for (const t of ['Write', 'MultiEdit', 'NotebookEdit']) assert.equal(promptable('acceptEdits', t), false, t);
});

test('newState starts empty and the moved constants are exported', () => {
  const st = newState('/x/a.jsonl', 5);
  assert.deepEqual({ ...st, pending: [...st.pending] }, { offset: 0, rest: '', tokens: 0, pending: [], recent: [], file: '/x/a.jsonl', fileMtime: 5, lastTs: 0, last: null, stop: null, permMode: null, apiErrorAt: 0, apiErrText: '', interruptedAt: 0 });
  assert.ok(S.TRANSCRIPT_RE.test('agent-abc.jsonl'));
  assert.ok(S.PERM_TOOLS.has('Bash') && S.FINISH_TOOLS.has('SubagentHandback'));
  assert.ok(S.NO_PROMPT_MODES.has('auto') && S.EDIT_TOOLS.has('NotebookEdit'));
  assert.equal(typeof S.brief, 'function'); assert.equal(typeof S.projectOf, 'function'); assert.equal(typeof S.parentFromPath, 'function');
});

test('an interrupt records interruptedAt', () => {
  const st = load('default-bash.jsonl');
  ingest(st, { type: 'user', timestamp: new Date(sec(4)).toISOString(), message: { role: 'user', content: '[Request interrupted by user]' } }, false, T0);
  assert.equal(st.interruptedAt, sec(4));
  assert.equal(st.pending.size, 0);
});
