# Christmas Behaviour Implementation Plan (đợt 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trong sự kiện Noel, người trong văn phòng có 5 hoạt động nghỉ mới (ném tuyết, đắp người tuyết, trượt băng,
uống cacao, đặt quà dưới cây), 4 kiểu ra đi mới (xe trượt chở đi, bị gói thành hộp quà, trượt băng lao khỏi mép đảo,
chui ống khói), và thở ra hơi trắng khi đứng ngoài trời tuyết.

**Architecture:** Hoạt động nghỉ đi qua cơ chế sẵn có: thêm chỗ vào cuối `IDLE_SPOTS`, một module thuần mới
(`EventIdle`) quyết định chỗ nào mở theo sự kiện, mức tuyết và hồ băng, và tính mọi thứ chuyển động (quả tuyết, quả
cầu tuyết lớn dần, vòng trượt băng). Kiểu ra đi là bốn mục mới trong `FateLogic.FATES` cùng bốn cảnh trong sổ `SCENES`
(file riêng). Mọi hình mới là `fillRect` hoặc sprite đã có của đợt 4 (`CritterSprites`), không nướng lại ảnh đảo.

**Tech Stack:** ES module thuần trong `web/`, canvas 2D, không build. Test: `node --test tests/*.test.mjs`. Chụp và
đo: `tools/shot.mjs`, `tools/perf-frame.mjs` (`--at`, `--eval`).

**Spec:** `docs/specs/2026-11-10-christmas-event-design.md`, mục 8; hiệu năng mục 3.3–3.5. Plan trước:
`docs/plans/2026-11-11-christmas-critters-plan.md` (đợt 4).

## Global Constraints

- Ngân sách đợt này: **tối đa 30 lệnh canvas thêm mỗi khung** khi cả năm hoạt động cùng có người; cảnh ra đi là tạm
  thời (3–6 giây) và không tính. JS mỗi khung p50 không tăng quá 0,1 ms.
- Cấm trong đường vẽ mỗi khung (§3.3): `shadowBlur`, `filter`, `getImageData`, tạo gradient, canvas mới, mảng/object/
  chuỗi màu/closure mới ngoài mục `{ z, f }` đẩy vào danh sách vẽ.
- Không thêm khoá nào vào cache ảnh đảo. Không để lại vật gì cố định sau một hoạt động (không người tuyết mới).
- Mỗi file trong `web/` ≤ 700 dòng, mỗi dòng ≤ 120 ký tự, Prettier 3.3.3. File sát trần, **không thêm quá**:
  `office-agents.js` 654 (≤ 12 dòng), `office-draw-people.js` 673 (≤ 8 dòng), `office-draw.js` 691 (≤ 2 dòng),
  `dog-logic.js` 699 (không sửa).
- Chỉ số của các chỗ đang có trong `IDLE_SPOTS` không đổi: chỗ mới thêm vào **cuối** mảng.
- Hàm `IslandScene` mượn mà gọi `this.x(...)` thì `x` phải có trong `SCENE_METHODS` (`web/island-scene.js`).
- Chữ mới: 5 nhãn hoạt động (`office.act.*`) và 4 câu thoại (`bubble.fate.*`), đủ **7 ngôn ngữ** (`web/i18n/*.js`).
- Ngoài sự kiện: không chỗ nghỉ mới nào mở, không kiểu ra đi mới nào có trọng số, ảnh 20/7 và 20/10 giống trước.
- `prefers-reduced-motion` (`env.reduced`): không ném tuyết, không trượt băng, không hơi thở; đắp người tuyết đứng
  yên ở cỡ cuối; uống cacao và đặt quà vẫn có. Kiểu ra đi: như hiện tại (chỉ cửa EXIT).
- Dừng tiến trình chỉ theo PID. Trang thử không POST lên server cài đặt thật.
- Commit theo từng task, thông điệp tiếng Anh kiểu repo.

## Quyết định của plan (khác hoặc rõ hơn spec)

