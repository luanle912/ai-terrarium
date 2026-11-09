// Drawing the office furniture: desks with their workstation, planters, glass partitions and the pantry pieces.
import { PantryItems } from './pantry-items.js';
import { PropUse } from './prop-use.js';
import { P, lerpHex, mix } from './office-scene.js';
import { shade, vacantTheme } from './office-util.js';
import { ClaudeOffice, mixin } from './office.js';
// Each pantry piece's prop index (web/prop-use.js), and one options object reused for every piece (drawing is
// synchronous), so the pieces read o.night and o.use without an object per piece per frame.
const PROP_OF = PropUse.layoutProps(PantryItems.LAYOUT),
  PO = { night: false, use: 0 };
mixin(
  ClaudeOffice,
  class {
    drawSeg(G, sg, own) {
      if (sg.zi === 4) return;
      const { ctx, box, th } = G,
        dk = sg.zi < 4 ? own[sg.zi] : null,
        col = sg.zi === 4 ? '#a8763e' : dk ? this.depts.get(dk).color : shade(th.trim, 10),
        base = th.stroke ? '#ffffff' : shade(th.trim, -20);
      const [x, y, w, hh] = sg.v ? [sg.X - 0.06, sg.y, 0.12, 1] : [sg.x, sg.Y - 0.06, 1, 0.12];
      box(x, y, w, hh, 0, 4, base);
      ctx.globalAlpha = th.stroke ? 0.5 : 0.3;
      box(
        sg.v ? x + 0.02 : x,
        sg.v ? y : y + 0.02,
        sg.v ? 0.08 : 1,
        sg.v ? 1 : 0.08,
        4,
        11,
        '#bfe3ff',
        '#9fd3ff',
        '#7fbbea',
      );
      ctx.globalAlpha = 1;
      box(x, y, w, hh, 11, 12.5, col);
    }

    // The pantry is screened from the office by a concrete planter: bamboo rising over a bed of leafy plants.
    drawPlanter(G, sg) {
      const { box, rect, th, df } = G,
        y = sg.y,
        S = th.stroke;
      box(19.72, y, 0.56, 1, 0, 10, S ? '#ffffff' : lerpHex('#454b5c', '#c2beb3', df));
      if (S) return;
      box(
        19.8,
        y + (y === 0 || y === 8 ? 0.06 : 0),
        0.4,
        1 - (y === 0 || y === 8 ? 0.06 : 0) - (y === 5 || y === 13 ? 0.06 : 0),
        9.5,
        10,
        '#4a3527',
      );
      const g = th.plant,
        gD = shade(g, -30),
        gL = shade(g, 25),
        bam = mix(g, '#c9d46a', 0.5),
        n = k => ((y * 7 + k * 5) % 9) / 9;
      for (let k = 0; k < 4; k++) {
        const yy = y + 0.14 + k * 0.24,
          xx = 19.84 + ((y * 3 + k) % 4) * 0.1,
          top = 34 + Math.round(n(k) * 16);
        const [bx, b0] = P(xx, yy, 10),
          b1 = P(xx, yy, top)[1];
        rect(bx, b1, 1, b0 - b1, k % 2 ? bam : shade(bam, -28));
        for (let z = 16; z < top - 2; z += 7) rect(bx, P(xx, yy, z)[1], 1, 1, shade(bam, -50));
        for (let z = top - 20; z <= top + 1; z += 3) {
          const ly = P(xx, yy, z)[1],
            c = (z + k) % 3 ? g : gL;
          if (((z >> 1) + k) % 2) {
            rect(bx + 1, ly, 3, 1, c);
            rect(bx + 3, ly + 1, 2, 1, gD);
          } else {
            rect(bx - 3, ly, 3, 1, c);
            rect(bx - 4, ly + 1, 2, 1, gD);
          }
        }
      }
      const [px, py] = P(20, y + 0.5, 10);
      [
        [-8, -5, 6, 5, gD],
        [-4, -8, 7, 7, g],
        [2, -6, 6, 6, gL],
        [-1, -11, 4, 4, g],
        [5, -9, 4, 4, gD],
      ].forEach(([a, b, w, hh, c]) => rect(px + a, py + b, w, hh, c));
      if (y % 2 === 0) {
        rect(px - 6, py - 17, 2, 9, gD);
        rect(px - 9, py - 20, 5, 5, gL);
        rect(px + 4, py - 15, 2, 7, g);
        rect(px + 4, py - 19, 5, 5, g);
      }
    }

    pantryItems(G, items) {
      const { ctx, th, t, df } = G,
        PI = PantryItems;
      if (!PI) return;
      const isNight = df < 0.5,
        lit = this.propLit || PropUse.DARK;
      const Z = PI.depths(PI.LAYOUT);
      PI.LAYOUT.forEach(([name, rx, ry, rz], i) => {
        const it = PI.I[name];
        if (!it) return;
        const ox = 20 + rx,
          oy = ry;
        items.push({
          z: Z[i],
          f: () => {
            const [sx, sy] = P(ox, oy);
            const k = PI.kit(ctx, sx, sy - rz);
            if (!it.flat && !it.wall && name !== 'pendant' && rz === 0 && name !== 'planter')
              k.shadow(0, 0, it.size[0], it.size[1], 0.22);
            PO.night = isNight;
            PO.use = PROP_OF[i] >= 0 ? lit[PROP_OF[i]] : 0;
            it.draw(k, t, PO);
          },
        });
      });
    }

    drawDesk(G, d, i) {
      const { ctx, poly, box, rect, t, df } = G,
        { gx, gy } = d,
        owner = this.agents.find(a => a.desk === i && !a.leaving && !a.parent);
      const at = owner && owner.seated,
        st = owner && owner.status;
      // Bàn chưa ai nhận (khác bàn có chủ đang ra pantry): dọn trống, ghế đẩy vào, vẽ bằng bảng màu xám tối.
      const vacant = !owner,
        co = vacant ? -0.2 : 0,
        th = vacant ? vacantTheme(G.th) : G.th;
      let scr = th.off;
      if (at)
        scr =
          { error: '#e5484d', permission: '#f5a524', done: '#46a758', idle: shade(th.off, 10) }[st] ||
          (df < 0.5 ? '#0f2233' : th.stroke ? '#2f5bff' : '#203040');
      if (at && df < 0.7 && st !== 'idle') {
        ctx.globalAlpha = 0.16 * (1 - df);
        poly(
          [P(gx + 0.3, gy + 0.9), P(gx + 1.7, gy + 0.9), P(gx + 1.7, gy + 2), P(gx + 0.3, gy + 2)],
          scr === '#0f2233' ? th.on : scr,
          null,
        );
        ctx.globalAlpha = 1;
      }
      const metal = vacant ? th._metal : th.stroke ? '#ffffff' : '#2d3142';
      box(gx + 0.92, gy + 1.36 + co, 0.16, 0.16, 0, 3, metal);
      [
        [-0.22, 0],
        [0.22, 0],
        [0, -0.2],
        [0, 0.22],
      ].forEach(([dx, dy]) => {
        const [wx, wy] = P(gx + 1 + dx, gy + 1.44 + co + dy);
        rect(wx - 1, wy - 1, 2, 2, th.stroke || '#1a1a1a');
      });
      box(gx + 0.66, gy + 1.18 + co, 0.68, 0.5, 3, 6, th.chair);
      if (!at) {
        box(gx + 0.97, gy + 1.62 + co, 0.06, 0.06, 3, 7, metal);
        box(gx + 0.7, gy + 1.6 + co, 0.6, 0.09, 7, 13, th.chair);
      }
      [
        [0.1, 0.15],
        [1.82, 0.15],
      ].forEach(([x, y]) => box(gx + x, gy + y, 0.08, 0.08, 0, 9, th.dl));
      box(gx + 1.35, gy + 0.2, 0.55, 0.66, 0, 9, th.dt, th.dl, th.dr);
      poly(
        [
          P(gx + 1.45, gy + 0.86, 6),
          P(gx + 1.8, gy + 0.86, 6),
          P(gx + 1.8, gy + 0.86, 6.8),
          P(gx + 1.45, gy + 0.86, 6.8),
        ],
        shade(th.dl, -30),
        null,
      );
      poly(
        [
          P(gx + 1.45, gy + 0.86, 2.5),
          P(gx + 1.8, gy + 0.86, 2.5),
          P(gx + 1.8, gy + 0.86, 3.3),
          P(gx + 1.45, gy + 0.86, 3.3),
        ],
        shade(th.dl, -30),
        null,
      );
      box(gx + 0.1, gy + 0.8, 0.08, 0.08, 0, 9, th.dl);
      box(gx + 0.05, gy + 0.12, 1.9, 0.78, 9, 11, th.dt, th.dl, th.dr);
      if (!vacant) {
        box(gx + 0.18, gy + 0.3, 0.34, 0.42, 11, 12, '#fbfbf7', '#dcdcd4', '#c9c9c0');
        box(gx + 0.22, gy + 0.26, 0.34, 0.42, 12, 12.6, '#ffffff', '#e4e4dc', '#d0d0c8');
        [0, 1, 2].forEach(k =>
          poly(
            [
              P(gx + 0.27, gy + 0.36 + k * 0.09, 12.6),
              P(gx + 0.5, gy + 0.36 + k * 0.09, 12.6),
              P(gx + 0.5, gy + 0.38 + k * 0.09, 12.6),
              P(gx + 0.27, gy + 0.38 + k * 0.09, 12.6),
            ],
            '#b9c4d6',
            null,
          ),
        );
        const acc = i % 3;
        if (acc === 0) {
          box(gx + 0.12, gy + 0.74, 0.06, 0.06, 11, 22, metal);
          box(gx + 0.06, gy + 0.66, 0.22, 0.16, 21, 24, '#ffd166');
          if (df < 0.7 && at) {
            ctx.globalAlpha = 0.12 * (1 - df);
            poly(
              [P(gx, gy + 0.4, 11), P(gx + 0.6, gy + 0.4, 11), P(gx + 0.6, gy + 0.9, 11), P(gx, gy + 0.9, 11)],
              '#ffd166',
              null,
            );
            ctx.globalAlpha = 1;
          }
        } else if (acc === 1) {
          box(gx + 0.6, gy + 0.18, 0.14, 0.14, 11, 14, th.pot);
          const [cx, cy] = P(gx + 0.67, gy + 0.25, 14);
          rect(cx - 1, cy - 5, 3, 5, th.plant);
          rect(cx - 3, cy - 3, 2, 2, th.plant);
        } else {
          box(gx + 0.6, gy + 0.2, 0.06, 0.2, 11, 17, metal);
          poly(
            [
              P(gx + 0.66, gy + 0.22, 12),
              P(gx + 0.66, gy + 0.38, 12),
              P(gx + 0.66, gy + 0.38, 16),
              P(gx + 0.66, gy + 0.22, 16),
            ],
            '#9fd3ff',
            null,
          );
        }
      }
      box(gx + 0.85, gy + 0.24, 0.3, 0.2, 11, 12, metal);
      box(gx + 0.96, gy + 0.28, 0.08, 0.06, 12, 15, metal);
      box(gx + 0.6, gy + 0.2, 0.8, 0.12, 14, 28, th.mon);
      const S = (x0, x1, z0, z1, col) =>
        poly(
          [P(gx + x0, gy + 0.33, z0), P(gx + x1, gy + 0.33, z0), P(gx + x1, gy + 0.33, z1), P(gx + x0, gy + 0.33, z1)],
          col,
          null,
        );
      S(0.65, 1.35, 16, 27, scr);
      if (at && st === 'working') {
        const ph = Math.floor(t * 5 + i),
          cols = th.stroke
            ? ['#ffffff', '#bcd0ff', '#ffffff', '#bcd0ff']
            : ['#ff79c6', '#8be9fd', '#f1fa8c', '#50fa7b'];
        for (let k = 0; k < 4; k++) {
          const ind = ((ph + k) % 3) * 0.06,
            w = 0.14 + ((ph * 3 + k * 7) % 5) * 0.06;
          S(0.7 + ind, 0.7 + ind + w, 25 - k * 2.3, 25.8 - k * 2.3, cols[(ph + k) % 4]);
        }
      } else if (at && st === 'thinking') {
        if (Math.floor(t * 2) % 2) S(0.72, 0.78, 22, 24, '#e6e9ef');
      } else if (at && (st === 'permission' || st === 'error')) {
        S(0.96, 1.04, 19, 25, '#ffffff');
        S(0.96, 1.04, 17, 18.2, '#ffffff');
      } else if (at && st === 'done') {
        S(0.85, 0.9, 20, 22, '#ffffff');
        S(0.9, 0.98, 19, 20.5, '#ffffff');
        S(0.98, 1.15, 20, 24, '#ffffff');
      } else if (at && st === 'idle') {
        const p = (t * 0.25 + i * 0.13) % 1;
        S(
          0.68 + p * 0.6,
          0.72 + p * 0.6,
          18 + ((i * 5 + Math.floor(t)) % 7),
          19 + ((i * 5 + Math.floor(t)) % 7),
          '#8b93a7',
        );
      }
      box(gx + 0.68, gy + 0.58, 0.6, 0.18, 11, 12, th.kb);
      for (let k = 0; k < 6; k++)
        for (let r = 0; r < 2; r++) {
          const [kx, ky] = P(gx + 0.73 + k * 0.09, gy + 0.62 + r * 0.07, 12);
          const hot = at && st === 'working' && (Math.floor(t * 12) + k * 3 + r) % 7 === 0;
          rect(kx, ky, 1, 1, hot ? '#ffffff' : shade(th.kb, 20));
        }
      box(gx + 1.36, gy + 0.6, 0.08, 0.13, 11, 12.5, vacant ? th._mouse : th.stroke ? '#ffffff' : '#d9dbe2');
      const mug = ['#e5484d', '#3e8ed0', '#f5a524', '#46a758', '#8e4ec6', '#ffffff'][i % 6];
      if (!vacant) box(gx + 1.62, gy + 0.34, 0.16, 0.16, 11, 15.5, mug);
      if (at && (st === 'working' || st === 'thinking'))
        for (let k = 0; k < 2; k++) {
          const ph = (t * 0.9 + k * 0.5 + i * 0.1) % 1;
          const [sx, sy] = P(gx + 1.7, gy + 0.42, 17 + ph * 9);
          ctx.globalAlpha = 0.7 * (1 - ph);
          rect(sx + (Math.floor(ph * 4) % 2), sy, 1, 2, '#e6e9ef');
          ctx.globalAlpha = 1;
        }
    }
  },
);
