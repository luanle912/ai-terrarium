// The hammer teleport style (web/tp-style-hammer.js): the beats on the core clock, the hand-overs between the ends,
// the flight and the catch, a hidden start and a stool sitter, the sparks' purity, the strike in a crowd and the items
// it asks for. The drawing contract itself is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { TpStyles } = loadWeb('tp-styles')
const { Kit } = loadWeb('tp-kit')
const { HAMMER: M, STYLE, hammerPixels } = loadWeb('tp-style-hammer')
const { B } = M
const { T, DEP, ARR } = TL
const REL = T.RELEASE
const D = TpStyles.durs('hammer', 20)
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

const at = t => DEP + t * (ARR - DEP)

test('the beats come in order, inside their segments', () => {
  assert.ok(B.SUMMON[1] < B.WIND[0] && B.WIND[1] === B.THROW && B.THROW < B.CROUCH[0] && B.CROUCH[1] < B.LEAP)
  assert.ok(B.LEAP < DEP && B.SIT < B.WIND[0])
  assert.ok(B.CATCH[0] < B.CATCH[1] && B.CATCH[1] < 1)
  assert.ok(ARR < B.HIT && B.HIT < B.LOWER && B.LOWER < B.GONE[0] && B.GONE[1] < REL)
})

test('body and hammer hand over without a jump at take-off, the catch and touchdown', () => {
  for (const stool of [false, 1, 2]) {
    const a = pic(DEP - 1e-9, { stool }), b = pic(DEP, { stool })
    for (const k of ['fx', 'fy', 'hx', 'hy']) assert.ok(Math.abs(a[k] - b[k]) <= 1, `take-off ${k} (${stool})`)
    assert.equal(b.fy, 300 - M.H0)
    assert.equal(b.hy, 300 - M.H0 - M.HAND - M.EXH, 'thrown high above them')
  }
  const c = pic(at(B.CATCH[1]) + 1e-6)
  assert.equal(c.hx, c.fx)
  assert.equal(c.hy, c.fy - M.HAND, 'caught: in the raised hand')
  const d = pic(ARR - 1e-9), e = pic(ARR)
  for (const k of ['fx', 'fy', 'hx', 'hy']) assert.ok(Math.abs(d[k] - e[k]) <= 1, `arrival ${k}`)
  assert.equal(pic(B.HIT + 1e-6).fy, 200)
  assert.equal(pic(REL - 1e-6).ha, 0, 'gone before the walker takes over')
  assert.equal(pic(REL - 1e-6).pose, 'stand')
  assert.equal(pic(REL - 1e-6).front, null, 'their own facing, the one the walker goes on with')
})

test('a stool sitter sits where the page draws them; a hidden start flies in holding it, drawn to the end', () => {
  for (const [stool, pose] of [[1, 'sit'], [2, 'sitHigh']]) {
    assert.equal(pic(0.02, { stool }).pose, pose)
    assert.equal(pic(0.02, { stool }).fy, 300)
  }
  assert.equal(pic(T.L_IN, { hide: true }).a, 0)
  assert.equal(pic(DEP - 0.03, { hide: true }).a, 1)
  const h = pic(at(0.3), { hide: true })
  assert.equal(h.hy, h.fy - M.HAND, 'never thrown')
  for (const v of [ARR, B.HIT + 0.01, REL - 1e-3]) assert.equal(drawn(v, { hide: true }).feet.length, 1, `core ${v}`)
})

test('it flies high and reports its real height, low at both ends', () => {
  assert.ok(pic(at(0.5)).h >= M.cruise(20))
  assert.ok(pic(DEP).h < 40 && pic(ARR).h < 40 && pic(B.HIT + 0.01).h === 0)
})

test('sparks are pure in the clock, thinner in a crowd, none in a cut or once caught', () => {
  const X = fakeX(at(0.3)), list = [...M.sparks(X)]
  assert.ok(list.length >= 8, `${list.length / 2} sparks`)
  assert.deepEqual([...M.sparks(X)], list)
  assert.ok(M.sparks(fakeX(at(0.3), { lite: true })).length < list.length)
  assert.equal(M.sparks(fakeX(0.3, { cut: TL.real(0.3, D) })).length, 0)
  assert.equal(M.sparks(fakeX(B.HIT)).length, 0)
})

test('the strike only thins out in a crowd: nothing moves when it starts or ends', () => {
  for (const v of [B.HIT + 0.01, B.HIT + 0.03]) {
    const all = new Set(drawn(v).rects), few = drawn(v, { lite: true }).rects
    assert.ok(few.length > 0 && few.length < all.size, `core ${v}`)
    assert.deepEqual(few.filter(q => !all.has(q)), [], `core ${v}`)
  }
})

test('the items it asks for by phase', () => {
  assert.equal(M.need(fakeX(-0.1)), 0)
  assert.equal(M.need(fakeX(T.L_IN - 0.01, { hide: true })), 0)
  assert.equal(M.need(fakeX(0.3, { hide: true })), PART.TRIP | PART.SHADOW)
  assert.equal(M.need(fakeX(0.05)), PART.F0)
  assert.equal(M.need(fakeX(0.5)), PART.TRIP | PART.SHADOW)
  assert.equal(M.need(fakeX(B.HIT)), PART.F1)
  assert.equal(M.need(fakeX(REL)), 0)
})

test('the hammer raster: a head across the handle at every turn', () => {
  for (let k = 0; k < 8; k++) {
    const px = hammerPixels(k)
    assert.ok(px.includes(4) && px.includes(2) && px.includes(7), `turn ${k}`)
  }
  const up = hammerPixels(0), at2 = (x, y) => up[y * 30 + x]
  assert.ok([4, 5, 6].includes(at2(15, 6)), 'head up')
  assert.ok([2, 3].includes(at2(15, 14)), 'handle at the grip')
})
