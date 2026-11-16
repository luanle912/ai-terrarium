// The /assets catalogue: the Christmas event. Santa by the tree, his sleigh and the parcels it drops, the elves and
// the pile of presents they make (critter sprites, web/critter-sprites.js, through the office's own methods), the
// strings of lights (web/office-draw-xmas.js), the candy canes by the lamps (web/island-art-xmas.js), and the
// landmark: Notre-Dame of Saigon and the statue with the crib before it, baked by web/island-art-cathedral.js and
// web/island-art-cathedral-yard.js and lit by web/office-draw-cathedral.js. The pieces that change with the event's
// level follow the page's Event control; with the event off they show its last level, so they are never empty.
import { tr } from './i18n.js';
import { AssetsStage } from './assets-stage.js';
import { ACT, critterEntry, frames } from './assets-cat-animals.js';
import { CRITTER_PLACES, PG } from './office-scene.js';
import { EventCritters } from './event-critters.js';
import { EventLandmark } from './event-landmark.js';
import { PILE } from './office-draw-critters.js';
import { STRINGS, drawString, glowAt } from './office-draw-xmas.js';
import { drawCandyCane } from './island-art-xmas.js';
import { drawCathedral } from './island-art-cathedral.js';
import { drawOurLady } from './island-art-cathedral-yard.js';
import { night } from './island-art.js';

const axis = (id, label, values) => ({ id, label, values });
const dfB = view => Math.round(view.env.df * 10);
const XMAS = level => ({ key: 'christmas', level });
// The event's level an env shows: the page's Event control, or the full event (level 3) while it is off.
const DEFAULT_LEVEL = 3;
const levelOf = env => env.event || DEFAULT_LEVEL;
// The outdoor Christmas pieces keep more of their colour after dark than the lawn (web/sky-island.js renderProps).
const TONES = new Map();
const tonesOf = df => {
  let T = TONES.get(df);
  if (!T) TONES.set(df, (T = c => night(c, 1 - (1 - df) * 0.55)));
  return T;
};
// One sprite of a critter from the office's cache (light, facing), its feet on (ox, oy) as drawCritter stands it.
function stamp(ctx, view, kind, frame, flip) {
  const s = AssetsStage.stage(ctx, view),
    img = s.host.critterSprite(kind, frame, dfB(view), false, flip);
  ctx.drawImage(img, view.ox - img.ax, view.oy - img.fh);
}

