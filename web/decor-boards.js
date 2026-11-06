// The usage board on the office wall (LED, whiteboard and gauge styles) showing the 5-hour and 7-day quotas.
import { al, mix, mount, surf, text3, textW } from './decor-kit.js';
export const UCOL = p => (p >= 0.85 ? '#ff5a5f' : p >= 0.6 ? '#f5b83d' : '#3fd07a');
export const UCOL2 = p => (p >= 0.85 ? '#e5484d' : p >= 0.6 ? '#f29e0b' : '#2fae6a');
export function fmtReset(min) {
  min = Math.max(0, Math.round(min));
  if (min >= 1440) {
    const d = Math.floor(min / 1440),
      h = Math.floor((min % 1440) / 60);
    return d + 'D' + String(h).padStart(2, '0');
  }
  const h = Math.floor(min / 60),
    m = min % 60;
  return h + 'H' + String(m).padStart(2, '0');
}
export const BW = 78,
  BH = 48;
export function boardLED(g, o, t) {
  const W = BW,
    H = BH;
  g.fillStyle = '#14171f';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#262c3b';
  g.fillRect(1, 1, W - 2, 1);
  g.fillStyle = '#0d0f15';
  g.fillRect(1, H - 2, W - 2, 1);
  g.fillStyle = '#0a101c';
  g.fillRect(3, 3, W - 6, H - 6);
  for (let y = 4; y < H - 3; y += 2) {
    g.fillStyle = 'rgba(255,255,255,0.02)';
    g.fillRect(3, y, W - 6, 1);
  }
  text3(g, 'USAGE', 4, 6, '#8b93a7');
  const worst = Math.max(o.h5 || 0, o.d7 || 0),
    off = worst >= 1 && Math.floor(t * 3) % 2;
  g.fillStyle = off ? '#3a1416' : UCOL(worst);
  g.fillRect(W - 9, 6, 3, 3);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(W - 9, 6, 1, 1);
  g.fillStyle = '#1c2535';
  g.fillRect(5, 13, W - 10, 1);
  [
    ['5H', o.h5, o.r5, 300],
    ['7D', o.d7, o.r7, 10080],
  ].forEach(([lab, p, rm, win], i) => {
    const y = 17 + i * 14,
      N = 13,
      bx = 16,
      bw = N * 3 - 1,
      unk = p == null,
      col = UCOL(unk ? 0 : p);
    text3(g, lab, 4, y, '#e6e9ef');
    if (unk) {
      for (let k = 0; k < N; k++) {
        g.fillStyle = '#18202e';
        g.fillRect(bx + k * 3, y, 2, 5);
      }
      text3(g, '--', W - 19, y, '#5d6a86');
      g.fillStyle = '#141b28';
      g.fillRect(bx, y + 8, bw, 1);
      return;
    }
    if (p >= 1) {
      const on = Math.floor(t * 2.5) % 2;
      g.fillStyle = on ? '#ff5a5f' : '#4a1518';
      g.fillRect(bx, y, bw, 5);
      text3(g, 'LIMIT', bx + ((bw - 19) >> 1), y, on ? '#ffffff' : '#ff8a8d');
    } else {
      const lit = Math.min(N, Math.round(p * N));
      for (let k = 0; k < N; k++) {
        const on = k < lit;
        let c = on ? col : '#18202e';
        if (on && p >= 0.9 && k === lit - 1 && Math.floor(t * 4) % 2) c = '#3a1416';
        g.fillStyle = c;
        g.fillRect(bx + k * 3, y, 2, 5);
        if (on && c !== '#3a1416') {
          g.fillStyle = mix(col, '#ffffff', 0.45);
          g.fillRect(bx + k * 3, y, 2, 1);
        }
      }
    }
    const pt = Math.min(100, Math.round(p * 100)) + '%';
    text3(g, pt, W - 19, y, p >= 0.85 ? '#ff8a8d' : '#e6e9ef');
    const el = Math.max(0, Math.min(1, 1 - rm / win));
    g.fillStyle = '#141b28';
    g.fillRect(bx, y + 8, bw, 1);
    g.fillStyle = '#3d4a66';
    g.fillRect(bx, y + 8, Math.round(bw * el), 1);
    const rs = fmtReset(rm);
    text3(g, rs, W - 19, y + 7, '#5d6a86');
  });
}
export function boardWhite(g, o, t) {
  const W = BW,
    H = BH,
    B = H - 4;
  g.fillStyle = '#8f9ab0';
  g.fillRect(0, 0, W, B);
  g.fillStyle = '#d6dce6';
  g.fillRect(1, 1, W - 2, B - 2);
  g.fillStyle = '#f6f7f9';
  g.fillRect(3, 3, W - 6, B - 6);
  g.fillStyle = '#eceef3';
  [
    [40, 8, 10, 2],
    [30, 38, 9, 1],
  ].forEach(r => g.fillRect(...r));
  text3(g, 'USAGE', 4, 6, '#2d3142');
  g.fillStyle = '#2d3142';
  for (let x = 4; x < 23; x++) g.fillRect(x, 12 + ((x >> 2) % 2), 1, 1);
  g.fillStyle = '#ffd166';
  g.fillRect(W - 19, 4, 13, 10);
  g.fillStyle = '#e9b949';
  g.fillRect(W - 19, 13, 13, 1);
  g.fillStyle = '#c9a227';
  [7, 9, 11].forEach(y => g.fillRect(W - 17, y, 8 + (y % 3), 1));
  g.fillStyle = '#e5484d';
  g.fillRect(W - 13, 4, 2, 2);
  [
    ['5H', o.h5, o.r5],
    ['7D', o.d7, o.r7],
  ].forEach(([lab, p, rm], i) => {
    const y = 16 + i * 12,
      bx = 16,
      bw = 34,
      col = UCOL2(p),
      fw = Math.round(bw * Math.min(1, p));
    text3(g, lab, 4, y, '#2f5bff');
    g.fillStyle = mix(col, '#ffffff', 0.6);
    g.fillRect(bx + 1, y, fw, 5);
    for (let xx = 0; xx < fw; xx++)
      for (let yy = 0; yy < 5; yy++)
        if ((xx + yy) % 3 === 0) {
          g.fillStyle = col;
          g.fillRect(bx + 1 + xx, y + yy, 1, 1);
        }
    g.fillStyle = '#2d3142';
    g.fillRect(bx, y - 1, bw + 2, 1);
    g.fillRect(bx, y + 5, bw + 2, 1);
    g.fillRect(bx, y - 1, 1, 7);
    g.fillRect(bx + bw + 1, y - 1, 1, 7);
    const pt = Math.min(100, Math.round(p * 100)) + '%',
      px = 56;
    text3(g, pt, px, y, p >= 1 ? '#e5484d' : '#2d3142');
    text3(g, fmtReset(rm), 56, y + 6, '#9aa6bd');
  });
  g.fillStyle = '#b9c0cc';
  g.fillRect(4, B, W - 8, 2);
  g.fillStyle = '#8b93a7';
  g.fillRect(4, B + 2, W - 8, 1);
  [
    ['#2f5bff', 10],
    ['#e5484d', 17],
    ['#2d3142', 24],
  ].forEach(([c, x]) => {
    g.fillStyle = c;
    g.fillRect(x, B, 5, 2);
    g.fillStyle = '#f6f7f9';
    g.fillRect(x + 4, B, 1, 2);
  });
  g.fillStyle = '#3d4970';
  g.fillRect(W - 28, B, 8, 2);
  g.fillStyle = '#c9cfdc';
  g.fillRect(W - 28, B + 1, 8, 1);
}
export function boardGauge(g, o, t) {
  const W = BW,
    H = BH;
  g.fillStyle = '#4a2e1b';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#7a4f2f';
  g.fillRect(1, 1, W - 2, H - 2);
  g.fillStyle = '#6b4428';
  [
    [3, 9, 30],
    [40, 15, 34],
    [6, 41, 26],
    [44, 44, 28],
  ].forEach(([x, y, w]) => g.fillRect(x, y, w, 1));
  g.fillStyle = '#c9a77a';
  [
    [3, 3],
    [W - 4, 3],
    [3, H - 4],
    [W - 4, H - 4],
  ].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  text3(g, 'USAGE', al((W - 19) / 2), 4, '#f2ead9');
  const worst = Math.max(o.h5, o.d7);
  if (worst >= 1) {
    g.fillStyle = Math.floor(t * 3) % 2 ? '#ff5a5f' : '#5a1a1d';
    g.fillRect(W - 12, 4, 4, 4);
    g.fillStyle = '#ffffff';
    g.fillRect(W - 12, 4, 1, 1);
  }
  [
    ['5H', o.h5, o.r5],
    ['7D', o.d7, o.r7],
  ].forEach(([lab, p, rm], i) => {
    const cx = 20 + i * 38,
      cy = 27,
      R = 14;
    for (let y = cy - R - 1; y <= cy + 2; y++)
      for (let x = cx - R - 1; x <= cx + R + 1; x++) {
        const dx = x - cx + 0.5,
          dy = y - cy + 0.5,
          d = Math.hypot(dx, dy);
        if (d > R + 1.2 || dy > 2.5) continue;
        let c = d > R ? '#2d1c10' : '#f2ead9';
        if (d <= R - 0.5 && d >= R - 3.5 && dy < 0) {
          const f = (Math.atan2(dy, dx) + Math.PI) / Math.PI;
          c = f < 0.6 ? '#3fae6a' : f < 0.85 ? '#f2b134' : '#e5484d';
        }
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
      }
    for (let k = 0; k <= 10; k++) {
      const a = -Math.PI + (k * Math.PI) / 10;
      g.fillStyle = '#5c4a3a';
      g.fillRect(Math.round(cx + Math.cos(a) * (R - 5.5)), Math.round(cy + Math.sin(a) * (R - 5.5)), 1, 1);
    }
    const pp = Math.min(1.02, p) + (p >= 0.9 ? Math.sin(t * 28 + i) * 0.012 : 0),
      a = -Math.PI + pp * Math.PI;
    for (let s = 0; s < R - 3; s += 0.5) {
      g.fillStyle = '#2d3142';
      g.fillRect(Math.round(cx + Math.cos(a) * s), Math.round(cy + Math.sin(a) * s), 1, 1);
    }
    g.fillStyle = '#e5484d';
    g.fillRect(cx - 1, cy - 1, 3, 3);
    g.fillStyle = '#ff9a9a';
    g.fillRect(cx - 1, cy - 1, 1, 1);
    text3(g, lab, al(cx - R), cy + 5, '#f2ead9');
    const pt = Math.min(100, Math.round(p * 100)) + '%';
    text3(g, pt, al(cx + R - textW(pt) + 1), cy + 5, p >= 0.85 ? '#ffb3b3' : '#f2ead9');
    text3(g, fmtReset(rm), al(cx - R), cy + 12, '#c9a77a');
  });
}
export const BOARDS = {
  led: { fn: boardLED, edge: '#07080c', glow: 'rgba(94,242,255,0.05)' },
  whiteboard: { fn: boardWhite, edge: '#6b768c' },
  gauge: { fn: boardGauge, edge: '#2d1c10' },
};
export function boardSurface(variant, o, t) {
  const B = BOARDS[variant] || BOARDS.led,
    s = surf('ub-' + variant + (o.night ? 'n' : 'd'), BW, BH);
  B.fn(s.g, o, t);
  return s.c;
}
export function drawUsageBoard(ctx, X0, Y0, o, t, dir) {
  const B = BOARDS[o.variant] || BOARDS.led;
  mount(ctx, g => B.fn(g, o, t), BW, BH, X0, Y0, dir || 'left', B.edge, o.night ? B.glow : null);
}
