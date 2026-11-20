// The magic teleport on the canvas (web/office-draw-teleport.js): the circles, columns, comet and the person turning
// white, drawn against canvases that only keep what they are told, and the lines that wire it into the page.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb, readWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
// A canvas context that takes any call and keeps it with the state it was made in; k is the transform's scale.
const view = { k: 1 }
const context = (log, state = {}) => new Proxy(Object.assign(state, { globalAlpha: 1, imageSmoothingEnabled: false, fillStyle: '', lineWidth: 1 }), {
  get: (s, k) => k in s ? s[k]
    : k === 'getTransform' ? () => ({ a: view.k })
    : k === 'createImageData' || k === 'getImageData' ? (...a) => ({ data: new Uint8ClampedArray(a.at(-2) * a.at(-1) * 4) })
    : /Gradient$/.test(k) ? () => ({ addColorStop() {} })
    : (...a) => { log.push({ op: k, a, fill: s.fillStyle, alpha: s.globalAlpha, smooth: s.imageSmoothingEnabled }) },
  set: (s, k, v) => ((s[k] = v), true),
})
const canvases = []
globalThis.document = {
  visibilityState: 'visible',
  createElement: () => {
    const cv = { width: 0, height: 0, log: [] }, ctx = context(cv.log)
    cv.getContext = () => ctx
    canvases.push(cv)
    return cv
  },
}
const S = loadWeb('office-scene')
const { ClaudeOffice } = loadWeb('office')
loadWeb('office-draw-xmas')
const D = loadWeb('office-draw-teleport')
const madeAtLoad = canvases.length
const { IslandScene } = loadWeb('island-scene')
const { TeleportLogic: TL } = loadWeb('teleport-logic')
const { TpStyles } = loadWeb('tp-styles')
TpStyles.setChoice('circle') // the circle's tests keep the circle
const { PA } = S

const ORIGIN = [21.5, 10.5], LAND = [3.5, 4.5]
let nextId = 1
// Someone mid-teleport at clock u from `from` to `to`.
function mover(u, { from = ORIGIN, to = LAND, cut = null, hide = false, id = nextId++ } = {}) {
  const sw = cut == null && u >= TL.T.SWITCH
  const [x, y] = sw ? to : from
  return {
    id, desk: 0, status: 'working', x, y, moving: false, seated: false, sleeping: false, stool: false, actNow: null,
    dirFront: true, parent: null, path: [to, [to[0] + 1, to[1]]],
    tp: { was: 'idle3', u, i: 0, x0: from[0], y0: from[1], x1: to[0], y1: to[1], hide, free: hide, stool: false, sw, cut },
  }
}
const isAtlas = cv => cv && (cv.width === 1176 || cv.width === 763)
const PAINT = new Set(['fillRect', 'fill', 'stroke', 'drawImage'])
// One frame's teleport items, sorted and run as the scene runs them.
function frame(agents, { df = 1, reduced = false, k = 1, run = true } = {}) {
  view.k = k
  const log = [], state = {}, ctx = context(log, state), items = []
  const G = { ctx, df, t: 3.2, th: { shadow: 'rgba(0,0,0,0.2)' }, poly() {}, rect() {} }
  ClaudeOffice.prototype.tpItems.call({ agents, env: { reduced } }, G, items)
  const zs = items.map(i => i.z)
  if (run) items.sort((a, b) => a.z - b.z).forEach(i => i.f())
  const ops = name => log.filter(c => c.op === name)
  return { log, state, items, zs, ops, paints: log.filter(c => PAINT.has(c.op)).length }
}
const near = (a, b) => Math.abs(a - b) < 1e-9

test('nothing is baked or drawn until a teleport is', () => {
  assert.equal(madeAtLoad, 0, 'loading the module made no canvas')
  const f = frame([{ ...mover(0.3), tp: null }])
  assert.equal(f.items.length, 0)
  assert.equal(canvases.length, 0)
})

test('the sprites are made once', () => {
  const W = 49, H = 26, f0 = D.sigilPixels(0)
  assert.equal(f0.length, W * H)
  // the rings mirror left to right; only the star's lines and the white points may lie over a mirrored ring pixel
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (f0[y * W + x] === 3) assert.ok([3, 6, 7].includes(f0[y * W + W - 1 - x]), `ring at ${x},${y} unmirrored`)
  assert.deepEqual(D.sigilPixels(24), f0, 'it loops')
  assert.notDeepEqual(D.sigilPixels(12), f0)
  const on = (r, x, y) => r.px[y * r.w + x] === 1
  const r0 = D.ringPixels(0)
  assert.deepEqual([r0.w, r0.h], [93, 48])
  assert.ok(on(r0, 70, 23) && on(r0, 46, 11) && on(r0, 68, 23), 'rx 24, ry 12, two pixels thick while young')
  assert.ok(![...Array(22).keys()].some(i => on(r0, 71 + i, 23)))
  const r3 = D.ringPixels(3)
  assert.ok(on(r3, 46 + 33, 23) && !on(r3, 46 + 31, 23), 'one pixel thick from frame 3')
  const r7 = D.ringPixels(7)
  assert.ok(on(r7, 92, 23) && on(r7, 46, 0))
  const r8 = D.ringPixels(8)
  assert.ok(on(r0, 46, 35) && r0.px[36 * 93 + 46] === 2, 'a dark row under the ring')
  assert.deepEqual([r8.w, r8.h], [19, 9])
  assert.ok(on(r8, 18, 4) && on(r8, 9, 0) && on(r8, 0, 4))
  const before = canvases.length
  frame([mover(0.6)])
  frame([mover(0.3)])
  const made = canvases.slice(before).filter(c => c.width !== 64)
  assert.equal(made.length, 2, 'the sigil and the ring atlas')
  assert.ok(made.every(isAtlas))
  assert.ok(made[0].log.length + made[1].log.length < 12000, 'baked in runs')
})

