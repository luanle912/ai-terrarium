# Hiệu năng website (hub) và trang thường: đo, các hướng, đề xuất

Ngày: 2026-11-10 · Người đặt hàng: anh Kiệt · Người viết: Claude

Lời anh Kiệt: "kiểm tra luôn perf luôn nhé, tối ưu hiệu năng, brainstorm y như nãy giúp anh" (sau phần hình nền, xem
`2026-11-10-wallpaper-perf-design.md`).

## 1. Đo được gì

### Phía trình duyệt (Chrome headless, 1512×982 @2x, máy anh)

| Trang | Khung/s | Tab (renderer) | GPU | JS bận | Heap JS |
|---|---|---|---|---|---|
| Trang local thường (một đảo, 3 phiên) | 60 | ~61 % | ~41 % | 33 % thời gian | 8 MB |
| Hub, tổng quan 8 đảo (6 phiên mỗi đảo, cập nhật mỗi giây) | 60 | ~11 % | ~9 % | 7,5 % | 17 MB |

- Tổng quan 8 đảo đã nhẹ: mỗi đảo là ảnh vẽ sẵn thu nhỏ, chỉ người và mây chuyển động.
- Nặng là **một đảo đầy đủ** (trang local, và trên hub khi bấm vào một đảo: cùng bộ vẽ, `SCENE_METHODS`): ~8 ms JS
  mỗi khung × 60 khung, phần lớn là vẽ đồ đạc và sàn (`office-draw.js`), cộng ghép ba canvas lên GPU.

### Phía server hub (rà code, agent đọc `hub/`, `lib/`)

Đã làm tốt, **không làm lại**: sự kiện `world` gộp tối đa 1 lần/s và chỉ khi khác; mỗi khung chỉ `JSON.stringify` một
lần cho mọi người xem; `island` tối đa 2 lần/s mỗi đảo; ảnh chụp đảo nằm trong RAM, không đụng DB; người xem chậm bị cắt
khi đệm quá 1 MB; ping chung một timer; publisher chỉ gửi khi đổi + nhịp 30 s; giới hạn tần suất có chặn trên.

Chỗ còn tốn:

| # | Chỗ | Bao nhiêu | Ghi chú |
|---|---|---|---|
| H1 | `/web/*.js|css`: mỗi lần tải trang đọc đĩa đồng bộ ~30 file (~1 MB), **không ETag, không nén** | Mỗi lượt xem tải lại đủ 1 MB; 300 người reload sau deploy ≈ 300 MB + 9.000 lần đọc đĩa | `Cache-Control: no-cache` đúng ý (luôn hỏi lại) nhưng không có gì để trả 304 |
| H2 | SQLite: `raw.prepare(sql)` **mỗi lần** truy vấn (`hub/db.js:99`) | ~4 lần mỗi publish, 2 lần mỗi stream mỗi 60 s | Phí phân tích SQL lặp lại |
| H3 | Gửi `island` giống hệt khung trước (đổi A→B→A trong 500 ms) | Ít | Rẻ để chặn |
| H4 | Kiểm phiên đăng nhập mỗi 60 s: 2 truy vấn **mỗi stream** | 300 stream → 600 truy vấn đồng bộ một đợt (10–30 ms đứng event loop) | Gộp theo phiên |
| H5 | Một dòng log cho mỗi publish | ~16 dòng/s ở 8 đảo | Có `/metrics` đếm rồi; bỏ thì mất log chi tiết |
| H6 | Publisher (máy người dùng): mỗi 500 ms băm lại id từng phiên, `statSync(rooms.json)` mỗi phiên | Vài trăm µs mỗi nhịp | Không ảnh hưởng hub |

## 2. Các hướng

### Server hub

