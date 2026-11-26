// The ⚙ settings panel of the local page. Called from ClaudeOffice#render (office-render.js).
import { tr } from './i18n.js';
import { BubbleLogic } from './bubble-logic.js';
import { SeasonLogic } from './season-logic.js';
import { EventLogic } from './event-logic.js';
import './tp-settings.js';
import { WEATHER_LABEL, WEATHER_PREVIEW, h, languagePicker, assetsLink } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';
// The select values that are not choices: the event decides the season, the event preview is running.
const FORCED = 'forced',
  PREVIEWING = 'preview';
mixin(
  ClaudeOffice,
  class {
    // The Season section, under Weather (the local page's panel and the world's): the choice, what shows now and four
    // buttons that show a season for a minute (SeasonLogic.startSeasonPreview).
    // While the event decides the season (moment.forced) the select says so and nothing in the section can be used.
    seasonSection() {
      const forced = this.moment.forced.season,
        choice = forced ? FORCED : this.seasonChoice || 'auto',
        name = key => SeasonLogic.seasonLabel({ season: key });
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
              disabled: forced,
              onChange: e => this.setSeasonChoice(e.target.value),
            },
            forced && h('option', { value: FORCED, disabled: true }, tr('settings.forcedByEvent')),
            h('option', { value: 'auto' }, SeasonLogic.autoLabel()),
            SeasonLogic.KEYS.map(k => h('option', { key: k, value: k }, name(k))),
          ),
        ),
        h(
          'span',
          null,
          tr('settings.season.current', {
            label: SeasonLogic.seasonLabel(this.moment),
          }),
        ),
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
                disabled: forced,
                onClick: () => this.previewSeason(k),
              },
              name(k),
            ),
          ),
        ),
      );
    }
    // The Event section, under Season: the choice (shared with the wallpaper through the local server), what is on
    // now, and a button that shows the whole event for a minute. While the preview runs the select says so with its
    // time left ("Preview · 0:42", ticking with the panel) and the button cancels it instead of starting it again.
    eventSection() {
      const ev = this.moment.event,
        clock = EventLogic.previewClock(this.eventPreview, Date.now());
      return h(
        'div',
        { id: 'event-section', style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        h(
          'label',
          null,
          tr('settings.event'),
          h(
            'select',
            {
              'aria-label': tr('settings.event.mode'),
              value: clock ? PREVIEWING : this.eventChoice || 'auto',
              onChange: e => {
                this.setEventPreview(false); // a choice made now shows at once
                this.setEventChoice(e.target.value);
              },
            },
            clock && h('option', { value: PREVIEWING, disabled: true }, tr('settings.preview.left', { time: clock })),
            h('option', { value: 'auto' }, tr('settings.event.auto')),
            h('option', { value: 'on' }, tr('settings.event.on')),
            h('option', { value: 'off' }, tr('settings.event.off')),
          ),
        ),
        h(
          'span',
          null,
          tr('settings.event.current', {
            label: ev ? tr('event.christmas') : tr('settings.event.none'),
          }),
        ),
        h(
          'button',
          {
            className: 'btn',
            style: { padding: '3px 7px', fontSize: 11, alignSelf: 'flex-start' },
            onClick: () => this.setEventPreview(!clock),
          },
          clock ? tr('settings.preview.cancel') : tr('settings.event.preview'),
        ),
      );
    }
    // Starts the event preview (EventLogic.startPreview) or ends it now.
    setEventPreview(on) {
      if (!on && !this.eventPreview) return;
      this.eventPreview = on ? EventLogic.startPreview(Date.now()) : null;
      this.computeMoment();
      this.setState({ eventPreviewAt: Date.now() });
    }
    // The weather preview buttons (SkyLogic.startPreview through previewWeather), in the local panel and the world's.
    // While the event decides the weather (moment.forced: rain falls as snow) they say so and cannot be used.
    weatherPreviews() {
      const forced = this.moment.forced.weather;
      return h(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' } },
        WEATHER_PREVIEW.map(([type, label]) =>
          h(
            'button',
            {
              key: type,
              className: 'btn',
              title: tr('settings.weather.previewTitle', { label: WEATHER_LABEL[type] }),
              style: { padding: '3px 7px', fontSize: 11 },
              disabled: forced,
              onClick: () => this.previewWeather(type),
            },
            label,
          ),
        ),
        forced && h('span', { style: { fontSize: 11, color: 'var(--muted)' } }, tr('settings.forcedByEvent')),
      );
    }
    // Shared with the other pages like the event choice (SettingsSync); `fromServer` when it came from one of them.
    setSeasonChoice(choice, fromServer) {
      if (!SeasonLogic.CHOICES.includes(choice)) return;
      this.seasonChoice = choice;
      SeasonLogic.saveSeasonChoice(this.storage, choice);
      this.computeMoment();
      this.setState({ seasonChoice: choice });
      if (!fromServer) this.pushSettings(true);
    }
    // A preview shows the season for SEASON_PREVIEW_MS, then the choice's own returns.
    previewSeason(key) {
      if (!SeasonLogic.KEYS.includes(key)) return;
      this.seasonPreview = SeasonLogic.startSeasonPreview(key, Date.now());
      this.computeMoment();
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
          assetsLink(),
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
            this.weatherPreviews(),
          ),
          this.seasonSection(),
          this.eventSection(),
          this.teleportSection(),
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
