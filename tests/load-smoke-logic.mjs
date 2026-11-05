// Runs the page's <script id="smoke-logic"> block the way the browser does (as a plain script that sets
// globalThis.SmokeLogic), so the smoking corner's layout and timing can be tested without a DOM.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const PAGE = new URL('../claude-office.html', import.meta.url)

export function loadSmokeLogic() {
  const html = readFileSync(PAGE, 'utf8')
  const match = /<script id="smoke-logic">([\s\S]*?)<\/script>/.exec(html)
  if (!match) throw new Error('claude-office.html has no <script id="smoke-logic"> block')
  vm.runInThisContext(match[1], { filename: 'claude-office.html#smoke-logic' })
  return globalThis.SmokeLogic
}
