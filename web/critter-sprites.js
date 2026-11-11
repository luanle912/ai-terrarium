// Pixel sprites for the Christmas event's critters (reindeer, elves, penguins, Santa, his sleigh, the presents it
// drops) and for winter's polar bears, all drawn facing right; the page mirrors them to face left. Same form as
// web/dog-sprites.js: each letter is a palette colour ('.' is empty), the bottom row is where the feet touch the
// ground and `ax` is the column under the critter's middle. Pure data (tests/critter-sprites.test.mjs).
import { OutfitLogic } from './outfit-logic.js';

const { RED, WHITE, GOLD } = OutfitLogic,
  GREEN = '#2f8f4e',
  DARK = '#2a1c14';

// The reindeer's head and neck over its back, then its trunk; the legs are what changes between frames.
const DEER_HEAD = [
  '...........a.a..a.',
  '...........aa.aaa.',
  '............a.a...',
  '............ebb...',
  '............bbbbb.',
  '............bkbbbn',
  '............bbbbb.',
  '...........bbll...',
];
const DEER_BODY = [
  '.wbbbbbbbbbbbl....',
  'wbbbbbbbbbbbbl....',
  '.bbbbbbbbbbbbl....',
  '.BbbbbbbbbbbB.....',
  '.BllllllllllB.....',
];
const DEER_LEGS = {
  stand: ['.Bb.B....bB.......', '.B..b....b.B......', '.k..k....k.k......'],
  walk1: ['.Bb..B..bB........', 'B....b..b..B......', 'k....k..k...k.....'],
  walk2: ['..BB.....bb.......', '..Bb.....Bb.......', '..kk.....kk.......'],
};
const deer = legs => [...DEER_HEAD, ...DEER_BODY, ...DEER_LEGS[legs]];

