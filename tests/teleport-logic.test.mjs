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
const { TpStyles } = loadWeb('tp-styles')
const { T } = TL
// The tests written for the magic circle keep it; the styles' own cases set what they need and come back to it.
const pin = () => (TpStyles.reset(), TpStyles.setChoice('circle'))
pin()

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

test('the desk it lands for: its own for a seat, the visited person\'s for a visit', () => {
  const g = { ...visit(DESKS[13], 0), key: 'visit5-0' }, o = IDLE_SPOTS[3].pt
  const a = agentAt(o, g, { desk: 12 }), host = { id: 5, desk: 13, x: 0, y: 0, path: [], moving: false, seated: true }
  assert.equal(TL.plan(a, { ...ctx(a, 'idle3', g.key), agents: [a, host] }).desk, 13)
  const b = agentAt(o, seat(DESKS[12]), { desk: 12 })
  assert.equal(TL.plan(b, ctx(b, 'idle3', 'seat')).desk, 12)
  // a visit whose host has gone: the own desk
  assert.equal(TL.plan(a, ctx(a, 'idle3', g.key)).desk, 12)
  // re-aimed early to a visit: the desk follows
  b.tp = TL.plan(b, ctx(b, 'idle3', 'seat'))
  b.tp.u = 0.05
  b.path = route(o, g)
  assert.equal(TL.plan(b, { ...ctx(b, 'idle3', g.key), agents: [b, host] }).desk, 13)
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
  // the circle drawn for a slow style rewinds from the cut's core time, not its real seconds
  const d = TpStyles.durs('upload', 20), cut = TL.real(0.2, d)
  assert.ok(cut > T.L_IN)
  const L = look(cut, { cut, d }), U = look(0.2)
  assert.deepEqual([L.show, L.white, L.l.ring], [U.show, U.white, 0])
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

// ---- styles: four segment durations, travel time, switch at departure ----

const RUN = TpStyles.durs('dashrun', 1000) // ground, long
const Ds = [TL.DD, RUN, TpStyles.durs('goldaura', 0), [0.6, 2.0, 0.7, 0.4], [1.2, 0.4, 1.0, 1.0]]

test('core and real: inverse for every profile, the identity for the circle', () => {
  for (const d of Ds)
    for (let k = -20; k <= 400; k++) {
      const c = k / 100
      assert.ok(near(TL.core(TL.real(c, d), d), c, 1e-12), `${d} at ${c}`)
      assert.ok(near(TL.real(TL.core(c, d), d), c, 1e-12), `${d} at real ${c}`)
    }
  for (let k = -20; k <= 200; k++) {
    const u = k / 100 + 1e-3
    assert.equal(TL.core(u, TL.DD), u)
    assert.equal(TL.real(u, TL.DD), u)
    assert.equal(TL.core(u), u, 'no d: the circle')
  }
  assert.equal(TL.DD, TpStyles.DD)
  assert.deepEqual(TL.CB, [0, 0.42, 0.54, 0.92, 1.35])
  // each core breakpoint at the end of its real segment
  const d = [0.6, 2.0, 0.7, 0.4]
  assert.ok(near(TL.real(TL.DEP, d), 0.6) && near(TL.real(T.RELEASE, d), 3.3) && near(TL.real(T.END, d), 3.7))
  assert.ok(near(TL.core(-0.3, d), -0.3) && near(TL.core(4.7, d), T.END + 1), 'slope 1 outside')
})

// From (0.5, 0.5) down to y 10.5, then right along it: the route and the straight line differ.
const ell = over => {
  const path = []
  for (let y = 0.5; y <= 10.5; y++) path.push([0.5, y])
  for (let x = 1.5; x <= 24.5; x++) path.push([x, 10.5])
  return row(0.5, 2, { path, ...over })
}

test('plan writes the style, its durations, the switch and the travel length to the landing', () => {
  pin()
  const g = ell(),
    tp = TL.plan(g, ctx(g, 'idle3', 'seat', { chairs: [], style: 'dashrun' }))
  assert.equal(tp.style, 'dashrun')
  const along = 10 + (tp.x1 - 0.5)
  assert.ok(near(tp.len, along), `${tp.len} tiles along the route to the landing`)
  assert.ok(tp.len < TL.rest(g.path, 0), 'to the landing, not the seat')
  assert.deepEqual(tp.d, TpStyles.durs('dashrun', along))
  assert.equal(tp.swAt, TL.DEP)
  assert.deepEqual(tp.route, [[0.5, 0.5], ...g.path.slice(0, tp.i + 1)])
  assert.equal(tp.mk, 0)
  const a = ell(),
    air = TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [], style: 'cutpaste' }))
  assert.ok(near(air.len, Math.hypot(air.x1 - 0.5, 10)), 'air: the straight line')
  assert.equal(air.route, null, 'no route in the air')
  const h = ell(),
    hid = TL.plan(h, { ...ctx(h, 'idle26', 'seat', { chairs: [], style: 'cutpaste' }), prev: prev('idle26', { hid: true }) })
  assert.deepEqual(hid.route, [[0.5, 0.5], ...h.path.slice(0, hid.i + 1)], 'a hidden start keeps it, to leave unseen')
  assert.ok(near(hid.len, Math.hypot(hid.x1 - 0.5, 10)), 'still the straight line')
  const s = ell(),
    still = TL.plan(s, ctx(s, 'idle3', 'seat', { chairs: [], style: 'goldaura' }))
  assert.equal(still.swAt, T.SWITCH, 'no travel: switch while unseen, as the circle')
  const c = ell(),
    circ = TL.plan(c, ctx(c, 'idle3', 'seat', { chairs: [] }))
  assert.deepEqual([circ.style, circ.d, circ.swAt, circ.route], ['circle', TL.DD, T.SWITCH, null])
})

