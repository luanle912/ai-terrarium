// Runs the page's <script id="sky-logic"> block the way the browser does (as a plain script that sets
// globalThis.SkyLogic), so the pure sky/island/weather logic can be tested without a DOM.
// It runs in this realm, not a fresh vm context, so its objects compare equal to plain test literals.
// The weather messages go through tr(), so the i18n blocks load first, pinned to Vietnamese.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { loadI18n } from './load-i18n.mjs'

const PAGE = new URL('../claude-office.html', import.meta.url)

export function loadSkyLogic() {
  loadI18n('vi')
  const html = readFileSync(PAGE, 'utf8')
  const match = /<script id="sky-logic">([\s\S]*?)<\/script>/.exec(html)
  if (!match) throw new Error('claude-office.html has no <script id="sky-logic"> block')
  vm.runInThisContext(match[1], { filename: 'claude-office.html#sky-logic' })
  return globalThis.SkyLogic
}
