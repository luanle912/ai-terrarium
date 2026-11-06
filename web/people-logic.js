// Who an agent is to look at: man or woman, skin, hair, clothes. Fixed per session id (sid), so reloading the page or
// another island showing the same session never changes anyone. No DOM, no canvas; tests/people-logic.test.mjs runs
// this block.
// FNV-1a, 32 bit: the same string gives the same number in every browser and in node.
function hash(s) {
  s = String(s);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
// One independent draw per trait: the sid salted with the trait's name. FNV's low bits follow the characters' low
// bits, so two salts of one sid would share their parity; the murmur3 finaliser stirs every bit in first.
const fmix = h => {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};
const roll = (sid, salt, n) => fmix(hash(salt + ':' + sid)) % n;
const take = (sid, salt, list) => list[roll(sid, salt, list.length)];
const genderOf = sid => (roll(sid, 'gender', 2) ? 'f' : 'm');
// Palettes. A colour listed twice comes up twice as often.
const SKIN = ['#f7dcc4', '#f2c9a0', '#e8b48a', '#d9a273', '#c68a5e', '#a86b45', '#8a5534', '#6b3f26'];
const HAIR = [
  '#1c1714',
  '#1c1714',
  '#3b2617',
  '#3b2617',
  '#5a3a22',
  '#5a3a22',
  '#7a4a2a',
  '#8a3b2a',
  '#b8612f',
  '#d9a441',
  '#c9b48a',
  '#9aa0a8',
  '#e8e2d6',
];
const PANTS = ['#2d3142', '#3b4a6b', '#4a3b2f', '#22303a', '#5a5f73', '#6b5a45', '#33333d'];
const SKIRT = ['#2d3142', '#3b4a6b', '#6b2d3f', '#4a5a3b', '#a0806a'];
const LAYER = ['#3a3f52', '#e8e2d6', '#8a6a4a', '#2f4a3a', '#5a4a6a'];
// Styles per gender (the drawing code in the main script knows each name).
const STYLE = {
  m: {
    hair: ['crop', 'side', 'quiff', 'buzz', 'curly', 'cap'],
    beard: [null, null, null, 'stubble', 'full', 'moustache'],
    top: ['tee', 'shirt', 'hoodie', 'jacket'],
    acc: [null, null, null, null, null, null, 'glasses', 'glasses', 'headset'],
    shoes: ['#141414', '#141414', '#4a2f1f'],
  },
  f: {
    hair: ['long', 'wavy', 'bob', 'ponytail', 'bun'],
    beard: [null],
    top: ['blouse', 'tee', 'cardigan', 'dress'],
    acc: [null, null, null, null, 'glasses', 'headset', 'earrings', 'earrings'],
    shoes: ['#141414', '#7a2d3a', '#4a2f1f'],
  },
};
const LAYERED = new Set(['jacket', 'cardigan']);
// The whole look of one session. `shirt` (the department colour) is not part of it: it stays the team's colour.
function look(sid) {
  sid = String(sid);
  const g = genderOf(sid),
    S = STYLE[g],
    top = take(sid, 'top', S.top);
  const bottom = g === 'm' ? 'pants' : top === 'dress' || roll(sid, 'bottom', 3) < 2 ? 'skirt' : 'pants';
  return {
    gender: g,
    skin: take(sid, 'skin', SKIN),
    hair: take(sid, 'hair', HAIR),
    hairStyle: take(sid, 'hairStyle', S.hair),
    beard: take(sid, 'beard', S.beard),
    top,
    layer: LAYERED.has(top) ? take(sid, 'layer', LAYER) : null,
    bottom,
    legs: bottom === 'pants' ? take(sid, 'pants', PANTS) : top === 'dress' ? null : take(sid, 'skirt', SKIRT),
    shoes: take(sid, 'shoes', S.shoes),
    acc: take(sid, 'acc', S.acc),
  };
}
export const PeopleLogic = { hash, genderOf, look, SKIN, HAIR, PANTS, SKIRT, LAYER, STYLE };
