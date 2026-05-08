#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build-android.sh
#
# Compiles the Rust crypto library for all Android ABIs with 16KB page-size
# alignment, then copies the .so files into the jniLibs directory so the
# Android Gradle build can pick them up.
#
# Requirements:
#   - Rust toolchain (rustup)
#   - Android NDK (set ANDROID_NDK_HOME or NDK_HOME)
#   - cargo-ndk: cargo install cargo-ndk
#
# Usage:
#   bash scripts/build-android.sh
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUST_DIR="$REPO_ROOT/rust-crypto"
JNI_LIBS_DIR="$REPO_ROOT/src/android/src/main/jniLibs"

# ABIs to build — must match abiFilters in build.gradle
ABIS=("arm64-v8a" "x86_64")

# Rust targets corresponding to each ABI
declare -A ABI_TO_TARGET=(
    ["arm64-v8a"]="aarch64-linux-android"
    ["x86_64"]="x86_64-linux-android"
    ["armeabi-v7a"]="armv7-linux-androideabi"
    ["x86"]="i686-linux-android"
)

echo "==> Installing Rust Android targets..."
for abi in "${ABIS[@]}"; do
    target="${ABI_TO_TARGET[$abi]}"
    rustup target add "$target"
done

echo "==> Building Rust library with 16KB page-size alignment..."
cd "$RUST_DIR"

for abi in "${ABIS[@]}"; do
    target="${ABI_TO_TARGET[$abi]}"
    echo "    Building $abi ($target)..."

    # cargo-ndk handles NDK toolchain selection automatically.
    # The rustflags in Cargo.toml add -Wl,-z,max-page-size=16384.
    cargo ndk \
        --target "$target" \
        --platform 24 \
        -- build --release

    # Copy the .so to jniLibs
    OUT_DIR="$RUST_DIR/target/$target/release"
    DEST_DIR="$JNI_LIBS_DIR/$abi"
    mkdir -p "$DEST_DIR"
    cp "$OUT_DIR/libsecure_http_crypto.so" "$DEST_DIR/libsecure_http_crypto.so"

    echo "    Copied to $DEST_DIR/libsecure_http_crypto.so"

    # Verify 16KB alignment using readelf (part of Android NDK)
    if command -v readelf &>/dev/null; then
        ALIGNMENT=$(readelf -l "$DEST_DIR/libsecure_http_crypto.so" 2>/dev/null \
            | grep -E "LOAD.*0x[0-9a-f]+" \
            | awk '{print $NF}' \
            | head -1)
        echo "    ELF LOAD alignment: $ALIGNMENT"
        if [[ "$ALIGNMENT" == "0x4000" ]]; then
            echo "    ✅ 16KB page alignment confirmed"
        else
            echo "    ⚠️  Alignment is $ALIGNMENT — expected 0x4000 (16384)"
        fi
    fi
done

echo ""
echo "==> Build complete. .so files are in $JNI_LIBS_DIR"
echo ""
echo "    Next steps:"
echo "    1. Run your Android build: cd android && ./gradlew assembleRelease"
echo "    2. Verify with: python3 scripts/check-16kb-alignment.py <path-to-apk>"
