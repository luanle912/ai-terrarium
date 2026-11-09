# Đảo văn phòng mới — kế hoạch triển khai

> **Cho agent thực hiện:** BẮT BUỘC dùng superpowers:subagent-driven-development (khuyến nghị) hoặc
> superpowers:executing-plans để làm theo từng task. Các bước dùng checkbox (`- [ ]`).

**Mục tiêu:** đảo văn phòng thành đảo vuông, văn phòng ở giữa, đáy khối nón, núi hai đỉnh phía sau, thác → sông → cầu → hồ →
thác chính, cùng 8 thứ thêm của spec mục 6.

**Kiến trúc:** dữ liệu đảo (ô cỏ, độ sâu đáy, núi, sông, hồ, cầu, góc nghỉ, đèn, cây) là logic thuần, tính một lần từ lưới,
giống nhau trên mọi máy; chuyển `buildIsland` sang module mới `web/island-land.js` (vì `web/sky-logic.js` đã 681/700 dòng),
`SkyLogic` re-export như cũ. Phần tĩnh nướng vào ảnh đảo (`renderIsland`, cache theo `k`, ánh sáng, tuyết như hiện tại);
phần động vẽ mỗi khung trong module mới `web/island-life.js`. Đi lại dùng `lawnWalk`/`canCross`/`cheapestPath` sẵn có với
ô nước bị chặn, trừ mặt cầu.

**Công nghệ:** ES module thuần trong `web/` (React UMD, Canvas 2D, không bundler), Node ≥ 22 cho test (`node --test`).

**Spec:** `docs/specs/2026-11-07-island-reshape-design.md`

## Ràng buộc chung

- Mỗi module `web/` ≤ 700 dòng, dòng ≤ 120 ký tự, chạy `npx --yes prettier@3.3.3 --write web` sau khi sửa
  (`tests/web-style.test.mjs`). Module mới phải được import trong `web/main.js` đúng thứ tự (trước module dùng nó).
- Chữ hiện ra đi qua `tr()`, đủ 7 ngôn ngữ (vi en ja ko zh es th) trong `web/i18n/<lang>.js`; `tests/i18n.test.mjs` hỏng nếu
  thiếu hoặc thừa khoá.
- Mọi vị trí tính từ ô lưới và `hash(x, y, seed)` (không `Math.random` khi dựng đảo): đảo giống hệt nhau trên mọi máy.
- Hình đảo: squircle bậc 5, tâm `((W + 10) / 2, H / 2)`, bán kính `R = (W + 10) / 2 + 4` (bản mẫu anh duyệt), sóng mép
  `0.035·sin(3a + 0.6) + 0.025·sin(5a + 2.1) + 0.015·sin(7a + 4.0)`. `W = 27`, `H = 14`.
- Outline đảo 1 px màu `#2b2350` (tím than, không đen); lớp đất nâu 4 px dưới mép cỏ.
- Chóp nón sâu khoảng 1/3 bề rộng mặt đảo trên màn hình (tính bằng px, `TW = 16`, `TH = 8`).
- Sông rộng 2 ô, ở dải `x < 0`; núi ở `y ≤ -3`; hồ ở `y > H`; không thêm cầu thang tây.
- Cỡ văn phòng: núi không được làm văn phòng nhỏ đi quá 10 % so với khung khi không có núi (spec 3.1).
- Phần động không cấp phát mỗi khung, số phần tử cố định; tôn trọng `env.reduced` như các hiệu ứng hiện có.
- Nhà vệ sinh, góc hút thuốc, bên trong văn phòng không đổi; đảo đơn giản ở "Toàn cảnh" (`paintIsland`) không đổi.
- Không bao giờ đụng cổng 4317, `~/.claude-terrarium`, `~/.claude/sessions`; tiến trình chỉ dừng theo PID.

## Trọng tâm review

1. Nhân vật/chó kẹt hoặc đi xuyên nước: mọi đích ngoài trời (hồ, góc nghỉ, góc hút thuốc, cầu thang) phải có đường; chỉ
   qua sông bằng cầu → test ở Task 2.
2. Văn phòng nhỏ đi vì núi hoặc đảo to: khung giữ cỡ (≤ 10 %) → test ở Task 3.
3. Khung hình tụt: phần động thêm chi phí mỗi khung → đo ở Task 4 và Task 7.
4. Trang trí đè lên đường, cầu, sông, góc nghỉ, đèn → test ở Task 2.
5. Cảnh một đảo trong chế độ thế giới (IslandScene mượn code vẽ) lệch hoặc lỗi → kiểm ở Task 7.

