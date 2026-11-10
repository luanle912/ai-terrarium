// Drawing the dogs' houses on the lawn along the restroom block's east wall (DOG_HOUSES in web/office-scene.js).
import { SkyRender } from './sky-render.js';
import { DogSprites } from './dog-sprites.js';
import { PG, DOG_HOUSES, FLOOR_Z, mix } from './office-scene.js';
import { shade } from './office-util.js';
import { SnowLogic } from './snow-logic.js';
import { snowTones } from './office-draw-winter.js';
import { ClaudeOffice, mixin } from './office.js';

// One roof colour per dog, in DogLogic.BREEDS order: the corgi's red, the husky's blue, the dalmatian's green.
const ROOF = ['#c8553d', '#3e6fb0', '#3f8f5a'];
const WOOD = '#c99a62',
  STONE = '#9a8f80',
  TRIM = '#efe6d4',
  HOLE = '#1d1712';
// The body's depth (from the wall, x) and half width (y) in tiles; base, wall, eave and ridge heights in px; the roof's
// overhang; the door's half width (tiles) and height (px, from the base).
const X0 = 0.08,
  X1 = 0.9,
  HW = 0.36,
  ZB = 2,
  ZW = 14,
  ZE = 13,
  ZR = 26,
  OV = 0.07,
  DW = 0.18,
  DH = 10;
// for whatever hangs on a kennel's gable (the event's lights, web/office-draw-xmas.js)
export const KENNEL = { X1, HW, OV, ZE, ZR };
// Where a frame's head is: the middle column (hc) and top row (ht) of what is drawn in its top three rows.
const headOf = f => {
  const cols = [];
  let ht = -1;
  f.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      if (ht < 0) ht = y;
      if (y < ht + 3) cols.push(x);
    }),
  );
  return { hc: Math.round((Math.min(...cols) + Math.max(...cols)) / 2), ht };
};
const Q = (pts, k) => pts.map(p => [Math.round(p[0]), Math.round(p[1])])[k];

