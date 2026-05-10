# JNI Function Naming Fix

## Problem
The Android app was crashing with the following error:
```
java.lang.UnsatisfiedLinkError: No implementation found for boolean com.securehttp.SecureHttpCryptoModule.http_client_init() 
(tried Java_com_securehttp_SecureHttpCryptoModule_http_1client_1init and Java_com_securehttp_SecureHttpCryptoModule_http_1client_1init__)
```

## Root Cause
The Rust native library was exporting JNI functions with incorrect naming conventions. JNI requires functions to follow a specific naming pattern:
```
Java_<package>_<class>_<method>
```

Where underscores in the method name are replaced with `_1`.

The Rust code was exporting functions like:
- `http_client_init()` 
- `crypto_encrypt()`

But the Kotlin code was trying to call them via JNI with the full Java class path, which requires the functions to be named:
- `Java_com_securehttp_SecureHttpCryptoModule_http_1client_1init`
- `Java_com_securehttp_SecureHttpCryptoModule_crypto_1encrypt`

## Solution
Updated `/rust-crypto/src/lib.rs` to use proper JNI naming conventions for all exported functions:

### Before:
```rust
#[no_mangle]
pub extern "C" fn http_client_init() -> bool {
    true
}
```

### After:
```rust
#[no_mangle]
pub extern "C" fn Java_com_securehttp_SecureHttpCryptoModule_http_1client_1init(
    _env: *mut std::ffi::c_void,
    _class: *mut std::ffi::c_void,
) -> bool {
    true
}
```

All functions were updated to include:
1. Full JNI naming convention with package and class path
2. JNI environment pointer (`_env`) parameter
3. JNI class pointer (`_class`) parameter

## Functions Updated
- `crypto_init` → `Java_com_securehttp_SecureHttpCryptoModule_crypto_1init`
- `crypto_encrypt` → `Java_com_securehttp_SecureHttpCryptoModule_crypto_1encrypt`
- `crypto_decrypt` → `Java_com_securehttp_SecureHttpCryptoModule_crypto_1decrypt`
- `crypto_sign` → `Java_com_securehttp_SecureHttpCryptoModule_crypto_1sign`
- `crypto_store_key` → `Java_com_securehttp_SecureHttpCryptoModule_crypto_1store_1key`
- `crypto_get_key` → `Java_com_securehttp_SecureHttpCryptoModule_crypto_1get_1key`
- `crypto_remove_key` → `Java_com_securehttp_SecureHttpCryptoModule_crypto_1remove_1key`
- `crypto_clear_storage` → `Java_com_securehttp_SecureHttpCryptoModule_crypto_1clear_1storage`
- `crypto_generate_key` → `Java_com_securehttp_SecureHttpCryptoModule_crypto_1generate_1key`
- `crypto_verify_integrity` → `Java_com_securehttp_SecureHttpCryptoModule_crypto_1verify_1integrity`
- `crypto_free_string` → `Java_com_securehttp_SecureHttpCryptoModule_crypto_1free_1string`
- `http_client_init` → `Java_com_securehttp_SecureHttpCryptoModule_http_1client_1init`
- `http_execute_request` → `Java_com_securehttp_SecureHttpCryptoModule_http_1execute_1request`
- `http_execute_batch_requests` → `Java_com_securehttp_SecureHttpCryptoModule_http_1execute_1batch_1requests`
- `http_get_metrics` → `Java_com_securehttp_SecureHttpCryptoModule_http_1get_1metrics`
- `http_clear_cache` → `Java_com_securehttp_SecureHttpCryptoModule_http_1clear_1cache`
- `http_get_cache_stats` → `Java_com_securehttp_SecureHttpCryptoModule_http_1get_1cache_1stats`
- `http_warmup_connections` → `Java_com_securehttp_SecureHttpCryptoModule_http_1warmup_1connections`
- `http_free_string` → `Java_com_securehttp_SecureHttpCryptoModule_http_1free_1string`

## Rebuild Steps
The native library was rebuilt for arm64-v8a (the architecture used by the test device):

```bash
export ANDROID_NDK_HOME=/Users/osarinmwiannoel/Library/Android/sdk/ndk/27.1.12297006
export CC=$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android35-clang
export AR=$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/llvm-ar
export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER=$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android35-clang

cd rust-crypto
cargo build --release --target aarch64-linux-android
```

The resulting library was copied to:
```
src/android/src/main/jniLibs/arm64-v8a/libsecure_http_crypto.so
```

## Verification
The JNI functions are now properly exported in the library:
```
$ nm src/android/src/main/jniLibs/arm64-v8a/libsecure_http_crypto.so | grep "Java_com_securehttp"
00000000000116d8 T Java_com_securehttp_SecureHttpCryptoModule_crypto_1clear_1storage
000000000001198c T Java_com_securehttp_SecureHttpCryptoModule_crypto_1decrypt
0000000000011e78 T Java_com_securehttp_SecureHttpCryptoModule_crypto_1encrypt
...
0000000000013ae8 T Java_com_securehttp_SecureHttpCryptoModule_http_1client_1init
```

## Next Steps
1. Rebuild the Android app with the updated native library
2. Test the app on the device to verify the `UnsatisfiedLinkError` is resolved
3. Consider building for additional architectures (armv7, x86, x86_64) if needed

## References
- [JNI Naming Conventions](https://docs.oracle.com/javase/8/docs/technotes/guides/jni/spec/design.html#resolving_native_method_names)
- [Android NDK JNI Documentation](https://developer.android.com/training/articles/on-device-debugging)