test('plan: a fixed choice, off, calm', () => {
  pin()
  TpStyles.setChoice('gitbranch')
  let a = ell()
  assert.equal(TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [] })).style, 'gitbranch')
  TpStyles.setChoice('off')
  a = ell()
  assert.equal(TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [] })), null, 'off: everyone walks')
  a = ell()
  assert.equal(TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [], style: 'dashrun' })).style, 'dashrun', 'c.style wins')
  TpStyles.setChoice('dashrun')
  TpStyles.useCalm(() => true)
  a = ell()
  const calm = TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [] }))
  assert.deepEqual([calm.style, calm.d, calm.swAt], ['dashrun', TL.DD, T.SWITCH], 'calm plans the circle timeline')
  pin()
})

test('pays reads the durations: a slow style must still beat the walk', () => {
  pin()
  const go = (n, style) => {
    const a = row(0.5, n + 1)
    return TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [], style }))
  }
  assert.ok(go(12, 'circle'))
  assert.ok(go(12, 'dashrun'))
  assert.equal(go(12, 'upload'), null, 'its longer timeline does not pay over 12 tiles')
  assert.ok(go(13, 'upload'))
  const held = id => `${TL.real(T.RELEASE, TpStyles.durs(id, 13)).toFixed(1)} s held`
  assert.ok(go(13, 'frog'), `${held('frog')} and 4 tiles walked beat a 5 s walk`)
  assert.equal(go(13, 'balloons'), null, `${held('balloons')} and 4 tiles walked save under 0.5 s`)
  assert.ok(go(30, 'balloons'))
  const a = row(0.5, 14),
    tp = TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [] }))
  assert.equal(TL.pays(a, tp.i, 0, 1, tp.d), true)
  assert.equal(TL.pays(a, tp.i, 0, 1, [1.2, 2.4, 1.0, 1.0]), false)
})

