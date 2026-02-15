import { NativeModules, Platform } from 'react-native';

const { TLSSecurityModule } = NativeModules;

export const SecurityValidator = {
  async isDeviceSecure() {
    const checks = {
      isRooted: await this.isRooted(),
      hasProxyEnabled: await this.hasProxyEnabled(),
      isCertificateTampered: await this.isCertificateTampered(),
    };

    return {
      secure: !checks.isRooted && !checks.hasProxyEnabled && !checks.isCertificateTampered,
      ...checks,
    };
  },

  async isRooted() {
    if (Platform.OS === 'android') {
      try {
        const { RootDetection } = NativeModules;
        if (RootDetection) {
          return await RootDetection.isRooted();
        }
      } catch (e) {}
    }
    return false;
  },

  async hasProxyEnabled() {
    if (Platform.OS === 'android') {
      try {
        const { ProxyDetection } = NativeModules;
        if (ProxyDetection) {
          return await ProxyDetection.hasProxy();
        }
      } catch (e) {}
    }
    return false;
  },

  async isCertificateTampered() {
    try {
      if (TLSSecurityModule) {
        return await TLSSecurityModule.isCertificateTampered();
      }
    } catch (e) {}
    return false;
  },

  blockInsecureDevice() {
    throw new Error(
      'Security violation detected. This device is not secure for sensitive operations.'
    );
  },
};

export async function validateSecurityOrThrow() {
  const security = await SecurityValidator.isDeviceSecure();
  
  if (!security.secure) {
    const reasons = [];
    if (security.isRooted) reasons.push('Device is rooted/jailbroken');
    if (security.hasProxyEnabled) reasons.push('Proxy detected');
    if (security.isCertificateTampered) reasons.push('Certificate tampering detected');
    
    throw new Error(`Security check failed: ${reasons.join(', ')}`);
  }
  
  return true;
}
