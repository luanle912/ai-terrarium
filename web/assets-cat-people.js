// The /assets catalogue: people. One person with every way the game can show them as axes (gender, hair, top,
// department colour, skin, beard, accessory, status, pose, what they do on a break, the Christmas outfit and hat),
// drawn by the office's own drawPerson on the stage's stand-in host; a sub-agent (gold crown, or an elf at
// Christmas); the ways out of the island (FateLogic.FATES: the EXIT door fall and the twenty scenes); and the marks
// a status puts over a head. A person has far too many axes to cross, so the entry sweeps them one at a time
// (`sweep`, web/assets-logic.js).
import { tr } from './i18n.js';
import { AssetsStage } from './assets-stage.js';
import { PeopleLogic } from './people-logic.js';
import { OutfitLogic } from './outfit-logic.js';
import { Theme } from './theme.js';
import { FateLogic } from './fate-logic.js';
import { OfficeDecor } from './office-decor.js';
import { DEPT_PAL, DESKS, IDLE_SPOTS, P, PA } from './office-scene.js';
import { SCENES } from './office-draw-fate.js';
import { SIZE as FALL_SIZE } from './office-draw-fall.js';

const { axis, valueIndex, xmasEvent } = AssetsStage;
const val = (id, label, more) => ({ id, label, ...more });
// Where a person stands for the catalogue: a cell of the office floor (indoors, so no breath in the cold).
// Fishing happens on the lake's bank, where the line reaches the water (web/office-draw-people.js drawRod).
const FISH = IDLE_SPOTS.find(sp => sp.act === 'fish').pt;
const SPOT = [3.5, 3.5],
  DESK = DESKS[0],
  SEAT = [DESK.gx + 1, DESK.gy + 1.45];
// Runs fn(x, y) with the canvas moved so the scene point (x, y px) where a person standing at (ax, ay) has their feet
// lands on (ox, oy). fn is a fixed function (it reads what it draws from NOW), so a card makes no closure per frame.
function atFeet(ctx, view, ax, ay, fn) {
  const [sx, sy] = PA(ax, ay);
  ctx.save();
  ctx.translate(view.ox - Math.round(sx), view.oy - Math.round(sy));
  try {
    fn(Math.round(sx), Math.round(sy));
  } finally {
    ctx.restore();
  }
}
// The draw under way: its stage, canvas, clock and who is drawn (read by the fixed functions handed out below).
const NOW = { s: null, ctx: null, t: 0, who: null, kind: '', dur: 1 };
const aim = (ctx, view, t) => {
  NOW.ctx = ctx;
  NOW.t = t;
  return (NOW.s = AssetsStage.stage(ctx, view, t));
};
const drawWho = () => NOW.s.host.drawPerson(NOW.s.G, NOW.who);
// The Christmas look the outfits are made under (the whole outfit from the event's first day, D1), and the event
// object (as EventLogic.active gives it) the Christmas acts are drawn under.
const XMAS_LOOK = Theme.resolve({
  season: 'winter',
  holiday: null,
  event: { key: 'christmas', since: 0 },
  key: 'assets|christmas',
});
const XMAS_EV = xmasEvent(2);

