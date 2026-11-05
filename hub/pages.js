'use strict';
// Server-rendered HTML pages. EVERY dynamic value goes through escapeHtml (S18).
// ISLAND_COLORS is the fixed 8-colour palette; an island's colour is ISLAND_COLORS[hash(user.id) % 8].

const fs = require('node:fs');
const path = require('node:path');

const ISLAND_COLORS = ['#e76f51', '#f4a261', '#e9c46a', '#8ab17d', '#2a9d8f', '#4a90d9', '#7b6cd9', '#d96ca8'];

const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]);

// Pages carry no script at all. Fonts come from Google Fonts like the world page; the logo is an inline data: image.
const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "img-src data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

let LOGO = '';
try { LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '..', 'assets', 'logo.png')).toString('base64'); } catch { /* no logo */ }

const FONTS = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap';

const CSS = `
:root{--bg:#0e1117;--surface:#151a24;--raise:#1b2130;--well:#0b0f17;--border:#2a3142;--fg:#e6e9ef;--muted:#8b93a7;--accent:#7fb2ff;
--ok:#46a758;--ok-edge:#2f7a40;--warn:#ffd166;--danger:#e5484d;--danger-edge:#a8292d;color-scheme:dark}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;min-height:100vh;color:var(--fg);font:15px/1.6 'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
background:radial-gradient(1px 1px at 12% 14%,#ffffff99 50%,transparent 51%),radial-gradient(1px 1px at 78% 9%,#ffffff80 50%,transparent 51%),
radial-gradient(2px 2px at 64% 26%,#ffffff70 50%,transparent 51%),radial-gradient(1px 1px at 31% 6%,#ffffff70 50%,transparent 51%),
radial-gradient(1px 1px at 91% 33%,#ffffff60 50%,transparent 51%),radial-gradient(2px 2px at 6% 38%,#ffffff50 50%,transparent 51%),
linear-gradient(180deg,#0b1633 0%,#0e1117 62%) fixed;
padding-block:40px 56px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.wrap{max-width:30rem;margin:0 auto;display:flex;flex-direction:column;gap:20px}
.wrap.wide{max-width:46rem}
.brand{display:flex;align-items:center;gap:10px;color:var(--fg);text-decoration:none;font:700 17px 'Pixelify Sans',monospace;letter-spacing:.06em;text-transform:uppercase;align-self:flex-start}
.brand img{width:36px;height:36px;image-rendering:pixelated}
.card{background:var(--surface);border:2px solid var(--border);box-shadow:6px 6px 0 #05070b;padding:28px;display:flex;flex-direction:column;gap:16px;min-width:0}
.hero{align-items:center;text-align:center}
.hero img{width:120px;height:120px;image-rendering:pixelated}
h1{font:600 26px/1.25 'Pixelify Sans',monospace;margin:0;text-wrap:balance}
h2{font:600 18px/1.3 'Pixelify Sans',monospace;margin:0}
p{margin:0}
a{color:var(--accent)}
.muted{color:var(--muted)}
.small{font-size:12px}
.label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.row form{margin:0}
.spread{justify-content:space-between}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font:600 15px/1 'Pixelify Sans',monospace;padding:11px 18px;
border:2px solid var(--border);background:var(--raise);color:var(--fg);cursor:pointer;text-decoration:none;box-shadow:inset 0 -3px 0 #00000066}
.btn:hover{filter:brightness(1.15)}
.btn:active{transform:translateY(2px);box-shadow:none}
.btn:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn.ok{background:var(--ok);border-color:var(--ok-edge);color:#fff}
.btn.danger{background:var(--danger);border-color:var(--danger-edge);color:#fff}
.btn.ghost{background:transparent}
.btn.sm{font-size:13px;padding:7px 12px}
.btn.wide{width:100%}
.link-danger{color:#ff8a8d}
.notice{border-left:4px solid var(--warn);background:#2a2412;padding:12px 14px;color:#f3e3b0;display:flex;flex-direction:column;gap:8px}
.notice.bad{border-left-color:var(--danger);background:#2a1416;color:#f5c2c4}
.code{font:600 30px/1 'JetBrains Mono',monospace;letter-spacing:.22em;padding:16px;background:var(--well);border:2px dashed var(--border);text-align:center;color:var(--warn)}
input[type=text]{font:600 22px 'JetBrains Mono',monospace;letter-spacing:.25em;text-transform:uppercase;text-align:center;width:100%;padding:12px;
background:var(--well);color:var(--fg);border:2px solid var(--border);border-radius:0}
input.plain{font:15px 'JetBrains Mono',monospace;letter-spacing:0;text-transform:none;text-align:left;padding:10px 12px}
.device{display:flex;gap:14px;align-items:center;padding:14px;background:var(--raise);border:2px solid var(--border);min-width:0}
.device div{min-width:0;display:flex;flex-direction:column;gap:2px}
.device strong{font-size:17px;overflow-wrap:anywhere}
.pix{flex:none;display:block}
.list{display:flex;flex-direction:column;gap:10px}
.item{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:12px 14px;background:var(--raise);border:2px solid var(--border)}
.item .name{font-weight:600;flex:1 1 10rem;min-width:0;overflow-wrap:anywhere}
.item .meta{flex:1 1 100%;font-size:12px;color:var(--muted)}
.item.off{opacity:.6}
.pill{font-size:11px;padding:2px 8px;border:1px solid currentColor;white-space:nowrap}
.pill.sending{color:var(--ok)}.pill.private{color:var(--muted)}.pill.offline{color:var(--warn)}.pill.revoked{color:var(--danger)}
.field{display:flex;flex-direction:column;gap:6px}
.swatches{display:flex;flex-wrap:wrap;gap:10px}
.swatches label{cursor:pointer;position:relative}
.swatches input{position:absolute;opacity:0;width:1px;height:1px}
.swatches span{display:block;width:32px;height:32px;box-shadow:inset 0 -4px 0 #00000055}
.swatches input:checked+span{outline:3px solid var(--fg);outline-offset:3px}
.swatches input:focus-visible+span{outline:3px solid var(--accent);outline-offset:3px}
.who{display:flex;gap:14px;align-items:center;min-width:0}
.who div{min-width:0}
.who .email{color:var(--muted);overflow-wrap:anywhere}
.avatar{width:52px;height:52px;display:flex;align-items:center;justify-content:center;font:700 24px 'Pixelify Sans',monospace;color:#fff;flex:none;box-shadow:inset 0 -5px 0 #00000055}
.foot{font-size:12px;color:var(--muted);text-align:center}
@media (max-width:480px){.card{padding:20px}h1{font-size:22px}.code{font-size:24px}}
`;

