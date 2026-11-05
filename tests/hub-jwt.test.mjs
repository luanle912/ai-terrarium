import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { makeGoogle, NOW } from './hub-helpers.mjs';

const require = createRequire(import.meta.url);
const { createJwks } = require('../hub/jwt.js');

const SEC = 1000;
const setup = (fetchWrap) => {
  const clock = { t: NOW };
  const google = makeGoogle({ now: () => clock.t });
  const fetch = fetchWrap ? fetchWrap(google.fetch) : google.fetch;
  return { clock, google, jwks: createJwks({ fetch, now: () => clock.t }) };
};
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

test('a token signed by a JWKS key verifies', async () => {
  const { google, jwks } = setup();
  assert.deepEqual(await jwks.verify(google.sign({ sub: 'x', n: 1 })), { sub: 'x', n: 1 });
  assert.equal(google.jwksFetches, 1);
});

test('malformed tokens are rejected', async () => {
  const { google, jwks } = setup();
  await assert.rejects(jwks.verify('a.b'), /^Error: jwt: /);
  await assert.rejects(jwks.verify(''), /^Error: jwt: /);
  await assert.rejects(jwks.verify(`${Buffer.from('nope').toString('base64url')}.e30.sig`), /jwt: bad header/);
  await assert.rejects(jwks.verify(`${enc({ alg: 'RS256' })}.e30.sig`), /jwt: no kid/);
  await assert.rejects(jwks.verify(google.sign({}, { kid: 'nope' })), /jwt: unknown kid/);
});

test('a wrong signature is rejected', async () => {
  const { google, jwks } = setup();
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  await assert.rejects(jwks.verify(google.sign({ sub: 'x' }, { key: other.privateKey })), /jwt: bad signature/);
  // tampered payload with a genuine signature
  const [h, , s] = google.sign({ sub: 'x' }).split('.');
  await assert.rejects(jwks.verify(`${h}.${enc({ sub: 'evil' })}.${s}`), /jwt: bad signature/);
});

test('alg none and HS256 are rejected', async () => {
  const { google, jwks } = setup();
  await jwks.verify(google.sign({})); // prime the cache so kid-1 is known
  await assert.rejects(jwks.verify(`${enc({ alg: 'none', kid: 'kid-1' })}.${enc({ sub: 'x' })}.`), /jwt: unsupported alg/);
  const input = `${enc({ alg: 'HS256', kid: 'kid-1' })}.${enc({ sub: 'x' })}`;
  const mac = crypto.createHmac('sha256', 'secret').update(input).digest('base64url');
  await assert.rejects(jwks.verify(`${input}.${mac}`), /jwt: unsupported alg/);
});

test('a rotated key is fetched once', async () => {
  const { clock, google, jwks } = setup();
  await jwks.verify(google.sign({}));
  assert.equal(google.jwksFetches, 1);
  google.rotate();
  clock.t += 61 * SEC;
  assert.deepEqual(await jwks.verify(google.sign({ a: 1 })), { a: 1 });
  assert.equal(google.jwksFetches, 2);
  await jwks.verify(google.sign({ a: 2 }));
  assert.equal(google.jwksFetches, 2);
  // the old key is gone from the JWKS
  const oldKid = 'kid-1';
  await assert.rejects(jwks.verify(google.sign({}, { kid: oldKid })), /jwt: (unknown kid|bad signature)/);
});

test('unknown kids refetch at most once a minute', async () => {
  const { clock, google, jwks } = setup();
  await jwks.verify(google.sign({}));
  clock.t += 61 * SEC;
  const before = google.jwksFetches;
  for (let i = 0; i < 5; i++) {
    await assert.rejects(jwks.verify(google.sign({}, { kid: `junk-${i}` })), /unknown kid/);
    clock.t += 2 * SEC;
  }
  assert.equal(google.jwksFetches, before + 1);
  clock.t += 61 * SEC;
  await assert.rejects(jwks.verify(google.sign({}, { kid: 'junk-late' })), /unknown kid/);
  assert.equal(google.jwksFetches, before + 2);
});

