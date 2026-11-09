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
  assert.deepEqual(liveFromRegistry({ ok: false, code: 'EMFILE' }, { prev, alive: yes }), prev);
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
  // After a tool_result the model is writing: THINK_STALE_MS, not SUB_STALE_MS.
  assert.equal(subOutcome(sub, { now: sec(81) + SUB_STALE_MS + 1000 }), 'keep');
  assert.equal(subOutcome(sub, { now: sec(81) + THINK_STALE_MS + 1000 }), 'drop');
  // Silent after its own assistant entry (not end_turn, no tool): SUB_STALE_MS.
  ingest(sub, ev('assistant', 85, { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'text', text: 'hmm' }] }), true, sec(85));
  assert.equal(subOutcome(sub, { now: sec(85) + SUB_STALE_MS - 1000 }), 'keep');
  assert.equal(subOutcome(sub, { now: sec(85) + SUB_STALE_MS + 1000 }), 'drop');
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
  assert.equal(regOnly.updatedAt, sec(60), 'the registry\'s own updatedAt, not now');
  assert.equal(regOnly.status, 'idle');
});

test('a registry file that cannot be read (not ENOENT) keeps its previous entry instead of dropping the session', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reg-'));
  fs.writeFileSync(path.join(dir, '5151.json'), JSON.stringify({ pid: 5151, sessionId: 's-a', status: 'busy' }));
  const first = liveFromRegistry(readRegistryDir(dir), { alive: () => true });
  assert.ok(first.has('s-a'));
  fs.chmodSync(path.join(dir, '5151.json'), 0o000);
  try {
    const read = readRegistryDir(dir);
    if (process.getuid && process.getuid() === 0) return; // root can read anything
    assert.deepEqual(read.entries, [{ file: '5151.json', json: null }]);
    assert.ok(liveFromRegistry(read, { prev: first, alive: () => true }).has('s-a'));
  } finally { fs.chmodSync(path.join(dir, '5151.json'), 0o600); }
});

test('on a directory read error the previous list is kept only for processes still alive', () => {
  const prev = new Map([['s-live', { pid: 1, file: '1.json' }], ['s-dead', { pid: 2, file: '2.json' }]]);
  const m = liveFromRegistry({ ok: false, code: 'EACCES' }, { prev, alive: (pid) => pid === 1 });
  assert.deepEqual([...m.keys()], ['s-live']);
});

test('two registry files for one session keep the most recently updated one', () => {
  const read = { ok: true, entries: [
    { file: '7.json', json: { pid: 7, sessionId: 'dup', status: 'idle', updatedAt: 200 } },
    { file: '6.json', json: { pid: 6, sessionId: 'dup', status: 'busy', updatedAt: 100 } },
  ] };
  assert.equal(liveFromRegistry(read, { alive: () => true }).get('dup').pid, 7);
  read.entries.reverse();
  assert.equal(liveFromRegistry(read, { alive: () => true }).get('dup').pid, 7);
});

// ---- Task 9: procStart liveness (L4), hung tools (L5a), long messages (L5b), registry-only roots (L6) ----
const { normStart, makeProcStartOf, makeAlive, pendingLive, PENDING_STALE_MS, THINK_STALE_MS } = S;
const okKill = () => true;
const epermKill = () => { const e = new Error('EPERM'); e.code = 'EPERM'; throw e; };
const deadKill = () => { const e = new Error('ESRCH'); e.code = 'ESRCH'; throw e; };

test('normStart collapses whitespace and maps empty to null', () => {
  assert.equal(normStart('  Fri Nov  6 02:55:21 2026\n'), 'Fri Nov 6 02:55:21 2026');
  assert.equal(normStart('   '), null);
  assert.equal(normStart(undefined), null);
  assert.equal(normStart(null), null);
});

