// The /assets catalogue: what the office paints inline in its own draw (web/office-draw.js), so it has no function
// of its own to call: the floors and the corridor runner, the outer walls with what the look hangs on them, the EXIT
// door and the clock, the desks, a pot plant, the pantry's kitchen floor, the stairs and the plinth, and the
// pavilion with its lights. Each is a scene card cut from the office as the game draws it under the scene's look
// (AssetsScene.officeScene), so a pack's floors, garlands, wreaths and baubles show where the game puts them.
// Regions are in scene px (office-scene.js P / PG), top left and size.
import { tr } from './i18n.js';
import { AssetsScene } from './assets-scene.js';

const DRAW = { file: 'web/office-draw.js', fn: 'draw' };
const card = (id, region, name, more) => ({
  id,
  cat: id.split('.')[0],
  name,
  when: { always: true },
  where: 'office',
  frame: AssetsScene.frameOf(region),
  draw: (ctx, view) => AssetsScene.officeScene(ctx, view, region),
  ...more,
});

// The crossing of the two corridors: the office's floor, the zones' coloured floors and the runner down both.
const CORRIDOR = AssetsScene.officeRegion(328, 262, 160, 112);
// The back wall over the shelf and a window: its cap and what the look strings along it.
const BACK_WALL = AssetsScene.officeRegion(470, 186, 156, 124);
// The left wall from the clock to the EXIT door.
const LEFT_WALL = AssetsScene.officeRegion(134, 168, 172, 122);
// Four desks of the first zone, as the office lays them out, empty.
const DESKS = AssetsScene.officeRegion(298, 168, 176, 128);
// The pot plant in the front corner of the first zone.
const POT = AssetsScene.officeRegion(258, 322, 60, 60);
// The pantry's kitchen side (its washable tiles), with what stands on them.
const PANTRY = AssetsScene.officeRegion(612, 352, 136, 100);
// The east stairs down to the lawn and the plinth the office stands on.
const STAIRS = AssetsScene.officeRegion(640, 436, 124, 96);
// The pavilion in the lake, with the strings the look hangs on it.
const PAVILION = AssetsScene.officeRegion(506, 600, 108, 100);

const ALL = ['light', 'season', 'snow', 'event'];
export const OFFICE_SCENE = [
  card('office.corridor', CORRIDOR, () => tr('assets.item.office.corridor'), {
    labels: ['floor.corridor', 'floor.office', 'floor.zone'],
    source: [DRAW, { file: 'web/office-draw-festive.js', fn: 'runner' }],
    uses: ALL,
  }),
  card('office.back-wall', BACK_WALL, () => tr('assets.item.office.back-wall'), {
    labels: ['wall.outer', 'shelf'],
    source: [DRAW, { file: 'web/office-draw-xmas.js', fn: 'xmasWallLights' }],
    uses: ALL,
  }),
  card('office.left-wall', LEFT_WALL, () => tr('assets.item.office.left-wall'), {
    labels: ['door', 'clock'],
    source: [DRAW, { file: 'web/office-draw-festive.js', fn: 'dressWalls' }],
    uses: ALL,
  }),
  card('office.desks', DESKS, () => tr('assets.item.office.desks'), {
    labels: ['desk', 'monitor', 'chair'],
    source: [DRAW, { file: 'web/office-decor.js', fn: 'deskWorkstation' }],
    uses: ALL,
  }),
  card('office.pot-plant', POT, () => tr('assets.item.office.pot-plant'), {
    label: 'plant.pot',
    source: [DRAW, { file: 'web/office-draw-festive.js', fn: 'dressItems' }],
    uses: ALL,
  }),
  card('office.pantry-floor', PANTRY, () => tr('assets.item.office.pantry-floor'), {
    label: 'floor.pantry',
    where: 'pantry',
    source: [DRAW, { file: 'web/office-draw-festive.js', fn: 'checker' }],
    uses: ALL,
  }),
  card('outdoor.stairs', STAIRS, () => tr('assets.item.outdoor.stairs'), {
    labels: ['stairs', 'plinth'],
    where: 'lawn',
    source: [DRAW],
    uses: ALL,
  }),
  card('outdoor.pavilion-lights', PAVILION, () => tr('assets.item.outdoor.pavilion-lights'), {
    label: 'pavilion',
    where: 'lake',
    source: [DRAW, { file: 'web/office-draw-xmas.js', fn: 'xmasWallLights' }],
    uses: ALL,
  }),
];
