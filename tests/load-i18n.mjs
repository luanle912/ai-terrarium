// Imports web/i18n.js (which imports one table per language) so code that calls tr() can be tested. The language is
// pinned (Vietnamese by default, the source language) and not saved, because Node exposes navigator.language and
// would otherwise pick the machine's language.
import { loadWeb } from './web.mjs'

export function loadI18n(lang = 'vi') {
  const { I18n } = loadWeb('i18n')
  I18n.setLang(lang, { persist: false })
  return I18n
}
