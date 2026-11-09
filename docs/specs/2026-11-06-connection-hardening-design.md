# Connection hardening: đường publisher → hub → người xem bền và nói thật

Ngày: 2026-11-06 · Người đặt hàng: anh Kiet · Người viết: Claude

Đầu vào: báo cáo review chỉ đọc của nhánh `claude/multi-island` (`.superpowers/sdd/connection-review-findings.md`, không
commit). Mỗi phát hiện đã được đối chiếu lại với code ở commit `08f6c10` (§5). Plan:
`docs/plans/2026-11-06-connection-hardening-plan.md`.

## 0. Phạm vi và quyết định (anh Kiet duyệt cả 3 đợt, 2026-11-06)

Ba đợt, làm theo thứ tự. Mỗi đợt kết thúc bằng một task kiểm đầu cuối và tài liệu, và **deploy được riêng**: hub và
publisher trên máy mọi người nâng cấp vào những lúc khác nhau, nên mỗi đợt phải chạy đúng khi chỉ một phía đã lên bản mới
(§9).

**Đợt 1: đúng dữ liệu** (dữ liệu sai hoặc mất): L-a, L-b, L1, L2, L3, V1, V2 + H10, H4. Em gộp thêm **L12** (hai publisher
trên một máy) vào đợt này, vì sửa H4 mà không có L12 thì hai publisher sẽ giành nhau (§6.6).

**Đợt 2: chịu lỗi**: H1, H2, H3, H5 + L7, H7, H9, L4, L5, L6, L8, L9, L10, L11, V3, V4, V5, V6, V11, V12. H11 được sửa
luôn trong task gộp sự kiện `world` (không tốn thêm việc).

**Đợt 3: nhìn thấy được**: các trường trạng thái của publisher và trạng thái `rejected`, nhật ký vòng (ring buffer),
`/healthz` + `/metrics` + HEAD, `lastAt` theo đảo, viên "Máy này", chú giải ba trạng thái (đảo offline / đang kết nối
lại / hub không phản hồi), báo lỗi trên giao diện ghép máy (V7–V10). H8 nằm trong đợt này.

**Không xếp lịch**: H6 (OFFLINE_MS 90 s + tối đa 5 s tick). Đợt 3 làm cho tuổi dữ liệu hiện rõ trên đảo ("gửi lúc …",
đảo mờ dần), nên đảo của một publisher đã chết không còn trông như "đang làm" dù hub vẫn chờ đủ 90 s. Rút OFFLINE_MS
xuống thì phải đổi nhịp heartbeat 30 s, việc đó để sau.

## 1. Ý định và lý do

Chế độ thế giới đã chạy thật trên `https://terrarium.openlabs.click` (sau Cloudflare, HTTP/2). Review cho thấy đường
dữ liệu **nói sai mà không ai biết**:

- Trên máy: một lỗi tool bình thường làm nhân viên đỏ "error" 30 giây; mọi Bash chạy lâu hơn 8 giây thành "chờ duyệt",
  kể cả ở chế độ auto; sub-agent chạy nền bị báo "xong" khi session cha hết lượt; registry rỗng làm mọi transcript 2 giờ
  qua hiện thành ma.
- Publisher: gói bị hub từ chối (400/413) được coi là đã gửi, đảo tắt sau 90 s mà chip vẫn xanh. Hub trả 204 cho cả gói
  bị bỏ (seq cũ).
- Người xem: đảo offline rồi online lại thì văn phòng trống mãi tới khi tải lại trang; luồng treo vẫn hiện "Đã kết
  nối"; một lần deploy hub đưa cả 300 người xem vào màn "Thử lại".

Anh Kiet muốn sửa cả ba lớp: trước hết cho đúng, rồi cho bền, rồi cho thấy được khi có chuyện.

## 2. Mục tiêu

1. **Trạng thái nhân viên đúng** với những gì Claude Code đang làm: lỗi tool không phải lỗi session; không đoán "chờ
   duyệt" khi chế độ không bao giờ hỏi; sub-agent sống theo transcript của chính nó; registry là nguồn sự thật về
   session nào còn sống.
2. **Không gói nào mất trong im lặng**: hub trả lời thật (nhận hay bỏ, vì sao), publisher hành động theo câu trả lời đó.
3. **Người xem thấy đúng**: nhân viên quay lại khi đảo quay lại; luồng treo bị phát hiện trong khoảng 40 giây.
4. **Deploy hub, laptop ngủ dậy, mạng chập chờn** không đưa ai vào ngõ cụt: tự kết nối lại theo nhịp, giữ cảnh trong lúc
   chờ.
5. **Thấy được**: chủ máy biết máy mình gửi gì, lần cuối khi nào, lỗi gì; người xem phân biệt "đảo đó tắt" với "mình
   mất kết nối" với "hub chết"; người vận hành có `/healthz` và `/metrics`.

## 3. Ngoài phạm vi

- Lưu thế giới xuống đĩa để sống qua lần khởi động lại hub. Spec multi-island cấm hub lưu trạng thái hoạt động; H2 được
  sửa bằng cờ "đang chờ máy gửi lại" (§7.2), không bằng lưu trữ.
- Kênh lệnh hub → publisher (ví dụ hub báo "tôi vừa khởi động lại, gửi lại đi"). Spec multi-island C6 vẫn giữ.
- H6 (§0).
- Đổi định dạng thân gói publish. Thân gói giữ nguyên trong cả ba đợt (§9.1).
- Giao diện xem nhật ký trên hub, cảnh báo (alerting) tự động. `/metrics` chỉ là nguồn số liệu.

## 4. Điều không được xảy ra

- **Không thêm khoá mới vào thân gói publish.** `hub/validate.js` từ chối mọi khoá lạ (`TOP_KEYS`), nên một publisher mới
  gửi thêm khoá sẽ bị mọi hub cũ trả 400. Dữ liệu mới từ publisher đi qua **header**.
- **Không trả mã trạng thái mới cho publisher cũ mà nó hiểu thành lỗi.** Không có 409: publisher cũ coi mọi mã ngoài
  200/204/401/403/429/400/413 là lỗi mạng và lùi tới 60 s mãi mãi.
