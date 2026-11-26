// The cannon teleport style (web/tp-style-cannon.js): the beats on the core clock, the hand-overs between the cannon,
// the flight, the parachute and the marks, the trail's purity and the items it asks for. The drawing contract itself
// (budget, context, cuts, crowds) is tests/tp-style-contract.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

globalThis.React ??= { createElement: () => null, Component: class {} }
loadWeb('office')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { TpStyles } = loadWeb('tp-styles')
const { Kit } = loadWeb('tp-kit')
const { CANNON: M, STYLE, cannonPixels, chutePixels } = loadWeb('tp-style-cannon')
const { B } = M
const { T, DEP, ARR } = TL
const REL = T.RELEASE
const D = [1, 2, 1, 0.4]
const PART = Kit.PART

// A minimal X at core v: the landing up and to the left of the origin, so the cannon points left (side -1).
function fakeX(v, { stool = false, hide = false, cut = null, lite = false, len = 24 } = {}) {
  const tp = { u: TL.real(v, D), d: D, swAt: DEP, cut, hide, stool, len }
  return {
    x0: 400, y0: 300, x1: 200, y1: 200, tx0: 20, ty0: 10, tx1: 5, ty1: 6, dir0: [-0.9, -0.4], dir1: [-0.9, -0.4],
    lite, night: false, snow: 0, tp, L: TL.phase(tp, false, TL.newPhase()),
    hash: (k, salt) => ((k * 37 + salt * 11) % 100) / 100,
  }
}
const dep = (v, o) => {
  const X = fakeX(v, o)
  return { ...M.departure(X, X.L.v, 0) }
}
const fly = (t, o) => {
  const X = fakeX(DEP + t * (ARR - DEP), o)
  return { ...M.flight(X, t, 0) }
}
const land = (v, o) => {
  const X = fakeX(v, o)
  return { ...M.arrival(X, X.L.v, 0) }
}

test('the profile and the beats come in order inside their segments', () => {
  const p = TpStyles.BY_ID.cannon
  assert.deepEqual([p.tier, p.kind], ['F', 'air'])
  assert.ok(B.DROP < B.THUD && B.THUD < B.SET && B.SET <= B.HOP && B.HOP + B.IN < B.FUSE + 0.1)
  for (const stool of [false, 1, 2]) {
    const h = M.hop0(stool)
    assert.ok(h + B.TOP < Math.min(h + B.IN, DEP - 0.03), `over the muzzle, then in, before the shot (${stool})`)
    if (stool) assert.equal(h, T.SQUEEZE, 'a stool sitter climbs once off the stool')
  }
  assert.ok(B.FUSE < B.SHAKE && B.SHAKE < DEP)
  assert.ok(B.FLIP + 0.16 < B.OPEN && B.OPEN < 1)
  assert.ok(ARR < B.DOWN && B.DOWN < B.FOLD && B.FOLD < B.TADA && B.TADA < REL)
})

test('they hop into the muzzle and are out of sight before the shot', () => {
  for (const stool of [false, 1, 2]) {
    const a = dep(M.hop0(stool) + B.TOP, { stool })
    assert.ok(a.body && a.fy < 300 - 10, `over the muzzle (${stool})`)
    const b = dep(DEP - 1e-6, { stool })
    assert.equal(b.body, false, 'gone down the barrel')
    assert.ok(b.lip)
  }
  // the cannon stands ahead of the feet, toward the landing, on the floor once dropped
  const c = dep(B.SET)
  assert.ok(c.cx < 400 && c.cy === 300)
  assert.ok(dep(B.DROP + 0.01).cy < 280, 'falling in from above')
})

test('the shot: the live cannon hands over to the mark, the flight leaves from the muzzle', () => {
  const live = dep(DEP - 1e-6)
  // the mark draws the cannon from the same ground point (no recoil at age 0); shake is at most 1 px
  assert.ok(Math.abs(live.cx - (400 - 8)) <= 1 && live.cy === 300)
  const f = fly(0)
  assert.ok(Math.abs(f.hx - (400 - 8 - M.MZ[0])) <= 1, 'leaves from the muzzle')
  assert.ok(Math.abs(f.hy - (300 + M.MZ[1])) <= 1)
  assert.ok([0, 3].includes(f.rot), 'head first, up or toward the landing')
  assert.ok(f.h < 24, 'low at take-off: sorts with the furniture')
})

