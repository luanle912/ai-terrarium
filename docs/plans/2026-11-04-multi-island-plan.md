# Multi-island GĐ1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhiều người `@newera.inc` nối máy vào chung một hub, mỗi người một đảo, xem đảo của nhau ở chế độ
"Toàn cảnh" và "Của tôi". Chỉ làm phạm vi GĐ1 ở §0 của spec.

**Architecture:**
- `server.js` local được vá (Host, CORS, 404, tranh cổng) và có thêm publisher. Publisher lọc ảnh chụp bằng
  `lib/public-view.js` rồi POST lên hub.
- Hub là thư mục `hub/`: Node thuần, `node:http` + `node:sqlite`. Đăng nhập Google OIDC (chỉ tên miền cho phép),
  ghép máy bằng mã thiết bị, nhận publish, phát SSE cho người xem.
- `claude-office.html` thêm khối `<script id="world-logic">` (hàm thuần) và chế độ thế giới. Mỗi đảo là một
  `IslandScene` **mượn lại các method vẽ và mô phỏng sẵn có** của `ClaudeOffice`, không chép hay viết lại chúng.
  Chế độ local giữ nguyên đường code cũ.

**Tech Stack:**
- Node ≥ 18 cho server local (CommonJS), Node ≥ 22.13 cho hub (`node:sqlite`);
- `node:test`, `node:vm`;
- React 18 UMD, Canvas 2D;
- Google OIDC (authorization code + PKCE).

**Spec:** `docs/specs/2026-11-04-multi-island-design.md`. Phạm vi ở §0; các mục B1–B11 ở §7b ghi đè phần còn lại.

## Global Constraints

- Không thêm dependency, không bước build. Không có `package.json` mới.
- Không bump version, không sửa `.claude-plugin/plugin.json` trong branch này. Anh Huy bump rất thường xuyên; version
  sẽ bump lúc merge. CHANGELOG ghi vào mục `## [Unreleased]`.
- Không có dữ liệu nào ngoài các trường ở spec §10.1 rời máy. Không đọc hay gửi gì liên quan tới đăng nhập Claude.
- `server.js` local không có endpoint ghi. Nghe ở `127.0.0.1`.
- Hub mặc định nghe ở `127.0.0.1`, cổng `4318`. `HUB_DEV_LOGIN=1` chỉ được phép khi `HUB_PUBLIC_URL` bắt đầu bằng
  `http://localhost` hoặc `http://127.0.0.1`.
- Giới hạn: publish body 16KB, POST khác 4KB, tối đa 32 session mỗi gói, `user_code` 8 ký tự từ `BCDFGHJKLMNPQRSTVWXZ`,
  mã thiết bị hết hạn sau 600 giây, `interval` 5 giây, phiên 7 ngày, đảo offline sau 90 giây không có gói.
- Chế độ local phải trông và chạy y như trước. Test cũ (`node --test tests/*.test.mjs`) luôn xanh.
- Đồng bộ với `origin/main` (công cụ `sync_with_base_branch`) **trước Task 9 và trước Task 10**, vì hai task này
  sửa `claude-office.html`.
- Comment trong code viết tiếng Anh như code hiện tại. Chữ trên giao diện viết tiếng Việt.

## Review Focus

1. **Hub khởi động lại.** Publisher vẫn gửi bằng token cũ, đảo hiện lại sau gói đầu tiên, người xem tự nối lại (EventSource
   tự reconnect). Test ở Task 7: `world state rebuilds from the next publish after a restart`.
2. **Server local khởi động lại thì `seq` về 0.** Hub phải nhận lại gói `seq: 0`, không coi là gói cũ. Test ở Task 7:
   `seq 0 after a higher seq is accepted as a restart`.
3. **Hai session Claude Code, hai tiến trình `server.js`.** Chỉ tiến trình giữ cổng phục vụ và gửi. Tiến trình kia
   không crash và tiếp quản khi cổng trống. Test ở Task 1: `a second server waits for the port and takes over`.
4. **Mất mạng ở máy gửi.** Publisher không crash, không spam log, chờ tăng dần, tự hồi phục. Test ở Task 8:
   `network errors back off up to 60 s and recover`.
5. **Người chưa có đảo mở "Của tôi", hoặc hub chưa có đảo nào.** Hiện hướng dẫn ghép máy hoặc bầu trời trống, không
   lỗi. Test ở Task 9: `layout of an empty world` và `my island missing gives no focus`.

---

### Task 1: Vá server local (Host, CORS, 404, tranh cổng) và cho phép require

**Files:**
- Modify: `server.js`
- Test: `tests/server-local.test.mjs`