test('a reused pid with another start time is not a live session', () => {
  const alive = makeAlive({ kill: okKill, procStartOf: () => 'Fri Nov 6 09:00:00 2026' });
  assert.equal(alive(4242, 'Fri Nov  6 02:55:21 2026'), false);
  const live = liveFromRegistry({ ok: true, entries: [{ file: '4242.json', json: { pid: 4242, sessionId: 's', procStart: 'Fri Nov  6 02:55:21 2026' } }] }, { alive });
  assert.equal(live.size, 0);
});

test('EPERM with a matching start time is alive', () => {
  const alive = makeAlive({ kill: epermKill, procStartOf: () => 'Fri Nov  6 02:55:21 2026' });
  assert.equal(alive(4242, 'Fri Nov 6   02:55:21 2026'), true);
  assert.equal(makeAlive({ kill: deadKill, procStartOf: () => 'x' })(4242, 'x'), false);
});

test('no ps (win32 or error): kill(0) alone decides', () => {
  let calls = 0;
  const win = makeProcStartOf({ platform: 'win32', execFileSync: () => { calls++; return 'Fri Nov 6 09:00:00 2026'; } });
  assert.equal(win(4242), null);
  assert.equal(calls, 0);
  const broken = makeProcStartOf({ platform: 'darwin', execFileSync: () => { throw new Error('ENOENT ps'); } });
  assert.equal(broken(4242), null);
  for (const procStartOf of [win, broken]) {
    assert.equal(makeAlive({ kill: okKill, procStartOf })(4242, 'Fri Nov  6 02:55:21 2026'), true);
    assert.equal(makeAlive({ kill: deadKill, procStartOf })(4242, 'Fri Nov  6 02:55:21 2026'), false);
  }
  // No procStart in the registry: kill(0) decides and ps is not even asked.
  let asked = 0;
  assert.equal(makeAlive({ kill: okKill, procStartOf: () => { asked++; return 'other'; } })(4242, undefined), true);
  assert.equal(asked, 0);
});

test('procStartOf runs ps once per pid', () => {
  const seen = [];
  const procStartOf = makeProcStartOf({ platform: 'darwin', execFileSync: (cmd, args, opts) => { seen.push([cmd, args, opts.env.LC_ALL, opts.timeout, opts.encoding, opts.shell]); return 'Fri Nov  6 02:55:21 2026\n'; } });
  assert.equal(procStartOf(4242), 'Fri Nov 6 02:55:21 2026');
  assert.equal(procStartOf(4242), 'Fri Nov 6 02:55:21 2026');
  assert.equal(procStartOf(4343), 'Fri Nov 6 02:55:21 2026');
  assert.deepEqual(seen, [['ps', ['-o', 'lstart=', '-p', '4242'], 'C', 1000, 'utf8', undefined], ['ps', ['-o', 'lstart=', '-p', '4343'], 'C', 1000, 'utf8', undefined]]);
  // A pid that left the registry is forgotten, so a new process on that pid is looked up again.
  const alive = makeAlive({ kill: okKill, procStartOf });
  liveFromRegistry({ ok: true, entries: [{ file: '4343.json', json: { pid: 4343, sessionId: 's', procStart: 'Fri Nov 6 02:55:21 2026' } }] }, { alive });
  procStartOf(4343); assert.equal(seen.length, 2, 'still in the registry: cached');
  procStartOf(4242); assert.equal(seen.length, 3, 'left the registry: asked again');
  // A dead pid is forgotten too.
  makeAlive({ kill: deadKill, procStartOf })(4343, 'x');
  procStartOf(4343); assert.equal(seen.length, 4);
});

const HB = '00000000-0000-4000-8000-0000000000e1', LM = '00000000-0000-4000-8000-0000000000f1';

