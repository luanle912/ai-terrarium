# Sky Island Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đặt văn phòng lên một hòn đảo lơ lửng giữa bầu trời "biển mây phía dưới", có ngày/đêm, sáu kiểu thời tiết với hai chế độ (Ngẫu nhiên, Thời tiết thật) và chọn được trong bảng cài đặt.

**Architecture:**
- Trang vẫn là một file `claude-office.html`, thêm hai khối script có tên:
  - `<script id="sky-logic">`: logic thuần, gán vào `globalThis.SkyLogic`, có test bằng `node:test` + `node:vm`.
  - `<script id="sky-render">`: hàm vẽ, gán vào `window.SkyRender`, kiểm bằng mắt qua Playwright.
- Stage có ba lớp, thứ tự từ dưới lên:
  1. canvas trời cỡ stage;
  2. canvas cảnh hiện có, nền trong suốt, gồm đảo và văn phòng;
  3. canvas hiệu ứng cỡ stage: mây gần, mưa, tuyết, chớp, sương.
  Bong bóng chữ và bảng chi tiết nằm trên cùng.
- Khung cảnh (`LW/LH/OX/OY`) tính từ biên của đảo. Nhờ vậy `P()`, bong bóng và `hit()` giữ nguyên cách tính.

**Tech Stack:** HTML5 Canvas 2D, React 18 UMD (không JSX), Node ≥ 18 (`node --test`, `node:vm`), Open-Meteo REST (chỉ khi người dùng bật).

**Spec:** `docs/specs/2026-11-04-sky-island-design.md`

## Global Constraints

- Một file HTML tự chứa. Không dependency, không bước build. Script ngoài chỉ có React/ReactDOM 18.3.1 từ cdnjs như hiện tại.
- Bãi cỏ `LAWN = 6` ô. Văn phòng trên màn hình còn khoảng 63% (chấp nhận 0.58–0.68 bề ngang cảnh).
- Hình đảo cố định, cùng seed trên mọi máy. Mép uốn lượn nhẹ, không có ô nào chỉ có ≤ 1 hàng xóm thẳng góc.
- Sáu kiểu thời tiết: `clear`, `cloudy`, `rain`, `storm`, `snow`, `fog`.
- Chế độ Ngẫu nhiên:
  - đổi sau mỗi 20–40 phút, chuyển trong 30–60 giây;
  - tỉ trọng clear 45, cloudy 25, rain 12, fog 8, storm 5, snow 5;
  - tuyết chỉ ra vào tháng 12–2;
  - không lặp lại cùng một kiểu, trừ `clear`.
- Chế độ Thời tiết thật:
  - mặc định tắt;
  - gọi geocoding `https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1`;
  - gọi forecast `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=weather_code`;
  - cứ 15 phút gọi lại một lần;
  - lỗi thì báo rõ lý do và tạm dùng chế độ Ngẫu nhiên.
- Mã WMO: 0–1 → clear, 2–3 → cloudy, 45/48 → fog, 51–67 và 80–82 → rain, 71–77 và 85–86 → snow, 95–99 → storm.
- Tuyết phủ cỏ đầy sau khoảng 10 phút, tan hết sau khoảng 20 phút.
- Giông: văn phòng tối thêm 15–20%. Chớp loé 120–200 ms, cách nhau 8–20 giây.
- `prefers-reduced-motion`: không chớp, hạt mưa và tuyết còn 40%, mây trôi chậm ×0.5.
- Cài đặt lưu ở `localStorage` key `ai-terrarium.weather`, mọi lần đọc/ghi bọc `try/catch`.
- Không vẽ lại từng khối đất của đảo mỗi khung hình. Đảo được dựng sẵn ra ảnh offscreen.
  Mục tiêu ≥ 50 fps ở 1440×900, màn hình 2x.
- Không lấy tài sản của Minecraft (không mặt trời vuông, không texture). Không nhấp nháy gắt.
- Phát hành 1.3.0: `plugin.json`, `CHANGELOG.md`, README. **Không commit, không push** cho tới khi anh Huy bảo.
  Trước khi commit phải `git fetch` và kéo main mới nhất.

## Review Focus

