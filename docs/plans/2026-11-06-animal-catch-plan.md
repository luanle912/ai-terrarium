# Kế hoạch triển khai: thú hoang, bắt bằng thời gian làm việc, lưu trữ mã hoá

Spec: `docs/specs/2026-11-05-animal-catch-design.md` (đã duyệt). Mọi con số, luật chơi và quyết định lấy từ spec;
kế hoạch này chỉ chia việc và chốt giao diện giữa các phần.

Quy ước: test viết trước (TDD); mọi comment trong code viết tiếng Anh, ngắn; không thêm package; không commit.

## Thứ tự

| Bước | Phần | File | Phụ thuộc |
|---|---|---|---|
| 1a | Luật chơi thuần | `lib/animals.js`, `tests/animals.test.mjs` | — |
| 1b | Lưu trữ mã hoá | `lib/animal-store.js`, `tests/animal-store.test.mjs` | — |
| 1c | Hình pixel 14 loài | `<script id="animal-sprites">` trong `claude-office.html`, `tests/animal-sprites.test.mjs`, `tests/load-animal-sprites.mjs` | — |
| 2a | Server: bộ máy thú, API, luồng SSE | `server.js`, `lib/animal-engine.js`, `tests/animal-engine.test.mjs`, thêm vào `tests/server-local.test.mjs` | 1a, 1b |
| 2b | Đi lại của thú trên trang | `<script id="animal-walk">` trong `claude-office.html`, `tests/animal-walk.test.mjs`, `tests/load-animal-walk.mjs` | 1c (chỉ tên khung hình) |
| 3 | Giao diện trang: nhận trạng thái, vẽ, hiệu ứng, chip, bảng, thông báo, dò bấm | `claude-office.html` (khối chính, `island-scene`) | 2a, 2b |
| 4 | Dịch chữ mới sang 7 ngôn ngữ | `<script id="i18n-strings">` | 3 |
| 5 | README, CHANGELOG, kiểm tra trên trình duyệt, review | | 4 |

1a, 1b, 1c làm song song (khác file). 2a và 2b làm song song (khác file).

## 1a. `lib/animals.js` (thuần, CommonJS, `'use strict'`)

Không đọc đĩa, không dùng giờ máy, không dùng `Math.random`. Mọi hàm trả **đối tượng mới**, không sửa đối số.

```js
const TIERS = {
  common:    { stayMs: 180e3, needMs: 3 * 60e3,  deadlineMs: 20 * 60e3 },
  rare:      { stayMs: 150e3, needMs: 8 * 60e3,  deadlineMs: 40 * 60e3 },
  epic:      { stayMs: 120e3, needMs: 15 * 60e3, deadlineMs: 75 * 60e3 },
  legendary: { stayMs: 90e3,  needMs: 30 * 60e3, deadlineMs: 150 * 60e3 },
}
const TIER_ORDER = ['common', 'rare', 'epic', 'legendary']
// cond: null | 'day' | 'night' | 'norain' | 'rain' | 'snow'   (rain/snow = x3 in that weather, /5 otherwise)
const SPECIES = [ { id: 'hen', tier: 'common', weight: 18, cond: null }, ... 14 entries as in spec 3.2 ]
const LIMITS = { collection: 50, out: 5, pendingMs: 24 * 3600e3, maxTickMs: 2000,
  waitMinMs: 4 * 60e3, waitMaxMs: 10 * 60e3, firstWaitMinMs: 30e3, firstWaitMaxMs: 90e3 }

isNightHour(hour)                       // 18:00–6:00
weights({ night, weather })             // -> [{ id, w }] after filtering and x3 / /5; weather in 'clear'|'rain'|'snow'
pickSpecies(u, conds)                   // u in [0,1) -> species id, by weights()
initialState(u)                         // first run: waitLeftMs = firstWait from u; everything else empty
validateState(obj)                      // -> clean state or null; keeps unknown-species records; caps out at 5 and
                                        //    caught at 50 (keeps released ones); never throws
isWorking(roots, nowMs)                 // roots: [{ hasTranscript, lastTs, regBusy: true|false|null,
                                        //   status, kidsActive }] -> boolean, rules of spec 5.2
tick(state, { dtMs, visible, working, night, weather, rand })
  // rand(spawnNo) -> [u1, u2] deterministic numbers for that spawn (from the store's HMAC)
  // dtMs is clamped to [0, maxTickMs]; returns { state, events: [{ type, ... }] }
  // events: 'spawn' {wild}, 'leave' {species}, 'progress', 'caught' {id, species, newSpecies},
  //         'escaped' {species}, 'pending' {species}, 'pendingExpired' {species}
apply(state, action, { rand })          // action: { type: 'catch'|'giveup'|'release'|'recall'|'free'|'resolve', ... }
  // -> { state, events } or { error: 'code' } with state unchanged
publicView(state, { working })          // what the page may see (spec 8.3): no seq, no spawnNo
```

