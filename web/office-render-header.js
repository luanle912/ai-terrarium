// The header of the local page. Called from ClaudeOffice#render (office-render.js).
import { tr } from './i18n.js';
import { h } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';
mixin(
  ClaudeOffice,
  class {
    // The header of the local page: logo, season, status and department chips, data source, pause and add.
    renderHeader({ deptList, hdrCtl, isLive, isSim, ls, narrow, paused, seasonInfo, srcColor, srcLabel, summary }) {
      const logo = h(
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
      );
      const seasonChip =
        seasonInfo &&
        h(
          'div',
          { className: 'chip', style: { borderColor: seasonInfo.accent, gap: 6 } },
          h('span', {
            style: {
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: seasonInfo.accent,
              display: 'inline-block',
              boxShadow: '0 0 4px ' + seasonInfo.accent,
            },
          }),
          h('span', { style: { color: seasonInfo.accent, fontWeight: 600 } }, seasonInfo.label),
        );
      const summaryChips = summary.map((c, i) =>
        h(
          'div',
          { key: i, className: 'chip' },
          h('span', { style: { width: 8, height: 8, background: c.color, display: 'inline-block' } }),
          h('span', null, c.label),
          h('strong', { style: { color: '#ffffff' } }, c.n),
        ),
      );
      const deptLabel = h('span', { style: { fontSize: 10, color: '#5d6578' } }, tr('header.depts'));
      const deptChips = deptList.map((d, i) =>
        h(
          'div',
          {
            key: i,
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px 2px 2px',
              background: 'var(--surface)',
              border: '1px solid #232a39',
            },
          },
          h(
            'span',
            {
              style: {
                padding: '1px 5px',
                background: d.color,
                color: '#ffffff',
                fontFamily: "'Pixelify Sans',monospace",
                fontWeight: 600,
                fontSize: 11,
              },
            },
            d.short,
          ),
          h('span', { style: { color: '#c9cfdc', whiteSpace: 'nowrap' } }, d.label),
          h('strong', { style: { color: '#ffffff' } }, d.n),
        ),
      );
      const srcPill = label =>
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '2px solid var(--border)',
              background: 'var(--surface)',
              ...hdrCtl,
            },
          },
          h('span', { style: { width: 8, height: 8, background: srcColor, display: 'inline-block' } }),
          h(
            'span',
            { style: { color: 'var(--fg)', fontWeight: 600, whiteSpace: narrow ? 'nowrap' : undefined } },
            label,
          ),
        );
      const pauseBtn = label =>
        h(
          'button',
          {
            className: 'btn',
            title: narrow ? (paused ? tr('header.resume') : tr('header.pause')) : undefined,
            style: hdrCtl,
            onClick: () => this.setState(p => ({ paused: !p.paused })),
          },
          label,
        );
      const addBtn = label =>
        isSim &&
        h(
          'button',
          {
            className: 'btn btn-accent',
            title: narrow ? tr('header.addSession') : undefined,
            style: hdrCtl,
            onClick: () => {
              const a = this.addAgent({});
              if (a) this.setState({ sel: a.id });
            },
          },
          label,
        );

      // Phone: one fixed-height row (logo, source, pause, add) and one strip of status and department chips that
      // scrolls sideways instead of wrapping, so the header never pushes the island down. A phone on its side is wide but
      // short, so there the strip sits inside the row between the logo and the controls.
      const strip = flex =>
        h(
          'div',
          {
            key: 'strip',
            className: 'hscroll',
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              flex,
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              minWidth: 0,
            },
          },
          seasonChip,
          this.worldChip(),
          summaryChips,
          deptList.length > 0 && h('span', { style: { width: 4, flex: 'none' } }),
          deptList.length > 0 && deptLabel,
          deptChips,
        );
      const oneRow = narrow && window.innerWidth > 640;
      const top = narrow
        ? [
            h(
              'header',
              {
                key: 'hdr',
                style: { display: 'flex', alignItems: 'center', gap: 8, height: 30, flex: 'none', minWidth: 0 },
              },
              h('div', { title: tr('header.logoTitle'), style: { flex: 'none' } }, logo),
              oneRow ? strip('1 1 0') : h('div', { style: { flex: '1 1 0', minWidth: 0 } }),
              srcPill(
                isLive
                  ? ls === 'ok'
                    ? 'LIVE'
                    : ls === 'error'
                      ? tr('source.short.lost')
                      : tr('source.short.connecting')
                  : tr('source.sim'),
              ),
              pauseBtn(paused ? '▶' : '❚❚'),
              addBtn('+'),
            ),
            !oneRow && strip('none'),
          ]
        : [
            h(
              'header',
              { key: 'hdr', style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px' } },
              h(
                'div',
                {
                  title: tr('header.logoTitle'),
                  style: { display: 'flex', alignItems: 'baseline', gap: 8, flex: 'none' },
                },
                logo,
                this.serverVersion &&
                  h(
                    'span',
                    {
                      style: {
                        fontSize: 10,
                        color: 'var(--muted)',
                        fontFamily: "'JetBrains Mono',monospace",
                        opacity: 0.6,
                      },
                    },
                    'v' + this.serverVersion,
                  ),
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
                    flex: '1 1 360px',
                    minWidth: 0,
                  },
                },
                seasonChip,
                this.worldChip(),
                summaryChips,
              ),
              h(
                'div',
                { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flex: 'none' } },
                srcPill(srcLabel),
                pauseBtn(paused ? '▶ ' + tr('header.resume') : '❚❚ ' + tr('header.pause')),
                addBtn(tr('header.addSessionBtn')),
              ),
            ),
            deptList.length > 0 &&
              h(
                'div',
                {
                  key: 'depts',
                  style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 11 },
                },
                deptLabel,
                deptChips,
              ),
          ];
      return top;
    }
  },
);
