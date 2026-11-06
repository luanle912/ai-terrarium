# Cài đặt hub (nhiều đảo, một bầu trời)

Hub là một server Node nhỏ (`hub/server.js`, không cần cài package) cho mọi người đăng nhập bằng Google, ghép máy của
mình rồi xem đảo của nhau. Hub công khai đang chạy ở https://terrarium.openlabs.click; tài liệu này dành cho ai muốn
dựng hub riêng, ví dụ chỉ cho tài khoản một công ty. Thiết kế đầy đủ ở `docs/specs/2026-11-04-multi-island-design.md`.
Tài liệu này mô tả hub ở giai đoạn 3 (GĐ3): tự quản lý đảo, mất quyền tự động khi Google thu hồi, nhật ký, và bầu trời
8 đảo (mục 3d).

Yêu cầu: **Node ≥ 22.13** cho hub, vì hub dùng `node:sqlite` có sẵn trong Node. Plugin local trên máy từng người vẫn chạy
được với Node 18 trở lên.

## 1. Tạo OAuth client trong Google Cloud

1. Mở **APIs & Services → OAuth consent screen** (Google Auth Platform) trong Google Cloud project của bạn.
2. Chọn kiểu người dùng:
   - **Internal** nếu hub chỉ dành cho một Google Workspace (đặt `HUB_ALLOWED_DOMAINS` là tên miền đó);
   - **External** nếu mở cho mọi tài khoản Google (đặt `HUB_ALLOWED_DOMAINS=*`), rồi **Publish app** ở mục Audience.
     Hub chỉ xin `openid email profile` là các quyền không nhạy cảm, nên không phải chờ Google duyệt mới đăng nhập được;
     phần duyệt branding (logo trên màn hình đồng ý) là tuỳ chọn, logo dùng `assets/logo.png`.
3. Mở **Credentials → Create credentials → OAuth client ID**, loại **Web application**.
4. Thêm **Authorized redirect URI**: `<HUB_PUBLIC_URL>/auth/callback`
   (ví dụ `https://terrarium.example.com/auth/callback`).
5. Lấy `Client ID` và `Client secret` đặt vào `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Chỉ đặt qua biến môi trường,
   không ghi vào file trong repo.

## 2. Biến môi trường của hub

Thiếu hoặc sai biến thì hub từ chối khởi động và in ra **mọi** lỗi một lượt.

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `HUB_PUBLIC_URL` | ✔ | | URL công khai của hub, ví dụ `https://terrarium.example.com`. Phải là `https://`; `http://` chỉ được dùng với localhost |
| `HUB_ALLOWED_DOMAINS` | ✔ | | Tên miền email được đăng nhập, cách nhau bằng dấu phẩy, ví dụ `example.com`. `*` cho mọi tài khoản Google đã xác minh email (kể cả Gmail cá nhân) |
| `HUB_OWNER_EMAILS` | ✔ | | Email chủ hub (owner), cách nhau bằng dấu phẩy. Xem mục 3 |
| `HUB_SECRET_KEY` | ✔ (cả khi dev) | | 32 byte ngẫu nhiên mã hoá base64, dùng mã hoá refresh token Google khi lưu (AES-256-GCM). Sai độ dài hoặc không phải base64 thì hub không khởi động. Xem mục 2b |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ✔ (trừ khi `HUB_DEV_LOGIN=1`) | | OAuth client ở mục 1 |
| `HUB_PORT` | | `4318` | Cổng hub nghe |
| `HUB_HOST` | | `127.0.0.1` | Địa chỉ hub nghe. Chỉ đặt `0.0.0.0` khi thật sự cần. Khi bật `HUB_DEV_LOGIN` thì bắt buộc là địa chỉ loopback |
| `HUB_DB` | | `./data/hub.sqlite` | Đường dẫn file SQLite |
| `HUB_TRUST_PROXY` | | tắt | `1` khi đứng sau proxy: hub lấy IP người dùng từ mục cuối của `X-Forwarded-For` để giới hạn tần suất. `cloudflare` khi đứng sau Cloudflare Tunnel: hub lấy `CF-Connecting-IP` (nếu là IP hợp lệ, không thì như `1`). Không bật thì mọi người dùng chung IP của proxy và chung một hạn mức. Không bật khi hub lộ thẳng ra mạng, vì các header này giả được. Giá trị khác `1`/`cloudflare` là lỗi cấu hình |
| `HUB_METRICS_TOKEN` | | tắt | Token Bearer cho `GET /metrics`, ít nhất 32 ký tự (ví dụ `openssl rand -hex 32`). Để trống thì `/metrics` trả 404. Ngắn hơn 32 ký tự là lỗi cấu hình |
| `HUB_DEV_LOGIN` | | tắt | `1` bật đăng nhập giả, **chỉ để phát triển trên máy local** |

