// The lion dance teleport style (web/tp-style-liondance.js): its sprite rows, the step rhythm on the trip and the
// confetti timing. The drawing contract itself (budget, context, cuts, crowds, marks) is
// tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { LION } = loadWeb('tp-style-liondance')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { TpStyles } = loadWeb('tp-styles')
const { HEADS, bodyRows, DRUM, PAL, HW, HH, BW, BH, DW, DH, surge, bit, FALL1, A } = LION
const { T } = TL

test('every sprite row fits its cell and uses only palette keys', () => {
  const keys = new Set(['.', ...Object.keys(PAL)])
  const check = (rows, w, h, what) => {
    assert.ok(rows.length <= h, `${what}: ${rows.length} rows > ${h}`)
    rows.forEach((row, y) => {
      assert.ok(row.length <= w, `${what} row ${y}: ${row.length} > ${w}`)
      for (const c of row) assert.ok(keys.has(c), `${what} row ${y}: '${c}' is not in the palette`)
    })
  }
  assert.equal(HEADS.length, 3)
  HEADS.forEach((rows, k) => check(rows, HW, HH, `head ${k}`))
  check(bodyRows(), BW, BH, 'body')
  assert.ok(bodyRows().every(row => row.length === BW))
  check(DRUM, DW, DH, 'drum')
})

test('the lion steps forward only, from the start to the landing, close to its trip item', () => {
  for (const n of [4, 9, 12]) {
    let last = -1
    for (let t = 0; t <= 1 + 1e-9; t += 1 / 1000) {
      const p = surge(t, n)
      assert.ok(p >= last - 1e-12, `n ${n} t ${t}: back from ${last} to ${p}`)
      assert.ok(Math.abs(p - t) <= 0.15 / n, `n ${n} t ${t}: ${Math.abs(p - t) * n} of a beat from the sort point`)
      last = p
    }
    assert.equal(surge(0, n), 0)
    assert.ok(Math.abs(surge(1, n) - 1) < 1e-12)
  }
})

test('all the confetti is down before the release, so the floor mark takes over whole', () => {
  const d = TpStyles.durs('liondance', 20)
  const burst = TL.real(TL.ARR + A.CHENG * (TL.T.RELEASE - TL.ARR), d), release = TL.real(TL.T.RELEASE, d)
  assert.ok(burst + FALL1 < release, `last bit lands ${burst + FALL1 - release} s after the release`)
  const X = { hash: (k, salt) => ((k * 7919 + salt * 104729) % 1000) / 1000 }, o = {}
  for (let k = 0; k < 18; k++) assert.ok(bit(X, k, o).t <= FALL1)
})

// A minimal X at core v going up and to the left; ctx and the body passes are recorded.
const DL = TpStyles.durs('liondance', 20)
function fakeX(v, { stool = false, hide = false, d = DL, swAt = TL.DEP } = {}) {
  const tp = { u: TL.real(v, d), d, swAt, cut: null, hide, stool, len: 20 }
  const log = [], st = { globalAlpha: 1 }
  const ctx = new Proxy(st, {
    get: (s, k) => (k in s ? s[k] : k === 'ellipse' ? (...a) => log.push(['shadow', a[2], a[3], s.globalAlpha]) : () => {}),
    set: (s, k, val) => ((s[k] = val), true),
  })
  const route = (p, out) => {
    out[0] = 400 - 200 * p; out[1] = 300 - 100 * p; out[2] = 20 - 17 * p; out[3] = 10 - 5 * p; out[4] = false
    return out
  }
  return {
    x0: 400, y0: 300, x1: 200, y1: 200, tx0: 20, ty0: 10, tx1: 3, ty1: 5, dir0: [-0.9, -0.4], dir1: [-0.9, -0.4],
    lite: false, night: false, snow: 0, tp, a: { dirFront: true }, G: { th: { shadow: 'rgba(0,0,0,0.25)' } },
    L: TL.phase(tp, false, TL.newPhase()), ctx, route, start: 0, log,
    hash: (k, salt) => (((k * 37 + salt * 11) % 100) + 100) % 100 / 100,
    body: o => log.push(['body', { ...o }]),
    stamp: () => log.push(['stamp', st.globalAlpha]),
  }
}
globalThis.document ??= { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) }) }
const REMAP = ['sx', 'sy', 'lift', 'legs', 'tint', 'flip', 'rot', 'mirror', 'clip']
const { STYLE } = loadWeb('tp-style-liondance')

