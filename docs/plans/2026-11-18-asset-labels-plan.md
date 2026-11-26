# Asset có nhãn, event là bảng dữ liệu — kế hoạch triển khai

> **Cho agent thực hiện:** BẮT BUỘC dùng superpowers:subagent-driven-development (khuyến nghị) hoặc
> superpowers:executing-plans để làm theo từng task. Các bước dùng checkbox (`- [ ]`).

**Mục tiêu:** khi một event bật, mọi asset cùng nhãn đổi cùng lúc sang biến thể của event; mọi nơi vẽ đọc một Look duy
nhất tính từ một Moment duy nhất; chuyển event không còn lệch nhịp; không tràn chữ; trang `/assets` đọc chung bảng.

**Kiến trúc:** `web/moment.js` (Moment mỗi khung hình) → `web/themes/*.js` (gói dữ liệu) → `web/theme.js` (resolver ra
Look, nhớ theo `moment.key`) → `web/labels.js` (nhãn + instance) → `web/paint.js` (painter theo nhãn/biến thể/overlay) →
code vẽ hỏi Look. Phần sống hoà giải một lần khi `look.key` đổi (`web/look-change.js`).

**Công nghệ:** ES module thuần trong `web/`, Canvas 2D, React 18 UMD (createElement), `node --test`.

**Spec:** `docs/specs/2026-11-18-asset-labels-design.md` (đọc cả mục 2 — vị trí từng lỗi — và mục 6 — bảng nhãn Noel).
Bản rà soát vẽ: `docs/specs/2026-11-16-assets-inventory.md` §0 (6 kiểu chữ ký vẽ: K, PK, ST, IP, SP, M, B).

## Ràng buộc chung

- Module `web/` ≤ 700 dòng, dòng ≤ 120 ký tự; `npx --yes prettier@3.3.3 --write web` (`tests/web-style.test.mjs`).
  `office-draw.js`, `office-draw-people.js`, `office-agents.js`, `dog-logic.js` đã sát 700: thêm code thì tách ra file mới.
- Module mới phải được import từ `web/main.js` (trang chính) và/hoặc `web/assets-main.js` (`tests/web.mjs moduleGraph`).
- Chữ qua `tr('…')`, khoá viết thẳng, đủ 7 ngôn ngữ (vi en ja ko zh es th); `tests/i18n.test.mjs` hỏng nếu thiếu/thừa.
- Mỗi khung hình: không `shadowBlur`, filter, `getImageData`, gradient/canvas mới; `look.of/decor/has` không cấp phát.
- Test có nạp `office-scene`: `globalThis.React ??= { createElement: () => null }` và `loadI18n('vi')` trước.
- **D1:** event có một dáng từ ngày đầu (spec §7 D1, D1b); chỉ số hộp quà tăng theo ngày (`build.gifts`).
- Không push. Không đụng cổng 4317, `~/.claude-terrarium/page-settings.json` của anh PO, `~/.claude/sessions`. Server
  thử chạy cổng 4330 từ worktree này (`PORT=4330 node server.js`), dừng theo PID. Headless Chrome cổng 9333, dừng theo PID.
- Trang thử phải chặn POST và không nhận thiết lập chung (mẫu: `.superpowers/xmas/sw-A.js`).
- Commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Chuyển event **khi đang tạm dừng** — mọi thứ (cây, đèn, đồ, tuần lộc, Santa, đống quà) đổi trong cùng một khung hình
   (test ở Task 10).
2. Bật event ngày **18/11** (đang có lễ Nhà giáo) — không còn cây chồng sách, chip không nhắc Nhà giáo (test ở Task 2).
3. **Chế độ thế giới**: đảo chi tiết và đảo vẽ đơn giản cùng thấy event, cùng khung hình với đảo chính (test ở Task 3, 6).
4. Lựa chọn event đổi ở **Simulation** rồi quay lại Live — lựa chọn mới không bị giá trị cũ của server đè (test Task 11).
5. Câu dài nhất của mỗi ngôn ngữ trong bong bóng và Settings (es, ja, vi) không vượt ngân sách (test Task 12).

