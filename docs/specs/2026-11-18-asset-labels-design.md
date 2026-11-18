# Asset có nhãn, event là bảng dữ liệu: tái cấu trúc cách game đổi "dáng" theo mùa, lễ và sự kiện

Ngày: 2026-11-18 · Người đặt hàng: anh PO · Người viết: Claude · Nhánh: `claude/asset-labels` (từ `claude/assets-wiki`)

## 1. Ý định

Anh PO (nguyên văn): "cây event khi đổi là đổi hết, hiện tại anh thấy chỉ có một số cây là cây event, cần đồng bộ lại
hết nhé, cây nào ra cây đó, tương tự cho sàn, decorate, wall, đồng phục, house, ... Các assets đặc biệt (chỉ event đó có
thì không nói nhé), assets cần cấu trúc lại cho chuẩn (hiện tại anh check còn rất nhiều bug — chuyển event thì nó đồng bộ
cả assets, tràn text...). Em có thể dựa vào asset ⇒ đánh label ⇒ dựa vào đó khi phát triển event hay gì đó sẽ dễ dàng
hơn. Lên plans + specs kỹ phần này nhé, tái cấu trúc, kiến trúc các tầng, pattern nếu cần."

Hiểu lại:
- Khi một event bật, **mọi** asset thuộc cùng một loại đổi cùng lúc sang biến thể của event đó; mỗi asset gốc có đúng một
  biến thể tương ứng ("cây nào ra cây đó"). Áp cho cây, sàn, đồ trang trí, tường, đồng phục, nhà (chuồng chó, khu WC…).
- Asset chỉ riêng event có (nhà thờ Đức Bà, Santa, tuần lộc, cây thông lớn trong nhà…) thì không cần "bản gốc".
- Tái cấu trúc để thêm event sau này (Tết, Halloween…) chủ yếu là **viết một bảng**, không rải `if (ev.level >= 2)` khắp
  code. Nền tảng là **nhãn** gắn cho từng loại asset.
- Sửa các lỗi khi chuyển event (đồng bộ lệch, tràn chữ).

## 2. Hiện trạng (rà soát 2026-11-18, code `claude/assets-wiki` @ 69937da)

Gốc của mọi lỗi: **không có một chỗ duy nhất trả lời "lúc này game trông thế nào"**. Mỗi file tự hỏi event/mùa/lễ theo
cách riêng.

**2.1 Hai hệ thống cây chạy song song và lệch nhau**
- Cây đảo (nướng vào ảnh đảo): `sky-island.js` đổi `bare → fir` khi `env.event` bật — đổi cả loạt.
- 3 "cây lễ" gần văn phòng (`HOLIDAY_TREES`, `season-island.js:54`; vẽ ở `office-draw.js:236-254`) chạy theo
  `SeasonTree.seasonFor(new Date())` (`office-draw.js:577`) — **chỉ đọc ngày thật**, bỏ qua lựa chọn event/mùa trong
  Settings và preview. Hôm nay (18/11) bật event ⇒ cây thông Noel đứng cạnh 3 cây "chồng sách" Ngày Nhà giáo; chip header
  ghi "Winter · Teachers' Day". Tắt event trong tháng 12 ⇒ chip vẫn ghi "Winter · Christmas".
- Đảo nhỏ phía xa đổi sang thông từ mức 2 (`sky-render.js:136`), đảo chính từ mức 1. Đảo vẽ đơn giản ở chế độ thế giới
  (`world-ui.js:217-280`, `world-draw.js:333`) không biết event.

**2.2 Mức event bị kiểm tra rải rác, mỗi chỗ một ngưỡng** — ít nhất 8 kiểu: `ev.level >= s.level` (đèn dây),
`ev.level >= 2` (đồ trang trí bàn, đồ chó), `env.event >= 2` (kẹo gậy, đảo xa), `level <= 1` (mũ thay vì đồ),
`c.level >= 2` (đặt quà), `REINDEER_FROM = 2`, `ELF_FROM = 3`, `PENGUIN_FROM = 3`, `GIFTS[level]`, vòng hoa chuồng chó
không kiểm tra gì; đèn chòi giữa hồ mức 3 không có trong bảng mức của `event-logic.js`.

**2.3 Cùng loại nhưng chỗ đổi chỗ không**
- Cửa: EXIT và chuồng chó có vòng hoa; 2 cửa WC không.
- Tường: đèn dây chỉ trên tường sau/trái văn phòng; tường WC có tuyết nhưng không đèn; tường trước/đông của WC không gì.
- Bàn: đồ trang trí chỉ hiện ở bàn **đang có người** (`office-draw-xmas.js:186`), xuất hiện/biến mất theo agent.
- Đồng phục: đứng thì đủ hoa văn + khăn + mũ; ngồi thì mất hoa văn; tắm thì mất khăn; ngủ chỉ mũ + màu áo; rơi chỉ màu mũ.
  Mức 1: agent chỉ đội mũ nhưng sub-agent mặc đủ đồ chú lùn. Hai bản vẽ chú lùn khác nhau (rect `XMAS` và sprite critter).
