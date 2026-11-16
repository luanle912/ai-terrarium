// The /assets catalogue: the animals. The three dogs frame by frame (web/dog-sprites.js, dressed for Christmas by
// web/dog-sprites-xmas.js) and going about their day (the office's drawDog with DogLogic.pose), their kennels and the
// lantern over them, the ducks and fish of the lake (web/island-lake-life.js), the flock and the fireflies
// (web/island-life.js), the reindeer and the penguins of the Christmas event and winter's polar bears and igloo (the
// critter sprites of web/critter-sprites.js, drawn by the office's own methods on the stage's stand-in host).
// Every draw sets what it borrows on the host back as it found it (the host is shared by the entries of a canvas).
import { tr } from './i18n.js';
import { AssetsStage } from './assets-stage.js';
import { DogSprites } from './dog-sprites.js';
import { DogLogic } from './dog-logic.js';
import { CritterSprites } from './critter-sprites.js';
import { BEARS, DOG_HOUSES, FLOOR_Z } from './office-scene.js';
import { IslandLakeLife } from './island-lake-life.js';
import { IslandLife, drawBirds, drawFlies, lifePalette } from './island-life.js';
import { WATER } from './island-art-lake.js';
import { night } from './island-art.js';
import { WATER_Z } from './sky-island.js';
import { ClaudeOffice } from './office.js';
// The bears' methods join ClaudeOffice only here (the page's main.js loads them for the game), after the stage's
// host has borrowed the class's methods: they are called on the host straight from the class.
import './office-draw-bears.js';

const axis = (id, label, values) => ({ id, label, values });
const dfB = view => Math.round(view.env.df * 10);
const snB = view => Math.round(view.env.snow * 10);
// What a dog is dressed by (DogXmas from the event's second level), whatever the page's event control says.
const DRESSED = { key: 'christmas', level: 2, eve: false, day: false };

// ---- names (shared with web/assets-cat-event.js) ----
export const FRAME = {
  stand: () => tr('assets.frame.stand'),
  wag: () => tr('assets.frame.wag'),
  run1: () => tr('assets.frame.run1'),
  run2: () => tr('assets.frame.run2'),
  sit: () => tr('assets.frame.sit'),
  lie: () => tr('assets.frame.lie'),
  sleep: () => tr('assets.frame.sleep'),
  bow: () => tr('assets.frame.bow'),
  drink: () => tr('assets.frame.drink'),
  walk1: () => tr('assets.frame.walk1'),
  walk2: () => tr('assets.frame.walk2'),
  look: () => tr('assets.frame.look'),
  graze: () => tr('assets.frame.graze'),
  waddle1: () => tr('assets.frame.waddle1'),
  waddle2: () => tr('assets.frame.waddle2'),
  slide: () => tr('assets.frame.slide'),
  carry1: () => tr('assets.frame.carry1'),
  carry2: () => tr('assets.frame.carry2'),
  place: () => tr('assets.frame.place'),
  slip: () => tr('assets.frame.slip'),
  wave: () => tr('assets.frame.wave'),
  chute: () => tr('assets.frame.chute'),
  box: () => tr('assets.frame.box'),
};
export const ACT = {
  walk: () => tr('assets.act.walk'),
  run: () => tr('assets.act.run'),
  stand: () => tr('assets.act.stand'),
  sit: () => tr('assets.act.sit'),
  rest: () => tr('assets.act.rest'),
  sleep: () => tr('assets.act.sleep'),
  drink: () => tr('assets.act.drink'),
  bow: () => tr('assets.act.bow'),
  play: () => tr('assets.act.play'),
  waddle: () => tr('assets.act.waddle'),
  carry: () => tr('assets.act.carry'),
  back: () => tr('assets.act.back'),
  moving: () => tr('assets.act.moving'),
};
const BREED = {
  corgi: () => tr('assets.breed.corgi'),
  husky: () => tr('assets.breed.husky'),
  dalmatian: () => tr('assets.breed.dalmatian'),
};
// The values of an axis of frames (or acts), in the order given.
export const frames = (names, table = FRAME) => names.map(id => ({ id, label: table[id] || FRAME[id] || ACT[id] }));
// A critter's acts for the office's drawCritter: the moving ones (EventCritters.pose steps their frames with the
// clock), then every frame of the kind on its own (an act named after a frame shows that frame).
export const critterActs = (kind, moving) => [
  ...frames(moving, ACT),
  ...frames(CritterSprites.frameNames(kind), FRAME),
];
// Runs fn with a field of the stage's host set, and puts it back.
export function borrow(host, key, value, fn) {
  const was = host[key];
  host[key] = value;
  try {
    fn();
  } finally {
    host[key] = was;
  }
}

