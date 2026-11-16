// The stage the /assets page draws every item on, with the game's own code: the scene an item is shown in (env, as
// the game's envNow builds it), a small iso projection round any point, the island painter and colour function the
// island bake uses, the furniture and pantry kits, the G of the office's draw methods, and a stand-in host that
// borrows ClaudeOffice's methods the way web/island-scene.js does. recordingCtx() is a canvas that only counts and
// measures what it is told: the tests draw every entry on it, and the page uses it to size cards and read palettes.
import { SCENE_DOG_SPRITES, SCENE_METHODS } from './island-scene.js';
import { ClaudeOffice } from './office.js';
import { DOG_PLACES, FLOOR_Z, P as SCENE_P, PG as SCENE_PG, THEMES, TH, TW, lerpTheme } from './office-scene.js';
import { OfficeDecor } from './office-decor.js';
import { PantryItems } from './pantry-items.js';
import { mix, night, painter } from './island-art.js';
import { seasonC } from './island-art-season.js';
import { SNOW } from './sky-island.js';
import { SeasonLogic } from './season-logic.js';
import { SnowLogic } from './snow-logic.js';
import { SkyLogic } from './sky-logic.js';
import { EventLogic } from './event-logic.js';
import { H as SCENE_H, ISLAND, LH, LW, OX, OY, W as SCENE_W } from './office-scene.js';
import { SkyRender } from './sky-render.js';
import { IslandLife } from './island-life.js';
import { snowOnTop } from './island-art-snow.js';

// ---- the scene ----
// Daylight (df) and the clock hour each light stands for: noon, the middle of the evening fade, late night.
const LIGHT = { day: [1, 12], dusk: [0.5, 17.25], night: [0, 22.5] };
const EVENTS = [null, 1, 2, 3].map(l => l && { key: 'christmas', level: l, eve: true, day: true });
const ENVS = new Map();
// The env the game would hand its draw code under these controls ({light, season, snow, event}), the same object
// for the same controls so caches keyed on it hold. As in the game the Christmas event brings winter. On top of
// envNow's shape: snow (0 or 1, the cover lying on the lawn) and theme (the office colours lerped day to night).
function envOf({ light = 'day', season = 'summer', snow = false, event = 0 } = {}) {
  const key = light + '|' + season + '|' + (snow ? 1 : 0) + '|' + event;
  let env = ENVS.get(key);
  if (env) return env;
  const [df, hour] = LIGHT[light] || LIGHT.day,
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
    snow: snow ? 1 : 0,
    theme: df >= 1 ? { _day: 1, ...THEMES.day } : df <= 0 ? { _day: 0, ...THEMES.night } : lerpTheme(df),
  };
  ENVS.set(key, env);
  return env;
}
// The event object of an env ({key, level, eve, day}, as EventLogic.active gives it), or null.
const eventOf = env => EVENTS[(env && env.event) || 0] || null;