- Không có dữ liệu nhạy cảm mới nào rời máy. `lastAt`, instance id và trạng thái publisher không chứa đường dẫn, tên
  project hay câu lệnh. Nhật ký vòng chỉ xem được trên trang local (Host chỉ loopback) và không bao giờ chứa token.
- `server.js` local vẫn không có endpoint ghi mới. `/api/log` chỉ GET.
- Trang local **giống từng pixel** ở trạng thái bình thường, trừ chỗ một task nói rõ là đổi.
- Không dependency mới, không bước build. `claude-office.html` vẫn một file.
- Không kill tiến trình theo tên ở bất cứ đâu (code, test, script kiểm).

## 5. Đối chiếu phát hiện với code (commit `08f6c10`)

Mọi dòng dưới đây em đã mở code để xem. "Đúng" là đúng như báo cáo; "Đúng, sửa lại" là lỗi có thật nhưng mô tả trong
báo cáo cần chỉnh. **Không phát hiện nào bị bỏ vì sai.**

| ID | Chỗ trong code | Kết quả | Đợt |
|---|---|---|---|
| L-a | `server.js:109` đặt `lastError` cho mọi `tool_result` `is_error`; `:183` báo `error` 30 s | Đúng | 1 |
| L-b | `server.js:182` đoán `permission` khi `PERM_TOOLS` treo > `PERM_MS` (8 s), không xét chế độ | Đúng. Em đã xem transcript thật: `permissionMode` có trên entry `user` và trên entry riêng `type: 'permission-mode'` (giá trị gặp được: `auto`). Registry `~/.claude/sessions/<pid>.json` có `status` chỉ `busy`/`idle`, cộng `startedAt`, `updatedAt`, `statusUpdatedAt`, `procStart` | 1 |
| L1 | `server.js:225-229` ép sub-agent thành `done` khi cha `idle`/`done` | Đúng | 1 |
| L2 | `lib/publisher.js:91-93` coi 400/413 là đã gửi (`lastKey`, `lastSentAt`), trạng thái giữ `sending` | Đúng, sửa lại: lỗi có thật; nguyên nhân "hai transcript gốc cùng `sessionId`" hợp lý nhưng chưa tái hiện được. `server.js:204` chỉ khử trùng session lấy từ registry, còn session từ transcript thì không. Sửa cả hai đầu | 1 |
| L3 | `server.js:158` `liveCache = m.size ? m : null` | Đúng: registry rỗng hay một lần `readdir` lỗi đều quay về lọc theo thời gian | 1 |
| L4 | `server.js:154` chỉ `kill(pid, 0)`, `EPERM` coi là sống; `procStart` không được đọc | Đúng. `procStart` có dạng `ps -o lstart=` ở locale C (ví dụ `Fri Nov  6 02:55:21 2026`) | 2 |
| L5 | `server.js:189-191` | Đúng cả hai ý: tool treo không result giữ sub tới 120 phút (và hiện `permission` nếu là Bash/Edit…); sub im > 5 phút vì đang viết một tin dài bị loại rồi hiện lại | 2 |
| L6 | `server.js:205` gán `updatedAt: now` cho gốc chỉ có trong registry; `:233` cắt `MAX_ROOTS = 16` theo `updatedAt` | Đúng | 2 |
| L7 | `lib/public-view.js:41-44` chữ phòng theo thứ tự gặp trong một tiến trình | Đúng | 2 |
| L8 | `lib/publisher.js:12,104` lùi tới 60 s + 20 % nhiễu; `:86` `paused` chờ cố định 5 phút | Đúng | 2 |
| L9 | `lib/publisher.js:201-207`, `server.js:286-293` | Đúng: `shouldStop()` chỉ được hỏi **trước** lần POST token; trả lời 200 về sau khi "Thoát" đã xoá cấu hình vẫn ghi `config.json` | 2 |
| L10 | `lib/publisher.js:185` `post()` không có timeout | Đúng: hub treo thì `cur` kẹt ở `starting` | 2 |
| L11 | `lib/publisher.js:88-90` | Đúng: 429 không đổi trạng thái, không log; `Retry-After` dạng ngày HTTP → `NaN` → 1 s | 2 |
| L12 | Hai publisher (hai server khác cổng, chung `~/.claude-terrarium`) dùng chung token và seq riêng | Đúng. Gộp vào đợt 1 (§6.6) | 1 |
| H1 | `hub/server.js:110-119` + `hub/publish.js:142-148` đóng mọi luồng; `retry: 3000` | Đúng: EventSource gặp 502 của Cloudflare là đóng hẳn | 2 |
| H2 | `hub/world.js` chỉ ở RAM | Đúng: sau khởi động lại, đảo vẫn có mặt (lấy từ DB) nhưng `online:false`, không nhân viên, tới khi máy gửi lại (heartbeat 30 s, cộng lùi) | 2 |
| H3 | `hub/publish.js:115, 213, 216` | Đúng: mỗi lần mở/đóng luồng đọc DB và phát `world` cho mọi người | 2 |
| H4 | `hub/publish.js:190-191` bỏ qua `{accepted:false}` của `hub/world.js:72`, trả 204 | Đúng, sửa lại: một publisher khởi động lại **không** bị chặn, vì seq 0 luôn được nhận như một lần khởi động lại (`world.js:72`, test `seq 0 after a higher seq is accepted as a restart`). Đường thật dẫn tới seq cũ là **hai publisher trên một máy** (L12) | 1 |
| H5 | `hub/world.js:33-39` đánh nhãn phòng chỉ trên máy đang online | Đúng | 2 |
| H6 | `hub/world.js:8` + tick 5 s | Đúng | không xếp lịch |
| H7 | `hub/publish.js:203, 206` ném `HttpError` 503/429 không có `Retry-After` | Đúng | 2 |
| H8 | `hub/http.js:115` so khớp method chính xác: `HEAD /` → 404 | Đúng | 3 |
| H9 | `hub/http.js:67-73` tin mục cuối `X-Forwarded-For` | Đúng; `CF-Connecting-IP` bị bỏ qua | 2 |
| H10 | `hub/publish.js:137` `: ping` là comment SSE, JS không thấy | Đúng | 1 |
| H11 | `hub/world.js:92` phát `remove` + `world`; `publish.js:86-89` biến `remove` thành `world` khi còn bản ghi | Đúng: hai `world` liền nhau | 2 (miễn phí) |
| V1 | `claude-office.html:5122, 5140` (`syncLive`), `:5212` và `:6171` (thêm vào `goneSids`) | Đúng: nhân viên đi khỏi vì danh sách rỗng được thêm vào `goneSids` **sau** lần sync rỗng; lần sync có lại chính các sid đó bỏ qua chúng và giữ chúng trong `goneSids` mãi | 1 |
| V2 | `:6448-6454` (luồng), `:6847-6848` (chip) | Đúng | 1 |
| V3 | `:6452-6454`, `:6529-6541`, `:6544-6551` | Đúng: lỗi kéo dài `STALL_MS` → `worldEnded(false)` → probe `down` → "unreachable", không tự thử lại, cảnh đã bị xoá | 2 |
| V4 | `:6452` (`CLOSED` → `worldEnded(true)`), `:6546` | Đúng: luồng 502/503 rồi probe 200 → "Hub từ chối luồng xem" | 2 |
| V5 | `:6531-6532` | Đúng: mọi lần dừng xoá sạch cảnh; trước 10 s không có dấu hiệu gì | 2 |
| V6 | `freeDeskFor` `:5040-5044` đếm cả người đang đi ra; `addAgent` trả `null` → `syncLive` bỏ qua (`:5125`) | Đúng; tab ẩn làm `uiTimer` chậm, `dt` bị chặn 0.05 s, người đi ra gần như đứng yên | 2 |
| V7 | `hub/world.js` có `lastAt` theo máy nhưng `metaOf` không gửi | Đúng | 3 |
| V8 | "Của tôi" hiện online của cả đảo | Đúng, sửa lại: `/api/me` đã trả `lastUsedAt` (ghi DB mỗi 30 s, `hub/me.js:94`) nhưng giao diện không hiện; thiếu là phần hiển thị, `lastAt` chính xác từ RAM, và cách nhận ra "máy này" | 3 |
| V9 | `:6353`, `:6361`, `:6371` (`r.ok?…:null`), `:6359-6365` (`watchJoin` chạy mãi), `:6346` (xoá lỗi ghép máy) | Đúng | 3 |
| V10 | `:6341-6344` ẩn chip khi preview lỗi; `lib/publisher.js:120` báo `sending` trước khi có lần gửi nào được nhận | Đúng | 3 |
| V11 | `:4943` `uiTimer`, `:6347` `previewTimer` | Đúng | 2 |
| V12 | `:5137` sub `done` chỉ rời đi ở lần sync kế tiếp | Đúng: ở chế độ thế giới, sự kiện `island` chỉ tới khi có thay đổi, nên có thể chậm tới ~30 s | 2 |

