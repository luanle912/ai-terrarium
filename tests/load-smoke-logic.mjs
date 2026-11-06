// Runs web/smoke-logic.js the way the browser does (as a plain script that sets
// globalThis.SmokeLogic), so the smoking corner's layout and timing can be tested without a DOM.
import { runWeb } from './web.mjs'

export function loadSmokeLogic() {
  runWeb('smoke-logic')
  return globalThis.SmokeLogic
}
