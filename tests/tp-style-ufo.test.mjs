// The ufo teleport style (web/tp-style-ufo.js): the beats on the core clock, where the saucer is at each hand-over,
// the beam and the body in it, and the items it asks for. The drawing contract itself (budget, context, cuts, crowds)
// is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { UFO: M, saucerPixels } = loadWeb('tp-style-ufo')
const { B } = M
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

test('the beats come in order and a stool sitter is lifted only once off the stool', () => {
  assert.ok(0 < B.SPOT0 && B.SPOT0 < B.SWOOP && B.BEAM0 < B.BEAM1 && B.BEAM1 <= B.RISE0)
  assert.ok(B.RISE0 < B.RISE1 && B.RISE1 <= B.SHUT0 && B.SHUT0 < B.SHUT1 && B.SHUT1 < DEP)
  assert.equal(M.s0(false), B.RISE0)
  for (const stool of [1, 2]) assert.ok(M.s0(stool) >= T.SQUEEZE && M.s0(stool) < B.RISE1)
  assert.ok(ARR < B.ON0 && B.ON0 < B.ON1 && B.LOW0 < B.LOW1 && B.LOW1 < B.CUT && B.CUT < B.FLOOR)
  assert.ok(B.FLOOR < B.DIZZY && B.DIZZY < REL, 'dizzy before the release')
  assert.ok(REL < B.ZIP0 && B.ZIP0 < B.ZIP1 && B.ZIP1 < B.STARS && B.STARS < T.END)
})

test('the saucer hands over without a jump and always flies high enough for the overlay', () => {
  for (const stool of [false, 1, 2]) {
    const a = at({ v: DEP - 1e-9 }, { stool }), b = at({ v: DEP, trip: 0, sw: true }, { stool })
    assert.ok(close(a, b), `take-off (${stool})`)
    assert.equal(a.x, 400)
    assert.equal(a.y, 300 - M.HOV)
  }
  const c = at({ v: ARR - 1e-9, trip: 1, sw: true }), d = at({ v: ARR, sw: true })
  assert.ok(close(c, d) && c.tilt === 0 && d.tilt === 0, 'arrival')
  assert.equal(d.x, 200)
  const mid = at({ v: 0.48, trip: 0.5, sw: true })
  assert.ok(mid.h >= M.HOV + M.cruise(18) - 2, 'cruises over the island')
  assert.ok(M.cruise(2) >= 18 && M.cruise(60) <= 60)
  for (let v = -0.2; v < B.ZIP1; v += 0.01) {
    const trip = (v - DEP) / (ARR - DEP)
    const L = v < DEP ? { v, q: v < 0 ? 1 : 0 } : v < ARR ? { v, trip, sw: true } : { v, sw: true }
    assert.ok(at(L).h >= 24, `overlay height at ${v.toFixed(2)}`)
  }
})

test('the swoop comes in from the far side and the zip leaves towards the landing side, then it is gone', () => {
  const q = at({ q: 1, v: -0.1 }), z = at({ v: B.ZIP1, sw: true })
  assert.ok(q.x > 400 && q.h > M.HOV && q.a === M.QA, 'queued high on the far side, dimmed')
  assert.equal(at({ v: 0.2 }).a, 1)
  assert.ok(z.x < 200 && z.a === 0, 'gone up and to the left')
  assert.equal(at({ v: T.L_IN, hide: true }).a, 0, 'a stall user has no saucer before L_IN')
  assert.equal(at({ v: DEP - 1e-9, hide: true }).a, 1)
})

