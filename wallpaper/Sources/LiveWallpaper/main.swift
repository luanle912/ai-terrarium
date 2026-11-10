import AppKit

MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.accessory)
    // SIGTERM (pkill, đăng xuất) mặc định giết app ngay, bỏ qua applicationWillTerminate, nên server do app chạy bị bỏ
    // mồ côi. Bắt nó và thoát như bấm Thoát.
    signal(SIGTERM, SIG_IGN)
    let term = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
    term.setEventHandler { NSApp.terminate(nil) }
    term.resume()
    withExtendedLifetime(term) { app.run() }
}
