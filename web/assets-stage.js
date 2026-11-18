// The stage the /assets page draws every item on, with the game's own code: the scene an item is shown in (env, as
// the game's envNow builds it), a small iso projection round any point, the island painter and colour function the
// island bake uses, the furniture and pantry kits, the G of the office's draw methods, and a stand-in host that
// inherits ClaudeOffice's methods. recordingCtx() is a canvas that only counts and measures what it is told: the tests
// draw every entry on it, and the page uses it to size cards and read palettes. The small helpers the catalogue
// modules share (axis, valueIndex, dfB, xmasEvent) are here too. Sprites, props and scene cards cut from the baked
// island are in web/assets-scene.js.
import { SCENE_DOG_SPRITES } from './island-scene.js';
import { ClaudeOffice } from './office.js';
// The office's draw methods, every module that adds them to ClaudeOffice (the page's main.js loads them for the game;
// the host reaches them through the class, whenever they were added).
import './office-agents.js';
import './office-draw.js';
import './office-draw-furniture.js';
import './office-draw-restroom.js';
import './office-draw-smoking.js';
import './office-draw-doghouse.js';
import './office-draw-fall.js';
import './office-draw-fate.js';
import './office-draw-fate-more.js';
import './office-draw-fate-xmas.js';
import './office-draw-winter.js';
import './office-draw-xmas.js';
import './office-draw-cathedral.js';
import './office-draw-critters.js';
import './office-draw-bears.js';
import './office-draw-idle-xmas.js';
import './office-draw-people.js';
import { DOG_PLACES, FLOOR_Z, P as SCENE_P, PG as SCENE_PG, THEMES, TH, TW, lerpTheme } from './office-scene.js';
import { OfficeDecor } from './office-decor.js';
import { PantryItems } from './pantry-items.js';
import { painter } from './island-art.js';
import { bakeTools } from './sky-island.js';
import { SeasonLogic } from './season-logic.js';
import { SkyLogic } from './sky-logic.js';
import { EventLogic } from './event-logic.js';
import { Theme } from './theme.js';
import { isCold, officeG } from './office-util.js';

// ---- shared by the catalogue modules ----
// An axis of an entry's variants: {id, label() , values: [{id, label(), swatch?}]}.
const axis = (id, label, values) => ({ id, label, values });
// Where the value `id` is among an axis's values (the first when it is not one of them).
const valueIndex = (ax, id) => {
  for (let i = 0; i < ax.values.length; i++) if (ax.values[i].id === id) return i;
  return 0;
};
// The light level (0..10) the office's sprite caches are keyed on, as its draw() rounds it.
const dfB = view => Math.round(view.env.df * 10);
// The Christmas event as EventLogic.active gives it ({key, level, eve, day}), one object per level and eve.
const XMAS = [false, true].map(eve => [1, 2, 3].map(level => ({ key: 'christmas', level, eve, day: true })));
const xmasEvent = (level, eve = true) => XMAS[eve ? 1 : 0][level - 1] || null;