## 6. Đợt 1: đúng dữ liệu

### 6.1 Logic trạng thái thành hàm thuần (`lib/status.js`)

Mọi quyết định trạng thái ở L-a, L-b, L1, L3 (và L4, L5, L6 ở đợt 2) chuyển từ `server.js` sang module mới
`lib/status.js` (CommonJS, Node ≥ 18). `ingest`, `brief`, `projectOf`, `parentFromPath` và phần thân của `snapshot()`
chuyển theo. `server.js` chỉ còn đọc file, cache và gọi hàm. Test chạy hàm thuần với **transcript mẫu** trong
`tests/fixtures/transcripts/` (viết tay, không có dữ liệu thật) và một thư mục registry tạm.

Đầu ra của `snapshot()` giữ nguyên hình dạng (`{at, sessions[], usage, version}`, mỗi session cùng các khoá như cũ), nên
trang local và `publicView` không đổi.

### 6.2 L-a: lỗi tool không phải lỗi session

- `tool_result` có `is_error` **không** đặt trạng thái `error` nữa. Dòng "Lỗi · …" vẫn vào `recent[]` (bảng chi tiết),
  còn trạng thái đi theo đường bình thường (`thinking` khi model đang xử lý kết quả).
- `error` chỉ đến từ **lỗi API**: entry `assistant` có `isApiErrorMessage: true` (model `<synthetic>`, có `apiError`,
  `apiErrorStatus`). Khi entry cuối có nghĩa của session là lỗi API:
  - hiện `error` trong `ERROR_MS` (30 s) kể từ lúc đó;
  - hoặc lâu hơn nếu registry báo `idle` (session dừng ngay sau lỗi): `error` giữ tới entry kế tiếp.
- `detail` khi `error` là 60 ký tự đầu của câu báo lỗi API, như `errText` trước đây.

### 6.3 L-b: "chờ duyệt" chỉ khi chế độ có hỏi

- `st.permMode` = giá trị `permissionMode` mới nhất trong transcript (entry `user` hoặc entry `permission-mode`).
- Sub-agent không có `permissionMode` riêng thì dùng của session cha.
- `promptable(mode, tool)`:
  - `auto`, `bypassPermissions` → không bao giờ (tool treo lâu là `working`);
  - `acceptEdits` → chỉ `Bash`, `WebFetch`;
  - `default`, `plan`, không rõ → mọi `PERM_TOOLS`, như hôm nay.
- `permission` = tool đang treo, `promptable`, và treo quá `PERM_MS`. Ở chế độ `default`, một Bash đã được duyệt mà chạy
  lâu vẫn bị đoán nhầm là `permission`: transcript không ghi lúc duyệt, registry chỉ có `busy`/`idle`. Đây là giới hạn
  đã biết, ghi lại trong comment.

### 6.4 L3: registry nghiêm

`liveFromRegistry(read, {prev, alive})`:
- thư mục `~/.claude/sessions` **không tồn tại** (`ENOENT`, Claude Code cũ) → `null` → lọc theo thời gian như hôm nay;
- đọc được thư mục → luôn trả một `Map`, **kể cả rỗng**. Không có session sống nghĩa là không có ai, không phải "lấy
  mọi transcript 2 giờ qua";
