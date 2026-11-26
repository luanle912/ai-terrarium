// The webswing teleport style (web/tp-style-webswing.js): the beats on the core clock, the hand-overs between the
// ends and the flight, the swings and their threads, a hidden start and a stool sitter, the somersault on the way down
// and the items it asks for. The drawing contract itself is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { TpStyles } = loadWeb('tp-styles')
const { Kit } = loadWeb('tp-kit')
const { WEBSWING: M, STYLE } = loadWeb('tp-style-webswing')
const { B } = M
const { T, DEP, ARR } = TL
const REL = T.RELEASE
const D = TpStyles.durs('webswing', 20)
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
  return { ...M.picture(X, X.L.v) }
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
  assert.ok(B.AIM < B.SHOOT[0] && B.SHOOT[1] < B.CROUCH[0] && B.CROUCH[1] < B.LEAP && B.LEAP < DEP)
  assert.ok(B.SIT < B.SHOOT[0])
  assert.ok(ARR === B.FLIP[0] && B.FLIP[1] === B.LAND && B.LAND < B.UP && B.UP < REL)
})

test('the body hands over without a jump at take-off and where they let go', () => {
  for (const stool of [false, 1, 2]) {
    const a = pic(DEP - 1e-9, { stool }), b = pic(DEP, { stool })
    for (const k of ['fx', 'fy', 'ax', 'ay', 'tl']) assert.ok(Math.abs(a[k] - b[k]) <= 1, `take-off ${k} (${stool})`)
    assert.equal(b.fy, 300 - M.H0)
  }
  const c = pic(ARR - 1e-9), d = pic(ARR)
  assert.ok(Math.abs(c.fx - d.fx) <= 1 && Math.abs(c.fy - d.fy) <= 1, 'let go')
  assert.equal(d.fy, 200 - M.ARRH)
  assert.equal(d.ta, 0, 'no thread once they let go')
  assert.equal(pic(B.LAND + 1e-6).fy, 200)
  const end = pic(REL - 1e-6)
  assert.ok(end.pose === 'stand' && end.rot === 0 && end.legs === 1 && end.front === null)
})

test('swing by swing: low in the middle of each under its point, a new thread at each catch', () => {
  assert.equal(M.swings(4), 1)
  assert.equal(M.swings(40), 4)
  const n = M.swings(20)
  for (let k = 0; k < n; k++) {
    const beg = pic(at((k + 0.02) / n)), mid = pic(at((k + 0.5) / n)), end = pic(at((k + 0.98) / n))
    assert.ok(Math.abs(mid.ax - mid.fx) <= 1, `swing ${k}: hanging under its point`)
    assert.ok(mid.ay < mid.fy - 40, 'the point is well over them')
    assert.ok(mid.h < (beg.h + end.h) / 2 - 8, `swing ${k}: low in the middle`)
    assert.ok(mid.h >= 4, "over the floor")
    assert.equal(mid.tl, 1)
    if (k) assert.ok(pic(at(k / n + 0.01)).tl < 1, `swing ${k}: the thread shoots out`)
  }
})

test('the somersault on the way down: every quarter turn shows, upright when the feet touch', () => {
  const turns = []
  for (let v = ARR; v < B.LAND + 0.02; v += 0.001) {
    const p = pic(v)
    if (turns.at(-1) !== p.rot) turns.push(p.rot)
  }
  assert.deepEqual(turns, [0, 3, 2, 1, 0], `${turns}`)
})

test('a stool sitter sits where the page draws them; a hidden start hangs on its thread, drawn to the end', () => {
  for (const [stool, pose] of [[1, 'sit'], [2, 'sitHigh']]) {
    assert.equal(pic(0.02, { stool }).pose, pose)
    assert.equal(pic(0.02, { stool }).fy, 300)
  }
  assert.equal(pic(T.L_IN, { hide: true }).a, 0)
  const h = pic(DEP - 0.03, { hide: true })
  assert.ok(h.a === 1 && h.tl === 1 && h.fy === 300 - M.H0)
  for (const v of [ARR, B.LAND + 0.01, REL - 1e-3]) assert.equal(drawn(v, { hide: true }).feet.length, 1, `core ${v}`)
})

test('dust only thins out in a crowd: nothing moves when it starts or ends', () => {
  for (const [v, end] of [[DEP + 0.002, 0], [B.LAND + 0.03, 1]]) {
    const X = fakeX(v), Y = fakeX(v, { lite: true }), a = [], b = []
    X.ctx = sink(a)
    Y.ctx = sink(b)
    STYLE.floor(X, end)
    STYLE.floor(Y, end)
    const all = new Set(a)
    assert.ok(b.length > 0 && b.length < a.length, `core ${v}`)
    assert.deepEqual(b.filter(q => !all.has(q)), [])
  }
})

test('the items it asks for by phase', () => {
  assert.equal(M.need(fakeX(-0.1)), 0)
  assert.equal(M.need(fakeX(T.L_IN - 0.01, { hide: true })), 0)
  assert.equal(M.need(fakeX(0.3, { hide: true })), PART.TRIP | PART.SHADOW)
  assert.equal(M.need(fakeX(0.05)), PART.F0)
  assert.equal(M.need(fakeX(DEP + 0.002)), PART.TRIP | PART.SHADOW | PART.F0, 'the take-off dust settles')
  assert.equal(M.need(fakeX(0.5)), PART.TRIP | PART.SHADOW)
  assert.equal(M.need(fakeX(B.LAND)), PART.F1)
  assert.equal(M.need(fakeX(REL)), 0)
})

test('each new thread, once grown, climbs at 35 degrees or more: never a flat line across the scene', () => {
  // unit tile directions, on screen as the island draws them (16 px across, 8 down per tile)
  const dirs = [[-1, 0], [0, -1], [1, 0], [0.71, -0.71], [-0.71, 0.71], [-0.71, -0.71]]
  for (const len of [6, 12, 20, 30, 40])
    for (const [dx, dy] of dirs) {
      const x0 = 400, y0 = 450, x1 = x0 + len * (dx - dy) * 16, y1 = y0 + len * (dx + dy) * 8
      if (y1 < 120) continue // off the island's top rows
      const n = M.swings(len)
      for (let k = 0; k < n; k++) {
        const v = k ? DEP + ((k + B.GROW) / n) * (ARR - DEP) : B.SHOOT[1]
        const X = { ...fakeX(v, { len }), x0, y0, x1, y1 }, p = M.picture(X, X.L.v)
        const deg = (Math.atan2(p.hy - p.ay, Math.abs(p.ax - p.hx)) * 180) / Math.PI
        assert.ok(deg >= 35, `len ${len} ${[x0, y0, x1, y1]} swing ${k}: ${deg.toFixed(0)} deg`)
      }
    }
})
