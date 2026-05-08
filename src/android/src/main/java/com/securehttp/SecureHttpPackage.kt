package com.securehttp

import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.network.OkHttpClientProvider
import com.facebook.react.uimanager.ViewManager

class SecureHttpPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        installTlsClientFactoryIfNeeded(reactContext)

        return listOf(
            TLSSecurityModule(reactContext),
            SecureHttpCryptoModule(reactContext),
            SecurityModule(reactContext),
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }

    companion object {
        private const val TAG = "SecureHttpPackage"

        @Volatile
        private var tlsClientFactoryInstalled = false

        private fun installTlsClientFactoryIfNeeded(reactContext: ReactApplicationContext) {
            if (tlsClientFactoryInstalled) return

            synchronized(this) {
                if (tlsClientFactoryInstalled) return

                val appContext = reactContext.applicationContext
                    ?: throw IllegalStateException("Application context is unavailable")

                OkHttpClientProvider.setOkHttpClientFactory(TLSOkHttpClientFactory(appContext))
                tlsClientFactoryInstalled = true
                Log.i(TAG, "Registered TLS OkHttp client factory for React Native networking")
            }
        }
    }
}
