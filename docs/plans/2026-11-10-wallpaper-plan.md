# Wallpaper Implementation Plan

**Goal:** Gộp app `LiveWallpaper` vào repo và thêm chế độ wallpaper cho trang văn phòng.

**Spec:** `docs/specs/2026-11-10-wallpaper-design.md`

## Review Focus

1. `?wallpaper=1` không còn chút giao diện nào ngoài cảnh (header, ⚙, panel, khung lỗi), trang thường không đổi.
2. Khoá màn hình: chụp rồi đóng WebView, mở khoá chạy lại; chạy pin vẫn như cũ.
3. `node server.js wallpaper` không chạy gì ngoài macOS.

### Task 1: App vào repo

- [ ] Chép `Package.swift`, `Sources/`, `Resources/Info.plist`, `build.sh` vào `wallpaper/`; `.gitignore` bỏ qua
  `wallpaper/.build/`, `wallpaper/build/`. Commit nguyên trạng trước khi sửa để diff dễ đọc.

### Task 2: Chế độ wallpaper của trang (TDD)

- [ ] `tests/wallpaper-logic.test.mjs`: `WallpaperLogic.fromSearch` nhận `1`/`true`/rỗng-có-khoá, từ chối `0`/`false`
  / không có.
- [ ] `web/wallpaper-logic.js`; `ClaudeOffice` đọc một lần trong constructor (`this.wallpaper`).
- [ ] `web/office-render.js`: bỏ header, padding, viền, khung lỗi, ⚙, panel khi `this.wallpaper`; canvas không nhận
  chuột.

### Task 3: Lệnh `wallpaper` của server (TDD)

- [ ] `tests/wallpaper-cmd.test.mjs` + `lib/wallpaper.js`: `plan(argv, platform)` trả lệnh cần chạy hoặc lỗi;
  `run` gọi `spawnSync` được truyền vào.
- [ ] `server.js`: `wallpaper` chạy trước các subcommand khác.

### Task 4: Khoá màn hình trong app

- [ ] `LockMonitor.swift`: `DistributedNotificationCenter` `com.apple.screenIsLocked` / `screenIsUnlocked`.
- [ ] `AppDelegate`: live = cắm sạc && !Low Power && !khoá; trạng thái menu "Đang khoá màn hình".
- [ ] `WallpaperController`: chụp không đợi vẽ lại + hạn 3 giây khi khoá; chu kỳ chụp 60 s; URL mặc định
  `?wallpaper=1`.

### Task 5: Kiểm tra và commit

- [ ] `node --test tests/*.test.mjs`, Prettier, `swift build -c release`.
- [ ] Chrome headless: ảnh trang ở `?wallpaper=1` và trang thường.
- [ ] README + CHANGELOG [Unreleased]; commit trên nhánh `claude/wallpaper`, không push.
