import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'

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
