// The trampoline teleport style (web/tp-style-trampoline.js): the beats on the core clock, the hand-overs between
// the mat, the flight and the landing, the somersault, the wake's purity and the items it asks for. The drawing
// contract itself (budget, context, cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { Kit } = loadWeb('tp-kit')
const { TpStyles } = loadWeb('tp-styles')
const { TRAMPOLINE: M, STYLE, trampolinePixels } = loadWeb('tp-style-trampoline')
const { B, RIM } = M
const { T, DEP, ARR } = TL
const REL = T.RELEASE
const D = TpStyles.durs('trampoline', 18)
const PART = Kit.PART

// A minimal X at core v: the landing up and to the left of the origin, so they fly leftwards (side -1).
function fakeX(v, { stool = false, hide = false, cut = null, lite = false, len = 18, dirFront = false, u } = {}) {
  const tp = { u: u ?? TL.real(v, D), d: D, swAt: DEP, cut, hide, stool, len }
  return {
    x0: 400, y0: 300, x1: 200, y1: 200, tx0: 20, ty0: 10, tx1: 5, ty1: 6, dir1: [-0.9, -0.4],
    lite, night: false, snow: 0, tp, a: { dirFront }, L: TL.phase(tp, false, TL.newPhase()),
    hash: (k, salt) => (((k * 37 + salt * 11) % 100) + 100) % 100 / 100,
  }
}
// A hook on a context that records its rects; body passes record the feet and the facing.
const sink = rects => new Proxy({}, { get: (_, k) => (k === 'rect' ? (...a) => rects.push(a.join()) : () => {}), set: () => true })
globalThis.document ??= { createElement: () => ({ getContext: () => sink([]) }) }
function drawn(v, o, hook = 'person', end = 0) {
  const X = fakeX(v, o), rects = [], feet = []
  X.ctx = sink(rects)
  X.stamp = () => {}
  X.bodyAt = (x, y, b) => feet.push([x, y, b.front])
  X.body = b => feet.push([o?.end ? 200 : 400, o?.end ? 200 : 300, b.front])
  return { ret: STYLE[hook](X, end), rects, feet }
}
const pic = (v, o) => {
  const X = fakeX(v, o)
  return { ...M.picture(X, X.L.v) }
}
const near = (a, b, keys, tol) => keys.every(k => Math.abs(a[k] - b[k]) <= tol)

test('the beats come in order: up, bounce, bounce, launch; land, arms up, arms down before the release', () => {
  for (const list of [M.BOUNCES, M.STOOL, M.HIDDEN]) {
    for (let k = 0; k < list.length; k++) {
      assert.ok(list[k][0] < list[k][1])
      if (k) assert.equal(list[k][0], list[k - 1][1], 'no gap between bounces')
    }
    assert.equal(list.at(-1)[1], DEP, 'the last dip ends at the launch')
    assert.equal(list.at(-1)[2], 0)
  }
  assert.ok(B.RISE < B.UP && B.UP <= M.BOUNCES[0][0])
  assert.ok(M.STOOL[0][0] > T.SQUEEZE, 'a stool sitter is off the stool first')
  assert.equal(M.HIDDEN[0][0], T.L_IN, 'a hidden start bounces from the moment it shows')
  assert.ok(ARR < B.LAND && B.LAND < B.POP && B.POP < B.DOWN && B.DOWN < REL)
  assert.ok(M.FOLD.WOBBLE < M.FOLD.SINK && M.FOLD.SINK < M.FOLD.GONE && M.FOLD.GONE < M.FOLD.DUST)
  assert.ok(M.FOLD.DUST < TpStyles.BY_ID.trampoline.tmin, 'folded away before the shortest flight lands')
})

test('the feet hand over without a jump at the launch and the touchdown', () => {
  const keys = ['fx', 'fy']
  for (const o of [{}, { stool: 1 }, { stool: 2 }, { hide: true }]) {
    const a = pic(DEP - 1e-9, o), b = pic(DEP, o)
    assert.ok(near(a, b, keys, 1), `launch ${JSON.stringify([o, a, b])}`)
    assert.equal(b.fy, 300 - RIM, 'off the mat')
  }
  const c = pic(ARR - 1e-9), d = pic(ARR)
  assert.ok(near(c, d, keys, 1), 'touchdown')
  assert.equal(d.fy, 200)
  assert.ok(d.legs < 1 || pic(ARR + 0.01).legs < 1, 'crouched on landing')
  assert.equal(pic(B.POP - 0.05).pose, 'up', 'arms raised')
  assert.equal(pic(REL - 1e-6).pose, 'stand', 'arms down before the walker takes over')
  assert.equal(pic(REL - 1e-6).fy, 200)
})

