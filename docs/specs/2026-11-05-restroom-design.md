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

---

# Bản 2 (cutaway, theo brief của anh Kiet)

Ngày: 2026-11-05 (chiều) · Thay cho mục 2.1, 3, 4 và một phần mục 5 ở trên. Khu hút thuốc (2.2) giữ nguyên.

## B1. Ý định

Anh Kiệt gửi một art brief: nhà vệ sinh không mái (cắt lớp, nhìn thấy hết bên trong) **gắn thẳng vào pantry**, cùng
phong cách pixel isometric 2:1 của văn phòng. Từ trái sang phải dọc tường sau: pantry (giữ nguyên) → vách lửng kính mờ
→ **WC NAM** (nhấn xanh `#173DC9`) → vách lửng kính mờ → **WC NỮ** (nhấn hồng `#D9467A`); phía trước là **SẢNH CHUNG**
sàn gỗ, mở thông sang pantry. Căn nhà nhỏ 3×3 có mái của buổi sáng bị bỏ.

Brief viết cho ảnh vẽ tay; ở đây nó được "dịch" sang renderer canvas đang có: cùng phép chiếu `P(x,y,z)`, cùng kiểu
hộp ba mặt (mặt trên sáng nhất, mặt trái vừa, mặt phải tối nhất), không gradient, viền tối 1px `#2B2D42`.

## B2. Vị trí và kích thước

Đảo nhìn từ trên (cột `x`, hàng `y`; `o` văn phòng, `.` cỏ). Mép đông của đảo ở `x = 35` cho các hàng `y 2..7`, nhưng
hàng `y = 1` chỉ tới `x = 33` và hàng `y = 0` chỉ tới `x = 31`.

| | Giá trị |
|---|---|
| Ô chừa `east-back` (`SkyLogic.outdoorSpots`) | `x 27..34, y 2..6` (8×5), trước là `x 28..31, y 2..5` |
| Sàn khối (bệ) | `x 27 → 34.6`, `y 2 → 7`, cao `FLOOR_Z = 8` như sàn văn phòng; tường sau dày 0.25 ô đứng trên mép sau của sàn (`y 2 → 2.25`), vì hàng `y = 1` phía đông không có đảo bên dưới |
| Phòng nam | `x 27..31, y 2..5` (4×3 ô) |
| Phòng nữ | `x 31..34.6, y 2..5` (3.6×3 ô) |
| Sảnh chung | `x 27..34.6, y 5..7` (2 hàng), cạnh tây `(27,5)`, `(27,6)` mở thẳng sang pantry `(26,5)`, `(26,6)` |

Lý do chọn chỗ này:
- **Bám pantry.** Cạnh tây khối trùng cạnh đông pantry (`x = 27`). Sàn khối cao bằng sàn văn phòng nên người từ pantry
  bước ngang sang sảnh, không cần bậc.
- **Vì sao tường sau ở `y = 2`, không ở `y = 0` cho thẳng tường văn phòng.** Ở `y 0..1` đảo hẹp (tới `x = 31`/`33`):
  khối 8 ô sẽ chìa ra ngoài mép đảo. Ở `y 2..6` đảo rộng đủ 8 ô. Mép đông sàn dừng ở `x = 34.6`, chừa một viền cỏ 0.4 ô
  trước vách đá, để khối không đứng sát mép như sắp rơi.
- Dải cỏ `y 0..1` sau khối gần như bị tường sau che hết; chó và người không vào được đó (tách khỏi bãi cỏ chính).
- Hệ quả biết trước: tường sau cao 3 ô đứng **trước** góc trong cùng của bếp pantry trên màn hình, nên che phần dưới góc
  `x ≥ 25` của tường bếp (đầu tủ nước). Đây là hệ quả của việc gắn khối vào pantry, không sửa đồ pantry.

## B3. Tỷ lệ (theo tileset văn phòng)