// ---- the axes of a person ----
const STYLE = PeopleLogic.STYLE;
const GENDER = axis('gender', () => tr('assets.axis.gender'), [
  val('m', () => tr('assets.gender.m')),
  val('f', () => tr('assets.gender.f')),
]);
const AUTO = () => tr('assets.person.auto');
const HAIR_LABEL = {
  crop: () => tr('assets.hair.crop'),
  side: () => tr('assets.hair.side'),
  quiff: () => tr('assets.hair.quiff'),
  buzz: () => tr('assets.hair.buzz'),
  curly: () => tr('assets.hair.curly'),
  cap: () => tr('assets.hair.cap'),
  long: () => tr('assets.hair.long'),
  wavy: () => tr('assets.hair.wavy'),
  bob: () => tr('assets.hair.bob'),
  ponytail: () => tr('assets.hair.ponytail'),
  bun: () => tr('assets.hair.bun'),
};
const TOP_LABEL = {
  tee: () => tr('assets.top.tee'),
  shirt: () => tr('assets.top.collared'),
  hoodie: () => tr('assets.top.hoodie'),
  jacket: () => tr('assets.top.jacket'),
  blouse: () => tr('assets.top.blouse'),
  cardigan: () => tr('assets.top.cardigan'),
  dress: () => tr('assets.top.dress'),
};
const uniq = k => [...new Set([...STYLE.m[k], ...STYLE.f[k]].filter(Boolean))];
// 'auto' is the gender's own first style; any style can go with either gender (the drawing code allows it).
const HAIR = axis('hair', () => tr('assets.axis.hair'), [
  val('auto', AUTO),
  ...uniq('hair').map(k => val(k, HAIR_LABEL[k])),
]);
const TOP = axis('top', () => tr('assets.axis.top'), [
  val('auto', AUTO),
  ...uniq('top').map(k => val(k, TOP_LABEL[k])),
]);
// An agent's department colour (the drawing code reads the top through shirtOf; only the catalogue sets it here).
const DEPT = 'shirt';
const SHIRT = axis(
  'colour',
  () => tr('assets.axis.colour'),
  DEPT_PAL.map((c, i) => val('team-' + (i + 1), () => tr('assets.team', { n: i + 1 }), { swatch: c })),
);
const SKIN = axis(
  'skin',
  () => tr('assets.axis.skin'),
  PeopleLogic.SKIN.map((c, i) => val('skin-' + (i + 1), () => tr('assets.skin', { n: i + 1 }), { swatch: c })),
);
const NONE = () => tr('assets.none');
const BEARD = axis('beard', () => tr('assets.axis.beard'), [
  val('none', NONE),
  val('stubble', () => tr('assets.beard.stubble')),
  val('full', () => tr('assets.beard.full')),
  val('moustache', () => tr('assets.beard.moustache')),
]);
const ACC = axis('acc', () => tr('assets.axis.acc'), [
  val('none', NONE),
  val('glasses', () => tr('assets.acc.glasses')),
  val('headset', () => tr('assets.acc.headset')),
  val('earrings', () => tr('assets.acc.earrings')),
]);
const STATUS_LABEL = {
  working: () => tr('office.status.working'),
  thinking: () => tr('office.status.thinking'),
  talking: () => tr('office.status.talking'),
  waiting: () => tr('office.status.waiting'),
  permission: () => tr('office.status.permission'),
  error: () => tr('office.status.error'),
  idle: () => tr('office.status.idle'),
  done: () => tr('office.status.done'),
  entering: () => tr('office.status.entering'),
  leaving: () => tr('office.status.leaving'),
};
const STATUS = axis(
  'status',
  () => tr('assets.axis.status'),
  Object.keys(STATUS_LABEL).map(k => val(k, STATUS_LABEL[k])),
);
const POSE = axis('pose', () => tr('assets.axis.pose'), [
  val('front', () => tr('assets.pose.front')),
  val('back', () => tr('assets.pose.back')),
  val('walk', () => tr('assets.pose.walk')),
  val('seated', () => tr('assets.pose.seated')),
  val('stool', () => tr('assets.pose.stool')),
  val('asleep', () => tr('assets.pose.asleep')),
]);
const ACT_LABEL = {
  table: () => tr('office.act.table'),
  meal: () => tr('office.act.meal'),
  arcade: () => tr('office.act.arcade'),
  foosball: () => tr('office.act.foosball'),
  coffee: () => tr('office.act.coffee'),
  fridge: () => tr('office.act.fridge'),
  water: () => tr('office.act.water'),
  microwave: () => tr('office.act.microwave'),
  snack: () => tr('office.act.snack'),
  smoke: () => tr('office.act.smoke'),
  wc: () => tr('office.act.wc'),
  phone: () => tr('office.act.phone'),
  stretch: () => tr('office.act.stretch'),
  bath: () => tr('office.act.bath'),
  bench: () => tr('office.act.bench'),
  fish: () => tr('office.act.fish'),
  snowball: () => tr('office.act.snowball'),
  snowman: () => tr('office.act.snowman'),
  skate: () => tr('office.act.skate'),
  gift: () => tr('office.act.gift'),
  cocoa: () => tr('office.act.cocoa'),
};
const ACT = axis('act', () => tr('assets.axis.act'), [
  val('none', NONE),
  ...Object.keys(ACT_LABEL).map(k => val(k, ACT_LABEL[k])),
]);
// The Christmas event's own acts: drawn by xmasArms only while the event is on (cocoa is the coffee then).
const XMAS_ACTS = new Set(['snowball', 'snowman', 'skate', 'gift', 'cocoa']);
const OUTFIT = axis('outfit', () => tr('assets.axis.outfit'), [
  val('none', NONE),
  val('santa', () => tr('assets.outfit.santa')),
  val('sweater', () => tr('assets.outfit.sweater')),
  val('sweater-alt', () => tr('assets.outfit.sweater-alt')),
  val('reindeer', () => tr('assets.outfit.reindeer')),
  val('coat', () => tr('assets.outfit.coat')),
  val('snowman', () => tr('assets.outfit.snowman')),
  val('elf', () => tr('assets.outfit.elf')),
]);
const HAT = axis('hat', () => tr('assets.axis.hat'), [
  val('outfit', () => tr('assets.hat.outfit')),
  val('santa', () => tr('assets.hat.santa')),
  val('muffs', () => tr('assets.hat.muffs')),
  val('antlers', () => tr('assets.hat.antlers')),
  val('beanie', () => tr('assets.hat.beanie')),
  val('tophat', () => tr('assets.hat.tophat')),
  val('elf', () => tr('assets.hat.elf')),
]);

