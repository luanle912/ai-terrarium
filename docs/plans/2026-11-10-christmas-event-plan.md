# Christmas Event Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mùa đông có tuyết dày thật, tháng 12 đảo có sự kiện Noel đẹp cả ngày lẫn đêm, người và chó mặc đồ Noel,
tất cả trong ngân sách hiệu năng đo được.

**Architecture:** Logic (mức tuyết, lịch sự kiện, trang phục) là module thuần có test. Hình tĩnh ngoài trời nướng vào
ảnh đảo và prop sẵn có nên không tốn gì mỗi khung; chỉ đèn nháy, trang phục và nhân vật mới vẽ mỗi khung, trong ngân
sách lệnh vẽ. Mỗi đợt là một PR riêng, chạy được một mình.

**Tech Stack:** ES module thuần trong `web/`, canvas 2D, không build, không phụ thuộc. Test: `node --test`. Đo: Chrome
headless qua CDP.

**Spec:** `docs/specs/2026-11-10-christmas-event-design.md`. Người làm đọc cả hai. Số mục "§" bên dưới là mục của spec.

**Phạm vi plan này:** đợt 1–3 (tuyết, sự kiện, trang phục) chi tiết tới từng task. Đợt 4 (nhân vật) và 5 (hành vi)
là hai plan riêng, viết sau khi đợt 3 merge, vì giao diện của chúng dựa vào những gì đợt 1–3 thực sự tạo ra; mục
cuối chỉ ghi ranh giới.

## Global Constraints

- Ngân sách hiệu năng §3.4, so với mốc cùng ngày giờ: JS mỗi khung p50 tăng ≤ 0,4 ms, p95 ≤ 1 ms; lệnh canvas mỗi
  khung tăng ≤ 900 (ngày), ≤ 1.400 (đêm); một lần nướng ảnh đảo ≤ 45 ms; cache canvas thêm ≤ 4 MB ở 2×.
- Cấm trong đường vẽ mỗi khung (§3.3): `shadowBlur`, `filter`, `getImageData`/`putImageData`, tạo gradient, tạo
  mảng/object/chuỗi màu mới, canvas mới trên sân khấu, `globalCompositeOperation` mới.
- Vượt ngân sách thì cắt hạng mục theo thứ tự: dấu chân, quầng sáng dây đèn, đồ trên bàn. Không nới ngân sách.
- Mỗi file trong `web/` ≤ 700 dòng (đếm bằng `split('\n')`), mỗi dòng ≤ 120 ký tự, Prettier 3.3.3
  (`npx --yes prettier@3.3.3 --write web`). Các file đã sát trần: `office-draw.js` 678, `island-life.js` 678,
  `office-draw-people.js` 656, `dog-logic.js` 699. Thêm vào đó tối đa một dòng gọi; phần mới nằm ở file mới.
- Hàm nào `IslandScene` mượn mà gọi `this.x(...)` thì `x` phải có trong `SCENE_METHODS` (`web/island-scene.js`).
- Mọi khoá `tr('...')` là chuỗi nguyên văn và có đủ ở 7 file `web/i18n/*.js`.
- Ngoài mùa đông và ngoài sự kiện, ảnh chụp trang phải giống hệt trước khi làm.
- Không đụng năm mới (`SeasonTree.SEASONS.newyear`).
- Commit theo từng task; thông điệp tiếng Anh kiểu repo (`feat: …`, `fix: …`).

## Review Focus

1. **Mức tuyết dao động quanh ngưỡng** (0,45 hoặc 0,8) khi tuyết đang rơi/tan: không được nướng lại ảnh đảo qua lại.
   Mong đợi: mức chỉ đổi theo `snB` (bước 0,1), mỗi lần đổi `snB` nướng đúng một lần như hôm nay. Test ở Task 2.
2. **Ranh giới ngày và giờ:** 30/11 23:59, 1/12 00:00, 26/12 23:59, 27/12 00:00, 24/12 17:59 / 18:00, 25/12 05:59 /
   06:00, và năm nhuận. Mong đợi: sự kiện bật/tắt đúng phút, không lệch múi giờ (dùng giờ máy người xem). Test ở Task 8.
