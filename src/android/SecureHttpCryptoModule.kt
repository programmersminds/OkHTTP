package com.securehttp

import com.facebook.react.bridge.*

class SecureHttpCryptoModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName() = "SecureHttpCrypto"
    
    @ReactMethod
    fun encrypt(plaintext: String, key: String, promise: Promise) {
        try {
            val result = nativeEncrypt(plaintext, key)
            if (result != null) {
                promise.resolve(result)
            } else {
                promise.reject("ENCRYPT_ERROR", "Encryption failed")
            }
        } catch (e: Exception) {
            promise.reject("ENCRYPT_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun decrypt(ciphertext: String, key: String, promise: Promise) {
        try {
            val result = nativeDecrypt(ciphertext, key)
            if (result != null) {
                promise.resolve(result)
            } else {
                promise.reject("DECRYPT_ERROR", "Decryption failed")
            }
        } catch (e: Exception) {
            promise.reject("DECRYPT_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun sign(data: String, timestamp: Double, key: String, promise: Promise) {
        try {
            val result = nativeSign(data, timestamp.toLong(), key)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SIGN_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun storeKey(key: String, value: String, promise: Promise) {
        try {
            val success = nativeStoreKey(key, value)
            promise.resolve(success)
        } catch (e: Exception) {
            promise.reject("STORE_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun getKey(key: String, promise: Promise) {
        try {
            val result = nativeGetKey(key)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun removeKey(key: String, promise: Promise) {
        try {
            val success = nativeRemoveKey(key)
            promise.resolve(success)
        } catch (e: Exception) {
            promise.reject("REMOVE_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun clearStorage(promise: Promise) {
        try {
            val success = nativeClearStorage()
            promise.resolve(success)
        } catch (e: Exception) {
            promise.reject("CLEAR_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun generateKey(promise: Promise) {
        try {
            val result = nativeGenerateKey()
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GENERATE_ERROR", e.message)
        }
    }
    
    private external fun nativeEncrypt(plaintext: String, key: String): String?
    private external fun nativeDecrypt(ciphertext: String, key: String): String?
    private external fun nativeSign(data: String, timestamp: Long, key: String): String
    private external fun nativeStoreKey(key: String, value: String): Boolean
    private external fun nativeGetKey(key: String): String?
    private external fun nativeRemoveKey(key: String): Boolean
    private external fun nativeClearStorage(): Boolean
    private external fun nativeGenerateKey(): String
    
    companion object {
        init {
            System.loadLibrary("secure_http_crypto")
        }
    }
}