1. Trình duyệt chặn `localStorage` (cửa sổ ẩn danh, bị chặn dữ liệu trang): trang vẫn chạy và dùng cài đặt mặc định. Test ở Task 3.
2. Open-Meteo trả JSON thiếu `results` hoặc `current.weather_code`, hoặc trả mã lạ: báo lỗi rõ ràng, không ném lỗi ra ngoài. Test ở Task 3.
3. Tên thành phố có dấu hoặc khoảng trắng (`Hồ Chí Minh`): URL được mã hoá đúng. Test ở Task 3.
4. Tab bị ẩn hàng giờ rồi mở lại: lịch thời tiết chỉ chuyển một lần, không dồn nhiều lần liên tiếp. Test ở Task 2.
5. Đổi cỡ cửa sổ hoặc đổi DPR giữa chừng: ảnh đảo được dựng lại đúng hệ số mới, bong bóng và bấm chọn vẫn khớp. Kiểm ở Task 4, bước kiểm bằng Playwright.

---

### Task 1: Khung test + logic hòn đảo

**Files:**
- Modify: `claude-office.html`: thêm `<script id="sky-logic">` ngay sau khối `SeasonTree`.
- Create: `tests/sky-logic.test.mjs`
- Create: `tests/load-sky-logic.mjs`: đọc HTML, lấy nội dung `<script id="sky-logic">`, chạy trong `vm.createContext({})`, trả về `context.SkyLogic`.

**Interfaces:**
- Produces:
  - `SkyLogic.LAWN = 6`.
  - `SkyLogic.outdoorSpots(W, H) → [{id:'east-front',x:W+1,y:H-4,w:4,h:3},{id:'south-left',x:5,y:H+1,w:4,h:3},{id:'east-back',x:W+1,y:2,w:4,h:4}]`.
  - `SkyLogic.buildIsland({W, H, lawn}) → Island`, với:
    - `Island.cells: Set<string>` gồm các khoá `"x,y"`;
    - `Island.list: {x, y, d, shore}[]`, sắp theo `x+y` tăng dần. `d` là độ sâu mặt dưới (đơn vị z), `shore` là khoảng cách tới mép;
    - `Island.depth: Map<string, number>`;
    - `Island.bounds: {minX, maxX, minY, maxY}` theo ô, `max` là mút mở;
    - `Island.spots`;
    - `Island.decor: {x, y, kind:'tree'|'rock'|'flower'}[]`;
    - `Island.waterfall: {x, y}`.
  - `SkyLogic.sceneFrame(island, {W, H, TW, TH, WALL, pad}) → {LW, LH, OX, OY}`, số nguyên.

- [ ] **Step 1: Viết test hỏng** trong `tests/sky-logic.test.mjs`, dùng `W=27, H=14, lawn=6, TW=16, TH=8, WALL=56, pad=16`.
  - `island is deterministic`: `buildIsland` gọi hai lần cho ra `list` giống hệt nhau (`deepEqual`).
  - `island contains the whole office`: mọi ô `0≤x<27, 0≤y<14` đều nằm trong `cells`.
  - `lawn is 6 tiles at the middle of each side`: có các ô `(13,-6)`, `(13,19)`, `(-6,7)`, `(32,7)`.
  - `shore has no one-tile spikes or notches`:
    - mọi ô trong `cells` có ≥ 2 hàng xóm thẳng góc trong `cells`;
    - mọi ô ngoài `cells` trong khung `bounds±1` có ≤ 2 hàng xóm trong `cells`.
  - `underside is deepest inside`: `d` của ô `(13,7)` lớn hơn `d` của mọi ô có `shore === 0`.
  - `outdoor spots fit on the lawn`: mọi ô của 3 spot nằm trong `cells` và không ô nào thuộc văn phòng `0..26 × 0..13`.
  - `decor avoids office, spots and the office's 1-tile margin`: không phần tử `decor` nào nằm trong `-1..27 × -1..14` hay trong spot.
  - `waterfall sits on an east shore cell`: `cells` có `(x,y)` nhưng không có `(x+1,y)`.
  - `scene frame fits island and keeps office near 63%`:
    - với mọi ô, `P(x,y,0)` và `P(x+1,y+1,-d)` nằm trong `[0,LW]×[0,LH]` (P dùng `OX`, `OY` trả về);
    - `(27+14)*16/LW` nằm trong `0.58–0.68`.