3. **Xem thử mùa hè khi sự kiện bật** (hoặc sự kiện bật tay vào tháng 7): trang trí hiện, không có tuyết, không vỡ
   hình, không ném lỗi. Test ở Task 8 (logic) và bước chụp ở Task 13.
4. **Chế độ world với nhiều đảo ở nhiều mức thu phóng:** `SCENE_ISLAND_CACHE` chỉ giữ 6 mục; thêm khoá sự kiện không
   được làm cache xoay vòng (nướng lại mỗi khung). Mong đợi: số lần nướng trong 10 giây ở world bằng mốc. Bước đo ở
   Task 7 và 13.
5. **Nhiều người cùng lúc** (16 agent + 8 sub-agent, tất cả ngoài trời ban đêm): vẫn trong ngân sách lệnh vẽ. Bước
   đo ở Task 17 với nguồn mô phỏng (Settings → nguồn dữ liệu mô phỏng, tăng số agent).

---

## Cấu trúc file

| File | Trách nhiệm | Đợt |
|---|---|---|
| `tools/perf-frame.mjs` (mới) | Đo JS mỗi khung, lệnh canvas mỗi khung, thời gian nướng; giả lập ngày giờ | 1 |
| `tools/shot.mjs` (mới) | Chụp trang ở ngày giờ giả lập, để so trước/sau | 1 |
| `web/snow-logic.js` (mới) | Mức dày, bảng màu tuyết, hệ số đêm, vị trí ụ tuyết và nhũ băng, bộ đệm dấu chân | 1 |
| `web/island-art-snow.js` (mới) | Vẽ tuyết vào ảnh đảo và prop lúc nướng | 1 |
| `web/office-draw-winter.js` (mới) | Mixin: tuyết trên vật vẽ mỗi khung, dấu chân | 1 |
| `web/event-logic.js` (mới) | Lịch sự kiện, lựa chọn, vị trí cây lớn, toạ độ dây đèn | 2 |
| `web/island-art-xmas.js` (mới) | Cây thông lớn, quà, kẹo gậy, đèn lồng: vẽ lúc nướng | 2 |
| `web/office-draw-xmas.js` (mới) | Mixin: bóng đèn, quầng sáng, vòng nguyệt quế, đồ trên bàn | 2 |
| `web/outfit-logic.js` (mới) | Gán trang phục theo `sid` | 3 |
| `web/office-people-xmas.js` (mới) | `shirtOf`, mũ, khăn | 3 |
| `web/dog-sprites-xmas.js` (mới) | Lớp phủ phụ kiện cho từng khung hình chó | 3 |
| Sửa: `sky-island.js`, `island-art.js`, `island-art-season.js`, `sky-render.js`, `office-draw.js`, `office.js`, `island-scene.js`, `main.js`, `season-tree.js`, `season-island.js`, `office-render-settings.js`, `office-draw-people.js`, `sky-mist.js`, `lib/page-settings.js`, `i18n/*.js` | Chỗ nối | 1–3 |

---

## Đợt 1 — Tuyết có độ dày (§4)

### Task 1: Công cụ đo và chụp

**Files:** Create `tools/perf-frame.mjs`, `tools/shot.mjs`, `tools/README.md`.

**Interfaces — Produces:**
- `node tools/perf-frame.mjs --port 9333 --url http://localhost:4317/ --at 2026-12-20T21:00:00 [--seconds 9]` in ra
  một dòng JSON: `{ at, url, frames, ms_p50, ms_p95, calls_p50, bakes: [[name, ms], ...], gcPct }`.
- `node tools/shot.mjs --port 9333 --url … --at … --out file.png [--w 1512 --h 982 --dpr 2]`.

- [ ] Viết `perf-frame.mjs`: nối CDP tới Chrome đang chạy `--remote-debugging-port`; chèn script trước khi tải trang để
  (a) dời `Date` về `--at`, (b) đếm lệnh `fillRect`/`fill`/`stroke`/`drawImage`/`strokeRect`/`clearRect`/`fillText`
  của `CanvasRenderingContext2D.prototype`, (c) bọc `SkyRender.renderIsland` và `renderProps` **trước** lần nướng đầu
  (đặt cờ `window.__perfWrap` cho `web/sky-render.js` đọc là không được: bọc bằng cách `import('/web/sky-render.js')`
  ngay trong script chèn, trước `main.js`); bọc `ClaudeOffice.prototype.frame` để lấy thời gian. Bỏ 60 khung đầu.
  `gcPct` lấy từ `Profiler` như `perf.mjs` cũ.
