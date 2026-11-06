// The page's code lives in web/ as plain (classic) scripts that share globals, loaded by claude-office.html in order.
// Tests run a file the way the browser does: in this realm by default (so its objects compare equal to plain test
// literals), or in a given context.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

export const PAGE = new URL('../claude-office.html', import.meta.url)
const WEB = new URL('../web/', import.meta.url)

// name is the path inside web/ without .js, e.g. 'sky-logic' or 'i18n/vi'.
export const readWeb = name => readFileSync(new URL(name + '.js', WEB), 'utf8')

export function runWeb(name, ctx) {
  const code = readWeb(name), filename = `web/${name}.js`
  return ctx ? vm.runInNewContext(code, ctx, { filename }) : vm.runInThisContext(code, { filename })
}

// The scripts claude-office.html loads from web/, in page order.
export const pageScripts = () => [...readFileSync(PAGE, 'utf8').matchAll(/<script src="web\/([a-z0-9/-]+)\.js"><\/script>/g)].map(m => m[1])
