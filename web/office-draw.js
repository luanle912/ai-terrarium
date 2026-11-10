import { SeasonTree } from './season-tree.js';
import { OfficeDecor } from './office-decor.js';
import { SkyLogic } from './sky-logic.js';
import { CameraLogic } from './camera-logic.js';
import { SkyRender } from './sky-render.js';
import { SnowLogic } from './snow-logic.js';
import { EventLogic } from './event-logic.js';
import { IslandLife } from './island-life.js';
import { IslandSeasonLife } from './island-season-life.js';
import { SeasonIsland } from './season-island.js';
import { PropUse } from './prop-use.js';
import { WallpaperLogic } from './wallpaper-logic.js';
import {
  DESKS,
  FH,
  FLOOR_Z,
  H,
  ISLAND,
  LH,
  LW,
  OX,
  OY,
  P,
  PG,
  SEGS,
  STAIRS,
  behindWalls,
  DRAW_REACH,
  W,
  WALL,
  ZONES,
  lerpHex,
  mix,
  zoneAt,
} from './office-scene.js';
import { shade, text3 } from './office-util.js';
import { ClaudeOffice, mixin } from './office.js';
// Drawing the office: sky, camera, the floor, walls, planters, pantry and desks.
// The night tint over event trees, in 1/50 steps of its strength (built once, no string per frame).
const NIGHT_TINT = Array.from({ length: 31 }, (_, i) => 'rgba(13,19,34,' + i / 50 + ')');
// On a holiday these few trees by the office turn into the holiday's tree; the rest keep the season's.
const HOLIDAY_TREES = SeasonIsland.holidayTrees(ISLAND, W, H);
mixin(
  ClaudeOffice,
  class {
    // The sky fills the whole stage behind the scene canvas; rain, snow, fog and a near cloud go over it.
    drawSky(t) {
      const st = this.stageEl,
        env = this.env;
      if (!st || !env) return;
      const w = st.clientWidth,
        hh = st.clientHeight,
        dpr = window.devicePixelRatio || 1,
        b = this.camBox(),
        // as a wallpaper the far sky is redrawn on every other frame only (WallpaperLogic.skyDue)
        backDue = !this.wallpaper || WallpaperLogic.skyDue((this.skyFrames = (this.skyFrames || 0) + 1));
      // Clouds follow the island camera (zoom and pan), each layer by its depth.
      // The world's "Toàn cảnh" of 8 islands keeps its own far islands (SkyRender.drawBack, env.overview).
      const overview = !!(this.world && this.world.view === 'all'),
        skyEnv = b
          ? { ...env, view: CameraLogic.skyView(this.cam, b), overview }
          : overview
            ? { ...env, overview }
            : env;
      for (const [cv, fn] of [
        [this.backCanvas, SkyRender.drawBack],
        [this.frontCanvas, SkyRender.drawFront],
      ]) {
        if (!cv || (cv === this.backCanvas && !backDue)) continue;
        const bw = Math.round(w * dpr),
          bh = Math.round(hh * dpr);
        if (cv.width !== bw || cv.height !== bh) {
          cv.width = bw;
          cv.height = bh;
        }
        const ctx = cv.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, hh);
        fn(ctx, w, hh, t, skyEnv);
        if (cv === this.backCanvas) this.drawFallers(ctx, t, hh);
      }
      // The island bobs a few pixels; moving the wrapper (not a transform) keeps bubbles, clicks and layering intact.
      if (this.wrapEl) {
        const top = env.reduced ? 0 : Math.round(Math.sin(t * 0.7) * 3);
        if (this.wrapTop !== top) {
          this.wrapTop = top;
          this.wrapEl.style.top = top + 'px';
        }
      }
    }
    // The wrapper's place and focus box on the stage, in stage pixels (layout, before the camera transform).
    camBox() {
      const st = this.stageEl,
        w = this.wrapEl;
      if (!st || !w) return null;
      return {
        stageW: st.clientWidth,
        stageH: st.clientHeight,
        ox: w.offsetLeft,
        oy: w.offsetTop - (this.wrapTop || 0),
        cw: w.offsetWidth,
        ch: (w.offsetHeight * FH) / LH,
      };
    }
    setCam(cam) {
      if (cam.z === this.cam.z && cam.tx === this.cam.tx && cam.ty === this.cam.ty) return;
      this.cam = cam;
      const w = this.wrapEl;
      if (w) {
        w.style.transform =
          cam.z === 1 && !cam.tx && !cam.ty ? '' : 'translate(' + cam.tx + 'px,' + cam.ty + 'px) scale(' + cam.z + ')';
        w.style.setProperty('--cam-inv', String(1 / cam.z));
        // will-change only while the camera moves: Chrome keeps a will-change layer at the scale it was first painted
        // at, so left on it upscales the bubbles' text into a blur once zoomed. At rest the layer is re-painted sharp.
        w.style.willChange = 'transform';
        clearTimeout(this.wcTimer);
        this.wcTimer = setTimeout(() => {
          if (this.wrapEl) this.wrapEl.style.willChange = '';
        }, 200);
      }
      if (cam.z !== this.kZoom) {
        clearTimeout(this.kTimer);
        this.kTimer = setTimeout(() => {
          this.kZoom = this.cam.z;
        }, 150);
      }
    }

    // One event tree at its tile, tinted for the night by `dusk` (0 = full day). Every event tree of a season looks
    // the same at a given moment, so after dark the tinted tree is painted once a frame into a scratch canvas (at the
    // scene's resolution) and stamped at each tile.
    drawEventTree(ctx, d, season, t, k, dusk) {
      const [px, py] = PG(d.x + 0.5, d.y + 0.5, 0),
        X = Math.round(px),
        Y = Math.round(py);
      if (dusk < 0.02) {
        ctx.save();
        ctx.translate(X, Y);
        SeasonTree.drawSeasonTree(ctx, 0, 0, season, t);
        ctx.restore();
        return;
      }
      const sc = this.treeScratch || (this.treeScratch = document.createElement('canvas')),
        m = this.treeMemo || (this.treeMemo = { t: null, k: 0, dusk: 0, season: '' });
      if (m.t !== t || m.k !== k || m.dusk !== dusk || m.season !== season) {
        Object.assign(m, { t, k, dusk, season });
        const w = Math.ceil(48 * k),
          h = Math.ceil(58 * k);
        if (sc.width !== w || sc.height !== h) {
          sc.width = w;
          sc.height = h;
        }
        const g = sc.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, w, h);
        g.setTransform(k, 0, 0, k, 24 * k, 48 * k);
        SeasonTree.drawSeasonTree(g, 0, 0, season, t);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = NIGHT_TINT[Math.min(NIGHT_TINT.length - 1, Math.round(dusk * 50))];
        g.fillRect(0, 0, w, h);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(sc, Math.round((X - 24) * k), Math.round((Y - 48) * k));
      ctx.setTransform(k, 0, 0, k, 0, 0);
    }
    renderK() {
      return CameraLogic.renderScale(this.canvas.clientWidth, window.devicePixelRatio || 1, this.kZoom, LW);
    }
    draw(t) {
      const c = this.canvas;
      if (!c) return;
      const ctx = c.getContext('2d'),
        th = this.theme,
        env = this.env;
      const df = th._day != null ? th._day : 1;
      // Draw at the screen's own resolution so edges stay sharp when the canvas is shown large. k is not rounded:
      // with the island-sized scene a whole-number k would make the browser shrink the bitmap and drop pixel rows.
      // Zoomed in, the resolution follows the zoom (CameraLogic.renderScale); past 4× the browser scales it up
      // pixelated.
      const k = this.renderK();
      if (this.k !== k) {
        this.k = k;
        c.width = Math.round(LW * k);
        c.height = Math.round(LH * k);
      }
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, LW, LH);
      // The island is baked once per resolution / light level / snow level / season and stamped under the office.
      const snow = this.snowShown || 0,
        ic = this.islandCache,
        dfB = Math.round(df * 10),
        snB = Math.round(snow * 10),
        season = this.seasonNow(),
        ev = this.eventNow(),
        evK = EventLogic.cacheKey(ev);
      if (!ic || ic.k !== k || ic.df !== dfB || ic.sn !== snB || ic.season !== season || ic.ev !== evK) {
        // let the browser drop the old bake's canvases now rather than at the next collection
        if (ic) for (const c of [ic.img, ...ic.props.map(p => p.img)]) c.width = c.height = 0;
        const frame = { LW, LH, OX, OY },
          light = { df: dfB / 10, snow: snB / 10, season, block: { W, H }, event: ev ? ev.level : 0 };
        this.islandCache = {
          img: SkyRender.renderIsland(ISLAND, frame, k, light),
          props: SkyRender.renderProps(ISLAND, frame, k, light),
          k,
          df: dfB,
          sn: snB,
          season,
          ev: evK,
        };
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.islandCache.img, 0, 0);
      ctx.restore();
      // Water, falls, mist, lamp pools, vines, birds, fireflies and the rainbow (web/island-life.js).
      if (env) IslandLife.drawLife(ctx, ISLAND, PG, t, env);
      // What stands up off the lawn (trees, bushes, lamps, the bench, the pavilion) is sorted with the people and dogs;
      // whatever stands in the strip right behind the walls goes down before them (below), so the walls hide it.
      const items = [],
        behind = [],
        stamp = p => () => {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(p.img, p.dx, p.dy);
          ctx.setTransform(k, 0, 0, k, 0, 0);
          if (p.lamp >= 0 && env) IslandLife.drawLampLight(ctx, ISLAND, PG, p.lamp, t, env);
          // the pavilion's lantern glows over its own sprite (web/island-life.js, when it draws one)
          if (p.lantern && env && IslandLife.drawLanternLight) IslandLife.drawLanternLight(ctx, ISLAND, PG, t, env);
        },
        backOf = o => behindWalls(Math.floor(o.x), Math.floor(o.y), DRAW_REACH),
        walker = a => !a.sleeping && !a.seated && !a.wcIn;
      // The island's trees: on a holiday the few by the office are the holiday's tree (HOLIDAY_TREES); the rest are
      // the season's, baked among the props. Holiday trees are drawn in their
      // own colours; after dark each goes through a scratch canvas and takes the same night tint as the lawn
      // (SkyRender.night: toward #0d1322 by (1 - light) x 0.6), so it does not glow.
      const tk = SeasonTree && this.treeOn ? this.season : null,
        info = tk && SeasonTree.SEASONS[tk],
        holiday = info && (info.type === 'event' || info.type === 'lunar') ? tk : null,
        dusk = (1 - dfB / 10) * 0.6,
        // (not at Christmas: one big tree stands on the front lawn instead, web/island-art-xmas.js)
        held = d => holiday && holiday !== 'christmas' && HOLIDAY_TREES.has(d.x + ',' + d.y);
      for (const p of this.islandCache.props)
        if (!(p.tree && held(p))) (backOf(p) ? behind : items).push({ z: p.z, f: stamp(p) });
      for (const d of ISLAND.decor) {
        if (d.kind !== 'tree' || !held(d)) continue;
        (backOf(d) ? behind : items).push({
          z: d.x + d.y + 0.5,
          f: () => this.drawEventTree(ctx, d, holiday, t, k, dusk),
        });
      }
      const poly = (pts, fill, stroke) => {
        ctx.beginPath();
        pts.forEach((p, i) =>
          i ? ctx.lineTo(Math.round(p[0]), Math.round(p[1])) : ctx.moveTo(Math.round(p[0]), Math.round(p[1])),
        );
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        const s = stroke === undefined ? th.stroke : stroke;
        if (s) {
          ctx.strokeStyle = s;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };
      {
        // The plinth: a soft shadow on the lawn around it, then its two visible stone faces and a lit top lip.
        const WT_ = 0.35,
          stone = SkyRender.night('#b9b2a3', df);
        [
          [0.5, 0.07],
          [0.25, 0.1],
        ].forEach(([b, a]) => {
          const sh = 'rgba(0,0,0,' + a + ')';
          poly([PG(-WT_, H), PG(W, H), PG(W + b, H + b), PG(-WT_, H + b)], sh, null);
          poly([PG(W, -WT_), PG(W + b, -WT_), PG(W + b, H + b), PG(W, H)], sh, null);
        });
        poly([PG(-WT_, H, 0), PG(W, H, 0), PG(W, H, FLOOR_Z), PG(-WT_, H, FLOOR_Z)], shade(stone, -18), null);
        poly([PG(W, -WT_, 0), PG(W, H, 0), PG(W, H, FLOOR_Z), PG(W, -WT_, FLOOR_Z)], shade(stone, -40), null);
        poly(
          [PG(-WT_, H, FLOOR_Z - 1), PG(W, H, FLOOR_Z - 1), PG(W, H, FLOOR_Z), PG(-WT_, H, FLOOR_Z)],
          shade(stone, 12),
          null,
        );
        poly(
          [PG(W, -WT_, FLOOR_Z - 1), PG(W, H, FLOOR_Z - 1), PG(W, H, FLOOR_Z), PG(W, -WT_, FLOOR_Z)],
          shade(stone, -10),
          null,
        );
        for (let x = 2; x < W; x += 4)
          poly(
            [PG(x, H, 1), PG(x + 0.06, H, 1), PG(x + 0.06, H, FLOOR_Z - 1), PG(x, H, FLOOR_Z - 1)],
            shade(stone, -32),
            null,
          );
        for (let y = 2; y < H; y += 4)
          poly(
            [PG(W, y, 1), PG(W, y + 0.06, 1), PG(W, y + 0.06, FLOOR_Z - 1), PG(W, y, FLOOR_Z - 1)],
            shade(stone, -52),
            null,
          );
        // Stairs down from the pantry: the floor, two stone steps, then the lawn (back step first so the front one
        // overlaps it). Each step is a stone box; on the east flight steps march out along +x, on the front flight
        // along +y.
        const run = SkyLogic.STAIR_RUN / 3;
        const step = (x0, x1, y0, y1, zt, top) => {
          poly([PG(x0, y1, 0), PG(x1, y1, 0), PG(x1, y1, zt), PG(x0, y1, zt)], shade(top, -20), null);
          poly([PG(x1, y0, 0), PG(x1, y1, 0), PG(x1, y1, zt), PG(x1, y0, zt)], shade(top, -38), null);
          poly([PG(x0, y0, zt), PG(x1, y0, zt), PG(x1, y1, zt), PG(x0, y1, zt)], top, null);
        };
        for (const s of STAIRS)
          for (let i = 0; i < 2; i++) {
            const zt = FLOOR_Z * (1 - (i + 1) / 3),
              top = shade(stone, 8 - i * 4),
              a = i * run,
              b = a + run;
            if (s.side === 'east') step(W + a, W + b, s.y, s.y + s.len, zt, top);
            else step(s.x, s.x + s.len, H + a, H + b, zt, top);
          }
      }
      const box = (x, y, w, hh, z0, z1, top, l, r) => {
        poly([P(x, y + hh, z0), P(x + w, y + hh, z0), P(x + w, y + hh, z1), P(x, y + hh, z1)], l || shade(top, -22));
        poly([P(x + w, y, z0), P(x + w, y + hh, z0), P(x + w, y + hh, z1), P(x + w, y, z1)], r || shade(top, -38));
        poly([P(x, y, z1), P(x + w, y, z1), P(x + w, y + hh, z1), P(x, y + hh, z1)], top);
      };
      const rect = (x, y, w, hh, col) => {
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(x), Math.round(y), w, hh);
      };
      const G = { ctx, poly, box, rect, th, t, df };
      this.drawPrints(G, this.printNow || 0);
      for (const d of this.dogs) if (backOf(d)) behind.push({ z: d.x + d.y, f: () => this.drawDog(G, d, t, dfB, snB) });
      for (const a of this.agents)
        if (walker(a) && backOf(a)) behind.push({ z: a.x + a.y, f: () => this.drawPerson(G, a) });
      behind.sort((p, q) => p.z - q.z).forEach(it => it.f());
      // Walls are WT tiles thick so their cut edges show; openings sit RD deep in the wall.
      const WT = 0.35,
        ZT = WALL + 3,
        RD = 0.18;
      const clipTo = pts => {
        ctx.save();
        ctx.beginPath();
        pts.forEach((p, i) =>
          i ? ctx.lineTo(Math.round(p[0]), Math.round(p[1])) : ctx.moveTo(Math.round(p[0]), Math.round(p[1])),
        );
        ctx.closePath();
        ctx.clip();
      };
      poly([P(0, 0, 0), P(W, 0, 0), P(W, 0, WALL), P(0, 0, WALL)], th.wr);
      poly([P(0, 0, 0), P(0, H, 0), P(0, H, WALL), P(0, 0, WALL)], th.wl);
      poly([P(0, 0, WALL), P(W, 0, WALL), P(W, 0, WALL + 3), P(0, 0, WALL + 3)], th.trim);
      poly([P(0, 0, WALL), P(0, H, WALL), P(0, H, WALL + 3), P(0, 0, WALL + 3)], th.trim);
      poly([P(0, 0, 0), P(W, 0, 0), P(W, 0, 4), P(0, 0, 4)], th.trim);
      poly([P(0, 0, 0), P(0, H, 0), P(0, H, 4), P(0, 0, 4)], th.trim);
      poly([P(-WT, -WT, ZT), P(W, -WT, ZT), P(W, 0, ZT), P(0, 0, ZT)], shade(th.trim, 18), null);
      poly([P(-WT, -WT, ZT), P(0, 0, ZT), P(0, H, ZT), P(-WT, H, ZT)], shade(th.trim, 18), null);
      poly([P(W, -WT, 0), P(W, 0, 0), P(W, 0, ZT), P(W, -WT, ZT)], shade(th.wr, -34), null);
      poly([P(-WT, H, 0), P(0, H, 0), P(0, H, ZT), P(-WT, H, ZT)], shade(th.wl, -20), null);
      if (SnowLogic.depth(snow)) this.winterWalls(G, SnowLogic.depth(snow));
      if (ev) this.xmasWallLights(G, ev);
      {
        const OD = OfficeDecor;
        if (OD) [1.6, 4.8, 11.6, 14.8].forEach(x => OD.F.window(OD.kit(ctx, ...P(x, 0)), t, { night: df < 0.5 }));
      }
      {
        const OD = OfficeDecor,
          u = this.usage || [];
        const u5h = u.find(x => x.kind === 'five_hour') || { pct: null, resets: '' };
        const u7d = u.find(x => x.kind === 'seven_day') || { pct: null, resets: '' };
        const rMin = r => {
          if (!r) return 0;
          const d = new Date(r) - Date.now();
          return Math.max(0, d / 60000);
        };
        // Shown only with a claude.ai plan (usagePlan true; undefined from an older server) and not on hub islands.
        if (OD && OD.drawUsageBoard && !this.noUsage && (this.usagePlan === undefined || this.usagePlan === true)) {
          const [bx, by] = P(0, 4.9, 50); // hub islands and the public preview carry no usage
          OD.drawUsageBoard(
            ctx,
            bx,
            by,
            {
              h5: u5h.pct == null ? null : u5h.pct / 100,
              d7: u7d.pct == null ? null : u7d.pct / 100,
              r5: rMin(u5h.resets),
              r7: rMin(u7d.resets),
              variant: 'led',
              night: df < 0.5,
            },
            t,
            'left',
          );
        }
      }
      [
        [1.3, 2.5, 18, '#c9cfdc'],
        [2.8, 4.2, 18, '#c9cfdc'],
      ].forEach(([a, b, z, col]) => {
        ctx.globalAlpha = 0.3;
        poly([P(0, a, z), P(0, b, z), P(0, b, z + 0.5), P(0, a, z + 0.5)], col, null);
        ctx.globalAlpha = 1;
      });
      box(0, 9.6, 0.28, 2.4, 20, 22, shade(th.trim, -10));
      ['#e5484d', '#3e8ed0', '#f5a524', '#46a758', '#8e4ec6', '#12a594', '#e8e2d6', '#5b5bd6'].forEach((col, k) => {
        const hh = [8, 6, 9, 7, 8, 5, 7, 9][k];
        box(0.03, 9.68 + k * 0.27, 0.2, 0.2, 22, 22 + hh, col);
      });
      {
        const [cx, cy] = P(0, 12.8, 42);
        ctx.fillStyle = '#1a1c24';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 8, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f6f4ee';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 6, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8b93a7';
        [
          [0, -6],
          [5, 0],
          [0, 6],
          [-5, 0],
        ].forEach(([dx, dy]) => ctx.fillRect(cx + dx, cy + dy, 1, 1));
        const d = new Date(),
          mA = (d.getMinutes() / 60) * Math.PI * 2 - Math.PI / 2,
          hA = (((d.getHours() % 12) + d.getMinutes() / 60) / 12) * Math.PI * 2 - Math.PI / 2,
          sA = (d.getSeconds() / 60) * Math.PI * 2 - Math.PI / 2;
        ctx.strokeStyle = '#2d3142';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(hA) * 3, cy + Math.sin(hA) * 3.5);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(mA) * 4.5, cy + Math.sin(mA) * 5);
        ctx.stroke();
        ctx.strokeStyle = '#e5484d';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sA) * 5, cy + Math.sin(sA) * 5.5);
        ctx.stroke();
      }
      {
        const OD = OfficeDecor;
        if (OD) OD.F.door(OD.kit(ctx, ...P(0, 5.5)), t);
      }
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          poly(
            [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)],
            (x + y) % 2 ? th.fa : th.fb,
            th.stroke ? '#dfe5ef' : null,
          );
          if (df > 0.2) {
            ctx.globalAlpha = df;
            poly([P(x, y + 0.5), P(x + 1, y + 0.5), P(x + 1, y + 0.52), P(x, y + 0.52)], shade(th.fa, -18), null);
            ctx.globalAlpha = 1;
          }
          if (df < 0.8 && (x * 7 + y * 3) % 5 === 0) {
            ctx.globalAlpha = 1 - df;
            const [px, py] = P(x + 0.5, y + 0.5);
            rect(px, py, 1, 1, shade(th.fa, 14));
            ctx.globalAlpha = 1;
          }
        }
      {
        const own = this.colOwners();
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const zi = zoneAt(x, y);
            let col;
            if (zi === 4) {
              // pantry: light washable tiles on the kitchen side, warm wood planks where people sit
              if (y >= 9) {
                col = y % 2 ? lerpHex('#3a2d2b', '#c99862', df) : lerpHex('#332725', '#c18f59', df);
                poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], col, th.stroke ? '#dfe5ef' : null);
                const sm = shade(col, -16),
                  jx = x + (y % 2 ? 0.3 : 0.7);
                poly([P(x, y + 0.5), P(x + 1, y + 0.5), P(x + 1, y + 0.53), P(x, y + 0.53)], sm, null);
                poly([P(jx, y), P(jx + 0.03, y), P(jx + 0.03, y + 0.5), P(jx, y + 0.5)], sm, null);
                continue;
              }
              col = (x + y) % 2 ? lerpHex('#2e2d3a', '#ebe7dd', df) : lerpHex('#282734', '#dfdace', df);
            } else if (zi < 0) col = mix((x + y) % 2 ? th.fa : th.fb, '#000000', th.stroke ? 0.03 : 0.14);
            else {
              const dk = own[zi];
              if (!dk) {
                col = mix((x + y) % 2 ? th.fa : th.fb, '#000000', th.stroke ? 0.06 : 0.24);
                poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], col, th.stroke ? '#dfe5ef' : null);
                continue;
              }
              col = mix(
                (x + y) % 2 ? th.fa : th.fb,
                this.depts.get(dk).color,
                th.stroke ? 0.14 : df < 0.5 ? 0.3 : 0.34,
              );
            }
            poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], col, th.stroke ? '#dfe5ef' : null);
          }
        ctx.strokeStyle = th.stroke ? '#c9d3e3' : df > 0.5 ? '#c9a77a' : '#3a4462';
        ctx.lineWidth = 1;
        [
          [9, 0, 9, H],
          [0, 7, 20, 7],
          [19, 0, 19, H],
        ].forEach(([a, b, c, d]) => {
          const L = Math.max(c - a, d - b) * 2;
          for (let k = 0; k < L; k += 2) {
            const p0 = P(a + ((c - a) * k) / L, b + ((d - b) * k) / L),
              p1 = P(a + ((c - a) * (k + 0.8)) / L, b + ((d - b) * (k + 0.8)) / L);
            ctx.beginPath();
            ctx.moveTo(p0[0], p0[1]);
            ctx.lineTo(p1[0], p1[1]);
            ctx.stroke();
          }
        });
        // Soft contact shadow where the walls meet the floor.
        [
          [0.45, 0.06],
          [0.22, 0.1],
        ].forEach(([b, a]) => {
          const sh = 'rgba(0,0,0,' + a + ')';
          poly([P(0, 0), P(W, 0), P(W, b), P(b, b)], sh, null);
          poly([P(0, 0), P(b, b), P(b, H), P(0, H)], sh, null);
        });
        // Floor paint: (a,b,c,d) is the text's reading and downward direction on screen; (x,y) is its top-left corner
        // on the floor.
        const paint = (x, y, txt, col, s, m) => {
          const [px, py] = P(x, y);
          ctx.save();
          ctx.translate(Math.round(px), Math.round(py));
          ctx.transform(...m, 0, 0);
          ctx.scale(s, s);
          ctx.globalAlpha = th.stroke ? 0.7 : 0.6;
          text3(ctx, txt, 0, 0, col);
          ctx.restore();
          ctx.globalAlpha = 1;
        };
        const ALONG_X = [1, 0.5, -1, 0.5],
          ALONG_Y = [1, -0.5, 1, 0.5];
        // Department names run along the zone's middle aisle (between the two desk columns), the only floor strip no
        // desk hides. All names share one size, so they are capped at MAXC characters: a longer name drops its leading
        // words first (core-payment-merchant → MERCHANT) so sibling projects stay distinguishable, then is cut.
        const MAXC = 12,
          FS = 2;
        ZONES.forEach((z, zi) => {
          const dk = own[zi];
          // Phòng chưa có session nào: in EMPTY bằng màu xám thay cho tên phòng.
          if (!dk) {
            const name = 'EMPTY',
              len = ((name.length * 4 - 1) * FS) / 16;
            paint(
              z.zx + 3.12,
              z.zy + 3 + len / 2,
              name,
              th.stroke ? '#9aa3b5' : df > 0.5 ? shade(th.fa, -45) : shade(th.fa, 30),
              FS,
              ALONG_Y,
            );
            return;
          }
          const col = this.depts.get(dk).color;
          let name = dk.toUpperCase();
          while (name.length > MAXC && /[-_.]/.test(name)) name = name.replace(/^[^-_.]*[-_.]/, '');
          name = name.slice(0, MAXC);
          const len = ((name.length * 4 - 1) * FS) / 16;
          paint(z.zx + 3.12, z.zy + 3 + len / 2, name, df > 0.5 ? shade(col, -80) : shade(col, 10), FS, ALONG_Y);
        });
        paint(21.3, 13.2, 'PANTRY', df > 0.5 ? '#8a5a2a' : '#a8763e', 2.5, ALONG_X);
      }
      poly([P(0.05, 6.4), P(0.9, 6.4), P(0.9, 7.6), P(0.05, 7.6)], lerpHex('#3a2f55', '#b5523b', df), null);
      [1.6, 4.8, 11.6, 14.8].forEach(x => {
        ctx.globalAlpha = 0.07 + (0.22 - 0.07) * df;
        poly(
          [P(x + 0.3, 0.05), P(x + 2.1, 0.05), P(x + 2.6, 1.6), P(x + 0.8, 1.6)],
          lerpHex('#7fb2ff', '#fff3c4', df),
          null,
        );
        ctx.globalAlpha = 1;
      });
      if (SeasonTree) this.seasonKey = SeasonTree.seasonFor(new Date());
      {
        const OD = OfficeDecor,
          lit = this.propLit || PropUse.DARK;
        DESKS.forEach((d, i) => {
          const owner = this.agents.find(a => a.desk === i && !a.leaving && !a.parent);
          OD.deskWorkstation(ctx, P, d, owner, t, () => this.drawPerson(G, owner), lit[i]).forEach(it =>
            items.push(it),
          );
        });
      }
      {
        const own = this.colOwners();
        SEGS.forEach(sg =>
          items.push({ z: sg.v ? sg.X + sg.y + 0.5 : sg.x + 0.5 + sg.Y, f: () => this.drawSeg(G, sg, own) }),
        );
      }
      this.pantryItems(G, items);
      this.smokingItems(G, items, snow);
      this.doghouseItems(G, items, snow, dfB, snB);
      this.fateItems(G, items);
      if (ev) this.xmasItems(G, items, ev);
      this.restroomItems(G, items, snow);
      [
        [8.5, 13.5],
        [19.5, 13.5],
        [18.5, 0.5],
      ].forEach(([x, y]) =>
        items.push({
          z: x + y,
          f: () => {
            box(x - 0.2, y - 0.2, 0.4, 0.4, 0, 7, th.pot);
            const [px, py] = P(x, y, 7);
            [
              [-5, -8, 10, 8, 0],
              [-3, -14, 6, 6, 1],
              [-7, -5, 4, 4, 1],
              [3, -6, 4, 4, 0],
              [-1, -17, 3, 4, 0],
            ].forEach(([a, b, w, hh, v]) => rect(px + a, py + b, w, hh, v ? shade(th.plant, -25) : th.plant));
          },
        }),
      );
      items.push({
        z: 9,
        f: () => {
          box(8.55, 0.05, 0.9, 0.4, 0, 42, shade(th.trim, -5));
          [10, 20, 30, 40].forEach(z => box(8.58, 0.06, 0.84, 0.38, z, z + 1, shade(th.trim, -30)));
          [
            [12, '#e5484d', '#3e8ed0', '#f5a524'],
            [22, '#46a758', '#e8e2d6', '#8e4ec6'],
            [32, '#12a594', '#5b5bd6', '#e93d82'],
          ].forEach(([z, ...cs]) =>
            cs.forEach((col, k) => box(8.65 + k * 0.24, 0.12, 0.16, 0.28, z, z + 7 - (k % 2) * 2, col)),
          );
        },
      });

      for (const d of this.dogs) if (!backOf(d)) items.push({ z: d.x + d.y, f: () => this.drawDog(G, d, t, dfB, snB) });
      this.agents.forEach(a => {
        if (a.sleeping) {
          const d = DESKS[a.desk];
          items.push({ z: d.gx + d.gy + 0.5, f: () => this.drawSleeper(G, a) });
          items.push({
            z: d.gx + d.gy + 2,
            f: () => {
              const [hx, hy] = this.headPos(a);
              for (let k = 0; k < 3; k++) {
                const p = (t * 0.5 + k * 0.33) % 1;
                ctx.globalAlpha = Math.min(1, (1 - p) * 1.4);
                text3(
                  ctx,
                  'Z',
                  hx - 2 + p * 8 + Math.sin(p * 6) * 2,
                  hy - 4 - p * 22,
                  th.stroke ? '#33415c' : '#e6e9ef',
                );
                ctx.globalAlpha = 1;
              }
            },
          });
        } else if (walker(a) && !backOf(a)) {
          items.push({ z: a.x + a.y + (a.stool ? 0.1 : 0), f: () => this.drawPerson(G, a) });
        }
      });
      items.sort((p, q) => p.z - q.z).forEach(it => it.f());
      // The season's petals, leaves or snow drift down over everything on the island.
      if (env) IslandSeasonLife.drawFall(ctx, ISLAND, PG, t, env);
      // A storm darkens the island and office; source-atop only tints what is already drawn, never the sky behind.
      if (env && env.fx.storm > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(10,15,30,' + 0.18 * env.fx.storm + ')';
        ctx.fillRect(0, 0, LW, LH);
        ctx.restore();
      }
    }
  },
);
