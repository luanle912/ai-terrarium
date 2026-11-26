// The star lantern teleport style (web/tp-style-starlantern.js): the beats on the core clock, where the lantern is at
// each hand-over, how high the feet are, the hidden start's arrival, the raster and the items it asks for. The drawing
// contract itself (budget, context, cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { Kit } = loadWeb('tp-kit')
const { STARLANTERN: M, STYLE, starPixels } = loadWeb('tp-style-starlantern')
const { B } = M
const { T, DEP, ARR } = TL
const REL = T.RELEASE
const P = Kit.PART

// A minimal X: the landing up and to the left of the origin; bodies are counted, not drawn.
function fakeX(L, tp = {}) {
  const X = {
    x0: 400, y0: 300, x1: 200, y1: 200, tx0: 20, ty0: 10, tx1: 5, ty1: 6, lite: false, night: false, snow: 0,
    tp: { stool: false, len: 18, ...tp },
    L: { q: 0, v: 0, trip: -1, hide: false, sw: false, C: 1, secs: 1.3, ...L },
    bodies: [],
  }
  X.body = o => X.bodies.push({ ...o })
  X.bodyAt = (px, py, o) => X.bodies.push({ px, py, ...o })
  return X
}
const at = (L, tp) => ({ ...M.where(fakeX(L, tp)) })
const close = (a, b) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && Math.abs(a.h - b.h) <= 1

test('the beats come in order, a stool sitter reaches only once off the stool, and nothing is left at the end', () => {
  assert.ok(0 < B.REACH && B.REACH < B.DROP && B.DROP < B.GRAB && B.GRAB < B.LIFT && B.LIFT < DEP)
  for (const stool of [false, 1, 2]) {
    assert.ok(M.reach0(stool) < M.grab(stool) && M.grab(stool) < M.lift0(stool) && M.lift0(stool) < DEP)
    if (stool) assert.ok(M.reach0(stool) >= T.SQUEEZE)
  }
  assert.ok(ARR < B.TOUCH && B.TOUCH < B.LET && B.LET < B.DOWN && B.DOWN < REL && B.TOUCH + B.PUFF < REL)
  assert.ok(REL < B.DIM && B.DIM < B.GONE && B.GONE < B.OUT && B.OUT < T.END, 'gone before the end')
  assert.equal(M.need(fakeX({ v: B.OUT, sw: true })), 0)
})

test('the feet leave the floor at the lift, hang at take-off height in flight and touch down at the touch beat', () => {
  const x = fakeX({})
  assert.equal(M.feetUp(x, B.LIFT - 0.01), 0)
  assert.ok(Math.abs(M.feetUp(x, DEP - 1e-9) - M.LIFT) < 1e-6)
  assert.ok(Math.abs(M.feetUp(x, ARR) - M.LIFT) < 1e-9)
  assert.equal(M.feetUp(x, B.TOUCH), 0)
  for (let v = ARR; v < B.TOUCH; v += 0.005) assert.ok(M.feetUp(x, v + 0.005) <= M.feetUp(x, v) + 1e-9, 'never back up')
})

test('the lantern hands over without a jump, flies high enough for the overlay and rises away after the let-go', () => {
  for (const stool of [false, 1, 2]) {
    const a = at({ v: DEP - 1e-9 }, { stool }), b = at({ v: DEP, trip: 0, sw: true }, { stool })
    assert.ok(close(a, b), `take-off (${stool})`)
    assert.equal(a.x, 400)
    assert.equal(a.y, 300 - M.HANG - M.LIFT)
    assert.ok(a.pass && b.pass)
  }
  const c = at({ v: ARR - 1e-9, trip: 1, sw: true }), d = at({ v: ARR, sw: true })
  assert.ok(close(c, d), 'arrival')
  assert.equal(d.x, 200)
  assert.ok(at({ v: 0.48, trip: 0.5, sw: true }).h >= M.HANG + M.LIFT + M.cruise(18) - 2, 'cruises over the island')
  // queued: high up, faint and a size smaller; then it settles over their hands
  const q = at({ q: 1, v: -0.1 })
  assert.ok(q.h > M.HANG + M.SKY - 4 && q.a === M.QA && q.size === 1)
  assert.equal(at({ v: B.GRAB }).size, 0)
  assert.ok(!at({ v: B.GRAB - 0.01 }).pass && at({ v: B.GRAB }).pass)
  // let go: no passenger, climbing, smaller, then gone
  assert.ok(at({ v: B.LET - 0.01, sw: true }).pass && !at({ v: B.LET, sw: true }).pass)
  let h = 0
  for (let v = B.LET; v < B.GONE; v += 0.01) {
    const w = at({ v, sw: true })
    assert.ok(w.h >= h, 'only climbs')
    h = w.h
  }
  assert.equal(at({ v: B.GONE - 0.01, sw: true }).size, 2)
  assert.equal(at({ v: B.GONE, sw: true }).a, 0)
})

