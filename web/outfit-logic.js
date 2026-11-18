import { PeopleLogic } from './people-logic.js';
import { Paint } from './paint.js';
// Who wears what at Christmas. Fixed per session id like the look (PeopleLogic), so a person keeps one outfit for the
// whole event and every machine shows the same one. No DOM, no canvas; tests/outfit-logic.test.mjs runs this block.
const RED = '#c8323a',
  GREEN = '#2f7d4f',
  WHITE = '#f4f1e8',
  GOLD = '#ffd166',
  COAL = '#1d2029',
  FALLBACK = '#5b8def';
// The elf's costume, one palette for a sub-agent at Christmas and the critter elf (web/critter-sprites.js), so the
// two are visibly the same elf: green coat (and its shade), red trim and scarf, a dark belt with a gold buckle, a
// gold bell.
const ELF = Object.freeze({
  coat: '#2f8f4e',
  coatD: '#1f6b3a',
  trim: RED,
  trimD: '#96242b',
  belt: COAL,
  buckle: GOLD,
  bell: GOLD,
});
const KINDS = ['santa', 'sweater', 'reindeer', 'coat', 'snowman'];
const HATS = ['santa', 'muffs', 'antlers', 'beanie', 'tophat', 'elf'];
const isHex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
// A hex colour moved toward black (p < 0) or white (p > 0) by p of 255.
function tone(hex, p) {
  const n = parseInt(hex.slice(1), 16),
    c = v => Math.max(0, Math.min(255, v + p));
  return '#' + ((1 << 24) + (c(n >> 16) << 16) + (c((n >> 8) & 255) << 8) + c(n & 255)).toString(16).slice(1);
}
// The murmur3 finaliser over the salted sid, as PeopleLogic does for each trait: independent of the look's draws.
function roll(sid, salt, n) {
  let h = PeopleLogic.hash(salt + ':' + sid);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) % n;
}
// Each outfit: the top's colour, its trim, and the hat. `hatTrim` is the hat's second colour (brim, band, bobble).
const MAKE = {
  santa: () => ({ top: RED, trim: WHITE, hat: 'santa', hatColor: RED, hatTrim: WHITE }),
  sweater: (dept, alt) => ({
    top: alt ? RED : GREEN,
    trim: WHITE,
    hat: 'muffs',
    hatColor: alt ? WHITE : RED,
    hatTrim: '#3b4252',
  }),
  reindeer: () => ({ top: '#8a5a3a', trim: '#ead9b8', hat: 'antlers', hatColor: '#b9834f', hatTrim: '#b9834f' }),
  coat: dept => ({ top: dept, trim: WHITE, hat: 'beanie', hatColor: tone(dept, -25), hatTrim: WHITE }),
  snowman: () => ({ top: '#eef2f6', trim: COAL, hat: 'tophat', hatColor: '#2a2e3a', hatTrim: RED }),
};
// look is the Look (web/theme.js), or null. Under its 'xmas' outfit.agent a main agent wears the whole outfit from the
// event's first day (no hat-only tier, D1), with a scarf in the department's colour so the team still shows. Under
// the 'elf' outfit.subagent a sub-agent is an elf: the pointed hat replaces its gold band. 'team' is everyday clothes.
// Each variant of outfit.agent and outfit.subagent is a painter that dresses one person: (sid, deptColor) -> the
// outfit, or null for everyday clothes. Run once per person and look change (web/office-people-xmas.js outfitOf),
// not every frame.
const team = () => null;
const elf = () => ({
  kind: 'elf',
  top: ELF.coat,
  trim: ELF.trim,
  hat: 'elf',
  hatColor: ELF.coat,
  hatTrim: ELF.bell,
  scarf: ELF.trim,
  scarfD: ELF.trimD,
});
function xmas(sid, deptColor) {
  const dept = isHex(deptColor) ? deptColor.toLowerCase() : FALLBACK,
    kind = KINDS[roll(sid, 'outfit', KINDS.length)];
  return { kind, ...MAKE[kind](dept, roll(sid, 'outfit-alt', 2) === 1), scarf: dept, scarfD: tone(dept, -30) };
}
Paint.variant('outfit.agent', 'team', team);
Paint.variant('outfit.agent', 'xmas', xmas);
Paint.variant('outfit.subagent', 'team', team);
Paint.variant('outfit.subagent', 'elf', elf);
function outfit(sid, look, isSub, deptColor) {
  const label = isSub ? 'outfit.subagent' : 'outfit.agent';
  return Paint.painter(label, look ? look.of(label) : 'team')(sid, deptColor);
}
export const OutfitLogic = { KINDS, HATS, RED, WHITE, GOLD, COAL, ELF, outfit, tone };
