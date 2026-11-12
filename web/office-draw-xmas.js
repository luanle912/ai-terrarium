// The Christmas event on what is drawn every frame: the bulbs and the star of the big tree and, after dark, their
// glow. The still pieces are baked (web/island-art-xmas.js). A bulb is one rectangle; a glow is a small sprite made
// once per colour and stamped, never a gradient made in the frame.
import { EventLogic } from './event-logic.js';
import { BIG_TREE_BULBS, BIG_TREE_EXT, BIG_TREE_TOP, drawBigTree } from './island-art-xmas.js';
import { PAVILION, night } from './island-art.js';
import { KENNEL } from './office-draw-doghouse.js';
import { DESKS, DOG_HOUSES, ISLAND, P, PG, SMOKE, W, H, WALL } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';

export const BULB = ['#ff5a66', '#ffd166', '#5fd27a', '#5ec8ff'];
const BULB_OFF = ['#7a2b33', '#7a6433', '#2f653b', '#2f6079'];
// A soft round glow of one colour, size px across, made once and kept.
const GLOWS = new Map();
export function glowSprite(colour, size = 12) {
  const k = size === 12 ? colour : colour + size;
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

// The strings of lights, laid out once: each { at: Float32Array of x, y, level: the event level it comes with, z: its
// depth among the scene's sprites (null: on the office walls, drawn right after them) }. In all never more than
// EventLogic.MAX_BULBS: the shares below add up to 114.
const STRINGS = [];
{
  const add = (pts, gap, max, level, z) => {
    const at = EventLogic.lightString(pts, gap, max);
    // a slight sag between fixings, so the line is not ruler-straight
    for (let i = 0; i < at.length / 2; i++) at[i * 2 + 1] = Math.round(at[i * 2 + 1] + (i % 3 === 1 ? 1 : 0));
    for (let i = 0; i < at.length; i += 2) at[i] = Math.round(at[i]);
    STRINGS.push({ at, level, z });
  };
  // under the cap of the office's back wall and its left wall
  add([P(0.3, 0, WALL - 1), P(W - 0.3, 0, WALL - 1)], 9, 54, 1, null);
  add([P(0, 0.3, WALL - 1), P(0, H - 0.3, WALL - 1)], 9, 30, 1, null);
  // along each kennel's gable, eave to ridge to eave
  const { X1, HW, OV, ZE, ZR } = KENNEL;
  for (const h of DOG_HOUSES) {
    const L = (w, z) => PG(h.x + X1 + OV, h.y + w, z);
    add([L(-HW - OV, ZE - 2), L(0, ZR - 2), L(HW + OV, ZE - 2)], 6, 5, 2, h.x + X1 + h.y + HW + 0.01);
  }
  // under the pergola's front beam
  add([PG(SMOKE.x + 0.95, SMOKE.y + 1.1, 35), PG(SMOKE.x + 4.0, SMOKE.y + 1.1, 35)], 8, 7, 2, SMOKE.x + SMOKE.y + 2.11);
  // round the two near eaves of the pavilion's lower roof
  const pv = ISLAND.pavilion;
  if (pv) {
    const r = PAVILION.r.eave,
      z = PAVILION.z.eave - 1,
      c = pv.pillar;
    add(
      [PG(c.x + 0.5 - r, c.y + 0.5 + r, z), PG(c.x + 0.5 + r, c.y + 0.5 + r, z), PG(c.x + 0.5 + r, c.y + 0.5 - r, z)],
      7,
      8,
      3,
      c.x + c.y + 1.01,
    );
  }
}
// One string's bulbs: a 2 px square each, and after dark a glow under every lit one.
export function drawString(ctx, at, t, glow, still, lit) {
  for (let i = 0; i < at.length; i += 2) {
    const g = (i >> 1) % 4,
      on = groupLit(g, t, still);
    if (on && lit) {
      ctx.globalAlpha = 0.85 * glow;
      ctx.drawImage(glowSprite(BULB[g]), at[i] - 5, at[i + 1] - 5);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = on ? BULB[g] : BULB_OFF[g];
    ctx.fillRect(at[i], at[i + 1], 2, 2);
  }
}
// A lit star, its top middle at (x, sy): bright, with a twinkle (tw 0 or 1) and its own glow at night.
export function litStar(ctx, x, sy, tw, glow) {
  if (glow > 0.01) {
    ctx.globalAlpha = glow;
    ctx.drawImage(glowSprite('#fff3b0', 24), x - 12, sy - 10);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#ffe27a';
  ctx.fillRect(x - 1, sy, 3, 5);
  ctx.fillRect(x - 3, sy + 2, 7, 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, sy + 1 + tw, 1, 2);
}

// A wreath, its middle at (x, y): a ring of fir with a red bow under it; `small` for a kennel's gable.
function wreath(ctx, x, y, small) {
  const r = small ? 2 : 3;
  ctx.fillStyle = '#1f6b3a';
  ctx.fillRect(x - r, y - r + 1, 2 * r + 1, 2 * r - 1);
  ctx.fillRect(x - r + 1, y - r, 2 * r - 1, 2 * r + 1);
  ctx.fillStyle = '#3aa05a';
  ctx.fillRect(x - r + 1, y - r, 2 * r - 2, 1);
  ctx.fillStyle = small ? '#6b4a2a' : '#7a5232';
  ctx.fillRect(x - r + 2, y - r + 2, 2 * r - 3, 2 * r - 3);
  ctx.fillStyle = '#e5484d';
  ctx.fillRect(x - 1, y + r - 1, 3, 2);
}
// On a desk with an owner (from the event's second level), by the desk's number: a mini tree, a stocking over the
// edge, or a strand of tinsel. Four rectangles at most. (x, y) is the back corner of the desk top.
function deskDecor(ctx, i, x, y) {
  const k = i % 3;
  if (k === 0) {
    ctx.fillStyle = '#2a8048';
    ctx.fillRect(x - 2, y - 3, 5, 2);
    ctx.fillRect(x - 1, y - 5, 3, 2);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x, y - 6, 1, 1);
    ctx.fillStyle = '#d94a5a';
    ctx.fillRect(x - 1, y - 1, 3, 1);
  } else if (k === 1) {
    ctx.fillStyle = '#f6f9fc';
    ctx.fillRect(x - 1, y - 4, 3, 1);
    ctx.fillStyle = '#d94a5a';
    ctx.fillRect(x - 1, y - 3, 3, 3);
    ctx.fillRect(x + 1, y - 1, 2, 1);
  } else {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x - 3, y - 2, 2, 1);
    ctx.fillRect(x + 1, y - 2, 2, 1);
    ctx.fillStyle = '#5ec8ff';
    ctx.fillRect(x - 1, y - 1, 2, 1);
  }
}
const OWNED = new Uint8Array(DESKS.length);
// Where each desk's decoration sits (x, y px) and its depth among the sprites, and the wreaths, worked out once.
const DESK_AT = new Float32Array(DESKS.length * 3);
DESKS.forEach((d, i) => {
  const [x, y] = P(d.gx + 1.55, d.gy + 0.25, 15);
  DESK_AT.set([Math.round(x), Math.round(y), d.gx + d.gy + 1.52], i * 3);
});
const WREATHS = [(([x, y]) => ({ x: Math.round(x), y: Math.round(y), z: 7.6, small: false }))(P(0, 7.05, 24))];
for (const h of DOG_HOUSES) {
  const [x, y] = PG(h.x + KENNEL.X1, h.y, 19);
  WREATHS.push({ x: Math.round(x) + 1, y: Math.round(y), z: h.x + KENNEL.X1 + h.y + KENNEL.HW + 0.02, small: true });
}

// The big tree stands indoors, in the middle of the crossing of the two corridors (EventLogic.TREE_AT).
const TREE = EventLogic.TREE_AT,
  [TX, TY] = P(TREE[0], TREE[1], 0).map(Math.round),
  [TL, TU, TR, TD] = BIG_TREE_EXT;
// Its still part (trunk, tiers, tinsel, presents), painted once per event level and light level and stamped with
// one drawImage; what blinks is drawn over it every frame (xmasTreeLights).
let treeImg = null,
  treeKey = -1;
function treeSprite(level, dfB) {
  const k = level * 100 + dfB;
  if (k === treeKey) return treeImg;
  if (!treeImg) {
    treeImg = document.createElement('canvas');
    treeImg.width = TL + TR;
    treeImg.height = TU + TD;
  }
  const g = treeImg.getContext('2d'),
    foot = [TL, TU];
  g.clearRect(0, 0, treeImg.width, treeImg.height);
  // indoors the tree keeps most of its colour after dark
  drawBigTree(
    { ctx: g },
    () => foot,
    c => night(c, 1 - (1 - dfB / 10) * 0.45),
    [0, 0],
    level,
  );
  treeKey = k;
  return treeImg;
}

mixin(
  ClaudeOffice,
  class {
    // The event's lights among the scene's sprites (ev from eventNow, never null here).
    xmasItems(G, items, ev) {
      items.push({ z: TREE[0] + TREE[1] + 0.02, f: () => this.xmasTree(G, ev) });
      for (const s of STRINGS)
        if (s.z != null && ev.level >= s.level) items.push({ z: s.z, f: () => this.xmasString(G, s.at) });
      // wreaths: on the EXIT door (in the left wall, at tile 0, 7) and over each kennel's door
      for (const w of WREATHS) items.push({ z: w.z, f: () => wreath(G.ctx, w.x, w.y, w.small) });
      // something small on every desk that has an owner (people sub-agents stand by do not own one)
      if (ev.level >= 2) {
        OWNED.fill(0);
        for (const a of this.agents) if (!a.leaving && !a.parent && a.desk >= 0) OWNED[a.desk] = 1;
        for (let i = 0; i < DESKS.length; i++)
          if (OWNED[i])
            items.push({ z: DESK_AT[i * 3 + 2], f: () => deskDecor(G.ctx, i, DESK_AT[i * 3], DESK_AT[i * 3 + 1]) });
      }
      this.cathedralItems(G, items, ev);
    }
    // The strings on the office's own walls, drawn right after the walls so everything in the room is in front.
    xmasWallLights(G, ev) {
      for (const s of STRINGS) if (s.z == null && ev.level >= s.level) this.xmasString(G, s.at);
    }
    xmasString(G, at) {
      const { ctx, t, df } = G,
        glow = glowAt(df),
        smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      drawString(ctx, at, t, glow, !!(this.env && this.env.reduced), glow > 0.01);
      ctx.imageSmoothingEnabled = smooth;
    }
    // The big tree among the office's sprites: its still part as one sprite, then its lights.
    xmasTree(G, ev) {
      G.ctx.drawImage(treeSprite(ev.level, Math.round(G.df * 10)), TX - TL, TY - TU);
      this.xmasTreeLights(G);
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
      litStar(ctx, TX, TY - BIG_TREE_TOP - 5, still ? 0 : Math.floor(t * 2) % 2, glow);
      ctx.imageSmoothingEnabled = smooth;
    }
  },
);
