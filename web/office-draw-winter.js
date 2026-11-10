// Winter on what the office draws every frame (the island's own snow is baked, web/island-art-snow.js): snow along
// the tops of the walls, and the footprints people and dogs leave on the lawn. A handful of polygons a frame.
import { SnowLogic } from './snow-logic.js';
import { night } from './sky-island.js';
import { H, P, PA, W, WALL } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';

// The snow's colours through the light, worked out once per light level (0..10) and kept.
const TONES = new Map();
export function snowTones(df) {
  const b = Math.round(df * 10);
  let t = TONES.get(b);
  if (!t) {
    const S = c => night(c, 1 - (1 - b / 10) * SnowLogic.NIGHT_K),
      { PAL } = SnowLogic;
    TONES.set(b, (t = { lit: S(PAL.lit), base: S(PAL.base), shade: S(PAL.shade), rim: S(PAL.rim) }));
  }
  return t;
}
// Snow lying on top of a wall WT tiles thick whose cap is at height z: along x (from (x0, y) to (x1, y), the wall
// behind that line) or along y (from (x, y0) to (x, y1), the wall to the left of it), d px deep.
export function snowOnWall(poly, Pj, axis, a0, a1, c, z, WT, d, T) {
  if (axis === 'x') {
    poly([Pj(a0, c, z), Pj(a1, c, z), Pj(a1, c, z + d), Pj(a0, c, z + d)], T.base, null);
    poly([Pj(a0, c - WT, z + d), Pj(a1, c - WT, z + d), Pj(a1, c, z + d), Pj(a0, c, z + d)], T.lit, null);
  } else {
    poly([Pj(c, a0, z), Pj(c, a1, z), Pj(c, a1, z + d), Pj(c, a0, z + d)], T.shade, null);
    poly([Pj(c - WT, a0, z + d), Pj(c, a0, z + d), Pj(c, a1, z + d), Pj(c - WT, a1, z + d)], T.lit, null);
  }
}

mixin(
  ClaudeOffice,
  class {
    // Snow on the office's back and left walls, drawn right after them.
    winterWalls(G, depth) {
      const T = snowTones(G.df),
        d = depth + 1;
      snowOnWall(G.poly, P, 'x', -0.35, W, 0, WALL + 3, 0.35, d, T);
      snowOnWall(G.poly, P, 'y', 0, H, 0, WALL + 3, 0.35, d, T);
    }
    // Footprints on the lawn (this.prints, SnowLogic.prints): two dark pixels each, fading over PRINT_LIFE seconds.
    drawPrints(G, now) {
      const b = this.prints;
      if (!b || !b.n) return;
      const { ctx } = G,
        T = snowTones(G.df);
      ctx.fillStyle = T.rim;
      for (let i = 0; i < b.n; i++) {
        const age = now - b.t[i];
        if (age < 0 || age >= SnowLogic.PRINT_LIFE) continue;
        const [sx, sy] = PA(b.x[i], b.y[i]);
        ctx.globalAlpha = 0.85 * (1 - age / SnowLogic.PRINT_LIFE);
        ctx.fillRect(Math.round(sx) - 1, Math.round(sy), 2, 1);
      }
      ctx.globalAlpha = 1;
    }
  },
);
