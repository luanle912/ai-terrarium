// The Christmas event on what is drawn every frame: the bulbs and the star of the big tree and, after dark, their
// glow. The still pieces are baked (web/island-art-xmas.js). A bulb is one rectangle; a glow is a small sprite made
// once per colour and stamped, never a gradient made in the frame.
import { EventLogic } from './event-logic.js';
import { BIG_TREE_BULBS, BIG_TREE_EXT, BIG_TREE_TOP, drawBigTree } from './island-art-xmas.js';
import { PAVILION, night } from './island-art.js';
import { KENNEL } from './office-draw-doghouse.js';
import { DOORS, WALLS } from './office-instances.js';
import { DESKS, DOG_HOUSES, ISLAND, P, PG, SMOKE, WC } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';
import { Paint } from './paint.js';

const EMPTY = Object.freeze([]);
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

// Where a point on an outer wall (x, y on the floor) sorts among the scene's sprites: null on the office's own walls
// (drawn right after them, web/office-draw.js); first of all on the restroom's back wall (restroomItems draws it at
// once, before every sprite); on its front and east walls just after the wall piece it hangs on, tiled as
// restroomItems tiles them (a piece per tile, a doorway's lintel with its door).
function wallDepth(w, x, y) {
  if (w.id.startsWith('office.')) return null;
  if (w.face === 'back') return -Infinity;
  if (w.face === 'front') {
    const d = WC.doors.find(d => x >= d.x0 && x < d.x1);
    return (d ? (d.x0 + d.x1) / 2 : Math.max(WC.x0, Math.floor(x)) + 0.5) + WC.front + 0.01;
  }
  const ya = y < WC.y0 + 1 ? WC.walls.east.y0 : Math.floor(y);
  return WC.x1 + Math.max(ya, WC.y0) + 0.41;
}
// The garland's droop between fixings (px down), one step per tuft, and its colours (fir, a lighter fir, the bow).
const SWAG = [0, 1, 2, 2, 1];
const GARLAND = ['#1f6b3a', '#2f8a4c', '#d94a5a'];

