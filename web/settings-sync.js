// Sharing the Settings choices (the weather, the event, the season and the teleport style; previews stay this page's
// own) through the local server (lib/page-settings.js; spec 2026-11-18 §5.8, D2b; tests/settings-sync.test.mjs). The
// choice belongs to the viewer, not to the data source: a page pushes it from Live, Simulation and "view as another
// person" alike whenever it can reach the server, and every value carries when it was chosen (updatedAt, ms), so the
// newest wins everywhere (EventLogic.adopt). A push that fails keeps the local choice, marked pending, and is sent
// again on the next change or snapshot.
//
// The page keeps a small record, host.sync: { at (when this page's choice was made, or the server's it took), sentAt
// (the `at` last sent successfully), pending (the last send failed), inFlight (sends on the way) }.
import { EventLogic } from './event-logic.js';
import { SeasonLogic } from './season-logic.js';
import { SkyLogic } from './sky-logic.js';
import { TpStyles } from './tp-styles.js';

const AT_KEY = 'ai-terrarium.settingsAt';
function loadAt(storage) {
  try {
    const v = Number(storage && storage.getItem(AT_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch (e) {
    return 0;
  }
}
function saveAt(storage, at) {
  try {
    storage && storage.setItem(AT_KEY, String(at));
  } catch (e) {}
}
const create = storage => ({ at: loadAt(storage), sentAt: null, pending: false, inFlight: 0 });
// A choice made here, now: always later than the last one, even if the clock stepped back.
function touch(s, storage, now) {
  s.at = Math.max(now, s.at + 1);
  saveAt(storage, s.at);
}

// Sends this page's choice (host: { sync, storage, wallpaper, world, state: { weatherMode, city }, eventChoice,
// seasonChoice, settingsUrl, adoptSettings }); `touch` when it was just changed here. The server answers with the
// value it keeps, which the page adopts: a newer one from another page wins in Simulation too. Resolves to that value,
// or null. The wallpaper never chose anything, and the world (the hub's page) cannot reach the local server.
// `weather`: the one just adopted, which host.state may not hold yet (React applies setState later).
async function share(host, { touch: changed = false, fetch: f, now = Date.now(), weather } = {}) {
  if (!f && typeof fetch === 'function') f = (u, o) => fetch(u, o);
  if (host.wallpaper || host.world || typeof f !== 'function') return null;
  const s = host.sync,
    st = host.state;
  if (changed) touch(s, host.storage, now);
  const at = s.at,
    value = {
      weather: weather || { mode: st.weatherMode, city: st.city },
      event: host.eventChoice || 'auto',
      season: host.seasonChoice || 'auto',
      teleport: TpStyles.choice(),
      updatedAt: at,
    };
  s.inFlight++;
  let saved = null;
  try {
    const r = await f(host.settingsUrl || '/api/settings', {
      method: 'POST',
      headers: { 'X-Terrarium': 'settings', 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
      cache: 'no-store',
    });
    if (!r || !r.ok) throw new Error('settings not saved');
    const j = await r.json().catch(() => null);
    saved = j && j.settings && typeof j.settings === 'object' ? j.settings : null;
    if (s.at === at) {
      s.sentAt = at;
      s.pending = false;
    }
  } catch (e) {
    s.pending = true;
  } finally {
    s.inFlight--;
  }
  if (saved) host.adoptSettings(saved);
  return saved;
}

// The server's value lacks a choice this page made by hand ('auto' is no choice), and this page can send.
const seeds = (host, ps) =>
  !host.wallpaper &&
  !host.world &&
  !host.sync.inFlight &&
  ((!ps.season && (host.seasonChoice || 'auto') !== 'auto') ||
    (!ps.event && (host.eventChoice || 'auto') !== 'auto') ||
    (!ps.teleport && TpStyles.choice() !== 'random'));

// The server's value (a snapshot's pageSettings, or a push's answer) against this page's: take it when it is newer,
// else send ours when it is newer and not sent yet (or its send failed) and nothing is on the way.
function receive(host, ps, opts) {
  const s = host.sync,
    e = EventLogic.adopt({ server: ps, local: host.eventChoice, localAt: s.at, wallpaper: host.wallpaper });
  if (e.newer) {
    const w = ps.weather;
    s.at = s.sentAt = Number.isFinite(ps.updatedAt) && ps.updatedAt > 0 ? ps.updatedAt : 0;
    s.pending = false;
    saveAt(host.storage, s.at);
    if (w.mode !== host.state.weatherMode || w.city !== host.state.city)
      host.setWeather({ weatherMode: w.mode, city: w.city, cityDraft: w.city }, true);
    if (e.take) host.setEventChoice(e.take, true);
    if (SeasonLogic.CHOICES.includes(ps.season) && ps.season !== host.seasonChoice)
      host.setSeasonChoice(ps.season, true);
    if (TpStyles.CHOICES.includes(ps.teleport) && ps.teleport !== TpStyles.choice())
      host.setTpChoice(ps.teleport, true);
    // A file written before the season (or the event) was shared has neither, nor a stamp, so it counts as newer
    // than a page that never synced: a choice picked by hand here is sent once, stamped, or it would never get there.
    if (seeds(host, ps)) share(host, { ...opts, touch: true, weather: { mode: w.mode, city: w.city } });
  } else if (e.push && !s.inFlight && (s.pending || s.sentAt !== s.at)) share(host, opts);
}

// The world view (the hub's page) cannot reach the local server, so its shared settings are its own storage: another
// tab of the same page changing a choice there (a `storage` event with its key) is followed here, never sent back.
function follow(host, key) {
  const store = host.storage;
  if (key === EventLogic.EVENT_KEY) host.setEventChoice(EventLogic.loadChoice(store), true);
  else if (key === SeasonLogic.SEASON_KEY) host.setSeasonChoice(SeasonLogic.loadSeasonChoice(store), true);
  else if (key === TpStyles.KEY) host.setTpChoice(TpStyles.loadChoice(store), true);
  else if (key === SkyLogic.WEATHER_KEY) {
    const w = SkyLogic.loadWeatherSettings(store);
    if (w.mode !== host.state.weatherMode || w.city !== host.state.city)
      host.setWeather({ weatherMode: w.mode, city: w.city, cityDraft: w.city }, true);
  }
}

export const SettingsSync = { AT_KEY, loadAt, create, touch, share, receive, follow };
