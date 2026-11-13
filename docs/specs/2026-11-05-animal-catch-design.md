# Thú hoang trên đảo: xuất hiện theo độ hiếm, bắt bằng thời gian làm việc, thả ra

Ngày: 2026-11-05 · Người đặt hàng: Tính · Người viết: Claude · Trạng thái: **đã duyệt (lần 4)**

## 1. Ý định

Lời đặt hàng:

> tính năng spawn động vật: thêm nhiều động vật, thêm rate cho từng con, hiệu ứng cho từng rate, có thể catch và thả
> ra tối đa 5 con của bản thân bắt được và 1 con xuất hiện ngẫu nhiên để bắt

Các yêu cầu bổ sung khi review:

- Giới hạn bộ sưu tập 50 con. Khi đầy thì hỏi mỗi lần.
- Bắt phải qua thử thách: làm việc đủ một khoảng thời gian, độ khó theo bậc hiếm. Trong lúc đang bắt thì không có con
  mới.
- Dữ liệu lưu phải được mã hoá và ký, để người dùng không cố tình chèn vào được.

Hiểu thành năm việc:

1. **Nhiều loài thú hơn.** Hiện đảo chỉ có 3 con chó cố định. Thêm 14 loài mới, mỗi loài có hình pixel và dáng đi riêng.
2. **Độ hiếm và tỉ lệ.** Mỗi loài thuộc một bậc hiếm và có trọng số xuất hiện riêng.
3. **Hiệu ứng theo bậc hiếm.** Nhìn là biết con nào hiếm.
4. **Bắt và thả.**
   - Tối đa 1 con thú hoang xuất hiện ngẫu nhiên.
   - Bắt nó bằng **thời gian làm việc thật** với Claude Code.
   - Bộ sưu tập tối đa 50 con. Thả tối đa 5 con ra đảo.
5. **Chống gian lận.** Server local giữ luật chơi và dữ liệu, có mã hoá và chữ ký. Trang web chỉ hiển thị và gửi yêu cầu.

Ba con chó hiện có giữ nguyên: không bắt được, không tính vào giới hạn 5.

## 2. Phạm vi

| Giai đoạn | Nội dung |
|---|---|
| **GĐ1 (spec này)** | Server local (`server.js` + `lib/`) giữ luật chơi và dữ liệu đã mã hoá. Trang local (`localhost:4317`) vẽ thú, hiệu ứng, chip, bảng. Không đụng hub. |
| GĐ2 (để sau, chỉ phác thảo ở mục 13) | Người khác thấy 5 con đang thả trên đảo của mình trong world view. |

Trong GĐ1:

- **World view (trang do hub phục vụ):** không có thú mới. Trang hub không gọi được server local, nên `/api/animals`
  trả 404 và trang coi như tính năng tắt.
- **"Xem như người khác":** ẩn thú mới, vì hub chưa nhận thú.
- **Chế độ Mô phỏng và Live:** đều hiện thú và bộ sưu tập. Tiến độ bắt thì **chỉ tính từ session Claude Code thật**
  (mục 5.2), vì agent mô phỏng không phải là làm việc thật.

Ngoài phạm vi: tranh bắt giữa nhiều người, đổi/trao thú, đặt tên riêng, âm thanh, thú tương tác với chó hay agent.

## 3. Loài, bậc hiếm và tỉ lệ

### 3.1. Bậc hiếm

| Bậc | Màu | Ở lại nếu chưa ai bắt | Làm việc cần để bắt | Hạn chót của lần bắt |
|---|---|---|---|---|
| Thường | xám nhạt `#c9d1d9` | 3 phút | **3 phút** | 20 phút |
| Hiếm | xanh dương `#4ea1ff` | 2 phút 30 giây | **8 phút** | 40 phút |
| Sử thi | tím `#b26bff` | 2 phút | **15 phút** | 75 phút |
| Huyền thoại | vàng `#ffcc33` | 90 giây | **30 phút** | 150 phút |

- **"Ở lại"** là thời gian con vật đi lại trên đảo trước khi bị bắt. Bậc càng hiếm thì ở lại càng ngắn, nên phải để ý
  mới kịp bấm bắt.
- **"Làm việc cần"** là tổng thời gian làm việc phải đạt được, tính từ lúc bấm bắt (mục 5).
- **"Hạn chót"** là khoảng thời gian thật tối đa cho lần bắt. Hết hạn mà chưa đủ thời gian làm việc thì con vật xổng
  mất.

### 3.2. Các loài và trọng số gốc

Hình pixel tự vẽ, cùng kiểu với chó hiện có (khoảng 12–18 px rộng). Không mô phỏng nhân vật của game hay thương hiệu
nào. Cách bắt là vòng sáng, không có bóng ném hay quả cầu.

| Loài (`id`) | Bậc | Trọng số gốc | Điều kiện | Dáng / hành vi riêng |
|---|---|---|---|---|
| Gà mái (`hen`) | Thường | 18 | — | mổ đất, chạy lạch bạch |
| Vịt (`duck`) | Thường | 14 | — | hay đứng gần hồ |
| Thỏ (`rabbit`) | Thường | 14 | không ra khi mưa | nhảy từng bước |
| Mèo mướp (`tabby`) | Thường | 12 | — | nằm sưởi nắng, liếm chân |
| Sóc (`squirrel`) | Thường | 10 | chỉ ban ngày | đứng dưới gốc cây |
| Cáo đỏ (`fox`) | Hiếm | 8 | — | đi rón rén |
| Gấu trúc đỏ (`redpanda`) | Hiếm | 6 | — | ngồi ôm đuôi |
| Ếch xanh (`frog`) | Hiếm | 5 | mưa ×3, không mưa ÷5 | nhảy, ngồi gần hồ |
| Cú mèo (`owl`) | Hiếm | 5 | chỉ ban đêm | đứng yên, xoay đầu |
| Hươu sao (`deer`) | Sử thi | 3 | — | đi chậm, ngẩng đầu |
| Công (`peacock`) | Sử thi | 2 | chỉ ban ngày | thỉnh thoảng xoè đuôi |
| Cáo tuyết (`snowfox`) | Sử thi | 2 | tuyết ×3, không tuyết ÷5 | lông trắng, lẫn vào tuyết |
| Kỳ lân con (`unicorn`) | Huyền thoại | 0,6 | — | bờm đổi màu |
| Rồng con (`dragon`) | Huyền thoại | 0,4 | — | vỗ cánh nhỏ, thở khói |

