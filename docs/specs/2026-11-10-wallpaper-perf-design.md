# Hiệu năng hình nền: đo, các hướng tiếp cận, đề xuất

Ngày: 2026-11-10 · Người đặt hàng: anh Kiệt · Người viết: Claude

Lời anh Kiệt: "đụng + rà soát nhé em, brainstorm về các cách tiếp cận + tech + framework => tối ưu nhé".

## 1. Đo được gì (MacBook 3024×1964 @2x + màn ngoài 2560×1440, cắm sạc)

| Tiến trình | 60 khung/s (ban đầu) | 15 khung/s (commit ca3c4a5) |
|---|---|---|
| WebKit GPU (vẽ + ghép hình cho cả hai màn) | ~135 % | ~50 % |
| WebKit WebContent × 2 (JS + vẽ canvas mỗi màn) | ~50 % | ~25 % |
| LiveWallpaper (app) | ~4 % | ~2,5 % |
| node server.js | ~3 % | ~0,6 % |
| **Tổng** | **~190 % một lõi** | **~80 %** |

RAM: GPU ~300 MB, mỗi WebContent 170–470 MB, node 250–330 MB, app 75 MB.

Phân tích thêm:

- **JS của trang nhẹ**: một khung vẽ hết ~8 ms (Chrome, cùng độ phân giải), lấy mẫu CPU 6 giây thì JS chỉ ~4 %.
  Phần nặng là **raster + ghép hình**: mỗi khung vẽ lại toàn bộ văn phòng (≈ 750 ô sàn, tường, 16 bàn, pantry,
  nhà vệ sinh… hàng nghìn lệnh `fill`) lên canvas 2600×2193, cộng hai lớp trời toàn màn hình, rồi WebKit đẩy lên GPU.
  Chi phí đi theo **số khung × số điểm ảnh × số lệnh vẽ**.
- Vẽ lớp trời ở 1× thay vì 2× **không đổi gì đo được** → không phải lớp trời.
- **RAM của node** không phải dữ liệu: heap thật chỉ 5 MB sau GC. 250 MB là bộ đệm của lần đọc transcript đầu tiên
  (một `Buffer` tới 64 MB cho mỗi file đang hoạt động, rồi `toString` + `split` nhân đôi nhân ba), hệ điều hành không
  lấy lại. Mỗi giây quét 1.238 file transcript (3,4 GB) mất ~22 ms (~2 % một lõi).
- Ảnh chụp làm wallpaper: PNG 2–2,7 MB mỗi màn mỗi phút; app ~2,5 % là chủ yếu do đó và timer. Không đáng kể.

## 2. Các hướng tiếp cận

### A. Giữ kiến trúc hiện tại (WKWebView + canvas 2D), làm nó vẽ ít hơn

| # | Cách | Lợi | Rủi ro / công |
|---|---|---|---|
| A1 | Giới hạn khung hình (đã làm: 15/s) | −55 % | Đã xong |
| A2 | **Dừng hẳn khi hình nền bị che**: app theo dõi `NSWindow.occlusionState` từng màn; bị che kín (cửa sổ phóng to, app toàn màn hình) thì báo trang ngừng vẽ, lộ ra thì vẽ tiếp | Phần lớn thời gian desktop bị che → gần 0 % lúc đó | Thấp. Phải kiểm WebKit có tự làm chưa (nếu có thì vô hại) |
| A3 | **Lớp tĩnh nướng sẵn (layer caching)**: sàn, tường, cửa sổ, đồ đạc đứng yên vẽ một lần vào canvas phụ (theo độ phân giải, mức sáng, chủ phòng), mỗi khung chỉ `drawImage` + vẽ phần động (người, chó, màn hình, đèn đồ vật, nước) | Raster mỗi khung giảm mạnh cho **cả trang thường lẫn hub**, không riêng wallpaper | Vừa–lớn: tách phần động / tĩnh trong `office-draw*.js`, phải giữ đúng thứ tự xếp lớp (người đi sau bàn, sau tường) |
| A4 | Độ phân giải cảnh ở chế độ wallpaper: vẽ 1 điểm ảnh canvas / 1 điểm ảnh nghệ thuật rồi phóng to bằng CSS `pixelated` | GPU ~4× ít điểm ảnh | Ô pixel to nhỏ không đều khi tỉ lệ lẻ (2,33×), nhìn hơi "rung" khi nhân vật đi |
| A5 | Chỉ vẽ lại vùng thay đổi (dirty rect) | Lý tưởng | Lớn, dễ lỗi với cảnh isometric chồng lớp; A3 lấy được phần lớn lợi ích |
| A6 | Vẽ trong Web Worker (`OffscreenCanvas`) | Giải phóng luồng chính | Không giảm việc của GPU; luồng chính vốn nhàn → lợi ít |
| A7 | Một WebView vẽ, màn kia nhận bản sao | −1 WebContent | Hai màn khác kích thước / tỉ lệ; phức tạp, dễ mờ |

