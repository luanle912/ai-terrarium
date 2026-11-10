import { I18n, tr } from './i18n.js';
import { SkyLogic } from './sky-logic.js';
import { DogLogic } from './dog-logic.js';
import { SmokeLogic } from './smoke-logic.js';
import { RestroomLogic } from './restroom-logic.js';
export const h = React.createElement;
// Shared by both settings panels. A change reloads the page so tables built at load time pick up the new language;
// when the choice could not be saved (storage blocked) it travels in ?lang= instead.
export function switchLanguage(code) {
  const r = I18n.setLang(code);
  if (r === 'saved') {
    location.reload();
    return;
  }
  if (r) {
    const u = new URL(location.href);
    u.searchParams.set('lang', code);
    location.href = u.href;
  }
}
export function languagePicker() {
  return h(
    'label',
    null,
    tr('settings.language'),
    h(
      'select',
      { 'aria-label': tr('settings.language'), value: I18n.lang, onChange: e => switchLanguage(e.target.value) },
      I18n.LANGS.map(([code, name]) => h('option', { key: code, value: code, lang: code }, name)),
    ),
  );
}

export const W = 27,
  H = 14,
  TW = 16,
  TH = 8,
  WALL = 56;
// The scene is framed by the hexagon island around the office (web/island-land.js), not by the office alone.
export const ISLAND = SkyLogic.buildIsland({ W, H });
// The office stands on a plinth FLOOR_Z above the lawn, so P (everything in the office: floor, walls, people, bubbles,
// clicks) is lifted by it, while PG is the bare lawn level used for trees, the waterfall and the plinth itself.
export const FLOOR_Z = 8;
export const { LW, LH, OX, OY, FH } = SkyLogic.sceneFrame(ISLAND, { W, H, TW, TH, WALL: WALL + FLOOR_Z, pad: 16 });
export const PG = (x, y, z = 0) => [OX + (x - y) * TW, OY + (x + y) * TH - z];
export const P = (x, y, z = 0) => PG(x, y, z + FLOOR_Z);
// Agents can step down the stairs onto the lawn, so a person stands at the ground height of wherever they are.
export const STAIRS = SkyLogic.stairs(W, H),
  LAWN_WALK = SkyLogic.lawnWalk(ISLAND, W, H);
// The restroom block beside the pantry is raised to the office floor too.
export const PA = (x, y, z = 0) =>
  PG(x, y, z + (RestroomLogic.onFloor(WC, x, y) ? FLOOR_Z : SkyLogic.groundZ(x, y, W, H, STAIRS, FLOOR_Z)));
// The walls rise WALL_REACH tiles' worth up the screen (16 px a tile): a sprite standing on a cell that close behind
// either wall, in a screen column the wall covers, is (partly) hidden by it, so the scene draws such sprites before the
// walls (web/office-draw.js).
export const WALL_REACH = Math.floor((WALL + 3 + FLOOR_Z) / (2 * TH));
export const behindWalls = (x, y) =>
  (x < 0 && x >= -WALL_REACH && y - x >= -1 && y - x <= H + 1) ||
  (y < 0 && y >= -WALL_REACH && x - y >= -1 && x - y <= W + 1);
// The smoking corner fills the east-front outdoor spot, right beside the restroom block's east side, at the end of the
// garden path that runs along the block's front. Only its planted trough (which faces the block) is taken off the
// walkable lawn: seats, the ash bin and the posts are thin enough to step past, and an agent's own spot must stay
// walkable to path from it. Its pad is entered only through the entrance (SMOKE.shut, added to EDGE
// below), so nobody climbs over the bench back on the way in from the stairs.
export const SMOKE = SmokeLogic.layout(ISLAND.spots.find(s => s.id === 'east-front'));
SMOKE.blocked.forEach(k => LAWN_WALK.delete(k));
// The restroom block fills the east-back spot along the pantry's east side, on the office floor level: its tiles are
// floor, not lawn, and bfs reaches them only across the pantry (RestroomLogic.step), never from the grass.
export const WC = RestroomLogic.layout(
    ISLAND.spots.find(s => s.id === 'east-back'),
    WALL,
  ),
  WC_WALK = new Set(WC.walk);
