import { tr } from './i18n.js';
import { SkyLogic } from './sky-logic.js';
import { RestroomLogic } from './restroom-logic.js';
import { BLOCK, EDGE, H, ISLAND, LAWN_WALK, PAVED, STAIRS, W, WC, WC_WALK } from './office-scene.js';
// Shared look-up tables and small helpers of the office page.
export const SHIRT = [
  '#e5484d',
  '#3e8ed0',
  '#46a758',
  '#f5a524',
  '#8e4ec6',
  '#12a594',
  '#e93d82',
  '#5b5bd6',
  '#ff8b3d',
  '#2f9ab8',
  '#9b7b4f',
  '#6a7bd8',
];
export const TOOLS = [
  ['Read', 'Header.tsx'],
  ['Edit', 'routes.ts'],
  ['Bash', 'npm test'],
  ['Grep', 'useSession'],
  ['Write', 'CHANGELOG.md'],
  ['Bash', 'git diff'],
  ['Glob', '**/*.test.ts'],
  ['WebFetch', 'docs.anthropic.com'],
  ['TodoWrite', '4 tasks'],
  ['Edit', 'package.json'],
  ['Bash', 'tsc --noEmit'],
  ['Read', 'schema.prisma'],
];
export const TALK = tr('office.sim.talkTopics');
export const PERM = ['Bash: rm -rf dist', 'Bash: git push', 'Write: .env', 'Bash: npm publish'];
export const ERRS = ['test failed (3)', 'ENOENT config.json', 'tsc: 2 errors', 'exit code 1'];
export const ST = {
  working: [tr('office.status.working'), '#3e8ed0'],
  thinking: [tr('office.status.thinking'), '#5b8def'],
  talking: [tr('office.status.talking'), '#12a594'],
  waiting: [tr('office.status.waiting'), '#8e4ec6'],
  permission: [tr('office.status.permission'), '#f5a524'],
  error: [tr('office.status.error'), '#e5484d'],
  idle: [tr('office.status.idle'), '#8b8fa3'],
  done: [tr('office.status.done'), '#46a758'],
  entering: [tr('office.status.entering'), '#8b8fa3'],
  leaving: [tr('office.status.leaving'), '#8b8fa3'],
};
export const ICON = {
  permission: ['..#..', '..#..', '..#..', '.....', '..#..'],
  error: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  done: ['....#', '...#.', '#.#..', '.#...', '.....'],
  idle: ['####.', '..#..', '.#...', '####.', '.....'],
  waiting: ['#####', '.###.', '..#..', '.###.', '#####'],
  talking: ['#####', '#...#', '#####', '.#...', '....#'],
};
export const shade = (hh, p) => {
  if (!hh || hh[0] !== '#' || hh.length !== 7) return hh;
  const n = parseInt(hh.slice(1), 16),
    c = v => Math.max(0, Math.min(255, v));
  return (
    '#' +
    ((1 << 24) + (c((n >> 16) + p) << 16) + (c(((n >> 8) & 255) + p) << 8) + c((n & 255) + p)).toString(16).slice(1)
  );
};
// Màu của bàn trống: khử bão hoà rồi chỉnh độ sáng. Tính sẵn bằng màu thay cho ctx.filter — filter trên canvas
// bắt Chrome dựng một layer riêng cho từng lệnh vẽ và kéo cả trang xuống ~1 FPS.
export const greyHex = (hh, sat, bri) => {
  if (!hh || hh[0] !== '#' || hh.length !== 7) return hh;
  const n = parseInt(hh.slice(1), 16),
    r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255,
    l = 0.299 * r + 0.587 * g + 0.114 * b,
    c = v => Math.max(0, Math.min(255, Math.round((v + (l - v) * sat) * bri)));
  return '#' + ((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1);
};
export const VACANT_CACHE = new Map();
export const vacantTheme = th => {
  const key = JSON.stringify(th);
  let v = VACANT_CACHE.get(key);
  if (v) return v;
  const sat = th.stroke ? 0.9 : 0.85,
    bri = th.stroke ? 1.08 : 0.7;
  v = {};
  for (const k in th) v[k] = typeof th[k] === 'string' ? greyHex(th[k], sat, bri) : th[k];
  v._metal = greyHex(th.stroke ? '#ffffff' : '#2d3142', sat, bri);
  v._mouse = greyHex(th.stroke ? '#ffffff' : '#d9dbe2', sat, bri);
  if (VACANT_CACHE.size > 64) VACANT_CACHE.clear();
  VACANT_CACHE.set(key, v);
  return v;
};
export const FONT = {
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110101101101101',
  O: '010101101101010',
  P: '110101110100100',
  Q: '010101101110011',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '110001010100111',
  '3': '110001010001110',
  '4': '101101111001001',
  '5': '111100110001110',
  '6': '011100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001110',
  '·': '000000010000000',
  '/': '001001010100100',
  '%': '101001010100101',
  '-': '000000111000000',
  '_': '000000000000111',
  '.': '000000000000010',
};
// Rows of a 3×5 FONT letter for the restroom's sign and floor paint, plus Ữ and Ả with their marks above (7 rows).
export const RESTROOM_GLYPH = ch => {
  if (ch === '\u1EEE') return ['.##.', '##..', '#.##', '#.#.', '#.#.', '#.#.', '###.'];
  if (ch === '\u1EA2') return ['##.', '.#.', '.#.', '#.#', '###', '#.#', '#.#'];
  const f = FONT[ch];
  if (!f) return [];
  const r = [];
  for (let i = 0; i < 5; i++)
    r.push(
      f
        .slice(i * 3, i * 3 + 3)
        .replace(/1/g, '#')
        .replace(/0/g, '.'),
    );
  return r;
};
export function text3(ctx, str, x, y, col) {
  ctx.fillStyle = col;
  x = Math.round(x);
  y = Math.round(y);
  [...String(str).toUpperCase()].forEach((ch, i) => {
    const f = FONT[ch];
    if (!f) return;
    for (let b = 0; b < 15; b++) if (f[b] === '1') ctx.fillRect(x + i * 4 + (b % 3), y + Math.floor(b / 3), 1, 1);
  });
}
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const rnd = (a, b) => a + Math.random() * (b - a);
export const clock = () => new Date().toTimeString().slice(0, 8);
export const fmtK = n => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
export const shortOf = s =>
  (s || '???')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase() || 'S';
export const cwdKey = s => {
  if (!s || s === '—') return null;
  const p = s.replace(/\/+$/, '').split('/');
  const last = p[p.length - 1];
  if (last === 'scratchpad' || s.includes('/tmp/claude-')) {
    const m = s.match(/tmp\/claude-\d+\/-([^/]+)/);
    if (m) {
      const parts = m[1].split('-');
      return parts[parts.length - 1] || null;
    }
    return null;
  }
  return last || null;
};

export function bfs(from, to) {
  // Office floor cells avoid furniture; lawn cells come from the island's walkable set; the two only meet at the
  // stairs. Out on the lawn grass costs more than the garden path, so agents keep to the path unless it is a long way
  // round. The restroom block is floor like the office: walked from the pantry beside it, never stepped onto from the
  // lawn.
  const key = p => p[0] + ',' + p[1],
    inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const ok = (x, y) => {
    const k = x + ',' + y;
    return inside(x, y) ? !BLOCK.has(k) : WC.floorSet.has(k) ? WC_WALK.has(k) : LAWN_WALK.has(k);
  };
  const canStep = (c, n) => {
    if (EDGE.has(key(c) + '|' + key(n))) return false;
    const s = RestroomLogic.step(WC, c, n, inside);
    if (s === false || (s === null && !SkyLogic.canCross(c, n, W, H, STAIRS))) return false;
    return ok(n[0], n[1]) || (n[0] === to[0] && n[1] === to[1]);
  };
  return SkyLogic.cheapestPath(from, to, canStep, n =>
    inside(n[0], n[1]) || WC.floorSet.has(key(n)) || ISLAND.paths.cells.has(key(n)) || PAVED.has(key(n))
      ? 1
      : SkyLogic.GRASS_COST,
  );
}
