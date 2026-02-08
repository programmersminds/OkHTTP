# React Native Secure HTTP

Secure HTTP client with TLS 1.2/1.3 support and Microsoft-style monitoring for React Native.

## Features

- ✅ **TLS 1.3 Support**: Android (all versions via Conscrypt), iOS 12.2+
- ✅ **TLS 1.2**: All versions
- ✅ **Telemetry & Monitoring**: Application Insights-style tracking
- ✅ **Performance Metrics**: Automatic HTTP request monitoring
- ✅ **Exception Tracking**: Automatic error capture
- ✅ **Custom Events**: Track business events and user actions

## Compatibility

- ✅ **React Native**: All versions (0.40+)
- ✅ **Android**: API 16+ (Android 4.1+)
- ✅ **iOS**: 11.0+
- ✅ **TLS 1.3**: Android (all versions via Conscrypt), iOS 12.2+
- ✅ **TLS 1.2**: All versions

See [COMPATIBILITY.md](./COMPATIBILITY.md) for detailed version support.

## Installation

```bash
npm install git+https://github.com/osarinmwian/secure-http.git
# or
yarn add git+https://github.com/osarinmwian/secure-http.git
```

### iOS Setup

```bash
cd ios && pod install && cd ..
```

## Setup

### Android Setup

### iOS

iOS has native TLS 1.3 support (iOS 12.2+). No additional configuration needed!

The library will automatically use NSURLSession with TLS 1.3.

### Android

1. In `android/app/src/main/java/[your-app]/MainApplication.kt`:

```kotlin
import com.securehttp.TLSOkHttpClientFactory
import com.securehttp.SecureHttpPackage
import com.facebook.react.modules.network.OkHttpClientProvider

class MainApplication : Application(), ReactApplication {
    override fun onCreate() {
        super.onCreate()
        OkHttpClientProvider.setOkHttpClientFactory(TLSOkHttpClientFactory())
    }
    
    override fun getPackages(): List<ReactPackage> {
        return PackageList(this).packages.apply {
            add(SecureHttpPackage())
        }
    }
}
```

2. In `android/settings.gradle`, add:

```gradle
include ':react-native-secure-http'
project(':react-native-secure-http').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-secure-http/src/android')
```

3. In `android/app/build.gradle`, add:

```gradle
dependencies {
    implementation project(':react-native-secure-http')
}
```

### React Native 0.60+ (Autolinking)

For React Native 0.60+, iOS will autolink automatically after pod install.

### Optional: Screenshot Support

For error screenshot capture:

```bash
npm install react-native-view-shot
cd ios && pod install
```

## Usage

### 1. Use tls13Axios (TLS 1.3 Auto-Enabled)

```javascript
import { tls13Axios } from 'react-native-secure-http';

// TLS 1.3 is automatically enabled - just use it!
// GET request
const response = await tls13Axios.get('https://api.example.com/user');

// POST request
const data = await tls13Axios.post('https://api.example.com/user', {
  name: 'John',
  email: 'john@example.com'
});
```

### 2. Initialize Monitoring (Optional)

```javascript
import { initializeMonitoring } from 'react-native-secure-http';

function App() {
  useEffect(() => {
    initializeMonitoring({
      endpoint: 'https://your-telemetry.com/track',
      appVersion: '1.0.0',
      enabled: !__DEV__
    });
  }, []);
  
  return <YourApp />;
}
```

### 3. Custom Client

```javascript
import { createSecureHttpClient } from 'react-native-secure-http';

const apiClient = createSecureHttpClient({
  baseURL: 'https://api.example.com',
  headers: { 'Authorization': 'Bearer TOKEN' }
});

const response = await apiClient.get('/endpoint');
```

### 4. Check TLS Status

```javascript
import { 
  checkSecurityProviders, 
  testTLS13Support,
  isTLSModuleAvailable 
} from 'react-native-secure-http';

if (isTLSModuleAvailable()) {
  const providers = await checkSecurityProviders();
  console.log('Top Provider:', providers.topProvider);
  
  const tlsSupport = await testTLS13Support();
  console.log('TLS Version:', tlsSupport.tlsVersion);
}
```

See [USAGE_EXAMPLES.js](./USAGE_EXAMPLES.js) for more examples.

## Monitoring

Built-in Microsoft Application Insights-style telemetry:

```javascript
import { initializeMonitoring, getMonitoring } from 'react-native-secure-http';

// Initialize
initializeMonitoring({
  instrumentationKey: 'YOUR_KEY',
  endpoint: 'https://telemetry.example.com/track',
  appVersion: '1.0.0',
  enabled: !__DEV__
});

// Track events
getMonitoring().trackEvent('UserLogin', { method: 'oauth' });

// Track metrics
getMonitoring().trackMetric('ResponseTime', 245);

// Track exceptions
getMonitoring().trackException(error, { context: 'payment' });

// HTTP requests are automatically tracked
```

See [MONITORING.md](./MONITORING.md) for complete documentation.

## Repository

```
https://github.com/osarinmwian/secure-http
```
