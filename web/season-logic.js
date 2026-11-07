// Pure logic for the four seasons of the island (no DOM, no canvas). The page and tests/season-logic.test.mjs run this.
// Which season shows: a one-minute preview, else the choice made in Settings, else the month of the viewer's clock.
import { tr } from './i18n.js';
import { SeasonTree } from './season-tree.js';

const KEYS = ['spring', 'summer', 'autumn', 'winter'];
const CHOICES = ['auto', ...KEYS];
const SEASON_KEY = 'ai-terrarium.season';
const SEASON_PREVIEW_MS = 60_000;

// Northern hemisphere by month: spring Mar-May, summer Jun-Aug, autumn Sep-Nov, winter Dec-Feb.
const seasonOf = date => KEYS[Math.floor((((date || new Date()).getMonth() + 10) % 12) / 3)];

const startSeasonPreview = (key, now) => ({ key, until: now + SEASON_PREVIEW_MS });

function currentSeason({ date, choice, preview, now }) {
  if (preview && now < preview.until) return { key: preview.key, previewing: true };
  if (KEYS.includes(choice)) return { key: choice, previewing: false };
  return { key: seasonOf(date), previewing: false };
}

// The season table. Summer is the standard: what the island looked like before seasons, so it changes nothing.
//   key     trees    grass tint {color, mix: 0..1 blend}  flowers  fruit  fall      wind  minSnow  frozen
//   spring  fresh    #9be36b  0.20                        2.0      yes    petals    0.05  0        no
//   summer  green    none     0                           1.0      no     none      0     0        no
//   autumn  gold     #e2b43c  0.45                        0.5      no     leaves    0.35  0        no
//   winter  bare     #f2f7ff  0.35                        0        no     snow      0     0.65     yes
// flowers: density multiplier on the lawn; wind: steady drift of leaves and vines (0..1, summer has none);
// minSnow: snow cover (0..1) that stays all season; frozen: lakes iced over, falls frozen, no ducks or fish.
const LOOKS = {
  spring: {
    trees: 'fresh',
    grass: { color: '#9be36b', mix: 0.2 },
    flowers: 2,
    fruit: true,
    fall: 'petals',
    wind: 0.05,
    minSnow: 0,
    frozen: false,
  },
  summer: {
    trees: 'green',
    grass: { color: null, mix: 0 },
    flowers: 1,
    fruit: false,
    fall: null,
    wind: 0,
    minSnow: 0,
    frozen: false,
  },
  autumn: {
    trees: 'gold',
    grass: { color: '#e2b43c', mix: 0.45 },
    flowers: 0.5,
    fruit: false,
    fall: 'leaves',
    wind: 0.35,
    minSnow: 0,
    frozen: false,
  },
  winter: {
    trees: 'bare',
    grass: { color: '#f2f7ff', mix: 0.35 },
    flowers: 0,
    fruit: false,
    fall: 'snow',
    wind: 0,
    minSnow: 0.65,
    frozen: true,
  },
};
const look = key => LOOKS[key] || LOOKS.summer;

function loadSeasonChoice(storage) {
  try {
    const raw = storage && storage.getItem(SEASON_KEY);
    return CHOICES.includes(raw) ? raw : 'auto';
  } catch (e) {
    return 'auto';
  }
}
function saveSeasonChoice(storage, choice) {
  try {
    storage.setItem(SEASON_KEY, CHOICES.includes(choice) ? choice : 'auto');
    return true;
  } catch (e) {
    return false;
  }
}

// "Autumn", or "Autumn · Mid-Autumn Festival" while a holiday tree is active
// (the plain season entries of SEASONS are not holidays).
function seasonLabel(key, holidayKey) {
  const name =
    key === 'spring'
      ? tr('season.spring')
      : key === 'summer'
        ? tr('season.summer')
        : key === 'autumn'
          ? tr('season.autumn')
          : tr('season.winter');
  const holiday = SeasonTree.SEASONS[holidayKey];
  return holiday && holiday.type !== 'season' && holiday.type !== 'none' ? name + ' · ' + holiday.label : name;
}
// The header chip: the season shown (a preview or the Settings choice included) in the season's colour, or, while a
// holiday tree is up, "Season · Holiday" in the holiday's colour.
const ACCENT = { spring: '#f7a8c4', summer: '#46a758', autumn: '#e0703a', winter: '#9fd3ff' };
function seasonChip(key, holidayKey) {
  const holiday = SeasonTree.SEASONS[holidayKey],
    on = holiday && holiday.type !== 'season' && holiday.type !== 'none';
  return { label: seasonLabel(key, holidayKey), accent: on ? holiday.accent : ACCENT[key] || ACCENT.summer };
}
// Settings dropdown entry for "follow the date".
const autoLabel = () => tr('season.auto');

// On the ice nobody fishes or bathes (the bench stays): the free idle spots to pick from, and whether the spot someone
// is at is still fine. Everything is open again when the lakes thaw.
const onIce = spot => !!spot && (spot.act === 'fish' || spot.act === 'bath');
const idleOpen = (spots, free, frozen) => (frozen ? free.filter(i => !onIce(spots[i])) : free);
const idleStays = (spots, i, frozen) => !(frozen && i != null && onIce(spots[i]));

export const SeasonLogic = {
  idleOpen,
  idleStays,
  KEYS,
  CHOICES,
  SEASON_KEY,
  SEASON_PREVIEW_MS,
  seasonOf,
  currentSeason,
  startSeasonPreview,
  look,
  loadSeasonChoice,
  saveSeasonChoice,
  seasonLabel,
  seasonChip,
  autoLabel,
};