- Chó: mặc đồ từ mức 2 trong khi người đã có đồ từ mức 1.
- Không đổi gì: sàn, cửa sổ, kệ sách, cây chậu, pantry, đồ WC, bụi cây, cầu thang.

**2.4 Chuyển event lúc đang chạy bị lệch nhịp**
- Đang **tạm dừng**: `stepCritters` chỉ chạy khi không pause (`office.js:514-517`) nhưng vẽ đọc `critterWorld.level` cũ
  ⇒ tắt event: cây/đèn/đồ biến mất ngay, tuần lộc/chú lùn/Santa/đống quà vẫn còn (và ngược lại khi bật).
- Cách rời đảo chọn lúc event bật (xe tuần lộc, gói quà, ống khói, trượt băng) vẫn diễn sau khi event tắt.
- Đường đi tính trước khi cây lớn xuất hiện không được tính lại ⇒ người đi xuyên cây.
- Tuyết do event mang tới tan dần trong khi đèn/vòng hoa tắt tức thì.
- Mỗi đảo ở chế độ thế giới tự nhớ event theo giây ⇒ lệch tới ~1 s so với đảo chính.
- Đổi event trong Simulation/"xem như người khác" không bao giờ tới hình nền; quay lại Live thì giá trị cũ trên server
  đè lên lựa chọn mới (`EventLogic.adopt` lấy server khi khác). POST lỗi bị nuốt ⇒ 3 s sau lựa chọn tự quay về.
- Preview không có trạng thái trên UI (không đếm ngược, không huỷ, select vẫn ghi "Tắt"); khi preview hết mọi người
  đang ở chỗ event bỏ đi cùng một khung hình.
- Event ép mùa đông + đổi mưa thành tuyết ⇒ chọn mùa / preview thời tiết không có tác dụng gì mà UI không nói.

**2.5 Tràn chữ**
- Bong bóng: `nowrap`, `maxWidth var(--bubble-w, 240px)` (150 px trên điện thoại), JetBrains Mono 10 px ⇒ ~28 cột trên
  desktop, ~13 trên điện thoại. Bị cắt trên desktop: `office.act.gift` (en 35, es 34, ja 39), `office.act.snowball` (es
  34), `office.act.snowman` (es 30), `office.act.cocoa` (es 29), `bubble.fate.wrapped` (es 36, en 32, vi 32, th 30),
  `bubble.fate.chimney` (es 34, en 33, vi 30), `bubble.fate.sleigh` (vi 28), `bubble.fate.snowball` (vi 28),
  `bubble.fate.skateoff` (en 28).
- Settings: panel 280 px (252 px nội dung), `select` không có max-width ⇒ "Automático (1–26 de diciembre)" làm panel
  cuộn ngang.

**2.6 Cách "biến thể" đang được biểu diễn** — chuỗi `kind` + if/else trong một hàm vẽ (`drawSeasonTree(..., kind)`),
bảng `SeasonLogic.LOOKS`, đổi màu qua hàm `C`/`T`/`hz`, hàm vẽ riêng cho từng biến thể (`farFir`, `drawCandyCane`…),
cờ boolean truyền xuống (`frozen`, `festive`, `/x` trong khoá cache chó), và một tập ô cứng (`HOLIDAY_TREES`). Không có
nhãn; asset gốc nối với biến thể chỉ ngầm qua đường code.

## 3. Mục tiêu, không làm, phản mục tiêu

**Mục tiêu**
1. Một **Moment** duy nhất mỗi khung hình (mùa, event, lễ, ngày/đêm, tuyết) cho mọi cảnh: đảo chính, đảo thế giới, hình
   nền, trang `/assets`.
2. Mỗi loại asset có **nhãn** ổn định; mỗi event/mùa/lễ là **một gói dữ liệu** nói nhãn nào ra biến thể nào, thêm gì, và
   bật hành vi nào. Một resolver duy nhất biến Moment + các gói thành **Look**; mọi code vẽ chỉ hỏi Look.
3. Event Noel: **đổi hết cùng lúc** — mọi instance của mọi nhãn trong bảng (mục 6) sang biến thể Noel ngay khi event bật.
4. Test bắt buộc: mọi nhãn phải được **khai báo tường minh** trong mọi gói event (một biến thể, hoặc `same`), mọi
   (nhãn, biến thể) có hàm vẽ, mọi instance của một nhãn nằm trong danh sách instance của nó.
