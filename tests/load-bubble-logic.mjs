// Runs the page's <script id="bubble-logic"> block the way the browser does (as a plain script that sets
// globalThis.BubbleLogic), so when bubbles speak and fade can be tested without a DOM.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const PAGE = new URL('../claude-office.html', import.meta.url)

export function loadBubbleLogic() {
  const html = readFileSync(PAGE, 'utf8')
  const match = /<script id="bubble-logic">([\s\S]*?)<\/script>/.exec(html)
  if (!match) throw new Error('claude-office.html has no <script id="bubble-logic"> block')
  vm.runInThisContext(match[1], { filename: 'claude-office.html#bubble-logic' })
  return globalThis.BubbleLogic
}
