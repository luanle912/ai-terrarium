# Sự kiện Giáng sinh: tuyết có độ dày, làm lại sự kiện, trang phục

Ngày: 2026-11-10 · Người đặt hàng: anh Kiệt · Người viết: Claude

Lời anh Kiệt:

- "tháng 12 anh muốn update phần UI của toàn bộ đảo theo sự kiện: về tuyết, decoration, accessories, reindeer,
  christmas tree, noel, santas clause, snowman".
- "mấy cái có sẵn chưa oke: tuyết phủ nhưng chưa có độ dày, sự kiện cần deep review và chỉnh lại về ui, new year để
  sau. về trang phục khi christmas cũng cần update luôn".
- "chú ý về mặt perf/hiệu năng của browser để làm cho chuẩn + đúng, tránh nhồi vì việc liên quan tới đồ hoạ".

Kế hoạch triển khai: `docs/plans/2026-11-10-christmas-event-plan.md`.

## 1. Mục tiêu, ngoài phạm vi, điều không được xảy ra

**Mục tiêu**

1. Mùa đông nhìn ra là tuyết thật: có độ dày, có bóng, đọng trên mọi thứ, cả ngày lẫn đêm.
2. Tháng 12 đảo có không khí Noel rõ ràng, đẹp nhất vào ban đêm.
3. Người và chó mặc đồ Noel trong thời gian sự kiện.
4. Hiệu năng trình duyệt và hình nền giữ trong ngân sách ở mục 3.

**Ngoài phạm vi**

- Năm mới (27/12–2/1): giữ nguyên như hiện có, làm sau.
- Âm thanh, nhạc.
- Sự kiện khác (Tết, Halloween…): không đụng, nhưng khung sự kiện ở mục 5 phải dùng lại được cho chúng.
- Đổi công nghệ vẽ (WebGL, thư viện): không. Vẫn canvas 2D, không bước build, không phụ thuộc.

**Điều không được xảy ra**

- Hình nền hoặc trang thường chậm đi thấy được, hoặc quạt máy quay vì sự kiện.
- Thêm một lớp canvas toàn màn hình mới.
- Trang ngoài tháng 12 khác đi so với hôm nay (trừ lớp tuyết mới của mùa đông).
- Không còn nhận ra agent nào thuộc phòng ban nào, hoặc không phân biệt được sub-agent.
- Trang trí che mất chỗ người đứng, bong bóng thoại hay bảng usage.

## 2. Review hiện trạng

Chụp trang thật với ngày giả lập 20/12/2026, 12:00 và 21:00 (ảnh trong `.superpowers/xmas/`, không commit).

| Phần | Vấn đề | Nguyên nhân trong code |
|---|---|---|
| Tuyết trên cỏ | Màu bạc hà nhạt, phẳng, không đọc ra là tuyết | Tuyết chỉ là pha màu: `C(c, s)` trong `web/sky-island.js` trộn màu cỏ về `SNOW` theo `env.snow`. Không có hình khối nào |
| Tuyết trên vật thể | Tường, mái chòi, ghế, cột đèn, chuồng chó, giàn hút thuốc đều sạch tuyết | Như trên; các vật vẽ mỗi khung trong `office-draw*.js` chỉ nhận `snow` để pha màu vài chỗ |
| Mép đảo | Như mùa hè, chỉ đổi màu | Không có lớp tuyết tràn mép |
| Cây thông Noel | 3 cây cỡ cây thường, bị tường che; đêm không sáng | `SeasonIsland.holidayTrees` chọn 3 cây gần văn phòng nhất, thường nằm sau tường; `drawEventTree` đêm đi qua canvas tạm và nhận cùng lớp tối như bãi cỏ |
| Người tuyết | ~18 px, giống nhau, đêm biến mất | `drawSnowman` một dáng, ba biến thể nhỏ |
| Ban đêm | Xám tối, chỉ 3 cột đèn và đèn chòi | Không có nguồn sáng sự kiện |
| Văn phòng, người, chó | Không đổi gì | Chưa có |
| Hồ băng, núi | Ổn | Giữ |

