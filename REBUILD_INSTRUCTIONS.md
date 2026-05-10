# Rebuilding the Native Library

## Quick Rebuild (arm64-v8a only)

If you only need to rebuild for the primary architecture (arm64-v8a):

```bash
cd rust-crypto

# Set up environment variables
export ANDROID_NDK_HOME=/Users/osarinmwiannoel/Library/Android/sdk/ndk/27.1.12297006
export CC=$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android35-clang
export AR=$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/llvm-ar
export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER=$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android35-clang

# Build
cargo build --release --target aarch64-linux-android

# Copy to jniLibs
cp target/aarch64-linux-android/release/libsecure_http_crypto.so ../src/android/src/main/jniLibs/arm64-v8a/
```

## Full Rebuild (All Architectures)

To rebuild for all supported architectures, use the provided build script:

```bash
# Ensure ANDROID_NDK_HOME is set
export ANDROID_NDK_HOME=/Users/osarinmwiannoel/Library/Android/sdk/ndk/27.1.12297006

# Run the build script
bash build-android.sh
```

The script will build for:
- `aarch64-linux-android` → `arm64-v8a`
- `armv7-linux-androideabi` → `armeabi-v7a`
- `i686-linux-android` → `x86`
- `x86_64-linux-android` → `x86_64`

## Troubleshooting

### Issue: "failed to find tool aarch64-linux-android-clang"

**Solution:** Ensure ANDROID_NDK_HOME is set correctly and the NDK is installed:

```bash
# Check if NDK exists
ls $ANDROID_NDK_HOME/toolchains/llvm/prebuilt/

# Should show: darwin-x86_64 (on macOS) or linux-x86_64 (on Linux)
```

### Issue: Build fails for armv7-linux-androideabi

**Solution:** This is a known issue with some NDK versions. You can skip this architecture if not needed:

```bash
# Build only arm64-v8a and x86_64
export ANDROID_NDK_HOME=/Users/osarinmwiannoel/Library/Android/sdk/ndk/27.1.12297006

cd rust-crypto

# arm64-v8a
export CC=$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android35-clang
export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER=$CC
cargo build --release --target aarch64-linux-android
cp target/aarch64-linux-android/release/libsecure_http_crypto.so ../src/android/src/main/jniLibs/arm64-v8a/

# x86_64
export CC=$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/x86_64-linux-android35-clang
export CARGO_TARGET_X86_64_LINUX_ANDROID_LINKER=$CC
cargo build --release --target x86_64-linux-android
mkdir -p ../src/android/src/main/jniLibs/x86_64
cp target/x86_64-linux-android/release/libsecure_http_crypto.so ../src/android/src/main/jniLibs/x86_64/
```

### Issue: "Rust target not installed"

**Solution:** Install the required Rust targets:

```bash
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add i686-linux-android
rustup target add x86_64-linux-android
```

## Verifying the Build

After building, verify the JNI functions are properly exported:

```bash
# Check for JNI functions
nm src/android/src/main/jniLibs/arm64-v8a/libsecure_http_crypto.so | grep "Java_com_securehttp"

# Should show output like:
# 00000000000116d8 T Java_com_securehttp_SecureHttpCryptoModule_crypto_1clear_1storage
# 0000000000013ae8 T Java_com_securehttp_SecureHttpCryptoModule_http_1client_1init
# ...
```

## Building on Different Platforms

### macOS
```bash
export ANDROID_NDK_HOME=~/Library/Android/sdk/ndk/27.1.12297006
bash build-android.sh
```

### Linux
```bash
export ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006
bash build-android.sh
```

### Windows (WSL)
```bash
export ANDROID_NDK_HOME=/mnt/c/Users/YourUsername/AppData/Local/Android/Sdk/ndk/27.1.12297006
bash build-android.sh
```

## Cleaning Build Artifacts

To clean up build artifacts and rebuild from scratch:

```bash
cd rust-crypto
cargo clean
cargo build --release --target aarch64-linux-android
```

## Next Steps

After rebuilding:
1. Rebuild the Android app: `cd android && ./gradlew build`
2. Deploy to device: `./gradlew installDebug`
3. Test the app to verify the native library is working correctly
