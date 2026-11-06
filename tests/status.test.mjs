process.env.TZ = 'UTC'; // recent[].t is a local clock time; pin it so the expected file matches everywhere
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
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

// ---- Live-session registry, sub-agent outcome, buildSessions ----
const { readRegistryDir, liveFromRegistry, subOutcome, buildSessions, SUB_STALE_MS } = S;
const REG = path.join(DIR, 'registry');
const yes = () => true;
const BG = '00000000-0000-4000-8000-0000000000b1', INT = '00000000-0000-4000-8000-0000000000c1', DUP = '00000000-0000-4000-8000-0000000000d1';
const build = (states, live, now) => buildSessions(states, live, { now, permMs: PERM_MS, activeMs: 120 * 60e3 });
const fixtureLive = () => liveFromRegistry(readRegistryDir(REG), { alive: yes });
const byId = (out, id) => out.find(s => s.id === id);
const ev = (type, s, message, extra = {}) => ({ type, timestamp: new Date(sec(s)).toISOString(), message, ...extra });

test('an empty registry means no session, not every transcript of the last 2 hours', () => {
  const live = liveFromRegistry({ ok: true, entries: [] }, { alive: yes });
  assert.ok(live instanceof Map);
  assert.equal(live.size, 0);
  const states = ['auto-long-bash.jsonl', 'default-bash.jsonl', 'mixed/00000000-0000-4000-8000-000000000001.jsonl'].map(f => load(f));
  assert.deepEqual(build(states, live, sec(10)), []);
});

test('no registry directory falls back to time filtering', () => {
  assert.equal(liveFromRegistry({ ok: false, code: 'ENOENT' }, { prev: new Map([['x', {}]]), alive: yes }), null);
  const states = [load('auto-long-bash.jsonl'), load(`bg-sub/${BG}.jsonl`), load(`interrupted-sub/${INT}.jsonl`)];
  assert.equal(build(states, null, sec(70)).length, 3);
});

test('a failed read keeps the last good list', () => {
  const prev = new Map([['a', { pid: 1, file: '1.json' }], ['b', { pid: 2, file: '2.json' }]]);
  assert.equal(liveFromRegistry({ ok: false, code: 'EMFILE' }, { prev, alive: yes }), prev);
  assert.equal(liveFromRegistry({ ok: false, code: 'EMFILE' }, { alive: yes }), null);
});

test('a registry file caught mid-write keeps its previous entry', () => {
  const first = liveFromRegistry({ ok: true, entries: [{ file: '7.json', json: { pid: 7, sessionId: 's7', status: 'busy', cwd: '/w', name: 'n', statusUpdatedAt: 5 } }] }, { alive: yes });
  assert.deepEqual(first.get('s7'), { pid: 7, name: 'n', status: 'busy', cwd: '/w', updatedAt: 5, procStart: undefined, file: '7.json' });
  const next = liveFromRegistry({ ok: true, entries: [{ file: '7.json', json: null }, { file: '8.json', json: null }] }, { prev: first, alive: yes });
  assert.deepEqual([...next.keys()], ['s7']);
  assert.deepEqual(next.get('s7'), first.get('s7'));
});

test('a dead pid is not live', () => {
  const seen = [];
  const live = liveFromRegistry({ ok: true, entries: [{ file: '42.json', json: { sessionId: 's', procStart: 'p' } }] }, { alive: (pid, ps) => { seen.push([pid, ps]); return false; } });
  assert.equal(live.size, 0);
  assert.deepEqual(seen, [[42, 'p']], 'the pid falls back to the file name');
  const noId = liveFromRegistry({ ok: true, entries: [{ file: '43.json', json: { pid: 43 } }] }, { alive: yes });
  assert.equal(noId.size, 0, 'an entry without a sessionId is dropped');
  assert.equal(S.defaultAlive(process.pid), true);
});

test('readRegistryDir reads a temp directory', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'terrarium-reg-'));
  try {
    fs.writeFileSync(path.join(d, '100.json'), JSON.stringify({ pid: 100, sessionId: 'good' }));
    fs.writeFileSync(path.join(d, '101.json'), '{"pid": 1');
    fs.writeFileSync(path.join(d, 'notes.txt'), 'x');
    const r = readRegistryDir(d);
    assert.equal(r.ok, true);
    const sorted = r.entries.sort((a, b) => a.file.localeCompare(b.file));
    assert.deepEqual(sorted, [{ file: '100.json', json: { pid: 100, sessionId: 'good' } }, { file: '101.json', json: null }]);
    assert.deepEqual(readRegistryDir(path.join(d, 'missing')), { ok: false, code: 'ENOENT' });
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
  const fx = fixtureLive();
  assert.deepEqual([...fx.keys()].sort(), [BG, INT, DUP]);
  assert.equal(fx.get(BG).status, 'idle');
});

