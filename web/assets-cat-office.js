// The /assets catalogue: the office. The sixteen pieces of OfficeDecor.ITEMS (nine of them never drawn by the live
// game), the usage board on the wall, the glass walls between departments and the older desk (both office methods,
// run on the stage's stand-in host), and the Christmas touches: the wreath and the little things on owned desks.
import { tr } from './i18n.js';
import { AssetsStage } from './assets-stage.js';
import { OfficeDecor } from './office-decor.js';
import { drawUsageBoard } from './decor-boards.js';
import { DECOR_SPOT, WREATH_SPOT, deskDecor, wreath } from './office-draw-xmas.js';
import { DOOR_KIT } from './office-draw.js';
import { DEPT_PAL, DESKS, SEGS, THEMES } from './office-scene.js';

const F = OfficeDecor.F;
const kitOf = (ctx, view) => AssetsStage.stage(ctx, view).kit;
const FURN = 'web/decor-furniture.js',
  WALL = 'web/decor-wall.js';
const { axis } = AssetsStage;

// ---- the kit furniture (OfficeDecor.ITEMS) ----
// One options object per piece, filled in place before each draw.
const DESK_O = { screen: 'code', noMug: false, lit: 1 };
const SCREENS = axis('screen', () => tr('assets.axis.screen'), [
  { id: 'code', label: () => tr('assets.screen.code') },
  { id: 'read', label: () => tr('assets.screen.read') },
  { id: 'term', label: () => tr('assets.screen.term') },
  { id: 'think', label: () => tr('office.status.thinking') },
  { id: 'perm', label: () => tr('office.status.permission') },
  { id: 'error', label: () => tr('office.status.error') },
  { id: 'done', label: () => tr('office.status.done') },
  { id: 'off', label: () => tr('assets.screen.off') },
]);
const PART_O = { color: DEPT_PAL[0] };
const TEAMS = DEPT_PAL.map((c, i) => ({
  id: 'team-' + (i + 1),
  label: () => tr('assets.team', { n: i + 1 }),
  swatch: c,
}));
const kitPiece = (key, file, more) => ({
  id: 'office.' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()),
  cat: 'office',
  when: { always: true },
  where: 'office',
  source: [{ file, fn: 'F.' + key }],
  draw: (ctx, view, t) => F[key](kitOf(ctx, view), t),
  ...more,
});

const KIT = [
  kitPiece('desk', FURN, {
    name: () => tr('assets.item.office.desk'),
    tags: ['animated', 'state'],
    axes: [SCREENS],
    // as the office's workstation sets it: the mug makes way for the terminal, an idle screen is off
    draw(ctx, view, t) {
      const s = view.pick.screen || 'code';
      DESK_O.screen = s;
      DESK_O.noMug = s === 'term';
      DESK_O.lit = s === 'off' ? 0 : 1;
      F.desk(kitOf(ctx, view), t, DESK_O);
    },
  }),
  kitPiece('chair', FURN, { name: () => tr('assets.item.office.chair') }),
  kitPiece('chairBase', FURN, { name: () => tr('assets.item.office.chair-base') }),
  kitPiece('backrest', FURN, { name: () => tr('assets.item.office.backrest') }),
  kitPiece('bookshelf', FURN, { name: () => tr('assets.item.office.bookshelf'), catalogueOnly: true }),
  kitPiece('coffee', FURN, { name: () => tr('assets.item.office.coffee'), catalogueOnly: true, tags: ['animated'] }),
  kitPiece('fridge', FURN, { name: () => tr('assets.item.office.fridge'), catalogueOnly: true }),
  kitPiece('cooler', FURN, { name: () => tr('assets.item.office.cooler'), catalogueOnly: true, tags: ['animated'] }),
  kitPiece('vending', FURN, { name: () => tr('assets.item.office.vending'), catalogueOnly: true, tags: ['animated'] }),
  kitPiece('table', FURN, { name: () => tr('assets.item.office.table'), catalogueOnly: true }),
  kitPiece('partition', FURN, {
    name: () => tr('assets.item.office.partition'),
    catalogueOnly: true,
    axes: [axis('colour', () => tr('assets.axis.colour'), TEAMS)],
    draw(ctx, view, t) {
      const i = TEAMS.findIndex(v => v.id === view.pick.colour);
      PART_O.color = DEPT_PAL[i < 0 ? 0 : i];
      F.partition(kitOf(ctx, view), t, PART_O);
    },
  }),
  kitPiece('plants', FURN, { name: () => tr('assets.item.office.plants'), catalogueOnly: true, tags: ['animated'] }),
  kitPiece('window', WALL, {
    name: () => tr('assets.item.office.window'),
    tags: ['animated'],
    uses: ['light'],
    draw: (ctx, view, t) => F.window(kitOf(ctx, view), t, view.env.df < 0.5 ? NIGHT_ON : NIGHT_OFF),
  }),
  kitPiece('walldecor', WALL, {
    name: () => tr('assets.item.office.walldecor'),
    catalogueOnly: true,
    tags: ['animated'],
  }),
  kitPiece('door', WALL, { name: () => tr('assets.item.office.door'), tags: ['animated'] }),
  kitPiece('rug', WALL, { name: () => tr('assets.item.office.rug'), catalogueOnly: true }),
];
const NIGHT_ON = { night: true },
  NIGHT_OFF = { night: false };

