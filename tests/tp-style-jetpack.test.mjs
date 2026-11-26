// The jetpack teleport style (web/tp-style-jetpack.js): the beats on the core clock, the hand-overs between the ends
// and the flight, the pack leaving before the release, the smoke's purity, the items it asks for and the landing
// cloud's hand-over to its marks. The drawing contract itself is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { TpStyles } = loadWeb('tp-styles')
const { Kit } = loadWeb('tp-kit')
const { JETPACK: M, STYLE, packPixels } = loadWeb('tp-style-jetpack')
const { B } = M
const { T, DEP, ARR } = TL
const REL = T.RELEASE
const D = TpStyles.durs('jetpack', 20)
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
  return { ...M.picture(X, X.L.v, X.L.secs) }
}
const near = (a, b, keys, tol) => keys.every(k => Math.abs(a[k] - b[k]) <= tol)

test('the beats come in order, inside their segments', () => {
  assert.ok(B.DROP < B.CLANK && B.CLANK < B.SET && B.SET < B.COUGH[0] && B.COUGH[1] < B.IGN)
  assert.ok(B.CROUCH < B.IGN && B.IGN < B.LIFT && B.LIFT < DEP)
  assert.ok(ARR < B.HIT && B.HIT < B.DOWN && B.DOWN < B.OFF && B.OFF < B.GONE && B.GONE < REL)
  assert.ok(B.HIC[0] < B.HIC[1] && B.HIC[1] + 0.08 < 1, 'the hiccup is over before the trip ends')
  assert.ok(TL.real(DEP, D) - TL.real(B.IGN, D) < M.CLOUD, 'the take-off cloud outlives the departure')
})

test('body and pack hand over without a jump at take-off and arrival', () => {
  const keys = ['fx', 'fy', 'px', 'py']
  for (const stool of [false, 1, 2]) {
    const a = pic(DEP - 1e-9, { stool }), b = pic(DEP, { stool })
    assert.ok(near(a, b, keys, 2), `take-off (${stool}) ${JSON.stringify([a, b])}`)
    assert.equal(b.fy, 300 - M.LIFT)
    assert.ok(a.n > 0 && b.n > 0, 'flames on through the hand-over')
  }
  const c = pic(ARR - 1e-9), d = pic(ARR)
  assert.ok(near(c, d, keys, 2), 'arrival')
  assert.equal(d.fy, 200 - M.ARRH)
  assert.equal(pic(B.DOWN + 1e-9).fy, 200, 'touched down')
  assert.equal(pic(B.DOWN + 1e-9).n, 0, 'flames cut at touchdown')
  // a hidden start floats at take-off height, faded in from L_IN
  assert.equal(pic(T.L_IN, { hide: true }).a, 0)
  assert.equal(pic(DEP - 0.03, { hide: true }).a, 1)
})

test('the pack is on their back from the clank to the unclip, and gone before the release', () => {
  assert.equal(pic(B.DROP - 0.001).pa, 0, 'not yet dropped')
  const on = pic(B.SET + 0.01)
  assert.equal(on.py, on.base - M.PACKY)
  assert.ok(pic(B.DROP + 0.01).py < on.base - M.PACKY - 20, 'falling in from above')
  assert.ok(pic(B.OFF - 0.03).on && !pic(B.OFF + 0.01).on)
  assert.equal(pic(B.GONE).pa, 0)
  assert.ok(pic(B.GONE).py < 200 - 90, 'rocketed up out of the way')
})

test('it keeps its own facing from touchdown, so the walker goes on the same way', () => {
  for (const dirFront of [true, false]) {
    assert.equal(pic(REL - 1e-6, { dirFront }).front, null)
    assert.equal(pic(B.DOWN + 1e-9, { dirFront }).front, null)
  }
  assert.equal(pic(0.48).front, false, 'away from the camera in flight: the pack shows')
  assert.equal(pic(B.LIFT + 1e-9).front, false, 'turned that way as the feet leave the floor')
})

test('it flies high, reports its real height, and drops in the hiccup on a long trip only', () => {
  const mid = pic(DEP + 0.3 * (ARR - DEP)).h
  assert.ok(mid >= M.cruise(20), 'cruising')
  assert.ok(pic(DEP).h < 24 && pic(ARR).h < 24, 'low at both ends: sorts with the furniture')
  const at = t => DEP + t * (ARR - DEP), hic = (B.HIC[0] + B.HIC[1]) / 2
  assert.ok(pic(at(hic), { len: 20 }).n <= 2 && pic(at(hic), { len: 20 }).pose === 'up')
  assert.ok(pic(at(hic), { len: 4 }).n >= 9, 'no hiccup on a short hop')
})

