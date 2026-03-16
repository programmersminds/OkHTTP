import Foundation

@objc(SecureHttpCrypto)
class SecureHttpCrypto: NSObject {

  override init() {
    super.init()
    crypto_init()
  }

  @objc
  func encrypt(_ plaintext: String, key: String, resolver resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    guard let result = crypto_encrypt(plaintext, key) else {
      reject("ENCRYPT_ERROR", "Encryption failed", nil)
      return
    }
    let encrypted = String(cString: result)
    crypto_free_string(result)
    resolve(encrypted)
  }

  @objc
  func decrypt(_ ciphertext: String, key: String, resolver resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    guard let result = crypto_decrypt(ciphertext, key) else {
      reject("DECRYPT_ERROR", "Decryption failed", nil)
      return
    }
    let decrypted = String(cString: result)
    crypto_free_string(result)
    resolve(decrypted)
  }

  @objc
  func sign(_ data: String, timestamp: Int64, key: String, resolver resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    guard let result = crypto_sign(data, timestamp, key) else {
      reject("SIGN_ERROR", "Signing failed", nil)
      return
    }
    let signature = String(cString: result)
    crypto_free_string(result)
    resolve(signature)
  }

  @objc
  func storeKey(_ key: String, value: String, resolver resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    resolve(crypto_store_key(key, value))
  }

  @objc
  func getKey(_ key: String, resolver resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    guard let result = crypto_get_key(key) else {
      resolve(nil)
      return
    }
    let value = String(cString: result)
    crypto_free_string(result)
    resolve(value)
  }

  @objc
  func removeKey(_ key: String, resolver resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    resolve(crypto_remove_key(key))
  }

  @objc
  func clearStorage(_ resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    resolve(crypto_clear_storage())
  }

  @objc
  func generateKey(_ resolve: @escaping (Any?) -> Void, rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    guard let result = crypto_generate_key() else {
      reject("KEYGEN_ERROR", "Key generation failed", nil)
      return
    }
    let key = String(cString: result)
    crypto_free_string(result)
    resolve(key)
  }

  @objc
  static func requiresMainQueueSetup() -> Bool { return false }
}