// ---- the outfits, from OutfitLogic itself ----
// OutfitLogic picks the outfit by session id: find an id that rolls each kind (and the sweater's other colourway).
const OUTFIT_SID = {};
for (let i = 0; i < 400 && Object.keys(OUTFIT_SID).length < 6; i++) {
  const sid = 'assets-' + i,
    o = OutfitLogic.outfit(sid, XMAS_LOOK, false, DEPT_PAL[0]),
    k = o.kind === 'sweater' && o.top === OutfitLogic.RED ? 'sweater-alt' : o.kind;
  if (!OUTFIT_SID[k]) OUTFIT_SID[k] = sid;
}
const OUTFITS = OUTFIT.values.map(v => v.id),
  HATS = HAT.values.map(v => v.id);
const outfitBase = (kind, dept) =>
  kind === 'elf'
    ? OutfitLogic.outfit('assets', XMAS_LOOK, true, dept)
    : OutfitLogic.outfit(OUTFIT_SID[kind], XMAS_LOOK, false, dept);
// Each hat with the colours of the outfit that wears it.
const HAT_COLOURS = {};
for (const k of OUTFITS.slice(1)) {
  const o = outfitBase(k, DEPT_PAL[0]);
  if (!HAT_COLOURS[o.hat]) HAT_COLOURS[o.hat] = o;
}
// One outfit object per (outfit, department, hat), made the first time it is drawn and kept.
const OUTFIT_CACHE = [];
function outfitOf(oi, di, hi) {
  const at = (oi * DEPT_PAL.length + di) * HATS.length + hi;
  let o = OUTFIT_CACHE[at];
  if (o) return o;
  o = outfitBase(OUTFITS[oi], DEPT_PAL[di]);
  if (hi > 0) {
    const hat = HATS[hi],
      c = HAT_COLOURS[hat];
    o = { ...o, hat, hatColor: c.hatColor, hatTrim: c.hatTrim };
  }
  return (OUTFIT_CACHE[at] = o);
}

// ---- the person ----
const index = valueIndex;
// One person and one look, filled in place for each draw (the drawing code caches on them, as on a live agent).
const LOOK0 = PeopleLogic.look('assets');
const A = {
  x: SPOT[0],
  y: SPOT[1],
  id: 1,
  sid: 'assets',
  status: 'working',
  tool: ['Edit', 'app.js'],
  seated: false,
  moving: false,
  sleeping: false,
  dirFront: true,
  actNow: null,
  stool: 0,
  desk: 0,
  idleSpot: null,
  skin: LOOK0.skin,
  hair: '#3b2617',
  [DEPT]: DEPT_PAL[0],
  acc: null,
  parent: null,
  look: { ...LOOK0, hair: '#3b2617' },
};
const set = (o, k, v) => {
  if (o[k] === v) return false;
  o[k] = v;
  return true;
};
// What goes with each top is PeopleLogic's rule (clothes), in fixed colours: a woman in a skirt, a man in trousers.
const COLOUR = { layer: 0, pants: 0, skirt: 2 },
  fixedColour = (salt, list) => list[COLOUR[salt]],
  CLOTHES = { layer: null, bottom: 'pants', legs: null };
