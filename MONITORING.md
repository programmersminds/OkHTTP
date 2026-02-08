# Monitoring System

Microsoft Application Insights-style telemetry and monitoring for React Native Secure HTTP.

## Features

- ✅ **Automatic HTTP Request Tracking** - Duration, status codes, success/failure
- ✅ **Custom Event Tracking** - User actions, business events
- ✅ **Performance Metrics** - Custom measurements and KPIs
- ✅ **Exception Tracking** - Automatic error capture with context
- ✅ **Screenshot Capture** - Automatic screenshots on errors
- ✅ **Dependency Tracking** - External service calls
- ✅ **Session Management** - User session tracking
- ✅ **Auto-batching** - Efficient telemetry buffering and flushing

## Quick Start

### 1. Initialize Monitoring

```javascript
import { initializeMonitoring } from '@keymobile/react-native-secure-http';

initializeMonitoring({
  instrumentationKey: 'YOUR_INSTRUMENTATION_KEY',
  endpoint: 'https://your-telemetry-endpoint.com/v2/track',
  appVersion: '1.0.0',
  userId: 'user-123',
  enabled: true,
  captureScreenshotsOnError: true,
  maxBufferSize: 100,
  flushInterval: 30000 // 30 seconds
});
```

### 2. Automatic HTTP Tracking

All requests through `tls13Axios` are automatically tracked:

```javascript
import { tls13Axios } from '@keymobile/react-native-secure-http';

// Automatically tracked: duration, status, TLS version, errors, screenshots on error
const response = await tls13Axios.get('https://api.example.com/data');
```

### 3. Setup Screenshot Capture

```javascript
import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';
import { getMonitoring } from '@keymobile/react-native-secure-http';

function App() {
  const appRef = useRef();

  useEffect(() => {
    getMonitoring()?.setScreenshotView(appRef.current);
  }, []);

  return <View ref={appRef}>{/* Your app */}</View>;
}
```

### 4. Track Custom Events

```javascript
import { getMonitoring } from '@keymobile/react-native-secure-http';

const monitoring = getMonitoring();

monitoring.trackEvent('UserLogin', 
  { userId: 'user-123', method: 'oauth' },
  { loginDuration: 1250 }
);
```

### 5. Track Metrics

```javascript
monitoring.trackMetric('CacheHitRate', 0.85, {
  cacheType: 'memory',
  region: 'us-east-1'
});
```

### 6. Track Exceptions

```javascript
try {
  await riskyOperation();
} catch (error) {
  monitoring.trackException(error, {
    component: 'DataSync',
    operation: 'upload'
  });
}
```

### 7. Manual Screenshot Capture

```javascript
const screenshot = await monitoring.captureScreenshot();
monitoring.trackEvent('UserAction', { screenshot });
```

## Installation

For screenshot support, install:

```bash
npm install react-native-view-shot
# or
yarn add react-native-view-shot
```

Screenshots are optional - monitoring works without it.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `instrumentationKey` | string | - | Your telemetry service key |
| `endpoint` | string | - | Telemetry ingestion endpoint |
| `appVersion` | string | '1.0.0' | Application version |
| `userId` | string | 'anonymous' | User identifier |
| `enabled` | boolean | true | Enable/disable telemetry |
| `captureScreenshotsOnError` | boolean | true | Capture screenshots on errors |
| `maxBufferSize` | number | 100 | Max items before auto-flush |
| `flushInterval` | number | 30000 | Auto-flush interval (ms) |

## Telemetry Types

### Events
Track user actions and business events:
```javascript
monitoring.trackEvent('ButtonClicked', { buttonId: 'submit' });
```

### Metrics
Track numeric measurements:
```javascript
monitoring.trackMetric('ResponseTime', 245);
```

### Exceptions
Track errors with stack traces:
```javascript
monitoring.trackException(new Error('Failed'), { context: 'payment' });
```

### Requests
Automatically tracked for HTTP calls:
- URL, method, duration
- Status code, success/failure
- TLS version

### Dependencies
Track external service calls:
```javascript
monitoring.telemetry.trackDependency(
  'DatabaseQuery',
  'SQL',
  'db.example.com',
  245,
  true,
  200
);
```

## Context Information

Automatically captured with every telemetry item:

- **Application**: Version
- **Device**: OS type, OS version
- **Session**: Unique session ID
- **User**: User ID
- **Timestamp**: ISO 8601 format

## Best Practices

1. **Initialize Early**: Call `initializeMonitoring()` in your app's entry point
2. **Flush on Exit**: Call `monitoring.flush()` before app closes
3. **Disable in Dev**: Set `enabled: !__DEV__` to avoid dev noise
4. **Use Properties**: Add context to events for better filtering
5. **Track Business Events**: Not just errors - track success paths too

## Integration with Azure Application Insights

```javascript
initializeMonitoring({
  instrumentationKey: 'YOUR_AZURE_INSTRUMENTATION_KEY',
  endpoint: 'https://dc.services.visualstudio.com/v2/track',
  appVersion: '1.0.0',
  enabled: !__DEV__
});
```

## Custom Telemetry Endpoint

Send to your own backend:

```javascript
initializeMonitoring({
  endpoint: 'https://your-api.com/telemetry',
  enabled: true
});
```

Expected payload format:
```json
{
  "items": [
    {
      "type": "Event",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "context": {
        "application": { "version": "1.0.0" },
        "device": { "type": "ios", "osVersion": "17.0" },
        "session": { "id": "session-123" },
        "user": { "id": "user-456" }
      },
      "data": {
        "name": "UserLogin",
        "properties": { "method": "oauth" },
        "measurements": { "duration": 1250 }
      }
    }
  ]
}
```

## Complete Example

```javascript
import React, { useEffect } from 'react';
import { 
  initializeMonitoring, 
  getMonitoring,
  tls13Axios 
} from '@keymobile/react-native-secure-http';

function App() {
  useEffect(() => {
    // Initialize
    initializeMonitoring({
      instrumentationKey: 'YOUR_KEY',
      endpoint: 'https://telemetry.example.com/track',
      appVersion: '1.0.0',
      enabled: !__DEV__
    });

    // Track app launch
    getMonitoring().trackEvent('AppLaunched');

    // Cleanup
    return () => {
      getMonitoring().flush();
    };
  }, []);

  const fetchData = async () => {
    try {
      // Automatically tracked
      const response = await tls13Axios.get('https://api.example.com/data');
      
      // Track success
      getMonitoring().trackEvent('DataFetched', {
        count: response.data.length
      });
    } catch (error) {
      // Automatically tracked
      getMonitoring().trackException(error);
    }
  };

  return <YourApp onFetch={fetchData} />;
}
```

## See Also

- [MONITORING_EXAMPLES.js](../MONITORING_EXAMPLES.js) - Complete usage examples
- [USAGE_EXAMPLES.js](../USAGE_EXAMPLES.js) - HTTP client examples
