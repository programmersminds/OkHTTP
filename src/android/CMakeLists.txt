cmake_minimum_required(VERSION 3.22.1)
project(secure_http_crypto)

# ---------------------------------------------------------------------------
# 16KB page-size alignment — required by Google Play for Android 15+ devices.
# Pass the flag only to the linker, not the compiler.
# ---------------------------------------------------------------------------
if(ANDROID)
    add_link_options("-Wl,-z,max-page-size=16384")
endif()

# ---------------------------------------------------------------------------
# Pre-built Rust shared library.
# Run scripts/build-android.sh first to populate jniLibs/<ABI>/.
# ---------------------------------------------------------------------------
add_library(secure_http_crypto SHARED IMPORTED)

set_target_properties(
    secure_http_crypto PROPERTIES
    IMPORTED_LOCATION
        "${CMAKE_CURRENT_SOURCE_DIR}/src/main/jniLibs/${ANDROID_ABI}/libsecure_http_crypto.so"
)

# ---------------------------------------------------------------------------
# Minimal JNI bridge — the Rust .so exposes all symbols directly via
# #[no_mangle] extern "C", so no C++ glue is needed.
# ---------------------------------------------------------------------------
add_library(secure_http_jni SHARED src/main/cpp/jni_bridge.cpp)

target_link_libraries(
    secure_http_jni
    secure_http_crypto
    android
    log
)

set_target_properties(
    secure_http_jni PROPERTIES
    LINK_FLAGS "-Wl,-z,max-page-size=16384"
)
