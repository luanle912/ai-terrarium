# Christmas Critters Implementation Plan (đợt 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trong sự kiện Noel, đảo có thêm nhân vật: 3 tuần lộc gặm cỏ, 2 yêu tinh khuân quà tới trước văn phòng, 4 chim
cánh cụt trên hồ băng, và ông già Noel (xe trượt bay ngang trời đêm 24, ngồi trước văn phòng ngày 25), với tối đa 20 lệnh
vẽ thêm mỗi khung.

**Architecture:** Hành vi là một module thuần có test (`EventCritters`), cùng kiểu `DogLogic` nhưng nhỏ: mỗi con có
`act`, đích, và tư thế suy ra từ thời gian. Hình là bảng pixel như `DogSprites`; mỗi (loại, khung hình, mức sáng) dựng
một lần thành canvas nhỏ có sẵn bóng đổ, cache chung mọi đảo, nên mỗi con tốn đúng một `drawImage` mỗi khung. Xe
trượt vẽ trên canvas trời sau, cùng chỗ với người rơi khỏi cửa EXIT.

**Tech Stack:** ES module thuần trong `web/`, canvas 2D, không build, không phụ thuộc. Test: `node --test`. Đo và
chụp: `tools/perf-frame.mjs`, `tools/shot.mjs` (cả hai có `--at` và `--eval`).

**Spec:** `docs/specs/2026-11-10-christmas-event-design.md`, mục 7 (nhân vật), 3.2–3.5 (hiệu năng), 9 (world). Plan
đợt 1–3: `docs/plans/2026-11-10-christmas-event-plan.md`.

## Global Constraints

- Ngân sách đợt này: **tối đa 20 lệnh canvas thêm mỗi khung** khi mọi nhân vật cùng có mặt (đêm 24/12), JS mỗi khung
  p50 không tăng quá 0,1 ms. Tổng cả sự kiện vẫn trong §3.4 (đêm +1.400; hiện đã dùng khoảng +250).
- Cấm trong đường vẽ mỗi khung (§3.3): `shadowBlur`, `filter`, `getImageData`, tạo gradient, tạo mảng/object/chuỗi
  màu/closure mới, canvas mới trên sân khấu, `globalCompositeOperation` mới.
- Không thêm khoá nào vào cache ảnh đảo: nhân vật và quà thả dù **không** làm nướng lại ảnh đảo.
- Mỗi file trong `web/` ≤ 700 dòng (`split('\n')`), mỗi dòng ≤ 120 ký tự, Prettier 3.3.3. File sát trần, **không
  thêm quá số dòng ghi ở đây**: `office-draw.js` 689 (thêm ≤ 3), `dog-logic.js` 699 (không sửa),
  `office-draw-people.js` 673, `office-agents.js` 654, `island-life.js` 678.
- Hàm `IslandScene` mượn mà gọi `this.x(...)` thì `x` phải có trong `SCENE_METHODS` (`web/island-scene.js`).
- Không có chữ mới trên màn hình, nên không thêm khoá i18n.
- Ngoài sự kiện: không nhân vật nào, không lệnh vẽ nào thêm, ảnh chụp 20/7 và 20/10 giống hệt trước.
- `prefers-reduced-motion` (`env.reduced`): tuần lộc và chim cánh cụt đứng yên ở tư thế đầu; không yêu tinh, không
  xe trượt; ông già Noel ngày 25 vẫn ngồi.
- Dừng tiến trình chỉ theo PID. Không POST lên server cài đặt thật từ trang thử.
- Commit theo từng task, thông điệp tiếng Anh kiểu repo.

## Quyết định của plan (khác hoặc rõ hơn spec)

1. **Chó không đổi hành vi.** `dog-logic.js` đã 699 dòng. "Chó tới ngửi" làm từ phía tuần lộc: có chó trong 2 ô thì
   tuần lộc ngẩng đầu nhìn về phía chó cho tới khi chó đi.
