# Đảo văn phòng mới: đảo vuông, đáy khối nón, núi hai đỉnh, sông và cầu

Ngày: 2026-11-07 · Người đặt hàng: anh Kiệt · Người viết: Claude

## 1. Ý định và lý do

Anh Kiệt gửi bảng "Đảo văn phòng theo kiểu A — đề xuất cải thiện" (10 ý: viền bo tròn, outline 1 px, lớp đất nâu,
đáy khối nón, đá 3 sắc độ, thác nối hồ, cây thành cụm, lấp khoảng cỏ, cỏ ô caro nhẹ, đảo nhỏ và mây có outline) và nói
rõ điều anh muốn khác ảnh: **đảo hình vuông, văn phòng nằm giữa** (ảnh mẫu là hình chữ nhật dài).

Sau khi xem bản mẫu chạy bằng code thật (bản copy trong scratchpad), anh chọn **viền hẹp** (4 ô cỏ ở hai bên). Anh chưa
ưng đáy đảo hiện tại: một khối đá xám dựng đứng, đều và cứng, không giống đảo bay. Anh muốn sau văn phòng có **một ngọn
núi vừa**, từ núi có **thác nước tạo thành sông nối với vũng nước**, có **cầu cho nhân vật và thú đi qua**, nền trời có
**các đảo bay nhỏ (tượng trưng)**. Trong 8 thứ em đề xuất thêm, anh chọn **cả 8** (mục 6).

Mục tiêu là đảo đọc ra ngay là một "đảo bay ấm cúng": văn phòng là trung tâm, quanh nó là thiên nhiên có chuyển động
nhẹ, đổi theo ngày/đêm, mùa và thời tiết như game đã làm.

## 2. Mục tiêu, không làm, phản mục tiêu

**Mục tiêu**
- Mặt đảo vuông, văn phòng ở giữa (mục 3).
- Đáy đảo là một khối nón đất nâu, chóp thấp (mục 4).
- Núi hai đỉnh thấp sau văn phòng, thác → sông → cầu → hồ → thác đổ khỏi mép (mục 5).
- 8 thứ thêm của mục 6.
- Trang local (cổng 4317) và cảnh một đảo trong chế độ thế giới (IslandScene) cùng dùng đảo mới, vì cả hai mượn chung
  code vẽ.

**Không làm (đợt này)**
- Không đổi bên trong văn phòng, nhà vệ sinh, góc hút thuốc, pantry: vị trí tương đối với văn phòng giữ nguyên.
- Không đổi đảo đơn giản ở "Toàn cảnh" 8 đảo (`paintIsland` trong `web/world-ui.js`); anh vừa duyệt kiểu đó ở GĐ3.
- Không thêm nhân vật mới, không thêm loại hoạt động mới ngoài góc nghỉ bên hồ (mục 6.4).

**Phản mục tiêu (làm ra mà dính những điều này là hỏng, dù chạy đúng)**
- Văn phòng nhỏ hơn bản mẫu viền hẹp anh đã duyệt (`.superpowers/mockups/dao-vuong-hep-*.jpg`, cả đảo vừa khung): đó là
  cỡ chuẩn (mục 3.1).
- Rối mắt: thứ thêm vào giành sự chú ý của văn phòng, nhấp nháy, chuyển động nhanh.
- Chậm: khung hình bị tụt trên máy thường; mọi thứ tĩnh được nướng vào ảnh đảo như hôm nay, chỉ phần động vẽ mỗi khung.
- Nhân vật hay chó đi xuyên nước, xuyên núi, đứng giữa sông, kẹt không qua được sông.

## 3. Mặt đảo vuông

- Tâm đảo là tâm của cả khối văn phòng (văn phòng `W × H` = 27 × 14 cùng nhà vệ sinh và góc hút thuốc phía đông, tức
  `x` từ −1 tới `W + 10`, `y` từ −1 tới `H`).
