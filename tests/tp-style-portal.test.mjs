// The twin gates (web/tp-style-portal.js): the gates' clocks, the person's walk in and out, where the gates stand
// and that a fully open gate hides a person standing in its middle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const P = loadWeb('tp-style-portal')
const { T } = TL
const clocks = (a, b) => Array.from({ length: Math.round((b - a) / 0.005) }, (_, j) => a + j * 0.005)

test('the person is drawn as usual before the walk in and from the end of the step out, hidden in between', () => {
  for (const v of [-0.3, 0, 0.1, 0.25]) assert.equal(P.walkAt(v).show, 'usual', `core ${v}`)
  assert.equal(P.walkAt(0.3).show, 'in')
  for (const v of [0.4, 0.48, 0.55]) assert.equal(P.walkAt(v).show, 'hidden', `core ${v}`)
  assert.equal(P.walkAt(0.65).show, 'out')
  for (const v of clocks(T.RELEASE, 1.4)) assert.equal(P.walkAt(v).show, 'usual', `core ${v}`)
  // the walk in starts once a stool sitter is off the stool (teleport-logic keeps it until SQUEEZE)
  for (const v of clocks(0, T.SQUEEZE)) assert.equal(P.walkAt(v).show, 'usual')
  const a = P.walkAt(0.3).p, b = P.walkAt(0.35).p
  assert.ok(a > 0 && b > a && b < 1)
})

test('each walk happens in front of a fully open gate', () => {
  for (const v of clocks(0.26, 0.385)) assert.ok(P.gateAt(v, 0).open === 1, `origin open at ${v}`)
  for (const v of clocks(0.56, 0.74)) assert.ok(P.gateAt(v, 1).open === 1, `landing open at ${v}`)
})

test('a gate shows at every clock before release, the hidden start included, and none while queued', () => {
  for (const v of clocks(0, T.RELEASE)) {
    const o = P.gateAt(v, 0).mode, l = P.gateAt(v, 1).mode
    assert.ok(o !== 'off' || l !== 'off', `core ${v}`)
  }
  // a stall user's clock starts at L_IN with no origin items: the landing gate opens from its slit
  for (const v of clocks(T.L_IN, T.RELEASE)) assert.notEqual(P.gateAt(v, 1).mode, 'off', `core ${v}`)
  assert.equal(P.gateAt(-0.1, 0).mode, 'off')
  assert.equal(P.gateAt(-0.1, 1).mode, 'off')
  assert.equal(P.gateAt(1.3, 1).mode, 'off')
  // the origin gate is gone before the landing gate closes: never both at the end
  assert.equal(P.gateAt(0.7, 0).mode, 'off')
})

test('the gates stand beside the person: ahead at the origin, behind at the landing, on whole pixels', () => {
  const out = [0, 0, 0]
  assert.deepEqual(P.gateSpot(100, 200, [0.9, 0.45], 0, out), [100 + P.OFF[0], 200 + P.OFF[1], 1])
  assert.deepEqual(P.gateSpot(100, 200, [0.9, -0.45], 1, out), [100 - P.OFF[0], 200 + P.OFF[1], 1])
  assert.deepEqual(P.gateSpot(100, 200, [-0.9, 0.45], 1, out), [100 + P.OFF[0], 200 - P.OFF[1], -1])
  assert.ok(Number.isInteger(P.OFF[0]) && P.OFF[0] >= 13, 'clear of a person standing at the feet')
})

test('a fully open gate covers a person standing in its middle, every spin frame, both colours', () => {
  const { W, H } = P.CELL
  for (const end of [0, 1])
    for (let f = 0; f < P.FRAMES; f++) {
      const px = P.gatePixels(f, -1, end), cx = (W - 1) / 2
      assert.equal(px.length, W * H)
      // feet one row above the bottom outline row; the person is up to 10 px wide and 26 px tall
      for (let y = H - 2; y >= H - 28; y--)
        for (let x = cx - 4; x <= cx + 4; x++) assert.ok(px[y * W + x] > 0, `frame ${f} end ${end} at ${x},${y}`)
    }
  // opening frames grow from a slit and stand on the same bottom row
  let last = 0
  for (let k = 0; k < 4; k++) {
    const px = P.gatePixels(0, k, 0), n = px.filter(Boolean).length
    assert.ok(n > last, `open frame ${k} grows`)
    last = n
    assert.ok(px.slice((H - 1) * W).some(Boolean), `open frame ${k} on the floor`)
  }
})

