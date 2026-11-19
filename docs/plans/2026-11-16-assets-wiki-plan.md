# Trang `/assets` — kế hoạch triển khai

> **Cho agent thực hiện:** BẮT BUỘC dùng superpowers:subagent-driven-development (khuyến nghị) hoặc
> superpowers:executing-plans để làm theo từng task. Các bước dùng checkbox (`- [ ]`).

**Mục tiêu:** trang `/assets` liệt kê và vẽ mọi item của game (khoảng 135 item, 350+ biến thể) bằng chính code vẽ của game,
duyệt theo nhóm, tìm, lọc, xem mọi biến thể theo mùa / sự kiện / ánh sáng / tuyết / trạng thái.

**Kiến trúc:** shell `claude-assets.html` + entry `web/assets-main.js` (React UMD như trang chính, không bundler). Registry
dữ liệu thuần trong `web/assets-registry.js` gom các module nhóm `web/assets-cat-<nhóm>.js`; mỗi entry có `draw(ctx, view, t)`
gọi thẳng code game qua bộ dựng dùng chung `web/assets-stage.js` (phép chiếu nhỏ, painter, hàm màu theo env, host giả cho
method của văn phòng). UI trong `web/assets-ui*.js`. Trang chính không import các module này.

**Công nghệ:** ES module thuần, Canvas 2D, React 18 UMD, `node --test`.

**Spec:** `docs/specs/2026-11-16-assets-wiki-design.md`. Bản rà soát item (toạ độ file:dòng, chữ ký vẽ, biến thể):
`docs/specs/2026-11-16-assets-inventory.md` — mọi task nội dung đọc phần nhóm của mình ở đó.

## Ràng buộc chung

- Module `web/` ≤ 700 dòng, dòng ≤ 120 ký tự, `npx --yes prettier@3.3.3 --write web` (`tests/web-style.test.mjs`).
- Mọi chữ hiện ra qua `tr('…')` với khoá viết thẳng, đủ 7 ngôn ngữ (vi en ja ko zh es th) trong `web/i18n/<lang>.js`;
  `tests/i18n.test.mjs` hỏng nếu thiếu / thừa khoá hoặc có tiếng Việt viết cứng ngoài bảng dịch.
- **Không chép code vẽ.** `draw` của entry gọi hàm của game; hàm đang private thì export thêm, không đổi hành vi game.
- Không đổi hình hay hành vi của trang `/` (trừ một link "Assets" trong ⚙ Settings).
- Canvas xem trước: `imageSmoothingEnabled = false`, phóng số nguyên (×2/×3/×4), nền caro tối.
- `id` của entry dạng `<cat>.<tên-kebab>`, ổn định (dùng cho link sâu).
- Không đụng cổng 4317, `~/.claude-terrarium`, `~/.claude/sessions`; tiến trình tự bật thì dừng theo PID.
- Không cấp phát thừa trong vòng vẽ của thẻ động; thẻ ngoài khung nhìn không vẽ.

## Trọng tâm review

1. Một entry ném lỗi làm trắng cả trang → mỗi thẻ vẽ trong try/catch, hiện thẻ lỗi; test "vẽ được" phủ mọi biến thể (Task 2).
2. Item mới của game không vào danh mục → test "đủ item" đọc nguồn sự thật (Task 2, mở rộng ở 3–5).
3. Trang nóng máy: hàng trăm canvas chạy cùng lúc → chỉ thẻ trong khung nhìn chạy, 15 khung/giây (Task 2, đo ở Task 6).
4. Trang chính bị kéo theo module danh mục hoặc đổi hình → test đồ thị module của `claude-office.html` không chứa
   `assets-*` (Task 1).
5. Hub: `/assets` lộ khi chưa đăng nhập hoặc CSP chặn script → test hub (Task 1).

## Bản đồ file

