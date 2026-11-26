// The sleigh teleport style (web/tp-style-sleigh.js): the beats on the core clock, the hand-overs between the ends and
// the flight, a hidden start and a stool sitter, the team leaving after the release, the present handed over to its
// mark, the snow's purity and the items it asks for. The drawing contract itself is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { TpStyles } = loadWeb('tp-styles')
const { Kit } = loadWeb('tp-kit')
const { DESKS } = loadWeb('office-scene')
const { SLEIGHRIDE: M, STYLE } = loadWeb('tp-style-sleigh')
const { B } = M
const { T, DEP, ARR } = TL
const REL = T.RELEASE
const D = TpStyles.durs('sleigh', 20)
const PART = Kit.PART

// A minimal X at core v: the landing up and to the left of the origin, beside desk 2.
function fakeX(v, { stool = false, hide = false, cut = null, lite = false, len = 20, secs } = {}) {
  const tp = { u: TL.real(v, D), d: D, swAt: DEP, cut, hide, stool, len }
  const L = TL.phase(tp, false, TL.newPhase())
  if (secs != null) L.secs = secs
  return {
    x0: 400, y0: 300, x1: 200, y1: 200, tx0: 20, ty0: 10, tx1: 2.5, ty1: 5.5, dir1: [-0.9, -0.4],
    lite, night: false, snow: 0, tp, a: {}, L,
    hash: (k, salt) => (((k * 37 + salt * 11) % 100) + 100) % 100 / 100,
  }
}
const pic = (v, o) => {
  const X = fakeX(v, { secs: 0, ...o })
  return { ...M.picture(X, X.L.v, 0) }
}
const sink = rects => new Proxy({}, { get: (_, k) => (k === 'rect' ? (...a) => rects.push(a.join()) : () => {}), set: () => true })
globalThis.document ??= { createElement: () => ({ getContext: () => sink([]) }) }
function drawn(v, o, hook = 'person') {
  const X = fakeX(v, o), rects = [], feet = [], stamps = []
  X.ctx = sink(rects)
  X.stamp = (...a) => stamps.push(a)
  X.bodyAt = (x, y, b) => feet.push([x, y, b.pose, b.front, b.alpha, b.clip && b.clip[1]])
  return { ret: STYLE[hook](X, 1), rects, feet, stamps }
}

test('the beats come in order, inside their segments', () => {
  assert.ok(B.TOUCH < B.HOP && B.HOP < B.SIT && B.SIT < B.GO && B.GO < B.LIFT && B.LIFT < DEP)
  for (const stool of [1, 2]) assert.ok(M.hop0(stool) >= T.SQUEEZE && M.lift0(stool) < DEP, 'off the stool first')
  assert.ok(ARR < B.DOWN && B.DOWN < B.OUT && B.OUT < B.STAND && B.STAND < B.LEAVE && B.LEAVE < REL)
  assert.ok(B.TOSS[0] < B.TOSS[1] && B.TOSS[1] < REL && REL < B.GONE && B.GONE < T.END)
})

test('in the sleigh from the hop, through the flight, until the hop out; no jump at either switch', () => {
  for (const stool of [false, 1, 2]) {
    const a = pic(DEP - 1e-9, { stool }), b = pic(DEP, { stool })
    assert.ok(Math.abs(a.sx - b.sx) <= 1 && Math.abs(a.sy - b.sy) <= 1, `take-off (${stool})`)
    assert.ok(b.inside && b.fx === b.sx && b.fy === b.sy, 'seated')
    assert.equal(b.h, M.H0)
  }
  const c = pic(ARR - 1e-9), d = pic(ARR)
  assert.ok(Math.abs(c.sx - d.sx) <= 1 && Math.abs(c.sy - d.sy) <= 1 && Math.abs(c.h - d.h) < 1e-3, 'arrival')
  assert.equal(pic(B.DOWN).h, 0, 'touched down')
  const off = pic(REL - 1e-6)
  assert.ok(!off.inside && off.fy === 200 && off.fx === 200, 'on the floor before the walker takes over')
  assert.equal(off.front, null, 'their own facing, the one the walker goes on with')
  assert.ok(pic(B.SIT + 0.01).inside && !pic(B.HOP - 0.01).inside)
})

test('the team swoops in from high up behind and pulls up beside them, a stool sitter sits until the hop', () => {
  const in0 = pic(0.005), stop = pic(B.TOUCH)
  assert.ok(in0.h > 50 && in0.sx > stop.sx + 50, 'from high up, behind (they go left)')
  assert.equal(stop.h, 0)
  assert.equal(stop.sx, 400 - M.STOPX, 'just ahead of them, the way they go')
  assert.equal(pic(0).ta, 0, 'fades in')
  for (const [stool, pose] of [[1, 'sit'], [2, 'sitHigh']]) {
    const p = pic(0.1, { stool })
    assert.equal(p.pose, pose)
    assert.equal(p.fy, 300, 'a sitter is drawn at the floor point')
  }
})

