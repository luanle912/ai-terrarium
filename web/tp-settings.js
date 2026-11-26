// The Teleport section of Settings (under Event): Random (one style per person, the holiday's own on a holiday),
// Off (everyone walks) or one style for everyone. The choice lives in web/tp-styles.js; office.js loads it and
// web/settings-sync.js shares it.
import { tr } from './i18n.js';
import { TpStyles } from './tp-styles.js';
import { h } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';

// Literal keys, so tests/i18n.test.mjs sees every name used.
const NAME = {
  caped: () => tr('tp.style.caped'),
  goldaura: () => tr('tp.style.goldaura'),
  cloudride: () => tr('tp.style.cloudride'),
  bolt: () => tr('tp.style.bolt'),
  hammer: () => tr('tp.style.hammer'),
  webswing: () => tr('tp.style.webswing'),
  dashrun: () => tr('tp.style.dashrun'),
  packet: () => tr('tp.style.packet'),
  cutpaste: () => tr('tp.style.cutpaste'),
  upload: () => tr('tp.style.upload'),
  gitbranch: () => tr('tp.style.gitbranch'),
  printer3d: () => tr('tp.style.printer3d'),
  respawn: () => tr('tp.style.respawn'),
  blocks: () => tr('tp.style.blocks'),
  circle: () => tr('tp.style.circle'),
  broom: () => tr('tp.style.broom'),
  carpet: () => tr('tp.style.carpet'),
  butterflies: () => tr('tp.style.butterflies'),
  frog: () => tr('tp.style.frog'),
  lamp: () => tr('tp.style.lamp'),
  mirror: () => tr('tp.style.mirror'),
  cannon: () => tr('tp.style.cannon'),
  jetpack: () => tr('tp.style.jetpack'),
  smoke: () => tr('tp.style.smoke'),
  ufo: () => tr('tp.style.ufo'),
  crane: () => tr('tp.style.crane'),
  balloons: () => tr('tp.style.balloons'),
  trampoline: () => tr('tp.style.trampoline'),
  twister: () => tr('tp.style.twister'),
  mole: () => tr('tp.style.mole'),
  pipe: () => tr('tp.style.pipe'),
  portal: () => tr('tp.style.portal'),
  sleigh: () => tr('tp.style.sleigh'),
  liondance: () => tr('tp.style.liondance'),
  starlantern: () => tr('tp.style.starlantern'),
  bats: () => tr('tp.style.bats'),
};
const option = id => h('option', { value: id }, NAME[id]());

mixin(
  ClaudeOffice,
  class {
    teleportSection() {
      return h(
        'div',
        { id: 'teleport-section', style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        // the select under its label, full width: long style names (es, vi) would not fit beside it
        h(
          'label',
          { style: { flexDirection: 'column', alignItems: 'stretch', gap: 4 } },
          tr('settings.teleport'),
          h(
            'select',
            {
              'aria-label': tr('settings.teleport.mode'),
              style: { width: '100%', maxWidth: '100%' },
              value: TpStyles.choice(),
              onChange: e => this.setTpChoice(e.target.value),
            },
            h('option', { value: 'random' }, tr('settings.teleport.random')),
            h('option', { value: 'off' }, tr('settings.teleport.off')),
            h('optgroup', { label: tr('settings.teleport.styles') }, ...TpStyles.RANDOM.map(option)),
            h('optgroup', { label: tr('settings.teleport.holidays') }, ...Object.values(TpStyles.HOLIDAY).map(option)),
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
      if (!fromServer) this.pushSettings(true);
    }
  },
);