## Bản đồ file

| File | Việc | Task |
|---|---|---|
| `web/island-land.js` (mới) | `IslandLand.buildIsland`: hình đảo, độ sâu nón, núi, sông, hồ, cầu, góc nghỉ, đèn, cụm trang trí | 1, 2 |
| `web/sky-logic.js` | bỏ `buildIsland`/`ANNEX_LAND` sang module mới, re-export; `lawnPaths`, `lawnWalk`, `sceneFrame` | 1, 2, 3 |
| `web/sky-island.js` | `renderIsland`: đáy nón, outline, đất, caro, núi, sông, cầu, đèn tắt, bụi/nấm | 3 |
| `web/island-life.js` (mới) | nước chảy, hai thác, sương, đèn sáng, chim, đom đóm, dây leo, cầu vồng | 4 |
| `web/sky-mist.js`, `web/sky-render.js` | đảo bay nhỏ ở nền | 5 |
| `web/office-scene.js`, `web/office-draw-people.js`, `web/dog-logic.js` | góc nghỉ: chỗ ngồi, câu cá, chó | 6 |
| `tests/sky-logic.test.mjs`, `tests/island-land.test.mjs` (mới), `tests/island-life.test.mjs` (mới) | test | 1–6 |
| `CHANGELOG.md`, `README.md` | tài liệu | 7 |

Song song: Task 5 chạy từ đầu. Task 1 → Task 2. Sau Task 2: Task 3, 4, 6 song song. Task 7 cuối.

---

### Task 1 [logic]: Đảo vuông và đáy khối nón

**Files:** tạo `web/island-land.js`, `tests/island-land.test.mjs`; sửa `web/sky-logic.js`, `web/main.js`,
`tests/sky-logic.test.mjs`.

**Interfaces:**
- Produces: `IslandLand = { buildIsland, SQUARE_MARGIN: 4, SQUIRCLE_P: 5, centre(W, H) => {cx, cy, R} }`.
  `buildIsland({W, H})` trả về các trường hiện có (`cells`, `list` `[{x, y, shore, d}]`, `depth`, `bounds`, `spots`,
  `decor`, `waterfall`, `pond`, `paths`) cộng `shape: {cx, cy, R}`. `SkyLogic.buildIsland` là cùng hàm.
- `d` (px) theo nón: sâu nhất gần tâm, giảm đều ra mép.

- [ ] **Bước 1: Test hỏng** trong `tests/island-land.test.mjs`:
  - `the island is a square centred on the office block`: `|(maxX-minX) - (maxY-minY)| <= 2`; tâm bounds cách
    `((W+10)/2, H/2)` ≤ 1 ô; số ô cỏ trái văn phòng ở hàng `y = 7` (ô `x < -1`) trong `[3, 5]`.
  - `the island contains the whole office block`: mọi ô `x ∈ [-1, W+10]`, `y ∈ [-1, H]` thuộc `cells`.
  - `the underside is one cone with its tip near the middle`: ô có `d` lớn nhất cách `(cx, cy)` ≤ 3 ô;
    `maxD / islandScreenWidth` trong `[0.28, 0.38]`, với `islandScreenWidth = ((maxX - minY) - (minX - maxY)) * 16`.
  - `the cone falls off outward without steps`: với mọi ô và hàng xóm xa tâm hơn, `d(hàng xóm) <= d(ô) + 2`.
  - Giữ (chuyển từ sky-logic): `island is deterministic`, `shore has no one-tile spikes or notches`.
- [ ] **Bước 2: Chạy, xác nhận hỏng:** `node --test tests/island-land.test.mjs` → FAIL.
- [ ] **Bước 3: Cài đặt.** Chuyển `buildIsland`, `ANNEX_LAND`, `annexLand`, `outdoorSpots` sang `web/island-land.js`; hình
  theo Ràng buộc chung; `d = 8 + (maxD - 8) * (1 - n) ** 1.6 + hash(x, y, 1) * 4` với `n` khoảng cách squircle chuẩn hoá
  (0 ở tâm, 1 ở mép). `sky-logic.js` import và re-export (`SkyLogic.buildIsland`, `outdoorSpots`, `annexLand`).
- [ ] **Bước 4: Sửa test cũ** trong `tests/sky-logic.test.mjs` gắn với hình cũ: bỏ `lawn is 6 tiles wide in front and a thin
  2-tile strip behind the walls`, `the island defaults to the approved lawn widths`, `underside is deepest inside`,
  `the added land joins the island and never widens the scene frame`, `scene frame fits the island and keeps the office near
  63%`, `the camera frames the island top...`; ghi lý do trong report. Các test hồ/thác/đường sẽ viết lại ở Task 2 (tạm
  `skip` với lý do `Task 2`).
