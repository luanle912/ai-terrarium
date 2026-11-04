// Runs the page's <script id="camera-logic"> block the way the browser does (as a plain script that sets
// globalThis.CameraLogic), so the pan/zoom maths can be tested without a DOM.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const PAGE = new URL('../claude-office.html', import.meta.url)

export function loadCameraLogic() {
  const html = readFileSync(PAGE, 'utf8')
  const match = /<script id="camera-logic">([\s\S]*?)<\/script>/.exec(html)
  if (!match) throw new Error('claude-office.html has no <script id="camera-logic"> block')
  vm.runInThisContext(match[1], { filename: 'claude-office.html#camera-logic' })
  return globalThis.CameraLogic
}
