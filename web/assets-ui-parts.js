// Small pieces of the /assets page: pixel icons, segmented pixel buttons, tag chips and the preview canvas that the
// grid cards, the drawer and the variants grid all use.
import { tr } from './i18n.js';
import { SeasonLogic } from './season-logic.js';
import { AssetsLogic } from './assets-logic.js';
import { AssetsPaint } from './assets-ui-paint.js';

export const h = React.createElement;
const { useEffect, useRef, useState } = React;

// The labels of the global controls, shared with the drawer.
export const LIGHTS = () => [
  { id: 'day', label: tr('assets.light.day'), icon: 'sun' },
  { id: 'dusk', label: tr('assets.light.dusk'), icon: 'dusk' },
  { id: 'night', label: tr('assets.light.night'), icon: 'moon' },
];
export const SEASONS = () =>
  AssetsLogic.CHOICES.season.map(k => ({
    id: k,
    label: {
      spring: tr('season.spring'),
      summer: tr('season.summer'),
      autumn: tr('season.autumn'),
      winter: tr('season.winter'),
    }[k],
    swatch: SeasonLogic.seasonChip({ season: k }).accent,
  }));
// The season buttons while a Christmas level is on: the event brings winter (AssetsStage.envOf), so the other seasons
// cannot be chosen until it is off; the hint says why.
export const heldSeasons = () =>
  SEASONS().map(o => (o.id === 'winter' ? { ...o, title: tr('assets.eventWinter') } : { ...o, disabled: true }));
export const SeasonHint = () =>
  h(
    'span',
    { className: 'as-held-hint', title: tr('assets.eventWinter') },
    h(Icon, { name: 'snow', size: 9 }),
    tr('assets.heldWinter'),
  );
export const SNOWS = () => [
  { id: false, label: tr('assets.snow.off') },
  { id: true, label: tr('assets.snow.on'), icon: 'snow' },
];
export const EVENTS = () => [
  { id: 0, label: tr('assets.event.off') },
  ...[1, 2, 3].map(n => ({ id: n, label: tr('assets.event.level', { n }), title: tr('assets.event.title', { n }) })),
];
export const CONTROL_LABEL = {
  light: () => tr('assets.ctl.light'),
  season: () => tr('assets.ctl.season'),
  snow: () => tr('assets.ctl.snow'),
  event: () => tr('assets.ctl.event'),
};
export const CONTROL_OPTIONS = { light: LIGHTS, season: SEASONS, snow: SNOWS, event: EVENTS };

// 7×7 pixel icons, drawn as crisp SVG squares in the current text colour.
const ICONS = {
  sun: ['...#...', '.#...#.', '..###..', '#.###.#', '..###..', '.#...#.', '...#...'],
  dusk: ['.......', '...#...', '.#####.', '#######', '.......', '#######', '.......'],
  moon: ['..###..', '.##....', '##.....', '##.....', '##.....', '.##...#', '..####.'],
  snow: ['...#...', '#.###.#', '.#.#.#.', '###.###', '.#.#.#.', '#.###.#', '...#...'],
  tree: ['...#...', '..###..', '.#####.', '..###..', '.#####.', '#######', '...#...'],
  play: ['.#.....', '.##....', '.###...', '.####..', '.###...', '.##....', '.#.....'],
  pause: ['.......', '.##.##.', '.##.##.', '.##.##.', '.##.##.', '.##.##.', '.......'],
  search: ['.###...', '#...#..', '#...#..', '#...#..', '.###...', '....##.', '.....##'],
  back: ['.......', '..#....', '.##....', '#######', '.##....', '..#....', '.......'],
  prev: ['....#..', '...##..', '..###..', '.####..', '..###..', '...##..', '....#..'],
  next: ['..#....', '..##...', '..###..', '..####.', '..###..', '..##...', '..#....'],
  close: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
  link: ['....##.', '...#..#', '..#.#.#', '.#.#.#.', '#.#.#..', '#..#...', '.##....'],
  zoom: ['.###...', '#...#..', '#.#.#..', '#...#..', '.###...', '....##.', '.....##'],
  grid: ['##.##.#', '##.##.#', '.......', '##.##.#', '##.##.#', '.......', '##.##.#'],
  broken: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
};
const PATHS = Object.fromEntries(
  Object.entries(ICONS).map(([k, rows]) => [
    k,
    rows.flatMap((r, y) => [...r].map((c, x) => (c === '#' ? `M${x} ${y}h1v1h-1z` : ''))).join(''),
  ]),
);
export function Icon({ name, size = 14 }) {
  return h(
    'svg',
    {
      className: 'as-icon',
      width: size,
      height: size,
      viewBox: '0 0 7 7',
      'aria-hidden': true,
      shapeRendering: 'crispEdges',
    },
    h('path', { d: PATHS[name] || '', fill: 'currentColor' }),
  );
}