## 3. Hiệu năng: mốc đo, nguyên tắc, ngân sách

Đây là ràng buộc của mọi đợt, không phải việc làm sau cùng.

### 3.1 Mốc đo hôm nay

Chrome headless, 1512×982 @2x, trang đang chạy thật, 9 giây, bỏ 60 khung đầu:

| Cảnh | JS mỗi khung p50 / p95 | Lệnh canvas mỗi khung |
|---|---|---|
| 20/12 ban ngày | 3,7 / 4,6 ms | ~18.900 |
| 20/12 ban đêm | 3,9 / 7,8 ms | ~18.700 |
| 20/7 ban ngày | 3,7 / 4,4 ms | ~18.500 |
| 20/12 đêm, `?wallpaper=1` (15 khung/s) | 4,9 / 5,6 ms | ~18.400 |

Đã biết từ `docs/specs/2026-11-10-wallpaper-perf-design.md`:

- Hình nền (hai màn, cắm sạc): ~65 % một lõi, trong đó GPU của WebKit ~40 %.
- Chi phí đi theo **số khung × số điểm ảnh × số lệnh vẽ**. JS nhẹ; nặng là raster và ghép lớp.
- Bỏ hết đồ đạc và người chỉ giảm ~16 điểm GPU, tức ~18.000 lệnh vẽ đáng khoảng đó. Suy ra 1.000 lệnh vẽ thêm mỗi
  khung tốn cỡ 1 điểm GPU.
- Ảnh đảo nướng một lần cho mỗi (độ phân giải, mức sáng 0–10, mức tuyết 0–10, mùa): 15–22 ms mỗi lần.

### 3.2 Nguyên tắc: vật nào vẽ ở đâu

| Loại | Ví dụ | Vẽ ở đâu | Chi phí mỗi khung |
|---|---|---|---|
| Tĩnh, ngoài trời | Tuyết trên cỏ, ụ tuyết, mép đảo, nhũ băng, kẹo gậy, quà, người tuyết, cây thông lớn (phần thân) | Nướng vào ảnh đảo / prop của đảo (`renderIsland`, `renderProps`) | 0 (đã nằm trong `drawImage` có sẵn) |
| Tĩnh, trên vật vẽ mỗi khung | Tuyết trên đỉnh tường, mái chuồng chó, giàn; vòng nguyệt quế, đồ trên bàn | Vài `fillRect` thêm trong hàm vẽ vật đó | Tính vào ngân sách lệnh vẽ |
| Sáng / nháy | Bóng đèn dây, sao trên cây, mũi tuần lộc | Một `fillRect` mỗi bóng; quầng sáng là sprite dựng sẵn, chỉ đêm mới vẽ | Tính vào ngân sách |
| Nhân vật | Tuần lộc, yêu tinh, chim cánh cụt | Sprite dựng một lần cho mỗi (khung hình, mức sáng), như chó (`dogSprite`) | 1 `drawImage` mỗi con |
| Trang phục người | Áo, mũ, khăn | Đổi màu và thêm vài `fillRect` trong `drawPerson` | Tính vào ngân sách |
| Phụ kiện chó | Sừng, khăn, áo | Vẽ vào sprite của chó lúc dựng (thêm khoá cache) | 0 |
| Trên trời | Xe trượt ông già Noel | Một sprite trên canvas trời sau (vốn vẽ 7,5 lần/s ở hình nền) | 1 `drawImage` |

### 3.3 Cấm dùng trong đường vẽ mỗi khung

- `shadowBlur`, `filter`, `getImageData` / `putImageData`.
- Tạo gradient (`createRadialGradient`, `createLinearGradient`) mỗi khung. Quầng sáng dùng sprite dựng sẵn, giống
  `halo` / `pool` của cột đèn trong `web/island-life.js`.
