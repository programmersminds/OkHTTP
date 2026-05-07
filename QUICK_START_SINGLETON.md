# Quick Start: Zero-Recreation HTTP Client

## TL;DR

```javascript
import { createRustHttpClient, rustHttp } from 'react-native-secure-http';

// Option 1: Use default instance (easiest)
const response = await rustHttp.get('/users');

// Option 2: Create custom instance (cached automatically)
const client = createRustHttpClient({ baseURL: 'https://api.example.com' });
const response = await client.get('/users');

// Same config = same instance (no recreation)
const client2 = createRustHttpClient({ baseURL: 'https://api.example.com' });
console.log(client === client2); // true ✅
```

## Why This Matters

### ❌ Old Way (Problematic)
```javascript
function MyComponent() {
  // Creates NEW instance every render
  const client = new RustHttpClient({ baseURL: 'https://api.example.com' });
  
  useEffect(() => {
    // Adds duplicate interceptor every render
    client.interceptors.request.push((config) => config);
  }, []); // ❌ Still recreates on every render
  
  // Result: Memory leak, performance issues, app freeze
}
```

### ✅ New Way (Perfect)
```javascript
function MyComponent() {
  // Returns SAME instance every render (cached)
  const client = createRustHttpClient({ baseURL: 'https://api.example.com' });
  
  useEffect(() => {
    // Add interceptor once (same instance = no duplication)
    const id = client.interceptors.request.use((config) => config);
    return () => client.interceptors.request.eject(id);
  }, []); // ✅ No recreation, no duplication
  
  // Result: Zero issues, perfect performance
}
```

## Common Patterns

### 1. Simple API Calls

```javascript
import { rustHttp } from 'react-native-secure-http';

async function fetchUsers() {
  const response = await rustHttp.get('/users');
  return response.data;
}

async function createUser(userData) {
  const response = await rustHttp.post('/users', userData);
  return response.data;
}
```

### 2. Custom Base URL

```javascript
import { createRustHttpClient } from 'react-native-secure-http';

const apiClient = createRustHttpClient({
  baseURL: 'https://api.example.com',
  timeout: 30000,
});

// Use anywhere - always same instance
export default apiClient;
```

### 3. Authentication Interceptor

```javascript
import { createRustHttpClient } from 'react-native-secure-http';

const client = createRustHttpClient({ baseURL: 'https://api.example.com' });

// Add auth interceptor once (at app startup)
client.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export default client;
```

### 4. React Hook

```javascript
import { useMemo } from 'react';
import { createRustHttpClient } from 'react-native-secure-http';

function useApiClient(baseURL) {
  // useMemo is optional but recommended
  return useMemo(
    () => createRustHttpClient({ baseURL }),
    [baseURL]
  );
}

// Usage
function MyComponent() {
  const client = useApiClient('https://api.example.com');
  
  useEffect(() => {
    client.get('/data').then(console.log);
  }, [client]);
}
```

### 5. Multiple APIs

```javascript
import { createRustHttpClient } from 'react-native-secure-http';

// Each API gets its own cached instance
export const mainApi = createRustHttpClient({
  baseURL: 'https://api.example.com',
});

export const authApi = createRustHttpClient({
  baseURL: 'https://auth.example.com',
});

export const analyticsApi = createRustHttpClient({
  baseURL: 'https://analytics.example.com',
});
```

## Key Rules

### ✅ DO

```javascript
// ✅ Use createRustHttpClient() - it caches automatically
const client = createRustHttpClient({ baseURL: 'https://api.example.com' });

// ✅ Use rustHttp for simple cases
await rustHttp.get('/users');

// ✅ Add interceptors with use() method
const id = client.interceptors.request.use((config) => config);

// ✅ Remove interceptors with eject()
client.interceptors.request.eject(id);

// ✅ Export and reuse clients
export const apiClient = createRustHttpClient({ baseURL: '...' });
```

### ❌ DON'T

```javascript
// ❌ Don't use 'new RustHttpClient()' - it will throw error
const client = new RustHttpClient({ baseURL: '...' }); // Error!

// ❌ Don't push to interceptors array
client.interceptors.request.push((config) => config); // Won't work

// ❌ Don't create client inside render without memoization
function Component() {
  const client = createRustHttpClient({ baseURL: '...' }); // OK but wasteful
  // Better: move outside component or use useMemo
}

// ❌ Don't mutate config
client.config.baseURL = 'new-url'; // Error - config is frozen
```

## Interceptor Management

```javascript
const client = createRustHttpClient({ baseURL: 'https://api.example.com' });

// Add request interceptor
const reqId = client.interceptors.request.use(
  (config) => {
    console.log('Request:', config.url);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor
const resId = client.interceptors.response.use(
  (response) => {
    console.log('Response:', response.status);
    return response;
  },
  (error) => {
    console.error('Response error:', error);
    return Promise.reject(error);
  }
);

// Remove specific interceptor
client.interceptors.request.eject(reqId);

// Clear all interceptors
client.interceptors.request.clear();
client.interceptors.response.clear();

// Check interceptor count
console.log(client.interceptors.request.length); // 0
```

## React Native Example

```javascript
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { createRustHttpClient } from 'react-native-secure-http';

// Create client once (outside component)
const apiClient = createRustHttpClient({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 30000,
});

// Add interceptor once (outside component)
apiClient.interceptors.request.use((config) => {
  console.log('Fetching:', config.url);
  return config;
});

function UsersScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/users')
      .then((response) => {
        setUsers(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  }, []);

  if (loading) return <Text>Loading...</Text>;

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => <Text>{item.name}</Text>}
    />
  );
}

export default UsersScreen;
```

## Advanced: Cleanup

```javascript
import { clearAllInstances } from 'react-native-secure-http';

// Dispose specific instance
const client = createRustHttpClient({ baseURL: 'https://api.example.com' });
client.dispose(); // Removes from cache, cleans up

// Clear all instances (useful for logout or testing)
clearAllInstances();
```

## Troubleshooting

### Issue: "Do not instantiate RustHttpClient directly"
```javascript
// ❌ Wrong
const client = new RustHttpClient({ baseURL: '...' });

// ✅ Correct
const client = createRustHttpClient({ baseURL: '...' });
```

### Issue: Interceptors not working
```javascript
// ❌ Wrong
client.interceptors.request.push((config) => config);

// ✅ Correct
client.interceptors.request.use((config) => config);
```

### Issue: Config not updating
```javascript
// ❌ Wrong - config is frozen
client.config.baseURL = 'new-url';

// ✅ Correct - create new instance
const newClient = createRustHttpClient({ 
  ...client.config, 
  baseURL: 'new-url' 
});
```

## Summary

1. **Use `createRustHttpClient()`** - never `new RustHttpClient()`
2. **Same config = same instance** - automatic caching
3. **Use `rustHttp`** for simple cases
4. **Interceptors with `use()`** - not `push()`
5. **Export and reuse** - create once, use everywhere
6. **Zero recreation** - perfect for React Native

That's it! The singleton pattern handles everything automatically. No special hooks, no complex setup, just works.
