// Runs web/people-logic.js the way the browser does (as a plain script that sets
// globalThis.PeopleLogic), so who an agent looks like can be tested without a DOM.
import { runWeb } from './web.mjs'

export function loadPeopleLogic() {
  runWeb('people-logic')
  return globalThis.PeopleLogic
}
