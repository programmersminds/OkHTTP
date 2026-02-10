# Using Crypto-Secured HTTP Client

## Basic Usage (Without Crypto)

```javascript
import { createSecureHttpClient } from 'react-native-secure-http';

const client = createSecureHttpClient({
  baseURL: 'https://api.example.com'
});

const response = await client.post('/users', { name: 'John' });
```

## Crypto-Secured Usage

```javascript
import { createSecureHttpClient } from 'react-native-secure-http';

const secureClient = createSecureHttpClient({
  baseURL: 'https://your-server.com',
  enableCrypto: true,
  cryptoKey: 'your-32-byte-secret-key-here!', // Store securely!
});

// All requests are automatically encrypted and signed
const response = await secureClient.post('/api/secure', {
  message: 'Hello, secure world!',
  amount: 1000
});

// Response is automatically decrypted
console.log(response.data);
```

## What Happens Automatically

When `enableCrypto: true`:

1. **Request**: Your data is encrypted with AES-256-GCM
2. **Signing**: HMAC-SHA256 signature is added
3. **Timestamp**: Current timestamp included
4. **Nonce**: Unique ID prevents replay attacks
5. **Response**: Server response is verified and decrypted

## Security Features

- ✅ End-to-end encryption (AES-256-GCM)
- ✅ Request signing (HMAC-SHA256)
- ✅ Replay attack prevention (nonce)
- ✅ Timestamp validation (5-minute window)
- ✅ TLS 1.3 transport security

## Example: Secure Payment

```javascript
const paymentClient = createSecureHttpClient({
  baseURL: 'https://payment-api.com',
  enableCrypto: true,
  cryptoKey: process.env.CRYPTO_KEY,
  timeout: 30000
});

async function processPayment(amount, recipient) {
  try {
    const response = await paymentClient.post('/api/secure', {
      type: 'payment',
      amount,
      recipient,
      timestamp: Date.now()
    });
    
    return response.data;
  } catch (error) {
    console.error('Payment failed:', error.message);
    throw error;
  }
}
```

## Key Management

**Never hardcode keys!** Use secure storage:

```javascript
import { CRYPTO_KEY } from '@env'; // react-native-dotenv

const client = createSecureHttpClient({
  baseURL: 'https://api.example.com',
  enableCrypto: true,
  cryptoKey: CRYPTO_KEY
});
```

## Backend Integration

Your backend must use the Rust crypto service:

```bash
# Start Rust backend
cd crypto-grid
CRYPTO_KEY='same-key-as-client' cargo run --release
```

Both client and server must use the **same 32-byte key**.
