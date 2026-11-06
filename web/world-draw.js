// World mode drawing: the 8-slot sky of small islands, one island in full, cloud transitions, hit testing.
import { tr } from './i18n.js';
import { WorldLogic } from './world-logic.js';
import { SkyRender } from './sky-render.js';
import { FH, LH, LW } from './office-scene.js';
import { ClaudeOffice } from './office.js';
import {
  ART_H,
  ART_W,
  GOLD,
  ISL,
  LABEL_H,
  LABEL_H2,
  OFFLINE_ALPHA,
  OFF_MS,
  ONE_BOTTOM,
  ONE_TOP,
  PANEL_COL,
  art,
  clip,
  measured,
  okColor,
  paintIsland,
  paintTile,
  plate,
  releaseCanvas,
  tally,
} from './world-ui.js';
Object.assign(ClaudeOffice.prototype, {
  // The 8-slot layout for the current islands and stage, remembered until one of its inputs changes, with what every
  // frame of "Toàn cảnh" needs from it: the ring cells top row first and the island in each slot.
  // The world list, w.mine and w.me are replaced (never changed in place) when they change, so identity tells.
  sky() {
    const w = this.world,
      lw = w.lw || w.sw,
      k = w.sky;
    if (k && k.islands === w.islands && k.mine === w.mine && k.me === w.me && k.lw === lw && k.sh === w.sh) return k;
    const slots = w.islands.map(i => i.slot),
      mine = this.mySlot(),
      key = slots.join(',') + '|' + mine + '|' + lw + '|' + w.sh;
    const same = k && k.key === key,
      L = same ? k.L : WorldLogic.skyLayout(slots, mine, lw, w.sh);
    const bySlot = new Map();
    for (const i of w.islands) if (!bySlot.has(i.slot)) bySlot.set(i.slot, i);
    return (w.sky = {
      key,
      L,
      sorted: same ? k.sorted : [...L.cells].sort((a, b) => a.rect.y - b.rect.y),
      bySlot,
      islands: w.islands,
      mine: w.mine,
      me: w.me,
      lw,
      sh: w.sh,
    });
  },
  skyNow() {
    return this.sky().L;
  },
  // One island alone, as wide as the local page draws it (no camera), in the room the controls leave
  // (WorldLogic.oneArea): between the back control and the collapsed sheet on a phone, beside an open panel on a
  // wide stage when that keeps it large.
  oneIslandRect(sw, sh) {
    const phone = this.phoneStage(sw);
    const a = WorldLogic.oneArea(sw, sh, {
      phone,
      panelOpen: !phone && this.sheetOpen(),
      panelW: PANEL_COL,
      top: ONE_TOP,
      bottom: ONE_BOTTOM,
      lw: LW,
      fh: FH,
    });
    return WorldLogic.fitOne(a, LW, FH, LH);
  },
  phoneStage(sw) {
    return sw > 0 && sw <= WorldLogic.PHONE_MAX_W;
  },
  // The island panel: open unless the viewer collapsed it; a phone starts collapsed (but open with nothing to see:
  // "Của tôi" without an island). An open question (confirm) always shows.
  sheetOpen() {
    const w = this.world;
    if (w.confirm) return true;
    if (w.sheetOpen != null) return w.sheetOpen;
    return !this.phoneStage(w.sw) || (w.view === 'mine' && !this.myIslandId());
  },

  worldFrame(ts) {
    const w = this.world,
      dt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    this.env = this.envNow();
    this.frameTheme = this.theme;
    const st = this.stageEl;
    w.sw = st ? st.clientWidth : 0;
    w.sh = st ? st.clientHeight : 0;
    // The sky is laid out in the scroller's width: a classic scrollbar (desktop, narrow window) takes its own room.
    const sc_ = this.worldScroller;
    w.lw = sc_ && sc_.clientWidth ? Math.min(w.sw, sc_.clientWidth) : w.sw;
    const phone = this.phoneStage(w.sw);
    if (phone !== w.phone) {
      w.phone = phone;
      w.oneR = null;
      this.forceUpdate();
    }
    // The view swaps on the first frame the clouds cover it (the hold, when nothing moves, so a slow first full
    // draw of the new island does not show as a stutter).
    const step = WorldLogic.transStep(w.trans, performance.now(), w.transReduced);
    if (step.swapNow) {
      w.trans.swapped = true;
      this.applyView(w.trans.to);
    }
    this.drawWorld(ts / 1000, dt, w.sw, w.sh);
    this.drawSky(ts / 1000);
    if (step.phase) this.drawClouds(this.frontCanvas.getContext('2d'), step.phase, w.sw, w.sh, ts / 1000);
    // An island removed while the clouds ran (navigate was refused then) is caught once they are gone.
    if (w.trans && step.done) {
      w.trans = null;
      this.dropGone();
    }
  },
  // The transition over everything on the stage but the React panels: two cloud banks (cover), or with reduced motion
  // a plain veil of cloud colour (fade). Drawn on the front canvas, which drawSky has just painted this frame.
  drawClouds(ctx, phase, sw, sh, t) {
    const col = this.env && this.env.col;
    if (!col || sw <= 0 || sh <= 0) return;
    if (phase.cover > 0) {
      const b = WorldLogic.cloudBands(phase.cover, sw);
      SkyRender.drawCurtains(ctx, sw, sh, b.left, b.right, t || 0, col);
    }
    if (phase.fade > 0) {
      ctx.globalAlpha = phase.fade;
      ctx.fillStyle = col.cloud;
      ctx.fillRect(0, 0, sw, sh);
      ctx.globalAlpha = 1;
    }
  },
  drawWorld(t, dt, sw, sh) {
    const w = this.world,
      cv = this.worldCanvas;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1,
      bw = Math.round(sw * dpr),
      bh = Math.round(sh * dpr);
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, sw, sh);
    if (w.view !== 'all') this.setScroll(0);
    const now = performance.now(),
      full =
        sw > 0 && sh > 0
          ? w.view === 'all'
            ? (this.drawSky8(t, dt, sw, sh), null)
            : this.drawOne(ctx, t, dt, sw, sh, now)
          : null;
    // Islands not drawn in full still walk, a few times a second, and hold no full-detail canvas.
    for (const sc of w.scenes.values())
      if (sc.id !== full) {
        if (sc.lod === 'full') releaseCanvas(sc);
        if (now - sc.simAt >= OFF_MS) {
          const d = Math.min(1, (now - (sc.simAt || now)) / 1000);
          sc.simAt = now;
          if (d > 0) sc.frame(d);
        }
      }
  },
  // "Của tôi" or one island from the sky: the full scene every frame, at the screen's resolution. Returns its id.
  drawOne(ctx, t, dt, sw, sh, now) {
    const w = this.world,
      id = w.view === 'mine' ? this.myIslandId() : w.focus,
      sc = id && w.scenes.get(id),
      meta = sc && w.islands.find(i => i.id === id);
    if (!sc || !meta) return null;
    const dpr = window.devicePixelRatio || 1,
      target = this.oneIslandRect(sw, sh),
      simDt = Math.min(1, (now - (sc.simAt || now)) / 1000) || dt;
    // The island glides to its new place when the panel opens or closes (the bake keeps the target's resolution).
    const o = w.oneR,
      ease = o && !(this.env && this.env.reduced) ? 1 - Math.exp(-dt * 14) : 1;
    const r = (w.oneR = o
      ? {
          x: o.x + (target.x - o.x) * ease,
          y: o.y + (target.y - o.y) * ease,
          w: o.w + (target.w - o.w) * ease,
          h: o.h + (target.h - o.h) * ease,
          fh: target.fh,
        }
      : target);
    if (Math.abs(r.x - target.x) + Math.abs(r.y - target.y) + Math.abs(r.w - target.w) < 0.5) w.oneR = target;
    sc.simAt = now;
    sc.frame(Math.min(0.05, simDt));
    sc.lodK = Math.min(4, Math.max(0.5, (target.w * dpr) / LW));
    sc.lod = 'full';
    sc.state.sel = this.state.selIsland === sc.id ? this.state.sel : null;
    sc.draw(t);
    sc.drawnAt = now;
    const bob = this.env && this.env.reduced ? 0 : Math.round(Math.sin(t * 0.7) * 3);
    ctx.globalAlpha = meta.online === false ? OFFLINE_ALPHA : 1;
    ctx.imageSmoothingEnabled = r.w < sc.canvas.width / dpr;
    ctx.drawImage(sc.canvas, r.x, r.y + bob, r.w, r.h);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    // no name plate here: the panel title and the back control already name the island
    w.shown = id; // so a later removal of this island (mine included) takes the view back to "Toàn cảnh"
    return id;
  },
  // "Toàn cảnh": the ring first (top rows first, so lower places overlap upper ones), my place in the centre last.
  // On a phone the stage scrolls (a spacer as tall as the layout); the canvas stays put and draws shifted up.
  drawSky8(t, dt, sw, sh) {
    const w = this.world,
      ctx = this.worldCanvas.getContext('2d'),
      S = this.sky(),
      L = S.L,
      bySlot = S.bySlot,
      sc_ = this.worldScroller;
    const tall = L.phone && L.height > sh;
    this.setScroll(tall ? L.height : 0);
    const top = tall && sc_ ? sc_.scrollTop : 0,
      reduced = !!(this.env && this.env.reduced);
    const at = r => (top ? { x: r.x, y: r.y - top, w: r.w, h: r.h } : r),
      seen = r => r.y - top < sh && r.y - top + r.h > 0;
    // Phone cells keep room for a two-line plate, so plates in a row line up whatever their length.
    const labelH = L.phone ? LABEL_H2 : LABEL_H;
    const island = (r, meta, mine) => {
      const sc = w.scenes.get(meta.id),
        c = tally(sc);
      this.drawSimpleIsland(ctx, at(r), meta, {
        busy: c.busy,
        alert: c.alert,
        hover: w.hover === meta.slot,
        mine,
        t,
        reduced,
        labelH,
      });
    };
    for (const c of S.sorted) {
      if (!seen(c.rect)) continue;
      const meta = c.kind === 'island' && bySlot.get(c.slot);
      if (meta) island(c.rect, meta, false);
      else this.drawSlotTile(ctx, at(c.rect), 'empty', { labelH });
    }
    const C = L.centre;
    if (seen(C.rect)) {
      const meta = C.kind === 'mine' && bySlot.get(C.slot);
      if (meta) island(C.rect, meta, true);
      else
        this.drawSlotTile(ctx, at(C.rect), C.kind === 'mine' ? 'yours' : C.kind, {
          hover: C.kind === 'yours' && w.hover === C.slot,
          t,
          reduced,
          labelH,
        });
    }
  },
  // A content height to scroll through, or 0 for none (back at the top, so hit tests need no offset).
  setScroll(height) {
    const el = this.worldScroller,
      sp = this.worldSpacer,
      ov = height ? 'auto' : 'hidden',
      hs = height ? Math.ceil(height) + 'px' : '100%';
    if (el && el.style.overflowY !== ov) {
      el.style.overflowY = ov;
      if (!height) el.scrollTop = 0;
    }
    if (sp && sp.style.height !== hs) sp.style.height = hs;
  },
  // Where a simple island (or an empty place) goes inside its rect, in device px: s device px per art px, the art's
  // top left (ax, ay), and whether its name plate (labelH CSS px) fits under it. The scale is a whole number, except
  // that 1.25 or 1.5 is used where 2 does not fit, and a little under 1 (down to 0.85) keeps the plate under the art in
  // the smallest phone cells at DPR 1; stamped with smoothing off either way.
  // Only a cell smaller still puts the plate over the island.
  artPlace(rect, labelH) {
    const dpr = window.devicePixelRatio || 1,
      W = rect.w * dpr,
      H = rect.h * dpr,
      lh = (labelH || LABEL_H) * dpr;
    const room = Math.min(W / ART_W, (H - lh) / ART_H),
      under = room >= 0.85;
    let s = under ? Math.floor(room) : Math.max(1, Math.floor(Math.min(W / ART_W, H / ART_H)));
    if (under && s <= 1) s = room >= 1.5 ? 1.5 : room >= 1.25 ? 1.25 : Math.min(1, room);
    const aw = Math.round(ART_W * s),
      ah = Math.round(ART_H * s),
      block = ah + (under ? lh : 0);
    return {
      dpr,
      s,
      aw,
      ah,
      under,
      ax: Math.round(rect.x * dpr + (W - aw) / 2),
      ay: Math.round(rect.y * dpr + (H - block) / 2),
    };
  },
  // Lift on hover and a ±1 px bob (none with reduced motion), in whole device px.
  artShift(p, hover, t, slot, reduced) {
    return (
      (hover ? -Math.round(WorldLogic.HOVER_LIFT * p.dpr) : 0) +
      (reduced ? 0 : Math.round(Math.sin(t * 0.7 + (slot || 0) * 1.7)) * Math.max(1, Math.round(p.dpr)))
    );
  },
  stampArt(ctx, img, p, dy, alpha) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, p.ax, p.ay + dy, p.aw, p.ah);
    ctx.restore();
  },
  drawSimpleIsland(ctx, rect, meta, { busy, alert, hover, mine, t, reduced, labelH }) {
    const df = Math.round((this.env ? this.env.df : 1) * 10) / 10,
      lit = Math.min(6, busy | 0),
      color = okColor(meta.color);
    const img = art('i' + color + df + lit + (mine ? 'm' : ''), g => paintIsland(g, color, df, lit, !!mine));
    const p = this.artPlace(rect, labelH),
      dy = this.artShift(p, hover, t, meta.slot, reduced),
      lh = labelH || LABEL_H;
    this.stampArt(ctx, img, p, dy, meta.online === false ? OFFLINE_ALPHA : 1);
    // the name plate hangs from its top edge just under the art (one or two lines), or over the underside when the
    // cell has no room for it
    const top = p.under
      ? (p.ay + p.ah + dy) / p.dpr + 4
      : Math.min(rect.y + rect.h - lh, (p.ay + p.ah + dy) / p.dpr - lh);
    this.drawIslandLabel(ctx, meta, busy, alert, rect.x + rect.w / 2, top, hover, rect.w + 8, true, !!mine);
  },
  drawSlotTile(ctx, rect, kind, o) {
    o = o || {};
    const img = art('t' + kind, g => paintTile(g, kind)),
      p = this.artPlace(rect, o.labelH),
      hover = !!o.hover && kind === 'yours';
    const dy = kind === 'yours' ? this.artShift(p, hover, o.t || 0, 0, o.reduced || kind !== 'yours') : 0;
    this.stampArt(ctx, img, p, dy, 1);
    const x = rect.x + rect.w / 2,
      y = (p.ay + (ISL.cy + 2) * p.s + dy) / p.dpr;
    const B = "600 12px 'JetBrains Mono',monospace",
      S = "500 10px 'JetBrains Mono',monospace";
    if (kind === 'empty')
      plate(ctx, x, y, [[tr('world.slot.empty'), "500 11px 'JetBrains Mono',monospace", '#dfe4ee']], null, 0.55);
    else if (kind === 'yours')
      plate(
        ctx,
        x,
        y,
        [
          [tr('world.slot.yours'), B, '#ffffff'],
          [tr('world.slot.pair'), S, GOLD],
        ],
        hover ? '#ffe08f' : GOLD,
      );
    else
      plate(
        ctx,
        x,
        y,
        [
          [tr('world.slot.full', { n: WorldLogic.SLOTS }), B, '#ffffff'],
          [tr('world.slot.askOwner'), S, '#aab2c5'],
        ],
        '#4a5468',
      );
  },
  // Name, how many are working (muted when offline), a yellow dot when someone waits for approval or another session.
  // Mine (the caller says) has a gold edge; a hovered one a light edge and a darker plate. Wider than maxW (a narrow
  // phone cell), the count goes on a second line and the name is shortened to fit. y is the plate's bottom (6 px
  // above), or with fromTop its top edge, so a two-line plate grows downwards and never climbs over the island.
  // The fit (shortened name, widths) is measured once per name, count text, dot and maxW.
  drawIslandLabel(ctx, m, busy, alert, x, y, hover, maxW, fromTop, mine) {
    const NF = "600 12px 'JetBrains Mono',monospace",
      SF = "500 11px 'JetBrains Mono',monospace";
    const full = clip(m.name || tr('world.island.defaultName'), 24),
      sub = m.private
        ? tr('world.label.private')
        : m.online === false
          ? tr('world.label.busyOffline', { n: busy })
          : tr('world.label.busy', { n: busy });
    const dot = alert ? 14 : 0;
    ctx.save();
    const { name, nw, pw, two } = measured('l\n' + full + '\n' + sub + '\n' + dot + '\n' + maxW, () => {
      let name = full;
      ctx.font = NF;
      let nw = ctx.measureText(name).width;
      ctx.font = SF;
      const sw_ = ctx.measureText(sub).width;
      let pw = Math.ceil(14 + nw + 10 + sw_ + dot + 10),
        two = false;
      if (maxW && pw > maxW) {
        two = true;
        ctx.font = NF;
        while (name.length > 2 && 14 + nw + dot + 10 > maxW) {
          name = clip(name, name.length - 1);
          nw = ctx.measureText(name).width;
        }
        pw = Math.ceil(14 + Math.max(nw + dot, sw_) + 10);
      }
      return { name, nw, pw, two };
    });
    const ph = two ? 36 : 22,
      px = Math.round(x - pw / 2),
      py = Math.round(fromTop ? y : y - ph - 6),
      l1 = two ? py + 11 : py + ph / 2;
    ctx.fillStyle = hover ? 'rgba(10,13,20,0.94)' : 'rgba(16,20,30,0.82)';
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = okColor(m.color);
    ctx.fillRect(px, py, 4, ph);
    if (mine || hover) {
      ctx.strokeStyle = mine ? GOLD : '#e6e9ef';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    }
    ctx.textBaseline = 'middle';
    ctx.font = NF;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, px + 12, l1 + 1);
    ctx.font = SF;
    ctx.fillStyle = m.private ? '#c9cfdc' : m.online === false ? '#7d8599' : '#aab2c5';
    ctx.fillText(sub, two ? px + 12 : px + 12 + nw + 10, two ? py + 26 : l1 + 1);
    if (alert) {
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(px + pw - 12, l1, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  // ---- pointer: hover and click, in content px (the phone layout scrolls) ----
  worldPt(e) {
    const el = this.worldScroller,
      r = el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top + el.scrollTop];
  },
  // The agent under a stage point on the island drawn in full ("Của tôi" or one island), if any.
  oneHit(px, py) {
    const w = this.world,
      id = w.view === 'mine' ? this.myIslandId() : w.focus,
      sc = id && w.scenes.get(id);
    if (!sc || sc.k == null) return null;
    const r = w.oneR || this.oneIslandRect(w.sw, w.sh);
    return sc.hit({
      currentTarget: { getBoundingClientRect: () => ({ left: r.x, top: r.y, width: r.w, height: r.h }) },
      clientX: px,
      clientY: py,
    });
  },
  worldHover(e) {
    const w = this.world,
      el = this.worldScroller;
    if (!el || w.dead || w.trans) return; // no hover while the clouds run
    let hover = null,
      hand = false;
    if (e.type !== 'pointerleave') {
      const [px, py] = this.worldPt(e);
      if (w.view === 'all') {
        const hit = WorldLogic.skyHit(this.skyNow(), px, py);
        hover = hit ? hit.slot : null;
        hand = !!hit && (hit.kind === 'island' || hit.kind === 'mine' || hit.kind === 'yours');
      } else hand = !!this.oneHit(px, py);
    }
    w.hover = hand ? hover : null;
    const cur = hand ? 'pointer' : 'default';
    if (el.style.cursor !== cur) el.style.cursor = cur;
  },
  onWorldClick(e) {
    const w = this.world;
    if (!this.worldScroller || w.dead || w.trans) return; // clicks are dropped while the clouds run
    const [px, py] = this.worldPt(e);
    if (w.view !== 'all') {
      const a = this.oneHit(px, py),
        id = w.view === 'mine' ? this.myIslandId() : w.focus;
      if (a && this.phoneStage(w.sw)) w.sheetOpen = true;
      this.setState(a ? { selIsland: id, sel: a.id } : { sel: null });
      return;
    }
    const hit = WorldLogic.skyHit(this.skyNow(), px, py);
    if (!hit) return;
    if (hit.kind === 'mine' || hit.kind === 'yours') return this.navigate({ view: 'mine' });
    const meta = hit.kind === 'island' && w.islands.find(i => i.slot === hit.slot);
    if (meta) this.navigate({ view: 'one', focus: meta.id });
  },
});
