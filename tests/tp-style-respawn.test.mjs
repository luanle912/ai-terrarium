// The respawn style's pure parts (web/tp-style-respawn.js): the body cut into 2 px chunks from what shows on top,
// the burst that lands them on the floor, the rain that rebuilds the body from the feet up, the typed banner.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('en')
globalThis.React ??= { createElement: () => null, Component: class {} }
const S = loadWeb('office-scene')
const { ClaudeOffice } = loadWeb('office')
loadWeb('office-agents')
loadWeb('office-draw-people')
loadWeb('office-draw-teleport')
const { TpPerson } = loadWeb('tp-person')
const { Kit } = loadWeb('tp-kit')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const R = loadWeb('tp-style-respawn')
const { STYLE } = R

// A capture of [x, y, w, h, colour index] rects, in paint order.
function cap(cols, rects) {
  const c = TpPerson.newCapture()
  c.cols.push(...cols)
  rects.forEach(([x, y, w, h, k], j) => {
    c.x[j] = x
    c.y[j] = y
    c.w[j] = w
    c.h[j] = h
    c.c[j] = k
  })
  c.n = rects.length
  return c
}
const FX = 100, FY = 200

test('chunks take the colour on top, one per 2 px cell with at least two pixels set', () => {
  // a 6 x 4 shirt, then a 2 x 2 badge painted over its middle, then a lone pixel
  const c = cap(['#shirt', '#badge', '#dot'], [[96, 190, 6, 4, 0], [98, 190, 2, 2, 1], [110, 180, 1, 1, 2]])
  const ch = R.chunkify(c, FX, FY, R.newChunks())
  assert.equal(ch.n, 6, '3 x 2 cells of the shirt; the lone pixel is too thin for a chunk')
  const at = (x, y) => [...Array(ch.n).keys()].find(k => ch.x[k] === x && ch.y[k] === y)
  assert.equal(ch.cols[ch.c[at(98, 190)]], '#badge')
  assert.equal(ch.cols[ch.c[at(96, 190)]], '#shirt')
  assert.equal(ch.cols[ch.c[at(98, 192)]], '#shirt')
  assert.equal(at(110, 180), undefined)
})

test('chunks are capped and stay inside the box round the feet', () => {
  const c = cap(['#a'], [[60, 120, 80, 100, 0]])
  const ch = R.chunkify(c, FX, FY, R.newChunks())
  assert.equal(ch.n, R.MAXCH)
  for (let k = 0; k < ch.n; k++) assert.ok(ch.x[k] >= FX - 20 && ch.x[k] < FX + 20 && ch.y[k] >= FY - 44, `${k}`)
})

test('the burst throws chunks up, then they lie still on the floor band by the feet', () => {
  const c = cap(['#a'], [[96, 176, 8, 24, 0]])
  const ch = R.chunkify(c, FX, FY, R.newChunks()), o = [0, 0]
  let up = 0
  for (let k = 0; k < ch.n; k++) {
    R.burstAt(ch, k, FX, FY, 0, 3, o)
    assert.deepEqual(o, [ch.x[k], ch.y[k]], 'starts where it was')
    R.burstAt(ch, k, FX, FY, 0.2, 3, o)
    if (o[1] < ch.y[k]) up++
    R.burstAt(ch, k, FX, FY, 0.9, 3, o)
    const lie = [...o]
    R.burstAt(ch, k, FX, FY, 1, 3, o)
    assert.deepEqual(o, lie, 'still once landed')
    assert.ok(Math.abs(o[1] - FY) <= 5 && Math.abs(o[0] - FX) <= 48, `${k} lies at ${o}`)
  }
  assert.ok(up > ch.n * 0.6, 'most fly up first')
})

test('the rain lands chunks from the feet up and rebuilds the body exactly', () => {
  const c = cap(['#a', '#b'], [[96, 176, 8, 24, 0], [96, 176, 8, 6, 1]])
  const ch = R.chunkify(c, FX, FY, R.newChunks()), o = [0, 0]
  const feet = [...Array(ch.n).keys()].filter(k => ch.y[k] >= FY - 4)
  const head = [...Array(ch.n).keys()].filter(k => ch.y[k] < FY - 18)
  assert.ok(head.every(k => R.rainAt(ch, k, FX, FY, 0.3, 3, o) < 0), 'the head has not started')
  assert.ok(feet.every(k => R.rainAt(ch, k, FX, FY, 0.4, 3, o) > 0), 'the feet are falling')
  for (let k = 0; k < ch.n; k++) {
    assert.equal(R.rainAt(ch, k, FX, FY, 0, 3, o), -1)
    assert.equal(R.rainAt(ch, k, FX, FY, 1, 3, o), 1)
    assert.deepEqual(o, [ch.x[k], ch.y[k]])
    if (R.rainAt(ch, k, FX, FY, 0.5, 3, o) > 0 && R.rainAt(ch, k, FX, FY, 0.5, 3, o) < 1) assert.ok(o[1] < ch.y[k])
  }
})

