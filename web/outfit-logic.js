import { PeopleLogic } from './people-logic.js';
// Who wears what at Christmas. Fixed per session id like the look (PeopleLogic), so a person keeps one outfit for the
// whole event and every machine shows the same one. No DOM, no canvas; tests/outfit-logic.test.mjs runs this block.
const RED = '#c8323a',
  GREEN = '#2f7d4f',
  WHITE = '#f4f1e8',
  ELF = '#2f8f4e',
  GOLD = '#ffd166',
  COAL = '#1d2029',
  FALLBACK = '#5b8def';
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
// ev is EventLogic.active()'s answer (null outside the event). Level 1 is a Santa hat only; from level 2 the whole
// outfit, with a scarf in the department's colour so the team still shows. A sub-agent is always an elf: the pointed
// hat replaces its gold band.
function outfit(sid, ev, isSub, deptColor) {
  if (!ev) return null;
  if (isSub)
    return {
      kind: 'elf',
      top: ELF,
      trim: RED,
      hat: 'elf',
      hatColor: ELF,
      hatTrim: GOLD,
      scarf: RED,
      scarfD: tone(RED, -30),
    };
  if (ev.level <= 1) return { kind: 'hat', hat: 'santa', hatColor: RED, hatTrim: WHITE };
  const dept = isHex(deptColor) ? deptColor.toLowerCase() : FALLBACK,
    kind = KINDS[roll(sid, 'outfit', KINDS.length)];
  return { kind, ...MAKE[kind](dept, roll(sid, 'outfit-alt', 2) === 1), scarf: dept, scarfD: tone(dept, -30) };
}
export const OutfitLogic = { KINDS, HATS, RED, WHITE, GOLD, COAL, outfit, tone };
