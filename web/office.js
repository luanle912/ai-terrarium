import { tr } from './i18n.js';
import { SeasonTree } from './season-tree.js';
import { SeasonLogic } from './season-logic.js';
import { SkyLogic } from './sky-logic.js';
import { CameraLogic } from './camera-logic.js';
import { DogLogic } from './dog-logic.js';
import { EventCritters } from './event-critters.js';
import { WorldLogic } from './world-logic.js';
import { WallpaperLogic } from './wallpaper-logic.js';
import { EventLogic } from './event-logic.js';
import {
  BLOCK,
  DOG_PLACES,
  LH,
  LW,
  REAL_WEATHER_EVERY_MS,
  THEMES,
  WEATHER_LABEL,
  dayFactor,
  lerpTheme,
} from './office-scene.js';
// ClaudeOffice, the page component. Its methods are spread over the office-*.js files; each adds its own with
// mixin(ClaudeOffice, class{ ... }), which copies them onto the prototype exactly as if they were written here.
export function mixin(target, src) {
  for (const k of Object.getOwnPropertyNames(src.prototype))
    if (k !== 'constructor')
      Object.defineProperty(target.prototype, k, Object.getOwnPropertyDescriptor(src.prototype, k));
}
export class ClaudeOffice extends React.Component {
  constructor(props) {
    super(props);
    const params = new URLSearchParams(location.search);
    // ?wallpaper=1: only the scene, edge to edge, for the LiveWallpaper app (wallpaper/; office-render.js).
    this.wallpaper = WallpaperLogic.fromSearch(location.search);
    // Over https the page never reads ?server=: a crafted link must not point a hosted page at another host.
    const secure = location.protocol === 'https:';
    const srv = params.get('server') || location.host || 'localhost:4317';
    const ep = secure
      ? location.origin + '/events'
      : srv.includes('/events')
        ? srv
        : (srv.startsWith('http') ? srv : 'http://' + srv) + '/events';
    // Reading localStorage itself can throw (blocked site data), so the storage handle is fetched defensively too.
    try {
      this.storage = window.localStorage;
    } catch (e) {
      this.storage = null;
    }
    const ws = SkyLogic.loadWeatherSettings(this.storage);
    this.state = {
      sel: null,
      paused: false,
      tick: 0,
      live: 'off',
      dataSource: 'live',
      endpoint: ep,
      asOthers: false,
      agentCount: 6,
      speed: 1,
      bubbleMode: this.loadBubbleMode(),
      autoApprove: false,
      showSettings: false,
      weatherMode: ws.mode,
      city: ws.city,
      cityDraft: ws.city,
      realStatus: { state: 'idle', text: '' },
    };
    this.dogWorld = { ...DOG_PLACES, agents: [], hour: 12, snow: 0, calm: false, now: 0, rand: Math.random };
    this.dogs = DogLogic.create(this.dogWorld);
    this.dogSprites = new Map();
    this.agents = [];
    this.seq = 0;
    this.bubbleEls = {};
    this.usedLooks = 0;
    this.last = 0;
    this.seasonKey = 'default';
    this.seasonChoice = SeasonLogic.loadSeasonChoice(this.storage);
    this.seasonPreview = null;
    this.eventChoice = EventLogic.loadChoice(this.storage);
    this.eventPreview = null;
    this.goneSids = new Map();
    this.depts = new Map();
    this.setCanvas = el => {
      this.canvas = el;
    };
    this.setStage = el => {
      this.stageEl = el;
    };
    // The stage clips the scene (overflow hidden) but the browser can still scroll it, e.g. to bring a focused control
    // into view; it would slide the island and leave a band of bare page under the sky. The stage never scrolls.
    this.onStageScroll = () => {
      const st = this.stageEl;
      if (st && (st.scrollTop || st.scrollLeft)) st.scrollTop = st.scrollLeft = 0;
    };
    this.setBack = el => {
      this.backCanvas = el;
    };
    this.setFront = el => {
      this.frontCanvas = el;
    };
    this.setWrap = el => {
      this.wrapEl = el;
    };
    // Weather: this.wx is the SkyLogic transition state; snow (lawn cover) and flash (lightning) are 0..1.
    this.wx = {
      ...SkyLogic.initialWeather('clear', Date.now()),
      nextAt: Date.now() + SkyLogic.changeDelayMs(Math.random()),
    };
    this.snow = 0;
    this.snowShown = 0;
    this.flash = 0;
    this.flashStart = 0;
    this.flashMs = 0;
    this.nextFlashAt = 0;
    this.preview = null;
    this.lastSky = Date.now();
    this.reducedMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    // Phones (narrow, or a phone on its side) get a compact header: one row of controls plus one sideways-scrolling
    // strip, so the island keeps the height. render() runs every 300 ms (uiTimer), so it simply reads the query each
    // time.
    this.narrowMq = window.matchMedia ? window.matchMedia('(max-width: 640px), (max-height: 520px)') : null;
    // Camera: drag pans, wheel/trackpad pinch zooms about the cursor, two fingers pinch-zoom (CameraLogic). kZoom is
    // the zoom the canvas resolution follows; it catches up 150 ms after the last wheel tick so the island bitmap is
    // not re-baked on every tick.
    this.cam = { z: 1, tx: 0, ty: 0 };
    this.kZoom = 1;
    this.drag = null;
    this.dragged = false;
    this.onClick = e => {
      if (this.dragged) {
        this.dragged = false;
        return;
      }
      const a = this.hit(e);
      this.setState({ sel: a ? a.id : null });
    };
    this.onMove = e => {
      if (this.drag) return;
      const a = this.hit(e);
      e.currentTarget.style.cursor = a ? 'pointer' : 'grab';
      this.hoverId = a ? a.id : null;
    };
    this.onLeave = () => {
      this.hoverId = null;
    };
    this.bubbleMem = new Map();
    // Only the island and the open sky react; panels, buttons and the settings form keep their own wheel and clicks.
    this.onScene = e =>
      e.target === this.stageEl || e.target === this.backCanvas || (this.wrapEl && this.wrapEl.contains(e.target));
    this.onWheel = e => {
      if (!this.onScene(e) || !e.deltaY) return;
      e.preventDefault();
      const r = this.stageEl.getBoundingClientRect(),
        b = this.camBox();
      if (!b) return;
      this.setCam(CameraLogic.zoomAt(this.cam, e.clientX - r.left, e.clientY - r.top, CameraLogic.wheelFactor(e), b));
    };
    // Every pointer down on the scene is tracked (stage px). With a second finger down the one-finger drag stops and
    // the view follows CameraLogic.pinch until a finger lifts; the finger left behind does nothing until a new touch.
    this.pts = new Map();
    this.pinchAt = null;
    this.stagePt = e => {
      const r = this.stageEl.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    this.onDown = e => {
      if (e.button !== 0 || !this.onScene(e)) return;
      this.dragged = false;
      if (e.isPrimary) this.pts.clear();
      this.pts.set(e.pointerId, this.stagePt(e));
      if (this.pts.size === 2) {
        const ids = [...this.pts.keys()];
        this.pinchAt = { cam: this.cam, ids, a: this.pts.get(ids[0]), b: this.pts.get(ids[1]) };
        this.drag = null;
        for (const id of ids)
          try {
            this.stageEl.setPointerCapture(id);
          } catch (_) {}
        return;
      }
      if (this.pts.size > 2) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, tx: this.cam.tx, ty: this.cam.ty, on: false };
    };
    this.onDrag = e => {
      if (this.pts.has(e.pointerId)) this.pts.set(e.pointerId, this.stagePt(e));
      const p = this.pinchAt;
      if (p) {
        if (!p.ids.includes(e.pointerId)) return;
        const b = this.camBox();
        if (!b) return;
        this.dragged = true;
        this.setCam(CameraLogic.pinch(p.cam, p.a, p.b, this.pts.get(p.ids[0]), this.pts.get(p.ids[1]), b));
        return;
      }
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x,
        dy = e.clientY - d.y;
      if (!d.on) {
        if (!CameraLogic.isDrag(dx, dy)) return;
        d.on = true;
        try {
          this.stageEl.setPointerCapture(d.id);
        } catch (_) {}
        this.setDragCursor('grabbing');
      }
      const b = this.camBox(),
        [ox, oy] = CameraLogic.dragOffset(dx, dy);
      if (b) this.setCam(CameraLogic.panBy({ z: this.cam.z, tx: d.tx, ty: d.ty }, ox, oy, b));
    };
    this.onUp = e => {
      this.pts.delete(e.pointerId);
      const p = this.pinchAt;
      if (p && p.ids.includes(e.pointerId)) {
        this.pinchAt = null;
        setTimeout(() => {
          this.dragged = false;
        }, 0);
        return;
      }
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      this.drag = null;
      if (d.on) {
        this.dragged = true;
        setTimeout(() => {
          this.dragged = false;
        }, 0);
        this.setDragCursor('grab');
      }
    };
    this.setDragCursor = c => {
      for (const el of [this.canvas, this.backCanvas]) if (el) el.style.cursor = c;
    };
  }