- 1 bàn làm việc ≈ 2×1 ô, tức 1 ô ≈ 0.7 m. Tường đầy đủ của văn phòng cao `WALL = 56` px ≈ 3 ô; mặt bàn bếp cao 14 px.
- **Tường sau** của khối: cao đúng `WALL` (56), cùng nẹp đỉnh 3 px như tường văn phòng.
- **Vách lửng** (pantry ↔ nam, nam ↔ nữ): tường trắng cao 28 (nửa tường), nắp đá phiến 2 px, trên là kính mờ tới 46.
- **Tường trước và tường đông của hai phòng**: cao đầu gối, 10 px, nắp đá phiến.
- **Buồng vệ sinh**: rộng 1 ô (nam) và 0.87 ô (nữ, 3 buồng trong 2.6 ô), sâu 1.35 ô (`y 2.25 → 3.6`, tính từ mặt tường sau); vách HPL cao `3 → 32`
  (hở chân 3 px), cao hơn người (đầu người ≈ 23 px). Gọn hơn kích thước thật một chút, như cách tileset thu gọn đồ.
- **Bồn tiểu**: mỗi cái rộng 0.36 ô, cách nhau 0.75 ô (≈ 50 cm), treo tường ở `z 7..18`.
- **Lavabo đôi**: dài 1.6 ô (≈ 1 bàn làm việc), sâu 0.56 ô, mặt đá cao 13..15 (≈ mặt bàn bếp 14).
- Gương cao `z 20..36`, khung LED vàng; máy sấy tay `z 17..24`; cửa sổ kính mờ trên cao `z 40..50`.
- Khung cửa ra vào: hai trụ mảnh tới `z 49`, hộp biển phát sáng `z 49..58`, rộng hơn ô cửa 0.1 ô mỗi bên. Biển treo cao
  vì trên màn hình nó đứng ngay trước người trong phòng: biển ở độ cao `z` trên tường trước che người (cao ≈ 25) đứng ở
  độ sâu `y` nếu `z < 25 + 16·(5 − y)`; với chỗ đứng trước buồng (`y 3.88`) và lavabo (`y ≥ 3.5`) cần `z ≥ 49`.

## B4. Bố cục từng ô

Ký hiệu toạ độ thế giới (ô `x, y`). Tường đứng trên cạnh ô.

**Tường và vách**
- Tường sau: mặt trong ở `y = 2.25`, `x 27 → 34.6`, cao 56. Phần dưới (tới `z 36`) ốp gạch trắng `#F7F9FC` có ron,
  phần trên vữa kem `#F4ECDA`; hai dải cửa sổ kính mờ trên cao, một dải mỗi phòng.
- Vách lửng pantry ↔ nam: `x 27 → 27.14`, `y 2 → 5`. Vách lửng nam ↔ nữ: `x 30.93 → 31.07`, `y 2 → 5`.
- Tường trước hai phòng: `y 4.93 → 5.07`, cao đầu gối, chừa **cửa nam** `x 28 → 29` và **cửa nữ** `x 33 → 34`.
- Tường đông phòng nữ: `x 34.48 → 34.6`, `y 2 → 5`, cao đầu gối. Sảnh không có tường đông và tường trước (như văn phòng).

**WC NAM** (`x 27..31, y 2..5`)
| Món | Vị trí |
|---|---|
| Chậu cây voxel ở góc | `(27.38, 2.47)` |
| 2 bồn tiểu treo tường sau, vách kính mờ chắn | tâm `x 27.85`, `28.6`; kính ở `x 27.55`, `28.22` |
| 2 buồng, vách HPL xanh, cửa mở vào trong, bồn cầu treo tường, nút xả | `x 29 → 30`, `30 → 31`, `y 2.25 → 3.6`; người đứng chờ ở `y 3.88` |
| Lavabo đôi: tủ gỗ, mặt đá tối, 2 chậu trắng, vòi chrome, gương rộng viền LED vàng trên vách lửng | `x 27.14 → 27.7`, `y 3.1 → 4.7`, chậu ở `y 3.5`, `4.3` |
| Máy sấy tay trắng (trên vách), thùng rác đạp chân inox (dưới) | `y 4.85` |
| Biển cửa xanh: hình người nam + `NAM` | trên cửa `x 28 → 29` |