1. **Đặt quà ở cây thông trong nhà.** Cây đã chuyển vào ngã tư hành lang (`EventLogic.TREE_AT`), nên chỗ đặt quà là
   ô `10,7` cạnh cây (ô `9,6` và `9,7` bị chặn). Không dùng chồng quà ngoài trời của yêu tinh.
2. **Uống cacao không phải chỗ mới.** Hai chỗ `coffee` sẵn có, trong sự kiện, hiện nhãn "cacao", cốc đỏ và hơi nóng.
   Nhãn đổi ở chỗ hiển thị, `act` vẫn là `coffee` (logic, chó, `PropUse` không đổi).
3. **Ném tuyết một mình vẫn được.** Hai chỗ đứng đối diện cách nhau 4 ô. Một người thì nặn tuyết; đủ hai người thì
   ném qua lại. Không khoá chỗ thứ hai theo chỗ thứ nhất (tránh thêm điều kiện vào `goalFor`).
4. **Trượt băng dùng ô vào của chỗ tắm.** Hồ chỉ đi vào được qua hai ô tắm (`ISLAND.pond.spots`); hồ đóng băng thì
   tắm đã đóng. Chỗ trượt băng có `tile` là ô tắm thứ hai, tới nơi thì người đi theo vòng elip tính sẵn trên băng.
5. **Ống khói mọc lên trên bãi cỏ** (văn phòng không có mái): một ống khói gạch trồi lên, người chui vào, khói phụt.
6. **Hơi thở trắng theo tuyết, không theo sự kiện:** hiện khi mức tuyết ≥ 2 và trời sáng, kể cả mùa đông thường.
7. **Xe trượt chở đi không cần lượt bay của đợt 4.** Cảnh tự vẽ xe (sprite `sleigh/fly`) lướt xuống chỗ người đứng
   rồi bay lên; không đụng `w.sleighAt`.

## Review Focus

1. **Điều kiện đổi khi đang nghỉ** (sự kiện hết, tuyết tan dưới mức 2, hồ tan băng, bật giảm chuyển động): người đang
   ở chỗ không còn mở phải rời đi ở lần `goalFor` kế tiếp, không kẹt, không đứng giữa hồ nước. Test ở Task 1, 2.
2. **Hai người ném tuyết lệch pha** (một người tới trước, một người bỏ đi giữa chừng): quả tuyết không bay tới chỗ
   trống, không `NaN`. Test ở Task 1.
3. **Đảo không có chỗ** (hồ không đủ băng cho vòng trượt, không có ô bãi cỏ cho ném tuyết): chỗ đó không được tạo,
   các chỗ khác vẫn chạy. Test ở Task 1.
4. **Người trượt băng bị chọn ra đi hoặc được giao việc giữa vòng:** phải quay về ô vào rồi mới đi tiếp, không đi
   xuyên mặt hồ theo đường thẳng tới bàn. Test ở Task 2.
5. **Kiểu ra đi mới ngoài sự kiện:** trọng số 0 với mọi tổ hợp thời tiết khi không có sự kiện; `xe trượt` chỉ khi
   `eve` hoặc `day`. Test ở Task 4.

---

## Cấu trúc file

| File | Trách nhiệm |
|---|---|
| `web/event-idle.js` (mới) | Thuần: các chỗ nghỉ của sự kiện, chỗ nào mở, quỹ đạo quả tuyết, cỡ quả cầu tuyết, vòng trượt băng. |
| `web/office-draw-idle-xmas.js` (mới) | Mixin: vẽ quả tuyết, quả cầu tuyết, vệt trượt, cốc cacao, hộp quà trên tay; tay của từng hoạt động. |
| `web/office-draw-fate-xmas.js` (mới) | Bốn cảnh ra đi mới, thêm vào `SCENES`. |
| `tests/event-idle.test.mjs` (mới) | Test `EventIdle`. |
| Sửa `web/office-scene.js` | `IDLE_SPOTS` thêm `...EVENT_IDLE.spots` ở cuối; `ACT_TXT` thêm 5 nhãn. |
| Sửa `web/office-agents.js` | `goalFor`: lọc chỗ mở qua `EventIdle`; người trượt băng đi theo vòng. |
| Sửa `web/fate-logic.js`, `tests/fate-logic.test.mjs` | 4 kiểu mới, điều kiện `xmas`, `eve`. |
| Sửa `web/office-people-xmas.js`, `web/office-draw-people.js` | `XMAS.breath`; gọi tay hoạt động mới và hơi thở. |
| Sửa `web/i18n/*.js` (7 file) | 9 khoá mới mỗi file. |
| Sửa `web/main.js`, `web/island-scene.js` | Import hai mixin mới; `SCENE_METHODS`. |

