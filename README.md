# React Native Secure HTTP

Simple React Native HTTP client with:

- an axios-like API built on `fetch`
- request/response interceptors
- Android TLS helper functions for older devices

## Install

```bash
npm install git+https://github.com/programmersminds/OkHTTP.git
```

For iOS:

```bash
cd ios && pod install && cd ..
```

## Usage

```js
import { createSecureHttpClient } from "react-native-secure-http";

const api = createSecureHttpClient({
  baseURL: "https://api.example.com",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

const users = await api.get("/users", {
  params: { page: 1 },
});

const login = await api.post("/login", {
  username: "john",
  password: "secret",
});
```

You can also use the instance directly like axios:

```js
const response = await api({
  url: "/profile",
  method: "GET",
});
```

## Interceptors

```js
api.interceptors.request.use(async (config) => {
  config.headers = {
    ...config.headers,
    Authorization: "Bearer token",
  };
  return config;
});

api.interceptors.response.use((response) => {
  return response;
});

api.interceptors.error.use((error) => {
  return Promise.reject(error);
});
```

## TLS Helpers

```js
import {
  tls13Axios,
  isTLSModuleAvailable,
  updateSecurityProvider,
  forceTLS13,
} from "react-native-secure-http";
```

`tls13Axios` is just a preconfigured client with a longer timeout. On Android, the TLS helper methods call the native `TLSSecurityModule` when it is available.

## Exports

- `createSecureHttpClient`
- `tls13Axios`
- `isCancel`
- `isTLSModuleAvailable`
- `updateSecurityProvider`
- `checkSecurityProviders`
- `testTLS13Support`
- `forceTLS13`
- `initializeTLS13Axios`
