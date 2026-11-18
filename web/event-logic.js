// The Christmas event as logic (no DOM, no canvas; tests/event-logic.test.mjs): when it is on and how far along, the
// choice in Settings, where the one big tree stands, the winter and the snowfall it brings, and how a string of
// lights is laid out. The page asks active() what to show; everything else about the event hangs off its answer, so
// another event later is one more calendar entry and its own drawing.

const CHOICES = ['auto', 'on', 'off'];
const EVENT_KEY = 'ai-terrarium.event';
const PREVIEW_MS = 60_000;
const startPreview = now => ({ until: now + PREVIEW_MS });
// What Settings shows while a preview runs: its time left as m:ss, rounded up ('' when none runs).
function previewClock(preview, now) {
  const s = preview ? Math.ceil((preview.until - now) / 1000) : 0;
  return s > 0 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : '';
}

// The event at a moment of the viewer's own clock, or null: { key: 'christmas', since }, since being whole days from
// 1 Dec (0-based); choice 'on' and a preview say 14, the full event. The event is whole from its first day (D1): what
// it shows is the look's (web/theme.js), which only counts the days for the presents under the tree.
// The event runs 1-26 Dec. choice 'off' shows nothing; a preview shows the event until it runs out, any choice.
const SINCE_FULL = 14;
const make = since => ({ key: 'christmas', since });
function active(date, choice, preview, now) {
  if (preview && now < preview.until) return make(SINCE_FULL);
  if (choice === 'on') return make(SINCE_FULL);
  if (choice !== 'auto' || date.getMonth() !== 11) return null;
  const d = date.getDate();
  return d > 26 ? null : make(d - 1);
}

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

// What a page does with the shared settings the local server sends (lib/page-settings.js; null while it has none),
// against this page's own event choice made at localAt (ms, 0 when never stamped). The newest choice wins: `newer`
// when the server's is later (an unstamped one is the oldest; neither stamped: the server's, as before), then `take`
// its event when it differs; `push` this page's own when it is later than the server's. The wallpaper has no
// settings of its own to give.
const stampOf = v => (v && Number.isFinite(v.updatedAt) && v.updatedAt > 0 ? v.updatedAt : 0);
function adopt({ server, local, localAt = 0, wallpaper = false }) {
  const at = server && server.weather ? stampOf(server) : -1,
    newer = at > localAt || (at === 0 && localAt === 0);
  const take = newer && CHOICES.includes(server.event) && server.event !== local ? server.event : null;
  return { take, push: !wallpaper && localAt > at, newer };
}

// The big tree stands indoors, in the middle of the crossing of the office's two corridors: its foot at TREE_AT (in
// tiles), on the two cells TREE_CELLS, which nobody may walk over while it stands there (block). The corridor
// between the desk zones is three tiles wide so people pass on either side. Outdoors the island's own trees turn
// into plain firs.
const TREE_AT = [9.5, 7],
  TREE_CELLS = ['9,6', '9,7'];
// Takes the tree's cells out of (on) or puts them back into (off) the set of cells people may not walk over.
function block(set, on) {
  for (const k of TREE_CELLS) on ? set.add(k) : set.delete(k);
}
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

export const EventLogic = {
  CHOICES,
  EVENT_KEY,
  PREVIEW_MS,
  startPreview,
  previewClock,
  active,
  loadChoice,
  saveChoice,
  adopt,
  TREE_AT,
  TREE_CELLS,
  block,
  season,
  weather,
  SNOWFALL,
  lightString,
  MAX_BULBS,
};
