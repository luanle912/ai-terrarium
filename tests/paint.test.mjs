// The painters by label (web/paint.js) and the Christmas overlays the office lays through them
// (web/office-draw-xmas.js): every door its wreath, every outer wall its garland and lights, every desk its decoration,
// owner or not; the kennels, the pergola and the pavilion their lights; never more bulbs than EventLogic.MAX_BULBS.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb, readWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }
// A canvas context that takes any call and keeps it.
const context = (log = []) => new Proxy({ globalAlpha: 1, imageSmoothingEnabled: false, fillStyle: '' }, {
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
const { Labels } = loadWeb('labels')
const { Theme } = loadWeb('theme')
const { EventLogic } = loadWeb('event-logic')
const { DESKS } = loadWeb('office-scene')
const { DOORS, WALLS } = loadWeb('office-instances')
const X = loadWeb('office-draw-xmas')
const { ClaudeOffice } = loadWeb('office')
loadWeb('office-draw-cathedral')

const XMAS = Theme.resolve({ season: 'winter', holiday: null, event: { key: 'christmas', since: 0 }, key: 'paint-x' })
const SUMMER = Theme.resolve({ season: 'summer', holiday: null, event: null, key: 'paint-s' })

test('a painter is registered for a label\'s own variant or overlay only', () => {
  assert.throws(() => Paint.overlay('no.such', 'x', () => {}), /label/)
  assert.throws(() => Paint.overlay('door', 'garland', () => {}), /overlay/)
  assert.throws(() => Paint.variant('bush', 'nope', () => {}), /variant/)
  assert.equal(Paint.has('door', 'wreath'), true)
  assert.equal(Paint.has('door', 'garland'), false)
})

test('overlaysOf gives the look\'s overlays of a label in the pack\'s order, the same array every call', () => {
  const fs = Paint.overlaysOf('wall.outer', XMAS)
  assert.equal(fs.length, 2)
  assert.equal(Paint.overlaysOf('wall.outer', XMAS), fs, 'reused, not made per call')
  assert.deepEqual(fs.map(f => f.overlay), ['garland', 'lights'])
  assert.deepEqual(Paint.overlaysOf('wall.outer', SUMMER), [])
  assert.equal(Paint.overlaysOf('door', SUMMER), Paint.overlaysOf('desk', SUMMER))
})

test('a painter registered again replaces the old one, and overlaysOf sees it', () => {
  const old = Paint.overlaysOf('door', XMAS)[0]
  let n = 0
  Paint.overlay('door', 'wreath', () => n++)
  try {
    Paint.overlaysOf('door', XMAS)[0]()
    assert.equal(n, 1)
  } finally {
    Paint.overlay('door', 'wreath', old)
  }
  assert.equal(Paint.overlaysOf('door', XMAS)[0], old)
})

test('draw paints the variant, then every overlay', () => {
  const calls = []
  Paint.variant('stairs', 'plain', (...a) => calls.push(['plain', ...a]))
  const look = { of: () => 'plain', decor: () => [] }
  Paint.draw('stairs', look, 1, 2)
  assert.deepEqual(calls, [['plain', 1, 2]])
})

// --- the office's overlays ---
const outer = WALLS.filter(w => w.kind === 'outer')

test('STRINGS hold no level; the bulbs never pass EventLogic.MAX_BULBS', () => {
  const total = X.STRINGS.reduce((n, s) => n + s.at.length / 2, 0)
  assert.ok(total <= EventLogic.MAX_BULBS, `${total} bulbs`)
  assert.ok(total >= 100, `${total} bulbs: the walls take what the rest leave`)
  for (const s of X.STRINGS) assert.ok(!('level' in s), s.id)
  for (const w of outer) {
    const n = X.STRINGS.filter(s => s.inst === w).reduce((k, s) => k + s.at.length / 2, 0)
    assert.ok(n >= 6, `${w.id}: ${n} bulbs`)
  }
})

// One frame's items of the overlays, with the painter of (label, overlay) swapped for a spy.
const office = () => Object.assign(Object.create(ClaudeOffice.prototype), { agents: [], env: {} })
function frame(look, host = office(), spy = []) {
  const keep = spy.map(([label, overlay]) => Paint.overlaysOf(label, XMAS).find(f => f.overlay === overlay))
  const seen = spy.map(() => [])
  spy.forEach(([label, overlay], i) => Paint.overlay(label, overlay, (h, G, inst, at) => seen[i].push([inst, at])))
  const items = [], G = { ctx: context(), t: 1.2, df: 0, look }
  try {
    ClaudeOffice.prototype.xmasWallLights.call(host, G)
    ClaudeOffice.prototype.xmasItems.call(host, G, items)
    for (const it of items.sort((a, b) => a.z - b.z)) it.f()
  } finally {
    spy.forEach(([label, overlay], i) => Paint.overlay(label, overlay, keep[i]))
  }
  return { items, seen }
}

test('DESK decorations: one per desk, owner or not', () => {
  const { seen } = frame(XMAS, office(), [['desk', 'xmas-desk']])
  assert.equal(seen[0].length, DESKS.length)
  assert.deepEqual(seen[0].map(([d]) => d).sort((a, b) => DESKS.indexOf(a) - DESKS.indexOf(b)), DESKS)
})

test('every door has its wreath: the EXIT, both WC doors and every kennel\'s', () => {
  const { seen } = frame(XMAS, undefined, [['door', 'wreath']])
  assert.deepEqual(seen[0].map(([d]) => d.id).sort(), DOORS.map(d => d.id).sort())
})

test('every outer wall has its garland and its lights, the WC block\'s too', () => {
  const { seen } = frame(XMAS, undefined, [['wall.outer', 'garland'], ['wall.outer', 'lights']])
  for (const s of seen) assert.deepEqual([...new Set(s.map(([w]) => w.id))].sort(), outer.map(w => w.id).sort())
  // every bulb of the walls is drawn, once
  const bulbs = seen[1].reduce((n, [, seg]) => n + seg.at.length / 2, 0)
  const all = X.STRINGS.filter(s => s.label === 'wall.outer').reduce((n, s) => n + s.at.length / 2, 0)
  assert.equal(bulbs, all)
})

test('the kennels, the pergola and the pavilion hang their lights', () => {
  const { seen } = frame(XMAS, undefined, [['kennel', 'lights'], ['pergola', 'lights'], ['pavilion', 'lights']])
  assert.equal(seen[0].length, loadWeb('office-scene').DOG_HOUSES.length)
  assert.equal(seen[1].length, 1)
  assert.equal(seen[2].length, loadWeb('office-scene').ISLAND.pavilion ? 1 : 0)
})

test('without the event no overlay is laid and no item is pushed', () => {
  const spy = [['desk', 'xmas-desk'], ['door', 'wreath'], ['wall.outer', 'lights'], ['kennel', 'lights']]
  const { items, seen } = frame(SUMMER, undefined, spy)
  assert.deepEqual(seen.map(s => s.length), [0, 0, 0, 0])
  assert.equal(items.length, 0)
})

test('the drawing reads the look, not the event\'s level', () => {
  for (const name of ['office-draw-xmas', 'office-draw-cathedral', 'office-draw-doghouse'])
    assert.doesNotMatch(readWeb(name), /\.level\s*>=|level >= \d|eventNow\(/, name)
  assert.match(readWeb('office-draw-cathedral'), /look\.extras\.has\('cathedral'\)/)
})

// --- the office's new Christmas variants and overlays (web/office-draw-festive.js) ---
const { CLOCK, POTS, SHELF, WINDOWS } = loadWeb('office-instances')
loadWeb('office-draw-festive')
const { lerpHex } = loadWeb('office-scene')

// One frame of the festive overlays: what each spied (label, overlay) painter was laid on, and the items pushed.
function festive(look, spy) {
  const keep = spy.map(([label, overlay]) => Paint.overlaysOf(label, XMAS).find(f => f.overlay === overlay))
  const seen = spy.map(() => [])
  spy.forEach(([label, overlay], i) => Paint.overlay(label, overlay, (G, inst) => seen[i].push(inst)))
  const items = [], G = { ctx: context(), t: 1.2, df: 1, look }
  try {
    ClaudeOffice.prototype.dressWalls.call(office(), G)
    ClaudeOffice.prototype.dressItems.call(office(), G, items)
    for (const it of items) it.f()
  } finally {
    spy.forEach(([label, overlay], i) => Paint.overlay(label, overlay, keep[i]))
  }
  return { items, seen }
}
const SPY = [['window', 'frost'], ['window', 'star'], ['shelf', 'garland-small'], ['plant.pot', 'bauble'],
  ['clock', 'holly-sprig']]

test('every window its frost and star, the shelf its garland, every pot plant its baubles, the clock its holly', () => {
  const { seen } = festive(XMAS, SPY)
  assert.deepEqual(seen[0], WINDOWS)
  assert.deepEqual(seen[1], WINDOWS)
  assert.deepEqual(seen[2], SHELF)
  assert.deepEqual(seen[3], POTS)
  assert.deepEqual(seen[4], CLOCK)
})

test('without the event the festive overlays lay nothing and push no item', () => {
  const { items, seen } = festive(SUMMER, SPY)
  assert.deepEqual(seen.map(s => s.length), [0, 0, 0, 0, 0])
  assert.equal(items.length, 0)
})

test('the pantry\'s plain checker is the tiles it always was; the red one is red and white', () => {
  const plain = Paint.painter('floor.pantry', 'checker'), red = Paint.painter('floor.pantry', 'checker-red')
  for (const df of [0, 0.4, 1])
    for (const [x, y] of [[20, 0], [21, 0], [23, 5]])
      assert.equal(plain(x, y, df),
        (x + y) % 2 ? lerpHex('#2e2d3a', '#ebe7dd', df) : lerpHex('#282734', '#dfdace', df))
  assert.notEqual(red(21, 0, 1), plain(21, 0, 1))
  assert.notEqual(red(20, 0, 1), red(21, 0, 1))
})

test('the runner keeps off the big tree\'s cells', () => {
  const { RUNNER } = loadWeb('office-draw-festive')
  for (const k of EventLogic.TREE_CELLS) {
    const [cx, cy] = k.split(',').map(Number)
    for (const [x0, y0, x1, y1] of RUNNER)
      assert.ok(x1 <= cx || x0 >= cx + 1 || y1 <= cy || y0 >= cy + 1, `${[x0, y0, x1, y1]} under ${k}`)
  }
  assert.ok(RUNNER.length >= 2)
})