- Thú hoang có `id` 6 hex, lấy từ số ngẫu nhiên của lượt (`u2`), nên khôi phục bản cũ ra lại đúng `id`.
- Bắt khi bộ sưu tập đầy: thành công thì `attempt.phase = 'pending'`, `pendingLeftMs = 24 h`; `resolve` áp số liệu.
- Test gồm mọi mục ở spec 14 phần `tests/animals.test.mjs`, cộng bảng tỉ lệ ở spec 3.4 (6 tình huống, 200.000 lần,
  ±10 % tương đối).

## 1b. `lib/animal-store.js`

```js
createStore({ dir, name = 'animals', aad = 'ai-terrarium/animals', log = () => {} })
  // files: <dir>/<name>.key, <name>.dat, <name>.dat.bak, <name>.dat.bad-<ts>
store.load()   // -> { status: 'ok' | 'restored' | 'reset' | 'fresh' | 'disabled', state | null, error? }
               //    'fresh' only when neither key nor .dat nor .bak exists (creates key with 'wx')
               //    'restored': .dat failed or missing, .bak used; 'reset': both failed, both renamed .bad-<ts>
               //    'disabled': key unreadable / wrong length / missing while data exists; touches no file
store.save(state)  // atomic: tmp + fsync, hard-link (or copy) current .dat to .bak, rename, fsync dir;
                   // writes seq+1; if the seq on disk is newer than the one loaded, returns { conflict: true }
                   // and does not write
store.rand(spawnNo) // -> [u1, u2] from HMAC-SHA256(key, 'spawn:' + spawnNo)
encrypt(key, obj, aad) / decrypt(key, fileJson, aad)   // exported for tests; strict lengths, authTagLength 16,
                   // header (v, alg) inside AAD, base64 must round-trip
```

Dev mode dùng `name: 'animals-dev'`, `aad: 'ai-terrarium/animals-dev'`.

## 1c. `<script id="animal-sprites">`

- Đặt ngay sau `<script id="dog-sprites">`. Xuất `globalThis.AnimalSprites = { SPECIES_IDS, frame(id, name), frameNames }`.
- Định dạng giống `dog-sprites`: mỗi khung là mảng chuỗi, ký tự là khoá bảng màu, `.` trong suốt, quay mặt sang phải,
  hàng dưới cùng là chân. Hỗ trợ `{ from, set }` để vá vài điểm.
- Khung bắt buộc cho mọi loài: `stand`, `walk1`, `walk2`, `act` (hành động riêng), `rest`, `sleep`. Cỡ 10–20 px rộng,
  8–18 px cao.
- 14 loài theo spec 3.2, tự vẽ, không mô phỏng nhân vật có sẵn.
- `tests/animal-sprites.test.mjs`: đủ khung, chân chạm hàng dưới, mọi ký tự có trong bảng màu, mọi hàng cùng độ rộng.

## 2a. Server

