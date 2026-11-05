# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Sky of 8 islands** — A hub holds at most 8 islands (`MAX_ISLANDS`, no setting to raise it), each in a fixed slot 0-7 that never changes; the 9th person gets "Hub đã đủ 8 đảo" on the device page and in `join` (`the hub is full (8 islands); ask a hub owner to remove one`), and an owner's "Xoá đảo" or leaving the hub frees the slot for the next pairing; the hub DB upgrades in place to v3 (existing hubs with more than 8 islands keep them, the 9th onwards stay hidden until a slot frees up, see `docs/hub-setup.md`)
- **Cloud transition** — Moving between "Toàn cảnh" and one island is a pixel-cloud transition (two banks close, the view swaps, they part; a short fade with reduced motion); Esc or "← Toàn cảnh" goes back
- **Men and women** — Every agent is now a man or a woman, picked from its session id so a reload (or another island showing the same session) never changes anyone, and drawn to read that way at a glance: women with long, wavy, bob, ponytail or bun hair, a blouse, tee, cardigan or dress and often an A-line skirt, lips and sometimes earrings; men with a crop, side part, quiff, buzz cut, curls or a cap, often a beard or moustache, and a tee, collar and tie, hoodie or open jacket. Eight skin tones, ten hair colours and the clothes are combined per session, the shirt keeps its department colour, and every pose (walking, at the desk, on a stool, smoking, washing up, asleep on the desk, in the pond) shows the hair and beard
- **Thai** — The office page also speaks Thai (ไทย); a browser set to Thai picks it on its own, and it is in the **Language** picker in ⚙

### Changed

- **Clouds follow the zoom** — Zooming and panning the island now carries the sky with it by depth: the sky colour, sun, moon and stars stay put, far clouds and islands drift a little, the cloud sea grows toward the island's own zoom, the mist over the island moves with it exactly and the near mist bank a little more
- **"Toàn cảnh" is centred on the viewer** — Your island sits in the middle, a little larger, with the other 7 places in a ring around it in the same order for everyone (2 columns below your island on a phone); free places read "chỗ trống", a viewer without an island sees "chỗ của bạn" or "Hub đã đủ 8 đảo", and islands are drawn in a light simplified style; no dragging or zooming
- **A revoked or banned island stays offline in its slot** — Revoking someone's last device, or an automatic `google_revoked` ban, no longer removes the island from the sky: it goes offline with no staff and keeps its place (the machine is still cut at once); only "Xoá đảo" and leaving the hub free the slot
- **One-island panel** — On a phone the island's panel is a bottom sheet that starts as a one-line bar (name and status) and opens on tap; on a wide screen it can be collapsed, and the island is drawn beside it rather than under it. Esc with a modifier key held no longer leaves the island
- **Restroom rebuilt** — An open-top restroom block now continues the office past the pantry's east side, on the same floor and along the same back wall, drawn the way the office is drawn: a full office back wall, lower front and east walls with two doorways and swing doors that open as people pass, solid room walls inside for privacy, the pantry's floor tiles and planks, its cabinets, worktops, steel sinks, white pot plants and bar stool, the smoking corner's bench, small pictogram plaques beside each door and on a lobby sign post, and SẢNH CHUNG painted on the lobby floor like PANTRY. The men's room has two dusty-blue stalls and two urinals with solid screens, the women's room three dusty-pink stalls and a makeup corner, both with a double vanity under a mirror; a little land was added at the north-east corner so the block fits. Now and then an idle agent walks in from the pantry to their own room, disappears behind a stall door for a few seconds, washes their hands and moves on; the dogs stay out
- **Smoking corner moved beside the restroom** — The whole corner (pad, pergola, bench, ash bin, planted screen, light, extinguisher and sign) now stands right against the restroom block's east side on a new strip of land, its planted screen facing the block; a stepping-stone path runs from the east stairs along the front of the block to its entrance, smokers come in only through that entrance, never over the bench back, and the dogs still keep out
- **Restroom use** — Men now go to WC NAM and women to WC NỮ (it used to go by odd and even numbers), and idle agents pick the restroom about one time in four instead of rarely; a room never holds more people than it has stalls, so when they are all taken the others go for a coffee or a stretch instead of queueing

### Fixed

