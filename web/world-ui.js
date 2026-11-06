// World mode: the page is served by a hub (GET /api/config says mode 'world'). Every island is an IslandScene fed by
// /api/world/stream. "Toàn cảnh" is the 8-slot sky (WorldLogic.skyLayout): my island in the centre, the other seven
// slots in a ring around it, each a small pixel-art island (drawSimpleIsland) rather than the full scene. "Của tôi"
// and an island opened from the sky draw that one island in full. There is no world camera: no drag, zoom or minimap.
// Shared by the world-*.js files: constants, label tables, the small-island art cache and panel styles.
import { I18n, tr } from './i18n.js';
import { WorldLogic } from './world-logic.js';
import { SkyRender } from './sky-render.js';
import { h } from './office-scene.js';
export const VIEW_KEY = 'ai-terrarium.view',
  DEVICE_KEY = 'ai-terrarium.thisDevice';
export const OFF_MS = 250,
  ME_PROBE_MS = 10000,
  LINK_DIM = 0.55;
export const KIND_LABEL = new Map([
  ['shell', tr('world.kind.shell')],
  ['edit', tr('world.kind.edit')],
  ['read', tr('world.kind.read')],
  ['web', tr('world.kind.web')],
  ['agent', tr('world.kind.agent')],
  ['mcp', tr('world.kind.mcp')],
  ['other', tr('world.kind.other')],
  ['none', '—'],
]);
export const SHARE_LABEL = new Map([
  ['kin', tr('world.share.kin')],
  ['co-ban', tr('world.share.coBan')],
]);
export const BUSY = new Set(['working', 'thinking', 'talking']);
// Lets go of a full-detail canvas (~20 MB at k=4); the next full draw makes a new one.
export const releaseCanvas = sc => {
  sc.canvas.width = sc.canvas.height = 0;
  sc.k = null;
  sc.lod = null;
  sc.drawnAt = -Infinity;
};
export const okColor = c => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : '#8b8fa3');
export const clip = (s, n) => {
  s = String(s == null ? '' : s);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};
export const validSlot = s => Number.isInteger(s) && s >= 0 && s < WorldLogic.SLOTS;
// "4 giây trước", "3 phút trước", "2 giờ trước" (WorldLogic.agoParts picks the unit), and a clock time.
export const agoText = ms => {
  const { unit, n } = WorldLogic.agoParts(ms);
  if (unit === 'h') return tr('world.ago.h', { n: String(n) });
  if (unit === 'm') return tr('world.ago.m', { n: String(n) });
  return tr('world.ago.s', { n: String(n) });
};
export const hhmmss = ms => new Date(ms).toTimeString().slice(0, 8);
export const hhmm = ms => new Date(ms).toTimeString().slice(0, 5);
// An island that is not sending: offline, or waking (the hub restarted and its machine has not sent again yet).
export const dimmed = m => m.online === false || m.waking === true;
// How many sessions of an island are at work, and whether one waits for approval or for another session.
export const tally = sc => {
  let busy = 0,
    alert = false;
  if (sc)
    for (const s of sc.raw.values()) {
      if (BUSY.has(s.status)) busy++;
      else if (s.status === 'permission' || s.status === 'waiting') alert = true;
    }
  return { busy, alert };
};

// ---- simple islands for "Toàn cảnh" ----
// Each is painted once into an ART_W x ART_H canvas (one art pixel = one canvas pixel) and stamped at a whole number
// of device pixels per art pixel with smoothing off, so edges stay crisp at any devicePixelRatio. The art follows the
// scene's look: 2:1 isometric, three flat shades per block (top, left 12 % darker, right 30 % darker), 1 px outline.
// Island: grass diamond, an earth-and-stone underside tapering to the front corner, one office block roofed in the
// island colour with six windows (one lit per session at work, at most six), two trees, a path, a gold pennant on mine.
export const ART_W = 88,
  ART_H = 59,
  LABEL_H = 26,
  LABEL_H2 = 38,
  ISL = { cx: 44, cy: 26, hw: 40 },
  BLD = { cx: 42, cy: 24, hw: 14, h: 12 };