WC.floor.forEach(k => LAWN_WALK.delete(k));
// The dogs' houses, one each (DogLogic.BREEDS order), in a row on the lawn against the restroom block's east wall,
// their doors toward the viewer (+x). The row runs from the block's back corner outward, so the smoking corner's
// pergola and plants, in front of the wall's other end, hide none of them. The dogs go in at night and in the rain;
// nobody walks over the houses.
export const DOG_HOUSES = [0, 1, 2].map(i => ({ x: WC.x1, y: WC.y0 - 2 + i, door: [WC.x1 + 1, WC.y0 - 2 + i] }));
DOG_HOUSES.forEach(h => LAWN_WALK.delete(h.x + ',' + h.y));
// Paving walks like the garden path: smokers stay on their pad.
export const PAVED = new Set(SMOKE.paved);
// The office dogs live on the lawn all round the office, by the lake and on the back lawn; never in the lake, the
// pool under the mountain falls, on the mountain, the bench, the smoking corner or the restroom. They drink at the
// lake and, where they can reach it, at the pool. Trees, bushes, lamps and the bench are sorted with them, but the
// mountain is part of the island picture under every sprite, so no dog stands where it would be drawn over it: up to
// as many rows behind a mountain cell as the stone above that cell rises (8 px a row), and at least the two rows behind
// its grassy foot. The strip right behind the
// walls is left out too: web/office-draw.js would draw a dog there correctly, before the walls, but they would hide it
// whole (the left wall covers the strip beside it out to the island's edge).
const REST = ISLAND.rest,
  WATER = new Set([...ISLAND.pond.cells, ...ISLAND.mountain.pool.cells]),
  FISH_PT = [REST.fish.x + 0.6, REST.fish.y + 0.5],
  M = ISLAND.mountain,
  // the height of the stone over a point: each cone as if it rose straight from its foot to its tip, and the rock of
  // the gap the falls pour out of
  stoneH = (x, y) =>
    Math.max(
      0,
      ...M.peaks.map(p => p.h * (1 - Math.hypot(x - p.x - 0.5, y - p.y - 0.5) / (1.12 * p.R))),
      Math.abs(x - M.gap.x) < 1.5 && Math.abs(y - M.gap.y) < 1 ? M.gap.z + 7 : 0,
    );
