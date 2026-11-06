# Connection hardening (3 đợt) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm trọn ba đợt ở §0 của spec: đợt 1 sửa dữ liệu sai hoặc mất (trạng thái nhân viên, gói bị từ chối trong im
lặng, nhân viên không quay lại, luồng treo vẫn "Đã kết nối"); đợt 2 cho hub, publisher và người xem chịu được deploy,
ngủ/tỉnh và mạng chập chờn; đợt 3 cho chủ máy, người xem và người vận hành thấy được chuyện gì đang xảy ra.

**Architecture:**
- Máy: logic trạng thái session chuyển từ `server.js` sang module thuần mới `lib/status.js` (test bằng transcript mẫu).
  Publisher đọc trả lời JSON của hub, gửi instance id qua header, không bao giờ đổi thân gói. Đợt 3 thêm `lib/logbuf.js`
  và `GET /api/log`.
- Hub: `world.publish` trả kết quả thật, `publish.js` trả `200 {accepted, reason?}`; ping có tên; khi đóng thì báo
  `restarting` cho từng luồng; sự kiện `world` đi qua một van 1 giây; đợt 3 thêm `hub/health.js` (`/healthz`, `/metrics`)
  và HEAD.
- `claude-office.html` vẫn một file. Logic mới của người xem là hàm thuần trong khối `<script id="world-logic">`
  (`goneStep`, `streamStale`, `linkStep`, `reconnectDelay`, `freshness`, `pillView`); `world-view` và component chính
  chỉ nối dây.
- Thân gói publish, hình dạng `snapshot()` và mọi khoá cũ của sự kiện `world` **không đổi**. Mọi thứ mới đều là phần
  thêm mà phía cũ bỏ qua được (spec §9).

**Tech Stack:** Node ≥ 22.13 cho hub (`node:sqlite`), Node ≥ 18 cho server local và publisher; `node:test`, `node:vm`;
React 18 UMD, Canvas 2D.

**Spec:** `docs/specs/2026-11-06-connection-hardening-design.md`. Bảng đối chiếu từng phát hiện với code ở §5, các lựa
chọn của em ở §12 (R1–R16), ma trận tương thích ở §9.

## Chạy song song

Ba đợt chạy **nối tiếp**: đợt sau bắt đầu khi task cuối của đợt trước đã vào nhánh (mỗi đợt deploy riêng, hub trước).
Trong một đợt có ba làn. Hai task cùng sửa một file **không bao giờ** chạy song song; `claude-office.html` là một file,
nên mọi task [ui] của một đợt chạy nối tiếp. Chỉ task cuối mỗi đợt ([all]) sửa `CHANGELOG.md`.

| Đợt | Làn | Task | Thứ tự |
|---|---|---|---|
| 1 | **[local]** | 1, 2, 3 | 1 → 2 (cùng `lib/status.js`, `server.js`). **3 song song** với 1 và 2 |
| 1 | **[hub]** | 4 | **song song** với mọi task [local] và [ui] |
| 1 | **[ui]** | 5 | **song song** với [local] và [hub] |
| 1 | [all] | 6 | sau 1–5 |
| 2 | **[hub]** | 7, 8 | 7 → 8 (cùng `hub/publish.js`) |
| 2 | **[local]** | 9, 10 | **9 và 10 song song** (khác file); cả hai song song với [hub] và [ui] |
| 2 | **[ui]** | 11, 12 | 11 → 12 |
| 2 | [all] | 13 | sau 7–12 |
| 3 | **[local]** | 14 | **song song** với 15, 16 |
| 3 | **[hub]** | 15 | **song song** với 14, 16 |
| 3 | **[ui]** | 16, 17 | 16 → 17 |
| 3 | [all] | 18 | sau 14–17 |

Làn [ui] không chờ [hub]/[local]: task [ui] kiểm bằng mắt trên **hub giả** và **preview giả** (script Node ở scratchpad,
cổng ngẫu nhiên, không commit) theo đúng các hợp đồng dưới đây, rồi kiểm lại một lần trên dev hub thật ở task cuối đợt.

**Hợp đồng publish** (Task 3 dùng, Task 4 làm ra):

```
POST /api/publish
  Authorization: Bearer <token>
  X-Terrarium-Instance: <16 hex>          // mới; thiếu hoặc sai dạng → instance 'legacy', không bao giờ 400
  body: {v:1, seq, share?, private?, sessions}   // KHÔNG đổi, không khoá mới (hub cũ trả 400 cho khoá lạ)

200 {"accepted":true}
200 {"accepted":false,"reason":"stale_seq","seq":<seq hub đang giữ>}
200 {"accepted":false,"reason":"other_instance"}
204                                       // chỉ hub cũ; publisher mới coi là accepted, hubAck 'legacy'
400 / 413 / 401 / 403 / 429               // như cũ
```

**Hợp đồng luồng xem** (Task 4, 7, 8, 15 làm ra; Task 5, 11, 17 dùng):

```
event: ping        data: {"t": <ms, đồng hồ hub>}                 mỗi 25 s (đợt 1, thay ': ping')
event: restarting  data: {"retryMs": <5000..20000>}  retry: <cùng số>   ngay trước khi hub đóng (đợt 2)
event: world       data: {islands: [{id, name, color, slot, online, private, share,
                                     waking?: true,             // đợt 2: chưa có máy gửi lại sau khi hub khởi động
                                     lastAt: number|null}],     // đợt 3: ms đồng hồ hub
                          viewers, capacity,
                          now: number}                          // đợt 3: đồng hồ hub lúc gửi
```

Trang bỏ qua khoá nó không biết; thiếu `lastAt`/`now`/`waking` thì cư xử như hôm nay.

**Hợp đồng preview local** (Task 14 làm ra, Task 16 dùng): `GET /api/public-preview` →
`{state, share, private, hub, deviceId, instance, lastOkAt, lastAttemptAt, lastErr: {code, at, reason?}|null, failures,
nextRetryAt, hubAck, view: {private, sessions, stale?: true}}`; `GET /api/log` → `{lines: [{at, line}]}`. Server cũ thiếu
trường nào thì trang coi trường đó là `null`; `/api/log` 404 thì ẩn nút "Nhật ký".

## Global Constraints

- Không thêm dependency, không bước build, không có `package.json` mới.
- Hub cần **Node ≥ 22.13**. Server local và publisher vẫn chạy với **Node ≥ 18** (không dùng API mới hơn: `AbortSignal.timeout`
  vẫn phải có nhánh dự phòng như `publisher.js` đang làm).
- `claude-office.html` vẫn là **một file**. Không dùng `innerHTML`.
- Mọi chữ mới trên giao diện đi qua `tr()` và có đủ **7 ngôn ngữ** (vi, en, ja, ko, zh, es, th) trong
  `<script id="i18n-strings">`, cùng tham số `{…}`; `tests/i18n.test.mjs` bắt lỗi thiếu khoá hay lệch tham số. Chữ trên
  giao diện viết tiếng Việt ở bản `vi`; comment trong code viết tiếng Anh.
- Trang local (cổng 4317) phải **giống từng pixel** như trước, trừ chỗ một task nói rõ là đổi (Task 16: mục Thế giới
  trong ⚙ và chip khi trạng thái không bình thường). Mỗi task [ui] chụp ảnh trang local trước/sau với fixture cố định.
- Test và mọi lần chạy thử **không đụng cổng 4317 và `~/.claude-terrarium`**: cổng ngẫu nhiên, `PORT=<khác>`, `HOME` tạm
  (registry `~/.claude/sessions` và cấu hình cùng nằm dưới `HOME`), `CLAUDE_DIR` tạm, `dir` tạm cho config.
- **Không bao giờ kill tiến trình theo tên** (`pkill`, `killall`, `kill $(pgrep …)`). Chỉ dừng tiến trình con qua PID từ
  chính handle `spawn` của script.
- **Tương thích hai chiều trong lúc nâng cấp** (spec §9), vì hub production `https://terrarium.openlabs.click` (sau
  Cloudflare) và publisher trên máy mọi người lên bản mới vào lúc khác nhau:
  - Publisher cũ → hub mới: hub trả `200 {accepted…}` thay vì 204; publisher cũ đã coi 200 như 204 (`publisher.js:72`)
    nên không tệ hơn hôm nay. Không bao giờ trả 409 hay mã mới nào cho publish. Thiếu header instance → `legacy`.
  - Publisher mới → hub cũ: thân gói không đổi, **không khoá mới** (validate của hub cũ trả 400 cho khoá lạ); 204 = nhận;
    header instance bị bỏ qua.
  - Trang cũ → hub mới: `event: ping`, `event: restarting` và khoá mới trong `world` bị bỏ qua; `retry:` khi hub đóng
    vẫn có tác dụng.
  - Trang mới → tiến trình hub cũ (hub đọc lại `claude-office.html` khi file đổi, trước khi tiến trình khởi động lại):
    canh gác luồng chỉ bật sau `ping` có tên đầu tiên; thiếu `lastAt`/`now`/`waking` thì vẽ như hôm nay.
  - Trang local mới → server local cũ: trường preview thiếu là `null`, `/api/log` 404 thì ẩn nút.
- Không bump version, không sửa `.claude-plugin/plugin.json`. CHANGELOG ghi vào `## [Unreleased]`, chỉ ở task cuối mỗi
  đợt (Task 6, 13, 18).
- `server.js` local không có endpoint ghi mới; `/api/log` chỉ GET, qua cùng kiểm `Host` như mọi route.
- Không log token, đường dẫn, tên project hay câu lệnh (S4, S17).
- Test chạy bằng `node --test tests/*.test.mjs`, luôn xanh sau mỗi task (đầu kế hoạch: **486 test**).
- Đồng bộ với `origin/main` (công cụ `sync_with_base_branch`) **trước mỗi task [ui] và mỗi task [all]**.
- Hằng số theo spec §10. Đổi hằng số thì sửa spec cùng commit.

## Review Focus

1. **Laptop ngủ rồi tỉnh.** Máy ngủ 20 phút trong lúc đã ghép máy và đang mở trang thế giới.
   - Publisher: tick đầu tiên sau khi tỉnh thấy khoảng cách > 10 s, quên lùi và gửi ngay; đảo online lại trong vài giây,
     không phải ~70 s. Test ở Task 10 (`a clock jump (sleep) resends at once and forgets the backoff`).
   - Server local: pid của các session vẫn sống; registry đọc lỗi tạm thời không biến mọi transcript thành ma. Test ở
     Task 2 (`a failed read keeps the last good list`).
   - Trang: không rơi vào "Không liên lạc được hub" vĩnh viễn; thấy đồng hồ nhảy hay sự kiện `online` là kết nối lại
     ngay; cảnh được giữ và làm mờ trong lúc chờ. Test ở Task 11 (`hub down: … online or wake connects at once`); kiểm
     bằng Chrome offline 60 s ở Task 11 và bằng `SIGSTOP`/`SIGCONT` theo PID ở Task 13.
2. **Deploy hub khi 300 người đang xem.** Mỗi luồng nhận `restarting` với `retryMs` khác nhau trong 5–20 s, rồi đóng;
   trang mới chờ đúng chừng đó, trang cũ theo `retry:`; không ai vào màn "Hub từ chối" hay "Không liên lạc được";
   sự kiện `world` trong lúc 300 người quay lại tối đa một lần mỗi giây; đảo chưa gửi lại hiện "đang chờ máy gửi lại"
   chứ không "offline". Test ở Task 7 (`closing the hub tells every viewer to come back after 5-20 s`), Task 8
   (`viewers reconnecting cause at most one world broadcast per second`, `islands not heard from since the hub started
   are waking for 90 s`), Task 11 (`a restart event waits exactly the hub's retryMs`, `a 502 during a restart is not
   refused`); chạy thật 300 luồng ở Task 13.