// ---- the scene ----
// Daylight (df) and the clock hour each light stands for: noon, the middle of the evening fade, late night.
const LIGHT = { day: [1, 12], dusk: [0.5, 17.25], night: [0, 22.5] };
const EVENTS = [null, 1, 2, 3].map(l => l && xmasEvent(l));
const ENVS = new Map();
// The env the game would hand its draw code under these controls ({light, season, snow, event}), the same object
// for the same controls so caches keyed on it hold. As in the game the Christmas event brings winter. On top of
// envNow's shape: snow (0 or 1, the cover lying on the lawn), theme (the office colours lerped day to night), light
// (the control it was made from) and key (one string per scene, for caches). look is the Look (web/theme.js) of a
// moment in the scene's season with the event on from the day its level stands for (levels 1, 2, 3: days 0, 7, 14,
// the gift steps), no small holiday.
function envOf({ light = 'day', season = 'summer', snow = false, event = 0 } = {}) {
  const key = light + '|' + season + '|' + (snow ? 1 : 0) + '|' + event;
  let env = ENVS.get(key);
  if (env) return env;
  if (!LIGHT[light]) light = 'day';
  const [df, hour] = LIGHT[light],
    fx = { ...SkyLogic.FX.clear },
    ev = EVENTS[event] || null,
    s = EventLogic.season(ev, season);
  env = {
    df,
    hour,
    fx,
    reduced: false,
    frozen: SeasonLogic.look(s).frozen,
    flash: 0,
    col: SkyLogic.skyColors(df, hour, fx),
    season: s,
    event: ev ? ev.level : 0,
    look: lookOf(s, ev),
    snow: snow ? 1 : 0,
    theme: df >= 1 ? { _day: 1, ...THEMES.day } : df <= 0 ? { _day: 0, ...THEMES.night } : lerpTheme(df),
    light,
    key,
  };
  ENVS.set(key, env);
  return env;
}
function lookOf(season, ev) {
  const event = ev ? { key: ev.key, since: (ev.level - 1) * 7 } : null;
  return Theme.resolve({
    season,
    holiday: null,
    event,
    key: 'assets|' + season + '|' + (event ? event.key + '@' + event.since : '-'),
  });
}
// The event object of an env ({key, level, eve, day}, as EventLogic.active gives it), or null.
const eventOf = env => EVENTS[(env && env.event) || 0] || null;

// ---- a stand-in office ----
// What the office's draw methods read off `this`, answered from the view's env; the methods themselves are
// ClaudeOffice's, inherited (so a method a mixin adds after this module loads is there too). An entry may set the
// office's people, dogs, departments and the like for its draw: stage() hands every draw a clean host (clean()), so
// what one entry set never shows in the next one drawn on the same canvas. Only real caches live on.
const DOG_WORLD = { ...DOG_PLACES, agents: [], hour: 12, snow: 0, calm: true, now: 0, rand: () => 0.5 };
class StageHost {
  constructor() {
    this.view = null;
    this.dogSprites = SCENE_DOG_SPRITES;
    this.cache = null;
    this.blank = {
      agents: [],
      depts: new Map(),
      state: { sel: null, paused: false, weatherMode: 'off' },
      dogs: [],
      dogWorld: { ...DOG_WORLD },
      critters: [],
      bears: [],
    };
    this.clean();
  }
  // Back to an empty office: nobody in it, no departments, no dogs or critters, nothing lit, no event tree.
  clean() {
    const b = this.blank;
    b.agents.length = b.dogs.length = b.critters.length = b.bears.length = 0;
    b.depts.clear();
    b.state.sel = null;
    b.state.paused = false;
    b.state.weatherMode = 'off';
    Object.assign(b.dogWorld, DOG_WORLD);
    this.agents = b.agents;
    this.depts = b.depts;
    this.state = b.state;
    this.dogs = b.dogs;
    this.dogWorld = b.dogWorld;
    this.critters = b.critters;
    this.bears = b.bears;
    this.noUsage = true;
    this.propLit = null;
    this.holiday = 'default'; // the event tree's key (web/season-tree.js); 'default' for none
  }
  get env() {
    return this.view && this.view.env;
  }
  get theme() {
    return this.env.theme;
  }
  get snowShown() {
    return this.env.snow;
  }
  get season() {
    return this.holiday || 'default';
  }
  get islandCache() {
    return this.cache;
  }
  set islandCache(v) {
    this.cache = v;
  }
  seasonNow() {
    return this.env.season;
  }
  // the office's look (ClaudeOffice#computeMoment), here the view's: what the people and the dogs wear
  get look() {
    return this.env.look;
  }
  eventNow() {
    return eventOf(this.env);
  }
  setState() {}
  forceUpdate() {}
}
// The host's own getters and methods above come first; everything else is the office's.
Object.setPrototypeOf(StageHost.prototype, ClaudeOffice.prototype);

