import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { loadI18n, readBlock } from './load-i18n.mjs'

const HTML = readFileSync(new URL('../claude-office.html', import.meta.url), 'utf8')
const I18n = loadI18n('vi')
const STRINGS = globalThis.I18N_STRINGS
const LANGS = I18n.CODES
const params = v => (Array.isArray(v) ? v.join('\n') : String(v)).match(/\{\w+\}/g)?.sort() ?? []
// Case-insensitive so all-caps labels such as 'MỨC CHIA SẺ' are caught too.
const VI_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu

// ---- lookup ----

test('tr fills params, falls back to English, then Vietnamese, then shows the key', () => {
  const saved = JSON.parse(JSON.stringify(STRINGS))
  try {
    STRINGS.vi['t.both'] = 'Xin chào {name}'; STRINGS.en['t.both'] = 'Hello {name}'
    STRINGS.vi['t.viOnly'] = 'Chỉ tiếng Việt'
    I18n.setLang('ja', { persist: false })
    assert.equal(globalThis.tr('t.both', { name: 'An' }), 'Hello An')
    assert.equal(globalThis.tr('t.viOnly'), 'Chỉ tiếng Việt')
    assert.equal(globalThis.tr('t.nowhere'), 't.nowhere')
    assert.equal(globalThis.tr('t.both', {}), 'Hello {name}', 'an unknown param stays visible')
  } finally {
    for (const l of LANGS) STRINGS[l] = saved[l]
    I18n.setLang('vi', { persist: false })
  }
})

test('detect prefers ?lang=, then the saved choice, then the browser languages by prefix, else English', () => {
  const store = v => ({ getItem: () => v })
  assert.equal(I18n.detect(store('ko'), ['vi'], '?lang=ja'), 'ja')
  assert.equal(I18n.detect(store('ko'), ['vi'], '?lang=xx'), 'ko')
  assert.equal(I18n.detect(store('ko'), ['vi']), 'ko')
  assert.equal(I18n.detect(store('xx'), ['es-MX']), 'es')
  assert.equal(I18n.detect(null, ['zh-TW', 'en']), 'zh')
  assert.equal(I18n.detect(null, ['de-DE', 'fr']), 'en')
  assert.equal(I18n.detect({ getItem: () => { throw new Error('blocked') } }, ['ja']), 'ja')
})

test('setLang rejects unknown codes and keeps the current language', () => {
  assert.equal(I18n.setLang('xx', { persist: false }), false)
  assert.equal(I18n.lang, 'vi')
  assert.equal(I18n.setLang('en', { persist: false }), 'applied', 'not saved when persist is off')
  assert.equal(I18n.lang, 'en')
  I18n.setLang('vi', { persist: false })
})

// ---- tables ----

test('every language has exactly the Vietnamese keys, with the same params and shape', () => {
  const keys = Object.keys(STRINGS.vi).sort()
  assert.ok(keys.length > 50, 'the Vietnamese table is filled')
  for (const l of LANGS) {
    assert.deepEqual(Object.keys(STRINGS[l]).sort(), keys, `${l} has the same keys as vi`)
    for (const k of keys) {
      const v = STRINGS[l][k], src = STRINGS.vi[k]
      assert.equal(Array.isArray(v), Array.isArray(src), `${l}.${k} has the same shape as vi`)
      if (Array.isArray(src)) assert.equal(v.length, src.length, `${l}.${k} has as many items as vi`)
      assert.deepEqual(params(v), params(src), `${l}.${k} keeps the params of vi`)
      assert.ok((Array.isArray(v) ? v : [v]).every(s => typeof s === 'string' && s.trim()), `${l}.${k} is not empty`)
    }
  }
})

test('every tr() key used in the page exists in the tables, and every table key is used', () => {
  const code = HTML.replace(readBlock(HTML, 'i18n-strings'), '')
  const used = new Set([...code.matchAll(/\btr\(\s*'([^']+)'/g)].map(m => m[1]))
  const known = new Set(Object.keys(STRINGS.vi))
  assert.deepEqual([...used].filter(k => !known.has(k)), [], 'keys used but not defined')
  assert.deepEqual([...known].filter(k => !used.has(k)), [], 'keys defined but never used')
})

// ---- no hard-coded Vietnamese left ----

// Strips // and /* */ comments well enough for this check (it ignores comment markers inside strings).
const stripComments = line => line.replace(/\/\*.*?\*\//g, '').replace(/(^|[\s;,{}()])\/\/.*$/, '$1')

// The season, decor and pantry catalogues (before sky-logic) keep Vietnamese design notes that the page never shows.
const DESIGN_NOTES = /\b(tree|desc|window|name|group|note):'[^']*'|S\.window='[^']*'/g

test('no Vietnamese text is hard-coded in the page outside the translation tables', () => {
  let rest = HTML.replace(readBlock(HTML, 'i18n-strings'), '').replace(readBlock(HTML, 'i18n'), '')
  const cut = rest.indexOf('<script id="sky-logic">')
  rest = rest.slice(0, cut).replace(DESIGN_NOTES, '') + rest.slice(cut)
  const hits = rest.split('\n').map((l, i) => [i + 1, stripComments(l)]).filter(([, l]) => VI_CHARS.test(l))
  assert.deepEqual(hits.map(([n, l]) => `${n}: ${l.trim().slice(0, 120)}`), [])
})
