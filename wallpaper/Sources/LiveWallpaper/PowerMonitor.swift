import AppKit
import IOKit.ps

/// Báo khi máy chuyển giữa "nên live" (cắm sạc, không bật Low Power Mode) và "nên ảnh tĩnh".
final class PowerMonitor {
    var onChange: ((Bool) -> Void)?

    private var runLoopSource: CFRunLoopSource?
    private var observers: [NSObjectProtocol] = []
    private var lastValue: Bool?

    var shouldBeLive: Bool {
        Self.isOnACPower() && !ProcessInfo.processInfo.isLowPowerModeEnabled
    }

    func start() {
        lastValue = shouldBeLive

        let context = Unmanaged.passUnretained(self).toOpaque()
        if let source = IOPSNotificationCreateRunLoopSource({ context in
            guard let context else { return }
            Unmanaged<PowerMonitor>.fromOpaque(context).takeUnretainedValue().evaluate()
        }, context)?.takeRetainedValue() {
            CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
            runLoopSource = source
        }

        observers.append(NotificationCenter.default.addObserver(
            forName: .NSProcessInfoPowerStateDidChange, object: nil, queue: .main
        ) { [weak self] _ in self?.evaluate() })

        // Trạng thái nguồn có thể đổi lúc máy đang ngủ.
        observers.append(NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didWakeNotification, object: nil, queue: .main
        ) { [weak self] _ in self?.evaluate() })
    }

    /// IOPS bắn notification cả khi % pin đổi, nên chỉ báo ra ngoài khi kết quả thực sự khác.
    private func evaluate() {
        let value = shouldBeLive
        guard value != lastValue else { return }
        lastValue = value
        onChange?(value)
    }

    static func isOnACPower() -> Bool {
        guard let info = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
              let type = IOPSGetProvidingPowerSourceType(info)?.takeUnretainedValue() else { return true }
        return (type as String) == kIOPMACPowerKey
    }
}
