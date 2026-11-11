// Winter's polar bears and their igloo on the canvas (their behaviour is web/polar-bears.js, their pixels
// web/critter-sprites.js). Each bear is one drawImage a frame from the critters' sprite cache; the igloo is painted
// once per light and kept for all islands. While the bears are about, the dogs' lawn leaves out the ring round them.
import { SkyRender } from './sky-render.js';
import { DogLogic } from './dog-logic.js';
import { PolarBears } from './polar-bears.js';
import {
  BEARS,
  DOG_PLACES,
  DOG_PLACES_WINTER,
  DOG_ROAM,
  DRAW_REACH,
  OX,
  OY,
  TH,
  TW,
  behindWalls,
} from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';

const NIGHT = '#0d1322',
  SNOW = ['#aebbd0', '#d3dbe7', '#eef2f8', '#fbfcfe'],
  JOINT = '#b4c1d5',
  HOLE = '#27304a',
  // the igloo's picture: base middle at (CX, CY), dome RX wide and HT tall, base ellipse RY deep; the tunnel to the
  // door sticks out toward the viewer's right, where the door cell is
  IW = 64,
  IH = 46,
  CX = 30,
  CY = 30,
  RX = 25,
  RY = 12,
  HT = 24,
  IGLOOS = [];

// One pixel of a snow dome centred (cx, cy): its shade (0 dark .. 3 light) or -1 outside, with the block joints.
function dome(px, py, cx, cy, rx, ry, ht, joints) {
  const dx = (px + 0.5 - cx) / rx,
    up = (cy - py - 0.5) / ht,
    down = (py + 0.5 - cy) / ry;
  const inside = up >= 0 ? dx * dx + up * up <= 1 : dx * dx + down * down <= 1;
  if (!inside) return -1;
  const v = Math.max(0, up),
    lit = -dx * 0.55 + v * 0.6 + 0.35,
    shade = lit > 0.75 ? 3 : lit > 0.45 ? 2 : lit > 0.15 ? 1 : 0;
  if (!joints || v <= 0) return shade;
  const course = Math.floor(v * 5),
    w = Math.sqrt(Math.max(0.05, 1 - v * v)),
    col = (dx / w) * 4 + (course % 2) * 0.5;
  const edgeV = Math.abs(v * 5 - Math.round(v * 5)) < 0.12,
    edgeH = Math.abs(col - Math.round(col)) < 0.09;
  return edgeV || edgeH ? 4 : shade;
}
function paintIgloo(dfB) {
  const cv = document.createElement('canvas'),
    dim = DogLogic.nightMix(dfB / 10),
    pal = [...SNOW, JOINT, HOLE].map(c => SkyRender.mix(c, NIGHT, dim));
  cv.width = IW;
  cv.height = IH;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(0,0,0,0.16)';
  c.beginPath();
  c.ellipse(CX + 3, CY + 2, RX + 3, RY + 2, 0, 0, Math.PI * 2);
  c.fill();
  const tx = CX + 15,
    ty = CY + 8;
  for (let y = 0; y < IH; y++)
    for (let x = 0; x < IW; x++) {
      // the tunnel in front of the dome, then the dome behind it
      let s = dome(x, y, tx, ty, 9, 5, 10, false);
      if (s >= 0) {
        const hx = (x + 0.5 - (tx + 3)) / 3.6,
          hy = (ty + 2 - y - 0.5) / 7;
        if (hy >= 0 && hx * hx + hy * hy <= 1 && y < ty + 4) s = 5;
      } else s = dome(x, y, CX, CY, RX, RY, HT, true);
      if (s < 0) continue;
      c.fillStyle = pal[s];
      c.fillRect(x, y, 1, 1);
    }
  return cv;
}

mixin(
  ClaudeOffice,
  class {
    // One frame of the bears' lives, on every island; and the dogs keep their distance while the bears are about.
    stepBears(dt) {
      let w = this.bearWorld;
      if (!w) {
        w = this.bearWorld = { winter: false, night: false, calm: false, now: 0, rand: Math.random };
        this.bears = PolarBears.create(BEARS);
      }
      w.winter = this.seasonNow() === 'winter';
      w.night = DogLogic.isNight(this.dogWorld.hour);
      w.calm = !!(this.env && this.env.reduced);
      PolarBears.step(this.bears, BEARS, w, dt);
      const places = w.winter ? DOG_PLACES_WINTER : DOG_PLACES;
      this.dogWorld.roam = places.roam;
      this.dogWorld.roamList = places.roamList;
      this.dogWorld.drink = places.drink;
      if (w.winter) for (const d of this.dogs) this.dogOut(d);
    }
    // A dog that stands in the ring round the bears (it was there when winter came, or the page opened with it there)
    // walks out to the nearest lawn outside it, over the whole lawn since its own ground no longer reaches it.
    dogOut(d) {
      const x = Math.floor(d.x),
        y = Math.floor(d.y);
      if (d.path.length || !BEARS.keep.has(x + ',' + y) || d.act === 'home' || d.act === 'inside') return;
      let best = null,
        bd = Infinity;
      for (const c of DOG_PLACES_WINTER.roamList) {
        const dd = Math.hypot(c[0] - x, c[1] - y);
        if (dd < bd) (bd = dd), (best = c);
      }
      const p = best ? DogLogic.path(DOG_ROAM, [x, y], best) : [];
      if (!p.length) return;
      Object.assign(d, {
        act: 'wander',
        wag: false,
        partner: null,
        lead: false,
        until: Infinity,
        speed: DogLogic.STROLL,
      });
      d.path = p.slice(1).map(c => [c[0] + 0.5, c[1] + 0.5]);
    }
    // The igloo and the bears on one side of the walls (back: those drawn before them), into the sorted list.
    bearItems(G, list, back, dfB) {
      if (!this.bears || this.bears[0].away) return;
      const ig = BEARS.igloo;
      if (behindWalls(ig.x + 1, ig.y + 1, DRAW_REACH) === back)
        list.push({ z: ig.x + ig.y + 2, f: () => this.drawIgloo(G, dfB) });
      for (const b of this.bears)
        if (behindWalls(Math.floor(b.x), Math.floor(b.y), DRAW_REACH) === back)
          list.push({ z: b.x + b.y, f: () => this.drawBear(G, b, dfB) });
    }
    drawBear(G, b, dfB) {
      const p = PolarBears.pose(b, G.t),
        img = this.critterSprite(b.kind, p.frame, dfB, false, p.flip);
      G.ctx.drawImage(img, Math.round(OX + (b.x - b.y) * TW) - img.ax, Math.round(OY + (b.x + b.y) * TH) - img.fh);
    }
    drawIgloo(G, dfB) {
      const ig = BEARS.igloo,
        img = IGLOOS[dfB] || (IGLOOS[dfB] = paintIgloo(dfB));
      G.ctx.drawImage(img, Math.round(OX + (ig.x - ig.y) * TW) - CX, Math.round(OY + (ig.x + ig.y + 2) * TH) - CY);
    }
  },
);
