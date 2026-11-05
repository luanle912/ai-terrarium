import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sl = require('../lib/statusline.js');
const { readUsage } = require('../server.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'terr-sl-'));
const NOW = 1_800_000_000_000;
const sec = (ms) => Math.floor(ms / 1000);
const full = JSON.stringify({ rate_limits: {
  five_hour: { used_percentage: 23.4, resets_at: sec(NOW + 3600e3) },
  seven_day: { used_percentage: 41, resets_at: sec(NOW + 86400e3) } } });

test('parseRateLimits: both windows, seconds converted to ms', () => {
  const u = sl.parseRateLimits(JSON.parse(full), NOW);
  assert.equal(u.at, NOW);
  assert.deepEqual(u.five_hour, { pct: 23.4, resets_at_ms: sec(NOW + 3600e3) * 1000 });
  assert.deepEqual(u.seven_day, { pct: 41, resets_at_ms: sec(NOW + 86400e3) * 1000 });
});
test('parseRateLimits: partial, absent and garbage', () => {
  const p = sl.parseRateLimits({ rate_limits: { seven_day: { used_percentage: 5, resets_at: sec(NOW + 1e6) } } }, NOW);
  assert.equal(p.five_hour, undefined); assert.equal(p.seven_day.pct, 5);
  assert.equal(sl.parseRateLimits({}, NOW), null);
  assert.equal(sl.parseRateLimits({ rate_limits: {} }, NOW), null);
  assert.equal(sl.parseRateLimits({ rate_limits: { five_hour: { used_percentage: 'x' } } }, NOW), null);
  assert.equal(sl.parseRateLimits(null, NOW), null);
  const c = sl.parseRateLimits({ rate_limits: { five_hour: { used_percentage: 150, resets_at: sec(NOW + 1e6) } } }, NOW);
  assert.equal(c.five_hour.pct, 100);
});
test('run writes usage.json atomically with mode 0600 and prints a line', () => {
  const dir = tmp();
  const r = sl.run({ stdin: full, argv: [], dir, now: NOW });
  assert.match(r.out, /5H 23% · 7D 41%/);
  const f = path.join(dir, 'usage.json');
  assert.equal(fs.statSync(f).mode & 0o777, 0o600);
  assert.equal(JSON.parse(fs.readFileSync(f, 'utf8')).five_hour.pct, 23.4);
  assert.deepEqual(fs.readdirSync(dir), ['usage.json']);
});
test('run: absent rate_limits and garbage stdin never throw, write nothing', () => {
  for (const stdin of ['{}', 'not json', '', '[1]', 'null']) {
    const dir = tmp();
    const r = sl.run({ stdin, argv: [], dir, now: NOW });
    assert.equal(typeof r.out, 'string'); assert.equal(r.code, 0);
    assert.equal(fs.existsSync(path.join(dir, 'usage.json')), false);
  }
});
test('run: partial prints only the known window', () => {
  const dir = tmp();
  const r = sl.run({ stdin: JSON.stringify({ rate_limits: { seven_day: { used_percentage: 9, resets_at: sec(NOW + 1e6) } } }), argv: [], dir, now: NOW });
  assert.match(r.out, /7D 9%/); assert.doesNotMatch(r.out, /5H/);
});
test('run --chain prints the chained command output and still writes', () => {
  const dir = tmp();
  const r = sl.run({ stdin: full, argv: ['--chain', 'cat >/dev/null; echo hello-chain'], dir, now: NOW });
  assert.equal(r.out.trim(), 'hello-chain');
  assert.equal(fs.existsSync(path.join(dir, 'usage.json')), true);
});
test('run --chain failing falls back to own line', () => {
  const r = sl.run({ stdin: full, argv: ['--chain', 'exit 3'], dir: tmp(), now: NOW });
  assert.match(r.out, /5H 23%/); assert.equal(r.code, 0);
});
test('run: unwritable dir does not throw', () => {
  const r = sl.run({ stdin: full, argv: [], dir: '/dev/null/x', now: NOW });
  assert.equal(r.code, 0);
});

test('readUsage maps usage.json to the legacy shape with ISO resets', () => {
  const dir = tmp();
  sl.run({ stdin: full, argv: [], dir, now: NOW });
  const u = readUsage({ dir, legacyDir: tmp(), now: NOW });
  assert.deepEqual(u.map(x => x.kind), ['five_hour', 'seven_day']);
  assert.equal(u[0].pct, 23.4);
  assert.equal(u[0].resets, new Date(sec(NOW + 3600e3) * 1000).toISOString());
});
test('readUsage drops expired windows; empty means unknown', () => {
  const dir = tmp();
  sl.run({ stdin: full, argv: [], dir, now: NOW });
  const u = readUsage({ dir, legacyDir: tmp(), now: NOW + 7200e3 });
  assert.deepEqual(u.map(x => x.kind), ['seven_day']);
  assert.deepEqual(readUsage({ dir, legacyDir: tmp(), now: NOW + 2 * 86400e3 }), []);
  assert.deepEqual(readUsage({ dir: tmp(), legacyDir: tmp(), now: NOW }), []);
});
test('readUsage falls back to legacy usage-quota files', () => {
  const legacy = tmp();
  fs.writeFileSync(path.join(legacy, 'usage-quota-x.json'), JSON.stringify({ limits: { limits: [{ kind: 'five_hour', percentUsed: 12, resetsAt: '2030-01-01T00:00:00Z' }] } }));
  const u = readUsage({ dir: tmp(), legacyDir: legacy, now: NOW });
  assert.deepEqual(u, [{ kind: 'five_hour', pct: 12, resets: '2030-01-01T00:00:00Z' }]);
});
test('readUsage prefers usage.json over legacy; garbage usage.json falls back', () => {
  const dir = tmp(), legacy = tmp();
  fs.writeFileSync(path.join(legacy, 'usage-quota-x.json'), JSON.stringify({ limits: { limits: [{ kind: 'five_hour', percentUsed: 12, resetsAt: '2030-01-01T00:00:00Z' }] } }));
  fs.writeFileSync(path.join(dir, 'usage.json'), '{garbage');
  assert.equal(readUsage({ dir, legacyDir: legacy, now: NOW })[0].pct, 12);
  sl.run({ stdin: full, argv: [], dir, now: NOW });
  assert.equal(readUsage({ dir, legacyDir: legacy, now: NOW })[0].pct, 23.4);
});
