// The magic teleport inside the page's own updateAgent (web/office-agents.js), on a stubbed ClaudeOffice and a world
// island: people on a break far from their desk are back at work in seconds, and nobody else is touched.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
globalThis.document ??= { visibilityState: 'visible' }
const S = loadWeb('office-scene')
const { DESKS, IDLE_SPOTS, EVENT_IDLE, CRITTER_PLACES } = S
const { ClaudeOffice } = loadWeb('office')
loadWeb('office-agents')
const { IslandScene } = loadWeb('island-scene')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { TpStyles } = loadWeb('tp-styles')
TpStyles.setChoice('circle') // the circle's tests keep the circle
const { T } = TL

const DT = 1 / 60
const page = agents =>
  Object.assign(Object.create(ClaudeOffice.prototype), {
    agents,
    state: { speed: 1, paused: false },
    env: {},
    seasonNow: () => 'default',
    eventNow: () => null,
    idleCtx: () => ({ level: 0, snow: 0, frozen: false, calm: false }),
  })
// Someone idle and arrived at an idle spot, as updateAgent leaves them.
const parked = (si, desk, id = desk + 1) => {
  const sp = IDLE_SPOTS[si]
  return {
    id,
    desk,
    status: 'idle',
    x: sp.pt[0],
    y: sp.pt[1],
    path: [],
    goalKey: 'idle' + si,
    seated: false,
    sleeping: false,
    stool: sp.stool || false,
    actNow: sp.act,
    idleSpot: si,
    moving: false,
    dirFront: true,
    parent: null,
    leaving: false,
    target: null,
    wcT: sp.act === 'wc' ? 2 : 0,
    wcIn: sp.act === 'wc',
    tp: null,
    until: 1e15,
  }
}
// 16 people at 16 kinds of spot (tp2/harness2-lib.mjs park): pantry, games, phone, smoking, stall, bath, bench, lake.
function park(n = 16) {
  const spots = [0, 3, 5, 7, 11, 13, 15, 17, 18, 20].concat(
    IDLE_SPOTS.map((s, i) => [s, i])
      .filter(([s]) => ['smoke', 'wc', 'bath', 'bench', 'fish'].includes(s.act))
      .map(([, i]) => i),
  )
  const pick = [],
    acts = new Set()
  for (const i of spots) {
    const a = IDLE_SPOTS[i].act
    if (pick.length < n && (!acts.has(a) || pick.length > 12)) {
      pick.push(i)
      acts.add(a)
    }
  }
  for (const i of spots) if (pick.length < n && !pick.includes(i)) pick.push(i)
  return pick.map((si, k) => parked(si, k, k + 1))
}
// Steps every agent until all are seated (or `max` s), keeping what happened to each.
function run(p, { max = 30, dt = DT, each } = {}) {
  const seen = new Map()
  let t = 0
  while (t < max && p.agents.some(a => !a.seated)) {
    t += dt
    for (const a of p.agents) {
      const had = a.tp
      p.updateAgent(a, dt)
      const s = seen.get(a) || { start: null, seatedAt: null, tp: null }
      if (!had && a.tp && !s.tp) Object.assign(s, { tp: a.tp, start: a.tp.u - dt })
      if (a.seated && s.seatedAt == null) s.seatedAt = t
      seen.set(a, s)
    }
    each && each(t)
  }
  return { t, seen }
}
const seeded = s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
function withRandom(fn) {
  const r = Math.random
  Math.random = seeded(7)
  try {
    return fn()
  } finally {
    Math.random = r
  }
}
const FISH = IDLE_SPOTS.findIndex(s => s.act === 'fish')

