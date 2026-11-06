// The restroom block against the pantry's east side: an open-top (cutaway) annex on the office floor with the men's
// room, the women's room and a shared lobby, plus the rhythm of one visit. No DOM, no canvas;
// tests/restroom-logic.test.mjs runs this block.
const k = (x, y) => x + ',' + y;
// Laid out from the corner of the outdoor spot 'east-back' (SkyLogic.outdoorSpots, 6×7 tiles from x = W, y = 0). One
// tile is about 0.7 m (a desk is 2×1 tiles) and `wall` is the office's full wall height (3 tiles). The back wall runs on
// the office's own back-wall line (inner face y = 0, BACK thick behind it), so the block continues the pantry without a
// step. Left to right: the men's room (3 tiles) and the women's room (3 tiles), five rows deep; the front two rows are the
// lobby, open to the pantry on the west.
function layout(zone, wall) {
  const X = zone.x,
    Y = zone.y,
    x1 = X + zone.w,
    y1 = Y + zone.h,
    front = Y + 5,
    BACK = 0.35,
    T = 0.07;
  // The back wall is a full office wall; the front wall (with the two doors) and the east wall are 70 % of it, so a
  // little of the inside shows over them; the walls between rooms stand above a person (about 25 px); stall panels hide
  // whoever is inside once the door shuts. Doors leave a strip of wall (a lintel) under the top of the front wall.
  const heights = { full: wall, outer: Math.round(wall * 0.7), room: 32, stall: 28, stallFoot: 3, door: 31 };
  // Accents muted to sit with the office palette (dusty blue / dusty pink).
  const rooms = {
    m: { x0: X, x1: X + 3, door: [X + 1, X + 2], accent: '#7989c3' },
    f: { x0: X + 3, x1, door: [X + 4, X + 5], accent: '#c37993' },
  };
  const walls = {
    pantry: { x: X, t: 0.14 },
    split: { x: X + 3 - T, t: 2 * T },
    east: { x: x1 - 0.12, t: 0.12, y0: Y - BACK, y1: front + T },
    front: { y: front - T, t: 2 * T },
  };
  // Swing doors in the front wall's two openings, hinged on their west jamb.
  const doors = ['m', 'f'].map(r => ({ room: r, x0: rooms[r].door[0], x1: rooms[r].door[1], y: front }));
  const stall = (room, x0, x1) => ({ room, x0, x1, y0: Y, y1: Y + 1.35 });
  const fw = (X + 5.88 - (X + 3 + T)) / 3,
    f0 = X + 3 + T;
  const stalls = [
    stall('m', X + 1.08, X + 2),
    stall('m', X + 2, X + 3 - T),
    stall('f', f0, f0 + fw),
    stall('f', f0 + fw, f0 + 2 * fw),
    stall('f', f0 + 2 * fw, X + 5.88),
  ];
  const vanity = (room, x0, y0, y1, basins, dryer) => ({ room, x0, x1: x0 + 0.56, y0, y1, basins, dryer });
  const vanities = {
    m: vanity('m', X + 0.14, Y + 3.15, Y + 4.75, [Y + 3.55, Y + 4.35], null),
    f: vanity('f', X + 3 + T, Y + 2.95, Y + 4.55, [Y + 3.35, Y + 4.15], Y + 4.75),
  };
  // urinals hang on the pantry wall (it is the one wall of the men's room that faces the camera), with solid screens
  const urinals = [Y + 1.75, Y + 2.5],
    screens = [Y + 2.12, Y + 2.88];
  const makeup = { x0: X + 3 + T, x1: X + 3.55, y0: Y + 1.95, y1: Y + 2.6, stool: [X + 3.82, Y + 2.28] };
  const plants = { m: [X + 0.4, Y + 0.4], f: [X + 5.55, Y + 4.55], lobby: [X + 5.55, Y + 5.55] };
  const dryerM = [X + 0.85, Y],
    bin = [X + 2.75, Y + 4.7];
  const lobby = {
    totem: [X + 0.25, Y + 6.75],
    sanitizer: [X + 2.2, Y + 5.25],
    bench: { x0: X + 2.45, x1: X + 3.85, y0: Y + 5.1, y1: Y + 5.45 },
    label: [X + 0.75, Y + 6.25],
  };
  // Tiles: the 6×7 floor, minus what furniture stands on. The doorways are tiles (X+1, front-1) and (X+4, front-1).
  const floor = [];
  for (let y = Y; y < y1; y++) for (let x = X; x < x1; x++) floor.push(k(x, y));
  const taken = new Set(
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [2, 4],
      [3, 0],
      [4, 0],
      [5, 0],
      [3, 2],
      [3, 3],
      [3, 4],
      [5, 4],
      [2, 5],
      [3, 5],
      [5, 5],
      [0, 6],
    ].map(([dx, dy]) => k(X + dx, Y + dy)),
  );
  const walk = floor.filter(c => !taken.has(c));
  // Walls as blocked steps (both ways): the room walls at x = X (the pantry side) and x = X+3 along the rooms, and the
  // front wall along y = front except at the two doorways. The back and east sides need none: nobody steps
  // from the floor onto the lawn at all (see step()).
  const shut = [],
    cut = (a, b) => shut.push(a + '|' + b, b + '|' + a);
  for (let y = Y; y < front; y++) {
    cut(k(X - 1, y), k(X, y));
    cut(k(X + 2, y), k(X + 3, y));
  }
  for (let x = X; x < x1; x++) if (x !== rooms.m.door[0] && x !== rooms.f.door[0]) cut(k(x, front - 1), k(x, front));
  // One idle spot per stall: standing in front of its door; afterwards the hands are washed at the room's vanity.
  const wash = (room, i) => {
    const v = vanities[room],
      y = v.basins[i % 2],
      x = v.x1 + 0.45;
    return { tile: [Math.floor(x), Math.floor(y)], pt: [x, y] };
  };
  const spots = stalls.map((s, i) => {
    const n = stalls.filter((o, j) => j < i && o.room === s.room).length,
      cx = (s.x0 + s.x1) / 2;
    return {
      act: 'wc',
      room: s.room,
      stall: i,
      tile: [Math.floor(cx), Y + 1],
      pt: [cx, Y + 1.63],
      front: false,
      wash: wash(s.room, n),
    };
  });
  return {
    x0: X,
    y0: Y,
    x1,
    y1,
    front,
    back: BACK,
    wy: Y,
    heights,
    rooms,
    walls,
    doors,
    stalls,
    vanities,
    urinals,
    screens,
    makeup,
    plants,
    dryerM,
    bin,
    lobby,
    floor,
    floorSet: new Set(floor),
    walk,
    shut,
    spots,
  };
}
// Is a point (world tiles) on the block's raised floor?
const onFloor = (L, x, y) => x >= L.x0 && x < L.x1 && y >= L.y0 && y < L.y1;
// One step between neighbouring tiles a and b, when either is on the block's floor: false across a wall or between the
// floor and the lawn, true otherwise (floor to floor, or floor to the pantry beside it). null when neither tile is on
// the block, so the caller's own rules apply. `inOffice(x,y)` says whether a tile is office floor.
function step(L, a, b, inOffice) {
  const ka = k(a[0], a[1]),
    kb = k(b[0], b[1]),
    fa = L.floorSet.has(ka),
    fb = L.floorSet.has(kb);
  if (!fa && !fb) return null;
  if (L.shut.includes(ka + '|' + kb)) return false;
  if (fa && fb) return true;
  const o = fa ? b : a;
  return inOffice(o[0], o[1]);
}
// How each swing door hangs, from where people stand: 0 shut; +1 pushed open toward the lobby (someone coming out);
// -1 pushed open into the room (someone going in). A door swings while anyone is in its doorway (within the opening and
// less than DOORWAY tiles from the wall), away from the first such person. Cheap: one pass over the people per frame.
const DOORWAY = 0.75;
const doorSwing = (L, people) =>
  L.doors.map(d => {
    for (const p of people) if (p.x > d.x0 && p.x < d.x1 && Math.abs(p.y - d.y) < DOORWAY) return p.y < d.y ? 1 : -1;
    return 0;
  });