3. **Hai publisher trên một máy** (hai server khác cổng, chung `~/.claude-terrarium`). Tiến trình khởi động sau thắng
   (seq 0), tiến trình kia `standby`, không giành lại, không có gói nào bị coi là đã gửi trong khi hub bỏ nó; tiến trình
   đang giữ chết thì sau ≤ 90 s + 30 s tiến trình chờ tự nhận; chữ phòng giống nhau ở cả hai (dùng chung `rooms.json`),
   nên lúc đổi chủ phòng không đổi tên. Test ở Task 3 (`other_instance stands by and retries after 30 s`), Task 4 (`a
   second instance is refused while the first one is fresh, and takes over with seq 0 or after 90 s of silence`), Task 10
   (`two processes share the rooms file`); chạy thật ở Task 6 Step 2c.
4. **Publisher cũ với hub mới, publisher mới với hub cũ.** Bản cũ lấy từ worktree tạm ở commit `08f6c10`. Hub mới +
   publisher cũ: ghép, gửi, đảo online, không lỗi; hai publisher cũ: như hôm nay. Hub cũ + publisher mới: 204 được coi là
   nhận (`hubAck: 'legacy'`), không 400 nào (thân gói không có khoá mới). Test ở Task 3 (`every publish carries the
   instance header; the body keys are unchanged`, `204 from an older hub counts as accepted`), Task 4 (`a publisher
   without the instance header is one legacy instance`, `a malformed instance header is ignored, not rejected`); chạy
   thật ở Task 6 Step 2a–2b (và lặp lại ở Task 13, 18 với tính năng của đợt đó).
5. **Session chế độ auto chạy một Bash dài.** `permissionMode: 'auto'`, Bash treo 9 phút: nhân viên `working`, tool
   Bash, không bao giờ `permission`; Bash đó bị từ chối bởi bộ phân loại (tool_result `is_error`): không bao giờ `error`.
   Ở chế độ `default`, đoán `permission` sau 8 s vẫn như cũ. Sau 11 phút không có kết quả và file không lớn thêm, tool
   treo hết hạn. Test ở Task 1 (`auto mode never infers permission: a long Bash stays working`, `a tool error never sets
   error`), Task 9 (`a Bash pending for 12 min without file growth no longer counts`).
6. **Sub-agent chạy nền vẫn làm sau khi session cha hết lượt.** Cha `end_turn` (registry `idle`), sub vẫn ghi
   transcript: cha `done`/`idle`, sub `working`/`thinking` theo transcript của chính nó, đứng cạnh bàn cha; sub nộp kết
   quả thì `done` 30 s rồi đi; cha bị ngắt thì sub `done`. Trên trang, sub `done` đi trong khoảng 3–4 s kể cả không có sự
   kiện mới. Test ở Task 2 (`a background sub-agent keeps working after its parent ends its turn`, `interrupting the
   parent ends its sub-agents`); kiểm bằng mắt ở Task 12 Step 3.
7. **Đảo offline rồi online lại.** Hub gửi `sessions: []` (đảo offline hay riêng tư), nhân viên đi ra; vài giây sau hub
   gửi lại cùng các sid: nhân viên vào lại, số người trên đảo khớp nhãn "N đang làm", không cần tải lại trang. Test ở Task
   5 (`goneStep: an island that went offline and came back shows its agents again`); kiểm bằng mắt ở Task 5 Step 3.

---

## Đợt 1: đúng dữ liệu

### Task 1 [local]: `lib/status.js`: trạng thái session thành hàm thuần; lỗi tool không phải `error`, không đoán `permission` khi chế độ không hỏi (L-a, L-b)

Làn [local]. Chạy song song với Task 3, 4, 5. Task 2 chờ task này.

**Files:**
- Create: `lib/status.js`, `tests/status.test.mjs`, `tests/fixtures/transcripts/` (transcript mẫu viết tay, mỗi file vài
  dòng JSONL, timestamp cố định từ `2026-11-06T00:00:00Z`)
- Modify: `server.js` (bỏ `ingest`, `brief`, `projectOf`, `parentFromPath`, `TRANSCRIPT_RE`, `FINISH_TOOLS`, `PERM_TOOLS`
  và nhánh quyết định trạng thái; import từ `lib/status.js`)

**Interfaces:**
- Produces (`lib/status.js`, `module.exports`):
  - Hằng: `TRANSCRIPT_RE`, `PERM_TOOLS`, `FINISH_TOOLS` (chuyển nguyên từ `server.js`), `ERROR_MS = 30000`,
    `NO_PROMPT_MODES = new Set(['auto', 'bypassPermissions'])`, `EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit',
    'NotebookEdit'])`.
  - `newState(file, mtimeMs) => St`: `{offset: 0, rest: '', tokens: 0, pending: new Map(), recent: [], file, fileMtime,
    lastTs: 0, last: null, stop: null, permMode: null, apiErrorAt: 0, apiErrText: '', interruptedAt: 0}`.
  - `ingest(st, entry, isIncremental, now = Date.now())`: như `server.js:80-115` hôm nay, trừ:
    - `tool_result` có `is_error`: **chỉ** thêm `recent` `'Lỗi · ' + text` (60 ký tự); không đặt trường lỗi nào.
    - `entry.type === 'assistant' && entry.isApiErrorMessage === true`: `st.apiErrorAt = t`, `st.apiErrText` = text đầu
      tiên (60 ký tự, mặc định `'API error'`), `st.last = 'api_error'`; không tính token, không thêm `pending`.
    - `typeof entry.permissionMode === 'string'` (entry `user` và entry `type: 'permission-mode'`) → `st.permMode`.
    - `[Request interrupted…` → thêm `st.interruptedAt = t`.
  - `brief`, `projectOf`, `parentFromPath`: chuyển nguyên.
  - `promptable(mode, tool) => boolean`: `PERM_TOOLS.has(tool)` và: `NO_PROMPT_MODES.has(mode)` → `false`;
    `mode === 'acceptEdits'` → `!EDIT_TOOLS.has(tool)`; còn lại → `true`.
  - `modeOf(st, parentSt) => string|null`: `st.permMode ?? parentSt?.permMode ?? null`.
  - `sessionStatus(st, {now, permMs, mode, regStatus}) => {status, tool, detail, talkingTo}`: nhánh `server.js:176-186`
    và `192-196`, với:
    - tool treo: `Task`/`Agent` → `waiting`; `SendMessage` → `talking`; `promptable(mode, tool) && now - pend.t > permMs`
      → `permission`; còn lại `working`;
    - không tool treo, `st.last === 'api_error'` và (`now - st.apiErrorAt < ERROR_MS` hoặc `regStatus === 'idle'`) →
      `error`, `detail = st.apiErrText`;
    - còn lại như cũ (`thinking` / `done` / `idle`), rồi luật registry (`regStatus` `idle`/`busy`) như `server.js:192-196`.
  - Comment đầu file: vì sao lỗi tool không phải lỗi session; giới hạn đã biết của `default` (Bash đã duyệt chạy lâu vẫn
    bị đoán `permission`).
- `server.js`: `snapshot()` gọi `sessionStatus` với `mode = modeOf(st, parentSt)` (`parentSt` tìm theo `sessionId` của
  cha trong `files`); `module.exports` của `server.js` không đổi.

- [ ] **Step 1: Ghi kết quả của code cũ.** Trước khi sửa, chạy `snapshot()` hiện tại trên `tests/fixtures/transcripts/mixed/`
  (một session có Read, Edit, SendMessage, prompt, end_turn; không lỗi, không chế độ) với `CLAUDE_DIR` và `HOME` tạm, ghi
  `tests/fixtures/transcripts/mixed.expected.json` (bỏ `at`, `usage`, `version`).
- [ ] **Step 2: Viết test hỏng** trong `tests/status.test.mjs`. Hàm phụ trong test: `load(name)` đọc từng dòng fixture vào
  `newState` qua `ingest(st, e, false, T0)`; `T0 = Date.parse('2026-11-06T00:00:00Z')`.
  - `ingest keeps the old result for a session without errors or modes`: `mixed` qua `lib/status.js` cho đúng
    `mixed.expected.json` (tokens, recent, pending, status, talkingTo).
  - `a tool error never sets error: an auto-mode denial keeps the agent thinking` (`auto-denied.jsonl`: mode `auto`, Bash
    tool_use, tool_result `is_error` "denied by the auto mode classifier"): tại `T+1s`, `T+10s`, `T+29s` status là
    `thinking`, không bao giờ `error`; `recent[0].text` bắt đầu bằng `Lỗi · `.
  - `an API error shows error for 30 s` (`api-error.jsonl`: assistant `isApiErrorMessage: true`): `T+29s` → `error`,
    `detail` là câu lỗi; `T+31s` → không phải `error`.
  - `a session that stopped right after an API error stays error while the registry says idle`: `regStatus: 'idle'`,
    `T+5min` → `error`; thêm một entry prompt mới → `thinking`.
  - `auto mode never infers permission: a long Bash stays working` (`auto-long-bash.jsonl`): `T+9min` → `working`, tool
    `Bash`.
  - `bypassPermissions behaves like auto`.
  - `default mode still infers permission after PERM_MS` (`default-bash.jsonl`): `T+7s` → `working`, `T+9s` → `permission`.
  - `acceptEdits: an Edit never waits for permission, a Bash still can`.
  - `the mode follows the newest permissionMode, from user entries and permission-mode entries` (`mode-switch.jsonl`:
    `default` rồi entry `permission-mode` `auto`).
  - `a sub-agent without its own mode uses the parent's`: `modeOf(sub, parent)` = `'auto'`.
  - `promptable covers every mode and tool` (bảng nhỏ: 5 chế độ × Bash/Edit/WebFetch/Read).
- [ ] **Step 3: Chạy, xác nhận hỏng.** `node --test tests/status.test.mjs` → FAIL (module chưa có).
- [ ] **Step 4: Cài đặt** theo Interfaces.
- [ ] **Step 5: Chạy toàn bộ test** `node --test tests/*.test.mjs` → PASS (`tests/server-local.test.mjs` không đổi).
- [ ] **Step 6: Commit** `fix: tool errors and auto mode no longer flip a session to error or permission`

---

### Task 2 [local]: Danh sách session sống nghiêm; sub-agent sống theo transcript của nó; gộp gốc trùng id (L3, L1, gốc của L2)

Sau Task 1 (cùng `lib/status.js`, `server.js`, `tests/status.test.mjs`). Song song với Task 3, 4, 5.

**Files:**
- Modify: `lib/status.js`, `server.js` (`liveSessions`, `snapshot`)
- Test: `tests/status.test.mjs`, `tests/fixtures/transcripts/` (thêm `bg-sub/`, `interrupted-sub/`, `dup-root/`,
  `registry/`)