test('back from the lake: teleported and seated within 3 s instead of 12', () => {
  const a = parked(FISH, 12),
    p = page([a])
  a.status = 'working'
  const walk = { ...a },
    w = page([walk])
  w.updateAgent(walk, 0)
  const tiles = Math.hypot(walk.path[0][0] - walk.x, walk.path[0][1] - walk.y) + TL.rest(walk.path, 0)
  assert.ok(tiles / 2.6 > 12, `${tiles} tiles to walk`)
  const { t, seen } = run(p)
  assert.ok(seen.get(a).tp, 'teleported')
  assert.ok(a.seated && t < 3, `seated after ${t} s`)
})

test('the walk ends as today', () => {
  const a = parked(FISH, 12),
    p = page([a])
  a.status = 'working'
  const { seen } = run(p)
  assert.ok(seen.get(a).tp, 'arrived after a teleport')
  const d = DESKS[12]
  assert.deepEqual([a.seated, a.dirFront, a.path.length, a.moving, a.tp], [true, false, 0, false, null])
  assert.deepEqual([a.x, a.y], [d.gx + 1, d.gy + 1.45])
  assert.equal(a.goalKey, 'seat')
})

test('sixteen back at once', () =>
  withRandom(() => {
    const p = page(park())
    p.agents.forEach(a => (a.status = 'working'))
    let bright = 0
    const { seen } = run(p, {
      each: () =>
        (bright = Math.max(bright, p.agents.filter(a => a.tp && a.tp.cut == null && a.tp.u >= 0 && a.tp.u < 1).length)),
    })
    const all = [...seen.values()]
    const last = Math.max(...all.map(s => s.seatedAt))
    assert.ok(last < 5, `all seated after ${last} s`)
    assert.equal(all.filter(s => s.tp).length, 15)
    const queued = all.filter(s => s.tp && !s.tp.free).map(s => s.start)
    queued.forEach((u, k) => assert.ok(Math.abs(u + 0.15 * k) < 1e-9, `start ${k}: ${u}`))
    assert.ok(bright <= 8, `${bright} bright at once`)
  }))

test('at speed 3 only the worthwhile ones teleport', () =>
  withRandom(() => {
    const p = page(park())
    p.state.speed = 3
    p.agents.forEach(a => (a.status = 'working'))
    const { seen } = run(p)
    const all = [...seen.values()]
    assert.equal(all.filter(s => s.tp).length, 10)
    const last = Math.max(...all.map(s => s.seatedAt))
    assert.ok(last < 3.5, `all seated after ${last} s`)
  }))

test('a new session walks in from the door without a teleport', () =>
  withRandom(() => {
    const p = page([])
    Object.assign(p, { seq: 0, depts: new Map() })
    const a = p.addAgent({})
    a.desk = 15 // the desk farthest from the door: a walk long enough to teleport from a break
    a.status = 'working'
    p.updateAgent(a, 0)
    assert.ok(Math.hypot(a.path[0][0] - a.x, a.path[0][1] - a.y) + TL.rest(a.path, 0) >= TL.FAR)
    let tp = !!a.tp
    run(p, { each: () => (tp = tp || !!a.tp) })
    assert.equal(tp, false)
    assert.ok(a.seated)
  }))

test('leaving never teleports, and a teleport in flight is rewound when the session ends', () => {
  const stub = p => Object.assign(p, { log: () => {}, fateCtx: () => ({}), forceFate: 'exit' })
  const a = parked(FISH, 12),
    p = stub(page([a]))
  p.leave(a)
  let tp = false
  for (let k = 0; k < 60; k++) {
    p.updateAgent(a, DT)
    tp = tp || !!a.tp
  }
  assert.equal(a.goalKey, 'exit')
  assert.equal(tp, false)

  const b = parked(FISH, 12),
    q = stub(page([b]))
  b.status = 'working'
  for (let k = 0; k < 600 && !(b.tp && b.tp.u >= 0.3); k++) q.updateAgent(b, DT)
  assert.ok(b.tp, 'teleporting')
  const at = [b.x, b.y],
    cut = b.tp.u
  q.leave(b)
  q.updateAgent(b, DT)
  assert.equal(b.goalKey, 'exit')
  assert.ok(Math.abs(b.tp.cut - cut) < 1e-9 && !b.tp.sw, 'called off where it stood')
  let held = 1
  while (b.tp && held < 99) {
    assert.deepEqual([b.x, b.y, b.moving], [...at, false])
    q.updateAgent(b, DT)
    held++
  }
  assert.ok(held >= 15 && held <= 16, `held for ${held} frames`)
  q.updateAgent(b, DT)
  assert.ok(b.moving, 'then walks out')
})