- **Checking a code on a full hub** — Looking up a pairing code while the hub already has 8 islands now only shows "Hub đã đủ 8 đảo"; the code stays valid, so it can still be approved if a place frees up before it expires
- **Smoother sky of islands** — The simple islands are kept as GPU-friendly images with a least-recently-used cache (no burst of redraws at dusk), the 8 name plates are measured once instead of every frame, and the hub no longer reads its database for every island update or re-sends every island after a removal

### Removed

- **Free camera and minimap of the world view** — Dragging, zooming, flying to an island and the minimap are gone from the hub page (the local page on port 4317 keeps its own drag and zoom)

## [1.5.0] - 2026-11-05

### Added

- **Languages** — The office page speaks Vietnamese, English, Japanese, Korean, Simplified Chinese and Spanish. It follows the browser language (English when there is no match), and a "Language" picker at the top of the ⚙ panel switches and remembers the choice; strings live in one table per language in the page, and `tests/i18n.test.mjs` checks every language has every key with the same placeholders
- **Multi-island hub** — A small hub server (`hub/server.js`, no dependencies) lets people sign in with Google, pair their machine and see everyone's island in one sky. A public hub runs at https://terrarium.openlabs.click; setup guide for your own in `docs/hub-setup.md`
- **Join the world from Settings** — Joining used to mean running `node server.js join` in a terminal, copying a code and typing it into the hub. The ⚙ Settings panel now has a **World** section (Thế giới): *Join the world* asks the hub for a code and opens its approval page with the code already filled in, so joining is one click on "Cho phép"; *Leave world* (click twice to confirm) removes this machine from the hub and forgets the local settings; *Cancel* stops a join that is still waiting. The header keeps just the status chip, and clicking it opens the world on the hub. All of it is translated into the six page languages
- **Open sign-in** — Setting `HUB_ALLOWED_DOMAINS=*` lets any verified Google account sign in, personal Gmail included; before, only accounts of a listed company domain could, and Google's account chooser hid Gmail accounts
- **Welcome page** — Visitors who are not signed in now land on a short page with the island logo, what the hub shows and does not show, and a "Đăng nhập bằng Google" button, instead of being sent straight to Google's sign-in screen
- **Logo** — A pixel-art floating island with the little office, a pond and an autumn tree (`assets/logo.png`), shown on the hub pages and usable as the Google sign-in app logo
- **World view** — The hub page has two modes: "Toàn cảnh" (the whole sky) and "Của tôi" (your own island); the local page shows a "Thế giới" chip once the machine has joined a hub
- **Publisher commands** — `node server.js join <hub>`, `share kin|co-ban`, `private on|off`, `status` and `leave`; only an allow-list of fields leaves the machine, and `private on` shows the island as private within 3 seconds
- **Device management** — Devices can be removed at `/me` on the hub; a removed machine's publisher logs `revoked` and stops sending
- **Self-service island** — Rename and recolour your island, see each device's sending state in "Của tôi" and at `/me`, get a "Máy mới" notice for 7 days after a new device, and leave the hub from `/me/leave` (removes island, devices and sessions and revokes the Google token)
- **"Xoá đảo" for owners** — Owners (emails in `HUB_OWNER_EMAILS`, checked on every request) can remove a member's island from the world view; there is no manual ban
- **"Xem như người khác"** — A setting on the local page that draws exactly what others would see, usable before the machine has joined a hub
- **Automatic access loss** — The hub asks Google for offline access (`access_type=offline`, scope still `openid email profile`), stores the refresh token encrypted, checks it hourly and bans anyone whose Google access was revoked or who left the allowed domain; people without a refresh token are cut after 24 hours until they sign in again
- **Audit log** — An `audit` table in the hub DB records bans, island removals, renames, device pairing and revocation, and leaving
- **Restroom** — A small restroom stands on the east lawn against the pantry wall, where the smoking corner used to be: two doors with pictograms and a vacant/occupied light under a teal awning, a wash basin with a mirror and a WC plate, a lamp that glows at night and a frosted window that lights up when someone is inside; now and then an idle agent walks over ("đi vệ sinh"), steps inside for a few seconds and then moves on, and the dogs leave them be

### Changed

