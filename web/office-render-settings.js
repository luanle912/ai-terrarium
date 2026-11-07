// The ⚙ settings panel of the local page. Called from ClaudeOffice#render (office-render.js).
import { tr } from './i18n.js';
import { BubbleLogic } from './bubble-logic.js';
import { SeasonLogic } from './season-logic.js';
import { WEATHER_LABEL, WEATHER_PREVIEW, h, languagePicker } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';
mixin(
  ClaudeOffice,
  class {
    // The Season section, under Weather (the local page's panel and the world's): the choice, what shows now and four
    // buttons that show a season for a minute (SeasonLogic.startSeasonPreview).
    seasonSection() {
      const now = this.seasonNow(),
        choice = this.seasonChoice || 'auto',
        name = key => SeasonLogic.seasonLabel(key);
      return h(
        'div',
        { id: 'season-section', style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        h(
          'label',
          null,
          tr('settings.season'),
          h(
            'select',
            {
              'aria-label': tr('settings.season.mode'),
              value: choice,
              onChange: e => this.setSeasonChoice(e.target.value),
            },
            h('option', { value: 'auto' }, SeasonLogic.autoLabel()),
            SeasonLogic.KEYS.map(k => h('option', { key: k, value: k }, name(k))),
          ),
        ),
        h('span', null, tr('settings.season.current', { label: SeasonLogic.seasonLabel(now, this.season) })),
        h(
          'div',
          { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
          SeasonLogic.KEYS.map(k =>
            h(
              'button',
              {
                key: k,
                className: 'btn',
                title: tr('settings.season.previewTitle', { label: name(k) }),
                style: { padding: '3px 7px', fontSize: 11 },
                onClick: () => this.previewSeason(k),
              },
              name(k),
            ),
          ),
        ),
      );
    }
    setSeasonChoice(choice) {
      if (!SeasonLogic.CHOICES.includes(choice)) return;
      this.seasonChoice = choice;
      SeasonLogic.saveSeasonChoice(this.storage, choice);
      this.setState({ seasonChoice: choice });
    }
    // A preview shows the season for SEASON_PREVIEW_MS, then the choice's own returns.
    previewSeason(key) {
      if (!SeasonLogic.KEYS.includes(key)) return;
      this.seasonPreview = SeasonLogic.startSeasonPreview(key, Date.now());
      this.setState({ seasonPreviewAt: Date.now() });
    }
    // The header's season chip: open Settings and scroll the panel (only the panel, never the stage under it) to the
    // Season section.
    openSeasonSettings() {
      this.setState({ showSettings: true }, () => {
        const el = document.getElementById('season-section'),
          panel = el && el.closest('.settings-panel');
        if (panel) panel.scrollTop = Math.max(0, el.offsetTop - 8);
      });
    }
    // The ⚙ settings panel of the local page.
    renderSettingsPanel({
      agentCount,
      autoApprove,
      bubbleMode,
      dataSource,
      endpoint,
      isLive,
      isSim,
      showSettings,
      speed,
    }) {
      return (
        showSettings &&
        h(
          'div',
          { className: 'settings-panel' },
          h(
            'div',
            {
              style: {
                fontFamily: "'Pixelify Sans',monospace",
                fontSize: 14,
                fontWeight: 600,
                color: '#ffffff',
                marginBottom: 4,
              },
            },
            tr('settings.title'),
          ),
          languagePicker(),
          h(
            'label',
            null,
            tr('settings.dataSource'),
            h(
              'select',
              { value: dataSource, onChange: e => this.setState({ dataSource: e.target.value }) },
              h('option', { value: 'sim' }, tr('settings.dataSource.sim')),
              h('option', { value: 'live' }, tr('settings.dataSource.live')),
            ),
          ),
          isLive &&
            h(
              'label',
              null,
              tr('settings.endpoint'),
              h('input', {
                type: 'text',
                value: endpoint,
                onChange: e => this.setState({ endpoint: e.target.value }),
              }),
            ),
          isLive &&
            h(
              'label',
              { title: tr('settings.asOthers.title') },
              tr('settings.asOthers'),
              h('input', {
                type: 'checkbox',
                checked: !!this.state.asOthers,
                onChange: e => this.setState({ asOthers: e.target.checked, sel: null }),
              }),
            ),
          isLive && this.worldJoinSection(),
          isSim &&
            h(
              'label',
              null,
              tr('settings.agentCount', { n: agentCount }),
              h('input', {
                type: 'range',
                min: 1,
                max: 16,
                value: agentCount,
                onChange: e => this.setState({ agentCount: +e.target.value }),
              }),
            ),
          h(
            'label',
            null,
            tr('settings.speed', { speed: speed.toFixed(2) }),
            h('input', {
              type: 'range',
              min: 0.5,
              max: 3,
              step: 0.25,
              value: speed,
              onChange: e => this.setState({ speed: +e.target.value }),
            }),
          ),
          h(
            'label',
            { title: tr('settings.bubbles.title') },
            tr('settings.bubbleText'),
            h(
              'select',
              { value: bubbleMode, onChange: e => this.setBubbleMode(e.target.value) },
              BubbleLogic.MODES.map(m =>
                h(
                  'option',
                  { key: m, value: m },
                  {
                    speech: tr('settings.bubbles.speech'),
                    always: tr('settings.bubbles.always'),
                    off: tr('settings.bubbles.off'),
                  }[m],
                ),
              ),
            ),
          ),
          h('div', { style: { borderTop: '1px solid var(--border)', margin: '2px 0' } }),
          h(
            'label',
            null,
            tr('settings.weather'),
            h(
              'select',
              {
                'aria-label': tr('settings.weather.mode'),
                value: this.state.weatherMode,
                onChange: e => this.setWeather({ weatherMode: e.target.value }),
              },
              h('option', { value: 'random' }, tr('settings.weather.random')),
              h('option', { value: 'real' }, tr('settings.weather.real')),
              h('option', { value: 'off' }, tr('settings.weather.off')),
            ),
          ),
          this.state.weatherMode === 'real' &&
            h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
              h(
                'div',
                { style: { display: 'flex', gap: 6 } },
                h('input', {
                  type: 'text',
                  'aria-label': tr('settings.weather.city'),
                  placeholder: tr('settings.weather.cityPlaceholder'),
                  value: this.state.cityDraft,
                  style: { flex: 1, maxWidth: 'none' },
                  onChange: e => this.setState({ cityDraft: e.target.value }),
                  onKeyDown: e => {
                    if (e.key === 'Enter') this.setWeather({ city: this.state.cityDraft.trim() });
                  },
                }),
                h(
                  'button',
                  {
                    className: 'btn',
                    style: { padding: '4px 8px', fontSize: 11 },
                    onClick: () => this.setWeather({ city: this.state.cityDraft.trim() }),
                  },
                  tr('settings.weather.update'),
                ),
              ),
              this.state.realStatus.text &&
                h(
                  'span',
                  {
                    role: 'status',
                    style: {
                      fontSize: 11,
                      lineHeight: 1.4,
                      color:
                        this.state.realStatus.state === 'error'
                          ? '#ff9b9e'
                          : this.state.realStatus.state === 'ok'
                            ? '#8fd69a'
                            : 'var(--muted)',
                    },
                  },
                  this.state.realStatus.text,
                ),
              h(
                'span',
                { style: { fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 } },
                tr('settings.weather.privacyNote'),
              ),
            ),
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            h('span', null, tr('settings.weather.current', { label: WEATHER_LABEL[this.wx.to] })),
            h(
              'div',
              { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
              WEATHER_PREVIEW.map(([type, label]) =>
                h(
                  'button',
                  {
                    key: type,
                    className: 'btn',
                    title: tr('settings.weather.previewTitle', { label: WEATHER_LABEL[type] }),
                    style: { padding: '3px 7px', fontSize: 11 },
                    onClick: () => this.previewWeather(type),
                  },
                  label,
                ),
              ),
            ),
          ),
          this.seasonSection(),
          isSim &&
            h(
              'label',
              null,
              tr('settings.autoApprove'),
              h('input', {
                type: 'checkbox',
                checked: autoApprove,
                onChange: e => this.setState({ autoApprove: e.target.checked }),
              }),
            ),
        )
      );
    }
  },
);
