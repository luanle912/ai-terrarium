// Keeps web/ easy to read and review: modules stay short, lines stay within the Prettier width
// (run `npx prettier@3.3.3 --write web` after editing). The translation tables are data and are left out.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const WEB = new URL('../web/', import.meta.url)
const MAX_LINES = 700, MAX_WIDTH = 120

function files(dir = WEB, rel = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? (e.name === 'i18n' ? [] : files(new URL(e.name + '/', dir), rel + e.name + '/'))
    : /\.(js|css)$/.test(e.name) ? [rel + e.name] : [])
}
const read = f => readFileSync(new URL(f, WEB), 'utf8')

test(`every web/ module is at most ${MAX_LINES} lines`, () => {
  const long = files().map(f => [f, read(f).split('\n').length]).filter(([, n]) => n > MAX_LINES)
  assert.deepEqual(long.map(([f, n]) => `${f}: ${n} lines`), [])
})

test(`no line in web/ is wider than ${MAX_WIDTH} characters`, () => {
  const wide = files().flatMap(f => read(f).split('\n').map((l, i) => [`${f}:${i + 1}`, l.length]).filter(([, n]) => n > MAX_WIDTH))
  assert.deepEqual(wide.map(([at, n]) => `${at}: ${n} characters`), [])
})