`HUB_DEV_LOGIN=1` bỏ qua Google và cho đăng nhập bằng một đường dẫn tự gõ email. Hub chỉ cho bật khi `HUB_PUBLIC_URL`
là `http://localhost` hoặc `http://127.0.0.1`, và `HUB_HOST` (nếu đặt) là địa chỉ loopback. Không bao giờ dùng trên máy
chủ thật. Đăng nhập giả không có refresh token Google nên phiên và máy chỉ sống 24 giờ (xem mục 2b).

Khi `HUB_PUBLIC_URL` là `https://`, hub gửi thêm `Strict-Transport-Security: max-age=31536000` ở mọi phản hồi và dùng
cookie `__Host-` ở chế độ `Secure`.

### 2b. `HUB_SECRET_KEY` và quyền truy cập offline của Google

Tạo khoá một lần và giữ kín, như `GOOGLE_CLIENT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Vì sao cần.** Khi một người nghỉ việc, hub phải biết để cắt quyền trong vòng 24 giờ (B12). Hub làm việc đó bằng
refresh token của Google: mỗi giờ hub kiểm những người có lần kiểm gần nhất cũ hơn 24 giờ, đổi refresh token lấy
token mới. Google trả `invalid_grant` hoặc ID token không còn khớp tên miền thì hub tự cấm với lý do `google_revoked`
(thu hồi máy, xoá phiên, đóng luồng xem; đảo chuyển sang offline và vẫn giữ chỗ trên bầu trời, xem mục 3d). Lỗi mạng hoặc 5xx thì không cấm, thử lại ở lượt sau;
lỗi liên tục quá 72 giờ thì ghi cảnh báo vào `audit`. Refresh token nằm trong DB đã mã hoá bằng `HUB_SECRET_KEY`.

**Cách xin.** `/auth/login` gửi `access_type=offline` và `prompt=select_account`, scope vẫn `openid email profile`.
Google chỉ trả refresh token ở lần đồng ý đầu tiên, nên người dùng mới sẽ thấy **màn hình đồng ý** của Google một lần
(hub chuyển hướng lại một lần với `prompt=consent` nếu chưa có refresh token). Người nào vẫn không có refresh token
thì phiên xem sống tối đa 24 giờ, và máy của họ nhận **403 `login_required`** khi quá 24 giờ kể từ lần đăng nhập gần
nhất. Publisher tạm dừng (không đánh dấu `revoked`); đăng nhập lại là máy gửi tiếp. Người bị cấm vì `google_revoked`
được gỡ cấm khi đăng nhập thành công lại.

**Đổi khoá.** Đổi `HUB_SECRET_KEY` thì hub không giải mã được các refresh token cũ: hub bỏ chúng (ghi `refresh_unreadable`
vào `audit`) và những người đó về luật 24 giờ: phiên xem của họ bị cắt khi quá 24 giờ kể từ lúc tạo (dù ban đầu sống 7 ngày),
và máy nhận 403 `login_required`, cho tới khi đăng nhập lại và cấp lại refresh token. Đừng đổi khoá nếu không cần.

**Giới hạn của Google:** mỗi tài khoản chỉ giữ tối đa 100 refresh token cho mỗi OAuth client; cấp token thứ 101 thì
token cũ nhất bị huỷ. Với việc người dùng đăng nhập lại bình thường thì không chạm giới hạn này.

Rời hub (`/me/leave`) hoặc bị cấm thì hub gọi `https://oauth2.googleapis.com/revoke` để huỷ refresh token, rồi xoá nó
khỏi DB.

Chạy thử:

```bash
HUB_PUBLIC_URL=https://terrarium.example.com \
HUB_ALLOWED_DOMAINS=example.com HUB_OWNER_EMAILS=owner@example.com \
GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
HUB_TRUST_PROXY=1 HUB_DB=/var/lib/terrarium/hub.sqlite \
node hub/server.js
```

