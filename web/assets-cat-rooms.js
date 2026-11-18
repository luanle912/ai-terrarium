// The /assets catalogue: the rooms. The restroom block and the smoking corner are each one pass of an office method
// (restroomItems, smokingItems) at a fixed spot of the scene, so each is a scene card: the method runs on the
// stage's stand-in host with the scene moved onto the card, its pieces sorted by depth as the office sorts them.
// Empty, or in use: in the restroom two stalls shut with their red light on and someone washing their hands at a
// running tap; in the smoking corner three smokers on the bench and by the ash bin.
import { tr } from './i18n.js';
import { AssetsStage } from './assets-stage.js';
import { PeopleLogic } from './people-logic.js';
import { PropUse } from './prop-use.js';
import { DEPT_PAL, IDLE_SPOTS, SMOKE, WC } from './office-scene.js';
import { STRINGS } from './office-draw-xmas.js';
import { Paint } from './paint.js';

const STATE = {
  id: 'state',
  label: () => tr('assets.axis.use'),
  values: [
    { id: 'empty', label: () => tr('assets.room.empty') },
    { id: 'busy', label: () => tr('assets.room.busy') },
  ],
};
// An agent's department colour (the drawing code reads the top through shirtOf).
const DEPT = 'shirt';
// Someone at a spot of the scene, looking as the session id makes them look (PeopleLogic.look).
function someone(id, spot, more) {
  const look = PeopleLogic.look('assets-room-' + id);
  return {
    id,
    sid: 'assets-room-' + id,
    x: spot.pt[0],
    y: spot.pt[1],
    status: 'idle',
    actNow: spot.act || null,
    seated: false,
    moving: false,
    sleeping: false,
    dirFront: !!spot.front,
    stool: spot.stool || 0,
    skin: look.skin,
    acc: look.acc,
    [DEPT]: DEPT_PAL[id % DEPT_PAL.length],
    parent: null,
    look,
    ...more,
  };
}
const NOBODY = [];
const byDepth = (p, q) => p.z - q.z;
// The draw under way (read by the fixed functions handed to the stage's scene(), so a card makes no closures).
const NOW = { s: null, view: null, people: NOBODY, overlays: null };
// Each person's piece among the room's, made once: drawn by the office's drawPerson on the stage under way.
const pieceOf = a => ({ z: a.x + a.y, f: () => NOW.s.host.drawPerson(NOW.s.G, a) });
// The office's way: the method has pushed its pieces, the people go in among them, then everything by depth.
const ITEMS = [];
function paint() {
  for (const a of NOW.people) ITEMS.push(a.piece);
  ITEMS.sort(byDepth);
  for (let i = 0; i < ITEMS.length; i++) ITEMS[i].f();
}

// ---- the restroom ----
const STALL_SPOT = k => IDLE_SPOTS.findIndex(sp => sp.act === 'wc' && sp.stall === k);
// two stalls taken (inside, so not drawn), and one person at the women's first basin with the tap running
const INSIDE = [0, 3].map((k, i) =>
  someone(10 + i, IDLE_SPOTS[STALL_SPOT(k)], { wcIn: true, idleSpot: STALL_SPOT(k) }),
);
const WASH_SPOT = WC.spots.find(sp => sp.room === 'f').wash;
const WASHER = someone(12, { ...WASH_SPOT, act: 'wc', front: false });
const BUSY_WC = [...INSIDE, WASHER],
  SHOWN_WC = [WASHER];
WASHER.piece = pieceOf(WASHER);
const TAP = new Float32Array(PropUse.DARK.length);
TAP[PropUse.ID[WASH_SPOT.prop]] = 1;
const WC_MID = [(WC.x0 + WC.x1) / 2, (WC.y0 + WC.y1) / 2];
function restroom() {
  const { s, view } = NOW;
  ITEMS.length = 0;
  s.host.restroomItems(s.G, ITEMS, view.env.snow);
  paint();
}
const RESTROOM = {
  id: 'rooms.restroom',
  labels: ['floor.wc', 'wall.inner', 'door'],
  cat: 'rooms',
  name: () => tr('assets.item.rooms.restroom'),
  tags: ['animated', 'state'],
  when: { always: true },
  where: 'restroom',
  source: [
    { file: 'web/office-draw-restroom.js', fn: 'restroomItems' },
    { file: 'web/restroom-logic.js', fn: 'RestroomLogic.layout' },
  ],
  axes: [STATE],
  uses: ['light', 'snow', 'event'],
  draw(ctx, view, t) {
    const s = (NOW.s = AssetsStage.stage(ctx, view, t)),
      busy = view.pick.state === 'busy';
    NOW.view = view;
    NOW.people = busy ? SHOWN_WC : NOBODY;
    // (the stage hands the next draw a clean host: nothing to put back)
    s.host.agents = busy ? BUSY_WC : NOBODY;
    s.host.propLit = busy ? TAP : null;
    s.scene(WC_MID[0], WC_MID[1], 0, restroom);
  },
};

// ---- the smoking corner ----
const SMOKERS = [SMOKE.spots[1], SMOKE.spots[3], SMOKE.spots[4]].map((sp, i) => someone(20 + i, sp));
for (const a of SMOKERS) a.piece = pieceOf(a);
const SMOKE_MID = [SMOKE.x + 2, SMOKE.y + 1.5];
// What the look strings under the pergola's beam, among the corner's pieces as the office's xmasItems puts it (one
// piece per string, made once; it reads the look of the draw under way).
const PERGOLA = STRINGS.filter(st => st.label === 'pergola').map(st => ({
  z: st.z,
  f: () => {
    for (const f of NOW.overlays) f(NOW.s.host, NOW.s.G, st.inst, st);
  },
}));
function smoking() {
  const { s, view } = NOW;
  ITEMS.length = 0;
  s.host.smokingItems(s.G, ITEMS, view.env.snow);
  NOW.overlays = Paint.overlaysOf('pergola', s.G.look);
  if (NOW.overlays.length) for (const it of PERGOLA) ITEMS.push(it);
  paint();
}
const SMOKING = {
  id: 'rooms.smoking',
  label: 'pergola',
  cat: 'rooms',
  name: () => tr('assets.item.rooms.smoking'),
  tags: ['animated', 'state'],
  when: { always: true },
  where: 'smoking',
  source: [
    { file: 'web/office-draw-smoking.js', fn: 'smokingItems' },
    { file: 'web/smoke-logic.js', fn: 'SmokeLogic.layout' },
    { file: 'web/office-draw-xmas.js', fn: 'xmasItems' },
  ],
  axes: [STATE],
  uses: ['light', 'snow', 'event'],
  draw(ctx, view, t) {
    const s = (NOW.s = AssetsStage.stage(ctx, view, t));
    NOW.view = view;
    NOW.people = view.pick.state === 'busy' ? SMOKERS : NOBODY;
    s.scene(SMOKE_MID[0], SMOKE_MID[1], 0, smoking, true);
  },
};

export const ROOMS = [RESTROOM, SMOKING];