- [ ] **Step 2: Chạy** `node --test tests/`. Kỳ vọng: FAIL vì `SkyLogic` không tồn tại.
- [ ] **Step 3: Cài đặt `buildIsland`, `outdoorSpots`, `sceneFrame`** trong khối `sky-logic`, theo thuật toán của `island-shore-v2.html` phương án B:
  - siêu elip bậc 4 trên nửa cạnh `(W+2·lawn)/2, (H+2·lawn)/2`, tâm `(W/2, H/2)`;
  - dao động `0.07·sin(2a+0.6) + 0.05·sin(3a+2.1) + 0.03·sin(5a+4.0)`;
  - luôn gồm văn phòng nới thêm 1 ô;
  - 3 lượt làm mượt: bỏ ô có ≤ 1 hàng xóm, lấp ô trống có ≥ 3 hàng xóm;
  - độ sâu `d = 8 + min(shore,11)^1.55·6 + floor(hash(x,y)·5)`, với hàm `hash` thuần, xác định theo `(x,y)`.
  - Decor: hash < 0.10 → tree, < 0.15 → rock, < 0.27 → flower, trên ô hợp lệ.
  - Thác nước: ô mép đông có `y` lớn thứ ba.
- [ ] **Step 4: Chạy** `node --test tests/`. Kỳ vọng: PASS 9/9.

### Task 2: Logic thời tiết và lịch đổi

**Files:**
- Modify: `claude-office.html` (khối `sky-logic`)
- Test: `tests/sky-logic.test.mjs`

**Interfaces:**
- Produces:
  - `SkyLogic.WEATHERS = ['clear','cloudy','rain','storm','snow','fog']`.
  - `SkyLogic.FX`: mỗi kiểu là `{cloud, rain, snow, storm, fog}` trong `[0,1]`:

    | Kiểu | cloud | rain | snow | storm | fog |
    |---|---|---|---|---|---|
    | clear | .2 | 0 | 0 | 0 | 0 |
    | cloudy | .8 | 0 | 0 | 0 | 0 |
    | rain | .9 | 1 | 0 | 0 | 0 |
    | storm | 1 | 1 | 0 | 1 | 0 |
    | snow | .7 | 0 | 1 | 0 | 0 |
    | fog | .5 | 0 | 0 | 0 | 1 |

  - `SkyLogic.pickNextWeather(prev, month, rand) → type`, với `month` đánh từ 0.
  - `SkyLogic.changeDelayMs(r) → 1_200_000 + r·1_200_000`.
  - `SkyLogic.transitionMs(r) → 30_000 + r·30_000`.
  - `SkyLogic.wmoToWeather(code) → type | null`.
  - `SkyLogic.initialWeather(type, now) → state`, với `state = {fromFx, to, t0, dur, nextAt}`.
  - `SkyLogic.startTransition(state, to, now, dur) → state`. `fromFx` lấy giá trị đang hoà trộn tại `now`, nên không bị giật.
  - `SkyLogic.weatherFx(state, now) → {cloud, rain, snow, storm, fog}`, nội suy smoothstep từ `fromFx` sang `FX[to]`.
  - `SkyLogic.stepRandom(state, now, month, rand) → state`: tới `nextAt` thì chuyển đúng một lần và đặt `nextAt = now + changeDelayMs(rand())`.
  - `SkyLogic.snowCover(cover, snow, dtMs) → number`, kẹp trong `[0,1]`.
  - `SkyLogic.lightningDelayMs(r) → 8000 + r·12000`, `SkyLogic.lightningFlashMs(r) → 120 + r·80`.