// Which room an agent uses: men to WC NAM ('m'), women to WC NỮ ('f'). An agent without a gender (or a bare id, as
// before genders) goes by its id: odd to the men's room, even to the women's.
const roomOf = who => {
  if (who && typeof who === 'object') {
    if (who.gender === 'm' || who.gender === 'f') return who.gender;
    who = who.id;
  }
  return who % 2 ? 'm' : 'f';
};
// An idle agent's next spot, from `free` (indices into `spots` nobody holds). About one choice in four (SHARE) is a
// free stall in the agent's own room; otherwise, or when its stalls are all taken, one of the other free spots.
// A stall is held by one person for the whole visit, so a room never has more people than stalls and nobody queues.
// `room` null (just been) means no stall at all; null back when nothing is free. `rand` is Math.random or a seeded one.
const SHARE = 0.25;
function pickIdle(spots, free, room, rand, share = SHARE) {
  const wc = room ? free.filter(i => spots[i].act === 'wc' && spots[i].room === room) : [],
    rest = free.filter(i => spots[i].act !== 'wc');
  const pool = wc.length && (!rest.length || rand() < share) ? wc : rest;
  return pool.length ? pool[Math.floor(rand() * pool.length)] : null;
}
// One visit, in simulated seconds spent standing (walking does not count): a moment at the stall door while it opens,
// a while inside with the door shut, a moment coming back out, washing hands at the vanity, then on to somewhere else.
const DOOR = 0.8,
  INSIDE = 6,
  OUT = 0.6,
  WASH = 2.5,
  VISIT = DOOR + INSIDE + OUT + WASH;
const visit = t =>
  t < DOOR ? 'door' : t < DOOR + INSIDE ? 'inside' : t < DOOR + INSIDE + OUT ? 'out' : t < VISIT ? 'wash' : 'done';
export const RestroomLogic = {
  layout,
  onFloor,
  step,
  doorSwing,
  DOORWAY,
  roomOf,
  pickIdle,
  SHARE,
  visit,
  VISIT,
  DOOR,
  INSIDE,
  OUT,
  WASH,
};
