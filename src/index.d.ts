export interface HttpRequestConfig {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  baseURL?: string;
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
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
  trackEvent(name: string, properties?: Record<string, any>, measurements?: Record<string, number>): void;
  trackMetric(name: string, value: number, properties?: Record<string, any>): void;
  trackException(error: Error, properties?: Record<string, any>): void;
  trackRequest(name: string, url: string, duration: number, responseCode: number, success: boolean, properties?: Record<string, any>): void;
  trackDependency(name: string, type: string, target: string, duration: number, success: boolean, resultCode: number, properties?: Record<string, any>): void;
  trackTrace(message: string, severity?: string, properties?: Record<string, any>): void;
  flush(): Promise<void>;
  dispose(): void;
}

export interface MonitoringManager {
  telemetry: TelemetryClient;
  trackEvent(name: string, properties?: Record<string, any>, measurements?: Record<string, number>): void;
  trackMetric(name: string, value: number, properties?: Record<string, any>): void;
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
  request: Array<(config: HttpRequestConfig) => HttpRequestConfig | Promise<HttpRequestConfig>>;
  response: Array<(response: HttpResponse) => HttpResponse | Promise<HttpResponse>>;
}

export class SecureHttpClient {
  baseURL: string;
  headers: Record<string, string>;
  timeout: number;
  interceptors: HttpInterceptors;

  constructor(config?: HttpRequestConfig);
  
  request<T = any>(config: HttpRequestConfig): Promise<HttpResponse<T>>;
  get<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  post<T = any>(url: string, data?: any, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  put<T = any>(url: string, data?: any, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  delete<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  patch<T = any>(url: string, data?: any, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
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

export function initializeMonitoring(config: MonitoringConfig): MonitoringManager;

export function getMonitoring(): MonitoringManager | null;

export const tls13Axios: SecureHttpClient;

export function createSecureHttpClient(config?: HttpRequestConfig): SecureHttpClient;

export default createSecureHttpClient;

export { MonitoringManager };