// ---- the usage board (web/decor-boards.js) ----
const LEVELS = { low: [0.22, 0.35], mid: [0.66, 0.58], high: [0.93, 0.88] };
const BOARD_O = { variant: 'led', night: false, h5: 0, d7: 0, r5: 135, r7: 4210 };
const BOARD = {
  id: 'office.usage-board',
  cat: 'office',
  name: () => tr('assets.item.office.usage-board'),
  tags: ['animated', 'state'],
  when: { always: true },
  where: 'office',
  source: [{ file: 'web/decor-boards.js', fn: 'drawUsageBoard' }],
  axes: [
    axis('variant', () => tr('assets.axis.style'), [
      { id: 'led', label: () => tr('assets.board.led') },
      { id: 'whiteboard', label: () => tr('assets.board.whiteboard') },
      { id: 'gauge', label: () => tr('assets.board.gauge') },
    ]),
    axis('level', () => tr('assets.axis.usage'), [
      { id: 'low', label: () => tr('assets.usage.low') },
      { id: 'mid', label: () => tr('assets.usage.mid') },
      { id: 'high', label: () => tr('assets.usage.high') },
    ]),
    axis('wall', () => tr('assets.axis.wall'), [
      { id: 'left', label: () => tr('assets.wall.left') },
      { id: 'back', label: () => tr('assets.wall.back') },
    ]),
  ],
  uses: ['light'],
  draw(ctx, view, t) {
    const [h5, d7] = LEVELS[view.pick.level] || LEVELS.low;
    BOARD_O.variant = view.pick.variant || 'led';
    BOARD_O.night = view.env.df < 0.5;
    BOARD_O.h5 = h5;
    BOARD_O.d7 = d7;
    drawUsageBoard(ctx, view.ox, view.oy, BOARD_O, t, view.pick.wall || 'left');
  },
};

// ---- office methods, run on the stand-in host ----
const THEME_AXIS = axis('theme', () => tr('assets.axis.theme'), [
  { id: 'light', label: () => tr('assets.theme.light') },
  { id: 'blueprint', label: () => tr('assets.theme.blueprint') },
]);
// The stage of the draw under way and what it shows: the office methods below run in scene() through fixed functions,
// so a card drawn frame after frame makes no closures. A stage starts every draw with the scene's own theme and a
// clean host (AssetsStage.stage), so nothing set here outlives the draw.
const NOW = { s: null, own: null };
function aim(ctx, view, t) {
  const s = (NOW.s = AssetsStage.stage(ctx, view, t));
  if (view.pick.theme === 'blueprint') s.G.th = THEMES.blueprint;
  return s;
}
// A glass wall along x, between two zones of desks; owned, its cap takes the department's colour.
const SEG = SEGS.find(sg => !sg.v && sg.zi < 4),
  TEAM_DEPTS = new Map([['team', { color: DEPT_PAL[2] }]]),
  OWN_TEAM = ['team', 'team', 'team', 'team'],
  OWN_FREE = [null, null, null, null];