- Trọng số gốc cộng lại đúng 100 (Thường 68, Hiếm 24, Sử thi 7, Huyền thoại 1).
- Ếch và cáo tuyết vẫn ra được khi không đúng thời tiết, chỉ hiếm hơn nhiều. Vì vậy người dùng tắt thời tiết vẫn có thể
  bắt đủ 14 loài.

### 3.3. Định nghĩa điều kiện

- **Ngày/đêm:** ban đêm là 18:00–6:00 theo **giờ của server**.
- **Thời tiết:**
  - Thời tiết hiện chỉ có ở trang web (ngẫu nhiên, thời tiết thật theo thành phố, hoặc tắt), nên trang báo cho server
    loại thời tiết thật của chế độ đang chọn, mỗi phút một lần. Báo cáo này **không lấy thời tiết đang xem thử**
    (`preview.back` thay vì preview).
  - Server dùng báo cáo mới nhất trong 5 phút; không có thì coi là trời quang.
  - **Mưa** là `rain` hoặc `storm`. **Tuyết** là `snow`. Mọi loại khác tính là không mưa, không tuyết.
- **Mùa tuyết:** chế độ thời tiết ngẫu nhiên chỉ ra tuyết vào tháng 12–2. Ngoài mùa, cáo tuyết vẫn ra với tỉ lệ ÷5.

### 3.4. Tỉ lệ thật theo tình huống

Cách tính: bỏ loài không thoả điều kiện, áp ×3 hoặc ÷5, rồi chia cho tổng trọng số còn lại.

| Loài | Quang · ngày | Quang · đêm | Mưa · ngày | Mưa · đêm | Tuyết · ngày | Tuyết · đêm |
|---|---|---|---|---|---|---|
| Gà mái | 20,1 % | 21,8 % | 20,1 % | 21,8 % | 18,9 % | 20,5 % |
| Vịt | 15,7 % | 17,0 % | 15,7 % | 17,0 % | 14,7 % | 15,9 % |
| Thỏ | 15,7 % | 17,0 % | — | — | 14,7 % | 15,9 % |
| Mèo mướp | 13,4 % | 14,6 % | 13,4 % | 14,6 % | 12,6 % | 13,6 % |
| Sóc | 11,2 % | — | 11,2 % | — | 10,5 % | — |
| Cáo đỏ | 8,9 % | 9,7 % | 8,9 % | 9,7 % | 8,4 % | 9,1 % |
| Gấu trúc đỏ | 6,7 % | 7,3 % | 6,7 % | 7,3 % | 6,3 % | 6,8 % |
| Ếch xanh | 1,1 % | 1,2 % | 16,8 % | 18,2 % | 1,1 % | 1,1 % |
| Cú mèo | — | 6,1 % | — | 6,1 % | — | 5,7 % |
| Hươu sao | 3,4 % | 3,6 % | 3,4 % | 3,6 % | 3,2 % | 3,4 % |
| Công | 2,2 % | — | 2,2 % | — | 2,1 % | — |
| Cáo tuyết | 0,45 % | 0,49 % | 0,45 % | 0,49 % | 6,3 % | 6,8 % |
| Kỳ lân con | 0,67 % | 0,73 % | 0,67 % | 0,73 % | 0,63 % | 0,68 % |
| Rồng con | 0,45 % | 0,49 % | 0,45 % | 0,49 % | 0,42 % | 0,45 % |
| **Thường** | **76,1 %** | **70,4 %** | **60,4 %** | **53,4 %** | **71,6 %** | **65,9 %** |
| **Hiếm** | **16,8 %** | **24,3 %** | **32,4 %** | **41,3 %** | **15,8 %** | **22,7 %** |
| **Sử thi** | **6,0 %** | **4,1 %** | **6,0 %** | **4,1 %** | **11,6 %** | **10,2 %** |
| **Huyền thoại** | **1,1 %** | **1,2 %** | **1,1 %** | **1,2 %** | **1,1 %** | **1,1 %** |

Trung bình khoảng 90 con thú hoang thì có 1 con huyền thoại. Bảng `SPECIES` nằm ở một chỗ duy nhất
(`lib/animals.js`), nên chỉnh tỉ lệ chỉ là sửa số.

## 4. Thú hoang: xuất hiện, ở lại, rời đi

Mọi quyết định ở mục này do **server** đưa ra. Trang chỉ hiển thị.

### 4.1. Nhịp

- **Tối đa 1 con thú hoang** tại một thời điểm.
- Sau khi con trước bị bắt, xổng mất hay rời đi, chờ ngẫu nhiên **4–10 phút đang xem** rồi mới có con mới (mục 4.4).
- **Lần đầu dùng tính năng** (chưa có dữ liệu và chưa có khoá) thì chỉ chờ 30–90 giây.
- **Không có con mới trong lúc đang bắt**, kể cả lúc đang chờ chọn con để thả tự do (mục 6.3). Đồng hồ chờ chỉ bắt đầu
  sau khi lần bắt kết thúc.
- Tải lại trang hay khởi động lại server không làm con mới ra sớm hơn, vì thời gian chờ còn lại được lưu trong dữ liệu.

### 4.2. Xuất hiện

- **Chọn loài:** server bốc thăm theo mục 3, với giờ của máy và báo cáo thời tiết mới nhất.
- **Bốc thăm cố định theo lượt:** mỗi lượt xuất hiện có số thứ tự `spawnNo`. Con số ngẫu nhiên của lượt đó tính từ
  `HMAC(khoá, spawnNo)`, không dùng `Math.random`. Khôi phục một bản dữ liệu cũ vì vậy ra lại **đúng con cũ**, không
  "quay" lại được (mục 7.5). Giờ và thời tiết chỉ lọc danh sách loài như mục 3.
- **Chỗ xuất hiện trên đảo** chỉ là phần trang trí, nên do trang tự chọn. Trang lấy một ô đứng được (vùng chó đi
  được, trừ đường đá, chân cầu thang và 3 ô ổ chó), chọn **theo `id` của con vật** (băm `id` ra một ô). Mọi tab và mọi
  lần tải lại vì vậy thấy con vật ở cùng một chỗ, mà server không cần biết bản đồ đảo.
- **Hiệu ứng xuất hiện** theo bậc (mục 10), kèm thông báo (mục 6.5).

### 4.3. Ở lại và rời đi