---

### Task 1: `EventIdle` (thuần)

**Files:** Create `web/event-idle.js`, `tests/event-idle.test.mjs`.

**Interfaces — Consumes:** `CRITTER_PLACES` (`roam`, `clear`, `ice`, `iceSet`, `drop`), `EventCritters.huddle`,
`EventLogic.TREE_AT`, `ISLAND.pond.spots`, `SnowLogic.depth(snow)` (mức tuyết 0–3).

**Produces:**
- `EventIdle.ACTS = ['snowball', 'snowman', 'skate', 'gift']` (cacao không phải `act` mới).
- `EventIdle.layout({ roam, roamList, clear, ice, iceSet, drop, entry, tree }) → { spots, rink, pitch }`:
  - `spots`: mảng chỗ nghỉ cùng dạng `IDLE_SPOTS` (`{ act, tile, pt, front, event: true, ... }`), theo thứ tự cố định:
    hai chỗ `snowball` (`side: 0 | 1`), một `snowman`, một `skate`, một `gift`. Chỗ nào đảo không có thì bỏ.
  - `pitch`: `{ a: [x, y], b: [x, y] }` hai ô bãi cỏ cùng hàng `y`, cách nhau 4 ô, không thuộc `clear`, cách `drop`
    hơn 2 ô, ở bãi trước (`y > H`), gần giữa bãi nhất; `null` nếu không có.
  - `rink`: `{ cx, cy, rx, ry }` elip mà 16 điểm mẫu đều rơi vào `iceSet`, tâm cách cụm chim cánh cụt
    (`EventCritters.huddle`) ít nhất 3 ô, `rx` lớn nhất có thể trong 1,5–3 ô, `ry = rx × 0,6`; `null` nếu không có.
  - Chỗ `skate`: `tile` là `entry` (ô tắm thứ hai), `pt` là điểm `u = 0` của vòng. Chỗ `gift`: `tile: [10, 7]`,
    `pt: [10.3, 7.4]`, `front: false`. Chỗ `snowman`: ô bãi cỏ cách `pitch` ít nhất 3 ô, cùng điều kiện.
- `EventIdle.open(spots, free, c) → number[]` và `EventIdle.stays(spots, i, c) → boolean`, với
  `c = { level, snow, frozen, calm }` (`level` 0 khi không có sự kiện; `snow` là mức 0–3):

| act | mở khi |
|---|---|
| `snowball` | `level ≥ 1`, `snow ≥ 2`, không `calm` |
| `snowman` | `level ≥ 1`, `snow ≥ 2` |
| `skate` | `level ≥ 1`, `frozen`, không `calm` |
| `gift` | `level ≥ 2` |
| mọi chỗ không có `event: true` | luôn (hàm không đụng tới) |

- `EventIdle.ball(t, both) → { u, h } | null`: quả tuyết lúc `t` giây. Chu kỳ `THROW = 2.4` giây: bay `FLY = 0.9`
  giây từ bên này sang bên kia (`u` 0→1 hoặc 1→0, đổi chiều mỗi chu kỳ), `h = 14 × 4u(1−u)` px; ngoài lúc bay và khi
  `both` là `false` trả `null`. Trả cùng một object dùng lại.
