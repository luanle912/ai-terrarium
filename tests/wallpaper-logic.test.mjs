import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'

const { WallpaperLogic } = loadWeb('wallpaper-logic')

test('?wallpaper turns the page into a desktop wallpaper', () => {
  for (const s of ['?wallpaper=1', '?wallpaper=true', '?wallpaper', '?wallpaper=', '?lang=vi&wallpaper=1'])
    assert.equal(WallpaperLogic.fromSearch(s), true, s)
})

test('the page stays as usual without it or when it is switched off', () => {
  for (const s of ['', '?', '?wallpaper=0', '?wallpaper=false', '?wallpaper=no', '?lang=vi', '?wall=1', undefined, null])
    assert.equal(WallpaperLogic.fromSearch(s), false, String(s))
})

test('as a wallpaper a frame is drawn FPS times a second, every fourth refresh at 60 Hz', () => {
  const { FPS, frameDue } = WallpaperLogic
  assert.equal(FPS, 15)
  assert.equal(frameDue(0, null), true, 'the first frame is always drawn')
  let last = 0, drawn = 0
  for (let i = 1; i <= 60; i++) {
    const t = i * (1000 / 60) + (i % 2 ? 0.3 : -0.3)
    if (frameDue(t, last)) { drawn++; last = t }
  }
  assert.equal(drawn, 15, '60 refreshes in a second give 15 frames')
  assert.equal(frameDue(10, 0), false)
})

test('on a 120 Hz screen it is still FPS frames a second', () => {
  const { FPS, frameDue } = WallpaperLogic
  let last = 0, drawn = 0
  for (let i = 1; i <= 120; i++) {
    const t = i * (1000 / 120)
    if (frameDue(t, last)) { drawn++; last = t }
  }
  assert.equal(drawn, FPS)
})

test('as a wallpaper the far sky is redrawn on every other frame', () => {
  const { SKY_EVERY, skyDue } = WallpaperLogic
  assert.equal(SKY_EVERY, 2)
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(skyDue), [false, true, false, true, false, true])
})