test('the flight arcs high, turns head first, flips over the top and hangs under the canopy', () => {
  assert.ok(fly(0.3).h > 60, 'well over the island')
  for (let t = 0; t < B.FLIP; t += 0.02) assert.ok([0, 3].includes(fly(t).rot), 'climbing head first, leftwards')
  for (let t = B.FLIP + 0.17; t < B.OPEN; t += 0.02) assert.ok([2, 3].includes(fly(t).rot), 'diving head first')
  const rots = new Set()
  for (let t = B.FLIP; t < B.FLIP + 0.16; t += 0.01) rots.add(fly(t).rot)
  assert.equal(rots.size, 4, 'a full somersault')
  const g = fly(B.OPEN + 0.05)
  assert.ok(g.chute >= 0 && g.rot === 0)
  assert.ok(fly(1).h < 24, 'low at the end of the trip')
})

test('the first frame of the shot already points along the flight, on a steep route too', () => {
  for (const [x1, y1] of [[200, 200], [395, 80]]) {
    const at = t => {
      const X = Object.assign(fakeX(DEP + t * (ARR - DEP)), { x1, y1 })
      return M.flight(X, t, 0).rot
    }
    assert.equal(at(0), at(0.03), `to ${x1}, ${y1}`)
  }
})

test('trip end, descent and touchdown hand over without a jump', () => {
  const f = fly(1), a = land(ARR)
  assert.ok(Math.abs(f.hx - a.fx) <= 2 && Math.abs(f.hy + M.HIP - a.fy) <= 1, JSON.stringify([f, a]))
  assert.equal(a.k, 2)
  assert.equal(land(B.DOWN).fy, 200, 'touched down')
  const fold = land(REL - 1e-6)
  assert.equal(fold.k, 4)
  assert.deepEqual([fold.kx, fold.ky], [200 + M.BACK, 200 - 3], 'folded behind them, where the mark lies')
  assert.equal(land(REL - 1e-6).pose, 'stand')
})

test('the marks outlive the trip and fade before their ttl', () => {
  const [gun, pile] = STYLE.marks
  assert.deepEqual([gun.at, gun.end, gun.layer, pile.at, pile.end, pile.layer], ['dep', 0, 'stand', 'rel', 1, 'floor'])
  assert.ok(M.M.STAY + M.M.OUT <= M.M.TTL && M.M.PILE_OUT < M.M.PILE)
  assert.equal(gun.ttl, M.M.TTL)
  // the pile is drawn after the tp has ended, so a teleport always leaves something behind for a moment
  assert.ok(pile.ttl > D[3])
})

test('the smoke trail is pure in the clock, only before the canopy, none in a cut, thinner in a crowd', () => {
  const X = fakeX(DEP + 0.3 * (ARR - DEP))
  const a = [...M.trail(X)], b = [...M.trail(X)]
  assert.ok(a.length > 6)
  assert.deepEqual(a, b)
  assert.ok(M.trail(fakeX(DEP + 0.3 * (ARR - DEP), { lite: true })).length < a.length)
  assert.equal(M.trail(fakeX(0.3, { cut: TL.real(0.3, D) - 0.01 })).length, 0)
  assert.equal(M.trail(fakeX(B.DOWN)).length, 0, 'faded by touchdown')
})

test('need: cannon floor at the origin, the trip and its shadow, the landing floor; nothing queued or hidden', () => {
  const need = (v, o) => STYLE.need(fakeX(v, o))
  assert.equal(need(0.1), PART.F0)
  assert.equal(need(DEP + 0.05), PART.TRIP | PART.SHADOW)
  assert.equal(need(ARR + 0.1), PART.F1)
  assert.equal(need(REL + 0.01), 0)
  assert.equal(need(0.3, { hide: true }), 0)
  const q = fakeX(0)
  q.tp.u = -0.2
  q.L = TL.phase(q.tp, false, TL.newPhase())
  assert.equal(STYLE.need(q), 0)
  assert.equal(STYLE.person(q), false)
  // a hidden starter is kept out of sight until the flight
  assert.equal(STYLE.person(fakeX(0.35, { hide: true })), true)
})

test('the rasters: the barrel points the way it flies, the canopy is striped and outlined', () => {
  const px = cannonPixels(1), ink = px.filter(c => c).length
  assert.ok(ink > 150 && ink < 600)
  const mir = cannonPixels(-1)
  let same = 0
  for (let y = 0; y < 32; y++) for (let x = 0; x < 36; x++) if (px[y * 36 + x] && px[y * 36 + x] === mir[y * 36 + 35 - x]) same++
  assert.ok(same > ink * 0.9, 'the left cannon mirrors the right one')
  assert.ok(cannonPixels(1, true).filter(c => c).length < ink / 3, 'the lip is the muzzle end only')
  const full = chutePixels(2, 1)
  for (const c of [1, 2, 4]) assert.ok(full.includes(c), `canopy colour ${c}`)
})