test('ground(): the hanging feet while trip() draws the body, the overlay otherwise', () => {
  const X = fakeX({}), out = [0, 0, 0]
  for (let v = -0.2; v < B.OUT; v += 0.01) {
    const trip = (v - DEP) / (ARR - DEP)
    Object.assign(X.L, v < DEP ? { v, q: v < 0 ? 1 : 0, trip: -1, sw: false } : v < ARR ? { v, q: 0, trip, sw: true }
      : { v, q: 0, trip: -1, sw: true })
    assert.ok(STYLE.ground(X, out))
    if (X.L.trip >= 0) assert.equal(out[2], M.where(X).h - M.HANG, `feet height at ${v.toFixed(2)}`)
    else assert.ok(out[2] >= 24, `overlay at ${v.toFixed(2)}`)
  }
  assert.ok(STYLE.ground(fakeX({ v: 0.3, hide: true }), out) && out[2] === M.LIFT, 'a hidden start hangs low')
})

test('a hidden start: nothing before L_IN, hanging from L_IN, then it lands like anyone else', () => {
  for (const v of [0.1, T.L_IN - 0.005]) assert.equal(M.need(fakeX({ v, hide: true })), 0)
  const X = fakeX({ v: T.L_IN + 0.04, hide: true })
  assert.ok(M.need(X) & P.TRIP && !(M.need(X) & P.F0), 'no origin floor item in the stall')
  assert.equal(STYLE.person(X), true)
  assert.equal(X.bodies.length, 0, 'the walker draws nothing')
  assert.ok(M.where(X).pass && M.where(X).a > 0 && M.where(X).a < 1, 'fading in, holding on')
  // the arrival draws the body every frame until the walker takes over (FRAMEWORK-NOTES section 5)
  for (let v = ARR; v < REL; v += 0.01) {
    const Y = fakeX({ v, hide: true, sw: true })
    assert.equal(STYLE.person(Y), true)
    assert.equal(Y.bodies.length, 1, `body at ${v.toFixed(2)}`)
    assert.ok(M.need(Y) & P.F1, `feet shadow at ${v.toFixed(2)}`)
  }
  assert.equal(STYLE.person(fakeX({ v: REL, hide: true, sw: true })), false)
})

test('the person: on their own feet first, arms up to the handle, the facing handed back before the release', () => {
  const pose = (L, tp) => {
    const X = fakeX(L, tp)
    STYLE.person(X)
    return X.bodies[0]
  }
  assert.equal(pose({ v: B.REACH - 0.01 }).pose, undefined)
  assert.equal(pose({ v: B.REACH }).pose, 'up')
  assert.equal(pose({ v: T.SQUEEZE - 0.01 }, { stool: 1 }).pose, undefined, 'still seated')
  const held = pose({ v: B.LET - 0.01, sw: true }), down = pose({ v: B.DOWN, sw: true })
  assert.ok(held.pose === 'up' && held.front === true)
  assert.ok(down.pose === 'stand' && down.front === null && down.py === 200)
  assert.equal(STYLE.person(fakeX({ v: 0.48, trip: 0.5, sw: true })), true, 'in flight trip() draws them')
  // the feet's shadow for every frame bodyAt stands or hangs at an end
  for (let v = B.REACH; v < DEP; v += 0.01) assert.ok(M.need(fakeX({ v })) & P.F0)
  for (let v = ARR; v < REL; v += 0.01) assert.ok(M.need(fakeX({ v, sw: true })) & P.F1)
  assert.equal(M.need(fakeX({ q: 1, v: -0.1 })), P.TRIP, 'queued: only the lantern')
})

test('the raster: a symmetric five-pointed star, a glowing middle, tassels from the four lower points', () => {
  const z = M.SZ[0], px = starPixels(0)
  for (let j = 0; j < z.h; j++)
    for (let i = 1; i < z.w; i++) {
      const m = 2 * z.ax - i
      if (m >= 0 && m < z.w) assert.equal(!!px[j * z.w + i], !!px[j * z.w + m], `mirror at ${i},${j}`)
    }
  const count = c => px.filter(k => k === c).length
  assert.ok(count(7) > 0 && count(6) > count(7), 'glow and candle heart')
  assert.ok(count(5) > 10, 'bamboo ridges')
  assert.equal(count(10), 4, 'a knot per lower point')
  assert.ok(count(8) > 0 && count(9) > 0)
  assert.ok(px.slice(0, z.w).every(c => !c) && px.slice(-z.w).every(c => !c), 'room above and below in the cell')
  for (const t of [-2, 2]) assert.notDeepEqual(starPixels(0, t), px, 'tilted frames differ')
  assert.notDeepEqual(starPixels(0, 0, 1), px, 'the tassels flutter')
  assert.equal(starPixels(2).filter(k => k >= 8).length, 0, 'no tassels on the smallest')
})
