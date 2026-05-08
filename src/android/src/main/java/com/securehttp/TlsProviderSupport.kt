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

            var providerInstallerSucceeded = false
            try {
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

            val conscryptEnabled = try {
                val providerName = Conscrypt.newProvider().name
                val existingProvider = Security.getProvider(providerName)
                if (existingProvider == null) {
                    Security.insertProviderAt(Conscrypt.newProvider(), 1)
                } else {
                    Security.removeProvider(providerName)
                    Security.insertProviderAt(existingProvider, 1)
                }
                Log.i(TAG, "Conscrypt enabled")
                true
            } catch (e: Exception) {
                Log.w(TAG, "Conscrypt activation failed: ${e.message}")
                false
            }

            return TlsProviderState(
                conscryptEnabled = conscryptEnabled,
                providerInstallerSucceeded = providerInstallerSucceeded,
            ).also { cachedState = it }
        }
    }

    fun buildTrustManager(useConscrypt: Boolean): X509TrustManager {
        if (useConscrypt && Conscrypt.isAvailable()) {
            try {
                val provider = Security.getProvider(Conscrypt.newProvider().name) ?: Conscrypt.newProvider()
                val tmf = TrustManagerFactory.getInstance(
                    TrustManagerFactory.getDefaultAlgorithm(),
                    provider,
                )
                tmf.init(null as KeyStore?)
                val trustManager = tmf.trustManagers.firstOrNull { it is X509TrustManager }
                if (trustManager != null) return trustManager as X509TrustManager
            } catch (e: Exception) {
                Log.w(TAG, "Conscrypt trust manager failed: ${e.message}")
            }
        }

        val tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        tmf.init(null as KeyStore?)
        return tmf.trustManagers.first { it is X509TrustManager } as X509TrustManager
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
}
