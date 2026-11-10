import { EventLogic } from './event-logic.js';
import { OutfitLogic } from './outfit-logic.js';
// Christmas outfits on people (OutfitLogic says who wears what). Everything here draws with the scene's 1px rect R
// and colours the outfit already holds, so a frame makes no colour strings: a hat is at most 4 rects, a scarf 2.
const { RED, WHITE, GOLD, COAL } = OutfitLogic;
// The agent's outfit for the event as it stands (null outside it), worked out once and again when the event's level
// changes. A fate's or a faller's copy of the agent carries it along.
export function outfitOf(a, ev) {
  const k = EventLogic.cacheKey(ev);
  if (a.outfitK !== k) {
    a.outfitK = k;
    a.outfit = OutfitLogic.outfit(a.sid || a.id, ev, !!a.parent, a.shirt);
  }
  return a.outfit;
}
// The colour of the top: the outfit's, or the department's when there is none (or it is only a hat).
export const shirtOf = a => (a.outfit && a.outfit.top) || a.shirt;
export const XMAS = {
  // A hat over a head w px wide (6 standing, 8 at the desk) centred on sx, whose top row of hair is hy - 1.
  hatEvent(R, o, sx, hy, w = 6) {
    const x = sx - w / 2,
      c = o.hatColor,
      c2 = o.hatTrim;
    switch (o.hat) {
      case 'santa':
        R(x, hy - 3, w, 2, c);
        R(x + 2, hy - 5, w - 3, 2, c);
        R(x + w - 1, hy - 5, 2, 2, c2);
        R(x - 1, hy - 1, w + 2, 1, c2);
        break;
      case 'muffs':
        R(x, hy - 2, w, 1, c2);
        R(x - 2, hy + 1, 2, 3, c);
        R(x + w, hy + 1, 2, 3, c);
        break;
      case 'antlers':
        R(x, hy - 4, 1, 3, c);
        R(x + w - 1, hy - 4, 1, 3, c);
        R(x - 1, hy - 4, 1, 1, c);
        R(x + w, hy - 4, 1, 1, c);
        break;
      case 'beanie':
        R(x, hy - 3, w, 2, c);
        R(sx - 1, hy - 5, 2, 2, c2);
        R(x - 1, hy - 1, w + 2, 1, c2);
        break;
      case 'tophat':
        R(x, hy - 6, w, 4, c);
        R(x, hy - 2, w, 1, c2);
        R(x - 1, hy - 1, w + 2, 1, c);
        break;
      default:
        // the elf's pointed hat with its bell
        R(x, hy - 3, w, 2, c);
        R(x + 1, hy - 5, w - 2, 2, c);
        R(sx - 1, hy - 7, 2, 2, c2);
        R(x - 1, hy - 1, w + 2, 1, RED);
    }
  },
  // A scarf two rows deep at the neck (row ny) with one end hanging: in the department's colour, so the team still
  // shows over any outfit. The coat is already that colour, so it gets its white fur collar here instead.
  scarf(R, o, sx, ny, w = 6) {
    if (!o.scarf) return;
    const coat = o.kind === 'coat';
    R(sx - w / 2, ny, w, 2, coat ? o.trim : o.scarf);
    if (!coat) R(w === 8 ? sx - 3 : sx + 1, ny + 2, 2, 3, o.scarfD);
  },
  // What goes over the plain torso instead of the look's own top (sx-4..sx+3, rows by-11..by-5): the outfit's
  // pattern, on the front only. Returns the sleeve colour for the arms.
  top(R, o, sx, by, front) {
    const k = o.kind;
    if (k === 'sweater') {
      R(sx - 4, by - 9, 8, 1, o.trim);
      R(sx - 4, by - 7, 8, 1, o.hatColor);
    } else if (k === 'santa' || k === 'coat') R(sx - 4, by - 5, 8, 1, o.trim);
    else if (k === 'elf') R(sx - 4, by - 6, 8, 1, COAL);
    if (!front) return o.top;
    if (k === 'santa') R(sx - 1, by - 10, 2, 5, WHITE);
    else if (k === 'reindeer') R(sx - 2, by - 9, 4, 4, o.trim);
    else if (k === 'coat') R(sx, by - 9, 1, 4, o.scarfD);
    else if (k === 'snowman') {
      R(sx - 1, by - 9, 1, 1, COAL);
      R(sx - 1, by - 7, 1, 1, COAL);
    } else if (k === 'elf') R(sx - 1, by - 6, 2, 1, GOLD);
    return o.top;
  },
  // Asleep on the floor mat: the hat as one small box over the crown of the head (box is the scene's iso box).
  hatSleep(box, o, x, y) {
    box(x + 0.1, y + 0.5, 0.09, 0.24, 2.5, 7, o.hatColor);
  },
};