**WC NỮ** (`x 31..34.6, y 2..5`)
| Món | Vị trí |
|---|---|
| Góc trang điểm: bàn gỗ nhỏ mặt trắng, gương chữ nhật viền LED, ghế tròn hồng | bàn `x 31.07 → 31.55`, `y 2.3 → 3.0`; ghế `(31.8, 2.65)` |
| 3 buồng, vách HPL hồng, cửa mở vào trong, bồn cầu treo tường, thùng băng vệ sinh có nắp trong mỗi buồng | `x 32 → 32.87 → 33.73 → 34.6`, `y 2.25 → 3.6` |
| Lavabo đôi mặt đá, 2 chậu, gương LED | `x 31.07 → 31.63`, `y 3.3 → 4.85`, chậu ở `y 3.72`, `4.45` (lùi ra trước so với phòng nam để chỗ rửa tay không lọt vào cạnh vách buồng đầu) |
| Máy sấy tay, thùng rác | `y 3.15`, giữa bàn trang điểm và lavabo, trên/dưới vách |
| Chậu cây | `(34.2, 4.55)` |
| Biển cửa hồng: hình người nữ + `NỮ` | trên cửa `x 33 → 34` |

**SẢNH CHUNG** (`x 27..34.6, y 5..7`)
| Món | Vị trí |
|---|---|
| Sàn ván gỗ ấm `#D2A877` | cả sảnh |
| Thảm chạy xanh nhạt | `x 27.3 → 34.2`, `y 5.35 → 5.95` |
| Cột chỉ dẫn tối màu, sọc xanh và hồng | `(27.3, 6.65)` |
| Trạm sát khuẩn tay đứng, giữa hai cửa | `(30.5, 5.3)` |
| Ghế băng gỗ dài | `x 29.2 → 31.8`, `y 6.3 → 6.7` |
| Chậu cây lớn ở góc phải | `(34.2, 6.55)` |

**Nhãn nổi** (kiểu chữ pixel 3×5 của trang, nền trắng viền tối): `WC NAM` (xanh) trên phòng nam, `WC NỮ` (hồng) trên
phòng nữ, `SẢNH CHUNG` (tối) trên sảnh. Font 3×5 không có dấu, nên `Ữ` và `Ả` có thêm 2 hàng dấu vẽ tay.

## B5. Bảng màu

`#F4ECDA` tường kem · `#F7F9FC` gạch trắng · `#DCE2EA` sàn xám (lưới chống trơn) · `#D2A877` gỗ · `#3F4452` đá tối
(mặt lavabo, nắp vách) · kính trắng 30% · `#55A043` cây · `#173DC9` nhấn nam · `#D9467A` nhấn nữ · `#2B2D42` viền.
Bệ dưới khối dùng đúng đá bệ văn phòng (`#b9b2a3`), để khối đọc như phần nối dài của toà nhà; brief ghi "bệ gỗ, mép
nâu" nhưng cũng ghi "giống cách vẽ bệ văn phòng", nên ưu tiên khớp với bệ thật đang có.

## B6. Ngày, đêm, tuyết

- **Ngày:** màu như bảng trên.
- **Đêm:** mọi màu qua `SkyRender.night()` như khu hút thuốc. Khung LED của 3 gương (2 lavabo + gương trang điểm) và 2 hộp
  biển cửa **giữ màu sáng** và có quầng sáng mờ (cùng cách đèn khu hút thuốc phát sáng).
- **Tuyết:** chỉ nắp của các tường hở (đỉnh tường sau, nắp vách lửng, nắp tường đầu gối) pha dần sang trắng theo `snow`.
  Sàn trong khối không có tuyết. Cỏ quanh khối vẫn phủ tuyết như cũ.

## B7. Agent

- Mỗi buồng là một idle spot `act:'wc'` (5 spot: 2 nam, 3 nữ). Agent chỉ chọn buồng của phòng mình, chọn **cố định theo
  agent**: `id` lẻ → nam, `id` chẵn → nữ.
- Đường đi: pantry → sảnh → đúng cửa phòng → trước buồng. Một lượt (`RestroomLogic.visit(t)`):
  - `door` 0.8 s: đứng trước buồng, cửa buồng mở;
  - `inside` 6 s: **ẩn người, cửa buồng đóng**, chấm đỏ trên cửa;
  - `out` 0.6 s: đứng lại trước buồng, cửa mở;
  - `wash` 2.5 s: đi sang lavabo của phòng mình (buồng `i` → chậu `i % 2`), đứng rửa tay quay mặt vào gương;
  - `done`: nhận một idle spot khác, không quay lại nhà vệ sinh cho tới khi hết rảnh.
- Bong bóng giữ `🚻 đi vệ sinh`.
- **Kín đáo:** người vào buồng thì không vẽ, cửa buồng đóng lại (cửa cao hơn người). Không vẽ người đứng ở bồn tiểu.
- Chó không vào khối (ô sàn khối không thuộc bãi cỏ) và không chạy tới chào người trong khối.

