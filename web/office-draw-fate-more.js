// More scenes for the ways out of the island (web/office-draw-fate.js has the rest and the helpers): swallowed by a
// big fish, towed off by a duck, a slip on a banana peel, rolled up in a snowball, carried off by a big bird.
import { SCENES, clamp, ease, fig, oval, ripples, rr } from './office-draw-fate.js';
import { shirtOf } from './office-people-xmas.js';

// Whatever `draw` paints shows only above the water line at y (and from x - left to x + right).
function above(ctx, x, y, draw, right = 40) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 40, y - 90, 40 + right, 92);
  ctx.clip();
  draw();
  ctx.restore();
}
function splash(R, x, y, q, n = 9) {
  if (q < 0 || q > 0.5) return;
  for (let k = 0; k < n; k++) {
    const a = Math.PI * (1 + (k + 0.5) / n);
    R(x + Math.cos(a) * 44 * q, y + Math.sin(a) * 60 * q + 130 * q * q, 1, 2, '#eaf6ff');
  }
}

Object.assign(SCENES, {
  // Something circles under the water. A big fish comes straight up, mouth open, and takes them down with it.
  fish(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      up = ease((u - 0.9) / 0.35),
      down = ease((u - 1.7) / 0.6),
      top = y + 8 - 48 * up + 56 * down;
    if (u < 0.9) {
      const a = u * 7;
      oval(ctx, x + Math.cos(a) * 9, y + 3 + Math.sin(a) * 3, 6, 2.5, 'rgba(20,40,70,0.45)');
    }
    above(ctx, x, y + 1, () => {
      if (up < 0.7) fig(S, G, f, x, y, { dy: 9, dx: u > 0.5 ? (Math.floor(u * 16) % 2 ? 1 : -1) : 0 });
      if (u >= 0.9 && u < 2.4) {
        oval(ctx, x, top + 30, 12, 30, '#3f6d94');
        oval(ctx, x - 3, top + 30, 7, 27, '#5f93bd');
        oval(ctx, x + 6, top + 32, 4, 22, '#d9e8f2');
        if (down < 0.15) {
          oval(ctx, x, top + 3, 9, 4.5, '#1b2a3a');
          oval(ctx, x, top + 4, 6, 2.5, '#b5424f');
        }
        R(x - 8, top + 12, 3, 3, '#ffffff');
        R(x - 7, top + 13, 1, 1, '#10131c');
        R(x - 14, top + 24, 3, 8, '#3f6d94');
        R(x + 11, top + 24, 3, 8, '#3f6d94');
      }
    });
    splash(R, x, y, u - 0.9);
    splash(R, x, y, u - 2.1, 11);
    ripples(ctx, x, y + 1, u, clamp((3.6 - u) / 0.8));
  },
  // A duck paddles up, takes hold, and tows them away across the lake at speed.
  duck(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      q = Math.max(0, u - 1.5),
      dx = 190 * q * q,
      a = 1 - clamp((q - 0.75) / 0.4),
      bob = Math.round(Math.sin(u * 6)),
      // the duck: from the right, facing left; once it has hold it turns and pulls
      kx = Math.round(x + 12 + 36 * (1 - ease(u / 1.1)) + dx),
      dir = q ? 1 : -1;
    // drawn mirrored: the open water is on the left of the bathing spots, so the duck comes from there and goes back
    ctx.save();
    ctx.translate(2 * x, 0);
    ctx.scale(-1, 1);
    above(
      ctx,
      x,
      y + 1,
      () => {
        fig(S, G, f, x, y, { dy: 9, dx, rot: q ? -0.45 : 0, a });
        ctx.globalAlpha = a;
        R(kx - 4, y - 4 + bob, 8, 4, '#f6f4ec');
        R(kx - 3, y - 5 + bob, 5, 1, '#f6f4ec');
        R(kx + dir * 4 - 1, y - 8 + bob, 3, 4, '#f6f4ec');
        R(kx + dir * 6 - (dir < 0 ? 1 : 0), y - 6 + bob, 2, 1, '#f59e2c');
        R(kx + dir * 4, y - 7 + bob, 1, 1, '#10131c');
        R(kx - dir * 4 - (dir < 0 ? 0 : 1), y - 5 + bob, 1, 2, '#dcd8c8');
        if (q)
          for (let k = 0; k < 6; k++)
            R(x + dx - 6 - k * 4, y - 1 - ((k * 3 + Math.floor(u * 20)) % 5), 1, 2, 'rgba(234,246,255,0.9)');
        ctx.globalAlpha = 1;
      },
      300,
    );
    if (!q) ripples(ctx, x, y + 1, u);
    if (u > 1.1 && u < 1.5) R(kx - 9, y - 14, 1, 3, '#ffd166');
    ctx.restore();
  },
  // A banana peel: feet up, flat on the back with stars, then a long slide out of sight.
  banana(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      p = ease((u - 0.2) / 0.5),
      q = Math.max(0, u - 1.5),
      dx = -210 * q * q,
      a = 1 - clamp((q - 0.55) / 0.35);
    ctx.globalAlpha = 1 - clamp((u - 2.6) / 0.5);
    R(x + 2, y - 1, 5, 2, '#f2c230');
    R(x + 1, y, 2, 2, '#d9a81e');
    R(x + 6, y, 2, 2, '#d9a81e');
    R(x + 4, y - 3, 1, 2, '#8a6a1a');
    ctx.globalAlpha = 1;
    fig(S, G, f, x, y, {
      rot: -1.55 * p,
      dy: -12 * Math.sin(Math.PI * clamp((u - 0.2) / 0.6)),
      dx: -6 * p + dx,
      a,
    });
    if (u > 0.8 && u < 1.6)
      for (let k = 0; k < 3; k++) {
        const an = u * 7 + k * 2.1;
        R(x - 24 + Math.cos(an) * 6, y - 9 + Math.sin(an) * 2.5, 2, 2, '#ffd166');
      }
    if (q)
      for (let k = 0; k < 4; k++)
        R(x + dx + 6 + k * 9, y - 3 - k * 3, 7, 1, `rgba(255,255,255,${(0.6 * a).toFixed(2)})`);
  },
  // A snowball rolls in, growing, and rolls on with them inside: a head, arms and legs going round.
  snowball(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      p = clamp(u / 1.2),
      q = Math.max(0, u - 1.2),
      r = 6 + 7 * p,
      bx = Math.round(x - 95 * (1 - p) + 130 * q * q + 45 * q),
      by = Math.round(y - r + 1),
      a = 1 - clamp((q - 2.2) / 0.7),
      who = f.who;
    if (!q) fig(S, G, f, x, y, { dx: u > 0.5 ? (Math.floor(u * 20) % 2 ? 1 : -1) : 0 });
    ctx.globalAlpha = a;
    // the track it leaves in the snow
    R(bx - 60, y, 60, 1, 'rgba(255,255,255,0.35)');
    if (q) {
      const limbs = [who.skin, shirtOf(who), '#3b4252', shirtOf(who), '#3b4252'];
      limbs.forEach((c, k) => {
        const an = u * 9 + (k * Math.PI * 2) / limbs.length,
          d = r + (k ? 2 : 1);
        R(bx + Math.cos(an) * d - (k ? 1 : 2), by + Math.sin(an) * d - (k ? 2 : 2), k ? 2 : 4, 4, c);
      });
    }
    oval(ctx, bx, by, r + 1, r + 1, '#9fb4c9');
    oval(ctx, bx, by, r, r, '#f4f8fc');
    oval(ctx, bx + r * 0.25, by + r * 0.3, r * 0.65, r * 0.6, '#dbe6f0');
    oval(ctx, bx - r * 0.2, by - r * 0.25, r * 0.6, r * 0.55, '#f4f8fc');
    for (let k = 0; k < 3; k++) {
      const an = u * 9 + k * 2.3;
      R(bx + Math.cos(an) * r * 0.55, by + Math.sin(an) * r * 0.55, 1, 1, '#b9c9da');
    }
    ctx.globalAlpha = 1;
  },
  // A very big bird swoops down, takes them by the collar and flies off.
  bird(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      inn = 1 - ease(u / 1.3),
      q = Math.max(0, u - 1.6),
      bx = Math.round(x - 130 * inn + 150 * q * q + 20 * q),
      by = Math.round(y - 32 - 95 * inn - 70 * q * q - 30 * q),
      a = 1 - clamp((q - 1.1) / 0.5),
      flap = Math.floor(u * 7) % 2,
      held = u > 1.3;
    oval(ctx, bx, y + 1, 9 * (1 - inn * 0.6), 3, `rgba(0,0,0,${(0.18 * a * (q ? 1 - clamp(q) : 1)).toFixed(2)})`);
    fig(S, G, f, x, y, held ? { dx: bx - x, dy: by - y + 27, rot: Math.sin(u * 5) * 0.2, a } : {});
    ctx.globalAlpha = a;
    for (const s of [-1, 1]) {
      R(bx + s * 5 - (s < 0 ? 11 : 0), by - (flap ? 7 : 0), 11, 3, '#4a3423');
      R(bx + s * 9 - (s < 0 ? 9 : 0), by - (flap ? 10 : -3), 9, 3, '#3a281a');
    }
    oval(ctx, bx, by, 7, 4, '#5a4030');
    R(bx + 4, by - 6, 5, 5, '#f4f1e8');
    R(bx + 9, by - 4, 3, 2, '#f2b632');
    R(bx + 7, by - 5, 1, 1, '#10131c');
    R(bx - 10, by - 1, 4, 3, '#f4f1e8');
    R(bx - 1, by + 4, 1, 3, '#f2b632');
    R(bx + 2, by + 4, 1, 3, '#f2b632');
    ctx.globalAlpha = 1;
  },
});
