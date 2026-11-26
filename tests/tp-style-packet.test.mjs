// The data-packet teleport style (web/tp-style-packet.js): the cable's geometry from the route to under the landing
// desk's monitor, the beats on the core clock (the dissolve drains before the trip, the download ends before the
// release), one body pass a frame, and the cost on the longest route with a full body in a crowd. The drawing contract
// itself (context, cuts, every config) is tests/tp-style-contract.test.mjs.
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
globalThis.document ??= { createElement: () => ({ getContext: () => counter().ctx }) }
loadWeb('office')
const { Kit } = loadWeb('tp-kit')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { DESKS, PA } = loadWeb('office-scene')
const { STYLE, PACKET } = loadWeb('tp-style-packet')
const { DEP, ARR, T } = TL

// A long zigzag route (58 tiles, the longest measured) ending in front of desk 0.
const LONG = [[2, 2]]
for (let k = 0; k < 29; k++) LONG.push(k % 2 ? [LONG[k][0] + 2, LONG[k][1]] : [LONG[k][0], LONG[k][1] + 2])
const SHORT = [[12.5, 10.5], [8.5, 10.5], [3.5, 10.5], [3.5, 4.5]]
const BODY = [
  [-4, -11, 8, 7, 0], [-3, -18, 6, 6, 1], [-4, -20, 8, 3, 2], [-5, -11, 1, 5, 0], [4, -11, 1, 5, 0],
  [-3, -4, 2, 4, 3], [1, -4, 2, 4, 3],
]
const COLS = ['#shirt', '#skin', '#hair', '#legs']
// A stand-in for the dispatcher's X: real route sampling; a capture fills BODY (or a 66-rect, 12-colour body).
function fakeX(v, { lite = false, night = false, route = LONG, hide = false, d = [0.6, 1.8, 0.7, 0.4], full, desk = 0,
  stool = false } = {}) {
  const c = counter(), L = TL.newPhase()
  TL.phase({ u: TL.real(v, d), d, cut: null, swAt: DEP, hide }, false, L)
  const sw = v >= DEP, f0 = Kit.feet(...route[0]), f1 = Kit.feet(...route.at(-1))
  const a = { dirFront: true, id: 3, desk, x: (sw ? route.at(-1) : route[0])[0], y: (sw ? route.at(-1) : route[0])[1] }
  const X = {
    c, ctx: c.ctx, L, lite, night, df: night ? 0.2 : 1, snow: 0, t: 2.4, start: 0, kind: 'ground',
    a, page: { agents: [a] }, G: { th: { shadow: 'rgba(0,0,0,0.45)' } },
    tp: { route, stool, desk, hide, style: 'packet' }, x0: f0[0], y0: f0[1], x1: f1[0], y1: f1[1],
    tx0: route[0][0], ty0: route[0][1], tx1: route.at(-1)[0], ty1: route.at(-1)[1],
    dir0: [0.9, 0.45], dir1: [-0.9, 0.45],
    route: (p, out = [0, 0, 0, 0, false]) => Kit.along(route, 0, p, out),
    hash: (k, s) => Kit.hash(3, k, s),
    desk(out = [0, 0, 0]) {
      const dk = DESKS[desk], p = loadWeb('office-scene').P(dk.gx + 1, dk.gy + 0.22, 23.6)
      out[0] = Math.round(p[0])
      out[1] = Math.round(p[1])
      out[2] = dk.gx + dk.gy + 1.5 + 0.01
      return out
    },
    stamp() { c.paint++ },
    passes: 0,
    body() { X.passes++ },
    bodyAt() { X.passes++ },
    capture(o, out) {
      X.passes++
      const fx = sw ? X.x1 : X.x0, fy = sw ? X.y1 : X.y0
      out.cols.length = 0
      const big = (_, k) => [(k % 8) - 4, -1 - (k % 22), 1 + (k % 3), 2, k % 12]
      const rects = full ? Array.from({ length: 66 }, big) : BODY
      out.cols.push(...(full ? Array.from({ length: 12 }, (_, k) => '#c' + k) : COLS))
      out.n = rects.length
      rects.forEach(([x, y, w, h, ci], k) => {
        out.x[k] = fx + x
        out.y[k] = fy + y
        out.w[k] = w
        out.h[k] = h
        out.c[k] = ci
      })
      return out
    },
  }
  return X
}
// Every item the style draws this frame, as the dispatcher would call them; walker counts the person()'s paint.
function frame(X) {
  const n = STYLE.need(X)
  for (const end of [0, 1]) {
    if (n & (end ? 2 : 1) && STYLE.back) STYLE.back(X, end)
    if (n & (end ? 8 : 4)) STYLE.floor(X, end)
    if (n & (end ? 32 : 16) && STYLE.stand) STYLE.stand(X, end)
  }
  if (n & 64) STYLE.trip(X)
  if (n & Kit.PART.DESK) STYLE.desk(X)
  const p0 = X.c.paint
  X.handled = STYLE.person(X)
  X.walker = X.c.paint - p0
  return X
}

