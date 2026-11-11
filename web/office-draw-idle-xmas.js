// The Christmas event's idle activities on the canvas (where and when they happen is web/event-idle.js): the arms
// of someone throwing a snowball, rolling one, skating, setting a present down or holding a mug of cocoa, and what
// goes with them: the snowball in the air, the rolled snowball, the skater's trail, the present.
import { SnowLogic } from './snow-logic.js';
import { EventIdle } from './event-idle.js';
import { OutfitLogic } from './outfit-logic.js';
import { WATER_Z } from './island-land.js';
import { EVENT_IDLE, IDLE_SPOTS, OX, OY, TH, TW } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';

const { RED, GOLD } = OutfitLogic,
  SNOW = SnowLogic.PAL,
  STEAM = '#e8eef4',
  SHADOW = 'rgba(40,50,90,0.25)',
  TRAIL = 'rgba(110,145,190,0.55)',
  HAND = 12; // px above the feet a snowball leaves the hand
// The two ends of the snowball pitch on the screen (the middle of each cell).
const sxy = c => [Math.round(OX + (c[0] - c[1]) * TW), Math.round(OY + (c[0] + c[1] + 1) * TH)],
  PITCH = EVENT_IDLE.pitch ? [sxy(EVENT_IDLE.pitch.a), sxy(EVENT_IDLE.pitch.b)] : null,
  XY = [0, 0],
  G_T = { t: 0 }; // the frame's time, for the arms (drawPerson passes each person their own phase)

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
    // The arms of someone at one of the event's activities (and of someone with a mug of cocoa where the coffee
    // is): true when it drew them, so the usual arms are left out.
    xmasArms(R, act, sx, by, t, sh, shD, sk, a) {
      const rest = () => {
        R(sx - 5, by - 11, 1, 5, shD);
        R(sx - 5, by - 6, 1, 1, sk);
      };
      if (act === 'coffee') {
        // a red mug held up, steam curling off it
        rest();
        R(sx + 4, by - 12, 1, 4, shD);
        R(sx + 3, by - 15, 3, 3, RED);
        R(sx + 3, by - 15, 3, 1, SNOW.lit);
        R(sx + 4, by - 17 - (Math.floor(t * 3) % 3), 1, 1, SNOW.glint);
        R(sx + 5, by - 18 - (Math.floor(t * 3 + 1.5) % 3), 1, 1, STEAM);
      } else if (act === 'snowball') {
        const side = IDLE_SPOTS[a.idleSpot] ? IDLE_SPOTS[a.idleSpot].side : 0;
        if (this.snowBoth && EventIdle.thrower(G_T.t) === side && EventIdle.ball(G_T.t, true)) {
          // the throw: the arm swung up and forward
          rest();
          R(sx + 4, by - 16, 1, 5, shD);
          R(sx + 4, by - 17, 1, 1, sk);
        } else {
          // packing the next one in both hands
          R(sx - 5, by - 11, 1, 4, shD);
          R(sx + 4, by - 11, 1, 4, shD);
          R(sx - 4, by - 8, 8, 1, sk);
          R(sx - 1, by - 9, 2, 2, SNOW.glint);
        }
      } else if (act === 'snowman') {
        // both hands on the snowball, pushing
        const push = Math.floor(t * 2) % 2;
        R(sx - 5, by - 11, 1, 4, shD);
        R(sx + 4, by - 11, 1, 3, shD);
        R(sx + 4, by - 8, 2 + push, 1, shD);
        R(sx + 6 + push, by - 8, 1, 1, sk);
        R(sx - 5, by - 7, 1, 1, sk);
      } else if (act === 'skate') {
        // arms out for balance, one a little higher as they lean
        const lean = Math.floor(t * 1.5) % 2;
        R(sx - 8, by - 10 - lean, 4, 1, shD);
        R(sx + 4, by - 9 - (1 - lean), 4, 1, shD);
        R(sx - 9, by - 10 - lean, 1, 1, sk);
        R(sx + 8, by - 9 - (1 - lean), 1, 1, sk);
      } else if (act === 'gift') {
        // a present held out, lowered to the floor by the tree every few seconds
        const down = t % 5 > 3.4 ? 4 : 0;
        rest();
        R(sx + 4, by - 11, 1, 3 + down, shD);
        R(sx + 4, by - 9 + down, 5, 4, RED);
        R(sx + 6, by - 9 + down, 1, 4, GOLD);
        R(sx + 4, by - 8 + down, 5, 1, GOLD);
      } else return false;
      return true;
    }
    // Called once a frame before the scene is drawn: who is at the event's spots, and the things that go with
    // them (the snowball in the air, the rolled snowball, the skater's trail) into the scene's sorted list.
    idleXmasItems(G, items) {
      G_T.t = G.t;
      this.snowBoth = false;
      if (!G.ev) return;
      let s0 = null,
        s1 = null;
      for (const a of this.agents) {
        if (a.moving || a.status !== 'idle' || !a.actNow) continue;
        if (a.actNow === 'snowball') IDLE_SPOTS[a.idleSpot] && IDLE_SPOTS[a.idleSpot].side ? (s1 = a) : (s0 = a);
        else if (a.actNow === 'snowman') items.push({ z: a.x + a.y + 0.4, f: () => this.drawRolled(G, a) });
        else if (a.actNow === 'skate') items.push({ z: a.x + a.y - 0.2, f: () => this.drawTrail(G, a) });
      }
      this.snowBoth = !!(s0 && s1 && PITCH);
      if (this.snowBoth && EventIdle.ball(G.t, true))
        items.push({ z: (s0.x + s0.y + s1.x + s1.y) / 2 + 0.1, f: () => this.drawSnowball(G) });
    }
    drawSnowball(G) {
      const b = EventIdle.ball(G.t, true);
      if (!b) return;
      const x = Math.round(PITCH[0][0] + (PITCH[1][0] - PITCH[0][0]) * b.u),
        y = Math.round(PITCH[0][1] + (PITCH[1][1] - PITCH[0][1]) * b.u);
      G.rect(x - 1, y, 2, 1, SHADOW);
      G.rect(x - 2, y - HAND - Math.round(b.h) - 1, 4, 4, SNOW.rim);
      G.rect(x - 1, y - HAND - Math.round(b.h), 2, 2, SNOW.glint);
    }
    // The snowball someone rolls, in front of them: a stepped round with a shaded foot (it does not grow when the
    // viewer asked for reduced motion).
    drawRolled(G, a) {
      const calm = this.env && this.env.reduced,
        r = Math.round(calm ? 7 : EventIdle.snowmanSize(G.t + a.id)),
        cx = Math.round(OX + (a.x - a.y) * TW) + 8 + r,
        cy = Math.round(OY + (a.x + a.y) * TH) + 3;
      // an outline first: snow on snow would not show
      G.rect(cx - r, cy - 2 * r - 1, 2 * r, 2 * r + 2, SNOW.rim);
      G.rect(cx - r - 1, cy - 2 * r, 2 * r + 2, 2 * r, SNOW.rim);
      G.rect(cx - r + 1, cy - 2 * r, 2 * r - 2, 2 * r, SNOW.base);
      G.rect(cx - r, cy - 2 * r + 1, 2 * r, 2 * r - 2, SNOW.base);
      G.rect(cx - r + 1, cy - 2, 2 * r - 2, 2, SNOW.shade);
      G.rect(cx - r + 2, cy - 2 * r + 1, Math.max(1, r - 2), 1, SNOW.glint);
    }
    // Where the skater has just been: eight faint marks on the ice.
    drawTrail(G, a) {
      for (let k = 1; k <= 8; k++) {
        EventIdle.skateAt(EVENT_IDLE.rink, (a.skT || 0) + a.id - k * 0.14, XY);
        G.rect(OX + (XY[0] - XY[1]) * TW, OY + (XY[0] + XY[1]) * TH - WATER_Z + 1, 2, 1, TRAIL);
      }
    }
  },
);
