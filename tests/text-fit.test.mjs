import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadWeb } from './web.mjs'

// Every text that can appear in a bubble (26 columns, 2 of them the emoji prefix of an act label) or in the
// Settings panel (22 columns for the labels in a select or a button) has to fit its box in every language.
const { I18N_STRINGS: STRINGS } = loadWeb('i18n')
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]|\p{Extended_Pictographic}/u
const ZERO = /[\p{M}‍️]/u
export const cols = s => {
  let n = 0
  for (const ch of s) n += ZERO.test(ch) ? 0 : WIDE.test(ch) ? 2 : 1
  return n
}
// {name}/{msg} are filled at run time with a person's name or a tool's words; the fixed words must fit on their own.
const bare = s => s.replace(/\{\w+\}/g, '')

test('cols counts CJK and emoji as two, combining marks as none', () => {
  assert.equal(cols('abc'), 3)
  assert.equal(cols('日本語'), 6)
  assert.equal(cols('🎁 x'), 4)
  assert.equal(cols('ก็'), 1)
})

const LANGS = Object.keys(STRINGS)
const over = (test_, limit, fill = bare) => {
  const bad = []
  for (const lang of LANGS)
    for (const [k, v] of Object.entries(STRINGS[lang]))
      if (test_(k)) {
        const n = cols(fill(String(v))) + (k.startsWith('office.act.') ? 2 : 0)
        if (n > limit) bad.push(`${lang} ${k} ${n}: ${v}`)
      }
  return bad
}

test('bubble texts fit 26 columns in all seven languages', () => {
  assert.equal(LANGS.length, 7)
  const bad = over(k => /^(office\.act\.|bubble\.)/.test(k), 26)
  assert.deepEqual(bad, [])
})

test('Settings event and season labels fit 22 columns in all seven languages', () => {
  const bad = over(k => /^settings\.(event|season)\./.test(k) && !/previewTitle$/.test(k), 22)
  assert.deepEqual(bad, [])
})

test('the preview labels fit 22 columns, the time filled in', () => {
  const bad = over(k => /^settings\.(preview\.|forcedByEvent)/.test(k), 22, s => s.replace('{time}', '0:42'))
  assert.deepEqual(bad, [])
})
