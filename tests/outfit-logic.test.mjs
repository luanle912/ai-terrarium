// Who wears what at Christmas (web/outfit-logic.js): one outfit per session id, the same on every machine.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { loadWeb } from './web.mjs'

const { OutfitLogic: O } = loadWeb('outfit-logic')
const ev = level => ({ key: 'christmas', level, eve: false, day: false })
const DEPT = '#3e8ed0'
const sids = n => Array.from({ length: n }, (_, i) => 'sess-' + ((i * 2654435761) >>> 0).toString(16) + '-' + i)

test('nobody dresses up outside the event', () => {
  assert.equal(O.outfit('abc', null, false, DEPT), null)
  assert.equal(O.outfit('abc', null, true, DEPT), null)
})

test('the same session always gets the same outfit', () => {
  const first = O.outfit('abc-123', ev(3), false, DEPT)
  for (let i = 0; i < 100; i++) assert.deepEqual(O.outfit('abc-123', ev(3), false, DEPT), first)
  assert.equal(O.outfit('abc-123', ev(2), false, DEPT).kind, first.kind, 'level 2 and 3 agree')
})

test('a thousand sessions spread over the five outfits, 15 to 25 % each', () => {
  const n = Object.fromEntries(O.KINDS.map(k => [k, 0]))
  for (const s of sids(1000)) n[O.outfit(s, ev(3), false, DEPT).kind]++
  assert.deepEqual(Object.keys(n).sort(), [...O.KINDS].sort())
  for (const k of O.KINDS) assert.ok(n[k] >= 150 && n[k] <= 250, `${k}: ${n[k]}`)
})

test('a sub-agent is always an elf, at every level', () => {
  for (const l of [1, 2, 3])
    for (const s of sids(50)) {
      const o = O.outfit(s, ev(l), true, DEPT)
      assert.equal(o.kind, 'elf')
      assert.equal(o.hat, 'elf')
      assert.equal(o.top, '#2f8f4e')
      assert.notEqual(o.scarf, DEPT)
    }
})

test('level 1 is a Santa hat and nothing else', () => {
  for (const s of sids(50)) {
    const o = O.outfit(s, ev(1), false, DEPT)
    assert.equal(o.kind, 'hat')
    assert.equal(o.hat, 'santa')
    assert.equal(o.hatColor, '#c8323a')
    assert.equal(o.top, undefined)
    assert.equal(o.scarf, undefined)
  }
})

test('from level 2 every main agent keeps the department colour as a scarf', () => {
  for (const dept of ['#3e8ed0', '#e5484d', '#46a758'])
    for (const s of sids(200)) {
      const o = O.outfit(s, ev(2), false, dept)
      assert.equal(o.scarf, dept)
      assert.match(o.scarfD, /^#[0-9a-f]{6}$/)
      assert.match(o.top, /^#[0-9a-f]{6}$/)
      assert.ok(O.HATS.includes(o.hat), o.hat)
      if (o.kind === 'coat') assert.equal(o.top, dept)
    }
})

test('a missing or odd department colour never breaks an outfit', () => {
  for (const c of [undefined, null, '', 'red', '#fff']) {
    const o = O.outfit('abc', ev(3), false, c)
    assert.ok(O.KINDS.includes(o.kind))
    assert.match(o.top, /^#[0-9a-f]{6}$/)
    assert.match(o.scarfD, /^#[0-9a-f]{6}$/)
  }
})

test('drawing code reads the top through shirtOf, never the raw department colour', () => {
  const allowed = { 'office-people-xmas.js': 1, 'office-agents.js': 1, 'office-render.js': 1, 'people-logic.js': 1 }
  const bad = []
  for (const f of readdirSync(new URL('../web', import.meta.url)).filter(f => f.endsWith('.js') && !allowed[f]))
    readFileSync(new URL('../web/' + f, import.meta.url), 'utf8').split('\n').forEach((line, i) => {
      if (/\.shirt\b/.test(line)) bad.push(`${f}:${i + 1}`)
    })
  assert.deepEqual(bad, [])
})

// ---- web/office-people-xmas.js: the outfit kept on the agent, and the hat and scarf as rects ----
const { outfitOf, shirtOf, XMAS } = loadWeb('office-people-xmas')

test('the outfit on an agent follows the event: on, a level up, off again', () => {
  const a = { sid: 'abc-123', shirt: DEPT, parent: null }
  assert.equal(outfitOf(a, null), null)
  assert.equal(shirtOf(a), DEPT)
  assert.equal(outfitOf(a, ev(1)).kind, 'hat')
  assert.equal(shirtOf(a), DEPT, 'a hat only: the top stays the department colour')
  const full = outfitOf(a, ev(2))
  assert.ok(O.KINDS.includes(full.kind))
  assert.equal(outfitOf(a, ev(2)), full, 'kept, not rebuilt every frame')
  assert.equal(shirtOf(a), full.top)
  assert.equal(outfitOf(a, null), null, 'the event ends: back to plain clothes')
  assert.equal(shirtOf(a), DEPT)
})

test('someone who turns out to be a sub-agent after their first frame becomes an elf', () => {
  const a = { sid: 'abc-123', shirt: DEPT, parent: null }
  assert.notEqual(outfitOf(a, ev(3)).kind, 'elf')
  a.parent = 7
  assert.equal(outfitOf(a, ev(3)).kind, 'elf')
  const copy = { ...a }
  assert.equal(outfitOf(copy, ev(3)), a.outfit, 'a copy for a leaving scene keeps the same outfit')
})

test('every hat is at most 4 rects and every scarf at most 2, on whole pixels, for both head widths', () => {
  const kits = [...sids(300).map(s => O.outfit(s, ev(3), false, DEPT)), O.outfit('s', ev(3), true, DEPT), O.outfit('s', ev(1), false, DEPT)]
  assert.deepEqual([...new Set(kits.map(k => k.hat))].sort(), [...O.HATS].sort(), 'all six hats met')
  for (const o of kits)
    for (const w of [6, 8]) {
      const rects = []
      const R = (x, y, ww, h, c) => rects.push([x, y, ww, h, c])
      XMAS.hatEvent(R, o, 100, 50, w)
      assert.ok(rects.length >= 3 && rects.length <= 4, `${o.hat}: ${rects.length} rects`)
      const n = rects.length
      XMAS.scarf(R, o, 100, 56, w)
      assert.ok(rects.length - n <= 2)
      for (const [x, y, ww, h, c] of rects) {
        assert.ok([x, y, ww, h].every(Number.isInteger) && ww > 0 && h > 0, `${o.hat} w${w}: ${[x, y, ww, h]}`)
        assert.match(c, /^#[0-9a-f]{6}$/i)
        assert.ok(y + h <= 50 + 4 || rects.indexOf(rects.find(r => r[1] === y)) >= n, `${o.hat}: a hat stays off the face`)
      }
    }
})

test('earmuffs are one piece: each pad touches the band', () => {
  const o = sids(300).map(s => O.outfit(s, ev(3), false, DEPT)).find(k => k.hat === 'muffs')
  const rects = []
  XMAS.hatEvent((x, y, w, h) => rects.push([x, y, w, h]), o, 100, 50)
  const [band, ...pads] = rects
  for (const p of pads) assert.ok(p[1] <= band[1] + band[3], 'pad starts at the row under the band')
})
