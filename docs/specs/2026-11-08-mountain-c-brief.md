# Spec: Núi tuyết pixel iso (bản C) cho đảo bay

> Nguyên văn mô tả anh Kiệt gửi ngày 2026-11-08. Các quyết định đi kèm (cỡ, suối, màu viền, mặt trời, cách vẽ) nằm ở mục
> 11.10 của `docs/specs/2026-11-07-island-reshape-design.md` và thắng ở chỗ khác nguyên văn này.

Mục tiêu: thay 2 ngọn núi low-poly hiện tại bằng 1 ngọn núi tuyết pixel art, góc nhìn isometric 2:1 giống đảo văn phòng.
Ảnh tham chiếu: peak-C-iso.png (đính kèm). Bám sát ảnh đó, không tự thêm style khác.

## 1. Quy tắc bắt buộc

- Pixel thật, không mượt. Không gradient, không anti-alias, không blur, không polygon vector. Mọi thứ vẽ trên lưới "art
  pixel" rồi phóng to bằng số nguyên với nearest-neighbor (imageSmoothingEnabled = false / image-rendering: pixelated).
- Cùng cỡ pixel với cả cảnh. 1 art pixel của núi phải bằng 1 art pixel của cây, bàn ghế, ô cỏ hiện có. Nếu game đang scale
  ×4 thì núi cũng ×4.
- Góc iso 2:1. Ô cỏ hình thoi rộng gấp đôi cao (ảnh mẫu dùng ô 16×8 art px — đổi theo kích thước ô thật của game, giữ tỉ lệ
  2:1).
- Ánh sáng một hướng: mặt trái sáng, mặt phải tối (khớp với mặt đất nâu dưới đảo).
- Viền 1 px màu #3B2F4A quanh silhouette núi, thác, hồ, suối, cây, đá. Không dùng đen thuần.
- Chỉ dùng bảng màu ở mục 4. Không pha màu mới.

## 2. Bố cục và kích thước

Toạ độ dưới đây tính theo art pixel, gốc (0,0) = tâm hình thoi chân núi, trục y hướng xuống.

- Chân núi (footprint): hình thoi iso chiếm 7×7 ô. Góc trái L = (-54, 0), góc trước F = (0, +27), góc phải R = (+54, 0),
  góc sau B = (0, -27) (bị núi che).
- Đỉnh: peak = (+4, -70). Núi cao khoảng 1.5 lần toà nhà văn phòng. Nếu thấy lấn át quá thì scale cả sprite xuống, không
  bóp méo.
- Vị trí trên đảo: góc sau của đảo (sau toà nhà, như chỗ đang có núi), chân núi thẳng hàng với lưới ô. Các ô dưới footprint
  là không đi được (non-walkable).

### Silhouette (đa giác, theo thứ tự)

L(-54,0) → (-48,-10) → (-41,-12) → (-33,-26) → (-26,-28) → (-16,-46) → (-8,-60) → (-1,-67) → peak(+4,-70) → (+10,-64) →
(+17,-51) → (+22,-50) → (+30,-35) → (+38,-29) → (+45,-18) → (+50,-12) → R(+54,0) → F(0,+27) → về L.
Mép trên gãy theo bậc như vậy là cố ý. Không làm thẳng hay đối xứng.

### Đường gờ (ridge) chia mặt

- Gờ chính (polyline): peak(+4,-70) → (+7,-36) → (+3,-4) → F(0,+27). Bên trái gờ = mặt sáng, bên phải = mặt tối. Vẽ thêm
  1 px highlight #F7F2EA ngay sát bên trái gờ chính.
- Gờ vai trái: (-26,-28) → (-28,-10) → (-30,+13). Phần bên trái gờ này dùng màu "đá vừa".
- Gờ vai phải: (+30,-35) → (+33,-12) → (+34,+11). Phần bên phải gờ này dùng màu "đá tối hơn".

### Chi tiết trên núi

- Tuyết: phủ phần nằm trên y = -48. Mép dưới tuyết nhỏ giọt: mỗi cột 2 px cộng thêm độ lệch lấy lần lượt từ dãy
  [0,1,3,5,3,1,0,2,6,4,1,0,1,4,7,3,1,0,2,3,1,0,5,2,0,1,3,1]. Hàng pixel cuối cùng của tuyết dùng màu "tuyết viền".
- Gờ đá ngang: khoảng 30 nét ngắn dài 3–6 px, rải ngẫu nhiên ở vùng y ∈ [-46, +4] (dùng seed cố định). Nét = màu tối hơn
  một bậc so với mặt nó nằm trên. Pixel ngay phía trên mỗi nét = màu sáng hơn một bậc.
- Cỏ leo chân núi: pixel nào nằm trong núi và cách cạnh L–F hoặc F–R dưới khoảng 9 + 1.2*(sin(x/3.1) + sin(x/1.7+1)) px
  thì tô cỏ sườn (mặt sáng / mặt tối). Mép trên dải cỏ có 1 px viền cỏ tối.

## 3. Nước (phải liền một mạch)