- Tạo mảng, object, chuỗi màu mới mỗi khung. Bảng màu và toạ độ tính một lần; hạt dùng bộ đệm cố định như
  `SeasonIsland.fallBuffer`.
- Canvas mới trên sân khấu. Canvas phụ chỉ để làm cache.
- `globalCompositeOperation` khác `source-over`, trừ chỗ đang có (`source-atop` của bão).

### 3.4 Ngân sách (so với mốc cùng ngày giờ, cùng số agent)

| Chỉ số | Ngân sách | Đo bằng |
|---|---|---|
| JS mỗi khung, p50 | Tăng không quá 0,4 ms (≈ 10 %) | `tools/perf-frame.mjs` (đợt 1 tạo) |
| JS mỗi khung, p95 | Tăng không quá 1 ms | như trên |
| Lệnh canvas mỗi khung, ban ngày | Tăng không quá 900 | như trên |
| Lệnh canvas mỗi khung, ban đêm (thêm quầng sáng) | Tăng không quá 1.400 | như trên |
| Một lần nướng ảnh đảo (đảo + prop) | Không quá 45 ms | như trên |
| Số lần nướng | Không thêm khoá cache nào làm nướng lại thường xuyên hơn hôm nay, trừ một khoá "sự kiện" đổi nhiều nhất 1 lần/ngày | đọc code + test |
| Bộ nhớ canvas cache thêm | Không quá 4 MB ở 2× | cộng kích thước canvas |
| GPU WebKit của hình nền (hai màn, đêm 20/12) | Tăng không quá 3 điểm so với ~40 % | `top` trên app thật, như spec perf |
| Cấp phát mỗi khung | Không tăng thấy được: GC trong hồ sơ CPU 8 giây không quá mốc + 0,5 điểm | `perf.mjs` kiểu cũ |

Phân bổ lệnh vẽ (ban đêm, mức đầy đủ), tổng 1.400:

| Hạng mục | Lệnh |
|---|---|
| Dây đèn: tối đa 120 bóng, mỗi bóng 1 `fillRect` + 1 quầng | 240 |
| Cây thông lớn: 24 bóng + sao + quầng | 60 |
| Tuyết trên vật vẽ mỗi khung (tường, chuồng, giàn, WC) | 150 |
| Trang trí văn phòng: 16 bàn × 4, vòng nguyệt quế, tất | 110 |
| Trang phục: 20 người × 8 | 160 |
| Nhân vật sự kiện: 3 tuần lộc, 2 yêu tinh, 4 chim cánh cụt, quầng mũi đỏ | 20 |
| Dấu chân: tối đa 48 | 48 |
| Hoạt động và hoạt cảnh mới (ném tuyết, quà…) | 150 |
| Dự phòng | 462 |

Vượt ngân sách ở đợt nào thì dừng ở đợt đó: cắt bớt hạng mục, không nới ngân sách. Việc cắt theo thứ tự: dấu chân,
quầng sáng dây đèn (giữ bóng), đồ trên bàn.

### 3.5 Giảm chuyển động, pin, tab ẩn

- `prefers-reduced-motion`: đèn không nháy, không nhân vật sự kiện di chuyển, không dấu chân; đồ tĩnh và trang phục
  vẫn có.
- Tab ẩn: như hiện nay, không vẽ.
- Hình nền khi chạy pin: như hiện nay (ảnh tĩnh).

## 4. Tuyết có độ dày (cả mùa đông, không riêng Noel)

### 4.1 Mức dày

`snowShown` (0–1) hiện có giữ nguyên nguồn: tuyết rơi làm tăng, mùa đông giữ tối thiểu 0,65. Thêm hàm thuần
`SnowLogic.depth(snow)` trả mức 0–3:

| Mức | `snowShown` | Nhìn thấy |
|---|---|---|
| 0 | < 0,15 | Không có tuyết |
| 1 mỏng | 0,15–0,45 | Lớp trắng mỏng, lộ nhiều ngọn cỏ, không có ụ |
| 2 vừa | 0,45–0,85 | Phủ kín, ụ thấp, tuyết trên vật thể 2 px |
| 3 dày | ≥ 0,85 | Ụ cao, tuyết trên vật thể 3–4 px, mép đảo nhô, nhũ băng dài |

