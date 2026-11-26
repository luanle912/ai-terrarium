# Trang `/assets`: wiki của mọi item trong game

Ngày: 2026-11-16 · Người đặt hàng: anh PO · Người viết: Claude

## 1. Ý định

Anh PO: "làm một /assets riêng để follow tất cả các item, ví dụ cây thì có default, theo mùa, event, ... để anh có thể view
hết, giống như wiki; page đó tuỳ em thiết kế sao cho phù hợp theme và UX nhất. Rà soát tất cả các item ⇒ plans + specs ⇒ rồi
mới làm."

Game vẽ mọi thứ bằng code (không có file ảnh), nên hiện không có chỗ nào xem được "game có những gì, mỗi thứ có mấy dáng".
Trang `/assets` là một bản danh mục sống: mỗi item được vẽ bằng **chính code của game**, nên không bao giờ lệch với game, và
có test bắt buộc item mới phải vào danh mục.

Bản rà soát: `docs/specs/2026-11-16-assets-inventory.md` — khoảng 135 item, 350+ biến thể, 11 nhóm, kèm cách vẽ riêng từng
loại.

## 2. Mục tiêu, không làm, phản mục tiêu

**Mục tiêu**
- Xem được mọi item và mọi biến thể của nó: mặc định, theo mùa, theo sự kiện/lễ, ngày/đêm, có tuyết, trạng thái (đang dùng /
  không; sáng / tắt), giới tính, giống loài, tư thế, khung chuyển động.
- Tìm nhanh: nhóm, ô tìm, lọc theo nhãn (mùa, sự kiện, có chuyển động, chỉ có trong danh mục).
- Biết item xuất hiện **khi nào** (mùa, khoảng ngày lễ, cấp sự kiện), **ở đâu**, và **code nào** vẽ nó.
- Cùng theme với game (nền tối, font Pixelify Sans + JetBrains Mono, chip, viền pixel), pixel sắc nét (nearest-neighbour).
- Thêm item mới vào game mà quên danh mục thì test hỏng.

**Không làm (đợt này)**
- Không sửa hình của item nào; không đổi hành vi game.
- Không xuất file PNG / sprite sheet (để sau nếu anh cần).
- Không soạn thảo: trang chỉ xem.

**Phản mục tiêu**
- Danh mục vẽ bằng code sao chép riêng (sẽ lệch với game).
- Trang nặng: hàng trăm canvas cùng chạy animation làm máy nóng.
- Trang local `/` chậm hoặc đổi hình vì thay đổi phục vụ cho danh mục.

## 3. Phục vụ trang

- Đường dẫn `/assets`, shell mới `claude-assets.html` ở gốc repo (cùng font, `web/styles.css`, React UMD như trang chính),
  entry `web/assets-main.js`. Thư mục ảnh `assets/` ở gốc repo không liên quan (không phục vụ qua HTTP).
- **Server local** (`server.js`): `/assets` trả shell mới. **Hub** (`hub/publish.js`): `/assets` trả shell mới với cùng CSP
  như trang văn phòng (`createOfficePage`), yêu cầu đăng nhập như `/` *(em tự quyết: cùng luật với trang chính)*.
- Trang chính có lối vào: một mục "Assets" trong ⚙ Settings (link `/assets`); trang assets có link "← Văn phòng" về `/`.
- Trang assets không mở luồng `/events`, không publish, không gọi API nào.

## 4. Mô hình danh mục

Một **registry** thuần dữ liệu + hàm vẽ, chia theo nhóm trong các module `web/assets-cat-*.js`:

```
entry = {
  id,                    // 'plants.island-tree', 'pantry.microwave', 'animals.dog' — ổn định, dùng cho link
  cat,                   // mã nhóm (mục 5)
  name: () => tr('assets.item.…'),
  tags: ['season', 'event', 'animated', 'night', 'snow', 'state', 'catalogue-only', …],
  when,                  // khi nào xuất hiện: {seasons?, event?: {key, level}, holiday?: key, always?: true}
  where,                 // mã vị trí: lawn, office, pantry, lake, sky, world…
  source: [{file, fn}],  // code vẽ nó
  size: {w, h},          // khung logic px để vẽ một biến thể
  axes: [{id, label, values: [{id, label}]}],   // các trục biến thể riêng của item (giống, tư thế, khung, cấp…)
  uses: ['season', 'light', 'snow', 'event'],   // item phản ứng với điều khiển chung nào (mục 6)
  draw(ctx, view, t),    // view = {ox, oy, env, pick: {axisId: valueId}}
}
```

