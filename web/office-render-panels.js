// The selected agent's panels. Called from ClaudeOffice#render (office-render.js).
import { tr } from './i18n.js';
import { h } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';
mixin(
  ClaudeOffice,
  class {
    // The selected agent's panel as others see it (only what the hub gets).
    renderOthersPanel({ others, s, selData }) {
      return (
        selData &&
        others &&
        (() => {
          const raw = this.raw.get(s.sid) || {},
            fl = (l, v, k) =>
              h(
                'div',
                { key: k, style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
                h('span', { style: { fontSize: 10, color: 'var(--muted)' } }, l),
                h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, v),
              );
          return h(
            'div',
            {
              style: {
                position: 'absolute',
                zIndex: 10,
                top: 12,
                right: 12,
                width: 300,
                maxWidth: 'calc(100% - 24px)',
                boxSizing: 'border-box',
                background: 'var(--surface)',
                border: '3px solid var(--fg)',
                boxShadow: '6px 6px 0 rgba(0,0,0,0.45)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                fontSize: 12,
              },
            },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 10 } },
              h(
                'div',
                {
                  style: {
                    width: 34,
                    height: 34,
                    background: selData.deptColor,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Pixelify Sans',monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    flex: 'none',
                  },
                },
                selData.short,
              ),
              h(
                'div',
                {
                  style: {
                    flex: 1,
                    minWidth: 0,
                    fontFamily: "'Pixelify Sans',monospace",
                    fontSize: 17,
                    fontWeight: 600,
                    color: '#ffffff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                },
                selData.dept,
              ),
              h(
                'button',
                {
                  className: 'btn',
                  onClick: () => this.setState({ sel: null }),
                  style: { width: 28, height: 28, padding: 0, flex: 'none' },
                },
                '×',
              ),
            ),
            h(
              'div',
              { style: { padding: 10, background: 'var(--bg)', borderLeft: '4px solid ' + selData.statusColor } },
              h('span', { style: { fontWeight: 600, color: selData.statusColor } }, selData.statusLabel),
            ),
            h(
              'div',
              { style: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px 14px' } },
              fl(
                tr('detail.field.kind'),
                {
                  shell: tr('detail.kind.shell'),
                  edit: tr('detail.kind.edit'),
                  read: tr('detail.kind.read'),
                  web: tr('detail.kind.web'),
                  agent: tr('detail.kind.agent'),
                  mcp: tr('detail.kind.mcp'),
                  other: tr('detail.kind.other'),
                }[raw.kind] || '—',
                'kind',
              ),
              fl(tr('detail.field.dept'), selData.dept, 'dept'),
              raw.tool ? fl(tr('detail.field.tool'), String(raw.tool).slice(0, 32), 'tool') : null,
              raw.model ? fl(tr('detail.field.model'), String(raw.model).slice(0, 48), 'model') : null,
              fl(tr('detail.field.role'), selData.role, 'role'),
            ),
          );
        })()
      );
    }

    // The selected agent's detail panel: status, activity, folder, model, history, approve/deny in the sim.
    renderDetailPanel({ others, s, selData }) {
      return (
        selData &&
        !others &&
        h(
          'div',
          {
            style: {
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
            },
          },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            h(
              'div',
              {
                style: {
                  width: 34,
                  height: 34,
                  background: selData.deptColor,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Pixelify Sans',monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  flex: 'none',
                },
              },
              selData.short,
            ),
            h(
              'div',
              { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 } },
              h(
                'div',
                {
                  style: {
                    fontFamily: "'Pixelify Sans',monospace",
                    fontSize: 17,
                    fontWeight: 600,
                    color: '#ffffff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                },
                selData.name,
              ),
              h('div', { style: { fontSize: 10, color: 'var(--muted)' } }, selData.sid),
            ),
            h(
              'button',
              {
                className: 'btn',
                onClick: () => this.setState({ sel: null }),
                style: { width: 28, height: 28, padding: 0, flex: 'none' },
              },
              '×',
            ),
          ),
          h(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 10,
                background: 'var(--bg)',
                borderLeft: '4px solid ' + selData.statusColor,
              },
            },
            h('span', { style: { fontWeight: 600, color: selData.statusColor } }, selData.statusLabel),
            h('span', { style: { color: 'var(--fg)', wordBreak: 'break-all' } }, selData.activity),
          ),
          selData.canApprove &&
            h(
              'div',
              { style: { display: 'flex', gap: 8 } },
              h(
                'button',
                {
                  onClick: () => {
                    if (s) {
                      this.log(s, tr('detail.log.allowed', { msg: s.msg }));
                      s.status = 'working';
                      s.tool = [s.msg.split(':')[0], s.msg.split(':')[1] || ''];
                      s.until = Date.now() + 3000 / this.speed;
                      this.forceUpdate();
                    }
                  },
                  style: {
                    flex: 1,
                    border: '2px solid #46a758',
                    background: '#46a758',
                    color: '#06140a',
                    padding: 9,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  },
                },
                tr('detail.allow'),
              ),
              h(
                'button',
                {
                  className: 'btn',
                  onClick: () => {
                    if (s) {
                      this.log(s, tr('detail.log.denied', { msg: s.msg }));
                      s.status = 'error';
                      s.msg = tr('detail.msg.userDenied');
                      s.until = Date.now() + 2000 / this.speed;
                      this.forceUpdate();
                    }
                  },
                  style: { flex: 1, padding: 9 },
                },
                tr('detail.deny'),
              ),
            ),
          h(
            'div',
            { style: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px 14px' } },
            [
              [tr('detail.field.cwd'), selData.cwd],
              [tr('detail.field.model'), selData.model],
              [tr('detail.field.tokens'), selData.tokens],
              [tr('detail.field.role'), selData.role],
            ].map(([label, val], i) =>
              h(
                'div',
                { key: i, style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
                h('span', { style: { fontSize: 10, color: 'var(--muted)' } }, label),
                h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, val),
              ),
            ),
            h(
              'div',
              {
                key: 'dept',
                style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, gridColumn: '1 / -1' },
              },
              h('span', { style: { fontSize: 10, color: 'var(--muted)' } }, tr('detail.field.deptByCwd')),
              h(
                'span',
                { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                h('span', {
                  style: { width: 8, height: 8, background: selData.deptColor, display: 'inline-block' },
                }),
                selData.dept,
              ),
            ),
          ),
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            h('span', { style: { fontSize: 10, color: 'var(--muted)' } }, tr('detail.field.recent')),
            selData.hist.map((hh, i) =>
              h(
                'div',
                { key: i, style: { display: 'flex', gap: 8, lineHeight: 1.45 } },
                h('span', { style: { color: '#5d6578', flex: 'none' } }, hh.t),
                h('span', { style: { color: '#c9cfdc', wordBreak: 'break-word' } }, hh.text),
              ),
            ),
          ),
        )
      );
    }
  },
);
