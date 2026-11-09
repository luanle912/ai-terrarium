# Bốn mùa trên đảo — kế hoạch triển khai

> **Cho agent thực hiện:** BẮT BUỘC dùng superpowers:subagent-driven-development (khuyến nghị) hoặc
> superpowers:executing-plans để làm theo từng task. Các bước dùng checkbox (`- [ ]`).

**Mục tiêu:** đảo đổi rõ theo bốn mùa (xuân, hạ, thu, đông), mục Mùa riêng trong ⚙ cạnh Thời tiết, hồ đóng băng mùa đông.

**Kiến trúc:** một module logic thuần `web/season-logic.js` (`SeasonLogic`) quyết định mùa hiện hành (theo tháng, theo lựa
chọn trong ⚙, theo xem trước 1 phút) và "bảng mùa" (màu tán, cỏ, hoa, trái, tuyết phủ tối thiểu, loại hạt rơi, gió, hồ đóng
băng). Phần tĩnh nướng vào ảnh đảo với khoá cache có thêm mùa; phần động (cánh hoa, lá, tuyết rơi, gió) vẽ trong
`web/island-life.js`; vịt/cá/sen/bèo/câu cá/tắm/chó uống tắt khi hồ đóng băng. Cây lễ (`SeasonTree`, `seasonFor`) vẫn chạy
cho vài cây gần văn phòng.

**Công nghệ:** ES module thuần trong `web/`, Canvas 2D, `node --test`.

**Spec:** `docs/specs/2026-11-08-seasons-design.md` (mục 1–7).

## Ràng buộc chung

- Như các kế hoạch đảo (`docs/plans/2026-11-08-island-v2-plan.md` — Ràng buộc chung): module ≤ 700 dòng, dòng ≤ 120,
  Prettier 3.3.3, i18n 7 ngôn ngữ, hash theo ô, không cấp phát mỗi khung, `env.reduced`, viền `#3B2F4A`, không đụng cổng
  4317 / `~/.claude-terrarium` / `~/.claude/sessions`, dừng tiến trình theo PID.
- Mùa: xuân tháng 3–5, hạ 6–8, thu 9–11, đông 12–2 (giờ máy người xem).
- Đông: tuyết phủ tối thiểu ≥ 0.6 (thang `snow` 0..1 hiện có) suốt mùa; tuyết rơi nhẹ khi trời không mưa/bão, dày khi thời
  tiết là tuyết.
- Xem trước mùa: 60 giây rồi quay lại (như `SkyLogic.PREVIEW_MS`).
- Lựa chọn mùa lưu `localStorage` khoá `ai-terrarium.season` (`auto` | `spring` | `summer` | `autumn` | `winter`).

## Trọng tâm review

1. Mùa đông: không vịt, cá, sen, bèo; không ai chọn chỗ câu cá hay chỗ tắm; chó không uống ở hồ → test Task 1/3.
2. Đổi mùa (xem trước) không làm khựng: bake lại đúng một lần, không rò canvas cache → Task 2 đo.
3. Ngày lễ vẫn hiện cây lễ và tên lễ ở chip → test Task 1.
4. Chế độ thế giới: mỗi đảo theo mùa của máy người xem, không lỗi (`tests/island-scene-methods.test.mjs`) → Task 4.
5. Mục Mùa trong ⚙ không phá mục Thời tiết; chip mùa mở đúng mục → Task 3.

---

### Task 1 [logic]: `SeasonLogic`

**Interfaces (Produces, `web/season-logic.js`):**
- `seasonOf(date) => 'spring' | 'summer' | 'autumn' | 'winter'`.
- `currentSeason({date, choice, preview, now}) => {key, previewing}` — `preview` `{key, until}` thắng khi chưa hết hạn, rồi
  `choice` khác `auto`, rồi `seasonOf(date)`.
