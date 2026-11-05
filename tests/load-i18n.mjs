// Runs the page's i18n blocks (<script id="i18n-strings"> then <script id="i18n">) in this realm, so blocks that
// call the global tr() can be tested. The language is pinned (Vietnamese by default, the source language) and not
// saved, because Node exposes navigator.language and would otherwise pick the machine's language.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const PAGE = new URL('../claude-office.html', import.meta.url)

export function readBlock(html, id) {
  const match = new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`).exec(html)
  if (!match) throw new Error(`claude-office.html has no <script id="${id}"> block`)
  return match[1]
}

export function loadI18n(lang = 'vi') {
  const html = readFileSync(PAGE, 'utf8')
  for (const id of ['i18n-strings', 'i18n']) vm.runInThisContext(readBlock(html, id), { filename: `claude-office.html#${id}` })
  globalThis.I18n.setLang(lang, { persist: false })
  return globalThis.I18n
}
