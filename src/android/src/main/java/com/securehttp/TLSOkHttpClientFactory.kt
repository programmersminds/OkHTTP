package com.securehttp

import android.content.Context
import android.util.Log
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.ConnectionSpec
import okhttp3.OkHttpClient
import okhttp3.TlsVersion
import java.util.concurrent.TimeUnit

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
        val providerState = TlsProviderSupport.ensureInstalled(context)
        val trustManager = TlsProviderSupport.buildTrustManager(providerState.conscryptEnabled)
        val sslContext = TlsProviderSupport.buildSslContext(trustManager, providerState.conscryptEnabled)
        val tlsSpecs = buildConnectionSpecs(providerState.conscryptEnabled)

        Log.i(
            TAG,
            "Creating RN OkHttp client: conscrypt=${providerState.conscryptEnabled}, " +
                "providerInstaller=${providerState.providerInstallerSucceeded}"
        )

        return OkHttpClientProvider.createClientBuilder(context)
            .sslSocketFactory(sslContext.socketFactory, trustManager)
            .connectionSpecs(tlsSpecs)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    private fun buildConnectionSpecs(useConscrypt: Boolean): List<ConnectionSpec> {
        val primarySpec = ConnectionSpec.Builder(ConnectionSpec.MODERN_TLS)
            .tlsVersions(TlsVersion.TLS_1_2)
            .apply {
                if (useConscrypt) {
                    tlsVersions(TlsVersion.TLS_1_3, TlsVersion.TLS_1_2)
                }
            }
            .build()

        val compatibilitySpec = ConnectionSpec.Builder(ConnectionSpec.COMPATIBLE_TLS)
            .tlsVersions(TlsVersion.TLS_1_2)
            .build()

        return listOf(primarySpec, compatibilitySpec)
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
