// The helpers the teleport styles draw with (web/tp-kit.js, web/tp-person.js, X in web/office-draw-teleport.js):
// pixel text, shards, route and arc sampling, the desk and hanging points, and the body remap.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
const S = loadWeb('office-scene')
const { ClaudeOffice } = loadWeb('office')
loadWeb('office-draw-teleport')
const { Kit } = loadWeb('tp-kit')
const { TpPerson } = loadWeb('tp-person')
const ctxLog = log => new Proxy({ globalAlpha: 1 }, {
  get: (s, k) => (k in s ? s[k] : (...a) => log.push([k, ...a, s.fillStyle])),
  set: (s, k, v) => ((s[k] = v), true),
})

test('pixel text: glyph runs per character, one fill per string', () => {
  const g = Kit.glyphs('I')
  // I = 7,2,2,2,7: the middle column full height, the outer columns top and bottom only
  assert.deepEqual([...g], [0, 0, 1, 0, 4, 1, 1, 0, 5, 2, 0, 1, 2, 4, 1])
  assert.equal(Kit.glyphs('AB').w, 7)
  assert.equal(Kit.glyphs('ctrl+x'), Kit.glyphs('ctrl+x'), 'cached')
  const log = []
  Kit.text(ctxLog(log), 'GAME OVER', 100, 50, '#fff', 2)
  assert.equal(log.filter(c => c[0] === 'fill').length, 1)
  const rects = log.filter(c => c[0] === 'rect')
  assert.ok(rects.length > 20 && rects.every(([, x, y, w, h]) => [x, y, w, h].every(Number.isInteger) && y >= 40 && y + h <= 50))
})

test('shards: one fill per colour, moved or skipped per rect', () => {
  const cap = TpPerson.newCapture()
  Object.assign(cap, { n: 3, cols: ['#a', '#b'] })
  cap.x.set([0, 5, 9]), cap.y.set([0, 1, 2]), cap.w.set([1, 2, 3]), cap.h.set([1, 1, 1]), cap.c.set([0, 1, 0])
  const log = []
  Kit.shards(ctxLog(log), cap, 3, (k, o) => (k === 1 ? false : ((o[0] = 10), (o[1] = -1))))
  assert.deepEqual(log.filter(c => c[0] === 'rect').map(c => c.slice(1, 5)), [[10, -1, 1, 1], [19, 1, 3, 1]])
  assert.deepEqual(log.filter(c => c[0] === 'fill').map(c => c.at(-1)), ['#a'])
})

test('route, arc, desk and hanging points', () => {
  const route = [[0.5, 0.5], [10.5, 0.5], [10.5, 5.5]]
  const q = Kit.along(route, 0, 0.5, [])
  assert.deepEqual([q[2], q[3], q[4]], [8, 0.5, true], 'half of 15 tiles along')
  assert.deepEqual(q.slice(0, 2), S.PA(8, 0.5).map(Math.round))
  assert.deepEqual(Kit.along(route, 1, 0, []).slice(2, 4), [10.5, 0.5], 'a hidden head skipped')
  const { DRAW } = loadWeb('tp-style-index'), was = DRAW.dashrun, got = {}
  DRAW.dashrun = { trip: X => Object.assign(got, { arc: X.arc(0.5, 40), desk: X.desk(), hang: X.anchors(3, 40), X }) }
  try {
    const d = [0.5, 1.2, 0.5, 0.4], a = { id: 3, desk: 2, x: 21.5, y: 10.5, path: [], tp: null }
    a.tp = { u: 0.5 + 0.6, x0: 21.5, y0: 10.5, x1: 3.5, y1: 4.5, cut: null, hide: false, style: 'dashrun', d, swAt: 0.42,
      route: [[21.5, 10.5], [3.5, 10.5], [3.5, 4.5]], mk: 0 }
    const items = []
    ClaudeOffice.prototype.tpItems.call({ agents: [a], env: {} }, { ctx: ctxLog([]), df: 1, t: 0 }, items)
    items.forEach(i => i.f())
    const { X } = got
    assert.deepEqual(got.arc, [Math.round((X.x0 + X.x1) / 2), Math.round((X.y0 + X.y1) / 2 - 40)])
    const D = S.DESKS[2]
    assert.deepEqual(got.desk.slice(0, 2), S.P(D.gx + 1, D.gy + 0.22, 23.6).map(Math.round))
    assert.ok(Math.abs(got.desk[2] - (D.gx + D.gy + 1.51)) < 1e-9)
    // a visit lands by another desk: its monitor, not the own one
    a.tp.desk = 5
    items.length = 0
    ClaudeOffice.prototype.tpItems.call({ agents: [a], env: {} }, { ctx: ctxLog([]), df: 1, t: 0 }, items)
    items.forEach(i => i.f())
    const V = S.DESKS[5]
    assert.deepEqual(got.desk.slice(0, 2), S.P(V.gx + 1, V.gy + 0.22, 23.6).map(Math.round))
    delete a.tp.desk
    assert.equal(got.hang.length, 3)
    assert.ok(got.hang.every(([x, y]) => y === Math.min(X.y0, X.y1) - 190 && x > X.x1 && x < X.x0))
    assert.ok(Math.abs(Math.hypot(...X.dir0) - 1) < 1e-9 && X.dir0[0] < 0, 'screen direction of the first leg')
  } finally {
    DRAW.dashrun = was
  }
})

test('the body remap: squeeze, legs, flip, quarter turns, mirror, clip, offset', () => {
  const log = [], ctx = ctxLog(log)
  const page = {}
  const a = { x: 0, y: 0, moving: false }
  const [fx, fy] = S.PA(0, 0).map(Math.round)
  page.drawPerson = G2 => G2.rect(fx - 4, fy - 20, 8, 20, '#123456')
  const X = { page, a, ctx, G: { ctx, rect() {}, th: { stroke: '#000' } } }
  const last = o => (log.length = 0, TpPerson.body(X, o), log.find(c => c[0] === 'fillRect').slice(1, 6))
  assert.deepEqual(last({ tint: '#fff' }), [fx - 4, fy - 20, 8, 20, '#fff'])
  assert.deepEqual(last({ sx: 0.5, sy: 1, lift: 3 }), [fx - 2, fy - 23, 4, 20, '#123456'])
  assert.deepEqual(last({ mirror: true }), [fx - 4, fy - 20, 8, 20, '#123456'], 'symmetric about the feet')
  assert.deepEqual(last({ flip: true }), [fx - 4, fy - 2 * TpPerson.HIP, 8, 20, '#123456'], 'upside down about the hips')
  const r = last({ rot: 1 })
  assert.deepEqual([r[2], r[3]], [20, 8], 'a quarter turn swaps width and height')
  assert.deepEqual(last({ clip: [10, 0] }), [fx - 4, fy - 10, 8, 10, '#123456'], 'only the lowest 10 px')
  assert.deepEqual(last({ legs: 0.5 }).slice(0, 4), [fx - 4, fy - 18, 8, 20], 'the body drops as the legs fold')
  log.length = 0
  TpPerson.bodyAt(X, fx + 30, fy - 40, {})
  assert.deepEqual(log.find(c => c[0] === 'fillRect').slice(1, 5), [fx + 26, fy - 60, 8, 20])
})
