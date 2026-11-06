// Runs web/restroom-logic.js the way the browser does (as a plain script that sets
// globalThis.RestroomLogic), so the restroom's layout and the length of a visit can be tested without a DOM.
import { runWeb } from './web.mjs'

export function loadRestroomLogic() {
  runWeb('restroom-logic')
  return globalThis.RestroomLogic
}
