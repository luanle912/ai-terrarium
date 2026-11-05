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
| Sàn khối (bệ) | `x 27 → 34.6`, `y 2 → 7`, cao `FLOOR_Z = 8` như sàn văn phòng; tường sau dày 0.3 ô lùi ra sau tới `y 1.7` |
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
- **Buồng vệ sinh**: rộng 1 ô (nam) và 0.87 ô (nữ, 3 buồng trong 2.6 ô), sâu 1.4 ô (`y 2 → 3.4`); vách HPL cao `3 → 32`
  (hở chân 3 px), cao hơn người (đầu người ≈ 23 px). Gọn hơn kích thước thật một chút, như cách tileset thu gọn đồ.
- **Bồn tiểu**: mỗi cái rộng 0.36 ô, cách nhau 0.75 ô (≈ 50 cm), treo tường ở `z 7..18`.
- **Lavabo đôi**: dài 1.6 ô (≈ 1 bàn làm việc), sâu 0.56 ô, mặt đá cao 13..15 (≈ mặt bàn bếp 14).
- Gương cao `z 20..36`, khung LED vàng; máy sấy tay `z 17..24`; cửa sổ kính mờ trên cao `z 40..50`.
- Khung cửa ra vào: hai trụ mảnh tới `z 34`, hộp biển phát sáng `z 34..43`, rộng hơn ô cửa 0.15 ô mỗi bên.

## B4. Bố cục từng ô

Ký hiệu toạ độ thế giới (ô `x, y`). Tường đứng trên cạnh ô.

**Tường và vách**
- Tường sau: mặt phẳng `y = 2`, `x 27 → 34.6`, cao 56. Phần dưới (tới `z 36`) ốp gạch trắng `#F7F9FC` có ron,
  phần trên vữa kem `#F4ECDA`; hai dải cửa sổ kính mờ trên cao, một dải mỗi phòng.
- Vách lửng pantry ↔ nam: `x 27 → 27.14`, `y 2 → 5`. Vách lửng nam ↔ nữ: `x 30.93 → 31.07`, `y 2 → 5`.
- Tường trước hai phòng: `y 4.93 → 5.07`, cao đầu gối, chừa **cửa nam** `x 28 → 29` và **cửa nữ** `x 33 → 34`.
- Tường đông phòng nữ: `x 34.48 → 34.6`, `y 2 → 5`, cao đầu gối. Sảnh không có tường đông và tường trước (như văn phòng).

**WC NAM** (`x 27..31, y 2..5`)
| Món | Vị trí |
|---|---|
| Chậu cây voxel ở góc | `(27.4, 2.35)` |
| 2 bồn tiểu treo tường sau, vách kính mờ chắn | tâm `x 27.85`, `28.6`; kính ở `x 27.55`, `28.22` |
| 2 buồng, vách HPL xanh, cửa mở vào trong, bồn cầu treo tường, nút xả | `x 29 → 30`, `30 → 31`, `y 2 → 3.4` |
| Lavabo đôi: tủ gỗ, mặt đá tối, 2 chậu trắng, vòi chrome, gương rộng viền LED vàng trên vách lửng | `x 27.14 → 27.7`, `y 3.1 → 4.7`, chậu ở `y 3.5`, `4.3` |
| Máy sấy tay trắng (trên vách), thùng rác đạp chân inox (dưới) | `y 4.85` |
| Biển cửa xanh: hình người nam + `NAM` | trên cửa `x 28 → 29` |

**WC NỮ** (`x 31..34.6, y 2..5`)
| Món | Vị trí |
|---|---|
| Góc trang điểm: bàn gỗ nhỏ mặt trắng, gương chữ nhật viền LED, ghế tròn hồng | bàn `x 31.07 → 31.55`, `y 2.1 → 2.9`; ghế `(31.8, 2.5)` |
| 3 buồng, vách HPL hồng, cửa mở vào trong, bồn cầu treo tường, thùng băng vệ sinh có nắp trong mỗi buồng | `x 32 → 32.87 → 33.73 → 34.6`, `y 2 → 3.4` |
| Lavabo đôi mặt đá, 2 chậu, gương LED | `x 31.07 → 31.63`, `y 3.1 → 4.7` |
| Máy sấy tay, thùng rác | `y 4.85` trên/dưới vách |
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
