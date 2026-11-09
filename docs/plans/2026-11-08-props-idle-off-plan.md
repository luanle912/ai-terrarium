# Props Idle-Off Implementation Plan

**Goal:** Đồ vật trong văn phòng chỉ sáng / chạy khi có nhân vật đã tới nơi và đang dùng.

**Spec:** `docs/specs/2026-11-08-props-idle-off-design.md`

**Architecture:** module logic thuần `web/prop-use.js` (`PropUse`: bảng chỉ số đồ vật, ai đang dùng gì, bước mức
sáng); method `stepProps(dt)` của `ClaudeOffice` giữ `this.propLit` (`Float32Array`) và được gọi cạnh `stepDogs` ở cả
trang local lẫn đảo world; hàm vẽ đọc `o.use`.

## Review Focus

1. Người còn đang đi tới chưa làm đồ sáng; người ngủ gục ở bàn không làm bàn phím sáng.
2. Không cấp phát mới mỗi khung trong đường vẽ.
3. Đảo world (`SCENE_METHODS`) có `stepProps`, test `island-scene-methods` xanh.

### Task 1: Logic thuần `PropUse` (TDD)

- [ ] `tests/prop-use.test.mjs` + `tests/load-prop-use.mjs`: `ID` có đủ 16 bàn và các đồ pantry / lavabo;
  `mark(on, agents, spots)` đánh dấu bàn khi chủ ngồi, không khi đi / ngủ / về / là sub-agent; đánh dấu đồ của spot
  chỉ khi đã tới nơi; lavabo chỉ ở pha rửa; `ease(lit, on, dt)` lên trong 0,3 s, xuống trong 0,6 s, kẹp [0,1].
- [ ] Viết `web/prop-use.js` cho test xanh.

### Task 2: Gắn `prop` vào spot, act mới

- [ ] `web/office-scene.js`: `prop` cho các spot bếp, quầy, bàn cafe, arcade, bi lắc; act `sky` → `arcade`,
  `stretch` ở bàn bi lắc → `foosball`; `ACT_TXT`.
- [ ] `web/restroom-logic.js`: `wash()` mang `prop: 'basin-' + room + (i % 2)`.
- [ ] i18n 7 ngôn ngữ: bỏ `office.act.sky`, thêm `office.act.arcade`, `office.act.foosball`.
- [ ] `actArms`: tay cho `arcade` và `foosball`.

### Task 3: `stepProps` và truyền mức sáng xuống hàm vẽ

- [ ] `web/office-agents.js`: method `stepProps(dt)`; gọi trong `web/office.js` `frame` và `IslandScene.frame`;
  thêm vào `SCENE_METHODS`.
- [ ] `pantryItems`: object tuỳ chọn dùng lại `{ night, use }`; bảng `LAYOUT` → chỉ số đồ vật tính một lần.
- [ ] `deskWorkstation` / `F.desk`: nhận `lit`.
- [ ] `restroomItems`: lavabo nhận mức sáng.

### Task 4: Vẽ trạng thái tắt / bật

- [ ] `F.desk` (bàn phím, lớp mờ màn hình), `I.fridge`, `I.espresso`, `I.grinder`, `I.sink`, `I.microwave`,
  `I.drinkfridge`, `I.island`, `I.cafetable`, `I.arcade`, `I.foosball`, lavabo.

### Task 5: Kiểm tra

- [ ] `node --test tests/*.test.mjs` xanh; Prettier; module ≤ 700 dòng.
- [ ] Chrome headless: ảnh trước / sau (bàn có / không người ngồi, arcade, lò vi sóng, bồn rửa, bi lắc; ngày và đêm)
  lưu vào `.superpowers/props-idle-off/`.
- [ ] Commit `feat: ...` trên nhánh riêng, không push.
