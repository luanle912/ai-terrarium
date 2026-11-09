// World mode link to the hub: the stream itself, reconnecting by the page's own timer (WorldLogic.linkStep), and the
// strip shown while the link is lost. The islands stay on screen, dimmed, until KEEP_STALE_MS without a connection.
import { tr } from './i18n.js';
import { WorldLogic } from './world-logic.js';
import { h } from './office-scene.js';
import { ClaudeOffice } from './office.js';
import { IslandScene } from './island-scene.js';
import { ONE_TOP, SMALL_BTN, probeConfig, releaseCanvas } from './world-ui.js';

const parse = e => {
  try {
    const d = JSON.parse(e.data);
    return d && typeof d === 'object' ? d : null;
  } catch (_) {
    return null;
  }
};

Object.assign(ClaudeOffice.prototype, {
  // Opens /api/world/stream for world w (closing one still open). Every event (and the open itself) counts as a sign
  // of life for the watchdog; a named one also clears the watchdog's count of silent reopens.
  openWorldStream(w) {
    const alive = () => {
        w.lastEventAt = performance.now();
        w.lastEventWall = Date.now(); // the wall clock keeps running through a sleep
      },
      heard = () => {
        alive();
        if (w.link.stale && w.es === es) this.relink({ type: 'heard' });
      };
    alive();
    if (w.es) w.es.close();
    const es = new EventSource('/api/world/stream');
    w.es = es;
    es.onopen = () => {
      if (w.dead || w.es !== es) return;
      alive();
      this.relink({ type: 'open' });
    };
    // The page reconnects by itself (relink), so the browser's own retry is cut short: CLOSED means the hub
    // answered with an error (401/403, 429/503, a proxy's 502), else the connection dropped.
    es.onerror = () => {
      if (w.dead || w.es !== es) return;
      this.relink({ type: es.readyState === EventSource.CLOSED ? 'closed' : 'error' });
    };
    // The hub is about to restart and says when to come back (jittered per viewer, so not all at once).
    es.addEventListener('restarting', e => {
      if (w.dead || w.es !== es) return;
      const d = parse(e);
      this.relink({ type: 'restarting', retryMs: d && d.retryMs });
    });
    es.addEventListener('ping', () => {
      w.pingSeen = true;
      heard();
    });
    es.addEventListener('world', e => {
      heard();
      const d = parse(e);
      if (d) this.worldMeta(d);
    });
    es.addEventListener('island', e => {
      heard();
      const d = parse(e);
      if (!d || typeof d.id !== 'string' || w.dead) return;
      if (w.metaSeen && !w.islands.some(i => i.id === d.id)) return; // not (or no longer) in the world list
      let sc = w.scenes.get(d.id);
      if (!sc) {
        sc = new IslandScene(this, d.id);
        w.scenes.set(d.id, sc);
      }
      sc.sync(Array.isArray(d.sessions) ? d.sessions.filter(s => s && typeof s.id === 'string') : []);
    });
    es.addEventListener('remove', e => {
      heard();
      const d = parse(e);
      if (!d || typeof d.id !== 'string' || w.dead) return;
      const sc = w.scenes.get(d.id);
      if (sc) releaseCanvas(sc);
      w.scenes.delete(d.id);
      w.islands = w.islands.filter(i => i.id !== d.id);
      this.dropGone();
    });
  },
  // Every timer and the stream of a world being replaced.
  stopWorld(w) {
    w.dead = true;
    w.es && w.es.close();
    w.es = null;
    clearTimeout(w.meTimer);
    clearInterval(w.watch);
    clearTimeout(w.probeTimer);
    clearTimeout(w.linkTimer);
    this.legendListen(false);
  },
  // One step of the link to the hub (WorldLogic.linkStep), then what it asks for: close the stream that failed, one
  // planned connect (w.linkTimer), ask /api/config why (probe), reload, or wipe a scene kept too long. A probe saying
  // another account is signed in now starts the world afresh.
  relink(ev) {
    const w = this.world;
    if (!w || w.dead) return;
    const before = w.link.phase,
      r = WorldLogic.linkStep(w.link, ev, Date.now(), Math.random()),
      a = r.act;
    w.link = r.link;
    if (a.reload) {
      this.stopWorld(w);
      return location.reload();
    }
    if (a.close || ev.type === 'error' || ev.type === 'closed' || ev.type === 'restarting') {
      if (w.es) w.es.close();
      w.es = null;
    }
    if (a.wipe && (w.scenes.size || w.islands.length)) this.wipeWorld(w);
    if (a.connectIn != null) {
      clearTimeout(w.linkTimer);
      w.linkDue = performance.now() + a.connectIn;
      w.linkTimer = setTimeout(() => {
        if (this.world !== w || w.dead) return;
        w.linkTimer = null;
        w.linkDue = 0;
        this.openWorldStream(w);
        this.forceUpdate();
      }, a.connectIn);
    }
    if (ev.type === 'open') {
      clearTimeout(w.linkTimer);
      w.linkTimer = null;
      w.linkDue = 0;
    }
    if (a.probe) {
      const seq = ++w.linkSeq;
      probeConfig().then(x => {
        if (this.world !== w || w.dead || seq !== w.linkSeq) return;
        if (x.kind === 'world' && x.cfg.me.id !== w.me.id) return this.startWorld(x.cfg);
        this.relink({ type: 'probe', kind: x.kind, retryS: x.retryS });
      });
    }
    const p = w.link.phase,
      conn =
        p === 'live'
          ? ev.type === 'open' || w.conn !== 'connecting'
            ? 'ok'
            : 'connecting'
          : p === 'reconnecting'
            ? 'error'
            : p === 'down'
              ? 'unreachable'
              : p;
    if (conn !== w.conn || p !== before || a.connectIn != null) {
      w.conn = conn;
      this.forceUpdate();
    }
  },
  // No connection for KEEP_STALE_MS: what is shown is too old to keep. The next 'world' event fills the sky again.
  wipeWorld(w) {
    for (const sc of w.scenes.values()) releaseCanvas(sc);
    w.scenes.clear();
    w.islands = [];
    w.viewers = 0;
    w.hover = null;
    if (w.confirm) clearTimeout(w.confirm.timer);
    w.confirm = null;
    this.setState({ sel: null, selIsland: null });
  },
  // Whole seconds until the planned reconnect.
  linkWaitS() {
    const w = this.world;
    return w.linkDue ? Math.max(0, Math.ceil((w.linkDue - performance.now()) / 1000)) : 0;
  },
  // A strip across the top of the stage while the link is lost: yellow while reconnecting, red with a countdown and
  // "Thử lại ngay" while the hub does not answer. Refused and busy have their panel instead.
  worldLinkBand() {
    const w = this.world,
      p = w.link.phase;
    if (w.dead || (p !== 'reconnecting' && p !== 'down')) return null;
    const down = p === 'down',
      col = down ? '#e5484d' : '#f5a524';
    // Below the "← Toàn cảnh" plaque when it is shown, so a two-line strip on a phone is never covered by it.
    return h(
      'div',
      {
        role: 'status',
        style: {
          position: 'absolute',
          zIndex: 9,
          top: w.view !== 'all' ? ONE_TOP : 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px 10px',
          padding: '5px 12px',
          background: down ? 'rgba(64,16,20,0.92)' : 'rgba(56,42,8,0.92)',
          borderBottom: '2px solid ' + col,
          color: '#ffffff',
          fontSize: 12,
          lineHeight: 1.4,
          textAlign: 'center',
          pointerEvents: 'none',
        },
      },
      h('span', { style: { width: 8, height: 8, background: col, display: 'inline-block', flex: 'none' } }),
      h('span', null, down ? tr('world.link.down', { s: this.linkWaitS() }) : tr('world.link.reconnecting')),
      down &&
        h(
          'button',
          {
            type: 'button',
            className: 'btn',
            style: { ...SMALL_BTN, pointerEvents: 'auto', borderColor: col },
            onClick: () => this.relink({ type: 'online' }),
          },
          tr('world.link.retryNow'),
        ),
    );
  },
});