// A row of pixel buttons, one pressed. options: [{id, label, icon?, swatch?, title?, disabled?}].
export function Seg({ label, value, options, onChange, compact, className }) {
  return h(
    'div',
    {
      className: 'as-seg' + (compact ? ' as-seg-compact' : '') + (className ? ' ' + className : ''),
      role: 'group',
      'aria-label': label,
    },
    options.map(o =>
      h(
        'button',
        {
          key: String(o.id),
          type: 'button',
          className: 'as-seg-btn' + (o.id === value ? ' on' : ''),
          'aria-pressed': o.id === value,
          disabled: !!o.disabled,
          title: o.title || (compact && o.icon ? o.label : undefined),
          onClick: () => onChange(o.id),
        },
        o.swatch && h('span', { className: 'as-swatch', style: { background: o.swatch } }),
        o.icon && h(Icon, { name: o.icon }),
        (!compact || !o.icon) && h('span', { className: 'as-seg-txt' }, o.label),
      ),
    ),
  );
}

// A tag as a small chip; the colours live in the stylesheet (.as-tag-<tag>).
export const TagChip = ({ tag, label }) => h('span', { className: 'as-tag as-tag-' + tag }, label);

// A preview canvas of one variant of an entry. When the draw throws it turns into a "can't draw" tile whose title
// carries the error. fps 15 in the grid; `still` for the variants grid (painted once per change). With `fit` (the
// largest zoom to use) it fills its box and fits the item in it once it comes near the screen, `inset` px clear of
// the edges (AssetsPaint.fitZoom: a whole zoom when it fits at ×1, else shrunk); otherwise it is drawn at `zoom` at
// its own size.
export function Preview({ entry, pick, controls, zoom, fit, inset = 6, fps, still, className }) {
  const ref = useRef(null),
    box = useRef(null),
    slot = useRef(null),
    [err, setErr] = useState(null),
    [size, setSize] = useState(null),
    [shown, setShown] = useState(false);
  useEffect(() => {
    slot.current = AssetsPaint.attach(ref.current, {
      fps,
      still,
      onError: e => setErr(e),
      onShow: () => setShown(true),
    });
    const measure = () => {
      const b = box.current;
      if (b)
        setSize(s => (s && s[0] === b.clientWidth && s[1] === b.clientHeight ? s : [b.clientWidth, b.clientHeight]));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(box.current);
    return () => {
      AssetsPaint.detach(slot.current);
      if (ro) ro.disconnect();
    };
  }, []);
  // a fitted preview is measured (AssetsPaint.frameOf draws every variant once) only when it comes near the screen
  const z = fit
    ? shown && size && size[0] > 0 && size[1] > 0
      ? AssetsPaint.fitZoom(AssetsPaint.frameOf(entry, pick), size[0] - 2 * inset, size[1] - 2 * inset, fit)
      : 0
    : zoom;
  useEffect(() => {
    if (z > 0 && AssetsPaint.setSlot(slot.current, entry, pick, controls, z)) setErr(null);
  }, [entry, pick, controls, z]);
  return h(
    'div',
    { className: 'as-preview' + (fit ? ' as-fit' : '') + (className ? ' ' + className : ''), ref: box },
    h('canvas', { ref, className: 'as-canvas', width: 0, height: 0, hidden: !!err }),
    err &&
      h(
        'div',
        { className: 'as-broken', title: String((err && err.message) || err) },
        h(Icon, { name: 'broken', size: 21 }),
        h('span', null, tr('assets.cantDraw')),
      ),
  );
}
