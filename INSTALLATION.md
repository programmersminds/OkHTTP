
### Using npm
```bash
npm install git+https://github.com/programmersminds/OkHTTP.git
```
  "files": [
    "src/index.d.ts",
    "README.md",
    "LICENSE"
  ],
### Using yarn
```bash
yarn add git+https://github.com/programmersminds/OkHTTP.git
```

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

## 🎯 Complete Example

```javascript
import { 
  tls13Axios, 
  SecureStorage, 
  validateSecurityOrThrow 
} from "react-native-secure-http";
import sha512 from "@cryptography/sha512";
import moment from "moment";

// rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios 2>&1

// react-native-secure-http/rust-crypto && cargo build --release --target aarch64-apple-ios-sim 2>&1 && cargo build --release --target x86_64-apple-ios 2>&1


// Check security on app start
export async function initializeSecurity() {
  const security = await SecurityValidator.isDeviceSecure();
  if (!security.secure) {
    throw new Error('Device security check failed');
  }
}

// Create secure API client
const createAxiosInstance = () => {
  const instance = tls13Axios.create({
    baseURL: 'https://api.example.com',
    timeout: 40000,
  });

  // Security validation
  instance.interceptors.request.push(async (config) => {
    await validateSecurityOrThrow();
    
    const timestamp = moment().utc().format().substr(0, 19).replace(/[^0-9]/g, "");
    const apiKey = sha512(`${SECRET_KEY}:${IV_KEY}:${timestamp}:${USERNAME}`, "hex");
    
    config.headers = {
      ...config.headers,
      USERNAME: USERNAME,
      API_KEY: apiKey,
      timestamp,
    };
    
    return config;
  });

  // Secure caching
  instance.interceptors.response.push(async (response) => {
    if (response.status === 200 && response.config.url) {
      await SecureStorage.setItem(`cache_${response.config.url}`, {
        data: response.data,
        timestamp: Date.now(),
      });
    }
    return response;
  });

  return instance;
};

export const apiClient = createAxiosInstance();
```