- `readdir` lỗi khác (`EMFILE`, `EACCES`…) → giữ danh sách tốt lần trước (`prev`), không có thì `null`;
- một file `<pid>.json` đang ghi dở (JSON hỏng) → giữ mục cũ của chính file đó nếu có.

### 6.5 L1: sub-agent sống theo transcript của chính nó

- Bỏ khối "cha `idle`/`done` → con `done`".
- `subOutcome(st, {now, parentInterruptedAt})`:
  - `done` khi sub đã nộp (`StructuredOutput`, `SubagentHandback`), hoặc lượt cuối của chính nó là `end_turn` và không
    còn tool treo; giữ `done` 30 s rồi bỏ (như hôm nay);
  - `done` khi session cha bị ngắt (`[Request interrupted…`) **sau** hoạt động cuối của sub (thay cho lý do cũ của khối
    đã bỏ: sub bị huỷ theo cha);
  - còn lại sub giữ trạng thái tính từ transcript của nó. Sub chạy nền trong khi cha đã hết lượt hiện đúng là
    `working`/`thinking`; cha hiện `done`/`idle`.
- Cha đóng hẳn (không còn trong registry) thì sub bị bỏ như hôm nay.

### 6.6 H4 + L12: trả lời publish trung thực, một máy một instance đang gửi

**Hub** (`world.publish` trả kết quả, `publish.js` gửi nguyên kết quả):
- `200 {"accepted":true}`;
- `200 {"accepted":false,"reason":"stale_seq","seq":<seq hub đang giữ>}`;
- `200 {"accepted":false,"reason":"other_instance"}`.

**Instance**: mỗi lần `startPublisher` sinh một id 16 hex ngẫu nhiên, gửi trong header `X-Terrarium-Instance`. Header
thiếu hoặc sai dạng → instance `legacy` (không bao giờ 400). Hub nhớ instance đang giữ mỗi máy (`device`):
- máy chưa có ai giữ, hoặc cùng instance → xét seq như hôm nay (seq 0 luôn là khởi động lại);
- instance khác → **nhận** (đổi chủ) khi gói có `seq === 0` (một tiến trình vừa khởi động) **hoặc** chủ cũ đã im
  `OFFLINE_MS`; còn lại → `other_instance`.

Kết quả: tiến trình mới nhất thắng; tiến trình cũ đứng chờ (`standby`), thử lại theo nhịp heartbeat bằng seq của nó (khác
0) nên không giành lại; khi tiến trình đang giữ chết, sau 90 s tiến trình chờ tự nhận.

**Publisher** (đợt 1):
- 200 JSON `accepted:true` hoặc 204 (hub cũ) → đã gửi.
- `stale_seq` → `seq = body.seq + 1`, gửi lại ở tick sau (tối đa một lần mỗi 10 s).
- `other_instance` → trạng thái `standby`, chờ `HEARTBEAT_MS` rồi thử lại.
- 400/413 → **không** coi là đã gửi: trạng thái `offline`, log mỗi lần kèm lý do (cắt 80 ký tự, đã `clean`), chờ
  `REJECT_WAIT_MS` (15 s) rồi gửi lại, seq giữ nguyên. Đợt 3 tách thành trạng thái riêng `rejected` (§8.1). Em chọn
  `offline` ở đợt 1 vì chip đã có nhãn đỏ cho nó trong cả 7 ngôn ngữ, nên đợt 1 không phải đổi giao diện vì L2.
- Gốc của L2: `buildSessions` gộp các session gốc trùng `id` (giữ cái có hoạt động mới nhất); `publicView` bỏ các id
  trùng sau khi băm. Gói gửi đi không bao giờ có `duplicate id`.

### 6.7 V1: nhân viên quay lại khi đảo quay lại

`goneSids` thành `Map<sid, 'done'|'missing'>`:
- `'done'`: sub-agent rời đi vì đã xong. Sid này bị bỏ qua khi còn trong danh sách (để nó không quay lại trong lúc local
  vẫn liệt kê nó 30 s), và bị quên khi rời danh sách. Như hôm nay.
- `'missing'`: rời đi vì không còn trong danh sách (đảo offline, riêng tư, session đóng). Sid này **không bao giờ bị
  bỏ qua**: nó có lại trong danh sách là nhân viên được tạo lại. Nếu người đó còn đang đi ra cửa thì quay lại bàn.

Hàm thuần `WorldLogic.goneStep(gone, listed)` quyết định. `syncLive` là method chung của trang local và `IslandScene`,
nên trang local cũng được sửa (chỉ đổi hành vi khi danh sách rỗng rồi có lại, không đổi pixel).

### 6.8 V2 + H10: ping có tên và canh gác luồng

- Hub thay `: ping` bằng `event: ping` + `data: {"t":<ms>}` mỗi `PING_MS` (25 s). Vẫn dưới mức nghỉ 100 s của
  Cloudflare.
- Trang: mọi sự kiện (`world`, `island`, `remove`, `ping`) cập nhật `lastEventAt`. Canh gác **chỉ bật sau khi đã nhận
  một `ping` có tên** (hub cũ không có, §9.3). Im quá `PING_STALE_MS` (40 s) → chip "Mất kết nối, đang thử lại", đóng và
  mở lại luồng, giữ cảnh.

## 7. Đợt 2: chịu lỗi

### 7.1 Hub khởi động lại êm (H1, H7)

- Khi đóng (SIGTERM, `close()`), trước khi ngắt, hub gửi cho **từng** luồng:
  `event: restarting` + `data: {"retryMs":r}` + `retry: r`, với `r` ngẫu nhiên đều trong 5–20 s cho mỗi luồng, rồi
  đóng. Trong lúc này không phát `world` nữa.
- Trang mới nghe `restarting`: đóng luồng, kết nối lại sau `r`, cảnh giữ nguyên và mờ đi. Trang cũ (đang mở từ trước
  deploy) không nghe sự kiện này nhưng EventSource của nó tôn trọng `retry: r`: nó thử lại sau 5–20 s thay vì 3 s, qua
  được cửa sổ 502 nếu hub lên lại trong dưới 5 s.
