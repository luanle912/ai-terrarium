import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadPeopleLogic } from './load-people-logic.mjs'

const PeopleLogic = loadPeopleLogic()
const sids = n => Array.from({ length: n }, (_, i) => 'sess_' + (i * 7919).toString(36) + '_' + i)
const HEX = /^#[0-9a-f]{6}$/

test('hash: the same string always gives the same unsigned 32-bit number', () => {
  assert.equal(PeopleLogic.hash('abc'), PeopleLogic.hash('abc'))
  assert.notEqual(PeopleLogic.hash('abc'), PeopleLogic.hash('abd'))
  // FNV-1a reference values
  assert.equal(PeopleLogic.hash(''), 0x811c9dc5)
  assert.equal(PeopleLogic.hash('a'), 0xe40c292c)
  for (const s of sids(50)) { const h = PeopleLogic.hash(s); assert.ok(Number.isInteger(h) && h >= 0 && h < 2 ** 32) }
})

test('gender: fixed per session id, so a reload never flips anyone', () => {
  for (const s of sids(100)) {
    const g = PeopleLogic.genderOf(s)
    assert.ok(g === 'm' || g === 'f')
    assert.equal(PeopleLogic.genderOf(s), g)
    assert.equal(PeopleLogic.look(s).gender, g)
  }
})

test('gender: about half men and half women', () => {
  const all = sids(2000).map(PeopleLogic.genderOf)
  const f = all.filter(g => g === 'f').length / all.length
  assert.ok(f > 0.45 && f < 0.55, `women ${Math.round(f * 100)} %`)
  // hashed hub ids (hex) split too
  const hex = Array.from({ length: 400 }, (_, i) => PeopleLogic.hash('hub' + i).toString(16).padStart(8, '0')).map(PeopleLogic.genderOf)
  const hf = hex.filter(g => g === 'f').length / hex.length
  assert.ok(hf > 0.4 && hf < 0.6, `hub ids: women ${Math.round(hf * 100)} %`)
})

test('look: fixed per session id', () => {
  for (const s of sids(50)) assert.deepEqual(PeopleLogic.look(s), PeopleLogic.look(s))
  assert.deepEqual(PeopleLogic.look(42), PeopleLogic.look('42'), 'a bare id works as a fallback key')
})

test('look: styles belong to the gender; women never get a beard, men never a skirt', () => {
  const { STYLE } = PeopleLogic
  for (const s of sids(1000)) {
    const L = PeopleLogic.look(s), S = STYLE[L.gender]
    assert.ok(S.hair.includes(L.hairStyle), `${L.gender} with ${L.hairStyle}`)
    assert.ok(S.top.includes(L.top), `${L.gender} in a ${L.top}`)
    assert.ok(S.acc.includes(L.acc))
    if (L.gender === 'f') assert.equal(L.beard, null)
    else { assert.ok(S.beard.includes(L.beard)); assert.equal(L.bottom, 'pants') }
    if (L.top === 'dress') { assert.equal(L.bottom, 'skirt'); assert.equal(L.legs, null, 'a dress is in the department colour') }
    else assert.match(L.legs, HEX)
    assert.equal(L.layer !== null, L.top === 'jacket' || L.top === 'cardigan', 'only jackets and cardigans have a layer colour')
    for (const c of [L.skin, L.hair, L.shoes, L.layer].filter(Boolean)) assert.match(c, HEX)
  }
})

test('look: every style and colour turns up, and a dozen people look different', () => {
  const looks = sids(3000).map(PeopleLogic.look)
  for (const g of ['m', 'f']) for (const h of PeopleLogic.STYLE[g].hair) assert.ok(looks.some(L => L.gender === g && L.hairStyle === h), `${g} ${h}`)
  for (const b of ['stubble', 'full', 'moustache']) assert.ok(looks.some(L => L.beard === b), b)
  for (const c of PeopleLogic.SKIN) assert.ok(looks.some(L => L.skin === c), c)
  for (const c of PeopleLogic.HAIR) assert.ok(looks.some(L => L.hair === c), c)
  assert.ok(looks.some(L => L.gender === 'f' && L.bottom === 'pants') && looks.some(L => L.gender === 'f' && L.bottom === 'skirt'))
  const twelve = sids(12).map(s => JSON.stringify(PeopleLogic.look(s)))
  assert.ok(new Set(twelve).size >= 10, `only ${new Set(twelve).size} different looks among 12`)
})