5. Chuyển event (auto/on/off/preview, live/sim, pause, thế giới, hình nền) đổi **mọi thứ trong cùng một khung hình**, kể
   cả khi đang tạm dừng.
6. Không còn chữ bị cắt ở 7 ngôn ngữ trên desktop; điện thoại cắt có dấu "…" chứ không tràn.
7. Trang `/assets` đọc cùng bảng: mỗi item hiện nhãn và các cột "thường → mùa đông → Noel → …".

**Không làm**
- Không chuyển hình vẽ bằng code sang file ảnh / sprite sheet.
- Không thêm event mới (Tết, Halloween) trong đợt này — chỉ chứng minh cấu trúc đủ bằng một gói thử trong test.
- Không đổi lịch event (1–26/12) hay danh sách event-only assets.
- Không đổi hành vi agent/chó ngoài những chỗ cần để đồng bộ khi chuyển event.

**Phản mục tiêu**
- Hai nguồn sự thật (trang `/assets` một bảng, game một bảng khác).
- Resolver chạy mỗi khung hình hoặc cấp phát mỗi khung hình (spec hiệu năng §3.3: không `shadowBlur`, filter,
  `getImageData`, gradient/canvas mới mỗi khung hình).
- Một nhãn "quên" khai báo trong gói event mà test vẫn xanh.
- File web > 700 dòng, dòng > 120 ký tự.

## 4. Các hướng đã cân nhắc

| Hướng | Cách làm | Được | Mất |
|---|---|---|---|
| **A. Nhãn + gói dữ liệu + resolver (chọn)** | Mỗi loại asset có nhãn; gói (`base`, `winter`, `christmas`, các lễ nhỏ) là dữ liệu: `swap`, `decor`, `extras`, `rules`, `text`; một resolver ra Look; vẽ hỏi Look; painter đăng ký theo (nhãn, biến thể). | Thêm event = thêm một file dữ liệu + painter cho biến thể mới; test bắt thiếu; `/assets` đọc chung; hết lệch nhịp vì một Look. | Chạm gần hết các file vẽ; cần chia đợt cẩn thận. |
| B. Chỉ gom điều kiện | Một bảng `EventLogic.has(ev, 'deskDecor')` thay các `level >= n`; sửa từng chỗ lệch bằng tay. | Ít đụng code. | Không có nhãn, không có "cây nào ra cây đó" được kiểm; event sau vẫn phải sửa rải rác. |
| C. Đường ống asset dạng dữ liệu | Chuyển mọi hình vẽ sang sprite dữ liệu có nhãn (như `critter-sprites.js`). | Đồng nhất tuyệt đối. | Vẽ lại toàn bộ game; rủi ro lệch hình; quá lớn so với nhu cầu. |

Anh giao phần "kiến trúc, pattern" cho em; em chọn **A** vì nó là hướng duy nhất làm được cả "đồng bộ hết" lẫn "phát
triển event sau dễ", và tái dùng được sổ đăng ký của `/assets`. B chỉ chữa triệu chứng; C tốn gấp nhiều lần mà không thêm
gì cho anh.

## 5. Kiến trúc các tầng

```
 Tầng 0  Đầu vào         ngày giờ · lựa chọn Settings (mùa, event, preview) · thời tiết · thiết lập chung từ server
            │
 Tầng 1  Moment          moment.js — thuần: { season, look(mùa), event, holiday, df, snow, night, key }
            │              tính 1 lần/khung hình bởi host, cả khi pause; mọi cảnh dùng chung
 Tầng 2  Gói (Theme)     themes/*.js — dữ liệu: base · winter · christmas · holidays (lễ nhỏ)
            │
 Tầng 3  Resolver        theme.js — thuần: Moment + gói ⇒ Look { of(label), decor(label), has(rule), text(key), key }
            │              nhớ theo moment.key; chỉ tính lại khi key đổi
 Tầng 4  Nhãn + instance labels.js — danh mục nhãn; mỗi nhãn biết danh sách instance của nó (tường, cửa, bàn, cây…)
            │
 Tầng 5  Painter         paint.js — đăng ký (nhãn, biến thể) → hàm vẽ; overlay (decor) → hàm vẽ
            │
 Tầng 6  Vẽ + trạng thái sống   các file office-draw-*, sky-*, world-*: hỏi Look, vẽ qua painter; khoá cache = Look.key
            │                    phần sống (critter, idle, fate, đường đi, tuyết) hoà giải khi Look đổi
 Tầng 7  Giao diện       chip, Settings, bong bóng: chữ đọc qua Look.text và có ngân sách độ rộng
            │
 Tầng 8  /assets         registry gắn nhãn; cột biến thể sinh từ các gói
```