test('pendingLive: Bash 11 min, other tools 15 min, Agent/Task never; file growth resets the clock', () => {
  assert.deepEqual(PENDING_STALE_MS, { Bash: 11 * 60e3, other: 15 * 60e3 });
  const at = (name) => ({ name, t: T0 });
  assert.equal(pendingLive(at('Bash'), { now: min(11), fileMtime: 0 }), true);
  assert.equal(pendingLive(at('Bash'), { now: min(11) + 1, fileMtime: 0 }), false);
  assert.equal(pendingLive(at('Bash'), { now: min(12), fileMtime: min(5) }), true);
  assert.equal(pendingLive(at('Read'), { now: min(15), fileMtime: 0 }), true);
  assert.equal(pendingLive(at('Read'), { now: min(15) + 1, fileMtime: 0 }), false);
  for (const n of ['Agent', 'Task']) assert.equal(pendingLive(at(n), { now: min(600), fileMtime: 0 }), true);
});

test('a Bash pending for 12 min without file growth no longer counts', () => {
  const root = load(`hung-bash/${HB}.jsonl`), sub = load(`hung-bash/${HB}/subagents/agent-hb1.jsonl`);
  assert.equal(modeOf(root), 'default');
  // The Bash tool_use lands at T0+1s in both files.
  const r = statusAt(root, sec(1) + 12 * 60e3);
  assert.notEqual(r.status, 'permission');
  assert.notEqual(r.status, 'working');
  assert.notEqual(r.tool, 'Bash');
  assert.equal(root.pending.size, 0, 'the expired tool is removed');
  const busy = statusAt(load(`hung-bash/${HB}.jsonl`), sec(1) + 12 * 60e3, { regStatus: 'busy' });
  assert.notEqual(busy.tool, 'Bash');
  assert.equal(subOutcome(sub, { now: sec(1) + 9 * 60e3 }), 'keep');
  assert.equal(subOutcome(sub, { now: sec(1) + 11 * 60e3 + 1000 }), 'drop', 'silent for longer than SUB_STALE_MS once the Bash expired');
  assert.equal(sub.pending.size, 0);
  const live = new Map([[HB, { pid: 1, status: 'busy', cwd: '/tmp/demo-project', name: '', updatedAt: sec(1) }]]);
  const out = build([load(`hung-bash/${HB}.jsonl`), load(`hung-bash/${HB}/subagents/agent-hb1.jsonl`)], live, sec(1) + 12 * 60e3);
  assert.equal(byId(out, 'agent-hb1'), undefined);
  assert.notEqual(byId(out, HB).tool, 'Bash');
});

test('a Bash pending for 9 min is still working', () => {
  const st = load(`hung-bash/${HB}.jsonl`);
  const r = statusAt(st, sec(1) + 9 * 60e3, { mode: 'auto' });
  assert.equal(r.status, 'working');
  assert.equal(r.tool, 'Bash');
  assert.equal(statusAt(st, sec(1) + 9 * 60e3).status, 'permission', 'default mode still guesses permission');
  assert.equal(st.pending.size, 1);
});

test('an Agent call never expires while its child works', () => {
  const root = load(`long-message-sub/${LM}.jsonl`);
  const r = statusAt(root, sec(1) + 120 * 60e3);
  assert.equal(r.status, 'waiting');
  assert.equal(r.tool, 'Agent');
  assert.equal(root.pending.size, 1);
});

test('a sub-agent writing one long message for 8 min stays', () => {
  assert.equal(THINK_STALE_MS, 15 * 60e3);
  const live = new Map([[LM, { pid: 1, status: 'busy', cwd: '/tmp/demo-project', name: '', updatedAt: sec(1) }]]);
  const files = () => [load(`long-message-sub/${LM}.jsonl`), load(`long-message-sub/${LM}/subagents/agent-lm1.jsonl`)];
  // The sub's last entry is a tool_result at T0+3s.
  const sub = files()[1];
  assert.equal(sub.last, 'tool_result');
  assert.equal(subOutcome(sub, { now: sec(3) + 8 * 60e3 }), 'keep');
  assert.equal(subOutcome(sub, { now: sec(3) + 14 * 60e3 }), 'keep');
  assert.equal(subOutcome(sub, { now: sec(3) + 16 * 60e3 }), 'drop');
  const at8 = build(files(), live, sec(3) + 8 * 60e3);
  assert.equal(byId(at8, 'agent-lm1').status, 'thinking');
  assert.equal(byId(at8, LM).status, 'waiting');
  assert.equal(byId(build(files(), live, sec(3) + 16 * 60e3), 'agent-lm1'), undefined);
});

