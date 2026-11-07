# Thiết bị chỉ "bật" khi có người dùng

Ngày: 2026-11-08 · Người đặt hàng: anh Kiệt · Người viết: Claude

## 1. Ý định

Lời anh Kiệt: "khi không có user active thì nên disactive (nhân vật vào máy tính thì bàn phím mới sáng, vào thùng
chơi game thì màn hình mới sáng, tương tự cho lò vi sóng, bàn game, bồn nước, ...)".

Hiện nay nhiều đồ trong văn phòng tự chạy mãi dù không ai đứng đó: bàn phím ở mọi bàn nhấp nháy phím trắng, máy arcade
chạy game, lò vi sóng cứ quay rồi tắt theo chu kỳ, vòi bồn rửa nhỏ giọt, máy espresso rót cà phê và bốc hơi, tủ mát
đồ uống phát sáng nhấp nháy, bàn bi lắc tự lăn bóng, nến trên bàn cafe tự cháy. Nhìn vào đảo không biết chỗ nào có
người dùng thật. Sau thay đổi này: **một đồ vật chỉ sáng / chạy khi có nhân vật đã tới nơi và đang dùng nó**; lúc
không ai dùng nó ở trạng thái "tắt" (vẫn vẽ đầy đủ, chỉ tối và đứng yên).

## 2. Danh sách đồ vật

| Đồ vật (`key`) | Ai dùng | Lúc tắt | Lúc đang dùng |
|---|---|---|---|
| Bàn làm việc `desk0..15` | chủ bàn đang **ngồi** ở bàn (`seated`, không ngủ, không về) | màn hình đen + đèn standby đỏ (như cũ), **bàn phím tối, không nháy** | màn hình theo trạng thái (như cũ), **bàn phím có đèn nền** (vầng sáng màu màn hình) và phím nháy trắng |
| Tủ lạnh `fridge` | spot `fridge` | màn hiển thị nhiệt độ và màn vòi nước tối | màn sáng xanh, khe cửa hắt ánh sáng lạnh |
| Máy espresso `espresso` | spot `coffee` thứ nhất | không rót, không hơi, đèn chờ xanh tối | rót cà phê, hơi bốc, đèn vàng nháy |
| Máy xay `grinder` | spot `coffee` thứ hai | đèn đỏ tắt, hạt đứng yên | đèn đỏ sáng, hạt rung |
| Bồn rửa `sink` | spot `water` | vòi khô, không nhỏ giọt | dòng nước chảy từ vòi xuống bồn, có tia bắn |
| Lò vi sóng `microwave` | spot `microwave` | cửa kính tối, đĩa không quay (đồng hồ chờ vẫn hiện giờ, như lò thật) | trong lò sáng vàng, đĩa quay |
| Tủ mát đồ uống `drinkfridge` | spot `snack` | đèn trong tủ tắt: chai lọ tối, không viền sáng | đèn trong tủ sáng, viền sáng nhấp nháy nhẹ (như cũ) |
| Đảo quầy bar `island` | bất kỳ spot `table` (4 ghế bar) | máy tính bảng ở đầu quầy tối | màn máy tính bảng sáng |
| Bàn cafe `cafe0..2` | spot `meal` cùng hàng | nến tắt (chỉ còn thân nến) | ngọn nến lung linh, ban đêm có quầng sáng |
| Máy arcade `arcade0..1` | spot trước máy (act mới `arcade`) | màn hình đen có vệt phản chiếu, biển neon và dải neon hông tối, nút xu không nháy, ban đêm không quầng | như hiện nay: game chạy, neon sáng, ban đêm có quầng |
| Bàn bi lắc `foosball` | hai spot hai đầu bàn (act mới `foosball`) | bóng nằm giữa bàn, cần gạt đứng yên | bóng lăn qua lại, cần gạt trượt |
| Lavabo nhà vệ sinh `basin-m0..1`, `basin-f0..1` | người đang rửa tay ở đúng lavabo (pha `wash`) | khô | dòng nước chảy |

Không đổi (là đèn chiếu sáng chung, không phải thiết bị "được dùng"): biển neon CAFE, đèn thả, đèn cây, đèn hắt dưới tủ
treo, đèn bàn bật theo màn hình (đã đúng sẵn), bảng usage, cửa sổ, đèn khu hút thuốc, đèn vườn.

### 2.1. Act mới ở góc game

