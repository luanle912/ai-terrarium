// Painting the /assets previews: one loop for every canvas on the page. A slot is a canvas showing one variant of one
// entry. Only slots on screen are painted (IntersectionObserver); a still entry is painted again only when what it
// shows changes, a moving one at most `fps` times a second (15 in the grid, 30 in the drawer) while motion
// is on; nothing runs while the tab is hidden. A draw that throws marks its slot broken instead of stopping the
// loop. The loop itself allocates nothing per frame.
import { AssetsLogic } from './assets-logic.js';
import { AssetsStage } from './assets-stage.js';

// The clock a still page shows (motion off): a moment where the screens and lights are on.
export const STILL_T = 1.25;
const PAD = 2;
const slots = [];
let motion = true,
  raf = 0,
  observer = null;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ---- the frame an entry is drawn in ----
// Measured, not declared: the box everything the entry draws covers (with the game's own code, on a counting canvas)
// over a spread of its variants and two moments, so the frame holds every variant without jumping between them.
// An entry that sweeps its axes (a person: poses as different as lying asleep and standing) is framed per pick, over
// the scenes it reacts to, so each pose fills its card instead of sitting small in the union of them all.
const FRAMES = new Map();
function frameOf(e, pick) {
  const own = e.sweep && pick ? AssetsLogic.fixPick(e, pick) : null,
    key = own ? e.id + '|' + JSON.stringify(own) : e.id;
  let f = FRAMES.get(key);
  if (f) return f;
  const all = AssetsLogic.combos(e, AssetsLogic.DEFAULTS),
    cells = own ? AssetsLogic.combos({ ...e, axes: [], sweep: null }, AssetsLogic.DEFAULTS) : all,
    step = Math.max(1, Math.floor(cells.length / 12)),
    rec = AssetsStage.recordingCtx(),
    view = { ox: 0, oy: 0, env: null, pick: null };
  for (let i = 0; i < cells.length; i += step)
    for (const t of [0.4, STILL_T, 2.6]) {
      view.env = AssetsStage.envOf(AssetsLogic.sceneOf(e, cells[i].controls));
      view.pick = own || AssetsLogic.fixPick(e, cells[i].pick);
      try {
        e.draw(rec, view, t);
      } catch (err) {
        // the slot shows the error when it paints
      }
    }
  const b = rec.bounds();
  f = b
    ? { x0: b.x0 - PAD, y0: b.y0 - PAD, w: b.x1 - b.x0 + 2 * PAD, h: b.y1 - b.y0 + 2 * PAD }
    : { x0: -16, y0: -16, w: 32, h: 32 };
  FRAMES.set(key, f);
  return f;
}
// The zoom at which a frame fits a box of css px, its aspect kept: the largest whole one (at most `max`) when it fits
// at ×1 or more, otherwise the fraction that shrinks it to fit.
function fitZoom(f, boxW, boxH, max) {
  const fit = Math.min(boxW / f.w, boxH / f.h);
  if (!(fit > 0)) return 1;
  return fit >= 1 ? Math.min(max, Math.floor(fit)) : fit;
}

// What one variant looks like on the counting canvas: its palette (most-drawn solid colours) and its size in px.
function inspect(e, view, t = STILL_T) {
  const rec = AssetsStage.recordingCtx(),
    v = { ox: 0, oy: 0, env: view.env, pick: view.pick };
  try {
    e.draw(rec, v, t);
  } catch (err) {
    return { palette: [], size: null };
  }
  const b = rec.bounds();
  let palette = rec.palette(8);
  if (e.palette)
    try {
      palette = e.palette(v);
    } catch (err) {
      // keep the measured one
    }
  return { palette, size: b && { w: b.x1 - b.x0, h: b.y1 - b.y0 } };
}