- [ ] Viết `shot.mjs` cùng cách dời `Date`.
- [ ] Chạy mốc ở 4 cảnh của §3.1 và ở chế độ world; ghi kết quả vào `tools/README.md` dưới tiêu đề "Mốc 2026-11-10".
  Mong đợi gần số ở §3.1 (p50 3,7–4,9 ms; ~18.400–18.900 lệnh).
- [ ] Chụp mốc: 20/7 12:00, 20/10 12:00, 20/12 12:00, 20/12 21:00 vào `.superpowers/xmas/base-*.png` (không commit).
- [ ] Commit `chore: tools to measure a frame and to shoot the page at a given date`.

### Task 2: `SnowLogic`

**Files:** Create `web/snow-logic.js`, `tests/snow-logic.test.mjs`. Modify `web/main.js` (import).

**Interfaces — Produces:**
- `SnowLogic.depth(snow: number) → 0 | 1 | 2 | 3` với ngưỡng §4.1: `< 0.15` → 0, `< 0.45` → 1, `≤ 0.8` → 2, còn lại 3.
- `SnowLogic.PAL = { lit: '#f6f9fc', base: '#e6eef6', shade: '#c3d3e6', rim: '#9fb4cf', glint: '#ffffff' }`.
- `SnowLogic.NIGHT_K = 0.7` (hệ số tối của tuyết so với cỏ).
- `SnowLogic.drifts(island, W, H) → [{ x, y, h, side }]`: ô có ụ tuyết, `h` 1..3 (nhân 2 px khi vẽ), `side` ∈
  `'wall' | 'tree' | 'rock' | 'bench'`.
- `SnowLogic.icicles(island) → [{ x, y, len }]`: dọc mép trước của đảo, `len` 2..7.
- `SnowLogic.prints() → { n, x: Float32Array(48), y: Float32Array(48), t: Float32Array(48), at }` và
  `SnowLogic.addPrint(buf, x, y, now)`, `SnowLogic.PRINT_LIFE = 12`.

- [ ] Test (thất bại trước):
  - `depth`: `0.14→0`, `0.15→1`, `0.44→1`, `0.45→2`, `0.8→2`, `0.81→3`, `1→3`; mùa đông (`0.65`) → 2.
  - Review Focus 1: với mọi `snB` 0..10, `depth(snB / 10)` không giảm khi `snB` tăng, và chỉ đổi ở đúng 3 chỗ.
  - `drifts`: không ô nào thuộc `island.paths.cells`, `island.pond.cells`, `island.mountain.pool.cells`,
    `island.pond.spots`, `island.rest.bench/fish`; không ô nào trong khối văn phòng; gọi hai lần cho kết quả giống hệt.
  - `icicles`: mọi phần tử nằm trên ô mép của đảo; `2 ≤ len ≤ 7`; xác định.
  - `addPrint`: sau 60 lần gọi, `n === 48` và không có mảng mới được tạo (so tham chiếu `buf.x`).
- [ ] Viết module. `drifts`/`icicles` dùng `hash` của `web/island-grid.js`, không `Math.random`.
- [ ] `node --test tests/snow-logic.test.mjs` qua; commit `feat: snow depth, palette, drifts and icicles as pure logic`.

### Task 3: Tuyết trên bãi cỏ và mép đảo (nướng)

**Files:** Create `web/island-art-snow.js`. Modify `web/sky-island.js` (bảng màu `C`, gọi lớp tuyết sau khi vẽ cỏ),
`web/island-art.js` (mép đảo). Test: `tests/island-art.test.mjs` (thêm).

**Interfaces — Consumes:** `SnowLogic.*`. **Produces:** `drawSnowLawn(lp, P, C, island, env, depth)`,
`drawSnowEdge(lp, P, C, island, depth)` xuất từ `island-art-snow.js`; `env.depth` có trong `light` truyền vào
`renderIsland` / `renderProps` (suy từ `env.snow`, không thêm khoá cache).