- `draw` **gọi code game** theo sáu kiểu trong bản rà soát (kit nội thất, kit pantry, cây lễ, painter của đảo, sprite dữ
  liệu, method của văn phòng qua host giả như `IslandScene`). Những thứ đang là hàm private trong module (vịt, cầu vồng, igloo,
  đống quà…) thì **export thêm painter đó**, không chép code.
- Item chỉ tồn tại trong ảnh đảo nướng hoặc lượt vẽ cả cảnh (bờ, đáy đảo, núi, thác, sương, bầu trời, thời tiết) hiện dưới
  dạng **thẻ cảnh**: vẽ cả đảo/cả trời vào canvas rồi cắt đúng vùng.
- Biến thể chọn theo vị trí ô (`hash(x, y)`: bụi to/nhỏ, nấm đỏ/nâu…): registry ghi sẵn toạ độ ô cho từng dáng.
- Item có trong code nhưng game không vẽ (9 món `OfficeDecor.ITEMS`, 4 cây lễ "mùa", `drawDesk`, `drawPlanter`) vẫn vào danh
  mục, gắn nhãn **"chỉ có trong danh mục"**.

## 5. Nhóm

| Mã | Nhóm | Gồm |
|---|---|---|
| `plants` | Cây cối | cây đảo (4 mùa), 16 cây lễ, cây Giáng sinh lớn, cây mini ở Toàn cảnh, bụi, hoa, nấm |
| `outdoor` | Đồ ngoài trời | đá, đèn, kẹo gậy, ghế đá, chùa một cột, người tuyết ×3, sen, bèo, đá bước |
| `island` | Đảo & bầu trời | bờ, đáy đảo, núi, hồ, vũng, hai thác, đảo nhỏ, mặt trời/trăng, mây, sương, cầu vồng, 6 kiểu thời tiết, hạt rơi theo mùa |
| `animals` | Động vật | 3 giống chó (khung, hành động, đồ Giáng sinh), chuồng, vịt, cá, chim, đom đóm, tuần lộc, chim cánh cụt, gấu Bắc Cực, igloo |
| `people` | Nhân vật | giới tính, tóc, áo, 10 trạng thái, tư thế ngồi/đứng, 21 hành động, 7 trang phục Giáng sinh, mũ, cảnh rời đảo |
| `office` | Văn phòng | bàn, ghế, màn hình (8 chế độ), bàn phím, cây chậu, bảng usage, đồ treo tường, cửa sổ, phòng ban, cầu thang, cửa EXIT |
| `pantry` | Pantry | 23 món (tủ lạnh, cà phê, lò vi sóng, bồn nước, máy game, bi lắc, sofa…), mỗi món có đang dùng / ban đêm |
| `rooms` | Khu | nhà vệ sinh, góc hút thuốc (thẻ cảnh) |
| `event` | Sự kiện | quà, xe trượt, Santa, yêu tinh, đèn, nhà thờ Đức Bà, tượng và máng cỏ — theo cấp 1–3 |
| `world` | Chế độ thế giới | đảo đơn giản (màu × mùa × sáng đèn × của tôi), ô trống, ô "chỗ của bạn" |

## 6. Giao diện

**Bố cục (desktop):** header · cột trái nhóm · lưới thẻ · ngăn chi tiết bên phải.

- **Header:** "CLAUDE CO. · Assets", link "← Văn phòng", ô tìm (phím `/`), bộ **điều khiển chung** và chọn ngôn ngữ.
- **Điều khiển chung** (áp cho mọi thẻ có `uses` tương ứng; thẻ không dùng thì không đổi):
  - Ánh sáng: Ngày / Chạng vạng / Đêm.
  - Mùa: Xuân / Hạ / Thu / Đông.
  - Tuyết phủ: Không / Có.
  - Sự kiện: Tắt / Giáng sinh cấp 1 / 2 / 3.
  - Phóng: ×2 / ×3 / ×4 (số nguyên, nearest-neighbour).
  - Chuyển động: Chạy / Dừng.