test('cache follows max-age', async () => {
  const { clock, google, jwks } = setup();
  await jwks.verify(google.sign({}));
  clock.t += 3599 * SEC;
  await jwks.verify(google.sign({}));
  assert.equal(google.jwksFetches, 1);
  clock.t += 2 * SEC;
  await jwks.verify(google.sign({}));
  assert.equal(google.jwksFetches, 2);
});

const withCacheControl = (value) => (inner) => async (url, opts) => {
  const r = await inner(url, opts);
  const headers = new Headers();
  if (value) headers.set('cache-control', value);
  return new Response(await r.text(), { status: r.status, headers });
};

test('max-age defaults to one hour and is capped at 24 hours', async () => {
  let s = setup(withCacheControl(null));
  await s.jwks.verify(s.google.sign({}));
  s.clock.t += 3599 * SEC;
  await s.jwks.verify(s.google.sign({}));
  assert.equal(s.google.jwksFetches, 1);
  s.clock.t += 2 * SEC;
  await s.jwks.verify(s.google.sign({}));
  assert.equal(s.google.jwksFetches, 2);

  s = setup(withCacheControl('max-age=999999'));
  await s.jwks.verify(s.google.sign({}));
  s.clock.t += 24 * 3600 * SEC - SEC;
  await s.jwks.verify(s.google.sign({}));
  assert.equal(s.google.jwksFetches, 1);
  s.clock.t += 2 * SEC;
  await s.jwks.verify(s.google.sign({}));
  assert.equal(s.google.jwksFetches, 2);
});

test('concurrent unknown kids share one fetch', async () => {
  const { clock, google, jwks } = setup();
  await jwks.verify(google.sign({}));
  clock.t += 61 * SEC;
  const before = google.jwksFetches;
  const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => jwks.verify(google.sign({}, { kid: `junk-${i}` }))));
  assert.ok(results.every((r) => r.status === 'rejected'));
  assert.equal(google.jwksFetches, before + 1);
});

test('concurrent first use shares one fetch and a failed fetch is a jwt error', async () => {
  const { google, jwks } = setup();
  const tokens = Array.from({ length: 4 }, (_, i) => google.sign({ i }));
  assert.deepEqual((await Promise.all(tokens.map((t) => jwks.verify(t)))).map((c) => c.i), [0, 1, 2, 3]);
  assert.equal(google.jwksFetches, 1);

  const down = createJwks({ fetch: async () => { throw new Error('down'); }, now: () => NOW });
  await assert.rejects(down.verify(google.sign({})), /jwt: keys unavailable/);
});

test('only RSA keys are accepted', async () => {
  const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ format: 'jwk' });
  const fetch = async () => new Response(JSON.stringify({ keys: [{ ...ec, kid: 'ec1' }] }), { status: 200 });
  const jwks = createJwks({ fetch, now: () => NOW });
  assert.equal(await jwks.getKey('ec1'), null);
});

test('googleLogin signs in through a real hub with the fake Google', async () => {
  const { startDevHub, googleLogin } = await import('./hub-helpers.mjs');
  const google = makeGoogle({ now: () => NOW });
  const hub = await startDevHub({ google });
  try {
    const me = await googleLogin(hub.url, google, 'ann@newera.inc', { name: 'Ann' });
    assert.match(me.cookie, /^tr_sess=/);
    assert.ok(me.csrf);
    assert.equal(hub.hub.db.getUserBySub('g:ann@newera.inc').name, 'Ann');
    assert.equal(google.calls[0].params.client_id, 'test-client');
    assert.match(google.calls[0].params.code_verifier, /./);
    assert.equal(google.jwksFetches, 1);
    // a second login reuses the cached JWKS
    await googleLogin(hub.url, google, 'bob@newera.inc');
    assert.equal(google.jwksFetches, 1);
  } finally { await hub.close(); }
});
