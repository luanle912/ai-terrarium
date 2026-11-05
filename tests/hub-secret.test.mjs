import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { seal, open } = require('../hub/secret.js');

const key = () => crypto.randomBytes(32);

test('seal then open round-trips', () => {
  const k = key();
  const sealed = seal(k, '1//refresh-token', 'user:7');
  assert.match(sealed, /^v1\.[A-Za-z0-9_-]+$/);
  assert.ok(!sealed.includes('refresh-token'));
  assert.equal(open(k, sealed, 'user:7'), '1//refresh-token');
});

test('two seals of the same text differ', () => {
  const k = key();
  assert.notEqual(seal(k, 'same', 'user:1'), seal(k, 'same', 'user:1'));
});

test('open rejects a wrong key, a wrong aad and a flipped byte', () => {
  const k = key();
  const sealed = seal(k, 'secret', 'user:1');
  assert.throws(() => open(key(), sealed, 'user:1'));
  assert.throws(() => open(k, sealed, 'user:2'));
  const raw = Buffer.from(sealed.slice(3), 'base64url');
  raw[raw.length - 1] ^= 1;
  assert.throws(() => open(k, 'v1.' + raw.toString('base64url'), 'user:1'));
  raw[raw.length - 1] ^= 1;
  raw[0] ^= 1; // iv
  assert.throws(() => open(k, 'v1.' + raw.toString('base64url'), 'user:1'));
  assert.throws(() => open(k, 'v2.' + sealed.slice(3), 'user:1'));
  assert.throws(() => open(k, 'garbage', 'user:1'));
  assert.throws(() => open(k, 'v1.AAAA', 'user:1'));
});