| Cách | Lợi | Rủi ro |
|---|---|---|
| **H1: giữ file `web/` trong RAM kèm ETag (sha1) + bản gzip; trả 304 khi trình duyệt hỏi lại** | Tải lại trang gần 0 byte; lần đầu ~1 MB → ~250 KB; hết đọc đĩa | Thấp. Phải nhận ra file đổi (so `mtime`) để trang local đang sửa code vẫn thấy ngay |
| H1b: Brotli thay gzip | Nhỏ hơn gzip ~15 % | Thấp, nhưng nén Brotli chậm hơn; gzip đủ |
| H1c: thêm `encode zstd gzip` vào ví dụ Caddy trong `docs/hub-setup.md` | Nén cả HTML / JSON | Nén ở proxy có thể giữ lại (buffer) luồng SSE `/api/world/stream` làm trễ cập nhật; hub đã tự nén `web/` rồi. **Không làm** |
| **H2: nhớ câu lệnh đã prepare (`Map<sql, stmt>`)** | Bỏ phân tích SQL lặp | Rất thấp |
| **H3: bỏ khung `island` giống hệt khung vừa gửi** | Ít băng thông thừa | Thấp |
| **H4: kiểm phiên theo từng phiên đăng nhập, không theo từng stream** | Đợt 60 s nhẹ hẳn | Thấp |
| H5: bỏ log publish 200 | Ít I/O | Mất log, **cần anh quyết** |
| Gửi bản vá (diff) thay vì cả đảo | Băng thông ↓ | Đổi giao thức, hub cũ / trang cũ lệch nhau: không đáng ở quy mô 8 đảo |
| WebSocket thay SSE | Không lợi rõ | SSE đang tốt, giữ |
| Nén từng stream SSE | Băng thông ↓ | Tốn CPU giải nén giữ trạng thái cho từng người xem: không |
| Chuyển sang Bun / Fastify / Redis | — | Đổi nền tảng, thêm phụ thuộc; hub hiện không phải nút thắt |

### Phía trình duyệt (một đảo đầy đủ)

| Cách | Lợi | Rủi ro |
|---|---|---|
| C1: **30 khung/s khi không tương tác**, 60 khi đang kéo / zoom / di chuột trên cảnh | ~−50 % CPU/GPU khi để yên | Chuyển động người hơi kém mượt hơn 60 (vẫn mượt với pixel art) — **cần anh quyết** |
| C2: nướng sẵn lớp tĩnh (sàn, tường, đồ đứng yên) | Đã đo ở hình nền: bỏ hẳn mọi đồ đạc GPU chỉ −16 điểm | Lợi ít so với công: hoãn |
| C3: WebGL / PixiJS / Phaser | Nhanh hơn | Viết lại bộ vẽ hoặc thêm thư viện, mất "không phụ thuộc, không build": không |
| C4: vẽ trong Worker (`OffscreenCanvas`) | Luồng chính rảnh hơn | Không giảm việc GPU: không |
| Tab ẩn | Đã dừng sẵn (`visibilityState`) | — |

## 3. Đề xuất

1. **Làm ngay (không đổi gì người dùng thấy)**: H1, H2, H3, H4. Có test.
2. **Cần anh quyết**: C1 (30 khung/s khi để yên) và H5 (bỏ log publish).
3. **Không làm**: diff giao thức, WebSocket, nén từng stream, đổi runtime / framework, C2–C4.

## 4. Đã làm (đợt này)

| Việc | Kết quả |
|---|---|
| H1: `web/` trong RAM + ETag + gzip, cả server local lẫn hub | 75 file mỗi lần tải trang: 879 KB → 291 KB lần đầu, tải lại chỉ còn 75 lần trả 304 không body; hết đọc đĩa mỗi request (chỉ `stat` để nhận ra file đổi) |
| H2: nhớ câu lệnh SQL đã prepare | Mỗi câu SQL chỉ prepare một lần (test đếm) |
| H3: không gửi lại khung `island` giống khung vừa gửi | Test: đổi rồi đổi lại trong 500 ms thì người xem không nhận khung thừa (test hỏng nếu bỏ phần sửa) |
| H4: kiểm phiên đăng nhập mỗi 60 s theo phiên, không theo stream | Một người mở nhiều tab chỉ tốn một lượt tra |

Chưa làm, chờ anh quyết: C1 (30 khung/s khi để yên), H5 (bỏ log mỗi publish).