- [ ] Test: nướng đảo ở `snow: 0.7` rồi đếm pixel: trong vùng bãi cỏ, ≥ 60 % pixel có kênh lam ≥ kênh lục (tuyết,
  không còn bạc hà); ở `snow: 0` ảnh giống hệt ảnh trước thay đổi (so băm với bản ghi sẵn trong test).
- [ ] `sky-island.js`: khi `depth ≥ 1`, cỏ không trộn về `SNOW` nữa; lớp tuyết vẽ đè bằng `PAL`. Màu tuyết đi qua
  `night()` với hệ số `df` nâng lên theo `NIGHT_K`.
- [ ] `drawSnowLawn`: gợn tuyết theo `hash` ô; mức 1 chừa ngọn cỏ; lối đá chừa, có bờ 1–2 px; ụ tuyết từ `drifts`.
- [ ] `drawSnowEdge`: tuyết nhô mép 1–2 px, nhũ băng từ `icicles` (mức 3 dài đủ, mức 2 một nửa, mức 1 không có).
- [ ] Đo: `perf-frame` cảnh 20/12 ngày: `bakes` mỗi mục ≤ 45 ms cộng lại; lệnh mỗi khung không đổi so với mốc (±20).
- [ ] Chụp 20/12 ngày và đêm, so với mốc; chụp 20/7 phải giống hệt mốc. Commit
  `feat: winter snow has depth on the lawn and over the island's edge`.

### Task 4: Tuyết trên prop và người tuyết mới (nướng)

**Files:** Modify `web/island-art-season.js` (người tuyết, cành cây), `web/island-art-snow.js` (nắp tuyết cho prop),
`web/sky-island.js` (gọi nắp tuyết trong `renderProps`), `web/island-art-lake.js` (mái chòi, đá bước).
Test: `tests/season-island.test.mjs`, `tests/island-art.test.mjs`.

**Interfaces — Produces:** `snowCap(pt, C, x, y, w, depth)` (dải tuyết trên một cạnh ngang, dày theo mức);
`drawSnowman(pt, P, C, m)` giữ chữ ký, `m.look` ∈ `0 | 1 | 2` cho 3 dáng §5.4; `SNOWMAN_EXT = [14, 34, 14, 5]`.

- [ ] Test: mỗi dáng người tuyết vẽ trong khung `SNOWMAN_EXT`; ba dáng cho ba ảnh khác nhau; cao ≥ 26 px.
- [ ] Nắp tuyết cho: bụi, đá, cột đèn, ghế đá, hai tầng mái chòi, đá bước, tán/cành cây theo mức.
- [ ] Vẽ lại người tuyết 3 dáng, có bóng lam.
- [ ] Đo và chụp như Task 3. Commit `feat: snow sits on every prop of the island, and the snowmen are redrawn`.

### Task 5: Tuyết trên vật vẽ mỗi khung

**Files:** Create `web/office-draw-winter.js`. Modify `web/office-draw.js` (1 dòng gọi `this.winterItems(G, items, depth)`),
`web/office-draw-doghouse.js`, `web/office-draw-smoking.js`, `web/office-draw-restroom.js` (mỗi file nhận `depth` và
gọi `snowCapRect`), `web/island-scene.js` (`SCENE_METHODS` thêm `winterItems`, `drawPrints`), `web/main.js`.

**Interfaces — Produces:** mixin `winterItems(G, items, depth)`; hàm module `snowCapRect(R, x, y, w, depth)` (1–2
`fillRect`); toạ độ nắp tuyết tường tính một lần lúc tải module vào mảng số.

- [ ] Vẽ dải tuyết trên: đỉnh tường sau và trái của văn phòng, khối WC, mái ba chuồng chó, xà giàn, bảng EXIT.
- [ ] Đo: lệnh mỗi khung tăng ≤ 150 so với sau Task 4; p50 tăng ≤ 0,1 ms.
- [ ] `tests/island-scene-methods.test.mjs` qua. Chụp ngày/đêm. Commit
  `feat: snow on the office walls, the kennels, the pergola and the restroom block`.

### Task 6: Dấu chân

**Files:** Modify `web/office-draw-winter.js` (`drawPrints(G, t)`), `web/office-agents.js` (thêm dấu khi người đi trên
bãi cỏ), `web/dog-logic.js` **không sửa** (sát trần): dấu chân chó thêm từ `stepDogs` trong `office-agents.js`.

