// The living scene follows a new Look in the same frame, paused or not (docs/specs/2026-11-18-asset-labels-design.md
// §5.7, D4; what changed is web/look-change.js). frame() compares the Look with the last one it saw, one comparison a
// frame, and calls onLook once when its key changes.
import { EventIdle } from './event-idle.js';
import { EventLandmark } from './event-landmark.js';
import { EventLogic } from './event-logic.js';
import { LookChange } from './look-change.js';
import { SeasonLogic } from './season-logic.js';
import { IDLE_SPOTS } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';

// The cells the event takes out of the walkable ones (the big tree's, the cathedral's), and how long the snow it
// brought takes to melt when it ends (D4).
const EVENT_CELLS = new Set([...EventLogic.TREE_CELLS, ...EventLandmark.WALK_OFF]),
  MELT_MS = 10_000;

mixin(
  ClaudeOffice,
  class {
    // Called by frame() when this.look is not the Look it saw last.
    seeLook() {
      const prev = this.lastLook;
      this.lastLook = this.look;
      if (prev && prev.key !== this.look.key) this.onLook(prev, this.look);
    }
    onLook(prev, next) {
      const d = LookChange.diff(prev, next);
      this.eventNow(); // the tree's and the cathedral's cells, blocked or walkable again
      // the critters and the bears as the new Look has them (dt 0: nobody moves, the lists follow), drawn so at once
      if (this.critterWorld) this.stepCritters(0);
      if (this.bearWorld) this.stepBears(0);
      const frozen = SeasonLogic.look(this.seasonNow()).frozen,
        c = this.idleCtx(frozen),
        sent = [];
      for (const a of this.agents) {
        // a way out the Look no longer has is chosen again (a scene already playing plays to its end)
        if (a.leaving && !a.gone && d.rulesOff.has('fate.' + a.fate)) {
          this.pickFate(a);
          a.goalKey = null;
        }
        // whoever is at a spot that closed leaves, though not all in the same frame
        else if (a.status === 'idle' && !a.leaving && a.idleSpot != null) {
          const ok =
            SeasonLogic.idleStays(IDLE_SPOTS, a.idleSpot, frozen) && EventIdle.stays(IDLE_SPOTS, a.idleSpot, c);
          if (!ok) sent.push(a);
        }
        // a walk across cells the event now stands on is worked out again
        if (d.blockChanged && d.blockOn && a.path && a.path.length && LookChange.crosses(a.path, EVENT_CELLS))
          a.goalKey = null;
      }
      LookChange.stagger(sent.length, Math.random).forEach((s, i) => (sent[i].linger = s));
      // the snow the event brought melts in MELT_MS (a real winter keeps its own: SeasonLogic minSnow, envNow)
      if (d.snowFrom > d.snowTo) this.meltUntil = Date.now() + MELT_MS;
    }
  },
);