const drawSeg = () => NOW.s.host.drawSeg(NOW.s.G, SEG, NOW.own);
const GLASS = {
  id: 'office.glass-wall',
  cat: 'office',
  name: () => tr('assets.item.office.glass-wall'),
  tags: ['state'],
  when: { always: true },
  where: 'office',
  source: [{ file: 'web/office-draw-furniture.js', fn: 'drawSeg' }],
  axes: [
    axis('owner', () => tr('assets.axis.owner'), [
      { id: 'team', label: () => tr('assets.owner.team') },
      { id: 'free', label: () => tr('assets.owner.free') },
    ]),
    THEME_AXIS,
  ],
  uses: ['light'],
  draw(ctx, view, t) {
    const s = aim(ctx, view, t);
    s.host.depts = TEAM_DEPTS;
    NOW.own = view.pick.owner === 'free' ? OWN_FREE : OWN_TEAM;
    s.scene(SEG.x + 0.5, SEG.Y, 0, drawSeg);
  },
};
// The desk the office drew before the kit desk (still in the code, no longer called): who sits there, if anyone.
const DESK = DESKS[0];
const drawDesk = () => NOW.s.host.drawDesk(NOW.s.G, DESK, 0);
const OCCUPANTS = ['working', 'thinking', 'permission', 'error', 'done', 'idle'];
const SITTERS = {
  vacant: [],
  away: [{ desk: 0, seated: false, status: 'working', leaving: false, parent: null }],
  ...Object.fromEntries(
    OCCUPANTS.map(st => [st, [{ desk: 0, seated: true, status: st, leaving: false, parent: null }]]),
  ),
};
const STATUS = {
  working: () => tr('office.status.working'),
  thinking: () => tr('office.status.thinking'),
  permission: () => tr('office.status.permission'),
  error: () => tr('office.status.error'),
  done: () => tr('office.status.done'),
  idle: () => tr('office.status.idle'),
};
const OLD_DESK = {
  id: 'office.old-desk',
  cat: 'office',
  name: () => tr('assets.item.office.old-desk'),
  tags: ['animated', 'state'],
  catalogueOnly: true,
  when: { always: true },
  where: 'office',
  source: [{ file: 'web/office-draw-furniture.js', fn: 'drawDesk' }],
  axes: [
    axis('occupant', () => tr('assets.axis.occupant'), [
      { id: 'working', label: STATUS.working },
      { id: 'vacant', label: () => tr('assets.occupant.vacant') },
      { id: 'away', label: () => tr('assets.occupant.away') },
      ...OCCUPANTS.slice(1).map(st => ({ id: st, label: STATUS[st] })),
    ]),
    THEME_AXIS,
  ],
  uses: ['light'],
  draw(ctx, view, t) {
    const s = aim(ctx, view, t);
    s.host.agents = SITTERS[view.pick.occupant] || SITTERS.vacant;
    s.scene(DESK.gx + 1, DESK.gy + 1, 0, drawDesk);
  },
};

// ---- Christmas ----
// What the office puts on every desk during the event, someone at it or not, shown on a kit desk; and the wreath on
// every door: the EXIT's (big; the restroom's are the same size) or over a kennel's door (small). The palette is the
// decoration's own.
const DECOR = ['tree', 'stocking', 'tinsel'];
const DECOR_DESK = { screen: 'code', noMug: false, lit: 1 };
const own = draw => () => {
  const r = AssetsStage.recordingCtx();
  draw(r);
  return r.palette(8);
};
const DESK_DECOR = {
  id: 'office.desk-decor',
  cat: 'office',
  name: () => tr('assets.item.office.desk-decor'),
  tags: ['animated'],
  when: { event: { key: 'christmas', level: 1 } },
  where: 'office',
  source: [{ file: 'web/office-draw-xmas.js', fn: 'deskDecor' }],
  axes: [
    axis('kind', () => tr('assets.axis.kind'), [
      { id: 'tree', label: () => tr('assets.decor.tree') },
      { id: 'stocking', label: () => tr('assets.decor.stocking') },
      { id: 'tinsel', label: () => tr('assets.decor.tinsel') },
    ]),
  ],
  palette: view => own(r => deskDecor(r, Math.max(0, DECOR.indexOf(view.pick.kind)), 0, 0))(),
  draw(ctx, view, t) {
    const K = kitOf(ctx, view);
    F.desk(K, t, DECOR_DESK);
    // the kit desk stands on cell (0, 0): the spot is the game's, off a desk's cell
    const [x, y] = K.P(DECOR_SPOT[0], DECOR_SPOT[1], DECOR_SPOT[2]);
    deskDecor(ctx, Math.max(0, DECOR.indexOf(view.pick.kind)), Math.round(x), Math.round(y));
  },
};
const WREATH = {
  id: 'office.wreath',
  cat: 'office',
  name: () => tr('assets.item.office.wreath'),
  tags: ['animated'],
  when: { event: { key: 'christmas', level: 1 } },
  where: 'office',
  source: [{ file: 'web/office-draw-xmas.js', fn: 'wreath' }],
  axes: [
    axis('size', () => tr('assets.axis.size'), [
      { id: 'door', label: () => tr('assets.wreath.door') },
      { id: 'kennel', label: () => tr('assets.wreath.kennel') },
    ]),
  ],
  palette: view => own(r => wreath(r, 0, 0, view.pick.size === 'kennel'))(),
  draw(ctx, view, t) {
    if (view.pick.size === 'kennel') return wreath(ctx, view.ox, view.oy, true);
    const K = kitOf(ctx, view);
    F.door(K, t);
    // the kit stands where the game stands the door's (DOOR_KIT): the wreath's spot is the game's, off that cell
    const [x, y] = K.P(WREATH_SPOT[0] - DOOR_KIT[0], WREATH_SPOT[1] - DOOR_KIT[1], WREATH_SPOT[2]);
    wreath(ctx, Math.round(x), Math.round(y), false);
  },
};

export const OFFICE = [...KIT, BOARD, GLASS, OLD_DESK, DESK_DECOR, WREATH];