// ---- dogs ----
const BREEDS = DogLogic.BREEDS;
const BREED_AXIS = axis('breed', () => tr('assets.axis.breed'), frames(BREEDS, BREED));
const DOG_FRAMES = [...new Set(BREEDS.flatMap(DogSprites.frameNames))];
const OUTFIT_AXIS = axis('outfit', () => tr('assets.axis.outfit'), [
  { id: 'plain', label: () => tr('assets.outfit.plain') },
  { id: 'xmas', label: () => tr('assets.outfit.xmas') },
]);
// One frame of a dog's sprite as the office bakes it (light, snow on its back, the Christmas dress), its feet at
// (ox, oy) and the sprite's anchor column over ox, as drawDog places it.
const DOG = {
  id: 'animals.dog',
  cat: 'animals',
  name: () => tr('assets.item.animals.dog'),
  when: { always: true },
  where: 'lawn',
  source: [
    { file: 'web/dog-sprites.js', fn: 'DogSprites.frame' },
    { file: 'web/dog-sprites-xmas.js', fn: 'DogXmas.dress' },
    { file: 'web/office-draw-people.js', fn: 'dogSprite' },
  ],
  axes: [BREED_AXIS, axis('frame', () => tr('assets.axis.frame'), frames(DOG_FRAMES)), OUTFIT_AXIS],
  uses: ['light', 'snow'],
  draw(ctx, view) {
    const s = AssetsStage.stage(ctx, view),
      { breed, frame } = view.pick,
      f = DogSprites.frame(breed, frame),
      img = s.host.dogSprite(breed, frame, dfB(view), snB(view), view.pick.outfit === 'xmas' ? DRESSED : null);
    ctx.drawImage(img, view.ox - f.ax, view.oy - f.h - (img.pad || 0));
  },
};
// A dog doing something, through the office's drawDog: DogLogic.pose picks and steps the frame (a hop when it runs,
// ripples when it drinks, Z's when it sleeps) and it is dressed from the event's second level, as on the lawn.
const DOG_ACTS = ['walk', 'run', 'stand', 'sit', 'rest', 'sleep', 'drink', 'bow', 'play'];
const dogDoing = (breed, act) => ({
  id: 0,
  breed,
  act: act === 'walk' || act === 'run' ? 'stroll' : act,
  x: 0,
  y: 0,
  face: 1,
  path: act === 'walk' || act === 'run' ? [[1, 1]] : [],
  speed: act === 'run' ? DogLogic.RUN : DogLogic.STROLL,
  wag: act === 'stand',
  playing: act === 'play',
  greet: null,
});
const DOGS = new Map(BREEDS.flatMap(b => DOG_ACTS.map(a => [b + '/' + a, dogDoing(b, a)])));
const DOG_LIFE = {
  id: 'animals.dog-life',
  cat: 'animals',
  name: () => tr('assets.item.animals.dog-life'),
  tags: ['animated'],
  when: { always: true },
  where: 'lawn',
  source: [
    { file: 'web/office-draw-people.js', fn: 'drawDog' },
    { file: 'web/dog-logic.js', fn: 'pose' },
  ],
  axes: [BREED_AXIS, axis('act', () => tr('assets.axis.act'), frames(DOG_ACTS, ACT))],
  uses: ['light', 'snow', 'event'],
  draw(ctx, view, t) {
    const s = AssetsStage.stage(ctx, view, t),
      d = DOGS.get(view.pick.breed + '/' + view.pick.act);
    s.scene(0, 0, 0, () => s.host.drawDog(s.G, d, t, dfB(view), snB(view)), true);
  },
};