- **Hub pages redesigned** — The pairing, approval, "Của tôi", leave and error pages were plain black-on-white HTML that looked nothing like the app. They now share the app's dark pixel style: the logo and pixel font, cards with a hard drop shadow, chunky buttons. The approval page shows the machine's name and its code in large type; after "Cho phép" it names the machine and opens the world by itself after 3 seconds; "Của tôi" shows each device with a Đang gửi / Riêng tư / Ngoại tuyến / Đã thu hồi tag and picks the island colour from swatches; and a browser that runs into an error (wrong account, expired sign-in, missing page) gets a page in Vietnamese with a way back instead of a line of English text
- **Approval links carry the code** — The link a machine opens now goes straight to the confirm page for its code, and if you are not signed in yet you land back on that page after signing in. Opening a link never approves anything by itself: "Cho phép" still has to be clicked, and wrong codes in links count toward the same 5-try lock as typed ones
- **Default hub** — The local page joins `https://terrarium.openlabs.click`; set `TERRARIUM_HUB` to use another hub
- **`HUB_SECRET_KEY` is required** — 32 random bytes in base64, even with dev login; it encrypts stored refresh tokens. Changing it drops all stored refresh tokens, so everyone falls back to the 24-hour rule until they sign in again
- **Hub security** — ID tokens are verified against Google's JWKS; the world page is served with a hash-based CSP and SRI for React; HSTS on `https://` and `Cross-Origin-Opener-Policy: same-origin`; full per-route rate limits and SSE stream caps (5 per user, 300 total)
- **Upgrading from GĐ1** — The hub DB upgrades in place (`PRAGMA user_version` 2); stop the hub, back up `hub.sqlite`, set `HUB_SECRET_KEY`, start the new version; everyone signs in again within 24 hours so their machines keep sending
- **`leave` revokes on the hub** — `node server.js leave` now revokes the device on the hub before removing the local config; `join` again also revokes the old token
- **Local server hardening** — The local server only trusts loopback host names on its own port (extra names via `ALLOWED_HOSTS`) and no longer answers cross-origin requests unless `ALLOWED_ORIGIN` is set
- **Per-user rate limit when signed in** — The hub's general limit (120 requests a minute) now counts per signed-in user or paired device instead of per IP, so an office behind one NAT no longer shares a single budget; anonymous requests still count per IP
- **World view performance** — Small islands keep their canvas and first draws are spread over frames, so "Toàn cảnh" with 10 islands stays under 1 ms of script per frame even without a GPU, and switching back from "Của tôi" no longer stutters
- **Hub islands follow v1.4.x drawing** — Islands in the world view use the new desk design, pantry and office dogs; the 5H/7D usage board is left off on hub islands and in "Xem như người khác" because those carry no usage data
- **Smoking corner moved down the east lawn** — The whole corner (pad, pergola, bench, ash bin, planted screen, light, extinguisher and sign) now stands further down the lawn, beside the garden path from the east stairs, so its smoke stays away from the restroom; smokers come in only through its entrance, never over the bench back, and the dogs still keep out

### Fixed

- **Usage board stuck at 0%** — The 5H/7D board reads the rate limits from the Claude Code statusLine (`node server.js statusline [--chain "<cmd>"]`, written to `~/.claude-terrarium/usage.json`) and shows `--` instead of 0% when there is no data
- **Items deferred from GĐ1 review** — `?server=` is ignored when the local page is served over `https:`; device-code approval only succeeds for a code that is pending and unexpired; a signing-in browser's old session is ended; a publisher that gets 401 no longer marks a newer config as revoked; departments with more than 16 projects no longer repeat letters; the hub page offers "Thử lại" when its stream is refused (too many tabs), the hub is busy (429, the button waits for `Retry-After`) or the hub is unreachable (including a check that gets no answer within 8 seconds or a stream that stalls three times in a row)
- **Pantry draw order** — The microwave, which stands partly on the drinks cooler, was drawn under the cooler's countertop; it now sits on top of the counter. The wooden wall cabinet tied with the fridge in draw order and lost, so the fridge's top covered the cabinet's edge; pieces on the back wall now draw in order along the wall, and the cabinet covers the fridge's side as it should

## [1.4.2] - 2026-11-05

### Removed

- **Pantry event tree** — The seasonal event tree that stood in the front corner of the pantry is gone; the pantry is now just a kitchen without a decorative tree taking up floor space. Event trees on the island lawn are unchanged

## [1.4.1] - 2026-11-05

### Fixed

- **Pantry fridge** — The tall fridge was drawn over the wooden cabinet and espresso machine next to it, making it look like the fridge was in front of both even though it stands behind them; the fridge now draws before the cabinet and espresso so their shorter bodies correctly cover the overlap, and the top of the fridge still shows above the counter as it would in a real kitchen
- **Department desks** — Desks in the four department zones were missing the detailed design: the monitor showed a blank rectangle, chairs had no backrest, and seated agents sometimes overlapped the desk edge; desks now show the full pixel-art design with a monitor that reflects the agent's current state (code editor, terminal, reading, thinking, permission prompt, error or done), an animated keyboard, a mug with rising steam, a desk lamp with glow, and seated agents layer correctly behind the desk backrest

