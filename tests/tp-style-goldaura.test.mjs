// The gold aura (web/tp-style-goldaura.js): its beats on the core clock hand the person back to the page with no
// pop, and its baked frames stay inside their cells.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const G = loadWeb('tp-style-goldaura')
const { FLASH, GONE, POP, REL } = G.BEATS
const { T, DEP, ARR } = TL
const clocks = (a, b) => Array.from({ length: Math.round((b - a) / 0.005) }, (_, j) => a + j * 0.005)

test('the beats fall in order inside their segments', () => {
  assert.ok(0 < FLASH && FLASH < GONE && GONE < DEP)
  assert.ok(ARR < POP && POP < REL)
  assert.equal(REL, T.RELEASE)
})

test('at the landing the gold hair, the spikes and the aura are gone before the release', () => {
  for (const v of clocks(REL - 0.03, T.END)) {
    assert.equal(G.goldOf(v, 1), 0, `gold at ${v}`)
    assert.equal(G.spikeOf(v, 1), 0, `spikes at ${v}`)
    assert.equal(G.auraOf(v, 1), 0, `aura at ${v}`)
  }
  for (const v of clocks(ARR, POP)) assert.equal(G.auraOf(v, 1), 0, `no aura before the pop at ${v}`)
  assert.ok(G.auraOf(POP + 0.01, 1) === 1 && G.goldOf(POP + 0.01, 1) === 1)
})

test('at the origin the hair turns gold while charging and the aura is out soon after the vanish', () => {
  for (const v of clocks(0.42 * 0.18, FLASH)) assert.equal(G.goldOf(v, 0), 1, `gold at ${v}`)
  assert.equal(G.goldOf(0, 0), 0)
  assert.equal(G.auraOf(0, 0), 0)
  for (const v of clocks(GONE + 0.04, ARR)) assert.equal(G.auraOf(v, 0), 0, `aura at ${v}`)
  for (const v of clocks(-0.2, T.END)) {
    for (const end of [0, 1]) {
      const a = G.auraOf(v, end)
      assert.ok(a >= 0 && a <= 1, `aura ${end} at ${v}`)
    }
  }
})

// A stand-in X that records any drawing: person() must hide the body without drawing between the vanish and the pop.
function fakeX(v, sw) {
  const calls = []
  const L = { v, q: 0, calm: false, hide: false, sw, C: 1 }
  return { L, calls, bodyAt: () => calls.push('body'), body: () => calls.push('body'), capture: () => calls.push('cap') }
}
test('the person is hidden from the vanish until the pop, and drawn as usual from the release', () => {
  for (const v of clocks(GONE, ARR)) {
    const X = fakeX(v, v >= T.SWITCH)
    assert.equal(G.STYLE.person(X), true, `hidden at ${v}`)
    assert.deepEqual(X.calls, [], `nothing drawn at ${v}`)
  }
  for (const v of clocks(ARR, POP)) {
    const X = fakeX(v, true)
    assert.equal(G.STYLE.person(X), true)
    assert.deepEqual(X.calls, [])
  }
  for (const v of clocks(REL, T.END)) assert.equal(G.STYLE.person(fakeX(v, true)), false, `usual at ${v}`)
  assert.equal(G.STYLE.person({ ...fakeX(0.2, false), L: { v: 0.2, q: 0, calm: true, sw: false } }), false)
})

test('every baked frame keeps a clear border, so nothing is cut at the edge of its cell', () => {
  const { AF, AW, AH, RW, RH, HW, HH } = G.CELLS
  const clear = (px, w, h, name) => {
    for (let x = 0; x < w; x++) assert.equal(px[x], 0, `${name} top row at ${x}`)
    for (let y = 0; y < h; y++) {
      assert.equal(px[y * w], 0, `${name} left column at ${y}`)
      assert.equal(px[y * w + w - 1], 0, `${name} right column at ${y}`)
    }
  }
  for (let f = 0; f < AF; f++) {
    const px = G.auraPixels(f)
    assert.equal(px.length, AW * AH)
    clear(px, AW, AH, `aura ${f}`)
    assert.ok(px.some(c => c === 5), `aura ${f} has streaks`)
  }
  for (let k = 0; k < 8; k++) {
    const px = G.ringPixels(k)
    clear(px, RW, RH, `ring ${k}`)
    for (let x = 0; x < RW; x++) assert.equal(px[(RH - 1) * RW + x], 0, `ring ${k} bottom row`)
  }
  clear(G.haloPixels(), HW, HH, 'halo')
  // the atlas stays within a style's pixel budget
  assert.ok(RW * 8 * (AH + RH + HH) <= 98304)
})
