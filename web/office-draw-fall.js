// Whoever leaves by the EXIT door drops straight down from it: through the island, out under it and away into the
// sky, tumbling. Drawn on the back (sky) canvas, behind the scene canvas, so the island hides the fall while the
// person is still inside its depth and the sky below shows the rest.
import { PG, DOOR, LW, ISLAND, TW, TH } from './office-scene.js';
import { LOOK, hairTones } from './office-people.js';
import { outfitOf, shirtOf } from './office-people-xmas.js';
import { shade } from './office-util.js';
import { ClaudeOffice, mixin } from './office.js';

// Scene px / s²; the fall gets no faster than MAX_V. Once out under the island (OUT_AT) the person falls away from us
// into the depth below it: on screen their speed dies away by e^(-SLOW·τ) (at most MAX_V / SLOW more scene px, so they
// stay in view even where little sky shows under the island), they shrink by 1 / (1 + SHRINK·τ) and fade over the
// last second of AWAY_S. The figure is drawn SIZE× the scene's people so it reads against the sky.
const G_ACC = 900,
  MAX_V = 330,
  SLOW = 2,
  SHRINK = 1.2,
  AWAY_S = 3,
  SIZE = 1.5;
// How far below the door (scene px) the island's underside ends in the door's screen column: where a faller comes out.
const [DOOR_SX, DOOR_SY] = PG(DOOR.pt[0], DOOR.pt[1], 0);
const OUT_AT =
  Math.max(
    0,
    ...ISLAND.list
      .filter(c => Math.abs((c.x - c.y) * TW - DOOR_SX + PG(0, 0)[0]) <= TW)
      .map(c => PG(c.x + 1, c.y + 1, -c.d)[1]),
  ) -
  DOOR_SY +
  4;
// One step of a fall: speed builds to MAX_V; past OUT_AT, τ (f.out) counts the time spent falling away.
function stepFall(f, dt) {
  f.v = Math.min(MAX_V, f.v + G_ACC * dt);
  if (f.d >= OUT_AT) f.out += dt;
  f.d += f.v * Math.exp(-SLOW * f.out) * dt;
}

mixin(
  ClaudeOffice,
  class {
    // Someone who just went out of the door (a.exited): remember how they look and when they stepped out.
    startFall(a, t) {
      if (!this.fallers) this.fallers = [];
      if (this.fallers.length > 12) this.fallers.shift();
      this.fallers.push({
        t0: t,
        lt: t,
        d: 0,
        v: 0,
        out: 0,
        top: (outfitOf(a, this.eventNow()), shirtOf(a)),
        skin: a.skin,
        look: LOOK(a),
        sub: !!a.parent,
        spin: a.id % 2 ? 1 : -1,
      });
    }
    // On the back canvas (ctx in stage px): where the door is on the stage now (camera, zoom and the island's bob
    // included), then each faller below it.
    drawFallers(ctx, t, stageH) {
      if (!this.fallers || !this.fallers.length || !this.wrapEl) return;
      const w = this.wrapEl,
        cam = this.cam || { z: 1, tx: 0, ty: 0 },
        s = (w.offsetWidth / LW) * cam.z,
        X = w.offsetLeft + cam.tx + DOOR_SX * s,
        Y = w.offsetTop + cam.ty + DOOR_SY * s;
      this.fallers = this.fallers.filter(f => {
        stepFall(f, Math.min(0.1, Math.max(0, t - f.lt)));
        f.lt = t;
        const y = Y + f.d * s;
        if (f.out > AWAY_S || y - 30 * s > stageH) return false;
        ctx.globalAlpha = Math.min(1, AWAY_S - f.out);
        this.drawFaller(ctx, f, X, y, (s * SIZE) / (1 + SHRINK * f.out), t - f.t0);
        ctx.globalAlpha = 1;
        return true;
      });
    }
    // A small tumbling figure: arms up, legs apart, turning as it falls, in the person's own clothes and hair.
    drawFaller(ctx, f, x, y, s, u) {
      const [hr] = hairTones(f.look),
        R = (px, py, w, h, c) => {
          ctx.fillStyle = c;
          ctx.fillRect(px, py, w, h);
        };
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.scale(s, s);
      // wind streaks trailing above
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (const [sx, len] of [
        [-7, 9],
        [-1, 13],
        [6, 8],
      ])
        ctx.fillRect(sx, -26 - len - ((u * 40 + sx * 3) % 6), 1, len);
      ctx.rotate(f.spin * u * 2.6);
      ctx.translate(0, 6);
      // legs, body, arms flung up (flapping), head with hair, a gold band for a sub-agent
      const flap = Math.floor(u * 10) % 2;
      R(-3, 0, 2, 5, '#3b4252');
      R(1, 0, 2, 5, '#3b4252');
      R(-4, -7, 8, 7, f.top);
      R(2, -7, 2, 7, shade(f.top, -30));
      R(-6, -12 - flap, 2, 6, f.top);
      R(4, -12 + flap, 2, 6, shade(f.top, -30));
      R(-6, -14 - flap, 2, 2, f.skin);
      R(4, -14 + flap, 2, 2, f.skin);
      R(-3, -13, 6, 6, f.skin);
      R(2, -13, 1, 6, shade(f.skin, -25));
      R(-3, -14, 6, 2, hr);
      // mouth open in an O, eyes wide
      R(-2, -11, 1, 1, '#1a1a1a');
      R(1, -11, 1, 1, '#1a1a1a');
      R(-1, -9, 2, 1, '#5a1f1f');
      if (f.sub) R(-3, -15, 6, 1, '#ffd166');
      ctx.restore();
    }
  },
);