- [ ] Thêm dấu mỗi 0,5 ô đi được khi `depth ≥ 2`, ô thuộc `LAWN_WALK`, không giảm chuyển động.
- [ ] `drawPrints`: một `fillRect` 2×1 mỗi dấu, `globalAlpha` theo tuổi; vẽ ngay sau ảnh đảo, trước sprite.
- [ ] Đo: lệnh tăng ≤ 48. Nếu tổng đợt 1 vượt 250 lệnh hoặc p50 vượt +0,15 ms thì bỏ task này (ghi vào PR).
- [ ] Commit `feat: people and dogs leave footprints in the snow`.

### Task 7: Chốt đợt 1

- [ ] `node --test tests/*.test.mjs` qua hết; Prettier sạch.
- [ ] `perf-frame` 4 cảnh + world (Review Focus 4: số `bakes` trong 9 giây ở world bằng mốc). Ghi bảng trước/sau vào
  `tools/README.md` và mô tả PR.
- [ ] Đo GPU trên app hình nền thật. App không giả lập được ngày, nên chọn mùa đông bằng tay trong Settings của
  trình duyệt (hình nền theo qua server) rồi đo bằng `top` như spec perf; ghi số trước/sau.
- [ ] `CHANGELOG.md` mục Changed: tuyết mùa đông. Mở PR "Winter snow with depth".

---

## Đợt 2 — Làm lại sự kiện Noel (§5)

### Task 8: `EventLogic`

**Files:** Create `web/event-logic.js`, `tests/event-logic.test.mjs`. Modify `web/season-tree.js`
(`christmas.from: '12-01'`), `web/season-island.js` (`holidayTrees` trả tập rỗng cho `christmas`), `web/main.js`.

**Interfaces — Produces:**
- `EventLogic.active(date: Date, choice: 'auto' | 'on' | 'off', preview?: { until: number }, now?: number)` →
  `null | { key: 'christmas', level: 1 | 2 | 3, eve: boolean, day: boolean }`.
- `EventLogic.cacheKey(ev) → '' | 'x1' | 'x2' | 'x3'`.
- `EventLogic.loadChoice(storage)`, `saveChoice(storage, choice)`, `startPreview(now)` (1 phút), khoá storage
  `terrarium.event`.
- `EventLogic.bigTreeTile(island, W, H) → [x, y]`.
- `EventLogic.lightString(points: number[][], gap: number, max: number) → Float32Array` (x, y xen kẽ).
- `EventLogic.MAX_BULBS = 120`, `EventLogic.GIFTS = [0, 2, 5, 9]` (theo mức).

- [ ] Test:
  - Lịch: 30/11 → `null`; 1/12 và 7/12 → mức 1; 8/12, 14/12 → 2; 15/12, 26/12 → 3; 27/12 → `null`.
  - Review Focus 2: 30/11 23:59:59 → `null`, 1/12 00:00:00 → mức 1; 26/12 23:59:59 → 3, 27/12 00:00:00 → `null`;
    `eve` sai lúc 24/12 17:59, đúng lúc 18:00 và 25/12 05:59, sai lúc 06:00; `day` đúng cả ngày 25/12; năm 2028 (nhuận)
    cho cùng kết quả.
  - `choice 'off'` → `null` vào 20/12; `'on'` → mức 3 vào 20/7 (Review Focus 3), `eve`/`day` sai.
  - `bigTreeTile`: ngoài khối văn phòng, không sau tường (`behindWalls` sai), không thuộc lối đi/nước/bậc thang/chuồng
    chó/giàn/chỗ người đứng, cách lối đi ≥ 1 ô, xác định.
  - `lightString`: số bóng ≤ `max`; khoảng cách hai bóng liền nhau trong `[gap - 1, gap + 1]`.
  - `SeasonTree.seasonFor(new Date(2026, 10, 25))` không còn là `christmas`.
- [ ] Viết module; commit `feat: the event calendar and its places as pure logic`.

### Task 9: Công tắc trong Settings và chia sẻ qua server

