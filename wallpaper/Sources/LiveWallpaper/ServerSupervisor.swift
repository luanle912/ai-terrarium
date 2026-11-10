import Foundation

/// Giữ server terrarium (`node server.js`) chạy cùng app: mở app là đủ, không cần terminal hay Claude Code.
/// Cứ 10 giây hỏi thử URL; không ai trả lời thì tự chạy server của repo đã cài app (đường dẫn ghi trong Info.plist
/// lúc build). Server do app chạy mà chết thì bật lại, giãn dần tới 60 giây. Đã có server khác (plugin, chạy tay) thì
/// để yên. Thoát app chỉ tắt server do app chạy.
@MainActor
final class ServerSupervisor {
    enum State { case off, starting, owned, external, missingNode, failing }

    private(set) var state: State = .off { didSet { if state != oldValue { onStateChange?() } } }
    var onStateChange: (() -> Void)?

    private let url: URL
    private let node: String?
    private let script: String?
    private var process: Process?
    private var timer: Timer?
    private var stopping = false
    private var failures = 0
    private var nextStartAt = Date.distantPast
    private var probing = false

    private let checkInterval: TimeInterval = 10
    private let logFile = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Logs/LiveWallpaper-server.log")

    init(url: URL) {
        self.url = url
        let defaults = UserDefaults.standard, info = Bundle.main.infoDictionary ?? [:]
        script = defaults.string(forKey: "server") ?? info["TerrariumServer"] as? String
        node = Self.findNode(defaults.string(forKey: "node") ?? info["TerrariumNode"] as? String)
    }

    /// Chỉ trông server trên máy này.
    var isLocal: Bool { ["localhost", "127.0.0.1", "::1"].contains(url.host ?? "") }

    func start() {
        guard isLocal, script != nil else { return }
        check()
        timer = Timer.scheduledTimer(withTimeInterval: checkInterval, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.check() }
        }
    }

    /// Tắt server do app chạy (khi thoát app).
    func stop() {
        timer?.invalidate()
        timer = nil
        stopping = true
        if let process, process.isRunning { process.terminate() }
        process = nil
    }

    // MARK: -

    private func check() {
        if let process, process.isRunning {
            // Server của app đang chạy: đã trả lời thì coi như ổn, xoá đếm lỗi.
            probe { [weak self] up in
                guard let self, up else { return }
                self.state = .owned
                self.failures = 0
            }
            return
        }
        guard !probing else { return }
        probing = true
        probe { [weak self] up in
            guard let self else { return }
            self.probing = false
            if up { self.state = .external; return }
            self.launch()
        }
    }

    private func probe(_ done: @escaping @MainActor (Bool) -> Void) {
        var request = URLRequest(url: url)
        request.timeoutInterval = 2
        request.httpMethod = "HEAD"
        URLSession.shared.dataTask(with: request) { _, response, _ in
            let up = response is HTTPURLResponse
            DispatchQueue.main.async { MainActor.assumeIsolated { done(up) } }
        }.resume()
    }

    private func launch() {
        guard let script else { return }
        guard let node else { state = .missingNode; return }
        guard Date() >= nextStartAt else { state = .failing; return }

        let p = Process()
        p.executableURL = URL(fileURLWithPath: node)
        p.arguments = [script]
        p.currentDirectoryURL = URL(fileURLWithPath: script).deletingLastPathComponent()
        var env = ProcessInfo.processInfo.environment
        env["PORT"] = String(url.port ?? 4317)
        p.environment = env
        if let log = openLog() {
            p.standardOutput = log
            p.standardError = log
        }
        p.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async { MainActor.assumeIsolated { self?.exited(p) } }
        }
        do {
            try p.run()
            process = p
            state = .starting
        } catch {
            NSLog("LiveWallpaper: không chạy được server: \(error)")
            backOff()
        }
    }

    private func exited(_ p: Process) {
        guard process === p else { return }
        process = nil
        if stopping { return }
        backOff()
        // Bật lại ngay khi tới hạn, không đợi lượt hỏi kế tiếp.
        DispatchQueue.main.asyncAfter(deadline: .now() + max(0, nextStartAt.timeIntervalSinceNow) + 0.1) {
            [weak self] in MainActor.assumeIsolated { self?.check() }
        }
    }

    /// 3 s, 6 s, 12 s, … tối đa 60 s giữa hai lần bật lại.
    private func backOff() {
        failures += 1
        let wait = min(60, 3 * pow(2, Double(failures - 1)))
        nextStartAt = Date().addingTimeInterval(wait)
        state = .failing
    }

    private func openLog() -> FileHandle? {
        let fm = FileManager.default
        try? fm.createDirectory(at: logFile.deletingLastPathComponent(), withIntermediateDirectories: true)
        // Giữ log gọn: quá 1 MB thì bắt đầu lại.
        if let size = (try? fm.attributesOfItem(atPath: logFile.path))?[.size] as? Int, size > 1_000_000 {
            try? fm.removeItem(at: logFile)
        }
        if !fm.fileExists(atPath: logFile.path) { fm.createFile(atPath: logFile.path, contents: nil) }
        guard let handle = try? FileHandle(forWritingTo: logFile) else { return nil }
        handle.seekToEndOfFile()
        return handle
    }

    /// App mở từ Finder không có PATH của shell: dùng đường dẫn ghi lúc build, rồi tới các chỗ hay cài node.
    private static func findNode(_ recorded: String?) -> String? {
        let candidates = [recorded, "/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"].compactMap { $0 }
        return candidates.first { FileManager.default.isExecutableFile(atPath: $0) }
    }
}
