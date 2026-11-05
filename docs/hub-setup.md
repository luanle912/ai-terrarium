# Cài đặt hub (nhiều đảo, một bầu trời)

Hub là một server Node nhỏ (`hub/server.js`, không cần cài package) cho nhân viên newera.inc đăng nhập bằng Google,
ghép máy của mình rồi xem đảo của cả công ty. Thiết kế đầy đủ ở `docs/specs/2026-11-04-multi-island-design.md`.
Tài liệu này mô tả hub ở giai đoạn 2 (GĐ2): tự quản lý đảo, mất quyền tự động khi Google thu hồi, nhật ký.

Yêu cầu: **Node ≥ 22.13** cho hub, vì hub dùng `node:sqlite` có sẵn trong Node. Plugin local trên máy từng người vẫn chạy
được với Node 18 trở lên.

## 1. Tạo OAuth client trong Google Cloud

1. Vào Google Cloud project thuộc Workspace newera.inc, mở **APIs & Services → OAuth consent screen**.
2. Chọn kiểu người dùng **Internal**, để chỉ tài khoản trong Workspace đăng nhập được.
   Hub vẫn chỉ xin scope `openid email profile`, không xin thêm quyền nào.
3. Mở **Credentials → Create credentials → OAuth client ID**, loại **Web application**.
4. Thêm **Authorized redirect URI**: `<HUB_PUBLIC_URL>/auth/callback`
   (ví dụ `https://terrarium.newera.inc/auth/callback`).
5. Lấy `Client ID` và `Client secret` đặt vào `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Chỉ đặt qua biến môi trường,
   không ghi vào file trong repo.

## 2. Biến môi trường của hub

Thiếu hoặc sai biến thì hub từ chối khởi động và in ra **mọi** lỗi một lượt.

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `HUB_PUBLIC_URL` | ✔ | | URL công khai của hub, ví dụ `https://terrarium.newera.inc`. Phải là `https://`; `http://` chỉ được dùng với localhost |
| `HUB_ALLOWED_DOMAINS` | ✔ | | Tên miền email được đăng nhập, cách nhau bằng dấu phẩy, ví dụ `newera.inc` |
| `HUB_OWNER_EMAILS` | ✔ | | Email chủ hub (owner), cách nhau bằng dấu phẩy. Xem mục 3 |
| `HUB_SECRET_KEY` | ✔ (cả khi dev) | | 32 byte ngẫu nhiên mã hoá base64, dùng mã hoá refresh token Google khi lưu (AES-256-GCM). Sai độ dài hoặc không phải base64 thì hub không khởi động. Xem mục 2b |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ✔ (trừ khi `HUB_DEV_LOGIN=1`) | | OAuth client ở mục 1 |
| `HUB_PORT` | | `4318` | Cổng hub nghe |
| `HUB_HOST` | | `127.0.0.1` | Địa chỉ hub nghe. Chỉ đặt `0.0.0.0` khi thật sự cần. Khi bật `HUB_DEV_LOGIN` thì bắt buộc là địa chỉ loopback |
| `HUB_DB` | | `./data/hub.sqlite` | Đường dẫn file SQLite |
| `HUB_TRUST_PROXY` | | tắt | `1` khi đứng sau proxy: hub lấy IP người dùng từ mục cuối của `X-Forwarded-For` để giới hạn tần suất. Không bật thì mọi người dùng chung IP của proxy và chung một hạn mức. Không bật khi hub lộ thẳng ra mạng, vì header này giả được |
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
(thu hồi máy, xoá phiên, gỡ đảo khỏi bản đồ, đóng luồng xem). Lỗi mạng hoặc 5xx thì không cấm, thử lại ở lượt sau;
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
HUB_PUBLIC_URL=https://terrarium.newera.inc \
HUB_ALLOWED_DOMAINS=newera.inc HUB_OWNER_EMAILS=kiet.nc@newera.inc \
GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
HUB_TRUST_PROXY=1 HUB_DB=/var/lib/terrarium/hub.sqlite \
node hub/server.js
```

## 3. Đứng sau Caddy hoặc Cloudflare Tunnel

Hub nghe ở `127.0.0.1` và không tự lo HTTPS. Đặt một proxy phía trước và bật `HUB_TRUST_PROXY=1`.

Caddy:

```
terrarium.newera.inc {
  reverse_proxy 127.0.0.1:4318
}
```

Cloudflare Tunnel: trỏ hostname công khai tới `http://127.0.0.1:4318`.

