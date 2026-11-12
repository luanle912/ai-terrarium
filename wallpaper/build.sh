#!/usr/bin/env bash
# ./build.sh          → build ra build/LiveWallpaper.app
# ./build.sh install  → build, copy vào ~/Applications rồi mở app (app tự chạy server.js của repo này)
set -euo pipefail
cd "$(dirname "$0")"

swift build -c release

APP=build/LiveWallpaper.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp .build/release/LiveWallpaper "$APP/Contents/MacOS/"
cp Resources/Info.plist "$APP/Contents/"
# App mở từ Finder không có PATH của shell: ghi sẵn đường dẫn node và server.js của repo này để app tự chạy server
# (ServerSupervisor.swift). Cài lại từ thư mục nào thì app chạy server của thư mục đó.
SERVER="$(cd .. && pwd)/server.js"
NODE="$(command -v node || true)"
PB=/usr/libexec/PlistBuddy
$PB -c "Add :TerrariumServer string $SERVER" "$APP/Contents/Info.plist"
if [[ -n "$NODE" ]]; then
    $PB -c "Add :TerrariumNode string $NODE" "$APP/Contents/Info.plist"
else
    echo "warning: node not found in PATH; the app will look in /opt/homebrew/bin and /usr/local/bin"
fi
codesign --force --sign - "$APP"
echo "Built $APP"

if [[ "${1:-}" == "install" ]]; then
    # Thoát đàng hoàng để app kịp tắt server do nó chạy; pkill chỉ khi app không trả lời.
    if pgrep -x LiveWallpaper >/dev/null; then osascript -e 'quit app "LiveWallpaper"' >/dev/null 2>&1 || true; fi
    for _ in 1 2 3 4 5 6 7 8 9 10; do pgrep -x LiveWallpaper >/dev/null || break; sleep 0.5; done
    pkill -x LiveWallpaper || true
    mkdir -p ~/Applications
    rm -rf ~/Applications/LiveWallpaper.app
    cp -R "$APP" ~/Applications/
    open ~/Applications/LiveWallpaper.app
    echo "Installed ~/Applications/LiveWallpaper.app"
fi
