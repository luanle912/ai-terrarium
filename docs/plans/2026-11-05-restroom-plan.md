# Restroom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đặt một nhà vệ sinh nhỏ vào chỗ khu hút thuốc hiện nay cạnh pantry, dời khu hút thuốc xuống ô chừa `east-front`, và cho agent rảnh thỉnh thoảng đi vệ sinh.

**Architecture:**
- Trang vẫn là một file `claude-office.html`.
- Thêm khối `<script id="restroom-logic">` (logic thuần, `globalThis.RestroomLogic`) ngay sau `smoke-logic`, có test bằng `node:test` + `node:vm` như `smoke-logic`.
- Hàm vẽ `restroomItems(G, items, snow)` là method của `ClaudeOffice`, cạnh `smokingItems`, và được thêm vào `SCENE_METHODS` của `island-scene` để đảo trong world view cũng có.
- Không sửa `<script id="world-view">` và `<script id="world-logic">`.

**Tech Stack:** HTML5 Canvas 2D, React 18 UMD (không JSX), Node ≥ 18 (`node --test`, `node:vm`), Chrome headless để chụp màn hình.

**Spec:** `docs/specs/2026-11-05-restroom-design.md`

## Global Constraints

- `east-back` = nhà vệ sinh (`x 28..31, y 2..5`), `east-front` = khu hút thuốc, đổi thành 4×4 (`x 28..31, y 9..12`).
- Thân nhà vệ sinh chặn 9 ô `x 28..30, y 2..4`; hai idle spot `act:'wc'` ở `(28,5)` và `(29,5)`.
- Nền khu hút thuốc chỉ vào được qua hai ô cửa; các cạnh kín nằm trong `SmokeLogic.layout(...).shut`.
- Chó tránh cả hai ô chừa.
- Bộ test đầy đủ `node --test tests/*.test.mjs` phải PASS (368 test ở `ea16158`, cộng test mới).
- Ngoài bông hoa trang trí ở `(30,9)`, phần còn lại của đảo trông như cũ.

## Review Focus

1. Agent đi tới khu hút thuốc mới phải vào qua cửa, không trèo qua lưng ghế từ phía cầu thang. Test ở Task 1.
2. Agent vào nhà vệ sinh xong phải đi chỗ khác, không đứng mãi ở cửa và không quay lại ngay. Kiểm ở Task 4.
3. Đảo trong world view (hub) vẽ nhà vệ sinh mà không lỗi: `restroomItems` có trong `SCENE_METHODS`. Kiểm ở Task 3.

---

### Task 1: Dời khu hút thuốc xuống `east-front`

**Files:**
- Modify: `claude-office.html`: khối `sky-logic` (`outdoorSpots`: `east-front` thành `h:4`; chú thích `lawnPaths`), khối `smoke-logic` (thêm `shut`), script chính (`SMOKE` lấy `east-front`, thêm `SMOKE.shut` vào `EDGE`, `DOG_ROAM` tránh cả hai ô).
- Modify: `tests/smoke-logic.test.mjs`, `tests/sky-logic.test.mjs` (tên test nhánh đường đá).

- [ ] **Step 1: Sửa test** `smoke-logic`: khu nằm ở `east-front` 4×4 tại `y = H-5`; test mới "nền chỉ vào được qua cửa" (mọi cạnh biên trừ cạnh vào ô cửa nằm trong `shut`); test "đi từ cầu thang đông" dùng `shut` khi tìm đường.
- [ ] **Step 2: Chạy** `node --test tests/smoke-logic.test.mjs`. Kỳ vọng: FAIL.
- [ ] **Step 3: Cài đặt** `outdoorSpots`, `SmokeLogic.layout(...).shut`, `SMOKE`, `EDGE`, `DOG_ROAM`.
- [ ] **Step 4: Chạy** toàn bộ test. Kỳ vọng: PASS.
- [ ] **Kiểm bằng mắt:** khu hút thuốc vẽ đầy đủ ở chỗ mới, biển báo không bị cây che; chỗ cũ chỉ còn cỏ.