---

### Task 1: Gói dữ liệu, nhãn và resolver

**Files:**
- Create: `web/labels.js`, `web/theme.js`, `web/themes/base.js`, `web/themes/winter.js`, `web/themes/christmas.js`,
  `web/themes/holidays.js`
- Test: `tests/theme.test.mjs`, `tests/labels.test.mjs`

**Interfaces:**
- Produces:
  - `Labels.LIST: [{ id, group, variants: string[], overlays: string[] }]`, `Labels.byId(id)`; nhãn đúng bảng spec §6
    (id y hệt: `tree.island`, `tree.holiday`, `tree.far`, `tree.world`, `bush`, `flower`, `mushroom`, `rock`, `bench`,
    `lamp`, `floor.office`, `floor.corridor`, `floor.zone`, `floor.pantry`, `floor.wc`, `wall.outer`, `wall.inner`,
    `window`, `door`, `desk`, `chair`, `monitor`, `board.usage`, `shelf`, `plant.pot`, `clock`, `pantry.item`, `pergola`,
    `kennel`, `pavilion`, `stairs`, `plinth`, `outfit.agent`, `outfit.subagent`, `dog.costume`). `instances` thêm ở Task 4.
  - Gói: `{ key, kind: 'base'|'season'|'holiday'|'event', season?, weather?, swap, decor, extras, rules, text, build }`.
    `BASE.swap` cho mọi nhãn (giá trị chuỗi, hoặc `{ spring, summer, autumn, winter }` cho nhãn theo mùa).
  - `Theme.PACKS` (base, winter, christmas, mọi lễ nhỏ của `SeasonTree.SEASONS` có `type` 'event'|'lunar' trừ
    `christmas`), `Theme.resolve(moment) → Look` với `Look = { of(label), decor(label), has(rule), text(key), build(name),
    extras: Set, key, keyOf(labels) }`, đóng băng; nhớ theo `moment.key`.
  - `Theme.SAME = 'same'`: trong gói event, `swap[label] === 'same'` nghĩa là giữ biến thể của lớp dưới.

- [ ] **Step 1: Viết test** `tests/theme.test.mjs`:
  - `resolve: summer, no event → tree.island 'green', decor(door) []`
  - `resolve: winter, no event → tree.island 'bare'; extras has 'igloo', 'bear'; has('idle.snowball') false`
  - `resolve: christmas → tree.island 'fir', tree.holiday 'xmas', bush 'holly', floor.corridor 'runner',
     decor('door') includes 'wreath', decor('wall.outer') deep-equal ['garland','lights'], decor('desk') ['xmas-desk'],
     has('critter.reindeer') true, has('critter.elf') true, text('office.act.coffee') 'office.act.cocoa'`
  - `resolve: christmas build.gifts by event.since → 0:2, 7:5, 14:9, 25:9`
  - `resolve: holiday teachers in autumn → tree.holiday 'teachers'; with christmas on too → tree.holiday 'xmas'`
  - `resolve: same moment.key twice → the very same Look object`
  - `resolve: of() on an unknown label throws` (bắt lỗi gõ sai nhãn sớm)
  - `look.key differs between summer/winter/christmas and is stable across calls`
- [ ] **Step 2: Viết test** `tests/labels.test.mjs`:
  - `every event pack declares every label in swap (a variant or 'same')` — duyệt `Theme.PACKS` có `kind === 'event'`.
  - `every swap value is one of the label's variants (or 'same')`, `every decor value is one of its overlays`.
  - `a test pack {kind:'event', swap: every label 'same' except tree.island:'test'} resolves without code changes`.