**Files:** Modify `web/office-render-settings.js`, `web/office.js` (`this.eventChoice`, `eventNow()`, đưa
`EventLogic.cacheKey` vào điều kiện nướng lại ở `office-draw.js`), `web/island-scene.js` (getter `eventChoice`,
`eventNow` vào `SCENE_METHODS`), `lib/page-settings.js` (`clean` nhận thêm `event: 'auto' | 'on' | 'off'`),
`tests/page-settings.test.mjs`, `web/i18n/*.js`.

**Interfaces — Produces:** `this.eventNow() → kết quả EventLogic.active`; khoá i18n `settings.event.title`,
`settings.event.auto`, `settings.event.on`, `settings.event.off`, `settings.event.now`, `settings.event.preview`,
`event.christmas.label`.

- [ ] Test `page-settings`: `clean({ weather: {...}, event: 'on' })` giữ `event`; giá trị lạ → `'auto'`; thiếu
  `event` vẫn hợp lệ (tương thích ngược).
- [ ] Settings: mục "Sự kiện" dưới "Mùa" (Tự động / Bật / Tắt, dòng "Đang", nút xem thử 1 phút). Lưu storage và đẩy
  qua `pushSettings` như thời tiết; `adoptSettings` nhận `event`.
- [ ] Khoá cache ảnh đảo thêm `ev` (so `ic.ev !== cacheKey`). Review Focus 4: `SCENE_ISLAND_CACHE` khoá theo `k` như
  cũ; kiểm rằng một đảo đổi `ev` không xoá cache của đảo khác.
- [ ] `tests/i18n.test.mjs` qua. Commit `feat: an Event choice in Settings, shared with the wallpaper`.

### Task 10: Cây thông lớn

**Files:** Create `web/island-art-xmas.js`, `web/office-draw-xmas.js`. Modify `web/sky-island.js` (`renderProps` thêm
prop cây khi `env.event`), `web/office-draw.js` (1 dòng `this.xmasItems(G, items, ev)`), `web/island-scene.js`.

**Interfaces — Produces:** `drawBigTree(pt, P, C, tile, level, depth)` và `BIG_TREE_EXT = [26, 70, 26, 8]`; bảng
`BIG_TREE_BULBS: Float32Array` (24 bóng, x/y so với gốc) và `BIG_TREE_STAR`; mixin `xmasItems(G, items, ev)`;
`glowSprite(color) → canvas 12×12` (dựng một lần cho mỗi màu, 4 màu `#e5484d #ffd166 #46a758 #5ec8ff`) và
`glowSprite('tree') → 64×40`.

- [ ] Test (`tests/island-art.test.mjs`): cây vẽ trong `BIG_TREE_EXT`; cao ≥ 60 px; số hộp quà đúng `GIFTS[level]`.
- [ ] Prop cây nướng: thân, 4 tầng lá, tuyết trên lá theo `depth`, kim tuyến, quà.
- [ ] Mỗi khung: 24 bóng (4 nhóm, 1 Hz lệch pha, sáng đều khi giảm chuyển động), sao, và ban đêm một quầng lớn dưới
  gốc. Sắp theo chiều sâu như prop.
- [ ] Đêm: prop cây nướng với mức tối riêng (không nhận lớp tối của bãi cỏ).
- [ ] Đo: lệnh tăng ≤ 60. Chụp ngày/đêm. Commit `feat: one big Christmas tree in front of the office`.

### Task 11: Dây đèn

**Files:** Modify `web/office-draw-xmas.js`, `web/office-draw-doghouse.js`, `web/office-draw-smoking.js` (xuất toạ độ
mái/xà đã có để tính dây), `web/island-art-lake.js` (xuất toạ độ mái chòi).

**Interfaces — Consumes:** `EventLogic.lightString`, `glowSprite`. **Produces:** `XMAS_LIGHTS: Float32Array` tính một
lần lúc tải, kèm `XMAS_LIGHTS_LEVEL: Uint8Array` (mức tối thiểu của từng bóng: tường 1, chuồng và giàn 2, chòi 3).

- [ ] Test (`tests/event-logic.test.mjs`): tổng số bóng ≤ 120; mỗi bóng có mức 1..3.
- [ ] Vẽ: một `fillRect` 2×2 mỗi bóng; ban đêm thêm một `drawImage` quầng với `globalAlpha` theo mức tối. Bóng trên
  vật nào thì vẽ trong item của vật đó để đúng thứ tự che.
