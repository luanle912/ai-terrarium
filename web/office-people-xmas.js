import { OutfitLogic } from './outfit-logic.js';
// Christmas outfits on people (OutfitLogic says who wears what). Everything here draws with the scene's 1px rect R
// and colours the outfit already holds, so a frame makes no colour strings: a hat is at most 4 rects, a scarf 2.
const { RED, WHITE, COAL, ELF } = OutfitLogic,
  BREATH = '#b9c9dc',
  BREATH_FAR = '#cfdbe8';
// The agent's outfit under look (the Look, web/theme.js; null outside the event), worked out once and again when the
// look's outfit variant changes, or the agent turns out to be a sub-agent, or changes department. A snapshot for a
// leaving scene (outfitPin, startFate) keeps the outfit it was taken with whatever the look does next. Compared
// field by field: this runs for every person every frame and must not build a key.
export function outfitOf(a, look) {
  if (a.outfitPin) return a.outfit;
  const sub = !!a.parent,
    v = look ? look.of(sub ? 'outfit.subagent' : 'outfit.agent') : '';
  if (a.outfitV !== v || a.outfitSub !== sub || a.outfitDept !== a.shirt) {
    a.outfitV = v;
    a.outfitSub = sub;
    a.outfitDept = a.shirt;
    a.outfit = OutfitLogic.outfit(a.sid || a.id, look, sub, a.shirt);
  }
  return a.outfit;
}
// Breath in the cold for person `id` at time t (seconds): 0 none, 1 a puff just out, 2 the puff drifting off. Under
// a second of it every three, each person in their own time.
export function breathAt(t, id) {
  const p = (t + id * 1.13) % 3;
  return p >= 0 && p < 0.45 ? 1 : p >= 0.45 && p < 0.9 ? 2 : 0;
}
// The look to draw the hair with under outfit o: a baseball cap would stick out under a hat that covers the head,
// so there it gives way to plain cropped hair (a copy made once and kept on the look).
const COVERS = { santa: true, beanie: true, tophat: true, elf: true };
export function lookUnder(L, o) {
  if (!o || L.hairStyle !== 'cap' || !COVERS[o.hat]) return L;
  return L.bare || (L.bare = { ...L, hairStyle: 'crop' });
}
// The colour of the top: the outfit's, or the department's when there is none.
export const shirtOf = a => (a.outfit && a.outfit.top) || a.shirt;
export const XMAS = {
  // The puff (breathAt's 1 or 2) in front of a face seen from the front: two pixels by the mouth, then higher up.
  breath(R, k, sx, hy) {
    if (!k) return;
    R(sx + 3 + k, hy + 4 - (k - 1) * 2, 1, 1, BREATH);
    R(sx + 5 + k, hy + 3 - (k - 1) * 2, 1, 1, BREATH_FAR);
  },
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
        R(x - 1, hy - 2, w + 2, 1, c2);
        R(x - 2, hy - 1, 2, 4, c);
        R(x + w, hy - 1, 2, 4, c);
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
  // shows over any outfit. The coat is already that colour, so it gets its white fur collar here instead. Seen from
  // behind it is drawn after the hair, or long hair would hide it.
  scarf(R, o, sx, ny, w = 6) {
    if (!o.scarf) return;
    const coat = o.kind === 'coat';
    R(sx - w / 2, ny, w, 2, coat ? o.trim : o.scarf);
    if (!coat) R(w === 8 ? sx - 3 : sx + 1, ny + 2, 2, 3, o.scarfD);
  },
  // What goes over the plain torso instead of the look's own top (sx-4..sx+3, rows by-11..by-5): the outfit's
  // pattern, on the front only. Returns the sleeve colour for the arms.
  top(R, o, sx, by, front) {
    XMAS.pattern(R, o, sx - 4, by - 11, 8, 7, front);
    return o.top;
  },
  // The outfit's pattern on a torso box w x h px from (x0, y0), in every pose: standing 8 x 7 (top), at the desk seen
  // from behind, the shoulders out of the bath, a faller. Rows are counted from the top of the box and a row under it
  // is left out, so a short box (the bath) shows what fits. The front (santa's fur, the belly, the buttons, the elf's
  // buckle) only from the front.
  pattern(R, o, x0, y0, w, h, front) {
    const k = o.kind,
      cx = x0 + w / 2,
      row = (r, c) => r < h && R(x0, y0 + r, w, 1, c);
    if (k === 'sweater') {
      row(2, o.trim);
      row(4, o.hatColor);
    } else if (k === 'santa' || k === 'coat') row(h - 1, o.trim);
    else if (k === 'elf') row(4, ELF.belt);
    if (!front) return;
    if (k === 'santa') R(cx - 1, y0 + 1, 2, h - 2, WHITE);
    else if (k === 'reindeer' && h > 3) R(cx - 2, y0 + 2, 4, h - 3, o.trim);
    else if (k === 'coat' && h > 3) R(cx, y0 + 2, 1, h - 3, o.scarfD);
    else if (k === 'snowman') {
      R(cx - 1, y0 + 2, 1, 1, COAL);
      if (h > 4) R(cx - 1, y0 + 4, 1, 1, COAL);
    } else if (k === 'elf' && h > 4) R(cx - 1, y0 + 4, 2, 1, ELF.buckle);
  },
  // Asleep on the floor mat, lying along x with the head at the pillow (box is the scene's iso box; br the breath):
  // the hat as one small box over the crown (hatSleep, drawn with the head), then over the top (sleep) the scarf at
  // the neck and the pattern as a thin box on the chest above the blanket. White earmuffs would vanish on the pillow,
  // so they show in the sweater's colour.
  hatSleep(box, o, x, y) {
    box(x + 0.1, y + 0.5, 0.09, 0.24, 2.5, 7, o.hat === 'muffs' ? o.top : o.hatColor);
  },
  sleep(box, o, x, y, br) {
    const k = o.kind,
      z = 4.5 + br,
      chest = (dx, dy, w, d, c) => box(x + dx, y + dy, w, d, 0.5, z + 0.4, c);
    box(x + 0.4, y + 0.44, 0.06, 0.36, 0.5, z + 0.6, k === 'coat' ? o.trim : o.scarf);
    if (k === 'sweater') chest(0.52, 0.44, 0.04, 0.36, o.trim);
    else if (k === 'santa') chest(0.46, 0.58, 0.14, 0.08, WHITE);
    else if (k === 'reindeer') chest(0.48, 0.54, 0.12, 0.16, o.trim);
    else if (k === 'coat') chest(0.46, 0.61, 0.14, 0.02, o.scarfD);
    else if (k === 'snowman') {
      chest(0.5, 0.6, 0.03, 0.04, COAL);
      chest(0.56, 0.6, 0.03, 0.04, COAL);
    } else if (k === 'elf') {
      chest(0.54, 0.44, 0.04, 0.36, ELF.belt);
      chest(0.54, 0.59, 0.04, 0.06, ELF.buckle);
    }
  },
  // The elf's costume (OutfitLogic.ELF): the sub-agent's outfit and the critter elf (web/critter-sprites.js) read it.
  elf: ELF,
};