- [ ] **Step 1: Viết test hỏng.**
  - `random weather never repeats except clear`: với `rand` lặp qua 1.000 giá trị, `pickNextWeather('rain', 5, rand) !== 'rain'`; và có lúc `pickNextWeather('clear', 5, ...) === 'clear'`.
  - `snow only from December to February`: tháng 5 không bao giờ ra `snow`; tháng 0 và 11 có ra `snow`.
  - `weights roughly match`: 20.000 lượt với `rand` giả định (seeded), tháng 5, `prev='fog'`: tỉ lệ `clear` nằm trong `0.45±0.05`.
  - `delays are in range`:
    - `changeDelayMs(0) === 1_200_000`, `changeDelayMs(0.999) < 2_400_000`;
    - `transitionMs(0) === 30_000`, `transitionMs(0.999) < 60_000`.
  - `wmo codes map per spec`: 0, 1 → clear; 3 → cloudy; 48 → fog; 61, 81, 66 → rain; 73, 86 → snow; 95, 99 → storm; 4 và -1 → null.
  - `transition blends without a jump`:
    - `initialWeather('clear', 0)` rồi `startTransition(s, 'rain', 1000, 30000)`;
    - `weatherFx` tại 1000 bằng `FX.clear`, tại 31000 bằng `FX.rain`;
    - bắt đầu chuyển mới ở giữa chừng: `fromFx` bằng `weatherFx` cũ tại thời điểm đó.
  - `overdue schedule changes once` (Review Focus 4): `nextAt = 0`, gọi `stepRandom(s, 10·3_600_000, 5, rand)` một lần, rồi gọi lại với cùng `now`. Lần thứ hai trả về đúng đối tượng cũ, `to` không đổi.
  - `snow cover rises in ~10 min and melts in ~20 min`:
    - `snowCover(0, 1, 600_000) === 1`;
    - `snowCover(1, 0, 600_000) ≈ 0.5`;
    - `snowCover(0.5, 0, 1e9) === 0`.
  - `lightning timings in range`: kiểm biên dưới và biên trên.
- [ ] **Step 2: Chạy** `node --test tests/`. Kỳ vọng: các test mới FAIL.
- [ ] **Step 3: Cài đặt** các hàm trên. Riêng `pickNextWeather`:
  - ngoài tháng 12–2, tỉ trọng của `snow` cộng vào `clear`;
  - bỏ `prev` khỏi rổ chọn nếu `prev !== 'clear'`;
  - chọn theo tổng tích luỹ với `rand()`.
- [ ] **Step 4: Chạy** `node --test tests/`. Kỳ vọng: PASS toàn bộ.

### Task 3: Lưu cài đặt + lấy thời tiết thật

**Files:**
- Modify: `claude-office.html` (khối `sky-logic`)
- Test: `tests/sky-logic.test.mjs`

**Interfaces:**
- Produces:
  - `SkyLogic.WEATHER_KEY = 'ai-terrarium.weather'`.
  - `SkyLogic.loadWeatherSettings(storage) → {mode:'random'|'real'|'off', city:string}`. Mặc định `{mode:'random', city:''}`.
  - `SkyLogic.saveWeatherSettings(storage, settings) → boolean`.
  - `SkyLogic.geocodeUrl(city) → string`, `SkyLogic.forecastUrl(lat, lon) → string`.
  - `SkyLogic.fetchRealWeather(city, fetchFn) → Promise<{ok:true, type, code, place} | {ok:false, reason}>`. Không bao giờ reject.
  - Chuỗi `reason` (tiếng Việt, đúng nguyên văn):
    - `Chưa nhập thành phố`
    - `Không tìm thấy thành phố "<city>"`
    - `Không lấy được thời tiết: <message>`
    - `Dữ liệu thời tiết không đọc được`

- [ ] **Step 1: Viết test hỏng.**
  - `settings default when storage is empty or broken` (Review Focus 1): ba trường hợp đều trả về mặc định:
    - `{getItem:()=>null}`;
    - storage có `getItem` ném lỗi;
    - storage trả về JSON hỏng hoặc `mode` lạ như `"storm"`.
  - `settings round-trip`: lưu `{mode:'real', city:'Đà Lạt'}` vào storage giả rồi đọc lại được đúng như vậy; `saveWeatherSettings` với storage có `setItem` ném lỗi trả về `false`.
  - `urls encode the city` (Review Focus 3): `geocodeUrl('Hồ Chí Minh')` chứa `name=H%E1%BB%93%20Ch%C3%AD%20Minh` và `count=1`; `forecastUrl(10.82, 106.63)` chứa `latitude=10.82`, `longitude=106.63` và `current=weather_code`.
  - `real weather success`: `fetchFn` giả trả geocode `{results:[{name:'Da Lat',latitude:11.94,longitude:108.44}]}` rồi forecast `{current:{weather_code:63}}`. Kết quả là `{ok:true, type:'rain', code:63, place:'Da Lat'}`.
  - `real weather failures` (Review Focus 2):
    - city rỗng → `Chưa nhập thành phố`;
    - `results` rỗng hoặc thiếu → `Không tìm thấy thành phố "X"`;
    - `fetchFn` reject `new Error('offline')` → `Không lấy được thời tiết: offline`;
    - `res.ok === false` (status 500) → `Không lấy được thời tiết: HTTP 500`;
    - thiếu `current.weather_code`, hoặc mã lạ 4 → `Dữ liệu thời tiết không đọc được`.
