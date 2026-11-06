import { tr } from './i18n.js';
import { PantryItems } from './pantry-items.js';
import { SkyLogic } from './sky-logic.js';
import { SkyRender } from './sky-render.js';
import { RestroomLogic } from './restroom-logic.js';
import { FLOOR_Z, IDLE_SPOTS, P, PG, SMOKE, STAIRS, W, WALL, WC, lerpHex, mix } from './office-scene.js';
import { RESTROOM_GLYPH, shade } from './office-util.js';
import { ClaudeOffice, mixin } from './office.js';
// Drawing the smoking corner and the restroom block.
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
    // The restroom block beside the pantry (RestroomLogic.layout, spec "Bản 3"): an open-top block on the office floor
    // level that continues the office. Nothing here has a look of its own: the back wall is a full office wall, the front
    // and east walls are office walls at 70 % (the front one with two doorways and swing doors in the office door's colours), the walls between rooms are
    // office walls 32 px high, the floors are the pantry's tiles and planks, the fixtures are drawn with the pantry's kit
    // and colours (cabinets, worktop, steel sinks, white pots, the bar stool), the bench is the smoking corner's, small
    // pictogram plaques mark the doors and the lobby name is painted on the floor like PANTRY. The two muted accents (dusty
    // blue men, dusty pink women) are only on the stall panels and the pictograms. Slab, floor and back wall are drawn at once
    // (nothing on the block stands behind them); everything else goes into `items` by depth, walls one tile at a time so
    // people sort in front of and behind them.
    restroomItems(G, items, snow) {
      const { ctx, poly, th, t, df } = G,
        L = WC,
        X = L.x0,
        Y = L.y0,
        X1 = L.x1,
        Y1 = L.y1,
        F = L.front,
        HT = L.heights,
        PI = PantryItems;
      if (!PI) return;
      const K = PI.kit(ctx, ...P(0, 0)),
        { box, fL, fR, top, R } = K,
        night = df < 0.5;
      const ACC = { m: L.rooms.m.accent, f: L.rooms.f.accent },
        WHITE = '#f6f4ee',
        STEEL = '#c9d3e3',
        WOOD = '#a8763e',
        WORK = '#efe9dc';
      const cap = shade(th.trim, 18),
        glow = df < 0.6 ? 1 - df / 0.6 : 0;
      // stall doors are shut, with a red light, while someone is inside (RestroomLogic.visit 'inside')
      const occupied = new Set();
      for (const a of this.agents)
        if (a.wcIn && a.idleSpot != null && IDLE_SPOTS[a.idleSpot]) occupied.add(IDLE_SPOTS[a.idleSpot].stall);
      // a pantry item drawn at a floor position, with the soft contact shadow pantryItems gives it
      const item = (name, x, y) => {
        const it = PI.I[name],
          k = PI.kit(ctx, ...P(x, y));
        k.shadow(0, 0, it.size[0], it.size[1], 0.22);
        it.draw(k, t, { night });
      };

      // ---- at once: the plinth (office stone), the east stairs again (they stand in front of it), floors, rug ----
      {
        const WT_ = 0.35,
          stone = SkyRender.night('#b9b2a3', df);
        [
          [0.5, 0.07],
          [0.25, 0.1],
        ].forEach(([b, a]) => {
          const sh = 'rgba(0,0,0,' + a + ')';
          poly([PG(X + b, Y1), PG(X1, Y1), PG(X1 + b, Y1 + b), PG(X + b, Y1 + b)], sh, null);
          poly([PG(X1, Y - WT_), PG(X1 + b, Y - WT_), PG(X1 + b, Y1 + b), PG(X1, Y1)], sh, null);
        });
        poly([PG(X, Y1, 0), PG(X1, Y1, 0), PG(X1, Y1, FLOOR_Z), PG(X, Y1, FLOOR_Z)], shade(stone, -18), null);
        poly(
          [PG(X1, Y - WT_, 0), PG(X1, Y1, 0), PG(X1, Y1, FLOOR_Z), PG(X1, Y - WT_, FLOOR_Z)],
          shade(stone, -40),
          null,
        );
        poly(
          [PG(X, Y1, FLOOR_Z - 1), PG(X1, Y1, FLOOR_Z - 1), PG(X1, Y1, FLOOR_Z), PG(X, Y1, FLOOR_Z)],
          shade(stone, 12),
          null,
        );
        poly(
          [PG(X1, Y - WT_, FLOOR_Z - 1), PG(X1, Y1, FLOOR_Z - 1), PG(X1, Y1, FLOOR_Z), PG(X1, Y - WT_, FLOOR_Z)],
          shade(stone, -10),
          null,
        );
        for (let x = 30; x < X1; x += 4)
          poly(
            [PG(x, Y1, 1), PG(x + 0.06, Y1, 1), PG(x + 0.06, Y1, FLOOR_Z - 1), PG(x, Y1, FLOOR_Z - 1)],
            shade(stone, -32),
            null,
          );
        for (let y = 2; y < Y1; y += 4)
          poly(
            [PG(X1, y, 1), PG(X1, y + 0.06, 1), PG(X1, y + 0.06, FLOOR_Z - 1), PG(X1, y, FLOOR_Z - 1)],
            shade(stone, -52),
            null,
          );
        // the east flight of stairs, exactly as the plinth draws it, so its steps stay in front of the slab's face
        const run = SkyLogic.STAIR_RUN / 3;
        for (const s of STAIRS)
          if (s.side === 'east')
            for (let i = 0; i < 2; i++) {
              const zt = FLOOR_Z * (1 - (i + 1) / 3),
                tp = shade(stone, 8 - i * 4),
                x0 = W + i * run,
                x1 = x0 + run,
                y0 = s.y,
                y1 = s.y + s.len;
              poly([PG(x0, y1, 0), PG(x1, y1, 0), PG(x1, y1, zt), PG(x0, y1, zt)], shade(tp, -20), null);
              poly([PG(x1, y0, 0), PG(x1, y1, 0), PG(x1, y1, zt), PG(x1, y0, zt)], shade(tp, -38), null);
              poly([PG(x0, y0, zt), PG(x1, y0, zt), PG(x1, y1, zt), PG(x0, y1, zt)], tp, null);
            }
      }
      for (let y = Y; y < Y1; y++)
        for (let x = X; x < X1; x++) {
          if (y >= F) {
            // lobby: the pantry's warm planks with their seams and staggered joints
            const col = y % 2 ? lerpHex('#3a2d2b', '#c99862', df) : lerpHex('#332725', '#c18f59', df);
            poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], col, null);
            const sm = shade(col, -16),
              jx = x + (y % 2 ? 0.3 : 0.7);
            poly([P(x, y + 0.5), P(x + 1, y + 0.5), P(x + 1, y + 0.53), P(x, y + 0.53)], sm, null);
            poly([P(jx, y), P(jx + 0.03, y), P(jx + 0.03, y + 0.5), P(jx, y + 0.5)], sm, null);
            continue;
          }
          // rooms: the pantry kitchen's light washable tiles
          poly(
            [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)],
            (x + y) % 2 ? lerpHex('#2e2d3a', '#ebe7dd', df) : lerpHex('#282734', '#dfdace', df),
            null,
          );
        }
      // soft contact shadow where the walls meet the floor, as in the office
      [
        [0.45, 0.06],
        [0.22, 0.1],
      ].forEach(([b, a]) => {
        const sh = 'rgba(0,0,0,' + a + ')';
        poly([P(X, Y), P(X1, Y), P(X1, Y + b), P(X, Y + b)], sh, null);
        for (const wx of [L.walls.pantry.x + L.walls.pantry.t, L.walls.split.x + L.walls.split.t])
          poly([P(wx, Y), P(wx + b, Y), P(wx + b, F), P(wx, F)], sh, null);
      });
      // the lobby's name painted on its planks along the walkway, in the same paint as PANTRY
      {
        const [lx, ly] = L.lobby.label;
        this.restroomPaint(ctx, P(lx, ly), tr('office.wc.lobby'), df > 0.5 ? '#8a5a2a' : '#a8763e', 2);
      }

      // ---- the back wall, exactly the office's: wall, skirting, top band and cap, cut end ----
      {
        const WT = 0.35,
          ZT = WALL + 3;
        poly([P(X, Y, 0), P(X1, Y, 0), P(X1, Y, WALL), P(X, Y, WALL)], th.wr, null);
        poly([P(X, Y, WALL), P(X1, Y, WALL), P(X1, Y, ZT), P(X, Y, ZT)], th.trim, null);
        poly([P(X, Y, 0), P(X1, Y, 0), P(X1, Y, 4), P(X, Y, 4)], th.trim, null);
        poly([P(X, Y - WT, ZT), P(X1, Y - WT, ZT), P(X1, Y, ZT), P(X, Y, ZT)], cap, null);
        poly([P(X1, Y - WT, 0), P(X1, Y, 0), P(X1, Y, ZT), P(X1, Y - WT, ZT)], shade(th.wr, -34), null);
        // hand dryer in the men's room corner, above the plant
        const [dx] = L.dryerM;
        box(dx - 0.12, Y, 0.24, 0.14, 17, 24, WHITE, '#e3ddd0', '#d6cfbf');
        fL(dx - 0.04, dx + 0.04, Y + 0.14, 17, 17.6, '#8b93a7');
      }

      // ---- solid room walls (office walls: wall colour, skirting, top band, cap), one tile at a time ----
      const wallX = (x0, w, ya, yb, h) => {
        box(x0, ya, w, yb - ya, 0, h - 2, th.trim, shade(th.wl, -20), th.wl);
        box(x0, ya, w, yb - ya, h - 2, h, cap, th.trim, th.trim);
        fR(x0 + w, ya, yb, 0, 4, th.trim);
      };
      const deco = {};
      const put = (x, y, f) => {
        const k = x + ',' + Math.min(F - 1, Math.floor(y));
        (deco[k] = deco[k] || []).push(f);
      };
      // a mirror on a room wall's east face: a thin trim frame round glass that catches the light like the office windows
      const mirror = (x, ya, yb, za, zb) => {
        fR(x, ya, yb, za, zb, th.trim);
        fR(x, ya + 0.05, yb - 0.05, za + 1.2, zb - 1.2, th.glass);
        for (let s = ya + 0.2; s < yb - 0.25; s += 0.55)
          poly(
            [P(x, s, zb - 2.5), P(x, s + 0.1, zb - 2.5), P(x, s + 0.28, za + 2.5), P(x, s + 0.18, za + 2.5)],
            th.glassHi,
            null,
          );
      };
      const dryer = (x, y) => {
        box(x, y - 0.12, 0.13, 0.24, 17, 24, WHITE, '#e3ddd0', '#d6cfbf');
        fR(x + 0.13, y - 0.05, y + 0.05, 17.3, 18, '#8b93a7');
      };
      {
        const v = L.vanities.m;
        put(X, v.y1, () => mirror(v.x0, v.y0 + 0.05, v.y1 - 0.05, 18, 32));
      }
      {
        const v = L.vanities.f;
        put(X + 3, v.y1, () => mirror(v.x0, v.y0 + 0.05, v.y1 - 0.05, 18, 32));
        put(X + 3, v.dryer, () => dryer(v.x0, v.dryer));
      }
      {
        const m = L.makeup;
        put(X + 3, m.y1, () => mirror(m.x0, m.y0 + 0.08, m.y1 - 0.08, 18, 30));
      }
      // urinals on the pantry wall, with solid modesty screens in the wall colour
      L.urinals.forEach(u =>
        put(X, u, () => {
          const x = L.walls.pantry.x + L.walls.pantry.t;
          box(x, u - 0.18, 0.28, 0.36, 7, 18, WHITE, '#e3ddd0', '#d6cfbf');
          fR(x + 0.28, u - 0.11, u + 0.11, 9, 15.5, '#d9dbe2');
          box(x, u - 0.03, 0.06, 0.06, 18, 24, STEEL);
        }),
      );
      for (const [wx, wt] of [
        [L.walls.pantry.x, L.walls.pantry.t],
        [L.walls.split.x, L.walls.split.t],
      ])
        for (let y = Y; y < F; y++) {
          const k = Math.round(wx === X ? X : X + 3) + ',' + y;
          items.push({
            z: wx + y + 0.3,
            f: () => {
              wallX(wx, wt, y, y + 1, HT.room);
              (deco[k] || []).forEach(f => f());
            },
          });
        }
      L.screens.forEach(s =>
        items.push({
          z: X + s + 0.5,
          f: () => {
            const x = L.walls.pantry.x + L.walls.pantry.t;
            box(x, s - 0.02, 0.38, 0.04, 6, 22, cap, th.wr, shade(th.wr, -34));
          },
        }),
      );
      // ---- the front wall (with the two doorways) and the women's room's east wall: office walls at 70 % height, drawn
      // like the back wall (wall colour, skirting, top band, cap). The office itself is open on its front and east, so
      // these are the only outer walls that face the camera; they are solid, and a little of the rooms shows over them.
      const fw = L.walls.front,
        ew = L.walls.east,
        OH = HT.outer,
        ZT = OH + 3,
        DH = HT.door;
      const frontPiece = (xa, xb, z0) => {
        box(xa, fw.y, xb - xa, fw.t, z0, OH, th.trim, th.wr, shade(th.wr, -34));
        box(xa, fw.y, xb - xa, fw.t, OH, ZT, cap, th.trim, th.trim);
        if (z0 === 0) fL(xa, xb, fw.y + fw.t, 0, 4, th.trim);
      };
      // a pixel pictogram lying in the wall plane y (one font pixel per screen pixel), from its top-left corner
      const picto = (x, y, z, rows, col) => {
        const [px, py] = P(x, y, z),
          c = ctx;
        c.save();
        c.translate(Math.round(px), Math.round(py));
        c.transform(1, 0.5, 0, 1, 0, 0);
        c.fillStyle = col;
        rows.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) if (row[i] === '#') c.fillRect(i, j, 1, 1);
        });
        c.restore();
      };
      const PICTO = {
        m: ['..#..', '.....', '.###.', '#.#.#', '..#..', '.#.#.', '.#.#.'],
        f: ['..#..', '.....', '.###.', '#.#.#', '.###.', '#####', '.#.#.'],
      };
      // Door signs: a small white plaque with a trim frame on the wall just west of each doorway, at eye level, carrying the
      // room's pictogram in its accent colour (no words: a real door sign is about this size).
      const plaque = d => {
        const x0 = d.x0 - 0.52,
          x1 = d.x0 - 0.1,
          y = fw.y + fw.t + 0.003;
        fL(x0, x1, y, 19, 29, th.trim);
        fL(x0 + 0.04, x1 - 0.04, y, 20, 28, WHITE);
        picto(x0 + 0.07, y, 27.5, PICTO[d.room], ACC[d.room]);
      };
      const solid = [];
      for (let x = X; x < ew.x; x = Math.floor(x) + 1)
        if (!L.doors.some(d => x >= d.x0 && x < d.x1)) solid.push([x, Math.min(Math.floor(x) + 1, ew.x)]);
      for (const [xa, xb] of solid)
        items.push({
          z: xa + 0.5 + F,
          f: () => {
            frontPiece(xa, xb, 0);
            for (const d of L.doors) if (d.x0 > xa && d.x0 <= xb) plaque(d);
          },
        });
      const tiles = [[ew.y0, Y + 1]];
      for (let y = Y + 1; y < F; y++) tiles.push([y, y + 1]);
      tiles[tiles.length - 1][1] = ew.y1;
      for (const [ya, yb] of tiles)
        items.push({
          z: X1 + Math.max(ya, Y) + 0.4,
          f: () => {
            box(ew.x, ya, ew.t, yb - ya, 0, OH, th.trim, shade(th.wl, -20), th.wl);
            box(ew.x, ya, ew.t, yb - ya, OH, ZT, cap, th.trim, th.trim);
            fR(X1, ya, yb, 0, 4, th.trim);
          },
        });
      // Swing doors (RestroomLogic.doorSwing): a leaf in the office door's colours (frame, panel, small window, kick
      // panel) with a steel push plate on each face, hung on the west jamb; shut, or swung about 70° away from whoever
      // is in the doorway. The lintel above is part of the wall.
      const swing = RestroomLogic.doorSwing(
        L,
        this.agents.filter(a => !a.gone),
      );
      L.doors.forEach((d, i) =>
        items.push({
          z: (d.x0 + d.x1) / 2 + F,
          f: () => {
            // the lintel and the frame round the opening; a leaf pushed into the room is behind them, one pushed out in front
            const s = swing[i],
              frame = () => {
                frontPiece(d.x0, d.x1, DH);
                fL(d.x0, d.x0 + 0.06, fw.y + fw.t + 0.002, 0, DH, '#5c4330');
                fL(d.x1 - 0.06, d.x1, fw.y + fw.t + 0.002, 0, DH, '#5c4330');
                fL(d.x0, d.x1, fw.y + fw.t + 0.002, DH - 1.5, DH, '#5c4330');
              };
            if (s >= 0) frame();
            const a = s ? 1.22 : 0,
              hx = d.x0 + 0.07,
              hy = d.y,
              w = d.x1 - d.x0 - 0.14,
              ux = Math.cos(a),
              uy = s * Math.sin(a);
            const Q = (u, z) => K.P(hx + ux * u, hy + uy * u, z),
              rect = (u0, u1, z0, z1, c) => K.poly([Q(u0, z0), Q(u1, z0), Q(u1, z1), Q(u0, z1)], c);
            const tone = c => (s < 0 ? shade(c, -14) : c);
            rect(0, w, 0.5, DH - 1.5, tone('#5c4330'));
            rect(0.04, w - 0.04, 1.5, DH - 2.5, tone('#8a5a3a'));
            rect(0.18, w - 0.18, 3, DH * 0.3, tone('#7a4f2f'));
            rect(0.25, w - 0.25, DH * 0.6, DH * 0.85, tone('#9fd3ff'));
            rect(0.28, 0.4, DH * 0.64, DH * 0.8, tone('#cfeaff'));
            rect(w - 0.2, w - 0.1, DH * 0.4, DH * 0.56, tone(STEEL));
            if (s < 0) frame();
          },
        }),
      );

      // ---- stalls: solid accent panels raised off the floor, wall-hung toilets, doors swung inward or shut ----
      L.stalls.forEach((s, i) => {
        const acc = ACC[s.room],
          room = L.rooms[s.room],
          first = !i || L.stalls[i - 1].room !== s.room;
        items.push({
          z: s.x0 + s.y1 + 0.1,
          f: () => {
            const cx = (s.x0 + s.x1) / 2,
              y0 = s.y0,
              y1 = s.y1,
              zb = HT.stallFoot,
              zt = HT.stall,
              shut = occupied.has(i),
              pc = shade(acc, 30);
            fL(cx - 0.09, cx + 0.09, y0 + 0.005, 19, 23, '#e6e9ef');
            fL(cx - 0.02, cx + 0.02, y0 + 0.01, 20, 22, STEEL);
            box(cx - 0.17, y0, 0.34, 0.44, 6, 11, WHITE, '#e3ddd0', '#d6cfbf');
            top(cx - 0.13, y0 + 0.06, 0.26, 0.34, 11.01, '#e8e2d6');
            if (s.room === 'f') {
              box(s.x0 + 0.08, y0 + 0.8, 0.15, 0.15, 0, 5, STEEL);
              box(s.x0 + 0.07, y0 + 0.79, 0.17, 0.17, 5, 6, '#aab4c6');
            }
            const panel = x => {
              box(x, y0, 0.05, y1 - y0, zb, zt, pc);
              box(x, y1 - 0.06, 0.05, 0.05, 0, zb, STEEL);
            };
            if (first) panel(s.x0);
            const hx = s.x0 + 0.1,
              dw = s.x1 - s.x0 - 0.2;
            if (!shut) {
              const ex = hx + dw * Math.cos(1.42),
                ey = y1 - dw * Math.sin(1.42);
              K.poly([K.P(hx, y1, zb), K.P(ex, ey, zb), K.P(ex, ey, zt), K.P(hx, y1, zt)], shade(acc, -6));
              K.poly([K.P(hx, y1, zt), K.P(ex, ey, zt), K.P(ex + 0.04, ey + 0.02, zt), K.P(hx + 0.04, y1, zt)], pc);
            }
            panel(Math.min(s.x1, room.x1 - 0.08) - 0.05);
            box(s.x0, y1 - 0.04, 0.1, 0.04, zb, zt, pc);
            box(s.x1 - 0.1, y1 - 0.04, 0.1, 0.04, zb, zt, pc);
            if (shut) {
              box(hx, y1 - 0.035, dw, 0.03, zb, zt, pc, shade(acc, 12));
              fL(s.x1 - 0.22, s.x1 - 0.17, y1 + 0.001, 15, 16, STEEL);
            }
            fL(s.x1 - 0.09, s.x1 - 0.04, y1 + 0.002, 20, 22, shut ? '#e5484d' : '#46a758');
          },
        });
      });

      // ---- vanities: the pantry's base cabinet and worktop turned to face the room, steel sinks, chrome taps ----
      ['m', 'f'].forEach(r => {
        const v = L.vanities[r];
        // sorted just after the room-wall tiles it stands against, and before anyone washing at it
        items.push({
          z: (r === 'm' ? L.walls.pantry.x : L.walls.split.x) + F - 1 + 0.4,
          f: () => {
            const len = v.y1 - v.y0,
              w = v.x1 - v.x0;
            box(v.x0 + 0.04, v.y0 + 0.04, w - 0.06, len - 0.08, 0, 2, '#2d1c10');
            box(v.x0, v.y0, w - 0.02, len, 2, 12.5, WOOD, '#8a5f30', '#74501f');
            const n = Math.round(len / 0.6),
              dh = len / n;
            for (let i = 0; i < n; i++) {
              const y = v.y0 + i * dh;
              fR(v.x1 - 0.02, y + 0.04, y + dh - 0.04, 3, 11.6, shade(WOOD, 10));
              fR(v.x1 - 0.02, y + 0.08, y + dh - 0.08, 4, 10.6, shade(WOOD, -10));
              fR(v.x1 - 0.02, y + 0.1, y + dh - 0.1, 4.4, 10.2, shade(WOOD, 4));
              fR(v.x1 - 0.02, y + 0.12, y + 0.16, 8.6, 9.6, '#e0b23a');
            }
            box(v.x0 - 0.02, v.y0 - 0.03, w + 0.04, len + 0.06, 12.5, 14, WORK, '#d6cfbf', '#bfb7a6');
            v.basins.forEach(b => {
              top(v.x0 + 0.12, b - 0.24, w - 0.2, 0.48, 14.02, '#aab4c6');
              top(v.x0 + 0.16, b - 0.19, w - 0.28, 0.38, 14.03, '#6b768c');
              box(v.x0 + 0.03, b - 0.03, 0.06, 0.06, 14, 19, STEEL);
              box(v.x0 + 0.03, b - 0.03, 0.18, 0.05, 18, 19, STEEL);
            });
          },
        });
      });
      {
        const [bx, by] = L.bin;
        items.push({
          z: bx + by,
          f: () => {
            box(bx - 0.1, by - 0.1, 0.2, 0.2, 0, 6, STEEL, '#aab4c6', '#8f9ab0');
            box(bx - 0.1, by - 0.1, 0.2, 0.2, 6, 6.8, '#aab4c6');
          },
        });
      }
      {
        const v = L.vanities.f;
        items.push({
          z: v.x0 + 0.2 + v.dryer,
          f: () => {
            box(v.x0 + 0.07, v.dryer - 0.09, 0.18, 0.18, 0, 6, STEEL, '#aab4c6', '#8f9ab0');
            box(v.x0 + 0.07, v.dryer - 0.09, 0.18, 0.18, 6, 6.8, '#aab4c6');
          },
        });
      }

      // ---- the makeup counter (the pantry's worktop on a small cabinet) and the pantry's bar stool ----
      {
        const m = L.makeup;
        items.push({
          z: X + 3 + m.y1 - 0.2,
          f: () => {
            box(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0, 0, 12, WOOD, '#8a5f30', '#74501f');
            box(m.x0 - 0.02, m.y0 - 0.02, m.x1 - m.x0 + 0.04, m.y1 - m.y0 + 0.04, 12, 13.5, WORK, '#d6cfbf', '#bfb7a6');
          },
        });
        const [sx, sy] = m.stool;
        items.push({ z: sx + sy, f: () => item('stool', sx - 0.2, sy - 0.2) });
      }

      // ---- plants: the pantry's white pot plant ----
      for (const [px, py] of [L.plants.m, L.plants.f, L.plants.lobby])
        items.push({ z: px + py, f: () => item('potplant', px - 0.25, py - 0.25) });

      // ---- lobby: the smoking corner's slatted bench, a hand-sanitiser stand, a sign post like the door plaques ----
      {
        const b = L.lobby.bench;
        items.push({
          z: (b.x0 + b.x1) / 2 + b.y1,
          f: () => {
            const bw = '#c79a5e',
              metal = '#3d4350';
            for (const lx of [b.x0 + 0.15, b.x1 - 0.23]) box(lx, b.y0 + 0.05, 0.08, b.y1 - b.y0 - 0.1, 0, 5.8, metal);
            box(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 5.8, 7, bw, shade(bw, -25), shade(bw, -40));
            for (let k = 1; k < 3; k++)
              top(b.x0, b.y0 + (k * (b.y1 - b.y0)) / 3, b.x1 - b.x0, 0.01, 7.01, shade(bw, -30));
          },
        });
      }
      {
        const [sx, sy] = L.lobby.sanitizer;
        items.push({
          z: sx + sy + 0.2,
          f: () => {
            box(sx - 0.09, sy - 0.09, 0.18, 0.18, 0, 1, STEEL);
            box(sx - 0.02, sy - 0.02, 0.04, 0.04, 1, 20, STEEL);
            box(sx - 0.08, sy - 0.07, 0.16, 0.14, 20, 27, WHITE, '#e3ddd0', '#d6cfbf');
            fL(sx - 0.05, sx + 0.05, sy + 0.07, 22, 25, '#46a758');
            box(sx - 0.06, sy - 0.02, 0.12, 0.12, 13, 14, '#aab4c6');
          },
        });
      }
      {
        const [tx, ty] = L.lobby.totem;
        items.push({
          z: tx + ty,
          f: () => {
            box(tx - 0.03, ty - 0.03, 0.06, 0.06, 0, 20, STEEL);
            box(tx - 0.4, ty - 0.03, 0.8, 0.06, 19, 29, th.trim);
            fL(tx - 0.36, tx + 0.36, ty + 0.031, 20, 28, WHITE);
            picto(tx - 0.34, ty + 0.032, 27.5, PICTO.m, ACC.m);
            picto(tx + 0.04, ty + 0.032, 27.5, PICTO.f, ACC.f);
          },
        });
      }
    }
    // Words painted on the floor like PANTRY (in the office's floor paint): reading along +x, `s` px per font pixel.
    // A label in another language may have letters the 3×5 font lacks (CJK, Í…): it is then painted with fillText, in the
    // same floor plane and size.
    restroomPaint(ctx, [px, py], txt, col, s) {
      ctx.save();
      ctx.translate(Math.round(px), Math.round(py));
      ctx.transform(1, 0.5, -1, 0.5, 0, 0);
      ctx.scale(s, s);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = col;
      if (![...txt].every(ch => ch === ' ' || RESTROOM_GLYPH(ch).length)) {
        ctx.font = "bold 6px 'JetBrains Mono',sans-serif";
        ctx.textBaseline = 'top';
        ctx.fillText(txt, 0, -1);
        ctx.restore();
        ctx.globalAlpha = 1;
        return;
      }
      let x = 0;
      for (const ch of txt) {
        if (ch === ' ') {
          x += 3;
          continue;
        }
        const g = RESTROOM_GLYPH(ch),
          up = g.length > 5 ? g.length - 5 : 0;
        g.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(x + i, j - up, 1, 1);
        });
        x += (ch === '\u1EEE' ? 4 : 3) + 1;
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  },
);
