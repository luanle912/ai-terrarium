// Runs web/dog-logic.js and web/dog-sprites.js the way the browser does (plain scripts that set
// globalThis.DogLogic / globalThis.DogSprites), so the dogs' behaviour and pixels can be tested without a DOM.
import { runWeb } from './web.mjs'

export function loadDogLogic() { runWeb('dog-logic'); return globalThis.DogLogic }
export function loadDogSprites() { runWeb('dog-sprites'); return globalThis.DogSprites }