Luồng SSE (`/api/world/stream`) cần proxy không đệm và không cắt kết nối rảnh quá sớm. Hub gửi dòng `: ping` mỗi
25 giây nên cấu hình mặc định của hai bên đều chạy được.

## 3b. Owner và nhật ký

**Owner** là người có email nằm trong `HUB_OWNER_EMAILS`. Vai trò không lưu trong DB mà tính lại ở **mỗi request**:
bỏ email khỏi biến môi trường (rồi khởi động lại hub) thì người đó về `member` ngay. Không có vai trò `admin`.

Quyền duy nhất của owner là **"Xoá đảo"** của một member ngay trên chế độ thế giới: hub thu hồi máy và xoá đảo của người
đó (người đó vẫn đăng nhập được và ghép máy lại để có đảo mới). Owner không xoá được đảo của owner khác. Không có cấm
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

- Trang thế giới (`claude-office.html`) được phục vụ với CSP theo hash: hub tính hash của từng `<script>` nội tuyến khi
  phục vụ, nên không cần `'unsafe-inline'` cho script. React tải từ `cdnjs.cloudflare.com` với SRI. Kèm theo là
  `frame-ancestors 'none'`, `Cross-Origin-Opener-Policy: same-origin` và HSTS khi dùng `https://`.
- Giới hạn tốc độ (token bucket, trả 429): đăng nhập 30 lần/giờ mỗi IP; bắt đầu ghép thiết bị 10 lần/giờ mỗi IP; gói
  `publish` 4 gói/giây (burst 8) mỗi máy; các route còn lại 120 yêu cầu/phút mỗi IP. Luồng SSE: 5 luồng đồng thời mỗi
  người, 300 luồng toàn hub. Sau proxy nhớ bật `HUB_TRUST_PROXY=1`, nếu không mọi người dùng chung một hạn mức.

## 4. Sao lưu

Toàn bộ dữ liệu nằm trong một file SQLite (`HUB_DB`). Sao lưu file đó theo lịch rồi chép bản sao đi nơi khác, ví dụ
bằng CLI `sqlite3`:

```bash
sqlite3 hub.sqlite ".backup 'hub-backup.sqlite'"
```
 Mất file thì mọi người phải ghép lại máy.

## 5. Cách người dùng tham gia

Trên máy của mỗi người, trong thư mục plugin (hoặc bản clone của repo):

```bash
node server.js join https://terrarium.newera.inc     # in mã thiết bị, mở trình duyệt để duyệt; thêm --name "Mac của tôi" nếu muốn
node server.js share kin                            # mức Kín (mặc định): chỉ trạng thái, phòng ban dạng chữ cái, loại việc
node server.js share co-ban                         # mức Cơ bản: thêm tên tool và model; tên dự án chỉ hiện nếu có trong `share projects`
node server.js share projects a,b                   # cho phép hiện tên các dự án này (ở mức Cơ bản)
node server.js private on                           # đảo hiện "riêng tư": không ai thấy nhân viên
node server.js private off
node server.js status                               # hub, token (4 ký tự cuối), mức chia sẻ, riêng tư, đã bị thu hồi chưa
node server.js leave                                # thu hồi máy này trên hub rồi xoá cấu hình local
```

- Cấu hình nằm ở `~/.claude-terrarium/config.json` (quyền `0600`). Chạy `join` lại để ghép lại sau khi bị thu hồi.
- Server local đang chạy sẽ đọc lại cấu hình trong vài giây: `private on` có hiệu lực trên hub trong chưa đầy 3 giây.
- Chỉ server giữ được cổng mới gửi trạng thái lên hub.
- Trang local hiện chip "Thế giới" khi máy đã tham gia hub. Trang của hub có hai chế độ: **Toàn cảnh** (cả bầu trời) và
  **Của tôi** (đảo của mình).
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