- Con vật đi lại trên đảo trong thời gian "ở lại" của bậc (mục 3.1), tính bằng **thời gian đang xem** (mục 4.4).
- Hết giờ mà chưa ai bấm bắt thì nó đi ra mép đảo rồi mờ dần. Thông báo "… đã rời đi".
- **Bấm bắt** thì đồng hồ "ở lại" dừng hẳn, thay bằng hạn chót của lần bắt (mục 5).
- Trong lúc bắt, con vật đứng trong một vòng sáng, hiện tiến độ, và không đi đâu.

### 4.4. Đồng hồ

**Server không lưu mốc giờ tuyệt đối.** Nó lưu **thời gian còn lại** của từng đồng hồ, và mỗi giây trừ đi lượng thời
gian đã trôi.

- **Đo thời gian trôi bằng đồng hồ đơn điệu** của tiến trình (`process.hrtime`), không dùng giờ máy, và mỗi nhịp tính
  tối đa 2 giây. Chỉnh giờ máy tiến hay lùi bao nhiêu cũng không làm đồng hồ nào chạy nhanh hơn.
- **Server tắt, máy ngủ, tiến trình bị treo:** không có nhịp nào chạy, nên **mọi đồng hồ dừng lại**: chờ con mới, ở
  lại, hạn chót của lần bắt. Không có trường hợp ngủ qua đêm rồi mất con đang bắt.

| Đồng hồ | Lưu dưới tên | Chạy khi |
|---|---|---|
| Chờ con mới | `waitLeftMs` | server chạy **và** có người đang xem trang |
| Ở lại | `stayLeftMs` | server chạy **và** có người đang xem trang |
| Hạn chót lần bắt | `deadlineLeftMs` | server chạy |
| Thời gian làm việc đã đạt | `workMs` | server chạy **và** có session đang làm việc (mục 5.2) |

- **"Có người đang xem trang"** nghĩa là trong 20 giây qua có ít nhất một tab đang hiển thị (không bị ẩn) báo về
  server (mục 8.2). Nhờ vậy thú chỉ xuất hiện và chỉ hết giờ ở lại khi người dùng thật sự nhìn thấy. Con huyền thoại
  90 giây không còn bị lỡ chỉ vì người dùng đang ở terminal. Báo giả là "đang xem" cũng chỉ làm đồng hồ chạy lúc không
  ai xem, nên chẳng có lợi gì.
- **Ngày/đêm** vẫn lấy theo giờ máy, nên chỉnh giờ máy làm đổi được ngày/đêm (ghi ở mục 7.5).
- **Nút tạm dừng (❚❚)** chỉ dừng mô phỏng trên trang. Không ảnh hưởng tới thú hoang hay tiến độ bắt.

## 5. Bắt: thử thách thời gian làm việc

### 5.1. Luồng

1. **Bấm hoặc chạm vào con thú hoang**, hoặc bấm nút **"Bắt {tên loài}"** trong bảng 🐾 (dùng được bằng bàn phím).
   - Vùng bấm tối thiểu 22 px màn hình.
   - Thú được dò trước agent.
   - Nếu con vật nằm ngoài khung nhìn, mép màn hình có mũi tên chỉ về phía nó.
2. Trang gửi `POST /api/animals/catch` kèm `id` con vật. Server chỉ chấp nhận nếu đó đúng là con thú hoang hiện tại,
   nó chưa rời đi và chưa có lần bắt nào đang chạy.
3. **Lần bắt bắt đầu.**
   - Con vật đứng trong vòng sáng màu theo bậc.
   - Vòng sáng là thanh tiến độ: đầy dần theo thời gian làm việc.
   - Chip 🐾 hiện tiến độ, ví dụ `🐾 Cáo đỏ 3:12 / 8:00`.
4. **Thành công:** đạt đủ thời gian làm việc của bậc trước hạn chót.
   - Hiệu ứng bắt: vòng sáng co lại, con vật thu thành đốm sáng bay lên chip.
   - Con vật vào bộ sưu tập. Nếu đang thả chưa đủ 5 thì nó tự được thả ra đảo.
   - Lần đầu bắt được loài đó thì thông báo "Loài mới!".
   - Nếu bộ sưu tập đã đầy 50 thì mở bảng chọn con để thả tự do (mục 6.3).
5. **Thất bại:** hết hạn chót mà chưa đủ thời gian. Con vật vùng ra khỏi vòng sáng, chạy ra mép đảo rồi biến mất. Thông
   báo "{loài} đã xổng mất".
6. **Bỏ cuộc:** nút **"Thả con này đi"** trong bảng 🐾 (bấm hai lần để xác nhận). Con vật chạy mất ngay.

### 5.2. "Làm việc" là gì

**Server tính, không phải trang.** Server vốn đọc transcript và danh sách session đang chạy của Claude Code để vẽ văn
phòng, và mỗi giây tính lại trạng thái từng session (`snapshot()` trong `server.js`).

Mỗi nhịp, server cộng thời gian vào `workMs` nếu có **ít nhất một session gốc đang làm việc**:

1. **Chỉ xét session gốc có transcript thật**, và session đó còn "mới". Mốc mới nhất là thời điểm muộn nhất trong
   các mốc sau: dòng mới nhất của transcript gốc, dòng mới nhất của bất kỳ transcript sub-agent nào của nó, hoặc lúc
   bắt đầu một lệnh tool còn đang chạy. Lệnh Agent hay Bash chạy ở tiền cảnh không ghi gì vào transcript gốc cho tới
   khi xong, nên chỉ nhìn transcript gốc sẽ bỏ sót việc dài.
   - Mặc định: mốc mới nhất cách đây không quá 10 phút.
   - Khi Claude Code báo `busy` cho session đó: cho phép tới 60 phút, vì `busy` là nguồn tin cậy trong lúc một lệnh
     dài đang chạy.

   Session chỉ có trong danh sách đang chạy mà không có transcript thì bỏ qua, vì một file giả là tạo được nó (mục 7.5).
2. **Session gốc có trong danh sách đang chạy của Claude Code:** làm việc khi Claude Code báo `busy`. Cách này đúng cả
   với lệnh chạy lâu (test, build chạy 5 phút vẫn là `busy`), trong khi trạng thái trên màn hình có thể là "chờ duyệt".
