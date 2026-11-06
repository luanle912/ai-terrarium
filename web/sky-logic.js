// Pure logic for the sky island (no DOM, no canvas). The page and tests/sky-logic.test.mjs both run this block.
import { tr } from './i18n.js';
import { IslandLand, key, N4 } from './island-land.js';
// The island's land (shape, underside, spots, pond, paths, decor) lives in web/island-land.js; re-exported below.
const { buildIsland, annexLand, outdoorSpots, stairs, STAIR_RUN, lawnPaths } = IslandLand;
const WATERFALL_LEN = 140,
  DECOR_TOP = 24;

// Cheapest route between two tiles (Dijkstra). `canStep(a,b)` says whether one step from a to b is allowed and
// `cost(b)` what it costs; with every cost 1 this is a plain shortest route. The frontier is a sorted array: the grid
// is about two thousand cells (the longest walk, office to the rest corner or the back lawn, plans in ~1.5 ms) and
// routes are only planned when an agent picks a new goal.
const GRASS_COST = 2;
function cheapestPath(from, to, canStep, cost) {
  const goal = key(to[0], to[1]),
    start = key(from[0], from[1]);
  const dist = new Map([[start, 0]]),
    prev = new Map([[start, null]]),
    open = [[0, from]];
  while (open.length) {
    const [d, c] = open.shift(),
      kc = key(c[0], c[1]);
    if (d > dist.get(kc)) continue;
    if (kc === goal) break;
    for (const [dx, dy] of N4) {
      const n = [c[0] + dx, c[1] + dy],
        kn = key(n[0], n[1]);
      if (!canStep(c, n)) continue;
      const nd = d + cost(n);
      if (dist.has(kn) && dist.get(kn) <= nd) continue;
      dist.set(kn, nd);
      prev.set(kn, c);
      let i = open.length;
      while (i > 0 && open[i - 1][0] > nd) i--;
      open.splice(i, 0, [nd, n]);
    }
  }
  if (!prev.has(goal) || goal === start) return [];
  const out = [];
  for (let c = to; key(c[0], c[1]) !== start; c = prev.get(key(c[0], c[1]))) out.unshift(c);
  return out;
}

// ---- walking outside the office ----
const inRect = (x, y, W, H) => x >= 0 && x < W && y >= 0 && y < H;
function canCross(a, b, W, H, st) {
  const inA = inRect(a[0], a[1], W, H),
    inB = inRect(b[0], b[1], W, H);
  if (inA === inB) return true;
  const [o, l] = inA ? [a, b] : [b, a];
  return st.some(s =>
    s.side === 'east'
      ? o[0] === W - 1 && l[0] === W && o[1] === l[1] && l[1] >= s.y && l[1] < s.y + s.len
      : o[1] === H - 1 && l[1] === H && o[0] === l[0] && l[0] >= s.x && l[0] < s.x + s.len,
  );
}
// Lawn cells agents can stand on: not the mountain, not the river (except across the bridge), not the lake (except
// the bathing spots), not under a tree, bush, mushroom, rock or lamp post. Flowers are stepped over.
function lawnWalk(island, W, H) {
  const out = new Set(),
    blocked = new Set(island.decor.filter(d => d.kind !== 'flower').map(d => key(d.x, d.y))),
    bath = new Set(island.pond.spots.map(s => key(s.x, s.y)));
  for (const l of island.lamps) blocked.add(key(l.x, l.y));
  for (const c of island.list) {
    const k = key(c.x, c.y);
    if (inRect(c.x, c.y, W, H) || blocked.has(k) || island.mountain.cells.has(k)) continue;
    if (island.river.cells.has(k) && !island.bridge.cells.has(k)) continue;
    if (island.pond.cells.has(k) && !bath.has(k)) continue;
    out.add(k);
  }
  return out;
}
function groundZ(x, y, W, H, st, floorZ) {
  if (inRect(x, y, W, H)) return floorZ;
  for (const s of st) {
    if (s.side === 'east' && x >= W && x < W + STAIR_RUN && y >= s.y && y < s.y + s.len)
      return floorZ * (1 - (x - W) / STAIR_RUN);
    if (s.side === 'south' && y >= H && y < H + STAIR_RUN && x >= s.x && x < s.x + s.len)
      return floorZ * (1 - (y - H) / STAIR_RUN);
  }
  return 0;
}

