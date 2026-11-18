// The island's trees and bushes, the far islands in the sky and the world view's small islands read the Look
// (web/theme.js), never the event's level: under Christmas every island tree is a fir, every bush holly, every far
// tree a lit fir and every mini tree of the world view a fir; with no event the season's own look stays.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb, readWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
// A canvas context that takes any call and keeps it (the fill colour with every call).
const LOG = []
const context = (log = LOG) => new Proxy({ globalAlpha: 1, imageSmoothingEnabled: false, fillStyle: '' }, {
  get: (s, k) => k in s ? s[k]
    : k === 'createImageData' || k === 'getImageData' ? (...a) => ({ data: new Uint8ClampedArray(a.at(-2) * a.at(-1) * 4) })
    : /Gradient$/.test(k) ? () => ({ addColorStop() {} })
    : (...a) => { log.push({ op: k, a, fill: s.fillStyle }) },
  set: (s, k, v) => ((s[k] = v), true),
})
globalThis.document ??= {
  createElement: () => {
    const cv = { width: 0, height: 0 }, ctx = context()
    cv.getContext = () => ctx
    return cv
  },
}

const { Paint } = loadWeb('paint')
const { Theme } = loadWeb('theme')
const { Labels, OUTDOOR_LABELS } = loadWeb('labels')
const SkyIsland = loadWeb('sky-island')
const { drawBush, painter } = loadWeb('island-art')
const SkyMist = loadWeb('sky-mist')
const WorldUI = loadWeb('world-ui')
const { ISLAND, LW, LH, OX, OY, W, H } = loadWeb('office-scene')

const XMAS = Theme.resolve({ season: 'winter', holiday: null, event: { key: 'christmas', since: 14 }, key: 'il-x' })
const WINTER = Theme.resolve({ season: 'winter', holiday: null, event: null, key: 'il-w' })
const SPRING = Theme.resolve({ season: 'spring', holiday: null, event: null, key: 'il-s' })
const envOf = look => ({ df: 1, snow: 0, season: 'winter', block: { W, H }, look })
const FRAME = { LW, LH, OX, OY }
const fills = log => new Set(log.map(e => e.fill))

test('OUTDOOR_LABELS lists the outdoor labels, frozen', () => {
  assert.deepEqual([...OUTDOOR_LABELS], Labels.LIST.filter(l => l.group === 'outdoor').map(l => l.id))
  assert.ok(OUTDOOR_LABELS.includes('tree.island') && OUTDOOR_LABELS.includes('bush'))
  assert.ok(Object.isFrozen(OUTDOOR_LABELS))
  assert.notEqual(XMAS.keyOf(OUTDOOR_LABELS), WINTER.keyOf(OUTDOOR_LABELS))
})

