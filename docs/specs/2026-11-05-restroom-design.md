# Nhà vệ sinh cạnh pantry, dời khu hút thuốc xuống bãi cỏ phía đông

Ngày: 2026-11-05 · Người đặt hàng: anh Kiệt · Người viết: Claude

## 1. Ý định và lý do

Anh Kiệt gửi ảnh chụp bãi cỏ phía đông, ngay ngoài bức tường pantry có bảng CAFE. Chỗ đó đang là khu hút thuốc
(nền đá, giàn leo, ghế băng, thùng tàn thuốc inox, bồn cây chắn, đèn, bình chữa cháy, biển báo). Lời anh:
"thiết kế nhà vệ sinh cạnh chỗ này, dời khu hút thuốc xuống dưới".

- **Nhà vệ sinh** đứng đúng chỗ khu hút thuốc hiện nay, sát pantry: người trong pantry ra là tới, như một văn phòng thật.
- **Khu hút thuốc** dời "xuống dưới", tức về phía trước và phía dưới trên màn hình isometric (tăng `y`), cách nhà vệ sinh
  ba hàng cỏ để khói không bay vào chỗ đi vệ sinh.
- Agent rảnh thỉnh thoảng đi vệ sinh một lát rồi quay lại, như một hoạt động ngắn.

## 2. Vị trí

Lưới văn phòng 27×14 (`W`, `H`). Bãi cỏ phía đông là các cột `x ≥ 27`. Cầu thang đông ở `(27, 7..8)`.
Đường đá chạy dọc cột `x = 27` từ chân cầu thang xuống hàng `y = 15`, cộng một nhánh ngắn `(27,7) → (28,7) → (28,6)`.

| Khu | Ô chừa (`SkyLogic.outdoorSpots`) | Trước | Sau |
|---|---|---|---|
| `east-back` | `x 28..31, y 2..5` (4×4), sát tường đông pantry | khu hút thuốc | **nhà vệ sinh** |
| `east-front` | `x 28..31, y 9..12` (4×4) | ô chừa 4×3 ở `y 10..12`, bỏ trống | **khu hút thuốc** |
| `south-left` | không đổi | trống | trống |

### 2.1. Nhà vệ sinh (`east-back`)

- Thân nhà chiếm 3×3 ô `x 28..30, y 2..4`, hơi thụt vào trong ô (khoảng `x 28.15–31.0`, `y 2.5–4.95`).
  Các ô này bỏ khỏi `LAWN_WALK`: không ai đi xuyên tường.
- Hàng `y = 5` là thềm lát gạch trước cửa. Nhánh đường đá sẵn có dừng ngay dưới thềm, ở `(28,6)`, nên nhánh này
  từ nay dẫn tới nhà vệ sinh.
- Cột `x = 31`, hàng `y 2..4` vẫn là cỏ đi được (lối vòng sau nhà).
- Hai chỗ đứng (idle spot) ở cửa: ô `(28,5)` và `(29,5)`, mặt quay vào cửa.

### 2.2. Khu hút thuốc (`east-front`)

- Ô chừa `east-front` đổi từ 4×3 thành 4×4: `x 28..31, y 9..12` (`y = H-5`). Bố cục bên trong giữ nguyên như
  `SmokeLogic.layout` hiện nay: bồn cây chắn ở cột phía pantry (`x = 28`, `y 9..11`), ghế băng hàng sau, thùng tàn
  thuốc và hai chỗ đứng, cửa vào là hai ô đầu của hàng trước `(28,12)`, `(29,12)`.
- Lúc làm, em thử `y 10..13` trước: cây ở `(29,14)` che mất cửa vào và biển báo, nên lùi lên một hàng.
- **Lý do chọn chỗ này:** đây là chỗ trống lớn nhất phía dưới trên bãi cỏ đông, đã được chừa từ bản sky island nên
  không có cây, không chạm hồ. Đường đá dọc `x = 27` chạy sát cạnh trái khu, nên cửa vào `(28,12)` nằm ngay cạnh
  đường đá `(27,12)`. Giữa hai khu là 3 hàng cỏ (`y 6..8`); khói bốc thẳng lên trên màn hình, không trôi về phía nhà vệ sinh.
- Vì cầu thang nằm **phía trên** khu mới, đường rẻ nhất có thể cắt qua cỏ rồi trèo qua lưng ghế băng vào khu.
  Để tránh vậy, nền đá **chỉ vào được qua hai ô cửa**: mọi cạnh khác của nền là kín (`SmokeLogic.layout(...).shut`),
  được thêm vào tập `EDGE` mà `bfs` đã dùng cho tường văn phòng.
- Ô `(30,9)` hiện có một bông hoa trang trí; ô chừa lớn hơn nên bông hoa này không còn. Đây là thay đổi duy nhất ngoài
  hai khu.
- Biển báo khu hút thuốc dời từ góc trước bên phải sang mép trước, ngay sau cửa vào (`x ≈ X+2`), vì cây ở `(32,13)`
  che góc trước bên phải của chỗ mới.

## 3. Thiết kế hình ảnh nhà vệ sinh

Pixel art cùng kiểu với phần còn lại của đảo, vẽ bằng `PG` (mặt cỏ), mọi màu đi qua `SkyRender.night()` và lớp
tuyết như khu hút thuốc.

