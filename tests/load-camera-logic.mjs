// Imports web/camera-logic.js, the module the page uses, so the pan/zoom maths can be tested without a DOM.
import { loadWeb } from './web.mjs'

export function loadCameraLogic() {
  return loadWeb('camera-logic').CameraLogic
}
