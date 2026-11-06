// Runs the page's translation tables (web/i18n/<lang>.js) and then web/i18n.js in this realm, so code that calls the
// global tr() can be tested. The language is pinned (Vietnamese by default, the source language) and not saved,
// because Node exposes navigator.language and would otherwise pick the machine's language.
import { runWeb, pageScripts } from './web.mjs'

export function loadI18n(lang = 'vi') {
  for (const name of pageScripts().filter(n => n.startsWith('i18n/'))) runWeb(name)
  runWeb('i18n')
  globalThis.I18n.setLang(lang, { persist: false })
  return globalThis.I18n
}