export const DOG_ROAM = DogLogic.roamCells(LAWN_WALK, {
  W,
  H,
  pond: WATER,
  avoid: [
    ...ISLAND.spots.filter(s => s.id === 'east-back' || s.id === 'east-front'),
    { x: REST.bench.x, y: REST.bench.y, w: 1, h: 1 },
    ...DOG_HOUSES.map(h => ({ x: h.x, y: h.y, w: 1, h: 1 })),
  ],
  wallReach: WALL_REACH,
  tall: [...M.cells].map(k => {
    const [x, y] = k.split(',').map(Number);
    return [x, y, Math.max(2, Math.ceil(stoneH(x + 0.5, y + 0.5) / TH))];
  }),
});
// They run across the stone paths and past the stairs but never lie, sit, sniff or sleep on them (the stairs' foot and
// the tile beyond it stay free), nor on the fishing spot. At night they curl up at (33,8), by the grove on the east
// lawn: a quiet corner away from the paths and still in view at 1×. While someone sits on the bench, one dog lies on
// the cell beside it (DOG_PLACES.rest, DogLogic 'company').
export const DOG_CLEAR = new Set(ISLAND.paths.cells);
DOG_CLEAR.add(REST.fish.x + ',' + REST.fish.y);
STAIRS.forEach(s => {
  for (let i = 0; i < s.len; i++)
    for (let o = 0; o < 2; o++)
      DOG_CLEAR.add(s.side === 'east' ? s.x + o + ',' + (s.y + i) : s.x + i + ',' + (s.y + o));
});
export const DOG_PLACES = {
  W,
  H,
  roam: DOG_ROAM,
  roamList: [...DOG_ROAM].map(k => k.split(',').map(Number)),
  clear: DOG_CLEAR,
  den: DogLogic.denCells(DOG_ROAM, [33, 8], DOG_CLEAR),
  houses: DOG_HOUSES,
  // not at the pavilion's stepping stones or where an agent bathes
  drink: DogLogic.drinkSpots(
    DOG_ROAM,
    new Set(
      [...WATER].filter(
        k =>
          !ISLAND.pavilion.path.some(p => p.x + ',' + p.y === k) && !ISLAND.pond.spots.some(p => p.x + ',' + p.y === k),
      ),
    ),
    DOG_CLEAR,
  ),
  rest: DogLogic.besideCell(DOG_ROAM, [REST.bench.x, REST.bench.y], DOG_CLEAR, [FISH_PT]),
};
export const REAL_WEATHER_EVERY_MS = 15 * 60_000;
export const WEATHER_LABEL = {
  clear: tr('weather.label.clear'),
  cloudy: tr('weather.label.cloudy'),
  rain: tr('weather.label.rain'),
  storm: tr('weather.label.storm'),
  snow: tr('weather.label.snow'),
  fog: tr('weather.label.fog'),
};
export const WEATHER_PREVIEW = [
  ['clear', tr('weather.preview.clear')],
  ['cloudy', tr('weather.preview.cloudy')],
  ['rain', tr('weather.preview.rain')],
  ['storm', tr('weather.preview.storm')],
  ['snow', tr('weather.preview.snow')],
  ['fog', tr('weather.preview.fog')],
];
export const ZONES = [
  { zx: 0, zy: 0 },
  { zx: 10, zy: 0 },
  { zx: 0, zy: 8 },
  { zx: 10, zy: 8 },
];
export const DESKS = [];
ZONES.forEach((z, zi) =>
  [
    [1, 1],
    [5, 1],
    [1, 4],
    [5, 4],
  ].forEach(([dx, dy]) => DESKS.push({ gx: z.zx + dx, gy: z.zy + dy, zone: zi })),
);
export const BLOCK = new Set();
DESKS.forEach(d => {
  BLOCK.add(d.gx + ',' + d.gy);
  BLOCK.add(d.gx + 1 + ',' + d.gy);
});
['8,0', '9,0', '8,13', '19,13', '18,0', '26,13'].forEach(k => BLOCK.add(k));
// Pantry furniture: the kitchen wall (row 0), the island (row 3), the tables by the bench and the sky-view bar.
for (let x = 20; x < W; x++) BLOCK.add(x + ',0');
for (let x = 22; x <= 25; x++) {
  BLOCK.add(x + ',2');
  BLOCK.add(x + ',3');
}
for (let x = 23; x <= 25; x++) BLOCK.add(x + ',5');
// `prop` names the device the spot uses (web/prop-use.js): it lights up or moves only while someone is there.
export const IDLE_SPOTS = [
  // kitchen wall: fridge, espresso, grinder, sink, microwave, drinkfridge
  { act: 'fridge', tile: [21, 1], pt: [20.8, 1.0], front: false, prop: 'fridge' },
  { act: 'coffee', tile: [21, 1], pt: [21.7, 1.0], front: false, prop: 'espresso' },
  { act: 'coffee', tile: [22, 1], pt: [22.5, 1.0], front: false, prop: 'grinder' },
  { act: 'water', tile: [23, 1], pt: [23.4, 1.0], front: false, prop: 'sink' },
  { act: 'microwave', tile: [24, 1], pt: [24.9, 1.0], front: false, prop: 'microwave' },
  { act: 'snack', tile: [25, 1], pt: [25.2, 1.0], front: false, prop: 'drinkfridge' },
  // island bar stools (4 stools facing kitchen)
  { act: 'table', tile: [21, 4], pt: [22.1, 3.95], stool: 2, front: false, prop: 'island' },
  { act: 'table', tile: [22, 4], pt: [22.9, 3.95], stool: 2, front: false, prop: 'island' },
  { act: 'table', tile: [23, 4], pt: [23.7, 3.95], stool: 2, front: false, prop: 'island' },
  { act: 'table', tile: [24, 4], pt: [24.5, 3.95], stool: 2, front: false, prop: 'island' },
  // booth cafe tables (3 tables with chairs)
  { act: 'meal', tile: [22, 10], pt: [22.1, 10.2], stool: 1, front: false, prop: 'cafe0' },
  { act: 'meal', tile: [22, 11], pt: [22.1, 11.4], stool: 1, front: false, prop: 'cafe1' },
  { act: 'meal', tile: [22, 12], pt: [22.1, 12.6], stool: 1, front: false, prop: 'cafe2' },
  // game corner: playing the two arcades and the foosball table (one player at each end)
  { act: 'arcade', tile: [25, 11], pt: [25.1, 10.5], front: false, prop: 'arcade0' },
  { act: 'arcade', tile: [26, 11], pt: [25.9, 10.5], front: false, prop: 'arcade1' },
  { act: 'foosball', tile: [24, 13], pt: [24.6, 12.0], front: true, prop: 'foosball' },
  { act: 'foosball', tile: [25, 13], pt: [25.4, 12.3], front: true, prop: 'foosball' },
  // lounge: coffeetable, armchair, sofa area
  { act: 'phone', tile: [24, 8], pt: [23.5, 7.3], front: true },
  { act: 'phone', tile: [26, 8], pt: [26.0, 7.3], front: true },
  { act: 'stretch', tile: [22, 6], pt: [22.8, 6.0], front: true },
  { act: 'phone', tile: [23, 13], pt: [24.0, 13.2], front: true },
  // the smoking corner out on the lawn
  ...SMOKE.spots,
  // the restroom by the pantry: a short visit, then on to another spot (goalFor)
  ...WC.spots,
  // bathing in the pond out on the lawn, reached down the pantry stairs
  ...ISLAND.pond.spots.map(s => ({ act: 'bath', tile: [s.x, s.y], pt: [s.x + 0.5, s.y + 0.5], front: true })),
  // the rest corner on the lake's inner bank: sitting on the stone bench (web/island-art.js; the
  // sitter sits at its front edge, where a stool-1 sitter's hem meets the 6.5 px seat)
  // and fishing at the water's edge, the lake on the +x side; both face the viewer
  {
    act: 'bench',
    tile: [REST.bench.x, REST.bench.y],
    pt: [REST.bench.x + 0.5, REST.bench.y + 0.66],
    stool: 1,
    front: true,
  },
  { act: 'fish', tile: [REST.fish.x, REST.fish.y], pt: FISH_PT, front: true },
];
export const ACT_TXT = {
  table: tr('office.act.table'),
  meal: tr('office.act.meal'),
  arcade: tr('office.act.arcade'),
  foosball: tr('office.act.foosball'),
  coffee: tr('office.act.coffee'),
  fridge: tr('office.act.fridge'),
  water: tr('office.act.water'),
  microwave: tr('office.act.microwave'),
  snack: tr('office.act.snack'),
  smoke: tr('office.act.smoke'),
  wc: tr('office.act.wc'),
  phone: tr('office.act.phone'),
  stretch: tr('office.act.stretch'),
  bath: tr('office.act.bath'),
  bench: tr('office.act.bench'),
  fish: tr('office.act.fish'),
};
export const SEGS = [],
  EDGE = new Set();
