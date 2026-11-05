import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadCameraLogic } from './load-camera-logic.mjs'

const Cam = loadCameraLogic()
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`)

// A stage 1000×600 holding the island wrapper laid out at (100, 100), 800×400 (its focus box, the island top),
// centred, so 100 px of empty sky on every side at 1×.
const box = { stageW: 1000, stageH: 600, ox: 100, oy: 100, cw: 800, ch: 400 }
// Where a point of the wrapper (local, unscaled) lands on the stage.
// Horizontal room to drag beyond the island's own limits, in stage px (10 % of the 1000 px stage).
const margin = 100
const onStage = (cam, qx, qy) => [box.ox + cam.tx + cam.z * qx, box.oy + cam.ty + cam.z * qy]

// ---- wheel → zoom factor ----

test('scrolling up zooms in and scrolling down zooms out by the same amount', () => {
  const zin = Cam.wheelFactor({ deltaY: -100, deltaMode: 0, ctrlKey: false })
  const zout = Cam.wheelFactor({ deltaY: 100, deltaMode: 0, ctrlKey: false })
  assert.ok(zin > 1 && zout < 1)
  close(zin * zout, 1)
})

test('one mouse-wheel notch (100 px) zooms about 15 %', () => {
  close(Cam.wheelFactor({ deltaY: -100, deltaMode: 0, ctrlKey: false }), Math.pow(2, 0.2))
})

test('line and page wheel modes are scaled to feel like pixel mode', () => {
  close(Cam.wheelFactor({ deltaY: -3, deltaMode: 1, ctrlKey: false }), Math.pow(2, 0.15))
  close(Cam.wheelFactor({ deltaY: -1, deltaMode: 2, ctrlKey: false }), 2)
})

test('a trackpad pinch (wheel with ctrlKey and small deltas) zooms 10× faster per pixel', () => {
  close(Cam.wheelFactor({ deltaY: -10, deltaMode: 0, ctrlKey: true }), Math.pow(2, 0.2))
})

test('no scroll means no zoom', () => {
  assert.equal(Cam.wheelFactor({ deltaY: 0, deltaMode: 0, ctrlKey: false }), 1)
})

// ---- zoom about the cursor ----

test('zooming keeps the point under the cursor still', () => {
  const cam = { z: 1, tx: 0, ty: 0 }
  const [px, py] = [500, 300]
  const q = [(px - box.ox - cam.tx) / cam.z, (py - box.oy - cam.ty) / cam.z]
  const next = Cam.zoomAt(cam, px, py, 2, box)
  assert.equal(next.z, 2)
  const [sx, sy] = onStage(next, ...q)
  close(sx, px); close(sy, py)
})

test('the cursor point stays still across several zoom steps, in and out', () => {
  let cam = { z: 1, tx: 0, ty: 0 }
  const [px, py] = [500, 300]
  const q = [(px - box.ox) / 1, (py - box.oy) / 1]
  for (const f of [1.3, 1.3, 1.3, 0.8, 1.1]) cam = Cam.zoomAt(cam, px, py, f, box)
  const [sx, sy] = onStage(cam, ...q)
  close(sx, px, 1e-6); close(sy, py, 1e-6)
})

test('zoom is clamped between the fitted view (1×) and 4×', () => {
  assert.equal(Cam.ZOOM_MIN, 1); assert.equal(Cam.ZOOM_MAX, 4)
  assert.equal(Cam.zoomAt({ z: 1, tx: 0, ty: 0 }, 500, 300, 0.5, box).z, 1)
  assert.equal(Cam.zoomAt({ z: 3.5, tx: 0, ty: 0 }, 500, 300, 2, box).z, 4)
})

test('zooming past a limit does not move the view', () => {
  const cam = { z: 4, tx: -900, ty: -500 }
  assert.deepEqual(Cam.zoomAt(cam, 200, 100, 1.5, box), cam)
})

// ---- two-finger pinch (touch screens) ----
// pinch(cam at the start, finger A and B at the start, finger A and B now, box) → the view now.

test('spreading two fingers to twice their distance zooms 2× about the point between them', () => {
  const cam = { z: 1, tx: 0, ty: 0 }
  const q = [(500 - box.ox) / 1, (300 - box.oy) / 1] // island point under the fingers' midpoint (500, 300)
  const next = Cam.pinch(cam, [450, 300], [550, 300], [400, 300], [600, 300], box)
  assert.equal(next.z, 2)
  const [sx, sy] = onStage(next, ...q)
  close(sx, 500); close(sy, 300)
})

test('moving both fingers together pans the view one to one', () => {
  const next = Cam.pinch({ z: 2, tx: -300, ty: -200 }, [400, 300], [500, 300], [430, 280], [530, 280], box)
  assert.deepEqual(next, { z: 2, tx: -270, ty: -220 })
})

test('zooming and moving at once keeps the island point under the fingers', () => {
  const cam = { z: 1, tx: 0, ty: 0 }
  const q = [(500 - box.ox) / 1, (300 - box.oy) / 1]
  const next = Cam.pinch(cam, [450, 300], [550, 300], [380, 340], [580, 340], box)
  assert.equal(next.z, 2)
  const [sx, sy] = onStage(next, ...q)
  close(sx, 480); close(sy, 340) // the new midpoint
})

test('a pinch zooms no further than 1× out and 4× in, and keeps the island in view', () => {
  const out = Cam.pinch({ z: 1.5, tx: 0, ty: 0 }, [400, 300], [600, 300], [490, 300], [510, 300], box)
  assert.equal(out.z, 1)
  const inn = Cam.pinch({ z: 2, tx: -300, ty: -200 }, [490, 300], [510, 300], [300, 300], [700, 300], box)
  assert.equal(inn.z, 4)
  assert.deepEqual(inn, Cam.clamp(inn, box))
})

// ---- drag ----

test('a press counts as a drag only after moving 4 px', () => {
  assert.equal(Cam.DRAG_THRESHOLD, 4)
  assert.equal(Cam.isDrag(2, 2), false)
  assert.equal(Cam.isDrag(3, 3), true)
  assert.equal(Cam.isDrag(0, -4), true)
})

test('panBy moves the view by exactly the offset it is given', () => {
  const next = Cam.panBy({ z: 2, tx: -300, ty: -200 }, 30, -20, box)
  assert.deepEqual(next, { z: 2, tx: -270, ty: -220 })
})

test('dragging moves the view at half the mouse speed', () => {
  assert.equal(Cam.DRAG_SPEED, 0.5)
  assert.deepEqual(Cam.dragOffset(60, -40), [30, -20])
})

test('a drag of the mouse moves the view half as far', () => {
  const [dx, dy] = Cam.dragOffset(60, -40)
  assert.deepEqual(Cam.panBy({ z: 2, tx: -300, ty: -200 }, dx, dy, box), { z: 2, tx: -270, ty: -220 })
})

// ---- keeping the island in view ----

test('the starting view is always allowed', () => {
  assert.deepEqual(Cam.clamp({ z: 1, tx: 0, ty: 0 }, box), { z: 1, tx: 0, ty: 0 })
})

test('the horizontal drag room is 10 % of the stage width', () => {
  assert.equal(Cam.PAN_MARGIN_X, 0.1)
})

test('at 1× the island slides within the sky around it, plus a little room left and right', () => {
  const far = Cam.clamp({ z: 1, tx: 5000, ty: -5000 }, box)
  const [, ty] = onStage(far, 0, 0), [rx] = onStage(far, box.cw, 0)
  close(rx, box.stageW + margin) // its right edge may run past the stage edge by the margin, no further
  close(ty, 0) // vertically no extra room: its top stops at the stage top
})

test('an island exactly as wide as the stage (the usual start) can still be dragged left and right', () => {
  const tight = { stageW: 1000, stageH: 600, ox: 0, oy: 100, cw: 1000, ch: 400 }
  assert.equal(Cam.clamp({ z: 1, tx: 500, ty: 0 }, tight).tx, margin)
  assert.equal(Cam.clamp({ z: 1, tx: -500, ty: 0 }, tight).tx, -margin)
  assert.equal(Cam.clamp({ z: 1, tx: 0, ty: 300 }, tight).ty, 100)
})

test('zoomed in past the stage, the island fills it except for the small side margin', () => {
  const far = Cam.clamp({ z: 3, tx: -1e6, ty: 1e6 }, box)
  const [lx, ty] = onStage(far, 0, 0), [rx, by] = onStage(far, box.cw, box.ch)
  close(rx, box.stageW - margin) // right edge stops one margin inside the stage's right edge
  close(ty, 0) // vertically it still fills: the top edge stops at the stage's top
  assert.ok(lx <= 0 && by >= box.stageH)
})

test('each axis is limited on its own: wider than the stage but not taller', () => {
  // z = 1.3: 1040 px wide (> 1000) but 520 px tall (< 600)
  const c = Cam.clamp({ z: 1.3, tx: 1e6, ty: 1e6 }, box)
  const [lx, ty] = onStage(c, 0, 0), [, by] = onStage(c, 0, box.ch)
  close(lx, margin) // horizontally it covers: left edge comes in by the margin at most
  close(by, box.stageH) // vertically it is contained: bottom edge stops at the stage bottom
  assert.ok(ty >= 0)
})

test('zoomAt and panBy both keep the island in view', () => {
  const z = Cam.zoomAt({ z: 1, tx: 0, ty: 0 }, 0, 0, 4, box)
  assert.deepEqual(z, Cam.clamp(z, box))
  const p = Cam.panBy({ z: 2, tx: 0, ty: 0 }, 1e5, 1e5, box)
  assert.deepEqual(p, Cam.clamp(p, box))
})

// ---- render resolution ----

test('at 1× the canvas keeps the exact screen resolution it uses today', () => {
  close(Cam.renderScale(800, 2, 1, 700), 800 * 2 / 700)
})

test('zoomed in, the resolution follows the zoom in half steps, never above 4', () => {
  assert.equal(Cam.renderScale(700, 1, 1.6, 700), 2)
  assert.equal(Cam.renderScale(700, 1, 2.1, 700), 2.5)
  assert.equal(Cam.renderScale(1400, 2, 3, 700), 4)
})

test('the resolution never drops below 1', () => {
  assert.equal(Cam.renderScale(200, 1, 1, 700), 1)
})

// ---- sky layers follow the camera ----

test('at depth 1 the sky view lands a point exactly where the island wrapper draws it', () => {
  const cam = Cam.zoomAt({ z: 1, tx: 0, ty: 0 }, 300, 250, 2.5, box)
  const v = Cam.skyView(cam, box)
  for (const [qx, qy] of [[0, 0], [400, 200], [800, 400], [123, 321]]) {
    const [sx, sy] = onStage(cam, qx, qy)
    close(v.ax + v.z * (box.ox + qx), sx)
    close(v.ay + v.z * (box.oy + qy), sy)
  }
})

test('at rest every depth is the identity, and depth 0 never moves', () => {
  const rest = Cam.skyView({ z: 1, tx: 0, ty: 0 }, box)
  const isIdentity = (l) => { close(l.z, 1); close(l.ax, 0); close(l.ay, 0) }
  for (const k of [0, 0.3, 1, 1.15]) isIdentity(Cam.parallax(rest, k))
  isIdentity(Cam.parallax(Cam.skyView({ z: 3, tx: -700, ty: -350 }, box), 0))
})

test('every depth zooms about the same fixed point, nearer layers by more', () => {
  const v = Cam.skyView(Cam.zoomAt({ z: 1, tx: 0, ty: 0 }, 640, 180, 3, box), box)
  const fixed = (l) => [l.ax / (1 - l.z), l.ay / (1 - l.z)]
  const [fx, fy] = fixed(v)
  let prev = 1
  for (const k of [0.1, 0.3, 0.7, 1, 1.15]) {
    const l = Cam.parallax(v, k)
    const [px, py] = fixed(l)
    close(px, fx, 1e-6); close(py, fy, 1e-6)
    assert.ok(l.z > prev, `depth ${k} zooms more than the layer behind it`)
    prev = l.z
  }
})

test('a pure pan at 1× moves a layer by its share of the pan', () => {
  const v = Cam.skyView({ z: 1, tx: 60, ty: 0 }, box)
  assert.deepEqual(Cam.parallax(v, 0.5), { z: 1, ax: 30, ay: 0 })
})
