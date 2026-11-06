// The local page and the hub: choosing local or world mode at start, and the World section of ⚙ Settings
// (join, leave, status chip).
import { tr } from './i18n.js';
import { h } from './office-scene.js';
import { ClaudeOffice } from './office.js';
import { SHARE_LABEL } from './world-ui.js';
Object.assign(ClaudeOffice.prototype, {
  // Decide the mode once, before any data source opens: world only on a 200 JSON answer saying so (the local
  // server answers 404, a file:// page cannot fetch). ?server= is never read in world mode (B9).
  boot() {
    let done = false;
    const local = () => {
      if (done) return;
      done = true;
      this.startSource();
      this.pollPreview();
    };
    const timer = setTimeout(local, 3000);
    fetch('/api/config', { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
      .then(r =>
        r.status === 200 && /^application\/json\b/i.test(r.headers.get('content-type') || '') ? r.json() : null,
      )
      .then(cfg => {
        if (done) return;
        clearTimeout(timer);
        if (cfg && cfg.mode === 'world' && cfg.me && typeof cfg.me === 'object') {
          done = true;
          this.startWorld(cfg);
        } else local();
      })
      .catch(() => {
        clearTimeout(timer);
        local();
      });
  },
  // Local page: the "Thế giới" chip follows the publisher every 5 s; hidden while it is off.
  pollPreview() {
    const tick = () =>
      fetch('/api/public-preview', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null)
        .then(d => {
          const hub = d && typeof d.hub === 'string' && /^https?:\/\//.test(d.hub) ? d.hub : '';
          const v =
              d && typeof d.state === 'string' && d.state !== 'off'
                ? { state: d.state, share: d.share === 'co-ban' ? 'co-ban' : 'kin', hub }
                : null,
            c = this.state.worldChip || null;
          const joinable = !!d && d.state === 'off';
          if (joinable !== !!this.state.joinable) this.setState({ joinable });
          if (!v !== !c || (v && (v.state !== c.state || v.share !== c.share || v.hub !== c.hub)))
            this.setState({ worldChip: v });
          const jp = this.state.join && this.state.join.phase;
          if (v && v.state !== 'revoked' && jp && jp !== 'leaving') this.setState({ join: null });
        });
    this.previewTick = tick;
    tick();
    this.previewTimer = setInterval(tick, 5000);
  },
  // "Tham gia thế giới": the local server pairs with the hub and opens its approval page in the browser.
  joinWorld() {
    const j = this.state.join;
    if (j && j.phase === 'starting') return;
    this.setState({ join: { phase: 'starting' } });
    fetch('/api/join', { method: 'POST', headers: { 'X-Terrarium': 'join' }, cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(res => {
        if (!res || typeof res.phase !== 'string') {
          this.setState({ join: { phase: 'error', error: 'local' } });
          return;
        }
        this.setState({ join: res.phase === 'joined' ? null : res });
        if (res.phase === 'pending') this.watchJoin();
        else if (this.previewTick) this.previewTick();
      });
  },
  watchJoin() {
    clearTimeout(this.joinTimer);
    this.joinTimer = setTimeout(
      () =>
        fetch('/api/join', { cache: 'no-store' })
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null)
          .then(res => {
            if (!res || res.phase === 'pending' || res.phase === 'starting') {
              this.watchJoin();
              return;
            }
            this.setState({ join: res.phase === 'error' ? res : null });
            if (this.previewTick) this.previewTick();
          }),
      3000,
    );
  },
  leaveWorld() {
    if (!this.state.leaveArmed) {
      this.setState({ leaveArmed: true });
      clearTimeout(this.armTimer);
      this.armTimer = setTimeout(() => this.setState({ leaveArmed: false }), 4000);
      return;
    }
    clearTimeout(this.armTimer);
    clearTimeout(this.joinTimer);
    this.setState({ leaveArmed: false, join: { phase: 'leaving' } });
    fetch('/api/leave', { method: 'POST', headers: { 'X-Terrarium': 'leave' }, cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(res => {
        if (!res) {
          this.setState({ join: { phase: 'error', error: 'local' } });
          return;
        }
        this.setState({
          join: res.phase === 'error' || res.warn ? { phase: 'error', error: res.warn || res.error } : null,
          worldChip: null,
        });
        if (this.previewTick) this.previewTick();
      });
  },
  // Header: status only. The actions live in the settings panel (worldJoinSection).
  worldChip() {
    const c = this.state.worldChip,
      j = this.state.join;
    const dot = col =>
      h('span', { style: { width: 8, height: 8, borderRadius: '50%', background: col, display: 'inline-block' } });
    if (!c && j && j.phase === 'pending')
      return h(
        'div',
        { className: 'chip', title: tr('world.chip.pendingTitle'), style: { borderColor: '#f5a524' } },
        dot('#f5a524'),
        h('span', null, tr('world.chip.pending', { code: String(j.code || '') })),
      );
    if (!c) return null;
    const [text, col] = {
      sending: [tr('world.chip.sending', { share: SHARE_LABEL.get(c.share) }), '#46a758'],
      private: [tr('world.chip.private'), '#8b8fa3'],
      offline: [tr('world.chip.offline'), '#e5484d'],
      revoked: [tr('world.chip.revoked'), '#e5484d'],
      paused: [tr('world.chip.paused'), '#f5a524'],
    }[c.state] || ['…', '#8b8fa3'];
    const kids = [dot(col), h('span', null, tr('world.chip.label', { status: text }))];
    if (!c.hub)
      return h('div', { className: 'chip', title: tr('world.chip.title'), style: { borderColor: col } }, ...kids);
    return h(
      'a',
      {
        className: 'chip',
        href: c.hub,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: tr('world.chip.openTitle'),
        style: { borderColor: col, textDecoration: 'none' },
      },
      ...kids,
    );
  },
  worldJoinError(e) {
    if (e === 'local') return tr('world.join.errLocal');
    if (e === 'hub_unreachable') return tr('world.join.warnUnreachable');
    if (e === 'local_config') return tr('world.join.errConfig');
    if (/hub_full|hub is full/.test(e)) return tr('world.join.errFull');
    if (/denied/.test(e)) return tr('world.join.errDenied');
    if (/expired/.test(e)) return tr('world.join.errExpired');
    return tr('world.join.errFailed', { msg: String(e || '') });
  },
  worldJoinSection() {
    const c = this.state.worldChip,
      j = this.state.join || {};
    if (!c && !this.state.joinable && !this.state.join) return null;
    const joined = !!c && c.state !== 'revoked';
    const busy = j.phase === 'starting' || j.phase === 'leaving';
    const url = typeof j.url === 'string' && /^https?:\/\//.test(j.url) ? j.url : '';
    const sm = { padding: '5px 10px', fontSize: 11 };
    let line = tr('world.join.idle');
    if (j.phase === 'starting') line = tr('world.join.starting');
    else if (j.phase === 'leaving') line = tr('world.join.leaving');
    else if (j.phase === 'pending') line = tr('world.join.pending', { code: String(j.code || '') });
    else if (c && c.state === 'revoked') line = tr('world.join.revoked');
    else if (joined) line = tr('world.join.joined', { share: SHARE_LABEL.get(c.share) });
    const btns = [];
    if (joined) {
      if (c.hub)
        btns.push(
          h(
            'a',
            {
              key: 'open',
              className: 'btn',
              href: c.hub,
              target: '_blank',
              rel: 'noopener noreferrer',
              style: { ...sm, textDecoration: 'none' },
            },
            tr('world.join.open'),
          ),
        );
      btns.push(
        h(
          'button',
          {
            key: 'leave',
            type: 'button',
            className: 'btn',
            disabled: busy,
            onClick: () => this.leaveWorld(),
            style: {
              ...sm,
              borderColor: '#e5484d',
              color: this.state.leaveArmed ? '#ffffff' : '#ff8a8d',
              background: this.state.leaveArmed ? '#e5484d' : undefined,
            },
          },
          this.state.leaveArmed ? tr('world.join.leaveConfirm') : tr('world.join.leave'),
        ),
      );
    } else if (j.phase === 'pending') {
      if (url)
        btns.push(
          h(
            'a',
            {
              key: 'open',
              className: 'btn',
              href: url,
              target: '_blank',
              rel: 'noopener noreferrer',
              style: { ...sm, textDecoration: 'none' },
            },
            tr('world.join.openApproval'),
          ),
        );
      btns.push(
        h(
          'button',
          {
            key: 'cancel',
            type: 'button',
            className: 'btn',
            onClick: () => this.setState({ leaveArmed: true }, () => this.leaveWorld()),
            style: sm,
          },
          tr('world.join.cancel'),
        ),
      );
    } else {
      btns.push(
        h(
          'button',
          {
            key: 'join',
            type: 'button',
            className: 'btn btn-accent',
            disabled: busy,
            onClick: () => this.joinWorld(),
            style: sm,
          },
          busy ? tr('world.join.busy') : c ? tr('world.join.rejoin') : tr('world.join.join'),
        ),
      );
    }
    return h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
      h('div', { style: { borderTop: '1px solid var(--border)', margin: '2px 0' } }),
      h('div', { style: { color: '#ffffff', fontWeight: 600 } }, tr('world.join.heading')),
      h('div', { style: { color: 'var(--muted)', lineHeight: 1.45 } }, line),
      j.phase === 'error' &&
        j.error &&
        h('div', { role: 'alert', style: { color: '#ff8a8d' } }, this.worldJoinError(j.error)),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } }, ...btns),
      h('div', { style: { borderTop: '1px solid var(--border)', margin: '4px 0 0' } }),
    );
  },
});
