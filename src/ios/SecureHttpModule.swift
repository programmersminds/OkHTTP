import Foundation

@objc(SecureHttpModule)
class SecureHttpModule: NSObject {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func updateSecurityProvider(_ resolve: @escaping RCTPromiseResolveBlock,
                              rejecter reject: @escaping RCTPromiseRejectBlock) {
    // Check iOS version for TLS 1.3 support
    if #available(iOS 12.2, *) {
      resolve("iOS uses native NSURLSession with TLS 1.3")
    } else {
      resolve("iOS uses native NSURLSession with TLS 1.2")
    }
  }
  
  @objc
  func checkSecurityProviders(_ resolve: @escaping RCTPromiseResolveBlock,
                              rejecter reject: @escaping RCTPromiseRejectBlock) {
    let result: [String: Any] = [
      "topProvider": "NSURLSession",
      "allProviders": ["NSURLSession", "SecureTransport"]
    ]
    resolve(result)
  }
  
  @objc
  func testTLS13Support(_ resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    var tlsVersion = "TLS 1.2"
    if #available(iOS 12.2, *) {
      tlsVersion = "TLS 1.3"
    }
    
    let result: [String: Any] = [
      "conscryptInstalled": false,
      "topProvider": "NSURLSession",
      "tlsVersion": tlsVersion
    ]
    resolve(result)
  }
  
  @objc
  func forceTLS13(_ resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 12.2, *) {
      resolve("iOS natively supports TLS 1.3 (iOS 12.2+)")
    } else {
      resolve("iOS version supports TLS 1.2. Upgrade to iOS 12.2+ for TLS 1.3")
    }
  }
}