**Interfaces:**
- Produces (`lib/status.js`):
  - `readRegistryDir(dir) => {ok: true, entries: [{file, json: object|null}]} | {ok: false, code: string}`: chỉ hàm này
    đụng fs; `json` là `null` khi file đọc được mà JSON hỏng (đang ghi dở).
  - `liveFromRegistry(read, {prev = null, alive}) => Map<sessionId, Live> | null`, `Live = {pid, name, status, cwd,
    updatedAt, procStart, file}`:
    - `read.ok === false && read.code === 'ENOENT'` → `null`;
    - `read.ok === false` (mã khác) → `prev`;
    - `read.ok` → `Map` mới, **kể cả rỗng**; entry `json === null` → chép entry của `prev` có cùng `file` (nếu có);
      `pid = +json.pid || parseInt(file)`; bỏ entry `!alive(pid, json.procStart)` hay không có `sessionId`;
      `updatedAt = json.updatedAt || json.statusUpdatedAt || json.startedAt || 0`.
  - `defaultAlive(pid) => boolean`: `process.kill(pid, 0)` hoặc `EPERM` (như hôm nay; Task 9 thêm `procStart`).
  - `subOutcome(st, {now, parentInterruptedAt = 0}) => 'keep'|'done'|'drop'`:
    - không tool treo và (`st.finished` hoặc `st.last === 'assistant' && st.stop === 'end_turn'`) → `now - activity > 30 s`
      ? `'drop'` : `'done'`;
    - `parentInterruptedAt > (st.lastTs || 0)` → `'done'` (cùng luật 30 s);
    - không tool treo và `now - activity > SUB_STALE_MS` → `'drop'`;
    - còn lại `'keep'`.
  - `buildSessions(states: Iterable<St>, live: Map|null, {now, permMs, activeMs}) => Session[]`: toàn bộ thân
    `snapshot()` hiện tại (`server.js:163-236`, trừ `usage`/`version`), với:
    - sub-agent dùng `subOutcome` (cha bị ngắt lấy từ `interruptedAt` của state cha);
    - **bỏ** khối `server.js:224-230` (cha `idle`/`done` → con `done`);
    - gốc trùng `id` (hai transcript cùng `sessionId`): giữ cái có `lastTs` (rồi `fileMtime`) mới nhất, bỏ cái kia trước
      mọi bước sau;
    - gốc chỉ có trong registry: như hôm nay (`updatedAt: now`; Task 9 sửa).
  - `Session` giữ đúng các khoá hôm nay: `id, parentId, name, project, cwd, model, tokens, status, tool, detail, talkingTo,
    recent, updatedAt`, có thể thêm `waitingOn`.
- `server.js`: `liveSessions()` = `liveFromRegistry(readRegistryDir(SESSIONS_DIR), {prev: liveCache, alive: defaultAlive})`
  với cache 2 s như cũ; `snapshot()` = `{at, sessions: buildSessions(files.values(), liveSessions(), …), usage, version}`.

- [ ] **Step 1: Viết test hỏng** trong `tests/status.test.mjs`:
  - `an empty registry means no session, not every transcript of the last 2 hours` (L3): `read = {ok: true, entries: []}`
    → `Map` size 0; `buildSessions` với 3 transcript mới → `[]`.
  - `no registry directory falls back to time filtering`: `{ok: false, code: 'ENOENT'}` → `null`; 3 transcript hiện ra.
  - `a failed read keeps the last good list`: `{ok: false, code: 'EMFILE'}` với `prev` có 2 session → trả đúng `prev`.
  - `a registry file caught mid-write keeps its previous entry`.
  - `a dead pid is not live` (`alive` giả trả `false`).
  - `readRegistryDir reads a temp directory` (`fs.mkdtempSync`, một file hỏng, một file tốt, thư mục không tồn tại →
    `ENOENT`).
  - `a background sub-agent keeps working after its parent ends its turn` (L1, `bg-sub/`): cha `end_turn` lúc `T`,
    registry cha `idle`; sub có `tool_use` Read lúc `T+20s` → tại `T+25s` cha `done`, sub `working` tool `Read`; sub có
    `tool_result` lúc `T+40s` → tại `T+45s` sub `thinking`; cha không thành `waiting`.
  - `a sub-agent that hands back is done for 30 s, then gone` (`SubagentHandback`).
  - `interrupting the parent ends its sub-agents` (`interrupted-sub/`): cha ngắt sau hoạt động cuối của sub → sub `done`,
    30 s sau không còn.
  - `two transcripts with one sessionId give one root` (`dup-root/`): một gốc, là cái mới hơn; sub của nó vẫn gắn đúng.
  - `snapshot keeps its shape`: khoá của mỗi `Session` đúng danh sách ở Interfaces.
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/status.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces. Comment ở `liveFromRegistry` nói rõ ba nhánh (`ENOENT`, lỗi khác, rỗng).
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Kiểm tay** (không đụng 4317): `HOME=$(mktemp -d) CLAUDE_DIR=<fixtures tạm> PORT=4399 node server.js`,
  `curl -s localhost:4399/snapshot`: registry rỗng → `sessions: []`; xoá thư mục registry → transcript hiện lại. Dừng
  server bằng PID của chính nó.
- [ ] **Step 6: Commit** `fix: strict live-session list and sub-agents judged by their own transcript`

---

### Task 3 [local]: Publisher đọc trả lời của hub, không coi gói bị từ chối là đã gửi, đứng chờ khi máy có hai bản (L2, H4 phía máy, L12)

Làn [local]. **Song song** với Task 1, 2 (khác file), 4, 5.

**Files:**
- Modify: `lib/publisher.js`, `lib/public-view.js`
- Test: `tests/publisher.test.mjs`, `tests/public-view.test.mjs`

**Interfaces:**
- Consumes: hợp đồng publish (đầu plan).
- Produces (`lib/publisher.js`):
  - `startPublisher({…, instanceId})`: `instanceId` mặc định `crypto.randomBytes(8).toString('hex')`; mọi POST
    `/api/publish` có header `x-terrarium-instance: <instanceId>`. Thân gói **giữ nguyên** `{v: 1, seq, share,
    sessions}` + `private` khi riêng tư.
  - Hằng: `REJECT_WAIT_MS = 15000`, `STALE_RESEND_MS = 10000`.
  - `readAck(res) => Promise<{accepted: boolean, reason?: string, seq?: number, legacy?: true}>`: 204 → `{accepted: true,
    legacy: true}`; 200 JSON có `accepted` boolean → như nhận được; 200 khác → `{accepted: true}`.
  - Xử lý trả lời trong `send`:
    - `accepted` → như hôm nay (`failures = 0`, `seq++`, `lastKey`, `lastSentAt`, `sending`/`private`).
    - `stale_seq` với `Number.isSafeInteger(seq)` → `seq = ack.seq + 1`, `lastKey = null`; gửi lại ở tick sau nếu lần
      nhảy seq trước đó cách ≥ `STALE_RESEND_MS`, không thì `waitUntil = now + STALE_RESEND_MS`.
    - `other_instance` → `setState('standby', 'terrarium: another Claude Office on this machine is publishing for this
      device; standing by')`, `waitUntil = now + HEARTBEAT_MS`, `lastKey = null`, seq giữ.
    - 400/413 → **không** đặt `lastKey`/`lastSentAt`; `failures++`; `waitUntil = now + REJECT_WAIT_MS`;
      `setState('offline')` và log **mỗi lần** `terrarium: hub rejected the packet (<st>: <lý do>)`, lý do = 80 ký tự đầu
      của thân text qua `clean`, bỏ tiền tố `bad packet: `.
- Produces (`lib/public-view.js`): sau khi băm, id trùng chỉ giữ lần xuất hiện đầu theo thứ tự xếp hạng hiện có (gốc
  trước, mới trước); `waitingOn`/`talkingTo`/`parent` trỏ tới id đã bỏ vẫn hợp lệ vì cùng giá trị băm.

- [ ] **Step 1: Viết test hỏng**
  - `tests/publisher.test.mjs` (fetch giả ghi lại header và body):
    - `every publish carries the instance header; the body keys are unchanged`: header `x-terrarium-instance` là 16 hex,
      giống nhau qua mọi lần gửi của một publisher, khác giữa hai publisher; `Object.keys(body)` ⊆ `['v', 'seq', 'share',
      'private', 'sessions']`.
    - `204 from an older hub counts as accepted`.
    - `200 {accepted:true} counts as accepted; seq goes up`.
    - `200 {accepted:false, reason:'stale_seq', seq:41} resumes at 42`: lần gửi kế tiếp có `seq: 42`; một `stale_seq`
      nữa trong 10 s không gửi dồn.
    - `200 {accepted:false, reason:'other_instance'} stands by and retries after 30 s`: `state().state === 'standby'`; không
      gửi gì trong 29.9 s; gửi lại ở 30 s; khi hub nhận lại → `sending`.
    - `a 400 is not a success: offline, logged with the reason, retried after 15 s, seq unchanged`: log có `(400: duplicate
      id)`; không gửi lại trước 15 s; seq lần gửi lại bằng seq lần bị từ chối; view không đổi vẫn gửi lại (không bị chặn
      bởi `lastKey`).
    - `a 413 is handled like a 400`.
    - Sửa test cũ có nhắc 400 (nếu có) theo hành vi mới.
  - `tests/public-view.test.mjs`: `duplicate session ids leave the machine once`: hai session cùng `id` → một phần tử,
    là cái gốc mới hơn.
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/publisher.test.mjs tests/public-view.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces. Comment đầu `publisher.js` mô tả hợp đồng trả lời và vì sao thân gói không
  được thêm khoá.
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Commit** `fix: the publisher reads the hub's publish reply and never treats a rejected packet as sent`

---

### Task 4 [hub]: Trả lời publish trung thực, một instance giữ mỗi máy, ping có tên (H4, L12 phía hub, H10)

Làn [hub]. **Song song** với Task 1, 2, 3, 5.

**Files:**
- Modify: `hub/world.js`, `hub/publish.js`, `hub/server.js` (một dòng: `ctx.pingMs`)
- Test: `tests/hub-world.test.mjs`

**Interfaces:**
- Produces (`hub/world.js`):
  - `publish(island, deviceId, share, value, {instance = null} = {}) => {accepted: true} | {accepted: false, reason:
    'stale_seq', seq: number} | {accepted: false, reason: 'other_instance'}`:
    - `key = instance || 'legacy'`; `dev = islands.get(island.id)?.devices.get(deviceId)`;
    - `dev && dev.instance !== key`: nhận (đổi chủ) khi `value.seq === 0` hoặc `now() - dev.lastAt >= OFFLINE_MS`; ngược
      lại trả `other_instance`, không đổi gì;
    - `dev && dev.instance === key && value.seq < dev.seq && value.seq !== 0` → `{accepted: false, reason: 'stale_seq',
      seq: dev.seq}`;
    - bản ghi máy thêm `instance: key`. Comment đầu file cập nhật chữ ký.
- Produces (`hub/publish.js`):
  - `INSTANCE_RE = /^[0-9a-f]{16}$/`; header `x-terrarium-instance` không khớp → `null` (không 400).
  - `POST /api/publish` trả `sendJson(res, 200, result)` cho mọi kết quả của `world.publish`.
  - `ctx.pingMs` (mặc định `PING_MS`, test truyền qua `deps.pingMs` của `createHub`); timer ping ghi
    `event: ping\ndata: {"t":<deps.now()>}\n\n`.
  - Comment đầu file: thêm `ping`, câu trả lời publish.
- `hub/server.js`: `ctx.pingMs = deps.pingMs` (một dòng). File này Task 7 cũng sửa, nhưng ở đợt 2.

- [ ] **Step 1: Viết test hỏng** trong `tests/hub-world.test.mjs`:
  - Sửa `publish 204, 400 on bad schema, island id in the body is ignored (400)` thành `publish 200 {accepted:true}, 400
    on bad schema, …`.
  - `a stale seq is answered accepted:false with the hub's seq` (H4): seq 5, rồi seq 3 → `200 {accepted:false,
    reason:'stale_seq', seq:5}`; luồng không nhận `island` mới.
  - `seq 0 after a higher seq is accepted as a restart` (test cũ ở mức world): thêm kiểm giá trị trả về.
  - `a second instance is refused while the first one is fresh, and takes over with seq 0 or after 90 s of silence`:
    instance A seq 0..3 nhận; instance B seq 7 → `other_instance`; B seq 0 → nhận, A seq 4 → `other_instance`;
    `clock.advance(90_000)`, A seq 5 → nhận.
  - `a publisher without the instance header is one legacy instance`: hai gói không header với seq tăng → nhận; một gói có
    header seq 9 → `other_instance`.
  - `a malformed instance header is ignored, not rejected`: `x-terrarium-instance: ZZZ` → 200 `accepted:true`.
  - `the stream sends a named ping event`: `createHub` với `deps.pingMs = 50` → trong 200 ms nhận ≥ 2 khối
    `event: ping` có `data` là JSON có `t`; không còn dòng `: ping`.
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/hub-world.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces.
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Commit** `fix: honest publish replies, one publishing instance per device, and a named ping`