test('items sit at their depths', () => {
  for (const u of [0.1, 0.3, 0.45, 0.5, 0.6, 1.0]) {
    const f = frame([mover(u)], { run: false })
    assert.ok(f.zs.includes(-0.5), 'origin or landing floor at ' + u)
    const air = f.zs.some(z => near(z, ORIGIN[0] + ORIGIN[1] + 0.01))
    assert.equal(air, u >= 0.15 && u < 0.95, 'origin air (motes from 0.15) at ' + u)
    if (u >= 0.5) assert.ok(f.zs.some(z => near(z, LAND[0] + LAND[1] + 0.01)), 'landing air at ' + u)
    assert.equal(f.zs.includes(1e9), u >= 0.42 && u < 0.54, 'bolt at ' + u)
  }
  // the lounge rug is drawn at depth 19, so a circle on it goes just after it, before the pantry's wall band
  const rug = frame([mover(0.3, { from: [22.8, 6.0] })], { run: false })
  assert.ok(rug.zs.includes(19.05) && rug.zs.includes(-0.5), 'origin on the rug, landing on the floor')
  const queued = frame([mover(-0.3)], { run: false })
  assert.deepEqual(queued.zs, [-0.5], 'a queued person has only the dim circle')
})

test('calls per frame stay within budget', () => {
  let one = 0
  for (let u = 0; u <= 1.36; u += 0.01) one = Math.max(one, frame([mover(u)]).paints)
  assert.ok(one <= 45, `busiest single teleport ${one} calls`)
  let nine = 0
  for (let u = 0; u <= 2.6; u += 0.02) {
    const ids = Array.from({ length: 9 }, (_, j) => mover(u - 0.15 * j, { id: 50 + j }))
    nine = Math.max(nine, frame(ids).paints)
  }
  assert.ok(nine <= 400, `nine in a shower ${nine} calls`)
  const crowd = n => frame(Array.from({ length: n }, (_, j) => mover(0.6, { id: 80 + j, from: [21.5 + (j % 4), 10.5 + j / 4] })))
  const motes = f => f.ops('fillRect').filter(c => c.fill === '#c792ff' || (c.fill === '#ffd36e' && c.a[2] === 2 && c.a[3] === 1))
  assert.ok(motes(crowd(TL.LITE)).length > 0, 'motes and sparks up to LITE')
  assert.equal(motes(crowd(TL.LITE + 1)).length, 0, 'none above it')
})

test('the context is left as found', () => {
  for (const u of [-0.2, 0.05, 0.25, 0.35, 0.5, 0.6, 0.8, 1.2]) {
    const f = frame([mover(u)], { df: 0.5 })
    assert.deepEqual([f.state.globalAlpha, f.state.imageSmoothingEnabled, f.state.lineWidth], [1, false, 1], 'at ' + u)
    assert.equal(f.ops('save').length, f.ops('restore').length)
  }
  const lo = frame([mover(0.1), mover(0.6)], { k: 0.5 })
  const sprites = lo.ops('drawImage').filter(c => isAtlas(c.a[0]))
  assert.ok(sprites.length >= 3 && sprites.every(c => c.smooth), 'smoothed below 1x')
  assert.equal(lo.state.imageSmoothingEnabled, false)
  const hi = frame([mover(0.1), mover(0.6)])
  assert.ok(hi.ops('drawImage').filter(c => isAtlas(c.a[0])).every(c => !c.smooth), 'crisp at 1x and above')
})

// A page whose drawPerson keeps who it drew and paints a body 8 px wide, 20 tall, standing on the feet.
function person(u, { reduced = false, cut = null } = {}) {
  const log = [], state = {}, ctx = context(log, state), calls = []
  const G = {
    ctx, df: 1, t: 0, th: { shadow: '#000' }, poly() {},
    rect: (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h) },
  }
  const a = mover(u, { cut })
  const page = {
    env: { reduced },
    tpPerson: ClaudeOffice.prototype.tpPerson,
    drawPerson(G2, b) {
      if (b.tp && this.tpPerson(G2, b)) return
      calls.push({ G: G2, alpha: ctx.globalAlpha })
      const [sx, sy] = PA(b.x, b.y).map(Math.round)
      G2.rect(sx - 4, sy - 20, 8, 20, '#3e8ed0')
    },
  }
  page.drawPerson(G, a)
  const [fx, fy] = PA(a.x, a.y).map(Math.round)
  return { calls, log, state, G, fx, fy, white: calls.filter(c => c.G !== G) }
}

