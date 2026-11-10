// The Christmas event on what is drawn every frame: the bulbs and the star of the big tree and, after dark, their
// glow. The still pieces are baked (web/island-art-xmas.js). A bulb is one rectangle; a glow is a small sprite made
// once per colour and stamped, never a gradient made in the frame.
import { EventLogic } from './event-logic.js';
import { BIG_TREE_BULBS, BIG_TREE_TOP } from './island-art-xmas.js';
import { ISLAND, PG, W, H } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';

export const BULB = ['#ff5a66', '#ffd166', '#5fd27a', '#5ec8ff'];
const BULB_OFF = ['#7a2b33', '#7a6433', '#2f653b', '#2f6079'];
// A soft round glow of one colour, size px across, made once and kept.
const GLOWS = new Map();
export function glowSprite(colour, size = 12) {
  const k = colour + size;
  let c = GLOWS.get(k);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d'),
      r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    r.addColorStop(0, colour + 'cc');
    r.addColorStop(0.4, colour + '55');
    r.addColorStop(1, colour + '00');
    g.fillStyle = r;
    g.fillRect(0, 0, size, size);
    GLOWS.set(k, c);
  }
  return c;
}
// How strongly lights glow for a daylight factor: nothing by day, full at night.
export const glowAt = df => (df >= 0.6 ? 0 : 1 - df / 0.6);
// Which of the four colour groups are lit at time t: two at a time, changing once a second; all with reduced motion.
export const groupLit = (g, t, still) => still || (Math.floor(t) + g) % 4 < 2;

const TREE = EventLogic.bigTreeTile(ISLAND, W, H),
  [TX, TY] = TREE ? PG(TREE[0] + 0.5, TREE[1] + 0.5, 0).map(Math.round) : [0, 0];

mixin(
  ClaudeOffice,
  class {
    // The event's lights among the scene's sprites (ev from eventNow, never null here).
    xmasItems(G, items, ev) {
      if (!TREE) return;
      items.push({ z: TREE[0] + TREE[1] + 0.52, f: () => this.xmasTreeLights(G) });
    }
    xmasTreeLights(G) {
      const { ctx, t, df } = G,
        glow = glowAt(df),
        still = !!(this.env && this.env.reduced),
        smooth = ctx.imageSmoothingEnabled;
      if (glow > 0.01) {
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = 0.5 * glow;
        ctx.drawImage(glowSprite('#ffd98a', 64), TX - 40, TY - 22, 80, 40);
      }
      for (let i = 0; i < 24; i++) {
        const g = i % 4,
          on = groupLit(g, t, still),
          bx = TX + BIG_TREE_BULBS[i * 2],
          by = TY - BIG_TREE_BULBS[i * 2 + 1];
        if (on && glow > 0.01) {
          ctx.globalAlpha = 0.9 * glow;
          ctx.drawImage(glowSprite(BULB[g]), bx - 5, by - 5);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = on ? BULB[g] : BULB_OFF[g];
        ctx.fillRect(bx, by, 2, 2);
      }
      // the star: bright, with a twinkle and its own glow at night
      const sy = TY - BIG_TREE_TOP - 5,
        tw = still ? 0 : Math.floor(t * 2) % 2;
      if (glow > 0.01) {
        ctx.globalAlpha = glow;
        ctx.drawImage(glowSprite('#fff3b0', 24), TX - 12, sy - 10);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#ffe27a';
      ctx.fillRect(TX - 1, sy, 3, 5);
      ctx.fillRect(TX - 3, sy + 2, 7, 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(TX, sy + 1 + tw, 1, 2);
      ctx.imageSmoothingEnabled = smooth;
    }
  },
);
