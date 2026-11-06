// Imports web/world-logic.js, the module the page uses, so the 8-slot sky layout, hit-testing and cloud-timeline maths can be tested without a DOM.
import { loadWeb } from './web.mjs'

export function loadWorldLogic() {
  return loadWeb('world-logic').WorldLogic
}