test('a background sub-agent keeps working after its parent ends its turn', () => {
  const live = fixtureLive();
  const parent = load(`bg-sub/${BG}.jsonl`), sub = load(`bg-sub/${BG}/subagents/agent-bg1.jsonl`);
  // The parent's end_turn lands at T0+60s, the sub's Read at T0+80s.
  let out = build([parent, sub], live, sec(85));
  assert.equal(byId(out, BG).status, 'done');
  assert.equal(byId(out, 'agent-bg1').status, 'working');
  assert.equal(byId(out, 'agent-bg1').tool, 'Read');
  assert.equal(byId(out, 'agent-bg1').parentId, BG);
  ingest(sub, ev('user', 100, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_read', content: 'ok' }] }, { isSidechain: true }), true, sec(100));
  out = build([parent, sub], live, sec(105));
  assert.equal(byId(out, 'agent-bg1').status, 'thinking');
  assert.equal(byId(out, BG).status, 'done');
});

test('a sub-agent that hands back is done for 30 s, then gone', () => {
  const live = fixtureLive();
  const parent = load(`bg-sub/${BG}.jsonl`), sub = load(`bg-sub/${BG}/subagents/agent-bg1.jsonl`);
  ingest(sub, ev('user', 81, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_read', content: 'ok' }] }), true, sec(81));
  ingest(sub, ev('assistant', 82, { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_h', name: 'SubagentHandback', input: { message: 'done' } }] }), true, sec(82));
  ingest(sub, ev('user', 83, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_h', content: 'ok' }] }), true, sec(83));
  assert.equal(subOutcome(sub, { now: sec(83 + 29) }), 'done');
  assert.equal(subOutcome(sub, { now: sec(83 + 31) }), 'drop');
  assert.equal(byId(build([parent, sub], live, sec(83 + 29)), 'agent-bg1').status, 'done');
  assert.equal(byId(build([parent, sub], live, sec(83 + 31)), 'agent-bg1'), undefined);
});

test('subOutcome: a quiet sub-agent with no pending tool is dropped after SUB_STALE_MS, a busy one is kept', () => {
  const sub = load(`bg-sub/${BG}/subagents/agent-bg1.jsonl`);
  assert.equal(subOutcome(sub, { now: sec(80) + SUB_STALE_MS + 1000 }), 'keep', 'a pending tool keeps it');
  ingest(sub, ev('user', 81, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_read', content: 'ok' }] }), true, sec(81));
  assert.equal(subOutcome(sub, { now: sec(81) + SUB_STALE_MS - 1000 }), 'keep');
  assert.equal(subOutcome(sub, { now: sec(81) + SUB_STALE_MS + 1000 }), 'drop');
  ingest(sub, ev('assistant', 90, { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'all done' }] }), true, sec(90));
  assert.equal(subOutcome(sub, { now: sec(100) }), 'done');
  assert.equal(subOutcome(sub, { now: sec(121) }), 'drop');
});

test('interrupting the parent ends its sub-agents', () => {
  const live = fixtureLive();
  const parent = load(`interrupted-sub/${INT}.jsonl`), sub = load(`interrupted-sub/${INT}/subagents/agent-int1.jsonl`);
  // The sub's Bash starts at T0+55s; the parent is interrupted at T0+60s.
  assert.equal(parent.interruptedAt, sec(60));
  assert.equal(subOutcome(sub, { now: sec(58) }), 'keep');
  assert.equal(subOutcome(sub, { now: sec(65), parentInterruptedAt: parent.interruptedAt }), 'done');
  assert.equal(byId(build([parent, sub], live, sec(65)), 'agent-int1').status, 'done');
  assert.equal(byId(build([parent, sub], live, sec(60 + 31)), 'agent-int1'), undefined);
  // A sub-agent that ran on after the interrupt is not ended by it.
  ingest(sub, ev('user', 62, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_b', content: 'ok' }] }), true, sec(62));
  assert.equal(subOutcome(sub, { now: sec(65), parentInterruptedAt: parent.interruptedAt }), 'keep');
});

test('two transcripts with one sessionId give one root', () => {
  const live = new Map([[DUP, fixtureLive().get(DUP)]]);
  const old = load(`dup-root/${DUP}.jsonl`), neu = load('dup-root/00000000-0000-4000-8000-0000000000d2.jsonl');
  const sub = load(`dup-root/${DUP}/subagents/agent-dup1.jsonl`);
  for (const order of [[old, neu, sub], [sub, neu, old]]) {
    const out = build(order, live, sec(60));
    const roots = out.filter(s => !s.parentId);
    assert.equal(roots.length, 1);
    assert.equal(roots[0].id, DUP);
    assert.equal(roots[0].model, 'claude-new');
    assert.equal(roots[0].tokens, 150);
    assert.equal(roots[0].status, 'waiting');
    assert.equal(roots[0].waitingOn, 'agent-dup1');
    assert.equal(byId(out, 'agent-dup1').parentId, DUP);
  }
  // Equal lastTs: the newer file wins.
  const a = load(`dup-root/${DUP}.jsonl`, sec(1)), b = load(`dup-root/${DUP}.jsonl`, sec(2));
  b.tokens = 999;
  assert.equal(build([b, a], null, sec(20))[0].tokens, 999);
  assert.equal(build([a, b], null, sec(20))[0].tokens, 999);
});

test('snapshot keeps its shape', () => {
  const live = fixtureLive();
  const out = build([load(`bg-sub/${BG}.jsonl`), load(`bg-sub/${BG}/subagents/agent-bg1.jsonl`), load(`dup-root/${DUP}.jsonl`), load('dup-root/00000000-0000-4000-8000-0000000000d2.jsonl'), load(`dup-root/${DUP}/subagents/agent-dup1.jsonl`)], live, sec(85));
  const KEYS = ['id', 'parentId', 'name', 'project', 'cwd', 'model', 'tokens', 'status', 'tool', 'detail', 'talkingTo', 'recent', 'updatedAt'];
  // INT has no transcript here, so it is a registry-only root.
  assert.equal(out.length, 5);
  for (const s of out) assert.deepEqual(Object.keys(s).filter(k => k !== 'waitingOn').sort(), [...KEYS].sort(), s.id);
  const regOnly = byId(out, INT);
  assert.equal(regOnly.updatedAt, sec(85));
  assert.equal(regOnly.status, 'idle');
});