## B8. Đường đi, lưới đi bộ

- `RestroomLogic.layout(zone, WALL)` trả về: `floor` (40 ô sàn khối), `walk` (ô đứng được), `shut` (cạnh bị tường chặn,
  hai chiều), `spots`, toạ độ từng món, chiều cao tường.
- `bfs` coi ô sàn khối là sàn trong nhà: đi ngang được giữa pantry và sảnh (trừ cạnh có vách lửng `y 2..4`), **không**
  đi được giữa sàn khối và cỏ. Tường trước chỉ hở ở hai ô cửa `(28,4)|(28,5)` và `(33,4)|(33,5)`.
- `PA` (chiều cao mặt đất của người) trả `FLOOR_Z` trên sàn khối.
- `LAWN_WALK` bỏ toàn bộ ô sàn khối; `DOG_ROAM` tránh ô chừa `east-back`.

## B9. Những gì dời hoặc đổi

- **Nhà vệ sinh 3×3 có mái** bỏ; khối mới chiếm `x 27..34, y 2..6`.
- **Nhánh đường đá ngắn** `(27,7) → (28,7) → (28,6)` bỏ: nó dẫn tới thềm nhà cũ, giờ đâm vào bệ khối, còn người vào sảnh
  từ pantry. Đường đá dọc `x = 27` từ cầu thang đông xuống hồ giữ nguyên.
- **Hoa trang trí** ở `(33,3)`, `(34,2)`, `(34,4)`, `(34,5)` không còn (nằm trong ô chừa mới). Cục đá `(30,0)` và hoa
  `(33,1)` sau tường vẫn còn.
- **Khu hút thuốc không dời** (`x 28..31, y 9..12`). Cách sảnh 2 hàng cỏ (`y 7..8`) và cách tường trước hai phòng
  (`y = 5`) 4 hàng. Lùi khu hút thuốc xuống thêm thì cây ở `(29,14)` che lối vào (đã thử ở bản 1), nên giữ chỗ cũ. Khói
  bốc thẳng lên trên màn hình, và cửa hai phòng mở ra sảnh, quay lưng về phía bãi cỏ.
- Cầu thang đông, hồ, thác, cây, đường đá chính, vùng chó: không đổi.

## B10. Điều không được xảy ra

- Không mái, không trần, không gradient, không bóng mềm kiểu 3D, không phối cảnh.
- Không bừa bộn: mỗi món đúng một chỗ trong bảng B4, không thêm đồ ngoài brief.
- Không thấy người trong buồng; không có gì thô tục (bồn cầu chỉ là khối sứ trắng treo tường).
- Không ai đi xuyên tường, vách lửng hay tường đầu gối; không ai bước từ sàn khối xuống cỏ; chó không vào khối.
- Không đổi pantry ngoài chỗ nối; ngoài vùng pantry/khối/bãi cỏ phía đông, ảnh phải giống từng pixel (kiểm bằng pixel diff).
- Không sửa `<script id="world-view">` và `<script id="world-logic">`. Không thêm dependency, trang vẫn một file.

---

# Bản 3 (đồng bộ phong cách, sát pantry, khu hút thuốc cạnh nhà vệ sinh)

Ngày: 2026-11-05 (tối) · Theo góp ý của anh Kiệt sau bản 2. Thay cho B2, B4, B5, B6 và B9 ở trên.

## C1. Góp ý và hướng xử lý

| Góp ý | Xử lý |
|---|---|
| Kính, màu, cây, ghế, đồ đạc "lệch tông" với văn phòng | Vẽ lại mọi món bằng ngôn ngữ hình sẵn có của đảo (C3) |
| Khối phải sát tường pantry, đang "bị đẩy lên" | Tường sau khối nằm đúng đường tường sau văn phòng (`y = 0`), thêm đất để đặt vừa (C2, C4) |
| Khu hút thuốc phải ngay cạnh nhà vệ sinh, thiếu chỗ thì thêm đất | Dời khu hút thuốc sát cạnh đông của khối, thêm một mũi đất (C4, C6) |
| Vách kính → **tường đặc** cho kín đáo (vách pantry, vách nam/nữ, vách buồng, vách chắn bồn tiểu) | C3 |
| **Không mái**, không mái hiên, không thứ gì giống trần | C3 |
| Bên trong vẫn **nhìn rõ** từ góc 3/4 như các phòng văn phòng | Chiều cao vách theo C3; người trong buồng vẫn khuất sau cửa buồng đóng |