Mùa đông tối thiểu 0,65 nên luôn ở mức 2 trở lên. Khoá cache vẫn là `snB` (0–10) như hôm nay; mức dày đọc từ chính
`snB` (ngưỡng nằm đúng ranh giới của nó: 0,15 / 0,45 / 0,85), không thêm khoá, nên phần vẽ mỗi khung luôn khớp ảnh đã
nướng.

### 4.2 Màu

Bỏ màu bạc hà. Bảng màu tuyết, cố định, đi qua cùng hàm ánh sáng như mọi màu khác:

| Vai | Ngày | Ghi chú |
|---|---|---|
| Mặt sáng | `#f6f9fc` | |
| Mặt thường | `#e6eef6` | |
| Bóng | `#c3d3e6` | lam, không xám |
| Viền dưới gờ | `#9fb4cf` | |
| Lấp lánh | `#ffffff` | vài điểm, chỉ ban ngày |

Ban đêm tuyết sáng hơn cỏ đêm: hệ số tối của tuyết bằng 0,7 lần hệ số tối của cỏ, ngả lam. Đây là thứ làm đảo đêm
đông không còn xám.

### 4.3 Hình khối (đều nướng vào ảnh đảo, trừ ghi chú)

- **Bãi cỏ:** thay ô caro cỏ bằng gợn tuyết thấp (dải sáng/bóng dài 3–6 px theo hướng chiếu), mật độ theo `hash` của
  ô nên máy nào cũng giống nhau. Mức 1 lộ ngọn cỏ khô.
- **Lối đá:** đá vẫn lộ (đã "xúc"), hai bên có bờ tuyết 1–2 px.
- **Ụ tuyết:** ở chân tường văn phòng phía ngoài, quanh gốc cây, sau đá và ghế đá. Cao 3–6 px theo mức. Vị trí là dữ
  liệu của đảo (`SnowLogic.drifts(island, W, H)`), thuần và có test: không nằm trên lối đi, nước, chỗ người đứng.
- **Mép đảo:** tuyết nhô 1–2 px ra ngoài mép cỏ; nhũ băng treo trên vách đá, dài 2–7 px, mật độ theo `hash`.
- **Prop của đảo** (cây, bụi, đá, cột đèn, ghế đá, chòi): mỗi prop có lớp tuyết ở mặt hướng lên, vẽ trong lúc dựng
  prop. Mái chòi hai tầng trắng; cành cây trụi có tuyết dày hơn hôm nay.
- **Vật vẽ mỗi khung** (đỉnh tường văn phòng, khối WC, mái chuồng chó, giàn hút thuốc, bảng EXIT): thêm dải tuyết
  bằng `fillRect` trong hàm vẽ sẵn có. Đây là phần duy nhất của tuyết tốn lệnh vẽ mỗi khung (ngân sách 150).
- **Chó:** giữ cách phủ tuyết lên pixel trên cùng như hiện nay.
- **Người tuyết:** vẽ lại ở mục 5.4 (thuộc mùa đông, không riêng Noel).

### 4.4 Dấu chân

Người và chó đi trên bãi cỏ khi mức ≥ 2 để lại dấu: mỗi 0,5 ô một dấu 2×1 px màu bóng, mờ dần trong 12 giây. Bộ đệm
vòng cố định 48 dấu cho cả đảo (không cấp phát). Tắt khi giảm chuyển động. Là hạng mục bị cắt đầu tiên nếu vượt
ngân sách.

## 5. Sự kiện Noel

### 5.1 Lịch và công tắc

Module thuần `web/event-logic.js`:

