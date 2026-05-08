package com.securehttp

import android.content.Context
import android.util.Log
import com.google.android.gms.common.GooglePlayServicesNotAvailableException
import com.google.android.gms.common.GooglePlayServicesRepairableException
import com.google.android.gms.security.ProviderInstaller
import java.security.KeyStore
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

internal data class TlsProviderState(
    val providerInstallerAttempted: Boolean,
    val providerInstallerSucceeded: Boolean,
)

internal object TlsProviderSupport {
    private const val TAG = "TlsProviderSupport"

    @Volatile
    private var cachedState: TlsProviderState? = null

    fun ensureInstalled(context: Context): TlsProviderState {
        cachedState?.let { return it }

        synchronized(this) {
            cachedState?.let { return it }

            var providerInstallerAttempted = false
            var providerInstallerSucceeded = false

            try {
                providerInstallerAttempted = true
                ProviderInstaller.installIfNeeded(context)
                providerInstallerSucceeded = true
                Log.i(TAG, "ProviderInstaller completed successfully")
            } catch (e: GooglePlayServicesRepairableException) {
                Log.w(TAG, "ProviderInstaller repairable failure: ${e.message}")
            } catch (e: GooglePlayServicesNotAvailableException) {
                Log.w(TAG, "ProviderInstaller unavailable: ${e.message}")
            } catch (e: Exception) {
                Log.w(TAG, "ProviderInstaller failed: ${e.message}")
            }

            return TlsProviderState(
                providerInstallerAttempted = providerInstallerAttempted,
                providerInstallerSucceeded = providerInstallerSucceeded,
            ).also { cachedState = it }
        }
    }

    fun buildTrustManager(): X509TrustManager {
        val trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        trustManagerFactory.init(null as KeyStore?)
        return trustManagerFactory.trustManagers.first { it is X509TrustManager } as X509TrustManager
    }

    fun buildSslContext(trustManager: X509TrustManager): SSLContext {
        return SSLContext.getInstance("TLS").also {
            it.init(null, arrayOf(trustManager), null)
        }
    }
}
