# Nhân vật nam, nữ và thói quen đi vệ sinh của agent

Ngày: 2026-11-05 · Người đặt hàng: anh Kiệt · Người viết: Claude

## 1. Ý định và lý do

Agent (những người tí hon trong văn phòng pixel) hiện chỉ có một dáng người: tóc ngắn, áo màu phòng ban, quần.
Nhìn vào không biết ai là nam, ai là nữ, nên nhà vệ sinh hai phòng (WC NAM, WC NỮ) phải chia người theo `id` chẵn lẻ,
và một "anh" có thể đi vào phòng nữ. Agent rảnh cũng rất ít khi đi vệ sinh: mỗi người chỉ thấy 2 hoặc 3 buồng trong
khoảng 35 chỗ rảnh, nên cơ hội chọn nhà vệ sinh dưới 1/10.

Anh Kiệt muốn ba điều:

1. Agent mới sinh ra là nam hoặc nữ, ngẫu nhiên nhưng cố định theo phiên.
2. Nét vẽ nhân vật đẹp hơn, nhìn là biết nam hay nữ.
3. Agent rảnh đi vệ sinh thường hơn, đi đúng phòng theo giới tính.

## 2. Giới tính

- Mỗi agent có `gender: 'm' | 'f'`, lưu trên object agent.
- Lấy từ băm (FNV-1a 32 bit) của session id (`sid`), muối riêng cho giới tính. Tải lại trang không đổi giới tính,
  vì phiên thật giữ `sid`. Agent mô phỏng có `sid` ngẫu nhiên nên giới tính cũng ngẫu nhiên.
- Đảo hub (`IslandScene`) mượn `addAgent` nên cũng lấy giới tính từ `sid` đã băm mà hub gửi. Không thêm state nào
  cho `IslandScene`: mọi thứ mới nằm trên object agent hoặc trong khối logic thuần.
- Tỉ lệ khoảng 50/50 (test kiểm trên 2000 sid: 45–55 %).

## 3. Khối logic thuần `people-logic`

Khối `<script id="people-logic">` mới (`globalThis.PeopleLogic`), không DOM, không canvas, test bằng `node:vm`
như `restroom-logic`.

| Hàm | Trả về |
|---|---|
| `hash(s)` | FNV-1a 32 bit, số nguyên không dấu |
| `genderOf(sid)` | `'m'` hoặc `'f'` |
| `look(sid)` | toàn bộ diện mạo: `gender, skin, hair, hairStyle, beard, top, layer, bottom, legs, shoes, acc` |

Mỗi đặc điểm là một lần rút độc lập: `hash(tên đặc điểm + ':' + sid) % số lựa chọn`. Một số lựa chọn được lặp trong
mảng để hay gặp hơn (tóc đen, nâu; không râu).

### 3.1. Bảng màu

| Nhóm | Màu |
|---|---|
| Da (8) | `#f7dcc4 #f2c9a0 #e8b48a #d9a273 #c68a5e #a86b45 #8a5534 #6b3f26` |
| Tóc (10) | đen `#1c1714`, nâu đậm `#3b2617`, nâu `#5a3a22`, hạt dẻ `#7a4a2a`, nâu đỏ `#8a3b2a`, đồng `#b8612f`, vàng `#d9a441`, vàng tro `#c9b48a`, muối tiêu `#9aa0a8`, bạc `#e8e2d6` |
| Quần (7) | `#2d3142 #3b4a6b #4a3b2f #22303a #5a5f73 #6b5a45 #33333d` |
| Váy (5) | navy `#2d3142`, chàm `#3b4a6b`, đỏ rượu `#6b2d3f`, ô liu `#4a5a3b`, lạc đà `#a0806a`; váy liền thì cùng màu áo |
| Áo khoác / cardigan (5) | `#3a3f52 #e8e2d6 #8a6a4a #2f4a3a #5a4a6a` |

Màu áo chính vẫn là màu phòng ban (`a.shirt = Dp.color`): đó là thông tin, cho biết agent thuộc nhóm nào.
Áo khoác và cardigan chỉ phủ hai cột ngoài mỗi bên, bốn cột giữa vẫn là màu phòng ban.

### 3.2. Kiểu

| | Nam | Nữ |
|---|---|---|
| Tóc | `crop`, `side` (rẽ ngôi), `quiff` (vuốt dựng), `buzz` (cắt sát), `curly` (xoăn), `cap` (mũ lưỡi trai) | `long` (dài thẳng), `wavy` (dài gợn), `bob`, `ponytail` (đuôi ngựa), `bun` (búi) |
| Râu | không (3/6), `stubble` (lún phún), `full` (quai nón), `moustache` (ria) | không bao giờ |
| Áo | `tee`, `shirt` (cổ trắng, cà vạt), `hoodie`, `jacket` | `blouse` (cổ chữ V), `tee`, `cardigan`, `dress` (váy liền) |
| Dưới | quần | váy (2/3) hoặc quần (1/3); `dress` luôn là váy |
| Phụ kiện | kính, tai nghe | kính, tai nghe, khuyên tai |

