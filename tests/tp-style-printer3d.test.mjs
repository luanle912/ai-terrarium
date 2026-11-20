// The 3D print style's pure timeline (web/tp-style-printer3d.js): the scan beam wiping the body away at the origin,
// the printer at the landing printing it back from the feet up, and that something shows at every visible moment.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('en')
globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
loadWeb('office-draw-teleport')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { beats, ALL } = loadWeb('tp-style-printer3d')

const clocks = (a, b, n = 200) => Array.from({ length: n + 1 }, (_, j) => a + ((b - a) * j) / n)

test('origin: the whole body until the beam reaches it, then fewer rows down to none', () => {
  for (const top of [21, 25, 30]) {
    assert.equal(beats(0, top).rows0, ALL)
    assert.equal(beats(0.05, top).rows0, ALL)
    const mid = beats(0.22, top).rows0
    assert.ok(mid > 0 && mid < top, `top ${top}: ${mid} rows at 0.22`)
    assert.equal(beats(TL.DEP - 0.01, top).rows0, 0)
    let last = ALL
    for (const v of clocks(0, TL.DEP)) {
      const { rows0 } = beats(v, top)
      assert.ok(rows0 <= last, `top ${top}: rows grow back at ${v}`)
      last = rows0
    }
  }
})

test('origin: the beam starts above the head and sinks into the plate', () => {
  const b0 = beats(0.11, 21)
  assert.ok(b0.cut > 21 && b0.beam > 0)
  assert.ok(beats(0.3, 21).cut < beats(0.2, 21).cut)
  assert.equal(beats(0.41, 21).beam, 0)
})

test('landing: nothing printed before the print, row by row up to the whole body', () => {
  assert.equal(beats(0.5, 21).rows1, 0)
  assert.equal(beats(0.555, 21).rows1, 0)
  assert.equal(beats(0.8, 21).rows1, ALL)
  assert.equal(beats(TL.T.RELEASE, 21).rows1, ALL)
  let last = 0
  for (const v of clocks(0.54, 0.92)) {
    const { rows1, pct } = beats(v, 21)
    assert.ok(rows1 >= last, `rows shrink at ${v}`)
    assert.ok(pct >= 0 && pct <= 100 && Number.isInteger(pct))
    last = rows1
  }
  assert.equal(beats(0.7, 21).pct, Math.round((100 * (0.7 - 0.555)) / (0.8 - 0.555)))
})

test('landing: the nozzle rides just over the last printed row and sweeps across the body', () => {
  const xs = new Set()
  for (const v of clocks(0.56, 0.79)) {
    const b = beats(v, 21)
    assert.equal(b.tip, b.rows1 + 1)
    assert.ok(Math.abs(b.nx) <= 5)
    xs.add(b.nx)
  }
  assert.ok(xs.size >= 8, 'the nozzle moves side to side')
  assert.equal(beats(0.3, 21).tip, -1, 'no gantry before the posts are up')
})

test('something shows at every visible clock, a hidden start included', () => {
  for (const v of clocks(0, TL.T.RELEASE, 400)) {
    const b = beats(v, 21)
    const body = b.rows0 > 0 && v < TL.T.SWITCH
    assert.ok(body || b.plate0 > 0 || b.plate1 > 0, `nothing at ${v}`)
  }
  // a stall user starts unseen just before the departure ends: the landing plate is already there
  const d = [0.7, 0.12, 1.0, 0.4], hidden = TL.core(TL.real(TL.DEP, d) - TL.DEP + TL.T.L_IN, d)
  assert.ok(beats(hidden, 21).plate1 > 0)
})

test('everything is gone by the end', () => {
  const b = beats(TL.T.END, 21)
  assert.equal(b.plate0 + b.plate1 + b.post0 + b.post1, 0)
  assert.equal(b.tip, -1)
  assert.equal(b.label, 0)
})

test('the gantry is gone before the posts sink past the head', () => {
  for (const v of clocks(TL.T.RELEASE, TL.T.END)) {
    const b = beats(v, 21)
    if (b.post1 < 21 + 8) assert.equal(b.tip, -1, `gantry at ${v} with posts ${b.post1}`)
    if (b.tip >= 0) assert.ok(b.bar > 0)
  }
})

test('the printer has folded away by the release, so the person never walks through it', () => {
  const b = beats(TL.T.RELEASE, 21)
  assert.equal(b.post1, 0)
  assert.equal(b.tip, -1)
  assert.equal(b.rows1, ALL)
  assert.ok(b.plate1 > 0, 'the plate stays under them as they step off')
  assert.ok(beats(0.95, 21).label === 0, 'the counter does not trail them')
})

test('a taller body (a party hat) is printed to its top, not popped in at the end', () => {
  const v = 0.799
  assert.equal(beats(v, 21, 26).rows1, Math.floor(26 * ((v - 0.555) / (0.8 - 0.555))))
  assert.ok(beats(v, 21, 26).rows1 > 21)
  assert.equal(beats(0.7, 21, 26).tip, beats(0.7, 21, 26).rows1 + 1)
})
