# Văn phòng làm hình nền máy Mac

Ngày: 2026-11-10 · Người đặt hàng: anh Kiệt · Người viết: Claude

## 1. Ý định

Lời anh Kiệt: "phát triển cái ai-terrarium có feature làm thành wallpaper nhé => combine 2 cái project lại luôn vì chủ
yếu mục đích để như vậy".

Anh đã có một app Swift riêng ở `~/Documents/live-wallpaper` (`LiveWallpaper.app`, chưa có git): mỗi màn hình một
`WKWebView` ở tầng desktop hiện `http://localhost:4317/`, cứ 5 phút chụp lại làm wallpaper hệ thống; chạy pin thì chụp
khung cuối làm ảnh tĩnh và đóng WebView; có menu bar (tải lại, chụp ngay, mở trình duyệt, khởi động cùng máy, thoát).

Gộp hai dự án: app nằm trong repo ai-terrarium, và trang văn phòng có chế độ riêng để làm hình nền.

## 2. Phạm vi

1. **App vào repo**: thư mục `wallpaper/` (Swift Package, macOS 14+), giữ nguyên tên `LiveWallpaper` và bundle id
   `local.kham.livewallpaper` để `build.sh install` thay đúng bản anh đang cài (login item, `pkill -x LiveWallpaper`).
   Thư mục cũ `~/Documents/live-wallpaper` không bị xoá; anh tự bỏ khi thấy ổn.
2. **Chế độ wallpaper của trang** (`?wallpaper=1`): chỉ còn bầu trời và hòn đảo, phủ kín màn hình.
   - Không header, không viền sân khấu, không padding, không nút ⚙, không panel chi tiết / cài đặt / "xem như người
     khác", không khung báo lỗi "cần server" (app tự ẩn cửa sổ khi server chưa lên).
   - Bong bóng tên / trạng thái của nhân vật vẫn hiện theo cài đặt bong bóng đã lưu: nhìn hình nền vẫn biết ai đang làm gì.
   - Không chuột, không kéo / zoom (cửa sổ của app vốn bỏ qua chuột); con trỏ không đổi thành bàn tay.
   - Mọi thứ còn lại (mô phỏng, thời tiết, mùa, đèn đồ vật) chạy y như trang thường.
3. **Khoá màn hình**: màn hình khoá của macOS phủ lên mọi cửa sổ app, nên không thể chạy live ở đó; nó chỉ hiện ảnh
   wallpaper hệ thống. Vì vậy:
   - Khi khoá (`com.apple.screenIsLocked`): chụp khung đang hiện làm wallpaper rồi đóng WebView (như chế độ pin) để
     không tốn CPU / GPU / mạng lúc không ai nhìn.
   - Khi mở khoá (`com.apple.screenIsUnlocked`): nếu đang cắm sạc và không bật Low Power Mode thì chạy live lại ngay.
   - Lúc khoá, ảnh chụp lấy khung đã vẽ sẵn (`afterScreenUpdates = false`), vì cửa sổ bị che có thể không vẽ thêm khung
     nào nữa; có hạn 3 giây, quá hạn thì vẫn đóng WebView.
   - Chụp định kỳ từ 5 phút xuống **1 phút**, để ảnh trên màn hình khoá không cũ quá một phút kể cả khi macOS đã hiện
     màn hình khoá trước khi kịp áp ảnh chụp lúc khoá.
   - Menu bar có thêm trạng thái "Đang khoá màn hình".
4. **Cài đặt một lệnh**: `node server.js wallpaper` build và cài app (chỉ macOS, cần Swift / Xcode Command Line Tools);
   `node server.js wallpaper build` chỉ build. Trên Linux / Windows lệnh báo không hỗ trợ và thoát mã 1.
5. **URL mặc định** của app: `http://localhost:4317/?wallpaper=1` (vẫn đổi được bằng
   `defaults write local.kham.livewallpaper url "…"`).

## 2b. Chạy chung: app tự bật server (bổ sung 2026-11-10)

Anh Kiệt: "anh muốn nó chạy chung", chọn kiểu **app tự bật server**. Mở `LiveWallpaper` (hoặc khởi động cùng máy) là
đủ: không cần mở terminal hay Claude Code.

- Lúc cài, `build.sh` ghi vào `Info.plist` của app đường dẫn tuyệt đối tới `node` và `server.js` của repo đã build
  (app mở từ Finder không có `PATH` của shell). Đổi được bằng `defaults write local.kham.livewallpaper node|server …`.
- App chỉ tự chạy server khi URL là `localhost` / `127.0.0.1`. Cứ 10 giây hỏi thử URL: không ai trả lời thì chạy
  `node server.js` (cổng lấy từ URL, log ra `~/Library/Logs/LiveWallpaper-server.log`). Server do app chạy mà chết thì
  bật lại sau 3 giây, chết liền nhiều lần thì giãn ra tối đa 60 giây.
- Đã có server khác trả lời (plugin của một phiên Claude Code, hay ai đó chạy tay) thì app không chạy thêm.
- Thoát app thì tắt server do chính app chạy, không đụng server của người khác.
- Khoá màn hình, chạy pin: server vẫn chạy (nó còn gửi đảo lên hub); chỉ WebView tạm dừng.
- Menu bar thêm một dòng trạng thái server: do app chạy / có sẵn / đang bật lại / không tìm thấy node.
- Cài lại từ thư mục nào thì app chạy server của thư mục đó: sau khi merge, cài lại từ thư mục chính.

## 3. Không làm

- Hình nền chuyển động trên màn hình khoá (không có API công khai cho app bên thứ ba).
- Đóng gói / ký app để phát hành (vẫn ký ad-hoc như bây giờ).
- Windows / Linux.

## 4. Kiểm thử

- Logic thuần có test: đọc `?wallpaper=` (`web/wallpaper-logic.js`), lệnh `wallpaper` của server (`lib/wallpaper.js`:
  chọn lệnh theo nền tảng, không chạy gì ngoài macOS).
- App: `swift build` sạch; chạy thử trên máy, xem trang ở chế độ wallpaper bằng Chrome headless.
- Khoá màn hình: không tự khoá máy anh được; anh khoá thử rồi xem ảnh trên màn hình khoá (mục "Anh nên xem").
