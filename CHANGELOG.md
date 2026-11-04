# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.7] - 2026-11-04

### Changed

- **Department names on the floor** — Each zone's folder name is painted on its floor along the middle aisle, all in one size and up to 12 characters, replacing the floating badges. A longer name drops its leading words first (`core-payment-merchant` → MERCHANT, `core-payment-fe` → PAYMENT-FE), so sibling projects no longer all read "CORE-PAYMENT"
- **Walls and floor with real thickness** — Walls show their top edge and cut ends, the floor is a slab with visible front edges, a soft shadow runs along the wall base, and windows and the door sit recessed in the wall
- **Sharper scenery** — The office is drawn at the screen's resolution (up to 4× the base scene), so furniture, walls and glass edges are as crisp as the characters on high-DPI screens
- **Version label** — The server version from 1.2.5 now sits next to the title in the compact header

### Fixed

- **Restored 1.2.2 and 1.2.3 layout** — 1.2.4 accidentally shipped an older copy of the page, which brought back page scrolling, the tall header and the footer hint; the full-window layout, compact header and in-office ⚙ button are back
- **Clouds stay inside windows** — Clouds drift behind the window frame instead of over the frame and wall
- **PANTRY floor label** — Moved one tile right so the entrance plant no longer covers it

## [1.2.6] - 2026-11-04

### Security

- **Bind localhost only** — Server now listens on `127.0.0.1` instead of all interfaces, preventing network exposure
- **CORS restriction** — Replaced wildcard `*` with localhost-only policy; custom origin via `ALLOWED_ORIGIN` env
- **SSE client limit** — Max 20 concurrent SSE connections to prevent connection flooding
- **File descriptor leak fix** — `readSync`/`closeSync` wrapped in try/finally
- **Remove path disclosure** — Catch-all route no longer reveals the watched directory path

## [1.2.5] - 2026-11-04

### Added

- **Version display** — Server version shown next to "CLAUDE CO." title in the header, read from `plugin.json`

### Fixed

- **SSE auto-connect** — Web UI now uses `location.host` as default SSE endpoint instead of hardcoded `localhost:4317`, so it works on any port

## [1.2.4] - 2026-11-04

### Fixed

- **Ghost session cleanup** — Server now prunes in-memory entries for transcript files that were deleted on disk, so stale fork/scratchpad agents no longer persist as phantoms in the office

## [1.2.3] - 2026-11-04

### Changed

- **Compact header** — Summary bar condensed to a single row for more office viewport space

## [1.2.2] - 2026-11-04

### Changed

- **Full-window layout** — Office canvas fills the viewport without page scroll

## [1.2.1] - 2026-11-04

### Fixed

- **Whiteboard cleanup** — Removed cluttered decorative bars from the API usage whiteboard; now shows only the clean 5H/7D usage bars

## [1.2.0] - 2026-11-04

### Added

- **Department system** — Sessions are grouped into departments based on working folder (`cwd`). Each department gets a unique color, and agents prefer desks in the same zone as their department mates
- **4 department zones** — Office is divided into 4 quadrants (top-left, top-right, bottom-left, bottom-right), each can be "owned" by a department via majority count. Floor tiles are tinted with the department's color
- **Glass partition walls** — Zones are separated by translucent glass segments with department-colored caps, using edge-based BFS collision to prevent walking through them
- **Pantry area** — Right side of the office (columns 20–26) is a dedicated break area with:
  - Coffee counter with espresso machine and sink
  - Printer/scanner
  - Fridge and water cooler
  - Round table with 4 stools
  - Vending machine
  - Decorative plants
- **Idle pantry behavior** — Idle agents now walk to the pantry and perform activities (pha cà phê, lục tủ lạnh, lấy nước, chọn snack, lướt điện thoại, vươn vai, nhâm nhi cà phê) instead of only sleeping at their desk
- **Activity arm animations** — Each pantry activity has unique arm/hand animations (phone screen glow, coffee cup raise, fridge door reach, water bottle tilt, vending button press, stretching)
- **Stool sitting** — Agents at the round table sit on stools with adjusted leg and body positioning
- **Department chips** — "PHÒNG BAN" row in the UI shows each department's short label, full name, color badge, and agent count
- **Zone nameplates** — Department name displayed as colored badges floating above glass partition walls, clearly visible above furniture
- **Dashed zone dividers** — Visual dashed lines separating the 4 work zones and the pantry corridor

### Fixed