### 5.1 Moment (tầng 1, `web/moment.js`, thuần, có test)

```
Moment.at({ date, seasonChoice, seasonPreview, eventChoice, eventPreview, fx, snowShown, df, now }) → {
  season,     // 'spring'|'summer'|'autumn'|'winter' — sau khi gói event ép mùa (christmas ⇒ winter)
  look,       // SeasonLogic.look(season)
  event,      // null | { key: 'christmas', day: số ngày từ đầu event (cho "tích luỹ" như số hộp quà) }
  holiday,    // null | khoá lễ nhỏ (teachers, halloween, tet…) — tắt khi có event lớn; theo lựa chọn mùa, không
              //   chỉ theo ngày thật
  df, night, snow,
  forced: { season: bool, weather: bool },   // để UI nói "do sự kiện"
  key,        // chuỗi ổn định: season|event|holiday|nightBand|snowBand — đổi ⇒ resolver tính lại
}
```
- Thay `eventNow()`, `seasonNow()`, `this.seasonKey/season/treeOn` và các `SeasonTree.seasonFor(new Date())` rải rác.
- Host (`ClaudeOffice`) tính một lần mỗi khung hình (kể cả khi pause) và gán `this.moment`; `IslandScene` đọc
  `host.moment`, không tự nhớ riêng ⇒ hết lệch ~1 s.
- `EventLogic.active` giữ lịch (1–26/12) nhưng trả `{ key, day }`; trường `level` bỏ khỏi API công khai (mục 7, D1).

### 5.2 Gói (tầng 2, `web/themes/*.js`, dữ liệu thuần)

```
export const CHRISTMAS = {
  key: 'christmas',
  kind: 'event',                 // 'season' | 'event' | 'holiday'
  season: 'winter',              // ép mùa (bỏ trống nếu không ép)
  weather: { snowFloor: 0.45, rainToSnow: true },
  swap:   { 'tree.island': 'fir', 'tree.holiday': 'fir', 'bush': 'holly', 'floor.corridor': 'runner', … },
  decor:  { 'door': ['wreath'], 'wall.outer': ['garland', 'lights'], 'desk': ['xmas-desk'], … },
  extras: ['tree.big', 'cane', 'gifts', 'cathedral', 'ourlady', 'critter.reindeer', …],
  rules:  { 'idle.snowball': true, 'idle.gift': true, 'fate.sleigh': 4, 'critter.santa': true, … },
  text:   { 'office.act.coffee': 'office.act.cocoa' },
  build:  { gifts: [[1, 2], [8, 5], [15, 9]] },   // "tích luỹ" theo ngày của event (chỉ số lượng, không đổi dáng)
};
```
- `base.js`: biến thể mặc định của mọi nhãn theo mùa (`tree.island: { spring: 'fresh', summer: 'green', autumn: 'gold',
  winter: 'bare' }`…) — đây là chỗ duy nhất nói "bình thường trông thế nào".
- `winter.js`: phần riêng mùa đông có cả khi không có event (gấu Bắc Cực, igloo, người tuyết, băng, chỏm tuyết).
- `holidays.js`: các lễ nhỏ của `SeasonTree` (Nhà giáo, Halloween, Tết…) — **chỉ** đổi `tree.holiday` (đúng như hôm nay)
  và chip; bị tắt khi một gói `kind: 'event'` đang bật.
- Thứ tự áp: `base` (theo mùa) → `winter` (nếu mùa đông) → holiday → event. Gói sau đè gói trước theo từng nhãn.

### 5.3 Resolver (tầng 3, `web/theme.js`, thuần, có test)

```
Theme.resolve(moment, packs) → Look {
  of(label) → variant id           // luôn có giá trị (base bảo đảm)
  decor(label) → [overlay id]      // mảng dùng lại, không cấp phát mỗi lần gọi
  has(rule) → bool | number        // hành vi: critter, idle, fate…
  text(key) → key                  // đổi khoá chữ (cà phê → cacao)
  extras → Set(label)
  build(name) → number             // số hộp quà theo ngày
  key                              // chuỗi = hash của mọi biến thể + decor + extras; dùng làm khoá cache
  keyOf(labels) → chuỗi            // khoá chỉ của một nhóm nhãn (vd. ảnh đảo nướng chỉ phụ thuộc nhãn ngoài trời)
}
```
- Nhớ kết quả theo `moment.key`: resolve chỉ chạy khi key đổi (vài lần/giờ), không phải mỗi khung hình.
- Look đóng băng (`Object.freeze`), `of/decor/has` là đọc thuộc tính ⇒ 0 cấp phát mỗi khung hình.

