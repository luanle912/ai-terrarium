// The Christmas landmark on the page: how the bake hangs its two sprites on the island (web/sky-island.js renderProps)
// and what a frame draws over them (web/office-draw-cathedral.js), against canvases that only keep what they are told.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
// A canvas context that takes any call and keeps it with the state it was made in.
const context = (log, state = {}) => new Proxy(Object.assign(state, { globalAlpha: 1, imageSmoothingEnabled: false, fillStyle: '' }), {
  get: (s, k) => k in s ? s[k]
    : k === 'createImageData' || k === 'getImageData' ? (...a) => ({ data: new Uint8ClampedArray(a.at(-2) * a.at(-1) * 4) })
    : /Gradient$/.test(k) ? () => ({ addColorStop() {} })
    : (...a) => { log.push({ op: k, a, fill: s.fillStyle, alpha: s.globalAlpha, smooth: s.imageSmoothingEnabled }) },
  set: (s, k, v) => ((s[k] = v), true),
})
const canvases = []
globalThis.document = {
  createElement: () => {
    const cv = { width: 0, height: 0, log: [] }, ctx = context(cv.log)
    cv.getContext = () => ctx
    canvases.push(cv)
    return cv
  },
}
const { EventLogic } = loadWeb('event-logic')
const S = loadWeb('office-scene')
const { SkyRender } = loadWeb('sky-render')
const { hex } = loadWeb('sky-island')
const { SnowLogic } = loadWeb('snow-logic')
const { EventLandmark } = loadWeb('event-landmark')
const A = loadWeb('island-art-cathedral')
const Y = loadWeb('island-art-cathedral-yard')
const X = loadWeb('office-draw-xmas')
const { ClaudeOffice } = loadWeb('office')
// the bulb strings laid out from here on: loading the page must not lay out the cathedral's
let laid = 0
const lightString = EventLogic.lightString
EventLogic.lightString = (...a) => (laid++, lightString(...a))
loadWeb('office-draw-cathedral')
const laidAtLoad = laid

const { SITE } = EventLandmark, { ISLAND, W, H, PG } = S
const corner = (tile, ext) => { const [x, y] = PG(tile[0] + 0.5, tile[1] + 0.5, 0); return [Math.round(x) - ext[0], Math.round(y) - ext[1]] }
const [CX, CY] = corner(SITE.at, A.CATHEDRAL_EXT), [LX, LY] = corner(SITE.lady, Y.LADY_EXT)

// One frame's landmark items run in the scene's order, the two baked sprites among them at their own depths.
function frame(ev, df, { reduced = false, t = 12.3 } = {}) {
  const log = [], state = {}, ctx = context(log, state), items = [], made = canvases.length
  ClaudeOffice.prototype.cathedralItems.call({ env: { reduced } }, { ctx, t, df }, items, ev)
  const own = items.length
  items.push({ z: SITE.z, f: () => log.push({ op: 'cathedral' }) }, { z: SITE.ladyZ, f: () => log.push({ op: 'statue' }) })
  items.sort((a, b) => a.z - b.z).forEach(i => i.f())
  const ops = name => log.filter(c => c.op === name)
  return {
    log, own, state, made: canvases.length - made,
    rects: ops('fillRect'), images: ops('drawImage'),
    // a bulb is the only 2 px square a frame draws
    bulbs: ops('fillRect').filter(c => c.a[2] === 2 && c.a[3] === 2),
    star: ops('fillRect').filter(c => c.fill === '#ffe27a'),
    at: name => log.findIndex(c => c.op === name),
  }
}
const DAY = 1, NIGHT = 0, level = (n, eve = false) => ({ key: 'christmas', level: n, eve, day: false })
const xy = c => c.a.slice(0, 2)

