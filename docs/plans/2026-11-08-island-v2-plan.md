# Đảo văn phòng bản 2 — kế hoạch triển khai

> **Cho agent thực hiện:** BẮT BUỘC dùng superpowers:subagent-driven-development (khuyến nghị) hoặc
> superpowers:executing-plans để làm theo từng task. Các bước dùng checkbox (`- [ ]`).

**Mục tiêu:** đảo lục giác (nhọn trên, nhọn dưới), bỏ sông và cầu, hồ lớn ở 6h có chùa một cột, sen, bèo, vịt, bóng cá;
núi to hơn dạng 2,5D đỉnh nhọn có gờ đá, thác núi đổ vào vũng nhỏ; đáy nón vẽ pixel.

**Kiến trúc:** giữ kiến trúc bản 1 — dữ liệu đảo thuần trong `web/island-land.js` (dựng một lần, theo hash ô lưới), phần tĩnh
nướng trong `renderIsland` (`web/sky-island.js` + `web/island-art.js`), vật cao cần xếp lớp với người là sprite sắp theo
chiều sâu như cây (cách Task 7 bản 1 đã làm cho cầu, đèn, ghế), phần động trong `web/island-life.js`.

**Công nghệ:** ES module thuần trong `web/`, Canvas 2D, `node --test`.

**Spec:** `docs/specs/2026-11-07-island-reshape-design.md` — **mục 11 (Bản 2)** là phần cần làm; nó thay các mục 3–6 ở
chỗ mâu thuẫn. Kế hoạch bản 1: `docs/plans/2026-11-07-island-reshape-plan.md` (đã xong; đọc phần "Ràng buộc chung").

## Ràng buộc chung

- Mọi ràng buộc chung của kế hoạch bản 1 vẫn áp dụng (module ≤ 700 dòng, dòng ≤ 120 ký tự, Prettier 3.3.3, i18n 7 ngôn ngữ,
  hash theo ô, không cấp phát mỗi khung, `env.reduced`, outline `#2b2350`, không đụng cổng 4317 / `~/.claude-terrarium` /
  `~/.claude/sessions`, dừng tiến trình theo PID).
- Mặt đảo lục giác **H1**: hình vuông theo ô (`|dx| ≤ R`, `|dy| ≤ R` quanh tâm khối văn phòng) cắt bởi `|dx − dy| ≤ K`
  (cắt hai góc trái, phải trên màn hình), mép bo nhẹ và lượn sóng nhẹ như bản 1; mũi trên và mũi dưới (6h) còn nguyên.
  `R`, `K` chọn sao cho khoảng cỏ hẹp nhất quanh khối văn phòng (`x` −1…`W`+10, `y` −1…`H`) khoảng 4 ô.
- Không còn sông, cầu, hai đèn đầu cầu.
- Hồ ở mũi 6h, diện tích khoảng gấp đôi hồ bản 1, thác chính đổ đúng mũi 6h.
- Núi kiểu **B**: hai đỉnh nhọn, đỉnh chính cao khoảng 1,5 lần bản 1 trên màn hình, gờ đá dày có bóng dưới, tuyết trên gờ cao
  theo `env.snow`; quy tắc khung 10 % của bản 1 vẫn giữ (đỉnh được chạy ra cạnh trên).
- Đáy nón: cùng hình, vẽ bằng pixel (mép bậc thang, dải màu chuyển bằng bậc + dither 2×2, gờ và tảng đá là cụm pixel có
  outline, vài khối đá nhỏ treo ở chóp).

## Trọng tâm review

1. Đi lại: mọi đích ngoài trời tới được; không ai vào hồ, vũng, núi; góc nghỉ bờ hồ tới được → test Task A.
2. Xếp lớp: chùa, cột, đèn, ghế vs người và chó; vịt và bóng cá không vẽ đè lên bờ → Task B/C và Task D kiểm.
3. Cỡ văn phòng không nhỏ đi so với bản mẫu viền 4 ô quá 10 % (núi cao hơn) → test Task B.
4. Chi phí khung: vịt, cá, bèo, gợn nước không cấp phát mỗi khung → đo Task C và D.
5. Chế độ thế giới (IslandScene mượn method; `tests/island-scene-methods.test.mjs`) → Task D.

## Bản đồ file

| File | Việc | Task |
|---|---|---|
| `web/island-land.js` (+ module mới nếu vượt 700 dòng) | hình lục giác, bỏ sông/cầu, hồ 6h, chùa, sen/bèo/làn vịt, núi to, vũng, góc nghỉ, đường, đèn | A |
| `web/office-scene.js`, `web/dog-logic.js`, `tests/*` | đích nhân vật, chó, chỗ uống | A |
| `web/island-art.js`, `web/sky-island.js`, `web/sky-logic.js` (`sceneFrame`), `web/office-draw.js` (sprite sắp lớp) | đáy pixel, núi 2,5D, vũng, hồ, sen, chùa | B |
| `web/island-life.js` | nước hồ và vũng, thác núi vào vũng, thác chính 6h, vịt, cá, bèo, gợn, đèn chùa, đom đóm quanh sen | C |
| `CHANGELOG.md`, `README.md` | tài liệu | D |

Song song: A trước; B và C song song sau A; D cuối.

---

### Task A [logic]: Dữ liệu đảo bản 2

**Interfaces (Produces, thay/thêm vào kết quả `buildIsland`):**
- Bỏ `river`, `bridge`. Giữ `pond` (hồ 6h: `{cells, spots}`), `waterfall` (ô mũi 6h).
- `pavilion: {x, y, pillar: {x, y}, path: [{x, y}, ...]}` — gian chùa trên một cột ở giữa hồ; `path` là các ô đá bước từ bờ
  ra tới cột (là cảnh, không đi được, trừ khi người làm quyết khác và ghi rõ).