export const addV = (zi, X, y) => {
  SEGS.push({ zi, v: true, X, y });
  EDGE.add(X - 1 + ',' + y + '|' + X + ',' + y);
  EDGE.add(X + ',' + y + '|' + (X - 1) + ',' + y);
};
export const addH = (zi, Y, x) => {
  SEGS.push({ zi, v: false, Y, x });
  EDGE.add(x + ',' + (Y - 1) + '|' + x + ',' + Y);
  EDGE.add(x + ',' + Y + '|' + x + ',' + (Y - 1));
};
ZONES.forEach((z, zi) => {
  const Y = z.zy === 0 ? 6 : 8;
  (z.zx === 0 ? [8] : [10, 18]).forEach(X => {
    for (let y = z.zy; y <= z.zy + 5; y++) if (y !== z.zy + 3) addV(zi, X, y);
  });
  for (let x = z.zx; x <= z.zx + 7; x++) if (x !== z.zx + 3 && x !== z.zx + 4) addH(zi, Y, x);
});
for (let y = 0; y < H; y++) if (y !== 6 && y !== 7) addV(4, 20, y);
SMOKE.shut.forEach(e => EDGE.add(e));
export const zoneAt = (x, y) => {
  if (x >= 20) return 4;
  for (let i = 0; i < 4; i++) {
    const z = ZONES[i];
    if (x >= z.zx && x <= z.zx + 7 && y >= z.zy && y <= z.zy + 5) return i;
  }
  return -1;
};
export const mix = (a, b, p) => {
  if (!a || a[0] !== '#') return b;
  const A = parseInt(a.slice(1), 16),
    B = parseInt(b.slice(1), 16),
    f = s => Math.round(((A >> s) & 255) * (1 - p) + ((B >> s) & 255) * p);
  return '#' + ((1 << 24) + (f(16) << 16) + (f(8) << 8) + f(0)).toString(16).slice(1);
};
export const DOOR = { tile: [0, 7], pt: [-0.9, 7] };
export const DEPT_PAL = ['#3e8ed0', '#e5484d', '#46a758', '#8e4ec6', '#f5a524', '#12a594', '#e93d82', '#5b5bd6'];
export const SIM_DEPTS = [
  ['newera-web', 'WEB'],
  ['api-gateway', 'API'],
  ['mobile-app', 'MOB'],
  ['infra-tf', 'INF'],
];
export const colOf = i => DESKS[i].zone;

