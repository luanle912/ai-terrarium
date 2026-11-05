'use strict';
// Server-rendered HTML pages. EVERY dynamic value goes through escapeHtml (S18).
// ISLAND_COLORS is the fixed 8-colour palette; an island's colour is ISLAND_COLORS[hash(user.id) % 8].

const ISLAND_COLORS = ['#e76f51', '#f4a261', '#e9c46a', '#8ab17d', '#2a9d8f', '#4a90d9', '#7b6cd9', '#d96ca8'];

const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]);

// Pages are static HTML with inline CSS only: no script at all.
const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

function layout(title, body) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;color:#222}` +
    `input[type=text]{font:inherit;padding:.4rem;letter-spacing:.15em;text-transform:uppercase}button{font:inherit;padding:.5rem 1rem;margin-right:.5rem;cursor:pointer}` +
    `.err{color:#b00020}.warn{background:#fff4d6;padding:.6rem .8rem;border-radius:6px}code{font-size:1.3em;letter-spacing:.15em}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:.3rem .4rem;border-bottom:1px solid #ddd;font-size:.9rem}td form{margin:0}</style></head><body>${body}</body></html>`;
}

// devicePage({csrf, error, device: {name, userCode, requestedAt}, done: 'approved'|'denied'})
// - no device: the form where the user TYPES the code (never prefilled, B10);
// - device: confirmation with name, time requested, code and the two buttons.
function devicePage({ csrf, error, device, done } = {}) {
  const err = error ? `<p class="err" role="alert">${escapeHtml(error)}</p>` : '';
  if (done) {
    return layout('Ghép máy', `<h1>${done === 'approved' ? 'Đã cho phép' : 'Đã từ chối'}</h1><p>${done === 'approved' ? 'Quay lại terminal, máy sẽ tự kết nối.' : 'Máy đó sẽ không được kết nối.'}</p>`);
  }
  if (device) {
    const when = new Date(device.requestedAt).toISOString();
    return layout('Ghép máy', `<h1>Ghép máy mới?</h1>${err}<p>Tên máy: <strong>${escapeHtml(device.name)}</strong></p>` +
      `<p>Yêu cầu lúc: ${escapeHtml(when)}</p><p>Mã: <code>${escapeHtml(device.userCode)}</code></p>` +
      `<p class="warn">Chỉ bấm Cho phép nếu bạn vừa chạy lệnh này trên máy của mình</p>` +
      `<form method="post" action="/device"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}">` +
      `<input type="hidden" name="user_code" value="${escapeHtml(device.userCode)}">` +
      `<button type="submit" name="action" value="approve">Cho phép</button><button type="submit" name="action" value="deny">Từ chối</button></form>`);
  }
  return layout('Ghép máy', `<h1>Ghép máy</h1>${err}<p>Gõ mã bạn thấy trên terminal.</p>` +
    `<form method="post" action="/device"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}">` +
    `<input type="text" name="user_code" autocomplete="off" autocapitalize="characters" maxlength="12" required> ` +
    `<button type="submit" name="action" value="lookup">Tiếp tục</button></form>`);
}

// mePage({csrf, user: {name, email}, island: {name, color} | null, colors, now,
//         devices: [{id, name, created_at, last_used_at, revoked_at}]})
const when = (t) => (t == null ? '-' : new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC');
const NEW_DEVICE_MS = 7 * 24 * 3600 * 1000; // a device paired this recently is flagged "Máy mới"
const isNewDevice = (d, now) => d.revoked_at == null && now - d.created_at < NEW_DEVICE_MS;
const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#888');

function mePage({ csrf, user, island, devices = [], colors = ISLAND_COLORS, now = Date.now() } = {}) {
  const c = escapeHtml(csrf);
  const revokeForm = (d) => `<form method="post" action="/me/devices/revoke"><input type="hidden" name="csrf" value="${c}">` +
    `<input type="hidden" name="device_id" value="${escapeHtml(d.id)}"><button type="submit">Thu hồi</button></form>`;
  const isl = island
    ? `<p>Đảo của bạn: <strong style="border-left:.8rem solid ${escapeHtml(safeColor(island.color))};padding-left:.4rem">${escapeHtml(island.name)}</strong></p>` +
      `<form method="post" action="/me/island"><input type="hidden" name="csrf" value="${c}">` +
      `<p><label>Tên đảo <input type="text" name="name" value="${escapeHtml(island.name)}" maxlength="24" required style="letter-spacing:0;text-transform:none"></label></p>` +
      `<p>${colors.map((col) => `<label style="margin-right:.6rem"><input type="radio" name="color" value="${escapeHtml(col)}"${col === island.color ? ' checked' : ''}> ` +
        `<span style="display:inline-block;width:1rem;height:1rem;vertical-align:middle;background:${escapeHtml(safeColor(col))}"></span></label>`).join('')}</p>` +
      `<button type="submit">Lưu</button></form>`
    : `<p>Bạn chưa có đảo. <a href="/device">Ghép máy đầu tiên</a> để tạo đảo.</p>`;
  const fresh = devices.filter((d) => isNewDevice(d, now)).map((d) =>
    `<div class="warn"><p>Máy mới: <strong>${escapeHtml(d.name)}</strong>, lúc ${escapeHtml(when(d.created_at))}</p>` +
    `<p>Không phải bạn ghép? Thu hồi ngay.</p>${revokeForm(d)}</div>`).join('');
  const rows = devices.map((d) => {
    const action = d.revoked_at != null ? `Đã thu hồi lúc ${escapeHtml(when(d.revoked_at))}` : revokeForm(d);
    return `<tr><td>${escapeHtml(d.name)}</td><td>${escapeHtml(when(d.created_at))}</td><td>${escapeHtml(when(d.last_used_at))}</td><td>${action}</td></tr>`;
  }).join('');
  const table = devices.length
    ? `<table><thead><tr><th>Máy</th><th>Tạo lúc</th><th>Dùng lần cuối</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    : '<p>Chưa có máy nào.</p>';
  return layout('Của tôi',
    `<h1>${escapeHtml((user && user.name) || 'Tôi')}</h1><p>${escapeHtml((user && user.email) || '')}</p>${fresh}${isl}<h2>Máy</h2>${table}` +
    `<p><a href="/device">Ghép máy mới</a> &middot; <a href="/">Về thế giới</a> &middot; <a href="/me/leave">Rời hub</a></p>` +
    `<form method="post" action="/auth/logout"><input type="hidden" name="csrf" value="${c}"><button type="submit">Đăng xuất</button></form>`);
}

function leavePage({ csrf } = {}) {
  return layout('Rời hub',
    `<h1>Rời hub?</h1><p class="warn">Đảo và mọi máy đã ghép của bạn sẽ bị xoá, quyền truy cập Google của hub bị thu hồi và bạn bị đăng xuất. ` +
    `Không thể hoàn tác. Bạn vẫn có thể đăng nhập lại sau này để tạo đảo mới.</p>` +
    `<form method="post" action="/me/leave"><input type="hidden" name="csrf" value="${escapeHtml(csrf)}"><button type="submit">Rời hub</button> <a href="/me">Quay lại</a></form>`);
}

function leftPage() {
  return layout('Đã rời hub', `<h1>Đã rời hub</h1><p>Đảo và các máy của bạn đã được xoá. Bạn có thể <a href="/auth/login">đăng nhập lại</a> bất cứ lúc nào.</p>`);
}

module.exports = { escapeHtml, devicePage, mePage, leavePage, leftPage, ISLAND_COLORS, PAGE_CSP, NEW_DEVICE_MS, isNewDevice };
