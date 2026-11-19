// The event trees by the office stamped from kept sprites (web/event-tree-sprite.js): one drawImage a tree a frame,
// the same picture as drawing it straight, painted once per picture.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

loadI18n('vi')
globalThis.React ??= { createElement: () => null, Component: class {} }

// A canvas context that keeps every call with the fill and the transform it was made with.
const context = log => {
  const s = { fillStyle: '', globalAlpha: 1, globalCompositeOperation: 'source-over', m: [1, 0, 0, 1, 0, 0] }
  return new Proxy(s, {
    get: (o, k) => k in o ? o[k]
      : k === 'setTransform' ? (...a) => { o.m = a; log.push({ op: k, a }) }
      : (...a) => log.push({ op: k, a, fill: o.fillStyle, m: o.m }),
    set: (o, k, v) => ((o[k] = v), true),
  })
}
const made = []
globalThis.document = {
  createElement: () => {
    const cv = { width: 0, height: 0, log: [] }, ctx = context(cv.log)
    cv.getContext = () => ctx
    made.push(cv)
    return cv
  },
}
const { eventTreeSprite, STEPS } = loadWeb('event-tree-sprite')
const { SeasonTree } = loadWeb('season-tree')
const rects = log => log.filter(c => c.op === 'fillRect').map(c => [c.fill, ...c.a])
const straight = (season, t) => { const log = []; SeasonTree.drawSeasonTree(context(log), 0, 0, season, t); return rects(log) }

test('the Christmas tree steps through four pictures, twice a second; the still trees through one', () => {
  for (let t = 0; t < 6; t += 0.13) {
    const [at, rep] = STEPS.christmas, p = at(t)
    assert.ok(p >= 0 && p < 4)
    assert.deepEqual(straight('christmas', rep(p)), straight('christmas', t), `t ${t}`)
  }
  for (const s of ['teachers', 'default'])
    assert.deepEqual(straight(s, 0), straight(s, 3.7), s)
  // every kept tree fits its sprite's box (24 left, 48 up, 48 x 58), so stamping crops nothing
  for (const s of Object.keys(STEPS))
    for (const [, x, y, w, h] of straight(s, 0)) assert.ok(x >= -24 && y >= -48 && x + w <= 24 && y + h <= 10, s)
})

test('by day each tile has its sprite on the scene\'s own pixel grid, painted once per picture', () => {
  const k = 2.3, X = 917, Y = 377, n = made.length
  const a = eventTreeSprite('christmas', X, Y, 0.1, k, 0)
  const img = a.img
  assert.deepEqual([a.x, a.y], [Math.floor((X - 24) * k), Math.floor((Y - 48) * k)])
  const tf = img.log.find(c => c.op === 'setTransform').a
  assert.deepEqual(tf, [k, 0, 0, k, X * k - a.x, Y * k - a.y], 'a point of the tree lands where it would on the scene')
  assert.deepEqual(rects(img.log), straight('christmas', 0), 'the picture drawn straight')
  const painted = img.log.length
  assert.equal(eventTreeSprite('christmas', X, Y, 0.4, k, 0).img, img, 'the same picture half a second on')
  assert.equal(img.log.length, painted, 'not painted again')
  const b = eventTreeSprite('christmas', X, Y, 0.6, k, 0)
  assert.notEqual(b.img, img, 'the next picture')
  assert.notEqual(eventTreeSprite('christmas', X + 18, Y + 9, 0.1, k, 0).img, img, 'another tile, its own grid')
  assert.equal(made.length - n, 3)
  for (let t = 0; t < 4; t += 0.25) eventTreeSprite('christmas', X, Y, t, k, 0)
  assert.equal(made.length - n, 5, 'four pictures for the tile, kept')
})

test('a tree whose clock never stops is drawn straight by day', () => {
  assert.equal(eventTreeSprite('halloween', 100, 100, 1, 2, 0), null)
})

test('after dark one tinted sprite serves every tile; a moving tree is painted again only when its clock moves', () => {
  const k = 2, dusk = 0.6
  const a = eventTreeSprite('christmas', 300, 200, 0.1, k, dusk), img = a.img
  assert.deepEqual([a.x, a.y], [Math.round(276 * k), Math.round(152 * k)])
  assert.equal(eventTreeSprite('christmas', 340, 220, 0.2, k, dusk).img, img)
  const tint = img.log.filter(c => c.op === 'fillRect').at(-1)
  assert.equal(tint.fill, 'rgba(13,19,34,0.6)')
  const h = eventTreeSprite('halloween', 300, 200, 1, k, dusk).img, painted = h.log.length
  eventTreeSprite('halloween', 340, 220, 1, k, dusk)
  assert.equal(h.log.length, painted, 'the same clock: not painted again')
  eventTreeSprite('halloween', 300, 200, 1.1, k, dusk)
  assert.ok(h.log.length > painted, 'a new clock: painted again')
})

test('the office stamps an event tree with one drawImage', () => {
  const log = [], ctx = context(log)
  loadWeb('office-draw')
  const { ClaudeOffice } = loadWeb('office')
  ClaudeOffice.prototype.drawEventTree.call({}, ctx, { x: 16, y: -5 }, 'christmas', 0.3, 2, 0)
  assert.deepEqual(log.filter(c => c.op !== 'setTransform').map(c => c.op), ['drawImage'])
})