- [ ] **Bước 5:** `node --test tests/*.test.mjs` → PASS. Kiểm bằng mắt trang local (fake server, xem Task 7) không lỗi.
- [ ] **Bước 6: Commit** `feat: the office island is a square around the office with a cone underneath`

### Task 2 [logic]: Núi, sông, hồ, cầu, góc nghỉ, đèn, cụm trang trí, đường đi

**Files:** sửa `web/island-land.js`, `web/sky-logic.js` (`lawnPaths`, `lawnWalk`), `web/office-scene.js` (`DOG_ROAM`
không còn tránh hồ cũ), `tests/island-land.test.mjs`, `tests/sky-logic.test.mjs`.

**Interfaces:**
- Consumes: Task 1.
- Produces, thêm vào kết quả `buildIsland`:
  - `mountain: {cells: Set<'x,y'>, peaks: [{x, y, h, main}], gap: {x, y}}` — 2 đỉnh, `main` cao hơn; `h` px.
  - `river: {cells: Set, line: [[x, y], ...]}` — `line` là tâm dòng, từ chân thác núi tới hồ.
  - `pond: {cells: Set, spots: [{x, y}]}` — hồ cuối sông (thay hồ cũ), 2 chỗ tắm.
  - `waterfall: {x, y}` — ô bờ trước cạnh hồ (thác chính).
  - `bridge: {cells: Set, x, y, dir: 'x' | 'y', len}` — mặt cầu, đi được.
  - `rest: {bench: {x, y}, fish: {x, y}}` — bờ bên kia sông, cạnh hồ.
  - `lamps: [{x, y}]` — dọc đường đá, một đèn mỗi đầu cầu.
  - `decor` kind thêm `'bush'`, `'mushroom'` (cùng `'tree'`, `'rock'`, `'flower'`).
- `lawnWalk(island, W, H)` chặn ô núi, ô sông (trừ `bridge.cells`), ô hồ (trừ chỗ tắm), trang trí trừ hoa.
- `lawnPaths` có thêm chân đường từ cầu thang nam tới đầu cầu và qua cầu tới góc nghỉ.

- [ ] **Bước 1: Test hỏng:**
  - `the mountain stands on the back lawn with two peaks`: mọi ô núi `y <= -3`; 2 đỉnh, đúng một `main`, `main.h > phụ.h`;
    `gap` nằm giữa hai đỉnh.
  - `the river runs from the mountain gap down the left strip into the lake`: ô sông liên thông 4 hướng; ô đầu kề `gap`
    (≤ 2 ô); ô cuối kề hồ; mọi ô sông có `x < 0` hoặc `y > H`; bề ngang 2 ô.
  - `the lake is on the front lawn and feeds the main waterfall on the front shore`: ô hồ `y > H`; `waterfall` là ô bờ (không
    có ô `(x, y + 1)` hoặc `(x + 1, y)`) kề hồ.
  - `the only way across the river is the bridge`: BFS trên `lawnWalk` từ chân cầu thang nam tới `rest.bench` tìm thấy và đi
    qua ít nhất một ô `bridge.cells`; bỏ `bridge.cells` khỏi tập đi được → không tới.
  - `the back lawn is reachable on foot`: BFS từ chân cầu thang nam tới một ô `y <= -3` không thuộc núi tìm thấy.
  - `trees grow in clumps`: mọi `tree` có ≥ 2 `tree` khác trong bán kính 2 ô.
  - `decor keeps off paths, the bridge, water, the mountain, the rest corner and the lamps`.
  - Viết lại các test hồ/thác/đường đã `skip` ở Task 1 cho bố cục mới (chỗ tắm, đường đá nối cầu thang với hồ và cầu).
- [ ] **Bước 2:** chạy → FAIL.
- [ ] **Bước 3: Cài đặt** theo Interfaces; toạ độ cụ thể người làm chọn trong khung spec mục 3 và 5.
- [ ] **Bước 4:** `node --test tests/*.test.mjs` → PASS (kể cả `tests/dog-logic*`, người đi đường ngoài trời).
- [ ] **Bước 5: Commit** `feat: a two-peak mountain, a river with a bridge, the lake and a rest corner on the island`

### Task 3 [ui]: Vẽ phần tĩnh và khung nhìn