test('an early re-aim keeps the style, clock and switch, and takes the new trip as a fresh plan would', () => {
  pin()
  for (const [style, u] of [
    ['dashrun', 0.2],
    ['dashrun', -0.3],
    ['cutpaste', 0.1],
    ['upload', -0.12],
  ]) {
    const a = ell()
    a.tp = { ...TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [], style })), u }
    const old = a.tp
    a.path = (old.route || [[0.5, 0.5], ...a.path]).slice(1, 12)
    a.path = a.path.concat([[1.5, 11.5], [1.5, 12.5], [1.5, 13.5], [1.5, 14.5], [1.5, 15.5], [1.5, 16.5]])
    const tp = TL.plan(a, ctx(a, 'seat', 'visit3-0', { chairs: [] })),
      f = { ...a, tp: null },
      fresh = TL.plan(f, ctx(f, 'idle3', 'visit3-0', { chairs: [], style }))
    assert.deepEqual([tp.style, tp.swAt, tp.u, tp.cut, tp.d[0]], [old.style, old.swAt, u, null, old.d[0]], style)
    assert.notDeepEqual([tp.x1, tp.y1], [old.x1, old.y1])
    assert.deepEqual([tp.i, tp.len, tp.d], [fresh.i, fresh.len, fresh.d], `${style} at ${u}: as a fresh plan`)
    assert.ok(tp.len < old.len - 1, 'a shorter trip')
  }
  const a = ell()
  a.tp = { ...TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [], style: 'dashrun' })), u: 0.2 }
  const old = a.tp
  a.path = old.route.slice(1, 12).concat([[1.5, 11.5], [1.5, 12.5], [1.5, 13.5], [1.5, 14.5], [1.5, 15.5]])
  const tp = TL.plan(a, ctx(a, 'seat', 'visit3-0', { chairs: [] }))
  assert.deepEqual(tp.route, [[old.x0, old.y0], ...a.path.slice(0, tp.i + 1)])
  // re-aim compares on the core clock: 0.3 s into a 0.5 s departure is past L_IN, so the landing stays put
  a.tp = { ...old, u: 0.36 }
  a.path = old.route.slice(1).concat([[24.5, 11.5]])
  const kept = TL.plan(a, ctx(a, 'seat', 'visit3-0', { chairs: [] }))
  assert.deepEqual([kept.x1, kept.y1, kept.cut], [old.x1, old.y1, null])
  // kept past L_IN on a new way to the same landing: the route is the new one
  a.path = [[0.6, 0.6], ...old.route.slice(1), [24.5, 11.5]]
  const late = TL.plan(a, ctx(a, 'seat', 'visit3-0', { chairs: [] }))
  assert.deepEqual([late.x1, late.y1, late.cut], [old.x1, old.y1, null])
  assert.deepEqual(late.route, [[a.x, a.y], ...a.path.slice(0, late.i + 1)])
})

test('a slow style re-aims on its own clocks', () => {
  pin()
  // goldaura departs over 1.1 s: 0.52 s in is core 0.2, still early, so it re-aims rather than calls off
  const a = ell()
  a.tp = TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [], style: 'goldaura' }))
  const old = (a.tp = { ...a.tp, u: TL.real(0.2, a.tp.d) })
  assert.ok(old.u > T.L_IN)
  a.path = old.route ? old.route.slice(1, 12) : a.path.slice(0, 11)
  a.path = a.path.concat([[1.5, 11.5], [1.5, 12.5], [1.5, 13.5], [1.5, 14.5], [1.5, 15.5]])
  const tp = TL.plan(a, ctx(a, 'seat', 'visit3-0', { chairs: [] }))
  assert.equal(tp.cut, null, 're-aimed')
  assert.notDeepEqual([tp.x1, tp.y1], [old.x1, old.y1])
  // a slow departure and arrival, re-aimed early to a short walk at 1.5x: even its shorter trip no longer pays
  const b = row(0.5, 31)
  b.tp = { ...TL.plan(b, ctx(b, 'idle3', 'seat', { chairs: [], style: 'upload', speed: 1.5 })), u: 0.05 }
  b.path = row(0.5, 13).path
  const i = TL.landing([b.x, b.y], b.path),
    d = TpStyles.durs('upload', i)
  assert.ok(i >= 0 && TL.pays(b, i, 0.05, 1.5, TL.DD) && !TL.pays(b, i, 0.05, 1.5, d))
  const off = TL.plan(b, ctx(b, 'seat', 'visit3-0', { chairs: [], speed: 1.5 }))
  assert.equal(off.cut, 0.05, 'called off')
})

