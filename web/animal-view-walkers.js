// Animals: walkers that follow the server's view, and the one-off effects started by its events.
import { AnimalWalk } from './animal-walk.js';
import {
  ANIMAL_PLACES,
  CATCH_S,
  FADE_S,
  KNOWN,
  REDUCED_CATCH_S,
  SPARK_AT_S,
  TIER_COLOR,
  TRAIL_S,
  U,
  nowS,
} from './animal-view-util.js';
import { LW, PG } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';
mixin(
  ClaudeOffice,
  class {
    // Walkers follow the view; a key under a running catch effect waits, then starts where the catch happened.
    syncWalkers(view) {
      const t = nowS(),
        block = new Map([...(this.animalBlock || new Map())].filter(([, until]) => until > t));
      const before = new Set((this.animals || []).map(a => a.key)),
        hints = this.animalHints || new Map();
      const next =
        view && !view.disabled
          ? U.reconcile(this.animals || [], view, {
              places: ANIMAL_PLACES,
              rand: Math.random,
              known: s => KNOWN.has(s),
              blocked: new Set(block.keys()),
            })
          : [];
      const fresh = a => !before.has(a.key) && hints.has(a.key);
      this.animals = next.map(a => (fresh(a) ? { ...a, x: hints.get(a.key)[0], y: hints.get(a.key)[1] } : a));
      // A hint is spent once used, and dropped when its animal did not go out (e.g. 5 were already out).
      const want = new Set(U.wanted(view).map(x => x.key));
      this.animalHints = new Map(
        [...hints].filter(([k]) => want.has(k) && !next.some(a => a.key === k && !before.has(k))),
      );
      this.animalBlock = block;
    }
    // Effects that need the walker as it was (before the view drops it).
    animalEventFx(events, view) {
      const t = nowS(),
        reduced = this.animalReduced();
      for (const e of events) {
        if (!e || typeof e.type !== 'string') continue;
        if (e.type === 'caught') this.startCatchFx('wild:' + e.id, 'out:' + e.id, view, t, reduced);
        else if (e.type === 'recalled') this.startCatchFx('out:' + e.id, null, view, t, reduced);
        else if (e.type === 'escaped' && !reduced) {
          const w = (this.animals || []).find(a => a.kind === 'wild');
          if (w)
            this.animalFx = [
              ...this.animalFx,
              {
                type: 'break',
                x: w.x,
                y: w.y,
                species: w.species,
                tier: U.tierOf(view, w.species) || 'common',
                t0: t,
                dur: 0.6,
              },
            ];
        }
      }
    }
    // The animal shrinks into a spark that flies to the chip; a released catch reappears where it stood.
    startCatchFx(key, nextKey, view, t, reduced) {
      const w = (this.animals || []).find(a => a.key === key);
      if (!w) return;
      const p = AnimalWalk.pose(w, t),
        tier = U.tierOf(view, w.species) || 'common',
        dur = reduced ? REDUCED_CATCH_S : CATCH_S;
      this.animals = this.animals.filter(a => a !== w);
      this.animalFx = [
        ...this.animalFx,
        {
          type: nextKey ? 'catch' : 'recall',
          x: w.x,
          y: w.y,
          species: w.species,
          frame: p.frame,
          flip: p.flip,
          tier,
          t0: t,
          dur,
          reduced,
        },
      ];
      if (nextKey) {
        this.animalBlock = new Map([...this.animalBlock, [nextKey, t + dur]]);
        this.animalHints = new Map([...this.animalHints, [nextKey, [w.x, w.y]]]);
      }
      if (!reduced) setTimeout(() => this.flySpark(w, TIER_COLOR[tier]), SPARK_AT_S * 1000);
    }
    // Effects that need the new walker (after the view added it).
    animalArriveFx(events, view) {
      if (this.animalReduced()) return;
      const t = nowS(),
        find = k => (this.animals || []).find(a => a.key === k),
        add = fx => {
          this.animalFx = [...this.animalFx, ...fx];
        };
      for (const e of events) {
        if (!e) continue;
        if (e.type === 'spawn' && e.wild) {
          const w = find('wild:' + e.wild.id);
          if (!w) continue;
          const tier = U.tierOf(view, w.species) || 'common',
            at = { x: w.x, y: w.y, tier, t0: t };
          add([{ ...at, type: 'dust', dur: 0.6 }]);
          if (tier === 'rare') add([{ ...at, type: 'sparkle', dur: 0.9 }]);
          if (tier === 'epic') add([{ ...at, type: 'column', dur: 0.6, tall: false }]);
          if (tier === 'legendary')
            add([
              { ...at, type: 'column', dur: 1.2, tall: true },
              { ...at, type: 'frame', dur: 0.8 },
            ]);
        } else if (e.type === 'released') {
          const w = find('out:' + e.id);
          if (w) add([{ x: w.x, y: w.y, tier: 'common', t0: t, type: 'dust', dur: 0.6 }]);
        }
      }
    }
    // A DOM spark from the animal to the chip (the canvas cannot draw over the header).
    flySpark(w, col) {
      const chip = this.animalChipEl,
        cv = this.canvas;
      if (!this.animalsOn || !chip || !cv || !document.body || !chip.isConnected) return;
      const r = cv.getBoundingClientRect(),
        c = chip.getBoundingClientRect(),
        [sx, sy] = PG(w.x, w.y);
      const x = r.left + (sx * r.width) / LW,
        y = r.top + ((sy - 8) * r.width) / LW;
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, {
        position: 'fixed',
        left: x - 3 + 'px',
        top: y - 3 + 'px',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: col,
        boxShadow: '0 0 8px 2px ' + col,
        zIndex: '200',
        pointerEvents: 'none',
      });
      document.body.appendChild(el);
      const to = 'translate(' + (c.left + c.width / 2 - x) + 'px,' + (c.top + c.height / 2 - y) + 'px) scale(0.6)';
      const anim =
        typeof el.animate === 'function'
          ? el.animate(
              [
                { transform: 'none', opacity: 1 },
                { transform: to, opacity: 0.8 },
              ],
              { duration: 700, easing: 'cubic-bezier(.5,0,.3,1)' },
            )
          : null;
      if (anim) anim.onfinish = () => el.remove();
      else el.remove();
    }
    // Called every frame, paused or not (the pause button only pauses the office simulation).
    stepAnimals(dt) {
      const list = this.animals || [],
        fx = this.animalFx || [];
      if (!list.length && !fx.length && !(this.animalBlock && this.animalBlock.size)) return;
      const now = (this.animalNow = (this.animalNow || 0) + dt),
        d = new Date(),
        calm = this.animalReduced();
      const w = { ...ANIMAL_PLACES, now, hour: d.getHours() + d.getMinutes() / 60, calm };
      let next = AnimalWalk.step(list, w, dt);
      // The wild animal is stepped at an hour it is awake (the owl sleeps by day), so it never naps while catchable.
      const wild = list.find(a => a.kind === 'wild');
      if (wild) {
        const ww = AnimalWalk.step(list, { ...w, hour: wild.species === 'owl' ? 0 : 12 }, dt);
        next = next.map((a, i) => (list[i].kind === 'wild' ? ww[i] : a));
      }
      this.animals = next
        .map(a => (a.done && a.fadeAt == null ? { ...a, fadeAt: now } : a))
        .filter(a => a.fadeAt == null || now - a.fadeAt < FADE_S);
      const t = nowS();
      this.animalFx = fx.filter(f => t < f.t0 + f.dur);
      this.animalTrails = this.trailsFor(this.animals, t, calm);
      if (this.animalBlock && [...this.animalBlock.values()].some(u => u <= t)) this.syncWalkers(this.state.animalView);
    }
    trailsFor(list, t, calm) {
      const prev = this.animalTrails || new Map(),
        out = new Map();
      if (calm) return out;
      for (const a of list) {
        if (this.animalTier(a.species) !== 'legendary') continue;
        const old = (prev.get(a.key) || []).filter(p => t - p.t < TRAIL_S),
          last = old[old.length - 1];
        const moving = a.path && a.path.length > 0;
        out.set(a.key, moving && (!last || t - last.t > 0.05) ? [...old, { x: a.x, y: a.y, t }] : old);
      }
      return out;
    }
  },
);
