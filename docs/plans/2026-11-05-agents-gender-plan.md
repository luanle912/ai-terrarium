# Agents Gender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agent mới là nam hoặc nữ (cố định theo `sid`), nét vẽ phân biệt rõ nam nữ, đi đúng phòng vệ sinh theo giới tính, và agent rảnh đi vệ sinh khoảng 1/4 số lần chọn chỗ.

**Architecture:**
- Trang vẫn là một file `claude-office.html`.
- Thêm khối `<script id="people-logic">` (logic thuần, `globalThis.PeopleLogic`) ngay trước `restroom-logic`, test bằng `node:test` + `node:vm`.
- `RestroomLogic.roomOf` nhận agent; thêm `RestroomLogic.pickIdle` và `SHARE`.
- Mã vẽ người: các hàm cấp cao mới trong script chính, gọi từ `drawPerson`, `drawSleeper`. Không thêm method, `SCENE_METHODS` không đổi.
- Không sửa `<script id="world-view">`, `<script id="world-logic">`, không sửa mã vẽ nhà vệ sinh.

**Tech Stack:** HTML5 Canvas 2D, React 18 UMD (không JSX), Node ≥ 18 (`node --test`, `node:vm`), Chrome headless để chụp màn hình.

**Spec:** `docs/specs/2026-11-05-agents-gender-design.md`

## Global Constraints

- Cùng chiều cao, bề ngang, khung hình; vị trí bàn và ghế không đổi.
- Màu áo chính vẫn là màu phòng ban.
- `SHARE = 0.25`; tối đa số người cùng lúc mỗi phòng = số buồng (2 nam, 3 nữ); thời lượng lượt không đổi.
- Bộ test đầy đủ `node --test tests/*.test.mjs` phải PASS (460 test ở `27cefdb`, cộng test mới).
- Pixel diff trang local khi không có agent: 0 px.

## Review Focus

1. `IslandScene` mượn `addAgent`, `drawPerson`, `drawSleeper`, `goalFor`: mọi thứ mới phải nằm trên agent hoặc global, không đọc state mới của scene.
2. Agent không có `gender` (nếu có) vẫn đi được nhà vệ sinh nhờ fallback chẵn lẻ.
3. Hình bóng nam/nữ phải đọc được ở zoom 1× và ban đêm.

---

### Task 1: `people-logic`

**Files:**
- Modify: `claude-office.html`: thêm `<script id="people-logic">`.
- Create: `tests/load-people-logic.mjs`, `tests/people-logic.test.mjs`.

- [ ] **Step 1: Viết test**: `hash` ổn định; `genderOf` ổn định, cân bằng 45–55 % trên 2000 sid; `look` ổn định, kiểu đúng theo giới, nữ không râu, nam không váy, `dress` luôn đi với váy, 12 sid ra ≥ 10 diện mạo, màu là hex 7 ký tự.
- [ ] **Step 2: Chạy** `node --test tests/people-logic.test.mjs`. Kỳ vọng: FAIL (chưa có khối).
- [ ] **Step 3: Cài đặt** `hash`, `genderOf`, `look` và bảng màu, kiểu.
- [ ] **Step 4: Chạy** lại. Kỳ vọng: PASS.

### Task 2: Nhà vệ sinh theo giới tính và tần suất

**Files:**
- Modify: `claude-office.html`: khối `restroom-logic` (`roomOf`, `pickIdle`, `SHARE`), `goalFor`.
- Modify: `tests/restroom-logic.test.mjs`.

- [ ] **Step 1: Sửa test**: `roomOf({gender})`, fallback theo `id`; `pickIdle` chỉ chọn buồng phòng mình, tỉ lệ 20–30 % với rand có seed, đầy buồng thì chọn chỗ khác, `room = null` không chọn buồng, không còn chỗ thì `null`; mô phỏng 12 agent qua nhiều vòng không vượt số buồng mỗi phòng.
- [ ] **Step 2: Chạy**. Kỳ vọng: FAIL.
- [ ] **Step 3: Cài đặt**; `goalFor` gọi `RestroomLogic.pickIdle(IDLE_SPOTS, free, room, Math.random)`.
- [ ] **Step 4: Chạy** toàn bộ test. Kỳ vọng: PASS.

### Task 3: `addAgent` dùng diện mạo

**Files:**
- Modify: `claude-office.html`: `addAgent`.

- [ ] **Step 1:** `const look=PeopleLogic.look(sid)`; agent có `gender`, `look`, và `skin`, `hair`, `pants`, `acc` lấy từ `look` (giữ tên trường cũ). Bỏ dùng `usedLooks` cho màu.
- [ ] **Step 2: Chạy** toàn bộ test. Kỳ vọng: PASS.

### Task 4: Nét vẽ

**Files:**
- Modify: `claude-office.html`: hàm vẽ tóc, mặt, áo, váy cấp cao; `drawPerson` (đứng, đi, ghế đẩu, ngồi bàn, quay nghiêng, tắm hồ), `actArms` (màu tay áo), `drawSleeper`.

- [ ] **Step 1:** Cài đặt theo mục 4 của spec.
- [ ] **Step 2: Kiểm bằng mắt:** bảng 12 nhân vật mọi tư thế, phóng to 6×; văn phòng ngày, đêm.
- [ ] **Step 3:** Sửa những chỗ đọc chưa rõ, chụp lại.

### Task 5: Kiểm tra, CHANGELOG, commit

- [ ] **Step 1:** `node --test tests/*.test.mjs`: PASS.
- [ ] **Step 2:** Pixel diff trang local không có agent (trước/sau): 0 px.
- [ ] **Step 3:** Ảnh agent đi đúng cửa WC NAM / WC NỮ.
- [ ] **Step 4:** CHANGELOG `[Unreleased]`: một dòng Added (nhân vật nam nữ), một dòng Changed (đi vệ sinh).
- [ ] **Step 5:** Commit `feat: male and female characters with richer pixel art; idle agents use the restroom more`.
