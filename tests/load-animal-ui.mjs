// Imports web/animal-ui.js, the module the page uses, so the pure helpers of the animal UI can be tested without a DOM.
import { loadWeb } from './web.mjs'

export function loadAnimalUI() { return loadWeb('animal-ui').AnimalUI }
