// Drawing the dogs' houses on the lawn beside the restroom block (DOG_HOUSES in web/office-scene.js).
import { SkyRender } from './sky-render.js';
import { DogSprites } from './dog-sprites.js';
import { PG, DOG_HOUSES, mix } from './office-scene.js';
import { shade } from './office-util.js';
import { ClaudeOffice, mixin } from './office.js';

// One roof colour per dog, in DogLogic.BREEDS order: the corgi's red, the husky's blue, the dalmatian's green.
const ROOF = ['#c8553d', '#3e6fb0', '#3f8f5a'];
const WOOD = '#c9a06a';
// Body inset from the tile's edges, wall and ridge heights (px), the roof's overhang, the door's half width (tiles)
// and its height (px).
const IN = 0.13,
  ZW = 10,
  ZR = 18,
  OV = 0.07,
  DW = 0.17,
  DH = 8;

mixin(
  ClaudeOffice,
  class {
    // A wooden kennel per dog with a gabled roof in its colour and an arched door toward the viewer (+x). A dog inside
    // (DogLogic 'inside') is drawn curled up in the doorway, with a few z's over the roof at night.
    doghouseItems(G, items, snow, dfB, snB) {
      const { ctx, poly, t, df } = G,
        N = c => SkyRender.night(c, df),
        dogs = this.dogs || [];
      DOG_HOUSES.forEach((h, i) => {
        const x0 = h.x + IN,
          x1 = h.x + 1 - IN,
          y0 = h.y + IN,
          y1 = h.y + 1 - IN,
          ym = (y0 + y1) / 2,
          roof = N(mix(ROOF[i], '#eef3f7', snow * 0.8)),
          wood = N(WOOD),
          dog = dogs.find(d => d.id === i && d.act === 'inside');
        items.push({
          z: h.x + h.y + 1,
          f: () => {
            // far roof slope, side wall (+y), gable end (+x), near roof slope
            poly(
              [PG(x0 - OV, ym, ZR), PG(x1 + OV, ym, ZR), PG(x1 + OV, y0 - OV, ZW - 1), PG(x0 - OV, y0 - OV, ZW - 1)],
              shade(roof, -30),
              null,
            );
            poly([PG(x0, y1, 0), PG(x1, y1, 0), PG(x1, y1, ZW), PG(x0, y1, ZW)], shade(wood, -18), null);
            poly(
              [PG(x1, y0, 0), PG(x1, y1, 0), PG(x1, y1, ZW), PG(x1, ym, ZR - 1), PG(x1, y0, ZW)],
              shade(wood, -34),
              null,
            );
            // boards: a darker line every few px up the side wall
            ctx.fillStyle = shade(wood, -30);
            for (const z of [3, 6]) {
              const [ax, ay] = PG(x0, y1, z),
                [bx] = PG(x1, y1, z);
              for (let px = Math.round(ax); px < Math.round(bx); px++)
                ctx.fillRect(px, Math.round(ay + (px - ax) / 2), 1, 1);
            }
            const door = [];
            for (let k = 0; k <= 6; k++) {
              const a = (Math.PI * k) / 6;
              door.push(PG(x1, ym + DW * Math.cos(a), DH - 3 + 3 * Math.sin(a)));
            }
            door.push(PG(x1, ym - DW, 0), PG(x1, ym + DW, 0));
            poly(door, N('#1d1712'), null);
            if (dog) this.doghouseSleeper(G, dog, door, PG(x1, ym, 0), dfB, snB);
            poly(
              [PG(x0 - OV, y1 + OV, ZW - 1), PG(x1 + OV, y1 + OV, ZW - 1), PG(x1 + OV, ym, ZR), PG(x0 - OV, ym, ZR)],
              roof,
              null,
            );
            // the roof's edge over the gable, and a light ridge
            poly([PG(x1 + OV, y1 + OV, ZW - 1), PG(x1 + OV, ym, ZR), PG(x1 + OV, ym, ZR - 2)], shade(roof, -45), null);
            poly([PG(x1 + OV, y0 - OV, ZW - 1), PG(x1 + OV, ym, ZR), PG(x1 + OV, ym, ZR - 2)], shade(roof, -45), null);
            poly(
              [PG(x0 - OV, ym, ZR), PG(x1 + OV, ym, ZR), PG(x1 + OV, ym, ZR + 1), PG(x0 - OV, ym, ZR + 1)],
              shade(roof, 25),
              null,
            );
            if (dog && df < 0.5) this.doghouseZs(ctx, PG(x1, ym, ZR + 2), t + i * 0.7, N('#e8ecf5'));
          },
        });
      });
    }
    // The dog curled up asleep, seen through the door: its sleep frame, clipped to the opening.
    doghouseSleeper(G, d, door, [bx, by], dfB, snB) {
      const { ctx } = G,
        f = DogSprites.frame(d.breed, 'sleep'),
        img = this.dogSprite(d.breed, 'sleep', dfB, snB);
      ctx.save();
      ctx.beginPath();
      door.forEach(([x, y], k) =>
        k ? ctx.lineTo(Math.round(x), Math.round(y)) : ctx.moveTo(Math.round(x), Math.round(y)),
      );
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, Math.round(bx) - f.ax, Math.round(by) - f.h + 1);
      ctx.restore();
    }
    // Three small z's drifting up and fading, one after another.
    doghouseZs(ctx, [sx, sy], t, col) {
      ctx.fillStyle = col;
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.35 + k / 3) % 1,
          x = Math.round(sx + p * 4),
          y = Math.round(sy - 6 - p * 21);
        ctx.globalAlpha = Math.min(1, (1 - p) * 1.6);
        ctx.fillRect(x, y, 5, 1);
        for (let j = 1; j < 4; j++) ctx.fillRect(x + 4 - j, y + j, 1, 1);
        ctx.fillRect(x, y + 4, 5, 1);
      }
      ctx.globalAlpha = 1;
    }
  },
);