- `EventIdle.thrower(t) → 0 | 1`: bên đang ném trong chu kỳ này (để vẽ tay).
- `EventIdle.snowmanSize(t) → number`: bán kính quả cầu 2→7 px trong `GROW = 20` giây rồi về 2 (chu kỳ 24 giây).
- `EventIdle.skateAt(rink, t, out) → out`: `out[0], out[1]` là toạ độ ô trên elip lúc `t` (một vòng `LAP = 9` giây).
  Người không có hướng trái/phải riêng (chỉ `front` của chỗ nghỉ), nên người trượt luôn quay mặt về người xem.

- [ ] **Test:**
  - `layout` trên đảo thật: 5 chỗ, đúng thứ tự `act`; `pitch.a` và `pitch.b` cùng `y`, cách 4 ô, thuộc `roam`, không
    thuộc `clear`; 16 điểm của `rink` thuộc `iceSet` và cách mọi điểm `huddle` ≥ 3 ô; chỗ `gift` không phải ô
    `EventLogic.TREE_CELLS`.
  - `layout` với `ice` rỗng: không có chỗ `skate`, bốn chỗ kia còn; với `roamList` rỗng: chỉ còn `gift`.
  - `open`: bảng trên, từng dòng một, cả hai phía điều kiện; chỗ thường không bao giờ bị lọc; `level: 0` lọc hết chỗ
    sự kiện. `stays` trả `false` đúng khi `open` sẽ loại chỗ đó.
  - `ball`: `both: false` luôn `null`; trong một chu kỳ `u` đi đơn điệu, `h ≥ 0`, đỉnh ở giữa; hai chu kỳ liền nhau
    ngược chiều; `ball(NaN, true)` là `null`; hai lần gọi trả cùng object (`===`).
  - `snowmanSize`: 2 lúc `t = 0`, 7 lúc `t = 20`, không giảm trong 0–20, luôn trong [2, 7].
  - `skateAt`: 200 thời điểm trong 30 giây đều rơi vào `iceSet`; `skateAt` ghi vào mảng được đưa và trả chính nó.
- [ ] Chạy test, thấy đỏ. Viết module. Chạy test, thấy xanh.
- [ ] Commit `feat: the Christmas event's idle spots, as pure logic`.

### Task 2: Nối chỗ nghỉ mới vào trang

**Files:** Modify `web/office-scene.js`, `web/office-agents.js`, `web/i18n/*.js`, `tests/event-idle.test.mjs`.

**Interfaces — Produces:**
- `EVENT_IDLE = EventIdle.layout({ ...CRITTER_PLACES, entry: [ISLAND.pond.spots[1].x, ISLAND.pond.spots[1].y] })`
  (export từ `office-scene.js`); `IDLE_SPOTS` kết thúc bằng `...EVENT_IDLE.spots`.
- `ACT_TXT` thêm `snowball`, `snowman`, `skate`, `gift`, `cocoa` (`office.act.*`).
- Nhãn hiển thị: một hàm `actLabel(act, ev)` trong `office-scene.js` trả `ACT_TXT.cocoa` khi `act === 'coffee'` và có
  sự kiện, ngược lại `ACT_TXT[act]`. Chỗ duy nhất đọc `ACT_TXT` để hiển thị là bong bóng ở `web/office-render.js:112`: đổi
  sang hàm này và thêm emoji cho 5 hoạt động vào bảng emoji ngay đó (⛄ ném tuyết, ☃️ đắp người tuyết, ⛸️ trượt
  băng, 🎁 đặt quà, 🍫 cacao).
- `goalFor` (`office-agents.js`, đoạn dòng 513–521): sau `SeasonLogic.idleStays` / `idleOpen` gọi thêm
  `EventIdle.stays` / `EventIdle.open` với `c = this.idleCtx()`; `idleCtx()` là method mới trong
  `office-draw-idle-xmas.js` (Task 3 tạo file; ở task này đặt tạm trong mixin đó với chỉ method này) trả cùng một
  object dùng lại: `{ level, snow: SnowLogic.depth(this.snowShown || 0), frozen, calm }`.
- Người trượt băng: trong `updateAgent`, khi người đã tới chỗ `skate` (đứng yên ở `pt`), mỗi khung đặt `a.x, a.y`
  theo `EventIdle.skateAt(EVENT_IDLE.rink, simT + a.id, this.skateXY)`. Khi mục tiêu đổi
  (`g.key !== a.goalKey`) mà người đang ở chỗ `skate`: đặt lại `a.x, a.y` về `pt` của chỗ đó trước khi tìm đường.

