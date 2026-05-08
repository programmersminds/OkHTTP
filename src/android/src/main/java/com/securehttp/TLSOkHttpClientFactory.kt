package com.securehttp

import android.content.Context
import android.util.Log
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.CipherSuite
import okhttp3.ConnectionSpec
import okhttp3.OkHttpClient
import okhttp3.TlsVersion
import java.util.concurrent.TimeUnit

class TLSOkHttpClientFactory(private val context: Context) : OkHttpClientFactory {
    constructor() : this(getApplicationContext())

    override fun createNewNetworkModuleClient(): OkHttpClient {
        val providerState = TlsProviderSupport.ensureInstalled(context)
        val trustManager = TlsProviderSupport.buildTrustManager(providerState.conscryptEnabled)
        val sslContext = TlsProviderSupport.buildSslContext(trustManager, providerState.conscryptEnabled)

        Log.i(
            TAG,
            "Creating RN OkHttp client: conscrypt=${providerState.conscryptEnabled}, " +
                "providerInstaller=${providerState.providerInstallerSucceeded}"
        )

        return OkHttpClientProvider.createClientBuilder(context)
            .sslSocketFactory(sslContext.socketFactory, trustManager)
            .connectionSpecs(buildConnectionSpecs(providerState.conscryptEnabled))
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    private fun buildConnectionSpecs(useConscrypt: Boolean): List<ConnectionSpec> {
        val modernSpec = ConnectionSpec.Builder(ConnectionSpec.MODERN_TLS)
            .tlsVersions(
                *if (useConscrypt) {
                    arrayOf(TlsVersion.TLS_1_3, TlsVersion.TLS_1_2)
                } else {
                    arrayOf(TlsVersion.TLS_1_2)
                }
            )
            .cipherSuites(
                CipherSuite.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
                CipherSuite.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
                CipherSuite.TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA,
                CipherSuite.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA,
                CipherSuite.TLS_RSA_WITH_AES_256_GCM_SHA384,
                CipherSuite.TLS_RSA_WITH_AES_128_GCM_SHA256,
            )
            .build()

        val compatibilitySpec = ConnectionSpec.Builder(ConnectionSpec.COMPATIBLE_TLS)
            .tlsVersions(TlsVersion.TLS_1_2)
            .cipherSuites(
                CipherSuite.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
                CipherSuite.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
                CipherSuite.TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA,
                CipherSuite.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA,
                CipherSuite.TLS_RSA_WITH_AES_256_GCM_SHA384,
                CipherSuite.TLS_RSA_WITH_AES_128_GCM_SHA256,
            )
            .build()

        return listOf(modernSpec, compatibilitySpec)
    }

    companion object {
        private const val TAG = "TLSOkHttpClientFactory"

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
