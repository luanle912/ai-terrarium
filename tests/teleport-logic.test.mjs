// The magic teleport back to work as logic (web/teleport-logic.js): who teleports, where they land, the queue on a
// return to the page, the clock that holds and moves the person, and the numbers the drawing reads per phase.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
const S = loadWeb('office-scene')
const { DESKS, IDLE_SPOTS, BLOCK, W, H, behindWalls, DRAW_REACH } = S
const { bfs, startCell } = loadWeb('office-util')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { T } = TL

const CHAIRS = DESKS.map(d => [d.gx + 1, d.gy + 1.45])
const seg = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps
const seat = d => ({ key: 'seat', tile: [d.gx, d.gy + 1], pt: [d.gx + 1, d.gy + 1.45] })
const visit = (d, s) => [
  { key: 'visit-0', tile: [d.gx + 2, d.gy], pt: [d.gx + 2.45, d.gy + 0.55] },
  { key: 'visit-1', tile: [d.gx + 2, d.gy + 1], pt: [d.gx + 2.45, d.gy + 1.5] },
  { key: 'visit-2', tile: [d.gx + 2, d.gy + 2], pt: [d.gx + 2.4, d.gy + 2.3] },
][s]
// The route as updateAgent builds it: cell centres, the goal point, the seat splice.
function route(from, g) {
  const p = bfs(startCell(from[0], from[1]), g.tile)
    .map(c => [c[0] + 0.5, c[1] + 0.5])
    .concat([g.pt])
  if (g.key === 'seat' && p.length > 1) p.splice(p.length - 2, 1)
  return p
}
const others = k => CHAIRS.filter((_, j) => j !== k)
// Every idle spot, and the vanity after a stall.
const ORIGINS = IDLE_SPOTS.flatMap((sp, i) =>
  [{ key: 'idle' + i, pt: sp.pt }].concat(sp.wash ? [{ key: 'wash' + i, pt: sp.wash.pt }] : []),
)
const FISH = IDLE_SPOTS.findIndex(s => s.act === 'fish')
const prev = (was, over) => ({ was, hid: false, stool: false, act: null, ...over })
const agentAt = (pt, g, over) => ({
  id: 1,
  desk: 0,
  x: pt[0],
  y: pt[1],
  path: route(pt, g),
  goalKey: g.key,
  moving: true,
  seated: false,
  sleeping: false,
  tp: null,
  ...over,
})
const ctx = (a, was, key, over) => ({ prev: prev(was), key, agents: [a], chairs: CHAIRS, speed: 1, ...over })
// A straight route along row y, from x = 0.5 to x = n - 0.5 (n - 1 tiles), as in a corridor.
const row = (y, n, over) => ({
  id: 1,
  desk: 0,
  x: 0.5,
  y,
  path: Array.from({ length: n }, (_, k) => [k + 0.5, y]),
  goalKey: 'seat',
  moving: true,
  seated: false,
  sleeping: false,
  tp: null,
  ...over,
})

test('plan teleports only from a break to work', () => {
  const D = DESKS[12]
  for (const was of ['idle3', 'wash27'])
    for (const g of [seat(D), { ...visit(DESKS[13], 0), key: 'visit5-0' }]) {
      const o = was === 'idle3' ? IDLE_SPOTS[3].pt : IDLE_SPOTS[27].wash.pt
      const a = agentAt(o, g, { desk: 12 })
      assert.ok(TL.plan(a, ctx(a, was, g.key)), `${was} → ${g.key}`)
    }
  const a = agentAt(IDLE_SPOTS[3].pt, seat(D), { desk: 12 })
  for (const was of [null, 'seat', 'visit1-0', 'sub2-0', 'exit', 'fate'])
    assert.equal(TL.plan(a, ctx(a, was, 'seat')), null, `from ${was}`)
  for (const key of ['idle4', 'wash27', 'sleep', 'exit', 'fate', 'sub2-0'])
    assert.equal(TL.plan(a, ctx(a, 'idle3', key)), null, `to ${key}`)
})

test('a walk under 12 tiles is walked', () => {
  const path = Array.from({ length: 12 }, (_, k) => [k + 1, 0.5])
  assert.equal(TL.FAR, 12)
  assert.equal(TL.landing([0.1, 0.5], path), -1, '11.9 tiles')
  assert.ok(TL.landing([0, 0.5], path) >= 0, '12.0 tiles')
  // The phone spot by the rug is 11.5 tiles from desk 7.
  const a = agentAt(IDLE_SPOTS[17].pt, seat(DESKS[7]), { desk: 7 })
  assert.deepEqual(IDLE_SPOTS[17].pt, [23.5, 7.3])
  assert.equal(TL.plan(a, ctx(a, 'idle17', 'seat')), null, 'the phone spot to desk 7')
})

