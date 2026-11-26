// The caped teleport style (web/tp-style-caped.js): the beats on the core clock, the hand-overs between the ends and
// the flight, a hidden start and a stool sitter, the cape folding away before the release, the items it asks for and
// the cracks' hand-over to their mark. The drawing contract itself is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { TpStyles } = loadWeb('tp-styles')
const { Kit } = loadWeb('tp-kit')
const { CAPED: M, STYLE } = loadWeb('tp-style-caped')
const { B } = M
const { T, DEP, ARR } = TL
const REL = T.RELEASE
const D = TpStyles.durs('caped', 20)
const PART = Kit.PART

// A minimal X at core v: the landing up and to the left of the origin, so they fly away from the camera.
function fakeX(v, { stool = false, hide = false, cut = null, lite = false, len = 20, dirFront = false } = {}) {
  const tp = { u: TL.real(v, D), d: D, swAt: DEP, cut, hide, stool, len }
  return {
    x0: 400, y0: 300, x1: 200, y1: 200, tx0: 20, ty0: 10, tx1: 5, ty1: 6, dir1: [-0.9, -0.4],
    lite, night: false, snow: 0, tp, a: { dirFront }, L: TL.phase(tp, false, TL.newPhase()),
    hash: (k, salt) => (((k * 37 + salt * 11) % 100) + 100) % 100 / 100,
  }
}
const pic = (v, o) => {
  const X = fakeX(v, o)
  return { ...M.picture(X, X.L.v, X.L.secs) }
}
// person() on a context that records its rects and a bodyAt that records the feet and the alpha.
const sink = rects => new Proxy({}, { get: (_, k) => (k === 'rect' ? (...a) => rects.push(a.join()) : () => {}), set: () => true })
globalThis.document ??= { createElement: () => ({ getContext: () => sink([]) }) }
function drawn(v, o, hook = 'person') {
  const X = fakeX(v, o), rects = [], feet = []
  X.ctx = sink(rects)
  X.stamp = () => {}
  X.bodyAt = (x, y, b) => feet.push([x, y, b.pose, b.alpha])
  return { ret: STYLE[hook](X, 0), rects, feet }
}

test('the beats come in order, inside their segments', () => {
  assert.ok(B.CAPE[0] < B.SIT && B.SIT < B.CAPE[1] && B.CAPE[1] < B.CROUCH[0])
  assert.ok(B.CROUCH[0] < B.CROUCH[1] && B.CROUCH[1] < B.LEAP && B.LEAP < DEP)
  assert.ok(ARR < B.HIT && B.HIT < B.RISE[0] && B.RISE[0] < B.RISE[1] && B.FOLD[0] < B.FOLD[1] && B.FOLD[1] < REL)
})

test('the body hands over without a jump at take-off and touchdown', () => {
  for (const stool of [false, 1, 2]) {
    const a = pic(DEP - 1e-9, { stool }), b = pic(DEP, { stool })
    assert.ok(Math.abs(a.fx - b.fx) <= 1 && Math.abs(a.fy - b.fy) <= 1, `take-off (${stool}) ${a.fy} ${b.fy}`)
    assert.equal(b.fy, 300 - M.H0)
  }
  const c = pic(ARR - 1e-9), d = pic(ARR)
  assert.ok(Math.abs(c.fx - d.fx) <= 1 && Math.abs(c.fy - d.fy) <= 1, `touchdown ${c.fy} ${d.fy}`)
  assert.equal(d.fy, 200 - M.ARRH)
  assert.equal(pic(B.HIT + 1e-9).fy, 200, 'down on the floor at the slam')
  assert.ok(pic(B.HIT + 0.01).legs < 0.5, 'on one knee')
})

test('a stool sitter sits on the floor point (the page lifts a sitter) and stands up on the stool', () => {
  for (const [stool, pose, up] of [[1, 'sit', 4], [2, 'sitHigh', 9]]) {
    const s = pic(0.01, { stool })
    assert.equal(s.pose, pose)
    assert.equal(s.fy, 300, `${pose}: drawn where the walker draws them`)
    assert.equal(pic(B.SIT + 0.01, { stool }).fy, 300 - up, 'standing on the stool')
    assert.equal(drawn(0.01, { stool }).feet[0][1], 300)
  }
})

