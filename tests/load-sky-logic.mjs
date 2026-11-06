// Imports web/sky-logic.js, the module the page uses, so the pure sky/island/weather logic can be tested without a DOM.
// The weather messages go through tr(), so the language is pinned to Vietnamese first.
import { loadWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

export function loadSkyLogic() {
  loadI18n('vi')
  return loadWeb('sky-logic').SkyLogic
}
