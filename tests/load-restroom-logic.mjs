// Imports web/restroom-logic.js, the module the page uses, so the restroom's layout and the length of a visit can be tested without a DOM.
import { loadWeb } from './web.mjs'

export function loadRestroomLogic() {
  return loadWeb('restroom-logic').RestroomLogic
}
