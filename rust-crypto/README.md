# Rust Native Crypto Module

## Architecture

```
React Native App (JavaScript)
        ↓
CryptoUtils.js (Bridge)
        ↓
Native Modules (iOS/Android)
        ↓
Rust Crypto Library (AES-256-GCM + HMAC-SHA256)
        ↓
Secure Storage (iOS Keychain / Android Keystore)
```

## Build Instructions

### 1. Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Add iOS/Android Targets
```bash
rustup target add aarch64-apple-ios x86_64-apple-ios
rustup target add aarch64-linux-android armv7-linux-androideabi
```

### 3. Build Rust Library

**For iOS:**
```bash
cd rust-crypto
cargo build --release --target aarch64-apple-ios
cargo build --release --target x86_64-apple-ios
```

**For Android:**
```bash
cd rust-crypto
cargo build --release --target aarch64-linux-android
cargo build --release --target armv7-linux-androideabi
```

### 4. Link Libraries

**iOS (Xcode):**
1. Add `libsecure_http_crypto.a` to project
2. Link in Build Phases → Link Binary With Libraries

**Android (build.gradle):**
```gradle
android {
    sourceSets {
        main {
            jniLibs.srcDirs = ['../rust-crypto/target/aarch64-linux-android/release']
        }
    }
}
```

## Usage

```javascript
import { createSecureHttpClient } from 'react-native-secure-http';
import SecureStorage from 'react-native-secure-http/SecureStorage';

// Get or create encryption key (stored in Keychain/Keystore)
const key = await SecureStorage.getOrCreateKey();

// Create client with Rust-powered encryption
const client = createSecureHttpClient({
  baseURL: 'https://api.example.com',
  enableCrypto: true,
  cryptoKey: key
});

// All requests/responses automatically encrypted by Rust
const response = await client.post('/api/data', { 
  sensitive: 'data' 
});
```

## Security Features

✅ **AES-256-GCM** - Authenticated encryption in Rust
✅ **HMAC-SHA256** - Request signing in Rust  
✅ **Secure Key Storage** - iOS Keychain / Android Keystore
✅ **No JavaScript Crypto** - All crypto in native Rust
✅ **Memory Safe** - Rust prevents buffer overflows
✅ **Fast** - Native performance

## Files Created

- `rust-crypto/src/lib.rs` - Rust crypto implementation
- `src/ios/SecureHttpCrypto.swift` - iOS bridge
- `src/ios/SecureHttpCrypto.m` - iOS Objective-C bridge
- `src/android/SecureHttpCryptoModule.kt` - Android bridge
- `src/CryptoUtils.js` - JavaScript interface
- `src/SecureStorage.js` - Keychain/Keystore wrapper