// Each route once; the landing then depends only on whose desk it is (the own chair is left out).
const SEATS = [],
  VISITS = []
for (const o of ORIGINS)
  DESKS.forEach((d, k) => {
    const path = route(o.pt, seat(d)),
      i = TL.landing(o.pt, path, [], others(k))
    if (i >= 0) SEATS.push({ o, k, path, i })
    for (let s = 0; s < 3; s++) {
      const vp = route(o.pt, visit(d, s))
      DESKS.forEach((_, own) => {
        if (own === k) return
        const j = TL.landing(o.pt, vp, [], others(own))
        if (j >= 0) VISITS.push({ o, k, s, own, path: vp, i: j })
      })
    }
  })

test('every landing is a walkable waypoint', () => {
  assert.equal(ORIGINS.length * DESKS.length, 720)
  assert.equal(SEATS.length, 703, 'seat pairs that teleport')
  assert.equal(VISITS.length, 30465, 'visit landings over every own desk')
  for (const { o, path, i } of SEATS.concat(VISITS)) {
    const [x, y] = path[i],
      at = `${o.key} → ${path.at(-1)} lands at ${x},${y}`
    assert.ok(i >= 0 && i <= path.length - 2, at)
    // A visit slot on the front row (y >= H) may be reached from just outside the office.
    const out = path.at(-1)[1] >= H
    assert.ok(x >= 0 && y >= 0 && x < W && (y < H || out), 'inside the office: ' + at)
    assert.ok(!BLOCK.has(Math.floor(x) + ',' + Math.floor(y)), 'not in furniture: ' + at)
    assert.ok(!behindWalls(Math.floor(x), Math.floor(y), DRAW_REACH), 'not behind the walls: ' + at)
  }
})

test('walk left after landing, nobody standing', () => {
  const left = list => list.map(({ path, i }) => TL.rest(path, i))
  const s = left(SEATS),
    v = left(VISITS)
  assert.ok(Math.min(...s) >= 3.5 && Math.max(...s) <= 4.51, `seats ${Math.min(...s)}–${Math.max(...s)}`)
  assert.ok(Math.min(...v) >= 3.5 && Math.max(...v) <= 6.1, `visits ${Math.min(...v)}–${Math.max(...v)}`)
})

test("nobody lands just in front of another desk's chair", () => {
  for (const { o, k, own, path, i } of SEATS.concat(VISITS))
    assert.ok(!TL.inWay(path[i], [], others(own ?? k)), `${o.key} → ${path.at(-1)} lands at ${path[i]}`)
  // Chair 3 sits at (6, 5.45): (7.5, 6.5) is in front of it, (8.5, 6.5) is far enough down-screen.
  const a = row(6.5, 21)
  a.path = a.path.reverse().filter(p => p[0] > 4)
  a.path.push([4, 6.5])
  assert.deepEqual(a.path[TL.landing([20.5, 6.5], a.path)], [7.5, 6.5])
  assert.deepEqual(a.path[TL.landing([20.5, 6.5], a.path, [], [CHAIRS[3]])], [8.5, 6.5])
})

test('two landings in flight never share a cell', () => {
  const desk2 = new Set(SEATS.filter(r => r.k === 2).map(r => r.path[r.i].join(',')))
  assert.ok(desk2.has('4.5,6.5'))
  const clash = VISITS.filter(r => r.k === 0 && r.path[r.i].join(',') === '4.5,6.5')
  assert.ok(clash.length > 0, 'a visit to desk 0 that would land on desk 2’s landing')
  for (const r of clash) {
    const j = TL.landing(r.o.pt, r.path, [[4.5, 6.5]], others(r.own))
    assert.ok(j >= 0 && seg(r.path[j], [4.5, 6.5]) >= TL.BUSY, `${r.o.key} slot ${r.s} lands at ${r.path[j]}`)
  }
})

