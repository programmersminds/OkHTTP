# Migration Guide: Singleton Pattern

## Overview

This guide helps you migrate from the old RustHttpClient implementation to the new professional singleton pattern.

## Breaking Changes

### 1. Constructor is Now Private

**Before:**
```javascript
const client = new RustHttpClient({ baseURL: 'https://api.example.com' });
```

**After:**
```javascript
const client = createRustHttpClient({ baseURL: 'https://api.example.com' });
```

**Why:** Prevents accidental recreation and enforces singleton pattern.

### 2. Interceptor API Changed

**Before:**
```javascript
client.interceptors.request.push((config) => {
  config.headers['Authorization'] = 'Bearer token';
  return config;
});
```

**After:**
```javascript
const id = client.interceptors.request.use(
  (config) => {
    config.headers['Authorization'] = 'Bearer token';
    return config;
  },
  (error) => Promise.reject(error)
);

// To remove:
client.interceptors.request.eject(id);
```

**Why:** Axios-compatible API with proper management and no duplication.

### 3. Config is Now Immutable

**Before:**
```javascript
client.config.baseURL = 'https://new-api.example.com';
```

**After:**
```javascript
// Create new instance with updated config
const newClient = createRustHttpClient({
  ...client.config,
  baseURL: 'https://new-api.example.com'
});
```

**Why:** Prevents accidental mutations and ensures cache integrity.

## Migration Steps

### Step 1: Update Imports

**Before:**
```javascript
import RustHttpClient from 'react-native-secure-http';
```

**After:**
```javascript
import { createRustHttpClient, rustHttp } from 'react-native-secure-http';
```

### Step 2: Replace Constructor Calls

Find all instances of `new RustHttpClient()` and replace with `createRustHttpClient()`.

**Search for:**
```javascript
new RustHttpClient(
```

**Replace with:**
```javascript
createRustHttpClient(
```

### Step 3: Update Interceptors

Find all interceptor additions and update to use `use()` method.

**Before:**
```javascript
client.interceptors.request.push((config) => {
  // modify config
  return config;
});

client.interceptors.response.push((response) => {
  // modify response
  return response;
});
```

**After:**
```javascript
const requestId = client.interceptors.request.use(
  (config) => {
    // modify config
    return config;
  },
  (error) => Promise.reject(error)
);

const responseId = client.interceptors.response.use(
  (response) => {
    // modify response
    return response;
  },
  (error) => Promise.reject(error)
);

// Store IDs if you need to remove interceptors later
```

### Step 4: Add Cleanup (Optional)

If you're creating clients dynamically, add cleanup:

**Before:**
```javascript
useEffect(() => {
  const client = new RustHttpClient({ baseURL: url });
  
  client.interceptors.request.push((config) => config);
  
  // No cleanup
}, [url]);
```

**After:**
```javascript
useEffect(() => {
  const client = createRustHttpClient({ baseURL: url });
  
  const id = client.interceptors.request.use((config) => config);
  
  return () => {
    client.interceptors.request.eject(id);
    // Optional: dispose if you're sure no one else is using it
    // client.dispose();
  };
}, [url]);
```

### Step 5: Remove Config Mutations

Find and fix any code that mutates config:

**Before:**
```javascript
client.config.timeout = 60000;
client.config.headers['X-Custom'] = 'value';
```

**After:**
```javascript
// Create new instance with updated config
const newClient = createRustHttpClient({
  ...client.config,
  timeout: 60000,
  headers: {
    ...client.config.headers,
    'X-Custom': 'value'
  }
});
```

## Common Patterns

### Pattern 1: Global API Client

**Before:**
```javascript
// api.js
import RustHttpClient from 'react-native-secure-http';

export const apiClient = new RustHttpClient({
  baseURL: 'https://api.example.com',
  timeout: 30000,
});

// Add interceptors
apiClient.interceptors.request.push((config) => {
  const token = getToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});
```

**After:**
```javascript
// api.js
import { createRustHttpClient } from 'react-native-secure-http';

export const apiClient = createRustHttpClient({
  baseURL: 'https://api.example.com',
  timeout: 30000,
});

// Add interceptors
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});
```

### Pattern 2: React Component

**Before:**
```javascript
function MyComponent() {
  const [client] = useState(() => 
    new RustHttpClient({ baseURL: 'https://api.example.com' })
  );
  
  useEffect(() => {
    client.interceptors.request.push((config) => config);
  }, []);
  
  // ...
}
```

**After:**
```javascript
function MyComponent() {
  // No useState needed - createRustHttpClient caches automatically
  const client = createRustHttpClient({ baseURL: 'https://api.example.com' });
  
  useEffect(() => {
    const id = client.interceptors.request.use((config) => config);
    return () => client.interceptors.request.eject(id);
  }, []);
  
  // ...
}
```

### Pattern 3: Custom Hook

**Before:**
```javascript
function useApiClient(baseURL) {
  const [client] = useState(() => 
    new RustHttpClient({ baseURL })
  );
  
  return client;
}
```