test('a gate stands a set distance along the path, on its legs, clamped to a short path', () => {
  const pts = [[0, 0], [0.5, 0], [0.5, 2]]
  assert.deepEqual(P.walkPath(pts, 0.25), [0.25, 0])
  assert.deepEqual(P.walkPath(pts, 0.9), [0.5, 0.4])
  assert.deepEqual(P.walkPath(pts, 9), [0.5, 2])
  assert.deepEqual(P.walkPath([[3, 4]], 0.9), [3, 4])
})

test('the figure sinks into the origin gate and rises in the landing gate, only while that gate is open', () => {
  const s = (v, end) => P.ghostAt(v, end) && P.ghostAt(v, end).s
  assert.equal(P.ghostAt(0.3, 0), null)
  assert.equal(P.ghostAt(0.45, 1), null)
  assert.equal(P.ghostAt(0.6, 1), null)
  assert.ok(s(0.39, 0) > s(0.41, 0), 'shrinks at the origin')
  assert.ok(s(0.47, 1) < s(0.55, 1), 'grows at the landing')
  for (const [a, b, end] of [[0.385, 0.42, 0], [0.46, 0.56, 1]])
    for (const v of clocks(a, b)) {
      assert.equal(P.gateAt(v, end).mode, 'open', `gate ${end} open at ${v}`)
      const g = P.ghostAt(v, end)
      assert.ok(g.s > 0 && g.s <= 0.8 && g.a > 0 && g.a <= 0.9, `ghost at ${v}`)
    }
})

// A canvas that records stamps; enough for the dispatcher and the gate atlas.
const STAMPS = []
const rec = () => new Proxy({ globalAlpha: 1 }, {
  get: (s, k) => k in s ? s[k] : k === 'getTransform' ? () => ({ a: 1 }) : /Gradient$/.test(k) ? () => ({ addColorStop() {} })
    : k === 'measureText' ? () => ({ width: 0 }) : k === 'getLineDash' ? () => [] : (...a) => { if (k === 'drawImage') STAMPS.push(a) },
  set: (s, k, v) => ((s[k] = v), true),
})
globalThis.document ??= { visibilityState: 'visible', createElement: () => ({ width: 0, height: 0, getContext: rec }) }

test('a cut toward an idle spot the other way leaves both gates where they stood', () => {
  const S = loadWeb('office-scene'), { ClaudeOffice } = loadWeb('office')
  loadWeb('office-agents'); loadWeb('office-draw-xmas'); loadWeb('office-draw-people'); loadWeb('office-draw-teleport')
  const { TpStyles } = loadWeb('tp-styles')
  TpStyles.setChoice('portal')
  try {
    const sp = S.IDLE_SPOTS[0], dk = S.DESKS[12]
    const a = { id: 13, desk: 12, status: 'idle', x: sp.pt[0], y: sp.pt[1], path: [], goalKey: 'idle0', seated: false,
      sleeping: false, stool: false, actNow: sp.act, idleSpot: 0, moving: false, dirFront: true, parent: null,
      leaving: false, target: null, wcT: 0, wcIn: false, tp: null, until: 1e15 }
    const p = Object.assign(Object.create(ClaudeOffice.prototype), { agents: [a], state: { speed: 1, paused: false },
      env: {}, seasonNow: () => 'default', eventNow: () => null,
      idleCtx: () => ({ level: 0, snow: 0, frozen: false, calm: false }) })
    const gates = () => {
      STAMPS.length = 0
      const items = []
      p.tpItems({ ctx: rec(), poly() {}, box() {}, rect() {}, th: S.THEMES.day, t: 1, df: 1, look: null }, items)
      items.forEach(it => it.f())
      return STAMPS.filter(s => s.length === 9).map(s => s.slice(5, 7).join(',')).sort().join(' ')
    }
    a.status = 'working'
    while (!(a.tp && TL.core(a.tp.u, a.tp.d) >= 0.2)) p.updateAgent(a, 1 / 60)
    assert.ok(dk && a.tp.style === 'portal')
    const before = gates()
    assert.ok(before.length > 0, 'the gates are drawn')
    a.idleSpot = 5
    a.status = 'idle'
    p.updateAgent(a, 1 / 60)
    assert.ok(a.tp && a.tp.cut != null, 'called off')
    assert.equal(gates(), before)
  } finally {
    TpStyles.setChoice('random')
  }
})
