// The lamp teleport style (web/tp-style-lamp.js): the beats on the core clock, where the lamp is at each hand-over,
// how the body is sucked in and grows back, and the items it asks for. The drawing contract itself (budget, context,
// cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { LAMP: M, lampPixels } = loadWeb('tp-style-lamp')
const { B } = M
const { T, DEP, ARR } = TL
const REL = T.RELEASE

// A minimal X: the landing up and to the left of the origin, so the lamp sits to the right and faces left.
function fakeX(L, tp = {}) {
  return {
    x0: 400, y0: 300, x1: 200, y1: 200, tx0: 20, ty0: 10, tx1: 5, ty1: 6,
    tp: { stool: false, len: 18, ...tp },
    L: { q: 0, v: 0, trip: -1, hide: false, sw: false, C: 1, secs: 1.3, ...L },
  }
}
const lampAt = (L, tp) => ({ ...M.where(fakeX(L, tp)) })
const close = (a, b) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && Math.abs(a.a - b.a) < 1e-6

test('the beats come in order and a stool sitter is pulled only once off the stool', () => {
  assert.ok(0 < B.POP && B.POP < B.CALL && B.CALL < B.SUCK0 && B.SUCK0 < B.SUCK1 && B.SUCK1 < DEP)
  assert.equal(M.s0(false), B.SUCK0)
  for (const stool of [1, 2]) assert.ok(M.s0(stool) >= T.SQUEEZE && M.s0(stool) < B.SUCK1)
  assert.ok(ARR < B.TOUCH && B.LID0 < B.LID1 && B.POUR0 < B.FORM0 && B.FORM0 < B.FORM1)
  assert.ok(B.FORM1 < B.WHOLE && B.WHOLE < B.UP && B.UP < REL, 'the person whole before the release')
  assert.ok(REL < B.HOP && B.HOP < B.POOF && B.POOF < B.GONE && B.GONE < T.END)
})

test('the lamp hands over without a jump: departure to flight, flight to arrival', () => {
  for (const stool of [false, 1, 2]) {
    const a = lampAt({ v: DEP - 1e-9 }, { stool }), b = lampAt({ v: DEP, trip: 0, sw: true }, { stool })
    assert.ok(close(a, b), `take-off (${stool})`)
    assert.equal(b.h, 0)
  }
  const c = lampAt({ v: ARR - 1e-9, trip: 1, sw: true }), d = lampAt({ v: ARR, sw: true })
  assert.ok(close(c, d) && c.tilt === 0 && d.tilt === 0, 'touch-down')
  const mid = lampAt({ v: 0.48, trip: 0.5, sw: true })
  assert.ok(mid.h >= M.flyH(18) - 2, 'flies high over the island')
  assert.ok(M.flyH(2) >= 40 && M.flyH(60) <= 96)
})

test('the lamp sits beside the feet on the side it flies in from, its spout towards them', () => {
  const o = lampAt({ v: 0.1 }), l = lampAt({ v: B.TOUCH, sw: true })
  assert.equal(o.s, -1, 'flies left, so faces left')
  assert.equal(o.x, 400 + M.SIDE)
  assert.equal(l.x, 200 + M.SIDE, 'lands on the side it came from')
  assert.ok(o.gx + o.gy > 30, 'in front of the person at the origin')
  // Facing right, the spout rises on the right (its tip above the handle); the mirrored copy is its mirror image.
  const R = lampPixels(0, false, 0), L = lampPixels(0, true, 0), W = 26, H = R.length / W
  const top = i => { for (let j = 0; j < H; j++) if (R[j * W + i]) return j; return H }
  let lo = W, hi = -1
  for (let i = 0; i < W; i++) if (top(i) < H) ((lo = Math.min(lo, i)), (hi = Math.max(hi, i)))
  assert.ok(hi - 13 > 13 - lo - 2 && top(hi) < top(lo), 'the spout reaches out and up on the right')
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) assert.equal(!!R[j * W + i], !!L[j * W + W - 1 - i])
})

