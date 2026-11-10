// The usage board when Claude Code runs inside the desktop app: there is no status line there, so the statusLine
// bridge never runs. A transcript still records each time a limit is hit (a 429 with rateLimitType and resetsAt);
// those show as LIMIT on the board until the window resets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { newState, ingest, quotaHits, mergeQuota } = require('../lib/status.js');

const NOW = Date.parse('2026-11-10T04:00:00Z');
const hit = (kind, resetsAtSec, ts = '2026-11-10T03:00:00Z') => ({
  type: 'assistant', timestamp: ts, isApiErrorMessage: true, apiError: 'usage_limit_reached',
  message: { content: [{ type: 'text', text: "You've hit your limit" }] },
  apiErrorParams: { rate_limit_info: { status: 'rejected', resetsAt: resetsAtSec, rateLimitType: kind } },
});

test('a 429 for the 5-hour or weekly limit is remembered with its reset time', () => {
  const st = newState('/x.jsonl', NOW);
  ingest(st, hit('seven_day', NOW / 1000 + 3600), false, NOW);
  assert.deepEqual(st.quota, { seven_day: (NOW / 1000 + 3600) * 1000 });
  ingest(st, hit('five_hour', NOW / 1000 + 600), false, NOW);
  ingest(st, hit('seven_day_opus', NOW / 1000 + 600), false, NOW);
  assert.deepEqual(Object.keys(st.quota).sort(), ['five_hour', 'seven_day'], 'other buckets are not on the board');
});

test('other API errors and allowed statuses are not limits', () => {
  const st = newState('/x.jsonl', NOW);
  const e = hit('five_hour', NOW / 1000 + 600);
  e.apiErrorParams.rate_limit_info.status = 'allowed_warning';
  ingest(st, e, false, NOW);
  ingest(st, { type: 'assistant', isApiErrorMessage: true, message: { content: [] }, apiError: 'overloaded' }, false, NOW);
  assert.equal(st.quota, undefined);
});

test('quotaHits keeps the latest reset per window across sessions and drops windows already reset', () => {
  const memo = {};
  quotaHits([{ quota: { five_hour: NOW - 1 } }, { quota: { seven_day: NOW + 5000 } }, { quota: { seven_day: NOW + 9000 } }, {}], memo);
  assert.deepEqual(memo, { five_hour: NOW - 1, seven_day: NOW + 9000 });
  assert.deepEqual(mergeQuota([], memo, NOW), [{ kind: 'seven_day', pct: 100, resets: new Date(NOW + 9000).toISOString() }]);
});

test('a limit hit wins over the status line figure for that window until it resets', () => {
  const fromStatusLine = [{ kind: 'five_hour', pct: 42, resets: 'a' }, { kind: 'seven_day', pct: 80, resets: 'b' }];
  const out = mergeQuota(fromStatusLine, { seven_day: NOW + 1000 }, NOW);
  assert.deepEqual(out, [{ kind: 'five_hour', pct: 42, resets: 'a' }, { kind: 'seven_day', pct: 100, resets: new Date(NOW + 1000).toISOString() }]);
  assert.deepEqual(mergeQuota(fromStatusLine, { seven_day: NOW - 1 }, NOW), fromStatusLine, 'after the reset the status line is back');
});