- `EventLogic.active(date, choice)` → `null` hoặc `{ key: 'christmas', level: 1..3, eve: bool, day: bool }`.
- Lịch (quyết định của em, chờ anh duyệt): 1–7/12 mức 1, 8–14/12 mức 2, 15–26/12 mức 3; `eve` là 24/12 từ 18:00 đến
  25/12 06:00; `day` là cả ngày 25/12.
- Cây thông hiện bật từ 21/11 (`SeasonTree.SEASONS.christmas`): dời `from` về `12-01` cho khớp.
- `choice`: `auto` (theo ngày), `on` (mức 3), `off`. Lưu trong storage như lựa chọn mùa; đi qua `pageSettings` của
  server để hình nền theo trình duyệt (cùng cơ chế với thời tiết).
- Settings: mục "Sự kiện" dưới "Mùa": Tự động / Bật / Tắt, dòng "Đang: …", nút xem thử 1 phút (như xem thử mùa).
- Sự kiện đi kèm mùa đông: khi sự kiện bật mà mùa đang xem không phải đông (xem thử mùa hè), đồ trang trí vẫn hiện,
  tuyết theo mùa đang xem.
- Khoá cache ảnh đảo thêm `event` (`''`, `x1`, `x2`, `x3`): đổi nhiều nhất 1 lần/ngày.

Khung này dùng lại được: sự kiện khác sau này chỉ thêm một mục lịch và bộ hình của nó.

### 5.2 Cây thông lớn

- Một cây, cao ~2 lần cây thường (~64 px), đứng trên bãi cỏ trước văn phòng, chỗ thoáng, không sau tường, không trên
  lối đi. Vị trí chọn bằng hàm thuần `EventLogic.bigTreeTile(island, W, H)`, có test (không che cửa, bậc thang, chòi,
  chuồng chó; cách lối đi ≥ 1 ô).
- Ba cây thông nhỏ hiện có: bỏ (chúng là nguồn gốc của lỗi "bị tường che").
- Thân cây, tầng lá, tuyết trên lá, dây kim tuyến, quà dưới gốc: nướng thành prop (mức 1: 2 hộp, mức 2: 5, mức 3: 9).
- Mỗi khung chỉ vẽ: 24 bóng đèn (4 nhóm màu, mỗi nhóm đổi sáng/tắt ở 1 Hz lệch pha), ngôi sao trên ngọn, và ban đêm
  một quầng sáng lớn dưới gốc hắt lên tuyết (1 sprite).
- Đêm: cây không nhận lớp tối như bãi cỏ; tầng lá tối vừa, bóng đèn giữ nguyên màu.

**Sửa theo yêu cầu ngày 2026-11-11** (thay các ý trên ở chỗ khác nhau):

- Cây thông lớn đứng **trong văn phòng**, giữa ngã tư hai hành lang (`EventLogic.TREE_AT = [9.5, 7]`, chiếm hai ô
  `TREE_CELLS`, bị chặn khi sự kiện bật để mọi người đi vòng). Hành lang giữa hai cặp khu bàn rộng 3 ô (khu bên phải
  dời sang đông 1 ô; lối cạnh bồn cây pantry còn 1 ô). Phần tĩnh của cây là một sprite dựng một lần cho mỗi (mức sự kiện, mức sáng), mỗi khung
  một `drawImage` cộng bóng đèn như trên. `bigTreeTile` đã bỏ.
- Ngoài trời, các cây trơ cành của mùa đông thành **cây thông thường phủ tuyết nhẹ** (`drawSeasonTree` kiểu `'fir'`),
  nướng cùng prop của đảo.
- **Sự kiện bật thì mùa là mùa đông** dù ngày nào hay chọn mùa gì (`EventLogic.season`), và **trời luôn có tuyết
  rơi**: mưa và bão thành tuyết, lúc quang cũng rơi nhẹ ở 0,45 (`EventLogic.weather`). Tắt thời tiết trong Settings
  thì không có tuyết rơi, mùa vẫn là mùa đông.

### 5.3 Dây đèn và ánh sáng đêm

