package com.securehttp

import android.content.Context
import android.util.Log
import com.google.android.gms.common.GooglePlayServicesNotAvailableException
import com.google.android.gms.common.GooglePlayServicesRepairableException
import com.google.android.gms.security.ProviderInstaller
import org.conscrypt.Conscrypt
import java.security.KeyStore
import java.security.Security
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

internal data class TlsProviderState(
    val conscryptEnabled: Boolean,
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

            val conscryptEnabled = tryEnableConscrypt()

            return TlsProviderState(
                conscryptEnabled = conscryptEnabled,
                providerInstallerAttempted = providerInstallerAttempted,
                providerInstallerSucceeded = providerInstallerSucceeded,
            ).also { cachedState = it }
        }
    }

    fun buildTrustManager(useConscrypt: Boolean): X509TrustManager {
        if (useConscrypt && Conscrypt.isAvailable()) {
            try {
                val provider = Security.getProvider(Conscrypt.newProvider().name) ?: Conscrypt.newProvider()
                val trustManagerFactory = TrustManagerFactory.getInstance(
                    TrustManagerFactory.getDefaultAlgorithm(),
                    provider,
                )
                trustManagerFactory.init(null as KeyStore?)
                val trustManager = trustManagerFactory.trustManagers.firstOrNull { it is X509TrustManager }
                if (trustManager != null) {
                    Log.i(TAG, "Using Conscrypt trust manager")
                    return trustManager as X509TrustManager
                }
            } catch (e: Exception) {
                Log.w(TAG, "Conscrypt trust manager failed: ${e.message}")
            }
        }

        val trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        trustManagerFactory.init(null as KeyStore?)
        return trustManagerFactory.trustManagers.first { it is X509TrustManager } as X509TrustManager
    }

    fun buildSslContext(trustManager: X509TrustManager, useConscrypt: Boolean): SSLContext {
        if (useConscrypt && Conscrypt.isAvailable()) {
            try {
                val provider = Security.getProvider(Conscrypt.newProvider().name) ?: Conscrypt.newProvider()
                return SSLContext.getInstance("TLS", provider).also {
                    it.init(null, arrayOf(trustManager), null)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Conscrypt SSLContext failed, falling back: ${e.message}")
            }
        }

        return SSLContext.getInstance("TLS").also {
            it.init(null, arrayOf(trustManager), null)
        }
    }

    private fun tryEnableConscrypt(): Boolean {
        return try {
            val providerName = Conscrypt.newProvider().name
            val existing = Security.getProvider(providerName)

            if (existing == null) {
                Security.insertProviderAt(Conscrypt.newProvider(), 1)
                Log.i(TAG, "Conscrypt inserted as top security provider")
            } else {
                Security.removeProvider(providerName)
                Security.insertProviderAt(existing, 1)
                Log.i(TAG, "Conscrypt moved to top security provider slot")
            }

            true
        } catch (e: Exception) {
            Log.w(TAG, "Conscrypt activation failed: ${e.message}")
            false
        }
    }
}