- [ ] **Step 3: Chạy** `node --test tests/theme.test.mjs tests/labels.test.mjs` — Expected: FAIL (module chưa có).
- [ ] **Step 4: Viết** các module. Thứ tự áp: base(theo mùa) → winter (khi `moment.season === 'winter'`) → holiday (khi
  `moment.holiday`) → event (khi `moment.event`). `decor` và `extras` cộng dồn; `rules`/`text` gói sau đè. Nội dung
  `christmas.js` theo spec §6 + `rules` cho mọi thứ hôm nay đang gate theo event (critter.reindeer/elf/penguin/santa,
  sleigh, idle.snowball/snowman/skate/gift, fate.sleigh: 4, fate.wrapped: 4, fate.skateoff: 5, fate.chimney: 3,
  cathedral, tree.big, cane, gifts), `season: 'winter'`, `weather: { snowFloor: 0.45, rainToSnow: true }`,
  `build.gifts: [[0, 2], [7, 5], [14, 9]]` (ngày thứ 0–6: 2 hộp, 7–13: 5, từ 14: 9).
- [ ] **Step 5: Chạy** lại — Expected: PASS. `node --test tests/*.test.mjs` — Expected: toàn bộ PASS.
- [ ] **Step 6: Commit** `feat: labels, theme packs and the resolver that turns a moment into a look`

### Task 2: Moment

**Files:**
- Create: `web/moment.js`; Modify: `web/event-logic.js` (`active`), `web/season-logic.js` (`seasonChip`, `seasonLabel`)
- Test: `tests/moment.test.mjs`; sửa `tests/event-logic.test.mjs`, `tests/season-logic*.test.mjs` nếu có

**Interfaces:**
- Consumes: `Theme.PACKS` (Task 1).
- Produces:
  - `Moment.at({ date, now, seasonChoice, seasonPreview, eventChoice, eventPreview, df, snow }) → { season, event:
    null|{ key, since }, holiday: null|key, df, night, snow, forced: { season, weather }, key }`.
  - `EventLogic.active(date, choice, preview, now) → null | { key: 'christmas', since, level: 3, eve: true, day: true }`
    — `since` = số ngày từ 1/12 (0-based; 'on' và preview: 14). **`level: 3, eve, day` là lớp đệm tạm** cho code cũ; xoá
    ở Task 14.
  - `SeasonLogic.seasonChip(moment)` và `seasonLabel(moment)` nhận Moment (không nhận khoá lễ rời nữa).
- [ ] **Step 1: Test** `tests/moment.test.mjs`:
  - `18 Nov 2026, auto/auto → holiday 'teachers', event null, season autumn`
  - `18 Nov 2026, event 'on' → event.key christmas, holiday null, season winter, forced.season true`
  - `20 Dec 2026, event 'off' → event null, holiday null` (không còn 'christmas' như lễ nhỏ)
  - `18 Nov 2026, season choice 'summer' → holiday null` (D2: chọn tay mùa thì không có lễ nhỏ)
  - `20 Dec 2026, auto → event.since 19`
  - `key equal for two dates in the same day band; differs when night flips or snow band changes`
  - `seasonChip(moment with christmas) label contains tr('event.christmas'); with event off in Dec it does not`
- [ ] **Step 2: Chạy** — Expected: FAIL. **Step 3: Viết** (lễ nhỏ lấy từ `SeasonTree.seasonFor(date)` chỉ khi
  `seasonChoice === 'auto'`, không preview mùa, không event; `night = df < 0.5`; dải tuyết = `SnowLogic.depth(snow)`).
- [ ] **Step 4: Chạy** toàn bộ test — Expected: PASS. **Step 5: Commit** `feat: one moment for the season, the event and
  the holiday`

### Task 3: Host đọc Moment và Look (một nguồn cho mọi cảnh)

**Files:** Modify: `web/office.js` (`frame`, `eventNow`, `seasonNow`, getter `season`/`treeOn`, env ~`:560-600`),
`web/island-scene.js` (`seasonNow`, getter `season`/`treeOn` dòng ~182), `web/office-draw.js` (`:577` bỏ
`SeasonTree.seasonFor(new Date())`; `:241-257` cây lễ), `web/office-render.js:139` (chip), `web/office-render-settings.js`
(`:14-35` "Hiện tại", `:58-82`), `web/world-draw.js` (đảo vẽ đơn giản nhận `look`).
- Test: `tests/host-moment.test.mjs`

