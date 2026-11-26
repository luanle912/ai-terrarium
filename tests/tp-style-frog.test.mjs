// The frog teleport style (web/tp-style-frog.js): the hop rhythm along the route and the sprite sheet. The drawing
// contract itself (budget, context, cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { FROG } = loadWeb('tp-style-frog')
const { hopAt, hopCount, SPR, FW, FH, GH } = FROG

test('the frog moves forward only, from the start to the landing, and is on the ground at every touchdown', () => {
  for (const n of [3, 5, 8]) {
    const o = {}
    let last = -1
    for (let t = 0; t <= 1; t += 1 / 400) {
      hopAt(t, n, o)
      assert.ok(o.p >= last - 1e-12, `n ${n} t ${t}: back from ${last} to ${o.p}`)
      assert.ok(o.up >= 0 && o.up <= 1)
      last = o.p
    }
    assert.equal(hopAt(0, n, o).p, 0)
    assert.equal(o.up, 0)
    assert.equal(hopAt(1, n, o).p, 1)
    assert.equal(o.up, 0)
    for (let k = 1; k < n; k++) {
      hopAt(k / n, n, o)
      assert.equal(o.up, 0, `touchdown ${k} on the ground`)
      assert.equal(o.p, k / n)
      assert.ok(o.land >= 0 && o.land <= 2 * GH, 'dust from the touchdown')
    }
    assert.equal(hopAt(0.5 / n, n, o).up, 1, 'the top of the first hop')
    assert.equal(hopAt(GH / 2 / n, n, o).land, -1, 'no dust before the first touchdown')
  }
})

test('a hop about every 0.3 s of trip, none over 4.5 tiles, three to fourteen of them, higher when longer', () => {
  assert.equal(hopCount(10, 1.2).n, 4)
  assert.equal(hopCount(24, 2.4).n, 8)
  assert.equal(hopCount(3, 0.4).n, 3)
  assert.equal(hopCount(58, 2.4).n, 13)
  assert.equal(hopCount(100, 2.4).n, 14)
  for (const [len, s] of [[10, 1.25], [24.5, 2.4], [33, 2.4], [58, 2.4]]) {
    const { n } = hopCount(len, s), o = {}
    let gap = 0
    for (let t = 0; t <= 1; t += 1e-4) gap = Math.max(gap, Math.abs(hopAt(t, n, o).p - t))
    assert.ok(gap * len <= 0.46, `${len} tiles: drawn ${gap * len} tiles from the trip item's sort point`)
  }
  assert.ok(hopCount(58, 2.4).h > hopCount(20, 2.4).h)
  for (const [len, s] of [[2, 1.2], [58, 2.4], [24.5, 2.4]]) {
    const { h } = hopCount(len, s)
    assert.ok(h >= 8 && h <= 26, `${len} tiles: ${h} px`)
  }
})

test('every frog pose fits its sprite cell, with the keyline closing the bottom row', () => {
  assert.equal(SPR.length, 5)
  for (const rows of SPR) {
    assert.ok(rows.length <= FH)
    for (const row of rows) {
      assert.equal(row.length, FW)
      assert.match(row, /^[.oglbdwkys]+$/)
    }
    assert.match(rows.at(-1), /^[.o]+$/, 'the feet row is keyline')
  }
})

test('a hidden start asks for the trip item from L_IN for its poof; the hiccup follows the walker after the release', () => {
  const { STYLE } = loadWeb('tp-style-frog')
  const { TeleportLogic: TL } = loadWeb('teleport-logic')
  const { Kit } = loadWeb('tp-kit')
  const { T, DEP } = TL
  const L = { q: 0, v: (T.L_IN + DEP) / 2, trip: -1, sw: false, hide: true, C: 1 }
  assert.ok(STYLE.need({ L }) & 64)
  assert.equal(STYLE.need({ L: { ...L, hide: false } }) & 64, 0)
  // walked 3 tiles on from the landing, mid-hiccup
  const rects = [], a = { x: 8.5, y: 6.5, seated: false }
  const ctx = new Proxy({}, { get: (_, k) => (k === 'rect' ? (...r) => rects.push(r) : () => {}), set: () => true })
  const X = { L: { q: 0, v: T.RELEASE + 0.05, trip: -1, sw: true, cut: null, C: 1 }, a, ctx, lite: false, x1: 0, y1: 0 }
  assert.equal(STYLE.person(X), false, 'the page draws the walker')
  const f = Kit.feet(a.x, a.y)
  assert.ok(rects.length > 0, 'a bubble')
  for (const [x, y] of rects) assert.ok(Math.abs(x - f[0]) <= 8 && y < f[1] - 15 && y > f[1] - 40, `${x},${y} over the head`)
})
