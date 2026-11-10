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