test('the beam: off queued and in flight, a flicker as it snaps on, full while they ride it, off at the cut', () => {
  const n = (L, end) => M.reach(fakeX(L), end)
  assert.equal(n({ q: 1, v: -0.1 }, 0), 0)
  assert.equal(n({ v: B.BEAM0 - 1e-6 }, 0), 0)
  assert.equal(n({ v: B.BEAM0 + 0.005 }, 0), 0, 'the flicker')
  const full = n({ v: B.RISE0 }, 0)
  assert.ok(full > 40 && n({ v: B.RISE1 - 0.01 }, 0) === full)
  assert.equal(n({ v: B.SHUT1 }, 0), 0)
  assert.equal(n({ v: B.SHUT0 }, 0), full)
  assert.equal(n({ v: B.SHUT0, hide: true }, 0), 0, 'no beam for a stall user')
  assert.equal(n({ v: 0.48, trip: 0.5, sw: true }, 1), 0)
  assert.equal(n({ v: B.LOW0 + 0.05, sw: true }, 1), full)
  assert.equal(n({ v: B.CUT, sw: true }, 1), 0)
})

test('the body rises from the feet into the belly and comes down to drop on the feet', () => {
  const X = fakeX({})
  let f = { ...M.lifted(X, 0, B.RISE0) }
  assert.ok(f.x === 400 && f.y === 300 && f.s === 1 && f.on, 'starts as they stand')
  f = { ...M.lifted(X, 0, B.RISE1) }
  assert.ok(f.y === 300 - M.BELLY && !f.on, 'all inside the hull')
  f = { ...M.lifted(X, 1, B.LOW0) }
  assert.ok(f.x === 200 && f.y === 200 - M.BELLY && !f.on, 'still inside')
  f = { ...M.lifted(X, 1, B.LOW1) }
  assert.ok(f.y === 200 - M.DROP && f.on && f.s > 0.85, 'a hand over the floor')
  f = { ...M.lifted(X, 1, B.FLOOR) }
  assert.ok(f.y === 200 && f.s === 1, 'on the floor')
})

test('items: the queued saucer, nothing for a stall user before L_IN, the beam at each end, nothing once gone', () => {
  const n = L => M.need(fakeX(L))
  assert.equal(n({ q: 1, v: -0.1 }), 64)
  assert.equal(n({ v: 0.2, hide: true }), 0)
  assert.equal(n({ v: T.L_IN + 0.01, hide: true }), 64)
  assert.equal(n({ v: 0.02 }), 64 | 128)
  assert.equal(n({ v: B.RISE0 }), 64 | 128 | 1 | 4 | 16)
  assert.equal(n({ v: 0.48, trip: 0.5, sw: true }), 64 | 128)
  assert.equal(n({ v: B.LOW0, sw: true }), 64 | 128 | 2 | 8 | 32)
  assert.equal(n({ v: B.DIZZY, sw: true }), 64 | 128)
  assert.equal(n({ v: B.ZIP1, sw: true }), 0)
})

test('the saucer art: a dome over a wide hull, lights that take turns', () => {
  const W = 32, H = 16, a = saucerPixels(0, 0), b = saucerPixels(0, 1)
  const rows = px => [...Array(H).keys()].filter(j => px.slice(j * W, j * W + W).some(Boolean))
  const wide = j => a.slice(j * W, j * W + W).filter(Boolean).length
  const r = rows(a)
  assert.ok(wide(r[0]) < 10 && Math.max(...r.map(wide)) >= 28, 'a dome on top, a wide hull')
  const lit = px => px.filter(c => c === 11).length
  assert.ok(lit(a) > 0 && lit(b) > 0 && a.some((c, k) => (c === 11) !== (b[k] === 11)), 'lights blink in turn')
})

test('the speed lines stream behind a sideways flight, never hang under a steep one like drips', () => {
  const rects = (x1, y1, trip) => {
    let n = 0
    const X = Object.assign(fakeX({ v: 0.48, trip, sw: true }), { x1, y1 })
    X.ctx = { beginPath() {}, rect: () => n++, fill() {}, globalAlpha: 1, fillStyle: '' }
    M.trail(X, M.where(X))
    return n
  }
  for (const trip of [0.3, 0.5, 0.7]) {
    assert.ok(rects(150, 290, trip) > 0, `sideways at ${trip}`)
    assert.equal(rects(385, 80, trip), 0, `up the screen at ${trip}`)
    assert.equal(rects(380, 520, trip), 0, `down the screen at ${trip}`)
  }
})
