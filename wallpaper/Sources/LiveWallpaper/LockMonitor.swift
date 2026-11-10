import Foundation

/// Báo khi màn hình khoá / mở khoá. Màn hình khoá của macOS phủ lên mọi cửa sổ app, nên lúc khoá WebView chạy cũng không
/// ai thấy: AppDelegate chụp khung cuối làm wallpaper (màn hình khoá hiện ảnh này) rồi đóng WebView.
final class LockMonitor {
    var onChange: ((Bool) -> Void)?
    private(set) var isLocked = false
    private var observers: [NSObjectProtocol] = []

    func start() {
        let center = DistributedNotificationCenter.default()
        observers.append(center.addObserver(
            forName: Notification.Name("com.apple.screenIsLocked"), object: nil, queue: .main
        ) { [weak self] _ in self?.set(true) })
        observers.append(center.addObserver(
            forName: Notification.Name("com.apple.screenIsUnlocked"), object: nil, queue: .main
        ) { [weak self] _ in self?.set(false) })
    }

    private func set(_ locked: Bool) {
        guard locked != isLocked else { return }
        isLocked = locked
        onChange?(locked)
    }
}
