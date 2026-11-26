// The teleport on the canvas (the clock is web/teleport-logic.js, the styles' data web/tp-styles.js): every frame each
// teleport playing gets its style's items (web/tp-style-<id>.js through web/tp-style-index.js) at the right depths,
// the person is drawn the way the style shows them, and lasting marks (a scorch) fade on the floor.
// A style without a draw object and every teleport under reduced motion are drawn by the magic circle.
import { TeleportLogic } from './teleport-logic.js';
import { TpStyles } from './tp-styles.js';
import { DRAW } from './tp-style-index.js';
import { STYLE as CIRCLE, sigilPixels, ringPixels } from './tp-style-circle.js';
import { Kit } from './tp-kit.js';
import { TpPerson } from './tp-person.js';
import { SnowLogic } from './snow-logic.js';
import { DESKS, DRAW_REACH, P, PA, TH, TW, behindWalls } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';

export { sigilPixels, ringPixels };
const { CAP, LITE, T, DEP, ARR, core } = TeleportLogic;
// Styles import the bits from tp-kit.js: importing this module from a style would be a cycle.
export const TP_PART = Kit.PART;
const MARKS = 2 * CAP, // lasting marks kept per scene, oldest dropped first
  LOW = 24; // px: an air trip lower than this sorts with the furniture at its ground point
const hasTp = a => a.tp;

// Reduced motion as the page reads it (office.js env.reduced), but also where no scene draws, e.g. at planning.
let MQ = null;
TpStyles.useCalm(() => {
  if (MQ === null) MQ = (globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)')) || false;
  return !!MQ && MQ.matches;
});

