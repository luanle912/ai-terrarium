import { test } from 'node:test'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

import { loadWeb, readWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

const require = createRequire(import.meta.url)
const { Labels } = loadWeb('labels')
const { Theme } = loadWeb('theme')
const IDS = Labels.LIST.map(l => l.id)

test('every event pack declares every label in swap (a variant or same)', () => {
  const events = Theme.PACKS.filter(p => p.kind === 'event')
  assert.ok(events.length >= 1)
  for (const p of events) assert.deepEqual(IDS.filter(id => !(id in p.swap)), [], p.key)
})

test('every swap value is one of the label\'s variants (or same), every decor value one of its overlays', () => {
  for (const p of Theme.PACKS) {
    for (const [id, v] of Object.entries(p.swap || {})) {
      const label = Labels.byId(id)
      assert.ok(label, `${p.key}: unknown label ${id}`)
      const vals = typeof v === 'string' ? [v] : Object.values(v)
      for (const x of vals) assert.ok(x === Theme.SAME || label.variants.includes(x), `${p.key}: ${id} = ${x}`)
    }
    for (const [id, list] of Object.entries(p.decor || {})) {
      const label = Labels.byId(id)
      assert.ok(label, `${p.key}: unknown label ${id}`)
      for (const o of list) assert.ok(label.overlays.includes(o), `${p.key}: ${id} + ${o}`)
    }
  }
})

test('the base pack gives every label a variant in every season', () => {
  const base = Theme.PACKS.find(p => p.kind === 'base')
  assert.deepEqual(IDS.filter(id => !(id in base.swap)), [])
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    const look = Theme.resolve({ season, holiday: null, event: null, key: 'labels-' + season })
    for (const id of IDS) assert.ok(Labels.byId(id).variants.includes(look.of(id)), `${season}: ${id}`)
  }
})

test('the packs: base, winter, christmas and every small holiday of the season tree', () => {
  const { SeasonTree } = loadWeb('season-tree')
  const small = Object.keys(SeasonTree.SEASONS)
    .filter(k => k !== 'christmas' && ['event', 'lunar'].includes(SeasonTree.SEASONS[k].type))
  const keys = Theme.PACKS.map(p => p.key)
  for (const k of ['base', 'winter', 'christmas', ...small]) assert.ok(keys.includes(k), k)
  assert.deepEqual(Theme.PACKS.filter(p => p.kind === 'holiday').map(p => p.key).sort(), small.sort())
})

test('a test pack resolves without code changes', () => {
  const swap = Object.fromEntries(IDS.map(id => [id, Theme.SAME]))
  swap['tree.island'] = 'test'
  const pack = { key: 'test', kind: 'event', swap }
  const packs = [...Theme.PACKS, pack]
  const look = Theme.resolve({ season: 'summer', holiday: null, event: { key: 'test', since: 0 }, key: 't' }, packs)
  assert.equal(look.of('tree.island'), 'test')
  assert.equal(look.of('bush'), Theme.resolve({ season: 'summer', holiday: null, event: null, key: 's' }).of('bush'))
  assert.equal(look.has('critter.reindeer'), false)
})

// Overlays some later task of the plan paints (docs/plans/2026-11-18-asset-labels-plan.md): each one leaves this list
// in the task that registers its painter, and the test below fails if it is listed and painted at once.
const LATER = new Set()
test('every (label, overlay) in every pack has a painter', () => {
  globalThis.React ??= { createElement: () => null, Component: class {} }
  loadI18n('vi')
  loadWeb('office-draw-xmas') // the office's Christmas overlays register their painters on import
  loadWeb('sky-mist') // and the far islands' fir its lights
  loadWeb('office-draw-festive') // and the office's floors, windows, shelf, pot plants and clock theirs
  const { Paint } = loadWeb('paint')
  const missing = []
  for (const p of Theme.PACKS)
    for (const [id, list] of Object.entries(p.decor || {}))
      for (const o of list) {
        const k = id + '+' + o
        if (LATER.has(k)) assert.equal(Paint.has(id, o), false, `${k} is painted: take it off LATER`)
        else if (!Paint.has(id, o)) missing.push(`${p.key}: ${k}`)
      }
  assert.deepEqual(missing, [])
})

test('every variant of the office\'s floors has a painter: the drawing asks for the look\'s, whatever it is', () => {
  globalThis.React ??= { createElement: () => null, Component: class {} }
  loadI18n('vi')
  loadWeb('office-draw-festive')
  const { Paint } = loadWeb('paint')
  for (const id of ['floor.corridor', 'floor.pantry'])
    for (const v of Labels.byId(id).variants) assert.equal(typeof Paint.painter(id, v), 'function', `${id} ${v}`)
})

// Every label that can take more than one look: each of its variants has a painter, registered by the module that
// draws it, so a new pack's variant nobody paints fails here rather than falling to some default in the drawing.
test('every variant of every label with more than one has a painter', () => {
  globalThis.React ??= { createElement: () => null, Component: class {} }
  globalThis.document ??= { documentElement: {}, createElement: () => ({ getContext: () => ({}) }) } // world-ui reads it
  loadI18n('vi')
  for (const m of ['island-art', 'island-art-season', 'office-draw-festive', 'sky-mist', 'world-ui', 'office-draw',
    'outfit-logic', 'dog-sprites-xmas']) loadWeb(m)
  const { Paint } = loadWeb('paint')
  const missing = []
  for (const l of Labels.LIST)
    if (l.variants.length > 1) for (const v of l.variants) if (!Paint.has(l.id, v)) missing.push(l.id + ' ' + v)
  assert.deepEqual(missing, [])
})

test('web/office-draw.js stays at 700 lines or fewer', () => {
  assert.ok(readWeb('office-draw').split('\n').length <= 701, 'move drawing out to a module of its own')
})

// Pack data nobody reads is a promise the drawing does not keep. An extra is a thing that stands while the pack is on
// (drawn, baked into the island, blocking cells: look.extras.has, LookChange.BLOCKERS); a rule switches part of the
// living scene on (look.has). One name is one or the other, never both, so presence and drawing read the same source.
test('every extra a pack lists is read by the scene, and no name is both an extra and a rule', () => {
  const { readdirSync } = require('node:fs')
  const src = readdirSync(new URL('../web/', import.meta.url))
    .filter(f => f.endsWith('.js'))
    .map(f => readWeb(f.slice(0, -3)))
    .join('\n')
  const { LookChange } = loadWeb('look-change')
  const unread = [], both = []
  for (const p of Theme.PACKS) {
    for (const x of p.extras || []) {
      const read = src.includes(`extras.has('${x}')`) || LookChange.BLOCKERS.includes(x)
      if (!read) unread.push(`${p.key}: ${x}`)
      if (x in (p.rules || {})) both.push(`${p.key}: ${x}`)
    }
  }
  assert.deepEqual(unread, [], 'read nowhere: wire it to its gate or drop it')
  assert.deepEqual(both, [], 'an extra and a rule at once')
})

test('the big tree and the cathedral are drawn from the extras, the same source that blocks their cells', () => {
  const { LookChange } = loadWeb('look-change')
  assert.deepEqual([...LookChange.BLOCKERS].sort(), ['cathedral', 'tree.big'])
  assert.match(readWeb('office-draw-xmas'), /look\.extras\.has\('tree\.big'\)/)
  assert.match(readWeb('office-draw-cathedral'), /look\.extras\.has\('cathedral'\)/)
  for (const f of ['office-draw-xmas', 'office-draw-cathedral'])
    assert.doesNotMatch(readWeb(f), /look\.has\('(tree\.big|cathedral)'\)/, f)
})
