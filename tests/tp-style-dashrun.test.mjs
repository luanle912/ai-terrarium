// The dash-run teleport style (web/tp-style-dashrun.js): the run's timing and slide, the smoke trail's life and cost on
// the longest routes, and the runner's pose (the shear, the arms redrawn trailing back, the scissored legs). The
// drawing contract itself (budget, context, cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
// Paint and path ops counted on a stub context; rects logged with the fill colour they end up in.
const PAINT = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage'])
const PATH = new Set(['rect', 'moveTo', 'lineTo', 'arc', 'ellipse'])
function counter() {
  const c = { paint: 0, path: 0, fills: [], alpha: [], rects: [], open: [] }
  const s = { globalAlpha: 1, imageSmoothingEnabled: false, fillStyle: '#000' }
  c.ctx = new Proxy({}, {
    get: (_, k) => k in s ? s[k] : (...a) => {
      if (k === 'beginPath') c.open = []
      if (k === 'rect') c.open.push(a)
      if (k === 'fill') (c.rects.push(...c.open.map(r => [...r, s.fillStyle])), (c.open = []))
      if (PAINT.has(k)) (c.paint++, k === 'fill' && (c.fills.push(s.fillStyle), c.alpha.push(s.globalAlpha)))
      else if (PATH.has(k)) c.path++
      return a
    },
    set: (_, k, v) => ((s[k] = v), true),
  })
  c.state = s
  return c
}
globalThis.document ??= { createElement: () => ({ getContext: () => counter().ctx }) }
loadWeb('office')
const { Kit } = loadWeb('tp-kit')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { STYLE, DASH } = loadWeb('tp-style-dashrun')
const { headDist, bornAt, slideOf, seenLen, isArm, runner, D0, LIFE, SQ } = DASH
const { DEP, ARR, T } = TL

// A long zigzag route (58 tiles, the longest measured) through open floor.
const LONG = [[2, 2]]
for (let k = 0; k < 29; k++) LONG.push(k % 2 ? [LONG[k][0] + 2, LONG[k][1]] : [LONG[k][0], LONG[k][1] + 2])
// A body as tp-person captures it, from the feet: torso, head, arms and hands, legs (walk/stand layout).
const BODY = [
  [-4, -11, 8, 7, 0], [-3, -18, 6, 6, 1], [-5, -11, 1, 5, 2], [-5, -6, 1, 1, 1], [4, -11, 1, 5, 2], [4, -6, 1, 1, 1],
  [-3, -4, 2, 4, 3], [1, -4, 2, 4, 3],
]
const COLS = ['#shirt', '#skin', '#sleeve', '#legs']
// A stand-in for the dispatcher's X: real route sampling, a stub body that a capture fills with BODY (or 66 rects).
function fakeX(v, { lite = false, night = false, route = LONG, hide = false, d = [0.42, 1.8, 0.5, 0.5], full } = {}) {
  const c = counter(), L = TL.newPhase()
  TL.phase({ u: TL.real(v, d), d, cut: null, swAt: DEP, hide }, false, L)
  const f0 = Kit.feet(...route[0]), f1 = Kit.feet(...route[route.length - 1])
  const X = {
    c, ctx: c.ctx, L, lite, night, df: night ? 0.2 : 1, snow: 0, t: 2.4, start: 0, kind: 'ground',
    a: { dirFront: true, id: 3 }, G: { th: { shadow: 'rgba(0,0,0,0.45)' } },
    tp: { route, stool: false, desk: null }, x0: f0[0], y0: f0[1], x1: f1[0], y1: f1[1],
    tx0: route[0][0], ty0: route[0][1], tx1: route.at(-1)[0], ty1: route.at(-1)[1],
    dir0: [0.9, 0.45], dir1: [-0.9, 0.45],
    route: (p, out = [0, 0, 0, 0, false]) => Kit.along(route, 0, p, out),
    hash: (k, s) => Kit.hash(3, k, s),
    passes: 0,
    bodyAt() { X.passes++ },
    body() { X.passes++ },
    capture(o, out) {
      X.passes++
      const [px, py] = o.at
      out.cols.length = 0
      out.cols.push(...COLS)
      const rects = full ? Array.from({ length: 66 }, (_, k) => [k % 8 - 4, -(k % 18), 1, 1, k % 4]) : BODY
      out.n = rects.length
      rects.forEach(([x, y, w, h, ci], k) => {
        out.x[k] = px + x
        out.y[k] = py + y
        out.w[k] = w
        out.h[k] = h
        out.c[k] = ci
      })
      return out
    },
  }
  return X
}
// Every item the style would draw this frame, as the dispatcher would call them.
function frame(X) {
  const n = STYLE.need(X)
  for (const end of [0, 1]) {
    if (n & (end ? 2 : 1)) STYLE.back(X, end)
    if (n & (end ? 8 : 4)) STYLE.floor(X, end)
    if (n & (end ? 32 : 16)) STYLE.stand(X, end)
  }
  if (n & 64) STYLE.trip(X)
  STYLE.person(X)
  return X
}