- Dây đèn chạy theo: đỉnh tường sau và tường trái của văn phòng, mái ba chuồng chó, xà giàn hút thuốc, hai tầng mái
  chòi. Toạ độ tính một lần lúc tải (`EventLogic.lightString(points, gap)`), lưu trong mảng số cố định.
- Tối đa 120 bóng. Mỗi bóng 2×2 px; 4 màu (đỏ, vàng, lục, lam); ban ngày màu nhạt, không quầng.
- Ban đêm mỗi bóng có quầng: sprite 12×12 dựng sẵn cho từng màu (4 sprite), vẽ bằng `drawImage` với `globalAlpha`
  theo mức tối. Không gradient mỗi khung.
- Nháy: theo nhóm, tính từ `t` (không trạng thái). Giảm chuyển động: sáng đều.
- Mức 1 chỉ có dây trên tường văn phòng; mức 2 thêm chuồng chó và giàn; mức 3 thêm chòi.
- Cửa sổ văn phòng ban đêm sáng ấm hơn một bậc trong sự kiện (đổi màu sẵn có, không thêm lệnh vẽ).

### 5.4 Người tuyết (mùa đông)

- Cao ~28 px (hiện ~18), 3 dáng khác nhau thật: một con đội mũ chóp và quàng khăn, một con đội xô và cầm chổi, một
  con nhỏ nghiêng đầu. Trong sự kiện một con đội mũ Noel.
- Có bóng đổ lam trên tuyết. Vẫn là prop nướng sẵn, vị trí giữ `SeasonIsland.snowmanTiles`.

### 5.5 Trang trí khác

| Món | Ở đâu | Mức | Cách vẽ |
|---|---|---|---|
| Vòng nguyệt quế | Cửa EXIT, hai cửa WC | 1 | `fillRect` trong hàm vẽ cửa |
| Kẹo gậy | Dọc lối đá, cạnh cột đèn | 2 | prop nướng sẵn |
| Cây thông mini / tất / kim tuyến | Trên bàn có chủ, vách ngăn | 2 | tối đa 4 `fillRect` mỗi bàn, chọn món theo `hash` số bàn |
| Đèn lồng đỏ | Chòi giữa hồ | 3 | trong prop chòi |
| Hộp quà rải rác | Quanh cây thông lớn | theo mức | trong prop cây |
| Ba đảo nhỏ bay | Trời | 2 | trong sprite đảo nhỏ (`farIsland`, thêm khoá `event`): cây thông có đèn, người tuyết, nhà gỗ sáng đèn |

Bàn không có chủ không trang trí (giữ nguyên tắc "đồ chỉ sáng khi có người dùng").

## 6. Trang phục

### 6.1 Người

- Module thuần `web/outfit-logic.js`: `OutfitLogic.outfit(sid, event, isSub)` → `null` hoặc
  `{ kind, top, trim, hat, hatColor, scarf }`. Gán theo `hash(sid)`, nên một người mặc một bộ suốt sự kiện và máy nào
  cũng thấy giống nhau. Kết quả lưu trên agent cùng chỗ với `a.look` (tính một lần, tính lại khi sự kiện đổi).
- Bộ (agent chính), chia đều theo `hash`:

| Bộ | Áo | Viền | Đầu |
|---|---|---|---|
| `santa` | đỏ `#c8323a` | trắng ở gấu và cổ | mũ Noel đỏ, chóp trắng |
| `sweater` | lục `#2f7d4f` hoặc đỏ, sọc ngang họa tiết 1 px | không | bịt tai |
| `reindeer` | nâu `#8a5a3a`, bụng kem | không | băng đô sừng |
| `coat` | màu phòng ban | cổ lông trắng | mũ len có quả bông |
| `snowman` | trắng, 2 khuy đen | không | mũ chóp đen |

- Sub-agent: bộ `elf` (lục `#2f8f4e`, cổ đỏ, mũ nhọn lục có chuông vàng). Băng vàng hiện tại thôi không vẽ trong sự
  kiện; cái mũ nhọn là dấu nhận sub-agent.