## C2. Vị trí mới

| | Bản 2 | Bản 3 |
|---|---|---|
| Ô chừa `east-back` (khối nhà vệ sinh) | `x 27..34, y 2..6` | **`x 27..32, y 0..6`** (6×7) |
| Sàn khối | `x 27 → 34.6`, `y 2 → 7` | `x 27 → 33`, `y 0 → 7`, cao `FLOOR_Z` |
| Tường sau | mặt trong `y = 2.25` | **mặt trong `y = 0`, dày 0.35 ra sau tới `y = −0.35`**, như tường sau văn phòng, nối liền không khe |
| Phòng nam | `x 27..31, y 2..5` | `x 27 → 30, y 0 → 5` |
| Phòng nữ | `x 31..34.6, y 2..5` | `x 30 → 33, y 0 → 5` |
| Sảnh | `y 5..7` | `x 27 → 33, y 5 → 7`, mở sang pantry ở `(26,5)` |
| Ô chừa `east-front` (khu hút thuốc) | `x 28..31, y 9..12` | **`x 33..36, y 4..7`**, sát cạnh đông của khối |

- Góc pantry không còn bị che: tường sau khối nằm cùng mặt phẳng với tường bếp, không đứng trước nó trên màn hình.
- Rộng 6 ô (không phải 8) vì giới hạn ở C4. Phòng sâu 5 ô bù lại chiều rộng.

## C3. Đồng bộ phong cách

Nguyên tắc: không có ngôn ngữ hình mới. Mỗi món mượn đúng cách vẽ của một món đã có trên đảo.

| Món | Mượn từ |
|---|---|
| Tường sau | Y hệt tường sau văn phòng: màu `th.wr` theo theme ngày/đêm, nẹp chân `th.trim` cao 4, dải nẹp đỉnh `WALL → WALL+3`, mặt đỉnh `shade(th.trim, 18)`, mặt cắt cuối tường `shade(th.wr, −34)` |
| Vách pantry ↔ nam, nam ↔ nữ | **Tường đặc**, cùng màu và cách tô với tường văn phòng (`th.wl` cho mặt nhìn thấy, nẹp chân, mặt đỉnh), cao **32**. Như vậy cao hơn người (≈ 25) nên kín, mà vẫn thấp hơn tường đầy (56) để nhìn được vào bên trong từ góc 3/4 |
| Tường trước, tường đông của phòng nữ | Cùng kiểu, cao đầu gối **10**, chừa 2 lối cửa |
| Vách buồng, cửa buồng | Tấm đặc màu nhấn (nam `#173DC9`, nữ `#D9467A`), cao `3 → 28`, tô 3 mặt như hộp văn phòng. Màu nhấn chỉ có ở đây và trên biển |
| Vách chắn bồn tiểu | Tấm đặc màu tường (`th.wl`), không kính |
| Sàn hai phòng | Gạch sáng dễ lau của bếp pantry (`#ebe7dd`/`#dfdace` ban ngày, `#2e2d3a`/`#282734` ban đêm), ô bàn cờ |
| Sàn sảnh | Ván gỗ khu ngồi pantry (`#c99862`/`#c18f59`, đêm `#3a2d2b`/`#332725`), cùng đường ron và mạch so le |
| Thảm chạy ở sảnh | Bỏ: thảm màu thảm pantry làm chữ sơn khó đọc và rối mắt; sàn gỗ để trống như sàn pantry |
| Lavabo | Thân tủ gỗ `#a8763e` có cánh tủ và tay nắm vàng, mặt đá sáng `#efe9dc` như tủ bếp dưới; chậu inox lõm như bồn rửa bếp |
| Gương | Khung mảnh màu nẹp, mặt gương xanh nhạt như kính cửa sổ văn phòng; không viền LED |
| Chậu cây | `PantryItems.I.potplant` (chậu sứ trắng, lá `PLANT`), vẽ đúng như ở pantry |
| Ghế bàn trang điểm | `PantryItems.I.stool` (ghế bar của pantry) |
| Ghế băng sảnh | Kiểu ghế băng khu hút thuốc: chân kim loại tối, mặt ván gỗ `#c79a5e` có rãnh, không tựa |
| Biển phòng | Bảng nền tối gắn tường sau, chữ phát sáng như biển neon CAFE: `WC NAM` (xanh) phía trên buồng nam, `WC NỮ` (hồng) phía trên buồng nữ, kèm hình người nhỏ |
| Nhãn sảnh | Chữ sơn trên sàn như chữ `PANTRY`: `SẢNH CHUNG`, cỡ 2, cùng màu sơn với `PANTRY` (`#8a5a2a` ngày, `#a8763e` đêm), đậm 60% |
| Bệ | Đá bệ văn phòng `#b9b2a3` qua `night()`, cùng đường ron |
| Viền | Bỏ viền tối 1px. Chỉ tô phẳng 3 mặt như phần còn lại |

