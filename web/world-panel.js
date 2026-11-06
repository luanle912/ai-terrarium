// World mode: the island panel (my island, another island, owner actions, devices) beside the sky or one island.
import { tr } from './i18n.js';
import { h } from './office-scene.js';
import { ST } from './office-util.js';
import { ClaudeOffice } from './office.js';
import {
  ERR,
  GOLD,
  INPUT,
  KIND_LABEL,
  LINK,
  MUTED,
  PANEL,
  SEND_LABEL,
  SHARE_LABEL,
  SMALL_BTN,
  TITLE,
  clip,
  confirmRow,
  field,
  swatch,
  tally,
  when,
} from './world-ui.js';
Object.assign(ClaudeOffice.prototype, {
  worldPanel(mine) {
    const w = this.world,
      { sel, selIsland } = this.state;
    if (w.dead) {
      if (w.conn === 'refused' || w.conn === 'busy' || w.conn === 'unreachable') {
        const [title, text] = {
          refused: [tr('world.dead.refused.title'), tr('world.dead.refused.text')],
          busy: [tr('world.conn.busy'), tr('world.dead.busy.text')],
          unreachable: [tr('world.dead.unreachable.title'), tr('world.dead.unreachable.text')],
        }[w.conn];
        const waitS = w.retryAt ? Math.ceil((w.retryAt - performance.now()) / 1000) : 0;
        return h(
          'div',
          { style: PANEL },
          h('div', { style: TITLE }, title),
          h('span', { role: 'alert', style: { lineHeight: 1.5 } }, text),
          h(
            'button',
            { className: 'btn btn-accent', disabled: !!w.retrying || waitS > 0, onClick: () => this.retryWorld() },
            w.retrying
              ? tr('world.dead.retrying')
              : waitS > 0
                ? tr('world.dead.retryIn', { s: waitS })
                : tr('world.dead.retry'),
          ),
        );
      }
      if (w.conn === 'ended')
        return h(
          'div',
          { style: PANEL },
          h('div', { style: TITLE }, tr('world.conn.ended')),
          h('span', { style: { lineHeight: 1.5 } }, tr('world.dead.ended.text')),
          h(
            'a',
            {
              href: '/auth/login',
              className: 'btn btn-accent',
              style: { textAlign: 'center', textDecoration: 'none' },
            },
            tr('world.session.relogin'),
          ),
        );
      return h(
        'div',
        { style: PANEL },
        h('div', { style: TITLE }, tr('world.stream.lost')),
        h('span', { style: { color: 'var(--muted)' } }, tr('world.stream.askingHub')),
      );
    }
    const close = h(
      'button',
      {
        className: 'btn',
        'aria-label': tr('world.panel.close'),
        onClick: () => {
          if (sel != null) return this.setState({ sel: null });
          if (w.view === 'one') return this.navigate({ view: 'all' });
          w.confirm = null;
          this.setState({ sel: null, selIsland: null });
        },
        style: { width: 28, height: 28, padding: 0, flex: 'none' },
      },
      '×',
    );
    const sc = selIsland && w.scenes.get(selIsland),
      meta = selIsland && w.islands.find(i => i.id === selIsland);
    const a = sc && sel != null && sc.byId(sel);
    if (a) {
      // Hub data has no names, prompts or folders: status, kind of work, room, and tool / model on "Cơ bản".
      const raw = sc.raw.get(a.sid) || {},
        Dp = sc.depts.get(a.dept),
        stx = ST[a.status] || ST.working,
        par = a.parent && sc.byId(a.parent);
      return this.worldSheet(
        {
          label: tr('world.sheet.agentAria', { dept: clip(a.dept, 40) }),
          icon: h(
            'div',
            {
              style: {
                width: 34,
                height: 34,
                background: Dp ? Dp.color : '#8b8fa3',
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
            clip(a.short, 4),
          ),
          title: clip(a.dept, 40),
          sub: (meta ? clip(meta.name, 40) + ' · ' : '') + stx[0],
          extra: close,
        },
        [
          h(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 10,
                background: 'var(--bg)',
                borderLeft: '4px solid ' + stx[1],
              },
            },
            h('span', { style: { fontWeight: 600, color: stx[1] } }, stx[0]),
          ),
          h(
            'div',
            { style: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px 14px' } },
            field(tr('world.agent.field.kind'), KIND_LABEL.get(raw.kind) || '—'),
            field(tr('world.field.dept'), clip(a.dept, 40)),
            raw.tool ? field(tr('world.agent.field.tool'), clip(raw.tool, 32)) : null,
            raw.model ? field(tr('world.agent.field.model'), clip(raw.model, 48)) : null,
            field(
              tr('world.agent.field.role'),
              par ? tr('world.agent.role.sub', { parent: par.short }) : tr('world.agent.role.main'),
            ),
          ),
        ],
      );
    }
    if (w.view === 'one' && sc && meta) {
      const tl = tally(sc),
        bar = {
          label: tr('world.sheet.islandAria', { name: meta.name || '' }),
          icon: swatch(meta.color),
          title: meta.name || tr('world.island.fallbackName'),
          extra: close,
          sub:
            (meta.online === false ? tr('world.island.offline') : tr('world.island.online')) +
            ' · ' +
            (meta.private ? tr('world.label.private') : tr('world.label.busy', { n: tl.busy })),
        };
      // Owners may remove anyone's island but their own (the hub also refuses another owner's).
      const canRemove = w.me.role === 'owner' && meta.id !== this.myIslandId() && meta.id !== w.me.islandId;
      const ask = canRemove && w.confirm && w.confirm.kind === 'remove' && w.confirm.id === meta.id ? w.confirm : null;
      if (ask)
        return this.worldSheet(bar, [
          confirmRow(
            tr('world.island.remove.confirm'),
            tr('world.island.remove.ok'),
            ask,
            () => this.removeIsland(meta.id),
            () => {
              w.confirm = null;
              this.forceUpdate();
            },
          ),
        ]);
      const counts = new Map();
      for (const x of sc.agents) if (!x.leaving) counts.set(x.dept, (counts.get(x.dept) || 0) + 1);
      return this.worldSheet(bar, [
        h(
          'div',
          { style: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px 14px' } },
          field(
            tr('world.field.status'),
            meta.online === false ? tr('world.island.offline') : tr('world.island.online'),
          ),
          field(
            tr('world.field.shareLevel'),
            meta.private ? tr('world.island.private') : SHARE_LABEL.get(meta.share) || '—',
          ),
          field(tr('world.field.sessions'), String(sc.raw.size)),
        ),
        meta.private
          ? h('span', { style: { color: 'var(--muted)' } }, tr('world.island.privateNote'))
          : h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
              h('span', { style: MUTED }, tr('world.field.dept')),
              counts.size
                ? [...counts].map(([dk, n], i) => {
                    const Dp = sc.depts.get(dk);
                    return h(
                      'div',
                      { key: i, style: { display: 'flex', alignItems: 'center', gap: 8 } },
                      h('span', {
                        style: {
                          width: 8,
                          height: 8,
                          background: Dp ? Dp.color : '#8b8fa3',
                          display: 'inline-block',
                          flex: 'none',
                        },
                      }),
                      h(
                        'span',
                        {
                          style: {
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          },
                        },
                        dk,
                      ),
                      h('strong', { style: { color: '#ffffff' } }, n),
                    );
                  })
                : h('span', { style: { color: 'var(--muted)' } }, tr('world.island.noSessions')),
            ),
        canRemove &&
          h(
            'button',
            {
              className: 'btn',
              onClick: () => {
                w.confirm = { kind: 'remove', id: meta.id };
                this.forceUpdate();
              },
              style: { ...SMALL_BTN, alignSelf: 'flex-start', borderColor: '#e5484d', color: '#ff9b9e' },
            },
            tr('world.island.remove.button'),
          ),
      ]);
    }
    if (w.view !== 'mine') return null;
    const fullLink = h(
      'a',
      { href: 'http://localhost:4317', target: '_blank', rel: 'noopener noreferrer', style: LINK },
      tr('world.mine.link.full'),
    );
    const meLink = h('a', { href: '/me', style: LINK }, tr('world.mine.link.manage'));
    const leaveLink = h('a', { href: '/me/leave', style: LINK }, tr('world.mine.link.leave'));
    const isl = w.mine ? w.mine.island : null;
    if (w.mine ? !isl : !w.me.islandId) {
      const origin = location.origin;
      return this.worldSheet({ icon: swatch(GOLD), title: tr('world.join.title'), sub: tr('world.sheet.pairHint') }, [
        h('span', { style: { lineHeight: 1.5 } }, tr('world.join.intro')),
        h(
          'ol',
          { style: { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.5 } },
          h(
            'li',
            null,
            tr('world.join.step1'),
            h(
              'code',
              {
                style: {
                  display: 'block',
                  marginTop: 4,
                  background: 'var(--bg)',
                  padding: '6px 8px',
                  color: '#ffd166',
                  fontSize: 11,
                  wordBreak: 'break-all',
                  userSelect: 'all',
                },
              },
              'node server.js join ' + origin,
            ),
          ),
          h('li', null, tr('world.join.step2')),
          h('li', null, tr('world.join.step3')),
          h('li', null, tr('world.join.step4')),
        ),
        w.meErr && h('span', { role: 'alert', style: ERR }, tr('world.mine.devicesError')),
        meLink,
        leaveLink,
      ]);
    }
    const devs = w.mine ? w.mine.devices : [],
      colors = w.mine ? w.mine.colors : [],
      d = w.draft,
      sending = mine && mine.online !== false;
    const asking = (x, where) => {
      const c = w.confirm;
      return c && c.kind === 'revoke' && c.id === x.id && c.where === where ? c : null;
    };
    const phone = !!(this.phoneMq && this.phoneMq.matches),
      fresh = devs.filter(x => x.isNew && x.send !== 'revoked');
    // On a phone several "Máy mới" notices fold into one "N máy mới" line (open while one of them is being revoked).
    const fold = phone && fresh.length > 1 && !w.newOpen && !fresh.some(x => asking(x, 'new'));
    const askRevoke = (x, where) =>
      h(
        'button',
        {
          className: 'btn',
          style: SMALL_BTN,
          onClick: () => {
            w.confirm = { kind: 'revoke', id: x.id, where };
            this.forceUpdate();
          },
        },
        tr('world.mine.revoke.button'),
      );
    const revokeAsk = (x, c) =>
      confirmRow(
        tr('world.mine.revoke.confirm', { name: clip(x.name, 40) || tr('world.mine.revoke.thisDevice') }),
        tr('world.mine.revoke.button'),
        c,
        () => this.revokeDevice(x.id),
        () => {
          w.confirm = null;
          this.forceUpdate();
        },
      );
    const edit = patch => {
      const dr = w.draft;
      if (!dr) return;
      Object.assign(dr, patch, { dirty: true });
      w.saveMsg = null;
      this.forceUpdate();
    };
    const mt = mine && tally(w.scenes.get(mine.id));
    return this.worldSheet(
      {
        label: tr('world.view.mine'),
        icon: swatch(mine ? mine.color : isl && isl.color),
        title: (mine ? mine.name : isl && isl.name) || tr('world.mine.fallbackName'),
        sub: !mine
          ? tr('world.sheet.noDevice')
          : (sending ? tr('world.mine.sending') : tr('world.mine.disconnected')) +
            ' · ' +
            (mine.private ? tr('world.label.private') : tr('world.label.busy', { n: mt.busy })),
      },
      [
        // A device paired in the last 7 days: say so, in case it was not this person.
        fold
          ? h(
              'div',
              {
                key: 'new-fold',
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 8,
                  background: 'var(--bg)',
                  borderLeft: '4px solid #ffd166',
                },
              },
              h(
                'span',
                { style: { flex: 1, minWidth: 0, lineHeight: 1.4 } },
                tr('world.mine.newDevices', { n: fresh.length }),
              ),
              h(
                'button',
                {
                  className: 'btn',
                  style: SMALL_BTN,
                  'aria-expanded': false,
                  onClick: () => {
                    w.newOpen = true;
                    this.forceUpdate();
                  },
                },
                tr('world.mine.newDevices.show'),
              ),
            )
          : fresh.map(x => {
              const c = asking(x, 'new');
              return h(
                'div',
                {
                  key: 'new-' + x.id,
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: 8,
                    background: 'var(--bg)',
                    borderLeft: '4px solid #ffd166',
                  },
                },
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                  h(
                    'span',
                    { style: { flex: 1, minWidth: 0, lineHeight: 1.4, overflowWrap: 'anywhere' } },
                    tr('world.mine.newDevice', { name: clip(x.name, 40) || '—', time: when(x.createdAt) }),
                  ),
                  !c && askRevoke(x, 'new'),
                ),
                c && revokeAsk(x, c),
              );
            }),
        phone &&
          fresh.length > 1 &&
          !fold &&
          h(
            'button',
            {
              key: 'new-less',
              className: 'btn',
              style: { ...SMALL_BTN, alignSelf: 'flex-start' },
              'aria-expanded': true,
              onClick: () => {
                w.newOpen = false;
                this.forceUpdate();
              },
            },
            tr('world.mine.newDevices.collapse'),
          ),
        d &&
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            h('span', { style: MUTED }, tr('world.mine.edit.heading')),
            h(
              'div',
              { style: { display: 'flex', gap: 6 } },
              h('input', {
                type: 'text',
                'aria-label': tr('world.mine.edit.nameAria'),
                maxLength: 24,
                value: d.name,
                style: phone ? { ...INPUT, fontSize: 16 } : INPUT,
                onChange: e => edit({ name: e.target.value }),
                onKeyDown: e => {
                  if (e.key === 'Enter') this.saveIsland();
                },
              }),
              h(
                'button',
                { className: 'btn', disabled: !!w.saving, style: SMALL_BTN, onClick: () => this.saveIsland() },
                w.saving ? tr('world.mine.edit.saving') : tr('world.mine.edit.save'),
              ),
            ),
            colors.length > 0 &&
              h(
                'div',
                {
                  role: 'group',
                  'aria-label': tr('world.mine.edit.colorsAria'),
                  style: { display: 'flex', flexWrap: 'wrap', gap: 6 },
                },
                colors.map(c =>
                  h('button', {
                    key: c,
                    type: 'button',
                    title: c,
                    'aria-label': tr('world.mine.edit.colorAria', { color: c }),
                    'aria-pressed': d.color === c,
                    onClick: () => edit({ color: c }),
                    style: {
                      width: 24,
                      height: 24,
                      padding: 0,
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      background: c,
                      border: d.color === c ? '3px solid #ffffff' : '2px solid var(--border)',
                    },
                  }),
                ),
              ),
            w.saveMsg &&
              h(
                'span',
                w.saveMsg.ok ? { role: 'status', style: { color: '#46a758' } } : { role: 'alert', style: ERR },
                w.saveMsg.text,
              ),
          ),
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          h('span', { style: MUTED }, tr('world.mine.devices.heading')),
          !w.mine
            ? !w.meErr && h('span', { style: { color: 'var(--muted)' } }, tr('world.mine.devices.loading'))
            : devs.length
              ? devs.map(x => {
                  const [lab, col] = SEND_LABEL.get(x.send) || ['—', '#8b8fa3'],
                    revoked = x.send === 'revoked',
                    c = asking(x, 'list');
                  return h(
                    'div',
                    { key: x.id, style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                    h(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', gap: 8, opacity: revoked ? 0.6 : 1 } },
                      h('span', { style: { width: 8, height: 8, borderRadius: '50%', background: col, flex: 'none' } }),
                      h(
                        'div',
                        { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 } },
                        h(
                          'span',
                          {
                            style: {
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: '#ffffff',
                            },
                          },
                          clip(x.name, 40) || '—',
                        ),
                        h(
                          'span',
                          { style: MUTED },
                          lab +
                            (!revoked && SHARE_LABEL.has(x.share)
                              ? tr('world.mine.devices.shareSuffix', { level: SHARE_LABEL.get(x.share) })
                              : ''),
                        ),
                      ),
                      !revoked && !c && askRevoke(x, 'list'),
                    ),
                    c && revokeAsk(x, c),
                  );
                })
              : h('span', { style: { color: 'var(--muted)' } }, tr('world.mine.devices.empty')),
          w.meErr && h('span', { role: 'alert', style: ERR }, tr('world.mine.devicesError')),
        ),
        !mine && h('span', { style: { color: 'var(--muted)', lineHeight: 1.5 } }, tr('world.mine.notSending')),
        mine &&
          h(
            'div',
            { style: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px 14px' } },
            field(tr('world.field.shareLevel'), SHARE_LABEL.get(mine.share) || '—'),
            field(tr('world.mine.field.private'), mine.private ? tr('world.mine.yes') : tr('world.mine.no')),
            field(
              tr('world.mine.field.sendStatus'),
              sending ? tr('world.mine.sending') : tr('world.mine.disconnected'),
            ),
            field(tr('world.field.sessions'), String((w.scenes.get(mine.id) || { raw: new Map() }).raw.size)),
          ),
        h('span', { style: { color: 'var(--muted)', lineHeight: 1.5 } }, tr('world.mine.filteredNote')),
        fullLink,
        meLink,
        leaveLink,
      ],
    );
  },
});