// Logical scene size and origin that fit the whole island: its top, underside, trees and waterfall.
// FH is the height the view is fitted to: the island top plus a little underside; the rest may run off the bottom.
const FOCUS_UNDER = 40;
function sceneFrame(island, { W, H, TW, TH, WALL, pad }) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    topY = -Infinity;
  const take = (x, y, z) => {
    const sx = (x - y) * TW,
      sy = (x + y) * TH - z;
    minX = Math.min(minX, sx);
    maxX = Math.max(maxX, sx);
    minY = Math.min(minY, sy);
    maxY = Math.max(maxY, sy);
    return sy;
  };
  for (const c of island.list) {
    topY = Math.max(topY, take(c.x + 1, c.y + 1, 0));
    take(c.x, c.y, 0);
    take(c.x + 1, c.y, 0);
    take(c.x, c.y + 1, 0);
    take(c.x + 1, c.y + 1, -c.d);
    take(c.x + 1, c.y, -c.d);
    take(c.x, c.y + 1, -c.d);
  }
  for (const d of island.decor) take(d.x + 0.5, d.y + 0.5, DECOR_TOP);
  take(0, 0, WALL + 3);
  take(W, 0, WALL + 3);
  take(0, H, WALL + 3);
  const f = island.waterfall;
  take(f.x + 1, f.y + 0.5, -1 - WATERFALL_LEN);
  minX = Math.floor(minX);
  minY = Math.floor(minY);
  maxX = Math.ceil(maxX);
  maxY = Math.ceil(maxY);
  return {
    LW: maxX - minX + 2 * pad,
    LH: maxY - minY + 2 * pad,
    OX: pad - minX,
    OY: pad - minY,
    FH: Math.ceil(topY + FOCUS_UNDER) - minY + 2 * pad,
  };
}

// ---- weather ----
const WEATHERS = ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog'];
const WEIGHTS = { clear: 45, cloudy: 25, rain: 12, storm: 5, snow: 5, fog: 8 };
// How strongly each weather drives each effect, 0..1. Blending these is what makes transitions smooth.
const FX = {
  clear: { cloud: 0.2, rain: 0, snow: 0, storm: 0, fog: 0 },
  cloudy: { cloud: 0.8, rain: 0, snow: 0, storm: 0, fog: 0 },
  rain: { cloud: 0.9, rain: 1, snow: 0, storm: 0, fog: 0 },
  storm: { cloud: 1, rain: 1, snow: 0, storm: 1, fog: 0 },
  snow: { cloud: 0.7, rain: 0, snow: 1, storm: 0, fog: 0 },
  fog: { cloud: 0.5, rain: 0, snow: 0, storm: 0, fog: 1 },
};
const WINTER = new Set([11, 0, 1]);
const MIN = 60_000;

function pickNextWeather(prev, month, rand) {
  const w = { ...WEIGHTS };
  if (!WINTER.has(month)) {
    w.clear += w.snow;
    w.snow = 0;
  }
  if (prev !== 'clear') delete w[prev];
  const pool = WEATHERS.filter(k => w[k] > 0),
    total = pool.reduce((s, k) => s + w[k], 0);
  let r = rand() * total;
  for (const k of pool) {
    r -= w[k];
    if (r < 0) return k;
  }
  return pool[pool.length - 1];
}
const changeDelayMs = r => 20 * MIN + r * 20 * MIN;
const transitionMs = r => 30_000 + r * 30_000;
function wmoToWeather(code) {
  if (!Number.isInteger(code)) return null;
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'storm';
  return null;
}
const initialWeather = (type, now) => ({ fromFx: { ...FX[type] }, to: type, t0: now, dur: 0, nextAt: now + 20 * MIN });
function weatherFx(state, now) {
  const p = state.dur > 0 ? (now - state.t0) / state.dur : 1;
  if (p <= 0) return { ...state.fromFx };
  if (p >= 1) return { ...FX[state.to] };
  const s = p * p * (3 - 2 * p),
    out = {};
  for (const k in state.fromFx) out[k] = state.fromFx[k] + (FX[state.to][k] - state.fromFx[k]) * s;
  return out;
}
// Starts from whatever mix is on screen right now, so a new change never jumps.
const startTransition = (state, to, now, dur) => ({ ...state, fromFx: weatherFx(state, now), to, t0: now, dur });
function stepRandom(state, now, month, rand) {
  if (now < state.nextAt) return state;
  const next = startTransition(state, pickNextWeather(state.to, month, rand), now, transitionMs(rand()));
  return { ...next, nextAt: now + changeDelayMs(rand()) };
}
const snowCover = (cover, snow, dtMs) =>
  Math.max(0, Math.min(1, snow > 0 ? cover + (dtMs / (10 * MIN)) * snow : cover - dtMs / (20 * MIN)));