## 3. Đứng sau Caddy hoặc Cloudflare Tunnel

Hub nghe ở `127.0.0.1` và không tự lo HTTPS. Đặt một proxy phía trước và bật `HUB_TRUST_PROXY=1`.

Caddy:

```
terrarium.example.com {
  reverse_proxy 127.0.0.1:4318
}
```

Cloudflare Tunnel: trỏ hostname công khai tới `http://127.0.0.1:4318` và đặt `HUB_TRUST_PROXY=cloudflare` để hub lấy IP
người dùng từ `CF-Connecting-IP`. **Chỉ** dùng `cloudflare` khi origin chỉ đi tới được qua Cloudflare Tunnel (hub nghe ở
`127.0.0.1`, không mở cổng ra ngoài): nếu origin lộ ra mạng, ai cũng giả được header này.

**Khởi động lại êm.** Khi nhận SIGTERM (hoặc SIGINT), hub báo cho từng luồng SSE `event: restarting` kèm `retry:` ngẫu
nhiên 5–20 giây rồi mới đóng, nên trang người xem quay lại sau khi hub lên lại thay vì gặp 502 của proxy và dừng hẳn.
Cứ dừng hub bằng `systemctl stop`/`kill` (SIGTERM) như thường; đừng dùng `kill -9`.

Người xem tự kết nối lại sau đúng `retryMs` của hub (5–20 giây, rải đều để 300 luồng không dồn vào một giây) và vẫn giữ cảnh
đang xem; trang cũ chạy `EventSource` trần cũng chờ theo dòng `retry:` đó. Khung `restarting` được ghi ngay trước khi
đóng kết nối, nên một proxy có thể làm rơi nó: khi đó người xem rơi về lùi nhịp của chính họ (1, 2, 4, 8, 16 rồi 30 giây).
Đã đo với 300 luồng: 300/300 có lại luồng sau 20 giây, mỗi người nhận tối đa 18 sự kiện `world` trong 30 giây đầu.

**90 giây đầu sau khi hub lên.** Hub mất bộ nhớ khi khởi động lại, nên một đảo chưa gửi lại gói nào hiện `waking: true`
trong `world` (vẫn `online: false`) tối đa 90 giây, và trang vẽ nó là "đang chờ máy gửi lại" thay vì offline. Publisher
của các máy đang chạy gửi lại trong chưa tới 30 giây (nhịp tim) nên đảo đó sáng lại trước hạn; đảo của máy đã tắt hết
cửa sổ 90 giây thì chuyển thành offline.

Luồng SSE (`/api/world/stream`) cần proxy không đệm và không cắt kết nối rảnh quá sớm. Hub gửi dòng `: ping` mỗi
25 giây nên cấu hình mặc định của hai bên đều chạy được.

## 3b. Owner và nhật ký

**Owner** là người có email nằm trong `HUB_OWNER_EMAILS`. Vai trò không lưu trong DB mà tính lại ở **mỗi request**:
bỏ email khỏi biến môi trường (rồi khởi động lại hub) thì người đó về `member` ngay. Không có vai trò `admin`.

Quyền duy nhất của owner là **"Xoá đảo"** của một member ngay trên chế độ thế giới: hub thu hồi máy và xoá đảo của người
đó, **trả lại một chỗ** trong 8 chỗ của hub (người đó vẫn đăng nhập được và ghép máy lại để có đảo mới, nếu hub còn chỗ). Owner không xoá được đảo của owner khác. Không có cấm
hay bỏ cấm bằng tay: cấm chỉ xảy ra tự động theo `google_revoked`.

**Lưu ý email cấp lại (B6).** Nếu Workspace xoá một tài khoản rồi cấp lại cùng email cho người khác, người mới có `sub`
Google mới nên là một người dùng mới trong hub. Nếu email đó vẫn nằm trong `HUB_OWNER_EMAILS` thì người mới thành owner.
Việc này do quản trị Workspace kiểm soát: khi cấp lại email của một owner cũ, hãy gỡ email khỏi `HUB_OWNER_EMAILS`
trước nếu không muốn người mới có quyền đó.

