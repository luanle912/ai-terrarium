// The contract every teleport style keeps (web/tp-style-<id>.js, stub or real), checked on a real page: each style is
// swept through its whole timeline over a grid of light, snow, event and theme, and through cuts, reduced motion, a
// small view, a hidden start and stool sitters. Nothing throws, the context is left as found, the paint stays within
// budget, something shows while it should, and a 16-person shower stays under the frame budget.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
const PAINT = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage'])
const PATH = new Set(['rect', 'moveTo', 'lineTo', 'arc', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo'])
const FRESH = () => ({
  globalAlpha: 1, imageSmoothingEnabled: false, lineWidth: 1, font: '10px sans-serif', textAlign: 'start',
  textBaseline: 'alphabetic', fillStyle: '#000', strokeStyle: '#000', dash: [],
})
const K = { k: 1, made: [], grads: 0 }
// A 2d context that counts what it is asked, keeps save/restore state and checks translate.
function context(c) {
  let s = FRESH()
  const stack = []
  const fns = {
    save: () => (c.saves++, stack.push({ ...s, dash: [...s.dash] })),
    restore: () => (c.restores++, stack.length ? (s = stack.pop()) : c.bad.push('restore without save')),
    getTransform: () => ({ a: K.k }),
    setLineDash: d => (s.dash = [...d]),
    getLineDash: () => [...s.dash],
    translate: (x, y) => {
      if (!Number.isInteger(x) || !Number.isInteger(y)) c.bad.push(`translate by ${x}, ${y}`)
      if (!stack.length) c.bad.push('translate outside save')
    },
    createLinearGradient: () => (K.grads++, { addColorStop() {} }),
    createRadialGradient: () => (K.grads++, { addColorStop() {} }),
    createPattern: () => ({}),
    measureText: () => ({ width: 0 }),
  }
  return {
    ctx: new Proxy({}, {
      get: (_, k) => k in fns ? fns[k] : k in s ? s[k] : (...a) => {
        if (PAINT.has(k)) c.paint++
        else if (PATH.has(k)) c.path++
        c.log.push(k, a.length ? a[a.length - 1] : 0, s.globalAlpha)
      },
      set: (_, k, v) => ((s[k] = v), true),
    }),
    state: () => s,
    depth: () => stack.length,
  }
}
globalThis.document = {
  visibilityState: 'visible',
  createElement: () => {
    const cv = { width: 0, height: 0 }
    const c = { paint: 0, path: 0, log: [], bad: [], saves: 0, restores: 0 }
    const { ctx } = context(c)
    cv.getContext = () => ctx
    K.made.push(cv)
    return cv
  },
}
const S = loadWeb('office-scene')
const { ClaudeOffice } = loadWeb('office')
loadWeb('office-agents')
loadWeb('office-draw-xmas')
loadWeb('office-draw-people')
const madeAtLoad = K.made.length
const D = loadWeb('office-draw-teleport')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { TpStyles } = loadWeb('tp-styles')
const { DRAW } = loadWeb('tp-style-index')
const { EventLogic } = loadWeb('event-logic')
const { T } = TL
const CIRCLE = DRAW.circle
const EV = EventLogic.active(new Date(2026, 11, 20, 12), 'on', null, 0)
const ORIGIN = [21.5, 10.5], LAND = [3.5, 4.5], ROUTE = [ORIGIN, [12.5, 10.5], [3.5, 10.5], LAND]
// Straight across the lounge rug, then on to the landing (plan always ends the route there).
const RUGWAY = [[24.5, 12.5], [24.5, 3.5], [12.5, 3.5], [3.5, 3.5], LAND]

// A real page with real people; the person is drawn through the walker item, body passes tallied.
const page = Object.assign(Object.create(ClaudeOffice.prototype), {
  agents: [], state: { speed: 1, paused: false, sel: null }, env: {}, seq: 0, depts: new Map(), snowShown: 0,
})
const C = { paint: 0, path: 0, log: [], bad: [], saves: 0, restores: 0, passes: 0, body: 0, extra: 0 }
let depth = 0, tpRet = null
const drawPerson = ClaudeOffice.prototype.drawPerson, tpPerson = ClaudeOffice.prototype.tpPerson
page.tpPerson = function (G, a) {
  const r = tpPerson.call(this, G, a)
  if (depth === 1) tpRet = r
  return r
}
page.drawPerson = function (G, a) {
  depth++
  const p0 = C.paint, b0 = C.body, n0 = C.passes, alpha = G.ctx.globalAlpha
  tpRet = null
  try {
    drawPerson.call(this, G, a)
  } finally {
    const all = C.paint - p0, nested = C.body - b0
    if (depth > 1) (C.passes++, (C.body += all - nested), C.alphas.push(alpha))
    else if (!tpRet) (C.passes++, (C.body += all - nested), C.alphas.push(alpha))
    if (depth === 1) C.extra += Math.max(0, C.passes - n0 - 1)
    depth--
  }
}
const people = Array.from({ length: 16 }, () => page.addAgent({}))
function sceneG({ df = 1, ev = null, theme = 'day' } = {}) {
  const { ctx, state, depth: d } = context(C)
  const poly = (pts, fill, stroke) => {
    ctx.beginPath()
    pts.forEach((p, i) => (i ? ctx.lineTo(Math.round(p[0]), Math.round(p[1])) : ctx.moveTo(Math.round(p[0]), Math.round(p[1]))))
    ctx.closePath()
    if (fill) ((ctx.fillStyle = fill), ctx.fill())
    const s = stroke === undefined ? th.stroke : stroke
    if (s) ((ctx.strokeStyle = s), (ctx.lineWidth = 1), ctx.stroke())
  }
  const th = S.THEMES[theme]
  const box = (x, y, w, hh, z0, z1, top) => poly([S.P(x, y, z1), S.P(x + w, y, z1), S.P(x + w, y + hh, z1), S.P(x, y + hh, z1)], top)
  const rect = (x, y, w, hh, col) => ((ctx.fillStyle = col), ctx.fillRect(Math.round(x), Math.round(y), w, hh))
  return { G: { ctx, poly, box, rect, th, t: 2.4, df, ev, cold: false }, state, depth: d }
}
// One frame of the given agents: tp items plus each walker, sorted, run. Returns this frame's tallies.
function frame(agents, cfg = {}) {
  K.k = cfg.k || 1
  page.agents = agents
  // Posed tps restart with mk 0 and the print clock is frozen, so marks would pile up across frames (marks() keeps them).
  if (!cfg.keep) page.tpMarks = []
  page.env = { reduced: !!cfg.reduced }
  page.snowShown = cfg.snow || 0
  Object.assign(C, { paint: 0, path: 0, log: [], bad: [], saves: 0, restores: 0, passes: 0, body: 0, extra: 0,
    alphas: [] })
  const { G, state, depth: d } = sceneG(cfg), items = []
  page.tpItems(G, items)
  const tpItems = items.length
  C.walker = 0
  const walk = a => ((C.walker -= C.paint), page.drawPerson(G, a), (C.walker += C.paint))
  for (const a of agents) items.push({ z: a.x + a.y + (a.stool ? 0.1 : 0), f: () => walk(a) })
  items.sort((p, q) => p.z - q.z).forEach(i => i.f())
  const s = state(), f = FRESH()
  for (const k of ['globalAlpha', 'imageSmoothingEnabled', 'lineWidth', 'font', 'textAlign', 'textBaseline'])
    if (s[k] !== f[k]) C.bad.push(`${k} left at ${s[k]}`)
  if (s.dash.length) C.bad.push('line dash left set')
  if (C.saves !== C.restores || d()) C.bad.push(`save ${C.saves} / restore ${C.restores}`)
  return { paint: C.paint - C.body, path: C.path, passes: C.passes, extra: C.extra, items: tpItems, bad: [...C.bad],
    log: C.log.join('|'), walker: C.walker, alphas: [...C.alphas] }
}
// Puts agent a mid-teleport in style id at real clock u.
function pose(a, id, u, over = {}) {
  const prof = TpStyles.BY_ID[id], ground = prof.kind === 'ground'
  const d = TpStyles.durs(id, 20), swAt = d[1] > 0.12 ? TL.DEP : T.SWITCH
  const from = over.from || ORIGIN, to = over.to || LAND
  const tp = {
    was: 'idle3', u, i: 0, x0: from[0], y0: from[1], x1: to[0], y1: to[1], hide: !!over.hide, free: !!over.hide,
    stool: over.stool || false, sw: false, cut: over.cut == null ? null : over.cut, again: false, style: id, d, swAt,
    len: 20, route: ground ? (over.route || ROUTE).map(p => [...p]) : null, mk: 0,
  }
  const c = TL.core(u, d)
  tp.sw = tp.cut == null && c >= swAt
  Object.assign(a, { status: 'working', desk: 0, moving: false, seated: false, sleeping: false, actNow: null,
    dirFront: true, path: [to, [to[0] + 1, to[1]]], tp })
  a.stool = !tp.sw && c < T.SQUEEZE ? tp.stool : false
  ;[a.x, a.y] = tp.sw ? to : from
  return a
}
const GRID = []
for (const df of [1, 0.2]) for (const snow of [0, 3]) for (const ev of [null, EV]) for (const theme of ['day', 'blueprint'])
  GRID.push({ df, snow, ev, theme })
const IDS = TpStyles.STYLES.map(s => s.id)
const CAPS = { normal: 60, lite: 30, queued: 8, path: 400 }
// A hidden start may show nothing while its landing fades in from L_IN, until the departure would have ended.
const visible = (L, gap) => !L.cut && !L.calm && L.u >= (L.hide ? TL.DEP : 0) && L.u < T.RELEASE &&
  !(gap && L.u >= gap[0] && L.u < gap[1])

// Sweeps one style through a config; returns the problems found.
function sweep(id, cfg, over = {}, from, to) {
  const d = TpStyles.durs(id, 20), a = people[0], S = DRAW[id] || CIRCLE, out = []
  const start = from == null ? -0.3 : from, end = to == null ? TL.real(T.END, d) + 0.05 : to
  for (let u = start; u <= end; u += 1 / 30) {
    pose(a, id, u, over)
    const L = TL.phase(a.tp, !!cfg.reduced, TL.newPhase()), at = `${id} u ${u.toFixed(3)} ${JSON.stringify(cfg)}`
    let f
    try {
      f = frame([a], cfg)
    } catch (e) {
      out.push(`${at}: threw ${e.message}`)
      continue
    }
    for (const b of f.bad) out.push(`${at}: ${b}`)
    const cap = L.q ? CAPS.queued : CAPS.normal
    if (f.paint > cap) out.push(`${at}: ${f.paint} paint calls > ${cap}`)
    if (f.path > CAPS.path) out.push(`${at}: ${f.path} path ops`)
    if (f.passes > 2) out.push(`${at}: ${f.passes} body passes`)
    if (!cfg.reduced && visible(L, S.gap) && f.paint + f.passes === 0) out.push(`${at}: nothing shows`)
    // A traveller is at the landing during the trip: its body belongs to trip(), never the walker item at that depth.
    if (S !== CIRCLE && TpStyles.BY_ID[id].kind !== 'none' && !cfg.reduced && !L.cut && L.trip >= 0 && f.walker)
      out.push(`${at}: drawn at the walker in the trip`)
  }
  return out
}
const report = (out, n = 8) => assert.deepEqual(out.slice(0, n), [], `${out.length} problems`)

test('every style is registered with a draw module, at most two marks each', () => {
  assert.equal(madeAtLoad, 0, 'loading made no canvas')
  for (const id of IDS) {
    assert.ok(id in DRAW, `${id} in the index`)
    const S = DRAW[id]
    if (!S) continue
    assert.ok(!S.marks || S.marks.length <= 2, `${id} marks`)
    for (const m of S.marks || []) {
      assert.ok(['dep', 'arr', 'rel'].includes(m.at) && [0, 1].includes(m.end) && m.ttl > 0, `${id} mark`)
      assert.ok(['floor', 'back', 'stand', 'air'].includes(m.layer) && typeof S.drawMark === 'function', `${id} mark`)
    }
  }
  assert.equal(D.TP_PART.SHADOW, 128)
})

test('the sources keep to the drawing rules', () => {
  const dir = new URL('../web/', import.meta.url)
  const files = readdirSync(dir).filter(f => /^tp-style-.*\.js$|^tp-kit\.js$|^tp-person\.js$/.test(f))
  assert.ok(files.length >= IDS.length + 3)
  const BAN = [/shadowBlur/, /\.filter\s*=/, /getImageData|putImageData/, /globalCompositeOperation/, /setTransform/,
    /\.scale\(/, /\.rotate\(/, /resetTransform/, /Math\.random/, /Date\.now/, /performance\.now/, /new Date\b/,
    /console\./, /fillText|strokeText/]
  // Shared art and pure logic only: the page modules (office.js, office-agents.js, the dispatcher) would be cycles.
  const ALLOW = new Set(['tp-kit', 'tp-person', 'teleport-logic', 'tp-styles', 'office-scene', 'office-draw-xmas',
    'office-people', 'office-people-xmas', 'island-grid', 'pantry-items', 'restroom-logic'])
  for (const m of ['office', 'office-agents', 'office-draw-teleport', 'tp-style-index']) assert.ok(!ALLOW.has(m))
  for (const f of files) {
    const code = readFileSync(new URL(f, dir), 'utf8')
    for (const m of code.matchAll(/^import\b[^;]*?from '\.\/([^']+)\.js';$/gms)) {
      const ok = ALLOW.has(m[1]) || (f === 'tp-style-index.js' && /^tp-style-[a-z0-9]+$/.test(m[1]))
      assert.ok(ok, `${f} imports ${m[1]}.js`)
    }
    assert.ok(!/\bimport\(/.test(code), `${f}: no dynamic import`)
    for (const re of BAN) assert.ok(!re.test(code), `${f}: ${re}`)
    // no words in the art: they would stay English in every language
    for (const m of code.matchAll(/\.text\((?:[^'`,()]*,\s*)?['`]([^'`]*)['`]/g))
      assert.ok(!/\p{L}/u.test(m[1]), `${f}: '${m[1]}'`)
    const made = (code.match(/document\.createElement/g) || []).length
    assert.equal(made, f === 'tp-kit.js' ? 1 : 0, `${f}: canvases only through Kit.atlas`)
  }
})

let warm = false
for (const id of IDS)
  test(`style ${id}: the grid, cuts, calm, a small view, a hidden start, stool sitters`, () => {
    TpStyles.reset()
    // The circle's bakes (calm and reduced motion draw it) belong to no style: make them first.
    if (!warm) {
      sweep('circle', GRID[0])
      warm = true
    }
    const d = TpStyles.durs(id, 20), out = [], made = K.made.length
    for (const cfg of GRID) out.push(...sweep(id, cfg))
    const base = GRID[0]
    out.push(...sweep(id, { ...base, reduced: true }))
    out.push(...sweep(id, { ...base, k: 0.5 }))
    out.push(...sweep(id, base, { hide: true }, TL.real(T.L_IN, d)))
    const rugway = { route: RUGWAY, from: RUGWAY[0], to: RUGWAY.at(-1) }
    for (const df of [1, 0.2]) out.push(...sweep(id, { ...base, df }, rugway))
    out.push(...sweep(id, base, { stool: 1 }))
    out.push(...sweep(id, base, { stool: 2 }))
    for (const c of [TL.real(0.1, d), TL.real(0.3, d), TL.real(0.21, d)])
      out.push(...sweep(id, base, { cut: c }, c, c + T.CUT + 0.02))
    report(out)
    // bakes: at most two canvases and 98,304 px, none after the first sweep (the shared 64 px glow aside)
    const bakes = K.made.slice(made).filter(cv => cv.width !== 64)
    assert.ok(bakes.length <= 2 && bakes.reduce((n, cv) => n + cv.width * cv.height, 0) <= 98304, `${id} bakes`)
    const again = K.made.length, grads = K.grads
    assert.deepEqual(sweep(id, base), [])
    assert.equal(K.made.length, again, 'no canvas on a second sweep')
    assert.equal(K.grads, grads, 'no gradient per frame')
    // the same frame twice draws the same (a mark born in the first is born again: frame() empties the list)
    for (const c of [0.2, 0.48, 0.7]) {
      const a = pose(people[0], id, TL.real(c, d)), once = frame([a], base).log
      a.tp.mk = 0
      assert.equal(once, frame([a], base).log, `${id} at core ${c}`)
    }
    // a crowd of eleven: lite, within the lite cap each, no extra body pass (the circle is exempt from that)
    const crowd = people.slice(0, 11).map((a, j) => pose(a, id, TL.real(0.5, d) + 0.001 * j, { from: [21.5 + j, 10.5] }))
    for (let c = 0; c < 1.3; c += 0.05) {
      crowd.forEach((a, j) => pose(a, id, TL.real(c, d) + 0.001 * j, { from: [21.5, 6 + j] }))
      const f = frame(crowd, base)
      assert.ok(f.paint <= CAPS.lite * 11, `${id} lite paint ${f.paint} at core ${c}`)
      if ((DRAW[id] || CIRCLE) !== CIRCLE) assert.equal(f.extra, 0, `${id} extra body passes in lite`)
      assert.deepEqual(f.bad, [])
    }
  })

// A stall user's clock starts at core L_IN (teleport-logic plan): a landing drawn any earlier would pop in mid-way.
test('no landing draws before L_IN, so a hidden start fades in from its first frame', () => {
  TpStyles.reset()
  const base = GRID[0], out = []
  for (const id of IDS) {
    const d = TpStyles.durs(id, 20)
    for (const c of [0.2, T.L_IN - 0.02, T.L_IN - 0.005]) {
      const f = frame([pose(people[0], id, TL.real(c, d), { hide: true })], base)
      if (f.paint) out.push(`${id} at core ${c}: ${f.paint} paint calls`)
    }
  }
  report(out)
})

// A flier from a hidden start lands like anyone else: the arrival draws the person every frame until the walker.
// Holiday air styles too: sleigh and starlantern carry a body, bats gathers back through capture() passes.
test('a flying style draws the person through the whole arrival of a hidden start', () => {
  TpStyles.reset()
  const base = GRID[0], out = [], fly = ({ tier, kind }) => tier === 'F' || (tier === 'H' && kind === 'air')
  for (const id of IDS.filter(i => fly(TpStyles.BY_ID[i]) && DRAW[i])) {
    const d = TpStyles.durs(id, 20)
    for (let c = TL.ARR; c < T.RELEASE; c += 0.01) {
      const f = frame([pose(people[0], id, TL.real(c, d), { hide: true })], base)
      if (!f.passes) out.push(`${id} at core ${c.toFixed(2)}: no body`)
    }
  }
  report(out, 40)
})

// The flier fades in at the stall's exit from L_IN, so its ground shadow must too (ground()'s out[3]).
test('a hidden start fades the ground shadow in with the flier, no dark blob alone at the exit', () => {
  TpStyles.reset()
  const { Kit } = loadWeb('tp-kit'), was = Kit.shadow, got = [], out = []
  Kit.shadow = (ctx, x, y, w, al) => (got.push(al), was(ctx, x, y, w, al))
  try {
    for (const id of IDS.filter(i => TpStyles.BY_ID[i].kind === 'air' && DRAW[i])) {
      const d = TpStyles.durs(id, 20)
      got.length = 0
      frame([pose(people[0], id, TL.real(T.L_IN + 0.002, d), { hide: true })], GRID[0])
      const hi = got.filter(al => al > 0.3)
      if (hi.length) out.push(`${id}: shadow alpha ${hi.map(al => al.toFixed(2))}`)
    }
  } finally {
    Kit.shadow = was
  }
  report(out)
})

// A cut rewinds to the person standing where they were: the last frames before the walker takes over draw them whole,
// so they do not fade out and pop back (only the effect fades with L.C).
test('a cut ends with the person drawn whole, not faded out before the walker pops back', () => {
  TpStyles.reset()
  const base = GRID[0], out = []
  for (const id of IDS) {
    const d = TpStyles.durs(id, 20)
    for (const c of [0.05, 0.21].map(k => TL.real(k, d)))
      for (const k of [1, 2]) {
        const f = frame([pose(people[0], id, c + T.CUT - k / 60, { cut: c })], base)
        const low = f.alphas.filter(al => al < 0.95)
        if (low.length) out.push(`${id} cut at ${c.toFixed(2)} s, ${k} frame(s) before the end: body alpha ${low}`)
      }
  }
  report(out, 40)
})

// 16 people 0.15 s apart from 16 spots to 16 desks; the peak of paint plus 68 per extra body pass.
function shower(styleOf, df) {
  const from = j => [21.5 + (j % 4), 3.5 + j * 0.6], to = j => [2.5 + (j % 8) * 2, 4.5 + Math.floor(j / 8) * 6]
  const longest = Math.max(...people.map((_, j) => TL.real(T.END, TpStyles.durs(styleOf(j), 20)))) + 15 * 0.15
  let peak = 0
  for (let t = 0; t <= longest; t += 1 / 15) {
    const agents = people.map((a, j) => pose(a, styleOf(j), t - 0.15 * j, { from: from(j), to: to(j), route: [from(j), to(j)] }))
    const f = frame(agents, { df })
    const cost = f.paint + f.extra * 68
    peak = Math.max(peak, cost)
    assert.deepEqual(f.bad, [])
  }
  return peak
}

test('a 16-person shower stays under 900 calls a frame, every style alone and mixed, by day and by night', () => {
  TpStyles.reset()
  for (const df of [1, 0.2]) {
    for (const id of IDS) {
      const peak = shower(() => id, df)
      assert.ok(peak <= 900, `${id} at df ${df}: ${peak}`)
    }
    // Every style in some mixed shower of 16, whatever the registry's length.
    for (let s = 0; s < IDS.length; s += 16) {
      const mixed = shower(j => IDS[(s + j) % IDS.length], df)
      assert.ok(mixed <= 900, `mixed from ${IDS[s]} at df ${df}: ${mixed}`)
    }
  }
})

// One teleport played through on a persistent tp while the print clock runs, until its marks have expired: each mark
// is born once and drawn without its agent within the same budget and context rules.
function marks(id, cfg) {
  const d = TpStyles.durs(id, 20), a = people[0], out = [], ttl = Math.max(...DRAW[id].marks.map(m => m.ttl))
  const end = TL.real(T.END, d), born = new Set()
  let shown = 0
  page.tpMarks = []
  a.tp = null // a fresh teleport: no mark bits left from the last test
  for (let u = 0; u <= end + ttl + 0.1; u += 1 / 30) {
    const mk = a.tp ? a.tp.mk : 0
    if (u < end) (pose(a, id, u), (a.tp.mk = mk))
    else (a.tp = null)
    page.printNow = u
    const f = frame([a], { ...cfg, keep: true }), at = `${id} marks u ${u.toFixed(3)} ${JSON.stringify(cfg)}`
    for (const b of f.bad) out.push(`${at}: ${b}`)
    if (f.paint > CAPS.normal) out.push(`${at}: ${f.paint} paint calls`)
    if (f.path > CAPS.path) out.push(`${at}: ${f.path} path ops`)
    for (const m of page.tpMarks) born.add(`${m.k}:${m.t0}`)
    if (!a.tp && f.paint) shown++
  }
  if (!cfg.reduced && !shown) out.push(`${id}: no mark drawn after its teleport`)
  if (!cfg.reduced && born.size !== DRAW[id].marks.length) out.push(`${id}: ${born.size} marks born`)
  if (page.tpMarks.length) out.push(`${id}: ${page.tpMarks.length} marks left after their ttl`)
  page.tpMarks = []
  page.printNow = 0
  return out
}

// Whatever the frame phase, a mark is drawn on its birth frame, even into an empty list, and its age there is the
// real time since its point, so the live end and the mark hand over without a gap.
test('lasting marks: drawn on the birth frame, aged from their exact point', () => {
  TpStyles.reset()
  const ids = IDS.filter(id => DRAW[id] && DRAW[id].marks && DRAW[id].marks.length), out = [], dt = 1 / 30
  for (const id of ids) {
    const S = DRAW[id], own = S.drawMark, d = TpStyles.durs(id, 20), a = people[0]
    const calls = new Map()
    S.drawMark = function (X, m, age) {
      calls.set(m, age)
      return own.call(this, X, m, age)
    }
    try {
      for (const off of [0, dt / 3, (2 * dt) / 3]) {
        page.tpMarks = []
        a.tp = null
        const seen = new Set()
        for (let u = off; u < TL.real(T.END, d); u += dt) {
          const mk = a.tp ? a.tp.mk : 0
          pose(a, id, u)
          a.tp.mk = mk
          page.printNow = u
          calls.clear()
          frame([a], { keep: true })
          for (const m of page.tpMarks) {
            if (seen.has(m)) continue
            seen.add(m)
            const at = S.marks[m.k].at, c = at === 'dep' ? TL.DEP : at === 'arr' ? TL.ARR : T.RELEASE
            const want = u - TL.real(c, d), tag = `${id} mark ${m.k} born at u ${u.toFixed(3)}`
            if (!calls.has(m)) out.push(`${tag}: not drawn on its birth frame`)
            else if (Math.abs(calls.get(m) - want) > 1e-9) out.push(`${tag}: age ${calls.get(m)}, want ${want}`)
          }
        }
      }
    } finally {
      S.drawMark = own
      page.tpMarks = []
      page.printNow = 0
    }
  }
  report(out)
})

test('lasting marks: born once, within budget and the context rules while they fade, then gone', () => {
  TpStyles.reset()
  const ids = IDS.filter(id => DRAW[id] && DRAW[id].marks && DRAW[id].marks.length), out = []
  assert.ok(ids.length > 0, 'some style leaves a mark')
  for (const id of ids) {
    for (const cfg of GRID) out.push(...marks(id, cfg))
    out.push(...marks(id, { ...GRID[0], k: 0.5 }))
    out.push(...marks(id, { ...GRID[0], reduced: true }))
  }
  report(out)
})