test('the person turns white, thins into the light and comes back', () => {
  assert.equal(person(0.05).calls.length, 1)
  const two = person(0.2)
  assert.equal(two.calls.length, 2)
  assert.equal(two.calls[0].G, two.G)
  assert.notEqual(two.calls[1].G, two.G, 'the second pass is white')
  const wide = two.log.at(-1)
  assert.equal(wide.fill, '#e9fdff')
  assert.ok(near(wide.alpha, (0.2 - 0.1) / 0.16), 'at the white amount')
  const thin = person(0.35)
  assert.equal(thin.calls.length, 1)
  assert.equal(thin.white.length, 1, 'only the white figure while squeezed')
  const lift = Math.round(28 * ((0.35 - 0.26) / 0.16) ** 2)
  for (const c of thin.log.filter(c => c.op === 'fillRect')) {
    const [x, y, w, h] = c.a
    assert.ok([x, y, w, h].every(Number.isInteger) && w >= 1, 'whole pixels')
    assert.ok(Math.abs(y + h - (thin.fy - lift)) <= 1, 'lifted above the feet')
    assert.ok(w < wide.a[2], 'narrower than before')
    assert.equal(x, thin.fx - 3, 'squeezed toward the feet')
    assert.equal(c.alpha, 1)
  }
  assert.ok(lift > 0)
  assert.equal(person(0.45).calls.length, 0, 'gone')
  assert.equal(person(0.63).white.length, 1, 'coming down the column')
  assert.equal(person(0.9).calls.length, 1)
  for (const u of [0.05, 0.2, 0.35, 0.45, 0.63, 0.75]) assert.equal(person(u).state.globalAlpha, 1)
})

test('reduced motion: still circles, a plain fade', () => {
  const f = frame([mover(0.3), mover(0.6)], { reduced: true })
  assert.equal(f.ops('clip').length, 0)
  assert.equal(f.ops('fillRect').length, 0, 'no quill, column, rings, motes or comet')
  assert.ok(f.ops('drawImage').length > 0)
  assert.ok(!f.zs.includes(1e9))
  const p = person(0.25, { reduced: true })
  assert.equal(p.calls.length, 1)
  assert.equal(p.white.length, 0)
  assert.ok(near(p.calls[0].alpha, 0.5), 'half faded')
  assert.equal(person(0.45, { reduced: true }).calls.length, 0)
})

test('origins behind the walls draw nothing at the origin', () => {
  const f = frame([mover(0.3, { from: [-1.5, 3] })], { run: false })
  assert.ok(!f.zs.some(z => near(z, -1.5 + 3 + 0.01)))
  assert.deepEqual(f.zs.filter(z => z === -0.5).length, 1, 'only the landing circle')
})

test('crowded origins share one glow pool; kitchen spots get a small one', () => {
  const glows = f => f.ops('drawImage').filter(c => c.a[0].width === 64)
  const a = mover(0.2, { from: [22.1, 3.95], id: 201 }), b = mover(0.1, { from: [22.9, 3.95], id: 202 })
  const f = frame([a, b], { df: 0 })
  const g = glows(f)
  assert.equal(g.length, 1, 'the later one skips its pool')
  const [cx] = PA(22.1, 3.95).map(Math.round)
  assert.equal(g[0].a[1] + 36, cx, 'the earlier one keeps it')
  const kitchen = glows(frame([mover(0.1, { from: [21.7, 1.0] })], { df: 0 }))
  assert.deepEqual(kitchen.map(c => c.a.slice(3)), [[44, 22]])
})

test('a circle on the lawn by the plinth stays off its face', () => {
  // a front-row visitor's landing on the lawn half a tile in front of the office
  const front = frame([mover(0.6, { to: [11.5, 14.5] })])
  const clips = front.ops('clip')
  assert.equal(clips.length, 1, 'clipped to the lawn in front of the face')
  const at = front.log.findIndex(c => c.op === 'clip'), [m, l] = front.log.slice(at - 5, at - 3)
  const [cx, cy] = PA(11.5, 14.5).map(Math.round), mid = (m.a[1] + l.a[1]) / 2
  assert.deepEqual([m.op, l.op, (m.a[0] + l.a[0]) / 2], ['moveTo', 'lineTo', cx])
  assert.ok(mid > cy - 12 && mid < cy, 'the cut runs through the back half of the circle')
  assert.equal(frame([mover(0.6)]).ops('clip').length, 0, 'not inside the office')
  assert.equal(frame([mover(0.6, { to: [11.5, 18.5] })]).ops('clip').length, 0, 'nor out on the open lawn')
  assert.equal(front.ops('save').length, front.ops('restore').length)
})

test('a world island draws a teleport', () => {
  const sc = Object.create(IslandScene.prototype)
  Object.assign(sc, { host: { env: {} }, agents: [mover(0.5), mover(0.3)] })
  const log = [], items = []
  sc.tpItems({ ctx: context(log), df: 1, t: 0, th: { shadow: '#000' } }, items)
  assert.ok(items.length >= 4)
  for (const it of items) it.f()
  assert.ok(log.length > 0)
})