Hai spot trước máy arcade đang mang act `sky` ("ngắm mây") và hai spot ở bàn bi lắc mang act `stretch` ("vươn vai"),
nên không ai thật sự "chơi". Đổi:

- `sky` → `arcade` ("chơi game"): hai tay đưa ra trước lên bảng điều khiển, tay phải lắc cần.
- `stretch` ở bàn bi lắc → `foosball` ("chơi bi lắc"): hai tay thấp, nắm cần, đẩy kéo luân phiên. Spot `stretch`
  ở `[22,6]` giữ nguyên.
- i18n: bỏ khoá `office.act.sky` (không còn dùng), thêm `office.act.arcade`, `office.act.foosball` cho cả 7 ngôn ngữ.

## 3. "Đang dùng" được quyết định thế nào

Logic thuần trong module mới `web/prop-use.js` (`PropUse`), có test:

- **Bàn:** chủ bàn (không phải sub-agent), `!leaving`, `seated`, `!sleeping`. Người đang đi về chỗ chưa tính.
- **Idle spot:** agent có `idleSpot = i`, `status === 'idle'`, **đã tới nơi** (`!moving`, `goalKey === 'idle' + i`,
  `actNow === spot.act`). Người còn đang đi tới chưa làm đồ sáng. Spot mang trường `prop` (tên đồ vật nó dùng);
  spot không có `prop` (ghế sofa, khu hút thuốc, hồ...) bỏ qua.
- **Lavabo:** agent ở spot `wc`, đã tới chỗ rửa (`goalKey === 'wash' + i`, `!moving`); spot `wash` mang `prop`
  `basin-<phòng><0|1>`.

Mỗi đồ vật có một mức sáng `lit ∈ [0, 1]`, đổi dần về 0 hoặc 1: bật trong **0,3 s**, tắt trong **0,6 s** (tắt chậm hơn
cho êm, không chớp). Mức sáng được bước theo `dt` mô phỏng cùng lúc với chó (`stepProps(dt)` cạnh `stepDogs`), nên lúc
tạm dừng thì đứng yên. Mức sáng nằm trong một `Float32Array` cố định theo chỉ số đồ vật (`PropUse.ID`), cấp một lần
cho mỗi scene: không cấp phát gì mỗi khung hình.

Lúc vẽ, mỗi đồ vật nhận `use = lit` qua object tuỳ chọn tái sử dụng (`o.use`): phần "sáng" được vẽ với độ mờ nhân
`use`, phần chuyển động nhân biên độ với `use` (bóng bi lắc trượt dần về giữa, cần gạt dừng dần), nên chuyển tiếp là
một cú mờ ngắn, không có gì nhấp nháy.

Màn hình bàn làm việc: khi chủ vừa ngồi xuống, màn hình theo trạng thái được phủ một lớp tối với độ mờ `1 - lit`
(sáng dần lên); khi vừa đứng dậy, màn đã về `off`, phủ thêm vầng sáng xanh mờ với độ mờ `lit` (tắt dần).

## 4. Ban đêm

Quầng sáng ban đêm (arcade, nến bàn cafe) chỉ có khi đồ vật đang dùng, nhân `use`. Đồ vật tắt về đêm tối như phần
còn lại của pantry. Đèn chiếu sáng chung (mục 2) vẫn bật theo giờ như cũ, nên pantry ban đêm không tối om.

## 5. World mode

Đảo trong world view (`web/island-scene.js`) mượn method của `ClaudeOffice` qua `SCENE_METHODS`. Method mới
`stepProps` được thêm vào danh sách và gọi trong `IslandScene.frame(dt)` cạnh `stepDogs`; mức sáng là của riêng từng
đảo (`this.propLit` tạo lười trong `stepProps`). `tests/island-scene-methods.test.mjs` canh việc này. Đảo hub vì vậy
giống hệt trang local.

## 6. Ràng buộc

- Không cấp phát trong đường vẽ mỗi khung; object tuỳ chọn của đồ pantry dùng lại một object.
- Đồ đã bake sẵn (đảo, cây, đồ ngoài cỏ) giữ nguyên; chỉ lớp sáng / chuyển động đổi theo khung.
- Không đụng `web/island-land.js`, `web/island-art.js`, `web/island-life.js`, `web/sky-island.js`
  (phiên khác đang làm).
- i18n, Prettier 3.3.3, module ≤ 700 dòng, dòng ≤ 120 ký tự.
