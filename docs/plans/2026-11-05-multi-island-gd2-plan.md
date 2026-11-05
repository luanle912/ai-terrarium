# Multi-island GĐ2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm trọn GĐ2 ở §0 của spec: mất quyền tự động trong 24 giờ (B12), kiểm chữ ký JWKS, CSP theo hash + SRI +
HSTS, bảng giới hạn tốc độ đầy đủ, tự quản lý đảo trên web, "Xoá đảo" cho owner, "Máy mới", "Xem như người khác", cùng
các việc dời lại từ review GĐ1.

**Architecture:**
- Hub giữ nguyên khung GĐ1 (`createHub` + các module `routes(ctx)`). DB nâng lên phiên bản 2 bằng `PRAGMA user_version`.
- Thêm `hub/jwt.js` (JWKS), `hub/secret.js` (AES-256-GCM), `hub/accounts.js` (cấm, xoá đảo, rời hub, nhật ký),
  `hub/google-check.js` (kiểm hằng giờ), `hub/me.js` (route "của tôi" và owner), `hub/csp.js` (CSP theo hash).
- Không có vai trò trong DB: owner = email trong `HUB_OWNER_EMAILS`, tính ở mỗi request qua `ctx.helpers.isOwner(user)`.
- `claude-office.html` vẫn một file: thêm hàm thuần vào `world-logic`, sửa `world-view` (bảng "Của tôi", "Xoá đảo",
  "Thử lại", hiệu năng) và thêm "Xem như người khác" cho trang local.

**Tech Stack:** Node ≥ 22.13 cho hub (`node:sqlite`, `node:crypto`), Node ≥ 18 cho server local; `node:test`, `node:vm`;
React 18 UMD, Canvas 2D; Google OIDC (authorization code + PKCE, `access_type=offline`).

**Spec:** `docs/specs/2026-11-04-multi-island-design.md`. Phạm vi và các quyết định của anh Kiet ngày 2026-11-05 ở §0
(khối GĐ2); §0 ghi đè §2, C1, B6, §8.1, §9.5, §11.2, §12 ở mọi chỗ còn nói tới `admin` hay cấm bằng tay.

## Global Constraints

- Không thêm dependency, không bước build, không có `package.json` mới. Crypto chỉ dùng `node:crypto`.
- Hub cần **Node ≥ 22.13**. Server local và publisher vẫn chạy với Node ≥ 18.
- Không bump version, không sửa `.claude-plugin/plugin.json`. CHANGELOG ghi vào `## [Unreleased]`.
- `claude-office.html` vẫn là **một file**. Chế độ local (cổng 4317) phải **giống từng pixel** như trước, trừ khi task
  nói khác (chỉ Task 11 thêm công tắc trong Cài đặt; tắt thì vẫn giống từng pixel).
- Test và mọi lần chạy thử **không đụng cổng 4317 và `~/.claude-terrarium`**: dùng cổng ngẫu nhiên, thư mục tạm,
  `PORT=<khác>` và `dir` tạm cho config.
- Test chạy bằng `node --test tests/*.test.mjs`, luôn xanh sau mỗi task (GĐ1 kết thúc ở 262 test).
- Không có route `/admin` hay `/api/admin/*`. Không lưu vai trò trong DB. Owner không xoá được đảo của owner.
- Không có dữ liệu nào ngoài các trường ở spec §10.1 rời máy. Refresh token Google chỉ nằm trong DB ở dạng đã mã hoá,
  không bao giờ vào log, phản hồi HTTP hay nhật ký `audit`.
- Hằng số: refresh token mã hoá AES-256-GCM, khoá `HUB_SECRET_KEY` là 32 byte base64; kiểm Google mỗi giờ cho người có
  `checked_at` cũ hơn 24 giờ; cảnh báo sau 72 giờ lỗi liên tục; phiên không có refresh token sống 24 giờ, có thì 7 ngày;
  máy không có refresh token dừng nhận gói 24 giờ sau lần đăng nhập cuối; JWKS tải lại tối đa 1 lần/phút; SSE 5 luồng
  mỗi người, 300 toàn hub; "Mọi thứ khác" 120 request/phút mỗi IP; "Máy mới" hiện 7 ngày; tên đảo 1–24 ký tự.
- Comment trong code viết tiếng Anh. Chữ trên giao diện viết tiếng Việt. Mọi chuỗi của người khác hiển thị bằng
  `textContent`/React/canvas `fillText`, trang server-side đi qua `escapeHtml` (S18).
- Đồng bộ với `origin/main` (công cụ `sync_with_base_branch`) **trước Task 6, 8, 9, 10 và 11**, vì các task này sửa
  `claude-office.html`.

## Review Focus

1. **Nâng cấp một hub GĐ1 đang chạy.** Người dùng cũ chưa có refresh token: phiên bị rút về 24 giờ, máy nhận 403
   `login_required` (không phải 401) nên publisher **tạm dừng** chứ không tự đánh dấu `revoked`, và gửi lại ngay sau khi
   chủ máy đăng nhập lại. Test ở Task 1 (`a GĐ1 database is upgraded in place`), Task 3
   (`device of a user without refresh token gets 403 login_required after 24 h`) và Task 7
   (`403 login_required pauses without marking revoked`).
2. **Google lỗi mạng hoặc 5xx lúc kiểm hằng giờ.** Không ai bị cấm; chỉ một dòng cảnh báo sau 72 giờ. Test ở Task 4:
   `network error and 5xx do not ban; 72 h of errors writes one warning`.
3. **Google xoay khoá JWKS.** Token ký bằng `kid` mới vẫn qua sau đúng một lần tải lại; một loạt `kid` rác không làm hub
   gọi Google quá 1 lần/phút. Test ở Task 2: `a rotated key is fetched once` và `unknown kids refetch at most once a minute`.
4. **Mở hơn 5 tab.** Tab thứ 6 bị từ chối 429. Giao diện hiện lý do và nút "Thử lại", không hiện "Phiên đã hết" và không
   đẩy về trang đăng nhập. Test ở Task 6: `a sixth stream of one user is 429`; kiểm bằng tay ở Task 10 Step 4.
5. **`join` lại trên cùng máy trong lúc một gói cũ đang bay.** Token cũ bị thu hồi trên hub, cấu hình mới không bị đánh
   dấu `revoked` bởi 401 của token cũ. Test ở Task 7: `a 401 for an old token does not revoke a newer config` và
   `join revokes the previous token on the hub`.

---

### Task 1: DB phiên bản 2 (nâng cấp tại chỗ), nhật ký, sửa `approveDeviceCode`

**Files:**
- Modify: `hub/db.js`, `hub/auth.js` (bỏ `role` khỏi `upsertUser`/`setUserRole`), `hub/pairing.js` (kiểm kết quả duyệt)
- Create: `tests/hub-db-migrate.test.mjs`
- Modify: `tests/hub-base.test.mjs`, `tests/hub-auth.test.mjs` (bỏ test về `role` trong DB)

