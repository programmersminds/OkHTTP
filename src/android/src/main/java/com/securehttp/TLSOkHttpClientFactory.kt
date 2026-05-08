package com.securehttp

import android.content.Context
import android.util.Log
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.ReactCookieJarContainer
import okhttp3.ConnectionSpec
import okhttp3.OkHttpClient
import okhttp3.TlsVersion
import org.conscrypt.Conscrypt
import java.security.KeyStore
import java.security.Security
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

/**
 * TLSOkHttpClientFactory
 *
 * Works correctly on ALL Android versions (API 21 / Android 5.0+).
 *
 * Why old devices failed with the previous trust-all approach:
 *   Android 5/6/7 ships an outdated CA bundle that doesn't include newer
 *   root CAs (e.g. Let's Encrypt ISRG Root X1). Bypassing validation hid
 *   the error but left every connection open to MITM interception.
 *
 * How this version fixes old devices properly:
 *   1. ProviderInstaller — patches the system TLS provider via Google Play
 *      Services. Fixes missing cipher suites on Android 5/6.
 *   2. Conscrypt — ships its own up-to-date CA bundle and TLS 1.3 stack,
 *      replacing the outdated system TLS on Android 5–9.
 *   3. Falls back gracefully if neither is available.
 *
 * Security: real certificate validation, no bypass, TLS 1.2+ only.
 */
class TLSOkHttpClientFactory(private val context: Context) : OkHttpClientFactory {

    /**
     * No-arg constructor for backwards compatibility — used when the app
     * registers this factory without passing a Context.
     */
    constructor() : this(getApplicationContext())

    override fun createNewNetworkModuleClient(): OkHttpClient {

        // Step 1 — Patch the system security provider via Google Play Services.
        // Fixes SSL handshake failures on Android 5/6 caused by outdated TLS.
        try {
            com.google.android.gms.security.ProviderInstaller.installIfNeeded(context)
        } catch (e: Exception) {
            Log.w(TAG, "ProviderInstaller unavailable: ${e.message}")
            // Conscrypt below handles this case
        }

        // Step 2 — Insert Conscrypt as the top security provider.
        // Conscrypt ships its own CA bundle, fixing old-device CA issues.
        val conscryptInstalled = try {
            Security.insertProviderAt(Conscrypt.newProvider(), 1)
            true
        } catch (e: Exception) {
            Log.w(TAG, "Conscrypt init failed: ${e.message}")
            false
        }

        // Step 3 — Build trust manager (Conscrypt's CA bundle preferred).
        val x509TrustManager = buildTrustManager(conscryptInstalled)

        // Step 4 — Build SSLContext.
        val sslContext = buildSSLContext(x509TrustManager, conscryptInstalled)

        // Step 5 — TLS 1.2 + 1.3 only, no cleartext.
        val tlsSpec = ConnectionSpec.Builder(ConnectionSpec.MODERN_TLS)
            .tlsVersions(TlsVersion.TLS_1_3, TlsVersion.TLS_1_2)
            .build()

        return OkHttpClient.Builder()
            .sslSocketFactory(sslContext.socketFactory, x509TrustManager)
            .connectionSpecs(listOf(tlsSpec))
            .cookieJar(ReactCookieJarContainer())
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    private fun buildTrustManager(useConscrypt: Boolean): X509TrustManager {
        if (useConscrypt && Conscrypt.isAvailable()) {
            try {
                val tmf = TrustManagerFactory.getInstance(
                    TrustManagerFactory.getDefaultAlgorithm(),
                    Conscrypt.newProvider()
                )
                tmf.init(null as KeyStore?)
                val tm = tmf.trustManagers.firstOrNull { it is X509TrustManager }
                if (tm != null) return tm as X509TrustManager
            } catch (e: Exception) {
                Log.w(TAG, "Conscrypt trust manager failed: ${e.message}")
            }
        }
        val tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        tmf.init(null as KeyStore?)
        return tmf.trustManagers.first { it is X509TrustManager } as X509TrustManager
    }

    private fun buildSSLContext(trustManager: X509TrustManager, useConscrypt: Boolean): SSLContext {
        if (useConscrypt) {
            try {
                return SSLContext.getInstance("TLS", Conscrypt.newProvider()).also {
                    it.init(null, arrayOf(trustManager), null)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Conscrypt SSLContext failed, using default: ${e.message}")
            }
        }
        return SSLContext.getInstance("TLS").also {
            it.init(null, arrayOf(trustManager), null)
        }
    }

    companion object {
        private const val TAG = "TLSOkHttpClientFactory"

        /**
         * Obtains the application Context without requiring it to be passed in.
         * Works on all Android versions via ActivityThread reflection.
         */
        fun getApplicationContext(): Context {
            return try {
                val activityThread = Class.forName("android.app.ActivityThread")
                val method = activityThread.getMethod("currentApplication")
                method.invoke(null) as Context
            } catch (e: Exception) {
                throw IllegalStateException("Cannot obtain application context", e)
            }
        }
    }
}
