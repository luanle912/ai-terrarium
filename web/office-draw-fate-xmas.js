// The Christmas event's own ways out of the island (web/fate-logic.js; the other scenes and the helpers are in
// web/office-draw-fate.js): picked up by Santa's sleigh, wrapped up as a present and pushed off by an elf, skating
// straight off the edge of the frozen lake, and down a chimney that was not there a moment ago.
import { SCENES, clamp, ease, fig, rr, wisps } from './office-draw-fate.js';
import { OutfitLogic } from './outfit-logic.js';
import { SnowLogic } from './snow-logic.js';

const { RED, GOLD } = OutfitLogic,
  SNOW = SnowLogic.PAL,
  BRICK = '#a4452f',
  MORTAR = '#7d3222',
  SOOT = '#2a1c14',
  ICE_MARK = '#8fb0d6';
const light = G => Math.round(G.df * 10);

Object.assign(SCENES, {
  // The sleigh swoops down beside them, they hop on behind Santa, and it climbs away to the right, trailing sparks.
  sleigh(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      img = S.critterSprite('sleigh', 'fly', light(G), false, false),
      down = 1 - ease(u / 1.6),
      up = ease((u - 2.3) / 2.7),
      sx = x - 16 - 170 * down + 280 * up * up,
      sy = y - img.fh * 2 + 4 - 70 * down - 170 * up,
      hop = clamp((u - 1.6) / 0.55);
    if (u < 1.6) fig(S, G, f, x, y);
    else if (hop < 1)
      fig(S, G, f, x, y, { dx: -2 * hop, dy: -12 * Math.sin(hop * Math.PI) - 4 * hop, s: 1 - 0.45 * hop });
    ctx.globalAlpha = clamp((5 - u) / 0.5);
    ctx.drawImage(img, Math.round(sx), Math.round(sy), img.width * 2, img.height * 2); // twice the critters' size
    if (u > 2.3 || u < 1.6)
      for (let k = 0; k < 6; k++)
        R(sx - 6 - k * 7, sy + 16 + ((k * 5 + Math.floor(u * 12)) % 7), 2, 1 + (k % 2), k % 2 ? GOLD : SNOW.glint);
    ctx.globalAlpha = 1;
  },
  // Wrapping paper closes round them, a ribbon ties itself, the parcel hops twice, and an elf pushes it away.
  wrapped(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      h = Math.round(25 * ease(u / 1)),
      hop = u > 1.4 && u < 2.2 ? Math.abs(Math.sin(((u - 1.4) / 0.8) * Math.PI * 2)) * 5 : 0,
      off = u > 2.6 ? (u - 2.6) * 70 : 0,
      bx = Math.round(x - off),
      by = Math.round(y - hop);
    ctx.globalAlpha = clamp((3.6 - u) / 0.5);
    if (u < 1) fig(S, G, f, x, y);
    R(bx - 8, by - h, 16, h, RED);
    R(bx + 4, by - h, 4, h, '#96242b');
    if (u > 1) {
      const tie = clamp((u - 1) / 0.4);
      R(bx - 1, by - 25, 2, Math.round(25 * tie), GOLD);
      R(bx - 8, by - 14, Math.round(16 * tie), 2, GOLD);
      if (tie >= 1) {
        R(bx - 5, by - 29, 4, 4, GOLD);
        R(bx + 1, by - 29, 4, 4, GOLD);
        R(bx - 1, by - 27, 2, 2, '#e2a93c');
      }
    }
    if (u > 2.2) {
      const img = S.critterSprite('elf', Math.floor(u * 8) % 2 ? 'walk1' : 'walk2', light(G), false, true),
        ex = bx + 10 + 60 * (1 - ease((u - 2.2) / 0.4));
      ctx.drawImage(img, Math.round(ex), Math.round(y - img.fh));
    }
    ctx.globalAlpha = 1;
  },
  // A push off, arms out, faster and faster across the ice toward the front of the island, and off its edge.
  skateoff(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      go = clamp((u - 0.4) / 2.6),
      d = 13 * go * go,
      fall = clamp((u - 3) / 1.4),
      px = x - 17.3 * d - 14 * fall,
      py = y + 7.4 * d + 260 * fall * fall;
    // the marks of the blades behind them, while still on the ice
    if (go > 0 && fall <= 0) for (let k = 1; k <= 5; k++) R(px + 17.3 * 0.25 * k, py - 7.4 * 0.25 * k, 2, 1, ICE_MARK);
    fig(S, G, f, x, y, {
      dx: px - x,
      dy: py - y,
      rot: fall > 0 ? -0.2 - fall * 2.4 : -0.18 * Math.min(1, go * 3),
      a: (4.4 - u) / 0.6,
    });
  },
  // A brick chimney comes up out of the snow. They jump onto it and drop in; a few puffs of soot, and it is gone.
  chimney(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      cx = x + 15,
      h = Math.round(20 * (u < 3.4 ? ease(u / 0.8) : 1 - ease((u - 3.4) / 1.1))),
      top = y - h,
      jump = clamp((u - 0.9) / 0.7),
      drop = clamp((u - 1.6) / 0.7);
    if (drop < 1) {
      // only what is above the rim shows once they are over the chimney
      ctx.save();
      if (jump >= 1) {
        ctx.beginPath();
        ctx.rect(cx - 20, top - 60, 40, 60);
        ctx.clip();
      }
      fig(S, G, f, x, y, { dx: 15 * jump, dy: -(h + 2) * jump - 12 * Math.sin(jump * Math.PI) + 26 * drop });
      ctx.restore();
    }
    if (h > 0) {
      R(cx - 6, top, 12, h, BRICK);
      R(cx + 2, top, 4, h, MORTAR);
      for (let r = 3; r < h; r += 4) R(cx - 6, top + r, 12, 1, MORTAR);
      R(cx - 4, top, 8, 1, SOOT);
      if (h > 5) R(cx - 7, top - 2, 14, 2, SNOW.lit);
    }
    if (u > 2.2 && u < 3.6) wisps(R, cx, top - 3, u, 4, '70,70,80', 22);
  },
});
