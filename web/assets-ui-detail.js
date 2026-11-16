// The detail drawer of the /assets page (a bottom sheet on phones): one item large, with its own zoom; its axes and
// the scene controls it reacts to as rows of buttons; the grid of all its variants (a click shows that one); and what
// is known about it: when and where it shows up, its size, the colours it is drawn in and the code that draws it.
import { tr } from './i18n.js';
import { SeasonTree } from './season-tree.js';
import { AssetsLogic } from './assets-logic.js';
import { AssetsRegistry } from './assets-registry.js';
import { AssetsStage } from './assets-stage.js';
import { AssetsPaint } from './assets-ui-paint.js';
import { CONTROL_LABEL, CONTROL_OPTIONS, Icon, Preview, Seg, TagChip, h } from './assets-ui-parts.js';

const { useEffect, useMemo, useRef, useState } = React;
const L = AssetsLogic,
  R = AssetsRegistry;
const ZOOMS = ['fit', 1, 2, 3, 4, 6];
const SEASON_NAME = {
  spring: () => tr('season.spring'),
  summer: () => tr('season.summer'),
  autumn: () => tr('season.autumn'),
  winter: () => tr('season.winter'),
};
const EVENT_NAME = { christmas: () => tr('assets.event.christmas') };

// When an item shows up, read off its structured `when` (and the game's own calendars), one line per fact.
function whenLines(e) {
  const w = e.when || {},
    out = [];
  if (e.catalogueOnly) out.push(tr('assets.when.catalogue'));
  if (Array.isArray(w.seasons))
    out.push(
      tr('assets.when.seasons', { list: w.seasons.map(k => (SEASON_NAME[k] ? SEASON_NAME[k]() : k)).join(', ') }),
    );
  if (w.event && w.event.key) {
    const win = L.eventWindow(w.event.key, w.event.level),
      name = (EVENT_NAME[w.event.key] || (() => w.event.key))();
    out.push(tr('assets.when.event', { name, level: w.event.level, span: win ? L.span(win) : '' }));
  }
  if (w.holiday) {
    const hd = SeasonTree.SEASONS[w.holiday];
    if (hd && hd.from) out.push(tr('assets.when.holiday', { name: hd.label, span: L.span(hd) }));
    else out.push(tr('assets.when.lunar', { name: hd ? hd.label : w.holiday }));
  }
  if (!out.length || (w.always && !e.catalogueOnly)) out.push(tr('assets.when.always'));
  return out;
}

// The label of a cell of the variants grid: the values that change from cell to cell.
function cellLabel(e, cell, varying) {
  const parts = [];
  for (const a of e.axes)
    if (varying.has('pick.' + a.id)) {
      const v = a.values.find(x => x.id === cell.pick[a.id]);
      if (v) parts.push(v.label());
    }
  for (const u of L.SCENE)
    if (varying.has('controls.' + u)) {
      const o = CONTROL_OPTIONS[u]().find(x => x.id === cell.controls[u]);
      if (o) parts.push(o.label);
    }
  return parts.join(' · ');
}

function Row({ label, children }) {
  return h('div', { className: 'as-row' }, h('div', { className: 'as-row-l' }, label), children);
}