// ---- the critters ----
const SANTA_NOW = { kind: 'santa', id: 0, act: 'sit', face: 1 };
const SANTA = {
  id: 'event.santa',
  cat: 'event',
  name: () => tr('assets.item.event.santa'),
  tags: ['animated'],
  when: { event: XMAS(1) },
  where: 'office',
  source: [
    { file: 'web/critter-sprites.js', fn: 'KINDS.santa' },
    { file: 'web/event-critters.js', fn: 'pose' },
  ],
  axes: [axis('pose', () => tr('assets.axis.pose'), frames(['moving', 'sit', 'wave'], ACT))],
  uses: ['light'],
  draw(ctx, view, t) {
    const f = view.pick.pose === 'moving' ? EventCritters.pose(SANTA_NOW, t).frame : view.pick.pose;
    stamp(ctx, view, 'santa', f, false);
  },
};
const SLEIGH = {
  id: 'event.sleigh',
  cat: 'event',
  name: () => tr('assets.item.event.sleigh'),
  when: { event: XMAS(1) },
  where: 'sky',
  source: [
    { file: 'web/critter-sprites.js', fn: 'KINDS.sleigh' },
    { file: 'web/office-draw-critters.js', fn: 'drawSleigh' },
  ],
  axes: [
    axis('direction', () => tr('assets.axis.direction'), [
      { id: 'right', label: () => tr('assets.direction.right') },
      { id: 'left', label: () => tr('assets.direction.left') },
    ]),
  ],
  uses: ['light'],
  draw: (ctx, view) => stamp(ctx, view, 'sleigh', 'fly', view.pick.direction === 'left'),
};
const PARCEL = {
  id: 'event.parcel',
  cat: 'event',
  name: () => tr('assets.item.event.parcel'),
  when: { event: XMAS(1) },
  where: 'sky',
  source: [
    { file: 'web/critter-sprites.js', fn: 'KINDS.parcel' },
    { file: 'web/office-draw-critters.js', fn: 'drawSleigh' },
  ],
  axes: [axis('frame', () => tr('assets.axis.frame'), frames(['chute', 'box']))],
  uses: ['light'],
  draw: (ctx, view) => stamp(ctx, view, 'parcel', view.pick.frame, false),
};
const ELF = critterEntry({
  id: 'event.elf',
  name: () => tr('assets.item.event.elf'),
  kind: 'elf',
  moving: ['carry', 'back'],
  when: { event: XMAS(3) },
  where: 'lawn',
});
// The pile by the front stairs, as many presents as the elves and the sleigh have brought.
const DROP = CRITTER_PLACES.drop || [0, 0];
const GIFT_PILE = {
  id: 'event.gift-pile',
  cat: 'event',
  name: () => tr('assets.item.event.gift-pile'),
  when: { event: XMAS(3) },
  where: 'lawn',
  source: [
    { file: 'web/office-draw-critters.js', fn: 'drawPile' },
    { file: 'web/office-draw-critters.js', fn: 'paintPile' },
  ],
  axes: [
    axis(
      'count',
      () => tr('assets.axis.count'),
      // the full pile first, so the card shows it
      PILE.map((_, i) => PILE.length - i).map(n => ({ id: String(n), label: () => tr('assets.pile.count', { n }) })),
    ),
  ],
  uses: ['light'],
  draw(ctx, view) {
    const s = AssetsStage.stage(ctx, view),
      n = Math.max(1, Math.min(PILE.length, +view.pick.count || 1));
    s.scene(DROP[0] + 0.5, DROP[1] + 0.5, 0, () => s.host.drawPile(s.G, n, 0, dfB(view)), true);
  },
};

// ---- lights and canes ----
// One string of each kind the office hangs (a dozen bulbs of the long one under the back wall's cap), laid out by
// EventLogic.lightString in the scene and shown from its first bulb.
const atOf = (s, n) => s && (n ? s.at.subarray(0, n * 2) : s.at);
const PLACES = {
  wall: atOf(
    STRINGS.find(s => s.z === null),
    12,
  ),
  kennel: atOf(STRINGS.find(s => s.level === 2 && s.z !== null)),
  pergola: atOf(STRINGS.findLast(s => s.level === 2)),
  pavilion: atOf(STRINGS.find(s => s.level === 3)),
};
const PLACE_IDS = Object.keys(PLACES).filter(k => PLACES[k] && PLACES[k].length);
const PLACE_LABEL = {
  wall: () => tr('assets.lights.wall'),
  kennel: () => tr('assets.lights.kennel'),
  pergola: () => tr('assets.lights.pergola'),
  pavilion: () => tr('assets.lights.pavilion'),
};
const STRING_LIGHTS = {
  id: 'event.string-lights',
  cat: 'event',
  name: () => tr('assets.item.event.string-lights'),
  tags: ['animated'],
  when: { event: XMAS(1) },
  where: 'lawn',
  source: [
    { file: 'web/office-draw-xmas.js', fn: 'drawString' },
    { file: 'web/event-logic.js', fn: 'lightString' },
  ],
  axes: [axis('placement', () => tr('assets.axis.placement'), frames(PLACE_IDS, PLACE_LABEL))],
  uses: ['light'],
  draw(ctx, view, t) {
    const at = PLACES[view.pick.placement] || PLACES[PLACE_IDS[0]],
      glow = glowAt(view.env.df);
    ctx.save();
    ctx.translate(view.ox - at[0], view.oy - at[1]);
    drawString(ctx, at, t, glow, false, glow > 0.01);
    ctx.restore();
  },
};
const CANE_AT = { x: 0, y: 0 };
const CANDY_CANE = {
  id: 'event.candy-cane',
  cat: 'event',
  name: () => tr('assets.item.event.candy-cane'),
  when: { event: XMAS(2) },
  where: 'lawn',
  source: [{ file: 'web/island-art-xmas.js', fn: 'drawCandyCane' }],
  uses: ['light'],
  draw(ctx, view) {
    const s = AssetsStage.stage(ctx, view);
    drawCandyCane(s.pt, s.PG, tonesOf(view.env.df), CANE_AT);
  },
};

