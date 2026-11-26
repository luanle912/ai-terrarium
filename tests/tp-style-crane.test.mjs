// The crane teleport style (web/tp-style-crane.js): the beats on the core clock, where the crane is at each hand-over,
// how high the feet are, the folding frames and the items it asks for. The drawing contract itself (budget, context,
// cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { CRANE: M, STYLE, cranePixels } = loadWeb('tp-style-crane')
const { B, F } = M
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
const at = (L, tp) => ({ ...M.where(fakeX(L, tp)) })
const close = (a, b) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && Math.abs(a.h - b.h) <= 1

test('the beats come in order and a stool sitter is grabbed and lifted only once off the stool', () => {
  assert.ok(0 < B.REACH && B.REACH < B.SWOOP && B.SWOOP < B.GRAB && B.GRAB < B.LIFT && B.LIFT + B.PUFF < DEP)
  for (const stool of [false, 1, 2]) {
    assert.ok(M.reach0(stool) < M.grab(stool) && M.grab(stool) < M.lift0(stool) && M.lift0(stool) < DEP)
    if (stool) assert.ok(M.reach0(stool) >= T.SQUEEZE)
  }
  assert.ok(ARR < B.LOW && B.LOW < B.LET && B.LET < B.FLOOR && B.FLOOR + B.PUFF < REL && B.FLOOR < B.RISEN)
  assert.ok(REL < B.FOLD0 && B.FOLD0 < B.FOLD1 && B.FOLD1 < B.SHRINK && B.SHRINK < B.GONE && B.GONE < B.OUT)
  assert.ok(B.OUT < T.END, 'nothing left at the end')
})

test('the feet leave the floor at the lift, hang at take-off height in flight and land at the floor beat', () => {
  const x = fakeX({})
  assert.equal(M.feetUp(x, B.LIFT - 0.01), 0)
  assert.ok(Math.abs(M.feetUp(x, DEP - 1e-9) - M.LIFT) < 1e-6)
  assert.ok(Math.abs(M.feetUp(x, ARR) - M.LIFT) < 1e-9)
  assert.equal(M.feetUp(x, B.LET), M.HOLD)
  assert.equal(M.feetUp(x, B.FLOOR), 0)
  for (let v = ARR; v < B.FLOOR; v += 0.005) assert.ok(M.feetUp(x, v + 0.005) <= M.feetUp(x, v) + 1e-9, 'never back up')
})

test('the crane hands over without a jump and always flies high enough for the overlay', () => {
  for (const stool of [false, 1, 2]) {
    const a = at({ v: DEP - 1e-9 }, { stool }), b = at({ v: DEP, trip: 0, sw: true }, { stool })
    assert.ok(close(a, b), `take-off (${stool})`)
    assert.equal(a.x, 400)
    assert.equal(a.y, 300 - M.HANG - M.LIFT)
  }
  const c = at({ v: ARR - 1e-9, trip: 1, sw: true }), d = at({ v: ARR, sw: true })
  assert.ok(close(c, d), 'arrival')
  assert.equal(d.x, 200)
  assert.ok(at({ v: 0.48, trip: 0.5, sw: true }).h >= M.HANG + M.LIFT + M.cruise(18) - 2, 'cruises over the island')
  assert.ok(M.cruise(2) >= 24 && M.cruise(60) <= 70)
  // ground(): the hanging feet's height while trip() draws the body (low near the ends sorts with the furniture, as
  // person() did), the overlay otherwise
  const X = fakeX({}), out = [0, 0, 0]
  for (let v = -0.2; v < B.OUT; v += 0.01) {
    const trip = (v - DEP) / (ARR - DEP)
    Object.assign(X.L, v < DEP ? { v, q: v < 0 ? 1 : 0, trip: -1, sw: false } : v < ARR ? { v, q: 0, trip, sw: true }
      : { v, q: 0, trip: -1, sw: true })
    assert.ok(STYLE.ground(X, out), `ground at ${v.toFixed(2)}`)
    if (X.L.trip >= 0) assert.equal(out[2], M.where(X).h - M.HANG, `feet height at ${v.toFixed(2)}`)
    else assert.ok(out[2] >= 24, `overlay at ${v.toFixed(2)}`)
  }
  assert.ok(STYLE.ground(fakeX({ v: DEP + 0.01, trip: 0.01, sw: true }), out) && out[2] < 24, 'low at take-off')
  assert.ok(STYLE.ground(fakeX({ v: 0.3, hide: true }), out) && out[2] === M.LIFT, 'a hidden start hangs low')
})