2. **Quà thả dù không tăng số quà nướng sẵn.** Đêm 24 sự kiện đã ở mức 3, dưới cây đã đủ 9 hộp (`EventLogic.GIFTS`).
   Quà dù rơi xuống thành hộp vẽ mỗi khung cạnh cây, tối đa 4 hộp, giữ tới khi tải lại trang. Không nướng lại.
3. **World:** đảo khác chỉ có tuần lộc. Yêu tinh, chim cánh cụt, ông già Noel và xe trượt chỉ ở đảo của người xem.
4. **Bóng đổ nằm trong sprite** (một elip mờ vẽ lúc dựng), để mỗi con là một `drawImage`.
5. **Bật tay hoặc xem thử ngoài tháng 12** (`eve` và `day` đều `false`): có tuần lộc, yêu tinh và chim cánh cụt
   (hồ đóng băng theo quyết định 7); không ông già Noel.
6. **Cây thông lớn nằm trong văn phòng** (`EventLogic.TREE_TILE`, từ 2026-11-11), nên nhân vật ngoài trời không tới
   gốc cây. Điểm hẹn ngoài trời là **chỗ nhận quà** `w.drop`: ô `roam` trên bãi cỏ ngay chân cầu thang trước gần cây
   nhất. Yêu tinh khuân quà tới đó, quà dù đáp ở đó, ông già Noel ngày 25 ngồi cạnh đó. Mọi chữ "cây" trong các task
   bên dưới, khi nói về chỗ nhân vật đi tới, nghĩa là `w.drop`.
7. **Sự kiện bật thì mùa luôn là mùa đông và trời có tuyết rơi** (`EventLogic.season`, `EventLogic.weather`), nên hồ
   luôn đóng băng trong sự kiện (tắt thời tiết trong Settings chỉ tắt tuyết rơi).

## Review Focus

1. **Mức sự kiện hoặc trạng thái hồ đổi khi trang đang mở** (mức 3 → hết sự kiện lúc 27/12 0:00, xem thử hết 60 giây,
   hồ tan băng): nhân vật không còn điều kiện phải biến mất trong lần `step` kế tiếp, không ném lỗi. Test ở Task 2, 5.
2. **Đảo không có chỗ** (tập `roam` rỗng, không có ô cây thông, hồ không có ô băng đủ xa bờ): `create` trả danh
   sách rỗng cho loại đó, `step` và `pose` không ném lỗi. Test ở Task 2, 4, 5.
3. **Tab ẩn lâu rồi quay lại** (`dt` vài phút): `step` kẹp `dt` ≤ 0,25 giây; không con nào nhảy cóc, không `NaN`, xe
   trượt không bay nhiều lượt dồn. Test ở Task 2, 6.
4. **Giảm chuyển động:** sau 60 giây `step` với `calm: true`, toạ độ mọi con không đổi, không có yêu tinh, `sleigh`
   luôn `null`. Test ở Task 2, 4, 6.
5. **Chỗ đứng trùng vật khác:** tuần lộc không chọn ô cây thông lớn và 8 ô quanh nó, ô chuồng chó, ô lối đi
   (`clear`); yêu tinh đặt quà ở ô cạnh cây, không phải ô cây. Test ở Task 2, 4.

---

## Cấu trúc file

