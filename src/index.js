import { NativeModules, Platform } from "react-native";
import createSecureHttpClient, { isCancel } from "./SecureHttpClient";

const { TLSSecurityModule } = NativeModules;

let tlsInitialized = false;

async function initializeTLSIfNeeded() {
  if (tlsInitialized || Platform.OS !== "android" || !TLSSecurityModule) {
    return;
  }

  try {
    await TLSSecurityModule.updateSecurityProvider();
    await TLSSecurityModule.forceTLS13();
    tlsInitialized = true;
  } catch (error) {
    console.warn("TLS auto-initialization failed:", error?.message);
  }
}

(async function autoInitializeTLS() {
  await initializeTLSIfNeeded();
})();

export const isTLSModuleAvailable = () => {
  return Platform.OS === "android" && TLSSecurityModule != null;
};

export const updateSecurityProvider = async () => {
  if (Platform.OS !== "android") {
    return "iOS does not require security provider updates";
  }

  if (!TLSSecurityModule) {
    throw new Error("TLS Security Module not available. Rebuild the app.");
  }

  return TLSSecurityModule.updateSecurityProvider();
};

export const checkSecurityProviders = async () => {
  if (Platform.OS !== "android") {
    return { topProvider: "iOS", allProviders: ["iOS Security"] };
  }

  if (!TLSSecurityModule) {
    throw new Error("TLS Security Module not available");
  }

  return TLSSecurityModule.checkSecurityProviders();
};

export const testTLS13Support = async () => {
  if (Platform.OS !== "android") {
    return {
      conscryptInstalled: false,
      topProvider: "iOS",
      tlsVersion: "TLS 1.3",
    };
  }

  if (!TLSSecurityModule) {
    throw new Error("TLS Security Module not available");
  }

  return TLSSecurityModule.testTLS13Support();
};

export const forceTLS13 = async () => {
  if (Platform.OS !== "android") {
    return "iOS uses TLS 1.3 by default";
  }

  if (!TLSSecurityModule) {
    throw new Error("TLS Security Module not available");
  }

  return TLSSecurityModule.forceTLS13();
};

export const initializeTLS13Axios = async () => {
  await initializeTLSIfNeeded();
};

export const tls13Axios = createSecureHttpClient({
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

export { createSecureHttpClient, isCancel };

export default createSecureHttpClient;
