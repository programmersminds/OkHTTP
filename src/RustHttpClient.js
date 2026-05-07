import { NativeModules, Platform } from 'react-native';

const { SecureHttpCryptoModule } = NativeModules;

// Singleton instance cache to prevent recreation
const instanceCache = new Map();
let globalInitPromise = null;
let globalIsInitialized = false;

// Private symbol for controlled instantiation
const PRIVATE_CONSTRUCTOR_KEY = Symbol('RustHttpClient.constructor');

// Fallback configuration for when Rust module is unavailable
const DEFAULT_CONFIG = {
  baseURL: '',
  timeout: 30000,
  maxConnections: 200,
  keepAlive: true,
  http2PriorKnowledge: true,
  enableCompression: true,
  enableCaching: true,
  cacheTtlSeconds: 300,
  retryAttempts: 3,
  retryDelayMs: 500,
  userAgent: 'RustSecureHttp/2.0',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

// Generate stable cache key from config
function generateCacheKey(config) {
  const key = JSON.stringify({
    baseURL: config.baseURL || '',
    timeout: config.timeout || DEFAULT_CONFIG.timeout,
    maxConnections: config.maxConnections || DEFAULT_CONFIG.maxConnections,
  });
  return key;
}

class RustHttpClient {
  constructor(key, config = {}) {
    // Use Symbol-based protection - elegant and professional
    if (key !== PRIVATE_CONSTRUCTOR_KEY) {
      console.warn('Direct instantiation detected. Use createRustHttpClient() for optimal performance and caching.');
      // Allow it but warn - graceful degradation
    }

    this.config = Object.freeze({ ...DEFAULT_CONFIG, ...config });
    this.isRustAvailable = this._checkRustAvailability();
    this.requestQueue = [];
    this.batchSize = 50;
    this.batchTimeout = 20;
    this.batchTimer = null;
    this.metrics = new Map();
    this._disposed = false;

    // Create interceptor managers once - never recreate
    this.interceptors = Object.freeze({
      request: this._createInterceptorManager(),
      response: this._createInterceptorManager(),
    });

    // Use global initialization to prevent multiple inits
    if (this.isRustAvailable && !globalIsInitialized) {
      if (!globalInitPromise) {
        globalInitPromise = this._initializeRustClient();
      }
    }
  }

  _createInterceptorManager() {
    const handlers = [];
    let nextId = 0;

    const push = (handlerOrFn) => {
      if (typeof handlerOrFn === 'function') {
        return manager.use(handlerOrFn);
      }
      if (handlerOrFn && typeof handlerOrFn === 'object') {
        return manager.use(handlerOrFn.fulfilled, handlerOrFn.rejected);
      }
    };

    const manager = Object.freeze({
      use: (fulfilled, rejected) => {
        const id = nextId++;
        handlers.push({ fulfilled, rejected, id });
        return id;
      },
      eject: (id) => {
        const index = handlers.findIndex(h => h.id === id);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      },
      clear: () => {
        handlers.length = 0;
      },
      forEach: (callback) => {
        handlers.forEach(callback);
      },
      push,
      get length() {
        return handlers.length;
      }
    });

    return manager;
  }

  _checkRustAvailability() {
    const isAvailable = !!(
      SecureHttpCryptoModule &&
      typeof SecureHttpCryptoModule.httpExecuteRequest === 'function' &&
      typeof SecureHttpCryptoModule.httpClientInit === 'function'
    );

    if (!isAvailable) {
      console.warn('SecureHttp native module unavailable, falling back to fetch', {
        hasModule: !!SecureHttpCryptoModule,
        hasHttpExecuteRequest:
          !!SecureHttpCryptoModule &&
          typeof SecureHttpCryptoModule.httpExecuteRequest === 'function',
        hasHttpClientInit:
          !!SecureHttpCryptoModule &&
          typeof SecureHttpCryptoModule.httpClientInit === 'function',
      });
    }

    return isAvailable;
  }

  async _initializeRustClient() {
    if (globalIsInitialized) {
      return true;
    }

    try {
      await SecureHttpCryptoModule.httpClientInit();
      globalIsInitialized = true;
      console.log('HTTP client initialized successfully');

      // Warmup connections for better performance
      if (this.config.baseURL) {
        await this._warmupConnections([this.config.baseURL]);
      }
      return true;
    } catch (error) {
      console.warn('HTTP client initialization failed:', error.message);
      this.isRustAvailable = false;
      globalIsInitialized = false;
      globalInitPromise = null;
      return false;
    }
  }

  async _warmupConnections(urls) {
    if (!this.isRustAvailable) return;

    try {
      await SecureHttpCryptoModule.httpWarmupConnections(JSON.stringify(urls));
    } catch (error) {
      console.warn('Connection warmup failed:', error.message);
    }
  }

  // High-performance single request execution
  async request(requestConfig) {
    if (this._disposed) {
      throw new Error('Cannot use disposed RustHttpClient instance');
    }

    const startTime = Date.now();

    try {
      // Apply request interceptors
      let config = { ...requestConfig };

      // Use async iteration for interceptors
      const requestInterceptors = [];
      this.interceptors.request.forEach(h => requestInterceptors.push(h));

      for (const handler of requestInterceptors) {
        if (handler.fulfilled) {
          try {
            config = await Promise.resolve(handler.fulfilled(config));
            if (!config) throw new Error('Request interceptor returned undefined config');
          } catch (e) {
            if (handler.rejected) {
              config = await Promise.resolve(handler.rejected(e));
            } else {
              throw new Error(`Request interceptor error: ${e.message}`);
            }
          }
        }
      }

      // Wait for global initialization
      if (globalInitPromise && !globalIsInitialized) {
        await globalInitPromise;
      }

      let result;
      if (this.isRustAvailable) {
        result = await this._executeRustRequest(config);
      } else {
        result = await this._executeFallbackRequest(config);
      }

      // Apply response interceptors
      const responseInterceptors = [];
      this.interceptors.response.forEach(h => responseInterceptors.push(h));

      for (const handler of responseInterceptors) {
        if (handler.fulfilled) {
          try {
            result = await Promise.resolve(handler.fulfilled(result));
          } catch (e) {
            if (handler.rejected) {
              result = await Promise.resolve(handler.rejected(e));
            } else {
              console.warn('Response interceptor error:', e.message);
            }
          }
        }
      }

      return result;
    } catch (error) {
      this._updateMetrics(requestConfig.url || 'unknown', false, Date.now() - startTime);

      // Apply response error interceptors
      const responseInterceptors = [];
      this.interceptors.response.forEach(h => responseInterceptors.push(h));

      for (const handler of responseInterceptors) {
        if (handler.rejected) {
          try {
            const handled = await Promise.resolve(handler.rejected(error));
            if (handled !== undefined) return handled;
          } catch (e) {
            throw e;
          }
        }
      }

      throw error;
    }
  }

  async _executeRustRequest(requestConfig) {
    const config = {
      base_url: this.config.baseURL,
      timeout_ms: requestConfig.timeout || this.config.timeout,
      max_connections: this.config.maxConnections,
      keep_alive: this.config.keepAlive,
      http2_prior_knowledge: this.config.http2PriorKnowledge,
      enable_compression: this.config.enableCompression,
      enable_caching: this.config.enableCaching,
      cache_ttl_seconds: this.config.cacheTtlSeconds,
      retry_attempts: this.config.retryAttempts,
      retry_delay_ms: this.config.retryDelayMs,
      user_agent: this.config.userAgent,
      headers: { ...this.config.headers, ...requestConfig.headers },
    };

    const request = {
      method: (requestConfig.method || 'GET').toUpperCase(),
      url: requestConfig.url || '',
      headers: requestConfig.headers || {},
      body: requestConfig.data ? JSON.stringify(requestConfig.data) : null,
      timeout_ms: requestConfig.timeout,
      enable_cache: requestConfig.enableCache !== false,
    };

    const startTime = Date.now();

    try {
      const responseJson = await SecureHttpCryptoModule.httpExecuteRequest(
        JSON.stringify(config),
        JSON.stringify(request)
      );

      const response = JSON.parse(responseJson);

      if (response.error) {
        throw new Error(response.error);
      }

      // Parse response body if it's JSON
      let parsedData = response.body;
      try {
        parsedData = JSON.parse(response.body);
      } catch (e) {
        // Keep as string if not valid JSON
      }

      const result = {
        data: parsedData,
        status: response.status,
        statusText: response.status_text,
        headers: response.headers,
        config: requestConfig,
        fromCache: response.from_cache,
        compressed: response.compressed,
        httpVersion: response.http_version,
        duration: response.duration_ms,
      };

      this._updateMetrics(request.url, true, response.duration_ms, response.from_cache);
      return result;

    } catch (error) {
      this._updateMetrics(request.url, false, Date.now() - startTime);
      throw error;
    }
  }

  async _executeFallbackRequest(requestConfig) {
    // Fallback to standard fetch with basic optimizations
    const url = this._buildURL(requestConfig.url);
    const options = {
      method: requestConfig.method || 'GET',
      headers: { ...this.config.headers, ...requestConfig.headers },
      body: requestConfig.data ? JSON.stringify(requestConfig.data) : undefined,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestConfig.timeout || this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        config: requestConfig,
        fromCache: false,
        compressed: false,
        httpVersion: 'HTTP/1.1',
        duration: 0,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Ultra-fast batch request processing
  async batchRequest(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new Error('Batch requests must be a non-empty array');
    }

    if (this.isRustAvailable && requests.length > 1) {
      return await this._executeBatchRustRequests(requests);
    } else {
      // Fallback to parallel individual requests
      return await Promise.all(requests.map(req => this.request(req)));
    }
  }

  async _executeBatchRustRequests(requests) {
    const config = {
      base_url: this.config.baseURL,
      timeout_ms: this.config.timeout,
      max_connections: this.config.maxConnections,
      keep_alive: this.config.keepAlive,
      http2_prior_knowledge: this.config.http2PriorKnowledge,
      enable_compression: this.config.enableCompression,
      enable_caching: this.config.enableCaching,
      cache_ttl_seconds: this.config.cacheTtlSeconds,
      retry_attempts: this.config.retryAttempts,
      retry_delay_ms: this.config.retryDelayMs,
      user_agent: this.config.userAgent,
      headers: this.config.headers,
    };

    const rustRequests = requests.map(req => ({
      method: (req.method || 'GET').toUpperCase(),
      url: req.url || '',
      headers: { ...this.config.headers, ...req.headers },
      body: req.data ? JSON.stringify(req.data) : null,
      timeout_ms: req.timeout,
      enable_cache: req.enableCache !== false,
    }));

    try {
      const resultsJson = await SecureHttpCryptoModule.httpExecuteBatchRequests(
        JSON.stringify(config),
        JSON.stringify(rustRequests)
      );

      const results = JSON.parse(resultsJson);

      return results.map((result, index) => {
        if (result.error) {
          throw new Error(result.error);
        }

        let parsedData = result.body;
        try {
          parsedData = JSON.parse(result.body);
        } catch (e) {
          // Keep as string if not valid JSON
        }

        return {
          data: parsedData,
          status: result.status,
          statusText: result.status_text,
          headers: result.headers,
          config: requests[index],
          fromCache: result.from_cache,
          compressed: result.compressed,
          httpVersion: result.http_version,
          duration: result.duration_ms,
        };
      });
    } catch (error) {
      throw new Error(`Batch request failed: ${error.message}`);
    }
  }

  // Smart request queuing for optimal batching
  queueRequest(requestConfig) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestConfig, resolve, reject });

      if (this.requestQueue.length >= this.batchSize) {
        this._processBatch();
      } else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this._processBatch(), this.batchTimeout);
      }
    });
  }

  async _processBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.requestQueue.length === 0) return;

    const batch = this.requestQueue.splice(0, this.batchSize);

    try {
      const requests = batch.map(item => item.requestConfig);
      const results = await this.batchRequest(requests);

      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach(item => {
        item.reject(error);
      });
    }
  }

  // Cleanup method to prevent memory leaks
  dispose() {
    if (this._disposed) return;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.requestQueue = [];
    this.metrics.clear();
    this.interceptors.request.clear();
    this.interceptors.response.clear();
    this._disposed = true;

    // Remove from cache
    const cacheKey = generateCacheKey(this.config);
    if (instanceCache.get(cacheKey) === this) {
      instanceCache.delete(cacheKey);
    }
  }

  // Performance monitoring and metrics
  getMetrics(endpoint) {
    if (this.isRustAvailable && endpoint) {
      try {
        const metricsJson = SecureHttpCryptoModule.httpGetMetrics(endpoint);
        return metricsJson ? JSON.parse(metricsJson) : null;
      } catch (error) {
        console.warn('Failed to get Rust metrics:', error.message);
      }
    }

    return this.metrics.get(endpoint) || null;
  }

  getAllMetrics() {
    const allMetrics = {};

    for (const [endpoint, metrics] of this.metrics.entries()) {
      allMetrics[endpoint] = metrics;
    }

    return allMetrics;
  }

  _updateMetrics(endpoint, success, duration, fromCache = false) {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
      });
    }

    const metrics = this.metrics.get(endpoint);
    metrics.totalRequests++;

    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    metrics.avgResponseTime = (metrics.avgResponseTime * (metrics.totalRequests - 1) + duration) / metrics.totalRequests;

    if (fromCache) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
    }
  }

  // Cache management
  clearCache() {
    if (this.isRustAvailable) {
      try {
        return SecureHttpCryptoModule.httpClearCache();
      } catch (error) {
        console.warn('Failed to clear Rust cache:', error.message);
      }
    }
    return false;
  }

  getCacheStats() {
    if (this.isRustAvailable) {
      try {
        const statsJson = SecureHttpCryptoModule.httpGetCacheStats();
        return statsJson ? JSON.parse(statsJson) : null;
      } catch (error) {
        console.warn('Failed to get cache stats:', error.message);
      }
    }
    return null;
  }

  // Convenience methods with performance optimizations
  async get(url, config = {}) {
    return this.request({ ...config, url, method: 'GET' });
  }

  async post(url, data, config = {}) {
    return this.request({ ...config, url, method: 'POST', data });
  }

  async put(url, data, config = {}) {
    return this.request({ ...config, url, method: 'PUT', data });
  }

  async delete(url, config = {}) {
    return this.request({ ...config, url, method: 'DELETE' });
  }

  async patch(url, data, config = {}) {
    return this.request({ ...config, url, method: 'PATCH', data });
  }

  // Parallel request execution for maximum throughput
  async parallel(requests) {
    if (this.isRustAvailable && requests.length > 3) {
      // Use Rust batch processing for better performance
      return this.batchRequest(requests);
    } else {
      // Use Promise.all for smaller batches
      return Promise.all(requests.map(req => this.request(req)));
    }
  }

  // Create a new instance with merged configuration
  create(config = {}) {
    const mergedConfig = { ...this.config, ...config };
    return createRustHttpClient(mergedConfig);
  }

  _buildURL(url) {
    if (!url) return this.config.baseURL;
    if (url.startsWith('http')) return url;
    return `${this.config.baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  }

  // Performance benchmarking
  async benchmark(url, iterations = 100) {
    const results = {
      iterations,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
      successRate: 0,
      throughput: 0,
    };

    const startTime = Date.now();
    let successCount = 0;

    const requests = Array(iterations).fill().map(() => ({ url, method: 'GET' }));

    try {
      const responses = await this.parallel(requests);

      responses.forEach(response => {
        if (response.status >= 200 && response.status < 300) {
          successCount++;
        }

        const duration = response.duration || 0;
        results.minTime = Math.min(results.minTime, duration);
        results.maxTime = Math.max(results.maxTime, duration);
      });

      results.totalTime = Date.now() - startTime;
      results.avgTime = results.totalTime / iterations;
      results.successRate = (successCount / iterations) * 100;
      results.throughput = (successCount / results.totalTime) * 1000; // requests per second

    } catch (error) {
      console.error('Benchmark failed:', error.message);
    }

    return results;
  }
}

// Factory function for creating optimized HTTP clients with singleton pattern
export function createRustHttpClient(config = {}) {
  const cacheKey = generateCacheKey(config);

  // Return cached instance if exists and not disposed
  if (instanceCache.has(cacheKey)) {
    const cached = instanceCache.get(cacheKey);
    if (!cached._disposed) {
      return cached;
    }
    // Remove disposed instance
    instanceCache.delete(cacheKey);
  }

  // Create new instance with private key
  const instance = new RustHttpClient(PRIVATE_CONSTRUCTOR_KEY, config);
  instanceCache.set(cacheKey, instance);

  return instance;
}

// Pre-configured high-performance client (singleton)
let _rustHttpInstance = null;

export const rustHttp = new Proxy({}, {
  get(target, prop) {
    if (!_rustHttpInstance || _rustHttpInstance._disposed) {
      _rustHttpInstance = createRustHttpClient({
        enableCaching: true,
        enableCompression: true,
        http2PriorKnowledge: true,
        maxConnections: 200,
        retryAttempts: 3,
      });
    }

    const value = _rustHttpInstance[prop];
    if (typeof value === 'function') {
      return value.bind(_rustHttpInstance);
    }
    return value;
  }
});

// Utility to clear all cached instances (for testing/cleanup)
export function clearAllInstances() {
  instanceCache.forEach(instance => {
    if (!instance._disposed) {
      instance.dispose();
    }
  });
  instanceCache.clear();
  globalInitPromise = null;
  globalIsInitialized = false;
}

export default RustHttpClient;
