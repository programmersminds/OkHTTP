# Architecture: Where is the Rust?

## Current Setup (Rust Backend Server)

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native App                          │
│                  (JavaScript Client)                         │
│                                                              │
│  SecureHttpClient.js → CryptoUtils.js                       │
│  (Encrypts data in JS, sends to Rust server)                │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Rust Backend Server                             │
│           (crypto-grid/src/main.rs)                         │
│                                                              │
│  - Validates timestamp                                       │
│  - Checks nonce (replay prevention)                          │
│  - Verifies HMAC signature                                   │
│  - Decrypts with AES-256-GCM                                 │
│  - Processes request                                         │
│  - Encrypts response                                         │
│  - Signs response                                            │
└─────────────────────────────────────────────────────────────┘
```

## The Rust is NOT a Native Module

The Rust code runs as a **separate backend server**, not as a React Native native module.

### Current Flow:
1. **JavaScript** (React Native) encrypts data
2. **HTTP request** sent to Rust server
3. **Rust server** validates and processes
4. **HTTP response** sent back
5. **JavaScript** decrypts response

## Why CryptoUtils References NativeModules

The code is **prepared** for optional native module integration, but currently:

```javascript
if (NativeModules.SecureHttpCrypto) {
  // This would use native iOS/Android crypto
  // NOT IMPLEMENTED YET
} else {
  // Falls back to JS crypto or throws error
  throw new Error('JS crypto not implemented - use native module');
}
```

## Two Options for Crypto

### Option 1: Pure JS Crypto (Current - Needs Implementation)
```javascript
// Install: npm install crypto-js
import CryptoJS from 'crypto-js';

_jsEncrypt(plaintext, key) {
  // Implement AES-256-GCM in JavaScript
  return CryptoJS.AES.encrypt(plaintext, key).toString();
}
```

### Option 2: Native Module (Future Enhancement)
Create iOS/Android native modules that call Rust crypto libraries.

## Recommended: Implement JS Crypto

Since you want to use the Rust backend for validation, implement JavaScript crypto in CryptoUtils:

```javascript
// CryptoUtils.js with JS implementation
import CryptoJS from 'crypto-js';

const CryptoUtils = {
  encrypt(plaintext, key) {
    const encrypted = CryptoJS.AES.encrypt(plaintext, key);
    return encrypted.toString();
  },

  decrypt(ciphertext, key) {
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key);
    return decrypted.toString(CryptoJS.enc.Utf8);
  },

  sign(data, timestamp, key) {
    const message = data + timestamp;
    return CryptoJS.HmacSHA256(message, key).toString();
  },

  generateNonce() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },
};
```

## Summary

- **Rust backend** = Separate HTTP server (crypto-grid/)
- **React Native** = HTTP client that talks to Rust server
- **CryptoUtils** = Needs JS crypto implementation (crypto-js or similar)
- **No native module needed** - Just HTTP communication

The security happens on the **Rust server side**, which validates everything before processing!
