// Runs web/bubble-logic.js the way the browser does (as a plain script that sets
// globalThis.BubbleLogic), so when bubbles speak and fade can be tested without a DOM.
import { runWeb } from './web.mjs'

export function loadBubbleLogic() {
  runWeb('bubble-logic')
  return globalThis.BubbleLogic
}
