import AppKit
import WebKit

/// Live: mỗi màn hình một WKWebView ở tầng desktop, định kỳ chụp lại làm wallpaper hệ thống.
/// Tĩnh: chụp frame cuối, đặt làm wallpaper, đóng hẳn WebView để CPU/GPU về 0.
@MainActor
final class WallpaperController: NSObject, WKNavigationDelegate {
    enum State { case still, loading, live, unreachable }

    private(set) var state: State = .still { didSet { onStateChange?() } }
    var onStateChange: (() -> Void)?

    let url: URL
    private var windows: [WallpaperWindow] = []
    private var snapshotTimer: Timer?
    private var retryTimer: Timer?
    private var currentImages: [CGDirectDisplayID: URL] = [:]
    private let storage: URL

    /// Màn hình khoá hiện ảnh wallpaper, nên chụp mỗi phút để ảnh đó không cũ quá một phút.
    private let snapshotInterval: TimeInterval = 60
    /// Hạn cho một lượt chụp: quá hạn thì vẫn đi tiếp (đóng WebView), không treo.
    private let snapshotTimeout: TimeInterval = 3
    private let retryInterval: TimeInterval = 5
    private let firstSnapshotDelay: TimeInterval = 3

    init(url: URL) {
        self.url = url
        storage = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("LiveWallpaper", isDirectory: true)
        try? FileManager.default.createDirectory(at: storage, withIntermediateDirectories: true)
        super.init()
        loadExistingImages()
    }

    var isLiveMode: Bool { state != .still }

    // MARK: - Chuyển chế độ

