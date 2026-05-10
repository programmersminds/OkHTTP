# Android Native Library Build Guide

The React Native Secure HTTP library includes a high-performance Rust HTTP client that must be compiled to native Android libraries (.so files).

## Prerequisites

1. **Rust installed** with Android targets:
   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```

2. **Android NDK installed** (version 21 or later recommended)
   - Download from: https://developer.android.com/ndk/downloads
   - Or install via Android Studio: Tools → SDK Manager → SDK Tools → NDK

3. **Set ANDROID_NDK_HOME environment variable**:
   ```bash
   export ANDROID_NDK_HOME=/path/to/android-ndk-r25c
   ```
   
   Add to your shell profile (~/.zshrc, ~/.bash_profile, etc.) to make it permanent:
   ```bash
   echo 'export ANDROID_NDK_HOME=/path/to/android-ndk-r25c' >> ~/.zshrc
   ```

## Building the Native Library

### Option 1: Automatic Build Script (Recommended)

```bash
cd /path/to/react-native-secure-http
chmod +x build-android.sh
./build-android.sh
```

This will:
- Compile the Rust library for all Android targets (arm64-v8a, armeabi-v7a, x86, x86_64)
- Place the compiled .so files in `src/android/src/main/jniLibs/`
- Ready for inclusion in your React Native app

### Option 2: Manual Build

If the script doesn't work, you can build manually:

```bash
cd rust-crypto

# Build for each target
cargo build --release --target aarch64-linux-android
cargo build --release --target armv7-linux-androideabi
cargo build --release --target i686-linux-android
cargo build --release --target x86_64-linux-android

# Copy the .so files to the correct locations
mkdir -p ../src/android/src/main/jniLibs/arm64-v8a
mkdir -p ../src/android/src/main/jniLibs/armeabi-v7a
mkdir -p ../src/android/src/main/jniLibs/x86
mkdir -p ../src/android/src/main/jniLibs/x86_64

cp target/aarch64-linux-android/release/libsecure_http_crypto.so ../src/android/src/main/jniLibs/arm64-v8a/
cp target/armv7-linux-androideabi/release/libsecure_http_crypto.so ../src/android/src/main/jniLibs/armeabi-v7a/
cp target/i686-linux-android/release/libsecure_http_crypto.so ../src/android/src/main/jniLibs/x86/
cp target/x86_64-linux-android/release/libsecure_http_crypto.so ../src/android/src/main/jniLibs/x86_64/
```

## Verifying the Build

After building, verify the .so files are in place:

```bash
ls -la src/android/src/main/jniLibs/*/libsecure_http_crypto.so
```

You should see output like:
```
src/android/src/main/jniLibs/arm64-v8a/libsecure_http_crypto.so
src/android/src/main/jniLibs/armeabi-v7a/libsecure_http_crypto.so
src/android/src/main/jniLibs/x86/libsecure_http_crypto.so
src/android/src/main/jniLibs/x86_64/libsecure_http_crypto.so
```

## Troubleshooting

### "ANDROID_NDK_HOME not set"
Set the environment variable:
```bash
export ANDROID_NDK_HOME=/path/to/ndk
```

### "Rust target not installed"
Install the missing target:
```bash
rustup target add aarch64-linux-android
```

### "cargo build fails with linker errors"
Ensure your NDK version matches your Rust setup. Try updating:
```bash
rustup update
```

### "No .so file found"
Check the build output for errors. The .so file should be in:
```
rust-crypto/target/{target}/release/libsecure_http_crypto.so
```

## Integration with React Native App

Once the .so files are built and placed in `src/android/src/main/jniLibs/`, they will be automatically included when you build your React Native app.

In your app's `android/settings.gradle`:
```gradle
include ':react-native-secure-http'
project(':react-native-secure-http').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-secure-http/src/android')
```

In your app's `android/app/build.gradle`:
```gradle
dependencies {
    implementation project(':react-native-secure-http')
}
```

## Continuous Integration

For CI/CD pipelines, add the build step before building your React Native app:

```bash
# In your CI script
cd node_modules/react-native-secure-http
./build-android.sh
cd ../..
# Then build your React Native app normally
```

## Performance Notes

- **Release builds** are optimized with LTO (Link Time Optimization)
- **Build time**: ~2-5 minutes depending on your machine
- **Library size**: ~2-3 MB per architecture (total ~8-12 MB for all architectures)
- **Runtime performance**: 50,000+ requests/second

## Support

If you encounter issues:
1. Check that ANDROID_NDK_HOME is correctly set
2. Verify Rust targets are installed: `rustup target list | grep android`
3. Check NDK version compatibility
4. Review build output for specific error messages
