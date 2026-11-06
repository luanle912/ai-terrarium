// Pan & zoom maths for the island view, kept DOM-free so tests/camera-logic.test.mjs can run it.
// The view is the island wrapper laid out at (ox, oy) on the stage, cw × ch for its focus box (the island top),
// shown with transform translate(tx, ty) scale(z) from its top-left corner.

// DRAG_SPEED < 1: the view moves slower than the mouse (asked for: a 1:1 drag felt like it travelled too far).
// PAN_MARGIN_X: extra drag room left and right, as a share of the stage width. At 1× the island is usually exactly
// as wide as the stage, so without it there would be no horizontal drag at all.
const ZOOM_MIN = 1,
  ZOOM_MAX = 4,
  DRAG_THRESHOLD = 4,
  DRAG_SPEED = 0.5,
  PAN_MARGIN_X = 0.1;
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
// Same curve as d3-zoom: 100 px of wheel ≈ 15 %, a pinch (ctrlKey, small deltas) 10× faster per pixel.
function wheelFactor(e) {
  const unit = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.002;
  return Math.pow(2, -e.deltaY * unit * (e.ctrlKey ? 10 : 1));
}
// Like a photo viewer, per axis: an island smaller than the stage stays whole on screen (it only slides within
// the empty sky around it); one larger than the stage fills it. Left and right there is PAN_MARGIN_X more room.
// m widens the range by m on both sides; it is continuous where the island grows past the stage (s = S).
function clampAxis(t, z, o, c, S, m) {
  const s = z * c;
  return s <= S ? clampN(t, -o - m, S - o - s + m) : clampN(t, S - o - s - m, -o + m);
}
function clamp(cam, b) {
  return {
    z: cam.z,
    tx: clampAxis(cam.tx, cam.z, b.ox, b.cw, b.stageW, b.stageW * PAN_MARGIN_X),
    ty: clampAxis(cam.ty, cam.z, b.oy, b.ch, b.stageH, 0),
  };
}
// Zoom by factor f keeping the stage point (px, py) — the cursor — over the same spot of the island.
function zoomAt(cam, px, py, f, b) {
  const z = clampN(cam.z * f, ZOOM_MIN, ZOOM_MAX);
  if (z === cam.z) return cam;
  const qx = (px - b.ox - cam.tx) / cam.z,
    qy = (py - b.oy - cam.ty) / cam.z;
  return clamp({ z, tx: px - b.ox - z * qx, ty: py - b.oy - z * qy }, b);
}
function panBy(cam, dx, dy, b) {
  return clamp({ z: cam.z, tx: cam.tx + dx, ty: cam.ty + dy }, b);
}
// Two-finger pinch on a touch screen, from the view when the second finger landed (cam) and both fingers then
// (a0, b0) and now (a1, b1): zoom by how far the fingers spread, and keep the island point that was between them
// under their midpoint as it moves, so the island follows the fingers one to one (unlike the slowed mouse drag).
function pinch(cam, a0, b0, a1, b1, b) {
  const z = clampN(
    (cam.z * Math.hypot(b1[0] - a1[0], b1[1] - a1[1])) / Math.hypot(b0[0] - a0[0], b0[1] - a0[1]),
    ZOOM_MIN,
    ZOOM_MAX,
  );
  const qx = ((a0[0] + b0[0]) / 2 - b.ox - cam.tx) / cam.z,
    qy = ((a0[1] + b0[1]) / 2 - b.oy - cam.ty) / cam.z;
  return clamp({ z, tx: (a1[0] + b1[0]) / 2 - b.ox - z * qx, ty: (a1[1] + b1[1]) / 2 - b.oy - z * qy }, b);
}
const isDrag = (dx, dy) => Math.hypot(dx, dy) >= DRAG_THRESHOLD;
const dragOffset = (dx, dy) => [dx * DRAG_SPEED, dy * DRAG_SPEED];
// Canvas pixels per scene pixel. At 1× it is exactly the screen's (as before zoom existed); zoomed in it follows
// the zoom in half steps (so the island bitmap is not re-baked on every wheel tick), capped at 4 like before.
function renderScale(clientW, dpr, z, LW) {
  const base = (clientW * dpr) / LW;
  return clampN(z <= 1 ? base : Math.ceil(base * z * 2) / 2, 1, 4);
}
// The wrapper's transform as one map for the stage-sized sky canvases: stage point = (ax, ay) + z · p.
function skyView(cam, b) {
  return { z: cam.z, ax: b.ox + cam.tx - cam.z * b.ox, ay: b.oy + cam.ty - cam.z * b.oy };
}
// The view of a sky layer at depth k (0 = the fixed sky, 1 = moves with the island, >1 = nearer than it): zoom and
// pan scale with k around the same fixed point, so far layers drift less than near ones (parallax).
function parallax(v, k) {
  return { z: 1 + (v.z - 1) * k, ax: v.ax * k, ay: v.ay * k };
}
export const CameraLogic = {
  ZOOM_MIN,
  ZOOM_MAX,
  DRAG_THRESHOLD,
  DRAG_SPEED,
  PAN_MARGIN_X,
  wheelFactor,
  clamp,
  zoomAt,
  panBy,
  pinch,
  isDrag,
  dragOffset,
  renderScale,
  skyView,
  parallax,
};
