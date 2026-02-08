import { createSecureHttpClient, tls13Axios, initializeTLS13Axios } from '@keymobile/react-native-secure-http';

// Initialize TLS 1.3 support
await initializeTLS13Axios();

// Example 1: Using the global tls13Axios instance
const response = await tls13Axios.get('https://api.example.com/users');
console.log(response.data);

// Example 2: POST request
const postResponse = await tls13Axios.post('https://api.example.com/users', {
  name: 'John Doe',
  email: 'john@example.com'
});
console.log(postResponse.status); // 201

// Example 3: Custom client with base URL
const apiClient = createSecureHttpClient({
  baseURL: 'https://api.example.com',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

const users = await apiClient.get('/users');
const user = await apiClient.get('/users/123');

// Example 4: Using interceptors
apiClient.interceptors.request.push((config) => {
  console.log('Request:', config.method, config.url);
  return config;
});

apiClient.interceptors.response.push((response) => {
  console.log('Response:', response.status);
  return response;
});

// Example 5: All HTTP methods
await apiClient.get('/endpoint');
await apiClient.post('/endpoint', { data: 'value' });
await apiClient.put('/endpoint/1', { data: 'updated' });
await apiClient.patch('/endpoint/1', { field: 'value' });
await apiClient.delete('/endpoint/1');

// Example 6: Error handling
try {
  await apiClient.get('/not-found');
} catch (error) {
  console.error('Status:', error.response?.status);
  console.error('Message:', error.message);
}
