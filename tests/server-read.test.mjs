import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readAppended } = require('../server.js');

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'terr-read-')), 't.jsonl');
const LINES = ['{"a":1}', '{"t":"Tiếng Việt có dấu ữ ẫ"}', '', '{"e":"日本語と絵文字 🏝️"}', '{"b":' + '9'.repeat(40) + '}'];

test('reading a chunk at a time gives exactly the lines of one big read, multibyte text cut anywhere', () => {
  const f = tmp(), body = LINES.join('\n') + '\n';
  fs.writeFileSync(f, body);
  for (const chunk of [1, 2, 3, 5, 7, 16, 1 << 20]) {
    const st = { offset: 0 }, got = [];
    readAppended(f, st, Buffer.byteLength(body), l => got.push(l), chunk);
    assert.deepEqual(got, LINES.filter(Boolean), `chunk ${chunk}`);
    assert.equal(st.offset, Buffer.byteLength(body));
    assert.equal(st.restBuf.length, 0);
  }
});

test('a line still being written waits in rest and is completed by the next read', () => {
  const f = tmp();
  fs.writeFileSync(f, '{"a":1}\n{"half":');
  const st = { offset: 0 }, got = [];
  readAppended(f, st, fs.statSync(f).size, l => got.push(l), 4);
  assert.deepEqual(got, ['{"a":1}']);
  assert.equal(st.restBuf.toString(), '{"half":');
  fs.appendFileSync(f, '"yes"}\n');
  readAppended(f, st, fs.statSync(f).size, l => got.push(l), 4);
  assert.deepEqual(got, ['{"a":1}', '{"half":"yes"}']);
  assert.equal(st.restBuf.length, 0);
});

test('a character cut in two by the end of what is written so far comes out whole', () => {
  const f = tmp(), line = '{"t":"ữ🏝️"}', bytes = Buffer.from(line + '\n');
  fs.writeFileSync(f, bytes.subarray(0, 7));
  const st = { offset: 0 }, got = [];
  readAppended(f, st, 7, l => got.push(l), 4);
  fs.appendFileSync(f, bytes.subarray(7));
  readAppended(f, st, bytes.length, l => got.push(l), 4);
  assert.deepEqual(got, [line]);
});