**Nhật ký.** Hub ghi các việc quan trọng vào bảng `audit` (thời điểm tính bằng mili giây, người làm, hành động, đối
tượng, IP), ví dụ `user_banned`, `ban_lifted`, `island_removed`, `island_updated`, `device_revoked`, `user_left`,
`google_check_failing`, `refresh_unreadable`. Chưa có trang xem; đọc bằng CLI `sqlite3`, 200 dòng mới nhất:

```bash
sqlite3 hub.sqlite "SELECT datetime(at/1000,'unixepoch') AS time, actor_id, action, target, ip FROM audit ORDER BY id DESC LIMIT 200;"
```

## 3c. Bảo vệ trình duyệt và giới hạn tốc độ

- Trang thế giới (`claude-office.html`) không còn script nội tuyến: mã của trang là các file trong `web/`, hub phục vụ
  chúng ở `/web/...` (chỉ tên `[a-z0-9-]`, đuôi `.js`/`.css`, `Cache-Control: no-cache`). CSP là `script-src 'self'`
  cộng `cdnjs.cloudflare.com` (React, có SRI); script nội tuyến nào còn sót sẽ được hash lúc phục vụ, nên không bao giờ
  cần `'unsafe-inline'` cho script. Kèm theo là `frame-ancestors 'none'`, `Cross-Origin-Opener-Policy: same-origin` và
  HSTS khi dùng `https://`.
- Giới hạn tốc độ (token bucket, trả 429): đăng nhập 30 lần/giờ mỗi IP; bắt đầu ghép thiết bị 10 lần/giờ mỗi IP; gói
  `publish` 4 gói/giây (burst 8) mỗi máy; các route còn lại 120 yêu cầu/phút mỗi IP, trừ file tĩnh `/web/...` (mỗi lần
  mở trang tải khoảng 40 file). Luồng SSE: 5 luồng đồng thời mỗi người (429 kèm `Retry-After: 10`), 300 luồng toàn hub
  (503 kèm `Retry-After: 30`). Sau proxy nhớ bật `HUB_TRUST_PROXY=1` (hoặc `cloudflare`), nếu không mọi người dùng chung
  một hạn mức.

## 3d. Sức chứa: tối đa 8 đảo

Một hub chứa **tối đa 8 đảo**, mỗi đảo một **chỗ cố định** (slot 0 đến 7) trên bầu trời. Con số này nằm trong code
(`MAX_ISLANDS` ở `hub/db.js`), **không có biến môi trường để nâng**.

- **Ai tính vào 8.** Mỗi người có một đảo (bản ghi `islands`) chiếm một chỗ, kể cả khi họ offline, đã thu hồi hết máy,
  hay bị cấm `google_revoked`. Đảo của họ vẫn nằm ở chỗ cũ trên bầu trời, mờ đi như đảo offline, cho tới khi bị xoá.
  Người chưa ghép máy lần nào không tính.
- **Chỗ cố định.** Đảo mới nhận slot trống nhỏ nhất và không bao giờ đổi slot, kể cả khi hub khởi động lại. Chỗ của đảo
  offline không bị vẽ thành "chỗ trống".
- **Người thứ 9 thấy gì.** Họ đăng nhập được và xem bầu trời bình thường; ô giữa của họ ghi **"Hub đã đủ 8 đảo"**
  (bấm không làm gì). Khi duyệt mã ghép máy ở `/device`, trang báo **"Hub đã đủ 8 đảo, nhờ owner xoá bớt."** và mã bị
  từ chối hẳn; lệnh `join` của họ in `join: the hub is full (8 islands); ask a hub owner to remove one` rồi thoát với mã 1,
  không ghi config nào. Người **đã có đảo** vẫn ghép thêm máy được khi hub đủ.
- **Trả chỗ.** Owner bấm **"Xoá đảo"** ở bảng thông tin của đảo đó (chế độ thế giới; xem mục 3b), hoặc chính người đó
  **rời hub** ở `/me/leave`. Ô trống hiện ra ở mọi tab ngay (sự kiện `remove`), và người tiếp theo ghép máy sẽ nhận đúng chỗ
  đó. Thu hồi máy hay cấm tự động thì **không** trả chỗ: đảo chuyển offline và giữ chỗ.
- **Tranh chỗ cuối.** Kiểm đủ chỗ và tạo đảo nằm trong một transaction, cộng chỉ mục `UNIQUE` trên `slot`: hai người cùng
  duyệt mã khi chỉ còn một chỗ thì đúng một người được, người kia thấy câu báo đủ chỗ.