### 5.4 Nhãn và instance (tầng 4, `web/labels.js`)

Nhãn = `'<nhóm>.<tên>'` hoặc một từ khi đủ rõ. Mỗi nhãn khai báo:
```
{ id: 'door', group: 'office', what: 'cửa ra vào', instances: () => DOORS, variants: ['plain'], overlays: ['wreath'] }
```
- `instances` trỏ tới **danh sách instance duy nhất** của nhãn, gom từ nơi hiện đang cứng rải rác:
  - `WALLS`: mọi đoạn tường `{ kind: 'outer'|'inner', from, to, side, height }` — văn phòng (sau, trái), khối WC (sau,
    trước, đông, vách phòng). Thay vòng vẽ riêng ở `office-draw.js:359` và `office-draw-restroom.js:157,253,299`.
  - `DOORS`: EXIT, 2 cửa WC, 3 cửa chuồng chó — vị trí lấy từ cùng hình học với cửa (không còn `P(0, 7.05, 24)` cứng).
  - `WINDOWS`: một danh sách (hiện lặp ở `office-draw.js:373` và `:586`).
  - `DESKS` (đã có), `HOLIDAY_TREES`, cây đảo (`ISLAND.decor`), đèn, chuồng chó, cây chậu góc.
- Overlay (vòng hoa, đèn dây, tuyết trên tường…) gắn **theo nhãn trên mọi instance** ⇒ "cửa nào cũng có vòng hoa" là hệ quả
  của cấu trúc, không phải của việc nhớ thêm toạ độ.

### 5.5 Painter (tầng 5, `web/paint.js`)

```
Paint.variant(label, variant, fn)     // fn(ctx-tools, instance, env)
Paint.overlay(label, overlay, fn)
Paint.draw(label, look, tools, inst, env)   // vẽ biến thể + mọi overlay của nhãn theo Look
```
- Hàm vẽ hiện có giữ nguyên chỗ ở (`island-art*.js`, `decor-*.js`, `pantry-*.js`, `office-draw-*.js`); mỗi file tự
  đăng ký painter của mình khi được import (giống `mixin` hiện nay). Hàm vẽ một biến thể nhận kiểu chữ ký sẵn có của nhóm
  đó (IP, K, PK, ST, SP, M — xem `docs/specs/2026-11-16-assets-inventory.md` §0); `Paint` không ép một chữ ký chung.
- Hàm vẽ nhiều nhánh (`drawSeasonTree(kind)`) tách thành các painter theo biến thể hoặc giữ một hàm nhưng nhận biến thể
  từ Look — tuỳ builder, miễn là đăng ký đủ (test kiểm).

### 5.6 Vẽ và khoá cache (tầng 6)

- Mọi `ev.level`, `env.event`, `G.ev`, `holiday`, `festive`, `/x` trong code vẽ được thay bằng `look.of/decor/has`.
- Khoá cache: ảnh đảo nướng = `k|df|snow|look.keyOf(OUTDOOR_LABELS)`; sprite chó = `breed/frame/dfB/snB/look.of('dog.costume')`;
  đồ người = `look.of('outfit.agent')`… Không khoá nào còn chứa `level` hay boolean `x`.
- Gom ngưỡng đêm về một chỗ: `Light.night(df)` / `Light.glow(df)` thay 5 ngưỡng (0.5, 0.6, 0.7, 0.2/0.8) — mỗi asset ghi
  rõ dùng ngưỡng nào (không bắt buộc cùng một ngưỡng, nhưng cùng một nguồn).

### 5.7 Hoà giải khi Look đổi (tầng 6, phần "sống")

Host so `look.key` mỗi khung hình (một phép so chuỗi); khi đổi gọi `onLook(prev, next)` **một lần**, kể cả khi pause:
- Critter: đồng bộ thế giới critter ngay (`step(dt = 0)`), vẽ đọc cùng Look ⇒ không còn "pause thì tuần lộc còn".
- Idle: người đang ở chỗ event đã đóng thì chọn chỗ mới, **trải ra** trong ~3 s (mỗi người một độ trễ ngẫu nhiên) thay vì
  cùng một khung hình.
- Fate: cách rời đảo đã chọn mà `look.has('fate.x')` giờ là 0 thì chọn lại (cảnh đang diễn dở thì cho diễn hết).
- Đường đi: khi tập ô bị chặn đổi (cây lớn, nhà thờ, vùng gấu), người đang đi có đường cắt qua ô mới chặn thì tính lại.
- Tuyết: tuyết do event mang tới tan nhanh (mục tiêu ~10 s) khi event tắt, để "đèn tắt" và "tuyết tan" đi cùng nhịp.
- Bong bóng: khoá bong bóng gồm cả chữ đã đổi (cà phê → cacao nói lại).

