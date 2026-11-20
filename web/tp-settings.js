// The Teleport section of Settings (under Event): Random (one style per person),
// Off (everyone walks) or one style for everyone. The choice lives in web/tp-styles.js; office.js loads, posts and
// adopts it.
import { tr } from './i18n.js';
import { TpStyles } from './tp-styles.js';
import { h } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';

// Literal keys, so tests/i18n.test.mjs sees every name used.
const NAME = {
  goldaura: () => tr('tp.style.goldaura'),
  bolt: () => tr('tp.style.bolt'),
  dashrun: () => tr('tp.style.dashrun'),
  packet: () => tr('tp.style.packet'),
  cutpaste: () => tr('tp.style.cutpaste'),
  upload: () => tr('tp.style.upload'),
  gitbranch: () => tr('tp.style.gitbranch'),
  printer3d: () => tr('tp.style.printer3d'),
  respawn: () => tr('tp.style.respawn'),
  circle: () => tr('tp.style.circle'),
  mirror: () => tr('tp.style.mirror'),
  smoke: () => tr('tp.style.smoke'),
  pipe: () => tr('tp.style.pipe'),
  portal: () => tr('tp.style.portal'),
};
const option = id => h('option', { value: id }, NAME[id]());

mixin(
  ClaudeOffice,
  class {
    teleportSection() {
      return h(
        'div',
        { id: 'teleport-section', style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        h(
          'label',
          null,
          tr('settings.teleport'),
          h(
            'select',
            {
              'aria-label': tr('settings.teleport.mode'),
              value: TpStyles.choice(),
              onChange: e => this.setTpChoice(e.target.value),
            },
            h('option', { value: 'random' }, tr('settings.teleport.random')),
            h('option', { value: 'off' }, tr('settings.teleport.off')),
            h('optgroup', { label: tr('settings.teleport.styles') }, ...TpStyles.RANDOM.map(option)),
          ),
        ),
      );
    }
    // fromServer: adopted from another page (adoptSettings), so it is not posted back.
    setTpChoice(choice, fromServer) {
      if (!TpStyles.CHOICES.includes(choice)) return;
      TpStyles.setChoice(choice);
      TpStyles.saveChoice(this.storage, choice);
      this.setState({ tpChoice: choice });
      if (!fromServer) this.pushSettings();
    }
  },
);
