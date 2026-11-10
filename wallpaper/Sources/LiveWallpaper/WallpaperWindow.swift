import AppKit
import WebKit

/// Cửa sổ không viền nằm ở tầng desktop: trên ảnh nền, dưới icon, có mặt ở mọi Space, click xuyên qua.
final class WallpaperWindow: NSWindow {
    let targetScreen: NSScreen
    let webView: WKWebView
    var isLoaded = false

    init(screen: NSScreen) {
        targetScreen = screen
        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = []
        webView = WKWebView(frame: NSRect(origin: .zero, size: screen.frame.size), configuration: config)
        webView.autoresizingMask = [.width, .height]

        super.init(contentRect: screen.frame, styleMask: .borderless, backing: .buffered, defer: false)

        level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))
        collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenNone]
        ignoresMouseEvents = true
        isOpaque = true
        backgroundColor = .black
        hasShadow = false
        isReleasedWhenClosed = false
        contentView = webView
        setFrame(screen.frame, display: false)
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

extension NSScreen {
    var displayID: CGDirectDisplayID? {
        (deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value
    }
}
