// Runs web/world-logic.js the way the browser does (as a plain script that sets
// globalThis.WorldLogic), so the 8-slot sky layout, hit-testing and cloud-timeline maths can be tested without a DOM.
import { runWeb } from './web.mjs'

export function loadWorldLogic() {
  runWeb('world-logic')
  return globalThis.WorldLogic
}
