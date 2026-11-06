// Animals: clicks and taps, the one panel slot, Escape and focus, and panning to the wild animal.
import { CameraLogic } from './camera-logic.js';
import { HIT_CSS_PX, U, safeFrame } from './animal-view-util.js';
import { LH, LW, P, PA, PG } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';
mixin(
  ClaudeOffice,
  class {
    // Animals stand on the lawn (PG); the touch area is at least HIT_CSS_PX screen pixels around the body, at any
    // zoom.
    hitAnimal(e) {
      const hit = this.hitAnimalAt(e);
      return hit ? hit.animal : null;
    }
    // The nearest animal under the pointer and its distance in scene px.
    hitAnimalAt(e) {
      if (this.animalsHidden()) return null;
      const an = this.animals || [];
      if (!an.length) return null;
      const r = e.currentTarget.getBoundingClientRect();
      if (!r.width) return null;
      const lx = ((e.clientX - r.left) / r.width) * LW,
        ly = ((e.clientY - r.top) / r.height) * LH,
        min = (HIT_CSS_PX * LW) / r.width;
      let best = null,
        bd = Infinity;
      for (const a of an) {
        if (a.leave || a.done) continue;
        const f = safeFrame(a.species, 'stand');
        if (!f) continue;
        const [sx, sy] = PG(a.x, a.y),
          d = Math.hypot(lx - sx, ly - (sy - f.h / 2)),
          R = Math.max(min, f.w / 2 + 2, f.h / 2 + 2);
        if (d <= R && d < bd) {
          bd = d;
          best = a;
        }
      }
      return best ? { animal: best, d: bd } : null;
    }
    // What a click selects: {animal} or {agent} (or neither). The agent anchor mirrors hit(): its point, 10 px up.
    tapAt(e) {
      const an = this.hitAnimalAt(e),
        ag = this.hit(e);
      let agD = null;
      if (an && ag) {
        const r = e.currentTarget.getBoundingClientRect(),
          lx = ((e.clientX - r.left) / r.width) * LW,
          ly = ((e.clientY - r.top) / r.height) * LH;
        const [sx, sy] = ag.sleeping ? P(ag.x, ag.y, -4) : ag.seated ? P(ag.x, ag.y, 11.5) : PA(ag.x, ag.y);
        agD = Math.hypot(lx - sx, ly - (sy - 10));
      } else if (ag) agD = 0;
      const pick = U.preferTap(an ? an.d : null, agD);
      return { animal: pick === 'animal' ? an.animal : null, agent: pick === 'agent' ? ag : null };
    }
    clickAnimal(a) {
      const v = this.animalLive();
      if (!v || v.disabled) return;
      if (a.kind === 'wild') {
        if (v.attempt || !v.wild || v.wild.id !== a.id)
          this.setState({ animalPanel: 'collection', selAnimal: null, sel: null });
        else this.animalPost('catch', { wildId: a.id });
        return;
      }
      this.setState({ animalPanel: 'animal', selAnimal: a.id, sel: null });
    }
    // One panel slot: a pending full-collection choice wins, then an open animal panel, then the agent panel.
    animalSlot() {
      if (this.animalsHidden()) return null;
      const v = this.state.animalView,
        p = this.state.animalPanel;
      if (!v.disabled && v.attempt && v.attempt.phase === 'pending' && v.wild) return 'picker';
      if (p === 'collection') return 'collection';
      if (p === 'animal' && !v.disabled && v.out.includes(this.state.selAnimal)) return 'animal';
      return null;
    }
    toggleCollection() {
      this.setState(s =>
        s.animalPanel === 'collection'
          ? { animalPanel: null }
          : { animalPanel: 'collection', selAnimal: null, sel: null },
      );
    }
    // Wrapper-local point of the wild animal's middle, or null.
    wildPoint() {
      const w = (this.animals || []).find(a => a.kind === 'wild' && !a.leave),
        f = w && safeFrame(w.species, 'stand');
      if (!f || !this.wrapEl) return null;
      const s = this.wrapEl.offsetWidth / LW,
        [sx, sy] = PG(w.x, w.y);
      return { w, lx: sx * s, ly: (sy - f.h / 2) * s };
    }
    panToAnimal() {
      const q = this.wildPoint(),
        b = this.camBox();
      if (!q || !b) return;
      this.setCam(CameraLogic.clamp(U.centerOn(this.cam, { ...b, oy: b.oy + (this.wrapTop || 0) }, q.lx, q.ly), b));
    }
    animalKey(e) {
      if (e.key !== 'Escape' || e.isComposing || e.defaultPrevented || this.animalsHidden()) return;
      const slot = this.animalSlot();
      if (slot === 'picker') {
        if (!U.escInside(e.target, this.animalPanelNode, document)) return;
        e.preventDefault();
        this.animalPost('resolve', { cancel: true });
      } else if (slot) this.setState({ animalPanel: null, selAnimal: null });
    }
    // A panel takes focus on open; on close focus goes back to its opener (or the chip) if it fell to the body.
    animalPanelRef(el) {
      if (el) {
        const act = document.activeElement,
          away = !act || act === document.body || act === document.documentElement || el.contains(act);
        this.animalOpener = away ? null : act;
        this.animalPanelNode = el;
        // The panel's main action (e.g. Catch) wins over its close button, so Enter does the expected thing.
        const first =
          el.querySelector('[data-autofocus]:not([disabled])') ||
          el.querySelector(
            'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),' +
              '[tabindex]:not([tabindex="-1"])',
          ) ||
          el;
        first.focus({ preventScroll: true });
        return;
      }
      const node = this.animalPanelNode,
        opener = this.animalOpener,
        act = document.activeElement;
      this.animalPanelNode = null;
      this.animalOpener = null;
      if (!node || !act || !node.contains(act)) return;
      // React detaches the ref before removing the node, so check once the focused button is gone.
      setTimeout(() => {
        const now = document.activeElement;
        if (now && now !== document.body && now.isConnected !== false) return;
        const to = U.restoreTarget(opener, this.animalChipEl);
        if (to) to.focus({ preventScroll: true });
      }, 0);
    }
  },
);