test('the island bakes read the look, not the event level', () => {
  for (const f of ['sky-island', 'sky-render', 'sky-mist', 'office-draw', 'world-draw', 'world-ui'])
    assert.doesNotMatch(readWeb(f), /\.event\b|festive|cacheKey/, f)
  assert.match(readWeb('office-draw'), /keyOf\(/)
  assert.doesNotMatch(readWeb('office'), /event: ev \? ev\.level/)
})

test('renderProps paints every tree and bush with the look\'s variant, through its painter', () => {
  const trees = ISLAND.decor.filter(d => d.kind === 'tree').length,
    bushes = ISLAND.decor.filter(d => d.kind === 'bush').length
  assert.ok(trees > 0 && bushes > 0)
  for (const v of Labels.byId('tree.island').variants) assert.ok(Paint.has('tree.island', v), 'tree.island ' + v)
  for (const v of Labels.byId('bush').variants) assert.ok(Paint.has('bush', v), 'bush ' + v)
  const seen = []
  for (const v of Labels.byId('tree.island').variants) Paint.variant('tree.island', v, (pt, P, C, d) => seen.push(['tree', v, d]))
  for (const v of Labels.byId('bush').variants) Paint.variant('bush', v, (pt, P, C, d) => seen.push(['bush', v, d]))
  const count = (look, label, v) => {
    seen.length = 0
    const props = SkyIsland.renderProps(ISLAND, FRAME, 1, envOf(look))
    return { n: seen.filter(s => s[0] === label && s[1] === v).length, all: seen.filter(s => s[0] === label).length, props }
  }
  let r = count(XMAS, 'tree', 'fir')
  assert.equal(r.n, trees, 'every island tree is a fir under Christmas')
  assert.equal(r.all, trees)
  assert.equal(r.props.filter(p => p.tree).length, trees)
  r = count(XMAS, 'bush', 'holly')
  assert.equal(r.n, bushes, 'every bush is holly under Christmas')
  r = count(WINTER, 'tree', 'bare')
  assert.equal(r.n, trees, 'winter with no event: bare trees')
  assert.equal(count(WINTER, 'bush', 'plain').n, bushes, 'winter with no event: plain bushes')
  assert.equal(count(SPRING, 'bush', 'fruit').n, bushes, 'spring: bushes in fruit')
  // the canes and the cathedral come with the look's extras
  const n = look => SkyIsland.renderProps(ISLAND, FRAME, 1, envOf(look)).length
  assert.ok(n(XMAS) > n(WINTER) + ISLAND.lamps.length, 'Christmas adds the canes and the cathedral')
})

test('a holly bush paints dark green leaves and red berries on the bush\'s frame', () => {
  const P = (x, y, z = 0) => [(x - y) * 16, (x + y) * 8 - z]
  const paint = v => {
    const log = []
    drawBush(painter(context(log), P), P, c => c, { x: 3, y: 5 }, v)
    return log
  }
  const holly = paint('holly'), plain = paint('plain')
  assert.ok(fills(holly).has('#1f5e3a'), 'dark green leaves')
  assert.ok(fills(holly).has('#c8323a'), 'red berries')
  assert.ok(!fills(plain).has('#1f5e3a'))
  const box = log => {
    const r = log.filter(e => e.op === 'fillRect')
    return [Math.min(...r.map(e => e.a[0])), Math.max(...r.map(e => e.a[0])), Math.min(...r.map(e => e.a[1]))]
  }
  assert.deepEqual(box(holly), box(plain), 'the same footprint as the plain bush')
})

test('the far islands: the sprite is keyed by the tree variant; a fir with lights under Christmas', () => {
  assert.ok(Paint.has('tree.far', 'lights'), 'the far fir\'s lights have a painter')
  const col = { haze: '#a8c4e0' }
  const paintOf = (trees, overlays) => {
    const log = []
    SkyMist.paintFarIsland(context(log), 1, col.haze, 'tree', trees, true, overlays)
    return fills(log)
  }
  const lit = paintOf('fir', Paint.overlaysOf('tree.far', XMAS)), bare = paintOf('bare', Paint.overlaysOf('tree.far', WINTER))
  assert.ok(lit.has('#ffe27a'), 'the star on the lit fir')
  assert.ok(!bare.has('#ffe27a'))
  assert.ok(!paintOf('fir', []).has('#ffe27a'), 'a fir without the lights overlay has no star')
  // farIsland repaints its sprite only when what it shows changes
  const ctx = context([])
  const at = () => LOG.length
  SkyMist.farIsland(ctx, 0, 0, 0.77, col, 'tree', 'bare', true, Paint.overlaysOf('tree.far', WINTER))
  let n = at()
  SkyMist.farIsland(ctx, 0, 0, 0.77, col, 'tree', 'bare', true, Paint.overlaysOf('tree.far', WINTER))
  assert.equal(at(), n, 'same look, no repaint')
  SkyMist.farIsland(ctx, 0, 0, 0.77, col, 'tree', XMAS.of('tree.far'), true, Paint.overlaysOf('tree.far', XMAS))
  assert.ok(at() > n, 'the fir repaints the sprite')
  n = at()
  SkyMist.farIsland(ctx, 0, 0, 0.77, col, 'tree', 'fir', true, Paint.overlaysOf('tree.far', WINTER))
  assert.ok(at() > n, 'the lights are part of the sprite id')
})

test('the world view: the mini tree has a fir, and the small island\'s art key follows the look', () => {
  const log = []
  WorldUI.tree(context(log), 20, 20, 1, 'fir')
  const fir = fills(log)
  const glog = []
  WorldUI.tree(context(glog), 20, 20, 1, 'green')
  assert.notDeepEqual(fir, fills(glog), 'the fir is not the green tree')
  const rects = log.filter(e => e.op === 'fillRect')
  const top = Math.min(...rects.map(e => e.a[1])), left = Math.min(...rects.map(e => e.a[0])),
    right = Math.max(...rects.map(e => e.a[0] + e.a[2]))
  assert.ok(20 - top >= 8 && 20 - top <= 11, 'about 9 px tall: ' + (20 - top))
  assert.ok(right - left <= 7, 'about 6 px wide')
  const key = look => WorldUI.islandArtKey('#5aa9e6', 1, 2, false, 'winter', look)
  assert.notEqual(key(XMAS), key(WINTER), 'christmas and none give different art')
  assert.equal(key(XMAS), key(Theme.resolve({ season: 'winter', holiday: null, event: { key: 'christmas', since: 14 }, key: 'il-x2' })))
  assert.match(readWeb('world-draw'), /islandArtKey\(/)
})
