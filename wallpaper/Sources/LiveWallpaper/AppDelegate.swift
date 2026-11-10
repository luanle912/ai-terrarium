import AppKit
import ServiceManagement

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    /// ?wallpaper=1: trang chỉ còn bầu trời và hòn đảo, không header / nút / panel (web/wallpaper-logic.js).
    private static let defaultURL = URL(string: "http://localhost:4317/?wallpaper=1")!

    private var controller: WallpaperController!
    private var server: ServerSupervisor!
    private let power = PowerMonitor()
    private let lock = LockMonitor()
    private var statusItem: NSStatusItem!
    private let statusLine = NSMenuItem(title: "", action: nil, keyEquivalent: "")
    private let serverLine = NSMenuItem(title: "", action: nil, keyEquivalent: "")
    private let loginItem = NSMenuItem(title: "Khởi động cùng máy", action: nil, keyEquivalent: "")

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Đổi URL: defaults write local.kham.livewallpaper url "http://localhost:xxxx/"
        let url = UserDefaults.standard.string(forKey: "url").flatMap(URL.init(string:)) ?? Self.defaultURL
        controller = WallpaperController(url: url)
        controller.onStateChange = { [weak self] in self?.refreshMenu() }
        // Mở app là đủ: app tự chạy server terrarium nếu chưa có ai chạy (ServerSupervisor).
        server = ServerSupervisor(url: url)
        server.onStateChange = { [weak self] in self?.refreshMenu() }
        setupMenu()
        server.start()

        power.onChange = { [weak self] _ in self?.reevaluate() }
        lock.onChange = { [weak self] _ in self?.reevaluate() }
        power.start()
        lock.start()
        reevaluate()

        NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
        ) { [weak self] _ in MainActor.assumeIsolated { self?.controller.screensChanged() } }
        NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.activeSpaceDidChangeNotification, object: nil, queue: .main
        ) { [weak self] _ in MainActor.assumeIsolated { self?.controller.spaceChanged() } }
    }

    /// Live khi cắm sạc, không bật Low Power Mode và màn hình không khoá.
    private func reevaluate() {
        apply(live: power.shouldBeLive && !lock.isLocked)
    }

    private func apply(live: Bool) {
        // Lúc khoá cửa sổ bị che có thể không vẽ thêm khung nào: chụp khung đã có, không đợi vẽ lại.
        if live { controller.goLive() } else { controller.goStill(waitForUpdate: !lock.isLocked) }
        refreshMenu()
    }

    // MARK: - Menu bar

    private func setupMenu() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        let menu = NSMenu()
        statusLine.isEnabled = false
        menu.addItem(statusLine)
        serverLine.isEnabled = false
        menu.addItem(serverLine)
        menu.addItem(.separator())
        menu.addItem(item("Tải lại trang", #selector(reload), "r"))
        menu.addItem(item("Chụp làm wallpaper ngay", #selector(snapshotNow), "s"))
        menu.addItem(item("Mở trong trình duyệt", #selector(openInBrowser), "o"))
        menu.addItem(.separator())
        loginItem.target = self
        loginItem.action = #selector(toggleLaunchAtLogin)
        menu.addItem(loginItem)
        menu.addItem(.separator())
        menu.addItem(item("Thoát", #selector(quit), "q"))
        statusItem.menu = menu
        refreshMenu()
    }

    private func item(_ title: String, _ action: Selector, _ key: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        return item
    }

    private func refreshMenu() {
        guard statusItem != nil else { return }
        let (text, symbol): (String, String) = switch controller.state {
        case .still: lock.isLocked
            ? ("Ảnh tĩnh (đang khoá màn hình)", "lock.fill")
            : ("Ảnh tĩnh (đang dùng pin)", "photo")
        case .loading: ("Đang tải \(controller.url.absoluteString)…", "hourglass")
        case .live: ("Live · \(controller.url.absoluteString)", "play.rectangle.fill")
        case .unreachable: ("Không kết nối được server, đang thử lại…", "exclamationmark.triangle")
        }
        statusLine.title = text
        serverLine.isHidden = !server.isLocal
        serverLine.title = switch server.state {
        case .off: "Server: chưa kiểm tra"
        case .starting: "Server: đang khởi động…"
        case .owned: "Server: do app chạy"
        case .external: "Server: đã có sẵn (chạy ngoài app)"
        case .missingNode: "Server: không tìm thấy node"
        case .failing: "Server: lỗi, đang bật lại…"
        }
        statusItem.button?.image = NSImage(systemSymbolName: symbol, accessibilityDescription: text)
        loginItem.state = SMAppService.mainApp.status == .enabled ? .on : .off
    }

    // MARK: - Actions

    @objc private func reload() { controller.reload() }

    @objc private func snapshotNow() { controller.snapshot() }

    /// Trình duyệt mở trang thường (bỏ ?wallpaper) để còn header, cài đặt và panel.
    @objc private func openInBrowser() {
        guard var parts = URLComponents(url: controller.url, resolvingAgainstBaseURL: false) else {
            NSWorkspace.shared.open(controller.url)
            return
        }
        let kept = (parts.queryItems ?? []).filter { $0.name != "wallpaper" }
        parts.queryItems = kept.isEmpty ? nil : kept
        NSWorkspace.shared.open(parts.url ?? controller.url)
    }

    @objc private func toggleLaunchAtLogin() {
        do {
            if SMAppService.mainApp.status == .enabled {
                try SMAppService.mainApp.unregister()
            } else {
                try SMAppService.mainApp.register()
            }
        } catch {
            NSAlert(error: error).runModal()
        }
        refreshMenu()
    }

    /// Thoát cũng chụp frame cuối trước, để wallpaper còn lại khớp với trang vừa hiển thị.
    @objc private func quit() {
        controller.goStill { [weak self] in
            self?.server.stop()
            NSApp.terminate(nil)
        }
    }

    /// Thoát kiểu khác (đăng xuất, tắt máy) cũng tắt server do app chạy.
    func applicationWillTerminate(_ notification: Notification) {
        server?.stop()
    }
}
