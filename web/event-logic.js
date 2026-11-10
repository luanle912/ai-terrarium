// The Christmas event as logic (no DOM, no canvas; tests/event-logic.test.mjs): when it is on and how far along, the
// choice in Settings, where the one big tree stands, the winter and the snowfall it brings, and how a string of
// lights is laid out. The page asks active() what to show; everything else about the event hangs off its answer, so
// another event later is one more calendar entry and its own drawing.

const CHOICES = ['auto', 'on', 'off'];
const EVENT_KEY = 'ai-terrarium.event';
const PREVIEW_MS = 60_000;
const startPreview = now => ({ until: now + PREVIEW_MS });

// The event at a moment of the viewer's own clock, or null: { key: 'christmas', level, eve, day }.
//   level 1  1-7 Dec    lights on the office, wreaths, hats
//   level 2  8-14 Dec   candy canes, desk decorations, the kennels and the pergola lit, whole outfits
//   level 3  15-26 Dec  everything
//   eve      24 Dec 18:00 to 25 Dec 06:00      day  all of 25 Dec
// choice 'on' shows level 3 whatever the date (never eve or day), 'off' nothing; a preview shows level 3 until it
// runs out, whatever the choice.
function active(date, choice, preview, now) {
  if (preview && now < preview.until) return { key: 'christmas', level: 3, eve: false, day: false };
  if (choice === 'on') return { key: 'christmas', level: 3, eve: false, day: false };
  if (choice !== 'auto' || date.getMonth() !== 11) return null;
  const d = date.getDate(),
    h = date.getHours();
  if (d > 26) return null;
  return {
    key: 'christmas',
    level: d <= 7 ? 1 : d <= 14 ? 2 : 3,
    eve: (d === 24 && h >= 18) || (d === 25 && h < 6),
    day: d === 25,
  };
}
// What the island's bake is keyed by: '' without the event, 'x1'..'x3' by level.
const cacheKey = ev => (ev ? 'x' + ev.level : '');

function loadChoice(storage) {
  try {
    const raw = storage && storage.getItem(EVENT_KEY);
    return CHOICES.includes(raw) ? raw : 'auto';
  } catch (e) {
    return 'auto';
  }
}
function saveChoice(storage, choice) {
  try {
    storage.setItem(EVENT_KEY, CHOICES.includes(choice) ? choice : 'auto');
    return true;
  } catch (e) {
    return false;
  }
}

// What a page does with the event choice the local server sends (undefined from a server or a save that has none):
// take it when it differs, or give the server this page's own, once, when it has none and this page's is not the
// default. The wallpaper has no settings of its own to give.
function adopt(server, own, { wallpaper = false, seeded = false } = {}) {
  if (CHOICES.includes(server)) return { take: server !== own ? server : null, seed: false };
  return { take: null, seed: !wallpaper && !seeded && own !== 'auto' };
}

// The big tree stands indoors: on the tile of the pot plant at the front end of the corridor between the desks
// (web/office-draw.js), which nobody walks over. Outdoors the island's own trees turn into plain firs.
const TREE_TILE = [8, 13];
// While the event is on the season is winter, whatever the date or the season chosen in Settings: snow on the lawn,
// frozen lakes, snowmen.
const season = (ev, key) => (ev ? 'winter' : key);
// And it snows. fx is the weather's mix of effects (SkyLogic.weatherFx: cloud, rain, snow, storm, fog; a fresh
// object each frame), changed in place: rain and storm fall as snow, and there is always at least a light fall.
const SNOWFALL = 0.45;
function weather(fx, ev) {
  if (!ev) return fx;
  fx.snow = Math.max(fx.snow, fx.rain, SNOWFALL);
  fx.rain = 0;
  fx.storm = 0;
  return fx;
}

// Bulbs along a line of points (px), about `gap` px apart, at most `max` of them (the gap widens to fit): a
// Float32Array of x, y pairs, made once and read every frame.
function lightString(points, gap, max) {
  let len = 0;
  for (let i = 1; i < points.length; i++)
    len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  if (!len || max < 1) return new Float32Array(0);
  const n = Math.max(1, Math.min(max, Math.round(len / gap))),
    step = len / n,
    out = new Float32Array(n * 2);
  let seg = 1,
    done = 0;
  for (let b = 0; b < n; b++) {
    const at = (b + 0.5) * step;
    while (
      seg < points.length - 1 &&
      done + Math.hypot(points[seg][0] - points[seg - 1][0], points[seg][1] - points[seg - 1][1]) < at
    ) {
      done += Math.hypot(points[seg][0] - points[seg - 1][0], points[seg][1] - points[seg - 1][1]);
      seg++;
    }
    const [x0, y0] = points[seg - 1],
      [x1, y1] = points[seg],
      f = (at - done) / (Math.hypot(x1 - x0, y1 - y0) || 1);
    out[b * 2] = x0 + (x1 - x0) * f;
    out[b * 2 + 1] = y0 + (y1 - y0) * f;
  }
  return out;
}

const MAX_BULBS = 120;
// Presents under the big tree by level (index 0: no event).
const GIFTS = [0, 2, 5, 9];

export const EventLogic = {
  CHOICES,
  EVENT_KEY,
  PREVIEW_MS,
  startPreview,
  active,
  cacheKey,
  loadChoice,
  saveChoice,
  adopt,
  TREE_TILE,
  season,
  weather,
  SNOWFALL,
  lightString,
  MAX_BULBS,
  GIFTS,
};