// ---- kennels ----
const KENNEL_AXIS = axis('kennel', () => tr('assets.axis.kennel'), frames(BREEDS, BREED));
const HOME = axis('dog', () => tr('assets.axis.dog'), [
  { id: 'out', label: () => tr('assets.home.out') },
  { id: 'awake', label: () => tr('assets.home.awake') },
  { id: 'asleep', label: () => tr('assets.home.asleep') },
]);
// The dogs list the kennels read: nobody home, or the kennel's own dog inside, awake or napping.
const AT_HOME = new Map(
  BREEDS.flatMap((breed, id) => [
    [breed + '/out', []],
    [breed + '/awake', [{ id, breed, act: 'inside', nap: false }]],
    [breed + '/asleep', [{ id, breed, act: 'inside', nap: true }]],
  ]),
);
const ITEMS = [];
// The office's doghouseItems lays out the three kennels and the lantern (in that order); fn draws the one asked for.
function kennels(s, view, t, dogs, k) {
  ITEMS.length = 0;
  borrow(s.host, 'dogs', dogs, () => {
    s.host.doghouseItems(s.G, ITEMS, view.env.snow, dfB(view), snB(view));
    ITEMS[k].f();
  });
}
const KENNEL = {
  id: 'animals.kennel',
  cat: 'animals',
  name: () => tr('assets.item.animals.kennel'),
  tags: ['animated', 'state'],
  when: { always: true },
  where: 'kennel',
  source: [{ file: 'web/office-draw-doghouse.js', fn: 'doghouseItems' }],
  axes: [KENNEL_AXIS, HOME],
  uses: ['light', 'snow', 'event'],
  draw(ctx, view, t) {
    const s = AssetsStage.stage(ctx, view, t),
      i = Math.max(0, BREEDS.indexOf(view.pick.kennel)),
      h = DOG_HOUSES[i];
    s.scene(h.x + 0.5, h.y, 0, () => kennels(s, view, t, AT_HOME.get(view.pick.kennel + '/' + view.pick.dog), i), true);
  },
};
const LANTERN = {
  id: 'animals.kennel-lantern',
  cat: 'animals',
  name: () => tr('assets.item.animals.kennel-lantern'),
  tags: ['animated'],
  when: { always: true },
  where: 'kennel',
  source: [{ file: 'web/office-draw-doghouse.js', fn: 'doghouseLantern' }],
  uses: ['light'],
  draw(ctx, view, t) {
    const s = AssetsStage.stage(ctx, view, t),
      [a, b] = DOG_HOUSES;
    s.scene(a.x, (a.y + b.y) / 2, FLOOR_Z + 30, () => kennels(s, view, t, AT_HOME.get('corgi/out'), 3), true);
  },
};

// ---- the lake ----
// drawDucks and drawFish only read the projection's origin off the lake's geometry.
const ORIGIN = { ox: 0, oy: 0 };
const origin = view => {
  ORIGIN.ox = view.ox;
  ORIGIN.oy = view.oy;
  return ORIGIN;
};
const DUCK_STATES = {
  swim: { go: 1, dive: 0, asleep: false },
  float: { go: 0, dive: 0, asleep: false },
  asleep: { go: 0, dive: 0, asleep: true },
  dive: { go: 0.5, dive: 0.4, asleep: false },
  under: { go: 0.5, dive: 0.8, asleep: false },
};
const DUCKS = new Map(Object.entries(DUCK_STATES).map(([k, v]) => [k, [{ x: 0, y: 0, face: 1, ...v }]]));
const DUCK = {
  id: 'animals.duck',
  cat: 'animals',
  name: () => tr('assets.item.animals.duck'),
  tags: ['animated', 'state'],
  when: { always: true },
  where: 'lake',
  source: [{ file: 'web/island-lake-life.js', fn: 'drawDucks' }],
  axes: [
    axis('state', () => tr('assets.axis.state'), [
      { id: 'swim', label: () => tr('assets.duck.swim') },
      { id: 'float', label: () => tr('assets.duck.float') },
      { id: 'asleep', label: () => tr('assets.duck.asleep') },
      { id: 'dive', label: () => tr('assets.duck.dive') },
      { id: 'under', label: () => tr('assets.duck.under') },
    ]),
  ],
  uses: ['light'],
  draw(ctx, view, t) {
    IslandLakeLife.drawDucks(ctx, origin(view), DUCKS.get(view.pick.state), view.env.df, t);
  },
};
// Three fish shadows heading different ways; they are faint on purpose, so they are shown on the lake's own water.
const FISH_LIST = [
  { x: 0, y: 0, hx: 1, hy: 0, a: 1 },
  { x: 0.9, y: -0.6, hx: 0, hy: -1, a: 0.85 },
  { x: -0.7, y: 0.6, hx: -1, hy: 1, a: 0.7 },
];
const FISH = {
  id: 'animals.fish',
  cat: 'animals',
  name: () => tr('assets.item.animals.fish'),
  when: { always: true },
  where: 'lake',
  source: [{ file: 'web/island-lake-life.js', fn: 'drawFish' }],
  uses: ['light'],
  palette: () => ['#16284a', WATER.mid],
  draw(ctx, view) {
    ctx.fillStyle = night(WATER.mid, view.env.df);
    ctx.fillRect(view.ox - 30, view.oy - WATER_Z - 12, 60, 26);
    IslandLakeLife.drawFish(ctx, origin(view), FISH_LIST, view.env.df);
  },
};