export const OUTLINE = '#141a26',
  GOLD = '#ffd166';
// Painted sprites by key, least recently used first (a hit moves its key to the end; a full cache drops the first).
// Each is painted on one scratch canvas made for read-backs (the outline pass reads its pixels), then copied into a
// plain canvas: a willReadFrequently canvas stays in software memory, and the sky stamps up to eight every frame.
export const ART = new Map(),
  ART_MAX = 96;
export let artScratch = null;
export const art = (key, paint) => {
  let c = ART.get(key);
  if (c) {
    ART.delete(key);
    ART.set(key, c);
    return c;
  }
  if (!artScratch) {
    artScratch = document.createElement('canvas');
    artScratch.width = ART_W;
    artScratch.height = ART_H;
  }
  const g = artScratch.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, ART_W, ART_H);
  g.save();
  paint(g);
  g.restore();
  c = document.createElement('canvas');
  c.width = ART_W;
  c.height = ART_H;
  c.getContext('2d').drawImage(artScratch, 0, 0);
  if (ART.size >= ART_MAX) ART.delete(ART.keys().next().value);
  ART.set(key, c);
  return c;
};
// Text measurements by key (plate widths, name plate fits), least recently used first like ART. Emptied when a web
// font finishes loading, since the widths change with it.
export const MEASURE = new Map(),
  MEASURE_MAX = 128;
export const measured = (key, fn) => {
  let v = MEASURE.get(key);
  if (v) {
    MEASURE.delete(key);
    MEASURE.set(key, v);
    return v;
  }
  v = fn();
  if (MEASURE.size >= MEASURE_MAX) MEASURE.delete(MEASURE.keys().next().value);
  MEASURE.set(key, v);
  return v;
};
if (document.fonts && document.fonts.addEventListener) {
  document.fonts.addEventListener('loadingdone', () => MEASURE.clear());
  if (document.fonts.ready) document.fonts.ready.then(() => MEASURE.clear());
}
export const textW = (ctx, f, s) =>
  measured('w\n' + f + '\n' + s, () => {
    ctx.font = f;
    return { w: ctx.measureText(s).width };
  }).w;
