import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWorldLogic } from './load-world-logic.mjs'

const W = loadWorldLogic()
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`)
const ids = (n) => Array.from({ length: n }, (_, i) => ({ id: 'i' + i }))
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

test('layout of an empty world is an empty map', () => {
  assert.equal(W.layout([], null).size, 0)
})

test('my island is at the centre', () => {
  const p = W.layout(ids(5), 'i3')
  assert.deepEqual(p.get('i3'), { x: 0, y: 0 })
  assert.equal(p.size, 5)
})

test('islands never overlap', () => {
  const p = [...W.layout(ids(20), 'i7').values()]
  for (let a = 0; a < p.length; a++)
    for (let b = a + 1; b < p.length; b++) assert.ok(dist(p[a], p[b]) >= W.SPACING - 1e-9, `${a},${b}`)
})

test('layout is stable for the same order', () => {
  assert.deepEqual([...W.layout(ids(8), 'i2')], [...W.layout(ids(8), 'i2')])
})

test('a missing own island leaves the centre free and does not throw', () => {
  const p = W.layout(ids(6), 'x')
  assert.equal(p.size, 6)
  for (const q of p.values()) assert.ok(dist(q, { x: 0, y: 0 }) >= W.SPACING - 1e-9)
})

test('lodFor thresholds', () => {
  assert.equal(W.lodFor(500, 1000), 'full')
  assert.equal(W.lodFor(499, 1000), 'mid')
  assert.equal(W.lodFor(W.THUMB_PX, 1000), 'mid')
  assert.equal(W.lodFor(W.THUMB_PX - 1, 1000), 'thumb')
})

test('toWorld inverts toScreen', () => {
  const cam = { x: 1.5, y: -0.7, z: 340 }
  const s = W.toScreen(cam, 2.2, 0.4, 1000, 600)
  const w = W.toWorld(cam, s.x, s.y, 1000, 600)
  close(w.x, 2.2); close(w.y, 0.4)
  assert.deepEqual(W.toScreen(cam, 1.5, -0.7, 1000, 600), { x: 500, y: 300 })
})

test('fitAll contains every island', () => {
  const pos = W.layout(ids(9), 'i0')
  const cam = W.fitAll(pos, 1000, 600)
  for (const p of pos.values()) {
    const a = W.toScreen(cam, p.x - 0.5, p.y - W.ISLAND_ASPECT / 2, 1000, 600)
    const b = W.toScreen(cam, p.x + 0.5, p.y + W.ISLAND_ASPECT / 2, 1000, 600)
    assert.ok(a.x >= 0 && a.y >= 0 && b.x <= 1000 && b.y <= 600)
  }
})

test('focusOn centres the island big enough for full detail', () => {
  const cam = W.focusOn({ x: 2, y: 1 }, 1000, 600)
  assert.equal(cam.x, 2); assert.equal(cam.y, 1)
  assert.equal(W.lodFor(cam.z, 1000), 'full')
})

test('visible rejects rects fully off stage', () => {
  assert.ok(W.visible({ x: 10, y: 10, w: 50, h: 50 }, 1000, 600))
  assert.ok(!W.visible({ x: 1000, y: 0, w: 50, h: 50 }, 1000, 600))
  assert.ok(!W.visible({ x: -60, y: 0, w: 50, h: 50 }, 1000, 600))
})

test('camStep converges in about 0.4 s and snaps', () => {
  let cam = { x: 0, y: 0, z: 100 }
  const goal = { x: 3, y: -2, z: 600 }
  for (let i = 0; i < 24; i++) cam = W.camStep(cam, goal, 1 / 60)
  assert.ok(Math.abs(cam.x - 3) < 0.05 * 3 && cam.z > 550)
  for (let i = 0; i < 60; i++) cam = W.camStep(cam, goal, 1 / 60)
  assert.deepEqual(cam, goal)
})

test('lodFor uses THUMB_PX, tuned within 120..160 (spec §12.3)', () => {
  assert.ok(W.THUMB_PX >= 120 && W.THUMB_PX <= 160, String(W.THUMB_PX))
  assert.equal(W.lodFor(W.THUMB_PX, 1000), 'mid')
  assert.equal(W.lodFor(W.THUMB_PX - 1, 1000), 'thumb')
})

test('pickRedraws takes the longest-waiting first and never exceeds the budget', () => {
  const due = Array.from({ length: 10 }, (_, i) => ({ id: 'i' + i, drawnAt: -Infinity }))
  assert.equal(W.pickRedraws(due, 2).size, 2)
  const mixed = [{ id: 'a', drawnAt: 30 }, { id: 'b', drawnAt: 10 }, { id: 'c', drawnAt: 20 }]
  assert.deepEqual([...W.pickRedraws(mixed, 2)].sort(), ['b', 'c'])
  assert.equal(W.pickRedraws(mixed, 0).size, 0)
  assert.equal(W.pickRedraws([], 3).size, 0)
})

test('never-drawn islands queue like the others', () => {
  const due = [{ id: 'old', drawnAt: 5 }, { id: 'n1', drawnAt: -Infinity }, { id: 'n2', drawnAt: -Infinity }, { id: 'n3', drawnAt: -Infinity }]
  const got = W.pickRedraws(due, 2)
  assert.equal(got.size, 2)
  assert.ok(!got.has('old'))
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