test('smoke is pure in the clock, none in a cut, thinner in a crowd', () => {
  const X = fakeX(0.47), list = [...M.trail(X)]
  assert.ok(list.length >= 15, `${list.length / 3} puffs`)
  assert.deepEqual([...M.trail(X)], list)
  assert.ok(M.trail(fakeX(0.47, { lite: true })).length < list.length)
  assert.equal(M.trail(fakeX(B.SET)).length, 0, 'none before ignition')
  assert.equal(M.trail(fakeX(0.3, { cut: TL.real(0.3, D) })).length, 0)
  assert.ok(M.soot(fakeX(B.COUGH[0] + 0.01)).length > 0, 'a cough')
})

test('the items it asks for by phase', () => {
  assert.equal(M.need(fakeX(-0.1)), 0, 'queued: drawn as usual')
  assert.equal(M.need(fakeX(T.L_IN - 0.01, { hide: true })), 0, 'a hidden start shows nothing before L_IN')
  assert.equal(M.need(fakeX(0.3, { hide: true })), PART.TRIP | PART.SHADOW)
  assert.equal(M.need(fakeX(0.005)), PART.F0, 'the remapped body has no shadow of its own: theirs from the start')
  assert.equal(M.need(fakeX(0.45)), PART.TRIP | PART.SHADOW | PART.S0, 'the take-off cloud rolls on behind')
  assert.equal(M.need(fakeX(0.5)), PART.TRIP | PART.SHADOW)
  assert.equal(M.need(fakeX(B.DOWN)), PART.F1)
  assert.equal(M.need(fakeX(REL)), 0, 'the marks take over')
})

test('the landing cloud hands over to its two marks at its own age', () => {
  assert.ok(Math.abs(M.AT_REL - (TL.real(REL, D) - TL.real(B.HIT, D))) < 1e-9)
  assert.equal(STYLE.marks.length, 2)
  assert.deepEqual(STYLE.marks.map(m => [m.at, m.end, m.layer]), [['rel', 1, 'back'], ['rel', 1, 'stand']])
  for (const m of STYLE.marks) assert.ok(Math.abs(m.ttl - (M.CLOUD1 - M.AT_REL)) < 1e-9 && m.ttl > 1)
})

test('the pack raster: 16 x 12, known colours only, a nozzle under each tank', () => {
  assert.equal(M.ROWS.length, 12)
  for (const row of M.ROWS) {
    assert.equal(row.length, 16, row)
    for (const ch of row) assert.ok(ch === '.' || M.KEYS.includes(ch), ch)
  }
  const px = packPixels(), at = (x, y) => px[y * 16 + x]
  for (const j of M.JET) assert.ok(at(8 + j, 10) > 0 && at(8 + j + 1, 10) > 0, `nozzle at ${j}`)
  assert.equal(at(8, 10), 0, 'nothing between the nozzles')
})

// person() on a context that records its rects and a bodyAt that records the feet.
const sink = rects => new Proxy({}, { get: (_, k) => (k === 'rect' ? (...a) => rects.push(a.join()) : () => {}), set: () => true })
globalThis.document ??= { createElement: () => ({ getContext: () => sink([]) }) }
function drawn(v, o) {
  const X = fakeX(v, o), rects = [], feet = []
  X.ctx = sink(rects)
  X.stamp = () => {}
  X.bodyAt = (x, y) => feet.push([x, y])
  return { ret: STYLE.person(X), rects, feet }
}

test('a hidden start is drawn through the whole arrival, not only in flight', () => {
  for (const v of [ARR, (ARR + B.DOWN) / 2, B.OFF, REL - 1e-3]) {
    const d = drawn(v, { hide: true })
    assert.equal(d.ret, true)
    assert.equal(d.feet.length, 1, `a body at core ${v}`)
  }
  assert.deepEqual(drawn(B.OFF, { hide: true }).feet, drawn(B.OFF).feet, 'the same landing as a seen start')
})

test('the landing cloud is the same in a crowd, so its marks take over without a reshuffle', () => {
  // a crowd only thins the trail (every other puff), so all it draws is drawn without one too
  for (const v of [B.OFF, REL - 1e-3]) {
    const all = new Set(drawn(v).rects)
    assert.deepEqual(drawn(v, { lite: true }).rects.filter(q => !all.has(q)), [], `core ${v}`)
  }
})
