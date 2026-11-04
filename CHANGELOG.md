# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.1.0]: https://github.com/luanle912/ai-terrarium/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/luanle912/ai-terrarium/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/luanle912/ai-terrarium/releases/tag/v1.0.0
