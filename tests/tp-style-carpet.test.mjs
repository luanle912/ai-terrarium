// The flying carpet teleport style (web/tp-style-carpet.js): the beats on the core clock, the hand-overs between the
// floor, the rider and the flight, the items it asks for and the baked rasters. The drawing contract itself (budget,
// context, cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { Kit } = loadWeb('tp-kit')
const { CARPET: M, STYLE, carpetPixels, rollPixels, seatLift } = loadWeb('tp-style-carpet')
const { B } = M
const { T, DEP, ARR } = TL
const REL = T.RELEASE
const D = [0.9, 2.4, 0.7, 0.5]
const PART = Kit.PART

// A minimal X at core v: the landing up and to the left of the origin, mostly along the x axis.
function fakeX(v, { stool = false, hide = false, cut = null, lite = false } = {}) {
  const tp = { u: TL.real(v, D), d: D, swAt: DEP, cut, hide, stool, len: 18 }
  return {
    x0: 400, y0: 300, x1: 200, y1: 200, tx0: 20, ty0: 10, tx1: 5, ty1: 6,
    lite, night: false, snow: 0, tp, L: TL.phase(tp, false, TL.newPhase()),
    hash: (k, salt) => ((k * 37 + salt * 11) % 100) / 100,
  }
}
const pic = (v, o) => {
  const X = fakeX(v, o)
  return { ...M.picture(X, X.L.v, X.L.secs) }
}
const near = (a, b, keys, tol) => keys.every(k => Math.abs(a[k] - b[k]) <= tol)

test('the beats come in order, inside their segments', () => {
  assert.ok(B.POOF < B.THUD && B.THUD <= B.U0 && B.U0 < B.U1 && B.U1 <= B.SIT && B.SIT < B.LIVE && B.LIVE < B.LIFT)
  assert.ok(B.LIFT + B.PUFF <= DEP + 1e-9)
  const pass = (B.U0 + B.U1) / 2
  assert.ok(pass - B.HOP > B.U0 && pass + B.HOP < B.SIT, 'the hop over the roll is inside the unroll')
  for (const stool of [1, 2]) assert.ok(M.lift0(stool) > T.SQUEEZE + 0.05 && M.lift0(stool) < DEP)
  assert.ok(ARR < B.DOWN && B.DOWN < B.STAND && B.STAND < B.R0 && B.R0 < B.R1 && B.R1 < REL)
  assert.ok(B.DOWN + B.PUFF < REL, 'the touchdown puff settles before release')
  assert.ok(REL < B.JUMP && B.JUMP < B.GONE && B.GONE + 0.12 < T.END, 'the roll is gone before the end')
})

test('the carpet pops in rolled, unrolls under them as they hop, and they sit before it lifts', () => {
  assert.equal(pic(B.THUD).q, 1)
  assert.equal(pic(B.U1).q, 0)
  const mid = pic((B.U0 + B.U1) / 2)
  assert.ok(Math.abs(mid.q - 0.5) < 0.01 && mid.fy <= 300 - 5, 'hopping as the roll passes under the feet')
  assert.equal(pic(B.U0).fy, 300, 'standing before the hop')
  const sat = pic(B.SIT)
  assert.ok(sat.sit && sat.h === 0)
  assert.equal(pic(B.LIFT).h, 0)
  assert.ok(pic(B.LIFT + 0.03).h > 0.5)
})

test('rider and carpet hand over without a jump at take-off and arrival', () => {
  const keys = ['cx', 'cy', 'h', 'fx', 'fy']
  for (const stool of [false, 1, 2]) {
    const a = pic(DEP - 1e-9, { stool }), b = pic(DEP, { stool })
    assert.ok(near(a, b, keys, 2), `take-off (${stool}) ${JSON.stringify([a, b])}`)
    assert.ok(a.sit && b.sit)
  }
  const c = pic(ARR - 1e-9), d = pic(ARR)
  assert.ok(near(c, d, keys, 2), 'arrival')
  assert.equal(d.h, M.ARRH)
  assert.equal(pic(B.DOWN).h, 0, 'touched down')
  // a hidden start floats at take-off height, faded in from L_IN
  assert.equal(pic(T.L_IN, { hide: true }).ca, 0)
  assert.equal(pic(DEP - 0.04, { hide: true }).h, M.LIFT)
})

