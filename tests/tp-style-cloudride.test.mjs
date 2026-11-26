// The cloudride teleport style (web/tp-style-cloudride.js): the beats on the core clock, the hand-overs between the
// ends and the flight, a hidden start and a stool sitter, the cloud leaving after the release, the trail's purity and
// the items it asks for. The drawing contract itself is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { TpStyles } = loadWeb('tp-styles')
const { Kit } = loadWeb('tp-kit')
const { CLOUDRIDE: M, STYLE, cloudPixels } = loadWeb('tp-style-cloudride')
const { B } = M
const { T, DEP, ARR } = TL
const REL = T.RELEASE
const D = TpStyles.durs('cloudride', 20)
const PART = Kit.PART

// A minimal X at core v: the landing up and to the left of the origin.
function fakeX(v, { stool = false, hide = false, cut = null, lite = false, len = 20, dirFront = false, secs } = {}) {
  const tp = { u: TL.real(v, D), d: D, swAt: DEP, cut, hide, stool, len }
  const L = TL.phase(tp, false, TL.newPhase())
  if (secs != null) L.secs = secs
  return {
    x0: 400, y0: 300, x1: 200, y1: 200, tx0: 20, ty0: 10, tx1: 5, ty1: 6, dir1: [-0.9, -0.4],
    lite, night: false, snow: 0, tp, a: { dirFront }, L,
    hash: (k, salt) => (((k * 37 + salt * 11) % 100) + 100) % 100 / 100,
  }
}
// The bob is a whole pixel wave of idle time: 0 at secs 0.
const pic = (v, o) => {
  const X = fakeX(v, { secs: 0, ...o })
  return { ...M.picture(X, X.L.v, 0) }
}
const sink = rects => new Proxy({}, { get: (_, k) => (k === 'rect' ? (...a) => rects.push(a.join()) : () => {}), set: () => true })
globalThis.document ??= { createElement: () => ({ getContext: () => sink([]) }) }
function drawn(v, o, hook = 'person') {
  const X = fakeX(v, o), rects = [], feet = []
  X.ctx = sink(rects)
  X.stamp = () => {}
  X.bodyAt = (x, y, b) => feet.push([x, y, b.pose, b.front, b.alpha])
  return { ret: STYLE[hook](X, 1), rects, feet }
}

test('the beats come in order, inside their segments', () => {
  assert.ok(B.WHISTLE[0] < B.IN[0] && B.IN[0] < B.IN[1] && B.IN[1] < B.HOP && B.HOP < B.ON && B.ON < B.LIFT)
  assert.ok(B.LIFT < DEP)
  for (const stool of [1, 2]) assert.ok(M.hop0(stool) >= T.SQUEEZE && M.lift0(stool) < DEP, 'off the stool first')
  assert.ok(ARR < B.DOWN && B.DOWN < B.OFF && B.OFF < B.STAND && B.STAND < B.AWAY && B.AWAY < REL && REL < B.GONE)
})

test('on the cloud from the hop, through the flight, until the hop off; no jump at either switch', () => {
  for (const stool of [false, 1, 2]) {
    const a = pic(DEP - 1e-9, { stool }), b = pic(DEP, { stool })
    assert.ok(Math.abs(a.fx - b.fx) <= 1 && Math.abs(a.fy - b.fy) <= 1, `take-off (${stool})`)
    assert.ok(b.on && b.fy === b.cy && b.fx === b.cx, 'standing on it')
    assert.equal(b.fy, 300 - M.H0)
  }
  const c = pic(ARR - 1e-9), d = pic(ARR)
  assert.ok(Math.abs(c.fx - d.fx) <= 1 && Math.abs(c.fy - d.fy) <= 1, 'arrival')
  assert.equal(pic(B.DOWN).fy, 200 - M.TOP)
  const off = pic(REL - 1e-6)
  assert.ok(!off.on && off.fy === 200 && off.fx === 200, 'on the floor before the walker takes over')
  assert.equal(off.front, null, 'their own facing, the one the walker goes on with')
  assert.ok(pic(B.ON + 0.02).on && !pic(B.HOP - 0.01).on)
})

