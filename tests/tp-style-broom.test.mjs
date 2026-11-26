// The broom teleport style (web/tp-style-broom.js): the beats on the core clock, the hand-overs between the ends, the
// flight and the lasting mark, the sparkles' purity and the items it asks for. The drawing contract itself (budget,
// context, cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { Kit } = loadWeb('tp-kit')
const { BROOM: M, broomPixels } = loadWeb('tp-style-broom')
const { B } = M
const { T, DEP, ARR } = TL
const REL = T.RELEASE
const D = [0.6, 2.4, 0.6, 0.4]
const PART = Kit.PART

// A minimal X at core v: the landing up and to the left of the origin, so the broom flies leftwards (side -1).
function fakeX(v, { stool = false, hide = false, cut = null, lite = false } = {}) {
  const tp = { u: TL.real(v, D), d: D, swAt: DEP, cut, hide, stool, len: 18 }
  return {
    x0: 400, y0: 300, x1: 200, y1: 200, tx0: 20, ty0: 10, tx1: 5, ty1: 6, dir1: [-0.9, -0.4],
    lite, night: false, snow: 0, tp, L: TL.phase(tp, false, TL.newPhase()),
    hash: (k, salt) => ((k * 37 + salt * 11) % 100) / 100,
  }
}
const pic = (v, o) => {
  const X = fakeX(v, o)
  return { ...M.picture(X, X.L.v, X.L.secs) }
}
const near = (a, b, keys, tol) => keys.every(k => Math.abs(a[k] - b[k]) <= tol)

test('the beats come in order, before the departure, the release and the mark ends', () => {
  assert.ok(B.POOF < B.SHOWN && B.SHOWN < B.HOP && B.HOP < B.SEAT && B.SEAT < B.LIFT && B.LIFT + B.PUFF < DEP)
  for (const stool of [false, 1, 2]) {
    assert.ok(M.hop0(stool) < M.seat0(stool) && M.seat0(stool) <= M.lift0(stool) && M.lift0(stool) < DEP)
    if (stool) assert.ok(M.hop0(stool) >= T.SQUEEZE, 'a stool sitter boards once off the stool')
  }
  assert.ok(ARR < B.DOWN && B.DOWN < B.OFF && B.OFF < B.STAND && B.STAND <= B.UP && B.UP < B.UPRIGHT)
  assert.ok(B.UPRIGHT + 0.05 < REL, 'the broom has stopped bouncing upright before the mark takes over')
  assert.ok(B.DOWN + B.PUFF < REL, 'the touchdown puff settles before release')
  assert.ok(M.M.STAY + M.M.OUT < M.M.TTL)
})

test('rider and broom hand over without a jump at take-off, arrival and the hop off', () => {
  const keys = ['fx', 'fy', 'bx', 'by']
  for (const stool of [false, 1, 2]) {
    const a = pic(DEP - 1e-9, { stool }), b = pic(DEP, { stool })
    assert.ok(near(a, b, keys, 2), `take-off (${stool}) ${JSON.stringify([a, b])}`)
    assert.ok(a.sit && b.sit)
    assert.equal(a.fy, 300 - M.LIFT)
  }
  const c = pic(ARR - 1e-9), d = pic(ARR)
  assert.ok(near(c, d, keys, 2), 'arrival')
  assert.equal(d.fy, 200 - M.ARRH)
  const e = pic(B.OFF - 1e-9), f = pic(B.OFF)
  assert.ok(near(e, f, keys, 1) && e.sit && !f.sit, 'hop off')
  assert.equal(pic(B.DOWN).fy, 200, 'touched down')
  // a hidden start floats at take-off height, faded in from L_IN
  assert.equal(pic(T.L_IN, { hide: true }).a, 0)
  assert.equal(pic(DEP - 0.03, { hide: true }).a, 1)
})

test('the broom stands where the mark takes over: upright, behind the landing spot, bristles on the floor', () => {
  const p = pic(REL - 1e-6)
  assert.equal(p.k, 4)
  assert.equal(p.bx, 200 + M.ASIDE, 'behind them: the tail side of a leftward flight')
  assert.equal(p.by, 200 - M.BRISTLE)
})

test('it flies high over the island and reports its real height', () => {
  const X = fakeX(0.48)
  const mid = M.picture(X, X.L.v, X.L.secs).h
  assert.ok(mid >= M.cruise(18), 'cruising')
  assert.ok(M.cruise(2) >= 30 && M.cruise(60) <= 96)
  assert.ok(pic(DEP).h < 24 && pic(ARR).h < 24, 'low at both ends: sorts with the furniture')
})

test('sparkles are pure in the clock, shed only while riding and none in a cut', () => {
  const X = fakeX(0.48), list = [...M.shed(X)]
  assert.ok(list.length >= 9, `${list.length / 3} sparkles`)
  assert.deepEqual([...M.shed(X)], list)
  assert.ok(M.shed(fakeX(0.48, { lite: true })).length < list.length, 'fewer in a crowd')
  assert.equal(M.shed(fakeX(B.HOP)).length, 0, 'none before take-off')
  assert.equal(M.shed(fakeX(0.3, { cut: TL.real(0.3, D) })).length, 0)
})

test('the items it asks for by phase', () => {
  assert.equal(M.need(fakeX(-0.1)), PART.S0, 'queued: a twinkle where the broom will appear')
  assert.equal(M.need(fakeX(-0.1, { hide: true })), 0)
  assert.equal(M.need(fakeX(T.L_IN - 0.01, { hide: true })), 0, 'a hidden start shows nothing before L_IN')
  assert.equal(M.need(fakeX(0.3, { hide: true })), PART.TRIP | PART.SHADOW)
  assert.equal(M.need(fakeX(0.005)), PART.F0, 'the remapped body has no shadow of its own: theirs from the start')
  assert.equal(M.need(fakeX(0.2)), PART.F0)
  assert.equal(M.need(fakeX(0.48)), PART.TRIP | PART.SHADOW)
  assert.equal(M.need(fakeX(B.OFF - 0.01)), PART.F1)
  assert.equal(M.need(fakeX(B.OFF)), PART.F1 | PART.S1)
  assert.equal(M.need(fakeX(REL)), 0, 'the mark takes over')
})

test('the raster: level points along the flight, upright stands on its bristles', () => {
  const at = (px, x, y) => px[y * 40 + x]
  const right = broomPixels(1, 1), left = broomPixels(1, -1)
  assert.ok([1, 2, 3].includes(at(right, 30, 19)) && [6, 7, 8].includes(at(right, 14, 20)), 'level: nose to the right')
  assert.ok([1, 2, 3].includes(at(left, 9, 19)) && [6, 7, 8].includes(at(left, 25, 20)), 'mirrored')
  const up = broomPixels(4, 1)
  assert.ok([1, 2, 3].includes(at(up, 19, 8)) && [6, 7, 8].includes(at(up, 19, 26)))
  assert.equal(at(up, 19, 20 + 10), 0, 'nothing under the bristle tips')
})
