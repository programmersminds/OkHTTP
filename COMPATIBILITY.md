# Compatibility

## Supported Versions

### React Native
- ✅ **All versions** (0.40+)
- ✅ **0.60+** (Autolinking)
- ✅ **0.40-0.59** (Manual linking)

### Android
- ✅ **API 16+ (Android 4.1 Jelly Bean)** and above
- TLS 1.3 via Conscrypt on all versions
- Backward compatible with older Android versions

### iOS
- ✅ **iOS 11.0+** (All versions supported)
- TLS 1.3 on iOS 12.2+
- TLS 1.2 on iOS 11.0 - 12.1

## Platform-Specific Details

### Android TLS Support
| Android Version | API Level | TLS Support |
|----------------|-----------|-------------|
| 4.1 - 4.4      | 16-19     | TLS 1.2 (via Conscrypt) |
| 5.0 - 9.0      | 21-28     | TLS 1.2 (native + Conscrypt) |
| 10+            | 29+       | TLS 1.3 (via Conscrypt) |

### iOS TLS Support
| iOS Version | TLS Support |
|------------|-------------|
| 11.0 - 12.1 | TLS 1.2 |
| 12.2+       | TLS 1.3 |

## React Native Version Compatibility

### RN 0.60+ (Autolinking)
```bash
npm install @keymobile/react-native-secure-http
cd ios && pod install
```

### RN 0.50-0.59 (Manual Linking)
```bash
npm install @keymobile/react-native-secure-http
react-native link @keymobile/react-native-secure-http
```

## Network API Compatibility

The library automatically detects and uses the best available API:

1. **Modern RN (0.60+)**: Uses `fetch` API
2. **Legacy RN (0.50-0.59)**: Falls back to `XMLHttpRequest`
3. **Both**: Route through native secure networking stack

## Testing Compatibility

```javascript
import { testTLS13Support, checkSecurityProviders } from '@keymobile/react-native-secure-http';

// Check what's available on current device
const support = await testTLS13Support();
console.log('TLS Version:', support.tlsVersion);

const providers = await checkSecurityProviders();
console.log('Security Provider:', providers.topProvider);
```