test('a stool sitter sits where the page draws them until the hop; a hidden start floats in at L_IN', () => {
  for (const [stool, pose] of [[1, 'sit'], [2, 'sitHigh']]) {
    const p = pic(0.1, { stool })
    assert.equal(p.pose, pose)
    assert.equal(p.fy, 300)
  }
  assert.equal(pic(T.L_IN, { hide: true }).a, 0)
  assert.equal(pic(DEP - 0.03, { hide: true }).a, 1)
  for (const v of [ARR, B.OFF + 0.02, REL - 1e-3]) assert.equal(drawn(v, { hide: true }).feet.length, 1, `core ${v}`)
})

test('the cloud swoops in from high up beside them, and flies off high up after the release', () => {
  assert.equal(pic(B.IN[0] - 0.001).ca, 0)
  const in0 = pic(B.IN[0] + 0.005), in1 = pic(B.IN[1])
  assert.ok(in0.cy < in1.cy - 50, 'from high up')
  assert.equal(in1.cy, 300 - M.TOP)
  assert.equal(Math.abs(in1.cx - 400), M.SIDE)
  const gone = pic(B.GONE - 0.01)
  assert.ok(gone.cy < 200 - 90 && gone.ca < 0.2, 'up and out of sight')
  assert.equal(pic(B.GONE + 0.01).ca, 0)
})

test('the trail is pure in the clock, thinner in a crowd, none in a cut or before the take-off', () => {
  const X = fakeX(0.5), list = [...M.trail(X)]
  assert.ok(list.length >= 15, `${list.length / 3} puffs`)
  assert.deepEqual([...M.trail(X)], list)
  assert.ok(M.trail(fakeX(0.5, { lite: true })).length < list.length)
  assert.equal(M.trail(fakeX(0.4)).length, 0)
  assert.equal(M.trail(fakeX(0.3, { cut: TL.real(0.3, D) })).length, 0)
})

test('the items it asks for by phase', () => {
  const F = PART.TRIP | PART.SHADOW
  assert.equal(STYLE.need(fakeX(-0.1)), 0, 'queued: drawn as usual')
  assert.equal(STYLE.need(fakeX(T.L_IN - 0.01, { hide: true })), 0)
  assert.equal(STYLE.need(fakeX(0.3, { hide: true })), F)
  assert.equal(STYLE.need(fakeX(0.05)), PART.F0)
  assert.equal(STYLE.need(fakeX(0.5)), F)
  assert.equal(STYLE.need(fakeX(0.7)), PART.F1)
  assert.equal(STYLE.need(fakeX(REL + 0.01)), PART.TRIP | PART.F1, 'the cloud leaving')
  assert.equal(STYLE.need(fakeX(B.GONE + 0.01)), 0)
})

test('after the release the cloud is its own trip item, rising into the overlay', () => {
  const X = fakeX(REL + 0.01), out = [0, 0, 0]
  assert.equal(STYLE.ground(X, out), true)
  assert.ok(out[2] < 40)
  const Y = fakeX(B.GONE - 0.02)
  STYLE.ground(Y, out)
  assert.ok(out[2] > 24, 'high: the overlay')
  assert.equal(drawn(REL + 0.01).ret, false, 'the walker draws them')
})

test('the cloud raster: a rim all round, light on top, shade underneath', () => {
  for (const f of [0, 1]) {
    const px = cloudPixels(f), at = (x, y) => px[y * 30 + x]
    assert.ok(at(15, 0) === 1 || at(15, 1) === 1, 'rim on top')
    assert.ok([2, 1].includes(at(15, M.CH - 2)), 'shade underneath')
    assert.ok([...px].includes(4))
  }
})