test('nothing of the building is worked out until a frame first lights it', () => {
  assert.equal(laidAtLoad, 0, 'loading the page laid out the bulbs')
  assert.equal(canvases.length, 0, 'or made a canvas')
  frame(level(1), DAY)
  assert.equal(laid, 3, 'the three strings, at the first frame')
  frame(level(3), NIGHT)
  assert.equal(laid, 3, 'and never again')
})

test('by day a frame draws the bulbs for its level and nothing else', () => {
  const { facade, eave, rose, star } = A.cathedralLights()
  const shifted = list => Array.from({ length: list.length / 2 }, (_, i) => [list[i * 2] + CX, list[i * 2 + 1] + CY])
  for (const [n, strings, rects] of [[1, [facade], 10], [2, [facade, eave], 18], [3, [facade, eave, rose], 27]]) {
    const f = frame(level(n), DAY)
    assert.equal(f.images.length, 0, `level ${n}: nothing glows by day`)
    assert.equal(f.rects.length, rects, `level ${n}`)
    // each bulb is a 2 px square on its own pixel of the sprite the bake stamped at (CX, CY)
    assert.deepEqual(f.bulbs.map(xy), strings.flatMap(shifted), `level ${n}: the bulbs' places`)
    const lit = f.bulbs.filter(c => X.BULB.includes(c.fill)).length
    assert.ok(lit > 0 && lit < f.bulbs.length, `level ${n}: ${lit} of ${f.bulbs.length} bulbs lit`)
    assert.equal(f.star.length, n >= 3 ? 2 : 0, `level ${n}: the lit star`)
    assert.deepEqual([f.state.globalAlpha, f.state.imageSmoothingEnabled], [1, false], 'the context is left as it was')
    assert.equal(f.own, 2)
  }
  // the star's upright has its top middle on the baked star's
  const f = frame(level(3), DAY)
  assert.deepEqual(f.star[0].a, [CX + star[0] - 1, CY + star[1], 3, 5])
  assert.deepEqual(f.star[1].a, [CX + star[0] - 3, CY + star[1] + 2, 7, 1])
})

test('after dark the windows, the halos and the manger light up, each over its own baked sprite', () => {
  const { roseAt } = A.cathedralLights(), { halo, manger } = Y.yardLights()
  for (const n of [1, 2, 3]) {
    const f = frame(level(n), NIGHT)
    // everything of the cathedral's after its sprite and before the statue's, everything of the yard's after that
    const sprite = f.at('cathedral'), statue = f.at('statue')
    assert.equal(sprite, 0, `level ${n}: something is drawn under the cathedral`)
    const windows = f.log[1]
    assert.deepEqual([windows.op, windows.a[0].width, windows.a[0].height, windows.a[1], windows.a[2]], ['drawImage', 124, 120, CX, CY])
    assert.ok(Math.abs(windows.alpha - 0.9) < 1e-9 && windows.smooth === false, 'the windows are stamped crisp')
    const roseHalo = f.log[2]
    assert.deepEqual([roseHalo.op, roseHalo.a[0].width, roseHalo.a[1], roseHalo.a[2]], ['drawImage', 24, CX + roseAt[0] - 12, CY + roseAt[1] - 12])
    assert.equal(f.bulbs.length, [10, 18, 24][n - 1], `level ${n}: bulbs`)
    assert.ok(f.bulbs.every(c => f.log.indexOf(c) < statue), 'the bulbs belong to the cathedral')
    const yard = f.log.slice(statue + 1)
    assert.deepEqual([yard[0].op, yard[0].a[1], yard[0].a[2]], ['drawImage', LX + halo[0] - 12, LY + halo[1] - 12], 'the halo on the statue')
    const light = yard.filter(c => c.op === 'fillRect')
    assert.deepEqual(light.map(c => c.a), n >= 2 ? [[LX + manger[0], LY + manger[1], manger[2], manger[3]]] : [], `level ${n}: the manger`)
    assert.equal(yard.length, n >= 2 ? 3 : 1, `level ${n}: the yard's calls`)
    assert.equal(f.star.length, n >= 3 ? 2 : 0, `level ${n}: the lit star`)
    assert.deepEqual([f.state.globalAlpha, f.state.imageSmoothingEnabled], [1, false], 'the context is left as it was')
  }
  // the window sprite and the glows are made once
  assert.equal(frame(level(3), NIGHT).made, 0, 'a later frame makes a canvas')
  const sprite = frame(level(3), NIGHT).log[1].a[0], { panes, specks } = A.cathedralLights()
  const lit = sprite.log.filter(c => c.op === 'fillRect')
  assert.deepEqual(lit.slice(0, panes.length / 4).map(c => c.a), Array.from({ length: panes.length / 4 }, (_, i) => [...panes.slice(i * 4, i * 4 + 4)]))
  assert.deepEqual(lit.slice(panes.length / 4).map(c => c.a), Array.from({ length: specks.length / 2 }, (_, i) => [specks[i * 2], specks[i * 2 + 1], 1, 1]))
  // at dusk, before the lights come on, it is still the day's frame
  assert.equal(frame(level(3), 0.6).images.length, 0)
})

