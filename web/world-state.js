// World mode state: the hub stream, my island and devices, removals, navigation between the sky and one island.
import { tr } from './i18n.js';
import { WorldLogic } from './world-logic.js';
import { ClaudeOffice } from './office.js';
import { IslandScene } from './island-scene.js';
import {
  HEX_ID,
  ME_EVERY_MS,
  ME_JITTER,
  ME_PROBE_MS,
  NAME_ERR,
  REMOVE_WAIT_MS,
  VIEW_KEY,
  isJson,
  okColor,
  releaseCanvas,
  validSlot,
} from './world-ui.js';
Object.assign(ClaudeOffice.prototype, {
  startWorld(cfg) {
    let view = 'all';
    try {
      const v = this.storage && this.storage.getItem(VIEW_KEY);
      if (v === 'mine' || v === 'all') view = v;
    } catch (_) {}
    if (this.world) this.stopWorld(this.world); // the hub now serves another account: start afresh
    this.world = {
      me: cfg.me,
      csrf: typeof cfg.csrf === 'string' ? cfg.csrf : '',
      islands: [],
      scenes: new Map(),
      viewers: 0,
      capacity: WorldLogic.SLOTS,
      conn: 'connecting',
      view,
      focus: null,
      hover: null,
      sw: 0,
      sh: 0,
      sky: null,
      dead: false,
      link: WorldLogic.linkStart(),
      linkTimer: null,
      linkDue: 0,
      linkSeq: 0,
      mine: null,
      meErr: false,
      meSeq: 0,
      draft: null,
      confirm: null,
      probe: WorldLogic.meProbeState(),
    };
    this.setState({ sel: null, selIsland: null, live: 'off' });
    // The pointer handlers bound at mount drive the local camera; the world has none of it (no drag, no zoom).
    // Hover and clicks go to a scroller over the canvases, which on a phone also scrolls the sky.
    const st = this.stageEl;
    if (st && !this.setWorldStage)
      for (const [ev, k] of [
        ['wheel', 'onWheel'],
        ['pointerdown', 'onDown'],
        ['pointermove', 'onDrag'],
        ['pointerup', 'onUp'],
        ['pointercancel', 'onUp'],
      ])
        st.removeEventListener(ev, this[k]);
    this.setWorldStage = el => {
      this.stageEl = el;
    };
    this.setWorldCanvas = el => {
      this.worldCanvas = el;
    };
    this.setWorldScroller = el => {
      this.worldScroller = el;
    };
    this.setWorldSpacer = el => {
      this.worldSpacer = el;
    };
    if (!this.onWorldHover) this.onWorldHover = e => this.worldHover(e);
    const w = this.world;
    this.openWorldStream(w);
    // Watchdog: a stream that stays silent PING_STALE_MS after the hub's first named ping froze (a proxy kept the
    // socket open). Reopen it the way a drop does (marked stale, so a hub that keeps answering with silence is
    // reopened less and less often); the scene stays as it is.
    w.watch = setInterval(() => {
      if (this.world !== w || w.dead || !w.es) return;
      if (!WorldLogic.streamStale({ pingSeen: w.pingSeen, lastEventAt: w.lastEventAt, now: performance.now() })) return;
      this.relink({ type: 'error', stale: true });
    }, 5000);
    // "Của tôi" polls only while the tab is visible, and refreshes once when it becomes visible again.
    const tick = () => {
      if (this.world !== w) return;
      if (w.view === 'mine' && !w.dead && document.visibilityState === 'visible') this.loadMe();
      w.meTimer = setTimeout(tick, ME_EVERY_MS * (1 - ME_JITTER + Math.random() * 2 * ME_JITTER));
    };
    w.meTimer = setTimeout(tick, ME_EVERY_MS * (1 - ME_JITTER + Math.random() * 2 * ME_JITTER));
    if (!this.onWorldVisible) {
      this.onWorldVisible = () => {
        const x = this.world;
        if (x && !x.dead && x.view === 'mine' && document.visibilityState === 'visible') this.loadMe();
        if (x && !x.dead && document.visibilityState === 'visible') {
          this.meProbe([], false);
          this.relink({ type: 'visible' });
        }
      };
      document.addEventListener('visibilitychange', this.onWorldVisible);
    }
    if (!this.onWorldOnline) {
      this.onWorldOnline = () => this.relink({ type: 'online' });
      window.addEventListener('online', this.onWorldOnline);
    }
    // Phones (<= 480 px) fold the "Máy mới" notices into one line and use a 16 px name field (no zoom on focus).
    if (!this.phoneMq && window.matchMedia) {
      this.phoneMq = window.matchMedia('(max-width: 480px)');
      const re = () => {
        if (this.world) this.forceUpdate();
      };
      if (this.phoneMq.addEventListener) this.phoneMq.addEventListener('change', re);
      else if (this.phoneMq.addListener) this.phoneMq.addListener(re);
    }
    if (view === 'mine') this.loadMe();
    // Esc: closes an open confirm first, else goes back to "Toàn cảnh"; never while typing or with settings open.
    if (!this.onWorldKey) {
      this.onWorldKey = e => {
        const x = this.world;
        if (e.key !== 'Escape' || !x || x.dead) return;
        const el = e.target,
          typing = !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
        const act = WorldLogic.escAction({
          view: x.view,
          typing,
          settings: !!this.state.showSettings,
          confirm: !!x.confirm,
          mod: e.ctrlKey || e.metaKey || e.altKey,
        });
        if (act === 'confirm') {
          if (x.confirm.busy) return;
          clearTimeout(x.confirm.timer);
          x.confirm = null;
          this.forceUpdate();
        } else if (act === 'back') this.navigate({ view: 'all' });
      };
      window.addEventListener('keydown', this.onWorldKey);
    }
  },
  // Asks /api/me when an unseen island may be mine (WorldLogic.meProbeStep), with one trailing call when throttled.
  meProbe(ids, first) {
    const w = this.world;
    if (!w || w.dead) return;
    const r = WorldLogic.meProbeStep(w.probe, ids, performance.now(), {
      first: !!first,
      visible: document.visibilityState === 'visible',
      hasMine: !!this.myIslandId(),
      every: ME_PROBE_MS,
    });
    clearTimeout(w.probeTimer);
    w.probeTimer = null;
    if (r.fire) this.loadMe();
    else if (r.retryIn != null)
      w.probeTimer = setTimeout(
        () => {
          if (this.world === w) this.meProbe([], false);
        },
        Math.ceil(r.retryIn) + 20,
      );
  },
  // Forget a selection or an owner's "Xoá đảo" question whose island is no longer in the world.
  dropGone() {
    const w = this.world,
      has = id => w.islands.some(i => i.id === id);
    if (w.confirm && w.confirm.kind === 'remove' && !has(w.confirm.id)) {
      clearTimeout(w.confirm.timer);
      w.confirm = null;
      this.forceUpdate();
    }
    if (this.state.selIsland != null && !has(this.state.selIsland)) this.setState({ sel: null, selIsland: null });
    // The island on screen is gone (an owner removed it, or I left the hub on another tab): back through the clouds.
    // While clouds already run, navigate is refused: applyView lands on "Toàn cảnh" by itself, or worldFrame calls
    // this again once they are gone.
    if (WorldLogic.viewGone(w.view, w.view === 'one' ? w.focus : w.shown, has)) this.navigate({ view: 'all' });
  },
  worldMeta(d) {
    const w = this.world;
    // Only islands with a slot 0-7 have a place in the sky (an older hub sends none: nothing is shown).
    w.islands = (Array.isArray(d.islands) ? d.islands : []).filter(
      i => i && typeof i.id === 'string' && validSlot(i.slot),
    );
    w.viewers = Number.isFinite(d.viewers) ? d.viewers : 0;
    w.capacity = Number.isInteger(d.capacity) && d.capacity > 0 ? d.capacity : WorldLogic.SLOTS;
    // Without an island of my own, an island never seen before may be mine (just paired on another tab): ask
    // /api/me, at most once every ME_PROBE_MS, so the centre turns from "chỗ của bạn" into my island by itself.
    this.meProbe(
      w.islands.map(i => i.id),
      !w.metaSeen,
    );
    const ids = new Set(w.islands.map(i => i.id));
    for (const [id, sc] of [...w.scenes])
      if (!ids.has(id)) {
        releaseCanvas(sc);
        w.scenes.delete(id);
      }
    for (const i of w.islands) if (!w.scenes.has(i.id)) w.scenes.set(i.id, new IslandScene(this, i.id));
    this.dropGone();
    // My island's name, colour or sending state changed (a rename from /me, a device going offline...): the
    // "Của tôi" panel asks /api/me again rather than wait for the next poll.
    const m = this.myIsland(),
      sig = m ? JSON.stringify([m.name, m.color, m.online, m.private, m.share]) : '';
    const changed = w.metaSeen && sig !== w.mineSig;
    w.mineSig = sig;
    w.metaSeen = true;
    if (changed && w.view === 'mine' && document.visibilityState === 'visible') this.loadMe();
  },
  // ---- "Của tôi": my island, colours and devices from GET /api/me ----
  loadMe() {
    const w = this.world,
      seq = ++w.meSeq;
    return fetch('/api/me', { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
      .then(r => (r.status === 200 && isJson(r) ? r.json() : Promise.reject(r.status)))
      .then(d => {
        if (this.world !== w || seq !== w.meSeq) return; // an older answer than one already asked for
        if (!d || typeof d !== 'object' || !Array.isArray(d.devices)) throw new Error('shape');
        const island = d.island && typeof d.island === 'object' && HEX_ID.test(d.island.id) ? d.island : null;
        w.mine = {
          island,
          colors: (Array.isArray(d.colors) ? d.colors : []).filter(c => okColor(c) === c),
          devices: d.devices.filter(x => x && typeof x === 'object' && HEX_ID.test(x.id)),
        };
        w.meErr = false;
        if (!w.draft || !w.draft.dirty || !island)
          w.draft = island ? { name: String(island.name || ''), color: island.color, dirty: false } : null;
        // Pairing or removal since the page loaded moves "my island" (and the sky's centre with it).
        const id = island ? island.id : null;
        if (id !== w.me.islandId) w.me = { ...w.me, islandId: id };
      })
      .catch(() => {
        if (this.world === w && seq === w.meSeq) w.meErr = true;
      }) // keep what was shown
      .then(() => {
        if (this.world === w) this.forceUpdate();
      });
  },
  postJson(path, body) {
    return fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.world.csrf, accept: 'application/json' },
      body: JSON.stringify(body || {}),
    })
      .then(r =>
        (isJson(r) ? r.json().catch(() => null) : Promise.resolve(null)).then(data => ({ status: r.status, data })),
      )
      .catch(() => ({ status: 0, data: null }));
  },
  saveIsland() {
    const w = this.world,
      d = w.draft;
    if (!d || w.saving) return;
    w.saving = true;
    w.saveMsg = null;
    this.forceUpdate();
    const sent = { name: d.name, color: d.color };
    this.postJson('/api/me/island', sent).then(({ status, data }) => {
      if (this.world !== w) return;
      w.saving = false;
      const i = status === 200 && data && data.island;
      // Typing went on while the save was in flight: keep what is in the field (still unsaved).
      const same = w.draft === d && d.name === sent.name && d.color === sent.color;
      if (i) {
        if (same) w.draft = { name: String(i.name || ''), color: i.color, dirty: false };
        w.saveMsg = { ok: true, text: tr('world.save.ok') };
      } else
        w.saveMsg = {
          ok: false,
          text: status === 400 ? NAME_ERR : status === 404 ? tr('world.save.noIsland') : tr('world.save.failed'),
        };
      this.loadMe();
    });
  },
  // Revoke one of my devices, after the in-panel "Thu hồi <tên>?".
  revokeDevice(id) {
    const w = this.world,
      c = w.confirm;
    if (!c || c.busy || !HEX_ID.test(id)) return;
    c.busy = true;
    c.err = null;
    this.forceUpdate();
    this.postJson('/api/me/devices/' + id + '/revoke').then(({ status }) => {
      if (this.world !== w) return;
      if (status === 200) {
        if (w.confirm === c) w.confirm = null;
      } else {
        c.busy = false;
        c.err = tr('world.revoke.failed');
      }
      this.loadMe();
    });
  },
  // Owner: remove someone's island. Success shows up as the stream's 'remove' event, which closes the panel.
  removeIsland(id) {
    const w = this.world,
      c = w.confirm;
    if (!c || c.busy || !HEX_ID.test(id)) return;
    c.busy = true;
    c.err = null;
    this.forceUpdate();
    this.postJson('/api/owner/islands/' + id + '/remove').then(({ status, data }) => {
      if (this.world !== w || w.confirm !== c) return;
      // Stays "Đang gửi…" until the 'remove' event; if that is lost, the question closes after REMOVE_WAIT_MS anyway.
      if (status === 200) {
        c.timer = setTimeout(() => {
          if (this.world === w && w.confirm === c) {
            w.confirm = null;
            this.forceUpdate();
          }
        }, REMOVE_WAIT_MS);
        return;
      }
      c.busy = false;
      c.err =
        status === 403 && data && data.error === 'owner_island'
          ? tr('world.remove.ownerIsland')
          : tr('world.remove.failed');
      this.forceUpdate();
    });
  },
  // My island: the one /api/me (or the page's config) names, only while the hub lists it in a slot.
  myIslandId() {
    const w = this.world,
      m = w.mine,
      id = m && m.island ? m.island.id : w.me.islandId;
    return id && w.islands.some(i => i.id === id) ? id : null;
  },
  mySlot() {
    const id = this.myIslandId(),
      m = id && this.world.islands.find(i => i.id === id);
    return m ? m.slot : null;
  },
  myIsland() {
    const id = this.myIslandId();
    return id ? this.world.islands.find(i => i.id === id) : null;
  },
  // Moves between "Toàn cảnh" ('all'), one island ('one', focus = its id) and "Của tôi" ('mine') through the cloud
  // transition: worldFrame swaps the view (applyView) once the clouds cover it. A second request while the clouds
  // run is dropped, not queued.
  navigate(to) {
    const w = this.world;
    if (!w || w.dead) return;
    const now = performance.now(),
      reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const t = WorldLogic.beginTrans(
      { trans: w.trans, reduced: w.transReduced, view: w.view, focus: w.focus },
      to,
      now,
      reduced,
    );
    if (!t) return;
    w.trans = t;
    w.transReduced = reduced;
    w.hover = null;
    const el = this.worldScroller;
    if (el && el.style.cursor !== 'default') el.style.cursor = 'default';
  },
  // Called once per transition, behind full cover. An island removed meanwhile lands on "Toàn cảnh".
  applyView(to) {
    const w = this.world,
      { view, focus } = WorldLogic.landingView(to, id => w.islands.some(i => i.id === id));
    const old = w.shown && w.scenes.get(w.shown);
    if (old) releaseCanvas(old);
    w.view = view;
    w.focus = focus;
    w.hover = null;
    w.shown = null;
    w.oneR = null;
    w.sheetOpen = null;
    if (view !== 'one')
      try {
        this.storage && this.storage.setItem(VIEW_KEY, view);
      } catch (_) {}
    if (w.confirm) clearTimeout(w.confirm.timer);
    w.confirm = null;
    this.setState({ sel: null, selIsland: focus });
    if (view === 'mine' && !w.dead) this.loadMe();
  },
});
