// Animals: the feed from the local server (GET once, then the animal SSE stream, in both data sources, retried with
// backoff), the weather/visibility reports and the actions. The server owns every rule.
import { tr } from './i18n.js';
import {
  ARM_MS,
  ENV_EVERY_MS,
  ENV_MIN_GAP_MS,
  POST_HEADERS,
  RETRY_MAX_MS,
  RETRY_MIN_MS,
  U,
} from './animal-view-util.js';
import { ClaudeOffice, mixin } from './office.js';

const tabHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

mixin(
  ClaudeOffice,
  class {
    startAnimals() {
      // startSource runs again when "view as others" flips, which changes what the user can see.
      if (this.animalsOn) {
        this.reportEnv();
        return;
      }
      this.animalsOn = true;
      this.animalGen = 0;
      this.animalRetryMs = RETRY_MIN_MS;
      this.animals = [];
      this.animalFx = [];
      this.animalBlock = new Map();
      this.animalHints = new Map();
      this.animalTrails = new Map();
      this.noticeQ = [];
      this.setAnimalChip = el => {
        this.animalChipEl = el;
      };
      // Stable, so React calls it only when a panel mounts or unmounts, not on every 300 ms render.
      this.setAnimalPanel = el => this.animalPanelRef(el);
      this.onAnimalVis = () => this.animalVisibility();
      this.onAnimalKey = e => this.animalKey(e);
      document.addEventListener('visibilitychange', this.onAnimalVis);
      window.addEventListener('keydown', this.onAnimalKey);
      this.loadAnimals();
    }
    stopAnimals() {
      if (!this.animalsOn) return;
      this.animalsOn = false;
      this.animalGen++;
      this.closeAnimalStream();
      clearTimeout(this.animalRetry);
      clearTimeout(this.envTimer);
      clearTimeout(this.noticeTimer);
      clearTimeout(this.armAnimalTimer);
      document.removeEventListener('visibilitychange', this.onAnimalVis);
      window.removeEventListener('keydown', this.onAnimalKey);
    }
    // 200: on. 503: disabled (chip with an error, retried). Anything else: an older server, so the feature stays
    // hidden.
    loadAnimals() {
      clearTimeout(this.animalRetry);
      const gen = ++this.animalGen;
      return fetch('/api/animals', { cache: 'no-store' })
        .then(r =>
          r.status === 200
            ? r.json().then(v => ({ v }))
            : r.status === 503
              ? r
                  .json()
                  .catch(() => null)
                  .then(v => ({ off: v || {} }))
              : { gone: true },
        )
        .catch(() => ({ net: true }))
        .then(res => {
          if (gen !== this.animalGen || !this.animalsOn || this.world) return;
          if (res.v && typeof res.v === 'object' && !res.v.disabled) {
            this.applyAnimalView(res.v, []);
            if (!tabHidden()) this.openAnimalStream();
            this.reportEnv();
            return;
          }
          if (res.off || (res.v && res.v.disabled)) {
            this.setAnimalOff(res.off || res.v);
            this.retryAnimals();
            return;
          }
          if (res.net && this.animalSeen) {
            this.retryAnimals();
            return;
          }
          this.hideAnimals();
        });
    }
    // The feature is gone (older server): no stream, no env reports, nothing left queued.
    hideAnimals() {
      this.animalApiOk = false;
      clearTimeout(this.envTimer);
      clearTimeout(this.noticeTimer);
      this.noticeTimer = null;
      this.closeAnimalStream();
      this.animals = [];
      this.animalFx = [];
      this.noticeQ = [];
      this.setState({ animalView: null, animalPanel: null, selAnimal: null, animalNotice: null });
    }
    retryAnimals() {
      clearTimeout(this.animalRetry);
      this.animalRetry = setTimeout(() => this.loadAnimals(), this.animalRetryMs);
      this.animalRetryMs = Math.min(RETRY_MAX_MS, this.animalRetryMs * 2);
    }
    // Browsers allow 6 connections per host, shared by all tabs: a hidden tab gives its stream back and fetches the
    // current view again when shown.
    animalVisibility() {
      this.reportEnv();
      if (!this.animalsOn || this.animalApiOk === false) return Promise.resolve();
      if (tabHidden()) {
        clearTimeout(this.animalRetry);
        this.animalGen++;
        this.closeAnimalStream();
        return Promise.resolve();
      }
      return this.animalEs ? Promise.resolve() : this.loadAnimals();
    }
    closeAnimalStream() {
      if (this.animalEs) {
        this.animalEs.onmessage = this.animalEs.onerror = null;
        this.animalEs.close();
      }
      this.animalEs = null;
    }
    // A non-200 stream closes for good, so every error goes back through GET (which also tells 503 from 404).
    openAnimalStream() {
      this.closeAnimalStream();
      const gen = this.animalGen;
      let es;
      try {
        es = new EventSource('/api/animals/events');
      } catch (e) {
        this.retryAnimals();
        return;
      }
      this.animalEs = es;
      es.onmessage = e => {
        if (gen !== this.animalGen) return;
        let v = null;
        try {
          v = JSON.parse(e.data);
        } catch (_) {
          return;
        }
        if (!v || typeof v !== 'object') return;
        if (v.disabled) {
          this.setAnimalOff(v);
          this.closeAnimalStream();
          this.retryAnimals();
          return;
        }
        this.animalRetryMs = RETRY_MIN_MS;
        this.applyAnimalView(v, Array.isArray(v.events) ? v.events : []);
      };
      es.onerror = () => {
        if (gen !== this.animalGen) return;
        this.closeAnimalStream();
        this.retryAnimals();
      };
    }
    setAnimalOff(v) {
      this.animalApiOk = false;
      this.animals = [];
      this.animalFx = [];
      this.setState({
        animalView: { disabled: true, error: typeof v.error === 'string' ? v.error.slice(0, 80) : 'unavailable' },
      });
    }
    refreshAnimals() {
      fetch('/api/animals', { cache: 'no-store' })
        .then(r => (r.status === 200 ? r.json() : null))
        .catch(() => null)
        .then(v => {
          if (v && typeof v === 'object' && !v.disabled && this.animalsOn) this.applyAnimalView(v, []);
        });
    }
    applyAnimalView(raw, events) {
      const { events: _ev, ...v } = raw;
      if (!Array.isArray(v.caught) || !Array.isArray(v.out) || !Array.isArray(v.species)) return;
      this.animalSeen = true;
      this.animalApiOk = true;
      this.animalAt = performance.now();
      this.animalEventFx(events, v);
      this.syncWalkers(v);
      this.animalArriveFx(events, v);
      for (const n of U.noticesFor(events, v)) this.pushNotice(this.noticeText(n));
      if (v.notice && typeof v.notice === 'object' && v.notice.at !== this.animalNoticeAt) {
        this.animalNoticeAt = v.notice.at;
        this.pushNotice(
          v.notice.type === 'reset'
            ? tr('animal.notice.reset')
            : v.notice.type === 'repaired'
              ? tr('animal.notice.repaired')
              : tr('animal.notice.restored'),
        );
      }
      this.setState({ animalView: v });
    }
    // Weather of the mode (never a preview) and whether the animals are on screen; every 10 s while they are.
    reportEnv() {
      clearTimeout(this.envTimer);
      if (!this.animalsOn || !this.animalApiOk || this.world) return;
      // Not animalsHidden(): right after a GET the batched setState has not landed animalView yet.
      const tab = typeof document === 'undefined' ? 'visible' : document.visibilityState;
      const visible = U.envVisible(tab, this.isLive && !!this.state.asOthers),
        t = performance.now(),
        last = this.envSent;
      // The server allows one report per 10 s: a repeat of the same visibility waits for its turn.
      const wait = !last
        ? 0
        : last.visible === visible
          ? ENV_EVERY_MS - (t - last.at)
          : ENV_MIN_GAP_MS - (t - last.at);
      if (wait > 250) {
        this.envTimer = setTimeout(() => this.reportEnv(), wait);
        return;
      }
      this.envSent = { visible, at: t };
      this.animalPost('env', { weather: U.envWeather(this.wx.to, this.preview), visible }, { quiet: true });
      if (visible) this.envTimer = setTimeout(() => this.reportEnv(), ENV_EVERY_MS);
    }
    // Actions answer with the new view, but the stream carries the events; its view is used only when the stream is
    // down.
    animalPost(action, body, { quiet = false } = {}) {
      if (!quiet) {
        if (this.state.animalBusy) return Promise.resolve(null);
        this.setState({ animalBusy: true, animalArmed: null });
      }
      return fetch('/api/animals/' + action, {
        method: 'POST',
        headers: POST_HEADERS,
        cache: 'no-store',
        body: JSON.stringify(body),
      })
        .then(r =>
          r
            .json()
            .catch(() => null)
            .then(j => ({ status: r.status, body: j })),
        )
        .catch(() => ({ status: 0, body: null }))
        .then(res => {
          if (!this.animalsOn) return res;
          if (!quiet) this.setState({ animalBusy: false });
          const streamUp = this.animalEs && this.animalEs.readyState === 1;
          if (res.status === 200 && action !== 'env' && !streamUp && res.body && Array.isArray(res.body.caught))
            this.applyAnimalView(res.body, []);
          else if (res.status === 409) this.refreshAnimals();
          else if (!quiet && res.status !== 200 && res.status !== 429) this.pushNotice(tr('animal.notice.failed'));
          return res;
        });
    }
    // Two clicks: the first arms `key` for 4 s, the second runs fn.
    armOr(key, fn) {
      clearTimeout(this.armAnimalTimer);
      if (this.state.animalArmed === key) {
        this.setState({ animalArmed: null });
        fn();
        return;
      }
      this.setState({ animalArmed: key });
      this.armAnimalTimer = setTimeout(() => this.setState({ animalArmed: null }), ARM_MS);
    }
    animalsHidden() {
      return !this.state.animalView || (this.isLive && !!this.state.asOthers);
    }
    animalReduced() {
      return !!(this.env && this.env.reduced);
    }
  },
);
