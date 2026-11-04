# Sky island: bầu trời, hòn đảo và thời tiết quanh văn phòng

Ngày: 2026-11-04 · Người đặt hàng: anh Huy · Người viết: Claude (phiên brainstorm cùng anh Huy)

## 1. Ý định và lý do

Hiện tại văn phòng pixel nằm trên một nền màu trơn (kem ban ngày, xanh đen ban đêm), nên cả cảnh trông
phẳng, không có chiều sâu. Anh Huy muốn văn phòng nằm trên **một hòn đảo lơ lửng giữa trời theo tinh thần
"sky island"**: bầu trời rộng lớn, sâu thẳm, biển mây phía dưới, thời tiết đa dạng và tự đổi. Cảm giác chung
phải **chill**: chuyển động chậm, màu dịu, không có gì giật hay nhấp nháy gắt.

Đây cũng là nền cho các tính năng sau: anh Huy định thiết kế **các khu ngoài trời cố định trên bãi cỏ**
(ví dụ khu hút thuốc cho agent vừa xong task dài). Vì vậy hòn đảo phải có **một hình cố định, giống nhau trên
mọi máy**, và chừa sẵn chỗ cho các khu đó.

Bản phác thảo động đã duyệt (chỉ có trên máy anh Huy, không commit):
`.superpowers/brainstorm/81528-1793787829/content/` — `sky-depth.html` (phương án A được chọn),
`sky-island-v3.html` (đảo hình tự nhiên, mặt dưới thả sâu), `island-shore-v2.html` (phương án B được chọn:
mép uốn lượn nhẹ, cỏ rộng 6 ô).

## 2. Mục tiêu

1. **Bầu trời phủ kín cả khung văn phòng**, kể cả hai dải trống hai bên (stage), không còn nền màu trơn.
2. **Bố cục "biển mây phía dưới"** (anh Huy chọn): đường chân trời nằm ngang khoảng giữa khung; phía trên trời
   đậm dần lên đỉnh; phía dưới là biển mây khối vuông trải tới chân trời.
3. **Cảm giác rộng và sâu** nhờ phối cảnh không khí:
   - nhiều lớp mây ở các khoảng cách khác nhau: càng xa càng nhỏ, nhạt màu về phía sương và trôi chậm;
   - một dải sương sáng ở đường chân trời;
   - vài hòn đảo nhỏ ở xa, mờ dần trong sương;
   - một đám mây gần thỉnh thoảng trôi ngang phía trước đảo;
   - chim bay xa (nhỏ, thưa).
4. **Hòn đảo văn phòng**:
   - bãi cỏ rộng **6 ô** ở phía trước văn phòng, gồm mặt trước trái và mặt trước phải (anh Huy chọn);
   - phía sau hai bức tường chỉ là **dải cỏ mỏng 2 ô**. Anh Huy đổi ý khi đang làm: "phần cỏ phía sau bức tường mỏng thôi";
   - văn phòng trên màn hình còn khoảng **63%** cỡ hiện tại;
   - văn phòng đứng trên một **bệ móng cao hơn mặt cỏ**, thấy được hai mặt đá phía trước. Anh Huy yêu cầu thêm khi đang làm: "sàn nhà âm dưới không đẹp";
   - **mép đảo uốn lượn nhẹ** (anh Huy chọn): vài vịnh và mũi đất lớn, **không có mấu lồi lõm một ô**
     (anh Huy nói rõ không thích kiểu "tua tua");
   - mặt dưới là đất (lớp trên) rồi đá (lớp dưới), **sâu nhất ở giữa, mỏng dần ra mép**, thả nhũ đá xuống;
   - dây leo rủ ở mép trước, một thác nước rơi từ mép đảo vào biển mây (tan dần vào sương);
   - cây, đá, hoa trang trí trên bãi cỏ, **không đặt lên các ô chừa sẵn**;
   - **một hình cố định chung cho mọi máy** (anh Huy chọn), sinh từ một seed hằng số hoặc mặt nạ ghi cứng;
   - đảo nhấp nhô lên xuống rất chậm, biên độ vài pixel (giữ cảm giác lơ lửng).
5. **Ngày và đêm theo giờ thật** như hiện nay (`dayFactor`), thêm màu trời bình minh và hoàng hôn; ban đêm có
   sao và trăng.
6. **Thời tiết**, gồm: trời quang, nhiều mây, mưa, giông, tuyết, sương mù. Chuyển đổi giữa hai kiểu thời tiết diễn ra
   từ từ trong vài chục giây, không bật tắt đột ngột.