- [ ] **Test** (thêm vào `tests/event-idle.test.mjs`, nạp `office-scene` thật):
  - Chỉ số và nội dung mọi chỗ cũ trong `IDLE_SPOTS` không đổi (so với danh sách dựng lại không có sự kiện:
    `IDLE_SPOTS.slice(0, n − 5)` không có mục `event`); 5 mục cuối là chỗ sự kiện.
  - Mọi `tile` của chỗ sự kiện tới được từ cửa (`DOOR`) bằng hàm tìm đường của trang (dùng cách các test hiện có
    kiểm tra chỗ tắm, `tests/rest-corner.test.mjs`).
  - `actLabel('coffee', ev)` khác `actLabel('coffee', null)`; mọi `act` trong `EventIdle.ACTS` có nhãn.
  - 9 khoá mới có ở cả 7 file ngôn ngữ (test i18n sẵn có sẽ bắt thiếu khoá; thêm một dòng kiểm tra tên khoá).
- [ ] Đỏ → sửa → xanh. Chạy cả bộ test.
- [ ] Commit `feat: people idle the Christmas way: snowballs, a snowman, skating, a present for the tree`.

### Task 3: Vẽ các hoạt động

**Files:** Create `web/office-draw-idle-xmas.js`. Modify `web/office-draw-people.js` (≤ 6 dòng),
`web/office-draw.js` (1 dòng), `web/island-scene.js`, `web/main.js`.

**Interfaces — Produces (mixin, mượn qua `SCENE_METHODS`):**
- `xmasArms(R, act, sx, by, t, sh, shD, sk, a) → boolean`: tay của `snowball` (nặn khi một mình, vung khi tới lượt
  `EventIdle.thrower`), `snowman` (hai tay đẩy về phía trước), `skate` (dang hai tay), `gift` (hai tay đưa hộp xuống),
  và `coffee` trong sự kiện (cốc đỏ `OutfitLogic.RED`, 2 pixel hơi trắng bay lên). Trả `true` nếu đã vẽ. Trong
  `drawPerson`, ngay trước `this.actArms(...)`: `if (!(G.ev && this.xmasArms(...))) this.actArms(...)`.
- `idleXmasItems(G, items)`: gọi một lần mỗi khung từ `office-draw.js` cạnh `critterItems`. Đẩy vào `items`:
  - quả tuyết: một `fillRect` 2×2 trắng và một bóng 2×1 trên tuyết, vị trí nội suy giữa hai chỗ đứng của `pitch`
    theo `EventIdle.ball(t, both)`; `both` là có người đứng yên ở cả hai chỗ;
  - quả cầu tuyết: hình tròn bậc thang bằng 3 `fillRect` (thân, viền dưới tối, điểm sáng), bán kính
    `EventIdle.snowmanSize`, đặt trước mặt người đang đắp; chỉ khi có người đứng yên ở chỗ `snowman`;
  - vệt trượt: 8 `fillRect` 1×1 `rgba(255,255,255,0.5)` ở 8 vị trí vừa qua trên elip, sau lưng người trượt;
  - hộp quà trên tay người ở chỗ `gift`: sprite `parcel/box` của `critterSprite`, một `drawImage`.
- Không vật nào được vẽ khi không có ai ở chỗ đó. Màu là hằng chuỗi ở đầu file.

- [ ] Viết mixin; `SCENE_METHODS` thêm `xmasArms`, `idleXmasItems`, `idleCtx`.
- [ ] Chạy cả bộ test (`island-scene-methods`, `web-style`).
- [ ] Chụp 20/12 12:00 với 16 agent mô phỏng, ép từng người vào từng chỗ bằng `--eval` (đặt `a.status = 'idle'`,
  `a.idleSpot = <chỉ số>`); cắt cận năm hoạt động, ngày và đêm. Chụp 20/7: nhãn vẫn "cà phê", cốc thường.
