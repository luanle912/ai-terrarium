// The mirror teleport style (web/tp-style-mirror.js): the person's beats, where each mirror stands, and the rise and
// pool shapes on the core clock. The drawing contract itself (budget, context, cuts, crowds) is
// tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { STYLE, MIRROR } = loadWeb('tp-style-mirror')
const { DESKS, BLOCK } = loadWeb('office-scene')
const { beatAt, cover, spotOf, riseOf, poolOf, BACK, BACK2 } = MIRROR
const mode = (v, sw, stool = false, hide = false) => {
  const b = beatAt(v, sw, stool, hide)
  return b && b.mode
}

test('the beats: turn to the glass, walk in, gone; at the landing come out of the glass, step out, stand', () => {
  assert.equal(mode(0.05, false), null, 'drawn as usual before the mirror is up')
  assert.equal(mode(0.15, false), 'face')
  assert.equal(mode(0.15, false, 2), 'perch', 'a stool sitter turns round on the stool')
  assert.equal(mode(0.25, false), 'in')
  assert.equal(mode(0.35, false), 'inside')
  assert.equal(mode(0.45, false), 'gone')
  assert.equal(mode(0.2, false, false, true), 'gone', 'a hidden starter is never shown at the stall')
  assert.equal(mode(0.5, true), 'gone')
  assert.equal(mode(0.6, true), 'inside')
  assert.equal(mode(0.7, true), 'out')
  assert.equal(mode(0.8, true), 'stand')
  assert.equal(mode(0.9, true), null, 'back to the usual walker well before release')
  // progress stays within 0-1 and the reflection shows while they face or cross the glass
  for (let v = 0; v < 0.92; v += 0.005)
    for (const sw of [false, true]) {
      const b = beatAt(v, sw, false, false)
      if (b) assert.ok(b.q >= 0 && b.q <= 1, `q ${b.q} at ${v}`)
    }
  assert.ok(beatAt(0.25, false, false, false).refl && beatAt(0.7, true, false, false).refl)
})

test('person() hides the body while nobody can be there and leaves queued or released people alone', () => {
  const X = (v, sw, o = {}) => ({ L: { v, q: 0, cut: null, hide: false, ...o }, tp: { sw, stool: false } })
  assert.equal(STYLE.person(X(0.45, false)), true)
  assert.equal(STYLE.person(X(0.5, true)), true)
  assert.equal(STYLE.person(X(-0.1, false, { q: 1 })), false)
  assert.equal(STYLE.person(X(0.95, true)), false)
  assert.equal(STYLE.person(X(0.6, true, { cut: 0.5 })), false)
})

test('the mirror rises out of its pool and is gone, pool and all, before the teleport ends', () => {
  for (const end of [0, 1]) {
    let last = riseOf(0, end)
    for (let v = 0; v <= TL.T.END; v += 0.002) {
      const h = riseOf(v, end)
      assert.ok(h >= 0 && h <= 1)
      assert.ok(Math.abs(h - last) < 0.1, `rise jumps at ${v.toFixed(3)} end ${end}`)
      last = h
    }
  }
  assert.equal(riseOf(0.5, 0), 0, 'the origin mirror has sunk by the switch')
  assert.equal(riseOf(0.28, 1), 0, 'nothing at the landing before a hidden starter can be seen')
  assert.equal(poolOf(0.28, 1), 0)
  assert.equal(riseOf(1.15, 1), 0)
  assert.equal(poolOf(1.24, 1), 0)
  assert.equal(poolOf(0.56, 0), 0)
})

test('where a mirror stands: the preferred side unless furniture in front would hide it, the same every frame', () => {
  for (const d of DESKS)
    for (const [tx, ty] of [
      [d.gx + 0.5, d.gy - 0.5],
      [d.gx - 0.5, d.gy + 1.5],
      [d.gx + 1.5, d.gy + 1.5],
    ])
      for (const pref of [-1, 1]) {
        const s = spotOf(tx, ty, pref)
        assert.equal(spotOf(tx, ty, pref), s, 'cached, no new array per frame')
        assert.ok(s[0] === 1 || s[0] === -1)
        assert.ok(s[1] === BACK || s[1] === BACK2)
        const best = Math.min(...[[pref, BACK], [-pref, BACK], [pref, BACK2], [-pref, BACK2]]
          .map(([si, b]) => cover(tx, ty, 9 * si, -b)))
        assert.equal(cover(tx, ty, 9 * s[0], -s[1]), best, 'the clearest spot')
      }
  // open lawn: nothing to dodge, so the preferred side close behind the feet
  assert.deepEqual([...spotOf(30.5, 20.5, 1)], [1, BACK])
  assert.deepEqual([...spotOf(30.5, 20.5, -1)], [-1, BACK])
  // a desk just in front covers a mirror standing right behind it
  const d = DESKS[0]
  assert.ok(BLOCK.has(d.gx + ',' + d.gy))
  assert.ok(cover(d.gx - 0.5, d.gy - 0.5, 0, -BACK) > 0)
})

const STAMPS = []
const rec = () => new Proxy({ globalAlpha: 1 }, {
  get: (s, k) => k in s ? s[k] : k === 'getTransform' ? () => ({ a: 1 }) : /Gradient$/.test(k) ? () => ({ addColorStop() {} })
    : k === 'measureText' ? () => ({ width: 0 }) : k === 'getLineDash' ? () => [] : (...a) => { if (k === 'drawImage') STAMPS.push(a) },
  set: (s, k, v) => ((s[k] = v), true),
})
globalThis.document ??= { visibilityState: 'visible', createElement: () => ({ width: 0, height: 0, getContext: rec }) }

