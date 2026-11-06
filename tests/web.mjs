// The page's code lives in web/ as ES modules; claude-office.html loads web/main.js, which imports the rest.
// Tests import a module directly (require() of an ES module, Node 22.12+), so a test sees the same exports the page
// uses and one shared instance per module, as in the browser.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
export const PAGE = new URL('../claude-office.html', import.meta.url)
const WEB = new URL('../web/', import.meta.url)

// name is the path inside web/ without .js, e.g. 'sky-logic' or 'i18n/vi'.
export const readWeb = name => readFileSync(new URL(name + '.js', WEB), 'utf8')
export const loadWeb = name => require(new URL(name + '.js', WEB).pathname)

// Every module the page loads, starting at main.js and following static imports, in first-seen order.
export function moduleGraph() {
  const seen = []
  const visit = name => {
    if (seen.includes(name)) return
    seen.push(name)
    const dir = name.includes('/') ? name.slice(0, name.lastIndexOf('/') + 1) : ''
    for (const m of readWeb(name).matchAll(/^import (?:[^'"]* from )?'\.\/([^']+)\.js';$/gm)) {
      const parts = (dir + m[1]).split('/'), out = []
      for (const p of parts) if (p === '..') out.pop(); else if (p !== '.') out.push(p)
      visit(out.join('/'))
    }
  }
  const entry = /<script type="module" src="web\/([a-z0-9/-]+)\.js"><\/script>/.exec(readFileSync(PAGE, 'utf8'))
  if (!entry) throw new Error('claude-office.html has no module entry under web/')
  visit(entry[1])
  return seen
}