- Trải `r` trên 15 s để 300 người xem không ùa vào cùng một giây.
- 503 (đủ 300 luồng) kèm `Retry-After: 30`, 429 (đủ 5 luồng mỗi người) kèm `Retry-After: 10`. EventSource không đọc
  được header, nên phía trang vẫn dựa vào vòng thử lại của §7.4; header là cho người vận hành và client khác.

### 7.2 Sự kiện `world` rẻ, đảo "đang chờ máy gửi lại" (H3, H11, H2)

- Mọi lần phát `world` đi qua một van: tối đa một lần mỗi `WORLD_EVERY_MS` (1 s), có lần gửi cuối mang trạng thái mới
  nhất. Payload và chuỗi frame tính **một lần** cho mỗi lần phát. Frame giống hệt lần trước thì không phát (H11).
- Người mới vào nhận `world` và mọi `island` **riêng cho mình**, ngay lập tức. Người khác biết số người xem mới qua van.
- 300 người kết nối lại trong 15 s: khoảng 15 lần phát × 300 = 4.500 frame, thay vì khoảng 90.000.
- H2: trong `OFFLINE_MS` đầu sau khi hub khởi động, đảo có trong DB mà chưa có máy nào gửi lại được gửi kèm
  `waking: true` (vẫn `online: false` cho trang cũ). Trang mới vẽ đảo mờ với dòng "đang chờ máy gửi lại" thay vì
  "offline". Hết 90 s, hub phát một `world` và đảo nào chưa gửi thành offline như thường.
- Publisher (§7.5) lùi tối đa 15 s, nên sau khi hub lên lại, đảo có nhân viên trở lại trong khoảng heartbeat 30 s.

### 7.3 Nhãn phòng ổn định (H5, L7)

- Hub: nhãn của mỗi cặp (máy, chữ) được cấp **lần đầu thấy** và giữ suốt thời gian đảo còn trong RAM, kể cả khi máy đó
  offline. Một máy tắt không làm phòng của máy khác đổi tên. Nhãn của máy đã tắt không được cấp lại.
- Máy: chữ phòng của mỗi project lưu ở `~/.claude-terrarium/rooms.json` (0600), khoá là HMAC 12 hex của project (dùng
  salt của cấu hình, nên không có tên project trên đĩa ngoài cái đã có trong transcript). Mọi tiến trình (khởi động lại,
  tiếp quản cổng, hai server) dùng chung file nên cùng project luôn cùng chữ. Đủ 16 chữ thì project mới lấy chữ của
  project lâu không gặp nhất.

### 7.4 Người xem tự kết nối lại (V3, V4, V5)

Thay `worldEnded` / `worldStopped` / `retryWorld` bằng một máy trạng thái thuần `WorldLogic.linkStep`:
- `live`: luồng mở.
- `reconnecting`: luồng rớt (lỗi mạng, 502/503 khiến EventSource đóng, canh gác, `restarting`). Cảnh **giữ nguyên, mờ
  đi** ngay lập tức (V5), dải trên stage "Đang kết nối lại…". Thử lại sau 1, 2, 4, 8, 16, 30 s (±20 %), có probe
  `/api/config` trước mỗi lần.
- `down`: probe không có trả lời. Dải đỏ "Hub không phản hồi · thử lại sau {s} giây", nút "Thử lại ngay". Vẫn tự thử
  lại, khoảng cách tối đa 60 s.
- `refused`: probe trả `world` nhưng luồng đóng 5 lần liền mà chưa mở được (nhiều khả năng là hết chỗ luồng). Bảng "Hub
  từ chối luồng xem" như hôm nay, **vẫn tự thử lại mỗi 60 s**.
- `busy` (429 ở `/api/config`) chờ theo `Retry-After` như hôm nay.
- Đăng xuất (probe 401) → tải lại trang, như hôm nay.
- Thức dậy (đồng hồ nhảy > 15 s giữa hai nhịp `uiTimer`), sự kiện `online`, tab hiện lại → thử ngay, đặt lại bộ đếm lùi
  (V3).
- Cảnh chỉ bị xoá khi đã mất kết nối liên tục 5 phút.

### 7.5 Publisher và ghép máy (L8–L11)

- Lùi: tối đa **15 s** (±20 %), thay vì 60 s. Hub nhỏ (≤ 8 đảo), nên nhịp này không làm hub quá tải.
- Thức dậy: khoảng cách giữa hai tick > 10 s → quên lùi, gửi lại ngay (hub có thể đã đánh dấu offline trong lúc ngủ).
- `paused` (cần đăng nhập lại hub) hỏi lại mỗi 60 s thay vì 5 phút.
- 429: đọc `Retry-After` dạng giây **hoặc** ngày HTTP, kẹp 1–300 s; log tối đa một dòng mỗi phút.
- `join`: mọi POST có timeout 15 s. `/api/device/start` không trả lời → lỗi "the hub did not answer; try again". Một lần
  hỏi token quá hạn → vẫn hỏi tiếp tới hết hạn mã.
- `join` hỏi lại `shouldStop()` **sau** khi nhận token, trước khi ghi cấu hình. Đã dừng (người dùng bấm "Thoát" trong lúc
  đó) → không ghi, thu hồi token vừa nhận trên hub, báo `cancelled` (L9).
- `makeJoinFlow`: `starting` quá 60 s mà chưa tới `pending` → `error` `hub_timeout` (L10).

### 7.6 Sống/chết của session (L4, L5, L6)

- L4: một pid được coi là sống khi `kill(pid, 0)` thành công (hoặc `EPERM`) **và**, nếu registry có `procStart` và đọc
  được giờ bắt đầu của pid (`ps -o lstart= -p <pid>`, `LC_ALL=C`, không qua shell, nhớ theo pid), hai giờ đó khớp (so
  sau khi gộp khoảng trắng). Không có `ps` (Windows, lỗi) → chỉ `kill(0)` như hôm nay.