### B. Đổi công nghệ vẽ trong web

| # | Cách | Nhận xét |
|---|---|---|
| B1 | WebGL / WebGPU tự viết | Nhanh nhất cho nhiều sprite, nhưng phải chuyển mọi hàm vẽ 2D (path, ellipse, chữ pixel) sang sprite/texture: gần như viết lại phần vẽ |
| B2 | PixiJS (WebGL) | Có sẵn sprite batching, cache-as-bitmap; nhưng repo đang **không phụ thuộc gì** và không có bước build — thêm thư viện ~450 KB là đổi triết lý dự án |
| B3 | Phaser, Three.js | Quá nặng cho cảnh này |

### C. Đổi công nghệ ở phía Mac

| # | Cách | Nhận xét |
|---|---|---|
| C1 | SpriteKit / Metal native | Nhẹ nhất có thể, nhưng phải viết lại toàn bộ cảnh bằng Swift và giữ đồng bộ với bản web (hub, trình duyệt vẫn dùng web): hai bộ vẽ |
| C2 | Electron / Tauri | Nặng hơn WKWebView (Electron) hoặc ngang (Tauri dùng chính WKWebView) — không lợi |
| C3 | Video lặp / ảnh động | Không phản ánh phiên thật → bỏ |
| C4 | Chỉ ảnh tĩnh, chụp mỗi N giây (không live) | Gần 0 % nhưng mất chuyển động; đã có sẵn khi chạy pin |

### D. Server (node)

| # | Cách | Lợi |
|---|---|---|
| D1 | **Đọc transcript từng khúc 1 MB** thay vì một khối 64 MB | RAM ~250 MB → dự kiến < 80 MB, kết quả phân tích y hệt |
| D2 | Nhớ danh sách thư mục, chỉ đọc lại khi thư mục đổi | −vài ms mỗi giây; lợi nhỏ |
| D3 | `fs.watch` thay cho quét mỗi giây | Lợi nhỏ, macOS watch hay lỗi với 1.000+ file; không đáng |

## 3. Đề xuất

Giữ WKWebView + canvas 2D (một bộ vẽ cho trình duyệt, hub và hình nền; không thêm thư viện, không bước build). Làm theo
thứ tự lợi / rủi ro:

1. **Ngay (đợt này)**: A2 dừng khi bị che, D1 đọc từng khúc. Rủi ro thấp, đo được ngay.
2. **Đợt sau, cần anh duyệt**: A3 lớp tĩnh nướng sẵn — lợi lớn nhất còn lại và lợi cho cả trang thường, nhưng đụng sâu
   vào phần vẽ dùng chung.
3. **Không làm**: B1–B3, C1–C3 (đổi công nghệ tốn công viết lại, lợi thêm không đáng so với A2 + A3), A4 (xấu đi), A5
   (A3 lấy phần lớn lợi ích), A6, A7, D2, D3.

## 4. Chi tiết đợt này

### A2 — dừng khi bị che

- App: mỗi cửa sổ hình nền nghe `NSWindow.didChangeOcclusionStateNotification`. Đổi trạng thái thì gọi
  `window.terrariumWallpaper.setVisible(true|false)` trong trang (qua `evaluateJavaScript`); lúc tải xong trang cũng
  gửi trạng thái hiện tại.
- Trang (`?wallpaper=1`): bị che thì vòng vẽ bỏ qua mọi khung (`WallpaperLogic.frameDue` thêm điều kiện), không vẽ,
  không chạy mô phỏng; lộ ra thì vẽ tiếp ngay. `dt` vốn bị chặn 0,05 s nên người không "nhảy cóc".
- Chụp làm wallpaper (định kỳ, lúc khoá, lúc chuyển sang pin) vẫn dùng khung đã vẽ gần nhất.
- Menu bar thêm dòng số màn đang bị che, để biết nó có tác dụng.

### D1 — đọc từng khúc

- `scan()` đọc phần mới của file theo khúc 1 MB (một `Buffer` dùng lại), ghép dòng như cũ; giới hạn 64 MB phần đuôi
  cho lần đọc đầu giữ nguyên. Test hiện có của server + thêm test: file lớn hơn một khúc, dòng cắt ngang ranh giới khúc.