test('the cable runs the seen route, then on under the landing desk to below its monitor', () => {
  for (const [route, desk] of [[LONG, 0], [SHORT, 0], [SHORT, 5]]) {
    const X = fakeX(0.48, { route, desk }), c = PACKET.cable(X), dk = DESKS[desk]
    let len = 0
    for (let k = 1; k < route.length; k++)
      len += Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1])
    assert.ok(Math.abs(c.len - len) < 1e-4, 'route length')
    const ext = Math.hypot(dk.gx + 1 - route.at(-1)[0], dk.gy + 0.22 - route.at(-1)[1])
    assert.ok(Math.abs(c.total - len - ext) < 1e-4, 'plus the run under the desk')
    const q = PACKET.pointAt(c, c.total, []), m = PA(dk.gx + 1, dk.gy + 0.22)
    assert.ok(Math.abs(q[0] - m[0]) < 1e-3 && Math.abs(q[1] - m[1]) < 1e-3, 'ends under the monitor')
    const s = PACKET.pointAt(c, 0, []), f = PA(...route[0])
    assert.ok(Math.abs(s[0] - f[0]) < 1e-3 && Math.abs(s[1] - f[1]) < 1e-3, 'starts at the origin')
  }
  // a hidden start's cable starts at its first seen point
  const H = fakeX(0.48, { route: SHORT })
  H.start = 1
  assert.ok(Math.abs(PACKET.cable(H).len - 11) < 1e-4)
})

test('the beats: the dissolve drains before the trip, the download ends before the release', () => {
  const { D0, D1, JIT, FALL, A0, A1, AJ, FLY } = PACKET
  assert.ok(D0 > 0 && D1 + JIT + FALL < DEP, 'the last bit is in the port before the trip')
  assert.ok(A0 - FLY >= 0 && A1 + AJ <= 0.8, 'every cell is in by 80% of the arrival')
  // the packet train leaves the port at the trip's start and is in the desk at its end
  const X = fakeX(DEP + 1e-6), c = PACKET.cable(X)
  assert.ok(PACKET.headAt(X, c) < 0.05)
  const Y = fakeX(ARR - 1e-6)
  assert.ok(Math.abs(PACKET.headAt(Y, c) - c.total) < 0.05)
})

test('one body pass a frame, none at the walker in the trip, the usual person from the release', () => {
  for (const lite of [false, true])
    for (const v of [0.01, 0.06, 0.15, 0.25, 0.38, 0.6, 0.7, 0.8, 0.9]) {
      const X = frame(fakeX(v, { lite }))
      assert.ok(X.passes <= 1, `core ${v} lite ${lite}: ${X.passes} passes`)
    }
  for (const v of [0.43, 0.48, 0.535]) {
    const X = frame(fakeX(v))
    assert.equal(X.handled, true)
    assert.equal(X.passes, 0)
    assert.equal(X.walker, 0, `core ${v}: nothing at the walker`)
  }
  assert.equal(STYLE.person(fakeX(0.01)), false, 'drawn as usual before the glitch')
  assert.equal(STYLE.person(fakeX(T.RELEASE)), false)
  const hid = fakeX(0.35, { hide: true })
  assert.equal(STYLE.person(hid), true)
  assert.equal(hid.passes, 0, 'a stall user is not seen before the trip')
})