---

### Task 5 [ui]: Nhân viên quay lại khi đảo quay lại; canh gác luồng; nhãn `standby` (V1, V2)

Làn [ui]. Trước task: đồng bộ với `origin/main`. **Song song** với Task 1–4.

**Files:**
- Modify: `claude-office.html` (khối `world-logic`, `i18n-strings`; component chính: `syncLive`, `leave`, `frame`,
  `worldChip`; khối `island-scene`: `frame`; khối `world-view`: mở luồng)
- Test: `tests/world-logic.test.mjs`; hub giả ở scratchpad

**Interfaces:**
- Produces (`WorldLogic`):
  - `PING_STALE_MS = 40000`.
  - `streamStale({pingSeen, lastEventAt, now}) => boolean`: `!!pingSeen && now - lastEventAt >= PING_STALE_MS`.
  - `goneStep(gone: Map<sid, 'done'|'missing'>, listed: Set<sid>) => {skip: Set<sid>, gone: Map}`: mục `'missing'` bị
    bỏ khỏi `gone` và không bao giờ vào `skip`; mục `'done'` vào `skip` khi có trong `listed`, bị bỏ khi không có.
- Component (`ClaudeOffice.prototype`, mượn bởi `IslandScene`):
  - `goneSids` thành `Map` (khởi tạo ở cả hai nơi đang có `new Set()`).
  - `leave(a, why = 'missing')` đặt `a.leftWhy = why`; nhánh sub `done` trong `syncLive` gọi `this.leave(a, 'done')`.
  - `frame` và `IslandScene.frame`: `goneSids.set(a.sid, a.leftWhy || 'missing')`.
  - `syncLive`: đầu hàm `const {skip, gone} = WorldLogic.goneStep(this.goneSids, new Set(list.map(s => s.id)))`; bỏ qua
    sid trong `skip`; một agent `leaving` với `leftWhy === 'missing'` mà sid có lại trong danh sách → `leaving = false`,
    `goalKey = null` (quay lại bàn). Cuối hàm `this.goneSids = gone`.
- `world-view`:
  - Tách phần mở `EventSource` của `startWorld` thành `openWorldStream(w)` (cùng các listener).
  - Mọi listener (`world`, `island`, `remove`, `ping`) đặt `w.lastEventAt = performance.now()`; `ping` đặt
    `w.pingSeen = true`.
  - `w.watch = setInterval(…, 5000)`: `WorldLogic.streamStale(...)` → `w.es.close()`, `w.conn = 'error'`, `w.errAt =
    performance.now()`, `openWorldStream(w)`. Cảnh giữ nguyên. Dọn interval ở mọi chỗ đang dọn `meTimer`.
- Chip local: thêm `standby: [tr('world.chip.standby'), '#8b8fa3']`. Khoá i18n mới (7 ngôn ngữ): `world.chip.standby`
  (vi: "bản khác trên máy này đang gửi").

- [ ] **Step 1: Viết test hỏng** trong `tests/world-logic.test.mjs`:
  - `streamStale is never true before the first named ping`: `pingSeen: false`, 10 phút im → `false`.
  - `streamStale after 40 s without any event`: 39 999 ms → `false`; 40 000 → `true`.
  - `goneStep: an island that went offline and came back shows its agents again`: `gone` = {a: missing, b: missing},
    `listed` = {a, b} → `skip` rỗng, `gone` rỗng.
  - `goneStep: a finished sub-agent stays gone while still listed`: {s: done}, listed {s} → `skip` = {s}, `gone` giữ s.
  - `goneStep forgets done sids once they leave the list`.
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/world-logic.test.mjs` → FAIL.
- [ ] **Step 3: Ảnh chụp local trước khi sửa** (server local `PORT=4399`, `HOME` tạm, fixture cố định) → `before.png`.
- [ ] **Step 4: Cài đặt** theo Interfaces. Thêm khoá i18n vào cả 7 bảng.
- [ ] **Step 5: Kiểm bằng mắt trên hub giả** (Chrome headless, 1280×800):
  - đảo 3 session → hub giả gửi `island {sessions: []}` → nhân viên đi ra → 20 s sau gửi lại cùng 3 sid → 3 nhân viên
    vào lại, nhãn "3 đang làm" khớp số người trên đảo; làm lại khi nhân viên còn đang đi giữa đường (gửi lại sau 1 s):
    họ quay lại bàn;
  - sub `done` vẫn đi và không quay lại trong lúc hub còn liệt kê nó;
  - hub giả ngừng ghi nhưng giữ socket: trong 40–45 s chip đổi sang "Mất kết nối, đang thử lại", rồi xanh lại khi luồng
    mới mở; cảnh không bị xoá;
  - hub giả chỉ gửi `: ping` (như hub cũ), im 3 phút: chip vẫn xanh (canh gác chưa bật);
  - console không lỗi.
- [ ] **Step 6: Ảnh chụp local sau khi sửa** → `after.png`. Expected: khác biệt bằng 0.
- [ ] **Step 7: Chạy toàn bộ test** → PASS (gồm `tests/i18n.test.mjs`).
- [ ] **Step 8: Commit** `fix: agents come back when an island returns, and a frozen stream is noticed`

---

### Task 6 [all]: Kiểm chéo phiên bản, tài liệu, CHANGELOG (đợt 1)

Trước task: đồng bộ với `origin/main`. Sau Task 1–5.

**Files:**
- Modify: `CHANGELOG.md` (`## [Unreleased]`), `docs/hub-setup.md` (mục nâng cấp: câu trả lời publish, thứ tự deploy)

- [ ] **Step 1: Dựng bản cũ.** `git worktree add <scratchpad>/old 08f6c10` (không dùng `git stash`). Mọi tiến trình
  chạy với `HOME` tạm riêng, cổng ngẫu nhiên; ghi lại PID từ `spawn`.
- [ ] **Step 2: Ma trận.** Expected:
  - a) hub mới + publisher cũ (`node <old>/server.js`, `PORT=4398`): `join` qua dev login, đảo online, mọi publish 200,
    publisher cũ ở `sending`; hai publisher cũ chung `HOME` (`PORT=4398`, `4399`): không lỗi, đảo vẫn hiện;
  - b) hub cũ + publisher mới: publish 204, `state` `sending`, không 400 nào trong log hub;
  - c) hub mới + hai publisher mới chung `HOME`: tiến trình chạy sau `sending`, tiến trình kia `standby`; dừng tiến trình
    đang gửi bằng **PID của nó** → sau ≤ 120 s tiến trình còn lại `sending`;
  - d) hub mới + trang mới: chip xanh, có `event: ping` trong luồng (DevTools); thay file `claude-office.html` của hub cũ
    bằng bản mới (hub cũ đọc lại file) → chip vẫn xanh sau 3 phút;
  - e) server local mới với `HOME` tạm và registry giả: session `auto` có Bash treo 2 phút hiện `working`; sub chạy nền
    sau khi cha `end_turn` hiện `working`.
- [ ] **Step 3: Tài liệu.**
  - `docs/hub-setup.md`: `/api/publish` trả `200 {accepted, reason?}`; ping có tên; deploy hub trước rồi tới plugin,
    không cần làm cùng lúc.
  - `CHANGELOG.md` `[Unreleased]` → Fixed: lỗi tool không còn làm nhân viên đỏ; không còn "chờ duyệt" giả ở chế độ
    auto; sub-agent chạy nền không bị báo xong; registry rỗng không còn sinh ma; gói bị hub từ chối được báo và gửi lại;
    hub nói thật khi bỏ gói; hai Claude Office trên một máy không giành nhau; nhân viên quay lại khi đảo online lại; luồng
    treo được phát hiện.
- [ ] **Step 4: Chạy toàn bộ test** → PASS. Gỡ worktree tạm (`git worktree remove`).
- [ ] **Step 5: Commit** `docs: connection hardening wave 1 — changelog, publish reply and rollout notes`

---

## Đợt 2: chịu lỗi

### Task 7 [hub]: Khởi động lại êm, giới hạn luồng có `Retry-After`, IP sau Cloudflare (H1, H7, H9)

Làn [hub]. Task 8 chờ task này. **Song song** với Task 9, 10, 11, 12.

**Files:**
- Modify: `hub/publish.js`, `hub/server.js`, `hub/http.js`, `hub/config.js`, `docs/hub-setup.md` (bảng env, mục proxy)
- Create: `tests/hub-restart.test.mjs`
- Test: `tests/hub-hardening.test.mjs`, `tests/hub-base.test.mjs`

**Interfaces:**
- Produces:
  - `hub/http.js`: `new HttpError(status, message, headers = {})`; `fail` trong `createRouter` gửi kèm `e.headers`.
  - `hub/http.js`: `clientIp(req, mode)`, `mode`: `false` | `true` hoặc `'xff'` (như hôm nay) | `'cloudflare'`
    (`cf-connecting-ip` nếu `net.isIP()` khác 0, không thì như `'xff'`).
  - `hub/config.js`: `HUB_TRUST_PROXY` `''` → `false`; `'1'` → `'xff'`; `'cloudflare'` → `'cloudflare'`; giá trị khác →
    lỗi cấu hình `HUB_TRUST_PROXY must be 1 or cloudflare`.
  - `hub/publish.js`:
    - `RESTART_MIN_MS = 5000`, `RESTART_SPREAD_MS = 15000`.
    - closer (đăng ký trong `ctx.closers`): đặt `closing = true`, rồi cho từng luồng
      `r = RESTART_MIN_MS + Math.floor(random() * RESTART_SPREAD_MS)` (`random` = `deps.random || Math.random`), ghi
      `event: restarting\ndata: {"retryMs":r}\nretry: r\n\n`, rồi `end()`. Không phát `world` sau khi `closing`.
    - Luồng đủ 300 → `HttpError(503, 'too many viewers', {'Retry-After': '30'})`; đủ 5 của một người →
      `HttpError(429, 'too many streams', {'Retry-After': '10'})`.
  - `hub/server.js`: `close()` chạy closers **trước** `server.close()` như hôm nay (thứ tự giữ); nhận `deps.random`.

- [ ] **Step 1: Viết test hỏng**
  - `tests/hub-restart.test.mjs`:
    - `closing the hub tells every viewer to come back after 5-20 s`: 20 luồng (4 người × 5), `h.close()` → mỗi luồng nhận
      đúng một khối `event: restarting` có `retryMs` ∈ [5000, 20000) và dòng `retry:` cùng giá trị, rồi kết thúc; các giá
      trị không bằng nhau hết.
    - `no world broadcast while draining`: sau khối `restarting` không còn `event: world` nào.
    - `the retry spread is deterministic with an injected random` (`deps.random = () => 0.5` → 12 500).
  - `tests/hub-hardening.test.mjs`: `the stream caps carry Retry-After`: 503 có `Retry-After: 30`, 429 có `10`
    (sửa hai test cap hiện có để kiểm header).
  - `tests/hub-base.test.mjs`:
    - `HUB_TRUST_PROXY=cloudflare uses CF-Connecting-IP`;
    - `a bad CF-Connecting-IP falls back to X-Forwarded-For`;
    - `HUB_TRUST_PROXY=1 ignores CF-Connecting-IP`;
    - `HUB_TRUST_PROXY=yes is a config error`;
    - `clientIp ignores forwarded headers unless trusted` (test cũ, giữ nguyên với `true`).
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/hub-restart.test.mjs tests/hub-hardening.test.mjs tests/hub-base.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces. `docs/hub-setup.md`: `HUB_TRUST_PROXY=cloudflare` (chỉ khi origin chỉ đi tới
  được qua Cloudflare Tunnel), hub đóng êm khi nhận SIGTERM.
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Commit** `feat: hub restarts tell viewers when to come back; stream caps carry Retry-After; Cloudflare client IP`