test('wired into the page, the world view and the bubbles', () => {
  const scene = readWeb('island-scene')
  assert.match(scene, /^import '\.\/office-draw-teleport\.js';$/m)
  assert.match(scene, /'fateItems',\n {2}'tpItems',\n {2}'tpPerson',/)
  assert.match(readWeb('office-draw'), /this\.fateItems\(G, items\);\n\s*this\.tpItems\(G, items\);/)
  assert.match(
    readWeb('office-draw-people'),
    /drawPerson\(G, a\) \{\n\s*const \{[^}]*\} = G,\n\s*o = outfitOf\(a, G\.ev\);\n\s*if \(a\.tp && this\.tpPerson\(G, a\)\) return;/,
  )
  assert.match(readWeb('office-draw-fate'), /const who = \{[^\n]*\};\n\s*who\.tp = null;/)
  const office = readWeb('office')
  assert.match(office, /^import \{ TeleportLogic \} from '\.\/teleport-logic\.js';$/m)
  assert.match(office, /el\.style\.visibility = TeleportLogic\.unseen\(a\.tp\) \? 'hidden' : '';/)
  const main = readWeb('main')
  assert.match(main, /'\.\/restroom-logic\.js';\nimport '\.\/teleport-logic\.js';/)
  assert.match(main, /'\.\/office-draw-idle-xmas\.js';\nimport '\.\/office-draw-teleport\.js';/)
})

test('a fate figure carries no teleport', () => {
  const page = Object.create(ClaudeOffice.prototype)
  const a = { ...mover(0.3), fate: 'lightning' }
  ClaudeOffice.prototype.startFate.call(page, a)
  assert.equal(page.fates.at(-1).who.tp, null)
})

test('the speech bubble hides while the person is white or gone', () => {
  const a = mover(0.3), b = mover(1.0), el = { style: {} }, el2 = { style: {} }
  const page = Object.assign(Object.create(ClaudeOffice.prototype), {
    agents: [a, b], state: { paused: true, speed: 1 }, world: null, last: 1000, bubbleEls: { [a.id]: el, [b.id]: el2 },
    draw() {}, drawSky() {}, envNow: () => ({}), doneSweep() {}, stepDogs() {}, stepCritters() {}, stepProps() {},
    headPos: () => [100, 100],
  })
  ClaudeOffice.prototype.frame.call(page, 1016)
  assert.equal(el.style.visibility, 'hidden')
  assert.equal(el2.style.visibility, '')
  // a queued person's bubble hides too, so a return shower's bubbles do not cover the circles
  const c = mover(-0.6),
    el3 = { style: {} }
  Object.assign(page, { agents: [c], bubbleEls: { [c.id]: el3 } })
  ClaudeOffice.prototype.frame.call(page, 1032)
  assert.equal(el3.style.visibility, 'hidden')
})

test('every part of the effect is painted', () => {
  const sigil = c => c.op === 'drawImage' && c.a[0].width === 1176
  const ringAt = (c, sx) => c.op === 'drawImage' && c.a[0].width === 763 && c.a[1] === sx
  const rect = (f, fill, w, h) =>
    f.ops('fillRect').some(c => c.fill === fill && (w == null || c.a[2] === w) && (h == null || c.a[3] === h))
  assert.ok(frame([mover(-0.3)]).log.some(c => sigil(c) && near(c.alpha, 0.35)), 'dim queued circle')
  const s = frame([mover(0.1)])
  assert.equal(s.ops('clip').length, 1, 'sweep clip')
  assert.ok(rect(s, '#ffffff', 3, 3), 'quill')
  const f = frame([mover(0.25)])
  assert.ok(f.log.some(c => ringAt(c, 0)), 'ignition flash')
  const wave = c => c.op === 'drawImage' && c.a[0].width === 763 && c.a[1] > 0 && c.a[1] < 8 * 93 && c.a[1] % 93 === 0
  assert.ok(f.log.some(wave), 'shockwave')
  const col = frame([mover(0.3)])
  assert.ok(col.ops('fillRect').some(c => c.fill === '#ffffff' && c.a[3] >= 40), 'pillar core')
  assert.ok(rect(col, '#5ef2ff', 15) && rect(col, '#1f9fbf'), 'pillar halo and day rim')
  assert.ok(frame([mover(0.32)]).log.some(c => ringAt(c, 8 * 93)), 'column rings')
  const b = frame([mover(0.48)])
  assert.equal(b.ops('stroke').length, 2, 'comet streak')
  assert.ok(b.ops('drawImage').some(c => c.a[0].width === 64 && c.a[3] === 31), 'comet head')
  const land = frame([mover(0.6)], { df: 0 })
  assert.ok(land.ops('drawImage').filter(c => c.a[0].width === 64).length >= 2, 'landing glow pool too')
  assert.ok(rect(land, '#ffd36e', 2, 1) && rect(land, '#c792ff'), 'burst and motes')
  assert.ok(rect(land, '#e9fdff', 19), 'foot flare')
  // the circle turns
  const sx = u => frame([mover(u, { id: 5 })]).log.filter(sigil).map(c => c.a[1])
  assert.notDeepEqual(sx(0.3), sx(0.7))
})

test('a 16-person shower draws every circle; only bright, uncut ones count toward LITE', () => {
  const sixteen = Array.from({ length: 16 }, (_, j) => mover(0.1, { id: 300 + j, from: [21.5 + (j % 4), 6 + j] }))
  assert.equal(frame(sixteen, { run: false }).zs.filter(z => z === -0.5 || z === 19.05).length, 16)
  const crowd = [mover(0.6, { id: 400 })].concat(
    Array.from({ length: 10 }, (_, j) => mover(-0.5, { id: 401 + j })),
    Array.from({ length: 10 }, (_, j) => mover(0.5, { id: 420 + j, cut: 0.3 })),
  )
  assert.ok(frame(crowd).ops('fillRect').some(c => c.fill === '#c792ff'), 'motes still drawn')
})