const KINDS = {
  reindeer: {
    ax: 7,
    pal: { b: '#8a5a3a', B: '#6b4226', l: '#c9a27a', a: '#d9c7a0', e: '#a8744c', k: DARK, w: WHITE, n: '#5a3a26' },
    frames: {
      stand: deer('stand'),
      walk1: deer('walk1'),
      walk2: deer('walk2'),
      // head up and turned a little, ears pricked: it has noticed something
      look: [
        '............a.a..a.',
        '............aa.aaa.',
        '.............a.a...',
        '............eebb...',
        '.............bbbbb.',
        '.............bkbbbn',
        '.............bbbbb.',
        '............bbll...',
        '...........bbbl....',
        ...DEER_BODY.slice(1),
        ...DEER_LEGS.stand,
      ],
      // head down in the grass
      graze: [
        '.wbbbbbbbbbbb.......',
        'wbbbbbbbbbbbbbb.....',
        '.bbbbbbbbbbbbbbb.a.a',
        '.BbbbbbbbbbbBlbbbaa.',
        '.BllllllllllB.lbbba.',
        '.Bb.B....bB....bbbb.',
        '.B..b....b.B...bkbb.',
        '.k..k....k.k....bbn.',
      ],
    },
  },
  elf: {
    ax: 3,
    pal: { g: GREEN, G: '#1f6b3a', r: RED, R: '#96242b', s: '#f0c8a0', k: DARK, y: GOLD, w: WHITE },
    frames: {
      walk1: [
        '..y....',
        '..gg...',
        '.gggg..',
        '.rrrrr.',
        'sssks..',
        '.ssss..',
        '.gggg..',
        '.ggggs.',
        '.Gyyg..',
        '.gggg..',
        '.g..g..',
        'kk..kk.',
      ],
      walk2: [
        '..y....',
        '..gg...',
        '.gggg..',
        '.rrrrr.',
        'sssks..',
        '.ssss..',
        '.gggg..',
        'sgggg..',
        '.Gyyg..',
        '.gggg..',
        '..gg...',
        '..kkk..',
      ],
      carry1: [
        '..y.......',
        '..gg......',
        '.gggg.....',
        '.rrrrr....',
        'sssks.....',
        '.ssss.yy..',
        '.gggg.ry..',
        '.ggggsryrr',
        '.GyygsyyyR',
        '.gggg.ryrR',
        '.g..g.....',
        'kk..kk....',
      ],
      carry2: [
        '..y.......',
        '..gg......',
        '.gggg.....',
        '.rrrrr....',
        'sssks.yy..',
        '.ssss.ry..',
        '.ggggsryrr',
        '.ggggsyyyR',
        '.Gyyg.ryrR',
        '.gggg.....',
        '..gg......',
        '..kkk.....',
      ],
      // bent over, setting the present down
      place: [
        '...y......',
        '...gg.....',
        '..gggg....',
        '..rrrrr...',
        '.sssks....',
        '..ssss.yy.',
        '.ggggs.ry.',
        '.gggggsryr',
        '.Gyyg.yyyR',
        '.g..g.ryrR',
        'kk..kk....',
      ],
      // sat down hard, legs out, the present dropped in front
      slip: [
        '..y.......',
        '..gg......',
        '.gggg.....',
        '.rrrrr....',
        'sssks.....',
        '.ssss.....',
        '.gggg.....',
        'sgggg..y..',
        '.Gyyg.kry.',
        '.gggggkyyy',
        '.GggggkryR',
      ],
    },
  },
  penguin: {
    ax: 3,
    pal: { k: '#23283a', K: '#151927', w: WHITE, o: '#f5a524', e: '#0b0d14', s: '#d6dbe4' },
    frames: {
      stand: ['..kkk..', '.kkkwk.', '.kkwewo', '.kkwww.', 'Kkkwww.', 'Kkkwws.', '.Kkwws.', '..oo.o.'],
      waddle1: ['.kkk...', 'kkkwk..', 'kkwewo.', '.kkwww.', 'Kkkwww.', 'Kkkwws.', '.Kkwws.', '.oo..o.'],
      waddle2: ['...kkk.', '..kkkwk', '..kkwew', '.kkwwwo', 'Kkkwww.', 'Kkkwws.', '.Kkwws.', '..o.oo.'],
      // on its belly across the ice
      slide: { ax: 5, rows: ['..kkkkkkk...', 'okkkkkkkkwe.', 'oKkwwwwwwwwo', '..sssssss...'] },
    },
  },
  santa: {
    ax: 5,
    pal: { r: RED, R: '#96242b', w: WHITE, W: '#d8d2c2', s: '#f0c8a0', k: DARK, y: GOLD, b: '#8a5a3a', B: '#6b4226' },
    frames: {
      // sitting on his sack
      sit: [
        '..w.........',
        '.wrr........',
        '..rrrr......',
        '..rrrrr.....',
        '..wwwwww....',
        '..ssskss....',
        '..wwssww....',
        '..wwwwww....',
        '.rrwwwwrr...',
        'rrrrwwrrrs..',
        'rrkkyykkr...',
        'bRrrrrrrrrr.',
        'bbRwwwwwwrkk',
        'bbbbbb..wwk.',
        'Bbbbbb..kkk.',
      ],
      wave: [
        '..w.......s.',
        '.wrr......w.',
        '..rrrr....r.',
        '..rrrrr..rr.',
        '..wwwwww.rr.',
        '..ssskssrr..',
        '..wwsswwr...',
        '..wwwwww....',
        '.rrwwwwrr...',
        'rrrrwwrrr...',
        'rrkkyykkr...',
        'bRrrrrrrrrr.',
        'bbRwwwwwwrkk',
        'bbbbbb..wwk.',
        'Bbbbbb..kkk.',
      ],
    },
  },
  sleigh: {
    ax: 22,
    pal: {
      r: RED,
      R: '#96242b',
      w: WHITE,
      s: '#f0c8a0',
      y: GOLD,
      k: DARK,
      b: '#8a5a3a',
      B: '#6b4226',
      a: '#d9c7a0',
      n: '#ff4d4d',
      g: GREEN,
      t: '#c9a27a',
    },
    frames: {
      fly: [
        '.........................a.a.........a.a....',
        '....w.....................aa..........aa....',
        '...wrr....................bbb.........bbb...',
        '....rrr.g.................bkbb........bkbn..',
        '....www.gy...............bb..........bb.....',
        '....sks.ggg.......bbbbbbbb....bbbbbbbb......',
        '.y..wwwggyg.....tbbbbbbbb...tbbbbbbbb.......',
        '.yr.rwwrggg...tt.BbbbbbbB.tt.BbbbbbbB.......',
        'yrrrrrrrrrrrtt..b..B..b..b..b..B..b..b......',
        'yrRRRRRRRRRr...b...b...b..b.b...b...b..b....',
        '.rrrrrrrrrr.................................',
        '..k......k..................................',
        'yyyyyyyyyyyyy...............................',
      ],
    },
  },
  parcel: {
    ax: 4,
    pal: { r: RED, R: '#96242b', w: WHITE, W: '#d8d2c2', y: GOLD, k: '#5a6478' },
    frames: {
      chute: [
        '..wrwrw..',
        '.rwrwrwr.',
        'wrwrwrwrw',
        'k.k.k.k.k',
        '.k.k.k.k.',
        '..k...k..',
        '...k.k...',
        '..rryrr..',
        '..yyyyy..',
        '..rryrR..',
        '..rryrR..',
      ],
      box: ['..yy.y...', '.rryrr...', '.yyyyy...', '.rryrR...', '.rryrR...'],
    },
  },
};
// The polar bears by the igloo (web/polar-bears.js): there all winter, not only for Christmas. The mother is the
// biggest thing on the lawn; her cub is half her size. Their back legs are drawn first, then the front ones.
const FUR = { w: '#f4f2ea', W: '#cfd3dc', s: '#a9b0bf', k: '#1d2029' };
const BEAR_TOP = [
  '....wwwwwwwwww........',
  '..wwwwwwwwwwwwww..w...',
  '.wwwwwwwwwwwwwwwwwwww.',
  'wwwwwwwwwwwwwwwwwwkwww',
  'wwwwwwwwwwwwwwwwwwwwwk',
  'WwwwwwwwwwwwwwwWWwww..',
  'WWwwwwwwwwwwwwwW......',
  '.WWWWWWWWWWWWWW.......',
];
const BEAR_LEGS = {
  stand: ['.WwW..WwW..WwW..WwW...', '.WwW..WwW..WwW..WwW...', '.sss..sss..sss..sss...'],
  walk1: ['WwW..WwW...WwW..WwW...', 'Ww....wW..Ww.....wW...', 'ss....ss..ss.....ss...'],
  walk2: ['.WwWwW......WwWwW.....', '..WwW........WwW......', '..sss........sss......'],
};
const CUB_TOP = ['..wwwww.....', '.wwwwwwww.w.', 'wwwwwwwwwwkw', 'wwwwwwwwwwwk', 'WwwwwwwwwW..'];
const CUB_LEGS = {
  stand: ['.Ww.W..Ww.W.', '.s..s..s..s.'],
  walk1: ['Ww..W..Ww..W', 's...s..s...s'],
  walk2: ['..WwW...WwW.', '..ss.....ss.'],
};
KINDS.bear = {
  ax: 10,
  outline: '#6f788c',
  pal: FUR,
  frames: {
    ...Object.fromEntries(Object.keys(BEAR_LEGS).map(k => [k, [...BEAR_TOP, ...BEAR_LEGS[k]]])),
    // lying down, head up, front paws out
    lie: [
      '.................w.w..',
      '.....wwwwwwww...wwwww.',
      '...wwwwwwwwwwwwwwwkwww',
      '.wwwwwwwwwwwwwwwwwwwwk',
      'wwwwwwwwwwwwwwwwwwww..',
      'WWwwwwwwwwwwwwwWsssss.',
      '.WWWWWWWWWWWWWWW......',
    ],
  },
};
KINDS.cub = {
  ax: 5,
  outline: '#6f788c',
  pal: FUR,
  frames: {
    ...Object.fromEntries(Object.keys(CUB_LEGS).map(k => [k, [...CUB_TOP, ...CUB_LEGS[k]]])),
    lie: ['.........w.w', '..wwwww.wwww', '.wwwwwwwwwkw', 'wwwwwwwwwwwk', 'WWwwwwwwWss.', '.WWWWWWW....'],
  },
};
const RUDOLPH = { n: '#ff4d4d' };

const cache = new Map();
// A frame as { w, h, ax, rows } with every row padded to w, or null for a kind or a frame there is none of.
function frame(kind, name) {
  const id = kind + '/' + name;
  if (cache.has(id)) return cache.get(id);
  const K = KINDS[kind],
    src0 = K && K.frames[name];
  if (!src0) return null;
  const src = Array.isArray(src0) ? { rows: src0 } : src0,
    w = Math.max(...src.rows.map(r => r.length)),
    f = { w, h: src.rows.length, ax: src.ax != null ? src.ax : K.ax, rows: src.rows.map(r => r.padEnd(w, '.')) };
  cache.set(id, f);
  return f;
}
const frameNames = kind => Object.keys(KINDS[kind].frames);

export const CritterSprites = { KINDS, RUDOLPH, frame, frameNames };
