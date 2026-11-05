# Multi-island: nhiều người, mỗi người một đảo, cùng một bầu trời

Ngày: 2026-11-04 · Người đặt hàng: anh Kiet · Người viết: Claude (phiên brainstorm cùng anh Kiet)

Báo cáo brainstorm (kiến trúc, phương án đã cân nhắc, nguồn):
https://claude.ai/artifact/9GjYHid8dE6jrqwfLLf1Zh. Wireframe chế độ thế giới đã gửi trong chat (không commit).

## 0. Thứ tự làm (anh Kiet chốt sau khi đọc spec)

Anh Kiet: ràng email `@newera.inc` chỉ là một lớp chặn bảo mật, không cần làm quá kỹ. **Làm cho chạy được trước.**
Vì vậy spec chia hai giai đoạn. Plan đầu tiên chỉ làm **GĐ1**. Mọi mục khác trong spec giữ nguyên làm đích của GĐ2.

**GĐ1: chạy được, vẫn giữ các lớp bảo mật nền**
- Server local: kiểm `Host` (S1, B3), siết CORS (B4), 404 tường minh (B1), không crash khi thua cổng và tiếp quản
  gửi (B2), không có endpoint ghi (S2), file cấu hình 0600 (S3), không log token (S4), chỉ nhận hub `https` (S5).
- `publicView` theo danh sách cho phép, mức Kín và Cơ bản, có test (§10.1).
- Hub:
  - đăng nhập Google, kiểm `iss`, `aud`, `exp`, `nonce`, `email_verified`, `hd`, tên miền email khớp chính xác (S7
    **trừ** kiểm chữ ký JWKS; OIDC cho phép bỏ bước này khi ID token lấy thẳng từ token endpoint qua TLS);
  - `state` gắn cookie (B7), phiên cookie (S10), CSRF bằng `Origin` + `X-CSRF-Token` (S11), chỉ lưu mã băm (S9);
  - ghép máy bằng mã gõ tay (§9.2, B10 phần "không điền sẵn"), publish, kiểm schema chặt (§10.2), SSE;
  - giới hạn body (S15), giới hạn tốc độ cho `/api/publish`, `/api/device/start`, `/api/device/token`, `/auth/login`;
  - trang `/me` tối thiểu: danh sách máy, thu hồi máy, đăng xuất. Thu hồi đóng luồng và gỡ đảo ngay (S19, B8);
  - header `nosniff`, `Referrer-Policy`, `frame-ancestors 'none'` (qua CSP tối thiểu `frame-ancestors 'none'`), log
    không chứa bí mật (S17), dev login chỉ trên localhost (S20).
- Giao diện: tách `IslandScene`, chế độ thế giới với **Toàn cảnh** và **Của tôi**, LOD cơ bản (đảo ngoài màn hình
  không vẽ, đảo xa vẽ `k = 1` tối đa 10 lần/giây), chip "Thế giới" trên trang local.
- `docs/hub-setup.md` đủ để dựng hub và tạo OAuth client.

**GĐ2: sau khi GĐ1 chạy ổn** (anh Kiet chốt 2026-11-05; plan: `docs/plans/2026-11-05-multi-island-gd2-plan.md`)

Các quyết định dưới đây **ghi đè** mọi chỗ khác trong spec còn nói tới `admin`, trang `/admin`, đổi vai trò, hay cấm
và bỏ cấm bằng tay (§2 mục 7, C1, B6, §8.1 dòng `hub/pages.js`, §9.5, §11.2, §12).

- **Không có trang `/admin`, không có vai trò lưu trong DB.**
  - Quản trị = **owner** = email nằm trong env `HUB_OWNER_EMAILS`, tính lại ở mỗi request. DB không lưu `owner`,
    `admin` hay `member`; cột `users.role` bị bỏ. Không có route `POST /api/admin/users/:id/role`.
  - `GET /api/config` trả thêm `me.role: 'owner'|'member'`, tính từ env, để giao diện biết khi nào hiện hành động owner.
  - **Hành động owner duy nhất là "Xoá đảo"**, làm ngay trong chế độ thế giới: owner bấm đảo của người khác ở
    "Toàn cảnh", bảng bên phải có nút "Xoá đảo", bấm xong phải xác nhận một lần nữa. Kết quả: thu hồi mọi máy của
    người đó, xoá đảo khỏi RAM và khỏi DB, ghi nhật ký. Publisher không giữ kết nối nào, nên "đóng kết nối" nghĩa là
    lần gửi kế tiếp của máy đó nhận 401 và dừng. **Đây không phải cấm**: người đó vẫn đăng nhập, xem và ghép máy lại
    được (đảo mới được tạo khi ghép).
  - Owner **không** xoá được đảo của owner khác. Owner muốn bỏ đảo của chính mình thì dùng luồng "Rời hub".
  - **Bỏ khỏi GĐ2**: giao diện cấm và bỏ cấm bằng tay, danh sách người bị cấm, trang xem nhật ký quản trị.
    Bảng `audit` **vẫn được ghi**, chỉ chưa có chỗ xem (người vận hành đọc thẳng file DB nếu cần).
- **Cơ chế cấm nội bộ vẫn có**, chỉ phục vụ B12: `users.banned_at` và `users.ban_reason`. Người bị cấm không có phiên
  xem và máy của họ nhận 401. Lệnh cấm có `ban_reason` khác `google_revoked` (ví dụ dòng cũ từ GĐ1 có `banned_at` mà
  không có lý do) chỉ gỡ được bằng tay trong DB. Không có giao diện quản lý. Lý do duy nhất trong
  GĐ2 là `google_revoked` (gồm cả trường hợp ID token khi làm mới không còn khớp tên miền).
  - Vì không còn nút bỏ cấm, **một lần đăng nhập mới qua đủ các bước §9.1 sẽ tự gỡ cấm `google_revoked`**,
    cho mọi người chứ không chỉ owner (ghi nhật ký `ban_lifted`). Người đã nghỉ việc không đăng nhập được nữa vì
    Workspace đã khoá tài khoản, nên việc này không mở lại cửa cho họ.
- **B12 làm đủ** như §7b, cộng các điểm cụ thể sau:
  - `/auth/login` luôn gửi `access_type=offline` và `prompt=select_account`. Lúc đó hub chưa biết là ai, nên không thể
    biết đã có refresh token hay chưa. Ở `/auth/callback`, nếu Google không trả `refresh_token` và hub cũng chưa có
    cho người này, hub chuyển hướng lại một lần với `prompt=consent`. Lần thứ hai vẫn không có thì chấp nhận, người
    đó sống theo luật 24 giờ.
  - Máy của người không có refresh token quá 24 giờ sau lần đăng nhập gần nhất nhận **403 `login_required`** (không
    phải 401), để publisher tạm dừng chứ không tự đánh dấu `revoked`.
  - Cấm giữ lại bản ghi `islands` (tên, màu) và chỉ gỡ đảo khỏi RAM. "Xoá đảo" của owner và "Rời hub" mới xoá bản ghi.
- **Kiểm chữ ký ID token qua JWKS** (`hub/jwt.js`, chỉ `node:crypto`), cache theo `Cache-Control`, tải lại khi gặp
  `kid` lạ nhưng tối đa một lần mỗi phút. Áp cho cả ID token lúc đăng nhập và lúc làm mới (B12).
- **CSP đầy đủ theo hash và SRI cho React** (S13), `Strict-Transport-Security` khi `https`, thêm
  `Cross-Origin-Opener-Policy: same-origin` (S12).
- **Bảng giới hạn tốc độ đầy đủ** (S14). Luồng SSE: 5 luồng đồng thời mỗi người, 300 toàn hub.
- **Tự quản lý đảo trên web**: đổi tên và màu đảo (bảng "Của tôi" và trang `/me`), thu hồi máy, rời hub (trang `/me`,
  có bước xác nhận). "Của tôi" liệt kê máy và trạng thái gửi của từng máy, lấy từ endpoint JSON `GET /api/me`.
