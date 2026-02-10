# How Request Security Works

## Security Architecture

The system uses **defense-in-depth** with multiple layers:

### Layer 1: Transport Security (TLS 1.3)
- All data encrypted in transit using TLS 1.3
- Prevents man-in-the-middle attacks
- Handled by `react-native-secure-http` TLS module

### Layer 2: Payload Encryption (AES-256-GCM)
- Request/response bodies encrypted with AES-256-GCM
- Each request uses unique 12-byte nonce
- Authenticated encryption prevents tampering

### Layer 3: Request Signing (HMAC-SHA256)
- Every request signed with HMAC-SHA256
- Signature includes: encrypted data + timestamp
- Server verifies signature before processing

### Layer 4: Replay Attack Prevention
- Each request includes unique nonce (UUID)
- Server caches nonces for 5 minutes
- Duplicate nonce = rejected request

### Layer 5: Timestamp Validation
- Requests must be within 5-minute window
- Prevents replay of old captured requests
- Clock skew tolerance built-in

## Request Flow

```
Client Side:
1. Prepare payload: {"user": "john", "action": "transfer"}
2. Encrypt with AES-256-GCM → base64_encrypted_data
3. Get current timestamp → 1234567890
4. Sign: HMAC(encrypted_data + timestamp) → signature
5. Generate unique nonce → uuid-1234-5678
6. Send: {data, timestamp, signature, nonce}

Server Side:
1. Check timestamp (within 5 min?) → ✓
2. Check nonce (already used?) → ✓
3. Verify HMAC signature → ✓
4. Decrypt AES-256-GCM → original payload
5. Process request
6. Encrypt response
7. Sign response
8. Send back
```

## Why This Prevents Bypassing

### ❌ Can't Replay Requests
- Nonce is checked and cached
- Same request twice = rejected

### ❌ Can't Modify Data
- HMAC signature breaks if data changed
- Server rejects invalid signatures

### ❌ Can't Use Old Requests
- Timestamp validation rejects old requests
- 5-minute window prevents replay

### ❌ Can't Read Encrypted Data
- AES-256-GCM encryption
- Without key, data is unreadable

### ❌ Can't Forge Requests
- HMAC requires secret key
- Can't create valid signature without key

## Security Properties

| Attack Type | Protection | How |
|------------|-----------|-----|
| Man-in-the-Middle | TLS 1.3 | Transport encryption |
| Data Tampering | HMAC-SHA256 | Signature verification |
| Replay Attack | Nonce Cache | Duplicate detection |
| Old Request Replay | Timestamp | 5-minute window |
| Data Sniffing | AES-256-GCM | Payload encryption |
| Timing Attack | Constant-Time Compare | Signature check |

## Key Management

**Critical:** The 32-byte secret key must be:
- ✅ Stored securely (never in code)
- ✅ Same on client and server
- ✅ Rotated periodically
- ✅ Different per environment (dev/prod)

## Example Attack Scenarios

### Scenario 1: Attacker Captures Request
```
Captured: {data: "xyz", timestamp: 1000, signature: "abc", nonce: "123"}
```
**Result:** Can't replay - nonce already used, timestamp expired

### Scenario 2: Attacker Modifies Amount
```
Original: {amount: 100}
Modified: {amount: 999999}
```
**Result:** HMAC signature invalid - request rejected

### Scenario 3: Attacker Tries Old Request
```
Old request from 10 minutes ago
```
**Result:** Timestamp validation fails - request rejected

## Integration with React Native

The `SecureHttpClient` will automatically:
1. Encrypt all request bodies
2. Sign requests with HMAC
3. Add timestamp and nonce
4. Verify response signatures
5. Decrypt response bodies

All security is transparent to your app code.