- **Không có mái.** Không mái hiên, không tấm che, không dải nẹp nào chạy ngang trên đầu. Thứ duy nhất ở trên cao là
  dải nẹp đỉnh của tường sau, giống hệt tường văn phòng.
- Bỏ: kính mờ, khung LED vàng, nhãn nổi trên trời, hộp biển trên cửa (hộp này che người trong phòng), thảm chạy.
  Cột chỉ dẫn còn lại là một biển nhỏ nền tối trên cột kim loại, hai hình người xanh và hồng.
- Đêm: tường theo theme văn phòng (`th`), gạch và gỗ pantry nội suy theo `df` như pantry. Biển neon giữ sáng và có
  quầng như biển CAFE. Tuyết: trong khối không có gì bị phủ (văn phòng cũng vậy); chỉ cỏ quanh khối phủ tuyết.

## C4. Đất thêm

Tường sau khối phải đứng trên đất. Ở bản 2, hàng `y = −1` chỉ tới `x = 28`, hàng `y = 0` tới `x = 31`. Bản 3 thêm 21 ô
(`SkyLogic` `ANNEX_LAND`, cộng vào đảo sau hình squircle):

| Hàng `y` | Ô thêm `x` |
|---|---|
| −1 | 29, 30, 31 |
| 0 | 32 |
| 3 | 35 |
| 4 | 35, 36 |
| 5, 6, 7, 8 | 35, 36, 37 |
| 9 | 35, 36 |
| 10 | 35 |

- **Ràng buộc khung cảnh:** mọi ô thêm thoả `(x + 1) − y ≤ 33`. Góc phải nhất trên màn hình của đảo vẫn ở chỗ cũ, nên
  `sceneFrame` (LW 848, LH 644, OX 304, OY 83) không đổi. Vì thế độ phân giải canvas không đổi và mọi pixel phía tây
  vẫn y nguyên. Nếu thêm `(32,−1)` hay `(33,0)`, khung sẽ rộng ra 1 ô và đổi `k` cho cả trang, nên không thêm.
- Hệ quả: góc sau bên phải của tường sau (`x 32 → 33`, `y −0.35 → 0`) chìa ra 0.35 ô khỏi mép đất. Chấp nhận được, vì
  đây là góc xa nhất và chính tường che nó.
- Đất mới là ô đảo thường: mặt cỏ, đáy đất và đá, mép vách, độ sâu đáy tính lại theo khoảng cách tới bờ như mọi ô.
  Mũi đất phía đông làm bờ thành bậc thang chéo, khớp với dáng góc đảo.
- Hoa và cây trên đất mới mọc theo `hash` như mọi ô: được một bông hoa ở `(37,5)`. Ô chừa cũ của khu hút thuốc trả lại
  cỏ nên mọc thêm cây ở `(28,11)`, `(31,11)` và hoa ở `(30,9)`. Cục đá `(30,0)` nay nằm dưới khối. Các hoa ở `(33,3)`,
  `(34,2)`, `(34,4)`, `(34,5)` (ngoài khối) có lại. Hoa `(30,7)` mất vì đường đá mới.
- Thác, hồ và đường đá xuống hồ không đổi (hồ chọn theo bờ đông ở các hàng dưới cùng, không bị ảnh hưởng).
- **Đáy đảo:** các ô đã có giữ nguyên độ sâu đáy như trước khi thêm đất (khoảng cách tới bờ tính trên đảo cũ); chỉ ô
  thêm tính theo đảo mới. Nếu tính lại cho cả đảo, đáy cả góc đông nam sẽ sâu thêm và đổi hình dưới vách.

