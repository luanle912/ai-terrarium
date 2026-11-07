// What the seasons move on the island, drawn every frame: petals drifting down in spring, leaves falling and blowing
// on the autumn breeze, snow falling in winter (web/season-island.js works out where they are), and the two falls
// frozen into still columns of ice while the lakes are frozen. The per-frame path allocates nothing: the particles
// live in one reused buffer, colours are worked out once per light step.
import { night } from './island-art.js';
import { SeasonIsland } from './season-island.js';
import { SeasonLogic } from './season-logic.js';
import { hash } from './island-land.js';

const TW = 16,
  TH = 8;
const COLOURS = {
  petals: ['#ffd1e0', '#ffffff', '#f7a8c4'],
  leaves: ['#e0703a', '#f2b134', '#c0392b'],
  snow: ['#ffffff', '#f4f8ff', '#e8f0fb'],
};
const ICE = { lit: '#eef8ff', mid: '#cfe8f6', shade: '#9cc8e3', edge: '#7fb0d0', snow: '#f6f9fc' };
// colours through the island's light, again only when it moves a step
const PAL = { q: -1, petals: [], leaves: [], snow: [], ice: {} };
function palette(df) {
  const q = Math.round(df * 20);
  if (PAL.q === q) return PAL;
  PAL.q = q;
  for (const k in COLOURS) for (let i = 0; i < 3; i++) PAL[k][i] = night(COLOURS[k][i], q / 20);
  for (const k in ICE) PAL.ice[k] = night(ICE[k], q / 20);
  return PAL;
}

// ---- falling petals, leaves and snow ----
const BUF = SeasonIsland.fallBuffer();
// Over the island and everyone on it. PG is the island projection, t seconds, env the frame's {df, fx, reduced,
// season}. Snow stops while it rains or storms (the rain falls instead); the weather's own snow comes on top of it.
function drawFall(ctx, island, PG, t, env) {
  const look = SeasonLogic.look(env.season),
    kind = look.fall,
    fx = env.fx;
  if (!kind || (kind === 'snow' && fx && (fx.rain > 0.3 || fx.storm > 0.3))) return;
  const o = PG(0, 0, 0),
    ox = o[0],
    oy = o[1],
    still = !!env.reduced,
    wind = look.wind + (fx ? 0.3 * fx.storm : 0),
    cols = palette(env.df)[kind],
    f = SeasonIsland.fallStep(BUF, island, kind, t, wind, still);
  for (let i = 0; i < f.n; i++) {
    const p = f.p[i];
    if (p.a <= 0.02) continue;
    const X = Math.round(ox + (p.x - p.y) * TW + p.dx),
      Y = Math.round(oy + (p.x + p.y) * TH - p.z);
    ctx.globalAlpha = p.a * (kind === 'snow' ? 0.9 : 1);
    ctx.fillStyle = cols[p.c];
    // a leaf or a petal tumbles: flat, then edge on; a snowflake is a dot, a third of them bigger. A flat leaf is a
    // little three-px blade with a nub on top, edge on a short stroke.
    if (kind === 'snow') ctx.fillRect(X, Y, p.c ? 1 : 2, p.c ? 1 : 2);
    else if (kind === 'leaves') {
      if (p.flip) {
        ctx.fillRect(X - 1, Y, 3, 1);
        ctx.fillRect(X, Y - 1, 1, 1);
      } else ctx.fillRect(X, Y - 1, 1, 2);
    } else ctx.fillRect(X, Y, p.flip ? 2 : 1, 1);
  }
  ctx.globalAlpha = 1;
}

// ---- the frozen falls ----
// A fall frozen where it stood: a column of ice in the plane y = Y from x = xa..xb, from `top` down to `bot` (px),
// lit on the left, shaded on the right, with still light streaks and a ragged fringe of icicles at its foot (a fall
// over the island's edge freezes only partway down, `reach` of its length). Drawn in whole-pixel columns.
function iceColumn(ctx, ox, oy, f, reach, cap, P) {
  const ax = Math.round(ox + (f.xa - f.Y) * TW),
    bx = Math.round(ox + (f.xb - f.Y) * TW),
    w = Math.max(1, bx - ax),
    len = (f.top - f.bot) * reach;
  for (let X = ax - 1; X <= bx + 1; X++) {
    const u = (X - ax) / w,
      x = f.xa + (f.xb - f.xa) * Math.max(0, Math.min(1, u)),
      top = Math.round(oy + (x + f.Y) * TH - f.top),
      edge = X < ax || X > bx,
      // icicles: each column stops at its own length, longer toward the middle
      drop = edge
        ? 0.25
        : reach >= 1
          ? 0.93 + 0.07 * hash(X, 3, 201)
          : 0.7 + 0.3 * Math.sin(u * Math.PI) - 0.35 * hash(X, 3, 201),
      h = Math.max(2, Math.round(len * drop));
    ctx.fillStyle = edge ? P.edge : u < 0.25 ? P.lit : u > 0.75 ? P.shade : P.mid;
    ctx.fillRect(X, top, 1, h);
    if (!edge && hash(X, 4, 202) > 0.7) {
      ctx.fillStyle = P.lit;
      ctx.fillRect(X, top + 2, 1, Math.round(h * 0.6));
    }
    if (cap && !edge) {
      ctx.fillStyle = P.snow;
      ctx.fillRect(X, top - 1, 1, 2);
    }
  }
}
// Both falls as ice: g is web/island-life.js's geometry for the island (g.fall the main fall's sheet, g.mfall the
// mountain fall's).
function drawIceFalls(ctx, g, df) {
  const P = palette(df).ice;
  ctx.globalAlpha = 0.95;
  iceColumn(ctx, g.ox, g.oy, g.mfall, 1, false, P);
  iceColumn(ctx, g.ox, g.oy, g.fall, 0.22, true, P);
  ctx.globalAlpha = 1;
}

export const IslandSeasonLife = { drawFall, drawIceFalls };
