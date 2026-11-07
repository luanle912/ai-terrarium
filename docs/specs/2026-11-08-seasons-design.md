# Bốn mùa trên đảo

Ngày: 2026-11-08 · Người đặt hàng: anh Kiệt · Người viết: Claude

## 1. Ý định

Anh Kiệt: "cập nhật lại season thời tiết cho chuẩn và prettier nhé: mùa xuân thì sao: cây xanh, bush có trái, ...; mùa hạ
thì bình thường; mùa thu: cây vàng, lá rơi nhiều, gió thoảng; mùa đông: tuyết rơi, có tuyết, cây khô, có người tuyết trang
trí ...". Đảo phải đổi rõ theo mùa trong năm, đẹp và đồng bộ với đảo bản 2 (pixel art, viền `#3B2F4A`, núi tuyết bản C).

Làm sau khi đảo bản 2 (`docs/plans/2026-11-08-island-v2-plan.md`) đã xong.

## 2. Bốn mùa

Mùa theo tháng của máy người xem (Bắc bán cầu): **xuân** tháng 3–5, **hạ** 6–8, **thu** 9–11, **đông** 12–2.

| Mùa | Cây | Bụi, cỏ, hoa | Hạt rơi, gió | Khác |
|---|---|---|---|---|
| Xuân | tán xanh non, điểm vài chùm hoa nhạt | bụi có trái nhỏ (đỏ/tím), hoa nhiều hơn trên cỏ, cỏ xanh tươi hơn | vài cánh hoa bay rất thưa | — |
| Hạ | xanh đậm như hiện nay | như hiện nay | không | bình thường (mùa chuẩn) |
| Thu | tán vàng – cam (giữ cây thu cam đang có) | cỏ ngả vàng nhẹ | **lá rơi nhiều**, bay chéo theo **gió thoảng** (dây leo, hạt bay cùng hướng) | — |
| Đông | **cây khô** trơ cành (thông trên núi giữ lá, phủ tuyết) | cỏ phủ tuyết | **tuyết rơi** | **lớp tuyết phủ** trên cỏ, mái, núi; **2–3 người tuyết** trang trí trên bãi cỏ |

- Mọi hình là pixel art cùng cỡ pixel với cảnh, bảng màu hợp với đảo bản 2, qua `night()` lúc chạng vạng và ban đêm.
- Phần tĩnh (màu tán, cỏ, tuyết phủ, người tuyết) nướng vào ảnh đảo như hiện nay (cache theo mùa); phần động (lá, cánh hoa,
  tuyết rơi, gió) vẽ mỗi khung, số hạt cố định, không cấp phát mỗi khung, tôn trọng `env.reduced`.

## 3. Thời tiết trong mùa

- **Đông:** tuyết phủ luôn có suốt mùa (ít nhất mức phủ vừa), tuyết rơi nhẹ khi trời không mưa/bão; khi thời tiết là tuyết
  (chế độ thời tiết ngẫu nhiên) thì rơi dày và phủ dày hơn. Ở chế độ "thời tiết thật" theo thành phố, mùa đông vẫn có tuyết
  phủ và tuyết rơi nhẹ (đảo là thế giới riêng), trừ khi trời đang mưa/bão thì thay bằng mưa. *(Em tự quyết, anh xem lại.)*
- **Thu:** gió thoảng thường trực (lá và dây leo nghiêng theo một hướng, đổi hướng chậm); mưa/bão làm gió mạnh hơn như hiện
  nay.
- **Xuân, hạ:** thời tiết như hiện nay.
- Hồ vịt mùa đông vẫn là nước (không đóng băng), vịt vẫn bơi. *(Em tự quyết.)*

## 4. Ngày lễ

Hệ "cây sự kiện" hiện có (Tết, Giáng sinh, Trung thu, Valentine, 30/4, 2/9…) vẫn giữ: vào ngày lễ, **vài cây gần văn phòng**
đổi thành cây lễ như hiện nay; các cây còn lại của đảo theo mùa. Chip mùa ở header hiện tên mùa (hoặc tên lễ khi đang có lễ)
như hiện nay. *(Em tự quyết: lễ không phủ màu lên cả đảo nữa.)*

## 5. Không làm

- Không đổi bố cục đảo, văn phòng, nhân vật.
- Không thêm âm thanh.

## 6. Kiểm

- Test thuần: `seasonOf(date)` đúng 4 mùa theo tháng; mùa đông luôn có tuyết phủ tối thiểu; số hạt mỗi mùa cố định; ngày lễ
  vẫn trả tên lễ cho chip.
- Ảnh 1280×800 mỗi mùa (ngày và đêm) + điện thoại, chế độ thế giới; xem trước được bằng một cách xem nhanh từng mùa (vd.
  `?season=winter` chỉ khi chạy với cờ dev, hoặc nút xem trước trong ⚙ như xem trước thời tiết).

## 7. Cài đặt: tách Thời tiết và Mùa (anh Kiệt, 2026-11-08)

Anh Kiệt: "ở setting tách riêng ra weather và season nhé". Trong ⚙ Settings có **hai mục riêng**, cùng kiểu với mục Weather
hiện có (ảnh anh gửi: ô chọn "Random", dòng "Now: Clear", các nút Clear/Cloudy/Rain/Storm/Snow/Fog):

- **Thời tiết** — giữ nguyên như hiện nay (Ngẫu nhiên / Thời tiết thật theo thành phố; "Hiện tại: …"; nút xem trước
  Quang, Mây, Mưa, Giông, Tuyết, Sương).
- **Mùa** — mục mới ngay dưới:
  - ô chọn: **Tự động (theo ngày)** / Xuân / Hạ / Thu / Đông; lựa chọn được nhớ (localStorage, như cài đặt thời tiết);
  - dòng "Hiện tại: Thu" (hoặc tên lễ khi đang có lễ, ví dụ "Hiện tại: Thu · Trung thu");
  - các nút **xem trước** Xuân, Hạ, Thu, Đông: đổi mùa trong 1 phút rồi quay lại, giống xem trước thời tiết.
- "Tuyết" trong Thời tiết là trời đang tuyết rơi; "Đông" trong Mùa là cảnh mùa đông (cây khô, người tuyết, tuyết phủ). Hai
  thứ độc lập: có thể xem trước tuyết rơi giữa mùa hạ, hoặc mùa đông trời quang (vẫn có tuyết phủ theo mục 3).
- Chip mùa ở header bấm vào thì mở thẳng mục Mùa trong ⚙.
- Mọi chữ qua `tr()`, đủ 7 ngôn ngữ.
- Mục 6 (Kiểm): thay "`?season=` hoặc nút xem trước" bằng các nút xem trước ở mục Mùa này.
