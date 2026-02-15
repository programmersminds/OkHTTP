export interface HttpRequestConfig {
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  baseURL?: string;
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  params?: Record<string, string>;
}

export interface MonitoringConfig {
  instrumentationKey?: string;
  endpoint?: string;
  appVersion?: string;
  userId?: string;
  enabled?: boolean;
  maxBufferSize?: number;
  flushInterval?: number;
  captureScreenshotsOnError?: boolean;
}

export interface TelemetryClient {
  trackEvent(
    name: string,
    properties?: Record<string, any>,
    measurements?: Record<string, number>,
  ): void;
  trackMetric(
    name: string,
    value: number,
    properties?: Record<string, any>,
  ): void;
  trackException(error: Error, properties?: Record<string, any>): void;
  trackRequest(
    name: string,
    url: string,
    duration: number,
    responseCode: number,
    success: boolean,
    properties?: Record<string, any>,
  ): void;
  trackDependency(
    name: string,
    type: string,
    target: string,
    duration: number,
    success: boolean,
    resultCode: number,
    properties?: Record<string, any>,
  ): void;
  trackTrace(
    message: string,
    severity?: string,
    properties?: Record<string, any>,
  ): void;
  flush(): Promise<void>;
  dispose(): void;
}

export interface MonitoringManager {
  telemetry: TelemetryClient;
  trackEvent(
    name: string,
    properties?: Record<string, any>,
    measurements?: Record<string, number>,
  ): void;
  trackMetric(
    name: string,
    value: number,
    properties?: Record<string, any>,
  ): void;
  trackException(error: Error, properties?: Record<string, any>): void;
  setScreenshotView(ref: any): void;
  captureScreenshot(): Promise<string | null>;
  flush(): Promise<void>;
  dispose(): void;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: HttpRequestConfig;
}

export interface HttpInterceptors {
  request: Array<
    (
      config: HttpRequestConfig,
    ) => HttpRequestConfig | Promise<HttpRequestConfig>
  >;
  response: Array<
    (response: HttpResponse) => HttpResponse | Promise<HttpResponse>
  >;
  error: Array<(error: any) => Promise<any>>;
}

export class SecureHttpClient {
  baseURL: string;
  headers: Record<string, string>;
  timeout: number;
  interceptors: HttpInterceptors;

  constructor(config?: HttpRequestConfig);

  create(config?: HttpRequestConfig): SecureHttpClient;
  static isCancel(error: any): boolean;
  isCancel(error: any): boolean;

  request<T = any>(config: HttpRequestConfig): Promise<HttpResponse<T>>;
  get<T = any>(
    url: string,
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>>;
  post<T = any>(
    url: string,
    data?: any,
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>>;
  put<T = any>(
    url: string,
    data?: any,
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>>;
  delete<T = any>(
    url: string,
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>>;
  patch<T = any>(
    url: string,
    data?: any,
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>>;
}

export function isTLSModuleAvailable(): boolean;

export function updateSecurityProvider(): Promise<string>;

export function checkSecurityProviders(): Promise<{
  topProvider: string;
  allProviders: string[];
}>;

export function testTLS13Support(): Promise<{
  conscryptInstalled: boolean;
  topProvider: string;
  tlsVersion: string;
}>;

export function forceTLS13(): Promise<string>;

export function initializeTLS13Axios(): Promise<void>;

export function initializeMonitoring(
  config: MonitoringConfig,
): MonitoringManager;

export function getMonitoring(): MonitoringManager | null;

export function isCancel(error: any): boolean;

export interface TLS13Axios extends SecureHttpClient {
  create(config?: HttpRequestConfig): SecureHttpClient;
  isCancel(error: any): boolean;
}

export const tls13Axios: TLS13Axios;

export function createSecureHttpClient(
  config?: HttpRequestConfig,
): SecureHttpClient;

export default createSecureHttpClient;

// TrustGrid Security Types
export interface DeviceFingerprint {
  fingerprint: string;
  type: "mobile" | "tablet" | "desktop";
  model: string;
  os: string;
  appVersion: string;
  ipAddress?: string;
  userAgent: string;
}

export interface BiometricData {
  faceHash: string;
  livenessScore: number;
  matchConfidence: number;
}

export interface TransactionRequest {
  transactionId: string;
  timestamp: string;
  sender: {
    userId: string;
    name: string;
    phone: string;
    email: string;
    accountAgeDays: number;
  };
  device: DeviceFingerprint;
  biometrics?: BiometricData;
  transaction: {
    type:
      | "bank_transfer"
      | "send_money"
      | "withdrawal"
      | "loan"
      | "crypto"
      | "sim_swap";
    amount: number;
    currency: string;
    recipient: {
      accountNumber?: string;
      bankCode?: string;
      bankName?: string;
      name: string;
    };
  };
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    city: string;
    country: string;
    timezone: string;
  };
  session: {
    sessionId: string;
    durationSeconds: number;
    actionsCount: number;
  };
}

export interface RiskAssessmentResponse {
  transactionId: string;
  decision: "ALLOW" | "CHALLENGE" | "BLOCK";
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  verificationRequired?: {
    method: "OTP_SMS" | "OTP_EMAIL" | "BIOMETRIC_FACE";
    message: string;
    expiresIn: number;
  };
  riskFactors: Array<{
    category: string;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
  }>;
  metadata: {
    processingTimeMs: number;
    checkedSignals: number;
    graphQueries: number;
    decisionConfidence: number;
  };
}

export class TrustGridSecurityClient {
  constructor(config: {
    apiKey: string;
    baseURL: string;
    monitoringConfig?: MonitoringConfig;
  });

  assessTransaction(
    request: TransactionRequest,
  ): Promise<RiskAssessmentResponse>;

  verifyChallenge(
    transactionId: string,
    verificationCode: string,
    method: "OTP_SMS" | "OTP_EMAIL" | "BIOMETRIC_FACE",
  ): Promise<{ verified: boolean; allowTransaction: boolean }>;

  reportFraud(
    transactionId: string,
    reason: string,
    evidence?: Record<string, any>,
  ): Promise<void>;

  checkDeviceReputation(
    deviceFingerprint: string,
  ): Promise<{ trustScore: number; fraudCount: number; riskLevel: string }>;

  checkRecipientReputation(
    accountNumber: string,
    bankCode: string,
  ): Promise<{
    riskScore: number;
    fraudReports: number;
    moneyMuleScore: number;
  }>;
}

export function useTrustGrid(options: {
  apiKey: string;
  baseURL: string;
  enableMonitoring?: boolean;
  monitoringEndpoint?: string;
}): {
  isInitialized: boolean;
  assessTransaction: (
    data: Omit<TransactionRequest, "device" | "location" | "timestamp">,
  ) => Promise<RiskAssessmentResponse>;
  verifyChallenge: (
    transactionId: string,
    code: string,
    method: "OTP_SMS" | "OTP_EMAIL" | "BIOMETRIC_FACE",
  ) => Promise<{ verified: boolean; allowTransaction: boolean }>;
  reportFraud: (
    transactionId: string,
    reason: string,
    evidence?: Record<string, any>,
  ) => Promise<void>;
  client: TrustGridSecurityClient | null;
};

export function generateDeviceFingerprint(): Promise<DeviceFingerprint>;
export function getCurrentLocation(): Promise<TransactionRequest["location"]>;