**Interfaces:**
- Consumes: `Moment.at`, `Theme.resolve`.
- Produces: `this.moment`, `this.look` trên `ClaudeOffice`, tính **mỗi khung hình trước khối `if (!this.state.paused)`**
  và trong `worldFrame`; `IslandScene` có getter `moment`/`look` trả của `host`. `eventNow()` = `this.moment.event` thêm
  lớp đệm Task 2; `seasonNow()` = `this.moment.season`. Getter `season` (khoá lễ) = `this.moment.holiday || 'default'`.
- [ ] **Step 1: Test** `tests/host-moment.test.mjs`: dựng `IslandScene` với host giả `{ moment, look }` (xem cách
  `tests/assets-*.test.mjs` dựng host) và kiểm `scene.seasonNow() === host.moment.season`, `scene.look === host.look`;
  `ClaudeOffice.prototype.computeMoment.call(fakeHost, date)` cho 18/11 + event 'on' trả `holiday === null`.
- [ ] **Step 2: Chạy** — FAIL. **Step 3:** thêm `computeMoment(date = new Date())` (đọc lựa chọn, preview, `dayFactor()`,
  `this.snowShown`) gọi đầu `frame()` và `worldFrame()`; sửa các nơi đọc như liệt kê. Cây lễ: chỉ dựng khi
  `look.of('tree.holiday') !== 'none'`; biến thể là khoá vẽ cho `SeasonTree.drawSeasonTree` (`xmas` → `'christmas'`).
- [ ] **Step 4:** test toàn bộ PASS; chụp `--at 2026-11-18T12:00:00` với `sw-A.js` sửa `eventChoice='on'` → không còn cây
  chồng sách, chip "Mùa đông · Giáng sinh". **Step 5: Commit** `fix: every scene reads one moment; holiday trees and the
  chip follow the Settings choice, not the bare date`

### Task 4: Danh sách instance theo nhãn

**Files:** Create: `web/office-instances.js`; Modify: `web/labels.js` (`instances`), `web/office-draw.js` (`:373` và
`:586` dùng `WINDOWS`), `web/office-draw-xmas.js` (`WREATH_SPOT` → `DOORS`)
- Test: `tests/office-instances.test.mjs`

**Interfaces:**
- Produces (thuần, toạ độ ô/scene): `WALLS: [{ id, kind: 'outer'|'inner', a: [x,y], b: [x,y], z0, z1, face }]` gồm tường
  sau + trái văn phòng và tường sau, trước, đông của khối WC (`kind 'outer'`), vách phòng WC (`'inner'`); `DOORS: [{ id,
  kind: 'exit'|'wc'|'kennel', at: [x, y, z] }]` lấy từ cùng hình học với `F.door` (`decor-wall.js`), cửa WC
  (`office-draw-restroom.js` swing doors), `DOG_HOUSES`; `WINDOWS: [{ id, x }]` (1.6, 4.8, 11.6, 14.8); `POTS` (3 cây
  chậu góc, `office-draw.js:618-622`), `CLOCK`, `SHELF`, `KENNELS = DOG_HOUSES`.
- [ ] **Step 1: Test:** `DOORS has 1 exit, 2 wc, 3 kennel`; `WALLS outer includes ids office.back, office.left, wc.back,
  wc.front, wc.east`; `WINDOWS used by office-draw (readWeb('office-draw') has no literal [1.6, 4.8, 11.6, 14.8])`;
  `every label with instances has a non-empty list`; `exit wreath spot equals DOORS exit at` (không còn `P(0, 7.05, 24)`).
- [ ] **Step 2–4:** FAIL → viết → PASS (ảnh không đổi: chụp trước/sau 20/7, so pixel = 0 khác biệt ngoài người đi lại).
- [ ] **Step 5: Commit** `refactor: one list of walls, doors, windows and pots for every asset that hangs on them`

### Task 5: Painter và overlay theo nhãn (đèn dây, vòng hoa, đồ bàn, chuồng, góc hút thuốc, chòi)

