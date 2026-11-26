// The bats teleport style (web/tp-style-bats.js): when each bat leaves and comes back, the eye blink in the arrival,
// the one left out, and which items are asked for. The drawing contract itself (budget, context, cuts, crowds) is
// tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { Kit } = loadWeb('tp-kit')
const { BATS } = loadWeb('tp-style-bats')
const { B, N, LAND, WAIT, birthOf, landOf, where, need } = BATS
const { DEP, ARR, T } = TL

// A minimal X: two ends 200 px apart, a fixed hash, no agent.
function fakeX(L) {
  return {
    L: { q: 0, hide: false, sw: false, C: 1, secs: 1.3, dep: -1, trip: -1, arr: -1, fade: -1, ...L },
    tp: { len: 20, stool: false },
    a: null,
    x0: 100, y0: 300, x1: 300, y1: 260,
    hash: (k, s) => ((k * 7919 + s * 104729) % 1000) / 1000,
  }
}
const at = (L, j) => {
  const p = where(fakeX(L), j)
  return p && [...p]
}

test('bats lift off head first and are all in the swarm by departure', () => {
  assert.ok(B.SH0 < B.SH1 && B.SH1 < B.BURST && B.BURST < B.B1, 'shadow, shiver, then the bats')
  for (let j = 1; j < LAND; j++) assert.ok(birthOf(j) > birthOf(j - 1))
  for (let j = 0; j < LAND; j++) {
    assert.ok(birthOf(j) >= B.BURST && birthOf(j) + B.FLY <= DEP + 1e-9, `${j} out by DEP`)
    assert.equal(at({ v: birthOf(j) - 0.001, dep: 0.6 }, j), null, `${j} still in the silhouette`)
    assert.ok(at({ v: birthOf(j) + 0.001, dep: 0.6 }, j), `${j} out`)
  }
})

test('the waiting bat circles from the first frame and never goes in', () => {
  assert.equal(WAIT, N - 1)
  assert.ok(WAIT >= LAND)
  assert.ok(at({ v: 0, dep: 0 }, WAIT), 'out at the start of the departure')
  for (const v of [ARR + 0.01, B.G1, B.EYE, B.COL[1]]) assert.ok(at({ v, sw: true, arr: 0.5 }, WAIT), `out at ${v}`)
  assert.equal(at({ v: T.END - 0.001, sw: true, fade: 1 }, WAIT)[2], 0, 'gone by the end')
})

test('landers dive in feet first, all before the red eyes open; one blink, then the colour, before the release', () => {
  for (let j = 1; j < LAND; j++) assert.ok(landOf(j) > landOf(j - 1))
  for (let j = 0; j < LAND; j++) {
    assert.ok(landOf(j) - B.DIVE >= ARR && landOf(j) <= B.G1 + 1e-9, `${j} lands in the build`)
    assert.ok(at({ v: landOf(j) - 0.001, sw: true, arr: 0.4 }, j), `${j} diving`)
    assert.equal(at({ v: landOf(j), sw: true, arr: 0.4 }, j), null, `${j} landed`)
  }
  assert.ok(B.G1 <= B.EYE && B.EYE < B.SHUT[0] && B.SHUT[0] < B.SHUT[1] && B.SHUT[1] < B.COL[0], 'open, blink, open')
  assert.ok(B.COL[0] < B.COL[1] && B.COL[1] < T.RELEASE, 'whole before the release')
})

test('the swarm leaves over the origin, flies the chord and comes down over the landing', () => {
  for (let j = 0; j < N; j++) {
    const s = at({ v: DEP - 0.001, dep: 0.99 }, j), e = at({ v: ARR, sw: true, arr: 0 }, j)
    assert.ok(Math.abs(s[0] - 100) < 40 && s[1] < 300, `${j} over the origin`)
    assert.ok(Math.abs(e[0] - 300) < 40 && e[1] < 260, `${j} over the landing`)
    const m = at({ v: 0.48, sw: true, trip: 0.5 }, j)
    assert.ok(m[0] > 140 && m[0] < 260, `${j} on the way`)
  }
})

test('where is a pure function of the frame (no randomness)', () => {
  for (let j = 0; j < N; j++)
    for (const L of [{ v: 0.3, dep: 0.7 }, { v: 0.48, sw: true, trip: 0.5 }, { v: 0.7, sw: true, arr: 0.4 }])
      assert.deepEqual(at(L, j), at(L, j))
})

test('a hidden start shows its swarm from the first frame of the trip, faint, then whole', () => {
  const p0 = at({ v: DEP, sw: true, trip: 0, hide: true }, 0)
  assert.ok(p0[2] > 0 && p0[2] < 1)
  assert.equal(at({ v: 0.46, sw: true, trip: 0.2, hide: true }, 0)[2], 1)
})

test('items: the queued bat at the origin, nothing for a hidden start before its trip, else the swarm', () => {
  assert.equal(need(fakeX({ q: 1, v: -0.1 })), Kit.PART.S0)
  assert.equal(need(fakeX({ hide: true, v: 0.3, dep: 0.7 })), 0)
  assert.equal(need(fakeX({ hide: true, sw: true, v: 0.42, trip: 0 })), Kit.PART.TRIP)
  assert.equal(need(fakeX({ v: 0.2, dep: 0.5 })), Kit.PART.TRIP)
})