7. **Hai chế độ thời tiết, chọn trong bảng cài đặt** (anh Huy yêu cầu cả hai):
   - **Ngẫu nhiên** (mặc định): tự đổi sau mỗi 20–40 phút, phần lớn thời gian trời quang.
   - **Thời tiết thật**: theo thành phố người dùng nhập, lấy dữ liệu từ Open-Meteo.
   - Thêm lựa chọn **Tắt** (luôn trời quang) và các **nút xem thử** từng kiểu thời tiết ngay lập tức.
8. **Thời tiết ảnh hưởng vào trong văn phòng** (đã đề xuất, anh Huy đồng ý):
   - trời mưa: giọt nước đọng và chảy trên kính cửa sổ;
   - trời giông: văn phòng tối đi một chút, chớp chỉ loé nhẹ;
   - trời tuyết: bãi cỏ trắng dần.
   - Agent vẫn làm việc bình thường, hành vi không đổi.

9. **Hồ nhỏ, bậc thang và hoạt động tắm**, anh Huy yêu cầu thêm khi đang làm:
   - thác nước chảy ra từ một hồ nhỏ trên bãi cỏ phía trước bên phải;
   - có bậc thang đá đi xuống ở mép đông của pantry;
   - agent đang rảnh có thể đi xuống bậc thang, ra hồ tắm.
   Ngoài việc tắm hồ, agent vẫn chưa dùng bãi cỏ cho việc gì khác.
10. **Đảo to hơn trên màn hình**, anh Huy yêu cầu thêm: khung hình canh theo mặt đảo, phần đáy đá sâu được phép tràn ra mép dưới.

## 3. Ngoài phạm vi (làm sau)

- Các khu ngoài trời (khu hút thuốc, ghế đá...) và việc agent đi ra bãi cỏ. Lần này **chỉ chừa chỗ**.
- Thay đổi hành vi agent theo thời tiết (che ô, trú mưa...).
- Âm thanh.
- Làm lại đồ hoạ văn phòng (anh Huy sẽ redesign riêng).

## 4. Điều không được xảy ra (anti-goals)

- **Không sao chép tài sản của Minecraft**: không texture, hình, tên, logo, mặt trời vuông đặc trưng. Chỉ lấy
  tinh thần thể loại (đảo lơ lửng, mây khối) bằng pixel art tự vẽ.
- Không nhấp nháy gắt hay chớp sáng toàn màn hình. Có cài đặt hệ điều hành "giảm chuyển động"
  (`prefers-reduced-motion`) thì chớp không loé, mưa và tuyết thưa hơn, mây chậm hơn.
- Không gửi bất kỳ dữ liệu nào ra ngoài khi chưa bật chế độ Thời tiết thật.
- Không làm hỏng những gì đang chạy: trang vừa khít cửa sổ không cuộn, đầu trang gọn, nút ⚙ trong khung,
  bấm vào nhân vật mở bảng chi tiết, bong bóng chữ nằm đúng trên đầu nhân vật, kết nối SSE live, chế độ
  mô phỏng, cây theo mùa ở pantry, tên phòng ban trên sàn.
- Không thêm dependency hay bước build. Trang vẫn là **một file HTML tự chứa** (bản demo host trên claude.ai
  vẫn phải chạy được).
- Không tụt khung hình: phải giữ mượt trên MacBook M4, màn hình retina 2x, cửa sổ toàn màn hình.

## 5. Ràng buộc kỹ thuật (từ code hiện tại)

- **Kiến trúc trang** (`claude-office.html`): React UMD không JSX (`h = React.createElement`).
  - Toàn bộ cảnh vẽ trên một canvas.
  - Logic cảnh nằm trong `draw()`: tường, sàn, đồ vật được sắp theo `z` rồi vẽ lần lượt.
  - Phép chiếu isometric 2:1: `P(x,y,z)`, `TW=16`, `TH=8`.
  - Lưới văn phòng 27×14 ô (`W`, `H`), gốc toạ độ ở góc sau văn phòng; `LW`, `LH`, `OX`, `OY` suy từ đó.
  - Canvas được vẽ ở độ phân giải màn hình (hệ số `k`, tối đa 4) và giữ tỉ lệ trong "stage";
    nền của stage hiện được tô bằng `th.bg`.