## [1.4.0] - 2026-11-05

### Added

- **Lawn paths** — Stepping-stone paths run from both flights of stairs to the pond and on to the smoking corner, drawn with the island for day, night and snow; agents going outside follow them instead of cutting across the grass
- **Office dogs** — A corgi, a husky and a dalmatian live on the lawn: they stroll, drink at the pond, chase each other, trot over to greet people who come outside and, from 22:00, sleep together under the east tree. At night they dim only half as much as the scenery so they stay easy to see, and they leave people in the smoking corner alone
- **Smoking corner** — Idle agents can step out to a paved corner on the east lawn: a bench under a vine-covered pergola, a stainless ash bin, a planted screen toward the pantry, and a light, an extinguisher and a sign at the entrance; speech bubbles of people sitting out on the lawn sit right above their heads

### Fixed

- **Phone layout** — The page now fits phone screens: it sizes to the device width, the header is one row with a status strip that scrolls sideways, and speech bubbles are smaller and narrower; the desktop layout is unchanged

## [1.3.5] - 2026-11-05

### Fixed

- **Pantry bench** — The planter behind the wooden bench was drawn over it, so only a thin strip of the seat and its two ends showed; the bench is now drawn one tile at a time in front of the planter, with the whole seat and its slats visible, and people sitting on it still drawn on top

## [1.3.4] - 2026-11-04

### Fixed

- **Pinch to zoom on phones and tablets** — Two fingers now zoom the island 1×–4× about the point between them, and the island follows the fingers as they move; before, only the mouse wheel and a trackpad pinch could zoom, and a two-finger pinch on a touch screen just dragged the view

## [1.3.3] - 2026-11-04

### Changed

- **Pantry layout** — The pantry is laid out like a modern office kitchen, in three zones joined by a walkway that stays clear from the door to both flights of stairs:
  - **Kitchen wall** — Along the back wall, in the order it is used: fridge, coffee bar with cup shelves and a CAFE board, sink with a filtered-water tap, dishwasher, microwave (it lights up while someone heats food), drinks cooler and sorted bins. Only the fridge is tall, and it stands where the wall has no window
  - **Island** — A bar-height island with three high stools, far enough from the counter for two people to pass, with fruit and snack jars instead of the vending machine
  - **Seating** — A wooden bench with three tables for two, and a sky-view bar with three high stools on the open edge; the kitchen half has light tiles and the seating half wood planks
  - **Planter divider** — The glass partition between the office and the pantry is now a concrete planter of bamboo over leafy plants; the doorway stays where it was
  - **Seasonal tree** — Smaller, potted on a low stand in the front corner instead of the middle of the room
- **Pantry activities** — Agents on a break can also heat food, sit down for a snack or watch the clouds from the bar; people on high stools sit higher than on chairs. The free-standing water cooler, the vending machine and the round table with four stools are gone

## [1.3.2] - 2026-11-04

### Added

- **Front stairs** — A second flight of stone steps on the pantry's front edge, in front of the PANTRY sign; agents use whichever stairs is closer to reach the pond

### Changed

- **Wall fixtures sit on the wall** — The whiteboard labels and percentages, the EXIT sign and the clock are drawn in the wall's plane: the board reads label, bar filling left to right, then the percentage; the EXIT sign is a small green box mounted above the door; the clock is a disc standing slightly off the wall with its hands turning in that plane

### Fixed

- **EXIT door** — A leftover dark patch outside the door was painted over the wall base, and at night the door was almost black, so the doorway looked like a hole; the patch is gone and the door is a wooden door with an inset panel, day and night

## [1.3.1] - 2026-11-04

### Added

- **Pan and zoom** — Drag to pan, scroll or pinch to zoom the island 1×–4× about the cursor; a press only becomes a drag after 4 px so clicking an agent still selects it, bubbles keep their size and the sky stays put. The view moves at half the mouse speed, and zoomed in the island always fills the view except for a small margin left and right
- **Vacant desks and empty departments** — Unclaimed desks drop their papers, lamp, plant and mug and look greyed out; a zone no department owns gets a darker floor and an EMPTY label

