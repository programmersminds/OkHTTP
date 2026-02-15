import Foundation

@objc(SecurityModule)
class SecurityModule: NSObject {
  
  @objc
  func isRooted(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let isJailbroken = checkJailbreak()
    resolver(isJailbroken)
  }
  
  @objc
  func hasProxy(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let hasProxy = checkProxySettings()
    resolver(hasProxy)
  }
  
  @objc
  func isCertificateTampered(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let tampered = checkCertificateTampering()
    resolver(tampered)
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
      if FileManager.default.fileExists(atPath: path) {
        return true
      }
    }
    
    // Check if can write to system
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
    
    let httpProxy = proxySettings["HTTPProxy"] as? String
    let httpsProxy = proxySettings["HTTPSProxy"] as? String
    
    return httpProxy != nil || httpsProxy != nil
  }
  
  private func checkCertificateTampering() -> Bool {
    // Check for common MITM proxy certificates
    let suspiciousIssuers = ["Charles", "Fiddler", "Burp", "mitmproxy"]
    
    // This is a simplified check - in production, implement proper certificate pinning
    return false
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