Thứ tự dòng chảy: tuyết tan → khe đá → thác → hồ → suối → rơi khỏi mép đảo. Không có đoạn nước nào lơ lửng hay bị đứt.

- Khe đá (đa giác trên mặt sáng): (-17,-44), (-11,-44), (-15,+13), (-24,+13). Nền khe dùng "đá tối hơn", nửa phải của khe
  dùng "đá sâu". Mép trái khe là viền #3B2F4A, mép phải khe là highlight #F7F2EA.
- Thác nằm trong khe: tâm đi từ (-14,-44) xuống (-19,+20); bề rộng tăng từ 2 px lên 4 px khi xuống dưới. Cột trái màu
  "nước sáng". Cứ mỗi 4 hàng thì cột phải có 1 pixel trắng. Hàng trên cùng (chỗ tuyết tan) là một vệt trắng rộng 9 px.
- Hồ: hình elip iso, tâm (-20,+24), rx = 13, ry = 6. Viền đá rộng thêm 2 px (rx 15, ry 7.5), màu "đá viền hồ". Có một vệt
  sáng phía trên-trái của mặt hồ, và 6 pixel bọt trắng ở chỗ thác đổ xuống.
- Suối: rộng 5 px, chảy về phía trước-trái theo hướng iso (dx −2 : dy +1). Đi qua các điểm: (-28,+29) → (-38,+34) →
  (-44,+38) → (-52,+41) → (-58,+45), kéo tiếp tới mép đảo. Cứ khoảng 8 px đặt một vệt sáng dài 2 px.
- Thác ở mép đảo: cột rộng 5 px đổ xuống từ đúng điểm suối chạm mép, có vệt trắng ở miệng thác.
- Thác ở mép đảo hiện tại (dưới hồ vịt) giữ nguyên, hoặc nối suối vào nó.

Animation (nhẹ, tuỳ chọn): thác và suối dịch pattern pixel trắng xuống 1 px mỗi khoảng 120 ms; bọt ở hồ 2 frame xen kẽ,
khoảng 300 ms/frame; núi, tuyết, cây đứng yên.

## 4. Bảng màu

| Vai trò | Hex |
|---|---|
| Viền | #3B2F4A |
| Highlight gờ | #F7F2EA |
| Tuyết sáng / tuyết bóng | #FFFFFF / #CADCF2 |
| Tuyết viền (sáng / bóng) | #D6E4F4 / #A9BEDB |
| Đá sáng | #E6DED2 |
| Đá vừa | #C8BCAE |
| Đá tối | #968B9E |
| Đá tối hơn | #73698A |
| Đá sâu (trong khe, nét gờ mặt tối) | #575070 |
| Cỏ sườn sáng / tối / viền | #8FD762 / #62B545 / #4F9A3A |
| Nước thác / nước sáng | #7CCAF5 / #D4F2FF |
| Hồ / vệt sáng hồ | #5FB8F0 / #9FE0FF |
| Đá viền hồ | #D9D2C4 (chấm #A89F94) |
| Thông (tối / vừa) | #468F3A / #5FB447 |
| Cây thu (sáng / vừa / tối) | #FFD36B / #F59A3C / #D9673A |
| Thân cây | #8A5A3C |

## 5. Cây cỏ quanh núi (theo độ cao)

- Vách đá: không có cây.
- Dải cỏ chân núi: thông, đứng thành 2 cụm. Cụm trái khoảng 6 cây, quanh (-56..-34, +6..+17). Cụm phải khoảng 7 cây, quanh
  (+28..+64, +5..+19). Trộn 3 cỡ thông: nhỏ 3 tầng rộng 3/2/1 px; vừa 3 tầng rộng 4/3/2 px; lớn 3 tầng rộng 5/4/3 px. Mỗi
  tầng tô màu thông tối, 2 px mép trái tô màu thông vừa. Có viền.
- Đất bằng gần nước: bụi tròn và đá dọc suối, 2–3 cây nấm đỏ chấm trắng, hoa 1 px (hồng #FF7AA8, vàng #FFD84A, trắng) rải
  thưa trên cỏ.
- Xa hơn, trên đất bằng: dùng lại sprite cây thu cam đang có trong game.

## 6. Cách triển khai (khuyến nghị)

- Ưu tiên làm sprite tĩnh: xuất núi (kèm khe, thác, tuyết) thành một PNG nền trong suốt ở kích thước art pixel. Không render
  procedural mỗi frame.
- Hồ, suối và thác ở mép đảo là sprite/tile riêng, để còn animate được.
- Có thể viết script một lần (Python/PIL hoặc Canvas) theo đúng toạ độ ở trên để sinh PNG.
- Anchor sprite tại góc trước F. Sắp xếp độ sâu (z-order) cùng các object khác theo y của F, để cây và nhân vật đứng trước
  chân núi vẽ đè lên núi đúng cách.
- Xoá 2 ngọn núi low-poly cũ, mảng bóng xanh đậm hình đa giác ở chân núi, và quầng mặt trời dạng gradient. Nếu cần quầng mặt
  trời: thay bằng 2 vòng tròn màu phẳng, độ trong suốt cố định (không gradient).