- [ ] **Step 2: Chạy** `node --test tests/`. Kỳ vọng: các test mới FAIL.
- [ ] **Step 3: Cài đặt**: `fetchFn(url)` là hàm giống `fetch`, trả về `{ok, status, json()}`.
- [ ] **Step 4: Chạy** `node --test tests/`. Kỳ vọng: PASS toàn bộ.

### Task 4: Khung cảnh theo đảo + vẽ đảo (ảnh offscreen)

**Files:**
- Modify: `claude-office.html`:
  - hằng số `LW/LH/OX/OY` (khoảng dòng 98–100) tính từ `SkyLogic.sceneFrame(SkyLogic.buildIsland({W,H,lawn:6}), …)`;
  - `draw()`: nền trong suốt bằng `clearRect`, bỏ `fillRect(th.bg)`;
  - bỏ đồng bộ `stageBg`;
  - thêm `<script id="sky-render">`.

**Interfaces:**
- Consumes: `SkyLogic.buildIsland`, `SkyLogic.sceneFrame` (Task 1).
- Produces:
  - `SkyRender.renderIsland(island, frame, k, env) → HTMLCanvasElement`:
    - cỡ `LW·k × LH·k`;
    - `env = {df, snow}`;
    - vẽ mặt dưới đất/đá, mặt cỏ (pha trắng theo `snow`), viền cỏ, dây leo và decor;
    - không vẽ thác nước và văn phòng.
  - `SkyRender.drawWaterfall(ctx, island, P, t)`.
  - Component có thêm `this.islandCache = {img, k, dfBucket, snowBucket}`. Chỉ dựng lại khi `k` đổi, `round(df·10)` đổi hoặc `round(snow·10)` đổi.

- [ ] **Step 1: Chuyển hằng số khung cảnh** sang `sceneFrame`. Giữ nguyên tên `LW, LH, OX, OY`.
- [ ] **Step 2: Hệ số vẽ `k`** đổi thành `clientWidth·dpr/LW`, giữ số lẻ, kẹp trong 1–4. Ở canvas cảnh, `image-rendering` đổi thành `auto`.
  Lý do: với khung cảnh mới, làm tròn `k` khiến trình duyệt phải co ảnh khoảng 0,87, làm rụng hàng pixel.
- [ ] **Step 3: Viết `renderIsland` và `drawWaterfall`**.
  - Thuật toán vẽ mặt dưới như `island-shore-v2.html`: mặt bên chỉ hiện ở phần cột thả thấp hơn hàng xóm phía trước.
  - Màu ngày/đêm nội suy theo `df`, giống `lerpTheme`.
  - Trong `draw()`, `drawImage` ảnh đảo trước sàn văn phòng.
- [ ] **Step 4: Kiểm bằng Playwright** (local, DPR 2, 1440×900):
  - trang không cuộn;
  - bề ngang văn phòng chiếm 58–68% bề ngang canvas cảnh;
  - bấm nhân vật mở bảng chi tiết;
  - bong bóng nằm trên đầu nhân vật (so `headPos` với vị trí bong bóng, lệch ≤ 2px);
  - sau `setViewportSize` sang 1024×768, ảnh đảo được dựng lại với `k` mới (Review Focus 5);
  - console không có lỗi;
  - chụp ảnh ngày và đêm (`page.clock.setFixedTime` 12:00 và 22:00).
- [ ] **Step 5: Chạy** `node --test tests/`. Kỳ vọng: vẫn PASS toàn bộ.

### Task 5: Bầu trời, hiệu ứng thời tiết, ảnh hưởng vào văn phòng

**Files:**
- Modify: `claude-office.html`:
  - thêm vào khối `sky-render`;
  - thêm vào khối `sky-logic`: `skyColors`;
  - trong render: thêm 2 canvas vào stage;
  - trong `draw()`: kính cửa sổ, giọt mưa, tối khi giông.
- Test: `tests/sky-logic.test.mjs` (cho `skyColors`)