3. **Session gốc không có trong danh sách đó:** dùng trạng thái hiển thị. Mỗi session gốc được xét riêng: session
   không có trong danh sách vẫn dùng quy tắc này dù danh sách đang có các session khác.
   - Tính: `working`, `thinking`, `talking`.
   - `waiting` (đang chờ sub-agent) chỉ tính khi sub-agent đó đang `working`, `thinking` hoặc `talking`.
   - Không tính: `permission`, `idle`, `done`, `error`.
4. **Khi đang có lời hỏi duyệt quyền thật sự** (Claude Code đang chờ người bấm Allow), không tính. Lúc làm cần kiểm tra
   Claude Code ghi gì vào danh sách session khi có lời hỏi duyệt. Nếu nó không phân biệt được với `busy` thì thời gian
   chờ duyệt cũng được tính, và ghi rõ điều đó trong README.

**Nhiều session cùng làm việc không cộng nhanh hơn**: vẫn là 1 giây mỗi giây (xem Q8).

**Agent mô phỏng không tính.** Ở chế độ Mô phỏng, tiến độ vẫn chỉ lấy từ session thật.

### 5.3. Hiển thị tiến độ

- **Vòng sáng quanh con vật:** phần đã đầy theo màu bậc. Lúc đang có làm việc thì vòng sáng chạy chậm; lúc không có
  session nào làm việc thì vòng sáng đứng yên và mờ đi.
- **Bảng 🐾:** thanh tiến độ, "Đã làm 3:12 / 8:00 · còn 31 phút trước khi nó xổng", và dòng "Đang tính: 1 session đang
  làm việc" hoặc "Chưa tính: không có session nào đang làm việc".
- **Sắp hết hạn** (còn dưới 10 % thời gian): viền chip chuyển sang nhấp nháy chậm, thông báo "{loài} sắp xổng mất!" một
  lần.

## 6. Bộ sưu tập, thả và thu về

### 6.1. Giới hạn

- Bộ sưu tập tối đa **50 con**. Mỗi lần bắt là một con riêng, bắt trùng loài được.
- Thả tối đa **5 con** ra đảo cùng lúc.
- Bậc hiếm suy ra từ loài, không lưu riêng.
- **Loài bị bỏ khỏi bảng sau này:** bản ghi vẫn giữ trong dữ liệu, chỉ ẩn khi hiển thị.

### 6.2. Thả, thu về, thả tự do

| Hành động | Ở đâu | Điều kiện |
|---|---|---|
| **Thả ra** | bảng bộ sưu tập | đang thả dưới 5 con |
| **Thu về** | bảng bộ sưu tập; bảng nhỏ khi bấm con đang thả trên đảo | con đang thả |
| **Thả tự do** (bỏ hẳn khỏi bộ sưu tập) | bảng bộ sưu tập; bảng nhỏ | bấm hai lần để xác nhận |

Mỗi hành động là một yêu cầu `POST` tới server (mục 8). Server kiểm tra rồi mới đổi dữ liệu.

### 6.3. Khi bộ sưu tập đầy

- Chip 🐾 hiện thêm `· 50/50` để người dùng biết trước khi bấm bắt.
- Vẫn bấm bắt được. Thành công thì con mới ở trạng thái **chờ chọn**, và trang mở **bảng chọn con để thả tự do**:
  - Tiêu đề: "Bộ sưu tập đầy (50/50). Chọn một con để thả tự do, nhường chỗ cho {loài mới}."
  - Danh sách 50 con, xếp từ bậc thấp lên cao rồi từ cũ tới mới. Con đang thả có nhãn "đang thả" và vẫn chọn được
    (chọn thì nó rời đảo).
  - Chọn một con thì xong ngay.
  - Nút **Huỷ** (hoặc phím Esc): con mới chạy mất, bộ sưu tập giữ nguyên.
- **Trạng thái chờ chọn lưu ở server.** Tải lại trang hay mở tab khác thì bảng chọn hiện lại. Trong lúc chờ chọn không
  có con mới (mục 4.1). Hạn chót của lần bắt không còn áp dụng nữa.
- **Không chọn trong 24 giờ** (tính bằng thời gian server chạy) thì coi như Huỷ, để tính năng không bị kẹt mãi.
- **Số liệu chỉ đổi khi chọn xong:** bộ sưu tập, danh sách loài từng bắt, tổng số lần bắt và thông báo "Loài mới!" chỉ
  cập nhật khi người dùng chọn một con để thả tự do. Huỷ hay hết 24 giờ thì không đổi gì.

### 6.4. Giao diện

- **Chip 🐾** nằm ngay sau chip "Thế giới" ở đầu trang. Trên điện thoại nó ở hàng cố định, không nằm trong dải chip
  cuộn ngang.
  - Bình thường: `🐾 3/5` (đang thả 3 trên tối đa 5).
  - Có thú hoang: viền chip màu theo bậc của nó.
  - Đang bắt: tiến độ như mục 5.3.
  - Bấm chip thì mở bảng bộ sưu tập.
- **Bảng bộ sưu tập**, dùng chung chỗ và kiểu với bảng chi tiết agent. Mỗi lúc chỉ mở một bảng.
  - Phần đầu: "Đã bắt 9/14 loài · 23 lần bắt · 41/50 con".
  - Khối thú hoang hoặc lần bắt đang chạy, với nút **Bắt** hoặc **Thả con này đi**.
  - Danh sách theo loài. Loài chưa bắt được hiện hình mờ kèm gợi ý nơi gặp ("Hay ra khi trời mưa", "Chỉ ra ban đêm").
  - Mở một loài ra thì thấy từng con, với ngày bắt và các nút ở mục 6.2.
- **Bấm vào một con đang thả trên đảo:** bảng nhỏ gồm tên loài, bậc, ngày bắt, nút **Thu về** và **Thả tự do**.

### 6.5. Thông báo

- **Một chỗ duy nhất:** nhãn tạm thời cạnh chip 🐾, hiện 4 giây, mỗi lúc chỉ một thông báo.
- **Đọc được bằng trình đọc màn hình:** vùng thông báo có `aria-live="polite"`.
- **Các thông báo:**
  - "{loài} xuất hiện!" (bậc Huyền thoại thì "Huyền thoại xuất hiện!")
  - "Bắt đầu bắt {loài}: cần {thời gian} làm việc"
  - "{loài} sắp xổng mất!"
  - "Đã bắt được {loài}!", "Loài mới!"
  - "{loài} đã xổng mất", "{loài} đã rời đi", "{loài} đã chạy mất"
  - "Đã thả tự do {loài}"
  - "Dữ liệu thú bị sửa hoặc hỏng" (mục 7.4)