| File | Trách nhiệm |
|---|---|
| `web/critter-sprites.js` (mới) | Bảng pixel và bảng màu của tuần lộc, yêu tinh, chim cánh cụt, ông già Noel, xe trượt, quà dù. Thuần. |
| `web/event-critters.js` (mới) | Hành vi: tạo, bước, tư thế; lịch xe trượt; quà dù. Thuần. |
| `web/office-draw-critters.js` (mới) | Mixin: dựng và cache sprite, đưa nhân vật vào danh sách vẽ theo chiều sâu, vẽ xe trượt, bước mỗi khung. |
| `tests/critter-sprites.test.mjs`, `tests/event-critters.test.mjs` (mới) | Test hai module thuần. |
| Sửa `web/office.js`, `web/island-scene.js` | Tạo `this.critters`, `this.critterWorld`; gọi `stepCritters(dt)` cạnh `stepDogs(dt)`; `SCENE_METHODS`. |
| Sửa `web/office-draw.js` | Ba dòng gọi: `critterItems` hai lần (sau tường và trước tường, cạnh chỗ chó) và `drawSleigh` cạnh `drawFallers`. |
| Sửa `web/main.js` | Import mixin mới (như `office-draw-xmas.js`). |

---

### Task 1: `CritterSprites`

**Files:** Create `web/critter-sprites.js`, `tests/critter-sprites.test.mjs`.

**Interfaces — Produces:**
- `CritterSprites.KINDS = { reindeer, elf, penguin, santa, sleigh, parcel }`, mỗi loại `{ ax, pal, frames }` cùng
  dạng `DogSprites.BREEDS[b]` (hàng chuỗi, `'.'` là trống, mọi con quay mặt sang phải).
- `CritterSprites.frame(kind, name) → { w, h, ax, rows }` (hàng được đệm `'.'` cho đủ `w`; kết quả giữ lại).
- `CritterSprites.frameNames(kind) → string[]`.
- Khung hình bắt buộc và kích thước tối đa (rộng × cao):

| Loại | Khung hình | Tối đa |
|---|---|---|
| `reindeer` | `stand`, `graze`, `look`, `walk1`, `walk2` | 20 × 18 |
| `elf` | `walk1`, `walk2`, `carry1`, `carry2`, `place`, `slip` | 10 × 14 |
| `penguin` | `stand`, `waddle1`, `waddle2`, `slide` | 12 × 10 |
| `santa` | `sit`, `wave` | 14 × 16 |
| `sleigh` | `fly` (hai tuần lộc, xe, ông già Noel) | 48 × 16 |
| `parcel` | `chute` (hộp quà treo dù), `box` | 9 × 13 |

- Bảng màu `reindeer` có chữ `n` (mũi): `'#5a3a26'`. `CritterSprites.RUDOLPH = { n: '#ff4d4d' }` là phần ghi đè cho
  con mũi đỏ. Màu đỏ, trắng, lục, vàng dùng lại của `OutfitLogic` (`RED`, `WHITE`, `GOLD`) và `'#2f8f4e'`.

- [ ] **Test:** mọi khung hình bắt buộc tồn tại; mọi hàng của một khung dài bằng `w`; kích thước không quá bảng
  trên; mọi chữ khác `'.'` có trong `pal`; `0 ≤ ax < w`; hàng cuối có ít nhất một pixel (chân chạm đất), trừ
  `sleigh/fly` và `parcel/chute`; hai khung `walk1`/`walk2` (và `waddle1`/`waddle2`, `carry1`/`carry2`) khác nhau;
  `frame('reindeer', 'x')` và `frame('cat', 'stand')` trả `null`.
- [ ] Chạy test, thấy đỏ (module chưa có).
- [ ] Vẽ bảng pixel. Phong cách theo `web/dog-sprites.js`: viền tối 1 px ở phía dưới và phía sau, ba tông mỗi màu.
- [ ] Chạy test, thấy xanh. In mọi khung ra terminal bằng một dòng `node -e` để soi hình.
- [ ] Commit `feat: pixel sprites for the Christmas critters`.

### Task 2: `EventCritters`, tuần lộc

**Files:** Create `web/event-critters.js`, `tests/event-critters.test.mjs`.

**Interfaces — Consumes:** `DogLogic.path(roam, from, to)` (đường đi trên tập ô), `STAIRS` (`web/office-scene.js`).

