import { NativeModules } from 'react-native';

const { SecureHttpCrypto } = NativeModules;

const CryptoUtils = {
  async encrypt(plaintext, key) {
    if (SecureHttpCrypto) {
      return await SecureHttpCrypto.encrypt(plaintext, key);
    }
    throw new Error('Native module not available');
  },

  async decrypt(ciphertext, key) {
    if (SecureHttpCrypto) {
      return await SecureHttpCrypto.decrypt(ciphertext, key);
    }
    throw new Error('Native not available');
  },

  async sign(data, timestamp, key) {
    if (SecureHttpCrypto) {
      return await SecureHttpCrypto.sign(data, timestamp, key);
    }
    throw new Error('Native module not available');
  },

  generateNonce() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'?.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },
};

export default CryptoUtils;

// In-memory fallback store when native crypto module is unavailable
const _memoryStore = {};

// Secure Storage API
export const SecureStorage = {
  async setItem(key, value) {
    const stored = typeof value === 'string' ? value : JSON.stringify(value);
    if (SecureHttpCrypto) {
      const success = await SecureHttpCrypto.storeKey(key, stored);
      if (!success) throw new Error('Failed to store item securely');
    } else {
      _memoryStore[key] = stored;
    }
  },

  async getItem(key) {
    if (SecureHttpCrypto) {
      const value = await SecureHttpCrypto.getKey(key);
      if (value === null || value === undefined) return null;
      if (typeof value === 'string') return value;
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'string' ? parsed : String(parsed);
      } catch {
        return String(value);
      }
    } else {
      return _memoryStore[key] ?? null;
    }
  },

  async removeItem(key) {
    if (SecureHttpCrypto) {
      return await SecureHttpCrypto.removeKey(key);
    } else {
      delete _memoryStore[key];
    }
  },

  async clear() {
    if (SecureHttpCrypto) {
      return await SecureHttpCrypto.clearStorage();
    } else {
      Object.keys(_memoryStore).forEach((k) => delete _memoryStore[k]);
    }
  },
};