- Hình "squircle" bậc 5 (góc bo tròn), bán kính sao cho hai bên có 4 ô cỏ; trục trước–sau cùng bán kính nên phía trước và
  phía sau văn phòng rộng khoảng 15 ô. Đây là bản anh đã duyệt (bản mẫu: `R = (W + 10) / 2 + 4`).
- Mép lồi lõm nhẹ bằng sóng dài (không có mấu 1 ô): như bản mẫu.
- Cỏ có ô caro rất nhẹ (2 sắc xanh gần nhau), mép cỏ rủ lượn sóng, dưới là lớp đất nâu 4 px, outline 1 px màu tím than
  (`#2b2350` trong bản phác) quanh viền ngoài đảo, không dùng đen.
- Quy ước hướng (dùng trong cả tài liệu): `x` tăng sang phải-xuống trên màn hình, `y` tăng sang trái-xuống. Văn phòng có
  hai bức tường ở `y = 0` (tường sau, chạy theo `x`) và `x = 0` (tường trái, chạy theo `y`).
  - **Phía sau** = `y < 0`: dải cỏ rộng khoảng 15 ô sau tường sau, nằm phía trên-phải màn hình. **Núi hai đỉnh** đặt ở đây,
    lệch về phía `x` nhỏ (gần góc trên màn hình), cách tường sau ít nhất 3 ô.
  - **Bên trái** = `x < 0`: dải cỏ hẹp khoảng 4 ô dọc tường trái, phía trái màn hình. **Sông** chảy ở dải này (rộng 2 ô,
    còn 1–2 ô bờ), từ chân núi xuống bãi trước. Không có lối đi dọc tường trái và không thêm cầu thang tây.
  - **Bên phải** = `x > W`: nhà vệ sinh, góc hút thuốc như hiện tại.
  - **Phía trước** = `y > H`: bãi cỏ rộng khoảng 15 ô, phía dưới-trái màn hình. **Hồ** ở phần trái của bãi này (cuối sông),
    **thác chính** đổ khỏi mép trước gần hồ.
### 3.1. Khung nhìn

- Cỡ văn phòng trên màn hình bằng bản mẫu viền hẹp anh đã duyệt (cả mặt đảo vừa khung, phần đáy được chạy ra ngoài cạnh dưới
  như hôm nay theo `FOCUS_UNDER`).
- Núi làm cảnh cao hơn: nếu đưa trọn núi vào khung làm văn phòng nhỏ hơn bản mẫu quá 10 %, phần đỉnh núi được phép chạy ra
  ngoài cạnh trên thay vì thu nhỏ văn phòng (em tự quyết). Zoom và kéo cảnh sẵn có vẫn dùng như cũ.
- Cảnh một đảo trong chế độ thế giới (IslandScene, `WorldLogic.fitOne`) theo cùng quy tắc.

- Cây cam (và cây theo mùa) mọc thành cụm 3–6 cây quanh vài tâm, không rải đều (như bản mẫu).

## 4. Đáy đảo: khối nón (kiểu B)

