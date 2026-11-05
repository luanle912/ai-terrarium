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

- `east-back` = nhà vệ sinh (`x 28..31, y 2..5`), `east-front` = khu hút thuốc, đổi thành 4×4 (`x 28..31, y 10..13`).
- Thân nhà vệ sinh chặn 9 ô `x 28..30, y 2..4`; hai idle spot `act:'wc'` ở `(28,5)` và `(29,5)`.
- Nền khu hút thuốc chỉ vào được qua hai ô cửa; các cạnh kín nằm trong `SmokeLogic.layout(...).shut`.
- Chó tránh cả hai ô chừa.
- Bộ test đầy đủ `node --test tests/*.test.mjs` phải PASS (368 test ở `ea16158`, cộng test mới).
- Ngoài hòn đá trang trí ở `(30,13)`, phần còn lại của đảo trông như cũ.

## Review Focus

1. Agent đi tới khu hút thuốc mới phải vào qua cửa, không trèo qua lưng ghế từ phía cầu thang. Test ở Task 1.
2. Agent vào nhà vệ sinh xong phải đi chỗ khác, không đứng mãi ở cửa và không quay lại ngay. Kiểm ở Task 4.
3. Đảo trong world view (hub) vẽ nhà vệ sinh mà không lỗi: `restroomItems` có trong `SCENE_METHODS`. Kiểm ở Task 3.

---

### Task 1: Dời khu hút thuốc xuống `east-front`

**Files:**
- Modify: `claude-office.html`: khối `sky-logic` (`outdoorSpots`: `east-front` thành `h:4`; chú thích `lawnPaths`), khối `smoke-logic` (thêm `shut`), script chính (`SMOKE` lấy `east-front`, thêm `SMOKE.shut` vào `EDGE`, `DOG_ROAM` tránh cả hai ô).
- Modify: `tests/smoke-logic.test.mjs`, `tests/sky-logic.test.mjs` (tên test nhánh đường đá).

- [ ] **Step 1: Sửa test** `smoke-logic`: khu nằm ở `east-front` 4×4 tại `y = H-4`; test mới "nền chỉ vào được qua cửa" (mọi cạnh biên trừ cạnh vào ô cửa nằm trong `shut`); test "đi từ cầu thang đông" dùng `shut` khi tìm đường.
- [ ] **Step 2: Chạy** `node --test tests/smoke-logic.test.mjs`. Kỳ vọng: FAIL.
- [ ] **Step 3: Cài đặt** `outdoorSpots`, `SmokeLogic.layout(...).shut`, `SMOKE`, `EDGE`, `DOG_ROAM`.
- [ ] **Step 4: Chạy** toàn bộ test. Kỳ vọng: PASS.
- [ ] **Kiểm bằng mắt:** khu hút thuốc vẽ đầy đủ ở chỗ mới; chỗ cũ chỉ còn cỏ.

### Task 2: Logic nhà vệ sinh

**Files:**
- Modify: `claude-office.html`: thêm `<script id="restroom-logic">`.
- Create: `tests/load-restroom-logic.mjs`, `tests/restroom-logic.test.mjs`.

**Interfaces:**
- `RestroomLogic.layout(zone) → {x, y, blocked: string[], paved: string[], spots: {act:'wc', tile, pt, front:false, door}[], doors: {x0, x1}[]}`.
- `RestroomLogic.visit(t) → 'door' | 'inside' | 'out' | 'done'`, `RestroomLogic.VISIT` (tổng thời lượng).

- [ ] **Step 1: Viết test hỏng:** khu nằm trong `east-back`; thân nhà chặn đúng 9 ô; hai spot đứng trên ô đi được ngay trước cửa, mỗi spot một ô, điểm đứng trong ô của nó; đi tới được từ chân cầu thang đông theo đường đá; cách khu hút thuốc ≥ 4 hàng; nhịp `visit` đúng thứ tự và ngắn hơn 10 giây.
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
