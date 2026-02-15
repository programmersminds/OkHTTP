import Foundation

@objc(SecureHttpCrypto)
class SecureHttpCrypto: NSObject {
  
  @objc
  func encrypt(_ plaintext: String, key: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let result = crypto_encrypt(plaintext, key)
    if let result = result {
      let encrypted = String(cString: result)
      crypto_free_string(result)
      resolver(encrypted)
    } else {
      rejecter("ENCRYPT_ERROR", "Encryption failed", nil)
    }
  }
  
  @objc
  func decrypt(_ ciphertext: String, key: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let result = crypto_decrypt(ciphertext, key)
    if let result = result {
      let decrypted = String(cString: result)
      crypto_free_string(result)
      resolver(decrypted)
    } else {
      rejecter("DECRYPT_ERROR", "Decryption failed", nil)
    }
  }
  
  @objc
  func sign(_ data: String, timestamp: Int64, key: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let result = crypto_sign(data, timestamp, key)
    let signature = String(cString: result)
    crypto_free_string(result)
    resolver(signature)
  }
  
  @objc
  func storeKey(_ key: String, value: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let success = crypto_store_key(key, value)
    resolver(success)
  }
  
  @objc
  func getKey(_ key: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let result = crypto_get_key(key)
    if let result = result {
      let value = String(cString: result)
      crypto_free_string(result)
      resolver(value)
    } else {
      resolver(nil)
    }
  }
  
  @objc
  func removeKey(_ key: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let success = crypto_remove_key(key)
    resolver(success)
  }
  
  @objc
  func clearStorage(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let success = crypto_clear_storage()
    resolver(success)
  }
  
  @objc
  func generateKey(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let result = crypto_generate_key()
    let key = String(cString: result)
    crypto_free_string(result)
    resolver(key)
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
