// The connection chip in the world header, with a "?" that opens a small legend: grey "Đảo offline" (one island's
// machine stopped sending), yellow "Đang kết nối lại" (this page lost the hub's stream) and red "Hub không phản hồi"
// (the hub does not answer, refuses or is busy). The row the link is in now (WorldLogic.legendRow) is lit.
// Closed by the "?" again, a click elsewhere, or Esc (WorldLogic.escAction, before anything else Esc does).
import { tr } from './i18n.js';
import { h } from './office-scene.js';
import { ClaudeOffice } from './office.js';
import { WorldLogic } from './world-logic.js';

const LEGEND_W = 288;
// Each row: its key (WorldLogic.legendRow), colour, title and one line saying what it means (read when drawn, so a
// language change applies).
const ROWS = [
  ['offline', '#5d6478', () => tr('world.legend.offline.title'), () => tr('world.legend.offline.text')],
  ['reconnecting', '#f5a524', () => tr('world.legend.reconnecting.title'), () => tr('world.legend.reconnecting.text')],
  ['down', '#e5484d', () => tr('world.legend.down.title'), () => tr('world.legend.down.text')],
];

Object.assign(ClaudeOffice.prototype, {
  setLegend(open) {
    const w = this.world;
    if (!w || !!w.legend === open) return;
    w.legend = open;
    this.legendListen(open);
    this.forceUpdate();
  },
  // While the legend is open, a press outside it and its "?" (which toggles it itself) closes it, and so does a resize
  // (it is placed under the "?" when drawn).
  legendListen(on) {
    if (on && !this.onLegendOutside) {
      this.onLegendOutside = e => {
        const t = e.target;
        if (this.legendEl && this.legendEl.contains(t)) return;
        if (this.legendBtn && this.legendBtn.contains(t)) return;
        this.setLegend(false);
      };
      this.onLegendResize = () => this.setLegend(false);
      document.addEventListener('pointerdown', this.onLegendOutside, true);
      window.addEventListener('resize', this.onLegendResize);
    } else if (!on && this.onLegendOutside) {
      document.removeEventListener('pointerdown', this.onLegendOutside, true);
      window.removeEventListener('resize', this.onLegendResize);
      this.onLegendOutside = this.onLegendResize = null;
    }
  },
  // The chip: a coloured square, the connection text and the "?" button; the legend hangs under the "?", kept inside
  // the window (fixed, so the header's wrapping never clips it).
  worldConnChip(connCol, connText) {
    const w = this.world,
      open = !!w.legend,
      id = 'sky-legend';
    if (!this.setLegendBtn) {
      this.setLegendBtn = el => {
        this.legendBtn = el;
      };
      this.setLegendEl = el => {
        this.legendEl = el;
      };
    }
    let pos = null;
    if (open) {
      const r = this.legendBtn ? this.legendBtn.getBoundingClientRect() : { left: 16, right: 16, bottom: 48 },
        vw = window.innerWidth || 1280,
        width = Math.min(LEGEND_W, vw - 24);
      pos = {
        top: Math.round(r.bottom + 6),
        left: Math.round(Math.max(12, Math.min(r.left - 8, vw - 12 - width))),
        width,
      };
    }
    const lit = WorldLogic.legendRow(w.link.phase);
    return h(
      'div',
      { className: 'chip', title: connText, style: { paddingRight: 3 } },
      h('span', { style: { width: 8, height: 8, background: connCol, display: 'inline-block' } }),
      h('span', null, connText),
      h(
        'button',
        {
          ref: this.setLegendBtn,
          type: 'button',
          className: 'sky-legend-btn' + (open ? ' is-open' : ''),
          'aria-label': tr('world.legend.button'),
          title: tr('world.legend.button'),
          'aria-expanded': open,
          'aria-controls': open ? id : undefined,
          onClick: () => this.setLegend(!open),
        },
        '?',
      ),
      open &&
        h(
          'div',
          {
            id,
            ref: this.setLegendEl,
            role: 'dialog',
            'aria-label': tr('world.legend.button'),
            className: 'sky-legend',
            style: { top: pos.top, left: pos.left, width: pos.width },
          },
          ROWS.map(([key, col, title, body]) =>
            h(
              'div',
              {
                key,
                className: 'sky-legend-row' + (lit === key ? ' is-lit' : ''),
                style: { '--row': col },
                'aria-current': lit === key ? 'true' : undefined,
              },
              h('span', { className: 'sky-legend-dot', 'aria-hidden': true }),
              h(
                'span',
                { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
                h('strong', null, title()),
                h('span', null, body()),
              ),
            ),
          ),
        ),
    );
  },
});
