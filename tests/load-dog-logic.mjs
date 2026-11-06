// Imports web/dog-logic.js and web/dog-sprites.js, the modules the page uses, so the dogs' behaviour and pixels can be
// tested without a DOM.
import { loadWeb } from './web.mjs'

export function loadDogLogic() { return loadWeb('dog-logic').DogLogic }
export function loadDogSprites() { return loadWeb('dog-sprites').DogSprites }
