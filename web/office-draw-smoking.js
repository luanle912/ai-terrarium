// Drawing the smoking corner on the east lawn.
import { SkyRender } from './sky-render.js';
import { PG, SMOKE, mix } from './office-scene.js';
import { shade } from './office-util.js';
import { ClaudeOffice, mixin } from './office.js';
mixin(
  ClaudeOffice,
  class {
    // Smoking corner beside the restroom block (SmokeLogic.layout): a stone pad, a planted trough screening it from the
    // block, a bench under a vine-covered cantilever pergola, an ash bin, and a light, an extinguisher and a sign by the
    // entrance. It all stands on the grass, so it is drawn with PG (P is lifted by the plinth) and its colours go through
    // night() and the snow cover like the rest of the island.
    smokingItems(G, items, snow) {
      const { ctx, poly, df } = G,
        X = SMOKE.x,
        Y = SMOKE.y,
        Z = X + Y,
        N = c => SkyRender.night(c, df),
        SN = (c, k) => N(mix(c, '#eef3f7', snow * k));
      const gbox = (x, y, w, hh, z0, z1, top, l, r) => {
        poly(
          [PG(x, y + hh, z0), PG(x + w, y + hh, z0), PG(x + w, y + hh, z1), PG(x, y + hh, z1)],
          l || shade(top, -22),
          null,
        );
        poly(
          [PG(x + w, y, z0), PG(x + w, y + hh, z0), PG(x + w, y + hh, z1), PG(x + w, y, z1)],
          r || shade(top, -38),
          null,
        );
        poly([PG(x, y, z1), PG(x + w, y, z1), PG(x + w, y + hh, z1), PG(x, y + hh, z1)], top, null);
      };
      const R = (x, y, w, hh, c) => {
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(x), Math.round(y), w, hh);
      };
      const wood = N('#a8763e'),
        metal = N('#3d4350'),
        leaf = SN('#3e9a45', 0.45),
        leafL = SN('#57b85a', 0.6),
        leafD = N('#2f7a36');
      // A rounded pixel shrub: lit on top, its right third in shade like every other box in the scene.
      const bush = (x, y, z, r) => {
        const [cx, cy] = PG(x, y, z);
        for (let dy = -r; dy <= r; dy++) {
          const w = Math.round(Math.sqrt(r * r - dy * dy) * 1.2),
            c = dy < -r * 0.45 ? leafL : leaf;
          R(cx - w, cy + dy, w * 2, 1, c);
          R(cx + Math.round(w * 0.3), cy + dy, Math.round(w * 0.7), 1, leafD);
        }
        R(cx - Math.round(r * 0.5), cy - Math.round(r * 0.3), 2, 1, leafL);
        R(cx - 1, cy + Math.round(r * 0.2), 2, 1, leafL);
      };
      // Stone pavers, not grass: a dropped cigarette must land on something that cannot catch fire.
      items.push({
        z: -1,
        f: () => {
          gbox(X, Y, 4, 4, 0, 0.6, SN('#a39c90', 0.8));
          for (let y = 0; y < 4; y += 0.5)
            for (let x = 0; x < 4; x += 0.5)
              poly(
                [
                  PG(X + x + 0.04, Y + y + 0.04, 0.6),
                  PG(X + x + 0.46, Y + y + 0.04, 0.6),
                  PG(X + x + 0.46, Y + y + 0.46, 0.6),
                  PG(X + x + 0.04, Y + y + 0.46, 0.6),
                ],
                SN(((x + y) * 2) % 2 ? '#c9c3b8' : '#bdb6aa', 0.8),
                null,
              );
          // after dark the entrance light leaves a warm pool on the stones, under everyone standing there
          if (df < 0.6) {
            const [lx, ly] = PG(X + 0.4, Y + 3.8, 0.6);
            ctx.globalAlpha = 0.22 * (1 - df / 0.6);
            ctx.fillStyle = '#ffd98a';
            ctx.beginPath();
            ctx.ellipse(lx, ly, 18, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        },
      });
      // The planted trough on the side facing the restroom block, about 1.2 m tall: it screens the view and breaks the drift of
      // smoke. One item per tile so it sorts between people on the lawn behind it and people in the corner.
      [0, 1, 2].forEach(r =>
        items.push({
          z: Z + 1.8 + r,
          f: () => {
            const y0 = Y + (r === 0 ? 0.1 : r),
              y1 = Y + (r === 2 ? 2.9 : r + 1);
            gbox(X + 0.1, y0, 0.45, y1 - y0, 0, 5, SN('#b9b2a3', 0.6));
            bush(X + 0.3, Y + r + 0.2, 11, r === 0 ? 5 : 6);
            bush(X + 0.36, Y + r + 0.62, 10, 7);
            if (r === 2) bush(X + 0.33, Y + 2.82, 8, 5);
          },
        }),
      );
      // Slatted bench with a backrest across the back of the corner, facing the lawn.
      items.push({
        z: Z + 2,
        f: () => {
          const bw = N('#c79a5e');
          [1.45, 2.5, 3.55].forEach(x => gbox(X + x, Y + 0.2, 0.08, 0.36, 0, 5.8, metal));
          gbox(X + 1.3, Y + 0.12, 2.5, 0.5, 5.8, 7, SN('#c79a5e', 0.7), shade(bw, -25), shade(bw, -40));
          for (let k = 1; k < 4; k++)
            poly(
              [
                PG(X + 1.3, Y + 0.12 + k * 0.125, 7),
                PG(X + 3.8, Y + 0.12 + k * 0.125, 7),
                PG(X + 3.8, Y + 0.13 + k * 0.125, 7),
                PG(X + 1.3, Y + 0.13 + k * 0.125, 7),
              ],
              shade(bw, -30),
              null,
            );
          gbox(X + 1.3, Y + 0.06, 2.5, 0.06, 7, 13, bw, shade(bw, -25), shade(bw, -40));
        },
      });
      // The pergola only roofs the bench (1.2 tiles deep) and is drawn before anyone in the corner. Deeper, its front beam
      // would cross the people on the bench; at this depth every beam and rafter projects above their heads, so drawing
      // it first never hides a face, and the floating status badges stay on top of it.
      // Posts: two at the back, one at the front on the pantry side; the front-right corner is held by a knee brace, since
      // a post there would stand right in front of the end seat. A back post sorts by its own near corner: a dog sitting
      // on the lawn just behind it (y = Y-1) must be drawn first, and nobody on the bench stands in its column.
      [1.0, 3.83].forEach(x => items.push({ z: X + x + Y + 0.12, f: () => gbox(X + x, Y, 0.12, 0.12, 0, 38, wood) }));
      items.push({
        z: Z + 2.08,
        f: () => {
          gbox(X + 1.0, Y + 1.0, 0.12, 0.12, 0, 38, wood);
          // a trellis between the two pantry-side posts, with the vine climbing it and both posts
          const tx = X + 1.06,
            bar = (y0, y1, z0, z1) =>
              poly([PG(tx, y0, z0), PG(tx, y1, z1), PG(tx, y1, z1 + 1), PG(tx, y0, z0 + 1)], shade(wood, -12), null);
          for (let z = 8; z < 36; z += 7) bar(Y + 0.12, Y + 1.0, z, z);
          for (const y of [Y + 0.4, Y + 0.72])
            poly([PG(tx, y, 0), PG(tx, y + 0.05, 0), PG(tx, y + 0.05, 36), PG(tx, y, 36)], shade(wood, -12), null);
          for (const [x, y] of [
            [X + 1.06, Y + 0.06],
            [X + 1.06, Y + 1.06],
          ])
            for (let z = 4; z < 38; z += 4) {
              const [vx, vy] = PG(x, y, z);
              R(vx - 2 + ((z >> 2) % 2) * 2, vy - 2, 3, 2, (z >> 2) % 3 ? leaf : leafD);
            }
          for (const [y, z, r] of [
            [0.35, 14, 3],
            [0.6, 24, 4],
            [0.3, 31, 3],
            [0.8, 9, 3],
          ])
            bush(tx, Y + y, z, r);
        },
      });
      items.push({
        z: Z + 2.1,
        f: () => {
          gbox(X + 0.9, Y, 3.15, 0.1, 36, 38, wood);
          gbox(X + 0.9, Y + 1.0, 3.15, 0.1, 36, 38, wood);
          {
            const bx = X + 3.89,
              brace = (y0, z0, y1, z1) =>
                poly(
                  [PG(bx, y0, z0), PG(bx, y1, z1), PG(bx, y1, z1 + 1.5), PG(bx, y0, z0 + 1.5)],
                  shade(wood, -20),
                  null,
                );
            brace(Y + 0.12, 27, Y + 0.75, 36);
          }
          // three rafters between the two outer ones, all overhanging the beams a little
          for (const x of [1.0, 1.75, 2.5, 3.25, 3.85])
            gbox(X + x, Y - 0.15, 0.07, 1.4, 38, 39.2, SN('#b98a52', 0.7), shade(wood, -10), shade(wood, -25));
          // the vine spreads over the back beam and the pantry side of the roof
          for (const [x, y, r] of [
            [1.2, 0.05, 4],
            [1.8, -0.05, 5],
            [2.5, 0.1, 4],
            [3.2, -0.05, 5],
            [3.85, 0.3, 4],
            [1.05, 0.65, 4],
            [1.15, 1.1, 4],
          ]) {
            bush(X + x, Y + y, 40.5, r);
            const [vx, vy] = PG(X + x, Y + y, 39.2);
            if (r > 4) {
              R(vx - 2, vy + 2, 1, 4, leafD);
              R(vx + 3, vy + 1, 1, 3, leafD);
            }
          }
        },
      });
      // Free-standing stainless ash bin with a sand top, between the two standing places.
      items.push({
        z: Z + 4.1,
        f: () => {
          gbox(X + 2.15, Y + 1.45, 0.26, 0.26, 0, 9, N('#c9d3e3'), N('#9aa6bd'), N('#7d889c'));
          gbox(X + 2.18, Y + 1.48, 0.2, 0.2, 9, 9.4, N('#d9cbb5'));
          const [bx, by] = PG(X + 2.28, Y + 1.58, 9.4);
          R(bx - 1, by, 2, 1, N('#f3efe2'));
          R(bx + 1, by - 1, 1, 1, N('#f3efe2'));
        },
      });
      // By the entrance: an extinguisher on the trough's end and a low bollard light that glows warm after dark.
      items.push({
        z: Z + 4.05,
        f: () => {
          gbox(X + 0.18, Y + 2.9, 0.14, 0.1, 1, 8, N('#e5484d'), N('#b8373b'), N('#9a2e31'));
          {
            const [ex, ey] = PG(X + 0.25, Y + 3.0, 8);
            R(ex - 1, ey - 1, 2, 1, '#1a1a1a');
          }
          gbox(X + 0.1, Y + 3.62, 0.14, 0.14, 0, 9, metal);
          const glow = df < 0.6;
          gbox(
            X + 0.08,
            Y + 3.6,
            0.18,
            0.18,
            9,
            10.5,
            glow ? '#ffd98a' : N('#e8e2d6'),
            glow ? '#f5c46a' : undefined,
            glow ? '#e8b25a' : undefined,
          );
          gbox(X + 0.06, Y + 3.58, 0.22, 0.22, 10.5, 11.2, metal);
        },
      });
      // Designated-area sign: a green plate with the smoking pictogram (no words needed), lying in the plane y = const.
      // It stands on the front edge just past the entrance, clear of the lawn tree beyond the pad's far corner.
      items.push({
        z: Z + 5.85,
        f: () => {
          gbox(X + 2.08, Y + 3.72, 0.06, 0.06, 0, 13, metal);
          poly(
            [
              PG(X + 1.75, Y + 3.7, 13),
              PG(X + 2.4, Y + 3.7, 13),
              PG(X + 2.4, Y + 3.7, 19.5),
              PG(X + 1.75, Y + 3.7, 19.5),
            ],
            N('#1f8a4c'),
            null,
          );
          const [sx, sy] = PG(X + 1.75, Y + 3.7, 19.5);
          ctx.save();
          ctx.translate(Math.round(sx), Math.round(sy));
          ctx.transform(1, 0.5, 0, 1, 0, 0);
          ctx.fillStyle = N('#ffffff');
          ctx.fillRect(2, 4, 6, 1);
          ctx.fillRect(3, 2, 1, 1);
          ctx.fillRect(4, 1, 1, 1);
          ctx.fillRect(5, 2, 1, 1);
          ctx.fillStyle = '#ff9a3d';
          ctx.fillRect(8, 4, 1, 1);
          ctx.restore();
        },
      });
    }
  },
);
