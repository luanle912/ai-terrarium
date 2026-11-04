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

// mePage({csrf, user: {name, email}, island: {name, color} | null, devices: [{id, name, created_at, last_used_at, revoked_at}]})
const when = (t) => (t == null ? '-' : new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC');

function mePage({ csrf, user, island, devices = [] } = {}) {
  const c = escapeHtml(csrf);
  const isl = island
    ? `<p>Đảo của bạn: <strong style="border-left:.8rem solid ${escapeHtml(/^#[0-9a-fA-F]{6}$/.test(island.color) ? island.color : '#888')};padding-left:.4rem">${escapeHtml(island.name)}</strong></p>`
    : `<p>Bạn chưa có đảo. <a href="/device">Ghép máy đầu tiên</a> để tạo đảo.</p>`;
  const rows = devices.map((d) => {
    const revoked = d.revoked_at != null;
    const action = revoked
      ? `Đã thu hồi lúc ${escapeHtml(when(d.revoked_at))}`
      : `<form method="post" action="/me/devices/revoke"><input type="hidden" name="csrf" value="${c}">` +
        `<input type="hidden" name="device_id" value="${escapeHtml(d.id)}"><button type="submit">Thu hồi</button></form>`;
    return `<tr><td>${escapeHtml(d.name)}</td><td>${escapeHtml(when(d.created_at))}</td><td>${escapeHtml(when(d.last_used_at))}</td><td>${action}</td></tr>`;
  }).join('');
  const table = devices.length
    ? `<table><thead><tr><th>Máy</th><th>Tạo lúc</th><th>Dùng lần cuối</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    : '<p>Chưa có máy nào.</p>';
  return layout('Của tôi',
    `<h1>${escapeHtml((user && user.name) || 'Tôi')}</h1><p>${escapeHtml((user && user.email) || '')}</p>${isl}<h2>Máy</h2>${table}` +
    `<p><a href="/device">Ghép máy mới</a> &middot; <a href="/">Về thế giới</a></p>` +
    `<form method="post" action="/auth/logout"><input type="hidden" name="csrf" value="${c}"><button type="submit">Đăng xuất</button></form>`);
}

module.exports = { escapeHtml, devicePage, mePage, ISLAND_COLORS, PAGE_CSP };