**Produces:**
- Thế giới `w` (do trang dựng, Task 3): `{ roam: Set<'x,y'>, roamList: [x,y][], clear: Set, houses, drop: [x,y] |
  null, ice: [x,y][], edge: [x,y] | null, level, eve, day, frozen, calm, now, rand, dogs: {x,y}[], only }`.
  `only: 'reindeer'` cho đảo khác ở world.
- `EventCritters.create(w) → critter[]`; mỗi con `{ kind, id, x, y, face (1 | -1), act, until, path, home: [x,y],
  red (chỉ tuần lộc 0) }`.
- `EventCritters.step(list, w, dt) → list` (cùng mảng, sửa tại chỗ; thêm bớt con khi điều kiện đổi).
- `EventCritters.pose(c, t) → { frame, dy, flip }` trả cùng một object dùng lại (không cấp phát).
- `EventCritters.wanted(w) → { reindeer, elf, penguin, santa }` (số con mỗi loại theo `w`).
- Hằng số: `REINDEER = 3`, `REINDEER_FROM = 2` (mức), `RANGE = 4` (ô quanh `home`), `SPEED = 0.6` (ô/giây),
  `NOTICE = 2` (ô, khoảng thấy chó), `DT_MAX = 0.25`.
- Hành vi tuần lộc: `graze` 6–14 giây → `look` 2–4 giây → `walk` tới một ô trong `RANGE` của `home` (qua
  `DogLogic.path`) → lặp. Có chó trong `NOTICE` ô: `look`, `face` hướng về chó, tới khi chó ra xa.
- Chỗ ở (`home`) của ba con, tính một lần từ `roamList`: ô xa nhất phía sau (y nhỏ nhất), ô xa nhất phía đông (x lớn
  nhất), ô xa nhất phía tây-nam (x − y nhỏ nhất); bỏ ô trong `clear`, ô chuồng chó, ô `drop` và 8 ô quanh.

- [ ] **Test** (dùng `rand` có hạt giống và đảo thật như `tests/event-logic.test.mjs`):
  - `wanted`: mức 1 → không con nào; mức 2 → 3 tuần lộc, 0 yêu tinh; `ev` rỗng (`level: 0`) → tất cả 0.
  - `create` ở mức 2 trả đúng 3 tuần lộc, đúng một con `red`, ba `home` khác nhau, đều thuộc `roam`, không ô nào bị
    cấm ở Review Focus 5.
  - Sau 600 giây `step` (bước 0,1 giây): mọi con luôn ở trong `roam`, cách `home` không quá `RANGE + 1`, toạ độ hữu
    hạn; mỗi con đã qua cả ba `act`.
  - Có chó cách 1 ô: trong 1 giây con đó chuyển `look` và `face` hướng về chó; chó đi xa thì trở lại vòng thường.
  - `calm: true`: sau 60 giây toạ độ không đổi, `pose` luôn trả khung `graze`.
  - `step` với `dt = 300`: không con nào đi quá `SPEED × DT_MAX` ô trong lần đó.
  - Mức 2 → `level: 0`: lần `step` kế tiếp danh sách rỗng. `roam` rỗng: `create` trả `[]`, `step` không ném lỗi.
  - `pose` trả cùng một object qua hai lần gọi (`===`).
- [ ] Chạy test, thấy đỏ. Viết module. Chạy test, thấy xanh.
- [ ] Commit `feat: reindeer on the lawn, as pure logic`.

### Task 3: Vẽ tuần lộc và nối vào trang

**Files:** Create `web/office-draw-critters.js`. Modify `web/office.js`, `web/island-scene.js`, `web/office-draw.js`,
`web/main.js`.

**Interfaces — Consumes:** `EventCritters.*`, `CritterSprites.*`, `glowSprite`, `glowAt` (`web/office-draw-xmas.js`),
`DogLogic.nightMix`, `DOG_PLACES` (`web/office-scene.js`), `G.ev`.