## 3e. Nâng cấp lên bản "connection hardening" (đợt 1)

- **Câu trả lời của `POST /api/publish`.** Hub giờ trả `200 {"accepted": true}` khi nhận gói, hoặc `200 {"accepted": false,
  "reason": "stale_seq", "seq": n}` (hub đang giữ seq mới hơn: publisher nhảy tới `n + 1` và gửi lại) hoặc
  `{"accepted": false, "reason": "other_instance"}` (một publisher khác trên cùng máy đang gửi: publisher này chuyển sang
  `standby` và thử lại sau 30 giây). Gói sai vẫn là `400`/`413`; publisher mới hiện `offline`, ghi lý do vào log và thử lại
  mỗi 15 giây thay vì coi là đã gửi. Thân gói không đổi, không có khoá mới.
- **Header `X-Terrarium-Instance`.** Mỗi publisher gửi một mã ngẫu nhiên 16 hex; hub chỉ cho instance mới nhất của một máy
  gửi. Thiếu header = instance `legacy`.
- **Luồng `GET /api/world/stream`.** Ngoài comment `: ping`, hub gửi sự kiện có tên `event: ping` mỗi 25 giây để trang phát
  hiện luồng treo.
- **Thứ tự deploy: hub trước, rồi tới plugin; không cần làm cùng lúc.** Hub mới chạy được với mọi publisher cũ (200 thay vì
  204: publisher cũ coi 200 như 204 và bỏ qua thân, đúng như hôm nay). Publisher mới chạy được với hub cũ (204 được hiểu là
  đã nhận; không gửi khoá nào hub cũ từ chối). Trang mới trên tiến trình hub cũ không bật canh gác vì thiếu `ping` có tên,
  và cư xử như trước. Bảng đầy đủ nằm ở mục 9 của `docs/specs/2026-11-06-connection-hardening-design.md`; ma trận
  cũ/mới được kiểm bằng `tests/compat-matrix.test.mjs` (lấy code cũ từ git `21e9bd8`).

## 3f. Triển khai đợt 2 (khởi động lại êm, ngủ/tỉnh)

- **Kiểm `HUB_TRUST_PROXY` của môi trường thật trước khi deploy.** Chỉ nhận `''`, `1` hoặc `cloudflare`; mọi giá trị khác
  làm hub không khởi động (lỗi `HUB_TRUST_PROXY must be 1 or cloudflare`). Bản cũ lặng lẽ bỏ qua giá trị lạ.
- **Thứ tự: hub trước, rồi tới plugin** (xem mục 3e). Trang cũ vẫn chạy với hub mới: `retry:` được trình duyệt tôn trọng.
- **`Retry-After`** của giới hạn luồng (429 mỗi người, 503 toàn hub) dành cho client: `EventSource` của trình duyệt bỏ qua
  header này (trang chỉ đọc được `Retry-After` của câu trả lời 429 từ `/api/config` rồi chờ đúng thời gian); client tự viết
  nên đọc và làm theo.
- **Máy ngủ/tỉnh.** Publisher thấy khoảng trống giữa hai nhịp quá 10 giây thì ghi `terrarium: woke up; resending` và gửi
  lại ngay; trang thế giới nối lại tức thì khi trình duyệt báo `online` hoặc tab hiện lại, và giữ cảnh tới 5 phút mất kết nối.

## 3g. Theo dõi hub: `/healthz` và `/metrics`

- **`GET /healthz`** (hoặc `HEAD`) dành cho uptime monitor: không cần đăng nhập, trả `200 {ok, uptimeS, db, streams, version}`,
  hoặc `503 {ok: false, db: "error"}` khi không đọc được SQLite. Nó đi qua giới hạn tần suất chung như mọi route, nên
  đừng thăm dò dày hơn vài giây một lần. `HEAD /` và `HEAD` các file `/web/*` cũng dùng được; `HEAD /api/world/stream` là 405.