- **Bong bóng chữ** là lớp HTML đặt theo phần trăm của `LW/LH` trên canvas.
  **Bấm chọn nhân vật** (`hit()`) quy đổi toạ độ chuột theo `getBoundingClientRect()` của canvas và `LW/LH`.
  Mọi thay đổi khung nhìn (thu nhỏ văn phòng còn ~63%, mở rộng cảnh ra cả stage) phải giữ hai thứ này khớp.
- **Tìm đường của agent** (`bfs`, `BLOCK`, `EDGE`) chỉ trên lưới văn phòng. Lần này giữ nguyên, agent chưa ra
  bãi cỏ. Cửa ra vào ở tường trái `DOOR` vẫn là nơi agent vào và ra khỏi cảnh.
- **Ngày/đêm**: `dayFactor()` và `THEMES.night/day` đang nội suy màu văn phòng. Bầu trời và đảo dùng cùng
  `dayFactor`, thêm màu riêng cho bình minh và hoàng hôn.
- **Cửa sổ văn phòng** hiện vẽ kính, mây, sao và trăng, đã cắt theo khung kính. Cảnh qua cửa sổ nên khớp màu
  với bầu trời mới. Mức độ khớp đến đâu là do người làm quyết định.
- **Server** (`server.js`) chỉ phục vụ `/` và luồng SSE. Từ bản 1.2.6 server chỉ nghe ở `127.0.0.1` và giới hạn
  CORS theo localhost. Không cần sửa server cho tính năng này.
- **Hiệu năng**:
  - Đảo khoảng 1.000 ô, mỗi ô có nhiều khối đất đá. Không được vẽ lại từng khối mỗi khung hình,
    mà phải dựng sẵn ra một ảnh offscreen và chỉ dựng lại khi cần:
    - đổi hệ số `k`;
    - đổi kích thước;
    - đổi mức ngày/đêm hoặc mức tuyết vượt một ngưỡng.
  - Mục tiêu ≥ 50 khung hình/giây ở 1440×900, màn hình 2x, đo bằng `requestAnimationFrame` (như cách đo ở bản 1.2.7).
- **Kiểm thử**: repo chưa có bộ test.
  - Phần logic thuần phải có test bằng `node --test`, không thêm dependency. Gồm: sinh hình đảo, lịch đổi thời tiết
    ngẫu nhiên, ánh xạ mã thời tiết, đọc/ghi cài đặt.
  - Trang phải vẫn là một file, nên logic thuần nằm trong một khối `<script>` riêng, có tên. Test đọc file HTML
    và chạy khối đó trong `node:vm`. Đây là đề xuất; người làm có thể chọn cách khác nếu vẫn thoả hai ràng buộc:
    một file, có test.
- **Phát hành** theo quy ước của repo:
  - tăng `version` trong `.claude-plugin/plugin.json` lên **1.3.0** (tính năng mới);
  - thêm mục vào `CHANGELOG.md`;
  - gắn annotated tag `v1.3.0`;
  - kéo main mới nhất về trước khi commit (đã từng bị ghi đè ở bản 1.2.4).

## 6. Những phần đã chốt (theo lời anh Huy)

| Chủ đề | Quyết định |
|---|---|
| Phong cách | Sky island: mây khối vuông, đảo lơ lửng; bố cục "biển mây phía dưới" |
| Bãi cỏ | Rộng 6 ô quanh văn phòng |
| Mép đảo | Uốn lượn nhẹ, gọn, không mấu một ô |
| Hình đảo | Một hình cố định chung cho mọi máy |
| Thời tiết | Có cả Ngẫu nhiên và Thời tiết thật, chọn trong bảng cài đặt |
| Không khí | Chill |

## 7. Những phần em tự chọn (anh Huy có thể đổi)

1. **Lịch thời tiết ngẫu nhiên**:
   - mỗi 20–40 phút chọn kiểu kế tiếp, thời gian chuyển 30–60 giây;
   - tỉ trọng gợi ý: trời quang 45%, nhiều mây 25%, mưa 12%, sương mù 8%, giông 5%, tuyết 5%;
   - tuyết chỉ ra vào tháng 12 đến tháng 2, các tháng khác tỉ trọng của tuyết chuyển sang trời quang;
   - không lặp lại cùng một kiểu hai lần liên tiếp, trừ trời quang.
