import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'
import { loadSkyLogic } from './load-sky-logic.mjs'

const { IslandLand } = loadWeb('island-land')
const SkyLogic = loadSkyLogic()
const { hex, paletteLayer, undersideLayer } = loadWeb('island-art')
const W = 27, H = 14
const island = IslandLand.buildIsland({ W, H })
const frame = SkyLogic.sceneFrame(island, { W, H, TW: 16, TH: 8, WALL: 64, pad: 16 })
const P = (x, y, z = 0) => [frame.OX + (x - y) * 16, frame.OY + (x + y) * 8 - z]

// The underside is worked out once per island and frame as palette keys (web/island-art.js undersideLayer); a bake
// only maps the keys through the light. Its painted rows: the lowest pixel row of every column of pixels.
const layer = undersideLayer(P, island, frame)
const bottoms = []
for (let x = 0; x < layer.w; x++)
  for (let y = 0; y < layer.h; y++)
    if (layer.idx[y * layer.w + x] && (y + 1 === layer.h || !layer.idx[(y + 1) * layer.w + x])) bottoms.push(y + 1)

test('the underside is stacked grey stone columns, no dirt', () => {
  const colours = new Set(layer.keys.map(([c]) => String(c).toLowerCase()))
  assert.ok(colours.size >= 4, `only ${colours.size} tones`)
  // grey: red, green and blue within a small spread of each other (the old cone's browns were 40+ apart)
  for (const c of colours) {
    const [r, g, b] = hex(c)
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, `${c} is not a grey stone`)
  }
  // it still tapers to a point: the stone reaches as deep as the deepest column, under the middle
  const deep = Math.max(...island.list.map(c => c.d))
  const tip = island.list.find(c => c.d === deep)
  const bottom = Math.max(...bottoms)
  const [, ty] = P(tip.x + 1, tip.y + 1, -deep)
  assert.ok(Math.abs(bottom - ty) <= 2, `the stone ends at ${bottom} px, the deepest column at ${ty}`)
  // and a column's faces step: more than one depth of bottom edge across the island
  assert.ok(new Set(bottoms).size > 40)
})

test('the underside is worked out once per island and frame, and only recoloured per bake', () => {
  assert.equal(undersideLayer(P, island, frame), layer)
  const other = IslandLand.buildIsland({ W, H })
  assert.notEqual(undersideLayer(P, other, frame), layer)
  const moved = { ...frame, OX: frame.OX + 8 }
  assert.notEqual(undersideLayer(P, island, moved), layer)
})

test('a palette layer keeps what fillRect paints, last one on top, clipped to its box', () => {
  const L = paletteLayer(4, 3)
  L.g.fillStyle = '#111111'
  L.g.fillRect(-1, 0, 3, 2)
  L.g.fillStyle = '#222222'
  L.g.fillRect(1, 1, 9, 9)
  assert.deepEqual([...L.idx], [1, 1, 0, 0, 1, 2, 2, 2, 0, 2, 2, 2])
  assert.deepEqual(L.keys, [['#111111', 0], ['#222222', 0]])
})
