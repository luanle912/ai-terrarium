// What people do with a free moment during the Christmas event, as logic (no DOM, no canvas;
// tests/event-idle.test.mjs): two spots on the front lawn to throw snowballs across, one to roll a snowball, a rink
// on the frozen lake and a place beside the big tree to set a present down. The spots join the office's idle spots
// (IDLE_SPOTS, web/office-scene.js); open() says which of them can be used right now, and the rest of this file is
// what moves there: the snowball in the air, the rolled snowball growing, the skater's round.
import { EventLogic } from './event-logic.js';

const ACTS = ['snowball', 'snowman', 'skate', 'gift'];
const THROW = 2.4,
  FLY = 0.9,
  ARC = 14,
  GROW = 20,
  REST = 4,
  LAP = 9,
  GAP = 4;
const key = (x, y) => x + ',' + y,
  cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

// Where the event's activities happen on an island:
//   pitch { a, b }   two lawn cells in one row GAP apart, on the front lawn (y >= H), off the paths, clear of the
//                    presents (drop) and of `avoid` (the elves' way), as near the middle of that lawn as can be
//   rink { cx, cy, rx, ry, t0 }   the largest round on the ice (iceSet) that keeps 3 tiles from the penguins (huddle)
//   spots            the idle spots, in a fixed order; one the island has no room for is left out
// People step onto the ice from the lawn cell nearest the rink (the skate spot's `tile`).
function layout({ roam, roamList, clear, iceSet, ice, drop, avoid = [], huddle, H }) {
  const lawn = roamList.filter(
      c =>
        c[1] >= H && !clear.has(key(c[0], c[1])) && !(drop && cheb(c, drop) <= 2) && avoid.every(r => cheb(c, r) >= 2),
    ),
    ok = new Set(lawn.map(c => key(c[0], c[1])));
  let mx = 0,
    my = 0;
  for (const c of lawn) {
    mx += c[0] / lawn.length;
    my += c[1] / lawn.length;
  }
  const far = (c, x, y) => Math.hypot(c[0] - x, c[1] - y);
  let pitch = null,
    best = Infinity;
  for (const c of lawn) {
    let free = true;
    for (let i = 1; i <= GAP && free; i++) free = roam.has(key(c[0] + i, c[1]));
    const d = far(c, mx - GAP / 2, my);
    if (free && ok.has(key(c[0] + GAP, c[1])) && d < best) {
      best = d;
      pitch = { a: c, b: [c[0] + GAP, c[1]] };
    }
  }
  let roll = null;
  best = Infinity;
  if (pitch)
    for (const c of lawn) {
      const d = far(c, mx, my);
      if (d < best && far(c, pitch.a[0], pitch.a[1]) >= 3 && far(c, pitch.b[0], pitch.b[1]) >= 3) {
        best = d;
        roll = c;
      }
    }
  let rink = null;
  const out = [0, 0],
    shore = (x, y) => roamList.reduce((m, c) => Math.min(m, far(c, x - 0.5, y - 0.5)), Infinity);
  // the widest round that fits: as deep as 0.6 of its width where the ice allows, else flat (0.3)
  for (let rx = 3; rx >= 1.5 && !rink; rx -= 0.5)
    for (let n = 0; n < (ice || []).length * 8 && !(rink && n >= (ice || []).length * 4); n++) {
      // round the middle of an ice cell, the middle of one of its edges, or its corner
      const c = ice[(n >> 2) % ice.length],
        r = {
          cx: c[0] + (n & 1 ? 0 : 0.5),
          cy: c[1] + (n & 2 ? 0 : 0.5),
          rx,
          ry: rx * (n < ice.length * 4 ? 0.6 : 0.3),
        };
      let fits = true;
      for (let i = 0; i < 16 && fits; i++) {
        skateAt(r, (i / 16) * LAP, out);
        fits =
          iceSet.has(key(Math.floor(out[0]), Math.floor(out[1]))) &&
          (huddle || []).every(h => Math.hypot(out[0] - h[0], out[1] - h[1]) >= 3);
      }
      // of those that fit, the one nearest the lawn: that is where people step on
      if (fits && (!rink || shore(r.cx, r.cy) < shore(rink.cx, rink.cy))) rink = r;
    }
  // The way on: the lawn cell nearest the round, and the round begins (t0) at its point nearest that cell.
  let entry = null;
  if (rink) {
    let best = Infinity;
    const round = { ...rink, t0: 0 };
    for (const c of roamList) {
      if (clear.has(key(c[0], c[1]))) continue;
      for (let i = 0; i < 32; i++) {
        skateAt(round, (i / 32) * LAP, out);
        const d = far(c, out[0] - 0.5, out[1] - 0.5);
        if (d < best) {
          best = d;
          entry = c;
          rink.t0 = (i / 32) * LAP;
        }
      }
    }
  }
  const spots = [],
    at = (c, more) => ({ tile: [c[0], c[1]], pt: [c[0] + 0.5, c[1] + 0.5], event: true, ...more });
  if (pitch) {
    spots.push(at(pitch.a, { act: 'snowball', side: 0, front: true }));
    spots.push(at(pitch.b, { act: 'snowball', side: 1, front: false }));
  }
  if (roll) spots.push(at(roll, { act: 'snowman', front: true }));
  if (rink && entry)
    spots.push({ act: 'skate', tile: [entry[0], entry[1]], pt: skateAt(rink, 0, [0, 0]), front: true, event: true });
  // beside the tree, on the pantry's side of the crossing
  const tx = Math.ceil(EventLogic.TREE_AT[0]);
  spots.push({ act: 'gift', tile: [tx, 7], pt: [tx + 0.3, 7.4], front: false, event: true });
  return { spots, pitch, rink };
}