| File | Việc | Task |
|---|---|---|
| `claude-assets.html`, `web/assets-main.js` | shell và entry | 1 |
| `server.js`, `hub/publish.js`, `hub/csp.js` (nếu cần), `tests/web.mjs`, test server/hub/i18n | phục vụ `/assets`, hai entry | 1 |
| `web/assets-stage.js` | bộ dựng: `stage(ctx, view)`, `envOf(controls)`, host giả, canvas ghi lệnh cho test | 2 |
| `web/assets-registry.js`, `web/assets-logic.js` | gom entry, lọc/tìm/link sâu (thuần) | 2 |
| `web/assets-ui.js`, `web/assets-ui-detail.js`, `web/styles.css` (khối `.assets-*`) | giao diện | 2 |
| `web/assets-cat-office.js`, `-pantry.js` | nhóm văn phòng, pantry | 2 |
| `web/assets-cat-plants.js`, `-outdoor.js`, `-island.js`, `-world.js` | cây, đồ ngoài trời, đảo & trời, thế giới | 3 |
| `web/assets-cat-animals.js`, `-event.js` | động vật, sự kiện | 4 |
| `web/assets-cat-people.js`, `-rooms.js` | nhân vật, khu | 5 |
| `CHANGELOG.md`, `README.md` | tài liệu | 6 |

Thứ tự: Task 1 → Task 2 → (Task 3, 4, 5 song song; mỗi task chỉ sửa module nhóm của mình, export thêm ở module game khi
cần, và thêm khoá i18n của mình thành một khối liền) → Task 6.

---

### Task 1 [serve]: Phục vụ `/assets` ở server local và hub

**Interfaces:**
- `claude-assets.html`: như `claude-office.html` (font, `web/styles.css`, React + ReactDOM UMD cùng SRI),
  `<div id="root">` và `<script type="module" src="web/assets-main.js">`.
- `web/assets-main.js`: mount một component tạm hiện tiêu đề `tr('assets.title')` và link về `/`.
- `server.js` `createHandler`: thêm tuỳ chọn `assetsFile` (mặc định `claude-assets.html`); `GET /assets` trả file đó
  (`text/html`, `no-cache`).
- `hub/publish.js`: `GET /assets` cần phiên đăng nhập như `/` (chưa đăng nhập → như `/`), trả shell với CSP của
  `createOfficePage`.
- `tests/web.mjs`: `moduleGraph(entryHtml = 'claude-office.html')`; thêm `allModuleGraphs()` gộp cả hai entry.
- ⚙ Settings trang chính: một link "Assets" (`tr('settings.assets')`) tới `/assets`.

- [ ] **Test hỏng:** server local `/assets` 200 + chứa `web/assets-main.js`; hub `/assets` chưa đăng nhập không trả shell,
  đăng nhập trả 200 với header CSP có `script-src 'self'`; đồ thị module của `claude-office.html` **không** chứa module
  `assets-*`; mọi file `web/**/*.js` thuộc ít nhất một trong hai đồ thị; i18n quét cả `claude-assets.html`.
- [ ] Cài đặt → `node --test tests/*.test.mjs` PASS.
- [ ] **Commit** `feat: /assets is served by the local server and the hub`

### Task 2 [core]: Bộ dựng, registry, giao diện, hai nhóm đầu

**Interfaces (Produces — Task 3–5 dùng đúng các tên này):**
- `web/assets-stage.js` → `AssetsStage`:
  - `envOf({light: 'day'|'dusk'|'night', season, snow: boolean, event: 0|1|2|3}) => env` cùng hình với `envNow()` của game
    (`{df, hour, fx, reduced, frozen, flash, col, season, event}`) cộng `snow` (0 hoặc 1) và `theme` (lerp ngày/đêm).
  - `stage(ctx, view) => {P, PG, pt, C, kit, pantryKit, G, host}` — `view = {ox, oy, env, pick}`; `P/PG` chiếu iso quanh
    `(ox, oy)`; `pt = painter(ctx, P)`; `C` hàm màu theo env như `bakeTools`; `kit`/`pantryKit` cho nội thất; `G` cho method
    văn phòng; `host` là host giả mượn method của `ClaudeOffice` (theo cách `IslandScene`).
  - `recordingCtx()` — canvas giả đếm lệnh vẽ, dùng cho test.
- `web/assets-registry.js` → `AssetsRegistry = {CATS, entries(), byId(id), register(list)}`; mỗi entry theo spec mục 4.
- `web/assets-logic.js` → `AssetsLogic` (thuần): `filter(entries, {cat, q, tags})`, `variantCount(entry)`,
  `combos(entry, controls)` (các tổ hợp cho bảng "tất cả biến thể", tối đa 48), `toHash(state)` / `fromHash(hash)`.
- UI theo spec mục 6: header + điều khiển chung, cột nhóm, lưới thẻ, ngăn chi tiết, link sâu, phím `/`, Esc, ←/→, điện
  thoại. Thẻ vẽ lỗi hiện khung "không vẽ được" (không làm hỏng trang).