test('a person in the restroom stall arrives without leaving', () => {
  const si = IDLE_SPOTS.findIndex(s => s.act === 'wc')
  const a = parked(si, 0),
    p = page([a])
  a.status = 'working'
  p.updateAgent(a, DT)
  assert.ok(a.tp && a.tp.hide && a.tp.free)
  assert.ok(Math.abs(a.tp.u - DT - T.L_IN) < 1e-9, `starts at ${a.tp.u - DT}`)
  assert.equal(a.wcIn, false)
  const out = TL.newLook()
  while (a.tp && a.tp.u < 0.56 - 1e-9) {
    assert.equal(TL.look(a.tp, false, out).show, 0, `seen at ${a.tp.u}`)
    p.updateAgent(a, DT)
  }
  assert.ok(a.tp && a.tp.sw)
})

test('a skater leaves from the bank', () => {
  const si = IDLE_SPOTS.findIndex(s => s.act === 'skate'),
    sp = IDLE_SPOTS[si]
  const { cx, cy } = EVENT_IDLE.rink
  assert.ok(CRITTER_PLACES.water.has(Math.floor(cx) + ',' + Math.floor(cy)), 'on the ice')
  const a = { ...parked(si, 0), x: cx, y: cy },
    p = page([a])
  a.status = 'working'
  p.updateAgent(a, DT)
  assert.ok(a.tp)
  assert.deepEqual([a.tp.x0, a.tp.y0], [sp.tile[0] + 0.5, sp.tile[1] + 0.5])
})

test('a queued stool sitter keeps sitting', () =>
  withRandom(() => {
    const p = page(park())
    p.agents.forEach(a => (a.status = 'working'))
    const s = p.agents.find(a => a.stool)
    const log = []
    run(p, { each: () => s.tp && !s.tp.sw && log.push([s.tp.u, s.stool]) })
    assert.ok(log[0][0] < -0.3, `queued at ${log[0][0]}`)
    for (const [u, stool] of log) assert.equal(!!stool, u < T.SQUEEZE, `stool ${stool} at ${u}`)
    assert.ok(log.some(([u]) => u >= T.SQUEEZE))
  }))

test('pause freezes the clock in the office, the world island runs', () => {
  const a = parked(FISH, 12)
  a.status = 'working'
  const noop = () => {}
  const p = Object.assign(page([a]), {
    world: null,
    bubbleEls: {},
    draw: noop,
    drawSky: noop,
    envNow: () => ({}),
    doneSweep: noop,
    stepDogs: noop,
    stepCritters: noop,
    stepProps: noop,
  })
  p.updateAgent(a, DT)
  const u = a.tp.u
  p.last = 1000
  p.state.paused = true
  p.frame(1016)
  assert.equal(a.tp.u, u)
  p.state.paused = false
  p.frame(1032)
  assert.ok(Math.abs(a.tp.u - u - 0.016) < 1e-9)
  const isl = Object.assign(Object.create(IslandScene.prototype), {
    host: { speed: 1 },
    agents: [a],
    doneSweep: noop,
    stepDogs: noop,
    stepCritters: noop,
    stepProps: noop,
  })
  isl.frame(0.05)
  assert.ok(Math.abs(a.tp.u - u - 0.066) < 1e-9)
})