---

### Task 8 [hub]: Sự kiện `world` rẻ, đảo "đang chờ máy gửi lại", nhãn phòng ổn định (H3, H11, H2, H5)

Sau Task 7 (cùng `hub/publish.js`). **Song song** với Task 9–12.

**Files:**
- Modify: `hub/publish.js`, `hub/world.js`
- Test: `tests/hub-world.test.mjs`

**Interfaces:**
- Produces (`hub/publish.js`):
  - `WORLD_EVERY_MS = 1000`. `scheduleWorld()`: van có lần gửi đầu và lần gửi cuối (leading + trailing), tối đa một lần
    phát `world` mỗi `WORLD_EVERY_MS`. Khi phát: tính `worldPayload()` và chuỗi frame **một lần**; frame giống hệt frame
    phát lần trước → không phát (H11).
  - Mọi chỗ đang `broadcast('world', worldPayload())` (`onChange`, `endStream`, `res.on('close')`, mở luồng) đi qua
    `scheduleWorld()`.
  - Mở luồng: người mới nhận `world` và mọi `island` **chỉ cho mình**, ngay; rồi `scheduleWorld()` cho số người xem.
  - `ctx.stats = {worldBroadcasts: 0, framesWritten: 0}`; `write()` tăng `framesWritten`, mỗi lần phát `world` tăng
    `worldBroadcasts`. (Đợt 3 thêm số liệu vào đây.)
  - `startedAt = deps.now()` khi dựng routes. Trong `worldPayload`, đảo không có trong RAM và `deps.now() - startedAt <
    OFFLINE_MS` → thêm `waking: true` (vẫn `online: false`). Một timer `unref` ở `startedAt + OFFLINE_MS` gọi
    `scheduleWorld()`; dọn trong closer.
- Produces (`hub/world.js`):
  - Mỗi đảo có `labels: Map<deviceId + '|' + letter, n>` và `nextLabel`. `sessionsOf` cấp nhãn cho cặp chưa có, theo thứ
    tự máy rồi chữ như hôm nay, và **không bao giờ** cấp lại hay đánh lại nhãn khi máy offline. Đảo bị xoá khỏi RAM thì
    nhãn mất theo.
  - Export thêm `OFFLINE_MS` đã có; comment H5 cập nhật.

- [ ] **Step 1: Viết test hỏng** trong `tests/hub-world.test.mjs`:
  - `viewers reconnecting cause at most one world broadcast per second`: một đảo, mở 100 luồng (20 người dev login × 5)
    trong 2 s → `ctx.stats.worldBroadcasts ≤ 4`; mỗi luồng nhận được `world` đầu tiên của chính nó.
  - `a newcomer gets its first world at once, alone`: luồng đang mở không nhận thêm `world` trong 0–999 ms sau khi người
    mới vào; người mới có `world` ngay.
  - `the viewer count still reaches everyone within a second`.
  - `an identical world is not sent twice` (H11): thu hồi máy cuối của một đảo → người xem nhận đúng một `world` cho
    thay đổi đó.
  - `islands not heard from since the hub started are waking for 90 s, then offline`: hub mới trên DB có 2 đảo, một đảo
    publish → đảo kia `waking: true, online: false`; `clock.advance(90_000)` và chờ timer → `world` không còn `waking`.
  - `a device going offline does not relabel the other device's rooms` (H5): máy 1 phòng A, B; máy 2 phòng C; máy 1 im
    90 s → phòng máy 2 vẫn là `C`.
  - `room labels survive a device reconnecting`.
  - Các test hub cũ chờ `world` ngay sau một thay đổi: thêm chờ tối đa 1.1 s nếu cần (ghi rõ trong test).
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/hub-world.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces. Comment đầu `publish.js` mô tả van 1 s và `waking`.
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Commit** `perf: batched world events, waking islands after a restart, stable room labels`

---

### Task 9 [local]: Sống/chết của session: `procStart`, tool treo, gốc chỉ có trong registry (L4, L5, L6)

Làn [local]. **Song song** với Task 10 (khác file) và mọi task [hub]/[ui] của đợt 2.

**Files:**
- Modify: `lib/status.js`
- Test: `tests/status.test.mjs`, `tests/fixtures/transcripts/` (thêm `hung-bash/`, `long-message-sub/`, `many-roots/`)

**Interfaces:**
- Produces (`lib/status.js`):
  - `normStart(s) => string|null`: gộp khoảng trắng, `trim`; chuỗi rỗng → `null`.
  - `makeProcStartOf({execFileSync = require('child_process').execFileSync, platform = process.platform} = {}) =>
    (pid) => string|null`: `win32` → luôn `null`; còn lại `execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)],
    {env: {...process.env, LC_ALL: 'C'}, timeout: 1000, encoding: 'utf8'})` qua `normStart`; lỗi → `null`. Nhớ theo pid
    (một pid chỉ gọi `ps` một lần trong đời của nó; bỏ khỏi bộ nhớ khi pid không còn trong registry).
  - `makeAlive({kill = process.kill, procStartOf}) => (pid, procStart) => boolean`: `kill(pid, 0)` thành công hoặc lỗi
    `EPERM`; và nếu `normStart(procStart)` và `procStartOf(pid)` cùng khác `null` thì phải bằng nhau.
  - `PENDING_STALE_MS = {Bash: 11 * 60e3, other: 15 * 60e3}`; `Agent`/`Task` không hết hạn.
    `pendingLive(entry, {now, fileMtime}) => boolean`: `now - Math.max(entry.t, fileMtime) <= limit`. `sessionStatus` và
    `subOutcome` bỏ qua (và xoá khỏi `st.pending`) tool đã hết hạn.
  - `THINK_STALE_MS = 15 * 60e3`: sub không có tool treo, `st.last` là `'tool_result'` hoặc `'prompt'` → chỉ `'drop'` sau
    `THINK_STALE_MS`; sub im khác giữ `SUB_STALE_MS`.
  - `buildSessions`: gốc chỉ có trong registry lấy `updatedAt` từ `Live.updatedAt` (spec §7.6), không phải `now`.
- `server.js` **không đổi** ở task này: `defaultAlive` trong `lib/status.js` đổi thành
  `makeAlive({procStartOf: makeProcStartOf()})`.

- [ ] **Step 1: Viết test hỏng** trong `tests/status.test.mjs`:
  - `a reused pid with another start time is not a live session` (L4): `kill` giả thành công, `procStartOf` trả
    `'Fri Nov 6 09:00:00 2026'`, registry `'Fri Nov  6 02:55:21 2026'` → không sống.
  - `EPERM with a matching start time is alive` (khác số khoảng trắng vẫn khớp).
  - `no ps (win32 or error): kill(0) alone decides`.
  - `procStartOf runs ps once per pid` (`execFileSync` giả đếm số lần gọi).
  - `a Bash pending for 12 min without file growth no longer counts` (L5a, `hung-bash/`, chế độ `default`): `T+12min` →
    không `permission`, không `working` vì Bash; sub tương ứng → `'drop'` khi im thêm `SUB_STALE_MS`.
  - `a Bash pending for 9 min is still working` (dưới hạn).
  - `an Agent call never expires while its child works`.
  - `a sub-agent writing one long message for 8 min stays` (L5b, `long-message-sub/`): `T+8min` → `'keep'`, status
    `thinking`; `T+16min` → `'drop'`.
  - `registry-only roots keep their real updatedAt and do not push active sessions out of the 16` (L6, `many-roots/`):
    20 gốc chỉ có trong registry (`updatedAt` 1 giờ trước) + 3 session có transcript mới → cả 3 có trong kết quả.
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/status.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces.
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Commit** `fix: pid reuse, hung tools and idle registry sessions no longer distort the office`

---

### Task 10 [local]: Publisher và ghép máy: chữ phòng ổn định, hồi nhanh, "Thoát" không bị ghi đè (L7, L8, L9, L10, L11)

Làn [local]. **Song song** với Task 9 và mọi task [hub]/[ui] của đợt 2.

**Files:**
- Modify: `lib/publisher.js`, `lib/public-view.js`, `server.js` (chỉ `makeJoinFlow`)
- Test: `tests/publisher.test.mjs`, `tests/public-view.test.mjs`, `tests/server-local.test.mjs`

**Interfaces:**
- Produces (`lib/public-view.js`):
  - `createPublicView(saltHex, {letters} = {})`; `letters = {get(key) => string|undefined, assign(key) => string}`; khoá
    = HMAC(salt, `'dept:' + project`) 12 hex. Mặc định: kho trong RAM với đúng hành vi hôm nay (test cũ giữ nguyên).
- Produces (`lib/publisher.js`):
  - `fileLetterStore(dir, {now = Date.now}) => letters`: file `<dir>/rooms.json` (0600, ghi qua file tạm + `rename`),
    dạng `{v: 1, rooms: {<key>: {letter, at}}}`. `get` đọc lại file khi `mtimeMs` đổi và cập nhật `at` (ghi tối đa một
    lần mỗi 60 s mỗi khoá). `assign`: chữ nhỏ nhất trong `A`–`P` chưa dùng; đủ 16 → lấy chữ của khoá có `at` cũ nhất. File
    hỏng → coi như rỗng, ghi lại.
  - `startPublisher` dựng view bằng `createPublicView(cfg.salt, {letters: fileLetterStore(dir)})`.
  - `BACKOFF_MAX = 15000`; `WAKE_GAP_MS = 10000`: đầu `tick`, `now() - lastTickAt > WAKE_GAP_MS` → `failures = 0`,
    `waitUntil = 0`, `lastKey = null`, log `terrarium: woke up; resending`.
  - `LOGIN_WAIT_MS = 60000`.
  - `parseRetryAfter(v, nowMs) => number`: giây nguyên hoặc ngày HTTP (`Date.parse`); kẹp 1–300; không đọc được → 1.
    429 → `waitUntil` theo đó; log `terrarium: the hub asked to slow down (429)` tối đa một lần mỗi 60 s.
  - `join`: `JOIN_FETCH_MS = 15000`; mọi `post` có `signal` timeout (cùng nhánh dự phòng `AbortSignal.timeout` như
    `send`). `/api/device/start` hết giờ → `Error('the hub did not answer; try again')`. Lần hỏi token hết giờ → coi như
    `428`, hỏi tiếp. Sau trả lời 200 của `/api/device/token`, **trước** `writeConfig`: `shouldStop()` → không ghi,
    `await revokeSelf(hub, t.token)`, `throw new Error('cancelled')`.
- Produces (`server.js` `makeJoinFlow`):
  - `cur = {phase: 'starting', startedAt: now()}`; `status()` khi `starting` quá 60 s → `{phase: 'error', error:
    'hub_timeout'}` (và tăng `gen` để lần `join` đó không ghi đè được).
  - `leave()` tăng `gen` trước mọi `await` (giữ như hôm nay, thêm test).

