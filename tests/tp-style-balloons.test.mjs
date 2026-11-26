// The balloons teleport style (web/tp-style-balloons.js): the beats on the core clock, the feet's height through
// take-off and the plop, the hand-overs between the ends and the flight, the pops and the items it asks for. The
// drawing contract itself (budget, context, cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { BALLOONS: M, balloonPixels } = loadWeb('tp-style-balloons')
const { B, N } = M
const { T, DEP, ARR } = TL
const REL = T.RELEASE

// A minimal X: the landing up and to the left of the origin.
function fakeX(L, tp = {}) {
  return {
    x0: 400, y0: 300, x1: 200, y1: 200, tx0: 20, ty0: 10, tx1: 5, ty1: 6, lite: false, night: false, snow: 0,
    tp: { stool: false, len: 18, ...tp },
    L: { q: 0, v: 0, trip: -1, hide: false, sw: false, C: 1, secs: 1.3, ...L },
  }
}
const pic = (L, tp) => ({ ...M.picture(fakeX(L, tp)) })

test('the beats come in order and a stool sitter grips and lifts only once off the stool', () => {
  assert.ok((N - 1) * B.EACH + B.GROW < B.GRIP, 'every balloon is full before the grip')
  assert.ok(B.GRIP < B.HOLD && B.HOLD < B.LIFT && B.LIFT + B.PUFF < DEP)
  for (const stool of [false, 1, 2]) {
    assert.ok(M.grip0(stool) < M.hold(stool) && M.hold(stool) <= M.lift0(stool) && M.lift0(stool) < DEP)
    if (stool) assert.ok(M.grip0(stool) >= T.SQUEEZE)
  }
  assert.ok(ARR < B.LOW && B.LOW <= B.POP && M.popAt(N - 1) < B.FLOOR && B.FLOOR + B.SQUASH < REL)
  assert.ok(B.FLOOR + B.PUFF < REL, 'the plop puff settles before release')
  assert.ok(M.popAt(N - 1) + B.FALL < B.LIE && B.LIE < B.OUT && B.OUT < T.END, 'scraps settle, fade and are gone')
  assert.deepEqual([...M.ORDER].sort(), [0, 1, 2, 3, 4], 'each balloon pops once')
})

test('the feet leave the floor at the lift, float in, sink a pixel a pop and land at the plop', () => {
  const x = fakeX({})
  assert.equal(M.feetUp(x, B.LIFT - 0.01), 0)
  assert.ok(Math.abs(M.feetUp(x, DEP - 1e-9) - M.LIFT) < 1e-6)
  assert.equal(M.feetUp(x, ARR), M.ARRH)
  assert.equal(M.feetUp(x, B.POP - 1e-9), M.HOVER)
  for (let k = 0; k < N - 1; k++) assert.equal(M.feetUp(x, M.popAt(k) + 1e-6), M.HOVER - 1 - k)
  assert.equal(M.feetUp(x, B.FLOOR), 0)
  for (let v = ARR; v < B.FLOOR; v += 0.004) assert.ok(M.feetUp(x, v + 0.004) <= M.feetUp(x, v) + 1e-9, 'never up')
  assert.equal(M.popped(B.POP - 1e-6), 0)
  assert.equal(M.popped(M.popAt(N - 1) + 1e-6), N)
})

test('body, knot and bunch hand over without a jump at departure and arrival', () => {
  const near = (a, b, k) => Math.abs(a[k] - b[k]) <= 1
  for (const stool of [false, 1, 2]) {
    const a = pic({ v: DEP - 1e-9 }, { stool }), b = pic({ v: DEP, trip: 0, sw: true }, { stool })
    for (const k of ['bx', 'by', 'kx', 'ky']) assert.ok(near(a, b, k), `take-off ${k} (${stool})`)
    assert.ok(a.up && b.up)
    assert.equal(a.by, 300 - M.LIFT)
  }
  const c = pic({ v: ARR - 1e-9, trip: 1, sw: true }), d = pic({ v: ARR, sw: true })
  for (const k of ['bx', 'by', 'kx', 'ky']) assert.ok(near(c, d, k), `arrival ${k}`)
  assert.equal(d.bx, 200)
  // a hidden start floats at take-off height, faded in from L_IN
  const h = pic({ v: T.L_IN, hide: true }), h1 = pic({ v: DEP - 0.03, hide: true })
  assert.equal(h.a, 0)
  assert.equal(h1.a, 1)
  assert.equal(h1.by, 300 - M.LIFT)
})