- [ ] Đo: ngày +≤ 120 lệnh, đêm +≤ 240. Nếu đêm vượt tổng ngân sách đợt, bỏ quầng của dây đèn (giữ bóng).
- [ ] Commit `feat: strings of lights on the walls, the kennels, the pergola and the pavilion`.

### Task 12: Trang trí còn lại

**Files:** Modify `web/island-art-xmas.js` (kẹo gậy, đèn lồng chòi), `web/office-draw-xmas.js` (vòng nguyệt quế, đồ
trên bàn), `web/sky-mist.js` + `web/sky-render.js` (đảo nhỏ theo sự kiện, thêm `event` vào `id` của sprite),
`web/island-art-season.js` (một người tuyết đội mũ Noel).

**Interfaces — Produces:** `deskDecor(R, i, x, y)` chọn món theo `hash(i)`: cây mini / tất / kim tuyến, ≤ 4
`fillRect`; `wreath(R, x, y)` ≤ 5 `fillRect`.

- [ ] Vòng nguyệt quế: cửa EXIT, hai cửa WC, ba cửa chuồng chó (mức 1).
- [ ] Kẹo gậy dọc lối đá (mức 2, prop nướng). Đèn lồng đỏ ở chòi (mức 3, trong prop chòi).
- [ ] Đồ trên bàn: chỉ bàn có chủ, mức 2.
- [ ] Ba đảo nhỏ: cây thông có đèn, người tuyết, nhà gỗ sáng đèn (mức 2).
- [ ] Đo: +≤ 110 lệnh. Commit `feat: wreaths, candy canes, desk decorations and festive far islands`.

### Task 13: Chốt đợt 2

- [ ] Test, Prettier, `perf-frame` 4 cảnh + world; tổng so với mốc gốc phải trong ngân sách §3.4.
- [ ] Review Focus 3: chụp 20/7 với sự kiện bật tay: có trang trí, không tuyết, console không lỗi.
- [ ] Chụp 30/11 và 27/12: không có gì của sự kiện.
- [ ] Đo GPU app hình nền (sự kiện bật tay, ban đêm): tăng ≤ 3 điểm.
- [ ] `CHANGELOG.md`, README (mục Settings). PR "Christmas event".

---

## Đợt 3 — Trang phục (§6)

### Task 14: `OutfitLogic`

**Files:** Create `web/outfit-logic.js`, `tests/outfit-logic.test.mjs`. Modify `web/main.js`.

**Interfaces — Produces:**
- `OutfitLogic.KINDS = ['santa', 'sweater', 'reindeer', 'coat', 'snowman']`.
- `OutfitLogic.outfit(sid, ev, isSub, deptColor) → null | { kind, top, trim, hat, hatColor, scarf }`: `null` khi
  `ev` là `null`; `ev.level === 1` → chỉ `{ kind: 'hat', hat: 'santa', hatColor: '#c8323a' }`; sub-agent luôn
  `kind: 'elf'`, `top: '#2f8f4e'`, `hat: 'elf'`; `scarf` luôn là `deptColor` (trừ `elf` và mức 1); bộ `coat` có
  `top: deptColor`. Màu theo bảng §6.1.

- [ ] Test: cùng `sid` → cùng bộ (gọi 100 lần); 1.000 `sid` ngẫu nhiên chia vào 5 bộ, mỗi bộ 15–25 %; sub-agent luôn
  `elf`; `ev: null` → `null`; mức 1 → chỉ mũ; `scarf === deptColor` cho mọi bộ của agent chính ở mức ≥ 2.
- [ ] Viết module (dùng `PeopleLogic.hash`). Commit `feat: who wears what at Christmas, as pure logic`.

### Task 15: Trang phục trên người

**Files:** Create `web/office-people-xmas.js`. Modify `web/office-draw-people.js`, `web/office-draw-furniture.js`,
`web/office-draw-fall.js`, `web/office-draw-fate.js` và mọi chỗ đọc `a.shirt` (14 chỗ, `grep -n "\.shirt\b" web`),
`web/office-agents.js` (gán `a.outfit` khi thêm agent và khi `ev` đổi).

