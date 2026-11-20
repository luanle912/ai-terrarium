// The upload teleport style (web/tp-style-upload.js): the beats on the core clock (the upload bar, the pull up into
// the cloud, the cloud's flight, the pixel rain and the download bar) and the items it asks for. The drawing contract
// itself (budget, context, cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { UPLOAD: U } = loadWeb('tp-style-upload')
const { T, DEP, ARR } = TL
const REL = T.RELEASE
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps

test('the upload bar counts up to 100% with a stall at 99%, before they are pulled up', () => {
  assert.equal(U.upload(0), 0)
  assert.equal(U.upload(U.B.UP0), 0)
  assert.equal(U.upload(U.B.DONE), 1)
  assert.equal(U.upload(U.B.DONE - 0.002), 0.99, 'held at 99% just before')
  let last = 0
  for (let v = 0; v <= DEP; v += 0.002) {
    const p = U.upload(v)
    assert.ok(p >= last - 1e-12 && p <= 1, 'grows only')
    last = p
  }
  assert.ok(U.B.DONE <= U.B.RISE0 && U.B.RISE0 >= T.SQUEEZE, 'a stool sitter has stood up before the pull')
  assert.equal(U.rise(U.B.RISE0, 40).lift, 0)
  assert.ok(near(U.rise(U.B.RISE1, 40).lift, 40), 'all the way into the cloud before the flight')
  assert.ok(U.B.RISE1 < DEP)
})

test('the box is up while it counts, gone during the flight, and back for the download', () => {
  assert.ok(U.box(U.B.IN).a > 0.99 && !U.box(U.B.IN).down)
  assert.ok(U.box(0).a > 0.5, 'starts where the queued box stood')
  assert.equal(U.box(U.B.BOXF1).a, 0)
  assert.ok(U.box(U.B.DIN1).down && U.box(U.B.DIN1).a > 0.99)
  assert.equal(U.box(U.B.DF1).a, 0)
  assert.equal(U.rained(U.B.RAIN0), 0)
  assert.equal(U.rained(U.B.RAIN1), 1)
})

test('the rain builds the person from the feet up and lands the last row by RAIN1', () => {
  assert.ok(near(U.startOf(0, 0), U.B.RAIN0))
  assert.ok(U.startOf(0.5, 0) < U.startOf(1, 0), 'feet first')
  assert.ok(near(U.startOf(1, 1) + U.FALL, U.B.RAIN1), 'the latest cell lands at RAIN1')
  assert.ok(U.startOf(2, 1) + U.FALL <= U.B.RAIN1 + 1e-9, 'clamped')
  assert.ok(U.B.RAIN1 < U.B.WHOLE && U.B.WHOLE < REL, 'the plain body before the release')
})

// A minimal X for where(): origin and landing feet, their tiles, the phase.
function fakeX(v, { stool = false, hide = false, trip = -1 } = {}) {
  return {
    x0: 100, y0: 300, x1: 400, y1: 200, tx0: 20, ty0: 10, tx1: 5, ty1: 6,
    tp: { stool, len: 18 },
    L: { v, trip, hide, C: 1 },
  }
}
const at = (v, o) => ({ ...U.where(fakeX(v, o)) })

test('the cloud hands over without a jump: departure to flight, flight to arrival', () => {
  for (const stool of [false, 1, 2]) {
    const a = at(DEP - 1e-9, { stool }), b = at(DEP, { stool, trip: 0 })
    assert.ok(Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && near(a.a, b.a), `take-off (${stool})`)
  }
  const c = at(ARR - 1e-9, { trip: 1 }), d = at(ARR)
  assert.ok(Math.abs(c.x - d.x) < 0.5 && Math.abs(c.y - d.y) < 0.5 && near(c.a, d.a), 'arrival')
  assert.ok(at(DEP, { stool: 2, trip: 0 }).y < at(DEP, { trip: 0 }).y, 'higher over a high stool')
  assert.ok(at(DEP + 0.06, { trip: 0.5 }).h > U.CLOUD, 'arcs over the island')
  assert.ok(at(U.B.GO1).a < 1e-9, 'gone before the end')
  // a stall user's cloud fades in from L_IN and flies at full strength
  assert.equal(at(T.L_IN, { hide: true }).a, 0)
  assert.ok(near(at(DEP - 1e-9, { hide: true }).a, 1, 1e-6) && at(DEP, { hide: true, trip: 0 }).a === 1)
})

test('items: the queued box, nothing hidden before L_IN, the cloud and its shadow, nothing at the end', () => {
  const n = (v, o = {}) => U.need({ L: { v, q: 0, hide: false, sw: false, trip: -1, ...o } })
  assert.equal(n(-0.1, { q: 1 }), 16)
  assert.equal(n(0.2, { hide: true }), 0)
  assert.equal(n(T.L_IN, { hide: true }), 64 | 128)
  assert.equal(n(0.1), 64 | 128)
  assert.equal(n(0.48, { sw: true, trip: 0.5 }), 64 | 128)
  assert.equal(n(U.B.GO1), 0)
  assert.ok(U.B.GO1 < T.END && U.B.DF1 < U.B.GO1)
})