**Interfaces:**
- Produces:
  - `module.exports = { hostAllowed(host, port, extra), corsOrigin(origin, allowedOrigin), createHandler(deps), listenWithRetry(server, port, host, {retryMs, log}), snapshot, scan }`;
  - chỉ chạy `main()` khi `require.main === module`;
  - `createHandler(deps)` nhận `{snapshot, scan, htmlFile, port, allowedHosts, allowedOrigin, publicPreview}` và trả
    `(req, res) => void`. `publicPreview` là hàm trả JSON, mặc định trả `{state:'off'}`. Task 8 sẽ cắm hàm thật.

- [ ] **Step 1: Viết test hỏng**
  - `hostAllowed('localhost:4317', 4317, [])`, `('127.0.0.1:4317', …)`, `('[::1]:4317', …)` → `true`.
  - `hostAllowed('evil.example:4317', 4317, [])`, `('localhost:9999', 4317, [])`, `(undefined, 4317, [])` → `false`.
  - `hostAllowed('my-mac.local:4317', 4317, ['my-mac.local:4317'])` → `true`.
  - `corsOrigin('http://localhost:3000', '')` → `null`; `corsOrigin('https://x.dev', 'https://x.dev')` → `'https://x.dev'`.
  - Dùng `createHandler` trên `http.createServer` ở cổng ngẫu nhiên:
    - `GET /snapshot` với `Host: evil.example` → 403;
    - `GET /nope` với Host hợp lệ → 404;
    - `POST /snapshot` → 405;
    - `GET /snapshot` có `Origin: http://localhost:3000` → không có header `access-control-allow-origin`.
  - `a second server waits for the port and takes over`: server A giữ cổng X; gọi
    `listenWithRetry(B, X, '127.0.0.1', {retryMs: 50})` không throw; đóng A; trong 500ms B nghe được cổng X.

- [ ] **Step 2: Chạy, xác nhận hỏng**
  Run: `node --test tests/server-local.test.mjs`. Expected: FAIL, `createHandler is not a function`.

- [ ] **Step 3: Cài đặt**
  - `ALLOWED_HOSTS` đọc từ env, tách bằng dấu phẩy.
  - Handler: kiểm Host trước mọi thứ. Chỉ nhận `GET`/`HEAD`. Bảng định tuyến tường minh `/`, `/index.html`, `/events`,
    `/snapshot`, `/api/public-preview`. Còn lại trả 404 (sửa B1).
  - `listenWithRetry`: bắt `error` EADDRINUSE, ghi log **một lần**, thử lại mỗi `retryMs` (mặc định 10000). Trả
    Promise resolve khi đã nghe được.
  - `main()` giữ hành vi cũ: `scan` mỗi giây, SSE, MAX_CLIENTS.

- [ ] **Step 4: Chạy lại toàn bộ test**
  Run: `node --test tests/*.test.mjs`. Expected: PASS hết, kể cả test cũ.

- [ ] **Step 5: Kiểm bằng tay**
  Run: `node server.js` rồi `curl -s -o /dev/null -w '%{http_code}' -H 'Host: evil.example:4317' localhost:4317/snapshot`.
  Expected: `403`. Mở `http://localhost:4317` thấy giao diện như cũ.

- [ ] **Step 6: Commit** `fix: reject foreign Host headers, tighten CORS and survive a busy port`

---

### Task 2: `publicView`: bộ lọc dữ liệu rời máy

**Files:**
- Create: `lib/public-view.js`
- Test: `tests/public-view.test.mjs`

**Interfaces:**
- Produces:
  - `createPublicView(saltHex: string) => view(snapshot, {share:'kin'|'co-ban', projects:string[], private:boolean}) => {private:boolean, sessions: PublicSession[]}`;
  - `PublicSession = {id, parent, status, waitingOn, talkingTo, dept, kind, tool?, model?}`;
  - hằng số `STATUSES`, `KINDS`, `kindOf(toolName)`, `MAX_SESSIONS = 32`.
  - Bảng chữ cái phòng ban (`A`–`P`) nằm trong closure, ổn định giữa các lần gọi.