// ---- the landmark ----
const SITE = EventLandmark.SITE;
// The event as cathedralItems takes it, per level, on an ordinary night or on Christmas Eve (every bulb burning, a
// halo round the building).
const EVS = [1, 2, 3].map(level => [false, true].map(eve => ({ key: 'christmas', level, eve, day: true })));
const LIT = [];
// The office's lights of the landmark for ev, those for the building (back: the halo behind it) or for the yard.
function lights(s, ev, part) {
  LIT.length = 0;
  s.host.cathedralItems(s.G, LIT, ev);
  for (const it of LIT)
    if (part === 'back' ? it.z < SITE.z : part === 'front' ? it.z > SITE.z && it.z < SITE.ladyZ : it.z > SITE.ladyZ)
      it.f();
}
const LANDMARK_SOURCE = { file: 'web/office-draw-cathedral.js', fn: 'cathedralItems' };
const CATHEDRAL = {
  id: 'event.cathedral',
  cat: 'event',
  name: () => tr('assets.item.event.cathedral'),
  tags: ['animated'],
  when: { event: XMAS(1) },
  where: 'lawn',
  source: [{ file: 'web/island-art-cathedral.js', fn: 'drawCathedral' }, LANDMARK_SOURCE],
  axes: [
    axis('eve', () => tr('assets.axis.eve'), [
      { id: 'night', label: () => tr('assets.eve.night') },
      { id: 'eve', label: () => tr('assets.eve.eve') },
    ]),
  ],
  uses: ['light', 'snow', 'event'],
  draw(ctx, view, t) {
    const s = AssetsStage.stage(ctx, view, t),
      level = levelOf(view.env),
      ev = EVS[level - 1][view.pick.eve === 'eve' ? 1 : 0];
    s.scene(
      SITE.at[0] + 0.5,
      SITE.at[1] + 0.5,
      0,
      () => {
        lights(s, ev, 'back');
        drawCathedral(s.pt, PG, tonesOf(view.env.df), s.S, s.depth, level, SITE.at);
        lights(s, ev, 'front');
      },
      true,
    );
  },
};
const OUR_LADY = {
  id: 'event.our-lady',
  cat: 'event',
  name: () => tr('assets.item.event.our-lady'),
  when: { event: XMAS(1) },
  where: 'lawn',
  source: [{ file: 'web/island-art-cathedral-yard.js', fn: 'drawOurLady' }, LANDMARK_SOURCE],
  uses: ['light', 'snow', 'event'],
  draw(ctx, view, t) {
    const s = AssetsStage.stage(ctx, view, t),
      level = levelOf(view.env);
    s.scene(
      SITE.lady[0] + 0.5,
      SITE.lady[1] + 0.5,
      0,
      () => {
        drawOurLady(s.pt, PG, tonesOf(view.env.df), s.S, s.depth, level, SITE.lady);
        lights(s, EVS[level - 1][0], 'yard');
      },
      true,
    );
  },
};

export const EVENT = [SANTA, SLEIGH, PARCEL, ELF, GIFT_PILE, STRING_LIGHTS, CANDY_CANE, CATHEDRAL, OUR_LADY];
