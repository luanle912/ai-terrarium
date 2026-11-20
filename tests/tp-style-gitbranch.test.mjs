// The branch-and-merge teleport style (web/tp-style-gitbranch.js): the line's geometry along the seen route, the drawn
// head always ahead of the commit dot, the dot on its route point, one body pass a frame, nothing for a stall user
// before L_IN, nothing left at the end, and the cost on the longest route in a crowd. The drawing contract itself
// (context, cuts, every config) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
const PAINT = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage'])
const PATH = new Set(['rect', 'moveTo', 'lineTo', 'arc', 'ellipse'])
// Paint and path ops counted on a stub context; filled rects logged with their colour.
function counter() {
  const c = { paint: 0, path: 0, rects: [], open: [] }
  const s = { globalAlpha: 1, imageSmoothingEnabled: false, fillStyle: '#000', lineWidth: 1 }
  c.ctx = new Proxy({}, {
    get: (_, k) => k in s ? s[k] : (...a) => {
      if (k === 'beginPath') c.open = []
      if (k === 'rect') c.open.push(a)
      if (k === 'fill') (c.rects.push(...c.open.map(r => [...r, s.fillStyle])), (c.open = []))
      if (PAINT.has(k)) c.paint++
      else if (PATH.has(k)) c.path++
      return k === 'getLineDash' ? [] : a
    },
    set: (_, k, v) => ((s[k] = v), true),
  })
  return c
}
loadWeb('office')
const { Kit } = loadWeb('tp-kit')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { STYLE, GITBRANCH: GB } = loadWeb('tp-style-gitbranch')
const { DEP, ARR, T } = TL

// A long zigzag route (58 tiles, the longest measured) and a short one with a collinear middle point.
const LONG = [[2, 2]]
for (let k = 0; k < 29; k++) LONG.push(k % 2 ? [LONG[k][0] + 2, LONG[k][1]] : [LONG[k][0], LONG[k][1] + 2])
const SHORT = [[12.5, 10.5], [8.5, 10.5], [3.5, 10.5], [3.5, 4.5]]
// From the plain floor straight across the lounge rug, then on to a desk.
const RUGR = [[24.5, 12.5], [24.5, 3.5], [12.5, 3.5], [12.5, 2.5]]
const D = [0.6, 1.8, 0.5, 0.6]
// A stand-in for the dispatcher's X with real route sampling.
function fakeX(v, { lite = false, night = false, route = LONG, hide = false, d = D, q = false, stool = false } = {}) {
  const c = counter(), L = TL.newPhase()
  TL.phase({ u: q ? -0.2 : TL.real(v, d), d, cut: null, swAt: DEP, hide }, false, L)
  const sw = L.sw, f0 = Kit.feet(...route[0]), f1 = Kit.feet(...route.at(-1))
  const X = {
    c, ctx: c.ctx, L, lite, night, df: night ? 0.2 : 1, snow: 0, t: 2.4, start: 0, kind: 'ground',
    a: { dirFront: true, id: 3 }, tp: { route, stool, hide, style: 'gitbranch' },
    x0: f0[0], y0: f0[1], x1: f1[0], y1: f1[1],
    tx0: route[0][0], ty0: route[0][1], tx1: route.at(-1)[0], ty1: route.at(-1)[1],
    route: (p, out = [0, 0, 0, 0, false]) => Kit.along(route, X.start, p, out),
    hash: (k, s) => Kit.hash(3, k, s),
    text: (str, px, py, col, s) => Kit.text(c.ctx, str, px, py, col, s),
    passes: 0,
    body() { X.passes++ },
    bodyAt() { X.passes++ },
    capture() { throw new Error('no capture expected') },
  }
  X.sw = sw
  return X
}
// Every item the style draws this frame, as the dispatcher would call them; walker counts person()'s paint.
function frame(X) {
  const n = STYLE.need(X)
  for (const end of [0, 1]) {
    if (end === 0 && X.L.hide) continue
    if (n & (end ? 8 : 4)) STYLE.floor(X, end)
    if (n & (end ? 32 : 16)) STYLE.stand(X, end)
  }
  if (n & 64) STYLE.trip(X)
  if (n & Kit.PART.RUG) STYLE.rug(X)
  const p0 = X.c.paint
  X.handled = STYLE.person(X)
  X.walker = X.c.paint - p0
  return X
}
const routeLen = (route, from = 0) => {
  let len = 0
  for (let k = from + 1; k < route.length; k++)
    len += Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1])
  return len
}