test('nobody lands on someone standing', () => {
  const fish = IDLE_SPOTS[FISH].pt,
    base = { moving: false, seated: false, sleeping: false, x: 3.45, y: 4.55, path: [] }
  const fresh = () => agentAt(fish, seat(DESKS[0]), { desk: 0 })
  const alone = fresh()
  assert.deepEqual(alone.path[TL.landing(fish, alone.path, [], others(0))], [3.5, 4.5])
  const standing = [
    { id: 99, desk: 2, goalKey: 'sub98-0', ...base },
    { id: 97, desk: 9, goalKey: 'visit7-0', ...base, moving: true, x: 10, y: 6, path: [[9.5, 5.5], [3.45, 4.55]] },
    { id: 96, desk: 5, goalKey: 'idle3', ...base },
  ]
  for (const o of standing) {
    const a = fresh(),
      tp = TL.plan(a, { prev: prev('idle' + FISH), key: 'seat', agents: [a, o], chairs: CHAIRS, speed: 1 })
    assert.ok(tp, o.goalKey)
    assert.ok(seg([tp.x1, tp.y1], [3.45, 4.55]) > 1, `${o.goalKey}: lands at ${tp.x1},${tp.y1}`)
    assert.ok(TL.rest(a.path, tp.i) <= 7.2, `${o.goalKey}: ${TL.rest(a.path, tp.i)} tiles left`)
  }
  const a = fresh()
  const skip = [
    a,
    { ...base, goalKey: 'seat', seated: true },
    { ...base, goalKey: 'seat', moving: true },
    { ...base, goalKey: 'sleep', sleeping: true },
  ]
  assert.deepEqual(TL.occupied(a, skip), [])
  assert.deepEqual(TL.occupied(a, [{ ...base, goalKey: 'seat', tp: { x1: 7.5, y1: 3.5, cut: null }, moving: true }]), [
    [7.5, 3.5],
  ])
  assert.deepEqual(TL.occupied(a, [{ ...base, goalKey: 'seat', tp: { x1: 7.5, y1: 3.5, cut: 0.2 }, moving: true }]), [])
})

test('stagger', () => {
  const agents = Array.from({ length: 17 }, (_, k) => row(0.5 + 2 * k, 31, { id: k + 1, desk: k }))
  for (const a of agents) a.tp = TL.plan(a, { prev: prev('idle3'), key: 'seat', agents, chairs: [], speed: 1 })
  const u = agents.map(a => a.tp.u)
  assert.ok(near(TL.STAGGER, 0.15) && TL.QUEUE === 15)
  u.forEach((x, k) => assert.ok(near(x, -0.15 * Math.min(k, 15)), `${k}: ${x}`))
  assert.ok(agents.every(a => !a.tp.free && !a.tp.hide))
  // Stall users and bathers start at once, outside the queue, and do not push others back.
  const more = Array.from({ length: 4 }, (_, k) => row(0.5 + 2 * k, 31, { id: k + 1, desk: k }))
  const p = [prev('idle26', { hid: true }), prev('idle31', { act: 'bath' }), prev('idle3'), prev('idle3')]
  more.forEach((a, k) => (a.tp = TL.plan(a, { prev: p[k], key: 'seat', agents: more, chairs: [], speed: 1 })))
  assert.deepEqual(
    more.map(a => [a.tp.u, a.tp.free, a.tp.hide]),
    [
      [T.L_IN, true, true],
      [0, true, false],
      [0, false, false],
      [-0.15, false, false],
    ],
  )
})

test('a teleport must beat the walk', () => {
  const queued = Array.from({ length: 15 }, () => ({ tp: { u: 0, free: false, cut: null, x1: 99, y1: 99 }, moving: true }))
  const go = (n, speed, q = []) => {
    const a = row(0.5, n + 1)
    return TL.plan(a, { prev: prev('idle3'), key: 'seat', agents: [a, ...q], chairs: [], speed })
  }
  assert.ok(go(13, 1), '13 tiles at speed 1')
  assert.equal(go(13, 1, queued), null, '13 tiles at speed 1, 15 queued: 2.25 s in the queue')
  assert.equal(go(13, 3), null, '13 tiles at speed 3')
  // Landing 4 tiles from the end at speed 3: 15 tiles save 11/7.8 - 0.92 = 0.49 s, 16 tiles 0.62 s.
  assert.equal(go(15, 3), null)
  assert.ok(go(16, 3))
  assert.equal(go(16, 3, queued), null)
})

test('re-aim keeps the clock and the origin', () => {
  const fish = IDLE_SPOTS[FISH].pt
  for (const u of [0.2, -0.3]) {
    const a = agentAt(fish, seat(DESKS[12]), { desk: 12 })
    a.tp = { ...TL.plan(a, ctx(a, 'idle' + FISH, 'seat')), u }
    const old = a.tp
    a.path = route(fish, visit(DESKS[4], 0))
    const tp = TL.plan(a, ctx(a, 'seat', 'visit9-0'))
    assert.deepEqual([tp.u, tp.x0, tp.y0, tp.was, tp.cut], [u, old.x0, old.y0, 'idle' + FISH, null])
    assert.notDeepEqual([tp.x1, tp.y1], [old.x1, old.y1])
    assert.deepEqual(a.path[tp.i], [tp.x1, tp.y1])
  }
})

