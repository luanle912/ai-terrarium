// The lightning-run teleport style (web/tp-style-bolt.js): the run's timing, the streak's cost on the longest routes,
// the scorch mark's life. The drawing contract itself (budget, context, cuts, crowds) is
// tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
// Paint and path ops counted on a stub context; the glow bake gets a stub canvas.
const PAINT = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage'])
const PATH = new Set(['rect', 'moveTo', 'lineTo', 'arc', 'ellipse'])
function counter() {
  const c = { paint: 0, path: 0, fills: [], alpha: [] }
  const s = { globalAlpha: 1, imageSmoothingEnabled: false, fillStyle: '#000' }
  c.ctx = new Proxy({}, {
    get: (_, k) => k in s ? s[k] : (...a) => {
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
const { TpPerson } = loadWeb('tp-person')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { STYLE, BOLT, glowPixels } = loadWeb('tp-style-bolt')
const { headAt, skidFrom, seenLen, SKT, TT } = BOLT
const { DEP, ARR, T } = TL

// A long zigzag route (58 tiles, the longest measured) through open floor.
const LONG = [[2, 2]]
for (let k = 0; k < 29; k++) LONG.push(k % 2 ? [LONG[k][0] + 2, LONG[k][1]] : [LONG[k][0], LONG[k][1] + 2])
// A stand-in for the dispatcher's X: real route sampling, a stub body that a capture fills with 66 rects.
function fakeX(v, { lite = false, night = false, route = LONG, hide = false } = {}) {
  const c = counter(), L = TL.newPhase()
  const d = [0.6, 0.9, 0.5, 0.5]
  TL.phase({ u: TL.real(v, d), d, cut: null, swAt: DEP, hide }, false, L)
  const f0 = Kit.feet(...route[0]), f1 = Kit.feet(...route[route.length - 1])
  const X = {
    c, ctx: c.ctx, L, lite, night, snow: 0, t: 2.4, start: 0, kind: 'ground', a: { dirFront: true, id: 3 },
    tp: { route, stool: false, desk: null }, x0: f0[0], y0: f0[1], x1: f1[0], y1: f1[1],
    tx0: route[0][0], ty0: route[0][1], tx1: route.at(-1)[0], ty1: route.at(-1)[1],
    dir0: [0.9, 0.45], dir1: [-0.9, 0.45],
    route: (p, out = [0, 0, 0, 0, false]) => Kit.along(route, 0, p, out),
    hash: (k, s) => Kit.hash(3, k, s),
    desk: (out = [0, 0, 0]) => ((out[0] = f1[0]), (out[1] = f1[1] - 20), out),
    stamp: () => c.ctx.drawImage(),
    passes: 0,
    bodyAt() { X.passes++ },
    body() { X.passes++ },
    capture(o, out) {
      X.passes++
      out.n = 66
      out.cols.length = 0
      out.cols.push('#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888', '#999')
      for (let k = 0; k < 66; k++)
        ((out.x[k] = k % 8), (out.y[k] = -k % 24), (out.w[k] = 1), (out.h[k] = 1), (out.c[k] = k % 9))
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
  if (n & Kit.PART.RUG) STYLE.rug(X)
  STYLE.person(X)
  return X
}

test('the run ends where the skid starts, so the runner never jumps at the arrival', () => {
  for (const len of [8, 24.5, 58]) {
    assert.equal(headAt(0, len), 0)
    assert.ok(Math.abs(headAt(1, len) - skidFrom(len)) < 1e-12, `len ${len}`)
    assert.ok(Math.abs((1 - skidFrom(len)) * len - SKT) < 1e-9, 'the skid is SKT tiles long')
    let last = 0
    for (let p = 0.01; p <= 1; p += 0.01) {
      const h = headAt(p, len)
      assert.ok(h >= last, 'never runs backwards')
      assert.ok((h - last) * len < 1.2, `no leap at trip ${p.toFixed(2)} (len ${len})`)
      last = h
    }
  }
  assert.ok(skidFrom(1) > 0 && skidFrom(1) < 1, 'a very short route still skids')
  assert.ok(Math.abs(seenLen(fakeX(0.5)) - 58) < 1e-9)
})

test('one body pass a frame at each end, and in the trip one more for the afterimages only when not crowded', () => {
  for (const v of [0.05, 0.2, 0.4]) assert.equal(frame(fakeX(v)).passes, 1, `departure ${v}`)
  for (const v of [0.6, 0.8]) assert.equal(frame(fakeX(v)).passes, 1, `arrival ${v}`)
  assert.equal(frame(fakeX(0.48)).passes, 2, 'body and capture')
  assert.equal(frame(fakeX(0.48, { lite: true })).passes, 1, 'no afterimages in a crowd')
  assert.equal(STYLE.person(fakeX(0.48)), true, 'the walker item draws nothing while travelling')
  assert.equal(STYLE.person(fakeX(T.RELEASE)), false, 'drawn as usual from the release')
  const hid = fakeX(0.35, { hide: true })
  assert.equal(STYLE.person(hid), true)
  assert.equal(hid.passes, 0, 'a stall user is not seen before the run')
})

// The plan's own routes (collinear points merged): from the smoking corner to desk 13 along y = 7.5, through the
// lounge rug and its coffee table; from the phone spot on the rug to desk 5.
const SMOKE13 = [[34.8, 4.45], [34.5, 5.5], [34.5, 7.5], [15.5, 7.5], [15.5, 8.5]]
const PHONE5 = [[26, 7.3], [25.5, 7.5], [19.5, 7.5], [19.5, 3.5]]
const STREAK = 'rgba(200,96,16,0.55)' // the streak's faint tier, which no spark uses
const RUG = Kit.PART.RUG
const drawn = (v, route, hook) => {
  const X = fakeX(v, { route })
  STYLE[hook](X)
  return X.c.fills.includes(STREAK)
}

test('the streak over the lounge rug is the rug item, never the trip item at the runner\'s depth', () => {
  for (const route of [SMOKE13, PHONE5]) {
    let onRug = 0
    for (let v = DEP; v < ARR + 0.2; v += 0.002) {
      const X = fakeX(v, { route }), n = STYLE.need(X)
      assert.equal(BOLT.trailEnd(X), 1)
      assert.ok(!drawn(v, route, 'trip'), `the trip item draws no streak at ${v.toFixed(3)}`)
      const on = X.L.trip >= 0 || (v >= ARR && v < ARR + 0.5 * (T.RELEASE - ARR))
      assert.equal(!!(n & RUG), on, `the rug stretch keeps the floor stretch's window at ${v.toFixed(3)}`)
      if (n & RUG && drawn(v, route, 'rug')) onRug++
    }
    assert.ok(onRug > 0, 'the rug item draws the stretch over the rug')
  }
  // on and off with the floor stretch: through ARR into the skid, gone once the skid has settled
  for (const v of [ARR - 0.002, ARR + 0.002, ARR + 0.1]) assert.ok(STYLE.need(fakeX(v, { route: SMOKE13 })) & RUG)
  assert.ok(!(STYLE.need(fakeX(0.8, { route: SMOKE13 })) & RUG))
  assert.ok(!(STYLE.need(fakeX(ARR + 0.01, { route: SMOKE13 })) & 64), 'no trip item in the skid')
  assert.ok(!(STYLE.need(fakeX(0.48, { route: [[3.5, 10.5], [12.5, 10.5]] })) & RUG), 'none off the rug')
  // the stretch still on the rug at ARR does not vanish in one frame: the seen part of the plan's route from a
  // restroom stall to desk 7, along y = 6.5 under the sofa
  const WC7 = [[26.5, 5.5], [26.5, 6.5], [16.5, 6.5]]
  const rugAt = v => {
    const X = fakeX(v, { route: WC7, hide: true })
    assert.ok(STYLE.need(X) & RUG)
    STYLE.rug(X)
    return X.c.fills.includes(STREAK)
  }
  assert.ok(rugAt(ARR - 0.002) && rugAt(ARR + 0.002))
  assert.equal(frame(fakeX(ARR + 0.01, { route: WC7, hide: true })).passes, 1, 'no extra body')
})

// The streak's rects drawn by a hook (by day only the streak adds path ops: the glows are stamps).
const rects = (X, f) => {
  const p = X.c.path
  f(X)
  return X.c.path - p
}
test('the floor and rug items split the streak between them: every segment once, none twice', () => {
  for (const route of [SMOKE13, PHONE5]) {
    let rugSegs = 0
    for (let v = DEP; v < ARR + 0.2; v += 0.004) {
      const X = fakeX(v, { route }), n = STYLE.need(X)
      if (!(n & RUG)) continue
      const onRug = rects(X, x => STYLE.rug(x))
      const both = rects(X, x => STYLE.floor(x, 1)) + onRug
      assert.equal(both, rects(fakeX(v, { route }), x => BOLT.trail(x, 2)), `at ${v.toFixed(3)}`)
      if (onRug) rugSegs++
    }
    assert.ok(rugSegs > 0, 'some frames have a rug stretch')
  }
})

test('with no plain floor at either end the trip item draws the whole streak, into the skid', () => {
  const ON = [[22.6, 5.6], [26.4, 5.6], [26.4, 8.5], [22.6, 8.5]] // round the rug, both ends on it
  assert.equal(BOLT.trailEnd(fakeX(0.48, { route: ON })), -1)
  for (const v of [0.48, ARR + 0.01]) {
    const n = STYLE.need(fakeX(v, { route: ON }))
    assert.ok(n & 64 && !(n & RUG), `the trip item alone at ${v}`)
    assert.ok(drawn(v, ON, 'trip'), `the streak is drawn at ${v}`)
  }
  assert.ok(!(STYLE.need(fakeX(0.8, { route: ON })) & 64), 'gone once the skid has settled')
})

test('the streak stays within budget on the longest route, by day, at night and in a crowd', () => {
  for (const lite of [false, true])
    for (const night of [false, true])
      for (let v = 0; v < T.END; v += 0.005) {
        const { c } = frame(fakeX(v, { lite, night }))
        assert.ok(c.path <= 400, `${c.path} path ops at ${v.toFixed(3)}`)
        assert.ok(c.paint <= (lite ? 30 : 60), `${c.paint} paint at ${v.toFixed(3)} lite ${lite}`)
      }
  // the streak is drawn: bright fills mid-trip, none left once the arrival has settled
  const mid = frame(fakeX((DEP + ARR) / 2)).c.fills
  assert.ok(mid.includes('#fffbe0') && mid.includes('#ffd23a'))
  assert.ok(!frame(fakeX(0.75)).c.fills.includes('#ffd23a'), 'no lightning left once the skid has settled')
  assert.ok(TT >= 4)
})

test('the glow bake: three rings, symmetric, transparent corners', () => {
  const px = glowPixels(), W = 44, H = 22
  assert.ok([1, 2, 3].every(k => px.includes(k)))
  assert.equal(px[0], 0)
  assert.equal(px[W * H - 1], 0)
  assert.equal(px[(H / 2) * W + W / 2], 3, 'brightest in the middle')
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) assert.equal(px[y * W + x], px[(H - 1 - y) * W + (W - 1 - x)], `${x},${y}`)
})

test('the scorch: grows with the skid, embers cool, gone by its ttl', () => {
  const [m] = STYLE.marks
  assert.deepEqual(m, { at: 'arr', end: 1, ttl: 3, layer: 'floor' })
  const mark = { id: 'bolt', k: 0, x: 10, y: 10, dir: [-0.89, 0.45], t0: 0, ttl: 3, seed: 3 }
  const draw = (age, night = false) => {
    const X = fakeX(0.6, { night })
    ;[X.x0, X.y0] = Kit.feet(10, 10)
    X.a = null
    X.tp = null
    STYLE.drawMark(X, mark, age)
    return X.c
  }
  const at = age => draw(age).path
  assert.ok(at(0.02) < at(0.3), 'the skid lines lengthen at first')
  assert.ok(draw(0.3).fills.includes('#ff8a1a'), 'hot embers')
  assert.ok(!draw(2).fills.includes('#ff8a1a'), 'cooled by day')
  assert.ok(draw(2, true).fills.includes('#ff8a1a'), 'glowing longer at night')
  const late = draw(2.8)
  assert.ok(late.paint > 0 && Math.max(...late.alpha) < 0.2, 'faint near the end')
  assert.equal(draw(3).paint, 0, 'gone at its ttl')
  assert.ok(TpPerson.MAXCAP >= 66)
})
