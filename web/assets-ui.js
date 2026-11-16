// The /assets page: a header with the search and the global controls, a rail of categories and tag filters, a grid
// of cards (one per item, drawn with the game's own code) and the detail drawer (web/assets-ui-detail.js). Its whole
// state lives in the URL hash (AssetsLogic.toHash), so any view can be linked to and comes back on reload.
import { I18n, tr } from './i18n.js';
import { languagePicker } from './office-scene.js';
import { AssetsLogic } from './assets-logic.js';
import { AssetsRegistry } from './assets-registry.js';
import { AssetsPaint } from './assets-ui-paint.js';
import { EVENTS, Icon, LIGHTS, Preview, SEASONS, SNOWS, Seg, TagChip, h } from './assets-ui-parts.js';
import { Detail } from './assets-ui-detail.js';

const { useEffect, useMemo, useRef, useState } = React;
const L = AssetsLogic,
  R = AssetsRegistry;
// The box a card's preview fits in (css px): the zoom goes down from the chosen one until the item fits.
const CARD_W = 188,
  CARD_H = 124;
const FILTER_TAGS = ['season', 'event', 'night', 'animated', 'state', 'catalogue-only'];
const CARD_TAGS = ['season', 'event', 'animated', 'state', 'catalogue-only'];
const PICKS = new Map();
// Every entry's name in Vietnamese and English as well, so a search finds an item in either whatever the page's
// language. Read once, switching the lookup language for a moment (nothing is saved).
let NAMES = null;
function otherNames(e) {
  if (!NAMES) {
    NAMES = new Map();
    const lang = I18n.lang;
    for (const l of ['vi', 'en']) {
      I18n.setLang(l, { persist: false });
      for (const x of R.entries()) NAMES.set(x.id, (NAMES.get(x.id) || '') + ' ' + x.name());
    }
    I18n.setLang(lang, { persist: false });
  }
  return NAMES.get(e.id) || '';
}
const firstPick = e => PICKS.get(e.id) || (PICKS.set(e.id, L.defaultPick(e)), PICKS.get(e.id));

const reducedMotion = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
};
// The state of a hash; without a motion choice in it, motion follows prefers-reduced-motion.
function stateOf(hash) {
  const s = L.fromHash(hash);
  if (!/[?&]motion=/.test(hash || '') && reducedMotion()) s.motion = false;
  if (s.id && !R.byId(s.id)) s.id = null;
  if (s.cat !== 'all' && !R.CATS.some(c => c.id === s.cat)) s.cat = 'all';
  return s;
}
const hrefOf = (s, patch) => L.toHash({ ...s, ...patch });

// ---- header ----
function Header({ s, set, searchRef, narrow }) {
  const group = (key, node) =>
    h('div', { className: 'as-ctl', key }, h('span', { className: 'as-ctl-label' }, key), node);
  const winter = s.event > 0;
  return h(
    'header',
    { className: 'as-header' },
    h(
      'div',
      { className: 'as-top' },
      h(
        'a',
        {
          className: 'as-brand',
          href: '#/',
          onClick: e => (e.preventDefault(), set({ ...L.DEFAULTS, motion: s.motion })),
        },
        h('span', { className: 'as-logo' }, 'CLAUDE CO.'),
        h('span', { className: 'as-brand-dot' }, '·'),
        h('span', { className: 'as-brand-sub' }, tr('assets.title')),
      ),
      h('a', { className: 'as-back', href: '/' }, h(Icon, { name: 'back' }), h('span', null, tr('assets.back'))),
      h(
        'label',
        { className: 'as-search' },
        h(Icon, { name: 'search' }),
        h('input', {
          ref: searchRef,
          type: 'search',
          value: s.q,
          placeholder: tr('assets.search'),
          'aria-label': tr('assets.search'),
          onChange: e => set({ q: e.target.value }),
          onKeyDown: e => {
            if (e.key === 'Escape') {
              if (s.q) set({ q: '' });
              else e.target.blur();
              e.stopPropagation();
            }
          },
        }),
        !narrow && h('kbd', { title: tr('assets.searchHint') }, '/'),
      ),
      h('div', { className: 'as-lang' }, languagePicker()),
    ),
    h(
      'div',
      { className: 'as-controls hscroll' },
      group(
        tr('assets.ctl.light'),
        h(Seg, {
          label: tr('assets.ctl.light'),
          value: s.light,
          options: LIGHTS(),
          onChange: v => set({ light: v }),
          compact: narrow,
        }),
      ),
      group(
        tr('assets.ctl.season'),
        h(Seg, {
          label: tr('assets.ctl.season'),
          value: winter ? 'winter' : s.season,
          options: SEASONS().map(o => (winter ? { ...o, title: tr('assets.eventWinter') } : o)),
          onChange: v => set({ season: v }),
          className: winter ? 'as-seg-held' : '',
        }),
      ),
      group(
        tr('assets.ctl.snow'),
        h(Seg, { label: tr('assets.ctl.snow'), value: s.snow, options: SNOWS(), onChange: v => set({ snow: v }) }),
      ),
      group(
        tr('assets.ctl.event'),
        h(Seg, { label: tr('assets.ctl.event'), value: s.event, options: EVENTS(), onChange: v => set({ event: v }) }),
      ),
      group(
        tr('assets.ctl.zoom'),
        h(Seg, {
          label: tr('assets.ctl.zoom'),
          value: s.zoom,
          options: L.CHOICES.zoom.map(z => ({ id: z, label: '×' + z })),
          onChange: v => set({ zoom: v }),
        }),
      ),
      group(
        tr('assets.ctl.motion'),
        h(Seg, {
          label: tr('assets.ctl.motion'),
          value: s.motion,
          options: [
            { id: true, label: tr('assets.motion.on'), icon: 'play' },
            { id: false, label: tr('assets.motion.off'), icon: 'pause' },
          ],
          onChange: v => set({ motion: v }),
          compact: true,
        }),
      ),
    ),
  );
}