## C5. Bố cục khối (6 × 7)

**WC NAM** `x 27 → 30`
- Góc sau bên trái: chậu cây `(27.4, 0.4)`, máy sấy tay trên tường sau ở `x 27.85`.
- 2 buồng trên tường sau: `x 28.08 → 29 → 29.93`, `y 0 → 1.35`; người chờ ở `y 1.63`.
- 2 bồn tiểu trên vách pantry ở `y 1.75`, `2.5`, vách chắn đặc ở `y 2.12`, `2.88`.
- Lavabo đôi dựa vách pantry: `x 27.14 → 27.7`, `y 3.15 → 4.75`, chậu ở `y 3.55`, `4.35`; gương phía trên.
- Thùng rác góc trước bên phải `(29.75, 4.7)`. Cửa `x 28 → 29`.

**WC NỮ** `x 30 → 33`
- 3 buồng trên tường sau: `x 30.07 → 31.01 → 31.94 → 32.88`, mỗi buồng một thùng nhỏ có nắp.
- Góc trang điểm dựa vách nam/nữ: bàn `y 1.95 → 2.6`, gương phía trên, ghế bar `(30.82, 2.28)`.
- Lavabo đôi `x 30.07 → 30.63`, `y 2.95 → 4.55`, chậu ở `y 3.35`, `4.15`; máy sấy tay và thùng rác ở `y 4.75`.
- Chậu cây góc trước bên phải `(32.55, 4.55)`. Cửa `x 31 → 32`.

**SẢNH** `y 5 → 7`
- Ghế băng dựa tường trước, giữa hai cửa: `x 29.45 → 30.85`, `y 5.1 → 5.45`; trạm sát khuẩn `(29.2, 5.25)`.
- Lối đi là hàng `y = 6`; chữ `SẢNH CHUNG` sơn trên sàn gỗ dọc lối đi, từ `(27.75, 6.25)`.
- Chậu cây lớn góc phải `(32.55, 5.55)`, cột chỉ dẫn nhỏ màu tối ở `(27.25, 6.75)`.
- Từ pantry vào qua `(27,5)`.

**Chiều cao** (px, `WALL = 56` ≈ 3 ô): tường sau 56 + nẹp 3; vách 32; vách buồng `3 → 28`; tường đầu gối 10; lavabo 14
(như mặt bếp); gương `18 → 32`; biển neon `40 → 50`.

## C6. Khu hút thuốc

- Ô chừa `east-front` = `x 33..36, y 4..7`. Bố cục `SmokeLogic.layout` giữ nguyên:
  - bồn cây chắn ở cột `x = 33`, sát cạnh đông của khối, đúng phía cần chắn;
  - ghế băng ở hàng sau `y = 4`, thùng tàn thuốc;
  - cửa vào `(33,7)`, `(34,7)`; các cạnh khác của nền vẫn kín (`shut`).
- Đường đá mới chạy từ chân cầu thang đông `(27,7)` dọc mặt trước khối tới `(32,7)`, ngay trước cửa vào. Đường xuống hồ
  không đổi.
- **Khói:** bồn cây cao ≈ 1.2 m chắn giữa ghế và khối. Làn khói trong `drawPerson` vốn đã trôi sang phải trên màn hình
  (về phía đông, ra xa khối) và tan sau ≈ 14 px, nên không bay qua nhà vệ sinh.
- Cây `(33,8)` (chỗ chó ngủ đêm) vẫn đứng ngay dưới cửa vào. Lối vào đi từ `(32,7)` nên cây không chặn.

## C7. Agent, đường đi, chó

- Cơ chế giữ như bản 2: mỗi agent dùng buồng trong phòng của mình, khuất khi ở trong, rửa tay xong thì đi tiếp. Spot
  và chỗ rửa tay lấy từ bố cục C5.
- Lưới đi: sàn khối là sàn trong nhà. Vách pantry chặn các hàng `y 0..4`, sảnh mở ở `y 5..6`. Không bước được từ sàn
  khối xuống cỏ.
- Chó tránh cả hai ô chừa; ô sàn khối không thuộc bãi cỏ.

## C8. Anti-goals bổ sung