test('glow pools: only a live, earlier, close origin takes one over; landings by the rug and the kitchen', () => {
  const pools = (f, at) =>
    f.ops('drawImage').filter(c => c.a[0].width === 64 && c.a[1] === PA(...at).map(Math.round)[0] - 36)
  const P = [10.5, 6.5],
    Q = [11.3, 6.5]
  const late = (over, q = Q) =>
    pools(frame([mover(0.1, { from: P, id: 501 }), mover(0.2, { from: q, id: 500, ...over })]), P)
  assert.equal(late({}).length, 0, 'an earlier live origin takes it over')
  assert.equal(late({ hide: true }).length, 1, 'not a stall user')
  assert.equal(late({ u: 0.3, cut: 0.25 }).length, 1, 'not a cut one')
  assert.equal(pools(frame([mover(0.1, { from: P, id: 501 }), mover(0.9, { from: Q, id: 500 })]), P).length, 1)
  assert.equal(late({}, [11.9, 6.5]).length, 0, '1.4 tiles apart')
  assert.equal(late({}, [12.1, 6.5]).length, 1, '1.6 tiles apart')
  const tie = frame([mover(0.1, { from: P, id: 601 }), mover(0.1, { from: Q, id: 600 })])
  assert.deepEqual([pools(tie, P).length, pools(tie, Q).length], [0, 1], 'a tie goes to the lower id')
  // the rug pad reaches a circle whose edge is under the rug; a kitchen landing gets the small pool
  assert.ok(frame([mover(0.6, { to: [21.8, 6.0] })], { run: false }).zs.includes(19.05))
  const k = frame([mover(0.6, { to: [21.7, 1.0] })], { df: 0 }).ops('drawImage')
  assert.deepEqual(
    k.filter(c => c.a[0].width === 64 && c.a[3] < 73).map(c => c.a.slice(3)),
    [[44, 22]],
  )
})

test('the plinth clip: front and east faces, origins too, and only on the lawn just in front', () => {
  // at u 0.5 neither circle is still being inscribed, so every clip is a plinth clip
  const clips = over => frame([mover(0.5, over)]).ops('clip').length
  assert.equal(clips({ from: [11.5, 14.5] }), 1, 'an origin on the front lawn')
  assert.equal(clips({ to: [27.5, 10.5] }), 1, 'a landing on the east lawn')
  assert.equal(clips({ to: [11.5, 15.5] }), 0, 'a tile and a half out')
  assert.equal(clips({ to: [27.5, 3.5] }), 0, 'the raised restroom floor')
  const east = frame([mover(0.6, { to: [27.5, 10.5] })]),
    at = east.log.findIndex(c => c.op === 'clip'),
    [m, l] = east.log.slice(at - 5, at - 3),
    [cx, cy] = PA(27.5, 10.5).map(Math.round)
  assert.ok(m.a[1] > l.a[1], 'the east face runs up to the right')
  assert.ok((m.a[1] + l.a[1]) / 2 > cy - 12 && (m.a[1] + l.a[1]) / 2 < cy, `${m.a[1]} ${l.a[1]} ${cy}`)
  assert.equal((m.a[0] + l.a[0]) / 2, cx)
})

test('no idle Z beside the column while a cut rewinds to idle', () => {
  loadWeb('office-agents')
  const p = Object.assign(Object.create(ClaudeOffice.prototype), {
    agents: [],
    state: { speed: 1, paused: false, sel: null },
    env: {},
    seq: 0,
    depts: new Map(),
  })
  const a = Object.assign(p.addAgent({}), mover(0.37, { cut: 0.33 }), { status: 'idle' })
  const zs = tp => {
    const log = [],
      ctx = context(log),
      rect = (x, y, w, h, c) => {
        ctx.fillStyle = c
        ctx.fillRect(Math.round(x), Math.round(y), w, h)
      }
    a.tp = tp
    p.drawPerson({ ctx, poly() {}, box() {}, rect, th: S.THEMES.day, t: 1.3, df: 1, ev: null, cold: false }, a)
    return log.filter(c => c.op === 'fillRect' && c.fill === '#e6e9ef' && c.a[2] === 1 && c.a[3] === 1).length
  }
  assert.ok(zs(null) > 0, 'idle and no teleport: the Z')
  for (const u of [0.37, 0.45, 0.5]) assert.equal(zs({ ...mover(u, { cut: 0.33 }).tp, u }), 0, `rewinding at ${u}`)
})

// ---- the dispatcher: styles, kinds, marks, the person ----

const { DRAW } = loadWeb('tp-style-index')
const P_ = loadWeb('tp-person').TpPerson
const ROUTE = [ORIGIN, [12.5, 10.5], [3.5, 10.5], LAND]
// Someone mid-teleport in style `id` at core time c.
function styled(id, c, over = {}) {
  const prof = TpStyles.BY_ID[id],
    route = prof.kind === 'ground' ? ROUTE.map(p => [...p]) : null,
    d = TpStyles.durs(id, 20),
    swAt = d[1] > 0.12 ? TL.DEP : TL.T.SWITCH,
    a = mover(0, over)
  const sw = over.cut == null && c >= swAt
  Object.assign(a.tp, { u: c < 0 ? c : TL.real(c, d), style: id, d, swAt, len: 20, route, mk: 0, sw })
  if (sw) [a.x, a.y] = [a.tp.x1, a.tp.y1]
  return a
}
// Swaps a draw object into the index for one test.
function withStyle(id, S, fn) {
  const was = DRAW[id]
  DRAW[id] = S
  try {
    return fn()
  } finally {
    DRAW[id] = was
  }
}
const recorder = (log, over = {}) => ({
  back: (X, end) => log.push(['back', end]),
  floor: (X, end) => log.push(['floor', end]),
  stand: (X, end) => log.push(['stand', end]),
  trip: X => log.push(['trip', X.L.trip]),
  person: X => X.L.sw && X.L.trip >= 0,
  marks: [],
  ...over,
})