// ---- rail ----
function Rail({ s, set, counts }) {
  const cats = R.CATS.filter(c => R.entries().some(e => e.cat === c.id));
  const catBtn = (id, label, accent) =>
    h(
      'a',
      {
        key: id,
        href: hrefOf(s, { cat: id, id: null }),
        className: 'as-cat' + (s.cat === id ? ' on' : '') + (counts[id] ? '' : ' none'),
        style: { '--accent': accent },
        'aria-current': s.cat === id ? 'page' : undefined,
        onClick: e => (e.preventDefault(), set({ cat: id })),
      },
      h('span', { className: 'as-cat-dot' }),
      h('span', { className: 'as-cat-name' }, label),
      h('span', { className: 'as-cat-n' }, counts[id] || 0),
    );
  const toggle = t => set({ tags: s.tags.includes(t) ? s.tags.filter(x => x !== t) : [...s.tags, t] });
  const variants = R.entries().reduce((n, e) => n + L.variantCount(e), 0);
  return h(
    'nav',
    { className: 'as-rail', 'aria-label': tr('assets.cats') },
    h('div', { className: 'as-rail-h' }, tr('assets.cats')),
    h(
      'div',
      { className: 'as-cats hscroll' },
      catBtn('all', tr('assets.all'), '#e6e9ef'),
      cats.map(c => catBtn(c.id, c.label(), c.accent)),
    ),
    h('div', { className: 'as-rail-h' }, tr('assets.filters')),
    h(
      'div',
      { className: 'as-filters hscroll' },
      FILTER_TAGS.map(t =>
        h(
          'button',
          {
            key: t,
            type: 'button',
            className: 'as-filter as-tag-' + t + (s.tags.includes(t) ? ' on' : ''),
            'aria-pressed': s.tags.includes(t),
            onClick: () => toggle(t),
          },
          h('span', { className: 'as-check' }),
          R.TAG_LABEL[t](),
        ),
      ),
    ),
    h(
      'div',
      { className: 'as-rail-foot' },
      h('div', null, tr('assets.total', { n: R.entries().length, v: variants })),
      h('div', { className: 'as-keys' }, h('kbd', null, '/'), ' ', tr('assets.keys.search')),
      h('div', { className: 'as-keys' }, h('kbd', null, '←'), h('kbd', null, '→'), ' ', tr('assets.keys.browse')),
      h('div', { className: 'as-keys' }, h('kbd', null, 'Esc'), ' ', tr('assets.keys.close')),
    ),
  );
}

// ---- grid ----
function Card({ e, s, controls, onOpen }) {
  const cat = R.cat(e.cat),
    f = AssetsPaint.frameOf(e),
    zoom = AssetsPaint.fitZoom(f, CARD_W, CARD_H, s.zoom),
    n = L.variantCount(e),
    name = e.name();
  return h(
    'a',
    {
      className: 'as-card' + (s.id === e.id ? ' on' : ''),
      href: hrefOf(s, { id: e.id, pick: {} }),
      style: { '--accent': cat.accent, '--cell': 4 * zoom + 'px' },
      'data-id': e.id,
      onClick: ev => {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
        ev.preventDefault();
        onOpen(e.id);
      },
    },
    h(
      'div',
      { className: 'as-card-stage' },
      h(Preview, { entry: e, pick: firstPick(e), controls, zoom, fps: 15 }),
      n > 1 && h('span', { className: 'as-count', title: tr('assets.variants', { n }) }, '×' + n),
    ),
    h(
      'div',
      { className: 'as-card-body' },
      h('div', { className: 'as-card-name' }, name),
      h(
        'div',
        { className: 'as-tags' },
        h('span', { className: 'as-tag as-tag-cat' }, cat.label()),
        CARD_TAGS.filter(t => e.tags.includes(t)).map(t => h(TagChip, { key: t, tag: t, label: R.TAG_LABEL[t]() })),
      ),
    ),
  );
}