## 7. Lưu trữ an toàn: mã hoá và ký

### 7.1. Nguyên tắc

- **Server local là nơi duy nhất giữ dữ liệu và luật chơi.** Trang không lưu gì về thú trong `localStorage`, và không
  có API nào cho trang ghi trạng thái tuỳ ý. Trang chỉ gửi **hành động** (bắt, bỏ cuộc, thả, thu về, thả tự do, chọn
  con khi đầy) và **báo cáo** (thời tiết, đang xem). Server kiểm tra từng hành động theo trạng thái nó đang giữ.
- **Dữ liệu trên đĩa được mã hoá có xác thực.** Sửa bất kỳ byte nào của dữ liệu đã giải mã base64 thì server phát hiện.
- **"Ký" ở đây là thẻ xác thực của AES-GCM**, một kiểu chữ ký dùng khoá đối xứng: chỉ ai có khoá mới tạo được. Không
  cần thêm HMAC riêng.

### 7.2. Khoá

- File `~/.claude-terrarium/animals.key`: 32 byte ngẫu nhiên (`crypto.randomBytes`).
- Thư mục quyền 0700, file quyền 0600, theo cách `lib/terrarium-config.js` đang làm. Quyền rộng hơn thì server tự siết
  lại.
- **Chỉ tạo khoá khi chưa có cả khoá lẫn file dữ liệu**, và tạo bằng `open(..., 'wx', 0o600)`. Hai tiến trình cùng tạo
  thì tiến trình sau gặp lỗi "đã tồn tại" và đọc lại khoá của tiến trình trước, không tạo khoá thứ hai.
- **Khoá có vấn đề** (không đọc được, không đủ 32 byte, hoặc mất khoá trong khi file dữ liệu vẫn còn): **tắt tính năng
  thú** kèm lỗi hiện rõ trên trang, và **không đụng vào file nào**. Không bao giờ tự tạo khoá mới đè lên dữ liệu cũ.
- Khoá không bao giờ gửi ra trang, ra log hay ra hub.

### 7.3. File dữ liệu

`~/.claude-terrarium/animals.dat` (quyền 0600) là một JSON nhỏ:

```json
{ "v": 1, "alg": "A256GCM", "iv": "<12 byte base64>", "tag": "<16 byte base64>", "ct": "<base64>" }
```

- **Thông số AES-256-GCM cố định** (thư viện `crypto` có sẵn của Node, không thêm package):
  - `iv` đúng 12 byte, ngẫu nhiên mới mỗi lần ghi;
  - `tag` đúng 16 byte, giải mã với `authTagLength: 16`, nên thẻ bị cắt ngắn cũng bị từ chối;
  - dữ liệu phụ được xác thực (AAD) là `ai-terrarium/animals` cộng `v` và `alg`, nên sửa phần đầu file cũng bị phát hiện;
  - base64 phải mã hoá lại ra đúng chuỗi cũ, nếu không thì coi là hỏng.
- **Bên trong `ct`** (sau khi giải mã):

  ```js
  {
    seq: 412,                                   // tăng mỗi lần ghi
    spawnNo: 37,                                // số lượt xuất hiện, dùng cho bốc thăm cố định (mục 4.2)
    caught: [{ id: 'a7f3c2', species: 'fox', at: 1762329600000 }, ...],   // tối đa 50
    out: ['a7f3c2', ...],                       // tối đa 5
    speciesCaught: ['hen', 'fox', ...],         // các loài từng bắt được
    total: 23,                                  // tổng số lần bắt
    waitLeftMs: 312000,                         // chờ con mới (mục 4.4)
    wild: { id, species, stayLeftMs } | null,
    attempt: { wildId, needMs, workMs, deadlineLeftMs, phase: 'catching' | 'pending', pendingLeftMs } | null
  }
  ```

  `at` (ngày bắt) chỉ để hiển thị, không ảnh hưởng luật chơi.
- **Ghi an toàn:**
  1. Ghi bản mới ra file tạm, `fsync` file tạm.
  2. Tạo `animals.dat.bak` từ file hiện tại bằng liên kết cứng (hard link; không được thì chép).
  3. Đổi tên file tạm thành `animals.dat`, rồi `fsync` thư mục.

  Ở mọi thời điểm luôn còn ít nhất một file hợp lệ, kể cả khi mất điện giữa chừng.
- **Nhịp ghi:**
  - ghi ngay sau mỗi hành động và mỗi sự kiện (xuất hiện, bắt được, xổng mất);
  - ngoài ra ghi định kỳ mỗi 15 giây khi có đồng hồ đang chạy.

  Server tắt đột ngột chỉ mất tối đa 15 giây.

### 7.4. Khi đọc thất bại

| Tình huống | Server làm gì |
|---|---|
| Có khoá, `animals.dat` giải mã được | Dùng bình thường |
| `animals.dat` giải mã thất bại (bị sửa, hỏng) | Dùng `animals.dat.bak`, **và báo cho trang**: "Dữ liệu thú bị sửa hoặc hỏng, đã khôi phục bản trước" |
| Cả hai đều hỏng | Đổi tên cả hai thành `.bad-<thời điểm>` (giữ lại để xem, không xoá), bắt đầu bộ sưu tập mới, báo cho trang |
| Mất `animals.dat` nhưng còn `.bak` hoặc khoá | Coi là khôi phục, **không** coi là lần đầu: dùng `.bak` nếu có, không áp nhịp 30–90 giây của lần đầu |
| Có vấn đề với khoá | Tắt tính năng, không đụng file (mục 7.2) |

Mất file khoá thì cũng mất bộ sưu tập. README cần ghi rõ: muốn giữ bộ sưu tập thì sao lưu cả hai file.

### 7.5. Chống được gì, không chống được gì

Cần nói thẳng: server local chạy trên máy của chính người dùng, nên không có cách nào chống gian lận tuyệt đối trên
máy đó.

**Chống được:**