const lightningDelayMs = r => 8000 + r * 12000;
const lightningFlashMs = r => 120 + r * 80;
// Brightness of a flash that started at `start`: full at once, then fading out (never a hard on/off blink).
const flashLevel = (now, start, ms) => (now < start || now >= start + ms ? 0 : (1 - (now - start) / ms) ** 2);
// A preview shows a weather for a minute, then returns to whatever the mode had on before the first preview.
const PREVIEW_MS = 60_000;
const startPreview = (wx, preview, type, now) => ({
  wx: startTransition(wx, type, now, 3000),
  preview: { type, until: now + PREVIEW_MS, back: preview ? preview.back : wx.to },
});
// The lawn's real snow cover builds and melts from the mode's own weather, never from a preview;
// a snow preview only shows a white lawn while it lasts, so nothing is left behind afterwards.
function stepSnow(cover, fx, preview, dtMs) {
  const next = snowCover(cover, preview ? FX[preview.back].snow : fx.snow, dtMs);
  return { cover: next, shown: preview && preview.type === 'snow' ? 1 : next };
}
function stepPreview(wx, preview, now) {
  if (!preview || now < preview.until) return { wx, preview };
  return { wx: startTransition(wx, preview.back, now, 5000), preview: null };
}

// ---- settings and real weather ----
const WEATHER_KEY = 'ai-terrarium.weather',
  MODES = ['random', 'real', 'off'];
function loadWeatherSettings(storage) {
  const fallback = { mode: 'random', city: '' };
  try {
    const raw = storage && storage.getItem(WEATHER_KEY);
    if (!raw) return fallback;
    const v = JSON.parse(raw) || {};
    return { mode: MODES.includes(v.mode) ? v.mode : 'random', city: typeof v.city === 'string' ? v.city : '' };
  } catch (e) {
    return fallback;
  }
}
function saveWeatherSettings(storage, settings) {
  try {
    storage.setItem(WEATHER_KEY, JSON.stringify({ mode: settings.mode, city: settings.city }));
    return true;
  } catch (e) {
    return false;
  }
}
const geocodeUrl = city =>
  'https://geocoding-api.open-meteo.com/v1/search?name=' +
  encodeURIComponent(city.trim()) +
  '&count=1&language=vi&format=json';
const forecastUrl = (lat, lon) =>
  'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=weather_code';
// Never rejects: every failure comes back as a reason the settings panel can show as-is.
async function fetchRealWeather(city, fetchFn, { timeoutMs = 15000 } = {}) {
  const name = (city || '').trim(),
    unreadable = { ok: false, reason: tr('weather.error.unreadable') };
  if (!name) return { ok: false, reason: tr('weather.error.noCity') };
  // A stalled connection (VPN black hole, captive portal) must still end in a reason and the Random fallback.
  const timed = p =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(tr('weather.error.timeout'))), timeoutMs);
      Promise.resolve(p).then(
        v => {
          clearTimeout(t);
          resolve(v);
        },
        e => {
          clearTimeout(t);
          reject(e);
        },
      );
    });
  const getJson = async url => {
    const res = await timed(fetchFn(url));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    try {
      return { body: await timed(res.json()) };
    } catch (e) {
      if (e && e.message === tr('weather.error.timeout')) throw e;
      return { body: undefined };
    }
  };
  try {
    const geo = (await getJson(geocodeUrl(name))).body;
    if (geo === undefined) return unreadable;
    const place = geo && Array.isArray(geo.results) && geo.results[0];
    if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude))
      return { ok: false, reason: tr('weather.error.cityNotFound', { city: name }) };
    const now = (await getJson(forecastUrl(place.latitude, place.longitude))).body;
    const code = now && now.current && now.current.weather_code,
      type = wmoToWeather(code);
    if (!type) return unreadable;
    return { ok: true, type, code, place: place.name || name };
  } catch (e) {
    return { ok: false, reason: tr('weather.error.fetchFailed', { detail: e && e.message ? e.message : String(e) }) };
  }
}