test('a style without a draw object draws the circle on its own clock', () => {
  withStyle('dashrun', null, () => {
    for (const c of [0.1, 0.3, 0.48, 0.6, 1.0]) {
      const s = frame([styled('dashrun', c, { id: 7 })]),
        o = frame([mover(c, { id: 7 })])
      assert.deepEqual(s.zs, o.zs, `items at core ${c}`)
      assert.equal(s.paints, o.paints, `calls at core ${c}`)
    }
  })
  const plain = mover(0.3)
  delete plain.tp.style
  assert.ok(frame([plain]).items.length > 0, 'no style: the circle')
})

test('calm draws every style as the circle, calm', () => {
  TpStyles.useCalm(() => true)
  try {
    const log = []
    withStyle('dashrun', recorder(log), () => {
      const f = frame([styled('dashrun', 0.48), styled('cutpaste', 0.6)])
      assert.equal(log.length, 0, 'the style is not asked')
      assert.equal(f.ops('clip').length, 0)
      assert.equal(f.ops('fillRect').length, 0, 'the calm circle only stamps its sprite')
      assert.ok(!f.zs.includes(1e9))
    })
  } finally {
    TpStyles.reset()
    TpStyles.setChoice('circle')
  }
})

test('items sit at their depth per kind', () => {
  const log = []
  // ground: back below and stand above the walker at each end, the trip on its route tile
  withStyle('dashrun', recorder(log), () => {
    const a = styled('dashrun', 0.48),
      f = frame([a], { run: false })
    const [x0, y0] = ORIGIN, [x1, y1] = LAND
    for (const z of [x0 + y0 - 0.01, x0 + y0 + 0.01, x1 + y1 - 0.01, x1 + y1 + 0.01]) assert.ok(f.zs.some(v => near(v, z)), `${z}`)
    assert.equal(f.zs.filter(z => z === -0.5).length, 2, 'a floor item at each end')
    const trip = f.zs.find(z => z > 1 && ![x0 + y0, x1 + y1].some(e => Math.abs(z - e) < 0.02))
    // half way along the route by length: on the leg from (12.5, 10.5) to (3.5, 10.5)
    assert.ok(trip > 14 && trip < 23.1, `trip at ${trip}`)
    assert.ok(!f.zs.includes(1e9))
  })
  // air: no ground() is the overlay; low over the ground sorts at the ground point; high is the overlay by depth
  const air = h => recorder(log, { ground: (X, out) => ((out[0] = 9), (out[1] = 9), (out[2] = h), true) })
  withStyle('cutpaste', recorder(log), () => assert.ok(frame([styled('cutpaste', 0.5)], { run: false }).zs.includes(1e9)))
  withStyle('cutpaste', air(10), () => {
    const zs = frame([styled('cutpaste', 0.5)], { run: false }).zs
    assert.ok(zs.some(z => near(z, 18.01)), 'low: at the ground point')
    assert.ok(zs.includes(-0.5) && zs.filter(z => z === -0.5).length === 3, 'and a shadow on the floor')
  })
  withStyle('cutpaste', air(80), () => {
    const zs = frame([styled('cutpaste', 0.5)], { run: false }).zs
    assert.ok(zs.some(z => near(z, 1e9 + 18 / 1e3)), 'high: the overlay, sorted by ground depth')
  })
  // none: never a trip item
  withStyle('pipe', recorder(log, { need: () => 0xff }), () => {
    const zs = frame([styled('pipe', 0.5)], { run: false }).zs
    assert.ok(zs.length > 0 && zs.every(z => z < 100), 'no trip')
  })
})

test('a stretch over the lounge rug gets one item just over the rug, only when asked for and drawn', () => {
  const RUG = loadWeb('tp-kit').Kit.RUG_Z
  assert.ok(RUG > 19 && RUG < 19.5, 'over the rug item, under anything standing on it')
  const zs = S => {
    const log = []
    return withStyle('gitbranch', recorder(log, S(log)), () => [frame([styled('gitbranch', 0.48)]).zs, log])
  }
  const [on, log] = zs(log => ({ need: () => 8 | 256, rug: X => log.push(['rug', X.L.trip]) }))
  assert.equal(on.filter(z => z === RUG).length, 1)
  assert.deepEqual(log.filter(e => e[0] === 'rug').length, 1, 'and it draws')
  assert.equal(zs(() => ({ need: () => 8 })).flat().filter(z => z === RUG).length, 0, 'not asked for')
  assert.equal(zs(() => ({ need: () => 8 | 256 }))[0].filter(z => z === RUG).length, 0, 'no rug hook')
})