// ---- a stand-in office ----
// What the office's draw methods read off `this`, answered from the view's env; the methods themselves are
// ClaudeOffice's (the list island-scene.js borrows, and every other method of the class).
class StageHost {
  constructor() {
    this.view = null;
    this.agents = [];
    this.depts = new Map();
    this.state = { sel: null, paused: false, weatherMode: 'off' };
    this.dogs = [];
    this.dogSprites = SCENE_DOG_SPRITES;
    this.dogWorld = { ...DOG_PLACES, agents: [], hour: 12, snow: 0, calm: true, now: 0, rand: () => 0.5 };
    this.critters = [];
    this.bears = [];
    this.noUsage = true;
    this.propLit = null;
    this.holiday = 'default'; // the event tree's key (web/season-tree.js); 'default' for none
    this.cache = null;
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
  eventNow() {
    return eventOf(this.env);
  }
  setState() {}
  forceUpdate() {}
}
const OWN = new Set(Object.getOwnPropertyNames(StageHost.prototype));
const SKIP = /^(constructor|render|component\w*|getSnapshotBeforeUpdate|shouldComponentUpdate)$/;
for (const name of new Set([...SCENE_METHODS, ...Object.getOwnPropertyNames(ClaudeOffice.prototype)])) {
  if (OWN.has(name) || SKIP.test(name)) continue;
  const d = Object.getOwnPropertyDescriptor(ClaudeOffice.prototype, name);
  if (d) Object.defineProperty(StageHost.prototype, name, d);
}

// ---- the stage ----
// The G the office's draw methods take (web/office-draw.js builds it per frame): shapes in the scene's own projection,
// the theme, the clock, daylight and the event. A polygon is outlined in the theme's stroke when it has one, as there.
function makeG(ctx) {
  const G = { ctx, poly: null, box: null, rect: null, th: null, t: 0, df: 1, ev: null, cold: false };
  G.poly = (pts, fill, stroke) => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = Math.round(pts[i][0]),
        y = Math.round(pts[i][1]);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    const s = stroke === undefined ? G.th.stroke : stroke;
    if (s) {
      ctx.strokeStyle = s;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };
  const P = SCENE_P,
    shade = OfficeDecor.shade;
  G.box = (x, y, w, h, z0, z1, top, l, r) => {
    G.poly([P(x, y + h, z0), P(x + w, y + h, z0), P(x + w, y + h, z1), P(x, y + h, z1)], l || shade(top, -22));
    G.poly([P(x + w, y, z0), P(x + w, y + h, z0), P(x + w, y + h, z1), P(x + w, y, z1)], r || shade(top, -38));
    G.poly([P(x, y, z1), P(x + w, y, z1), P(x + w, y + h, z1), P(x, y + h, z1)], top);
  };
  G.rect = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  return G;
}

// One stage per canvas, rebuilt only when the anchor or the env changes: drawing a card frame after frame makes
// nothing new. The kits are made the first time they are asked for.
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
    this.G = makeG(ctx);
    this.host = new StageHost();
    this._kit = this._pantryKit = this._C = this._S = null;
  }
  aim(view) {
    if (view.ox !== this.ox || view.oy !== this.oy) {
      this.ox = view.ox;
      this.oy = view.oy;
      this._kit = this._pantryKit = null;
    }
    if (view.env !== this.env) {
      this.env = view.env;
      this._C = this._S = null;
      this.G.th = this.env.theme;
      this.G.df = this.env.df;
      this.G.ev = eventOf(this.env);
    }
    this.view = view;
    this.host.view = view;
  }
  // The furniture kit (web/decor-kit.js) and the pantry kit (web/pantry-kit.js), both standing at (ox, oy).
  get kit() {
    return this._kit || (this._kit = OfficeDecor.kit(this.ctx, this.ox, this.oy));
  }
  get pantryKit() {
    return this._pantryKit || (this._pantryKit = PantryItems.kit(this.ctx, this.ox, this.oy));
  }
  // The island's colours, as web/sky-island.js bakeTools makes them: C(colour, snowAmount) through the season's
  // grass tint, the snow cover and the night; S for lying snow; look the season; depth the snow's depth level.
  get look() {
    return SeasonLogic.look(this.env.season);
  }
  get C() {
    if (this._C) return this._C;
    const env = this.env;
    return (this._C = seasonC((c, s = 0) => night(s ? mix(c, SNOW, env.snow * s) : c, env.df), this.look));
  }
  get S() {
    if (this._S) return this._S;
    const df = this.env.df;
    return (this._S = c => SnowLogic.night(c, df));
  }
  get depth() {
    return SnowLogic.depth(this.env.snow);
  }
  // Runs fn with the canvas moved so the office scene's point (x, y, z) lands on (ox, oy): what the office's draw
  // methods need, as they draw in the scene's own projection (on the office floor; `lawn` for the lawn level).
  scene(x, y, z, fn, lawn) {
    const [sx, sy] = (lawn ? SCENE_PG : SCENE_P)(x, y, z || 0),
      ctx = this.ctx;
    ctx.save();
    ctx.translate(this.ox - sx, this.oy - sy);
    try {
      fn();
    } finally {
      ctx.restore();
    }
  }
}
const STAGES = new WeakMap();
// view = {ox, oy, env, pick}; t (optional) is the clock for G.t.
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
// The counting canvases made for a canvas object (the tests' sprite canvases): a drawImage of one folds what was
// drawn on it into the signature, so sprites that differ only in their pixels tell apart.
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
      clip = path = box = null;
      drawn = 0;
      sig = 2166136261;
      stack = [];
      tally.clear();
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
    clearRect() {},
    drawImage(img, ...a) {
      const src = img && typeof img === 'object' ? COUNTING.get(img) : null;
      if (src) mixStr(src.signature());
      const [dx, dy, dw, dh] =
        a.length >= 8
          ? a.slice(4, 8)
          : a.length >= 4
            ? a
            : [a[0], a[1], (img && img.width) || 0, (img && img.height) || 0];
      // a canvas made by sprite() below carries the signature of what was painted on it
      if (img && typeof img.assetsSig === 'string') mixStr(img.assetsSig);
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
  if (canvas && typeof canvas === 'object') COUNTING.set(canvas, ctx);
  return ctx;
}