**Interfaces:**
- Produces (trên đối tượng `db` của `openDb(path)`):
  - `SCHEMA_VERSION = 2` (export từ `hub/db.js`). `openDb` chạy `SCHEMA` GĐ1 (giữ nguyên chuỗi), rồi `migrate(raw, Date.now())`
    trong một transaction theo `PRAGMA user_version`: 0 → 2. `user_version > 2` thì throw
    `Error('hub.sqlite is newer than this hub')`.
  - Migration 0 → 2: `ALTER TABLE users DROP COLUMN role`; thêm `users.refresh_enc TEXT`, `checked_at INTEGER`,
    `check_fail_since INTEGER`, `check_warned_at INTEGER`, `ban_reason TEXT`; `login_states.consent INTEGER NOT NULL DEFAULT 0`;
    `CREATE TABLE audit(...)` đúng §10.3 + `CREATE INDEX audit_at ON audit(at)`; rút phiên:
    `UPDATE sessions SET expires_at = MIN(expires_at, created_at + 86400000)` cho user có `refresh_enc IS NULL`.
  - `upsertUser({googleSub, email, name, now})` (không còn `role`). Bỏ `setUserRole`.
  - `setRefreshToken(userId, enc|null)`, `markChecked(userId, now)` (đặt `checked_at`, xoá `check_fail_since` và
    `check_warned_at`), `markCheckFailed(userId, now) => {failSince}` (giữ `check_fail_since` cũ nếu đã có),
    `setCheckWarned(userId, now)`, `usersDueForCheck(now, staleMs) => User[]` (chưa cấm, có `refresh_enc`,
    `checked_at` NULL hoặc cũ hơn `staleMs`, và có máy chưa thu hồi **hoặc** phiên chưa hết hạn).
  - `banUser(userId, reason, now) => boolean`, `liftBan(userId) => boolean` (xoá `banned_at` và `ban_reason`),
    `clearUserIdentity(userId)` (đặt `email`, `name`, `refresh_enc` về NULL). `setUserBanned` giữ làm bí danh của
    `banUser(id, null, at)` cho test cũ.
  - `sessionTokensForUser(userId) => string[]` (thay câu SQL thô trong `auth.js`).
  - `updateIsland(userId, {name, color}) => Island|undefined`.
  - `createLoginState({state, nonce, verifier, consent = 0, now})`.
  - `approveDeviceCode(codeHash, userId, now) => boolean`: `UPDATE … WHERE code_hash=? AND denied=0 AND
    approved_user_id IS NULL AND expires_at > ?`.
  - `addAudit({at, actorId = null, action, target = null, ip = null})`, `listAudit(limit = 200) => Row[]` (mới nhất trước).
  - `cleanup(now)` xoá thêm `audit` cũ hơn 180 ngày.

- [ ] **Step 1: Viết test hỏng** trong `tests/hub-db-migrate.test.mjs`. Test tự dựng DB GĐ1 bằng `DatabaseSync` với một
  hằng `GD1_SCHEMA` chép nguyên chuỗi `SCHEMA` hiện tại của `hub/db.js` (bản ở commit `1a3af72`).
  - `a GĐ1 database is upgraded in place`: DB GĐ1 có 1 user (`role:'owner'`), 1 đảo, 1 máy, 1 phiên `expires_at =
    created_at + 7 ngày`, 1 `login_states`. Sau `openDb`:
    `PRAGMA user_version` = 2; `PRAGMA table_info(users)` có `refresh_enc, checked_at, check_fail_since,
    check_warned_at, ban_reason` và **không** có `role`; user, đảo, máy giữ nguyên id và giá trị; phiên có
    `expires_at === created_at + 86400000`; bảng `audit` tồn tại; `login_states.consent` = 0.
  - `opening twice is a no-op`: mở lại cùng file → không throw, `user_version` vẫn 2, dữ liệu không đổi.
  - `a fresh database starts at version 2`.
  - `a newer database is refused`: đặt `PRAGMA user_version = 3` → `openDb` throw `/newer/`.
  - `approveDeviceCode only once, never when denied or expired`: lần 2 → `false`; mã đã `denyDeviceCode` → `false`;
    `now` ≥ `expires_at` → `false`.
  - `usersDueForCheck picks stale users with a device or a live session`: 4 user (mới kiểm, cũ + có máy, cũ + không gì,
    cũ + bị cấm) → chỉ trả user "cũ + có máy".
  - `audit rows are listed newest first and swept after 180 days`.

- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/hub-db-migrate.test.mjs` → FAIL (`SCHEMA_VERSION` undefined,
  thiếu cột).
- [ ] **Step 3: Cài đặt** theo Interfaces. `finishLogin` trong `auth.js` bỏ đoạn `setUserRole`. `POST /device` gọi
  `ensureIsland` rồi `db.approveDeviceCode(row.code_hash, s.user.id, now)`; `false` thì `recordWrong` và trả trang lỗi
  "Mã không đúng hoặc đã hết hạn." (400). Sửa comment đầu `hub/db.js` (không còn "minus audit").
- [ ] **Step 4: Chạy toàn bộ test.** `node --test tests/*.test.mjs` → PASS. Test `owner email gets owner role, others
  member` trong `hub-auth.test.mjs` được xoá ở đây; Task 3 thêm test thay thế qua `/api/config`.
- [ ] **Step 5: Commit** `feat: hub database v2 with audit log and in-place upgrade`

---

### Task 2: Kiểm chữ ký ID token bằng JWKS

**Files:**
- Create: `hub/jwt.js`, `tests/hub-jwt.test.mjs`
- Modify: `hub/auth.js` (callback dùng `ctx.jwks`), `hub/server.js` (tạo `ctx.jwks`), `tests/hub-helpers.mjs`,
  `tests/hub-auth.test.mjs` (token giả phải được ký)

**Interfaces:**
- Produces:
  - `GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs'`.
  - `createJwks({fetch, now, url = GOOGLE_JWKS, minRefetchMs = 60000}) => {getKey(kid): Promise<KeyObject|null>, verify(jwt): Promise<claims>}`.
    - Cache khoá theo `max-age` của `Cache-Control` (không có thì 1 giờ, tối đa 24 giờ). Hết hạn thì tải lại.
    - `kid` lạ: tải lại **chỉ khi** lần tải gần nhất cách ≥ `minRefetchMs`; nhiều lời gọi cùng lúc dùng chung một promise.
    - Khoá dựng bằng `crypto.createPublicKey({key: jwk, format: 'jwk'})`, chỉ nhận `kty:'RSA'`.
  - `verify(jwt)` throw `Error('jwt: <lý do>')` khi: không đủ 3 phần, header không phải JSON, `alg !== 'RS256'`, không
    có `kid`, `kid` không có trong JWKS, chữ ký sai (`crypto.verify('RSA-SHA256', header.payload, key, sig)`). Trả
    payload đã parse. Không kiểm claims (việc của `checkClaims`).
  - `auth.js`: bỏ `decodeJwtPayload`; callback gọi `await ctx.jwks.verify(body.id_token)`; lỗi → 403 như claims sai.
  - `createHub` đặt `ctx.jwks = createJwks({fetch: d.fetch, now: d.now})`.
  - `tests/hub-helpers.mjs` thêm `makeGoogle({now}) => google`:
    - `google.fetch(url, opts)`: giả ba endpoint, JWKS (`Cache-Control: max-age=3600`), token và
      `https://oauth2.googleapis.com/revoke`;
    - `google.sign(claims, {kid?, key?}) => jwt` ký RS256 bằng cặp khoá sinh trong test;
    - `google.rotate()`: sinh khoá mới với `kid` mới, JWKS chỉ còn khoá mới;
    - `google.claims`: claims cho lần đổi `code` kế tiếp; mặc định đúng `iss`, `aud`, `hd`, `email_verified`, còn
      `nonce` do `googleLogin` đặt từ tham số `nonce` trong URL chuyển hướng của `/auth/login`;
    - `google.onToken(params) => {status, body}`: ghi đè phản hồi token endpoint (mặc định: `authorization_code` trả
      `{id_token, refresh_token:'rt-<n>'}`, `refresh_token` trả `{access_token:'at'}`);
    - `google.calls`: mảng `{url, params}`; `google.jwksFetches`: số lần tải JWKS.
    - `startDevHub` nhận `opts.google`: cắm `google.fetch` vào `deps.fetch` và đặt thêm `GOOGLE_CLIENT_ID=test-client`,
      `GOOGLE_CLIENT_SECRET=test-secret` (dev login vẫn bật);
    - `googleLogin(url, google, email, {cookie?, name?}) => {cookie, csrf, redirects}`: chạy `/auth/login` →
      `/auth/callback` thật với `google`, đi theo một lần chuyển hướng `?consent=1` nếu có. Task 3 và Task 4 dùng hàm này.

- [ ] **Step 1: Viết test hỏng** trong `tests/hub-jwt.test.mjs` (khoá RSA sinh trong test, JWKS giả):
  - `a token signed by a JWKS key verifies`.
  - `a wrong signature is rejected`: ký bằng khoá khác nhưng cùng `kid`.
  - `alg none and HS256 are rejected`.
  - `a rotated key is fetched once`: cache có khoá 1, token ký bằng khoá 2 `kid` mới → qua, `jwksFetches` tăng đúng 1.
  - `unknown kids refetch at most once a minute`: 5 token `kid` rác trong 10 giây → `jwksFetches` tăng 1; sau 61 giây,
    thêm 1 token rác → tăng thêm 1.
  - `cache follows max-age`: sau 3601 giây, `verify` một token hợp lệ → tải lại 1 lần.
  - `concurrent unknown kids share one fetch`.
  - Trong `tests/hub-auth.test.mjs`: `callback refuses a token with a bad signature` (403, không có phiên).
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/hub-jwt.test.mjs` → FAIL, không tìm thấy module.
- [ ] **Step 3: Cài đặt** `hub/jwt.js`, cắm vào `auth.js` và `createHub`; chuyển `setup()` trong `hub-auth.test.mjs`
  sang `makeGoogle`. Sửa comment đầu `auth.js` (không còn "NOT verified").
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Commit** `feat: verify Google ID token signatures against the JWKS`

---

### Task 3: Refresh token mã hoá, luật phiên 24 giờ, vai trò từ env

**Files:**
- Create: `hub/secret.js`, `tests/hub-secret.test.mjs`
- Modify: `hub/config.js`, `hub/auth.js`, `hub/publish.js` (`bearerDevice`), `tests/hub-helpers.mjs` (thêm
  `HUB_SECRET_KEY` ngẫu nhiên), `tests/hub-base.test.mjs`, `tests/hub-auth.test.mjs`

**Interfaces:**
- Consumes: `db.setRefreshToken`, `db.markChecked`, `db.liftBan`, `db.addAudit`, `createLoginState({consent})` (Task 1);
  `ctx.jwks`, `makeGoogle` (Task 2).
- Produces:
  - `loadConfig`: `HUB_SECRET_KEY` **bắt buộc** (cả khi dev), base64 giải ra đúng 32 byte, ngược lại lỗi chứa
    `HUB_SECRET_KEY`. `config.secretKey: Buffer`.
  - `hub/secret.js`: `seal(key: Buffer, plaintext: string, aad: string) => string` dạng `v1.<base64url(iv12|tag16|ct)>`;
    `open(key, sealed, aad) => string`, throw khi sai khoá, sai `aad`, bị sửa, sai dạng. `aad` dùng `'user:' + userId`.
  - `/auth/login`: thêm `access_type=offline`; `?consent=1` thì `prompt=consent` và lưu `consent:1` vào `login_states`.
  - `/auth/callback`:
    - có `refresh_token` → `db.setRefreshToken(id, seal(...))`;
    - không có, user chưa có `refresh_enc`, và `row.consent === 0` → 302 tới `/auth/login?consent=1` (không tạo phiên);
    - còn lại → đăng nhập bình thường.
  - `finishLogin(req, res, who)`:
    - user bị cấm với `ban_reason === 'google_revoked'` → `db.liftBan`, audit `ban_lifted`, đăng nhập tiếp; cấm lý do
      khác → 403 như cũ;
    - `db.markChecked(id, now)`;
    - phiên hết hạn sau 7 ngày nếu có `refresh_enc`, ngược lại 24 giờ;
    - **cookie phiên cũ trong request** (nếu có) bị `endSession(..., 'relogin')` trước khi tạo phiên mới.
  - Hằng `NO_REFRESH_TTL_MS = 24 * 3600 * 1000` export từ `auth.js`.
  - `ctx.helpers.isOwner(user) => boolean`: `config.ownerEmails.includes(String(user.email).toLowerCase())`.
  - `GET /api/config` → `me: {id, name, email, islandId, role: 'owner'|'member'}`.
  - `bearerDevice` trong `publish.js`: user không có `refresh_enc` và `now - last_login_at > NO_REFRESH_TTL_MS` →
    `sendJson(res, 403, {error: 'login_required'})`. Máy thu hồi / user bị cấm vẫn 401.

- [ ] **Step 1: Viết test hỏng**
  - `tests/hub-secret.test.mjs`: `seal then open round-trips`; `two seals of the same text differ`;
    `open rejects a wrong key, a wrong aad and a flipped byte`.
  - `tests/hub-base.test.mjs`: `HUB_SECRET_KEY is required and must be 32 bytes` (thiếu, 16 byte, không phải base64 → throw
    `/HUB_SECRET_KEY/`); có trong danh sách "lists every missing variable at once".
  - `tests/hub-auth.test.mjs`:
    - `login asks for offline access`: `location` chứa `access_type=offline` và `prompt=select_account`;
    - `callback stores the refresh token encrypted`: cột `refresh_enc` không chứa `rt-1`; `open(...)` ra `rt-1`;
    - `no refresh token: one consent retry, then a 24 h session`: lần 1 → 302 `/auth/login?consent=1`; login đó có
      `prompt=consent`; lần 2 vẫn không có → phiên, `expires_at - created_at === 86400000`;
    - `a session with a refresh token lasts 7 days`;
    - `logging in again ends the previous session of this browser`: gửi kèm cookie phiên cũ → phiên cũ không còn trong
      DB, luồng SSE của nó bị đóng;
    - `a google_revoked ban is lifted by a fresh login` (có dòng audit `ban_lifted`); `a ban without reason stays` (403);
    - `api config role follows env`: `boss@newera.inc` → `owner`, người khác → `member`; đổi `ownerEmails` trên
      `config` của hub đang chạy → lần gọi sau đổi theo.
  - `tests/hub-world.test.mjs`: `device of a user without refresh token gets 403 login_required after 24 h`: dev login,
    `pairDevice`, `clock.advance(24h + 1)` → publish 403 `{error:'login_required'}`; dev login lại → publish 204.
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/hub-*.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces.
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Commit** `feat: keep an encrypted Google refresh token and limit sessions without one to 24 h`

---

### Task 4: Hành động tài khoản và kiểm Google hằng giờ (B12)

**Files:**
- Create: `hub/accounts.js`, `hub/google-check.js`, `tests/hub-google-check.test.mjs`
- Modify: `hub/server.js` (tạo `ctx.accounts`, `ctx.googleCheck`, hẹn giờ mỗi giờ), `hub/auth.js` (`checkClaims`
  nhận `requireNonce`)

**Interfaces:**
- Consumes: Task 1–3; `ctx.helpers.endSessionsForUser`, `ctx.world.removeIsland`.
- Produces:
  - `createAccounts(ctx) => accounts`, gán vào `ctx.accounts` trong `createHub` (trước khi dựng route; các hàm đọc
    `ctx.helpers` lúc được gọi):
    - `audit(action, {actorId = null, target = null, ip = null} = {})`;
    - `revokeGoogle(userId) => Promise<void>`: giải mã, POST `https://oauth2.googleapis.com/revoke` (form `token=`,
      timeout 10 giây), **luôn** `setRefreshToken(id, null)` dù Google trả gì. Lỗi giải mã cũng chỉ xoá;
    - `banUser(userId, reason, {actorId} = {}) => Promise<void>`: `db.banUser`, `revokeDevicesForUser`,
      `endSessionsForUser(id, 'banned')`, `world.removeIsland(island.id)` (giữ bản ghi `islands`), `revokeGoogle`,
      audit `user_banned` với `target = 'user:<id> ' + reason`;
    - `removeIslandOf(userId, {actorId, ip}) => boolean`: `revokeDevicesForUser`, `world.removeIsland`,
      `db.deleteIslandByUser`, audit `island_removed` (`target = 'island:<id> user:<id>'`). `false` khi không có đảo;
    - `leave(userId, {ip}) => Promise<void>`: `removeIslandOf`, `endSessionsForUser(id, 'left')`, `revokeGoogle`,
      `clearUserIdentity`, audit `user_left`.
  - `checkClaims(claims, {clientId, domains, nonce, now, requireNonce = true})`: `requireNonce:false` bỏ kiểm `nonce`.
  - `createGoogleCheck(ctx) => {runOnce(): Promise<{checked, banned, failed}>}`, gán `ctx.googleCheck`. Không làm gì khi
    `config.googleClientId` rỗng. Với mỗi user trong `db.usersDueForCheck(now, 24h)`, tuần tự:
    - `open` lỗi → `setRefreshToken(id, null)` + audit `refresh_unreadable` (user rơi về luật 24 giờ, không cấm);
    - POST token endpoint `grant_type=refresh_token` (timeout 10 giây);
    - 400 hoặc 401 với `error === 'invalid_grant'` → `banUser(id, 'google_revoked')`;
    - 200 có `id_token` → `jwks.verify` + `checkClaims({requireNonce:false})` + `sub` bằng `google_sub` của user; hỏng
      → `banUser(id, 'google_revoked')`; qua (hoặc 200 không có `id_token`) → `markChecked`;
    - lỗi mạng, 5xx, hay mã khác → `markCheckFailed`; nếu `now - failSince ≥ 72h` và `check_warned_at` NULL → audit
      `google_check_failing` (`target = 'user:<id>'`) + `setCheckWarned`.
  - Owner trong env bị cấm như mọi người (Task 3 đã gỡ cấm khi đăng nhập lại).

- [ ] **Step 1: Viết test hỏng** trong `tests/hub-google-check.test.mjs`. Tạo user có refresh token bằng `googleLogin`
  (Task 2), ghép máy và publish để đảo có trong RAM, mở một luồng SSE.
  - `invalid_grant bans with google_revoked`: `clock.advance(25h)`, `runOnce()` → user có `banned_at` và
    `ban_reason='google_revoked'`; phiên bị xoá; luồng SSE của chính họ bị đóng; luồng của người xem khác nhận `remove`;
    publish bằng token máy → 401; `refresh_enc` NULL; `google.calls` có một lời gọi `/revoke`; `listAudit()` có
    `user_banned`.
  - `network error and 5xx do not ban; 72 h of errors writes one warning`: `fetch` throw rồi 503, chạy mỗi giờ trong 73
    giờ → không cấm; đúng **một** dòng `google_check_failing`; sau đó một lần thành công → `check_fail_since` NULL.
  - `a refreshed id token from another domain bans`: `onToken` trả `id_token` có `hd:'gmail.com'`.
  - `success updates checked_at and fresh users are skipped`: chạy hai lần liền → lần hai `checked === 0`.
  - `users without a session or device are not checked`.
  - `an env owner is banned too and a fresh login lifts it`.
  - `an unreadable refresh token is dropped, not banned`: ghi `refresh_enc = 'v1.rác'`.
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/hub-google-check.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces. `createHub` thêm `setInterval(() => ctx.googleCheck.runOnce().catch(() =>
  log('google check failed')), HOUR).unref()` và dọn trong `close()`. Không log email, token hay nội dung phản hồi.
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Commit** `feat: lose access within 24 h when Google revokes a user`

---

### Task 5: "Của tôi" trên hub (API JSON, trang `/me`, rời hub) và "Xoá đảo" cho owner

**Files:**
- Create: `hub/me.js`, `tests/hub-me.test.mjs`
- Modify: `hub/server.js` (thêm `require('./me.js').routes` vào `ROUTE_MODULES`), `hub/publish.js` (chuyển `GET /me`
  và `POST /me/devices/revoke` sang `me.js`), `hub/world.js`, `hub/pages.js`, `hub/validate.js`, `hub/pairing.js`
  (audit `device_paired`)

**Interfaces:**
- Consumes: `ctx.accounts` (Task 4), `ctx.helpers.isOwner` (Task 3), `db.updateIsland` (Task 1).
- Produces:
  - `World.devicesOf(islandId) => [{deviceId, online, share, private}]`; `World.setIslandMeta(id, {name, color})` phát
    `world` khi đổi.
  - `validIslandName(s) => string|null` trong `validate.js`: `normalize('NFC')`, gộp khoảng trắng, trim; hợp lệ khi khớp
    `/^[\p{L}\p{M}\p{N} ._-]{1,24}$/u`.
  - `GET /api/me` → `{island: {id, name, color}|null, colors: ISLAND_COLORS, devices: DeviceInfo[]}` với
    `DeviceInfo = {id, name, createdAt, lastUsedAt, revokedAt, isNew, send: 'sending'|'private'|'offline'|'revoked', share: 'kin'|'co-ban'|null}`.
    `isNew` khi chưa thu hồi và `now - createdAt < 7 ngày`. `send` lấy từ `world.devicesOf`; máy không có trong RAM là
    `offline`.
  - `POST /api/me/island` JSON `{name?, color?}` (CSRF header) → 200 `{island}`; tên sai hoặc màu không thuộc
    `ISLAND_COLORS` → 400; chưa có đảo → 404. `POST /me/island` (form, CSRF field) → 302 `/me`. Cả hai gọi
    `db.updateIsland`, `world.setIslandMeta`, audit `island_updated`.
  - `POST /api/me/devices/:id/revoke` (regex `^/api/me/devices/([0-9a-f]{16})/revoke$`) → 200 `{ok:true}` hoặc 404.
    Form `POST /me/devices/revoke` giữ như GĐ1. Cả hai audit `device_revoked`.
  - `GET /me/leave` → `leavePage({csrf})` (cảnh báo + nút "Rời hub"); `POST /me/leave` (form) →
    `accounts.leave(user.id)`, xoá cookie phiên, 200 `leftPage()`.
  - `POST /api/owner/islands/:id/remove` (regex `^/api/owner/islands/([0-9a-f]{16})/remove$`, CSRF header):
    không phải owner → 403 `{error:'forbidden'}`; không có đảo → 404; chủ đảo là owner (gồm chính mình) → 403
    `{error:'owner_island'}`; còn lại `accounts.removeIslandOf(target, {actorId: me.id, ip})` → 200 `{ok:true}`.
  - `pages.js`: `mePage({csrf, user, island, devices, colors, now})` thêm khối "Máy mới: <tên>, lúc <giờ>" cho máy
    `isNew` (kèm nút thu hồi), form đổi tên/màu (8 nút radio màu), link "Rời hub" tới `/me/leave`;
    `leavePage({csrf})`, `leftPage()`. Mọi giá trị qua `escapeHtml`.
  - Audit `device_paired` (`target = 'device:<id>'`) khi `/api/device/token` trả token.

- [ ] **Step 1: Viết test hỏng** trong `tests/hub-me.test.mjs` (dùng `startDevHub`, `devLogin`, `pairDevice`):
  - `api me lists devices with their send state`: hai máy, một publish `private:true`, một không publish, một thu hồi →
    `send` lần lượt `private`, `offline`, `revoked`; máy vừa ghép có `isNew:true`; sau `clock.advance(7 ngày)` →
    `isNew:false`.
  - `renaming the island updates viewers`: POST `/api/me/island` `{name:'Đảo Mây', color:'#2a9d8f'}` → 200; luồng SSE
    nhận `world` có tên mới; audit `island_updated`.
  - `island names are checked`: `''`, 25 ký tự, `'<b>'`, màu `'#000000'` → 400; `'Đảo  Mây '` lưu thành `'Đảo Mây'`.
  - `island and revoke APIs need csrf and origin` (403).
  - `revoking through the API removes the device and its island`: luồng nhận `remove`.
  - `me page shows the new-device notice escaped`: máy tên `<img>` → trang có `Máy mới: &lt;img&gt;`.
  - `leaving deletes island, devices and sessions but keeps the user row`: sau `POST /me/leave` → `email`, `name` NULL,
    `google_sub` còn, đảo không còn, publish 401, cookie bị xoá, audit `user_left`; đăng nhập lại được.
  - `an owner removes a member's island`: `boss@newera.inc` gọi remove → 200; luồng nhận `remove`; publish của máy đó
    401; user đó vẫn `devLogin` được, ghép lại thì có đảo **id mới**; audit `island_removed` có `actor_id` của owner.
  - `owners cannot remove an owner's island, members cannot remove anything`: hub với
    `HUB_OWNER_EMAILS=boss@newera.inc,boss2@newera.inc` → boss xoá đảo boss2 → 403 `owner_island`; boss xoá đảo chính
    mình → 403 `owner_island`; member → 403 `forbidden`.
  - `pairing writes device_paired to the audit log`.
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/hub-me.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces. Body JSON tối đa 4KB (S15).
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Commit** `feat: manage my island on the web and let owners remove an island`

---

### Task 6: CSP theo hash, SRI cho React, HSTS, bảng giới hạn tốc độ đầy đủ, giới hạn luồng SSE

Trước task: đồng bộ với `origin/main`.

**Files:**
- Create: `hub/csp.js`, `tests/hub-hardening.test.mjs`
- Modify: `hub/http.js`, `hub/server.js`, `hub/publish.js`, `hub/auth.js`, `hub/pairing.js`, `claude-office.html`
  (chỉ thêm thuộc tính cho hai thẻ `<script src>` React)

**Interfaces:**
- Produces:
  - `hub/csp.js`:
    - `inlineScriptHashes(html) => string[]`: mỗi thẻ `<script>` **không** có `src` → `'sha256-' + base64(sha256(nội dung
      giữa thẻ mở và thẻ đóng))`;
    - `officeCsp(hashes) => string`: đúng S13, `script-src` là các hash + `https://cdnjs.cloudflare.com`, không có
      `'unsafe-inline'`;
    - `createOfficePage(file) => {get(): {body: Buffer, csp: string}}`: đọc lại và tính lại khi `mtimeMs` đổi.
  - `publish.js` `GET /` dùng `createOfficePage(OFFICE_FILE)`; bỏ `OFFICE_CSP`.
  - `http.js`: `SECURITY_HEADERS` thêm `Cross-Origin-Opener-Policy: same-origin`; `createRouter(routes, {log, now,
    hsts})`: `hsts` true thì mọi phản hồi có `Strict-Transport-Security: max-age=31536000`. `createHub` truyền
    `hsts: config.secure`.
  - Route có thêm cờ `ownLimit: true` cho `/api/publish`, `/api/device/start`, `/api/device/token`, `/auth/login`.
    `createHub` bọc handler của mọi route **không** có cờ bằng `limiters.general = createLimiter({rate: 2, burst: 120})`
    theo IP → 429 kèm `Retry-After: 30`.
  - `/api/world/stream`: `STREAMS_PER_USER = 5` → 429, `STREAMS_TOTAL = 300` → 503, trả **trước** `writeHead` của SSE.
    `createHub` nhận `deps.streamLimits = {perUser, total}` để test dùng số nhỏ.
  - `claude-office.html`: hai thẻ React có `integrity="sha384-…"` và `crossorigin="anonymous"`. Hash lấy bằng
    `curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A`.

- [ ] **Step 1: Viết test hỏng** trong `tests/hub-hardening.test.mjs`:
  - `every inline script of the page is hashed into script-src`: đọc `claude-office.html`, số hash = số thẻ `<script>`
    không có `src`; CSP của `GET /` (sau dev login) chứa từng hash, chứa `frame-ancestors 'none'`, `base-uri 'none'`,
    `form-action 'self'`, và `script-src` không có `'unsafe-inline'`.
  - `csp follows the file after an edit`: `createOfficePage` trên bản sao tạm; sửa một khối script, đổi `mtime` → hash mới.
  - `react tags carry integrity and crossorigin`: cả hai thẻ cdnjs khớp `integrity="sha384-[A-Za-z0-9+/=]{64}"` và
    `crossorigin="anonymous"`.
  - `hsts only on https`: hub `https://…` → có header; dev hub `http://127.0.0.1` → không có.
  - `responses carry cross-origin-opener-policy`.
  - `other routes are limited to 120 a minute per ip`: 121 lần `GET /api/config` → lần cuối 429; `POST /api/publish` vẫn
    theo hạn mức riêng (không bị 429 vì giới hạn chung).
  - `a sixth stream of one user is 429`; `the hub-wide stream cap is 503` (`streamLimits: {perUser: 5, total: 3}`).
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/hub-hardening.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces.
- [ ] **Step 4: Kiểm bằng tay.** Dev hub (`HUB_PORT` ngẫu nhiên, DB tạm), mở trang hub trong trình duyệt tích hợp →
  console không có lỗi CSP hay SRI, thế giới hiện bình thường. Mở trang local bằng một server local ở cổng khác 4317
  (`PORT=4399 node server.js`, với `HOME` trỏ thư mục tạm) → React tải được qua SRI.
- [ ] **Step 5: Chạy toàn bộ test** → PASS.
- [ ] **Step 6: Commit** `feat: hash-based CSP, SRI for React, HSTS and the full rate-limit table`

---

### Task 7: Publisher, server local và các sửa dời lại

**Files:**
- Modify: `lib/publisher.js`, `lib/terrarium-config.js`, `lib/public-view.js`, `server.js`, `hub/pairing.js`,
  `hub/world.js`
- Test: `tests/publisher.test.mjs`, `tests/terrarium-config.test.mjs`, `tests/public-view.test.mjs`,
  `tests/server-local.test.mjs`, `tests/hub-pairing.test.mjs`, `tests/hub-world.test.mjs`

**Interfaces:**
- Consumes: `ctx.accounts.audit` (Task 4); 403 `login_required` (Task 3).
- Produces:
  - Hub `POST /api/device/revoke-self` (Bearer, bỏ qua cookie, chịu giới hạn chung 120/phút của Task 6): máy còn hiệu lực → thu hồi,
    `world.removeDevice`, audit `device_revoked` (`actorId` null) → 204; token lạ hay đã thu hồi → 401.
  - `publisher.js`:
    - 401: chỉ ghi `revoked:true` khi `readConfig(dir).token === token đã dùng cho lần gửi đó`; khác thì chỉ nạp lại cấu
      hình;
    - 403 với body `{error:'login_required'}` → trạng thái mới `'paused'`, chờ `LOGIN_WAIT_MS = 300000`, log một lần
      `terrarium: sign in to <hub> again to resume publishing`; 403 khác → như lỗi 5xx;
    - `state()` có thể trả `'paused'`;
    - `revokeSelf(hub, token, {fetch}) => Promise<boolean>` (timeout 5 giây, không throw);
    - `join(...)`: đọc cấu hình cũ trước khi bắt đầu; sau khi **ghi xong** cấu hình mới, nếu cấu hình cũ có `token` và
      không `revoked` thì `revokeSelf(old.hub, old.token)`.
  - `runCommand(['leave'], {revokeSelf})`: còn cấu hình và chưa `revoked` thì gọi `deps.revokeSelf(cfg.hub, cfg.token)`
    trước khi xoá file; in `Revoked this device on the hub.` hoặc `Could not reach the hub; revoke this device at
    <hub>/me.` (tiếng Anh như các dòng log khác của lệnh con). `server.js` truyền `revokeSelf` thật.
  - `public-view.js`: project thứ 17 trở đi dùng chung chữ `P` (không quay về `A`).
  - `world.js`: nhãn phòng `roomLabel(n)`: `A`…`Z`, rồi `A2`…`Z2`, `A3`… (không quay vòng).
  - `server.js`:
    - comment dòng 4 sửa thành `ACTIVE_MIN (120)`;
    - export `makePublicPreview({publisher, getSnapshot, salt}) => () => Object`: có publisher và `publisher.view()` khác
      null thì `{...publisher.state(), view}`; ngược lại `{state: publisher ? publisher.state().state : 'off', view}` với
      `view` = `createPublicView(salt)(getSnapshot(), {share:'kin', projects:[], private:false})`. `main()` sinh `salt`
      bằng `crypto.randomBytes(32).toString('hex')` lúc khởi động, chỉ giữ trong RAM.

- [ ] **Step 1: Viết test hỏng**
  - `tests/publisher.test.mjs`:
    - `a 401 for an old token does not revoke a newer config`: fetch giả giữ phản hồi 401; trong lúc đó ghi cấu hình mới
      với token khác; thả 401 → file không có `revoked`, publisher gửi bằng token mới;
    - `403 login_required pauses without marking revoked`: `state().state === 'paused'`, file không có `revoked`, không gửi
      lại trước 300 giây, sau đó 204 → `sending`; log `sign in` đúng một dòng;
    - `join revokes the previous token on the hub`: cấu hình cũ token `trd_old` → sau `join` thành công có một lời gọi
      `/api/device/revoke-self` với `Bearer trd_old`, xảy ra **sau** khi file mới đã ghi;
    - `join with no previous config revokes nothing`.
  - `tests/terrarium-config.test.mjs`: `leave revokes on the hub first`; `leave still removes the file when the hub is
    unreachable`.
  - `tests/hub-pairing.test.mjs`: `revoke-self revokes only the calling device` (máy thứ hai vẫn publish 204, audit
    `device_revoked`); `revoke-self ignores cookies` (cookie phiên, không Bearer → 401).
  - `tests/public-view.test.mjs`: `the 17th project shares the last room instead of wrapping to A`.
  - `tests/hub-world.test.mjs`: `more than 16 letter rooms over two machines keep distinct labels` (2 máy × 12 chữ → 24
    nhãn khác nhau).
  - `tests/server-local.test.mjs`: `preview works before joining`: `makePublicPreview({publisher: null, getSnapshot,
    salt})()` → `state:'off'`, `view.sessions[0].id` khớp `/^[0-9a-f]{12}$/`, `JSON.stringify` không chứa `cwd` hay tên
    session; gọi hai lần cho cùng id.
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/publisher.test.mjs tests/public-view.test.mjs tests/server-local.test.mjs tests/hub-pairing.test.mjs tests/hub-world.test.mjs tests/terrarium-config.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces.
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Commit** `fix: publisher pauses for re-login, re-join revokes the old token, rooms past 16 projects`

---

### Task 8: `world-logic`: hàm thuần cho ngân sách vẽ và "Xem như người khác"

Trước task: đồng bộ với `origin/main`.

**Files:**
- Modify: `claude-office.html` (chỉ khối `<script id="world-logic">`)
- Test: `tests/world-logic.test.mjs`

**Interfaces:**
- Produces trên `globalThis.WorldLogic`:
  - `THUMB_PX = 120`; `lodFor` dùng hằng này (Task 9 có thể chỉnh).
  - `pickRedraws(due: {id, drawnAt}[], budget) => Set<id>`: `drawnAt` nhỏ nhất trước (đảo chưa từng vẽ có
    `drawnAt = -Infinity`), lấy `budget` phần tử; **không** có ngoại lệ cho đảo chưa có canvas.
  - `clientSessions(publicSessions) => ClientSession[]`: đổi `{id, parent, status, waitingOn, talkingTo, dept, kind,
    tool?, model?}` thành `{id, parentId: parent, status, waitingOn, talkingTo, project: dept, kind, tool?, model?}`;
    bỏ phần tử không có `id` chuỗi; không thêm khoá nào khác.

- [ ] **Step 1: Viết test hỏng**
  - `lodFor uses THUMB_PX`: `lodFor(WorldLogic.THUMB_PX, 1000) === 'mid'`, `lodFor(WorldLogic.THUMB_PX - 1, 1000) === 'thumb'`.
  - `pickRedraws takes the longest-waiting first and never exceeds the budget`: 10 đảo chưa vẽ, budget 2 → đúng 2.
  - `never-drawn islands queue like the others`: 1 đảo `drawnAt: 5`, 3 đảo `-Infinity`, budget 2 → 2 đảo `-Infinity`.
  - `clientSessions maps a public view`: khoá ra đúng tập trên; `tool`/`model` chỉ có khi đầu vào có.
- [ ] **Step 2–4:** chạy hỏng → cài đặt → `node --test tests/world-logic.test.mjs` xanh, rồi toàn bộ test xanh.
- [ ] **Step 5: Commit** `feat: world logic for the redraw budget and the public preview`

---

### Task 9: Hiệu năng "Toàn cảnh" và cú giật khi đổi chế độ

Trước task: đồng bộ với `origin/main`.

**Files:**
- Modify: `claude-office.html` (khối `world-view`, có thể `THUMB_PX` trong `world-logic`),
  `docs/specs/2026-11-04-multi-island-design.md` (§12.3, ghi số chốt)
- Test: đo bằng Chrome headless (script ở scratchpad, không commit)

**Interfaces:**
- Consumes: `WorldLogic.pickRedraws`, `WorldLogic.THUMB_PX` (Task 8).
- Produces:
  - `drawWorld`: đảo không còn được vẽ chỉ `releaseCanvas` khi `sc.lod === 'full'`; canvas `mid`/`thumb` giữ lại.
  - Ngân sách vẽ mỗi khung dùng `pickRedraws` cho **mọi** đảo đến hạn, kể cả `sc.k == null`. Đảo chưa có canvas mà
    chưa tới lượt thì khung đó chưa vẽ (không có nhãn).
  - `MID_MS` trong `[100, 200]`, `THUMB_PX` trong `[120, 160]`, chọn giá trị **nhỏ nhất** đạt mục tiêu.

- [ ] **Step 1: Đo trước khi sửa.** Dev hub ở cổng ngẫu nhiên, script tạo 10 đảo × 6 session (ghép máy + publish như
  GĐ1 Task 10). Chrome headless `--disable-gpu` (render phần mềm, cùng cách GĐ1), 1280×800, "Toàn cảnh", đo JS mỗi
  khung trong 10 giây → ghi p95. Rồi đổi "Của tôi" → "Toàn cảnh" 5 lần, ghi khung dài nhất trong 500ms sau mỗi lần đổi.
  Expected: p95 khoảng 9ms; có khung > 16ms lúc đổi.
- [ ] **Step 2: Sửa giữ canvas và ngân sách vẽ.** Đo lại như Step 1.
- [ ] **Step 3: Chỉnh `MID_MS` rồi `THUMB_PX`** theo thứ tự đó, mỗi lần đo lại, dừng khi đạt.
  Expected: p95 ≤ 8ms; không khung nào > 16ms trong 500ms sau khi đổi chế độ. Đảo đang xem vẫn vẽ `full` mọi khung.
- [ ] **Step 4: Kiểm bằng mắt** 1, 5, 10 đảo, sáng và tối; đảo `mid` vẫn đổi trạng thái sau tối đa `MID_MS` cộng một
  khung.
- [ ] **Step 5: Ghi số chốt** (`MID_MS`, `THUMB_PX`, p95 trước/sau) vào §12.3 của spec.
- [ ] **Step 6: Chạy toàn bộ test** → PASS (test `lodFor` dùng `THUMB_PX` nên vẫn xanh nếu hằng đổi).
- [ ] **Step 7: Commit** `perf: keep small island canvases and spread first draws over frames`

---

### Task 10: Bảng "Của tôi", "Xoá đảo" cho owner, "Thử lại"

Trước task: đồng bộ với `origin/main`.

**Files:**
- Modify: `claude-office.html` (khối `world-view`)
- Test: kiểm bằng tay trên dev hub

**Interfaces:**
- Consumes: `GET /api/me`, `POST /api/me/island`, `POST /api/me/devices/:id/revoke`,
  `POST /api/owner/islands/:id/remove` (Task 5); `me.role` (Task 3); 429/503 luồng (Task 6).
- Produces (method trên `ClaudeOffice.prototype` trong `world-view`):
  - `loadMe()`: `GET /api/me`, lưu vào `this.world.mine`; gọi khi vào "Của tôi", mỗi 10 giây khi đang ở đó, và sau
    mỗi thao tác. Lỗi thì giữ dữ liệu cũ và hiện "Không tải được danh sách máy".
  - `postJson(path, body) => Promise<{status, data}>`: `credentials:'same-origin'`, header `X-CSRF-Token: cfg.csrf`,
    `Content-Type: application/json`.
  - Bảng "Của tôi" (khi có đảo), từ trên xuống:
    - thông báo "Máy mới: <tên>, lúc <giờ>" cho mỗi máy `isNew`, nút "Thu hồi" → hỏi lại trong bảng ("Thu hồi <tên>?"
      + "Thu hồi" / "Huỷ");
    - ô tên đảo (`maxLength` 24) + 8 ô màu từ `colors` + nút "Lưu"; lỗi 400 hiện "Tên 1–24 ký tự: chữ, số, khoảng
      trắng, - _ .";
    - danh sách máy: tên, trạng thái gửi (`sending` "Đang gửi", `private` "Riêng tư", `offline` "Mất kết nối",
      `revoked` "Đã thu hồi"), mức chia sẻ, nút "Thu hồi" (cùng bước hỏi lại) cho máy chưa thu hồi;
    - các link cũ, cộng link "Rời hub" tới `/me/leave`.
  - "Toàn cảnh": khi `me.role === 'owner'` và đảo đang chọn không phải của mình, bảng đảo có nút "Xoá đảo" → bảng đổi
    thành "Xoá đảo này? Mọi máy của người đó bị thu hồi. Họ vẫn ghép lại được." + "Xoá" / "Huỷ". 403 `owner_island` →
    "Không xoá được đảo của owner."; thành công thì chờ sự kiện `remove` như thường.
  - `worldEnded()` chia ba trạng thái `w.conn`:
    - `/api/config` trả 401 → `location.reload()` (về trang đăng nhập) như GĐ1;
    - trả 200 JSON `mode:'world'` → `'refused'`: "Hub từ chối luồng xem (có thể đang mở quá 5 tab)." + nút "Thử lại";
    - lỗi mạng, 5xx hoặc không phải JSON → `'unreachable'`: "Không liên lạc được hub." + nút "Thử lại".
    "Phiên đã hết" chỉ còn cho trường hợp hub trả 200 mà không phải chế độ thế giới (trước khi reload).
  - `retryWorld()`: đóng `es` cũ, gọi lại `/api/config`, thành công thì `startWorld(cfg)`, lỗi thì giữ trạng thái và
    cho bấm lại.

- [ ] **Step 1: Cài đặt** theo Interfaces. Không dùng `innerHTML`; tên máy và tên đảo đi qua React (S18).
- [ ] **Step 2: Kiểm bằng tay "Của tôi"** trên dev hub (cổng ngẫu nhiên, DB tạm) với một máy giả publish: thấy máy, trạng
  thái "Đang gửi"; thông báo "Máy mới"; đổi tên và màu → nhãn đảo trên bầu trời đổi ngay; tên 25 ký tự → báo lỗi; thu
  hồi qua bước hỏi lại → đảo biến mất.
- [ ] **Step 3: Kiểm bằng tay owner.** Đăng nhập `boss@newera.inc`, chọn đảo của member → "Xoá đảo" → xác nhận → đảo
  biến mất, member vẫn xem được và ghép lại được. Chọn đảo của mình → không có nút. Member không thấy nút.
- [ ] **Step 4: Kiểm bằng tay "Thử lại".** Mở 6 tab cùng người → tab thứ 6 hiện lý do "quá 5 tab" và "Thử lại"; đóng một
  tab rồi bấm "Thử lại" → vào được. Dừng hub → tab hiện "Không liên lạc được hub."; chạy lại hub, bấm "Thử lại" → vào
  lại. Đăng xuất ở tab khác → tab này về trang đăng nhập.
- [ ] **Step 5: Chạy toàn bộ test** → PASS.
- [ ] **Step 6: Commit** `feat: my-island panel with devices, owner island removal and stream retry`

---

### Task 11: Trang local: `?server=` trên https và "Xem như người khác"

Trước task: đồng bộ với `origin/main`.

**Files:**
- Modify: `claude-office.html` (constructor của `ClaudeOffice`, Cài đặt local, chip "Thế giới")
- Test: ảnh chụp Chrome headless (script ở scratchpad), toàn bộ test

**Interfaces:**
- Consumes: `/api/public-preview` có `view` cả khi chưa ghép và trạng thái `paused` (Task 7);
  `WorldLogic.clientSessions` (Task 8).
- Produces:
  - Constructor: `location.protocol === 'https:'` thì bỏ qua `?server=` và `endpoint = location.origin + '/events'`.
    Trên `http:` giữ nguyên biểu thức cũ.
  - `state.asOthers` (mặc định `false`, không lưu). Công tắc "Xem như người khác" trong Cài đặt local, chỉ hiện ở nguồn
    `live`. Bật/tắt thì xoá agent như `startSource()` rồi:
    - bật: bỏ qua `onmessage` của luồng local; mỗi giây `GET /api/public-preview`, `this.raw = new Map(...)` và
      `this.syncLive({sessions: WorldLogic.clientSessions(d.view.sessions)})`; không bong bóng; bảng chi tiết chỉ hiện
      trạng thái, NHÓM VIỆC, PHÒNG BAN, TOOL, MODEL (nếu có), VAI TRÒ; có một dòng chú thích "Đang xem như người khác
      (mức <Kín|Cơ bản>)";
    - tắt: trở lại luồng local đầy đủ.
  - Chip "Thế giới" thêm `paused` → "chờ đăng nhập lại hub" (màu `#f5a524`).

- [ ] **Step 1: Ảnh chụp trước khi sửa.** Server local ở cổng khác 4317 (`PORT=4399`, `HOME` tạm, `CLAUDE_DIR` trỏ
  fixture cố định), Chrome headless chụp ở trạng thái `paused` → `before.png`.
- [ ] **Step 2: Cài đặt** theo Interfaces.
- [ ] **Step 3: Ảnh chụp sau khi sửa, công tắc tắt** → `after.png`. Expected: so pixel bằng 0 khác biệt.
- [ ] **Step 4: Kiểm bằng tay.** Bật công tắc khi chưa ghép → nhân viên vẫn hiện, phòng ban là chữ cái, không bong bóng,
  bấm nhân viên không thấy tên session hay thư mục. Tắt → trở lại như cũ. Mở `https://` qua một proxy tạm với
  `?server=evil.example` → trang không kết nối tới `evil.example` (xem network).
- [ ] **Step 5: Chạy toàn bộ test** → PASS.
- [ ] **Step 6: Commit** `feat: preview the island as others see it, ignore ?server= over https`

---

### Task 12: Tài liệu và chạy thử đầu cuối

**Files:**
- Modify: `docs/hub-setup.md`, `README.md` (mục "Chia sẻ đảo"), `CHANGELOG.md` (`## [Unreleased]`)

- [ ] **Step 1: Cập nhật `docs/hub-setup.md`.**
  - Bỏ câu "chỉ nói phần GĐ1"; bảng env thêm `HUB_SECRET_KEY` (bắt buộc, cả khi dev; tạo bằng
    `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`; đổi khoá thì mọi refresh token cũ
    bị bỏ, mọi người về luật 24 giờ cho tới khi đăng nhập lại).
  - Google OAuth: hub xin `access_type=offline` để lấy refresh token, scope vẫn `openid email profile`; lần đầu có màn
    hình đồng ý; vì sao (mất quyền trong 24 giờ, B12); giới hạn 100 refresh token mỗi tài khoản mỗi client.
  - Owner: email trong `HUB_OWNER_EMAILS`, tính ở mỗi request; quyền duy nhất "Xoá đảo"; email cấp lại cho người khác
    (B6).
  - Nhật ký: bảng `audit` trong DB, chưa có trang xem; câu SQL mẫu để đọc 200 dòng mới nhất.
  - Nâng cấp từ GĐ1: dừng hub, sao lưu `hub.sqlite`, đặt `HUB_SECRET_KEY`, chạy bản mới (DB tự nâng); mọi người phải
    đăng nhập lại trong 24 giờ để máy tiếp tục gửi.
  - HSTS bật khi `HUB_PUBLIC_URL` là `https://`.
- [ ] **Step 2: Cập nhật `README.md`** (đổi tên/màu, rời hub, "Xem như người khác") và `CHANGELOG.md` mục
  `[Unreleased]` (Added: tự quản lý đảo, "Xoá đảo" cho owner, "Xem như người khác", mất quyền tự động; Changed: JWKS,
  CSP/SRI/HSTS, giới hạn tốc độ, `HUB_SECRET_KEY` bắt buộc; Fixed: các mục dời lại từ GĐ1).
- [ ] **Step 3: Chạy thử đầu cuối.** Dev hub ở cổng ngẫu nhiên (`HUB_SECRET_KEY` tạm, DB tạm); server local ở
  `PORT=4399` với `HOME` tạm; `join` vào hub; mở hub bằng trình duyệt tích hợp.
  Expected:
  - thấy đảo ở cả hai chế độ; "Của tôi" có máy "Đang gửi" và thông báo "Máy mới";
  - đổi tên đảo thì nhãn đổi ngay;
  - `join` lại → máy cũ "Đã thu hồi", máy mới gửi bình thường;
  - owner xoá đảo của một member thứ hai → publisher của member đó ghi `revoked`;
  - tiến đồng hồ không làm được trên tiến trình thật, nên luật 24 giờ chỉ kiểm qua test;
  - console không có lỗi CSP/SRI;
  - rời hub ở `/me/leave` → về trang đã rời, publisher nhận 401.
- [ ] **Step 4: Nâng cấp thật một DB GĐ1.** Chạy hub GĐ1 từ một worktree tạm ở commit `1a3af72` (không dùng
  `git stash`), tạo dữ liệu, dừng, chạy hub mới trên cùng file → khởi động được, `PRAGMA user_version` = 2, đảo cũ hiện
  lại sau gói đầu tiên.
- [ ] **Step 5: Chạy toàn bộ test** `node --test tests/*.test.mjs` → PASS.
- [ ] **Step 6: Commit** `docs: hub GĐ2 setup, secret key and Google offline access`