**Interfaces:**
- Produces:
  - `SkyLogic.skyColors(df, hour, fx) → {zenith, horizon, haze, below, cloud, cloudShade}`, mã màu hex.
  - `SkyRender.drawBack(ctx, w, h, t, env)` và `SkyRender.drawFront(ctx, w, h, t, env)`, với:
    - `env = {df, hour, fx, reduced, flash}`;
    - `flash` trong `[0,1]` là độ sáng chớp hiện tại;
    - nếu `reduced` thì `flash` luôn bằng 0.
  - Component: `this.setBack`, `this.setFront` (ref), `this.envNow()`.

- [ ] **Step 1: Viết test hỏng cho `skyColors`.**
  - `night sky is darker than day`: độ sáng `zenith` khi `df=0` nhỏ hơn khi `df=1`.
  - `dusk horizon is warm`: khi `hour=17.5`, `df=0.5`, `horizon` có kênh đỏ lớn hơn kênh xanh dương.
  - `storm greys the sky`: `skyColors(1,12,FX.storm).zenith` gần xám hơn `FX.clear`, tức hiệu `max−min` của các kênh nhỏ hơn.
- [ ] **Step 2: Chạy** `node --test tests/`. Kỳ vọng: FAIL. **Step 3:** cài đặt `skyColors`. **Step 4:** PASS.
- [ ] **Step 5: Viết `drawBack`**:
  - gradient từ `zenith` xuống `horizon`, đường chân trời ở 50% chiều cao stage, rồi `haze`, phía dưới là `below`;
  - mặt trời tròn có quầng sáng, vị trí đi theo `hour`;
  - ban đêm có trăng và sao;
  - 3 hàng mây xa phía trên chân trời và 9 hàng biển mây phía dưới. Hàng càng xa càng nhỏ, nhạt dần về `haze` và trôi chậm. Mật độ theo `fx.cloud`;
  - 4 đảo xa mờ trong sương;
  - dải sương ở chân trời;
  - chim bay ban ngày.
- [ ] **Step 6: Viết `drawFront`**:
  - một đám mây gần trôi ngang;
  - mưa: tối đa 260 vệt, theo `fx.rain`;
  - tuyết: tối đa 180 hạt, theo `fx.snow`;
  - sương: phủ `haze` alpha ≤ 0.45, theo `fx.fog`;
  - chớp: lớp trắng alpha ≤ 0.22·`flash`;
  - khi `reduced`, số hạt nhân 0.4.
- [ ] **Step 7: Văn phòng**:
  - màu kính cửa sổ pha 50% với `horizon`;
  - giọt nước trên kính (vẽ trong vùng cắt sẵn có) theo `fx.rain`;
  - khi giông: sau khi vẽ xong cảnh, đặt `globalCompositeOperation='source-atop'` rồi phủ `rgba(10,15,30,0.18·fx.storm)`. Chỉ phần đã vẽ bị tối, trời không bị ảnh hưởng.
- [ ] **Step 8: Gắn vào stage**:
  - canvas trời ở `z-index 0`, canvas cảnh `1`, canvas hiệu ứng `2` với `pointer-events:none`, lớp bong bóng `3`;
  - hai canvas trời và hiệu ứng vẽ theo cỡ stage nhân DPR;
  - đảo nhấp nhô: đặt `transform: translateY(sin(t·0.7)·3px)` lên khung bọc canvas cảnh và lớp bong bóng, để hai thứ đi cùng nhau. `hit()` dùng `getBoundingClientRect` nên vẫn khớp. Khi `reduced` thì đứng yên.
- [ ] **Step 9: Kiểm bằng Playwright**:
  - ép từng kiểu thời tiết qua `window.__sky.preview(type)` (hook chỉ dùng để kiểm, thêm ở Task 6; tạm gọi thẳng `setWeather` cũng được);
  - chụp 6 kiểu thời tiết ban ngày, cộng thêm đêm quang và hoàng hôn;
  - đo fps ≥ 50 ở DPR 2, 1440×900, khi đang mưa và khi đang có tuyết;
  - console không có lỗi.

### Task 6: Bộ điều khiển thời tiết + bảng cài đặt

**Files:**
- Modify: `claude-office.html`: thêm state cho component, `componentDidMount`/`WillUnmount` và `.settings-panel`.