**After:**
```javascript
function useApiClient(baseURL) {
  return useMemo(
    () => createRustHttpClient({ baseURL }),
    [baseURL]
  );
}
```

### Pattern 4: Multiple Clients

**Before:**
```javascript
const mainApi = new RustHttpClient({ baseURL: 'https://api.example.com' });
const authApi = new RustHttpClient({ baseURL: 'https://auth.example.com' });
```

**After:**
```javascript
const mainApi = createRustHttpClient({ baseURL: 'https://api.example.com' });
const authApi = createRustHttpClient({ baseURL: 'https://auth.example.com' });
```

## Automated Migration Script

You can use this script to help with migration:

```bash
#!/bin/bash

# Find and replace constructor calls
find . -type f -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | \
  xargs sed -i '' 's/new RustHttpClient(/createRustHttpClient(/g'

# Find files with interceptor.push (manual review needed)
echo "Files with interceptor.push (need manual review):"
grep -r "interceptors\\.request\\.push\\|interceptors\\.response\\.push" . \
  --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"

echo "Migration script complete. Please review interceptor changes manually."
```

## Testing Your Migration

After migration, test these scenarios:

### 1. Instance Caching
```javascript
const client1 = createRustHttpClient({ baseURL: 'https://api.example.com' });
const client2 = createRustHttpClient({ baseURL: 'https://api.example.com' });

console.log(client1 === client2); // Should be true
```

### 2. Interceptors
```javascript
const client = createRustHttpClient({ baseURL: 'https://api.example.com' });

const id = client.interceptors.request.use((config) => {
  console.log('Request:', config.url);
  return config;
});

// Make request - should see log
await client.get('/test');

// Remove interceptor
client.interceptors.request.eject(id);

// Make request - should NOT see log
await client.get('/test');
```

### 3. Re-renders
```javascript
function TestComponent() {
  const [count, setCount] = useState(0);
  
  const client = createRustHttpClient({ baseURL: 'https://api.example.com' });
  
  useEffect(() => {
    console.log('Client instance:', client);
  }, [client]);
  
  // Click button multiple times
  // Should see same client instance logged
  return <Button onPress={() => setCount(c => c + 1)} />;
}
```

## Troubleshooting

### Error: "Do not instantiate RustHttpClient directly"

**Cause:** Using `new RustHttpClient()` instead of `createRustHttpClient()`

**Fix:**
```javascript
// ❌ Wrong
const client = new RustHttpClient({ baseURL: '...' });

// ✅ Correct
const client = createRustHttpClient({ baseURL: '...' });
```

### Error: "interceptors.request.push is not a function"

**Cause:** Using old interceptor API

**Fix:**
```javascript
// ❌ Wrong
client.interceptors.request.push((config) => config);

// ✅ Correct
client.interceptors.request.use((config) => config);
```

### Error: "Cannot assign to read only property 'baseURL'"

**Cause:** Trying to mutate frozen config

**Fix:**
```javascript
// ❌ Wrong
client.config.baseURL = 'new-url';

// ✅ Correct
const newClient = createRustHttpClient({
  ...client.config,
  baseURL: 'new-url'
});
```

### Interceptors Duplicating

**Cause:** Adding interceptors inside component without cleanup

**Fix:**
```javascript
// ❌ Wrong
function Component() {
  const client = createRustHttpClient({ baseURL: '...' });
  
  useEffect(() => {
    client.interceptors.request.use((config) => config);
    // No cleanup
  }, []);
}

// ✅ Correct
function Component() {
  const client = createRustHttpClient({ baseURL: '...' });
  
  useEffect(() => {
    const id = client.interceptors.request.use((config) => config);
    return () => client.interceptors.request.eject(id);
  }, []);
}
```

## Rollback Plan

If you need to rollback:

1. Keep old version in package.json
2. Use git to revert changes
3. Clear node_modules and reinstall

```bash
# Revert to previous version
npm install react-native-secure-http@<previous-version>

# Or with yarn
yarn add react-native-secure-http@<previous-version>

# Clear cache
npx react-native start --reset-cache

# Rebuild
npx react-native run-ios
npx react-native run-android
```

## Benefits After Migration

✅ **Zero Recreation** - Same config always returns same instance
✅ **Zero Memory Leaks** - Proper cleanup and disposal
✅ **Zero Interceptor Duplication** - Managed with IDs
✅ **Better Performance** - No unnecessary object creation
✅ **Type Safety** - Full TypeScript support with immutability
✅ **Axios Compatible** - Familiar API for developers

## Support

If you encounter issues during migration:

1. Check this guide for common patterns
2. Review QUICK_START_SINGLETON.md for examples
3. Check SINGLETON_ARCHITECTURE.md for technical details
4. Open an issue with your specific case

## Timeline

Recommended migration timeline:

- **Week 1**: Update imports and constructor calls
- **Week 2**: Update interceptor API
- **Week 3**: Test thoroughly in development
- **Week 4**: Deploy to production

Take your time and test thoroughly at each step.