**Produces (mixin trên `ClaudeOffice`, mượn qua `SCENE_METHODS`):**
- `critterSprite(kind, name, dfB, red) → canvas`: cache ở module (`Map`, chung mọi đảo, xoá khi quá 300 mục), khoá
  `kind/name/dfB/red`. Dựng: bóng elip `rgba(0,0,0,0.18)` ở hàng chân, rồi pixel trộn về `'#0d1322'` theo
  `DogLogic.nightMix(dfB / 10)` như `dogSprite`.
- `stepCritters(dt)`: cập nhật `this.critterWorld` (`level`, `eve`, `day` từ `this.eventNow()`; `frozen`, `calm`,
  `now`, `dogs = this.dogs`) rồi `EventCritters.step`.
- `critterItems(G, list, back, dfB)`: đẩy `{ z: c.x + c.y, f }` cho từng con thuộc phía `back` vào `list`, dùng
  cùng phép thử `backOf` với chó. Mỗi con: một `drawImage` (lật bằng `scale(-1, 1)` như `drawDog`). Con `red` ban đêm
  thêm một `drawImage` quầng đỏ (`glowSprite('#ff4d4d', 8)`, `globalAlpha = glowAt(G.df)`).
- `this.critters`, `this.critterWorld` tạo trong constructor của `ClaudeOffice` và của `IslandScene` (đảo khác:
  `only: 'reindeer'`). `window.__critters = { list, world }` cạnh `window.__dogs`.

- [ ] Viết mixin; hàm vẽ từng con là method nhận `(G, c, dfB)`, không tạo closure mỗi khung ngoài cái đẩy vào `list`
  (giống chó).
- [ ] Nối: `office.js` (constructor, vòng `frame` cạnh `stepDogs`), `island-scene.js` (constructor, `step`,
  `SCENE_METHODS` thêm `stepCritters`, `critterItems`, `critterSprite`), `office-draw.js` (hai dòng cạnh dòng 337 và
  648), `main.js`.
- [ ] Chạy cả bộ test (`island-scene-methods`, `web-style`, `i18n` phải qua).
- [ ] Chụp 20/12 12:00 và 21:00 với `tools/shot.mjs`, cắt cận ba con; con mũi đỏ có quầng ban đêm. Chụp 20/7: không
  có con nào.
- [ ] Đo `tools/perf-frame.mjs` 20/12 21:00, xen kẽ với bản trước: tăng ≤ 4 lệnh.
- [ ] Commit `feat: three reindeer graze on the lawn during the Christmas event`.

### Task 4: Yêu tinh khuân quà

**Files:** Modify `web/event-critters.js`, `web/office-draw-critters.js`, `tests/event-critters.test.mjs`.

**Interfaces — Produces:**
- `EventCritters.elfRoute(w) → [x,y][] | null`: `DogLogic.path(roam, w.edge, ô cạnh chỗ nhận quà)`; đó là ô thuộc
  `roam` kề `w.drop` gần `w.edge` nhất. `null` khi thiếu `edge`, `drop` hoặc không có đường.
- `w.edge`: ô `roam` ở mép đảo phía trước gần cây nhất (trang tính một lần trong constructor).
- Hằng số: `ELVES = 2`, `ELF_FROM = 3`, `ELF_SPEED = 1`, `SLIP = 0.15` (xác suất mỗi chặng), `SLIP_FOR = 1.2` giây,
  `PLACE_FOR = 1.5` giây, nghỉ ngoài mép 8–20 giây.
- Vòng của một yêu tinh: `away` (ẩn) → `carry` (đi tới cây, ôm quà) → `place` → `back` (đi về, tay không) → `away`.
  Yêu tinh thứ hai lệch nửa vòng. Trượt ngã (`slip`) tối đa một lần mỗi chặng, ở một điểm ngẫu nhiên trên đường.
- `pose`: `carry` → `carry1`/`carry2`; `back` → `walk1`/`walk2`; `place`, `slip` → khung cùng tên. `away` → không vẽ
  (`critterItems` bỏ qua con có `act === 'away'`).

