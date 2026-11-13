// Imports web/animal-sprites.js, the module the page uses, so the animals' pixels can be tested without a DOM.
import { loadWeb } from './web.mjs'

export function loadAnimalSprites() { return loadWeb('animal-sprites').AnimalSprites }
