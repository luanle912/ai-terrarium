# Bảng USAGE (5H / 7D): vì sao trống, nguồn dữ liệu nào đúng, thiết kế lại

Ngày: 2026-11-10 · Người đặt hàng: anh Kiệt · Người viết: Claude

Lời anh Kiệt: "cái đo usage anh thấy nó không work, em review kỹ lại xem bug ở đâu nhé", rồi "review kỹ để làm đúng
hướng — không chắp vá nhé".

## 1. Vì sao trống (đã kiểm, có bằng chứng)

Chuỗi hiện tại: Claude Code gọi lệnh `statusLine` → `node server.js statusline` ghi `~/.claude-terrarium/usage.json` →
server đọc → trang vẽ bảng.

| Khâu | Kết quả kiểm |
|---|---|
| Định dạng dữ liệu | Đúng: `rate_limits.five_hour / seven_day .used_percentage / .resets_at` khớp mô tả trong chính binary Claude Code 2.1.308 |
| Server đọc file, trang vẽ | Đúng (test có sẵn) |
| **Lệnh `statusLine` có được gọi không** | **Không.** Anh dùng Claude Code trong app desktop: mọi phiên chạy `claude --output-format stream-json --input-format stream-json` (đã thấy trong `ps`), không có giao diện terminal nên không có status line. `usage.json` chưa từng tồn tại |
| Đường dẫn `statusLine` | Trỏ vào worktree tạm `.claude/worktrees/alo-em-eb25aa/server.js`: xoá worktree là hỏng cả khi dùng terminal |

Kết luận: không phải lỗi code; **nguồn dữ liệu duy nhất của bảng không bao giờ chạy trong cách anh dùng.**

## 2. Các nguồn có thể có

| # | Nguồn | Có % liên tục? | Chạy được với app desktop? | Ghi chú |
|---|---|---|---|---|
| S1 | `statusLine` (đang có) | Có | **Không** (chỉ khi có phiên `claude` trong terminal) | Chính thức, có tài liệu |
| S2 | **`get_usage` của Claude Code** (yêu cầu điều khiển trong chế độ SDK: `{"subtype":"get_usage","skip_behaviors":true}`) | Có | Có, *nếu* bản `claude` của máy đăng nhập bằng tài khoản claude.ai | Binary tự mô tả: "for callers that need only the plan rate limits, such as a usage meter"; đánh dấu *Experimental*. Đã thử: trả lời sau ~2,9 s, không gửi prompt (không tốn lượt), `--no-session-persistence` không ghi transcript, không thêm phiên vào `~/.claude/sessions`. **Trên máy anh trả `rate_limits_available: false`** vì `claude auth status` = `api_key` |
| S3 | Lỗi 429 trong transcript (commit ff4cbaa) | Không, chỉ biết lúc **chạm trần** + giờ reset | Có | Chắc chắn đúng tại thời điểm đó; transcript không ghi % lúc bình thường |
| S4 | Đọc token OAuth trong Keychain rồi gọi API usage không công khai | Có | Có | **Không làm**: đụng thông tin đăng nhập, API không công khai, macOS hỏi quyền Keychain |
| S5 | Lấy `CLAUDE_CODE_OAUTH_TOKEN` từ môi trường phiên app desktop | Có | Một phần | **Không làm**: token ngắn hạn do app làm mới, chỉ có khi server do hook trong phiên desktop bật, đọc trộm credential |

## 3. Thiết kế

Một module `lib/usage.js` gom các nguồn theo thứ tự tin cậy, thay cho chỗ ghép tay trong `snapshot()`:

```
nguồn  →  { windows: [{kind, pct, resets}], source, at }   hoặc   { unavailable: lý do }
gộp    →  board = { windows, source: 'statusline' | 'claude' | 'limit' | null, reason }
```

