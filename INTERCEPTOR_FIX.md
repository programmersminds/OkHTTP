# RustHttpClient Interceptor Fix

## Problem
The RustHttpClient had several issues causing re-rendering and freezing:

1. **Interceptor Array Duplication**: Interceptors were stored as simple arrays that could accumulate duplicates on every re-render
2. **No Interceptor Management**: No way to remove or clear interceptors once added
3. **Memory Leaks**: No cleanup method to dispose of timers and queued requests
4. **Initialization Issues**: Client could re-initialize multiple times

## Solution

### 1. Axios-Compatible Interceptor System
Changed from simple arrays to a proper interceptor management system:

```javascript
// Before (problematic):
this.interceptors = {
  request: [],
  response: [],
  error: []
};

// After (fixed):
this.interceptors = {
  request: {
    handlers: [],
    use: (fulfilled, rejected) => { /* returns id */ },
    eject: (id) => { /* removes by id */ },
    clear: () => { /* removes all */ }
  },
  response: {
    handlers: [],
    use: (fulfilled, rejected) => { /* returns id */ },
    eject: (id) => { /* removes by id */ },
    clear: () => { /* removes all */ }
  }
};
```

### 2. Proper Interceptor Execution
Updated the request method to use the new handler structure:

```javascript
// Apply request interceptors
const requestHandlers = this.interceptors.request.handlers || [];

for (const handler of requestHandlers) {
  if (handler.fulfilled) {
    config = await Promise.resolve(handler.fulfilled(config));
  }
}
```

### 3. Initialization Guard
Added `_isInitialized` flag to prevent multiple initializations:

```javascript
async _initializeRustClient() {
  if (this._isInitialized) {
    return true;
  }
  // ... initialization code
  this._isInitialized = true;
}
```

### 4. Memory Leak Prevention
Added `dispose()` method to clean up resources:

```javascript
dispose() {
  if (this.batchTimer) {
    clearTimeout(this.batchTimer);
    this.batchTimer = null;
  }
  this.requestQueue = [];
  this.metrics.clear();
  this.interceptors.request.clear();
  this.interceptors.response.clear();
}
```

### 5. Instance Creation Fix
Updated `create()` method to not copy interceptors (prevents duplication):

```javascript
create(config = {}) {
  const newInstance = new RustHttpClient({ ...this.config, ...config });
  // Don't copy interceptors - let users add them explicitly
  return newInstance;
}
```

## Usage Examples

### Adding Interceptors (Won't Duplicate)
```javascript
const client = createRustHttpClient({ baseURL: 'https://api.example.com' });

// Add request interceptor - returns ID
const requestId = client.interceptors.request.use(
  (config) => {
    config.headers['Authorization'] = 'Bearer token';
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor
const responseId = client.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);

// Remove specific interceptor
client.interceptors.request.eject(requestId);

// Clear all interceptors
client.interceptors.request.clear();
client.interceptors.response.clear();
```

### Cleanup on Unmount
```javascript
useEffect(() => {
  const client = createRustHttpClient();
  
  // Add interceptors
  const reqId = client.interceptors.request.use(/* ... */);
  
  return () => {
    // Cleanup on unmount
    client.dispose();
  };
}, []);
```

### Creating New Instances (No Interceptor Leakage)
```javascript
const baseClient = createRustHttpClient({ baseURL: 'https://api.example.com' });

// Add interceptor to base client
baseClient.interceptors.request.use((config) => {
  console.log('Base interceptor');
  return config;
});

// Create new instance - won't have base client's interceptors
const newClient = baseClient.create({ timeout: 5000 });
// newClient has NO interceptors - clean slate
```

## Benefits

1. **No More Duplicates**: Interceptors are properly managed with IDs
2. **Memory Safe**: Can remove interceptors and dispose of clients
3. **React-Friendly**: Safe to use in React components without accumulation
4. **Axios-Compatible**: Same API as Axios interceptors
5. **Performance**: Prevents initialization loops and memory leaks

## TypeScript Support

Updated type definitions include:

```typescript
interface HttpInterceptorHandler<T = any> {
  fulfilled?: (value: T) => T | Promise<T>;
  rejected?: (error: any) => any;
  id: number;
}

interface HttpInterceptorManager<T = any> {
  handlers: HttpInterceptorHandler<T>[];
  use(fulfilled?: (value: T) => T | Promise<T>, rejected?: (error: any) => any): number;
  eject(id: number): void;
  clear(): void;
}

class RustHttpClient {
  interceptors: RustHttpInterceptors;
  dispose(): void;
  // ... other methods
}
```

## Migration Guide

If you were using interceptors before:

```javascript
// Old way (will break):
client.interceptors.request.push((config) => config);

// New way:
const id = client.interceptors.request.use((config) => config);

// To remove:
client.interceptors.request.eject(id);
```

## Testing

After this fix:
1. Clear Metro cache: `npx react-native start --reset-cache`
2. Rebuild the app
3. Test that interceptors work correctly
4. Verify no freezing on re-renders
5. Check that `dispose()` cleans up properly
