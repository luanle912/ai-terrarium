import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWorldLogic } from './load-world-logic.mjs'

const W = loadWorldLogic()
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`)

test('the world camera, spiral layout and level-of-detail helpers are gone (Task 5)', () => {
  for (const k of ['SPACING', 'layout', 'lodFor', 'THUMB_PX', 'pickRedraws', 'visible', 'fitAll', 'focusOn', 'camStep', 'toWorld', 'toScreen'])
    assert.equal(W[k], undefined, k)
  assert.equal(W.ISLAND_ASPECT, 0.62)
})

test('clientSessions maps a public view', () => {
  const out = W.clientSessions([
    { id: 's1', parent: 'p', status: 'working', waitingOn: null, talkingTo: 'x', dept: 'proj', kind: 'main', tool: 'Bash', model: 'm' },
    { id: 's2', parent: null, status: 'idle', waitingOn: null, talkingTo: null, dept: 'proj', kind: 'main' },
    { parent: 'p', status: 'idle' },
    { id: 7 },
  ])
  assert.equal(out.length, 2)
  assert.deepEqual(Object.keys(out[0]).sort(), ['id', 'kind', 'model', 'parentId', 'project', 'status', 'talkingTo', 'tool', 'waitingOn'])
  assert.equal(out[0].parentId, 'p')
  assert.equal(out[0].project, 'proj')
  assert.deepEqual(Object.keys(out[1]).sort(), ['id', 'kind', 'parentId', 'project', 'status', 'talkingTo', 'waitingOn'])
})

// ---- 8-island sky (Task 4) ----
const inside = (r, w, h) => r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= w + 1e-9 && r.y + r.h <= h + 1e-9
const overlap = (a, b) => a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9
const cx = (r) => r.x + r.w / 2
const cy = (r) => r.y + r.h / 2
const ALL = [0, 1, 2, 3, 4, 5, 6, 7]
const rects = (l) => [l.centre.rect, ...l.cells.map((c) => c.rect)]
const noOverlap = (l) => {
  const rs = rects(l)
  for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) assert.ok(!overlap(rs[a], rs[b]), `rects ${a},${b} overlap`)
}
const STAGES = [[1280, 720], [1024, 576], [800, 450]]

test('sky constants', () => {
  assert.equal(W.SLOTS, 8)
  assert.equal(W.PHONE_MAX_W, 520)
  assert.equal(W.CENTRE_SCALE, 1.4)
  assert.equal(W.HOVER_LIFT, 6)
  assert.equal(W.GUTTER, 12)
  assert.equal(W.CLOUD_MS, W.CLOUD_IN_MS + W.CLOUD_HOLD_MS + W.CLOUD_OUT_MS)
  assert.equal(W.FADE_MS, 200)
})

test('me with 7 others', () => {
  for (const [sw, sh] of STAGES) {
    const l = W.skyLayout(ALL, 2, sw, sh)
    assert.equal(l.phone, false)
    assert.equal(l.centre.kind, 'mine')
    assert.equal(l.centre.slot, 2)
    assert.deepEqual(l.cells.map((c) => c.slot), [3, 4, 5, 6, 7, 0, 1])
    assert.ok(l.cells.every((c) => c.kind === 'island'))
    for (const r of rects(l)) assert.ok(inside(r, sw, sh), `inside ${sw}x${sh}`)
    noOverlap(l)
    for (const c of l.cells) {
      assert.ok(l.centre.rect.w >= 1.3 * c.rect.w)
      close(c.rect.h, c.rect.w * W.ISLAND_ASPECT, 1e-6)
      close(c.rect.w, l.cells[0].rect.w)
    }
    close(l.centre.rect.w, W.CENTRE_SCALE * l.cells[0].rect.w, 1e-6)
    assert.ok(Math.abs(cx(l.centre.rect) - sw / 2) <= 0.06 * sw)
    assert.ok(cy(l.centre.rect) >= sh / 2)
    const c = l.cells.map((x) => x.rect)
    assert.ok(cy(c[0]) === cy(c[1]) && cy(c[1]) === cy(c[2]) && cx(c[0]) < cx(c[1]) && cx(c[1]) < cx(c[2]))
    assert.ok(cx(c[3]) > cx(l.centre.rect))
    assert.ok(cy(c[4]) === cy(c[5]) && cy(c[4]) > cy(c[2]) && cx(c[4]) > cx(c[5]))
    assert.ok(cx(c[6]) < cx(l.centre.rect))
  }
})

test('ring cell size at 1280x720 is the largest that fits', () => {
  const l = W.skyLayout(ALL, 0, 1280, 720)
  const w = Math.min((1280 - 4 * 12) / 3.4, (720 - 4 * 12) / (3.5 * W.ISLAND_ASPECT))
  close(l.cells[0].rect.w, w, 1e-6)
})

test('me with 3 others', () => {
  const l = W.skyLayout([1, 4, 5, 6], 4, 1280, 720)
  assert.deepEqual(l.cells.map((c) => c.slot), [5, 6, 7, 0, 1, 2, 3])
  assert.deepEqual(l.cells.map((c) => c.kind), ['island', 'island', 'empty', 'empty', 'island', 'empty', 'empty'])
  const full = W.skyLayout(ALL, 4, 1280, 720)
  assert.deepEqual(l.cells.map((c) => c.rect), full.cells.map((c) => c.rect))
  assert.deepEqual(l.centre.rect, full.centre.rect)
})

test('neighbours are stable for a viewer', () => {
  const a = W.skyLayout([1, 4], 4, 1280, 720)
  const b = W.skyLayout([1, 4, 6], 4, 1280, 720)
  assert.deepEqual(a.cells.map((c) => c.rect), b.cells.map((c) => c.rect))
  assert.deepEqual(a.centre, b.centre)
})

test('me with no island and room: the centre is "yours" at the smallest free slot', () => {
  const l = W.skyLayout([0, 1, 3], null, 1280, 720)
  assert.equal(l.centre.kind, 'yours')
  assert.equal(l.centre.slot, 2)
  assert.deepEqual(l.cells.map((c) => c.slot), [3, 4, 5, 6, 7, 0, 1])
})

test('me with no island on a full hub: the centre says full and 8 cells ring it', () => {
  for (const [sw, sh] of STAGES) {
    const l = W.skyLayout(ALL, null, sw, sh)
    assert.equal(l.centre.kind, 'full')
    assert.equal(l.centre.slot, null)
    assert.deepEqual(l.cells.map((c) => c.slot), ALL)
    const c = l.cells.map((x) => x.rect)
    assert.ok(cy(c[4]) === cy(c[5]) && cy(c[5]) === cy(c[6]) && cy(c[4]) > cy(c[3]))
    assert.ok(cx(c[4]) > cx(c[5]) && cx(c[5]) > cx(c[6]) && cx(c[7]) < cx(l.centre.rect))
    for (const r of rects(l)) assert.ok(inside(r, sw, sh))
    noOverlap(l)
  }
})

test('bad slots are ignored', () => {
  const a = W.skyLayout([0, 0, 9, -1, 2.5, '3'], 5, 1280, 720)
  const b = W.skyLayout([0], 5, 1280, 720)
  assert.deepEqual(a, b)
})

test('layout is deterministic', () => {
  assert.deepEqual(W.skyLayout([3, 1], 2, 1024, 576), W.skyLayout([3, 1], 2, 1024, 576))
})

test('phone: my island on top, the others in two columns', () => {
  const l = W.skyLayout(ALL, 5, 390, 700)
  assert.equal(l.phone, true)
  assert.equal(l.centre.rect.x, 12)
  assert.equal(l.centre.rect.w, 366)
  for (const c of l.cells) assert.ok(c.rect.y >= l.centre.rect.y + l.centre.rect.h)
  l.cells.forEach((c, i) => {
    assert.ok(c.rect.x < 195 === (i % 2 === 0), `column of ${i}`)
    close(c.rect.y, l.cells[i - (i % 2)].rect.y)
    if (i >= 2) assert.ok(c.rect.y > l.cells[i - 2].rect.y)
  })
  close(l.cells[0].rect.w, l.cells[1].rect.w)
  noOverlap(l)
  const last = l.cells[6].rect
  close(l.height, last.y + last.h + 12)
  assert.ok(l.height > 700)
  assert.equal(W.skyLayout(ALL, 5, 375, 600).phone, true)
  assert.equal(W.skyLayout(ALL, 5, 521, 700).phone, false)
  assert.equal(W.skyLayout(ALL, 5, 520, 700).phone, true)
  assert.equal(W.skyLayout(ALL, 5, 1280, 720).height, 720)
})

test('hit testing uses the layout rects', () => {
  const l = W.skyLayout([0, 1, 2, 5], 2, 1280, 720)
  for (const c of l.cells) {
    const h = W.skyHit(l, cx(c.rect), cy(c.rect))
    assert.deepEqual(h, { slot: c.slot, kind: c.kind, centre: false })
  }
  assert.deepEqual(W.skyHit(l, cx(l.centre.rect), cy(l.centre.rect)), { slot: 2, kind: 'mine', centre: true })
  assert.equal(W.skyHit(l, -5, -5), null)
  assert.equal(W.skyHit(l, 1279, 719), null)
  const f = W.skyLayout(ALL, null, 1280, 720)
  assert.equal(W.skyHit(f, cx(f.centre.rect), cy(f.centre.rect)).kind, 'full')
  const p = W.skyLayout(ALL, 5, 390, 700)
  const row4 = p.cells[6].rect
  assert.equal(W.skyHit(p, cx(row4), cy(row4)).slot, p.cells[6].slot)
})

test('hit testing checks the centre first', () => {
  const l = W.skyLayout(ALL, 0, 1280, 720)
  const probe = { ...l, cells: [{ slot: 3, kind: 'island', rect: { ...l.centre.rect } }] }
  assert.equal(W.skyHit(probe, cx(l.centre.rect), cy(l.centre.rect)).centre, true)
})

test('easeInOut', () => {
  assert.equal(W.easeInOut(0), 0)
  assert.equal(W.easeInOut(0.5), 0.5)
  assert.equal(W.easeInOut(1), 1)
  assert.equal(W.easeInOut(-3), 0)
  assert.equal(W.easeInOut(7), 1)
  close(W.easeInOut(0.25), 0.125)
})

test('cloud timeline: in 350 ms, hold 100 ms, out 400 ms', () => {
  const at = (e) => W.cloudPhase(e, false)
  for (const [e, v] of [[0, 0], [175, 0.5], [349, 1], [350, 1], [449, 1], [450, 1], [650, 0.5], [849, 0], [850, 0]]) close(at(e).cover, v, 0.01)
  assert.equal(at(349).swap, false)
  assert.equal(at(350).swap, true)
  assert.equal(at(849).done, false)
  assert.equal(at(850).done, true)
  assert.equal(at(100).fade, 0)
  assert.equal(at(-50).cover, 0)
  for (let e = 1; e <= 350; e++) assert.ok(at(e).cover >= at(e - 1).cover)
  for (let e = 451; e <= 850; e++) assert.ok(at(e).cover <= at(e - 1).cover)
})

test('reduced motion is a 200 ms fade that swaps at 100 ms', () => {
  const at = (e) => W.cloudPhase(e, true)
  for (const [e, f] of [[0, 0], [50, 0.5], [100, 1], [150, 0.5], [200, 0]]) {
    assert.equal(at(e).cover, 0)
    close(at(e).fade, f)
  }
  assert.equal(at(99).swap, false)
  assert.equal(at(100).swap, true)
  assert.equal(at(199).done, false)
  assert.equal(at(200).done, true)
})

test('cloud bands start off stage and overlap when closed', () => {
  const b0 = W.cloudBands(0, 1000)
  assert.ok(b0.left <= 0 && b0.right >= 1000)
  const b1 = W.cloudBands(1, 1000)
  assert.ok(b1.left - b1.right >= 150)
})

test('cloud bands are symmetric and monotonic', () => {
  let prev = W.cloudBands(0, 800)
  for (let i = 0; i <= 20; i++) {
    const b = W.cloudBands(i / 20, 800)
    close(b.left + b.right, 800)
    assert.ok(b.left >= prev.left && b.right <= prev.right)
    prev = b
  }
})

test('canNavigate refuses while clouds are running', () => {
  const t = { start: 1000 }
  for (const now of [1000, 1200, 1849]) assert.equal(W.canNavigate(t, now, false), false)
  assert.equal(W.canNavigate(t, 1850, false), true)
  assert.equal(W.canNavigate(t, 1199, true), false)
  assert.equal(W.canNavigate(t, 1200, true), true)
  assert.equal(W.canNavigate(null, 0, false), true)
})

// ---- one island and the cloud transition (Task 6) ----
test('transStep swaps on exactly one frame and ends with the clouds', () => {
  const t = { start: 1000, swapped: false }
  let swaps = 0, doneAt = null
  for (let now = 1000; now <= 2000; now += 16) {
    const s = W.transStep(t, now, false)
    if (s.swapNow) { swaps++; t.swapped = true; assert.ok(now - 1000 >= 350) }
    if (s.done && doneAt == null) doneAt = now
  }
  assert.equal(swaps, 1)
  assert.ok(doneAt - 1000 >= 850 && doneAt - 1000 < 866)
  assert.deepEqual(W.transStep(null, 0, false), { phase: null, swapNow: false, done: true })
})

test('transStep with reduced motion fades, swapping at 100 ms and ending at 200 ms', () => {
  const t = { start: 0, swapped: false }
  assert.equal(W.transStep(t, 99, true).swapNow, false)
  const s = W.transStep(t, 100, true)
  assert.equal(s.swapNow, true)
  assert.equal(s.phase.cover, 0)
  assert.equal(s.phase.fade, 1)
  t.swapped = true
  assert.equal(W.transStep(t, 150, true).swapNow, false)
  assert.equal(W.transStep(t, 200, true).done, true)
})

test('beginTrans: a second navigation while the clouds run is ignored, not queued', () => {
  const cur = { trans: null, reduced: false, view: 'all', focus: null }
  const go = (to, now, reduced = false) => { const t = W.beginTrans(cur, to, now, reduced); if (t) { cur.trans = t; cur.reduced = reduced } return t }
  assert.deepEqual(go({ view: 'one', focus: 'A' }, 0), { start: 0, to: { view: 'one', focus: 'A' }, swapped: false })
  assert.equal(go({ view: 'one', focus: 'B' }, 40), null)
  assert.equal(go({ view: 'all' }, 500), null)
  assert.equal(cur.trans.to.focus, 'A')
  cur.view = 'one'; cur.focus = 'A'
  assert.equal(go({ view: 'one', focus: 'A' }, 900), null, 'already there')
  assert.ok(go({ view: 'all' }, 900, true))
  assert.equal(go({ view: 'mine' }, 1050, false), null, 'the reduced fade still runs (200 ms)')
  assert.ok(go({ view: 'mine' }, 1100, false))
})

test('beginTrans: the same view is a no-op, another island is not', () => {
  const at = { trans: null, reduced: false, view: 'one', focus: 'A' }
  assert.equal(W.beginTrans(at, { view: 'one', focus: 'A' }, 0, false), null)
  assert.ok(W.beginTrans(at, { view: 'one', focus: 'B' }, 0, false))
  assert.equal(W.beginTrans({ ...at, view: 'mine' }, { view: 'mine' }, 0, false), null)
})

// ---- one-island placement (fix round 1) ----
const LWt = 1000, FHt = 500, LHt = 700
test('oneArea: a phone keeps the island between the back control and the collapsed sheet', () => {
  const a = W.oneArea(360, 600, { phone: true, panelOpen: false, panelW: 324, top: 54, bottom: 70, lw: LWt, fh: FHt })
  assert.deepEqual(a, { x: 0, y: 54, w: 360, h: 476 })
  const r = W.fitOne(a, LWt, FHt, LHt)
  assert.ok(r.y >= 54 && r.y + r.fh <= 600 - 70 + 1e-9)
  assert.equal(r.w, 360)
})

test('oneArea: on a wide stage an open panel moves the island left when it keeps at least 70 % of its size', () => {
  const o = { phone: false, panelOpen: true, panelW: 324, top: 0, bottom: 0, lw: LWt, fh: FHt }
  // fitted to height: 900 wide both ways, so the island moves out from under the panel
  const a = W.oneArea(1400, 450, o)
  assert.deepEqual(a, { x: 0, y: 0, w: 1076, h: 450 })
  const r = W.fitOne(a, LWt, FHt, LHt)
  assert.ok(r.x + r.w <= 1400 - 324 + 1e-9)
  // fitted to width: losing the panel column would shrink it below 70 %, so it stays full width
  assert.deepEqual(W.oneArea(900, 900, o), { x: 0, y: 0, w: 900, h: 900 })
  // panel collapsed: full stage
  assert.deepEqual(W.oneArea(1400, 450, { ...o, panelOpen: false }), { x: 0, y: 0, w: 1400, h: 450 })
})

test('fitOne centres the island top (fh) in the area, like the local page', () => {
  const r = W.fitOne({ x: 10, y: 20, w: 1000, h: 1000 }, LWt, FHt, LHt)
  assert.deepEqual(r, { x: 10, y: 20 + 250, w: 1000, h: 700, fh: 500 })
  const q = W.fitOne({ x: 0, y: 0, w: 2000, h: 250 }, LWt, FHt, LHt)
  assert.equal(q.w, 500)
  assert.equal(q.x, 750)
})

test('landingView falls back to "Toàn cảnh" when the island is gone before the swap', () => {
  const has = (id) => id === 'A'
  assert.deepEqual(W.landingView({ view: 'one', focus: 'A' }, has), { view: 'one', focus: 'A' })
  assert.deepEqual(W.landingView({ view: 'one', focus: 'B' }, has), { view: 'all', focus: null })
  assert.deepEqual(W.landingView({ view: 'one' }, has), { view: 'all', focus: null })
  assert.deepEqual(W.landingView({ view: 'mine' }, has), { view: 'mine', focus: null })
  assert.deepEqual(W.landingView({ view: 'all' }, has), { view: 'all', focus: null })
  assert.deepEqual(W.landingView({ view: 'bogus' }, has), { view: 'all', focus: null })
})

test('viewGone: the island on screen was removed (one island, or mine)', () => {
  const has = (id) => id === 'A'
  assert.equal(W.viewGone('one', 'A', has), false)
  assert.equal(W.viewGone('one', 'B', has), true)
  assert.equal(W.viewGone('mine', 'B', has), true)
  assert.equal(W.viewGone('mine', null, has), false)  // "Của tôi" without an island shows the pairing guide
  assert.equal(W.viewGone('all', 'B', has), false)
})

test('Esc closes an open confirm first, then goes back; never while typing', () => {
  const base = { view: 'one', typing: false, settings: false, confirm: false }
  assert.equal(W.escAction(base), 'back')
  assert.equal(W.escAction({ ...base, view: 'mine' }), 'back')
  assert.equal(W.escAction({ ...base, confirm: true }), 'confirm')
  assert.equal(W.escAction({ ...base, typing: true }), 'none')
  assert.equal(W.escAction({ ...base, typing: true, confirm: true }), 'none')
  assert.equal(W.escAction({ ...base, settings: true }), 'none')
  assert.equal(W.escAction({ ...base, view: 'all' }), 'none')
  assert.equal(W.escAction({ ...base, view: 'all', confirm: true }), 'none')
  assert.equal(W.escAction({ ...base, mod: true }), 'none', 'Ctrl, Meta or Alt held')
  assert.equal(W.escAction({ ...base, mod: true, confirm: true }), 'none')
})

// ---- /api/me probe for an island that may be mine (Task 5 review) ----
test('meProbeStep: the first world list is only remembered, a new island then probes', () => {
  const st = W.meProbeState()
  const o = { visible: true, hasMine: false, every: 10000 }
  assert.deepEqual(W.meProbeStep(st, ['a', 'b'], 0, { ...o, first: true }), { fire: false, retryIn: null })
  assert.deepEqual(W.meProbeStep(st, ['a', 'b'], 100, o), { fire: false, retryIn: null })
  assert.deepEqual(W.meProbeStep(st, ['a', 'b', 'c'], 200, o), { fire: true, retryIn: null })
})

test('meProbeStep: a second new island inside the throttle window gets a trailing probe', () => {
  const st = W.meProbeState()
  const o = { visible: true, hasMine: false, every: 10000 }
  W.meProbeStep(st, ['a'], 0, { ...o, first: true })
  assert.equal(W.meProbeStep(st, ['a', 'b'], 1000, o).fire, true)
  assert.deepEqual(W.meProbeStep(st, ['a', 'b', 'c'], 4000, o), { fire: false, retryIn: 7000 })
  // nothing new arrives; the trailing call when the window reopens still probes for 'c'
  assert.deepEqual(W.meProbeStep(st, ['a', 'b', 'c'], 11000, o), { fire: true, retryIn: null })
  assert.deepEqual(W.meProbeStep(st, ['a', 'b', 'c'], 30000, o), { fire: false, retryIn: null })
})

test('meProbeStep: a hidden tab waits and probes once when visible; having an island clears it', () => {
  const st = W.meProbeState()
  const o = { visible: true, hasMine: false, every: 10000 }
  W.meProbeStep(st, ['a'], 0, { ...o, first: true })
  assert.deepEqual(W.meProbeStep(st, ['a', 'b'], 100, { ...o, visible: false }), { fire: false, retryIn: null })
  assert.equal(W.meProbeStep(st, ['a', 'b'], 5000, o).fire, true)
  assert.equal(W.meProbeStep(st, ['a', 'b'], 6000, o).fire, false)
  W.meProbeStep(st, ['a', 'b', 'c'], 7000, { ...o, hasMine: true })
  assert.deepEqual(W.meProbeStep(st, ['a', 'b', 'c'], 30000, o), { fire: false, retryIn: null })
})

// ---- connection hardening (Task 5): stream watchdog and agents coming back ----
test('streamStale is never true before the first named ping', () => {
  assert.equal(W.PING_STALE_MS, 40000)
  assert.equal(W.streamStale({ pingSeen: false, lastEventAt: 0, now: 10 * 60 * 1000 }), false)
  assert.equal(W.streamStale({ pingSeen: undefined, lastEventAt: 0, now: 10 * 60 * 1000 }), false)
})

test('streamStale after 40 s without any event', () => {
  assert.equal(W.streamStale({ pingSeen: true, lastEventAt: 1000, now: 1000 + 39999 }), false)
  assert.equal(W.streamStale({ pingSeen: true, lastEventAt: 1000, now: 1000 + 40000 }), true)
})

test('goneStep: an island that went offline and came back shows its agents again', () => {
  const { skip, gone } = W.goneStep(new Map([['a', 'missing'], ['b', 'missing']]), new Set(['a', 'b']))
  assert.equal(skip.size, 0)
  assert.equal(gone.size, 0)
})

test('goneStep: a finished sub-agent stays gone while still listed', () => {
  const { skip, gone } = W.goneStep(new Map([['s', 'done']]), new Set(['s']))
  assert.deepEqual([...skip], ['s'])
  assert.deepEqual([...gone], [['s', 'done']])
})

test('goneStep forgets done sids once they leave the list', () => {
  const { skip, gone } = W.goneStep(new Map([['s', 'done'], ['t', 'done'], ['m', 'missing']]), new Set(['t']))
  assert.deepEqual([...skip], ['t'])
  assert.deepEqual([...gone], [['t', 'done']])
})

// ---- the viewer's link to the hub (Task 11): reconnect by itself, keep the scene, wipe only after 5 min ----
const step = (link, ev, now, rand = 0.5) => W.linkStep(link, ev, now, rand)

test('link constants and reconnectDelay', () => {
  assert.deepEqual(W.RECONNECT_STEPS_MS, [1000, 2000, 4000, 8000, 16000, 30000])
  assert.equal(W.DOWN_CAP_MS, 60000); assert.equal(W.REFUSED_AFTER, 5)
  assert.equal(W.WAKE_JUMP_MS, 15000); assert.equal(W.KEEP_STALE_MS, 300000)
  assert.equal(W.reconnectDelay(0, 0.5), 1000)
  close(W.reconnectDelay(0, 0), 800); close(W.reconnectDelay(0, 1), 1200)
  assert.equal(W.reconnectDelay(9, 0.5), 30000)
  assert.deepEqual(W.linkStart(), { phase: 'live', attempt: 0, closes: 0, staleSince: null, dueAt: null, stale: 0 })
})

test('a dropped stream reconnects after 1, 2, 4 … 30 s and never wipes before 5 min', () => {
  let link = W.linkStart(), now = 0
  const waits = []
  for (let i = 0; i < 8; i++) {
    const r = step(link, { type: 'error' }, now)
    assert.equal(r.link.phase, 'reconnecting'); assert.equal(r.act.probe, true); assert.equal(r.act.wipe, false)
    assert.equal(r.act.reload, false)
    waits.push(r.act.connectIn); link = r.link; now += r.act.connectIn
  }
  assert.deepEqual(waits, [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000])
  assert.equal(link.staleSince, 0)
  assert.ok(now < W.KEEP_STALE_MS)
})

test('a restart event waits exactly the hub\'s retryMs', () => {
  const r = step(W.linkStart(), { type: 'restarting', retryMs: 6000 }, 100)
  assert.equal(r.link.phase, 'reconnecting'); assert.equal(r.act.connectIn, 6000); assert.equal(r.act.probe, false)
  assert.equal(step(W.linkStart(), { type: 'restarting', retryMs: 200 }, 0).act.connectIn, 1000)
  assert.equal(step(W.linkStart(), { type: 'restarting', retryMs: 999999 }, 0).act.connectIn, 60000)
  assert.equal(step(W.linkStart(), { type: 'restarting', retryMs: 'x' }, 0).act.connectIn, 1000)
})

test('a 502 during a restart is not refused: the probe says world, so connect again', () => {
  let r = step(W.linkStart(), { type: 'closed' }, 0)
  assert.equal(r.link.closes, 1); assert.equal(r.act.probe, true)
  r = step(r.link, { type: 'probe', kind: 'world' }, 300)
  assert.equal(r.link.phase, 'reconnecting')
  assert.equal(r.act.connectIn, 700)  // the connect already planned stays where it was
  assert.equal(r.act.probe, false)
})

test('five closes in a row with the hub answering show refused but keep retrying every 60 s', () => {
  let link = W.linkStart(), now = 0
  for (let i = 1; i <= 5; i++) {
    let r = step(link, { type: 'closed' }, now)
    r = step(r.link, { type: 'probe', kind: 'world' }, now + 10)
    link = r.link
    if (i < 5) { assert.equal(link.phase, 'reconnecting', 'close ' + i); assert.ok(r.act.connectIn < W.DOWN_CAP_MS) }
    else { assert.equal(link.phase, 'refused'); assert.equal(r.act.connectIn, W.DOWN_CAP_MS) }
    now += 20000
  }
  // still refused: the next close probes again and keeps the 60 s rhythm
  let r = step(link, { type: 'closed' }, now)
  r = step(r.link, { type: 'probe', kind: 'world' }, now + 10)
  assert.equal(r.link.phase, 'refused'); assert.equal(r.act.connectIn, W.DOWN_CAP_MS)
  r = step(r.link, { type: 'open' }, now + 70000)
  assert.equal(r.link.phase, 'live'); assert.equal(r.link.closes, 0)
})

test('hub down: retries back off to 60 s at most; online or wake connects at once', () => {
  let link = W.linkStart(), now = 0, last = 0
  for (let i = 0; i < 10; i++) {
    let r = step(link, { type: 'error' }, now)
    r = step(r.link, { type: 'probe', kind: 'down' }, now + 5)
    assert.equal(r.link.phase, 'down')
    assert.ok(r.act.connectIn >= last && r.act.connectIn <= W.DOWN_CAP_MS, String(r.act.connectIn))
    last = r.act.connectIn; link = r.link; now += r.act.connectIn
  }
  assert.equal(last, 30000)
  for (const type of ['online', 'wake', 'visible']) {
    const r = step(link, { type }, now)
    assert.equal(r.act.connectIn, 0, type); assert.equal(r.link.attempt, 0, type); assert.equal(r.link.phase, 'down')
  }
  // while live they do nothing
  for (const type of ['online', 'wake', 'visible']) assert.equal(step(W.linkStart(), { type }, 5).act.connectIn, null, type)
})

test('scenes are wiped only after 5 min without a connection', () => {
  let r = step(W.linkStart(), { type: 'error' }, 1000)
  r = step(r.link, { type: 'probe', kind: 'down' }, 1000 + W.KEEP_STALE_MS - 1)
  assert.equal(r.act.wipe, false)
  r = step(r.link, { type: 'error' }, 1000 + W.KEEP_STALE_MS)
  assert.equal(r.act.wipe, true)
  assert.equal(r.link.staleSince, 1000)  // the first loss counts, not the latest
  r = step(r.link, { type: 'open' }, 1000 + W.KEEP_STALE_MS + 5)
  assert.equal(r.act.wipe, false); assert.equal(r.link.staleSince, null)
})

test('signed out reloads; a hub no longer in world mode reloads', () => {
  const r0 = step(W.linkStart(), { type: 'error' }, 0)
  assert.equal(step(r0.link, { type: 'probe', kind: 'signedout' }, 5).act.reload, true)
  assert.equal(step(r0.link, { type: 'probe', kind: 'other' }, 5).act.reload, true)
  // a late probe answer after the stream came back changes nothing
  const live = step(r0.link, { type: 'open' }, 6).link
  const r = step(live, { type: 'probe', kind: 'signedout' }, 7)
  assert.equal(r.act.reload, false); assert.equal(r.link.phase, 'live')
})

test('busy waits for Retry-After', () => {
  const r0 = step(W.linkStart(), { type: 'closed' }, 0)
  const r = step(r0.link, { type: 'probe', kind: 'busy', retryS: 12 }, 5)
  assert.equal(r.link.phase, 'busy'); assert.equal(r.act.connectIn, 12000)
  // no Retry-After: back off as for a drop rather than hammer the hub
  assert.equal(step(r0.link, { type: 'probe', kind: 'busy', retryS: 0 }, 5).act.connectIn, 2000)
})

test('open resets everything', () => {
  let link = W.linkStart()
  for (let i = 0; i < 4; i++) link = step(link, { type: 'closed' }, i).link
  link = step(link, { type: 'probe', kind: 'down' }, 9).link
  const r = step(link, { type: 'open' }, 10)
  assert.deepEqual(r.link, { phase: 'live', attempt: 0, closes: 0, staleSince: null, dueAt: null, stale: 0 })
  assert.deepEqual(r.act, { connectIn: null, probe: false, reload: false, wipe: false, close: false })
})

test('a stream that opens but stays silent is reopened later each time until it is heard', () => {
  let link = W.linkStart(), now = 0
  const waits = []
  for (let i = 0; i < 7; i++) {
    const r = step(link, { type: 'error', stale: true }, now)
    waits.push(r.act.connectIn); now += r.act.connectIn
    link = step(r.link, { type: 'open' }, now).link  // the hub accepts the stream, then says nothing for 40 s
    now += 40000
  }
  assert.deepEqual(waits, [2000, 4000, 8000, 16000, 30000, 30000, 30000])
  link = step(link, { type: 'heard' }, now).link
  assert.equal(link.stale, 0)
  assert.equal(step(link, { type: 'error', stale: true }, now).act.connectIn, 2000)
})

test('waking up in a visible tab reopens a stream that still looks live; a hidden tab does not', () => {
  const r = step(W.linkStart(), { type: 'wake', visible: true }, 5000)
  assert.equal(r.act.connectIn, 0)
  assert.equal(r.act.close, true)
  assert.equal(r.link.phase, 'reconnecting')
  assert.equal(r.link.staleSince, 5000)
  // background tabs throttled to one tick a minute look like a wake: never tear down a healthy stream for that
  const h = step(W.linkStart(), { type: 'wake', visible: false }, 5000)
  assert.equal(h.act.connectIn, null); assert.ok(!h.act.close); assert.equal(h.link.phase, 'live')
})

test('doneDue: only a sub-agent done for more than 3 s is due to leave', () => {
  const a = { parent: 1, status: 'done', doneAt: 1000 }
  assert.equal(W.DONE_LEAVE_MS, 3000)
  assert.equal(W.doneDue(a, 4000), false)
  assert.equal(W.doneDue(a, 4001), true)
  assert.equal(W.doneDue({ ...a, parent: null }, 9000), false)
  assert.equal(W.doneDue({ ...a, status: 'working' }, 9000), false)
  assert.equal(W.doneDue({ ...a, doneAt: 0 }, 9000), false)
})

test('leaveGone: a hidden tab frees the desk at once, a visible one lets the person walk out', () => {
  assert.equal(W.leaveGone('hidden'), true)
  assert.equal(W.leaveGone('visible'), false)
})

// ---- "Máy này": what this machine sends (Task 16) ----
const NOW = 1_800_000_000_000

test('pillView: a healthy publisher is ok with its age', () => {
  const v = W.pillView({ state: 'sending', lastOkAt: NOW - 4000, lastErr: null, failures: 0, nextRetryAt: null }, NOW)
  assert.deepEqual(v, { state: 'sending', tone: 'ok', ageMs: 4000, retryInMs: null, err: null, failures: 0 })
})

test('pillView: an old server without the new fields still shows its state', () => {
  assert.deepEqual(W.pillView({ state: 'offline' }, NOW),
    { state: 'offline', tone: 'bad', ageMs: null, retryInMs: null, err: null, failures: 0 })
  assert.equal(W.pillView({ state: 'sending', lastOkAt: 'x', failures: -2, lastErr: 'boom' }, NOW).ageMs, null)
  assert.equal(W.pillView({ state: 'sending', failures: -2, lastErr: 'boom' }, NOW).err, null)
  assert.equal(W.pillView({ state: 'sending', failures: -2 }, NOW).failures, 0)
  assert.equal(W.pillView(null, NOW), null)
  assert.equal(W.pillView({}, NOW), null)
  assert.equal(W.pillView({ state: 'weird' }, NOW).tone, 'muted')
})

test('pillView: rejected is bad and carries the reason', () => {
  const v = W.pillView({ state: 'rejected', lastOkAt: NOW - 90_000, failures: 3, nextRetryAt: NOW + 25_000,
    lastErr: { code: 'rejected:too_many_sessions', at: NOW - 1000, reason: 'too many sessions' } }, NOW)
  assert.equal(v.tone, 'bad')
  assert.deepEqual(v.err, { code: 'rejected:too_many_sessions', reason: 'too many sessions' })
  assert.equal(v.failures, 3)
  assert.equal(v.retryInMs, 25_000)
  assert.equal(v.ageMs, 90_000)
})

test('pillView: a nextRetryAt in the past reads as retrying now', () => {
  const v = W.pillView({ state: 'offline', nextRetryAt: NOW - 5000, failures: 2,
    lastErr: { code: 'network:ECONNREFUSED', at: NOW - 6000 } }, NOW)
  assert.equal(v.retryInMs, 0)
  assert.deepEqual(v.err, { code: 'network:ECONNREFUSED', reason: null })
})

test('pillView: the tone of every publisher state', () => {
  const tone = s => W.pillView({ state: s }, NOW).tone
  assert.deepEqual(['sending', 'connecting', 'paused', 'standby', 'private', 'off', 'offline', 'rejected', 'revoked']
    .map(tone), ['ok', 'warn', 'warn', 'muted', 'muted', 'muted', 'bad', 'bad', 'bad'])
})

test('agoParts picks seconds, minutes or hours', () => {
  assert.deepEqual(W.agoParts(0), { unit: 's', n: 0 })
  assert.deepEqual(W.agoParts(59_400), { unit: 's', n: 59 })
  assert.deepEqual(W.agoParts(60_000), { unit: 'm', n: 1 })
  assert.deepEqual(W.agoParts(3_599_000), { unit: 'm', n: 59 })
  assert.deepEqual(W.agoParts(7_300_000), { unit: 'h', n: 2 })
  assert.deepEqual(W.agoParts(-500), { unit: 's', n: 0 }, 'a clock a little ahead never shows a negative age')
})

test('deviceLink: the chip opens the hub on this device only for a 16-hex device id', () => {
  assert.equal(W.deviceLink('https://hub.x/', '0123456789abcdef'), 'https://hub.x/#this-device=0123456789abcdef')
  assert.equal(W.deviceLink('https://hub.x/', 'nothex'), 'https://hub.x/')
  assert.equal(W.deviceLink('https://hub.x/', null), 'https://hub.x/')
})

test('failParts: the retry wait shows only when one is planned and still ahead', () => {
  const err = { code: 'network:ECONNREFUSED' }
  assert.deepEqual(W.failParts({ err, retryInMs: 9200, failures: 3 }),
    [['error', { code: 'network:ECONNREFUSED' }], ['retryIn', { s: '10' }], ['times', { n: '3' }]])
  assert.deepEqual(W.failParts({ err, retryInMs: 0, failures: 1 }),
    [['error', { code: 'network:ECONNREFUSED' }], ['retrying', {}], ['times', { n: '1' }]])
  // paused waits for a sign-in, not a timer: no retry part at all
  assert.deepEqual(W.failParts({ err, retryInMs: null, failures: 0 }), [['error', { code: 'network:ECONNREFUSED' }]])
  assert.deepEqual(W.failParts({ err: null, retryInMs: 5000, failures: 2 }), [])
})

// ---- island freshness and the connection legend (Task 17) ----

test('freshness: live under 45 s, fades to the offline alpha at 90 s', () => {
  assert.equal(W.FRESH_MS, 45000)
  assert.equal(W.OFFLINE_AFTER_MS, 90000)
  assert.equal(W.OFFLINE_ALPHA, 0.65)
  const hubNow = 1_800_000_000_000, recvAt = 5000
  const at = age => W.freshness(hubNow - age, hubNow, recvAt, recvAt, true)
  assert.deepEqual(at(0), { ageMs: 0, alpha: 1, bucket: 'live' })
  assert.deepEqual(at(44_999), { ageMs: 44_999, alpha: 1, bucket: 'live' })
  const a45 = at(45_000)
  assert.equal(a45.bucket, 'aging')
  close(a45.alpha, 1)
  const mid = at(67_500)
  assert.equal(mid.bucket, 'aging')
  close(mid.alpha, 1 - (1 - 0.65) / 2)
  const a90 = at(90_000)
  close(a90.alpha, 0.65)
  assert.equal(a90.bucket, 'aging', 'offline only after 90 s')
  assert.deepEqual(at(200_000), { ageMs: 200_000, alpha: 0.65, bucket: 'offline' })
  // the time since the frame arrived counts too
  assert.equal(W.freshness(hubNow - 30_000, hubNow, recvAt, recvAt + 70_000, true).bucket, 'offline')
  // the alpha only falls with age and never below the offline alpha
  let last = 1
  for (let ms = 0; ms <= 120_000; ms += 1500) {
    const f = at(ms)
    assert.ok(f.alpha <= last + 1e-12 && f.alpha >= 0.65, `alpha at ${ms}`)
    last = f.alpha
  }
})

test("freshness uses the hub clock, not the viewer's", () => {
  const hubNow = 1_800_000_000_000, lastAt = hubNow - 60_000
  const viewer = Date.UTC(2026, 10, 6, 3, 0, 0)
  const a = W.freshness(lastAt, hubNow, viewer, viewer + 2000, true)
  const skew = 10 * 60_000
  assert.deepEqual(W.freshness(lastAt, hubNow, viewer + skew, viewer + skew + 2000, true), a)
  assert.deepEqual(W.freshness(lastAt, hubNow, viewer - skew, viewer - skew + 2000, true), a)
  assert.equal(a.ageMs, 62_000)
  assert.equal(a.bucket, 'aging')
})

test('freshness without lastAt (old hub) is unknown and follows online', () => {
  assert.deepEqual(W.freshness(undefined, undefined, 0, 0, true), { ageMs: null, alpha: 1, bucket: 'unknown' })
  assert.deepEqual(W.freshness(null, 1000, 0, 0, undefined), { ageMs: null, alpha: 1, bucket: 'unknown' })
  assert.deepEqual(W.freshness(null, 1000, 0, 0, false), { ageMs: null, alpha: 0.65, bucket: 'unknown' })
  assert.deepEqual(W.freshness(900, undefined, 0, 0, false), { ageMs: null, alpha: 0.65, bucket: 'unknown' })
  assert.deepEqual(W.freshness('900', 1000, 0, 0, true), { ageMs: null, alpha: 1, bucket: 'unknown' })
})

test('legendRow maps link phases', () => {
  assert.equal(W.legendRow('live'), null)
  assert.equal(W.legendRow('reconnecting'), 'reconnecting')
  assert.equal(W.legendRow('down'), 'down')
  assert.equal(W.legendRow('refused'), 'down')
  assert.equal(W.legendRow('busy'), 'down')
  assert.equal(W.legendRow(undefined), null)
})

test('escAction closes the legend first', () => {
  const base = { view: 'one', typing: false, settings: false, confirm: true, legend: true }
  assert.equal(W.escAction(base), 'legend')
  assert.equal(W.escAction({ ...base, view: 'all', confirm: false }), 'legend', 'on "Toàn cảnh" too')
  assert.equal(W.escAction({ ...base, settings: true }), 'legend')
  assert.equal(W.escAction({ ...base, legend: false }), 'confirm')
  assert.equal(W.escAction({ ...base, typing: true }), 'none')
  assert.equal(W.escAction({ ...base, mod: true }), 'none')
})