## 4. Nét vẽ

Giữ nguyên phong cách: pixel isometric, tô phẳng, cột phải tối hơn, không viền. Giữ nguyên chiều cao (19 px đứng),
bề ngang (8 px thân + tay), bóng dưới chân và mọi khung hình (đi, ngồi ghế văn phòng, ngồi ghế đẩu, gõ phím, nói
chuyện, ngủ gục, hút thuốc, rửa tay, tắm hồ). Vị trí bàn và ghế không đổi.

Nam và nữ phân biệt bằng **hình bóng**, không bằng chi tiết một pixel, để còn đọc được ở LOD của world view và ban đêm:

- **Nữ:** tóc dài buông qua vai (hai dải tóc ra ngoài mặt, dài tới ngực), búi trên đỉnh, đuôi ngựa sau gáy; váy chữ A
  từ eo xuống quá gối, chân thon với giày; môi hồng, má hồng, khuyên tai vàng. Nhìn từ sau, tóc dài phủ nửa lưng.
- **Nam:** tóc ngắn trên đỉnh, có thể dựng hoặc xoăn; râu là một mảng màu tóc ở cằm; cổ áo trắng với cà vạt, dây mũ
  hoodie hoặc vạt áo khoác.
- Ngồi ở bàn (nhìn từ sau): tóc dài, bob, đuôi ngựa, búi vẫn hiện rõ trên lưng ghế; quay nghiêng (đang nói chuyện,
  xin quyền) thì thấy râu.
- Ngủ gục trên bàn: tóc dài xoã trên gối. Tắm hồ: tóc dài hai bên, râu, búi.

Ban đêm người không bị làm tối (như hiện nay), nên màu tóc tối trên sàn tối vẫn tách nhờ mặt và áo.

Mã vẽ đặt trong các hàm cấp cao (`drawHair`, `drawFace`...) cạnh bảng màu trong script chính, không thêm method
mới vào `ClaudeOffice`, nên `SCENE_METHODS` không đổi.

## 5. Nhà vệ sinh theo giới tính

- `RestroomLogic.roomOf(who)`: nhận agent; `gender` `'m'` → WC NAM, `'f'` → WC NỮ. Agent không có giới tính (hoặc
  truyền số `id` như cũ) thì vẫn theo chẵn lẻ: lẻ là nam, chẵn là nữ.
- `goalFor` truyền cả agent vào `roomOf`.

## 6. Đi vệ sinh thường hơn

- Hàm thuần mới `RestroomLogic.pickIdle(spots, free, room, rand, share = SHARE)`:
  - `free` là chỉ số các chỗ rảnh chưa ai giữ, `room` là phòng của agent (`null` nếu vừa đi xong).
  - Nếu còn buồng trống trong phòng mình và `rand() < SHARE` (hoặc không còn chỗ nào khác), chọn một buồng trống;
    ngược lại chọn một chỗ không phải nhà vệ sinh. Không còn chỗ nào thì `null` (về bàn ngủ gục như cũ).
- `SHARE = 0.25`: khoảng 1 trong 4 lần chọn chỗ rảnh là nhà vệ sinh.
- **Sức chứa:** một buồng là một idle spot, mỗi spot chỉ một người giữ (tập `taken` sẵn có), và người đó giữ spot
  suốt lượt (cả lúc rửa tay). Vậy cùng lúc tối đa 2 người ở WC NAM và 3 người ở WC NỮ. Hết buồng thì người khác
  chọn hoạt động khác ngay, không đứng xếp hàng.
- Thời lượng một lượt giữ nguyên (`VISIT` = 9.9 giây mô phỏng). Đi xong vẫn không quay lại khi còn rảnh (`wcDone`).

## 7. i18n

Không có chữ mới hiện cho người dùng. `ACT_TXT.wc` ("đi vệ sinh") đã có ở 6 ngôn ngữ.

## 8. Kiểm tra

- Test thuần: giới tính ổn định và cân bằng; `look` ổn định, đúng tập kiểu theo giới, nữ không râu, nam không váy,
  12 sid ra ít nhất 10 diện mạo khác nhau, mọi màu là hex hợp lệ; `roomOf` theo giới tính và fallback;
  `pickIdle` đúng phòng, tỉ lệ khoảng 25 % (rand có seed), đầy buồng thì chọn chỗ khác, mô phỏng nhiều agent không
  bao giờ vượt số buồng.
- `node --test tests/*.test.mjs`: 460 test cũ cộng test mới, tất cả PASS.
- Pixel diff trang local không có agent: 0 px.
- Ảnh: bảng 12 nhân vật (6 nam, 6 nữ) ở mọi tư thế; văn phòng ngày và đêm; agent đi đúng cửa nhà vệ sinh.

## 9. Ngoài phạm vi

- Không sửa `<script id="world-view">`, `<script id="world-logic">`, không sửa mã vẽ nhà vệ sinh.
- Không cho người dùng chọn giới tính, không gửi giới tính lên hub.
