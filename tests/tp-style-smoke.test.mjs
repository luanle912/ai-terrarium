// The smoke style (web/tp-style-smoke.js): who shows when, which items are live, and the baked puff shape.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
const noop = () => {}
const NOOP = new Proxy({}, { get: () => noop, set: () => true })
const M = loadWeb('tp-style-smoke')
const { STYLE, personAt, puffPixels, RING, CELL, SEEN } = M
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { TpStyles } = loadWeb('tp-styles')
const { T } = TL

test('the person: arms up with the bomb, thrown, hidden in the cloud, up from a crouch, then as usual', () => {
  assert.equal(personAt(-0.1, false, false), SEEN.USUAL, 'queued')
  assert.equal(personAt(0.05, false, false), SEEN.UP)
  assert.equal(personAt(0.05, false, 1), SEEN.USUAL, 'a stool sitter throws from the stool')
  assert.equal(personAt(0.17, false, false), SEEN.USUAL, 'throwing')
  for (const c of [0.26, 0.4, 0.48, 0.55]) assert.equal(personAt(c, false, false), SEEN.HIDE, `hidden at ${c}`)
  assert.equal(personAt(0.62, false, false), SEEN.RISE)
  for (const c of [0.8, T.LAND, T.RELEASE, 1.2]) assert.equal(personAt(c, false, false), SEEN.USUAL, `at ${c}`)
  // a hidden starter is never seen before the landing cloud opens
  for (const c of [0.3, 0.45, 0.55]) assert.equal(personAt(c, true, false), SEEN.HIDE)
  assert.equal(personAt(0.62, true, false), SEEN.RISE)
})

test('need: nothing while queued, the origin from the start, the landing before a hidden starter begins', () => {
  const d = TpStyles.durs('smoke', 20)
  const need = (u, over = {}) => {
    const tp = { u, d, cut: null, hide: false, swAt: T.SWITCH, ...over }
    return STYLE.need({ L: TL.phase(tp, false, TL.newPhase()), tp })
  }
  assert.equal(need(-0.2), 0)
  assert.equal(need(0.01) & 21, 21)
  assert.equal(need(0.01) & 42, 0)
  const hiddenStart = TL.real(TL.DEP, d) - TL.DEP + T.L_IN
  assert.equal(need(hiddenStart) & 42, 42, 'landing items live when a hidden starter begins')
})

test('a puff is a round raster inside its cell: a dark lip on the lower rim, a lighter top', () => {
  for (let R = 2; R <= 9; R++) {
    const px = puffPixels(R), c = CELL >> 1
    let n = 0
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++) {
        if (!px[y * CELL + x]) continue
        n++
        assert.ok(Math.hypot(x - c, y - c) <= R + 0.6, `R ${R}: (${x}, ${y}) outside`)
      }
    assert.ok(n > 2.5 * R * R, `R ${R}: filled`)
    assert.equal(px[(c + R) * CELL + c], 1, `R ${R}: lip at the bottom`)
    assert.notEqual(px[(c - R) * CELL + c], 1, `R ${R}: no lip on top`)
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++)
        assert.equal(!!px[y * CELL + x], !!px[y * CELL + 2 * c - x], `R ${R}: round (${x}, ${y})`)
  }
})

test('a cloud body: the puff footprint without its lip, ringed by an outline one px out', () => {
  const c = CELL >> 1
  for (let R = 2; R <= 9; R++) {
    const wisp = puffPixels(R), body = puffPixels(R, true), ring = new Set()
    for (let j = 0; j < RING[R].length; j += 3) {
      const [dy, h, w] = RING[R].slice(j, j + 3)
      for (let y = dy; y < dy + h; y++) for (let x = -w; x <= w; x++) ring.add(`${x},${y}`)
    }
    assert.ok(RING[R].length / 3 < 2 * R + 3, `R ${R}: rows of equal width merged`)
    for (let y = -c; y < c; y++)
      for (let x = -c; x < c; x++) {
        const i = (c + y) * CELL + c + x
        assert.equal(!!body[i], !!wisp[i], `R ${R}: same footprint (${x}, ${y})`)
        assert.notEqual(body[i], 1, `R ${R}: no lip in a body`)
        if (body[i]) assert.ok(ring.has(`${x},${y}`), `R ${R}: ring under the body at (${x}, ${y})`)
        let near = false
        for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) near ||= !!body[(c + y + v) * CELL + c + x + u]
        if (ring.has(`${x},${y}`)) assert.ok(near, `R ${R}: ring at (${x}, ${y}) is more than one px out`)
      }
  }
})

test('a cut rewinds without the hold-up: no raised arms, no bomb in the hand', () => {
  const d = TpStyles.durs('smoke', 20), cut = TL.real(0.3, d)
  globalThis.document ??= { createElement: () => ({ getContext: () => NOOP }) }
  for (let u = cut; u < cut + T.CUT; u += 0.01) {
    const tp = { u, d, cut, hide: false, swAt: T.SWITCH, stool: false }
    const L = TL.phase(tp, false, TL.newPhase()), poses = [], bombs = []
    const X = {
      L, tp, a: { x: 10.5, y: 8.5, stool: false }, ctx: NOOP, lite: false, snow: 0, df: 1,
      x0: 100, y0: 200, x1: 300, y1: 200, tx0: 10.5, ty0: 8.5, tx1: 3.5, ty1: 4.5,
      hash: () => 0.5,
      body: o => poses.push(o.pose),
      stamp: (img, sx) => sx === 8 * CELL && bombs.push(u),
    }
    STYLE.person(X)
    STYLE.stand(X, 0)
    assert.ok(!poses.includes('up'), `arms up at v ${L.v.toFixed(3)}`)
    assert.equal(bombs.length, 0, `bomb at v ${L.v.toFixed(3)}`)
  }
})