test('the bulbs blink and the star twinkles, but not with reduced motion; on Christmas Eve every bulb burns', () => {
  const times = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
  const looks = (ev, reduced) => times.map(t => {
    const f = frame(ev, NIGHT, { reduced, t })
    return { bulbs: f.bulbs.map(c => c.fill).join(), off: f.bulbs.filter(c => !X.BULB.includes(c.fill)).length, twinkle: f.rects.find(c => c.fill === '#ffffff').a[1] }
  })
  const distinct = (list, k) => new Set(list.map(l => l[k])).size
  const moving = looks(level(3), false)
  assert.equal(distinct(moving, 'bulbs'), 4, 'four groups take turns')
  assert.ok(moving.every(l => l.off >= 10 && l.off <= 14), 'about half of the 24 lit at a time')
  assert.equal(distinct(moving, 'twinkle'), 2)
  const still = looks(level(3), true)
  assert.deepEqual([distinct(still, 'bulbs'), distinct(still, 'twinkle')], [1, 1], 'reduced motion: one still picture')
  assert.ok(still.every(l => l.off === 0), 'with every bulb lit')
  const eve = looks(level(3, true), false)
  assert.ok(eve.every(l => l.off === 0), 'Christmas Eve')
  assert.equal(distinct(eve, 'twinkle'), 2, 'the star still twinkles on Christmas Eve')
  assert.equal(distinct(looks(level(3, true), true), 'twinkle'), 1)
})

test('on Christmas Eve one wide halo stands behind the building', () => {
  const f = frame(level(3, true), NIGHT)
  assert.equal(f.own, 3)
  const [halo, sprite] = f.log
  assert.equal(sprite.op, 'cathedral', 'the halo is drawn before the sprite, so it shows behind the towers')
  assert.equal(halo.op, 'drawImage')
  const [, x, y, w, h] = halo.a
  assert.ok(x < CX && y < CY && x + w > CX + 124 && y + h > CY + 120, 'wider than the building all round')
  assert.deepEqual([f.state.globalAlpha, f.state.imageSmoothingEnabled], [1, false])
  // by day there is nothing to see of it
  const day = frame(level(3, true), DAY)
  assert.deepEqual([day.log[0].op, day.images.length], ['cathedral', 0])
})

test('an island with no room for the landmark gets no lights either', async () => {
  const site = EventLandmark.site, own = Object.getOwnPropertyDescriptor(ClaudeOffice.prototype, 'cathedralItems')
  try {
    EventLandmark.site = () => null
    // a second instance of the module, as a page whose island has no free back lawn would load it
    await import(new URL('../web/office-draw-cathedral.js?no-site', import.meta.url))
    assert.notEqual(ClaudeOffice.prototype.cathedralItems, own.value)
    const items = []
    ClaudeOffice.prototype.cathedralItems.call({ env: {} }, { ctx: context([]), t: 0, df: 0 }, items, level(3, true))
    assert.deepEqual(items, [])
  } finally {
    EventLandmark.site = site
    Object.defineProperty(ClaudeOffice.prototype, 'cathedralItems', own)
  }
})