- **`GET /metrics`** (định dạng Prometheus) chỉ bật khi đặt `HUB_METRICS_TOKEN`; gọi với `Authorization: Bearer <token>`
  (sai hoặc thiếu: 401). Không có token, email hay tên nào trong đó. Số liệu: `terrarium_uptime_seconds`,
  `terrarium_streams`, `terrarium_islands_slotted`, `terrarium_islands_online`,
  `terrarium_publish_total{result="accepted|stale_seq|other_instance|bad_packet|too_large|rate_limited|unauthorized"}`,
  `terrarium_stream_refused_total{reason="hub_cap|user_cap"}`, `terrarium_http_429_total`,
  `terrarium_world_broadcasts_total`, `terrarium_frames_written_total`. Bộ đếm về 0 khi hub khởi động lại.
- Sự kiện `world` có thêm `now` (giờ của hub) và mỗi đảo có `lastAt` (lần cuối nghe được một máy của đảo, `null` nếu hub
  chưa nghe từ khi khởi động); `/api/me` có `devices[].lastAt` tương tự.

## 4. Sao lưu

Toàn bộ dữ liệu nằm trong một file SQLite (`HUB_DB`). Sao lưu file đó theo lịch rồi chép bản sao đi nơi khác, ví dụ
bằng CLI `sqlite3`:

```bash
sqlite3 hub.sqlite ".backup 'hub-backup.sqlite'"
```
 Mất file thì mọi người phải ghép lại máy.

## 5. Cách người dùng tham gia

Cách dễ nhất: trên trang local `http://localhost:4317`, mở ⚙ Cài đặt, mục **Thế giới**, bấm **Tham gia thế giới**.
Máy xin mã từ hub rồi mở trang duyệt với mã đã điền sẵn; người dùng đăng nhập (nếu chưa) và bấm **Cho phép**. Mở link
không tự duyệt gì: vẫn phải bấm "Cho phép", và mã sai trong link bị tính vào giới hạn 5 lần như khi gõ tay. **Thoát
thế giới** trong cùng mục làm việc của `leave`. Nút này trỏ về `https://terrarium.openlabs.click`; hub riêng thì đặt
`TERRARIUM_HUB=https://terrarium.example.com` cho server local.

Từ terminal, trong thư mục plugin (hoặc bản clone của repo):

```bash
node server.js join https://terrarium.example.com    # Pair this machine: prints a device code and opens the approval page (optional: --name "My Mac")
node server.js share kin                            # Private level (default): status, department letter and task type only
node server.js share co-ban                         # Basic level: also shares tool and model names; project names only if listed via `share projects`
node server.js share projects a,b                   # Allow these project names to be shown (Basic level only)
node server.js private on                           # Mark the island as private: no one sees its agents
node server.js private off                          # Make the island visible again
node server.js status                               # Show hub URL, token (last 4 characters), share level, privacy and revocation state
node server.js leave                                # Revoke this device on the hub, then remove the local config
```

- Cấu hình nằm ở `~/.claude-terrarium/config.json` (quyền `0600`). Chạy `join` lại để ghép lại sau khi bị thu hồi.
- Server local đang chạy sẽ đọc lại cấu hình trong vài giây: `private on` có hiệu lực trên hub trong chưa đầy 3 giây.
- Chỉ server giữ được cổng mới gửi trạng thái lên hub.
- Trang local hiện chip "Thế giới" khi máy đã tham gia hub. Trang của hub có hai chế độ: **Toàn cảnh** (8 chỗ quanh đảo của người
  xem; bấm một đảo để vào, **Esc** để ra) và **Của tôi** (đảo của mình).
- Thu hồi một máy ở trang `/me` của hub: publisher ghi `revoked` và dừng gửi.
- `leave` giờ cũng **thu hồi máy này trên hub** trước khi xoá cấu hình local. Hub không với tới được thì lệnh in thông
  báo và chỉ đường tới `/me` để thu hồi tay. `join` lại cũng tự thu hồi token cũ.
- **Tự quản lý đảo trên web (GĐ2).** Ở chế độ **Của tôi** và trang `/me`: đổi tên và màu đảo, xem từng máy với trạng
  thái gửi (Đang gửi, Riêng tư, Ngoại tuyến, Đã thu hồi), thu hồi máy, và **rời hub** (`/me/leave`, có bước xác nhận):
  xoá đảo, máy, phiên và huỷ refresh token Google. Máy mới thêm trong 7 ngày hiện thông báo "Máy mới" kèm nút thu hồi.
  Dữ liệu lấy từ `GET /api/me`.
- **Xem như người khác (GĐ2).** Trang local có công tắc "Xem như người khác" trong Cài đặt, vẽ đúng phần người khác sẽ
  thấy. Dùng được cả khi máy chưa `join`, để xem trước mình sẽ lộ gì. Tải lại trang là tắt.

