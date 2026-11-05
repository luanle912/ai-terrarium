// Runs the page's <script id="restroom-logic"> block the way the browser does (as a plain script that sets
// globalThis.RestroomLogic), so the restroom's layout and the length of a visit can be tested without a DOM.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const PAGE = new URL('../claude-office.html', import.meta.url)

export function loadRestroomLogic() {
  const html = readFileSync(PAGE, 'utf8')
  const match = /<script id="restroom-logic">([\s\S]*?)<\/script>/.exec(html)
  if (!match) throw new Error('claude-office.html has no <script id="restroom-logic"> block')
  vm.runInThisContext(match[1], { filename: 'claude-office.html#restroom-logic' })
  return globalThis.RestroomLogic
}