// ---- the sky over the island, and the lotus at night ----
// A V of five, the leader in front, flapping as the game's flock does or held on one wing position; on the day sky.
const FLOCK = [0, 1, 2, 3, 4].map(j => ({ x: 0, y: 0, lane: 0, dir: 1, wing: 0, j }));
const LIFE_BIRDS = { birds: FLOCK };
const SKY = { sky: { x0: 0, x1: 100, y: 0 } },
  DAY_SKY = AssetsStage.envOf({}).col.horizon;
const BIRD = {
  id: 'animals.bird',
  cat: 'animals',
  name: () => tr('assets.item.animals.bird'),
  tags: ['animated'],
  when: { always: true },
  where: 'sky',
  source: [{ file: 'web/island-life.js', fn: 'drawBirds' }],
  axes: [
    axis('wing', () => tr('assets.axis.wing'), [
      { id: 'flap', label: () => tr('assets.wing.flap') },
      { id: 'up', label: () => tr('assets.wing.up') },
      { id: 'spread', label: () => tr('assets.wing.spread') },
    ]),
  ],
  palette: () => [lifePalette(1).bird, DAY_SKY],
  draw(ctx, view, t) {
    const w = view.pick.wing;
    SKY.sky.x0 = view.ox;
    SKY.sky.x1 = view.ox + 100;
    SKY.sky.y = view.oy - 25;
    for (const b of FLOCK) {
      const rank = (b.j + 1) >> 1;
      b.x = 0.3 - rank * 0.07;
      b.y = (b.j % 2 ? -1 : 1) * rank * 5;
      b.wing = w === 'flap' ? Math.floor(t * 4 + b.j * 0.6) & 1 : w === 'up' ? 0 : 1;
    }
    ctx.fillStyle = DAY_SKY;
    ctx.fillRect(view.ox + 6, view.oy - 22, 34, 34);
    drawBirds(ctx, SKY, lifePalette(1), LIFE_BIRDS);
  },
};
// Eight fireflies round a point, wandering and pulsing as IslandLife.creatures moves them after dark.
const FLY_G = {
  ox: 0,
  oy: 0,
  anchors: [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({
    x: Math.cos(i * 0.785) * 1.1,
    y: Math.sin(i * 0.785) * 1.1,
  })),
};
const FIREFLY = {
  id: 'animals.firefly',
  cat: 'animals',
  name: () => tr('assets.item.animals.firefly'),
  tags: ['animated'],
  when: { seasons: ['spring', 'summer', 'autumn'] },
  where: 'lake',
  source: [
    { file: 'web/island-life.js', fn: 'drawFlies' },
    { file: 'web/island-life.js', fn: 'creatures' },
  ],
  palette: () => ['#f4ffb4'],
  draw(ctx, view, t) {
    FLY_G.ox = view.ox;
    FLY_G.oy = view.oy;
    drawFlies(ctx, FLY_G, IslandLife.creatures(t, 0, 7), 1, false);
  },
};