## 6. Server local: host và CORS

Server local (cổng `4317`) chỉ tin các tên loopback trên đúng cổng của nó, để chống DNS rebinding (B3). Nếu có người
mở trang local qua tunnel hoặc qua LAN, thêm tên đó vào `ALLOWED_HOSTS`, cách nhau bằng dấu phẩy:

```bash
ALLOWED_HOSTS=my-mac.local:4317 node server.js
```

CORS của server local đã siết (B4): mặc định không cho origin nào khác đọc. Muốn cho một trang cụ thể (ví dụ trang
hosted) gọi tới, đặt `ALLOWED_ORIGIN=https://origin-cua-trang`.

Các biến khác của server local: `PORT` (mặc định `4317`), `CLAUDE_DIR` (mặc định `~/.claude/projects`).

## 7. Nâng cấp từ GĐ1

DB GĐ1 được nâng cấp tại chỗ khi bản mới khởi động (`PRAGMA user_version` lên 2). Thứ tự:

1. Dừng hub.
2. Sao lưu `hub.sqlite` (mục 4).
3. Đặt `HUB_SECRET_KEY` (mục 2b).
4. Chạy bản mới trên cùng file DB.

Người dùng GĐ1 chưa có refresh token, nên phiên của họ bị rút về tối đa 24 giờ kể từ lúc tạo và máy của họ nhận
403 `login_required` khi quá 24 giờ kể từ lần đăng nhập gần nhất. Mọi người cần **đăng nhập lại trên hub trong 24 giờ**
(sẽ thấy màn hình đồng ý của Google) để máy tiếp tục gửi; publisher tự gửi tiếp sau đó, không cần `join` lại.

Nếu hub đứng sau proxy, kiểm tra `HUB_TRUST_PROXY` **trước khi nâng cấp** (mục 2 và 3): đăng nhập bị giới hạn 30 lần mỗi giờ theo IP,
nên nếu hub không thấy IP thật thì cả văn phòng dùng chung một lượt đếm và dễ bị khoá đúng ngày nâng cấp.

## 8. Nâng cấp từ GĐ2 lên v3 (bầu trời 8 đảo)

DB GĐ2 (`PRAGMA user_version` 2) được nâng cấp tại chỗ khi bản mới khởi động; DB GĐ1 nâng thẳng lên v3. Thứ tự giống mục 7:
dừng hub, sao lưu `hub.sqlite` (mục 4), chạy bản mới trên cùng file. Không cần đặt thêm biến môi trường nào.

Migration thêm cột `islands.slot` (chỉ mục `UNIQUE` trên các slot khác `NULL`) và cột `device_codes.deny_reason`, rồi gán chỗ
theo **thứ tự tạo đảo** (`created_at`, rồi `id`): 8 đảo cũ nhất nhận slot 0 đến 7.

Hub GĐ2 không giới hạn số đảo, nên nếu hub đang có **hơn 8 đảo** thì:

- Không đảo nào bị xoá. Đảo thứ 9 trở đi có `slot = NULL`: **ẩn**, không hiện ở "Toàn cảnh" và không có trong sự kiện `world`,
  nhưng vẫn là đảo của người đó và vẫn tính vào số đảo của hub.
- Hub vẫn tính là **đủ**: người mới chưa có đảo bị từ chối như ở mục 3d.
- Owner xoá bớt các đảo đang hiện bằng "Xoá đảo". Mỗi lần một chỗ được trả, **đảo ẩn cũ nhất** hiện vào đúng chỗ đó (nó chưa
  từng có slot nên đây không phải đổi slot). Cứ thế cho tới khi hết đảo ẩn.

Kiểm sau khi nâng cấp:

```bash
sqlite3 hub.sqlite "PRAGMA user_version;"                                           # 3
sqlite3 hub.sqlite "SELECT slot, name FROM islands ORDER BY created_at, id;"        # slot 0..7, rồi NULL cho đảo ẩn
```

Đã chạy thật trên một DB GĐ2 có 10 đảo: `user_version` 3, slot 0 đến 7 theo thứ tự tạo, 2 đảo ẩn; owner xoá đảo ở slot 2 thì
đảo ẩn cũ nhất nhận slot 2.