- [ ] **Step 1: Viết test hỏng**
  - `no secret leaves the machine`: ảnh chụp có `sk-ant-api03-SECRET`, `/Users/victim/secret`,
    `Authorization: Bearer XYZ`, `usage`, tên session bí mật, `recent`, `cwd`, `detail`, `_sendTo`. Với cả `kin` và
    `co-ban`, `JSON.stringify(out)` không chứa `SECRET`, `victim`, `Bearer`, tên session, session id thật.
  - `ids are stable, salted and 12 hex`: cùng salt thì cùng id; khác salt thì khác id; khớp `/^[0-9a-f]{12}$/`.
  - `kin hides project names`: hai project → `dept` là `A`, `B`, theo thứ tự xuất hiện đầu tiên, giữ nguyên ở lần gọi
    sau dù thứ tự đổi.
  - `co-ban shows only allowed projects`: `projects: ['ai-terrarium']` → `dept: 'ai-terrarium'`; project khác vẫn là chữ cái.
  - `tool and model only at co-ban`: `kin` không có khoá `tool`/`model`; `co-ban` có `tool: 'Bash'`.
    `mcp__github__create_issue` → `tool: 'mcp__github'`, `kind: 'mcp'`. `model: 'gpt-4'` bị bỏ.
  - `kindOf`: `Bash`→`shell`, `Edit`→`edit`, `Grep`→`read`, `WebFetch`→`web`, `Agent`→`agent`, `''`→`none`, `Foo`→`other`.
  - `talkingTo by name becomes the hashed id`: session có `talkingTo: 'reviewer'` và một session khác tên `reviewer`
    → `talkingTo` bằng id đã băm của session đó; không tìm thấy thì `null`.
  - `unknown status becomes working`.
  - `private sends no sessions`: `{private: true, sessions: []}`.
  - `caps at 32, roots first`: 40 session gồm 5 gốc → 32, đủ 5 gốc.
  - `output keys are exactly the allowlist`: `Object.keys` của mỗi session ⊆ danh sách cho phép của mức đó.

- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/public-view.test.mjs` → FAIL, không tìm thấy module.

- [ ] **Step 3: Cài đặt** `lib/public-view.js` (CommonJS). Dựng đối tượng mới từ danh sách cho phép (spec §10.1).
  Id dùng `crypto.createHmac('sha256', Buffer.from(saltHex,'hex')).update(id).digest('hex').slice(0,12)`.

- [ ] **Step 4: Chạy test** → PASS.

- [ ] **Step 5: Commit** `feat: add the public view filter for sharing islands`

---

### Task 3: Cấu hình local và các lệnh con

**Files:**
- Create: `lib/terrarium-config.js`
- Modify: `server.js` (rẽ nhánh lệnh con **trước** `listen`)
- Test: `tests/terrarium-config.test.mjs`

**Interfaces:**
- Produces:
  - `configDir(home?) => string`, mặc định `~/.claude-terrarium`. Test truyền thư mục tạm.
  - `readConfig(dir) => Config | null`. Sửa quyền về 0700/0600 nếu đang rộng hơn, ghi cảnh báo qua `log`.
  - `writeConfig(dir, cfg)`: ghi file tạm rồi rename, quyền 0600.
  - `Config = {hub, token, deviceId, islandId, salt, share:'kin'|'co-ban', projects:string[], private:boolean, revoked:boolean}`.
  - `validHubUrl(url) => boolean`: `https:` hoặc `http://localhost[:port]`, `http://127.0.0.1[:port]`.
  - `runCommand(argv, {dir, log, join}) => Promise<number|null>`: trả mã thoát cho `status`, `share`, `private`,
    `leave`, `join`; trả `null` nếu không phải lệnh con (server chạy như thường). `join` gọi `deps.join` (Task 8).
  - `status` chỉ in 4 ký tự cuối của token.

- [ ] **Step 1: Viết test hỏng**
  - `writes 0600 inside a 0700 dir`.
  - `repairs a world-readable config`: chmod 0644 → `readConfig` sửa thành 0600 và log cảnh báo.
  - `validHubUrl`: nhận `https://a.b`, `http://localhost:4318`, `http://127.0.0.1:4318`; từ chối `http://a.b`,
    `ftp://x`, `javascript:alert(1)`, `http://localhost.evil.com`.
  - `share co-ban then kin`, `share projects a,b` → `projects: ['a','b']`, `private on|off`, `leave` xoá file.
  - `status never prints the full token`: chuỗi log không chứa token, chứa `…` + 4 ký tự cuối.
  - `unknown argv returns null`.

- [ ] **Step 2–4:** chạy hỏng → cài đặt → chạy xanh (`node --test tests/terrarium-config.test.mjs`).
- [ ] **Step 5: Commit** `feat: local terrarium config and share/private commands`

---

### Task 4: Khung hub: cấu hình, DB, HTTP, giới hạn

**Files:**
- Create: `hub/server.js`, `hub/config.js`, `hub/db.js`, `hub/http.js`, `hub/limits.js`
- Test: `tests/hub-base.test.mjs`