- **`lib/animal-engine.js`:**

  ```js
  createAnimalEngine({ store, getRoots, now, hrtime, log })
  ```

  - Giữ trạng thái trong bộ nhớ và gọi `tick` mỗi giây với `dtMs` đo bằng `hrtime`.
  - Lưu ngay sau mỗi sự kiện và hành động, cộng mỗi 15 giây khi có đồng hồ chạy; gặp `conflict` thì nạp lại.
  - Nhận báo cáo `env` (thời tiết, đang xem; chỉ đổi thời tiết tối đa mỗi 5 phút; "đang xem" là có báo cáo
    `visible: true` trong 20 giây qua).
  - Phát sự kiện cho các luồng SSE.
  - Có `flush()` cho lúc thoát.
- **`server.js`:**
  - Hàm `animalRoots()` dựng đầu vào cho `isWorking` từ `files` và `liveSessions()` (không đổi `snapshot()`).
  - Bộ máy thú khởi động trong `listenWithRetry(...).then()`.
  - `TERRARIUM_DEV=1` dùng kho dev và thêm `POST /api/animals/dev`.
  - Các đường dẫn ở spec 8.2, kiểm tra theo spec 8.1: `hostAllowed`, rồi `joinRequestAllowed(req, port, hosts, 'animals')`,
    thân tối đa 1 KB, giới hạn tốc độ sau khi kiểm tra; xử lý trước chỗ trả 405.
  - `createHandler` nhận thêm `animals` (bộ máy) để test được.
- **Test:** đường dẫn, bảo vệ, giới hạn tốc độ, `snapshot()` không có thú, chỉ tiến trình giữ cổng mới chạy.

## 2b. `<script id="animal-walk">`

- Đặt sau `dog-logic`. Xuất `globalThis.AnimalWalk`.
- Thuần, có test. Dùng `DogLogic.path` và `DogLogic.roamCells`.

```js
places(DOG_PLACES)                  // -> { roam, roamList, settle } : den removed, connectivity re-filtered,
                                    //    settle = roam minus clear cells
spawnCell(id, places)               // deterministic cell from the 6-hex id
create(id, species, cell, rand)     // one walker
step(walkers, w, dt)                // idle / wander / act / rest / sleep (22:00–6:00, owl reversed); never settles on
                                    //    clear cells; a walker with hold:true (being caught) stands still
pose(walker, t)                     // -> { frame: 'stand'|'walk1'|'walk2'|'act'|'rest'|'sleep', flip, dy }
```

## 3. Giao diện trang

- **Nhận trạng thái:** `GET /api/animals`; không trả 200 thì tắt toàn bộ tính năng. Nếu có thì mở luồng
  `/api/animals/events`, chạy cả ở chế độ Mô phỏng.
- **Báo về server:** `POST /api/animals/env` mỗi 10 giây và khi đổi trạng thái hiển thị (`visibilitychange`).
- **Đi lại:** dựng người đi (walker) cho con hoang và các con đang thả, dùng `AnimalWalk`. Gọi trong `frame()` của
  `ClaudeOffice`, không gọi trong `stepDogs`.
- **Vẽ** trong `draw()`, theo spec 9.2 và 10:
  - đọc `this.animals || []`;
  - nướng sẵn thân theo mức sáng và tuyết, nướng viền riêng không bị làm tối;
  - hiệu ứng vẽ sau lớp tối của giông;
  - cột sáng vẽ trên canvas phía trước;
  - `IslandScene` gán `animals = []`.
- **Dò bấm:** `hitAnimal(e)` dò trước `hit()`; thú đã chọn nằm trong `selAnimal`.
- **Chip, bảng, thông báo:** chip 🐾, bảng bộ sưu tập, bảng nhỏ, bảng chọn khi đầy, thông báo `aria-live`, mũi tên chỉ
  hướng khi thú ở ngoài khung nhìn, giảm chuyển động. Mọi chữ qua `tr('animal....')`.

## 4. Ngôn ngữ

- Viết bảng `vi` và `en` cùng lúc với bước 3.
- Bước 4 dịch sang `ja`, `ko`, `zh`, `es`, `th`.
- `tests/i18n.test.mjs` sẵn có phải pass.
