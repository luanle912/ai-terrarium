# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.0] - 2026-11-10

The office as your Mac's live wallpaper, with the server started for you, lighter page loads on the hub, and agents that stay at their desks while their shells still run. Deploy the hub to get the lighter page loads; the protocol is unchanged, so old and new pages, publishers and hubs keep working together.

### Added

- **The office as your Mac's wallpaper** — The LiveWallpaper app now lives in the repo (`wallpaper/`, macOS 14+) and `node server.js wallpaper` builds it and installs it to `~/Applications` (`wallpaper build` only builds; elsewhere the command says the app is macOS only). It shows the page on every screen at desktop level, under the icons and letting clicks through, and copies it into the system wallpaper every minute; on battery or Low Power Mode it keeps the last frame as a still wallpaper and closes the page. When the screen locks it saves the frame on screen as the wallpaper (the lock screen shows it: macOS lets no app draw there) and pauses, and it goes live again on unlock. The menu bar opens the normal page in the browser. The app also runs the server: when nothing answers on `localhost:4317` it starts the `server.js` of the repo it was built from (paths recorded at build time, since an app opened from Finder has no shell `PATH`), restarts it if it dies (3 s, doubling up to 60 s) and stops it on quit; a server someone else runs (the plugin, a terminal) is used as is. The server log goes to `~/Library/Logs/LiveWallpaper-server.log`; the app also quits cleanly on SIGTERM (`pkill`, logging out, a reinstall), so that server never outlives it
- **`?wallpaper=1`** — The page shows only the sky and the island, edge to edge: no header, frame, settings button, panels or "server needed" box, and no pointer input. Bubbles still follow the saved bubble setting. It is drawn at 15 frames a second instead of every screen refresh, with the far sky redrawn on every other frame: on a MacBook with an external screen the wallpaper went from about 190 % of a CPU core (WebKit's GPU process 135 %) to about 65 %

### Changed

- **Page loads are much lighter, on the hub and locally** — The page's 75 scripts and stylesheet are kept in memory with an ETag and a gzip copy: a first load sends about 291 KB instead of 879 KB, and a reload gets `304 Not Modified` for each file instead of downloading them again (files are still revalidated on every load, and an edited file is served new at once)
- **The hub does less per publish and per viewer** — SQL statements are prepared once and reused, an `island` frame identical to the last one sent is not sent again, and the once-a-minute sign-in check looks up each session once however many tabs it has open
- **The local server uses far less memory** — It reads transcripts a megabyte at a time instead of in one 64 MB piece: about 105 MB instead of 250 MB, with the same sessions

### Fixed

- **A session with shells still running looks busy** — When a turn ends but background shells keep running (Claude Code's "N shells still running", e.g. waiting for a pipeline), the agent no longer goes to rest as if done: it stays at its desk with the terminal on its screen and "Bash · shell nền", until the last shell finishes. An API error that stopped the turn still shows as an error

## [2.1.0] - 2026-11-09

A new island in four seasons, office devices that wake only when used, and a sturdier link to the world. Deploy the hub before the plugin (either order works with the old side).

### Added

- **The island in four seasons** — The island changes with the month of the viewer's clock (northern hemisphere: spring March–May, summer June–August, autumn September–November, winter December–February). The trees keep one round-canopy shape all year and only change colour: fresh green with pale blossom clusters in spring, deep green in summer, gold and orange in autumn with leaves already on the lawn, bare branches with snow on them in winter. Spring's bushes carry small red and purple fruit and the lawn grows more flowers; autumn's grass leans to gold; winter keeps a cover of snow on the lawn, the mountain and the pavilion roof whatever the weather, and two or three snowmen stand on open lawn by the lake and the office. Petals drift down in spring, many leaves fall and blow on a slow, turning breeze in autumn (the vines lean with it), and snow falls in winter, lightly in clear weather and thick when the weather is snow (rain and storms bring rain instead). In winter the lake and the pool under the mountain **freeze** (pale ice with cracks and patches of snow): no ducks, fish, duckweed or lotus, nobody fishes or bathes (the bench stays open), the dogs do not drink there, no fireflies, and both waterfalls stand still as columns of ice; everything comes back when the season changes. Holiday trees still replace a few trees by the office on their days, and the header chip names the season shown (with the holiday while one is on) in the season's colour. The world overview's small islands follow the season too. The still parts are baked once per season (15–22 ms when it changes); the falling particles are a fixed set drawn without allocating, within 0.2 ms a frame of summer
- **Season in ⚙ Settings** — A *Season* section of its own under *Weather*: *Auto (by date)*, Spring, Summer, Autumn or Winter (remembered in this browser), a "Now: …" line, and four preview buttons that show a season for a minute and then return to the choice. Weather and season are independent: snow can fall in summer, and a clear winter day still has its snow cover. Clicking the season chip in the header opens Settings at this section. In all seven languages
- **A new office island** — The office stands in the middle of a hexagon-shaped island, pointed at the top and the bottom, with about four tiles of lawn beside the office and a wavy, uneven shore: headlands and bays along the slanted sides, and the two upright sides broken into short runs of rock rather than a ruler-straight edge. The whole island is ringed with a 1 px outline in deep violet, over a thin brown soil layer and a wavy grass lip, on a soft two-tone grass checker. Underneath hang columns of grey stone blocks, staggered and lit left, shaded right, long under the middle and short toward the shore, so the underside narrows to a stepped point; roots and vines hang from the lip and sway in the wind. Behind the office stand two low-poly grey peaks with a grassy foot and snow caps when it snows; a fall pours from between them into a small stone-rimmed pool with foam where it lands. At the bottom point lies a big lake, its soft pixel shore ringed with cobbles, that spills over the edge as the main waterfall with mist where it falls into the clouds. In the lake stands a small **one-pillar pavilion** (inspired by Hanoi's One Pillar Pagoda: a stone pillar, a railed platform, a square hall under two tiers of curved roof) with stepping stones out to it and a lantern that glows warm after dark and shines on the water; pink and white lotus grow round it, duckweed drifts slowly, ducks swim slow loops and now and then dive (they sleep at night), dim fish glide under the surface and rain rings the water. By the lake's inner bank is a **rest corner**: a stone bench and a fishing spot, new places for idle agents (a dog comes to lie by whoever sits on the bench); agents can also bathe at the lake's edge and the dogs drink there. Iron lamps line the stone path and light up after dark, birds cross the sky by day and fireflies drift over the lake at night, the falls run harder in the rain and a rainbow shows at the main waterfall once the sun is back. Trees grow in groves, with bushes, mushrooms, rocks and flowers in small clumps, and small floating islands bob in the distance; the sun is drawn as a flat disc with two flat rings. Everything follows day and night, the seasons and the weather, and an island in world mode looks the same. The still parts are drawn once per resolution and light (the underside and the lake are worked out once and only recoloured when the light changes); what moves is a small fixed set drawn each frame without allocating
- **Office devices light up only when used** — Desk keyboards are backlit only while their owner sits at the desk, and the arcades, microwave, sink, espresso machine, grinder, fridge displays, drinks cooler, bar tablet, café candles, foosball table and restroom taps stay off until someone has arrived and is using them; they ease on and off, on the local page and on every island in world mode. The game corner's spots became their own *arcade* and *foosball* activities

- **"Máy này" and a log on the local page** — In ⚙ Settings → *World* a box under the joined line shows what this machine's publisher is doing: its state (sending, connecting, private, offline, rejected, standby, waiting for sign-in, revoked), when it last sent, its last error (the code, how many failures in a row, and the wait before the next try only when a retry is planned; "retrying" once it is due; nothing while paused for sign-in) and a *Log* button with the last 50 lines (kept in memory only). The error code carries the system reason from Node (`network:ECONNREFUSED`, `network:ENOTFOUND`), `timeout` or `network`. An older server has no log, so the box shows the state only
- **`/healthz`, `/metrics` and HEAD on the hub** — `GET /healthz` (200 `{ok, uptimeS, db, streams, version}`, 503 when the database does not answer) for uptime monitors; `GET /metrics` in Prometheus format (publish results, streams, islands, 429s) only when `HUB_METRICS_TOKEN` (at least 32 characters) is set, 404 otherwise and 401 without `Authorization: Bearer <token>`. Both go through the general rate limit (120 per minute per IP) and the counters reset when the hub restarts. `HEAD` works on the page and `/web/*`; `HEAD /api/world/stream` is 405. See `docs/hub-setup.md` 3g
- **"Sent at …" and islands that fade with age** — The hub sends each island's last-heard time (`lastAt`) and its own clock (`now`). An island whose machine went quiet fades from 45 s, shows "gửi lúc HH:MM · N phút trước" and is offline after 90 s. To keep the stream calm the hub only emits a world change for `lastAt` when it crosses a 15 s step, while every frame carries the exact value, so a live island's `lastAt` is at most about 16 s old. An older hub sends neither, and the page then behaves as before
- **A legend for the three connection states** — The connection chip in the world header has a "?" that explains grey *Island offline*, yellow *Reconnecting* and red *Hub not responding*, and lights the one the page is in (Esc closes it)
- **"Máy này" in "Của tôi"** — The device the page was opened from (the local page's link carries `#this-device=<id>`) is listed first with a tag and its last-sent time

### Changed

- **The pond, the old waterfall and the island's lawn layout** — The pond by the east edge is gone: agents now bathe at the big lake at the bottom point, and nobody walks into water, onto the mountain, into the pool or out to the pavilion (it is scenery). People and dogs are sorted with the trees, bushes, lamps, bench and pavilion, so someone behind a lamp post or a tree is hidden by it. Event trees now grow on every lawn, not only in front of the office, and take the night light after dark instead of glowing. The scene frame takes in the mountain without making the office more than 10 % smaller, and the 8-island overview is unchanged
- **Hub deploys no longer send viewers to "Thử lại"** — On SIGTERM the hub tells every stream when to come back (`event: restarting` plus `retry:`, 5-20 s, spread per viewer) and the page reconnects by itself at that time, keeping the scene (dimmed while the link is down, wiped only after 5 minutes without a connection); older pages wait out the same `retry:`. Measured with 300 streams: all 300 were back within 20 s, and the hub sends each viewer at most one `world` event a second. For 90 s after a start, islands whose machines have not sent again carry `waking: true` and are drawn as waiting for their machine rather than offline
- **Publisher backs off at most 15 s and resends when the machine wakes** — A failing hub is retried after 2 s growing to 15 s, and a gap of 10 s or more between ticks (sleep) logs `terrarium: woke up; resending` and sends at once
- **`HUB_TRUST_PROXY` is strict** — Only `''` (or `0`), `1` or `cloudflare` start the hub; any other value now fails at startup, so check the production environment before deploying
- **Rollout** — Deploy the hub first, then the plugin (either order works with the old side, see `docs/hub-setup.md` 3e and 3f). `Retry-After` on the 429/503 stream caps is for clients: a browser's `EventSource` ignores it. The `restarting` frame is written just before the connections close and can be lost on the way (by a proxy, or as the hub closes its sockets); viewers then fall back to their own backoff

### Fixed

- **Tool errors no longer turn an employee red** — A failing tool call (a non-zero Bash exit, a denied edit) is an ordinary step now; only a real API or session error shows as an error
- **No false "waiting for approval" in auto mode** — A session in auto (or bypass) mode that runs a slow tool is `working`, not waiting for a permission nobody will be asked for
- **Background sub-agents are not reported as finished** — A sub-agent still running after its parent ended the turn keeps showing `working`; each sub-agent is judged by its own transcript
- **An empty registry no longer makes ghosts** — A registry file that is empty or cannot be read keeps its session, and a stale `prev` only counts for a live process; of duplicate registry files the newest wins
- **A packet the hub refuses is reported and resent** — The publisher reads the hub's publish reply: a rejected packet (400/413, `stale_seq`, `other_instance`) is never counted as sent; a bad packet (400/413) shows `rejected` with the hub's reason, a `stale_seq` is resent past the hub's seq, `other_instance` stands by, and none is silently dropped
- **The hub tells the truth about dropped packets** — `POST /api/publish` answers `200 {accepted, reason?}` instead of an empty 204 (`reason`: `stale_seq` with the hub's `seq`, or `other_instance`)
- **Two Claude Offices on one machine no longer fight** — Each publisher identifies itself to the hub, which lets only the newest instance of a device publish and the other one stands by (and takes over again 90 s after the sender goes quiet)
- **Employees come back when an island returns** — When an island goes offline and online again, its agents reappear without a reload
- **A frozen stream is noticed** — The hub sends a named `event: ping` every 25 s, so the page can tell a silent, stuck stream from a quiet one and reconnects
- **Rooms keep their letter** — A project's room no longer changes letter when one machine goes off or the local server restarts: letters are kept in `rooms.json` next to the config (keys only, never a project name)
- **"Thoát" while pairing is not overwritten** — Leaving the world during a join in progress cancels it, and the late join result can no longer write a config or a status over it
- **Pairing does not hang on a silent hub** — Every step of a join has a time limit; a hub that never answers ends in an error instead of a wait that never finishes
- **A reused pid is not a ghost** — A session whose pid was taken by another process is no longer shown as running
- **A hidden tab does not hold the desk of someone who left** — A browser tab in the background removes an agent that left at once, so its desk is free when the tab is shown again
- **Finished sub-agents leave on time** — A sub-agent marked done walks out about 3 s later even when nothing else arrives from the hub, on the local page and on every island, and a background tab no longer creates it again on the next update
- **Pairing errors of the local server are visible** — When the local server answers a join or leave with an error, or does not answer, the page says so (with the status) and stops asking after three failed checks, instead of waiting for ever
- **The chip does not vanish when the local server dies** — After two failed polls the "World" chip turns grey "server local không phản hồi" instead of disappearing

## [2.0.0] - 2026-11-06

A major version because the source layout changes completely (the page moved from one HTML file into ES modules under `web/`); the page, the hub protocol, the CLI and the configuration work as before.

### Added

- **How bubbles show** — With many people in the office the scene was mostly name tags. ⚙ Settings → *Bubble text* now picks how bubbles show: *Compact* (the default) keeps the bubble of everyone at work (typing, thinking, talking, waiting), while someone on a break says a line for about six seconds when they start something new and then it fades, at most four at a time; *Always* shows every bubble as before; *Off* shows none. Approvals, errors, the selected agent and the one under the mouse always show theirs, and the choice is remembered in the browser

### Changed

- **The page is split into modules** — `claude-office.html` was one 7,150-line file that every change touched, so pull requests kept colliding, parts were hard to find and many lines held several statements (the longest ran to 1,032 characters). It is now a short shell that loads `web/main.js`, and the code lives in about 50 ES modules under `web/`, grouped by concern (office, world, sky, decor, pantry, event trees, logic, translations), each importing exactly what it uses; the page component is spread over `office-*.js` and `world-*.js`, and `render()` is cut into header, panels and settings. Everything is formatted with Prettier (one statement per line, 120 columns, settings in `.prettierrc.json`), no file is over 700 lines, and a test keeps it that way. The page looks and behaves exactly as before: every step was checked against screenshots of the old page taken with a fixed random seed and clock, pixel for pixel. There is still no build step and no runtime dependency. Both the local server and the hub serve `web/` (only plain `[a-z0-9-]` names, never cached stale), the hub's page policy now allows its own scripts instead of hashing inline ones, and the tests import the same modules the page runs (Node 22.12+ for the tests). **After updating, restart `node server.js`** if you run it yourself: an older server cannot serve `web/`, and the page says so instead of staying blank. Plugin users get the new server with the update
- **README demo** — The hero image is now a short animation of the office in simulation mode (zoom, rain, snow), and the links to the hosted page are gone

### Fixed

- **Blurry bubbles when zoomed** — Zoomed in, the name tags turned blurry because the browser kept the island layer at the size it was first drawn and stretched it; the layer is now redrawn sharp as soon as the zoom or pan stops

## [1.6.0] - 2026-11-05

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

[Unreleased]: https://github.com/luanle912/ai-terrarium/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/luanle912/ai-terrarium/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/luanle912/ai-terrarium/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/luanle912/ai-terrarium/compare/v1.6.0...v2.0.0
[1.6.0]: https://github.com/luanle912/ai-terrarium/compare/v1.5.0...v1.6.0
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