**Interfaces:**
- Produces:
  - `loadConfig(env) => HubConfig`, throw `Error` liệt kê **mọi** biến thiếu hoặc sai.
    `HubConfig = {publicUrl, origin, secure, allowedDomains:string[], ownerEmails:string[], googleClientId, googleClientSecret, port, host, dbPath, trustProxy, devLogin}`.
  - `openDb(path) => Db`: tạo bảng theo spec §10.3, **bỏ** `audit` và các cột của B12 (thuộc GĐ2); bật WAL và
    `foreign_keys`; chmod file 0600. Có các hàm truy vấn có tham số, đặt tên theo việc
    (`upsertUser`, `getUserBySub`, `createSession`, `getSession`, `deleteSession`, `createDeviceCode`, …). Tên cụ thể
    do người làm chọn, các task sau dùng qua `db.<tên>`.
  - `http.js`:
    - `readBody(req, limit) => Promise<Buffer>`: reject `413` ngay khi vượt;
    - `parseCookies(header) => Object`;
    - `send(res, status, body, headers)`: luôn kèm `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`,
      `Content-Security-Policy: frame-ancestors 'none'`;
    - `clientIp(req, trustProxy)`: lấy phần tử **cuối** của `X-Forwarded-For`;
    - `createRouter(routes) => (req,res)`: `routes` là mảng `{method, path, handler}`, `path` là chuỗi hoặc RegExp;
      không khớp thì 404;
    - log một dòng mỗi request (spec S17).
  - `createLimiter({rate, burst}) => {take(key, now?) => boolean}` (token bucket).
  - `createHub(config, deps = {fetch, now, log}) => {server, db, world, close()}`: Task 5–7 cắm route vào đây.
  - `node hub/server.js` đọc env, gọi `createHub`, `listen`.

- [ ] **Step 1: Viết test hỏng**
  - `refuses to start without allowed domains`: `loadConfig({...ok, HUB_ALLOWED_DOMAINS: ''})` throw, message chứa
    `HUB_ALLOWED_DOMAINS`.
  - `dev login only on localhost`: `HUB_DEV_LOGIN=1` + `HUB_PUBLIC_URL=https://x.com` → throw;
    `http://localhost:4318` → ok, không cần `GOOGLE_*`.
  - `allowed domains are lowercased and exact`.
  - `body over the limit is 413 without reading it all`.
  - `unknown route is 404 with security headers`.
  - `limiter allows burst then refills`: `{rate: 1, burst: 2}` → `true, true, false`; sau 1000ms → `true`.
  - `clientIp ignores forwarded headers unless trusted`.
  - `db file is 0600`.

- [ ] **Step 2–4:** chạy hỏng → cài đặt → `node --test tests/hub-base.test.mjs` xanh.
- [ ] **Step 5: Commit** `feat: hub skeleton with config checks, sqlite schema and http helpers`

---

### Task 5: Đăng nhập Google, phiên, CSRF

**Files:**
- Create: `hub/auth.js`
- Modify: `hub/server.js` (cắm route)
- Test: `tests/hub-auth.test.mjs`

**Interfaces:**
- Consumes: `createHub`, `db`, `http.js`, `createLimiter` (Task 4).
- Produces:
  - `checkClaims(claims, {clientId, domains, nonce, now}) => {ok:true, sub, email, name} | {ok:false, reason}`;
  - `decodeJwtPayload(jwt) => Object` (GĐ1 không kiểm chữ ký, đúng spec §0);
  - `requireSession(req) => {user, session} | null`;
  - `requireCsrf(req, session, formField?) => boolean`: kiểm `Origin === config.origin` **và** token khớp, lấy từ
    header `X-CSRF-Token` hoặc trường form `csrf`;
  - `onSessionEnd(listener)`: Task 7 đăng ký để đóng luồng SSE.
  - Route:
    - `GET /auth/login`: tạo `state`, `nonce`, `verifier`; đặt cookie `__Host-tr_login` (dev: `tr_login`) chứa SHA-256
      của `state`; chuyển hướng tới Google với các tham số ở spec §9.1 bước 1;
    - `GET /auth/callback`: xử lý theo B7 và spec §9.1 bước 2–7;
    - `POST /auth/logout`: cần CSRF;
    - `GET /auth/dev?email=&name=`: chỉ khi `devLogin`, vẫn qua `checkClaims` với claims giả có `hd` lấy từ email;
    - `GET /api/config`: `{mode:'world', me:{id,name,email,islandId}, csrf}`, hoặc 401 khi chưa đăng nhập.
  - Cookie phiên `__Host-tr_sess` (dev: `tr_sess`, không `Secure`). Phiên 7 ngày, DB lưu SHA-256.
  - Email trong `ownerEmails` được đặt role `owner` (GĐ1 chỉ lưu, chưa dùng).