test('it swoops in from behind the flight, carries them in flight, and lets go at the release beat', () => {
  const q = at({ q: 1, v: -0.1 })
  assert.ok(q.x > 400 && q.h > M.HANG + 40 && q.a === M.QA && [F.LEVEL, F.MID].includes(q.f), 'queued high, gliding')
  assert.equal(at({ v: 0.2 }).a, 1)
  assert.ok(!at({ v: B.GRAB - 0.01 }).pass && at({ v: B.GRAB }).pass)
  assert.ok(at({ v: 0.48, trip: 0.5, sw: true }).pass)
  assert.ok(at({ v: B.LET - 0.001, sw: true }).pass && !at({ v: B.LET, sw: true }).pass)
  assert.equal(at({ v: B.LET + 0.01, sw: true }).f, F.UP, 'a big flap as it lets go')
  assert.ok(at({ v: B.RISEN, sw: true }).y < at({ v: B.LET, sw: true }).y, 'and climbs clear')
})

test('it folds away: wings together, the bird base, a square that shrinks', () => {
  const f = v => at({ v, sw: true }).f
  const seq = []
  for (let v = B.FOLD0; v < B.GONE; v += 0.004) if (seq.at(-1) !== f(v)) seq.push(f(v))
  assert.deepEqual(seq, [F.CLOSE, F.KITE, F.SQ, F.SQS, F.SQT])
  const ink = k => cranePixels(k, false).reduce((n, c) => n + (c > 0), 0)
  assert.ok(ink(F.KITE) > ink(F.SQ) && ink(F.SQ) > ink(F.SQS) && ink(F.SQS) > ink(F.SQT) && ink(F.SQT) > 0)
})

test('the frames are outlined and face both ways', () => {
  const W = 48
  for (let k = 0; k < 9; k++) {
    const r = cranePixels(k, false), l = cranePixels(k, true)
    assert.ok(r.some(c => c === 1) && r.some(c => c > 1), `frame ${k} has an outline and paper`)
    for (let j = 0; j < r.length; j += W) assert.deepEqual([...l.slice(j, j + W)], [...r.slice(j, j + W)].reverse())
  }
  // a flight frame is a big bird: wider than a person by far
  const up = cranePixels(F.LEVEL, false), cols = new Set()
  up.forEach((c, i) => c && cols.add(i % W))
  assert.ok(cols.size >= 36)
})

test('what it asks for: the crane, its shadow apart from the feet shadow, and the puffs at each end', () => {
  const need = (L, tp) => M.need(fakeX(L, tp))
  assert.equal(need({ q: 1, v: -0.1 }), 64)
  assert.equal(need({ q: 1, v: -0.1, hide: true }), 0, 'a queued stall user stays hidden')
  assert.equal(need({ v: T.L_IN - 0.01, hide: true }), 0, 'nothing while hidden in the stall')
  assert.equal(need({ v: T.L_IN + 0.02, hide: true }) & 4, 0, 'no origin floor for a hidden start')
  assert.equal(need({ v: 0.05 }), 64 | 128, 'gliding in, with its shadow')
  assert.equal(need({ v: B.LIFT + 0.01 }), 64 | 4, 'feet shadow and puff at the origin')
  assert.equal(need({ v: DEP - 0.005 }), 64 | 4, 'the feet shadow until the trip takes them')
  for (const stool of [1, 2]) assert.equal(need({ v: DEP - 0.005 }, { stool }) & 4, 4, `stool ${stool}`)
  assert.equal(need({ v: 0.48, trip: 0.5, sw: true }), 64 | 128)
  assert.equal(need({ v: B.FLOOR + 0.01, sw: true }), 64 | 8, 'landing puff')
  assert.equal(need({ v: REL - 0.005, sw: true }), 64 | 8, 'the feet shadow until they walk off')
  assert.equal(need({ v: B.FOLD0 + 0.05, sw: true }), 64 | 128)
  assert.equal(need({ v: B.OUT, sw: true }), 0, 'gone')
})

test('the wind dashes stream behind a sideways flight, never hang under a steep one like drips', () => {
  const rects = (x1, y1, trip) => {
    let n = 0
    const X = Object.assign(fakeX({ v: 0.48, trip, sw: true }), { x1, y1 })
    X.ctx = { beginPath() {}, rect: () => n++, fill() {}, globalAlpha: 1, fillStyle: '' }
    M.wake(X, M.where(X))
    return n
  }
  for (const trip of [0.3, 0.5, 0.7]) {
    assert.ok(rects(150, 290, trip) > 0, `sideways at ${trip}`)
    assert.equal(rects(385, 80, trip), 0, `up the screen at ${trip}`)
    assert.equal(rects(380, 520, trip), 0, `down the screen at ${trip}`)
  }
})
