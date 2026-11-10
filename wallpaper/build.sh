#!/usr/bin/env bash
# ./build.sh          → build ra build/LiveWallpaper.app
# ./build.sh install  → build, copy vào ~/Applications rồi mở app
set -euo pipefail
cd "$(dirname "$0")"

swift build -c release

APP=build/LiveWallpaper.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp .build/release/LiveWallpaper "$APP/Contents/MacOS/"
cp Resources/Info.plist "$APP/Contents/"
codesign --force --sign - "$APP"
echo "Built $APP"

if [[ "${1:-}" == "install" ]]; then
    pkill -x LiveWallpaper || true
    mkdir -p ~/Applications
    rm -rf ~/Applications/LiveWallpaper.app
    cp -R "$APP" ~/Applications/
    open ~/Applications/LiveWallpaper.app
    echo "Installed ~/Applications/LiveWallpaper.app"
fi
