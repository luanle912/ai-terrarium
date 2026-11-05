// Runs the page's <script id="dog-logic"> and <script id="dog-sprites"> blocks the way the browser does (plain
// scripts that set globalThis.DogLogic / globalThis.DogSprites), so the dogs' behaviour and pixels can be tested
// without a DOM.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const PAGE = new URL('../claude-office.html', import.meta.url)

function run(id) {
  const html = readFileSync(PAGE, 'utf8')
  const match = new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`).exec(html)
  if (!match) throw new Error(`claude-office.html has no <script id="${id}"> block`)
  vm.runInThisContext(match[1], { filename: `claude-office.html#${id}` })
}

export function loadDogLogic() { run('dog-logic'); return globalThis.DogLogic }
export function loadDogSprites() { run('dog-sprites'); return globalThis.DogSprites }