- [ ] **Step 1: Viết test hỏng**
  - `checkClaims` từ chối từng ca: `aud` sai, `iss` lạ, hết hạn, `iat` ở tương lai quá 5 phút, `nonce` sai,
    `email_verified:false`, thiếu `hd`, `hd:'gmail.com'`, email `a@newera.inc.evil.com`, `a@sub.newera.inc`.
    Nhận `A@NEWERA.INC` (thành `a@newera.inc`).
  - `login sets state cookie and redirects to google with hd and pkce`: `location` chứa `code_challenge_method=S256`,
    `hd=newera.inc`, `prompt=select_account`, không chứa `client_secret`.
  - `callback rejects a state that is not bound to this browser`: thiếu cookie `tr_login` → 400.
  - `callback with a valid code creates a session`: `deps.fetch` giả trả `id_token` với claims hợp lệ → 302 về `/`,
    có `Set-Cookie` chứa `HttpOnly` và `SameSite=Lax`, DB có user theo `sub`.
  - `state is single use`: gọi lại cùng `state` → 400.
  - `logout without csrf is 403` và `with wrong Origin is 403`.
  - `api config needs a session`: 401 khi chưa đăng nhập.
  - `login is limited to 30 per hour per ip`: lần thứ 31 trả 429.

- [ ] **Step 2–4:** chạy hỏng → cài đặt → `node --test tests/hub-auth.test.mjs` xanh.
- [ ] **Step 5: Commit** `feat: google sign-in limited to allowed domains, sessions and csrf`

---

### Task 6: Ghép máy bằng mã thiết bị

**Files:**
- Create: `hub/pairing.js`, `hub/pages.js`
- Modify: `hub/server.js`
- Test: `tests/hub-pairing.test.mjs`

**Interfaces:**
- Consumes: `requireSession`, `requireCsrf` (Task 5), `createLimiter`, `db`.
- Produces:
  - `newUserCode(rand?) => 'XXXX-XXXX'`, `normalizeUserCode(s) => string`;
  - route `POST /api/device/start`, `POST /api/device/token` (JSON, **không đọc cookie**), `GET /device`, `POST /device`
    (form `user_code`, `action=approve|deny`, `csrf`);
  - khi duyệt: tạo đảo nếu chưa có, tên mặc định `Đảo <tên Google>`, màu theo
    `hash(user.id) % 8` trong bảng 8 màu ở `hub/pages.js`. Rồi tạo `devices`;
  - `/api/device/token` trả `{token, device_id, island_id}` đúng một lần;
  - `pages.js`: `escapeHtml(s)`, `devicePage({csrf, error})`, `mePage({user, island, devices, csrf})`. Mọi giá trị
    đều đi qua `escapeHtml`.

- [ ] **Step 1: Viết test hỏng**
  - `user codes use the consonant alphabet`: 1000 mã khớp `/^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/`.
  - `normalizeUserCode('khmt bqxp') === 'KHMT-BQXP'` và `normalizeUserCode('KHMT-BQXP') === 'KHMT-BQXP'`.
  - `full pairing`: start → poll trả 428 → đăng nhập dev → POST `/device` approve kèm csrf → poll trả 200 có token
    `trd_…` → poll lần nữa trả 410.
  - `polling faster than interval is slow_down` (429).
  - `expired code is 410`: truyền `deps.now` tiến 601 giây.
  - `deny gives 403 access_denied`.
  - `five wrong codes lock approval for ten minutes`.
  - `device page shows the device name escaped`: tên `<script>` hiện dạng `&lt;script&gt;`.
  - `device page never prefills the code` (B10): `GET /device?code=ABCD-EFGH` không chứa `ABCD`.
  - `token endpoint ignores cookies`.
  - `start is limited to 10 per hour per ip`.
  - DB chỉ có SHA-256 của token và `device_code`: tìm chuỗi token trong mọi cột không thấy.

- [ ] **Step 2–4:** chạy hỏng → cài đặt → xanh.
- [ ] **Step 5: Commit** `feat: pair a machine to its owner's island with a device code`

---

### Task 7: Publish, thế giới trong RAM, SSE, trang `/me`

**Files:**
- Create: `hub/validate.js`, `hub/world.js`
- Modify: `hub/server.js`, `hub/pages.js`
- Test: `tests/hub-world.test.mjs`