const seatedAt = (desk, id) => ({
  ...parked(0, desk, id),
  status: 'working',
  x: DESKS[desk].gx + 1,
  y: DESKS[desk].gy + 1.45,
  goalKey: 'seat',
  seated: true,
  stool: false,
  actNow: null,
  idleSpot: null,
  wcT: 0,
  wcIn: false,
})

test('called to another desk while the landing circle shows: rewound, then teleported again', () => {
  for (const desk of [0, 3, 8, 15]) {
    const a = parked(FISH, 12),
      t = seatedAt(desk, 50),
      p = page([a, t])
    a.status = 'working'
    while (!(a.tp && a.tp.u >= 0.3)) p.updateAgent(a, DT)
    Object.assign(a, { status: 'talking', target: t.id })
    let time = 0,
      cut = null,
      again = null
    while (time < 10 && !(a.goalKey.startsWith('visit') && !a.moving && !a.tp && !a.path.length)) {
      p.updateAgent(a, DT)
      time += DT
      if (a.tp && a.tp.cut != null) cut = a.tp
      if (cut && a.tp && a.tp.cut == null) again = again || { ...a.tp }
    }
    assert.ok(cut && cut.again, `desk ${desk}: called off to start again`)
    assert.ok(again && again.u <= DT + 1e-9, `desk ${desk}: a fresh teleport`)
    assert.deepEqual([again.x0, again.y0], [cut.x0, cut.y0])
    assert.ok(time < 3.5, `desk ${desk}: at the visit after ${time} s`)
  }
})

test('back to work while it rewinds: the rewind plays out, then a fresh teleport, the stall user unseen', () => {
  const WC = IDLE_SPOTS.findIndex(s => s.act === 'wc')
  for (const [si, desk] of [
    [FISH, 12],
    [WC, 0],
  ]) {
    const a = parked(si, desk),
      p = page([a]),
      out = TL.newLook()
    a.status = 'working'
    while (!(a.tp && a.tp.u >= 0.35)) p.updateAgent(a, DT)
    const hide = a.tp.hide
    a.status = 'idle'
    p.updateAgent(a, DT)
    const cut = a.tp
    assert.ok(cut.cut != null)
    a.status = 'working'
    p.updateAgent(a, DT)
    assert.ok(a.tp.cut != null && a.tp.again, 'still rewinding')
    assert.equal(TL.look(a.tp, false, out).show, hide ? 0 : 3, 'no pop')
    let frames = 0
    while (a.tp && a.tp.cut != null) {
      if (!hide) assert.notEqual(TL.look(a.tp, false, out).show, 0)
      p.updateAgent(a, DT)
      frames++
    }
    p.updateAgent(a, DT)
    assert.ok(frames >= 13 && frames <= 15, `rewound for ${frames} frames`)
    assert.ok(a.tp && a.tp.cut == null && a.tp.hide === hide, 'planned afresh from the break')
    assert.deepEqual([a.tp.x0, a.tp.y0], [cut.x0, cut.y0])
    if (hide) assert.equal(TL.look(a.tp, false, out).show, 0, 'the stall user stays unseen')
    run(p, { max: 4 })
    assert.ok(a.seated)
  }
})

test('a bather leaves from the pond, not from the skate bank', () => {
  const si = IDLE_SPOTS.findIndex(s => s.act === 'bath'),
    sp = IDLE_SPOTS[si]
  assert.ok(CRITTER_PLACES.water.has(sp.tile.join(',')), 'the bath is in the lake')
  const a = parked(si, 0),
    p = page([a])
  a.status = 'working'
  p.updateAgent(a, DT)
  assert.ok(a.tp && a.tp.free)
  assert.deepEqual([a.x, a.y, a.tp.x0, a.tp.y0], [...sp.pt, ...sp.pt])
  // Called off: rewound in the pond, then walks out of it.
  while (a.tp.u < 0.3) p.updateAgent(a, DT)
  a.status = 'idle'
  p.updateAgent(a, DT)
  assert.ok(a.tp.cut != null)
  assert.deepEqual([a.x, a.y], sp.pt)
  // Walking away (no teleport) still steps out at the bank, as before.
  const b = parked(si, 0),
    q = page([b])
  b.idleSpot = null
  q.updateAgent(b, 0)
  const s = EVENT_IDLE.spots.find(e => e.act === 'skate')
  assert.ok(!b.tp && b.goalKey.startsWith('idle'))
  assert.deepEqual([b.x, b.y], [s.tile[0] + 0.5, s.tile[1] + 0.5])
})

