// The /assets catalogue: the pantry. All of PantryItems.I (web/pantry-kitchen.js, web/pantry-lounge.js), each drawn
// with the pantry kit as the office draws it: the same contact shadow under the pieces that stand on the floor, the
// light it casts after dark (night) and, for the pieces people use, idle or in use.
import { tr } from './i18n.js';
import { AssetsStage } from './assets-stage.js';
import { PantryItems } from './pantry-items.js';

const NAMES = {
  fridge: () => tr('assets.item.pantry.fridge'),
  cabinet: () => tr('assets.item.pantry.cabinet'),
  espresso: () => tr('assets.item.pantry.espresso'),
  grinder: () => tr('assets.item.pantry.grinder'),
  sink: () => tr('assets.item.pantry.sink'),
  microwave: () => tr('assets.item.pantry.microwave'),
  drinkfridge: () => tr('assets.item.pantry.drinkfridge'),
  wallcab: () => tr('assets.item.pantry.wallcab'),
  neon: () => tr('assets.item.pantry.neon'),
  island: () => tr('assets.item.pantry.island'),
  stool: () => tr('assets.item.pantry.stool'),
  pendant: () => tr('assets.item.pantry.pendant'),
  sofa: () => tr('assets.item.pantry.sofa'),
  coffeetable: () => tr('assets.item.pantry.coffeetable'),
  armchair: () => tr('assets.item.pantry.armchair'),
  floorlamp: () => tr('assets.item.pantry.floorlamp'),
  rug: () => tr('assets.item.pantry.rug'),
  booth: () => tr('assets.item.pantry.booth'),
  cafetable: () => tr('assets.item.pantry.cafetable'),
  arcade: () => tr('assets.item.pantry.arcade'),
  foosball: () => tr('assets.item.pantry.foosball'),
  planter: () => tr('assets.item.pantry.planter'),
  potplant: () => tr('assets.item.pantry.potplant'),
};
const KITCHEN = new Set(['fridge', 'cabinet', 'espresso', 'grinder', 'sink', 'microwave', 'drinkfridge', 'wallcab']);
const BAR = new Set(['neon', 'island', 'stool', 'pendant']);
// Pieces someone uses (web/prop-use.js lights or moves them only then), and pieces that change after dark.
const USED = new Set([
  'fridge',
  'espresso',
  'grinder',
  'sink',
  'microwave',
  'drinkfridge',
  'island',
  'cafetable',
  'arcade',
  'foosball',
]);
const NIGHT = new Set(['wallcab', 'neon', 'pendant', 'floorlamp', 'cafetable', 'arcade', 'planter']);
const MOVING = new Set([
  'espresso',
  'grinder',
  'sink',
  'microwave',
  'drinkfridge',
  'neon',
  'cafetable',
  'arcade',
  'foosball',
  'planter',
]);
const USE_AXIS = {
  id: 'use',
  label: () => tr('assets.axis.use'),
  values: [
    { id: 'idle', label: () => tr('assets.use.idle') },
    { id: 'use', label: () => tr('assets.use.use') },
  ],
};
// The office draws a soft shadow under a piece standing on the floor: not under rugs, wall pieces, the hanging
// lamps, the planters or what sits on a counter (web/office-draw-furniture.js pantryItems).
const onCounter = name => PantryItems.LAYOUT.some(([n, , , rz]) => n === name && rz > 0);
const shadowed = name => {
  const it = PantryItems.I[name];
  return !it.flat && !it.wall && name !== 'pendant' && name !== 'planter' && !onCounter(name);
};
// One options object for every draw, as the office does, so a frame allocates nothing.
const PO = { night: false, use: 0 };

function entry(name) {
  const it = PantryItems.I[name],
    shadow = shadowed(name);
  return {
    id: 'pantry.' + name,
    cat: 'pantry',
    name: NAMES[name],
    tags: [MOVING.has(name) && 'animated', USED.has(name) && 'state'].filter(Boolean),
    when: { always: true },
    where: 'pantry',
    source: [
      { file: KITCHEN.has(name) || BAR.has(name) ? 'web/pantry-kitchen.js' : 'web/pantry-lounge.js', fn: 'I.' + name },
    ],
    axes: USED.has(name) ? [USE_AXIS] : [],
    uses: NIGHT.has(name) ? ['light'] : [],
    footprint: it.size,
    draw(ctx, view, t) {
      const k = AssetsStage.stage(ctx, view).pantryKit;
      if (shadow) k.shadow(0, 0, it.size[0], it.size[1], 0.22);
      PO.night = view.env.df < 0.5;
      PO.use = view.pick.use === 'use' ? 1 : 0;
      it.draw(k, t, PO);
    },
  };
}

export const PANTRY = PantryItems.ORDER.filter(n => NAMES[n] && PantryItems.I[n]).map(entry);
