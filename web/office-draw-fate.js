// The scenes for the ways out of the island other than the EXIT door (web/fate-logic.js): struck by lightning, blown
// away, frozen and shattered, sunk in the lake, taken by a saucer, carried off by balloons, launched on a rocket,
// melted, dropped down a hole, turned to dust, or given up the ghost. A scene starts where the person arrived and is
// drawn among the scene's sprites, sorted by depth like a person.
import { FateLogic } from './fate-logic.js';
import { SeasonLogic } from './season-logic.js';
import { PA } from './office-scene.js';
import { LOOK, hairTones } from './office-people.js';
import { shirtOf } from './office-people-xmas.js';
import { text3 } from './office-util.js';
import { hash } from './sky-island.js';
import { ClaudeOffice, mixin } from './office.js';

export const clamp = v => Math.max(0, Math.min(1, v)),
  ease = v => {
    const p = clamp(v);
    return p * p * (3 - 2 * p);
  },
  rr = ctx => (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  },
  oval = (ctx, x, y, rx, ry, c) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
    ctx.fill();
  };
// The person as they stood, moved (dx, dy), turned (rot), scaled (s, or sx / sy) and faded (a) round their feet;
// `extra` draws in the same frame (an umbrella, balloons, a rocket pack).
export function fig(S, G, f, x, y, o = {}, extra) {
  const { ctx } = G;
  ctx.save();
  ctx.translate(x + (o.dx || 0), y + (o.dy || 0));
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1);
  ctx.translate(-x, -y);
  if (o.a != null) ctx.globalAlpha = clamp(o.a);
  S.drawPerson(G, f.who);
  if (extra) extra();
  ctx.restore();
}
// A plain standing figure in one colour (a silhouette), feet at (x, y).
function doll(R, x, y, c) {
  R(x - 3, y - 6, 2, 6, c);
  R(x + 1, y - 6, 2, 6, c);
  R(x - 4, y - 14, 8, 8, c);
  R(x - 6, y - 14, 2, 6, c);
  R(x + 4, y - 14, 2, 6, c);
  R(x - 3, y - 21, 6, 7, c);
}
function skeleton(R, x, y) {
  const B = '#f4f4f4';
  doll(R, x, y, '#10131c');
  R(x - 3, y - 21, 6, 6, B);
  R(x - 2, y - 19, 1, 2, '#10131c');
  R(x + 1, y - 19, 1, 2, '#10131c');
  R(x - 1, y - 15, 2, 9, B);
  for (const ry of [14, 12, 10]) R(x - 3, y - ry, 6, 1, B);
  R(x - 5, y - 14, 1, 6, B);
  R(x + 4, y - 14, 1, 6, B);
  R(x - 3, y - 6, 1, 6, B);
  R(x + 2, y - 6, 1, 6, B);
}
// n wisps of smoke (or steam) rising from (x, y).
export function wisps(R, x, y, u, n, rgb = '90,90,100', rise = 18) {
  for (let k = 0; k < n; k++) {
    const p = (u * 0.6 + k / n) % 1;
    R(x + Math.sin(p * 6 + k * 2) * 3, y - p * rise, 2, 2, `rgba(${rgb},${(0.6 * (1 - p)).toFixed(2)})`);
  }
}
export function ripples(ctx, x, y, u, a = 1) {
  for (let k = 0; k < 2; k++) {
    const p = (u * 0.6 + k * 0.5) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${(0.6 * (1 - p) * a).toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 5 + p * 8, 2 + p * 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export const SCENES = {
  // A bolt from the sky: the skeleton shows through, a charred figure blinks, then a heap of ash smokes.
  lightning(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx);
    if (u < 0.9) {
      if (u < 0.14 || (u > 0.3 && u < 0.42)) {
        oval(ctx, x, y, 24, 11, 'rgba(255,255,255,0.4)');
        for (const [w, c] of [
          [3, '#fff7a8'],
          [1, '#ffffff'],
        ]) {
          ctx.strokeStyle = c;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(x + 46, y - 250);
          for (let k = 1; k <= 9; k++)
            ctx.lineTo(x + 46 * (1 - k / 10) + (hash(k, f.seed, 3) - 0.5) * 22, y - 250 + k * 23);
          ctx.lineTo(x, y - 20);
          ctx.stroke();
        }
      }
      if (Math.floor(u * 14) % 2) skeleton(R, x, y);
      else fig(S, G, f, x, y, { dx: Math.floor(u * 30) % 2 ? 1 : -1 });
      for (let k = 0; k < 5; k++) {
        const a = hash(k, Math.floor(u * 12), 5) * 6.3;
        R(x + Math.cos(a) * 10, y - 11 + Math.sin(a) * 11, 1, 1, '#fff7a8');
      }
    } else if (u < 1.7) {
      doll(R, x, y, '#1b1b1f');
      if (Math.floor(u * 5) % 3) {
        R(x - 2, y - 18, 1, 1, '#ffffff');
        R(x + 1, y - 18, 1, 1, '#ffffff');
      }
      wisps(R, x, y - 22, u, 3);
    } else {
      ctx.globalAlpha = 1 - clamp((u - 2.8) / 0.6);
      R(x - 6, y - 1, 12, 2, '#2a2a30');
      R(x - 4, y - 3, 8, 2, '#3a3a42');
      R(x - 2, y - 4, 4, 1, '#4a4a55');
      wisps(R, x, y - 5, u, 4);
      ctx.globalAlpha = 1;
    }
  },
  // The umbrella opens, the wind takes it, and its owner with it.
  wind(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      p = clamp((u - 0.6) / 3),
      open = ease(u / 0.5);
    for (let k = 0; k < 5; k++)
      R(x - 40 + ((u * 130 + k * 37) % 110), y - 4 - k * 7, 8, 1, `rgba(255,255,255,${0.5 * (1 - p)})`);
    fig(
      S,
      G,
      f,
      x,
      y,
      {
        dx: 150 * p * p + 20 * p,
        dy: -(95 * p * p + 12 * p) + (p ? Math.sin(u * 9) * 3 : 0),
        rot: p ? Math.sin(u * 5) * 0.45 + p * 1.1 : 0,
        s: 1 - 0.4 * p,
        a: 1 - (p - 0.7) / 0.3,
      },
      () => {
        const w = Math.round(7 * open);
        R(x + 5, y - 31, 1, 17, '#5a4636');
        R(x + 5 - w, y - 31, 2 * w + 1, 1, '#b5343a');
        R(x + 6 - w, y - 32, Math.max(1, 2 * w - 1), 1, '#e5484d');
        R(x + 5 - Math.round(w * 0.6), y - 33, Math.max(1, Math.round(w * 1.2) + 1), 1, '#e5484d');
        R(x + 5 - Math.round(w * 0.3), y - 34, Math.max(1, Math.round(w * 0.6) + 1), 1, '#f2777b');
      },
    );
  },
  // Ice creeps up from the feet, the block cracks, and it bursts into shards.
  freeze(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx);
    if (u < 2.4) {
      const h = Math.round(27 * clamp(u / 1.2)),
        shake = u < 1.2 || u > 2.15 ? (Math.floor(u * 24) % 2 ? 1 : -1) : 0;
      fig(S, G, f, x, y, { dx: shake });
      R(x - 9 + shake, y + 2 - h, 18, h, `rgba(150,215,255,${u < 1.2 ? 0.5 : 0.68})`);
      R(x - 9 + shake, y + 2 - h, 18, 1, 'rgba(255,255,255,0.85)');
      if (h > 8) R(x - 7 + shake, y + 5 - h, 1, h - 8, 'rgba(255,255,255,0.6)');
      if (h > 14) R(x + 5 + shake, y - 8, 2, 6, 'rgba(255,255,255,0.4)');
      const cracks = [
        [-2, -24, 1, 5],
        [-1, -19, 4, 1],
        [3, -19, 1, 6],
        [-6, -12, 5, 1],
        [-6, -12, 1, 7],
        [2, -8, 5, 1],
      ];
      cracks
        .slice(0, Math.max(0, Math.floor((u - 1.3) / 0.14)))
        .forEach(([cx, cy, w, hh]) => R(x + cx + shake, y + cy, w, hh, '#2f5f8a'));
    } else {
      const q = u - 2.4;
      for (let i = 0; i < 16; i++) {
        const a = hash(i, f.seed, 7) * 6.3,
          v = 35 + hash(i, f.seed, 8) * 60,
          py = Math.min(
            y + 1 + hash(i, f.seed, 11) * 7,
            y - 4 - hash(i, f.seed, 9) * 18 + Math.sin(a) * v * q * 0.5 + 150 * q * q,
          ),
          sz = 2 + Math.floor(hash(i, f.seed, 10) * 3);
        R(
          x + Math.cos(a) * v * q,
          py,
          sz,
          sz,
          `rgba(${i % 3 ? '170,225,255' : '255,255,255'},${clamp(1 - q / 1.7).toFixed(2)})`,
        );
      }
    }
  },
  // A misstep at the water's edge: down they go, one hand up with a thumb, then bubbles.
  lake(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      sk = f.who.skin,
      under = draw => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 30, y - 60, 60, 61);
        ctx.clip();
        draw();
        ctx.restore();
      };
    if (u < 0.4)
      for (let k = 0; k < 8; k++) {
        const a = Math.PI * (1 + (k + 0.5) / 8);
        R(x + Math.cos(a) * 34 * u, y + Math.sin(a) * 40 * u + 110 * u * u, 1, 2, '#eaf6ff');
      }
    if (u < 2.2) under(() => fig(S, G, f, x, y, { dy: 24 * (u / 2.2), dx: Math.sin(u * 18) * 1.5 }));
    else if (u < 3.4)
      under(() => {
        const hy = y - 7 + ((u - 2.2) / 1.2) * 9;
        R(x - 2, hy + 2, 4, 6, sk);
        R(x - 1, hy - 1, 2, 3, sk);
      });
    else
      for (let k = 0; k < 3; k++) {
        const p = ((u - 3.4) * 1.2 + k * 0.33) % 1;
        ctx.strokeStyle = `rgba(255,255,255,${(0.8 * (1 - p) * clamp((4.5 - u) / 0.5)).toFixed(2)})`;
        ctx.strokeRect(Math.round(x - 3 + k * 3) + 0.5, Math.round(y - 1 - p * 9) + 0.5, 2, 2);
      }
    ripples(ctx, x, y + 1, u, clamp((4.6 - u) / 0.8));
  },
  // A saucer comes down, its beam lifts the person aboard, and it is gone.
  ufo(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      q = clamp((u - 3.7) / 1.2),
      inn = 1 - ease(u / 1),
      ux = Math.round(x + 60 * inn + 260 * q * q),
      uy = Math.round(y - 80 - 170 * inn - 150 * q * q + (q ? 0 : Math.sin(u * 4) * 1.5)),
      p = clamp((u - 1.5) / 1.8);
    if (u > 1.2 && u < 3.5) {
      ctx.fillStyle = `rgba(190,255,170,${0.28 + 0.08 * Math.sin(u * 20)})`;
      ctx.beginPath();
      ctx.moveTo(ux - 5, uy + 4);
      ctx.lineTo(ux + 5, uy + 4);
      ctx.lineTo(x + 12, y + 1);
      ctx.lineTo(x - 12, y + 1);
      ctx.fill();
      oval(ctx, x, y + 1, 12, 4, 'rgba(210,255,190,0.4)');
    }
    if (u < 3.4)
      fig(S, G, f, x, y, { dy: -62 * p, s: 1 - 0.6 * p, rot: Math.sin(u * 6) * 0.25 * p, a: 1.6 - p * 1.6 + 0.4 });
    ctx.globalAlpha = 1 - q;
    oval(ctx, ux, uy + 2, 16, 4, '#5d6577');
    oval(ctx, ux, uy, 16, 4.5, '#aab3c5');
    ctx.fillStyle = '#8fe3f2';
    ctx.beginPath();
    ctx.ellipse(ux, uy - 2, 7, 6, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    R(ux - 4, uy - 6, 2, 1, '#e6fbff');
    for (let k = 0; k < 5; k++)
      R(ux - 12 + k * 6, uy + (k === 0 || k === 4 ? 0 : 1), 1, 1, (Math.floor(u * 6) + k) % 2 ? '#ffd166' : '#ff6b6b');
    ctx.globalAlpha = 1;
  },
  // A bunch of balloons, and up they drift, waving.
  balloon(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      p = clamp((u - 0.8) / 4.2),
      grow = ease(u / 0.8);
    fig(
      S,
      G,
      f,
      x,
      y,
      { dy: -(135 * p * p + 14 * p), dx: Math.sin(u * 1.6) * 6 * p + 34 * p, a: 1 - (p - 0.75) / 0.25 },
      () => {
        const B = [
          [-4, -42, '#e5484d'],
          [3, -47, '#ffd166'],
          [10, -41, '#3e8ed0'],
        ];
        ctx.strokeStyle = 'rgba(240,240,240,0.9)';
        ctx.lineWidth = 0.6;
        for (const [bx, by, c] of B) {
          ctx.beginPath();
          ctx.moveTo(x + 5, y - 15);
          ctx.lineTo(x + bx, y + by + 5);
          ctx.stroke();
          oval(ctx, x + bx, y + by, 4.2 * grow, 5.2 * grow, c);
          if (grow > 0.8) R(x + bx - 2, y + by - 3, 1, 2, 'rgba(255,255,255,0.8)');
        }
      },
    );
  },
  // Three, two, one: straight up on a rocket pack, a twinkle where they vanish.
  rocket(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      q = Math.max(0, u - 0.9),
      dy = -240 * q * q,
      fl = Math.floor(u * 20) % 2;
    for (let k = 0; k < 7; k++) {
      const tk = k * 0.09,
        age = q - tk;
      if (age <= 0 && u > 0.9) continue;
      const a0 = u < 0.9 ? (u * 1.3 + k / 7) % 1 : clamp(age / 1.1);
      oval(
        ctx,
        x - 2 + (hash(k, f.seed, 2) - 0.5) * (u < 0.9 ? 14 : 5 + age * 10),
        y - (u < 0.9 ? a0 * 4 : 240 * tk * tk),
        2 + a0 * 5,
        1.5 + a0 * 3.5,
        `rgba(225,225,232,${(0.7 * (1 - a0)).toFixed(2)})`,
      );
    }
    if (q < 0.85)
      fig(S, G, f, x, y, { dy, dx: u < 0.9 ? (fl ? 1 : -1) : 0, a: 1 - (q - 0.6) / 0.25 }, () => {
        R(x - 8, y - 16, 3, 9, '#d9534f');
        R(x - 8, y - 18, 3, 2, '#e9e9ee');
        R(x - 9, y - 9, 1, 3, '#8a2f2c');
        if (u > 0.9) {
          R(x - 8, y - 7, 3, 5 + fl * 2, '#ffb347');
          R(x - 7, y - 7, 1, 8 + fl * 2, '#fff3b0');
        }
      });
    if (u < 0.9) text3(ctx, String(3 - Math.floor(u / 0.3)), x - 1, y - 32, '#ffd166');
    if (q > 0.8 && q < 1.9) {
      const a = Math.sin(((q - 0.8) / 1.1) * Math.PI),
        n = Math.round(1 + 3 * a);
      R(x - n, y - 170, 2 * n + 1, 1, `rgba(255,255,255,${a.toFixed(2)})`);
      R(x, y - 170 - n, 1, 2 * n + 1, `rgba(255,255,255,${a.toFixed(2)})`);
    }
  },
  // Too hot: they sag into a puddle that dries up, two eyes blinking on it to the last.
  melt(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      p = clamp(u / 2.4),
      q = clamp((u - 2.4) / 1.8),
      k = 1 - 0.65 * q;
    ctx.globalAlpha = 0.9 * (1 - q);
    oval(ctx, x, y, (4 + 10 * p) * k, (2 + 4 * p) * k, shirtOf(f.who));
    oval(ctx, x - 2, y - 1, (2 + 5 * p) * k, (1 + 1.5 * p) * k, 'rgba(255,255,255,0.25)');
    ctx.globalAlpha = 1;
    if (p < 1) {
      fig(S, G, f, x, y, { sy: 1 - 0.9 * p, sx: 1 + 0.7 * p });
      for (let i = 0; i < 3; i++) {
        const d = (u * 1.5 + i * 0.33) % 1;
        R(x - 7 + i * 7, y - 20 * (1 - p) + d * 8, 1, 2, `rgba(150,210,255,${(1 - d).toFixed(2)})`);
      }
    } else {
      if (q < 0.85 && Math.floor(u * 3) % 4) {
        R(x - 2, y - 1, 1, 1, '#1a1a1a');
        R(x + 1, y - 1, 1, 1, '#1a1a1a');
      }
      wisps(R, x, y - 2, u, 3, '235,240,245', 16);
    }
  },
  // A hole opens underfoot. They hang there a moment with a sign, then drop; the sign follows.
  hole(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      k = ease(u / 0.25) * (1 - ease((u - 2.4) / 0.5)),
      q = Math.max(0, u - 1.1),
      q2 = Math.max(0, u - 1.45);
    oval(ctx, x, y, 10 * k, 4.5 * k, '#0d0b14');
    oval(ctx, x, y + 1, 8 * k, 3 * k, '#000000');
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 40, y - 80, 80, 83);
    ctx.clip();
    if (q < 0.9) fig(S, G, f, x, y, { dy: 170 * q * q, dx: q ? 0 : Math.floor(u * 10) % 2 });
    if (q2 < 0.9) {
      const sy = y - 34 + 170 * q2 * q2;
      R(x + 5, sy + 9, 1, 10, '#6b4a2f');
      R(x - 7, sy, 15, 9, '#2b2238');
      R(x - 6, sy + 1, 13, 7, '#f4f1e8');
      text3(ctx, 'BYE', x - 5, sy + 2, '#c0392b');
    }
    ctx.restore();
  },
  // They come apart into dust from one side, and the dust blows away.
  dust(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      wipe = clamp(u / 1.6),
      [hr] = hairTones(LOOK(f.who));
    if (wipe < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 9 + 18 * wipe, y - 40, 40, 46);
      ctx.clip();
      fig(S, G, f, x, y);
      ctx.restore();
    }
    for (let i = 0; i < 54; i++) {
      const h1 = hash(i, f.seed, 1),
        h2 = hash(i, f.seed, 2),
        q = u - 1.6 * h1;
      if (q <= 0 || q > 1.3) continue;
      const c = h2 > 0.9 ? hr : h2 > 0.68 ? f.who.skin : h2 > 0.28 ? shirtOf(f.who) : '#3b4252';
      ctx.globalAlpha = 1 - q / 1.3;
      R(x - 7 + 14 * h1 + 30 * q + Math.sin(q * 5 + i) * 3, y - 22 * h2 - 16 * q - 8 * q * q, 2, 2, c);
    }
    ctx.globalAlpha = 1;
  },
  // They keel over; a small ghost with a halo rises from them and drifts off.
  ghost(S, G, f, u, x, y) {
    const { ctx } = G,
      R = rr(ctx),
      q = clamp((u - 0.8) / 3.6);
    fig(S, G, f, x, y, { rot: -1.5 * ease(u / 0.45), a: (4.5 - u) / 0.9 });
    if (u > 0.8) {
      const gx = x - 10 + Math.sin(u * 2.2) * 5,
        gy = y - 6 - 72 * q,
        ph = Math.floor(u * 4) % 2,
        W = '#eef5ff';
      ctx.globalAlpha = 0.9 * Math.min(clamp((u - 0.8) / 0.4), 1 - clamp((q - 0.65) / 0.35));
      R(gx - 3, gy - 14, 6, 1, W);
      R(gx - 4, gy - 13, 8, 11, W);
      for (let k = 0; k < 3; k++) R(gx - 4 + k * 3 + ph, gy - 2, 2, 2, W);
      R(gx - 6, gy - 9 + ph, 2, 2, W);
      R(gx + 4, gy - 9 - ph + 1, 2, 2, W);
      R(gx - 2, gy - 10, 1, 2, '#30364a');
      R(gx + 1, gy - 10, 1, 2, '#30364a');
      R(gx - 1, gy - 6, 2, 1, '#30364a');
      R(gx - 3, gy - 17, 6, 1, '#ffd166');
      ctx.globalAlpha = 1;
    }
  },
};