**Interfaces:**
- Consumes: `db`, `requireSession`, `requireCsrf`, `onSessionEnd`, `createLimiter`.
- Produces:
  - `validatePublish(body) => {ok:true, value} | {ok:false, error}` theo spec §10.2. Khoá lạ → lỗi. `parent`,
    `waitingOn`, `talkingTo` trỏ ra ngoài gói thì thành `null`.
  - `createWorld({now, onChange}) => World`:
    - `World.publish(island, deviceId, share, value)`;
    - `World.removeIsland(id)`, `World.removeDevice(deviceId)`;
    - `World.snapshotFor(id) => ClientSession[]`;
    - `World.islands() => IslandMeta[]`;
    - `World.tick()`: đánh dấu offline sau 90 giây.
  - `ClientSession = {id, parentId, status, waitingOn, talkingTo, project, kind, tool?, model?}`. `project` là nhãn phòng
    ban **sau khi gộp** theo B5: mức Kín đánh lại `A…` trên toàn đảo theo cặp (máy, chữ cái).
  - `IslandMeta = {id, name, color, online, private, share}`. `share` là mức chặt nhất trong các máy online,
    `private` khi mọi máy online đều riêng tư.
  - Route:
    - `POST /api/publish`: Bearer, giới hạn 4/giây dồn 8, body 16KB;
    - `GET /api/world/stream`: SSE theo spec §9.4, kèm `viewers` (tổng số luồng) trong `world`;
    - `GET /me`, `POST /me/devices/revoke`;
    - `GET /`: chưa đăng nhập thì 302 tới `/auth/login`; đã đăng nhập thì trả `claude-office.html` của repo.
  - Thu hồi máy: `devices.revoked_at`, `world.removeDevice`, phát `world`. Hết máy thì phát `remove`.
    Đăng xuất hay hết hạn phiên thì đóng luồng của phiên đó (B8).

- [ ] **Step 1: Viết test hỏng**
  - `validate rejects unknown keys, bad enums, long strings, 33 sessions`.
  - `dangling references become null`.
  - `kin depts from two machines become separate rooms` (B5).
  - `island is private only when every online machine is private`; `share label is the strictest`.
  - `offline after 90 s without a packet`.
  - `seq 0 after a higher seq is accepted as a restart`; gói có `seq` nhỏ hơn mà khác 0 thì bị bỏ.
  - `world state rebuilds from the next publish after a restart`: tạo hub mới trên cùng DB, publish bằng token cũ → 204,
    stream thấy đảo.
  - Tích hợp, dùng lại helper ghép máy của Task 6 (đặt vào `tests/hub-helpers.mjs`):
    - `publish without token is 401`, `revoked token is 401`;
    - `stream sends world then island events`;
    - `revoking a device removes the island from viewers`;
    - `logout closes the open stream`;
    - `island id in the body is ignored` (gói có khoá `island` → 400).
  - `GET / without session redirects to login`.

- [ ] **Step 2–4:** chạy hỏng → cài đặt → `node --test tests/hub-*.test.mjs` xanh.
- [ ] **Step 5: Commit** `feat: hub accepts filtered snapshots and streams the world to viewers`

---

### Task 8: Publisher và lệnh `join`

**Files:**
- Create: `lib/publisher.js`
- Modify: `server.js`, `lib/terrarium-config.js` (nối `join`)
- Test: `tests/publisher.test.mjs`

**Interfaces:**
- Consumes: `createPublicView` (Task 2), `readConfig`/`writeConfig`/`validHubUrl` (Task 3), `createHandler` với
  `publicPreview` (Task 1), API ghép máy (Task 6).
- Produces:
  - `startPublisher({getSnapshot, dir, fetch, log, now, setTimer}) => {stop(), state()}`:
    - `state()` trả `{state: 'off'|'sending'|'private'|'offline'|'revoked', share, private, hub}`;
    - gửi khi `view` đổi (so bằng `JSON.stringify`), tối đa 2 lần/giây, gửi đầy đủ ít nhất 30 giây một lần;
    - đọc lại cấu hình khi `mtime` đổi, kiểm mỗi 2 giây;
    - 401 → `revoked:true`, dừng; 429 → chờ `Retry-After`; lỗi mạng hoặc 5xx → chờ 2, 4, 8 … tối đa 60 giây, có nhiễu.
  - `join(hubUrl, {name, fetch, log, openBrowser, sleep, dir}) => Promise<Config>`: in mã và link (không kèm mã),
    hỏi theo `interval`, xử lý `slow_down`, `expired_token`, `access_denied`. Sinh `salt` 32 byte. Ghi config.
  - `server.js main()`: sau khi `listenWithRetry` resolve thì mới `startPublisher`. Cắm `publicPreview` trả
    `{...publisher.state(), view}`.

- [ ] **Step 1: Viết test hỏng** (fetch giả, đồng hồ giả)
  - `sends only when the view changes, at most twice a second`.
  - `heartbeat every 30 s`.
  - `401 marks revoked and stops`: config có `revoked:true`, không gửi thêm.
  - `network errors back off up to 60 s and recover`: chuỗi chờ 2, 4, 8, 16, 32, 60, 60 (bỏ qua nhiễu ±20%), rồi
    thành công thì về `sending`. Log lỗi tối đa một dòng mỗi lần đổi trạng thái.
  - `private sends an empty island`.
  - `body never contains usage or cwd`.
  - `join refuses http hubs that are not localhost`.
  - `join stores the token 0600 and prints only the code and link`.
  - Tích hợp: hub thật ở chế độ dev, `join` + duyệt qua helper + `startPublisher` → stream của người xem thấy đảo với
    đúng số session.