### Fixed

- **Only live sessions** — Who is in the office now comes from the live Claude Code process registry (`~/.claude/sessions/<pid>.json`), with the old time-based filter as a fallback; departments are grouped by repo. Sessions get desks first (up to 16) and sub-agents have their own cap of 12, so they can no longer push sessions out of the office
- **Finished sub-agents** — Workflow sub-agents that hand in their result (`StructuredOutput`, `SubagentHandback`) leave after 30 s instead of showing "thinking" for 10 more minutes; workflow `journal.jsonl` files are no longer read as agents, and workflow sub-agents are attached to their real session
- **Interrupted sessions** — Tool calls left over from an interrupted turn no longer keep a session on "waiting for permission"
- **Horizontal drag at 1×** — Some left-right drag is allowed when the island exactly fits the stage width
- **Vacant-desk performance** — Greyed-out desks use a palette instead of `ctx.filter`, back to 60 FPS at 2× DPR
- **Lawn stuck white or grey after a snow preview** — Previewing *Tuyết* used to write straight into the lawn's real snow cover, which takes 20 minutes to melt, so after switching weathers the lawn stayed white (grey at night). A preview now only shows a snowy lawn while it lasts; real snow still builds over about 10 minutes and melts over about 20

## [1.3.0] - 2026-11-04

### Added

- **Sky island** — The office now stands on a floating island: a fixed, gently curving shore with 6 tiles of lawn in front and a thin 2-tile strip behind the walls, a deep earth-and-stone underside, hanging vines, a waterfall falling into the clouds, and a few trees, rocks and flowers. Three lawn spots are kept free for future outdoor areas
- **Raised plinth** — The office floor sits on a stone plinth above the lawn, with a soft shadow on the grass around it
- **Pond and bathing** — A small pond on the front-right lawn, sunk below the grass with earth banks and a ring of rim stones, open only where it spills over the shore. The waterfall is a sheet of water lying on the island's cliff face (it slants with the cliff, then falls on into the clouds) and dims at night. Idle agents can walk down new stone stairs on the pantry's east edge and bathe in the pond ("💦 tắm hồ"), shown up to the shoulders with ripples around them
- **Sky that fills the whole view** — A sea of block clouds below the horizon, cloud layers that get smaller, hazier and slower with distance, a haze band on the horizon and distant islands; the sun moves with the hour, warm skies at dawn and dusk, stars and a moon at night
- **Weather** — Clear, cloudy, rain, storm, snow and fog, blending over 30–60 s. Random mode changes every 20–40 min (mostly clear; snow only December–February, never the same weather twice in a row except clear). Rain runs down the windows, storms darken the office while lightning softly lights the sky behind the island, snow slowly whitens the lawn and ices the pond
- **Weather settings** — The ⚙ panel picks Random, Real weather (city name looked up on Open-Meteo, refreshed every 15 min, falling back to Random with the reason shown if it fails or takes over 15 s) or Off, plus preview buttons that show a weather for one minute. The choice is remembered in the browser
- **Tests** — `node --test "tests/*.test.mjs"` covers the island shape, weather scheduling, WMO code mapping, settings storage, the Open-Meteo client and sky colours (no dependencies)

### Changed

- The view is fitted to the island's top surface (the deep underside may run off the bottom), so the office keeps about 76% of its previous size on screen; scenery is drawn at the screen's exact resolution
- "Reduce motion" in the OS turns off lightning flashes, thins rain and snow and slows the clouds
- README: the privacy note now says the city name is sent to Open-Meteo when Real weather is on

### Fixed

- **Pantry floor at dusk** — The pantry floor no longer flashes white between day and night; it now blends smoothly

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

[Unreleased]: https://github.com/luanle912/ai-terrarium/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/luanle912/ai-terrarium/compare/v1.4.2...v1.5.0
[1.4.2]: https://github.com/luanle912/ai-terrarium/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/luanle912/ai-terrarium/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/luanle912/ai-terrarium/compare/v1.3.5...v1.4.0
[1.3.5]: https://github.com/luanle912/ai-terrarium/compare/v1.3.4...v1.3.5
[1.3.4]: https://github.com/luanle912/ai-terrarium/compare/v1.3.3...v1.3.4
[1.3.3]: https://github.com/luanle912/ai-terrarium/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/luanle912/ai-terrarium/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/luanle912/ai-terrarium/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/luanle912/ai-terrarium/compare/v1.2.7...v1.3.0
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