- L5a: tool treo không có kết quả hết hạn khi file transcript không lớn thêm: Bash sau 11 phút (Bash tối đa 10 phút),
  tool khác sau 15 phút. `Agent`/`Task` không hết hạn (sống theo sub của nó). Tool hết hạn không còn làm `permission`
  hay `working`.
- L5b: sub-agent không có tool treo mà entry cuối là `tool_result`/prompt (model đang viết) được giữ tới 15 phút, thay
  vì 5 phút.
- L6: gốc chỉ có trong registry lấy `updatedAt` thật (`updatedAt`, rồi `statusUpdatedAt`, rồi `startedAt` của registry),
  nên không chen lên đầu và đẩy session đang làm ra ngoài 16 bàn.

### 7.7 IP người dùng sau Cloudflare (H9)

`HUB_TRUST_PROXY`:
- `1` → như hôm nay (mục cuối `X-Forwarded-For`);
- `cloudflare` → `CF-Connecting-IP` nếu là IP hợp lệ, không thì như `1`;
- trống → không tin header nào; giá trị khác → lỗi cấu hình khi khởi động.

Chỉ bật `cloudflare` khi origin chỉ đi tới được qua Cloudflare (Tunnel), vì header này giả được nếu origin lộ ra ngoài.

### 7.8 Tab ẩn và sub-agent xong (V6, V11, V12)

- Tab ẩn: người rời đi biến mất ngay (không có ai xem đoạn đi ra cửa), nên bàn được trả lại ngay và session mới có chỗ.
- Tab ẩn: `uiTimer` không gọi `setState`, `previewTimer` dừng; tab hiện lại thì chạy một khung và hỏi preview ngay.
- Sub-agent `done` quá 3 s thì rời đi theo đồng hồ của trang, không chờ lần sync kế tiếp.

## 8. Đợt 3: nhìn thấy được

### 8.1 Trạng thái publisher

`publisher.state()` và `/api/public-preview` trả thêm:

```js
{ state,        // 'off'|'connecting'|'sending'|'private'|'offline'|'rejected'|'standby'|'paused'|'revoked'
  share, private, hub,
  deviceId,     // từ config, 16 hex, hoặc null
  instance,     // 16 hex của tiến trình này
  lastOkAt,     // ms, lần cuối hub nhận gói, hoặc null
  lastAttemptAt,
  lastErr,      // {code, at, reason?} | null; code: 'network:<mã>'|'http:<status>'|'rejected:<lý do>'|'stale_seq'|
                //                               'other_instance'|'login_required'|'rate_limited'
  failures, nextRetryAt,  // ms hoặc null
  hubAck }      // 'json' (hub mới), 'legacy' (hub trả 204), null (chưa gửi)
```

- `connecting`: đã có cấu hình nhưng chưa có lần gửi nào được nhận (V10, thay cho `sending` giả ở `publisher.js:120`).
- `rejected`: 400/413, màu đỏ, kèm lý do. Tách khỏi `offline` (đợt 1 gộp chung).
- `view` trong preview có `stale: true` khi `offline`, `rejected`, `standby` hay `paused`.

### 8.2 Nhật ký vòng

- `lib/logbuf.js`: 200 dòng gần nhất `{at, line}`. Mọi log của publisher đi qua đây và ra console như cũ. Che
  `Bearer …` cho chắc (S4 đã cấm log token).