- [ ] **Step 2–4:** chạy hỏng → cài đặt → `node --test tests/*.test.mjs` xanh.
- [ ] **Step 5: Commit** `feat: publish the filtered island from the local server`

---

### Task 9: `world-logic`: bố trí, LOD, camera thế giới

Trước task: đồng bộ với `origin/main`.

**Files:**
- Modify: `claude-office.html` (thêm `<script id="world-logic">` ngay sau `camera-logic`)
- Create: `tests/load-world-logic.mjs`
- Test: `tests/world-logic.test.mjs`

**Interfaces:**
- Produces `globalThis.WorldLogic`:
  - `layout(islands: {id}[], meId: string|null) => Map<id, {x, y}>`: đảo của mình ở `(0,0)`, đảo khác theo thứ tự mảng
    trên vòng xoắn, khoảng cách tâm tối thiểu `SPACING = 1.15` lần bề ngang một đảo (đơn vị: bề ngang đảo = 1);
  - `lodFor(screenW: number, stageW: number) => 'full'|'mid'|'thumb'`: `full` khi ≥ 0.5×stageW, `mid` khi ≥ 120px,
    còn lại `thumb`;
  - `visible(rect, stageW, stageH) => boolean`;
  - `fitAll(positions, stageW, stageH) => cam`, `focusOn(pos, stageW, stageH) => cam`;
  - `camStep(cam, goal, dt) => cam` (tiến dần, xong trong khoảng 0.4 giây);
  - `toWorld(cam, px, py)`, `toScreen(cam, wx, wy)`;
  - `cam = {x, y, z}`: `x, y` là tâm thế giới, `z` là pixel trên một đơn vị.

- [ ] **Step 1: Viết test hỏng**
  - `layout of an empty world` → Map rỗng.
  - `my island is at the centre`; `islands never overlap` (20 đảo, mọi cặp cách nhau ≥ SPACING);
    `layout is stable for the same order`.
  - `my island missing gives no focus`: `layout(list, 'x')` với `x` không có trong list → không đảo nào ở `(0,0)`
    chồng lên đảo khác, và không throw.
  - `lodFor` ở các ngưỡng 0.5×stageW và 120px.
  - `toWorld(toScreen(p)) ≈ p`.
  - `fitAll contains every island`.

- [ ] **Step 2–4:** chạy hỏng → cài đặt → xanh.
- [ ] **Step 5: Commit** `feat: world layout and level-of-detail logic`

---

### Task 10: Chế độ thế giới trên giao diện

Trước task: đồng bộ với `origin/main`.

**Files:**
- Modify: `claude-office.html`
- Test: kiểm bằng mắt và đo hiệu năng bằng Chrome headless (script đặt ở scratchpad, không commit)

