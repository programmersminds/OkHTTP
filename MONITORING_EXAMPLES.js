import { 
  initializeMonitoring, 
  getMonitoring,
  tls13Axios 
} from '@keymobile/react-native-secure-http';

// ============================================
// 1. Initialize Monitoring (Application Insights Style)
// ============================================

function initializeApp() {
  initializeMonitoring({
    instrumentationKey: 'YOUR_INSTRUMENTATION_KEY',
    endpoint: 'https://your-telemetry-endpoint.com/v2/track',
    appVersion: '1.0.0',
    userId: 'user-123',
    enabled: true,
    maxBufferSize: 100,
    flushInterval: 30000 // 30 seconds
  });
}

// ============================================
// 2. Automatic HTTP Request Tracking
// ============================================

async function makeTrackedRequest() {
  // Automatically tracked: duration, status, success/failure
  const response = await tls13Axios.get('https://api.example.com/data');
  return response.data;
}

// ============================================
// 3. Manual Event Tracking
// ============================================

function trackUserAction() {
  const monitoring = getMonitoring();
  
  monitoring.trackEvent('UserLogin', 
    { userId: 'user-123', method: 'oauth' },
    { loginDuration: 1250 }
  );
}

// ============================================
// 4. Custom Metrics
// ============================================

function trackCustomMetrics() {
  const monitoring = getMonitoring();
  
  monitoring.trackMetric('CacheHitRate', 0.85, {
    cacheType: 'memory',
    region: 'us-east-1'
  });
  
  monitoring.trackMetric('ActiveUsers', 1523);
}

// ============================================
// 5. Exception Tracking
// ============================================

async function handleError() {
  try {
    await tls13Axios.post('https://api.example.com/data', { value: 123 });
  } catch (error) {
    const monitoring = getMonitoring();
    monitoring.trackException(error, {
      component: 'DataSync',
      operation: 'upload'
    });
  }
}

// ============================================
// 6. Performance Monitoring
// ============================================

async function monitorPerformance() {
  const monitoring = getMonitoring();
  const startTime = Date.now();
  
  try {
    await heavyOperation();
    const duration = Date.now() - startTime;
    
    monitoring.trackMetric('OperationDuration', duration, {
      operation: 'heavyOperation',
      success: 'true'
    });
  } catch (error) {
    monitoring.trackException(error);
  }
}

// ============================================
// 7. Dependency Tracking (External Services)
// ============================================

function trackDependency() {
  const monitoring = getMonitoring();
  
  monitoring.telemetry.trackDependency(
    'DatabaseQuery',
    'SQL',
    'production-db.example.com',
    245, // duration in ms
    true, // success
    200,
    { query: 'SELECT_USERS', rows: 150 }
  );
}

// ============================================
// 8. Complete React Native App Example
// ============================================

import React, { useEffect } from 'react';
import { View, Button } from 'react-native';

function App() {
  useEffect(() => {
    // Initialize monitoring on app start
    initializeMonitoring({
      instrumentationKey: 'YOUR_KEY',
      endpoint: 'https://telemetry.example.com/track',
      appVersion: '1.0.0',
      enabled: __DEV__ ? false : true // Disable in dev
    });

    // Track app launch
    const monitoring = getMonitoring();
    monitoring.trackEvent('AppLaunched', {
      platform: Platform.OS,
      version: Platform.Version
    });

    // Cleanup on unmount
    return () => {
      monitoring.flush();
    };
  }, []);

  const handleApiCall = async () => {
    try {
      const response = await tls13Axios.get('https://api.example.com/users');
      
      getMonitoring().trackEvent('DataFetched', {
        endpoint: '/users',
        count: response.data.length
      });
    } catch (error) {
      getMonitoring().trackException(error);
    }
  };

  return (
    <View>
      <Button title="Fetch Data" onPress={handleApiCall} />
    </View>
  );
}

// ============================================
// 9. Manual Flush (Before App Close)
// ============================================

function onAppClose() {
  const monitoring = getMonitoring();
  monitoring.flush(); // Send remaining telemetry
  monitoring.dispose(); // Cleanup
}

export default App;

// ============================================
// 10. Screenshot Capture on Errors
// ============================================

import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';
import { initializeMonitoring, getMonitoring } from '@keymobile/react-native-secure-http';

function AppWithScreenshots() {
  const appRef = useRef();

  useEffect(() => {
    // Initialize with screenshot support
    initializeMonitoring({
      instrumentationKey: 'YOUR_KEY',
      endpoint: 'https://telemetry.example.com/track',
      captureScreenshotsOnError: true
    });

    // Set the view reference for screenshots
    getMonitoring()?.setScreenshotView(appRef.current);
  }, []);

  return (
    <View ref={appRef}>
      {/* Your app - screenshots captured automatically on errors */}
    </View>
  );
}

// ============================================
// 11. Manual Screenshot Capture
// ============================================

async function captureManualScreenshot() {
  const monitoring = getMonitoring();
  const screenshot = await monitoring.captureScreenshot();
  
  if (screenshot) {
    monitoring.trackEvent('UserFeedback', {
      screenshot,
      rating: 5
    });
  }
}
