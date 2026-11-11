// What the dogs wear at Christmas (web/dog-sprites-xmas.js): pixels laid over each frame of each breed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

const { DogSprites: D } = loadWeb('dog-sprites')
const { DogXmas: X } = loadWeb('dog-sprites-xmas')
const all = () => Object.keys(D.BREEDS).flatMap(b => D.frameNames(b).map(n => [b, n, D.frame(b, n)]))

test('every frame of every breed has something on, inside the frame (plus the rows kept free above it)', () => {
  for (const [b, n, f] of all()) {
    const o = X.overlay(b, n)
    assert.ok(o.length > 0, `${b}/${n} is bare`)
    for (const [x, y, k] of o) {
      assert.ok(Number.isInteger(x) && x >= 0 && x < f.w, `${b}/${n} x=${x}`)
      assert.ok(Number.isInteger(y) && y >= -X.PAD && y < f.h, `${b}/${n} y=${y}`)
      assert.ok(X.PAL[k], `${b}/${n} colour ${k}`)
    }
    assert.equal(new Set(o.map(([x, y]) => x + ',' + y)).size, o.length, `${b}/${n} paints a pixel twice`)
  }
})

test('the palette is the four colours of the spec', () => {
  assert.deepEqual(X.PAL, { r: '#c8323a', w: '#f4f1e8', b: '#8a5a3a', n: '#ff4d4d' })
})

test('the corgi has a red nose and two antlers in every frame', () => {
  for (const n of D.frameNames('corgi')) {
    const o = X.overlay('corgi', n), f = D.frame('corgi', n)
    const nose = o.filter(p => p[2] === 'n')
    assert.equal(nose.length, 1, n)
    assert.equal(f.rows[nose[0][1]][nose[0][0]], 'k', `${n}: the red nose sits on the black one`)
    assert.ok(o.filter(p => p[2] === 'b').length >= 6, `${n}: antlers`)
  }
})

test('the husky wears a red scarf at the neck; the dalmatian a red sweater with a white collar', () => {
  for (const n of D.frameNames('husky')) {
    const o = X.overlay('husky', n)
    assert.ok(o.length >= 4 && o.every(p => p[2] === 'r'), n)
  }
  for (const n of D.frameNames('dalmatian')) {
    const o = X.overlay('dalmatian', n)
    assert.ok(o.filter(p => p[2] === 'r').length >= 10, `${n}: sweater`)
    assert.ok(o.some(p => p[2] === 'w'), `${n}: collar`)
  }
})

test('a dressed frame is the frame plus the free rows, the same width, with the overlay painted in', () => {
  for (const [b, n, f] of all()) {
    const d = X.dress(b, n, f)
    assert.equal(d.pad, X.PAD)
    assert.equal(d.w, f.w)
    assert.equal(d.h, f.h + X.PAD)
    assert.equal(d.rows.length, d.h)
    for (const row of d.rows) assert.equal(row.length, f.w)
    const pal = X.palFor(b)
    for (const row of d.rows) for (const ch of row) assert.ok(ch === '.' || pal[ch], `${b}/${n} letter ${ch}`)
    assert.equal(X.dress(b, n, f), d, 'kept, not rebuilt')
  }
  assert.deepEqual(X.overlay('corgi', 'no-such-frame'), [])
  assert.deepEqual(X.overlay('poodle', 'stand'), [])
})