**Files:** sửa `web/sky-island.js` (`renderIsland`), `web/sky-logic.js` (`sceneFrame`), `tests/sky-logic.test.mjs`.

**Interfaces:**
- Consumes: Task 2 (dữ liệu đảo).
- `sceneFrame(island, opts)` tính cả đỉnh núi (`mountain.peaks[].h`); khi `island.mountain` là `null` thì như không núi
  (test dùng để so).

- [ ] **Bước 1: Test hỏng** `the mountain never shrinks the office by more than 10%`: với khung 1280×720,
  `min(1280/LW, 720/FH)` có núi ≥ 0.9 × giá trị không núi. Nếu không đạt, `FH` được phép bỏ phần đỉnh núi vượt (spec 3.1).
- [ ] **Bước 2:** chạy → FAIL (chưa tính núi).
- [ ] **Bước 3: Vẽ trong `renderIsland`:** đáy nón ba sắc độ (trái sáng, phải tối, gờ trước sáng, càng sâu càng đậm), vài gờ
  ngang và 1–2 tảng đá xám gần chóp, bỏ các dải xám dựng đứng (`BANDS`); lớp đất nâu 4 px; outline 1 px `#2b2350`; cỏ caro 2
  sắc gần nhau; mép cỏ rủ lượn sóng; núi đá xám ba sắc độ, chân phủ cỏ, đỉnh trắng theo `env.snow`; lòng sông và hồ (màu nền
  nước); cầu gỗ (ván, lan can, móc đèn); cột đèn (tắt); bụi, nấm; ghế đá ở `rest.bench` (Task 6 chỉ vẽ người và cần câu).
  Mọi màu qua `night()`.
- [ ] **Bước 4:** `node --test tests/*.test.mjs` → PASS; chụp trang local 1280×800 ngày/đêm, tuyết (`__sky.preview('snow')`),
  390×844 → lưu `scratchpad/i3/`.
- [ ] **Bước 5: Commit** `feat: the cone underside, the mountain, river and bridge drawn on the island`

### Task 4 [ui]: Phần động: nước, thác, sương, đèn, chim, đom đóm, dây leo, cầu vồng

**Files:** tạo `web/island-life.js`, `tests/island-life.test.mjs`; sửa `web/office-draw.js` (chỗ gọi `drawPond` /
`drawWaterfall` ~dòng 147), `web/main.js`.

**Interfaces:**
- Consumes: Task 2 dữ liệu; `env` `{df, fx, reduced, snow}` như hiện có.
- Produces (`IslandLife`, DOM-free phần logic):
  - `lampGlow(df) => 0..1` — 0 khi `df >= 0.8`, 1 khi `df <= 0.2`, tuyến tính giữa.
  - `fallFlow(fx) => 1..2` — `1 + fx.rain` (cắt ở 2): thác và sông mạnh hơn khi mưa.
  - `rainbowLevel({fx, df, lastRainAt, now}) => 0..1` — `lastRainAt` là lần cuối `fx.rain > 0.3` (do `drawLife` ghi lại);
    > 0 chỉ khi `df > 0.6`, `fx.rain < 0.1` và `now - lastRainAt < 180000`, giảm tuyến tính về 0 sau 3 phút.
  - `creatures(t, df, seed) => {birds: [...], flies: [...]}` — chim khi `df > 0.6` (một đàn 3–5 con bay ngang, cách nhau
    40–90 s), đom đóm khi `df < 0.3` (8 con quanh hồ và bụi). Mảng dùng lại, không cấp phát mỗi khung.
  - `drawLife(ctx, island, PG, t, env)` — vẽ: nước sông/hồ trôi, thác núi và thác chính có bọt, sương quanh chóp nón và chân
    thác chính, ánh đèn, chim, đom đóm, dây leo đung đưa theo gió (`fx.rain`, `fx.storm`), cầu vồng.
- `env.reduced`: không chim, đom đóm đứng yên, nước không trôi.

- [ ] **Bước 1: Test hỏng** cho `lampGlow`, `fallFlow`, `rainbowLevel` (tạnh 30 s trước, ban ngày → > 0; đang mưa → 0;
  đêm → 0; tạnh 181 s trước → 0), `creatures` (ngày có chim không đom đóm; đêm ngược lại; gọi 2 lần trả cùng mảng).