// A page with one person idle at spot `from`, sent to `desk` and stepped to core `at` (0.2: the origin mirror up).
function departing(from, at = 0.2, desk = 12) {
  const S = loadWeb('office-scene'), { ClaudeOffice } = loadWeb('office')
  loadWeb('office-agents'); loadWeb('office-draw-xmas'); loadWeb('office-draw-people'); loadWeb('office-draw-teleport')
  const sp = S.IDLE_SPOTS[from]
  const a = { id: 13, desk, status: 'idle', x: sp.pt[0], y: sp.pt[1], path: [], goalKey: 'idle' + from,
    seated: false, sleeping: false, stool: sp.stool || false, actNow: sp.act, idleSpot: from, moving: false,
    dirFront: true, parent: null, leaving: false, target: null, wcT: 0, wcIn: false, tp: null, until: 1e15 }
  const p = Object.assign(Object.create(ClaudeOffice.prototype), { agents: [a], state: { speed: 1, paused: false },
    env: {}, seasonNow: () => 'default', eventNow: () => null,
    idleCtx: () => ({ level: 0, snow: 0, frozen: false, calm: false }) })
  // the screen x of every mirror body stamp (atlas cell 0) this frame
  const mirrorX = () => {
    STAMPS.length = 0
    const items = []
    p.tpItems({ ctx: rec(), poly() {}, box() {}, rect() {}, th: S.THEMES.day, t: 1, df: 1, look: null }, items)
    items.forEach(it => it.f())
    return STAMPS.filter(s => s.length === 9 && s[1] === 0 && s[2] === 0).map(s => s[5]).join(' ')
  }
  a.status = 'working'
  while (!(a.tp && TL.core(a.tp.u, a.tp.d) >= at)) p.updateAgent(a, 1 / 60)
  return { a, p, mirrorX }
}

test('a call-off or a new desk while the origin mirror is up leaves it where it stood', () => {
  const { TpStyles } = loadWeb('tp-styles')
  const { DESKS: D } = loadWeb('office-scene')
  TpStyles.setChoice('mirror')
  try {
    let cuts = 0, aims = 0
    for (const [from, to] of [[0, 5], [5, 0], [0, 14], [14, 0], [3, 20], [20, 3]]) {
      const { a, p, mirrorX } = departing(from)
      assert.equal(a.tp.style, 'mirror')
      const before = mirrorX()
      assert.ok(before.length > 0, 'the origin mirror is up')
      a.idleSpot = to
      a.status = 'idle'
      p.updateAgent(a, 1 / 60)
      assert.ok(a.tp && a.tp.cut != null, 'called off')
      assert.equal(mirrorX(), before, `idle ${from}, called off toward idle ${to}`)
      cuts++
    }
    // re-aimed before L_IN to a landing across the origin (plan's early branch: a copy with a new x1, y1): the travel
    // turns round, the mirror stays
    for (const from of [0, 3, 5, 14, 20]) {
      const { a, mirrorX } = departing(from)
      const before = mirrorX(), side = Math.sign(a.tp.x1 - a.tp.y1 - a.tp.x0 + a.tp.y0)
      const far = D.findIndex(d => Math.sign(d.gx - d.gy - a.tp.x0 + a.tp.y0) === -side)
      if (far < 0) continue
      a.tp = { ...a.tp, x1: D[far].gx + 0.5, y1: D[far].gy - 0.5, desk: far }
      assert.equal(mirrorX(), before, `idle ${from} re-aimed to desk ${far}`)
      aims++
    }
    // a late re-aim keeps the landing but may change the desk: the landing mirror stays
    for (const home of [0, 2, 5, 9, 12, 14]) {
      const { a, mirrorX } = departing(0, 0.7, home)
      if (!a.tp || !a.tp.sw) continue
      const before = mirrorX()
      assert.ok(before.length > 0, 'the landing mirror is up')
      for (let desk = 0; desk < D.length; desk++) {
        a.tp = { ...a.tp, desk }
        assert.equal(mirrorX(), before, `desk ${home}, then desk ${desk}`)
      }
    }
    assert.ok(cuts > 0 && aims > 0, `checked ${cuts} call-offs and ${aims} re-aims`)
  } finally {
    TpStyles.setChoice('random')
  }
})

test('the spot cache follows the Christmas tree: blocking or freeing its cells re-picks the spot', () => {
  const { EventLogic } = loadWeb('event-logic')
  const was = ['9,6', '9,7'].map(k => BLOCK.has(k))
  const fresh = (tx, ty, pref) => {
    let best = 1e9, v = null
    for (const c of [[pref, BACK], [-pref, BACK], [pref, BACK2], [-pref, BACK2]]) {
      const n = cover(tx, ty, MIRROR.SIDE * c[0], -c[1])
      if (n < best) (best = n), (v = c)
    }
    return v
  }
  try {
    for (const on of [false, true, false]) {
      EventLogic.block(BLOCK, on)
      for (const [tx, ty, pref] of [[9.5, 8.5, 1], [10.5, 6.5, -1], [10.5, 7.5, -1]])
        assert.deepEqual(spotOf(tx, ty, pref), fresh(tx, ty, pref), `tree ${on} at ${tx},${ty}`)
    }
  } finally {
    ;['9,6', '9,7'].forEach((k, i) => (was[i] ? BLOCK.add(k) : BLOCK.delete(k)))
  }
})
