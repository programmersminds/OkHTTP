import Foundation

@objc(SecureHttpCrypto)
class SecureHttpCrypto: NSObject {

  @objc
  func encrypt(_ plaintext: String, key: String, resolver resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    let result = crypto_encrypt(plaintext, key)
    if let result = result {
      let encrypted = String(cString: result)
      crypto_free_string(result)
      resolve(encrypted)
    } else {
      reject("ENCRYPT_ERROR", "Encryption failed", nil)
    }
  }

  @objc
  func decrypt(_ ciphertext: String, key: String, resolver resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    let result = crypto_decrypt(ciphertext, key)
    if let result = result {
      let decrypted = String(cString: result)
      crypto_free_string(result)
      resolve(decrypted)
    } else {
      reject("DECRYPT_ERROR", "Decryption failed", nil)
    }
  }

  @objc
  func sign(_ data: String, timestamp: Int64, key: String, resolver resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    let result = crypto_sign(data, timestamp, key)
    let signature = String(cString: result)
    crypto_free_string(result)
    resolve(signature)
  }

  @objc
  func storeKey(_ key: String, value: String, resolver resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    let success = crypto_store_key(key, value)
    resolve(success)
  }

  @objc
  func getKey(_ key: String, resolver resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    let result = crypto_get_key(key)
    if let result = result {
      let value = String(cString: result)
      crypto_free_string(result)
      resolve(value)
    } else {
      resolve(nil)
    }
  }

  @objc
  func removeKey(_ key: String, resolver resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    let success = crypto_remove_key(key)
    resolve(success)
  }

  @objc
  func clearStorage(_ resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    let success = crypto_clear_storage()
    resolve(success)
  }

  @objc
  func generateKey(_ resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    let result = crypto_generate_key()
    let key = String(cString: result)
    crypto_free_string(result)
    resolve(key)
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
