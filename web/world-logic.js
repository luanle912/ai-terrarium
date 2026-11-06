// Several islands in one sky, DOM-free so tests/world-logic.test.mjs can run it.
// The 8-island sky: the viewer's island sits in the centre, 40 % larger and a little lower ("forward"); the other seven
// slots form a ring around it in slot order, clockwise from the top left. Slots are fixed, so a place never moves when
// other islands come or go. On a phone the centre is a full-width card on top and the ring is two columns below it.
// Moving between views is covered by two cloud bands: close in 350 ms, hold 100 ms, open in 400 ms. With reduced
// motion it is a 200 ms cross-fade instead. All rects are in stage px, h = w * ISLAND_ASPECT.
import { WorldLink } from './world-link.js';

export const WorldLogic = (() => {
  const SLOTS = 8,
    PHONE_MAX_W = 520,
    CENTRE_SCALE = 1.4,
    HOVER_LIFT = 6,
    GUTTER = 12;
  const CLOUD_IN_MS = 350,
    CLOUD_HOLD_MS = 100,
    CLOUD_OUT_MS = 400,
    CLOUD_MS = 850,
    FADE_MS = 200;
  const CENTRE_DROP = 0.1; // how far (in ring-cell heights) the centre sits lower than a plain stack
  const validSlot = s => Number.isInteger(s) && s >= 0 && s < SLOTS;

  function skyLayout(slots, mySlot, stageW, stageH) {
    const have = new Set((slots || []).filter(validSlot));
    let centre, order;
    if (validSlot(mySlot)) {
      centre = { kind: 'mine', slot: mySlot };
      order = Array.from({ length: 7 }, (_, i) => (mySlot + 1 + i) % SLOTS);
    } else {
      let free = -1;
      for (let s = 0; s < SLOTS; s++)
        if (!have.has(s)) {
          free = s;
          break;
        }
      if (free >= 0) {
        centre = { kind: 'yours', slot: free };
        order = Array.from({ length: 7 }, (_, i) => (free + 1 + i) % SLOTS);
      } else {
        centre = { kind: 'full', slot: null };
        order = Array.from({ length: SLOTS }, (_, i) => i);
      }
    }
    const kinds = order.map(slot => ({ slot, kind: have.has(slot) ? 'island' : 'empty' }));
    const phone = stageW <= PHONE_MAX_W;
    const G = GUTTER,
      A = ISLAND_ASPECT;
    if (phone) {
      const cw = Math.max(0, stageW - 2 * G);
      const crect = { x: G, y: G, w: cw, h: cw * A };
      const w = Math.max(0, (stageW - 3 * G) / 2),
        h = w * A;
      const top = crect.y + crect.h + G;
      const cells = kinds.map((k, i) => ({
        ...k,
        rect: { x: G + (i % 2) * (w + G), y: top + Math.floor(i / 2) * (h + G), w, h },
      }));
      const last = cells[cells.length - 1].rect;
      return { phone, height: last.y + last.h + G, centre: { ...centre, rect: crect }, cells };
    }
    // Wide stage: three rows (top, middle with the centre between two cells, bottom).
    // Width needs 3.4 cell widths (side, centre 1.4, side) plus four gutters; height needs 3.5 cell heights
    // (1 + 1.4 + 1 + the drop) plus four gutters.
    const w = Math.max(
      0,
      Math.min((stageW - 4 * G) / (2 + CENTRE_SCALE), (stageH - 4 * G) / ((2 + CENTRE_SCALE + CENTRE_DROP) * A)),
    );
    const h = w * A,
      ch = CENTRE_SCALE * h;
    const block = 2 * h + ch + CENTRE_DROP * h + 4 * G;
    const y0 = G + Math.max(0, (stageH - block) / 2);
    const rowTop = y0,
      rowMid = y0 + h + G + CENTRE_DROP * h,
      rowBot = rowMid + ch + G;
    const colL = G,
      colM = (stageW - w) / 2,
      colR = stageW - G - w;
    const cyMid = rowMid + ch / 2;
    const rc = (x, y) => ({ x, y, w, h });
    const pos = [rc(colL, rowTop), rc(colM, rowTop), rc(colR, rowTop), rc(colR, cyMid - h / 2)];
    if (kinds.length === 8) pos.push(rc(colR, rowBot), rc(colM, rowBot), rc(colL, rowBot));
    else pos.push(rc(colR, rowBot), rc(colL, rowBot));
    pos.push(rc(colL, cyMid - h / 2));
    const crect = { x: (stageW - CENTRE_SCALE * w) / 2, y: rowMid, w: CENTRE_SCALE * w, h: ch };
    return {
      phone,
      height: stageH,
      centre: { ...centre, rect: crect },
      cells: kinds.map((k, i) => ({ ...k, rect: pos[i] })),
    };
  }
  const within = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  // Centre first (it is drawn last, on top), then the ring. Hover lift does not change what counts as a hit.
  function skyHit(layout, px, py) {
    if (within(layout.centre.rect, px, py)) return { slot: layout.centre.slot, kind: layout.centre.kind, centre: true };
    for (const c of layout.cells) if (within(c.rect, px, py)) return { slot: c.slot, kind: c.kind, centre: false };
    return null;
  }
  const easeInOut = x => {
    const t = Math.max(0, Math.min(1, x));
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  };
  function cloudPhase(elapsedMs, reduced) {
    const e = Math.max(0, elapsedMs);
    if (reduced)
      return { cover: 0, fade: Math.max(0, 1 - Math.abs(e - 100) / 100), swap: e >= 100, done: e >= FADE_MS };
    const cover =
      e < CLOUD_IN_MS
        ? easeInOut(e / CLOUD_IN_MS)
        : e < CLOUD_IN_MS + CLOUD_HOLD_MS
          ? 1
          : e < CLOUD_MS
            ? 1 - easeInOut((e - CLOUD_IN_MS - CLOUD_HOLD_MS) / CLOUD_OUT_MS)
            : 0;
    return { cover, fade: 0, swap: e >= CLOUD_IN_MS, done: e >= CLOUD_MS };
  }
  // Inner edges of the left and right cloud bands; at cover 1 they overlap by 0.36 * stageW.
  function cloudBands(cover, stageW) {
    const left = -0.1 * stageW + cover * 0.68 * stageW;
    return { left, right: stageW - left };
  }
  const canNavigate = (trans, nowMs, reduced) => !trans || cloudPhase(nowMs - trans.start, reduced).done;
  // The transition a navigation starts, or null: refused while one runs (dropped, not queued) and when already there.
  // cur = {trans, reduced (of the running one), view, focus}.
  function beginTrans(cur, to, nowMs, reduced) {
    if (!canNavigate(cur.trans, nowMs, cur.reduced)) return null;
    if (cur.view === to.view && (to.view !== 'one' || cur.focus === to.focus)) return null;
    return { start: nowMs, to, swapped: false };
  }
  // The part of the stage the one-island view fits the island into. A phone keeps it between the back control (top)
  // and the collapsed bottom sheet (bottom). A wide stage with the panel open gives up the panel's column (panelW)
  // when the island keeps at least 70 % of its size that way; else the island stays full size under the panel.
  // lw / fh: the scene's width and fitted height (the local page's LW / FH).
  function oneArea(sw, sh, o) {
    if (o.phone) return { x: 0, y: o.top, w: sw, h: Math.max(0, sh - o.top - o.bottom) };
    const full = { x: 0, y: 0, w: sw, h: sh };
    if (!o.panelOpen) return full;
    const side = { x: 0, y: 0, w: Math.max(0, sw - o.panelW), h: sh },
      z = a => Math.min(a.w, (a.h * o.lw) / o.fh);
    return z(side) >= 0.7 * z(full) ? side : full;
  }
  // The island in an area: as wide as fits with its top (fh) inside, centred; lh is the full scene height.
  function fitOne(area, lw, fh, lh) {
    const z = Math.max(0, Math.min(area.w, (area.h * lw) / fh)),
      s = z / lw;
    return { x: area.x + (area.w - z) / 2, y: area.y + (area.h - fh * s) / 2, w: z, h: lh * s, fh: fh * s };
  }
  // One frame of a running transition ({start, swapped}): the phase to draw, whether this frame swaps the view (only
  // the first one past the swap point) and whether the clouds are gone.
  function transStep(trans, nowMs, reduced) {
    if (!trans) return { phase: null, swapNow: false, done: true };
    const phase = cloudPhase(nowMs - trans.start, reduced);
    return { phase, swapNow: phase.swap && !trans.swapped, done: phase.done };
  }
  // Where a transition lands: one island only while it is still in the world (has(id)), else "Toàn cảnh".
  function landingView(to, has) {
    const v = to && to.view;
    if (v === 'one')
      return to.focus != null && has(to.focus) ? { view: 'one', focus: to.focus } : { view: 'all', focus: null };
    return { view: v === 'mine' ? 'mine' : 'all', focus: null };
  }
  // The island on screen (one island, or mine in "Của tôi") was removed from the world.
  const viewGone = (view, shownId, has) => (view === 'one' || view === 'mine') && shownId != null && !has(shownId);
  // Esc: nothing on "Toàn cảnh", while typing, with the settings open or with Ctrl, Meta or Alt held (mod); else close
  // an open confirm, else go back.
  const escAction = ({ view, typing, settings, confirm, mod }) =>
    view === 'all' || typing || settings || mod ? 'none' : confirm ? 'confirm' : 'back';
  // Without an island of my own, an island never seen before may be mine (paired on another tab), so /api/me is asked
  // again: at most once per `every` ms, only while the tab is visible. A new island inside the window is not lost: the
  // probe stays pending and retryIn says when to call again. The first world list is only remembered.
  const meProbeState = () => ({ seen: new Set(), pending: false, lastAt: -Infinity });
  function meProbeStep(st, ids, nowMs, o) {
    for (const id of ids)
      if (!st.seen.has(id)) {
        st.seen.add(id);
        if (!o.first) st.pending = true;
      }
    if (o.hasMine) st.pending = false;
    if (!st.pending || !o.visible) return { fire: false, retryIn: null };
    const wait = st.lastAt + o.every - nowMs;
    if (wait > 0) return { fire: false, retryIn: wait };
    st.pending = false;
    st.lastAt = nowMs;
    return { fire: true, retryIn: null };
  }

  const ISLAND_ASPECT = 0.62; // island height / width

  // Public session view (hub payload) -> the shape the island renderer takes.
  const clientSessions = publicSessions => {
    const out = [];
    for (const s of publicSessions || []) {
      if (!s || typeof s.id !== 'string') continue;
      const c = {
        id: s.id,
        parentId: s.parent,
        status: s.status,
        waitingOn: s.waitingOn,
        talkingTo: s.talkingTo,
        project: s.dept,
        kind: s.kind,
      };
      if (s.tool !== undefined) c.tool = s.tool;
      if (s.model !== undefined) c.model = s.model;
      out.push(c);
    }
    return out;
  };
  return {
    SLOTS,
    PHONE_MAX_W,
    CENTRE_SCALE,
    HOVER_LIFT,
    GUTTER,
    CLOUD_IN_MS,
    CLOUD_HOLD_MS,
    CLOUD_OUT_MS,
    CLOUD_MS,
    FADE_MS,
    skyLayout,
    skyHit,
    easeInOut,
    cloudPhase,
    cloudBands,
    canNavigate,
    beginTrans,
    oneArea,
    fitOne,
    transStep,
    landingView,
    viewGone,
    escAction,
    meProbeState,
    meProbeStep,
    ISLAND_ASPECT,
    clientSessions,
    ...WorldLink,
  };
})();
