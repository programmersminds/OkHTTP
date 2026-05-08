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
#   - Android NDK (detected automatically — see NDK detection section below)
#   - cargo-ndk (optional but preferred): cargo install cargo-ndk
#
# Usage:
#   bash scripts/build-android.sh
#
# Override NDK:
#   ANDROID_NDK_HOME=/path/to/ndk bash scripts/build-android.sh
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUST_DIR="$REPO_ROOT/rust-crypto"
JNI_LIBS_DIR="$REPO_ROOT/src/android/src/main/jniLibs"

# ABIs to build — must match abiFilters in build.gradle
ABIS="arm64-v8a x86_64"

# ---------------------------------------------------------------------------
# Helper: map ABI → Rust target triple
# ---------------------------------------------------------------------------
abi_to_target() {
    case "$1" in
        arm64-v8a)    echo "aarch64-linux-android"   ;;
        x86_64)       echo "x86_64-linux-android"    ;;
        armeabi-v7a)  echo "armv7-linux-androideabi" ;;
        x86)          echo "i686-linux-android"      ;;
        *) echo "❌  Unknown ABI: $1" >&2; exit 1    ;;
    esac
}

# ---------------------------------------------------------------------------
# Helper: map Rust target → NDK clang binary name (API 24)
# ---------------------------------------------------------------------------
target_to_clang() {
    case "$1" in
        aarch64-linux-android)   echo "aarch64-linux-android24-clang"    ;;
        x86_64-linux-android)    echo "x86_64-linux-android24-clang"     ;;
        armv7-linux-androideabi) echo "armv7a-linux-androideabi24-clang" ;;
        i686-linux-android)      echo "i686-linux-android24-clang"       ;;
        *) echo "❌  Unknown target: $1" >&2; exit 1                     ;;
    esac
}

# ---------------------------------------------------------------------------
# Helper: map Rust target → CARGO_TARGET_<X>_LINKER env var name
# (uppercase, hyphens → underscores)
# ---------------------------------------------------------------------------
target_to_env_prefix() {
    echo "$1" | tr '[:lower:]-' '[:upper:]_'
}

# ---------------------------------------------------------------------------
# NDK detection — tries (in order):
#   1. $ANDROID_NDK_HOME
#   2. $NDK_HOME
#   3. $ANDROID_SDK_ROOT/ndk/<latest>
#   4. $ANDROID_HOME/ndk/<latest>
#   5. ~/Library/Android/sdk/ndk/<latest>   (macOS default)
#   6. ~/Android/Sdk/ndk/<latest>           (Linux default)
# ---------------------------------------------------------------------------
find_ndk() {
    # Direct NDK pointers
    for candidate in "${ANDROID_NDK_HOME:-}" "${NDK_HOME:-}"; do
        if [[ -n "$candidate" && -d "$candidate/toolchains" ]]; then
            echo "$candidate"; return 0
        fi
    done

    # SDK roots — pick the highest NDK version inside each
    for sdk_root in \
        "${ANDROID_SDK_ROOT:-}" \
        "${ANDROID_HOME:-}" \
        "$HOME/Library/Android/sdk" \
        "$HOME/Android/Sdk"
    do
        [[ -z "$sdk_root" || ! -d "$sdk_root/ndk" ]] && continue
        local latest
        latest=$(ls -1 "$sdk_root/ndk" 2>/dev/null | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)
        local candidate="$sdk_root/ndk/$latest"
        if [[ -n "$latest" && -d "$candidate/toolchains" ]]; then
            echo "$candidate"; return 0
        fi
    done

    echo ""
}

NDK_PATH="$(find_ndk)"

if [[ -z "$NDK_PATH" ]]; then
    echo "❌  Android NDK not found."
    echo "    Set ANDROID_NDK_HOME to your NDK directory and re-run."
    exit 1
fi

echo "==> Using NDK: $NDK_PATH"

# Detect host OS tag used in NDK prebuilt path
case "$(uname -s)" in
    Darwin) HOST_TAG="darwin-x86_64" ;;
    Linux)  HOST_TAG="linux-x86_64"  ;;
    *)      echo "❌  Unsupported host OS: $(uname -s)"; exit 1 ;;
esac

TOOLCHAIN="$NDK_PATH/toolchains/llvm/prebuilt/$HOST_TAG"