test('the banner types one letter at a time', () => {
  assert.equal(R.typed('GAME OVER', 0), 0)
  assert.equal(R.typed('GAME OVER', 0.01), 1)
  assert.equal(R.typed('GAME OVER', 0.5), 5)
  assert.equal(R.typed('GAME OVER', 1), 9)
  assert.equal(R.typed('GAME OVER', 2), 9)
})

test('banner letters: M and W drawn 5 px wide, the rest from the kit font', () => {
  const g = R.runs('MAW')
  assert.equal(g.w, 6 + 4 + 5)
  assert.equal(g.ends.length, 3)
  const cols = new Set()
  for (let k = 0; k < g.ends[0]; k += 3) cols.add(g.g[k])
  assert.deepEqual([...cols].sort(), [0, 1, 2, 3, 4], 'M spans five columns')
  // M has 13 lit pixels, one run each; A is the kit's own runs moved 6 px right
  assert.equal(g.ends[0], 13 * 3)
  const A = R.runs('A').g
  assert.deepEqual(g.g.slice(g.ends[0], g.ends[1]), A.map((v, k) => (k % 3 === 0 ? v + 6 : v)))
  assert.ok(A.length > 0)
  assert.equal(R.runs('MAW'), g, 'cached')
})

// A real person drawn through a recording X: body passes are captured (their extent kept), the context logs rects.
const page = Object.assign(Object.create(ClaudeOffice.prototype), {
  agents: [], state: { speed: 1, paused: false, sel: null }, env: {}, seq: 0, depts: new Map(), snowShown: 0,
})
const agent = page.addAgent({})
const noop = () => {}
const LOG = { rects: 0, top: 1e9, fills: [] }
const ctx = new Proxy({}, {
  get: (_, k) =>
    k === 'getTransform' ? () => ({ a: 1 })
      : k === 'rect' ? (x, y) => (LOG.rects++, (LOG.top = Math.min(LOG.top, y)))
        : k === 'fillRect' ? () => LOG.fills.push(ctx.fillStyle)
          : k in LOG.st ? LOG.st[k] : noop,
  set: (_, k, v) => ((LOG.st[k] = v), true),
})
LOG.st = {}
const G = { ctx, poly: noop, box: noop, rect: noop, th: S.THEMES.day, t: 2.4, df: 1, ev: null, cold: false }
const ORIGIN = [10.5, 8.5], LANDING = [3.5, 4.5]
const extent = c => {
  let top = 1e9, bot = -1e9
  for (let k = 0; k < c.n; k++) (top = Math.min(top, c.y[k])), (bot = Math.max(bot, c.y[k] + c.h[k]))
  return [top, bot]
}
// One frame at core clock c (d is the circle's, so core is real): what person() and stand() did.
function frame(c, { stool = false, hide = false, cut = null, snow = 0, at = ORIGIN } = {}) {
  const tp = { u: c, d: TL.DD, cut, hide, swAt: TL.T.SWITCH, stool }
  const L = TL.phase(tp, false, TL.newPhase())
  const end = L.sw ? LANDING : at
  // the page clears the stool on the forward clock, also while a cut rewinds
  Object.assign(agent, { x: end[0], y: end[1], stool: !L.sw && L.u < TL.T.SQUEEZE ? stool : false, status: 'idle' })
  const f0 = Kit.feet(at[0], at[1])
  const X = {
    a: agent, page, G, ctx, L, tp, lite: false, snow, df: 1, tx0: at[0], ty0: at[1], x0: f0[0], y0: f0[1],
    bodies: [],
    body(o) {
      this.bodies.push({ o, ext: extent(TpPerson.capture(this, o, TpPerson.newCapture())) })
      return true
    },
    capture: (o, out) => TpPerson.capture(X, o, out),
  }
  LOG.rects = 0
  LOG.top = 1e9
  LOG.fills.length = 0
  const ret = STYLE.person(X)
  STYLE.stand(X, 0)
  return { ret, bodies: X.bodies, rects: LOG.rects, top: LOG.top, fills: [...LOG.fills], L }
}
const seated = stool => {
  Object.assign(agent, { x: ORIGIN[0], y: ORIGIN[1], stool, status: 'idle' })
  return extent(TpPerson.capture({ a: agent, page, G, ctx }, {}, TpPerson.newCapture()))
}
const DEP = TL.DEP, at = p => p * DEP