function Grid({ s, set, list, controls }) {
  const cat = s.cat === 'all' ? null : R.cat(s.cat);
  const title = cat ? cat.label() : tr('assets.all');
  const variants = list.reduce((n, e) => n + L.variantCount(e), 0);
  const filtered = !!(s.q || s.tags.length);
  return h(
    'main',
    { className: 'as-main', style: { '--accent': cat ? cat.accent : '#ffd166' } },
    h(
      'div',
      { className: 'as-main-head' },
      h('h1', { className: 'as-title' }, title),
      h('span', { className: 'as-sub' }, tr('assets.results', { n: list.length, v: variants })),
      filtered &&
        h(
          'button',
          { type: 'button', className: 'as-clear', onClick: () => set({ q: '', tags: [] }) },
          h(Icon, { name: 'close', size: 10 }),
          tr('assets.clearFilters'),
        ),
    ),
    list.length
      ? h(
          'div',
          { className: 'as-grid' },
          list.map(e => h(Card, { key: e.id, e, s, controls, onOpen: id => set({ id, pick: {} }) })),
        )
      : h(
          'div',
          { className: 'as-empty' },
          h(Icon, { name: 'search', size: 42 }),
          h('div', { className: 'as-empty-t' }, tr('assets.empty')),
          h('div', { className: 'as-empty-s' }, tr('assets.emptyHint')),
          h(
            'button',
            { type: 'button', className: 'as-btn', onClick: () => set({ q: '', tags: [], cat: 'all' }) },
            tr('assets.clearFilters'),
          ),
        ),
  );
}

// ---- the page ----
const narrowMq = () => (typeof matchMedia !== 'undefined' ? matchMedia('(max-width: 760px)') : null);
export function AssetsApp() {
  const [s, setS] = useState(() => stateOf(location.hash));
  const [narrow, setNarrow] = useState(() => !!(narrowMq() && narrowMq().matches));
  const searchRef = useRef(null);
  const set = patch => setS(prev => ({ ...prev, ...patch }));
  useEffect(() => {
    const onHash = () => setS(stateOf(location.hash));
    const mq = narrowMq(),
      onMq = () => setNarrow(mq.matches);
    addEventListener('hashchange', onHash);
    if (mq) mq.addEventListener('change', onMq);
    return () => {
      removeEventListener('hashchange', onHash);
      if (mq) mq.removeEventListener('change', onMq);
    };
  }, []);
  // the hash follows the state without adding history entries
  useEffect(() => {
    const hash = L.toHash(s);
    if (hash !== (location.hash || '#/')) history.replaceState(null, '', hash === '#/' ? location.pathname : hash);
  }, [s]);
  useEffect(() => AssetsPaint.setMotion(s.motion), [s.motion]);
  const all = R.entries();
  const list = useMemo(() => L.filter(all, s, otherNames), [s.cat, s.q, s.tags, I18n.lang]);
  const counts = useMemo(() => L.counts(L.filter(all, { q: s.q, tags: s.tags }, otherNames)), [s.q, s.tags]);
  const controls = useMemo(
    () => ({ light: s.light, season: s.season, snow: s.snow, event: s.event }),
    [s.light, s.season, s.snow, s.event],
  );
  const sel = s.id ? R.byId(s.id) : null;
  // ←/→ walk the list on screen (or the item's category when a filter hides it)
  const ring = sel && (list.includes(sel) ? list : all.filter(e => e.cat === sel.cat));
  const step = d => {
    if (!ring || !ring.length) return;
    const i = ring.indexOf(sel),
      next = ring[(i + d + ring.length) % ring.length];
    set({ id: next.id, pick: {} });
    const card = document.querySelector(`.as-card[data-id="${next.id}"]`);
    if (card) card.scrollIntoView({ block: 'nearest' });
  };
  useEffect(() => {
    const onKey = e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (searchRef.current) searchRef.current.focus();
      } else if (e.key === 'Escape' && sel) {
        set({ id: null, pick: {} });
        const card = document.querySelector(`.as-card[data-id="${sel.id}"]`);
        if (card) card.focus();
      } else if (sel && !typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        step(e.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  return h(
    'div',
    { className: 'as-app' + (sel ? ' as-has-detail' : '') },
    h(Header, { s, set, searchRef, narrow }),
    h(
      'div',
      { className: 'as-body' },
      h(Rail, { s, set, counts }),
      h(Grid, { s, set, list, controls }),
      sel &&
        h(Detail, {
          key: 'detail',
          e: sel,
          s,
          set,
          controls,
          narrow,
          onClose: () => set({ id: null, pick: {} }),
          onStep: ring && ring.length > 1 ? step : null,
          position: ring ? [ring.indexOf(sel) + 1, ring.length] : null,
        }),
    ),
  );
}