const feetInto = (x, y, o, k) => {
  const p = PA(x, y);
  o[k] = Math.round(p[0]);
  o[k + 1] = Math.round(p[1]);
};
// A tile direction as a unit vector on screen.
function screenDir(dx, dy, out) {
  const sx = (dx - dy) * TW,
    sy = (dx + dy) * TH,
    n = Math.hypot(sx, sy);
  out[0] = n > 1e-9 ? sx / n : 1;
  out[1] = n > 1e-9 ? sy / n : 0;
}
const E = [0, 0, 0, 0];
// What a style hook receives: one per drawn teleport index, refilled every frame, never kept by a style.
class TpX {
  constructor() {
    this.L = TeleportLogic.newPhase();
    this.dir0 = [1, 0];
    this.dir1 = [1, 0];
    this.gnd = [0, 0, 0, 1];
    this.look = null;
  }
  fill(page, G, a, k, all, calm, lite, lo, snow) {
    const tp = a.tp,
      id = calm ? 'circle' : tp.style || 'circle',
      own = DRAW[id];
    this.S = own || CIRCLE;
    this.kind = own ? TpStyles.BY_ID[id].kind : 'air';
    this.page = page;
    this.G = G;
    this.ctx = G.ctx;
    this.a = a;
    this.tp = tp;
    this.k = k;
    this.all = all;
    this.calm = calm;
    this.lite = lite;
    this.lo = lo;
    this.env(G, snow, a.id);
    TeleportLogic.phase(tp, calm, this.L);
    const pts = tp.route;
    this.start = pts ? Kit.seen(pts, tp.hide) : 0;
    // A hidden starter leaves from its first point off the restroom floor, in the air too.
    const o = pts && tp.hide ? pts[this.start] : null;
    this.ends(o ? o[0] : tp.x0, o ? o[1] : tp.y0, tp.x1, tp.y1);
    if (pts && this.kind === 'ground' && pts.length - this.start > 1) {
      const s = pts[this.start],
        s1 = pts[this.start + 1],
        e0 = pts[pts.length - 2],
        e1 = pts[pts.length - 1];
      screenDir(s1[0] - s[0], s1[1] - s[1], this.dir0);
      screenDir(e1[0] - e0[0], e1[1] - e0[1], this.dir1);
    } else {
      screenDir(tp.x1 - this.tx0, tp.y1 - this.ty0, this.dir0);
      screenDir(tp.x1 - this.tx0, tp.y1 - this.ty0, this.dir1);
    }
    return this;
  }
  // A mark outlives its teleport: no agent, no tp, a neutral phase, both ends at the mark.
  fillMark(page, G, m, lo, snow) {
    this.S = DRAW[m.id] || CIRCLE;
    this.kind = 'none';
    Object.assign(this, { page, G, ctx: G.ctx, a: null, tp: null, k: -1, all: [], calm: false, lite: false, lo });
    this.env(G, snow, m.seed);
    TeleportLogic.phase({ u: T.END, d: null, cut: null }, false, this.L);
    this.ends(m.x, m.y, m.x, m.y);
    this.dir0[0] = this.dir1[0] = m.dir[0];
    this.dir0[1] = this.dir1[1] = m.dir[1];
    this.start = 0;
    return this;
  }
  env(G, snow, id) {
    this.t = G.t || 0;
    this.df = G.df == null ? 1 : G.df;
    this.night = this.df < 0.35;
    this.snow = snow;
    this.gLook = G.look || null;
    this.seed = id * 0.37;
  }
  ends(x0, y0, x1, y1) {
    this.tx0 = x0;
    this.ty0 = y0;
    this.tx1 = x1;
    this.ty1 = y1;
    feetInto(x0, y0, E, 0);
    feetInto(x1, y1, E, 2);
    [this.x0, this.y0, this.x1, this.y1] = E;
  }
  // [px, py, tx, ty, front] at arc fraction p of a ground style's route (the chord for the other kinds).
  route(p, out = [0, 0, 0, 0, false]) {
    const pts = this.kind === 'ground' && this.tp && this.tp.route;
    if (pts) return Kit.along(pts, this.start, p, out);
    const q = Kit.clamp(p),
      tx = Kit.lerp(this.tx0, this.tx1, q),
      ty = Kit.lerp(this.ty0, this.ty1, q);
    feetInto(tx, ty, out, 0);
    out[2] = tx;
    out[3] = ty;
    out[4] = this.tx1 - this.tx0 + this.ty1 - this.ty0 >= 0;
    return out;
  }
  // [px, py, z]: the middle of the landing desk's monitor screen and a depth just over the desk.
  desk(out = [0, 0, 0]) {
    const d = this.a && DESKS[this.tp.desk == null ? this.a.desk : this.tp.desk];
    if (!d) {
      out[0] = this.x1;
      out[1] = this.y1 - 20;
      out[2] = this.tx1 + this.ty1 + 0.01;
      return out;
    }
    const p = P(d.gx + 1, d.gy + 0.22, 23.6);
    out[0] = Math.round(p[0]);
    out[1] = Math.round(p[1]);
    out[2] = d.gx + d.gy + 1.5 + 0.01;
    return out;
  }
  hash(k, salt) {
    return Kit.hash(Math.round(this.seed / 0.37), k, salt);
  }
  stamp(img, sx, sy, sw, sh, dx, dy, dw, dh) {
    Kit.stamp(this.ctx, this.lo, img, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  text(str, px, py, col, s) {
    Kit.text(this.ctx, str, px, py, col, s);
  }
  body(o) {
    return TpPerson.body(this, o);
  }
  bodyAt(px, py, o) {
    return TpPerson.bodyAt(this, px, py, o);
  }
  capture(o, out) {
    return TpPerson.capture(this, o, out);
  }
}
const XS = [],
  MX = [],
  DZ = [0, 0, 0],
  PX = new TpX();
// The last frame's teleport list and crowd flag, for tpPerson in the same frame.
const FRAME = { page: null, all: [], lite: false };

// The style's items this frame: its own need, else every hook it has (the trip only while travelling); every drawn
// style has a need, the fallback serves the tests' recorder styles.
function needOf(S, X) {
  if (S.need) return S.need(X);
  return (
    (S.back ? 3 : 0) |
    (S.floor ? 12 : 0) |
    (S.stand ? 48 : 0) |
    (S.trip && X.L.trip >= 0 ? 64 : 0) |
    (S.ground ? 128 : 0)
  );
}
// Flat on the floor: just over the rug when on it, and kept off the plinth's face on the lawn just in front.
function floorItem(ctx, tx, ty, px, py, draw) {
  const side = Kit.plinth(tx, ty);
  if (!side) return { z: Kit.floorZ(tx, ty), f: draw };
  return {
    z: Kit.floorZ(tx, ty),
    f: () => {
      Kit.plinthClip(ctx, side, px, py);
      try {
        draw();
      } finally {
        ctx.restore();
      }
    },
  };
}
function endItems(X, items, n, end) {
  const S = X.S,
    tx = end ? X.tx1 : X.tx0,
    ty = end ? X.ty1 : X.ty0;
  if (n & (end ? 2 : 1) && S.back) items.push({ z: tx + ty - 0.01, f: () => S.back(X, end) });
  if (n & (end ? 8 : 4) && S.floor)
    items.push(floorItem(X.ctx, tx, ty, end ? X.x1 : X.x0, end ? X.y1 : X.y0, () => S.floor(X, end)));
  if (n & (end ? 32 : 16) && S.stand) items.push({ z: tx + ty + 0.01, f: () => S.stand(X, end) });
}
const RP = [0, 0, 0, 0, false];
// The travelling thing: on the ground at its route point; in the air in the overlay, or low with the furniture.
function tripItems(X, items, n) {
  const S = X.S,
    L = X.L;
  if (!(n & 64) || !S.trip || X.kind === 'none') return;
  if (X.kind === 'ground') {
    X.route(L.trip >= 0 ? L.trip : L.v < ARR ? 0 : 1, RP);
    if (!behindWalls(Math.floor(RP[2]), Math.floor(RP[3]), DRAW_REACH))
      items.push({ z: RP[2] + RP[3] + 0.01, f: () => S.trip(X) });
    return;
  }
  const g = X.gnd;
  g[3] = 1; // the pool keeps last frame's fade
  const has = !!(S.ground && S.ground(X, g));
  const z = !has ? 1e9 : g[2] < LOW ? g[0] + g[1] + 0.01 : 1e9 + (g[0] + g[1]) / 1e3;
  items.push({ z, f: () => S.trip(X) });
  if (has && n & 128) {
    const [gx, gy, h, fade] = g,
      p = PA(gx, gy),
      px = Math.round(p[0]),
      py = Math.round(p[1]);
    const al = 0.9 * fade * (1 - Math.min(1, h / 160));
    items.push({ z: Kit.floorZ(gx, gy), f: () => Kit.shadow(X.ctx, px, py, 14, al) });
  }
}
// A lasting mark is born on the first drawn frame past its point, once per teleport, never in a cut or calm. Its age
// counts from the point itself, so the live end hands over to it without a frame's gap.
function birth(page, X, now) {
  const marks = X.S.marks,
    tp = X.tp;
  if (!marks || !marks.length || X.calm || tp.cut != null || X.S === CIRCLE) return;
  marks.forEach((m, k) => {
    const at = m.at === 'dep' ? DEP : m.at === 'arr' ? ARR : T.RELEASE;
    if (tp.mk & (1 << k) || X.L.u < at) return;
    tp.mk = (tp.mk || 0) | (1 << k);
    const list = page.tpMarks || (page.tpMarks = []);
    if (list.length >= MARKS) list.shift();
    const dir = m.end ? X.dir1 : X.dir0;
    list.push({
      id: tp.style,
      k,
      x: m.end ? tp.x1 : X.tx0,
      y: m.end ? tp.y1 : X.ty0,
      dir: [dir[0], dir[1]],
      t0: now - (tp.u - TeleportLogic.real(at, tp.d)),
      ttl: m.ttl,
      seed: X.a.id,
      hide: !!tp.hide,
    });
  });
}
function markItems(page, G, items, now, lo, calm, snow) {
  const list = page.tpMarks;
  for (let j = list.length - 1; j >= 0; j--) if (now - list[j].t0 >= list[j].ttl) list.splice(j, 1);
  if (calm) return;
  list.forEach((m, j) => {
    const S = DRAW[m.id],
      decl = S && S.marks && S.marks[m.k];
    if (!decl || !S.drawMark) return;
    const X = (MX[j] || (MX[j] = new TpX())).fillMark(page, G, m, lo, snow),
      age = now - m.t0,
      f = () => S.drawMark(X, m, age);
    if (decl.layer === 'floor') items.push(floorItem(X.ctx, m.x, m.y, X.x0, X.y0, f));
    else items.push({ z: decl.layer === 'air' ? 1e9 : m.x + m.y + (decl.layer === 'back' ? -0.01 : 0.01), f });
  });
}
const calmOf = page => !!(page.env && page.env.reduced) || TpStyles.calm();
const bright = a => a.tp.cut == null && a.tp.u >= 0 && core(a.tp.u, a.tp.d) < T.END;

mixin(
  ClaudeOffice,
  class {
    // Every teleport's items (queued ones only their dim circle) and the lasting marks still fading.
    tpItems(G, items) {
      if (!(this.tpMarks && this.tpMarks.length) && !this.agents.some(hasTp)) return;
      const tps = this.agents.filter(hasTp),
        calm = calmOf(this),
        lo = G.ctx.getTransform().a < 1,
        now = this.printNow || 0,
        snow = SnowLogic.depth(this.snowShown || 0);
      let n = 0;
      for (const a of tps) if (bright(a)) n++;
      const lite = n > LITE;
      Object.assign(FRAME, { page: this, all: tps, lite });
      tps.slice(0, CAP).forEach((a, k) => {
        const X = (XS[k] || (XS[k] = new TpX())).fill(this, G, a, k, tps, calm, lite, lo, snow),
          tp = a.tp,
          need = needOf(X.S, X);
        birth(this, X, now);
        if (!tp.hide && !behindWalls(Math.floor(tp.x0), Math.floor(tp.y0), DRAW_REACH)) endItems(X, items, need, 0);
        endItems(X, items, need, 1);
        tripItems(X, items, need);
        if (need & Kit.PART.RUG && X.S.rug) items.push({ z: Kit.RUG_Z, f: () => X.S.rug(X) });
        if (need & Kit.PART.DESK && X.S.desk) items.push({ z: X.desk(DZ)[2], f: () => X.S.desk(X) });
      });
      // read again: a mark born this frame is drawn this frame
      if (this.tpMarks && this.tpMarks.length) markItems(this, G, items, now, lo, calm, snow);
    }
    // Draws the person as the teleport shows them; false leaves drawPerson to draw them as usual. Runs at the walker's
    // depth, which is the landing from a traveller's switch: its body in flight belongs to trip(), so this hides it.
    tpPerson(G, a) {
      if (TpPerson.isBusy()) return false;
      const own = FRAME.page === this,
        all = own ? FRAME.all : (this.agents || []).filter(hasTp),
        snow = SnowLogic.depth(this.snowShown || 0),
        X = PX.fill(this, G, a, CAP, all, calmOf(this), own && FRAME.lite, G.ctx.getTransform().a < 1, snow);
      return !!(X.S.person && X.S.person(X));
    }
  },
);
