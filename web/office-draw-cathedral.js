// The Christmas landmark on what is drawn every frame: the cathedral's strings of bulbs and, after dark, its lit
// windows, the star over its gable and the glow on the statue and the manger. The still pieces are baked
// (web/island-art-cathedral.js, web/island-art-cathedral-yard.js); nothing here builds a colour, an array or a
// gradient in the frame.
import { EventLandmark } from './event-landmark.js';
import { stamp } from './island-art.js';
import { CATHEDRAL_EXT, cathedralLights } from './island-art-cathedral.js';
import { LADY_EXT, yardLights } from './island-art-cathedral-yard.js';
import { drawString, glowAt, glowSprite, litStar } from './office-draw-xmas.js';
import { H, ISLAND, PG, W } from './office-scene.js';
import { ClaudeOffice, mixin } from './office.js';

// Where the bake put the two sprites (web/sky-island.js): the same site, or none on an island without room for it.
const HERE = EventLandmark.site(ISLAND, { W, H }),
  SITE = EventLandmark.SITE,
  corner = (tile, ext) => {
    const [x, y] = PG(tile[0] + 0.5, tile[1] + 0.5, 0);
    return [Math.round(x) - ext[0], Math.round(y) - ext[1]];
  },
  CW = CATHEDRAL_EXT[0] + CATHEDRAL_EXT[2],
  CH = CATHEDRAL_EXT[1] + CATHEDRAL_EXT[3],
  [CX, CY] = corner(SITE.at, CATHEDRAL_EXT),
  [LX, LY] = corner(SITE.lady, LADY_EXT),
  // a table of sprite px as scene px
  moved = at => at.map((v, i) => v + (i % 2 ? CY : CX)),
  YARD = yardLights(),
  [MX, MY, MW, MH] = YARD.manger;
// The cathedral's tables, its strings in scene px: laid out at the first frame of an event, not at page load, as
// cathedralLights() paints the building.
let lit = null;
function lights() {
  if (!lit) {
    const L = cathedralLights();
    lit = { ...L, facade: moved(L.facade), eave: moved(L.eave), rose: moved(L.rose) };
  }
  return lit;
}

// The lit windows as one sprite the size of the cathedral's, made once: every pane warm, the rose's specks brighter.
let windows = null;
function windowSprite() {
  if (!windows) {
    windows = document.createElement('canvas');
    windows.width = CW;
    windows.height = CH;
    const g = windows.getContext('2d'),
      { panes, specks } = lights();
    g.fillStyle = '#ffd98a';
    for (let n = 0; n < panes.length; n += 4) g.fillRect(panes[n], panes[n + 1], panes[n + 2], panes[n + 3]);
    g.fillStyle = '#fff6d8';
    for (let n = 0; n < specks.length; n += 2) g.fillRect(specks[n], specks[n + 1], 1, 1);
  }
  return windows;
}
// Christmas Eve: one wide warm halo round the building, drawn before its sprite so it shows behind the towers.
function eveHalo(ctx, df) {
  const glow = glowAt(df);
  if (glow <= 0.01) return;
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 0.9 * glow;
  ctx.drawImage(glowSprite('#ffd98a', 64), CX - 30, CY - 24, CW + 60, CH + 40);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = smooth;
}
// The cathedral's lights over its baked sprite: after dark the windows and a soft halo on the rose; the facade's
// string, the eave's from the second level, the rose's ring and the lit star from the third. `still` (reduced
// motion) stops the blinking and the twinkle; on Christmas Eve every bulb burns.
function cathedralGlow(ctx, t, df, ev, still) {
  const glow = glowAt(df),
    dark = glow > 0.01,
    steady = still || ev.eve,
    smooth = ctx.imageSmoothingEnabled,
    { facade, eave, rose, roseAt, star } = lights();
  if (dark) {
    ctx.globalAlpha = 0.9 * glow;
    stamp(ctx, windowSprite(), CX, CY);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.6 * glow;
    ctx.drawImage(glowSprite('#ffd98a', 24), CX + roseAt[0] - 12, CY + roseAt[1] - 12);
    ctx.globalAlpha = 1;
  }
  ctx.imageSmoothingEnabled = true;
  drawString(ctx, facade, t, glow, steady, dark);
  if (ev.level >= 2) drawString(ctx, eave, t, glow, steady, dark);
  if (ev.level >= 3) {
    drawString(ctx, rose, t, glow, steady, dark);
    litStar(ctx, CX + star[0], CY + star[1], still ? 0 : Math.floor(t * 2) % 2, glow);
  }
  ctx.imageSmoothingEnabled = smooth;
}
// After dark, a soft halo on the statue and, from the second level, the manger's light in the crib.
function yardGlow(ctx, df, level) {
  const glow = glowAt(df);
  if (glow <= 0.01) return;
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = 0.55 * glow;
  ctx.drawImage(glowSprite('#fff3b0', 24), LX + YARD.halo[0] - 12, LY + YARD.halo[1] - 12);
  if (level >= 2) {
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(LX + MX, LY + MY, MW, MH);
    ctx.globalAlpha = 0.8 * glow;
    ctx.drawImage(glowSprite('#ffd98a'), LX + MX - 5, LY + MY - 5);
  }
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = smooth;
}

mixin(
  ClaudeOffice,
  class {
    // The landmark's lights among the scene's sprites, each right after its baked sprite (ev is never null here).
    cathedralItems(G, items, ev) {
      if (!HERE) return;
      const still = !!(this.env && this.env.reduced);
      if (ev.eve) items.push({ z: SITE.z - 0.01, f: () => eveHalo(G.ctx, G.df) });
      items.push({ z: SITE.z + 0.01, f: () => cathedralGlow(G.ctx, G.t, G.df, ev, still) });
      items.push({ z: SITE.ladyZ + 0.01, f: () => yardGlow(G.ctx, G.df, ev.level) });
    }
  },
);