test('a hidden start fades in once at L_IN, stays whole through the switch, and is drawn through the arrival', () => {
  const at = v => pic(v, { hide: true }).a
  assert.equal(at(T.L_IN), 0)
  let prev = 0
  for (let v = T.L_IN; v < ARR; v += 0.002) {
    assert.ok(at(v) >= prev, `alpha falls at core ${v.toFixed(3)}`)
    prev = at(v)
  }
  assert.equal(at(DEP), 1, 'whole at the switch')
  for (const v of [ARR, B.HIT + 0.01, B.RISE[1], REL - 1e-3]) {
    const d = drawn(v, { hide: true })
    assert.equal(d.ret, true)
    assert.equal(d.feet.length, 1, `a body at core ${v}`)
    assert.equal(d.feet[0][3], 1)
  }
})

test('the cape is on from the swirl to the fold, and gone before the release', () => {
  assert.ok(pic(B.CAPE[1]).len >= M.CAPEL - 3)
  assert.ok(pic(0.48).len > M.CAPEL - 3, 'streaming in flight')
  assert.equal(pic(B.FOLD[1] + 1e-6).len, 0)
  assert.equal(pic(REL - 1e-6).len, 0)
  assert.equal(pic(REL - 1e-6).pose, 'stand')
  assert.equal(pic(REL - 1e-6).fy, 200)
})

test('it flies high and reports its real height, low at both ends', () => {
  assert.ok(pic(DEP + 0.5 * (ARR - DEP)).h >= M.cruise(20), 'cruising')
  assert.ok(pic(DEP).h < 40 && pic(ARR).h < 40)
  assert.ok(pic(B.HIT + 0.01).h === 0)
})

test('dust and chips only thin out in a crowd: nothing moves when it starts or ends', () => {
  for (const [v, hook] of [[0.43, 'stand'], [B.HIT + 0.02, 'person'], [B.HIT + 0.04, 'person']]) {
    const all = new Set(drawn(v, {}, hook).rects), few = drawn(v, { lite: true }, hook).rects
    assert.ok(few.length > 0 && few.length < all.size, `core ${v}`)
    assert.deepEqual(few.filter(q => !all.has(q)), [], `core ${v}`)
  }
})

test('the items it asks for by phase', () => {
  assert.equal(M.need(fakeX(-0.1)), 0, 'queued: drawn as usual')
  assert.equal(M.need(fakeX(T.L_IN - 0.01, { hide: true })), 0, 'a hidden start shows nothing before L_IN')
  assert.equal(M.need(fakeX(0.3, { hide: true })), PART.TRIP | PART.SHADOW)
  assert.equal(M.need(fakeX(0.05)), PART.F0)
  assert.equal(M.need(fakeX(DEP + 0.005)), PART.TRIP | PART.SHADOW | PART.S0, 'the launch dust rolls on behind')
  assert.equal(M.need(fakeX(0.5)), PART.TRIP | PART.SHADOW)
  assert.equal(M.need(fakeX(B.HIT)), PART.F1)
  assert.equal(M.need(fakeX(0.6, { hide: true })), PART.F1)
  assert.equal(M.need(fakeX(REL)), 0, 'the cracks take over')
})

test('the cracks hand over to their mark at the slam\'s own age', () => {
  assert.ok(Math.abs(M.HIT_S - (TL.real(B.HIT, D) - TL.real(ARR, D))) < 1e-9)
  assert.equal(STYLE.marks.length, 1)
  const [m] = STYLE.marks
  assert.deepEqual([m.at, m.end, m.layer], ['arr', 1, 'floor'])
  assert.ok(Math.abs(m.ttl - (M.HIT_S + M.CRACK)) < 1e-9)
})