**Interfaces — Consumes:** `OutfitLogic.outfit`. **Produces:** `shirtOf(a) → string`; `hatEvent(R, o, sx, hy)` và
`scarf(R, o, sx, sy)`, mỗi hàm ≤ 4 `fillRect`; `a.outfit` (hoặc `null`).

- [ ] Test (`tests/outfit-logic.test.mjs`, thêm): đọc nguồn `web/*.js`, không còn `a.shirt` / `f.shirt` nào ngoài
  `office-people-xmas.js` và chỗ gán ban đầu (giống cách `tests/island-scene-methods.test.mjs` đọc nguồn).
- [ ] Thay mọi chỗ đọc màu áo bằng `shirtOf(a)`. Không thêm dòng ở `office-draw-people.js` ngoài các lời gọi mũ/khăn
  (file đang 656 dòng; nếu vượt 690 thì chuyển `actArms` sang file mới trước).
- [ ] Gọi `hatEvent` sau khi vẽ tóc và `scarf` sau khi vẽ thân ở: đứng/đi, ngồi bàn, ghế cao, ngủ gục, nhìn từ sau;
  tắm hồ chỉ mũ. Băng vàng của sub-agent không vẽ khi có `outfit`.
- [ ] Chụp từng tư thế (dùng `__fate` và nguồn mô phỏng) ngày và đêm.
- [ ] Đo: +≤ 8 lệnh mỗi người. Commit `feat: people dress for Christmas`.

### Task 16: Phụ kiện cho chó

**Files:** Create `web/dog-sprites-xmas.js`, `tests/dog-sprites-xmas.test.mjs`. Modify `web/office-draw-people.js`
(`dogSprite` thêm tham số `ev` vào khoá và áp lớp phủ: ≤ 6 dòng), `web/office-draw-doghouse.js` (truyền `ev` cho chó
trong chuồng).

**Interfaces — Produces:** `DogXmas.overlay(breed, frameName) → [[x, y, colorKey], ...]` và
`DogXmas.PAL = { r: '#c8323a', w: '#f4f1e8', b: '#8a5a3a', n: '#ff4d4d' }`.

- [ ] Test: với mọi giống và mọi tên khung hình trong `DogSprites.BREEDS[breed].frames`, `overlay` trả mảng không
  rỗng; mọi điểm nằm trong kích thước khung hình; corgi có điểm màu `n` (mũi đỏ) ở mọi khung thấy mặt.
- [ ] Viết bảng lớp phủ; áp trong `dogSprite` sau khi vẽ pixel gốc, trước khi lưu cache; khoá cache thêm
  `EventLogic.cacheKey(ev)`.
- [ ] Đo: lệnh mỗi khung không đổi; số sprite trong cache ≤ 300 như cũ.
- [ ] Commit `feat: the dogs get antlers, a scarf and a sweater`.

### Task 17: Chốt đợt 3

- [ ] Test, Prettier, `perf-frame` 4 cảnh + world.
- [ ] Review Focus 5: nguồn mô phỏng với 16 agent + 8 sub-agent, đêm 20/12: lệnh mỗi khung và p50 trong ngân sách.
- [ ] Kiểm nhận diện: chụp cận 6 người thuộc 3 phòng ban; khăn quàng đúng màu chip phòng ban; sub-agent có mũ nhọn.
- [ ] `CHANGELOG.md`. PR "Christmas outfits".

---

## Đợt 4 và 5 (plan riêng, viết sau đợt 3)

- **Đợt 4, nhân vật (§7):** `web/event-critters.js` (logic tuần lộc, yêu tinh, chim cánh cụt), sprite cache chung,
  xe trượt trên canvas trời sau, quà dù. Ngân sách: 20 lệnh. Dựa vào `EventLogic.active`, `bigTreeTile`, `GIFTS`.
- **Đợt 5, hành vi (§8):** 5 hoạt động nghỉ, 4 kiểu ra đi thêm vào `FateLogic`, câu thoại 7 ngôn ngữ, hơi thở. Ngân
  sách: 150 lệnh. Dựa vào `SnowLogic.depth`, `EventLogic.active`, `shirtOf`.

Hai plan đó chỉ được viết khi phần dự phòng 462 lệnh của §3.4 chưa bị đợt 1–3 dùng quá 200.