- Một khối nón đất nâu treo dưới toàn bộ mép trước, đỉnh nón (chóp) **thấp hơn bản phác B** (anh: "chóp hơi cao, thấp
  xuống tý"). Mốc: chiều sâu chóp tính từ mép cỏ khoảng bằng 1/3 bề rộng đảo trên màn hình, thay vì gần 1/2 như bản phác.
- Ba sắc độ theo hướng sáng isometric: mặt trái sáng, mặt phải tối, gờ ở góc trước sáng hơn, càng xuống đáy càng đậm.
- Vài gờ đá ngang và 1–2 tảng đá xám lộ ra gần chóp; không còn các dải đá xám dựng đứng như hiện tại.
- Rễ cây và dây leo thòng dưới mép (mục 6.6).
- Khung nhìn: phần đáy vẫn được phép chạy ra ngoài cạnh dưới như hôm nay (`FOCUS_UNDER`); không thu nhỏ văn phòng để
  thấy hết chóp.

## 5. Núi, thác, sông, cầu, hồ

- **Núi hai đỉnh thấp (kiểu C)** ở phía sau văn phòng: một đỉnh chính và một đỉnh phụ thấp hơn, đá xám ba sắc độ, chân núi
  phủ cỏ. "Vừa": đỉnh chính cao hơn mái tường sau văn phòng nhưng không che chữ, bubble hay nhân vật trong văn phòng.
- **Thác** chảy ra từ khe giữa hai đỉnh, rơi xuống chân núi, có bọt trắng ở chân.
- **Sông** từ chân thác chảy vòng qua bên trái văn phòng (phía tây) ra **hồ** ở bãi cỏ phía trước. Hồ hiện có (cạnh mép
  đông) được thay bằng hồ cuối sông; chỗ tắm/ngâm chân của nhân vật đi theo hồ mới.
- Từ hồ, nước đổ khỏi mép trước đảo thành **thác chính** như hôm nay, bọt trắng ở miệng, rơi xuống và tan thành sương
  (mục 6.1).
- **Cầu gỗ** bắc qua sông gần chỗ sông đổ vào hồ, nối bãi trước (phía văn phòng, đi từ cầu thang nam có sẵn) sang bờ bên kia
  sông. **Góc nghỉ** (mục 6.4) đặt ở bờ bên kia, cạnh hồ, nên người muốn ra ghế đá hay chỗ câu cá phải đi qua cầu. Có đèn
  lồng (mục 6.2). Không ai đi qua nước ở chỗ khác.
- Từ bờ bên kia, một lối cỏ dọc bờ sông dẫn lên **bãi sau** (chân núi). Bãi sau là cảnh và chỗ chó đi chơi; nhân vật không
  có điểm đến ở bãi sau (em tự quyết). Lối khác lên bãi sau: vòng qua phía đông sau nhà vệ sinh, nếu ô cỏ ở đó đi được.
- Nước có chuyển động nhẹ (gợn hoặc vệt sáng trôi), chậm.

## 6. Tám thứ thêm (anh chọn cả 8)

1. **Sương mây quanh chân đảo**: vài dải mây mỏng trôi chậm quanh khối nón; nơi thác chính rơi thì tan thành sương.
2. **Đèn**: đèn đường dọc lối đá, đèn lồng trên cầu; tối sáng vàng ấm, ngày tắt. Đi theo `dayFactor` như cửa sổ văn phòng.
3. **Chim và đom đóm**: ban ngày một đàn chim nhỏ thỉnh thoảng bay ngang trời; ban đêm đom đóm lập lòe quanh hồ và bụi
   cây.
4. **Góc nghỉ bên hồ**: ghế đá và một chỗ câu cá; thêm vào danh sách chỗ nhân vật rảnh rỗi đi tới (như pantry, hút thuốc,
   nhà vệ sinh); chó có thể nằm cạnh.
5. **Lấp khoảng cỏ**: bụi cây, nấm, đá, hoa mọc thành cụm ở bãi trước và bãi sau, không rải đều; đường đá bước nối văn
   phòng với hồ.
6. **Rễ cây và dây leo** thòng dưới mép đảo, dài ngắn khác nhau, đung đưa nhẹ khi có gió (thời tiết có gió/mưa).
7. **Núi đổi theo mùa và thời tiết**: mùa đông có tuyết trên hai đỉnh (theo hệ tuyết đang có); mưa thì thác chảy mạnh hơn;
   nắng sau mưa có cầu vồng ở thác chính một lúc.
8. **Đảo bay nhỏ ở nền**: 2–3 đảo nhỏ (mặt cỏ + chóp nón nhỏ, một cái có cây hoặc tảng đá) nhấp nhô chậm; xa thì nhỏ và
   mờ hơn; mây phía dưới che một phần chân thác.

## 7. Ràng buộc

- Code trang là các ES module trong `web/` (không bundler; Prettier 3.3.3, mỗi module ≤ 700 dòng, dòng ≤ 120 ký tự,
  `tests/web-style.test.mjs`). Chữ hiện ra đi qua `tr()` với đủ 7 ngôn ngữ (`tests/i18n.test.mjs`).
- Hình đảo là logic thuần trong `web/sky-logic.js` (`buildIsland`, `sceneFrame`, `lawnPaths`, `lawnWalk`, `canCross`),
  có test ở `tests/sky-logic.test.mjs`; vẽ đảo ở `web/sky-island.js`, `web/sky-mist.js`, `web/office-draw.js`. Mọi vị trí
  tính từ ô lưới, giống nhau trên mọi máy (hash theo vị trí, không ngẫu nhiên theo phiên).
- Phần tĩnh (mặt đảo, đáy, núi, cầu, đèn khi tắt) nướng một lần vào ảnh đảo theo độ phân giải và ánh sáng như cơ chế cache
  hiện có; phần động (nước, sương, chim, đom đóm, dây leo, đảo nhỏ nhấp nhô, ánh đèn) vẽ mỗi khung và rẻ: không cấp phát
  mỗi khung, số phần tử cố định nhỏ.
- `prefers-reduced-motion` (`env.reduced`): chuyển động giảm hoặc dừng như các hiệu ứng hiện có.
- Đường đi của nhân vật và chó: ô nước, ô núi, ô thân cầu (trừ mặt cầu) không đi được; cầu đi được. Chó (`DogLogic`,
  `DOG_PLACES`) không vào nước, núi.
- Nhà vệ sinh (`RestroomLogic.layout`) và góc hút thuốc (`SmokeLogic.layout`) đặt theo `outdoorSpots` tương đối với văn
  phòng: giữ nguyên.
- Trang local nhìn như cũ ở mọi thứ không thuộc đảo (header, bảng, bubble, panel).

## 8. Những gì đã quyết, như anh quyết

- Đảo vuông, văn phòng giữa, viền hẹp (bản mẫu `R = (W + 10) / 2 + 4`).
- Đáy kiểu B, chóp hạ thấp.
- Núi kiểu C (hai đỉnh thấp), sau văn phòng.
- Thác từ núi → sông → cầu (người + thú đi qua) → hồ; đảo bay nhỏ ở nền.
- Cả 8 thứ thêm ở mục 6.

## 9. Em tự quyết (anh xem lại khi đọc)

- Sông chảy **bên trái** (`x < 0`, dải 4 ô), vì bên phải đã có nhà vệ sinh và góc hút thuốc; không thêm cầu thang tây.
- Núi ở bãi sau (`y < 0`), lệch về góc trên màn hình.
- Cầu gần cửa sông vào hồ; góc nghỉ ở bờ bên kia nên cầu luôn được dùng; bãi sau chỉ là cảnh và chỗ chó chơi.
- Cỡ văn phòng chuẩn là bản mẫu viền hẹp; đỉnh núi được chạy ra cạnh trên nếu cần (mục 3.1).
- Hồ và thác chính ở **mép trước** như hôm nay; hồ cũ cạnh mép đông được thay bằng hồ cuối sông.
- Đảo đơn giản ở "Toàn cảnh" không đổi đợt này.
- Bên trong văn phòng giữ nguyên.

## 10. Để người làm quyết

- Toạ độ ô chính xác của núi, sông, cầu, hồ, góc nghỉ; độ rộng sông (gợi ý 2 ô); số và vị trí cụm cây/bụi/nấm.
- Bảng màu cụ thể trong khung đã nói (nâu đất cho đáy, xám ba sắc độ cho núi, outline tím than), miễn khớp bảng màu ngày/
  đêm hiện có (`night()`, `SNOW`).
- Cách vẽ nước, sương, chim, đom đóm, dây leo, cầu vồng (số khung, tốc độ), miễn chậm và nhẹ.
- Cách nhân vật dùng góc nghỉ (ngồi ghế, câu cá: thời lượng, tần suất) miễn hợp với cách các chỗ rảnh rỗi khác đang làm.

---

## 11. Bản 2 (2026-11-08, sau khi anh Kiệt xem bản dựng đầu)

Anh xem ảnh bản dựng đầu và yêu cầu: "phần chóp đáy làm pixel nhé, phần núi làm to hơn với dạng 2,5D anh thấy nó như 2D,
remove sông đi — xấu, trả lại hồ về vị trí 6h nhé". Về thác núi và cầu khi bỏ sông, anh chọn: **thác núi đổ vào một vũng
nhỏ ở chân núi, bỏ cầu, góc nghỉ dời ra cạnh hồ ở vị trí 6h.** Mục này thay các phần tương ứng ở mục 3–6; phần còn lại
giữ nguyên.

### 11.1. Bỏ sông và cầu

- Không còn sông chạy dọc dải trái, không còn cầu gỗ và hai đèn ở hai đầu cầu. Dải cỏ bên trái văn phòng trở lại là cỏ.
- Vì dải trái không còn chở sông, viền cỏ trở lại **4 ô** như bản mẫu anh duyệt (`SQUARE_MARGIN = 4`; lý do nới lên 5 ở bản 1
  không còn). Văn phòng to lại như bản mẫu.

### 11.2. Hồ ở vị trí 6h

- "6h" là góc dưới cùng của đảo trên màn hình (góc trước, nơi `x + y` lớn nhất), như hồ của đảo cũ trước kế hoạch này.
- Hồ tròn mềm (không mấu một ô), cạnh mép trước; **thác chính** đổ khỏi mép đảo ngay dưới hồ, thẳng xuống dưới góc 6h, có bọt
  và tan thành sương.
- **Góc nghỉ** (ghế đá, chỗ câu cá) ở bờ hồ phía trong đảo, đi tới bằng lối đá từ cầu thang nam; chó nằm cạnh như bản 1.
- Chỗ tắm của nhân vật và chỗ uống nước của chó ở bờ hồ này.

### 11.3. Núi to hơn, dạng 2,5D

- Anh thấy núi "như 2D": các mặt tam giác phẳng, viền mảnh, không có khối. Núi mới phải đọc ra **khối ba chiều nhìn
  isometric** như văn phòng và đảo: đỉnh chính và đỉnh phụ là các khối đá có **mặt trên sáng, mặt trái trung bình, mặt phải
  tối** (cùng hướng sáng với văn phòng), có **bậc/gờ đá** xếp tầng, vài tảng đá rời ở chân, cỏ phủ chân núi leo lên theo
  bậc, tuyết phủ mặt trên các bậc cao khi `env.snow`.
- **To hơn bản 1:** đỉnh chính cao khoảng gấp rưỡi bản 1 trên màn hình, chân núi rộng hơn (chiếm phần lớn bãi sau phía
  trái), đỉnh phụ thấp hơn rõ rệt; vẫn ở bãi sau (`y ≤ -3`) và không che chữ, bubble, nhân vật trong văn phòng.
- Khung nhìn: quy tắc mục 3.1 vẫn giữ (văn phòng không nhỏ đi quá 10 % vì núi); đỉnh núi được phép chạy ra ngoài cạnh trên.
- Vẽ bằng pixel art như phần còn lại (khối pixel, outline 1 px `#2b2350`, bảng màu xám đá ba sắc độ + rêu), không dùng
  polygon mượt có pha màu.

### 11.4. Thác núi đổ vào vũng nhỏ

- Thác chảy ra từ khe giữa hai đỉnh (như bản 1), rơi xuống một **vũng nhỏ** (khoảng 2×2 tới 3×3 ô) có viền đá ở chân núi,
  bọt trắng nơi thác chạm nước. Vũng không nối đi đâu.
- Nhân vật và chó không đi vào vũng; chó có thể uống ở mép vũng nếu tới được.

### 11.5. Đáy đảo dạng pixel

- Khối nón đáy (mục 4) giữ hình và độ sâu, nhưng **vẽ bằng pixel**: mép nón là bậc thang pixel (không có cạnh chéo mượt),
  các dải màu đất/đá chuyển bằng bậc và dither 2×2, gờ ngang và tảng đá là cụm pixel có outline, chóp nón kết thúc bằng vài
  khối đá nhỏ treo lơ lửng.
- Kích thước "pixel" của đáy bằng kích thước pixel của phần còn lại của cảnh ở cùng zoom (đáy không trông mịn hơn mặt đảo).

### 11.6. Những gì giữ nguyên từ bản 1

Đảo vuông, văn phòng giữa, outline, đất nâu, cỏ caro; sương, đèn dọc lối đá (trừ hai đèn cầu), chim, đom đóm, dây leo,
cầu vồng, cây theo mùa thành cụm, đảo bay nhỏ ở nền; góc nghỉ (dời chỗ); núi đổi theo mùa/thời tiết.

### 11.7. Hình đảo gần lục giác (bổ sung 2026-11-08)

- Anh Kiệt: "cho gần gần hình lục giác nhé, tránh tròn quá hoặc vuông quá". Mặt đảo trên màn hình là **lục giác**, góc bo
  nhẹ và mép lượn sóng nhẹ như bản 1 (không tròn như squircle, không vuông như hình thoi). Hướng đặt: **H1 — nhọn trên, nhọn dưới** (anh
  chọn): cắt hai góc trái, phải của hình thoi; còn mũi ở 6h, thác chính đổ đúng mũi đó.
- Văn phòng vẫn ở giữa; khoảng cỏ hẹp nhất quanh khối văn phòng vẫn khoảng 4 ô; hồ và thác chính ở 6h.

### 11.8. Hồ lớn có chùa một cột (bổ sung 2026-11-08)

- Anh Kiệt: "hồ cho bự ra + trang trí nhé (vịt, bèo, bóng cá, ...), tham khảo chùa Một Cột".
- **Hồ lớn hơn rõ rệt** so với bản 1 (khoảng gấp đôi diện tích), hình mềm, vẫn ở 6h và đổ thác chính khỏi mép.
- **Gian chùa nhỏ trên một cột** đứng giữa hồ, lấy cảm hứng từ chùa Một Cột (Hà Nội): một gian vuông nhỏ mái ngói cong hai
  tầng mái, đỡ trên một cột đá giữa nước, có bậc/cầu đá nhỏ dẫn ra từ bờ. Pixel art cùng phong cách và hướng sáng với văn
  phòng; về đêm có đèn lồng ấm. Là cảm hứng, không chép y nguyên công trình thật.
- **Trang trí mặt hồ:** lá sen và hoa sen (hồng, trắng) quanh chân cột, đám bèo trôi rất chậm, 2–3 con vịt bơi chậm và thỉnh
  thoảng lặn/ngoi, bóng cá tối mờ lượn dưới mặt nước, gợn nước khi vịt bơi. Ban đêm vịt ngủ (đứng yên, cúi đầu), đom đóm
  quanh sen. Mọi chuyển động chậm, không cấp phát mỗi khung.
- Góc nghỉ (ghế đá, câu cá) ở bờ hồ; chỗ tắm của nhân vật có thể bỏ nếu không hợp với hồ có chùa (người làm quyết, nói rõ
  trong báo cáo); chó uống nước ở bờ.
- Nhân vật không đi ra chùa (là cảnh), trừ khi có lối đá rõ ràng; đợt này để là cảnh.

### 11.9. Kiểu núi đã chọn (2026-11-08)

- Anh chọn **B — đỉnh nhọn có gờ đá**: hai đỉnh nhọn như núi thật, mặt đá tô pixel ba sắc độ (mặt trái vừa, mặt phải tối,
  mặt hướng lên sáng), cắt ngang bằng các **gờ đá dày có bóng ở dưới** để đọc ra khối, tuyết đọng trên các gờ cao và đỉnh,
  chân núi phủ cỏ leo lên theo gờ thấp. Viền tím than quanh khối núi. Không dùng khối hộp xếp tầng.

### 11.10. Núi tuyết pixel (bản C) — thay mục 11.3, 11.4, 11.9 (2026-11-08)

Anh Kiệt thấy núi bản 2 "còn đơn giản quá" và gửi mô tả chi tiết một ngọn núi tuyết pixel iso, lưu nguyên văn ở
`docs/specs/2026-11-08-mountain-c-brief.md` (toạ độ, gờ, tuyết, khe, thác, hồ chân núi, bảng màu, cây). Mô tả đó là chuẩn
cho núi; các quyết định sau thắng ở chỗ khác nguyên văn:

- **Một ngọn núi** (không còn hai đỉnh, không còn khe giữa hai đỉnh). Thác chảy trong khe đá trên mặt sáng, đổ vào **hồ chân
  núi** (elip rx 13, ry 6, viền đá) — thay vũng 2×2 của bản 2.
- **Cỡ: toạ độ trong mô tả nhân ×1,4** rồi mới vẽ thành pixel (vẫn 1 art px = 1 px logic của cảnh; không phóng to ảnh).
  Lý do: ô game là 32×16 px logic (`TW = 16` là nửa bề ngang), nên toạ độ gốc chỉ cho chân núi ~3,5×3,5 ô và đỉnh 70 px
  (~1,1 lần toà nhà cao 64 px); ×1,4 cho đỉnh ~98 px ≈ 1,5 lần toà nhà như mô tả muốn, chân núi ~5×5 ô.
- **Không có suối và không có thác thứ hai ở mép đảo** (anh chọn). Nước: tuyết tan → khe → thác → hồ chân núi, dừng ở đó.
  Thác chính duy nhất ở mép đảo là thác 6h dưới hồ vịt.
- **Màu viền `#3B2F4A` cho cả đảo** (thay `#2b2350` ở mọi nơi: mép đảo, đáy, chùa, cây, đá, đảo nhỏ trên trời).
- **Quầng mặt trời:** bỏ gradient, thay bằng 2 vòng tròn màu phẳng, độ trong suốt cố định; áp dụng mọi chế độ (local và thế
  giới).
- **Vẽ:** không dùng file PNG (server và hub chỉ phục vụ `.js`/`.css` trong `web/`); núi được vẽ một lần bằng code theo đúng
  toạ độ và bảng màu vào một canvas cache ở cỡ art pixel, rồi dùng như sprite tĩnh, sắp lớp theo góc trước F. Hồ chân núi và
  thác là lớp riêng để chuyển động: thác dịch pattern trắng 1 px mỗi ~120 ms, bọt hồ 2 khung ~300 ms.
- **Cỏ chân núi:** màu cỏ sườn của mô tả dùng trên sườn núi; chỗ chạm mặt cỏ đảo hoà về màu cỏ đảo để không thành vạt màu lạ.
- Cây quanh núi theo mục 5 của mô tả (2 cụm thông, bụi, nấm, hoa 1 px); xa hơn dùng cây thu sẵn có.
- Ô dưới chân núi và hồ chân núi không đi được; chó có thể uống ở mép hồ chân núi.

### 11.11. Đáy đảo: khối đá như cũ (2026-11-08, thay mục 11.5)

Anh Kiệt xem đáy nón pixel bằng đất và gửi lại ảnh đáy của đảo cũ: "chóp em thay bằng các khối đá như cũ á, oke hơn, dùng đất
nó cứ bẩn bẩn". Đáy đảo vẽ lại theo kiểu đảo cũ:

- Mỗi ô là một **cột đá xám** thả xuống (khối hộp iso: mặt trái sáng hơn, mặt phải tối hơn, các bậc đá xám lệch nhau như ảnh),
  chiều dài cột theo độ sâu nón (sâu ở giữa, ngắn dần ra mép) nên đáy vẫn thu lại thành chóp, nhưng bằng **bậc khối đá**.
- Chỉ còn **lớp đất nâu mỏng** ngay dưới mép cỏ (như ảnh), phần còn lại là đá xám; không dải đất lớn, không dither đất.
- Dây leo/rễ thòng dưới mép giữ nguyên; viền `#3B2F4A` theo mục 11.10. Vẫn nướng một lần như phần tĩnh khác.
- Tham khảo cách vẽ của đảo cũ: `git show 28c466c:web/sky-island.js` (`renderIsland`, phần underside và `BANDS`), bỏ các dải
  đất nâu dày của nó.
