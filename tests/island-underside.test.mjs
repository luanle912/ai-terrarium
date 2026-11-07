import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'
import { loadSkyLogic } from './load-sky-logic.mjs'

// A canvas that only records what is painted on it.
const painted = []
const rects = []
const fakeCanvas = () => {
  const ctx = {
    _fill: '',
    set fillStyle(v) { this._fill = v; painted.push(v) },
    get fillStyle() { return this._fill },
    imageSmoothingEnabled: true,
    fillRect(x, y, w, h) { rects.push([x, y, w, h, this._fill]) },
    drawImage() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {},
  }
  return { width: 0, height: 0, getContext: () => ctx }
}
globalThis.document ??= { createElement: () => fakeCanvas(), documentElement: {} }

const { IslandLand } = loadWeb('island-land')
const SkyLogic = loadSkyLogic()
const { drawUnderside, hex } = loadWeb('island-art')
const W = 27, H = 14
const island = IslandLand.buildIsland({ W, H })
const frame = SkyLogic.sceneFrame(island, { W, H, TW: 16, TH: 8, WALL: 64, pad: 16 })
const P = (x, y, z = 0) => [frame.OX + (x - y) * 16, frame.OY + (x + y) * 8 - z]

test('the underside is stacked grey stone columns, no dirt', () => {
  painted.length = 0
  rects.length = 0
  const ctx = fakeCanvas().getContext()
  drawUnderside({ ctx }, P, c => c, island, frame)
  const colours = new Set(painted.map(c => String(c).toLowerCase()))
  assert.ok(colours.size >= 4, `only ${colours.size} tones`)
  // grey: red, green and blue within a small spread of each other (the old cone's browns were 40+ apart)
  for (const c of colours) {
    const [r, g, b] = hex(c)
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, `${c} is not a grey stone`)
  }
  // it still tapers to a point: the stone reaches as deep as the deepest column, under the middle
  const deep = Math.max(...island.list.map(c => c.d))
  const tip = island.list.find(c => c.d === deep)
  const bottom = Math.max(...rects.map(r => r[1] + r[3]))
  const [, ty] = P(tip.x + 1, tip.y + 1, -deep)
  assert.ok(Math.abs(bottom - ty) <= 2, `the stone ends at ${bottom} px, the deepest column at ${ty}`)
  // and a column's faces step: more than one depth of bottom edge across the island
  const bottoms = new Set(rects.map(r => r[1] + r[3]))
  assert.ok(bottoms.size > 40)
})