test('after the landing circle shows', () => {
  const a = row(0.5, 21)
  a.tp = { ...TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [] })), u: 0.3 }
  assert.deepEqual([a.tp.x1, a.tp.y1, a.tp.i], [16.5, 0.5, 16])
  const old = a.tp
  a.path = row(0.5, 26).path
  const kept = TL.plan(a, ctx(a, 'seat', 'visit3-0', { chairs: [] }))
  assert.deepEqual([kept.x1, kept.y1, kept.i, kept.u, kept.cut], [16.5, 0.5, 16, 0.3, null])
  // Off the new route: called off, and planned again from the break once it has rewound (step).
  a.path = [[0.5, 1.5]].concat(row(2.5, 21).path)
  assert.deepEqual(TL.plan(a, ctx(a, 'seat', 'visit3-0', { chairs: [] })), { ...old, cut: 0.3, again: true })
  // A new goal too close to teleport to is walked to after the rewind.
  a.path = row(0.5, 10).path
  assert.deepEqual(TL.plan(a, ctx(a, 'seat', 'visit3-0', { chairs: [] })), { ...old, cut: 0.3 })
})

test('a re-aim must still beat the walk', () => {
  const go = (u, n, speed) => {
    const a = row(0.5, 31)
    a.tp = { ...TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [], speed })), u }
    a.path = row(0.5, n + 1).path
    return TL.plan(a, ctx(a, 'seat', 'visit3-0', { chairs: [], speed }))
  }
  // 13 tiles at 3x walk in 1.67 s; from the back of the queue the teleport would take about 2.8 s.
  assert.equal(go(-1.35, 13, 3), null, 'queued: dropped')
  assert.equal(go(-1.35, 13, 1).u, -1.35, 'at 1x it still pays')
  assert.deepEqual([go(0.2, 13, 3).cut, go(0.2, 13, 3).again], [0.2, false], 'started: called off')
  assert.equal(go(0.2, 20, 3).cut, null)
})

test('nobody lands on the stairs', () => {
  const stairs = S.STAIRS.flatMap(s =>
    Array.from({ length: s.len }, (_, k) => (s.side === 'east' ? [W + 0.5, s.y + k + 0.5] : [s.x + k + 0.5, H + 0.5])),
  )
  assert.deepEqual(stairs, [
    [27.5, 7.5],
    [27.5, 8.5],
    [22.5, 14.5],
    [23.5, 14.5],
  ])
  const on = p => stairs.some(s => s[0] === p[0] && s[1] === p[1])
  let moved = 0
  for (const { o, own, path, i } of VISITS) {
    const j = TL.landing(o.pt, path, stairs, others(own)),
      [x, y] = path[j] || [],
      at = `${o.key} → ${path.at(-1)} lands at ${x},${y}`
    assert.ok(j >= 0 && !on(path[j]), at)
    if (j === i) continue
    moved++
    const [cx, cy] = [Math.floor(x), Math.floor(y)]
    assert.ok(!BLOCK.has(cx + ',' + cy) && !behindWalls(cx, cy, DRAW_REACH), at)
    assert.ok(TL.rest(path, j) <= 6.3, at)
  }
  assert.equal(moved, 510, 'only the desk 15 slot 2 landings step back')
  // plan reads them from c.stairs
  const a = agentAt(IDLE_SPOTS[FISH].pt, visit(DESKS[15], 2), { desk: 0 })
  const tp = TL.plan(a, ctx(a, 'idle' + FISH, 'visit9-2', { stairs }))
  assert.ok(tp && !on([tp.x1, tp.y1]), `lands at ${tp.x1},${tp.y1}`)
  assert.ok(on(a.path[TL.plan(a, ctx(a, 'idle' + FISH, 'visit9-2')).i]), 'on the stairs without them')
})

test('a goal back to the lounge cuts a started teleport and drops a queued one', () => {
  const a = row(0.5, 21)
  const tp = TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [] }))
  a.tp = { ...tp, u: 0.3 }
  assert.deepEqual(TL.plan(a, ctx(a, 'seat', 'idle4')), { ...tp, u: 0.3, cut: 0.3 })
  a.tp = { ...tp, u: -0.1 }
  assert.equal(TL.plan(a, ctx(a, 'seat', 'idle4')), null)
})