- Log mỗi lần đổi trạng thái; khi đang lỗi, một dòng tóm tắt mỗi 60 s ("still offline: 5 failures, http:502, next try
  in 12 s"), thay vì im lặng như hôm nay.
- `GET /api/log` trên server local (cùng kiểm `Host` như mọi route). `hooks/register.ts` chuyển cả dòng stdout bắt đầu
  bằng `terrarium:` vào debug log của Claude Code.

### 8.3 Hub: `/healthz`, `/metrics`, HEAD, `lastAt`

- Router: `HEAD` dùng route `GET` cùng đường dẫn (Node bỏ thân). `/api/world/stream` từ chối `HEAD` (405), để `HEAD`
  không mở luồng.
- `GET /healthz` không cần đăng nhập: `200 {ok, uptimeS, db:'ok', streams, version}`; DB không trả lời `SELECT 1` → 503.
- `GET /metrics` (dạng text Prometheus): chỉ khi có env `HUB_METRICS_TOKEN` (≥ 32 ký tự) và đúng
  `Authorization: Bearer`. Không có env → 404. Số liệu: luồng đang mở, đảo online, đảo có slot, publish theo kết quả
  (`accepted`, `stale_seq`, `other_instance`, `bad_packet`, `too_large`, `rate_limited`, `unauthorized`), luồng bị từ
  chối (503/429), số 429 chung, số lần phát `world`, uptime.
- `world` mỗi đảo thêm `lastAt` (ms theo đồng hồ hub, lần gửi mới nhất của mọi máy, hoặc `null`), payload thêm `now`
  (đồng hồ hub). `/api/me` mỗi máy thêm `lastAt`.

### 8.4 Giao diện

- **Trang local, viên "Máy này"** (trong ⚙, mục Thế giới, khi đã tham gia): chấm màu + trạng thái + "gửi lúc 14:32 · 3
  phút trước"; khi lỗi thêm "lỗi http:502 · thử lại sau 12 giây · 5 lần". Nút "Nhật ký" hiện 50 dòng cuối của
  `/api/log` (chỉ `textContent`). Chip trên thanh có thêm `connecting` (vàng), `rejected` (đỏ), `standby` (xám, có từ đợt
  1); trạng thái `sending` bình thường giống từng pixel như trước.
- **Server local không trả lời** (V10): chip vẫn hiện, ghi "Thế giới: server local không phản hồi", không biến mất như
  khi chưa tham gia.
- **Ghép máy** (V9): lỗi HTTP của server local hiện mã và lý do; `watchJoin` dừng sau 3 lần hỏi lỗi liên tiếp; lỗi ghép
  máy chỉ bị xoá khi publisher thật sự `sending`/`private`.
- **Trang thế giới, chú giải ba trạng thái**: nút "?" cạnh chip kết nối mở một bảng nhỏ ba dòng, dòng đúng với lúc này
  được tô:
  - xám, **Đảo offline**: máy của chủ đảo không gửi nữa; đảo mờ, ghi "gửi lúc …";
  - vàng, **Đang kết nối lại**: kết nối của bạn tới hub bị ngắt; đảo được giữ và làm mờ;
  - đỏ, **Hub không phản hồi**: trang tự thử lại.
- **Tuổi dữ liệu** (V7): dưới 45 s là tươi; 45–90 s đảo mờ dần tới `OFFLINE_ALPHA`; nhãn ghi "gửi lúc 14:32 · 3 phút
  trước" khi không còn tươi. Tuổi tính theo đồng hồ hub (`now − lastAt`) cộng thời gian đã trôi trên trang, nên đồng hồ
  máy người xem lệch cũng không sao.
- **"Của tôi"** (V8): mỗi máy có "gửi lúc …" (`lastAt`, thiếu thì `lastUsedAt`). Chip trên trang local mở hub với
  `#this-device=<deviceId>`; trang thế giới đọc mảnh này một lần, giữ trong `sessionStorage`, xoá khỏi thanh địa chỉ, và
  gắn thẻ "Máy này" cho dòng máy đó.

## 9. Tương thích giao thức trong lúc nâng cấp

Hub production và publisher trên máy mọi người lên bản mới vào những lúc khác nhau. Trang thế giới do chính hub phục vụ,
nhưng hub đọc lại `claude-office.html` mỗi khi file đổi (`createOfficePage`), nên trong lúc deploy có thể có **trang mới
trên tiến trình hub cũ**. Trang local do `server.js` local phục vụ từ cùng thư mục plugin; bản cập nhật plugin tạo thư
mục mới, nên tiến trình cũ (đang giữ cổng) có thể phục vụ trang cũ một thời gian.

### 9.1 Publisher ↔ hub

| Điểm | Publisher cũ → hub mới | Publisher mới → hub cũ |
|---|---|---|
| Thân gói publish | Không đổi | Không đổi. **Không khoá mới** (hub cũ trả 400 cho khoá lạ) |
| Trả lời publish | Hub trả `200 {accepted…}`; publisher cũ coi 200 như 204 (`publisher.js:72`) và bỏ qua thân. Gói bị bỏ vẫn bị coi là đã gửi, **giống hệt hôm nay**, không tệ hơn | Hub cũ trả 204 → publisher mới coi là nhận (`hubAck: 'legacy'`) |
| Seq cũ | Không bao giờ 409: publisher cũ coi 409 là lỗi và lùi mãi với cùng seq | Không xảy ra với một publisher (seq 0 là khởi động lại) |
| `X-Terrarium-Instance` | Thiếu → instance `legacy`; hai publisher cũ trên một máy: như hôm nay | Hub cũ bỏ qua header; hai publisher mới trên một máy: như hôm nay (không có `standby`) |
| 400/413 | Như hôm nay | Publisher mới hiện `offline` (đợt 1) / `rejected` (đợt 3) và thử lại mỗi 15 s, không quay vòng |
| `Retry-After` | Không đổi | Publisher mới đọc cả dạng ngày |

### 9.2 Hub ↔ trang thế giới

| Điểm | Trang cũ (tab mở từ trước deploy) ↔ hub mới | Trang mới ↔ tiến trình hub cũ |
|---|---|---|
| `event: ping` | EventSource bỏ qua sự kiện không có ai nghe; vẫn giữ kết nối như comment | Không có `ping` có tên → canh gác **không bật**, trang cư xử như hôm nay |
| `event: restarting` + `retry:` | Bỏ qua sự kiện; `retry:` vẫn có tác dụng (thử lại sau 5–20 s) | Không có; vòng thử lại §7.4 vẫn đưa trang về khi hub lên lại |
| `world`: `lastAt`, `now`, `waking` | Bỏ qua khoá lạ (`worldMeta` chỉ đọc khoá nó biết) | Thiếu → không có "gửi lúc …", không mờ theo tuổi, đảo vẽ theo `online` như hôm nay |
| `/api/me` `devices[].lastAt` | Bỏ qua | Thiếu → dùng `lastUsedAt` |
| HEAD, `/healthz`, `/metrics` | Không liên quan | Không liên quan |

### 9.3 Server local ↔ trang local

| Điểm | Trang mới ↔ server cũ |
|---|---|
| Trường mới trong `/api/public-preview` | Thiếu → viên "Máy này" chỉ hiện trạng thái; không lỗi |
| `/api/log` | 404 → ẩn nút "Nhật ký" |
| Trạng thái mới (`connecting`, `rejected`, `standby`) gặp trang cũ | Chip cũ hiện "…" xám (nhánh dự phòng sẵn có); chấp nhận được |

### 9.4 Thứ tự deploy khuyên dùng

Mỗi đợt: **hub trước**, rồi phát hành plugin. Hub mới tương thích với mọi publisher cũ (§9.1), nên không cần chờ ai.
Không có bước nào phải làm đồng thời.

## 10. Hằng số

| Tên | Giá trị | Ở đâu |
|---|---|---|
| `ERROR_MS` | 30 s (giữ) | `lib/status.js` |
| `PERM_MS` | 8 s (giữ, env `PERM_SEC`) | `server.js` → `lib/status.js` |
| `PENDING_STALE_MS` | Bash 11 phút, tool khác 15 phút, `Agent`/`Task` không hết hạn | `lib/status.js` |
| `THINK_STALE_MS` | 15 phút | `lib/status.js` |
| `SUB_STALE_MS` | 5 phút (giữ) | `lib/status.js` |
| `PING_MS` | 25 s (giữ) | `hub/publish.js` |
| `PING_STALE_MS` | 40 s | `WorldLogic` |
| `WORLD_EVERY_MS` | 1 s | `hub/publish.js` |
| Khoảng `retryMs` khi hub đóng | 5–20 s, đều | `hub/publish.js` |
| `Retry-After` luồng | 503: 30 s, 429: 10 s | `hub/publish.js` |
| `BACKOFF_MIN` / `BACKOFF_MAX` | 2 s / **15 s** (cũ 60 s) | `lib/publisher.js` |
| `WAKE_GAP_MS` (publisher) | 10 s | `lib/publisher.js` |
| `LOGIN_WAIT_MS` | **60 s** (cũ 5 phút) | `lib/publisher.js` |
| `REJECT_WAIT_MS` | 15 s | `lib/publisher.js` |
| `JOIN_FETCH_MS` | 15 s | `lib/publisher.js` |
| Kẹp `Retry-After` (publisher) | 1–300 s | `lib/publisher.js` |
| Thử lại của trang | 1, 2, 4, 8, 16, 30 s ±20 %; `down` tối đa 60 s; `refused` sau 5 lần, rồi mỗi 60 s | `WorldLogic` |
| `WAKE_JUMP_MS` (trang) | 15 s | `WorldLogic` |
| `KEEP_STALE_MS` | 5 phút | `WorldLogic` |
| `FRESH_MS` / `OFFLINE_AFTER_MS` | 45 s / 90 s | `WorldLogic` |
| Nhật ký vòng | 200 dòng; trang hiện 50 | `lib/logbuf.js` |

## 11. Kiểm thử

- Hàm thuần có test đơn vị: `lib/status.js` với transcript mẫu (`tests/status.test.mjs`), `WorldLogic` (canh gác,
  `goneStep`, `linkStep`, `reconnectDelay`, `freshness`, `pillView`), `lib/logbuf.js`, publisher với `fetch` giả.
- Hub: test tích hợp trên dev hub (`tests/hub-helpers.mjs`, cổng ngẫu nhiên, DB tạm).
- Giao diện: kiểm bằng mắt trên một hub giả và một preview giả (script ở scratchpad, không commit), Chrome headless, sáng
  và tối, 1280×800 và 390×844. Trang local: ảnh chụp trước/sau, khác biệt bằng 0 trừ chỗ task nói khác.
- Ma trận phiên bản (§9) chạy thật ở task cuối mỗi đợt, với bản cũ lấy từ một worktree tạm ở commit `08f6c10` (không
  dùng `git stash`).
- Không test nào đụng cổng 4317 hay `~/.claude-terrarium`; tiến trình con chỉ được dừng qua PID của chính nó.

## 12. Những phần em tự chọn (anh Kiet có thể đổi)

| # | Lựa chọn | Lý do |
|---|---|---|
| R1 | Trả lời publish luôn là **200 + JSON**, kể cả khi bỏ gói; **không dùng 409** | Publisher cũ hiểu 200 là thành công (không tệ hơn hôm nay), còn 409 thì nó coi là lỗi và lùi mãi |
| R2 | **Không khoá mới trong thân publish**; instance đi qua header `X-Terrarium-Instance`; header sai dạng thì bỏ qua, không 400 | `validate.js` của hub cũ từ chối khoá lạ |
| R3 | Một máy, hai instance: **tiến trình mới nhất thắng** (seq 0), tiến trình kia `standby`; tự nhận lại sau 90 s im lặng | Hai tiến trình trên cùng máy đọc cùng transcript, nên gói gần như giống nhau; cần một quy tắc tất định, không lật qua lật lại |
| R4 | L12 gộp vào đợt 1 | Sửa H4 (`stale_seq` → nhảy seq) mà không có instance thì hai publisher nhảy seq qua lại, cả hai đều được nhận, đảo lật giữa hai gói |
| R5 | Đợt 1 báo 400/413 là `offline`; đợt 3 mới có `rejected` | Giữ `rejected` ở đợt 3 như anh Kiet xếp; đợt 1 đã trung thực ("không gửi được") mà không phải thêm chữ trên giao diện |
| R6 | Ping thành `event: ping` có `data`; canh gác chỉ bật sau `ping` đầu tiên | Trang cũ bỏ qua sự kiện lạ; trang mới trên hub cũ không bị đóng luồng oan |
| R7 | `world` thêm `lastAt` và `now` (đồng hồ hub) | Tuổi dữ liệu không phụ thuộc đồng hồ máy người xem |
| R8 | H2 sửa bằng cờ `waking` 90 s, không lưu thế giới | Spec multi-island cấm hub lưu trạng thái hoạt động |
| R9 | `/metrics` cần `HUB_METRICS_TOKEN`; thiếu env thì 404. `/healthz` công khai nhưng chỉ có ok/uptime/db/số luồng | Số liệu vận hành không cần lộ ra internet |
| R10 | `HUB_TRUST_PROXY=cloudflare` là giá trị mới; `1` giữ nghĩa cũ | Cấu hình đang chạy không đổi hành vi |
| R11 | Chữ phòng lưu ở `rooms.json` theo HMAC của project | Ổn định qua mọi tiến trình; không thêm tên project lên đĩa |
| R12 | Lùi tối đa 15 s; `paused` hỏi lại mỗi 60 s | Hub ≤ 8 đảo, tải không đáng kể; đảo về nhanh sau deploy |
| R13 | Liveness đọc `procStart` bằng `ps`, nhớ theo pid | Không dependency; `ps` chỉ chạy một lần cho mỗi pid mới |
| R14 | Logic trạng thái tách sang `lib/status.js` | Kiểm được bằng transcript mẫu; `server.js` mỏng đi |
| R15 | "Máy này" trên trang thế giới nhận ra máy qua mảnh `#this-device=` trong link từ trang local | Hub không có cách nào khác để biết người xem đang ngồi ở máy nào; mảnh URL không bao giờ gửi lên server |
| R16 | Chỉ task cuối mỗi đợt sửa `CHANGELOG.md` và `docs/hub-setup.md` dùng chung (trừ task hub đổi env) | Cho phép chạy song song mà không đụng file chung |

## 13. Để người làm tự quyết

- Cách vẽ "mờ" khi đang kết nối lại (độ mờ, có xám hoá hay không), miễn là phân biệt được với đảo offline.
- Câu chữ tiếng Anh của log publisher, miễn là không chứa token, đường dẫn hay tên project.
- Tên nội bộ của biến và hàm phụ không nằm trong mục Interfaces của plan.