// what a stamped canvas was painted with: the image data put on it
const painted = cv => cv.log.find(c => c.op === 'putImageData').a[0].data
test('the bake hangs both sprites on the site: the level and depth of the day, the event\'s light, no lying snow on top', () => {
  const view = { LW: S.LW, LH: S.LH, OX: S.OX, OY: S.OY }, k = 2
  const bake = (event, snow = 0.8) => SkyRender.renderProps(ISLAND, view, k, { df: 0, snow, season: 'winter', block: { W, H }, event })
  const none = bake(0), depth = SnowLogic.depth(0.8)
  assert.ok(depth >= 1, 'snow lies, so a prop that takes lying snow gets a pass of it')
  assert.ok(none.some(p => p.img.log.some(c => c.op === 'drawImage' && c.a.length === 9)), 'as the other props do')
  assert.ok(!none.some(p => p.z === SITE.z && p.x === SITE.at[0]), 'nothing of it outside the event')
  const T = c => hex(SkyRender.night(c, 0.45)), snowLit = hex(SnowLogic.night(SnowLogic.PAL.lit, 0))
  for (const event of [1, 2, 3]) {
    const props = bake(event)
    assert.equal(props.length, none.length + 2 + (event >= 2 ? ISLAND.lamps.length : 0), `level ${event}`)
    for (const [prop, tile, z, layer, ext, colour] of [
      [props.at(-2), SITE.at, SITE.z, A.cathedralLayer, A.CATHEDRAL_EXT, A.CATHEDRAL_PAL.BRICK.left],
      [props.at(-1), SITE.lady, SITE.ladyZ, Y.yardLayer, Y.LADY_EXT, Y.LADY_PAL.lit],
    ]) {
      assert.deepEqual([prop.x, prop.y, prop.z, prop.lamp], [...tile, z, -1])
      const [x, y] = corner(tile, ext)
      assert.deepEqual([prop.dx, prop.dy, prop.img.width, prop.img.height], [x * k, y * k, (ext[0] + ext[2]) * k, (ext[1] + ext[3]) * k])
      // one stamp of the whole sprite at its corner, and no pass of lying snow after it
      const stamps = prop.img.log.filter(c => c.op === 'drawImage')
      assert.equal(stamps.length, 1, `level ${event}: lying snow was settled on a sprite that brings its own`)
      const [cv, sx, sy] = stamps[0].a
      assert.deepEqual([sx, sy, cv.width, cv.height], [x, y, ext[0] + ext[2], ext[1] + ext[3]])
      // the very layer of this level and depth, brick and stone in the event's light, snow in the snow's
      const L = layer(event, depth), data = painted(cv), rgb = i => [...data.slice(i * 4, i * 4 + 3)]
      for (let i = 0; i < L.idx.length; i++) assert.equal(data[i * 4 + 3] > 0, L.idx[i] > 0, `level ${event}: pixel ${i}`)
      const first = c => L.idx.findIndex(n => n && L.keys[n - 1][0] === c)
      assert.deepEqual(rgb(first(colour)), T(colour), `level ${event}: ${colour} in the event's light`)
      assert.deepEqual(rgb(first(SnowLogic.PAL.lit)), snowLit, `level ${event}: snow keeps its own light`)
    }
  }
  // a bare day bakes the bare layer
  const bare = bake(3, 0).at(-2).img.log.find(c => c.op === 'drawImage').a[0], L0 = A.cathedralLayer(3, 0), data = painted(bare)
  for (let i = 0; i < L0.idx.length; i++) assert.equal(data[i * 4 + 3] > 0, L0.idx[i] > 0, `bare: pixel ${i}`)
})
