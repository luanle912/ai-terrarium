// Animals: the paw chip in the header, its notices (one at a time next to the chip, 4 s each) and the edge arrow
// that points at a wild animal outside the view.
import { tr } from './i18n.js';
import { MAX_NOTICES, NOTICE_MS, SR_ONLY, TIER_COLOR, TIER_NAME, U, nameOf } from './animal-view-util.js';
import { h } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';
mixin(
  ClaudeOffice,
  class {
    noticeText(n) {
      const name = nameOf(n.species);
      switch (n.kind) {
        case 'spawn':
          return tr('animal.notice.spawn', { name });
        case 'legendary':
          return tr('animal.notice.legendary');
        case 'catchStarted':
          return tr('animal.notice.catchStarted', { name, minutes: Math.round((n.needMs || 0) / 60000) });
        case 'expiring':
          return tr('animal.notice.expiring', { name });
        case 'caught':
          return tr('animal.notice.caught', { name });
        case 'newSpecies':
          return tr('animal.notice.newSpecies');
        case 'escaped':
          return tr('animal.notice.escaped', { name });
        case 'left':
          return tr('animal.notice.left', { name });
        case 'ranOff':
          return tr('animal.notice.ranOff', { name });
        case 'freed':
          return tr('animal.notice.freed', { name });
        default:
          return null;
      }
    }
    pushNotice(text) {
      if (!text) return;
      this.noticeQ = [...(this.noticeQ || []), text].slice(-MAX_NOTICES);
      if (!this.noticeTimer) this.nextNotice();
    }
    nextNotice() {
      const [head, ...rest] = this.noticeQ || [];
      this.noticeQ = rest;
      if (head == null) {
        this.noticeTimer = null;
        this.setState({ animalNotice: null });
        return;
      }
      this.setState({ animalNotice: head });
      this.noticeTimer = setTimeout(() => this.nextNotice(), NOTICE_MS);
    }
    animalChip(narrow) {
      if (this.animalsHidden()) return null;
      const v = this.animalLive(),
        n = this.state.animalNotice;
      let text = '🐾',
        border = '#232a39',
        title = tr('animal.chip.title'),
        err = false;
      if (v.disabled) {
        err = true;
        title = tr('animal.chip.offTitle', { error: String(v.error || '') });
      } else {
        const a = v.attempt,
          w = v.wild,
          tier = w ? this.animalTier(w.species) : null;
        if (w) {
          border = TIER_COLOR[tier];
          title = tr('animal.chip.wildTitle', { name: nameOf(w.species), tier: TIER_NAME[tier] });
        }
        // Phones keep the fixed row short: no species name, and the 50/50 mark only while nothing is being caught.
        const who = narrow ? '' : ' ' + nameOf(w && w.species);
        if (a && w && a.phase === 'pending') text += who + ' · ' + tr('animal.chip.pending');
        else if (a && w) text += who + ' ' + U.clock(a.workMs) + (narrow ? '/' : ' / ') + U.clock(a.needMs);
        else text += ' ' + v.out.length + '/' + v.limits.out;
        if (v.full && !(narrow && a)) text += ' · ' + v.count + '/' + v.limits.collection;
        if (U.expiring(v) && !this.animalReduced() && Math.floor(Date.now() / 900) % 2) border = '#232a39';
      }
      // On phones the chip sits mid-header, so an anchored tip would run off the left edge: span the viewport instead.
      const chipBox = narrow && this.animalChipEl ? this.animalChipEl.getBoundingClientRect() : null;
      const place = narrow
        ? {
            position: 'fixed',
            top: (chipBox ? chipBox.bottom : 48) + 4,
            left: 12,
            right: 12,
            width: 'auto',
            maxWidth: 'none',
          }
        : {
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: 'max-content',
            maxWidth: 'min(320px, 80vw)',
          };
      const tip = {
        ...place,
        zIndex: 30,
        padding: '3px 8px',
        background: 'var(--surface)',
        border: '1px solid ' + (border === '#232a39' ? 'var(--border)' : border),
        color: 'var(--fg)',
        fontSize: 11,
        lineHeight: 1.4,
        boxShadow: '2px 2px 0 rgba(0,0,0,0.35)',
        pointerEvents: 'none',
      };
      return h(
        'div',
        {
          key: 'animals',
          style: { position: 'relative', display: 'flex', flex: narrow ? '0 1 auto' : 'none', minWidth: 0 },
        },
        h(
          'button',
          {
            type: 'button',
            className: 'chip',
            ref: this.setAnimalChip,
            title,
            'aria-label': tr('animal.chip.aria') + ': ' + text,
            'aria-expanded': this.animalSlot() === 'collection',
            onClick: () => this.toggleCollection(),
            style: {
              borderColor: border,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: '#c9cfdc',
              minWidth: 0,
              flex: '0 1 auto',
            },
          },
          err &&
            h('span', {
              style: {
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#e5484d',
                display: 'inline-block',
                flex: 'none',
              },
            }),
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, text),
        ),
        h('span', { role: 'status', 'aria-live': 'polite', style: n ? tip : SR_ONLY }, n || ''),
      );
    }
    animalArrow() {
      if (this.animalsHidden()) return null;
      const q = this.wildPoint(),
        b = this.camBox();
      if (!q || !b) return null;
      const x = b.ox + this.cam.tx + this.cam.z * q.lx,
        y = b.oy + (this.wrapTop || 0) + this.cam.ty + this.cam.z * q.ly;
      const ar = U.edgeArrow(x, y, b.stageW, b.stageH, 18);
      if (!ar) return null;
      const col = TIER_COLOR[this.animalTier(q.w.species)],
        label = tr('animal.arrow.aria', { name: nameOf(q.w.species) });
      return h(
        'button',
        {
          type: 'button',
          'aria-label': label,
          title: label,
          onClick: () => this.panToAnimal(),
          style: {
            position: 'absolute',
            zIndex: 6,
            left: ar.x,
            top: ar.y,
            width: 28,
            height: 28,
            margin: '-14px 0 0 -14px',
            padding: 0,
            border: '2px solid ' + col,
            background: 'var(--surface)',
            color: col,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            lineHeight: 1,
          },
        },
        h(
          'span',
          { 'aria-hidden': true, style: { display: 'inline-block', transform: 'rotate(' + ar.angle + 'rad)' } },
          '➤',
        ),
      );
    }
  },
);
