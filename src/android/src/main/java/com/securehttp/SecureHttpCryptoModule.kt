package com.securehttp

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.concurrent.Executors

class SecureHttpCryptoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val httpExecutor = Executors.newCachedThreadPool()

    override fun getName() = "SecureHttpCryptoModule"

    @ReactMethod
    fun encrypt(plaintext: String, key: String, promise: Promise) {
        coroutineScope.launch {
            try {
                val result = nativeEncrypt(plaintext, key)
                if (result != null) {
                    promise.resolve(result)
                } else {
                    promise.reject("ENCRYPT_ERROR", "Encryption failed")
                }
            } catch (e: Exception) {
                promise.reject("ENCRYPT_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun decrypt(ciphertext: String, key: String, promise: Promise) {
        coroutineScope.launch {
            try {
                val result = nativeDecrypt(ciphertext, key)
                if (result != null) {
                    promise.resolve(result)
                } else {
                    promise.reject("DECRYPT_ERROR", "Decryption failed")
                }
            } catch (e: Exception) {
                promise.reject("DECRYPT_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun sign(data: String, timestamp: Double, key: String, promise: Promise) {
        coroutineScope.launch {
            try {
                val result = nativeSign(data, timestamp.toLong(), key)
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("SIGN_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun storeKey(key: String, value: String, promise: Promise) {
        coroutineScope.launch {
            try {
                val success = nativeStoreKey(key, value)
                promise.resolve(success)
            } catch (e: Exception) {
                promise.reject("STORE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun getKey(key: String, promise: Promise) {
        coroutineScope.launch {
            try {
                val result = nativeGetKey(key)
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("GET_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun removeKey(key: String, promise: Promise) {
        coroutineScope.launch {
            try {
                val success = nativeRemoveKey(key)
                promise.resolve(success)
            } catch (e: Exception) {
                promise.reject("REMOVE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun clearStorage(promise: Promise) {
        coroutineScope.launch {
            try {
                val success = nativeClearStorage()
                promise.resolve(success)
            } catch (e: Exception) {
                promise.reject("CLEAR_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun generateKey(promise: Promise) {
        coroutineScope.launch {
            try {
                val result = nativeGenerateKey()
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("GENERATE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun httpClientInit(promise: Promise) {
        try {
            val result = nativeHttpClientInit()
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("HTTP_INIT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun httpExecuteRequest(configJson: String, requestJson: String, promise: Promise) {
        coroutineScope.launch {
            try {
                val result = nativeHttpExecuteRequest(configJson, requestJson)
                if (result != null) {
                    promise.resolve(result)
                } else {
                    promise.reject("HTTP_REQUEST_ERROR", "Request execution failed")
                }
            } catch (e: Exception) {
                promise.reject("HTTP_REQUEST_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun httpExecuteBatchRequests(configJson: String, requestsJson: String, promise: Promise) {
        coroutineScope.launch {
            try {
                val result = nativeHttpExecuteBatchRequests(configJson, requestsJson)
                if (result != null) {
                    promise.resolve(result)
                } else {
                    promise.reject("HTTP_BATCH_ERROR", "Batch request execution failed")
                }
            } catch (e: Exception) {
                promise.reject("HTTP_BATCH_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun httpGetMetrics(endpoint: String, promise: Promise) {
        try {
            val result = nativeHttpGetMetrics(endpoint)
            if (result != null) {
                promise.resolve(result)
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.reject("HTTP_METRICS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun httpClearCache(promise: Promise) {
        try {
            val result = nativeHttpClearCache()
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("HTTP_CACHE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun httpGetCacheStats(promise: Promise) {
        try {
            val result = nativeHttpGetCacheStats()
            if (result != null) {
                promise.resolve(result)
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.reject("HTTP_CACHE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun httpWarmupConnections(baseUrlsJson: String, promise: Promise) {
        try {
            val result = nativeHttpWarmupConnections(baseUrlsJson)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("HTTP_WARMUP_ERROR", e.message, e)
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        coroutineScope.cancel()
        httpExecutor.shutdown()
    }

    private external fun nativeEncrypt(plaintext: String, key: String): String?
    private external fun nativeDecrypt(ciphertext: String, key: String): String?
    private external fun nativeSign(data: String, timestamp: Long, key: String): String
    private external fun nativeStoreKey(key: String, value: String): Boolean
    private external fun nativeGetKey(key: String): String?
    private external fun nativeRemoveKey(key: String): Boolean
    private external fun nativeClearStorage(): Boolean
    private external fun nativeGenerateKey(): String
    private external fun nativeHttpClientInit(): Boolean
    private external fun nativeHttpExecuteRequest(configJson: String, requestJson: String): String?
    private external fun nativeHttpExecuteBatchRequests(configJson: String, requestsJson: String): String?
    private external fun nativeHttpGetMetrics(endpoint: String): String?
    private external fun nativeHttpClearCache(): Boolean
    private external fun nativeHttpGetCacheStats(): String?
    private external fun nativeHttpWarmupConnections(baseUrlsJson: String): Boolean

    companion object {
        init {
            try {
                System.loadLibrary("secure_http_crypto")
            } catch (e: UnsatisfiedLinkError) {
                // Log the error for debugging
                android.util.Log.w("SecureHttpCrypto", "Failed to load native library: ${e.message}")
            }
        }
    }
}
