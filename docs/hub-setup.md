# Cài đặt hub (nhiều đảo, một bầu trời)

Hub là một server Node nhỏ (`hub/server.js`, không cần cài package) cho nhân viên newera.inc đăng nhập bằng Google,
ghép máy của mình rồi xem đảo của cả công ty. Thiết kế đầy đủ ở `docs/specs/2026-11-04-multi-island-design.md`.
Tài liệu này chỉ nói phần giai đoạn 1 (GĐ1).

Yêu cầu: **Node ≥ 22.13** cho hub, vì hub dùng `node:sqlite` có sẵn trong Node. Plugin local trên máy từng người vẫn chạy
được với Node 18 trở lên.

## 1. Tạo OAuth client trong Google Cloud

1. Vào Google Cloud project thuộc Workspace newera.inc, mở **APIs & Services → OAuth consent screen**.
2. Chọn kiểu người dùng **Internal**, để chỉ tài khoản trong Workspace đăng nhập được.
3. Mở **Credentials → Create credentials → OAuth client ID**, loại **Web application**.
4. Thêm **Authorized redirect URI**: `<HUB_PUBLIC_URL>/auth/callback`
   (ví dụ `https://terrarium.newera.inc/auth/callback`).
5. Lấy `Client ID` và `Client secret` đặt vào `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Chỉ đặt qua biến môi trường,
   không ghi vào file trong repo.

## 2. Biến môi trường của hub

Thiếu hoặc sai biến thì hub từ chối khởi động và in ra **mọi** lỗi một lượt.

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `HUB_PUBLIC_URL` | ✔ | | URL công khai của hub, ví dụ `https://terrarium.newera.inc` |
| `HUB_ALLOWED_DOMAINS` | ✔ | | Tên miền email được đăng nhập, cách nhau bằng dấu phẩy, ví dụ `newera.inc` |
| `HUB_OWNER_EMAILS` | ✔ | | Email chủ hub (quản trị), cách nhau bằng dấu phẩy |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ✔ (trừ khi `HUB_DEV_LOGIN=1`) | | OAuth client ở mục 1 |
| `HUB_PORT` | | `4318` | Cổng hub nghe |
| `HUB_HOST` | | `127.0.0.1` | Địa chỉ hub nghe. Chỉ đặt `0.0.0.0` khi thật sự cần |
| `HUB_DB` | | `./data/hub.sqlite` | Đường dẫn file SQLite |
| `HUB_TRUST_PROXY` | | tắt | `1` khi đứng sau proxy: hub lấy IP người dùng từ mục cuối của `X-Forwarded-For` để giới hạn tần suất. Không bật thì mọi người dùng chung IP của proxy và chung một hạn mức. Không bật khi hub lộ thẳng ra mạng, vì header này giả được |
| `HUB_DEV_LOGIN` | | tắt | `1` bật đăng nhập giả, **chỉ để phát triển trên máy local** |

`HUB_DEV_LOGIN=1` bỏ qua Google và cho đăng nhập bằng một đường dẫn tự gõ email. Hub chỉ cho bật khi `HUB_PUBLIC_URL`
là `http://localhost` hoặc `http://127.0.0.1`. Không bao giờ dùng trên máy chủ thật.

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
node server.js leave                                # xoá cấu hình local
```

- Cấu hình nằm ở `~/.claude-terrarium/config.json` (quyền `0600`). Chạy `join` lại để ghép lại sau khi bị thu hồi.
- Server local đang chạy sẽ đọc lại cấu hình trong vài giây: `private on` có hiệu lực trên hub trong chưa đầy 3 giây.
- Chỉ server giữ được cổng mới gửi trạng thái lên hub.
- Trang local hiện chip "Thế giới" khi máy đã tham gia hub. Trang của hub có hai chế độ: **Toàn cảnh** (cả bầu trời) và
  **Của tôi** (đảo của mình).
- Thu hồi một máy ở trang `/me` của hub: publisher ghi `revoked` và dừng gửi.

## 6. Server local: host và CORS

Server local (cổng `4317`) chỉ tin các tên loopback trên đúng cổng của nó, để chống DNS rebinding (B3). Nếu có người
mở trang local qua tunnel hoặc qua LAN, thêm tên đó vào `ALLOWED_HOSTS`, cách nhau bằng dấu phẩy:

```bash
ALLOWED_HOSTS=my-mac.local:4317 node server.js
```

CORS của server local đã siết (B4): mặc định không cho origin nào khác đọc. Muốn cho một trang cụ thể (ví dụ trang
hosted) gọi tới, đặt `ALLOWED_ORIGIN=https://origin-cua-trang`.

Các biến khác của server local: `PORT` (mặc định `4317`), `CLAUDE_DIR` (mặc định `~/.claude/projects`).
