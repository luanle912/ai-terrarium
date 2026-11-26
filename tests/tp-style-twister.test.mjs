// The twister teleport style (web/tp-style-twister.js): the spin clock, the funnel's taper, the orbiting leaves and
// the leaves it sheds. The drawing contract itself (budget, context, cuts, crowds, marks) is
// tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { TpStyles } = loadWeb('tp-styles')
const { TWISTER } = loadWeb('tp-style-twister')
const { turnsAt, halfW, leafAt, shed, lean, HF, W1, NLEAF, NSHED, UNW } = TWISTER
const { DEP, ARR, T } = TL
const X = { hash: (k, s) => ((k * 7919 + s * 104729) % 1000) / 1000 }

test('the spin speeds up, holds all trip, then winds down to a stop once the funnel has unwound', () => {
  const d = TpStyles.durs('twister', 20), L = { d, v: 0, trip: -1 }
  let last = -1
  for (let v = 0; v <= T.END; v += 0.002) {
    Object.assign(L, { v, trip: v > DEP && v < ARR ? (v - DEP) / (ARR - DEP) : -1 })
    const n = turnsAt(L)
    assert.ok(n >= last - 1e-9, `v ${v}`)
    last = n
  }
  const at = v => turnsAt({ d, v, trip: -1 })
  assert.equal(at(0), 0)
  const still = ARR + UNW * (T.RELEASE - ARR) + 0.01
  assert.equal(at(still), at(T.END), 'no spin after unwinding')
  assert.ok(at(DEP) > 1, 'it spun round before leaving')
})

test('the funnel tapers to its foot and leaves orbit close to it', () => {
  assert.ok(halfW(0) < 2)
  assert.ok(Math.abs(halfW(HF) - W1) < 1e-9)
  for (let y = 0; y < HF; y++) assert.ok(halfW(y + 1) >= halfW(y))
  const P = [0, 0, false]
  for (let k = 0; k < NLEAF; k++)
    for (let t = 0; t < 2; t += 0.05) {
      leafAt(X, k, t, 100, 200, 0, 1, P)
      assert.ok(Math.abs(P[0] - 100) <= W1 + 8, `leaf ${k} x`)
      assert.ok(P[1] <= 200 && P[1] >= 200 - HF - 4, `leaf ${k} y`)
    }
})

test('shed leaves land round the feet before the release, where the mark draws them', () => {
  const arr = TpStyles.BY_ID.twister.arr, P = [0, 0, false, 0], E = [0, 0, false, 0]
  for (let k = 0; k < NSHED; k++) {
    shed(X, k, 0, 100, 50, P)
    assert.equal(P[2], false)
    shed(X, k, arr - 0.05, 100, 50, E)
    assert.equal(E[2], true, `leaf ${k} down before the release`)
    assert.deepEqual(shed(X, k, arr + 2, 100, 50, P).slice(0, 3), E.slice(0, 3))
    assert.ok(Math.hypot(E[0] - 100, 2 * (E[1] - 50)) <= 22, 'lands round the feet')
  }
})

test('the top trails behind the way it goes, leftwards as well as rightwards', () => {
  assert.equal(lean(6), -3)
  assert.equal(lean(-6), 3)
  assert.equal(lean(-1.5), 1.5)
  assert.ok(lean(0) === 0)
})