test('a hidden start shows the lion whole from the switch on, not faded in a second time', () => {
  for (let c = TL.DEP - 0.03; c < TL.DEP + 0.03; c += 0.005) {
    const X = fakeX(c, { hide: true })
    STYLE.trip(X)
    const lows = X.log.filter(e => e[0] === 'stamp' && e[1] < 0.99)
    assert.equal(lows.length, 0, `core ${c.toFixed(3)}: lion alpha ${lows.map(e => e[1].toFixed(2))}`)
  }
})

test('the feet keep a shadow like the walker\'s whenever the body pass is remapped, and only then', () => {
  for (const stool of [false, 1, 2])
    for (let c = 0; c < T.RELEASE; c += 1 / 240) {
      const X = fakeX(c, { stool })
      STYLE.person(X)
      const body = X.log.find(e => e[0] === 'body')
      if (!body) continue
      const mapped = REMAP.some(k => body[1][k] != null && body[1][k] !== false)
      const shadows = X.log.slice(0, X.log.indexOf(body)).filter(e => e[0] === 'shadow')
      const at = `stool ${stool} core ${c.toFixed(3)}`
      if (!mapped) assert.equal(shadows.length, 0, `${at}: a second shadow under the page's own`)
      else {
        assert.equal(shadows.length, 1, `${at}: remapped body without a shadow`)
        assert.ok(shadows[0][1] >= 4 && shadows[0][2] === 3 && shadows[0][3] === 1, `${at}: ${shadows[0]}`)
      }
    }
})

test('a stool sitter sits until SQUEEZE, then goes up from standing on the stool, no drop in one frame', () => {
  for (const [stool, perch] of [[1, 4], [2, 9]]) {
    let last = null
    for (let c = 0; c < TL.DEP * LION.D.SNAP; c += 1 / 240) {
      const X = fakeX(c, { stool })
      STYLE.person(X)
      const o = X.log.find(e => e[0] === 'body')[1], sits = o.pose === 'sit' || o.pose === 'sitHigh'
      assert.equal(sits, c < T.SQUEEZE, `stool ${stool} core ${c.toFixed(3)}: ${o.pose}`)
      if (!sits) {
        const lift = o.lift || 0
        if (last == null) assert.equal(lift, perch, 'standing on the stool first')
        else assert.ok(lift >= last - 2, `core ${c.toFixed(3)}: lift ${last} -> ${lift}`)
        last = lift
      }
    }
  }
})

test('after the spit the lion backs off and dances away from the person, at the landing\'s screen row', () => {
  for (let c = TL.ARR + A.SPIT1 * (T.RELEASE - TL.ARR); c < T.END; c += 0.02) {
    const X = fakeX(c), stamps = []
    X.stamp = (img, sx, sy, sw, sh, dx, dy) => stamps.push([dx, dx + sw])
    STYLE.trip(X)
    // it arrives heading left (dir1), so it stays right of the feet at x1 = 200: nothing over the person
    const left = Math.min(...stamps.map(s => s[0]))
    if (stamps.length) assert.ok(left >= 200 + 3, `core ${c.toFixed(2)}: lion from x ${left}`)
  }
})

test('a teleport planned under calm (switch late) still shows the lion between DEP and the switch', () => {
  for (const hide of [false, true])
    for (let c = TL.DEP - 0.01; c < T.SWITCH; c += 0.005) {
      const X = fakeX(c, { hide, d: TpStyles.DD, swAt: T.SWITCH })
      if (X.L.sw) continue
      STYLE.trip(X)
      assert.ok(X.log.some(e => e[0] === 'stamp'), `hide ${hide} core ${c.toFixed(3)}: nothing drawn`)
    }
})