- [ ] **Bước 2:** chạy → FAIL.
- [ ] **Bước 3: Cài đặt**, thay `drawPond`/`drawWaterfall` bằng `IslandLife.drawLife` trong `office-draw.js`.
- [ ] **Bước 4: Đo:** thời gian khung trung bình trên trang local trước/sau (Chrome headless, 10 s) → chênh ≤ 1 ms; ghi số.
- [ ] **Bước 5:** `node --test tests/*.test.mjs` → PASS; chụp đêm (đèn, đom đóm), ngày (chim), mưa → nắng (cầu vồng).
- [ ] **Bước 6: Commit** `feat: flowing water, falls, mist, lamps, birds, fireflies, vines and a rainbow on the island`

### Task 5 [ui]: Đảo bay nhỏ ở nền

**Files:** sửa `web/sky-mist.js` (`farIsland`), `web/sky-render.js` (chỗ gọi ~dòng 107), `tests/sky-logic.test.mjs` nếu có
logic thuần.

**Interfaces:** `farIsland(ctx, x, y, sc, col, kind)` với `kind` `'tree' | 'rock' | 'plain'`: mặt cỏ vuông (hình thoi) có
outline, đất nâu, một chóp nón nhỏ, cây hoặc đá trên mặt; màu pha `col.haze` theo độ xa. 2–3 đảo, nhấp nhô ±1.5 px chậm
như hiện có; đảo xa hơn nhỏ và mờ hơn.

- [ ] **Bước 1:** chụp trước (ngày, đêm).
- [ ] **Bước 2: Cài đặt.**
- [ ] **Bước 3:** chụp sau; `node --test tests/*.test.mjs` → PASS.
- [ ] **Bước 4: Commit** `feat: small floating islands in the sky behind the office island`

### Task 6 [ui]: Góc nghỉ bên hồ

**Files:** sửa `web/office-scene.js` (`IDLE_SPOTS`, `ACT_TXT`, `DOG_PLACES`), `web/office-draw-people.js` (dáng ngồi ghế
đá, cầm cần câu; cần câu vẽ cùng người, ghế đá do Task 3 vẽ), `web/i18n/*.js`,
`tests/sky-logic.test.mjs` hoặc test người.

**Interfaces:**
- Consumes: `island.rest`, `bridge` (Task 2).
- `IDLE_SPOTS` thêm `{act: 'bench', tile: [rest.bench.x, rest.bench.y], ...}` và `{act: 'fish', tile: [rest.fish...]}`.
- `ACT_TXT` khoá mới `office.act.bench`, `office.act.fish` (7 ngôn ngữ).
- Chó: một chỗ nằm cạnh ghế (`DOG_PLACES.rest`), dùng như `den` khi có người ngồi.

- [ ] **Bước 1: Test hỏng** `an agent going to the rest corner crosses the bridge`: `cheapestPath` trên `LAWN_WALK` từ chân
  cầu thang nam tới `rest.bench` có ô cầu.
- [ ] **Bước 2:** chạy → FAIL.
- [ ] **Bước 3: Cài đặt**, thời lượng và tần suất như các chỗ rảnh rỗi ngoài trời khác (hút thuốc, tắm).
- [ ] **Bước 4:** chụp người ngồi ghế, câu cá, chó nằm cạnh (ngày, đêm); `node --test tests/*.test.mjs` → PASS.
- [ ] **Bước 5: Commit** `feat: a rest corner by the lake: a stone bench and a fishing spot`

### Task 7 [all]: Kiểm tổng, chế độ thế giới, tài liệu

**Files:** `CHANGELOG.md` (`[Unreleased]` Added/Changed), `README.md` (ảnh hoặc mô tả đảo nếu có).

- [ ] **Bước 1:** Trang local (fake server `scratchpad/m1/fake.mjs ... local` phục vụ `web/` của worktree) 1280×800 và
  390×844, ngày/đêm/mưa/tuyết: ảnh chụp đặt cạnh bản mẫu anh duyệt; không lỗi console.
- [ ] **Bước 2:** Chế độ thế giới (fake hub `scratchpad/t17/hub17.mjs`): mở một đảo (IslandScene) → cùng đảo mới, đúng tỉ lệ,
  không lỗi; "Toàn cảnh" không đổi.
- [ ] **Bước 3:** Đo thời gian khung trang local và cảnh một đảo trước/sau toàn bộ (≤ 1.5 ms chênh).
- [ ] **Bước 4:** Đi bộ: để trang chạy 10 phút với 8 phiên giả rảnh rỗi → không ai đứng trong nước/núi, có người qua cầu
  tới góc nghỉ, chó lên được bãi sau.
- [ ] **Bước 5:** CHANGELOG, README; `node --test tests/*.test.mjs` → PASS.
- [ ] **Bước 6: Commit** `docs: the new office island`