// ---- slots ----
// opts: {fps, onError(err|null)}. Set what it shows with setSlot; the canvas is sized there.
function attach(canvas, opts = {}) {
  const slot = {
    canvas,
    ctx: canvas.getContext('2d'),
    entry: null,
    view: { ox: 0, oy: 0, env: null, pick: {} },
    frame: null,
    k: 1,
    zoom: 0,
    fps: opts.fps || 15,
    still: !!opts.still,
    onError: opts.onError || null,
    visible: typeof IntersectionObserver === 'undefined',
    dirty: true,
    last: -1e9,
    broken: null,
  };
  slots.push(slot);
  if (typeof IntersectionObserver !== 'undefined') {
    if (!observer)
      observer = new IntersectionObserver(
        list => {
          for (const it of list) {
            const s = slots.find(x => x.canvas === it.target);
            if (!s) continue;
            s.visible = it.isIntersecting;
            if (s.visible) s.dirty = true;
          }
          wake();
        },
        { rootMargin: '120px 0px' },
      );
    observer.observe(canvas);
  }
  return slot;
}
function detach(slot) {
  const i = slots.indexOf(slot);
  if (i >= 0) slots.splice(i, 1);
  if (observer) observer.unobserve(slot.canvas);
}
const samePick = (a, b) => {
  for (const k in b) if (a[k] !== b[k]) return false;
  for (const k in a) if (!(k in b)) return false;
  return true;
};
// Shows entry e in the scene of `controls` (only the controls it uses reach it) with `pick`, at `zoom` css px per
// pixel (a fraction shrinks it); the canvas gets the screen's own resolution so it stays sharp, and below ×1 it is
// drawn at one device px per pixel or more and shrunk by css (pixelated), its aspect kept.
function setSlot(slot, e, pick, controls, zoom) {
  const p = AssetsLogic.fixPick(e, pick),
    f = frameOf(e, p),
    dpr = (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1,
    k = Math.max(1, Math.round(zoom * dpr)),
    env = AssetsStage.envOf(AssetsLogic.sceneOf(e, controls));
  // the same variant in the same scene at the same size: nothing to paint again (a still card stays as it is)
  if (
    slot.entry === e &&
    slot.view.env === env &&
    slot.zoom === zoom &&
    slot.frame === f &&
    samePick(slot.view.pick, p)
  )
    return false;
  if (slot.k !== k || slot.frame !== f || slot.zoom !== zoom) {
    const css = zoom >= 1 ? k / dpr : zoom;
    slot.canvas.width = f.w * k;
    slot.canvas.height = f.h * k;
    slot.canvas.style.width = f.w * css + 'px';
    slot.canvas.style.height = f.h * css + 'px';
    slot.canvas.style.setProperty('--cell', 4 * css + 'px');
    slot.k = k;
    slot.zoom = zoom;
    slot.frame = f;
  }
  slot.entry = e;
  slot.view.ox = -f.x0;
  slot.view.oy = -f.y0;
  slot.view.env = env;
  slot.view.pick = p;
  slot.broken = null;
  slot.dirty = true;
  wake();
  return true;
}

function paint(slot, t) {
  const { ctx, canvas } = slot;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(slot.k, 0, 0, slot.k, 0, 0);
  ctx.imageSmoothingEnabled = false;
  try {
    slot.entry.draw(ctx, slot.view, t);
  } catch (err) {
    slot.broken = err;
    if (typeof ctx.reset === 'function') ctx.reset();
    else ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (slot.onError) slot.onError(err);
  }
}

// One pass over the slots: what is on screen and due gets painted. Keeps running only while something moves.
function tick() {
  raf = 0;
  if (typeof document !== 'undefined' && document.hidden) return;
  const ms = now(),
    t = motion ? ms / 1000 : STILL_T;
  let moving = false;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s.entry || !s.visible || s.broken) continue;
    const anim = motion && !s.still && s.entry.tags.includes('animated');
    if (anim) moving = true;
    if (s.dirty || (anim && ms - s.last >= 1000 / s.fps - 4)) {
      s.dirty = false;
      s.last = ms;
      paint(s, t);
    }
  }
  if (moving) raf = requestAnimationFrame(tick);
}
function wake() {
  if (!raf && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(tick);
}
function setMotion(on) {
  motion = !!on;
  for (const s of slots) s.dirty = true;
  wake();
}
if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      for (const s of slots) s.dirty = true;
      wake();
    }
  });

export const AssetsPaint = { frameOf, fitZoom, inspect, attach, detach, setSlot, setMotion, STILL_T };
