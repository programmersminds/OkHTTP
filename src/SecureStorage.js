import { NativeModules } from 'react-native';

const { SecureHttpCrypto } = NativeModules;

class SecureStorage {
  static async storeKey(key, value) {
    if (SecureHttpCrypto) {
      return await SecureHttpCrypto.storeKey(key, value);
    }
    throw new Error('Rust crypto module not available');
  }

  static async getKey(key) {
    if (SecureHttpCrypto) {
      return await SecureHttpCrypto.getKey(key);
    }
    throw new Error('Rust crypto module not available');
  }

  static async removeKey(key) {
    if (SecureHttpCrypto) {
      return await SecureHttpCrypto.removeKey(key);
    }
    throw new Error('Rust crypto module not available');
  }

  static async generateAndStoreKey() {
    if (SecureHttpCrypto) {
      const key = await SecureHttpCrypto.generateKey();
      await this.storeKey('CRYPTO_KEY', key);
      return key;
    }
    throw new Error('Rust crypto module not available');
  }

  static async getOrCreateKey() {
    let key = await this.getKey('CRYPTO_KEY');
    if (!key) {
      key = await this.generateAndStoreKey();
    }
    return key;
  }
}

export default SecureStorage;
