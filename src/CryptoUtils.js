import { NativeModules } from 'react-native';

const { SecureHttpCrypto } = NativeModules;

const CryptoUtils = {
  async encrypt(plaintext, key) {
    if (SecureHttpCrypto) {
      return await SecureHttpCrypto.encrypt(plaintext, key);
    }
    throw new Error('Rust crypto module not available');
  },

  async decrypt(ciphertext, key) {
    if (SecureHttpCrypto) {
      return await SecureHttpCrypto.decrypt(ciphertext, key);
    }
    throw new Error('Rust crypto module not available');
  },

  async sign(data, timestamp, key) {
    if (SecureHttpCrypto) {
      return await SecureHttpCrypto.sign(data, timestamp, key);
    }
    throw new Error('Rust crypto module not available');
  },

  generateNonce() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },
};

export default CryptoUtils;

// Secure Storage API
export const SecureStorage = {
  async setItem(key, value) {
    if (!SecureHttpCrypto) {
      throw new Error('Rust crypto module not available');
    }
    const success = await SecureHttpCrypto.storeKey(key, JSON.stringify(value));
    if (!success) {
      throw new Error('Failed to store item securely');
    }
  },

  async getItem(key) {
    if (!SecureHttpCrypto) {
      throw new Error('Rust crypto module not available');
    }
    const value = await SecureHttpCrypto.getKey(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  },

  async removeItem(key) {
    if (!SecureHttpCrypto) {
      throw new Error('Rust crypto module not available');
    }
    return await SecureHttpCrypto.removeKey(key);
  },

  async clear() {
    if (!SecureHttpCrypto) {
      throw new Error('Rust crypto module not available');
    }
    return await SecureHttpCrypto.clearStorage();
  },
};