// ---- sky colours ----
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbHex = a =>
  '#' +
  a
    .map(v =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const mixHex = (a, b, p) => {
  const A = hexRgb(a),
    B = hexRgb(b);
  return rgbHex(A.map((v, i) => v * (1 - p) + B[i] * p));
};
const SKY_DAY = {
  zenith: '#2f6fd6',
  horizon: '#cfe9ff',
  haze: '#e6f3ff',
  below: '#bcd9f2',
  cloud: '#ffffff',
  cloudShade: '#dfe8f2',
};
const SKY_NIGHT = {
  zenith: '#070b1c',
  horizon: '#1c2747',
  haze: '#26335a',
  below: '#0e1630',
  cloud: '#3a4466',
  cloudShade: '#2c3554',
};
const SKY_WARM = {
  zenith: '#4a5fa8',
  horizon: '#ffb27a',
  haze: '#ffd1a1',
  below: '#c99ab0',
  cloud: '#ffe0c4',
  cloudShade: '#e8b8a0',
};
const GREY_DAY = '#8e9aab',
  GREY_NIGHT = '#2a2f3d';
// df is the day factor (0 night .. 1 day). Warmth peaks halfway through dawn and dusk; cloud cover and storms grey it
// all.
function skyColors(df, hour, fx) {
  const warm = 4 * df * (1 - df),
    grey = (Math.max(0, fx.cloud - 0.2) / 0.8) * 0.55 + fx.storm * 0.3,
    greyTone = mixHex(GREY_NIGHT, GREY_DAY, df),
    out = {};
  for (const k in SKY_DAY) {
    let c = mixHex(SKY_NIGHT[k], SKY_DAY[k], df);
    c = mixHex(c, SKY_WARM[k], warm * (k === 'zenith' ? 0.35 : 0.7));
    c = mixHex(c, greyTone, Math.min(0.85, grey * (k === 'cloud' || k === 'cloudShade' ? 0.6 : 1)));
    if (fx.storm > 0) c = mixHex(c, '#2a2f3a', fx.storm * 0.45);
    if (fx.fog > 0 && (k === 'horizon' || k === 'haze' || k === 'below'))
      c = mixHex(c, mixHex(greyTone, '#ffffff', 0.4), fx.fog * 0.5);
    out[k] = c;
  }
  return out;
}

export const SkyLogic = {
  annexLand,
  stepSnow,
  stairs,
  canCross,
  lawnWalk,
  lawnPaths,
  cheapestPath,
  GRASS_COST,
  groundZ,
  STAIR_RUN,
  flashLevel,
  PREVIEW_MS,
  startPreview,
  stepPreview,
  mixHex,
  skyColors,
  WEATHER_KEY,
  loadWeatherSettings,
  saveWeatherSettings,
  geocodeUrl,
  forecastUrl,
  fetchRealWeather,
  WATERFALL_LEN,
  DECOR_TOP,
  outdoorSpots,
  buildIsland,
  sceneFrame,
  WEATHERS,
  WEIGHTS,
  FX,
  pickNextWeather,
  changeDelayMs,
  transitionMs,
  wmoToWeather,
  initialWeather,
  weatherFx,
  startTransition,
  stepRandom,
  snowCover,
  lightningDelayMs,
  lightningFlashMs,
};
