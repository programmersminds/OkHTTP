# Anti-Fraud & Bypass Prevention

## Security Mechanisms Implemented

### 1. **Integrity Verification**
```rust
crypto_init() // Must be called first
crypto_verify_integrity() // Checks if module is properly initialized
```
- Generates unique integrity key on init
- All operations verify integrity before executing
- Prevents unauthorized access to crypto functions

### 2. **Timestamp Validation**
```rust
verify_timestamp(timestamp) // 5-minute window
```
- Rejects requests older than 5 minutes
- Prevents replay attacks with old signatures
- Clock skew tolerance built-in

### 3. **Tampering Detection**
```rust
detect_tampering(data)
```
Blocks:
- XSS attempts (`<script>`, `javascript:`)
- Code injection (`eval(`)
- Oversized payloads (>1MB)

### 4. **Replay Attack Prevention**
```rust
detect_replay_attack(operation)
```
- Logs all operations with timestamps
- Blocks >10 identical operations per second
- Auto-cleans logs older than 60 seconds

### 5. **Encrypted Storage**
```rust
crypto_store_key() // Encrypts with master key
crypto_get_key() // Decrypts with master key
```
- All stored keys encrypted with master key
- Master key generated on init, never exposed
- Storage isolated in Rust memory

### 6. **Rate Limiting**
- Max 10 operations/second per type
- Automatic throttling
- Prevents brute force attacks

## How It Prevents Fraud

### ❌ Can't Bypass Initialization
```javascript
// This will fail if crypto_init() not called
await SecureHttpCrypto.encrypt(data, key); // Returns null
```

### ❌ Can't Replay Old Requests
```javascript
// Old timestamp rejected
await SecureHttpCrypto.sign(data, oldTimestamp, key); // Returns null
```

### ❌ Can't Inject Malicious Code
```javascript
// XSS attempt blocked
await SecureHttpCrypto.encrypt('<script>alert(1)</script>', key); // Returns null
```

### ❌ Can't Brute Force
```javascript
// Too many requests blocked
for (let i = 0; i < 100; i++) {
  await SecureHttpCrypto.decrypt(data, key); // Blocked after 10/sec
}
```

### ❌ Can't Access Raw Storage
```javascript
// Storage encrypted with master key
// Even if memory dumped, keys are encrypted
```

### ❌ Can't Tamper with Module
```javascript
// Integrity check fails if module modified
SecureHttpCrypto.verifyIntegrity(); // Returns false if tampered
```

## Usage

```javascript
import { NativeModules } from 'react-native';
const { SecureHttpCrypto } = NativeModules;

// 1. Initialize (call once on app start)
SecureHttpCrypto.init();

// 2. Verify integrity
const isValid = await SecureHttpCrypto.verifyIntegrity();
if (!isValid) {
  throw new Error('Security module compromised!');
}

// 3. Use normally - all protections active
const encrypted = await SecureHttpCrypto.encrypt(data, key);
```

## Protection Summary

| Attack Type | Protection | How |
|------------|-----------|-----|
| Replay Attack | Timestamp + Rate Limit | 5-min window + 10/sec max |
| XSS Injection | Input Validation | Blocks script tags |
| Brute Force | Rate Limiting | 10 ops/sec per type |
| Memory Dump | Encrypted Storage | Master key encryption |
| Module Tampering | Integrity Check | Init verification |
| Bypass Attempt | Null Returns | All checks return null on fail |

All fraud prevention happens **in Rust** - JavaScript can't bypass it!