test('a hidden start glides in from L_IN and lands like anyone else: a body every frame of the arrival', () => {
  assert.equal(pic(T.L_IN, { hide: true }).a, 0)
  assert.equal(pic(DEP - 0.03, { hide: true }).a, 1)
  assert.equal(pic(DEP, { hide: true }).a, 1, 'the flight does not fade it again')
  for (let v = ARR; v < REL; v += 0.01) assert.equal(drawn(v, { hide: true }).feet.length, 1, `core ${v}`)
  assert.equal(drawn(0.35, { hide: true }).feet.length, 0, 'before the switch the trip item has them')
  assert.equal(drawn(0.35, { hide: true }, 'trip').feet.length, 1)
})

test('the present lands clear of the desk in front, else a little nearer the camera', () => {
  // desk 12's landing: the side away from its own desk is right behind desk 13's lamp
  const X = { ...fakeX(REL - 1e-6), tx1: 14.5, ty1: 8.5 }
  assert.deepEqual(M.giftSpot(X), [-M.GIFTX, 2])
  // boxed in by a desk in front on both sides: nudged toward the camera
  const Y = { ...fakeX(REL - 1e-6), tx1: 4.5, ty1: 10 }
  assert.equal(M.giftSpot(Y)[1], 7)
})

test('in the sleigh nothing shows under the near rim; out of it the whole body shows', () => {
  assert.equal(drawn(0.5, {}, 'trip').feet[0][5], 8)
  assert.equal(drawn(REL - 0.01).feet[0][5], null)
})

test('the present tumbles out to the side away from the desk and is where its mark draws it at the release', () => {
  const X = fakeX(REL - 1e-6), g = M.giftSide(X)
  let best = Infinity, want = 0
  for (const d of DESKS) {
    const dx = d.gx + 1 - X.tx1, dy = d.gy + 0.5 - X.ty1
    if (dx * dx + dy * dy < best) [best, want] = [dx * dx + dy * dy, dx - dy > 0 ? -1 : 1]
  }
  assert.equal(g, want)
  const p = pic(REL - 1e-6)
  assert.ok(p.out)
  assert.deepEqual([p.bx, p.by], [200 + g * M.GIFTX, 202])
  assert.ok(!pic(B.TOSS[0] - 0.01).out, 'still in the sleigh')
  // the mark: same spot, from the landing's own tile
  const mk = { ...fakeX(T.END), x0: 200, y0: 200, x1: 200, y1: 200, a: null, tp: null }, rects = [], at = []
  mk.ctx = sink(rects)
  mk.stamp = (...a) => at.push(a)
  STYLE.drawMark(mk, STYLE.marks[0], 0)
  assert.equal(at.length, 1)
  assert.deepEqual([at[0][5], at[0][6]], [p.bx - 4, p.by - 8])
})

test('the snow is pure in the clock, thinner in a crowd, none in a cut or before the swoop', () => {
  const X = fakeX(0.48), list = [...M.flakes(X)]
  assert.ok(list.length >= 30, `${list.length / 3} flakes`)
  assert.deepEqual([...M.flakes(X)], list)
  assert.ok(M.flakes(fakeX(0.48, { lite: true })).length < list.length)
  assert.equal(M.flakes(fakeX(0.3, { cut: TL.real(0.3, D) })).length, 0)
  assert.equal(M.flakes(fakeX(-0.05)).length, 0)
})

test('the items it asks for by phase', () => {
  const F = PART.TRIP | PART.SHADOW
  assert.equal(STYLE.need(fakeX(-0.1)), 0, 'queued: drawn as usual')
  assert.equal(STYLE.need(fakeX(T.L_IN - 0.01, { hide: true })), 0)
  assert.equal(STYLE.need(fakeX(0.3, { hide: true })), F)
  assert.equal(STYLE.need(fakeX(0.05)), PART.F0)
  assert.equal(STYLE.need(fakeX(0.5)), F)
  assert.equal(STYLE.need(fakeX(0.7)), PART.F1)
  assert.equal(STYLE.need(fakeX(REL + 0.01)), PART.TRIP | PART.F1, 'the team leaving')
  assert.equal(STYLE.need(fakeX(B.GONE + 0.01)), 0)
})

test('after the release the team is its own trip item, rising into the overlay with nobody in it', () => {
  const X = fakeX(REL + 0.01), out = [0, 0, 0]
  assert.equal(STYLE.ground(X, out), true)
  assert.ok(out[2] < 24)
  STYLE.ground(fakeX(B.GONE - 0.02), out)
  assert.ok(out[2] > 24, 'high: the overlay')
  assert.equal(drawn(REL + 0.01).ret, false, 'the walker draws them')
  assert.equal(drawn(REL + 0.01, {}, 'trip').feet.length, 0)
})

test('generic reindeer: no red nose', () => {
  for (const pal of M.DEERS) {
    const n = parseInt(pal.n.slice(1), 16)
    assert.ok(n >> 16 < 0x80 && (n >> 16) - ((n >> 8) & 255) < 0x30, pal.n)
  }
})