- [ ] **Test:** mức 3 → 2 yêu tinh, mức 2 → 0; `elfRoute` bắt đầu ở `edge`, kết thúc ở ô kề `drop` và không phải ô
  `drop`, mọi ô thuộc `roam`; trong 300 giây mỗi yêu tinh qua đủ `carry`, `place`, `back`, `away` theo đúng thứ tự;
  hai con không bao giờ cùng `place` một lúc; với `rand` luôn trả 0 có đúng một `slip` mỗi chặng, với `rand` luôn trả
  0,99 không có `slip`; `calm: true` → 0 yêu tinh; không `edge` → 0 yêu tinh, không ném lỗi.
- [ ] Đỏ → viết → xanh. Chụp cận một yêu tinh đang ôm quà, một con đang đặt, một con ngã.
- [ ] Commit `feat: two elves carry presents to the tree`.

### Task 5: Chim cánh cụt trên hồ băng

**Files:** Modify `web/event-critters.js`, `web/office-draw-critters.js`, `tests/event-critters.test.mjs`.

**Interfaces — Produces:**
- `w.ice`: các ô nước của hồ cách bờ ít nhất 1 ô, trừ ô lối đá của chòi (`ISLAND.pavilion.path`) và chỗ tắm
  (`ISLAND.pond.spots`); trang tính một lần.
- `EventCritters.huddle(ice) → [x,y][4] | null`: bốn điểm quanh ô băng gần tâm hồ nhất, lệch `±0.35` ô; `null` khi
  `ice` có dưới 6 ô.
- Hằng số: `PENGUINS = 4`, `PENGUIN_FROM = 3`, lượt trượt mỗi 6–10 giây, `SLIDE = 2.5` ô, `SLIDE_SPEED = 2.2`,
  `WADDLE_SPEED = 0.5`.
- Hành vi: đứng cụm (`stand`); tới lượt, một con `slide` theo đường thẳng `SLIDE` ô trong tập `ice` (chọn hướng có đủ
  ô băng), rồi `waddle` về chỗ. Mỗi lúc chỉ một con rời cụm.
- Vẽ: chim cánh cụt đứng ở mặt băng, tức toạ độ màn hình `PG(x, y)` hạ xuống `WATER_Z` (`web/island-land.js`) như
  phao câu trong `drawRod`.

- [ ] **Test:** mức 3 và `frozen` → 4 con; `frozen: false` → 0 và lần `step` kế tiếp danh sách không còn chim cánh
  cụt; trong 120 giây mọi con luôn ở trong `ice` (làm tròn xuống ô), không quá một con có `act` khác `stand` cùng
  lúc, mỗi con đã `slide` ít nhất một lần; `ice` có 3 ô → 0 con; `calm: true` → 4 con đứng yên.
- [ ] Đỏ → viết → xanh. Chụp 20/12 12:00 và 21:00, cắt cận hồ. Chụp 20/7 với sự kiện bật: có chim cánh cụt (mùa đông theo sự kiện).
- [ ] Commit `feat: four penguins on the frozen lake`.

### Task 6: Ông già Noel

**Files:** Modify `web/event-critters.js`, `web/office-draw-critters.js`, `web/office-draw.js` (một dòng),
`tests/event-critters.test.mjs`.

**Interfaces — Produces:**
- `EventCritters.sleigh(w) → null | { u, dir, drops }`: `u` từ 0 tới 1 là tiến độ lượt bay (`SLEIGH_FOR = 14` giây),
  `dir` là 1 hoặc −1, `drops` là số quà đã thả trong lượt này (0–2). Chỉ khi `w.eve` và không `w.calm`. Lượt kế tiếp
  sau 180–300 giây; lượt đầu 20–40 giây sau khi `eve` bắt đầu hoặc trang mở. Trạng thái giữ trong `w.sleighAt`,
  `w.sleighNext`.