**Interfaces:**
- Consumes: Task 2 (`initialWeather`, `stepRandom`, `startTransition`, `weatherFx`, `snowCover`, `lightning*`), Task 3 (`load/saveWeatherSettings`, `fetchRealWeather`), Task 5 (`envNow`).
- Produces:
  - React state: `weatherMode`, `city`, `realStatus: {state:'idle'|'loading'|'ok'|'error', text}`.
  - Instance: `this.wx` (state của Task 2), `this.snow`, `this.flash`.
  - `window.__sky = {preview(type), mode(m)}`, dùng cho kiểm thử.

- [ ] **Step 1: Khởi tạo**:
  - nạp cài đặt bằng `loadWeatherSettings(window.localStorage)`, truy cập bọc `try` vì truy cập `localStorage` có thể ném lỗi;
  - `this.wx = initialWeather('clear', now)`;
  - nếu mode là `real` thì gọi `refreshReal()` ngay và mỗi 900.000 ms.
- [ ] **Step 2: Mỗi khung hình**:
  - mode `random` → `stepRandom`;
  - mode `off` → chuyển về `clear` nếu đang khác;
  - cập nhật `snowCover` và lịch chớp (chỉ khi `fx.storm > 0.5` và không `reduced`).
- [ ] **Step 3: `refreshReal()`**:
  - `ok` → `startTransition(wx, type, now, transitionMs(r))`, ghi trạng thái `Đang theo thời tiết <place>: <nhãn kiểu>`;
  - lỗi → ghi `reason`, và lịch đổi ngẫu nhiên tiếp tục chạy.
- [ ] **Step 4: Bảng cài đặt**:
  - select `Thời tiết` có ba lựa chọn: `Ngẫu nhiên`, `Thời tiết thật`, `Tắt (luôn trời quang)`;
  - khi chọn Thời tiết thật: ô `Thành phố`, nút `Cập nhật` và dòng trạng thái;
  - hàng nút xem thử: `Quang`, `Mây`, `Mưa`, `Giông`, `Tuyết`, `Sương`, mỗi nút gọi `startTransition(..., 3000)`;
  - mỗi lần đổi chế độ hoặc thành phố thì lưu bằng `saveWeatherSettings`.
- [ ] **Step 5: Kiểm bằng Playwright**:
  - chọn Thời tiết thật, nhập `Đà Lạt`, chặn Open-Meteo bằng `page.route`:
    - lần một trả geocode và mã 95 → trời chuyển giông, dòng trạng thái đúng;
    - lần hai trả 500 → hiện `Không lấy được thời tiết: HTTP 500`;
  - tải lại trang → chế độ và thành phố còn nguyên;
  - với `localStorage` bị chặn (`page.addInitScript` ném lỗi khi truy cập) trang vẫn chạy (Review Focus 1);
  - ở chế độ Ngẫu nhiên và Tắt, không có request nào ra `open-meteo.com` (kiểm network);
  - `emulateMedia({reducedMotion:'reduce'})` + preview Giông → không có chớp (`this.flash` luôn 0).

### Task 7: Tài liệu, phát hành, kiểm toàn bộ

**Files:**
- Modify:
  - `README.md`: thay dòng 🔒 Private bằng câu đúng; thêm mục "Weather";
  - `CHANGELOG.md`: thêm mục `## [1.3.0]` và link so sánh;
  - `.claude-plugin/plugin.json`: `1.3.0`.

- [ ] **Step 1: README**: câu Private đổi thành "Reads local transcripts only; nothing leaves your machine unless you turn on Real weather, which sends the city name to Open-Meteo". Thêm mục cài đặt thời tiết.
- [ ] **Step 2: CHANGELOG 1.3.0 và plugin.json 1.3.0.**
- [ ] **Step 3: Kiểm toàn bộ**:
  - `node --test tests/` PASS;
  - Playwright:
    - các cỡ 2560×1305, 1440×900, 1280×720, 1024×768, 390×844 đều không cuộn;
    - fps ≥ 50 ở DPR 2;
    - console sạch;
    - ảnh ngày/đêm và ảnh từng kiểu thời tiết.
- [ ] **Step 4: Review cuối**: một reviewer mới đọc toàn bộ diff theo spec. Mọi phát hiện đều phải chốt: sửa, chấp nhận đánh đổi có lý do, hoặc bác bỏ có lý do.
- [ ] **Step 5: Dừng trước commit.** Báo anh Huy, chờ lệnh rồi mới chạy `commit-mr-convention`, fetch, commit, tag `v1.3.0` và push.
