// Imports web/bubble-logic.js, the module the page uses, so when bubbles speak and fade can be tested without a DOM.
import { loadWeb } from './web.mjs'

export function loadBubbleLogic() {
  return loadWeb('bubble-logic').BubbleLogic
}
