// The catalogue of the /assets page: every drawable item of the game as an entry, gathered from the category modules
// (web/assets-cat-*.js). Each entry draws with the game's own code through the stage (web/assets-stage.js), so the
// page can never drift from the game; tests/assets-registry.test.mjs checks that every item the game knows is here
// and that every entry draws in every variant.
//
// ---- How to add an entry ----
// Put it in your category's module (web/assets-cat-<cat>.js, exporting an array) and register that array once at the
// bottom of this file. An entry:
//   {
//     id: 'plants.island-tree',          // '<cat>.<kebab-name>', stable: deep links use it
//     cat: 'plants',                     // one of CATS
//     name: () => tr(KEY),              // KEY a literal string key, e.g. assets.item.plants.island-tree
//     tags: ['animated', 'state'],       // 'animated' = moves with t (a test checks), 'state' = has on/off/use states;
//                                        // season / event / night / snow / catalogue-only are added from the fields
//     when: { always: true },            // or { seasons: ['winter'] }, { event: { key: 'christmas', level: 2 } },
//                                        // { holiday: 'tet' } (a key of SeasonTree.SEASONS)
//     where: 'lawn',                     // a key of WHERE
//     catalogueOnly: true,               // the code exists but the live game never draws it
//     source: [{ file: 'web/island-art.js', fn: 'drawBush' }],
//     axes: [{ id: 'kind', label: () => tr(KEY), values: [{ id: 'big', label: () => tr(KEY) }, …] }],
//     sweep: ['status', 'act'],          // optional, for an item with too many axes to cross (a person): the grid
//                                        // steps through these axes one at a time, each value counts once
//     uses: ['light', 'season', 'snow', 'event'],   // the global controls it reacts to (only those reach it)
//     palette: () => ['#…'],             // optional: colours to show when the draw only stamps sprites
//     draw(ctx, view, t) {…},            // view = {ox, oy, env, pick}: draw the item standing at (ox, oy)
//   }
// The card is sized from what draw() actually paints (AssetsStage.recordingCtx bounds), so (ox, oy) only has to be
// somewhere on the item. A throw shows a "can't draw" tile instead of the item. One example per drawing style
// (s = AssetsStage.stage(ctx, view, t)):
//   K  furniture kit   draw: (ctx, v, t) => OfficeDecor.F.chair(AssetsStage.stage(ctx, v).kit, t)
//   PK pantry kit      draw(ctx, v, t) { const k = AssetsStage.stage(ctx, v).pantryKit
//                        PantryItems.I.arcade.draw(k, t, { night: v.env.df < 0.5, use: v.pick.use === 'use' ? 1 : 0 })
//                      }
//   ST event tree      draw: (ctx, v, t) => SeasonTree.drawSeasonTree(ctx, v.ox, v.oy, v.pick.tree, t)
//   IP island painter  draw(ctx, v) { const s = AssetsStage.stage(ctx, v)
//                        drawBush(s.pt, s.PG, s.C, { x: 3, y: 5 }) }   // PG is the lawn level; pick tiles by hash
//   SP data sprite     draw(ctx, v) { const s = AssetsStage.stage(ctx, v), dfB = Math.round(v.env.df * 10)
//                        const c = s.host.critterSprite('penguin', v.pick.frame, dfB, 0, false)
//                        ctx.drawImage(c, v.ox, v.oy) }
//   M  office method   draw(ctx, v, t) { const s = AssetsStage.stage(ctx, v, t)   // G.t = t
//                        s.scene(seg.x, seg.Y, 0, () => s.host.drawSeg(s.G, seg, own)) }   // scene px → (ox, oy)
//   B  scene card      bake the island or sky once per scene (key it on v.env, which is one object per scene), then
//                        ctx.drawImage(bake, sx, sy, w, h, v.ox, v.oy, w, h) to show one part of it
// Then add a line to SOURCES in tests/assets-registry.test.mjs for the game catalogue your entries cover, and the
// tr() keys to all seven tables in web/i18n/ as one block.
import { tr } from './i18n.js';
import { AssetsLogic } from './assets-logic.js';
import { OFFICE } from './assets-cat-office.js';
import { PANTRY } from './assets-cat-pantry.js';
import { ANIMALS } from './assets-cat-animals.js';
import { EVENT } from './assets-cat-event.js';
import { PEOPLE } from './assets-cat-people.js';
import { ROOMS } from './assets-cat-rooms.js';
import { PLANTS } from './assets-cat-plants.js';
import { OUTDOOR } from './assets-cat-outdoor.js';
import { ISLAND_SKY } from './assets-cat-island.js';
import { WORLD } from './assets-cat-world.js';