test('a style can draw just over the landing desk, under anyone in front of it', () => {
  const a = styled('packet', 0.7), want = S.DESKS[a.desk].gx + S.DESKS[a.desk].gy + 1.51
  const run = (need, over = {}) => {
    const log = []
    const f = withStyle('packet', recorder(log, { need: () => need, desk: X => log.push(['desk', X.L.v]), ...over }),
      () => frame([a]))
    return [f.zs.filter(z => near(z, want)).length, log.filter(e => e[0] === 'desk').length]
  }
  assert.equal(D.TP_PART.DESK, 512)
  assert.deepEqual(run(8 | 512), [1, 1])
  assert.deepEqual(run(8), [0, 0], 'not asked for')
  assert.deepEqual(run(8 | 512, { desk: undefined }), [0, 0], 'no desk hook')
})

test('a hidden starter has no origin items; its route starts off the restroom floor', () => {
  const log = []
  withStyle('dashrun', recorder(log, { trip: X => log.push(X.route(0, [])) }), () => {
    const a = styled('dashrun', 0.48, { hide: true })
    a.tp.route = [[29.5, 1.6], [28.5, 3.5], [27.5, 5.5], [26.5, 6.5], ...ROUTE.slice(1)]
    const f = frame([a])
    assert.ok(!f.zs.some(z => near(z, ORIGIN[0] + ORIGIN[1] - 0.01) || near(z, ORIGIN[0] + ORIGIN[1] + 0.01)))
    const [, , tx, ty] = log.find(e => typeof e[0] === 'number')
    assert.deepEqual([tx, ty], [26.5, 6.5], 'the first point off the restroom floor')
  })
})

test('a hidden air start leaves from the first point off the restroom floor, not the stall', () => {
  const log = [], { RestroomLogic } = loadWeb('restroom-logic')
  const out = X => log.push({ arc: X.arc(0, 40), tx0: X.tx0, ty0: X.ty0, chord: X.route(0.5, []), dir: [...X.dir0] })
  withStyle('upload', recorder(log, { trip: out }), () => {
    const a = styled('upload', 0.48, { hide: true, from: [29.5, 1.6] })
    a.tp.route = [[29.5, 1.6], [28.5, 3.5], [27.5, 5.5], [26.5, 6.5], ...ROUTE.slice(1)]
    frame([a])
    const got = log.find(e => e.arc)
    assert.ok(RestroomLogic.onFloor(S.WC, 29.5, 1.6), 'from a stall')
    assert.ok(!RestroomLogic.onFloor(S.WC, got.tx0, got.ty0), `origin ${got.tx0},${got.ty0} off the restroom floor`)
    assert.deepEqual([got.tx0, got.ty0], [26.5, 6.5])
    assert.deepEqual(got.arc, PA(26.5, 6.5).map(Math.round), 'the arc starts there')
    assert.deepEqual(got.chord.slice(2, 4), [(26.5 + LAND[0]) / 2, (6.5 + LAND[1]) / 2], 'an air route: the chord from there')
    assert.ok(got.dir[0] < 0, 'heading west along the chord')
  })
})

test('X.lite counts bright teleports, cut and queued ones left out', () => {
  const seen = []
  withStyle('dashrun', recorder([], { trip: X => seen.push(X.lite) }), () => {
    const crowd = n => Array.from({ length: n }, (_, j) => styled('dashrun', 0.48, { id: 900 + j }))
    frame(crowd(TL.LITE))
    assert.ok(seen.length && seen.every(l => l === false))
    seen.length = 0
    frame(crowd(TL.LITE + 1))
    assert.ok(seen.every(l => l === true))
    seen.length = 0
    frame(crowd(TL.LITE).concat([styled('dashrun', -0.3, { id: 990 }), styled('dashrun', 0.3, { id: 991, cut: 0.1 })]))
    assert.ok(seen.every(l => l === false))
  })
})