export const THEMES = {
  night: {
    label: 'Night shift',
    bg: '#0b0e14',
    fa: '#1b2233',
    fb: '#1f2740',
    wl: '#262f48',
    wr: '#2e3856',
    trim: '#3d4970',
    glass: '#16294a',
    glassHi: '#2f5d9a',
    door: '#151a27',
    board: '#d9dee8',
    dt: '#7a5a40',
    dl: '#5c4330',
    dr: '#4a3626',
    mon: '#15161c',
    on: '#5ef2ff',
    off: '#262d3d',
    chair: '#3b4058',
    kb: '#2b2f3c',
    plant: '#3fa36b',
    pot: '#a5573b',
    stroke: null,
    shadow: 'rgba(0,0,0,0.45)',
  },
  day: {
    label: 'Sunny studio',
    bg: '#f4ead8',
    fa: '#d8b689',
    fb: '#d1ad7e',
    wl: '#f3e7d3',
    wr: '#eadbc2',
    trim: '#cdb796',
    glass: '#a9dbff',
    glassHi: '#e2f4ff',
    door: '#9a6b45',
    board: '#ffffff',
    dt: '#fbf7ee',
    dl: '#ddd2bf',
    dr: '#c9bca6',
    mon: '#3a3a46',
    on: '#8be0b4',
    off: '#55596a',
    chair: '#e07a5f',
    kb: '#cfc6b4',
    plant: '#4caf6a',
    pot: '#d0743c',
    stroke: null,
    shadow: 'rgba(80,50,20,0.25)',
  },
  blueprint: {
    label: 'Blueprint',
    bg: '#eef1f6',
    fa: '#ffffff',
    fb: '#f6f8fb',
    wl: '#e3e8f0',
    wr: '#d9e0eb',
    trim: '#b9c4d6',
    glass: '#ffffff',
    glassHi: '#ffffff',
    door: '#c9d3e3',
    board: '#ffffff',
    dt: '#ffffff',
    dl: '#e9edf4',
    dr: '#dde3ec',
    mon: '#ffffff',
    on: '#2f5bff',
    off: '#e3e8f0',
    chair: '#ffffff',
    kb: '#ffffff',
    plant: '#ffffff',
    pot: '#ffffff',
    stroke: '#7d8aa3',
    shadow: 'rgba(47,91,255,0.15)',
  },
};
export function dayFactor() {
  const d = new Date(),
    t = d.getHours() + d.getMinutes() / 60;
  if (t < 5) return 0;
  if (t < 6.5) return (1 - Math.cos(((t - 5) / 1.5) * Math.PI)) / 2;
  if (t < 16.5) return 1;
  if (t < 18) return (1 + Math.cos(((t - 16.5) / 1.5) * Math.PI)) / 2;
  return 0;
}
export function lerpHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16),
    pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t),
    g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t),
    bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}
export function lerpTheme(f) {
  const n = THEMES.night,
    d = THEMES.day,
    o = { _day: f };
  for (const k in n) {
    if (k === 'label') o[k] = f > 0.5 ? d[k] : n[k];
    else if (k === 'stroke') o[k] = null;
    else if (k === 'shadow') {
      const pa = n[k].match(/[\d.]+/g).map(Number),
        pb = d[k].match(/[\d.]+/g).map(Number);
      o[k] =
        'rgba(' +
        pa
          .map((v, i) => {
            const r = v * (1 - f) + pb[i] * f;
            return i < 3 ? Math.round(r) : Math.round(r * 100) / 100;
          })
          .join(',') +
        ')';
    } else if (typeof n[k] === 'string' && n[k][0] === '#') o[k] = lerpHex(n[k], d[k], f);
    else o[k] = n[k];
  }
  return o;
}