test('they step off standing on the landing, the carpet rolled up beside them', () => {
  const p = pic(REL - 1e-6)
  assert.ok(!p.sit && p.fx === 200 && p.fy === 200)
  assert.equal(p.q, 1)
  const mid = pic((B.R0 + B.R1) / 2)
  assert.ok(Math.abs(mid.q - 0.5) < 0.01 && mid.fy <= 200 - 5, 'hopping as the roll passes under the feet')
})

test('it flies high over the island and reports its real height', () => {
  assert.ok(pic(0.48).h >= 40)
  assert.ok(pic(DEP).h < 24 && pic(ARR).h < 24, 'low at both ends: sorts with the furniture')
})

test('the axis follows the trip, read every frame', () => {
  const X = fakeX(0.3)
  assert.deepEqual({ ...M.axis(X) }, { m: false, s: -1 })
  Object.assign(X, { tx1: 22, ty1: 30 })
  assert.deepEqual({ ...M.axis(X) }, { m: true, s: 1 })
})

test('the items it asks for by phase', () => {
  assert.equal(M.need(fakeX(-0.1)), PART.S0, 'queued: a twinkle where the roll will appear')
  assert.equal(M.need(fakeX(-0.1, { hide: true })), 0)
  assert.equal(M.need(fakeX(T.L_IN - 0.01, { hide: true })), 0, 'a hidden start shows nothing before L_IN')
  assert.equal(M.need(fakeX(0.3, { hide: true })), PART.TRIP | PART.F1)
  assert.equal(M.need(fakeX(0.005)), 0)
  assert.equal(M.need(fakeX(0.2)), PART.F0)
  assert.equal(M.need(fakeX(0.48)), PART.TRIP | PART.F1, 'its own shadow from the landing floor item')
  assert.equal(M.need(fakeX(B.STAND)), PART.F1)
  assert.equal(M.need(fakeX(B.GONE)), PART.F1, 'the roll twinkles out')
  assert.equal(M.need(fakeX(T.END - 0.01)), 0)
})

test('the rasters: a fringed carpet with its medallion, a rippling seat, a spiral roll; the bake fits', () => {
  const { CW, CX, CY } = M.CELL
  const flat = carpetPixels(-1, false), mir = carpetPixels(-1, true)
  assert.ok([7, 8].includes(flat[CY * CW + CX]) && flat.includes(8), 'the medallion at the middle')
  assert.ok(flat.includes(10) && flat.includes(9) && flat.includes(4), 'fringe, edge and border')
  assert.equal(mir.filter(Boolean).length, flat.filter(Boolean).length, 'the mirror keeps every pixel')
  assert.ok([0, 1, 2, 3].some(k => seatLift(k) !== 0), 'the seat rides the ripple')
  const shadow = carpetPixels(-2, false)
  assert.ok(shadow.every(c => c === 0 || c === 14))
  const roll = rollPixels(4, false)
  assert.ok(roll.includes(1) && roll.includes(4) && roll.includes(12), 'face, border and back in the roll')
  assert.ok(M.BAKE.w * M.BAKE.h <= 98304)
})

test('below the overlay the lifted carpet lies in the floor layer, so it never changes layer at touchdown', () => {
  // the bake needs a canvas (set here: i18n reads document while the page loads)
  globalThis.document ??= { createElement: () => ({ getContext: () => ({ fillRect() {}, fillStyle: '' }) }) }
  const stamps = (v, hook) => {
    let n = 0
    const X = Object.assign(fakeX(v), { stamp: () => n++, bodyAt() {} })
    X.ctx = { beginPath() {}, rect() {}, fill() {}, fillRect() {}, globalAlpha: 1, fillStyle: '' }
    hook(X)
    return n
  }
  for (const v of [DEP - 0.01, ARR + 0.01, ARR + 0.03]) {
    const end = v < DEP ? 0 : 1
    assert.ok(pic(v).h > 0.5, `lifted at ${v}`)
    assert.equal(stamps(v, X => STYLE.person(X)), 0, `no carpet with the rider at ${v}`)
    assert.equal(stamps(v, X => STYLE.floor(X, end)), 2, `its shade and the carpet on the floor at ${v}`)
  }
  const mid = DEP + 0.5 * (ARR - DEP)
  assert.ok(pic(mid).h >= 24)
  assert.equal(stamps(mid, X => STYLE.trip(X)), 1, 'high up: the carpet with the rider')
  assert.equal(stamps(mid, X => STYLE.floor(X, 1)), 1, 'its shade only')
})
