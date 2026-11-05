'use strict';
// Authenticated encryption for secrets stored in the DB (the Google refresh token). AES-256-GCM with a random
// 96-bit IV. Sealed form: `v1.<base64url(iv12 | tag16 | ciphertext)>`. `aad` binds the blob to its owner
// (callers pass 'user:' + userId) so a blob copied to another row will not open.

const crypto = require('node:crypto');

const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = 'v1.';

function seal(key, plaintext, aad) {
  const iv = crypto.randomBytes(IV_LEN);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from(String(aad)));
  const ct = Buffer.concat([c.update(String(plaintext), 'utf8'), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url');
}

// Throws on a wrong key, wrong aad, tampering or a malformed blob.
function open(key, sealed, aad) {
  if (typeof sealed !== 'string' || !sealed.startsWith(PREFIX)) throw new Error('bad sealed value');
  const raw = Buffer.from(sealed.slice(PREFIX.length), 'base64url');
  if (raw.length < IV_LEN + TAG_LEN) throw new Error('bad sealed value');
  const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_LEN));
  d.setAAD(Buffer.from(String(aad)));
  d.setAuthTag(raw.subarray(IV_LEN, IV_LEN + TAG_LEN));
  return Buffer.concat([d.update(raw.subarray(IV_LEN + TAG_LEN)), d.final()]).toString('utf8');
}

module.exports = { seal, open };