- [ ] **Step 1: Viết test hỏng**
  - `tests/public-view.test.mjs`:
    - `room letters come from the letter store`: kho giả → chữ do kho trả.
    - `the default store keeps today's order` (test `the 17th project shares the last room instead of wrapping to A` vẫn
      xanh).
  - `tests/publisher.test.mjs`:
    - `room letters survive a restart of the server` (L7): hai `fileLetterStore` trên cùng thư mục tạm, thấy project
      theo thứ tự ngược nhau → cùng chữ cho cùng project.
    - `two processes share the rooms file`: kho 1 cấp X → kho 2 (đã mở trước đó) thấy X sau khi file đổi.
    - `a full rooms file reuses the oldest letter`.
    - `rooms.json is 0600 and holds no project name`.
    - Sửa `network errors back off up to 60 s and recover; failed send keeps its seq` thành `… up to 15 s …`.
    - `a clock jump (sleep) resends at once and forgets the backoff` (L8): 5 lần lỗi, `now` nhảy 20 phút → tick kế gửi
      ngay.
    - `paused re-checks every 60 s`.
    - `Retry-After as an HTTP date is honoured; garbage means 1 s` (L11); `429 logs once a minute`.
    - `join times out a hung hub instead of waiting forever` (L10): `fetch` giả không bao giờ trả lời
      `/api/device/start` → reject với `/did not answer/` (đồng hồ giả hoặc `JOIN_FETCH_MS` nhỏ qua tuỳ chọn).
    - `a hung token poll keeps polling until the code expires`.
    - `leave during an in-flight token poll: no config is written and the new token is revoked` (L9): `shouldStop` đổi
      thành `true` trong lúc POST token đang chờ → không có `config.json`, `revoke-self` được gọi với token mới, reject
      `/cancelled/`.
  - `tests/server-local.test.mjs`: `makeJoinFlow: a start that never reaches pending turns into an error after 60 s`
    (`now` giả).
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/publisher.test.mjs tests/public-view.test.mjs tests/server-local.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces.
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Commit** `fix: stable room letters, quick recovery after sleep or a hub restart, safe leave during pairing`

---

### Task 11 [ui]: Người xem tự kết nối lại, giữ cảnh, làm mờ (V3, V4, V5; phía trình duyệt của H1, H2)

Làn [ui]. Trước task: đồng bộ với `origin/main`. Task 12 chờ task này. **Song song** với Task 7–10.

**Files:**
- Modify: `claude-office.html` (khối `world-logic`, `world-view`, `i18n-strings`)
- Test: `tests/world-logic.test.mjs`; hub giả ở scratchpad

**Interfaces:**
- Produces (`WorldLogic`):
  - `RECONNECT_STEPS_MS = [1000, 2000, 4000, 8000, 16000, 30000]`, `DOWN_CAP_MS = 60000`, `REFUSED_AFTER = 5`,
    `WAKE_JUMP_MS = 15000`, `KEEP_STALE_MS = 300000`.
  - `reconnectDelay(attempt, rand) => ms`: `RECONNECT_STEPS_MS[min(attempt, 5)] * (0.8 + 0.4 * rand)`.
  - `linkStart() => Link`, `Link = {phase: 'live'|'reconnecting'|'down'|'refused'|'busy', attempt, closes, staleSince}`.
  - `linkStep(link, ev, now, rand) => {link, act: {connectIn: ms|null, probe: boolean, reload: boolean, wipe: boolean}}`,
    `ev`:
    - `{type: 'open'}` → `live`, `attempt = 0`, `closes = 0`, `staleSince = null`;
    - `{type: 'error'}` hoặc `{type: 'closed'}` → `reconnecting` (nếu đang `live`), `staleSince ??= now`, `closes++` khi
      `closed`; `probe: true`, `connectIn = reconnectDelay(attempt++)`;
    - `{type: 'restarting', retryMs}` → `reconnecting`, `connectIn = clamp(retryMs, 1000, 60000)`, `probe: false`;
    - `{type: 'probe', kind}`: `signedout` → `reload: true`; `world` → `connectIn` giữ; nếu `closes >= REFUSED_AFTER` →
      `phase: 'refused'`, `connectIn = DOWN_CAP_MS`; `down` → `phase: 'down'`, `connectIn = min(DOWN_CAP_MS,
      reconnectDelay(attempt))`; `busy` → `phase: 'busy'`, `connectIn = retryS * 1000`;
    - `{type: 'wake'}`, `{type: 'online'}`, `{type: 'visible'}` khi không `live` → `attempt = 0`, `connectIn = 0`;
    - mọi bước: `wipe = phase !== 'live' && staleSince != null && now - staleSince >= KEEP_STALE_MS`.
- `world-view`:
  - `worldEnded`, `worldStopped`, `retryWorld` thay bằng `relink(ev)`: gọi `linkStep`, rồi thực hiện `act` (một timer
    `w.linkTimer`; `probeConfig()` hiện có; `openWorldStream(w)` của Task 5; `location.reload()`; `wipe` → làm như phần
    xoá cảnh của `worldEnded` cũ). `startWorld` mới chỉ chạy khi cấu hình thay đổi (`probe` trả `world` với `me.id` khác).
  - `es.onerror` → `relink({type: es.readyState === EventSource.CLOSED ? 'closed' : 'error'})`; canh gác của Task 5 →
    `relink({type: 'error'})`; `es.addEventListener('restarting', …)` → đóng `es`, `relink({type: 'restarting', retryMs})`.
  - `uiTimer` đo `Date.now()` giữa hai nhịp; nhảy > `WAKE_JUMP_MS` → `relink({type: 'wake'})`. `window` `online` →
    `relink({type: 'online'})`; `visibilitychange` sang `visible` → `relink({type: 'visible'})`.
  - Vẽ: khi `link.phase !== 'live'`, các đảo vẽ với `globalAlpha` nhân 0.55 và một dải trên đầu stage: `reconnecting` →
    "Đang kết nối lại…" (vàng); `down` → "Hub không phản hồi · thử lại sau {s} giây" (đỏ) + nút "Thử lại ngay"
    (`relink({type: 'online'})`). `refused`/`busy` giữ bảng hiện có, thêm "tự thử lại sau {s} giây".
  - Đảo có `waking: true` → nhãn dưới "đang chờ máy gửi lại" thay cho "N đang làm · offline"; vẽ mờ như offline.
  - Khoá i18n mới (7 ngôn ngữ): `world.link.reconnecting`, `world.link.down` (`{s}`), `world.link.retryNow`,
    `world.link.autoRetry` (`{s}`), `world.label.waking`.

- [ ] **Step 1: Viết test hỏng** trong `tests/world-logic.test.mjs`:
  - `a dropped stream reconnects after 1, 2, 4 … 30 s and never wipes before 5 min` (`rand = 0.5`).
  - `a restart event waits exactly the hub's retryMs` (và kẹp 1–60 s).
  - `a 502 during a restart is not refused: the probe says world, so connect again` (V4): `closed` rồi `probe world` →
    `phase` vẫn `reconnecting`, có `connectIn`.
  - `five closes in a row with the hub answering show refused but keep retrying every 60 s`.
  - `hub down: retries back off to 60 s; online or wake connects at once` (V3).
  - `scenes are wiped only after 5 min without a connection` (V5).
  - `signed out reloads`; `busy waits for Retry-After`; `open resets everything`.
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/world-logic.test.mjs` → FAIL.
- [ ] **Step 3: Ảnh chụp local trước khi sửa** → `before.png`.
- [ ] **Step 4: Cài đặt** theo Interfaces.
- [ ] **Step 5: Kiểm bằng mắt trên hub giả** (1280×800 và 390×844, sáng và tối):
  - dừng hub giả bằng **PID** 20 s rồi chạy lại cùng cổng: trong 1 s các đảo mờ, dải vàng "Đang kết nối lại…"; khi hub
    lên lại, đảo sáng lại, không tải lại trang, nhân viên không đi ra rồi vào lại;
  - hub giả gửi `restarting {retryMs: 6000}` rồi đóng: trang kết nối lại sau khoảng 6 s;
  - hub giả trả 502 cho luồng và 200 cho `/api/config` trong 10 s: không hiện "Hub từ chối luồng xem" trước lần đóng thứ 5;
  - Chrome emulate offline 60 s: dải đỏ "Hub không phản hồi", đếm ngược; bật lại online → kết nối trong khoảng 1 s;
  - hub giả gửi `world` có `waking: true`: đảo mờ, nhãn "đang chờ máy gửi lại";
  - console không lỗi.
- [ ] **Step 6: Ảnh chụp local sau khi sửa** → khác biệt bằng 0.
- [ ] **Step 7: Chạy toàn bộ test** → PASS.
- [ ] **Step 8: Commit** `feat: the world view reconnects by itself and keeps the islands while it does`

---

### Task 12 [ui]: Tab ẩn trả bàn ngay và không tốn timer; sub-agent xong thì đi đúng giờ (V6, V11, V12)

Trước task: đồng bộ với `origin/main`. Sau Task 11.

**Files:**
- Modify: `claude-office.html` (component chính: `leave`, `syncLive`, `frame`, `componentDidMount` (`uiTimer`),
  `pollPreview`; khối `island-scene`: `frame`)

**Interfaces:**
- `leave(a, why)`: `document.visibilityState === 'hidden'` → `a.gone = true` ngay (không đi ra cửa), để `freeDeskFor`
  trả bàn ngay và `addAgent` có chỗ cho session mới.
- `uiTimer` (300 ms): khi tab ẩn, chỉ chạy kiểm sub `done` (dưới đây) và kiểm đồng hồ nhảy của Task 11; **không** gọi
  `setState` và không gọi `frame`. Khi `visibilitychange` sang `visible`: gọi `frame` một lần và `setState` một lần.
- `pollPreview`: dừng `previewTimer` khi tab ẩn; khi hiện lại → `tick()` ngay rồi đặt lại interval 5 s.
- V12: `doneSweep(now)` gọi trong `frame` và trong `uiTimer`: agent có `parent`, `status === 'done'`, `doneAt` và
  `now - doneAt > 3000` → `leave(a, 'done')` (bỏ việc chỉ kiểm trong `syncLive`). Áp cho cả trang local và mọi
  `IslandScene`.

- [ ] **Step 1: Ảnh chụp local trước khi sửa** → `before.png`.
- [ ] **Step 2: Cài đặt** theo Interfaces.
- [ ] **Step 3: Kiểm bằng mắt / mạng** (Chrome headless, hub giả và server local `PORT=4399` với `HOME` tạm):
  - tab ẩn 2 phút, trong lúc đó hub giả kết thúc 10 session và mở 10 session mới trên một đảo đầy bàn: hiện lại thấy đủ
    10 người mới ở bàn, không còn ai của 10 người cũ;
  - tab ẩn: `read_network_requests` không có `/api/public-preview` nào trong 60 s; hiện lại → có một request ngay;
  - hub giả gửi một sub `done` rồi im: sub rời bàn trong khoảng 3–4 s;
  - trang local đang hiện: hành vi và hình như cũ.
- [ ] **Step 4: Ảnh chụp local sau khi sửa** → khác biệt bằng 0.
- [ ] **Step 5: Chạy toàn bộ test** → PASS.
- [ ] **Step 6: Commit** `fix: hidden tabs free desks at once and stop polling; finished sub-agents leave on time`

---

### Task 13 [all]: Kiểm đầu cuối đợt 2 (ngủ/tỉnh, deploy với 300 người xem), tài liệu, CHANGELOG

Trước task: đồng bộ với `origin/main`. Sau Task 7–12.

**Files:**
- Modify: `CHANGELOG.md`, `docs/hub-setup.md` (mục vận hành: khởi động lại êm, `waking`), `README.md` (nếu mục "Chia sẻ
  đảo" nói về "Thử lại")

- [ ] **Step 1: Deploy với 300 người xem.** Script ở scratchpad: dev hub là tiến trình con (`node hub/server.js`, cổng
  ngẫu nhiên, DB tạm), 60 người dev login × 5 luồng = 300 luồng (Node `fetch` đọc stream), 3 publisher giả. Gửi SIGTERM
  tới **PID của dev hub**, chạy lại trên cùng cổng và DB sau 2 s. Expected:
  - mỗi luồng nhận `restarting` với `retryMs` trong 5–20 s, phân bố đều (ghi histogram);
  - các client giả kết nối lại theo `retryMs` → cả 300 có lại luồng trong ≤ 25 s;
  - mỗi client nhận ≤ 25 sự kiện `world` trong 30 s sau khi hub lên lại;
  - trong 90 s đầu, đảo chưa gửi lại có `waking: true`; publisher giả gửi lại trong ≤ 30 s.
- [ ] **Step 2: Ngủ/tỉnh.** Server local mới (`PORT=4399`, `HOME` tạm, đã ghép với dev hub): `SIGSTOP` theo **PID** 120 s
  rồi `SIGCONT` → log `terrarium: woke up; resending` và một publish trong ≤ 1 s. Trang thế giới trong Chrome: emulate
  offline 120 s rồi online → kết nối lại trong ≤ 2 s, cảnh không bị xoá.
- [ ] **Step 3: Ma trận phiên bản** (worktree tạm `08f6c10` như Task 6): hub mới + trang cũ (`claude-office.html` của
  `08f6c10`) khi hub khởi động lại: trang cũ thử lại sau `retry:` 5–20 s; hub cũ + publisher mới: `rooms.json` được tạo,
  204 vẫn là nhận.
- [ ] **Step 4: Tài liệu.**
  - `docs/hub-setup.md`: SIGTERM làm gì; người xem quay lại sau 5–20 s; 90 s đầu đảo hiện "đang chờ máy gửi lại";
    `Retry-After` của giới hạn luồng.
  - `CHANGELOG.md` `[Unreleased]`: Changed: deploy hub không còn đẩy người xem vào "Thử lại"; người xem tự kết nối lại và
    giữ cảnh; publisher lùi tối đa 15 s và gửi lại ngay khi máy tỉnh. Fixed: phòng không đổi chữ khi một máy tắt hay khi
    server khởi động lại; "Thoát" trong lúc ghép máy không bị ghi đè; ghép máy không treo khi hub không trả lời; pid bị
    dùng lại không thành ma; tab ẩn không giữ bàn của người đã đi.
- [ ] **Step 5: Chạy toàn bộ test** → PASS. Gỡ worktree tạm.
- [ ] **Step 6: Commit** `docs: connection hardening wave 2 — restart, reconnect and rollout notes`

---

## Đợt 3: nhìn thấy được

### Task 14 [local]: Publisher kể rõ trạng thái, `rejected`, nhật ký vòng, `/api/log`

Làn [local]. **Song song** với Task 15, 16.

**Files:**
- Create: `lib/logbuf.js`, `tests/logbuf.test.mjs`
- Modify: `lib/publisher.js`, `server.js` (`/api/log`, `makePublicPreview`, nối `logbuf`), `hooks/register.ts`
- Test: `tests/publisher.test.mjs`, `tests/server-local.test.mjs`

**Interfaces:**
- Produces (`lib/logbuf.js`): `createLogBuffer({size = 200, now = Date.now, sink = console.log}) => {log(line),
  lines() => [{at, line}]}`; `log` che `/Bearer\s+\S+/g` → `Bearer ***` và `/"token"\s*:\s*"[^"]*"/g` → `"token":"***"`
  trước khi lưu và trước khi gửi ra `sink`.
