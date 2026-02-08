// Example 1: Using tls13Axios (Recommended)
import { tls13Axios, initializeTLS13Axios } from '@keymobile/react-native-secure-http';

// Initialize once in App.js or index.js
async function initializeApp() {
  try {
    await initializeTLS13Axios();
    console.log('TLS 1.3 initialized successfully');
  } catch (error) {
    console.error('TLS initialization failed:', error);
  }
}

// Use in your API calls
async function fetchUserData() {
  try {
    const response = await tls13Axios.get('https://api.example.com/user');
    return response.data;
  } catch (error) {
    console.error('API call failed:', error);
  }
}

async function createUser(userData) {
  try {
    const response = await tls13Axios.post('https://api.example.com/user', userData);
    return response.data;
  } catch (error) {
    console.error('Create user failed:', error);
  }
}

// Example 2: Using createSecureHttpClient for custom instances
import { createSecureHttpClient } from '@keymobile/react-native-secure-http';

const apiClient = createSecureHttpClient({
  baseURL: 'https://api.example.com',
  timeout: 60000,
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
  },
});

async function fetchData() {
  const response = await apiClient.get('/endpoint');
  return response.data;
}

// Example 3: Check TLS support
import { 
  checkSecurityProviders, 
  testTLS13Support,
  isTLSModuleAvailable 
} from '@keymobile/react-native-secure-http';

async function checkTLSStatus() {
  if (!isTLSModuleAvailable()) {
    console.log('TLS module not available on this platform');
    return;
  }

  const providers = await checkSecurityProviders();
  console.log('Top Provider:', providers.topProvider);
  console.log('All Providers:', providers.allProviders);

  const tlsSupport = await testTLS13Support();
  console.log('Conscrypt Installed:', tlsSupport.conscryptInstalled);
  console.log('TLS Version:', tlsSupport.tlsVersion);
}

// Example 4: Force TLS 1.3
import { forceTLS13 } from '@keymobile/react-native-secure-http';

async function enableTLS13() {
  try {
    const result = await forceTLS13();
    console.log(result);
  } catch (error) {
    console.error('Failed to force TLS 1.3:', error);
  }
}

export { initializeApp, fetchUserData, createUser, checkTLSStatus, enableTLS13 };