// The categories in rail order, each with the accent its cards and chips wear.
const CAT_NAMES = {
  plants: () => tr('assets.cat.plants'),
  outdoor: () => tr('assets.cat.outdoor'),
  island: () => tr('assets.cat.island'),
  animals: () => tr('assets.cat.animals'),
  people: () => tr('assets.cat.people'),
  office: () => tr('assets.cat.office'),
  pantry: () => tr('assets.cat.pantry'),
  rooms: () => tr('assets.cat.rooms'),
  event: () => tr('assets.cat.event'),
  world: () => tr('assets.cat.world'),
};
const CAT_ACCENT = {
  plants: '#46a758',
  outdoor: '#c9a77a',
  island: '#5ec8ff',
  animals: '#f5a524',
  people: '#e93d82',
  office: '#7fb2ff',
  pantry: '#e0703a',
  rooms: '#12a594',
  event: '#ff5a66',
  world: '#a78bfa',
};
const CATS = AssetsLogic.CAT_IDS.map(id => ({ id, label: CAT_NAMES[id], accent: CAT_ACCENT[id] }));

const TAGS = ['season', 'event', 'night', 'snow', 'animated', 'state', 'catalogue-only'];
const TAG_LABEL = {
  season: () => tr('assets.tag.season'),
  event: () => tr('assets.tag.event'),
  night: () => tr('assets.tag.night'),
  snow: () => tr('assets.tag.snow'),
  animated: () => tr('assets.tag.animated'),
  state: () => tr('assets.tag.state'),
  'catalogue-only': () => tr('assets.tag.catalogue'),
};
const WHERE = {
  office: () => tr('assets.where.office'),
  pantry: () => tr('assets.where.pantry'),
  lawn: () => tr('assets.where.lawn'),
  lake: () => tr('assets.where.lake'),
  sky: () => tr('assets.where.sky'),
  kennel: () => tr('assets.where.kennel'),
  restroom: () => tr('assets.where.restroom'),
  smoking: () => tr('assets.where.smoking'),
  world: () => tr('assets.where.world'),
};

const ID = /^[a-z]+\.[a-z0-9-]+$/;
const list = [];
const byIdMap = new Map();
// Entries refused at registration, with why: the page leaves them out instead of failing, and a test fails.
const problems = [];

// Fills in the defaults and the tags that follow from the fields; returns why an entry cannot be used, if it cannot.
function check(e) {
  if (!e || typeof e !== 'object') return 'not an object';
  if (!ID.test(e.id || '')) return 'bad id ' + e.id;
  if (byIdMap.has(e.id)) return 'duplicate id ' + e.id;
  if (!AssetsLogic.CAT_IDS.includes(e.cat) || e.id.split('.')[0] !== e.cat) return e.id + ': bad category ' + e.cat;
  if (typeof e.name !== 'function' || typeof e.draw !== 'function') return e.id + ': needs name() and draw()';
  if (!WHERE[e.where]) return e.id + ': unknown where ' + e.where;
  if (!Array.isArray(e.source) || !e.source.length) return e.id + ': needs a source';
  if ((e.uses || []).some(u => !AssetsLogic.SCENE.includes(u))) return e.id + ': unknown control in uses';
  for (const a of e.axes || [])
    if (!a.id || typeof a.label !== 'function' || !Array.isArray(a.values) || !a.values.length)
      return e.id + ': bad axis ' + a.id;
  if (e.sweep && (!Array.isArray(e.sweep) || e.sweep.some(id => !(e.axes || []).some(a => a.id === id))))
    return e.id + ': sweep names an axis it does not have';
  return null;
}
function normalize(e) {
  const uses = AssetsLogic.SCENE.filter(u => (e.uses || []).includes(u)),
    when = e.when || { always: true },
    tags = new Set(e.tags || []);
  if (uses.includes('season') || when.seasons) tags.add('season');
  if (uses.includes('event') || when.event || when.holiday) tags.add('event');
  if (uses.includes('light')) tags.add('night');
  if (uses.includes('snow')) tags.add('snow');
  if (e.catalogueOnly) tags.add('catalogue-only');
  return {
    ...e,
    uses,
    when,
    axes: e.axes || [],
    catalogueOnly: !!e.catalogueOnly,
    tags: TAGS.filter(t => tags.has(t)).concat([...tags].filter(t => !TAGS.includes(t))),
  };
}
function register(entries) {
  for (const raw of entries) {
    const why = check(raw);
    if (why) {
      problems.push(why);
      if (typeof console !== 'undefined') console.error('assets: ' + why);
      continue;
    }
    const e = normalize(raw);
    list.push(e);
    byIdMap.set(e.id, e);
  }
}
const entries = () => list;
const byId = id => byIdMap.get(id) || null;
const cat = id => CATS.find(c => c.id === id) || null;

register(OFFICE);
register(PANTRY);
register(ANIMALS);
register(EVENT);
register(PEOPLE);
register(ROOMS);
// Task 3: plants, outdoor props, the island and sky, the world view
register(PLANTS);
register(OUTDOOR);
register(ISLAND_SKY);
register(WORLD);

export const AssetsRegistry = { CATS, TAGS, TAG_LABEL, WHERE, entries, byId, cat, register, problems };