function dress(pick) {
  const L = A.look,
    g = pick.gender === 'f' ? 'f' : 'm',
    hair = !pick.hair || pick.hair === 'auto' ? STYLE[g].hair[0] : pick.hair,
    top = !pick.top || pick.top === 'auto' ? STYLE[g].top[0] : pick.top,
    w = PeopleLogic.clothes(CLOTHES, g, top, true, fixedColour),
    skin = PeopleLogic.SKIN[index(SKIN, pick.skin)],
    acc = pick.acc && pick.acc !== 'none' ? pick.acc : null;
  let changed = set(L, 'gender', g);
  changed = set(L, 'hairStyle', hair) || changed;
  changed = set(L, 'top', top) || changed;
  changed = set(L, 'layer', w.layer) || changed;
  changed = set(L, 'bottom', w.bottom) || changed;
  changed = set(L, 'legs', w.legs) || changed;
  changed = set(L, 'beard', pick.beard && pick.beard !== 'none' ? pick.beard : null) || changed;
  changed = set(L, 'acc', acc) || changed;
  changed = set(L, 'skin', skin) || changed;
  if (changed) L.bare = null; // the hat-safe copy web/office-people-xmas.js keeps on a look
  A.skin = skin;
  A.acc = acc;
  A[DEPT] = DEPT_PAL[index(SHIRT, pick.colour)];
}
// Where and how the person stands for a pose; an act is a break (status idle, standing or on a stool).
function place(pick) {
  const act = pick.act && pick.act !== 'none' ? pick.act : null;
  let pose = pick.pose || 'front';
  if (act && (pose === 'seated' || pose === 'asleep' || pose === 'walk')) pose = 'front';
  A.status = act ? 'idle' : pick.status || 'working';
  A.actNow = act === 'cocoa' ? 'coffee' : act;
  A.seated = pose === 'seated';
  A.sleeping = pose === 'asleep';
  A.moving = pose === 'walk';
  A.dirFront = pose !== 'back';
  A.stool = pose === 'stool' ? 1 : 0;
  [A.x, A.y] = A.seated ? SEAT : act === 'fish' ? FISH : SPOT;
  return pose;
}
// The outfit and the event it needs: the Christmas acts happen only during the event, so they bring an outfit (the
// first, Santa's; there is no hat-only tier, D1). The outfit is pinned on the person (outfitPin, as a fate's snapshot
// is), so the page's look does not change what the axes picked.
function wear(pick, G) {
  let oi = index(OUTFIT, pick.outfit);
  const hi = index(HAT, pick.hat);
  if (!oi && (hi || XMAS_ACTS.has(pick.act))) oi = 1;
  A.outfitPin = true;
  A.outfit = oi ? outfitOf(oi, index(SHIRT, pick.colour), hi) : null;
  G.ev = oi ? XMAS_EV : null;
}
// At the desk, as the office draws it: the desk, the chair, the person and the backrest over them.
function atDesk() {
  for (const it of OfficeDecor.deskWorkstation(NOW.ctx, P, DESK, A, NOW.t, drawWho, 1)) it.f();
}
function drawA(ctx, view, t) {
  const s = aim(ctx, view, t),
    G = s.G,
    ev = G.ev,
    pick = view.pick;
  dress(pick);
  const pose = place(pick);
  wear(pick, G);
  NOW.who = A;
  try {
    if (pose === 'seated') s.scene(SEAT[0], SEAT[1], 0, atDesk);
    else if (pose === 'asleep') s.scene(SEAT[0], SEAT[1], 0, drawWho);
    else atFeet(ctx, view, A.x, A.y, drawWho);
  } finally {
    G.ev = ev;
  }
}
const PERSON = {
  id: 'people.person',
  cat: 'people',
  name: () => tr('assets.item.people.person'),
  tags: ['animated', 'state'],
  when: { always: true },
  where: 'office',
  source: [
    { file: 'web/office-draw-people.js', fn: 'drawPerson' },
    { file: 'web/office-people.js', fn: 'PERSON' },
    { file: 'web/office-people-xmas.js', fn: 'XMAS' },
    { file: 'web/office-draw-idle-xmas.js', fn: 'xmasArms' },
    { file: 'web/people-logic.js', fn: 'PeopleLogic.look' },
    { file: 'web/outfit-logic.js', fn: 'OutfitLogic.outfit' },
  ],
  axes: [GENDER, HAIR, TOP, SHIRT, SKIN, BEARD, ACC, STATUS, POSE, ACT, OUTFIT, HAT],
  // the grid shows what a person is doing and wearing; the looks are picked with the buttons
  sweep: ['status', 'pose', 'act', 'outfit'],
  uses: ['light'],
  draw: drawA,
};