test('the bather skips the queue in the real shower', () =>
  withRandom(() => {
    const p = page(park())
    p.agents.forEach(a => (a.status = 'working'))
    const bather = p.agents.find(a => a.actNow === 'bath')
    const { seen } = run(p)
    const s = seen.get(bather)
    assert.ok(s.tp && s.tp.free && Math.abs(s.start) < 1e-9)
  }))

test('a visitor to desk 15 slot 2 does not land on the stairs', () => {
  const owner = seatedAt(15, 50),
    lake = IDLE_SPOTS.map((s, i) => i).filter(i => ['fish', 'bench', 'smoke'].includes(IDLE_SPOTS[i].act)),
    v = lake.slice(0, 3).map((si, k) => ({ ...parked(si, k, k + 1), status: 'talking', target: 50 })),
    p = page([...v, owner])
  for (const a of v) p.updateAgent(a, DT)
  assert.match(v[2].goalKey, /^visit50-2$/)
  const { x1, y1 } = v[2].tp
  assert.ok(!(y1 === S.H + 0.5 && x1 > 22 && x1 < 24), `lands at ${x1},${y1}`)
})

// ---- styles: every one alone, mixed, a fixed choice, off ----

// The 16-person return in one style choice; what each person did.
function showerIn(choice, { speed = 1 } = {}) {
  TpStyles.reset()
  TpStyles.setChoice(choice)
  try {
    return withRandom(() => {
      const p = page(park())
      p.state.speed = speed
      p.agents.forEach(a => (a.status = 'working'))
      const { seen } = run(p)
      const all = [...seen.values()]
      return { last: Math.max(...all.map(s => s.seatedAt)), tps: all.filter(s => s.tp).map(s => s.tp) }
    })
  } finally {
    TpStyles.reset()
    TpStyles.setChoice('circle')
  }
}

test('every style alone: sixteen seated within 7.8 s, at least 13 of them teleported', () => {
  for (const { id } of TpStyles.STYLES) {
    const r = showerIn(id)
    assert.ok(r.last < 7.8, `${id}: all seated after ${r.last} s`)
    assert.ok(r.tps.length >= 13, `${id}: ${r.tps.length} teleported`)
    assert.ok(r.tps.every(tp => tp.style === id), id)
  }
})

test('random styles: one per person, everyone seated within 7.8 s', () => {
  const r = showerIn('random')
  assert.ok(r.last < 7.8, `seated after ${r.last} s`)
  assert.ok(new Set(r.tps.map(tp => tp.style)).size >= 8, 'a mix of styles')
  assert.ok(r.tps.every(tp => TpStyles.RANDOM.includes(tp.style)))
})

test('a fixed choice gives everyone that style; off walks everyone', () => {
  const fixed = showerIn('dashrun')
  assert.ok(fixed.tps.length >= 13 && fixed.tps.every(tp => tp.style === 'dashrun'))
  const off = showerIn('off')
  assert.equal(off.tps.length, 0)
})

test('at speed 3 a slow style teleports fewer than the circle', () => {
  const circle = showerIn('circle', { speed: 3 }),
    slow = showerIn('upload', { speed: 3 })
  assert.equal(circle.tps.length, 10)
  assert.ok(slow.tps.length < 10, `${slow.tps.length} uploads`)
})
