// The Christmas critters on the canvas (their behaviour is web/event-critters.js, their pixels
// web/critter-sprites.js). Every critter is one drawImage a frame: its sprite, its shadow and the night's dimming
// are painted once per (kind, frame, light, facing) and kept for all islands. The pile of presents by the front
// stairs is one sprite too. The sleigh flies on the sky canvas behind the island; what it drops comes down on the
// one in front.
import { SkyRender } from './sky-render.js';
import { DogLogic } from './dog-logic.js';
import { CritterSprites } from './critter-sprites.js';
import { EventCritters } from './event-critters.js';
import { WATER_Z } from './island-land.js';
import { glowAt, glowSprite } from './office-draw-xmas.js';
import { CRITTER_PLACES, DRAW_REACH, LW, OX, OY, TH, TW, behindWalls } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';

const NOSE_GLOW = '#ff4d4d',
  NIGHT = '#0d1322',
  FLOATING = { sleigh: true, parcel: true };
// kind -> frame -> [canvas] at index light * 4 + red * 2 + flipped
const SPRITES = new Map();
function paint(kind, name, dfB, red, flip) {
  const f = CritterSprites.frame(kind, name),
    K = CritterSprites.KINDS[kind],
    pal = red ? { ...K.pal, ...CritterSprites.RUDOLPH } : K.pal,
    cv = document.createElement('canvas'),
    dim = DogLogic.nightMix(dfB / 10),
    pad = K.outline ? 1 : 0; // white on snow needs a thin edge to be seen
  cv.width = f.w + 2 * pad;
  cv.height = f.h + 2 + pad;
  const c = cv.getContext('2d');
  c.translate(pad, pad);
  if (flip) {
    c.translate(f.w, 0);
    c.scale(-1, 1);
  }
  if (!FLOATING[kind] || name === 'box') {
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath();
    c.ellipse(f.ax + 0.5, f.h, Math.max(2, f.w / 2 - 1), 1.6, 0, 0, Math.PI * 2);
    c.fill();
  }
  cv.nx = -1;
  if (pad) {
    const on = (x, y) => y >= 0 && y < f.h && x >= 0 && x < f.w && f.rows[y][x] !== '.';
    c.fillStyle = SkyRender.mix(K.outline, NIGHT, dim);
    for (let y = -1; y <= f.h; y++)
      for (let x = -1; x <= f.w; x++)
        if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) c.fillRect(x, y, 1, 1);
  }
  f.rows.forEach((row, y) => {
    for (let x = 0; x < f.w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      c.fillStyle = SkyRender.mix(pal[ch], NIGHT, dim);
      c.fillRect(x, y, 1, 1);
      if (ch === 'n') {
        cv.nx = flip ? f.w - 1 - x : x;
        cv.ny = y;
      }
    }
  });
  // the column under the critter's middle, in the picture as painted
  cv.ax = pad + (flip ? f.w - 1 - f.ax : f.ax);
  cv.fh = f.h + pad;
  return cv;
}

// The pile of presents at CRITTER_PLACES.drop: up to PLACED_MAX the elves brought and LANDED_MAX from the sleigh,
// each [x, y] px from the pile's middle (y up) with its paper and ribbon; painted back to front.
const PILE = [
  [-9, 4, '#3e8ed0', '#f4f1e8'],
  [0, 5, '#c8323a', '#ffd166'],
  [8, 4, '#46a758', '#c8323a'],
  [-5, 1, '#8e4ec6', '#ffd166'],
  [5, 1, '#f5a524', '#c8323a'],
  [-12, 0, '#e93d82', '#f4f1e8'],
  [12, 0, '#12a594', '#ffd166'],
  [0, -1, '#f4f1e8', '#c8323a'],
  [-7, -2, '#c8323a', '#f4f1e8'],
];
const PILE_W = 36,
  PILE_H = 16,
  PILES = new Map();
function paintPile(n, dfB) {
  const box = CritterSprites.frame('parcel', 'box'),
    cv = document.createElement('canvas'),
    dim = DogLogic.nightMix(dfB / 10);
  cv.width = PILE_W;
  cv.height = PILE_H;
  const c = cv.getContext('2d');
  PILE.slice(0, n)
    .sort((a, b) => b[1] - a[1])
    .forEach(([px, py, paper, ribbon]) => {
      const pal = { r: paper, R: SkyRender.mix(paper, '#000000', 0.25), y: ribbon },
        x0 = PILE_W / 2 + px - box.ax,
        y0 = PILE_H - 4 - py - box.h;
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(x0 + 1, y0 + box.h, 6, 1);
      box.rows.forEach((row, y) => {
        for (let x = 0; x < box.w; x++)
          if (row[x] !== '.') {
            c.fillStyle = SkyRender.mix(pal[row[x]], NIGHT, dim);
            c.fillRect(x0 + x, y0 + y, 1, 1);
          }
      });
    });
  return cv;
}
const DROP_X = CRITTER_PLACES.drop ? OX + (CRITTER_PLACES.drop[0] - CRITTER_PLACES.drop[1]) * TW : 0,
  DROP_Y = CRITTER_PLACES.drop ? OY + (CRITTER_PLACES.drop[0] + CRITTER_PLACES.drop[1] + 1) * TH : 0;