export const px1 = (g, c, x, y, w, hh) => {
  g.fillStyle = c;
  g.fillRect(x, y, w || 1, hh || 1);
};
// A 2:1 diamond centred on (cx, cy) with half-width hw: rows grow 4 px wider to the middle, then shrink.
// rim lights the two back edges.
export const diamond = (g, cx, cy, hw, col, rim) => {
  const hh = hw / 2;
  for (let r = 0; r < 2 * hh; r++) {
    const half = r < hh ? 2 * (r + 1) : 2 * (2 * hh - r),
      y = cy - hh + r;
    px1(g, col, cx - half, y, 2 * half, 1);
    if (rim && r < hh) {
      px1(g, rim, cx - half, y, 2, 1);
      px1(g, rim, cx + half - 2, y, 2, 1);
    }
  }
};
// The columns of the two front faces under a diamond: fn(x, last row of the diamond there, left face?, i), where i
// counts columns out from the front corner (1 at the corner).
export const faceCols = (cx, cy, hw, fn) => {
  const hh = hw / 2;
  for (let x = cx - hw; x < cx + hw; x++) {
    const left = x < cx,
      i = left ? cx - x : x - cx + 1;
    fn(x, cy + hh - Math.ceil(i / 2), left, i);
  }
};
export const hash = (x, s) => {
  const v = Math.sin(x * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
// Every clear pixel next to a solid one becomes the outline (a sprite outline that follows any silhouette).
// dashed (empty places): dashes run along the diamond's edges, four columns (two rows) on and four off, counted out
// from the centre so both sides match; the columns past the two side corners are left out, so no vertical runs.
export const outline = (g, col, dashed) => {
  const a = g.getImageData(0, 0, ART_W, ART_H).data,
    solid = (x, y) => x >= 0 && y >= 0 && x < ART_W && y < ART_H && a[(y * ART_W + x) * 4 + 3] >= 24;
  g.fillStyle = col;
  const off = x => {
    const u = x < ISL.cx ? ISL.cx - 1 - x : x - ISL.cx;
    return u >= ISL.hw || Math.floor(u / 4) % 2 === 1;
  };
  for (let y = 0; y < ART_H; y++)
    for (let x = 0; x < ART_W; x++) {
      if (solid(x, y) || (dashed && off(x))) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) g.fillRect(x, y, 1, 1);
    }
};
export const tree = (g, x, y, df) => {
  const N = SkyRender.night,
    leaf = N('#3e9a45', df);
  px1(g, 'rgba(0,0,0,0.2)', x - 3, y, 6, 1);
  px1(g, N('#6b4a2a', df), x, y - 3, 1, 3);
  px1(g, leaf, x - 2, y - 7, 5, 4);
  px1(g, SkyRender.mix(leaf, '#000000', 0.18), x + 1, y - 7, 2, 4);
  px1(g, N('#57b85a', df), x - 1, y - 8, 3, 1);
};
export function paintIsland(g, color, df, lit, mine) {
  const N = SkyRender.night,
    M = SkyRender.mix,
    { cx, cy, hw } = ISL,
    b = BLD;
  // underside: two rows of grass edge, three of earth, then stone, deepest (and a little ragged) at the front corner
  faceCols(cx, cy, hw, (x, y0, left, i) => {
    const d = 2 + Math.round(9 * Math.pow(1 - (i - 1) / hw, 1.2)) + (i > 3 && i < hw - 4 && hash(x, 1) > 0.6 ? 1 : 0);
    for (let j = 0; j < d; j++) {
      const base = j < 2 ? (left ? '#3f7f33' : '#356c2b') : j < 5 ? '#8a5a36' : j < 9 ? '#7a7a84' : '#5f6070';
      px1(g, N(j < 2 ? base : M(base, '#000000', left ? 0.12 : 0.3), df), x, y0 + 1 + j);
    }
  });
  diamond(g, cx, cy, hw, N('#5fae4b', df), N('#7cc65f', df));
  for (const [fx, fy, fc] of [
    [-14, 9, GOLD],
    [9, 12, '#ff8fab'],
    [-30, 2, '#ffffff'],
    [27, 2, GOLD],
    [-6, -9, '#ffffff'],
    [-20, 8, '#ff8fab'],
  ])
    px1(g, N(fc, df), cx + fx, cy + fy);
  // the path runs from the door, square to the office's right face
  for (let k = 0; k < 6; k++) px1(g, N(k % 2 ? '#bdb6aa' : '#c9c3b8', df), b.cx + 8 + 2 * k, b.cy + 4 + k, 2, 1);
  tree(g, cx - 24, cy + 1, df);
  const wall = N('#efe9dc', df),
    roof = N(color, df),
    glass = N('#33415e', df);
  const WIN = [
    [false, 7],
    [true, 7],
    [false, 2],
    [true, 2],
    [false, 12],
    [true, 12],
  ]; // lit in this order, right face first
  faceCols(b.cx, b.cy - b.h, b.hw, (x, y0, left, i) => {
    for (let j = 0; j < b.h; j++)
      px1(g, M(j < 2 ? roof : wall, '#000000', (left ? 0.12 : 0.3) + (j < 2 ? 0.12 : 0)), x, y0 + 1 + j);
    const wi = WIN.findIndex(([l, c]) => l === left && (i === c || i === c + 1));
    if (wi >= 0)
      for (let j = 4; j < 7; j++) px1(g, wi < lit ? GOLD : M(glass, '#000000', left ? 0 : 0.2), x, y0 + 1 + j);
    if (!left && (i === 7 || i === 8)) for (let j = 8; j < b.h; j++) px1(g, N('#5c4330', df), x, y0 + 1 + j);
  });
  diamond(g, b.cx, b.cy - b.h, b.hw, roof, M(roof, '#ffffff', 0.3));
  if (mine) {
    const y = b.cy - b.h - 10;
    px1(g, '#3b4058', b.cx, y, 1, 10);
    px1(g, GOLD, b.cx + 1, y, 4, 1);
    px1(g, GOLD, b.cx + 1, y + 1, 3, 1);
    px1(g, GOLD, b.cx + 1, y + 2, 2, 1);
  }
  tree(g, cx + 21, cy + 8, df);
  // lighter at night, so islands keep their edge on a dark sky
  outline(g, SkyRender.mix(OUTLINE, '#3a4766', 1 - df), false);
}
// A place with no island: a see-through diamond with a dashed outline; the viewer's place-to-be ("yours") is gold.
export function paintTile(g, kind) {
  const yours = kind === 'yours',
    { cx, cy, hw } = ISL;
  faceCols(cx, cy, hw, (x, y0, left) =>
    px1(g, yours ? 'rgba(255,209,102,0.14)' : left ? 'rgba(16,20,30,0.14)' : 'rgba(16,20,30,0.22)', x, y0 + 1, 1, 2),
  );
  diamond(
    g,
    cx,
    cy,
    hw,
    yours ? 'rgba(255,209,102,0.2)' : 'rgba(16,20,30,0.18)',
    yours ? 'rgba(255,209,102,0.4)' : 'rgba(255,255,255,0.14)',
  );
  outline(g, yours ? GOLD : kind === 'full' ? 'rgba(200,208,222,0.8)' : 'rgba(236,242,250,0.85)', true);
}
// Lines of text on a dark plate in the island-label style, centred on (x, y) in stage px: lines = [[text, font,
// colour]].
export function plate(ctx, x, y, lines, border, alpha) {
  ctx.save();
  let wd = 0;
  for (const [s, f] of lines) wd = Math.max(wd, textW(ctx, f, s));
  const lh = 15,
    pw = Math.ceil(wd + 20),
    ph = lines.length * lh + 8,
    px = Math.round(x - pw / 2),
    py = Math.round(y - ph / 2);
  ctx.fillStyle = 'rgba(16,20,30,' + (alpha || 0.82) + ')';
  ctx.fillRect(px, py, pw, ph);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  lines.forEach(([s, f, c], i) => {
    ctx.font = f;
    ctx.fillStyle = c;
    ctx.fillText(s, px + pw / 2, py + 4 + lh * i + lh / 2 + 1);
  });
  ctx.restore();
}
// The connection panels ("Thử lại", "Phiên đã hết"); the island's own panel is worldSheet.
export const PANEL = {
  position: 'absolute',
  zIndex: 10,
  top: 12,
  right: 12,
  width: 300,
  maxWidth: 'calc(100% - 24px)',
  maxHeight: 'calc(100% - 68px)',
  overflowY: 'auto',
  boxSizing: 'border-box',
  background: 'var(--surface)',
  border: '3px solid var(--fg)',
  boxShadow: '6px 6px 0 rgba(0,0,0,0.45)',
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  fontSize: 12,
};
export const TITLE = {
  fontFamily: "'Pixelify Sans',monospace",
  fontSize: 17,
  fontWeight: 600,
  color: '#ffffff',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
export const MUTED = { fontSize: 10, color: 'var(--muted)' };
export const swatch = c => h('span', { style: { width: 14, height: 14, background: okColor(c), flex: 'none' } });
export const field = (label, val, key) =>
  h(
    'div',
    { key: key || label, style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
    h('span', { style: MUTED }, label),
    h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, val),
  );
// "Của tôi" refreshes every 30 s ±20 % while the tab is visible: the hub's general limit is 120 a minute per
// user (per IP when signed out), shared with everything else the page asks.
export const ME_EVERY_MS = 30000,
  ME_JITTER = 0.2,
  REMOVE_WAIT_MS = 5000,
  PROBE_MS = 8000,
  RETRY_CAP_S = 60,
  HEX_ID = /^[0-9a-f]{16}$/;
// One-island layout: the panel's column on a wide stage, and on a phone the room under the back control (top) and
// above the collapsed sheet (its 46 px bar + borders, 12 px from the bottom).
export const PANEL_COL = 324,
  ONE_TOP = 54,
  ONE_BOTTOM = 74;
export const SEND_LABEL = new Map([
  ['sending', [tr('world.send.sending'), '#46a758']],
  ['private', [tr('world.send.private'), '#8b8fa3']],
  ['offline', [tr('world.send.offline'), '#e5484d']],
  ['revoked', [tr('world.send.revoked'), '#8b8fa3']],
]);
export const NAME_ERR = tr('world.nameErr');
export const LINK = { color: '#9fd3ff' };
export const isJson = r => /^application\/json\b/i.test(r.headers.get('content-type') || '');
// Retry-After (seconds or an HTTP date) in whole seconds, 0..RETRY_CAP_S; 0 when absent or unreadable.
export const retryAfterS = v => {
  if (!v) return 0;
  let s = /^\d+$/.test(v.trim()) ? Number(v) : (Date.parse(v) - Date.now()) / 1000;
  return Number.isFinite(s) ? Math.min(RETRY_CAP_S, Math.max(0, Math.ceil(s))) : 0;
};
// What /api/config says now: 'world' (with cfg), 'signedout' (401), 'busy' (429, with retryS), 'other' (200 JSON,
// not world mode) or 'down' (network error, no answer within PROBE_MS, any other status, or not JSON).
export const probeConfig = () =>
  fetch('/api/config', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(PROBE_MS) : undefined,
  })
    .then(r => {
      if (r.status === 401) return { kind: 'signedout' };
      if (r.status === 429) return { kind: 'busy', retryS: retryAfterS(r.headers.get('retry-after')) };
      if (r.status !== 200 || !isJson(r)) return { kind: 'down' };
      return r
        .json()
        .then(cfg =>
          cfg && cfg.mode === 'world' && cfg.me && typeof cfg.me === 'object'
            ? { kind: 'world', cfg }
            : { kind: 'other' },
        );
    })
    .catch(() => ({ kind: 'down' }));
export const when = ms => {
  const d = new Date(ms);
  return Number.isFinite(ms)
    ? d.toLocaleString(I18n.locale, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : '—';
};
export const INPUT = {
  flex: 1,
  minWidth: 0,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--fg)',
  padding: '5px 8px',
  fontFamily: 'inherit',
  fontSize: 12,
};
export const SMALL_BTN = { padding: '3px 8px', fontSize: 11, flex: 'none' };
export const ERR = { color: '#ff9b9e', lineHeight: 1.4 };
// "<question>" + confirm / cancel, inline where the action was asked for.
export const confirmRow = (text, okLabel, c, onOk, onCancel) =>
  h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        background: 'var(--bg)',
        borderLeft: '4px solid #e5484d',
      },
    },
    h('span', { style: { lineHeight: 1.4, overflowWrap: 'anywhere' } }, text),
    h(
      'div',
      { style: { display: 'flex', gap: 6 } },
      h(
        'button',
        {
          className: 'btn',
          disabled: !!c.busy,
          onClick: onOk,
          style: { ...SMALL_BTN, borderColor: '#e5484d', background: '#e5484d', color: '#ffffff', fontWeight: 600 },
        },
        c.busy ? tr('world.confirm.busy') : okLabel,
      ),
      h(
        'button',
        { className: 'btn', disabled: !!c.busy, onClick: onCancel, style: SMALL_BTN },
        tr('world.confirm.cancel'),
      ),
    ),
    c.err && h('span', { role: 'alert', style: ERR }, c.err),
  );
