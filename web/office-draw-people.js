import { SkyRender } from './sky-render.js';
import { DogLogic } from './dog-logic.js';
import { DogSprites } from './dog-sprites.js';
import { SmokeLogic } from './smoke-logic.js';
import { DESKS, ISLAND, OX, OY, P, PA, PG, TH, TW } from './office-scene.js';
import { bridgeZ, WATER_Z } from './island-land.js';
import { LOOK, PERSON } from './office-people.js';
import { ICON, ST, shade, text3 } from './office-util.js';
import { ClaudeOffice, mixin } from './office.js';
// Drawing people (at desks, walking, asleep, in the pond) and the office dogs.
mixin(
  ClaudeOffice,
  class {
    headPos(a) {
      if (a.stool && !a.moving) {
        const [sx, sy] = PA(a.x, a.y);
        return [sx, sy - (a.stool === 2 ? 30 : 25)];
      }
      if (a.sleeping) {
        const [hx, hy] = P(a.x - 0.45, a.y, 4);
        return [hx, hy];
      }
      const [sx, sy] = PA(a.x, a.y);
      if (a.actNow === 'bath' && !a.moving) return [sx, sy - 11];
      return [sx, sy - (a.seated ? 23 : 21)];
    }

    actArms(R, act, sx, by, t, sh, shD, sk) {
      const ph = Math.floor(t * 2) % 2,
        L = () => {
          R(sx - 5, by - 11, 1, 5, shD);
          R(sx - 5, by - 6, 1, 1, sk);
        };
      if (act === 'coffee') {
        L();
        R(sx + 4, by - 14 - ph, 1, 5, shD);
        R(sx + 4, by - 15 - ph, 1, 1, sk);
      } else if (act === 'fridge') {
        L();
        R(sx + 4, by - 11, 3, 1, shD);
        R(sx + 7, by - 11, 1, 1, sk);
      } else if (act === 'water') {
        L();
        const up = Math.floor(t * 0.7) % 3 === 0;
        R(sx + 4, by - 11, 1, up ? 2 : 4, shD);
        R(sx + 3, by - (up ? 14 : 9), 2, 3, '#ffffff');
      } else if (act === 'snack' || act === 'vending') {
        L();
        R(sx + 4, by - 10, 3, 1, shD);
        R(sx + 7, by - 10 - (Math.floor(t * 3) % 2), 1, 1, sk);
      } else if (act === 'microwave') {
        L();
        R(sx + 4, by - 13, 1, 5, shD);
        R(sx + 4, by - 14, 1, 1, sk);
      } else if (act === 'phone') {
        R(sx - 5, by - 11, 1, 4, shD);
        R(sx + 4, by - 11, 1, 4, shD);
        R(sx - 4, by - 8, 8, 1, sk);
        R(sx - 1, by - 11, 3, 4, '#1a1a1a');
        R(sx, by - 10, 1, 2, ph ? '#5ef2ff' : '#8be0b4');
      } else if (act === 'smoke') {
        // every few seconds the hand comes up for a slow drag; the rest of the time it rests at the waist
        L();
        if (SmokeLogic.cycle(t).drag) {
          R(sx + 4, by - 13, 1, 3, shD);
          R(sx + 2, by - 14, 2, 1, sk);
          R(sx, by - 13, 2, 1, '#f3efe2');
        } else {
          R(sx + 4, by - 11, 1, 4, shD);
          R(sx + 4, by - 7, 1, 1, sk);
          R(sx + 5, by - 8, 2, 1, '#f3efe2');
        }
      } else if (act === 'fish') {
        // the near hand rests at the waist, the far one holds the rod butt out toward the lake
        L();
        R(sx + 4, by - 11, 1, 3, shD);
        R(sx + 4, by - 8, 2, 1, sk);
      } else if (act === 'arcade') {
        // both hands forward on the control panel, the near one working the stick
        R(sx - 5, by - 12, 1, 4, shD);
        R(sx - 5, by - 13, 1, 1, sk);
        R(sx + 4, by - 12 - ph, 1, 4, shD);
        R(sx + 4, by - 13 - ph, 1, 1, sk);
      } else if (act === 'foosball') {
        // hands low on the rods, pushing and pulling in turn
        const p = Math.floor(t * 3) % 2;
        R(sx - 6 + p, by - 10, 2, 1, shD);
        R(sx - 7 + p, by - 10, 1, 1, sk);
        R(sx + 5 - p, by - 10, 2, 1, shD);
        R(sx + 7 - p, by - 10, 1, 1, sk);
      } else if (act === 'stretch') {
        const p = Math.floor(t * 1.5) % 2;
        R(sx - 6, by - 17 + p * 2, 2, 7, sh);
        R(sx + 4, by - 17 + (1 - p) * 2, 2, 7, sh);
        R(sx - 6, by - 18 + p * 2, 2, 1, sk);
        R(sx + 4, by - 18 + (1 - p) * 2, 2, 1, sk);
      } else L();
    }

    // Fishing at the rest corner: a rod from the hand up and out over the lake, a thin line down to a tiny float on
    // the lake's surface (WATER_Z under the lawn) a tile and a half out. The float bobs and now and then dips (a
    // nibble) with a ring spreading round it; with reduced motion it lies still. No allocation: one angler at most,
    // drawn every frame.
    drawRod(G, a, sx, by, t) {
      const { ctx, rect: R } = G,
        calm = this.env && this.env.reduced,
        nib = !calm && t % 7 < 0.6,
        tx = sx + 16,
        ty = by - 24 + (nib ? 2 : 0),
        fx = a.x + 1.5,
        fy = a.y + 0.2,
        bx = Math.round(OX + (fx - fy) * TW),
        bob = Math.round(OY + (fx + fy) * TH - WATER_Z) + (calm ? 0 : nib ? 1 : Math.round(Math.sin(t * 2.2) * 0.6));
      for (let k = 0; k <= 12; k++)
        R(
          sx + 5 + Math.round(((tx - sx - 5) * k) / 12),
          by - 8 + Math.round(((ty - by + 8) * k) / 12),
          1,
          1,
          '#6b4a2b',
        );
      ctx.strokeStyle = 'rgba(232,238,245,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx + 0.5, ty + 0.5);
      ctx.quadraticCurveTo(bx + 1.5, ty + 6, bx + 0.5, bob - 1);
      ctx.stroke();
      if (!calm) {
        const p = (t * 0.45) % 1;
        ctx.globalAlpha = 0.45 * (1 - p);
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(bx + 0.5, bob + 1, 2 + p * 5, 1 + p * 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      R(bx - 1, bob - 1, 2, 1, '#e5484d');
      R(bx - 1, bob, 2, 1, '#ffffff');
    }

    drawPerson(G, a) {
      const { ctx, poly, box, rect, th, t } = G;
      if (a.sleeping) return this.drawSleeper(G, a);
      let [sx, sy] = a.seated ? P(a.x, a.y, 11.5) : PA(a.x, a.y);
      sx = Math.round(sx);
      sy = Math.round(sy);
      if (a.status === 'error' && !a.moving && !a.seated) sx += Math.floor(t * 16) % 2 ? 1 : -1;
      if (this.state.sel === a.id) {
        const r = 0.45 + Math.sin(t * 5) * 0.05;
        poly([PA(a.x - r, a.y - r), PA(a.x + r, a.y - r), PA(a.x + r, a.y + r), PA(a.x - r, a.y + r)], null, '#ffd166');
      }
      if (a.status === 'idle' && !a.moving && a.actNow === 'bath') {
        // only head and shoulders above the water, ripples around
        const R = rect,
          bob = Math.round(Math.sin(t * 2 + a.id) * 0.6),
          y0 = sy + 1 + bob;
        for (let k = 0; k < 2; k++) {
          const p = (t * 0.5 + k * 0.5 + a.id * 0.13) % 1;
          ctx.strokeStyle = 'rgba(255,255,255,' + 0.55 * (1 - p) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(sx, sy + 1, 5 + p * 6, 2 + p * 2.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        R(sx - 4, y0 - 5, 8, 4, a.shirt);
        R(sx + 2, y0 - 5, 2, 4, shade(a.shirt, -30));
        R(sx - 3, y0 - 11, 6, 6, a.skin);
        R(sx + 2, y0 - 11, 1, 6, shade(a.skin, -25));
        PERSON.hairBath(R, LOOK(a), sx, y0, a.skin);
        R(sx - 2, y0 - 8, 1, 1, '#1a1a1a');
        R(sx + 1, y0 - 8, 1, 1, '#1a1a1a');
        ctx.fillStyle = 'rgba(120,190,240,0.55)';
        ctx.beginPath();
        ctx.ellipse(sx, y0 - 1, 6, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (a.parent) {
          R(sx - 3, y0 - 13, 6, 1, '#ffd166');
        }
        return;
      }
      if (!a.seated) {
        ctx.fillStyle = th.shadow;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const R = rect,
        sh = a.shirt,
        shD = shade(sh, -30),
        shL = shade(sh, 30),
        sk = a.skin,
        skD = shade(sk, -25),
        L = LOOK(a),
        st = a.status;
      if (a.seated) {
        const skey =
          st === 'working' && a.tool && a.tool[0] === 'Bash'
            ? 'terminal'
            : st === 'talking'
              ? 'visitor'
              : st === 'waiting'
                ? 'subagent'
                : st;
        if (skey === 'reading') {
          sx += 1;
          sy -= 1;
        }
        if (skey === 'thinking' || skey === 'terminal') {
          sx -= 1;
          sy += 1;
        }
        if (skey === 'error') sx += Math.floor(t * 16) % 2 ? 1 : -1;
        const ph = Math.floor(t * 8) % 2;
        const pre = [],
          post = [];
        if (skey === 'working') {
          post.push(() => {
            R(sx + 5, sy - 10, 2, 3, shD);
            R(sx + 7, sy - 11, 4, 2, sh);
            R(sx + 11, sy - 11 - ph, 2, 2, sk);
          });
          pre.push(() => {
            R(sx + 8, sy - 13, 3, 2, shD);
            R(sx + 11, sy - 13 + ph, 2, 2, skD);
          });
        } else if (skey === 'reading') {
          post.push(() => {
            R(sx + 5, sy - 10, 2, 3, shD);
            R(sx + 7, sy - 10, 5, 2, sh);
            R(sx + 12, sy - 10, 2, 2, sk);
          });
        } else if (skey === 'terminal') {
          const up = Math.floor(t * 0.6) % 3 === 0;
          post.push(() => {
            R(sx + 5, sy - 10, 2, 3, shD);
            R(sx + 7, sy - 10, 4, 2, sh);
            R(sx + 11, sy - 10, 2, 2, sk);
            R(sx - 7, sy - 11, 2, 4, sh);
            R(sx - 7, sy - (up ? 17 : 14), 2, 4, sh);
            R(sx - 8, sy - (up ? 20 : 17), 2, 2, sk);
            R(sx - 10, sy - (up ? 22 : 19), 3, 4, '#c0392b');
            R(sx - 11, sy - (up ? 21 : 18), 1, 2, '#c0392b');
            if (!up)
              for (let k = 0; k < 2; k++) {
                const p = (t * 0.9 + k * 0.5) % 1;
                ctx.globalAlpha = 0.7 * (1 - p);
                R(sx - 9 + (k % 2), sy - 21 - p * 7, 1, 2, '#e6e9ef');
                ctx.globalAlpha = 1;
              }
          });
        } else if (skey === 'thinking') {
          post.push(() => {
            R(sx + 5, sy - 15, 2, 5, shD);
            R(sx + 4, sy - 19, 2, 4, sh);
            R(sx + 3, sy - 20, 2, 2, sk);
            R(sx - 6, sy - 10, 1, 5, shD);
          });
        } else if (skey === 'permission') {
          const w = Math.floor(t * 3) % 2;
          post.push(() => {
            R(sx + 5, sy - 22 - w, 2, 12 + w, sh);
            R(sx + 5, sy - 24 - w, 2, 2, sk);
            R(sx + 4, sy - 25 - w, 1, 2, sk);
            R(sx - 6, sy - 10, 1, 5, shD);
          });
        } else if (skey === 'error') {
          post.push(() => {
            R(sx - 7, sy - 18, 2, 8, sh);
            R(sx + 5, sy - 18, 2, 8, shD);
            R(sx - 6, sy - 21, 2, 3, sk);
            R(sx + 4, sy - 21, 2, 3, sk);
            for (let k = 0; k < 3; k++) {
              const p = (t * 0.8 + k * 0.33) % 1;
              ctx.globalAlpha = 0.6 * (1 - p);
              R(sx - 2 + k * 2 + Math.round(Math.sin(p * 7) * 1.5), sy - 24 - p * 9, 2, 2, '#aab2c5');
              ctx.globalAlpha = 1;
            }
          });
        } else if (skey === 'done') {
          const b = Math.floor(t * 4) % 2;
          post.push(() => {
            R(sx - 8, sy - 23 - b, 2, 13, sh);
            R(sx + 6, sy - 23 - b, 2, 13, shD);
            R(sx - 9, sy - 25 - b, 2, 2, sk);
            R(sx + 7, sy - 25 - b, 2, 2, sk);
          });
        } else if (skey === 'visitor') {
          const g = Math.floor(t * 2) % 2;
          post.push(() => {
            R(sx + 5, sy - 10, 2, 3, shD);
            R(sx + 7, sy - 12 - g, 3, 2, sh);
            R(sx + 10, sy - 13 - g, 2, 2, sk);
            R(sx - 6, sy - 10, 1, 5, shD);
          });
        } else if (skey === 'subagent') {
          post.push(() => {
            R(sx - 5, sy - 8, 10, 2, shL);
            R(sx - 6, sy - 10, 1, 4, shD);
            R(sx + 5, sy - 10, 1, 4, shD);
          });
        } else {
          post.push(() => {
            R(sx - 6, sy - 10, 1, 5, shD);
            R(sx + 5, sy - 10, 1, 5, shD);
          });
        }
        pre.forEach(f => f());
        R(sx - 5, sy - 11, 10, 11, sh);
        R(sx + 2, sy - 11, 3, 11, shD);
        R(sx - 5, sy - 11, 10, 1, shL);
        R(sx - 1, sy - 10, 1, 9, shD);
        R(sx - 1, sy - 13, 3, 2, skD);
        const hy = sy - 21 + (skey === 'reading' ? 1 : 0);
        if (skey === 'visitor' || skey === 'permission') PERSON.hairProfile(R, L, sx, hy, sh, sk);
        else PERSON.hairSeat(R, L, sx, hy, sh, sk);
        post.forEach(f => f());
        if (a.parent) {
          R(sx - 3, hy - 1, 6, 2, '#ffd166');
          R(sx, hy - 4, 1, 3, '#ffd166');
          R(sx - 1, hy - 5, 3, 1, '#ffffff');
        }
        const ix = sx + 4,
          iy = sy - 36;
        const _icon = (bg, pat) => {
          R(ix - 1, iy - 1, 7, 7, bg);
          R(ix + 1, iy + 6, 3, 1, bg);
          R(ix + 2, iy + 7, 1, 1, bg);
          pat.forEach((row, ry) =>
            [...row].forEach((ch, rx) => {
              if (ch === '#') R(ix + rx, iy + ry, 1, 1, '#ffffff');
            }),
          );
        };
        if (skey === 'thinking') {
          R(ix - 4, iy + 1, 13, 7, '#ffffff');
          R(ix - 5, iy + 2, 15, 5, '#ffffff');
          R(ix - 2, iy + 9, 2, 2, '#ffffff');
          R(ix - 4, iy + 12, 1, 1, '#ffffff');
          const n = Math.floor(t * 3) % 4;
          for (let k = 0; k < 3; k++) R(ix - 1 + k * 4, iy + 4, 2, 2, k < n ? '#8e4ec6' : '#d6c7ea');
        } else if (skey === 'permission' && Math.floor(t * 3) % 2)
          _icon('#f5a524', ['..#..', '..#..', '..#..', '.....', '..#..']);
        else if (skey === 'error') _icon('#e5484d', ['#...#', '.#.#.', '..#..', '.#.#.', '#...#']);
        else if (skey === 'done') {
          _icon('#46a758', ['....#', '...#.', '#.#..', '.#...', '.....']);
          const cc = ['#e5484d', '#ffd166', '#46a758', '#3e8ed0', '#e93d82'];
          for (let k = 0; k < 12; k++) {
            const p = (t * 0.6 + k * 0.083) % 1;
            R(sx - 18 + ((k * 11) % 36), sy - 34 + p * 36, 1 + (k % 2), 1, cc[k % 5]);
          }
        } else if (skey === 'subagent') {
          const r = Math.floor(t * 1.2) % 4;
          _icon('#c9a227', ['#####', '.###.', '..#..', '.###.', '#####']);
          if (r === 1 || r === 3) R(ix + 2, iy + 2, 1, 1, '#ffd166');
        }
      } else {
        const sit = a.stool && !a.moving;
        const walk = a.moving ? Math.floor(t * 9 + a.id) % 2 : 0,
          tap = st === 'waiting' && !a.moving ? Math.floor(t * 5) % 2 : 0,
          by = sy - (a.moving && walk ? 1 : 0) - (sit ? (a.stool === 2 ? 9 : 4) : 0);
        const l1 = walk ? 1 : 0,
          l2 = walk ? 0 : tap ? 1 : 0;
        R(sx - 4, by - 11, 8, 7, sh);
        R(sx + 2, by - 11, 2, 7, shD);
        R(sx - 4, by - 11, 1, 7, shL);
        // the top (collar and tie, hoodie, open jacket or cardigan, blouse, dress) and its sleeve colour for the arms
        const slv = PERSON.top(R, L, sx, by, sh, sk, skD, a.dirFront),
          slvD = shade(slv, -30);
        if (sit) PERSON.legsSit(R, L, sx, by, sh);
        else PERSON.legs(R, L, sx, by, sh, l1, l2, a.dirFront);
        const sw = a.moving ? (walk ? 1 : -1) : 0,
          wave = st === 'talking' && !a.moving ? Math.floor(t * 4) % 2 : 0,
          up = st === 'done' && !a.moving;
        const act = !a.moving && st === 'idle' ? a.actNow : null;
        const tp = t + a.id * 1.37; // per-person phase, so a group of smokers never moves in step
        if (act && (!sit || act === 'smoke')) {
          this.actArms(R, act, sx, by, act === 'smoke' ? tp : t, slv, slvD, sk);
        } else if (up) {
          R(sx - 6, by - 17, 2, 7, slv);
          R(sx + 4, by - 17, 2, 7, slv);
          R(sx - 6, by - 18, 2, 2, sk);
          R(sx + 4, by - 18, 2, 2, sk);
        } else {
          R(sx - 5, by - 11 + sw, 1, 5, slvD);
          R(sx - 5, by - 6 + sw, 1, 1, sk);
          if (st === 'waiting' && !a.moving) {
            R(sx + 4, by - 10, 1, 3, slvD);
            R(sx + 3, by - 7, 1, 1, sk);
          } else {
            R(sx + 4, by - 11 - sw - (wave ? 3 : 0), 1, 5, slvD);
            R(sx + 4, by - 6 - sw - (wave ? 3 : 0), 1, 1, sk);
          }
        }
        R(sx - 1, by - 12, 2, 1, skD);
        const hy = by - 18;
        R(sx - 3, hy, 6, 6, sk);
        R(sx + 2, hy, 1, 6, skD);
        if (a.dirFront) {
          PERSON.hairFront(R, L, sx, hy, sh);
          const blink = (t + a.id * 0.71) % 3.2 < 0.12;
          PERSON.face(
            R,
            L,
            sx,
            hy,
            sk,
            skD,
            blink,
            st === 'talking' && !a.moving && Math.floor(t * 6) % 2,
            a.acc === 'glasses',
          );
        } else PERSON.hairBack(R, L, sx, hy, sh, sk);
        if (a.acc === 'headset') {
          R(sx - 3, hy - 2, 6, 1, '#1a1a1a');
          R(sx - 4, hy + 1, 1, 3, '#1a1a1a');
          R(sx + 3, hy + 1, 1, 3, '#1a1a1a');
        }
        if (act === 'smoke') {
          // ember at the cigarette tip (brighter during a drag), a thin wisp rising off it, a puff after each drag
          const { drag, exhale } = SmokeLogic.cycle(tp),
            [ex, ey] = drag ? [sx - 1, by - 13] : [sx + 7, by - 8],
            reduced = this.env && this.env.reduced;
          if (G.df < 0.6) {
            ctx.globalAlpha = 0.35 * (1 - G.df / 0.6);
            R(ex - 1, ey, 3, 1, '#ff9a3d');
            R(ex, ey - 1, 1, 3, '#ff9a3d');
            ctx.globalAlpha = 1;
          }
          R(ex, ey, 1, 1, drag ? '#ffb347' : '#e5484d');
          if (!reduced) {
            for (let k = 0; k < 3; k++) {
              const p = (tp * 0.3 + k / 3) % 1,
                s = p > 0.55 ? 2 : 1;
              ctx.globalAlpha = 0.5 * (1 - p);
              R(ex + p * 5 + Math.sin(tp * 1.3 + k * 2.1) * 1.2, ey - 2 - p * 14, s, s, '#dfe3ea');
            }
            if (exhale !== null) {
              const p = exhale;
              ctx.globalAlpha = 0.45 * (1 - p);
              R(sx + 1 + p * 5, by - 14 - p * 7, 2 + Math.round(p * 3), 2, '#e6e9ef');
            }
            ctx.globalAlpha = 1;
          }
        }
        if (act === 'fish') this.drawRod(G, a, sx, by, tp);
        if (st === 'idle' && !a.moving && a.actNow === 'table') {
          R(sx + 4, by - 9, 2, 3, '#ffffff');
          R(sx + 6, by - 8, 1, 1, '#ffffff');
          if (Math.floor(t * 2 + a.id) % 2) R(sx + 4, by - 12, 1, 2, '#c9cfdc');
        }
        if (a.parent) {
          R(sx - 3, hy - 2, 6, 2, '#ffd166');
          R(sx, hy - 5, 1, 3, '#ffd166');
          R(sx - 1, hy - 6, 3, 1, '#ffffff');
        }
        if (st === 'talking' && !a.moving) {
          for (let k = 0; k < 3; k++) {
            if ((Math.floor(t * 4) + k) % 3 === 0) continue;
            R(sx - 8 - k * 2, hy + 2 - k, 1, 1 + k, '#ffffff');
          }
        }
        if (th.stroke) {
          ctx.strokeStyle = '#33415c';
          ctx.strokeRect(sx - 4.5, hy - 1.5, 9, 19);
        }
      }
      if (!a.seated) {
        const [hx, hy] = this.headPos(a),
          col = (ST[st] || ST.working)[1];
        if (st === 'thinking') {
          const n = Math.floor(t * 3) % 4;
          R(hx - 6, hy - 8, 13, 6, '#ffffff');
          R(hx - 7, hy - 7, 15, 4, '#ffffff');
          R(hx - 2, hy - 1, 2, 2, '#ffffff');
          for (let k = 0; k < 3; k++) R(hx - 4 + k * 4, hy - 6, 2, 2, k < n ? '#5b8def' : '#c8d2e6');
        } else if (st === 'idle' && !a.actNow) {
          for (let k = 0; k < 2; k++) {
            const p = (t * 0.6 + k * 0.5) % 1;
            ctx.globalAlpha = 1 - p;
            text3(ctx, 'Z', hx + 2 + p * 6, hy - 6 - p * 12, th.stroke ? '#33415c' : '#e6e9ef');
            ctx.globalAlpha = 1;
          }
        } else if (st === 'done') {
          const cc = ['#e5484d', '#ffd166', '#46a758', '#3e8ed0', '#e93d82'];
          for (let k = 0; k < 7; k++) {
            const p = (t * 0.8 + k * 0.17) % 1;
            R(hx - 9 + ((k * 7 + a.id * 3) % 18), hy - 14 + p * 16, 1, 1, cc[k % 5]);
          }
          R(hx - 4, hy - 9, 9, 9, col);
          ICON.done.forEach((row, ry) =>
            [...row].forEach((ch, rx) => {
              if (ch === '#') R(hx - 2 + rx, hy - 7 + ry, 1, 1, '#ffffff');
            }),
          );
        } else if (ICON[st] && st !== 'talking' && !(st === 'permission' && Math.floor(t * 3) % 2)) {
          R(hx - 4, hy - 9, 9, 9, col);
          R(hx - 1, hy, 3, 1, col);
          ICON[st].forEach((row, ry) =>
            [...row].forEach((ch, rx) => {
              if (ch === '#') R(hx - 2 + rx, hy - 7 + ry, 1, 1, '#ffffff');
            }),
          );
        }
      }
    }
    // A dog's frame baked once per light level and snow level (like the island), then stamped with one drawImage.
    dogSprite(breed, name, dfB, snB) {
      const k = breed + '/' + name + '/' + dfB + '/' + snB,
        hit = this.dogSprites.get(k);
      if (hit) return hit;
      if (this.dogSprites.size > 300) this.dogSprites.clear();
      const f = DogSprites.frame(breed, name),
        pal = DogSprites.BREEDS[breed].pal,
        cv = document.createElement('canvas');
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
          if (ch === '.') return;
          let col = pal[ch];
          // Snow settles on whatever faces the sky: the top pixel of each column (back, head, ears, tail).
          if (snB >= 3 && top[x] === y) col = SkyRender.mix(col, '#eef3f7', (snB / 10) * 0.75);
          c.fillStyle = SkyRender.mix(col, '#0d1322', DogLogic.nightMix(dfB / 10));
          c.fillRect(x, y, 1, 1);
        }),
      );
      this.dogSprites.set(k, cv);
      return cv;
    }
    drawDog(G, d, t, dfB, snB) {
      const { ctx, th, rect } = G,
        p = DogLogic.pose(d, t),
        f = DogSprites.frame(d.breed, p.frame),
        img = this.dogSprite(d.breed, p.frame, dfB, snB);
      let [sx, sy] = PG(d.x, d.y, bridgeZ(ISLAND.bridge, d.x, d.y));
      sx = Math.round(sx);
      sy = Math.round(sy);
      const top = sy - f.h - p.dy,
        dir = p.flip ? -1 : 1,
        nose = sx + dir * (f.w - f.ax - 1);
      ctx.fillStyle = th.shadow;
      ctx.beginPath();
      ctx.ellipse(sx, sy, Math.ceil(f.w / 2) - 1, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Mirroring is a transform on one drawImage; column ax lands on sx either way.
      if (p.flip) {
        ctx.save();
        ctx.translate(sx + 1, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -f.ax, top);
        ctx.restore();
      } else ctx.drawImage(img, sx - f.ax, top);
      if (d.act === 'drink' && !d.path.length)
        for (let k = 0; k < 2; k++) {
          const q = (t * 0.7 + k * 0.5 + d.id * 0.3) % 1;
          ctx.strokeStyle = 'rgba(255,255,255,' + 0.5 * (1 - q) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(nose + dir * 2, sy, 2 + q * 4, 1 + q * 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      if (d.act === 'sleep') {
        const q = (t * 0.3 + d.id * 0.33) % 1;
        ctx.globalAlpha = Math.min(1, (1 - q) * 1.5) * 0.85;
        text3(ctx, 'Z', sx + dir * 3 + q * 5, top - 2 - q * 12, '#e6e9ef');
        ctx.globalAlpha = 1;
      }
      // Sitting down by a person: one small heart floats up and fades.
      if (d.act === 'sit' && d.greet != null) {
        const q = (this.dogWorld.now - (d.since || 0)) / 2.5;
        if (q < 1) {
          ctx.globalAlpha = 1 - q * q;
          const hx = nose - dir * 3 - 2,
            hy = Math.round(top - 4 - q * 8);
          [
            [1, 0],
            [3, 0],
            [0, 1],
            [1, 1],
            [2, 1],
            [3, 1],
            [4, 1],
            [1, 2],
            [2, 2],
            [3, 2],
            [2, 3],
          ].forEach(([a, b]) => rect(hx + a, hy + b, 1, 1, '#e93d82'));
          ctx.globalAlpha = 1;
        }
      }
    }
    drawSleeper(G, a) {
      const { ctx, poly, box, rect, th, t } = G,
        d = DESKS[a.desk],
        x = d.gx,
        y = d.gy;
      poly(
        [P(x + 0.08, y + 0.3, 0.5), P(x + 1.32, y + 0.3, 0.5), P(x + 1.32, y + 1.12, 0.5), P(x + 0.08, y + 1.12, 0.5)],
        th.stroke ? '#ffffff' : '#d9c27a',
      );
      for (let k = 1; k < 8; k++)
        poly(
          [
            P(x + 0.08, y + 0.3 + k * 0.1, 0.5),
            P(x + 1.32, y + 0.3 + k * 0.1, 0.5),
            P(x + 1.32, y + 0.31 + k * 0.1, 0.5),
            P(x + 0.08, y + 0.31 + k * 0.1, 0.5),
          ],
          th.stroke ? '#dfe5ef' : '#b89f5a',
          null,
        );
      poly(
        [P(x + 0.08, y + 1.12, 0.5), P(x + 1.32, y + 1.12, 0.5), P(x + 1.32, y + 1.12, 0), P(x + 0.08, y + 1.12, 0)],
        th.stroke ? '#c9d3e3' : '#a68b45',
        null,
      );
      const br = Math.sin(t * 2.2 + a.id) * 0.4;
      box(x + 0.14, y + 0.42, 0.26, 0.4, 0.5, 2.5, '#f6f4ee');
      box(x + 0.2, y + 0.5, 0.2, 0.24, 2.5, 6, a.skin);
      box(x + 0.18, y + 0.48, 0.12, 0.28, 2.5, 6.5, a.hair);
      // long hair fans out over the pillow; a bun or a ponytail sits at the back of the head
      const hs = LOOK(a).hairStyle;
      if (hs === 'long' || hs === 'wavy' || hs === 'bob')
        box(x + 0.09, y + 0.44, 0.11, hs === 'bob' ? 0.32 : 0.38, 0.5, hs === 'bob' ? 4 : 3, a.hair);
      else if (hs === 'bun') box(x + 0.12, y + 0.56, 0.07, 0.12, 4, 6.5, a.hair);
      else if (hs === 'ponytail') box(x + 0.08, y + 0.58, 0.11, 0.08, 0.5, 2.5, shade(a.hair, -26));
      if (a.parent) box(x + 0.18, y + 0.48, 0.08, 0.28, 6.5, 7, '#ffd166');
      box(x + 0.4, y + 0.44, 0.34, 0.36, 0.5, 4.5 + br, a.shirt);
      const bl = shade(a.shirt, -50) === a.shirt ? '#5b8def' : ['#3e8ed0', '#e5484d', '#46a758', '#8e4ec6'][a.id % 4];
      box(x + 0.6, y + 0.4, 0.62, 0.44, 0.5, 4 + br * 0.6, bl);
      [0.75, 0.92, 1.09].forEach(k =>
        poly(
          [
            P(x + k, y + 0.4, 4 + br * 0.6),
            P(x + k + 0.05, y + 0.4, 4 + br * 0.6),
            P(x + k + 0.05, y + 0.84, 4 + br * 0.6),
            P(x + k, y + 0.84, 4 + br * 0.6),
          ],
          shade(bl, 40),
          null,
        ),
      );
      box(x + 1.2, y + 0.5, 0.08, 0.1, 0.5, 2, '#141414');
      box(x + 1.2, y + 0.66, 0.08, 0.1, 0.5, 2, '#141414');
    }
  },
);