// ---- a sub-agent ----
const SUB = {
  ...A,
  id: 2,
  sid: 'assets-sub',
  parent: 'assets',
  status: 'working',
  look: { ...PeopleLogic.look('assets-sub'), hair: '#3b2617' },
  [DEPT]: DEPT_PAL[3],
  outfit: null,
};
SUB.skin = SUB.look.skin;
SUB.acc = SUB.look.acc;
const SUB_POSE = axis('pose', () => tr('assets.axis.pose'), POSE.values.slice(0, 3));
const SUB_AGENT = {
  id: 'people.sub-agent',
  cat: 'people',
  name: () => tr('assets.item.people.sub-agent'),
  tags: ['animated'],
  when: { always: true },
  where: 'office',
  source: [
    { file: 'web/office-draw-people.js', fn: 'drawPerson' },
    { file: 'web/outfit-logic.js', fn: 'OutfitLogic.outfit' },
  ],
  axes: [
    SUB_POSE,
    axis(
      'status',
      () => tr('assets.axis.status'),
      ['working', 'waiting', 'done'].map(k => val(k, STATUS_LABEL[k])),
    ),
  ],
  uses: ['light', 'event'],
  draw(ctx, view, t) {
    const pose = view.pick.pose || 'front';
    aim(ctx, view, t);
    SUB.moving = pose === 'walk';
    SUB.dirFront = pose !== 'back';
    SUB.status = view.pick.status || 'working';
    NOW.who = SUB;
    atFeet(ctx, view, SUB.x, SUB.y, drawWho);
  },
};

// ---- the ways out of the island ----
const FATE_LABEL = {
  exit: () => tr('assets.fate.exit'),
  lightning: () => tr('assets.fate.lightning'),
  wind: () => tr('assets.fate.wind'),
  freeze: () => tr('assets.fate.freeze'),
  lake: () => tr('assets.fate.lake'),
  fish: () => tr('assets.fate.fish'),
  duck: () => tr('assets.fate.duck'),
  snowball: () => tr('assets.fate.snowball'),
  bird: () => tr('assets.fate.bird'),
  ufo: () => tr('assets.fate.ufo'),
  balloon: () => tr('assets.fate.balloon'),
  rocket: () => tr('assets.fate.rocket'),
  melt: () => tr('assets.fate.melt'),
  hole: () => tr('assets.fate.hole'),
  banana: () => tr('assets.fate.banana'),
  dust: () => tr('assets.fate.dust'),
  ghost: () => tr('assets.fate.ghost'),
  sleigh: () => tr('assets.fate.sleigh'),
  wrapped: () => tr('assets.fate.wrapped'),
  skateoff: () => tr('assets.fate.skateoff'),
  chimney: () => tr('assets.fate.chimney'),
};
// Who leaves: a person as startFate keeps them (standing still, not seated, no act).
const WHO = { ...A, id: 3, sid: 'assets-who', look: PeopleLogic.look('assets-who'), outfit: null, [DEPT]: DEPT_PAL[2] };
WHO.skin = WHO.look.skin;
WHO.acc = WHO.look.acc;
const FATE = { kind: 'exit', seed: 3, who: WHO };
// The EXIT door's faller, as the office's startFall records them, once per outfit variant of the look (their
// Christmas outfit, the same as every other pose): recorded on a host of its own that answers the stage host's look,
// so the stage host keeps no fallers.
const FALLERS = new Map();
function fallerOf(host) {
  const v = host.look.of('outfit.agent');
  if (FALLERS.has(v)) return FALLERS.get(v);
  const rec = Object.create(host);
  rec.fallers = null;
  rec.startFall({ ...WHO, outfit: null, outfitV: undefined }, 0);
  FALLERS.set(v, rec.fallers[0]);
  return rec.fallers[0];
}
// One of the twenty scenes, clipped round the person (x, y px: their feet).
function fateScene(x, y) {
  const ctx = NOW.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - CROP.left, y - CROP.up, CROP.w, CROP.h);
  ctx.clip();
  try {
    SCENES[NOW.kind](NOW.s.host, NOW.s.G, FATE, NOW.t % NOW.dur, x, y);
  } finally {
    ctx.restore();
  }
}
// A scene can reach far (a bolt from the sky, a rocket): the card shows the part round the person.
const CROP = { left: 64, up: 112, w: 128, h: 126 };
const FATES = {
  id: 'people.fate',
  cat: 'people',
  name: () => tr('assets.item.people.fate'),
  tags: ['animated'],
  when: { always: true },
  where: 'lawn',
  source: [
    { file: 'web/fate-logic.js', fn: 'FATES' },
    { file: 'web/office-draw-fate.js', fn: 'SCENES' },
    { file: 'web/office-draw-fate-more.js', fn: 'SCENES' },
    { file: 'web/office-draw-fate-xmas.js', fn: 'SCENES' },
    { file: 'web/office-draw-fall.js', fn: 'drawFaller' },
  ],
  axes: [
    axis(
      'fate',
      () => tr('assets.axis.fate'),
      FateLogic.KINDS.map(k => val(k, FATE_LABEL[k])),
    ),
  ],
  uses: ['light', 'event'],
  draw(ctx, view, t) {
    const s = aim(ctx, view, t),
      kind = view.pick.fate || 'exit';
    if (kind === 'exit' || !SCENES[kind])
      return s.host.drawFaller(ctx, fallerOf(s.host), view.ox, view.oy, FALL_SIZE, t);
    FATE.kind = NOW.kind = kind;
    NOW.dur = FateLogic.FATES[kind].dur;
    atFeet(ctx, view, WHO.x, WHO.y, fateScene);
  },
};

