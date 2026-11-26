// The cut-and-paste teleport style (web/tp-style-cutpaste.js): the beats on the core clock (marquee, CTRL+X, the
// cursor's grab and drag, CTRL+V, deselect) and the items it asks for. The drawing contract itself (budget, context,
// cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { CUTPASTE: C } = loadWeb('tp-style-cutpaste')
const { T, DEP, ARR } = TL
const REL = T.RELEASE
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps

test('the selection box fits each pose round the feet, the cut box is the standing one', () => {
  for (const stool of [false, 1, 2]) {
    const [x, y, w, h] = C.boxOf(stool)
    assert.ok(x <= -7 && x + w >= 7, `wide enough (${stool})`)
    assert.ok(y <= -24 - (stool ? 4 : 0), `over the head and a hat (${stool})`)
    assert.ok(y + h >= (stool === 2 ? -4 : 1), `down to the feet (${stool})`)
    assert.ok(Number.isInteger(x + y + w + h))
  }
  assert.deepEqual(C.boxOf(false), C.boxOf(0))
})

test('departure: the marquee draws, CTRL+X is pressed at the cut, which hides the stool sitter standing up', () => {
  assert.equal(C.marquee(0), 0)
  assert.equal(C.marquee(C.B.MQ1), 1)
  let last = 0
  for (let v = 0; v <= DEP; v += 0.002) {
    const m = C.marquee(v)
    assert.ok(m >= last - 1e-12, 'grows only')
    last = m
  }
  // the agent leaves its stool at SQUEEZE: the white flash of the cut covers that frame
  assert.ok(near(C.B.CUT, T.SQUEEZE))
  assert.ok(C.flash(C.B.CUT + 0.002) > 0.8)
  assert.equal(C.clipped(C.B.CUT - 0.001), false)
  assert.equal(C.clipped(C.B.CUT), true)
  const k = C.keys(C.B.CUT)
  assert.equal(k.ch, 'X')
  assert.ok(k.a > 0.9 && k.down, 'the X key is down at the cut')
  assert.equal(C.keys(0).a, 0)
  assert.equal(C.keys(DEP).a, 0, 'gone before the drag')
  // lifted off the floor as the cursor grabs, never before the cut
  assert.equal(C.lift(C.B.CUT), 0)
  assert.ok(near(C.lift(DEP), C.LIFT))
})

test('the drag: from the origin to the landing, lifted at both ends, highest midway', () => {
  const g0 = C.drag(0, 20), g1 = C.drag(1, 20), mid = C.drag(0.5, 20)
  assert.ok(near(g0.e, 0) && near(g1.e, 1))
  assert.ok(near(g0.h, C.LIFT) && near(g1.h, C.LIFT))
  assert.ok(mid.h > 24, 'over the furniture midway')
  assert.ok(C.drag(0.5, 2).h < mid.h, 'a short hop stays lower')
  assert.ok(C.drag(0.5, 200).h <= C.LIFT + 40)
  let last = C.drag(0, 20)
  for (let p = 0.01; p <= 1.0001; p += 0.01) {
    const g = C.drag(p, 20)
    assert.ok(g.e >= last.e && Math.abs(g.h - last.h) < 3, `smooth at ${p.toFixed(2)}`)
    last = g
  }
  // the clip's lift is continuous across the phase changes
  assert.ok(near(C.lift(DEP), C.drag(0, 20).h))
  assert.ok(near(C.lift(ARR), C.LIFT))
})

