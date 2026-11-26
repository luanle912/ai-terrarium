// The mole teleport style (web/tp-style-mole.js): the drill down, the pop out, the burst's clods and the grass tuft.
// The drawing contract itself (budget, context, cuts, crowds, marks) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { MOLE } = loadWeb('tp-style-mole')
const { sinkAt, liftAt, clod, clodAt, hairTop, TUFT, SINK, HOPH, DIG1, POP1, LAND1, NCLOD } = MOLE

test('the drill sinks the body steadily until the raised hands are under', () => {
  assert.equal(sinkAt(0), 0)
  assert.equal(sinkAt(DIG1), SINK)
  assert.equal(sinkAt(1), SINK)
  for (let p = 0; p < 1; p += 0.01) assert.ok(sinkAt(p + 0.01) >= sinkAt(p), `p ${p}`)
})

test('the pop starts under the hole, tops out over it and lands without a jump', () => {
  assert.equal(liftAt(0), -SINK)
  assert.equal(liftAt(POP1), HOPH)
  assert.equal(liftAt(LAND1), 0)
  assert.equal(liftAt(1), 0)
  let max = -Infinity
  for (let q = 0; q < 1; q += 0.002) {
    max = Math.max(max, liftAt(q))
    if (q > POP1) assert.ok(Math.abs(liftAt(q + 0.002) - liftAt(q)) <= 2, `q ${q}`)
  }
  assert.equal(max, HOPH)
})

test('every burst clod flies up and lies where the landing mark draws it', () => {
  const X = { hash: (k, s) => ((k * 7919 + s * 104729) % 1000) / 1000 }, P = [0, 0, false], E = [0, 0, false]
  for (let k = 0; k < NCLOD; k++) {
    const c = clod(X, k)
    assert.ok(c.t > 0.3 && c.t < 0.7, `clod ${k} flies ${c.t} s`)
    assert.deepEqual(clodAt(X, k, 0, 100, 50, P), [100, 50, false])
    assert.ok(clodAt(X, k, c.t / 2, 100, 50, P)[1] <= 50 + c.dy / 2 - 7, 'high over the ground at mid flight')
    clodAt(X, k, c.t, 100, 50, E)
    assert.deepEqual(clodAt(X, k, c.t + 2, 100, 50, P), E)
    assert.equal(E[2], true)
    assert.ok(Math.hypot(E[0] - 100, 2 * (E[1] - 50)) <= 40, 'lands round the hole')
  }
})

test('the grass tuft frames fit their 7 px cell and use the tuft palette only', () => {
  for (const rows of TUFT) for (const row of rows) assert.match(row, /^[.gGlydm]{7}$/)
  assert.equal(hairTop({ look: { hairStyle: 'bun' } }), 22)
  assert.equal(hairTop({ look: { hairStyle: 'quiff' } }), 21)
  assert.equal(hairTop({ look: { hairStyle: 'side' } }), 19)
})
