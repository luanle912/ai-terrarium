// Imports web/smoke-logic.js, the module the page uses, so the smoking corner's layout and timing can be tested without a DOM.
import { loadWeb } from './web.mjs'

export function loadSmokeLogic() {
  return loadWeb('smoke-logic').SmokeLogic
}