- `w.parcels`: mảng cố định 2 mục `{ on, t0 }` (quà đang rơi dù, `FALL_FOR = 3` giây) và `w.landed` (0–`LANDED_MAX =
  4`). Quà thả ở `u = 0.45` và, nửa số lượt, thêm ở `u = 0.6`.
- Ông già Noel ngày 25 (`w.day`): một nhân vật `kind: 'santa'` ở ô `roam` kề cây phía đối diện đường yêu tinh, `act:
  'sit'`, khung `wave` 1,2 giây mỗi 10 giây.
- `drawSleigh(ctx, t, w, h)` (mixin, chỉ đảo của người xem): gọi trong `office-draw.js` ngay sau `drawFallers` trên
  `backCanvas`. Xe ở độ cao 12–18 % chiều cao trời, đi hết chiều ngang; một `drawImage` (sprite đã trộn tối theo
  đêm). Quà dù rơi: một `drawImage` mỗi quà, từ vị trí xe xuống điểm cạnh cây; quà đã đáp vẽ trong `critterItems`
  (một `drawImage` mỗi hộp, cạnh cây, theo thứ tự chiều sâu).
- `window.__sleigh()` (cạnh `window.__fate`): cho lượt bay bắt đầu ngay, để chụp.

- [ ] **Test:** ngoài `eve` → `sleigh` luôn `null`; trong `eve`, 30 phút `step` (bước 0,1 giây) cho 5–10 lượt bay, mỗi
  lượt `u` tăng đều từ 0 tới 1 rồi `null`; `landed` không bao giờ quá `LANDED_MAX`; `dt = 3600` không sinh quá một
  lượt; `calm: true` → `null`; `day` → đúng một `santa`, không trùng ô cây và ô đặt quà của yêu tinh; hết `day` thì
  `santa` biến mất ở `step` kế tiếp.
- [ ] Đỏ → viết → xanh.
- [ ] Chụp 24/12 21:00 với `--eval "__sleigh()"` ở ba thời điểm (xe vào, thả quà, quà đáp) và 25/12 12:00 (ông già
  Noel ngồi cạnh cây). Chụp `?wallpaper=1` một lượt.
- [ ] Commit `feat: Santa's sleigh on Christmas Eve, and Santa by the tree on Christmas Day`.

### Task 7: Chốt đợt 4

- [ ] `node --test tests/*.test.mjs`, Prettier.
- [ ] `tools/perf-frame.mjs`, xen kẽ với commit trước đợt 4, ở 20/12 12:00, 20/12 21:00, 24/12 21:00 (ép xe trượt)
  và 20/7 12:00. Điều kiện qua: 24/12 21:00 tăng ≤ 20 lệnh; 20/7 không đổi; p50 không tăng quá 0,1 ms; số lần nướng
  ảnh đảo bằng trước.
- [ ] World: chụp một cảnh nhiều đảo; mỗi đảo có tuần lộc, chỉ một xe trượt.
- [ ] Ảnh 20/7 và 20/10 giống hệt trước đợt 4 (so file ảnh vùng bãi cỏ tĩnh).
- [ ] `CHANGELOG.md` (mục Christmas event), `README.md`, `tools/README.md` (số đo sau đợt 4).
- [ ] Một reviewer mới đọc cả đợt (`git diff <commit trước đợt 4>..HEAD`), kèm mục Review Focus ở trên.

---

## Ngoài plan này

- **Đợt 5 (hành vi, §8):** 5 hoạt động nghỉ, 4 kiểu ra đi mới, hơi thở trắng. Plan riêng, viết sau đợt 4. Dựa vào
  `EventCritters` (xe trượt chở đi), `w.ice` (trượt băng), ô đặt quà của yêu tinh.
- **Cây thông lớn không đi xuyên qua được** và **vòng nguyệt quế cửa WC**: việc tồn từ đợt 2, không thuộc đợt này.
