// Animals: drawing. Also borrowed by IslandScene (SCENE_METHODS), whose `animals` is always empty.
import { CameraLogic } from './camera-logic.js';
import { DogLogic } from './dog-logic.js';
import { SkyRender } from './sky-render.js';
import { AnimalWalk } from './animal-walk.js';
import { FADE_S, MANE, RAINBOW, TIER_COLOR, TRAIL_S, U, dot, nowS, rgba, safeFrame, star } from './animal-view-util.js';
import { DRAW_REACH, LW, PG, behindWalls } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';
mixin(
  ClaudeOffice,
  class {
    animalAlpha(a) {
      return a.fadeAt != null ? Math.max(0, 1 - ((this.animalNow || 0) - a.fadeAt) / FADE_S) : 1;
    }
    // The view moved on by the time since it arrived (countdowns only; endings come from the server).
    animalLive() {
      const v = this.state && this.state.animalView;
      return v && !v.disabled ? U.advance(v, performance.now() - (this.animalAt || 0)) : v || null;
    }
    // World islands (IslandScene) have no animals; "view as others" hides them like the hub would.
    animalShown() {
      return !(this.isLive && this.state.asOthers);
    }
    // One sorted pass's animals: back = the strip behind the office walls, drawn before them.
    animalItems(G, list, back, dfB, snB) {
      if (!this.animalShown()) return;
      for (const a of this.animals || [])
        if (behindWalls(Math.floor(a.x), Math.floor(a.y), DRAW_REACH) === back)
          list.push({ z: a.x + a.y, f: () => this.drawAnimal(G, a, G.t, dfB, snB) });
    }
    animalTier(species) {
      return U.tierOf(this.state && this.state.animalView, species) || 'common';
    }
    // Body baked per frame, light and snow like the dogs; the unicorn's mane (m, n) cycles unless motion is reduced.
    animalSprite(species, name, dfB, snB, mane) {
      const cache = this.animalSprites || (this.animalSprites = new Map()),
        k = species + '/' + name + '/' + dfB + '/' + snB + '/' + mane,
        hit = cache.get(k);
      if (hit) return hit;
      if (cache.size > 300) cache.clear();
      const f = safeFrame(species, name);
      if (!f) return null;
      const pal = species === 'unicorn' ? { ...f.pal, m: MANE[mane][0], n: MANE[mane][1] } : f.pal;
      const cv = document.createElement('canvas');
      cv.width = f.w;
      cv.height = f.h;
      const c = cv.getContext('2d'),
        top = new Array(f.w).fill(-1);
      f.rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch !== '.' && top[x] < 0) top[x] = y;
        }),
      );
      f.rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch === '.' || !pal[ch]) return;
          let col = pal[ch];
          if (snB >= 3 && top[x] === y) col = SkyRender.mix(col, '#eef3f7', (snB / 10) * 0.75);
          c.fillStyle = SkyRender.mix(col, '#0d1322', DogLogic.nightMix(dfB / 10));
          c.fillRect(x, y, 1, 1);
        }),
      );
      cache.set(k, cv);
      return cv;
    }
    // The rarity outline, unlit so night never dims it; one pixel larger on every side.
    animalOutline(species, name, tier) {
      const cache = this.animalOutlines || (this.animalOutlines = new Map()),
        k = species + '/' + name + '/' + tier,
        hit = cache.get(k);
      if (hit) return hit;
      const f = safeFrame(species, name);
      if (!f) return null;
      const cv = document.createElement('canvas');
      cv.width = f.w + 2;
      cv.height = f.h + 2;
      const c = cv.getContext('2d');
      c.fillStyle = TIER_COLOR[tier] || '#ffffff';
      for (const [x, y] of U.outline(f.rows)) c.fillRect(x, y, 1, 1);
      cache.set(k, cv);
      return cv;
    }
    // Inside the depth-sorted pass: shadow, the rare under-glow, the body, then its aura (so trees in front cover
    // both).
    drawAnimal(G, a, t, dfB, snB) {
      const { ctx, th } = G,
        p = AnimalWalk.pose(a, t),
        f = safeFrame(a.species, p.frame);
      if (!f) return;
      const reduced = !!(this.env && this.env.reduced),
        mane = a.species === 'unicorn' && !reduced ? Math.floor(t * 1.5) % MANE.length : 0;
      const img = this.animalSprite(a.species, p.frame, dfB, snB, mane);
      if (!img) return;
      let [sx, sy] = PG(a.x, a.y);
      sx = Math.round(sx);
      sy = Math.round(sy);
      const top = sy - f.h - p.dy,
        alpha = this.animalAlpha(a);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = th.shadow;
      ctx.beginPath();
      ctx.ellipse(sx, sy, Math.ceil(f.w / 2) - 1, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (this.animalTier(a.species) === 'rare') {
        ctx.globalAlpha = alpha * (a.kind === 'out' ? 0.5 : 1) * 0.4;
        ctx.fillStyle = TIER_COLOR.rare;
        ctx.beginPath();
        ctx.ellipse(sx, sy, Math.ceil(f.w / 2) + 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
      }
      if (p.flip) {
        ctx.save();
        ctx.translate(sx + 1, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -f.ax, top);
        ctx.restore();
      } else ctx.drawImage(img, sx - f.ax, top);
      ctx.globalAlpha = 1;
      ctx.save();
      this.drawAnimalAura(ctx, a, t, reduced, this.animalLive());
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // After the storm tint: the one-off effects (spawn dust, catch, escape), which glow through it.
    drawAnimalFx(G, t, dfB, snB) {
      if (!this.animalShown() || !this.animalFx || !this.animalFx.length) return;
      const { ctx } = G;
      ctx.save();
      for (const fx of this.animalFx || []) this.drawAnimalBurst(ctx, fx, t, dfB, snB);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    drawAnimalAura(ctx, a, t, reduced, v) {
      const p = AnimalWalk.pose(a, t),
        f = safeFrame(a.species, p.frame);
      if (!f) return;
      const tier = this.animalTier(a.species),
        col = TIER_COLOR[tier],
        k = (a.kind === 'out' ? 0.5 : 1) * this.animalAlpha(a),
        ph = a.phase || 0;
      let [sx, sy] = PG(a.x, a.y);
      sx = Math.round(sx);
      sy = Math.round(sy);
      const top = sy - f.h - p.dy,
        mid = sy - Math.round(f.h / 2);
      if (tier === 'legendary' && !reduced) this.drawAnimalTrail(ctx, a, t, k);
      if (tier === 'epic' || tier === 'legendary') {
        const o = this.animalOutline(a.species, p.frame, tier);
        ctx.globalAlpha =
          k * (tier === 'legendary' || reduced ? 0.9 : 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.4 + ph * 3)));
        if (o) {
          if (p.flip) {
            ctx.save();
            ctx.translate(sx + 1, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(o, -f.ax - 1, top - 1);
            ctx.restore();
          } else ctx.drawImage(o, sx - f.ax - 1, top - 1);
        }
      }
      if (!reduced) {
        if (tier === 'rare') {
          const cyc = t * 0.7 + ph,
            q = cyc % 3;
          if (q < 0.4) {
            const n = Math.floor(cyc / 3);
            ctx.globalAlpha = k * (1 - q / 0.4);
            star(ctx, sx + ((n * 7) % f.w) - f.w / 2, top + ((n * 5) % Math.max(1, f.h - 2)), '#bfe0ff');
          }
        }
        if (tier === 'epic')
          for (let i = 0; i < 3; i++) {
            const q = (t * 0.45 + i / 3 + ph) % 1;
            ctx.globalAlpha = k * (1 - q) * 0.9;
            dot(ctx, sx + Math.sin(i * 2.1 + ph * 5) * f.w * 0.45, mid + f.h * 0.3 - q * 16, col);
          }
        if (tier === 'legendary')
          for (let i = 0; i < 2; i++) {
            const ang = t * 1.6 + i * Math.PI + ph,
              back = Math.sin(ang) < 0;
            ctx.globalAlpha = k * (back ? 0.45 : 1);
            star(ctx, sx + Math.cos(ang) * (f.w / 2 + 4), mid + Math.sin(ang) * 3, col);
          }
      }
      if (a.kind === 'wild' && v && v.attempt && v.attempt.wildId === a.id)
        this.drawAnimalRing(ctx, sx, mid, Math.ceil(Math.max(f.w, f.h) / 2) + 3, tier, v.attempt, t, reduced);
      ctx.globalAlpha = 1;
    }
    drawAnimalTrail(ctx, a, t, k) {
      const pts = (this.animalTrails && this.animalTrails.get(a.key)) || [];
      pts.forEach((p, i) => {
        const [x, y] = PG(p.x, p.y),
          age = (t - p.t) / TRAIL_S;
        ctx.globalAlpha = k * Math.max(0, 1 - age) * 0.7;
        for (let j = 0; j < 3; j++) dot(ctx, x - 1, y - 3 - j, RAINBOW[(i + j) % RAINBOW.length], 2);
      });
    }
    // The catch ring fills with worked time; dim and still while no session works, full while a choice is pending.
    drawAnimalRing(ctx, cx, cy, R, tier, att, t, reduced) {
      const col = TIER_COLOR[tier],
        pending = att.phase === 'pending',
        live = pending || att.counting;
      const frac = pending ? 1 : Math.max(0, Math.min(1, att.workMs / Math.max(1, att.needMs)));
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = live ? 0.95 : 0.45;
      ctx.beginPath();
      ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.stroke();
      if (!live || reduced) return;
      const n = tier === 'epic' || tier === 'legendary' ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const ang = t * 1.2 + i * Math.PI,
          x = cx + Math.cos(ang) * R,
          y = cy + Math.sin(ang) * R;
        ctx.globalAlpha = 0.9;
        if (tier === 'legendary') star(ctx, x, y, col);
        else dot(ctx, x - 1, y - 1, i ? col : '#ffffff', 2);
      }
    }
    drawAnimalBurst(ctx, fx, t, dfB, snB) {
      const p = (t - fx.t0) / fx.dur;
      if (p < 0 || p >= 1) return;
      const col = TIER_COLOR[fx.tier] || '#ffffff',
        [sx, sy] = PG(fx.x, fx.y);
      if (fx.type === 'dust') {
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2,
            r = 2 + p * 7;
          ctx.globalAlpha = (1 - p) * 0.6;
          dot(ctx, sx + Math.cos(ang) * r * 1.4, sy + Math.sin(ang) * r * 0.5 - 1, '#d8d2c4', 2);
        }
      } else if (fx.type === 'sparkle') {
        for (let i = 0; i < 4; i++) {
          ctx.globalAlpha = 1 - p;
          star(ctx, sx + (i - 1.5) * 5, sy - 6 - p * 12 - (i % 2) * 3, col);
        }
      } else if (fx.type === 'break') {
        const R = 10 + p * 8;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 1 - p;
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + 0.3;
          ctx.beginPath();
          ctx.arc(sx, sy - 8, R, ang - 0.3, ang + 0.3);
          ctx.stroke();
        }
      } else if (fx.type === 'catch' || fx.type === 'recall') this.drawCatchFx(ctx, fx, p, col, sx, sy, dfB, snB);
      ctx.globalAlpha = 1;
    }
    drawCatchFx(ctx, fx, p, col, sx, sy, dfB, snB) {
      const f = safeFrame(fx.species, fx.frame),
        img = f && this.animalSprite(fx.species, fx.frame, dfB, snB, 0);
      if (!f || !img) return;
      const cy = sy - f.h / 2,
        R = Math.ceil(Math.max(f.w, f.h) / 2) + 3;
      if (fx.reduced) {
        ctx.globalAlpha = 1 - p;
        ctx.drawImage(img, sx - f.ax, sy - f.h);
        return;
      }
      if (fx.type === 'catch' && p < 0.4) {
        const q = p / 0.4;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 1 - q * 0.4;
        ctx.beginPath();
        ctx.arc(sx, cy, Math.max(0.5, R * (1 - q)), 0, Math.PI * 2);
        ctx.stroke();
      }
      const s = 1 - Math.min(1, p / 0.55);
      if (s > 0.02) {
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.translate(sx, cy - (1 - s) * 6);
        ctx.scale(fx.flip ? -s : s, s);
        ctx.drawImage(img, -f.ax, -f.h / 2);
        ctx.restore();
      }
      if (p > 0.45 && p < 0.75) {
        ctx.globalAlpha = 1;
        dot(ctx, sx - 1, cy - 7, '#ffffff', 3);
        dot(ctx, sx - 2, cy - 6, col, 1);
        dot(ctx, sx + 2, cy - 6, col, 1);
      }
      if (fx.type !== 'catch') return;
      if (fx.tier === 'epic')
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2,
            r = p * 18;
          ctx.globalAlpha = 1 - p;
          dot(ctx, sx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.7, col, 2);
        }
      if (fx.tier === 'legendary')
        for (let i = 0; i < 10; i++) {
          ctx.globalAlpha = 1 - p;
          star(ctx, sx + ((i * 37) % 34) - 17, cy - 22 + p * 30 + (i % 3) * 5, i % 2 ? col : '#ffffff');
        }
    }
    // Spawn columns and the legendary frame flash live on the front canvas, placed through the island camera.
    drawAnimalSky(ctx, w, hh, b) {
      const t = nowS(),
        s = this.wrapEl ? this.wrapEl.offsetWidth / LW : 1,
        lift = this.wrapTop || 0,
        v = b ? CameraLogic.skyView(this.cam, b) : null;
      for (const fx of this.animalFx) {
        const p = (t - fx.t0) / fx.dur;
        if (p < 0 || p >= 1) continue;
        const a = Math.sin(Math.PI * p),
          col = TIER_COLOR[fx.tier] || '#ffffff';
        if (fx.type === 'frame') {
          for (let i = 0; i < 4; i++) {
            ctx.strokeStyle = rgba(col, a * 0.6 * (1 - i / 4));
            ctx.lineWidth = 3;
            ctx.strokeRect(1.5 + i * 3, 1.5 + i * 3, w - 3 - i * 6, hh - 3 - i * 6);
          }
          continue;
        }
        if (fx.type !== 'column' || !v || !b) continue;
        const [sx, sy] = PG(fx.x, fx.y),
          x = v.ax + v.z * (b.ox + sx * s),
          y = v.ay + v.z * (b.oy + sy * s) + lift;
        const top = fx.tall ? 0 : y - 70 * s * v.z,
          half = Math.max(3, (fx.tall ? 7 : 5) * s * v.z);
        const g = ctx.createLinearGradient(0, top, 0, y);
        g.addColorStop(0, rgba(col, 0));
        g.addColorStop(0.6, rgba(col, 0.5 * a));
        g.addColorStop(1, rgba(col, 0.9 * a));
        ctx.fillStyle = g;
        ctx.fillRect(x - half, top, half * 2, y - top);
        ctx.fillStyle = rgba('#ffffff', 0.6 * a);
        ctx.fillRect(x - half / 4, top, half / 2, y - top);
      }
    }
  },
);
