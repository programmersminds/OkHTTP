export interface HttpRequestConfig {
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  baseURL?: string;
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  params?: Record<string, string | number | boolean | Array<string | number | boolean>>;
  signal?: AbortSignal;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: HttpRequestConfig;
}

export interface HttpInterceptorManager<T = any> {
  use(
    fulfilled?: (value: T) => T | Promise<T>,
    rejected?: (error: any) => any,
  ): number;
  eject(id: number): void;
  clear(): void;
  forEach(callback: (handler: any) => void): void;
}

export interface HttpInterceptors {
  request: HttpInterceptorManager<HttpRequestConfig>;
  response: HttpInterceptorManager<HttpResponse>;
  error: HttpInterceptorManager<any>;
}

export interface SecureHttpDefaults {
  baseURL: string;
  headers: Record<string, string>;
  timeout: number;
}

export class SecureHttpClient {
  baseURL: string;
  headers: Record<string, string>;
  timeout: number;
  defaults: SecureHttpDefaults;
  interceptors: HttpInterceptors;

  constructor(config?: HttpRequestConfig);

  create(config?: HttpRequestConfig): SecureHttpInstance;
  static isCancel(error: any): boolean;
  isCancel(error: any): boolean;

  request<T = any>(config: HttpRequestConfig): Promise<HttpResponse<T>>;
  get<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  post<T = any>(url: string, data?: any, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  put<T = any>(url: string, data?: any, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  delete<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  patch<T = any>(url: string, data?: any, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
}

export interface SecureHttpInstance {
  <T = any>(config: HttpRequestConfig): Promise<HttpResponse<T>>;
  request<T = any>(config: HttpRequestConfig): Promise<HttpResponse<T>>;
  get<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  post<T = any>(url: string, data?: any, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  put<T = any>(url: string, data?: any, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  delete<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  patch<T = any>(url: string, data?: any, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  create(config?: HttpRequestConfig): SecureHttpInstance;
  defaults: SecureHttpDefaults;
  interceptors: HttpInterceptors;
  isCancel(error: any): boolean;
  raw: SecureHttpClient;
}

export function createSecureHttpClient(config?: HttpRequestConfig): SecureHttpInstance;
export namespace createSecureHttpClient {
  let isCancel: typeof SecureHttpClient.isCancel;
}

export function createHermesClient(config?: HttpRequestConfig): SecureHttpInstance;
export namespace createHermesClient {
  let isCancel: typeof SecureHttpClient.isCancel;
}

export const isCancel: typeof SecureHttpClient.isCancel;
export const tls13Axios: SecureHttpInstance;

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

export default createSecureHttpClient;