test('arrival: CTRL+V drops the clip, a flash pastes it, the box blinks off and all is gone before release', () => {
  assert.ok(C.clipped(ARR))
  const k = C.keys(C.B.DROP0)
  assert.equal(k.ch, 'V')
  assert.ok(k.a > 0.9 && k.down, 'V is down as the clip drops')
  assert.equal(C.lift(C.B.DROP1), 0)
  assert.equal(C.clipped(C.B.PASTE), false)
  assert.ok(C.flash(C.B.PASTE + 0.002) > 0.8)
  assert.ok(C.B.PASTE >= C.B.DROP1, 'pasted once on the floor')
  // the lift falls without a jump
  let last = C.lift(ARR)
  for (let v = ARR; v <= REL; v += 0.002) {
    const l = C.lift(v)
    assert.ok(l <= last + 1e-9 && last - l < 2, `drop at ${v.toFixed(3)}`)
    last = l
  }
  // nothing of the selection is left when they walk on
  for (const v of [REL - 0.06, REL, REL + 0.1, T.END]) {
    assert.equal(C.ants(v), 0, `ants at ${v}`)
    assert.equal(C.keys(v).a, 0, `keys at ${v}`)
    assert.equal(C.flash(v), 0, `flash at ${v}`)
    assert.equal(C.cursor(v, C.boxOf(false), C.boxOf(false), 0, [0, 0, 0])[2], 0, `cursor at ${v}`)
  }
  assert.ok(C.ants(ARR) === 1 && C.ants(C.B.PASTE) === 1)
})

test('the cursor: in at the top-left corner, drags the marquee to the bottom-right, then holds the grab point', () => {
  const b0 = C.boxOf(1), b = C.boxOf(false), q = [0, 0, 0]
  C.cursor(C.B.MQ0, b0, b, 0, q)
  assert.deepEqual([q[0], q[1]], [b0[0], b0[1]])
  C.cursor(C.B.MQ1, b0, b, 0, q)
  assert.deepEqual([q[0], q[1]], [b0[0] + b0[2] - 1, b0[1] + b0[3] - 1])
  C.cursor(DEP, b0, b, C.LIFT, q)
  assert.deepEqual([q[0], q[1]], [C.GRAB[0], C.GRAB[1] - C.LIFT])
  assert.equal(q[2], 1)
  C.cursor(ARR, b0, b, C.LIFT, q)
  assert.deepEqual([q[0], q[1], q[2]], [C.GRAB[0], C.GRAB[1] - C.LIFT, 1])
  // no jumps at either end (a few px a frame at most)
  for (const [v0, v1] of [[0, DEP], [ARR, REL]]) {
    let p = C.cursor(v0, b0, b, C.lift(v0), [0, 0, 0]).slice()
    for (let v = v0 + 0.004; v <= v1; v += 0.004) {
      const n = C.cursor(v, b0, b, C.lift(v), [0, 0, 0])
      if (n[2] > 0 && p[2] > 0) assert.ok(Math.hypot(n[0] - p[0], n[1] - p[1]) < 6, `cursor jump at ${v.toFixed(3)}`)
      p = n.slice()
    }
  }
})

test('the hole left by the cut: from the cut, fading out early in the drag, never at the landing', () => {
  assert.equal(C.hole(C.B.CUT - 0.001, -1), 0)
  assert.equal(C.hole(C.B.CUT + 0.01, -1), 1)
  assert.ok(C.hole(DEP + 0.03, 0.25) > 0)
  assert.equal(C.hole(DEP + 0.1, 0.8), 0)
  assert.equal(C.hole(ARR + 0.01, -1), 0)
})

test('need: the overlay item from the first frame to the cursor leaving, the hole while it shows, none hidden', () => {
  const P = { B0: 1, S0: 16, TRIP: 64, SHADOW: 128 }
  const X = (v, trip = -1, extra = {}) => ({ L: { v, trip, q: 0, hide: false, C: 1, ...extra } })
  assert.ok(C.need(X(0.01)) & P.TRIP)
  assert.equal(C.need(X(0.01)) & P.B0, 0)
  assert.ok(C.need(X(C.B.CUT + 0.01)) & P.B0)
  assert.ok(C.need(X(0.48, 0.5)) & P.SHADOW)
  assert.ok(C.need(X(ARR + 0.05)) & P.TRIP)
  assert.equal(C.need(X(REL + 0.05)), 0)
  assert.equal(C.need(X(0.2, -1, { hide: true })), 0, 'a hidden starter shows nothing before the trip')
  assert.equal(C.need(X(-0.1, -1, { q: 1 })), P.S0, 'queued: the waiting box only')
})