- Produces (`lib/publisher.js`):
  - `state()` trả đúng hợp đồng preview (đầu plan): thêm `deviceId` (từ config, 16 hex hoặc `null`), `instance`,
    `lastOkAt`, `lastAttemptAt`, `lastErr: {code, at, reason?}|null`, `failures`, `nextRetryAt` (`waitUntil` nếu ở tương
    lai, không thì `null`), `hubAck: 'json'|'legacy'|null`.
  - Trạng thái: `off | connecting | sending | private | offline | rejected | standby | paused | revoked`. `connecting` thay
    nhánh `else if (state === 'off') setState('sending')` (V10). 400/413 → `rejected` (thay `offline` của Task 3),
    `lastErr.code = 'rejected:<lý do ngắn>'`.
  - `lastErr.code`: `network:<e.code>` | `http:<status>` | `rejected:<lý do>` | `stale_seq` | `other_instance` |
    `login_required` | `rate_limited`.
  - Log: mỗi lần đổi trạng thái (kèm mã lỗi); khi đang lỗi, một dòng tóm tắt mỗi 60 s `terrarium: still <state> (<n>
    failures, <code>); next try in <s> s`.
- Produces (`server.js`):
  - `GET /api/log` → `200 {lines}` (`application/json`, `no-store`), sau kiểm `Host`; không CORS mới.
  - `/api/public-preview`: `{...publisher.state(), view}`, `view.stale = true` khi `state` ∈ `offline`, `rejected`,
    `standby`, `paused`.
  - `main()`: một `createLogBuffer()` cho cả tiến trình; publisher dùng `log: buf.log`.
- `hooks/register.ts`: ngoài `stderr`, chuyển dòng `stdout` bắt đầu bằng `terrarium:` vào `$.ui.log(…, {to: 'debug'})`.

- [ ] **Step 1: Viết test hỏng**
  - `tests/logbuf.test.mjs`: `keeps the last 200 lines`, `redacts bearer tokens and token fields`, `passes lines to the
    sink`.
  - `tests/publisher.test.mjs`:
    - `connecting until the first accepted send` (V10).
    - `a 400 is rejected, with the reason, and kept apart from offline`.
    - `lastOkAt, failures, lastErr and nextRetryAt follow the sends` (lỗi mạng → `network:ECONNREFUSED`, rồi 200 →
      `failures` 0, `lastErr` giữ lỗi cuối, `lastOkAt` mới).
    - `hubAck is legacy against a 204 hub and json against a 200 hub`.
    - `a failing publisher logs one summary a minute, not one line per try`.
    - Sửa `a 400 is not a success …` (Task 3) cho trạng thái `rejected`.
  - `tests/server-local.test.mjs`:
    - `GET /api/log returns the ring buffer and never a token`.
    - `/api/log refuses foreign hosts and POST`.
    - `public-preview carries the publisher fields and marks a stale view`.
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/logbuf.test.mjs tests/publisher.test.mjs tests/server-local.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces.
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Commit** `feat: the publisher tells what it is doing: state details, rejected, and a log on the local page`

---

### Task 15 [hub]: `/healthz`, `/metrics`, HEAD, `lastAt` theo đảo và theo máy (H8, V7 và V8 phía hub)

Làn [hub]. **Song song** với Task 14, 16, 17.

**Files:**
- Create: `hub/health.js`, `tests/hub-health.test.mjs`
- Modify: `hub/http.js` (HEAD), `hub/server.js` (thêm `health.js` vào `ROUTE_MODULES`, đếm 429 chung), `hub/config.js`
  (`HUB_METRICS_TOKEN`), `hub/publish.js` (`lastAt`, `now`, số liệu), `hub/world.js` (`lastAt` trong `metaOf`,
  `devicesOf`), `hub/me.js` (`devices[].lastAt`), `docs/hub-setup.md`
- Test: `tests/hub-world.test.mjs`, `tests/hub-me.test.mjs`, `tests/hub-base.test.mjs`

**Interfaces:**
- `hub/http.js` `createRouter`: không có route khớp cho `HEAD` → dùng route `GET` cùng đường dẫn, trừ khi route có
  `head: false` (→ 405, `Allow: GET`). Node tự bỏ thân với `HEAD`.
- `hub/publish.js`: route `/api/world/stream` có `head: false`.
- `hub/config.js`: `metricsToken` = `HUB_METRICS_TOKEN` (trống → `null`; có nhưng < 32 ký tự → lỗi cấu hình).
- `hub/health.js` `routes(ctx)`:
  - `GET /healthz` → `200 {ok: true, uptimeS, db: 'ok', streams, version}`. Phép thử DB là
    `db.islandCount()` (đã có, không sửa `hub/db.js`); nó ném lỗi → `503 {ok: false, db: 'error'}`.
    `no-store`. Đi qua giới hạn chung như mọi route.
  - `GET /metrics`: `metricsToken` null → 404; header không phải `Bearer <metricsToken>` (so sánh `timingSafeEqual`) →
    401; đúng → `200 text/plain; version=0.0.4`:
    ```
    terrarium_uptime_seconds, terrarium_streams, terrarium_islands_slotted, terrarium_islands_online,
    terrarium_publish_total{result="accepted|stale_seq|other_instance|bad_packet|too_large|rate_limited|unauthorized"},
    terrarium_stream_refused_total{reason="hub_cap|user_cap"}, terrarium_http_429_total,
    terrarium_world_broadcasts_total, terrarium_frames_written_total
    ```
- `ctx.stats` (Task 8) thêm `publish: {accepted, stale_seq, …}`, `streamRefused: {hub_cap, user_cap}`, `http429`.
- `hub/world.js`: `metaOf` thêm `lastAt` (lớn nhất trong `lastAt` của các máy, `null` khi không có máy); `devicesOf`
  thêm `lastAt`.
- `hub/publish.js` `worldPayload()`: mỗi đảo `lastAt` (đảo không có trong RAM → `null`), payload thêm `now: deps.now()`.
  Mọi khoá cũ giữ nguyên.
- `hub/me.js` `/api/me`: mỗi máy thêm `lastAt` (RAM, `null` khi không có).