test('step keeps a stool sitter seated until core SQUEEZE, on a long departure too', () => {
  pin()
  const a = row(0.5, 31, { stool: false })
  a.tp = { ...TL.plan(a, { ...ctx(a, 'idle3', 'seat', { chairs: [], style: 'goldaura' }), prev: prev('idle3', { stool: 2 }) }) }
  const sq = TL.real(T.SQUEEZE, a.tp.d)
  assert.ok(sq > 0.5, `${sq} s on the real clock`)
  a.tp.u = sq - 0.05
  TL.step(a, 0)
  assert.equal(a.stool, 2, 'still seated')
  a.tp.u = sq + 0.01
  TL.step(a, 0)
  assert.equal(a.stool, false, 'up')
})

test('a hidden starter begins at L_IN on the core clock, so every landing fades in from its start', () => {
  pin()
  for (const style of ['circle', 'dashrun', 'goldaura', 'printer3d', 'pipe', 'portal', 'upload', 'cannon', 'frog']) {
    const a = row(0.5, 31),
      tp = TL.plan(a, { prev: prev('idle26', { hid: true }), key: 'seat', agents: [a], chairs: [], speed: 1, style })
    assert.ok(near(tp.u, TL.real(T.L_IN, tp.d), 1e-12), style)
    assert.ok(near(TL.core(tp.u, tp.d), T.L_IN, 1e-9), `${style}: core ${TL.core(tp.u, tp.d)}`)
  }
})

test('step on the core clock: switch at departure for a traveller, release and end at their real times', () => {
  pin()
  const a = row(0.5, 31, { dirFront: false, stool: false })
  a.tp = TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [], style: 'dashrun' }))
  const { d, x1, y1 } = a.tp,
    dt = 1 / 60,
    at = {}
  let u = 0
  while (a.tp) {
    const x = a.x,
      r = TL.step(a, dt)
    u += dt
    if (x !== a.x && at.sw == null) at.sw = u
    if (!r && at.rel == null) at.rel = u
    if (!a.tp) at.end = u
  }
  const within = (got, want) => got >= want - 1e-9 && got < want + dt + 1e-9
  assert.ok(within(at.sw, TL.real(TL.DEP, d)), `switched at ${at.sw}`)
  assert.ok(within(at.rel, TL.real(T.RELEASE, d)), `released at ${at.rel}`)
  assert.ok(within(at.end, TL.real(T.END, d)), `ended at ${at.end}`)
  assert.deepEqual([a.x, a.y], [x1, y1])
  // dt 1 crosses every point in a few calls
  const b = row(0.5, 31)
  b.tp = TL.plan(b, ctx(b, 'idle3', 'seat', { chairs: [], style: 'dashrun' }))
  let n = 0
  while (b.tp && n < 10) (TL.step(b, 1), n++)
  assert.ok(n <= 4 && b.tp === null, `${n} calls`)
})

test('a goal change after departure never cuts a traveller; the circle still cuts before its switch', () => {
  pin()
  const a = row(0.5, 31)
  a.tp = TL.plan(a, ctx(a, 'idle3', 'seat', { chairs: [], style: 'dashrun' }))
  TL.step(a, TL.real(TL.DEP, a.tp.d) + 0.01)
  assert.ok(a.tp.sw, 'switched at departure')
  const flying = a.tp
  assert.equal(TL.plan(a, ctx(a, 'seat', 'idle4')), flying, 'kept: walks on from the landing')
  const b = row(0.5, 31)
  b.tp = TL.plan(b, ctx(b, 'idle3', 'seat', { chairs: [] }))
  TL.step(b, 0.45)
  assert.equal(b.tp.sw, false)
  assert.equal(TL.plan(b, ctx(b, 'seat', 'idle4')).cut, 0.45)
})

