# tools

Small scripts for checking the page by hand. They drive a Chrome you start yourself:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/terrarium-chrome about:blank
```

- `perf-frame.mjs`: JS time and canvas calls of one frame, the island's bakes, share of GC, at a given date and time.
- `shot.mjs`: a screenshot of the page at a given date and time.

Both take `--at 2026-12-20T21:00:00` (the page's clock is shifted) and `--url` (default `http://localhost:4317/`).

## Baseline 2026-11-10 (before the Christmas event; 1512×982 @2x, 9 s, first 60 frames left out)

| Scene | ms p50 / p95 | canvas calls | first bake (island + props) | later bakes |
|---|---|---|---|---|
| 20 Dec 12:00 | 3.7 / 4.5 | 18,915 | 37.6 + 9.6 ms | 8–10 + 11–15 ms |
| 20 Dec 21:00 | 3.6 / 4.3 | 18,721 | 34.9 + 10.5 ms | 8–12 + 14–21 ms |
| 20 Jul 12:00 | 3.6 / 4.2 | 18,500 | 33.9 + 11.0 ms | 8–10 + 9–14 ms |
| 20 Oct 12:00 | 3.6 / 4.5 | 19,089 | 33.9 + 8.6 ms | 7 + 10 ms |
| 20 Dec 21:00, `?wallpaper=1` | 5.1 / 6.3 | 18,709 | 33.8 + 10.5 ms | |

GC: 0.1–0.5 % of the profile.

## Budget for the Christmas event (docs/specs/2026-11-10-christmas-event-design.md §3.4)

Against the same scene: ms p50 +0.4, p95 +1; canvas calls +900 by day, +1,400 by night; a bake (island + props) at
most 65 ms the first time (cold) and 45 ms after that.

## After phase 1, winter snow with depth (2026-11-10)

Measured alternately with July on a loaded machine, so compare within a row of runs, not with the baseline above.

| Scene | ms p50 / p95 | canvas calls |
|---|---|---|
| 20 Jul 12:00 (unchanged code path) | 3.2–3.7 / 4.2–4.5 | 18,510 |
| 20 Dec 12:00 | 3.6–3.8 / 4.6–4.8 | 18,980 (+65 on the baseline) |
| 20 Dec 21:00 | 3.7–3.9 / 4.7–4.9 | 18,770 (+50) |

Bakes timed directly in the page (12 runs each, median, k = 2.3): summer props 9 ms + island 5.5 ms; winter with snow
props 20 ms + island 6.5 ms.

## After phase 2, the Christmas event (2026-11-10)

Again measured alternately with July, on a machine busy with other things.

| Scene | ms p50 / p95 | canvas calls |
|---|---|---|
| 20 Jul 12:00 | 5.3 / 6.6–7.1 | 18,510 |
| 20 Dec 12:00, event level 3 | 5.2–5.5 / 7.0 | 18,825 (−90 on the baseline: the three small trees drawn every frame are gone) |
| 20 Dec 21:00, event level 3 | 5.0–5.7 / 6.2–7.6 | 18,905 (+185) |
| 20 Dec 21:00, `?wallpaper=1` | 4.1 / 5.9 | 18,870 (+160) |

Bakes timed directly in the page (median of 12, k = 2.3, same load): summer props 9 ms + island 5.5 ms; winter with snow
28–32 + 7 ms; winter with the event 33–36 + 7 ms.

The wallpaper app's GPU share could not be measured: its windows were covered, and WebKit pauses a covered page.