test('a stool sitter is hit on the seat and hops from it: no drop on the first frame, at the hop or at the burst', () => {
  for (const stool of [false, 1, 2]) {
    const first = frame(0, { stool }).bodies[0]
    assert.deepEqual(first.ext, seated(stool), `stool ${stool}: the first frame is the seated body`)
    const before = frame(at(0.155), { stool }).bodies[0].ext, after = frame(at(0.165), { stool }).bodies[0].ext
    assert.ok(Math.abs(before[0] - after[0]) <= 1, `stool ${stool}: the head stays put at the hop, ${before} ${after}`)
    const top = frame(at(0.449), { stool }).bodies[0].ext[0]
    const burst = frame(at(0.451), { stool })
    assert.equal(burst.bodies.length, 0, 'the body is gone at the burst')
    assert.ok(burst.ret && burst.rects > 20, `stool ${stool}: the stand paints the chunks`)
    const lift = stool === 2 ? 9 : stool ? 4 : 0
    assert.equal(top, seated(false)[0] - lift - 10, `stool ${stool}: the hop tops out over the seat`)
  }
})

test('the hit flash shows on snow outdoors: not white there, white elsewhere', () => {
  const out = [[30.5, 10.5], [-3.5, 8.5], [10.5, -4.5]].find(([x, y]) => S.outdoors(x, y))
  assert.ok(out, 'an outdoor tile')
  assert.equal(frame(0, { at: out }).bodies[0].o.tint, '#ffffff')
  const snowy = frame(0, { at: out, snow: 1 }).bodies[0].o.tint
  assert.ok(snowy && snowy !== '#ffffff', `snow tint ${snowy}`)
  assert.equal(frame(0, { snow: 1 }).bodies[0].o.tint, '#ffffff', 'indoors keeps white')
})

test('queued and hidden starts: nothing drawn; a cut rewinds through the burst to the whole body', () => {
  const q = frame(-0.1)
  assert.equal(q.ret, false)
  assert.equal(q.bodies.length + q.rects, 0)
  for (const c of [0.3, 0.4, 0.46]) {
    const h = frame(c, { hide: true })
    assert.equal(h.ret, true, `hidden at ${c}`)
    assert.equal(h.bodies.length, 0)
  }
  // called off at core 0.45 (dep 1 is past the burst): chunks while v is past POP, then the usual body
  const mid = frame(0.45 + TL.T.CUT * 0.5, { cut: 0.45 })
  assert.ok(mid.L.dep >= 0.45 && mid.ret && mid.rects > 20, `chunks at v ${mid.L.v}`)
  // just past POP the chunks have gathered into the body the person is about to show: no drop off the hop or seat
  for (const stool of [false, 2]) {
    const gathered = frame(0.45 + TL.T.CUT * 0.5775, { cut: 0.45, stool })
    assert.ok(gathered.L.dep >= 0.45 && gathered.L.dep < 0.48, `dep ${gathered.L.dep}`)
    assert.ok(Math.abs(gathered.top - seated(false)[0]) <= 2, `stool ${stool}: chunks top ${gathered.top}, body ${seated(false)}`)
  }
  const late = frame(0.45 + TL.T.CUT * 0.9, { cut: 0.45 })
  assert.ok(late.L.dep < 0.45, `v ${late.L.v}`)
  assert.equal(late.ret, false, 'the usual body')
  assert.equal(late.rects, 0, 'no chunks left')
})

test('GAME OVER waits for SIGN; RESPAWN shows; the fade blink never drops below a ghost', () => {
  const panel = f => f.fills.filter(c => c === 'rgba(16,10,30,0.86)').length
  assert.equal(panel(frame(at(0.55))), 0, 'no banner before SIGN')
  assert.equal(panel(frame(at(0.7))), 1, 'GAME OVER after SIGN')
  for (let c = TL.T.RELEASE; c < TL.T.END; c += 0.01) {
    const f = frame(c)
    assert.equal(f.ret, true)
    for (const b of f.bodies) assert.ok(b.o.alpha == null || b.o.alpha >= 0.3, `alpha ${b.o.alpha} at ${c}`)
  }
})

test('the landing: chunks rain in with no body pass, then the person stands whole', () => {
  const land = 0.54 + 0.38 * 0.72
  const rain = frame(land - 0.05)
  assert.ok(rain.ret && rain.bodies.length === 0 && rain.rects > 20, 'the rain is chunks only')
  const pop = frame(land + 0.02)
  assert.equal(pop.bodies.length, 1)
  assert.equal(pop.bodies[0].o.pose, 'stand')
})