// ---- the Christmas critters and the winter bears ----
// One critter the office's drawCritter draws (its feet on the scene's origin), its act set before each draw.
export function critterEntry({ id, name, kind, moving, when, where, extra = [], set, source = [] }) {
  const c = { kind, id: 0, act: moving[0], x: 0, y: 0, face: 1, red: false };
  return {
    id,
    cat: id.split('.')[0],
    name,
    tags: ['animated'],
    when,
    where,
    source: [
      { file: 'web/critter-sprites.js', fn: 'KINDS.' + kind },
      { file: 'web/office-draw-critters.js', fn: 'drawCritter' },
      { file: 'web/event-critters.js', fn: 'pose' },
      ...source,
    ],
    axes: [axis('act', () => tr('assets.axis.act'), critterActs(kind, moving)), ...extra],
    uses: ['light'],
    draw(ctx, view, t) {
      const s = AssetsStage.stage(ctx, view, t);
      c.act = view.pick.act;
      if (set) set(c, view.pick);
      s.scene(0, 0, 0, () => s.host.drawCritter(s.G, c, dfB(view)), true);
    },
  };
}
const REINDEER = critterEntry({
  id: 'animals.reindeer',
  name: () => tr('assets.item.animals.reindeer'),
  kind: 'reindeer',
  moving: ['walk'],
  when: { event: { key: 'christmas', level: 2 } },
  where: 'lawn',
  extra: [
    axis('nose', () => tr('assets.axis.nose'), [
      { id: 'plain', label: () => tr('assets.nose.plain') },
      { id: 'rudolph', label: () => tr('assets.nose.rudolph') },
    ]),
  ],
  set: (c, pick) => (c.red = pick.nose === 'rudolph'),
});
const PENGUIN = critterEntry({
  id: 'animals.penguin',
  name: () => tr('assets.item.animals.penguin'),
  kind: 'penguin',
  moving: ['waddle'],
  when: { event: { key: 'christmas', level: 3 } },
  where: 'lake',
});
// A polar bear or its cub: walking (PolarBears.pose steps the frames, through the office's drawBear) or one frame.
const BEAR_FRAMES = CritterSprites.frameNames('bear');
const BEARS_NOW = {
  bear: { kind: 'bear', act: 'walk', path: [[1, 1]], face: 1, x: 0, y: 0 },
  cub: { kind: 'cub', act: 'walk', path: [[1, 1]], face: 1, x: 0, y: 0 },
};
const POLAR_BEAR = {
  id: 'animals.polar-bear',
  cat: 'animals',
  name: () => tr('assets.item.animals.polar-bear'),
  tags: ['animated'],
  when: { seasons: ['winter'] },
  where: 'lawn',
  source: [
    { file: 'web/critter-sprites.js', fn: 'BEAR_TOP' },
    { file: 'web/office-draw-bears.js', fn: 'drawBear' },
    { file: 'web/polar-bears.js', fn: 'pose' },
  ],
  axes: [
    axis('kind', () => tr('assets.axis.kind'), [
      { id: 'bear', label: () => tr('assets.bear.mother') },
      { id: 'cub', label: () => tr('assets.bear.cub') },
    ]),
    axis('frame', () => tr('assets.axis.frame'), frames(['moving', ...BEAR_FRAMES], ACT)),
  ],
  uses: ['light'],
  draw(ctx, view, t) {
    const s = AssetsStage.stage(ctx, view, t),
      kind = view.pick.kind === 'cub' ? 'cub' : 'bear';
    if (view.pick.frame === 'moving')
      return s.scene(
        0,
        0,
        0,
        () => ClaudeOffice.prototype.drawBear.call(s.host, s.G, BEARS_NOW[kind], dfB(view)),
        true,
      );
    const img = s.host.critterSprite(kind, view.pick.frame, dfB(view), false, false);
    ctx.drawImage(img, view.ox - img.ax, view.oy - img.fh);
  },
};
const IGLOO = {
  id: 'animals.igloo',
  cat: 'animals',
  name: () => tr('assets.item.animals.igloo'),
  when: { seasons: ['winter'] },
  where: 'lawn',
  source: [{ file: 'web/office-draw-bears.js', fn: 'drawIgloo' }],
  uses: ['light'],
  draw(ctx, view) {
    const s = AssetsStage.stage(ctx, view),
      ig = BEARS.igloo;
    s.scene(ig.x + 1, ig.y + 1, 0, () => ClaudeOffice.prototype.drawIgloo.call(s.host, s.G, dfB(view)), true);
  },
};

export const ANIMALS = [
  DOG,
  DOG_LIFE,
  KENNEL,
  LANTERN,
  DUCK,
  FISH,
  BIRD,
  FIREFLY,
  REINDEER,
  PENGUIN,
  POLAR_BEAR,
  IGLOO,
];