test('a landed teleport is left to finish; a rewinding one too, marked to start again if work calls', () => {
  const a = row(0.5, 21)
  const tp = TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [] }))
  assert.equal(tp.again, false)
  a.tp = { ...tp, u: 0.6, sw: true }
  assert.equal(TL.plan(a, ctx(a, 'seat', 'idle4')), a.tp)
  a.tp = { ...tp, u: 0.4, cut: 0.3 }
  assert.equal(TL.plan(a, ctx(a, 'seat', 'idle4')), a.tp)
  // Back to work while it rewinds: the rewind plays out (no pop), then step hands it back for a fresh plan.
  for (const was of ['idle4', 'visit3-0']) {
    const again = TL.plan(a, ctx(a, was, 'seat', { chairs: [] }))
    assert.deepEqual(again, { ...a.tp, again: true }, `from ${was}`)
    a.tp = again
    assert.equal(TL.plan(a, ctx(a, 'seat', 'seat', { chairs: [] })), again)
    assert.deepEqual(TL.plan(a, ctx(a, 'seat', 'exit')), { ...again, again: false })
    a.tp = { ...tp, u: 0.4, cut: 0.3 }
  }
})

test('an unreachable goal plans nothing', () => {
  const a = agentAt([28.6, 20.5], seat(DESKS[0]))
  a.path = [[2, 2.45]]
  assert.equal(TL.plan(a, ctx(a, 'idle3', 'seat')), null)
  assert.equal(TL.landing([28.6, 20.5], []), -1)
})

// A planned agent held on a 30-tile straight route.
function held(over) {
  const a = row(0.5, 31, { dirFront: false, stool: false })
  a.path.push([30.2, 0.95])
  a.tp = { ...TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [] })), ...over }
  return a
}

test('step holds until RELEASE, moves once at SWITCH and clears at END', () => {
  const a = held(),
    orig = a.path.slice(),
    { i, x1, y1 } = a.tp
  const dt = 1 / 60
  let u = 0,
    moves = 0
  while (a.tp) {
    const x = a.x,
      y = a.y,
      r = TL.step(a, dt)
    u += dt
    if (x !== a.x || y !== a.y) moves++
    // u sums the same steps as tp.u, so the boundaries compare exactly
    if (u < T.SWITCH) assert.deepEqual([a.x, a.y], [0.5, 0.5], `at ${u}`)
    else assert.deepEqual([a.x, a.y], [x1, y1], `at ${u}`)
    assert.equal(r, u < T.RELEASE, `held at ${u}`)
    if (r) assert.equal(a.moving, false)
    assert.equal(!!a.tp, u < T.END, `tp at ${u}`)
  }
  assert.equal(moves, 1)
  assert.deepEqual(a.path, orig.slice(i + 1))
  assert.deepEqual(a.path.at(-1), [30.2, 0.95])
  assert.equal(a.dirFront, true, 'faces the first leg (down-right)')
})

test('step keeps the stool pose until fully white', () => {
  const a = held({ stool: 2 })
  for (const [u, want] of [
    [-0.4, 2],
    [0.25, 2],
    [0.26, false],
    [0.4, false],
  ]) {
    a.tp.u = u
    TL.step(a, 0)
    assert.equal(a.stool, want, `at ${u}`)
  }
  const b = held({ stool: 2, u: 0.2, cut: 0.2 })
  let n = 0
  while (b.tp && n < 30) {
    const r = TL.step(b, 1 / 60)
    assert.equal(b.stool, false)
    if (b.tp) assert.ok(r && b.moving === false && b.x === 0.5)
    else assert.equal(r, false)
    n++
  }
  assert.ok(n >= 15 && n <= 16, `rewound for ${n} frames`)
  assert.equal(TL.step({ ...b, tp: { ...held().tp, u: 0.44, cut: 0.2 } }, 0.02), false)
})

test('a rewind marked again hands the person back to their break goal, held one more frame', () => {
  for (const hide of [false, true]) {
    const a = held({ u: 0.44, cut: 0.2, again: true, hide, was: 'idle26' })
    Object.assign(a, { goalKey: 'seat', wcIn: false })
    assert.equal(TL.step(a, 0.02), true)
    assert.deepEqual([a.tp, a.goalKey, a.wcIn, a.path, a.moving], [null, 'idle26', hide, [], false])
  }
})

test('step with dt 1 crosses switch, release and end in two calls; dt 0 changes nothing', () => {
  const a = held(),
    { x1, y1 } = a.tp
  assert.equal(TL.step(a, 1), false)
  assert.deepEqual([a.x, a.y, a.tp.sw], [x1, y1, true])
  assert.equal(TL.step(a, 1), false)
  assert.equal(a.tp, null)
  const b = held({ u: 0.1 }),
    before = JSON.stringify(b)
  assert.equal(TL.step(b, 0), true)
  b.moving = true
  assert.equal(JSON.stringify(b), before)
})

const look = (u, over = {}, calm = false) => TL.look({ ...held().tp, u, ...over }, calm, TL.newLook())

