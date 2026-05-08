package com.securehttp

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.network.OkHttpClientProvider
import com.facebook.react.uimanager.ViewManager

class SecureHttpPackage : ReactPackage {
    init {
        try {
            OkHttpClientProvider.setOkHttpClientFactory(TLSOkHttpClientFactory())
        } catch (_: Exception) {
            // If registration fails, React Native falls back to its default client.
        }
    }

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            TLSSecurityModule(reactContext),
            SecureHttpCryptoModule(reactContext),
            SecurityModule(reactContext),
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
