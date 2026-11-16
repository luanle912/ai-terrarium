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
import './office-draw-restroom.js';
import './office-draw-smoking.js';
import './office-draw-people.js';

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
// The office's way: the method pushes its pieces (and people go in among them), then everything by depth.
const ITEMS = [];
function paint(s, people, fill) {
  ITEMS.length = 0;
  fill(ITEMS);
  for (const a of people) ITEMS.push({ z: a.x + a.y, f: () => s.host.drawPerson(s.G, a) });
  ITEMS.sort(byDepth).forEach(it => it.f());
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
const TAP = new Float32Array(PropUse.DARK.length);
TAP[PropUse.ID[WASH_SPOT.prop]] = 1;
const WC_MID = [(WC.x0 + WC.x1) / 2, (WC.y0 + WC.y1) / 2];
const RESTROOM = {
  id: 'rooms.restroom',
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
    const s = AssetsStage.stage(ctx, view, t),
      host = s.host,
      busy = view.pick.state === 'busy',
      { agents, propLit } = host;
    host.agents = busy ? BUSY_WC : NOBODY;
    host.propLit = busy ? TAP : null;
    try {
      s.scene(WC_MID[0], WC_MID[1], 0, () =>
        paint(s, busy ? SHOWN_WC : NOBODY, items => host.restroomItems(s.G, items, view.env.snow)),
      );
    } finally {
      host.agents = agents;
      host.propLit = propLit;
    }
  },
};

// ---- the smoking corner ----
const SMOKERS = [SMOKE.spots[1], SMOKE.spots[3], SMOKE.spots[4]].map((sp, i) => someone(20 + i, sp));
const SMOKE_MID = [SMOKE.x + 2, SMOKE.y + 1.5];
const SMOKING = {
  id: 'rooms.smoking',
  cat: 'rooms',
  name: () => tr('assets.item.rooms.smoking'),
  tags: ['animated', 'state'],
  when: { always: true },
  where: 'smoking',
  source: [
    { file: 'web/office-draw-smoking.js', fn: 'smokingItems' },
    { file: 'web/smoke-logic.js', fn: 'SmokeLogic.layout' },
  ],
  axes: [STATE],
  uses: ['light', 'snow', 'event'],
  draw(ctx, view, t) {
    const s = AssetsStage.stage(ctx, view, t),
      busy = view.pick.state === 'busy';
    s.scene(
      SMOKE_MID[0],
      SMOKE_MID[1],
      0,
      () => paint(s, busy ? SMOKERS : NOBODY, items => s.host.smokingItems(s.G, items, view.env.snow)),
      true,
    );
  },
};

export const ROOMS = [RESTROOM, SMOKING];
