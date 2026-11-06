// World mode React tree: header, the island panel or phone sheet, and the world settings panel.
import { tr } from './i18n.js';
import { WorldLogic } from './world-logic.js';
import { WEATHER_LABEL, WEATHER_PREVIEW, h, languagePicker } from './office-scene.js';
import { ClaudeOffice } from './office.js';
import { GOLD, MUTED, TITLE, okColor } from './world-ui.js';
Object.assign(ClaudeOffice.prototype, {
  // ---- world page ----
  renderWorld() {
    const w = this.world,
      { showSettings } = this.state,
      mine = this.myIsland(),
      online = w.islands.filter(i => i.online !== false).length;
    const pad = {
      paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
      paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
    };
    const hdrCtl = { padding: '4px 10px', fontSize: 11 };
    const connCol = w.conn === 'ok' ? '#46a758' : w.conn === 'connecting' || w.conn === 'busy' ? '#f5a524' : '#e5484d';
    const connText =
      {
        ok: tr('world.conn.ok'),
        error: tr('world.conn.error'),
        ended: tr('world.conn.ended'),
        refused: tr('world.conn.refused'),
        busy: tr('world.conn.busy'),
        unreachable: tr('world.conn.unreachable'),
      }[w.conn] || tr('world.conn.connecting');
    // "← Toàn cảnh" on one island and on "Của tôi", edged in that island's colour like its name plate.
    const shownMeta = w.view === 'one' ? w.islands.find(i => i.id === w.focus) : w.view === 'mine' ? mine : null;
    const back =
      w.view !== 'all' &&
      !w.dead &&
      h(
        'button',
        {
          key: 'back:' + w.view + ':' + (w.focus || ''),
          type: 'button',
          className: 'sky-back',
          'aria-label': tr('world.back.aria'),
          title: tr('world.back.aria'),
          onClick: () => this.navigate({ view: 'all' }),
        },
        h('span', {
          className: 'tab',
          'aria-hidden': true,
          style: { background: shownMeta ? okColor(shownMeta.color) : GOLD },
        }),
        h('span', { 'aria-hidden': true }, '←'),
        h('span', null, tr('world.view.all')),
        h('kbd', { 'aria-hidden': true }, 'Esc'),
      );
    const tab = (v, label) =>
      h(
        'button',
        {
          key: v,
          className: 'btn' + (w.view === v ? ' btn-active' : ''),
          style: hdrCtl,
          'aria-pressed': w.view === v,
          onClick: () => this.navigate({ view: v }),
        },
        label,
      );
    // "Đảo 5/8 · 3 online", led by eight small squares, one per place in the sky: green sending, grey offline,
    // hollow free; mine has a gold edge.
    const cap = w.capacity || WorldLogic.SLOTS,
      bySlot = new Map(w.islands.map(i => [i.slot, i])),
      mySlot = this.mySlot();
    const slotChip = h(
      'div',
      { className: 'chip', title: tr('world.slots.title', { islands: w.islands.length, cap, online }) },
      h(
        'span',
        { 'aria-hidden': true, style: { display: 'flex', gap: 2 } },
        Array.from({ length: cap }, (_, s) => {
          const m = bySlot.get(s);
          return h('span', {
            key: s,
            style: {
              width: 6,
              height: 6,
              boxSizing: 'border-box',
              display: 'inline-block',
              background: m ? (m.online === false ? '#5d6478' : '#46a758') : 'transparent',
              border: '1px solid ' + (s === mySlot ? '#ffd166' : m ? 'transparent' : '#4a5468'),
            },
          });
        }),
      ),
      h('span', null, tr('world.slots.label')),
      h('strong', { style: { color: '#ffffff' } }, w.islands.length + '/' + cap),
      h('span', null, tr('world.slots.online', { n: online })),
    );
    return h(
      'div',
      {
        className: 'app',
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingTop: 12,
          paddingBottom: 12,
          boxSizing: 'border-box',
          overflow: 'hidden',
          background: 'var(--bg)',
          ...pad,
        },
      },
      h(
        'header',
        { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px' } },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'baseline', gap: 8, flex: 'none' } },
          h(
            'div',
            {
              style: {
                fontFamily: "'Pixelify Sans',monospace",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '0.02em',
                color: '#ffffff',
              },
            },
            'CLAUDE CO.',
          ),
          h('span', { style: { fontSize: 11, color: 'var(--muted)' } }, location.host),
        ),
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              fontSize: 11,
              alignItems: 'center',
              flex: '1 1 300px',
              minWidth: 0,
            },
          },
          slotChip,
          h(
            'div',
            { className: 'chip' },
            h('span', null, tr('world.header.viewers')),
            h('strong', { style: { color: '#ffffff' } }, w.viewers),
          ),
          h(
            'div',
            { className: 'chip', title: connText },
            h('span', { style: { width: 8, height: 8, background: connCol, display: 'inline-block' } }),
            h('span', null, connText),
          ),
        ),
        h(
          'div',
          { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flex: 'none' } },
          h(
            'div',
            { role: 'group', 'aria-label': tr('world.header.viewMode'), style: { display: 'flex' } },
            tab('all', tr('world.view.all')),
            tab('mine', tr('world.view.mine')),
          ),
          h(
            'a',
            { className: 'btn', style: { ...hdrCtl, textDecoration: 'none' }, href: '/me' },
            tr('world.header.myIslandLink'),
          ),
          // Settings live in the header here: the sky uses the whole stage, down to its bottom corners.
          h(
            'button',
            {
              className: 'btn' + (showSettings ? ' btn-active' : ''),
              'aria-label': tr('world.settings.label'),
              'aria-expanded': !!showSettings,
              title: tr('world.settings.title'),
              style: { ...hdrCtl, width: 30, padding: '4px 0' },
              onClick: () => this.setState(p => ({ showSettings: !p.showSettings })),
            },
            '⚙',
          ),
        ),
      ),
      h(
        'div',
        {
          ref: this.setWorldStage,
          style: { position: 'relative', flex: '1 1 0', minHeight: 0, border: '3px solid #232a39', overflow: 'hidden' },
        },
        h('canvas', {
          ref: this.setBack,
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, display: 'block' },
        }),
        h('canvas', {
          ref: this.setWorldCanvas,
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, display: 'block' },
        }),
        h('canvas', {
          ref: this.setFront,
          style: {
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 2,
            pointerEvents: 'none',
            display: 'block',
          },
        }),
        // Takes hover and clicks; on a phone it scrolls a spacer as tall as the sky (drawSky8 sets overflow and
        // height).
        h(
          'div',
          {
            ref: this.setWorldScroller,
            onClick: e => this.onWorldClick(e),
            onPointerMove: this.onWorldHover,
            onPointerLeave: this.onWorldHover,
            style: {
              position: 'absolute',
              inset: 0,
              zIndex: 3,
              overflowX: 'hidden',
              touchAction: w.view === 'all' ? 'pan-y' : 'manipulation',
            },
          },
          h('div', { ref: this.setWorldSpacer, style: { width: 1 } }),
        ),
        back,
        this.worldLinkBand(),
        this.worldPanel(mine),
        showSettings && this.worldSettings(),
      ),
    );
  },
  // The island's panel (worldSheet): a title bar (icon, title, one line of status, a chevron, an optional close
  // button) and the body. On a wide stage it sits top right and the bar collapses it; on a phone it is a bottom sheet
  // that starts as the bar alone. Keyed by view, so it enters with the back control at each swap, not on every change.
  worldSheet(o, children) {
    const w = this.world,
      phone = this.phoneStage(w.sw),
      open = this.sheetOpen(),
      id = 'sky-sheet-body';
    const chev = phone === open ? '▾' : '▴';
    return h(
      'section',
      {
        key: 'sheet:' + w.view + ':' + (w.focus || ''),
        className: 'sky-sheet' + (phone ? ' is-phone' : ''),
        'aria-label': o.label || o.title,
      },
      h(
        'div',
        { className: 'sky-sheet-head' },
        h(
          'button',
          {
            type: 'button',
            className: 'sky-sheet-bar',
            'aria-expanded': open,
            'aria-controls': id,
            title: open ? tr('world.sheet.collapse') : tr('world.sheet.expand'),
            onClick: () => {
              w.sheetOpen = !open;
              this.forceUpdate();
            },
          },
          o.icon,
          h(
            'span',
            { className: 'sky-sheet-name' },
            h('span', { style: TITLE }, o.title),
            o.sub &&
              h(
                'span',
                { style: { ...MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                o.sub,
              ),
          ),
          h('span', { className: 'sky-sheet-chev', 'aria-hidden': true }, chev),
        ),
        o.extra || null,
      ),
      open && h('div', { id, className: 'sky-sheet-body' }, ...children),
    );
  },
  worldSettings() {
    const st = this.state;
    return h(
      'div',
      { className: 'settings-panel', style: { top: 12, bottom: 'auto' } },
      h(
        'div',
        {
          style: {
            fontFamily: "'Pixelify Sans',monospace",
            fontSize: 14,
            fontWeight: 600,
            color: '#ffffff',
            marginBottom: 4,
          },
        },
        tr('settings.title'),
      ),
      languagePicker(),
      h(
        'label',
        null,
        tr('settings.speed', { speed: st.speed.toFixed(2) }),
        h('input', {
          type: 'range',
          min: 0.5,
          max: 3,
          step: 0.25,
          value: st.speed,
          onChange: e => this.setState({ speed: +e.target.value }),
        }),
      ),
      h('div', { style: { borderTop: '1px solid var(--border)', margin: '2px 0' } }),
      h(
        'label',
        null,
        tr('settings.weather'),
        h(
          'select',
          {
            'aria-label': tr('settings.weather.modeAria'),
            value: st.weatherMode,
            onChange: e => this.setWeather({ weatherMode: e.target.value }),
          },
          h('option', { value: 'random' }, tr('weather.mode.random')),
          h('option', { value: 'real' }, tr('weather.mode.real')),
          h('option', { value: 'off' }, tr('weather.mode.off')),
        ),
      ),
      st.weatherMode === 'real' &&
        h(
          'div',
          { style: { display: 'flex', gap: 6 } },
          h('input', {
            type: 'text',
            'aria-label': tr('settings.city.aria'),
            placeholder: tr('settings.city.placeholder'),
            value: st.cityDraft,
            style: { flex: 1, maxWidth: 'none' },
            onChange: e => this.setState({ cityDraft: e.target.value }),
            onKeyDown: e => {
              if (e.key === 'Enter') this.setWeather({ city: st.cityDraft.trim() });
            },
          }),
          h(
            'button',
            {
              className: 'btn',
              style: { padding: '4px 8px', fontSize: 11 },
              onClick: () => this.setWeather({ city: st.cityDraft.trim() }),
            },
            tr('settings.city.update'),
          ),
        ),
      st.weatherMode === 'real' &&
        st.realStatus.text &&
        h(
          'span',
          {
            role: 'status',
            style: {
              fontSize: 11,
              lineHeight: 1.4,
              color: st.realStatus.state === 'error' ? '#ff9b9e' : 'var(--muted)',
            },
          },
          st.realStatus.text,
        ),
      h(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
        WEATHER_PREVIEW.map(([type, label]) =>
          h(
            'button',
            {
              key: type,
              className: 'btn',
              title: tr('settings.weather.previewTitle', { label: WEATHER_LABEL[type] }),
              style: { padding: '3px 7px', fontSize: 11 },
              onClick: () => this.previewWeather(type),
            },
            label,
          ),
        ),
      ),
    );
  },
});