test('it floats high over the island, and reports its real height to the dispatcher', () => {
  const w = { ...M.where(fakeX({ v: 0.48, trip: 0.5, sw: true })) }
  assert.ok(w.h >= M.cruise(18), 'cruising')
  assert.ok(M.cruise(2) >= 30 && M.cruise(60) <= 80)
  assert.equal(M.where(fakeX({ v: DEP, trip: 0, sw: true })).h, M.LIFT, 'low at take-off: sorts with the furniture')
  // reads the current tp's length every frame
  const short = M.where(fakeX({ v: 0.48, trip: 0.5, sw: true }, { len: 4 })).h
  assert.ok(short < w.h)
})

test('balloons fill one by one, are all there in flight and pop in their order on arrival', () => {
  const count = L => {
    const x = fakeX(L)
    M.picture(x)
    return M.shown()
  }
  assert.equal(count({ v: 0 }), 1)
  assert.equal(count({ v: B.EACH * 2 + 1e-6 }), 3)
  assert.equal(count({ v: B.GRIP }), N)
  assert.equal(count({ v: 0.48, trip: 0.5, sw: true }), N)
  assert.equal(count({ v: B.POP - 1e-6, sw: true }), N)
  assert.equal(count({ v: M.popAt(1) + 1e-6, sw: true }), N - 2)
  assert.equal(count({ v: M.popAt(N - 1) + 1e-6, sw: true }), 0)
})

test('the baked balloons are outlined, lit and knotted, and grow with the size frame', () => {
  const ink = s => balloonPixels(s).reduce((n, c) => n + (c > 0), 0)
  assert.ok(ink(0) < ink(1) && ink(1) < ink(2))
  for (const s of [1, 2]) {
    const px = balloonPixels(s)
    for (const c of [1, 2, 3, 4, 5]) assert.ok(px.includes(c), `size ${s} has colour code ${c}`)
  }
})

test('what it asks for: the hand balloon queued, puffs and shadows at the ends, the flight, pops and scraps', () => {
  const { S0, F0, F1, S1, TRIP, SHADOW } = loadWeb('tp-kit').Kit.PART
  const need = (L, tp) => M.need(fakeX(L, tp))
  assert.equal(need({ q: 1, v: -0.1 }), S0)
  assert.equal(need({ q: 1, v: -0.1, hide: true }), 0, 'a queued stall user stays hidden')
  assert.equal(need({ v: T.L_IN - 0.01, hide: true }), 0, 'nothing while hidden in the stall')
  assert.equal(need({ v: T.L_IN + 0.02, hide: true }), TRIP | SHADOW, 'no origin floor for a hidden start')
  assert.equal(need({ v: 0.05 }), 0, 'filling balloons: drawn with the person')
  assert.equal(need({ v: B.LIFT + 0.01 }), F0, 'feet shadow and puff at the origin')
  assert.equal(need({ v: DEP - 0.005 }), F0, 'the feet shadow until the trip takes them')
  for (const stool of [1, 2]) assert.equal(need({ v: DEP - 0.005 }, { stool }), F0, `stool ${stool}`)
  assert.equal(need({ v: 0.48, trip: 0.5, sw: true }), TRIP | SHADOW)
  assert.equal(need({ v: ARR + 0.01, sw: true }), F1)
  assert.equal(need({ v: B.POP + 0.01, sw: true }), F1 | S1, 'pops and scraps')
  assert.equal(need({ v: B.OUT, sw: true }), 0, 'gone')
})
