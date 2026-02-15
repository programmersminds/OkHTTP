# Secure Storage with Rust

Store server responses securely using Rust-powered AES-256-GCM encryption.

## Features

- ✅ **AES-256-GCM Encryption** - Military-grade encryption
- ✅ **Tamper-Proof** - Data encrypted with master key in memory
- ✅ **Memory-Safe** - Rust prevents buffer overflows
- ✅ **Attack Prevention** - Integrity checks on all operations
- ✅ **Auto-Encrypted** - All data encrypted before storage

## Usage

```javascript
import { SecureStorage } from 'react-native-secure-http';

// Store server response
const response = await apiClient.get('/user/profile');
await SecureStorage.setItem('userProfile', response.data);

// Retrieve data
const profile = await SecureStorage.getItem('userProfile');
console.log(profile); // Decrypted automatically

// Remove item
await SecureStorage.removeItem('userProfile');

// Clear all
await SecureStorage.clear();
```

## Example: Cache API Responses

```javascript
import { tls13Axios, SecureStorage } from 'react-native-secure-http';

async function fetchUserData(userId) {
  const cacheKey = `user_${userId}`;
  
  // Check cache first
  const cached = await SecureStorage.getItem(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch from server
  const response = await tls13Axios.get(`/users/${userId}`);
  
  // Store securely
  await SecureStorage.setItem(cacheKey, response.data);
  
  return response.data;
}
```

## Security Details

### How It Works

1. **Store**: Data → JSON.stringify → AES-256-GCM → Encrypted blob → Memory
2. **Retrieve**: Memory → Encrypted blob → AES-256-GCM decrypt → JSON.parse → Data

### Master Key

- Generated on app initialization using `ring::SystemRandom`
- Stored in memory only (never persisted)
- 32-byte cryptographically secure random key
- Unique per app session

### Protection Against

- ✅ **Memory dumps** - Data encrypted at rest
- ✅ **Tampering** - Integrity verification on all operations
- ✅ **Replay attacks** - Request logging prevents abuse
- ✅ **Buffer overflows** - Rust memory safety

## API Reference

### `SecureStorage.setItem(key, value)`

Store data securely.

```javascript
await SecureStorage.setItem('token', { access: 'abc123', refresh: 'xyz789' });
```

### `SecureStorage.getItem(key)`

Retrieve and decrypt data.

```javascript
const token = await SecureStorage.getItem('token');
// Returns: { access: 'abc123', refresh: 'xyz789' }
```

### `SecureStorage.removeItem(key)`

Delete specific item.

```javascript
await SecureStorage.removeItem('token');
```

### `SecureStorage.clear()`

Delete all stored data.

```javascript
await SecureStorage.clear();
```

## Comparison with AsyncStorage

| Feature | SecureStorage | AsyncStorage |
|---------|--------------|--------------|
| Encryption | ✅ AES-256-GCM | ❌ Plain text |
| Tamper-proof | ✅ Yes | ❌ No |
| Memory-safe | ✅ Rust | ⚠️ JavaScript |
| Attack prevention | ✅ Built-in | ❌ None |
| Performance | ⚡ Native | 🐌 JavaScript |

## Best Practices

```javascript
// ✅ Store sensitive data
await SecureStorage.setItem('authToken', token);
await SecureStorage.setItem('userCredentials', credentials);
await SecureStorage.setItem('paymentInfo', payment);

// ❌ Don't store large files (use for data < 1MB)
// ❌ Don't store binary data (JSON only)

// ✅ Clear on logout
async function logout() {
  await SecureStorage.clear();
  // Navigate to login
}
```

## Error Handling

```javascript
try {
  await SecureStorage.setItem('key', data);
} catch (error) {
  if (error.message.includes('not available')) {
    console.error('Rust crypto module not initialized');
  }
}
```

## Platform Support

- ✅ **Android**: All versions (API 16+)
- ✅ **iOS**: 11.0+
- ✅ **React Native**: 0.40+
