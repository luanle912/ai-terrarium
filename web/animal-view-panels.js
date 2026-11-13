// Animals: the panels that share the agent panel's slot (collection, one released animal, the full-collection
// picker).
import { tr } from './i18n.js';
import {
  COND_HINT,
  DANGER,
  MUTED,
  PANEL,
  SMALL_BTN,
  TIER_COLOR,
  TIER_NAME,
  TITLE,
  U,
  fmtDate,
  nameOf,
  thumb,
} from './animal-view-util.js';
import { h } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';
mixin(
  ClaudeOffice,
  class {
    animalPanelEl(slot) {
      if (slot === 'picker') return this.pickerPanel();
      if (slot === 'animal') return this.smallAnimalPanel();
      if (slot === 'collection') return this.collectionPanel();
      return null;
    }
    // A new key per panel identity remounts it, so the focus ref runs once per opened panel.
    panelProps(key) {
      return { key: 'animal-panel:' + key, ref: this.setAnimalPanel, tabIndex: -1 };
    }
    panelHead(title, onClose) {
      return h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        h('div', { style: { ...TITLE, flex: 1, minWidth: 0 } }, title),
        h(
          'button',
          {
            type: 'button',
            className: 'btn',
            'aria-label': tr('animal.panel.close'),
            onClick: onClose,
            style: { width: 28, height: 28, padding: 0, flex: 'none' },
          },
          '×',
        ),
      );
    }
    thumbImg(species, lit) {
      const t = thumb(species);
      return h(
        'span',
        {
          'aria-hidden': true,
          style: {
            width: 40,
            height: 36,
            flex: 'none',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          },
        },
        t.url &&
          h('img', {
            src: t.url,
            alt: '',
            width: t.w * 2,
            height: t.h * 2,
            style: {
              imageRendering: 'pixelated',
              opacity: lit ? 1 : 0.35,
              filter: lit ? undefined : 'grayscale(1)',
            },
          }),
      );
    }
    tierTag(tier) {
      return h(
        'span',
        {
          style: {
            padding: '0 5px',
            border: '1px solid ' + TIER_COLOR[tier],
            color: TIER_COLOR[tier],
            fontSize: 10,
            flex: 'none',
          },
        },
        TIER_NAME[tier] || tier,
      );
    }
    outTag() {
      return h(
        'span',
        { style: { padding: '0 5px', background: '#46a758', color: '#06140a', fontSize: 10, flex: 'none' } },
        tr('animal.panel.out'),
      );
    }
    collectionPanel() {
      const v = this.animalLive(),
        close = () => this.setState({ animalPanel: null });
      if (!v) return null;
      const head = this.panelHead(h('span', null, '🐾 ' + tr('animal.panel.title')), close);
      const props = {
        ...this.panelProps('collection'),
        style: PANEL,
        role: 'dialog',
        'aria-label': tr('animal.panel.title'),
      };
      if (v.disabled)
        return h(
          'div',
          props,
          head,
          h(
            'div',
            { role: 'alert', style: { color: '#ff9b9e', lineHeight: 1.45 } },
            tr('animal.panel.off', { error: String(v.error || '') }),
          ),
        );
      return h(
        'div',
        props,
        head,
        h(
          'div',
          { style: { color: 'var(--muted)', lineHeight: 1.45 } },
          tr('animal.panel.summary', {
            species: v.speciesCaught.length,
            speciesMax: v.species.length,
            total: v.total,
            count: v.count,
            max: v.limits.collection,
          }),
        ),
        this.wildBlock(v),
        this.speciesList(v),
      );
    }
    wildBlock(v) {
      const box = (col, ...kids) =>
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: 10,
              background: 'var(--bg)',
              borderLeft: '4px solid ' + col,
            },
          },
          ...kids,
        );
      if (!v.wild)
        return box(
          'var(--border)',
          h('span', { style: { color: 'var(--muted)', lineHeight: 1.45 } }, tr('animal.panel.noWild')),
        );
      const tier = this.animalTier(v.wild.species),
        col = TIER_COLOR[tier],
        name = nameOf(v.wild.species),
        busy = !!this.state.animalBusy,
        a = v.attempt;
      const head = h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        this.thumbImg(v.wild.species, true),
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
          h(
            'span',
            { style: { color: '#ffffff', fontWeight: 600 } },
            a ? tr('animal.panel.attempt', { name }) : tr('animal.panel.wild', { name }),
          ),
          this.tierTag(tier),
        ),
      );
      if (!a)
        return box(
          col,
          head,
          h('span', { style: MUTED }, tr('animal.panel.stays', { time: U.clock(v.wild.stayLeftMs) })),
          v.full && h('span', { style: { color: '#ffd166', lineHeight: 1.4 } }, tr('animal.panel.fullHint')),
          h(
            'button',
            {
              type: 'button',
              className: 'btn btn-accent',
              'data-autofocus': true,
              disabled: busy,
              onClick: () => this.animalPost('catch', { wildId: v.wild.id }),
              style: { padding: 8 },
            },
            tr('animal.panel.catch', { name }),
          ),
        );
      const frac = Math.max(0, Math.min(1, a.workMs / Math.max(1, a.needMs))),
        armed = this.state.animalArmed === 'giveup';
      return box(
        col,
        head,
        h(
          'div',
          {
            role: 'progressbar',
            'aria-label': name,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': Math.round(frac * 100),
            style: { height: 8, background: '#232a39' },
          },
          h('div', {
            style: { width: frac * 100 + '%', height: '100%', background: col, opacity: a.counting ? 1 : 0.5 },
          }),
        ),
        h(
          'span',
          { style: { lineHeight: 1.45 } },
          tr('animal.panel.progress', {
            done: U.clock(a.workMs),
            need: U.clock(a.needMs),
            left: Math.max(0, Math.ceil(a.deadlineLeftMs / 60000)),
          }),
        ),
        h(
          'span',
          { style: { color: a.counting ? '#8fd69a' : 'var(--muted)', lineHeight: 1.4 } },
          a.counting ? tr('animal.panel.counting') : tr('animal.panel.notCounting'),
        ),
        a.phase === 'catching' &&
          h(
            'button',
            {
              type: 'button',
              className: 'btn',
              disabled: busy,
              onClick: () => this.armOr('giveup', () => this.animalPost('giveup', { wildId: v.wild.id })),
              style: { padding: 8, ...(armed ? DANGER : {}) },
            },
            armed ? tr('animal.panel.giveUpConfirm') : tr('animal.panel.giveUp'),
          ),
      );
    }
    speciesList(v) {
      const rows = U.speciesRows(v),
        out = new Set(v.out),
        outFull = v.out.length >= v.limits.out,
        open = this.state.animalOpen || {};
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
        outFull && h('span', { style: MUTED }, tr('animal.panel.outFull', { max: v.limits.out })),
        rows.map(r =>
          h(
            'div',
            { key: r.id, style: { display: 'flex', flexDirection: 'column', gap: 2 } },
            this.speciesRow(r, !!open[r.id]),
            open[r.id] && r.animals.map(c => this.animalRow(c, out.has(c.id), outFull, v.limits.out)),
          ),
        ),
      );
    }
    speciesRow(r, isOpen) {
      const kids = [
        this.thumbImg(r.id, r.seen),
        h(
          'span',
          { key: 'n', style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 } },
          h('span', { style: { color: r.seen ? '#ffffff' : 'var(--muted)' } }, nameOf(r.id)),
          !r.seen && h('span', { style: MUTED }, COND_HINT[r.cond] || tr('animal.hint.any')),
        ),
        this.tierTag(r.tier),
        h('span', { key: 'c', style: { minWidth: 26, textAlign: 'right', color: '#ffffff' } }, '×' + r.animals.length),
      ];
      const style = {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '2px 6px',
        background: 'var(--bg)',
        border: '1px solid #232a39',
        color: 'inherit',
        font: 'inherit',
        fontSize: 12,
        textAlign: 'left',
        width: '100%',
      };
      if (!r.animals.length) return h('div', { style }, ...kids);
      return h(
        'button',
        {
          type: 'button',
          'aria-expanded': isOpen,
          onClick: () => this.setState(s => ({ animalOpen: { ...(s.animalOpen || {}), [r.id]: !isOpen } })),
          style: { ...style, cursor: 'pointer' },
        },
        ...kids,
      );
    }
    freeButton(id) {
      const key = 'free:' + id,
        armed = this.state.animalArmed === key;
      return h(
        'button',
        {
          type: 'button',
          className: 'btn',
          disabled: !!this.state.animalBusy,
          style: { ...SMALL_BTN, ...(armed ? DANGER : {}) },
          onClick: () => this.armOr(key, () => this.animalPost('free', { id })),
        },
        armed ? tr('animal.panel.freeConfirm') : tr('animal.panel.free'),
      );
    }
    animalRow(c, isOut, outFull, max) {
      const busy = !!this.state.animalBusy;
      return h(
        'div',
        {
          key: c.id,
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 6,
            padding: '2px 0 4px 22px',
            fontSize: 11,
          },
        },
        h(
          'span',
          { style: { flex: '1 1 auto', color: 'var(--muted)' } },
          tr('animal.panel.caughtOn', { date: fmtDate(c.at) }),
        ),
        isOut && this.outTag(),
        isOut
          ? h(
              'button',
              {
                type: 'button',
                className: 'btn',
                disabled: busy,
                style: SMALL_BTN,
                onClick: () => this.animalPost('recall', { id: c.id }),
              },
              tr('animal.panel.recall'),
            )
          : h(
              'button',
              {
                type: 'button',
                className: 'btn',
                disabled: busy || outFull,
                title: outFull ? tr('animal.panel.outFull', { max }) : undefined,
                style: SMALL_BTN,
                onClick: () => this.animalPost('release', { id: c.id }),
              },
              tr('animal.panel.release'),
            ),
        this.freeButton(c.id),
      );
    }
    smallAnimalPanel() {
      const v = this.animalLive(),
        id = this.state.selAnimal,
        c = v && !v.disabled && v.caught.find(x => x.id === id);
      if (!c) return null;
      const tier = this.animalTier(c.species),
        close = () => this.setState({ animalPanel: null, selAnimal: null });
      return h(
        'div',
        {
          ...this.panelProps('animal:' + c.id),
          style: { ...PANEL, borderColor: TIER_COLOR[tier] },
          role: 'dialog',
          'aria-label': nameOf(c.species),
        },
        this.panelHead(
          h(
            'span',
            { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            this.thumbImg(c.species, true),
            nameOf(c.species),
          ),
          close,
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          this.tierTag(tier),
          h('span', { style: { color: 'var(--muted)' } }, tr('animal.panel.caughtOn', { date: fmtDate(c.at) })),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 8 } },
          h(
            'button',
            {
              type: 'button',
              className: 'btn',
              disabled: !!this.state.animalBusy,
              style: { padding: 8, flex: 1 },
              onClick: () => this.animalPost('recall', { id: c.id }),
            },
            tr('animal.panel.recall'),
          ),
          this.freeButton(c.id),
        ),
      );
    }
    // Full collection: one click frees an animal to make room; Cancel or Esc lets the new one run off.
    pickerPanel() {
      const v = this.animalLive(),
        name = nameOf(v.wild.species),
        busy = !!this.state.animalBusy;
      const item = c =>
        h(
          'button',
          {
            key: c.id,
            type: 'button',
            className: 'btn',
            disabled: busy,
            onClick: () => this.animalPost('resolve', { freeId: c.id }),
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '2px 6px',
              textAlign: 'left',
              width: '100%',
            },
          },
          this.thumbImg(c.species, true),
          h(
            'span',
            { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 } },
            h('span', { style: { color: '#ffffff' } }, nameOf(c.species)),
            h('span', { style: MUTED }, fmtDate(c.at)),
          ),
          c.out && this.outTag(),
          this.tierTag(c.tier || 'common'),
        );
      return h(
        'div',
        {
          ...this.panelProps('picker:' + v.attempt.wildId),
          style: { ...PANEL, borderColor: '#ffd166' },
          role: 'dialog',
          'aria-labelledby': 'animal-picker-title',
        },
        h(
          'div',
          { id: 'animal-picker-title', style: { color: '#ffffff', fontWeight: 600, lineHeight: 1.45 } },
          tr('animal.picker.title', { count: v.count, max: v.limits.collection, name }),
        ),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } }, U.pickerList(v).map(item)),
        h('span', { style: MUTED }, tr('animal.picker.cancelHint', { name })),
        h(
          'button',
          {
            type: 'button',
            className: 'btn',
            disabled: busy,
            onClick: () => this.animalPost('resolve', { cancel: true }),
            style: { padding: 8 },
          },
          tr('animal.picker.cancel'),
        ),
      );
    }
  },
);
