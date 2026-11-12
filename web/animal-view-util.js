// Catchable animals on the local page (spec 2026-11-05-animal-catch-design.md, sections 4-6, 9.2, 10): constants,
// names and small drawing helpers shared by the animal-view-*.js mixins. The server owns every rule.
import { I18n, tr } from './i18n.js';
import { AnimalSprites } from './animal-sprites.js';
import { AnimalWalk } from './animal-walk.js';
import { AnimalUI } from './animal-ui.js';
import { EventLandmark } from './event-landmark.js';
import { DOG_PLACES, ISLAND } from './office-scene.js';

export const U = AnimalUI;
export const TIER_COLOR = AnimalUI.TIER_COLOR;
export const KNOWN = new Set(AnimalSprites.SPECIES_IDS);
export const ANIMAL_PLACES = AnimalWalk.places({ ...DOG_PLACES, land: ISLAND.cells });
// While the Christmas landmark stands the animals lose the cells the dogs lose to it (EventLandmark.reserve), and
// 19,-13 behind the nave, where a dog still shows but the smaller animals at rest do not.
const ANIMAL_SHADE = '19,-13';
let landmarkPlaces = null;
export const animalPlaces = landmark =>
  landmark
    ? (landmarkPlaces ||= AnimalWalk.places({
        ...DOG_PLACES,
        roam: new Set([...ANIMAL_PLACES.roam].filter(k => !EventLandmark.ROAM_OFF.has(k) && k !== ANIMAL_SHADE)),
        land: ISLAND.cells,
      }))
    : ANIMAL_PLACES;
const SPECIES_NAME = {
  hen: tr('animal.name.hen'),
  duck: tr('animal.name.duck'),
  rabbit: tr('animal.name.rabbit'),
  tabby: tr('animal.name.tabby'),
  squirrel: tr('animal.name.squirrel'),
  fox: tr('animal.name.fox'),
  redpanda: tr('animal.name.redpanda'),
  frog: tr('animal.name.frog'),
  owl: tr('animal.name.owl'),
  deer: tr('animal.name.deer'),
  peacock: tr('animal.name.peacock'),
  snowfox: tr('animal.name.snowfox'),
  unicorn: tr('animal.name.unicorn'),
  dragon: tr('animal.name.dragon'),
};
export const TIER_NAME = {
  common: tr('animal.tier.common'),
  rare: tr('animal.tier.rare'),
  epic: tr('animal.tier.epic'),
  legendary: tr('animal.tier.legendary'),
};
export const COND_HINT = {
  rain: tr('animal.hint.rain'),
  snow: tr('animal.hint.snow'),
  night: tr('animal.hint.night'),
  day: tr('animal.hint.day'),
  norain: tr('animal.hint.norain'),
};
export const nameOf = s => (Object.hasOwn(SPECIES_NAME, s) ? SPECIES_NAME[s] : String(s || '?'));
export const ENV_EVERY_MS = 10000,
  ENV_MIN_GAP_MS = 3000,
  NOTICE_MS = 4000,
  ARM_MS = 4000,
  RETRY_MIN_MS = 1000,
  RETRY_MAX_MS = 30000,
  HIT_CSS_PX = 22,
  MAX_NOTICES = 6;
// Seconds: fade after walking off, catch effect, legendary trail length, spark launch delay.
export const FADE_S = 0.6,
  CATCH_S = 1.1,
  REDUCED_CATCH_S = 0.3,
  TRAIL_S = 0.5,
  SPARK_AT_S = 0.6;
export const MANE = [
  ['#f29ac2', '#9f8ef0'],
  ['#f2c94c', '#f29ac2'],
  ['#7fd3f0', '#f2c94c'],
  ['#9f8ef0', '#7fd3f0'],
  ['#8fe0a8', '#9f8ef0'],
  ['#f2a07a', '#8fe0a8'],
];
export const RAINBOW = ['#ff5a5a', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#b197fc'];
export const POST_HEADERS = { 'X-Terrarium': 'animals', 'Content-Type': 'application/json' };
export const PANEL = {
  position: 'absolute',
  zIndex: 10,
  top: 12,
  right: 12,
  width: 300,
  maxWidth: 'calc(100% - 24px)',
  maxHeight: 'calc(100% - 68px)',
  overflowY: 'auto',
  boxSizing: 'border-box',
  background: 'var(--surface)',
  border: '3px solid var(--fg)',
  boxShadow: '6px 6px 0 rgba(0,0,0,0.45)',
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  fontSize: 12,
};
export const TITLE = {
  fontFamily: "'Pixelify Sans',monospace",
  fontSize: 17,
  fontWeight: 600,
  color: '#ffffff',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};
export const MUTED = { fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 };
export const SMALL_BTN = { padding: '3px 8px', fontSize: 11, flex: 'none' };
export const DANGER = { borderColor: '#e5484d', background: '#e5484d', color: '#ffffff' };
export const SR_ONLY = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};
const THUMBS = new Map();
export const nowS = () => performance.now() / 1000;
export const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + Math.max(0, Math.min(1, a)) + ')';
};
export const safeFrame = (id, name) => {
  try {
    return AnimalSprites.frame(id, name);
  } catch (e) {
    return null;
  }
};
export const fmtDate = at =>
  Number.isFinite(at) && at > 0
    ? new Date(at).toLocaleDateString(I18n.locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';
export const dot = (ctx, x, y, col, n = 1) => {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), n, n);
};
export const star = (ctx, x, y, col) => {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = col;
  ctx.fillRect(x - 1, y, 3, 1);
  ctx.fillRect(x, y - 1, 1, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, 1, 1);
};

// The standing sprite as a small image for the panels, in its own daylight colours.
export function thumb(species) {
  if (THUMBS.has(species)) return THUMBS.get(species);
  const f = safeFrame(species, 'stand');
  let url = '';
  if (f && typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = f.w;
    cv.height = f.h;
    const c = cv.getContext('2d');
    f.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.' || !f.pal[ch]) return;
        c.fillStyle = f.pal[ch];
        c.fillRect(x, y, 1, 1);
      }),
    );
    try {
      url = cv.toDataURL();
    } catch (e) {
      url = '';
    }
  }
  const v = { url, w: f ? f.w : 0, h: f ? f.h : 0 };
  THUMBS.set(species, v);
  return v;
}