// ---- the stage ----
// One stage per canvas: the projection, the island painter, the kits and the colours are rebuilt only when the anchor
// or the env changes, so drawing a card frame after frame makes nothing new. The G is the office's own (officeG, in
// the scene's projection), set from the env for every draw as the office sets it every frame: the theme, daylight,
// the event, the look and the cold (breath shows); t when given.
const NO_FRAME = { OX: 0, OY: 0 };
class Stage {
  constructor(ctx) {
    this.ctx = ctx;
    this.ox = 0;
    this.oy = 0;
    this.env = null;
    this.view = null;
    const lawn = (x, y, z = 0) => [this.ox + (x - y) * TW, this.oy + (x + y) * TH - z];
    this.PG = lawn;
    this.P = (x, y, z = 0) => lawn(x, y, z + FLOOR_Z);
    this.pt = painter(ctx, lawn);
    this.G = officeG(ctx, SCENE_P, null);
    this.host = new StageHost();
    this.at = { x: NaN, y: NaN, z: NaN, lawn: false, sx: 0, sy: 0 };
    this._kit = this._pantryKit = this._tools = this._framed = null;
  }
  aim(view) {
    if (view.ox !== this.ox || view.oy !== this.oy) {
      this.ox = view.ox;
      this.oy = view.oy;
      this._kit = this._pantryKit = null;
    }
    if (view.env !== this.env) {
      this.env = view.env;
      this._tools = null;
    }
    const env = this.env,
      G = this.G;
    G.th = env.theme;
    G.df = env.df;
    G.ev = eventOf(env);
    G.look = env.look;
    G.cold = isCold(env.snow, env.df, env);
    this.view = view;
    this.host.view = view;
    this.host.clean();
  }
  // The furniture kit (web/decor-kit.js) and the pantry kit (web/pantry-kit.js), both standing at (ox, oy).
  get kit() {
    return this._kit || (this._kit = OfficeDecor.kit(this.ctx, this.ox, this.oy));
  }
  get pantryKit() {
    return this._pantryKit || (this._pantryKit = PantryItems.kit(this.ctx, this.ox, this.oy));
  }
  // The island's colours, from web/sky-island.js bakeTools: C(colour, snowAmount) through the season's grass tint,
  // the snow cover and the night; S for lying snow; look the season; depth the snow's depth level.
  get tools() {
    return this._tools || (this._tools = bakeTools(NO_FRAME, this.env));
  }
  get look() {
    return this.tools.look;
  }
  get C() {
    return this.tools.C;
  }
  get S() {
    return this.tools.S;
  }
  get depth() {
    return this.tools.depth;
  }
  // Runs fn with the canvas moved so the office scene's point (x, y, z) lands on (ox, oy): what the office's draw
  // methods need, as they draw in the scene's own projection (on the office floor; `lawn` for the lawn level). The
  // point last asked for is kept, so a card asking for the same one every frame makes nothing new.
  scene(x, y, z, fn, lawn) {
    const a = this.at,
      ctx = this.ctx,
      zz = z || 0,
      ll = !!lawn;
    if (a.x !== x || a.y !== y || a.z !== zz || a.lawn !== ll) {
      const p = (ll ? SCENE_PG : SCENE_P)(x, y, zz);
      a.x = x;
      a.y = y;
      a.z = zz;
      a.lawn = ll;
      a.sx = p[0];
      a.sy = p[1];
    }
    ctx.save();
    ctx.translate(this.ox - a.sx, this.oy - a.sy);
    try {
      fn();
    } finally {
      ctx.restore();
    }
  }
  // Runs fn(c) with c the canvas as a game draw that sets its own transform expects it: c.setTransform(m) is m on top
  // of the transform in force when framed() is called (the scene's, in scene()), as if that were the canvas's own,
  // and puts back the rest of the canvas state as it was then. Everything else goes straight to the canvas.
  framed(fn) {
    const ctx = this.ctx;
    ctx.save();
    try {
      fn(this._framed || (this._framed = framedCtx(ctx)));
    } finally {
      ctx.restore();
    }
  }
}
// (see Stage.framed) The canvas's methods bound once each, so handing it out frame after frame makes nothing new.
function framedCtx(ctx) {
  const bound = new Map(),
    setTransform = (a, b, c, d, e, f) => {
      ctx.restore();
      ctx.save();
      ctx.transform(a, b, c, d, e, f);
    };
  return new Proxy(ctx, {
    get(t, k) {
      if (k === 'setTransform') return setTransform;
      const v = t[k];
      if (typeof v !== 'function') return v;
      let f = bound.get(k);
      if (!f) bound.set(k, (f = v.bind(t)));
      return f;
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
}
const STAGES = new WeakMap();
// view = {ox, oy, env, pick}; t (optional) is the clock for G.t. Every call hands the draw a clean host.
function stage(ctx, view, t) {
  let s = STAGES.get(ctx);
  if (!s) STAGES.set(ctx, (s = new Stage(ctx)));
  s.aim(view);
  if (t !== undefined) s.G.t = t;
  return s;
}

// ---- a canvas that counts ----
const DRAWS = { fill: 1, fillRect: 1, stroke: 1, strokeRect: 1, drawImage: 1, putImageData: 1, fillText: 1 };
const STATE = ['fillStyle', 'strokeStyle', 'globalAlpha', 'lineWidth', 'font', 'globalCompositeOperation'];
const hex2 = v =>
  Math.max(0, Math.min(255, Math.round(v)))
    .toString(16)
    .padStart(2, '0');
// '#abc', '#AABBCC', 'rgb(…)' and opaque 'rgba(…)' as '#aabbcc'; anything see-through or not a colour as null.
function solid(c) {
  if (typeof c !== 'string') return null;
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return '#' + [...m[1].toLowerCase()].map(x => x + x).join('');
  m = /^#([0-9a-f]{6})(ff)?$/i.exec(c);
  if (m) return '#' + m[1].toLowerCase();
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(c);
  if (m && (m[4] == null || +m[4] >= 0.99)) return '#' + hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3]);
  return null;
}
// The counting canvases made for a canvas object (the tests' sprite canvases): a drawImage of one folds what is on it
// now into the signature, so sprites that differ only in their pixels tell apart. What is on it is what was drawn
// since it was last cleared (a clearRect over all of it, or a new width or height), as on a real canvas, so a sprite
// cache that paints its canvas again shows only the new picture.
const COUNTING = new WeakMap();
function recordingCtx(canvas) {
  const cv = canvas || { width: 1024, height: 1024 };
  let m = [1, 0, 0, 1, 0, 0],
    clip = null,
    path = null,
    box = null,
    drawn = 0,
    sig = 2166136261,
    stack = [];
  const tally = new Map();
  const mix32 = v => {
    sig = Math.imul(sig ^ (v | 0), 16777619) >>> 0;
  };
  const mixStr = s => {
    for (let i = 0; i < s.length; i++) mix32(s.charCodeAt(i));
  };
  const tx = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const grow = (b, x, y) =>
    b ? [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)] : [x, y, x, y];
  const addPt = (x, y) => {
    const [a, b] = tx(x, y);
    path = grow(path, a, b);
  };
  const corners = (b, x, y, w, h) => {
    for (const [px, py] of [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ]) {
      const [a, c] = tx(px, py);
      b = grow(b, a, c);
    }
    return b;
  };
  const cut = b => {
    if (!b || !clip) return b;
    const r = [Math.max(b[0], clip[0]), Math.max(b[1], clip[1]), Math.min(b[2], clip[2]), Math.min(b[3], clip[3])];
    return r[0] < r[2] && r[1] < r[3] ? r : null;
  };
  // One drawing command: counted, folded into the signature, its box added to the bounds, its colour to the tally.
  const mark = (op, b, colour, area, args) => {
    drawn++;
    mixStr(op);
    mixStr(typeof colour === 'string' ? colour : '?');
    mix32(Math.round(o.globalAlpha * 100));
    for (let i = 0; i < args.length; i++) if (typeof args[i] === 'number') mix32(Math.round(args[i] * 4));
    const c = cut(b);
    if (!c) return;
    box = box ? [Math.min(box[0], c[0]), Math.min(box[1], c[1]), Math.max(box[2], c[2]), Math.max(box[3], c[3])] : c;
    const s = solid(colour);
    if (s && area > 0) tally.set(s, (tally.get(s) || 0) + area * o.globalAlpha);
  };
  const area = b => (b ? (b[2] - b[0]) * (b[3] - b[1]) : 0);
  const wipe = () => {
    box = null;
    drawn = 0;
    sig = 2166136261;
    tally.clear();
  };
  const o = {
    canvas: cv,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1,
    lineWidth: 1,
    font: '10px sans-serif',
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    get drawn() {
      return drawn;
    },
    // The box everything drawn so far covers (clips applied), in whole canvas px, or null when nothing shows.
    bounds() {
      return box && { x0: Math.floor(box[0]), y0: Math.floor(box[1]), x1: Math.ceil(box[2]), y1: Math.ceil(box[3]) };
    },
    // The n solid colours drawn over the most area, most first.
    palette(n = 8) {
      return [...tally.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(e => e[0]);
    },
    signature() {
      return sig.toString(36) + ':' + drawn;
    },
    reset() {
      m = [1, 0, 0, 1, 0, 0];
      clip = path = null;
      stack = [];
      wipe();
    },
    save() {
      stack.push([m.slice(), clip, STATE.map(k => o[k])]);
    },
    restore() {
      const s = stack.pop();
      if (!s) return;
      m = s[0];
      clip = s[1];
      STATE.forEach((k, i) => (o[k] = s[2][i]));
    },
    setTransform(a, b, c, d, e, f) {
      m = typeof a === 'object' && a ? [a.a, a.b, a.c, a.d, a.e, a.f] : [a, b, c, d, e, f];
    },
    resetTransform() {
      m = [1, 0, 0, 1, 0, 0];
    },
    getTransform() {
      return { a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] };
    },
    transform(a, b, c, d, e, f) {
      const [A, B, C, D, E, F] = m;
      m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F];
    },
    translate(x, y) {
      o.transform(1, 0, 0, 1, x, y);
    },
    scale(x, y) {
      o.transform(x, 0, 0, y, 0, 0);
    },
    rotate(r) {
      o.transform(Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0);
    },
    beginPath() {
      path = null;
    },
    closePath() {},
    moveTo: addPt,
    lineTo: addPt,
    rect(x, y, w, h) {
      path = corners(path, x, y, w, h);
    },
    roundRect(x, y, w, h) {
      path = corners(path, x, y, w, h);
    },
    arc(x, y, r) {
      path = corners(path, x - r, y - r, 2 * r, 2 * r);
    },
    ellipse(x, y, rx, ry) {
      path = corners(path, x - rx, y - ry, 2 * rx, 2 * ry);
    },
    arcTo(x1, y1, x2, y2) {
      addPt(x1, y1);
      addPt(x2, y2);
    },
    quadraticCurveTo(cx, cy, x, y) {
      addPt(cx, cy);
      addPt(x, y);
    },
    bezierCurveTo(a, b, c, d, x, y) {
      addPt(a, b);
      addPt(c, d);
      addPt(x, y);
    },
    clip() {
      clip = path ? (clip ? cut(path) || [0, 0, 0, 0] : path) : [0, 0, 0, 0];
    },
    fill() {
      mark('fill', path, o.fillStyle, area(path), path || []);
    },
    stroke() {
      const w = o.lineWidth / 2,
        b = path && [path[0] - w, path[1] - w, path[2] + w, path[3] + w];
      mark('stroke', b, o.strokeStyle, b ? (b[2] - b[0] + b[3] - b[1]) * o.lineWidth : 0, path || []);
    },
    fillRect(x, y, w, h) {
      const b = corners(null, x, y, w, h);
      mark('fillRect', b, o.fillStyle, area(b), [x, y, w, h]);
    },
    strokeRect(x, y, w, h) {
      const b = corners(null, x, y, w, h);
      mark('strokeRect', b, o.strokeStyle, 0, [x, y, w, h]);
    },
    // Clearing all that was drawn (within the canvas) wipes it: a sprite cache painting its canvas again.
    clearRect(x, y, w, h) {
      const b = corners(null, x, y, w, h);
      if (
        !box ||
        (b[0] <= Math.max(0, box[0]) &&
          b[1] <= Math.max(0, box[1]) &&
          b[2] >= Math.min(cv.width, box[2]) &&
          b[3] >= Math.min(cv.height, box[3]))
      )
        wipe();
    },
    drawImage(img, ...a) {
      // a canvas that counts as well (a sprite of the tests) adds what is on it now
      const src = img && typeof img === 'object' ? COUNTING.get(img) : null;
      if (src) mixStr(src.signature());
      const [dx, dy, dw, dh] =
        a.length >= 8
          ? a.slice(4, 8)
          : a.length >= 4
            ? a
            : [a[0], a[1], (img && img.width) || 0, (img && img.height) || 0];
      mark('drawImage', corners(null, dx, dy, dw, dh), null, 0, [dx, dy, dw, dh]);
    },
    putImageData(img, dx, dy) {
      const w = (img && img.width) || 0,
        h = (img && img.height) || 0,
        d = img && img.data;
      // the pixels too, so pixel layers that differ only in colour tell apart
      if (d)
        for (let i = 0; i + 3 < d.length; i += 4) mix32(d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24));
      mark('putImageData', w && h ? [dx, dy, dx + w, dy + h] : null, null, 0, [dx, dy, w, h]);
    },
    fillText(text, x, y) {
      mark('fillText', corners(null, x, y - 8, String(text).length * 6, 10), o.fillStyle, 0, [x, y]);
    },
    strokeText() {},
    measureText: text => ({ width: String(text).length * 6, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2 }),
    createImageData: (w, h) => {
      const W = typeof w === 'object' ? w.width : w,
        H = typeof w === 'object' ? w.height : h;
      return { width: W, height: H, data: new Uint8ClampedArray(Math.max(0, W * H * 4)) };
    },
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(0, w * h * 4)) }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createConicGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({ setTransform() {} }),
    isPointInPath: () => false,
    setLineDash() {},
    getLineDash: () => [],
  };
  // Any other method a draw calls is taken and ignored, so the game can use more of the canvas than listed here.
  const NOOP = () => {};
  const ctx = new Proxy(o, { get: (t, k) => (k in t ? t[k] : NOOP) });
  if (canvas && typeof canvas === 'object') {
    COUNTING.set(canvas, ctx);
    // a plain stand-in canvas (the tests'): setting its size clears it, as on a real one
    if (Object.getPrototypeOf(canvas) === Object.prototype)
      for (const k of ['width', 'height']) {
        let v = canvas[k] || 0;
        Object.defineProperty(canvas, k, {
          get: () => v,
          set: n => {
            v = n;
            ctx.reset();
          },
          enumerable: true,
        });
      }
  }
  return ctx;
}

export const AssetsStage = {
  LIGHT,
  envOf,
  eventOf,
  stage,
  recordingCtx,
  solid,
  StageHost,
  axis,
  valueIndex,
  dfB,
  xmasEvent,
};