| Cách gian lận | Vì sao bị chặn |
|---|---|
| Sửa `localStorage`, gọi hàm trong DevTools | Trang không giữ dữ liệu thú; không có API "ghi trạng thái" |
| Gọi API với dữ liệu bịa (`curl`), ví dụ "bắt con huyền thoại" | Server chỉ cho bắt đúng con thú hoang nó đã tạo, và chỉ khi đủ thời gian làm việc nó tự đo |
| Sửa hoặc chèn vào file dữ liệu | AES-GCM phát hiện; server khôi phục bản trước và báo |
| Chép file của máy khác sang | Khoá khác nên không giải mã được |
| Khôi phục bản cũ hay phá file để server quay về `.bak`, nhằm "quay" lại lượt xuất hiện | Bốc thăm cố định theo lượt (mục 4.2): ra lại đúng con cũ |
| Chỉnh giờ máy để thú ra nhanh, ở lâu hơn, hay để "làm việc" nhanh | Đồng hồ đơn điệu, mỗi nhịp tối đa 2 giây (mục 4.4) |
| Mở nhiều session chạy suông | Nhiều session không cộng nhanh hơn |
| Tạo file session giả không có transcript | Chỉ tính session có transcript mới (mục 5.2) |

**Không chống được** (ghi rõ để không ai hiểu nhầm):

- **Đọc được file khoá, hoặc sửa code server trên máy mình:** muốn ký gì cũng được. Muốn chống cả trường hợp này thì
  hub phải là bên giữ luật chơi (xem GĐ2).
- **Viết transcript giả** vào `~/.claude/projects` (có dòng mới liên tục) kèm một file session đang chạy giả: tạo được
  "thời gian làm việc" mà không làm gì thật.
- **Đổi ngày/đêm bằng giờ máy:** chọn được lúc cú (đêm) hay sóc và công (ngày) có thể ra.
- **Báo thời tiết tuỳ ý** qua API (trang báo bằng một yêu cầu thường, ai cũng gửi được từ máy mình) hoặc chọn một thành
  phố hay mưa. Ảnh hưởng: mưa làm bậc Hiếm tăng khoảng gấp đôi (vì có ếch) và không còn thỏ; tuyết làm bậc Sử thi tăng
  khoảng gấp đôi (vì có cáo tuyết). Huyền thoại không đổi. Để giảm bớt, server chỉ nhận đổi thời tiết tối đa mỗi 5
  phút một lần.

## 8. API của server local

### 8.1. Bảo vệ

Thứ tự kiểm tra cho mọi yêu cầu `/api/animals/*`:

1. `hostAllowed` (chỉ tên máy loopback trên đúng cổng), như các đường dẫn đang có.
2. Với `POST`: kiểm tra như `joinRequestAllowed` đang làm cho `/api/join`, nhưng với header `X-Terrarium: animals`.
3. **Phần mới phải viết thêm** (`/api/join` hiện chưa có):
   - thân là JSON, tối đa 1 KB, đọc có giới hạn;
   - giới hạn tốc độ: 5 hành động mỗi giây, cộng một ngăn riêng cho báo cáo (`/env`, tối đa 1 mỗi 10 giây).

   Chỉ yêu cầu đã qua bước 1 và 2 mới bị trừ vào giới hạn tốc độ, nên trang web lạ không làm cạn được giới hạn của
   trang thật.
4. Các đường dẫn `POST /api/animals/*` được xử lý **trước** chỗ server trả 405 cho mọi `POST` lạ.

Yêu cầu sai thì trả lỗi và không đổi dữ liệu.

### 8.2. Các đường dẫn

| Method | Đường dẫn | Thân | Việc làm |
|---|---|---|---|
| GET | `/api/animals` | — | Trạng thái hiển thị (mục 8.3) và bảng loài |
| GET | `/api/animals/events` | — | Luồng SSE riêng cho thú: gửi trạng thái khi có thay đổi và mỗi 5 giây |
| POST | `/api/animals/env` | `{ weather: 'clear' \| 'rain' \| 'snow', visible: true \| false }` | Báo thời tiết và tab có đang hiển thị không (trang gửi mỗi 10 giây và khi đổi trạng thái hiển thị) |
| POST | `/api/animals/catch` | `{ wildId }` | Bắt đầu bắt |
| POST | `/api/animals/giveup` | `{ wildId }` | Bỏ cuộc lần bắt đang chạy |
| POST | `/api/animals/release` | `{ id }` | Thả ra đảo |
| POST | `/api/animals/recall` | `{ id }` | Thu về |
| POST | `/api/animals/free` | `{ id }` | Thả tự do |
| POST | `/api/animals/resolve` | `{ freeId }` hoặc `{ cancel: true }` | Chọn con để thả tự do khi bộ sưu tập đầy, hoặc huỷ |

- **Trang tự quy đổi thời tiết** trước khi gửi: `storm` thành `rain`; `cloudy`, `fog` thành `clear`.
- **Nhiều tab ở chế độ thời tiết ngẫu nhiên** mỗi tab có thời tiết riêng: server lấy báo cáo của tab **đang hiển thị**
  gửi gần nhất, và vẫn chỉ đổi thời tiết tối đa mỗi 5 phút.

### 8.3. Trạng thái gửi cho trang

- `GET /api/animals` và luồng `/api/animals/events` trả về:
  - danh sách con đã bắt, các con đang thả, các loài từng bắt được, tổng số lần bắt;
  - thú hoang hiện tại (`id`, loài, thời gian ở lại còn lại) và lần bắt (cần bao nhiêu, đã làm bao nhiêu, hạn chót còn
    lại, có đang tính không);
  - thông báo cần hiện (ví dụ "đã khôi phục bản trước").
- **Không trả:** khoá, `seq`, `spawnNo`, chi tiết session, và không cho biết trước loài của con kế tiếp.
- **Luồng riêng, không dùng `/events`:**
  - Luồng `/events` đang có chỉ mở ở chế độ Live, nên dùng nó thì chế độ Mô phỏng sẽ không có thú.
  - Luồng riêng cũng giữ dữ liệu thú tách hẳn khỏi `snapshot()`, thứ publisher đọc để gửi lên hub.
  - Có test bảo đảm dữ liệu publisher nhận không có khoá `animals`.
- **Trang nhận biết server cũ:** `GET /api/animals` không trả 200 thì trang ẩn toàn bộ tính năng thú (chip, bảng), không
  báo lỗi.

## 9. Kiến trúc

### 9.1. Phần mới

