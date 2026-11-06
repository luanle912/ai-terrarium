import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadAnimalSprites } from './load-animal-sprites.mjs'

const Sprites = loadAnimalSprites()

const IDS = ['hen', 'duck', 'rabbit', 'tabby', 'squirrel', 'fox', 'redpanda', 'frog', 'owl', 'deer', 'peacock', 'snowfox', 'unicorn', 'dragon']
const REQUIRED = ['stand', 'walk1', 'walk2', 'act', 'rest', 'sleep']

const eachFrame = fn => {
  for (const id of Sprites.SPECIES_IDS) for (const name of Sprites.frameNames(id)) fn(id, name, Sprites.frame(id, name))
}

test('there are exactly the 14 species of spec 3.2, in table order', () => {
  assert.deepEqual([...Sprites.SPECIES_IDS], IDS)
})

test('every species has the six frames the walker asks for', () => {
  for (const id of IDS) {
    const names = Sprites.frameNames(id)
    for (const name of REQUIRED) assert.ok(names.includes(name), `${id} has no ${name}`)
  }
})

test('every row of a frame has the same width, and w/h describe the rows', () => {
  eachFrame((id, name, f) => {
    assert.equal(f.h, f.rows.length, `${id}/${name} h`)
    for (const [y, row] of f.rows.entries()) assert.equal(row.length, f.w, `${id}/${name} row ${y} is ${row.length} wide, not ${f.w}`)
  })
})

test('frames stay within 10-20 px wide and 8-18 px tall', () => {
  eachFrame((id, name, f) => {
    assert.ok(f.w >= 10 && f.w <= 20, `${id}/${name} is ${f.w} wide`)
    assert.ok(f.h >= 8 && f.h <= 18, `${id}/${name} is ${f.h} tall`)
  })
})

test('every pixel uses a colour from the species palette, and palette colours are #rrggbb', () => {
  eachFrame((id, name, f) => {
    for (const row of f.rows) for (const ch of row) assert.ok(ch === '.' || f.pal[ch], `${id}/${name} uses '${ch}'`)
  })
  for (const id of IDS) for (const [k, col] of Object.entries(Sprites.frame(id, 'stand').pal)) {
    assert.match(col, /^#[0-9a-f]{6}$/i, `${id} '${k}'`)
  }
})

test('every frame has its feet on the bottom row and an anchor column inside the frame', () => {
  eachFrame((id, name, f) => {
    assert.ok(/[^.]/.test(f.rows.at(-1)), `${id}/${name} floats`)
    assert.ok(Number.isInteger(f.ax) && f.ax > 0 && f.ax < f.w, `${id}/${name} ax=${f.ax}`)
  })
})

test('no frame is padded on both sides (wasted width shifts the anchor and the shadow)', () => {
  eachFrame((id, name, f) => {
    const col = x => f.rows.some(r => r[x] !== '.')
    assert.ok(col(0) || col(f.w - 1), `${id}/${name} has empty columns on both sides`)
  })
})

test('the walk cycle and the action actually move', () => {
  for (const id of IDS) {
    const rows = n => Sprites.frame(id, n).rows.join('\n')
    assert.notEqual(rows('walk1'), rows('walk2'), `${id} walk1 = walk2`)
    assert.notEqual(rows('act'), rows('stand'), `${id} act = stand`)
    assert.notEqual(rows('sleep'), rows('rest'), `${id} sleep = rest`)
  }
})

test('frames are cached and frozen so the page can share them', () => {
  const f = Sprites.frame('fox', 'walk1')
  assert.equal(Sprites.frame('fox', 'walk1'), f)
  assert.ok(Object.isFrozen(f) && Object.isFrozen(f.rows))
})

test('an unknown species or frame is a clear error, not undefined pixels', () => {
  assert.throws(() => Sprites.frame('cat', 'stand'), /unknown species/)
  assert.throws(() => Sprites.frame('fox', 'fly'), /no frame/)
})