- Nhóm `office` (kiểu K trong bản rà soát mục 6: `OfficeDecor.ITEMS` + đồ khác vẽ riêng được) và `pantry` (mục 7: registry
  `I`, trạng thái `use` / `night`).

- [ ] **Test hỏng** (`tests/assets-logic.test.mjs`, `tests/assets-registry.test.mjs`): lọc/tìm/đếm/link sâu khứ hồi; id duy
  nhất và đúng dạng; **đủ item**: mọi khoá của `OfficeDecor.ITEMS` và registry pantry có entry; **vẽ được**: mọi entry × mọi
  giá trị trục × mọi tổ hợp điều khiển nó `uses` vẽ ≥ 1 lệnh trên `recordingCtx()` không ném lỗi.
- [ ] Cài đặt; chụp 1280×800 và 390×844 (lưới, ngăn chi tiết của lò vi sóng: dùng/không × ngày/đêm).
- [ ] **Commit** `feat: the assets page: registry, stage and the office and pantry catalogues`

### Task 3 [content]: Cây cối, đồ ngoài trời, đảo & bầu trời, chế độ thế giới

- Bản rà soát mục 1, 2, 3, 10. Cây đảo theo 4 mùa × tuyết × đêm; 16 cây lễ (`SEASONS`: nhãn, khoảng ngày, màu — hiện ở
  phần "khi nào"); cây Giáng sinh lớn theo cấp quà × sáng đèn; bụi/nấm/đá chọn dáng bằng toạ độ ô; chùa, đèn, ghế, người
  tuyết ×3, sen, bèo, đá bước. Đảo & trời là **thẻ cảnh** cắt từ bản nướng dùng chung (bờ, đáy, núi + vũng, hồ + chùa, thác
  chính, đảo nhỏ, mặt trời/trăng, mây, sương, cầu vồng, 6 thời tiết, hạt rơi 3 mùa). Thế giới: `paintIsland` / `paintTile`.
- Mở rộng test "đủ item": `SEASONS`, loại decor của đảo, `SkyLogic.WEATHERS`, mùa. Export painter private khi cần.
- [ ] Test hỏng → cài đặt → chụp từng nhóm → **Commit** `feat: assets: plants, outdoor props, the island and sky, world tiles`

### Task 4 [content]: Động vật, sự kiện

- Bản rà soát mục 4, 9. Chó: 3 giống × khung × đồ Giáng sinh; chuồng; vịt, cá, chim, đom đóm; tuần lộc, yêu tinh, chim cánh
  cụt, Santa, xe trượt, gói quà, gấu và gấu con, igloo; đống quà; đèn; kẹo gậy; nhà thờ Đức Bà, tượng và máng cỏ theo cấp 1–3
  × tuyết × ngày/đêm.
- Mở rộng test "đủ item": `BREEDS`, loại critter và khung, các món sự kiện.
- [ ] Test hỏng → cài đặt → chụp → **Commit** `feat: assets: animals and the Christmas event`

### Task 5 [content]: Nhân vật, khu

- Bản rà soát mục 5, 8. Một entry "người" với các trục: giới tính, tóc, áo, trạng thái (`ST`), tư thế, hành động
  (`ACT_TXT`), trang phục Giáng sinh, mũ; entry "cảnh rời đảo" (`FATES`); sub-agent; bubble. Khu: nhà vệ sinh, góc hút thuốc
  là thẻ cảnh (trạng thái có người / trống, đêm, tuyết).
- Mở rộng test "đủ item": `LOOKS`, `ST`, `ACT_TXT`, `FATES`, trang phục.
- [ ] Test hỏng → cài đặt → chụp → **Commit** `feat: assets: people and rooms`

### Task 6 [all]: Soi Chrome, hiệu năng, tài liệu

- Chrome 1280 / 1440 / 390: mọi nhóm, điều khiển chung (ánh sáng × mùa × tuyết × sự kiện), ngăn chi tiết, bảng biến thể, tìm,
  lọc, link sâu, phím tắt, đổi ngôn ngữ; không lỗi console; trang `/` không đổi (ảnh trước/sau trùng) và không tải `assets-*`.
- Đo: thời gian vào trang, khung hình khi cuộn, CPU khi đứng yên (thẻ ngoài khung nhìn không vẽ).
- Sửa mọi lỗi thấy được. CHANGELOG `[Unreleased]`, README (một dòng về `/assets`).
- [ ] **Commit** `polish: …` / `docs: …`