// Whether a spot can be used under c = { level (0: no event), snow (depth 0..3), frozen, calm }. Spots that are not
// the event's are always fine.
function fine(spot, c) {
  if (!spot || !spot.event) return true;
  if (!c.level) return false;
  if (spot.act === 'snowball') return c.snow >= 2 && !c.calm;
  if (spot.act === 'snowman') return c.snow >= 2;
  if (spot.act === 'skate') return !!c.frozen && !c.calm;
  return c.level >= 2;
}
const open = (spots, free, c) => free.filter(i => fine(spots[i], c));
const stays = (spots, i, c) => i == null || fine(spots[i], c);

// The snowball at time t (seconds) while two people are at it: { u: 0 at side 0 .. 1 at side 1, h: px above their
// hands }, or null between throws. Each THROW seconds the other one throws. One object, used again.
const BALL = { u: 0, h: 0 };
function ball(t, both) {
  const n = Math.floor(t / THROW),
    v = (t - n * THROW) / FLY;
  if (!both || !(v >= 0 && v < 1)) return null;
  BALL.u = n % 2 ? 1 - v : v;
  BALL.h = ARC * 4 * v * (1 - v);
  return BALL;
}
// Which side throws at time t.
const thrower = t => (Math.floor(t / THROW) % 2 ? 1 : 0);
// The radius (px) of the snowball someone is rolling: 2 up to 7 over GROW seconds, a rest, then a new one.
function snowmanSize(t) {
  const p = t % (GROW + REST);
  return p >= 0 && p <= GROW ? 2 + (5 * p) / GROW : p > GROW ? (p < GROW + REST - 0.5 ? 7 : 2) : 2;
}
// Where on the rink a skater is at time t, in tiles, written into `out` (one lap takes LAP seconds).
function skateAt(rink, t, out) {
  const a = ((t + (rink.t0 || 0)) / LAP) * Math.PI * 2;
  out[0] = rink.cx + rink.rx * Math.cos(a);
  out[1] = rink.cy + rink.ry * Math.sin(a);
  return out;
}
// One step of someone skating: their own clock (a.skT, from 0 where they stepped on) moves on dt seconds and they
// are put on the rink.
const XY = [0, 0];
function skate(a, rink, dt) {
  a.skT = (a.skT || 0) + (dt > 0 ? dt : 0);
  skateAt(rink, a.skT, XY);
  a.x = XY[0];
  a.y = XY[1];
}
// When someone's goal changes: if they are out on the lake (skating, or on the step onto the ice), back to the lawn
// cell they came by, where a path can start; their skating clock starts over. `water` is the lake's cells.
function offRink(a, laid, water) {
  a.skT = 0;
  const s = laid.spots.find(sp => sp.act === 'skate');
  if (!s || !water.has(key(Math.floor(a.x), Math.floor(a.y)))) return;
  a.x = s.tile[0] + 0.5;
  a.y = s.tile[1] + 0.5;
}

export const EventIdle = {
  ACTS,
  THROW,
  FLY,
  GROW,
  LAP,
  GAP,
  layout,
  open,
  stays,
  ball,
  thrower,
  snowmanSize,
  skateAt,
  skate,
  offRink,
};