test('unseen and look on the core clock of a long profile', () => {
  pin()
  const tp = { ...held().tp, d: RUN, style: 'dashrun', swAt: TL.DEP }
  const at = c => ({ ...tp, u: TL.real(c, RUN) })
  assert.equal(TL.unseen(at(T.LAND - 0.01)), true)
  assert.equal(TL.unseen(at(T.LAND + 1e-6)), false)
  assert.equal(TL.unseen({ ...held().tp, u: 0.85 }), true, 'DD as before')
  const flat = (L, out = []) => {
    for (const v of Object.values(L)) typeof v === 'object' ? flat(v, out) : out.push(v)
    return out
  }
  for (const c of [0.1, 0.3, 0.45, 0.6, 0.9]) {
    const got = flat(TL.look(at(c), false, TL.newLook())),
      want = flat(look(c))
    got.forEach((g, k) => assert.ok(near(g, want[k], 1e-9), `look at core ${c}, field ${k}: ${g} != ${want[k]}`))
  }
})

test('phase: segment fractions, switch, queue and the rewind', () => {
  pin()
  const tp = { ...held().tp, d: RUN, style: 'dashrun', swAt: TL.DEP }
  const P = (u, over = {}, calm = false) => TL.phase({ ...tp, u, ...over }, calm, TL.newPhase())
  const R = c => TL.real(c, RUN)
  // core, dep, trip, arr, fade, sw, q
  const rows = [
    [-0.2, -1, -1, -1, -1, false, 1],
    [0.21, 0.5, -1, -1, -1, false, 0],
    [0.48, -1, 0.5, -1, -1, true, 0],
    [0.73, -1, -1, 0.5, -1, true, 0],
    [1.135, -1, -1, -1, 0.5, true, 0],
    [1.4, -1, -1, -1, -1, true, 0],
  ]
  for (const [c, ...want] of rows) {
    const L = P(c < 0 ? c : R(c))
    const got = [L.dep, L.trip, L.arr, L.fade, L.sw, L.q]
    got.forEach((g, k) => assert.ok(typeof g === 'boolean' ? g === want[k] : near(g, want[k], 1e-9), `${c} field ${k}`))
    assert.ok(near(L.u, c, 1e-9) && near(L.v, c, 1e-9) && L.C === 1 && !L.cut && L.d === RUN)
    assert.equal(L.secs, c < 0 ? c : R(c))
  }
  // a cut at core 0.3 rewinds over CUT real seconds: v runs back to 0, C to 0, never switched
  const cut = R(0.3),
    mid = P(cut + T.CUT / 2, { cut })
  assert.ok(mid.cut && near(mid.C, 0.5) && near(mid.v, 0.15) && !mid.sw)
  assert.ok(near(mid.dep, 0.15 / 0.42))
  // the rewind's own clock passes swAt, yet nothing switches while it rewinds
  for (let u = cut; u <= cut + T.CUT; u += 0.01) assert.equal(P(u, { cut }).sw, false, `rewind at ${u}`)
  assert.ok(TL.core(cut + T.CUT, RUN) > TL.DEP)
  // a segment starts on its first instant: exactly DEP is the trip's 0, not the departure's 1
  const at = TL.phase({ ...tp, d: TL.DD, u: TL.DEP }, false, TL.newPhase())
  assert.deepEqual([at.dep, at.trip], [-1, 0])
  assert.equal(P(R(0.3), {}, true).calm, true)
  assert.equal(P(0.1, { hide: true }).hide, true)
  const out = TL.newPhase()
  assert.equal(TL.phase({ ...tp, u: 0.1 }, false, out), out, 'fills the object it is given')
})
