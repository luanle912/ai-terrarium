'use strict';
// Server-rendered HTML pages. EVERY dynamic value goes through escapeHtml (S18).
// ISLAND_COLORS is the fixed 8-colour palette; an island's colour is ISLAND_COLORS[hash(user.id) % 8].

const ISLAND_COLORS = ['#e76f51', '#f4a261', '#e9c46a', '#8ab17d', '#2a9d8f', '#4a90d9', '#7b6cd9', '#d96ca8'];

const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]);

// Pages are static HTML with inline CSS only: no script at all.
const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

function layout(title, body) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:30rem;margin:3rem auto;padding:0 1rem;color:#222}` +
    `input[type=text]{font:inherit;padding:.4rem;letter-spacing:.15em;text-transform:uppercase}button{font:inherit;padding:.5rem 1rem;margin-right:.5rem;cursor:pointer}` +
    `.err{color:#b00020}.warn{background:#fff4d6;padding:.6rem .8rem;border-radius:6px}code{font-size:1.3em;letter-spacing:.15em}</style></head><body>${body}</body></html>`;
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

module.exports = { escapeHtml, devicePage, ISLAND_COLORS, PAGE_CSP };
