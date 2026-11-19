// Who wears what at Christmas (web/outfit-logic.js): one outfit per session id, the same on every machine.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { loadWeb, readWeb } from './web.mjs'

const { OutfitLogic: O } = loadWeb('outfit-logic')
const { Theme } = loadWeb('theme')
// The look (web/theme.js) on a day of the Christmas event, and the winter look with no event.
const xmas = (since = 0) => Theme.resolve({ season: 'winter', holiday: null, event: { key: 'christmas', since }, key: 'ol-x' + since })
const PLAIN = Theme.resolve({ season: 'winter', holiday: null, event: null, key: 'ol-w' })
const DEPT = '#3e8ed0'
const sids = n => Array.from({ length: n }, (_, i) => 'sess-' + ((i * 2654435761) >>> 0).toString(16) + '-' + i)

test('nobody dresses up outside the event', () => {
  for (const look of [null, PLAIN]) {
    assert.equal(O.outfit('abc', look, false, DEPT), null)
    assert.equal(O.outfit('abc', look, true, DEPT), null)
  }
})

test('the same session always gets the same outfit', () => {
  const first = O.outfit('abc-123', xmas(14), false, DEPT)
  for (let i = 0; i < 100; i++) assert.deepEqual(O.outfit('abc-123', xmas(14), false, DEPT), first)
  assert.deepEqual(O.outfit('abc-123', xmas(0), false, DEPT), first, 'day 0 and day 14 agree')
})

test('a thousand sessions spread over the five outfits, 15 to 25 % each', () => {
  const n = Object.fromEntries(O.KINDS.map(k => [k, 0]))
  for (const s of sids(1000)) n[O.outfit(s, xmas(), false, DEPT).kind]++
  assert.deepEqual(Object.keys(n).sort(), [...O.KINDS].sort())
  for (const k of O.KINDS) assert.ok(n[k] >= 150 && n[k] <= 250, `${k}: ${n[k]}`)
})

test('a sub-agent is always an elf, on every day of the event', () => {
  for (const d of [0, 7, 14])
    for (const s of sids(50)) {
      const o = O.outfit(s, xmas(d), true, DEPT)
      assert.equal(o.kind, 'elf')
      assert.equal(o.hat, 'elf')
      assert.equal(o.top, '#2f8f4e')
      assert.notEqual(o.scarf, DEPT)
    }
})

