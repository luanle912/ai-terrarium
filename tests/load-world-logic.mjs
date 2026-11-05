// Runs the page's <script id="world-logic"> block the way the browser does (as a plain script that sets
// globalThis.WorldLogic), so the multi-island layout, 8-slot sky, hit-testing, cloud-timeline and world-camera maths can be tested without a DOM.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const PAGE = new URL('../claude-office.html', import.meta.url)

export function loadWorldLogic() {
  const html = readFileSync(PAGE, 'utf8')
  const match = /<script id="world-logic">([\s\S]*?)<\/script>/.exec(html)
  if (!match) throw new Error('claude-office.html has no <script id="world-logic"> block')
  vm.runInThisContext(match[1], { filename: 'claude-office.html#world-logic' })
  return globalThis.WorldLogic
}