**Files:** Create: `web/paint.js`; Modify: `web/office-draw-xmas.js` (`STRINGS` dựng từ `WALLS` outer + kennel + pergola
+ pavilion, bỏ trường `level`; `WREATHS` từ `DOORS`; đồ bàn mọi bàn), `web/office-draw-restroom.js` (gọi overlay tường/cửa
WC), `web/office-draw-doghouse.js:203`, `web/office-draw-cathedral.js` (`ev.level >= 2/3` → `look.has`)
- Test: `tests/paint.test.mjs`, mở rộng `tests/labels.test.mjs`

**Interfaces:**
- Produces: `Paint.variant(label, variant, fn)`, `Paint.overlay(label, overlay, fn)`, `Paint.has(label, id)`,
  `Paint.overlaysOf(label, look) → array dùng lại`. Code vẽ gọi overlay trên **mọi instance** của nhãn.
  `EventLogic.MAX_BULBS` (120) vẫn là trần tổng bóng đèn: chia lại tỉ lệ khi thêm tường WC.
- [ ] **Step 1: Test:** `every (label, overlay) in every pack has a painter`; `STRINGS covers every outer wall`
  (`tests/office-instances`) ; `bulbs total ≤ 120`; `DESK decorations: one per desk, owner or not`
  (`ClaudeOffice.prototype.xmasItems.call` với host giả có 0 agent → đủ `DESKS.length` mục đồ bàn).
- [ ] **Step 2–4:** FAIL → viết → PASS. Chụp 20/12 trưa/tối: cửa WC có vòng hoa, tường WC có đèn.
- [ ] **Step 5: Commit** `feat: every door gets the wreath, every outer wall the lights, every desk its decoration`

### Task 6: Cây, bụi, đảo xa, đảo thế giới đọc Look

**Files:** Modify: `web/sky-island.js` (`:211` `fir`, `:221-232` extras), `web/sky-render.js:138`, `web/sky-mist.js`
(`farIsland(..., festive)` → tham số `treeVariant` từ `look.of('tree.far')`), `web/world-ui.js` (`tree()` thêm `'fir'`),
`web/world-draw.js:333` (khoá ảnh có `look.keyOf(['tree.world'])`), `web/island-art.js` (`drawBush` nhận biến thể;
thêm `holly`), `web/office-draw.js:203-210` (khoá ảnh đảo: `look.keyOf(OUTDOOR_LABELS)` thay `cacheKey(ev)`)
- Test: `tests/island-look.test.mjs`

**Interfaces:** `env.look` (thay `env.event` số) trong mọi env truyền xuống `renderIsland/renderProps/drawBack`.
`OUTDOOR_LABELS` export từ `web/labels.js` (nhóm `island`).
- [ ] **Step 1: Test:** `renderProps reads look.of('tree.island') for every tree` (đếm qua painter giả đăng ký bằng
  `Paint.variant` trong test, hoặc kiểm `readWeb('sky-island')` không còn `env.event`); `farIsland id includes the tree
  variant`; `world simple island art key changes when look changes christmas↔none`; `bush holly paints` (vẽ vào canvas
  giả của `tests/assets-*` — mẫu `recordingCtx`).
- [ ] **Step 2–4:** FAIL → viết → PASS. Vẽ `holly` (lá xanh đậm `#1f5e3a`, quả đỏ `#c8323a`, theo khung `drawBush`) và
  cây thông mini cho `world-ui tree()`. Chụp 20/12 + chế độ thế giới.
- [ ] **Step 5: Commit** `feat: every tree, bush and far island switches with the event, the world view's small islands too`

### Task 7: Đồng phục mọi tư thế, một bản chú lùn, đồ chó theo nhãn