| Phần | Nội dung |
|---|---|
| `lib/animals.js` | Thuần, có test. Gồm: bảng `SPECIES`, `RARITY`, bốc thăm, các bước của thú hoang (xuất hiện, rời đi, bắt, xổng), tính thời gian làm việc từ danh sách session, kẹp thời gian, kiểm tra từng hành động. |
| `lib/animal-store.js` | Khoá, mã hoá và giải mã AES-256-GCM, ghi an toàn, bản `.bak`, xử lý dữ liệu hỏng. |
| `server.js` | Khởi động "bộ máy thú" **chỉ sau khi giữ được cổng** (mục 9.2), thêm các đường dẫn và luồng ở mục 8. |
| `<script id="animal-sprites">` trong trang | Hình pixel 14 loài. |
| Phần còn lại của trang | Vẽ thú và hiệu ứng, đi lại, dò bấm, chip, các bảng, thông báo, báo thời tiết. |

### 9.2. Các điểm cần cẩn thận

- **Chỉ một tiến trình server tính thú.**
  - Plugin bật một tiến trình server cho mỗi session Claude Code. Vòng lặp 1 giây đang có chạy ở **mọi** tiến trình, kể
    cả tiến trình còn đang chờ cổng.
  - Vì vậy bộ máy thú có nhịp riêng, và **chỉ khởi động trong `listenWithRetry(...).then()`**, cạnh chỗ khởi động
    publisher. Nó đọc khoá và `animals.dat` **tại lúc giữ được cổng**, không phải lúc tiến trình mới chạy.
  - Trước mỗi lần ghi, nó đọc lại `seq` trên đĩa. Nếu `seq` đã đổi (một tiến trình khác, ví dụ chạy ở cổng khác, vừa
    ghi) thì nó nạp lại thay vì ghi đè.
  - Khi tiến trình thoát (`SIGTERM`, `exit`), nó ghi lần cuối.
- **World view:**
  - `draw()`, `hit()`, `stepDogs` của trang được dùng chung cho mọi đảo trong world view.
  - Phần vẽ đọc `this.animals || []`, constructor của `IslandScene` gán `animals = []`, và hàm vẽ phụ thêm vào
    `SCENE_METHODS`.
  - Dò bấm thú là hàm riêng `hitAnimal(e)` với state riêng `selAnimal`, không sửa `hit()`.
- **Đi lại của thú trên đảo** là phần trang trí, tính ở trang: dùng lại `DogLogic.path` trên vùng chó đi được, bỏ 3 ô ổ
  chó.
- **Vẽ:**
  - Thân thú nướng sẵn theo mức sáng và tuyết như chó.
  - Viền theo bậc nướng thành hình riêng, không bị làm tối.
  - Hiệu ứng vẽ sau lớp tối của giông.
  - Cột sáng từ trên trời vẽ trên canvas phía trước, qua `CameraLogic.skyView`.
- **Hỗ trợ thử nghiệm:**
  - Chỉ bật khi chạy server với `TERRARIUM_DEV=1`.
  - Đường dẫn `POST /api/animals/dev` cho phép ép xuất hiện từng loài hay bậc và tua nhanh thời gian làm việc.
  - Chế độ dev dùng **bộ dữ liệu riêng** (`animals-dev.key`, `animals-dev.dat`, chuỗi AAD khác), nên không bao giờ đọc
    hay ghi được bộ sưu tập thật. Ép xuất hiện ở chế độ dev không làm giàu bộ sưu tập thật.

## 10. Hiệu ứng theo bậc hiếm

| Bậc | Khi xuất hiện | Lúc đứng / đi | Lúc đang bắt | Khi bắt được |
|---|---|---|---|---|
| Thường | làn bụi nhỏ ở chân | không có | vòng tiến độ xám | vòng sáng xám |
| Hiếm | bụi + 4 đốm sáng xanh | vòng sáng xanh mờ dưới chân, thỉnh thoảng 1 đốm lấp lánh | vòng tiến độ xanh | vòng sáng xanh |
| Sử thi | cột sáng tím ngắn (0,6 s) | viền tím sáng dần rồi mờ dần, đốm tím bay lên | vòng tiến độ tím có đốm chạy quanh | vòng sáng tím + 8 đốm bắn ra |
| Huyền thoại | cột sáng vàng từ mép trên khung nhìn (1,2 s), viền khung nhìn ánh vàng một nhịp | viền vàng, sao nhỏ xoay quanh, vệt cầu vồng khi đi | vòng tiến độ vàng, sao xoay quanh | vòng sáng vàng + mưa sao |

- **Thú đã thả** giữ hiệu ứng lúc đứng/đi, nhưng nhẹ còn một nửa.
- **Xổng mất:** vòng sáng vỡ thành vài mảnh rồi tắt.
- **Giảm chuyển động** (`prefers-reduced-motion`):
  - Bỏ: hạt bay, cột sáng, ánh viền, vệt cầu vồng, nhấp nháy, bờm đổi màu.
  - Vòng tiến độ vẫn hiện nhưng không xoay.
  - Bắt được thì con vật mờ đi ngay.
- **Chi phí vẽ:** tối đa 6 con (5 thả + 1 hoang), mỗi con 1 thân, 1 viền và khoảng 12 hạt. Không đáng kể.

## 11. Thú trên đảo: đi lại

- **Hành vi:** đứng yên, đi dạo, hành động riêng của loài, nằm nghỉ.
- **Ngủ:** thú đã thả ngủ từ 22:00 tới 6:00, cùng giờ ngủ của chó. Cú ngủ ban ngày.
- **Không dừng hay ngủ trên đường đá và chân cầu thang**, không vào ổ chó.
- **Con đang bị bắt** đứng yên trong vòng sáng.

## 12. Ngôn ngữ

- Mọi chữ mới qua `tr()`, có đủ 7 bảng.
- Tên loài và tên bậc viết thành bảng khoá cố định trong trang, ví dụ `SPECIES_NAME = { hen: tr('animal.name.hen'), ... }`.
- Server chỉ trả `id` loài (tiếng Anh, ASCII), không trả chữ hiển thị.
- Ước tính khoảng 55 khoá mới.

## 13. GĐ2: cho người khác thấy (chỉ phác thảo)

- **Đường đi của dữ liệu:** server local đã giữ dữ liệu, nên thêm `animals: [{ species }]` (tối đa 5, loài lấy từ danh
  sách cố định) vào `lib/public-view.js` và `lib/publisher.js`.
- **Hub:** nhận và kiểm tra field đó (`hub/validate.js`, `hub/world.js`, `hub/publish.js`), giữ trong bộ nhớ, phát đi
  trong sự kiện `island`. Hub phải lên trước, vì hub cũ từ chối cả gói khi gặp field lạ.