    func goLive() {
        guard !isLiveMode else { return }
        state = .loading
        buildWindows()
        snapshotTimer = Timer.scheduledTimer(withTimeInterval: snapshotInterval, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.snapshot() }
        }
    }

    func goStill(waitForUpdate: Bool = true, completion: (() -> Void)? = nil) {
        guard isLiveMode else { completion?(); return }
        snapshotTimer?.invalidate()
        snapshotTimer = nil
        retryTimer?.invalidate()
        retryTimer = nil

        // Tách cửa sổ cũ ra ngay để nếu cắm sạc lại liền thì goLive dựng bộ mới, không đụng nhau.
        let old = windows
        windows = []
        state = .still
        snapshot(of: old, waitForUpdate: waitForUpdate) { [weak self] in
            self?.tearDown(old)
            completion?()
        }
    }

    func snapshot(completion: (() -> Void)? = nil) {
        snapshot(of: windows, completion: completion)
    }

    func reload() {
        for window in windows {
            if window.isLoaded { window.webView.reload() } else { window.webView.load(URLRequest(url: url)) }
        }
    }

    func screensChanged() {
        if isLiveMode {
            tearDown(windows)
            windows = []
            buildWindows()
        }
    }

    /// Wallpaper hệ thống được đặt riêng cho từng Space, nên khi sang Space khác thì áp lại ảnh mới nhất.
    func spaceChanged() {
        guard state == .still else { return }
        for screen in NSScreen.screens {
            guard let id = screen.displayID, let file = currentImages[id] else { continue }
            try? NSWorkspace.shared.setDesktopImageURL(file, for: screen, options: [:])
        }
    }

    // MARK: - Cửa sổ

    private func buildWindows() {
        windows = NSScreen.screens.map { screen in
            let window = WallpaperWindow(screen: screen)
            window.webView.navigationDelegate = self
            window.webView.load(URLRequest(url: url))
            return window
        }
    }

    private func tearDown(_ targets: [WallpaperWindow]) {
        for window in targets {
            window.webView.stopLoading()
            window.webView.navigationDelegate = nil
            window.orderOut(nil)
            window.close()
        }
    }

    private func window(for webView: WKWebView) -> WallpaperWindow? {
        windows.first { $0.webView === webView }
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let window = window(for: webView) else { return }
        window.isLoaded = true
        window.orderFrontRegardless()
        state = .live

        // Chụp sớm một lần để ảnh tĩnh không phải đợi tới lượt chụp định kỳ.
        DispatchQueue.main.asyncAfter(deadline: .now() + firstSnapshotDelay) { [weak self, weak window] in
            guard let self, let window, self.windows.contains(window) else { return }
            self.snapshot(of: [window], completion: nil)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        loadFailed(webView, error: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        loadFailed(webView, error: error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loadFailed(webView, error: nil)
    }

    /// Server chưa lên thì ẩn cửa sổ (wallpaper tĩnh lộ ra) và thử lại, không bao giờ hiện trang trắng.
    private func loadFailed(_ webView: WKWebView, error: Error?) {
        if let error = error as NSError?, error.domain == NSURLErrorDomain, error.code == NSURLErrorCancelled { return }
        guard let window = window(for: webView) else { return }
        window.isLoaded = false
        window.orderOut(nil)
        state = windows.contains(where: \.isLoaded) ? .live : .unreachable
        scheduleRetry()
    }

    private func scheduleRetry() {
        guard retryTimer == nil else { return }
        retryTimer = Timer.scheduledTimer(withTimeInterval: retryInterval, repeats: false) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.retryTimer = nil
                for window in self.windows where !window.isLoaded {
                    window.webView.load(URLRequest(url: self.url))
                }
            }
        }
    }

    // MARK: - Chụp & đặt wallpaper

    private func snapshot(of targets: [WallpaperWindow], waitForUpdate: Bool = true, completion: (() -> Void)?) {
        let ready = targets.filter(\.isLoaded)
        guard !ready.isEmpty else { completion?(); return }

        var finished = false
        let finish = {
            guard !finished else { return }
            finished = true
            completion?()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + snapshotTimeout) { finish() }

        let group = DispatchGroup()
        for window in ready {
            group.enter()
            let config = WKSnapshotConfiguration()
            config.afterScreenUpdates = waitForUpdate
            window.webView.takeSnapshot(with: config) { [weak self] image, _ in
                MainActor.assumeIsolated {
                    if let image { self?.setWallpaper(image, for: window.targetScreen) }
                    group.leave()
                }
            }
        }
        group.notify(queue: .main) { finish() }
    }

    private func setWallpaper(_ image: NSImage, for screen: NSScreen) {
        guard let id = screen.displayID,
              let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil),
              let data = NSBitmapImageRep(cgImage: cgImage).representation(using: .png, properties: [:]) else { return }

        // macOS cache wallpaper theo đường dẫn, nên mỗi lần chụp phải ghi ra một file mới.
        let stamp = Int(Date().timeIntervalSince1970 * 1000)
        let file = storage.appendingPathComponent("display-\(id)-\(stamp).png")
        do {
            try data.write(to: file)
            try NSWorkspace.shared.setDesktopImageURL(file, for: screen, options: [:])
        } catch {
            NSLog("LiveWallpaper: không đặt được wallpaper: \(error)")
            return
        }
        if let old = currentImages[id], old != file { try? FileManager.default.removeItem(at: old) }
        currentImages[id] = file
    }

    /// Giữ lại ảnh mới nhất của mỗi màn hình từ lần chạy trước, xoá phần còn lại.
    private func loadExistingImages() {
        let files = (try? FileManager.default.contentsOfDirectory(at: storage, includingPropertiesForKeys: nil)) ?? []
        var newest: [CGDirectDisplayID: (stamp: Int, url: URL)] = [:]
        for file in files where file.pathExtension == "png" {
            let parts = file.deletingPathExtension().lastPathComponent.split(separator: "-")
            guard parts.count == 3, parts[0] == "display",
                  let id = UInt32(parts[1]), let stamp = Int(parts[2]) else { continue }
            if let current = newest[id] {
                let loser = current.stamp >= stamp ? file : current.url
                try? FileManager.default.removeItem(at: loser)
                if current.stamp >= stamp { continue }
            }
            newest[id] = (stamp, file)
        }
        currentImages = newest.mapValues(\.url)
    }
}