**Files:** Modify: `web/outfit-logic.js:47-60` (`outfit(sid, look, isSub, dept)`: bỏ nhánh `level <= 1`),
`web/office-people-xmas.js:10` (`outfitOf(a, look)`, memo theo `look.of('outfit.agent')`), `web/office-draw-people.js`
(tư thế ngồi `:311-322` có hoa văn, tắm `:181` có khăn, ngủ đủ bộ, `:521` dog cache key = `look.of('dog.costume')`),
`web/office-draw-fall.js:51`, `web/office-draw-fate.js:443-455` (lưu biến thể), `web/office-draw-fate-xmas.js:61`
(chú lùn dùng chung), `web/office-draw-doghouse.js:203`
- Test: mở rộng `tests/outfit-logic.test.mjs`

**Interfaces:** `XMAS.elf` (một bảng màu + hoa văn) dùng cho sub-agent và critter elf (`critter-sprites.js` palette lấy
từ đây). Nếu `office-draw-people.js` vượt 700 dòng thì tách phần đồ Noel sang `web/office-draw-people-xmas.js`.
- [ ] **Step 1: Test:** `outfit under christmas is a full outfit for every sid (no 'hat' kind)`; `sub-agent and critter
  elf share the same palette`; `outfit memo resets when look.of('outfit.agent') changes`; `dog sprite key contains the
  costume variant, not a boolean`.
- [ ] **Step 2–4:** FAIL → viết → PASS. Chụp: người ngồi, đứng, ngủ, tắm cùng bộ đồ.
- [ ] **Step 5: Commit** `fix: the Christmas outfit in every pose, one elf for sub-agents and critters`

### Task 8: Biến thể mới trong văn phòng

**Files:** Create: `web/office-draw-festive.js` (painter Noel cho sàn/cửa sổ/kệ/cây chậu/đồng hồ, đăng ký qua `Paint`);
Modify: `web/office-draw.js` (sàn hành lang `:461-513`, cửa sổ, kệ `:405-456`, cây chậu `:618-651` gọi `Paint`)
- Test: mở rộng `tests/labels.test.mjs` (mọi biến thể/overlay của gói Noel có painter)

**Interfaces:** `floor.corridor: 'runner'` (thảm đỏ `#b3262f` viền vàng `#e2b13c` dọc 2 lối chính, theo `EventLogic`
`TREE_CELLS` để không vẽ dưới cây lớn), `floor.pantry: 'checker-red'`, overlay `window: ['frost', 'star']`,
`shelf: ['garland-small']`, `plant.pot: ['bauble']`, `clock: ['holly-sprig']`. Vẽ bằng `poly/box/rect` của `G`, không
gradient mới.
- [ ] **Step 1: Test** painter coverage + `office-draw.js ≤ 700 dòng`.
- [ ] **Step 2–4:** FAIL → viết → PASS. Chụp ngày/đêm, zoom từng nhãn (`tools/crop.py`).
- [ ] **Step 5: Commit** `feat: Christmas floors, windows, shelf, pot plants and clock`

### Task 9: Hành vi đọc Look (critter, idle, cách rời đảo, quà)

**Files:** Modify: `web/event-critters.js` (`:14-27` bỏ `*_FROM`, `wanted(w)` đọc `w.has`; `:174-181`), `web/office-draw-
critters.js:141-153,186` (`w.look`), `web/event-idle.js:118-125` (`fine(c)` đọc `c.look.has('idle.x')`),
`web/office-draw-idle-xmas.js:35-36`, `web/fate-logic.js:31-35,89-92` (`w: c => c.look.has('fate.sleigh')`),
`web/office-draw-xmas.js:225` (`treeSprite(look.build('gifts'), dfB)`), `web/event-logic.js` (`GIFTS` bỏ),
`web/office-draw-bears.js:93` và `web/polar-bears.js` (`w.winter` → `look.extras.has('bear')`, igloo theo `'igloo'`)
- Test: sửa `tests/event-critters.test.mjs`, `tests/event-idle.test.mjs`, `tests/fate-logic.test.mjs`

**Interfaces:** thế giới critter / ngữ cảnh idle / điều kiện fate nhận `look` (Look của Task 1); không còn `level`.
- [ ] **Step 1: Sửa test** để dựng `look = Theme.resolve(Moment.at({...christmas}))` thay `level: 3`; thêm `winter
  without the event: no snowball/snowman/skate spots, no reindeer` và `christmas day 0: reindeer, elves, penguins, Santa
  all present` (D1b).