test('on the mat: the feet ride its lift and sag, and a cut lowers them back to the floor', () => {
  const up = pic(B.UP + 0.005)
  assert.equal(up.fy, 300 - up.lift + up.dip - Math.round(up.h - up.lift + up.dip))
  const dip = pic((M.BOUNCES[2][0] + DEP) / 2)
  assert.ok(dip.dip >= 3 && dip.legs < 0.7, 'the deep dip before the launch')
  assert.equal(dip.fy, 300 - dip.lift + dip.dip)
  const mid = pic((M.BOUNCES[1][0] + M.BOUNCES[1][1]) / 2 + 0.03)
  assert.ok(mid.h > 10, 'the second bounce is high')
  // the rewind's last frames: the trampoline has gone and they stand on the floor
  const X = fakeX(0.3, { cut: TL.real(0.3, D) })
  X.tp.u = X.tp.cut + T.CUT - 1 / 60
  X.L = TL.phase(X.tp, false, TL.newPhase())
  const p = M.picture(X, X.L.v)
  assert.ok(300 - p.fy <= 1, `${300 - p.fy} px up at the end of a cut`)
  assert.equal(pic(0.05, { stool: 1 }).lift, 0, 'a stool sitter has no trampoline yet')
})

test('one big bounce: high over the island, low at both ends, a somersault at the top', () => {
  const top = pic(0.48)
  assert.ok(top.h >= M.hump(18) * 0.9, 'cruising')
  assert.ok(M.hump(2) >= 40 && M.hump(60) <= 110)
  for (const v of [DEP, ARR - 1e-6, ARR + 0.01, 0.2]) assert.ok(pic(v).h < 24, `low at ${v}: sorts with the furniture`)
  assert.equal(M.flips(8), 1)
  assert.equal(M.flips(30), 2)
  // quarter turns through the somersault: every turn shows, head first leftwards, and upright after
  for (const [len, n] of [[8, 1], [30, 2]]) {
    const turns = []
    for (let t = 0; t <= 1; t += 0.002) {
      const p = pic(DEP + t * (ARR - DEP), { len })
      if (turns.at(-1) !== p.rot) turns.push(p.rot)
    }
    assert.deepEqual(turns, [0, ...Array.from({ length: n }, () => [3, 2, 1, 0]).flat()], `${len}: ${turns}`)
  }
  assert.ok(pic(0.48).legs < 1, 'tucked')
})

test('the wake is pure in the clock, thinner in a crowd, and only in flight', () => {
  const X = fakeX(0.48), list = [...M.wake(X)]
  assert.ok(list.length >= 10, `${list.length / 2} dots`)
  assert.deepEqual([...M.wake(X)], list)
  assert.ok(M.wake(fakeX(0.48, { lite: true })).length < list.length)
  assert.equal(M.wake(fakeX(0.3)).length, 0)
  assert.equal(M.wake(fakeX(ARR + 0.2)).length, 0, 'gone once the last dot of the flight has faded')
})

test('the items it asks for by phase', () => {
  const O = PART.B0 | PART.F0 | PART.S0, F = PART.TRIP | PART.SHADOW
  assert.equal(M.need(fakeX(-0.1)), 0, 'queued: nothing')
  assert.equal(M.need(fakeX(0.005)), 0, 'before the rise')
  assert.equal(M.need(fakeX(0.1)), O)
  assert.equal(M.need(fakeX(0.1, { stool: 1 })), 0, 'a stool sitter waits for SQUEEZE')
  assert.equal(M.need(fakeX(0.3, { stool: 1 })), O)
  assert.equal(M.need(fakeX(T.L_IN - 0.01, { hide: true })), 0)
  assert.equal(M.need(fakeX(0.3, { hide: true })), F)
  assert.equal(M.need(fakeX(DEP + 0.002)), O | F, 'the trampoline folds away behind them')
  assert.equal(M.need(fakeX(0.5)), F)
  assert.equal(M.need(fakeX(0.5, { hide: true })), F)
  assert.equal(M.need(fakeX(0.7)), PART.F1)
  assert.equal(M.need(fakeX(REL)), 0)
  const cut = { stool: 1, cut: TL.real(0.3, D), u: TL.real(0.3, D) + T.CUT * 0.6 }
  assert.equal(M.need(fakeX(0, cut)), O, 'a cut keeps the trampoline while it sinks')
})