test('the line follows the seen route, collinear points merged, from a hidden start\'s first seen point', () => {
  const X = fakeX(0.48, { route: SHORT }), c = GB.lineOf(X)
  assert.ok(Math.abs(c.total - routeLen(SHORT)) < 1e-9)
  assert.equal(c.sx.length, 3, 'the middle of three collinear points is dropped')
  assert.ok(Math.abs(GB.lineOf(fakeX(0.48)).total - 58) < 1e-9)
  const H = fakeX(0.48, { route: SHORT })
  H.start = 1
  assert.ok(Math.abs(GB.lineOf(H).total - routeLen(SHORT, 1)) < 1e-9)
})

test('the drawn head leads the dot and reaches the landing by HEAD; the tail erases only in the fade', () => {
  for (const d of [D, [0.6, 0.8, 0.5, 0.6]])
    for (const route of [LONG, SHORT])
      for (let v = DEP; v <= T.END; v += 0.004) {
        const X = fakeX(v, { route, d }), c = GB.lineOf(X), [head, dot, tail] = GB.spans(X, c, [0, 0, 0, 0])
        assert.ok(head >= dot - 1e-9, `core ${v.toFixed(3)}: head ${head} behind the dot ${dot}`)
        if (X.L.trip >= GB.HEAD || v >= ARR) assert.ok(Math.abs(head - c.total) < 1e-9)
        if (v < T.RELEASE) assert.equal(tail, 0)
      }
  const X = fakeX(GB.SPROUT - 0.01), c = GB.lineOf(X)
  assert.equal(GB.spans(X, c, [0, 0, 0, 0])[0], 0, 'nothing drawn before the sprout')
})

test('the commit dot is drawn over its route point, where the dispatcher sorts the trip item', () => {
  for (const p of [0.1, 0.37, 0.5, 0.83]) {
    const v = DEP + p * (ARR - DEP), X = fakeX(v)
    STYLE.trip(X)
    const q = X.route(X.L.trip), body = X.c.rects.filter(r => r[4] === '#3fd062' && r[2] === 9)
    assert.ok(body.length > 0, `trip ${p}: the dot`)
    assert.equal(body[0][0] + 4, q[0], `trip ${p}: centred on the route point`)
    assert.ok(body[0][1] < q[1] && body[0][1] > q[1] - 20, 'over it, hopping')
  }
})

test('one body pass a frame, none at the walker in the trip, the usual person from the release', () => {
  for (const stool of [false, 1, 2])
    for (const v of [0.01, 0.13, 0.2, 0.28, 0.35, 0.56, 0.6, 0.7, 0.85, 0.91]) {
      const X = frame(fakeX(v, { stool }))
      assert.ok(X.passes <= 1, `core ${v}: ${X.passes} passes`)
    }
  for (const v of [0.43, 0.48, 0.535]) {
    const X = frame(fakeX(v))
    assert.equal(X.handled, true)
    assert.equal(X.passes, 0)
    assert.equal(X.walker, 0, `core ${v}: nothing at the walker`)
  }
  assert.equal(STYLE.person(fakeX(0.05)), false, 'drawn as usual while tagged')
  assert.equal(STYLE.person(fakeX(T.RELEASE)), false)
  assert.equal(STYLE.person(fakeX(0, { q: true })), false)
  const hid = fakeX(0.35, { hide: true })
  assert.equal(STYLE.person(hid), true)
  assert.equal(hid.passes, 0, 'a stall user is not seen before the trip')
})

