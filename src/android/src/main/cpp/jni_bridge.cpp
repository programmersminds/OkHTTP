/**
 * jni_bridge.cpp
 *
 * Minimal stub that satisfies CMake's requirement for at least one source file.
 * The actual JNI symbols are exported directly from the Rust .so via
 * #[no_mangle] extern "C" functions — no C++ glue code is needed.
 *
 * The -Wl,-z,max-page-size=16384 linker flag applied in CMakeLists.txt
 * ensures this translation unit (and the linked Rust .so) meet Google Play's
 * 16KB page-alignment requirement for Android 15+ devices.
 */

// Intentionally empty — all symbols come from libsecure_http_crypto.so
