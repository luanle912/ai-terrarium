// Imports web/animal-walk.js (which imports web/dog-logic.js), the modules the page uses, so the animals' walking can
// be tested without a DOM.
import { loadWeb } from './web.mjs'

export function loadAnimalWalk() { return loadWeb('animal-walk').AnimalWalk }