export const AssetsStage = { envOf, eventOf, stage, recordingCtx, solid, StageHost };

// ---- sprites, the island's props and the baked island (Task 3: plants, outdoor props, island & sky, world) ----
// One string per scene, for caches: the light, season, snow and event an env stands for.
const envKey = env => env.df + '|' + env.season + '|' + env.snow + '|' + env.event;
// The light control an env was made from ('day', 'dusk' or 'night').
const lightOf = env => Object.keys(LIGHT).find(k => LIGHT[k][0] === env.df) || 'day';
const sigOf = c => {
  const g = c && c.width ? c.getContext('2d') : null;
  return g && typeof g.signature === 'function' ? g.signature() : '';
};
// A canvas of w × h px painted once by paint(g, canvas) and kept by key (the least recently used goes first). On the
// counting canvas of the tests it carries what was painted on it (assetsSig, plus any string paint returns), so a
// card that stamps it still changes with what it shows. read: a canvas the paint reads back (getImageData).
const SPRITES = new Map(),
  SPRITE_MAX = 400;
function sprite(key, w, h, paint, read) {
  let c = SPRITES.get(key);
  if (c) {
    SPRITES.delete(key);
    SPRITES.set(key, c);
    return c;
  }
  c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const g = read ? c.getContext('2d', { willReadFrequently: true }) : c.getContext('2d'),
    more = paint(g, c);
  c.assetsSig = sigOf(c) + (typeof more === 'string' ? more : '');
  if (SPRITES.size >= SPRITE_MAX) SPRITES.delete(SPRITES.keys().next().value);
  SPRITES.set(key, c);
  return c;
}
// Something that stands up off the lawn, as web/sky-island.js renderProps bakes it: paint(s) draws it standing on the
// island's tile (x, y) (s a stage on the sprite whose PG puts that tile where the sprite's foot is), in a sprite of
// ext = [left, up, right, down] px round its foot; lying snow settles on its top when snowy. Stamped with its foot at
// (ox, oy). key names what paint draws (the env is added).
function prop(ctx, view, key, x, y, ext, paint, snowy = true) {
  const env = view.env,
    img = sprite('prop|' + key + '|' + envKey(env), ext[0] + ext[2], ext[1] + ext[3], (g, c) => {
      const s = stage(g, { ox: ext[0] - (x - y) * TW, oy: ext[1] - (x + y + 1) * TH, env, pick: view.pick });
      paint(s);
      if (snowy) snowOnTop(c, 1, s.S, s.depth);
    });
  ctx.drawImage(img, view.ox - ext[0], view.oy - ext[1]);
}

// The island baked as the game bakes it (web/office-draw.js: SkyRender.renderIsland, and renderProps stamped back to
// front) at one canvas px per scene px, once per scene. Every region a scene card shows ({x, y, w, h} in scene px,
// the same object each time) is cut out of it right away, the land and the props apart (what moves on the island goes
// between them); the whole images are let go. The cuts of the last CUT_ENVS scenes are kept.
const REGIONS = [],
  CUTS = new Map(),
  CUT_ENVS = 24;
