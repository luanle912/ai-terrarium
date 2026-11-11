// The Christmas critters' pixel sprites (web/critter-sprites.js): reindeer, elves, penguins, Santa, his sleigh and
// the parachuted presents.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadWeb } from './web.mjs'

const { CritterSprites: C } = loadWeb('critter-sprites')
const NEED = {
  reindeer: [['stand', 'graze', 'look', 'walk1', 'walk2'], 20, 18],
  elf: [['walk1', 'walk2', 'carry1', 'carry2', 'place', 'slip'], 10, 14],
  penguin: [['stand', 'waddle1', 'waddle2', 'slide'], 12, 10],
  santa: [['sit', 'wave'], 14, 16],
  sleigh: [['fly'], 48, 16],
  parcel: [['chute', 'box'], 9, 13],
}
const FLOATING = ['sleigh/fly', 'parcel/chute']

test('every kind has its frames, no larger than its box, in its own palette', () => {
  assert.deepEqual(Object.keys(C.KINDS).sort(), Object.keys(NEED).sort())
  for (const [kind, [names, mw, mh]] of Object.entries(NEED)) {
    for (const n of names) assert.ok(C.frameNames(kind).includes(n), `${kind}/${n} is missing`)
    for (const n of C.frameNames(kind)) {
      const f = C.frame(kind, n), id = kind + '/' + n
      assert.ok(f.w <= mw && f.h <= mh, `${id} is ${f.w}x${f.h}, more than ${mw}x${mh}`)
      assert.equal(f.rows.length, f.h)
      for (const r of f.rows) {
        assert.equal(r.length, f.w, `${id}: ragged row`)
        for (const ch of r) assert.ok(ch === '.' || C.KINDS[kind].pal[ch], `${id}: colour ${ch}`)
      }
      assert.ok(Number.isInteger(f.ax) && f.ax >= 0 && f.ax < f.w, `${id}: ax ${f.ax}`)
      if (!FLOATING.includes(id)) assert.match(f.rows[f.h - 1], /[^.]/, `${id}: nothing touches the ground`)
      assert.equal(C.frame(kind, n), f, 'kept')
    }
  }
})

test('the two steps of a walk differ', () => {
  for (const [k, a, b] of [['reindeer', 'walk1', 'walk2'], ['elf', 'walk1', 'walk2'], ['elf', 'carry1', 'carry2'],
    ['penguin', 'waddle1', 'waddle2'], ['santa', 'sit', 'wave']])
    assert.notDeepEqual(C.frame(k, a).rows, C.frame(k, b).rows, `${k} ${a}/${b}`)
})

test('an unknown kind or frame is null', () => {
  assert.equal(C.frame('reindeer', 'x'), null)
  assert.equal(C.frame('cat', 'stand'), null)
})

test("the reindeer's nose is a palette letter of its own, and Rudolph's is red", () => {
  assert.equal(C.KINDS.reindeer.pal.n, '#5a3a26')
  assert.deepEqual(C.RUDOLPH, { n: '#ff4d4d' })
  for (const n of C.frameNames('reindeer'))
    assert.equal(C.frame('reindeer', n).rows.join('').split('n').length - 1, 1, `${n}: one nose pixel`)
})
