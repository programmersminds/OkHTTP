package com.securehttp

import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.*
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureHttpCryptoModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SecureHttpCrypto"

    private val STORAGE_KEY_ALIAS = "SecureHttpStorageKey"
    private val ANDROID_KEYSTORE = "AndroidKeyStore"
    private val TRANSFORMATION = "AES/GCM/NoPadding"
    private val GCM_TAG_LENGTH = 128
    private val PREFS_NAME = "SecureHttpStorage"

    private val prefs: SharedPreferences by lazy {
        reactContext.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (keyStore.containsAlias(STORAGE_KEY_ALIAS)) {
            return (keyStore.getEntry(STORAGE_KEY_ALIAS, null) as KeyStore.SecretKeyEntry).secretKey
        }
        val keyGen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        keyGen.init(
            KeyGenParameterSpec.Builder(
               STORAGE_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return keyGen.generateKey()
    }

    private fun encrypt(plaintext: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val iv = cipher.iv
        val encrypted = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        val combined = iv + encrypted
        return Base64.encodeToString(combined, Base64.NO_WRAP)
    }

    private fun decrypt(encoded: String): String {
        val combined = Base64.decode(encoded, Base64.NO_WRAP)
        val iv = combined.copyOfRange(0, 12)
        val encrypted = combined.copyOfRange(12, combined.size)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(GCM_TAG_LENGTH, iv))
        return String(cipher.doFinal(encrypted), Charsets.UTF_8)
    }

    @ReactMethod
    fun storeKey(key: String, value: String, promise: Promise) {
        try {
            val success = prefs.edit().putString(key, encrypt(value)).commit()
            if (success) promise.resolve(true)
            else promise.reject("STORE_ERROR", "Failed to commit to SharedPreferences")
        } catch (e: Exception) {
            promise.reject("STORE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getKey(key: String, promise: Promise) {
        try {
            val stored = prefs.getString(key, null)
            if (stored == null) {
                promise.resolve(null)
            } else {
                promise.resolve(decrypt(stored))
            }
        } catch (e: Exception) {
            promise.reject("GET_ERROR", e.message)
        }
    }

    @ReactMethod
    fun removeKey(key: String, promise: Promise) {
        try {
            prefs.edit().remove(key).commit()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("REMOVE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun clearStorage(promise: Promise) {
        try {
            prefs.edit().clear().commit()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_ERROR", e.message)
        }
    }

    @ReactMethod
    fun generateKey(promise: Promise) {
        try {
            getOrCreateKey()
            promise.resolve(STORAGE_KEY_ALIAS)
        } catch (e: Exception) {
            promise.reject("GENERATE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun encrypt(plaintext: String, key: String, promise: Promise) {
        try {
            promise.resolve(encrypt(plaintext))
        } catch (e: Exception) {
            promise.reject("ENCRYPT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun decrypt(ciphertext: String, key: String, promise: Promise) {
        try {
            promise.resolve(decrypt(ciphertext))
        } catch (e: Exception) {
            promise.reject("DECRYPT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun sign(data: String, timestamp: Double, key: String, promise: Promise) {
        try {
            val mac = javax.crypto.Mac.getInstance("HmacSHA256")
            val secretKey = javax.crypto.spec.SecretKeySpec(key.toByteArray(), "HmacSHA256")
            mac.init(secretKey)
            val signature = Base64.encodeToString(
                mac.doFinal("$data:${timestamp.toLong()}".toByteArray()),
                Base64.NO_WRAP
            )
            promise.resolve(signature)
        } catch (e: Exception) {
            promise.reject("SIGN_ERROR", e.message)
        }
    }
}