- [ ] Commit `feat: snowballs fly, a snowball grows, skaters leave a trail`.

### Task 4: Bốn kiểu ra đi mới (logic và chữ)

**Files:** Modify `web/fate-logic.js`, `tests/fate-logic.test.mjs`, `web/office-draw-fate.js` (`fateCtx`),
`web/i18n/*.js`.

**Interfaces — Produces:**
- `FateLogic.conditions({ fx, look, day, summer, calm, ev })` thêm hai trường: `xmas` (`!!ev`), `eve` (`ev.eve ||
  ev.day`). `fateCtx()` truyền `ev: this.eventNow()`.
- Bốn mục mới trong `FATES`:

| kind | at | dur | trọng số |
|---|---|---|---|
| `sleigh` | `lawn` | 5 | `c.eve ? 10 : 0` |
| `wrapped` | `way` | 3.6 | `c.xmas ? 4 : 0` |
| `skateoff` | `lake` | 4.4 | `c.xmas && c.frozen ? 5 : 0` |
| `chimney` | `lawn` | 4.6 | `c.xmas ? 3 : 0` |

- Câu thoại `bubble.fate.sleigh`, `.wrapped`, `.skateoff`, `.chimney` ở 7 ngôn ngữ, cùng giọng với các câu sẵn có
  (một emoji, một câu ngắn không biết trước chuyện sắp xảy ra).

- [ ] **Test:** không `ev`: bốn kiểu mới trọng số 0 với 6 tổ hợp thời tiết đang có trong test; có `ev` thường:
  `sleigh` vẫn 0, ba kiểu kia > 0 (`skateoff` chỉ khi `frozen`); `ev.eve` hoặc `ev.day`: `sleigh` là 10; `calm`: chỉ
  `exit`; `pick` với `force` là từng kiểu mới trả đúng kiểu đó; `goal('skateoff', places, …)` trả một ô trong
  `places.lake`; `KINDS` có đủ 21 kiểu và mọi kiểu có khoá `bubble.fate.<kind>` trong `en.js` (trừ `exit`).
- [ ] Đỏ → sửa → xanh.
- [ ] Commit `feat: four Christmas ways to leave, as weights and lines`.

### Task 5: Bốn cảnh ra đi

**Files:** Create `web/office-draw-fate-xmas.js`. Modify `web/main.js`, `web/island-scene.js` (import).

**Interfaces — Consumes:** `SCENES`, `clamp`, `ease`, `fig`, `oval`, `rr` (`web/office-draw-fate.js`);
`critterSprite` (đợt 4); `PG`, `LW`.

**Produces:** `Object.assign(SCENES, { sleigh, wrapped, skateoff, chimney })`, mỗi hàm `(S, G, f, u, x, y)` như các
cảnh sẵn có (`u` là giây từ đầu cảnh, `x, y` là chân người trên màn hình):
- `sleigh`: xe (sprite `sleigh/fly`, một `drawImage`) lướt từ ngoài mép trái xuống ngang người trong 1,6 giây, người
  bật lên xe (`fig` thu nhỏ dần về chỗ ngồi), xe bay chéo lên phải ra khỏi khung trong 2 giây; vệt sao là 6 `fillRect`.
- `wrapped`: bốn tấm giấy đỏ khép vào quanh người (4 `fillRect` lớn dần), nơ vàng bật ra ở trên, hộp nảy hai lần,
  rồi một yêu tinh (sprite `elf/carry1`) chạy vào đẩy hộp ra khỏi khung về phía mép đảo.
- `skateoff`: người dang tay trượt từ chỗ đứng theo đường thẳng về phía mép trước của đảo, nhanh dần, vệt băng trắng
  sau lưng, tới mép thì bay ra và rơi (dùng lại cách rơi của cảnh `banana` nếu có hàm chung, nếu không thì parabol
  đơn giản), mờ dần trong 0,6 giây cuối.
