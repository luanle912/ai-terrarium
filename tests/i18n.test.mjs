import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs, { readFileSync } from 'node:fs'

import { loadI18n } from './load-i18n.mjs'
import { PAGE, readWeb, loadWeb, moduleGraph } from './web.mjs'

// The page's own code: the shell plus every web/ script except the translation tables and the lookup itself.
const SOURCES = [['claude-office.html', readFileSync(PAGE, 'utf8')],
  ...moduleGraph().filter(n => n !== 'i18n' && !n.startsWith('i18n/')).map(n => [`web/${n}.js`, readWeb(n)])]
const I18n = loadI18n('vi')
const { I18N_STRINGS: STRINGS, tr } = loadWeb('i18n')
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
    assert.equal(tr('t.both', { name: 'An' }), 'Hello An')
    assert.equal(tr('t.viOnly'), 'Chỉ tiếng Việt')
    assert.equal(tr('t.nowhere'), 't.nowhere')
    assert.equal(tr('t.both', {}), 'Hello {name}', 'an unknown param stays visible')
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
  assert.equal(I18n.detect(null, ['th-TH', 'en']), 'th')
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
  const used = new Set(SOURCES.flatMap(([, code]) => [...code.matchAll(/\btr\(\s*'([^']+)'/g)].map(m => m[1])))
  const known = new Set(Object.keys(STRINGS.vi))
  assert.deepEqual([...used].filter(k => !known.has(k)), [], 'keys used but not defined')
  assert.deepEqual([...known].filter(k => !used.has(k)), [], 'keys defined but never used')
})

// ---- no hard-coded Vietnamese left ----

// Strips // and /* */ comments well enough for this check (it ignores comment markers inside strings).
const stripComments = line => line.replace(/\/\*.*?\*\//g, '').replace(/(^|[\s;,{}()])\/\/.*$/, '$1')

// The season, decor and pantry catalogues keep Vietnamese design notes that the page never shows.
const DESIGN_NOTES = /\b(tree|desc|window|name|group|note):'[^']*'|S\.window='[^']*'/g
const CATALOGUES = new Set(['web/season-tree.js', 'web/office-decor.js', 'web/pantry-items.js'])

test('no Vietnamese text is hard-coded in the page outside the translation tables', () => {
  const hits = SOURCES.flatMap(([file, code]) => (CATALOGUES.has(file) ? code.replace(DESIGN_NOTES, '') : code).split('\n')
    .map((l, i) => [`${file}:${i + 1}`, stripComments(l)]).filter(([, l]) => VI_CHARS.test(l)))
  assert.deepEqual(hits.map(([at, l]) => `${at}: ${l.trim().slice(0, 120)}`), [])
})

test('the page reaches every web/ module from main.js, with one translation table per language', () => {
  const names = moduleGraph()
  const files = []
  const walk = (dir, pre) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (e.isDirectory()) walk(dir + '/' + e.name, pre + e.name + '/'); else if (e.name.endsWith('.js')) files.push(pre + e.name.slice(0, -3)) } }
  walk(new URL('../web', import.meta.url).pathname, '')
  assert.deepEqual([...names].sort(), files.sort(), 'no module left unreachable, none missing')
  assert.deepEqual(names.filter(n => n.startsWith('i18n/')).map(n => n.slice(5)).sort(), [...LANGS].sort(), 'one table per language')
})
