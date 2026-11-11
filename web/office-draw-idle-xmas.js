// The Christmas event's idle activities on the canvas (where and when they happen is web/event-idle.js): the arms
// of someone throwing a snowball, rolling one, skating, setting a present down or holding a mug of cocoa, and what
// goes with them: the snowball in the air, the rolled snowball, the skater's trail, the present.
import { SnowLogic } from './snow-logic.js';
import { ClaudeOffice, mixin } from './office.js';

mixin(
  ClaudeOffice,
  class {
    // What the event's idle spots depend on (EventIdle.open): one object per scene, used again.
    idleCtx(frozen) {
      const c = this.idleC || (this.idleC = { level: 0, snow: 0, frozen: false, calm: false }),
        ev = this.eventNow();
      c.level = ev ? ev.level : 0;
      c.snow = SnowLogic.depth(this.snowShown || 0);
      c.frozen = !!frozen;
      c.calm = !!(this.env && this.env.reduced);
      return c;
    }
  },
);