- `chimney`: ống khói gạch (thân đỏ gạch 10×14, viền trên trắng tuyết) trồi lên từ tuyết cạnh người trong 0,8 giây,
  người nhảy lên và tụt xuống trong ống (cắt bằng `clip` như hàm `above` của `office-draw-fate-more.js`), khói xám
  phụt ba cụm, ống khói lún xuống.
- Mọi màu là hằng chuỗi; `rgba` có alpha thay đổi lấy từ bảng dựng sẵn ở đầu file (như `NIGHT_TINT` trong
  `office-draw.js`), không ghép chuỗi mỗi khung.

- [ ] Viết bốn cảnh. Chạy cả bộ test.
- [ ] Chụp từng cảnh ở ba thời điểm bằng `__fate('<kind>', 0, true)` (xem `window.__fate` trong `web/office.js`) ở
  24/12 21:00 (`sleigh`) và 20/12 12:00 (ba cảnh kia); trang thử đặt `eventChoice = 'auto'` và chặn POST như
  `.superpowers/xmas/crit.js`.
- [ ] Commit `feat: carried off by the sleigh, wrapped as a present, off the ice, down a chimney`.

### Task 6: Hơi thở trắng

**Files:** Modify `web/office-people-xmas.js`, `web/office-draw-people.js` (≤ 2 dòng), `tests/outfit-logic.test.mjs`
hoặc file test mới nhỏ cho hàm thuần.

**Interfaces — Produces:**
- `breathAt(t, id) → 0 | 1 | 2` (thuần, export từ `office-people-xmas.js`): chu kỳ 3 giây lệch pha theo `id`; 0 là
  không có, 1 là hơi vừa ra (2 pixel sát miệng), 2 là hơi đang tan (2 pixel cao hơn 2 px, lệch 1 px). Có hơi trong
  0,9 giây đầu mỗi chu kỳ.
- `XMAS.breath(R, k, sx, hy, dir)`: 2 `fillRect` 1×1 màu `'#ffffff'` và `'#dfe9f2'` trước mặt, theo hướng nhìn.
- Trong `drawPerson`, nhánh người đứng (không ngồi, không ngủ, không đang đi), ngoài trời (`a.x ≥ W || a.y ≥ H` và
  không ở WC), khi `G.df ≥ 0.6`, mức tuyết ≥ 2 (`G.snowLv`, thêm vào `G` trong `office-draw.js` nếu chưa có) và
  không `env.reduced`.

- [ ] **Test:** `breathAt` chỉ khác 0 trong 0,9 giây đầu của mỗi 3 giây; hai `id` khác nhau lệch pha; `breathAt(NaN,
  1)` là 0.
- [ ] Đỏ → viết → xanh. Chụp cận một người đứng hút thuốc ngoài trời lúc 12:00 ngày 20/12 và lúc 21:00 (không có hơi).
- [ ] Commit `feat: breath shows in the cold`.

### Task 7: Chốt đợt 5

- [ ] `node --test tests/*.test.mjs`, Prettier, giới hạn dòng.
- [ ] `tools/perf-frame.mjs` 20/12 12:00 với 16 agent, năm chỗ sự kiện đều có người (ép bằng `--eval`), xen kẽ với
  bản tắt (`idleXmasItems`, `xmasArms` thay bằng hàm rỗng): tăng ≤ 30 lệnh, p50 không tăng quá 0,1 ms, số lần nướng
  ảnh đảo không đổi.
- [ ] Ảnh 20/7 và 20/10 tắt sự kiện: không chỗ nghỉ mới, nhãn và cốc cà phê như cũ.
- [ ] `CHANGELOG.md`, `README.md`, `tools/README.md`, bản nháp mô tả PR (`.superpowers/pr-description.md`).
- [ ] Một reviewer mới đọc cả đợt (`git diff <commit trước đợt 5>..HEAD`), kèm mục Review Focus ở trên.

---

## Ngoài plan này

- Nới hành lang ngang lên 3 ô (văn phòng cao thêm 1 ô).
- Các điểm UI và lỗi nhỏ tồn từ đợt 2–4 (ghi trong sổ `.superpowers/sdd/*/progress.md`).
- Năm mới.
