import Foundation

@objc(SecurityModule)
class SecurityModule: NSObject {

  @objc
  func isRooted(_ resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    resolve(checkJailbreak())
  }

  @objc
  func hasProxy(_ resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    resolve(checkProxySettings())
  }

  @objc
  func isCertificateTampered(_ resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    resolve(checkCertificateTampering())
  }

  private func checkJailbreak() -> Bool {
    let paths = [
      "/Applications/Cydia.app",
      "/Library/MobileSubstrate/MobileSubstrate.dylib",
      "/bin/bash",
      "/usr/sbin/sshd",
      "/etc/apt",
      "/private/var/lib/apt/",
      "/private/var/lib/cydia",
      "/private/var/stash"
    ]
    for path in paths {
      if FileManager.default.fileExists(atPath: path) { return true }
    }
    let testPath = "/private/jailbreak.txt"
    do {
      try "test".write(toFile: testPath, atomically: true, encoding: .utf8)
      try FileManager.default.removeItem(atPath: testPath)
      return true
    } catch {
      return false
    }
  }

  private func checkProxySettings() -> Bool {
    guard let proxySettings = CFNetworkCopySystemProxySettings()?.takeRetainedValue() as? [String: Any] else {
      return false
    }
    return proxySettings["HTTPProxy"] as? String != nil || proxySettings["HTTPSProxy"] as? String != nil
  }

  private func checkCertificateTampering() -> Bool {
    return false
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