test('outfit under christmas is a full outfit for every sid (no \'hat\' kind)', () => {
  for (const s of sids(300)) {
    const o = O.outfit(s, xmas(0), false, DEPT)
    assert.notEqual(o.kind, 'hat')
    assert.ok(O.KINDS.includes(o.kind), o.kind)
    assert.match(o.top, /^#[0-9a-f]{6}$/)
    assert.match(o.scarf, /^#[0-9a-f]{6}$/)
    assert.ok(O.HATS.includes(o.hat))
  }
})

test('every main agent under christmas keeps the department colour as a scarf', () => {
  for (const dept of ['#3e8ed0', '#e5484d', '#46a758'])
    for (const s of sids(200)) {
      const o = O.outfit(s, xmas(), false, dept)
      assert.equal(o.scarf, dept)
      assert.match(o.scarfD, /^#[0-9a-f]{6}$/)
      assert.match(o.top, /^#[0-9a-f]{6}$/)
      assert.ok(O.HATS.includes(o.hat), o.hat)
      if (o.kind === 'coat') assert.equal(o.top, dept)
    }
})

test('a missing or odd department colour never breaks an outfit', () => {
  for (const c of [undefined, null, '', 'red', '#fff']) {
    const o = O.outfit('abc', xmas(), false, c)
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

test("outfit memo resets when look.of('outfit.agent') changes", () => {
  const a = { sid: 'abc-123', shirt: DEPT, parent: null }
  assert.equal(outfitOf(a, null), null)
  assert.equal(outfitOf(a, PLAIN), null)
  assert.equal(shirtOf(a), DEPT)
  const full = outfitOf(a, xmas(0))
  assert.ok(O.KINDS.includes(full.kind), 'the full outfit from day 0')
  assert.equal(outfitOf(a, xmas(0)), full, 'kept, not rebuilt every frame')
  assert.equal(outfitOf(a, xmas(14)), full, 'a later day with the same variant keeps it')
  assert.equal(shirtOf(a), full.top)
  assert.equal(outfitOf(a, PLAIN), null, 'the event ends: back to plain clothes')
  assert.equal(shirtOf(a), DEPT)
  // a look that only says the variant: the memo follows the variant, nothing else
  let v = 'xmas'
  const fake = { of: id => (id === 'outfit.agent' ? v : 'team') }
  assert.equal(outfitOf(a, fake).kind, full.kind)
  v = 'team'
  assert.equal(outfitOf(a, fake), null)
})

test('a snapshot for a leaving scene keeps the outfit it was taken with', () => {
  const a = { sid: 'abc-123', shirt: DEPT, parent: null }
  const o = outfitOf(a, xmas())
  const copy = { ...a, outfitPin: true }
  assert.equal(outfitOf(copy, PLAIN), o, 'the event ending mid-scene does not undress them')
})

test('someone who turns out to be a sub-agent after their first frame becomes an elf', () => {
  const a = { sid: 'abc-123', shirt: DEPT, parent: null }
  assert.notEqual(outfitOf(a, xmas()).kind, 'elf')
  a.parent = 7
  assert.equal(outfitOf(a, xmas()).kind, 'elf')
  const copy = { ...a }
  assert.equal(outfitOf(copy, xmas()), a.outfit, 'a copy for a leaving scene keeps the same outfit')
})

test('every hat is at most 4 rects and every scarf at most 2, on whole pixels, for both head widths', () => {
  const kits = [...sids(300).map(s => O.outfit(s, xmas(), false, DEPT)), O.outfit('s', xmas(), true, DEPT)]
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
  const o = sids(300).map(s => O.outfit(s, xmas(), false, DEPT)).find(k => k.hat === 'muffs')
  const rects = []
  XMAS.hatEvent((x, y, w, h) => rects.push([x, y, w, h]), o, 100, 50)
  const [band, ...pads] = rects
  for (const p of pads) assert.ok(p[1] <= band[1] + band[3], 'pad starts at the row under the band')
})

test('breath in the cold: a puff for under a second every three, each person in their own time', () => {
  const { breathAt } = loadWeb('office-people-xmas')
  const run = id => Array.from({ length: 300 }, (_, i) => breathAt(i * 0.03, id))
  const a = run(1)
  assert.ok(a.every(k => k === 0 || k === 1 || k === 2))
  const share = a.filter(k => k > 0).length / a.length
  assert.ok(share > 0.2 && share < 0.4, `${share} of the time`)
  assert.ok(a.includes(1) && a.includes(2))
  assert.notDeepEqual(run(2), a, 'out of step with the next person')
  assert.equal(breathAt(NaN, 1), 0)
  const drawn = []
  XMAS.breath((x, y, w, h, c) => drawn.push([x, y, w, h, c]), 0, 10, 20)
  assert.equal(drawn.length, 0)
  XMAS.breath((x, y, w, h, c) => drawn.push([x, y, w, h, c]), 1, 10, 20)
  assert.equal(drawn.length, 2)
  assert.ok(drawn.every(d => d[2] === 1 && d[3] === 1))
})

test('outdoors is the lawn: not the office floor, not the restroom block', () => {
  globalThis.React ??= { createElement: () => null }
  const { outdoors, WC, W, H } = loadWeb('office-scene')
  assert.equal(outdoors(5.5, 5.5), false)
  assert.equal(outdoors(12.5, 20.5), true)
  assert.equal(outdoors(-2.5, 9.5), true)
  assert.equal(outdoors(WC.x0 + 1.5, WC.y0 + 1.5), false)
  assert.equal(outdoors(W + 8.5, H + 3.5), true)
})

test('under a hat that covers the head a baseball cap gives way to plain cropped hair', () => {
  const { lookUnder } = loadWeb('office-people-xmas')
  const cap = { hairStyle: 'cap', hair: '#3b2a20' }, long = { hairStyle: 'long', hair: '#3b2a20' }
  for (const hat of ['santa', 'beanie', 'tophat', 'elf']) {
    const l = lookUnder(cap, { hat })
    assert.equal(l.hairStyle, 'crop', hat)
    assert.equal(l.hair, cap.hair)
    assert.equal(lookUnder(cap, { hat }), l, 'made once')
  }
  assert.equal(cap.hairStyle, 'cap', 'the look itself is left alone')
  for (const hat of ['muffs', 'antlers']) assert.equal(lookUnder(cap, { hat }), cap, hat)
  assert.equal(lookUnder(cap, null), cap)
  assert.equal(lookUnder(long, { hat: 'santa' }), long)
})

test('snow at night is moonlit blue, not grey, and unchanged by day', () => {
  const { SnowLogic: SL } = loadWeb('snow-logic')
  const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
  assert.equal(SL.night(SL.PAL.base, 1), SL.PAL.base)
  const [r, g, b] = rgb(SL.night(SL.PAL.base, 0))
  assert.ok(b - r >= 30, `blue ${b} against red ${r}`)
  assert.ok(g > r && b > g)
  assert.ok(r > 110 && r < 170, 'still pale, so the island reads at night')
})

// ---- one outfit in every pose (spec §2.3), one elf, one dog costume ----

const kitOf = kind => [...sids(300).map(s => O.outfit(s, xmas(), false, DEPT)), O.outfit('s', xmas(), true, DEPT)]
  .find(o => o.kind === kind)

test('the pattern fits any torso box: standing is unchanged, the seated and bath boxes clip to themselves', () => {
  for (const kind of [...O.KINDS, 'elf']) {
    const o = kitOf(kind)
    for (const front of [true, false]) {
      const a = [], b = []
      XMAS.top((...r) => a.push(r), o, 50, 80, front)
      XMAS.pattern((...r) => b.push(r), o, 46, 69, 8, 7, front)
      assert.deepEqual(a, b, `${kind}: the standing top is the pattern on the standing box`)
    }
    for (const [x0, y0, w, h, front] of [[45, 69, 10, 8, false], [46, 75, 8, 4, true]]) {
      const rects = []
      XMAS.pattern((...r) => rects.push(r), o, x0, y0, w, h, front)
      for (const [x, y, ww, hh] of rects)
        assert.ok(x >= x0 && x + ww <= x0 + w && y >= y0 && y + hh <= y0 + h, `${kind}: ${[x, y, ww, hh]} in ${[x0, y0, w, h]}`)
    }
    const seat = []
    XMAS.pattern((...r) => seat.push(r), o, 45, 69, 10, 8, false)
    if (kind !== 'reindeer' && kind !== 'snowman') assert.ok(seat.length > 0, `${kind}: seen from behind at the desk`)
  }
})

test('asleep the outfit shows: the hat, the scarf and the pattern', () => {
  for (const kind of [...O.KINDS, 'elf']) {
    const o = kitOf(kind), boxes = []
    XMAS.hatSleep((...b) => boxes.push(b), o, 10, 20)
    assert.equal(boxes[0][6], o.hat === 'muffs' ? o.top : o.hatColor, `${kind}: hat`)
    XMAS.sleep((...b) => boxes.push(b), o, 10, 20, 0)
    const cols = boxes.slice(1).map(b => b[6])
    assert.equal(cols[0], o.kind === 'coat' ? o.trim : o.scarf, `${kind}: scarf`)
    assert.ok(boxes.length >= 3 && boxes.length <= 4, `${kind}: ${boxes.length} boxes`)
  }
})

test('every pose of drawPerson, the sleeper and the faller draws the full outfit', () => {
  const people = readWeb('office-draw-people'), fall = readWeb('office-draw-fall'), fate = readWeb('office-draw-fate')
  const bath = people.slice(people.indexOf("a.actNow === 'bath') {"), people.indexOf('if (!a.seated) {'))
  assert.match(bath, /XMAS\.pattern\(/, 'bathing: the pattern')
  assert.match(bath, /XMAS\.scarf\(/, 'bathing: the scarf')
  assert.match(bath, /XMAS\.hatEvent\(/, 'bathing: the hat')
  const seat = people.slice(people.indexOf('if (a.seated) {'), people.indexOf('} else {\n        const sit ='))
  for (const f of ['pattern', 'scarf', 'hatEvent']) assert.match(seat, new RegExp('XMAS\\.' + f + '\\('), 'seated: ' + f)
  assert.match(people, /XMAS\.hatSleep\(/, 'asleep: the hat')
  assert.match(people, /XMAS\.sleep\(/, 'asleep: the scarf and the pattern')
  for (const f of ['pattern', 'scarf', 'hatEvent']) assert.match(fall, new RegExp('XMAS\\.' + f + '\\('), 'falling: ' + f)
  assert.match(fall, /outfitOf\(a, this\.look\)/)
  assert.match(fate, /outfitPin: true/, 'a fate keeps the outfit it was taken with')
  for (const src of [people, fall, fate]) assert.doesNotMatch(src, /outfitOf\([^)]*(ev|eventNow)/)
})

test('sub-agent and critter elf share the same palette', () => {
  const { CritterSprites: C } = loadWeb('critter-sprites')
  const E = XMAS.elf, pal = C.KINDS.elf.pal, sub = O.outfit('s', xmas(), true, DEPT)
  assert.equal(E, O.ELF, 'one palette object')
  assert.equal(sub.top, E.coat)
  assert.equal(sub.hatColor, E.coat)
  assert.equal(sub.hatTrim, E.bell)
  assert.equal(sub.scarf, E.trim)
  assert.equal(sub.scarfD, E.trimD)
  assert.equal(pal.g, E.coat)
  assert.equal(pal.G, E.coatD)
  assert.equal(pal.r, E.trim)
  assert.equal(pal.R, E.trimD)
  assert.equal(pal.y, E.bell)
  assert.equal(pal.b, E.belt)
  // the same pattern: a scarf under the face, a belt with a gold buckle
  const walk = C.KINDS.elf.frames.walk1
  assert.ok(walk.some(r => /byyb/.test(r)), 'the belt and its buckle')
  assert.ok(walk.some(r => /^\.rrrr/.test(r) && walk.indexOf(r) > walk.findIndex(q => /k/.test(q) && /s/.test(q))), 'the scarf')
  const belt = []
  XMAS.pattern((...r) => belt.push(r), sub, 46, 69, 8, 7, true)
  assert.ok(belt.some(r => r[4] === E.belt) && belt.some(r => r[4] === E.buckle))
})

test('dog sprite key contains the costume variant, not a boolean', () => {
  const { DogXmas } = loadWeb('dog-sprites-xmas')
  const k = c => DogXmas.key('corgi', 'stand', 10, 0, c)
  assert.ok(k('xmas').endsWith('/xmas'))
  assert.ok(k('none').endsWith('/none'))
  assert.notEqual(k('xmas'), k('none'))
  assert.equal(DogXmas.dressed('xmas'), true)
  assert.equal(DogXmas.dressed('none'), false)
  const src = readWeb('office-draw-people')
  const body = src.slice(src.indexOf('dogSprite(breed'), src.indexOf('drawDog(G'))
  assert.match(body, /DogXmas\.key\(/)
  assert.doesNotMatch(body, /level|'\/x'/)
  assert.match(src, /dogSprite\([^)]*look\.of\('dog\.costume'\)\)/)
  assert.match(readWeb('office-draw-doghouse'), /look\.of\('dog\.costume'\)/)
})
