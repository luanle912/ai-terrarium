// Runs the page's <script id="people-logic"> block the way the browser does (as a plain script that sets
// globalThis.PeopleLogic), so who an agent looks like can be tested without a DOM.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const PAGE = new URL('../claude-office.html', import.meta.url)

export function loadPeopleLogic() {
  const html = readFileSync(PAGE, 'utf8')
  const match = /<script id="people-logic">([\s\S]*?)<\/script>/.exec(html)
  if (!match) throw new Error('claude-office.html has no <script id="people-logic"> block')
  vm.runInThisContext(match[1], { filename: 'claude-office.html#people-logic' })
  return globalThis.PeopleLogic
}