- [ ] **Step 1: Viết test hỏng**
  - `tests/hub-health.test.mjs`:
    - `HEAD / is 200 with no body` (cả khi chưa đăng nhập, trang chào).
    - `HEAD on the stream is 405 and opens no stream` (`ctx.streams.count()` = 0).
    - `/healthz answers ok with uptime and db`.
    - `/healthz is 503 when the database is gone` (đóng DB của hub trong test).
    - `/metrics is 404 without HUB_METRICS_TOKEN, 401 with a wrong token, 200 with the right one`.
    - `metrics count accepted and refused publishes, refused streams and 429s`.
  - `tests/hub-base.test.mjs`: `HUB_METRICS_TOKEN shorter than 32 characters is a config error`.
  - `tests/hub-world.test.mjs`:
    - `world items carry lastAt and the payload carries now`.
    - `the world payload keeps every field it had` (khoá cũ: `id, name, color, slot, online, private, share`; `viewers`,
      `capacity`).
  - `tests/hub-me.test.mjs`: `/api/me devices carry lastAt`.
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/hub-health.test.mjs tests/hub-world.test.mjs tests/hub-me.test.mjs tests/hub-base.test.mjs` → FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces. `docs/hub-setup.md`: `/healthz` cho uptime monitor (GET hoặc HEAD),
  `HUB_METRICS_TOKEN` và danh sách số liệu.
- [ ] **Step 4: Chạy toàn bộ test** → PASS.
- [ ] **Step 5: Commit** `feat: /healthz, /metrics, HEAD, and last-heard times for islands and devices`

---

### Task 16 [ui]: Trang local: viên "Máy này", nhật ký, lỗi ghép máy rõ ràng (V9, V10)

Làn [ui]. Trước task: đồng bộ với `origin/main`. Task 17 chờ task này. **Song song** với Task 14, 15 (kiểm trên preview
giả theo hợp đồng preview).

**Files:**
- Modify: `claude-office.html` (khối `world-logic`, `i18n-strings`; component chính: `pollPreview`, `worldChip`,
  `worldJoinSection`, `joinWorld`, `watchJoin`, `leaveWorld`)
- Test: `tests/world-logic.test.mjs`; preview giả ở scratchpad

**Interfaces:**
- Produces (`WorldLogic`):
  - `pillView(p, nowMs) => {state, tone: 'ok'|'warn'|'bad'|'muted', ageMs: number|null, retryInMs: number|null,
    err: {code, reason}|null, failures: number}`: `sending` → `ok`; `connecting`, `paused`, `standby` → `warn`/`muted`
    theo bảng trong comment; `offline`, `rejected`, `revoked` → `bad`; thiếu trường (server cũ) → `null`, không ném.
- `pollPreview`: giữ `this.state.preview` (bản đầy đủ). Hai lần hỏi lỗi liên tiếp khi đã có chip → `worldChip:
  {state: 'localDown', …}` (chip không biến mất). `joinable` như cũ.
- `worldChip`: thêm `connecting` (vàng), `rejected` (đỏ), `localDown` (xám). Link chip:
  `c.hub + '#this-device=' + deviceId` khi `deviceId` là 16 hex. Trạng thái `sending` bình thường: **giống từng pixel**.
- `worldJoinSection` khi đã tham gia: một dòng "Máy này" (chấm theo `tone` + nhãn trạng thái + "gửi lúc {time} · {ago}"
  hoặc "chưa gửi được lần nào"; khi `bad`/`warn` thêm "lỗi {code} · thử lại sau {s} giây · {n} lần"); nút "Nhật ký" mở
  50 dòng cuối của `/api/log` (chữ đơn cách, chỉ qua React text, không `innerHTML`); `/api/log` 404 → không có nút.
  Phần này **đổi hình** của mục Thế giới trong ⚙ (được phép ở task này).
- V9:
  - `joinWorld`, `watchJoin`, `leaveWorld`: trả lời không 2xx → đọc tối đa 120 ký tự text, lỗi `{phase: 'error', error:
    'local', status, text}`; `worldJoinError` hiện "Server local trả lỗi {status}".
  - `watchJoin` dừng sau 3 lần hỏi lỗi liên tiếp (lỗi `local`); không còn hỏi mãi mỗi 3 s.
  - Dòng xoá lỗi ghép máy (`:6346` cũ) chỉ xoá khi `v.state` là `sending` hoặc `private` và `jp` là `pending` hoặc
    `starting`.
- Khoá i18n mới (7 ngôn ngữ): `world.pill.title`, `world.pill.sentAt` (`{time}`, `{ago}`), `world.pill.never`,
  `world.pill.failing` (`{code}`, `{s}`, `{n}`), `world.pill.log`, `world.pill.logEmpty`, `world.chip.connecting`,
  `world.chip.rejected`, `world.chip.localDown`, `world.join.errLocalStatus` (`{status}`), `world.ago.s`, `world.ago.m`,
  `world.ago.h` (`{n}`), `world.state.<state>` cho 9 trạng thái của pill.

- [ ] **Step 1: Viết test hỏng** trong `tests/world-logic.test.mjs`:
  - `pillView: a healthy publisher is ok with its age`.
  - `pillView: an old server without the new fields still shows its state`.
  - `pillView: rejected is bad and carries the reason`.
  - `pillView: a nextRetryAt in the past reads as retrying now` (`retryInMs` = 0).
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/world-logic.test.mjs` → FAIL.
- [ ] **Step 3: Ảnh chụp local trước khi sửa** (header, trạng thái `sending`) → `before.png`.
- [ ] **Step 4: Cài đặt** theo Interfaces.
- [ ] **Step 5: Kiểm bằng mắt trên preview giả** (server ở scratchpad phục vụ `claude-office.html`, `/events`,
  `/api/public-preview` theo kịch bản, `/api/log`; 1280×800 và 390×844, sáng và tối):
  - từng trạng thái `connecting`, `sending`, `offline`, `rejected`, `standby`, `paused`, `revoked`: màu chip và dòng "Máy
    này" đúng; `rejected` hiện lý do;
  - preview kiểu server cũ (chỉ `state`, không `/api/log`): dòng "Máy này" chỉ có trạng thái, không có nút "Nhật ký",
    console không lỗi;
  - một dòng log chứa `<img src=x onerror=alert(1)>` hiện nguyên văn;
  - dừng preview giả bằng **PID**: sau ~10 s chip ghi "server local không phản hồi", không biến mất; bấm "Tham gia" khi
    server trả 500 → "Server local trả lỗi 500"; `watchJoin` dừng sau 3 lần lỗi.
- [ ] **Step 6: Ảnh chụp local sau khi sửa** (header, `sending`) → khác biệt bằng 0.
- [ ] **Step 7: Chạy toàn bộ test** → PASS.
- [ ] **Step 8: Commit** `feat: "Máy này" on the local page: what this machine sends, its last error and its log`

---

### Task 17 [ui]: Trang thế giới: chú giải ba trạng thái, "gửi lúc", đảo mờ theo tuổi, "Máy này" trong "Của tôi" (V7, V8)

Trước task: đồng bộ với `origin/main`. Sau Task 16 (cùng file). Kiểm trên hub giả theo hợp đồng luồng xem nếu Task 15
chưa vào nhánh.

**Files:**
- Modify: `claude-office.html` (khối `world-logic`, `world-view`, `i18n-strings`)
- Test: `tests/world-logic.test.mjs`; hub giả ở scratchpad

**Interfaces:**
- Produces (`WorldLogic`):
  - `FRESH_MS = 45000`, `OFFLINE_AFTER_MS = 90000`.
  - `freshness(lastAt, hubNow, recvAt, nowMs, online) => {ageMs: number|null, alpha: number, bucket:
    'live'|'aging'|'offline'|'unknown'}`: `lastAt` hoặc `hubNow` không phải số → `{ageMs: null, bucket: 'unknown', alpha:
    online === false ? OFFLINE_ALPHA : 1}`; còn lại `ageMs = hubNow - lastAt + (nowMs - recvAt)`; `< FRESH_MS` → `live`,
    alpha 1; đến `OFFLINE_AFTER_MS` → `aging`, alpha giảm tuyến tính tới `OFFLINE_ALPHA`; sau đó `offline`. `OFFLINE_ALPHA`
    chuyển từ `world-view` sang `WorldLogic` (cùng giá trị 0.65).
  - `legendRow(linkPhase) => 'reconnecting'|'down'|null` (`refused`/`busy` → `down`).
- `world-view`:
  - `worldMeta` lưu `w.hubNow = d.now`, `w.recvAt = performance.now()` (và quy về `Date.now()` khi tính).
  - Đảo: `globalAlpha` từ `freshness(...).alpha` (thay cho kiểm `online === false`); nhãn dưới khi `bucket` là `aging`
    hoặc `offline`: "gửi lúc {time} · {ago}".
  - Chip kết nối có nút "?" (`aria-label`, bấm hoặc Enter) mở một bảng nhỏ ba dòng: xám "Đảo offline", vàng "Đang kết nối
    lại", đỏ "Hub không phản hồi", mỗi dòng một câu giải thích; dòng theo `legendRow(link.phase)` được tô; Esc đóng bảng
    trước (thêm vào `WorldLogic.escAction` dạng `{legend: true}` → `'legend'`).
  - "Của tôi": mỗi máy "gửi lúc {time}" từ `lastAt`, thiếu thì `lastUsedAt`. `startWorld` đọc `location.hash`
    `#this-device=<16 hex>` một lần, lưu `sessionStorage` (`try/catch`), xoá hash bằng `history.replaceState`; dòng máy có
    id đó gắn thẻ "Máy này" và đứng đầu danh sách.
  - Khoá i18n mới (7 ngôn ngữ): `world.legend.button`, `world.legend.offline.title`, `world.legend.offline.text`,
    `world.legend.reconnecting.title`, `world.legend.reconnecting.text`, `world.legend.down.title`,
    `world.legend.down.text`, `world.label.sentAt` (`{time}`, `{ago}`), `world.mine.thisDevice`, `world.mine.lastSent`
    (`{time}`).

- [ ] **Step 1: Viết test hỏng** trong `tests/world-logic.test.mjs`:
  - `freshness: live under 45 s, fades to the offline alpha at 90 s` (giá trị tại 0, 44 999, 45 000, 67 500, 90 000,
    200 000).
  - `freshness uses the hub clock, not the viewer's` (đồng hồ người xem lệch 10 phút → cùng kết quả).
  - `freshness without lastAt (old hub) is unknown and follows online`.
  - `legendRow maps link phases`; `escAction closes the legend first`.
- [ ] **Step 2: Chạy, xác nhận hỏng.** `node --test tests/world-logic.test.mjs` → FAIL.
- [ ] **Step 3: Ảnh chụp local trước khi sửa** → `before.png`.
- [ ] **Step 4: Cài đặt** theo Interfaces.
- [ ] **Step 5: Kiểm bằng mắt trên hub giả** (1280×800 và 390×844, sáng và tối): bốn đảo có `lastAt` = vừa xong, 60 s,
  5 phút, `null` → đảo 1 sáng không có "gửi lúc"; đảo 2 mờ một nửa có "gửi lúc …· 1 phút trước"; đảo 3 mờ hẳn; đảo 4
  vẽ theo `online` như hôm nay. Bảng chú giải mở/đóng bằng chuột, Enter, Esc; dòng được tô đổi khi tắt hub giả. Mở
  `/#this-device=<id>` → "Máy này" ở đầu danh sách "Của tôi", thanh địa chỉ không còn hash. Hub giả kiểu cũ (không `now`,
  `lastAt`): không lỗi, đảo vẽ như hôm nay.
- [ ] **Step 6: Ảnh chụp local sau khi sửa** → khác biệt bằng 0.
- [ ] **Step 7: Chạy toàn bộ test** → PASS.
- [ ] **Step 8: Commit** `feat: the world view tells island offline, reconnecting and hub down apart, with last-sent times`

---

### Task 18 [all]: Kiểm đầu cuối đợt 3, tài liệu, CHANGELOG

Trước task: đồng bộ với `origin/main`. Sau Task 14–17.

**Files:**
- Modify: `CHANGELOG.md`, `README.md` (mục "Chia sẻ đảo": viên "Máy này", nhật ký), `docs/hub-setup.md` (nếu Task 15 còn
  thiếu)

- [ ] **Step 1: Đầu cuối trên dev hub** (cổng ngẫu nhiên, DB tạm, `HUB_METRICS_TOKEN` 32 ký tự ngẫu nhiên), server local
  `PORT=4399`, `HOME` tạm, đã ghép:
  - `curl -I` tới `/` và `/healthz` → 200; `curl -I /api/world/stream` → 405;
  - `/metrics` với token → `terrarium_publish_total{result="accepted"}` tăng theo thời gian; không token → 401;
  - làm gói bị từ chối (publisher giả gửi `duplicate id`) → viên "Máy này" đỏ `rejected` với lý do, nhật ký có dòng
    tương ứng; `/metrics` `bad_packet` tăng;
  - dừng server local bằng **PID** → trên trang thế giới đảo mờ dần, "gửi lúc …" sau 45 s, offline sau 90 s; chú giải
    tô "Đảo offline"; dừng hub → chú giải tô "Đang kết nối lại", rồi "Hub không phản hồi".
- [ ] **Step 2: Ma trận phiên bản** (worktree tạm `08f6c10`): trang local mới với server cũ → viên "Máy này" chỉ có
  trạng thái, không nút "Nhật ký"; trang thế giới mới trên hub cũ → không "gửi lúc", không lỗi; hub mới + publisher cũ
  → `/metrics` đếm `accepted`.
- [ ] **Step 3: Tài liệu.**
  - `README.md`: viên "Máy này" (trạng thái, lần gửi cuối, lỗi cuối, nhật ký) và chú giải ba trạng thái.
  - `CHANGELOG.md` `[Unreleased]`: Added: viên "Máy này" và nhật ký trên trang local; `/healthz`, `/metrics`
    (`HUB_METRICS_TOKEN`), HEAD; "gửi lúc …" và đảo mờ theo tuổi; chú giải ba trạng thái; "Máy này" trong "Của tôi".
    Changed: gói bị hub từ chối hiện `rejected` (đỏ, có lý do); publisher hiện "đang kết nối" tới khi hub nhận gói đầu.
    Fixed: lỗi ghép máy của server local hiện rõ; chip không biến mất khi server local chết.
- [ ] **Step 4: Chạy toàn bộ test** → PASS. Gỡ worktree tạm.
- [ ] **Step 5: Commit** `docs: connection hardening wave 3 — health, metrics and what the pill means`