mixin(
  ClaudeOffice,
  class {
    // A wooden kennel per dog on a stone base: plank walls, a gabled roof shingled in the dog's colour with white
    // bargeboards, an arched door toward the viewer (+x) with a cushion inside and a paw plaque over it, and the dog's
    // bowl by the door. A dog at home (DogLogic 'inside') lies inside, head up in the doorway. A lantern on the block's
    // wall over the row glows after dark.
    doghouseItems(G, items, snow, dfB, snB) {
      const { ctx, poly, t, df } = G,
        N = c => SkyRender.night(c, df),
        dogs = this.dogs || [],
        sd = SnowLogic.depth(snow),
        // a face with a dark pixel edge, like the scene's other props
        face = (pts, col) => poly(pts, col, shade(col, -48)),
        flat = (pts, col) => poly(pts, col, null);
      DOG_HOUSES.forEach((h, i) => {
        // local frame: depth d out from the wall (+x, toward the door), w along it (+y); xa..xb is the depth, ya..yb
        // the width
        const L = (d, w, z) => PG(h.x + d, h.y + w, z),
          xa = X0,
          xb = X1,
          yc = 0,
          ya = -HW,
          yb = HW,
          roof = N(mix(ROOF[i], '#eef3f7', snow * 0.2)),
          wood = N(WOOD),
          stone = N(STONE),
          dog = dogs.find(d => d.id === i && d.act === 'inside');
        // a quad on the plane depth = X across y0..y1 and z0..z1, or on the plane across = Y over depths x0..x1
        const onX = (X, y0, y1, z0, z1) => [L(X, y0, z0), L(X, y1, z0), L(X, y1, z1), L(X, y0, z1)],
          onY = (Y, x0, x1, z0, z1) => [L(x0, Y, z0), L(x1, Y, z0), L(x1, Y, z1), L(x0, Y, z1)];
        // the door's arch on the gable (x = xb), half width w tiles, hh px above the base
        const arch = (w, hh) => {
          const pts = [];
          for (let k = 0; k <= 8; k++) {
            const a = (Math.PI * k) / 8;
            pts.push(L(xb, yc + w * Math.cos(a), ZB + hh - w * 18 + w * 18 * Math.sin(a)));
          }
          return [...pts, L(xb, yc - w, ZB), L(xb, yc + w, ZB)];
        };
        // a 1 px line across the gable at height z, only as wide as the gable is there
        const gableLine = z => {
          const k = z <= ZW ? 0 : (z - ZW) / (ZR - 1 - ZW);
          flat(onX(xb, ya + k * HW, yb - k * HW, z, z + 1), shade(wood, -45));
        };
        items.push({
          z: h.x + X1 + h.y + HW,
          f: () => {
            // contact shadow on the grass
            flat(
              [L(xa, ya, 0), L(xb + 0.16, ya, 0), L(xb + 0.16, yb + 0.14, 0), L(xa, yb + 0.14, 0)],
              'rgba(18,28,12,0.22)',
            );
            // stone base
            face(onY(yb + 0.03, xa, xb + 0.03, 0, ZB), shade(stone, -10));
            face(onX(xb + 0.03, ya, yb + 0.03, 0, ZB), shade(stone, -28));
            // far roof slope, then the side wall (+y) and the gable end (+x), each in planks
            face(
              [L(xa - OV, yc, ZR), L(xb + OV, yc, ZR), L(xb + OV, ya - OV, ZE), L(xa - OV, ya - OV, ZE)],
              shade(roof, -30),
            );
            face(onY(yb, xa, xb, ZB, ZW), shade(wood, -8));
            for (const z of [5, 8, 11]) flat(onY(yb, xa, xb, z, z + 1), shade(wood, -26));
            face([L(xb, ya, ZB), L(xb, yb, ZB), L(xb, yb, ZW), L(xb, yc, ZR - 1), L(xb, ya, ZW)], shade(wood, -26));
            [5, 8, 11, 17, 21].forEach(gableLine);
            // door: a dark frame, the opening, and the cushion on its floor in a pale roof colour
            flat(arch(DW + 0.04, DH + 1.5), N('#6b4a2a'));
            const door = arch(DW, DH);
            flat(door, N(HOLE));
            flat(onX(xb, yc - DW, yc + DW, ZB, ZB + 1.5), N(mix(ROOF[i], '#ffffff', 0.35)));
            // near roof slope with rows of shingles, the ridge cap and white bargeboards over the gable
            face([L(xa - OV, yb + OV, ZE), L(xb + OV, yb + OV, ZE), L(xb + OV, yc, ZR), L(xa - OV, yc, ZR)], roof);
            this.doghouseShingles(ctx, L, xa - OV, xb + OV, yc, yb + OV, shade(roof, -26));
            flat(
              [
                L(xa - OV, yc, ZR + 0.5),
                L(xb + OV, yc, ZR + 0.5),
                L(xb + OV, yc + 0.04, ZR - 1.5),
                L(xa - OV, yc + 0.04, ZR - 1.5),
              ],
              shade(roof, -45),
            );
            // snow lying on the near slope, from the ridge most of the way down, thicker with the depth
            if (sd) {
              const T = snowTones(df),
                at = (x, f, up) => L(x, yc + (yb + OV - yc) * f, ZR - (ZR - ZE) * f + up);
              flat(
                [
                  at(xa - OV, 0, sd + 1),
                  at(xb + OV, 0, sd + 1),
                  at(xb + OV, 0.62, sd),
                  at((xa + xb) / 2, 0.74, sd),
                  at(xa - OV, 0.6, sd),
                ],
                T.lit,
              );
              flat([at(xb + OV, 0, sd + 1), at(xb + OV, 0.62, sd), at(xb + OV, 0.62, 0), at(xb + OV, 0, 0)], T.shade);
            }
            for (const ye of [ya - OV, yb + OV])
              flat([L(xb + OV, ye, ZE), L(xb + OV, yc, ZR), L(xb + OV, yc, ZR - 2), L(xb + OV, ye, ZE - 2)], N(TRIM));
            // the paw plaque over the door
            flat(onX(xb, yc - 0.08, yc + 0.08, ZB + DH + 3, ZB + DH + 7), N(TRIM));
            const [px, py] = Q([L(xb, yc, ZB + DH + 5)], 0);
            ctx.fillStyle = shade(roof, -20);
            ctx.fillRect(px, py, 1, 1);
            ctx.fillRect(px - 1, py - 1, 1, 1);
            ctx.fillRect(px + 1, py - 1, 1, 1);
            this.doghouseBowl(ctx, L(xb + 0.26, yb - 0.02, 0), roof, N);
            if (i === 0) this.doghouseBone(ctx, L(xb + 0.35, ya - 0.05, 0), N(TRIM));
            if (dog) {
              this.doghouseSleeper(ctx, dog, door, L(xb, yc, ZB), dfB, snB);
              if (dog.nap) this.doghouseZs(ctx, L(xb, yc, ZR + 2), t + i * 0.7, N('#e8ecf5'));
            }
          },
        });
      });
      // a lantern on the restroom block's east wall between the first two houses, glowing warm after dark
      const [a, b] = DOG_HOUSES,
        at = a && b && PG(a.x + 0.02, (a.y + b.y) / 2, FLOOR_Z + 30);
      if (at) items.push({ z: a.x + (a.y + b.y) / 2, f: () => this.doghouseLantern(ctx, at, df, t, N) });
    }
    // Rows of shingles on the near slope: lines along the roof and short joints staggered between them.
    doghouseShingles(ctx, L, x0, x1, yc, ye, col) {
      ctx.fillStyle = col;
      [1 / 4, 2 / 4, 3 / 4].forEach((f, r) => {
        const y = ye + (yc - ye) * f,
          z = ZE + (ZR - ZE) * f,
          [ax, ay] = L(x0, y, z),
          [bx, by] = L(x1, y, z),
          n = Math.round(Math.abs(bx - ax));
        for (let k = 0; k <= n; k++) {
          const x = Math.round(ax + ((bx - ax) * k) / n),
            yy = Math.round(ay + ((by - ay) * k) / n);
          ctx.fillRect(x, yy, 1, 1);
          // a joint every 4 px, half a shingle along on every other row
          if (k > 1 && k < n - 1 && (k + r * 2) % 4 === 0) ctx.fillRect(x, yy - 2, 1, 2);
        }
      });
    }
    // The dog lying inside its house, head up in the doorway looking out (sprites face right, out of the door):
    // only what the opening shows is drawn. Its 'lie' frame always, which has the head up; the z's
    // over the roof tell when it sleeps.
    doghouseSleeper(ctx, d, door, [bx, by], dfB, snB) {
      const f = DogSprites.frame(d.breed, 'lie'),
        img = this.dogSprite(d.breed, 'lie', dfB, snB),
        { hc, ht } = headOf(f),
        left = Math.round(bx) - hc,
        top = Math.round(by) - DH + 2 - ht;
      ctx.save();
      ctx.beginPath();
      door.forEach((_, k) => (k ? ctx.lineTo(...Q(door, k)) : ctx.moveTo(...Q(door, k))));
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, left, top);
      ctx.restore();
    }
    // A small bowl in the roof's colour with kibble in it.
    doghouseBowl(ctx, [x, y], col, N) {
      x = Math.round(x);
      y = Math.round(y);
      ctx.fillStyle = 'rgba(18,28,12,0.25)';
      ctx.fillRect(x - 3, y, 7, 1);
      ctx.fillStyle = shade(col, -25);
      ctx.fillRect(x - 3, y - 2, 7, 2);
      ctx.fillStyle = col;
      ctx.fillRect(x - 3, y - 3, 7, 1);
      ctx.fillStyle = N('#8a5a2b');
      ctx.fillRect(x - 2, y - 3, 5, 1);
      ctx.fillStyle = N('#b07a3e');
      ctx.fillRect(x - 1, y - 4, 2, 1);
    }
    // A chew bone on the grass.
    doghouseBone(ctx, [x, y], col) {
      x = Math.round(x);
      y = Math.round(y);
      ctx.fillStyle = 'rgba(18,28,12,0.25)';
      ctx.fillRect(x - 3, y + 1, 7, 1);
      ctx.fillStyle = col;
      ctx.fillRect(x - 2, y - 1, 5, 1);
      for (const dx of [-3, 3]) {
        ctx.fillRect(x + dx, y - 2, 1, 1);
        ctx.fillRect(x + dx, y, 1, 1);
      }
      ctx.fillStyle = shade(col, -30);
      ctx.fillRect(x - 2, y, 5, 1);
    }
    // A small lantern on a bracket, and after dark a warm glow round it.
    doghouseLantern(ctx, [x, y], df, t, N) {
      x = Math.round(x);
      y = Math.round(y);
      const glow = df < 0.6 ? 1 - df / 0.6 : 0;
      if (glow > 0.01) {
        const smooth = ctx.imageSmoothingEnabled,
          g = ctx.createRadialGradient(x + 3, y + 4, 0, x + 3, y + 4, 22);
        g.addColorStop(0, 'rgba(255,214,140,0.55)');
        g.addColorStop(1, 'rgba(255,214,140,0)');
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = glow * (0.94 + 0.06 * Math.sin(t * 0.7));
        ctx.fillStyle = g;
        ctx.fillRect(x - 19, y - 18, 44, 44);
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = smooth;
      }
      const iron = N('#2f3440'),
        glass = glow > 0.01 ? '#ffe7a3' : N('#d9c99a');
      // the arm out from the wall, the cap, the glass between two posts and the base
      ctx.fillStyle = iron;
      ctx.fillRect(x - 2, y - 1, 4, 1);
      ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillRect(x, y + 1, 3, 1);
      ctx.fillRect(x - 1, y + 2, 5, 1);
      ctx.fillRect(x - 1, y + 3, 1, 4);
      ctx.fillRect(x + 3, y + 3, 1, 4);
      ctx.fillRect(x - 1, y + 7, 5, 1);
      ctx.fillStyle = glass;
      ctx.fillRect(x, y + 3, 3, 4);
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