function bake(env) {
  const frame = { LW, LH, OX, OY },
    light = { df: env.df, snow: env.snow, season: env.season, block: { W: SCENE_W, H: SCENE_H }, event: env.event },
    land = SkyRender.renderIsland(ISLAND, frame, 1, light),
    props = SkyRender.renderProps(ISLAND, frame, 1, light).sort((a, b) => a.z - b.z),
    landSig = sigOf(land),
    out = new Map();
  for (const r of REGIONS) {
    const id = '|' + r.x + ',' + r.y + ',' + r.w + ',' + r.h;
    const cut = paint => {
      const c = document.createElement('canvas');
      c.width = r.w;
      c.height = r.h;
      c.assetsSig = paint(c.getContext('2d')) + id;
      return c;
    };
    out.set(r, {
      land: cut(g => {
        g.drawImage(land, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        return landSig;
      }),
      props: cut(g => {
        let sig = '';
        for (const p of props)
          if (p.dx < r.x + r.w && p.dy < r.y + r.h && p.dx + p.img.width > r.x && p.dy + p.img.height > r.y) {
            g.drawImage(p.img, p.dx - r.x, p.dy - r.y);
            sig += sigOf(p.img);
          }
        return sig;
      }),
    });
  }
  land.width = land.height = 0;
  for (const p of props) p.img.width = p.img.height = 0;
  return out;
}
// The land and the props of region r in the scene of env, as two canvases of r.w × r.h px.
function bakeCut(env, r) {
  const key = envKey(env);
  let cuts = CUTS.get(key);
  if (cuts && cuts.has(r)) {
    CUTS.delete(key);
    CUTS.set(key, cuts);
    return cuts.get(r);
  }
  if (!REGIONS.includes(r)) REGIONS.push(r);
  cuts = bake(env);
  CUTS.delete(key);
  CUTS.set(key, cuts);
  if (CUTS.size > CUT_ENVS) {
    const old = CUTS.keys().next().value;
    for (const c of CUTS.get(old).values()) c.land.width = c.props.width = 0;
    CUTS.delete(old);
  }
  return cuts.get(r);
}
// Clips to region r of the scene shown with its top left at (ox, oy), the canvas moved so scene px land there.
function enter(ctx, view, r) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(view.ox, view.oy, r.w, r.h);
  ctx.clip();
  ctx.translate(view.ox - r.x, view.oy - r.y);
}
// A scene card: region r of the island with its top left at (ox, oy), as the game shows it at time t: the baked land,
// what moves on it (IslandLife.drawLife: water, falls, mist, vines, lamp pools, birds, fireflies), the props, the
// lamps' and the lantern's light, then over(ctx, view, t) if given, in scene px.
function islandScene(ctx, view, t, r, over) {
  const env = view.env,
    c = bakeCut(env, r);
  ctx.drawImage(c.land, view.ox, view.oy);
  enter(ctx, view, r);
  IslandLife.drawLife(ctx, ISLAND, SCENE_PG, t, env);
  ctx.restore();
  ctx.drawImage(c.props, view.ox, view.oy);
  enter(ctx, view, r);
  for (let i = 0; i < ISLAND.lamps.length; i++) IslandLife.drawLampLight(ctx, ISLAND, SCENE_PG, i, t, env);
  IslandLife.drawLanternLight(ctx, ISLAND, SCENE_PG, t, env);
  if (over) over(ctx, view, t);
  ctx.restore();
}
// env under one of the weathers of SkyLogic.FX (its fx and the sky colours that go with it), one object each.
const WEATHER_ENVS = new WeakMap();
function weatherEnv(env, w) {
  let m = WEATHER_ENVS.get(env);
  if (!m) WEATHER_ENVS.set(env, (m = {}));
  if (!m[w]) {
    const fx = { ...SkyLogic.FX[w] };
    m[w] = { ...env, fx, col: SkyLogic.skyColors(env.df, env.hour, fx) };
  }
  return m[w];
}

export const AssetsScene = { envKey, lightOf, sprite, prop, bakeCut, enter, islandScene, weatherEnv };
