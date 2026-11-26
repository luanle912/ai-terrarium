// The butterflies teleport style (web/tp-style-butterflies.js): the cut line through the body, when each butterfly
// leaves and comes back, where the swarm is at each end and which ones stay behind. The drawing contract itself
// (budget, context, cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { BUTTERFLIES } = loadWeb('tp-style-butterflies')
const { B, N, LAND, WAIT, lineAt, birthOf, landOf, where, need } = BUTTERFLIES
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

test('the body is cut from the head down on leaving and built from the feet up on landing', () => {
  const top = 21
  assert.equal(lineAt(0, top), top + 3, 'whole before the cut starts')
  assert.equal(lineAt(B.D1, top), 0, 'gone by the end of the cut')
  assert.equal(lineAt(ARR, top), 0, 'nothing at the landing yet')
  assert.equal(lineAt(B.G1, top), top + 3, 'whole once built')
  for (let v = 0; v < ARR - 0.01; v += 0.01) assert.ok(lineAt(v + 0.01, top) <= lineAt(v, top))
  for (let v = ARR; v < T.RELEASE - 0.01; v += 0.01) assert.ok(lineAt(v + 0.01, top) >= lineAt(v, top))
})

test('the waiting butterfly is out from the first frame, so it never pops when the departure starts', () => {
  assert.ok(at({ v: 0, dep: 0 }, WAIT))
  assert.ok(WAIT >= LAND, 'it is a stayer, not a lander')
})

test('butterflies leave top first and are all in the swarm by departure; landers dive in feet first', () => {
  for (let j = 1; j < N; j++) assert.ok(birthOf(j) < birthOf(j - 1), `leaves before ${j - 1}`)
  for (let j = 0; j < N; j++) {
    assert.ok(birthOf(j) >= B.D0 && birthOf(j) + B.FLY <= DEP + 1e-9, `${j} out by DEP`)
    if (j !== WAIT) assert.equal(at({ v: birthOf(j) - 0.001, dep: 0.5 }, j), null, `${j} still in the body`)
    assert.ok(at({ v: birthOf(j) + 0.001, dep: 0.5 }, j), `${j} out`)
  }
  for (let j = 1; j < LAND; j++) assert.ok(landOf(j) > landOf(j - 1))
  for (let j = 0; j < LAND; j++) {
    assert.ok(landOf(j) <= B.G1 && B.G1 < T.RELEASE, `${j} in before the release`)
    assert.ok(at({ v: landOf(j) - 0.001, sw: true, arr: 0.5 }, j), `${j} diving`)
    assert.equal(at({ v: landOf(j), sw: true, arr: 0.5 }, j), null, `${j} landed`)
  }
})

test('the swarm leaves over the origin and arrives over the landing; two stay and are gone by the end', () => {
  const dist = (p, x) => Math.abs(p[0] - x)
  for (let j = 0; j < N; j++) {
    assert.ok(dist(at({ v: DEP, trip: 0, sw: true }, j), 100) <= 20, `${j} at the origin`)
    assert.ok(dist(at({ v: ARR, trip: 1 - 1e-9, sw: true }, j), 300) <= 20, `${j} at the landing`)
  }
  for (let j = LAND; j < N; j++) {
    assert.ok(at({ v: T.RELEASE - 0.01, sw: true, arr: 0.97 }, j)[2] > 0.9, `${j} stays`)
    assert.ok(at({ v: T.END - 0.01, sw: true, fade: 0.98 }, j)[2] <= 0.01, `${j} faded away`)
  }
})

test('items: the waiting butterfly while queued, nothing for a hidden start before it flies, else the swarm', () => {
  assert.equal(need(fakeX({ q: 1, v: 0 })), 16)
  assert.equal(need(fakeX({ hide: true, v: 0.35, dep: 0.8 })), 0)
  assert.equal(need(fakeX({ hide: true, v: 0.45, sw: true, trip: 0.2 })), 64)
  assert.equal(need(fakeX({ v: 0.1, dep: 0.2 })), 64)
})

test('a new teleport does not reuse the last teleport body height: a high stool start right after a landing', () => {
  const { bounds } = BUTTERFLIES
  // the first one out still sits on the body, where the height counts
  const j = N - 2, v = birthOf(j) + 0.001
  const fresh = { ...fakeX({ v, dep: 0.3 }), a: {}, tp: { len: 20, stool: 2 } }
  const want = [...where(fresh, j)]
  const a = {}
  // the last landing captured them standing, 21 px tall
  bounds({ a, tp: { len: 20, stool: false } }, { n: 1, x: [0], y: [279], w: [6] }, 300)
  const again = { ...fakeX({ v, dep: 0.3 }), a, tp: { len: 20, stool: 2 } }
  assert.deepEqual([...where(again, j)], want)
})