- **Sub-agent infinite respawn** — Done sub-agents no longer re-enter the office in an endless loop (tracked via `goneSids` Set)
- **Idle agents always go to pantry** — Fixed timing bug where sleeping check fired before pantry spot assignment
- **Department grouping by folder** — Sessions sharing the same working directory (`cwd`) are now correctly grouped, not by session name
- **Full session names in bubbles** — Bubble labels show full names (e.g., "playground", "nexa-kb-v3") instead of abbreviated codes ("PLA1", "NEX1")
- **Event tree scale** — Seasonal tree scaled 1.8× to match office proportions

### Changed

- **Expanded office layout** — Map grows from 16×13 to 27×14 tiles, with 16 desks (up from 12) arranged in 4 zones of 4 desks each
- **Door repositioned** — Entrance moved to left wall center (y=7) to accommodate the taller office
- **Event tree relocated** — Seasonal tree now appears in the pantry area at P(23.5, 6.7) instead of replacing desk #1, so no desk reservation is needed
- **Whiteboard repositioned** — API usage bars adjusted to fit the new wall layout (y: 1.15–4.35)
- **Desk accessories** — Each desk now has one of: desk lamp, potted plant, or photo frame (cycling by desk index)
- **Simulation departments** — Simulated agents are distributed across 4 departments: WEB, API, MOB, INF

## [1.1.0] - 2026-11-04

### Added

- **Seasonal event tree** — Desk #1 transforms into a themed tree based on the current date. Supports 16 Vietnamese and international events:
  - **Lunar events**: Tết Nguyên Đán (mai tree + lì xì), Trung Thu (lantern tree)
  - **Fixed events**: New Year (tinsel + fireworks), Valentine (heart-shaped topiary), Women's Day 8/3 (rose bouquet), Reunification Day 30/4 (flag bunting + dove), Children's Day 1/6 (balloon tree), National Day 2/9 (flag pole), Vietnamese Women's Day 20/10 (flower basket), Halloween (dead tree + jack-o-lanterns), Teachers' Day 20/11 (book stack + chrysanthemum), Christmas (decorated pine)
  - **Seasons**: Spring (cherry blossom), Summer (coconut palm), Autumn (maple with falling leaves)
  - Falls back to a normal desk on days with no active event
- **Season indicator chip** in the summary bar showing the current event name with accent color
- **Lunar calendar lookup tables** (2026–2031) for Tết and Trung Thu dates
- **Priority-based season resolution** — event dates take precedence over season ranges; overlapping events resolve by cultural significance

### Changed

- Desk #1 (top-left) is now reserved for the event tree when an active season is detected; the agent previously at desk #1 is automatically relocated to the next free desk

## [1.0.1] - 2026-11-03

### Fixed

- **Visitor/sub-agent overlap** — Multiple characters visiting the same desk no longer stack on top of each other. Sub-agents now occupy spots to the right of the desk, while visitors take spots in front/left, each with unique coordinates
- Added `parent !== target` guard to prevent a parent session from appearing in the visitor position of its own sub-agent

## [1.0.0] - 2026-11-03

### Added

- Initial release
- Pixel-art isometric office rendered on HTML5 Canvas
- Real-time session visualization via SSE from local Claude Code transcripts
- Day/night cycle with smooth cosine interpolation based on local clock
- Session status indicators: working, thinking, talking, waiting, permission, error, idle, done
- Sub-agent spawning with antenna indicator and unique positioning
- Simulation mode with configurable agent count and speed
- Session detail panel with activity history
- Whiteboard showing real Claude API usage (5-hour and 7-day quotas)
- Settings panel for data source, speed, bubble text, and auto-approve
- Zero dependencies — pure Node.js server, no build step
- Claude Code plugin integration with auto-start on `session.start`

[1.2.7]: https://github.com/luanle912/ai-terrarium/compare/v1.2.6...v1.2.7
[1.2.6]: https://github.com/luanle912/ai-terrarium/compare/v1.2.5...v1.2.6
[1.2.5]: https://github.com/luanle912/ai-terrarium/compare/v1.2.4...v1.2.5
[1.2.4]: https://github.com/luanle912/ai-terrarium/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/luanle912/ai-terrarium/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/luanle912/ai-terrarium/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/luanle912/ai-terrarium/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/luanle912/ai-terrarium/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/luanle912/ai-terrarium/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/luanle912/ai-terrarium/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/luanle912/ai-terrarium/releases/tag/v1.0.0