// ---- the marks over a head ----
// What drawPerson puts over a person for their status (an icon, the thinking cloud, Zs, confetti), shown with the
// head they float over: the rest of the body is cut away.
const BUBBLE_STATUS = ['thinking', 'permission', 'error', 'done', 'idle', 'waiting', 'talking'];
const MARK = { ...A, id: 4, sid: 'assets-mark', look: PeopleLogic.look('assets-mark'), outfit: null, actNow: null };
MARK.skin = MARK.look.skin;
MARK.acc = MARK.look.acc;
const BUBBLE = {
  id: 'people.status-bubble',
  cat: 'people',
  name: () => tr('assets.item.people.status-bubble'),
  tags: ['animated'],
  when: { always: true },
  where: 'office',
  source: [
    { file: 'web/office-draw-people.js', fn: 'drawPerson' },
    { file: 'web/office-util.js', fn: 'ICON' },
  ],
  axes: [
    axis(
      'status',
      () => tr('assets.axis.status'),
      BUBBLE_STATUS.map(k => val(k, STATUS_LABEL[k])),
    ),
    axis('pose', () => tr('assets.axis.pose'), [POSE.values[0], POSE.values[3]]),
  ],
  // at Christmas the hat lifts the marks
  uses: ['light', 'event'],
  draw(ctx, view, t) {
    const s = AssetsStage.stage(ctx, view, t),
      seated = view.pick.pose === 'seated';
    MARK.status = view.pick.status || 'thinking';
    MARK.seated = seated;
    [MARK.x, MARK.y] = seated ? SEAT : SPOT;
    // the feet (standing) or the seat (at the desk) on (ox, oy); everything below the chin cut away
    const [sx, sy] = seated ? P(MARK.x, MARK.y, 11.5) : PA(MARK.x, MARK.y),
      x = Math.round(sx),
      y = Math.round(sy);
    ctx.save();
    ctx.translate(view.ox - x, view.oy - y);
    ctx.beginPath();
    ctx.rect(x - 30, y - 70, 60, seated ? 56 : 58);
    ctx.clip();
    try {
      s.host.drawPerson(s.G, MARK);
    } finally {
      ctx.restore();
    }
  },
};

export const PEOPLE = [PERSON, SUB_AGENT, FATES, BUBBLE];