  componentDidMount() {
    this.boot();
    const st = this.stageEl;
    if (st) {
      st.addEventListener('wheel', this.onWheel, { passive: false });
      st.addEventListener('pointerdown', this.onDown);
      st.addEventListener('pointermove', this.onDrag);
      st.addEventListener('pointerup', this.onUp);
      st.addEventListener('pointercancel', this.onUp);
      st.addEventListener('scroll', this.onStageScroll);
      // A resized window changes the fitted layout; pull the view back inside the new limits, and repaint the sky at
      // the new size before the browser shows it (no stretched or short sky for a frame).
      if (window.ResizeObserver) {
        this.ro = new ResizeObserver(() => {
          const b = this.camBox();
          if (b) this.setCam(CameraLogic.clamp(this.cam, b));
          this.drawSky(performance.now() / 1000);
        });
        this.ro.observe(st);
      }
    }
    this.simTimer = setInterval(() => this.simTick(), 250);
    // In world mode a wall-clock jump between two ticks (WAKE_JUMP_MS) means the machine slept: reconnect at once.
    this.uiTimer = setInterval(() => {
      const wall = Date.now();
      if (this.world && this.tickWall && wall - this.tickWall > WorldLogic.WAKE_JUMP_MS)
        this.relink({
          type: 'wake',
          visible: document.visibilityState === 'visible',
          quietMs: wall - (this.world.lastEventWall || 0),
        });
      this.tickWall = wall;
      // Hidden tab: no render and no setState; only finished sub-agents still leave on time.
      if (document.visibilityState === 'hidden') {
        this.doneSweep(wall);
        if (this.world) for (const sc of this.world.scenes.values()) sc.doneSweep(wall);
        return;
      }
      if (performance.now() - (this.lastFrame || 0) > 200) this.frame(performance.now());
      this.setState(s => ({ tick: s.tick + 1 }));
    }, 300);
    // Back from hidden: one frame and one render at once.
    this.onShown = () => {
      if (document.visibilityState !== 'visible') return;
      this.frame(performance.now());
      this.setState(s => ({ tick: s.tick + 1 }));
    };
    document.addEventListener('visibilitychange', this.onShown);
    this.last = performance.now();
    setTimeout(() => this.frame(performance.now()), 0);
    // As a wallpaper only every WallpaperLogic.FPS-th of a second is drawn (wallpaper-logic.js).
    const loop = t => {
      if (!this.wallpaper || WallpaperLogic.frameDue(t, this.wallFrameAt)) {
        this.wallFrameAt = t;
        this.lastFrame = performance.now();
        this.frame(t);
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    window.__sky = {
      preview: type => this.previewWeather(type),
      state: () => ({
        to: this.wx.to,
        fx: SkyLogic.weatherFx(this.wx, Date.now()),
        snow: this.snow,
        snowShown: this.snowShown,
        flash: this.flash,
      }),
    };
    window.__dogs = { dogs: this.dogs, world: this.dogWorld };
    window.__critters = () => ({ list: this.critters, world: this.critterWorld });
    // Santa's sleigh sets off now (on Christmas Eve), for checking the flight
    window.__sleigh = () => this.critterWorld && EventCritters.flyNow(this.critterWorld);
    window.__office = this; // for tools/shot.mjs --eval: switch to simulated agents, pose someone
    // the first person on the floor drops from the EXIT door, as if they had just gone out (for checking the fall)
    window.__fall = () => this.agents[0] && this.startFall(this.agents[0], performance.now() / 1000);
    // the first person on the floor leaves by the named fate (web/fate-logic.js), for checking the scenes
    // (jump: they are there at once). Returns where it happens, in tiles.
    window.__fate = (kind, i = 0, jump = false) => {
      const a = this.agents[i];
      if (!a) return null;
      this.forceFate = kind;
      this.leave(a);
      this.forceFate = null;
      if (jump && a.fateGoal) {
        [a.x, a.y] = a.fateGoal.pt;
        a.gone = a.fated = true;
      }
      return a.fateGoal ? a.fateGoal.pt : null;
    };
    if (this.state.weatherMode === 'real') this.refreshReal();
    this.realTimer = setInterval(() => {
      if (this.state.weatherMode === 'real') this.refreshReal();
    }, REAL_WEATHER_EVERY_MS);
  }
  componentWillUnmount() {
    const st = this.stageEl;
    if (st) {
      st.removeEventListener('wheel', this.onWheel);
      st.removeEventListener('pointerdown', this.onDown);
      st.removeEventListener('pointermove', this.onDrag);
      st.removeEventListener('pointerup', this.onUp);
      st.removeEventListener('pointercancel', this.onUp);
      st.removeEventListener('scroll', this.onStageScroll);
    }
    this.ro && this.ro.disconnect();
    clearTimeout(this.kTimer);
    clearInterval(this.simTimer);
    clearInterval(this.uiTimer);
    clearInterval(this.realTimer);
    cancelAnimationFrame(this.raf);
    this.es && this.es.close();
    clearInterval(this.previewTimer);
    clearTimeout(this.joinTimer);
    clearTimeout(this.armTimer);
    clearTimeout(this.wcTimer);
    this.world && this.world.es && this.world.es.close();
    if (this.onWorldKey) window.removeEventListener('keydown', this.onWorldKey);
    if (this.world) this.stopWorld(this.world);
    if (this.onWorldVisible) document.removeEventListener('visibilitychange', this.onWorldVisible);
    if (this.onShown) document.removeEventListener('visibilitychange', this.onShown);
    if (this.onPreviewVis) document.removeEventListener('visibilitychange', this.onPreviewVis);
    if (this.onWorldOnline) window.removeEventListener('online', this.onWorldOnline);
  }
  // ---- weather settings ----
  // `fromServer`: adopting what another page chose (adoptSettings), so it is not posted back.
  setWeather(patch, fromServer) {
    this.setState(patch, () => {
      SkyLogic.saveWeatherSettings(this.storage, { mode: this.state.weatherMode, city: this.state.city });
      if (!fromServer) this.pushSettings();
      if (this.state.weatherMode === 'real' && (patch.weatherMode === 'real' || 'city' in patch)) this.refreshReal();
      if (this.state.weatherMode !== 'real') this.setState({ realStatus: { state: 'idle', text: '' } });
    });
  }
  // The local server keeps one weather choice for all its pages (lib/page-settings.js) and sends it in every snapshot,
  // so the wallpaper app's web view, which has its own storage and no settings panel, follows what was chosen here.
  // A server that has none yet gets this page's own choice, unless this is the wallpaper (it never chose anything).
  adoptSettings(ps) {
    this.sharedSettings = true;
    // a snapshot sent before our own change reached the server must not undo it
    if (Date.now() - (this.pushedAt || 0) < 3000) return;
    const w = ps && ps.weather;
    if (!w) {
      if (!this.wallpaper && !this.settingsSeeded) this.pushSettings();
      this.settingsSeeded = true;
      return;
    }
    if (w.mode !== this.state.weatherMode || w.city !== this.state.city)
      this.setWeather({ weatherMode: w.mode, city: w.city, cityDraft: w.city }, true);
    // the event choice (EventLogic.adopt): a server that has none yet takes this page's own, sent with the weather
    // the server just gave (this page's own may still be the old one until the state above settles)
    const e = EventLogic.adopt(ps.event, this.eventChoice, { wallpaper: this.wallpaper, seeded: this.eventSeeded });
    if (e.take) this.setEventChoice(e.take, true);
    if (e.seed) this.pushSettings({ mode: w.mode, city: w.city });
    this.eventSeeded = true;
  }
  // The event (web/event-logic.js) on the viewer's clock: a one-minute preview, else the choice in Settings.
  // Asked several times a frame, so the answer is kept for the second it was worked out in.
  eventNow() {
    const now = Date.now(),
      sec = Math.floor(now / 1000),
      c = this.eventChoice || 'auto',
      p = this.eventPreview;
    if (this.evSec !== sec || this.evFor !== c || this.evPrev !== p) {
      this.evSec = sec;
      this.evFor = c;
      this.evPrev = p;
      this.evNow = EventLogic.active(new Date(now), c, p, now);
      EventLogic.block(BLOCK, !!this.evNow); // nobody walks through the big tree while it stands
    }
    return this.evNow;
  }
  setEventChoice(choice, fromServer) {
    if (!EventLogic.CHOICES.includes(choice)) return;
    this.eventChoice = choice;
    EventLogic.saveChoice(this.storage, choice);
    this.setState({ eventChoice: choice });
    if (!fromServer) this.pushSettings();
  }
  pushSettings(weather) {
    if (!this.sharedSettings || typeof fetch !== 'function') return;
    this.pushedAt = Date.now();
    const body = JSON.stringify({
      weather: weather || { mode: this.state.weatherMode, city: this.state.city },
      event: this.eventChoice || 'auto',
    });
    fetch(this.settingsUrl || '/api/settings', {
      method: 'POST',
      headers: { 'X-Terrarium': 'settings', 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
    }).catch(() => {});
  }
  async refreshReal() {
    const city = this.state.city,
      seq = (this.realSeq = (this.realSeq || 0) + 1);
    this.setState({ realStatus: { state: 'loading', text: tr('weather.status.loading') } });
    const r = await SkyLogic.fetchRealWeather(city, url => fetch(url));
    if (seq !== this.realSeq || this.state.weatherMode !== 'real') return; // a newer request or a mode change won
    if (r.ok) {
      if (this.preview)
        this.preview = { ...this.preview, back: r.type }; // the real weather takes over when the preview ends
      else if (this.wx.to !== r.type)
        this.wx = SkyLogic.startTransition(this.wx, r.type, Date.now(), SkyLogic.transitionMs(Math.random()));
      this.setState({
        realStatus: {
          state: 'ok',
          text: tr('weather.status.following', { place: r.place, weather: WEATHER_LABEL[r.type] }),
        },
      });
    } else this.setState({ realStatus: { state: 'error', text: tr('weather.status.fallback', { reason: r.reason }) } });
  }
  // Called every frame: Random steps its schedule, Off settles on clear, Real follows refreshReal (or Random while it
  // fails).
  stepWeather(now) {
    const mode = this.state.weatherMode;
    if (mode === 'random' || (mode === 'real' && this.state.realStatus.state === 'error'))
      this.wx = SkyLogic.stepRandom(this.wx, now, new Date(now).getMonth(), Math.random);
    else if (mode === 'off' && this.wx.to !== 'clear')
      this.wx = SkyLogic.startTransition(this.wx, 'clear', now, SkyLogic.transitionMs(Math.random()));
  }
  componentDidUpdate(_, ps) {
    if (
      ps.dataSource !== this.state.dataSource ||
      ps.endpoint !== this.state.endpoint ||
      ps.asOthers !== this.state.asOthers
    ) {
      this.startSource();
      return;
    }
    if (!this.isLive && ps.agentCount !== this.state.agentCount) {
      const n = this.state.agentCount,
        live = this.agents.filter(a => !a.leaving && !a.parent);
      for (let i = live.length; i < n; i++) this.addAgent({});
      live.slice(n).forEach(a => this.leave(a));
    }
  }
  get isLive() {
    return this.state.dataSource === 'live';
  }
  get speed() {
    return this.state.speed || 1;
  }
  get season() {
    return this.seasonKey && this.seasonKey !== 'default'
      ? this.seasonKey
      : SeasonTree
        ? SeasonTree.seasonFor()
        : 'default';
  }
  // The season the island shows (SeasonLogic): a one-minute preview, else the choice in Settings, else the date.
  // seasonChoice / seasonPreview are set from Settings; until then the date decides.
  // The Christmas event brings winter with it (EventLogic.season), whatever the date or the choice.
  seasonNow() {
    const key = SeasonLogic.currentSeason({
      date: new Date(),
      choice: this.seasonChoice || 'auto',
      preview: this.seasonPreview || null,
      now: Date.now(),
    }).key;
    return EventLogic.season(this.eventNow(), key);
  }
  get treeOn() {
    return this.season !== 'default';
  }
  get theme() {
    const f = dayFactor();
    if (f <= 0) return Object.assign({ _day: 0 }, THEMES.night);
    if (f >= 1) return Object.assign({ _day: 1 }, THEMES.day);
    return lerpTheme(f);
  }

  frame(ts) {
    if (this.world) return this.worldFrame(ts);
    const dt = Math.min(0.05, (ts - this.last) / 1000);
    this.last = ts;
    if (!this.state.paused) {
      this.agents.forEach(a => this.updateAgent(a, dt));
      this.stepDogs(dt);
      this.stepCritters(dt);
      this.stepProps(dt);
      if (this.agents.some(a => a.gone)) {
        const goneA = this.agents.filter(a => a.gone);
        goneA.forEach(a => this.goneSids.set(a.sid, a.leftWhy || 'missing'));
        // out of the EXIT door: they drop straight down from it (web/office-draw-fall.js)
        // or some other way, where they stand (web/office-draw-fate.js)
        goneA.forEach(a => (a.exited ? this.startFall(a, ts / 1000) : a.fated && this.startFate(a)));
        const goneIds = goneA.map(a => a.id);
        this.agents = this.agents.filter(a => !a.gone);
        if (goneIds.includes(this.state.sel)) this.setState({ sel: null });
      }
    }
    this.doneSweep(Date.now());
    this.env = this.envNow();
    this.draw(ts / 1000);
    this.drawSky(ts / 1000);
    for (const a of this.agents) {
      const el = this.bubbleEls[a.id];
      if (!el) continue;
      const [sx, sy] = this.headPos(a);
      el.style.left = Math.min(92, Math.max(8, (sx / LW) * 100)) + '%';
      el.style.top = ((sy - 12) / LH) * 100 + '%';
    }
  }
  // Preview buttons show a weather within 3 s for a minute, then the mode's own weather returns
  // (a snow preview shows a white lawn only while it lasts, see SkyLogic.stepSnow).
  previewWeather(type) {
    if (!SkyLogic.FX[type]) return;
    const r = SkyLogic.startPreview(this.wx, this.preview, type, Date.now());
    this.wx = r.wx;
    this.preview = r.preview;
  }
  // Everything the sky, the island and the office need to agree on for this frame.
  envNow() {
    const now = Date.now(),
      d = new Date(),
      dtMs = Math.min(5000, now - this.lastSky);
    this.lastSky = now;
    if (this.preview) {
      const r = SkyLogic.stepPreview(this.wx, this.preview, now);
      this.wx = r.wx;
      this.preview = r.preview;
    } else this.stepWeather(now);
    // During the Christmas event it snows (unless the weather is switched off in Settings).
    const reduced = !!(this.reducedMq && this.reducedMq.matches),
      ev = this.eventNow(),
      fx = EventLogic.weather(SkyLogic.weatherFx(this.wx, now), this.state.weatherMode === 'off' ? null : ev),
      df = dayFactor();
    // Winter keeps at least its own snow on the lawn, the roofs and the mountain whatever the weather.
    const season = this.seasonNow();
    {
      const sn = SkyLogic.stepSnow(this.snow, fx, this.preview, dtMs);
      this.snow = sn.cover;
      this.snowShown = Math.max(sn.shown, SeasonLogic.look(season).minSnow);
    }
    if (fx.storm > 0.5 && !reduced) {
      if (now >= this.nextFlashAt) {
        this.flashStart = now;
        this.flashMs = SkyLogic.lightningFlashMs(Math.random());
        this.nextFlashAt = now + SkyLogic.lightningDelayMs(Math.random());
      }
    } else this.nextFlashAt = now + 2000;
    this.flash = reduced ? 0 : SkyLogic.flashLevel(now, this.flashStart || 0, this.flashMs || 0);
    const hour = d.getHours() + d.getMinutes() / 60;
    return {
      df,
      hour,
      fx,
      reduced,
      frozen: SeasonLogic.look(season).frozen,
      flash: this.flash,
      col: SkyLogic.skyColors(df, hour, fx),
      season,
      // the Christmas event's level (0: none), for the sky's far islands
      event: ev ? ev.level : 0,
    };
  }
}
