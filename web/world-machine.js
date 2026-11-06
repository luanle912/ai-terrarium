// "Máy này" in the World section of ⚙ Settings (local page, once joined): what this machine's publisher is doing,
// when it last sent, its last error and, on a server that has /api/log, the last 50 lines of its log.
// The facts come from state.preview (pollPreview in world-local.js); WorldLogic.pillView reads them.
import { tr } from './i18n.js';
import { h } from './office-scene.js';
import { ClaudeOffice } from './office.js';
import { WorldLogic } from './world-logic.js';
// The parts of the error line (WorldLogic.failParts), each its own key so a missing wait is never shown as "0 s".
const PILL_PART = {
  error: p => tr('world.pill.error', p),
  retryIn: p => tr('world.pill.retryIn', p),
  retrying: () => tr('world.pill.retrying'),
  times: p => tr('world.pill.times', p),
};

const TONE_COL = { ok: '#46a758', warn: '#f5a524', bad: '#e5484d', muted: '#8b8fa3' };
const LOG_LINES = 50;
const stateLabel = s =>
  ({
    off: tr('world.state.off'),
    connecting: tr('world.state.connecting'),
    sending: tr('world.state.sending'),
    private: tr('world.state.private'),
    offline: tr('world.state.offline'),
    rejected: tr('world.state.rejected'),
    standby: tr('world.state.standby'),
    paused: tr('world.state.paused'),
    revoked: tr('world.state.revoked'),
  })[s] || s;
const agoText = ms => {
  const { unit, n } = WorldLogic.agoParts(ms);
  if (unit === 'h') return tr('world.ago.h', { n: String(n) });
  if (unit === 'm') return tr('world.ago.m', { n: String(n) });
  return tr('world.ago.s', { n: String(n) });
};
const hhmmss = ms => new Date(ms).toTimeString().slice(0, 8);
// Only {at, line} pairs survive; the line is always a string, shown as React text (never parsed as HTML).
const logLines = d =>
  d && Array.isArray(d.lines)
    ? d.lines
        .filter(x => x && typeof x === 'object')
        .slice(-LOG_LINES)
        .map(x => ({ at: typeof x.at === 'number' && Number.isFinite(x.at) ? x.at : null, line: String(x.line ?? '') }))
    : null;

Object.assign(ClaudeOffice.prototype, {
  // Called after each good poll while joined: asks once whether the server has /api/log (an older one answers 404,
  // and the "Nhật ký" button stays hidden), and refreshes the open log.
  machineTick() {
    if (this.state.hasLog === undefined || this.state.logOpen) this.fetchLog();
  },
  fetchLog() {
    if (this.logBusy) return;
    this.logBusy = true;
    fetch('/api/log', { cache: 'no-store' })
      .then(r => (r.ok ? r.json().then(logLines) : r.status === 404 ? false : null))
      .catch(() => null)
      .then(lines => {
        this.logBusy = false;
        if (lines === false) this.setState({ hasLog: false, logOpen: false, logLines: null });
        else if (lines) this.setState({ hasLog: true, logLines: lines });
      });
  },
  toggleLog() {
    const open = !this.state.logOpen;
    this.setState({ logOpen: open });
    if (open) this.fetchLog();
  },
  machineRow() {
    const c = this.state.worldChip;
    const down = !!c && c.state === 'localDown';
    const v = down ? null : WorldLogic.pillView(this.state.preview, Date.now());
    if (!v && !down) return null;
    const col = TONE_COL[down ? 'muted' : v.tone];
    const sub = { fontSize: 10, lineHeight: 1.45 };
    const lines = [];
    // An older server sends no lastOkAt at all: the row then shows the state only, not "nothing sent yet".
    if (v && 'lastOkAt' in this.state.preview)
      lines.push(
        h(
          'div',
          { key: 'sent', style: { ...sub, color: 'var(--muted)' } },
          v.ageMs == null
            ? tr('world.pill.never')
            : tr('world.pill.sentAt', { time: hhmmss(Date.now() - v.ageMs), ago: agoText(v.ageMs) }),
        ),
      );
    if (v) {
      if (v.err && (v.tone === 'bad' || v.tone === 'warn'))
        lines.push(
          h(
            'div',
            {
              key: 'err',
              style: { ...sub, color: v.tone === 'bad' ? '#ff8a8d' : 'var(--warn)', wordBreak: 'break-word' },
            },
            WorldLogic.failParts(v)
              .map(([k, p]) => PILL_PART[k](p))
              .join(' · '),
          ),
        );
      if (v.err && v.err.reason && v.tone !== 'ok')
        lines.push(
          h(
            'div',
            { key: 'why', style: { ...sub, color: '#aab2c5', wordBreak: 'break-word' } },
            '“' + v.err.reason + '”',
          ),
        );
    }
    const open = this.state.logOpen && this.state.hasLog === true;
    const logs = this.state.logLines || [];
    return h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          padding: '6px 8px',
          background: 'var(--bg)',
          border: '1px solid #232a39',
          borderLeft: '3px solid ' + col,
        },
      },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 6, minHeight: 20 } },
        h('span', {
          style: { width: 8, height: 8, borderRadius: '50%', background: col, display: 'inline-block', flex: 'none' },
        }),
        h('span', { style: { color: '#ffffff', fontWeight: 600, flex: 'none' } }, tr('world.pill.title')),
        h(
          'span',
          { style: { color: col, flex: 1, minWidth: 0 } },
          down ? tr('world.chip.localDown') : stateLabel(v.state),
        ),
        this.state.hasLog === true &&
          !down &&
          h(
            'button',
            {
              type: 'button',
              className: 'btn' + (open ? ' btn-active' : ''),
              'aria-expanded': open,
              onClick: () => this.toggleLog(),
              style: { padding: '2px 7px', fontSize: 10, flex: 'none' },
            },
            tr('world.pill.log'),
          ),
      ),
      ...lines,
      open &&
        h(
          'div',
          {
            role: 'log',
            ref: el => {
              const last = logs.length ? logs[logs.length - 1] : null;
              const key = logs.length + ':' + (last ? last.at + last.line : '');
              if (el && el.dataset.k !== key) {
                el.dataset.k = key;
                el.scrollTop = el.scrollHeight;
              }
            },
            style: {
              marginTop: 3,
              maxHeight: 180,
              overflowY: 'auto',
              padding: '4px 6px',
              background: '#0a0d13',
              border: '1px solid var(--border)',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10,
              lineHeight: 1.45,
              color: '#c3cad9',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            },
          },
          logs.length
            ? logs.map((x, i) =>
                h(
                  'div',
                  { key: i },
                  x.at != null && h('span', { style: { color: 'var(--muted)' } }, hhmmss(x.at) + ' '),
                  x.line,
                ),
              )
            : h('div', { style: { color: 'var(--muted)' } }, tr('world.pill.logEmpty')),
        ),
    );
  },
});