test('the raster: the mat sits inside the pad, the front part holds only the near rim', () => {
  const back = trampolinePixels(false), front = trampolinePixels(true), at = (px, x, y) => px[y * 16 + x]
  assert.equal(at(back, 8, 4), 1, 'mat at the middle')
  assert.equal(at(front, 8, 4), 0)
  assert.ok([4, 5].includes(at(back, 8, 0)), 'far pad in the back part')
  assert.ok([4, 5].includes(at(front, 8, 6)), 'near pad in front')
  assert.ok([6, 7].includes(at(front, 8, 8)), 'and its face')
  let w = 0
  for (let x = 0; x < 16; x++) w += at(back, x, 3) || at(front, x, 6) ? 1 : 0
  assert.ok(w <= 16, `${w} px wide: no wider than a person and a half`)
  for (let k = 0; k < back.length; k++) assert.ok(!(back[k] && front[k]), 'no pixel in both parts')
})

test('it keeps its own facing from the arms coming down, so the walker goes on the same way', () => {
  for (const dirFront of [true, false])
    for (const hide of [false, true]) {
      assert.equal(drawn(REL - 1e-6, { dirFront, hide }).feet[0][2], null)
      assert.equal(drawn(B.DOWN + 1e-6, { dirFront, hide }).feet[0][2], null)
    }
  assert.equal(drawn(B.POP).feet[0][2], true, 'arms up to the camera')
})

test('a stool sitter\'s cut lowers them onto the floor before the walker takes over', () => {
  for (const stool of [1, 2])
    for (const c of [0.3, 0.36]) {
      const cut = TL.real(c, D)
      let prev = null
      for (let u = cut; u < cut + T.CUT; u += 1 / 60) {
        const d = drawn(0, { stool, cut, u })
        const y = d.ret ? d.feet[0][1] : 'walker'
        if (prev != null && prev !== 'walker' && y !== 'walker') assert.ok(Math.abs(y - prev) <= 3, `${prev} -> ${y}`)
        if (prev != null && prev !== 'walker' && y === 'walker') assert.ok(300 - prev <= 1, `stool ${stool} cut ${c}: ${prev}`)
        prev = y
      }
      assert.equal(prev, 'walker', 'seated again at the end')
    }
})

test('dust and stars only thin out in a crowd: nothing moves when it starts or ends', () => {
  for (const [v, hook, end] of [[0.02, 'floor', 0], [ARR + 0.02, 'floor', 1], [B.POP, 'person', 0]]) {
    const all = new Set(drawn(v, {}, hook, end).rects), few = drawn(v, { lite: true }, hook, end).rects
    assert.ok(few.length > 0 && few.length < all.size, `core ${v}`)
    assert.deepEqual(few.filter(q => !all.has(q)), [], `core ${v}`)
  }
})

test('a mid-flip flier does not hand its turn to the next person on the mat', () => {
  let vf = DEP
  while (vf < ARR && !pic(vf).rot) vf += 0.001
  assert.ok(pic(vf).rot, 'a flip frame exists')
  const rots = (v, o, hook) => {
    const X = fakeX(v, o), out = []
    X.ctx = sink([])
    X.stamp = () => {}
    X.bodyAt = (x, y, b) => out.push(b.rot)
    X.body = b => out.push(b.rot)
    STYLE[hook](X, 0)
    return out
  }
  rots(vf, {}, 'trip')
  assert.deepEqual(rots(0.1, {}, 'person'), [null], 'a person on the mat')
  rots(vf, {}, 'trip')
  assert.deepEqual(rots(0.1, { hide: true }, 'trip'), [null], 'a hidden start')
})