- **Giữ nhận diện phòng ban** (quyết định của em, chờ anh duyệt): khăn quàng 2 px màu phòng ban trên mọi bộ. Áo đổi
  theo bộ, khăn giữ màu phòng ban. Vòng chọn, nhãn và chip phòng ban không đổi.
- Trong văn phòng và ngoài trời mặc như nhau (đơn giản, không đổi đồ ở cửa).
- Mức sự kiện: mức 1 chỉ có mũ; từ mức 2 có cả bộ.

### 6.2 Áp vào đường vẽ

Người được vẽ ở các tư thế: ngồi bàn (7 trạng thái), đứng/đi, ngồi ghế cao, ngủ gục, tắm hồ, nhìn từ sau ở bàn, và
trong các hoạt cảnh ra đi. Để không vẽ riêng từng chỗ:

- Màu áo: mọi chỗ đang đọc `a.shirt` chuyển sang một hàm `shirtOf(a)` trả màu của bộ nếu có. Một điểm đổi, không thêm
  lệnh vẽ.
- Mũ và khăn: hai hàm `PERSON.hatEvent(R, o, sx, hy)` và `PERSON.scarf(R, o, sx, sy)` gọi ngay sau chỗ vẽ tóc/thân ở
  mỗi tư thế. Mỗi hàm tối đa 4 `fillRect`. Tư thế tắm hồ: chỉ mũ.
- Hoạt cảnh ra đi dùng `drawPerson` trên bản chụp của agent nên tự có trang phục. Hình bóng một màu (cháy đen, bộ
  xương) không đổi.
- Ngân sách: tối đa 8 lệnh thêm mỗi người.

### 6.3 Chó

- Corgi: sừng tuần lộc và mũi đỏ. Husky: khăn quàng đỏ. Đốm: áo len đỏ viền trắng.
- Vẽ vào sprite lúc dựng: `DogSprites.frame(breed, name)` giữ nguyên; thêm bảng lớp phủ theo (giống, khung hình) trong
  `web/dog-sprites-xmas.js`, áp trong `dogSprite` khi sự kiện bật. Khoá cache thêm `event`. Mỗi khung không tốn thêm.
- Phải có lớp phủ cho mọi khung hình đang dùng (đứng, chạy 2 khung, ngồi, nằm, ngủ, uống…): test đếm đủ.
- Chuồng chó: dây đèn (mục 5.3) và vòng nguyệt quế nhỏ trên cửa.

## 7. Nhân vật sự kiện (đợt 4)

| Nhân vật | Số | Ở đâu | Hành vi | Mức |
|---|---|---|---|---|
| Tuần lộc | 3 | Bãi cỏ sau và bên | Gặm cỏ, ngẩng đầu, đi vài ô; một con mũi đỏ sáng ban đêm. Chó tới ngửi rồi đi | 2 |
| Yêu tinh | 2 | Từ mép đảo tới gốc cây thông | Khuân quà theo đường cố định, thỉnh thoảng trượt ngã | 3 |
| Chim cánh cụt | 4 | Hồ băng | Đứng cụm, lần lượt trượt bụng một đoạn | 3, chỉ khi hồ đóng băng |
| Ông già Noel | 1 | Trời, rồi ghế cạnh cây thông | `eve`: xe trượt bay ngang trời mỗi 3–5 phút, thả 1–2 quà dù. `day`: ngồi ghế cạnh cây | chỉ 24–25/12 |

- Logic thuần trong `web/event-critters.js` (kiểu `DogLogic` nhưng nhỏ: bước, tư thế, không tìm đường phức tạp; tuần
  lộc đi trong tập ô của chó, yêu tinh đi theo đường tính sẵn).
- Sprite dựng một lần cho mỗi (khung hình, mức sáng), cache chung mọi đảo như sprite chó.
- Xe trượt vẽ trên canvas trời sau; quà dù rơi xuống thành hộp quà cạnh cây thông (tăng bộ đếm quà, tối đa 9).
- Chế độ world: mỗi đảo có tuần lộc riêng; xe trượt chỉ vẽ một lần trên trời chung.

