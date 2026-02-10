# Rust Crypto Implementation in SecureHttpClient

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    React Native App                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SecureHttpClient.js - Line 47-53 (REQUEST ENCRYPTION)          │
│                                                                   │
│  if (this.enableCrypto && this.cryptoKey && config.data) {      │
│    const timestamp = Math.floor(Date.now() / 1000);             │
│    const nonce = CryptoUtils.generateNonce();                   │
│    const encrypted = await CryptoUtils.encrypt(                 │
│      JSON.stringify(config.data), this.cryptoKey                │
│    );                                                            │
│    const signature = await CryptoUtils.sign(                    │
│      encrypted, timestamp, this.cryptoKey                       │
│    );                                                            │
│    requestConfig.data = { data: encrypted, timestamp,           │
│                          signature, nonce };                    │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CryptoUtils.js - Calls Native Module or JS Fallback            │
│                                                                   │
│  async encrypt(plaintext, key) {                                │
│    if (NativeModules.SecureHttpCrypto) {                        │
│      return NativeModules.SecureHttpCrypto.encrypt(             │
│        plaintext, key                                           │
│      );                                                          │
│    }                                                             │
│    return this._jsEncrypt(plaintext, key);                      │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              HTTP Request Sent to Rust Backend                   │
│                                                                   │
│  POST /api/secure                                                │
│  {                                                               │
│    "data": "base64_encrypted_payload",                          │
│    "timestamp": 1234567890,                                     │
│    "signature": "hmac_signature",                               │
│    "nonce": "uuid-1234"                                         │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Rust Backend - main.rs:18-64 (VALIDATION & PROCESSING)         │
│                                                                   │
│  async fn secure_request(                                        │
│    body: web::Json<SecureRequest>,                              │
│    state: web::Data<AppState>                                   │
│  ) -> HttpResponse {                                             │
│                                                                   │
│    // 1. TIMESTAMP VALIDATION (Line 21-27)                      │
│    let now = chrono::Utc::now().timestamp();                    │
│    if (now - body.timestamp).abs() > TIMESTAMP_WINDOW {         │
│      return HttpResponse::Unauthorized().json({                 │
│        "error": "Request expired"                               │
│      });                                                         │
│    }                                                             │
│                                                                   │
│    // 2. REPLAY ATTACK PREVENTION (Line 29-37)                  │
│    let mut cache = state.nonce_cache.lock().unwrap();           │
│    if cache.contains_key(&body.nonce) {                         │
│      return HttpResponse::Unauthorized().json({                 │
│        "error": "Replay attack detected"                        │
│      });                                                         │
│    }                                                             │
│    cache.insert(body.nonce.clone(), now);                       │
│    cache.retain(|_, &mut v| (now - v).abs() <= 300);           │
│                                                                   │
│    // 3. SIGNATURE VERIFICATION (Line 39-43)                    │
│    if !state.validator.verify(                                  │
│      &body.data, body.timestamp, &body.signature                │
│    ) {                                                           │
│      return HttpResponse::Unauthorized().json({                 │
│        "error": "Invalid signature"                             │
│      });                                                         │
│    }                                                             │
│                                                                   │
│    // 4. DECRYPTION (Line 45-50)                                │
│    let decrypted = match state.validator.decrypt(&body.data) {  │
│      Ok(d) => d,                                                 │
│      Err(_) => return HttpResponse::BadRequest().json({         │
│        "error": "Decryption failed"                             │
│      }),                                                         │
│    };                                                            │
│                                                                   │
│    // 5. PROCESS REQUEST                                        │
│    let response_data = format!(                                 │
│      "{{\"status\":\"success\",\"received\":{}}}",              │
│      decrypted                                                   │
│    );                                                            │
│                                                                   │
│    // 6. ENCRYPT RESPONSE (Line 52-56)                          │
│    let encrypted = match state.validator.encrypt(               │
│      &response_data                                             │
│    ) {                                                           │
│      Ok(e) => e,                                                 │
│      Err(_) => return HttpResponse::InternalServerError()       │
│    };                                                            │
│                                                                   │
│    // 7. SIGN RESPONSE (Line 58-59)                             │
│    let response_timestamp = chrono::Utc::now().timestamp();     │
│    let response_signature = state.validator.sign(               │
│      &encrypted, response_timestamp                             │
│    );                                                            │
│                                                                   │
│    // 8. SEND RESPONSE (Line 61-65)                             │
│    HttpResponse::Ok().json(SecureResponse {                     │
│      data: encrypted,                                            │
│      timestamp: response_timestamp,                              │
│      signature: response_signature,                              │
│    })                                                            │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Rust Crypto - encryption.rs (ACTUAL CRYPTO OPERATIONS)         │
│                                                                   │
│  // ENCRYPTION (Line 30-42)                                     │
│  pub fn encrypt(&self, plaintext: &str) -> Result<String> {     │
│    let mut nonce_bytes = [0u8; 12];                             │
│    self.rng.fill(&mut nonce_bytes)?;                            │
│    let nonce = Nonce::from_slice(&nonce_bytes);                 │
│    let ciphertext = self.cipher.encrypt(                        │
│      nonce, plaintext.as_bytes()                                │
│    )?;                                                           │
│    let mut result = nonce_bytes.to_vec();                       │
│    result.extend_from_slice(&ciphertext);                       │
│    Ok(base64::encode(&result))                                  │
│  }                                                               │
│                                                                   │
│  // DECRYPTION (Line 44-58)                                     │
│  pub fn decrypt(&self, encrypted: &str) -> Result<String> {     │
│    let data = base64::decode(encrypted)?;                       │
│    let (nonce_bytes, ciphertext) = data.split_at(12);           │
│    let plaintext = self.cipher.decrypt(                         │
│      Nonce::from_slice(nonce_bytes), ciphertext                 │
│    )?;                                                           │
│    String::from_utf8(plaintext)                                 │
│  }                                                               │
│                                                                   │
│  // SIGNING (Line 60-65)                                        │
│  pub fn sign(&self, data: &str, timestamp: i64) -> String {     │
│    let mut mac = HmacSha256::new_from_slice(&self.hmac_key);    │
│    mac.update(data.as_bytes());                                 │
│    mac.update(&timestamp.to_le_bytes());                        │
│    base64::encode(mac.finalize().into_bytes())                  │
│  }                                                               │
│                                                                   │
│  // VERIFICATION (Line 67-70)                                   │
│  pub fn verify(&self, data: &str, timestamp: i64,               │
│                signature: &str) -> bool {                       │
│    let expected = self.sign(data, timestamp);                   │
│    constant_time_compare(&expected, signature)                  │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              HTTP Response Sent Back to Client                   │
│                                                                   │
│  {                                                               │
│    "data": "base64_encrypted_response",                         │
│    "timestamp": 1234567891,                                     │
│    "signature": "hmac_signature"                                │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SecureHttpClient.js - Line 71-75 (RESPONSE DECRYPTION)         │
│                                                                   │
│  if (this.enableCrypto && this.cryptoKey &&                     │
│      result.data?.data) {                                       │
│    const decrypted = await CryptoUtils.decrypt(                 │
│      result.data.data, this.cryptoKey                           │
│    );                                                            │
│    result.data = JSON.parse(decrypted);                         │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React Native App                              │
│              (Receives Decrypted Response)                       │
└─────────────────────────────────────────────────────────────────┘
```

## File Locations

### JavaScript Side (React Native)
- **SecureHttpClient.js** (Lines 47-53): Request encryption
- **SecureHttpClient.js** (Lines 71-75): Response decryption
- **CryptoUtils.js**: Crypto interface (calls native or JS)

### Rust Side (Backend)
- **main.rs** (Lines 18-64): Request validation & processing
- **encryption.rs** (Lines 30-70): Actual crypto operations
- **models.rs**: Request/Response structures

## Key Implementation Points

1. **Request Encryption** happens in `SecureHttpClient.js:47-53`
2. **Rust receives** encrypted request in `main.rs:18`
3. **Validation** happens in `main.rs:21-50` (timestamp, nonce, signature, decrypt)
4. **Crypto operations** in `encryption.rs:30-70` (AES-256-GCM + HMAC-SHA256)
5. **Response encryption** in `main.rs:52-65`
6. **Response decryption** in `SecureHttpClient.js:71-75`

All security is transparent to your app code!