- **Chống gian lận mạnh hơn:** hub có thể tự xác nhận "thời gian làm việc" từ trạng thái session mà máy đã gửi lên, và
  tự ký kết quả bắt. Lúc đó sửa code trên máy mình cũng không ăn gian được với người khác.
- **Thú hoang không chia sẻ.** Đảo riêng tư thì gửi danh sách rỗng.

## 14. Kiểm thử

**`tests/animals.test.mjs`** cho `lib/animals.js`, dùng hàm ngẫu nhiên có seed và đồng hồ giả:

- **Tỉ lệ:** với từng tình huống ở mục 3.4, bốc thăm 200.000 lần. Mỗi loài khớp tỉ lệ tính từ trọng số, sai số tối đa
  ±10 % của chính tỉ lệ đó.
- **Điều kiện:** loài theo điều kiện không ra sai điều kiện; báo cáo thời tiết quá 5 phút thì coi là quang.
- **Nhịp:**
  - Không bao giờ có 2 thú hoang.
  - Không có con mới trong lúc bắt hay chờ chọn.
  - Khởi động lại không làm con mới ra sớm hơn.
- **Thử thách bắt:**
  - Chỉ cộng giây khi có session gốc ở trạng thái làm việc; `permission`, `idle`, `done`, `error` và sub-agent không tính.
  - Nhiều session không cộng nhanh hơn.
  - Đủ thời gian trước hạn chót thì bắt được; hết hạn thì xổng.
- **Đồng hồ:**
  - Chỉnh giờ máy tiến hay lùi không làm đồng hồ nào chạy nhanh hơn.
  - Mỗi nhịp tính tối đa 2 giây; server tắt hay máy ngủ thì mọi đồng hồ dừng.
  - Chờ con mới và ở lại chỉ chạy khi có tab đang hiển thị.
- **Bốc thăm cố định:** cùng khoá và cùng `spawnNo` thì ra cùng một con.
- **Đo làm việc:**
  - Session có `busy` từ Claude Code được tính, kể cả khi trạng thái hiển thị là `permission`.
  - Session không có transcript, hay transcript không có dòng mới trong 10 phút, không được tính.
  - `waiting` chỉ được tính khi sub-agent đang làm việc.
- **Hành động:**
  - Mỗi đường dẫn từ chối dữ liệu sai: `id` lạ, bắt con không phải thú hoang hiện tại, thả quá 5 con.
  - Bắt khi bộ sưu tập đầy thì sang trạng thái chờ chọn; chọn hay huỷ đều ra đúng kết quả, và bộ sưu tập không bao giờ
    vượt 50.

**`tests/animal-store.test.mjs`:**

- Ghi rồi đọc lại đúng.
- Sửa một byte bất kỳ trong `ct`, `iv` hay `tag` đều bị phát hiện.
- Khoá khác thì không đọc được.
- Sửa từng byte của dữ liệu đã giải mã base64, cắt ngắn thẻ, đổi `v` hay `alg`: đều bị phát hiện. Base64 không mã hoá
  lại ra đúng chuỗi cũ cũng bị từ chối.
- Hỏng file chính thì dùng `.bak` và báo; hỏng cả hai thì bắt đầu mới và giữ lại file `.bad-*`.
- Mất `animals.dat` mà còn `.bak` thì khôi phục, không coi là lần đầu.
- Mất khoá mà còn dữ liệu thì tắt tính năng, không đụng file. Hai tiến trình cùng tạo khoá thì chỉ có một khoá.
- Tắt tiến trình giữa lúc ghi (giả lập) thì vẫn còn một file hợp lệ.
- Dữ liệu dev không đọc được dữ liệu thật và ngược lại.
- Quyền file 0600, thư mục 0700.

**`tests/server-local.test.mjs`** (thêm):

- Đường dẫn `/api/animals/*` từ chối khi thiếu header `X-Terrarium`, khi `Origin` lạ, khi thân quá 1 KB.
- Yêu cầu bị từ chối không bị trừ vào giới hạn tốc độ.
- `snapshot()` và dữ liệu publisher nhận không chứa dữ liệu thú.
- Chỉ tiến trình giữ cổng mới chạy bộ máy thú.

**Các test khác:**

- **Hình pixel:** đủ khung hình, chân chạm hàng dưới cùng, mọi ký tự có trong bảng màu.
- **i18n:** test sẵn có kiểm tra đủ khoá ở 7 ngôn ngữ.
- **World view:** `IslandScene` vẽ được khi không có thú.

**Trên trình duyệt** (server chạy với `TERRARIUM_DEV=1`):

- Ép xuất hiện từng bậc và xem hiệu ứng.
- Bắt và tua nhanh thời gian làm việc. Xổng vì hết hạn. Bỏ cuộc.
- Đầy 50 rồi chọn hoặc huỷ. Mở 2 tab.
- Sửa file `animals.dat` bằng tay để thấy thông báo dữ liệu hỏng.
- Ngày/đêm, mưa, tuyết, giảm chuyển động, zoom 4×, điện thoại.

## 15. Quyết định

Mọi câu hỏi đã được trả lời (2026-11-05). Không còn câu hỏi mở.

| Mục | Quyết định |
|---|---|
| Giới hạn | Bộ sưu tập 50 con; đầy thì hỏi mỗi lần (mục 6.3) |
| Q1 | Bắt bằng thử thách thời gian làm việc, độ khó theo bậc; trong lúc bắt không có con mới (mục 5) |
| Q2 | 14 loài và trọng số như mục 3.2 |
| Q3 | Ban đầu chọn `localStorage`. **Đổi sang server local có mã hoá và ký**, theo yêu cầu chống chèn dữ liệu (mục 7) |
| Q4 | Nhịp xuất hiện 4–10 phút |
| Q5 | Tạm dừng không ảnh hưởng thú hoang |
| Q6 | GĐ2 để sau |
| Đồng hồ | Chờ con mới và ở lại chỉ chạy khi có người xem trang; server tắt hay máy ngủ thì mọi đồng hồ dừng (mục 4.4) |
| Q7 | Làm việc cần 3/8/15/30 phút, hạn chót 20/40/75/150 phút theo bậc (mục 3.1) |
| Q8 | Nhiều session cùng làm việc không cộng nhanh hơn: 1 giây là 1 giây (mục 5.2) |
| Q9 | Tính cả `talking`, và `waiting` khi sub-agent đang làm việc (mục 5.2) |