test('the run: flat out to the slide, then the slide brakes onto the landing; births invert it', () => {
  const [T1, T2] = [1.8, 0.5]
  for (const len of [8, 24.5, 58]) {
    const sl = slideOf(len), at = tau => headDist(tau, T1, T2, len)
    assert.ok(sl > 0 && sl <= 0.8 + 1e-9, `slide of at most 0.8 tiles (len ${len})`)
    assert.equal(at(0), D0)
    assert.ok(Math.abs(at(T1) - (len - sl)) < 1e-9, 'the run stops short of the landing by the slide')
    assert.ok(Math.abs(at(T1 + SQ * T2) - len) < 1e-9, 'the slide ends on the landing')
    assert.equal(at(T1 + T2), len)
    let last = D0
    for (let tau = 0.01; tau <= T1 + T2; tau += 0.01) {
      const d = at(tau)
      assert.ok(d >= last - 1e-12, 'never runs backwards')
      assert.ok(Math.abs(bornAt(d, T1, T2, len) - tau) < 1e-6 || d === len, `inverse at ${tau.toFixed(2)}`)
      last = d
    }
    // the slide brakes: its last step is far shorter than a step of the run
    const step = 0.01, run = at(0.5) - at(0.5 - step), stop = at(T1 + SQ * T2) - at(T1 + SQ * T2 - step)
    assert.ok(stop < 0.1 * run, `brakes (len ${len})`)
  }
  assert.ok(Math.abs(seenLen(fakeX(0.5)) - 58) < 1e-9)
})

test('one body pass a frame, nothing at the walker while running, the usual person from the release', () => {
  for (const v of [0.05, 0.2, 0.4, 0.48, 0.6, 0.8]) assert.equal(frame(fakeX(v)).passes, 1, `core ${v}`)
  assert.equal(frame(fakeX(0.48, { lite: true })).passes, 1, 'the same in a crowd')
  assert.equal(STYLE.person(fakeX(0.48)), true)
  assert.equal(fakeX(0.48).passes, 0)
  assert.equal(STYLE.person(fakeX(T.RELEASE)), false)
  const hid = fakeX(0.35, { hide: true })
  assert.equal(STYLE.person(hid), true)
  assert.equal(hid.passes, 0, 'a stall user is not seen before the run')
})

test('the runner leans into the run, its arms trail straight back and its legs scissor', () => {
  assert.ok(isArm(-5, -11, 1, 5) && isArm(4, -6, 1, 1))
  assert.ok(!isArm(-4, -11, 1, 7) && !isArm(-3, -4, 2, 4) && !isArm(4, -18, 1, 5))
  for (const s of [1, -1]) {
    const X = fakeX(0.48), px = 100, py = 200
    runner(X, px, py, { s, front: true, lean: 3, legs: 1, stride: 2 * s, lift: 1, arms: 2 })
    const at = col => X.c.rects.filter(r => r[4] === col)
    const head = at('#skin').find(r => r[3] === 6)
    assert.equal(head[0], px - 3 + 3 * s, 'the head leads by 3 px')
    assert.equal(at('#shirt')[0][0], px - 4 + s, 'the torso by 1 px')
    // no hanging arm left; the trailing arms are 1 px rows reaching 6 px or more behind
    const sleeves = at('#sleeve')
    assert.ok(sleeves.every(r => r[3] === 1), 'no vertical arm rect')
    const back = Math.max(...sleeves.map(r => (s > 0 ? px - r[0] : r[0] + r[2] - 1 - px)))
    assert.ok(back >= 9, `arms reach back (${back})`)
    // angled down toward the hand and tapering, so they read as swept back, not pointing
    const far = sleeves.reduce((a, r) => (Math.abs(r[0] - px) > Math.abs(a[0] - px) ? r : a))
    assert.ok(far[1] - Math.min(...sleeves.map(r => r[1])) >= 3, 'the far end hangs lower')
    const rows = y => sleeves.filter(r => r[1] === y).length
    assert.ok(rows(far[1]) < rows(Math.min(...sleeves.map(r => r[1]))) || rows(far[1]) === 1, 'thinner at the hand')
    // one stride brings the legs together under the body, the other throws them apart, the rear foot kicked up
    assert.deepEqual(at('#legs').map(r => r[0] - px), [-1, -1])
    const Y = fakeX(0.48)
    runner(Y, px, py, { s, front: true, lean: 3, legs: 1, stride: -2 * s, lift: 1, arms: 2 })
    const wide = Y.c.rects.filter(r => r[4] === '#legs')
    assert.deepEqual(wide.map(r => r[0] - px), [-5, 3])
    assert.deepEqual(wide.map(r => r[1] - py), s > 0 ? [-5, -4] : [-4, -5], 'the rear leg up a pixel')
  }
})

test('the trail and the clouds stay within budget on the longest route, by day, at night and in a crowd', () => {
  for (const d of [[0.42, 1.8, 0.5, 0.5], [0.42, 0.6, 0.5, 0.5]])
    for (const lite of [false, true])
      for (const night of [false, true])
        for (let v = 0; v < T.END; v += 0.005) {
          const { c } = frame(fakeX(v, { lite, night, d, full: true }))
          assert.ok(c.path <= 400, `${c.path} path ops at ${v.toFixed(3)}`)
          assert.ok(c.paint <= (lite ? 30 : 60), `${c.paint} paint at ${v.toFixed(3)} lite ${lite}`)
        }
})

test('smoke shows through the trip and is all gone by the end', () => {
  const smoke = X => X.c.fills.filter(f => /^#[0-9a-f]{6}$/.test(f)).length
  for (const v of [DEP + 0.03, (DEP + ARR) / 2, ARR + 0.05, T.RELEASE + 0.1])
    assert.ok(smoke(frame(fakeX(v))) > 0, `smoke at core ${v}`)
  assert.equal(frame(fakeX(T.END - 0.005)).c.paint, 0, 'nothing left at the end')
  assert.ok(LIFE <= 0.5 + 0.5, 'a puff born as the run ends is gone by the end of the fade')
  // a crowd (lite) keeps the trail too, at a lower cost
  assert.ok(smoke(frame(fakeX((DEP + ARR) / 2, { lite: true }))) > 0)
})