function layout(title, body, { wide = false, head = '' } = {}) {
  const brand = `<a class="brand" href="/">${LOGO ? `<img src="${LOGO}" alt="">` : ''}AI Terrarium</a>`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">` +
    `<title>${escapeHtml(title)} · AI Terrarium</title>${head}` +
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONTS}"><style>${CSS}</style></head>` +
    `<body><main class="wrap${wide ? ' wide' : ''}">${brand}${body}<p class="foot">Mỗi phiên Claude Code là một nhân vật trên đảo của bạn</p></main></body></html>`;
}

// Small pixel icons drawn on a 16x16 grid.
const rects = (fill, list) => list.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`).join('');
const svg = (size, inner) => `<svg class="pix" width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${inner}</svg>`;
const ICON = {
  computer: (s = 52) => svg(s, rects('#2a3142', [[1, 2, 14, 10], [7, 12, 2, 2], [4, 14, 8, 1]]) + rects('#7fb2ff', [[2, 3, 12, 8]]) +
    rects('#e6e9ef', [[3, 4, 4, 1]]) + rects('#cfe0ff', [[3, 6, 7, 1], [3, 8, 5, 1]])),
  check: (s = 64) => svg(s, rects('#46a758', [[0, 0, 16, 16]]) + rects('#2f7a40', [[0, 14, 16, 2]]) +
    rects('#ffffff', [[3, 7, 2, 2], [4, 8, 2, 2], [5, 9, 2, 2], [6, 10, 2, 2], [7, 9, 2, 2], [8, 8, 2, 2], [9, 7, 2, 2], [10, 6, 2, 2], [11, 5, 2, 2], [12, 4, 2, 2]])),
  cross: (s = 64) => svg(s, rects('#e5484d', [[0, 0, 16, 16]]) + rects('#a8292d', [[0, 14, 16, 2]]) +
    rects('#ffffff', [[4, 3, 2, 2], [6, 5, 2, 2], [8, 7, 2, 2], [10, 9, 2, 2], [10, 3, 2, 2], [8, 5, 2, 2], [6, 7, 2, 2], [4, 9, 2, 2]])),
  lock: (s = 64) => svg(s, rects('#8b93a7', [[5, 1, 6, 2], [4, 2, 2, 5], [10, 2, 2, 5]]) + rects('#ffd166', [[2, 7, 12, 8]]) +
    rects('#b8902f', [[2, 13, 12, 2]]) + rects('#2a2412', [[7, 9, 2, 3]])),
};

const when = (t) => (t == null ? '-' : new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC');
const NEW_DEVICE_MS = 7 * 24 * 3600 * 1000; // a device paired this recently is flagged "Máy mới"
const isNewDevice = (d, now) => d.revoked_at == null && now - d.created_at < NEW_DEVICE_MS;
const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#888888');
const csrfField = (csrf) => `<input type="hidden" name="csrf" value="${escapeHtml(csrf)}">`;

function welcomePage() {
  return layout('Chào mừng',
    `<section class="card hero">${LOGO ? `<img src="${LOGO}" alt="">` : ''}<h1>Một bầu trời, nhiều hòn đảo</h1>` +
    `<p class="muted">Mỗi máy chạy Claude Code là một hòn đảo nhỏ có văn phòng pixel. Đăng nhập để thấy đảo của mọi người cùng làm việc. ` +
    `Hub chỉ nhận trạng thái đã lọc: không tên session, không thư mục, không nội dung lệnh.</p>` +
    `<a class="btn ok wide" href="/auth/login">Đăng nhập bằng Google</a></section>`);
}

// devicePage({csrf, error, device: {name, userCode, requestedAt}, done: 'approved'|'denied'})
// - no device: the form where the user types the code;
// - device: confirmation with name, time requested, code and the two buttons (reached by lookup or ?code=).
function devicePage({ csrf, error, device, done } = {}) {
  const err = error ? `<p class="notice bad" role="alert">${escapeHtml(error)}</p>` : '';
  if (done === 'approved') {
    const who = device ? `<strong>${escapeHtml(device.name)}</strong>` : 'Máy đó';
    return layout('Đã cho phép', `<section class="card hero">${ICON.check()}<h1>Đã cho phép</h1>` +
      `<p>${who} sẽ tự kết nối trong vài giây.</p><p class="muted small">Đang mở thế giới…</p>` +
      `<a class="btn ok wide" href="/">Xem thế giới ngay</a></section>`, { head: '<meta http-equiv="refresh" content="3;url=/">' });
  }
  if (done) {
    return layout('Đã từ chối', `<section class="card hero">${ICON.cross()}<h1>Đã từ chối</h1>` +
      `<p class="muted">Máy đó sẽ không được kết nối.</p><a class="btn ghost wide" href="/">Về thế giới</a></section>`);
  }
  if (device) {
    return layout('Cho phép máy mới', `<section class="card"><h1>Cho máy này vào thế giới?</h1>${err}` +
      `<div class="device">${ICON.computer()}<div><span class="label">Tên máy</span><strong>${escapeHtml(device.name)}</strong>` +
      `<span class="muted small">Yêu cầu lúc: ${escapeHtml(when(device.requestedAt))}</span></div></div>` +
      `<div class="field"><span class="label">Mã trên máy của bạn</span><div class="code">${escapeHtml(device.userCode)}</div></div>` +
      `<p class="notice">Chỉ bấm Cho phép nếu bạn vừa bấm "Tham gia thế giới" (hoặc chạy lệnh join) trên máy của mình</p>` +
      `<form method="post" action="/device" class="row">${csrfField(csrf)}` +
      `<input type="hidden" name="user_code" value="${escapeHtml(device.userCode)}">` +
      `<button class="btn ok" type="submit" name="action" value="approve">Cho phép</button>` +
      `<button class="btn ghost" type="submit" name="action" value="deny">Từ chối</button></form></section>`);
  }
  return layout('Ghép máy', `<section class="card"><h1>Ghép máy</h1>${err}` +
    `<p class="muted">Gõ mã bạn thấy trên máy của mình.</p>` +
    `<form method="post" action="/device" class="field">${csrfField(csrf)}` +
    `<input type="text" name="user_code" aria-label="Mã ghép máy" placeholder="XXXX-XXXX" autocomplete="off" autocapitalize="characters" maxlength="12" required>` +
    `<button class="btn ok wide" type="submit" name="action" value="lookup">Tiếp tục</button></form></section>`);
}

const SEND_LABEL = { sending: 'Đang gửi', private: 'Riêng tư', offline: 'Ngoại tuyến', revoked: 'Đã thu hồi' };

// mePage({csrf, user: {name, email}, island: {name, color} | null, colors, now,
//         devices: [{id, name, created_at, last_used_at, revoked_at, send?}]})
function mePage({ csrf, user, island, devices = [], colors = ISLAND_COLORS, now = Date.now() } = {}) {
  const revokeForm = (d, cls = 'btn danger sm') => `<form method="post" action="/me/devices/revoke">${csrfField(csrf)}` +
    `<input type="hidden" name="device_id" value="${escapeHtml(d.id)}"><button class="${cls}" type="submit">Thu hồi</button></form>`;
  const name = (user && user.name) || 'Tôi';
  const color = island ? safeColor(island.color) : '#4a90d9';
  const who = `<section class="card"><div class="row spread"><div class="who">` +
    `<div class="avatar" style="background:${escapeHtml(color)}">${escapeHtml(String(name).trim().charAt(0).toUpperCase() || '?')}</div>` +
    `<div><h1>${escapeHtml(name)}</h1><p class="email">${escapeHtml((user && user.email) || '')}</p></div></div>` +
    `<form method="post" action="/auth/logout">${csrfField(csrf)}<button class="btn ghost sm" type="submit">Đăng xuất</button></form></div></section>`;
  const fresh = devices.filter((d) => isNewDevice(d, now)).map((d) =>
    `<div class="notice"><p>Máy mới: <strong>${escapeHtml(d.name)}</strong>, lúc ${escapeHtml(when(d.created_at))}</p>` +
    `<p>Không phải bạn ghép? Thu hồi ngay.</p><div class="row">${revokeForm(d)}</div></div>`).join('');
  const isl = island
    ? `<section class="card"><h2>Đảo của bạn</h2><form method="post" action="/me/island" class="field" style="gap:16px">${csrfField(csrf)}` +
      `<label class="field"><span class="label">Tên đảo</span><input class="plain" type="text" name="name" value="${escapeHtml(island.name)}" maxlength="24" required></label>` +
      `<fieldset class="field" style="border:0;padding:0;margin:0"><legend class="label" style="padding:0;margin-bottom:6px">Màu đảo</legend><div class="swatches">` +
      colors.map((col) => `<label title="${escapeHtml(col)}"><input type="radio" name="color" value="${escapeHtml(col)}"${col === island.color ? ' checked' : ''}>` +
        `<span style="background:${escapeHtml(safeColor(col))}"></span></label>`).join('') +
      `</div></fieldset><div class="row"><button class="btn ok" type="submit">Lưu</button></div></form></section>`
    : `<section class="card"><h2>Đảo của bạn</h2><p class="muted">Bạn chưa có đảo. Ghép máy đầu tiên để tạo đảo.</p>` +
      `<div class="row"><a class="btn ok" href="/device">Ghép máy đầu tiên</a></div></section>`;
  const items = devices.map((d) => {
    const revoked = d.revoked_at != null;
    const st = revoked ? 'revoked' : (SEND_LABEL[d.send] ? d.send : null);
    const pill = st ? `<span class="pill ${st}">${SEND_LABEL[st]}</span>` : '';
    const meta = revoked ? `Đã thu hồi lúc ${escapeHtml(when(d.revoked_at))}`
      : `Ghép lúc ${escapeHtml(when(d.created_at))} · ${d.last_used_at == null ? 'chưa gửi lần nào' : 'gửi lần cuối ' + escapeHtml(when(d.last_used_at))}`;
    return `<div class="item${revoked ? ' off' : ''}"><span class="name">${escapeHtml(d.name)}</span>${pill}` +
      `${revoked ? '' : revokeForm(d, 'btn ghost sm')}<span class="meta">${meta}</span></div>`;
  }).join('');
  const list = devices.length ? `<div class="list">${items}</div>` : '<p class="muted">Chưa có máy nào.</p>';
  const machines = `<section class="card"><div class="row spread"><h2>Máy</h2><a class="btn ghost sm" href="/device">Ghép máy mới</a></div>${list}</section>`;
  const nav = `<div class="row spread"><a class="btn ok" href="/">Về thế giới</a><a class="link-danger small" href="/me/leave">Rời hub</a></div>`;
  return layout('Của tôi', `${who}${fresh}${isl}${machines}${nav}`, { wide: true });
}

function leavePage({ csrf } = {}) {
  return layout('Rời hub',
    `<section class="card">${ICON.cross(48)}<h1>Rời hub?</h1><div class="notice bad"><p>Đảo và mọi máy đã ghép của bạn sẽ bị xoá, quyền truy cập Google của hub bị thu hồi và bạn bị đăng xuất. ` +
    `Không thể hoàn tác.</p><p>Bạn vẫn có thể đăng nhập lại sau này để tạo đảo mới.</p></div>` +
    `<form method="post" action="/me/leave" class="row">${csrfField(csrf)}<button class="btn danger" type="submit">Rời hub</button>` +
    `<a class="btn ghost" href="/me">Quay lại</a></form></section>`);
}

function leftPage() {
  return layout('Đã rời hub', `<section class="card hero">${ICON.check()}<h1>Đã rời hub</h1>` +
    `<p class="muted">Đảo và các máy của bạn đã được xoá. Bạn có thể đăng nhập lại bất cứ lúc nào.</p>` +
    `<a class="btn ok wide" href="/auth/login">Đăng nhập lại</a></section>`);
}

// Friendly page for errors a browser lands on. API callers keep the plain-text body.
const ERROR_TEXT = {
  'this account is not allowed to sign in': 'Tài khoản này không được phép đăng nhập vào hub.',
  'login expired, try again': 'Lượt đăng nhập đã hết hạn. Thử đăng nhập lại.',
  'login not started in this browser': 'Đăng nhập phải bắt đầu và kết thúc trên cùng một trình duyệt. Thử lại từ đầu.',
  'sign-in failed': 'Google không xác nhận được lượt đăng nhập này. Thử lại.',
  'could not reach Google': 'Hub không liên lạc được với Google. Thử lại sau ít phút.',
  'too many requests': 'Bạn thao tác hơi nhanh. Đợi một chút rồi thử lại.',
  'not signed in': 'Bạn chưa đăng nhập.',
  forbidden: 'Phiên làm việc đã đổi. Tải lại trang rồi thử lại.',
  'not found': 'Không có trang này.',
};
function errorPage(status, message) {
  const title = status === 404 ? 'Không tìm thấy' : status === 429 ? 'Chậm lại một chút' : status === 403 || status === 401 ? 'Không vào được'
    : status >= 500 ? 'Hub đang gặp sự cố' : 'Có gì đó chưa đúng';
  const text = ERROR_TEXT[message] || (status >= 500 ? 'Thử lại sau ít phút.' : 'Thử lại từ đầu.');
  const login = status === 400 || status === 401 || status === 403 ? `<a class="btn ok" href="/auth/login">Đăng nhập lại</a>` : '';
  return layout(title, `<section class="card hero">${status === 404 ? ICON.computer(64) : ICON.lock()}<h1>${escapeHtml(title)}</h1>` +
    `<p class="muted">${escapeHtml(text)}</p><div class="row" style="justify-content:center">${login}<a class="btn ghost" href="/">Về thế giới</a></div></section>`);
}

module.exports = { escapeHtml, devicePage, mePage, leavePage, leftPage, welcomePage, errorPage, ISLAND_COLORS, PAGE_CSP, NEW_DEVICE_MS, isNewDevice };