- **Thông báo "Máy mới"** (B10) ở "Của tôi" và `/me` trong 7 ngày, kèm nút thu hồi.
- **"Xem như người khác"** trên trang local (§12.4).
- **Việc dời lại từ các vòng review GĐ1**: `?server=` bị bỏ qua khi trang local được phục vụ qua `https:` (B9 nửa sau);
  duyệt mã thiết bị chỉ thành công khi mã chưa duyệt, chưa từ chối, chưa hết hạn; hiệu năng "Toàn cảnh" 10 đảo; nút
  "Thử lại" khi `/api/config` lỗi tạm thời; đăng nhập lại thu hồi phiên cũ của trình duyệt đó; publisher nhận 401 không
  đánh dấu nhầm cấu hình mới; `join` lại (và `leave`) tự thu hồi token cũ trên hub; phòng ban quá 16 project không
  bị trùng chữ cái.
- **Schema GĐ2** (bổ sung §10.3; DB GĐ1 được nâng cấp tại chỗ bằng `PRAGMA user_version`):
  - `users`: bỏ `role`; thêm `refresh_enc TEXT`, `checked_at INTEGER`, `check_fail_since INTEGER`,
    `check_warned_at INTEGER`, `ban_reason TEXT`;
  - `login_states`: thêm `consent INTEGER NOT NULL DEFAULT 0`;
  - tạo bảng `audit` như §10.3, kèm chỉ mục theo `at`;
  - phiên của người chưa có refresh token bị rút về tối đa 24 giờ kể từ lúc tạo.

## 1. Ý định và lý do

Hiện tại terrarium chỉ cho **chính chủ máy** xem các session Claude Code của mình: `server.js` nghe ở
`127.0.0.1:4317`, đọc transcript trong `~/.claude/projects`, đẩy trạng thái cho `claude-office.html`.

Anh Kiet muốn **người khác, mỗi người dùng Claude Code bằng tài khoản Claude riêng, cùng vào một server**. Mỗi
người có **một hòn đảo riêng**. Ai cũng **nhìn được đảo của nhau** và thấy nhân viên bên đó đang làm việc.
Đợt này chỉ **xem**, chưa có tương tác.

Anh Kiet nhấn mạnh **bảo mật là quan trọng nhất**, và trước mắt **chỉ cho email `@newera.inc`**.

## 2. Mục tiêu

1. **Hub**: một server mới (`hub/`), Node thuần, không cài package. Hub nhận trạng thái từ máy các thành viên và
   phát cho người xem.
2. **Đăng nhập Google, chỉ cho `@newera.inc`**. Ai không có email `@newera.inc` đã xác minh thì không đăng nhập
   được, không xem được gì.
3. **Ghép máy vào đảo bằng mã thiết bị**, giống `gh auth login`: chạy một lệnh, trình duyệt mở ra, bấm cho phép.
   Máy nhận một token chỉ có quyền gửi trạng thái cho đảo của chủ máy.
4. **Publisher trong `server.js`**: khi máy đã ghép, server local lọc ảnh chụp theo mức chia sẻ rồi gửi lên hub.
   Không ghép thì `server.js` chạy y như hôm nay.
5. **Hai mức chia sẻ**: **Kín** (mặc định) và **Cơ bản**. Lọc **trên máy người gửi**, theo danh sách cho phép.
6. **Chế độ thế giới trên giao diện**: nhiều đảo trôi trên một bầu trời, đảo của mình ở giữa. Bấm đảo để bay tới
   xem. Đảo xa vẽ thưa để giữ mượt.
7. **Quản lý tối thiểu**: chủ hub (owner) và admin cấm hoặc bỏ cấm một người. Mỗi người tự đổi tên đảo, thu hồi
   máy, rời hub (xoá dữ liệu của mình). Có nhật ký quản trị.
8. **Vá lỗ hổng `Host` của `server.js` local** (DNS rebinding). Có lợi ngay cho mọi người dùng hiện tại.

## 3. Ngoài phạm vi (làm sau)

- Tương tác: thả cảm xúc, theo dõi, khách trên bãi cỏ, "ai đang xem đảo mình". Đợt này chỉ hiện **số người đang xem
  cả hub** ở thanh trên.
- Mức chia sẻ **Chi tiết** (tên file, host URL, tên session). Để sau, vì đây là mức có rủi ro lộ dữ liệu cao nhất.
- Nhiều thế giới trên một hub. Đợt này **một hub = một thế giới**.
- Mã hoá đầu-cuối (hub không đọc được nội dung).
- Đăng nhập GitHub, link mời cho người ngoài công ty.
- Chuyển hub sang Cloudflare Durable Objects.
- Thông báo, lịch sử, thống kê.

## 4. Điều không được xảy ra (anti-goals)