test('the body breaks into bits from the head down and is downloaded back from the head down', () => {
  const X = frame(fakeX(0.2)), Y = frame(fakeX(0.7))
  const at = (Z, col) => Z.c.rects.filter(r => r[4] === col)
  const top = Z => Math.min(...at(Z, '#legs').concat(at(Z, '#hair')).map(r => r[1]))
  // mid-dissolve: the legs are still there, the hair is gone; mid-download: the hair is back, the legs not yet
  assert.ok(at(X, '#legs').length > 0 && at(X, '#hair').length === 0, 'dissolving top first')
  assert.ok(at(Y, '#hair').length > 0 && at(Y, '#legs').length === 0, 'loading top first')
  assert.ok(top(X) > X.y0 - 12 && top(Y) < Y.y1 - 18)
  assert.ok(at(X, PACKET.BIT[0]).length + at(X, PACKET.BIT[1]).length > 4, 'bits in the air')
})

test('within budget on the longest route with a full body, in a crowd too', () => {
  for (const lite of [false, true])
    for (const night of [false, true])
      for (let v = 0; v < T.END; v += 0.01) {
        const X = frame(fakeX(v, { lite, night, full: true }))
        const cap = lite ? 30 : 60
        assert.ok(X.c.paint <= cap, `core ${v.toFixed(2)} lite ${lite}: ${X.c.paint} paint`)
        assert.ok(X.c.path <= 400, `core ${v.toFixed(2)} lite ${lite}: ${X.c.path} path ops`)
      }
})

test('the monitor lights over the desk from either side; a host at the desk keeps it, and the bar floats', () => {
  // the screen is drawn from the desk item, so a landing behind the desk shows it too
  const screenFill = X => X.c.rects.length + X.c.paint
  for (const route of [LONG, [[8.5, 10.5], [1.5, 0.5]]]) {
    const X = fakeX(0.7, { route })
    assert.equal(PACKET.screenShows(X, DESKS[0]), true)
    assert.ok(STYLE.need(X) & Kit.PART.DESK, 'the desk item is asked for')
    STYLE.desk(X)
    assert.ok(screenFill(X) > 0, 'the screen is drawn')
    const Y = fakeX(0.7, { route })
    STYLE.back(Y, 1)
    assert.equal(Y.c.paint, 0, 'no bar floats over it')
  }
  const X = fakeX(0.7)
  X.page.agents.push({ id: 9, desk: 0, seated: true })
  assert.equal(PACKET.screenShows(X, DESKS[0]), false, 'a host at the desk keeps their screen')
  STYLE.desk(X)
  assert.equal(X.c.paint, 0)
  STYLE.back(X, 1)
  assert.ok(X.c.paint > 0, 'the bar floats over the monitor instead')
})

test('the bar, once chosen, stays for the arrival; the screen gives way to it when a host sits down', () => {
  const at = (X, v) => TL.phase({ u: TL.real(v, X.L.d), d: X.L.d, cut: null, swAt: DEP, hide: false }, false, X.L)
  const shows = X => {
    X.c.rects.length = 0
    X.c.paint = 0
    STYLE.desk(X)
    const screen = X.c.paint
    X.c.paint = 0
    STYLE.back(X, 1)
    return [screen > 0, X.c.paint > 0]
  }
  const host = { id: 9, desk: 0, seated: true }
  // the screen from the first arrival frame never covers a host who sits down, and does not come back
  const X = fakeX(ARR + 0.01)
  assert.deepEqual(shows(X), [true, false])
  X.page.agents.push(host)
  at(X, 0.7)
  assert.deepEqual(shows(X), [false, true], 'the bar once the host sat down')
  X.page.agents.pop()
  at(X, 0.75)
  assert.deepEqual(shows(X), [false, true], 'still the bar after the host stood up again')
  // the bar from the first arrival frame, kept when the host stands up
  const Y = fakeX(ARR + 0.01)
  Y.page.agents.push(host)
  assert.deepEqual(shows(Y), [false, true])
  Y.page.agents.pop()
  at(Y, 0.7)
  assert.deepEqual(shows(Y), [false, true], 'still the bar after the host stood up')
  // a new teleport (a new tp, as a re-aim makes one) decides again
  Y.tp = { ...Y.tp, route: Y.tp.route.map(p => [...p]) }
  assert.deepEqual(shows(Y), [true, false])
})