test('a stall user has no lamp until L_IN, a firm one by the take-off; the queued lamp waits dimmed', () => {
  assert.equal(lampAt({ v: T.L_IN, hide: true }).a, 0)
  assert.ok(Math.abs(lampAt({ v: DEP - 1e-9, hide: true }).a - 1) < 1e-6)
  assert.ok(lampAt({ v: 0 }).a === M.QA && lampAt({ v: B.POP }).a === 1)
  assert.ok(lampAt({ v: B.GONE, sw: true }).a === 0, 'gone in the poof')
})

test('the body is sucked from the feet into the spout and grows back out of it', () => {
  const X = fakeX({})
  let f = { ...M.shape(X, 0, B.SUCK0) }
  assert.ok(f.x === 400 && f.y === 300 && Math.abs(f.sx - 1) < 1e-9 && !f.tint && f.on, 'starts as they stand')
  f = { ...M.shape(X, 0, B.SUCK1 - 1e-6) }
  assert.ok(f.tint && f.sx < 0.2 && f.a < 0.05, 'a wisp at the spout')
  assert.equal(M.shape(X, 0, B.SUCK1).on, false)
  assert.equal(M.shape(X, 1, B.FORM0 - 1e-6).on, false)
  f = { ...M.shape(X, 1, B.FORM0) }
  assert.ok(f.on && f.tint && f.sx < 0.2 && Math.abs(f.x - (200 + M.SIDE - M.TIP[0])) <= 1, 'out of the spout')
  f = { ...M.shape(X, 1, B.FORM1) }
  assert.ok(f.x === 200 && f.y === 200 && Math.abs(f.sx - 1) < 1e-9 && f.tint, 'the smoke shape at the feet')
  assert.equal(M.shape(X, 1, B.WHOLE).tint, false)
})

test('items: the queued lamp, nothing for a stall user before L_IN, the far swirl at each end, nothing after', () => {
  const n = L => M.need(fakeX(L))
  assert.equal(n({ q: 1, v: -0.1 }), 16)
  assert.equal(n({ v: 0.2, hide: true }), 0)
  assert.equal(n({ v: T.L_IN + 0.01, hide: true }), 64)
  assert.equal(n({ v: DEP - 0.01, hide: true }), 64 | 128)
  assert.equal(n({ v: 0.02 }), 64 | 128)
  assert.equal(n({ v: B.SUCK0 }), 64 | 128 | 1)
  assert.equal(n({ v: 0.48, trip: 0.5, sw: true }), 64 | 128)
  assert.equal(n({ v: B.FORM0, sw: true }), 64 | 128 | 2)
  assert.equal(n({ v: B.POOF + 0.04, sw: true }), 64)
  assert.equal(n({ v: B.GONE, sw: true }), 0)
})

test('it lands on the side it flies in from, unless a desk in front would hide it there', () => {
  const { BLOCK } = loadWeb('office-scene')
  const tile = q => Math.floor(q[2]) + ',' + Math.floor(q[3])
  // open floor: the side it flies in from (right of the feet, facing left), at both ends
  const open = fakeX({ v: ARR + 0.1, sw: true })
  assert.equal(M.faceAt(open, 0), -1)
  assert.equal(M.faceAt(open, 1), -1)
  // in front of desk 12's row, flying in from the right: the next desk's monitor would cover it, so it goes left
  const desk = { ...fakeX({ v: ARR + 0.1, sw: true }), tx1: 14.5, ty1: 8.5 }
  assert.equal(M.faceAt(desk, 0), -1, 'the start is never moved')
  assert.equal(M.faceAt(desk, 1), 1)
  const q = [...M.spot(desk, 1)]
  assert.ok(q[0] < desk.x1, 'left of the feet')
  assert.ok(!BLOCK.has(tile(q)), 'not inside a desk either')
  assert.equal(lampAt({ v: ARR + 0.1, sw: true }).s, -1)
  assert.equal(M.where({ ...desk, L: { ...desk.L } }).s, 1, 'the spout to the feet')
})