- [ ] **Step 2–4:** FAIL → viết → PASS. **Step 5: Commit** `refactor: critters, idle spots and ways to leave ask the look`

### Task 10: Hoà giải khi Look đổi

**Files:** Create: `web/look-change.js` (thuần); Modify: `web/office.js` (`frame`: so `look.key`, gọi `onLook(prev, next)`
cả khi pause), `web/office-agents.js` (rời chỗ event trải đều; tính lại đường khi `BLOCK` đổi), `web/office-draw-
critters.js` (`stepCritters(0)` khi Look đổi), `web/bubble-logic.js:11` (khoá bong bóng gồm khoá chữ đã đổi),
`web/office.js:571-573` (tuyết event tan ~10 s)
- Test: `tests/look-change.test.mjs`

**Interfaces:** `LookChange.diff(prev, next) → { extrasGone: Set, rulesOff: Set, blockChanged: bool, snowFrom, snowTo }`;
`LookChange.stagger(n, rand, span = 3) → number[]` (độ trễ giây cho n người); `LookChange.crosses(path, blocked) → bool`.
- [ ] **Step 1: Test:** `diff christmas→none lists idle/fate/critter rules off and blockChanged true`; `stagger(5) all in
  [0, 3), not all equal`; `crosses detects a path through a newly blocked cell`; host giả: `paused + look change → critter
  world level/extras follow in the same call` (gọi `ClaudeOffice.prototype.onLook.call(fake, prev, next)`).
- [ ] **Step 2–4:** FAIL → viết → PASS. Chụp: pause → tắt event → chụp ngay: không còn tuần lộc/Santa/đống quà.
- [ ] **Step 5: Commit** `fix: switching the event changes everything in the same frame, paused or not`

### Task 11: Đồng bộ lựa chọn và preview có trạng thái

**Files:** Modify: `lib/page-settings.js` (`clean` giữ `updatedAt` số; `set` bỏ giá trị cũ hơn hiện có), `web/office.js`
(`:375-394 adoptSettings`, `:418 pushSettings`: đẩy cả ở sim/asOthers; POST lỗi giữ cục bộ, đánh dấu chờ đẩy lại),
`web/event-logic.js` (`adopt(server, local, opts)` theo `updatedAt`), `web/world-state.js`/`web/world-render.js` (thế giới
đọc thiết lập chung), `web/office-render-settings.js` (preview: "Xem thử · 0:42" + nút huỷ; mùa/thời tiết "(do sự kiện)"
khi `moment.forced`)
- Test: `tests/page-settings.test.mjs`, `tests/event-logic.test.mjs` (adopt), i18n khoá mới

**Interfaces:** thiết lập chung `{ weather, event, updatedAt }`; `EventLogic.adopt({ server, local, localAt }) → { take:
choice|null, push: bool }`.
- [ ] **Step 1: Test:** `older server value never overrides a newer local choice`; `server set() ignores an older
  updatedAt`; `a page without updatedAt (older tab) is treated as oldest`; `sim mode pushes` (host giả, `fetch` giả).
- [ ] **Step 2–4:** FAIL → viết → PASS (thêm khoá i18n `settings.preview.left`, `settings.preview.cancel`,
  `settings.forcedByEvent` đủ 7 ngôn ngữ). **Step 5: Commit** `fix: the newest event choice wins everywhere; the preview
  shows its time left`

### Task 12: Chữ vừa khung

