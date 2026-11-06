// Imports web/people-logic.js, the module the page uses, so who an agent looks like can be tested without a DOM.
import { loadWeb } from './web.mjs'

export function loadPeopleLogic() {
  return loadWeb('people-logic').PeopleLogic
}