### Task 2: Logic nhà vệ sinh

**Files:**
- Modify: `claude-office.html`: thêm `<script id="restroom-logic">`.
- Create: `tests/load-restroom-logic.mjs`, `tests/restroom-logic.test.mjs`.

**Interfaces:**
- `RestroomLogic.layout(zone) → {x, y, blocked: string[], paved: string[], spots: {act:'wc', tile, pt, front:false, door}[], doors: {x0, x1}[]}`.
- `RestroomLogic.visit(t) → 'door' | 'inside' | 'out' | 'done'`, `RestroomLogic.VISIT` (tổng thời lượng).

- [ ] **Step 1: Viết test hỏng:** khu nằm trong `east-back`; thân nhà chặn đúng 9 ô; hai spot đứng trên ô đi được ngay trước cửa, mỗi spot một ô, điểm đứng trong ô của nó; đi tới được từ chân cầu thang đông theo đường đá; cách khu hút thuốc ≥ 3 hàng; nhịp `visit` đúng thứ tự và ngắn hơn 10 giây.
- [ ] **Step 2: Chạy**, kỳ vọng FAIL. **Step 3:** cài đặt. **Step 4:** PASS.

### Task 3: Vẽ nhà vệ sinh

**Files:**
- Modify: `claude-office.html`: method `restroomItems` cạnh `smokingItems`; gọi trong `draw()`; thêm vào `SCENE_METHODS`.

- [ ] **Step 1:** Thềm, thân nhà, mái, mái hiên, hai cửa có biển, biển WC, đèn báo trống/có người, lavabo và gương, cửa sổ kính mờ, đèn tường, chậu cây. Màu qua `night()` và tuyết.
- [ ] **Step 2: Chạy** toàn bộ test (không có test hình), kỳ vọng PASS.
- [ ] **Kiểm bằng mắt:** chụp cận bãi cỏ đông ban ngày, ban đêm và khi có tuyết; chụp toàn đảo; nhà vệ sinh không che sai thứ tự với người hay chó đứng quanh nó.

### Task 4: Agent đi vệ sinh

**Files:**
- Modify: `claude-office.html` script chính: `IDLE_SPOTS` thêm spot `wc`, `ACT_TXT.wc`, emoji bong bóng `🚻`, `goalFor` (hết lượt thì đổi spot, không chọn lại), `updateAgent` (đếm `wcT`, cờ `wcIn`), `draw()` (ẩn người đang ở trong), danh sách agent ngoài cỏ cho chó (bỏ người đang ở trong).

- [ ] **Step 1:** Cài đặt như trên.
- [ ] **Step 2: Chạy** toàn bộ test, kỳ vọng PASS.
- [ ] **Kiểm bằng mắt:** ép một agent rảnh vào spot `wc` qua console, chụp lúc đứng ở cửa (bong bóng "đi vệ sinh") và lúc đã vào (cửa đóng, đèn đỏ); chờ hết lượt thấy agent đi chỗ khác. Ép một agent vào khu hút thuốc mới, chụp.

### Task 5: CHANGELOG và commit

**Files:**
- Modify: `CHANGELOG.md` mục `## [Unreleased]`: một dòng Added (nhà vệ sinh), một dòng Changed (dời khu hút thuốc).

- [ ] **Step 1:** Viết hai dòng theo đúng giọng văn của file.
- [ ] **Step 2:** `node --test tests/*.test.mjs` PASS.
- [ ] **Step 3:** Commit `feat: restroom by the pantry, smoking corner moved down the lawn`. Không push.

---

## Bản 2: khối nhà vệ sinh cắt lớp (cutaway)

**Spec:** mục "Bản 2" trong `docs/specs/2026-11-05-restroom-design.md`.

**Goal:** Thay nhà vệ sinh 3×3 có mái bằng khối không mái gắn vào pantry: WC NAM, WC NỮ, sảnh chung, theo brief của anh
Kiệt, và cho agent đi vào qua sảnh, đúng cửa, đứng trước buồng, rửa tay rồi ra.