**Files:** Create: `tests/text-fit.test.mjs`; Modify: `web/i18n/*.js` (rút gọn các câu vượt, spec §2.5), `web/office-
render.js:247-254` (`textOverflow: 'ellipsis'`, `overflow: 'hidden'`), `web/styles.css:110-116` (`select { max-width:
150px; text-overflow: ellipsis }`), `web/office-scene.js:318` (`ACT_TXT` thành hàm đọc `tr()` khi gọi)
- [ ] **Step 1: Test** `cols(s)` (CJK/emoji = 2 cột, còn lại 1): mọi khoá `office.act.*`, `bubble.fate.*`, `bubble.*`
  hiện trong bong bóng ≤ 26 cột (gồm 2 cột emoji tiền tố) ở 7 ngôn ngữ; mọi khoá `settings.event.*`, `settings.season.*`
  ≤ 22 cột. Kỳ vọng FAIL đúng các khoá spec §2.5.
- [ ] **Step 2–4:** rút gọn câu (giữ nghĩa), CSS ellipsis → PASS. **Step 5: Commit** `fix: every bubble and Settings
  label fits, in all seven languages`

### Task 13: `/assets` đọc nhãn và gói

**Files:** Modify: `web/assets-logic.js` (`CHOICES.event` → id gói từ `Theme.PACKS`: `'none'`, `'winter'`, `'christmas'`,
lễ nhỏ), `web/assets-stage.js` (env dựng Look từ lựa chọn trang), mọi `web/assets-cat-*.js` (thêm `label` cho entry; bỏ
`env.event >= 2`, `when.event.level`), `web/assets-ui*.js` (chế độ "Bảng chuyển đổi": hàng = nhãn, cột = gói, ô = thẻ vẽ
entry có nhãn đó với Look của gói), `tests/assets-registry.test.mjs`, `tests/assets-logic.test.mjs`, i18n khoá mới
- [ ] **Step 1: Test:** `every label in Labels.LIST has at least one registry entry`; `every entry with a label draws
  under every pack`; `the table view lists one row per label and one column per pack`.
- [ ] **Step 2–4:** FAIL → viết → PASS; mở `/assets` trên cổng 4330, chụp "Bảng chuyển đổi".
- [ ] **Step 5: Commit** `feat: assets: labels on every entry and a table of what each event turns them into`

### Task 14: Dọn, đo, tổng hợp

**Files:** Modify: `web/event-logic.js` (bỏ `level/eve/day` đệm, `cacheKey`), mọi chỗ còn đọc chúng (grep phải rỗng:
`grep -n "\.level\b\|env\.event\|ev\.eve\|ev\.day\|cacheKey(" web/*.js` chỉ còn trong `assets-cat-office.js` axis
'level' của bảng usage), comment cũ (`office-draw.js:244` "front lawn", `sky-island.js:176`), `CHANGELOG.md`, `README.md`,
`tools/README.md` (số đo)
- [ ] **Step 1:** grep trên rỗng; toàn bộ test PASS; prettier sạch.
- [ ] **Step 1b:** `web/light.js`: `Light.night(df)` (df < 0.5), `Light.glow(df)` (= `glowAt`), `Light.screen(df)`
  (df < 0.7), `Light.floor(df)` (0.2/0.8) — thay các ngưỡng rời ở pantry, cửa sổ, bảng usage, WC, đèn, màn hình, sàn
  (spec §5.6; mỗi chỗ giữ đúng ngưỡng cũ, chỉ đổi nguồn). Ảnh 20/12 18:00 trước/sau: khác biệt pixel = 0 ngoài người đi.
- [ ] **Step 2:** `tools/perf-frame.mjs` 20/12 12:00 và 21:00, 20/07 12:00, trước (`claude/assets-wiki`) và sau, 3 lần
  xen kẽ; ghi bảng vào `tools/README.md`. Expected: trong ngân sách spec event §3.4 (+0.4 ms p50, +900/+1,400 lệnh canvas).
- [ ] **Step 3:** trang tổng hợp trước/sau cho anh PO: ảnh crop từng nhãn §6, 20/12 trưa và tối, trước (nhánh
  `claude/assets-wiki`) và sau, ghép bằng `tools/crop.py` vào `.superpowers/labels/before-after.png` (+ đăng Artifact khi
  báo cáo).
- [ ] **Step 4: Commit** `docs: labelled assets and event packs in CHANGELOG and README; the frame cost after them`
