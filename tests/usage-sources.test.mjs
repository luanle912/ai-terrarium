// The usage board's sources (lib/usage.js, docs/specs/2026-11-10-usage-board-design.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const U = require('../lib/usage.js');

const NOW = Date.parse('2026-11-10T05:00:00Z');
const ISO = ms => new Date(ms).toISOString();

test('get_usage: plan windows in, other buckets and empty windows out; no plan when the CLI says so', () => {
  const r = U.parseGetUsage({
    subscription_type: 'max', rate_limits_available: true,
    rate_limits: { five_hour: { utilization: 42.5, resets_at: ISO(NOW + 3600e3) }, seven_day: { utilization: null, resets_at: null },
      seven_day_opus: { utilization: 10, resets_at: ISO(NOW) } },
  });
  assert.deepEqual(r, { plan: true, windows: [{ kind: 'five_hour', pct: 42.5, resets: ISO(NOW + 3600e3) }] });
  assert.deepEqual(U.parseGetUsage({ rate_limits_available: false, rate_limits: null }), { plan: false, windows: [] });
  assert.equal(U.parseGetUsage(null), null);
  assert.equal(U.parseGetUsage({ rate_limits: null }), null, 'an answer that says nothing changes nothing');
});

test('the CLI is the machine\'s own, never the copy inside the desktop app', () => {
  const exec = new Set(['/Users/k/Library/Application Support/Claude/claude-code/2.1.321/x/claude', '/opt/homebrew/bin/claude']);
  const env = { PATH: '/Users/k/Library/Application Support/Claude/claude-code/2.1.321/x:/usr/bin', HOME: '/Users/k' };
  assert.equal(U.findClaude(env, f => exec.has(f)), '/opt/homebrew/bin/claude');
  assert.equal(U.findClaude({ PATH: '/usr/bin', HOME: '/Users/k' }, () => false), null);
  assert.equal(U.findClaude({ TERRARIUM_CLAUDE: '/x/claude' }, f => f === '/x/claude'), '/x/claude');
});

test('the CLI does not get the desktop app\'s sign-in or SDK switches', () => {
  const e = U.cliEnv({ PATH: '/bin', HOME: '/h', CLAUDE_CODE_OAUTH_TOKEN: 'secret', ANTHROPIC_BASE_URL: 'x', CLAUDE_AGENT_SDK_VERSION: '1', CLAUDECODE: '1', LANG: 'vi' });
  assert.deepEqual(e, { PATH: '/bin', HOME: '/h', LANG: 'vi' });
});

test('the board is shown only once a plan is known: status line, get_usage or a hit limit', () => {
  const sl = [{ kind: 'five_hour', pct: 10, resets: 'a' }];
  assert.deepEqual(U.combine({ statusline: sl, statuslineAt: NOW - 60e3 }, NOW), { windows: sl, plan: true, source: 'statusline' });
  const claude = { plan: true, windows: [{ kind: 'seven_day', pct: 50, resets: 'b' }] };
  assert.deepEqual(U.combine({ statusline: sl, statuslineAt: NOW - 3600e3, claude }, NOW), { windows: claude.windows, plan: true, source: 'claude' },
    'a stale status line gives way to get_usage');
  assert.deepEqual(U.combine({ claude: { plan: false, windows: [] } }, NOW), { windows: [], plan: false, source: null }, 'API key: hidden');
  assert.deepEqual(U.combine({}, NOW), { windows: [], plan: null, source: null }, 'nothing known: hidden');
  const hit = U.combine({ hits: { seven_day: NOW + 1000 } }, NOW);
  assert.equal(hit.plan, true);
  assert.equal(hit.source, 'limit');
  assert.deepEqual(hit.windows, [{ kind: 'seven_day', pct: 100, resets: ISO(NOW + 1000) }]);
});

// A fake `claude` speaking the SDK stream protocol.
function fakeClaude(reply) {
  const calls = [];
  const spawn = (bin, args, opts) => {
    const p = new EventEmitter();
    p.stdin = new PassThrough(); p.stdout = new PassThrough(); p.kill = () => p.emit('exit', null);
    calls.push({ bin, args, opts });
    let buf = '';
    p.stdin.on('data', d => {
      buf += d;
      for (const line of buf.split('\n').slice(0, -1)) {
        const m = JSON.parse(line);
        if (m.request.subtype === 'get_usage') p.stdout.write(JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: m.request_id, response: reply } }) + '\n');
      }
      buf = buf.slice(buf.lastIndexOf('\n') + 1);
    });
    return p;
  };
  return { spawn, calls };
}

test('askClaude sends no prompt, keeps no session, runs no hooks, and returns the get_usage answer', async () => {
  const reply = { rate_limits_available: true, rate_limits: { five_hour: { utilization: 7, resets_at: ISO(NOW) } } };
  const f = fakeClaude(reply);
  const got = await new Promise(res => U.askClaude('/bin/claude', res, { spawn: f.spawn, cwd: '/tmp' }));
  assert.deepEqual(got, reply);
  const a = f.calls[0].args;
  for (const flag of ['--no-session-persistence', '--strict-mcp-config', '-p']) assert.ok(a.includes(flag), flag);
  assert.equal(a[a.indexOf('--settings') + 1], '{"disableAllHooks":true}');
  assert.ok(!a.some(x => /^[^-]/.test(x) && !x.startsWith('{') && x !== 'stream-json'), 'no prompt argument');
});

test('askClaude gives up after its time limit and when the CLI cannot start', async () => {
  const silent = () => { const p = new EventEmitter(); p.stdin = new PassThrough(); p.stdout = new PassThrough(); p.kill = () => {}; return p; };
  assert.equal(await new Promise(res => U.askClaude('/x', res, { spawn: silent, timeoutMs: 30, cwd: '/tmp' })), null);
  assert.equal(await new Promise(res => U.askClaude('/x', res, { spawn: () => { throw new Error('ENOENT') }, cwd: '/tmp' })), null);
});

test('createUsage asks the CLI when due, waits an hour after "no plan", and never while a fresh status line exists', () => {
  const asked = [];
  let answer = { rate_limits_available: false };
  const ask = (bin, done) => { asked.push(bin); done(answer); };
  const u1 = U.createUsage({ dir: '/d', find: () => '/c', ask, readFile: () => [], statFile: () => 0 });
  assert.equal(u1(NOW).plan, false, 'the CLI is asked on the first call (this fake answers at once)');
  u1(NOW + 10 * 60e3);
  assert.equal(asked.length, 1, 'no plan: not asked again within the hour');
  const fresh = [{ kind: 'five_hour', pct: 1, resets: ISO(NOW + 1e6) }];
  const u2 = U.createUsage({ dir: '/d', find: () => '/c', ask, readFile: () => fresh, statFile: () => NOW });
  assert.equal(u2(NOW).source, 'statusline');
  assert.equal(asked.length, 1, 'a fresh status line: the CLI is not asked');
  const u3 = U.createUsage({ dir: '/d', find: () => null, ask, readFile: () => [], statFile: () => 0 });
  assert.equal(u3(NOW).plan, null);
  assert.equal(asked.length, 1, 'no CLI: nothing is run');
});
