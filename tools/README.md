# tools

Small scripts for checking the page by hand. They drive a Chrome you start yourself:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/terrarium-chrome about:blank
```

- `perf-frame.mjs`: JS time and canvas calls of one frame, the island's bakes, share of GC, at a given date and time.
- `shot.mjs`: a screenshot of the page at a given date and time.

Both take `--at 2026-12-20T21:00:00` (the page's clock is shifted), `--url` (default `http://localhost:4317/`) and
`--eval "js"` or `--eval @file.js`: a script run in the page (awaited) first, e.g.
`__office.setState({ dataSource: 'sim', agentCount: 16 })` to switch to simulated agents (`window.__office` is the page).

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

## After phase 3, Christmas outfits (2026-11-10)

Sixteen simulated agents (four of them sub-agents) standing on the lawn, paused, 20 Dec 21:00, event level 3; the same
scene with the outfits taken off, measured alternately:

| Scene | ms p50 / p95 | canvas calls |
|---|---|---|
| outfits on | 3.9 / 4.9 | 19,339–19,357 |
| outfits off | 4.0 / 4.9–5.0 | 19,291–19,323 |

So 16 to 66 calls for sixteen people (1 to 4 each; the budget was 8 each). The dogs' clothes are baked into their
sprites and cost nothing a frame.

## After phase 4, Christmas critters (2026-11-11)

Same build, 24 Dec 21:00, 8 simulated people, the sleigh kept flying (`__sleigh()` every second), with the critters
and with them switched off in the page (`critterItems`, `drawSleigh`, `stepCritters` stubbed), runs interleaved:

| | calls p50 | ms p50 |
|---|---|---|
| critters off | 19,314 / 19,284 | 6.6 / 5.7 |
| critters on | 19,279 | 6.4 |

The critters are at most 14 `drawImage` calls a frame (3 reindeer and one nose glow, 2 elves, 4 penguins, the pile,
the sleigh, 2 parcels); that is inside the run-to-run spread of the people walking about (about ±20 calls). The
island is not baked again for them.


## After phase 5, Christmas things to do (2026-11-11)

Same build, 20 Dec 12:00, 16 simulated people, paused with one person posed at each of the event's five spots and one
at the espresso machine, with the event's idle drawing and with it switched off in the page (`idleXmasItems`,
`xmasArms` stubbed), runs interleaved:

| | calls p50 | ms p50 |
|---|---|---|
| off | 19,474 / 19,542 | 6.6 / 6.3 |
| on | 19,578 / 19,527 | 6.8 / 6.7 |

The difference is inside the run-to-run spread (about ±50 calls with snow falling). Counted in the code, all five
activities in use at once add about 30 `fillRect` calls: the arms (about 2 more than the usual ones per person), the
rolled snowball 6, the skater's trail 8, the snowball in the air 3, a puff of breath 2. The island is not baked again.

## After the Christmas landmark, Notre-Dame of Saigon (2026-11-12)

Same build, no agents, with the landmark and with it switched off in the page (`cathedralItems` stubbed,
`EventLandmark.site` returning null, the island baked again), runs interleaved, two of each:

| Scene | calls p50, on | calls p50, off | ms p50, on / off |
|---|---|---|---|
| 20 Dec 21:00, event level 3 | 16,081–16,098 | 16,044–16,060 | 3.6–3.7 / 3.4–3.6 |
| 24 Dec 21:00, Christmas Eve | 16,100–16,104 | 16,042–16,049 | 3.3–3.5 / 3.3–3.4 |
| 20 Dec 12:00, event level 3 | 16,082–16,090 | 16,067–16,074 | 3.3–3.4 / 3.3–3.5 |
| 20 Jul 12:00, no event | 15,711–15,712 | 15,712 | 3.3 / 3.4 |

So +20 to +55 calls a frame after dark, about +55 on Christmas Eve and +10 to +25 by day. Counted in the code at
level 3: by day 24 bulb rectangles and the star's 3; after dark also one sprite for all the windows, 3 halos, the
manger's light and a glow under each lit bulb (about 12). In July the frame is the same with and without.

Bakes as `perf-frame.mjs` reports them (island + props; the island's is the same code either way): a later bake
12–14 + 14–23 ms with the landmark and 13–14 + 12–18 ms without; the first bake of a page 36–51 + 11–24 ms and
35–39 + 12–16 ms. The building is worked out once per event level and snow depth (about 1 ms) and only recoloured
after that, so the difference stays inside the spread, under the 45 ms a later bake may take. GC 0.3–0.5 % either way.