**Global constraints (bản 2)**
- Ô chừa `east-back` = `x 27..34, y 2..6`; sàn khối `x 27 → 34.6`, `y 2 → 7`, cao `FLOOR_Z`.
- Tường sau cao `WALL`; vách lửng 28 + kính tới 46; tường đầu gối 10.
- Không sửa `world-view`, `world-logic`. Ngoài vùng pantry/khối/bãi cỏ đông: pixel diff bằng 0.
- `node --test tests/*.test.mjs` PASS (394 ở `fddf1f7`, cộng test mới).

**Review focus**
1. Người đi pantry ↔ sảnh ngang sàn, không xuyên vách lửng, không bước từ sàn khối xuống cỏ (test Task 6).
2. Thứ tự vẽ: người trong phòng nằm sau tường đầu gối và vách kính, người ở sảnh nằm trước (kiểm bằng mắt Task 8).
3. Không thấy người trong buồng (Task 9).

### Task 6: `RestroomLogic` bản 2 và ô chừa mới

**Files:**
- Modify: `claude-office.html`: khối `sky-logic` (`outdoorSpots` `east-back` thành `x W, y 2, 8×5`; `lawnPaths` bỏ nhánh
  ngắn), khối `restroom-logic` (viết lại).
- Modify: `tests/restroom-logic.test.mjs` (viết lại), `tests/sky-logic.test.mjs` (các test nhánh đường đá).

**Interfaces:**
- `RestroomLogic.layout(zone, wall) → {x0,y0,x1,y1, front, heights:{full,half,glass,knee}, floor:string[], walk:string[],
  shut:string[], rooms:{m,f}, stalls:[{room,x0,x1,y0,y1}], urinals, vanities, makeup, lobby, spots:[{act:'wc',room,stall,
  tile,pt,front:false,wash:{tile,pt}}]}`.
- `RestroomLogic.onFloor(L, x, y)`, `RestroomLogic.roomOf(id)`, `RestroomLogic.visit(t) → 'door'|'inside'|'out'|'wash'|'done'`.

- [ ] **Step 1: Viết test hỏng:** khối gắn cạnh đông pantry; sàn nằm trọn trên đảo, không đè hồ, cây, đá, đường đá; hai
  hàng sảnh mở sang pantry, vách lửng chặn `y 2..4`; tỷ lệ (tường sau = `WALL`, vách lửng < tường, đầu gối < vách lửng,
  buồng ≥ 0.85×1.3 ô, lavabo 1.5–2.2 ô); 2 buồng nam + 3 buồng nữ, spot đứng trên ô đi được, trong phòng của nó, điểm
  đứng trong ô; từ `(26,5)` tới mọi spot và chỗ rửa tay đi được, qua đúng ô cửa, không qua cạnh `shut`; không có bước nào
  giữa sàn khối và cỏ; tường trước phòng cách khu hút thuốc ≥ 3 hàng; nhịp `visit`.
- [ ] **Step 2:** chạy, kỳ vọng FAIL. **Step 3:** cài đặt. **Step 4:** cả bộ test PASS.

### Task 7: Nối khối vào lưới đi bộ

**Files:** `claude-office.html` script chính: `WC`, `LAWN_WALK`, `PAVED`, `DOG_ROAM`, `EDGE` (thêm `WC.shut`), `PA`,
`bfs` (sàn khối là sàn trong nhà, không nối với cỏ), `updateAgent` (điểm xuất phát trên sàn khối).

- [ ] Cài đặt; chạy toàn bộ test.

### Task 8: Vẽ khối

**Files:** `claude-office.html`: viết lại `restroomItems` (vẫn trong `SCENE_METHODS`).

- [ ] Vẽ ngay: bệ (đá như bệ văn phòng), sàn hai phòng và sảnh, thảm; vẽ lại bậc cầu thang đông đè lên mặt trước bệ.
- [ ] Item theo chiều sâu: tường sau (một item), từng đoạn 1 ô của vách lửng và tường đầu gối, từng buồng, bồn tiểu,
  lavabo, góc trang điểm, đồ sảnh, khung cửa và biển, nhãn nổi.
