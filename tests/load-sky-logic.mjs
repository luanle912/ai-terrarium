// Runs web/sky-logic.js the way the browser does (as a plain script that sets
// globalThis.SkyLogic), so the pure sky/island/weather logic can be tested without a DOM.
// It runs in this realm, not a fresh vm context, so its objects compare equal to plain test literals.
// The weather messages go through tr(), so the i18n blocks load first, pinned to Vietnamese.
import { runWeb } from './web.mjs'
import { loadI18n } from './load-i18n.mjs'

export function loadSkyLogic() {
  loadI18n('vi')
  runWeb('sky-logic')
  return globalThis.SkyLogic
}
