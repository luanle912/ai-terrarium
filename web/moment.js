// The moment (docs/specs/2026-11-18-asset-labels-design.md §5.1, D1-D2): everything the look of the island depends on
// at one instant, in one object: the season, the big event and how far along it is, the small holiday, the light and
// the snow. Theme.resolve reads it and memoizes a Look by `key`, so the key names every part of it that changes the
// look, and nothing finer: the same key for a whole day band, a new one when the day, the night or the snow band turns.
import { SeasonLogic } from './season-logic.js';
import { SeasonTree } from './season-tree.js';
import { EventLogic } from './event-logic.js';
import { SnowLogic } from './snow-logic.js';
import { Theme } from './theme.js';
import { Light } from './light.js';

const eventPack = key => Theme.PACKS.find(p => p.kind === 'event' && p.key === key);
const SMALL = key => {
  const h = SeasonTree.SEASONS[key];
  return h && key !== 'christmas' && ['event', 'lunar'].includes(h.type) ? key : null;
};

// { date, now, seasonChoice, seasonPreview, eventChoice, eventPreview, df (daylight 1..0), snow (cover 0..1) }
function at({ date, now, seasonChoice, seasonPreview, eventChoice, eventPreview, df, snow }) {
  const choice = seasonChoice || 'auto';
  const picked = SeasonLogic.currentSeason({ date, choice, preview: seasonPreview, now });
  const ev = EventLogic.active(date, eventChoice || 'auto', eventPreview, now);
  const pack = ev && eventPack(ev.key);
  const event = ev ? { key: ev.key, since: ev.since } : null;
  // D2: a small holiday only on the date's own season, with no event and nothing picked by hand
  const holiday = !event && choice === 'auto' && !picked.previewing ? SMALL(SeasonTree.seasonFor(date)) : null;
  const season = (pack && pack.season) || picked.key;
  const night = Light.night(df);
  const band = SnowLogic.depth(snow || 0);
  return {
    season,
    event,
    holiday,
    df,
    night,
    snow,
    forced: { season: !!(pack && pack.season), weather: !!(pack && pack.weather) },
    key: [season, holiday || '-', event ? event.key + '@' + event.since : '-', night ? 'n' : 'd', 's' + band].join('|'),
  };
}

export const Moment = { at };