- [ ] Đêm: LED và biển giữ sáng, có quầng. Tuyết: chỉ nắp tường.
- [ ] Chụp: toàn đảo ngày; cận khối ngày, đêm, tuyết. Pixel diff với `fddf1f7` (cảnh tĩnh, không người, không chó).

### Task 9: Agent đi vệ sinh bản 2

**Files:** `claude-office.html` script chính: `IDLE_SPOTS` (5 spot buồng), `goalFor` (lọc theo phòng, pha `wash` đổi
đích sang lavabo mà không đặt lại đồng hồ), `updateAgent`, trạng thái cửa buồng trong `restroomItems`.

- [ ] Cài đặt; ép một agent nam và một agent nữ vào spot `wc` qua console; chụp lúc đứng trước buồng, lúc ở trong (cửa
  đóng), lúc rửa tay; chờ hết lượt thấy agent đi chỗ khác.

### Task 10: CHANGELOG và commit

- [ ] Sửa dòng **Restroom** trong `[Unreleased]` cho đúng bản 2 (và dòng khu hút thuốc nếu cần).
- [ ] `node --test tests/*.test.mjs` PASS.
- [ ] Commit `feat: restroom v2 — open-top cutaway with men's, women's rooms and a shared lobby`. Không push.

---

## Bản 3: đồng bộ phong cách, sát pantry, khu hút thuốc bên cạnh

**Spec:** mục "Bản 3" trong spec. **Base:** `9fc9ae2`, 443 test.

### Task 11: Đất thêm, ô chừa mới, đường đá

**Files:** `claude-office.html` khối `sky-logic` (`ANNEX_LAND`, `annexLand`, `outdoorSpots`, chân `lawnPaths` mới);
`tests/sky-logic.test.mjs`.

- [ ] Test:
  - mọi ô thêm kề đất cũ và thoả `(x+1) − y ≤ W+6`;
  - `sceneFrame` không đổi so với đảo không có đất thêm;
  - hai ô chừa nằm trên đất;
  - đường đá nối cầu thang đông với ô ngay trước cửa khu hút thuốc;
  - thác và hồ không đổi.
- [ ] Cài đặt, chạy test.

### Task 12: `RestroomLogic` bản 3

**Files:** khối `restroom-logic`; `tests/restroom-logic.test.mjs`.

- [ ] Test:
  - tường sau ở `y = 0`, sát pantry; khối 6×7 nằm trên đất;
  - chiều cao: vách thấp hơn tường đầy và cao hơn người, tường đầu gối thấp;
  - spot, chỗ rửa tay, và đường đi từ `(26,5)` qua đúng cửa;
  - không bước được xuống cỏ;
  - khu hút thuốc kề cạnh đông của khối, cửa vào nối đường đá;
  - buồng đủ rộng.
- [ ] Cài đặt, chạy test.

### Task 13: Vẽ lại theo phong cách văn phòng

**Files:** `restroomItems` trong script chính.

- [ ] Vẽ: tường, vách đặc, sàn gạch/gỗ pantry, potplant, stool, ghế băng kiểu khu hút thuốc, biển neon, chữ sơn trên
  sàn.
- [ ] Bỏ: viền, kính, LED, nhãn nổi, hộp biển.
- [ ] Chụp:
  - toàn đảo;
  - cận cảnh ngày, đêm, tuyết;
  - đặt cạnh pantry;
  - agent vào nhà vệ sinh và vào khu hút thuốc.
- [ ] Pixel diff ngày/đêm/tuyết với `9fc9ae2`.

### Task 14: CHANGELOG, commit

- [ ] Sửa dòng Restroom và dòng khu hút thuốc.
- [ ] Commit `feat: restroom v3 — matches the office style, flush with the pantry, smoking corner beside it`.