test('a stall user shows nothing before L_IN; nothing is left at the end', () => {
  for (const v of [0.2, 0.26, 0.275]) {
    const X = frame(fakeX(v, { hide: true }))
    assert.equal(X.c.paint, 0, `hidden core ${v}`)
  }
  for (const route of [LONG, SHORT]) {
    const X = frame(fakeX(T.END - 1e-4, { route }))
    assert.equal(X.c.paint, 0, 'everything faded out by the end')
  }
})

test('within budget on the longest route, in a crowd and queued', () => {
  for (const lite of [false, true])
    for (const night of [false, true])
      for (const hide of [false, true])
        for (const route of [LONG, RUGR])
          for (let v = 0; v < T.END; v += 0.005) {
            const X = frame(fakeX(v, { lite, night, hide, route })), cap = lite ? 30 : 60
            assert.ok(X.c.paint <= cap, `core ${v.toFixed(3)} lite ${lite}: ${X.c.paint} paint`)
            assert.ok(X.c.path <= 400, `core ${v.toFixed(3)} lite ${lite}: ${X.c.path} path ops`)
          }
  for (const secs of [0, 0.2, 0.4]) {
    const X = fakeX(0, { q: true })
    X.L.secs = -secs
    assert.ok(frame(X).c.paint <= 8)
  }
})

test('the main line crosses the arrival step on the other tile axis', () => {
  const X = fakeX(0.7, { route: SHORT })
  assert.deepEqual([...GB.mainAxis(X, 1)], [1, 0], 'arrives along y: main runs along x')
  assert.deepEqual([...GB.mainAxis(X, 0)], [0, -1], 'leaves along x: main runs along y')
})

test('the stretch over the lounge rug is drawn just over the rug, the rest on the floor, through the fade', () => {
  const c = GB.lineOf(fakeX(0.5, { route: RUGR }))
  assert.equal(c.rug.length, 1, 'one crossing')
  const [a, b] = c.rug[0]
  assert.ok(Math.abs(a - 3.75) < 0.15 && Math.abs(b - 7.1) < 0.15, `rug from ${a} to ${b}`)
  assert.equal(GB.lineOf(fakeX(0.5)).rug.length, 0, 'the long route stays off it')
  // the pieces of a span: off the rug, on it, both; together the whole span
  const P = (m, x, y) => {
    const f = GB.pieces(c, x, y, m, []).map(v => +v.toFixed(6)), out = []
    for (let k = 0; k < f.length; k += 2) out.push([f[k], f[k + 1]])
    return out
  }
  assert.deepEqual(P(2, 1, 9), [[1, 9]])
  assert.deepEqual(P(1, 1, 9), [[+a.toFixed(6), +b.toFixed(6)]])
  assert.deepEqual(P(0, 1, 9), [[1, +a.toFixed(6)], [+b.toFixed(6), 9]])
  assert.deepEqual(P(1, 0, 2), [], 'nothing on the rug before it')
  assert.deepEqual(P(0, 4, 6), [], 'all on the rug')
  for (const v of [0.5, 0.8, 1.0]) {
    const X = fakeX(v, { route: RUGR })
    assert.ok(STYLE.need(X) & Kit.PART.RUG, `core ${v}: the rug item is asked for`)
    STYLE.rug(X)
    assert.ok(X.c.paint > 0, `core ${v}: the rug stretch shows`)
  }
  assert.ok(!(STYLE.need(fakeX(0.5)) & Kit.PART.RUG), 'not for a route off the rug')
  assert.ok(!(STYLE.need(fakeX(GB.SPROUT - 0.01, { route: RUGR })) & Kit.PART.RUG), 'not before the line')
  assert.equal(frame(fakeX(T.END - 1e-4, { route: RUGR })).c.paint, 0, 'gone by the end')
})