test('registry-only roots keep their real updatedAt and do not push active sessions out of the 16', () => {
  const MR = path.join(DIR, 'many-roots');
  const live = liveFromRegistry(readRegistryDir(path.join(MR, 'registry')), { alive: yes });
  assert.equal(live.size, 23);
  const states = fs.readdirSync(MR).filter(f => f.endsWith('.jsonl')).map(f => load(`many-roots/${f}`, sec(40)));
  assert.equal(states.length, 3);
  const out = build(states, live, sec(60));
  assert.equal(out.length, 16);
  for (const st of states) assert.ok(byId(out, st.sessionId), st.sessionId);
  const regOnly = out.find(s => !states.some(st => st.sessionId === s.id));
  assert.equal(regOnly.updatedAt, T0 - 3600e3);
});

test('procStartOf asks ps for UTC, the time zone Claude Code writes procStart in', () => {
  let env;
  const procStartOf = makeProcStartOf({ platform: 'darwin', execFileSync: (cmd, args, opts) => { env = opts.env; return 'Fri Nov  6 02:55:21 2026'; } });
  procStartOf(5555);
  assert.equal(env.TZ, 'UTC');
  assert.equal(env.LC_ALL, 'C');
});

test('procStartOf looks up at most a few new pids per scan, failing open for the rest until the next scan', () => {
  let calls = 0;
  const procStartOf = makeProcStartOf({ platform: 'darwin', execFileSync: () => { calls++; return 'Fri Nov  6 02:55:21 2026'; } });
  procStartOf.retain(new Set());
  const got = [1, 2, 3, 4, 5, 6, 7].map((p) => procStartOf(p));
  assert.equal(calls, 4);
  assert.deepEqual(got.slice(4), [null, null, null]);
  procStartOf.retain(new Set([1, 2, 3, 4, 5, 6, 7]));
  assert.equal(procStartOf(5), 'Fri Nov 6 02:55:21 2026');
});

test('start times in different shapes never drop a live process', () => {
  const alive = makeAlive({ kill: () => true, procStartOf: () => 'Fri Nov 6 09:55:21 2026' });
  assert.equal(alive(1, '2026-11-06T02:55:21Z'), true);
  assert.equal(alive(1, 'Fri Nov 6 02:55:21 2026'), false);
});

test('registry `shell`: the turn ended but background shells still run, so the session works on a Bash', () => {
  const st = newState('/x/s9.jsonl', T0);
  ingest(st, { type: 'assistant', timestamp: new Date(sec(1)).toISOString(), message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'waiting for the pipeline' }] } }, false, T0);
  assert.equal(statusAt(st, sec(2), { regStatus: 'idle' }).status, 'done');
  assert.deepEqual(statusAt(st, sec(2), { regStatus: 'shell' }), { status: 'working', tool: 'Bash', detail: 'shell nền', talkingTo: '' });
  assert.equal(statusAt(st, min(30), { regStatus: 'shell' }).status, 'working', 'long after the turn, while the shells run');
  assert.equal(statusAt(load('api-error.jsonl'), min(5), { regStatus: 'shell' }).status, 'error', 'an API error still shows');
  // A live session with no recent transcript.
  const live = new Map([['s8', { pid: 8, status: 'shell', cwd: '/w/repo', name: 'n', updatedAt: sec(1) }]]);
  const s = byId(build([], live, sec(2)), 's8');
  assert.deepEqual([s.status, s.tool, s.detail], ['working', 'Bash', 'shell nền']);
});