test('look phase table', () => {
  // u, show, white, sx, lift, o.dim, o.ring, o.sweep, o.top, o.bot, o.rings, bolt, l.ring, l.burst
  const rows = [
    [-0.2, 1, 0, 1, 0, 0.35, 0, 0, 0, 0, -1, -1, 0, -1],
    [0, 1, 0, 1, 0, 0.35, 1, 0, 0, 0, -1, -1, 0, -1],
    [0.1, 2, 0, 1, 0, 0.35, 1, 0.75, 0, 0, -1, -1, 0, -1],
    [0.2, 2, 0.625, 1, 0, 0, 1, 1, 80 * (1 - (5 / 6) ** 2), 0, -1, -1, 0, -1],
    [0.3, 3, 1, 0.946875, 2, 0, 1, 1, 80, 0, 0, -1, 1, -1],
    [0.35, 3, 1, 1 - 0.85 * 0.5625 ** 2, 9, 0, 1, 1, 80, 0, 0.05, -1, 1, -1],
    [0.42, 0, 0, 1, 0, 0, 1, 1, 80 + 40 / 36, 80 / 36, 0.12, 0, 1, -1],
    [0.48, 0, 0, 1, 0, 0, 1, 1, 80 + 160 / 9, 320 / 9, 0.18, 0.5, 1, -1],
    [0.56, 3, 1, 0.15, 28, 0, 1 - 0.06 / 0.35, 1, 0, 0, -1, -1, 1, 0],
    [0.63, 3, 1, 0.7875, 7, 0, 1 - 0.13 / 0.35, 1, 0, 0, -1, -1, 1, 0.07 / 0.24],
    [0.7, 2, 1, 1, 0, 0, 1 - 0.2 / 0.35, 1, 0, 0, -1, -1, 1, 0.14 / 0.24],
    [0.86, 1, 0, 1, 0, 0, 0, 1, 0, 0, -1, -1, 1, -1],
    [0.92, 1, 0, 1, 0, 0, 0, 1, 0, 0, -1, -1, 1, -1],
    [1.35, 1, 0, 1, 0, 0, 0, 1, 0, 0, -1, -1, 0, -1],
  ]
  for (const [u, ...want] of rows) {
    const L = look(u)
    const got = [L.show, L.white, L.sx, L.lift, L.o.dim, L.o.ring, L.o.sweep, L.o.top, L.o.bot, L.o.rings, L.bolt]
    got.push(L.l.ring, L.l.burst)
    got.forEach((g, k) => assert.ok(near(g, want[k], 1e-9), `u ${u}, field ${k}: ${g} != ${want[k]}`))
    assert.equal(L.alpha, 1)
  }
  for (let k = -30; k < 160; k++) {
    const u = k / 100,
      L = look(u)
    assert.equal(L.show === 0, u >= 0.42 - 1e-9 && u < 0.56 - 1e-9, `nobody drawn at ${u}`)
    assert.equal(L.show === 3, (u >= 0.26 - 1e-9 && u < 0.42 - 1e-9) || (u >= 0.56 - 1e-9 && u < 0.7 - 1e-9), `${u}`)
    if (L.show === 3) assert.ok(L.sx <= 1 && L.sy >= 1 && Number.isInteger(L.lift))
  }
  assert.ok(T.SWITCH > 0.42 && T.SWITCH < 0.56)
  // The landing column strikes down, then narrows and fades.
  const l = [0.5, 0.53, 0.56, 0.7, 0.91].map(u => look(u).l)
  assert.deepEqual(
    l.map(e => e.top),
    [80, 80, 80, 80, 80],
  )
  assert.ok(l[0].bot === 80 && l[1].bot < 80 && l[2].bot === 0 && l[0].core === 2 && l[4].core === 1)
  assert.ok(l[3].w < 1 && l[4].colA < l[3].colA && look(0.92).l.colA === 0)
  assert.equal(look(0.3, { hide: true }).o.ring, 0, 'no origin end for a stall user')
  assert.equal(look(0.45, { hide: true }).bolt, -1)
})