2. **Thời tiết thật**:
   - người dùng nhập tên thành phố trong bảng cài đặt; trang gọi geocoding của Open-Meteo
     (`https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1`) để lấy toạ độ;
   - sau đó cứ 15 phút gọi forecast (`https://api.open-meteo.com/v1/forecast`, tham số `current=weather_code`)
     từ trình duyệt;
   - miễn phí cho mục đích phi thương mại, dưới 10.000 lượt gọi mỗi ngày, không cần khoá. Người làm cần kiểm lại
     tài liệu Open-Meteo trước khi code;
   - mặc định **tắt**; chưa bật thì không gửi gì ra ngoài;
   - lỗi mạng hoặc không tìm thấy thành phố thì bảng cài đặt báo rõ lý do, và trang tạm dùng chế độ Ngẫu nhiên;
   - README đang ghi "nothing leaves your machine", phải sửa câu đó cho đúng.
3. **Ánh xạ mã WMO sang kiểu thời tiết**:

   | Mã WMO | Kiểu thời tiết |
   |---|---|
   | 0–1 | Trời quang |
   | 2–3 | Nhiều mây |
   | 45, 48 | Sương mù |
   | 51–67, 80–82 | Mưa |
   | 71–77, 85–86 | Tuyết |
   | 95–99 | Giông |
4. **Cài đặt được lưu** trong `localStorage` của trình duyệt, gồm chế độ thời tiết và tên thành phố.
   Mọi thao tác đọc/ghi phải bọc `try/catch`. Hiện các cài đặt khác chưa được lưu; lần này chỉ lưu phần thời tiết.
5. **Ba ô chừa cho khu ngoài trời** trên bãi cỏ, vị trí như bản phác thảo `island-shore-v2.html`:
   - bên phải phía trước;
   - phía trước bên trái;
   - bên phải phía sau.
   Không đặt cây, đá hay hoa lên các ô này. Toạ độ của chúng phải nằm ở một hằng số có tên, để tính năng sau dùng lại.
6. **Tuyết phủ cỏ**: bãi cỏ chuyển dần sang trắng trong khoảng 10 phút khi đang có tuyết, rồi tan dần trong
   khoảng 20 phút sau khi hết tuyết.
7. **Giông**: văn phòng tối thêm khoảng 15–20%. Chớp loé nhẹ trong 120–200 ms, cách nhau 8–20 giây.

## 7b. Đã trả lời sau vòng đọc kiểm (builder check)

1. **Tỉ lệ văn phòng ~63% thắng bố cục "trời mở" của bản `sky-depth.html`.**
   - Anh Huy chọn cỏ 6 ô sau khi xem bản so sánh cỡ đảo vẽ đúng tỉ lệ (`island-size.html`, `island-shore-v2.html`).
     Đó chính là khung hình được duyệt: đảo chiếm phần lớn khung, trời hiện ở phía trên tường và hai bên đảo.
   - Đường chân trời, dải sương và đảo xa chỉ hiện ở các phần trời còn trống (hai bên, phía trên), được vậy là đủ.
   - **Không** thu nhỏ văn phòng dưới 63% để có thêm khoảng trời.
   - Tỉ lệ được giữ để cả đảo, kể cả mặt dưới, lọt vừa khung. Ở cửa sổ thấp mà rộng thì phần trời hai bên rộng ra.
2. **Bản demo trên claude.ai nằm ngoài phạm vi.**
   - Repo không publish lại demo; demo nằm trên tài khoản khác.
   - Chế độ Thời tiết thật gọi Open-Meteo thẳng từ trình duyệt, **không** đi qua `server.js`.
   - Môi trường nào chặn gọi ra ngoài (như demo) thì bảng cài đặt báo rõ lý do, và trang tạm dùng chế độ Ngẫu nhiên,
     đúng như mục 7.2.

## 8. Để người làm tự quyết

- Cách chia lớp vẽ, ví dụ một canvas cỡ stage hay tách canvas trời, cảnh và hiệu ứng. Ràng buộc chung:
  - bầu trời phủ cả stage;
  - mây gần và mưa, tuyết vẽ đè lên cả đảo lẫn văn phòng;
  - bong bóng chữ và bấm chọn vẫn khớp.
- Số lớp mây, mật độ hạt mưa và tuyết, bảng màu cụ thể theo giờ trong ngày. Bám theo các bản phác thảo đã duyệt.
- Thuật toán sinh mép uốn lượn, miễn là cố định, gọn, không mấu một ô và chứa trọn văn phòng cộng 6 ô cỏ.
- Bố cục chi tiết của bảng cài đặt, theo kiểu `.settings-panel` sẵn có.
- Cách đo và chứng minh hiệu năng.
