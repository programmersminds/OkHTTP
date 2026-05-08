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

class SecureHttpCryptoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun getName() = "SecureHttpCryptoModule"

    // -------------------------------------------------------------------------
    // Crypto
    // -------------------------------------------------------------------------

    @ReactMethod
    fun encrypt(plaintext: String, key: String, promise: Promise) {
        scope.launch {
            try {
                val result = crypto_encrypt(plaintext, key)
                if (result != null) promise.resolve(result)
                else promise.reject("ENCRYPT_ERROR", "Encryption failed")
            } catch (e: Exception) { promise.reject("ENCRYPT_ERROR", e.message, e) }
        }
    }

    @ReactMethod
    fun decrypt(ciphertext: String, key: String, promise: Promise) {
        scope.launch {
            try {
                val result = crypto_decrypt(ciphertext, key)
                if (result != null) promise.resolve(result)
                else promise.reject("DECRYPT_ERROR", "Decryption failed")
            } catch (e: Exception) { promise.reject("DECRYPT_ERROR", e.message, e) }
        }
    }

    @ReactMethod
    fun sign(data: String, timestamp: Double, key: String, promise: Promise) {
        scope.launch {
            try {
                promise.resolve(crypto_sign(data, timestamp.toLong(), key))
            } catch (e: Exception) { promise.reject("SIGN_ERROR", e.message, e) }
        }
    }

    @ReactMethod
    fun storeKey(key: String, value: String, promise: Promise) {
        scope.launch {
            try { promise.resolve(crypto_store_key(key, value)) }
            catch (e: Exception) { promise.reject("STORE_ERROR", e.message, e) }
        }
    }

    @ReactMethod
    fun getKey(key: String, promise: Promise) {
        scope.launch {
            try { promise.resolve(crypto_get_key(key)) }
            catch (e: Exception) { promise.reject("GET_ERROR", e.message, e) }
        }
    }

    @ReactMethod
    fun removeKey(key: String, promise: Promise) {
        scope.launch {
            try { promise.resolve(crypto_remove_key(key)) }
            catch (e: Exception) { promise.reject("REMOVE_ERROR", e.message, e) }
        }
    }

    @ReactMethod
    fun clearStorage(promise: Promise) {
        scope.launch {
            try { promise.resolve(crypto_clear_storage()) }
            catch (e: Exception) { promise.reject("CLEAR_ERROR", e.message, e) }
        }
    }

    @ReactMethod
    fun generateKey(promise: Promise) {
        scope.launch {
            try {
                val result = crypto_generate_key()
                if (result != null) promise.resolve(result)
                else promise.reject("GENERATE_ERROR", "Key generation failed")
            } catch (e: Exception) { promise.reject("GENERATE_ERROR", e.message, e) }
        }
    }

    // -------------------------------------------------------------------------
    // HTTP client
    // -------------------------------------------------------------------------

    @ReactMethod
    fun httpClientInit(promise: Promise) {
        scope.launch {
            try { promise.resolve(http_client_init()) }
            catch (e: Exception) { promise.reject("HTTP_INIT_ERROR", e.message, e) }
        }
    }

    @ReactMethod
    fun httpExecuteRequest(configJson: String, requestJson: String, promise: Promise) {
        scope.launch {
            try {
                val result = http_execute_request(configJson, requestJson)
                if (result != null) promise.resolve(result)
                else promise.reject("HTTP_REQUEST_ERROR", "Request execution failed")
            } catch (e: Exception) { promise.reject("HTTP_REQUEST_ERROR", e.message, e) }
        }
    }

    @ReactMethod
    fun httpExecuteBatchRequests(configJson: String, requestsJson: String, promise: Promise) {
        scope.launch {
            try {
                val result = http_execute_batch_requests(configJson, requestsJson)
                if (result != null) promise.resolve(result)
                else promise.reject("HTTP_BATCH_ERROR", "Batch request failed")
            } catch (e: Exception) { promise.reject("HTTP_BATCH_ERROR", e.message, e) }
        }
    }

    @ReactMethod
    fun httpGetMetrics(endpoint: String, promise: Promise) {
        try { promise.resolve(http_get_metrics(endpoint)) }
        catch (e: Exception) { promise.reject("HTTP_METRICS_ERROR", e.message, e) }
    }

    @ReactMethod
    fun httpClearCache(promise: Promise) {
        try { promise.resolve(http_clear_cache()) }
        catch (e: Exception) { promise.reject("HTTP_CACHE_ERROR", e.message, e) }
    }

    @ReactMethod
    fun httpGetCacheStats(promise: Promise) {
        try { promise.resolve(http_get_cache_stats()) }
        catch (e: Exception) { promise.reject("HTTP_CACHE_ERROR", e.message, e) }
    }

    @ReactMethod
    fun httpWarmupConnections(baseUrlsJson: String, promise: Promise) {
        scope.launch {
            try { promise.resolve(http_warmup_connections(baseUrlsJson)) }
            catch (e: Exception) { promise.reject("HTTP_WARMUP_ERROR", e.message, e) }
        }
    }

    @Suppress("DEPRECATION")
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        scope.cancel()
    }

    // -------------------------------------------------------------------------
    // Native declarations — names MUST match Rust #[no_mangle] export names
    // exactly. The JVM resolves these by symbol name in the loaded .so.
    // -------------------------------------------------------------------------

    // Crypto symbols (from rust-crypto/src/lib.rs)
    private external fun crypto_encrypt(plaintext: String, key: String): String?
    private external fun crypto_decrypt(ciphertext: String, key: String): String?
    private external fun crypto_sign(data: String, timestamp: Long, key: String): String
    private external fun crypto_store_key(key: String, value: String): Boolean
    private external fun crypto_get_key(key: String): String?
    private external fun crypto_remove_key(key: String): Boolean
    private external fun crypto_clear_storage(): Boolean
    private external fun crypto_generate_key(): String?

    // HTTP client symbols (from rust-crypto/src/http_client.rs)
    private external fun http_client_init(): Boolean
    private external fun http_execute_request(configJson: String, requestJson: String): String?
    private external fun http_execute_batch_requests(configJson: String, requestsJson: String): String?
    private external fun http_get_metrics(endpoint: String): String?
    private external fun http_clear_cache(): Boolean
    private external fun http_get_cache_stats(): String?
    private external fun http_warmup_connections(baseUrlsJson: String): Boolean

    companion object {
        init {
            try {
                System.loadLibrary("secure_http_crypto")
            } catch (e: UnsatisfiedLinkError) {
                // Native module not linked — JS side falls back to fetch automatically.
                android.util.Log.w("SecureHttp", "Native library not found: ${e.message}")
            }
        }
    }
}