1. **S1 statusLine**: dùng nếu `usage.json` mới (≤ 10 phút).
2. **S2 `get_usage`**: nếu S1 không mới, server tự hỏi Claude Code **mỗi 5 phút**:
   - Tìm `claude`: biến `TERRARIUM_CLAUDE`, rồi `PATH`, `/opt/homebrew/bin`, `~/.local/bin`, `/usr/local/bin`.
     **Không** dùng bản trong app desktop: bản đó không có đăng nhập riêng.
   - Chạy `claude -p --input-format stream-json --output-format stream-json --verbose --no-session-persistence
     --strict-mcp-config --settings '{"disableAllHooks":true}'` trong một thư mục trống; gửi `initialize` rồi
     `get_usage`; hạn 15 s; đọc `rate_limits.five_hour / seven_day`; đóng.
   - `rate_limits_available: false` (đăng nhập bằng API key, Bedrock, …) → ghi lý do, **thôi hỏi 1 giờ** (không chạy
     tiến trình vô ích mỗi 5 phút).
   - Không tìm thấy `claude` → lý do "không có Claude Code CLI".
3. **S3 lỗi 429**: cửa sổ nào đang bị chặn và chưa tới giờ reset thì hiện 100 % (LIMIT), đè lên S1 / S2 cũ hơn
   (giữ như commit ff4cbaa, chuyển vào module).
4. Snapshot gửi trang thêm `usageSource` và `usageReason`.
5. **Trang**: bảng giữ như cũ (`--` khi không có số). Panel ⚙ Cài đặt có một dòng "Mức dùng 5H/7D": nguồn đang dùng,
   hoặc lý do không có số và cách bật (7 ngôn ngữ). Bảng pixel không chứa nổi câu giải thích.
6. **Tài liệu**: README nói rõ ba nguồn và việc app desktop không có status line; sửa `statusLine` trỏ về repo cố định.

Chi phí: S2 là một tiến trình `claude` khởi động ~3 s mỗi 5 phút (~1 % một lõi trung bình), chỉ khi S1 không có.

## 4. Cần anh quyết

Với máy anh hiện nay, S2 trả "không có giới hạn gói" vì **CLI `claude` đăng nhập bằng API key**. Muốn bảng có % liên
tục thì CLI phải đăng nhập bằng tài khoản claude.ai (`claude auth login`, chọn tài khoản claude.ai). Việc này đổi cách
tính tiền **khi anh chạy `claude` trong terminal** (dùng gói thay vì API key), nên em không tự làm.

- Nếu đổi: S2 cho % liên tục, có thể bỏ hẳn `statusLine`.
- Nếu giữ API key: bảng chỉ có S3 (LIMIT khi chạm trần) và ghi rõ lý do trong ⚙; vẫn đúng, không giả số.

Dù chọn gì, thiết kế ở mục 3 vẫn như nhau; chỉ khác máy anh có số % hay không.

## 5. Quyết định và kết quả (2026-11-10)

- Anh Kiệt: **chỉ làm cho gói subscription**: không có gói (API key, Bedrock, …) hoặc chưa biết thì **ẩn hẳn bảng**,
  không ghi lý do trong ⚙ (bỏ mục 3.5).
- CLI của máy anh đã đổi sang đăng nhập claude.ai (`claude auth login --claudeai`, gói Team).
- Đã làm `lib/usage.js` như mục 3. Snapshot có `usage`, `usagePlan` (true / false / null), `usageSource`; trang chỉ vẽ
  bảng khi `usagePlan === true` (server cũ không gửi trường này thì vẽ như trước). Bỏ đọc file `usage-quota` cũ.
- Định dạng `get_usage` thật: `rate_limits.five_hour = {utilization: 0–100 | null, resets_at: ISO | null, …}`.
- Đo thật trên máy anh: `get_usage` trả lời ~3 s, 5H 1 %, 7D 6 %; snapshot gửi `usageSource: "claude"`, bảng hiện
  trên tường.