- **Không động tới đăng nhập Claude.** Không có "đăng nhập bằng Claude". Không đọc, gửi hay lưu OAuth token, file
  credential hay file quota của Claude Code ra khỏi máy. Điều khoản của Anthropic cấm việc này
  (https://code.claude.com/docs/en/legal-and-compliance, mục Authentication and credential use).
- **Không có dữ liệu nhạy cảm nào rời máy**, ở mọi mức chia sẻ: `cwd`, đường dẫn, câu lệnh shell, prompt, nội dung
  lỗi, `recent[]`, tên file, URL, quota, session id thật.
- **Máy người dùng không mở thêm cổng nào ra ngoài.** Mọi kết nối tới hub là kết nối đi ra.
- **`server.js` local không có endpoint ghi nào** (POST/PUT/DELETE). Đổi cấu hình chỉ qua dòng lệnh.
- **Không lưu lịch sử hoạt động** của ai trên hub. Hub chỉ biết "bây giờ".
- **Chế độ local không được chậm đi hay đổi hành vi.** Không ghép máy thì không có request nào ra mạng (ngoài
  thời tiết thật nếu người dùng đã bật như hôm nay).
- Không bảng xếp hạng, không đếm token hay giờ làm của người khác.

## 5. Ràng buộc kỹ thuật (từ code hiện tại)

- `server.js` (244 dòng, CommonJS, Node ≥ 18, không dependency) quét transcript mỗi giây, `snapshot()` trả
  `{at, sessions[], usage, version}`. Mỗi session có:
  `id, parentId, name, project, cwd, model, tokens, status, tool, detail, talkingTo, _sendTo, recent, updatedAt`,
  có thể thêm `waitingOn`.
- Trạng thái session: `working, thinking, talking, permission, waiting, idle, error, done`.
- `claude-office.html` (khoảng 1600 dòng, React 18 UMD, Canvas 2D, không build) nhận ảnh chụp trong `syncLive(snap)`.
  Trường thực sự dùng để dựng cảnh: `id, parentId, status, waitingOn, talkingTo, project` (chọn phòng ban), cùng
  `name, tool, detail, model, tokens, cwd, recent` (bảng chi tiết và bong bóng).
- Cảnh là **một component** với hằng số toàn cục (`ISLAND`, `W`, `H`, `DESKS`, `LW/LH/OX/OY`) và trạng thái agent
  nằm trong component. Muốn vẽ nhiều đảo thì phải tách ra.
- Test chạy bằng `node --test tests/*.test.mjs`, đọc các khối `<script id="…">` trong HTML bằng `node:vm`.
- Plugin tự spawn `node server.js` mỗi khi một session Claude Code bắt đầu (`hooks/register.ts`). Có thể có nhiều
  tiến trình cùng tranh cổng 4317, chỉ một tiến trình nghe được.
- Hiệu năng đo trên máy anh Kiet: một đảo với 6 nhân vật tốn khoảng 2.5ms JS mỗi khung, màn hình 120–160Hz chỉ cho
  6–8ms mỗi khung.
- **Anh Huy (hyukai) đang sửa `claude-office.html` rất thường xuyên** (v1.3.1 → v1.3.4 trong một ngày). Refactor
  cảnh có nguy cơ xung đột cao, cần đồng bộ với main thường xuyên.

## 6. Những phần đã chốt (theo lời anh Kiet)

- Làm trên một branch riêng. Viết spec và plan kỹ trước, rồi mới implement.
- **Bảo mật đặt lên hàng đầu.**
- **Chỉ email `@newera.inc`.**
- Đợt đầu **chỉ xem**.
- Người dùng chỉ phải làm một lần lúc đầu (ghép máy), hằng ngày không phải làm gì (đã trình bày và anh đồng ý hướng).
- Giao diện có hai chế độ xem: **"Toàn cảnh"** và **"Của tôi"**. "Của tôi" chỉ tập trung vào đảo của mình (§12.2).
- Người nghỉ việc **mất quyền trong vòng 24 giờ, tự động** (B12).

## 7. Những phần em tự chọn (anh Kiet có thể đổi)

| # | Lựa chọn | Lý do |
|---|---|---|
| C1 | **Mọi người có email `@newera.inc` đã xác minh đều vào được**, không cần link mời. Owner/admin cấm được từng người. | Tên miền công ty đã là danh sách cho phép, thêm lời mời chỉ thêm việc. |
| C2 | **Một người một đảo**. Nhiều máy của cùng người gộp vào chung đảo. Đảo được tạo khi người đó **ghép máy đầu tiên**. Người chỉ xem thì không có đảo. | Đảo = con người, đúng hình dung "mỗi người một vùng". |
| C3 | **Mức chia sẻ mặc định là Kín.** Chỉ có Kín và Cơ bản; Chi tiết để sau. | Bảo mật trước. |
| C4 | **Hub tự host**, chạy sau một reverse proxy HTTPS (Caddy hoặc Cloudflare Tunnel). Code hub không phụ thuộc nơi chạy. | Rẻ, nhanh, cùng code Node, dễ đọc. |
| C5 | Hub dùng `node:sqlite`, nên hub cần **Node ≥ 22.13**. Publisher vẫn chạy với Node ≥ 18. | Giữ "không cài package". |
| C6 | Không có kênh lệnh hub → publisher. Khi bị thu hồi, lần gửi kế tiếp nhận 401, publisher tự dừng. Hub gỡ đảo khỏi người xem **ngay lúc thu hồi**. | Bớt một kết nối, bớt bề mặt tấn công. |
| C7 | Cấu hình publisher nằm ở `~/.claude-terrarium/` (thư mục 0700, file 0600), tách hẳn khỏi `~/.claude`. | Không lẫn với đồ của Claude Code. |
| C8 | Giao diện thế giới là **chính `claude-office.html`**, tự chuyển chế độ khi `GET /api/config` trả về cấu hình hub. Server local trả 404 nên ở chế độ local. | Một file giao diện, không phải bơm script vào HTML (dễ làm CSP chặt). |
| C9 | Đăng nhập Google bằng OIDC authorization code flow, có PKCE, `state`, `nonce`. **Kiểm tra cả chữ ký ID token qua JWKS** dù token lấy trực tiếp từ token endpoint qua TLS. | Phòng thủ nhiều lớp. |
| C10 | Khuyến nghị dựng OAuth client trong Google Cloud project thuộc Workspace newera.inc, consent screen loại **Internal**. Google sẽ tự chặn người ngoài tổ chức trước khi tới hub. | Thêm một lớp chặn miễn phí. Hub **vẫn tự kiểm tra** tên miền, không dựa vào lớp này. |

## 7b. Đã trả lời sau vòng đọc kiểm (builder check)

Reviewer đọc spec với vai người build và đã đối chiếu với code. Em đã kiểm lại từng điểm trong code. Các mục dưới đây
**ghi đè** phần tương ứng ở những mục khác của spec.

**Sửa chỗ spec nói sai về code**

- B1. Server local hiện trả **200 `text/plain` cho mọi đường dẫn lạ**, không phải 404 (`server.js:243`). Phải thêm
  404 tường minh cho mọi đường dẫn không có trong bảng định tuyến. Trang chỉ vào chế độ thế giới khi
  `/api/config` trả 200, `Content-Type: application/json` và `mode === "world"`.
- B2. `listen` không có handler `error`, nên tiến trình thua cuộc tranh cổng 4317 **bị crash** (EADDRINUSE). Phải
  xử lý: các lệnh con (`join`, `status`, …) rẽ nhánh **trước** `listen`. Tiến trình thua cổng không crash mà thử
  `listen` lại mỗi 10 giây, nên khi session đang giữ cổng tắt, một tiến trình khác tiếp quản việc phục vụ và gửi
  (trả lời câu hỏi "ai gửi khi session đầu tiên tắt").

**Em tự quyết thêm (anh có thể đổi)**

- B3. Kiểm `Host` (S1) chấp nhận `localhost`, `127.0.0.1`, `[::1]` với đúng cổng, cộng danh sách thêm trong env
  `ALLOWED_HOSTS` (ví dụ tên tunnel hay tên máy trong LAN). Không đặt env thì như mặc định. Người đang dùng qua
  tunnel hay LAN chỉ cần đặt env, đúng §4 "không đổi hành vi" nếu cấu hình đúng. Ghi rõ trong CHANGELOG.
- B4. **Siết CORS local**: bỏ việc trả lại mọi origin `http(s)://localhost:*`. Chỉ trả
  `Access-Control-Allow-Origin` khi origin khớp đúng `ALLOWED_ORIGIN`. Trang cùng origin không cần CORS. Hiện tại
  bất kỳ dev server nào khác trên máy cũng đọc được toàn bộ `/events` và `/snapshot`.
- B5. **Mức chia sẻ và riêng tư là theo từng máy** (bộ lọc chạy trên máy). Hub gộp như sau:
  - phòng ban của mỗi máy được tách riêng: hub ghép id máy vào khoá phòng, nên `A` của laptop và `A` của máy bàn là
    hai phòng khác nhau. Ở mức Kín, nhãn hiển thị là `A`, `B`… đánh lại theo thứ tự trên toàn đảo;
  - đảo hiện "riêng tư" khi **mọi** máy đang online đều riêng tư. Máy riêng tư không đóng góp session;
  - nhãn mức chia sẻ của đảo là mức **chặt nhất** trong các máy đang online. Bảng "Của tôi" hiện mức của từng máy.
- B6. **Vai trò** (sửa theo §0 GĐ2, anh Kiet chốt 2026-11-05):
  - chỉ có hai vai trò, `owner` và `member`, **không lưu trong DB**. `owner` là người có email nằm trong
    `HUB_OWNER_EMAILS`, tính lại ở **mỗi request**: bỏ email khỏi env thì người đó về `member` ngay. Không có vai trò
    `admin`, không đổi vai trò trên giao diện;
  - email bị Workspace xoá rồi cấp lại cho người khác sẽ có `sub` mới, tức là một người dùng mới. Nếu email đó
    vẫn nằm trong env thì người mới thành owner; việc này do quản trị Workspace kiểm soát, ghi rõ trong
    `docs/hub-setup.md`;
  - quyền duy nhất của owner là **"Xoá đảo"** của một `member` ngay trên chế độ thế giới (§9.5, §12.2). Owner không
    xoá được đảo của owner khác. Không có cấm hay bỏ cấm bằng tay; cấm chỉ xảy ra tự động theo B12.
- B7. **Chống CSRF lúc đăng nhập** (login CSRF): `/auth/login` đặt thêm cookie
  `__Host-tr_login` (HttpOnly, SameSite=Lax, 10 phút) chứa mã băm của `state`. `/auth/callback` chỉ nhận khi cookie
  khớp `state`, rồi xoá cookie.
- B8. **Đóng luồng SSE ngay** khi phiên của người xem bị đăng xuất, hết hạn, hoặc người đó bị cấm. Hub giữ danh sách
  luồng theo phiên. Luồng đang mở cũng kiểm hạn phiên mỗi 60 giây.
- B9. `?server=` bị **bỏ qua** khi trang ở chế độ thế giới, và khi trang được phục vụ qua `https:`.
- B10. **Không điền sẵn mã thiết bị.** Link xác nhận không mang `?code=`; người dùng phải gõ mã thấy trên terminal.
  Khi có máy mới được thêm, "Của tôi" và `/me` hiện thông báo "Máy mới: <tên>, lúc <giờ>" trong 7 ngày, kèm nút
  thu hồi.
- B11. **Bộ lọc nằm trong mã của plugin**, nên ai push được vào repo plugin thì sửa được bộ lọc. Ghi vào mô hình đe
  doạ (§11.2). Biện pháp: hub tự kiểm gói chặt (§10.2), nên kể cả publisher bị sửa cũng chỉ gửi được chuỗi ngắn,
  đúng mẫu ở `dept` (mức Cơ bản), `tool` và `model`. Bảo vệ nhánh `main` của repo là việc của người quản lý repo.

**Anh Kiet chốt**

- B12. **Người nghỉ việc mất quyền trong vòng 24 giờ, tự động.** Cách làm:
  - Lần đăng nhập đầu, `/auth/login` xin thêm `access_type=offline` và `prompt=consent` để lấy refresh token. Các lần
    sau, nếu hub đã có refresh token còn dùng được, thì không ép `prompt=consent`. Scope vẫn chỉ là
    `openid email profile`.
  - Refresh token được **mã hoá khi lưu** bằng AES-256-GCM, khoá lấy từ env bắt buộc `HUB_SECRET_KEY` (32 byte,
    base64). Thiếu khoá hoặc khoá sai độ dài thì hub không khởi động. Bảng `users` thêm cột `refresh_enc TEXT` và
    `checked_at INTEGER`.
  - Mỗi giờ hub kiểm những người có `checked_at` cũ hơn 24 giờ và đang có máy hoặc phiên còn hiệu lực. Với mỗi
    người, hub gọi token endpoint với `grant_type=refresh_token`:
    - trả `invalid_grant`: tự cấm với lý do `google_revoked` (thu hồi máy, xoá phiên, gỡ đảo, đóng luồng, ghi nhật
      ký). Owner trong env cũng bị cấm tạm cho tới khi đăng nhập lại thành công;
    - thành công: nếu kèm ID token thì kiểm lại tên miền và `email_verified` như §9.1. Không khớp thì cấm như trên;
      khớp thì cập nhật `checked_at`;
    - lỗi mạng hoặc 5xx: **không cấm**, thử lại ở lượt sau. Lỗi liên tục quá 72 giờ thì ghi cảnh báo vào nhật ký
      quản trị.
  - Người dùng không có refresh token (ví dụ trước đó từ chối cấp) thì phiên xem chỉ sống 24 giờ, còn máy của họ
    ngừng nhận gói quá 24 giờ sau lần đăng nhập gần nhất, cho tới khi họ đăng nhập lại.
  - Rời hub (`/me/leave`) hay bị cấm: gọi `https://oauth2.googleapis.com/revoke` để huỷ refresh token, rồi xoá
    `refresh_enc`.
  - Bỏ cấm một người bị cấm vì `google_revoked` thì người đó phải đăng nhập lại mới dùng được.
  - Thêm `HUB_SECRET_KEY` vào bảng env (§14) và vào S21. Có test cho: mã hoá/giải mã, `invalid_grant` dẫn tới cấm,
    lỗi mạng không cấm, ID token khác tên miền dẫn tới cấm.

## 8. Kiến trúc

```
Máy thành viên                                Hub (một tiến trình Node, sau HTTPS)          Người xem
┌──────────────────────────┐   POST /api/publish   ┌──────────────────────────────┐   SSE      ┌───────────┐
│ Claude Code → transcript │ ───────────────────▶ │ xác thực token thiết bị       │ ─────────▶ │ trình     │
│ server.js                │  Bearer trd_…        │ kiểm schema, gộp theo đảo     │ /api/world │ duyệt     │
│  ├ UI local như hôm nay  │                      │ RAM: ảnh chụp mới nhất        │ /stream    │ (cookie   │
│  └ publisher (nếu ghép)  │ ◀─ 204 / 401 / 429 ─ │ SQLite: user, đảo, máy, phiên │            │ phiên)    │
└──────────────────────────┘                      │ Google OIDC (@newera.inc)     │            └───────────┘
                                                  └──────────────────────────────┘
```

### 8.1 Bố cục file

| File | Vai trò |
|---|---|
| `server.js` | Như cũ, thêm: kiểm tra `Host`; khởi động publisher nếu đã ghép; lệnh `join`, `leave`, `status`, `share`, `private`; `GET /api/public-preview` (chỉ đọc). |
| `lib/public-view.js` | Hàm thuần `publicView(snapshot, opts)`. Không I/O, test kỹ. |
| `lib/publisher.js` | Đọc cấu hình, gửi lên hub, giãn thời gian chờ khi lỗi, dừng khi 401. |
| `lib/terrarium-config.js` | Đọc/ghi `~/.claude-terrarium/config.json`, kiểm và sửa quyền file. |
| `hub/server.js` | Điểm vào: đọc env, kiểm cấu hình, dựng router, nghe cổng. |
| `hub/db.js` | Schema SQLite, các câu truy vấn có tham số. |
| `hub/auth.js` | Google OIDC, phiên, CSRF, kiểm tên miền. |
| `hub/jwt.js` | Kiểm ID token RS256 với JWKS (`node:crypto`). |
| `hub/pairing.js` | Luồng mã thiết bị. |
| `hub/world.js` | Trạng thái RAM của các đảo, gộp theo máy, phát SSE, đánh dấu offline. |
| `hub/validate.js` | Schema gói publish (danh sách cho phép, enum, giới hạn độ dài). |
| `hub/limits.js` | Giới hạn tốc độ (token bucket theo khoá). |
| `hub/http.js` | Header bảo mật, CSP, đọc body có giới hạn, trả lỗi gọn. |
| `hub/pages.js` | Trang HTML nhỏ: đăng nhập, nhập mã thiết bị, quản lý của tôi, admin. |
| `claude-office.html` | Tách `IslandScene`; thêm chế độ thế giới. |

Hub dùng chung `claude-office.html` của repo (đọc lại mỗi lần tải trang như server local).

## 9. Các luồng

### 9.1 Đăng nhập (người xem)

1. `GET /auth/login` → hub tạo `state` (32 byte ngẫu nhiên), `nonce` (32 byte), `code_verifier` PKCE (32 byte),
   lưu vào bảng `login_states` (hết hạn sau 10 phút, dùng một lần). Chuyển hướng tới
   `https://accounts.google.com/o/oauth2/v2/auth` với `response_type=code`, `scope=openid email profile`,
   `code_challenge` S256, `hd=newera.inc` (chỉ là gợi ý giao diện), `prompt=select_account`.
2. `GET /auth/callback?code&state` → tìm và **xoá** `state`. Không có thì 400.
3. Đổi `code` lấy token ở `https://oauth2.googleapis.com/token` (gửi `client_secret` và `code_verifier`).
4. Kiểm ID token, **tất cả đều bắt buộc**:
   - chữ ký RS256 khớp một khoá trong JWKS của Google (`https://www.googleapis.com/oauth2/v3/certs`, cache theo
     `Cache-Control`, tải lại khi gặp `kid` lạ, tối đa một lần mỗi phút);
   - `iss` là `https://accounts.google.com` hoặc `accounts.google.com`;
   - `aud` bằng đúng `GOOGLE_CLIENT_ID`;
   - `exp` còn hạn, `iat` không ở tương lai quá 5 phút;
   - `nonce` khớp;
   - `email_verified === true`;
   - `hd` thuộc `HUB_ALLOWED_DOMAINS`;
   - `email` (viết thường) có dạng `<local>@<domain>` với `<domain>` **khớp chính xác** một phần tử của
     `HUB_ALLOWED_DOMAINS`. Không chấp nhận tên miền con, không so khớp kiểu "kết thúc bằng".
5. Định danh người dùng bằng `sub`, không bằng email. Tạo hoặc cập nhật bản ghi `users`. Người bị cấm thì trả trang
   "tài khoản đã bị chặn".
6. Tạo phiên: token 32 byte, cookie `__Host-tr_sess` (`Secure; HttpOnly; SameSite=Lax; Path=/`), DB chỉ lưu
   SHA-256 của token. Hết hạn tuyệt đối sau 7 ngày. Mỗi phiên có một `csrf` 32 byte riêng.
7. Email nằm trong `HUB_OWNER_EMAILS` thì nhận vai trò `owner` khi đăng nhập.

### 9.2 Ghép máy (mã thiết bị)

1. Trên máy: `node server.js join https://terrarium.newera.inc`, có thể thêm `--name "Laptop"`.
   - URL hub phải là `https://`. Chỉ `http://localhost` và `http://127.0.0.1` được phép để phát triển.
   - Gọi `POST /api/device/start {name}` → `{device_code, user_code, verification_uri, expires_in: 600, interval: 5}`.
2. Terminal in mã (ví dụ `KHMT-BQXP`) và link. Thử mở trình duyệt tới `verification_uri` (không kèm mã, xem B10).
3. Trình duyệt (đã đăng nhập) hiện: tên máy, thời điểm yêu cầu, mã, cảnh báo "Chỉ bấm Cho phép nếu bạn vừa chạy
   lệnh này trên máy của mình". Hai nút **Cho phép** / **Từ chối**. POST kèm CSRF.
4. Máy hỏi `POST /api/device/token {device_code}` đúng nhịp `interval`:
   - `428 authorization_pending`;
   - `429 slow_down` nếu hỏi quá nhanh (máy tăng `interval` thêm 5 giây);
   - `410 expired_token`, `403 access_denied`;
   - `200 {token, island_id}` **đúng một lần**, sau đó `device_code` bị xoá.
5. Hub tạo đảo cho người dùng nếu chưa có (C2), tạo bản ghi `devices` với SHA-256 của token, ghi nhật ký.
6. Máy lưu `{hub, token, deviceId, islandId, salt, share:"kin", private:false, projects:[]}` vào
   `~/.claude-terrarium/config.json`. `salt` là 32 byte ngẫu nhiên sinh tại máy.

Thông số:
- `user_code`: 8 ký tự từ bảng `BCDFGHJKLMNPQRSTVWXZ` (20 phụ âm, không lẫn số với chữ, không ghép thành từ), hiển
  thị dạng `XXXX-XXXX`. So khớp không phân biệt hoa thường, bỏ dấu `-`.
- `device_code`: 32 byte, base64url.
- Token thiết bị: `trd_` + 32 byte base64url.

### 9.3 Gửi trạng thái (publisher)

- Server local đã ghép và không bị thu hồi thì chạy vòng gửi:
  - gửi khi kết quả `publicView` **khác lần gửi trước**, tối đa 2 lần mỗi giây;
  - gửi đầy đủ ít nhất mỗi 30 giây để báo còn sống.
- `POST /api/publish`, `Authorization: Bearer trd_…`, body JSON tối đa 16KB:
  ```json
  {"v":1,"seq":1842,"sessions":[{"id":"a1b2c3d4e5f6","parent":null,"dept":"A","status":"working","kind":"edit"}]}
  ```
- Kết quả:
  - `204`: thành công;
  - `400`: schema sai, máy ghi log và vẫn tiếp tục;
  - `401`: token bị thu hồi, máy ghi `revoked:true` vào cấu hình và **dừng hẳn**;
  - `413`: body quá lớn;
  - `429`: chờ theo `Retry-After`;
  - `5xx` hoặc lỗi mạng: thử lại với thời gian chờ tăng dần từ 2 giây tới tối đa 60 giây, có nhiễu ngẫu nhiên.
- **Chỉ một tiến trình gửi mỗi máy**: đó là tiến trình đang giữ được cổng 4317. Tiến trình không nghe được cổng thì
  không gửi.
- `private:true` thì gửi `sessions: []` kèm `"private": true`. Đảo hiện chữ "riêng tư", không có nhân viên.
- Server local đọc lại cấu hình mỗi 2 giây (theo `mtime`), nên lệnh `share` hay `private` có hiệu lực ngay, không
  phải khởi động lại.

### 9.4 Xem (người xem)

- `GET /` (hub): chưa đăng nhập thì chuyển tới trang đăng nhập. Đã đăng nhập thì trả `claude-office.html`.
- `GET /api/config` → `{mode:"world", me:{id,name,email,role,islandId}, csrf}`. Trang thấy `mode:"world"` thì
  chuyển sang chế độ thế giới.
- `GET /api/world/stream` (SSE, cookie):
  - `event: world` khi kết nối và khi danh sách đảo đổi:
    `{"islands":[{"id","name","color","online","private","share"}],"viewers":<tổng số người đang xem>}`
    (`share` là `kin` hoặc `co-ban`, theo từng đảo; `viewers` nằm ở cấp trên cùng, không theo từng đảo);
  - `event: island`: `{"id","sessions":[…]}`, gộp mọi máy của đảo, tối đa 2 lần mỗi giây mỗi đảo;
  - `event: remove`: `{"id"}` khi đảo bị xoá hoặc chủ bị cấm;
  - dòng chú thích `: ping` mỗi 25 giây.
- Đảo không nhận gói nào quá 90 giây thì `online:false`.

### 9.5 Quản lý

| Ai | Endpoint | Việc |
|---|---|---|
Sửa theo §0 GĐ2 (anh Kiet chốt 2026-11-05): không có trang `/admin`, không có route `/api/admin/*`.

| Ai | Endpoint | Việc |
|---|---|---|
| Mọi người | `GET /me` (trang) | Đảo của tôi, danh sách máy, thông báo "Máy mới" (B10), đổi tên và màu đảo, thu hồi máy, link rời hub |
| Mọi người | `GET /api/me` | JSON cho bảng "Của tôi": đảo, danh sách máy kèm trạng thái gửi của từng máy (từ RAM), máy mới trong 7 ngày |
| Mọi người | `POST /api/me/island` (JSON), `POST /me/island` (form) | Đổi tên (1–24 ký tự, chữ/số/khoảng trắng/`-_.`, có tiếng Việt) và màu (một trong 8 màu có sẵn) |
| Mọi người | `POST /api/me/devices/:id/revoke` (JSON), `POST /me/devices/revoke` (form) | Thu hồi máy |
| Mọi người | `GET /me/leave` (trang xác nhận), `POST /me/leave` (form) | Rời hub: xoá đảo, máy, phiên, huỷ refresh token Google. Bản ghi `users` giữ lại `sub` và trạng thái cấm, xoá tên và email |
| Máy (Bearer) | `POST /api/device/revoke-self` | Máy tự thu hồi token của nó (dùng khi `join` lại hoặc `leave`) |
| Mọi người | `POST /auth/logout` | Xoá phiên |
| Owner (env) | `POST /api/owner/islands/:id/remove` (JSON) | "Xoá đảo": thu hồi mọi máy của chủ đảo, xoá đảo khỏi RAM và DB, ghi nhật ký. Không phải cấm. Từ chối (403) khi chủ đảo là owner, kể cả chính mình |

Nhật ký (`audit`) được ghi cho: ghép máy, thu hồi máy, đổi tên/màu đảo, xoá đảo, rời hub, cấm và gỡ cấm tự động (B12),
cảnh báo kiểm Google lỗi quá 72 giờ. GĐ2 chưa có chỗ xem nhật ký trên web.

Mọi `POST` từ trình duyệt bắt buộc header `X-CSRF-Token` (hoặc trường form `csrf`) khớp phiên **và** `Origin` bằng
đúng origin của `HUB_PUBLIC_URL`.

### 9.6 Lệnh dòng lệnh của publisher

```
node server.js                          # như hôm nay; tự gửi nếu đã ghép
node server.js join <hubUrl> [--name N] # ghép máy
node server.js status                   # hub, đảo, mức chia sẻ, trạng thái (đã ghép / bị thu hồi / riêng tư)
node server.js share kin|co-ban         # đổi mức chia sẻ
node server.js share projects a,b       # danh sách project được lộ tên ở mức Cơ bản
node server.js private on|off           # chế độ riêng tư
node server.js leave                    # xoá cấu hình local (thu hồi trên hub thì làm ở trang /me)
```

## 10. Dữ liệu

### 10.1 `publicView(snapshot, opts)`: chỉ những trường này được rời máy

`opts = {share: 'kin'|'co-ban', salt, projects: string[], private: boolean}`

| Trường ra | Kín | Cơ bản | Nguồn và cách biến đổi |
|---|---|---|---|
| `id` | ✔ | ✔ | HMAC-SHA256(salt, session id thật), lấy 12 ký tự hex đầu |
| `parent` | ✔ | ✔ | Như `id`, tính từ `parentId`; `null` nếu không có |
| `status` | ✔ | ✔ | Nằm trong enum ở §5, ngoài ra thì đổi thành `working` |
| `waitingOn`, `talkingTo` | ✔ | ✔ | Băm như `id` (`talkingTo` hôm nay là **tên** agent, nên phải tìm id của agent đó trong ảnh chụp; không tìm được thì bỏ) |
| `dept` | ✔ chữ `A`–`P` | tên project nếu nằm trong `projects`, còn lại là chữ cái | Chữ cái gán theo thứ tự xuất hiện đầu tiên, giữ ổn định suốt đời tiến trình |
| `kind` | ✔ | ✔ | Từ tên tool: `shell` (Bash), `edit` (Edit, Write, MultiEdit, NotebookEdit), `read` (Read, Grep, Glob, LS), `web` (WebFetch, WebSearch), `agent` (Agent, Task, SendMessage), `mcp` (tên bắt đầu `mcp__`), `other`, `none` |
| `tool` | ✘ | ✔ | Tên tool; tool MCP chỉ lấy phần `mcp__<server>` (bỏ tên hàm); chỉ giữ `[A-Za-z0-9_.-]`, tối đa 32 ký tự |
| `model` | ✘ | ✔ | Chỉ khi khớp `^claude-[a-z0-9.-]{1,40}$`, ngược lại bỏ |

Mọi trường khác **không bao giờ** có trong kết quả. Cài đặt bằng cách **dựng đối tượng mới từ danh sách cho phép**,
không copy rồi xoá bớt. Tối đa 32 session. Nếu nhiều hơn thì giữ session gốc trước, rồi tới mới nhất.

### 10.2 Hub kiểm gói publish (`hub/validate.js`)

- Đúng các khoá trên. **Khoá lạ thì từ chối cả gói** (400), không lặng lẽ bỏ qua, để phát hiện publisher lỗi hoặc giả.
- `share` (nếu có) là `'kin'` hoặc `'co-ban'`, mặc định `'kin'`; publisher luôn gửi trường này.
- `v === 1`; `seq` là số nguyên ≥ 0 (gói có `seq` nhỏ hơn gói trước của cùng máy thì bỏ, trừ khi máy vừa khởi động
  lại, khi đó `seq` về 0); `private` là boolean nếu có.
- Chuỗi đúng regex ở §10.1; `dept` ở mức Kín khớp `^[A-P]$`, ở mức Cơ bản khớp `^[\p{L}\p{N} ._-]{1,40}$`u.
- `parent`, `waitingOn`, `talkingTo` phải trỏ tới `id` có trong cùng gói, nếu không thì đặt `null`.
- Hub **không bao giờ** lấy id đảo hay id người dùng từ body. Đảo xác định từ token.

### 10.3 Bảng SQLite

```sql
users(id INTEGER PRIMARY KEY, google_sub TEXT UNIQUE NOT NULL, email TEXT, name TEXT,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','admin','member')),
      banned_at INTEGER, created_at INTEGER NOT NULL, last_login_at INTEGER)
islands(id TEXT PRIMARY KEY, user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
        name TEXT NOT NULL, color TEXT NOT NULL, created_at INTEGER NOT NULL)
devices(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL, last_used_at INTEGER, revoked_at INTEGER)
device_codes(code_hash TEXT PRIMARY KEY, user_code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
             created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, approved_user_id INTEGER,
             denied INTEGER NOT NULL DEFAULT 0, last_poll_at INTEGER, ip TEXT)
sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), csrf TEXT NOT NULL,
         created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)
login_states(state TEXT PRIMARY KEY, nonce TEXT NOT NULL, verifier TEXT NOT NULL, created_at INTEGER NOT NULL)
audit(id INTEGER PRIMARY KEY, at INTEGER NOT NULL, actor_id INTEGER, action TEXT NOT NULL, target TEXT, ip TEXT)
```

- Mọi câu truy vấn dùng **tham số** (`?`), không ghép chuỗi.
- File DB quyền 0600. Bật `PRAGMA journal_mode=WAL` và `foreign_keys=ON`.
- Dọn mỗi giờ: `login_states` quá 10 phút, `device_codes` hết hạn, `sessions` hết hạn, `audit` quá 180 ngày.
- Ảnh chụp đảo **chỉ nằm trong RAM**, không bao giờ ghi xuống đĩa hay log.

## 11. Bảo mật

### 11.1 Bắt buộc (mỗi mục phải có test hoặc bước kiểm trong plan)

**Local (`server.js`)**
- S1. Chỉ trả lời khi header `Host` nằm trong danh sách cho phép (B3), còn lại trả 403. Giữ nghe ở `127.0.0.1`.
- S2. Không có endpoint ghi. `GET /api/public-preview` chỉ trả kết quả `publicView` của chính máy.
- S3. Thư mục `~/.claude-terrarium` 0700, file cấu hình 0600. Khi đọc mà thấy quyền rộng hơn thì sửa lại và ghi cảnh báo.
- S4. Token thiết bị không bao giờ xuất hiện trong log, trong `status` (chỉ in 4 ký tự cuối), hay trong UI.
- S5. Từ chối hub URL không phải `https://`, trừ `localhost` và `127.0.0.1`.
- S6. Publisher không bao giờ đọc file trong `~/.claude` ngoài những file `server.js` đang đọc hôm nay.
  `usage` **không** đi qua `publicView`.

**Hub**
- S7. Kiểm ID token đủ các điều ở §9.1 bước 4. Có test cho từng trường hợp hỏng: sai chữ ký, sai `aud`, sai `iss`,
  hết hạn, sai `nonce`, `email_verified=false`, thiếu `hd`, `hd` khác, email `a@newera.inc.evil.com`,
  `a@sub.newera.inc`, `A@NEWERA.INC` (phải nhận vì viết thường trước khi so), `kid` lạ.
- S8. `HUB_ALLOWED_DOMAINS` bắt buộc khi khởi động. Thiếu thì hub **không chạy**.
- S9. Token thiết bị, token phiên, `device_code` chỉ lưu SHA-256. So sánh bằng tra cứu theo mã băm, không so chuỗi
  bí mật trực tiếp.
- S10. Cookie `__Host-tr_sess; Secure; HttpOnly; SameSite=Lax; Path=/`. Trên `http://localhost` khi phát triển
  thì dùng tên `tr_sess` và bỏ `Secure`.
- S11. CSRF: mọi POST từ trình duyệt kiểm `Origin` và `X-CSRF-Token`. Riêng `/api/device/start`, `/api/device/token`
  và `/api/publish` không dùng cookie nên không cần CSRF, nhưng **bỏ qua cookie hoàn toàn** ở các endpoint này.
- S12. Header trên mọi phản hồi HTML: `Content-Security-Policy` (bên dưới),
  `Strict-Transport-Security: max-age=31536000` (khi https), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`.
- S13. CSP cho `claude-office.html` khi hub phục vụ: `default-src 'none'`;
  - `script-src 'sha256-…' https://cdnjs.cloudflare.com`: hash của từng khối `<script>` inline, hub tính lúc phục vụ;
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`;
  - `font-src https://fonts.gstatic.com`;
  - `connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com`;
  - `img-src 'self' data:`;
  - `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'self'`.

  Thêm `integrity` (SRI) và `crossorigin` cho hai thẻ React trên cdnjs. Việc này có lợi cho cả chế độ local.
- S14. Giới hạn tốc độ (token bucket, theo khoá):

  | Endpoint | Khoá | Mức |
  |---|---|---|
  | `/api/device/start` | IP | 10 / giờ |
  | `/api/device/token` | `device_code` | theo `interval` (5 giây) |
  | Duyệt mã thiết bị | phiên | 5 lần sai / 10 phút, quá thì khoá 10 phút |
  | `/api/publish` | máy | 4 / giây, dồn tối đa 8 |
  | `/auth/login` | IP | 30 / giờ |
  | `/api/world/stream` | người dùng | 5 kết nối đồng thời; toàn hub 300 |
  | Mọi thứ khác | IP | 120 / phút |

- S15. Body tối đa: 16KB cho `/api/publish`, 4KB cho mọi POST khác. Đọc body dừng ngay khi vượt, không đọc hết rồi
  mới kiểm.
- S16. Chỉ đọc IP từ `X-Forwarded-For` khi `HUB_TRUST_PROXY=1`, và chỉ lấy phần tử cuối cùng.
- S17. Log: một dòng mỗi request gồm thời điểm, phương thức, đường dẫn không có query, mã trả về, thời gian xử lý.
  Không bao giờ log body, header `Authorization`, cookie, `code`, `state`.
- S18. Mọi chuỗi từ người khác (tên đảo, tên dept, tên tool) hiển thị bằng canvas `fillText` hoặc `textContent`,
  không bao giờ qua `innerHTML`. Trang HTML phía hub escape mọi giá trị khi dựng.
- S19. Bị cấm hay thu hồi thì có hiệu lực ngay: xoá phiên, đánh dấu máy, gỡ đảo khỏi RAM, phát `remove` cho người xem.
- S20. Chế độ dev `HUB_DEV_LOGIN=1` (đăng nhập không qua Google, dùng cho test) chỉ chạy khi `HUB_PUBLIC_URL` là
  `http://localhost…` hoặc `http://127.0.0.1…`. Ngược lại hub **không khởi động**. Dev login vẫn áp kiểm tra tên miền.
- S21. Secret (`GOOGLE_CLIENT_SECRET`) chỉ đọc từ env, không bao giờ nằm trong repo hay log.

### 11.2 Mô hình đe doạ (tóm tắt)

| Đe doạ | Chặn bởi |
|---|---|
| Người ngoài công ty vào xem | S7, S8, consent screen Internal (C10) |
| Lộ code hoặc bí mật qua trạng thái | §10.1 danh sách cho phép, mặc định Kín, không có mức Chi tiết, S6 |
| Mạo danh đảo người khác | Đảo xác định từ token (§10.2), token chỉ có quyền publish |
| Trộm token thiết bị | S3, S9, thu hồi ở `/me`, token chỉ ghi được, không đọc được gì |
| Lừa người khác duyệt máy của kẻ tấn công | Trang duyệt hiện tên máy và cảnh báo, mã hết hạn 10 phút, S14 |
| XSS từ dữ liệu người khác | §10.2, S13, S18 |
| CSRF vào trang quản trị | S10, S11 |
| Spam hoặc làm sập hub | S14, S15, giới hạn 32 session mỗi gói |
| Trang web lạ đọc server local (DNS rebinding) | S1 |
| Vi phạm điều khoản Anthropic | §4, S6 |
| Trang lạ trên máy (dev server khác) đọc dữ liệu local qua CORS | B4 |
| Bộ lọc bị sửa qua repo plugin | B11, §10.2 |
| Lừa nạn nhân đăng nhập vào tài khoản kẻ tấn công (login CSRF) | B7 |
| Người bị cấm vẫn xem qua luồng đang mở | B8 |
| Người vận hành hub đọc dữ liệu | Chỉ có dữ liệu đã lọc, không log payload (S17), không lưu đĩa. Mã hoá đầu-cuối để sau |

## 12. Giao diện

### 12.1 Tách `IslandScene`

- Chuyển toàn bộ trạng thái và hành vi của **một đảo** ra khỏi component thành lớp `IslandScene` trong khối
  `<script id="island-scene">`:
  - danh sách agent, `goneSids`, `firstSnap`;
  - `syncLive(snap)`, `addAgent`, `updateAgent`, `goalFor`, `leave`, `frame(dt)`;
  - `draw(ctx, k, t, env)` (vẽ đảo và văn phòng vào một canvas có cỡ `LW×LH×k`);
  - `hit(lx, ly)`, `headPos(a)`.
- Component giữ: camera, bầu trời và thời tiết, bong bóng, bảng chi tiết, cài đặt, nguồn dữ liệu.
- **Chế độ local dùng một `IslandScene`** và phải trông y hệt hôm nay. So ảnh chụp trước và sau refactor bằng Chrome
  headless, chênh lệch pixel bằng 0 khi cùng thời điểm và cùng dữ liệu.

### 12.2 Chế độ thế giới

- Mỗi đảo là một `IslandScene` với ảnh chụp từ hub. Vị trí đặt theo vòng xoắn quanh tâm: đảo của mình ở tâm, các
  đảo khác theo thứ tự tạo (`islands.created_at`). Vị trí ổn định giữa các lần tải trang.
- Không có dữ liệu `name`, `detail`, `recent`, `cwd` nên bảng chi tiết agent chỉ hiện: trạng thái, nhóm việc,
  phòng ban, và tool, model nếu đảo đó ở mức Cơ bản. Không có bong bóng chữ cho đảo người khác.
- Đảo của mình trong chế độ thế giới cũng hiện **phiên bản đã lọc** (đúng như người khác thấy), vì nguồn là hub.
- Nhãn trên mỗi đảo: tên, số đang làm, chấm vàng nếu có `permission` hoặc `waiting`. Offline thì mờ 35%. Riêng tư thì
  hiện chữ "riêng tư", không có nhân viên.
- **Hai chế độ xem, chuyển bằng nút gạt trên thanh trên: "Toàn cảnh" và "Của tôi"** (anh Kiet chốt):
  - **Toàn cảnh**: mọi đảo trên bầu trời. Bấm đảo thì camera bay tới, bảng bên phải hiện tên đảo, mức chia sẻ, đếm
    theo phòng ban. Có bản đồ nhỏ ở góc dưới trái.
  - **Của tôi**: chỉ đảo của mình, camera đặt vào đảo đó như chế độ local hôm nay. Các đảo khác **không vẽ** (cũng
    không tính vào ngân sách vẽ). Bảng bên phải là thông tin quản lý đảo của mình: mức chia sẻ, riêng tư hay không,
    danh sách máy và trạng thái gửi, link tới `/me`. Người chưa có đảo thì thấy hướng dẫn ghép máy (§9.2).
  - Chế độ đang chọn lưu trong `localStorage`. Mặc định là "Toàn cảnh".
- **Bổ sung GĐ2** (anh Kiet chốt 2026-11-05, thay cho trang `/admin`):
  - **"Của tôi"**, bảng bên phải lấy dữ liệu từ `GET /api/me`:
    - danh sách máy, mỗi máy có trạng thái gửi (đang gửi / riêng tư / mất kết nối / đã thu hồi) và mức chia sẻ;
    - thông báo "Máy mới: <tên>, lúc <giờ>" cho máy thêm trong 7 ngày (B10), kèm nút "Thu hồi" có bước xác nhận;
    - đổi tên đảo và chọn một trong 8 màu ngay trong bảng;
    - link "Rời hub" tới `/me/leave`. Việc rời hub chỉ làm ở trang `/me`, có trang xác nhận riêng.
  - **"Toàn cảnh", khi người xem là owner** (`me.role === 'owner'`) và đảo đang chọn không phải của mình: bảng đảo có
    thêm nút "Xoá đảo". Bấm thì bảng đổi thành câu xác nhận ("Xoá đảo này? Mọi máy của người đó bị thu hồi. Họ vẫn
    ghép lại được.") với hai nút "Xoá" và "Huỷ". Hub từ chối đảo của owner khác thì bảng hiện lý do.
  - Khi luồng SSE bị từ chối nhưng `/api/config` vẫn trả chế độ thế giới (ví dụ mở quá 5 tab), hoặc `/api/config` lỗi
    tạm thời, bảng hiện lý do và nút **"Thử lại"** thay vì "Phiên đã hết". "Phiên đã hết" chỉ dành cho lúc hub không
    còn nhận phiên.
  - Hub chỉ có dữ liệu đã lọc, nên "Của tôi" trên hub hiện **đúng thứ người khác thấy**. Bản đầy đủ (tên session,
    câu lệnh, bong bóng chữ) vẫn ở trang local `http://localhost:4317`. "Của tôi" có link "Mở bản đầy đủ trên máy
    này" trỏ tới đó (em chọn: trang hub **không** đọc dữ liệu từ server local, để một lỗi XSS trên hub không thể lộ
    dữ liệu đầy đủ của máy).
- Thanh trên: tên hub, số đảo online trên tổng, số người đang xem, link "Đảo của tôi" (tới `/me`).

### 12.3 Mức chi tiết khi vẽ (LOD)

| Đảo | Cách vẽ |
|---|---|
| Đang xem (bề ngang trên màn hình ≥ 50% stage) | Đầy đủ, mọi khung, độ phân giải theo `renderScale` hiện có |
| Thấy được, bề ngang ≥ 130px | `k = 1`, vẽ lại tối đa 10 lần/giây, ảnh đảo tĩnh dùng cache sẵn có |
| Bề ngang < 130px | Ảnh thu nhỏ vẽ lại mỗi 2 giây, kèm nhãn |
| Ngoài màn hình | Không vẽ, vẫn mô phỏng di chuyển với `dt` lớn (tối đa 4 lần/giây) |

Mục tiêu: với 10 đảo × 6 nhân vật, **JS mỗi khung p95 ≤ 8ms** trên máy anh Kiet, đo bằng cùng cách đã đo hôm nay.

GĐ2: đo GĐ1 bằng render phần mềm cho khoảng 9ms ở "Toàn cảnh" 10 đảo. Hai con số "10 lần/giây" và "120px" ở bảng
trên được phép chỉnh (tối đa 5 lần/giây và 160px) để đạt mục tiêu; giá trị chốt ghi lại vào đây khi đo xong. Không hạ
chất lượng đảo đang xem. Canvas `mid` và `thumb` được giữ lại khi đảo rời khỏi khung (chỉ canvas `full` bị trả), và
đảo chưa có canvas cũng phải xếp hàng theo ngân sách vẽ mỗi khung, để chuyển "Của tôi" → "Toàn cảnh" không bị giật.

**Số chốt GĐ2** (2026-11-05, Chrome headless `--disable-gpu`, 1280×800, 10 đảo × 6 session, "Toàn cảnh"; JS mỗi khung
đo 10 giây; cú đổi = khung dài nhất trong 500ms sau "Của tôi" → "Toàn cảnh", 5 lần mỗi lượt đo):

| | `MID_MS` | `THUMB_PX` | p95 JS mỗi khung | Khung dài nhất sau khi đổi |
|---|---|---|---|---|
| Trước (GĐ1) | 100 | 120 | 7,7–13,7ms (trung vị 7,9) | 9,5–18,6ms; đổi không chờ camera: ~40ms |
| Chốt | **100** | **130** | 0,4–0,8ms | 8,2–16,0ms; đổi không chờ camera: ~7ms |

- `MID_MS` giữ 100: lên 150 hay 200 không hạ p95 (các lần vẽ `mid` đến theo cặp, p95 vẫn là khung có 2 lần vẽ).
- `THUMB_PX` = 130: 10 đảo ở 1280×800 rộng 125px, nên mọi giá trị 126–160 cho cùng kết quả; 130 chừa chút lề cho
  stage rộng hơn vài px. Đảo `mid` (5 đảo, 192px) vẫn vẽ lại sau tối đa ~118ms (`MID_MS` + một khung).
- Thêm một luật: khi camera đang chạy (đổi chế độ, bay tới đảo, cuộn zoom), đảo `mid`/`thumb` đã có canvas giữ nguyên
  mức chi tiết đang có (vẫn vẽ lại theo hạn), đổi mức khi camera dừng. Không có luật này, đảo đi qua `thumb` → `mid`
  → `thumb` trong lúc camera chạy và khung lúc đổi lên 16–20ms. Đảo đang xem vẫn vẽ `full` mọi khung.

### 12.4 Trang local

- Thanh trên có thêm chip "Thế giới": chưa ghép / đang gửi (mức Kín) / riêng tư / mất kết nối / bị thu hồi. Lấy từ
  `GET /api/public-preview` → `{state, share, private, hub, view}`.
- Cài đặt có công tắc **"Xem như người khác"**: khi bật, cảnh local vẽ `view` (kết quả `publicView`) thay cho ảnh
  chụp đầy đủ.
  - GĐ2 (em chọn): công tắc dùng được cả khi máy **chưa ghép**. Khi đó server local dùng một `salt` tạm sinh lúc khởi
    động (chỉ nằm trong RAM) và mức Kín, để người dùng xem trước mình sẽ lộ gì trước khi `join`. Đã ghép thì dùng đúng
    mức chia sẻ, danh sách project và chế độ riêng tư trong cấu hình.
  - Khi bật: không có bong bóng chữ, bảng chi tiết chỉ hiện trạng thái, nhóm việc, phòng ban, tool và model nếu có (như
    đảo người khác trong chế độ thế giới). Trạng thái bật/tắt không lưu, tải lại trang là tắt. Tắt thì trang y như cũ.

## 13. Kiểm thử

- **Đơn vị** (`node --test`):
  - `publicView`: dựng ảnh chụp có chuỗi bí mật giả (`sk-ant-…`, `/Users/x/secret`, `Authorization: Bearer`) ở
    **mọi** trường. Kiểm `JSON.stringify(kết quả)` không chứa chuỗi nào trong số đó, ở cả hai mức. Kiểm id ổn
    định và không phải session id thật. Kiểm ánh xạ `kind`, `dept`, `talkingTo`.
  - `validate`: khoá lạ, sai enum, chuỗi dài, tham chiếu tới id không tồn tại, gói 17KB.
  - `jwt`: tạo cặp khoá RSA trong test, JWKS giả, đủ các ca ở S7.
  - Kiểm tên miền, sinh `user_code`, token bucket, `Host` local, quyền file cấu hình.
  - Logic LOD và bố trí đảo (hàm thuần trong `<script id="world-logic">`).
- **Tích hợp**: khởi hub ở cổng ngẫu nhiên với DB tạm, `HUB_DEV_LOGIN=1` và fetch tới Google được thay bằng giả.
  Chạy đủ: đăng nhập → bắt đầu ghép → duyệt → lấy token → publish → đọc SSE thấy đảo → thu hồi → publish nhận 401 →
  SSE nhận `remove`. Thêm: CSRF thiếu hoặc sai trả 403, `Origin` lạ trả 403, người bị cấm không vào được.
- **Bằng mắt**: Chrome headless chụp chế độ local trước và sau refactor; chụp chế độ thế giới với 1, 5 và 10 đảo giả.
- **Hiệu năng**: script đo frame time như đã dùng, chạy với 10 đảo.

## 14. Vận hành

Biến môi trường của hub:

| Biến | Bắt buộc | Ví dụ |
|---|---|---|
| `HUB_PUBLIC_URL` | ✔ | `https://terrarium.newera.inc` |
| `HUB_ALLOWED_DOMAINS` | ✔ | `newera.inc` |
| `HUB_OWNER_EMAILS` | ✔ | `kiet.nc@newera.inc` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ✔ (trừ dev) | |
| `HUB_SECRET_KEY` | ✔ | 32 byte base64, mã hoá refresh token (B12) |
| `ALLOWED_HOSTS` (server local, không phải hub) | | `my-mac.local:4317` (B3) |
| `HUB_PORT` | | `4318` |
| `HUB_DB` | | `./data/hub.sqlite` |
| `HUB_TRUST_PROXY` | | `1` khi đứng sau proxy |
| `HUB_DEV_LOGIN` | | chỉ dùng khi phát triển |

`docs/hub-setup.md` hướng dẫn:
- tạo OAuth client trong Google Cloud project của Workspace newera.inc (consent screen **Internal**, redirect URI
  `<HUB_PUBLIC_URL>/auth/callback`);
- chạy sau Caddy hoặc Cloudflare Tunnel;
- sao lưu file DB;
- xoay vòng `GOOGLE_CLIENT_SECRET`.

Hub nghe ở `127.0.0.1` theo mặc định. Chỉ nghe ở `0.0.0.0` khi đặt `HUB_HOST`.

## 15. Để người làm tự quyết

- Tên lệnh con của `server.js` và chữ trên giao diện, miễn đúng tinh thần ở trên.
- Bảng 8 màu đảo, hình vòng xoắn cụ thể, kiểu nhãn đảo.
- Cách chia nhỏ module trong `hub/`, miễn giữ được ranh giới ở §8.1 (hàm thuần tách khỏi I/O).
- Router tự viết thế nào, miễn có bảng định tuyến rõ ràng và mặc định trả 404.
- Thứ tự các bước trong plan, miễn vá `Host` (S1) và `publicView` có test **trước** khi có bất kỳ đoạn code nào
  gửi dữ liệu ra ngoài.