test('look under calm', () => {
  for (let k = -30; k < 160; k++) {
    const u = k / 100,
      L = look(u, {}, true)
    for (const e of [L.o, L.l]) {
      assert.deepEqual([e.sweep, e.spin, e.flash, e.wave, e.top, e.bot, e.colA, e.rings, e.motes, e.burst], [
        1, 0, 0, -1, 0, 0, 0, -1, -1, -1,
      ])
    }
    assert.equal(L.bolt, -1)
    assert.ok(L.show === 0 || L.show === 1, `show ${L.show} at ${u}`)
    assert.equal(L.white, 0)
  }
  const a = [0, 0.1, 0.25, 0.39, 0.45, 0.6, 0.86].map(u => look(u, {}, true))
  assert.deepEqual(
    a.map(L => L.show),
    [1, 1, 1, 1, 0, 1, 1],
  )
  assert.ok(a[1].alpha === 1 && a[2].alpha < 1 && a[3].alpha < a[2].alpha && a[5].alpha < a[6].alpha)
  assert.equal(a[6].alpha, 1)
  assert.ok(look(0.1, {}, true).o.ring > 0 && look(-0.1, {}, true).o.dim === 0.35)
  assert.ok(look(0.5, {}, true).l.ring > 0 && look(0.3, {}, true).l.ring === 0)
})

test('look for a cut rewinds', () => {
  const at = (cut, d, calm) => look(cut + d, { cut }, calm)
  const s = [0.05, 0.15, 0.25].map(d => at(0.35, d))
  assert.deepEqual(
    s.map(L => L.show),
    [3, 2, 1],
  )
  assert.ok(s[0].white > s[1].white && s[1].white > s[2].white && s[2].white === 0)
  assert.ok(s[0].o.ring > s[1].o.ring && s[2].o.ring === 0 && s[0].o.dim === 0)
  for (const L of s) assert.deepEqual([L.o.flash, L.o.wave, L.o.motes, L.bolt], [0, -1, -1, -1])
  assert.ok(near(at(0.3, 0.05).l.ring, 0.8) && near(at(0.3, 0.15).l.ring, 0.4) && at(0.3, 0.25).l.ring === 0)
  assert.equal(at(0.2, 0.05).l.ring, 0)
  assert.deepEqual([at(0.3, 0.1).l.burst, at(0.3, 0.1).l.top], [-1, 0])
  // Under calm the fade runs back the same way, and nothing pops in.
  const c = [0.05, 0.15, 0.25].map(d => at(0.35, d, true))
  assert.ok(c[0].alpha < c[1].alpha && c[2].alpha === 1 && c.every(L => L.show === 1))
  assert.ok(near(at(0.35, 0.05, true).l.ring, 0) && at(0.3, 0.05, true).o.ring <= 1)
})

test('look fills the object it is given, every field every time', () => {
  const out = TL.newLook(),
    { o, l } = out
  for (let k = 0; k < 1000; k++) assert.equal(TL.look({ ...held().tp, u: (k % 150) / 100 - 0.1 }, k % 2 === 0, out), out)
  assert.ok(out.o === o && out.l === l)
  TL.look({ ...held().tp, u: 0.3 }, true, out)
  TL.look({ ...held().tp, u: 0.4, cut: 0.35 }, false, out)
  const L = TL.look({ ...held().tp, u: 0.05 }, false, out)
  assert.deepEqual([L.show, L.alpha, L.white, L.sx, L.sy, L.lift], [1, 1, 0, 1, 1, 0])
  // Whatever came before, the same tp gives the same numbers as on a fresh object.
  const tps = [-0.2, 0.15, 0.33, 0.5, 0.6, 0.75, 1.1].flatMap(u => [
    { ...held().tp, u },
    { ...held().tp, u, hide: true },
    { ...held().tp, u: u + 0.1, cut: Math.max(0.01, u) },
  ])
  for (const a of tps)
    for (const b of tps)
      for (const calm of [false, true]) {
        TL.look(a, !calm, out)
        assert.deepEqual(TL.look(b, calm, out), TL.look(b, calm, TL.newLook()))
      }
})

test('unseen', () => {
  const tp = held().tp
  assert.equal(TL.unseen(null), false)
  assert.equal(TL.unseen({ ...tp, u: 0.86 }), false)
  assert.equal(TL.unseen({ ...tp, u: 0.5, cut: 0.4 }), false)
  // From the plan on, the queue included, so a return shower's bubbles do not pile up over the circles.
  for (const u of [-2.25, -0.15, 0, 0.09, 0.1, 0.5, 0.85]) assert.equal(TL.unseen({ ...tp, u }), true, `${u}`)
  assert.equal(TL.unseen({ ...tp, u: 0.28, hide: true }), true)
})

test('the timeline and the tuning are as designed', () => {
  assert.deepEqual(T, {
    O_IN: 0.2,
    WHITE: 0.1,
    SQUEEZE: 0.26,
    L_IN: 0.28,
    SWITCH: 0.48,
    LAND: 0.86,
    RELEASE: 0.92,
    END: 1.35,
    CUT: 0.25,
  })
  const k = ['FAR', 'KEEP', 'BUSY', 'BACK', 'STAGGER', 'QUEUE', 'WALK', 'GAIN', 'LITE', 'CAP']
  assert.deepEqual(
    k.map(n => TL[n]),
    [12, 3.5, 1, 3, 0.15, 15, 2.6, 0.5, 10, 16],
  )
})

