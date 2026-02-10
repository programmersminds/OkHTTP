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
