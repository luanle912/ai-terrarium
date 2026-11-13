import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'
import { loadDogLogic, loadDogSprites } from './load-dog-logic.mjs'

// The restroom block's back wall is the office's back wall carried on to x = WC.x1, drawn at once after everything
// behind the walls (web/office-draw-restroom.js): a dog sorted in with the other sprites behind it would show through.
loadI18n('vi')
globalThis.React ??= { createElement: () => null }
const scene = loadWeb('office-scene')
const { DOG_PLACES, DOG_ROAM, WALL, FLOOR_Z, PG, WC, W, H, WALL_REACH, DRAW_REACH, BACK_X1, behindWalls } = scene
const Dog = loadDogLogic()
const Sprites = loadDogSprites()
const cellOf = k => k.split(',').map(Number)

// Every breed in every pose: the widest and tallest a dog can be, left and right of its foot, and up from it.
function dogBox() {
  let left = 0, right = 0, up = 0
  for (const b of Object.keys(Sprites.BREEDS))
    for (const n of Sprites.frameNames(b)) {
      const f = Sprites.frame(b, n)
      left = Math.max(left, f.ax)
      right = Math.max(right, f.w - f.ax)
      up = Math.max(up, f.h)
    }
  return { left, right, up }
}

// The back wall as the screen sees it: its face and cap, from the office's corner to the block's east end.
const wall = (() => {
  const top = WALL + 3, z = FLOOR_Z
  return [PG(0, 0, z), PG(WC.x1, 0, z), PG(WC.x1, 0, z + top), PG(0, 0, z + top)]
})()
const inside = (p, poly) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

test('no dog sorted in with the sprites would be drawn over the back wall, in front of the block as well', () => {
  const box = dogBox()
  const bad = []
  for (const k of DOG_ROAM) {
    const [x, y] = cellOf(k)
    if (behindWalls(x, y, DRAW_REACH)) continue
    const [fx, fy] = PG(x + 0.5, y + 0.5)
    let over = false
    for (let px = fx - box.left; px <= fx + box.right && !over; px += 2)
      for (let py = fy - box.up; py <= fy && !over; py += 2) over = inside([px, py], wall)
    if (over) bad.push(k)
  }
  assert.deepEqual(bad, [], 'these cells draw a dog over the wall')
})

test('the strip behind the block is drawn before the walls and kept clear of dogs, as behind the office', () => {
  for (let x = W; x < WC.x1; x++) {
    assert.ok(behindWalls(x, -1), `${x},-1 is right behind the block's back wall`)
    assert.ok(!DOG_ROAM.has(`${x},-1`), `${x},-1 would hide a dog`)
  }
  // the farthest corner of the strip: the block's east end, as far back as the wall reaches
  assert.ok(behindWalls(BACK_X1 - WALL_REACH, -WALL_REACH))
  assert.ok(behindWalls(BACK_X1 - DRAW_REACH, -DRAW_REACH, DRAW_REACH))
  assert.ok(!behindWalls(BACK_X1 - WALL_REACH + 2, -WALL_REACH), 'one column past the block\'s east end (and its slack)')
  // the office's own strip is as before
  assert.ok(behindWalls(10, -1) && behindWalls(26, -4))
  // past the block's east end the lawn is open, and so is the back lawn further back
  assert.ok(!behindWalls(WC.x1 + 4, -1))
  assert.ok(!behindWalls(WC.x1 - 1, -(WALL_REACH + 2)))
})

test('the lawn behind the block can still be reached round its east end', () => {
  const cells = [...DOG_ROAM].map(cellOf)
  const back = cells.filter(([x, y]) => y < -WALL_REACH && x - y > W + 1 && x - y <= WC.x1 + 6)
  assert.ok(back.length > 10, 'no lawn behind the block')
  for (const c of [back[0], back[back.length - 1]]) assert.ok(Dog.path(DOG_ROAM, [23, H + 4], c).length > 0, `${c}`)
  assert.equal(DOG_PLACES.roam, DOG_ROAM)
})