- **Cột trái:** các nhóm kèm số item; "Tất cả"; các nhãn lọc (Theo mùa, Sự kiện, Có chuyển động, Chỉ trong danh mục).
- **Lưới thẻ:** mỗi thẻ là một item: canvas xem trước (nền caro tối để thấy rõ viền), tên, các nhãn nhỏ, số biến thể. Thẻ
  đổi theo điều khiển chung. Chỉ thẻ đang trong khung nhìn mới chạy animation.
- **Ngăn chi tiết** (bấm thẻ hoặc Enter): xem lớn; các trục riêng của item thành hàng nút (giống, tư thế, khung, cấp…);
  **bảng "tất cả biến thể"**: lưới nhỏ hiện mọi tổ hợp đáng xem (ví dụ cây đảo: 4 mùa × ngày/đêm × tuyết); thông tin: khi
  nào xuất hiện (mùa, khoảng ngày lễ, cấp sự kiện), ở đâu, kích thước, bảng màu chính (ô màu), code vẽ (`file · hàm`).
  Esc đóng. Mũi tên trái/phải sang item kế.
- **Link sâu:** `#/<cat>/<id>?light=night&season=winter…` — mở lại đúng item và trạng thái; nút "chép link".
- **Điện thoại:** nhóm thành dải chip cuộn ngang, lưới 2 cột, ngăn chi tiết thành bottom sheet toàn màn hình.
- **Trạng thái rỗng:** tìm không ra thì gợi ý xoá bộ lọc.
- Mọi chữ qua `tr()`, đủ 7 ngôn ngữ; tên item dùng lại nhãn sẵn có khi có (`SEASONS`, `ACT_TXT`, `ST`…), thiếu thì thêm khoá
  `assets.item.*`. Mô tả "khi nào/ở đâu" sinh từ dữ liệu có cấu trúc (không viết văn xuôi từng item).

## 7. Hiệu năng

- Thẻ tĩnh vẽ một lần mỗi khi điều khiển chung đổi; thẻ động chỉ chạy khi trong khung nhìn (IntersectionObserver), tối đa
  ~15 khung/giây ở lưới, đủ tốc độ ở ngăn chi tiết. Tab ẩn thì dừng hết.
- Thẻ cảnh (đảo, trời) dùng chung một bản nướng theo (mùa, sáng, tuyết, sự kiện), cắt vùng cho từng thẻ.
- `prefers-reduced-motion`: mặc định Dừng.
- Trang chính `/` không tải module của danh mục.

## 8. Kiểm

- **Đủ item:** test đọc các nguồn sự thật của game (`OfficeDecor.ITEMS`, registry pantry `I`, `SEASONS`, `BREEDS`, loại
  critter, loại decor của đảo, `LOOKS`, `ACT_TXT`, `ST`, `FATES`, các món sự kiện…) và đòi mỗi khoá có entry trong danh mục.
  Thêm item vào game mà chưa vào danh mục ⇒ test đỏ.
- **Vẽ được:** mỗi entry, mỗi giá trị của mỗi trục, mỗi tổ hợp điều khiển chung nó `uses` ⇒ `draw` chạy trên canvas giả ghi
  lệnh (như `tests/office-draw-cathedral.test.mjs`) không ném lỗi và có vẽ ít nhất một lệnh.
- **Phục vụ:** `/assets` trên server local và hub (CSP, đăng nhập); `moduleGraph` theo cả hai entry; i18n đủ khoá.
- **Mắt:** Chrome ở 1280, 1440, 390; từng nhóm; ngày/đêm × 4 mùa × sự kiện; ngăn chi tiết; link sâu; không lỗi console.

## 9. Em tự quyết (anh xem lại)

- Trên hub, `/assets` cần đăng nhập như trang chính.
- Trang chỉ xem, chưa có xuất PNG.
- Item code có mà game không vẽ vẫn hiện, gắn nhãn "chỉ có trong danh mục".
- Nhà vệ sinh, góc hút thuốc, đảo, bầu trời hiện dạng thẻ cảnh (cắt từ cảnh thật), không tách từng viên gạch.
- Nhân vật là **một** item "người" có các trục (giới tính, tóc, áo, trạng thái, tư thế, hành động, trang phục), không phải
  hàng trăm thẻ.