- `startSeasonPreview(key, now) => {key, until: now + 60000}`.
- `look(key) => {trees: 'fresh'|'green'|'gold'|'bare', grass, flowers: number, fruit: boolean, fall: 'petals'|'leaves'|
  'snow'|null, wind: number, minSnow: number, frozen: boolean}` — bảng theo spec mục 2–3 (hạ là "chuẩn": như hiện nay).
- `loadSeasonChoice(storage)`, `saveSeasonChoice(storage, choice)` — an toàn khi storage hỏng (như cài đặt thời tiết).
- `seasonLabel(key, holidayKey) => string` qua `tr()` ("Thu" hoặc "Thu · Trung thu").
- [ ] **Test hỏng** (`tests/season-logic.test.mjs`): ranh tháng (28/2 đông, 1/3 xuân, 31/5 xuân, 1/6 hạ, 30/11 thu, 1/12 đông);
  xem trước thắng rồi hết hạn sau 60 s; lựa chọn khác `auto` thắng ngày; `look('winter').frozen === true`,
  `minSnow >= 0.6`, `fall === 'snow'`; `look('summer')` không hạt rơi, không đóng băng; storage hỏng → `auto`.
- [ ] Cài đặt, khoá i18n `season.spring|summer|autumn|winter|auto` (7 ngôn ngữ). **Commit** `feat: SeasonLogic decides the
  season and its look`.

### Task 2 [ui]: Đảo theo mùa (tĩnh + động)

- Cây đảo (không phải cây lễ) đổi tán theo `look.trees`: xanh non có chùm hoa (xuân), xanh đậm (hạ, như hiện nay), vàng cam
  (thu — cây thu hiện có), trơ cành (đông; thông nếu có thì phủ tuyết). Bụi có trái (xuân). Cỏ và hoa theo `look`.
- Đông: tuyết phủ ≥ `minSnow` trên cỏ, mái, núi; **2–3 người tuyết** (sprite sắp lớp, đặt ở ô cỏ trống gần văn phòng/hồ,
  không chắn đường); hồ vịt và hồ chân núi **đóng băng** (mặt băng xanh nhạt, vết nứt, mảng tuyết, viền đá giữ); hai thác
  thành **cột băng** đứng yên.
- Phần động (`web/island-life.js`): cánh hoa thưa (xuân), lá rơi nhiều bay chéo theo gió (thu, gió thoảng đổi hướng chậm;
  dây leo nghiêng cùng hướng), tuyết rơi (đông; nhẹ khi trời không mưa/bão, dày khi thời tiết tuyết). Số hạt cố định.
- Khoá cache ảnh đảo thêm mùa; đổi mùa bake lại một lần. Đo thời gian bake khi đổi mùa.
- Chụp 1280×800 bốn mùa × ngày/đêm. **Commit** `feat: the island in four seasons`.

### Task 3 [ui]: Mùa đông cho người, chó, vịt, cá; mục Mùa trong ⚙

- Hồ đóng băng: `IslandLakeLife` không vẽ vịt, cá, bèo, sen; `IDLE_SPOTS` bỏ chỗ câu cá và chỗ tắm khi đóng băng (ghế đá
  giữ); chó không chọn chỗ uống ở hồ; khi hết đông mọi thứ quay lại. Test thuần cho các điều này.
- ⚙ Settings (`web/office-render-settings.js`): mục **Mùa** ngay dưới mục Thời tiết, cùng kiểu (ô chọn Tự động/Xuân/Hạ/Thu/
  Đông; "Hiện tại: …"; nút xem trước bốn mùa 60 s). Chip mùa ở header mở ⚙ và cuộn tới mục Mùa. i18n 7 ngôn ngữ.
- **Commit** `feat: a Season section in settings; frozen lakes in winter`.

### Task 4 [all]: Soi Chrome, chế độ thế giới, tài liệu

- Bốn mùa × 1280/390 × ngày/đêm × mưa/tuyết/sương; chế độ thế giới (một đảo, Toàn cảnh); xem trước mùa; console sạch;
  khung hình (≤ 1 ms thêm mỗi mùa). CHANGELOG `[Unreleased]`. **Commit** `polish: ...` / `docs: ...`.