## 8. Hành vi và kiểu ra đi (đợt 5)

Hoạt động nghỉ mới (chỉ khi sự kiện bật, cùng cơ chế `IDLE_SPOTS`):

| Hoạt động | Điều kiện | Ghi chú |
|---|---|---|
| Ném tuyết | mức tuyết ≥ 2, có 2 người rảnh | hai chỗ đứng đối diện trên bãi cỏ; quả tuyết là 1 `fillRect` bay theo parabol |
| Đắp người tuyết | mức tuyết ≥ 2 | quả cầu lớn dần trong 20 giây; không để lại người tuyết mới (tránh rebake) |
| Trượt băng | hồ đóng băng | đi vòng trên đường tính sẵn, để lại vệt mờ |
| Uống cacao | luôn | dùng chỗ cà phê sẵn có, đổi cốc và có hơi |
| Đặt quà | mức ≥ 2 | tới gốc cây thông, cúi đặt |

Kiểu ra đi thêm vào `FateLogic` (chỉ khi sự kiện bật): xe trượt chở đi (`eve`/`day`), bị gói thành hộp quà, trượt băng
lao khỏi mép đảo (hồ đóng băng), chui ống khói. Mỗi kiểu một câu thoại ở 7 ngôn ngữ.

Hơi thở trắng khi đứng yên ngoài trời: 2 pixel, mỗi 3 giây, chỉ ban ngày và khi mức tuyết ≥ 2.

## 9. Chế độ world, hình nền, hub

- World: mọi đảo theo ngày và lựa chọn của người xem, như mùa. `IslandScene` mượn các hàm mới qua `SCENE_METHODS`
  (test `island-scene-methods` phải qua).
- Hình nền: theo `pageSettings` của server, không có bảng Settings.
- Hub: không gửi gì mới. Trang phục suy ra từ `sid` ở phía người xem.

## 10. Kiểm tra

- Test thuần cho: `SnowLogic` (mức, ụ tuyết không đè lối đi/nước/chỗ đứng), `EventLogic` (lịch từng ngày, công tắc,
  vị trí cây lớn, số bóng ≤ 120), `OutfitLogic` (ổn định theo `sid`, sub-agent luôn là `elf`, chia đều các bộ),
  lớp phủ chó đủ mọi khung hình, i18n đủ 7 ngôn ngữ.
- Test hiện có phải qua nguyên: giới hạn 700 dòng, `SCENE_METHODS`, khoá i18n.
- Mỗi đợt: chụp 20/12 ngày và đêm ở trang thường và `?wallpaper=1`, so với ảnh mốc; chạy `tools/perf-frame.mjs` và
  ghi số vào PR. Đợt nào vượt ngân sách thì không merge.
- Đợt 2 trở đi: đo GPU trên app hình nền thật một lần trước khi merge.
- Kiểm tra ngoài tháng 12: chụp 20/7 và 20/10, phải giống hệt hôm nay (so ảnh).

## 11. Quyết định của em, chờ anh duyệt

1. Thứ tự: tuyết → sự kiện → trang phục → nhân vật → hành vi.
2. Thời gian: 1/12–26/12 tăng dần ba mức; dời cây thông từ 21/11 về 1/12.
3. Ba cây thông nhỏ bỏ, thay bằng một cây lớn.
4. Trang phục: cả bộ từ mức 2, mặc cả trong văn phòng; phòng ban nhận qua khăn quàng.
5. Sub-agent nhận qua mũ yêu tinh thay băng vàng trong sự kiện.
6. Ông già Noel chỉ 24–25/12.
7. Đắp người tuyết không để lại người tuyết mới (tránh nướng lại ảnh đảo).
8. Vượt ngân sách thì cắt hạng mục theo thứ tự ở mục 3.4, không nới ngân sách.