export function Detail({ e, s, set, controls, narrow, onClose, onStep, position }) {
  const cat = R.cat(e.cat),
    pickKey = JSON.stringify(L.fixPick(e, s.pick)),
    pick = useMemo(() => L.fixPick(e, s.pick), [e, pickKey]),
    [zoomMode, setZoomMode] = useState('fit'),
    [copied, setCopied] = useState(false),
    ref = useRef(null);
  const env = AssetsStage.envOf(L.sceneOf(e, controls));
  const info = useMemo(() => AssetsPaint.inspect(e, { env, pick }), [e, env, pick]);
  const cells = useMemo(() => L.combos(e, controls), [e, controls]);
  const varying = useMemo(() => {
    const keys = new Set();
    for (const c of cells) {
      for (const k in c.pick) if (c.pick[k] !== cells[0].pick[k]) keys.add('pick.' + k);
      for (const u of L.SCENE) if (c.controls[u] !== cells[0].controls[u]) keys.add('controls.' + u);
    }
    return keys;
  }, [cells]);
  const scene = L.sceneOf(e, controls);
  const isCurrent = c => {
    for (const a of e.axes) if (c.pick[a.id] !== pick[a.id]) return false;
    const cs = L.sceneOf(e, c.controls);
    for (const u of L.SCENE) if (cs[u] !== scene[u] && !(u === 'season' && env.event)) return false;
    return true;
  };
  useEffect(() => {
    setZoomMode('fit');
    if (ref.current) ref.current.focus({ preventScroll: true });
  }, [e.id]);
  // a zoom larger than the stage opens on the middle of the item
  const stageRef = useRef(null);
  useEffect(() => {
    const el = stageRef.current;
    if (el)
      requestAnimationFrame(() => {
        el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
        el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
      });
  }, [zoomMode, e.id]);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = () => {
    const done = () => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    };
    try {
      navigator.clipboard.writeText(location.href).then(done, done);
    } catch (err) {
      done();
    }
  };
  const name = e.name();
  return h(
    'aside',
    {
      className: 'as-detail',
      role: 'dialog',
      'aria-label': name,
      tabIndex: -1,
      ref,
      style: { '--accent': cat.accent },
    },
    narrow && h('div', { className: 'as-grab', onClick: onClose }),
    h(
      'div',
      { className: 'as-detail-bar' },
      h('span', { className: 'as-tag as-tag-cat' }, cat.label()),
      position && h('span', { className: 'as-pos' }, position[0] + ' / ' + position[1]),
      h('span', { className: 'as-flex' }),
      onStep &&
        h(
          'button',
          { type: 'button', className: 'as-icon-btn', title: tr('assets.detail.prev'), onClick: () => onStep(-1) },
          h(Icon, { name: 'prev' }),
        ),
      onStep &&
        h(
          'button',
          { type: 'button', className: 'as-icon-btn', title: tr('assets.detail.next'), onClick: () => onStep(1) },
          h(Icon, { name: 'next' }),
        ),
      h(
        'button',
        {
          type: 'button',
          className: 'as-icon-btn' + (copied ? ' done' : ''),
          title: tr('assets.detail.copy'),
          onClick: copy,
        },
        h(Icon, { name: 'link' }),
        h('span', { className: 'as-icon-txt' }, copied ? tr('assets.detail.copied') : tr('assets.detail.copy')),
      ),
      h(
        'button',
        { type: 'button', className: 'as-icon-btn as-close', title: tr('assets.detail.close'), onClick: onClose },
        h(Icon, { name: 'close' }),
        !narrow && h('kbd', null, 'Esc'),
      ),
    ),
    h('h2', { className: 'as-detail-name' }, name),
    h(
      'div',
      { className: 'as-tags' },
      e.tags.map(t => R.TAG_LABEL[t] && h(TagChip, { key: t, tag: t, label: R.TAG_LABEL[t]() })),
    ),
    h(
      'div',
      { className: 'as-stage' },
      // Fit: the item fills the stage; at ×N it is drawn that large and the stage scrolls
      h(
        'div',
        { className: 'as-stage-in', ref: stageRef },
        h(Preview, {
          key: zoomMode === 'fit' ? 'fit' : 'zoom',
          entry: e,
          pick,
          controls,
          zoom: zoomMode === 'fit' ? 0 : zoomMode,
          fit: zoomMode === 'fit' ? 8 : 0,
          inset: 14,
          fps: 30,
          className: 'as-big',
        }),
      ),
      h(
        'div',
        { className: 'as-zoom' },
        h(Seg, {
          label: tr('assets.ctl.zoom'),
          value: zoomMode,
          options: ZOOMS.map(z => ({ id: z, label: z === 'fit' ? tr('assets.detail.fit') : '×' + z })),
          onChange: setZoomMode,
        }),
      ),
    ),
    e.axes.length > 0 && h('div', { className: 'as-sec' }, tr('assets.detail.variant')),
    e.axes.map(a =>
      h(
        Row,
        { key: a.id, label: a.label() },
        h(Seg, {
          label: a.label(),
          value: pick[a.id],
          options: a.values.map(v => ({ id: v.id, label: v.label(), swatch: v.swatch })),
          onChange: v => set({ pick: { ...pick, [a.id]: v } }),
        }),
      ),
    ),
    h('div', { className: 'as-sec' }, tr('assets.detail.scene')),
    e.uses.length
      ? e.uses.map(u =>
          h(
            Row,
            { key: u, label: CONTROL_LABEL[u]() },
            h(Seg, {
              label: CONTROL_LABEL[u](),
              value: u === 'season' && s.event ? 'winter' : s[u],
              options: CONTROL_OPTIONS[u](),
              onChange: v => set({ [u]: v }),
              className: u === 'season' && s.event ? 'as-seg-held' : '',
            }),
          ),
        )
      : h('div', { className: 'as-muted' }, tr('assets.detail.sceneless')),
    cells.length > 1 &&
      h('div', { className: 'as-sec' }, tr('assets.detail.all'), h('span', { className: 'as-sec-n' }, cells.length)),
    cells.length > 1 &&
      h(
        'div',
        { className: 'as-cells' },
        cells.map((c, i) => {
          const label = cellLabel(e, c, varying);
          return h(
            'button',
            {
              key: i,
              type: 'button',
              className: 'as-cell' + (isCurrent(c) ? ' on' : ''),
              title: label,
              onClick: () =>
                set({
                  pick: c.pick,
                  light: c.controls.light,
                  season: c.controls.season,
                  snow: c.controls.snow,
                  event: c.controls.event,
                }),
            },
            h(Preview, { entry: e, pick: c.pick, controls: c.controls, fit: 4, inset: 2, still: true }),
            h('span', { className: 'as-cell-l' }, label),
          );
        }),
      ),
    h('div', { className: 'as-sec' }, tr('assets.detail.info')),
    h(
      'dl',
      { className: 'as-info' },
      h('dt', null, tr('assets.detail.when')),
      h(
        'dd',
        null,
        whenLines(e).map((l, i) => h('div', { key: i }, l)),
      ),
      h('dt', null, tr('assets.detail.where')),
      h('dd', null, R.WHERE[e.where]()),
      h('dt', null, tr('assets.detail.size')),
      h(
        'dd',
        null,
        info.size ? tr('assets.detail.px', { w: info.size.w, h: info.size.h }) : '—',
        e.footprint &&
          h(
            'span',
            { className: 'as-muted' },
            ' · ' + tr('assets.detail.tiles', { w: e.footprint[0], d: e.footprint[1] }),
          ),
      ),
      h('dt', null, tr('assets.detail.palette')),
      h(
        'dd',
        { className: 'as-palette' },
        info.palette.map(c => h('span', { key: c, className: 'as-chip-c', title: c, style: { background: c } })),
      ),
      h('dt', null, tr('assets.detail.source')),
      h(
        'dd',
        { className: 'as-src' },
        e.source.map((src, i) =>
          h(
            'div',
            { key: i },
            h('a', { href: '/' + src.file, target: '_blank', rel: 'noopener' }, src.file.replace(/^web\//, '')),
            h('span', { className: 'as-muted' }, ' · '),
            h('code', null, src.fn),
          ),
        ),
      ),
      h('dt', null, tr('assets.detail.id')),
      h('dd', null, h('code', null, e.id)),
    ),
  );
}
