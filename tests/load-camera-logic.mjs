// Runs web/camera-logic.js the way the browser does (as a plain script that sets
// globalThis.CameraLogic), so the pan/zoom maths can be tested without a DOM.
import { runWeb } from './web.mjs'

export function loadCameraLogic() {
  runWeb('camera-logic')
  return globalThis.CameraLogic
}