**Interfaces:**
- Consumes: `WorldLogic` (Task 9), `/api/config` và `/api/world/stream` (Task 5, 7), `/api/public-preview` (Task 1, 8).
- Produces:
  - Lớp `IslandScene` **mượn method** của `ClaudeOffice.prototype` thay vì chép code:
    ```js
    for (const m of SCENE_METHODS) IslandScene.prototype[m] = ClaudeOffice.prototype[m];
    ```
    `SCENE_METHODS` gồm các method mô phỏng và vẽ một đảo: `syncLive`, `addAgent`, `dept`, `colOwners`, `freeDeskFor`,
    `freeDesk`, `log`, `byId`, `leave`, `goalFor`, `updateAgent`, `draw`, `drawSeg`, `drawPlanter`, `pantryItems`,
    `drawDesk`, `actArms`, `drawPerson`, `drawSleeper`, `headPos`. Người làm phải rà mọi `this.<x>` trong các method
    này (bằng grep) và cho `IslandScene` có đúng trường đó: trạng thái riêng của đảo (`agents`, `goneSids`, `depts`,
    `islandCache`, `canvas`, `k`, …) hoặc getter trỏ về component (`theme`, `env`, `speed`, `snowShown`,
    `state.sel`, …).
  - Sửa nhỏ trong `draw()`: thay phép tính `k` bằng `this.renderK()`. Component trả đúng biểu thức cũ;
    `IslandScene` trả `k` theo LOD. Đây là thay đổi duy nhất trong đường code vẽ cũ.
  - Lúc mount, component gọi `fetch('/api/config')`. Chỉ khi 200, `Content-Type` là JSON và `mode === 'world'` thì
    `this.world = {...}`, không mở EventSource local, và bỏ qua `?server=` (B9).
  - Chế độ thế giới:
    - một canvas cỡ stage thay cho canvas cảnh; bầu trời và thời tiết giữ nguyên;
    - mỗi khung: với mỗi đảo `visible`, gọi `scene.frame`, rồi `scene.draw` vào canvas riêng của đảo theo LOD
      (`mid` tối đa 10 lần/giây, `thumb` mỗi 2 giây), rồi `drawImage` lên canvas thế giới qua `toScreen`. Đảo ngoài
      màn hình vẫn `updateAgent` tối đa 4 lần/giây;
    - nhãn đảo (tên, số đang làm, chấm vàng), mờ 35% khi offline, chữ "riêng tư";
    - nút gạt **Toàn cảnh / Của tôi** (lưu `localStorage` khoá `ai-terrarium.view`, bọc try/catch), bản đồ nhỏ, bảng
      bên phải. Nội dung theo spec §12.2. "Của tôi" có link `http://localhost:4317` "Mở bản đầy đủ trên máy này";
    - pan, zoom và pinch dùng `WorldLogic` thay `CameraLogic` khi ở chế độ thế giới. Bấm đảo thì `focusOn`;
    - không có bong bóng chữ. Bảng chi tiết agent chỉ hiện trạng thái, nhóm việc, phòng ban, tool và model nếu có.
  - Trang local: chip "Thế giới" đọc `/api/public-preview` mỗi 5 giây. `state:'off'` thì ẩn chip.

- [ ] **Step 1: Ảnh chụp chế độ local trước khi sửa**
  Chụp `http://localhost:4317` bằng Chrome headless với dữ liệu mô phỏng cố định (`?` dataSource sim, `paused`),
  lưu `before.png`.
- [ ] **Step 2: Cài `IslandScene` và `renderK`, chưa bật chế độ thế giới.** Chụp lại thành `after.png`.
  Expected: hai ảnh giống hệt nhau (so pixel bằng script).
- [ ] **Step 3: Cài chế độ thế giới.** Dựng hub dev và tạo 10 đảo giả bằng script (ghép máy + publish 6 session mỗi đảo).
- [ ] **Step 4: Kiểm bằng mắt** cả hai chế độ ở 1, 5 và 10 đảo, sáng và tối. Kiểm người chưa có đảo mở "Của tôi" thấy
  hướng dẫn ghép máy.
- [ ] **Step 5: Đo hiệu năng.** 10 đảo × 6 nhân vật ở "Toàn cảnh": JS mỗi khung p95 ≤ 8ms. Nếu vượt thì hạ tần suất
  `mid`, không hạ chất lượng đảo đang xem.
- [ ] **Step 6: Chạy `node --test tests/*.test.mjs`** → xanh.
- [ ] **Step 7: Commit** `feat: world view with whole-sky and my-island modes`

---

### Task 11: Tài liệu và chạy thử đầu cuối

**Files:**
- Create: `docs/hub-setup.md`
- Modify: `README.md` (mục ngắn "Chia sẻ đảo"), `CHANGELOG.md` (`## [Unreleased]`)

- [ ] **Step 1: Viết `docs/hub-setup.md`.**
  - Tạo OAuth client trong Google Cloud project của Workspace newera.inc: consent screen **Internal**, redirect URI
    `<HUB_PUBLIC_URL>/auth/callback`.
  - Bảng env (spec §14, bỏ `HUB_SECRET_KEY` vì thuộc GĐ2).
  - Chạy sau Caddy hoặc Cloudflare Tunnel với `HUB_TRUST_PROXY=1`. Sao lưu file DB.
  - Người dùng: `node <plugin>/server.js join <hub>`, `share`, `private`, `status`.
  - Ghi chú: `ALLOWED_HOSTS` cho ai đang mở trang local qua tunnel hay LAN (B3); CORS local đã siết (B4).
- [ ] **Step 2: Chạy thử đầu cuối trên máy.** Hub dev ở `http://localhost:4318`, server local `join` vào hub đó,
  mở `http://localhost:4318` bằng trình duyệt tích hợp. Thấy đảo của mình ở cả hai chế độ. Mở Claude Code thì nhân
  viên đổi trạng thái. `private on` thì đảo hiện "riêng tư" trong ≤ 3 giây. Thu hồi máy ở `/me` thì publisher ghi
  `revoked`.
- [ ] **Step 3: Chạy toàn bộ test** `node --test tests/*.test.mjs` → xanh.
- [ ] **Step 4: Commit** `docs: hub setup guide and changelog for multi-island`