| Bộ phận | Mô tả | Màu ban ngày |
|---|---|---|
| Thềm | Nền gạch sáng thấp, phủ thân nhà và hàng `y = 5` | `#c9c3b8` / `#d6d0c4` |
| Tường | Vữa kem như tường pantry, chân tường ốp gạch xanh ngọc cao khoảng 5 | `#efe6d6`, `#4f9d8f` |
| Mái | Mái bằng màu đá phiến, viền trắng, chìa ra một chút; tuyết phủ trắng dần | `#4a5266` |
| Mái hiên | Tấm hiên nghiêng màu xanh ngọc trên hai cửa | `#3f8f82` |
| Hai cửa | Cửa gỗ ở mặt trước; mỗi cửa một biển hình người nhỏ (nam xanh dương, nữ đỏ hồng) | `#a8763e` |
| Biển WC | Biển xanh chữ `WC` trắng, trên gương lavabo (chỗ này không bị người đứng ở cửa che) | `#3a8fd0` / `#ffffff` |
| Đèn báo | Chấm nhỏ trên mỗi cửa: xanh lá khi trống, đỏ khi có người | `#46a758` / `#e5484d` |
| Lavabo | Chậu sứ trắng gắn tường bên phải hai cửa, vòi inox, gương xanh nhạt có vệt sáng phía trên | `#f6f4ee`, `#bfe3ff` |
| Cửa sổ nhỏ | Ô kính mờ cao ở mặt hông đông | `#dfe8f2` |
| Đèn tường | Đèn trên gương; tối thì sáng vàng ấm, rọi một vũng sáng xuống thềm | `#ffd98a` |
| Chậu cây | Chậu cây nhỏ ở góc trước bên phải thềm | `#d0743c`, lá như bụi cây khu hút thuốc |

- **Ngày:** màu như bảng trên.
- **Đêm:** mọi màu qua `night()`. Đèn tường, kính mờ (khi có người bên trong) và vũng sáng trên thềm giữ màu ấm,
  không bị làm tối.
- **Tuyết:** mái, thềm, mái hiên và lá cây pha dần sang trắng theo `snow`, như khu hút thuốc.
- Cửa có người đang vào hoặc ra thì vẽ hé mở (thấy khoảng tối bên trong). Lúc người ở trong thì cửa đóng, đèn báo đỏ.

## 4. Agent dùng nhà vệ sinh

- Hai idle spot mới trong `IDLE_SPOTS`, `act: 'wc'`, từ `RestroomLogic.layout(zone).spots`.
- Bong bóng: `🚻 đi vệ sinh` (`ACT_TXT.wc`).
- Một lượt (`RestroomLogic.visit(t)`, `t` là giây mô phỏng đứng ở cửa, đã nhân `speed`):
  - `0 – 0.8 s`: đứng ở cửa, cửa hé (`door`);
  - `0.8 – 7.8 s`: vào trong, nhân vật ẩn, cửa đóng, đèn báo đỏ (`inside`);
  - `7.8 – 8.6 s`: ra lại cửa, cửa hé (`out`);
  - sau đó (`done`): agent nhận một idle spot khác (không phải nhà vệ sinh) và đi tiếp. Agent đó không quay lại nhà
    vệ sinh cho tới khi hết rảnh.
- Spot được chọn ngẫu nhiên như các idle spot khác (2 trên khoảng 30 spot), nên chỉ thỉnh thoảng mới có người đi.
- Chó không chạy tới chào người đang ở trong nhà vệ sinh (người đó không được gửi vào danh sách agent ngoài cỏ của chó).

## 5. Đường đi, lưới đi bộ, vùng chó đi

- `LAWN_WALK` bỏ 9 ô thân nhà vệ sinh và 3 ô bồn cây khu hút thuốc.
- `EDGE` thêm các cạnh kín của nền khu hút thuốc (mọi cạnh biên trừ cạnh đi vào hai ô cửa).
- Nền khu hút thuốc và thềm nhà vệ sinh đi rẻ như đường đá (cost 1).
- `DogLogic.roamCells(..., {avoid})` tránh cả hai ô chừa `east-back` và `east-front`.
- Đường đá không đổi. Nhánh ngắn giờ dẫn tới thềm nhà vệ sinh; khu hút thuốc nằm sát đường đá dọc `x = 27`.

## 6. Những gì giữ nguyên

- Mọi thứ khác trên đảo: văn phòng, pantry, hồ, thác, cây, hoa, đường đá, chó (trừ vùng tránh), bầu trời, thời tiết.
- Bố cục bên trong khu hút thuốc, nhịp hút thuốc (`SmokeLogic.cycle`), khói, hình vẽ từng món.
- Khối `world-view` và `world-logic` không sửa. Đảo trong world view tự có thay đổi vì dùng chung `ISLAND` và các
  hàm vẽ.

## 7. Điều không được xảy ra (anti-goals)

- **Không có gì thô tục:** không vẽ bồn cầu, không âm thanh, không hình ảnh bên trong. Chỉ có cửa, biển và lavabo;
  người vào thì biến mất sau cánh cửa.
- **Khói không bay vào nhà vệ sinh:** hai khu cách nhau ít nhất 3 hàng cỏ (có test).
- **Không thay đổi phần nào khác của đảo**, ngoài bông hoa ở `(30,9)` nằm trong ô chừa mới.
- Không ai đi xuyên tường nhà vệ sinh hay leo qua lưng ghế vào khu hút thuốc; chó không vào hai khu.
- Không thêm dependency hay bước build; trang vẫn là một file.

## 8. Để người làm tự quyết

- Kích thước pixel chính xác, độ cao tường và mái, vị trí biển.
- Thời lượng một lượt đi vệ sinh, miễn là ngắn (dưới 10 giây mô phỏng).