### 5.8 Đồng bộ lựa chọn (tầng 0)

- Thiết lập chung có `updatedAt`; trang chỉ nhận giá trị server **mới hơn** của mình (thay luật "khác là nhận").
- Simulation và "xem như người khác" vẫn đẩy lựa chọn lên server khi server tới được; chế độ thế giới cũng đọc thiết lập chung.
- POST lỗi ⇒ giữ lựa chọn cục bộ, thử lại ở lần thay đổi sau / snapshot sau, không quay về giá trị cũ.
- Preview có trạng thái: select hiện "Xem thử · 0:42" và một nút huỷ; bấm lại không âm thầm đặt lại đồng hồ.
- Khi event ép mùa/thời tiết, ô Mùa và nút xem thử thời tiết hiện "(do sự kiện)" và bị khoá.

### 5.9 Chữ (tầng 7)

- Ngân sách cột: bong bóng **≤ 26 cột** gồm emoji (CJK tính 2 cột) trên desktop; điện thoại cắt bằng `text-overflow:
  ellipsis`. Test đọc 7 bảng i18n và kiểm mọi khoá `office.act.*`, `bubble.fate.*` và các khoá bong bóng khác.
- Viết lại các câu đang vượt (mục 2.5) cho ngắn hơn trong mọi ngôn ngữ vượt.
- Settings: `select` có `max-width` và cắt "…"; nhãn tuỳ chọn dài (es) rút gọn; test kiểm khoá `settings.*` ≤ ngân sách
  của panel.
- `ACT_TXT` hết dịch một lần lúc nạp module: đọc `tr()` khi vẽ để đổi ngôn ngữ không cần tải lại.

### 5.10 Trang `/assets` (tầng 8)

- Mỗi entry trong `assets-cat-*.js` có `label` (hoặc nhiều nhãn cho entry gộp); test: mọi nhãn trong `labels.js` có ít nhất
  một entry, mọi entry vẽ được trong mọi biến thể các gói khai báo.
- Trục "event" của trang (0–3) đổi thành danh sách gói (`không`, `mùa đông`, `Noel`, các lễ nhỏ) lấy từ `themes/`.
- Thêm một chế độ xem "Bảng chuyển đổi": mỗi hàng một nhãn, mỗi cột một gói, ô là hình vẽ biến thể — đây là chỗ anh kiểm
  "cây nào ra cây đó" bằng mắt.

## 6. Bảng nhãn cho Noel (những gì "đổi hết")

`same` = cố ý giữ nguyên (khai báo tường minh). "mới" = biến thể chưa có hình, phải vẽ trong đợt này. Mùa đông (không
event) đã cho tuyết phủ, hồ đóng băng, cây trụi — cột "Noel" là thêm/đổi so với mùa đông.

