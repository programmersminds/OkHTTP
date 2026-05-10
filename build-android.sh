#!/bin/bash

# Build script for compiling Rust library for Android
# This script requires:
# - Rust installed with Android targets
# - Android NDK installed
# - ANDROID_NDK_HOME environment variable set

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RUST_DIR="$SCRIPT_DIR/rust-crypto"
OUTPUT_DIR="$SCRIPT_DIR/src/android/src/main/jniLibs"

# Android targets to build for
TARGETS=(
    "aarch64-linux-android"      # arm64-v8a
    "armv7-linux-androideabi"    # armeabi-v7a
    "i686-linux-android"         # x86
    "x86_64-linux-android"       # x86_64
)

# Function to get ABI directory from target
get_abi_dir() {
    case "$1" in
        "aarch64-linux-android") echo "arm64-v8a" ;;
        "armv7-linux-androideabi") echo "armeabi-v7a" ;;
        "i686-linux-android") echo "x86" ;;
        "x86_64-linux-android") echo "x86_64" ;;
        *) echo "unknown" ;;
    esac
}

# Function to find the correct clang binary for NDK 27+
find_clang_binary() {
    local target=$1
    local ndk_bin=$2
    
    # Try versioned binaries first (NDK 27+)
    for version in 35 34 33 32 31 30 29 28 27 26 25 24 23 22 21; do
        local versioned="${target}${version}-clang"
        if [ -f "$ndk_bin/$versioned" ]; then
            echo "$ndk_bin/$versioned"
            return 0
        fi
    done
    
    # Fall back to non-versioned (older NDK)
    if [ -f "$ndk_bin/${target}-clang" ]; then
        echo "$ndk_bin/${target}-clang"
        return 0
    fi
    
    echo ""
    return 1
}

# Check if ANDROID_NDK_HOME is set
if [ -z "$ANDROID_NDK_HOME" ]; then
    echo "Error: ANDROID_NDK_HOME environment variable not set"
    echo ""
    echo "Please set it to your Android NDK installation directory:"
    echo "  export ANDROID_NDK_HOME=/path/to/android-ndk-r25c"
    echo ""
    echo "Common locations:"
    echo "  - ~/Library/Android/sdk/ndk/25.2.9519653 (Android Studio default on macOS)"
    echo "  - ~/android-ndk-r25c (if downloaded manually)"
    echo ""
    exit 1
fi

# Verify NDK exists
if [ ! -d "$ANDROID_NDK_HOME" ]; then
    echo "Error: ANDROID_NDK_HOME directory does not exist: $ANDROID_NDK_HOME"
    exit 1
fi

# Verify NDK has the required toolchain
if [ ! -d "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt" ]; then
    echo "Error: NDK toolchain not found at: $ANDROID_NDK_HOME/toolchains/llvm/prebuilt"
    echo "This NDK installation may be incomplete or corrupted."
    exit 1
fi

# Detect NDK prebuilt platform (darwin-x86_64 for macOS, linux-x86_64 for Linux)
NDK_PREBUILT=""
if [ -d "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64" ]; then
    NDK_PREBUILT="darwin-x86_64"
elif [ -d "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64" ]; then
    NDK_PREBUILT="linux-x86_64"
else
    echo "Error: Could not find NDK prebuilt tools"
    echo "Available prebuilt directories:"
    ls "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/" 2>/dev/null || echo "  (none found)"
    exit 1
fi

NDK_BIN="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/$NDK_PREBUILT/bin"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Building Rust library for Android..."
echo "NDK Home: $ANDROID_NDK_HOME"
echo "NDK Prebuilt: $NDK_PREBUILT"
echo "Output: $OUTPUT_DIR"
echo ""

cd "$RUST_DIR"

# Build for each target
for target in "${TARGETS[@]}"; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Building for $target..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Find the correct clang binary
    CC_BIN=$(find_clang_binary "$target" "$NDK_BIN")
    if [ -z "$CC_BIN" ]; then
        echo "❌ Could not find clang compiler for $target"
        echo "   Checked in: $NDK_BIN"
        exit 1
    fi
    
    echo "Using compiler: $CC_BIN"
    
    # Set up NDK toolchain environment variables
    export CC="$CC_BIN"
    export AR="$NDK_BIN/llvm-ar"
    export CARGO_CFG_TARGET_OS=android
    
    # Set linker via environment variable (target-specific)
    # Convert target name to env var format (e.g., aarch64-linux-android -> CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER)
    target_upper=$(echo "$target" | tr '[:lower:]-' '[:upper:]_')
    eval "export CARGO_TARGET_${target_upper}_LINKER='$CC_BIN'"
    eval "export CARGO_TARGET_${target_upper}_AR='$NDK_BIN/llvm-ar'"
    
    # Build the library
    if ! cargo build --release --target "$target" 2>&1; then
        echo ""
        echo "❌ Failed to build for $target"
        echo ""
        echo "Troubleshooting:"
        echo "  1. Verify ANDROID_NDK_HOME is correct: $ANDROID_NDK_HOME"
        echo "  2. Check that Rust target is installed: rustup target list | grep $target"
        echo "  3. Try updating Rust: rustup update"
        exit 1
    fi
    
    # Copy the built library to the correct location
    abi=$(get_abi_dir "$target")
    mkdir -p "$OUTPUT_DIR/$abi"
    
    # Find and copy the .so file
    so_file=$(find "target/$target/release" -name "*.so" -o -name "*.a" | head -1)
    if [ -f "$so_file" ]; then
        cp "$so_file" "$OUTPUT_DIR/$abi/libsecure_http_crypto.so"
        echo "✓ Copied to $OUTPUT_DIR/$abi/libsecure_http_crypto.so"
    else
        echo "⚠ Warning: No .so file found for $target"
        echo "  Checked in: target/$target/release/"
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Build complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Native libraries are ready in:"
echo "  $OUTPUT_DIR"
echo ""
echo "Verify the build:"
echo "  ls -la $OUTPUT_DIR/*/libsecure_http_crypto.so"
echo ""