test('occupied skips the agent itself and counts a walking sub-agent at its spot', () => {
  const s = {
    id: 1,
    x: 3,
    y: 3,
    moving: false,
    seated: false,
    sleeping: false,
    goalKey: 'visit1-0',
    path: [
      [3, 3],
      [4, 4],
    ],
    tp: { x1: 5.5, y1: 5.5, cut: null },
  }
  assert.deepEqual(TL.occupied(s, [s]), [])
  const sub = {
    x: 9,
    y: 9,
    moving: true,
    seated: false,
    sleeping: false,
    goalKey: 'sub98-0',
    path: [
      [8, 8],
      [3.45, 4.55],
    ],
  }
  assert.deepEqual(TL.occupied({}, [sub]), [[3.45, 4.55]])
})

test('landing keeps the first candidate when all are in the way; the chair box; KEEP', () => {
  const path = Array.from({ length: 21 }, (_, k) => [k + 0.5, 0.5])
  const i = TL.landing([0.5, 0.5], path)
  assert.equal(TL.landing([0.5, 0.5], path, path.slice(i - 6, i + 1)), i)
  const c = path[i]
  assert.equal(TL.inWay(c, [], [[c[0] + 0.25, c[1] + 0.25]]), false, 'behind the chair')
  assert.equal(TL.inWay(c, [], [[c[0] - 0.5, c[1] - 0.5]]), true, 'just in front')
  assert.equal(TL.inWay(c, [], [[c[0] - 0.65, c[1] + 0.05]]), true, 'lateral 0.7 still in the way')
  assert.equal(TL.inWay(c, [], [[c[0] - 0.75, c[1] + 0.15]]), false, 'lateral 0.9 clear')
  // A first leg alone longer than FAR leaves nothing to keep after the landing: walk.
  assert.equal(TL.landing([-10, 0.5], path.slice(0, 3)), -1)
})

test('plan leaves out only the own chair', () => {
  const g = { key: 'visit5-1', tile: [3, 2], pt: [3.45, 2.5] }
  const a = agentAt(IDLE_SPOTS[0].pt, g, { desk: 2 })
  const tp = TL.plan(a, ctx(a, 'idle0', g.key))
  assert.deepEqual([tp.x1, tp.y1], [3.5, 6.5])
})

test('the queue counts only fresh, uncut, queued teleports; a bather skips it', () => {
  const t = over => ({ tp: { u: 0, free: false, cut: null, x1: 99, y1: 99, ...over }, moving: true })
  const go = (others, p = prev('idle3')) => {
    const a = row(0.5, 31, { id: 9 })
    return TL.plan(a, { prev: p, key: 'seat', agents: [a, ...others], chairs: [], speed: 1 }).u
  }
  assert.equal(go([t({ u: 0.5 })]), 0, 'a teleport already under way does not delay')
  assert.equal(go([t({ u: -0.1, cut: 0.2 })]), 0, 'a cut one does not')
  assert.equal(go([t({ u: -0.15, free: true })]), 0, 'a free one does not')
  assert.equal(go([t({ u: 0.1 })]), -0.15, 'one that has just started does')
  assert.equal(go([t({ u: -0.15 })], prev('idle31', { act: 'bath' })), 0, 'a bather after a queued person')
})

test('look pins flash, wave, spin and the column fade', () => {
  const L = look
  assert.ok(near(L(0.2).o.flash, 1) && near(L(0.26).o.flash, 0.5) && near(L(0.35).o.wave, 0.5))
  assert.ok(near(L(0.62).l.flash, 0.5) && near(L(0.71).l.wave, 0.5))
  assert.ok(near(L(0.55).o.spin, 0.9 * 0.55 + 0.8) && near(L(0.3).o.spin, 0.27 + 0.8 * 0.375 ** 2 * 2.25))
  assert.ok(near(L(0.37).l.sweep, 1 - 0.5 * 0.5))
  assert.ok(near(L(0.5).o.colA, 0.5))
  assert.equal(look(0.4, { cut: 0.3, hide: true }).o.ring, 0, 'a stall user has no origin circle to rewind')
  // A calm cut at 0.5, halfway through its rewind: both still circles at half what they were.
  const c = look(0.625, { cut: 0.5 }, true)
  assert.ok(near(c.o.ring, 0.5) && near(c.l.ring, 0.5 * 0.625), `${c.o.ring} ${c.l.ring}`)
})