if [[ ! -d "$TOOLCHAIN" ]]; then
    echo "❌  NDK toolchain not found at: $TOOLCHAIN"
    exit 1
fi

LLVM_AR="$TOOLCHAIN/bin/llvm-ar"

# ---------------------------------------------------------------------------
# Install Rust Android targets
# ---------------------------------------------------------------------------
echo "==> Installing Rust Android targets..."
for abi in $ABIS; do
    rustup target add "$(abi_to_target "$abi")"
done

# ---------------------------------------------------------------------------
# Detect whether cargo-ndk is available
# ---------------------------------------------------------------------------
USE_CARGO_NDK=false
if command -v cargo-ndk &>/dev/null; then
    USE_CARGO_NDK=true
    echo "==> cargo-ndk detected — using it for the build"
else
    echo "==> cargo-ndk not found — using direct cargo with NDK linker env vars"
fi

# ---------------------------------------------------------------------------
# Build each ABI
# ---------------------------------------------------------------------------
echo "==> Building Rust library with 16KB page-size alignment..."

for abi in $ABIS; do
    target="$(abi_to_target "$abi")"
    echo ""
    echo "    ── $abi ($target) ──"

    if $USE_CARGO_NDK; then
        ANDROID_NDK_HOME="$NDK_PATH" cargo ndk \
            --manifest-path "$RUST_DIR/Cargo.toml" \
            --target "$target" \
            --platform 24 \
            -- build --release
    else
        clang_bin="$TOOLCHAIN/bin/$(target_to_clang "$target")"

        if [[ ! -f "$clang_bin" ]]; then
            echo "    ❌  Clang not found: $clang_bin"
            exit 1
        fi

        env_prefix="$(target_to_env_prefix "$target")"

        # Cargo reads CARGO_TARGET_<UPPERCASE_TARGET>_LINKER for the linker
        export "CARGO_TARGET_${env_prefix}_LINKER=$clang_bin"
        export "CARGO_TARGET_${env_prefix}_AR=$LLVM_AR"

        # Use target-specific CC/AR so host proc-macro crates continue to use
        # the host toolchain during cross-compilation.
        case "$target" in
            aarch64-linux-android)
                export CC_aarch64_linux_android="$clang_bin"
                export AR_aarch64_linux_android="$LLVM_AR"
                ;;
            x86_64-linux-android)
                export CC_x86_64_linux_android="$clang_bin"
                export AR_x86_64_linux_android="$LLVM_AR"
                ;;
            armv7-linux-androideabi)
                export CC_armv7_linux_androideabi="$clang_bin"
                export AR_armv7_linux_androideabi="$LLVM_AR"
                ;;
            i686-linux-android)
                export CC_i686_linux_android="$clang_bin"
                export AR_i686_linux_android="$LLVM_AR"
                ;;
        esac

        cargo build \
            --manifest-path "$RUST_DIR/Cargo.toml" \
            --release \
            --target "$target"
    fi

    # Copy .so to jniLibs
    OUT_SO="$RUST_DIR/target/$target/release/libsecure_http_crypto.so"
    DEST_DIR="$JNI_LIBS_DIR/$abi"
    mkdir -p "$DEST_DIR"
    cp "$OUT_SO" "$DEST_DIR/libsecure_http_crypto.so"
    echo "    ✅  Copied → $DEST_DIR/libsecure_http_crypto.so"

    # Verify 16KB alignment using NDK's readelf
    readelf_bin="$TOOLCHAIN/bin/llvm-readelf"
    if [[ -f "$readelf_bin" ]]; then
        alignment=$("$readelf_bin" -l "$DEST_DIR/libsecure_http_crypto.so" 2>/dev/null \
            | awk '/LOAD/{print $NF; exit}')
        if [[ "$alignment" == "0x4000" ]]; then
            echo "    ✅  16KB page alignment confirmed ($alignment)"
        else
            echo "    ⚠️   ELF LOAD alignment: $alignment (expected 0x4000)"
        fi
    fi
done

echo ""
echo "==> Build complete. .so files are in $JNI_LIBS_DIR"
echo ""
echo "    Next steps:"
echo "    1. Run your Android build: cd android && ./gradlew assembleRelease"
echo "    2. Verify with: python3 scripts/check-16kb-alignment.py <path-to-apk>"
