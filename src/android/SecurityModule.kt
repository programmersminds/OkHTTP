package com.securehttp

import android.content.Context
import com.facebook.react.bridge.*
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import java.security.cert.X509Certificate
import javax.net.ssl.X509TrustManager

class SecurityModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName() = "SecurityModule"
    
    @ReactMethod
    fun isRooted(promise: Promise) {
        try {
            val isRooted = checkRootAccess()
            promise.resolve(isRooted)
        } catch (e: Exception) {
            promise.reject("ROOT_CHECK_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun hasProxy(promise: Promise) {
        try {
            val hasProxy = checkProxySettings()
            promise.resolve(hasProxy)
        } catch (e: Exception) {
            promise.reject("PROXY_CHECK_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun isCertificateTampered(promise: Promise) {
        try {
            val tampered = checkCertificateTampering()
            promise.resolve(tampered)
        } catch (e: Exception) {
            promise.reject("CERT_CHECK_ERROR", e.message)
        }
    }
    
    private fun checkRootAccess(): Boolean {
        val paths = arrayOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su",
            "/su/bin/su"
        )
        
        return paths.any { java.io.File(it).exists() }
    }
    
    private fun checkProxySettings(): Boolean {
        val proxyHost = System.getProperty("http.proxyHost")
        val proxyPort = System.getProperty("http.proxyPort")
        return !proxyHost.isNullOrEmpty() || !proxyPort.isNullOrEmpty()
    }
    
    private fun checkCertificateTampering(): Boolean {
        try {
            val trustManager = javax.net.ssl.TrustManagerFactory
                .getInstance(javax.net.ssl.TrustManagerFactory.getDefaultAlgorithm())
            trustManager.init(null as java.security.KeyStore?)
            
            val x509TrustManager = trustManager.trustManagers
                .firstOrNull { it is X509TrustManager } as? X509TrustManager
            
            val acceptedIssuers = x509TrustManager?.acceptedIssuers ?: emptyArray()
            
            // Check for suspicious certificates
            return acceptedIssuers.any { cert ->
                cert.issuerDN.name.contains("Charles", ignoreCase = true) ||
                cert.issuerDN.name.contains("Fiddler", ignoreCase = true) ||
                cert.issuerDN.name.contains("Burp", ignoreCase = true) ||
                cert.issuerDN.name.contains("mitmproxy", ignoreCase = true)
            }
        } catch (e: Exception) {
            return false
        }
    }
}
