import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validIslandName } = require('../hub/validate.js');

test('island names: Vietnamese names pass, stacked or leading combining marks do not', () => {
  assert.equal(validIslandName('Đảo Kiệt'), 'Đảo Kiệt');
  assert.equal(validIslandName('Nhà Bè 2'), 'Nhà Bè 2');
  assert.equal(validIslandName('Đảo Kiệt'.normalize('NFD')), 'Đảo Kiệt', 'decomposed input is composed (at most 2 marks in a row)');
  assert.equal(validIslandName('a' + '́'.repeat(23)), null, 'zalgo');
  // NFC folds the first U+0301 into the letter: 4 raw marks leave 3 (rejected), 3 raw marks leave 2 (fine)
  assert.equal(validIslandName('a' + '́'.repeat(4)), null, '3 marks in a row after NFC');
  assert.notEqual(validIslandName('a' + '́'.repeat(3)), null, '2 marks after NFC are fine');
  assert.equal(validIslandName('́abc'), null, 'starts with a mark');
  assert.equal(validIslandName('.hidden'), null, 'starts with punctuation');
  assert.equal(validIslandName('- x'), null);
  assert.equal(validIslandName('2 Nhà'), '2 Nhà', 'digit first is fine');
});