| Nhãn | Instance | Bình thường (theo mùa) | Noel | Hiện nay |
|---|---|---|---|---|
| `tree.island` | mọi cây trên đảo chính | fresh/green/gold/bare | `fir` (thông phủ tuyết) | đã đổi |
| `tree.holiday` | 3 ô gần văn phòng | cây lễ theo lịch (lễ nhỏ) | `xmas` = cây Noel trang trí sẵn có trong `season-trees.js` (đèn, sao, quà) | **lệch** (chạy theo ngày; bản Noel chưa từng được vẽ) |
| `tree.far` | đảo nhỏ phía xa | theo mùa | `fir` có đèn (mọi ngày event) | lệch mức 1 |
| `tree.world` | cây mini đảo đơn giản ở chế độ thế giới | theo mùa | `fir` mini | **thiếu** |
| `bush` | mọi bụi | thường / quả mùa xuân | `holly` (lá xanh đậm, quả đỏ, tuyết) | mới |
| `flower`, `mushroom`, `rock`, `bench`, `lamp` | — | theo mùa | `same` (kẹo gậy là extra cạnh đèn) | |
| `floor.office` | nền văn phòng ngoài các khu | gạch theo theme | `same` | |
| `floor.corridor` | hai lối đi chính | gạch | `runner` (thảm đỏ viền vàng) | mới |
| `floor.zone` | sàn màu phòng ban | màu ban | `same` | |
| `floor.pantry` | sàn pantry | ô vuông | `checker-red` (ô đỏ-trắng) | mới |
| `floor.wc` | sàn WC | ô vuông | `same` | |
| `wall.outer` | mọi tường ngoài: văn phòng + khối WC | trơn | overlay `garland` + `lights` | **lệch** (thiếu WC) |
| `wall.inner` | vách WC, kính phòng ban | trơn | `same` | |
| `window` | 4 cửa sổ | thường | overlay `frost` (góc kính đóng băng) + `star` | mới |
| `door` | EXIT, 2 cửa WC, 3 cửa chuồng | trơn | overlay `wreath` | **lệch** (thiếu WC) |
| `desk` | mọi bàn | thường | overlay `xmas-desk` (3 kiểu theo số bàn), **có người hay không** | **lệch** |
| `chair`, `monitor`, `board.usage` | — | — | `same` | |
| `shelf` | kệ sách | thường | overlay `garland-small` | mới |
| `plant.pot` | 3 cây chậu góc + cây bàn | thường | overlay `bauble` (nơ đỏ, quả châu) | mới |
| `clock` | đồng hồ tường | thường | overlay `holly-sprig` | mới |
| `pantry.item` | 23 món pantry | thường / đang dùng | `same` (chữ cà phê → cacao qua `text`) | |
| `pergola` | góc hút thuốc | thường | overlay `lights` | có (mức 2) |
| `kennel` | 3 chuồng chó | thường, tuyết trên mái | overlay `wreath` (qua `door`) + `lights` | lệch mức |
| `pavilion` | chòi giữa hồ | thường | overlay `lights` | có (mức 3) |
| `stairs`, `plinth` | — | — | `same` | |
| `outfit.agent` | mọi agent, **mọi tư thế** (đứng, ngồi, ngủ, tắm, rơi, cảnh rời đảo) | áo theo ban | một trong 5 bộ theo sid, khăn màu ban, mũ | **lệch** (mức 1 chỉ mũ; ngồi/tắm thiếu) |
| `outfit.subagent` | mọi sub-agent, mọi tư thế | áo + dải vàng | đồ chú lùn — **một bản vẽ chung** với chú lùn critter | lệch (2 bản vẽ) |
| `dog.costume` | 3 giống chó, mọi tư thế, cả trong chuồng | không | đồ Noel theo giống | lệch mức |

Extras chỉ Noel có (không cần bản gốc): `tree.big` (cây thông lớn trong nhà), `gifts` (số hộp theo ngày), `cane`,
`cathedral`, `ourlady`, `critter.reindeer`, `critter.elf`, `critter.penguin`, `critter.santa`, `sleigh`, các idle
(`snowball`, `snowman`, `skate`, `gift`), các cách rời đảo (`sleigh`, `wrapped`, `skateoff`, `chimney`). Riêng mùa đông
(gói `winter`, có cả khi không có event): `igloo`, `bear`, `snowman.lawn`, `icicles`, `breath`.

## 7. Quyết định của em (anh sửa được)

- **D1 — Đổi hết cùng lúc.** Bỏ 3 mức theo tuần cho mọi thay đổi về **dáng**: ngày đầu event đã đủ bảng mục 6. Chỉ còn
  "tích luỹ" về **số lượng** theo ngày (số hộp quà dưới cây: 2 → 5 → 9). Lý do: câu "cây event khi đổi là đổi hết" của
  anh; ba mức chính là nguồn của phần lớn chỗ "đổi chỗ không". Anh chưa trả lời câu hỏi này — nếu anh muốn giữ mức, bảng
  vẫn chứa được (`swap` theo ngày) mà không đổi kiến trúc.
- **D1b — Thú và extras cũng có từ ngày đầu.** Tuần lộc, chú lùn, chim cánh cụt, Santa, xe tuần lộc, nhà thờ, các
  hoạt động và cách rời đảo của Noel đều là "dáng", nên có ngay khi event bật. Chỉ số hộp quà dưới cây tăng theo ngày.
  `event.day` chỉ dùng cho `build` (số lượng); gói không có `swap`/`rules` theo ngày.
- **D2 — Lễ nhỏ nhường event lớn.** Khi một gói `event` bật, các lễ nhỏ tắt (không còn cây "Nhà giáo" cạnh cây thông).
  Lễ nhỏ chỉ hiện khi **mùa để Tự động** và không có preview mùa: chọn tay một mùa (hoặc xem thử mùa) thì không có lễ nhỏ
  nào, để cảnh luôn khớp với mùa đang hiện. Mục `christmas` theo ngày trong `SeasonTree` bỏ khỏi danh sách lễ nhỏ; hình cây
  Noel của nó thành biến thể `xmas` của `tree.holiday` trong gói Noel.
- **D2b — Lựa chọn event/mùa là của người xem, không của nguồn dữ liệu.** Đổi trong Settings ở Simulation hay "xem như
  người khác" vẫn đẩy lên thiết lập chung (như ở Live), luật "mới hơn thì thắng" theo `updatedAt`. Lý do: anh dùng hình
  nền theo cùng thiết lập; hôm nay lựa chọn ở Simulation mất âm thầm rồi bị đè.