mixin(
  ClaudeOffice,
  class {
    critterSprite(kind, name, dfB, red, flip) {
      let byName = SPRITES.get(kind);
      if (!byName) SPRITES.set(kind, (byName = new Map()));
      let at = byName.get(name);
      if (!at) byName.set(name, (at = []));
      const i = dfB * 4 + (red ? 2 : 0) + (flip ? 1 : 0);
      return at[i] || (at[i] = paint(kind, name, dfB, red, flip));
    }
    // One frame of the critters' lives. The world is made on the first call: an island of the world view only has
    // reindeer; the elves, the penguins, Santa and his sleigh belong to the viewer's own page.
    stepCritters(dt) {
      let w = this.critterWorld;
      if (!w) {
        w = this.critterWorld = {
          ...CRITTER_PLACES,
          level: 0,
          eve: false,
          day: false,
          frozen: false,
          calm: false,
          now: 0,
          rand: Math.random,
          dogs: this.dogs,
          only: this.host ? 'reindeer' : null,
        };
        this.critters = [];
      }
      const ev = this.eventNow();
      w.level = ev ? ev.level : 0;
      w.eve = !!ev && ev.eve;
      w.day = !!ev && ev.day;
      w.frozen = !!this.dogWorld.frozen;
      w.calm = !!this.dogWorld.calm;
      EventCritters.step(this.critters, w, dt);
    }
    // Adds the critters on one side of the walls (back: those drawn before the walls) to the scene's sorted list,
    // and with the front ones the pile of presents.
    critterItems(G, list, back, dfB) {
      const w = this.critterWorld;
      if (!w || !w.level) return;
      for (const c of this.critters)
        if (c.act !== 'away' && behindWalls(Math.floor(c.x), Math.floor(c.y), DRAW_REACH) === back)
          list.push({ z: c.x + c.y, f: () => this.drawCritter(G, c, dfB) });
      const n = Math.min(w.placed || 0, EventCritters.PLACED_MAX) + (w.landed || 0);
      if (!back && n && w.drop && !w.only)
        list.push({ z: w.drop[0] + w.drop[1] + 1, f: () => this.drawPile(G, w.placed || 0, w.landed || 0, dfB) });
    }
    drawCritter(G, c, dfB) {
      const p = EventCritters.pose(c, G.t),
        img = this.critterSprite(c.kind, p.frame, dfB, c.red, p.flip),
        x = Math.round(OX + (c.x - c.y) * TW) - img.ax,
        y = Math.round(OY + (c.x + c.y) * TH - (c.kind === 'penguin' ? WATER_Z : 0)) - img.fh - p.dy;
      G.ctx.drawImage(img, x, y);
      // Rudolph's nose glows after dark
      if (c.red && G.df < 0.6 && img.nx >= 0) {
        G.ctx.globalAlpha = glowAt(G.df);
        G.ctx.drawImage(this.noseGlow || (this.noseGlow = glowSprite(NOSE_GLOW, 8)), x + img.nx - 4, y + img.ny - 4);
        G.ctx.globalAlpha = 1;
      }
    }
    // The presents the elves set down come first in PILE, those from the sleigh after them.
    drawPile(G, placed, landed, dfB) {
      const n = Math.min(PILE.length, placed + landed),
        k = n * 11 + dfB;
      let img = PILES.get(k);
      if (!img) PILES.set(k, (img = paintPile(n, dfB)));
      G.ctx.drawImage(img, Math.round(DROP_X - PILE_W / 2), Math.round(DROP_Y + 4 - PILE_H));
    }
    // On the sky canvases (ctx in stage px, w × h): the sleigh crossing on the back one, behind the island, and on
    // the front one the presents it let go, coming down under their parachutes to the pile by the stairs.
    drawSleigh(ctx, back, w, h) {
      const cw = this.critterWorld;
      if (!cw || !cw.level || !cw.parcels) return;
      const k = Math.max(2, Math.round(w / 500)),
        H0 = 0.1 * h;
      if (back) {
        const s = EventCritters.sleigh(cw);
        if (!s) return;
        const dfB = Math.round(this.env.df * 10),
          img = this.critterSprite('sleigh', 'fly', dfB, false, s.dir < 0),
          sw = img.width * k,
          x = (s.dir > 0 ? s.u : 1 - s.u) * (w + sw) - sw;
        const smooth = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, Math.round(x), Math.round(H0 + Math.sin(s.u * 9) * 0.02 * h), sw, img.height * k);
        ctx.imageSmoothingEnabled = smooth; // the sky's soft clouds are drawn smoothed
        return;
      }
      const el = this.wrapEl;
      if (this.world || !el || !cw.drop || !(cw.parcels[0].on || cw.parcels[1].on)) return;
      const dfB = Math.round(this.env.df * 10),
        cam = this.cam || { z: 1, tx: 0, ty: 0 },
        sc = (el.offsetWidth / LW) * cam.z,
        X = el.offsetLeft + cam.tx + DROP_X * sc,
        Y = el.offsetTop + cam.ty + DROP_Y * sc,
        img = this.critterSprite('parcel', 'chute', dfB, false, false),
        z = Math.max(2, Math.round(sc * 2));
      for (const p of cw.parcels) {
        if (!p.on) continue;
        const f = Math.min(1, (cw.now - p.t0) / EventCritters.FALL_FOR),
          x0 = (p.dir > 0 ? p.u : 1 - p.u) * w,
          x = x0 + (X - x0) * f + Math.sin(f * 9) * 6 * (1 - f),
          y = H0 + (Y - H0) * f;
        const smooth = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, Math.round(x - img.ax * z), Math.round(y - img.fh * z), img.width * z, img.height * z);
        ctx.imageSmoothingEnabled = smooth;
      }
    }
  },
);
