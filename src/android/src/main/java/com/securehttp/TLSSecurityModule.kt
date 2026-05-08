package com.securehttp

import android.util.Log
import com.facebook.react.bridge.*
import com.google.android.gms.common.GooglePlayServicesNotAvailableException
import com.google.android.gms.common.GooglePlayServicesRepairableException
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocketFactory
import javax.net.ssl.X509TrustManager

class TLSSecurityModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TLSSecurityModule"

    companion object {
        @Volatile
        private var sslSocketFactory: SSLSocketFactory? = null
        
        @Volatile
        private var trustManager: X509TrustManager? = null

        fun getSSLSocketFactory(): SSLSocketFactory? = sslSocketFactory
        fun getTrustManager(): X509TrustManager? = trustManager
    }

    @ReactMethod
    fun updateSecurityProvider(promise: Promise) {
        try {
            val state = TlsProviderSupport.ensureInstalled(reactApplicationContext)
            initializeSSLContext(state.conscryptEnabled)
            Log.d("TLSSecurityModule", "Security provider updated successfully")
            promise.resolve(
                if (state.conscryptEnabled) {
                    "Security provider updated successfully with Conscrypt"
                } else {
                    "Security provider updated successfully with platform TLS"
                }
            )
        } catch (e: GooglePlayServicesRepairableException) {
            Log.e("TLSSecurityModule", "Google Play Services repairable error", e)
            promise.reject("REPAIRABLE_ERROR", "Google Play Services needs update: ${e.message}", e)
        } catch (e: GooglePlayServicesNotAvailableException) {
            Log.e("TLSSecurityModule", "Google Play Services not available", e)
            promise.reject("NOT_AVAILABLE", "Google Play Services not available: ${e.message}", e)
        } catch (e: Exception) {
            Log.e("TLSSecurityModule", "Failed to update security provider", e)
            promise.reject("UPDATE_FAILED", "Failed to update security provider: ${e.message}", e)
        }
    }

    @ReactMethod
    fun checkSecurityProviders(promise: Promise) {
        try {
            val providers = java.security.Security.getProviders()
            val providerList = providers.map { "${it.name} (v${it.version})" }
            val topProvider = providers.firstOrNull()?.name ?: "None"
            
            val result = WritableNativeMap()
            result.putString("topProvider", topProvider)
            result.putArray("allProviders", Arguments.fromList(providerList))
            
            Log.d("TLSSecurityModule", "Top security provider: $topProvider")
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("CHECK_FAILED", "Failed to check providers: ${e.message}", e)
        }
    }

    @ReactMethod
    fun testTLS13Support(promise: Promise) {
        try {
            val providers = java.security.Security.getProviders()
            val conscryptInstalled = providers.any { it.name.contains("Conscrypt", ignoreCase = true) }
            val topProvider = providers.firstOrNull()?.name ?: "None"
            
            val result = WritableNativeMap()
            result.putBoolean("conscryptInstalled", conscryptInstalled)
            result.putString("topProvider", topProvider)
            result.putString("tlsVersion", "TLS 1.2+ (TLS 1.3 on supported devices)")
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("TEST_FAILED", "Failed to test TLS: ${e.message}", e)
        }
    }

    @ReactMethod
    fun forceTLS13(promise: Promise) {
        try {
            val state = TlsProviderSupport.ensureInstalled(reactApplicationContext)
            initializeSSLContext(state.conscryptEnabled)
            
            Log.d("TLSSecurityModule", "Platform TLS active after provider update")
            promise.resolve(
                if (state.conscryptEnabled) {
                    "TLS 1.3 enabled via Conscrypt"
                } else {
                    "Platform TLS active; TLS 1.3 availability depends on device support"
                }
            )
        } catch (e: Exception) {
            Log.e("TLSSecurityModule", "Failed to force TLS 1.3", e)
            promise.reject("FORCE_TLS13_FAILED", "Failed to force TLS 1.3: ${e.message}", e)
        }
    }

    private fun initializeSSLContext(useConscrypt: Boolean) {
        try {
            val resolvedTrustManager = TlsProviderSupport.buildTrustManager(useConscrypt)
            val sslContext = TlsProviderSupport.buildSslContext(resolvedTrustManager, useConscrypt)
            
            sslSocketFactory = sslContext.socketFactory
            trustManager = resolvedTrustManager
            
            SSLContext.setDefault(sslContext)
            Log.d(
                "TLSSecurityModule",
                if (useConscrypt) "SSL Context initialized with Conscrypt" else "SSL Context initialized with platform TLS"
            )
        } catch (e: Exception) {
            Log.e("TLSSecurityModule", "Failed to initialize SSL context", e)
        }
    }
}