// The strings of lights, laid out once: each { label: the label it hangs on ('wall.outer', 'kennel', 'pergola',
// 'pavilion'), id, inst: the instance, at: Float32Array of bulbs x, y, fir: the garland's tufts x, y (walls only),
// z: its depth among the scene's sprites (null: on the office's own walls, drawn right after them) }. A wall's string
// is cut where the restroom block draws its walls tile by tile, one piece per tile with the tile's depth. In all
// never more than EventLogic.MAX_BULBS: the kennels, the pergola and the pavilion keep their strings and the outer
// walls share what is left (less SPARE) by their length.
export const STRINGS = [];
const SPARE = 4;
{
  // a slight sag between fixings, so the line is not ruler-straight
  const string = (pts, gap, max) => {
    const at = EventLogic.lightString(pts, gap, max);
    for (let i = 0; i < at.length / 2; i++) at[i * 2 + 1] = Math.round(at[i * 2 + 1] + (i % 3 === 1 ? 1 : 0));
    for (let i = 0; i < at.length; i += 2) at[i] = Math.round(at[i]);
    return at;
  };
  const add = (label, id, inst, at, z) => STRINGS.push({ label, id, inst, at, fir: null, z });
  // along each kennel's gable, eave to ridge to eave
  const { X1, HW, OV, ZE, ZR } = KENNEL;
  DOG_HOUSES.forEach((h, i) => {
    const L = (w, z) => PG(h.x + X1 + OV, h.y + w, z);
    const at = string([L(-HW - OV, ZE - 2), L(0, ZR - 2), L(HW + OV, ZE - 2)], 6, 5);
    add('kennel', 'kennel.' + i, h, at, h.x + X1 + h.y + HW + 0.01);
  });
  // under the pergola's front beam
  const beam = [PG(SMOKE.x + 0.95, SMOKE.y + 1.1, 35), PG(SMOKE.x + 4.0, SMOKE.y + 1.1, 35)];
  add('pergola', 'pergola', SMOKE, string(beam, 8, 7), SMOKE.x + SMOKE.y + 2.11);
  // round the two near eaves of the pavilion's lower roof
  const pv = ISLAND.pavilion;
  if (pv) {
    const r = PAVILION.r.eave,
      z = PAVILION.z.eave - 1,
      c = pv.pillar,
      eaves = [
        PG(c.x + 0.5 - r, c.y + 0.5 + r, z),
        PG(c.x + 0.5 + r, c.y + 0.5 + r, z),
        PG(c.x + 0.5 + r, c.y + 0.5 - r, z),
      ];
    add('pavilion', 'pavilion', pv, string(eaves, 7, 8), c.x + c.y + 1.01);
  }
  // under the cap of every outer wall, the office's and the restroom block's, a garland with the bulbs on it
  const outer = WALLS.filter(w => w.kind === 'outer'),
    run = w => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]),
    total = outer.reduce((n, w) => n + run(w), 0),
    budget = EventLogic.MAX_BULBS - SPARE - STRINGS.reduce((n, s) => n + s.at.length / 2, 0);
  for (const w of outer) {
    const len = run(w),
      ux = (w.b[0] - w.a[0]) / len,
      uy = (w.b[1] - w.a[1]) / len,
      // the face the camera sees, 0.3 in from each end
      ox = w.face === 'east' ? w.t : 0,
      oy = w.face === 'front' ? w.t : 0,
      A = [w.a[0] + ox + ux * 0.3, w.a[1] + oy + uy * 0.3],
      B = [w.b[0] + ox - ux * 0.3, w.b[1] + oy - uy * 0.3],
      line = [P(A[0], A[1], w.z1 - 4), P(B[0], B[1], w.z1 - 4)],
      at = string(line, 4, Math.floor((budget * len) / total)),
      fir = EventLogic.lightString(line, 4, 999);
    for (let i = 0; i < fir.length; i += 2) {
      fir[i] = Math.round(fir[i]);
      fir[i + 1] = Math.round(fir[i + 1] + SWAG[(i >> 1) % SWAG.length]);
    }
    // each point's depth, from where it stands along the wall; one piece per run of equal depths
    const pieces = new Map(),
      cut = (list, key) => {
        const n = list.length / 2;
        for (let i = 0; i < n; i++) {
          const f = (i + 0.5) / n,
            z = wallDepth(w, A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f);
          if (!pieces.has(z)) pieces.set(z, { at: [], fir: [] });
          pieces.get(z)[key].push(list[i * 2], list[i * 2 + 1]);
        }
      };
    cut(at, 'at');
    cut(fir, 'fir');
    for (const [z, p] of pieces)
      STRINGS.push({
        label: 'wall.outer',
        id: w.id,
        inst: w,
        at: new Float32Array(p.at),
        fir: new Float32Array(p.fir),
        z,
      });
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
export function wreath(ctx, x, y, small) {
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
// On every desk, someone at it or not, by the desk's number: a mini tree, a stocking over the edge, or a strand of
// tinsel. Four rectangles at most. (x, y) is the back corner of the desk top.
export function deskDecor(ctx, i, x, y) {
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
// Where a desk's decoration sits, off the desk's cell (gx, gy) and up from the floor, and the EXIT door's wreath,
// in the scene (P).
export const DECOR_SPOT = [1.55, 0.25, 15],
  WREATH_SPOT = DOORS.find(d => d.kind === 'exit').at;
// Where each desk's decoration sits (x, y px) and its depth among the sprites, worked out once.
const DESK_AT = new Float32Array(DESKS.length * 3);
DESKS.forEach((d, i) => {
  const [x, y] = P(d.gx + DECOR_SPOT[0], d.gy + DECOR_SPOT[1], DECOR_SPOT[2]);
  DESK_AT.set([Math.round(x), Math.round(y), d.gx + d.gy + 1.52], i * 3);
});
// Every door's wreath, worked out once: { door, x, y (its middle, px), z, small }. The EXIT's on its leaf, a restroom
// door's on the wall over the doorway, just after the door (restroomItems sorts it at its middle + the front), a
// kennel's small one on the gable over the house's door.
export const WREATHS = DOORS.map(door => {
  const [ax, ay, az] = door.at;
  if (door.kind === 'kennel') {
    const [x, y] = PG(ax + KENNEL.X1, ay, 19);
    return { door, x: Math.round(x) + 1, y: Math.round(y), z: ax + KENNEL.X1 + ay + KENNEL.HW + 0.02, small: true };
  }
  const [x, y] = P(ax, ay, az);
  const z = door.kind === 'wc' ? ax + WC.front + 0.01 : ax + ay + 0.55;
  return { door, x: Math.round(x), y: Math.round(y), z, small: false };
});

// A garland's tufts (fir: x, y px) in the light of dfB (0..10): a tuft of fir each, a red bow at every fixing.
const GARLAND_AT = [];
function drawGarland(ctx, fir, dfB) {
  const tone = GARLAND_AT[dfB] || (GARLAND_AT[dfB] = GARLAND.map(c => treeNight(c, dfB)));
  for (let i = 0; i < fir.length; i += 2) {
    ctx.fillStyle = tone[(i >> 1) & 1];
    ctx.fillRect(fir[i] - 2, fir[i + 1] - 1, 4, 2);
  }
  ctx.fillStyle = tone[2];
  for (let i = 0; i < fir.length; i += 2 * SWAG.length) ctx.fillRect(fir[i] - 1, fir[i + 1] - 1, 2, 2);
}

// The painters of what the event lays on the office's labels (web/paint.js), each on one instance: a wall piece's
// garland and lights, a string's lights, a door's wreath, a desk's decoration.
const lights = (host, G, inst, s) => host.xmasString(G, s.at);
Paint.overlay('wall.outer', 'garland', (host, G, wall, s) => drawGarland(G.ctx, s.fir, Math.round(G.df * 10)));
Paint.overlay('wall.outer', 'lights', lights);
Paint.overlay('kennel', 'lights', (...a) => lights(...a));
Paint.overlay('pergola', 'lights', (...a) => lights(...a));
Paint.overlay('pavilion', 'lights', (...a) => lights(...a));
Paint.overlay('door', 'wreath', (host, G, door, w) => wreath(G.ctx, w.x, w.y, w.small));
Paint.overlay('desk', 'xmas-desk', (host, G, desk, i) => deskDecor(G.ctx, i, DESK_AT[i * 3], DESK_AT[i * 3 + 1]));

// Indoors the big tree keeps most of its colour after dark: colour c at light level dfB (0..10).
export const treeNight = (c, dfB) => night(c, 1 - (1 - dfB / 10) * 0.45);
// The big tree stands indoors, in the middle of the crossing of the two corridors (EventLogic.TREE_AT).
const TREE = EventLogic.TREE_AT,
  [TX, TY] = P(TREE[0], TREE[1], 0).map(Math.round),
  [TL, TU, TR, TD] = BIG_TREE_EXT;
// Its still part (trunk, tiers, tinsel, presents), painted once per gift count (Look.build('gifts')) and light level
// and stamped with one drawImage; what blinks is drawn over it every frame (xmasTreeLights).
let treeImg = null,
  treeKey = -1;
function treeSprite(gifts, dfB) {
  const k = gifts * 100 + dfB;
  if (k === treeKey) return treeImg;
  if (!treeImg) {
    treeImg = document.createElement('canvas');
    treeImg.width = TL + TR;
    treeImg.height = TU + TD;
  }
  const g = treeImg.getContext('2d'),
    foot = [TL, TU];
  g.clearRect(0, 0, treeImg.width, treeImg.height);
  drawBigTree(
    { ctx: g },
    () => foot,
    c => treeNight(c, dfB),
    [0, 0],
    gifts,
  );
  treeKey = k;
  return treeImg;
}

mixin(
  ClaudeOffice,
  class {
    // What the look lays on the labels among the scene's sprites (the overlays of every instance: the strings off
    // the office's own walls, every door's wreath, every desk's decoration), then the event's big tree and its
    // landmark. G.look says what, the big tree's presents too (build('gifts')); ev is still the landmark's.
    xmasItems(G, items, ev) {
      const look = G.look;
      if (look.has('tree.big'))
        items.push({ z: TREE[0] + TREE[1] + 0.02, f: () => this.xmasTree(G, look.build('gifts')) });
      for (const s of STRINGS) {
        const fs = s.z === null ? EMPTY : Paint.overlaysOf(s.label, look);
        if (fs.length) items.push({ z: s.z, f: () => fs.forEach(f => f(this, G, s.inst, s)) });
      }
      const doors = Paint.overlaysOf('door', look);
      if (doors.length)
        for (const w of WREATHS) items.push({ z: w.z, f: () => doors.forEach(f => f(this, G, w.door, w)) });
      const desks = Paint.overlaysOf('desk', look);
      if (desks.length)
        for (let i = 0; i < DESKS.length; i++)
          items.push({ z: DESK_AT[i * 3 + 2], f: () => desks.forEach(f => f(this, G, DESKS[i], i)) });
      this.cathedralItems(G, items, ev);
    }
    // What the look lays on the office's own walls, drawn right after them so everything in the room is in front.
    xmasWallLights(G) {
      for (const s of STRINGS)
        if (s.z === null) for (const f of Paint.overlaysOf(s.label, G.look)) f(this, G, s.inst, s);
    }
    xmasString(G, at) {
      const { ctx, t, df } = G,
        glow = glowAt(df),
        smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      drawString(ctx, at, t, glow, !!(this.env && this.env.reduced), glow > 0.01);
      ctx.imageSmoothingEnabled = smooth;
    }
    // The big tree among the office's sprites with `gifts` presents: its still part as one sprite, then its lights.
    xmasTree(G, gifts) {
      G.ctx.drawImage(treeSprite(gifts, Math.round(G.df * 10)), TX - TL, TY - TU);
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