- **D3 — Chip header** hiện đúng Look: "Mùa đông · Giáng sinh" chỉ khi gói Noel bật; tắt event trong tháng 12 thì chip
  không nhắc Noel.
- **D4 — Tuyết đi cùng nhịp event**: tuyết event mang tới tan trong ~10 s khi tắt (mùa đông thật vẫn giữ tuyết của nó).
- **D5 — Mọi biến thể "mới"** trong mục 6 được vẽ trong đợt này, theo phong cách pixel hiện có. Ảnh chụp so sánh là
  bằng chứng kèm từng commit, không phải cửa chặn giữa chừng; anh xem một lượt ở cuối (một trang tổng hợp "trước/sau"
  theo từng nhãn) trước khi push.
- **D6 — Không bỏ API cũ một lần**: `eventNow()`/`seasonNow()` thành lớp mỏng đọc `this.moment` trong lúc chuyển, xoá ở
  đợt cuối.

## 8. Kiểm chứng

- Test thuần mới: `tests/moment.test.mjs`, `tests/theme.test.mjs` (thứ tự gói, ép mùa, lễ nhường event, `key` ổn định,
  không cấp phát khi gọi `of`), `tests/labels.test.mjs` (mọi nhãn khai báo trong mọi gói event; mọi (nhãn, biến thể,
  overlay) có painter; instance không trùng; mọi cửa/tường/bàn có mặt trong danh sách), `tests/text-fit.test.mjs`
  (ngân sách cột 7 ngôn ngữ).
- Gói thử trong test (`kind: 'event'`, đổi `tree.island` sang một biến thể giả) chứng minh thêm event chỉ cần dữ liệu +
  painter.
- Test chuyển event: Look đổi ⇒ `onLook` chạy một lần, cả khi pause; critter/idle/fate đọc cùng Look.
- Ảnh chụp (`tools/shot.mjs`): 20/12 trưa và tối, event bật/tắt/chuyển lúc chạy/chuyển lúc pause, tháng 7, 18/11 với
  event bật (không còn cây Nhà giáo); so sánh từng nhãn trong mục 6.
- Đo khung hình (`tools/perf-frame.mjs`) trước/sau: ms p50/p95 và số lệnh canvas không vượt ngân sách §3.4 của spec event
  (`tools/README.md`).
- 7 ngôn ngữ: test i18n hiện có + `text-fit`.

## 9. Thứ tự làm (để plan chia task)

1. Moment + resolver + gói `base`/`winter`/`christmas`/`holidays` (thuần, test) — chưa đụng code vẽ.
2. Nối host: `this.moment`, Look; `eventNow/seasonNow` thành lớp mỏng; lễ nhỏ, chip, Settings đọc Look (sửa 2.1, D2, D3).
3. Danh sách instance (`WALLS`, `DOORS`, `WINDOWS`…) + `Paint`; chuyển các asset đã có biến thể sang painter đọc Look
   (cây đảo, cây lễ, đảo xa, kẹo gậy, đèn dây, vòng hoa, đồ bàn, chó, chuồng) — hết mọi `level`.
4. Đồng phục: một nguồn cho mọi tư thế; hợp nhất bản vẽ chú lùn.
5. Biến thể mới: `bush.holly`, `tree.world.fir`, `floor.corridor.runner`, `floor.pantry.checker-red`, `window.frost`,
   `shelf.garland-small`, `plant.pot.bauble`, `clock.holly-sprig`; tường WC nhận đèn, cửa WC nhận vòng hoa.
6. Hoà giải khi Look đổi (5.7) + đồng bộ lựa chọn (5.8) + preview có trạng thái.
7. Chữ (5.9).
8. `/assets`: nhãn trên entry, trục gói, "Bảng chuyển đổi"; test phủ nhãn.
9. Dọn: xoá API cũ, comment cũ sai (cây lớn "on the front lawn"), CHANGELOG/README, đo hiệu năng.

Không push cho tới khi xong cả 9 đợt (anh dặn "làm xong xuôi hết rồi push lên một thể").

## 10. Để builder tự quyết

- Chữ ký chính xác của từng painter trong từng nhóm vẽ; tách hay giữ hàm nhiều nhánh.
- Hình chi tiết của các biến thể "mới" (trong giới hạn mô tả mục 6), miễn có ảnh so sánh.
- Cách băm `look.key`, cách lưu `updatedAt`, thời gian trải đều khi người rời chỗ event (khoảng 3 s là gợi ý).
- Tên file chính xác dưới `web/themes/` và việc gộp `labels.js`/`paint.js` nếu một file đủ nhỏ.
