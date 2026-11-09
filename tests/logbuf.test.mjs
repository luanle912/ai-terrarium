import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createLogBuffer } = require('../lib/logbuf.js');

test('keeps the last 200 lines', () => {
  let t = 0;
  const b = createLogBuffer({ now: () => ++t, sink: () => {} });
  for (let i = 0; i < 250; i++) b.log('line ' + i);
  const l = b.lines();
  assert.equal(l.length, 200);
  assert.deepEqual(l[0], { at: 51, line: 'line 50' });
  assert.equal(l[199].line, 'line 249');
});

test('redacts bearer tokens and token fields', () => {
  const sunk = [];
  const b = createLogBuffer({ sink: (l) => sunk.push(l) });
  b.log('auth failed: Bearer trd_secret123 for x');
  b.log('body {"token" : "trd_abc"} done');
  const all = JSON.stringify(b.lines()) + sunk.join('\n');
  assert.ok(!/trd_secret123|trd_abc/.test(all), all);
  assert.equal(b.lines()[0].line, 'auth failed: Bearer *** for x');
  assert.equal(b.lines()[1].line, 'body {"token":"***"} done');
});

test('passes lines to the sink', () => {
  const sunk = [];
  const b = createLogBuffer({ sink: (l) => sunk.push(l) });
  b.log('hello');
  assert.deepEqual(sunk, ['hello']);
});