- Không thêm kiểu vẽ mới (kính mờ, viền tối, LED, nhãn nổi). Màu nhấn chỉ ở vách buồng và biển.
- Không mái, không thứ gì giống trần.
- Không đổi khung cảnh (`sceneFrame`). Không đổi pixel nào ngoài vùng pantry phía đông, khối, khu hút thuốc và đất mới
  (kiểm bằng pixel diff, CPU raster, ngày/đêm/tuyết).

## C9. Sửa sau review bản 3 (anh Kiệt)

Các điểm dưới đây thay cho những dòng tương ứng ở C3 và C5.

| Góp ý | Xử lý |
|---|---|
| Màu cửa buồng quá rực | Giảm bão hoà, tăng sáng (cùng hue): nam `#173DC9` → **`#7989c3`** (xanh bụi), nữ `#D9467A` → **`#c37993`** (hồng bụi). Biển neon sáng hơn cửa một chút: **`#6c84da`**, **`#da6c93`**. Cột chỉ dẫn ở sảnh dùng màu biển |
| Tường trước (có cửa ra vào) phải cao đủ tường | Tường trước `y 4.93 → 5.07`, cao **`WALL` (56)** + nẹp 3, đúng công thức tường sau: mặt `th.wr`, nẹp chân `th.trim` cao 4, dải nẹp đỉnh, mặt đỉnh `shade(th.trim, 18)`. Hai ô cửa `x 28 → 29` và `x 31 → 32`, cao **40**, phần tường phía trên cửa là một đoạn tường liền |
| Cửa thật, đẩy được hai chiều | Mỗi ô cửa một cánh cửa lò xo, bản lề ở mép tây. Màu và kiểu theo cửa văn phòng (`doorDraw`): khung `#5c4330`, cánh `#8a5a3a`, ô kính nhỏ `#9fd3ff`, tấm đá chân `#7a4f2f`; thay tay nắm bằng **tấm đẩy inox** `#c9d3e3`. Khung cửa nâu viền quanh ô cửa trên mặt tường |
| Thêm tường phải (tường đông phòng nữ) đủ cao | Tường đông `x 32.88 → 33`, cao `WALL` + nẹp, chạy từ `y −0.35` (che mặt cắt cuối tường sau) tới `y 5.07` (gặp tường trước). Mặt nhìn thấy `th.wl`, như mặt hướng `+x` của tường văn phòng. Khu hút thuốc tựa vào mặt ngoài |

**Cánh cửa đẩy (`RestroomLogic.doorSwing(L, người)`)** là hàm thuần, chạy mỗi khung hình:
- Cửa **đóng** khi không ai ở ô cửa.
- Ai đứng trong khoảng mở (`x0 < x < x1`) và cách mặt tường dưới `DOORWAY = 0.75` ô thì cửa mở khoảng 70°, **ra xa người đó**:
  - người trong phòng (`y < 5`) đẩy cửa ra phía sảnh (`+1`);
  - người ở sảnh đẩy cửa vào trong (`−1`).
- Người đầu tiên trong danh sách quyết định, nên cùng một nhóm người luôn cho cùng kết quả, không nhấp nháy.
- Chi phí: mỗi khung hình duyệt danh sách người một lần.

**Thứ tự vẽ:**
- Cửa mở ra sảnh vẽ sau lanh tô.
- Cửa mở vào trong vẽ trước lanh tô và khung, nên nó khuất sau phần tường phía trên.

**Biển neon phòng nữ** dừng cách tường đông 1.2 ô. Tường đông cao đủ nên trên màn hình đứng trước đoạn cuối tường sau.

**Cách vẽ tường quay về phía người xem.** Văn phòng không có tường như vậy: nó để trống mặt trước và mặt đông, chỉ có
tường sau và tường trái. Nên không có kiểu riêng nào để chép. Anh Kiệt xác nhận không cần nhìn thấy bên trong.
- Tường trước và tường đông vẽ đặc, y như tường sau văn phòng. Không có đường cắt đỉnh, không trong suốt.
- Bên trong khuất phần lớn. Chỉ phần trên của buồng phòng nam và các biển trên tường sau còn lộ qua mép tường.
- Người đi qua cửa rồi khuất vào trong. Đó là chủ ý: kín đáo và gọn hơn.

**Chiều cao mới** (thay dòng chiều cao ở C5):
- tường sau, tường trước, tường đông: 56 + nẹp 3;
- vách giữa các phòng: 32;
- cửa ra vào: 40;
- vách buồng: `3 → 28`.

Bỏ tường đầu gối.