mixin(
  ClaudeOffice,
  class {
    // What the weather, the season and the hour allow right now (FateLogic.conditions).
    fateCtx() {
      const env = this.env || {},
        season = this.seasonNow(),
        th = this.theme;
      return FateLogic.conditions({
        fx: env.fx,
        look: SeasonLogic.look(season),
        day: th && th._day != null ? th._day : 1,
        summer: season === 'summer',
        calm: env.reduced,
        ev: this.eventNow(),
      });
    }
    // Someone has reached the place of their fate (a.fated): keep how they looked and where they stood.
    startFate(a) {
      if (!SCENES[a.fate]) return;
      if (!this.fates) this.fates = [];
      if (this.fates.length > 12) this.fates.shift();
      const who = { ...a, moving: false, path: [], seated: false, sleeping: false, stool: false, actNow: null };
      this.fates.push({ kind: a.fate, x: a.x, y: a.y, t0: null, seed: a.id || 1, who });
    }
    // The scenes still playing, as sprites of the scene (the clock starts at a scene's first frame).
    fateItems(G, items) {
      if (!this.fates || !this.fates.length) return;
      this.fates = this.fates.filter(f => {
        if (f.t0 == null) f.t0 = G.t;
        return G.t - f.t0 < FateLogic.FATES[f.kind].dur;
      });
      for (const f of this.fates)
        items.push({
          z: f.x + f.y + 0.02,
          f: () => {
            const [x, y] = PA(f.x, f.y);
            SCENES[f.kind](this, G, f, G.t - f.t0, Math.round(x), Math.round(y));
          },
        });
    }
  },
);