- `lotus: [{x, y, flower: 'pink' | 'white' | null}]`, `duckweed: [{x, y}]` — trên ô hồ, không trùng chùa/đường đá.
- `ducks: {lanes: [[[x, y], ...], ...]}` — 2–3 làn bơi khép kín trong hồ, tránh chùa, sen dày.
- `mountain: {cells, peaks: [{x, y, h, main}], gap: {x, y}, pool: {cells, rim: [...]}}` — đỉnh chính `h` khoảng 1,5 lần bản 1;
  `pool` 2×2…3×3 ô ở chân thác.
- `rest: {bench, fish}` ở bờ hồ phía trong đảo; `lamps` dọc lối đá (không còn đèn cầu).
- `shape: {cx, cy, R, K}`.

- [ ] **Bước 1: Test hỏng** (`tests/island-land.test.mjs`, viết lại test bản 1 không còn đúng):
  - `the island is a hexagon pointing up and down`: hàng ô theo `x + y` nhỏ nhất và lớn nhất mỗi hàng chỉ 1–3 ô (mũi), hai
    cạnh trái/phải có đoạn thẳng đứng trên màn hình (tập ô cùng `x − y` cực trị dài ≥ 6 ô); không mấu một ô.
  - `the narrowest lawn around the office block is about four tiles`: khoảng cách nhỏ nhất từ khối văn phòng tới bờ trong
    `[3, 5]` ô.
  - `there is no river or bridge`: `island.river`, `island.bridge` không tồn tại; không ô nước nào ngoài hồ và vũng.
  - `the lake sits at the bottom point and feeds the main fall there`: ô có `x + y` lớn nhất của đảo cách hồ ≤ 2 ô;
    `waterfall` là ô mũi; diện tích hồ ≥ 2× hồ bản 1 (số ô bản 1 ghi trong test).
  - `the pavilion stands on one pillar inside the lake`: `pillar` là ô hồ, cách bờ ≥ 2 ô; `path` nối bờ tới cạnh cột.
  - `lotus, duckweed and duck lanes stay on open water`.
  - `the mountain has two pointed peaks, the main one about half again as tall as before, and a pool at the foot of the fall`.
  - `everything outdoors is reachable and nobody walks into water or the mountain` (dùng `lawnWalk` như bản 1, cả chó).
- [ ] **Bước 2:** chạy → FAIL. **Bước 3:** cài đặt. **Bước 4:** `node --test tests/*.test.mjs` → PASS (sửa test bản 1 gắn
  với sông/cầu; không xoá im lặng, ghi trong báo cáo). Nếu phần vẽ hiện tại hỏng vì thiếu `river`/`bridge`, cho nó không vẽ gì
  ở đó (Task B vẽ lại).
- [ ] **Bước 5: Commit** `feat: a hexagon island with a big lake at the bottom point, a pavilion, and a pool under the mountain`

### Task B [ui]: Vẽ tĩnh bản 2

- Đáy nón pixel (Ràng buộc chung). Núi kiểu B 2,5D theo spec 11.3 và 11.9, to hơn; vũng đá ở chân thác; hồ lớn bờ đá mềm;
  lá sen, hoa sen (tĩnh); chùa một cột (cột đá, gian vuông, hai tầng mái cong, lan can nhỏ) là sprite sắp lớp như cây; lối đá
  bước ra chùa; bỏ vẽ sông, cầu.
- `sceneFrame`: test `the bigger mountain never shrinks the office by more than 10%` (như bản 1, so với khung không núi).
- Chụp 1280×800 ngày/đêm/tuyết, cận núi, cận hồ, cận đáy (deviceScaleFactor 2).
- **Commit** `feat: a pixel cone, a 2.5D mountain with ledges, and a lake with a one-pillar pavilion`

### Task C [ui]: Chuyển động bản 2

- Bỏ nước sông. Nước hồ và vũng gợn chậm; thác núi từ `mountain.gap` đổ vào `pool` có bọt; thác chính ở mũi 6h có bọt, sương.
- Vịt: 2–3 con bơi theo `ducks.lanes`, chậm, thỉnh thoảng lặn/ngoi; gợn sau lưng; ban đêm (`df < 0.3`) đứng yên cúi đầu.
- Bóng cá: 3–4 bóng mờ lượn dưới mặt nước, không ra khỏi hồ, không lên trên lá sen.
- Bèo trôi rất chậm quanh vị trí gốc. Đèn lồng chùa sáng theo `lampGlow`. Đom đóm quanh sen ban đêm.
- Logic thuần có test (`tests/island-life.test.mjs`): vị trí vịt luôn trên ô hồ; cá không ra khỏi hồ; ban đêm vịt không di
  chuyển; mảng dùng lại giữa các lần gọi.
- Đo khung hình trước/sau (≤ 1 ms thêm).
- **Commit** `feat: ducks, fish, drifting duckweed and the falls on the new lake and pool`

### Task D [all]: Soi UI/UX bằng Chrome, sửa, tài liệu

- Soi ở 1280×800, 1440×900, 390×844; ngày/đêm/mưa/tuyết/sương; zoom, kéo; chế độ thế giới (một đảo, Toàn cảnh). Sửa mọi
  lỗi thấy được (xếp lớp, vật lơ lửng, lệch, cắt mép, rối mắt, chớp). Đo khung hình; chạy 10 phút với 8 phiên giả rảnh rỗi.
- CHANGELOG `[Unreleased]` (mô tả bản 2, bỏ mô tả sông/cầu), README nếu cần.
- **Commit** `polish: ...` / `docs: ...`