test('lasting marks: born once, aged on printNow, capped, drawn without the agent, then dropped', () => {
  const got = []
  const S = recorder([], {
    marks: [
      { at: 'dep', end: 0, ttl: 3, layer: 'floor' },
      { at: 'arr', end: 1, ttl: 2, layer: 'stand' },
    ],
    drawMark: (X, m, age) => got.push([m.k, age, X.a, X.tp]),
  })
  withStyle('gitbranch', S, () => {
    const scene = { agents: [], env: {}, printNow: 10 }
    const run = () => {
      const items = [],
        ctx = context([]),
        G = { ctx, df: 1, t: 0, th: { shadow: '#000' }, poly() {}, rect() {} }
      ClaudeOffice.prototype.tpItems.call(scene, G, items)
      items.sort((p, q) => p.z - q.z).forEach(i => i.f())
      return items
    }
    const a = styled('gitbranch', 0.3, { id: 77 })
    scene.agents = [a]
    run()
    assert.equal(scene.tpMarks, undefined, 'nothing before departure ends')
    a.tp.u = TL.real(0.45, a.tp.d)
    run()
    run()
    assert.equal(scene.tpMarks.length, 1, 'the origin mark, once')
    assert.deepEqual([scene.tpMarks[0].x, scene.tpMarks[0].y, scene.tpMarks[0].t0], [...ORIGIN, 10])
    a.tp.u = TL.real(0.7, a.tp.d)
    run()
    assert.equal(scene.tpMarks.length, 2)
    // cut or calm: none born
    const b = styled('gitbranch', 0.7, { id: 78, cut: 0.2 })
    scene.agents = [b]
    run()
    assert.equal(scene.tpMarks.length, 2, 'not in a cut')
    // the agent has gone: still drawn, a and tp null; aged on printNow; dropped at ttl
    scene.agents = []
    got.length = 0
    scene.printNow = 11.5
    const items = run()
    assert.deepEqual(got.map(g => [g[0], g[1], g[2], g[3]]).sort(), [[0, 1.5, null, null], [1, 1.5, null, null]])
    assert.ok(items.some(i => i.z === -0.5) && items.some(i => near(i.z, LAND[0] + LAND[1] + 0.01)))
    // under reduced motion they keep fading but draw nothing
    scene.env = { reduced: true }
    assert.equal(run().length, 0)
    assert.equal(scene.tpMarks.length, 2)
    scene.env = {}
    // dropped on the instant its ttl is up
    scene.printNow = 12
    run()
    assert.deepEqual(scene.tpMarks.map(m => m.k), [0])
    scene.printNow = 12.5
    run()
    assert.deepEqual(scene.tpMarks.map(m => m.k), [0], 'the 2 s one is gone')
    scene.printNow = 13.5
    assert.equal(run().length, 0)
    assert.equal(scene.tpMarks.length, 0)
    // capped at 32, oldest first; each scene keeps its own list
    for (let j = 0; j < 40; j++) {
      scene.agents = [styled('gitbranch', 0.45, { id: 1000 + j })]
      run()
    }
    assert.equal(scene.tpMarks.length, 32)
    assert.equal(scene.tpMarks[0].seed, 1008)
    const other = { agents: [], env: {} }
    ClaudeOffice.prototype.tpItems.call(other, { ctx: context([]), df: 1 }, [])
    assert.equal(other.tpMarks, undefined)
  })
})

test('tpPerson: the style decides; true at the spot while the body travels', () => {
  withStyle('dashrun', recorder([]), () => {
    const page = { env: {}, agents: [], tpPerson: ClaudeOffice.prototype.tpPerson, drawPerson() {} }
    const G = { ctx: context([]), df: 1, t: 0, th: {}, poly() {}, rect() {} }
    assert.equal(page.tpPerson(G, styled('dashrun', 0.48)), true, 'travelling')
    assert.equal(page.tpPerson(G, styled('dashrun', 0.7)), false, 'arrived')
  })
  // the person hook sees the frame's snow, as the other hooks do
  const { SnowLogic } = loadWeb('snow-logic'), snow = []
  withStyle('dashrun', recorder([], { person: X => (snow.push(X.snow), false) }), () => {
    const page = { env: {}, agents: [], snowShown: 3, tpPerson: ClaudeOffice.prototype.tpPerson }
    page.tpPerson({ ctx: context([]), df: 1, t: 0, th: {}, poly() {}, rect() {} }, styled('dashrun', 0.48))
  })
  assert.ok(SnowLogic.depth(3) > 0)
  assert.deepEqual(snow, [SnowLogic.depth(3)])
})

// A real page and agent for the body passes.
function realPage() {
  loadWeb('office-agents')
  const p = Object.assign(Object.create(ClaudeOffice.prototype), {
    agents: [], state: { speed: 1, paused: false, sel: null }, env: {}, seq: 0, depts: new Map(),
  })
  const a = Object.assign(p.addAgent({}), { status: 'done', x: 10.5, y: 6.5, moving: false, seated: false, tp: null })
  const log = [],
    ctx = context(log),
    rect = (x, y, w, h, c) => ((ctx.fillStyle = c), ctx.fillRect(Math.round(x), Math.round(y), w, h)),
    G = { ctx, poly() {}, box() {}, rect, th: { ...S.THEMES.day, stroke: '#33415c' }, t: 1.3, df: 1, ev: null, cold: false }
  return { p, a, log, G }
}

test('the body pass: armsUp and bare, fields restored after a throw, no stroke in the remap', () => {
  const { p, a, log, G } = realPage()
  const X = { page: p, a, G, ctx: G.ctx }
  P_.body(X, { pose: 'stand', bare: false })
  const done = log.length
  log.length = 0
  P_.body(X, { pose: 'up' })
  const bare = log.length
  assert.ok(bare < done, `no done icon over a bare body (${bare} < ${done})`)
  const before = JSON.stringify(a)
  const thrower = { ...X, page: { drawPerson: () => { throw new Error('boom') } } }
  assert.throws(() => P_.body(thrower, { pose: 'walk', front: false, status: 'thinking' }))
  assert.equal(JSON.stringify(a), before, 'fields restored')
  assert.equal(P_.isBusy(), false)
  log.length = 0
  P_.body(X, { tint: '#ffffff', sx: 0.5 })
  assert.equal(log.filter(c => c.op === 'strokeRect').length, 0, 'no unmapped blueprint outline')
  assert.ok(log.filter(c => c.op === 'fillRect').every(c => c.fill === '#ffffff'))
  // capture records instead of painting
  log.length = 0
  const cap = P_.capture(X, { mirror: true }, P_.newCapture())
  assert.equal(log.filter(c => c.op === 'fillRect').length, 0)
  assert.ok(cap.n > 20 && cap.n <= P_.MAXCAP && cap.cols.length > 3)
})
